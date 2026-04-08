import { useState } from 'react';

// GRUBIG ERP - 가설계서(Temp Design Sheet) 독립 도메인 훅
// ⚠️ 기존 useDesignSheet.js는 수정하지 않음 (사이드이펙트 차단)
// Firestore 컬렉션: tempDesignSheets (designSheets와 완전 분리)

export const useTempDesignSheet = (tempDesignSheets, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost) => {
  const [editingTempId, setEditingTempId] = useState(null);

  // 가설계서 초기 입력 폼 (정식 설계서 기반, 추적 필드 제거 + buyerName 추가)
  const getInitialTempInput = () => ({
    // === 가설계서 전용 식별자 ===
    buyerName: '',       // 가설계서 전용 바이어명 (정식에서는 의뢰 참조)
    fabricName: '',      // 원단명

    // (1) 원사 정보 (기존 설계서와 동일 구조)
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

  const [tempInput, setTempInput] = useState(getInitialTempInput);

  // --- 필드 변경 핸들러들 (useDesignSheet와 동일 패턴) ---

  // 최상위 필드 변경
  const handleTempChange = (e) => {
    const { name, value } = e.target;
    setTempInput(prev => ({ ...prev, [name]: value }));
  };

  // 중첩 섹션 필드 변경 (knitting.factory 등)
  const handleTempSectionChange = (section, field, value) => {
    setTempInput(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // 원사 슬롯 변경
  const handleTempYarnChange = (index, field, value) => {
    const newYarns = [...tempInput.yarns];
    newYarns[index] = {
      ...newYarns[index],
      [field]: field === 'ratio' ? Number(value) : String(value || '')
    };
    setTempInput(prev => ({ ...prev, yarns: newYarns }));
  };

  // Cost 입력 필드 변경
  const handleTempCostInputChange = (e) => {
    const { name, value } = e.target;
    // brandExtra_tier1k → costInput.brandExtra.tier1k
    if (name.startsWith('brandExtra_')) {
      const tier = name.split('_')[1];
      setTempInput(prev => ({
        ...prev,
        costInput: {
          ...prev.costInput,
          brandExtra: { ...(prev.costInput?.brandExtra || {}), [tier]: Number(value) }
        }
      }));
      return;
    }
    setTempInput(prev => ({
      ...prev,
      costInput: {
        ...prev.costInput,
        [name]: (name === 'costGYd') ? value : Number(value)
      }
    }));
  };

  // Cost 중첩 필드(losses, brandExtra) 변경
  const handleTempCostNestedChange = (section, tier, field, value) => {
    setTempInput(prev => ({
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

  // 폼 리셋
  const resetTempForm = () => {
    setTempInput(getInitialTempInput());
    setEditingTempId(null);
  };

  // --- CRUD ---

  // 저장 (새로 생성 or 수정)
  const handleSaveTemp = (user) => {
    const finalInput = { ...tempInput };

    // [방어] 원단명 필수 입력 검증
    if (!finalInput.fabricName?.trim()) {
      showToast('원단명(Name)을 반드시 입력해주세요.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const isNew = !editingTempId;

    const itemToSave = {
      ...finalInput,
      id: editingTempId || `tds_${Date.now()}`,
      createdBy: isNew ? (user?.email || '') : (tempDesignSheets?.find(s => s.id === editingTempId)?.createdBy || ''),
      createdAt: isNew ? now : (tempDesignSheets?.find(s => s.id === editingTempId)?.createdAt || now),
      updatedAt: now
    };

    // Firestore의 tempDesignSheets 컬렉션에 저장
    saveDocToCloud('tempDesignSheets', itemToSave);
    resetTempForm();
    showToast(isNew ? '가설계서가 저장되었습니다.' : '가설계서가 수정되었습니다.', 'success');
    return itemToSave.id;
  };

  // 수정 모드 진입
  const handleEditTemp = (tempSheet) => {
    const initial = getInitialTempInput();
    setTempInput({
      ...initial,
      ...tempSheet,
      knitting: { ...initial.knitting, ...(tempSheet.knitting || {}) },
      dyeing: { ...initial.dyeing, ...(tempSheet.dyeing || {}) },
      finishing: { ...initial.finishing, ...(tempSheet.finishing || {}) },
      costInput: {
        ...initial.costInput,
        ...(tempSheet.costInput || {}),
        losses: {
          tier1k: { ...initial.costInput.losses.tier1k, ...(tempSheet.costInput?.losses?.tier1k || {}) },
          tier3k: { ...initial.costInput.losses.tier3k, ...(tempSheet.costInput?.losses?.tier3k || {}) },
          tier5k: { ...initial.costInput.losses.tier5k, ...(tempSheet.costInput?.losses?.tier5k || {}) }
        },
        brandExtra: { ...initial.costInput.brandExtra, ...(tempSheet.costInput?.brandExtra || {}) }
      },
      yarns: tempSheet.yarns || initial.yarns
    });
    setEditingTempId(tempSheet.id);
  };

  // 삭제 — deleteDocFromCloud 내부에서 에러 토스트를 이미 처리하므로,
  // 성공 시에만 별도 토스트 표시 (BUG-1 수정)
  const handleDeleteTemp = async (id) => {
    if (!window.confirm('이 가설계서를 삭제하시겠습니까?\n(삭제된 가설계서는 복구할 수 없습니다.)')) return;
    try {
      await deleteDocFromCloud('tempDesignSheets', id);
      showToast('가설계서가 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  // --- Cost 연동 ---
  const getTempDesignCost = (tempSheet) => {
    if (!tempSheet || !calculateCost) return null;
    const fabricData = {
      ...(tempSheet.costInput || {}),
      yarns: tempSheet.yarns || []
    };
    return calculateCost(fabricData);
  };

  // --- 가설계서 → 정식 설계서로 불러오기 유틸 ---
  // 이 함수는 정식 설계서의 setSheetInput에 스펙(레시피)만 덮어씌움
  // 관리번호(devOrderNo, articleNo 등)는 절대 건드리지 않음
  const loadTempToSheet = (tempSheet, setSheetInput) => {
    if (!tempSheet || !setSheetInput) return;

    if (!window.confirm('가설계서의 스펙 데이터를 현재 설계서에 불러옵니다.\n기존 입력된 스펙 데이터가 덮어씌워집니다. 계속하시겠습니까?')) {
      return false;
    }

    setSheetInput(prev => {
      // [REF-1] marginTier는 바이어별로 달라질 수 있는 핵심 마진 설정이므로
      // 가설계서 값으로 덮어쓰지 않고, 정식 설계서의 기존값을 보존
      const prevMarginTier = prev.costInput?.marginTier;
      const tempCost = { ...(tempSheet.costInput || {}) };
      delete tempCost.marginTier; // 가설계서의 marginTier는 무시

      return {
        ...prev,
        // 스펙 데이터만 덮어쓰기 (관리번호·연결정보는 유지)
        fabricName: tempSheet.fabricName || prev.fabricName,
        yarns: tempSheet.yarns || prev.yarns,
        knitting: { ...(prev.knitting || {}), ...(tempSheet.knitting || {}) },
        dyeing: { ...(prev.dyeing || {}), ...(tempSheet.dyeing || {}) },
        finishing: { ...(prev.finishing || {}), ...(tempSheet.finishing || {}) },
        costInput: {
          ...(prev.costInput || {}),
          ...tempCost,
          marginTier: prevMarginTier ?? prev.costInput?.marginTier ?? 3,
          losses: {
            tier1k: { ...(prev.costInput?.losses?.tier1k || {}), ...(tempSheet.costInput?.losses?.tier1k || {}) },
            tier3k: { ...(prev.costInput?.losses?.tier3k || {}), ...(tempSheet.costInput?.losses?.tier3k || {}) },
            tier5k: { ...(prev.costInput?.losses?.tier5k || {}), ...(tempSheet.costInput?.losses?.tier5k || {}) }
          },
          brandExtra: { ...(prev.costInput?.brandExtra || {}), ...(tempSheet.costInput?.brandExtra || {}) }
        }
      };
    });

    showToast(`가설계서 "${tempSheet.fabricName || ''}" 스펙이 불러와졌습니다.`, 'success');
    return true;
  };

  return {
    tempInput, setTempInput,
    editingTempId,
    handleTempChange, handleTempSectionChange,
    handleTempYarnChange, handleTempCostInputChange, handleTempCostNestedChange,
    handleSaveTemp, handleEditTemp, handleDeleteTemp,
    resetTempForm, getTempDesignCost, loadTempToSheet
  };
};
