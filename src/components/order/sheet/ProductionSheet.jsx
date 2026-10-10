import { useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Search, Link2, RotateCcw, MoreHorizontal, Eye, EyeOff, ChevronDown, FileSpreadsheet,
} from 'lucide-react';
import {
  ORDER_STEPS, PROCESS_THEME, PROGRESS_STATUS_COLORS, getStatusLabel, COLOR_STAGES,
  CONFIRM_RESULTS, DEFAULT_LOSS_RATE, PROVISIONAL_DUE_STEPS, PROVISIONAL_STATES,
} from '../../../constants/production';
import {
  getWorkKg, isWorkKgManual, getLossRate, isStepUsed, getKnittingEstimatedEnd, colorHasData,
  getLotSummary, getLotsTotalKg, getLotsStatus, getConfirmState, getColorStage, getDday,
  getProvisionalDueInfo, describeProvisionalDue, describeStepCurrent,
} from '../../../utils/orderModel';
import { shortDate, fmtKg, todayYmd } from '../../../utils/orderCalculations';
import { CellText, CellNumber, CellDate, CellCheck, CellAction } from './SheetCells';
import { OrderMenuPopover } from './OrderMenuPopover';
import { ProcessPopover } from './ProcessPopover';
import { ConfirmPopover } from './ColorPopovers';
import { ProvisionalDuePopover } from './ProvisionalDuePopover';
import { PartnerPickerModal } from '../../common/PartnerPickerModal';

// ============================================================
// 생산 현황표 (엑셀형) — 한 줄 = 컬러 1개, 오더 단위 칸은 rowSpan
// ------------------------------------------------------------
// - 칸을 클릭하거나 Tab 으로 이동하면 바로 입력 (Enter 확정 후 아래 칸, Esc 취소)
// - 공정·컨펌 칸은 클릭하면 팝오버, 염가공 LOT 칸은 onOpenLots 로 LOT 편집 열기
// - 왼쪽 5칸(order#~color) 고정, 나머지 가로 스크롤. 공정/컬러 칸은 보이기/숨기기 가능
// - 초안(order# 입력 전 새 줄)은 저장된 오더 다음에 같은 목록(key=order.id)으로 렌더
//   → order# 를 입력해 저장돼도 줄이 다시 마운트되지 않아 입력 흐름이 끊기지 않음
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
  { key: 'workKg',      label: '작지kg', width: 78, align: 'right' },
  { key: 'due',         label: '납기',   width: 96 },
  { key: 'provisional', label: '가납기', width: 150, title: '원사·편직·염가공·외관검사 대략적인 목표 날짜 — 지금 일정과 비교' },
];

// 공정/컬러 칸 (보이기/숨기기 가능). step = 오더 단위 공정 칸(rowSpan)
const FLOW_COLS = [
  { key: 'yarn',              label: '원사',       width: 140, step: true },
  { key: 'yarn_processing',   label: '사가공',     width: 140, step: true },
  { key: 'knitting',          label: '편직',       width: 140, step: true },
  { key: 'greige',            label: '생지출고',   width: 116 },
  { key: 'dyeing',            label: '염가공 LOT', width: 150 },
  { key: 'finishing',         label: '후가공',     width: 140, step: true },
  { key: 'physical_test',     label: '이화학',     width: 140, step: true },
  { key: 'visual_inspection', label: '외관',       width: 140, step: true },
  { key: 'confirm',           label: '컨펌',       width: 104 },
  { key: 'ship',              label: '출고',       width: 116 },
  { key: 'stage',             label: '상태',       width: 84 },
  { key: 'memo',              label: '메모',       width: 180 },
];
const FLOW_KEYS = FLOW_COLS.map(c => c.key);

// 고정 칸 left 위치 (누적 폭)
const LEFT_OFFSET = LEFT_COLS.reduce((acc, c, i) => {
  acc[c.key] = i === 0 ? 0 : acc[LEFT_COLS[i - 1].key] + LEFT_COLS[i - 1].width;
  return acc;
}, {});
const LEFT_TOTAL = LEFT_COLS.reduce((s, c) => s + c.width, 0);

// 컬럼 숨김 저장 (브라우저별). 처음엔 자주 안 쓰는 공정 숨김
const LS_HIDDEN_COLS = 'grubig.production.sheet.hiddenCols.v8';
const DEFAULT_HIDDEN = ['yarn', 'yarn_processing', 'finishing', 'physical_test', 'visual_inspection'];

const loadHiddenCols = () => {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_COLS);
    if (raw === null) return DEFAULT_HIDDEN;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(k => FLOW_KEYS.includes(k)) : DEFAULT_HIDDEN;
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

// 왼쪽 고정 칸: 좁은 화면(md 미만)에서는 고정하지 않음 → 고정 칸이 화면을 다 가리지 않게
const STICKY = 'relative md:sticky md:left-[var(--sl)] md:z-10';
const stickyStyle = (key) => ({ '--sl': `${LEFT_OFFSET[key]}px` });

// 클릭하면 팝오버가 열리는 칸
const CLICKABLE = 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-teal-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-teal-400';

const TH = 'sticky top-0 z-20 bg-slate-100 border-b border-b-slate-300 px-1.5 py-1.5 text-left text-[11px] font-extrabold text-slate-600 whitespace-nowrap';

const BADGE = 'inline-flex items-center px-1.5 py-px rounded-full border text-[10px] font-bold whitespace-nowrap';

const CONFIRM_BADGE = {
  pass:  CONFIRM_RESULTS.find(r => r.key === 'pass')?.cls || 'bg-emerald-100 text-emerald-700 border-emerald-300',
  fail:  CONFIRM_RESULTS.find(r => r.key === 'fail')?.cls || 'bg-rose-100 text-rose-700 border-rose-300',
  sent:  'bg-sky-100 text-sky-700 border-sky-300',
  ready: 'bg-slate-100 text-slate-600 border-slate-300',
};

// 'M/D~M/D' (한쪽만 있으면 'M/D~' / '~M/D')
const fmtRange = (start, end) => {
  if (!start && !end) return '';
  if (start && end) return `${shortDate(start)}~${shortDate(end)}`;
  return start ? `${shortDate(start)}~` : `~${shortDate(end)}`;
};

// 마스터 목록(문자열 또는 {name}) → 이름 배열
const toNames = (list) => (Array.isArray(list) ? list : [])
  .map(v => (typeof v === 'string' ? v : v?.name))
  .filter(Boolean);

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

// 공정 칸 내용: 외주처 / 일정 / 상태 / 메모
const StepSummary = ({ order, stepKey, step }) => {
  const status = step.status || 'pending';
  const sc = PROGRESS_STATUS_COLORS[status] || PROGRESS_STATUS_COLORS.pending;
  const estimated = stepKey === 'knitting' && !step.endDate ? getKnittingEstimatedEnd(order) : '';
  const end = step.endDate || estimated;
  const range = fmtRange(step.startDate, end);
  const overdue = !!end && status !== 'done' && end < todayYmd();
  return (
    <div className="space-y-0.5">
      {step.vendor && <div className="font-bold break-words [overflow-wrap:anywhere]">{step.vendor}</div>}
      {range && (
        <div
          className={`font-mono text-[10px] ${overdue ? 'text-red-600 font-bold' : ''}`}
          title={overdue ? '종료일이 지났는데 완료되지 않았어요' : undefined}
        >
          {range}{estimated ? ' 예상' : ''}
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`${BADGE} ${sc.bg} ${sc.text} ${sc.border}`}>
          {getStatusLabel(status)}{status === 'done' && step.doneDate ? ` ${shortDate(step.doneDate)}` : ''}
        </span>
        {stepKey === 'knitting' && step.dailyKg ? (
          <span className="text-[9px] opacity-70">{fmtKg(step.dailyKg)}kg/일</span>
        ) : null}
      </div>
      {step.notes && (
        <div className="text-[10px] opacity-75 whitespace-pre-wrap line-clamp-2" title={step.notes}>{step.notes}</div>
      )}
    </div>
  );
};

// 공정 칸 (오더 단위, rowSpan) — 클릭하면 ProcessPopover
const StepCell = ({ order, stepKey, span, bg, ctx }) => {
  const step = order.steps?.[stepKey];
  const used = isStepUsed(step);
  const label = ORDER_STEPS.find(s => s.key === stepKey)?.label || '';
  const open = (el) => ctx.openProcess(order.id, stepKey, el);
  return (
    <td
      rowSpan={span}
      onClick={e => open(e.currentTarget)}
      className={cellCls({ thick: true, extra: `${CLICKABLE} ${used ? PROCESS_THEME[stepKey].cell : bg}` })}
    >
      <CellAction navKey={`step_${stepKey}`} onActivate={open} title={`${label} 일정 입력 (클릭 또는 Enter)`}>
        {used
          ? <StepSummary order={order} stepKey={stepKey} step={step} />
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

// 염가공 LOT 칸 (컬러 단위) — onOpenLots 가 있을 때만 클릭 가능
const LotCell = ({ order, color, lossRate, last, bg, ctx }) => {
  const lots = color.lots || [];
  const has = lots.length > 0;
  const canOpen = !!ctx.openLots;
  const open = (el) => ctx.openLots(order.id, color.id, el.getBoundingClientRect());

  const workKg = getWorkKg(color, lossRate);
  const total = getLotsTotalKg(lots);
  const status = getLotsStatus(lots);
  const mismatch = has && workKg !== null && Math.abs(total - workKg) >= 0.05;
  const starts = lots.map(l => l.startDate).filter(Boolean).sort();
  const ends = lots.map(l => l.endDate).filter(Boolean).sort();
  const range = fmtRange(starts[0], ends[ends.length - 1]);
  const tooltip = has
    ? lots.map(l => `LOT${l.no} ${l.machineKg ? `${fmtKg(l.machineKg)}kg탕 ` : ''}${fmtKg(l.qtyKg) || '-'}kg · ${getStatusLabel(l.status)}`).join('\n')
    : (canOpen ? '염가공 LOT 계획 입력' : undefined);

  return (
    <td
      onClick={canOpen ? e => open(e.currentTarget) : undefined}
      className={cellCls({ thick: last, extra: `${has ? PROCESS_THEME.dyeing.cell : bg} ${canOpen ? CLICKABLE : ''}` })}
    >
      <CellAction navKey="lots" onActivate={canOpen ? open : undefined} disabled={!canOpen} title={tooltip}>
        {has ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 min-w-0">
              {status && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${PROGRESS_STATUS_COLORS[status]?.dot || 'bg-slate-400'}`}
                  title={getStatusLabel(status)}
                />
              )}
              <span className="px-1 rounded bg-white/70 border border-orange-200 font-mono font-bold text-[10px] truncate">
                {getLotSummary(lots)}
              </span>
            </div>
            <div className={`font-mono text-[10px] ${mismatch ? 'text-orange-600 font-extrabold' : 'opacity-80'}`}>
              {lots.length} LOT · {fmtKg(total)}{workKg !== null ? `/${fmtKg(workKg)}` : ''}kg
            </div>
            {range && <div className="font-mono text-[10px] opacity-70">{range}</div>}
          </div>
        ) : (
          <span className="text-slate-300">{canOpen ? '+ LOT 계획' : '-'}</span>
        )}
      </CellAction>
    </td>
  );
};

// 컨펌 칸 (컬러 단위) — 클릭하면 ConfirmPopover
const ConfirmCell = ({ order, color, last, bg, ctx }) => {
  const st = getConfirmState(color);
  const rounds = color.confirmRounds || [];
  const lastRound = rounds[rounds.length - 1];
  const open = (el) => ctx.openConfirm(order.id, color.id, el);
  return (
    <td onClick={e => open(e.currentTarget)} className={cellCls({ thick: last, extra: `${CLICKABLE} ${bg}` })}>
      <CellAction navKey="confirm" onActivate={open} title="브랜드 컨펌 기록 (클릭 또는 Enter)">
        {st.key === 'none' ? (
          <span className="text-slate-300">+ 컨펌</span>
        ) : (
          <div className="space-y-0.5">
            <span className={`${BADGE} ${CONFIRM_BADGE[st.key] || CONFIRM_BADGE.ready}`}>{st.label}</span>
            {lastRound?.sentDate && (
              <div className="font-mono text-[10px] text-slate-500">{shortDate(lastRound.sentDate)} 발송</div>
            )}
          </div>
        )}
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

  // 고정 칸은 불투명 배경 필수 (가로 스크롤 내용이 비치지 않게)
  const stickyBg = `${isDraft ? 'bg-amber-50' : 'bg-white'} group-hover/ord:bg-teal-50`;
  const plainBg = `${isDraft ? 'bg-amber-50/40' : ''} group-hover/ord:bg-teal-50/60`;

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
      case 'greige':
        return (
          <td
            key="greige"
            onClick={focusInside}
            className={cellCls({ thick: last, extra: color.greigeOutDone ? PROCESS_THEME.greige.cell : plainBg })}
          >
            <CellDate
              value={color.greigeOutDate}
              navKey="greigeDate"
              placeholder="출고일"
              title="생지 출고일 (편직처 → 염색소)"
              onCommit={v => setColor(color.id, { greigeOutDate: v })}
            />
            <CellCheck
              checked={color.greigeOutDone}
              label="출고"
              navKey="greigeDone"
              className="mt-0.5 ml-1"
              title="생지 출고 완료"
              onCommit={done => setColor(color.id, doneWithDate(color, 'greigeOutDone', 'greigeOutDate', done))}
            />
          </td>
        );
      case 'dyeing':
        return <LotCell key="dyeing" order={order} color={color} lossRate={lossRate} last={last} bg={plainBg} ctx={ctx} />;
      case 'confirm':
        return <ConfirmCell key="confirm" order={order} color={color} last={last} bg={plainBg} ctx={ctx} />;
      case 'ship':
        return (
          <td
            key="ship"
            onClick={focusInside}
            className={cellCls({ thick: last, extra: color.shipDone ? PROCESS_THEME.ship.cell : plainBg })}
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
    <tbody className={`group/ord ${onHold ? '[&_td>*]:opacity-70' : ''}`}>
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
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setField('type', order.type === 'sample' ? 'main' : 'sample')}
                      title="클릭하면 메인/샘플 전환"
                      className={`px-1.5 py-px rounded border text-[9px] font-extrabold ${
                        order.type === 'sample'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      {order.type === 'sample' ? '샘플' : '메인'}
                    </button>
                    {completed && (
                      <span className="px-1 py-px rounded border bg-emerald-100 text-emerald-700 border-emerald-300 text-[9px] font-extrabold">
                        완료
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

            {/* ---------- 작지kg (자동=회색, 직접입력=검정) + 첫 줄 로스율 ---------- */}
            <td onClick={focusInside} className={cellCls({ thick: last, extra: plainBg })}>
              <div className="flex items-start">
                <CellNumber
                  value={workKg}
                  navKey="workKg"
                  placeholder="-"
                  rootClassName="flex-1 min-w-0"
                  className="text-slate-900"
                  displayClassName={manual ? 'font-bold' : '!text-slate-400'}
                  title={manual ? '직접 입력한 작지수량' : `자동 계산: 오더kg × (1 + 로스 ${fmtKg(lossRate)}%)`}
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
                  title="로스율 — 작지kg = 오더kg × (1 + 로스율)"
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
}) => {
  const scrollRef = useRef(null);
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
      ORDER_STEPS.forEach(s => { if (isStepUsed(o.steps?.[s.key])) bump(s.key); });
      const cs = o.colors || [];
      if (cs.some(c => c.greigeOutDate || c.greigeOutDone)) bump('greige');
      if (cs.some(c => (c.lots || []).length)) bump('dyeing');
      if (cs.some(c => (c.confirmRounds || []).length)) bump('confirm');
      if (cs.some(c => c.shipDate || c.shipDone)) bump('ship');
      if (o.notes) bump('memo');
    });
    return count;
  }, [orders]);

  const visibleFlow = FLOW_COLS.filter(c => !hiddenCols.includes(c.key));
  const columns = [...LEFT_COLS, ...QTY_COLS, ...visibleFlow];
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);

  // ---------- 컬럼 보이기/숨기기 ----------
  const saveHiddenCols = (next) => {
    setHiddenCols(next);
    try {
      localStorage.setItem(LS_HIDDEN_COLS, JSON.stringify(next));
    } catch { /* 저장 못 해도 화면은 그대로 동작 */ }
  };
  const toggleCol = (key) => saveHiddenCols(
    hiddenCols.includes(key) ? hiddenCols.filter(k => k !== key) : [...hiddenCols, key]
  );

  // ---------- 새 줄 / 컬러 줄 추가 + 자동 포커스 ----------
  const addDraft = () => {
    const id = actions.addDraftOrder();
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
  const vendorOptionsFor = (stepKey, orderId) => {
    const meta = ORDER_STEPS.find(s => s.key === stepKey);
    const fromMaster = meta?.vendorMaster ? toNames(masters?.[meta.vendorMaster]) : [];
    const source = Array.isArray(allOrders) ? allOrders : orders;
    const fromOrders = source.filter(o => o.id !== orderId).map(o => o.steps?.[stepKey]?.vendor);
    return [...new Set([...fromMaster, ...fromOrders].map(v => String(v || '').trim()).filter(Boolean))];
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
  const popColor = popover?.kind === 'confirm' ? popOrder?.colors?.find(c => c.id === popover.colorId) || null : null;

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
    openLots: onOpenLots || null,
    addColorAfter,
  };

  // ---------- 오더가 하나도 없을 때 ----------
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">표시할 오더가 없어요</p>
        <p className="text-xs text-slate-400 mt-1">
          엑셀처럼 한 줄씩 입력하면 바로 저장돼요. 새 줄에서 order#부터 입력해 주세요.
        </p>
        <button
          type="button"
          onClick={addDraft}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-bold shadow-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> 첫 오더 추가
        </button>
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
          {hiddenCols.length > 0 ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          칸 보이기/숨기기{hiddenCols.length > 0 ? ` (${hiddenCols.length}개 숨김)` : ''}
          <ChevronDown className={`w-3 h-3 transition-transform ${showColPanel ? 'rotate-180' : ''}`} />
        </button>
        <span className="text-[11px] text-slate-500">
          오더 {orders.length}건{draftRows.length > 0 ? ` · 저장 전 새 줄 ${draftRows.length}개` : ''}
        </span>
        <span className="ml-auto hidden lg:inline text-[10px] text-slate-400">
          Tab 다음 칸 · Enter 확정 후 아래 칸 · Esc 취소 · Alt+Enter 줄바꿈(detail·메모)
        </span>

        {showColPanel && (
          <div className="w-full flex items-center gap-1.5 flex-wrap pt-1">
            {FLOW_COLS.map(col => {
              const off = hiddenCols.includes(col.key);
              const n = usage[col.key] || 0;
              const theme = PROCESS_THEME[col.key];
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
            {hiddenCols.length > 0 && (
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
                const theme = PROCESS_THEME[c.key];
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

          {/* ---------- 맨 아래 줄: + 오더 추가 ---------- */}
          <tbody>
            <tr>
              <td colSpan={columns.length} className="p-0 border-b border-b-slate-200">
                <button
                  type="button"
                  onClick={addDraft}
                  className="w-full text-left py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  <span className="sticky left-0 inline-flex items-center gap-1 px-3">
                    <Plus className="w-3.5 h-3.5" /> 오더 추가
                  </span>
                </button>
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
        />
      )}
      {popover?.kind === 'process' && popOrder && (
        <ProcessPopover
          key={`process_${popOrder.id}_${popover.stepKey}`}
          order={popOrder}
          stepKey={popover.stepKey}
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
          onSave={rounds => actions.setColorField(popOrder.id, popColor.id, { confirmRounds: rounds })}
        />
      )}
      {popover?.kind === 'provisional' && popOrder && (
        <ProvisionalDuePopover
          key={`provisional_${popOrder.id}`}
          order={popOrder}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setProvisionalDue(popOrder.id, patch)}
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
