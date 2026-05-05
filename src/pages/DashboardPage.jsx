import React, { useMemo } from 'react';
import {
  LayoutDashboard, AlertCircle, Clock, Calendar, TrendingUp,
  Package, ChevronRight, Zap,
} from 'lucide-react';
import { ORDER_STATUS_COLORS, BATCH_STATUS_COLORS, START_STAGES, PROCESS_TYPES, normalizeBatchStatus, normalizeDeliveryStatus } from '../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass } from '../utils/orderCalculations';
import { scanAllOrders, buildDailyBriefing } from '../utils/riskScanner';

export const DashboardPage = ({ orders = [], onOpenOrderDetail, setActiveTab }) => {
  // 통계
  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter(o => o.status === 'active').length;
    const risky = orders.filter(o => o.status === 'delayed_risk').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const onHold = orders.filter(o => o.status === 'on_hold').length;
    return { total, active, risky, completed, onHold };
  }, [orders]);

  // Risk Scanner 결과
  const riskOrders = useMemo(() => scanAllOrders(orders), [orders]);
  const top5 = riskOrders.slice(0, 5);

  // Daily Briefing
  const briefing = useMemo(() => buildDailyBriefing(orders), [orders]);

  const getProcessLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">대시보드</h2>
            <p className="text-xs text-slate-500 mt-0.5">{briefing.today} · 오늘의 생산 현황</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab && setActiveTab('orderList')}
          className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
        >
          전체 오더 보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="전체 오더" value={stats.total} colorClass="bg-slate-100 text-slate-700" />
        <StatCard label="진행중" value={stats.active} colorClass="bg-blue-100 text-blue-700" />
        <StatCard label="납기위험" value={stats.risky} colorClass="bg-red-100 text-red-700" emphasis={stats.risky > 0} />
        <StatCard label="보류" value={stats.onHold} colorClass="bg-amber-100 text-amber-700" />
        <StatCard label="완료" value={stats.completed} colorClass="bg-emerald-100 text-emerald-700" />
      </div>

      {/* 위험 오더 Top 5 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-extrabold text-slate-800">위험 오더 Top 5</h3>
          <span className="text-xs text-slate-500">자동 감지 ({riskOrders.length}건)</span>
        </div>
        {top5.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">감지된 위험 오더가 없습니다 ✨</div>
        ) : (
          <div className="space-y-2">
            {top5.map(({ order, risks, score, highCount }) => (
              <RiskOrderCard
                key={order.id}
                order={order}
                risks={risks}
                score={score}
                highCount={highCount}
                onClick={() => onOpenOrderDetail(order.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Daily Briefing — 3컬럼 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 오늘 진행 */}
        <BriefingColumn
          icon={Clock}
          title="오늘 챙길 차수"
          subtitle="진행중 또는 오늘 종료 예정"
          batches={briefing.todayBatches}
          colorClass="text-blue-700"
          bgClass="bg-blue-50 border-blue-200"
          getProcessLabel={getProcessLabel}
          onOpenOrderDetail={onOpenOrderDetail}
        />
        {/* 이번 주 시작 예정 */}
        <BriefingColumn
          icon={Calendar}
          title="이번 주 시작 예정"
          subtitle="D+1 ~ D+7 시작 예정 차수"
          batches={briefing.upcomingBatches}
          colorClass="text-teal-700"
          bgClass="bg-teal-50 border-teal-200"
          getProcessLabel={getProcessLabel}
          onOpenOrderDetail={onOpenOrderDetail}
        />
        {/* 문제 상태 */}
        <BriefingColumn
          icon={Zap}
          title="문제 상태 차수"
          subtitle="즉시 대응 필요"
          batches={briefing.issueBatches}
          colorClass="text-red-700"
          bgClass="bg-red-50 border-red-200"
          getProcessLabel={getProcessLabel}
          onOpenOrderDetail={onOpenOrderDetail}
        />
      </div>
    </div>
  );
};

// ============================================================
// 통계 카드
// ============================================================
const StatCard = ({ label, value, colorClass, emphasis }) => (
  <div className={`rounded-xl p-3 shadow-sm border ${
    emphasis ? 'bg-red-50 border-red-300 ring-2 ring-red-200' : 'bg-white border-slate-200'
  }`}>
    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</div>
    <div className={`text-2xl font-extrabold mt-1 ${colorClass.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
      {value}
    </div>
  </div>
);

// ============================================================
// 위험 오더 카드
// ============================================================
const RiskOrderCard = ({ order, risks, score, highCount, onClick }) => {
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border-2 border-red-200 rounded-lg p-3 hover:border-red-400 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-bold text-teal-700">{order.orderNumber}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
              {order.status === 'delayed_risk' ? '납기위험' : order.status === 'active' ? '진행중' : '-'}
            </span>
            <span className="text-[11px] text-slate-500">{order.customer}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px]">
              {highCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded font-bold">위험 {highCount}</span>
              )}
              <span className="font-mono font-bold text-red-600">위험도 {score}</span>
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 truncate mb-1">{order.articleNo || order.orderName || '-'}</div>

          {/* 위험 항목 리스트 */}
          <div className="space-y-0.5">
            {risks.slice(0, 3).map((r, idx) => (
              <div key={idx} className={`text-[11px] flex items-center gap-1 ${
                r.severity === 'high' ? 'text-red-700 font-bold' :
                r.severity === 'mid' ? 'text-amber-700' : 'text-slate-600'
              }`}>
                <AlertCircle className="w-3 h-3 shrink-0" />{r.message}
              </div>
            ))}
            {risks.length > 3 && (
              <div className="text-[11px] text-slate-400">+ {risks.length - 3}건 더</div>
            )}
          </div>

          {/* 납기 + 진행률 */}
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            <div className="text-slate-500">최종납기 <span className="font-mono font-bold text-slate-700">{order.finalDueDate || '-'}</span></div>
            <div className={healthColors.text}>예상 <span className="font-mono font-bold">{order.estimatedDueDate || '-'}</span></div>
            <div className="ml-auto flex items-center gap-1.5 w-32">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="font-mono font-bold text-slate-600">{progress}%</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

// ============================================================
// Briefing 컬럼 (오늘 / 이번 주 / 문제)
// ============================================================
const BriefingColumn = ({ icon: Icon, title, subtitle, batches, colorClass, bgClass, getProcessLabel, onOpenOrderDetail }) => (
  <section className={`border rounded-xl p-4 ${bgClass}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <h4 className={`text-sm font-extrabold ${colorClass}`}>{title}</h4>
      <span className="ml-auto px-1.5 py-0.5 bg-white text-slate-700 rounded text-[10px] font-bold">{batches.length}</span>
    </div>
    <p className="text-[11px] text-slate-500 mb-3">{subtitle}</p>

    {batches.length === 0 ? (
      <div className="text-center py-4 text-xs text-slate-400">없음</div>
    ) : (
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {batches.map(item => {
          const isDelivery = item.kind === 'delivery';
          const sKey = isDelivery
            ? normalizeDeliveryStatus(item.delivery.status)
            : normalizeBatchStatus(item.batch?.status);
          const sm = BATCH_STATUS_COLORS[sKey] || BATCH_STATUS_COLORS.pending;
          const sLabel = sKey === 'in_progress' ? '진행' : sKey === 'issue' ? '문제' : sKey === 'done' ? '완료' : '대기';

          const itemLabel = isDelivery
            ? `원사 ${item.yarnOrder?.yarnTypeName || '사종'} ${item.delivery.deliveryNumber}차`
            : `${getProcessLabel(item.process.processType)} ${item.batch.batchLabel || `${item.batch.batchNumber || ''}차`}`;
          const startStr = isDelivery ? '' : (item.batch.plannedStartDate ? `시작 ${item.batch.plannedStartDate}` : '');
          const endStr = isDelivery
            ? (item.delivery.plannedArrivalDate ? ` 입고예정 ${item.delivery.plannedArrivalDate}` : '')
            : (item.batch.plannedEndDate ? ` ~ ${item.batch.plannedEndDate}` : '');

          const itemKey = isDelivery
            ? `${item.order.id}-d-${item.delivery.id}`
            : `${item.order.id}-b-${item.batch.id}`;
          const focusType = item.process.processType;
          const focusId = isDelivery ? item.delivery.id : item.batch.id;

          return (
            <button
              key={itemKey}
              onClick={() => onOpenOrderDetail(item.order.id, focusType, focusId)}
              className="w-full text-left bg-white rounded p-2 hover:shadow-md hover:bg-slate-50 transition-all border border-slate-100"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-teal-700">{item.order.orderNumber}</span>
                <span className="text-[11px] text-slate-500">{itemLabel}</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold ${sm.bg} ${sm.text}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 ${sm.dot}`}></span>
                  {sLabel}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 truncate">{item.order.customer} · {item.order.articleNo || '-'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {item.type === 'ending' && (isDelivery ? '오늘 입고' : '오늘 종료')} {startStr}{endStr}
              </div>
            </button>
          );
        })}
      </div>
    )}
  </section>
);
