import React, { useMemo, useState } from 'react';
import { PackageCheck, Search, Plus, X } from 'lucide-react';
import { ProductionSheet } from '../components/order/sheet/ProductionSheet';
import { LotEditor } from '../components/order/sheet/LotEditor';
import { OrderDetailModal } from '../components/order/OrderDetailModal';
import { MobileOrderList } from '../components/order/MobileOrderList';
import { getDday } from '../utils/orderModel';
import { todayYmd } from '../utils/orderCalculations';

// ============================================================
// 생산 현황 (v8) — 엑셀형 현황표
// ------------------------------------------------------------
// - 오더 등록 화면 없이 표에서 바로 [+ 오더 추가] → order# 입력하면 저장
// - 칸을 누르면 바로 수정, 다른 칸으로 넘어가면 자동 저장 (저장 로직은 useOrder 훅)
// - 상세창 / 염가공 LOT 편집창은 이 페이지가 띄운다 (표·모바일·상세창 공용)
// ============================================================

const STATUS_TABS = [
  { key: 'open',      label: '진행 중', match: o => o.status !== 'completed' },
  { key: 'completed', label: '완료',    match: o => o.status === 'completed' },
  { key: 'all',       label: '전체',    match: () => true },
];

const SORTS = [
  { key: 'created', label: '등록순' },
  { key: 'due',     label: '납기순' },
  { key: 'number',  label: 'order#순' },
];

const uniq = (list) => [...new Set(list.map(v => String(v || '').trim()).filter(Boolean))];

// 검색 대상: order#·article#·detail·buyer·메모·컬러명·외주처
const searchText = (o) => [
  o.orderNumber, o.articleNo, o.detail, o.customer, o.notes, o.dyeVendor,
  ...(o.colors || []).map(c => c.name),
  ...Object.values(o.steps || {}).map(s => s?.vendor),
].filter(Boolean).join(' ').toLowerCase();

const sortOrders = (list, sortKey) => {
  const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    || String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true });
  const sorted = [...list];
  if (sortKey === 'due') {
    sorted.sort((a, b) => (a.finalDueDate || '9999-99-99').localeCompare(b.finalDueDate || '9999-99-99') || byCreated(a, b));
  } else if (sortKey === 'number') {
    sorted.sort((a, b) => String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true }));
  } else {
    sorted.sort(byCreated);
  }
  return sorted;
};

export const OrderListPage = ({
  orders = [],          // v8 정규화된 저장 오더
  drafts = [],          // order# 입력 전 새 줄
  actions,              // useOrder().orderActions
  masters = {},         // { knittingFactories, dyeingFactories, yarnSuppliers }
  savedFabrics = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner,
}) => {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('open');
  const [sortKey, setSortKey] = useState('created');
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [lotTarget, setLotTarget] = useState(null);          // { orderId, colorId, rect }
  const [pendingFocusOrderId, setPendingFocusOrderId] = useState(null);

  // ---------- 필터 / 정렬 ----------
  const counts = useMemo(() => Object.fromEntries(
    STATUS_TABS.map(t => [t.key, orders.filter(t.match).length])
  ), [orders]);

  const visibleOrders = useMemo(() => {
    const tab = STATUS_TABS.find(t => t.key === statusTab) || STATUS_TABS[0];
    const term = search.trim().toLowerCase();
    const list = orders.filter(o => tab.match(o) && (!term || searchText(o).includes(term)));
    return sortOrders(list, sortKey);
  }, [orders, statusTab, search, sortKey]);

  // 상단 요약: 진행/보류/납기 임박/지남 (완료 제외)
  const stats = useMemo(() => {
    let active = 0, onHold = 0, dueSoon = 0, overdue = 0;
    orders.forEach(o => {
      if (o.status === 'completed') return;
      if (o.status === 'on_hold') onHold += 1; else active += 1;
      const d = getDday(o.finalDueDate);
      if (d === null) return;
      if (d < 0) overdue += 1;
      else if (d <= 7) dueSoon += 1;
    });
    return { active, onHold, dueSoon, overdue };
  }, [orders]);

  // ---------- 외주처 자동완성 (마스터 + 다른 오더에서 쓴 값) ----------
  const dyeVendorOptions = useMemo(
    () => uniq([...(masters.dyeingFactories || []), ...orders.map(o => o.dyeVendor)]),
    [masters.dyeingFactories, orders]
  );

  // ---------- 오더 추가 ----------
  // 새 줄이 필터에 가려지지 않도록 검색어를 비우고 '진행 중' 탭으로 전환
  const revealNewRow = () => {
    setSearch('');
    if (statusTab === 'completed') setStatusTab('open');
  };
  const handleAddDesktop = () => {
    revealNewRow();
    setPendingFocusOrderId(actions.addDraftOrder());
  };
  const handleAddMobile = () => {
    revealNewRow();
    setDetailOrderId(actions.addDraftOrder());
  };
  // 표 안의 [+ 오더 추가] · [첫 오더 추가] 버튼도 같은 규칙 적용
  // (order# 입력으로 저장되는 순간 검색어/완료 탭 필터에 걸려 줄이 사라지지 않도록)
  const sheetActions = {
    ...actions,
    addDraftOrder: () => {
      revealNewRow();
      return actions.addDraftOrder();
    },
  };

  // ---------- 상세창 / LOT 편집 대상 ----------
  const findAny = (id) => orders.find(o => o.id === id) || drafts.find(d => d.id === id) || null;
  const detailOrder = detailOrderId ? findAny(detailOrderId) : null;
  const detailIsDraft = !!detailOrder && drafts.some(d => d.id === detailOrder.id);

  const lotOrder = lotTarget ? findAny(lotTarget.orderId) : null;
  const lotColor = lotOrder ? (lotOrder.colors || []).find(c => c.id === lotTarget.colorId) : null;

  const openLots = (orderId, colorId, rect = null) => setLotTarget({ orderId, colorId, rect });

  const partnerProps = { partners, savePartner, deletePartner, makeEmptyPartner };

  return (
    <div className="max-w-[1900px] mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">생산 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {todayYmd()} · 칸을 누르면 바로 수정되고, 다른 칸으로 넘어가면 자동 저장돼요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatChip label="진행" value={stats.active} cls="bg-blue-50 text-blue-700 border-blue-200" />
          <StatChip label="보류" value={stats.onHold} cls="bg-slate-50 text-slate-600 border-slate-200" />
          <StatChip label="7일 내 납기" value={stats.dueSoon} cls="bg-orange-50 text-orange-700 border-orange-200" />
          <StatChip label="납기 지남" value={stats.overdue} cls={stats.overdue > 0 ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-500 border-slate-200'} />
        </div>
      </div>

      {/* 툴바: 검색 / 상태 탭 / 정렬 / 오더 추가 */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="order# · article# · detail · buyer · 컬러 · 외주처 검색"
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600" title="검색어 지우기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  statusTab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label} <span className="font-mono text-[10px] opacity-70">{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
            title="정렬"
          >
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            onClick={handleAddDesktop}
            className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> 오더 추가
          </button>
        </div>
      </div>

      {/* 본문: 데스크탑 = 엑셀형 현황표 */}
      <div className="hidden md:block">
        <ProductionSheet
          orders={visibleOrders}
          allOrders={orders}
          drafts={drafts}
          actions={sheetActions}
          masters={masters}
          savedFabrics={savedFabrics}
          {...partnerProps}
          onOpenDetail={setDetailOrderId}
          onOpenLots={openLots}
          pendingFocusOrderId={pendingFocusOrderId}
          onPendingFocusDone={() => setPendingFocusOrderId(null)}
        />
        {search && visibleOrders.length === 0 && orders.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-3">'{search}' 검색 결과가 없어요.</p>
        )}
      </div>

      {/* 본문: 모바일 = 카드 목록 → 상세창에서 수정 */}
      <div className="md:hidden">
        <MobileOrderList
          orders={visibleOrders}
          drafts={drafts}
          onOpen={setDetailOrderId}
          onAdd={handleAddMobile}
        />
      </div>

      {/* 오더 상세창 (모바일 편집 겸용) */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          isDraft={detailIsDraft}
          onClose={() => setDetailOrderId(null)}
          actions={actions}
          masters={masters}
          savedFabrics={savedFabrics}
          {...partnerProps}
          onOpenLots={openLots}
        />
      )}

      {/* 염가공 LOT 편집 */}
      {lotOrder && lotColor && (
        <LotEditor
          key={`${lotOrder.id}_${lotColor.id}`}
          order={lotOrder}
          color={lotColor}
          anchorRect={lotTarget.rect}
          onClose={() => setLotTarget(null)}
          onSaveLots={(lots) => actions.setLots(lotOrder.id, lotColor.id, lots)}
          onSaveDyeVendor={(vendor) => actions.setOrderField(lotOrder.id, 'dyeVendor', vendor)}
          dyeVendorOptions={dyeVendorOptions}
        />
      )}
    </div>
  );
};

const StatChip = ({ label, value, cls }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${cls}`}>
    <span>{label}</span>
    <span className="font-mono text-sm">{value}</span>
  </div>
);
