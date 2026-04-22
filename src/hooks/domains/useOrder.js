import { useState } from 'react';
import {
  PROCESS_TYPES,
  PROCESS_DEFAULT_ACTIVE,
  PROCESS_DEFAULT_STATUS,
} from '../../constants/production';
import {
  generateOrderNumber,
  calcEstimatedDueDate,
  todayYmd,
} from '../../utils/orderCalculations';

// GRUBIG ERP - 원단 생산 오더 관리 훅
// 컬렉션: orders (단일 문서, 하위 processes/batches/colors는 중첩 배열)

// 신규 오더 초기값
const getInitialOrderInput = () => ({
  id: '',
  orderNumber: '',
  orderName: '',
  customer: '',
  brand: '',
  type: 'main',               // 'main' | 'sample'
  dyeingMethod: 'post_dyed',  // 'post_dyed' | 'yarn_dyed'
  totalQuantity: 0,
  unit: 'kg',
  finalDueDate: '',
  estimatedDueDate: '',
  defaultDailyKnittingCapacity: 0,
  useKnitterStockYarn: false,
  colors: [],                 // [{ name, quantity }]
  status: 'active',
  assignees: {
    yarnAssignee: null,
    knittingAssignee: null,
    othersAssignee: null,
  },
  processes: [],              // [{ id, processType, isActive, ... }]
  notes: '',
});

// 공정 하나의 초기 구조 생성
const makeInitialProcess = (processType, sequenceOrder = 1, isActive = false) => {
  const meta = PROCESS_TYPES.find(p => p.key === processType);
  return {
    id: `proc_${processType}_${Date.now()}`,
    processType,
    isActive,
    sequenceOrder,
    isParallelTrack: meta?.isParallelTrack || false,
    assigneeRole: meta?.assigneeRole || 'others',
    processingType: processType === 'yarn_processing' ? 'twisting' : null,
    processingDays: processType === 'dyeing' ? 7 : null,
    brandConfirmBufferDays: processType === 'dyeing' ? 3 : null,
    yarnOrders: processType === 'yarn' ? [] : undefined,
    batches: processType === 'yarn' ? undefined : [],
    notes: '',
  };
};

// 오더 타입/염색방식 기반 초기 공정 배열 생성
export const buildInitialProcesses = (type = 'main', dyeingMethod = 'post_dyed') => {
  const activeKeys = PROCESS_DEFAULT_ACTIVE[type]?.[dyeingMethod] || [];
  return PROCESS_TYPES.map(meta =>
    makeInitialProcess(meta.key, meta.defaultSequence, activeKeys.includes(meta.key))
  );
};

export const useOrder = (orders, saveDocToCloud, deleteDocFromCloud, showToast, productionAssignees) => {
  const [orderInput, setOrderInput] = useState(() => {
    const initial = getInitialOrderInput();
    initial.processes = buildInitialProcesses(initial.type, initial.dyeingMethod);
    return initial;
  });
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState(null); // 상세 모달용

  // ---------- 입력 변경 핸들러 ----------
  const handleOrderChange = (field, value) => {
    setOrderInput(prev => ({ ...prev, [field]: value }));
  };

  // 타입 또는 염색방식 변경 시 공정 기본값 재생성
  const handleTypeOrMethodChange = (field, value) => {
    setOrderInput(prev => {
      const next = { ...prev, [field]: value };
      // 선염 오더에서 편직처 보유 원사 사용 금지 (기획서 2.1 제약)
      if (field === 'dyeingMethod' && value === 'yarn_dyed') {
        next.useKnitterStockYarn = false;
      }
      // 공정 기본값 재생성 — 사용자가 이미 조정했을 수 있으므로 신규(등록) 모드에서만
      if (!prev.id) {
        next.processes = buildInitialProcesses(next.type, next.dyeingMethod);
      }
      return next;
    });
  };

  // 편직처 보유 원사 토글
  const handleUseKnitterStockYarn = (checked) => {
    setOrderInput(prev => {
      if (prev.dyeingMethod === 'yarn_dyed' && checked) {
        showToast('선염 오더는 편직처 보유 원사를 사용할 수 없습니다.', 'error');
        return prev;
      }
      // 체크 시 원사 공정 자동 비활성
      const next = { ...prev, useKnitterStockYarn: checked };
      if (checked) {
        next.processes = (prev.processes || []).map(p =>
          p.processType === 'yarn' ? { ...p, isActive: false } : p
        );
      }
      return next;
    });
  };

  // ---------- 컬러 관리 ----------
  const addColor = () => {
    setOrderInput(prev => ({
      ...prev,
      colors: [...(prev.colors || []), { name: '', quantity: 0 }],
    }));
  };

  const removeColor = (index) => {
    setOrderInput(prev => ({
      ...prev,
      colors: (prev.colors || []).filter((_, i) => i !== index),
    }));
  };

  const updateColor = (index, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      colors: (prev.colors || []).map((c, i) =>
        i === index ? { ...c, [field]: field === 'quantity' ? Number(value) || 0 : String(value).toUpperCase() } : c
      ),
    }));
  };

  // ---------- 공정 활성/변경 ----------
  const toggleProcess = (processType, active) => {
    setOrderInput(prev => {
      // 제약: 선염 + 편직처 보유 원사 + 원사 공정 활성화 불가
      if (processType === 'yarn' && active && prev.useKnitterStockYarn) {
        showToast('편직처 보유 원사를 사용하는 경우 원사 공정을 활성화할 수 없습니다.', 'error');
        return prev;
      }
      return {
        ...prev,
        processes: (prev.processes || []).map(p =>
          p.processType === processType ? { ...p, isActive: !!active } : p
        ),
      };
    });
  };

  const updateProcessField = (processType, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p =>
        p.processType === processType ? { ...p, [field]: value } : p
      ),
    }));
  };

  // ---------- 차수(batch) 관리 ----------
  const addBatch = (processType) => {
    setOrderInput(prev => {
      const processes = (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        const nextBatchNumber = (p.batches || []).length + 1;
        const newBatch = {
          id: `batch_${processType}_${Date.now()}_${nextBatchNumber}`,
          batchNumber: nextBatchNumber,
          batchType: processType === 'visual_inspection' || processType === 'physical_test' ? 'inspection_unit' : 'sequential',
          batchLabel: `${nextBatchNumber}차`,
          quantity: 0,
          colors: [],
          plannedStartDate: '',
          plannedEndDate: '',
          expectedEndDate: '',
          actualStartDate: '',
          actualEndDate: '',
          dailyCapacityOverride: null,
          status: PROCESS_DEFAULT_STATUS[processType] || '대기중',
          reworkEvents: [],
          delayReason: '',
          notes: '',
        };
        return { ...p, batches: [...(p.batches || []), newBatch] };
      });
      return { ...prev, processes };
    });
  };

  const removeBatch = (processType, batchId) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        return { ...p, batches: (p.batches || []).filter(b => b.id !== batchId) };
      }),
    }));
  };

  const updateBatchField = (processType, batchId, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        return {
          ...p,
          batches: (p.batches || []).map(b =>
            b.id === batchId
              ? { ...b, [field]: (field === 'quantity' || field === 'dailyCapacityOverride') ? (value === '' ? null : Number(value)) : value }
              : b
          ),
        };
      }),
    }));
  };

  const updateBatchColors = (processType, batchId, colors) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        return {
          ...p,
          batches: (p.batches || []).map(b =>
            b.id === batchId ? { ...b, colors } : b
          ),
        };
      }),
    }));
  };

  // ---------- 원사 발주(yarnOrders) 관리 ----------
  const addYarnOrder = () => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        const newYo = {
          id: `yo_${Date.now()}`,
          yarnTypeId: '',
          yarnTypeName: '',
          color: null,
          totalQuantity: 0,
          supplier: '',
          deliveries: [],
        };
        return { ...p, yarnOrders: [...(p.yarnOrders || []), newYo] };
      }),
    }));
  };

  const removeYarnOrder = (yoId) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return { ...p, yarnOrders: (p.yarnOrders || []).filter(yo => yo.id !== yoId) };
      }),
    }));
  };

  const updateYarnOrder = (yoId, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo =>
            yo.id === yoId
              ? { ...yo, [field]: field === 'totalQuantity' ? (Number(value) || 0) : value }
              : yo
          ),
        };
      }),
    }));
  };

  const addDelivery = (yoId) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo => {
            if (yo.id !== yoId) return yo;
            const nextNum = (yo.deliveries || []).length + 1;
            const newDelivery = {
              id: `dv_${yoId}_${Date.now()}_${nextNum}`,
              deliveryNumber: nextNum,
              quantity: 0,
              plannedArrivalDate: '',
              expectedArrivalDate: '',
              actualArrivalDate: '',
              status: '발주대기',
            };
            return { ...yo, deliveries: [...(yo.deliveries || []), newDelivery] };
          }),
        };
      }),
    }));
  };

  const removeDelivery = (yoId, deliveryId) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo =>
            yo.id === yoId
              ? { ...yo, deliveries: (yo.deliveries || []).filter(d => d.id !== deliveryId) }
              : yo
          ),
        };
      }),
    }));
  };

  const updateDelivery = (yoId, deliveryId, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo => {
            if (yo.id !== yoId) return yo;
            return {
              ...yo,
              deliveries: (yo.deliveries || []).map(d =>
                d.id === deliveryId
                  ? { ...d, [field]: field === 'quantity' ? (Number(value) || 0) : value }
                  : d
              ),
            };
          }),
        };
      }),
    }));
  };

  // ---------- 기존 원단(fabric) 정보로 자동 채움 ----------
  // fabric.yarns = [{yarnId, ratio}] → 총수량 × 비율 환산해서 원사 공정의 yarnOrders[]에 자동 채움
  const applyFabricTemplate = (fabric, yarnLibrary = []) => {
    if (!fabric) {
      showToast('원단 정보를 불러올 수 없습니다.', 'error');
      return;
    }

    setOrderInput(prev => {
      const next = { ...prev };

      // 1. 오더명 자동 채움 (비어있을 때만)
      if (!next.orderName?.trim() && fabric.article) {
        next.orderName = fabric.article;
      }

      // 2. 원사 공정 yarnOrders 자동 채움
      const yarnProcess = (next.processes || []).find(p => p.processType === 'yarn');

      // 스킵 조건: 편직처 보유 원사 사용 또는 원사 공정 비활성
      if (next.useKnitterStockYarn) {
        showToast(`원단 '${fabric.article}' 정보를 불러왔습니다. (편직처 보유 원사 사용으로 원사 발주 자동생성 스킵)`, 'info');
        return next;
      }
      if (!yarnProcess || !yarnProcess.isActive) {
        showToast(`원단 '${fabric.article}' 정보를 불러왔습니다. (원사 공정이 비활성 상태라 자동생성 스킵)`, 'info');
        return next;
      }

      // 이미 yarnOrders가 있으면 덮어쓰기 확인
      const existingCount = (yarnProcess.yarnOrders || []).length;
      if (existingCount > 0) {
        const ok = window.confirm(`기존 원사 발주 ${existingCount}건이 등록되어 있습니다.\n원단 '${fabric.article}'의 원사 구성으로 덮어쓸까요?\n(덮어쓰면 기존 발주 내역은 사라집니다)`);
        if (!ok) {
          showToast('기존 원사 발주 내역이 유지되었습니다.', 'info');
          return next;
        }
      }

      // fabric.yarns[]을 yarnOrders[]로 변환
      const totalQty = Number(next.totalQuantity) || 0;
      const newYarnOrders = [];

      (fabric.yarns || []).forEach((fy, idx) => {
        if (!fy?.yarnId) return;
        const ratio = Number(fy.ratio) || 0;
        if (ratio <= 0) return;

        // yarnLibrary에서 사종명 조회
        const yarnMeta = (yarnLibrary || []).find(y => y.id === fy.yarnId);
        const yarnTypeName = yarnMeta?.name || '';

        const qty = Math.round((totalQty * ratio / 100) * 100) / 100; // 소수점 2자리

        newYarnOrders.push({
          id: `yo_${Date.now()}_${idx}`,
          yarnTypeId: fy.yarnId,
          yarnTypeName,
          color: null,
          totalQuantity: qty,
          supplier: '',
          deliveries: [],
        });
      });

      next.processes = (next.processes || []).map(p =>
        p.processType === 'yarn' ? { ...p, yarnOrders: newYarnOrders } : p
      );

      if (newYarnOrders.length === 0) {
        showToast(`원단 '${fabric.article}'의 원사 구성이 비어있어 자동생성할 항목이 없습니다.`, 'info');
      } else {
        showToast(`원단 '${fabric.article}' 적용 완료 (원사 발주 ${newYarnOrders.length}건 자동생성)`, 'success');
      }

      return next;
    });
  };

  // ---------- 폼 리셋 / 신규 초기화 ----------
  const resetOrderForm = () => {
    const fresh = getInitialOrderInput();
    fresh.processes = buildInitialProcesses(fresh.type, fresh.dyeingMethod);
    setOrderInput(fresh);
    setEditingOrderId(null);
    setWizardStep(1);
  };

  // ---------- 저장 ----------
  const handleSaveOrder = async (user) => {
    const now = new Date().toISOString();
    const isNew = !editingOrderId;

    // 필수 검증
    if (!orderInput.orderName?.trim()) {
      showToast('오더명을 입력해주세요.', 'error');
      return false;
    }
    if (!orderInput.customer?.trim()) {
      showToast('고객사를 선택해주세요.', 'error');
      return false;
    }
    if (!(Number(orderInput.totalQuantity) > 0)) {
      showToast('총 수량은 0보다 커야 합니다.', 'error');
      return false;
    }
    if (!orderInput.finalDueDate) {
      showToast('최종 납기일을 입력해주세요.', 'error');
      return false;
    }

    // 선염 + 편직처 보유 원사 충돌 방어
    if (orderInput.dyeingMethod === 'yarn_dyed' && orderInput.useKnitterStockYarn) {
      showToast('선염 오더는 편직처 보유 원사를 사용할 수 없습니다.', 'error');
      return false;
    }
    const yarnProcessActive = (orderInput.processes || []).some(p => p.processType === 'yarn' && p.isActive);
    if (orderInput.useKnitterStockYarn && yarnProcessActive) {
      showToast('편직처 보유 원사를 사용하는 경우 원사 공정을 비활성화하세요.', 'error');
      return false;
    }

    // 오더번호 채번 (신규)
    let orderNumber = orderInput.orderNumber;
    if (isNew) {
      orderNumber = generateOrderNumber(orders);
      // 중복 재시도 (이론상 거의 발생 안 하지만 방어)
      let tries = 0;
      while ((orders || []).some(o => o.orderNumber === orderNumber) && tries < 100) {
        // 한 번 더 채번 (Date.now는 거의 증가하므로 실질 충돌은 없음)
        orderNumber = generateOrderNumber(orders);
        tries += 1;
      }
    }

    // 담당자 스냅샷 (settings/general에서 자동 복사)
    const assignees = isNew
      ? {
          yarnAssignee:     productionAssignees?.yarnAssignee     || null,
          knittingAssignee: productionAssignees?.knittingAssignee || null,
          othersAssignee:   productionAssignees?.othersAssignee   || null,
        }
      : (orderInput.assignees || {});

    // 예상납기 자동 계산
    const estimatedDueDate = calcEstimatedDueDate(orderInput) || '';

    // 납기 초과 위험 자동 상태 제안
    let finalStatus = orderInput.status || 'active';
    if (isNew && estimatedDueDate && orderInput.finalDueDate) {
      if (estimatedDueDate > orderInput.finalDueDate) {
        finalStatus = 'delayed_risk';
      }
    }

    const existing = isNew ? null : (orders || []).find(o => o.id === editingOrderId);

    const itemToSave = {
      ...orderInput,
      id: isNew ? orderNumber : editingOrderId,
      orderNumber,
      estimatedDueDate,
      status: finalStatus,
      assignees,
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now,
    };

    await saveDocToCloud('orders', itemToSave);
    showToast(isNew ? `오더 '${orderNumber}' 등록 완료` : '오더 수정 완료', 'success');
    resetOrderForm();
    return true;
  };

  // ---------- 편집/삭제 ----------
  const handleEditOrder = (order) => {
    // 1단계에서는 편집 기능을 제공하지 않음 (기획 범위 밖)
    showToast('오더 편집은 다음 단계에서 지원됩니다.', 'info');
  };

  const handleDeleteOrder = async (id) => {
    const order = (orders || []).find(o => o.id === id);
    if (!order) return;
    if (order.status === 'active') {
      if (!window.confirm(`진행중 오더 '${order.orderNumber}'를 삭제하시겠습니까?\n(생산 진행중인 오더 삭제는 권장되지 않습니다.)`)) return;
    } else {
      if (!window.confirm(`'${order.orderNumber}' 오더를 삭제하시겠습니까?`)) return;
    }
    try {
      await deleteDocFromCloud('orders', id);
      showToast('삭제되었습니다.', 'success');
    } catch {
      // showToast 내부에서 이미 처리됨
    }
  };

  return {
    // state
    orderInput, setOrderInput,
    editingOrderId, setEditingOrderId,
    wizardStep, setWizardStep,
    selectedOrderId, setSelectedOrderId,

    // input handlers
    handleOrderChange,
    handleTypeOrMethodChange,
    handleUseKnitterStockYarn,

    // colors
    addColor, removeColor, updateColor,

    // processes
    toggleProcess, updateProcessField,

    // batches
    addBatch, removeBatch, updateBatchField, updateBatchColors,

    // yarn orders
    addYarnOrder, removeYarnOrder, updateYarnOrder,
    addDelivery, removeDelivery, updateDelivery,

    // crud
    handleSaveOrder, handleEditOrder, handleDeleteOrder,
    resetOrderForm,

    // fabric template
    applyFabricTemplate,
  };
};
