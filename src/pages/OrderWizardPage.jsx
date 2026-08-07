import React, { useState, useRef, useMemo } from 'react';
import { ClipboardEdit, Save, RotateCcw, Package, Workflow, AlertCircle } from 'lucide-react';
import {
  qtyMatches, sumQty,
  calcEstimatedDueDate, diffDaysYmd,
  getOrderHealth, getHealthColorClass,
  analyzeProcessOverruns,
} from '../utils/orderCalculations';

import { Step1BasicInfo } from '../components/order/wizard/Step1BasicInfo';
import { Step2Colors } from '../components/order/wizard/Step2Colors';
import { ProcessPlanSection } from '../components/order/wizard/ProcessPlanSection';

// v2 — 2섹션 구조 (기본정보+컬러 / 공정계획)
export const OrderWizardPage = ({
  orderInput, setOrderInput,
  editingOrderId,
  handleOrderChange, setOrderType,
  addColor, removeColor, updateColor,
  toggleProcess, updateProcessField, updateProcessSchedule,
  addBatch, removeBatch, updateBatchField, updateBatchColors,
  addYarnOrder, removeYarnOrder, updateYarnOrder,
  toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
  addDelivery, removeDelivery, updateDelivery,
  handleSaveOrder, resetOrderForm,

  buyers = [],
  yarnLibrary = [],
  savedFabrics = [],
  setIsBuyerModalOpen,
  user,
  setActiveTab,
  onApplyFabric,
  onDetachFabric,
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
}) => {
  const [savingInProgress, setSavingInProgress] = useState(false);

  const sec1Ref = useRef(null);
  const sec2Ref = useRef(null);

  // ---------- 검증 (v2) ----------
  const validateSection1 = () => {
    if (!orderInput.orderNumber?.trim()) return { msg: '오더(자체번호)를 입력해주세요.', ref: sec1Ref };
    if (!orderInput.customer?.trim()) return { msg: '거래처를 선택해주세요.', ref: sec1Ref };
    if (!(Number(orderInput.quantityYd) > 0)) return { msg: '수량(YD)은 0보다 커야 합니다.', ref: sec1Ref };
    if (!orderInput.finalDueDate) return { msg: '최종 납기일을 입력해주세요.', ref: sec1Ref };

    // 컬러 검증 — 등록되어 있다면 합계 확인
    const colors = orderInput.colors || [];
    if (colors.length > 0) {
      const names = colors.map(c => (c.name || '').trim().toUpperCase()).filter(Boolean);
      if (names.some(n => !n)) return { msg: '컬러명을 모두 입력해주세요.', ref: sec1Ref };
      if (new Set(names).size !== names.length) return { msg: '컬러명이 중복되어 있습니다.', ref: sec1Ref };
      const total = sumQty(colors);
      if (!qtyMatches(total, orderInput.quantityYd)) {
        return { msg: `컬러 수량 합(${total})이 총 수량 ${orderInput.quantityYd} YD와 일치해야 합니다.`, ref: sec1Ref };
      }
    }
    return null;
  };

  const validateSection2 = () => {
    const processes = orderInput.processes || [];
    const active = processes.filter(p => p.isActive);

    if (active.length === 0) return { msg: '최소 1개 이상의 공정을 활성화해주세요.', ref: sec2Ref };

    // 가공지 시작점이 아니면 편직 공정 필수
    if (orderInput.startStage !== 'finished_fabric') {
      const knittingActive = processes.some(p => p.processType === 'knitting' && p.isActive);
      if (!knittingActive) return { msg: '편직 공정은 최소 1개 활성화되어야 합니다.', ref: sec2Ref };
    }

    // 모든 활성 공정에 소요일수 입력 필수, 첫 공정은 시작일 필수
    const sortedActive = active.slice().sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
    if (sortedActive.length > 0 && !sortedActive[0].startDate) {
      return { msg: `첫 공정(${sortedActive[0].processType})의 시작일을 입력해주세요.`, ref: sec2Ref };
    }
    for (const p of active) {
      if (!(Number(p.durationDays) > 0)) {
        return { msg: `${p.processType} 공정의 소요 일수를 입력해주세요.`, ref: sec2Ref };
      }
    }

    return null;
  };

  const validateAll = () => validateSection1() || validateSection2() || null;

  // ---------- 실시간 예상납기 + 공정 초과 분석 ----------
  const estPreview = useMemo(() => {
    const est = calcEstimatedDueDate(orderInput);
    const previewOrder = { ...orderInput, estimatedDueDate: est };
    const health = getOrderHealth(previewOrder);
    const colors = getHealthColorClass(health);
    const delta = (est && orderInput.finalDueDate) ? diffDaysYmd(est, orderInput.finalDueDate) : null;
    return { est, health, colors, delta };
  }, [orderInput]);

  const overruns = useMemo(() => analyzeProcessOverruns(orderInput), [orderInput]);

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

  const SectionHeader = ({ icon: Icon, number, title, subtitle }) => (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-md shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <span className="text-teal-600">{number}.</span> {title}
        </h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-32">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2.5 rounded-xl shadow-lg text-white ${
            editingOrderId ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-teal-500 to-cyan-600'
          }`}>
            <ClipboardEdit className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {editingOrderId ? '오더 수정' : '오더 등록'}
              </h2>
              {editingOrderId && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-bold border border-amber-300">
                  수정 중: {orderInput.orderNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingOrderId
                ? '거래처/시작점/공정 등 구조까지 변경 가능. 기존 진행 데이터(실제 일자, 상태)는 보존됨.'
                : '간단 입력 → 등록 후 상세에서 차수 보강'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const msg = editingOrderId
              ? '편집을 취소하고 신규 등록 모드로 전환하시겠습니까?'
              : '입력한 내용을 초기화하시겠습니까?';
            if (window.confirm(msg)) resetOrderForm();
          }}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 shrink-0"
        >
          <RotateCcw className="w-4 h-4" /> {editingOrderId ? '편집 취소' : '초기화'}
        </button>
      </div>

      {/* 섹션 1 — 오더 기본 정보 + 컬러 */}
      <section ref={sec1Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader icon={Package} number="1" title="오더 기본 정보" subtitle="타입·거래처·ART·납기·수량·컬러" />

        <Step1BasicInfo
          orderInput={orderInput}
          editingOrderId={editingOrderId}
          handleOrderChange={handleOrderChange}
          setOrderType={setOrderType}
          buyers={buyers}
          setIsBuyerModalOpen={setIsBuyerModalOpen}
          savedFabrics={savedFabrics}
          onApplyFabric={onApplyFabric}
          onDetachFabric={onDetachFabric}
          partners={partners}
          savePartner={savePartner}
          deletePartner={deletePartner}
          makeEmptyPartner={makeEmptyPartner}
        />

        {/* 컬러는 같은 카드 안 서브 블록 */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">컬러 구성 (선택)</div>
          <Step2Colors
            orderInput={{ ...orderInput, totalQuantity: orderInput.quantityYd, unit: 'YD' }}
            addColor={addColor}
            removeColor={removeColor}
            updateColor={updateColor}
          />
        </div>
      </section>

      {/* 섹션 2 — 공정 계획 (v3: 공정별 시작일 + 소요일수, 종료일 자동) */}
      <section ref={sec2Ref} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 scroll-mt-4">
        <SectionHeader icon={Workflow} number="2" title="공정 계획" subtitle="시작일 + 소요일수 입력 → 종료일 자동 계산. 원사 카드는 사종별로 편직처/발주 선택" />
        <ProcessPlanSection
          orderInput={orderInput}
          yarnLibrary={yarnLibrary}
          toggleProcess={toggleProcess}
          updateProcessSchedule={updateProcessSchedule}
          addYarnOrder={addYarnOrder}
          removeYarnOrder={removeYarnOrder}
          updateYarnOrder={updateYarnOrder}
          toggleYarnOrderKnitterStock={toggleYarnOrderKnitterStock}
          setAllYarnOrdersKnitterStock={setAllYarnOrdersKnitterStock}
          addDelivery={addDelivery}
          removeDelivery={removeDelivery}
          updateDelivery={updateDelivery}
        />
      </section>

      {/* 스티키 하단 바 */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl z-30 px-4 md:px-8 py-3 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {/* 실시간 예상납기 칩 + 초과 알림 */}
          <div className="flex items-center gap-2 flex-wrap">
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
            {overruns.length > 0 && (
              <div className="flex items-center gap-1 px-3 py-2 rounded-lg border bg-amber-50 border-amber-300 text-amber-700 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                {overruns.length}개 공정 초과
              </div>
            )}
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
              className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-wait ${
                editingOrderId
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600'
                  : 'bg-gradient-to-r from-teal-600 to-cyan-600'
              }`}
            >
              <Save className="w-4 h-4" /> {savingInProgress ? '저장 중...' : (editingOrderId ? '수정 저장' : '오더 등록')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
