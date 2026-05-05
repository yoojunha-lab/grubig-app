// GRUBIG ERP - 간트 차트 공통 유틸리티
// (단일/다중 오더 간트 모두에서 import)

import { normalizeDeliveryStatus } from '../../../constants/production';
import { isYarnDeliveryOverdue } from '../../../utils/orderCalculations';

// ============================================================
// 시각 상수
// ============================================================
export const DAY_PX = 60;  // 1일당 픽셀 너비 (한 화면 폭에 약 12~15일 보이도록)
export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// ============================================================
// 날짜 포매팅 헬퍼
// ============================================================

// YYYY-MM-DD 문자열 → JS Date
export const toDate = (ymd) => {
  if (!ymd) return null;
  const d = new Date(ymd + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

export const dayLabel     = (date) => `${date.getDate()}`;
export const weekdayLabel = (date) => WEEKDAY_KO[date.getDay()];

// ============================================================
// 원사 deliveries → batch 형태로 평탄화
//   yarn 공정의 yarnOrders[].deliveries[]를 간트 바로 표시하기 위해
//   batch와 동일한 모양 ({plannedStartDate, plannedEndDate, status, ...}) 으로 평탄화
//   - 편직처 보유(useKnitterStock=true) 사종은 제외
//   - 입고예정/실제입고 모두 없는 항목은 제외
//   - status는 4상태 키로 정규화
// ============================================================
export const flattenYarnDeliveries = (yarnProcess) => {
  if (!yarnProcess) return [];
  const items = [];
  (yarnProcess.yarnOrders || []).forEach(yo => {
    if (yo.useKnitterStock) return;
    (yo.deliveries || []).forEach(dv => {
      if (!dv.plannedArrivalDate && !dv.actualArrivalDate) return;
      const planned = dv.plannedArrivalDate || dv.expectedArrivalDate || '';
      const actual = dv.actualArrivalDate || '';
      items.push({
        id: dv.id,
        batchLabel: `${yo.yarnTypeName || '사종'} ${dv.deliveryNumber}차`,
        batchNumber: dv.deliveryNumber,
        status: normalizeDeliveryStatus(dv.status),
        plannedStartDate: planned,
        plannedEndDate: planned,
        actualStartDate: actual,
        actualEndDate: actual,
        expectedEndDate: dv.expectedArrivalDate || '',
        quantity: `${dv.quantity || 0}kg`,
        notes: yo.supplier ? `공급처: ${yo.supplier}` : '',
        _isYarn: true,
        _yarnOrder: yo,
        _delivery: dv,
        _overdue: isYarnDeliveryOverdue(dv),
      });
    });
  });
  return items.sort((a, b) => {
    const da = a.plannedStartDate || '';
    const db = b.plannedStartDate || '';
    if (da !== db) return da.localeCompare(db);
    return (a.batchNumber || 0) - (b.batchNumber || 0);
  });
};
