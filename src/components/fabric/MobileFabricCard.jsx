import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, Factory, TrendingUp, DollarSign, Info } from 'lucide-react';
import { num, fmtMan } from '../../utils/helpers';
import { KNIT_FEE_MODE_LABEL } from '../../constants/costing';
import { CostWarningBadge, CostWarningBox } from '../cost/CostWarnings';

export const MobileFabricCard = React.memo(({
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
  setIsDesignSheetModalOpen,
  // globalExchangeRate — 화면에서 직접 쓰지 않지만 아래 memo 비교에 써서 환율이 바뀌면 다시 그림
}) => {
  const c = useMemo(() => calculateCost(f), [f, calculateCost]);
  const sym = viewMode === 'domestic' ? '￦' : '$';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4 border-b border-slate-100 flex justify-between items-start cursor-pointer bg-slate-50/50" onClick={onToggleExpand}>
        <div>
          <div className="font-extrabold text-slate-800 text-lg uppercase tracking-tight flex items-center gap-1.5">
            {f.article}
            {Number(f.widthCut) > Number(f.widthFull) && (
              <span title="오류: 내폭이 외폭보다 큽니다" className="text-sm cursor-help text-red-500">🚨</span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">{f.itemName}</div>
          {/* 원가 확인 필요 — 터치 화면은 마우스 올리기가 없어 카드를 펼치면 사유 목록이 보임 */}
          {c.costWarnings?.length > 0 && <div className="mt-1"><CostWarningBadge warnings={c.costWarnings} /></div>}
          <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.widthCut}/{f.widthFull}"</span>
            <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.gsm}g</span>
          </div>
          {/* 모바일 뷰 연동 설계서 표시 */}
          {(() => {
            const sheet = f.linkedSheetId 
              ? (designSheets || []).find(s => String(s.id) === String(f.linkedSheetId))
              : (designSheets || []).find(s => String(s.linkedFabricId) === String(f.id));
              
            return sheet ? (
              <div className="mt-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSheet(sheet);
                    setIsDesignSheetModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 shadow-sm cursor-pointer transition-colors active:scale-95"
                >
                  🔗 연동 설계서: {sheet.devOrderNo || '조회'}
                </button>
              </div>
            ) : null;
          })()}
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
          {(f.yarns || []).filter(y => y?.yarnId && y.ratio > 0).map((y, idx) => {
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
            <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">편직 (난이도 · kg단가)</div>
            <div className="text-center font-mono text-[11px] font-bold text-indigo-700">{c.knitGrade?.name} <span className="font-normal text-indigo-400">정액 {fmtMan(c.knitGrade?.fixedFee)}</span></div>
            <div className="text-center font-mono text-[11px] font-bold text-slate-800 border-t border-slate-100 pt-1 mt-1">￦{num(c.knitKgRate)}/kg</div>
          </div>

          <div className="bg-slate-50/50 rounded border border-slate-100 p-2">
            <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">가공 (유형 · 염가공료)</div>
            <div className="text-center text-[11px] font-bold text-orange-600">{c.processType?.name} <span className="font-normal">LOSS {c.processLossPct}%</span></div>
            <div className="text-center font-mono text-[11px] font-bold text-slate-800 border-t border-slate-100 pt-1 mt-1">￦{num(f.dyeingFee)}/kg</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex flex-col justify-center items-center">
            <div className="text-[10px] text-emerald-600/70 font-bold mb-0.5 uppercase tracking-wide">영업 기준원가 (3k)</div>
            <div className="font-mono font-extrabold text-emerald-700 text-sm">{sym}{num(c.tier3k[viewMode]?.finalCostYd, viewMode)}</div>
          </div>
          <div className="bg-rose-100 rounded-lg border border-rose-200 shadow-sm flex flex-col justify-center items-center p-2.5">
            <div className="text-rose-800 font-extrabold text-sm">{Number(f.riskMarginPct || 0)}%</div>
            <div className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wide">위험마진</div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-slate-50/80 space-y-3">
          <CostWarningBox warnings={c.costWarnings} />
          <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><Factory className="w-3.5 h-3.5 text-slate-400" /> 3,000YD 기준 생산 조건 (자동 계산)</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center"><span className="text-slate-500">생지 kg</span><span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{num(c.tier3k.kg?.greige)} kg</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">편직비</span><span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{KNIT_FEE_MODE_LABEL[c.tier3k.knit?.mode]} {fmtMan(c.tier3k.knit?.total)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">{c.finishingLossPct > 0 ? 'LOSS (가공 + 후가공 + 편직)' : 'LOSS (가공 + 편직)'}</span><span className="font-mono font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{c.processLossPct}%{c.finishingLossPct > 0 ? ` + ${c.finishingLossPct}%` : ''} + {c.tier3k.kg?.knitLossPct ?? 0}%</span></div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-rose-500" /> 위험 마진</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center"><span className="text-slate-500">위험 마진</span><span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{Number(f.riskMarginPct || 0)}%</span></div>
              <div className="text-[10px] text-slate-400 leading-tight">순원가에 가산 → 영업 기준원가. 판매마진은 견적에서 적용.</div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
            <h4 className="text-[11px] font-bold text-slate-200 mb-2 flex justify-between items-center border-b border-slate-700/50 pb-2">
              <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-blue-400" /> 구간별 단가표</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${viewMode === 'domestic' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{viewMode === 'domestic' ? '내수' : '수출'}</span>
            </h4>
            <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-1.5 pt-1"><div>구간</div><div>순원가</div><div className="text-rose-400">위험마진</div><div className="text-emerald-400">영업원가</div></div>
            {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
              const d = c[tier][viewMode];
              const is3k = tier === 'tier3k';
              return (
                <div key={tier} className={`grid grid-cols-4 text-center font-mono py-1.5 items-center text-[10px] rounded ${is3k ? 'bg-slate-700 font-bold text-white shadow-inner' : 'text-slate-300'}`}>
                  <div className={is3k ? 'text-blue-300' : 'text-slate-400'}>{['1k', '3k', '5k'][i]}</div>
                  <div>{sym}{num(d.totalCostYd, viewMode)}</div>
                  <div className={is3k ? 'text-rose-300' : 'text-rose-400'}>{sym}{num(d.riskAmtYd, viewMode)}</div>
                  <div className={is3k ? 'text-emerald-300' : 'text-emerald-400'}>{sym}{num(d.finalCostYd, viewMode)}</div>
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
         prevProps.yarnLibrary === nextProps.yarnLibrary &&
         prevProps.designSheets === nextProps.designSheets &&
         // 전역 환율이 바뀌면 수출 단가가 달라지므로 반드시 재렌더 (calculateCost가 환율을 내포)
         prevProps.globalExchangeRate === nextProps.globalExchangeRate &&
         // 원가 설정(편직 정액·LOSS 구간·가공 유형 등)이 바뀌면 모든 품목 원가가 달라지므로 재렌더
         prevProps.costSettings === nextProps.costSettings;
});
