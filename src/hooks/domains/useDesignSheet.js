import { useState } from 'react';
import { DESIGN_STAGES } from '../../constants/common';

// GRUBIG ERP - 원단 설계서 도메인 로직 훅

export const useDesignSheet = (designSheets, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate) => {
  const [editingSheetId, setEditingSheetId] = useState(null);

  // 설계서 초기 입력 폼
  const getInitialSheetInput = () => ({
    devOrderNo: '',
    eztexOrderNo: '',
    articleNo: '',
    fabricName: '',       // 원단명
    orderNumbers: [],
    version: 1,
    parentId: null,
    stage: 'draft',
    assignee: '',
    buyerName: '',

    // (1) 원사 정보 (기존 원사 라이브러리 연동)
    yarns: [
      { yarnId: '', ratio: 100 },
      { yarnId: '', ratio: 0 },
      { yarnId: '', ratio: 0 },
      { yarnId: '', ratio: 0 }
    ],

    // (2) 편직 정보
    knitting: {
      factory: '',
      structure: '',
      machineType: '',
      gauge: '',
      machineInch: '',
      needleCount: '',
      hasOpenWidth: false,
      isOpenWidth: false,
      feederCount: '',
      structureDiagram: '',
      remarks: ''
    },

    // (3) 염가공 정보
    dyeing: {
      factory: '',
      dyedWidth: '',
      tenterWidth: '',
      tenterTemp: '',
      fabricSpeed: '',
      overFeeder: '',
      processMethod: '',
      remarks: ''
    },

    // (4) 후가공 정보
    finishing: {
      factory: '',
      type: '',
      method: '',
      remarks: ''
    },

    // 실측 데이터 (EZ-TEX 등록 이후)
    actualData: {
      greigeWeight: '',
      loopLength: '',
      finishedWidth: '',
      finishedWeight: '',
      remarks: ''
    },

    // Cost 연동용 (기존 fabricInput 호환 구조)
    costInput: {
      widthFull: 58,
      widthCut: 56,
      gsm: 300,
      costGYd: '',
      knittingFee1k: 3000,
      knittingFee3k: 2000,
      knittingFee5k: 2000,
      dyeingFee: 8800,
      extraFee1k: 900,
      extraFee3k: 700,
      extraFee5k: 500,
      losses: {
        tier1k: { knit: 5, dye: 10 },
        tier3k: { knit: 3, dye: 10 },
        tier5k: { knit: 3, dye: 9 }
      },
      marginTier: 3,
      brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 }
    }
  });

  const [sheetInput, setSheetInput] = useState(getInitialSheetInput);

  // --- 필드 변경 핸들러들 ---

  // 최상위 필드 변경
  const handleSheetChange = (e) => {
    const { name, value } = e.target;
    setSheetInput(prev => ({ ...prev, [name]: value }));
  };

  // 중첩 섹션 필드 변경 (knitting.factory 등)
  const handleSectionChange = (section, field, value) => {
    setSheetInput(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: typeof prev[section]?.[field] === 'boolean' ? value : value
      }
    }));
  };

  // 원사 슬롯 변경 (기존 useFabric 패턴과 동일)
  const handleSheetYarnChange = (index, field, value) => {
    const newYarns = [...sheetInput.yarns];
    newYarns[index] = {
      ...newYarns[index],
      [field]: field === 'ratio' ? Number(value) : String(value || '')
    };
    setSheetInput(prev => ({ ...prev, yarns: newYarns }));
  };

  // Cost 입력 필드 변경
  const handleCostInputChange = (e) => {
    const { name, value } = e.target;
    setSheetInput(prev => ({
      ...prev,
      costInput: {
        ...prev.costInput,
        [name]: (name === 'costGYd') ? value : Number(value)
      }
    }));
  };

  // Cost 중첩 필드(losses, brandExtra) 변경
  const handleCostNestedChange = (section, tier, field, value) => {
    setSheetInput(prev => ({
      ...prev,
      costInput: {
        ...prev.costInput,
        [section]: {
          ...prev.costInput[section],
          [tier]: field
            ? { ...prev.costInput[section][tier], [field]: Number(value) }
            : Number(value)
        }
      }
    }));
  };

  // 실측 데이터 변경
  const handleActualDataChange = (field, value) => {
    setSheetInput(prev => ({
      ...prev,
      actualData: { ...prev.actualData, [field]: value }
    }));
  };

  // 폼 리셋
  const resetSheetForm = () => {
    setSheetInput(getInitialSheetInput());
    setEditingSheetId(null);
  };

  // --- 진행 단계 관리 ---

  // 현재 단계의 인덱스 구하기
  const getStageIndex = (stageKey) => {
    return DESIGN_STAGES.findIndex(s => s.key === stageKey);
  };

  // 다음 단계로 진행
  const advanceStage = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const currentIdx = getStageIndex(sheet.stage);
    if (currentIdx >= DESIGN_STAGES.length - 1) {
      showToast('이미 최종 단계(아이템화)입니다.', 'error');
      return;
    }

    const nextStage = DESIGN_STAGES[currentIdx + 1].key;

    // EZ-TEX 단계 진입 시 eztexOrderNo 확인
    if (nextStage === 'eztex' && !sheet.eztexOrderNo) {
      showToast('EZ-TEX 오더넘버를 먼저 입력해주세요.', 'error');
      return;
    }

    // 아이템화 단계 진입 시 articleNo 확인
    if (nextStage === 'articled' && !sheet.articleNo) {
      showToast('아티클 번호를 먼저 입력해주세요.', 'error');
      return;
    }

    const updatedSheet = {
      ...sheet,
      stage: nextStage,
      updatedAt: new Date().toISOString()
    };

    saveDocToCloud('designSheets', updatedSheet);
    showToast(`'${DESIGN_STAGES[currentIdx + 1].label}' 단계로 진행되었습니다.`, 'success');
  };

  // --- CRUD ---

  // 저장 (새로 생성 or 수정)
  const handleSaveSheet = (user) => {
    if (!sheetInput.devOrderNo) {
      showToast('개발 오더넘버를 입력해주세요.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const isNew = !editingSheetId;

    const existing = isNew ? null : designSheets.find(s => s.id === editingSheetId);

    const itemToSave = {
      ...sheetInput,
      id: editingSheetId || `ds_${Date.now()}`,
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now
    };

    saveDocToCloud('designSheets', itemToSave);
    resetSheetForm();
    showToast(isNew ? '설계서가 저장되었습니다.' : '설계서가 수정되었습니다.', 'success');
    return itemToSave.id;
  };

  // 수정 모드 진입
  const handleEditSheet = (sheet) => {
    const initial = getInitialSheetInput();
    setSheetInput({
      ...initial,
      ...sheet,
      knitting: { ...initial.knitting, ...(sheet.knitting || {}) },
      dyeing: { ...initial.dyeing, ...(sheet.dyeing || {}) },
      finishing: { ...initial.finishing, ...(sheet.finishing || {}) },
      actualData: { ...initial.actualData, ...(sheet.actualData || {}) },
      costInput: {
        ...initial.costInput,
        ...(sheet.costInput || {}),
        losses: {
          tier1k: { ...initial.costInput.losses.tier1k, ...(sheet.costInput?.losses?.tier1k || {}) },
          tier3k: { ...initial.costInput.losses.tier3k, ...(sheet.costInput?.losses?.tier3k || {}) },
          tier5k: { ...initial.costInput.losses.tier5k, ...(sheet.costInput?.losses?.tier5k || {}) }
        },
        brandExtra: { ...initial.costInput.brandExtra, ...(sheet.costInput?.brandExtra || {}) }
      },
      yarns: sheet.yarns || initial.yarns,
      orderNumbers: sheet.orderNumbers || []
    });
    setEditingSheetId(sheet.id);
  };

  // 삭제
  const handleDeleteSheet = (id) => {
    if (window.confirm('정말로 이 설계서를 삭제하시겠습니까? (삭제된 설계서는 복구할 수 없습니다.)')) {
      deleteDocFromCloud('designSheets', id).then(() => {
        showToast('설계서가 삭제되었습니다.', 'success');
      });
    }
  };

  // --- 버전(개선) 관리 ---

  // 개선본 생성: 기존 설계서를 복제하고 version +1, parentId 연결
  const createImprovedVersion = (originalSheet, user) => {
    // 아이템 등록된 설계서만 개선본 생성 가능
    if (originalSheet.stage !== 'articled') {
      showToast('아이템 등록된 설계서만 개선본을 생성할 수 있습니다.', 'error');
      return null;
    }
    // 같은 parentId(또는 원본 id)를 가진 설계서들 중 최대 버전을 찾음
    const rootId = originalSheet.parentId || originalSheet.id;
    const siblings = designSheets.filter(s =>
      s.id === rootId || s.parentId === rootId
    );
    const maxVersion = Math.max(...siblings.map(s => s.version || 1), 0);

    const now = new Date().toISOString();
    const newSheet = {
      ...originalSheet,
      id: `ds_${Date.now()}`,
      version: maxVersion + 1,
      parentId: rootId,
      stage: 'draft',
      orderNumbers: [],
      createdBy: user?.email || '',
      createdAt: now,
      updatedAt: now
    };

    saveDocToCloud('designSheets', newSheet);
    showToast(`v${newSheet.version} 개선본이 생성되었습니다.`, 'success');
    return newSheet;
  };

  // --- 오더넘버(O/N) 연결 ---

  const addOrderNumber = (sheetId, orderNumber) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const trimmed = String(orderNumber).trim().toUpperCase();
    if (!trimmed) {
      showToast('오더넘버를 입력해주세요.', 'error');
      return;
    }

    const existing = sheet.orderNumbers || [];
    if (existing.includes(trimmed)) {
      showToast('이미 연결된 오더넘버입니다.', 'error');
      return;
    }

    const updatedSheet = {
      ...sheet,
      orderNumbers: [...existing, trimmed],
      updatedAt: new Date().toISOString()
    };

    saveDocToCloud('designSheets', updatedSheet);
    showToast(`오더 ${trimmed}가 연결되었습니다.`, 'success');
  };

  const removeOrderNumber = (sheetId, orderNumber) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const updatedSheet = {
      ...sheet,
      orderNumbers: (sheet.orderNumbers || []).filter(o => o !== orderNumber),
      updatedAt: new Date().toISOString()
    };

    saveDocToCloud('designSheets', updatedSheet);
    showToast(`오더 ${orderNumber} 연결이 해제되었습니다.`, 'success');
  };

  // --- Cost 연동 ---
  // 설계서의 costInput + yarns 데이터를 기존 calculateCost에 전달
  const getDesignCost = (sheet) => {
    if (!sheet || !calculateCost) return null;
    const fabricData = {
      ...(sheet.costInput || {}),
      yarns: sheet.yarns || []
    };
    return calculateCost(fabricData);
  };

  // 개발 의뢰에서 설계서로 연동 시 초기값 세팅
  const initFromDevRequest = (devData) => {
    const initial = getInitialSheetInput();
    setSheetInput({
      ...initial,
      devOrderNo: devData.devOrderNo || '',
      buyerName: devData.buyerName || '',
      devRequestId: devData.devRequestId || null  // 어떤 개발의뢰와 연결되었는지 추적
    });
    setEditingSheetId(null);
  };

  // DROP 처리 (설계서를 보관함으로 이동, 현황에서 숨김)
  const dropDesignSheet = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (!window.confirm('이 설계서를 DROP 처리하시겠습니까?\n(보관함으로 이동되며 현황에서 숨겨집니다)')) return;
    saveDocToCloud('designSheets', {
      ...sheet,
      status: 'dropped',
      updatedAt: new Date().toISOString()
    });
    showToast('DROP 처리되었습니다.', 'success');
  };

  return {
    sheetInput, setSheetInput,
    editingSheetId,
    handleSheetChange, handleSectionChange,
    handleSheetYarnChange, handleCostInputChange, handleCostNestedChange,
    handleActualDataChange,
    handleSaveSheet, handleEditSheet, handleDeleteSheet,
    resetSheetForm, getStageIndex, advanceStage,
    createImprovedVersion, addOrderNumber, removeOrderNumber,
    getDesignCost, initFromDevRequest, dropDesignSheet
  };
};
