import { useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Search, Link2, RotateCcw, MoreHorizontal, Eye, EyeOff, ChevronDown, FileSpreadsheet, ListPlus,
} from 'lucide-react';
import {
  PROCESS_THEME, PROGRESS_STATUS_COLORS, PROGRESS_STATUS_OPTIONS, getStatusLabel, COLOR_STAGES,
  DEFAULT_LOSS_RATE, PROVISIONAL_DUE_STEPS, PROVISIONAL_STATES, GREIGE_OUT_KINDS,
  TEST_REPORT_STATUSES, BRAND_CONFIRM_STATUSES, INSPECTION_STATUSES, DYE_METHODS, CLOSING_ITEMS, PRESETTING_KEY,
  DYE_REMAIN_STATES, YARN_ORDER_STATUSES, YARN_DYEING_KEY, DONE_TONE, buildFlowOrder, findStepMeta, getStepDefs, isCustomStepKey,
} from '../../../constants/production';
import {
  getWorkKg, isWorkKgManual, getLossRate, isStepUsed, getKnittingEstimatedEnd, getEndShift, colorHasData,
  getLotOverview, getLotsStatus, getColorStage, getDday, getTrackEvent, isTestReportPassed,
  isInspectionUsed, getColorInspection, getRoundStatusDate, getDyeYield, getColorDyeRemain, describeDyeRemain,
  getProvisionalDueInfo, describeProvisionalDue, describeStepCurrent, isDropClosed, getGreigeState, collectVendorOptions,
  isPieceDyed, getClosingState, isClosingPending, isShippingDone,
  getYarnState, getYarnRowInfo, canUseYarnDyeing,
} from '../../../utils/orderModel';
import { shortDate, fmtKg, todayYmd } from '../../../utils/orderCalculations';
import { CellText, CellNumber, CellDate, CellCheck, CellAction } from './SheetCells';
import { OrderMenuPopover } from './OrderMenuPopover';
import { ProcessPopover } from './ProcessPopover';
import { ConfirmPopover } from './ColorPopovers';
import { ProvisionalDuePopover } from './ProvisionalDuePopover';
import { GreigeOutPopover } from './GreigeOutPopover';
import { InspectionPopover } from './InspectionPopover';
import { ClosingPopover } from './ClosingPopover';
import { YarnPopover } from './YarnPopover';
import { PresettingChip } from '../common/PresettingChip';
import { YarnDyeChip } from '../common/YarnDyeChip';
import { SheetLinkChips } from '../common/SheetLinkChips';
import { StatusSelect } from '../common/StatusSelect';
import { OrderKindChip, OrderKindTodoChip } from '../common/OrderKindChip';
import { AddOrderMenu } from '../common/AddOrderMenu';
import { StepManagerPopover } from './StepManagerPopover';
import { PartnerPickerModal } from '../../common/PartnerPickerModal';

// ============================================================
// 생산 현황표 (엑셀형) — 한 줄 = 컬러 1개, 오더 단위 칸은 rowSpan
// ------------------------------------------------------------
// - 칸을 클릭하거나 Tab 으로 이동하면 바로 입력 (Enter 확정 후 아래 칸, Esc 취소)
// - 공정·컨펌 칸은 클릭하면 팝오버, 염가공 LOT 칸은 onOpenLots 로 LOT 편집 열기
// - 왼쪽 5칸(order#~color) 고정, 나머지 가로 스크롤. 공정/컬러 칸은 보이기/숨기기 가능
// - 초안(order# 입력 전 새 줄)은 저장된 오더 다음에 같은 목록(key=order.id)으로 렌더
//   → order# 를 입력해 저장돼도 줄이 다시 마운트되지 않아 입력 흐름이 끊기지 않음
// - 구분(메인 · 신제품 · 재샘플 — 2026-10-19): 새 줄만 드롭다운, 저장된 오더는 표시만 (바꾸려면 ⋯ 메뉴 [구분 바꾸기])
//   '종류 미정'을 누르면 고르는 창 · '설계서 없음'을 누르면 ⋯ 메뉴 · 재샘플 '아이템 선택'은 article# 칸
//   [+ 오더 추가]는 구분을 고르는 메뉴 (AddOrderMenu)
// - 모든 저장은 actions(useOrder 의 orderActions)로만
// ============================================================

// ============================================================
// 1. 칸 정의
// ============================================================
// 왼쪽 고정 칸 (엑셀 머리글 그대로)
const LEFT_COLS = [
  { key: 'orderNumber', label: 'order#',   width: 96 },
  { key: 'articleNo',   label: 'article#', width: 84 },
  { key: 'detail',      label: 'detail',   width: 130 },
  { key: 'customer',    label: 'buyer',    width: 84 },
  { key: 'color',       label: 'color',    width: 84 },
];

// 수량·납기·가납기 (항상 표시)
const QTY_COLS = [
  { key: 'orderKg',     label: '오더kg', width: 70, align: 'right' },
  { key: 'workKg',      label: '생지kg', width: 78, align: 'right' },
  { key: 'due',         label: '납기',   width: 96 },
  { key: 'provisional', label: '가납기', width: 150, title: '원사·편직·염가공·외관검사 대략적인 목표 날짜 — 지금 일정과 비교' },
];

// 공정/컬러 칸 (보이기/숨기기 가능). step = 오더 단위 공정 칸(rowSpan)
//  순서는 constants FLOW_ORDER + 대표님이 추가한 공정 (buildFlowOrder). '#' 칸 = 컬러별 칸
const STEP_COL_WIDTH = 140;
const STEP_SHORT_LABELS = { physical_test: '이화학' }; // 좁은 머리글용
//  '#closing' 마무리는 오더 단위 칸(rowSpan) — 원사재고정리 · EZTEX 재고정리 · EZTEX 종결 (2026-10-14)
//  '#yarn' 원사도 오더 단위 칸(rowSpan) — 사종마다 상태 · 재고 사용 · 원사염색 (2026-10-14 v11)
const COLOR_COLS = {
  '#yarn':    { key: 'yarn',    label: '원사',       width: 190 },
  '#greige':  { key: 'greige',  label: '생지출고',   width: 132 },
  '#dyeing':  { key: 'dyeing',  label: '염가공 LOT', width: 170 },
  '#confirm': { key: 'confirm', label: '컨펌 · 성적서', width: 172 },
  '#inspection': { key: 'inspection', label: '외관검사 (LOT)', width: 196 },
  '#ship':    { key: 'ship',    label: '출고',       width: 116 },
  '#closing': { key: 'closing', label: '마무리',     width: 150 },
};
const TAIL_COLS = [
  { key: 'stage', label: '상태', width: 84 },
  { key: 'memo',  label: '메모', width: 180 },
];

const buildFlowCols = (customSteps, stepDefs) => [
  ...buildFlowOrder(customSteps).map(tok => {
    if (tok.startsWith('#')) return COLOR_COLS[tok] || null;
    const meta = findStepMeta(stepDefs, tok);
    if (!meta) return null;
    return { key: tok, label: STEP_SHORT_LABELS[tok] || meta.label, width: STEP_COL_WIDTH, step: true, custom: isCustomStepKey(tok) };
  }).filter(Boolean),
  ...TAIL_COLS,
];

// 고정 칸 left 위치 (누적 폭)
const LEFT_OFFSET = LEFT_COLS.reduce((acc, c, i) => {
  acc[c.key] = i === 0 ? 0 : acc[LEFT_COLS[i - 1].key] + LEFT_COLS[i - 1].width;
  return acc;
}, {});
const LEFT_TOTAL = LEFT_COLS.reduce((s, c) => s + c.width, 0);

// 컬럼 숨김 저장 (브라우저별). 처음엔 자주 안 쓰는 공정 숨김
//  원사 칸은 v11 부터 기본으로 보임 (대표님 요청 2026-10-14) — 예전에 숨겨 둔 PC도 한 번은 보이게 (LS_YARN_SHOWN)
const LS_HIDDEN_COLS = 'grubig.production.sheet.hiddenCols.v8';
const LS_YARN_SHOWN = 'grubig.production.sheet.yarnShown.v11';
const DEFAULT_HIDDEN = ['yarn_processing', 'finishing', 'physical_test'];

// 추가 공정 칸 key 도 들어 있을 수 있어서 지금 칸 목록으로 거르지 않음 (설정이 늦게 와도 숨김이 풀리지 않게)
const loadHiddenCols = () => {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_COLS);
    if (raw === null) {
      // 처음 쓰는 PC — 기본값에 원사가 이미 보이므로 '한 번 보이게'는 끝난 것으로 (나중에 숨긴 원사를 다시 펴지 않게)
      localStorage.setItem(LS_YARN_SHOWN, '1');
      return DEFAULT_HIDDEN;
    }
    const arr = JSON.parse(raw);
    let list = Array.isArray(arr) ? arr.filter(k => typeof k === 'string') : DEFAULT_HIDDEN;
    if (!localStorage.getItem(LS_YARN_SHOWN)) {
      list = list.filter(k => k !== 'yarn');
      localStorage.setItem(LS_YARN_SHOWN, '1');
      localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify(list));
    }
    return list;
  } catch {
    return DEFAULT_HIDDEN;
  }
};

// 컬러가 하나도 없는 비정상 오더용 빈 줄 (normalizeOrder 가 보통 1줄을 보장함)
const FALLBACK_COLORS = [{ id: '__no_color', name: '', orderKg: null, workKg: null, lots: [], confirmRounds: [] }];

// ============================================================
// 2. 스타일 / 표시 헬퍼
// ============================================================
// 칸 공통: 위쪽 정렬 + 오른쪽 선 + 아래 선(오더 경계는 굵게, 같은 오더 컬러 줄 사이는 얇게)
const cellCls = ({ thick = false, lastSticky = false, extra = '' } = {}) => [
  'align-top px-1.5 py-1 text-[11px] leading-snug',
  lastSticky
    ? 'border-r-2 border-r-slate-300 md:shadow-[3px_0_5px_-3px_rgba(15,23,42,0.3)]'
    : 'border-r border-r-slate-200',
  thick ? 'border-b-2 border-b-slate-300' : 'border-b border-b-slate-100',
  extra,
].join(' ');

// 끝난 것(종결) = 회색 (대표님 요청 2026-10-14 '종결된 건 회색으로 통일')
//  완료된 오더(마무리 끝 · Drop)는 모든 칸, 진행 중인 오더는 끝난 칸만 (done) — 아니면 원래 색(tone)
const isClosedOrder = (order) => order?.status === 'completed';
const doneTone = (order, done, tone) => (isClosedOrder(order) || done ? DONE_TONE.cell : tone);

// 왼쪽 고정 칸: 좁은 화면(md 미만)에서는 고정하지 않음 → 고정 칸이 화면을 다 가리지 않게
const STICKY = 'relative md:sticky md:left-[var(--sl)] md:z-10';
const stickyStyle = (key) => ({ '--sl': `${LEFT_OFFSET[key]}px` });

// 클릭하면 팝오버가 열리는 칸
const CLICKABLE = 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-teal-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-teal-400';

const TH = 'sticky top-0 z-20 bg-slate-100 border-b border-b-slate-300 px-1.5 py-1.5 text-left text-[11px] font-extrabold text-slate-600 whitespace-nowrap';

const BADGE = 'inline-flex items-center px-1.5 py-px rounded-full border text-[10px] font-bold whitespace-nowrap';

// 'M/D~M/D' (한쪽만 있으면 'M/D~' / '~M/D')
const fmtRange = (start, end) => {
  if (!start && !end) return '';
  if (start && end) return `${shortDate(start)}~${shortDate(end)}`;
  return start ? `${shortDate(start)}~` : `~${shortDate(end)}`;
};

// 완료 체크 시 날짜가 비어 있으면 오늘 날짜도 함께 채움 (간트에 표시되도록)
const doneWithDate = (color, doneKey, dateKey, done) => (
  done && !color[dateKey] ? { [doneKey]: true, [dateKey]: todayYmd() } : { [doneKey]: done }
);

// 칸의 빈 곳(여백)을 클릭해도 그 칸 입력 시작
// (이미 포커스가 있는 표시칸이면 focus 이벤트가 다시 안 오므로 click 으로 편집 시작)
const focusInside = (e) => {
  if (e.target !== e.currentTarget) return;
  const el = e.currentTarget.querySelector('[tabindex="0"], input');
  if (!el) return;
  if (el !== document.activeElement) el.focus();
  else if (el.tagName !== 'INPUT') el.click();
};

// 팝오버를 닫은 뒤 포커스를 되돌릴 칸 (키보드로 계속 이동할 수 있게)
const cellFocusTarget = (cell) => cell?.querySelector?.('[data-nav]') || null;

// ============================================================
// 3. 작은 표시 컴포넌트
// ============================================================
// 납기 D-day: 지남=빨강 깜빡임, 오늘=D-Day, 7일 이내 빨강, 14일 이내 주황, 그 외 회색
const DdayBadge = ({ due }) => {
  const d = getDday(due);
  if (d === null) return null;
  let cls = 'bg-slate-100 text-slate-500 border-slate-200';
  let label = `D-${d}`;
  if (d < 0) {
    cls = 'bg-rose-600 text-white border-rose-600 animate-pulse';
    label = `D+${-d}`;
  } else if (d === 0) {
    cls = 'bg-rose-500 text-white border-rose-500';
    label = 'D-Day';
  } else if (d <= 7) {
    cls = 'bg-red-100 text-red-700 border-red-300';
  } else if (d <= 14) {
    cls = 'bg-orange-100 text-orange-700 border-orange-300';
  }
  return <span className={`${BADGE} font-extrabold ${cls}`}>{label}</span>;
};

// 최초 예상 종료일 대비 지금 예상 종료일 (예상 종료일을 바꾼 적이 있을 때만) — '최초 10/28 +8일'
const EndShiftBadge = ({ step }) => {
  const shift = getEndShift(step);
  if (!shift) return null;
  const d = shift.diff;
  const cls = d > 0 ? 'text-red-600' : d < 0 ? 'text-emerald-700' : 'text-slate-500';
  const tail = d > 0 ? ` +${d}일` : d < 0 ? ` ${d}일` : '';
  return (
    <div
      className={`font-mono text-[9px] font-bold ${cls}`}
      title={`예상 종료일을 ${shift.count}번 바꿨어요 — 최초 예상 ${shift.first}${shift.current ? ` → 지금 ${shift.current}` : ''}`}
    >
      최초 {shortDate(shift.first)}{tail}
    </div>
  );
};

// 공정 칸 내용: 외주처 / 예상 일정 (+ 최초 예상 대비) / 상태 드롭다운 / (편직) 하루 생산량 / 메모
const StepSummary = ({ order, stepKey, step, onStatus }) => {
  const status = step.status || 'pending';
  const estimated = stepKey === 'knitting' && !step.endDate ? getKnittingEstimatedEnd(order) : '';
  const end = step.endDate || estimated;
  const range = fmtRange(step.startDate, end);
  // 완료(또는 Drop)로 닫힌 오더는 '지연' 빨간색 안 씀 — 끝난 오더에 남은 공정 일정은 늦은 게 아님
  const overdue = !!end && status !== 'done' && order.status !== 'completed' && end < todayYmd();
  const machines = stepKey === 'knitting' ? (step.machines || []).filter(m => m.dailyKg) : [];
  return (
    <div className="space-y-0.5">
      {step.vendor && <div className="font-bold break-words [overflow-wrap:anywhere]">{step.vendor}</div>}
      {range && (
        <div
          className={`font-mono text-[10px] ${overdue ? 'text-red-600 font-bold' : ''}`}
          title={overdue ? '예상 종료일이 지났는데 완료되지 않았어요' : `예상 ${range}${estimated ? ' (종료일은 생산량 계산)' : ''}`}
        >
          {range}{estimated ? ' 계산' : ''}
        </div>
      )}
      <EndShiftBadge step={step} />
      <div className="flex items-center gap-1 flex-wrap">
        <StatusSelect
          value={status}
          options={PROGRESS_STATUS_OPTIONS}
          onChange={onStatus}
          tabIndex={-1}
          title="상태 바꾸기 (바로 저장)"
        />
        {status === 'done' && step.doneDate && <span className="font-mono text-[9px] opacity-70">{shortDate(step.doneDate)}</span>}
        {stepKey === 'knitting' && step.dailyKg ? (
          <span
            className="text-[9px] opacity-70"
            title={machines.map(m => `${m.name || '기계'} ${fmtKg(m.dailyKg)}kg/일`).join('\n') || undefined}
          >
            {fmtKg(step.dailyKg)}kg/일{machines.length > 1 ? ` · ${machines.length}대` : ''}
          </span>
        ) : null}
      </div>
      {step.notes && (
        <div className="text-[10px] opacity-75 whitespace-pre-wrap line-clamp-2" title={step.notes}>{step.notes}</div>
      )}
    </div>
  );
};

// 공정 칸 (오더 단위, rowSpan) — 클릭하면 ProcessPopover, 상태는 칸 안 드롭다운으로 바로
const StepCell = ({ order, stepKey, span, bg, ctx }) => {
  const step = order.steps?.[stepKey];
  const used = isStepUsed(step);
  const meta = ctx.stepMetaOf(stepKey);
  const label = meta?.label || '';
  const theme = PROCESS_THEME[stepKey] || PROCESS_THEME.custom;
  const open = (el) => ctx.openProcess(order.id, stepKey, el);
  return (
    <td
      rowSpan={span}
      onClick={e => open(e.currentTarget)}
      className={cellCls({ thick: true, extra: `${CLICKABLE} ${used ? doneTone(order, step.status === 'done', theme.cell) : bg}` })}
    >
      <CellAction navKey={`step_${stepKey}`} onActivate={open} title={`${label} 일정 입력 (클릭 또는 Enter)`}>
        {used
          ? <StepSummary order={order} stepKey={stepKey} step={step} onStatus={s => ctx.actions.setStep(order.id, stepKey, { status: s })} />
          : <span className="text-slate-300">+ 입력</span>}
      </CellAction>
    </td>
  );
};

// 가납기 칸 (오더 단위, rowSpan) — 넣은 공정만 한 줄씩 '편직 10/25 [3일 늦음]', 클릭하면 ProvisionalDuePopover
const ProvisionalCell = ({ order, span, bg, ctx }) => {
  const lines = PROVISIONAL_DUE_STEPS
    .map(s => ({ meta: s, info: getProvisionalDueInfo(order, s.key) }))
    .filter(x => x.info.due);
  const open = (el) => ctx.openProvisional(order.id, el);
  return (
    <td rowSpan={span} onClick={e => open(e.currentTarget)} className={cellCls({ thick: true, extra: `${CLICKABLE} ${bg}` })}>
      <CellAction navKey="provisional" onActivate={open} title="가납기 입력 (클릭 또는 Enter)">
        {lines.length ? (
          <div className="space-y-0.5">
            {lines.map(({ meta, info }) => {
              const desc = describeProvisionalDue(info);
              const st = PROVISIONAL_STATES[info.state] || PROVISIONAL_STATES.none;
              return (
                <div
                  key={meta.key}
                  className="flex items-center gap-1 min-w-0"
                  title={`${meta.label} 가납기 ${info.due} · 현재 ${describeStepCurrent(info)}${desc.text ? ` → ${desc.text}` : ''}`}
                >
                  <span className="w-8 shrink-0 text-[10px] font-bold text-slate-500">{meta.short}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-700">{shortDate(info.due)}</span>
                  {order.provisionalPlan?.days?.[meta.key] !== null && order.provisionalPlan?.days?.[meta.key] !== undefined && (
                    <span className="shrink-0 text-[9px] text-slate-400" title="앞 공정 가납기(첫 공정은 기준일)부터 일수">
                      {order.provisionalPlan.days[meta.key]}일
                    </span>
                  )}
                  {desc.text && (
                    <span className={`min-w-0 truncate px-1 py-px rounded-full border text-[9px] font-bold ${st.chip}`}>{desc.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-slate-300">+ 가납기</span>
        )}
      </CellAction>
    </td>
  );
};

// 생지 출고 줄 목록 (현황표 칸 공용) — 출고마다 한 줄 (체크 · 전체/부분 · 날짜 · kg · 메모)
const GreigeLines = ({ entries, onDone, max = 3 }) => {
  const shown = entries.slice(0, max);
  return (
    <div className="space-y-0.5">
      {shown.map(g => {
        const kind = GREIGE_OUT_KINDS.find(k => k.key === g.kind) || GREIGE_OUT_KINDS[0];
        return (
          <div key={g.id} className="flex items-center gap-1 min-w-0" title={`${kind.label} ${g.date || '날짜 미입력'}${g.kg ? ` ${fmtKg(g.kg)}kg` : ''}${g.memo ? ` — ${g.memo}` : ''}`}>
            <input
              type="checkbox"
              checked={!!g.done}
              tabIndex={-1}
              onClick={e => e.stopPropagation()}
              onChange={e => onDone(g.id, e.target.checked)}
              className="w-3 h-3 shrink-0 accent-lime-600 cursor-pointer"
              title="출고 체크 (바로 저장 — 날짜가 비었으면 오늘)"
              aria-label={`${kind.label} 출고 체크`}
            />
            <span className={`shrink-0 px-1 rounded border text-[9px] font-bold ${g.done ? DONE_TONE.chip : kind.cls}`}>{kind.short}</span>
            <span className="shrink-0 font-mono text-[10px]">{g.date ? shortDate(g.date) : '날짜?'}</span>
            {g.kg ? <span className="shrink-0 font-mono text-[9px] opacity-80">{fmtKg(g.kg)}kg</span> : null}
            {g.memo && <span className="min-w-0 truncate text-[9px] opacity-70">{g.memo}</span>}
          </div>
        );
      })}
      {entries.length > shown.length && <div className="text-[9px] opacity-70">+{entries.length - shown.length}건 더</div>}
    </div>
  );
};

// 생지 출고 칸 — 선염(·안 고름)은 컬러마다, 후염은 오더에 한 번 (rowSpan — 대표님 요청 2026-10-14)
//  체크 = 바로 저장 / 칸을 누르면 생지 출고 창 (선염·후염 고르기 포함)
const GreigeCell = ({ order, color, last, bg, ctx, span = 1 }) => {
  const piece = isPieceDyed(order);
  const st = getGreigeState(piece ? order : color);
  const entries = st.entries;
  const open = (el) => ctx.openGreige(order.id, piece ? null : color.id, el);
  // 끝 = 전체 출고 끝 · 또는 그 컬러(후염은 오더 전체) 출고 완료 → 회색
  const shipped = piece ? isShippingDone(order) : !!color.shipDone;
  const tone = doneTone(order, st.fullDone || shipped, st.partialDone ? 'bg-lime-50 text-lime-900' : bg);
  const onDone = (entryId, done) => (piece
    ? ctx.actions.setOrderGreigeOutDone(order.id, entryId, done)
    : ctx.actions.setGreigeOutDone(order.id, color.id, entryId, done));
  return (
    <td
      rowSpan={piece ? span : undefined}
      onClick={e => open(e.currentTarget)}
      className={cellCls({ thick: piece || last, extra: `${CLICKABLE} ${tone}` })}
    >
      <CellAction navKey="greige" onActivate={open} title={`생지 출고 — ${piece ? '후염: 오더 전체 한 번에' : '컬러마다'} · 전체/부분 (클릭 또는 Enter)`}>
        {piece && <div className="mb-0.5 text-[9px] font-extrabold text-sky-700">후염 · 오더 전체</div>}
        {entries.length === 0
          ? <span className="text-slate-300">+ 생지 출고</span>
          : <GreigeLines entries={entries} onDone={onDone} max={piece ? 5 : 3} />}
        {st.doneKg ? <div className="text-[9px] font-mono opacity-70">출고 {fmtKg(st.doneKg)}kg</div> : null}
      </CellAction>
    </td>
  );
};

// 염가공 LOT 칸 (컬러 단위) — onOpenLots 가 있을 때만 클릭 가능
//  LOT 개수 · 완료 · 투입~완료예정 · 배색량 합계 → 예상 YD (LOSS 뺀) · 남은 배색량(생지kg − 배색 합계) · 프리세팅(오더 공통)
const LotCell = ({ order, color, last, bg, ctx }) => {
  const lots = color.lots || [];
  const has = lots.length > 0;
  const canOpen = !!ctx.openLots;
  const open = (el) => ctx.openLots(order.id, color.id, el.getBoundingClientRect());

  const ov = getLotOverview(lots);
  const status = getLotsStatus(lots);
  const range = fmtRange(ov.start, ov.end);
  const y = ov.dyeKg ? getDyeYield(ov.dyeKg, getLossRate(order), ctx.yieldSpecOf?.(order) || null) : null;
  const remain = getColorDyeRemain(order, color);
  // 끝 = LOT 모두 완료(재가공 중이면 아님) · 또는 그 컬러 출고 완료 → 회색
  const lotsDone = status === 'done' && !getColorInspection(color).anyRedye;
  const tooltip = has
    ? lots.map(l => `LOT${l.no} · ${getStatusLabel(l.status)}${l.startDate || l.endDate ? ` · ${fmtRange(l.startDate, l.endDate)}` : ''}${l.dyeKg ? ` · 배색 ${fmtKg(l.dyeKg)}kg` : ''}${l.notes ? ` · ${l.notes}` : ''}`).join('\n')
    : (canOpen ? '염가공 LOT 계획 입력' : undefined);

  return (
    <td
      onClick={canOpen ? e => open(e.currentTarget) : undefined}
      className={cellCls({ thick: last, extra: `${has ? doneTone(order, lotsDone || color.shipDone, PROCESS_THEME.dyeing.cell) : bg} ${canOpen ? CLICKABLE : ''}` })}
    >
      <CellAction navKey="lots" onActivate={canOpen ? open : undefined} disabled={!canOpen} title={tooltip}>
        <PresettingChip order={order} className="mb-0.5" />
        {has ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 min-w-0">
              {status && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${PROGRESS_STATUS_COLORS[status]?.dot || 'bg-slate-400'}`}
                  title={getStatusLabel(status)}
                />
              )}
              <span className="font-bold text-[10px]">LOT {ov.count}개</span>
              <span className="text-[10px] opacity-80">· 완료 {ov.done}</span>
            </div>
            {(ov.inProgress > 0 || ov.issue > 0) && (
              <div className="text-[10px] opacity-80">
                {ov.inProgress > 0 ? `진행 ${ov.inProgress}` : ''}{ov.inProgress > 0 && ov.issue > 0 ? ' · ' : ''}
                {ov.issue > 0 ? <b className="text-red-600">문제 {ov.issue}</b> : null}
              </div>
            )}
            {range && <div className="font-mono text-[10px] opacity-70">{range}</div>}
            {y && (
              <div className="font-mono text-[9px] leading-tight" title={`배색량 합계 ${fmtKg(ov.dyeKg)}kg → LOSS ${fmtKg(getLossRate(order))}% 뺀 예상 가공지 ${fmtKg(y.finishedKg)}kg${y.yd !== null ? ` · ${y.yd.toLocaleString()}YD` : ' (원단 스펙이 없어 YD 계산 전)'}`}>
                배색 {fmtKg(ov.dyeKg)}kg → {y.yd !== null ? `${y.yd.toLocaleString()}YD` : `${fmtKg(y.finishedKg)}kg`}
              </div>
            )}
            {remain && (
              <div
                className={`text-[10px] font-bold leading-tight ${DYE_REMAIN_STATES[remain.state].text}`}
                title={`생지 ${fmtKg(remain.greigeKg)}kg − 배색 ${fmtKg(remain.dyeKg)}kg`}
              >
                {describeDyeRemain(remain)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-300">{canOpen ? '+ LOT 계획' : '-'}</span>
        )}
      </CellAction>
    </td>
  );
};

// 컨펌 칸 (컬러 단위) — 시험성적서(체크 + 상태) · 브랜드 컨펌(상태). 드롭다운 = 바로 저장(그날 날짜로 기록)
//  칸을 누르면 ConfirmPopover (발행 예상일 · 날짜 · 기록 고치기)
const TEST_OPTIONS = TEST_REPORT_STATUSES;
const BRAND_OPTIONS = BRAND_CONFIRM_STATUSES;
const ConfirmCell = ({ order, color, last, bg, ctx }) => {
  const open = (el) => ctx.openConfirm(order.id, color.id, el);
  const needed = !!color.testReport?.needed;
  const testEv = getTrackEvent(color, 'testReport');
  const brandEv = getTrackEvent(color, 'brandConfirm');
  const expected = color.testReport?.expectedDate || '';
  const expectedLate = needed && expected && !isTestReportPassed(color) && expected < todayYmd();
  const addEvent = (track) => (status) => ctx.actions.addTrackEvent(order.id, color.id, track, status);
  // 끝 = 브랜드 컨펌 + (체크한 컬러는) 성적서 합격 · 또는 그 컬러 출고 완료 → 회색
  const confirmDone = brandEv?.status === 'confirmed' && isTestReportPassed(color);
  return (
    <td onClick={e => open(e.currentTarget)} className={cellCls({ thick: last, extra: `${CLICKABLE} ${doneTone(order, confirmDone || color.shipDone, bg)}` })}>
      <CellAction navKey="confirm" onActivate={open} title="시험성적서 · 브랜드 컨펌 — 누르면 날짜·기록 수정 (드롭다운은 바로 저장)">
        <div className="space-y-1">
          {/* 시험성적서 */}
          <div className="flex items-center gap-1 flex-wrap">
            <label
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 cursor-pointer select-none"
              title="이 컬러는 시험성적서가 필요해요 (체크 = 바로 저장)"
            >
              <input
                type="checkbox"
                tabIndex={-1}
                checked={needed}
                onChange={e => ctx.actions.setColorTracks(order.id, color.id, { testReport: { needed: e.target.checked } })}
                className="w-3 h-3 accent-fuchsia-600 cursor-pointer"
              />
              성적서
            </label>
            {needed && (
              <StatusSelect
                value={testEv?.status || ''}
                options={TEST_OPTIONS}
                onChange={addEvent('testReport')}
                placeholder="상태"
                tabIndex={-1}
                title="시험성적서 상태 (바꾸면 오늘 날짜로 기록)"
              />
            )}
          </div>
          {needed && (testEv?.date || expected) && (
            <div className="font-mono text-[9px] text-slate-500">
              {testEv?.date ? shortDate(testEv.date) : ''}
              {expected && (
                <span className={expectedLate ? 'text-red-600 font-bold' : ''} title={expectedLate ? '발행 예상일이 지났어요' : '발행 예상일'}>
                  {testEv?.date ? ' · ' : ''}예정 {shortDate(expected)}
                </span>
              )}
            </div>
          )}
          {/* 브랜드 컨펌 */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold text-slate-600">브랜드</span>
            <StatusSelect
              value={brandEv?.status || ''}
              options={BRAND_OPTIONS}
              onChange={addEvent('brandConfirm')}
              placeholder="상태"
              tabIndex={-1}
              title="브랜드 컨펌 상태 (바꾸면 오늘 날짜로 기록)"
            />
            {brandEv?.date && <span className="font-mono text-[9px] text-slate-500">{shortDate(brandEv.date)}</span>}
          </div>
        </div>
      </CellAction>
    </td>
  );
};

// 외관검사 칸 (컬러 단위 · LOT 마다 한 줄 — 대표님 요청 2026-10-14)
//  'LOT1 2차 [검사중 ▾] 10/12' — 드롭다운 = 바로 저장 (지금 차수에 오늘 날짜로 기록, '투입 전'으로 되돌리기,
//  '재가공'이면 다음 차수 줄 자동, LOT 가 모두 출고완료면 출고 칸도 완료)
//  칸을 누르면 InspectionPopover (검사처 · 차수마다 예상 시작/종료일 · 상태 · 메모 · 기록)
const INSPECTION_MAX_LINES = 4;
const InspectionCell = ({ order, color, last, bg, ctx }) => {
  const insp = getColorInspection(color);
  const lots = color.lots || [];
  const open = (el) => ctx.openInspection(order.id, color.id, el);
  // 끝 = LOT 모두 출고완료 · 또는 그 컬러 출고 완료 → 회색 (불량컨펌중 · 재가공은 먼저)
  const tone = insp.anyDefect ? 'bg-rose-50' : insp.anyRedye ? 'bg-orange-50'
    : doneTone(order, insp.allShipped || (insp.used && color.shipDone), insp.used ? PROCESS_THEME.inspection.cell : bg);
  const shown = insp.rows.slice(0, INSPECTION_MAX_LINES);
  const today = todayYmd();
  return (
    <td onClick={e => open(e.currentTarget)} className={cellCls({ thick: last, extra: `${CLICKABLE} ${tone}` })}>
      <CellAction navKey="inspection" onActivate={open} title="외관검사 — LOT마다 1차·2차 (클릭 또는 Enter · 드롭다운은 바로 저장)">
        {lots.length === 0 ? (
          <span className="text-[10px] text-slate-300" title="외관검사는 염가공 LOT마다 해요 — LOT를 먼저 만들어 주세요">LOT 먼저</span>
        ) : (
          <div className="space-y-0.5">
            {shown.map(r => {
              const round = r.round;
              const statusDate = getRoundStatusDate(round);
              const planned = round ? fmtRange(round.startDate, round.endDate) : '';
              const overdue = !!round?.endDate && !r.done && order.status !== 'completed' && round.endDate < today;
              return (
                <div key={r.lot.id} className="flex items-center gap-1 min-w-0">
                  <span className="shrink-0 w-7 text-[9px] font-extrabold text-orange-700">LOT{r.lot.no}</span>
                  {r.roundNo > 1 && <span className="shrink-0 text-[9px] font-bold text-violet-700">{r.roundNo}차</span>}
                  <StatusSelect
                    value={r.status || 'waiting'}
                    options={INSPECTION_STATUSES}
                    onChange={st => ctx.actions.addLotInspection(order.id, color.id, r.lot.id, st)}
                    tabIndex={-1}
                    title={`LOT${r.lot.no} ${r.roundNo || 1}차 외관검사 상태 (바꾸면 오늘 날짜로 기록 · 재가공이면 다음 차수 · 모두 출고완료면 출고 칸도 완료)`}
                  />
                  {statusDate && r.status !== 'waiting' ? (
                    <span className="shrink-0 font-mono text-[9px] opacity-70">{shortDate(statusDate)}</span>
                  ) : planned ? (
                    <span
                      className={`shrink-0 font-mono text-[9px] ${overdue ? 'text-red-600 font-bold' : 'opacity-60'}`}
                      title={overdue ? '예상 종료일이 지났는데 아직 출고준비 전이에요' : '예상 시작~종료'}
                    >
                      {planned}
                    </span>
                  ) : null}
                  {r.redyeing && r.status !== 'redye' && (
                    <span className="shrink-0 text-[9px] font-bold text-orange-700" title="앞 차수에서 재가공 — 염가공소에 다시 들어감">재가공</span>
                  )}
                </div>
              );
            })}
            {insp.rows.length > shown.length && <div className="text-[9px] opacity-70">+LOT {insp.rows.length - shown.length}개 더</div>}
          </div>
        )}
      </CellAction>
    </td>
  );
};

// 원사 칸 (오더 단위, rowSpan — 대표님 요청 2026-10-14 v11)
//  사종마다 '면 30s [발주완료 ▾] 입고 10/20' — 드롭다운 = 바로 저장 (오늘 날짜로 기록)
//  [재고 사용]이면 '재고 사용' 한 줄 (사종 줄은 창에서만) / 원사염색(선염)은 아래 한 줄
//  칸을 누르면 원사 창 (재고 사용 · 사종 줄 · 원사염색)
const YARN_MAX_LINES = 4;
const YarnCell = ({ order, span, bg, ctx }) => {
  const y = getYarnState(order);
  const open = (el) => ctx.openYarn(order.id, el);
  const today = todayYmd();
  const tone = doneTone(order, y.done, y.used ? PROCESS_THEME.yarn.cell : bg); // 원사 끝 = 회색
  const shown = y.items.slice(0, YARN_MAX_LINES);
  return (
    <td rowSpan={span} onClick={e => open(e.currentTarget)} className={cellCls({ thick: true, extra: `${CLICKABLE} ${tone}` })}>
      <CellAction navKey="yarn" onActivate={open} title="원사 — 사종마다 발주대기·발주완료·입고완료·중지 · 재고 사용 · 원사염색 (클릭 또는 Enter · 드롭다운은 바로 저장)">
        <div className="space-y-0.5">
          {y.stock ? (
            <div className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[10px] font-extrabold ${DONE_TONE.chip}`} title="재고 원사 사용 — 원사 발주는 끝난 것으로 봐요">
              재고 사용
            </div>
          ) : shown.map(row => {
            const { status, statusDate, late, stopped, arrived } = getYarnRowInfo(order, row, today);
            return (
              <div key={row.id} className={`flex items-center gap-1 min-w-0 ${stopped ? 'opacity-60' : ''}`}>
                <span
                  className={`min-w-0 flex-1 truncate text-[10px] font-bold ${row.name ? '' : 'text-slate-400'} ${stopped ? 'line-through' : ''}`}
                  title={[row.name || '사종 미입력', row.vendor, row.notes].filter(Boolean).join(' · ')}
                >
                  {row.name || '사종?'}
                </span>
                <StatusSelect
                  value={status}
                  options={YARN_ORDER_STATUSES}
                  onChange={st => ctx.actions.addYarnEvent(order.id, row.id, st)}
                  tabIndex={-1}
                  title={`${row.name || '사종'} 상태 (바꾸면 오늘 날짜로 기록)`}
                />
                {arrived || stopped ? (
                  statusDate ? <span className="shrink-0 font-mono text-[9px] opacity-70">{shortDate(statusDate)}</span> : null
                ) : row.expectedDate ? (
                  <span
                    className={`shrink-0 font-mono text-[9px] ${late ? 'text-red-600 font-bold' : 'opacity-70'}`}
                    title={late ? '입고 예정일이 지났는데 아직 입고 전이에요' : '입고 예정일'}
                  >
                    입고 {shortDate(row.expectedDate)}
                  </span>
                ) : null}
              </div>
            );
          })}
          {!y.stock && y.items.length > shown.length && <div className="text-[9px] opacity-70">+사종 {y.items.length - shown.length}개 더</div>}
          <YarnDyeChip order={order} />
          {!y.used && (
            <span className="text-slate-300">{canUseYarnDyeing(order) ? '+ 원사 · 원사염색' : '+ 원사'}</span>
          )}
        </div>
      </CellAction>
    </td>
  );
};

// 마무리 칸 (오더 단위, rowSpan — 대표님 요청 2026-10-14) — 원사재고정리 · EZTEX 재고정리 · EZTEX 종결
//  체크 = 바로 저장 (3개 모두 → 오더 자동 '완료', 자동 완료를 체크 해제 → 다시 진행중) / 칸을 누르면 메모·날짜 창
//  출고는 다 끝났는데 체크가 남으면 '마무리 대기'
const ClosingCell = ({ order, span, bg, ctx }) => {
  const cs = getClosingState(order);
  const pending = isClosingPending(order);
  const open = (el) => ctx.openClosing(order.id, el);
  const tone = doneTone(order, cs.complete, pending ? 'bg-amber-50' : bg); // 마무리 3개 끝 = 회색
  return (
    <td rowSpan={span} onClick={e => open(e.currentTarget)} className={cellCls({ thick: true, extra: `${CLICKABLE} ${tone}` })}>
      <CellAction navKey="closing" onActivate={open} title="오더 마무리 — 원사재고정리 · EZTEX 재고정리 · EZTEX 종결 (체크는 바로 저장 · 칸을 누르면 메모)">
        <div className="space-y-0.5">
          {pending && (
            <div className="text-[9px] font-extrabold text-amber-700" title="출고는 다 끝났는데 마무리 체크가 남았어요">마무리 대기</div>
          )}
          {CLOSING_ITEMS.map(it => {
            const item = cs.items[it.key];
            return (
              <label
                key={it.key}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 min-w-0 cursor-pointer select-none"
                title={`${it.label}${item.done ? ` ✓ ${item.date || ''}` : ''}${item.memo ? `\n메모: ${item.memo}` : ''}`}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  tabIndex={-1}
                  onChange={e => ctx.actions.setClosing(order.id, { [it.key]: { done: e.target.checked } })}
                  className="w-3 h-3 shrink-0 accent-emerald-600 cursor-pointer"
                  aria-label={`${it.label} 체크`}
                />
                <span className={`truncate text-[10px] ${item.done ? 'font-bold text-slate-500 line-through decoration-slate-400' : 'text-slate-700'}`}>{it.short}</span>
                {item.done && item.date && <span className="shrink-0 font-mono text-[9px] opacity-60">{shortDate(item.date)}</span>}
                {item.memo && <span className="shrink-0 text-[9px] text-slate-400">메모</span>}
              </label>
            );
          })}
        </div>
      </CellAction>
    </td>
  );
};

// ============================================================
// 4. 오더 1개 = <tbody> 1개 (컬러 N줄). hover 시 오더 전체 옅은 teal
// ============================================================
const OrderGroup = ({ order, isDraft, visibleFlow, ctx }) => {
  const { actions } = ctx;
  const colors = order.colors?.length ? order.colors : FALLBACK_COLORS;
  const span = colors.length;
  const lossRate = getLossRate(order);
  const completed = order.status === 'completed';
  const onHold = order.status === 'on_hold';
  // 설계서 샘플 오더 (연결 설계서 요약 — 없으면 null) · Drop 으로 닫힌 오더는 '완료' 대신 'Drop'
  const sheetInfo = ctx.sheetInfoOf(order);
  const dropClosed = isDropClosed(order);

  // 고정 칸은 불투명 배경 필수 (가로 스크롤 내용이 비치지 않게)
  //  완료된 오더(마무리 끝 · Drop)는 줄 전체 회색 (대표님 요청 2026-10-14 — 칸 안 배지·드롭다운도 회색으로: tbody grayscale)
  const stickyBg = completed
    ? 'bg-slate-100 group-hover/ord:bg-slate-200'
    : `${isDraft ? 'bg-amber-50' : 'bg-white'} group-hover/ord:bg-teal-50`;
  const plainBg = completed
    ? 'bg-slate-100 text-slate-500 group-hover/ord:bg-slate-200/70'
    : `${isDraft ? 'bg-amber-50/40' : ''} group-hover/ord:bg-teal-50/60`;

  const setField = (field, value) => actions.setOrderField(order.id, field, value);
  const setColor = (colorId, patch) => actions.setColorField(order.id, colorId, patch);

  // 공정/컬러 칸 (가로 스크롤 영역)
  const renderFlowCell = (col, color, first, last) => {
    if (col.step) {
      return first
        ? <StepCell key={col.key} order={order} stepKey={col.key} span={span} bg={plainBg} ctx={ctx} />
        : null;
    }
    switch (col.key) {
      case 'yarn':
        // 원사 (오더 단위 — 첫 줄에 rowSpan)
        return first ? <YarnCell key="yarn" order={order} span={span} bg={plainBg} ctx={ctx} /> : null;
      case 'greige':
        // 후염: 오더에 한 번 (첫 줄에 rowSpan) / 선염·안 고름: 컬러마다
        if (isPieceDyed(order)) {
          return first ? <GreigeCell key="greige" order={order} color={color} last={last} span={span} bg={plainBg} ctx={ctx} /> : null;
        }
        return <GreigeCell key="greige" order={order} color={color} last={last} bg={plainBg} ctx={ctx} />;
      case 'closing':
        // order# 입력 전 새 줄은 마무리 체크 없음 (저장도 안 된 줄이 자동 완료되지 않게)
        if (!first) return null;
        return isDraft
          ? <td key="closing" rowSpan={span} className={cellCls({ thick: true, extra: plainBg })}><span className="text-[10px] text-slate-300">-</span></td>
          : <ClosingCell key="closing" order={order} span={span} bg={plainBg} ctx={ctx} />;
      case 'dyeing':
        return <LotCell key="dyeing" order={order} color={color} last={last} bg={plainBg} ctx={ctx} />;
      case 'confirm':
        return <ConfirmCell key="confirm" order={order} color={color} last={last} bg={plainBg} ctx={ctx} />;
      case 'inspection':
        return <InspectionCell key="inspection" order={order} color={color} last={last} bg={plainBg} ctx={ctx} />;
      case 'ship':
        return (
          <td
            key="ship"
            onClick={focusInside}
            className={cellCls({ thick: last, extra: color.shipDone ? DONE_TONE.cell : plainBg })}
          >
            <CellDate
              value={color.shipDate}
              navKey="shipDate"
              placeholder="출고일"
              title="출고일"
              onCommit={v => setColor(color.id, { shipDate: v })}
            />
            <CellCheck
              checked={color.shipDone}
              label="완료"
              navKey="shipDone"
              className="mt-0.5 ml-1"
              title="출고 완료"
              onCommit={done => setColor(color.id, doneWithDate(color, 'shipDone', 'shipDate', done))}
            />
          </td>
        );
      case 'stage': {
        const stage = COLOR_STAGES[getColorStage(order, color)] || COLOR_STAGES.waiting;
        return (
          <td key="stage" className={cellCls({ thick: last, extra: plainBg })}>
            <span className={`${BADGE} ${stage.cls}`} title="입력한 일정·상태로 자동 계산돼요">{stage.label}</span>
          </td>
        );
      }
      case 'memo':
        return first ? (
          <td key="memo" rowSpan={span} onClick={focusInside} className={cellCls({ thick: true, extra: plainBg })}>
            <CellText
              value={order.notes}
              navKey="memo"
              multiline
              clamp={4}
              placeholder="메모"
              className="text-slate-700"
              onCommit={v => setField('notes', v)}
            />
          </td>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <tbody className={`group/ord ${onHold ? '[&_td>*]:opacity-70' : ''} ${completed ? '[&_td>*]:grayscale' : ''}`}>
      {colors.map((color, ci) => {
        const first = ci === 0;
        const last = ci === span - 1;
        const workKg = getWorkKg(color, lossRate);
        const manual = isWorkKgManual(color);
        const canRemoveColor = span > 1 || colorHasData(color);

        return (
          <tr key={color.id}>
            {first && (
              <>
                {/* ---------- order# (+ 구분 칩, ⋯ 메뉴) ---------- */}
                <td
                  rowSpan={span}
                  data-sticky="1"
                  style={stickyStyle('orderNumber')}
                  onClick={focusInside}
                  className={cellCls({ thick: true, extra: `${STICKY} ${stickyBg}` })}
                >
                  <CellText
                    value={order.orderNumber}
                    navKey="orderNumber"
                    uppercase
                    placeholder="order# 입력"
                    className="font-mono font-extrabold text-teal-700"
                    title={isDraft ? 'order#를 입력하면 오더가 저장돼요' : undefined}
                    startEditing={ctx.focusOrderId === order.id}
                    onStartEditingDone={ctx.onOrderFocusDone}
                    onCommit={v => setField('orderNumber', v)}
                  />
                  {isDraft && <div className="px-1 text-[9px] font-bold text-amber-600">입력하면 저장</div>}
                  <div className="flex items-center flex-wrap gap-1 mt-1 px-1">
                    {/* 구분 — 새 줄만 드롭다운, 저장된 오더는 표시만 (대표님 요청 2026-10-19) */}
                    <OrderKindChip
                      order={order}
                      isDraft={isDraft}
                      onDraftKind={k => actions.setDraftKind(order.id, k)}
                      onPickKind={actions.requestKindChange ? () => actions.requestKindChange(order.id) : undefined}
                      showTodo={false}
                    />
                    {!isDraft && (
                      <OrderKindTodoChip order={order} only="sheet" onTodo={rect => ctx.openMenu(order.id, rect)} />
                    )}
                    {/* 선염 / 후염 (후염 = 생지 출고 오더에 한 번 — 고르면 바로 저장) */}
                    <StatusSelect
                      value={order.dyeMethod || ''}
                      options={DYE_METHODS}
                      onChange={m => actions.setDyeMethod(order.id, m)}
                      placeholder="선염/후염"
                      tabIndex={-1}
                      title={order.dyeMethod
                        ? `${DYE_METHODS.find(m => m.key === order.dyeMethod)?.label} — ${DYE_METHODS.find(m => m.key === order.dyeMethod)?.desc} (바꾸면 바로 저장)`
                        : '염색 방식을 골라 주세요 — 후염이면 생지 출고를 오더에 한 번 (지금은 컬러마다)'}
                    />
                    <SheetLinkChips info={sheetInfo} onOpen={ctx.openSheet} />
                    {isClosingPending(order) && (
                      <span
                        className="px-1 py-px rounded border bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-extrabold"
                        title="출고는 다 끝났어요 — 마무리(원사재고정리 · EZTEX 재고정리 · EZTEX 종결)를 체크하면 오더가 완료돼요"
                      >
                        마무리 대기
                      </span>
                    )}
                    {completed && !dropClosed && (
                      <span className={`px-1 py-px rounded border text-[9px] font-extrabold ${DONE_TONE.chip}`}>
                        완료
                      </span>
                    )}
                    {/* Drop 으로 닫힌 오더 — 설계서 꼬리표가 이미 'Drop'이면 한 번만 (설계서가 지워졌어도 오더에 남음) */}
                    {dropClosed && !sheetInfo?.dropped && (
                      <span className={`px-1 py-px rounded border text-[9px] font-extrabold ${DONE_TONE.chip}`} title="설계서 Drop으로 닫힌 샘플 오더">
                        Drop
                      </span>
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={e => ctx.openMenu(order.id, e.currentTarget.getBoundingClientRect())}
                      title="오더 메뉴 (상세 보기·상태·삭제)"
                      className="ml-auto p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                {/* ---------- article# (원단 보관함 자동완성) ---------- */}
                <td
                  rowSpan={span}
                  data-sticky="1"
                  style={stickyStyle('articleNo')}
                  onClick={focusInside}
                  className={cellCls({ thick: true, extra: `${STICKY} ${stickyBg}` })}
                >
                  <CellText
                    value={order.articleNo}
                    navKey="articleNo"
                    placeholder="article#"
                    className="font-bold text-slate-800"
                    suggest={ctx.suggestFabrics}
                    suggestTitle="원단 보관함 품번 — ↑↓ 선택 · Enter 적용"
                    onPick={item => ctx.pickFabric(order, item)}
                    onCommit={v => setField('articleNo', v)}
                  />
                  {order.linkedFabricId && (
                    <div
                      className="px-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-600"
                      title={`원단 보관함과 연결됨 (${order.linkedFabricArticle || order.articleNo})`}
                    >
                      <Link2 className="w-3 h-3" /> 보관함 연결
                    </div>
                  )}
                  {/* 재샘플인데 아이템을 안 골랐으면 — 위 칸에 품번을 넣고 목록에서 고르기 (고르기 전에는 완료 못 함) */}
                  <div className="px-1">
                    <OrderKindTodoChip order={order} only="item" />
                  </div>
                </td>

                {/* ---------- detail ---------- */}
                <td
                  rowSpan={span}
                  data-sticky="1"
                  style={stickyStyle('detail')}
                  onClick={focusInside}
                  className={cellCls({ thick: true, extra: `${STICKY} ${stickyBg}` })}
                >
                  <CellText
                    value={order.detail}
                    navKey="detail"
                    multiline
                    clamp={4}
                    placeholder="detail"
                    className="text-slate-700"
                    onCommit={v => setField('detail', v)}
                  />
                </td>

                {/* ---------- buyer (직접 입력 + 거래처 검색) ---------- */}
                <td
                  rowSpan={span}
                  data-sticky="1"
                  style={stickyStyle('customer')}
                  onClick={focusInside}
                  className={cellCls({ thick: true, extra: `${STICKY} ${stickyBg}` })}
                >
                  <div className="flex items-start gap-0.5">
                    <CellText
                      value={order.customer}
                      navKey="customer"
                      placeholder="buyer"
                      rootClassName="flex-1 min-w-0"
                      className="text-slate-800"
                      onCommit={v => setField('customer', v)}
                    />
                    {ctx.canPickBuyer && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => ctx.openBuyer(order.id)}
                        title="거래처 목록에서 선택"
                        className="mt-0.5 p-0.5 shrink-0 rounded text-slate-400 hover:text-teal-700 hover:bg-teal-100"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </>
            )}

            {/* ---------- color (마우스 올리면 + / 휴지통) ---------- */}
            <td
              data-sticky="1"
              style={stickyStyle('color')}
              onClick={focusInside}
              className={cellCls({ thick: last, lastSticky: true, extra: `${STICKY} ${stickyBg} group/color` })}
            >
              <CellText
                value={color.name}
                navKey="color"
                uppercase
                placeholder="컬러"
                className="font-bold text-slate-800"
                startEditing={ctx.focusColorId === color.id}
                onStartEditingDone={ctx.onColorFocusDone}
                onCommit={v => setColor(color.id, { name: v })}
              />
              <div className="absolute right-0.5 bottom-0.5 flex gap-0.5 invisible group-hover/color:visible group-focus-within/color:visible">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => ctx.addColorAfter(order.id, color.id)}
                  title="아래에 컬러 줄 추가"
                  className="p-0.5 rounded bg-white/90 border border-slate-200 text-teal-600 hover:bg-teal-50"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {canRemoveColor && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => actions.removeColor(order.id, color.id)}
                    title={span > 1 ? '이 컬러 줄 삭제' : '이 컬러 줄 비우기'}
                    className="p-0.5 rounded bg-white/90 border border-slate-200 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </td>

            {/* ---------- 오더kg ---------- */}
            <td onClick={focusInside} className={cellCls({ thick: last, extra: plainBg })}>
              <CellNumber
                value={color.orderKg}
                navKey="orderKg"
                placeholder="-"
                className="text-slate-800"
                onCommit={n => setColor(color.id, { orderKg: n })}
              />
              {color.orderKg === null && color.legacyYd ? (
                <div className="px-1 text-right text-[9px] text-slate-400" title="예전 YD 수량 (원단 gsm·폭이 없어 kg 로 바꾸지 못함)">
                  {fmtKg(color.legacyYd)}yd
                </div>
              ) : null}
            </td>

            {/* ---------- 생지kg (자동=회색, 직접입력=검정) + 첫 줄 로스율 — 예전 이름 '작지kg' (2026-10-14) ---------- */}
            <td onClick={focusInside} className={cellCls({ thick: last, extra: plainBg })}>
              <div className="flex items-start">
                <CellNumber
                  value={workKg}
                  navKey="workKg"
                  placeholder="-"
                  rootClassName="flex-1 min-w-0"
                  className="text-slate-900"
                  displayClassName={manual ? 'font-bold' : '!text-slate-400'}
                  title={manual ? '직접 입력한 생지kg' : `자동 계산: 오더kg × (1 + 로스 ${fmtKg(lossRate)}%)`}
                  onCommit={n => {
                    if (n === null && !manual) return;
                    setColor(color.id, { workKg: n });
                  }}
                />
                {manual && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setColor(color.id, { workKg: null })}
                    title="자동 계산으로 되돌리기"
                    className="mt-1 p-0.5 shrink-0 rounded text-slate-400 hover:text-teal-700 hover:bg-teal-100"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
              {first && (
                <CellNumber
                  value={lossRate}
                  navKey="lossRate"
                  align="left"
                  rootClassName="mt-0.5"
                  title="로스율 — 생지kg = 오더kg × (1 + 로스율)"
                  display={v => (
                    <span className="inline-block px-1 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-bold font-sans">
                      로스 {fmtKg(v)}%
                    </span>
                  )}
                  onCommit={n => {
                    const next = n === null ? DEFAULT_LOSS_RATE : n;
                    if (next !== lossRate) setField('lossRate', next);
                  }}
                />
              )}
            </td>

            {/* ---------- 납기 + D-day ---------- */}
            {first && (
              <td rowSpan={span} onClick={focusInside} className={cellCls({ thick: true, extra: plainBg })}>
                <CellDate
                  value={order.finalDueDate}
                  navKey="due"
                  placeholder="납기"
                  title={order.finalDueDate ? `납기 ${order.finalDueDate}` : '납기 입력'}
                  className="font-bold text-slate-800"
                  onCommit={v => setField('finalDueDate', v)}
                />
                {!completed && (
                  <div className="px-1 mt-0.5">
                    <DdayBadge due={order.finalDueDate} />
                  </div>
                )}
              </td>
            )}

            {/* ---------- 가납기 (원사·편직·염가공·외관검사) ---------- */}
            {first && <ProvisionalCell order={order} span={span} bg={plainBg} ctx={ctx} />}

            {visibleFlow.map(col => renderFlowCell(col, color, first, last))}
          </tr>
        );
      })}
    </tbody>
  );
};

// ============================================================
// 5. 메인 — 생산 현황표
// ============================================================
export const ProductionSheet = ({
  orders = [],
  drafts = [],
  actions,
  masters = {},
  partners, savePartner, deletePartner, makeEmptyPartner,
  savedFabrics = [],
  onOpenDetail,
  onOpenLots,
  pendingFocusOrderId = null,
  onPendingFocusDone,
  allOrders,          // 필터 전 전체 오더 (외주처 제안용). 없으면 orders 사용
  sheetLink = null,   // 설계서 샘플 오더 { infoOf(order), open, itemize, drop, restore } (OrderListPage)
  stepDefs: stepDefsProp,   // 공정 목록 (기본 + 추가 공정) — 없으면 기본 공정만
  customSteps = [],         // 추가 공정 설정 [{ key, label, after, vendorLabel }]
  onSaveCustomSteps,        // 추가 공정 저장 (list) => Promise<boolean> — 없으면 [공정 추가] 버튼 숨김
  yieldSpecOf,              // (order) => 예상 YD 환산 원단 스펙 { gsm, widthFull, source } | null (OrderListPage)
  yarnHelpers = null,       // 원사 창 { popoverProps(order) — 제안 목록 · 원단 원사 } (OrderListPage)
}) => {
  const scrollRef = useRef(null);
  const stepDefs = useMemo(() => stepDefsProp || getStepDefs(customSteps), [stepDefsProp, customSteps]);
  const flowCols = useMemo(() => buildFlowCols(customSteps, stepDefs), [customSteps, stepDefs]);
  const [stepManagerRect, setStepManagerRect] = useState(null); // [공정 추가] 창 (버튼 위치)
  const [hiddenCols, setHiddenCols] = useState(loadHiddenCols);
  const [showColPanel, setShowColPanel] = useState(false);
  const [popover, setPopover] = useState(null);           // { kind: 'menu'|'process'|'confirm', orderId, stepKey?, colorId?, anchorRect }
  const [buyerOrderId, setBuyerOrderId] = useState(null); // 거래처 선택 창을 연 오더
  const [localFocusId, setLocalFocusId] = useState(null); // 표 안 [+ 오더 추가] 로 만든 새 줄
  const [focusColorId, setFocusColorId] = useState(null); // 방금 추가한 컬러 줄

  // 초안이 저장되는 순간 같은 id 가 orders 로 넘어감 → 혹시 겹쳐도 한 번만 렌더
  const orderIds = useMemo(() => new Set(orders.map(o => o.id)), [orders]);
  const draftRows = useMemo(() => drafts.filter(d => !orderIds.has(d.id)), [drafts, orderIds]);
  const draftIds = useMemo(() => new Set(draftRows.map(d => d.id)), [draftRows]);
  const rows = useMemo(() => [...orders, ...draftRows], [orders, draftRows]);

  const fabricOptions = useMemo(() => (savedFabrics || []).filter(f => f && f.article), [savedFabrics]);

  // 칸별로 내용이 입력된 오더 수 (숨긴 칸에 데이터가 있으면 패널에 표시)
  const usage = useMemo(() => {
    const count = {};
    const bump = (k) => { count[k] = (count[k] || 0) + 1; };
    orders.forEach(o => {
      stepDefs.forEach(s => { if (isStepUsed(o.steps?.[s.key])) bump(s.key); });
      if (getYarnState(o).used) bump('yarn');
      const cs = o.colors || [];
      if ((o.greigeOuts || []).length || cs.some(c => (c.greigeOuts || []).length)) bump('greige');
      if (cs.some(c => (c.lots || []).length) || isStepUsed(o.steps?.[PRESETTING_KEY])) bump('dyeing');
      if (cs.some(c => c.testReport?.needed || (c.brandConfirm?.events || []).length)) bump('confirm');
      if (cs.some(isInspectionUsed)) bump('inspection');
      if (cs.some(c => c.shipDate || c.shipDone)) bump('ship');
      if (getClosingState(o).done > 0) bump('closing');
      if (o.notes) bump('memo');
    });
    return count;
  }, [orders, stepDefs]);

  const visibleFlow = flowCols.filter(c => !hiddenCols.includes(c.key));
  const hiddenCount = flowCols.filter(c => hiddenCols.includes(c.key)).length;
  const columns = [...LEFT_COLS, ...QTY_COLS, ...visibleFlow];
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);

  // ---------- 컬럼 보이기/숨기기 ----------
  const saveHiddenCols = (next) => {
    setHiddenCols(next);
    try {
      localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify(next));
      localStorage.setItem(LS_YARN_SHOWN, '1'); // 대표님이 고른 숨김은 그대로 (원사 '한 번 보이게'가 다시 안 일어나게)
    } catch { /* 저장 못 해도 화면은 그대로 동작 */ }
  };
  const toggleCol = (key) => saveHiddenCols(
    hiddenCols.includes(key) ? hiddenCols.filter(k => k !== key) : [...hiddenCols, key]
  );

  // ---------- 새 줄 / 컬러 줄 추가 + 자동 포커스 ----------
  //  kind: [+ 오더 추가 ▾] 에서 고른 구분 ('main' | 'new' | 'resample')
  const addDraft = (kind = 'main') => {
    const id = actions.addDraftOrder(kind);
    if (id) setLocalFocusId(id);
  };
  const focusOrderId = pendingFocusOrderId || localFocusId;
  const handleOrderFocusDone = () => {
    setLocalFocusId(null);
    if (pendingFocusOrderId) onPendingFocusDone?.();
  };
  const addColorAfter = (orderId, colorId) => {
    const newId = actions.addColor(orderId, colorId);
    if (newId) setFocusColorId(newId);
  };

  // ---------- article# 자동완성 (원단 보관함) ----------
  const suggestFabrics = (text) => {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return [];
    return fabricOptions
      .filter(f => String(f.article).toLowerCase().includes(t) || String(f.itemName || '').toLowerCase().includes(t))
      .slice(0, 8)
      .map((f, i) => ({
        key: f.id || `${f.article}_${i}`,
        label: f.article,
        sub: [f.itemName, f.gsm ? `${f.gsm}g` : '', f.widthFull ? `폭 ${f.widthFull}"` : ''].filter(Boolean).join(' · '),
        fabric: f,
      }));
  };
  const pickFabric = (order, item) => {
    const f = item?.fabric;
    if (!f) return;
    if (order.linkedFabricId && order.linkedFabricId === f.id && order.articleNo === f.article) return;
    actions.setFabric(order.id, f);
  };

  // ---------- buyer 선택 ----------
  const canPickBuyer = Array.isArray(partners) && typeof savePartner === 'function' && typeof makeEmptyPartner === 'function';
  const selectBuyer = (orderId, partner) => {
    const name = String(partner?.name || '').trim();
    const o = rows.find(x => x.id === orderId);
    if (o && name && name !== o.customer) actions.setOrderField(orderId, 'customer', name);
  };

  // ---------- 공정 외주처 제안: 마스터 + 다른 오더들이 쓴 값 ----------
  // (검색·탭 필터와 상관없이 전체 오더 기준 — allOrders 가 있을 때)
  const optionSource = Array.isArray(allOrders) ? allOrders : orders;
  const vendorOptionsFor = (stepKey, orderId) => {
    const meta = findStepMeta(stepDefs, stepKey);
    return collectVendorOptions(meta?.vendorMaster ? masters?.[meta.vendorMaster] : [], optionSource, o => o.steps?.[stepKey]?.vendor, orderId);
  };

  // ---------- 팝오버 ----------
  const openPopover = (kind, orderId, anchorRect, extra = {}) => setPopover({ kind, orderId, anchorRect, ...extra });
  // 이 팝오버만 닫음 (저장이 끝나기 전에 다른 칸 팝오버를 열었으면, 늦게 끝난 저장이 새 팝오버를 닫지 않게)
  const closePopover = () => {
    const current = popover;
    setPopover(p => (p === current ? null : p));
    const el = current?.returnFocus;
    if (!el) return;
    // 팝오버가 사라진 뒤 포커스가 갈 곳이 없으면(body) 연 칸으로 되돌림 → Tab/방향키로 계속 이동
    setTimeout(() => {
      const active = document.activeElement;
      if (el.isConnected && (!active || active === document.body)) el.focus({ preventScroll: true });
    }, 0);
  };
  const popOrder = popover ? rows.find(o => o.id === popover.orderId) || null : null;
  const popColor = popover?.colorId ? popOrder?.colors?.find(c => c.id === popover.colorId) || null : null;

  // ---------- Tab/Enter 로 이동한 칸이 고정 칸·머리글 뒤에 가려지지 않게 스크롤 보정 ----------
  const keepFocusVisible = (e) => {
    const box = scrollRef.current;
    const cell = e.target?.closest?.('td');
    if (!box || !cell) return;
    requestAnimationFrame(() => {
      const b = box.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      if (!cell.dataset.sticky && window.matchMedia('(min-width: 768px)').matches) {
        const hiddenLeft = b.left + LEFT_TOTAL - r.left;
        if (hiddenLeft > 0) box.scrollLeft -= hiddenLeft + 4;
      }
      const headH = box.querySelector('thead')?.getBoundingClientRect().height || 0;
      const hiddenTop = b.top + headH - r.top;
      if (hiddenTop > 0 && r.height < b.height - headH) box.scrollTop -= hiddenTop + 2;
    });
  };

  const ctx = {
    actions,
    stepMetaOf: (key) => findStepMeta(stepDefs, key),
    focusOrderId,
    onOrderFocusDone: handleOrderFocusDone,
    focusColorId,
    onColorFocusDone: () => setFocusColorId(null),
    suggestFabrics,
    pickFabric,
    canPickBuyer,
    openBuyer: (orderId) => setBuyerOrderId(orderId),
    openMenu: (orderId, rect) => openPopover('menu', orderId, rect),
    openProcess: (orderId, stepKey, cell) => openPopover(
      'process', orderId, cell.getBoundingClientRect(), { stepKey, returnFocus: cellFocusTarget(cell) }
    ),
    openConfirm: (orderId, colorId, cell) => openPopover(
      'confirm', orderId, cell.getBoundingClientRect(), { colorId, returnFocus: cellFocusTarget(cell) }
    ),
    openProvisional: (orderId, cell) => openPopover(
      'provisional', orderId, cell.getBoundingClientRect(), { returnFocus: cellFocusTarget(cell) }
    ),
    // colorId 가 null 이면 후염 오더 전체 생지 출고
    openGreige: (orderId, colorId, cell) => openPopover(
      'greige', orderId, cell.getBoundingClientRect(), { colorId, returnFocus: cellFocusTarget(cell) }
    ),
    openInspection: (orderId, colorId, cell) => openPopover(
      'inspection', orderId, cell.getBoundingClientRect(), { colorId, returnFocus: cellFocusTarget(cell) }
    ),
    openClosing: (orderId, cell) => openPopover(
      'closing', orderId, cell.getBoundingClientRect(), { returnFocus: cellFocusTarget(cell) }
    ),
    openYarn: (orderId, cell) => openPopover(
      'yarn', orderId, cell.getBoundingClientRect(), { returnFocus: cellFocusTarget(cell) }
    ),
    yieldSpecOf: yieldSpecOf || null,
    openLots: onOpenLots || null,
    addColorAfter,
    sheetInfoOf: (order) => sheetLink?.infoOf?.(order) || null,
    openSheet: sheetLink?.open || null,
  };

  // ---------- 오더가 하나도 없을 때 ----------
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">표시할 오더가 없어요</p>
        <p className="text-xs text-slate-400 mt-1">
          엑셀처럼 한 줄씩 입력하면 바로 저장돼요. 구분(메인 · 신제품 · 재샘플)을 고른 뒤 새 줄에서 order#부터 입력해 주세요.
        </p>
        <AddOrderMenu
          onPick={addDraft}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-bold shadow-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> 첫 오더 추가 <ChevronDown className="w-3.5 h-3.5 opacity-80" />
        </AddOrderMenu>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* ---------- 상단 바: 칸 보이기/숨기기 ---------- */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setShowColPanel(v => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100"
        >
          {hiddenCount > 0 ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          칸 보이기/숨기기{hiddenCount > 0 ? ` (${hiddenCount}개 숨김)` : ''}
          <ChevronDown className={`w-3 h-3 transition-transform ${showColPanel ? 'rotate-180' : ''}`} />
        </button>
        {onSaveCustomSteps && (
          <button
            type="button"
            onClick={e => setStepManagerRect(e.currentTarget.getBoundingClientRect())}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-200 bg-white text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
            title="편직·후가공처럼 공정 칸을 더 만들어요 — 모든 오더에 칸이 생겨요"
          >
            <ListPlus className="w-3.5 h-3.5" />
            공정 추가{customSteps.length > 0 ? ` (${customSteps.length})` : ''}
          </button>
        )}
        <span className="text-[11px] text-slate-500">
          오더 {orders.length}건{draftRows.length > 0 ? ` · 저장 전 새 줄 ${draftRows.length}개` : ''}
        </span>
        <span className="ml-auto hidden lg:inline text-[10px] text-slate-400">
          Tab 다음 칸 · Enter 확정 후 아래 칸 · Esc 취소 · Alt+Enter 줄바꿈(detail·메모)
        </span>

        {showColPanel && (
          <div className="w-full flex items-center gap-1.5 flex-wrap pt-1">
            {flowCols.map(col => {
              const off = hiddenCols.includes(col.key);
              const n = usage[col.key] || 0;
              const theme = PROCESS_THEME[col.key] || (col.custom ? PROCESS_THEME.custom : null);
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => toggleCol(col.key)}
                  title={off && n ? `숨긴 칸에 입력된 오더 ${n}건` : undefined}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-bold transition-colors ${
                    off
                      ? 'bg-white text-slate-400 border-slate-200 line-through'
                      : 'bg-teal-50 text-teal-700 border-teal-300'
                  }`}
                >
                  {theme && <span className={`w-2 h-2 rounded-full ${theme.dot} ${off ? 'opacity-40' : ''}`} />}
                  {col.label}
                  {off && n > 0 && (
                    <span className="no-underline px-1 rounded-full bg-amber-100 text-amber-700 text-[9px]">{n}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => saveHiddenCols(DEFAULT_HIDDEN)}
              className="text-[10px] text-slate-500 hover:text-slate-800 underline ml-1"
            >
              기본값
            </button>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => saveHiddenCols([])}
                className="text-[10px] text-slate-500 hover:text-slate-800 underline"
              >
                모두 보이기
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---------- 표 (세로·가로 스크롤, 머리글·왼쪽 5칸 고정) ---------- */}
      <div ref={scrollRef} onFocus={keepFocusVisible} className="overflow-auto max-h-[calc(100vh-220px)]">
        <table
          className="table-fixed border-separate border-spacing-0 text-slate-700"
          style={{ width: tableWidth, minWidth: tableWidth }}
        >
          <colgroup>
            {columns.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {LEFT_COLS.map((c, i) => (
                <th
                  key={c.key}
                  style={stickyStyle(c.key)}
                  className={`${TH} md:left-[var(--sl)] md:z-30 ${
                    i === LEFT_COLS.length - 1
                      ? 'border-r-2 border-r-slate-300 md:shadow-[3px_0_5px_-3px_rgba(15,23,42,0.3)]'
                      : 'border-r border-r-slate-200'
                  }`}
                >
                  {c.label}
                </th>
              ))}
              {QTY_COLS.map(c => (
                <th key={c.key} title={c.title} className={`${TH} border-r border-r-slate-200 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
              {visibleFlow.map(c => {
                const theme = PROCESS_THEME[c.key] || (c.custom ? PROCESS_THEME.custom : null);
                return (
                  <th key={c.key} className={`${TH} border-r border-r-slate-200`}>
                    <span className="inline-flex items-center gap-1">
                      {theme && <span className={`w-2 h-2 rounded-full ${theme.dot}`} />}
                      {c.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {rows.map(order => (
            <OrderGroup
              key={order.id}
              order={order}
              isDraft={draftIds.has(order.id)}
              visibleFlow={visibleFlow}
              ctx={ctx}
            />
          ))}

          {/* ---------- 맨 아래 줄: + 오더 추가 (구분 고르기 메뉴) ---------- */}
          <tbody>
            <tr>
              <td colSpan={columns.length} className="p-0 border-b border-b-slate-200">
                <AddOrderMenu
                  onPick={addDraft}
                  className="w-full text-left py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  <span className="sticky left-0 inline-flex items-center gap-1 px-3">
                    <Plus className="w-3.5 h-3.5" /> 오더 추가 <ChevronDown className="w-3 h-3 opacity-70" />
                  </span>
                </AddOrderMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---------- 팝오버 / 모달 ---------- */}
      {popover?.kind === 'menu' && popOrder && (
        <OrderMenuPopover
          key={`menu_${popOrder.id}`}
          order={popOrder}
          isDraft={draftIds.has(popOrder.id)}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onOpenDetail={onOpenDetail}
          actions={actions}
          sheetInfo={sheetLink?.infoOf?.(popOrder) || null}
          sheetActions={sheetLink}
        />
      )}
      {popover?.kind === 'process' && popOrder && (
        <ProcessPopover
          key={`process_${popOrder.id}_${popover.stepKey}`}
          order={popOrder}
          stepKey={popover.stepKey}
          meta={findStepMeta(stepDefs, popover.stepKey)}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setStep(popOrder.id, popover.stepKey, patch)}
          vendorOptions={vendorOptionsFor(popover.stepKey, popOrder.id)}
        />
      )}
      {popover?.kind === 'confirm' && popOrder && popColor && (
        <ConfirmPopover
          key={`confirm_${popOrder.id}_${popColor.id}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setColorTracks(popOrder.id, popColor.id, patch)}
        />
      )}
      {popover?.kind === 'greige' && popOrder && (popColor || !popover.colorId) && (
        <GreigeOutPopover
          key={`greige_${popOrder.id}_${popover.colorId || 'order'}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={(entries, base, scope) => (scope === 'order'
            ? actions.setOrderGreigeOuts(popOrder.id, entries, base)
            : actions.setGreigeOuts(popOrder.id, popColor.id, entries, base))}
          onSetDyeMethod={m => actions.setDyeMethod(popOrder.id, m)}
        />
      )}
      {popover?.kind === 'inspection' && popOrder && popColor && (
        <InspectionPopover
          key={`inspection_${popOrder.id}_${popColor.id}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patchByLot => actions.setLotInspections(popOrder.id, popColor.id, patchByLot)}
          onSaveVendor={v => actions.setOrderField(popOrder.id, 'inspectVendor', v)}
          vendorOptions={collectVendorOptions([], optionSource, o => o.inspectVendor)}
          onOpenLots={onOpenLots ? () => onOpenLots(popOrder.id, popColor.id, popover.anchorRect) : undefined}
        />
      )}
      {popover?.kind === 'closing' && popOrder && (
        <ClosingPopover
          key={`closing_${popOrder.id}`}
          order={popOrder}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setClosing(popOrder.id, patch)}
        />
      )}
      {popover?.kind === 'provisional' && popOrder && (
        <ProvisionalDuePopover
          key={`provisional_${popOrder.id}`}
          order={popOrder}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={(patch, plan) => actions.setProvisionalDue(popOrder.id, patch, plan)}
        />
      )}
      {popover?.kind === 'yarn' && popOrder && (
        <YarnPopover
          key={`yarn_${popOrder.id}`}
          order={popOrder}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSaveYarn={patch => actions.setYarn(popOrder.id, patch)}
          onSaveYarnDyeing={patch => actions.setStep(popOrder.id, YARN_DYEING_KEY, patch)}
          {...(yarnHelpers?.popoverProps?.(popOrder) || {})}
        />
      )}
      {stepManagerRect && onSaveCustomSteps && (
        <StepManagerPopover
          anchorRect={stepManagerRect}
          customSteps={customSteps}
          stepDefs={stepDefs}
          orders={Array.isArray(allOrders) ? allOrders : orders}
          onSave={onSaveCustomSteps}
          onClose={() => setStepManagerRect(null)}
        />
      )}
      {buyerOrderId && canPickBuyer && (
        <PartnerPickerModal
          onClose={() => setBuyerOrderId(null)}
          partners={partners}
          onSelect={p => selectBuyer(buyerOrderId, p)}
          savePartner={savePartner}
          deletePartner={deletePartner || (async () => false)}
          makeEmptyPartner={makeEmptyPartner}
        />
      )}
    </div>
  );
};

export default ProductionSheet;
