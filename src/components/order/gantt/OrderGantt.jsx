import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Crosshair, Flag, StickyNote } from 'lucide-react';
import {
  COLOR_STAGES, ORDER_STEPS, ORDER_TYPES, PROCESS_THEME, PROVISIONAL_STATES, getStatusLabel, getStepMeta,
} from '../../../constants/production';
import {
  describeProvisionalDue, describeStepCurrent,
  findDailyNote, getColorStage, getDday, getKnittingEstimatedEnd, getLossRate, getStepEnd, getWorkKg, isDropClosed,
} from '../../../utils/orderModel';
import { addDaysYmd, diffDaysYmd, fmtKg, shortDate, toDate, todayYmd } from '../../../utils/orderCalculations';
import { ProcessPopover } from '../sheet/ProcessPopover';
import { ConfirmPopover } from '../sheet/ColorPopovers';
import { ProvisionalDuePopover } from '../sheet/ProvisionalDuePopover';
import { SheetLinkChips } from '../common/SheetLinkChips';
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
// - 막대 클릭: 공정 → ProcessPopover / LOT → onOpenLots / 컨펌 → ConfirmPopover / 생지출고·출고 → 상세창
// - 깃발 클릭 → 가납기 입력(ProvisionalDuePopover) → actions.setProvisionalDue
// - 빈 곳·메모 클릭 → 그날 메모(DayNotePopover) → actions.setDailyNote
// - 주말 숨기기(기본 켬, 엑셀처럼 평일만) — 브라우저에 기억
// props: orders(저장된 오더, 현황표와 같은 순서), actions, masters, onOpenDetail(orderId), onOpenLots(orderId, colorId, anchorRect)
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

const TYPE_CHIP = {
  main: 'bg-teal-50 text-teal-700 border-teal-200',
  sample: 'bg-violet-50 text-violet-700 border-violet-200',
};

// 범례 (공정 색)
const LEGEND = [
  { key: 'knitting', label: '편직' },
  { key: 'greige', label: '생지출고' },
  { key: 'dyeing', label: '염가공 LOT' },
  { key: 'confirm', label: '컨펌' },
  { key: 'ship', label: '출고' },
];
const OTHER_STEP_DOTS = ['yarn', 'finishing', 'physical_test'];

// 마스터 목록(문자열 또는 {name}) → 이름 배열
const toNames = (list) => (Array.isArray(list) ? list : [])
  .map(v => (typeof v === 'string' ? v : v?.name))
  .filter(Boolean);

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

// 오더 줄 라벨: order# · 구분 · (설계서) · D-day / buyer · article# · detail
// (button 안에는 div 대신 span 만 — 올바른 HTML 구조. 설계서 표시도 글자만 — 설계서 열기는 상세창·현황표에서)
const OrderLabel = ({ order, sheetInfo = null, onOpenDetail }) => {
  const typeLabel = ORDER_TYPES.find(t => t.key === order.type)?.label || '메인';
  const sub = [order.customer, order.articleNo, order.detail].filter(Boolean).join(' · ');
  const dim = order.status === 'on_hold';
  const completed = order.status === 'completed';
  const dropClosed = isDropClosed(order); // 설계서 Drop 으로 닫힌 샘플 → '완료' 대신 'Drop'
  return (
    <button
      type="button"
      onClick={() => onOpenDetail?.(order.id)}
      className="w-full h-full text-left px-2.5 py-1 flex flex-col justify-center hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400"
      title="누르면 오더 상세 보기"
    >
      <span className={`flex items-center gap-1 w-full min-w-0 ${dim ? 'opacity-70' : ''}`}>
        <span className="font-mono font-extrabold text-xs text-teal-700 truncate">{order.orderNumber || '(order# 없음)'}</span>
        <span className={`${BADGE} text-[9px] px-1 ${TYPE_CHIP[order.type] || TYPE_CHIP.main}`}>{typeLabel}</span>
        <SheetLinkChips info={sheetInfo} />
        {dim && <span className={`${BADGE} text-[9px] px-1 bg-slate-200 text-slate-600 border-slate-300`}>보류</span>}
        {completed && !dropClosed && <span className={`${BADGE} text-[9px] px-1 bg-emerald-100 text-emerald-700 border-emerald-300`}>완료</span>}
        {dropClosed && !sheetInfo?.dropped && <span className={`${BADGE} text-[9px] px-1 bg-rose-50 text-rose-600 border-rose-200`}>Drop</span>}
        {/* 완료 오더는 D-day 숨김 (현황표·모바일 목록과 같은 규칙) */}
        {!completed && <span className="ml-auto shrink-0"><DdayBadge due={order.finalDueDate} /></span>}
      </span>
      <span className={`block w-full text-[10px] text-slate-500 truncate ${dim ? 'opacity-70' : ''}`} title={sub || undefined}>{sub || '—'}</span>
    </button>
  );
};

// 컬러 줄 라벨: 컬러명 · 작지kg · 단계 뱃지
const ColorLabel = ({ order, color }) => {
  const workKg = getWorkKg(color, getLossRate(order));
  const stage = COLOR_STAGES[getColorStage(order, color)] || COLOR_STAGES.waiting;
  return (
    <div className={`h-full flex items-center gap-1.5 pl-6 pr-2.5 min-w-0 ${order.status === 'on_hold' ? 'opacity-70' : ''}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
      <span className={`text-[11px] font-bold truncate ${color.name ? 'text-slate-700' : 'text-slate-400'}`}>{color.name || '컬러'}</span>
      {workKg !== null && (
        <span className="text-[10px] font-mono text-slate-500 shrink-0" title="작지kg">{fmtKg(workKg)}kg</span>
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
        {info.extra && <div className="text-slate-300">{info.extra}</div>}
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
  if (bar.kind === 'step') {
    return { s: order.steps?.[bar.stepKey]?.startDate || '', e: getStepEnd(order, bar.stepKey), sName: '시작일', eName: '종료일' };
  }
  if (bar.kind === 'lot') {
    const lot = (color?.lots || []).find(l => l.id === bar.lotId) || {};
    return { s: lot.startDate || '', e: lot.endDate || '', sName: '투입일', eName: '완료예정일' };
  }
  if (bar.kind === 'confirm') {
    const ri = Number(String(bar.id).slice(String(bar.id).lastIndexOf('_') + 1));
    const r = (color?.confirmRounds || [])[ri] || {};
    return { s: r.sentDate || '', e: r.resultDate || '', sName: '발송일', eName: '결과일' };
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
const describeBar = (order, color, bar) => {
  const owner = `${order.orderNumber || '새 오더'}${color ? ` · ${color.name || '컬러'}` : ' · 오더 전체'}`;
  const estimated = isEstimatedBar(order, bar);
  const base = { owner, title: `${bar.label}${estimated ? ' (예상)' : ''}`, ...describeRange(order, color, bar) };

  if (bar.kind === 'step') {
    const meta = getStepMeta(bar.stepKey);
    const step = order.steps?.[bar.stepKey] || {};
    let extra = step.notes || '';
    if (estimated) extra = `종료일 미입력 → 일일 ${fmtKg(step.dailyKg)}kg 기준 예상 종료`;
    else if (bar.stepKey === 'knitting' && step.startDate && !step.endDate) extra = '일일 생산량을 넣으면 예상 종료일이 계산돼요';
    return {
      ...base,
      status: getStatusLabel(bar.status),
      vendorLabel: meta?.vendorLabel || '외주처',
      vendor: step.vendor,
      extra,
      hint: '누르면 공정 일정 수정',
    };
  }
  if (bar.kind === 'lot') {
    const lot = (color?.lots || []).find(l => l.id === bar.lotId) || {};
    const extra = [
      lot.qtyKg ? `수량 ${fmtKg(lot.qtyKg)}kg` : '',
      lot.machineKg ? `탕 ${fmtKg(lot.machineKg)}kg` : '',
      lot.rolls ? `${lot.rolls}롤` : '',
      lot.notes || '',
    ].filter(Boolean).join(' · ');
    return { ...base, status: getStatusLabel(bar.status), vendorLabel: '염색소', vendor: order.dyeVendor, extra, hint: '누르면 LOT 계획 편집' };
  }
  if (bar.kind === 'confirm') {
    const status = bar.status === 'done' ? '합격' : bar.status === 'issue' ? '불합격' : '결과 대기';
    return { ...base, status, vendorLabel: 'buyer', vendor: order.customer, hint: '누르면 컨펌 기록 수정' };
  }
  if (bar.kind === 'greige') {
    const route = `${order.steps?.knitting?.vendor || '편직처'} → ${order.dyeVendor || '염색소'}`;
    return { ...base, status: bar.status === 'done' ? '출고 완료' : '출고 예정', vendorLabel: '경로', vendor: route, hint: '누르면 오더 상세 보기' };
  }
  // ship
  return {
    ...base,
    status: bar.status === 'done' ? '출고 완료' : '출고 예정',
    vendorLabel: 'buyer',
    vendor: order.customer,
    hint: '누르면 오더 상세 보기',
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
export const OrderGantt = ({ orders = [], actions, masters = {}, onOpenDetail, onOpenLots, sheetLink = null }) => {
  const today = todayYmd();
  const [hideWeekends, setHideWeekends] = useState(loadHideWeekends);
  const [popover, setPopover] = useState(null); // { kind:'process'|'confirm'|'note', orderId, stepKey?, colorId?, date?, anchorRect }
  const scrollRef = useRef(null);
  const tipRef = useRef(null);
  const viewRef = useRef(null);                 // 화면 왼쪽 첫 날짜 { ymd, offset } — 주말 토글·기간 변경 때 같은 날짜 유지
  const skipCellClickRef = useRef(false);       // 팝오버가 떠 있을 때 빈 칸 클릭 = 닫기만 (새 메모 창 안 엶)

  const layout = useMemo(
    () => buildGanttLayout(orders, { today, hideWeekends }),
    [orders, today, hideWeekends]
  );

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
    const meta = ORDER_STEPS.find(s => s.key === stepKey);
    const fromMaster = meta?.vendorMaster ? toNames(masters?.[meta.vendorMaster]) : [];
    const fromOrders = orders.filter(o => o.id !== orderId).map(o => o.steps?.[stepKey]?.vendor);
    return [...new Set([...fromMaster, ...fromOrders].map(v => String(v || '').trim()).filter(Boolean))];
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
    if (bar.kind === 'step') {
      setPopover({ kind: 'process', orderId: order.id, stepKey: bar.stepKey, anchorRect });
    } else if (bar.kind === 'lot' && color) {
      if (onOpenLots) onOpenLots(order.id, color.id, anchorRect);
      else onOpenDetail?.(order.id);
    } else if (bar.kind === 'confirm' && color) {
      setPopover({ kind: 'confirm', orderId: order.id, colorId: color.id, anchorRect });
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

  // 그 날짜 칸 메모 창 — 누른 높이 바로 아래에 뜸 (줄이 메모로 길어져도 누른 곳 근처)
  const openNote = (e, order, color, col, left) => {
    if (skipCellClickRef.current) {
      skipCellClickRef.current = false;
      return;
    }
    const day = layout.days[col];
    if (!day) return;
    tipRef.current?.hide();
    const y = e.clientY || 0;
    setPopover({
      kind: 'note',
      orderId: order.id,
      colorId: color ? color.id : '',
      date: day.ymd,
      anchorRect: { left, right: left + DAY_W, top: y - 10, bottom: y + 10, width: DAY_W, height: 20 },
    });
  };

  // 빈 곳 클릭 → 그날 메모 (클릭 위치 ÷ 칸 폭 = 날짜)
  const handleCellClick = (e, order, color) => {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left) / DAY_W);
    openNote(e, order, color, col, r.left + col * DAY_W);
  };

  // 메모 글자 클릭 → 그 메모 날짜 (글자가 옆 칸까지 넓게 써져 있어도 그 메모의 날짜로)
  const handleNoteClick = (e, order, color, note) => {
    e.stopPropagation();
    openNote(e, order, color, note.col, e.currentTarget.getBoundingClientRect().left);
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
    tipRef.current?.show({ x, rect, info: describeBar(order, color, bar) });
  };
  const showFlagTip = (e, order, flag) => {
    const rect = e.currentTarget.getBoundingClientRect();
    tipRef.current?.show({ x: rect.left, rect, info: describeFlag(order, flag) });
  };
  const hideTip = () => tipRef.current?.hide();

  // ---------- 막대 ----------
  const renderBar = (order, color, bar) => {
    const theme = PROCESS_THEME[bar.theme] || PROCESS_THEME.yarn;
    const done = bar.status === 'done';
    const issue = bar.status === 'issue';
    const estimated = isEstimatedBar(order, bar);
    const rounded = `${bar.clipL ? 'rounded-l-none border-l-0' : 'rounded-l-md'} ${bar.clipR ? 'rounded-r-none border-r-0' : 'rounded-r-md'}`;
    return (
      <button
        key={bar.id}
        type="button"
        onClick={e => handleBarClick(e, order, color, bar)}
        onMouseEnter={e => showTip(e, order, color, bar)}
        onMouseLeave={hideTip}
        onFocus={e => showTip(e, order, color, bar)}
        onBlur={hideTip}
        className={`absolute z-[2] flex items-center px-1 border text-[10px] font-bold leading-none whitespace-nowrap text-left transition-shadow hover:shadow-md hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${theme.bar} ${rounded} ${
          done ? 'opacity-60' : ''
        } ${issue ? 'ring-2 ring-red-500' : ''} ${estimated ? 'border-dashed' : ''}`}
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
          <span className="truncate">{bar.label}{estimated ? ' (예상)' : ''}</span>
        </span>
      </button>
    );
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
  const renderFlag = (order, flag) => {
    const worst = worstMark(flag.marks);
    const st = PROVISIONAL_STATES[worst.info.state] || PROVISIONAL_STATES.none;
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
  const renderFlagGuide = (flag) => {
    const st = PROVISIONAL_STATES[worstMark(flag.marks).info.state] || PROVISIONAL_STATES.none;
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
    return (
      <div key={row.key} className="flex border-b border-slate-100 last:border-b-0" style={{ minHeight: row.minH }}>
        <div
          className={`sticky left-0 z-20 shrink-0 border-r-2 border-r-slate-300 ${isOrder ? 'bg-slate-50' : 'bg-white'}`}
          style={{ width: LABEL_W }}
        >
          {isOrder
            ? <OrderLabel order={order} sheetInfo={sheetLink?.infoOf?.(order) || null} onOpenDetail={onOpenDetail} />
            : <ColorLabel order={order} color={row.color} />}
        </div>
        <div
          className={`relative shrink-0 cursor-pointer ${isOrder ? 'bg-slate-400/[0.06]' : ''} ${dim ? 'opacity-70' : ''}`}
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
                {group.flags.map(renderFlagGuide)}
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
          기타 공정(원사·후가공·검사)
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1"><span className="w-0.5 h-3 bg-teal-500" />오늘</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 border-r-2 border-dashed border-red-500" />납기</span>
        <span className="inline-flex items-center gap-1" title="오더 줄 맨 위 깃발 + 세로 점선. 지금 일정이 가납기보다 늦으면 빨강">
          <Flag className="w-3 h-3 text-slate-500" />가납기
          <span className={`px-1 rounded-sm border text-[9px] font-extrabold ${PROVISIONAL_STATES.ok.flag}`}>맞음</span>
          <span className={`px-1 rounded-sm border text-[9px] font-extrabold ${PROVISIONAL_STATES.late.flag}`}>늦음</span>
        </span>
        <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />완료(흐리게)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm ring-2 ring-red-500 bg-white" />문제</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm border border-dashed border-yellow-500 bg-yellow-100" />예상</span>
        <span className="ml-auto inline-flex items-center gap-1 font-bold text-teal-700">
          <StickyNote className="w-3.5 h-3.5" /> 빈 칸을 누르면 그날 메모 — 막대 아래에 글자 전부 보여요
        </span>
      </div>

      <BarTooltip apiRef={tipRef} />

      {/* ---------- 팝오버 ---------- */}
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
          onSave={patch => actions.setProvisionalDue(popOrder.id, patch)}
        />
      )}
    </div>
  );
};

export default OrderGantt;
