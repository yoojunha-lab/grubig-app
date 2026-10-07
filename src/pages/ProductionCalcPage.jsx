import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Plus, Save, Trash2, X, Copy, FilePlus, Search, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { UnsavedChangesDialog } from '../components/common/UnsavedChangesDialog';
import { formatMonthDay } from '../utils/helpers';
import {
  CALC_KINDS, CALC_UNITS, calcKindLabel, unitLabel, calcFromOrder, calcHasData,
  makeStripeRow, makeMelangeRow, makeYarnSlot, splitColorName,
  computeStripe, computeMelange, stripeRowPctSum, stripeRemainderHint, buildCalcCopyText, fmt1, fmtPct,
} from '../utils/yarnDyeCalc';

// ============================================================
// 생산 ▾ 계산기 — 선염 계산기 (대표님 요청 2026-10-07)
//  · 왼쪽: 저장된 계산 목록 (검색 · 누르면 불러오기) / 오른쪽: 계산기 [스트라이프 선염] [멜란지 선염]
//  · 스트라이프 선염: 오더 컬러마다 원사 컬러 비율(%) → 원사 컬러별 수량·혼용율 (같은 이름은 합침, 로스 없음)
//  · 멜란지 선염: 멜란지별 수량 → 수량 비율
//  · [오더 불러오기]: 생산 현황 오더의 컬러명·오더 kg (스트라이프는 컬러명을 '/'로 나눠 원사 컬러 칸을 채움)
//  · 저장 안 한 변경이 있으면 다른 계산·새 계산·다른 메뉴로 갈 때 '저장할까요?'
//  · 계산 규칙: utils/yarnDyeCalc.js · 저장: hooks/domains/useYarnDyeCalc.js (Firestore yarnDyeCalcs)
// ============================================================

const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-teal-200';
const numCls = 'bg-white border rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-right outline-none focus:ring-2 ring-teal-200';

// 오더에 연결된 원단의 원사가 하나뿐이면 그 원사 이름 — '원사 (앞부분)' 자동 채우기
const findBaseYarnName = (order, savedFabrics, yarnLibrary) => {
  const fabric = (savedFabrics || []).find(f => order?.linkedFabricId && String(f.id) === String(order.linkedFabricId));
  const slots = (fabric?.yarns || []).filter(y => y && (y.yarnId || y.tempName) && Number(y.ratio) > 0);
  if (slots.length !== 1) return '';
  const yarnId = String(slots[0].yarnId || '').split('::')[0];
  const yarn = (yarnLibrary || []).find(y => String(y.id) === yarnId);
  return String(yarn?.name || slots[0].tempName || '').trim();
};

// 결과를 클립보드로 (안 되는 브라우저는 예전 방식)
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

export const ProductionCalcPage = ({
  calcs = [],                // 저장된 계산 (Firestore yarnDyeCalcs)
  dyeCalcInput, setDyeCalcInput, editingDyeCalcId, dyeCalcDirty,
  newDyeCalc, loadDyeCalc, saveDyeCalc, deleteDyeCalc,
  orders = [],               // 생산 현황 오더 (오더 불러오기)
  savedFabrics = [], yarnLibrary = [],
  navGuardRef, showToast,
}) => {
  const calc = dyeCalcInput;
  const isStripe = calc.kind !== 'melange';
  const unit = unitLabel(calc.unit);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(null);   // '저장할까요?' 뒤에 할 일
  const [busy, setBusy] = useState(false);

  const editingDoc = editingDyeCalcId ? calcs.find(c => c.id === editingDyeCalcId) || null : null;
  const stripe = useMemo(() => (isStripe ? computeStripe(calc) : null), [isStripe, calc]);
  const melange = useMemo(() => (!isStripe ? computeMelange(calc) : null), [isStripe, calc]);

  // ── 저장 안 한 변경 확인 (다른 계산·새 계산·탭 전환·다른 메뉴) ──
  const guard = (action) => { if (dyeCalcDirty) setPending(() => action); else action(); };
  // 상단 메뉴로 나갈 때도 (App의 requestSetActiveTab이 이 가드를 거침) — 매 렌더 최신 값으로 다시 등록
  useEffect(() => {
    if (!navGuardRef) return undefined;
    navGuardRef.current = (proceed) => { if (dyeCalcDirty) setPending(() => proceed); else proceed(); };
    return () => { navGuardRef.current = null; };
  });
  const keepEditing = () => setPending(null);
  const leaveWithoutSave = () => { const act = pending; setPending(null); if (act) act(); };
  const saveAndLeave = async () => {
    const ok = await saveDyeCalc();
    if (!ok) return; // 저장 못 하면 그대로 (입력값 보존)
    const act = pending;
    setPending(null);
    if (act) act();
  };

  // ── 목록 ──
  const listItems = useMemo(() => {
    const t = search.trim().toUpperCase();
    return [...calcs]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .filter(c => !t || [c.title, c.orderNumber, c.articleNo, c.memo].some(s => String(s || '').toUpperCase().includes(t)));
  }, [calcs, search]);
  const openCalc = (doc) => { if (doc.id !== editingDyeCalcId) guard(() => loadDyeCalc(doc)); };
  const startNew = (kind = calc.kind) => guard(() => newDyeCalc(kind));
  const switchKind = (kind) => { if (kind !== calc.kind) guard(() => newDyeCalc(kind)); };

  const handleSave = async () => {
    setBusy(true);
    try { await saveDyeCalc(); } finally { setBusy(false); }
  };

  // ── 입력 ──
  const patch = (fields) => setDyeCalcInput(prev => ({ ...prev, ...fields }));
  const patchRow = (rowId, fields) => setDyeCalcInput(prev => ({
    ...prev, rows: prev.rows.map(r => (r.id === rowId ? { ...r, ...fields } : r)),
  }));
  const patchYarn = (rowId, yarnId, fields) => setDyeCalcInput(prev => ({
    ...prev,
    rows: prev.rows.map(r => (r.id === rowId ? { ...r, yarns: r.yarns.map(y => (y.id === yarnId ? { ...y, ...fields } : y)) } : r)),
  }));
  const addRow = () => setDyeCalcInput(prev => ({ ...prev, rows: [...prev.rows, prev.kind === 'melange' ? makeMelangeRow() : makeStripeRow()] }));
  const removeRow = (rowId) => setDyeCalcInput(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== rowId) }));
  const addYarn = (rowId) => setDyeCalcInput(prev => ({
    ...prev, rows: prev.rows.map(r => (r.id === rowId ? { ...r, yarns: [...r.yarns, makeYarnSlot()] } : r)),
  }));
  const removeYarn = (rowId, yarnId) => setDyeCalcInput(prev => ({
    ...prev, rows: prev.rows.map(r => (r.id === rowId ? { ...r, yarns: r.yarns.filter(y => y.id !== yarnId) } : r)),
  }));
  // 컬러명 칸을 떠날 때 — 원사 컬러 칸이 모두 비어 있으면 컬러명을 '/'로 나눠 채움 (APRICOT/BARK BROWN → APRICOT, BARK BROWN)
  const fillYarnsFromName = (rowId) => setDyeCalcInput(prev => ({
    ...prev,
    rows: prev.rows.map(r => {
      if (r.id !== rowId) return r;
      const parts = splitColorName(r.name);
      const empty = (r.yarns || []).every(y => !String(y.color || '').trim() && !String(y.pct || '').trim());
      return parts.length >= 2 && empty ? { ...r, yarns: parts.map(c => makeYarnSlot(c)) } : r;
    }),
  }));

  // ── 오더 불러오기 (생산 현황) ──
  const orderOptions = useMemo(() => [...(orders || [])]
    .filter(o => (o.colors || []).length > 0)
    .sort((a, b) => String(b.orderNumber || '').localeCompare(String(a.orderNumber || '')))
    .map(o => ({
      id: String(o.id),
      name: `${o.orderNumber || '(오더# 없음)'} · ${o.articleNo || '-'}${o.customer ? ` · ${o.customer}` : ''} (${(o.colors || []).length}컬러)`,
    })), [orders]);
  const applyOrder = (orderId) => {
    const order = (orders || []).find(o => String(o.id) === String(orderId));
    if (!order) { patch({ orderId: '', orderNumber: '', articleNo: '' }); return; } // 칸을 비우면 연결만 풂
    const hasRows = calcHasData({ ...calc, title: '', memo: '', baseYarnName: '', orderId: '' });
    if (hasRows && !window.confirm(`지금 넣은 줄을 ${order.orderNumber || '이 오더'}의 컬러(${(order.colors || []).length}개)로 바꿀까요?`)) return;
    const next = calcFromOrder(order, calc.kind, { baseYarnName: findBaseYarnName(order, savedFabrics, yarnLibrary) });
    setDyeCalcInput(prev => ({
      ...next,
      baseYarnName: next.baseYarnName || prev.baseYarnName,
      memo: prev.memo,
      ...(prev.createdAt ? { createdAt: prev.createdAt, createdBy: prev.createdBy } : {}),
    }));
  };

  const handleCopy = async () => {
    const ok = await copyText(buildCalcCopyText(calc));
    showToast(ok ? '결과를 복사했어요. 엑셀에 붙여 넣으세요.' : '복사하지 못했어요. 표를 직접 선택해서 복사해 주세요.', ok ? 'success' : 'error');
  };

  return (
    <>
    <div className="max-w-[1600px] mx-auto w-full print:hidden">
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── 저장된 계산 ── */}
        <aside className="w-full lg:w-72 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:max-h-[calc(100vh-150px)]">
          <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-xs font-extrabold text-slate-500">저장된 계산 ({calcs.length})</span>
            <button type="button" onClick={() => startNew()} className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5">
              <Plus className="w-3.5 h-3.5" /> 새로 계산
            </button>
          </div>
          <div className="p-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="제목·오더#·Article 검색"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none focus:ring-2 ring-teal-200" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 max-h-60 lg:max-h-none">
            {listItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">{calcs.length === 0 ? '저장된 계산이 없어요.' : '찾는 계산이 없어요.'}</div>
            ) : listItems.map(c => {
              const active = c.id === editingDyeCalcId;
              return (
                <button key={c.id} type="button" onClick={() => openCalc(c)}
                  className={`w-full text-left px-3 py-2 border-b border-slate-100 transition-colors ${active ? 'bg-teal-50 border-l-[3px] border-l-teal-500' : 'border-l-[3px] border-l-transparent hover:bg-teal-50/50'}`}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[13px] font-bold text-slate-800 truncate">{c.title || calcKindLabel(c.kind)}</span>
                    <span className={`shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${c.kind === 'melange' ? 'text-violet-700 bg-violet-50 border-violet-200' : 'text-teal-700 bg-teal-50 border-teal-200'}`}>
                      {c.kind === 'melange' ? '멜란지' : '스트라이프'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate">{(c.rows || []).length}줄{c.orderNumber ? ` · ${c.orderNumber}` : ''}</span>
                    <span className="shrink-0">{formatMonthDay(c.updatedAt)}{c.updatedBy ? ` · ${c.updatedBy}` : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── 계산기 ── */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          {/* 머리줄 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-teal-600" /> 계산기 <span className="text-sm font-bold text-slate-400">· 선염</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {editingDoc
                  ? <>저장된 계산을 고치는 중 — 마지막 저장 {formatMonthDay(editingDoc.updatedAt)}{editingDoc.updatedBy ? ` · ${editingDoc.updatedBy}` : ''}</>
                  : '새 계산'}
                {dyeCalcDirty && <span className="ml-2 font-bold text-amber-600">● 저장 안 한 변경 있음</span>}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {editingDoc && (
                <button type="button" onClick={() => deleteDyeCalc(editingDoc.id)}
                  className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-500 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center gap-1.5 text-sm font-bold">
                  <Trash2 className="w-4 h-4" /> 삭제
                </button>
              )}
              <button type="button" onClick={() => startNew()}
                className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5 text-sm font-bold">
                <FilePlus className="w-4 h-4" /> 새로 계산
              </button>
              <button type="button" onClick={handleSave} disabled={busy}
                className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-1.5 text-sm font-bold disabled:opacity-50">
                <Save className="w-4 h-4" /> 저장
              </button>
            </div>
          </div>

          {/* 계산 종류 */}
          <div className="grid grid-cols-2 gap-2">
            {CALC_KINDS.map(k => {
              const on = calc.kind === k.key;
              return (
                <button key={k.key} type="button" onClick={() => switchKind(k.key)}
                  className={`text-left rounded-xl border px-3 py-2 transition-colors ${on ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-teal-50'}`}>
                  <div className="text-sm font-extrabold">{k.label}</div>
                  <div className={`text-[11px] ${on ? 'text-teal-50' : 'text-slate-400'}`}>{k.hint}</div>
                </button>
              );
            })}
          </div>

          {/* 기본 정보 */}
          <section className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
              <div className="md:col-span-4">
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">제목</label>
                <input type="text" value={calc.title} onChange={e => patch({ title: e.target.value })}
                  placeholder={`비우면 '${calcKindLabel(calc.kind)} 날짜'`} className={inputCls} />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">오더 불러오기 <span className="font-medium text-slate-400">(생산 현황 — 컬러명·오더 kg)</span></label>
                <SearchableSelect value={calc.orderId} options={orderOptions} onChange={applyOrder} placeholder="오더#·Article로 검색" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">수량 단위</label>
                <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                  {CALC_UNITS.map(u => (
                    <button key={u.key} type="button" onClick={() => patch({ unit: u.key })}
                      className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${calc.unit === u.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              {isStripe && (
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">원사 (앞부분) <span className="font-medium text-slate-400">— 결과 원사명 = 앞부분 + 컬러</span></label>
                  <input type="text" value={calc.baseYarnName} onChange={e => patch({ baseYarnName: e.target.value })}
                    placeholder="예: F/60Nm SW/N 87/13" className={inputCls} />
                </div>
              )}
              <div className={isStripe ? 'md:col-span-6' : 'md:col-span-12'}>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">메모</label>
                <input type="text" value={calc.memo} onChange={e => patch({ memo: e.target.value })} placeholder="선택" className={inputCls} />
              </div>
            </div>
          </section>

          {isStripe
            ? <StripeEditor calc={calc} unit={unit} result={stripe} onRow={patchRow} onYarn={patchYarn}
              onAddRow={addRow} onRemoveRow={removeRow} onAddYarn={addYarn} onRemoveYarn={removeYarn} onNameBlur={fillYarnsFromName} />
            : <MelangeEditor calc={calc} unit={unit} result={melange} onRow={patchRow} onAddRow={addRow} onRemoveRow={removeRow} />}

          {isStripe && <StripeResult result={stripe} unit={unit} onCopy={handleCopy} />}
          {!isStripe && (melange?.lines || []).length > 0 && (
            <div className="flex justify-end">
              <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100">
                <Copy className="w-3.5 h-3.5" /> 결과 복사
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 팝업은 화면의 space-y 칸 밖에 (팝업 규약) */}
    <UnsavedChangesDialog
      open={!!pending}
      message="선염 계산에 저장하지 않은 변경사항이 있어요. 저장할까요?"
      onSave={saveAndLeave}
      onDiscard={leaveWithoutSave}
      onKeepEditing={keepEditing}
    />
    </>
  );
};

// ① 스트라이프 선염 — 오더 컬러 줄 (컬러명 · 수량 · 원사 컬러별 비율)
const StripeEditor = ({ calc, unit, result, onRow, onYarn, onAddRow, onRemoveRow, onAddYarn, onRemoveYarn, onNameBlur }) => {
  const issueRows = new Set((result?.issues || []).map(i => i.rowId));
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-extrabold text-slate-700">오더 컬러 <span className="font-medium text-xs text-slate-400">— 원사 컬러마다 비율(%)을 넣어요 (한 줄 합계 100%)</span></h3>
        <span className="text-[11px] text-slate-500">오더 합계 <b className="font-mono text-slate-800">{fmt1(result?.orderTotal)} {unit}</b></span>
      </div>
      <div className="hidden md:grid grid-cols-[28px_minmax(140px,1fr)_110px_minmax(280px,2.4fr)_56px_28px] gap-2 px-1 mb-1 text-[10px] font-bold text-slate-400">
        <div>No.</div><div>컬러명</div><div className="text-right">수량 ({unit})</div><div>원사 컬러 · 비율 (%)</div><div className="text-right">합계</div><div />
      </div>
      <div className="space-y-2 md:space-y-1.5">
        {calc.rows.map((row, idx) => {
          const sum = stripeRowPctSum(row);
          const hasPct = (row.yarns || []).some(y => String(y.pct || '').trim() !== '');
          const sumOk = Math.abs(sum - 100) <= 0.05;
          return (
            <div key={row.id} className={`grid grid-cols-[28px_1fr_28px] md:grid-cols-[28px_minmax(140px,1fr)_110px_minmax(280px,2.4fr)_56px_28px] gap-2 items-start rounded-lg p-1.5 md:p-1 ${issueRows.has(row.id) ? 'bg-red-50/60 ring-1 ring-red-100' : 'bg-slate-50/60 md:bg-transparent'}`}>
              <div className="text-[11px] font-mono font-bold text-slate-400 pt-2">{idx + 1}</div>
              <input type="text" value={row.name} onChange={e => onRow(row.id, { name: e.target.value.toUpperCase() })} onBlur={() => onNameBlur(row.id)}
                placeholder="예: APRICOT/BARK BROWN" className={`${inputCls} font-bold uppercase`} />
              <button type="button" onClick={() => onRemoveRow(row.id)} title="이 줄 지우기" className="md:hidden text-slate-300 hover:text-red-500 pt-2"><X className="w-4 h-4" /></button>
              <div className="col-start-2 md:col-start-auto relative">
                <input type="text" inputMode="decimal" value={row.qty} onChange={e => onRow(row.id, { qty: e.target.value })} placeholder="수량"
                  className={`${numCls} w-full pr-9 ${String(row.qty || '').trim() === '' && hasPct ? 'border-red-300' : 'border-slate-300'}`} />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">{unit}</span>
              </div>
              <div className="col-start-2 md:col-start-auto flex flex-wrap items-center gap-1.5">
                {row.yarns.map(y => (
                  <div key={y.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg pl-1 pr-0.5 py-0.5">
                    <input type="text" value={y.color} onChange={e => onYarn(row.id, y.id, { color: e.target.value.toUpperCase() })} placeholder="원사 컬러"
                      className="w-28 px-1.5 py-1 text-xs font-bold uppercase outline-none rounded focus:bg-teal-50" />
                    <input type="text" inputMode="decimal" value={y.pct} onChange={e => onYarn(row.id, y.id, { pct: e.target.value })}
                      placeholder={stripeRemainderHint(row, y.id) || '%'}
                      className="w-12 px-1.5 py-1 text-xs font-mono font-bold text-right outline-none rounded bg-teal-50/60 focus:bg-teal-50 placeholder:text-teal-300" />
                    <span className="text-[10px] text-slate-400">%</span>
                    {row.yarns.length > 1 && (
                      <button type="button" onClick={() => onRemoveYarn(row.id, y.id)} title="이 원사 칸 지우기" className="text-slate-300 hover:text-red-500 px-0.5"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => onAddYarn(row.id)} title="원사 컬러 칸 더하기"
                  className="h-7 px-2 rounded-lg border border-dashed border-teal-300 text-teal-700 text-[11px] font-bold hover:bg-teal-50 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> 원사
                </button>
              </div>
              <div className={`col-start-2 md:col-start-auto text-xs font-extrabold md:text-right pt-1.5 ${!hasPct ? 'text-slate-300' : sumOk ? 'text-emerald-600' : 'text-red-600'}`}>
                {hasPct ? `${sum}%` : '—'}
              </div>
              <button type="button" onClick={() => onRemoveRow(row.id)} title="이 줄 지우기" className="hidden md:block text-slate-300 hover:text-red-500 pt-2"><X className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onAddRow}
        className="mt-2 w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" /> 오더 컬러 줄 더하기
      </button>
      <p className="text-[10px] text-slate-400 mt-1.5">컬러명에 '/'가 있으면 칸을 떠날 때 원사 컬러 칸을 나눠 채워요 (원사 컬러 칸이 비어 있을 때). 원사 컬러 이름이 같으면 결과에서 합쳐요 (대소문자·띄어쓰기 무시).</p>
    </section>
  );
};

// ① 스트라이프 선염 결과 — 원사 컬러별 수량·혼용율
const StripeResult = ({ result, unit, onCopy }) => {
  const lines = result?.lines || [];
  const issues = result?.issues || [];
  return (
    <section className="bg-white border border-teal-200 rounded-2xl p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-extrabold text-teal-800">결과 — 원사 컬러별 <span className="font-medium text-xs text-slate-400">(같은 이름은 합침 · 로스 없음)</span></h3>
        {lines.length > 0 && (
          <button type="button" onClick={onCopy} className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100">
            <Copy className="w-3.5 h-3.5" /> 결과 복사
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-red-700">
          <div className="text-[11px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 확인해 주세요</div>
          <ul className="text-[11px] pl-5 list-disc">{issues.map((i, n) => <li key={`${i.rowId}_${n}`}>{i.text}</li>)}</ul>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">오더 컬러에 수량과 원사 컬러 비율을 넣으면 계산돼요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b-2 border-slate-200">
                <th className="text-left font-bold py-1.5 px-2">원사명</th>
                <th className="text-right font-bold py-1.5 px-2 w-24">혼용율</th>
                <th className="text-right font-bold py-1.5 px-2 w-28">수량 ({unit})</th>
                <th className="text-left font-bold py-1.5 px-2">어디서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map(l => (
                <tr key={l.key}>
                  <td className="py-2 px-2 font-bold text-slate-800">{l.yarnName}</td>
                  <td className="py-2 px-2 text-right font-mono font-extrabold text-teal-700">{fmtPct(l.pct)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">{fmt1(l.qty)}</td>
                  <td className="py-2 px-2 text-[11px] text-slate-500">
                    {l.sources.map(s => `${s.rowName} ${fmt1(s.qty)} (${s.pct}%)`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-extrabold">
                <td className="py-2 px-2 text-slate-600">합계</td>
                <td className="py-2 px-2 text-right font-mono text-slate-700">100.0%</td>
                <td className="py-2 px-2 text-right font-mono text-slate-800">{fmt1(result.yarnTotal)}</td>
                <td className="py-2 px-2 text-[11px] font-medium text-slate-400">
                  {Math.abs(result.yarnTotal - result.orderTotal) > 0.05 ? `오더 합계 ${fmt1(result.orderTotal)} ${unit}와 달라요 — 원사 비율 합계 확인` : `오더 합계 ${fmt1(result.orderTotal)} ${unit}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
};

// ② 멜란지 선염 — 멜란지별 수량 → 수량 비율 (입력과 결과를 한 표에)
const MelangeEditor = ({ calc, unit, result, onRow, onAddRow, onRemoveRow }) => {
  const pctById = new Map((result?.lines || []).map(l => [l.id, l.pct]));
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4">
      <h3 className="text-sm font-extrabold text-slate-700 mb-2">멜란지별 수량 <span className="font-medium text-xs text-slate-400">— 수량 비율 = 그 줄 수량 ÷ 합계</span></h3>
      <div className="hidden md:grid grid-cols-[28px_1fr_120px_80px_28px] gap-2 px-1 mb-1 text-[10px] font-bold text-slate-400">
        <div>No.</div><div>멜란지</div><div className="text-right">수량 ({unit})</div><div className="text-right">비율</div><div />
      </div>
      <div className="space-y-2 md:space-y-1.5">
        {calc.rows.map((row, idx) => (
          // 휴대폰: [No·멜란지·✕] 아래 [수량·비율] / PC: 한 줄 (md:contents로 수량·비율 칸을 표 칸으로)
          <div key={row.id} className="grid grid-cols-[24px_1fr_24px] md:grid-cols-[28px_1fr_120px_80px_28px] gap-2 items-center rounded-lg p-1.5 md:p-0 bg-slate-50/60 md:bg-transparent">
            <div className="text-[11px] font-mono font-bold text-slate-400">{idx + 1}</div>
            <input type="text" value={row.label} onChange={e => onRow(row.id, { label: e.target.value })} placeholder="예: 1% 멜란지" className={`${inputCls} font-bold`} />
            <button type="button" onClick={() => onRemoveRow(row.id)} title="이 줄 지우기" className="md:hidden text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button>
            <div className="col-start-2 flex items-center gap-2 md:contents">
              <div className="relative flex-1">
                <input type="text" inputMode="decimal" value={row.qty} onChange={e => onRow(row.id, { qty: e.target.value })} placeholder="수량"
                  className={`${numCls} w-full pr-9 border-slate-300`} />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">{unit}</span>
              </div>
              <div className="w-20 text-right font-mono font-extrabold text-teal-700">{pctById.has(row.id) ? fmtPct(pctById.get(row.id)) : '—'}</div>
            </div>
            <button type="button" onClick={() => onRemoveRow(row.id)} title="이 줄 지우기" className="hidden md:block text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAddRow}
        className="mt-2 w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" /> 줄 더하기
      </button>
      <div className="mt-2 pt-2 border-t-2 border-slate-200 flex items-center justify-end gap-4 text-sm font-extrabold px-1">
        <span className="text-slate-600 mr-auto">합계</span>
        <span className="font-mono text-slate-800">{fmt1(result?.total)} {unit}</span>
        <span className="font-mono text-slate-700 w-20 text-right">{(result?.lines || []).length ? '100.0%' : '—'}</span>
        <span className="hidden md:block w-5" />
      </div>
    </section>
  );
};
