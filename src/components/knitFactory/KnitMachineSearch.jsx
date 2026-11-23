import React, { useMemo, useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { KNIT_CATEGORIES, KNIT_MAKERS, searchMachines, fmtNum, feederLabel } from '../../utils/knitFactoryModel';
import { CategoryChip, GaugeChips, NeedleText, Dash } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — [기계로 찾기] (대표님 요청 2026-11-23)
//  · 모든 편직처의 기계 줄을 한 표로 — 게이지 · 인치 · 종류 · 제조사 · 지역 · 검색어로 거르기
//  · '근접 포함': 게이지 ±1G · 인치 ±2" 도 보여 줌 (딱 맞는 줄이 먼저, 근접 줄은 '근접' 표시)
//  · 보기 화면: 줄을 누르면 그 편직처로 (onOpenFactory)
//  · 고르기 화면(설계서 [기계 현황에서 고르기]): 게이지 칩 또는 [고르기]를 누르면 onPick(factory, machine, gauge)
// ============================================================

const inputCls = 'bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200';

export const KnitMachineSearch = ({
  factories = [],
  initial = {},        // 처음 거르기 값 { gauge, inch, category }
  onOpenFactory,       // (factoryId) => 보기 화면에서 줄을 눌렀을 때
  onPick,              // (factory, machine, gauge) => 고르기 화면
  maxHeight,           // 표 높이 (고르기 창에서)
}) => {
  const [f, setF] = useState(() => ({
    gauge: initial.gauge ? String(initial.gauge) : '',
    inch: initial.inch ? String(initial.inch) : '',
    category: initial.category || 'all',
    maker: '',
    region: '',
    text: '',
    near: true,
  }));
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const hasFilter = f.gauge || f.inch || f.category !== 'all' || f.maker || f.region || f.text;

  const regions = useMemo(() => [...new Set(factories.map(x => String(x.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [factories]);
  const makers = useMemo(() => {
    const used = new Set(factories.flatMap(x => (x.machines || []).map(m => String(m.maker || '').trim())).filter(Boolean));
    const known = KNIT_MAKERS.map(m => m.name).filter(n => used.has(n));
    return [...known, ...[...used].filter(n => !known.includes(n)).sort((a, b) => a.localeCompare(b, 'ko'))];
  }, [factories]);

  const rows = useMemo(() => searchMachines(factories, f), [factories, f]);
  const exactCount = rows.filter(r => !r.near).length;
  const factoryCount = new Set(rows.map(r => r.factory.id)).size;
  const totalMachines = rows.reduce((s, r) => s + (r.machine.count || 0), 0);

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
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">제조사</span>
            <select value={f.maker} onChange={e => set('maker', e.target.value)} className={`${inputCls} w-28`}>
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
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">검색어 (세부 종류 · 메모 · 편직처)</span>
            <span className="relative block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input type="text" value={f.text} onChange={e => set('text', e.target.value)} placeholder="스판 · 쥬리 · 벨로아 · 특양면 …" className={`${inputCls} w-full pl-8`} />
            </span>
          </label>
          {hasFilter && (
            <button type="button" onClick={() => setF(prev => ({ ...prev, gauge: '', inch: '', category: 'all', maker: '', region: '', text: '' }))}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 px-2 py-1.5">
              <X className="w-3.5 h-3.5" /> 지우기
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[{ key: 'all', label: '전체' }, ...KNIT_CATEGORIES].map(c => (
            <button key={c.key} type="button" onClick={() => set('category', c.key)} title={c.hint || ''}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${f.category === c.key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-300'}`}>
              {c.label}{c.hint ? <span className="font-medium opacity-70"> ({c.hint})</span> : null}
            </button>
          ))}
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer" title="게이지 ±1G · 인치 ±2인치도 같이 보여 줘요">
            <input type="checkbox" checked={f.near} onChange={e => set('near', e.target.checked)} className="w-4 h-4 accent-violet-600" /> 근접 포함 (±1G · ±2")
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {factoryCount}곳 · {rows.length}줄{totalMachines ? ` · 적힌 대수 ${fmtNum(totalMachines)}대` : ''}
        {(f.gauge || f.inch) && rows.length > exactCount ? <span className="text-amber-700 font-bold"> (근접 {rows.length - exactCount}줄)</span> : null}
        {onPick && <span className="ml-2 text-violet-700 font-bold">게이지 칩이나 [고르기]를 눌러 설계서에 넣을 기계를 골라요</span>}
      </p>

      <div className="overflow-auto border border-slate-200 rounded-xl" style={maxHeight ? { maxHeight } : undefined}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">{factories.length ? '맞는 기계가 없어요. 근접 포함을 켜거나 거르기를 줄여 보세요.' : '등록된 편직처가 없어요.'}</p>
        ) : (
          <table className="w-full text-xs min-w-[920px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                <th className="font-bold px-2 py-1.5">편직처</th>
                <th className="font-bold px-2 py-1.5">종류</th>
                <th className="font-bold px-2 py-1.5">세부 종류</th>
                <th className="font-bold px-2 py-1.5 text-right">대수</th>
                <th className="font-bold px-2 py-1.5 text-right">인치</th>
                <th className="font-bold px-2 py-1.5">피더</th>
                <th className="font-bold px-2 py-1.5 text-right">침수</th>
                <th className="font-bold px-2 py-1.5">게이지 (가마)</th>
                <th className="font-bold px-2 py-1.5 text-right">가마수</th>
                <th className="font-bold px-2 py-1.5">제조사</th>
                <th className="font-bold px-2 py-1.5">메모</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ factory, machine: m, gaugeHit, near }) => {
                const pickGauge = (g) => onPick?.(factory, m, g);
                const searchedGauge = Number(f.gauge) > 0;
                return (
                  <tr key={`${factory.id}_${m.id}`}
                    onClick={() => (onPick ? pickGauge(searchedGauge && gaugeHit.length ? gaugeHit[0] : (m.gauges.length === 1 ? m.gauges[0] : null)) : onOpenFactory?.(factory.id))}
                    className={`cursor-pointer ${near ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-violet-50/50'}`}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className="font-extrabold text-slate-800">{factory.name}</span>
                      {factory.region && <span className="ml-1 text-[10px] text-slate-400">{factory.region}</span>}
                      {near && <span className="ml-1 text-[9px] font-extrabold px-1 py-px rounded bg-amber-100 text-amber-700 border border-amber-200">근접</span>}
                    </td>
                    <td className="px-2 py-1.5"><CategoryChip category={m.category} /></td>
                    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap max-w-[160px] truncate" title={m.group}>{m.group || <Dash />}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.count ? fmtNum(m.count) : <Dash />}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.inch ? `${m.inch}"` : <Dash />}</td>
                    <td className="px-2 py-1.5 font-mono">{m.feeder ? feederLabel(m.feeder) : <Dash />}</td>
                    <td className="px-2 py-1.5 text-right"><NeedleText machine={m} /></td>
                    <td className="px-2 py-1.5"><GaugeChips gauges={m.gauges} hit={searchedGauge ? gaugeHit : []} onPick={onPick ? pickGauge : undefined} /></td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.cylinders ? fmtNum(m.cylinders) : <Dash />}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{m.maker || <Dash />}</td>
                    <td className="px-2 py-1.5 text-slate-500 max-w-[220px] truncate" title={m.note}>{m.note}</td>
                    <td className="px-2 py-1.5 text-right">
                      {onPick
                        ? <span className="text-[11px] font-bold text-violet-700 whitespace-nowrap">고르기</span>
                        : <ChevronRight className="w-4 h-4 text-slate-300 inline" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
