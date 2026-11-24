import React, { useMemo, useState } from 'react';
import { Search, X, ChevronRight, MapPin } from 'lucide-react';
import {
  KNIT_MAKERS, EMPTY_MACHINE_FILTERS, searchMachines, fmtNum, feederLabel, inchLabel, needlesFor, hasMachineFilter, checkState,
  feederQuery, FEEDER_NEAR_RATIO,
} from '../../utils/knitFactoryModel';
import { todayLocalISO } from '../../utils/helpers';
import { TypeChip, GaugeChips, NeedleText, SpandexText, Dash } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — [기계로 찾기] (대표님 요청 2026-11-23, 2차)
//  · 모든 편직처의 기계 줄을 한 표로 — 게이지 · 인치 · 계열 · 종류 · 제조사 · 지역 · 스판장치 · 검색어
//  · 게이지를 넣으면 상태: 지금 꼽혀 있음 → 가마 바꾸면 됨(같은 종류·인치 보유 가마에 그 게이지) → 근접(±1G · ±2")
//  · 보기 화면: 줄을 누르면 그 편직처로 (onOpenFactory) · [찾은 곳 지도에서 보기] (onShowMap)
//  · 고르기 화면(설계서 [기계 현황에서 고르기]): 게이지 칩 또는 줄을 누르면 onPick(factory, machine, gauge)
//  · filters/onFiltersChange 를 주면 바깥(편직처 화면)과 거르기를 같이 씀 — 지도의 '찾기 조건으로 거르기'
//  · 피더 칸 (2026-11-24, 개발 고도화 3단계): '96' · '96F' → 기계 줄 피더 숫자가 같은 것('36/48'은 둘 다, '12*3'은 36)
//    근접 포함이면 ±10%도 (상태 '근접') · 피더가 안 적힌 기계는 빠지고 [피더 모르는 기계도 보기 (N줄)]로 같이 볼 수 있음
//  · 상태 칸은 상태가 있는 줄이 하나라도 있으면 (게이지 · 인치 근접 · 피더 근접)
// ============================================================

const inputCls = 'bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200';

const STATUS = {
  now: { label: '지금 꼽힘', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: '그 게이지 가마가 지금 꼽혀 있어요 (확인일 기준)' },
  swap: { label: '가마 교체', cls: 'bg-sky-50 text-sky-700 border-sky-200', title: '같은 종류 · 같은 인치 보유 가마에 그 게이지가 있어요 — 가마를 바꾸면 돼요' },
  near: { label: '근접', cls: 'bg-amber-50 text-amber-700 border-amber-200', title: `게이지 ±1G · 인치 ±2" · 피더 ±${FEEDER_NEAR_RATIO * 100}% 로 걸린 줄` },
};
const FEEDER_CELL = {
  exact: 'text-emerald-700 font-extrabold',
  near: 'text-amber-700 font-bold',
};

export const KnitMachineSearch = ({
  factories = [],
  config,
  initial = {},          // 처음 거르기 값 (고르기 창 — 설계서 게이지 · 인치)
  filters: outerFilters, // 바깥에서 같이 쓰는 거르기 (없으면 이 안에서)
  onFiltersChange,
  onOpenFactory,         // (factoryId) => 보기 화면
  onShowMap,             // () => 찾은 편직처를 지도에서
  onPick,                // (factory, machine, gauge) => 고르기 화면
  maxHeight,
  jobsByBlock = {},      // { '편직처id__묶음key': [편직 중 · 대기 오더] } — 생산 현황 연결 (2026-11-24)
}) => {
  const today = todayLocalISO();
  const [innerFilters, setInnerFilters] = useState(() => ({
    ...EMPTY_MACHINE_FILTERS,
    gauge: initial.gauge ? String(initial.gauge) : '',
    inch: initial.inch ? String(initial.inch) : '',
  }));
  const f = outerFilters || innerFilters;
  const setF = (next) => { if (onFiltersChange) onFiltersChange(next); else setInnerFilters(next); };
  const set = (k, v) => setF({ ...f, [k]: v, ...(k === 'family' ? { type: '' } : {}) });

  const regions = useMemo(() => [...new Set(factories.map(x => String(x.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [factories]);
  const makers = useMemo(() => {
    const used = new Set(factories.flatMap(x => (x.machines || []).map(m => String(m.maker || '').trim())).filter(Boolean));
    const known = KNIT_MAKERS.filter(n => used.has(n));
    return [...known, ...[...used].filter(n => !known.includes(n)).sort((a, b) => a.localeCompare(b, 'ko'))];
  }, [factories]);
  const typeChoices = (config?.types || []).filter(t => !f.family || t.family === f.family);

  const searchedFeeder = feederQuery(f.feeder);
  // 피더를 넣었으면 '피더 모름' 줄도 같이 찾아서 세고, 끄면 뺌 (한 번만 계산)
  const allRows = useMemo(() => searchMachines(factories, { ...f, feederUnknown: true }, config), [factories, f, config]);
  const rows = useMemo(() => (f.feederUnknown ? allRows : allRows.filter(r => r.feederHit !== 'unknown')), [allRows, f.feederUnknown]);
  const feederUnknownCount = searchedFeeder !== null ? allRows.filter(r => r.feederHit === 'unknown').length : 0;
  const byStatus = rows.reduce((acc, r) => { acc[r.status || 'none'] = (acc[r.status || 'none'] || 0) + 1; return acc; }, {});
  const factoryCount = new Set(rows.map(r => r.factory.id)).size;
  const totalMachines = rows.reduce((s, r) => s + (r.machine.count || 0), 0);
  const searchedGauge = Number(f.gauge) > 0 ? Number(f.gauge) : null;
  const showStatus = rows.some(r => r.status);

  return (
    <div className="space-y-2">
      {/* 거르기 */}
      <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-2.5 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">게이지 (G)</span>
            <input type="number" inputMode="decimal" value={f.gauge} onChange={e => set('gauge', e.target.value)} placeholder="28" className={`${inputCls} w-20 font-mono`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">인치 (")</span>
            <input type="number" inputMode="decimal" value={f.inch} onChange={e => set('inch', e.target.value)} placeholder="30" className={`${inputCls} w-20 font-mono`} />
          </label>
          <label className="block" title="기계 줄에 적힌 피더로 찾아요 — '96' 또는 '96F'">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">피더 (F)</span>
            <input type="text" inputMode="numeric" value={f.feeder || ''} onChange={e => set('feeder', e.target.value)} placeholder="96"
              className={`${inputCls} w-20 font-mono ${String(f.feeder || '').trim() && searchedFeeder === null ? 'border-red-300 ring-2 ring-red-100' : ''}`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">종류</span>
            <select value={f.type} onChange={e => set('type', e.target.value)} className={`${inputCls} w-32`}>
              <option value="">{f.family ? `${f.family} 계열 전체` : '전체'}</option>
              {typeChoices.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">제조사</span>
            <select value={f.maker} onChange={e => set('maker', e.target.value)} className={`${inputCls} w-24`}>
              <option value="">전체</option>
              {makers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">지역</span>
            <select value={f.region} onChange={e => set('region', e.target.value)} className={`${inputCls} w-24`}>
              <option value="">전체</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block flex-1 min-w-[150px]">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">검색어 (메모 · 편직처 · 제조사)</span>
            <span className="relative block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input type="text" value={f.text} onChange={e => set('text', e.target.value)} placeholder="개폭 · 전용 · 미니JQD …" className={`${inputCls} w-full pl-8`} />
            </span>
          </label>
          {hasMachineFilter(f) && (
            <button type="button" onClick={() => setF({ ...EMPTY_MACHINE_FILTERS, near: f.near })}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 px-2 py-1.5">
              <X className="w-3.5 h-3.5" /> 지우기
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 mr-0.5">계열</span>
          {['', ...(config?.families || [])].map(fam => (
            <button key={fam || 'all'} type="button" onClick={() => set('family', fam)}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${f.family === fam ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-300'}`}>
              {fam || '전체'}
            </button>
          ))}
          <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={f.spandex === 'yes'} onChange={e => set('spandex', e.target.checked ? 'yes' : '')} className="w-4 h-4 accent-pink-600" /> 스판장치 있는 기계만
          </label>
          {searchedFeeder !== null && (
            <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer" title="기계 줄에 피더가 안 적힌 기계 — 편직처에 물어봐야 해요">
              <input type="checkbox" checked={!!f.feederUnknown} onChange={e => set('feederUnknown', e.target.checked)} className="w-4 h-4 accent-slate-500" />
              피더 모르는 기계도 보기{feederUnknownCount ? ` (${feederUnknownCount}줄)` : ''}
            </label>
          )}
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer" title={`게이지 ±1G · 인치 ±2인치 · 피더 ±${FEEDER_NEAR_RATIO * 100}%도 같이 보여 줘요`}>
            <input type="checkbox" checked={f.near} onChange={e => set('near', e.target.checked)} className="w-4 h-4 accent-violet-600" /> 근접 포함 (±1G · ±2"{searchedFeeder !== null ? ` · 피더 ±${FEEDER_NEAR_RATIO * 100}%` : ''})
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{factoryCount}곳 · {rows.length}줄{totalMachines ? ` · 적힌 대수 ${fmtNum(totalMachines)}대` : ''}</span>
        {showStatus && ['now', 'swap', 'near'].filter(s => byStatus[s]).map(s => (
          <span key={s} className={`text-[10px] font-extrabold px-1.5 py-px rounded border ${STATUS[s].cls}`}>{STATUS[s].label} {byStatus[s]}줄</span>
        ))}
        {onPick && <span className="text-violet-700 font-bold">게이지 칩이나 줄을 눌러 설계서에 넣을 기계를 골라요</span>}
        {onShowMap && factoryCount > 0 && (
          <button type="button" onClick={onShowMap} className="ml-auto text-xs font-bold text-violet-700 inline-flex items-center gap-1 hover:underline">
            <MapPin className="w-3.5 h-3.5" /> 찾은 {factoryCount}곳 지도에서 보기
          </button>
        )}
      </div>

      <div className="overflow-auto border border-slate-200 rounded-xl" style={maxHeight ? { maxHeight } : undefined}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">
            {!factories.length ? '등록된 편직처가 없어요.'
              : feederUnknownCount && !f.feederUnknown ? `피더가 맞는 기계가 없어요. 피더가 안 적힌 기계 ${feederUnknownCount}줄은 [피더 모르는 기계도 보기]를 켜면 보여요.`
                : '맞는 기계가 없어요. 근접 포함을 켜거나 거르기를 줄여 보세요.'}
          </p>
        ) : (
          <table className="w-full text-xs min-w-[980px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                <th className="font-bold px-2 py-1.5">편직처</th>
                <th className="font-bold px-2 py-1.5">종류</th>
                <th className="font-bold px-2 py-1.5 text-right">인치</th>
                <th className="font-bold px-2 py-1.5 text-right">대수</th>
                <th className="font-bold px-2 py-1.5">피더</th>
                <th className="font-bold px-2 py-1.5">지금 가마</th>
                <th className="font-bold px-2 py-1.5 text-right">침수</th>
                <th className="font-bold px-2 py-1.5">스판</th>
                <th className="font-bold px-2 py-1.5">제조사</th>
                <th className="font-bold px-2 py-1.5">쓸 수 있는 가마</th>
                {showStatus && <th className="font-bold px-2 py-1.5">상태</th>}
                <th className="font-bold px-2 py-1.5">메모</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ factory, machine: m, block, status, hitGauges, feederHit }) => {
                const pickGauge = (g) => onPick?.(factory, m, g);
                const defaultGauge = searchedGauge && hitGauges.includes(searchedGauge) ? searchedGauge : (hitGauges[0] || m.gauge || null);
                const counts = Object.fromEntries(block.cylinders.map(c => [c.gauge, c.count]));
                const showGauge = searchedGauge && status === 'swap' ? searchedGauge : m.gauge;
                return (
                  <tr key={`${factory.id}_${m.id}`}
                    onClick={() => (onPick ? pickGauge(defaultGauge) : onOpenFactory?.(factory.id))}
                    className={`cursor-pointer ${status === 'near' ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-violet-50/50'}`}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className="font-extrabold text-slate-800">{factory.name}</span>
                      {factory.region && <span className="ml-1 text-[10px] text-slate-400">{factory.region}</span>}
                    </td>
                    <td className="px-2 py-1.5"><TypeChip config={config} type={m.type} /></td>
                    <td className="px-2 py-1.5 text-right font-mono">{inchLabel(m.inch) || <Dash />}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.count ? fmtNum(m.count) : <Dash />}</td>
                    <td className={`px-2 py-1.5 font-mono whitespace-nowrap ${FEEDER_CELL[feederHit] || ''}`}
                      title={feederHit === 'exact' ? `피더 ${searchedFeeder}F와 같아요` : feederHit === 'near' ? `피더 ${searchedFeeder}F 근처 (±${FEEDER_NEAR_RATIO * 100}%)` : ''}>
                      {feederLabel(m.feeder) || (feederHit === 'unknown' ? <span className="font-sans text-[10px] text-slate-400">피더 모름</span> : <Dash />)}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold">
                      {m.gauge ? `${m.gauge}G` : <span className="font-normal text-slate-300">모름</span>}
                      {(() => {
                        const js = jobsByBlock[`${factory.id}__${block.key}`] || [];
                        const knitting = js.filter(j => j.state === 'knitting').length;
                        return js.length ? (
                          <span title={js.map(j => `${j.order.orderNumber || '?'} ${j.state === 'knitting' ? '편직 중' : '대기'}${j.gauge ? ` ${j.gauge}G` : ''}`).join('\n')}
                            className={`block font-sans text-[9px] font-extrabold ${knitting ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {knitting ? `● 편직 중 ${knitting}` : ''}{js.length - knitting ? ` ○ 대기 ${js.length - knitting}` : ''}
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-2 py-1.5 text-right"><NeedleText needles={showGauge ? needlesFor(factory, m.type, m.inch, showGauge, showGauge === m.gauge ? m.needles : null) : null} /></td>
                    <td className="px-2 py-1.5"><SpandexText value={m.spandex} /></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{m.maker || <Dash />}</td>
                    <td className="px-2 py-1.5"><GaugeChips gauges={block.gauges} hit={searchedGauge ? hitGauges : []} mounted={m.gauge ? [m.gauge] : []} counts={counts} onPick={onPick ? pickGauge : undefined} /></td>
                    {showStatus && (
                      <td className="px-2 py-1.5">
                        {status && <span title={STATUS[status].title} className={`text-[10px] font-extrabold px-1.5 py-px rounded border whitespace-nowrap ${STATUS[status].cls}`}>{STATUS[status].label}</span>}
                        {status === 'now' && (() => {
                          // 지금 꼽힘은 확인일 기준 — 오래됐거나 확인일이 없으면 같이 보여 줌 (2026-11-24 고도화)
                          const st = checkState(factory, today);
                          return st.tone === 'ok' ? null : (
                            <span className="block text-[9px] text-slate-400 whitespace-nowrap" title="편직처에 물어보고 [오늘 확인함]을 눌러 주세요">
                              {st.tone === 'none' ? '확인일 없음' : `${Math.floor(st.days / 30)}개월 전 정보`}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-slate-500 max-w-[200px] truncate" title={m.note}>{m.note}</td>
                    <td className="px-2 py-1.5 text-right">
                      {onPick ? <span className="text-[11px] font-bold text-violet-700 whitespace-nowrap">고르기</span> : <ChevronRight className="w-4 h-4 text-slate-300 inline" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {searchedGauge && <p className="text-[10px] text-slate-400">'지금 꼽힘'은 마지막 확인일 기준이에요. 가마는 같은 편직처 · 같은 종류 · 같은 인치 기계끼리 돌려 쓴다고 보고 찾아요.</p>}
      {searchedFeeder !== null && <p className="text-[10px] text-slate-400">피더는 기계 줄에 적힌 값으로 찾아요 — '36/48'처럼 둘 적힌 기계는 둘 다, '12*3'은 36F로 봐요. 피더는 가마가 아니라 기계 것이에요.</p>}
    </div>
  );
};
