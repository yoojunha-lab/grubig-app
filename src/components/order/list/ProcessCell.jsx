import React from 'react';
import { Send, Truck } from 'lucide-react';
import { BATCH_STATUS_COLORS, normalizeBatchStatus, getProcessQtyUnit } from '../../../constants/production';

// 컬러 매칭 헬퍼 — batch.colors[i].color === order.colors[i].name (대소문자/공백 무시)
const matchColor = (batchColors = [], colorName) => {
  if (!colorName) return null;
  const key = String(colorName).trim().toLowerCase();
  return batchColors.find(c => String(c.color || '').trim().toLowerCase() === key) || null;
};

const findColorInBatches = (batches = [], colorName) => {
  for (const b of batches) {
    const matched = matchColor(b.colors, colorName);
    if (matched) return { batch: b, matched };
  }
  return { batch: null, matched: null };
};

// ============================================================
// 공정 1개 × 컬러 1개 셀
// columnKey: 'yarn' | 'yarn_processing' | 'knitting' | 'dyeing' | 'finishing'
//          | 'physical_test' | 'visual_inspection' | 'brand_confirm' | 'shipping'
//
// process: enrichProcessesWithEffectiveDates 결과 1건
// color: { name, quantity } or null (컬러 없음)
// isFirstColorRow: rowspan 효과 (차수 단위 공정은 첫 행만 진하게)
// ============================================================
export const ProcessCell = ({ order, process, columnKey, color, colorIndex, isFirstColorRow, onClick }) => {
  // 미활성 공정 → 비어있는 회색 셀
  if (!process || !process.isActive) {
    return <div className="h-full min-h-[52px] bg-slate-50/40 flex items-center justify-center text-[10px] text-slate-300">-</div>;
  }

  // 분기
  switch (columnKey) {
    case 'yarn':
      return <YarnCell order={order} process={process} isFirstColorRow={isFirstColorRow} onClick={onClick} />;
    case 'dyeing':
      return <DyeingCell order={order} process={process} color={color} colorIndex={colorIndex} onClick={onClick} />;
    case 'brand_confirm':
      return <BrandConfirmCell order={order} process={process} color={color} colorIndex={colorIndex} onClick={onClick} />;
    case 'shipping':
      return <ShippingCell order={order} process={process} color={color} colorIndex={colorIndex} onClick={onClick} />;
    default:
      // 사가공/편직/후가공/검사 — 차수 단위 (모든 컬러 행에 동일 표시, 첫 행만 진하게)
      return (
        <BatchProcessCell
          order={order}
          process={process}
          columnKey={columnKey}
          isFirstColorRow={isFirstColorRow}
          onClick={onClick}
        />
      );
  }
};

// ============================================================
// 셀 공통 래퍼
// ============================================================
const CellWrapper = ({ children, onClick, dimmed, statusKey, className = '' }) => {
  const colors = BATCH_STATUS_COLORS[statusKey || 'pending'];
  return (
    <button
      onClick={(e) => onClick && onClick(e.currentTarget)}
      className={`block w-full h-full min-h-[52px] text-left px-2 py-1.5 border-l-4 ${colors.border} hover:bg-slate-50 transition-colors ${dimmed ? 'opacity-40' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

// 상태 배지 (작은 상태 칩)
const StatusBadge = ({ statusKey, label }) => {
  const c = BATCH_STATUS_COLORS[statusKey || 'pending'];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {label}
    </span>
  );
};

const statusLabelKor = (k) =>
  k === 'in_progress' ? '진행중' : k === 'done' ? '완료' : k === 'issue' ? '문제' : '대기';

// ============================================================
// 원사발주 셀 (yarnOrders + deliveries 진행률)
// ============================================================
const YarnCell = ({ order, process, isFirstColorRow, onClick }) => {
  const yarnOrders = process.yarnOrders || [];
  if (yarnOrders.length === 0) {
    return (
      <CellWrapper
        statusKey="pending"
        dimmed={!isFirstColorRow}
        onClick={(el) => onClick({ processType: 'yarn' }, el)}
      >
        <div className="text-[10px] text-slate-400">원사 정보 없음</div>
      </CellWrapper>
    );
  }

  // 모든 deliveries 평탄화 후 입고 진행률 계산
  let totalQty = 0, doneQty = 0, doneDeliveries = 0, totalDeliveries = 0;
  let aggStatus = 'pending';
  yarnOrders.forEach(yo => {
    if (yo.useKnitterStock) return;  // 보유 원사는 진행률 제외
    (yo.deliveries || []).forEach(dv => {
      totalDeliveries += 1;
      const q = Number(dv.quantity) || 0;
      totalQty += q;
      const st = normalizeBatchStatus(dv.status);
      if (st === 'done') {
        doneQty += q;
        doneDeliveries += 1;
      }
      if (st === 'in_progress' && aggStatus !== 'issue') aggStatus = 'in_progress';
      if (st === 'issue') aggStatus = 'issue';
    });
  });
  if (totalDeliveries > 0 && doneDeliveries === totalDeliveries) aggStatus = 'done';
  const progress = totalQty > 0 ? Math.round((doneQty / totalQty) * 100) : 0;

  // 사종 라벨
  const yarnLabel = yarnOrders.length === 1
    ? (yarnOrders[0].yarnTypeName || '사종')
    : `사종 ${yarnOrders.length}종`;

  return (
    <CellWrapper
      statusKey={aggStatus}
      dimmed={!isFirstColorRow}
      onClick={(el) => onClick({ processType: 'yarn' }, el)}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-slate-700 truncate" title={yarnLabel}>{yarnLabel}</span>
        <StatusBadge statusKey={aggStatus} label={statusLabelKor(aggStatus)} />
      </div>
      <div className="text-[10px] text-slate-500 font-mono">
        {doneQty.toLocaleString()}/{totalQty.toLocaleString()} kg
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <div className="flex-1 h-1 bg-slate-200 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[9px] font-mono font-bold text-slate-600">{progress}%</span>
      </div>
    </CellWrapper>
  );
};

// ============================================================
// 차수 단위 공정 셀 (사가공/편직/후가공/검사)
// ============================================================
const BatchProcessCell = ({ order, process, columnKey, isFirstColorRow, onClick }) => {
  const batches = process.batches || [];
  if (batches.length === 0) {
    return (
      <CellWrapper
        statusKey="pending"
        dimmed={!isFirstColorRow}
        onClick={(el) => onClick({ processType: columnKey }, el)}
      >
        <div className="text-[10px] text-slate-400">차수 없음</div>
      </CellWrapper>
    );
  }

  // 모든 차수 평균 진행률 + 집계 상태
  let total = 0, done = 0, inProg = 0, issue = 0, totalQty = 0;
  batches.forEach(b => {
    total += 1;
    totalQty += Number(b.quantity) || 0;
    const st = normalizeBatchStatus(b.status);
    if (st === 'done') done += 1;
    else if (st === 'in_progress') inProg += 1;
    else if (st === 'issue') issue += 1;
  });
  let aggStatus = 'pending';
  if (issue > 0) aggStatus = 'issue';
  else if (done === total) aggStatus = 'done';
  else if (inProg > 0 || done > 0) aggStatus = 'in_progress';

  const qtyUnit = getProcessQtyUnit(columnKey);

  // 첫 차수 정보 (대표)
  const firstBatch = batches[0];
  const repBatchId = firstBatch?.id;

  return (
    <CellWrapper
      statusKey={aggStatus}
      dimmed={!isFirstColorRow}
      onClick={(el) => onClick({ processType: columnKey, batchId: repBatchId }, el)}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-slate-700">{total}차수</span>
        <StatusBadge statusKey={aggStatus} label={statusLabelKor(aggStatus)} />
      </div>
      {qtyUnit && totalQty > 0 && (
        <div className="text-[10px] text-slate-500 font-mono">{totalQty.toLocaleString()} {qtyUnit}</div>
      )}
      <div className="flex items-center gap-1 mt-0.5">
        <div className="flex-1 h-1 bg-slate-200 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
        </div>
        <span className="text-[9px] font-mono font-bold text-slate-600">{done}/{total}</span>
      </div>
    </CellWrapper>
  );
};

// ============================================================
// 염가공 셀 (해당 컬러의 batch.colors[] 항목)
// ============================================================
const DyeingCell = ({ order, process, color, colorIndex, onClick }) => {
  const batches = process.batches || [];
  if (batches.length === 0 || !color) {
    return (
      <CellWrapper statusKey="pending" onClick={(el) => onClick({ processType: 'dyeing' }, el)}>
        <div className="text-[10px] text-slate-400">-</div>
      </CellWrapper>
    );
  }

  const { batch: matchedBatch, matched } = findColorInBatches(batches, color.name);

  // 컬러 매칭 없으면 차수 전체 상태 표시 (염가공 컬러 분할 미설정 케이스)
  if (!matched) {
    const repBatch = batches[0];
    const repStatus = normalizeBatchStatus(repBatch?.status);
    return (
      <CellWrapper
        statusKey={repStatus}
        onClick={(el) => onClick({ processType: 'dyeing', batchId: repBatch?.id }, el)}
      >
        <div className="text-[10px] text-slate-400 mb-0.5">컬러 미배정</div>
        <StatusBadge statusKey={repStatus} label={statusLabelKor(repStatus)} />
      </CellWrapper>
    );
  }

  // 컬러별 진행 상태 — batch.status를 우선 정규화, 컬러 actualEndDate 있으면 done
  let status = normalizeBatchStatus(matchedBatch?.status);
  if (matched.actualEndDate) status = 'done';

  return (
    <CellWrapper
      statusKey={status}
      onClick={(el) => onClick({ processType: 'dyeing', batchId: matchedBatch.id, colorName: color.name }, el)}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-slate-700 truncate">{color.name}</span>
        <StatusBadge statusKey={status} label={statusLabelKor(status)} />
      </div>
      <div className="text-[10px] text-slate-500 font-mono">{Number(matched.quantity || 0).toLocaleString()} kg</div>
      {matched.plannedEndDate && (
        <div className="text-[9px] text-slate-400 font-mono mt-0.5">~ {matched.plannedEndDate}</div>
      )}
    </CellWrapper>
  );
};

// ============================================================
// CONFIRM SHEET 셀 (brandConfirms 라운드)
// ============================================================
const BrandConfirmCell = ({ order, process, color, colorIndex, onClick }) => {
  if (!color || !process || !process.batches) {
    return (
      <CellWrapper statusKey="pending" onClick={(el) => onClick({ processType: 'dyeing' }, el)}>
        <div className="text-[10px] text-slate-400">-</div>
      </CellWrapper>
    );
  }

  const { batch: matchedBatch, matched } = findColorInBatches(process.batches, color.name);
  const rounds = matched?.brandConfirms || [];
  if (rounds.length === 0) {
    return (
      <CellWrapper
        statusKey="pending"
        onClick={(el) => onClick({ processType: 'dyeing', batchId: matchedBatch?.id, colorName: color?.name }, el)}
      >
        <div className="text-[10px] text-slate-400">미시작</div>
      </CellWrapper>
    );
  }

  const last = rounds[rounds.length - 1];
  let status = 'pending';
  if (last.result === 'pass') status = 'done';
  else if (last.result === 'fail') status = 'issue';
  else if (last.sentDate) status = 'in_progress';

  return (
    <CellWrapper
      statusKey={status}
      onClick={(el) => onClick({ processType: 'dyeing', batchId: matchedBatch?.id, colorName: color.name, focusConfirm: true }, el)}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-slate-700">{last.round || rounds.length}차</span>
        <StatusBadge statusKey={status} label={
          last.result === 'pass' ? 'Pass' :
          last.result === 'fail' ? 'Fail' :
          last.result === 'retest' ? '재시험' :
          last.sentDate ? '진행중' : '대기'
        } />
      </div>
      {last.sentDate && (
        <div className="text-[9px] text-slate-500 font-mono">발송 {last.sentDate}</div>
      )}
      {last.resultDate && (
        <div className="text-[9px] text-slate-500 font-mono">결과 {last.resultDate}</div>
      )}
    </CellWrapper>
  );
};

// ============================================================
// 납품 셀 (shippingSample)
// ============================================================
const ShippingCell = ({ order, process, color, colorIndex, onClick }) => {
  if (!color || !process || !process.batches) {
    return (
      <CellWrapper statusKey="pending" onClick={(el) => onClick({ processType: 'dyeing' }, el)}>
        <div className="text-[10px] text-slate-400">-</div>
      </CellWrapper>
    );
  }

  const { batch: matchedBatch, matched } = findColorInBatches(process.batches, color.name);
  const ship = matched?.shippingSample;
  if (!ship || !ship.sentDate) {
    return (
      <CellWrapper
        statusKey="pending"
        onClick={(el) => onClick({ processType: 'dyeing', batchId: matchedBatch?.id, colorName: color?.name, focusShipping: true }, el)}
      >
        <div className="text-[10px] text-slate-400 flex items-center gap-1">
          <Truck className="w-3 h-3" /> 미발송
        </div>
      </CellWrapper>
    );
  }

  return (
    <CellWrapper
      statusKey="done"
      onClick={(el) => onClick({ processType: 'dyeing', batchId: matchedBatch?.id, colorName: color?.name, focusShipping: true }, el)}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
          <Send className="w-3 h-3" /> 발송
        </span>
        <StatusBadge statusKey="done" label="완료" />
      </div>
      <div className="text-[10px] text-slate-600 font-mono">{ship.sentDate}</div>
      {ship.yards > 0 && (
        <div className="text-[10px] text-slate-500 font-mono">{Number(ship.yards).toLocaleString()} yd</div>
      )}
    </CellWrapper>
  );
};
