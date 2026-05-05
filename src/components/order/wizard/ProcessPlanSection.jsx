import React, { useState, useMemo } from 'react';
import { Workflow, Lock, Plus, AlertCircle, Info, Calendar, Settings2, Trash2, Truck, Layers } from 'lucide-react';
import { ProcessSelectionModal } from '../modals/ProcessSelectionModal';
import { SearchableSelect } from '../../common/SearchableSelect';
import { PROCESS_TYPES, START_STAGE_DEACTIVATIONS } from '../../../constants/production';
import { analyzeProcessOverruns, enrichProcessesWithEffectiveDates } from '../../../utils/orderCalculations';

// v3 — 공정 카드: 활성 체크 + (시작일, 일수) 입력 + 종료일 자동 계산
// 원사 카드 안에서는 사종별 편직처 보유 원사 토글 + 발주 관리

// ---------- 원사 카드 내부 yarnOrders 리스트 ----------
const YarnOrdersBlock = ({ orderInput, yarnLibrary, handlers }) => {
  const yarnProcess = (orderInput.processes || []).find(p => p.processType === 'yarn');
  const yarnOrders = yarnProcess?.yarnOrders || [];
  const isLinked = !!orderInput.linkedFabricId;

  const yarnOptions = (yarnLibrary || []).map(y => ({ id: y.id, name: y.name }));

  const {
    addYarnOrder, removeYarnOrder, updateYarnOrder,
    toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
    addDelivery, removeDelivery, updateDelivery,
  } = handlers;

  if (yarnOrders.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded border-2 border-dashed border-slate-200">
          {isLinked
            ? '연결된 원단의 사종 비율이 없습니다.'
            : '원단을 선택하면 자동 채워지거나, 수동으로 발주를 추가하세요.'}
        </div>
        {!isLinked && (
          <button
            onClick={addYarnOrder}
            className="w-full flex items-center justify-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded text-[11px] font-bold hover:bg-teal-700"
          >
            <Plus className="w-3 h-3" /> 원사 발주 추가
          </button>
        )}
      </div>
    );
  }

  const allKnitterStock = yarnOrders.every(yo => !!yo.useKnitterStock);

  return (
    <div className="space-y-2">
      {/* 안내 + 단축 버튼 */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">사종별로 편직처 보유 원사 사용 또는 신규 발주 선택</p>
        <button
          onClick={() => setAllYarnOrdersKnitterStock(!allKnitterStock)}
          className="text-[11px] font-bold text-teal-700 hover:text-teal-900"
        >
          {allKnitterStock ? '전체 발주로 전환' : '전체 편직처 사용'}
        </button>
      </div>

      {/* yarnOrder 리스트 */}
      <div className="space-y-2">
        {yarnOrders.map((yo, idx) => {
          const knitter = !!yo.useKnitterStock;
          return (
            <div
              key={yo.id}
              className={`border rounded-lg p-2.5 ${knitter ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
            >
              {/* 사종 정보 + 편직처 체크 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 w-12">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {isLinked ? (
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Lock className="w-3 h-3 text-teal-600" />
                      {yo.yarnTypeName || '(미지정)'}
                      {typeof yo.ratio === 'number' && (
                        <span className="text-[11px] text-slate-500 font-normal">({yo.ratio}%)</span>
                      )}
                    </div>
                  ) : (
                    <SearchableSelect
                      value={yo.yarnTypeId || ''}
                      options={yarnOptions}
                      onChange={(v) => {
                        const found = (yarnLibrary || []).find(y => y.id === v);
                        updateYarnOrder(yo.id, 'yarnTypeId', v);
                        updateYarnOrder(yo.id, 'yarnTypeName', found?.name || '');
                      }}
                      placeholder="사종 선택..."
                    />
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-700">
                  {Number(yo.totalQuantity || 0).toLocaleString()}kg
                </div>
                {!isLinked && (
                  <button
                    onClick={() => removeYarnOrder(yo.id)}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 편직처 보유 원사 체크박스 (사종별) */}
              <label className={`mt-2 flex items-start gap-2 cursor-pointer p-1.5 rounded text-[11px] ${
                knitter ? 'bg-white' : 'bg-slate-50'
              }`}>
                <input
                  type="checkbox"
                  checked={knitter}
                  onChange={e => toggleYarnOrderKnitterStock(yo.id, e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 accent-amber-600"
                />
                <div>
                  <span className="font-bold text-slate-700">편직처 보유 원사 사용</span>
                  <span className="ml-1 text-slate-500">— 발주 없이 편직처에 있는 원사 사용</span>
                </div>
              </label>

              {/* 편직처 사용 시 발주 관리 숨김, 아니면 공급처/입고 차수 표시 */}
              {!knitter && (
                <div className="mt-2 space-y-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={yo.supplier || ''}
                      onChange={e => updateYarnOrder(yo.id, 'supplier', e.target.value.toUpperCase())}
                      placeholder="공급처 (예: XINAO)"
                      className="border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none uppercase"
                    />
                    <button
                      onClick={() => addDelivery(yo.id)}
                      className="flex items-center justify-center gap-1 bg-white border border-teal-300 text-teal-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-teal-50"
                    >
                      <Plus className="w-3 h-3" /> 입고 차수 추가
                    </button>
                  </div>
                  {(yo.deliveries || []).length > 0 && (
                    <div className="space-y-1">
                      {(yo.deliveries || []).map((dv, dIdx) => (
                        <div key={dv.id} className="grid grid-cols-[40px_1fr_1fr_30px] gap-2 items-center bg-slate-50 rounded p-1.5">
                          <span className="text-[11px] font-bold text-slate-600">
                            <Truck className="w-3 h-3 inline mr-0.5" />{dIdx + 1}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={dv.quantity || ''}
                            onChange={e => updateDelivery(yo.id, dv.id, 'quantity', e.target.value)}
                            placeholder="kg"
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right font-mono"
                          />
                          <input
                            type="date"
                            value={dv.plannedArrivalDate || ''}
                            onChange={e => updateDelivery(yo.id, dv.id, 'plannedArrivalDate', e.target.value)}
                            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                          />
                          <button
                            onClick={() => removeDelivery(yo.id, dv.id)}
                            className="p-0.5 text-slate-400 hover:text-red-500 justify-self-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLinked && (
        <button
          onClick={addYarnOrder}
          className="w-full flex items-center justify-center gap-1.5 bg-white border border-teal-300 text-teal-700 px-3 py-1.5 rounded text-[11px] font-bold hover:bg-teal-50"
        >
          <Plus className="w-3 h-3" /> 원사 발주 추가
        </button>
      )}
    </div>
  );
};

// ---------- 메인 ----------
export const ProcessPlanSection = ({
  orderInput,
  yarnLibrary = [],
  toggleProcess,
  updateProcessSchedule,
  // 원사 발주 핸들러
  addYarnOrder, removeYarnOrder, updateYarnOrder,
  toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
  addDelivery, removeDelivery, updateDelivery,
}) => {
  const [processModalOpen, setProcessModalOpen] = useState(false);

  const lockedKeys = START_STAGE_DEACTIVATIONS[orderInput.startStage] || [];
  const overruns = analyzeProcessOverruns(orderInput);
  const overrunMap = Object.fromEntries(overruns.map(o => [o.processType, o]));

  // effective dates 사전 계산
  const enriched = useMemo(() => enrichProcessesWithEffectiveDates(orderInput), [orderInput]);
  const effectiveMap = Object.fromEntries(enriched.map(p => [p.processType, p]));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);

  const processes = (orderInput.processes || [])
    .slice()
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const knittingActive = processes.some(p => p.processType === 'knitting' && p.isActive);
  const activeCount = processes.filter(p => p.isActive).length;

  const handleApplyProcessSelection = (selectedKeys) => {
    const selectedSet = new Set(selectedKeys);
    processes.forEach(p => {
      const shouldBeActive = selectedSet.has(p.processType);
      if (p.isActive !== shouldBeActive) {
        toggleProcess(p.processType, shouldBeActive);
      }
    });
  };

  const yarnHandlers = {
    addYarnOrder, removeYarnOrder, updateYarnOrder,
    toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
    addDelivery, removeDelivery, updateDelivery,
  };

  return (
    <div className="space-y-3">
      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          공정마다 <b>시작일</b>과 <b>소요일수</b>를 입력하면 종료일이 자동 계산됩니다. 시작일을 비우면 이전 공정 종료일이 자동으로 적용됩니다.
        </div>
      </div>

      {!knittingActive && orderInput.startStage !== 'finished_fabric' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div><b>편직 공정</b>은 최소 1개 활성화되어야 합니다.</div>
        </div>
      )}

      {/* 공정 선택 모달 트리거 */}
      <button
        type="button"
        onClick={() => setProcessModalOpen(true)}
        className="w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl hover:border-teal-400 transition-all"
      >
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-teal-600" />
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">관리할 공정 선택</div>
            <div className="text-[11px] text-slate-500">현재 {activeCount}개 활성</div>
          </div>
        </div>
        <Settings2 className="w-4 h-4 text-teal-600" />
      </button>

      {/* 공정 카드 리스트 */}
      <div className="space-y-2">
        {processes.map(p => {
          const meta = getMeta(p.processType);
          const isLocked = lockedKeys.includes(p.processType);
          const isActive = !!p.isActive;
          const overrun = overrunMap[p.processType];
          const eff = effectiveMap[p.processType];
          const effEnd = eff?.effectiveEnd || '';
          const effStart = eff?.effectiveStart || '';
          const startInherited = !p.startDate && effStart;

          return (
            <div
              key={p.processType}
              className={`rounded-xl border-2 p-3 transition-all ${
                isActive
                  ? overrun ? 'bg-amber-50 border-amber-300' : 'bg-white border-teal-300 shadow-sm'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              {/* 헤더 */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                  isActive ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {p.sequenceOrder}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                      {meta?.label || p.processType}
                    </span>
                    {isLocked && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />시작점 잠김
                      </span>
                    )}
                    {!isActive && !isLocked && (
                      <span className="text-[10px] text-slate-400">비활성</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 시작일 + 소요일수 + 종료일(자동) */}
              {isActive && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">
                      시작일 {startInherited && <span className="text-teal-600">(이전 공정 종료일 자동)</span>}
                    </label>
                    <input
                      type="date"
                      value={p.startDate || effStart || ''}
                      onChange={e => updateProcessSchedule(p.processType, 'startDate', e.target.value)}
                      placeholder={effStart || ''}
                      className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none ${
                        startInherited ? 'border-teal-200 bg-teal-50/30 text-slate-600' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">소요 일수</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={p.durationDays || ''}
                        onChange={e => updateProcessSchedule(p.processType, 'durationDays', e.target.value)}
                        placeholder="0"
                        className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      <span className="text-[11px] text-slate-500">일</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">종료일 (자동)</label>
                    <div className={`w-full border rounded px-2 py-1.5 text-xs text-center font-mono ${
                      effEnd ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <Calendar className="w-3 h-3 inline mr-1" />{effEnd || '-'}
                    </div>
                  </div>
                </div>
              )}

              {/* 원사 카드 — 사종별 발주/편직처 토글 */}
              {isActive && p.processType === 'yarn' && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> 사종별 원사 발주
                  </div>
                  <YarnOrdersBlock
                    orderInput={orderInput}
                    yarnLibrary={yarnLibrary}
                    handlers={yarnHandlers}
                  />
                </div>
              )}

              {/* 초과 경고 */}
              {overrun && (
                <div className="mt-2 pt-2 border-t border-amber-200 flex items-start gap-1.5 text-[11px] text-amber-700">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span><b>{overrun.days}일 {overrun.type === 'final' ? '납기 초과' : '시퀀스 위반'}</b>: {overrun.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 공정 선택 모달 */}
      <ProcessSelectionModal
        isOpen={processModalOpen}
        onClose={() => setProcessModalOpen(false)}
        processes={processes}
        startStage={orderInput.startStage}
        onApply={handleApplyProcessSelection}
      />
    </div>
  );
};
