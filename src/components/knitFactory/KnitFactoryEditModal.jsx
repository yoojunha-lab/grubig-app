import React, { useMemo, useRef, useState } from 'react';
import { X, Save, Trash2, Plus, Copy, Factory, Loader2, Info, Layers } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import {
  KNIT_MAKERS, SPANDEX_OPTIONS, makeBlankFactory, makeBlankMachine, makeBlankCylinder, makeBlankContact, normalizeFactory,
  estimateNeedles, regionFromAddresses, factoryTotals, fmtNum, isKnownType, UNGROUPED_FAMILY,
} from '../../utils/knitFactoryModel';

// ============================================================
// 편직처 입력 창 (편직처 기계 현황 — 대표님 요청 2026-11-23, 2차)
//  · 기본 정보 · 담당자 여러 명 · 주소 여러 개(첫 번째 = 대표 주소 → 지도) · 편직료
//  · 기계 줄: 종류(설정 목록) · 인치 · 대수 · 피더 · 지금 가마 · 침수 · 스판장치 · 제조사 · 메모
//  · 보유 가마 줄: 종류 · 인치 · 게이지 · 개수 · 침수 · 메모 — 같은 종류 · 같은 인치 기계끼리 돌려 씀
//    [가마 여러 개 한 번에]: 종류 · 인치 + '18, 22, 24, 28' → 게이지마다 한 줄
//  · 기계 · 가마를 고쳐 저장하면 확인일이 오늘로 (useKnitFactory.saveFactory)
//  · 메모 · [오늘 확인함] · 지금 가마 바꾸기는 상세 화면에서 바로 저장 — 여기엔 없음
//  · 저장 안 한 변경이 있으면 닫기 전에 '저장할까요?' (팝업 창 규약 — 새 편직처는 빈 양식 기준)
// ============================================================

// 너비 w-full이 기본 — 다른 너비를 줄 때는 !w-○○ 로 (그냥 w-○○는 w-full에 져서 안 먹음, 2026-11-24)
const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200';
const cellCls = 'w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 ring-violet-200 focus:border-violet-300';
const labelCls = 'block text-[11px] font-bold text-slate-500 mb-0.5';
const toText = (v) => (v === null || v === undefined ? '' : String(v));

// 저장된 줄 → 입력 칸 (숫자도 글자로 — 치는 도중 값이 바뀌지 않게)
const toFormMachine = (m) => ({
  id: m.id, type: toText(m.type), inch: toText(m.inch), count: toText(m.count), feeder: toText(m.feeder), gauge: toText(m.gauge),
  needles: toText(m.needles), spandex: m.spandex || '', maker: toText(m.maker), note: toText(m.note),
});
const toFormCylinder = (c) => ({
  id: c.id, type: toText(c.type), inch: toText(c.inch), gauge: toText(c.gauge), count: toText(c.count), needles: toText(c.needles), note: toText(c.note),
});
const toForm = (doc) => {
  const f = normalizeFactory(doc || makeBlankFactory());
  return {
    name: f.name, region: f.region, phone: f.phone, fax: f.fax,
    contacts: f.contacts, addresses: f.addresses, knitFee: f.knitFee,
    machines: f.machines.map(toFormMachine), cylinders: f.cylinders.map(toFormCylinder),
  };
};
const fromForm = (form, savedDoc) => ({ ...(savedDoc || {}), ...form });

// 종류 고르기 — 설정 목록을 계열로 묶어서, 설정에 없는 예전 값도 보이게
const TypeSelect = ({ value, config, onChange }) => {
  const families = config?.families || [];
  const known = isKnownType(config, value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={`${cellCls} ${!value ? 'border-red-300 bg-red-50/40' : ''}`}>
      <option value="">종류 고르기</option>
      {value && !known && <option value={value}>{value} (설정에 없음)</option>}
      {families.map(fam => {
        const types = (config?.types || []).filter(t => t.family === fam);
        if (!types.length) return null;
        return (
          <optgroup key={fam} label={fam === UNGROUPED_FAMILY ? '미분류' : `${fam} 계열`}>
            {types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
};

export const KnitFactoryEditModal = ({
  factoryId = null,       // 고치는 편직처 id (새로면 null)
  knitFactories = [],
  config,                 // 기계 종류 · 계열 설정
  onSave,                 // (input, id) => 저장한 문서 | null
  onDelete,               // (id) => 지웠으면 true
  onSaved,                // (저장한 문서) => 저장 뒤 (그 편직처 보기)
  onOpenTypeSettings,     // [⚙ 기계 종류] 설정 창 (이 창 위에)
  onClose,
}) => {
  const savedDoc = factoryId ? knitFactories.find(f => f.id === factoryId) || null : null;
  const [baseline] = useState(() => toForm(savedDoc));
  const [form, setForm] = useState(baseline);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState({ type: '', inch: '', gauges: '' }); // 가마 여러 개 한 번에
  const busyRef = useRef(false);
  const { isDirty } = useUnsavedGuard(form, true, { initial: baseline });
  const listId = useMemo(() => `knit_${Math.random().toString(36).slice(2, 7)}`, []);

  const patch = (fields) => setForm(prev => ({ ...prev, ...fields }));
  const patchRow = (key, id, fields) => setForm(prev => ({ ...prev, [key]: prev[key].map(x => (x.id === id ? { ...x, ...fields } : x)) }));
  const removeRow = (key, id) => setForm(prev => ({ ...prev, [key]: prev[key].filter(x => x.id !== id) }));
  const duplicateRow = (key, id, makeId) => setForm(prev => {
    const i = prev[key].findIndex(x => x.id === id);
    if (i < 0) return prev;
    const list = [...prev[key]];
    list.splice(i + 1, 0, { ...prev[key][i], id: makeId() });
    return { ...prev, [key]: list };
  });

  // ── 담당자 · 주소 ──
  const addContact = () => patch({ contacts: [...form.contacts, makeBlankContact()] });
  const removeContact = (id) => patch({ contacts: form.contacts.length > 1 ? form.contacts.filter(c => c.id !== id) : [makeBlankContact()] });
  const setAddress = (i, v) => patch({ addresses: form.addresses.map((a, j) => (j === i ? v : a)) });
  const addAddress = () => patch({ addresses: [...form.addresses, ''] });
  const removeAddress = (i) => patch({ addresses: form.addresses.length > 1 ? form.addresses.filter((_, j) => j !== i) : [''] });
  const autoRegion = regionFromAddresses(form.addresses);

  // ── 기계 · 가마 줄 ──
  const makerList = useMemo(() => [...new Set([
    ...KNIT_MAKERS,
    ...knitFactories.flatMap(f => (f.machines || []).map(m => String(m.maker || '').trim())),
  ].filter(Boolean))], [knitFactories]);
  const lastMachine = form.machines[form.machines.length - 1];
  const addMachine = () => patch({ machines: [...form.machines, { ...toFormMachine(makeBlankMachine(lastMachine?.type || '')), inch: lastMachine?.inch || '', spandex: lastMachine?.spandex || '', maker: lastMachine?.maker || '' }] });
  const lastCyl = form.cylinders[form.cylinders.length - 1];
  const addCylinder = () => patch({ cylinders: [...form.cylinders, { ...toFormCylinder(makeBlankCylinder(lastCyl?.type || lastMachine?.type || '')), inch: lastCyl?.inch || lastMachine?.inch || '' }] });
  const bulkGauges = [...new Set((bulk.gauges.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n <= 90))];
  const addBulk = () => {
    if (!bulk.type || !(Number(bulk.inch) > 0) || !bulkGauges.length) return;
    patch({ cylinders: [...form.cylinders, ...bulkGauges.map(g => ({ ...toFormCylinder(makeBlankCylinder(bulk.type, bulk.inch)), inch: bulk.inch, gauge: String(g) }))] });
    setBulk(prev => ({ ...prev, gauges: '' }));
  };
  // 기계 줄에 있는 종류 · 인치 (가마 묶음 알림)
  const machineKeys = new Set(form.machines.map(m => `${m.type}__${Number(m.inch) || ''}`));

  // ── 저장 · 닫기 ──
  const doSave = async () => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      return await onSave(fromForm(form, savedDoc), factoryId);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const guard = (action) => { if (isDirty()) setPending(() => action); else action(); };
  const requestClose = () => guard(onClose);
  const handleSave = async () => {
    const saved = await doSave();
    if (saved) { onSaved?.(saved); onClose(); }
  };
  const handleDelete = async () => { if (await onDelete(factoryId)) onClose(); };
  const saveAndLeave = async () => {
    const saved = await doSave();
    if (!saved) return;
    const act = pending;
    setPending(null);
    onSaved?.(saved);
    if (act) act();
  };

  const dirtyNow = JSON.stringify(form) !== JSON.stringify(baseline);
  const totals = factoryTotals(fromForm(form), config);

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          {/* 머리 */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Factory className="w-5 h-5 text-violet-600 shrink-0" />
                <span className="truncate">{savedDoc ? `편직처 수정 — ${savedDoc.name}` : '편직처 추가'}</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                기계 {totals.total ? `${fmtNum(totals.total)}대` : '대수 미기재'} · {totals.lines}줄 · 보유 가마 {totals.cylinders ? `${fmtNum(totals.cylinders)}개` : `${totals.cylinderLines}줄`}
                {dirtyNow && <span className="ml-2 font-bold text-amber-600">● 저장 안 한 변경 있음</span>}
              </p>
            </div>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600 shrink-0" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* 기본 정보 */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>편직처 이름 <span className="text-red-500">*</span> <span className="font-medium text-slate-400">(설계서 편직처 목록에도 이 이름으로 들어가요)</span></label>
                <input value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="예: 미건섬유" className={`${inputCls} font-bold`} autoFocus={!savedDoc} />
              </div>
              <div>
                <label className={labelCls}>전화</label>
                <input value={form.phone} onChange={e => patch({ phone: e.target.value })} placeholder="031-000-0000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>팩스</label>
                <input value={form.fax} onChange={e => patch({ fax: e.target.value })} className={inputCls} />
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>담당자 · 핸드폰</label>
                <div className="space-y-1.5">
                  {form.contacts.map(c => (
                    <div key={c.id} className="flex gap-1.5">
                      <input value={c.name} onChange={e => patchRow('contacts', c.id, { name: e.target.value })} placeholder="이름 · 직함 (예: 최기숙 실장)" className={`${inputCls} flex-1 min-w-0`} />
                      <input value={c.mobile} onChange={e => patchRow('contacts', c.id, { mobile: e.target.value })} placeholder="010-0000-0000" className={`${inputCls} !w-40 shrink-0 font-mono`} />
                      <button type="button" onClick={() => removeContact(c.id)} title="이 담당자 빼기" className="px-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addContact} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 담당자 추가</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>주소 <span className="font-medium text-slate-400">(첫 번째 = 대표 주소 — 지도에 이 주소로 표시)</span></label>
                <div className="space-y-1.5">
                  {form.addresses.map((a, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={a} onChange={e => setAddress(i, e.target.value)} placeholder="경기도 포천시 …" className={`${inputCls} flex-1 min-w-0`} />
                      <button type="button" onClick={() => removeAddress(i)} title="이 주소 빼기" className="px-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={addAddress} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 주소 추가</button>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      지역
                      <input value={form.region} onChange={e => patch({ region: e.target.value })} placeholder={autoRegion ? `${autoRegion} (주소에서 자동)` : '예: 포천'} className={`${cellCls} !w-36 shrink-0 !text-sm`} />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <label className={labelCls}>편직료 <span className="font-medium text-slate-400">(여러 줄 — 예: 싱글 28G: 1,500/kg · 시직비 5,000/kg)</span></label>
              <textarea value={form.knitFee} onChange={e => patch({ knitFee: e.target.value })} rows={Math.min(6, Math.max(2, form.knitFee.split('\n').length))}
                className={`${inputCls} resize-y`} />
            </section>

            {/* 기계 줄 */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-slate-800">기계 <span className="text-xs font-medium text-slate-400">— 같은 종류 · 인치라도 지금 가마나 피더가 다르면 줄을 나눠요</span></h4>
                <div className="flex gap-1.5">
                  {onOpenTypeSettings && (
                    <button type="button" onClick={onOpenTypeSettings} className="text-xs font-bold text-slate-600 border border-slate-300 rounded-lg px-2 py-1 hover:bg-slate-50 inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> 기계 종류 목록
                    </button>
                  )}
                  <button type="button" onClick={addMachine} className="text-xs font-bold text-violet-700 border border-violet-200 bg-violet-50 rounded-lg px-2 py-1 hover:bg-violet-100 inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> 기계 줄 추가
                  </button>
                </div>
              </div>
              {form.machines.length === 0 ? (
                <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl py-4 text-center">기계 줄이 없어요. [기계 줄 추가]</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs min-w-[1080px]">
                    <thead>
                      <tr className="text-[10px] text-slate-500 text-left bg-slate-50">
                        <th className="font-bold px-1.5 py-1.5 w-36">종류</th>
                        <th className="font-bold px-1.5 py-1.5 w-14">인치</th>
                        <th className="font-bold px-1.5 py-1.5 w-14">대수</th>
                        <th className="font-bold px-1.5 py-1.5 w-20">피더</th>
                        <th className="font-bold px-1.5 py-1.5 w-16">지금 가마</th>
                        <th className="font-bold px-1.5 py-1.5 w-20">침수</th>
                        <th className="font-bold px-1.5 py-1.5 w-20">스판장치</th>
                        <th className="font-bold px-1.5 py-1.5 w-24">제조사</th>
                        <th className="font-bold px-1.5 py-1.5">메모</th>
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.machines.map(m => {
                        const est = estimateNeedles(m.gauge, m.inch);
                        const set = (fields) => patchRow('machines', m.id, fields);
                        return (
                          <tr key={m.id} className="border-t border-slate-100">
                            <td className="px-1.5 py-1"><TypeSelect value={m.type} config={config} onChange={v => set({ type: v })} /></td>
                            <td className="px-1.5 py-1"><input value={m.inch} onChange={e => set({ inch: e.target.value })} inputMode="decimal" className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={m.count} onChange={e => set({ count: e.target.value })} inputMode="numeric" className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={m.feeder} onChange={e => set({ feeder: e.target.value })} className={`${cellCls} font-mono`} /></td>
                            <td className="px-1.5 py-1"><input value={m.gauge} onChange={e => set({ gauge: e.target.value })} inputMode="decimal" placeholder="G" className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={m.needles} onChange={e => set({ needles: e.target.value })} inputMode="numeric" placeholder={est ? `≈${est}` : ''} className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1">
                              <select value={m.spandex} onChange={e => set({ spandex: e.target.value })} className={cellCls}>
                                {SPANDEX_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-1.5 py-1"><input value={m.maker} onChange={e => set({ maker: e.target.value })} list={`${listId}_maker`} className={cellCls} /></td>
                            <td className="px-1.5 py-1"><input value={m.note} onChange={e => set({ note: e.target.value })} className={cellCls} /></td>
                            <td className="px-1 py-1 whitespace-nowrap text-right">
                              <button type="button" onClick={() => duplicateRow('machines', m.id, () => makeBlankMachine().id)} title="이 줄 복사 (바로 아래에)" className="p-1 text-slate-400 hover:text-violet-600"><Copy className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => removeRow('machines', m.id)} title="이 줄 지우기" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 보유 가마 */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-slate-800">보유 가마 <span className="text-xs font-medium text-slate-400">— 같은 종류 · 같은 인치 기계에 갈아 끼워 쓰는 가마 (개수 = 꼽힌 것 포함)</span></h4>
                <button type="button" onClick={addCylinder} className="text-xs font-bold text-sky-700 border border-sky-200 bg-sky-50 rounded-lg px-2 py-1 hover:bg-sky-100 inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 가마 줄 추가
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-1.5 bg-sky-50/50 border border-sky-100 rounded-xl px-2.5 py-2">
                <span className="text-[11px] font-bold text-sky-800 mr-1 self-center">가마 여러 개 한 번에</span>
                <label className="block w-36"><span className="block text-[10px] text-slate-500">종류</span><TypeSelect value={bulk.type} config={config} onChange={v => setBulk(p => ({ ...p, type: v }))} /></label>
                <label className="block w-16"><span className="block text-[10px] text-slate-500">인치</span><input value={bulk.inch} onChange={e => setBulk(p => ({ ...p, inch: e.target.value }))} inputMode="decimal" className={`${cellCls} font-mono`} /></label>
                <label className="block flex-1 min-w-[160px]"><span className="block text-[10px] text-slate-500">게이지들</span>
                  <input value={bulk.gauges} onChange={e => setBulk(p => ({ ...p, gauges: e.target.value }))} placeholder="18, 22, 24, 28" onKeyDown={e => { if (e.key === 'Enter') addBulk(); }} className={`${cellCls} font-mono`} />
                </label>
                <button type="button" onClick={addBulk} disabled={!bulk.type || !(Number(bulk.inch) > 0) || !bulkGauges.length}
                  className="text-xs font-bold text-white bg-sky-600 rounded px-2.5 py-1 hover:bg-sky-700 disabled:opacity-40">
                  {bulkGauges.length ? `${bulkGauges.length}줄 넣기` : '넣기'}
                </button>
              </div>
              {form.cylinders.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead>
                      <tr className="text-[10px] text-slate-500 text-left bg-slate-50">
                        <th className="font-bold px-1.5 py-1.5 w-36">종류</th>
                        <th className="font-bold px-1.5 py-1.5 w-14">인치</th>
                        <th className="font-bold px-1.5 py-1.5 w-16">게이지</th>
                        <th className="font-bold px-1.5 py-1.5 w-14">개수</th>
                        <th className="font-bold px-1.5 py-1.5 w-20">침수</th>
                        <th className="font-bold px-1.5 py-1.5">메모</th>
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.cylinders.map(c => {
                        const est = estimateNeedles(c.gauge, c.inch);
                        const set = (fields) => patchRow('cylinders', c.id, fields);
                        const orphan = c.type && Number(c.inch) > 0 && !machineKeys.has(`${c.type}__${Number(c.inch)}`);
                        return (
                          <tr key={c.id} className="border-t border-slate-100">
                            <td className="px-1.5 py-1"><TypeSelect value={c.type} config={config} onChange={v => set({ type: v })} /></td>
                            <td className="px-1.5 py-1"><input value={c.inch} onChange={e => set({ inch: e.target.value })} inputMode="decimal" className={`${cellCls} font-mono text-right ${orphan ? 'border-amber-300 bg-amber-50' : ''}`} title={orphan ? '이 종류 · 인치 기계 줄이 없어요' : ''} /></td>
                            <td className="px-1.5 py-1"><input value={c.gauge} onChange={e => set({ gauge: e.target.value })} inputMode="decimal" placeholder="G" className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={c.count} onChange={e => set({ count: e.target.value })} inputMode="numeric" className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={c.needles} onChange={e => set({ needles: e.target.value })} inputMode="numeric" placeholder={est ? `≈${est}` : ''} className={`${cellCls} font-mono text-right`} /></td>
                            <td className="px-1.5 py-1"><input value={c.note} onChange={e => set({ note: e.target.value })} placeholder={orphan ? '⚠ 이 종류 · 인치 기계 줄이 없어요' : ''} className={cellCls} /></td>
                            <td className="px-1 py-1 whitespace-nowrap text-right">
                              <button type="button" onClick={() => duplicateRow('cylinders', c.id, () => makeBlankCylinder().id)} title="이 줄 복사 (바로 아래에)" className="p-1 text-slate-400 hover:text-sky-600"><Copy className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => removeRow('cylinders', c.id)} title="이 줄 지우기" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-slate-500 flex items-start gap-1"><Info className="w-3.5 h-3.5 mt-px shrink-0" /> 침수를 비워 두면 게이지 × 3.14 × 인치로 보여 줘요 (회색 ≈). 가마가 없으면(게이지가 안 바뀌는 기계) 기계 줄의 '지금 가마'만 적어도 돼요.</p>
              <datalist id={`${listId}_maker`}>
                {makerList.map(m => <option key={m} value={m} />)}
              </datalist>
            </section>
          </div>

          {/* 아래 버튼 */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
            <div>
              {savedDoc && (
                <button type="button" onClick={handleDelete} className="text-sm font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg inline-flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> 삭제
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-[11px] text-slate-400">기계 · 가마를 고쳐 저장하면 확인일이 오늘로 바뀌어요</span>
              <button type="button" onClick={requestClose} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">취소</button>
              <button type="button" onClick={handleSave} disabled={busy}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={!!pending}
        message="편직처에 저장하지 않은 변경사항이 있어요. 저장할까요?"
        onSave={saveAndLeave}
        onDiscard={() => { const act = pending; setPending(null); if (act) act(); }}
        onKeepEditing={() => setPending(null)}
      />
    </>
  );
};
