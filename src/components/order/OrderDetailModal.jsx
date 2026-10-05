import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Package, Trash2, Plus, Search, Link2, RotateCcw, ChevronDown, ChevronRight,
  ClipboardList, Factory, Palette, History, FilePlus2, Pencil, AlertTriangle, Eraser,
} from 'lucide-react';
import {
  ORDER_STEPS, PROGRESS_STATUSES, PROGRESS_STATUS_COLORS, getStatusLabel, PROCESS_THEME,
  COLOR_STAGES, ORDER_STATUSES, ORDER_STATUS_COLORS, ORDER_TYPES,
} from '../../constants/production';
import {
  getWorkKg, isWorkKgManual, getLossRate, getOrderTotals, isStepUsed, getKnittingEstimatedEnd,
  getLotSummary, getLotsTotalKg, getLotsStatus, getConfirmState, getColorStage, getDday, colorHasData,
} from '../../utils/orderModel';
import { shortDate, isYmd, round1, toNumberOrNull, fmtKg, todayYmd } from '../../utils/orderCalculations';
import { CHANGE_ACTIONS } from '../../utils/auditLog';
import { PartnerPickerModal } from '../common/PartnerPickerModal';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { ConfirmPopover } from './sheet/ColorPopovers';

// GRUBIG ERP - 생산 오더 상세창 (v8: 엑셀형 현황표)
// ------------------------------------------------------------
// - 모바일에서는 이 창이 유일한 편집 화면 → 한 열 폼, 칸마다 바로 저장
// - 입력 규칙은 현황표와 같음: 글자/숫자 = blur·Enter 확정, Esc 취소 / 날짜 = 고르는 즉시 / 체크 = 즉시
// - 모든 저장은 actions(useOrder 의 orderActions)로만 한다 (Firestore 직접 호출 금지)
// - 섹션: ① 기본정보 ② 공정 일정 ③ 컬러 ④ 변경 이력 ⑤ 등록/수정 시각

// ============================================================
// 0. 공통 스타일 / 작은 부품
// ============================================================
// 모바일(iOS)은 16px 미만 입력칸에 포커스하면 화면이 확대되므로 모바일만 text-base
// 개별 칸에서 글자색·여백을 바꿀 땐 '!' 접두어(예: !text-teal-700)로 덮어씀
const INPUT_CLS = 'w-full min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-base md:text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400 placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case';
const BTN_SUB = 'inline-flex items-center gap-1 shrink-0 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-teal-700 px-2 py-1 rounded-md text-[11px] font-bold';

const TYPE_CLS = {
  main:   'bg-blue-100 text-blue-700 border-blue-300',
  sample: 'bg-amber-100 text-amber-700 border-amber-300',
};

// 컨펌 상태(getConfirmState key) → 뱃지 색
const CONFIRM_STATE_CLS = {
  pass:  'bg-emerald-100 text-emerald-700 border-emerald-300',
  fail:  'bg-red-100 text-red-700 border-red-300',
  sent:  'bg-sky-100 text-sky-700 border-sky-300',
  ready: 'bg-slate-100 text-slate-600 border-slate-300',
};

const statusCls = (key) => {
  const c = PROGRESS_STATUS_COLORS[key] || PROGRESS_STATUS_COLORS.pending;
  return `${c.bg} ${c.text} ${c.border}`;
};

const orderStatusCls = (key) => {
  const c = ORDER_STATUS_COLORS[key] || ORDER_STATUS_COLORS.active;
  return `${c.bg} ${c.text} ${c.border}`;
};

const kgOrDash = (n) => fmtKg(n) || '-';

// 완료 체크 시 날짜가 비어 있으면 오늘 날짜도 함께 채움 (현황표와 같은 규칙 → 리포트·간트에 반영되도록)
const doneWithDate = (color, doneKey, dateKey, done) => (
  done && !color[dateKey] ? { [doneKey]: true, [dateKey]: todayYmd() } : { [doneKey]: done }
);

// ISO 문자열 / Firestore Timestamp → '2026. 9. 28. 오후 3:10:00'
const fmtTs = (ts) => {
  if (!ts) return '-';
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('ko-KR');
};

// 연도를 한 자리씩 타이핑하는 중(0002-…)은 확정하지 않음
const isFullYmd = (v) => isYmd(v) && Number(String(v).slice(0, 4)) >= 1900;

const Field = ({ label, hint, className = '', children }) => (
  <div className={`min-w-0 ${className}`}>
    <div className="text-[11px] font-bold text-slate-500 mb-1">{label}</div>
    {children}
    {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
  </div>
);

const Section = ({ icon: Icon, title, right, children }) => (
  <section>
    <div className="flex items-center justify-between gap-x-2 gap-y-1 flex-wrap mb-2">
      <h4 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
        <Icon className="w-4 h-4 text-teal-600" />{title}
      </h4>
      {right}
    </div>
    {children}
  </section>
);

// 세그먼트 버튼 (메인/샘플, 오더 상태, 공정 상태). 같은 값 클릭은 무시
const Segment = ({ options, value, onChange, colorOf }) => (
  <div className="flex flex-wrap gap-1">
    {options.map(o => {
      const active = o.key === value;
      return (
        <button
          key={o.key}
          type="button"
          onClick={() => { if (!active) onChange(o.key); }}
          className={`px-2.5 py-1 rounded-md border text-xs font-bold transition-colors ${
            active ? colorOf(o.key) : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// 납기 D-day 뱃지 (지남=빨강 깜빡임, 오늘=D-Day, 7일 이내 빨강, 14일 이내 주황, 그 외 회색)
export const DdayBadge = ({ dueDate, className = '' }) => {
  const d = getDday(dueDate);
  if (d === null) return null;
  let text = `D-${d}`;
  let cls = 'bg-slate-100 text-slate-500 border-slate-200';
  if (d < 0) { text = `D+${-d}`; cls = 'bg-red-600 text-white border-red-600 animate-pulse'; }
  else if (d === 0) { text = 'D-Day'; cls = 'bg-red-100 text-red-700 border-red-300'; }
  else if (d <= 7) cls = 'bg-red-50 text-red-600 border-red-200';
  else if (d <= 14) cls = 'bg-orange-50 text-orange-600 border-orange-200';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-extrabold font-mono whitespace-nowrap ${cls} ${className}`}
      title={`납기 ${dueDate}`}
    >
      {text}
    </span>
  );
};

// ============================================================
// 1. 입력 칸 (현황표와 같은 규칙)
// ------------------------------------------------------------
//  draft 는 "편집 중일 때만" 존재 (null = 편집 안 함 → 바깥 값을 그대로 표시)
//  → 외부 값이 바뀌어도 effect 로 맞출 필요 없음
// ============================================================

// 글자 칸: blur / Enter 확정, Esc 취소. multiline 은 Enter = 줄바꿈, Ctrl·⌘+Enter = 확정
// refocusOnFail: onCommit 이 false 를 돌려주면(중복 order# 등) 입력값을 살려 다시 편집 상태로
const TextInput = ({
  value, onCommit, multiline = false, rows = 2, placeholder = '', className = '',
  list, autoFocus = false, refocusOnFail = false,
}) => {
  const [draft, setDraft] = useState(null);
  const cancelRef = useRef(false);
  const elRef = useRef(null);
  const current = value === null || value === undefined ? '' : String(value);
  const shown = draft ?? current;

  const handleBlur = () => {
    const v = draft;
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setDraft(null);
    if (cancelled || v === null || v === current) return;
    const res = onCommit(v);
    if (!refocusOnFail) return;
    Promise.resolve(res).then(ok => {
      // 빈칸이 거절된 경우(저장된 order# 비우기)는 살릴 글자가 없으니 원래 값으로 되돌림
      if (ok !== false || !v.trim()) return;
      setDraft(v);
      elRef.current?.focus();
    });
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;   // 한글 조합 중 Enter 무시
    if (e.key === 'Escape') {
      if (draft === null) return;            // 고친 게 없으면 ESC 는 창 닫기로 넘김
      e.stopPropagation();
      cancelRef.current = true;
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  if (multiline) {
    return (
      <textarea
        ref={elRef}
        value={shown}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLS} resize-y leading-snug ${className}`}
      />
    );
  }
  return (
    <input
      ref={elRef}
      type="text"
      value={shown}
      list={list}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={e => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${INPUT_CLS} ${className}`}
    />
  );
};

// 숫자 칸: 콤마 허용, 빈칸 확정 = null, 이상한 값(글자·음수)은 원래 값으로 되돌림
const NumberInput = ({ value, onCommit, placeholder = '', className = '', suffix = '', min = 0 }) => {
  const [draft, setDraft] = useState(null);
  const cancelRef = useRef(false);
  const cur = toNumberOrNull(value);
  const shown = draft ?? (cur === null ? '' : fmtKg(cur));

  const handleBlur = () => {
    const v = draft;
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setDraft(null);
    if (cancelled || v === null) return;
    const raw = v.trim();
    const next = raw === '' ? null : toNumberOrNull(raw);
    if (raw !== '' && (next === null || next < min)) return;
    if (next === cur) return;
    onCommit(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (draft === null) return;
      e.stopPropagation();
      cancelRef.current = true;
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLS} font-mono text-right ${suffix ? 'pr-12' : ''} ${className}`}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

// 날짜 칸: 올바른 날짜가 되는 즉시 확정. 지우기(빈값)는 입력 중 오작동을 막기 위해 blur 때 확정
// (iOS 는 빈 날짜 칸 높이가 줄어들어 min-h 지정)
const DateInput = ({ value, onCommit, className = '' }) => {
  const [draft, setDraft] = useState(null);
  const current = value || '';
  const shown = draft ?? current;

  const handleChange = (e) => {
    const v = e.target.value;
    if (isFullYmd(v)) {
      setDraft(null);
      if (v !== current) onCommit(v);
      return;
    }
    setDraft(v);
  };

  const handleBlur = () => {
    if (draft === null) return;
    const v = draft;
    setDraft(null);
    if (v === '' && current) onCommit('');
  };

  return (
    <input
      type="date"
      value={shown}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`${INPUT_CLS} min-h-[38px] md:min-h-0 ${className}`}
    />
  );
};

// 체크 칸: 클릭 즉시 확정
const CheckInput = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-1.5 shrink-0 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer select-none hover:bg-slate-50">
    <input
      type="checkbox"
      className="w-4 h-4 accent-teal-600"
      checked={!!checked}
      onChange={e => onChange(e.target.checked)}
    />
    {label}
  </label>
);

// ------------------------------------------------------------
// article# 칸: 직접 입력 + 원단 보관함 자동완성 (최대 8개)
//  - 목록에서 고르면 setFabric (article#·detail·gsm·폭 채움 + 연결)
//  - 그냥 확정하면 article# 글자만 저장
//  - ↑↓ 로 고르고 Enter 로 선택. 아무것도 안 골랐으면 Enter = 입력한 글자 확정
// ------------------------------------------------------------
const ArticleInput = ({ value, linked, savedFabrics, onCommitText, onPickFabric }) => {
  const [draft, setDraft] = useState(null);
  const [hi, setHi] = useState(-1);
  const cancelRef = useRef(false);
  const inputRef = useRef(null);
  const current = value || '';
  const shown = draft ?? current;
  const query = (draft ?? '').trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    return (savedFabrics || [])
      .filter(f => [f.article, f.itemName].some(v => String(v || '').toLowerCase().includes(query)))
      .slice(0, 8);
  }, [query, savedFabrics]);

  const open = draft !== null && matches.length > 0;
  const hiIdx = Math.min(hi, matches.length - 1);

  const pick = (fabric) => {
    cancelRef.current = true;
    setDraft(null);
    setHi(-1);
    onPickFabric(fabric);
    inputRef.current?.blur();
  };

  const handleBlur = () => {
    const v = draft;
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setDraft(null);
    setHi(-1);
    if (cancelled || v === null) return;
    const t = v.trim();
    if (t !== current) onCommitText(t);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (open && e.key === 'ArrowDown') {
      e.preventDefault();
      setHi(Math.min(hiIdx + 1, matches.length - 1));
      return;
    }
    if (open && e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(Math.max(hiIdx - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      if (draft === null) return;
      e.stopPropagation();
      cancelRef.current = true;
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && hiIdx >= 0) pick(matches[hiIdx]);
      else e.currentTarget.blur();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={shown}
        placeholder="article# 입력 또는 원단 검색"
        onChange={e => { setDraft(e.target.value); setHi(-1); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLS} font-mono ${linked ? 'pr-8' : ''}`}
      />
      {linked && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-500" title="원단 보관함 품번과 연결됨">
          <Link2 className="w-3.5 h-3.5" />
        </span>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto py-1">
          {matches.map((f, i) => (
            <div
              key={f.id || `${f.article}_${i}`}
              onMouseDown={e => { e.preventDefault(); pick(f); }}
              className={`px-2.5 py-1.5 cursor-pointer flex items-baseline gap-2 min-w-0 ${i === hiIdx ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
            >
              <span className="font-mono text-xs font-bold text-slate-800 shrink-0">{f.article || '-'}</span>
              <span className="text-[11px] text-slate-500 truncate">{f.itemName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 2. 공정 카드 (원사 ~ 외관검사, 오더 단위 일정 한 세트)
//    사용 중인 공정은 기본 펼침, 비어 있는 공정은 접힘
// ============================================================
const StepCard = ({ meta, step, order, open, onToggle, vendorOptions, onPatch }) => {
  const theme = PROCESS_THEME[meta.key] || PROCESS_THEME.yarn;
  const used = isStepUsed(step);
  const status = step.status || 'pending';
  const isKnit = meta.key === 'knitting';
  const est = isKnit ? getKnittingEstimatedEnd(order) : '';
  const totalWork = isKnit ? getOrderTotals(order).workKg : 0;
  const daily = toNumberOrNull(step.dailyKg);
  const rangeBad = !!(step.startDate && step.endDate && step.startDate > step.endDate);
  const listId = `od-vendors-${order.id}-${meta.key}`;

  // 접힌 머리줄 요약: 'M/D~M/D' (편직은 종료일 없으면 예상 종료)
  const endText = step.endDate ? shortDate(step.endDate) : est ? `${shortDate(est)} 예상` : '';
  const rangeText = step.startDate || endText ? `${shortDate(step.startDate)}~${endText}` : '';

  const commitText = (field) => (v) => {
    const t = v.trim();
    if (t !== (step[field] || '')) onPatch({ [field]: t });
  };

  const clearStep = () => {
    if (!window.confirm(`${meta.label} 공정에 입력한 내용을 모두 비울까요?`)) return;
    const patch = { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '' };
    if (isKnit) patch.dailyKg = null;
    onPatch(patch);
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${used ? 'border-slate-200' : 'border-dashed border-slate-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${used ? theme.cell : 'bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
        <span className="text-xs font-extrabold shrink-0">{meta.label}</span>
        {used ? (
          <span className="min-w-0 flex-1 flex items-center gap-1.5 text-[11px]">
            {step.vendor && <span className="font-bold truncate">{step.vendor}</span>}
            {rangeText && <span className="font-mono opacity-80 shrink-0">{rangeText}</span>}
          </span>
        ) : (
          <span className="flex-1 text-[11px] text-slate-300">미입력</span>
        )}
        {used && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${statusCls(status)}`}>
            {getStatusLabel(status)}
          </span>
        )}
      </button>

      {open && (
        <div className="p-3 bg-white border-t border-slate-100 grid grid-cols-2 gap-2.5">
          <Field label={meta.vendorLabel} className="col-span-2">
            <TextInput
              value={step.vendor}
              list={vendorOptions.length ? listId : undefined}
              placeholder={`${meta.vendorLabel} 입력`}
              onCommit={commitText('vendor')}
            />
            {vendorOptions.length > 0 && (
              <datalist id={listId}>
                {vendorOptions.map(v => <option key={v} value={v} />)}
              </datalist>
            )}
          </Field>

          <Field label="시작일">
            <DateInput value={step.startDate} onCommit={v => onPatch({ startDate: v })} />
          </Field>
          <Field label="종료일">
            <DateInput value={step.endDate} onCommit={v => onPatch({ endDate: v })} />
          </Field>
          {rangeBad && (
            <div className="col-span-2 flex items-center gap-1 text-[11px] font-bold text-red-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 시작일이 종료일보다 늦어요. 날짜를 확인해 주세요.
            </div>
          )}

          {isKnit && (
            <Field label="일일 생산량" className="col-span-2">
              <NumberInput value={step.dailyKg} suffix="kg/일" placeholder="예: 300" onCommit={n => onPatch({ dailyKg: n })} />
              {est ? (
                <div className="mt-1 flex items-center justify-between gap-2 flex-wrap text-[11px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-2 py-1">
                  <span>
                    예상 종료 <b className="font-mono">{shortDate(est)}</b>
                    <span className="text-yellow-700/80"> (총 작지 {fmtKg(totalWork)}kg ÷ {fmtKg(daily)}kg/일)</span>
                  </span>
                  {step.endDate !== est && (
                    <button type="button" onClick={() => onPatch({ endDate: est })} className={BTN_SUB}>
                      종료일에 넣기
                    </button>
                  )}
                </div>
              ) : daily ? (
                <div className="mt-1 text-[10px] text-slate-400">
                  {step.startDate ? '작지 kg이 없어 예상 종료일을 계산할 수 없어요.' : '시작일을 넣으면 예상 종료일을 계산해요.'}
                </div>
              ) : null}
            </Field>
          )}

          <Field label="상태" className="col-span-2">
            <Segment options={PROGRESS_STATUSES} value={status} colorOf={statusCls} onChange={k => onPatch({ status: k })} />
          </Field>
          {status === 'done' && (
            <Field label="완료일">
              <DateInput value={step.doneDate} onCommit={v => onPatch({ doneDate: v })} />
            </Field>
          )}

          <Field label="메모" className="col-span-2">
            <TextInput multiline value={step.notes} placeholder="특이사항" onCommit={commitText('notes')} />
          </Field>

          {used && (
            <div className="col-span-2 flex justify-end">
              <button type="button" onClick={clearStep} className={`${BTN_SUB} hover:text-red-600`}>
                <Eraser className="w-3 h-3" /> 공정 비우기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 3. 컬러 카드 (컬러명 · kg · 생지출고 · LOT · 컨펌 · 출고 · 현재 단계)
// ============================================================
const ColorCard = ({
  order, color, index, lossRate, single, autoFocusName,
  onPatch, onRemove, onOpenLots, onOpenConfirm,
}) => {
  const stageMeta = COLOR_STAGES[getColorStage(order, color)] || COLOR_STAGES.waiting;
  const manual = isWorkKgManual(color);
  const workKg = getWorkKg(color, lossRate);
  const autoWork = getWorkKg({ ...color, workKg: null }, lossRate);
  const lots = color.lots || [];
  const lotSum = getLotsTotalKg(lots);
  const lotStatus = getLotsStatus(lots);
  const lotMismatch = lots.length > 0 && workKg !== null && round1(lotSum) !== round1(workKg);
  const confirm = getConfirmState(color);
  const rounds = color.confirmRounds || [];
  const lastSent = rounds.length ? rounds[rounds.length - 1].sentDate : '';

  // 작지kg: 자동값 그대로면 저장 안 함, 비우면 자동으로 되돌림
  const commitWorkKg = (n) => {
    if (n === null) {
      if (manual) onPatch({ workKg: null });
      return;
    }
    if (!manual && n === autoWork) return;
    onPatch({ workKg: n });
  };

  const commitName = (v) => {
    const t = v.trim().toUpperCase();
    if (t !== (color.name || '')) onPatch({ name: t });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 머리줄: 번호 · 컬러명 · 현재 단계 · 삭제 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="w-5 h-5 rounded bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <TextInput
            value={color.name}
            autoFocus={autoFocusName}
            placeholder="컬러명 (예: BLACK)"
            className="!py-1 font-bold uppercase"
            onCommit={commitName}
          />
        </div>
        <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${stageMeta.cls}`}>
          {stageMeta.label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          title={single ? '컬러 줄 비우기 (마지막 1줄은 빈 줄로 남아요)' : '컬러 삭제'}
          className="shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2.5">
        {/* 수량 */}
        <Field label="오더 kg" hint={color.legacyYd ? `기존 오더 ${fmtKg(color.legacyYd)}야드` : undefined}>
          <NumberInput value={color.orderKg} suffix="kg" placeholder="0" onCommit={n => onPatch({ orderKg: n })} />
        </Field>
        <Field
          label={<>작지 kg <span className="font-normal text-slate-400">{manual ? '(직접 입력)' : `(자동 · 로스 ${fmtKg(lossRate)}%)`}</span></>}
          hint={manual && autoWork !== null && autoWork !== workKg ? `자동 계산 ${fmtKg(autoWork)}kg` : undefined}
        >
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <NumberInput
                value={workKg}
                suffix="kg"
                placeholder="자동"
                className={manual ? 'font-bold !text-slate-900' : '!text-slate-400'}
                onCommit={commitWorkKg}
              />
            </div>
            {manual && (
              <button
                type="button"
                onClick={() => onPatch({ workKg: null })}
                title="자동 계산으로 되돌리기 (오더kg × (1 + 로스율))"
                className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </Field>

        {/* 생지 출고 */}
        <Field label="생지 출고" className="col-span-2">
          <div className={`flex items-center gap-2 rounded-lg ${color.greigeOutDone ? `${PROCESS_THEME.greige.cell} p-1` : ''}`}>
            <div className="flex-1 min-w-0">
              <DateInput value={color.greigeOutDate} onCommit={v => onPatch({ greigeOutDate: v })} />
            </div>
            <CheckInput checked={color.greigeOutDone} label="출고" onChange={c => onPatch(doneWithDate(color, 'greigeOutDone', 'greigeOutDate', c))} />
          </div>
        </Field>

        {/* 염가공 LOT 요약 */}
        <div className={`col-span-2 rounded-lg border px-2.5 py-2 ${lots.length ? `${PROCESS_THEME.dyeing.cell} border-orange-200` : 'border-dashed border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-slate-500 min-w-0 truncate">
              염가공 LOT
              {order.dyeVendor && <span className="font-normal"> · {order.dyeVendor}</span>}
            </div>
            {onOpenLots && (
              <button type="button" onClick={onOpenLots} className={BTN_SUB}>
                {lots.length ? 'LOT 편집' : <><Plus className="w-3 h-3" /> LOT 계획</>}
              </button>
            )}
          </div>
          {lots.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-white/70 border border-orange-200 font-mono font-bold">{getLotSummary(lots)}</span>
              <span
                className={`font-mono ${lotMismatch ? 'text-orange-600 font-bold' : ''}`}
                title={lotMismatch ? 'LOT 합계가 작지 kg과 달라요' : undefined}
              >
                {lots.length} LOT · {kgOrDash(lotSum)} / {kgOrDash(workKg)} kg
              </span>
              {lotStatus && (
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${(PROGRESS_STATUS_COLORS[lotStatus] || PROGRESS_STATUS_COLORS.pending).dot}`} />
                  {getStatusLabel(lotStatus)}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-slate-400">LOT 계획이 아직 없어요.</div>
          )}
        </div>

        {/* 브랜드 컨펌 요약 (편집은 컨펌 팝오버) */}
        <div className={`col-span-2 rounded-lg border px-2.5 py-2 ${rounds.length ? 'bg-sky-50/60 border-sky-200' : 'border-dashed border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-slate-500">브랜드 컨펌</div>
            <button type="button" onClick={onOpenConfirm} className={BTN_SUB}>
              {confirm.key === 'none' ? <><Plus className="w-3 h-3" /> 컨펌</> : '컨펌 편집'}
            </button>
          </div>
          {confirm.key === 'none' ? (
            <div className="mt-1 text-[11px] text-slate-400">컨펌 기록이 없어요.</div>
          ) : (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${CONFIRM_STATE_CLS[confirm.key] || CONFIRM_STATE_CLS.ready}`}>
                {confirm.label}
              </span>
              {lastSent && <span className="text-[11px] text-slate-500 font-mono">{shortDate(lastSent)} 발송</span>}
            </div>
          )}
        </div>

        {/* 출고 */}
        <Field label="출고" className="col-span-2">
          <div className={`flex items-center gap-2 rounded-lg ${color.shipDone ? `${PROCESS_THEME.ship.cell} p-1` : ''}`}>
            <div className="flex-1 min-w-0">
              <DateInput value={color.shipDate} onCommit={v => onPatch({ shipDate: v })} />
            </div>
            <CheckInput checked={color.shipDone} label="완료" onChange={c => onPatch(doneWithDate(color, 'shipDone', 'shipDate', c))} />
          </div>
        </Field>
      </div>
    </div>
  );
};

// ============================================================
// 4. 변경 이력 (최신 5개 + 전체 보기). changeLog 는 최신이 맨 앞
// ============================================================
const ChangeLogSection = ({ changeLog }) => {
  const [expanded, setExpanded] = useState(false);
  const log = Array.isArray(changeLog) ? changeLog : [];
  const visible = expanded ? log : log.slice(0, 5);

  return (
    <Section
      icon={History}
      title={`변경 이력 (${log.length})`}
      right={log.length > 5 && (
        <button type="button" onClick={() => setExpanded(v => !v)} className="text-[11px] font-bold text-teal-700 hover:text-teal-900">
          {expanded ? '접기' : `전체 보기 (${log.length})`}
        </button>
      )}
    >
      {log.length === 0 ? (
        <div className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          아직 변경 이력이 없어요.
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          {visible.map((entry, i) => (
            <div key={entry.id || `log_${i}`} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 mt-0.5 text-slate-400">
                {entry.action === 'order_create' ? <FilePlus2 className="w-3.5 h-3.5 text-teal-600" /> : <Pencil className="w-3.5 h-3.5" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-700 break-words">
                  <span className="font-bold text-slate-500 mr-1">[{CHANGE_ACTIONS[entry.action] || '수정'}]</span>
                  {entry.summary || '-'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 break-all">
                  {entry.userEmail || '-'} · {fmtTs(entry.ts)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

// ============================================================
// 5. 상세창 본문 (order.id 가 바뀌면 key 로 새로 마운트 → 접힘/팝업 상태 초기화)
// ============================================================
const OrderDetailBody = ({
  order, isDraft, onClose, actions, masters,
  partners, savePartner, deletePartner, makeEmptyPartner,
  savedFabrics, onOpenLots,
}) => {
  const panelRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmColorId, setConfirmColorId] = useState(null);
  const [stepOpen, setStepOpen] = useState({});      // { [stepKey]: true/false } — 없으면 "사용 중이면 펼침"
  const [newColorId, setNewColorId] = useState(null); // 방금 추가한 컬러 → 컬러명 칸 자동 포커스
  const [deleting, setDeleting] = useState(false);

  // ESC 닫기 — 거래처 선택창이 떠 있으면 그것만 닫고,
  // 위에 다른 팝오버(컨펌·LOT 편집 등 role="dialog")가 떠 있으면 그 창이 ESC 를 처리하도록 양보
  // 리스너는 상세창이 열릴 때 한 번만 등록 (onClose·pickerOpen 은 ref 로 최신값 참조)
  //  → 항상 나중에 뜬 팝오버의 리스너보다 먼저 실행돼서, 팝오버가 아직 떠 있는 걸 보고 양보할 수 있음
  //    (다시 등록되면 팝오버 뒤로 밀려서 ESC 한 번에 팝오버와 상세창이 같이 닫혔음)
  const onCloseRef = useRef(onClose);
  const pickerOpenRef = useRef(pickerOpen);
  useEffect(() => {
    onCloseRef.current = onClose;
    pickerOpenRef.current = pickerOpen;
  }, [onClose, pickerOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (pickerOpenRef.current) {
        setPickerOpen(false);
        return;
      }
      const panel = panelRef.current;
      const others = [...document.querySelectorAll('[role="dialog"]')]
        .filter(el => el !== panel && !(panel && panel.contains(el)));
      if (others.length) return;
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const lossRate = getLossRate(order);
  const totals = getOrderTotals(order);
  const colors = order.colors || [];
  const confirmColor = confirmColorId ? colors.find(c => c.id === confirmColorId) || null : null;
  const usedStepCount = ORDER_STEPS.filter(m => isStepUsed(order.steps?.[m.key])).length;
  const canPickPartner = !!(savePartner && deletePartner && makeEmptyPartner);
  const typeLabel = ORDER_TYPES.find(t => t.key === order.type)?.label || '메인';
  const statusLabel = ORDER_STATUSES.find(s => s.key === order.status)?.label || '진행중';

  // ---------- 저장 헬퍼 ----------
  const setField = (field, value) => actions.setOrderField(order.id, field, value);
  const commitText = (field) => (v) => {
    const t = v.trim();
    if (t !== (order[field] || '')) setField(field, t);
  };
  const commitOrderNumber = (v) => {
    const t = v.trim().toUpperCase();
    if (t === (order.orderNumber || '')) return true;
    return setField('orderNumber', t);
  };

  const handlePickFabric = (fabric) => {
    if (fabric.id && fabric.id === order.linkedFabricId && fabric.article === order.articleNo) return;
    actions.setFabric(order.id, fabric);
  };

  const handleSelectPartner = (partner) => {
    const name = String(partner?.name || '').trim();
    if (name && name !== order.customer) setField('customer', name);
  };

  const handleAddColor = () => {
    const id = actions.addColor(order.id);
    if (id) setNewColorId(id);
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (isDraft) {
      const hasInput = !!(order.articleNo || order.detail || order.customer || order.notes || order.finalDueDate)
        || colors.some(colorHasData)
        || ORDER_STEPS.some(m => isStepUsed(order.steps?.[m.key]));
      if (hasInput && !window.confirm('입력 중인 새 오더를 삭제할까요?\n입력한 내용은 저장되지 않고 사라져요.')) return;
      actions.discardDraft(order.id);
      onClose?.();
      return;
    }
    setDeleting(true);
    const ok = await actions.deleteOrder(order.id);
    setDeleting(false);
    if (ok) onClose?.();
  };

  // z-[90]: 저장 결과 토스트(z-[100], "order# 중복" 등)가 상세창에 가려지지 않도록 한 단계 아래
  //         (컨펌·LOT 팝오버는 z-[200] 이라 그대로 위에 뜸)
  return (
    <ModalBackdrop
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-6"
      onClose={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="bg-white w-full md:max-w-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] md:h-auto md:max-h-[calc(100vh-48px)]"
      >
        {/* ---------- 헤더 ---------- */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 md:px-5 py-3 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-teal-100 mb-0.5 flex-wrap">
              <Package className="w-3.5 h-3.5" />
              <span className="font-mono font-bold text-white break-all">{order.orderNumber || '새 오더 (order# 미입력)'}</span>
              <span className="text-white/40">•</span>
              <span>{typeLabel}</span>
              <span className="text-white/40">•</span>
              <span>{statusLabel}</span>
            </div>
            <h3 className="text-base md:text-lg font-extrabold truncate">{order.articleNo || order.detail || '오더 상세'}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[11px] text-teal-50">
              {order.customer && <span className="inline-block align-bottom font-bold truncate max-w-[40vw]">{order.customer}</span>}
              <span className="font-mono">컬러 {colors.length} · 오더 {fmtKg(totals.orderKg) || 0}kg · 작지 {fmtKg(totals.workKg) || 0}kg</span>
              {order.status !== 'completed' && <DdayBadge dueDate={order.finalDueDate} />}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 bg-white/15 hover:bg-red-500 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {isDraft ? '줄 삭제' : '삭제'}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" title="닫기 (ESC)" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ---------- 본문 ---------- */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-5 space-y-6">
          {/* ① 기본정보 */}
          <Section icon={ClipboardList} title="기본정보">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="order#"
                hint={isDraft ? <span className="text-amber-600 font-bold">order#를 입력하면 저장돼요</span> : undefined}
              >
                <TextInput
                  value={order.orderNumber}
                  placeholder="order# 입력 (예: F-26M020)"
                  className="font-mono font-bold !text-teal-700 uppercase"
                  autoFocus={isDraft && !order.orderNumber}
                  refocusOnFail
                  onCommit={commitOrderNumber}
                />
              </Field>
              <Field label="구분">
                <Segment
                  options={ORDER_TYPES}
                  value={order.type}
                  colorOf={k => TYPE_CLS[k] || TYPE_CLS.main}
                  onChange={k => setField('type', k)}
                />
              </Field>

              <Field label="article#">
                <ArticleInput
                  value={order.articleNo}
                  linked={!!order.linkedFabricId}
                  savedFabrics={savedFabrics}
                  onCommitText={t => setField('articleNo', t)}
                  onPickFabric={handlePickFabric}
                />
              </Field>
              <Field label="buyer">
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <TextInput value={order.customer} placeholder="buyer 입력" onCommit={commitText('customer')} />
                  </div>
                  {canPickPartner && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      title="거래처에서 찾기"
                      className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Field>

              <Field label="detail" className="sm:col-span-2">
                <TextInput multiline value={order.detail} placeholder="원단 디테일 (조직·혼용·중량 등)" onCommit={commitText('detail')} />
              </Field>

              <Field label="납기">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <DateInput value={order.finalDueDate} onCommit={v => setField('finalDueDate', v)} />
                  </div>
                  {order.status !== 'completed' && <DdayBadge dueDate={order.finalDueDate} />}
                </div>
              </Field>
              <Field label="로스율" hint="작지 kg = 오더 kg × (1 + 로스율)">
                <NumberInput value={order.lossRate} suffix="%" placeholder="10" onCommit={n => setField('lossRate', n)} />
              </Field>

              <Field label="오더 상태" className="sm:col-span-2">
                <Segment options={ORDER_STATUSES} value={order.status} colorOf={orderStatusCls} onChange={k => setField('status', k)} />
              </Field>

              <Field label="메모" className="sm:col-span-2">
                <TextInput multiline rows={3} value={order.notes} placeholder="오더 메모" onCommit={commitText('notes')} />
              </Field>
            </div>
          </Section>

          {/* ② 공정 일정 */}
          <Section
            icon={Factory}
            title="공정 일정"
            right={<span className="text-[11px] text-slate-400">사용 {usedStepCount} / {ORDER_STEPS.length}</span>}
          >
            <div className="space-y-2">
              {ORDER_STEPS.map(meta => {
                const step = order.steps?.[meta.key] || {};
                const open = stepOpen[meta.key] ?? isStepUsed(step);
                const vendorOptions = [...new Set(
                  (masters?.[meta.vendorMaster] || []).map(v => String(v || '').trim()).filter(Boolean)
                )];
                return (
                  <StepCard
                    key={meta.key}
                    meta={meta}
                    step={step}
                    order={order}
                    open={open}
                    onToggle={() => setStepOpen(s => ({ ...s, [meta.key]: !open }))}
                    vendorOptions={vendorOptions}
                    onPatch={patch => actions.setStep(order.id, meta.key, patch)}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">칸을 채운 공정이 "사용하는 공정"이에요. 입력하면 바로 저장돼요.</p>
          </Section>

          {/* ③ 컬러 */}
          <Section
            icon={Palette}
            title={`컬러 (${colors.length})`}
            right={(
              <span className="text-[11px] text-slate-500 font-mono">
                오더 {fmtKg(totals.orderKg) || 0}kg · 작지 {fmtKg(totals.workKg) || 0}kg · 로스 {fmtKg(lossRate)}%
              </span>
            )}
          >
            <div className="space-y-3">
              {colors.map((c, i) => (
                <ColorCard
                  key={c.id}
                  order={order}
                  color={c}
                  index={i}
                  lossRate={lossRate}
                  single={colors.length === 1}
                  autoFocusName={c.id === newColorId}
                  onPatch={patch => actions.setColorField(order.id, c.id, patch)}
                  onRemove={() => actions.removeColor(order.id, c.id)}
                  onOpenLots={onOpenLots ? () => onOpenLots(order.id, c.id, null) : null}
                  onOpenConfirm={() => setConfirmColorId(c.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddColor}
              className="mt-2 w-full border-2 border-dashed border-teal-200 text-teal-700 hover:bg-teal-50 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 컬러 추가
            </button>
          </Section>

          {/* ④ 변경 이력 */}
          <ChangeLogSection changeLog={order.changeLog} />

          {/* ⑤ 등록 / 수정 시각 */}
          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-0.5 break-all">
            {isDraft ? (
              <div className="text-amber-600">아직 저장되지 않은 새 오더예요. order#를 입력하면 등록돼요.</div>
            ) : (
              <>
                <div>등록: {fmtTs(order.createdAt)}{order.createdBy ? ` (${order.createdBy})` : ''}</div>
                <div>수정: {fmtTs(order.updatedAt)}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------- 위에 뜨는 창들 ---------- */}
      {pickerOpen && (
        <PartnerPickerModal
          onClose={() => setPickerOpen(false)}
          partners={partners || []}
          onSelect={handleSelectPartner}
          savePartner={savePartner}
          deletePartner={deletePartner}
          makeEmptyPartner={makeEmptyPartner}
        />
      )}
      {confirmColor && (
        <ConfirmPopover
          key={confirmColor.id}
          order={order}
          color={confirmColor}
          anchorRect={null}
          onClose={() => setConfirmColorId(null)}
          onSave={rounds => actions.setColorField(order.id, confirmColor.id, { confirmRounds: rounds })}
        />
      )}
    </ModalBackdrop>
  );
};

// ============================================================
// 6. 내보내기 — order 가 없으면 아무것도 그리지 않음
// props: { order, isDraft, onClose, actions, masters, partners, savePartner, deletePartner,
//          makeEmptyPartner, savedFabrics, onOpenLots?(orderId, colorId, null) }
// ============================================================
export const OrderDetailModal = (props) => {
  if (!props.order) return null;
  return <OrderDetailBody key={props.order.id} {...props} />;
};
