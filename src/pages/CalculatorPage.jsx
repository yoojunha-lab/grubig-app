import React from 'react';
import { X, RotateCcw, Info, Plus, Save, Factory, Users } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num } from '../utils/helpers';
import { MARGIN_TIERS } from '../constants/common';

export const CalculatorPage = ({
  editingFabricId,
  viewMode,
  resetFabricForm,
  fabricInput,
  handleFabricChange,
  currentCalcFull,
  yarnSelectOptions,
  handleYarnSlotChange,
  handleNestedChange,
  setFabricInput,
  handleSaveFabric,
  setActiveTab,
  globalExchangeRate
}) => {
  const totalRatio = fabricInput.yarns.reduce((sum, yarn) => sum + (Number(yarn.ratio) || 0), 0);
  const isRatioValid = totalRatio === 100;

  const handleSaveSafe = () => {
    if (!isRatioValid) {
      alert(`[입력 오류] 원사 혼용률의 합계가 100%가 아닙니다.\n현재 합계: ${totalRatio}%\n\n정확한 단가 산출을 위해 원사 비율을 조정해 주세요.`);
      return;
    }
    handleSaveFabric(setActiveTab);
  };

  // 엑셀 스타일의 Enter 키 포커스 이동 (Tab 역할)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      const container = e.currentTarget;
      const focusable = Array.from(container.querySelectorAll('input:not([disabled]), select:not([disabled]), button:not([disabled])'));
      const index = focusable.indexOf(e.target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:hidden pb-28 md:pb-6 relative" onKeyDown={handleKeyDown}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {editingFabricId ? <span className="text-yellow-600">아이템 수정 중</span> : "새 원단 등록"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              현재 모드: {viewMode === 'domestic' ? '내수 (관세포함)' : '수출 (관세제외)'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {editingFabricId && (
            <button onClick={resetFabricForm} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg">
              <X className="w-4 h-4 inline-block -mt-1 mr-1" />취소
            </button>
          )}
          <button onClick={resetFabricForm} className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-500 hover:bg-white hover:shadow-sm rounded-lg">
            <RotateCcw className="w-4 h-4 inline-block -mt-1 mr-1" />초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center">
              <span>1. Basic Info & Yarn <Info className="w-4 h-4 text-slate-300 inline" /></span>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm" title="사이드바의 전역 환율 자동 적용중">
                <label className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">전역 환율 💸</label>
                <div className="font-mono text-sm font-bold text-slate-700">￦{num(globalExchangeRate)}</div>
              </div>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">Article</label><input type="text" name="article" value={fabricInput.article} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase" placeholder="Ex. WO-24001" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label><input type="text" name="itemName" value={fabricInput.itemName} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="Item Name" /></div>
            </div>
            <div className="grid grid-cols-1 mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">특이사항 (비고)</label>
              <input type="text" name="remarks" value={fabricInput.remarks} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="원단 특이사항 메모 (예: 효성 크레오라 사용 요청)" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">내폭 (Cut)</label><input type="number" name="widthCut" value={fabricInput.widthCut} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="56" /></div>
              <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">외폭 (Full)</label><input type="number" name="widthFull" value={fabricInput.widthFull} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="58" /></div>
              <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">GSM</label><div className="relative"><input type="number" name="gsm" value={fabricInput.gsm} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="300" /><span className="absolute -bottom-5 right-0 text-[10px] text-slate-400">≈ 실제 {num(currentCalcFull.theoreticalGYd)} g/yd</span></div></div>
              <div className="col-span-1"><label className="block text-xs font-bold text-blue-600 mb-1">생산 G/YD <span className="text-[10px] text-blue-400 font-normal">(g/yd)</span></label><input type="number" name="costGYd" value={fabricInput.costGYd} onChange={handleFabricChange} className="w-full bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-right font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder={num(currentCalcFull.theoreticalGYd)} /></div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 mt-6">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-400 font-bold">원사 혼용률 (Yarn Composition)</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${isRatioValid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500 animate-pulse'}`}>
                  합계: {totalRatio}% {isRatioValid ? '(정상)' : '(100%를 맞춰주세요)'}
                </span>
              </div>
              {fabricInput.yarns.map((slot, idx) => (
                <div key={idx} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                  <span className="text-xs font-mono text-slate-400 w-4 hidden sm:inline-block">{idx + 1}</span>
                  <SearchableSelect value={slot.yarnId} options={yarnSelectOptions} onChange={(id) => handleYarnSlotChange(idx, 'yarnId', id)} placeholder="원사 검색 (대표업체 기준)..." />
                  <div className="relative w-full sm:w-24 mt-2 sm:mt-0"><input type="number" value={slot.ratio} onChange={(e) => handleYarnSlotChange(idx, 'ratio', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-right text-sm" /><span className="absolute right-2 top-2 text-xs text-slate-400">%</span></div>
                </div>
              ))}
              <div className="text-right text-xs text-slate-500 mt-2 font-mono">Avg Yarn Cost: ￦{viewMode === 'domestic' ? num(currentCalcFull.avgYarnCostDomestic) : num(currentCalcFull.avgYarnCostExport)} / kg</div>
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center">2. Fees & Cost Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">염가공비 (￦/kg)</label><input type="number" name="dyeingFee" value={fabricInput.dyeingFee} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 transition-shadow outline-none" placeholder="8800" /></div>
            </div>
            <div className="overflow-x-auto pb-2 -mx-2 px-2 md:-mx-0 md:px-0">
              <div className="overflow-hidden rounded-xl border border-slate-200 text-xs text-center min-w-[600px] md:min-w-[500px]">
              <div className="grid grid-cols-4 bg-slate-100 text-slate-600 font-bold py-2 border-b border-slate-200"><div className="text-left pl-3">항목 / 구간</div><div>1,000 YD</div><div className="text-blue-700 bg-blue-50/50">3,000 YD</div><div>5,000 YD</div></div>
              <div className="divide-y divide-slate-100 bg-white">
                <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비(kg)</div><div className="px-1"><input type="number" name="knittingFee1k" value={fabricInput.knittingFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="knittingFee3k" value={fabricInput.knittingFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="knittingFee5k" value={fabricInput.knittingFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div></div>
                <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.knit} onChange={(e) => handleNestedChange('losses', 'tier1k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.knit} onChange={(e) => handleNestedChange('losses', 'tier3k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.knit} onChange={(e) => handleNestedChange('losses', 'tier5k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.dye} onChange={(e) => handleNestedChange('losses', 'tier1k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.dye} onChange={(e) => handleNestedChange('losses', 'tier3k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.dye} onChange={(e) => handleNestedChange('losses', 'tier5k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500 flex items-center gap-1">부대비용(YD)</div><div className="px-1"><input type="number" name="extraFee1k" value={fabricInput.extraFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="extraFee3k" value={fabricInput.extraFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="extraFee5k" value={fabricInput.extraFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div></div>

                <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">원사비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.yarnCostYd, viewMode)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.yarnCostYd, viewMode)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.yarnCostYd, viewMode)}</div></div>
                <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.knitCostYd, viewMode)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.knitCostYd, viewMode)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.knitCostYd, viewMode)}</div></div>
                <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.dyeCostYd, viewMode)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.dyeCostYd, viewMode)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.dyeCostYd, viewMode)}</div></div>
                <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">부대비용/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.extraFeeYd, viewMode)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.extraFeeYd, viewMode)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.extraFeeYd, viewMode)}</div></div>

                <div className="grid grid-cols-4 py-2 items-center bg-slate-100 border-t border-slate-200"><div className="text-left pl-3 text-xs font-bold text-slate-700">제조 원가</div><div className="font-mono">{num(currentCalcFull.tier1k[viewMode]?.totalCostYd, viewMode)}</div><div className="bg-blue-100/50 font-mono font-bold text-blue-800">{num(currentCalcFull.tier3k[viewMode]?.totalCostYd, viewMode)}</div><div className="font-mono">{num(currentCalcFull.tier5k[viewMode]?.totalCostYd, viewMode)}</div></div>
              </div>
            </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">3. Sales Margin & Brand Extra</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-between">
                <div>
                  <div className="text-emerald-800 font-bold text-sm mb-2 flex items-center gap-2"><Factory className="w-4 h-4" /> 도매(Conv) 마진 단계 지정</div>
                  <select value={fabricInput.marginTier} onChange={(e) => setFabricInput({ ...fabricInput, marginTier: Number(e.target.value) })} className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800 font-bold mt-2">
                    {Object.entries(MARGIN_TIERS).map(([tier, pct]) => (<option key={tier} value={tier}>{tier}단계 ({pct}%)</option>))}
                  </select>
                </div>
                <p className="text-xs text-emerald-600 mt-3">* 기본단가 = 제조원가 / (1 - {MARGIN_TIERS[fabricInput.marginTier || 0]}%) 로 계산됩니다.</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
                <div>
                  <div className="text-indigo-800 font-bold text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Brand 직납 추가금 (￦/YD)</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-indigo-600 font-bold mb-1 mt-2"><span>1,000 YD</span><span>3,000 YD</span><span>5,000 YD</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={fabricInput.brandExtra.tier1k} onChange={(e) => handleNestedChange('brandExtra', 'tier1k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="1000" />
                    <input type="number" value={fabricInput.brandExtra.tier3k} onChange={(e) => handleNestedChange('brandExtra', 'tier3k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="700" />
                    <input type="number" value={fabricInput.brandExtra.tier5k} onChange={(e) => handleNestedChange('brandExtra', 'tier5k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="500" />
                  </div>
                </div>
                <p className="text-xs text-indigo-600 mt-3">* 기본단가에 위 금액(YD당)이 그대로 얹혀서 직납단가가 됩니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl sticky top-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              판매 단가 분석표
              <span className={`text-[10px] px-2 py-0.5 rounded border ${viewMode === 'domestic' ? 'border-blue-400 text-blue-300' : 'border-emerald-400 text-emerald-300'}`}>{viewMode === 'domestic' ? 'Domestic (내수)' : 'Export (수출)'}</span>
            </h3>
            {['tier1k', 'tier3k', 'tier5k'].map(tier => {
              const data = currentCalcFull[tier][viewMode];
              const requiredKg = currentCalcFull[tier].requiredKg;
              const label = tier === 'tier1k' ? '1,000 YD' : tier === 'tier3k' ? '3,000 YD' : '5,000 YD';
              const symbol = viewMode === 'domestic' ? '￦' : '$';

              return (
                <div key={tier} className="mb-4 pb-4 border-b border-slate-700/50">
                  <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-slate-300">{label}</span><span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Need {num(requiredKg)}kg</span></div>
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div><p className="text-[10px] text-slate-500">원가</p><p className="font-mono text-slate-300 text-sm">{symbol}{num(data?.totalCostYd, viewMode)}</p></div>
                    <div><p className="text-[10px] text-emerald-500">Conv (기본)</p><p className="font-mono text-emerald-400 font-bold">{symbol}{num(data?.priceConverter, viewMode)}</p></div>
                    <div><p className="text-[10px] text-indigo-500">Brand (직납)</p><p className="font-mono text-indigo-400 font-bold">{symbol}{num(data?.priceBrand, viewMode)}</p></div>
                  </div>
                </div>
              );
            })}
            {/* 데스크톱용 저장 버튼 */}
            <button onClick={handleSaveSafe} className="hidden md:flex w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-900/50">
              {editingFabricId ? <><Save className="w-4 h-4" /> 수정 저장</> : <><Plus className="w-4 h-4" /> 클라우드 저장</>}
            </button>
          </div>
        </div>
      </div>

      {/* 📱 모바일 하단 고정 플로팅 버튼 */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-slate-100 via-slate-50/95 to-transparent z-50 pb-6 pointer-events-none">
        <div className="pointer-events-auto">
          <button onClick={handleSaveSafe} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_8px_30px_rgb(59,130,246,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-blue-500">
            {editingFabricId ? <><Save className="w-5 h-5" /> 수정 내용 저장</> : <><Plus className="w-5 h-5" /> 장부(DB)에 저장하기</>}
          </button>
        </div>
      </div>
    </div>
  );
};
