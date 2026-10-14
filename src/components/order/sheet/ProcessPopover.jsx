import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CalendarCheck, Eraser, History, Plus, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { StatusSelect } from '../common/StatusSelect';
import { usePopoverSave } from '../common/usePopoverSave';
import { getStepMeta, normalizeStatus, PROGRESS_STATUS_OPTIONS } from '../../../constants/production';
import { createMachine, createStep, getKnittingPlan, isStepUsed } from '../../../utils/orderModel';
import { diffDaysYmd, fmtKg, shortDate, todayYmd, toNumberOrNull } from '../../../utils/orderCalculations';

// ============================================================
// 공정 일정 입력 창 (현황표 공정 칸 · 상세창 · 간트 공용)
// ------------------------------------------------------------
// - 외주처 · 예상 시작일 · 예상 종료일 · 상태(드롭다운) · 완료일 · 메모 (대표님 요청 2026-10-11)
// - 예상 종료일을 바꿔 저장하면 예전 날짜가 '예상 종료일 기록'에 남음 (1차·2차… — 최초 예상과 비교)
//   잘못 남은 기록은 🗑 로 지울 수 있음
// - 편직: 기계별 일일 생산량 (1호기·2호기…) → 하루 합계로 며칠 걸리는지 + 예상 종료일 계산
// - 로컬 draft 로 편집 → [저장] 누르면 "바뀐 필드만" patch 로 onSave(patch)
// - Enter = 저장 (메모 칸 제외), ESC / 바깥 클릭 = 닫기 — 저장 안 한 변경이 있으면 '변경사항이 있습니다' 창 (PopoverShell)
// - anchorRect 가 있으면 클릭한 칸 옆에, null 이면 화면 가운데 모달로 뜸
// - simple: 외주처 칸 없이 (프리세팅 — 염가공 LOT 창에서 관리하는 오더 공통 공정, 간트 막대를 누를 때)
// - prefill: 간트에서 날짜를 눌러 연 경우 { startDate } 또는 { endDate } — 그 값을 넣은 채로 열림 ([저장]해야 반영)
// props: order, stepKey, meta?(추가 공정처럼 기본 목록에 없는 공정 — { label, vendorLabel }),
//        anchorRect, onClose, onSave(patch) => Promise<boolean>, vendorOptions: string[], simple, prefill
// ============================================================

const INPUT_CLS = 'min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';
const INPUT_OK = 'w-full border-slate-300';
const INPUT_ERR = 'w-full border-red-400 bg-red-50';
const LABEL_CLS = 'block mb-1 text-[11px] font-bold text-slate-500';

const PATCH_FIELDS = ['vendor', 'startDate', 'endDate', 'status', 'doneDate', 'notes'];

const numText = (v) => (v === null || v === undefined ? '' : String(v));

// 저장된 공정 값 → 폼 값 (입력칸은 모두 문자열)
const toForm = (step) => ({
  vendor: step.vendor || '',
  startDate: step.startDate || '',
  endDate: step.endDate || '',
  status: normalizeStatus(step.status),
  doneDate: step.doneDate || '',
  notes: step.notes || '',
  machines: (step.machines || []).map(m => ({ id: m.id, name: m.name || '', kg: numText(m.dailyKg) })),
  endHistory: step.endHistory || [],
});

// 기계 칸 검사: 빈칸 = 괜찮음, 글자·0 이하 = 잘못
const machineKgBad = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return false;
  const n = toNumberOrNull(t);
  return n === null || n <= 0;
};

// 폼 값 → 저장할 값 (공백 정리 · 숫자 변환 · 완료가 아니면 완료일 비움 · 빈 기계 줄 버림)
const fromForm = (form) => ({
  vendor: form.vendor.trim(),
  startDate: form.startDate,
  endDate: form.endDate,
  status: form.status,
  doneDate: form.status === 'done' ? form.doneDate : '',
  notes: form.notes.trim(),
  machines: form.machines
    .map(m => {
      const kg = toNumberOrNull(m.kg.trim());
      return { id: m.id, name: m.name.trim(), dailyKg: kg !== null && kg > 0 ? kg : null };
    })
    .filter(m => m.name || m.dailyKg !== null),
});

const machinesKey = (list) => JSON.stringify(list.map(m => [m.name, m.dailyKg]));

// 다음 기계 이름: 지금 '…호기' 중 가장 큰 번호 + 1
const nextMachineName = (machines) => {
  const nums = machines.map(m => Number(String(m.name).match(/(\d+)\s*호기/)?.[1])).filter(n => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : machines.length + 1;
  return `${next}호기`;
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

// 최초 예상 종료일과 지금 날짜 차이 글자 (+ = 늦어짐)
const shiftText = (diff) => {
  if (diff === null || diff === undefined) return '';
  if (diff > 0) return `${diff}일 늦어짐`;
  if (diff < 0) return `${-diff}일 당겨짐`;
  return '최초와 같음';
};

export const ProcessPopover = ({
  order, stepKey, meta: metaProp = null, anchorRect = null, onClose, onSave, vendorOptions = [], simple = false, prefill = null,
}) => {
  const meta = metaProp || getStepMeta(stepKey);
  const step = { ...createStep(stepKey), ...(order?.steps?.[stepKey] || {}) };
  const isKnitting = stepKey === 'knitting';
  const listId = useId();

  const [initialForm] = useState(() => toForm(step));
  // 간트에서 고른 날짜 (예상 시작일 또는 종료일) — 넣은 채로 시작 (저장 전까지는 바뀐 값)
  const [form, setForm] = useState(() => {
    if (!prefill) return initialForm;
    const p = {};
    if (prefill.startDate) p.startDate = prefill.startDate;
    if (prefill.endDate) p.endDate = prefill.endDate;
    return { ...initialForm, ...p };
  });
  const { saving, close, run } = usePopoverSave(onClose);

  // 칸에서 열었을 때만 외주처 칸에 바로 커서 (가운데 모달 = 주로 모바일 → 키보드가 튀어나오지 않게)
  // autoFocus 는 PopoverShell 이 위치를 잡기 전(숨김 상태)이라 먹히지 않아서 effect 로 처리
  //  외주처 칸이 없는 창(프리세팅)·간트 날짜로 연 창은 본문에 포커스 (Enter = 저장)
  const vendorRef = useRef(null);
  const [focusOnOpen] = useState(() => !!anchorRect && !simple && !prefill);
  useEffect(() => {
    if (focusOnOpen) vendorRef.current?.focus();
  }, [focusOnOpen]);

  if (!order || !meta) return null;

  // ---------- 입력값 / 검증 ----------
  const values = fromForm(form);
  const base = fromForm(initialForm);
  const dateError = !!(values.startDate && values.endDate && values.startDate > values.endDate);
  const badMachineIds = isKnitting ? form.machines.filter(m => machineKgBad(m.kg)).map(m => m.id) : [];
  const hasError = dateError || badMachineIds.length > 0;

  // 예상 종료일 기록: 저장하면 남을 예전 날짜 (열 때 예상 종료일이 있었고 바꿨을 때)
  const endChanged = initialForm.endDate !== values.endDate;
  const pendingRecord = endChanged && initialForm.endDate ? { date: initialForm.endDate, at: todayYmd() } : null;
  const historyEdited = form.endHistory.length !== initialForm.endHistory.length;
  const historyAfterSave = pendingRecord ? [...form.endHistory, pendingRecord] : form.endHistory;
  const firstEnd = historyAfterSave[0]?.date || '';
  const shiftDiff = firstEnd && values.endDate ? diffDaysYmd(firstEnd, values.endDate) : null;

  // 열 때와 비교해 "내가 바꾼 필드만" patch 로 (열어둔 사이 다른 사람이 바꾼 필드를 옛 값으로 덮어쓰지 않도록)
  const patch = {};
  PATCH_FIELDS.forEach(f => {
    if (base[f] !== values[f]) patch[f] = values[f];
  });
  if (isKnitting && machinesKey(base.machines) !== machinesKey(values.machines)) patch.machines = values.machines;
  // 기록을 지웠으면 기록 목록을 통째로 (예상 종료일도 바꿨으면 예전 날짜를 붙여서) — 안 지웠으면 저장할 때 자동으로 남음
  if (historyEdited) patch.endHistory = historyAfterSave;
  const isDirty = Object.keys(patch).length > 0;

  // 외주처 제안 목록 (빈값·중복 제거, 가나다순)
  const options = [...new Set((vendorOptions || []).map(v => String(v ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  // ---------- 편직: 기계별 일일 생산량 → 소요일 · 계산 종료일 ----------
  // (저장된 일일 생산량 합계는 빼고 지금 기계 목록으로만 — 기계를 다 지우면 계산도 없어지게)
  const plan = isKnitting
    ? getKnittingPlan(order, { ...step, startDate: values.startDate, machines: values.machines, dailyKg: null })
    : null;
  const machineCount = values.machines.filter(m => m.dailyKg).length;

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

  const addMachine = () => setForm(f => {
    const m = createMachine(nextMachineName(f.machines), null);
    return { ...f, machines: [...f.machines, { id: m.id, name: m.name, kg: '' }] };
  });
  const updateMachine = (id, patchRow) => setForm(f => ({
    ...f,
    machines: f.machines.map(m => (m.id === id ? { ...m, ...patchRow } : m)),
  }));
  const removeMachine = (id) => setForm(f => ({ ...f, machines: f.machines.filter(m => m.id !== id) }));
  const removeHistory = (idx) => setForm(f => ({ ...f, endHistory: f.endHistory.filter((_, i) => i !== idx) }));

  // ---------- 저장 / 닫기 ----------
  const submit = (nextPatch) => run(() => onSave?.(nextPatch));

  const handleSave = () => {
    if (saving || hasError) return;
    if (!isDirty) {
      close(); // 바뀐 게 없으면 저장하지 않고 닫기
      return;
    }
    submit(patch);
  };

  // [비우기] 공정 칸을 처음 상태로 (확인 후 바로 저장 — 예상 종료일 기록도 지움)
  const handleClear = () => {
    if (saving) return;
    const ok = window.confirm(`'${meta.label}' 공정에 입력한 내용을 모두 비울까요?\n외주처·일정·상태·메모·예상 종료일 기록${isKnitting ? '·기계별 생산량' : ''}이 지워져요.`);
    if (!ok) return;
    const clearPatch = { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '', endHistory: [] };
    if (isKnitting) clearPatch.machines = [];
    submit(clearPatch);
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation(); // 포털이어도 React 이벤트는 부모(표 칸)로 올라가므로 저장용 Enter 는 여기서 끝냄
    handleSave();
  };

  const subtitle = [order.articleNo, order.customer].filter(Boolean).join(' · ');
  const canClear = isStepUsed(step) || (step.endHistory || []).length > 0;

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handleClear}
        disabled={saving || !canClear}
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
      width={isKnitting ? 400 : 360}
      title={`${order.orderNumber || '새 오더'} · ${meta.label}`}
      subtitle={subtitle || undefined}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      {/* 가운데 모달(외주처 칸에 커서를 두지 않을 때)은 이 영역에 포커스(data-autofocus) → Enter 로 저장 */}
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {prefill && isDirty && (
          <p className="px-2 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-[11px] font-bold text-teal-800 leading-snug">
            간트에서 고른 날짜({shortDate(prefill.startDate || prefill.endDate)})를 {prefill.startDate ? '예상 시작일' : '예상 종료일'}로 넣었어요 —
            [저장]하면 현황표에도 반영돼요.
          </p>
        )}
        {simple ? (
          <p className="text-[10px] text-slate-500 leading-snug">
            {meta.label}은 염가공 LOT 창에서 관리해요 (염색 전 · 오더 전체 공통). 여기서 고쳐도 같은 값이에요.
          </p>
        ) : (
          /* 외주처 */
          <label className="block">
            <span className={LABEL_CLS}>{meta.vendorLabel || '외주처'}</span>
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
        )}

        {/* 예상 시작일 / 예상 종료일 */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className={LABEL_CLS}>예상 시작일</span>
              <input
                type="date"
                value={form.startDate}
                onChange={setField('startDate')}
                className={`${INPUT_CLS} ${dateError ? INPUT_ERR : INPUT_OK}`}
              />
            </label>
            <label className="block min-w-0">
              <span className={LABEL_CLS}>예상 종료일</span>
              <input
                type="date"
                value={form.endDate}
                onChange={setField('endDate')}
                className={`${INPUT_CLS} ${dateError ? INPUT_ERR : INPUT_OK}`}
              />
            </label>
          </div>
          {dateError && <ErrorLine>예상 종료일이 예상 시작일보다 빨라요. 날짜를 확인해 주세요.</ErrorLine>}
        </div>

        {/* 예상 종료일 기록 (바꾼 적이 있거나 지금 바꾸는 중일 때) */}
        {(form.endHistory.length > 0 || pendingRecord) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <History className="w-3.5 h-3.5 shrink-0" /> 예상 종료일 기록
            </div>
            {form.endHistory.map((h, i) => (
              <div key={`${h.date}_${h.at}_${i}`} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-9 shrink-0 font-bold text-slate-500">{i + 1}차</span>
                <span className="font-mono font-bold">{shortDate(h.date)}</span>
                {h.at && <span className="text-[10px] text-slate-400">({shortDate(h.at)}에 바꿈)</span>}
                <button
                  type="button"
                  onClick={() => removeHistory(i)}
                  className="ml-auto p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="이 기록 지우기 (잘못 넣은 날짜였을 때)"
                  aria-label={`${i + 1}차 기록 지우기`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pendingRecord && (
              <p className="text-[10px] text-teal-700">
                저장하면 예전 예상 종료일 <b className="font-mono">{shortDate(pendingRecord.date)}</b>이 {historyAfterSave.length}차 기록으로 남아요.
              </p>
            )}
            {firstEnd && values.endDate && (
              <p className={`text-[11px] font-bold ${shiftDiff > 0 ? 'text-red-600' : shiftDiff < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                최초 {shortDate(firstEnd)} → 지금 {shortDate(values.endDate)} · {shiftText(shiftDiff)}
              </p>
            )}
          </div>
        )}

        {/* 편직 전용: 기계별 일일 생산량 → 며칠 걸리는지 + 계산 종료일 */}
        {isKnitting && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-yellow-900">기계별 일일 생산량</span>
              <button
                type="button"
                onClick={addMachine}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border border-yellow-300 bg-white text-[11px] font-bold text-yellow-800 hover:bg-yellow-100"
              >
                <Plus className="w-3 h-3" /> 기계 추가
              </button>
            </div>

            {form.machines.length === 0 ? (
              <p className="text-[11px] text-yellow-800/80 leading-snug">
                기계(1호기·2호기…)를 추가하고 하루 생산량(kg)을 넣으면 며칠 걸리는지 계산해 드려요.
              </p>
            ) : (
              <div className="space-y-1">
                {form.machines.map((m, i) => {
                  const bad = badMachineIds.includes(m.id);
                  return (
                    <div key={m.id} className="grid grid-cols-[1fr_84px_auto_auto] items-center gap-1.5">
                      <input
                        type="text"
                        value={m.name}
                        onChange={e => updateMachine(m.id, { name: e.target.value })}
                        placeholder={`${i + 1}호기`}
                        aria-label={`${i + 1}번째 기계 이름`}
                        className={`${INPUT_CLS} ${INPUT_OK} !py-1`}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={m.kg}
                        onChange={e => updateMachine(m.id, { kg: e.target.value })}
                        placeholder="예) 300"
                        aria-label={`${m.name || `${i + 1}번째 기계`} 하루 생산량 (kg)`}
                        className={`${INPUT_CLS} !py-1 w-full text-right ${bad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                      />
                      <span className="text-[10px] text-yellow-900/80">kg/일</span>
                      <button
                        type="button"
                        onClick={() => removeMachine(m.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title={`${m.name || '이 기계'} 빼기`}
                        aria-label={`${m.name || '이 기계'} 빼기`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {badMachineIds.length > 0 && <ErrorLine>하루 생산량은 0보다 큰 숫자로 넣어 주세요.</ErrorLine>}

            {plan?.daily ? (
              <div className="pt-1 border-t border-yellow-200 space-y-1">
                <p className="text-[11px] text-yellow-900 leading-snug">
                  하루 합계 <b>{fmtKg(plan.daily)} kg</b>{machineCount > 1 ? ` (${machineCount}대)` : ''}
                  {plan.days > 0 ? (
                    <>
                      {' · '}작지 {fmtKg(plan.total)} kg ÷ {fmtKg(plan.daily)} kg = <b>약 {plan.days}일</b>
                    </>
                  ) : null}
                </p>
                {plan.days === 0 && (
                  <p className="text-[11px] text-yellow-800">컬러별 오더kg(작지kg)이 없어 며칠 걸리는지 계산할 수 없어요.</p>
                )}
                {plan.days > 0 && plan.end && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="text-[11px] text-yellow-900">
                      예상 시작 {shortDate(values.startDate)}부터 → 종료 <b>{shortDate(plan.end)}</b> (생산량 계산)
                    </p>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, endDate: plan.end }))}
                      disabled={form.endDate === plan.end}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-yellow-300 bg-white text-[11px] font-bold text-yellow-800 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-default"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      {form.endDate === plan.end ? '예상 종료일과 같아요' : '예상 종료일에 넣기'}
                    </button>
                  </div>
                )}
                {plan.days > 0 && !plan.end && (
                  <p className="text-[11px] text-yellow-800/80">예상 시작일을 넣으면 종료일도 계산해 드려요.</p>
                )}
                {plan.end && !form.endDate && (
                  <p className="text-[10px] text-yellow-800/70">예상 종료일을 비워두면 현황표·간트에 생산량으로 계산한 종료일이 보여요.</p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* 상태 (드롭다운) + 완료일 */}
        <div className="grid grid-cols-2 gap-2 items-end">
          <div className="min-w-0">
            <span className={LABEL_CLS}>상태</span>
            <StatusSelect
              value={form.status}
              options={PROGRESS_STATUS_OPTIONS}
              onChange={setStatus}
              size="md"
              instant={false}
              ariaLabel={`${meta.label} 상태`}
              className="w-full [&>select]:w-full"
            />
          </div>
          {form.status === 'done' && (
            <label className="block min-w-0">
              <span className={LABEL_CLS}>완료일</span>
              <input
                type="date"
                value={form.doneDate}
                onChange={setField('doneDate')}
                className={`${INPUT_CLS} ${INPUT_OK}`}
              />
            </label>
          )}
        </div>

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
