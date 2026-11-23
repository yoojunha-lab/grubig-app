import React, { useRef, useState } from 'react';
import { X, Save, Trash2, Plus, Factory, Loader2, Info } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import {
  makeBlankFactory, makeBlankContact, normalizeFactory, regionFromAddresses, factoryTotals, fmtNum,
} from '../../utils/knitFactoryModel';

// ============================================================
// 편직처 정보 수정 창 (편직처 기계 현황 — 대표님 요청 2026-11-23, 2차 · 2026-11-24 기계는 상세 화면으로)
//  · 기본 정보 · 담당자 여러 명 · 주소 여러 개(첫 번째 = 대표 주소 → 지도) · 편직료
//  · 기계 · 보유 가마는 여기서 안 고침 — 편직처 화면 [기계 수정](KnitEquipmentEditor)에서 바로 (대표님 2026-11-24 '그게 간단')
//    (저장할 때 기존 기계 · 가마는 저장된 문서 값 그대로 — fromForm 이 저장된 문서를 깔고 얹음)
//  · 메모 · [오늘 확인함] · 지금 가마 바꾸기는 상세 화면에서 바로 저장 — 여기엔 없음
//  · 저장 안 한 변경이 있으면 닫기 전에 '저장할까요?' (팝업 창 규약 — 새 편직처는 빈 양식 기준)
// ============================================================

// 너비 w-full이 기본 — 다른 너비를 줄 때는 !w-○○ 로 (그냥 w-○○는 w-full에 져서 안 먹음, 2026-11-24)
const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200';
const cellCls = 'w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 ring-violet-200 focus:border-violet-300';
const labelCls = 'block text-[11px] font-bold text-slate-500 mb-0.5';

const toForm = (doc) => {
  const f = normalizeFactory(doc || makeBlankFactory());
  return {
    name: f.name, region: f.region, phone: f.phone, fax: f.fax,
    contacts: f.contacts, addresses: f.addresses, knitFee: f.knitFee,
  };
};
const fromForm = (form, savedDoc) => ({ ...(savedDoc || {}), ...form });

export const KnitFactoryEditModal = ({
  factoryId = null,       // 고치는 편직처 id (새로면 null)
  knitFactories = [],
  config,                 // 기계 종류 · 계열 설정
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

  const patch = (fields) => setForm(prev => ({ ...prev, ...fields }));
  const patchRow = (key, id, fields) => setForm(prev => ({ ...prev, [key]: prev[key].map(x => (x.id === id ? { ...x, ...fields } : x)) }));

  // ── 담당자 · 주소 ──
  const addContact = () => patch({ contacts: [...form.contacts, makeBlankContact()] });
  const removeContact = (id) => patch({ contacts: form.contacts.length > 1 ? form.contacts.filter(c => c.id !== id) : [makeBlankContact()] });
  const setAddress = (i, v) => patch({ addresses: form.addresses.map((a, j) => (j === i ? v : a)) });
  const addAddress = () => patch({ addresses: [...form.addresses, ''] });
  const removeAddress = (i) => patch({ addresses: form.addresses.length > 1 ? form.addresses.filter((_, j) => j !== i) : [''] });
  const autoRegion = regionFromAddresses(form.addresses);

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
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          {/* 머리 */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Factory className="w-5 h-5 text-violet-600 shrink-0" />
                <span className="truncate">{savedDoc ? `정보 수정 — ${savedDoc.name}` : '편직처 추가'}</span>
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

            <p className="text-[11px] text-slate-500 flex items-start gap-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" /> 기계 · 보유 가마는 편직처 화면의 <b className="mx-0.5">[기계 수정]</b>에서 바로 고쳐요{savedDoc ? '' : ' — 먼저 이 정보를 저장하면 편직처 화면이 열려요'}.
            </p>
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
