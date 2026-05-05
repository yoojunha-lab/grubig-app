import React from 'react';
import { Trash2, Eye, AlertCircle, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { ORDER_STATUS_COLORS, START_STAGES, PROCESS_TYPES } from '../../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass, getInProgressItems } from '../../utils/orderCalculations';
import { BatchRow, BatchTableHeader } from './editing/BatchRow';
import { DeliveryRow, DeliveryTableHeader } from './editing/DeliveryRow';

const procLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;
const shortDate = (ymd) => (ymd ? ymd.slice(5).replace('-', '/') : '');

const itemLabel = (item) => {
  if (item.kind === 'delivery') {
    return `원사 ${item.yarnOrder?.yarnTypeName || '사종'} ${item.delivery.deliveryNumber}차`;
  }
  return `${procLabel(item.processType)} ${item.batch.batchLabel || `${item.batch.batchNumber}차`}`;
};
const itemId = (item) => item.kind === 'delivery' ? item.delivery.id : item.batch.id;

const COLUMN_COUNT = 10;

export const DesktopOrderRow = ({
  order, onView, onDelete, onOpenBatch,
  expanded = false, onToggleExpand,
  onSaveBatch, onSaveYarnDelivery,
}) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);
  const stageLabel = START_STAGES.find(s => s.key === order.startStage)?.label || '-';

  const activeProcessCount = (order.processes || []).filter(p => p.isActive).length;
  const inProgressItems = getInProgressItems(order);

  const batchItems = inProgressItems.filter(it => it.kind === 'batch');
  const deliveryItems = inProgressItems.filter(it => it.kind === 'delivery');

  // v2 호환: quantityYd 우선, 없으면 totalQuantity 폴백
  const qty = order.quantityYd ?? order.totalQuantity ?? 0;

  const canExpand = inProgressItems.length > 0 && !!onToggleExpand;

  return (
    <>
      <tr className={`border-b border-slate-100 transition-colors ${expanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
        <td className="px-3 py-3">
          <div className="flex items-start gap-1.5">
            {/* 펼침 토글 */}
            {canExpand ? (
              <button
                onClick={onToggleExpand}
                className="p-0.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded shrink-0 mt-0.5"
                title={expanded ? '접기' : '진행중 차수 펼쳐서 수정'}
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-mono font-bold text-xs text-teal-700">{order.orderNumber}</span>
              <span className="text-xs text-slate-500 truncate max-w-[180px]">{order.articleNo || order.orderName || '-'}</span>
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700">{order.customer}</span>
            {order.brand && <span className="text-[11px] text-slate-400">{order.brand}</span>}
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            order.type === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {order.type === 'main' ? '메인' : '샘플'}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className="text-[11px] font-bold text-slate-600">{stageLabel}</span>
        </td>
        <td className="px-3 py-3 text-right font-mono text-xs">
          {Number(qty).toLocaleString()} YD
        </td>
        <td className="px-3 py-3 text-center font-mono text-xs text-slate-700">
          {order.finalDueDate || '-'}
        </td>
        <td className="px-3 py-3 text-center">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${healthColors.bg} ${healthColors.text} border ${healthColors.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${healthColors.dot}`}></span>
            {order.estimatedDueDate || '-'}
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
            {order.status === 'active' && '진행중'}
            {order.status === 'completed' && '완료'}
            {order.status === 'on_hold' && '보류'}
            {order.status === 'delayed_risk' && '납기위험'}
          </span>
        </td>
        <td className="px-3 py-3 min-w-[220px]">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="text-[11px] text-slate-500 font-mono w-8 text-right">{progress}%</span>
          </div>
          {inProgressItems.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {inProgressItems.slice(0, 3).map(item => {
                const overdue = !!item.overdue;
                const cls = overdue
                  ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 hover:border-red-500'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-400';
                return (
                  <button
                    key={`${item.processType}-${itemId(item)}`}
                    onClick={() => onOpenBatch ? onOpenBatch(item.processType, itemId(item)) : onView && onView(order)}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded transition-all ${cls}`}
                    title={`${itemLabel(item)} · ~${item.endDate || '-'}${overdue ? ' (납기 초과)' : ''}`}
                  >
                    {overdue ? (
                      <AlertCircle className="w-2.5 h-2.5" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                    {itemLabel(item)}
                    {item.endDate && <span className={`font-mono ${overdue ? 'text-red-500' : 'text-blue-500/80'}`}>~{shortDate(item.endDate)}</span>}
                  </button>
                );
              })}
              {inProgressItems.length > 3 && (
                <span className="text-[10px] text-slate-400 font-bold self-center">+{inProgressItems.length - 3}</span>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 mt-0.5">활성 공정 {activeProcessCount}개 · 진행중 차수 없음</div>
          )}
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onView(order)}
              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-all"
              title="상세보기"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(order.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* 펼침 영역: 진행중 차수 + 입고차수 인라인 편집 */}
      {expanded && inProgressItems.length > 0 && (
        <tr className="bg-slate-50/70 border-b-2 border-slate-200">
          <td colSpan={COLUMN_COUNT} className="px-6 py-4">
            <div className="space-y-4">
              {/* 공정별로 묶어서 단위(KG/YD/없음)가 일관되게 표시되도록 */}
              {(() => {
                const byProc = new Map();
                batchItems.forEach(item => {
                  if (!byProc.has(item.processType)) byProc.set(item.processType, []);
                  byProc.get(item.processType).push(item);
                });
                return Array.from(byProc.entries()).map(([pType, items]) => (
                  <div key={`bg-${pType}`} className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                    <div className="px-3 py-2 bg-slate-100/60 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      {procLabel(pType)} 진행중 ({items.length})
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
              {batchItems.length > 0 && (
                <p className="text-[10px] text-slate-400 px-2">
                  ※ 각 셀에서 입력 후 다른 셀로 이동(또는 Tab)하면 자동 저장됩니다. 차수 추가/삭제는 상세 모달에서.
                </p>
              )}
              {deliveryItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                  <div className="px-3 py-2 bg-slate-100/60 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200 flex items-center gap-1.5">
                    <Truck className="w-3 h-3" />
                    진행중 원사 입고 ({deliveryItems.length})
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
          </td>
        </tr>
      )}
    </>
  );
};
