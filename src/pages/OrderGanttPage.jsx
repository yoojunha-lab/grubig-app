import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Calendar, Layers, GitBranch } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { GanttChart } from '../components/order/gantt/GanttChart';
import { MultiOrderGanttChart } from '../components/order/gantt/MultiOrderGanttChart';
import { ORDER_STATUSES, ORDER_STATUS_COLORS, START_STAGES } from '../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass } from '../utils/orderCalculations';

const GANTT_MODES = [
  { key: 'single', label: '오더별 상세', icon: GitBranch },
  { key: 'multi',  label: '전체 오더',   icon: Layers },
];

// ============================================================
// GanttView — 오더별 상세 / 전체 오더 토글
// ============================================================
export const GanttView = ({ orders = [], onOpenOrderDetail }) => {
  const [mode, setMode] = useState('single');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // 첫 진입 시 자동으로 첫 진행중 오더 선택
  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      const firstActive = orders.find(o => o.status === 'active') || orders[0];
      if (firstActive) setSelectedOrderId(firstActive.id);
    }
  }, [orders, selectedOrderId]);

  // 선택된 오더가 필터로 사라졌으면 초기화
  useEffect(() => {
    if (selectedOrderId && !orders.find(o => o.id === selectedOrderId)) {
      setSelectedOrderId('');
    }
  }, [orders, selectedOrderId]);

  const orderOptions = useMemo(() => {
    return orders
      .slice()
      .sort((a, b) => (a.finalDueDate || '9999').localeCompare(b.finalDueDate || '9999'))
      .map(o => ({
        id: o.id,
        name: `${o.orderNumber} — ${o.customer || '-'}${o.articleNo ? ` / ${o.articleNo}` : ''}`,
      }));
  }, [orders]);

  const order = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  return (
    <div>
      {/* 모드 토글 */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 mb-4 shadow-sm flex gap-1 max-w-md">
        {GANTT_MODES.map(m => {
          const Icon = m.icon;
          const selected = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                selected
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === 'single' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <label className="text-xs font-bold text-slate-600">오더 선택</label>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-4 text-sm text-slate-400">표시할 오더가 없습니다.</div>
            ) : (
              <SearchableSelect
                value={selectedOrderId}
                options={orderOptions}
                onChange={setSelectedOrderId}
                placeholder="오더 검색·선택..."
              />
            )}
          </div>

          {order && (
            <>
              <OrderSummaryHeader order={order} onOpenDetail={() => onOpenOrderDetail && onOpenOrderDetail(order.id)} />
              <GanttChart
                order={order}
                onBatchClick={(processType, batchId) =>
                  onOpenOrderDetail && onOpenOrderDetail(order.id, processType, batchId)
                }
              />
            </>
          )}
        </>
      )}

      {mode === 'multi' && (
        <MultiOrderGanttChart
          orders={orders}
          onOrderClick={(orderId, processType, batchId) =>
            onOpenOrderDetail && onOpenOrderDetail(orderId, processType, batchId)
          }
        />
      )}
    </div>
  );
};

// ============================================================
// OrderGanttPage — 헤더 포함 풀 페이지 (단독 라우트용, 호환 유지)
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
            <p className="text-xs text-slate-500 mt-0.5">오더별 공정 일정 시각화 (1차 버전)</p>
          </div>
        </div>
      </div>
      <GanttView orders={orders} onOpenOrderDetail={onOpenOrderDetail} />
    </div>
  );
};

// 선택된 오더 요약 (간트 위)
const OrderSummaryHeader = ({ order, onOpenDetail }) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);
  const stageLabel = START_STAGES.find(s => s.key === order.startStage)?.label || '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="font-mono font-bold text-sm text-teal-700">{order.orderNumber}</span>
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
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
          {ORDER_STATUSES.find(s => s.key === order.status)?.label || '-'}
        </span>
        <span className="text-sm font-bold text-slate-800 truncate">{order.articleNo || order.orderName || '-'}</span>
        <span className="text-xs text-slate-500">/ {order.customer}</span>
        <button
          onClick={onOpenDetail}
          className="ml-auto text-xs font-bold text-teal-700 hover:text-teal-900"
        >
          상세 보기 →
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">수량</div>
          <div className="font-mono font-bold text-slate-700">
            {Number(order.quantityYd ?? order.totalQuantity ?? 0).toLocaleString()} YD
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">최종 납기</div>
          <div className="font-mono font-bold text-slate-700">{order.finalDueDate || '-'}</div>
        </div>
        <div>
          <div className={`text-[10px] font-bold uppercase ${healthColors.text}`}>예상 납기</div>
          <div className={`font-mono font-bold ${healthColors.text}`}>{order.estimatedDueDate || '-'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">진행률</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
