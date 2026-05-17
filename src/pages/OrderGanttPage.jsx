import React from 'react';
import { BarChart3 } from 'lucide-react';
import { MultiOrderGanttChart } from '../components/order/gantt/MultiOrderGanttChart';

// ============================================================
// GanttView — 모든 오더를 하나의 공정 행렬에 평면화하여 표시
// (OrderListPage의 viewMode === 'gantt' 에서 호출)
// ============================================================
export const GanttView = ({ orders = [], onOpenOrderDetail }) => {
  return (
    <MultiOrderGanttChart
      orders={orders}
      onOrderClick={(orderId, processType, batchId) =>
        onOpenOrderDetail && onOpenOrderDetail(orderId, processType, batchId)
      }
    />
  );
};

// ============================================================
// OrderGanttPage — 헤더 포함 풀 페이지 (단독 라우트 호환용)
// ============================================================
export const OrderGanttPage = ({ orders = [], onOpenOrderDetail }) => {
  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">간트 차트</h2>
            <p className="text-xs text-slate-500 mt-0.5">모든 오더 통합 일정</p>
          </div>
        </div>
      </div>
      <GanttView orders={orders} onOpenOrderDetail={onOpenOrderDetail} />
    </div>
  );
};
