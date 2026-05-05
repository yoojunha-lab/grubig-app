import React, { useMemo } from 'react';
import { LayoutGrid, Calendar, AlertCircle, Truck } from 'lucide-react';
import { PROCESS_TYPES, BATCH_STATUSES, BATCH_STATUS_COLORS, normalizeDeliveryStatus, getProcessQtyUnit } from '../constants/production';
import { isBatchOverdue, isYarnDeliveryOverdue } from '../utils/orderCalculations';

// ============================================================
// KanbanView — 4상태 컬럼이 메인, 각 컬럼 내부에 공정별 소그룹
// 빈 공정 그룹은 렌더 안 함
// yarn 공정은 deliveries를 카드로 표시 (편직처 보유 사종 제외)
// ============================================================
export const KanbanView = ({ orders = [], onOpenOrderDetail }) => {
  // 결과 구조: { [statusKey]: { [processType]: [ {order, process, batch?, delivery?, yarnOrder?, kind}, ... ] } }
  const grouped = useMemo(() => {
    const result = {};
    BATCH_STATUSES.forEach(s => { result[s.key] = {}; });

    (orders || []).forEach(order => {
      if (order.status === 'completed' || order.status === 'on_hold') return;
      (order.processes || []).forEach(proc => {
        if (!proc.isActive) return;
        if (proc.processType === 'yarn') {
          // 원사: deliveries를 카드로
          (proc.yarnOrders || []).forEach(yo => {
            if (yo.useKnitterStock) return;
            (yo.deliveries || []).forEach(dv => {
              const sKey = normalizeDeliveryStatus(dv.status);
              if (!result[sKey]['yarn']) result[sKey]['yarn'] = [];
              result[sKey]['yarn'].push({ order, process: proc, yarnOrder: yo, delivery: dv, kind: 'delivery' });
            });
          });
          return;
        }
        (proc.batches || []).forEach(batch => {
          const sKey = BATCH_STATUSES.some(s => s.key === batch.status) ? batch.status : 'pending';
          if (!result[sKey][proc.processType]) result[sKey][proc.processType] = [];
          result[sKey][proc.processType].push({ order, process: proc, batch, kind: 'batch' });
        });
      });
    });
    return result;
  }, [orders]);

  // 공정별 카운트 (소헤더용)
  const totalByStatus = (sKey) =>
    Object.values(grouped[sKey] || {}).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div>
      {/* status 4개 컬럼 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {BATCH_STATUSES.map(s => {
          const c = BATCH_STATUS_COLORS[s.key];
          const groupsForStatus = grouped[s.key] || {};
          const total = totalByStatus(s.key);

          // 공정 순서대로 (sequenceOrder), 비어있는 공정 제외 — yarn 포함
          const orderedProcesses = PROCESS_TYPES
            .filter(p => (groupsForStatus[p.key] || []).length > 0)
            .sort((a, b) => (a.defaultSequence || 0) - (b.defaultSequence || 0));

          return (
            <div key={s.key} className={`rounded-xl border-2 ${c.border} ${c.bg.replace('100', '50')}`}>
              {/* 컬럼 헤더 */}
              <div className={`px-3 py-2.5 border-b-2 ${c.border} flex items-center justify-between sticky top-0 ${c.bg.replace('100', '50')} z-10`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`}></span>
                  <span className={`text-sm font-bold ${c.text}`}>{s.label}</span>
                </div>
                <span className={`text-xs font-bold ${c.text}`}>{total}</span>
              </div>

              {/* 공정별 소그룹 */}
              <div className="p-2 space-y-3 max-h-[700px] overflow-y-auto">
                {orderedProcesses.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">없음</div>
                ) : (
                  orderedProcesses.map(p => {
                    const items = groupsForStatus[p.key] || [];
                    return (
                      <div key={p.key}>
                        {/* 공정 소헤더 */}
                        <div className="flex items-center gap-1.5 px-1 mb-1.5">
                          <span className="w-4 h-4 bg-slate-200 text-slate-700 text-[10px] font-bold rounded flex items-center justify-center">
                            {p.defaultSequence}
                          </span>
                          <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                            {p.label}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-auto font-bold">{items.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {items.map(item => {
                            if (item.kind === 'delivery') {
                              return (
                                <DeliveryKanbanCard
                                  key={`${item.order.id}-${item.delivery.id}`}
                                  order={item.order}
                                  yarnOrder={item.yarnOrder}
                                  delivery={item.delivery}
                                  onClick={() => onOpenOrderDetail(item.order.id, 'yarn', item.delivery.id)}
                                />
                              );
                            }
                            return (
                              <BatchKanbanCard
                                key={`${item.order.id}-${item.batch.id}`}
                                order={item.order}
                                batch={item.batch}
                                processType={item.process.processType}
                                onClick={() => onOpenOrderDetail(item.order.id, item.process.processType, item.batch.id)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 mt-3 text-center">
        ※ 카드 클릭 시 오더 상세에서 표 형식으로 차수 편집 (드래그&amp;드롭은 향후 추가)
      </p>
    </div>
  );
};

// ============================================================
// OrderKanbanPage — 헤더 포함 풀 페이지 (단독 라우트용, 호환 유지)
// ============================================================
export const OrderKanbanPage = ({ orders = [], onOpenOrderDetail }) => {
  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">칸반 보드</h2>
            <p className="text-xs text-slate-500 mt-0.5">공정별 차수 진행 상황을 한눈에</p>
          </div>
        </div>
      </div>
      <KanbanView orders={orders} onOpenOrderDetail={onOpenOrderDetail} />
    </div>
  );
};

// ============================================================
// 차수 카드 (칸반)
// ============================================================
const BatchKanbanCard = ({ order, batch, processType, onClick }) => {
  const endDate = batch.actualEndDate || batch.expectedEndDate || batch.plannedEndDate;
  const overdue = isBatchOverdue(batch);
  const qtyUnit = getProcessQtyUnit(processType);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border-2 rounded-lg p-2.5 hover:shadow-md transition-all ${
        overdue ? 'border-red-400 bg-red-50/30 hover:border-red-500' : 'border-slate-200 hover:border-teal-400'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {overdue && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" title="납기 초과" />}
        <span className="font-mono text-[11px] font-bold text-teal-700">{order.orderNumber}</span>
        <span className="text-[11px] font-bold text-slate-700">{batch.batchLabel || `${batch.batchNumber}차`}</span>
        {qtyUnit && (
          <span className="text-[10px] text-slate-500 ml-auto font-mono">{batch.quantity}{qtyUnit}</span>
        )}
      </div>
      <div className="text-xs font-bold text-slate-800 truncate">{order.customer}</div>
      {(order.articleNo || order.orderName) && (
        <div className="text-[11px] text-slate-500 truncate">{order.articleNo || order.orderName}</div>
      )}
      {endDate && (
        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {endDate}
        </div>
      )}
      {(batch.colors || []).length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {(batch.colors || []).slice(0, 3).map(c => (
            <span key={c.color} className="text-[10px] bg-slate-100 text-slate-700 px-1 rounded">{c.color}</span>
          ))}
          {(batch.colors || []).length > 3 && (
            <span className="text-[10px] text-slate-500">+{(batch.colors || []).length - 3}</span>
          )}
        </div>
      )}
      {batch.notes && (
        <div className="mt-1 text-[10px] text-slate-600 line-clamp-2 bg-slate-50 px-1.5 py-0.5 rounded">
          {batch.notes}
        </div>
      )}
      {batch.delayReason && (
        <div className="mt-1 text-[10px] text-red-700 line-clamp-2 bg-red-50 px-1.5 py-0.5 rounded flex items-start gap-0.5">
          <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
          {batch.delayReason}
        </div>
      )}
    </button>
  );
};

// ============================================================
// 원사 입고차수 카드 (칸반)
// ============================================================
const DeliveryKanbanCard = ({ order, yarnOrder, delivery, onClick }) => {
  const dateLabel = delivery.actualArrivalDate || delivery.expectedArrivalDate || delivery.plannedArrivalDate;
  const overdue = isYarnDeliveryOverdue(delivery);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border-2 rounded-lg p-2.5 hover:shadow-md transition-all ${
        overdue ? 'border-red-400 bg-red-50/30 hover:border-red-500' : 'border-slate-200 hover:border-teal-400'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {overdue && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" title="입고 예정일 초과" />}
        <span className="font-mono text-[11px] font-bold text-teal-700">{order.orderNumber}</span>
        <span className="text-[11px] font-bold text-slate-700">{delivery.deliveryNumber}차</span>
        <span className="text-[10px] text-slate-500 ml-auto font-mono">{delivery.quantity || 0}kg</span>
      </div>
      <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
        <Truck className="w-3 h-3 text-slate-400" />
        {yarnOrder.yarnTypeName || '(사종)'}
      </div>
      <div className="text-[11px] text-slate-500 truncate">{order.customer}</div>
      {dateLabel && (
        <div className={`text-[11px] mt-1 flex items-center gap-1 ${overdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
          <Calendar className="w-3 h-3" />
          {dateLabel}
        </div>
      )}
      {yarnOrder.supplier && (
        <div className="text-[10px] text-slate-400 mt-0.5">공급처: {yarnOrder.supplier}</div>
      )}
    </button>
  );
};
