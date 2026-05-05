// GRUBIG ERP - 오더 위험 자동 감지 (Risk Scanner)
// 알람 시스템은 폐기됐지만, 대시보드에서 위험 오더를 자동 정렬할 때 사용

import { diffDaysYmd, todayYmd, calcOrderProgress, enrichProcessesWithEffectiveDates } from './orderCalculations';
import { normalizeBatchStatus, normalizeDeliveryStatus, getProcessMeta } from '../constants/production';

// 위험 항목 1개의 형태: { type, severity: 'high'|'mid'|'low', message }
// severity 가중치: high=10, mid=5, low=2

const SEVERITY_WEIGHT = { high: 10, mid: 5, low: 2 };

// ============================================================
// 단일 오더의 위험 감지
// ============================================================
export const detectOrderRisks = (order) => {
  if (!order) return [];
  const risks = [];
  const today = todayYmd();

  // 완료/보류 오더는 분석 제외
  if (order.status === 'completed' || order.status === 'on_hold') return [];

  // 1. 납기 초과 (예상납기 > 최종납기) — high
  if (order.estimatedDueDate && order.finalDueDate && order.estimatedDueDate > order.finalDueDate) {
    const overrun = diffDaysYmd(order.finalDueDate, order.estimatedDueDate);
    risks.push({
      type: 'due_overrun',
      severity: 'high',
      message: `예상 납기가 최종 납기보다 ${overrun}일 초과`,
    });
  }

  // 2. 납기 임박 미완료 (D-3 이내인데 진행률 < 70%) — high
  if (order.finalDueDate) {
    const daysToFinal = diffDaysYmd(today, order.finalDueDate);
    const progress = calcOrderProgress(order);
    if (daysToFinal >= 0 && daysToFinal <= 3 && progress < 70) {
      risks.push({
        type: 'imminent_due',
        severity: 'high',
        message: `최종 납기 D-${daysToFinal} (진행률 ${progress}%)`,
      });
    }
  }

  // 3~5. 차수 단위 분석 (yarn 공정은 deliveries 별도 분기)
  const enriched = enrichProcessesWithEffectiveDates(order);
  enriched.forEach(p => {
    const procLabel = getProcessMeta(p.processType)?.label || p.processType;

    if (p.processType === 'yarn') {
      (p.yarnOrders || []).forEach(yo => {
        if (yo.useKnitterStock) return;  // 편직처 보유 — 발주 없음
        const yarnLabel = yo.yarnTypeName || '사종';
        (yo.deliveries || []).forEach(dv => {
          const sKey = normalizeDeliveryStatus(dv.status);
          // 입고완료면 위험 분석 제외
          if (sKey === 'done') return;

          // 3-yarn. 문제 상태 — mid
          if (sKey === 'issue') {
            risks.push({
              type: 'issue_delivery',
              severity: 'mid',
              message: `원사 ${yarnLabel} ${dv.deliveryNumber}차: 문제 상태`,
            });
          }

          // 4-yarn. 입고예정일 초과 (plannedArrivalDate < today, 미입고) — mid
          if (dv.plannedArrivalDate && dv.plannedArrivalDate < today) {
            const delay = diffDaysYmd(dv.plannedArrivalDate, today);
            risks.push({
              type: 'yarn_arrival_delay',
              severity: 'mid',
              message: `원사 ${yarnLabel} ${dv.deliveryNumber}차: 입고 ${delay}일 지연`,
            });
          }
        });
      });
      return;
    }

    (p.batches || []).forEach(b => {
      const sKey = normalizeBatchStatus(b.status);
      const bLabel = b.batchLabel || `${b.batchNumber || ''}차`;

      // 3. '문제' 상태 — mid
      if (sKey === 'issue') {
        risks.push({
          type: 'issue_batch',
          severity: 'mid',
          message: `${procLabel} ${bLabel}: 문제 상태${b.delayReason ? ` (${b.delayReason})` : ''}`,
        });
      }

      // 4. 차수 시작 지연 (계획 시작일 < 오늘인데 actualStartDate 없음, 진행 안 시작) — mid
      if (b.plannedStartDate && b.plannedStartDate < today && !b.actualStartDate && sKey === 'pending') {
        const delay = diffDaysYmd(b.plannedStartDate, today);
        risks.push({
          type: 'start_delay',
          severity: 'mid',
          message: `${procLabel} ${bLabel}: 시작 ${delay}일 지연`,
        });
      }

      // 5. 상태 정체 (진행중인데 actualStartDate 기준 7일 이상 미완료) — mid
      if (sKey === 'in_progress' && b.actualStartDate && !b.actualEndDate) {
        const inProgressDays = diffDaysYmd(b.actualStartDate, today);
        if (inProgressDays >= 7) {
          risks.push({
            type: 'status_stall',
            severity: 'mid',
            message: `${procLabel} ${bLabel}: 진행중 ${inProgressDays}일째`,
          });
        }
      }
    });
  });

  return risks;
};

// ============================================================
// 모든 오더 스캔 → 위험도 합산 + 정렬
// ============================================================
export const scanAllOrders = (orders) => {
  return (orders || []).map(order => {
    const risks = detectOrderRisks(order);
    const score = risks.reduce((sum, r) => sum + (SEVERITY_WEIGHT[r.severity] || 0), 0);
    const highCount = risks.filter(r => r.severity === 'high').length;
    return { order, risks, score, highCount };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score || b.highCount - a.highCount);
};

// ============================================================
// Daily Briefing — 오늘 진행 / 이번 주 시작 예정
// ============================================================
export const buildDailyBriefing = (orders) => {
  const today = todayYmd();
  const todayDate = new Date(today + 'T00:00:00');
  const weekFromToday = new Date(todayDate);
  weekFromToday.setDate(weekFromToday.getDate() + 7);
  const weekStr = `${weekFromToday.getFullYear()}-${String(weekFromToday.getMonth() + 1).padStart(2, '0')}-${String(weekFromToday.getDate()).padStart(2, '0')}`;

  const todayBatches = [];      // 오늘 종료 예정 또는 진행중
  const upcomingBatches = [];    // 이번 주(D+1~D+7) 시작 예정
  const issueBatches = [];       // 문제 상태

  (orders || []).forEach(order => {
    if (order.status === 'completed' || order.status === 'on_hold') return;
    const enriched = enrichProcessesWithEffectiveDates(order);
    enriched.forEach(p => {
      // yarn은 deliveries를 batch처럼 매핑
      if (p.processType === 'yarn') {
        (p.yarnOrders || []).forEach(yo => {
          if (yo.useKnitterStock) return;
          (yo.deliveries || []).forEach(dv => {
            const sKey = normalizeDeliveryStatus(dv.status);
            if (sKey === 'done') return;

            // 오늘 입고 예정
            const arrivalDate = dv.actualArrivalDate || dv.expectedArrivalDate || dv.plannedArrivalDate;
            if (arrivalDate === today && !dv.actualArrivalDate) {
              todayBatches.push({ order, process: p, yarnOrder: yo, delivery: dv, kind: 'delivery', type: 'ending' });
            }
            // 진행중 입고차수
            if (sKey === 'in_progress' && !dv.actualArrivalDate) {
              if (!todayBatches.some(x => x.delivery && x.delivery.id === dv.id)) {
                todayBatches.push({ order, process: p, yarnOrder: yo, delivery: dv, kind: 'delivery', type: 'in_progress' });
              }
            }
            // 이번 주 입고 예정 (D+1~D+7)
            const planned = dv.plannedArrivalDate;
            if (planned && planned > today && planned <= weekStr && !dv.actualArrivalDate) {
              upcomingBatches.push({ order, process: p, yarnOrder: yo, delivery: dv, kind: 'delivery', startDate: planned });
            }
            // 문제 상태
            if (sKey === 'issue') {
              issueBatches.push({ order, process: p, yarnOrder: yo, delivery: dv, kind: 'delivery' });
            }
          });
        });
        return;
      }

      (p.batches || []).forEach(b => {
        const sKey = normalizeBatchStatus(b.status);
        // 오늘 종료 예정
        const endDate = b.actualEndDate || b.expectedEndDate || b.plannedEndDate;
        if (endDate === today && !b.actualEndDate) {
          todayBatches.push({ order, process: p, batch: b, kind: 'batch', type: 'ending' });
        }
        // 진행중인 차수 (오늘 신경써야 할 것)
        if (sKey === 'in_progress' && !b.actualEndDate) {
          if (!todayBatches.some(x => x.batch && x.batch.id === b.id)) {
            todayBatches.push({ order, process: p, batch: b, kind: 'batch', type: 'in_progress' });
          }
        }
        // 이번 주 시작 예정 (D+1~D+7)
        const startDate = b.plannedStartDate;
        if (startDate && startDate > today && startDate <= weekStr && !b.actualStartDate) {
          upcomingBatches.push({ order, process: p, batch: b, kind: 'batch', startDate });
        }
        // 문제 상태
        if (sKey === 'issue') {
          issueBatches.push({ order, process: p, batch: b, kind: 'batch' });
        }
      });
    });
  });

  return {
    today,
    todayBatches: todayBatches.slice(0, 20),
    upcomingBatches: upcomingBatches
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
      .slice(0, 20),
    issueBatches: issueBatches.slice(0, 20),
  };
};
