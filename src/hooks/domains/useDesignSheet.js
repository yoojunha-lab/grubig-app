import { useState } from 'react';
import { DESIGN_STAGES } from '../../constants/common';

// GRUBIG ERP - 원단 설계서 도메인 로직 훅

export const useDesignSheet = (designSheets, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate, saveFabricFromSheet) => {
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
    status: 'active',        // active | dropped
    devRequestId: null,      // 연결된 개발의뢰 ID
    deadline: '',            // 납기 (설계서 전체 납기 관리)

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
        [field]: value
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

  // 다음 단계로 진행 (draft → eztex → sampling → articled)
  const advanceStage = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const currentIdx = getStageIndex(sheet.stage);
    if (currentIdx >= DESIGN_STAGES.length - 1) {
      showToast('이미 최종 단계(아이템화)입니다.', 'error');
      return;
    }

    const nextStage = DESIGN_STAGES[currentIdx + 1].key;

    // EZ-TEX 단계 진입 시 eztexOrderNo 확인 불필요 (등록 대기 단계이므로)

    // 아이템화 단계 진입 시 articleNo 확인
    if (nextStage === 'articled' && !sheet.articleNo) {
      showToast('Article 번호를 먼저 입력해주세요.', 'error');
      return;
    }

    const updatedSheet = {
      ...sheet,
      stage: nextStage,
      updatedAt: new Date().toISOString()
    };

    saveDocToCloud('designSheets', updatedSheet);
    showToast(`'${DESIGN_STAGES[currentIdx + 1].label}' 단계로 진행되었습니다.`, 'success');

    // 아이템화 완료 시 → 원단 자동 등록
    if (nextStage === 'articled' && saveFabricFromSheet) {
      registerFabricFromSheet(updatedSheet);
    }
  };

  // EZ-TEX O/D NO. 입력 시 자동으로 sampling으로 진행
  const autoAdvanceEztex = (sheetId, eztexOrderNo) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (sheet.stage !== 'eztex') return; // eztex 단계에서만 작동
    if (!eztexOrderNo?.trim()) return;

    const updatedSheet = {
      ...sheet,
      eztexOrderNo: eztexOrderNo.trim(),
      stage: 'sampling',
      updatedAt: new Date().toISOString()
    };
    saveDocToCloud('designSheets', updatedSheet);
    showToast(`EZ-TEX O/D NO. 등록 완료 → '샘플 진행' 단계로 자동 진행되었습니다.`, 'success');
  };

  // 개발투입확정 시 설계서를 draft → eztex로 자동 전환
  const advanceToEztex = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (sheet.stage !== 'draft') return; // draft에서만 작동
    saveDocToCloud('designSheets', {
      ...sheet,
      stage: 'eztex',
      updatedAt: new Date().toISOString()
    });
  };

  // --- CRUD ---

  // 저장 (새로 생성 or 수정)
  // onLinkToDevRequest: (devReqId, sheetId) => void — 설계서 저장 시 의뢰에 자동 연결
  // generateSelfNo: () => string — 자체 설계서 번호 생성 (external)
  const handleSaveSheet = (user, onLinkToDevRequest, generateSelfNo) => {
    // 자체 설계서인 경우 번호 자동 채번 (비동기 setState 문제 해결: 저장 시점에 직접 세팅)
    let finalInput = { ...sheetInput };
    if (!finalInput.devOrderNo && !finalInput.devRequestId && generateSelfNo) {
      finalInput.devOrderNo = generateSelfNo();
    }

    if (!finalInput.devOrderNo) {
      showToast('개발 오더넘버를 입력해주세요.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const isNew = !editingSheetId;
    const existing = isNew ? null : designSheets.find(s => s.id === editingSheetId);

    const itemToSave = {
      ...finalInput,
      id: editingSheetId || `ds_${Date.now()}`,
      status: finalInput.status || 'active',
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now
    };

    saveDocToCloud('designSheets', itemToSave);

    // 의뢰 연결: devRequestId가 있으면 의뢰에 설계서 ID를 기록
    if (itemToSave.devRequestId && onLinkToDevRequest) {
      onLinkToDevRequest(itemToSave.devRequestId, itemToSave.id);
    }

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
      stage: 'articled',           // 개선본은 진행단계 없이 바로 아이템화 상태
      status: 'active',
      orderNumbers: [],
      articleNo: '',               // 새 Article 번호는 보관함에서 직접 입력
      createdBy: user?.email || '',
      createdAt: now,
      updatedAt: now
    };

    saveDocToCloud('designSheets', newSheet);
    showToast(`v${newSheet.version} 개선본이 생성되었습니다. (보관함에서 Article 번호를 입력해주세요)`, 'success');
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

  // 개발 의뢰에서 설계서로 연동 시 초기값 세팅 (buyerName 제거 — 의뢰에서 참조)
  const initFromDevRequest = (devData) => {
    const initial = getInitialSheetInput();
    setSheetInput({
      ...initial,
      devOrderNo: devData.devOrderNo || '',
      devRequestId: devData.devRequestId || null,
      deadline: devData.sampleDeadline || ''  // 샘플 생산 납기 자동 연동
    });
    setEditingSheetId(null);
  };

  // 자체 설계서 번호 생성 (S-26D001 형식)
  const generateSelfDevOrderNo = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `S-${year}D`;
    const existingNos = (designSheets || [])
      .map(d => d.devOrderNo || '')
      .filter(no => no.startsWith(prefix))
      .map(no => { const n = parseInt(no.replace(prefix, ''), 10); return isNaN(n) ? 0 : n; });
    const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  // 아이템화 시 원단 자동 등록 (savedFabrics에 변환 저장)
  const registerFabricFromSheet = (sheet) => {
    if (!saveFabricFromSheet) return;
    const fabricData = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      article: sheet.articleNo || '',
      itemName: sheet.fabricName || '',
      // costInput 필드를 원단등록 필드와 매핑
      widthFull: sheet.costInput?.widthFull || 58,
      widthCut: sheet.costInput?.widthCut || 56,
      gsm: sheet.costInput?.gsm || 300,
      costGYd: sheet.costInput?.costGYd || '',
      knittingFee1k: sheet.costInput?.knittingFee1k || 3000,
      knittingFee3k: sheet.costInput?.knittingFee3k || 2000,
      knittingFee5k: sheet.costInput?.knittingFee5k || 2000,
      dyeingFee: sheet.costInput?.dyeingFee || 8800,
      extraFee1k: sheet.costInput?.extraFee1k || 900,
      extraFee3k: sheet.costInput?.extraFee3k || 700,
      extraFee5k: sheet.costInput?.extraFee5k || 500,
      losses: sheet.costInput?.losses || { tier1k:{knit:5,dye:10}, tier3k:{knit:3,dye:10}, tier5k:{knit:3,dye:9} },
      marginTier: sheet.costInput?.marginTier || 3,
      brandExtra: sheet.costInput?.brandExtra || { tier1k:1000, tier3k:700, tier5k:500 },
      yarns: sheet.yarns || [],
      remarks: `설계서 아이템화 자동 등록 (${sheet.devOrderNo || ''})`
    };
    saveFabricFromSheet(fabricData);
    showToast(`Article ${sheet.articleNo} 원단이 자동 등록되었습니다.`, 'success');
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
    autoAdvanceEztex, advanceToEztex,
    createImprovedVersion, addOrderNumber, removeOrderNumber,
    getDesignCost, initFromDevRequest, dropDesignSheet,
    generateSelfDevOrderNo, registerFabricFromSheet
  };
};
