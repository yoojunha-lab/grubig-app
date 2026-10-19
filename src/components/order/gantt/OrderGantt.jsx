import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarPlus, Check, Crosshair, Flag, Plus } from 'lucide-react';
import {
  COLOR_STAGES, PROCESS_THEME, PROVISIONAL_STATES, INSPECTION_STATUSES, PRESETTING_KEY,
  YARN_ORDER_STATUSES, YARN_DYEING_KEY, DONE_TONE,
  getStatusLabel, getStepMeta, findStepMeta, getStepDefs, findStatusMeta,
} from '../../../constants/production';
import {
  describeProvisionalDue, describeStepCurrent,
  findDailyNote, getColorStage, getDday, getEndShift, getKnittingEstimatedEnd, getLossRate, getStepEnd, getWorkKg, isDropClosed,
  collectVendorOptions, isPieceDyed, getRoundStatus, isClosingPending, getColorDyeRemain, describeDyeRemain,
  getYarnOrderStatus,
} from '../../../utils/orderModel';
import { addDaysYmd, diffDaysYmd, fmtKg, shortDate, toDate, todayYmd } from '../../../utils/orderCalculations';
import { ProcessPopover } from '../sheet/ProcessPopover';
import { ConfirmPopover } from '../sheet/ColorPopovers';
import { ProvisionalDuePopover } from '../sheet/ProvisionalDuePopover';
import { GreigeOutPopover } from '../sheet/GreigeOutPopover';
import { InspectionPopover } from '../sheet/InspectionPopover';
import { ShipPopover } from '../sheet/ShipPopover';
import { ClosingPopover } from '../sheet/ClosingPopover';
import { YarnPopover } from '../sheet/YarnPopover';
import { GanttAddMenu } from './GanttAddMenu';
import { GanttDateMenu } from './GanttDateMenu';
import { SheetLinkChips } from '../common/SheetLinkChips';
import { OrderKindChip } from '../common/OrderKindChip';
import { DayNotePopover } from './DayNotePopover';
import {
  BAR_H, BAR_PAD, DAY_W, LABEL_W, LANE_H, MARK_H, WEEKDAY_KO, buildGanttLayout,
} from './ganttLayout';

// ============================================================
// 오더별 간트 (엑셀 현황표의 날짜별 status 칸 느낌)
// ------------------------------------------------------------
// - 가로 = 날짜 칸(하루 1칸), 세로 = 오더 줄 + 그 아래 컬러 줄
// - 줄마다 위쪽은 공정 막대 레인, 그 아래는 날짜 메모 (그날 현황 + 칸 색, 글자 전부 — 길면 줄바꿈)
// - 오더 줄 맨 위 = 가납기 깃발 (늦으면 빨강) + 그 날짜에 오더 묶음 전체를 지나는 세로 점선 → 막대와 비교
// - 막대 클릭: 공정·프리세팅·원사염색 → ProcessPopover / 원사(사종) → YarnPopover / LOT → onOpenLots / 컨펌 → ConfirmPopover /
//   생지출고 · 외관검사(LOT 차수·재가공) · 출고 → 그 입력 창
// - 깃발 클릭 → 가납기 입력(ProvisionalDuePopover) → actions.setProvisionalDue
// - 빈 날짜 칸 클릭 → 그 날에 넣기 메뉴(GanttDateMenu — 대표님 요청 2026-10-14 '메모 대신 공정을 넣을 수 있게')
//   공정 · 프리세팅 · 생지 출고 · 새 LOT · 외관검사 · 컨펌 · 출고 → 그 날짜가 들어간 입력 창 ([저장] = 현황표와 같은 저장)
//   맨 아래 '이 날 메모' / 써 둔 메모 글자를 누르면 그 메모 창 (DayNotePopover)
// - 주말 숨기기(기본 켬, 엑셀처럼 평일만) — 브라우저에 기억
// props: orders(저장된 오더, 현황표와 같은 순서), actions, masters, onOpenDetail(orderId),
//        onOpenLots(orderId, colorId, anchorRect, { newLotDate }), inspectVendorOptions
// ============================================================

const LS_HIDE_WEEKENDS = 'grubig.production.gantt.hideWeekends';
const TODAY_OFFSET_COLS = 2;   // 오늘 칸이 왼쪽에서 두세 번째 칸에 오도록
const MONTH_H = 20;
const DAY_H = 26;

const loadHideWeekends = () => {
  try {
    const v = localStorage.getItem(LS_HIDE_WEEKENDS);
    return v === null ? true : v !== '0';
  } catch {
    return true;
  }
};

// 날짜 칸 세로선 (줄마다 div 수백 개 대신 배경 그림으로)
const GRID_BG = {
  backgroundImage: 'linear-gradient(to right, rgb(226 232 240) 1px, transparent 1px)',
  backgroundSize: `${DAY_W}px 100%`,
  backgroundRepeat: 'repeat-x',
};

// 같은 칸에 공정이 여럿인 깃발 → 가장 나쁜 상태 (색·꼬리 글자는 그 상태로)
const worstMark = (marks) => marks.reduce((w, m) => (
  (PROVISIONAL_STATES[m.info.state]?.rank ?? 0) > (PROVISIONAL_STATES[w.info.state]?.rank ?? 0) ? m : w
), marks[0]);

const BADGE = 'inline-flex items-center px-1.5 py-px rounded-full border text-[10px] font-bold whitespace-nowrap';

// 범례 (공정 색)
const LEGEND = [
  { key: 'yarn', label: '원사 (사종)' },
  { key: 'yarn_dyeing', label: '원사염색' },
  { key: 'knitting', label: '편직' },
  { key: 'presetting', label: '프리세팅' },
  { key: 'greige', label: '생지출고' },
  { key: 'dyeing', label: '염가공 LOT' },
  { key: 'test', label: '시험성적서' },
  { key: 'confirm', label: '브랜드 컨펌' },
  { key: 'inspection', label: '외관검사' },
  { key: 'ship', label: '출고' },
];
const OTHER_STEP_DOTS = ['yarn_processing', 'finishing', 'physical_test', 'custom'];

// ============================================================
// 1. 작은 표시 컴포넌트
// ============================================================
// 납기 D-day: 지남=빨강 깜빡임, 오늘=D-Day, 7일 이내 빨강, 14일 이내 주황, 그 외 회색 (현황표와 같은 규칙)
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
  return <span className={`${BADGE} font-extrabold ${cls}`} title={due ? `납기 ${due}` : undefined}>{label}</span>;
};

// 오더 줄 라벨: order# · 구분(메인·신제품·재샘플 + 설계서 없음·아이템 선택) · (후염) · (설계서) · D-day / buyer · article# · detail
// (button 안에는 div 대신 span 만 — 올바른 HTML 구조. 설계서·구분 표시도 글자만 — 설계서 열기·구분 바꾸기는 상세창·현황표에서)
const OrderLabel = ({ order, sheetInfo = null, onOpenDetail }) => {
  const sub = [order.customer, order.articleNo, order.detail].filter(Boolean).join(' · ');
  const dim = order.status === 'on_hold';
  const completed = order.status === 'completed';
  const dropClosed = isDropClosed(order); // 설계서 Drop 으로 닫힌 샘플 → '완료' 대신 'Drop'
  return (
    <button
      type="button"
      onClick={() => onOpenDetail?.(order.id)}
      className="w-full h-full text-left pl-2.5 pr-8 py-1 flex flex-col justify-center hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400"
      title="누르면 오더 상세 보기"
    >
      {/* 완료된 오더(종결)는 이름 줄 배지까지 회색 (대표님 요청 2026-10-14) */}
      <span className={`flex items-center gap-1 w-full min-w-0 ${dim ? 'opacity-70' : ''} ${completed ? 'grayscale' : ''}`}>
        <span className="font-mono font-extrabold text-xs text-teal-700 truncate">{order.orderNumber || '(order# 없음)'}</span>
        <OrderKindChip order={order} />
        {order.dyeMethod && (
          <span className={`${BADGE} text-[9px] px-1 ${order.dyeMethod === 'piece' ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-pink-50 text-pink-700 border-pink-300'}`}>
            {order.dyeMethod === 'piece' ? '후염' : '선염'}
          </span>
        )}
        <SheetLinkChips info={sheetInfo} />
        {isClosingPending(order) && <span className={`${BADGE} text-[9px] px-1 bg-amber-50 text-amber-800 border-amber-300`}>마무리 대기</span>}
        {dim && <span className={`${BADGE} text-[9px] px-1 bg-white text-slate-500 border-slate-300 border-dashed`}>보류</span>}
        {completed && !dropClosed && <span className={`${BADGE} text-[9px] px-1 ${DONE_TONE.chip}`}>완료</span>}
        {dropClosed && !sheetInfo?.dropped && <span className={`${BADGE} text-[9px] px-1 ${DONE_TONE.chip}`}>Drop</span>}
        {/* 완료 오더는 D-day 숨김 (현황표·모바일 목록과 같은 규칙) */}
        {!completed && <span className="ml-auto shrink-0"><DdayBadge due={order.finalDueDate} /></span>}
      </span>
      <span className={`block w-full text-[10px] text-slate-500 truncate ${dim ? 'opacity-70' : ''}`} title={sub || undefined}>{sub || '—'}</span>
    </button>
  );
};

// 컬러 줄 라벨: 컬러명 · 생지kg · 단계 뱃지
//  마우스를 올리면 '생지 1,100kg · 남은 배색 120kg' (배색량을 넣었을 때 — 대표님 요청 2026-10-14)
const ColorLabel = ({ order, color }) => {
  const workKg = getWorkKg(color, getLossRate(order));
  const stage = COLOR_STAGES[getColorStage(order, color)] || COLOR_STAGES.waiting;
  const remain = getColorDyeRemain(order, color);
  const tip = [
    color.name || '컬러',
    workKg !== null ? `생지 ${fmtKg(workKg)}kg` : '',
    remain ? `${describeDyeRemain(remain)} (배색 ${fmtKg(remain.dyeKg)}kg)` : '',
  ].filter(Boolean).join(' · ');
  return (
    <div className={`h-full flex items-center gap-1.5 pl-6 pr-8 min-w-0 ${order.status === 'on_hold' ? 'opacity-70' : ''} ${order.status === 'completed' ? 'grayscale' : ''}`} title={tip}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
      <span className={`text-[11px] font-bold truncate ${color.name ? 'text-slate-700' : 'text-slate-400'}`}>{color.name || '컬러'}</span>
      {workKg !== null && (
        <span className="text-[10px] font-mono text-slate-500 shrink-0">{fmtKg(workKg)}kg</span>
      )}
      <span className={`ml-auto shrink-0 ${BADGE} ${stage.cls}`}>{stage.label}</span>
    </div>
  );
};

// ============================================================
// 2. 막대 툴팁 (마우스 올리면) — 자기 state 만 바뀌어서 간트 전체가 다시 그려지지 않음
// ============================================================
const TIP_MARGIN = 8;

const BarTooltip = ({ apiRef }) => {
  const [tip, setTip] = useState(null); // { x, rect, info }
  const boxRef = useRef(null);

  useImperativeHandle(apiRef, () => ({
    show: (next) => setTip(next),
    hide: () => setTip(null),
  }), []);

  // 실제 크기를 잰 뒤 화면 가장자리 보정 (setState 없이 DOM 스타일 직접)
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let left = tip.x;
    if (left + w > winW - TIP_MARGIN) left = winW - w - TIP_MARGIN;
    if (left < TIP_MARGIN) left = TIP_MARGIN;
    let top = tip.rect.bottom + 6;
    if (top + h > winH - TIP_MARGIN) top = tip.rect.top - h - 6;
    if (top < TIP_MARGIN) top = TIP_MARGIN;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [tip]);

  if (!tip) return null;
  const { info } = tip;
  return (
    <div
      ref={boxRef}
      role="tooltip"
      className="fixed z-[150] pointer-events-none max-w-[260px] bg-slate-900/95 text-white rounded-lg shadow-xl px-2.5 py-2 text-[11px] leading-snug"
      style={{ left: 0, top: 0, visibility: 'hidden' }}
    >
      <div className="text-[10px] text-slate-300 truncate">{info.owner}</div>
      <div className="font-extrabold">{info.title}</div>
      <div className="mt-1 space-y-0.5">
        {info.rows ? (
          // 가납기 깃발: 공정마다 한 줄 (가납기 → 현재 일정 비교)
          info.rows.map(r => (
            <div key={r.label}><span className="text-slate-400">{r.label}</span> {r.value}</div>
          ))
        ) : (
          <>
            <div>
              <span className="text-slate-400">기간</span> {info.range}
              {info.days ? <span className="text-slate-400"> ({info.days}일)</span> : null}
            </div>
            <div><span className="text-slate-400">상태</span> {info.status}</div>
            {info.vendorLabel && (
              <div><span className="text-slate-400">{info.vendorLabel}</span> {info.vendor || '미입력'}</div>
            )}
          </>
        )}
        {info.extra && <div className="text-slate-300 whitespace-pre-line">{info.extra}</div>}
      </div>
      {info.hint && <div className="mt-1 text-[10px] text-teal-300">{info.hint}</div>}
    </div>
  );
};

// 편직 "예상 종료" 막대인지 (종료일 없이 일일 생산량으로 계산된 끝이 있을 때만)
// getOrderTimeline 은 종료일만 없으면 estimated=true 라서, 일일 생산량이 없으면 시작일 하루짜리 막대인데도 '(예상)'이 붙음 → 여기서 걸러냄
const isEstimatedBar = (order, bar) => bar.kind === 'step' && !!bar.estimated && !!getKnittingEstimatedEnd(order);

// 막대의 원래 시작/끝 날짜 (한쪽만 입력된 경우 툴팁에 "미입력" 표시용)
const rawBarDates = (order, color, bar) => {
  if (bar.kind === 'step' || bar.kind === 'presetting') {
    return { s: order.steps?.[bar.stepKey]?.startDate || '', e: getStepEnd(order, bar.stepKey), sName: '예상 시작일', eName: '예상 종료일' };
  }
  if (bar.kind === 'lot') {
    const lot = (color?.lots || []).find(l => l.id === bar.lotId) || {};
    return { s: lot.startDate || '', e: lot.endDate || '', sName: '투입일', eName: '완료예정일' };
  }
  return { s: bar.start, e: bar.end, sName: '', eName: '' };
};

// 기간 글자: 'M/D~M/D' (+ 며칠) / 한쪽만 있으면 'M/D~ (종료일 미입력)'
const describeRange = (order, color, bar) => {
  const { s, e, sName, eName } = rawBarDates(order, color, bar);
  if (s && e) {
    return { range: s === e ? shortDate(s) : `${shortDate(s)}~${shortDate(e)}`, days: diffDaysYmd(s, e) + 1 };
  }
  if (s) return { range: `${shortDate(s)}~ (${eName} 미입력)`, days: 0 };
  if (e) return { range: `~${shortDate(e)} (${sName} 미입력)`, days: 0 };
  return { range: bar.start === bar.end ? shortDate(bar.start) : `${shortDate(bar.start)}~${shortDate(bar.end)}`, days: diffDaysYmd(bar.start, bar.end) + 1 };
};

// 막대 → 툴팁 내용
const describeBar = (order, color, bar, metaOf = getStepMeta) => {
  const owner = `${order.orderNumber || '새 오더'}${color ? ` · ${color.name || '컬러'}` : ' · 오더 전체'}`;
  const estimated = isEstimatedBar(order, bar);
  const base = { owner, title: `${bar.label}${estimated ? ' (생산량 계산)' : ''}`, ...describeRange(order, color, bar) };

  if (bar.kind === 'step' || bar.kind === 'presetting') {
    const preset = bar.kind === 'presetting';
    const meta = metaOf(bar.stepKey);
    const step = order.steps?.[bar.stepKey] || {};
    const shift = getEndShift(step);
    const lines = [];
    if (preset) lines.push('염색 전 · 오더 전체 공통 (염가공 LOT 창에서도 고쳐요)');
    if (bar.stepKey === YARN_DYEING_KEY) lines.push('선염 · 오더 전체 공통 (원사 칸 · 원사 창에서도 고쳐요)');
    if (shift) {
      const d = shift.diff;
      lines.push(`최초 예상 종료 ${shortDate(shift.first)}${shift.current ? ` → 지금 ${shortDate(shift.current)}` : ''}${d ? ` (${d > 0 ? `${d}일 늦어짐` : `${-d}일 당겨짐`})` : ''}`);
    }
    if (estimated) lines.push(`예상 종료일 미입력 → 하루 ${fmtKg(step.dailyKg)}kg 기준으로 계산한 종료`);
    else if (bar.stepKey === 'knitting' && step.startDate && !step.endDate) lines.push('기계별 일일 생산량을 넣으면 종료일이 계산돼요');
    if (step.notes) lines.push(step.notes);
    return {
      ...base,
      status: getStatusLabel(bar.status),
      vendorLabel: preset ? '염색소' : (meta?.vendorLabel || '외주처'),
      vendor: preset ? order.dyeVendor : step.vendor,
      extra: lines.join('\n'),
      hint: preset ? '누르면 프리세팅 일정 · 상태 수정' : '누르면 공정 일정 · 상태 수정',
    };
  }
  if (bar.kind === 'yarn') {
    // 원사 사종 줄 (v11 — 발주완료 ~ 입고)
    const y = (order.yarnOrders || []).find(x => x.id === bar.yarnId) || {};
    const lines = [];
    if (y.expectedDate) lines.push(`입고 예정 ${shortDate(y.expectedDate)}`);
    (y.events || []).forEach(e => lines.push(`${shortDate(e.date) || '날짜?'} ${findStatusMeta(YARN_ORDER_STATUSES, e.status)?.label || e.status}`));
    if (y.notes) lines.push(y.notes);
    return {
      ...base,
      status: findStatusMeta(YARN_ORDER_STATUSES, getYarnOrderStatus(y))?.label || '발주대기',
      vendorLabel: '원사처',
      vendor: y.vendor,
      extra: lines.join('\n'),
      hint: '누르면 원사 수정 (사종 · 재고 사용 · 원사염색)',
    };
  }
  if (bar.kind === 'lot') {
    const lot = (color?.lots || []).find(l => l.id === bar.lotId) || {};
    const lines = [lot.dyeKg ? `배색량 ${fmtKg(lot.dyeKg)}kg` : '', lot.notes || ''].filter(Boolean);
    return { ...base, status: getStatusLabel(bar.status), vendorLabel: '염색소', vendor: order.dyeVendor, extra: lines.join('\n'), hint: '누르면 LOT 계획 편집' };
  }
  if (bar.kind === 'inspection' || bar.kind === 'redye') {
    const lot = (color?.lots || []).find(l => l.id === bar.lotId) || {};
    const rounds = lot.inspections || [];
    const idx = rounds.findIndex(r => r.id === bar.roundId);
    const round = rounds[idx] || {};
    if (bar.kind === 'redye') {
      return {
        ...base,
        status: `${idx + 1}차 불량 → 염가공소 재가공 (다음 ${idx + 2}차 검사)`,
        vendorLabel: '염색소',
        vendor: order.dyeVendor,
        extra: round.notes || '',
        hint: '누르면 외관검사 수정',
      };
    }
    const st = findStatusMeta(INSPECTION_STATUSES, getRoundStatus(round));
    const lines = [];
    if (round.startDate || round.endDate) lines.push(`예상 ${shortDate(round.startDate) || '?'}~${shortDate(round.endDate) || '?'}`);
    (round.events || []).forEach(e => lines.push(`${shortDate(e.date) || '날짜?'} ${findStatusMeta(INSPECTION_STATUSES, e.status)?.label || e.status}`));
    if (round.notes) lines.push(round.notes);
    return {
      ...base,
      status: `LOT${lot.no || '?'} ${idx + 1}차 · ${st && st.key !== 'waiting' ? st.label : '투입 전 (계획)'}`,
      vendorLabel: '검사처',
      vendor: order.inspectVendor,
      extra: lines.join('\n'),
      hint: '누르면 외관검사 수정',
    };
  }
  if (bar.kind === 'confirm' || bar.kind === 'test') {
    const isTest = bar.kind === 'test';
    const status = bar.dashed ? '발행 예상일' : bar.open ? '결과 기다리는 중' : bar.status === 'done' ? '끝 (합격·컨펌)' : bar.status === 'issue' ? '불합격·리젝' : '진행중';
    return {
      ...base,
      status,
      vendorLabel: isTest ? '' : 'buyer',
      vendor: isTest ? '' : order.customer,
      hint: '누르면 시험성적서 · 브랜드 컨펌 기록 수정',
    };
  }
  if (bar.kind === 'greige') {
    const list = bar.scope === 'order' ? order.greigeOuts : color?.greigeOuts;
    const g = (list || []).find(x => x.id === bar.greigeId) || {};
    const route = `${order.steps?.knitting?.vendor || '편직처'} → ${order.dyeVendor || '염색소'}`;
    return {
      ...base,
      status: `${g.kind === 'partial' ? '부분' : '전체'} ${bar.status === 'done' ? '출고 완료' : '출고 예정'}${g.kg ? ` · ${fmtKg(g.kg)}kg` : ''}${bar.scope === 'order' ? ' (후염 · 오더 전체)' : ''}`,
      vendorLabel: '경로',
      vendor: route,
      extra: g.memo ? `메모: ${g.memo}` : '',
      hint: '누르면 생지 출고 수정',
    };
  }
  // ship
  return {
    ...base,
    status: bar.status === 'done' ? '출고 완료' : '출고 예정',
    vendorLabel: 'buyer',
    vendor: order.customer,
    hint: '누르면 출고 수정',
  };
};

// 가납기 깃발 → 툴팁 (같은 칸에 공정이 여럿이면 공정마다 한 줄: '편직 10/25  현재 종료 10/28 → 3일 늦음')
const describeFlag = (order, flag) => ({
  owner: `${order.orderNumber || '새 오더'} · 가납기`,
  title: `${flag.marks.map(m => m.label).join(' · ')} 가납기`,
  rows: flag.marks.map(m => {
    const desc = describeProvisionalDue(m.info);
    return {
      label: `${m.label} ${shortDate(m.date)}`,
      value: `현재 ${describeStepCurrent(m.info)}${desc.text ? ` → ${desc.text}` : ''}`,
    };
  }),
  hint: '누르면 가납기 수정',
});

// ============================================================
// 3. 날짜 머리글 (월 / M/D + 요일)
// ============================================================
const GanttHeader = ({ layout }) => (
  <div className="sticky top-0 z-30 flex bg-white border-b border-slate-300" style={{ width: LABEL_W + layout.width }}>
    <div
      className="sticky left-0 z-10 shrink-0 bg-slate-100 border-r-2 border-r-slate-300 px-2.5 pb-1 flex items-end text-[11px] font-extrabold text-slate-600"
      style={{ width: LABEL_W, height: MONTH_H + DAY_H }}
    >
      order# · color
    </div>
    <div className="relative shrink-0 bg-slate-50" style={{ width: layout.width, height: MONTH_H + DAY_H }}>
      {layout.months.map(m => (
        <div
          key={m.key}
          className="absolute top-0 border-l border-slate-300 border-b border-b-slate-200 bg-slate-100"
          style={{ left: m.startCol * DAY_W, width: m.count * DAY_W, height: MONTH_H }}
        >
          <div className="sticky inline-block px-1.5 text-[11px] font-extrabold text-slate-600 leading-5 whitespace-nowrap" style={{ left: LABEL_W + 4 }}>
            {m.label}
          </div>
        </div>
      ))}
      {layout.days.map((d, col) => {
        const weekStart = layout.hideWeekends ? d.dow === 1 : d.dow === 1 || d.day === 1;
        const dowCls = d.dow === 0 ? 'text-red-500' : d.dow === 6 ? 'text-blue-500' : 'text-slate-400';
        return (
          <div
            key={d.ymd}
            className={`absolute flex items-center justify-center gap-0.5 border-l text-[10px] leading-none whitespace-nowrap ${
              weekStart ? 'border-l-slate-300' : 'border-l-slate-200'
            } ${d.isToday ? 'bg-teal-600 text-white font-extrabold' : d.isWeekend ? 'bg-slate-100 text-slate-600 font-bold' : 'text-slate-600 font-bold'}`}
            style={{ left: col * DAY_W, width: DAY_W, top: MONTH_H, height: DAY_H }}
            title={d.isToday ? '오늘' : undefined}
          >
            <span className="font-mono">{d.month}/{d.day}</span>
            <span className={d.isToday ? 'text-teal-100' : dowCls}>{WEEKDAY_KO[d.dow]}</span>
          </div>
        );
      })}
    </div>
  </div>
);

// 본문 아래 깔리는 한 번만 그린 층: 오늘 칸 / 주말 칸 음영 / 주 구분선
const GanttUnderlay = ({ layout }) => (
  <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LABEL_W, width: layout.width }} aria-hidden="true">
    {layout.days.map((d, col) => {
      if (d.isToday) {
        return <div key={d.ymd} className="absolute top-0 bottom-0 bg-teal-50" style={{ left: col * DAY_W, width: DAY_W }} />;
      }
      if (d.isWeekend) {
        return <div key={d.ymd} className="absolute top-0 bottom-0 bg-slate-100/70" style={{ left: col * DAY_W, width: DAY_W }} />;
      }
      if (layout.hideWeekends && d.dow === 1 && col > 0) {
        return <div key={d.ymd} className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: col * DAY_W }} />;
      }
      return null;
    })}
  </div>
);

// ============================================================
// 4. 본체
// ============================================================
export const OrderGantt = ({
  orders = [], actions, masters = {}, stepDefs, onOpenDetail, onOpenLots, sheetLink = null, inspectVendorOptions = null,
  yarnHelpers = null, // 원사 창 { popoverProps(order) — 제안 목록 · 원단 원사 } (OrderListPage)
}) => {
  const today = todayYmd();
  const [hideWeekends, setHideWeekends] = useState(loadHideWeekends);
  // { kind:'process'|'confirm'|'greige'|'inspection'|'ship'|'closing'|'add'|'date'|'note'|'provisional',
  //   orderId, stepKey?, colorId?, date?, anchorRect, prefill? }
  const [popover, setPopover] = useState(null);
  const scrollRef = useRef(null);
  const tipRef = useRef(null);
  const viewRef = useRef(null);                 // 화면 왼쪽 첫 날짜 { ymd, offset } — 주말 토글·기간 변경 때 같은 날짜 유지
  const skipCellClickRef = useRef(false);       // 팝오버가 떠 있을 때 빈 칸 클릭 = 닫기만 (새 메모 창 안 엶)
  // 화면에 보이는 날짜 칸 수 — 와이드 모니터에서 날짜 칸을 더 그려 오른쪽 빈 곳을 채움 (대표님 요청 2026-10-14)
  const [viewCols, setViewCols] = useState(0);
  const hasOrders = orders.length > 0;

  // ---------- 간트 본문 폭 재기 (창 크기를 바꾸면 다시) ----------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewCols(Math.max(0, Math.ceil((el.clientWidth - LABEL_W) / DAY_W)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasOrders]);

  // 처음엔 오늘 칸이 왼쪽에서 세 번째 → 오늘 칸부터 (보이는 칸 − 2)칸이 있으면 화면 끝까지 날짜가 참
  const minColsFromToday = Math.max(0, viewCols - TODAY_OFFSET_COLS);
  const layout = useMemo(
    () => buildGanttLayout(orders, { today, hideWeekends, stepDefs, minColsFromToday }),
    [orders, today, hideWeekends, stepDefs, minColsFromToday]
  );
  const stepMetaOf = (key) => findStepMeta(stepDefs, key);

  // ---------- 가로 스크롤: 처음엔 오늘 칸이 왼쪽에서 세 번째, 이후엔 보던 날짜 유지 ----------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const view = viewRef.current;
    const col = view ? layout.colFwd(view.ymd) : null;
    const target = col !== null
      ? col * DAY_W + view.offset
      : Math.max(0, (layout.todayCol - TODAY_OFFSET_COLS) * DAY_W);
    if (Math.abs(el.scrollLeft - target) < 1) return undefined;
    el.scrollLeft = target;
    // 스타일이 아직 안 잡혀 스크롤이 안 됐으면 다음 프레임에 한 번 더
    const raf = requestAnimationFrame(() => {
      if (Math.abs(el.scrollLeft - target) >= 1) el.scrollLeft = target;
    });
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  const handleScroll = (e) => {
    tipRef.current?.hide();
    const el = e.currentTarget;
    const col = Math.floor(el.scrollLeft / DAY_W);
    const day = layout.days[col];
    if (day) viewRef.current = { ymd: day.ymd, offset: el.scrollLeft - col * DAY_W };
  };

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, (layout.todayCol - TODAY_OFFSET_COLS) * DAY_W), behavior: 'smooth' });
  };

  const toggleWeekends = () => {
    const next = !hideWeekends;
    setHideWeekends(next);
    try {
      localStorage.setItem(LS_HIDE_WEEKENDS, next ? '1' : '0');
    } catch { /* 저장 못 해도 화면은 그대로 동작 */ }
  };

  // ---------- 공정 외주처 제안: 마스터 + 다른 오더들이 쓴 값 (현황표와 같은 방식) ----------
  const vendorOptionsFor = (stepKey, orderId) => {
    const meta = stepMetaOf(stepKey);
    return collectVendorOptions(meta?.vendorMaster ? masters?.[meta.vendorMaster] : [], orders, o => o.steps?.[stepKey]?.vendor, orderId);
  };

  // ---------- 팝오버 ----------
  // 이 팝오버만 닫음 (저장이 끝나기 전에 다른 팝오버를 열었으면 늦게 끝난 저장이 새 팝오버를 닫지 않게)
  const closePopover = () => {
    const current = popover;
    setPopover(p => (p === current ? null : p));
  };
  const popOrder = popover ? orders.find(o => o.id === popover.orderId) || null : null;
  const popColor = popOrder && popover?.colorId
    ? (popOrder.colors || []).find(c => c.id === popover.colorId) || null
    : null;

  // 막대 클릭
  const handleBarClick = (e, order, color, bar) => {
    e.stopPropagation();
    skipCellClickRef.current = false; // 빈 칸 클릭 처리로 안 넘어갔으니 '닫기만' 표시도 여기서 지움
    tipRef.current?.hide();
    const r = e.currentTarget.getBoundingClientRect();
    // 긴 막대는 누른 위치 근처에 팝오버 (키보드 Enter 면 막대 왼쪽)
    const x = e.detail > 0 && e.clientX ? Math.max(r.left, e.clientX - 24) : r.left;
    const anchorRect = { left: x, right: x + 1, top: r.top, bottom: r.bottom, width: 1, height: r.height };
    if (bar.kind === 'step' || bar.kind === 'presetting') {
      setPopover({ kind: 'process', orderId: order.id, stepKey: bar.stepKey, anchorRect });
    } else if (bar.kind === 'yarn') {
      setPopover({ kind: 'yarn', orderId: order.id, anchorRect });
    } else if (bar.kind === 'lot' && color) {
      if (onOpenLots) onOpenLots(order.id, color.id, anchorRect);
      else onOpenDetail?.(order.id);
    } else if ((bar.kind === 'confirm' || bar.kind === 'test') && color) {
      setPopover({ kind: 'confirm', orderId: order.id, colorId: color.id, anchorRect });
    } else if (bar.kind === 'greige') {
      // 후염 출고 막대(오더 줄) = 오더 전체 / 선염 = 그 컬러
      setPopover({ kind: 'greige', orderId: order.id, colorId: bar.scope === 'order' ? null : color?.id || null, anchorRect });
    } else if ((bar.kind === 'inspection' || bar.kind === 'redye') && color) {
      setPopover({ kind: 'inspection', orderId: order.id, colorId: color.id, anchorRect });
    } else if (bar.kind === 'ship' && color) {
      setPopover({ kind: 'ship', orderId: order.id, colorId: color.id, anchorRect });
    } else {
      onOpenDetail?.(order.id);
    }
  };

  // 빈 곳을 누르기 시작할 때 팝오버(메모·공정·컨펌·LOT 편집 등 role="dialog")가 떠 있었는지 기억
  // → 그 클릭은 "바깥 클릭 = 닫기"로만 쓰고 새 메모 창은 열지 않음
  //   (React 핸들러가 PopoverShell 의 document mousedown 닫기보다 먼저 실행되므로 이 시점엔 아직 떠 있음)
  const handleCellMouseDown = () => {
    skipCellClickRef.current = !!document.querySelector('[role="dialog"]');
  };

  // 그 날짜 칸 창 (kind: 'date' = 그 날에 넣기 메뉴 / 'note' = 그 날 메모) — 누른 높이 바로 아래에 뜸
  const openDayPopover = (kind, e, order, color, col, left) => {
    if (skipCellClickRef.current) {
      skipCellClickRef.current = false;
      return;
    }
    const day = layout.days[col];
    if (!day) return;
    tipRef.current?.hide();
    const y = e.clientY || 0;
    setPopover({
      kind,
      orderId: order.id,
      colorId: color ? color.id : '',
      date: day.ymd,
      anchorRect: { left, right: left + DAY_W, top: y - 10, bottom: y + 10, width: DAY_W, height: 20 },
    });
  };

  // 빈 곳 클릭 → 그 날에 넣기 메뉴 (클릭 위치 ÷ 칸 폭 = 날짜) — 대표님 요청 2026-10-14 (메모는 메뉴 맨 아래)
  const handleCellClick = (e, order, color) => {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left) / DAY_W);
    openDayPopover('date', e, order, color, col, r.left + col * DAY_W);
  };

  // 메모 글자 클릭 → 그 메모 날짜의 메모 창 (글자가 옆 칸까지 넓게 써져 있어도 그 메모의 날짜로)
  const handleNoteClick = (e, order, color, note) => {
    e.stopPropagation();
    openDayPopover('note', e, order, color, note.col, e.currentTarget.getBoundingClientRect().left);
  };

  // 날짜 메뉴에서 고름 → 그 날짜가 들어간 입력 창 (같은 자리 — [저장]해야 반영)
  const handleDatePick = (kind, extra = {}) => {
    const cur = popover;
    if (!cur || cur.kind !== 'date') return;
    const { orderId, colorId, date, anchorRect } = cur;
    const order = orders.find(o => o.id === orderId);
    if (kind === 'process') {
      setPopover({ kind: 'process', orderId, stepKey: extra.stepKey, anchorRect, prefill: { [extra.field === 'endDate' ? 'endDate' : 'startDate']: date } });
    } else if (kind === 'greige') {
      setPopover({ kind: 'greige', orderId, colorId: isPieceDyed(order) ? null : colorId, anchorRect, prefillDate: date });
    } else if (kind === 'lots') {
      setPopover(null);
      if (onOpenLots && colorId) onOpenLots(orderId, colorId, anchorRect, { newLotDate: date });
    } else if (kind === 'inspection') {
      setPopover({ kind: 'inspection', orderId, colorId, anchorRect, prefill: { lotId: extra.lotId, field: extra.field, date } });
    } else if (kind === 'confirm') {
      setPopover({
        kind: 'confirm', orderId, colorId, anchorRect,
        prefill: extra.brandSent ? { brandSent: date } : { testExpected: date },
      });
    } else if (kind === 'ship') {
      setPopover({ kind: 'ship', orderId, colorId, anchorRect, prefillDate: date });
    } else if (kind === 'yarn') {
      setPopover({ kind: 'yarn', orderId, anchorRect });
    } else if (kind === 'note') {
      setPopover({ ...cur, kind: 'note' });
    }
  };

  // 줄 이름 옆 [+] → 일정 입력 메뉴 (고르면 같은 자리에 그 입력 창)
  const openAddMenu = (e, order, color) => {
    e.stopPropagation();
    skipCellClickRef.current = false;
    tipRef.current?.hide();
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({
      kind: 'add',
      orderId: order.id,
      colorId: color ? color.id : '',
      anchorRect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
    });
  };
  const handleAddPick = (kind, extra = {}) => {
    const cur = popover;
    if (!cur) return;
    const base = { orderId: cur.orderId, anchorRect: cur.anchorRect };
    if (kind === 'lots') {
      setPopover(null);
      if (onOpenLots && cur.colorId) onOpenLots(cur.orderId, cur.colorId, cur.anchorRect);
      return;
    }
    if (kind === 'process') setPopover({ ...base, kind: 'process', stepKey: extra.stepKey });
    else if (kind === 'provisional' || kind === 'closing' || kind === 'yarn') setPopover({ ...base, kind });
    else if (kind === 'greige') setPopover({ ...base, kind, colorId: extra.order ? null : cur.colorId });
    else setPopover({ ...base, kind, colorId: cur.colorId });
  };

  // 가납기 깃발 클릭 → 가납기 입력 창
  const handleFlagClick = (e, order) => {
    e.stopPropagation();
    skipCellClickRef.current = false;
    tipRef.current?.hide();
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({
      kind: 'provisional',
      orderId: order.id,
      anchorRect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
    });
  };

  const showTip = (e, order, color, bar) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.type === 'mouseenter' && e.clientX ? Math.max(rect.left, e.clientX - 20) : rect.left;
    tipRef.current?.show({ x, rect, info: describeBar(order, color, bar, stepMetaOf) });
  };
  const showFlagTip = (e, order, flag) => {
    const rect = e.currentTarget.getBoundingClientRect();
    tipRef.current?.show({ x: rect.left, rect, info: describeFlag(order, flag) });
  };
  const hideTip = () => tipRef.current?.hide();

  // ---------- 막대 ----------
  // 최초 예상 종료일 테두리 (공정 — 예상 종료일을 바꾼 적이 있으면 회색 점선: 막대가 더 길면 늦어진 것)
  //  막대 위에 테두리만 그림 (늦어졌을 때도 최초 끝이 막대 안에 보이게, 누르기는 막대가 받음)
  const renderBaseline = (bar) => (
    <div
      key={`${bar.id}_base`}
      className="absolute z-[3] rounded-md border-2 border-dashed border-slate-500/80 pointer-events-none"
      style={{
        left: bar.startCol * DAY_W + (bar.clipL ? 0 : 1),
        width: (bar.baseEndCol - bar.startCol + 1) * DAY_W - (bar.clipL ? 1 : 2),
        top: BAR_PAD + bar.lane * LANE_H - 1,
        height: BAR_H + 2,
      }}
      aria-hidden="true"
    />
  );

  // 끝난 막대 · 완료된 오더(종결)의 막대 = 회색 (대표님 요청 2026-10-14 '종결된 건 회색으로 통일') — ✓ 는 끝난 막대만
  //  완료된 오더는 '문제' 빨간 테두리도 안 씀 (끝난 오더에 경고가 남지 않게)
  const renderBar = (order, color, bar) => {
    const closed = order.status === 'completed';
    const done = bar.status === 'done';
    const issue = bar.status === 'issue' && !closed;
    const barCls = closed || done ? DONE_TONE.bar : (PROCESS_THEME[bar.theme] || PROCESS_THEME.custom).bar;
    const estimated = isEstimatedBar(order, bar);
    const dashed = estimated || !!bar.dashed;
    const rounded = `${bar.clipL ? 'rounded-l-none border-l-0' : 'rounded-l-md'} ${bar.clipR ? 'rounded-r-none border-r-0' : 'rounded-r-md'}`;
    const button = (
      <button
        key={bar.id}
        type="button"
        onClick={e => handleBarClick(e, order, color, bar)}
        onMouseEnter={e => showTip(e, order, color, bar)}
        onMouseLeave={hideTip}
        onFocus={e => showTip(e, order, color, bar)}
        onBlur={hideTip}
        className={`absolute z-[2] flex items-center px-1 border text-[10px] font-bold leading-none whitespace-nowrap text-left transition-shadow hover:shadow-md hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${barCls} ${rounded} ${
          issue ? 'ring-2 ring-red-500' : ''
        } ${dashed ? 'border-dashed' : ''}`}
        style={{
          left: bar.startCol * DAY_W + (bar.clipL ? 0 : 2),
          width: (bar.endCol - bar.startCol + 1) * DAY_W - (bar.clipL ? 0 : 2) - (bar.clipR ? 0 : 2),
          top: BAR_PAD + bar.lane * LANE_H,
          height: BAR_H,
        }}
      >
        {/* 긴 막대가 왼쪽으로 스크롤돼도 이름이 보이도록 라벨 칸 옆에 붙어 있음 (sticky) */}
        <span className="sticky inline-flex items-center gap-0.5 max-w-full min-w-0 overflow-hidden" style={{ left: LABEL_W + 4 }}>
          {done && <Check className="w-3 h-3 shrink-0" strokeWidth={3} />}
          {issue && <AlertTriangle className="w-3 h-3 shrink-0 text-red-600" />}
          <span className="truncate">{bar.label}{estimated ? ' (계산)' : ''}</span>
        </span>
      </button>
    );
    if (bar.baseEndCol === null || bar.baseEndCol === undefined) return button;
    return [renderBaseline(bar), button];
  };

  // ---------- 메모 (막대 아래, 엑셀 날짜 칸처럼 색 + 글자 전부) ----------
  //  그 날짜 칸에서 시작해 글자 길이만큼(최대 4칸) 넓게 쓰고, 그보다 길면 줄을 바꿈.
  //  바로 옆 날짜에도 메모가 있으면 아래 단(lane)으로 → 줄 높이가 늘어남
  const renderNote = (order, color, note) => (
    <div
      key={`n${note.col}`}
      onClick={e => handleNoteClick(e, order, color, note)}
      className={`relative z-[1] justify-self-start self-start ml-px mt-0.5 px-1 py-px rounded-sm text-[10px] font-semibold leading-snug whitespace-pre-wrap break-words cursor-pointer hover:brightness-95 ${note.cls}`}
      style={{
        gridColumn: `${note.col + 1} / span ${note.span}`,
        gridRow: note.lane + 1,
        minWidth: DAY_W - 2,
        maxWidth: note.span * DAY_W - 2,
      }}
      title={`${note.title}\n(누르면 메모 수정)`}
    >
      {note.text}
    </div>
  );

  // ---------- 가납기 깃발 (오더 줄 맨 위) — 깃발 오른쪽 끝 = 그 날짜 칸 끝 (납기 점선과 같은 기준) ----------
  //  완료된 오더(종결)는 깃발 · 점선도 회색 (늦게 끝났어도 — 숫자 꼬리 '+3'은 그대로)
  const renderFlag = (order, flag) => {
    const worst = worstMark(flag.marks);
    const st = order.status === 'completed' ? PROVISIONAL_STATES.done : (PROVISIONAL_STATES[worst.info.state] || PROVISIONAL_STATES.none);
    const tail = describeProvisionalDue(worst.info).short;
    return (
      <button
        key={`f${flag.col}`}
        type="button"
        onClick={e => handleFlagClick(e, order)}
        onMouseEnter={e => showFlagTip(e, order, flag)}
        onMouseLeave={hideTip}
        onFocus={e => showFlagTip(e, order, flag)}
        onBlur={hideTip}
        className={`absolute top-0.5 z-[4] inline-flex items-center gap-0.5 px-1 rounded-sm border text-[9px] font-extrabold leading-none whitespace-nowrap shadow-sm hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${st.flag}`}
        style={{ right: layout.width - (flag.col + 1) * DAY_W + 1, height: MARK_H - 3 }}
      >
        <Flag className="w-2.5 h-2.5 shrink-0" strokeWidth={2.5} />
        {flag.marks.map(m => m.short).join('·')}
        {tail && <span>{tail}</span>}
      </button>
    );
  };

  // 가납기 세로 점선 — 오더 묶음(오더 줄 + 컬러 줄) 전체를 지나서 아래 막대 끝과 비교
  const renderFlagGuide = (order, flag) => {
    const st = order.status === 'completed' ? PROVISIONAL_STATES.done : (PROVISIONAL_STATES[worstMark(flag.marks).info.state] || PROVISIONAL_STATES.none);
    return (
      <div
        key={`g${flag.col}`}
        className={`absolute top-0 bottom-0 z-[1] pointer-events-none border-r-2 border-dotted opacity-60 ${st.line}`}
        style={{ left: LABEL_W + flag.col * DAY_W, width: DAY_W }}
        aria-hidden="true"
      />
    );
  };

  // ---------- 한 줄 (오더 줄 / 컬러 줄) ----------
  //  [가납기 깃발 줄(오더 줄만)] [막대 레인] [메모] — 메모가 길면 줄 높이가 늘어남 (minHeight)
  const renderRow = (group, row) => {
    const { order } = group;
    const isOrder = row.kind === 'order';
    const dim = order.status === 'on_hold';
    const closed = order.status === 'completed'; // 완료된 오더(종결) = 줄 전체 회색 (2026-10-14)
    return (
      <div key={row.key} className="flex border-b border-slate-100 last:border-b-0" style={{ minHeight: row.minH }}>
        <div
          className={`sticky left-0 z-20 shrink-0 border-r-2 border-r-slate-300 ${closed ? 'bg-slate-100' : isOrder ? 'bg-slate-50' : 'bg-white'}`}
          style={{ width: LABEL_W }}
        >
          {isOrder
            ? <OrderLabel order={order} sheetInfo={sheetLink?.infoOf?.(order) || null} onOpenDetail={onOpenDetail} />
            : <ColorLabel order={order} color={row.color} />}
          {/* [+] 일정 입력 메뉴 — 아직 막대가 없는 일정도 간트에서 바로 시작 */}
          <button
            type="button"
            onClick={e => openAddMenu(e, order, row.color)}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-[1] p-1 rounded-md text-slate-300 hover:text-teal-700 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            title={isOrder ? '공정 일정 · 프리세팅 · 가납기 · 마무리 입력' : '생지 출고 · LOT · 컨펌 · 외관검사 · 출고 입력'}
            aria-label={isOrder ? `${order.orderNumber} 공정 일정 입력` : `${row.color?.name || '컬러'} 일정 입력`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div
          className={`relative shrink-0 cursor-pointer ${closed ? 'bg-slate-400/[0.12]' : isOrder ? 'bg-slate-400/[0.06]' : ''} ${dim ? 'opacity-70' : ''}`}
          style={{ width: layout.width, ...GRID_BG }}
          onMouseDown={handleCellMouseDown}
          onClick={e => handleCellClick(e, order, row.color)}
        >
          {group.dueCol !== null && (
            <div className="absolute top-0 bottom-0 bg-red-50/70" style={{ left: group.dueCol * DAY_W, width: DAY_W }} aria-hidden="true" />
          )}
          {row.flags.length > 0 && (
            <div className="relative" style={{ height: MARK_H }}>
              {row.flags.map(flag => renderFlag(order, flag))}
            </div>
          )}
          <div className="relative" style={{ height: row.barsH }}>
            {row.bars.map(bar => renderBar(order, row.color, bar))}
          </div>
          {row.notes.length > 0 && (
            <div className="grid pb-1" style={{ gridTemplateColumns: `repeat(${layout.days.length}, ${DAY_W}px)` }}>
              {row.notes.map(note => renderNote(order, row.color, note))}
            </div>
          )}
          {group.dueCol !== null && (
            <div
              className="absolute top-0 bottom-0 z-[3] pointer-events-none border-r-2 border-dashed border-red-500/80"
              style={{ left: group.dueCol * DAY_W, width: DAY_W }}
              aria-hidden="true"
            >
              {isOrder && (
                <span className="absolute right-0.5 bottom-0.5 px-1 rounded-sm bg-red-500 text-white text-[9px] font-extrabold leading-3">
                  납기
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 표시 기간 글자 (해가 바뀌면 끝 날짜에도 연도)
  const firstDay = layout.days[0];
  const lastDay = layout.days[layout.days.length - 1];
  const rangeLabel = firstDay && lastDay
    ? `${firstDay.year}.${firstDay.month}.${firstDay.day} ~ ${lastDay.year !== firstDay.year ? `${lastDay.year}.` : ''}${lastDay.month}.${lastDay.day}`
    : '';

  // 주말을 숨겼을 때 월요일 칸에 함께 보이는 토·일 메모 (메모 창에서 읽기 전용 안내)
  const hiddenWeekendNotes = (order, colorId, date) => {
    if (!hideWeekends || toDate(date)?.getDay() !== 1) return [];
    return [-2, -1]
      .map(n => findDailyNote(order, addDaysYmd(date, n), colorId))
      .filter(Boolean);
  };

  // ---------- 오더 없음 ----------
  if (!orders.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <CalendarDays className="w-8 h-8 mx-auto text-slate-300" />
        <p className="mt-2 text-sm font-bold text-slate-600">간트에 표시할 오더가 없어요.</p>
        <p className="mt-1 text-xs text-slate-400">현황표에서 오더를 추가하고 공정 일정·LOT·출고일·가납기를 입력하면 여기에 그려져요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500">
          <CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-extrabold text-slate-700">오더별 간트</span>
          <span className="font-mono text-[11px]">{rangeLabel}</span>
          <span className="text-[11px]">· 오더 {orders.length}개</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer select-none hover:bg-slate-50">
            <input type="checkbox" checked={hideWeekends} onChange={toggleWeekends} className="accent-teal-600" />
            주말 숨기기
          </label>
          <button
            type="button"
            onClick={scrollToToday}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 text-xs font-bold text-teal-700 hover:bg-teal-100"
            title="오늘 날짜로 이동"
          >
            <Crosshair className="w-3.5 h-3.5" /> 오늘
          </button>
        </div>
      </div>

      {/* 간트 본문 (가로·세로 스크롤, 머리글·라벨 고정) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 240px)', minHeight: 200 }}
      >
        <div className="relative" style={{ width: LABEL_W + layout.width }}>
          <GanttHeader layout={layout} />
          <div className="relative">
            <GanttUnderlay layout={layout} />
            {layout.groups.map(group => (
              <div key={group.order.id} className="relative border-b-2 border-slate-300">
                {group.rows.map(row => renderRow(group, row))}
                {group.flags.map(flag => renderFlagGuide(group.order, flag))}
              </div>
            ))}
            {layout.todayCol >= 0 && (
              <div
                className="absolute top-0 bottom-0 z-[5] w-0.5 bg-teal-500 pointer-events-none"
                style={{ left: LABEL_W + layout.todayCol * DAY_W }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-3 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
        {LEGEND.map(l => (
          <span key={l.key} className="inline-flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${PROCESS_THEME[l.key].dot}`} />{l.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex gap-px">
            {OTHER_STEP_DOTS.map(k => <span key={k} className={`w-1.5 h-2.5 rounded-sm ${PROCESS_THEME[k].dot}`} />)}
          </span>
          기타 공정(사가공·후가공·이화학·추가 공정)
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1"><span className="w-0.5 h-3 bg-teal-500" />오늘</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 border-r-2 border-dashed border-red-500" />납기</span>
        <span className="inline-flex items-center gap-1" title="오더 줄 맨 위 깃발 + 세로 점선. 지금 일정이 가납기보다 늦으면 빨강">
          <Flag className="w-3 h-3 text-slate-500" />가납기
          <span className={`px-1 rounded-sm border text-[9px] font-extrabold ${PROVISIONAL_STATES.ok.flag}`}>맞음</span>
          <span className={`px-1 rounded-sm border text-[9px] font-extrabold ${PROVISIONAL_STATES.late.flag}`}>늦음</span>
        </span>
        <span className="inline-flex items-center gap-1" title="끝난 막대 · 완료된 오더는 모두 회색">
          <span className={`inline-flex items-center px-1 rounded-sm border ${DONE_TONE.bar}`}><Check className="w-3 h-3" strokeWidth={3} /></span>완료(회색)
        </span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm ring-2 ring-red-500 bg-white" />문제</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm border border-dashed border-yellow-500 bg-yellow-100" />생산량 계산</span>
        <span className="inline-flex items-center gap-1" title="예상 종료일을 바꾼 공정 — 회색 점선이 최초 예상 종료일까지"><span className="w-3 h-2.5 rounded-sm border-2 border-dashed border-slate-400 bg-slate-300/20" />최초 예상</span>
        <span className="inline-flex items-center gap-1" title="외관검사 1차 불량 → 염가공소 재가공 → 다음 차수 검사"><span className={`w-3 h-2.5 rounded-sm border border-dashed ${PROCESS_THEME.redye.bar}`} />재가공</span>
        <span className="ml-auto inline-flex items-center gap-1 font-bold text-teal-700">
          <CalendarPlus className="w-3.5 h-3.5" /> 빈 날짜 칸을 누르면 그 날에 공정 넣기 (메모는 메뉴 맨 아래) — 저장하면 현황표에도 반영
        </span>
      </div>

      <BarTooltip apiRef={tipRef} />

      {/* ---------- 팝오버 ---------- */}
      {popover?.kind === 'date' && popOrder && (!popover.colorId || popColor) && (
        <GanttDateMenu
          key={`date_${popOrder.id}_${popover.colorId}_${popover.date}`}
          order={popOrder}
          color={popColor}
          date={popover.date}
          stepDefs={stepDefs || getStepDefs([])}
          anchorRect={popover.anchorRect}
          onPick={handleDatePick}
          onClose={closePopover}
          canOpenLots={!!onOpenLots}
          hasNote={!!findDailyNote(popOrder, popover.date, popover.colorId || '')}
        />
      )}
      {popover?.kind === 'process' && popOrder && (
        <ProcessPopover
          key={`process_${popOrder.id}_${popover.stepKey}_${popover.prefill ? JSON.stringify(popover.prefill) : ''}`}
          order={popOrder}
          stepKey={popover.stepKey}
          meta={stepMetaOf(popover.stepKey)}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setStep(popOrder.id, popover.stepKey, patch)}
          vendorOptions={vendorOptionsFor(popover.stepKey, popOrder.id)}
          simple={popover.stepKey === PRESETTING_KEY}
          prefill={popover.prefill || null}
        />
      )}
      {popover?.kind === 'confirm' && popOrder && popColor && (
        <ConfirmPopover
          key={`confirm_${popOrder.id}_${popColor.id}_${popover.prefill ? JSON.stringify(popover.prefill) : ''}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setColorTracks(popOrder.id, popColor.id, patch)}
          prefill={popover.prefill || null}
        />
      )}
      {popover?.kind === 'greige' && popOrder && (popColor || !popover.colorId) && (
        <GreigeOutPopover
          key={`greige_${popOrder.id}_${popover.colorId || 'order'}_${popover.prefillDate || ''}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={(entries, base, scope) => (scope === 'order'
            ? actions.setOrderGreigeOuts(popOrder.id, entries, base)
            : actions.setGreigeOuts(popOrder.id, popColor.id, entries, base))}
          onSetDyeMethod={m => actions.setDyeMethod(popOrder.id, m)}
          prefillDate={popover.prefillDate || ''}
        />
      )}
      {popover?.kind === 'add' && popOrder && (!popover.colorId || popColor) && (
        <GanttAddMenu
          key={`add_${popOrder.id}_${popover.colorId}`}
          order={popOrder}
          color={popColor}
          stepDefs={stepDefs || getStepDefs([])}
          anchorRect={popover.anchorRect}
          onPick={handleAddPick}
          onClose={closePopover}
          canOpenLots={!!onOpenLots}
        />
      )}
      {popover?.kind === 'ship' && popOrder && popColor && (
        <ShipPopover
          key={`ship_${popOrder.id}_${popColor.id}_${popover.prefillDate || ''}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patch => actions.setColorField(popOrder.id, popColor.id, patch)}
          prefillDate={popover.prefillDate || ''}
        />
      )}
      {popover?.kind === 'inspection' && popOrder && popColor && (
        <InspectionPopover
          key={`inspection_${popOrder.id}_${popColor.id}_${popover.prefill ? JSON.stringify(popover.prefill) : ''}`}
          order={popOrder}
          color={popColor}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={patchByLot => actions.setLotInspections(popOrder.id, popColor.id, patchByLot)}
          onSaveVendor={v => actions.setOrderField(popOrder.id, 'inspectVendor', v)}
          vendorOptions={inspectVendorOptions || collectVendorOptions([], orders, o => o.inspectVendor)}
          onOpenLots={onOpenLots ? () => onOpenLots(popOrder.id, popColor.id, popover.anchorRect) : undefined}
          prefill={popover.prefill || null}
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
      {popover?.kind === 'note' && popOrder && (!popover.colorId || popColor) && (
        <DayNotePopover
          key={`note_${popOrder.id}_${popover.colorId}_${popover.date}`}
          order={popOrder}
          color={popColor}
          date={popover.date}
          weekendNotes={hiddenWeekendNotes(popOrder, popover.colorId || '', popover.date)}
          anchorRect={popover.anchorRect}
          onClose={closePopover}
          onSave={note => actions.setDailyNote(popOrder.id, note)}
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
    </div>
  );
};

export default OrderGantt;
