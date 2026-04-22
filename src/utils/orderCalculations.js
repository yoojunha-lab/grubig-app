// GRUBIG ERP - 오더 납기 계산 및 상태 유틸리티
// 순수 함수 모음 (외부 I/O 없음)

import { DUE_HEALTH_COLORS } from '../constants/production';

// ============================================================
// 1. 날짜 헬퍼 (달력 기준, Working Day 사용 안 함)
// ============================================================

// YYYY-MM-DD 문자열 → Date
const toDate = (s) => {
  if (!s) return null;
  const d = new Date(s + (String(s).length === 10 ? 'T00:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
};

// Date → YYYY-MM-DD 문자열
const toYmd = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 날짜 문자열에 N일 더하기
export const addDaysYmd = (ymd, days) => {
  const d = toDate(ymd);
  if (!d) return '';
  d.setDate(d.getDate() + Number(days || 0));
  return toYmd(d);
};

// 두 날짜 차이 (일 단위, b - a). null/invalid면 0
export const diffDaysYmd = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
};

// 오늘 YYYY-MM-DD
export const todayYmd = () => toYmd(new Date());

// ============================================================
// 2. 오더 번호 채번 (O-YYM###)
// ------------------------------------------------------------
// YY=연도 2자리, M=월 알파벳(A=1월 ~ L=12월), ### = 시퀀스 3자리
// 예: 2026년 4월 첫 오더 = O-26D001
// ============================================================
const MONTH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const getMonthLetter = (month1to12) => {
  const idx = Number(month1to12) - 1;
  return MONTH_LETTERS[idx] || 'A';
};

export const generateOrderNumber = (existingOrders = []) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const monthLetter = getMonthLetter(now.getMonth() + 1);
  const prefix = `O-${yy}${monthLetter}`;

  const existingNos = (existingOrders || [])
    .map(o => o.orderNumber || '')
    .filter(no => no.startsWith(prefix))
    .map(no => {
      const n = parseInt(no.replace(prefix, ''), 10);
      return isNaN(n) ? 0 : n;
    });

  const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

// ============================================================
// 3. 공정/차수 소요일 합산
// ============================================================

// 차수(batch)의 소요일: end - start (둘 다 있을 때)
export const calcBatchDuration = (batch) => {
  if (!batch?.plannedStartDate || !batch?.plannedEndDate) return 0;
  return Math.max(0, diffDaysYmd(batch.plannedStartDate, batch.plannedEndDate));
};

// 공정(process) 소요일:
// - 염가공: processingDays + brandConfirmBufferDays
// - 원사: yarnOrders의 각 deliveries 중 최대 arrivalDate로부터 전체 리드타임(단순 max - 오더 시작일 추정 어려우므로 총 duration = 차수 합산 불가)
//        → 이번 단계에서는 원사 공정의 소요일은 "모든 deliveries의 plannedArrivalDate 중 max - min" 로 근사
// - 기타: 차수 planned 기간 합산 (순차 진행 전제)
export const calcProcessDuration = (process) => {
  if (!process || !process.isActive) return 0;

  if (process.processType === 'dyeing') {
    return Number(process.processingDays || 0) + Number(process.brandConfirmBufferDays || 0);
  }

  if (process.processType === 'yarn') {
    // 모든 deliveries의 plannedArrivalDate 중 최대 - 최소
    const dates = [];
    (process.yarnOrders || []).forEach(yo => {
      (yo.deliveries || []).forEach(dv => {
        if (dv.plannedArrivalDate) dates.push(dv.plannedArrivalDate);
      });
    });
    if (dates.length === 0) return 0;
    dates.sort();
    return Math.max(0, diffDaysYmd(dates[0], dates[dates.length - 1]));
  }

  // 기타 공정: 차수 기간 합산
  return (process.batches || []).reduce((sum, b) => sum + calcBatchDuration(b), 0);
};

// ============================================================
// 4. 예상납기 자동 계산 (기획서 3.4)
// ------------------------------------------------------------
// 방식: 활성 공정(주경로)의 소요일 단순 합산. 시작일 = 주경로 공정의 최초 planned start
// L/D(isParallelTrack)는 주경로에서 제외
// ============================================================
export const calcEstimatedDueDate = (order) => {
  if (!order) return '';
  const activeProcesses = (order.processes || []).filter(p => p.isActive);
  if (activeProcesses.length === 0) return '';

  // 주경로 공정만 (L/D 같은 병렬 트랙 제외)
  const mainPath = activeProcesses.filter(p => !p.isParallelTrack);
  if (mainPath.length === 0) return '';

  // 시작일 추정: 주경로 공정의 모든 차수/입고의 plannedStartDate 중 최소
  const startDates = [];
  mainPath.forEach(p => {
    if (p.processType === 'yarn') {
      (p.yarnOrders || []).forEach(yo => {
        (yo.deliveries || []).forEach(dv => {
          if (dv.plannedArrivalDate) startDates.push(dv.plannedArrivalDate);
        });
      });
    } else {
      (p.batches || []).forEach(b => {
        if (b.plannedStartDate) startDates.push(b.plannedStartDate);
      });
    }
  });

  if (startDates.length === 0) return '';
  startDates.sort();
  const start = startDates[0];

  // 총 소요일 = 주경로 공정 소요일 합산
  const totalDays = mainPath.reduce((sum, p) => sum + calcProcessDuration(p), 0);
  return addDaysYmd(start, totalDays);
};

// ============================================================
// 5. 오더 진행률 (완료된 batch 비율)
// ============================================================
export const calcOrderProgress = (order) => {
  if (!order) return 0;
  let total = 0;
  let done = 0;
  (order.processes || []).forEach(p => {
    if (!p.isActive) return;
    if (p.processType === 'yarn') {
      (p.yarnOrders || []).forEach(yo => {
        (yo.deliveries || []).forEach(dv => {
          total += 1;
          if (dv.status === '입고완료') done += 1;
        });
      });
    } else {
      (p.batches || []).forEach(b => {
        total += 1;
        if (b.actualEndDate) done += 1;
      });
    }
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
};

// ============================================================
// 6. 납기 건강도 판정 (기획서 4.1 색상)
// ------------------------------------------------------------
// green:   estimated <= final 이면서 여유 충분
// amber:   estimated > today 이면서 final 근접 (estimated와 final 차이 ≤ 3일)
// red:     estimated > final (납기 초과)
// slate:   데이터 부족
// ============================================================
export const getOrderHealth = (order) => {
  if (!order || !order.finalDueDate) return 'slate';
  const est = order.estimatedDueDate;
  const fin = order.finalDueDate;
  if (!est) return 'slate';

  const gapToFinal = diffDaysYmd(est, fin);
  if (gapToFinal < 0) return 'red';
  if (gapToFinal <= 3) return 'amber';
  return 'green';
};

export const getHealthColorClass = (health) => DUE_HEALTH_COLORS[health] || DUE_HEALTH_COLORS.slate;

// ============================================================
// 7. 컬러/차수 수량 합 검증
// ============================================================
export const sumQty = (arr = [], key = 'quantity') =>
  arr.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);

// 허용 오차(±0.01)
export const qtyMatches = (a, b, tolerance = 0.01) =>
  Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;

// 허용 오차 1%
export const qtyMatchesPercent = (a, b, percent = 1) => {
  const base = Math.max(Math.abs(Number(a) || 0), Math.abs(Number(b) || 0));
  if (base === 0) return true;
  return Math.abs(Number(a || 0) - Number(b || 0)) / base * 100 <= percent;
};

// ============================================================
// 8. 공정 시퀀스 검증 (앞 공정 종료 > 뒤 공정 시작 체크)
// ============================================================
export const checkSequenceConflicts = (order) => {
  if (!order) return [];
  const conflicts = [];
  const mainPath = (order.processes || [])
    .filter(p => p.isActive && !p.isParallelTrack)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  for (let i = 0; i < mainPath.length - 1; i++) {
    const cur = mainPath[i];
    const next = mainPath[i + 1];

    let curEnd = '';
    let nextStart = '';

    if (cur.processType === 'yarn') {
      const dates = (cur.yarnOrders || []).flatMap(yo => (yo.deliveries || []).map(dv => dv.plannedArrivalDate)).filter(Boolean);
      if (dates.length) curEnd = dates.sort().pop();
    } else {
      const ends = (cur.batches || []).map(b => b.plannedEndDate).filter(Boolean);
      if (ends.length) curEnd = ends.sort().pop();
    }

    if (next.processType === 'yarn') {
      const dates = (next.yarnOrders || []).flatMap(yo => (yo.deliveries || []).map(dv => dv.plannedArrivalDate)).filter(Boolean);
      if (dates.length) nextStart = dates.sort()[0];
    } else {
      const starts = (next.batches || []).map(b => b.plannedStartDate).filter(Boolean);
      if (starts.length) nextStart = starts.sort()[0];
    }

    if (curEnd && nextStart && diffDaysYmd(curEnd, nextStart) < 0) {
      conflicts.push({
        prev: cur.processType,
        next: next.processType,
        prevEnd: curEnd,
        nextStart,
        delta: diffDaysYmd(nextStart, curEnd),
      });
    }
  }
  return conflicts;
};
