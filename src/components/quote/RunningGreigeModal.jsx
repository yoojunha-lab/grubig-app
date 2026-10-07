import React, { useMemo, useRef, useState } from 'react';
import { X, Plus, Warehouse, AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { SearchableSelect } from '../common/SearchableSelect';
import { CostWarningBadge } from '../cost/CostWarnings';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { num, usd, roundUsd, smartRound } from '../../utils/helpers';
import { KNIT_FEE_MODE_LABEL } from '../../constants/costing';
import {
  normalizeRunning, formatQuotePrice, getCustomRowRate, getMarginAddCurrency, toQuoteCurrencyAdd,
} from '../../utils/quoteModel';

/**
 * 러닝 생지 견적 창 (대표님 요청 2026-10-07)
 *  미리 짜 둔 생지(러닝 생지)로 소량·여러 컬러 오더를 받을 때 — 생지 짠 수량·컬러별 수량을 넣어 실비를 계산해 보고(시뮬레이션)
 *  [별도 견적에 넣기]로 별도 견적 줄로 넣음 (같은 원단은 한 줄만 — 일반 줄이 있으면 그 줄이 러닝 생지 줄로 바뀜)
 *  ① 원단  ② 생지 짠 수량 · 컬러별 수량  ③ 원가 (YD당 실비 + 비교·소량 추가분)  ④ 판매가 (일반 별도 견적 줄과 같은 이익율·YD당 정액)
 *  계산: useQuotation.previewRunningRow (별도 견적 줄과 같은 계산) · 규칙: docs/costing-model.md §5-B '러닝 생지 견적'
 */

const BLANK_FORM = { rowId: null, fabricId: '', greigeQty: '', colorQtys: ['', ''], marginRate: '', marginAdd: '' };
const NO_ROWS = []; // 별도 견적 줄이 없을 때 (매번 새 배열이 생기지 않게)
const isBlank = (v) => v === undefined || v === null || v === '';
const toInput = (v) => (isBlank(v) ? '' : String(v));

// 별도 견적 줄 → 창 입력값. 러닝 생지 줄이면 그 조건, 일반 줄이면 수량을 컬러수로 고르게 나눈 칸 (생지 짠 수량은 비움)
const formFromRow = (row) => {
  const running = normalizeRunning(row?.running);
  const qty = Math.round(Number(row?.qty) || 0);
  const colors = Math.round(Number(row?.colors) || 0);
  const even = qty > 0 && colors > 0
    ? Array.from({ length: colors }, (_, i) => String(Math.floor(qty / colors) + (i < qty % colors ? 1 : 0)))
    : ['', ''];
  return {
    rowId: row.id,
    fabricId: String(row.fabricId ?? ''),
    greigeQty: running && running.greigeQty > 0 ? String(running.greigeQty) : '',
    colorQtys: running ? running.colorQtys.map(String) : even,
    marginRate: toInput(row.marginRate),
    marginAdd: toInput(row.marginAdd),
  };
};

export const RunningGreigeModal = ({
  initialRowId = null,   // 고칠 별도 견적 줄 id (없으면 새로 — 원단부터 고름)
  quote,                 // 작성 중인 견적 (별도 견적 줄·통화·이익율 기본값)
  quoteRate,             // 이 견적의 환율 (수출 견적의 YD당 정액 '≈ $' 안내용 — 견적서 화면과 같은 값)
  fabrics = [],          // 원단 리스트 — 러닝 생지는 원단 리스트 원단만 (개발 의뢰 품목은 짜 둔 생지가 없음)
  preview,               // (draft) => useQuotation.previewRunningRow 결과
  onSave,                // (draft) => 넣었으면 true
  onRelease,             // (rowId) => 일반 별도 견적 줄로 되돌렸으면 true
  onClose,
}) => {
  const customItems = quote?.customItems || NO_ROWS;
  const [form, setForm] = useState(() => {
    const row = initialRowId ? customItems.find(r => r.id === initialRowId) : null;
    return row ? formFromRow(row) : BLANK_FORM;
  });
  const [leavePending, setLeavePending] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // [넣기]를 누른 뒤부터 막는 사유를 빨갛게
  const savingRef = useRef(false);                      // 처리 중 잠금 — 빠르게 두 번 눌러도 한 번만 (팝업 규약)

  // 저장 안 한 변경 확인 — 새로 넣을 때는 빈 양식 기준, 고칠 때는 열 때 값 기준 (팝업 규약)
  const [guardInitial] = useState(() => (initialRowId ? null : BLANK_FORM));
  const guard = useUnsavedGuard(form, true, { initial: guardInitial });

  const isEdit = !!initialRowId;
  const targetRow = form.rowId ? customItems.find(r => r.id === form.rowId) || null : null;
  const targetIsRunning = !!normalizeRunning(targetRow?.running);
  const currency = quote?.currency === 'USD' ? 'USD' : 'KRW';
  const isUsd = currency === 'USD';
  const fmt = (v) => (isUsd ? `$${usd(v)}` : `₩${num(v)}`);
  const fmtSigned = (v) => `${v < 0 ? '−' : '+'}${fmt(Math.abs(isUsd ? v : Math.round(v)))}`;

  // ── 입력 확인 ──
  const greigeNum = Math.round(Number(form.greigeQty) || 0);
  const colorNums = form.colorQtys.map(v => Math.round(Number(v) || 0));
  const badColors = colorNums.map(q => !(q > 0));
  const total = colorNums.reduce((sum, q) => sum + Math.max(0, q), 0);
  const lotShort = greigeNum > 0 && total > 0 && greigeNum < total;
  const problems = [];
  if (!form.fabricId) problems.push('원단을 골라 주세요.');
  if (!(greigeNum > 0)) problems.push('생지 짠 수량을 넣어 주세요.');
  if (colorNums.length === 0) problems.push('컬러를 1개 이상 넣어 주세요.');
  else if (badColors.some(Boolean)) problems.push('비어 있는 컬러 칸이 있어요. (안 쓰는 칸은 ✕로 지워 주세요)');
  if (lotShort) problems.push(`생지 짠 수량(${num(greigeNum)}YD)이 오더 수량(${num(total)}YD)보다 적어요.`);
  const ready = problems.length === 0;

  // ── 계산 (별도 견적 줄과 같은 계산) — 입력이 다 채워졌을 때만 ──
  const draft = useMemo(() => ({
    rowId: form.rowId,
    fabricId: form.fabricId,
    running: { greigeQty: form.greigeQty, colorQtys: form.colorQtys },
    marginRate: form.marginRate,
    marginAdd: form.marginAdd,
  }), [form]);
  const pv = useMemo(() => (ready && preview ? preview(draft) : null), [ready, preview, draft]);
  const calc = pv?.calc || null;
  const mode = calc ? calc[pv.marketType] : null;          // 견적 시장의 원가 (내수 ₩ / 수출 $)
  const lines = mode?.lines || { material: [], knit: [], proc: [], etc: [] };
  const exclude = pv?.exclude || {};
  const row = pv?.row || null;
  const price = pv?.price ?? null;
  const fabricMissing = ready && !pv;                       // 고칠 줄의 원단이 삭제됨 → 계산 불가
  const lineSum = (group, key) => (lines[group] || []).filter(l => l.key === key).reduce((sum, l) => sum + l.amt, 0);
  const extrasTotal = (pv?.extras || []).reduce((sum, e) => sum + e.amount, 0);

  // ③ 원가 내역 — YD당 (견적 통화)
  const breakdown = mode ? [
    {
      label: '원사', amt: mode.yarnCostYd,
      note: `생지 ${num(calc.running?.greigeQty)}YD로 짤 때 원가 · 편직 LOSS ${calc.kg.knitLossPct}%${calc.importFreight.lines.length > 0 ? ' · 수입 원사 운반비(생지 짤 때 kg 구간) 포함' : ''}`,
    },
    {
      label: '편직비', amt: mode.knitCostYd,
      note: `생지 ${num(calc.running?.greigeKg)}kg 짤 때 ₩${num(calc.running?.knitTotal)} (${KNIT_FEE_MODE_LABEL[calc.knit.mode] || ''}) 중 이 오더 몫`,
    },
    {
      label: '염가공', amt: lineSum('proc', 'dye'),
      note: `청구 ${num(calc.dye.billedKg)}kg (실제 생지 ${num(calc.kg.greige)}kg)${calc.dye.minApplied ? ` · ${num(calc.dye.minKg)}kg 미만 컬러는 ${num(calc.dye.minKg)}kg로 청구` : ''}`,
    },
    ...(lines.proc || []).filter(l => l.key === 'fin').map(l => ({ label: l.name, amt: l.amt, note: '후가공 (이 오더 가공지 kg)' })),
    { label: '이화학', amt: lineSum('etc', 'chem'), note: `${calc.chem.colors}컬러 × ₩${num(calc.chem.feePerColor)}`, excluded: exclude.excludeChem },
    { label: '운임', amt: lineSum('etc', 'freight'), note: `${num(calc.qty)}YD 구간 · 오더당 ₩${num(calc.freight.total)}` },
    { label: '외관검사', amt: lineSum('etc', 'visual'), note: `YD당 ₩${num(calc.visual.perYd)}`, excluded: exclude.excludeVisual },
    ...(lines.etc || []).filter(l => l.key === 'custom').map(l => ({ label: l.name, amt: l.amt, note: '품목별 추가비용' })),
  ] : [];
  // 순원가 — 반올림·위험마진 전 합계에서 '별도 견적 전체' 제외 항목을 뺀 값 (기준원가와 같은 계산)
  const rawAfterExclude = mode
    ? mode.rawCostYd - (exclude.excludeVisual ? mode.visualYd : 0) - (exclude.excludeChem ? mode.chemYd : 0)
    : 0;

  // ④ 판매가 — 일반 별도 견적 줄과 같은 기본값 (이익율: 수량 구간 / 정액: 0)
  const qtyForRate = row?.qty || total;
  const rateDefault = getCustomRowRate({ qty: qtyForRate, marginRate: null }, quote);
  const addBasis = getMarginAddCurrency(quote);
  const addSym = addBasis === 'USD' ? '$' : '₩';
  const addUsd = isUsd && addBasis === 'KRW' && Number(form.marginAdd) > 0
    ? `≈ $${usd(roundUsd(toQuoteCurrencyAdd(form.marginAdd, { ...quote, exchangeRate: quoteRate || quote?.exchangeRate })))}`
    : '';
  const totalAmount = price === null || !(qtyForRate > 0) ? null : (isUsd ? roundUsd(price * qtyForRate) : price * qtyForRate);

  // ── 원단 고르기 (새로 넣을 때) — 별도 견적에 이미 있는 원단은 그 줄을 고침 ──
  const fabricOptions = useMemo(() => {
    const inCustom = new Map(customItems.map(r => [String(r.fabricId), r]));
    return (fabrics || []).map(f => {
      const r = inCustom.get(String(f.id));
      const tag = r ? (normalizeRunning(r.running) ? '  (별도 견적에 있음 · 러닝 생지)' : '  (별도 견적에 있음)') : '';
      return { id: String(f.id), name: `${f.article || ''} · ${f.itemName || ''}${tag}` };
    });
  }, [fabrics, customItems]);

  const selectFabric = (fabricId) => setForm(prev => {
    const id = String(fabricId || '');
    if (!id) return { ...prev, fabricId: '', rowId: null };
    const existing = customItems.find(r => String(r.fabricId) === id) || null;
    if (!existing) return { ...prev, fabricId: id, rowId: null };
    // 러닝 생지 줄이면 그 조건을 불러옴. 일반 줄이면 비어 있는 칸만 그 줄 값으로 (컬러 칸 = 수량을 고르게 나눈 값)
    const fromRow = formFromRow(existing);
    if (normalizeRunning(existing.running)) return fromRow;
    return {
      ...prev,
      fabricId: id,
      rowId: existing.id,
      colorQtys: prev.colorQtys.every(v => isBlank(v)) ? fromRow.colorQtys : prev.colorQtys,
      marginRate: isBlank(prev.marginRate) ? fromRow.marginRate : prev.marginRate,
      marginAdd: isBlank(prev.marginAdd) ? fromRow.marginAdd : prev.marginAdd,
    };
  });

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setColor = (i, value) => setForm(prev => ({ ...prev, colorQtys: prev.colorQtys.map((v, idx) => (idx === i ? value : v)) }));
  const addColor = () => setForm(prev => ({ ...prev, colorQtys: [...prev.colorQtys, ''] }));
  const removeColor = (i) => setForm(prev => ({ ...prev, colorQtys: prev.colorQtys.filter((_, idx) => idx !== i) }));

  // ── 넣기 · 닫기 · 해제 ──
  // 반환: 넣었으면 true. 넣으면 창이 닫히므로 잠금은 풀지 않음 (빠른 두 번 누름 방지)
  const save = () => {
    if (savingRef.current) return false;
    if (!ready) { setShowErrors(true); return false; }
    savingRef.current = true;
    const ok = onSave(draft) === true;
    if (!ok) savingRef.current = false;
    return ok;
  };
  const handleSave = () => { if (save()) onClose(); };
  const requestClose = () => { if (guard.isDirty()) setLeavePending(true); else onClose(); };
  const saveAndClose = () => { setLeavePending(false); if (save()) onClose(); };
  const handleRelease = () => {
    if (!targetRow || savingRef.current) return;
    if (!window.confirm(
      `러닝 생지 조건을 빼고 일반 별도 견적 줄로 되돌릴까요?\n\n` +
      `수량·컬러수(${num(targetRow.qty)}YD · ${num(targetRow.colors)}컬러)는 그대로 두고, 컬러별로 고르게 나눈 기준으로 다시 계산해요.`
    )) return;
    if (onRelease(targetRow.id)) onClose();
  };

  const saveLabel = form.rowId ? '저장' : '별도 견적에 넣기';
  const sectionCls = 'bg-white border border-slate-200 rounded-xl p-3 md:p-4';

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto px-2 md:px-6" onClose={requestClose}>
        <div className="w-full max-w-3xl bg-slate-50 rounded-2xl shadow-2xl my-2 md:my-6" onClick={e => e.stopPropagation()}>

          {/* 머리줄 */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 rounded-t-2xl px-4 md:px-5 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <span className="bg-teal-600 text-white p-1.5 rounded-lg shadow-sm"><Warehouse className="w-4 h-4" /></span>
                러닝 생지 견적
                {isEdit && targetRow && <span className="font-mono text-sm text-teal-700 uppercase">{targetRow.article}</span>}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                미리 짜 둔 생지로 소량·여러 컬러 오더를 받을 때 — 원사·편직은 <b>생지 짠 수량</b>으로 짠 원가, 염색은 <b>컬러별 실제 수량</b>으로 실비 계산해요.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-[10px] text-slate-400 whitespace-nowrap">
                {isUsd ? '수출 $' : '내수 ₩'} · 견적 환율 ₩{num(quoteRate)}
              </span>
              <button type="button" onClick={requestClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg" title="닫기"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="p-3 md:p-5 space-y-3">
            {/* ① 원단 */}
            <section className={sectionCls}>
              <h3 className="text-sm font-extrabold text-slate-700 mb-2">① 원단</h3>
              {isEdit ? (
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <span className="uppercase">{targetRow?.article}</span>
                  <span className="text-slate-500 font-medium">{targetRow?.itemName}</span>
                  <CostWarningBadge warnings={row?.costWarnings || targetRow?.costWarnings} />
                </div>
              ) : (
                <SearchableSelect
                  value={form.fabricId}
                  options={fabricOptions}
                  onChange={selectFabric}
                  placeholder="Article·원단명으로 검색"
                />
              )}
              {row && (
                <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span>{row.widthCut}/{row.widthFull}" · {row.gsm}g · MCQ {num(row.mcqYd)}YD/컬러</span>
                  {!isEdit && <CostWarningBadge warnings={row.costWarnings} />}
                </div>
              )}
              {form.rowId && targetRow && !targetIsRunning && (
                <div className="mt-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  이 원단은 별도 견적에 일반 줄({num(targetRow.qty)}YD · {num(targetRow.colors)}컬러)로 있어요. [{saveLabel}] 버튼을 누르면 그 줄이 러닝 생지 견적으로 바뀌어요. (같은 원단은 한 줄만)
                </div>
              )}
              {!isEdit && form.rowId && targetIsRunning && (
                <div className="mt-2 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                  이 원단은 이미 러닝 생지 줄로 있어서 그 조건을 불러왔어요. 저장하면 그 줄을 고쳐요.
                </div>
              )}
              {fabricMissing && (
                <div className="mt-2 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  원단이 삭제되어 다시 계산할 수 없어요.
                </div>
              )}
            </section>

            {/* ② 생지 짠 수량 · 컬러별 수량 */}
            <section className={sectionCls}>
              <h3 className="text-sm font-extrabold text-slate-700 mb-2">② 생지 짠 수량 · 컬러별 수량</h3>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">생지 짠 수량 <span className="text-red-400">*</span></label>
                  <div className="relative w-[140px]">
                    <input type="number" min="1" step="1" value={form.greigeQty} onChange={e => setField('greigeQty', e.target.value)} placeholder="예: 3000"
                      className={`w-full border rounded-lg pl-2 pr-9 py-1.5 text-right text-sm font-mono font-bold outline-none focus:ring-2 ring-teal-200 ${(lotShort || (showErrors && !(greigeNum > 0))) ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-300 text-slate-800'}`} />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">YD</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 pt-5 leading-snug flex-1 min-w-[200px]">
                  {calc?.running ? (
                    <>= 생지 약 <b className="text-slate-700">{num(calc.running.greigeKg)}kg</b> · 편직 LOSS {calc.kg.knitLossPct}% · 편직비 {KNIT_FEE_MODE_LABEL[calc.knit.mode] || ''}</>
                  ) : (
                    <>원가 표 수량과 같은 가공지 기준 YD예요. 편직 정액·편직 LOSS·수입 원사 운반비를 이 수량으로 짠 기준으로 계산해요.</>
                  )}
                  {lotShort && <div className="text-red-600 font-bold mt-0.5">생지 짠 수량이 오더 수량({num(total)}YD)보다 적어요.</div>}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-bold text-slate-500 mb-1">컬러별 수량 <span className="text-red-400">*</span> <span className="font-medium text-slate-400">— 컬러마다 따로 염색 (생지 {num(calc?.dye?.minKg ?? 100)}kg 미만이면 그 kg로 청구)</span></div>
                <div className="flex flex-wrap items-start gap-2">
                  {form.colorQtys.map((v, i) => {
                    const info = calc?.dye?.perColor?.[i];
                    return (
                      <div key={i} className="w-[104px]">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                          <span>컬러 {i + 1}</span>
                          {form.colorQtys.length > 1 && (
                            <button type="button" onClick={() => removeColor(i)} title="이 컬러 칸 지우기" className="text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                          )}
                        </div>
                        <div className="relative">
                          <input type="number" min="1" step="1" value={v} onChange={e => setColor(i, e.target.value)} placeholder="수량"
                            className={`w-full border rounded-lg pl-2 pr-7 py-1.5 text-right text-sm font-mono font-bold outline-none focus:ring-2 ring-teal-200 ${badColors[i] && showErrors ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-300 text-slate-800'}`} />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">YD</span>
                        </div>
                        {info && (
                          <div className={`text-[10px] mt-0.5 leading-tight ${info.minApplied ? 'text-rose-600 font-bold' : 'text-slate-400'}`}
                            title={info.minApplied ? '염색 최소 청구 — 이 컬러는 생지가 최소 kg보다 적어서 최소 kg 값을 내요' : ''}>
                            생지 {num(info.kg)}kg{info.minApplied ? ` → ${num(calc.dye.minKg)}kg 청구` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={addColor}
                    className="mt-[15px] h-[34px] px-2.5 rounded-lg border border-dashed border-teal-300 text-teal-700 text-xs font-bold hover:bg-teal-50 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> 컬러
                  </button>
                </div>
                <div className="text-[11px] text-slate-600 mt-1.5">
                  합계 <b className="font-mono text-slate-800">{num(total)}YD · {colorNums.length}컬러</b>
                  <span className="text-slate-400"> — 별도 견적 줄의 수량·컬러가 돼요</span>
                </div>
              </div>
            </section>

            {/* ③ 원가 — YD당 실비 */}
            <section className={sectionCls}>
              <h3 className="text-sm font-extrabold text-slate-700 mb-2">③ 원가 <span className="font-medium text-slate-400 text-xs">— YD당 실비 ({isUsd ? '수출 $' : '내수 ₩'})</span></h3>
              {!mode ? (
                <p className="text-xs text-slate-400 py-3 text-center">원단·생지 짠 수량·컬러별 수량을 넣으면 계산돼요.</p>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 text-xs">
                    {breakdown.map((b, i) => (
                      <div key={`${b.label}_${i}`} className={`flex items-baseline gap-3 py-1.5 ${b.excluded ? 'opacity-50' : ''}`}>
                        <span className="w-20 shrink-0 font-bold text-slate-600">{b.label}</span>
                        <span className="flex-1 text-[10px] text-slate-400 leading-snug">{b.note}{b.excluded ? ' · 별도 견적 전체에서 제외' : ''}</span>
                        <span className={`w-24 shrink-0 text-right font-mono font-bold text-slate-800 ${b.excluded ? 'line-through' : ''}`}>{fmt(b.amt)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t-2 border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-600">순원가</span>
                      <span className="font-mono font-bold text-slate-800">{fmt(smartRound(rawAfterExclude, currency))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-extrabold text-teal-800">기준원가 <span className="font-medium text-[10px] text-slate-400">(위험마진 {num(row?.riskPct)}% 포함 — 별도 견적 줄의 원가)</span></span>
                      <span className="font-mono font-extrabold text-teal-800 text-sm">{formatQuotePrice(row?.basePrice ?? null, currency)}</span>
                    </div>
                  </div>

                  {/* 비교 · 소량 추가분 */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
                      <div className="font-extrabold text-slate-600">기준원가 비교</div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">생지 {num(calc.running?.greigeQty)}YD를 한 번에 오더할 때 <span className="text-slate-400">(컬러마다 MCQ)</span></span>
                        <span className="font-mono font-bold text-slate-700 shrink-0">{formatQuotePrice(pv.lotBase, currency)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-bold text-teal-800">이 오더 — 러닝 생지</span>
                        <span className="font-mono font-extrabold text-teal-800 shrink-0">{formatQuotePrice(row?.basePrice ?? null, currency)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">이 오더를 새로 짤 때 <span className="text-slate-400">(일반 별도 견적 · 고르게 나눔)</span></span>
                        <span className="font-mono font-bold text-slate-700 shrink-0">{formatQuotePrice(pv.freshBase, currency)}</span>
                      </div>
                    </div>
                    <div className="bg-rose-50/60 border border-rose-200 rounded-lg px-3 py-2 space-y-1">
                      <div className="font-extrabold text-rose-800">소량 추가분 <span className="font-medium text-rose-600/70">— 생지 {num(calc.running?.greigeQty)}YD 원가 대비 · 실비 · 오더 총액</span></div>
                      {(pv.extras || []).map(e => (
                        <div key={e.key} className="flex justify-between gap-2">
                          <span className="text-slate-600">{e.label}</span>
                          <span className="font-mono font-bold text-slate-700">{fmtSigned(e.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 border-t border-rose-200 pt-1">
                        <span className="font-bold text-rose-800">합계 <span className="font-medium text-rose-600/70">(YD당 {fmtSigned(calc.qty > 0 ? extrasTotal / calc.qty : 0)})</span></span>
                        <span className="font-mono font-extrabold text-rose-800">{fmtSigned(extrasTotal)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ④ 판매가 — 일반 별도 견적 줄과 같은 이익율·정액 */}
            <section className={sectionCls}>
              <h3 className="text-sm font-extrabold text-slate-700 mb-2">④ 판매가 <span className="font-medium text-slate-400 text-xs">— 기준원가 ÷ (1 − 이익율) + YD당 정액 (일반 별도 견적 줄과 같음)</span></h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">이익율 (%)</label>
                  <input type="number" step="any" value={form.marginRate} onChange={e => setField('marginRate', e.target.value)} placeholder={String(rateDefault)}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-right text-sm font-bold text-indigo-700 outline-none focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal" />
                  <p className="text-[10px] text-slate-400 mt-0.5">비우면 {num(qtyForRate)}YD 구간 {rateDefault}%</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">YD당 정액 ({addSym})</label>
                  <input type="number" step="any" value={form.marginAdd} onChange={e => setField('marginAdd', e.target.value)} placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-right text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 placeholder:text-slate-400 placeholder:font-normal" />
                  <p className="text-[10px] text-slate-400 mt-0.5">{addUsd || '비우면 0'}</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500">판가 / YD</div>
                  <div className="font-mono text-xl font-extrabold text-teal-800">{formatQuotePrice(price, currency)}</div>
                  <div className="text-[10px] text-slate-400">원가 {formatQuotePrice(row?.basePrice ?? null, currency)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500">총액 ({num(qtyForRate)}YD)</div>
                  <div className="font-mono text-base font-bold text-slate-700">{totalAmount === null ? '—' : fmt(totalAmount)}</div>
                  <div className="text-[10px] text-slate-400">화면에서만 보여요</div>
                </div>
              </div>
            </section>
          </div>

          {/* 아래 버튼줄 */}
          <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 rounded-b-2xl px-4 md:px-5 py-3">
            {showErrors && problems.length > 0 && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-red-700">
                <div className="text-[11px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 아래를 채워야 넣을 수 있어요</div>
                <ul className="text-[11px] pl-5 list-disc">
                  {problems.map(p => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {isEdit && targetIsRunning && (
                <button type="button" onClick={handleRelease}
                  title="러닝 생지 조건을 빼고 일반 별도 견적 줄로 (수량·컬러수 그대로, 컬러별로 고르게 나눈 기준)"
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                  <RotateCcw className="w-3.5 h-3.5" /> 러닝 생지 해제
                </button>
              )}
              <p className="text-[10px] text-slate-400 leading-snug mr-auto max-w-sm">
                별도 견적서에는 수량 아래에 컬러별 수량이 적혀 나가요. '러닝 생지'라는 말은 나가지 않아요.
              </p>
              <button type="button" onClick={requestClose}
                className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                닫기
              </button>
              <button type="button" onClick={handleSave} disabled={fabricMissing}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saveLabel}
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={leavePending}
        message="러닝 생지 견적에 넣지 않은 변경사항이 있어요. 별도 견적에 넣고 나갈까요?"
        onSave={saveAndClose}
        onDiscard={onClose}
        onKeepEditing={() => setLeavePending(false)}
      />
    </>
  );
};
