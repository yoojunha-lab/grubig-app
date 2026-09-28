import React, { useMemo } from 'react';
import { TrendingUp, Calendar, Users, Package, CheckCircle, AlertCircle, Truck, Layers } from 'lucide-react';
import { ORDER_STATUSES, ORDER_STATUS_COLORS, ORDER_STEPS, DYEING_STEP } from '../constants/production';
import { normalizeOrder, getLossRate, getWorkKg, getOrderTotals } from '../utils/orderModel';
import { diffDaysYmd, todayYmd, isYmd, round1, fmtKg } from '../utils/orderCalculations';

// ============================================================
// 계산 헬퍼 (v8 오더 구조 기준)
// ============================================================

// 올바른 날짜만 골라 가장 늦은 날짜 ('' = 없음)
const maxYmd = (list) => list.filter(isYmd).sort().pop() || '';

// 오더 완료일: 출고 완료된 컬러의 출고일 중 가장 늦은 날
//   → 출고일이 하나도 없으면 공정 완료일·LOT 종료일 중 가장 늦은 날
const getOrderDoneDate = (order) => {
  const colors = order.colors || [];
  const shipped = maxYmd(colors.filter(c => c.shipDone).map(c => c.shipDate));
  if (shipped) return shipped;
  const stepDone = Object.values(order.steps || {}).map(s => s?.doneDate);
  const lotEnd = colors.flatMap(c => (c.lots || []).map(l => l.endDate));
  return maxYmd([...stepDone, ...lotEnd]);
};

// 등록일(createdAt) → 'YYYY-MM' (ISO 문자열·Firestore Timestamp 모두 로컬 시간 기준)
const monthKeyOf = (v) => {
  if (!v) return '';
  if (isYmd(v)) return String(v).slice(0, 7);
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 기준 월에서 최근 n개월 목록 (오래된 달 → 이번 달)
const recentMonths = (thisMonth, n) => {
  const [y, m] = thisMonth.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const idx = y * 12 + (m - 1) - (n - 1 - i);
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    return { key: `${yy}-${String(mm).padStart(2, '0')}`, label: `${yy}.${mm}`, registered: 0, completed: 0 };
  });
};

// 기간(일): 시작·종료가 모두 있고 순서가 맞을 때만
const spanDays = (start, end) => (isYmd(start) && isYmd(end) && start <= end ? diffDaysYmd(start, end) : null);

const avg = (arr) => (arr.length === 0 ? null : round1(arr.reduce((a, b) => a + b, 0) / arr.length));

// ============================================================
// 리포트 페이지 (Tailwind 자체 막대 차트)
// ============================================================
export const ReportPage = ({ orders = [] }) => {
  // v8 구조로 맞춤 (이미 정규화된 오더는 결과가 같음). 초안(order# 미입력)은 통계에서 제외
  const list = useMemo(
    () => (orders || []).map(normalizeOrder).filter(o => o && o.id && o.orderNumber),
    [orders]
  );

  const thisMonth = todayYmd().slice(0, 7);

  // 0. 수량 카드: 이번 달 출고 kg / 진행중 오더 총 작지 kg
  const kgStats = useMemo(() => {
    const r = {
      shipKg: 0, shipColors: 0, shipOrders: 0, shipMissingKg: 0,
      activeWorkKg: 0, activeOrderKg: 0, activeOrders: 0, activeMissingKg: 0,
    };
    list.forEach(o => {
      const lossRate = getLossRate(o);
      const colors = o.colors || [];

      // 출고 완료 + 출고일이 이번 달인 컬러 (작지kg 기준)
      const shippedNow = colors.filter(c => c.shipDone && isYmd(c.shipDate) && c.shipDate.slice(0, 7) === thisMonth);
      if (shippedNow.length > 0) r.shipOrders++;
      shippedNow.forEach(c => {
        const kg = getWorkKg(c, lossRate);
        r.shipColors++;
        if (kg === null) r.shipMissingKg++;
        else r.shipKg += kg;
      });

      // 진행중 오더 전체 작지 kg
      if (o.status === 'active') {
        const totals = getOrderTotals(o);
        r.activeOrders++;
        r.activeWorkKg += totals.workKg;
        r.activeOrderKg += totals.orderKg;
        r.activeMissingKg += colors.filter(c => getWorkKg(c, lossRate) === null).length;
      }
    });
    return { ...r, shipKg: round1(r.shipKg), activeWorkKg: round1(r.activeWorkKg), activeOrderKg: round1(r.activeOrderKg) };
  }, [list, thisMonth]);

  // 1. 납기 준수율 (완료 오더 중 완료일 ≤ 납기). 납기나 완료일이 없으면 판단 불가로 제외
  const dueCompliance = useMemo(() => {
    const completed = list.filter(o => o.status === 'completed');
    let met = 0;
    let unknown = 0;
    const lateDays = [];
    completed.forEach(o => {
      const done = getOrderDoneDate(o);
      if (!done || !isYmd(o.finalDueDate)) { unknown++; return; }
      if (done <= o.finalDueDate) met++;
      else lateDays.push(diffDaysYmd(o.finalDueDate, done));
    });
    const judged = met + lateDays.length;
    return {
      total: completed.length,
      judged,
      met,
      late: lateDays.length,
      lateAvg: avg(lateDays),
      unknown,
      rate: judged === 0 ? null : Math.round((met / judged) * 100),
    };
  }, [list]);

  // 2. 상태별 분포 (진행중 / 보류 / 완료)
  const statusDist = useMemo(() => {
    const dist = {};
    ORDER_STATUSES.forEach(s => { dist[s.key] = 0; });
    list.forEach(o => {
      if (dist[o.status] !== undefined) dist[o.status]++;
    });
    return ORDER_STATUSES.map(s => ({ ...s, count: dist[s.key] }));
  }, [list]);

  // 3. 거래처(buyer)별 오더 수 — 대소문자·앞뒤 공백 무시하고 묶음, 미입력은 맨 아래
  const customerStats = useMemo(() => {
    const map = new Map();
    list.forEach(o => {
      const name = (o.customer || '').trim();
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { key, customer: name, total: 0, active: 0, completed: 0 });
      const e = map.get(key);
      e.total++;
      if (o.status === 'active') e.active++;
      if (o.status === 'completed') e.completed++;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (!a.customer !== !b.customer) return a.customer ? -1 : 1;
      return b.total - a.total || a.customer.localeCompare(b.customer);
    });
  }, [list]);

  const namedCustomerCount = customerStats.filter(c => c.customer).length;

  // 4. 월별 등록/완료 (최근 6개월) — 등록 = createdAt, 완료 = 오더 완료일(납기 준수율과 같은 기준)
  const monthlyStats = useMemo(() => {
    const months = recentMonths(thisMonth, 6);
    const byKey = new Map(months.map(m => [m.key, m]));
    let noDoneDate = 0;
    list.forEach(o => {
      const reg = byKey.get(monthKeyOf(o.createdAt));
      if (reg) reg.registered++;
      if (o.status === 'completed') {
        const done = getOrderDoneDate(o);
        if (!done) { noDoneDate++; return; }
        const m = byKey.get(done.slice(0, 7));
        if (m) m.completed++;
      }
    });
    return { months, noDoneDate };
  }, [list, thisMonth]);

  const monthMax = Math.max(1, ...monthlyStats.months.map(m => Math.max(m.registered, m.completed)));

  // 5. 공정별 평균 소요일 — 계획: 시작일~종료일, 실제: 시작일~완료일(완료된 공정)
  //    염가공은 컬러별 LOT 단위 (LOT엔 완료일이 없어 계획만)
  const processStats = useMemo(() => {
    const rows = ORDER_STEPS.map(m => ({ key: m.key, label: m.label, planned: [], actual: [], planOnly: false }));
    const dyeRow = { key: DYEING_STEP.key, label: `${DYEING_STEP.label} (LOT당)`, planned: [], actual: [], planOnly: true };
    rows.splice(rows.findIndex(r => r.key === 'knitting') + 1, 0, dyeRow);
    const byKey = new Map(rows.map(r => [r.key, r]));

    list.forEach(o => {
      ORDER_STEPS.forEach(meta => {
        const step = o.steps?.[meta.key];
        if (!step) return;
        const row = byKey.get(meta.key);
        const planned = spanDays(step.startDate, step.endDate);
        if (planned !== null) row.planned.push(planned);
        const actual = step.status === 'done' ? spanDays(step.startDate, step.doneDate) : null;
        if (actual !== null) row.actual.push(actual);
      });
      (o.colors || []).forEach(c => {
        (c.lots || []).forEach(l => {
          const planned = spanDays(l.startDate, l.endDate);
          if (planned !== null) dyeRow.planned.push(planned);
        });
      });
    });

    return rows
      .map(r => ({
        key: r.key,
        label: r.label,
        planOnly: r.planOnly,
        plannedAvg: avg(r.planned),
        actualAvg: avg(r.actual),
        plannedCount: r.planned.length,
        actualCount: r.actual.length,
      }))
      .filter(r => r.plannedCount > 0 || r.actualCount > 0);
  }, [list]);

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

      {/* 0행: 수량 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <KgCard
          icon={Truck}
          title="이번 달 출고"
          subtitle={`${Number(thisMonth.slice(5))}월 · 출고 완료 컬러의 작지 kg`}
          kg={kgStats.shipKg}
          lines={[
            kgStats.shipColors === 0
              ? '이번 달 출고 완료된 컬러가 아직 없습니다'
              : `오더 ${kgStats.shipOrders}건 · 컬러 ${kgStats.shipColors}개`,
            kgStats.shipMissingKg > 0 ? `kg 미입력 컬러 ${kgStats.shipMissingKg}개는 합계에서 빠짐` : '',
          ]}
        />
        <KgCard
          icon={Layers}
          title="진행중 오더 총 작지"
          subtitle="진행중 오더의 모든 컬러 합계"
          kg={kgStats.activeWorkKg}
          lines={[
            kgStats.activeOrders === 0
              ? '진행중인 오더가 없습니다'
              : `진행중 ${kgStats.activeOrders}건 · 오더 ${fmtKg(kgStats.activeOrderKg)} kg`,
            kgStats.activeMissingKg > 0 ? `kg 미입력 컬러 ${kgStats.activeMissingKg}개는 합계에서 빠짐` : '',
          ]}
        />
      </div>

      {/* 1행: 납기 준수율 + 상태별 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard icon={CheckCircle} title="납기 준수율" subtitle="완료된 오더 · 출고일(없으면 공정 완료일) 기준">
          {dueCompliance.total === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">완료된 오더가 아직 없습니다</div>
          ) : dueCompliance.rate === null ? (
            <div className="text-center py-6 text-sm text-slate-400">
              완료 {dueCompliance.total}건 모두 납기 또는 완료일(출고일)이 없어 계산할 수 없어요
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="text-5xl font-extrabold text-emerald-600">{dueCompliance.rate}%</div>
              <div className="text-xs text-slate-500 mt-1">
                완료 {dueCompliance.judged}건 중 {dueCompliance.met}건 준수
              </div>
              {dueCompliance.late > 0 && (
                <div className="text-[11px] font-bold text-red-600 mt-1">
                  지연 {dueCompliance.late}건 · 평균 {dueCompliance.lateAvg}일 늦음
                </div>
              )}
              {dueCompliance.unknown > 0 && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  납기·완료일 미입력 {dueCompliance.unknown}건은 제외
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Package} title="상태별 분포" subtitle={list.length > 0 ? `전체 ${list.length}건` : ''}>
          {list.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">데이터 없음</div>
          ) : (
            <div className="space-y-2">
              {statusDist.map(s => {
                const pct = Math.round((s.count / list.length) * 100);
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
        <SectionCard icon={Users} title="거래처별 오더 수" subtitle={`${namedCustomerCount}개 거래처`}>
          {customerStats.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">데이터 없음</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase">거래처</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase w-12">전체</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase w-14">진행중</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase w-12">완료</th>
                  </tr>
                </thead>
                <tbody>
                  {customerStats.map(c => (
                    <tr key={c.key} className="border-b border-slate-100">
                      <td className={`px-2 py-1.5 font-bold break-all ${c.customer ? 'text-slate-700' : 'text-slate-400'}`}>
                        {c.customer || '(거래처 미입력)'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{c.total}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{c.active}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{c.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Calendar} title="월별 등록 / 완료" subtitle="최근 6개월">
          <div className="space-y-2">
            {monthlyStats.months.map(m => (
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
            {monthlyStats.noDoneDate > 0 && (
              <div className="text-[11px] text-slate-400 pt-1">
                완료일(출고일·공정 완료일)이 없는 완료 오더 {monthlyStats.noDoneDate}건은 완료 막대에서 빠짐
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 3행: 공정별 평균 소요일 */}
      <SectionCard icon={AlertCircle} title="공정별 평균 소요일" subtitle="계획(시작~종료) vs 실제(시작~완료일)">
        {processStats.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">공정 일정 데이터 없음</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
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
                  const diff = (p.actualAvg !== null && p.plannedAvg !== null) ? round1(p.actualAvg - p.plannedAvg) : null;
                  return (
                    <tr key={p.key} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-bold text-slate-700 whitespace-nowrap">{p.label}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{p.plannedAvg ?? '-'}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{p.actualAvg ?? '-'}</td>
                      <td className={`px-2 py-1.5 text-right font-mono font-bold ${
                        diff === null ? 'text-slate-400' : diff > 0 ? 'text-red-700' : diff < 0 ? 'text-blue-700' : 'text-slate-500'
                      }`}>
                        {diff === null ? '-' : (diff > 0 ? `+${diff}` : diff)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-400 whitespace-nowrap">
                        {p.planOnly ? `LOT ${p.plannedCount}개` : `계획 ${p.plannedCount} / 실제 ${p.actualCount}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

// ============================================================
// 섹션 카드
// ============================================================
const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
  <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2 flex-wrap">
      <Icon className="w-4 h-4 text-teal-600" />
      <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
      {subtitle && <span className="text-[11px] text-slate-500">{subtitle}</span>}
    </div>
    {children}
  </section>
);

// ============================================================
// 수량(kg) 카드
// ============================================================
const KgCard = ({ icon: Icon, title, subtitle, kg, lines = [] }) => (
  <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <Icon className="w-4 h-4 text-teal-600" />
      <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
      {subtitle && <span className="text-[11px] text-slate-500">{subtitle}</span>}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-extrabold text-teal-700 font-mono break-all">{fmtKg(kg) || '0'}</span>
      <span className="text-sm font-bold text-slate-500">kg</span>
    </div>
    {lines.filter(Boolean).map(line => (
      <div key={line} className="text-[11px] text-slate-500 mt-0.5">{line}</div>
    ))}
  </section>
);
