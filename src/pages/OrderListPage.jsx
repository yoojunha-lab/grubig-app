import React, { useState, useMemo } from 'react';
import {
  PackageCheck, Search, Plus, AlertCircle, List, LayoutGrid, BarChart3,
  Clock, Calendar, Zap, Flame, Hourglass, LayoutDashboard, Info,
} from 'lucide-react';
import { MobileOrderCard } from '../components/order/MobileOrderCard';
import { ProductionMatrixTable } from '../components/order/list/ProductionMatrixTable';
import {
  ORDER_TYPES, ORDER_STATUSES, ORDER_STATUS_COLORS, BATCH_STATUS_COLORS,
  PROCESS_TYPES, normalizeBatchStatus, normalizeDeliveryStatus,
} from '../constants/production';
import {
  calcOrderProgress, getOrderHealth, getHealthColorClass, collectUrgentProcesses,
} from '../utils/orderCalculations';
import { scanAllOrders, buildDailyBriefing } from '../utils/riskScanner';
import { KanbanView } from './OrderKanbanPage';
import { GanttView } from './OrderGanttPage';

const VIEW_MODES = [
  { key: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { key: 'list',      label: '목록',     icon: List },
  { key: 'kanban',    label: '칸반',     icon: LayoutGrid },
  { key: 'gantt',     label: '간트',     icon: BarChart3 },
];

export const OrderListPage = ({
  orders = [],
  onView,
  onDelete,
  onOpenOrderDetail,
  onSaveBatch,           // (orderId, processType, batchId, draftBatch) — 인라인 수정 저장
  onSaveYarnDelivery,    // (orderId, yarnOrderId, deliveryId, draftDelivery)
  setActiveTab,
}) => {
  const [viewMode, setViewMode] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const toggleExpand = (orderId) => setExpandedOrderId(prev => prev === orderId ? null : orderId);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (orders || [])
      .filter(o => {
        if (typeFilter !== 'All' && o.type !== typeFilter) return false;
        if (statusFilter !== 'All' && o.status !== statusFilter) return false;
        if (!term) return true;
        return (
          String(o.orderNumber || '').toLowerCase().includes(term) ||
          String(o.orderName || '').toLowerCase().includes(term) ||
          String(o.customer || '').toLowerCase().includes(term) ||
          String(o.brand || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const da = a.finalDueDate || '9999-99-99';
        const db = b.finalDueDate || '9999-99-99';
        if (da !== db) return da.localeCompare(db);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [orders, search, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = orders.length;
    const active = orders.filter(o => o.status === 'active').length;
    const risky = orders.filter(o => o.status === 'delayed_risk').length;
    const onHold = orders.filter(o => o.status === 'on_hold').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    return { total, active, risky, onHold, completed };
  }, [orders]);

  // ─── 대시보드 데이터 ───
  const riskOrders = useMemo(() => scanAllOrders(orders), [orders]);
  const top5 = riskOrders.slice(0, 5);
  const briefing = useMemo(() => buildDailyBriefing(orders), [orders]);
  const urgentProcesses = useMemo(() => collectUrgentProcesses(orders, 7), [orders]);
  const urgentOverdue = urgentProcesses.filter(x => x.urgency === 'overdue');
  const urgentImminent = urgentProcesses.filter(x => x.urgency === 'urgent');
  const getProcessLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;

  // 칸반/간트 카드 클릭 시: onOpenOrderDetail 우선, 없으면 onView 폴백
  // (orderId, processType?, batchId?) — batch 정보가 있으면 모달이 해당 차수 펼침/스크롤/하이라이트
  const handleOpenDetail = (orderId, processType = null, batchId = null) => {
    if (onOpenOrderDetail) {
      onOpenOrderDetail(orderId, processType, batchId);
    } else if (onView) {
      const o = orders.find(x => x.id === orderId);
      if (o) onView(o);
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">생산 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">{briefing.today} · 대시보드 · 목록 · 칸반 · 간트</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab && setActiveTab('orderWizard')}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> 새 오더 등록
        </button>
      </div>

      {/* 뷰 전환 토글 (대시보드 / 목록 / 칸반 / 간트) */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 mb-4 shadow-sm flex gap-1 max-w-2xl">
        {VIEW_MODES.map(v => {
          const Icon = v.icon;
          const selected = viewMode === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                selected
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* ─── 본문: 대시보드 뷰 ─── */}
      {viewMode === 'dashboard' && (
        <div className="space-y-5">
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="전체 오더" value={summary.total} textClass="text-slate-700" />
            <StatCard label="진행중" value={summary.active} textClass="text-blue-700" bgClass="bg-blue-50 border-blue-200" />
            <StatCard label="납기위험" value={summary.risky} textClass="text-red-700" bgClass="bg-red-50 border-red-200" emphasis={summary.risky > 0} />
            <StatCard label="보류" value={summary.onHold} textClass="text-amber-700" bgClass="bg-amber-50 border-amber-200" />
            <StatCard label="완료" value={summary.completed} textClass="text-emerald-700" bgClass="bg-emerald-50 border-emerald-200" />
          </div>

          {/* 공정 마감 임박/지연 알림 */}
          {urgentProcesses.length > 0 && (
            <section className={`border rounded-xl p-5 shadow-sm ${urgentOverdue.length > 0 ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-100' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Flame className={`w-5 h-5 ${urgentOverdue.length > 0 ? 'text-rose-600' : 'text-orange-600'}`} />
                <h3 className="text-base font-extrabold text-slate-800">공정 마감 임박/지연</h3>
                <div className="flex items-center gap-1.5 ml-1">
                  {urgentOverdue.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-600 text-white rounded shadow-sm flex items-center gap-1">
                      <Flame className="w-3 h-3"/>지연 {urgentOverdue.length}
                    </span>
                  )}
                  {urgentImminent.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-orange-500 text-white rounded shadow-sm flex items-center gap-1">
                      <Hourglass className="w-3 h-3"/>임박 {urgentImminent.length}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-[11px] text-slate-500">D-7 이내 미완료 공정</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {urgentProcesses.slice(0, 12).map((u, idx) => {
                  const dnBadge = (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${
                      u.urgency === 'overdue'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : u.days === 0 ? 'bg-rose-500 text-white'
                        : 'bg-orange-100 text-orange-700 border border-orange-300'
                    }`}>
                      {u.days < 0 ? `D+${-u.days} 지연!` : u.days === 0 ? 'Today' : `D-${u.days}`}
                    </span>
                  );
                  return (
                    <button
                      key={`${u.orderId}-${u.processType}-${idx}`}
                      onClick={() => handleOpenDetail(u.orderId, u.processType)}
                      className={`text-left bg-white rounded-lg p-2.5 border transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        u.urgency === 'overdue'
                          ? 'border-rose-300 hover:border-rose-400'
                          : 'border-orange-200 hover:border-orange-400'
                      }`}
                    >
                      <CardHeader
                        orderNumber={u.orderNumber}
                        articleNo={u.articleNo}
                        customer={u.customer}
                        rightBadge={dnBadge}
                      />
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{u.processLabel}</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-2.5 h-2.5"/>
                          마감 <span className="font-mono font-bold text-slate-700">{u.effectiveEnd}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {urgentProcesses.length > 12 && (
                <div className="text-[11px] text-slate-500 text-center mt-2">+ {urgentProcesses.length - 12}건 더 (목록 뷰에서 확인)</div>
              )}
            </section>
          )}

          {/* 위험 오더 Top 5 */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
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
                    onClick={() => handleOpenDetail(order.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Daily Briefing — 3컬럼 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BriefingColumn
              icon={Clock}
              title="오늘 챙길 차수"
              subtitle="진행중 또는 오늘 종료 예정"
              description={[
                '오늘 종료 예정이거나 현재 진행중인 차수',
                '• 종료일(실제→예상→계획)이 오늘인 미완료 차수',
                '• 상태가 "진행중"인 미완료 차수',
                '• 원사: 오늘 입고예정 또는 운송/입고대기 중',
                '(완료/보류 오더 제외, 최대 20건)',
              ]}
              batches={briefing.todayBatches}
              colorClass="text-blue-700"
              bgClass="bg-blue-50 border-blue-200"
              getProcessLabel={getProcessLabel}
              onOpenOrderDetail={handleOpenDetail}
            />
            <BriefingColumn
              icon={Calendar}
              title="이번 주 시작 예정"
              subtitle="D+1 ~ D+7 시작 예정 차수"
              description={[
                '내일부터 7일 안에 시작 예정인 미시작 차수',
                '• 계획 시작일이 D+1 ~ D+7 사이',
                '• 아직 실제 시작 기록 없음',
                '• 원사: 계획 입고일 기준',
                '(완료/보류 오더 제외, 시작일순 정렬, 최대 20건)',
              ]}
              batches={briefing.upcomingBatches}
              colorClass="text-teal-700"
              bgClass="bg-teal-50 border-teal-200"
              getProcessLabel={getProcessLabel}
              onOpenOrderDetail={handleOpenDetail}
            />
            <BriefingColumn
              icon={Zap}
              title="문제 상태 차수"
              subtitle="즉시 대응 필요"
              description={[
                '이슈 상태로 분류된 차수',
                '• 보류 / Fail / 재진행중 / 재가공중',
                '• 재컨펌중 / 재test중 등',
                '• 원사: 보류 상태',
                '(완료/보류 오더 제외, 최대 20건)',
              ]}
              batches={briefing.issueBatches}
              colorClass="text-red-700"
              bgClass="bg-red-50 border-red-200"
              getProcessLabel={getProcessLabel}
              onOpenOrderDetail={handleOpenDetail}
            />
          </div>
        </div>
      )}

      {/* 필터 (목록 뷰에서만) */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="오더번호/오더명/고객/브랜드 검색"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="All">타입: 전체</option>
                {ORDER_TYPES.map(t => (
                  <option key={t.key} value={t.key}>타입: {t.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="All">상태: 전체</option>
                {ORDER_STATUSES.map(s => (
                  <option key={s.key} value={s.key}>상태: {s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ─── 본문: 뷰 분기 ─── */}
      {viewMode === 'list' && (
        filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {orders.length === 0 ? '등록된 오더가 없습니다.' : '검색 결과가 없습니다.'}
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => setActiveTab && setActiveTab('orderWizard')}
                className="inline-flex items-center gap-2 mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-teal-700"
              >
                <Plus className="w-4 h-4" /> 첫 오더 등록
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 데스크탑 — 새 ERP 스타일 매트릭스 테이블 */}
            <div className="hidden md:block">
              <ProductionMatrixTable
                orders={filtered}
                onOpenOrderDetail={handleOpenDetail}
                onSaveBatch={onSaveBatch}
                onSaveYarnDelivery={onSaveYarnDelivery}
              />
            </div>

            {/* 모바일 카드 — 기존 유지 */}
            <div className="md:hidden space-y-3">
              {filtered.map(order => (
                <MobileOrderCard
                  key={order.id}
                  order={order}
                  onView={onView}
                  onDelete={onDelete}
                  onOpenBatch={(processType, batchId) => handleOpenDetail(order.id, processType, batchId)}
                  expanded={expandedOrderId === order.id}
                  onToggleExpand={() => toggleExpand(order.id)}
                  onSaveBatch={onSaveBatch}
                  onSaveYarnDelivery={onSaveYarnDelivery}
                />
              ))}
            </div>
          </>
        )
      )}

      {viewMode === 'kanban' && (
        <KanbanView orders={orders} onOpenOrderDetail={handleOpenDetail} />
      )}

      {viewMode === 'gantt' && (
        <GanttView orders={orders} onOpenOrderDetail={handleOpenDetail} />
      )}
    </div>
  );
};

// ============================================================
// 통계 카드 (대시보드 헤더)
// ============================================================
const StatCard = ({ label, value, textClass, bgClass = 'bg-white border-slate-200', emphasis }) => (
  <div className={`rounded-xl p-3 shadow-sm border ${
    emphasis ? 'bg-red-50 border-red-300 ring-2 ring-red-200' : bgClass
  }`}>
    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</div>
    <div className={`text-2xl font-extrabold mt-1 ${textClass}`}>{value}</div>
  </div>
);

// ============================================================
// 공통 카드 헤더: [오더번호] · [Article] · [업체] + 우측 뱃지
// ============================================================
const CardHeader = ({ orderNumber, articleNo, customer, rightBadge }) => (
  <div className="flex items-center justify-between gap-2 mb-1">
    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
      <span className="font-mono text-[11px] font-extrabold text-teal-700 shrink-0">{orderNumber || '-'}</span>
      {articleNo && (
        <>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-[11px] font-bold text-slate-700 truncate">{articleNo}</span>
        </>
      )}
      {customer && (
        <>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-600 truncate">{customer}</span>
        </>
      )}
    </div>
    {rightBadge && <div className="shrink-0">{rightBadge}</div>}
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

  const rightBadge = (
    <div className="flex items-center gap-1.5">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
        {order.status === 'delayed_risk' ? '납기위험' : order.status === 'active' ? '진행중' : '-'}
      </span>
      {highCount > 0 && (
        <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">위험 {highCount}</span>
      )}
      <span className="font-mono font-bold text-red-600 text-[11px]">위험도 {score}</span>
    </div>
  );

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border-2 border-red-200 rounded-lg p-3 hover:border-red-400 hover:shadow-md transition-all"
    >
      <CardHeader
        orderNumber={order.orderNumber}
        articleNo={order.articleNo || order.orderName}
        customer={order.customer}
        rightBadge={rightBadge}
      />

      <div className="space-y-0.5 mt-1">
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
    </button>
  );
};

// ============================================================
// Briefing 컬럼 (오늘 / 이번 주 / 문제)
// ============================================================
const BriefingColumn = ({ icon: Icon, title, subtitle, description, batches, colorClass, bgClass, getProcessLabel, onOpenOrderDetail }) => (
  <section className={`border rounded-xl p-4 ${bgClass}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <h4 className={`text-sm font-extrabold ${colorClass}`}>{title}</h4>
      {description && (
        <div className="relative group">
          <Info className={`w-3.5 h-3.5 ${colorClass} opacity-60 hover:opacity-100 cursor-help`} />
          <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-5 z-50 w-64 bg-slate-900 text-white text-[11px] rounded-lg shadow-2xl p-3 pointer-events-none">
            <div className="font-extrabold text-[12px] mb-1.5 text-white">{title} — 표시 기준</div>
            {description.map((line, i) => (
              <div key={i} className={`leading-relaxed ${i === 0 ? 'font-bold mb-1' : i === description.length - 1 ? 'mt-1 text-slate-400 text-[10px]' : 'text-slate-200'}`}>
                {line}
              </div>
            ))}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"></div>
          </div>
        </div>
      )}
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

          const statusBadge = (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${sm.bg} ${sm.text}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 ${sm.dot}`}></span>
              {sLabel}
            </span>
          );
          return (
            <button
              key={itemKey}
              onClick={() => onOpenOrderDetail(item.order.id, focusType, focusId)}
              className="w-full text-left bg-white rounded p-2 hover:shadow-md hover:bg-slate-50 transition-all border border-slate-100"
            >
              <CardHeader
                orderNumber={item.order.orderNumber}
                articleNo={item.order.articleNo}
                customer={item.order.customer}
                rightBadge={statusBadge}
              />
              <div className="text-[11px] text-slate-600 truncate">{itemLabel}</div>
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
