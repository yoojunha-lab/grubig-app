import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, Factory, TrendingUp, DollarSign, Info } from 'lucide-react';
import { MARGIN_TIERS } from '../../constants/common';
import { num } from '../../utils/helpers';

export const DesktopFabricRow = React.memo(({
  f,
  viewMode,
  isExpanded,
  onToggleExpand,
  handleEditFabric,
  handleDeleteFabric,
  setActiveTab,
  calculateCost,
  yarnLibrary,
  designSheets,
  handleEditSheet,
  setIsDesignSheetModalOpen
}) => {
  // calculateCost를 f와 calculateCost 의존성으로만 재계산 (렌더 최적화)
  const c = useMemo(() => calculateCost(f), [f, calculateCost]);
  const d1k = c.tier1k[viewMode];
  const d3k = c.tier3k[viewMode];
  const d5k = c.tier5k[viewMode];
  const sym = viewMode === 'domestic' ? '￦' : '$';

  return (
    <React.Fragment>
      <tr className={`group cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`} onClick={onToggleExpand}>
        <td className="p-3 text-slate-400 text-center border-r border-slate-50">{isExpanded ? <ChevronUp className="w-4 h-4 mx-auto text-blue-500" /> : <ChevronDown className="w-4 h-4 mx-auto group-hover:text-blue-500 transition-colors" />}</td>
        <td className="p-3 border-r border-slate-50 max-w-[250px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <b className="truncate text-sm">{f.article}</b>
            {f.yarns && f.yarns.some(y => String(y.yarnId).startsWith('UNREGISTERED_')) && (
              <span title="미등록 원사 포함 (임시 데이터)" className="cursor-help cursor-help-icon text-amber-500 shrink-0">⚠️</span>
            )}
            {Number(f.widthCut) > Number(f.widthFull) && (
              <span title="오류: 내폭이 외폭보다 큽니다" className="cursor-help cursor-help-icon text-red-500 shrink-0">🚨</span>
            )}
            {f.yarns && f.yarns.reduce((acc, y) => acc + (Number(y.ratio) || 0), 0) !== 100 && (
              <span title={`오류: 혼용률 합계가 100%가 아닙니다`} className="cursor-help cursor-help-icon text-rose-500 shrink-0">❗️</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{f.itemName}</div>
        </td>
        {/* 새 연동 설계서 컬럼 */}
        <td className="p-2 border-r border-slate-50 text-center align-middle">
          {(() => {
            const sheet = f.linkedSheetId 
              ? (designSheets || []).find(s => String(s.id) === String(f.linkedSheetId))
              : (designSheets || []).find(s => String(s.linkedFabricId) === String(f.id));
              
            return sheet ? (
              <div className="flex flex-col items-center justify-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSheet(sheet);
                    setIsDesignSheetModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 shadow-sm whitespace-nowrap cursor-pointer transition-colors active:scale-95"
                >
                  🔗 {sheet.devOrderNo || '연결됨'}
                </button>
              </div>
            ) : <span className="text-slate-300 text-[10px]">-</span>;
          })()}
        </td>
        <td className="p-2 border-r border-slate-50 align-middle">
          <div className="flex flex-col gap-1 w-full text-[11px]">
            <span className="text-blue-900 leading-tight flex justify-between">
              <span className="font-medium">폭 (Cut/Full)</span>
              <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{f.widthCut}/{f.widthFull}"</span>
            </span>
            <span className="text-blue-900 leading-tight flex justify-between">
              <span className="font-medium">GSM</span>
              <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{f.gsm}</span>
            </span>
            <span className="text-blue-900 leading-tight flex justify-between">
              <span className="font-medium">생산 G/YD</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded">{Math.round(f.costGYd) || '-'}</span>
            </span>
            <span className="text-blue-900 leading-tight flex justify-between" title="GSM 기준 면적 환산 실제 중량(g/yd)">
              <span className="font-medium">실제 G/YD</span>
              <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{Math.round(Number(f.gsm) * Number(f.widthFull) * 0.00064516 * 36)}</span>
            </span>
          </div>
        </td>

        <td className="p-2 border-r border-slate-50 align-middle">
          <div className="flex flex-col gap-1 w-full text-[11px]">
            {(f.yarns || []).filter(y => y.yarnId && y.ratio > 0).map((y, idx) => {
              const realYarnId = String(y.yarnId).split('::')[0];
              const realYarn = yarnLibrary.find(yl => String(yl.id) === String(realYarnId));
              const yarnName = realYarn?.name || '미등록 원사';
              return (
                <span key={idx} className="text-blue-900 leading-tight">
                  <span className="font-medium mr-1.5">{yarnName}</span>
                  <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{y.ratio}%</span>
                </span>
              );
            })}
          </div>
        </td>

        <td className="p-2 border-r border-slate-50 text-[11px] font-mono align-middle min-w-[200px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold text-[10px] w-10">편직비</span>
              <div className="flex gap-2.5 text-right">
                <span className="text-slate-500"><span className="text-[9px] text-slate-400 mr-0.5">1k</span>{num(f.knittingFee1k)}</span>
                <span className="text-blue-600 font-bold"><span className="text-[9px] text-blue-400 mr-0.5">3k</span>{num(f.knittingFee3k)}</span>
                <span className="text-slate-500"><span className="text-[9px] text-slate-400 mr-0.5">5k</span>{num(f.knittingFee5k)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-orange-500 font-bold text-[10px] w-10">LOSS</span>
              <div className="flex gap-2.5 text-right text-orange-600 font-bold">
                <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">1k</span>{num(f.losses?.tier1k?.knit)}%</span>
                <span><span className="text-[9px] font-normal mr-0.5">3k</span>{num(f.losses?.tier3k?.knit)}%</span>
                <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">5k</span>{num(f.losses?.tier5k?.knit)}%</span>
              </div>
            </div>
          </div>
        </td>

        <td className="p-2 border-r border-slate-50 text-[11px] font-mono align-middle min-w-[180px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold text-[10px]">염가공비</span>
              <span className="text-slate-800 font-bold">￦{num(f.dyeingFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-orange-500 font-bold text-[10px]">염색 LOSS</span>
              <div className="flex gap-2.5 text-right text-orange-600 font-bold">
                <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">1k</span>{num(f.losses?.tier1k?.dye)}%</span>
                <span><span className="text-[9px] font-normal mr-0.5">3k</span>{num(f.losses?.tier3k?.dye)}%</span>
                <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">5k</span>{num(f.losses?.tier5k?.dye)}%</span>
              </div>
            </div>
          </div>
        </td>

        <td className="p-2 border-r border-slate-50 text-center align-middle">
          <span className="font-extrabold text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 inline-flex items-center justify-center">
            {MARGIN_TIERS[f.marginTier]}%
          </span>
        </td>

        <td className="p-3 text-right font-mono text-emerald-600 text-[11px] border-r border-emerald-50 bg-emerald-50/10">{sym}{num(d1k?.priceConverter, viewMode)}</td>
        <td className="p-4 text-right font-mono text-emerald-700 font-extrabold text-[14px] border-r border-emerald-100 bg-emerald-50/50 shadow-inner">{sym}{num(d3k?.priceConverter, viewMode)}</td>
        <td className="p-3 text-right font-mono text-emerald-600 text-[11px] border-r border-slate-100 bg-emerald-50/10">{sym}{num(d5k?.priceConverter, viewMode)}</td>

        <td className="p-3 text-center border-l border-slate-50 relative">
          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={(e) => { e.stopPropagation(); handleEditFabric(f, setActiveTab); }} className="p-1.5 hover:bg-blue-100 text-blue-500 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id); }} className="p-1.5 hover:bg-red-100 text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50/80 border-b-2 border-blue-200 shadow-inner">
          <td colSpan="14" className="p-4 sm:p-6 cursor-default relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 max-w-[1200px] w-full relative z-10">

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="flex items-center gap-1"><Factory className="w-4 h-4 text-slate-400" /> 세부 원가 분석 (1YD 기준)</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${viewMode === 'domestic' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>{viewMode === 'domestic' ? '내수(￦)' : '수출($)'}</span>
                </h4>
                <div className="space-y-2 text-xs text-slate-600 flex-1">
                  <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 border-b pb-1">
                    <div className="text-left pl-1">항목</div><div>1k</div><div className="text-blue-500 bg-blue-50/50 rounded">3k (기준)</div><div>5k</div>
                  </div>
                  <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className="text-left text-slate-500 text-[10px] font-bold">원사비</div>
                    <div>{num(c.tier1k[viewMode]?.yarnCostYd, viewMode)}</div>
                    <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.yarnCostYd, viewMode)}</div>
                    <div>{num(c.tier5k[viewMode]?.yarnCostYd, viewMode)}</div>
                  </div>
                  <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className="text-left text-slate-500 text-[10px] font-bold">편직비</div>
                    <div>{num(c.tier1k[viewMode]?.knitCostYd, viewMode)}</div>
                    <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.knitCostYd, viewMode)}</div>
                    <div>{num(c.tier5k[viewMode]?.knitCostYd, viewMode)}</div>
                  </div>
                  <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className="text-left text-slate-500 text-[10px] font-bold">염가공비</div>
                    <div>{num(c.tier1k[viewMode]?.dyeCostYd, viewMode)}</div>
                    <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.dyeCostYd, viewMode)}</div>
                    <div>{num(c.tier5k[viewMode]?.dyeCostYd, viewMode)}</div>
                  </div>
                  <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="text-left text-slate-500 text-[10px] font-bold">부대비용</div>
                    <div>{num(c.tier1k[viewMode]?.extraFeeYd, viewMode)}</div>
                    <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.extraFeeYd, viewMode)}</div>
                    <div>{num(c.tier5k[viewMode]?.extraFeeYd, viewMode)}</div>
                  </div>
                  <div className="grid grid-cols-4 text-center font-mono py-2 items-center bg-slate-50 rounded mt-1">
                    <div className="text-left text-slate-700 text-[11px] font-bold pl-1">총 원가/YD</div>
                    <div className="text-slate-600 font-bold">{num(c.tier1k[viewMode]?.totalCostYd, viewMode)}</div>
                    <div className="text-blue-700 font-extrabold text-[13px]">{num(c.tier3k[viewMode]?.totalCostYd, viewMode)}</div>
                    <div className="text-slate-600 font-bold">{num(c.tier5k[viewMode]?.totalCostYd, viewMode)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md text-white flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between border-b border-slate-600 pb-2 relative z-10">
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-emerald-400" /> 단가 요약 분석표 (Price Matrix)</span>
                </h4>

                <div className="space-y-1 flex-1 flex flex-col justify-center relative z-10">
                  <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-2 border-b border-slate-700 mb-1">
                    <div>오더 구간</div>
                    <div className="text-slate-300">원가 (COST)</div>
                    <div className="text-emerald-400">도매 (CONV)</div>
                    <div className="text-indigo-400">직납 (BRAND)</div>
                  </div>

                  {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
                    const d = c[tier][viewMode];
                    const label = ['1k (미니멈)', '3k (메인)', '5k (대량)'][i];
                    const is3k = tier === 'tier3k';
                    return (
                      <div key={tier} className={`grid grid-cols-4 text-center font-mono py-2.5 rounded text-xs items-center transition-colors ${is3k ? 'bg-slate-700/80 shadow-inner' : 'hover:bg-slate-700/30'}`}>
                        <div className={`text-[10px] ${is3k ? 'text-blue-300 font-bold' : 'text-slate-400 font-medium'}`}>{label}</div>
                        <div className={`${is3k ? 'text-white font-bold' : 'text-slate-300'}`}>{sym}{num(d.totalCostYd, viewMode)}</div>
                        <div className={`${is3k ? 'text-emerald-300 font-extrabold text-[14px]' : 'text-emerald-500'}`}>{sym}{num(d.priceConverter, viewMode)}</div>
                        <div className={`${is3k ? 'text-indigo-300 font-bold text-[13px]' : 'text-indigo-500'}`}>{sym}{num(d.priceBrand, viewMode)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> 생산 조건 및 특이사항</h4>
                <div className="space-y-3 text-xs text-slate-600 flex-1">

                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 border-b border-slate-200 pb-1">공정별 LOSS 설정 (%)</div>
                    <div className="grid grid-cols-4 text-center font-mono py-1">
                      <div className="text-left text-[10px] text-slate-400 font-medium">편직/염색</div>
                      <div className="text-[10px]">{num(f.losses?.tier1k?.knit)} / {num(f.losses?.tier1k?.dye)}</div>
                      <div className="text-[11px] text-blue-600 font-bold bg-blue-50/50 rounded">{num(f.losses?.tier3k?.knit)} / {num(f.losses?.tier3k?.dye)}</div>
                      <div className="text-[10px]">{num(f.losses?.tier5k?.knit)} / {num(f.losses?.tier5k?.dye)}</div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                    <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-slate-500">지정 마진율</span><span className="font-bold text-emerald-600">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
                    <div className="text-[9px] text-slate-400 leading-tight">선택하신 도매가 마진율이 CONV 단가 책정 시 자동 계산되어 반영됩니다.</div>
                  </div>

                </div>
                {f.remarks && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-700 bg-yellow-50 border border-yellow-200 p-2.5 rounded-lg leading-relaxed shadow-sm">
                      <span className="font-bold flex items-center gap-1 mb-1 text-[10px] text-yellow-700"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>특이사항 (Remarks)</span>
                      {f.remarks}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}, (prevProps, nextProps) => {
  return prevProps.f === nextProps.f &&
         prevProps.viewMode === nextProps.viewMode &&
         prevProps.isExpanded === nextProps.isExpanded &&
         prevProps.yarnLibrary === nextProps.yarnLibrary &&
         prevProps.designSheets === nextProps.designSheets;
});
