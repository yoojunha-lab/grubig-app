// GRUBIG ERP - 오더별 간트 배치 계산 (순수 함수)
// ------------------------------------------------------------
// - 표시 기간(날짜 칸 목록) / 주말 숨기기 시 날짜 → 칸 번호 변환
// - 오더 줄 + 컬러 줄마다 막대 레인 배정, 날짜 메모 칸 배치, 줄 높이
// - 오더 줄 맨 위 가납기 깃발 (대표님 요청 2026-10-10)
// - React/DOM 의존 없음 → OrderGantt.jsx 가 useMemo 로 한 번만 계산
// 날짜는 전부 'YYYY-MM-DD' 문자열 (orderCalculations 헬퍼 사용)
//
// ■ 한 줄의 모양 (위 → 아래)
//   [가납기 깃발 줄 — 오더 줄만, 가납기가 있을 때]  [막대 레인]  [날짜 메모 — 글자 전부, 길면 줄바꿈]
//   메모 높이는 글자 길이에 따라 화면에서 정해짐 (CSS grid) → 여기서는 최소 높이만 정함

import { NOTE_TONE_CLASSES, PROCESS_THEME } from '../../../constants/production';
import { getOrderTimeline, getProvisionalDueMarks } from '../../../utils/orderModel';
import { addDaysYmd, diffDaysYmd, toDate } from '../../../utils/orderCalculations';

// ============================================================
// 1. 치수 (px)
// ============================================================
export const DAY_W = 72;        // 날짜 칸 폭
export const LABEL_W = 240;     // 왼쪽 고정 라벨 칸 폭
export const MARK_H = 18;       // 오더 줄 맨 위 가납기 깃발 줄 높이
export const LANE_H = 22;       // 막대 레인 높이
export const BAR_H = 18;        // 막대 높이 (레인 안)
export const BAR_PAD = 3;       // 막대 레인 위아래 여백
const ORDER_ROW_MIN_H = 44;     // 오더 줄 최소 높이 (라벨 두 줄)
const COLOR_ROW_MIN_H = 32;     // 컬러 줄 최소 높이

const PAST_DAYS = 7;            // 최소 표시: 오늘-7일
const FUTURE_DAYS = 30;         //           ~ 오늘+30일
const MAX_PAST = 120;           // 최대 표시: 오늘-120일
const MAX_FUTURE = 180;         //           ~ 오늘+180일
const PAD_DAYS = 3;             // 데이터 앞뒤 여유
const NOTE_MAX_SPAN = 4;        // 메모 글자가 빈 옆 칸으로 넓게 쓸 수 있는 최대 칸 수 (그보다 길면 줄바꿈)

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

const isWeekendDow = (dow) => dow === 0 || dow === 6;

// 'M/D(요일)'
export const fmtDayLabel = (ymd) => {
  const d = toDate(ymd);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`;
};

const minStr = (a, b) => (a <= b ? a : b);
const maxStr = (a, b) => (a >= b ? a : b);

// ============================================================
// 2. 표시 기간
//    데이터(막대·메모·납기) 최소~최대 ∪ [오늘-7, 오늘+30], 최대 [오늘-120, 오늘+180]
//    시작은 월요일, 끝은 일요일로 맞춤 (주 단위로 보기 좋게)
// ============================================================
const computeRange = (dates, today) => {
  let start = addDaysYmd(today, -PAST_DAYS);
  let end = addDaysYmd(today, FUTURE_DAYS);
  if (dates.length) {
    const sorted = [...dates].sort();
    start = minStr(start, addDaysYmd(sorted[0], -PAD_DAYS));
    end = maxStr(end, addDaysYmd(sorted[sorted.length - 1], PAD_DAYS));
  }
  start = maxStr(start, addDaysYmd(today, -MAX_PAST));
  end = minStr(end, addDaysYmd(today, MAX_FUTURE));

  const s = toDate(start);
  const e = toDate(end);
  const toMonday = (s.getDay() + 6) % 7;       // 월=0 … 일=6
  const toSunday = (7 - e.getDay()) % 7;
  return { start: addDaysYmd(start, -toMonday), end: addDaysYmd(end, toSunday) };
};

// ============================================================
// 3. 날짜 칸 + 날짜 → 칸 번호
//    주말을 숨기면 토·일 칸이 없음:
//      - 시작 쪽(fwd): 다음 평일 칸 (토·일 → 월)
//      - 끝 쪽(bwd):   이전 평일 칸 (토·일 → 금)
// ============================================================
const buildColumns = (start, end, hideWeekends, today) => {
  const total = diffDaysYmd(start, end) + 1;
  const days = [];
  const fwd = new Array(total).fill(null);
  const bwd = new Array(total).fill(null);

  for (let i = 0; i < total; i += 1) {
    const ymd = addDaysYmd(start, i);
    const d = toDate(ymd);
    const dow = d.getDay();
    if (hideWeekends && isWeekendDow(dow)) continue;
    const col = days.length;
    days.push({
      ymd,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      dow,
      isToday: ymd === today,
      isWeekend: isWeekendDow(dow),
    });
    fwd[i] = col;
    bwd[i] = col;
  }
  // 빈 칸(숨긴 주말) 채우기
  for (let i = total - 2; i >= 0; i -= 1) if (fwd[i] === null) fwd[i] = fwd[i + 1];
  for (let i = 1; i < total; i += 1) if (bwd[i] === null) bwd[i] = bwd[i - 1];

  const offsetOf = (ymd) => {
    if (!ymd) return null;
    const i = diffDaysYmd(start, ymd);
    return i >= 0 && i < total ? i : null;
  };
  // 기간 밖이면 null
  const colFwd = (ymd) => {
    const i = offsetOf(ymd);
    if (i === null) return null;
    return fwd[i] ?? bwd[i];
  };
  const colBwd = (ymd) => {
    const i = offsetOf(ymd);
    if (i === null) return null;
    return bwd[i] ?? fwd[i];
  };
  return { days, colFwd, colBwd };
};

// 월 머리글 묶음: [{ key, label:'YYYY.M', startCol, count }]
const buildMonths = (days) => {
  const months = [];
  days.forEach((d, col) => {
    const key = `${d.year}-${d.month}`;
    const last = months[months.length - 1];
    if (last && last.key === key) last.count += 1;
    else months.push({ key, label: `${d.year}.${d.month}`, startCol: col, count: 1 });
  });
  return months;
};

// ============================================================
// 4. 막대 → 칸 범위 + 레인 배정
// ============================================================
const placeBars = (bars, range, colFwd, colBwd, lastCol) => {
  const placed = [];
  bars.forEach((bar, idx) => {
    if (!bar.start || !bar.end) return;
    if (bar.end < range.start || bar.start > range.end) return; // 기간 밖
    const clipL = bar.start < range.start;
    const clipR = bar.end > range.end;
    const startCol = clipL ? 0 : colFwd(bar.start);
    let endCol = clipR ? lastCol : colBwd(bar.end);
    if (startCol === null || endCol === null) return;
    if (endCol < startCol) endCol = startCol; // 주말에만 걸친 막대 → 다음 월요일 칸 하나
    placed.push({ ...bar, startCol, endCol, clipL, clipR, _idx: idx });
  });

  placed.sort((a, b) => a.startCol - b.startCol || a._idx - b._idx);
  const laneEnds = [];
  placed.forEach(bar => {
    let lane = laneEnds.findIndex(end => end < bar.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.endCol);
    } else {
      laneEnds[lane] = bar.endCol;
    }
    bar.lane = lane;
  });
  return { bars: placed, laneCount: laneEnds.length };
};

// ============================================================
// 5. 날짜 메모 → 막대 아래 메모 칸 (글자 전부 보이게 — 대표님 요청 2026-10-10)
//    - 같은 칸에 여러 메모(숨긴 주말 메모 + 월요일 메모)면 ' / ' 로 합침
//    - 색: tone 지정 → NOTE_TONE_CLASSES, 자동('') → 그날 걸친 막대의 cell 색, 없으면 회색
//    - span: 메모가 넓게 쓰는 칸 수 (글자 길이만큼, 최대 4칸). 그보다 길면 줄을 바꿔서 전부 보여줌
//    - lane: 겹치는 메모는 아래 단으로 (메모 줄 높이가 늘어남)
//    - date: 그 칸의 날짜 (메모를 누르면 그 날짜 메모 창)
// ============================================================
const AUTO_NOTE_CLS = 'bg-slate-100 text-slate-700';

const autoToneCls = (bars, col) => {
  let pick = null;
  bars.forEach(b => {
    if (b.startCol <= col && col <= b.endCol && (!pick || b.startCol >= pick.startCol)) pick = b;
  });
  return pick ? (PROCESS_THEME[pick.theme]?.cell || AUTO_NOTE_CLS) : AUTO_NOTE_CLS;
};

// 메모 글자 폭 어림 (10px 글씨: 한글 ≈ 10px, 영문·숫자 ≈ 6px, 띄어쓰기 3px + 좌우 여백). 줄바꿈이 있으면 가장 긴 줄
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const estimateNotePx = (text) => Math.max(0, ...String(text || '').split('\n').map(line =>
  [...line].reduce((w, ch) => w + (HANGUL.test(ch) ? 10 : ch === ' ' ? 3 : 6), 0)
)) + 10;

//  - lane: 메모 줄 안의 몇째 단인지 — 바로 다음 날에도 메모가 있으면 겹치지 않게 아래 단으로
//    (예전처럼 다음 메모 전까지만 쓰면 긴 메모가 한 칸 폭에 갇혀 세로로 길어졌음)
const placeNotes = (notes, bars, range, colFwd, days) => {
  const byCol = new Map();
  notes.forEach(n => {
    if (!n.date || !n.text || n.date < range.start || n.date > range.end) return;
    const col = colFwd(n.date);
    if (col === null) return;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col).push(n);
  });

  const cols = [...byCol.keys()].sort((a, b) => a - b);
  const laneEnds = [];
  return cols.map(col => {
    const list = byCol.get(col).slice().sort((a, b) => a.date.localeCompare(b.date));
    const colYmd = days[col]?.ymd;
    // 숨긴 주말 메모는 앞에 '(토)' '(일)' 표시
    const parts = list.map(n => {
      if (n.date === colYmd) return n.text;
      const d = toDate(n.date);
      return `(${WEEKDAY_KO[d.getDay()]}) ${n.text}`;
    });
    const text = parts.join(' / ');
    const last = list[list.length - 1];
    const tone = last.tone || '';
    const cls = tone ? (NOTE_TONE_CLASSES[tone] || AUTO_NOTE_CLS) : autoToneCls(bars, col);
    // 글자 길이만큼 옆 칸까지 (최대 4칸, 표 끝까지만). 그보다 길면 줄바꿈
    const need = Math.ceil(estimateNotePx(text) / DAY_W);
    const span = Math.max(1, Math.min(NOTE_MAX_SPAN, need, days.length - col));
    let lane = laneEnds.findIndex(end => end < col);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(col + span - 1);
    } else {
      laneEnds[lane] = col + span - 1;
    }
    const title = list.map(n => `${fmtDayLabel(n.date)} ${n.text}`).join('\n');
    return { col, date: colYmd, text, tone, cls, span, lane, title };
  });
};

// ============================================================
// 5-2. 가납기 깃발 → 날짜 칸 (같은 칸에 여러 공정이면 한 깃발로 합침)
//    가납기 = 그날까지 → 납기처럼 그 날짜 칸 (주말을 숨겼으면 다음 월요일 칸 — 납기와 같은 규칙)
//    [{ col, marks: [{ key, label, short, date, info }] }]
// ============================================================
const placeFlags = (marks, colFwd) => {
  const byCol = new Map();
  marks.forEach(m => {
    const col = colFwd(m.date);
    if (col === null) return;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col).push(m);
  });
  return [...byCol.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([col, list]) => ({ col, marks: list }));
};

// 막대 레인 높이 (막대가 없어도 한 레인 — 빈 곳을 눌러 메모를 쓸 수 있게)
const barsHeight = (laneCount) => BAR_PAD * 2 + Math.max(1, laneCount) * LANE_H;

// ============================================================
// 6. 전체 배치
// ------------------------------------------------------------
// 반환:
//  { range:{start,end}, days:[...], months:[...], width, todayCol, todayShown,
//    colFwd(ymd), groups:[{ order, dueCol, flags,
//      rows:[{ key, kind:'order'|'color', color, bars, notes, flags, laneCount, barsH, minH }] }] }
//  flags: 가납기 깃발 (오더 줄에만, 그룹에도 같은 값 — 오더 묶음 전체를 지나는 세로 점선용)
// ============================================================
export const buildGanttLayout = (orders = [], { today, hideWeekends = true } = {}) => {
  // 오더마다 타임라인·가납기 먼저 (기간 계산 + 배치에 재사용)
  const timelines = orders.map(order => ({
    order,
    tl: getOrderTimeline(order),
    marks: getProvisionalDueMarks(order, today),
  }));

  const dates = [];
  timelines.forEach(({ order, tl, marks }) => {
    tl.orderBars.forEach(b => dates.push(b.start, b.end));
    tl.colorRows.forEach(r => r.bars.forEach(b => dates.push(b.start, b.end)));
    (order.dailyNotes || []).forEach(n => { if (n.date && n.text) dates.push(n.date); });
    if (order.finalDueDate) dates.push(order.finalDueDate);
    marks.forEach(m => dates.push(m.date));
  });
  const range = computeRange(dates.filter(d => toDate(d)), today);
  const { days, colFwd, colBwd } = buildColumns(range.start, range.end, hideWeekends, today);
  const lastCol = days.length - 1;

  const groups = timelines.map(({ order, tl, marks }) => {
    const notes = order.dailyNotes || [];
    const flags = placeFlags(marks, colFwd);
    const makeRow = (key, kind, color, rawBars, colorId) => {
      const { bars, laneCount } = placeBars(rawBars, range, colFwd, colBwd, lastCol);
      const rowNotes = placeNotes(notes.filter(n => String(n.colorId || '') === colorId), bars, range, colFwd, days);
      return {
        key, kind, color, bars, notes: rowNotes, laneCount,
        flags: kind === 'order' ? flags : [],
        barsH: barsHeight(laneCount),
        minH: kind === 'order' ? ORDER_ROW_MIN_H : COLOR_ROW_MIN_H,
      };
    };
    const rows = [makeRow(`${order.id}__order`, 'order', null, tl.orderBars, '')];
    tl.colorRows.forEach(({ color, bars }) => {
      rows.push(makeRow(`${order.id}__${color.id}`, 'color', color, bars, String(color.id)));
    });
    const dueCol = order.finalDueDate ? colFwd(order.finalDueDate) : null;
    return { order, rows, dueCol, flags };
  });

  const todayCol = colFwd(today);
  return {
    range,
    days,
    months: buildMonths(days),
    width: days.length * DAY_W,
    todayCol: todayCol === null ? -1 : todayCol,
    todayShown: days.some(d => d.isToday),
    hideWeekends,
    colFwd,
    groups,
  };
};
