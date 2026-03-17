import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, Factory, TrendingUp, DollarSign, Info } from 'lucide-react';
import { MARGIN_TIERS } from '../../constants/common';
import { num } from '../../utils/helpers';

export const MobileFabricCard = React.memo(({
  f,
  viewMode,
  isExpanded,
  onToggleExpand,
  handleEditFabric,
  handleDeleteFabric,
  setActiveTab,
  calculateCost,
  yarnLibrary
}) => {
  const c = useMemo(() => calculateCost(f), [f, calculateCost]);
  const sym = viewMode === 'domestic' ? '￦' : '$';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4 border-b border-slate-100 flex justify-between items-start cursor-pointer bg-slate-50/50" onClick={onToggleExpand}>
        <div>
          <div className="font-extrabold text-slate-800 text-lg uppercase tracking-tight flex items-center gap-1.5">
            {f.article}
            {f.yarns && f.yarns.some(y => String(y.yarnId).startsWith('UNREGISTERED_')) && (
              <span title="미등록 원사 포함 (임시 데이터)" className="text-sm cursor-help text-amber-500">⚠️</span>
            )}
            {Number(f.widthCut) > Number(f.widthFull) && (
              <span title="오류: 내폭이 외폭보다 큽니다" className="text-sm cursor-help text-red-500">🚨</span>
            )}
            {f.yarns && f.yarns.reduce((acc, y) => acc + (Number(y.ratio) || 0), 0) !== 100 && (
              <span title={`오류: 혼용률 합계가 100%가 아닙니다`} className="text-sm cursor-help text-rose-500">❗️</span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">{f.itemName}</div>
          <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.widthCut}/{f.widthFull}"</span>
            <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.gsm}g</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); handleEditFabric(f, setActiveTab); }} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg shadow-sm active:scale-95 transition-all"><Edit2 className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg shadow-sm active:scale-95 transition-all"><Trash2 className="w-4 h-4" /></button>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 mr-2 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 mr-2 mt-1" />}
        </div>
      </div>

      <div className="p-3 bg-white border-b border-slate-50 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex flex-col gap-1.5 mb-3">
          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold self-start mb-0.5">사용 원사 (Yarn Mix)</span>
          {(f.yarns || []).filter(y => y.yarnId && y.ratio > 0).map((y, idx) => {
            const realYarnId = String(y.yarnId).split('::')[0];
            const realYarn = yarnLibrary?.find(yl => String(yl.id) === String(realYarnId));
            const yarnName = realYarn?.name || '미등록 원사';
            return (
              <div key={idx} className="flex justify-between items-center bg-blue-50/50 text-blue-900 text-[11px] px-2 py-1 rounded border border-blue-100/50">
                <span className="truncate pr-2 font-medium tracking-tight h-full">{yarnName}</span>
                <span className="font-extrabold shrink-0 text-blue-700">{y.ratio}%</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-50/50 rounded border border-slate-100 p-2">
            <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">편직비 & LOSS</div>
            <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] mb-1">
              <div className="text-slate-500">1k<br />{num(f.knittingFee1k)}</div>
              <div className="font-bold text-blue-600 bg-blue-50 rounded">3k<br />{num(f.knittingFee3k)}</div>
              <div className="text-slate-500">5k<br />{num(f.knittingFee5k)}</div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] text-orange-600 font-bold border-t border-slate-100 pt-1">
              <div className="opacity-70">{num(f.losses?.tier1k?.knit)}%</div>
              <div className="bg-orange-100/50 rounded">{num(f.losses?.tier3k?.knit)}%</div>
              <div className="opacity-70">{num(f.losses?.tier5k?.knit)}%</div>
            </div>
          </div>

          <div className="bg-slate-50/50 rounded border border-slate-100 p-2 flex flex-col justify-between">
            <div>
              <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">염가공비 & 염색 LOSS</div>
              <div className="font-bold text-slate-800 text-[11px] text-center font-mono mb-1 py-0.5">￦{num(f.dyeingFee)}</div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] text-orange-600 font-bold border-t border-slate-100 pt-1 mt-auto">
              <div className="opacity-70">{num(f.losses?.tier1k?.dye)}%</div>
              <div className="bg-orange-100/50 rounded">{num(f.losses?.tier3k?.dye)}%</div>
              <div className="opacity-70">{num(f.losses?.tier5k?.dye)}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex flex-col justify-center items-center">
            <div className="text-[10px] text-emerald-600/70 font-bold mb-0.5 uppercase tracking-wide">도매가 (3k)</div>
            <div className="font-mono font-extrabold text-emerald-700 text-sm">{sym}{num(c.tier3k[viewMode]?.priceConverter, viewMode)}</div>
          </div>
          <div className="bg-emerald-100 rounded-lg border border-emerald-200 shadow-sm flex flex-col justify-center items-center p-2.5">
            <div className="text-emerald-800 font-extrabold text-sm">{MARGIN_TIERS[f.marginTier]}%</div>
            <div className="text-[10px] text-emerald-700/80 font-bold uppercase tracking-wide">Sales Margin</div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-slate-50/80 space-y-3">
          <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><Factory className="w-3.5 h-3.5 text-slate-400" /> 기본 생산비 및 로스</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center"><span className="text-slate-500">염가공비</span><span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">￦{num(f.dyeingFee)}/kg</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">편직비(3k)</span><span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">￦{num(f.knittingFee3k)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">LOSS(3k)</span><span className="font-mono font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{num(f.losses?.tier3k?.knit)}% + {num(f.losses?.tier3k?.dye)}%</span></div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 판매 및 마진율</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center"><span className="text-slate-500">도매 마진</span><span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">직납 추가금(3k)</span><span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">+{num(f.brandExtra?.tier3k)}/yd</span></div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
            <h4 className="text-[11px] font-bold text-slate-200 mb-2 flex justify-between items-center border-b border-slate-700/50 pb-2">
              <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-blue-400" /> 구간별 단가표</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${viewMode === 'domestic' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{viewMode === 'domestic' ? '내수' : '수출'}</span>
            </h4>
            <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-1.5 pt-1"><div>구간</div><div>원가</div><div className="text-emerald-400">도매</div><div className="text-indigo-400">직납</div></div>
            {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
              const d = c[tier][viewMode];
              const is3k = tier === 'tier3k';
              return (
                <div key={tier} className={`grid grid-cols-4 text-center font-mono py-1.5 items-center text-[10px] rounded ${is3k ? 'bg-slate-700 font-bold text-white shadow-inner' : 'text-slate-300'}`}>
                  <div className={is3k ? 'text-blue-300' : 'text-slate-400'}>{['1k', '3k', '5k'][i]}</div>
                  <div>{num(d.totalCostYd)}</div>
                  <div className={is3k ? 'text-emerald-300' : 'text-emerald-400'}>{num(d.priceConverter)}</div>
                  <div className={is3k ? 'text-indigo-300' : 'text-indigo-400'}>{num(d.priceBrand)}</div>
                </div>
              )
            })}
          </div>
          {f.remarks && (
            <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 p-2.5 rounded-lg leading-relaxed shadow-sm">
              <span className="font-bold flex items-center gap-1 mb-1 text-[10px] text-yellow-600 uppercase tracking-wider"><Info className="w-3 h-3" /> Note</span>
              {f.remarks}
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.f === nextProps.f &&
         prevProps.viewMode === nextProps.viewMode &&
         prevProps.isExpanded === nextProps.isExpanded &&
         prevProps.yarnLibrary === nextProps.yarnLibrary;
});
