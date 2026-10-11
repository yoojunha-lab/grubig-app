import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { TrackEditor } from '../common/TrackEditor';
import { INSPECTION_STATUSES } from '../../../constants/production';

// ============================================================
// 외관검사 입력 창 (컬러 1개 — 현황표 외관검사 칸 · 상세창 · 간트 공용) — 대표님 요청 2026-10-11
// ------------------------------------------------------------
// - 투입일 · 종료예정일 · 상태(검사중·불량컨펌중·출고준비완료·출고완료) · 메모
// - 상태 드롭다운을 바꿀 때마다 그날 날짜로 기록 (날짜·상태 고치기 · 지우기 — TrackEditor)
// - '출고완료'를 고르면 그 컬러 출고 칸도 완료로 체크 (출고일이 비었으면 그날) — orderModel.applyColorTracks
// - 검사처는 오더 전체 공통 값(order.inspectVendor) — 바뀌었을 때만 따로 저장 (염색소와 같은 방식)
// - 로컬 draft 로 편집 → [저장]. Enter = 저장, 닫을 때 저장 안 한 변경이 있으면 '변경사항이 있습니다'
// props: order, color, anchorRect(null = 화면 가운데), onClose,
//        onSave({ inspection }) => Promise<boolean>, onSaveVendor(vendor) => Promise<boolean>, vendorOptions
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';
const LABEL_CLS = 'block mb-1 text-[11px] font-bold text-slate-500';

const toDraft = (color) => ({
  startDate: color?.inspection?.startDate || '',
  endDate: color?.inspection?.endDate || '',
  events: (color?.inspection?.events || []).map(e => ({ ...e })),
  notes: color?.inspection?.notes || '',
});

const clean = (d) => ({ ...d, notes: d.notes.trim() });

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox' && !e.target.getAttribute('list');
};

export const InspectionPopover = ({
  order, color, anchorRect = null, onClose, onSave, onSaveVendor, vendorOptions = [],
}) => {
  const listId = useId();
  const [initial] = useState(() => toDraft(color));
  const [draft, setDraft] = useState(initial);
  const [initialVendor] = useState(() => order?.inspectVendor || '');
  const [vendor, setVendor] = useState(initialVendor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order || !color) return null;

  const inspectionChanged = JSON.stringify(clean(draft)) !== JSON.stringify(clean(initial));
  const vendorChanged = !!onSaveVendor && vendor.trim() !== initialVendor.trim();
  const isDirty = inspectionChanged || vendorChanged;
  const dateBad = !!(draft.startDate && draft.endDate && draft.startDate > draft.endDate);
  const current = draft.events[draft.events.length - 1]?.status || '';
  const willShip = current === 'shipped' && (initial.events[initial.events.length - 1]?.status || '') !== 'shipped' && !color.shipDone;

  const options = [...new Set((vendorOptions || []).map(v => String(v ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  const handleSave = async () => {
    if (savingRef.current || dateBad) return;
    if (!isDirty) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      // 검사처 → 외관검사 순서로 연달아 시작 (useOrder 가 앞 저장 위에 이어서 적용 — LOT 편집과 같은 방식)
      const vendorTask = vendorChanged ? Promise.resolve(onSaveVendor(vendor.trim())) : Promise.resolve(true);
      const inspTask = inspectionChanged ? Promise.resolve(onSave?.({ inspection: clean(draft) })) : Promise.resolve(true);
      const [vOk, iOk] = await Promise.all([vendorTask, inspTask]);
      savingRef.current = false;
      if (closedRef.current) return;
      if (vOk === false || iOk === false) {
        setError(`${[vOk === false && '검사처', iOk === false && '외관검사'].filter(Boolean).join('·')} 저장에 실패했어요. 다시 시도해 주세요.`);
        setSaving(false);
        return;
      }
      close();
    } catch {
      savingRef.current = false;
      if (closedRef.current) return;
      setError('저장 중 문제가 생겼어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1 text-[10px] leading-snug">
        {error ? <span className="font-bold text-red-600">{error}</span>
          : willShip ? <span className="font-bold text-emerald-700">저장하면 이 컬러 출고 칸도 '완료'로 체크돼요.</span>
            : null}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={close}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || dateBad}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={420}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 외관검사`}
      subtitle={[order.articleNo, order.customer].filter(Boolean).join(' · ') || undefined}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* 검사처 (오더 공통) */}
        <label className="block">
          <span className={LABEL_CLS}>검사처 <span className="font-normal text-slate-400">(오더 전체 공통)</span></span>
          <input
            type="text"
            list={listId}
            value={vendor}
            onChange={e => setVendor(e.target.value)}
            disabled={!onSaveVendor}
            placeholder={options.length ? '목록에서 고르거나 직접 입력' : '검사처 이름'}
            className={`${INPUT_CLS} border-slate-300 font-bold`}
          />
          <datalist id={listId}>
            {options.map(v => <option key={v} value={v} />)}
          </datalist>
        </label>

        {/* 투입일 / 종료예정일 */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className={LABEL_CLS}>투입일</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))}
                className={`${INPUT_CLS} ${dateBad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              />
            </label>
            <label className="block min-w-0">
              <span className={LABEL_CLS}>종료예정일</span>
              <input
                type="date"
                value={draft.endDate}
                onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))}
                className={`${INPUT_CLS} ${dateBad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              />
            </label>
          </div>
          {dateBad && (
            <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> 종료예정일이 투입일보다 빨라요.
            </p>
          )}
        </div>

        {/* 상태 */}
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-2.5">
          <TrackEditor
            label="상태"
            statuses={INSPECTION_STATUSES}
            events={draft.events}
            onChange={events => setDraft(d => ({ ...d, events }))}
          />
        </div>

        {/* 메모 */}
        <label className="block">
          <span className={LABEL_CLS}>메모</span>
          <textarea
            rows={2}
            value={draft.notes}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            placeholder="불량 내용 · 출고 준비 사항 (Enter 는 줄바꿈)"
            className={`${INPUT_CLS} border-slate-300 resize-y leading-snug`}
          />
        </label>

        <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
          <Info className="w-3 h-3 mt-px shrink-0" />
          <span>'출고완료'를 고르면 이 컬러 출고 칸도 완료로 체크돼요 (출고일이 비었으면 그날).</span>
        </p>
      </div>
    </PopoverShell>
  );
};

export default InspectionPopover;
