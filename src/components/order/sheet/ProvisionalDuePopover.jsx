import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eraser } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { PROVISIONAL_DUE_STEPS, PROVISIONAL_STATES } from '../../../constants/production';
import {
  chainProvisionalDates, describeProvisionalDue, describeStepCurrent, getProvisionalBase, getProvisionalDueInfo,
  provisionalAnchorOf,
} from '../../../utils/orderModel';
import { diffDaysYmd, isYmd, shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 가납기 입력 창 (현황표 가납기 칸 · 상세창 · 간트 깃발 공용) — 대표님 요청 2026-10-10 / 일수 2026-10-11
// ------------------------------------------------------------
// - 원사 · 편직 · 염가공 · 외관검사 가납기(대략적인 목표 날짜) 4개를 한 번에
// - 공정마다 일수를 넣으면 날짜가 자동: 가납기 = 앞 공정 가납기(첫 공정은 기준일) + 일수
//   · 기준일: 처음엔 오더 등록일 — 바꾸면 일수를 넣은 공정 날짜가 다 같이 움직임
//   · 날짜를 직접 고치면 그 공정 일수가 맞춰 바뀌고(일수를 넣은 공정만), 뒤 공정도 같이 움직임
//   · 일수는 달력 기준 (주말 포함)
// - 날짜를 넣는 동안 바로 현재 일정과 비교해서 보여줌 (맞음 / N일 늦음 / 지남 / 일정 미입력)
// - [저장] → 바뀐 날짜만 patch + 일수가 바뀌었으면 plan 으로 onSave(patch, plan)
//   [모두 비우기] → 확인 후 날짜·일수 모두 지우고 바로 저장
// - Enter = 저장, ESC / 바깥 클릭 = 닫기 (저장 안 한 변경이 있으면 '변경사항이 있습니다' 창)
// props: order, anchorRect(null = 화면 가운데), onClose, onSave(patch, plan?) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

// 연도를 한 자리씩 타이핑하는 중(0002-…)은 날짜로 보지 않음
const isFullYmd = (v) => isYmd(v) && Number(String(v).slice(0, 4)) >= 1900;

// 일수 칸: '' = 안 씀(null), 0 이상 정수만 (그 밖은 잘못)
const parseDays = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return { value: null, bad: false };
  if (!/^\d+$/.test(t)) return { value: null, bad: true };
  return { value: Number(t), bad: false };
};

const toForm = (order) => {
  const days = order?.provisionalPlan?.days || {};
  return {
    base: getProvisionalBase(order),
    rows: Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, {
      days: days[s.key] === null || days[s.key] === undefined ? '' : String(days[s.key]),
      date: order?.provisionalDue?.[s.key] || '',
    }])),
  };
};

// 폼 → chainProvisionalDates 모양 (일수는 숫자/null, 잘못 넣은 일수는 없는 것으로)
const toChainRows = (rows) => Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, {
  days: parseDays(rows[s.key].days).value,
  date: isFullYmd(rows[s.key].date) ? rows[s.key].date : '',
}]));

// 일수를 넣은 공정 날짜를 다시 계산해서 폼에 반영 (일수 칸 글자는 그대로)
const recompute = (form) => {
  if (!isFullYmd(form.base)) return form;
  const chained = chainProvisionalDates(form.base, toChainRows(form.rows));
  return {
    ...form,
    rows: Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => {
      const r = form.rows[s.key];
      return [s.key, parseDays(r.days).value !== null ? { ...r, date: chained[s.key].date } : r];
    })),
  };
};

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
  const savingRef = useRef(false); // 처리 중 잠금 (빠른 두 번 누름 방지)

  // 칸에서 열었을 때만 첫 일수 칸에 커서 (가운데 모달 = 주로 모바일 → 키보드가 튀어나오지 않게)
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

  const savedBase = String(order.provisionalPlan?.base || '');
  const defaultBase = getProvisionalBase({ ...order, provisionalPlan: { ...(order.provisionalPlan || {}), base: '' } });

  // ---------- 입력값 / 검증 ----------
  const baseBad = !!form.base && !isFullYmd(form.base);
  const dateBadKeys = PROVISIONAL_DUE_STEPS.filter(s => form.rows[s.key].date && !isFullYmd(form.rows[s.key].date)).map(s => s.key);
  const daysBadKeys = PROVISIONAL_DUE_STEPS.filter(s => parseDays(form.rows[s.key].days).bad).map(s => s.key);
  const hasError = baseBad || dateBadKeys.length > 0 || daysBadKeys.length > 0;

  // 바뀐 날짜만 patch
  const patch = {};
  PROVISIONAL_DUE_STEPS.forEach(s => {
    if (form.rows[s.key].date !== initialForm.rows[s.key].date) patch[s.key] = form.rows[s.key].date;
  });
  // 일수 · 기준일 (일수를 하나라도 쓰거나 기준일을 바꿨을 때만 기준일 저장 — 아니면 오더 등록일을 계속 따라감)
  const daysOf = (rows) => Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, parseDays(rows[s.key].days).value]));
  const formDays = daysOf(form.rows);
  const daysChanged = PROVISIONAL_DUE_STEPS.some(s => formDays[s.key] !== daysOf(initialForm.rows)[s.key]);
  const baseChanged = form.base !== initialForm.base;
  const anyDays = PROVISIONAL_DUE_STEPS.some(s => formDays[s.key] !== null);
  const planChanged = daysChanged || baseChanged;
  const plan = planChanged
    ? { base: anyDays || baseChanged || savedBase ? form.base : '', days: formDays }
    : undefined;
  const isDirty = Object.keys(patch).length > 0 || planChanged;
  const hasAny = PROVISIONAL_DUE_STEPS.some(s => initialForm.rows[s.key].date || initialForm.rows[s.key].days);

  // 입력 중인 가납기로 미리 비교 (아직 다 못 넣은 날짜는 빈칸으로)
  const preview = {
    ...order,
    provisionalDue: Object.fromEntries(
      PROVISIONAL_DUE_STEPS.map(s => [s.key, isFullYmd(form.rows[s.key].date) ? form.rows[s.key].date : ''])
    ),
  };

  // 순서 안내 (원사 → 편직 → 염가공 → 외관검사) — 막지는 않음
  let orderWarn = '';
  let prev = null;
  PROVISIONAL_DUE_STEPS.forEach(s => {
    const d = form.rows[s.key].date;
    if (orderWarn || !d || !isFullYmd(d)) return;
    if (prev && d < prev.date) orderWarn = `${s.label} 가납기가 ${prev.label} 가납기보다 빨라요.`;
    prev = { date: d, label: s.label };
  });

  // ---------- 변경 ----------
  const setBase = (v) => setForm(f => recompute({ ...f, base: v }));

  const setDays = (key, v) => setForm(f => recompute({
    ...f,
    rows: { ...f.rows, [key]: { ...f.rows[key], days: v } },
  }));

  // 날짜를 직접 고치면: 일수를 쓰는 공정이면 일수를 맞춰 바꾸고, 뒤 공정(일수를 쓰는 것)도 같이 움직임
  const setDate = (key, v) => setForm(f => {
    const row = f.rows[key];
    let days = row.days;
    if (parseDays(row.days).value !== null) {
      if (!v) {
        days = '';
      } else if (isFullYmd(v)) {
        const anchor = provisionalAnchorOf(f.base, toChainRows(f.rows), key);
        const diff = anchor ? diffDaysYmd(anchor, v) : null;
        days = diff !== null && diff >= 0 ? String(diff) : '';
      }
    }
    const next = { ...f, rows: { ...f.rows, [key]: { ...row, date: v, days } } };
    return isFullYmd(v) || !v ? recompute(next) : next;
  });

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  const submit = async (nextPatch, nextPlan) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(nextPatch, nextPlan)) !== false;
    } catch {
      ok = false;
    }
    savingRef.current = false;
    if (closedRef.current) return;
    if (ok) close();
    else setSaving(false);
  };

  const handleSave = () => {
    if (savingRef.current || hasError) return;
    if (!isDirty) {
      close();
      return;
    }
    submit(patch, plan);
  };

  const handleClear = () => {
    if (savingRef.current) return;
    if (!window.confirm('가납기 4개의 날짜와 일수를 모두 비울까요?')) return;
    submit(
      Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, ''])),
      { base: '', days: Object.fromEntries(PROVISIONAL_DUE_STEPS.map(s => [s.key, null])) }
    );
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
        title="가납기 4개의 날짜와 일수를 모두 지워요"
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
      width={430}
      title={`${order.orderNumber || '새 오더'} · 가납기`}
      subtitle="대략적인 목표 날짜 — 일수를 넣으면 날짜가 이어서 계산되고, 지금 일정과 비교해 보여 줘요"
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-2.5 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* 기준일 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-600">기준일</span>
            <input
              type="date"
              value={form.base}
              onChange={e => setBase(e.target.value)}
              className={`${INPUT_CLS} ${baseBad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              aria-label="가납기 기준일"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-500 leading-snug">
            {savedBase ? '저장한 기준일' : `처음엔 오더 등록일 (${shortDate(defaultBase)})`} — 첫 공정 가납기 = 기준일 + 일수. 바꾸면 일수를 넣은 공정이 같이 움직여요.
          </p>
        </div>

        {/* 머리줄 */}
        <div className="grid grid-cols-[64px_76px_1fr] gap-2 px-0.5 text-[10px] font-bold text-slate-400">
          <span>공정</span>
          <span>일수</span>
          <span>가납기</span>
        </div>

        {PROVISIONAL_DUE_STEPS.map((s, i) => {
          const row = form.rows[s.key];
          const daysBad = daysBadKeys.includes(s.key);
          const dateBad = dateBadKeys.includes(s.key);
          const info = getProvisionalDueInfo(preview, s.key);
          const desc = describeProvisionalDue(info);
          const st = PROVISIONAL_STATES[info.state] || PROVISIONAL_STATES.none;
          // 일수를 안 쓰는 공정: 앞 기준과의 차이를 흐리게 보여 줌
          const anchor = provisionalAnchorOf(form.base, toChainRows(form.rows), s.key);
          const hintDays = !row.days && isFullYmd(row.date) && isFullYmd(anchor) ? diffDaysYmd(anchor, row.date) : null;
          return (
            <div key={s.key} className="grid grid-cols-[64px_76px_1fr] items-start gap-2">
              <span className="pt-1.5 text-[11px] font-extrabold text-slate-600">{s.label}</span>
              <div className="flex items-center gap-1">
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="text"
                  inputMode="numeric"
                  value={row.days}
                  onChange={e => setDays(s.key, e.target.value)}
                  placeholder={hintDays !== null && hintDays >= 0 ? String(hintDays) : '-'}
                  aria-label={`${s.label} 일수`}
                  title={i === 0 ? '기준일부터 며칠' : `${PROVISIONAL_DUE_STEPS[i - 1].label} 가납기부터 며칠 (앞 공정이 비었으면 그 앞)`}
                  className={`${INPUT_CLS} text-right ${daysBad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
                <span className="text-[10px] text-slate-500 shrink-0">일</span>
              </div>
              <div className="min-w-0">
                <input
                  type="date"
                  value={row.date}
                  onChange={e => setDate(s.key, e.target.value)}
                  aria-label={`${s.label} 가납기`}
                  className={`${INPUT_CLS} ${dateBad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
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

        {(baseBad || dateBadKeys.length > 0) && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 날짜를 끝까지 입력해 주세요.
          </p>
        )}
        {daysBadKeys.length > 0 && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 일수는 0 이상 숫자로 넣어 주세요.
          </p>
        )}
        {!hasError && orderWarn && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {orderWarn}
          </p>
        )}
        <p className="text-[10px] text-slate-400 leading-snug">
          일수는 달력 기준(주말 포함). 비교 기준: 그 공정 예상 종료일(완료면 완료일) · 염가공은 가장 늦은 LOT 완료예정일. Enter 저장.
        </p>
      </div>
    </PopoverShell>
  );
};

export default ProvisionalDuePopover;
