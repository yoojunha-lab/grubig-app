import React from 'react';
import { Trash2, Eye } from 'lucide-react';
import { ORDER_STATUS_COLORS } from '../../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass } from '../../utils/orderCalculations';

export const DesktopOrderRow = ({ order, onView, onDelete }) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);

  const activeProcessCount = (order.processes || []).filter(p => p.isActive).length;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-3 py-3">
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-teal-700">{order.orderNumber}</span>
          <span className="text-xs text-slate-500 truncate max-w-[180px]">{order.orderName}</span>
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
        <span className={`text-[11px] font-bold ${
          order.dyeingMethod === 'yarn_dyed' ? 'text-violet-700' : 'text-slate-600'
        }`}>
          {order.dyeingMethod === 'yarn_dyed' ? '선염' : '후염'}
        </span>
      </td>
      <td className="px-3 py-3 text-right font-mono text-xs">
        {Number(order.totalQuantity || 0).toLocaleString()} {order.unit}
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
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-[11px] text-slate-500 font-mono w-8 text-right">{progress}%</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">활성 공정 {activeProcessCount}개</div>
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
  );
};
