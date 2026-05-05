import React from 'react';
import { Trash2, Eye, Calendar, Activity, AlertCircle, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { ORDER_STATUS_COLORS, START_STAGES, PROCESS_TYPES } from '../../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass, getInProgressItems } from '../../utils/orderCalculations';
import { BatchRow, BatchTableHeader } from './editing/BatchRow';
import { DeliveryRow, DeliveryTableHeader } from './editing/DeliveryRow';

const procLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;
const shortDate = (ymd) => (ymd ? ymd.slice(5).replace('-', '/') : '');
const itemLabel = (item) => item.kind === 'delivery'
  ? `원사 ${item.yarnOrder?.yarnTypeName || '사종'} ${item.delivery.deliveryNumber}차`
  : `${procLabel(item.processType)} ${item.batch.batchLabel || `${item.batch.batchNumber}차`}`;
const itemId = (item) => item.kind === 'delivery' ? item.delivery.id : item.batch.id;

export const MobileOrderCard = ({
  order, onView, onDelete, onOpenBatch,
  expanded = false, onToggleExpand,
  onSaveBatch, onSaveYarnDelivery,
}) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);
  const stageLabel = START_STAGES.find(s => s.key === order.startStage)?.label || '';
  const inProgressItems = getInProgressItems(order);
  const batchItems = inProgressItems.filter(it => it.kind === 'batch');
  const deliveryItems = inProgressItems.filter(it => it.kind === 'delivery');

  const canExpand = inProgressItems.length > 0 && !!onToggleExpand;

  // v2 호환
  const qty = order.quantityYd ?? order.totalQuantity ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs font-bold text-teal-700">{order.orderNumber}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              order.type === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {order.type === 'main' ? '메인' : '샘플'}
            </span>
            {stageLabel && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                {stageLabel}
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-800 truncate">{order.articleNo || order.orderName || '-'}</div>
          <div className="text-xs text-slate-500">
            {order.customer}{order.brand ? ` / ${order.brand}` : ''}
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text} shrink-0`}>
          {order.status === 'active' && '진행중'}
          {order.status === 'completed' && '완료'}
          {order.status === 'on_hold' && '보류'}
          {order.status === 'delayed_risk' && '납기위험'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 my-3 text-xs">
        <div>
          <span className="text-slate-400 block text-[10px]">수량 (YD)</span>
          <span className="font-mono font-bold text-slate-700">{Number(qty).toLocaleString()} YD</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">최종 납기</span>
          <span className="font-mono font-bold text-slate-700 flex items-center gap-1">
            <Calendar className="w-3 h-3" />{order.finalDueDate || '-'}
          </span>
        </div>
      </div>

      <div className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between mb-3 ${healthColors.bg} ${healthColors.border}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${healthColors.dot}`}></span>
          <span className={`text-[11px] font-bold ${healthColors.text}`}>예상 납기</span>
        </div>
        <span className={`font-mono text-xs font-bold ${healthColors.text}`}>{order.estimatedDueDate || '-'}</span>
      </div>

      {inProgressItems.length > 0 && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Activity className="w-3 h-3 text-blue-600" />
            <span className="text-[11px] font-bold text-blue-700">진행중 차수 ({inProgressItems.length})</span>
            {canExpand && (
              <button
                onClick={onToggleExpand}
                className="ml-auto flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800"
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {expanded ? '접기' : '펼쳐 수정'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {inProgressItems.map(item => {
              const overdue = !!item.overdue;
              const cls = overdue
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-400';
              return (
                <button
                  key={`${item.processType}-${itemId(item)}`}
                  onClick={() => onOpenBatch ? onOpenBatch(item.processType, itemId(item)) : onView && onView(order)}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded active:scale-95 transition-all ${cls}`}
                >
                  {overdue ? <AlertCircle className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  {itemLabel(item)}
                  {item.endDate && <span className={`font-mono ${overdue ? 'text-red-500' : 'text-blue-500/80'}`}>~{shortDate(item.endDate)}</span>}
                </button>
              );
            })}
          </div>

          {/* 펼침 시 인라인 편집 표 (공정별로 그룹) */}
          {expanded && (
            <div className="mt-3 space-y-3">
              {(() => {
                const byProc = new Map();
                batchItems.forEach(item => {
                  if (!byProc.has(item.processType)) byProc.set(item.processType, []);
                  byProc.get(item.processType).push(item);
                });
                return Array.from(byProc.entries()).map(([pType, items]) => (
                  <div key={`bg-${pType}`} className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                    <div className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-600">
                      {procLabel(pType)}
                    </div>
                    <table className="w-full text-xs">
                      <BatchTableHeader processType={pType} hasAnyColors={(order.colors || []).length > 0} />
                      <tbody>
                        {items.map(item => (
                          <BatchRow
                            key={`b-${pType}-${item.batch.id}`}
                            batch={item.batch}
                            orderColors={order.colors}
                            processType={pType}
                            onSave={async (draftBatch) => {
                              if (onSaveBatch) await onSaveBatch(order.id, pType, item.batch.id, draftBatch);
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}
              {deliveryItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                  <div className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                    <Truck className="w-2.5 h-2.5" /> 원사 입고
                  </div>
                  <table className="w-full text-xs">
                    <DeliveryTableHeader />
                    <tbody>
                      {deliveryItems.map(item => (
                        <DeliveryRow
                          key={`d-${item.yarnOrder.id}-${item.delivery.id}`}
                          delivery={item.delivery}
                          onSave={async (draftDv) => {
                            if (onSaveYarnDelivery) await onSaveYarnDelivery(order.id, item.yarnOrder.id, item.delivery.id, draftDv);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">{progress}%</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(order)}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-100"
        >
          <Eye className="w-3.5 h-3.5" /> 상세보기
        </button>
        <button
          onClick={() => onDelete(order.id)}
          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
