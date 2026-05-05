import { useState } from 'react';
import {
  PROCESS_TYPES,
  PROCESS_DEFAULT_ACTIVE,
  PROCESS_DEFAULT_STATUS,
  START_STAGE_DEACTIVATIONS,
} from '../../constants/production';
import {
  generateOrderNumber,
  calcEstimatedDueDate,
  calcKgFromYd,
} from '../../utils/orderCalculations';
import { makeChangeLogEntry, appendChangeLog, summarizeOrderDiff } from '../../utils/auditLog';

// GRUBIG ERP - 원단 생산 오더 관리 훅 (v2)
// 컬렉션: orders
// v2 변경: 시작점(startStage) 모델 도입, 선염/후염 폐기, YD 주 단위, 공정별 dueDate 1개

// 신규 오더 초기값
const getInitialOrderInput = () => ({
  id: '',
  orderNumber: '',          // 사용자 수동 입력 (자체번호)
  articleNo: '',            // ART (원단 라이브러리에서만 선택)
  customer: '',
  brand: '',
  type: 'main',             // 'main' | 'sample'
  startStage: 'yarn',       // 'yarn' | 'knitting' | 'finished_fabric'
  quantityYd: 0,            // 사용자 입력 (주 단위)
  quantityKg: 0,            // 자동 환산 (표시용)
  gsm: 0,                   // 환산 계수 (원단에서 자동)
  widthFull: 0,             // 환산 계수 (원단에서 자동)
  finalDueDate: '',
  estimatedDueDate: '',
  colors: [],               // [{ name, quantity }]  — quantity는 yd 단위
  linkedFabricId: null,
  linkedFabricArticle: '',
  status: 'active',
  // v4: assignees(담당자 스냅샷) 폐기
  processes: [],            // [{ id, processType, isActive, sequenceOrder, startDate, durationDays, ... }]
  notes: '',
});

// 공정 하나의 초기 구조 (v3: startDate + durationDays, dueDate 폐기 / v4: assigneeRole 폐기)
const makeInitialProcess = (processType, sequenceOrder = 1, isActive = false) => {
  const meta = PROCESS_TYPES.find(p => p.key === processType);
  return {
    id: `proc_${processType}_${Date.now()}`,
    processType,
    isActive,
    sequenceOrder,
    isParallelTrack: meta?.isParallelTrack || false,
    startDate: '',                    // v3: 공정 시작일 (비우면 이전 공정 종료일로 자동)
    durationDays: 0,                  // v3: 소요 일수
    processingType: processType === 'yarn_processing' ? 'twisting' : null,
    // 모든 공정에 yarnOrders/batches 둘 다 빈 배열로. 사용처에서 필요한 것만 사용.
    // (Firestore가 undefined를 거부하므로 안전하게 [] 사용)
    yarnOrders: [],
    batches: [],
    notes: '',
  };
};

// 자동 1차 batch 생성 (v2 신규)
// batchLabel은 폐기됨 — UI 표시는 batchNumber로 자동 ("N차")
const makeAutoBatch = (processType, quantity, dueDate) => ({
  id: `batch_${processType}_${Date.now()}`,
  batchNumber: 1,
  batchType: 'sequential',
  quantity: Number(quantity) || 0,
  colors: [],
  plannedStartDate: '',
  plannedEndDate: dueDate || '',
  expectedEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
  dailyCapacityOverride: null,
  status: PROCESS_DEFAULT_STATUS,  // v5: 'pending' 단일값
  reworkEvents: [],
  delayReason: '',
  notes: '',
});

// 타입 + 시작점 기반 초기 공정 배열 생성
export const buildInitialProcesses = (type = 'main', startStage = 'yarn') => {
  const activeKeys = PROCESS_DEFAULT_ACTIVE[type]?.[startStage] || [];
  const lockedKeys = START_STAGE_DEACTIVATIONS[startStage] || [];
  return PROCESS_TYPES.map(meta => {
    const isLocked = lockedKeys.includes(meta.key);
    const isActive = !isLocked && activeKeys.includes(meta.key);
    return makeInitialProcess(meta.key, meta.defaultSequence, isActive);
  });
};

// v4: productionAssignees prop 폐기 (담당자 시스템 제거)
export const useOrder = (orders, saveDocToCloud, deleteDocFromCloud, showToast) => {
  const [orderInput, setOrderInput] = useState(() => {
    const initial = getInitialOrderInput();
    initial.processes = buildInitialProcesses(initial.type, initial.startStage);
    return initial;
  });
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // ---------- 공통 핸들러 ----------
  const handleOrderChange = (field, value) => {
    setOrderInput(prev => {
      const next = { ...prev, [field]: value };

      // YD 입력 시 KG 자동 환산
      if (field === 'quantityYd') {
        next.quantityKg = calcKgFromYd(value, prev.gsm, prev.widthFull);

        // 원단 연결 상태이면 원사 발주량도 비율 기반 재계산
        if (prev.linkedFabricId) {
          const totalQty = Number(value) || 0;
          next.processes = (prev.processes || []).map(p => {
            if (p.processType !== 'yarn') return p;
            return {
              ...p,
              yarnOrders: (p.yarnOrders || []).map(yo => {
                if (typeof yo.ratio !== 'number') return yo;
                const qty = Math.round((totalQty * yo.ratio / 100) * 100) / 100;
                return { ...yo, totalQuantity: qty };
              }),
            };
          });
        }
      }
      // gsm/widthFull 변경 시 KG 재환산
      if (field === 'gsm' || field === 'widthFull') {
        const gsm = field === 'gsm' ? value : prev.gsm;
        const w = field === 'widthFull' ? value : prev.widthFull;
        next.quantityKg = calcKgFromYd(prev.quantityYd, gsm, w);
      }

      return next;
    });
  };

  // 타입(메인/샘플) 또는 시작점 변경 — 공정 자동 재구성
  const setOrderType = (type, startStage) => {
    setOrderInput(prev => {
      const newStartStage = startStage || prev.startStage;
      const newType = type || prev.type;
      // 신규 입력 모드면 공정 재생성 (편집 모드면 그대로)
      if (!prev.id) {
        return {
          ...prev,
          type: newType,
          startStage: newStartStage,
          processes: buildInitialProcesses(newType, newStartStage),
        };
      }
      return { ...prev, type: newType, startStage: newStartStage };
    });
  };

  // v3: 사종(yarnOrder)별 편직처 보유 원사 토글
  // useKnitterStock=true면 해당 사종은 발주 관리 없이 "편직처 보유 원사 사용" 표시만
  const toggleYarnOrderKnitterStock = (yoId, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo =>
            yo.id === yoId
              ? { ...yo, useKnitterStock: !!value, ...(value ? { supplier: '', deliveries: [] } : {}) }
              : yo
          ),
        };
      }),
    }));
  };

  // v3: 모든 사종을 한 번에 편직처 보유 원사로 표시 (단축 액션 — 사용 안하지만 향후 보조)
  const setAllYarnOrdersKnitterStock = (value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo => ({
            ...yo,
            useKnitterStock: !!value,
            ...(value ? { supplier: '', deliveries: [] } : {}),
          })),
        };
      }),
    }));
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

  // ---------- 공정 ----------
  const isProcessLocked = (processType) => {
    const locked = START_STAGE_DEACTIVATIONS[orderInput.startStage] || [];
    return locked.includes(processType);
  };

  const toggleProcess = (processType, active) => {
    setOrderInput(prev => {
      // 시작점에 의해 잠긴 공정은 활성화 거부
      const locked = START_STAGE_DEACTIVATIONS[prev.startStage] || [];
      if (locked.includes(processType) && active) {
        showToast(`${processType} 공정은 시작점(${prev.startStage}) 설정에 의해 활성화할 수 없습니다.`, 'error');
        return prev;
      }

      return {
        ...prev,
        processes: (prev.processes || []).map(p => {
          if (p.processType !== processType) return p;
          if (active && !p.isActive) {
            // 활성화: 자동 1차 batch 생성 (원사 공정 제외)
            if (processType !== 'yarn') {
              return {
                ...p,
                isActive: true,
                batches: (p.batches && p.batches.length > 0)
                  ? p.batches
                  : [makeAutoBatch(processType, prev.quantityYd, '')],
              };
            }
            return { ...p, isActive: true };
          }
          if (!active && p.isActive) {
            // 비활성화: batches/yarnOrders 비움 + 일정 초기화 (undefined 대신 [])
            return {
              ...p,
              isActive: false,
              batches: [],
              yarnOrders: [],
              startDate: '',
              durationDays: 0,
            };
          }
          return p;
        }),
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

  // v3: 공정 시작일/소요일수 변경 — 종료일은 utils에서 자동 계산
  // field: 'startDate' | 'durationDays'
  // batch의 plannedStartDate/plannedEndDate는 화면에서 enrich 시 effectiveStart/End로 표시
  const updateProcessSchedule = (processType, field, value) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        const v = field === 'durationDays' ? (Number(value) || 0) : value;
        const next = { ...p, [field]: v };
        // 1차 batch에도 startDate/durationDays 반영 위해 batches 기록은 enrich 단계에서 처리
        // 단, batch 자체의 plannedStartDate/plannedEndDate는 사용자가 직접 수정 가능 → 여기선 동기화 안 함
        return next;
      }),
    }));
  };

  // ---------- 차수/원사 발주 (1단계 호환 유지, 상세 페이지에서 사용 예정) ----------
  const addBatch = (processType) => {
    setOrderInput(prev => ({
      ...prev,
      processes: (prev.processes || []).map(p => {
        if (p.processType !== processType) return p;
        const nextNum = (p.batches || []).length + 1;
        const newBatch = {
          ...makeAutoBatch(processType, 0, p.dueDate),
          id: `batch_${processType}_${Date.now()}_${nextNum}`,
          batchNumber: nextNum,
        };
        return { ...p, batches: [...(p.batches || []), newBatch] };
      }),
    }));
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

  // ---------- 원사 발주 (1단계 호환 유지) ----------
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
          useKnitterStock: false,  // v3
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
            return {
              ...yo,
              deliveries: [...(yo.deliveries || []), {
                id: `dv_${yoId}_${Date.now()}_${nextNum}`,
                deliveryNumber: nextNum,
                quantity: 0,
                plannedArrivalDate: '',
                expectedArrivalDate: '',
                actualArrivalDate: '',
                status: '발주대기',
              }],
            };
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

  // ---------- 원단 연결 (v2: articleNo, gsm, widthFull도 자동 채움) ----------
  const applyFabricTemplate = (fabric, yarnLibrary = []) => {
    if (!fabric) {
      showToast('원단 정보를 불러올 수 없습니다.', 'error');
      return;
    }

    setOrderInput(prev => {
      const next = { ...prev };

      // 1. ART (article) 자동 채움 (오버라이드)
      next.articleNo = fabric.article || '';

      // 2. gsm/widthFull 자동 채움 → KG 재환산
      next.gsm = Number(fabric.gsm) || 0;
      next.widthFull = Number(fabric.widthFull) || 0;
      next.quantityKg = calcKgFromYd(prev.quantityYd, next.gsm, next.widthFull);

      // 3. 원단 연결 정보 기록
      next.linkedFabricId = fabric.id;
      next.linkedFabricArticle = fabric.article || '';

      // 4. 원사 공정 yarnOrders 자동 채움
      const yarnProcess = (next.processes || []).find(p => p.processType === 'yarn');

      if (!yarnProcess || !yarnProcess.isActive) {
        showToast(`원단 '${fabric.article}' 연결됨. (원사 공정이 비활성 상태라 자동생성 스킵)`, 'info');
        return next;
      }

      const existingCount = (yarnProcess.yarnOrders || []).length;
      if (existingCount > 0) {
        const ok = window.confirm(`기존 원사 발주 ${existingCount}건이 등록되어 있습니다.\n원단 '${fabric.article}'의 원사 구성으로 덮어쓸까요?`);
        if (!ok) {
          showToast('기존 원사 발주 내역이 유지되었습니다.', 'info');
          return next;
        }
      }

      const totalQty = Number(prev.quantityYd) || 0;
      const newYarnOrders = [];

      (fabric.yarns || []).forEach((fy, idx) => {
        if (!fy?.yarnId) return;
        const ratio = Number(fy.ratio) || 0;
        if (ratio <= 0) return;
        const yarnMeta = (yarnLibrary || []).find(y => y.id === fy.yarnId);
        const yarnTypeName = yarnMeta?.name || '';
        const qty = Math.round((totalQty * ratio / 100) * 100) / 100;
        newYarnOrders.push({
          id: `yo_${Date.now()}_${idx}`,
          yarnTypeId: fy.yarnId,
          yarnTypeName,
          color: null,
          totalQuantity: qty,
          supplier: '',
          deliveries: [],
          ratio,
          useKnitterStock: false,  // v3: 사종별 편직처 보유 원사 토글 (기본 false=발주 진행)
        });
      });

      next.processes = (next.processes || []).map(p =>
        p.processType === 'yarn' ? { ...p, yarnOrders: newYarnOrders } : p
      );

      if (newYarnOrders.length === 0) {
        showToast(`원단 '${fabric.article}' 연결됨. (원사 구성 비어있음)`, 'info');
      } else {
        showToast(`원단 '${fabric.article}' 연결 완료 (원사 발주 ${newYarnOrders.length}건 자동생성)`, 'success');
      }
      return next;
    });
  };

  const detachFabric = () => {
    setOrderInput(prev => ({
      ...prev,
      linkedFabricId: null,
      linkedFabricArticle: '',
    }));
    showToast('원단 연결이 해제되었습니다. 원사 발주를 자유롭게 수정할 수 있습니다.', 'info');
  };

  // ---------- 폼 리셋 ----------
  const resetOrderForm = () => {
    const fresh = getInitialOrderInput();
    fresh.processes = buildInitialProcesses(fresh.type, fresh.startStage);
    setOrderInput(fresh);
    setEditingOrderId(null);
  };

  // ---------- 저장 ----------
  const handleSaveOrder = async (user) => {
    const now = new Date().toISOString();
    const isNew = !editingOrderId;

    // 필수 검증
    if (!orderInput.orderNumber?.trim()) {
      showToast('오더(자체번호)를 입력해주세요.', 'error');
      return false;
    }
    if (!orderInput.customer?.trim()) {
      showToast('거래처를 선택해주세요.', 'error');
      return false;
    }
    if (!(Number(orderInput.quantityYd) > 0)) {
      showToast('수량(YD)은 0보다 커야 합니다.', 'error');
      return false;
    }
    if (!orderInput.finalDueDate) {
      showToast('최종 납기일을 입력해주세요.', 'error');
      return false;
    }

    // 오더번호 중복 검증
    if (isNew) {
      const dup = (orders || []).some(o => o.orderNumber === orderInput.orderNumber);
      if (dup) {
        showToast(`오더번호 '${orderInput.orderNumber}'는 이미 사용 중입니다.`, 'error');
        return false;
      }
    }

    // v4: 담당자 스냅샷 폐기

    // 예상납기 계산
    const estimatedDueDate = calcEstimatedDueDate(orderInput) || '';

    // 납기 초과 위험 자동 상태
    let finalStatus = orderInput.status || 'active';
    if (isNew && estimatedDueDate && orderInput.finalDueDate) {
      if (estimatedDueDate > orderInput.finalDueDate) {
        finalStatus = 'delayed_risk';
      }
    }

    const existing = isNew ? null : (orders || []).find(o => o.id === editingOrderId);

    let itemToSave = {
      ...orderInput,
      id: isNew ? orderInput.orderNumber : editingOrderId,
      estimatedDueDate,
      status: finalStatus,
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now,
    };

    // 감사 로그 기록
    if (isNew) {
      itemToSave = appendChangeLog(
        itemToSave,
        makeChangeLogEntry(user?.email, 'order_create', `오더 등록 (${orderInput.orderNumber})`)
      );
    } else if (existing) {
      const diffResult = summarizeOrderDiff(existing, itemToSave);
      if (diffResult) {
        itemToSave = appendChangeLog(
          itemToSave,
          makeChangeLogEntry(user?.email, 'order_update', diffResult.summary, diffResult.diff)
        );
      }
    }

    await saveDocToCloud('orders', itemToSave);
    showToast(isNew ? `오더 '${orderInput.orderNumber}' 등록 완료` : '오더 수정 완료', 'success');
    resetOrderForm();
    return true;
  };

  // ---------- 편집/삭제 ----------
  // v4: 오더 전체 편집 (등록 마법사 재사용)
  // - order 데이터를 deep clone해서 orderInput에 설정
  // - editingOrderId 설정 → handleSaveOrder가 isNew=false 분기 처리
  // - 기존 batches/yarnOrders의 actual* 값들은 보존됨 (deep clone 그대로)
  const handleEditOrder = (order) => {
    if (!order) return;
    const cloned = JSON.parse(JSON.stringify(order));
    // processes 배열에 v4에서 폐기된 필드 등 잔존 데이터가 있어도 그대로 두되,
    // UI에서 참조 안 하므로 무해함
    setOrderInput(cloned);
    setEditingOrderId(order.id);
    showToast(`오더 '${order.orderNumber}' 편집 모드로 전환되었습니다.`, 'info');
  };

  const handleDeleteOrder = async (id) => {
    const order = (orders || []).find(o => o.id === id);
    if (!order) return;
    if (order.status === 'active') {
      if (!window.confirm(`진행중 오더 '${order.orderNumber}'를 삭제하시겠습니까?`)) return;
    } else {
      if (!window.confirm(`'${order.orderNumber}' 오더를 삭제하시겠습니까?`)) return;
    }
    try {
      await deleteDocFromCloud('orders', id);
      showToast('삭제되었습니다.', 'success');
    } catch {
      // showToast 내부에서 처리됨
    }
  };

  return {
    // state
    orderInput, setOrderInput,
    editingOrderId, setEditingOrderId,
    selectedOrderId, setSelectedOrderId,

    // input handlers
    handleOrderChange,
    setOrderType,

    // colors
    addColor, removeColor, updateColor,

    // processes
    toggleProcess, updateProcessField, updateProcessSchedule,
    isProcessLocked,

    // batches (1단계 호환)
    addBatch, removeBatch, updateBatchField, updateBatchColors,

    // yarn orders (사종별 편직처 토글 추가)
    addYarnOrder, removeYarnOrder, updateYarnOrder,
    toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
    addDelivery, removeDelivery, updateDelivery,

    // crud
    handleSaveOrder, handleEditOrder, handleDeleteOrder,
    resetOrderForm,

    // fabric template
    applyFabricTemplate, detachFabric,
  };
};
