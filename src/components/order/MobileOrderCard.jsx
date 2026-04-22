import React from 'react';
import { Trash2, Eye, Calendar } from 'lucide-react';
import { ORDER_STATUS_COLORS } from '../../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass } from '../../utils/orderCalculations';

export const MobileOrderCard = ({ order, onView, onDelete }) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-teal-700">{order.orderNumber}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              order.type === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {order.type === 'main' ? '메인' : '샘플'}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              order.dyeingMethod === 'yarn_dyed' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {order.dyeingMethod === 'yarn_dyed' ? '선염' : '후염'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 truncate">{order.orderName}</div>
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
          <span className="text-slate-400 block text-[10px]">총 수량</span>
          <span className="font-mono font-bold text-slate-700">{Number(order.totalQuantity || 0).toLocaleString()} {order.unit}</span>
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
