import React, { useMemo, useRef, useState } from 'react';
import { X, Save, Trash2, Download, Upload, AlertTriangle, ExternalLink, Tag, Loader2, Lock, Settings2 } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { SearchableSelect } from '../common/SearchableSelect';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { StickerPreview } from './StickerPreview';
import {
  makeBlankSticker, normalizeSticker, stickerFieldsFromFabric, stickerSpecOf, stickerArtDiffers, stickerCellValues,
  fabricYarnHint, normalizeQrInput, eztexQrNumber, normalizeCare, orderCare, STICKER_TYPE_SUGGESTIONS, STICKER_CARE_MAX_LINES,
} from '../../utils/hangerSticker';
import { readQrFromImage } from '../../utils/hangerStickerQr';
import { todayLocalISO } from '../../utils/helpers';

// 마지막 저장 날짜 — 이 PC 날짜로 (ISO 글자를 그냥 자르면 UTC라 오전 9시 전 저장은 전날로 보임)
const localDateOf = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? todayLocalISO(d) : '';
};

// ============================================================
// 헹거 스티커 입력 창 (기타 ▾ 헹거 스티커 — 대표님 요청 2026-10-14)
//  · 아이템(원단 관리) 필수 — 고르면 ART(고칠 수 있음) · WIDTH · WEIGHT(고칠 수 없음, 지금 아이템 값)
//  · CATEGORY(가운데 큰 글자)는 고르기 · CARE는 체크(여러 개, 엑셀 칸에 한 줄에 하나씩) — 목록은 [⚙ 목록 고치기]
//  · 직접 넣는 칸: CONTENT · TYPE · QR · 아래 설명 — 오른쪽에 스티커 미리보기
//  · QR: EZ-TEX QR 그림을 올리면(파일·끌어 놓기·붙여 넣기) 안의 주소를 읽어서 넣음. 번호만 넣어도 됨
//  · 저장 안 한 변경이 있으면 닫기 전에 '저장할까요?' (팝업 창 규약 — 새 스티커는 빈 양식 기준)
// ============================================================

const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-amber-200';
const labelCls = 'block text-[11px] font-bold text-slate-500 mb-0.5';
const ItemBadge = () => <span className="ml-1 text-[9px] font-extrabold px-1 py-px rounded bg-blue-50 text-blue-600 border border-blue-200">아이템</span>;

// 아이템 값만 보이는 잠긴 칸 (WIDTH · WEIGHT)
const LockedField = ({ label, sub, value, placeholder }) => (
  <div>
    <label className={labelCls}>{label}<ItemBadge /> {sub && <span className="font-medium text-slate-400">{sub}</span>}</label>
    <div className={`w-full rounded-lg px-2.5 py-1.5 text-sm border flex items-center gap-1.5 ${value ? 'bg-slate-100 border-slate-200 text-slate-800 font-bold' : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'}`}
      title="아이템(원단 관리) 값 그대로 — 여기서는 고칠 수 없어요">
      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="truncate">{value || placeholder}</span>
    </div>
  </div>
);

export const StickerEditModal = ({
  stickerId = null,      // 고치는 스티커 id (새 스티커면 null)
  stickers = [],         // 저장된 스티커 전체 (같은 아이템 알림 · 입력 추천)
  savedFabrics = [],
  yarnLibrary = [],
  options,               // 설정 { categories, careItems } (resolveStickerOptions)
  onSave,                // (form, id) => 저장한 문서 | null
  onDelete,              // (id) => 지웠으면 true
  onDownload,            // (sticker) => 받았으면 true
  onOpenSticker,         // (id) => 다른 스티커 열기 (같은 아이템 스티커)
  onOpenSettings,        // CATEGORY · CARE 목록 고치기 (설정 창을 이 창 위에)
  onClose,
}) => {
  const savedDoc = stickerId ? stickers.find(s => s.id === stickerId) || null : null;
  const [baseline] = useState(() => (savedDoc ? normalizeSticker(savedDoc, options) : makeBlankSticker(options)));
  const [form, setForm] = useState(baseline);
  const [pending, setPending] = useState(null);   // '저장할까요?' 뒤에 할 일
  const [busy, setBusy] = useState(false);
  const [qrReading, setQrReading] = useState(false);
  const [qrNote, setQrNote] = useState(null);     // { type: 'ok' | 'warn' | 'error', text }
  const busyRef = useRef(false);
  const fileRef = useRef(null);
  const { isDirty } = useUnsavedGuard(form, true, { initial: baseline });

  const patch = (fields) => setForm(prev => ({ ...prev, ...fields }));

  // ── 아이템 (원단 관리 — App에서 이미 Article 순서로 정렬해 둔 목록) ──
  const fabricOptions = useMemo(() => (savedFabrics || [])
    .filter(f => String(f?.article || '').trim())
    .map(f => ({ id: String(f.id), name: `${f.article}${f.itemName ? ` · ${f.itemName}` : ''}` })), [savedFabrics]);
  const fabric = form.fabricId ? (savedFabrics || []).find(f => String(f.id) === String(form.fabricId)) || null : null;
  const spec = stickerSpecOf(form, fabric);
  const yarnHint = fabric ? fabricYarnHint(fabric, yarnLibrary) : '';
  const sameItem = form.fabricId
    ? stickers.filter(s => s.id !== stickerId && String(s.fabricId || '') === String(form.fabricId))
    : [];

  // 아이템을 고르면 ART · WIDTH · WEIGHT를 그 아이템 값으로 / 칸을 비우면 연결과 WIDTH·WEIGHT를 비움 (ART는 그대로)
  const applyFabric = (fabricId) => {
    const f = (savedFabrics || []).find(x => String(x.id) === String(fabricId)) || null;
    if (!f) { patch({ fabricId: '', width: '', weight: '' }); return; }
    patch(stickerFieldsFromFabric(f));
  };

  // ── CATEGORY · CARE (설정 목록) ──
  const categories = options?.categories || [];
  const careItems = options?.careItems || [];
  const pickedCare = normalizeCare(form.care);
  const careChoices = [...careItems, ...pickedCare.filter(c => !careItems.includes(c))]; // 설정에서 지운 예전 값도 보이게
  const toggleCare = (item) => patch({
    care: orderCare(pickedCare.includes(item) ? pickedCare.filter(c => c !== item) : [...pickedCare, item], careItems),
  });

  // ── 입력 추천 (TYPE — 저장된 스티커에 쓴 값 + 양식에 있던 값) ──
  const typeList = [...new Set([...STICKER_TYPE_SUGGESTIONS, ...stickers.map(s => String(s.type || '').trim())].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  // ── QR ──
  const qrNumber = eztexQrNumber(form.qr);
  const handleQrFile = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setQrNote({ type: 'error', text: '그림 파일(PNG·JPG)을 올려 주세요.' });
      return;
    }
    setQrReading(true);
    setQrNote(null);
    try {
      const text = await readQrFromImage(file);
      if (!text) {
        setQrNote({ type: 'error', text: '그림에서 QR을 찾지 못했어요. QR이 잘 보이는 그림을 올리거나 번호를 직접 넣어 주세요.' });
        return;
      }
      const qr = normalizeQrInput(text);
      patch({ qr });
      const no = eztexQrNumber(qr);
      setQrNote(no
        ? { type: 'ok', text: `QR을 읽었어요 — EZ-TEX ${no}번` }
        : { type: 'warn', text: 'QR을 읽었어요. EZ-TEX 주소가 아니에요 — 맞는 QR인지 확인해 주세요.' });
    } catch (e) {
      setQrNote({ type: 'error', text: e?.message || 'QR을 읽지 못했어요.' });
    } finally {
      setQrReading(false);
    }
  };
  const handleQrPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find(f => String(f.type || '').startsWith('image/'));
    if (!file) return; // 글자는 그대로 붙여 넣음
    e.preventDefault();
    handleQrFile(file);
  };

  // ── 저장 · 닫기 ──
  const doSave = async () => {
    if (busyRef.current) return null;
    // QR 그림을 읽는 중에 저장하면 QR이 빠진 채 저장됨 ('저장할까요?'의 [저장하고 나가기]도 여기를 지남)
    if (qrReading) {
      setQrNote({ type: 'warn', text: 'QR 그림을 읽는 중이에요. 끝나면 다시 저장해 주세요.' });
      return null;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      return await onSave({ ...form, qr: normalizeQrInput(form.qr) }, stickerId);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const guard = (action) => { if (isDirty()) setPending(() => action); else action(); };
  const requestClose = () => guard(onClose);
  const handleSave = async () => { if (await doSave()) onClose(); };
  // 저장하고 엑셀 받기 — 고친 게 없으면 저장된 스티커 그대로 받음
  //  받기를 그만뒀거나(예: 'QR 없음' 확인에서 취소) 못 받았으면 창을 닫지 않음
  //  → 방금 저장했으면 저장된 스티커로 다시 열어서 이어서 고치게 (새 스티커가 두 번 저장되지 않게)
  const handleSaveAndDownload = async () => {
    const needSave = isDirty() || !savedDoc;
    const target = needSave ? await doSave() : savedDoc;
    if (!target) return;
    if (await onDownload(target)) { onClose(); return; }
    if (needSave) onOpenSticker(target.id);
  };
  const handleDelete = async () => { if (await onDelete(stickerId)) onClose(); };
  const keepEditing = () => setPending(null);
  const leaveWithoutSave = () => { const act = pending; setPending(null); if (act) act(); };
  const saveAndLeave = async () => {
    const saved = await doSave();
    if (!saved) return; // 저장 못 하면 그대로 (입력값 보존)
    const act = pending;
    setPending(null);
    if (act) act();
  };

  // 화면 표시용 (머리 '● 저장 안 한 변경' · 엑셀 버튼 이름) — 닫을 때 묻는 건 useUnsavedGuard(isDirty)
  const dirtyNow = JSON.stringify(form) !== JSON.stringify(baseline);
  const specNote = !form.fabricId
    ? '아이템을 고르면 채워져요.'
    : !fabric
      ? '연결된 아이템을 원단 관리에서 찾을 수 없어서 마지막으로 저장한 값을 써요.'
      : (!spec.width || !spec.weight)
        ? `이 아이템에는 ${[!spec.width && '폭', !spec.weight && '중량(gsm)'].filter(Boolean).join('·')} 정보가 없어요 — 원단 관리에서 넣어 주세요.`
        : '아이템 값 그대로예요. 바꾸려면 원단 관리에서 고쳐 주세요 (스티커도 따라 바뀌어요).';

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          {/* 머리 */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="truncate">{savedDoc ? `헹거 스티커 — ${savedDoc.art || '이름 없음'}` : '헹거 스티커 만들기'}</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {savedDoc
                  ? `마지막 저장 ${localDateOf(savedDoc.updatedAt)}${savedDoc.updatedBy ? ` · ${savedDoc.updatedBy}` : ''}`
                  : '아이템을 고르면 ART · WIDTH · WEIGHT가 채워져요.'}
                {dirtyNow && <span className="ml-2 font-bold text-amber-600">● 저장 안 한 변경 있음</span>}
              </p>
            </div>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600 shrink-0" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          {/* 본문 — 왼쪽 입력 · 오른쪽 미리보기 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row gap-5 items-start">
              <div className="flex-1 min-w-0 w-full space-y-3">
                {/* 아이템 */}
                <section className={`border rounded-xl p-3 ${form.fabricId ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/60 border-amber-200'}`}>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    아이템 <span className="text-red-500">*</span> <span className="font-medium text-slate-400">(원단 관리 — 꼭 골라 주세요. 고르면 ART · WIDTH · WEIGHT)</span>
                  </label>
                  <SearchableSelect value={form.fabricId} options={fabricOptions} onChange={applyFabric} placeholder="Article·원단명으로 검색" />
                  {sameItem.length > 0 && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-[11px] text-blue-800 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>이 아이템 스티커가 이미 있어요:</span>
                      {sameItem.map(s => (
                        <button key={s.id} type="button" onClick={() => guard(() => onOpenSticker(s.id))}
                          className="font-bold underline underline-offset-2 hover:text-blue-950 flex items-center gap-0.5">
                          {s.art || '이름 없음'} 열기 <ExternalLink className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* 스티커 칸 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>ART.<ItemBadge /> <span className="font-medium text-slate-400">(고칠 수 있음)</span></label>
                    <input type="text" value={form.art} onChange={e => patch({ art: e.target.value.toUpperCase() })} placeholder="예: PW1001" className={`${inputCls} font-bold uppercase`} />
                    {stickerArtDiffers(form, fabric) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        아이템 Article은 <b>{String(fabric.article || '').toUpperCase()}</b>
                        <button type="button" onClick={() => patch({ art: String(fabric.article || '').trim().toUpperCase() })}
                          className="ml-1.5 font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2">아이템 Article로</button>
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <label className="text-[11px] font-bold text-slate-500">CATEGORY <span className="font-medium text-slate-400">(가운데 큰 글자)</span></label>
                      <button type="button" onClick={onOpenSettings} className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5">
                        <Settings2 className="w-3 h-3" /> 목록 고치기
                      </button>
                    </div>
                    <select value={form.title} onChange={e => patch({ title: e.target.value })} className={`${inputCls} font-bold`}>
                      {!form.title && <option value="">— 골라 주세요 —</option>}
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      {form.title && !categories.includes(form.title) && <option value={form.title}>{form.title} (설정에 없음)</option>}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>CONTENT <span className="font-medium text-slate-400">(혼용률)</span></label>
                    <input type="text" value={form.content} onChange={e => patch({ content: e.target.value })} placeholder="예: 87%Merino Wool(17.5mic) 13%Nylon" className={inputCls} />
                    {yarnHint && <p className="text-[10px] text-slate-400 mt-0.5">아이템 원사 (참고): {yarnHint}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>TYPE</label>
                    <input type="text" list="hs-type-list" value={form.type} onChange={e => patch({ type: e.target.value })} placeholder="예: SINGLE" className={inputCls} />
                  </div>
                  <LockedField label="WIDTH" sub="(내폭/외폭)" value={spec.width} placeholder={form.fabricId ? '아이템에 폭이 없어요' : '아이템을 고르면 채워져요'} />
                  <LockedField label="WEIGHT" sub="(gsm · 실제 G/YD)" value={spec.weight} placeholder={form.fabricId ? '아이템에 gsm이 없어요' : '아이템을 고르면 채워져요'} />
                  <p className={`sm:col-span-2 -mt-1.5 text-[10px] ${form.fabricId && fabric && spec.width && spec.weight ? 'text-slate-400' : 'text-amber-700 font-bold'}`}>{specNote}</p>
                </div>

                {/* CARE */}
                <section className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500">CARE <span className="font-medium text-slate-400">(체크한 것이 엑셀 칸에 한 줄에 하나씩 · {STICKER_CARE_MAX_LINES}개까지 들어가요)</span></label>
                    <button type="button" onClick={onOpenSettings} className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 shrink-0">
                      <Settings2 className="w-3 h-3" /> 목록 고치기
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {careChoices.map(item => {
                      const on = pickedCare.includes(item);
                      return (
                        <label key={item} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-colors ${on ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleCare(item)} className="w-3.5 h-3.5 accent-amber-600" />
                          {item}
                          {!careItems.includes(item) && <span className="text-[9px] font-medium text-slate-400">(설정에 없음)</span>}
                        </label>
                      );
                    })}
                  </div>
                  {pickedCare.length > STICKER_CARE_MAX_LINES && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> CARE 칸은 {STICKER_CARE_MAX_LINES}줄이라 {pickedCare.length}개를 고르면 엑셀에서 잘릴 수 있어요.
                    </p>
                  )}
                </section>

                {/* QR */}
                <section
                  className="border border-dashed border-slate-300 rounded-xl p-3 bg-white"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleQrFile(e.dataTransfer?.files?.[0]); }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500">QR <span className="font-medium text-slate-400">(EZ-TEX QR 그림을 올리면 주소를 읽어요 · 끌어 놓기·붙여 넣기도 돼요)</span></label>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={qrReading}
                      className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 flex items-center gap-1 disabled:opacity-50">
                      {qrReading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} QR 그림 올리기
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleQrFile(f); }} />
                  </div>
                  <input type="text" value={form.qr} onChange={e => patch({ qr: e.target.value })} onBlur={() => patch({ qr: normalizeQrInput(form.qr) })}
                    onPaste={handleQrPaste} placeholder="QR 주소 또는 EZ-TEX 번호 (예: 5542)" className={`${inputCls} font-mono text-xs`} />
                  <p className={`text-[11px] mt-1 ${qrNote?.type === 'error' ? 'text-red-600 font-bold' : qrNote?.type === 'warn' ? 'text-amber-700 font-bold' : qrNote ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {qrNote?.text || (qrNumber ? `EZ-TEX QR ${qrNumber}번` : form.qr ? 'EZ-TEX 주소가 아니에요 — 맞는 QR인지 확인해 주세요.' : 'QR이 없으면 엑셀에서 QR 자리를 비워요.')}
                  </p>
                </section>

                {/* 아래 설명 */}
                <div>
                  <label className={labelCls}>아래 설명 <span className="font-medium text-slate-400">(맨 아래 칸 — 작은 글씨, Enter로 줄 바꿈)</span></label>
                  <textarea value={form.note} onChange={e => patch({ note: e.target.value })} rows={4}
                    placeholder="예: Nylon filament wrap with advanced tech delivers top durability and pilling resistance."
                    className={`${inputCls} resize-y`} />
                </div>
              </div>

              {/* 미리보기 */}
              <div className="w-full lg:w-auto lg:sticky lg:top-0 flex justify-center shrink-0">
                <StickerPreview values={stickerCellValues(form, fabric)} />
              </div>
            </div>
          </div>

          {/* 아래 버튼 */}
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-slate-200 shrink-0">
            {savedDoc && (
              <button type="button" onClick={handleDelete} disabled={busy} title="삭제"
                className="bg-white border border-slate-300 text-slate-500 px-2.5 sm:px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">삭제</span>
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={requestClose}
              className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">
              닫기
            </button>
            <button type="button" onClick={handleSaveAndDownload} disabled={busy || qrReading}
              className="bg-white border border-emerald-300 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
              <Download className="w-4 h-4" /> {dirtyNow || !savedDoc ? '저장하고 엑셀 받기' : '엑셀 받기'}
            </button>
            <button type="button" onClick={handleSave} disabled={busy || qrReading}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
              <Save className="w-4 h-4" /> 저장
            </button>
          </div>
        </div>
      </ModalBackdrop>

      <datalist id="hs-type-list">{typeList.map(v => <option key={v} value={v} />)}</datalist>

      {/* 팝업은 창 밖에 (팝업 규약) */}
      <UnsavedChangesDialog
        open={!!pending}
        message="헹거 스티커에 저장하지 않은 변경사항이 있어요. 저장할까요?"
        onSave={saveAndLeave}
        onDiscard={leaveWithoutSave}
        onKeepEditing={keepEditing}
      />
    </>
  );
};
