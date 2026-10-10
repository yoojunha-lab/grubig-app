import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eraser } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { PROVISIONAL_DUE_STEPS, PROVISIONAL_STATES } from '../../../constants/production';
import { describeProvisionalDue, describeStepCurrent, getProvisionalDueInfo } from '../../../utils/orderModel';
import { isYmd } from '../../../utils/orderCalculations';

// ============================================================
// 가납기 입력 팝오버 (현황표 가납기 칸 · 간트 깃발 공용) — 대표님 요청 2026-10-10
// ------------------------------------------------------------
// - 원사 · 편직 · 염가공 · 외관검사 가납기(대략적인 목표 날짜) 4개를 한 번에
// - 날짜를 넣는 동안 바로 현재 일정과 비교해서 보여줌 (맞음 / N일 늦음 / 지남 / 일정 미입력)
// - [저장] → 바뀐 칸만 patch 로 onSave(patch) / [모두 비우기] → 확인 후 바로 저장
// - Enter = 저장, ESC / 바깥 클릭 = 닫기 (저장 안 한 변경이 있으면 한 번 묻기)
// props: order, anchorRect(null = 화면 가운데), onClose, onSave(patch) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

// 연도를 한 자리씩 타이핑하는 중(0002-…)은 날짜로 보지 않음
const isFullYmd = (v) => isYmd(v) && Number(String(v).slice(0, 4)) >= 1900;

const toForm = (order) => Object.fromEntries(
  PROVISIONAL_DUE_STEPS.map(s => [s.key, order?.provisionalDue?.[s.key] || ''])
);

// Enter 로 저장할지 (한글 조합 중 Enter · 버튼 누름은 제외)
const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  return e.target?.tagName !== 'BUTTON';
};

export const ProvisionalDuePopover = ({ order, anchorRect = null, onClose, onSave }) => {
  const [initialForm] = useState(() => toForm(order));
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // 칸에서 열었을 때만 첫 날짜 칸에 커서 (가운데 모달 = 주로 모바일 → 키보드가 튀어나오지 않게)
  const firstRef = useRef(null);
  const [focusOnOpen] = useState(() => !!anchorRect);
  useEffect(() => {
    if (focusOnOpen) firstRef.current?.focus();
  }, [focusOnOpen]);

  // 저장 중에 이미 닫혔으면 저장이 끝난 뒤 onClose 를 또 부르지 않음 (그 사이 새로 연 팝오버가 닫히지 않게)
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order) return null;

  // ---------- 입력값 / 검증 ----------
  const invalidKeys = PROVISIONAL_DUE_STEPS.filter(s => form[s.key] && !isFullYmd(form[s.key])).map(s => s.key);
  const hasError = invalidKeys.length > 0;
  const patch = {};
  PROVISIONAL_DUE_STEPS.forEach(s => {
    if (form[s.key] !== initialForm[s.key]) patch[s.key] = form[s.key];
  });
  const isDirty = Object.keys(patch).length > 0;
  const hasAny = PROVISIONAL_DUE_STEPS.some(s => initialForm[s.key]);

  // 입력 중인 가납기로 미리 비교 (아직 다 못 넣은 날짜는 빈칸으로)
  const preview = {
    ...order,
    provisionalDue: Object.fromEntries(
      PROVISIONAL_DUE_STEPS.map(s => [s.key, isFullYmd(form[s.key]) ? form[s.key] : ''])
    ),
  };

  // 순서 안내 (원사 → 편직 → 염가공 → 외관검사) — 막지는 않음
  let orderWarn = '';
  let prev = null;
  PROVISIONAL_DUE_STEPS.forEach(s => {
    const d = form[s.key];
    if (orderWarn || !d || !isFullYmd(d)) return;
    if (prev && d < prev.date) orderWarn = `${s.label} 가납기가 ${prev.label} 가납기보다 빨라요.`;
    prev = { date: d, label: s.label };
  });

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

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
    if (closedRef.current) return;
    if (ok) close();
    else setSaving(false);
  };

  const handleSave = () => {
    if (saving || hasError) return;
    if (!isDirty) {
      close();
      return;
    }
    submit(patch);
  };

  const handleClear = () => {
    if (saving) return;
    if (!window.confirm('가납기 4개를 모두 비울까요?')) return;
    submit(Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, ''])));
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handleClear}
        disabled={saving || !hasAny}
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
        title="가납기 4개를 모두 지워요"
      >
        <Eraser className="w-3.5 h-3.5" />
        모두 비우기
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
      title={`${order.orderNumber || '새 오더'} · 가납기`}
      subtitle="대략적인 목표 날짜 — 지금 일정과 비교해서 보여 줘요"
      onClose={requestClose}
      footer={footer}
    >
      <div className="p-3 space-y-2 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {PROVISIONAL_DUE_STEPS.map((s, i) => {
          const value = form[s.key];
          const bad = invalidKeys.includes(s.key);
          const info = getProvisionalDueInfo(preview, s.key);
          const desc = describeProvisionalDue(info);
          const st = PROVISIONAL_STATES[info.state] || PROVISIONAL_STATES.none;
          return (
            <div key={s.key} className="grid grid-cols-[64px_1fr] items-start gap-2">
              <span className="pt-1.5 text-[11px] font-extrabold text-slate-600">{s.label}</span>
              <div className="min-w-0">
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="date"
                  value={value}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, [s.key]: v }));
                  }}
                  className={`${INPUT_CLS} ${bad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
                  <span>현재 {describeStepCurrent(info)}</span>
                  {desc.text && info.state !== 'none' && (
                    <span className={`inline-flex items-center px-1.5 py-px rounded-full border font-bold ${st.chip}`}>{desc.text}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {hasError && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 날짜를 끝까지 입력해 주세요.
          </p>
        )}
        {!hasError && orderWarn && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {orderWarn}
          </p>
        )}
        <p className="text-[10px] text-slate-400 leading-snug">
          비교 기준: 그 공정 종료일(완료면 완료일) · 염가공은 가장 늦은 LOT 완료예정일. Enter 저장.
        </p>
      </div>
    </PopoverShell>
  );
};

export default ProvisionalDuePopover;
