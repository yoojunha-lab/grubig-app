import React, { useState, useMemo } from 'react';
import { PackageCheck, Search, Plus, AlertCircle } from 'lucide-react';
import { DesktopOrderRow } from '../components/order/DesktopOrderRow';
import { MobileOrderCard } from '../components/order/MobileOrderCard';
import { ORDER_TYPES, ORDER_STATUSES } from '../constants/production';

export const OrderListPage = ({
  orders = [],
  onView,
  onDelete,
  setActiveTab,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

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
        // 납기 임박 순
        const da = a.finalDueDate || '9999-99-99';
        const db = b.finalDueDate || '9999-99-99';
        if (da !== db) return da.localeCompare(db);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [orders, search, typeFilter, statusFilter]);

  // 요약
  const summary = useMemo(() => {
    const total = orders.length;
    const active = orders.filter(o => o.status === 'active').length;
    const risky = orders.filter(o => o.status === 'delayed_risk').length;
    const onHold = orders.filter(o => o.status === 'on_hold').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    return { total, active, risky, onHold, completed };
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">오더 목록</h2>
            <p className="text-xs text-slate-500 mt-0.5">원단 생산 오더 전체 보기</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab && setActiveTab('orderWizard')}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> 새 오더 등록
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">전체</div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{summary.total}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">진행중</div>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{summary.active}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-red-600 font-bold uppercase tracking-wider">납기위험</div>
          <div className="text-xl font-extrabold text-red-700 mt-1">{summary.risky}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">보류</div>
          <div className="text-xl font-extrabold text-slate-700 mt-1">{summary.onHold}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">완료</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{summary.completed}</div>
        </div>
      </div>

      {/* 필터 */}
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

      {/* 목록 */}
      {filtered.length === 0 ? (
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
          {/* 데스크탑 테이블 */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">오더</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">고객</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">타입</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">염색</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">수량</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">최종납기</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">예상납기</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">상태</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">진행률</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-extrabold text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <DesktopOrderRow
                    key={order.id}
                    order={order}
                    onView={onView}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="md:hidden space-y-3">
            {filtered.map(order => (
              <MobileOrderCard
                key={order.id}
                order={order}
                onView={onView}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
