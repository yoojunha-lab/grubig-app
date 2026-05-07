// GRUBIG ERP - 오더 납기 계산 및 상태 유틸리티
// 순수 함수 모음 (외부 I/O 없음)

import { DUE_HEALTH_COLORS, KG_CONVERSION_COEFFICIENT, PROCESS_TYPES, normalizeDeliveryStatus, normalizeBatchStatus } from '../constants/production';

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
// 4. 공정별 effective 시작일/종료일 계산 (v3 신규)
// ------------------------------------------------------------
// startDate가 비어있으면 이전 활성 공정의 effectiveEnd 사용 (체인)
// endDate = effectiveStart + durationDays
// 반환: 활성 공정에 effectiveStart/effectiveEnd 추가한 배열 (sequenceOrder 순)
// ============================================================
export const enrichProcessesWithEffectiveDates = (order) => {
  if (!order) return [];
  const sorted = (order.processes || [])
    .filter(p => p.isActive)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  let prevEnd = '';
  return sorted.map(p => {
    const effectiveStart = p.startDate || prevEnd || '';
    const dur = Number(p.durationDays) || 0;
    const effectiveEnd = effectiveStart && dur >= 0 ? addDaysYmd(effectiveStart, dur) : '';
    prevEnd = effectiveEnd;
    return { ...p, effectiveStart, effectiveEnd };
  });
};

// ============================================================
// 4-1. 예상납기 = 마지막 활성 공정의 effectiveEnd
// ============================================================
export const calcEstimatedDueDate = (order) => {
  const enriched = enrichProcessesWithEffectiveDates(order);
  if (enriched.length === 0) return '';
  const last = enriched[enriched.length - 1];
  return last.effectiveEnd || '';
};

// ============================================================
// 4-2. 공정별 납기 초과 분석 (v2 신규)
// ------------------------------------------------------------
// 각 활성 공정에 대해 분석:
// - 다음 활성 공정의 dueDate보다 늦으면 시퀀스 위반 (선행 공정이 후행보다 늦음)
// - 마지막 공정이면 최종 납기와 비교
// 반환: [{processType, label, days, type: 'sequence'|'final'}]
// ============================================================
export const analyzeProcessOverruns = (order) => {
  if (!order) return [];

  const enriched = enrichProcessesWithEffectiveDates(order).filter(p => p.effectiveEnd);
  if (enriched.length === 0) return [];

  const overruns = [];
  const labelMap = Object.fromEntries(PROCESS_TYPES.map(p => [p.key, p.label]));

  // 마지막 공정 effectiveEnd > finalDueDate면 마지막 공정에 초과 표시
  if (order.finalDueDate) {
    const last = enriched[enriched.length - 1];
    const delta = diffDaysYmd(order.finalDueDate, last.effectiveEnd);
    if (delta > 0) {
      overruns.push({
        processType: last.processType,
        label: labelMap[last.processType] || last.processType,
        days: delta,
        type: 'final',
        message: `${labelMap[last.processType]} 종료일이 최종납기보다 ${delta}일 초과`,
      });
    }
  }

  // 사용자가 startDate를 직접 입력한 경우, 이전 공정 effectiveEnd > 현재 effectiveStart면 시퀀스 위반
  for (let i = 1; i < enriched.length; i++) {
    const prev = enriched[i - 1];
    const cur = enriched[i];
    if (cur.startDate && prev.effectiveEnd && cur.effectiveStart < prev.effectiveEnd) {
      const overlap = diffDaysYmd(cur.effectiveStart, prev.effectiveEnd);
      overruns.push({
        processType: cur.processType,
        label: labelMap[cur.processType] || cur.processType,
        days: overlap,
        type: 'sequence',
        message: `${labelMap[cur.processType]} 시작일(${cur.effectiveStart})이 ${labelMap[prev.processType]} 종료일(${prev.effectiveEnd})보다 ${overlap}일 빠름`,
      });
    }
  }

  return overruns;
};

// ============================================================
// 4-3. YD → KG 자동 환산 (v2 신규)
// ------------------------------------------------------------
// kg = (yd × gsm × widthFull × 0.02322576) / 1000
// gsm 또는 widthFull이 없으면 0 반환
// ============================================================
export const calcKgFromYd = (yd, gsm, widthFull) => {
  const _yd = Number(yd) || 0;
  const _gsm = Number(gsm) || 0;
  const _w = Number(widthFull) || 0;
  if (_yd <= 0 || _gsm <= 0 || _w <= 0) return 0;
  return Math.round((_yd * _gsm * _w * KG_CONVERSION_COEFFICIENT) / 1000 * 100) / 100;
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
        if (yo.useKnitterStock) return;  // 편직처 보유 — 발주 없음, 카운트 제외
        (yo.deliveries || []).forEach(dv => {
          total += 1;
          // 4상태 통일 + legacy 한글 호환
          if (normalizeDeliveryStatus(dv.status) === 'done') done += 1;
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
// 5-2. 공정 완료 여부 판정 (모든 batch / yarnDelivery 가 done인지)
// ------------------------------------------------------------
// 모든 차수가 완료된 공정은 마감 알림 대상에서 제외
// ============================================================
export const isProcessComplete = (process) => {
  if (!process || !process.isActive) return false;
  if (process.processType === 'yarn') {
    const all = (process.yarnOrders || []).flatMap(yo =>
      yo.useKnitterStock ? [] : (yo.deliveries || [])
    );
    if (all.length === 0) return false;
    return all.every(dv => normalizeDeliveryStatus(dv.status) === 'done');
  }
  const bs = process.batches || [];
  if (bs.length === 0) return false;
  return bs.every(b => !!b.actualEndDate);
};

// ============================================================
// 5-3. 공정 마감 우선순위 (납기 카운트다운용)
// ------------------------------------------------------------
// effectiveEnd 기준 today와의 차이 (양수=남은일수, 0=오늘, 음수=지연)
// urgency: 'overdue' | 'urgent'(D-3 이내) | 'soon'(D-7) | 'normal'
// 완료된 공정은 null 반환
// ============================================================
export const getProcessDeadlineInfo = (process) => {
  if (!process || !process.effectiveEnd) return null;
  if (isProcessComplete(process)) return null;  // 완료된 공정은 알림 대상 아님
  const today = todayYmd();
  const days = diffDaysYmd(today, process.effectiveEnd);
  let urgency = 'normal';
  if (days < 0) urgency = 'overdue';
  else if (days <= 3) urgency = 'urgent';
  else if (days <= 7) urgency = 'soon';
  return { days, urgency, effectiveEnd: process.effectiveEnd };
};

// ============================================================
// 5-4. 전체 오더 중 마감 임박/지연 공정 추출 (대시보드용)
// ------------------------------------------------------------
// 모든 오더의 활성 공정을 순회 → 미완료 + (지연 OR 7일 이내) 만 반환
// 정렬: 지연일수 내림차순 (가장 위급한 게 위로)
// ============================================================
export const collectUrgentProcesses = (orders, threshold = 7) => {
  if (!Array.isArray(orders)) return [];
  const labelMap = Object.fromEntries(PROCESS_TYPES.map(p => [p.key, p.label]));
  const items = [];
  orders.forEach(order => {
    if (order.status === 'completed' || order.status === 'cancelled') return;
    const enriched = enrichProcessesWithEffectiveDates(order);
    enriched.forEach(p => {
      const info = getProcessDeadlineInfo(p);
      if (!info) return;
      if (info.days > threshold) return;  // threshold 이내만
      items.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        articleNo: order.articleNo,
        customer: order.customer,
        processType: p.processType,
        processLabel: labelMap[p.processType] || p.processType,
        effectiveEnd: info.effectiveEnd,
        days: info.days,
        urgency: info.urgency
      });
    });
  });
  // 가장 위급한 게 먼저: days 오름차순 (음수가 위)
  items.sort((a, b) => a.days - b.days);
  return items;
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

// ============================================================
// 진행중 항목 추출 — 차수 + 원사 입고차수 통합
//   각 항목 형태:
//     { kind: 'batch', processType, sequenceOrder, batch, endDate, overdue }
//     { kind: 'delivery', processType:'yarn', sequenceOrder, yarnOrder, delivery, endDate, overdue }
//   진행중 = batch.status==='in_progress' OR delivery 정규화 status==='in_progress'
//   sequenceOrder → (batch.batchNumber 또는 delivery.deliveryNumber) 오름차순
// ============================================================
export const getInProgressItems = (order) => {
  if (!order) return [];
  const today = todayYmd();
  const result = [];

  (order.processes || [])
    .filter(p => p.isActive)
    .forEach(p => {
      if (p.processType === 'yarn') {
        (p.yarnOrders || []).forEach(yo => {
          if (yo.useKnitterStock) return;
          (yo.deliveries || []).forEach(dv => {
            const sKey = normalizeDeliveryStatus(dv.status);
            if (sKey !== 'in_progress') return;
            const endDate = dv.actualArrivalDate || dv.expectedArrivalDate || dv.plannedArrivalDate || '';
            result.push({
              kind: 'delivery',
              processType: 'yarn',
              sequenceOrder: p.sequenceOrder || 0,
              yarnOrder: yo,
              delivery: dv,
              endDate,
              overdue: !!(dv.plannedArrivalDate && dv.plannedArrivalDate < today),
              orderNumber: dv.deliveryNumber || 0,
            });
          });
        });
      } else {
        (p.batches || []).forEach(b => {
          if (normalizeBatchStatus(b.status) !== 'in_progress') return;
          const endDate = b.actualEndDate || b.expectedEndDate || b.plannedEndDate || '';
          result.push({
            kind: 'batch',
            processType: p.processType,
            sequenceOrder: p.sequenceOrder || 0,
            batch: b,
            endDate,
            overdue: !!(b.plannedEndDate && b.plannedEndDate < today),
            orderNumber: b.batchNumber || 0,
          });
        });
      }
    });

  return result.sort((a, b) => {
    if (a.sequenceOrder !== b.sequenceOrder) return a.sequenceOrder - b.sequenceOrder;
    return (a.orderNumber || 0) - (b.orderNumber || 0);
  });
};

// ============================================================
// 납기 초과 판정 헬퍼
// ============================================================
// 차수: plannedEndDate < today && status !== 'done' (legacy 한글 호환)
export const isBatchOverdue = (batch) => {
  if (!batch || !batch.plannedEndDate) return false;
  if (normalizeBatchStatus(batch.status) === 'done') return false;
  return batch.plannedEndDate < todayYmd();
};

// 원사 입고차수: plannedArrivalDate < today && (정규화 status) !== 'done'
export const isYarnDeliveryOverdue = (delivery) => {
  if (!delivery || !delivery.plannedArrivalDate) return false;
  if (normalizeDeliveryStatus(delivery.status) === 'done') return false;
  return delivery.plannedArrivalDate < todayYmd();
};
