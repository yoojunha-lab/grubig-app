import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { buildDevStats } from '../../utils/devFlowModel';

// ============================================================
// 개발/설계 현황 — '개발 통계' (개발 고도화 2026-11-24)
//  의뢰 → 아이템화 몇 %가 되고 며칠 걸리는지, Drop은 왜 되는지, 바이어별로 어떤지
//  · 기간: 의뢰 일자 기준 [전체 · 올해 · 최근 6개월] (마지막 선택 기억)
//  · 숫자 칸(의뢰 · 아이템화 · Drop · 진행 중 · 걸린 날) / Drop 사유별 막대 / 바이어별 표
//  · 예전 의뢰(아이템화돼도 '개발 확정'에 남은 것)는 설계서가 아이템화됐으면 아이템화로 셈
//  계산은 utils/devFlowModel.buildDevStats
// ============================================================

const PERIODS = [
  { key: 'all', label: '전체' },
  { key: 'year', label: '올해' },
  { key: '6m', label: '최근 6개월' },
];
const STORE_KEY = 'grubig.devStats.period';
const readPeriod = () => {
  try { const v = localStorage.getItem(STORE_KEY); return PERIODS.some(p => p.key === v) ? v : 'all'; } catch { return 'all'; }
};

const Tile = ({ label, value, unit = '건', sub, tone = 'text-slate-800' }) => (
  <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 min-w-0">
    <div className="text-[10px] font-bold text-slate-500">{label}</div>
    <div className="flex items-baseline gap-1 mt-0.5">
      <span className={`text-xl font-extrabold leading-none ${tone}`}>{value ?? '-'}</span>
      {value != null && <span className="text-[10px] font-bold text-slate-400">{unit}</span>}
    </div>
    {sub && <div className="text-[9px] text-slate-400 mt-0.5 truncate">{sub}</div>}
  </div>
);

export const DevStatsPanel = ({ devRequests = [], designSheets = [] }) => {
  const [open, setOpen] = useState(false);
  const [period, setPeriodState] = useState(readPeriod);
  const [showAllBuyers, setShowAllBuyers] = useState(false);
  const setPeriod = (k) => { setPeriodState(k); try { localStorage.setItem(STORE_KEY, k); } catch { /* 저장 못 해도 화면은 그대로 */ } };
  const stats = useMemo(() => (open ? buildDevStats({ devRequests, designSheets, period }) : null), [open, devRequests, designSheets, period]);
  const maxDrop = stats ? Math.max(1, ...stats.drops.map(d => d.count)) : 1;
  const buyers = stats ? (showAllBuyers ? stats.buyers : stats.buyers.slice(0, 8)) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <span className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-600" />
          개발 통계 — 의뢰 → 아이템화 · Drop
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && stats && (
        <div className="border-t border-slate-200 p-4 bg-slate-50/40 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500">기간 (의뢰 일자)</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${period === p.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {stats.selfArticled > 0 && <span className="text-[10px] text-slate-400 ml-auto">자체개발 설계서 아이템화 {stats.selfArticled}건은 따로 (의뢰가 없어서 아래 숫자에 안 들어가요)</span>}
          </div>

          {stats.total === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">이 기간에 들어온 개발 의뢰가 없어요.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Tile label="개발 의뢰" value={stats.total} />
                <Tile label="아이템화" value={stats.articled} sub={`의뢰의 ${stats.articledPct}%`} tone="text-teal-700" />
                <Tile label="Drop" value={stats.dropped} sub={`의뢰의 ${stats.droppedPct}%`} tone="text-rose-700" />
                <Tile label="진행 중" value={stats.open} sub="의뢰 ~ 샘플 진행" />
                <Tile label="의뢰 → 아이템화" value={stats.leadAvg} unit="일 (평균)"
                  sub={stats.leadCount ? `가운데 값 ${stats.leadMedian}일 · ${stats.leadCount}건 기준` : '아이템화된 건이 아직 없어요'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
                {/* Drop 사유별 */}
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-extrabold text-slate-700 mb-2">Drop 사유 <span className="font-normal text-slate-400">({stats.dropped}건)</span></p>
                  {stats.drops.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Drop된 의뢰가 없어요.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {stats.drops.map(d => (
                        <li key={d.key} className="grid grid-cols-[84px_minmax(0,1fr)_64px] items-center gap-2 text-[11px]" title={`${d.label} ${d.count}건 (Drop의 ${d.pct}%)`}>
                          <span className={`justify-self-start text-[10px] font-bold px-1.5 py-0.5 rounded border ${d.cls}`}>{d.label}</span>
                          <span className="h-2 rounded bg-slate-100 overflow-hidden">
                            <span className="block h-full rounded bg-rose-400" style={{ width: `${Math.max(4, (d.count / maxDrop) * 100)}%` }} />
                          </span>
                          <span className="text-right font-mono font-bold text-slate-700">{d.count}건 <span className="font-sans font-normal text-slate-400">{d.pct}%</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 바이어별 */}
                <div className="bg-white rounded-lg border border-slate-200 p-3 min-w-0">
                  <p className="text-xs font-extrabold text-slate-700 mb-2">바이어별 <span className="font-normal text-slate-400">(의뢰 많은 순)</span></p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] min-w-[420px]">
                      <thead>
                        <tr className="text-[10px] text-slate-500 border-b border-slate-200">
                          <th className="text-left font-bold py-1 pr-2">바이어</th>
                          <th className="text-right font-bold py-1 px-1.5">의뢰</th>
                          <th className="text-right font-bold py-1 px-1.5">아이템화</th>
                          <th className="text-right font-bold py-1 px-1.5">Drop</th>
                          <th className="text-right font-bold py-1 px-1.5">진행 중</th>
                          <th className="text-left font-bold py-1 pl-2 w-[110px]">아이템화율</th>
                          <th className="text-right font-bold py-1 pl-1.5">평균 걸린 날</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {buyers.map(b => {
                          const rate = b.total ? Math.round((b.articled / b.total) * 100) : 0;
                          return (
                            <tr key={b.buyer}>
                              <td className="py-1 pr-2 font-bold text-slate-700 truncate max-w-[160px]">{b.buyer}</td>
                              <td className="py-1 px-1.5 text-right font-mono">{b.total}</td>
                              <td className="py-1 px-1.5 text-right font-mono text-teal-700 font-bold">{b.articled || ''}</td>
                              <td className="py-1 px-1.5 text-right font-mono text-rose-700">{b.dropped || ''}</td>
                              <td className="py-1 px-1.5 text-right font-mono text-slate-500">{b.open || ''}</td>
                              <td className="py-1 pl-2">
                                <span className="flex items-center gap-1.5" title={`${b.buyer}: 의뢰 ${b.total}건 중 아이템화 ${b.articled}건`}>
                                  <span className="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden">
                                    <span className="block h-full rounded bg-teal-500" style={{ width: `${rate}%` }} />
                                  </span>
                                  <span className="w-8 text-right font-mono text-slate-600">{rate}%</span>
                                </span>
                              </td>
                              <td className="py-1 pl-1.5 text-right font-mono text-slate-600">{b.leadAvg != null ? `${b.leadAvg}일` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {stats.buyers.length > 8 && (
                    <button onClick={() => setShowAllBuyers(v => !v)} className="mt-1.5 text-[10px] font-bold text-teal-700 hover:underline">
                      {showAllBuyers ? '접기' : `바이어 ${stats.buyers.length - 8}곳 더 보기`}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
