// GRUBIG ERP - 감사 로그 (changeLog) 헬퍼
// order 문서 내 changeLog 배열에 변경 이력 누적
// 형태: { id, ts, userEmail, action, summary, diff? }

import { BATCH_STATUSES } from '../constants/production';

const MAX_LOG_ENTRIES = 200;  // 오더당 최대 로그 (1MB doc 제한 방어)

// changeLog entry 만들기
export const makeChangeLogEntry = (userEmail, action, summary, diff) => ({
  id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  ts: new Date().toISOString(),
  userEmail: userEmail || '',
  action,
  summary,
  ...(diff ? { diff } : {}),
});

// order에 새 entry 추가 (불변, 새 객체 반환)
export const appendChangeLog = (order, entry) => {
  const log = Array.isArray(order.changeLog) ? order.changeLog : [];
  const newLog = [entry, ...log].slice(0, MAX_LOG_ENTRIES);
  return { ...order, changeLog: newLog };
};

// 차수 status 라벨 변환 (감사 로그 요약용)
export const statusLabel = (key) => {
  const found = BATCH_STATUSES.find(s => s.key === key);
  if (found) return found.label;
  return key || '대기';
};

// ============================================================
// 차수 변경 diff 분석 → 사람이 읽을 수 있는 summary 생성
// 변경된 필드를 모두 잡아서 한 줄 요약
// ============================================================
// 폐기된 필드(batchLabel, expectedEndDate, actualStartDate)는 UI에서 편집 불가 → 추적 제외
const TRACKED_FIELDS = [
  'quantity', 'status',
  'plannedStartDate', 'plannedEndDate',
  'actualEndDate',
  'notes', 'delayReason',
];

const FIELD_LABELS = {
  quantity: '수량',
  status: '상태',
  plannedStartDate: '시작일',
  plannedEndDate: '종료일',
  actualEndDate: '실제 종료일',
  notes: '메모',
  delayReason: '문제 사유',
};

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (field === 'status') return statusLabel(value);
  if (field === 'notes' || field === 'delayReason') {
    const s = String(value);
    return s.length > 30 ? `"${s.slice(0, 30)}..."` : `"${s}"`;
  }
  return String(value);
};

export const summarizeBatchDiff = (oldBatch, newBatch, processLabel) => {
  if (!oldBatch || !newBatch) return null;
  const changes = [];
  const diff = {};

  TRACKED_FIELDS.forEach(field => {
    const oldVal = oldBatch[field] ?? '';
    const newVal = newBatch[field] ?? '';
    if (oldVal !== newVal) {
      changes.push(`${FIELD_LABELS[field] || field} ${formatValue(field, oldVal)}→${formatValue(field, newVal)}`);
      diff[field] = { before: oldVal, after: newVal };
    }
  });

  if (changes.length === 0) return null;

  const label = newBatch.batchLabel || oldBatch.batchLabel
    || (newBatch.batchNumber || oldBatch.batchNumber ? `${newBatch.batchNumber || oldBatch.batchNumber}차` : '차수');
  const prefix = processLabel ? `${processLabel} ${label}` : label;
  const summary = `${prefix}: ${changes.join(', ')}`;

  return { summary, diff };
};

// 오더 메타 변경 diff
const ORDER_TRACKED_FIELDS = [
  'orderName', 'articleNo', 'customer', 'brand', 'type', 'startStage',
  'quantityYd', 'finalDueDate', 'status', 'notes',
];

const ORDER_FIELD_LABELS = {
  orderName: '오더명',
  articleNo: 'ART',
  customer: '거래처',
  brand: '브랜드',
  type: '타입',
  startStage: '시작점',
  quantityYd: '수량',
  finalDueDate: '최종납기',
  status: '오더상태',
  notes: '비고',
};

export const summarizeOrderDiff = (oldOrder, newOrder) => {
  if (!oldOrder) return null;
  const changes = [];
  const diff = {};

  ORDER_TRACKED_FIELDS.forEach(field => {
    const oldVal = oldOrder[field] ?? '';
    const newVal = newOrder[field] ?? '';
    if (oldVal !== newVal) {
      const label = ORDER_FIELD_LABELS[field] || field;
      const fmt = (v) => v === '' || v === null || v === undefined ? '-' : String(v);
      changes.push(`${label} ${fmt(oldVal)}→${fmt(newVal)}`);
      diff[field] = { before: oldVal, after: newVal };
    }
  });

  // 활성 공정 변경도 추적
  const oldActive = (oldOrder.processes || []).filter(p => p.isActive).map(p => p.processType).sort().join(',');
  const newActive = (newOrder.processes || []).filter(p => p.isActive).map(p => p.processType).sort().join(',');
  if (oldActive !== newActive) {
    changes.push(`활성공정 [${oldActive}]→[${newActive}]`);
    diff.activeProcesses = { before: oldActive, after: newActive };
  }

  if (changes.length === 0) return null;
  return { summary: changes.join(', '), diff };
};
