import React, { useMemo, useRef, useState } from 'react';
import { X, Save, Trash2, Plus, Copy, Factory, Loader2, Info } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import {
  KNIT_CATEGORIES, KNIT_MAKERS, makeBlankFactory, makeBlankMachine, makeBlankContact, normalizeFactory,
  gaugeInputText, parseGaugeInput, estimateNeedles, regionFromAddresses, factoryTotals, categoryTone, fmtNum,
} from '../../utils/knitFactoryModel';
import { CategoryChip } from './KnitParts';

// ============================================================
// 편직처 입력 창 (편직처 기계 현황 — 대표님 요청 2026-11-23)
//  · 기본 정보(이름·지역·전화·팩스) · 담당자 여러 명 · 주소 여러 개 · 편직료(여러 줄 글자)
//  · 기계 줄 — 종류(싱글·더블·자카드·기타)마다 [+ 줄 추가] · 줄 복사 · 지우기
//    칸: 세부 종류 · 대수 · 인치 · 피더 · 침수 · 게이지(가마 — '28, 30, 32'처럼 여러 개) · 가마수 · 제조사 · 메모
//  · 기계 줄을 고쳐 저장하면 확인일이 오늘로 (useKnitFactory.saveFactory)
//  · 메모 · [오늘 확인함]은 창 밖(편직처 보기)에서 바로 저장 — 여기엔 없음
//  · 저장 안 한 변경이 있으면 닫기 전에 '저장할까요?' (팝업 창 규약 — 새 편직처는 빈 양식 기준)
// ============================================================

const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200';
const cellCls = 'w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 ring-violet-200 focus:border-violet-300';
const labelCls = 'block text-[11px] font-bold text-slate-500 mb-0.5';
const toText = (v) => (v === null || v === undefined ? '' : String(v));

// 저장된 기계 줄 → 입력 칸 (숫자도 글자로 — 치는 도중 값이 바뀌지 않게)
const toFormMachine = (m) => ({
  id: m.id, category: m.category, group: toText(m.group), count: toText(m.count), inch: toText(m.inch), feeder: toText(m.feeder),
  needles: toText(m.needles), cylinders: toText(m.cylinders), gaugeText: gaugeInputText(m.gauges), maker: toText(m.maker), note: toText(m.note),
});
const toForm = (doc) => {
  const f = normalizeFactory(doc || makeBlankFactory());
  return {
    name: f.name, region: f.region, phone: f.phone, fax: f.fax,
    contacts: f.contacts, addresses: f.addresses, knitFee: f.knitFee,
    machines: f.machines.map(toFormMachine),
  };
};
// 입력 칸 → 저장 모양 (게이지 글자 → 숫자 목록)
const fromForm = (form, savedDoc) => ({
  ...(savedDoc || {}),
  ...form,
  machines: form.machines.map(({ gaugeText, ...m }) => ({ ...m, gauges: parseGaugeInput(gaugeText) })),
});

export const KnitFactoryEditModal = ({
  factoryId = null,       // 고치는 편직처 id (새로면 null)
  knitFactories = [],
  onSave,                 // (input, id) => 저장한 문서 | null
  onDelete,               // (id) => 지웠으면 true
  onSaved,                // (저장한 문서) => 저장 뒤 (그 편직처 보기)
  onClose,
}) => {
  const savedDoc = factoryId ? knitFactories.find(f => f.id === factoryId) || null : null;
  const [baseline] = useState(() => toForm(savedDoc));
  const [form, setForm] = useState(baseline);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { isDirty } = useUnsavedGuard(form, true, { initial: baseline });
  const listId = useMemo(() => `knit_${Math.random().toString(36).slice(2, 7)}`, []);

  const patch = (fields) => setForm(prev => ({ ...prev, ...fields }));
  const patchList = (key, id, fields) => setForm(prev => ({ ...prev, [key]: prev[key].map(x => (x.id === id ? { ...x, ...fields } : x)) }));

  // ── 담당자 · 주소 ──
  const addContact = () => patch({ contacts: [...form.contacts, makeBlankContact()] });
  const removeContact = (id) => patch({ contacts: form.contacts.length > 1 ? form.contacts.filter(c => c.id !== id) : [makeBlankContact()] });
  const setAddress = (i, v) => patch({ addresses: form.addresses.map((a, j) => (j === i ? v : a)) });
  const addAddress = () => patch({ addresses: [...form.addresses, ''] });
  const removeAddress = (i) => patch({ addresses: form.addresses.length > 1 ? form.addresses.filter((_, j) => j !== i) : [''] });
  const autoRegion = regionFromAddresses(form.addresses);

  // ── 기계 줄 ──
  const groupsByCategory = useMemo(() => {
    const map = {};
    form.machines.forEach(m => { if (m.group.trim()) (map[m.category] ||= new Set()).add(m.group.trim()); });
    return map;
  }, [form.machines]);
  const makerList = useMemo(() => [...new Set([
    ...KNIT_MAKERS.map(m => m.name),
    ...knitFactories.flatMap(f => (f.machines || []).map(m => String(m.maker || '').trim())),
  ].filter(Boolean))], [knitFactories]);

  // 그 종류 마지막 줄 다음에 넣기 (세부 종류·인치·제조사는 위 줄에서 이어받음)
  const addMachine = (category) => setForm(prev => {
    const idxs = prev.machines.map((m, i) => (m.category === category ? i : -1)).filter(i => i >= 0);
    const last = idxs.length ? prev.machines[idxs[idxs.length - 1]] : null;
    const row = { ...toFormMachine(makeBlankMachine(category, last?.group || '')), inch: last?.inch || '', maker: last?.maker || '', feeder: last?.feeder || '' };
    const at = idxs.length ? idxs[idxs.length - 1] + 1 : prev.machines.length;
    const machines = [...prev.machines];
    machines.splice(at, 0, row);
    return { ...prev, machines };
  });
  const duplicateMachine = (id) => setForm(prev => {
    const i = prev.machines.findIndex(m => m.id === id);
    if (i < 0) return prev;
    const copy = { ...prev.machines[i], id: makeBlankMachine().id };
    const machines = [...prev.machines];
    machines.splice(i + 1, 0, copy);
    return { ...prev, machines };
  });
  const removeMachine = (id) => setForm(prev => ({ ...prev, machines: prev.machines.filter(m => m.id !== id) }));

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
  const totals = factoryTotals(fromForm(form));

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
                기계 {totals.total ? `${fmtNum(totals.total)}대` : '대수 미기재'} · {totals.lines}줄
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
              {/* 담당자 */}
              <div>
                <label className={labelCls}>담당자 · 핸드폰</label>
                <div className="space-y-1.5">
                  {form.contacts.map(c => (
                    <div key={c.id} className="flex gap-1.5">
                      <input value={c.name} onChange={e => patchList('contacts', c.id, { name: e.target.value })} placeholder="이름 · 직함 (예: 최기숙 실장)" className={`${inputCls} flex-1`} />
                      <input value={c.mobile} onChange={e => patchList('contacts', c.id, { mobile: e.target.value })} placeholder="010-0000-0000" className={`${inputCls} w-40 font-mono`} />
                      <button type="button" onClick={() => removeContact(c.id)} title="이 담당자 빼기" className="px-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addContact} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 담당자 추가</button>
                </div>
              </div>
              {/* 주소 · 지역 */}
              <div>
                <label className={labelCls}>주소 <span className="font-medium text-slate-400">(첫 번째가 대표 주소)</span></label>
                <div className="space-y-1.5">
                  {form.addresses.map((a, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={a} onChange={e => setAddress(i, e.target.value)} placeholder="경기도 포천시 …" className={`${inputCls} flex-1`} />
                      <button type="button" onClick={() => removeAddress(i)} title="이 주소 빼기" className="px-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={addAddress} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 주소 추가</button>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      지역
                      <input value={form.region} onChange={e => patch({ region: e.target.value })} placeholder={autoRegion ? `${autoRegion} (주소에서 자동)` : '예: 포천'} className={`${cellCls} w-36 !text-sm`} />
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

            {/* 기계 */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-slate-800">기계 현황</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> 게이지 칸에 그 인치에 낄 수 있는 가마(게이지)를 '28, 30, 32'처럼 여러 개 적을 수 있어요. 침수를 비워 두면 게이지 × 3.14 × 인치로 보여 줘요.
                </p>
              </div>
              {KNIT_CATEGORIES.map(cat => {
                const rows = form.machines.filter(m => m.category === cat.key);
                return (
                  <div key={cat.key} className={`border rounded-xl ${rows.length ? 'border-slate-200' : 'border-dashed border-slate-200'}`}>
                    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-t-xl ${rows.length ? 'bg-slate-50 border-b border-slate-200' : ''}`}>
                      <span className="inline-flex items-center gap-2">
                        <CategoryChip category={cat.key} />
                        <span className="text-[11px] text-slate-500">{rows.length ? `${rows.length}줄` : '줄 없음'}{cat.hint ? ` · ${cat.hint}` : ''}</span>
                      </span>
                      <button type="button" onClick={() => addMachine(cat.key)}
                        className={`text-xs font-bold px-2 py-1 rounded-lg border inline-flex items-center gap-1 hover:brightness-95 ${categoryTone(cat.key)}`}>
                        <Plus className="w-3.5 h-3.5" /> 줄 추가
                      </button>
                    </div>
                    {rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[1040px]">
                          <thead>
                            <tr className="text-[10px] text-slate-500 text-left">
                              <th className="font-bold px-1.5 pt-1.5 w-36">세부 종류</th>
                              <th className="font-bold px-1.5 pt-1.5 w-14">대수</th>
                              <th className="font-bold px-1.5 pt-1.5 w-14">인치</th>
                              <th className="font-bold px-1.5 pt-1.5 w-20">피더</th>
                              <th className="font-bold px-1.5 pt-1.5 w-20">침수</th>
                              <th className="font-bold px-1.5 pt-1.5 w-32">게이지 (가마)</th>
                              <th className="font-bold px-1.5 pt-1.5 w-14">가마수</th>
                              <th className="font-bold px-1.5 pt-1.5 w-24">제조사</th>
                              <th className="font-bold px-1.5 pt-1.5">메모</th>
                              <th className="w-14" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(m => {
                              const gauges = parseGaugeInput(m.gaugeText);
                              const est = gauges.length === 1 ? estimateNeedles(gauges[0], Number(m.inch)) : null;
                              const set = (fields) => patchList('machines', m.id, fields);
                              return (
                                <tr key={m.id}>
                                  <td className="px-1.5 py-1"><input value={m.group} onChange={e => set({ group: e.target.value })} list={`${listId}_g_${cat.key}`} className={cellCls} /></td>
                                  <td className="px-1.5 py-1"><input value={m.count} onChange={e => set({ count: e.target.value })} inputMode="numeric" className={`${cellCls} font-mono text-right`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.inch} onChange={e => set({ inch: e.target.value })} inputMode="decimal" className={`${cellCls} font-mono text-right`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.feeder} onChange={e => set({ feeder: e.target.value })} className={`${cellCls} font-mono`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.needles} onChange={e => set({ needles: e.target.value })} inputMode="numeric" placeholder={est ? `≈${est}` : ''} className={`${cellCls} font-mono text-right`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.gaugeText} onChange={e => set({ gaugeText: e.target.value })} placeholder="28, 30" className={`${cellCls} font-mono`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.cylinders} onChange={e => set({ cylinders: e.target.value })} inputMode="numeric" className={`${cellCls} font-mono text-right`} /></td>
                                  <td className="px-1.5 py-1"><input value={m.maker} onChange={e => set({ maker: e.target.value })} list={`${listId}_maker`} className={cellCls} /></td>
                                  <td className="px-1.5 py-1"><input value={m.note} onChange={e => set({ note: e.target.value })} className={cellCls} /></td>
                                  <td className="px-1 py-1 whitespace-nowrap text-right">
                                    <button type="button" onClick={() => duplicateMachine(m.id)} title="이 줄 복사 (바로 아래에)" className="p-1 text-slate-400 hover:text-violet-600"><Copy className="w-3.5 h-3.5" /></button>
                                    <button type="button" onClick={() => removeMachine(m.id)} title="이 줄 지우기" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <datalist id={`${listId}_g_${cat.key}`}>
                          {[...(groupsByCategory[cat.key] || [])].map(g => <option key={g} value={g} />)}
                        </datalist>
                      </div>
                    )}
                  </div>
                );
              })}
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
              <span className="hidden md:inline text-[11px] text-slate-400">기계 줄을 고쳐 저장하면 확인일이 오늘로 바뀌어요</span>
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
