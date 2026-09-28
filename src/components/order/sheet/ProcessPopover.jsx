import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CalendarCheck, Eraser } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import {
  getStepMeta, normalizeStatus, PROGRESS_STATUSES, PROGRESS_STATUS_COLORS,
} from '../../../constants/production';
import { createStep, getKnittingEstimatedEnd, getOrderTotals, isStepUsed } from '../../../utils/orderModel';
import { fmtKg, shortDate, todayYmd, toNumberOrNull } from '../../../utils/orderCalculations';

// ============================================================
// 공정 일정 팝오버 (현황표 공정 칸 · 상세창 · 간트 공용)
// ------------------------------------------------------------
// - 외주처 · 시작일 · 종료일 · 상태 · 완료일 · 메모 (+ 편직: 일일 생산량 → 예상 종료일)
// - 로컬 draft 로 편집 → [저장] 누르면 "바뀐 필드만" patch 로 onSave(patch)
// - Enter = 저장 (메모 칸 제외), ESC / 바깥 클릭 = 닫기 (PopoverShell 이 처리) — 저장 안 한 변경이 있으면 한 번 묻기
// - anchorRect 가 있으면 클릭한 칸 옆에, null 이면 화면 가운데 모달로 뜸
// props: order, stepKey, anchorRect, onClose, onSave(patch) => Promise<boolean>, vendorOptions: string[]
// ============================================================

const INPUT_CLS = 'min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';
const INPUT_OK = 'w-full border-slate-300';
const INPUT_ERR = 'w-full border-red-400 bg-red-50';
const LABEL_CLS = 'block mb-1 text-[11px] font-bold text-slate-500';

const PATCH_FIELDS = ['vendor', 'startDate', 'endDate', 'status', 'doneDate', 'notes'];

// 저장된 공정 값 → 폼 값 (입력칸은 모두 문자열)
const toForm = (step) => ({
  vendor: step.vendor || '',
  startDate: step.startDate || '',
  endDate: step.endDate || '',
  status: normalizeStatus(step.status),
  doneDate: step.doneDate || '',
  notes: step.notes || '',
  dailyKg: step.dailyKg === null || step.dailyKg === undefined ? '' : String(step.dailyKg),
});

// 폼 값 → 저장할 값 (공백 정리 · 숫자 변환 · 완료가 아니면 완료일 비움)
const fromForm = (form) => ({
  vendor: form.vendor.trim(),
  startDate: form.startDate,
  endDate: form.endDate,
  status: form.status,
  doneDate: form.status === 'done' ? form.doneDate : '',
  notes: form.notes.trim(),
  dailyKg: toNumberOrNull(form.dailyKg.trim()), // 공백만 있으면 Number('  ')=0 이 되므로 trim 후 변환 (빈칸 = null)
});

// 팝오버를 열 때 값과 비교해 "내가 바꾼 필드만" patch 로
// (열어둔 사이 다른 사람이 바꾼 필드를 옛 값으로 덮어쓰지 않도록 현재 값이 아니라 열 때 값과 비교)
const buildPatch = (initialForm, values, withDailyKg) => {
  const base = fromForm(initialForm);
  const patch = {};
  PATCH_FIELDS.forEach(f => {
    if (base[f] !== values[f]) patch[f] = values[f];
  });
  if (withDailyKg && base.dailyKg !== values.dailyKg) patch.dailyKg = values.dailyKg;
  return patch;
};

// Enter 로 저장할지 (한글 조합 중 Enter · 메모칸 줄바꿈 · 버튼 누름은 제외)
const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag !== 'TEXTAREA' && tag !== 'BUTTON';
};

const ErrorLine = ({ children }) => (
  <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
    {children}
  </p>
);

export const ProcessPopover = ({ order, stepKey, anchorRect = null, onClose, onSave, vendorOptions = [] }) => {
  const meta = getStepMeta(stepKey);
  const step = { ...createStep(stepKey), ...(order?.steps?.[stepKey] || {}) };
  const isKnitting = stepKey === 'knitting';
  const listId = useId();

  const [initialForm] = useState(() => toForm(step));
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // 칸에서 열었을 때만 외주처 칸에 바로 커서 (가운데 모달 = 주로 모바일 → 키보드가 튀어나오지 않게)
  // autoFocus 는 PopoverShell 이 위치를 잡기 전(숨김 상태)이라 먹히지 않아서 effect 로 처리
  const vendorRef = useRef(null);
  const [focusOnOpen] = useState(() => !!anchorRect);
  useEffect(() => {
    if (focusOnOpen) vendorRef.current?.focus();
  }, [focusOnOpen]);

  // 이 창이 이미 닫혔는지 — 저장 중에 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
  // (그 사이 새로 연 다른 팝오버가 닫혀 버리는 것 방지)
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order || !meta) return null;

  // ---------- 입력값 / 검증 ----------
  const values = fromForm(form);
  const dateError = !!(values.startDate && values.endDate && values.startDate > values.endDate);
  const dailyKgError = isKnitting && form.dailyKg.trim() !== '' && !(values.dailyKg > 0);
  const hasError = dateError || dailyKgError;
  const patch = buildPatch(initialForm, values, isKnitting); // 열 때와 비교해 바뀐 필드만
  const isDirty = Object.keys(patch).length > 0;

  // 외주처 제안 목록 (빈값·중복 제거, 가나다순)
  const options = [...new Set((vendorOptions || []).map(v => String(v ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  // ---------- 편직: 예상 종료일 (시작일 + 총 작지kg ÷ 일일 생산량) ----------
  const totalWorkKg = isKnitting ? getOrderTotals(order).workKg : 0;
  const canEstimate = isKnitting && !!values.startDate && values.dailyKg > 0;
  const estimatedEnd = canEstimate
    ? getKnittingEstimatedEnd({
      ...order,
      steps: { ...(order.steps || {}), knitting: { ...step, startDate: values.startDate, dailyKg: values.dailyKg } },
    })
    : '';
  const estimatedDays = estimatedEnd ? Math.max(1, Math.ceil(totalWorkKg / values.dailyKg)) : 0;

  // ---------- 변경 ----------
  const setField = (field) => (e) => {
    const v = e.target.value;
    setForm(f => ({ ...f, [field]: v }));
  };

  // 상태 → 완료로 바꾸면 완료일이 비어 있을 때 오늘로 채움 (다른 상태면 저장 시 완료일 비움)
  const setStatus = (key) => setForm(f => ({
    ...f,
    status: key,
    doneDate: key === 'done' && !f.doneDate ? todayYmd() : f.doneDate,
  }));

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  // 바깥 클릭 / ESC / X 로 닫을 때: 저장 안 한 변경이 있으면 한 번 묻기
  const requestClose = () => {
    if (!saving && isDirty && !window.confirm('저장하지 않은 변경 내용이 있어요. 닫을까요?')) return;
    close();
  };

  const submit = async (nextPatch) => {
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(nextPatch)) !== false;
    } catch {
      ok = false;
    }
    if (closedRef.current) return; // 저장 중에 이미 닫힘
    if (ok) close();
    else setSaving(false);
  };

  const handleSave = () => {
    if (saving || hasError) return;
    if (!isDirty) {
      close(); // 바뀐 게 없으면 저장하지 않고 닫기
      return;
    }
    submit(patch);
  };

  // [비우기] 공정 칸을 처음 상태로 (확인 후 바로 저장)
  const handleClear = () => {
    if (saving) return;
    const ok = window.confirm(`'${meta.label}' 공정에 입력한 내용을 모두 비울까요?\n외주처·일정·상태·메모${isKnitting ? '·일일 생산량' : ''}이 지워져요.`);
    if (!ok) return;
    const clearPatch = { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '' };
    if (isKnitting) clearPatch.dailyKg = null;
    submit(clearPatch);
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation(); // 포털이어도 React 이벤트는 부모(표 칸)로 올라가므로 저장용 Enter 는 여기서 끝냄
    handleSave();
  };

  const subtitle = [order.articleNo, order.customer].filter(Boolean).join(' · ');

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handleClear}
        disabled={saving || !isStepUsed(step)}
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
        title="이 공정에 입력한 내용을 모두 지워요"
      >
        <Eraser className="w-3.5 h-3.5" />
        비우기
      </button>
      <div className="flex items-center gap-1.5">
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
          disabled={saving || hasError}
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
      width={360}
      title={`${order.orderNumber || '새 오더'} · ${meta.label}`}
      subtitle={subtitle || undefined}
      onClose={requestClose}
      footer={footer}
    >
      {/* 가운데 모달(외주처 칸에 커서를 두지 않을 때)은 이 영역에 포커스(data-autofocus) → Enter 로 저장 */}
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* 외주처 */}
        <label className="block">
          <span className={LABEL_CLS}>{meta.vendorLabel}</span>
          <input
            type="text"
            list={listId}
            value={form.vendor}
            ref={vendorRef}
            onChange={setField('vendor')}
            placeholder={options.length ? '목록에서 고르거나 직접 입력' : '직접 입력'}
            className={`${INPUT_CLS} ${INPUT_OK} font-bold`}
          />
          <datalist id={listId}>
            {options.map(v => <option key={v} value={v} />)}
          </datalist>
        </label>

        {/* 시작일 / 종료일 */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className={LABEL_CLS}>시작일</span>
              <input
                type="date"
                value={form.startDate}
                onChange={setField('startDate')}
                className={`${INPUT_CLS} ${dateError ? INPUT_ERR : INPUT_OK}`}
              />
            </label>
            <label className="block min-w-0">
              <span className={LABEL_CLS}>종료일</span>
              <input
                type="date"
                value={form.endDate}
                onChange={setField('endDate')}
                className={`${INPUT_CLS} ${dateError ? INPUT_ERR : INPUT_OK}`}
              />
            </label>
          </div>
          {dateError && <ErrorLine>종료일이 시작일보다 빨라요. 날짜를 확인해 주세요.</ErrorLine>}
        </div>

        {/* 편직 전용: 일일 생산량 → 예상 종료일 */}
        {isKnitting && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 space-y-1.5">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-yellow-900 shrink-0">일일 생산량(kg/일)</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.dailyKg}
                onChange={setField('dailyKg')}
                placeholder="예) 300"
                className={`${INPUT_CLS} w-24 text-right ${dailyKgError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              />
            </label>
            {dailyKgError && <ErrorLine>0보다 큰 숫자로 입력해 주세요.</ErrorLine>}

            {!dailyKgError && estimatedEnd && (
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[11px] text-yellow-900 leading-snug">
                  예상 종료 <b>{shortDate(estimatedEnd)}</b>
                  <span className="text-yellow-800/80">
                    {' '}(총 작지 {fmtKg(totalWorkKg)} kg ÷ {fmtKg(values.dailyKg)} kg/일 · {estimatedDays}일)
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, endDate: estimatedEnd }))}
                  disabled={form.endDate === estimatedEnd}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-yellow-300 bg-white text-[11px] font-bold text-yellow-800 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-default"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  {form.endDate === estimatedEnd ? '종료일과 같아요' : '종료일에 넣기'}
                </button>
              </div>
            )}
            {!dailyKgError && canEstimate && !estimatedEnd && (
              <p className="text-[11px] text-yellow-800">컬러별 오더kg(작지kg)이 없어 예상 종료일을 계산할 수 없어요.</p>
            )}
            {!canEstimate && !dailyKgError && (
              <p className="text-[11px] text-yellow-800/80">시작일과 일일 생산량을 넣으면 예상 종료일을 계산해 드려요.</p>
            )}
            {estimatedEnd && !form.endDate && (
              <p className="text-[10px] text-yellow-800/70">종료일을 비워두면 현황표에 예상 종료일로 표시돼요.</p>
            )}
          </div>
        )}

        {/* 상태 (4단계 세그먼트) */}
        <div>
          <span className={LABEL_CLS}>상태</span>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="상태">
            {PROGRESS_STATUSES.map(s => {
              const active = form.status === s.key;
              const c = PROGRESS_STATUS_COLORS[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStatus(s.key)}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[11px] font-bold transition ${
                    active ? `${c.bg} ${c.text} ${c.border} shadow-sm` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? c.dot : 'bg-slate-300'}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 완료일 (상태 = 완료일 때만) */}
        {form.status === 'done' && (
          <label className="block">
            <span className={LABEL_CLS}>완료일</span>
            <input
              type="date"
              value={form.doneDate}
              onChange={setField('doneDate')}
              className={`${INPUT_CLS} ${INPUT_OK}`}
            />
          </label>
        )}

        {/* 메모 */}
        <label className="block">
          <span className={LABEL_CLS}>메모</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={setField('notes')}
            placeholder="특이사항 (Enter 는 줄바꿈)"
            className={`${INPUT_CLS} ${INPUT_OK} resize-y leading-snug`}
          />
        </label>
      </div>
    </PopoverShell>
  );
};

export default ProcessPopover;
