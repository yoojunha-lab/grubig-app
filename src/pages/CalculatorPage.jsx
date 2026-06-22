import React from 'react';
import { X, RotateCcw, Info, Plus, Save, AlertTriangle } from 'lucide-react';
import { CostBreakdownTable } from '../components/cost/CostBreakdownTable';
import { num, calculateMcqYd } from '../utils/helpers';

export const CalculatorPage = ({
  editingFabricId,
  viewMode,
  resetFabricForm,
  fabricInput,
  handleFabricChange,
  currentCalcFull,
  yarnSelectOptions,
  setFabricInput,
  handleSaveFabric,
  setActiveTab,
  globalExchangeRate,
  yarnLibrary
}) => {
  const totalRatio = fabricInput.yarns.reduce((sum, yarn) => sum + (Number(yarn.ratio) || 0), 0);
  const isRatioValid = totalRatio === 100;

  // MCQ 자동 계산 (1K tier 염색 LOSS 기준): 사용자 직접 입력값이 없을 때 표시될 값
  const mcqGYdSource = Number(fabricInput.costGYd) > 0
    ? Number(fabricInput.costGYd)
    : Number(currentCalcFull?.theoreticalGYd) || 0;
  const mcqDyeLoss1k = Number(fabricInput.losses?.tier1k?.dye) || 0;
  const autoMcqYd = calculateMcqYd(mcqGYdSource, mcqDyeLoss1k);

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
    <div className="max-w-5xl mx-auto space-y-6 print:hidden pb-28 md:pb-6 relative" onKeyDown={handleKeyDown}>
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

      {/* 누락 원사 경고 — 라이브러리에서 삭제된 사종 참조 시 (silent failure 방지) */}
      {(currentCalcFull?.missingYarnIds || []).length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-800">
              ⚠️ 라이브러리에 없는 원사 {currentCalcFull.missingYarnIds.length}건 — 비율은 입력됐지만 원가 계산에서 제외됨
            </div>
            <div className="text-[11px] text-amber-700 mt-1 font-mono break-all">
              미등록 ID: {currentCalcFull.missingYarnIds.join(', ')}
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              해당 슬롯에서 원사를 다시 선택하거나, 원사 라이브러리에서 등록 후 매핑하세요.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* 1. 기본 정보 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center">
            <span>1. 기본 정보 (Basic Info) <Info className="w-4 h-4 text-slate-300 inline" /></span>
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

          {/* [MCQ] 최소 주문량 — 견적 시 100kg 기준 야드 환산 (담당자 직접 설정 가능) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-orange-600 mb-1">
                MCQ <span className="text-[10px] text-orange-400 font-normal">(YD / 최소 주문량)</span>
              </label>
              <input
                type="number"
                name="mcqYd"
                value={fabricInput.mcqYd || ''}
                onChange={handleFabricChange}
                placeholder={autoMcqYd > 0 ? `자동: ${num(autoMcqYd)} YD` : '비워두면 자동 계산'}
                className="w-full bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-right font-bold text-orange-700 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
              />
            </div>
            <div className="col-span-1 flex items-end">
              <div className="w-full bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 leading-snug">
                💡 <strong>100kg 기준 ≈ {num(autoMcqYd)} YD</strong>
                <span className="text-amber-600 font-normal ml-1">
                  (G/YD {num(mcqGYdSource)} × 1K LOSS {mcqDyeLoss1k}% / 100단위 올림)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 원가 분해 표 (재료/편직/가공/기타 + 위험마진 → 영업 기준원가) */}
        <CostBreakdownTable
          cost={fabricInput}
          yarns={fabricInput.yarns}
          calc={currentCalcFull}
          viewMode={viewMode}
          yarnSelectOptions={yarnSelectOptions}
          yarnLibrary={yarnLibrary}
          globalExchangeRate={globalExchangeRate}
          setCost={(fn) => setFabricInput(prev => fn(prev))}
          setYarns={(fn) => setFabricInput(prev => ({ ...prev, yarns: fn(prev.yarns) }))}
        />

        {/* 데스크톱 저장 버튼 */}
        <button onClick={handleSaveSafe} className="hidden md:flex w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-colors items-center justify-center gap-2 shadow-lg">
          {editingFabricId ? <><Save className="w-4 h-4" /> 수정 저장</> : <><Plus className="w-4 h-4" /> 클라우드 저장</>}
        </button>
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
