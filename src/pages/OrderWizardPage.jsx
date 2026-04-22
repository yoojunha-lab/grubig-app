import React, { useState, useRef, useMemo } from 'react';
import { ClipboardEdit, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { qtyMatches, qtyMatchesPercent, sumQty, calcEstimatedDueDate, diffDaysYmd, getOrderHealth, getHealthColorClass } from '../utils/orderCalculations';

import { Step1BasicInfo } from '../components/order/wizard/Step1BasicInfo';
import { Step2Colors } from '../components/order/wizard/Step2Colors';
import { Step3ProcessSelection } from '../components/order/wizard/Step3ProcessSelection';
import { Step4ProcessDetails } from '../components/order/wizard/Step4ProcessDetails';
import { Step5Schedule } from '../components/order/wizard/Step5Schedule';
import { Step6Review } from '../components/order/wizard/Step6Review';

// 1페이지 구조 — 6개 섹션 세로 스크롤
// 기존 마법사(6-스텝)는 실사용 관점에서 번거로웠기에 단일 페이지로 재구성
export const OrderWizardPage = ({
  // 훅 값/핸들러
  orderInput, setOrderInput,
  handleOrderChange, handleTypeOrMethodChange, handleUseKnitterStockYarn,
  addColor, removeColor, updateColor,
  toggleProcess, updateProcessField,
  addBatch, removeBatch, updateBatchField, updateBatchColors,
  addYarnOrder, removeYarnOrder, updateYarnOrder,
  addDelivery, removeDelivery, updateDelivery,
  handleSaveOrder, resetOrderForm,

  // 외부 데이터
  buyers = [],
  yarnLibrary = [],
  savedFabrics = [],
  productionAssignees = {},
  setIsBuyerModalOpen,
  user,
  setActiveTab,
  onApplyFabric,
}) => {
  const [savingInProgress, setSavingInProgress] = useState(false);

  // 섹션 ref (스크롤 이동용)
  const sec1Ref = useRef(null);
  const sec2Ref = useRef(null);
  const sec3Ref = useRef(null);
  const sec4Ref = useRef(null);
  const sec5Ref = useRef(null);
  const sec6Ref = useRef(null);

  // ---------- 검증 ----------
  const validateSection1 = () => {
    if (!orderInput.orderName?.trim()) return { msg: '오더명을 입력해주세요.', ref: sec1Ref };
    if (!orderInput.customer?.trim()) return { msg: '고객사를 선택해주세요.', ref: sec1Ref };
    if (!(Number(orderInput.totalQuantity) > 0)) return { msg: '총 수량은 0보다 커야 합니다.', ref: sec1Ref };
    if (!orderInput.finalDueDate) return { msg: '최종 납기일을 입력해주세요.', ref: sec1Ref };
    return null;
  };

  const validateSection2 = () => {
    const colors = orderInput.colors || [];
    if (colors.length === 0) return { msg: '최소 1개 이상의 컬러를 등록해주세요.', ref: sec2Ref };
    const names = colors.map(c => (c.name || '').trim().toUpperCase()).filter(Boolean);
    if (names.some(n => !n)) return { msg: '컬러명을 모두 입력해주세요.', ref: sec2Ref };
    if (new Set(names).size !== names.length) return { msg: '컬러명이 중복되어 있습니다.', ref: sec2Ref };
    const total = sumQty(colors);
    if (!qtyMatches(total, orderInput.totalQuantity)) {
      return { msg: `컬러 수량 합(${total})이 총 수량(${orderInput.totalQuantity})과 일치해야 합니다.`, ref: sec2Ref };
    }
    return null;
  };

  const validateSection3 = () => {
    const processes = orderInput.processes || [];
    const knittingActive = processes.some(p => p.processType === 'knitting' && p.isActive);
    if (!knittingActive) return { msg: '편직 공정은 최소 1개 활성화되어야 합니다.', ref: sec3Ref };
    const yarnActive = processes.some(p => p.processType === 'yarn' && p.isActive);
    if (orderInput.useKnitterStockYarn && yarnActive) {
      return { msg: '편직처 보유 원사를 사용하는 경우 원사 공정을 비활성화하세요.', ref: sec3Ref };
    }
    return null;
  };

  const validateSection4 = () => {
    const processes = (orderInput.processes || []).filter(p => p.isActive);
    for (const p of processes) {
      if (p.processType === 'yarn') {
        if ((p.yarnOrders || []).length === 0) return { msg: '원사 공정에 최소 1건의 발주를 등록해주세요.', ref: sec4Ref };
        for (const yo of (p.yarnOrders || [])) {
          if (!yo.yarnTypeId) return { msg: '원사 발주에 사종을 선택해주세요.', ref: sec4Ref };
          if (!((yo.deliveries || []).length > 0)) return { msg: `${yo.yarnTypeName || '원사'} 발주에 입고 차수를 1건 이상 등록해주세요.`, ref: sec4Ref };
        }
      } else if (p.processType === 'dyeing') {
        if (!(Number(p.processingDays) >= 0)) return { msg: '염가공 공정의 처리 일수를 입력해주세요.', ref: sec4Ref };
      } else if (p.processType === 'lab_dip' || p.processType === 'visual_inspection' || p.processType === 'physical_test') {
        // 검증 생략
      } else {
        if ((p.batches || []).length === 0) return { msg: `${p.processType} 공정에 차수를 최소 1개 등록해주세요.`, ref: sec4Ref };
        const sumBatch = sumQty(p.batches);
        if (!qtyMatchesPercent(sumBatch, orderInput.totalQuantity, 1)) {
          return { msg: `${p.processType} 공정 차수 수량 합(${sumBatch})이 총 수량(${orderInput.totalQuantity})과 맞지 않습니다.`, ref: sec4Ref };
        }
      }
    }
    return null;
  };

  const validateSection5 = () => {
    const processes = (orderInput.processes || []).filter(p => p.isActive);
    for (const p of processes) {
      if (p.processType === 'yarn') {
        for (const yo of (p.yarnOrders || [])) {
          for (const dv of (yo.deliveries || [])) {
            if (!dv.plannedArrivalDate) return { msg: '모든 입고 차수의 계획 도착일을 입력해주세요.', ref: sec5Ref };
          }
        }
      } else if (p.processType === 'lab_dip') {
        continue;
      } else {
        for (const b of (p.batches || [])) {
          if (!b.plannedStartDate || !b.plannedEndDate) return { msg: `${p.processType} 공정의 모든 차수에 계획 시작/종료일을 입력해주세요.`, ref: sec5Ref };
          if (b.plannedStartDate > b.plannedEndDate) return { msg: `${p.processType} 공정 ${b.batchLabel}의 시작일이 종료일보다 늦습니다.`, ref: sec5Ref };
        }
      }
    }
    return null;
  };

  const validateAll = () => {
    return (
      validateSection1() ||
      validateSection2() ||
      validateSection3() ||
      validateSection4() ||
      validateSection5() ||
      null
    );
  };

  // ---------- 실시간 예상납기 프리뷰 ----------
  const estPreview = useMemo(() => {
    const est = calcEstimatedDueDate(orderInput);
    const previewOrder = { ...orderInput, estimatedDueDate: est };
    const health = getOrderHealth(previewOrder);
    const colors = getHealthColorClass(health);
    const delta = (est && orderInput.finalDueDate) ? diffDaysYmd(est, orderInput.finalDueDate) : null;
    return { est, health, colors, delta };
  }, [orderInput]);

  // ---------- 저장 ----------
  const handleFinalSubmit = async () => {
    if (savingInProgress) return;

    const err = validateAll();
    if (err) {
      alert(err.msg);
      if (err.ref?.current) {
        err.ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    setSavingInProgress(true);
    try {
      const ok = await handleSaveOrder(user);
      if (ok && setActiveTab) {
        setActiveTab('orderList');
      }
    } finally {
      setSavingInProgress(false);
    }
  };

  // ---------- 섹션 스타일 ----------
  const SectionHeader = ({ number, title, subtitle }) => (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-sm font-extrabold shadow-md">
        {number}
      </div>
      <div>
        <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-28">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <ClipboardEdit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">오더 등록</h2>
            <p className="text-xs text-slate-500 mt-0.5">원단 생산 오더 신규 등록</p>
          </div>
        </div>
        <button
          onClick={() => { if (window.confirm('입력한 내용을 초기화하시겠습니까?')) resetOrderForm(); }}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="w-4 h-4" /> 초기화
        </button>
      </div>

      {/* 섹션 1 — 기본 정보 */}
      <section ref={sec1Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="1" title="기본 정보" subtitle="오더의 기본 정보를 입력합니다" />
        <Step1BasicInfo
          orderInput={orderInput}
          handleOrderChange={handleOrderChange}
          handleTypeOrMethodChange={handleTypeOrMethodChange}
          handleUseKnitterStockYarn={handleUseKnitterStockYarn}
          buyers={buyers}
          setIsBuyerModalOpen={setIsBuyerModalOpen}
          savedFabrics={savedFabrics}
          onApplyFabric={onApplyFabric}
        />
      </section>

      {/* 섹션 2 — 컬러 */}
      <section ref={sec2Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="2" title="컬러 등록" subtitle="이 오더에서 생산할 컬러와 수량" />
        <Step2Colors
          orderInput={orderInput}
          addColor={addColor}
          removeColor={removeColor}
          updateColor={updateColor}
        />
      </section>

      {/* 섹션 3 — 공정 선택 */}
      <section ref={sec3Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="3" title="활성 공정" subtitle="관리할 공정을 선택 (타입·염색방식 기반 자동 체크)" />
        <Step3ProcessSelection
          orderInput={orderInput}
          toggleProcess={toggleProcess}
          updateProcessField={updateProcessField}
        />
      </section>

      {/* 섹션 4 — 공정별 차수/발주 */}
      <section ref={sec4Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="4" title="공정별 차수/발주" subtitle="각 활성 공정의 세부 설정" />
        <Step4ProcessDetails
          orderInput={orderInput}
          updateProcessField={updateProcessField}
          addBatch={addBatch}
          removeBatch={removeBatch}
          updateBatchField={updateBatchField}
          updateBatchColors={updateBatchColors}
          addYarnOrder={addYarnOrder}
          removeYarnOrder={removeYarnOrder}
          updateYarnOrder={updateYarnOrder}
          addDelivery={addDelivery}
          removeDelivery={removeDelivery}
          updateDelivery={updateDelivery}
          yarnLibrary={yarnLibrary}
        />
      </section>

      {/* 섹션 5 — 일정 */}
      <section ref={sec5Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="5" title="계획 일정" subtitle="차수/입고별 계획 시작·종료일" />
        <Step5Schedule
          orderInput={orderInput}
          updateBatchField={updateBatchField}
          updateDelivery={updateDelivery}
        />
      </section>

      {/* 섹션 6 — 검토 */}
      <section ref={sec6Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader number="6" title="검토" subtitle="입력한 내용 요약 및 납기 자동 계산" />
        <Step6Review
          orderInput={orderInput}
          productionAssignees={productionAssignees}
          yarnLibrary={yarnLibrary}
        />
      </section>

      {/* 스티키 하단 바 */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl z-30 px-4 md:px-8 py-3 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {/* 실시간 예상납기 칩 */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${estPreview.colors.bg} ${estPreview.colors.border}`}>
            <span className={`w-2 h-2 rounded-full ${estPreview.colors.dot}`}></span>
            <div className="text-[11px]">
              <span className="font-bold text-slate-500">예상 납기</span>
              <span className={`ml-2 font-mono font-bold ${estPreview.colors.text}`}>
                {estPreview.est || '-'}
              </span>
              {estPreview.delta !== null && (
                <span className={`ml-2 font-mono font-bold ${estPreview.colors.text}`}>
                  ({estPreview.delta >= 0 ? `+${estPreview.delta}일 여유` : `${Math.abs(estPreview.delta)}일 초과`})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (window.confirm('입력한 내용을 초기화하시겠습니까?')) resetOrderForm(); }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 초기화
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={savingInProgress}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              <Save className="w-4 h-4" /> {savingInProgress ? '저장 중...' : '오더 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
