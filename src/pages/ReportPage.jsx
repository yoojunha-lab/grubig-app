import React, { useMemo } from 'react';
import { TrendingUp, Calendar, Users, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { ORDER_STATUSES, ORDER_STATUS_COLORS, PROCESS_TYPES } from '../constants/production';
import { diffDaysYmd } from '../utils/orderCalculations';

// 1차 통계 페이지 (Tailwind 자체 막대 차트)
export const ReportPage = ({ orders = [] }) => {
  // 1. 납기 준수율
  const dueCompliance = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed');
    if (completed.length === 0) return { rate: null, total: 0, met: 0 };
    const met = completed.filter(o => {
      // 마지막 차수 actualEndDate vs finalDueDate
      const allBatches = (o.processes || []).filter(p => p.isActive).flatMap(p => p.batches || []);
      const latestActual = allBatches.map(b => b.actualEndDate).filter(Boolean).sort().pop();
      if (!latestActual || !o.finalDueDate) return false;
      return latestActual <= o.finalDueDate;
    }).length;
    return { rate: Math.round((met / completed.length) * 100), total: completed.length, met };
  }, [orders]);

  // 2. 상태별 분포
  const statusDist = useMemo(() => {
    const dist = {};
    ORDER_STATUSES.forEach(s => { dist[s.key] = 0; });
    orders.forEach(o => {
      if (dist[o.status] !== undefined) dist[o.status]++;
    });
    return ORDER_STATUSES.map(s => ({ ...s, count: dist[s.key] }));
  }, [orders]);

  // 3. 거래처별 오더 수
  const customerStats = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      if (!o.customer) return;
      if (!map.has(o.customer)) map.set(o.customer, { customer: o.customer, total: 0, active: 0, completed: 0 });
      const e = map.get(o.customer);
      e.total++;
      if (o.status === 'active' || o.status === 'delayed_risk') e.active++;
      if (o.status === 'completed') e.completed++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [orders]);

  // 4. 월별 등록/완료 (최근 6개월)
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getFullYear()}.${d.getMonth() + 1}`,
        registered: 0,
        completed: 0,
      });
    }
    orders.forEach(o => {
      // 등록월
      if (o.createdAt) {
        const ym = o.createdAt.slice(0, 7);
        const m = months.find(x => x.key === ym);
        if (m) m.registered++;
      }
      // 완료월: 최신 actualEndDate 기준 (간단)
      if (o.status === 'completed') {
        const allBatches = (o.processes || []).flatMap(p => p.batches || []);
        const lastActual = allBatches.map(b => b.actualEndDate).filter(Boolean).sort().pop();
        if (lastActual) {
          const ym = lastActual.slice(0, 7);
          const m = months.find(x => x.key === ym);
          if (m) m.completed++;
        }
      }
    });
    return months;
  }, [orders]);

  const monthMax = Math.max(1, ...monthlyStats.map(m => Math.max(m.registered, m.completed)));

  // 5. 공정별 평균 소요일 (계획 vs 실제)
  const processStats = useMemo(() => {
    const result = {};
    PROCESS_TYPES.forEach(p => {
      result[p.key] = { label: p.label, plannedDays: [], actualDays: [] };
    });
    orders.forEach(o => {
      (o.processes || []).filter(p => p.isActive).forEach(p => {
        (p.batches || []).forEach(b => {
          if (b.plannedStartDate && b.plannedEndDate) {
            result[p.processType]?.plannedDays.push(diffDaysYmd(b.plannedStartDate, b.plannedEndDate));
          }
          if (b.actualStartDate && b.actualEndDate) {
            result[p.processType]?.actualDays.push(diffDaysYmd(b.actualStartDate, b.actualEndDate));
          }
        });
      });
    });
    return Object.entries(result).map(([key, v]) => {
      const avg = (arr) => arr.length === 0 ? null : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
      return {
        key,
        label: v.label,
        plannedAvg: avg(v.plannedDays),
        actualAvg: avg(v.actualDays),
        plannedCount: v.plannedDays.length,
        actualCount: v.actualDays.length,
      };
    }).filter(p => p.plannedCount > 0 || p.actualCount > 0);
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">리포트</h2>
          <p className="text-xs text-slate-500 mt-0.5">생산 통계 1차 (운영 데이터 누적 후 풍부해집니다)</p>
        </div>
      </div>

      {/* 1행: 납기 준수율 + 상태별 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard icon={CheckCircle} title="납기 준수율" subtitle="완료된 오더 기준">
          {dueCompliance.rate === null ? (
            <div className="text-center py-6 text-sm text-slate-400">완료된 오더가 아직 없습니다</div>
          ) : (
            <div className="text-center py-2">
              <div className="text-5xl font-extrabold text-emerald-600">{dueCompliance.rate}%</div>
              <div className="text-xs text-slate-500 mt-1">
                완료 {dueCompliance.total}건 중 {dueCompliance.met}건 준수
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Package} title="상태별 분포">
          {orders.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">데이터 없음</div>
          ) : (
            <div className="space-y-2">
              {statusDist.map(s => {
                const pct = orders.length === 0 ? 0 : Math.round((s.count / orders.length) * 100);
                const c = ORDER_STATUS_COLORS[s.key];
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-bold text-slate-700">{s.label}</span>
                      <span className="text-slate-500">{s.count}건 ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${c.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 2행: 거래처별 + 월별 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard icon={Users} title="거래처별 오더 수" subtitle={`${customerStats.length}개 거래처`}>
          {customerStats.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">데이터 없음</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase">거래처</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">전체</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">진행중</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">완료</th>
                </tr>
              </thead>
              <tbody>
                {customerStats.map(c => (
                  <tr key={c.customer} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-bold text-slate-700">{c.customer}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.total}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-blue-700">{c.active}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{c.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard icon={Calendar} title="월별 등록 / 완료" subtitle="최근 6개월">
          <div className="space-y-2">
            {monthlyStats.map(m => (
              <div key={m.key}>
                <div className="flex items-center gap-2 text-xs mb-0.5">
                  <span className="font-bold text-slate-700 w-16">{m.label}</span>
                  <span className="text-slate-400">등록 {m.registered} · 완료 {m.completed}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-blue-700 w-10">등록</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(m.registered / monthMax) * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-emerald-700 w-10">완료</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(m.completed / monthMax) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 3행: 공정별 평균 소요일 */}
      <SectionCard icon={AlertCircle} title="공정별 평균 소요일" subtitle="계획 vs 실제 (활성 차수 기준)">
        {processStats.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">차수 데이터 없음</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase">공정</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">계획 평균(일)</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">실제 평균(일)</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">차이</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase">표본</th>
              </tr>
            </thead>
            <tbody>
              {processStats.map(p => {
                const diff = (p.actualAvg !== null && p.plannedAvg !== null) ? p.actualAvg - p.plannedAvg : null;
                return (
                  <tr key={p.key} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-bold text-slate-700">{p.label}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{p.plannedAvg ?? '-'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{p.actualAvg ?? '-'}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${
                      diff === null ? 'text-slate-400' : diff > 0 ? 'text-red-700' : diff < 0 ? 'text-blue-700' : 'text-slate-500'
                    }`}>
                      {diff === null ? '-' : (diff > 0 ? `+${diff}` : diff)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-400">계획 {p.plannedCount} / 실제 {p.actualCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
};

// ============================================================
// 섹션 카드
// ============================================================
const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
  <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
      <Icon className="w-4 h-4 text-teal-600" />
      <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
      {subtitle && <span className="text-[11px] text-slate-500">{subtitle}</span>}
    </div>
    {children}
  </section>
);
