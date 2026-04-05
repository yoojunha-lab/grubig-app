import { useState } from 'react';
import { DESIGN_STAGES } from '../../constants/common';

// GRUBIG ERP - 원단 설계서 도메인 로직 훅

export const useDesignSheet = (designSheets, savedFabrics, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate, saveFabricFromSheet, devRequests) => {
  const [editingSheetId, setEditingSheetId] = useState(null);

  // 설계서 초기 입력 폼
  const getInitialSheetInput = () => ({
    devOrderNo: '',
    eztexOrderNo: '',
    articleNo: '',
    fabricName: '',       // 원단명
    orderNumbers: [],
    stage: 'draft',
    changeHistory: [],       // 변경 이력 [{date, fields:{필드: 이전값}, reason}]
    changeReason: '',        // 변경사유 (저장 시 이력에 기록 후 제거)
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

  // Cost 입력 필드 변경 (brandExtra_tier1k 같은 네스트 키도 처리)
  const handleCostInputChange = (e) => {
    const { name, value } = e.target;
    // brandExtra_tier1k → costInput.brandExtra.tier1k
    if (name.startsWith('brandExtra_')) {
      const tier = name.split('_')[1];
      setSheetInput(prev => ({
        ...prev,
        costInput: {
          ...prev.costInput,
          brandExtra: { ...(prev.costInput?.brandExtra || {}), [tier]: Number(value) }
        }
      }));
      return;
    }
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

    // eztex → sampling 진행 시: EZ-TEX O/D NO. 필수 검증
    if (nextStage === 'sampling' && !sheet.eztexOrderNo?.trim()) {
      showToast('EZ-TEX O/D NO.를 먼저 입력해주세요.', 'error');
      return;
    }

    // 아이템화 단계 진입 시 articleNo 확인
    if (nextStage === 'articled' && !sheet.articleNo) {
      showToast('Article 번호를 먼저 입력해주세요.', 'error');
      return;
    }

    // [방어] 아이템화 진입 시 필수 스펙(GSM, 내폭, 외폭) 검증
    if (nextStage === 'articled') {
      const ci = sheet.costInput || {};
      if (!ci.gsm || !ci.widthCut || !ci.widthFull) {
        showToast('아이템화 전에 최종 스펙(GSM, 내폭, 외폭)을 모두 입력해주세요.', 'error');
        return;
      }
    }

    // [A2 방어] 이미 원단이 등록된 설계서는 중복 등록 차단
    if (nextStage === 'articled' && sheet.linkedFabricId) {
      showToast('이미 원단이 등록된 설계서입니다. 중복 등록을 방지합니다.', 'error');
      return;
    }

    const updatedSheet = {
      ...sheet,
      stage: nextStage,
      updatedAt: new Date().toISOString()
    };

    // [Step 2] 아이템화 진입 시: registerFabricFromSheet가 원단 등록 + 설계서 stage 갱신을
    // 한 번의 흐름으로 통합 처리 → advanceStage에서의 이중 Write(Race Condition) 방지
    if (nextStage === 'articled' && saveFabricFromSheet) {
      registerFabricFromSheet(updatedSheet);
      showToast(`'${DESIGN_STAGES[currentIdx + 1].label}' 단계로 진행되었습니다.`, 'success');
      return;
    }

    saveDocToCloud('designSheets', updatedSheet);
    showToast(`'${DESIGN_STAGES[currentIdx + 1].label}' 단계로 진행되었습니다.`, 'success');
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
  const handleSaveSheet = (user, onLinkToDevRequest) => {
    let finalInput = { ...sheetInput };

    // [New] 자체 설계서인 경우 개발오더넘버를 필수값에서 제외
    // 의뢰가 연결된 설계서만 개발번호 필수 입력 검증
    if (finalInput.devRequestId && !finalInput.devOrderNo) {
      showToast('연결된 개발 의뢰의 개발번호(devOrderNo)가 누락되었습니다.', 'error');
      return;
    }

    // [방어] 원단명 필수 입력 검증
    if (!finalInput.fabricName?.trim()) {
      showToast('원단명(Name)을 반드시 입력해주세요.', 'error');
      return;
    }

    // [방어] 수정 모드에서 변경사유 미입력 시 경고 (저장은 허용)
    const isEditing = !!editingSheetId;
    if (isEditing && !finalInput.changeReason?.trim()) {
      if (!window.confirm('설계 변경 사유가 비어있습니다.\n이력 관리를 위해 사유 입력을 권장합니다.\n\n그래도 저장하시겠습니까?')) {
        return;
      }
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

    // === 변경 이력 감지 (수정 모드에서만) ===
    if (!isNew && existing) {
      const changedFields = {};
      // 최상위 필드 비교
      ['fabricName', 'eztexOrderNo', 'articleNo', 'deadline', 'devOrderNo'].forEach(key => {
        if (String(finalInput[key] || '') !== String(existing[key] || '')) {
          changedFields[key] = existing[key] || '';
        }
      });
      // 중첩 섹션 비교 (knitting, dyeing, finishing, actualData)
      ['knitting', 'dyeing', 'finishing', 'actualData'].forEach(section => {
        Object.keys(finalInput[section] || {}).forEach(field => {
          if (field === 'feeders') return; // 배열은 별도 비교 제외
          const newVal = String(finalInput[section]?.[field] || '');
          const oldVal = String(existing[section]?.[field] || '');
          if (newVal !== oldVal) {
            changedFields[`${section}.${field}`] = oldVal;
          }
        });
      });
      // costInput 주요 필드 비교
      ['widthFull', 'widthCut', 'gsm', 'costGYd', 'knittingFee1k', 'knittingFee3k', 'knittingFee5k',
       'dyeingFee', 'extraFee1k', 'extraFee3k', 'extraFee5k', 'marginTier'].forEach(key => {
        if (String(finalInput.costInput?.[key] ?? '') !== String(existing.costInput?.[key] ?? '')) {
          changedFields[`costInput.${key}`] = existing.costInput?.[key] ?? '';
        }
      });
      // 변경사항이 있으면 이력에 추가
      if (Object.keys(changedFields).length > 0) {
        const historyEntry = {
          date: now,
          fields: changedFields,
          reason: finalInput.changeReason || ''
        };
        itemToSave.changeHistory = [
          historyEntry,
          ...(existing.changeHistory || [])
        ];
      }
    }
    // changeReason은 임시 필드이므로 Firebase에 저장하지 않음
    delete itemToSave.changeReason;

    // [Step 2] 샘플링 단계 자동 아이템화(원단 등록) 처리
    let isAutoArticled = false;
    // sampling 상태이고 Article 번호가 입력된 경우 자동으로 articled 로 전환
    if (itemToSave.stage === 'sampling' && String(itemToSave.articleNo || '').trim()) {
      itemToSave.stage = 'articled';
      isAutoArticled = true;
    }

    saveDocToCloud('designSheets', itemToSave);

    // 자동 아이템화 확정 시 원단 등록 트리거
    if (isAutoArticled && saveFabricFromSheet) {
      registerFabricFromSheet(itemToSave);
    }
    // [양방향 동기화] 연결된 원단이 있다면 해당 원단 DB도 같은 값으로 덮어씀
    // [B4 수정] ?? 연산자로 사용자가 의도한 0값을 보존
    if (itemToSave.linkedFabricId) {
      const linkedFabric = savedFabrics?.find(f => String(f.id) === String(itemToSave.linkedFabricId));
      if (linkedFabric) {
        const ci = itemToSave.costInput || {};
        // [Step 3] DB 저장 전 객체 복사 후 임시 플래그 제거 → DB 스키마 오염 방지
        const fabricToSync = {
          ...linkedFabric,
          linkedSheetId: itemToSave.id, // [Step 1] 원단 DB에 연동 설계서 ID 삽입 (양방향 참조 매듭)
          // [기획오류 #2 수정] article, itemName도 동기화
          article: itemToSave.articleNo ?? linkedFabric.article,
          itemName: itemToSave.fabricName ?? linkedFabric.itemName,
          widthFull: ci.widthFull ?? linkedFabric.widthFull,
          widthCut: ci.widthCut ?? linkedFabric.widthCut,
          gsm: ci.gsm ?? linkedFabric.gsm,
          costGYd: ci.costGYd ?? linkedFabric.costGYd,
          knittingFee1k: ci.knittingFee1k ?? linkedFabric.knittingFee1k,
          knittingFee3k: ci.knittingFee3k ?? linkedFabric.knittingFee3k,
          knittingFee5k: ci.knittingFee5k ?? linkedFabric.knittingFee5k,
          dyeingFee: ci.dyeingFee ?? linkedFabric.dyeingFee,
          extraFee1k: ci.extraFee1k ?? linkedFabric.extraFee1k,
          extraFee3k: ci.extraFee3k ?? linkedFabric.extraFee3k,
          extraFee5k: ci.extraFee5k ?? linkedFabric.extraFee5k,
          losses: ci.losses ?? linkedFabric.losses,
          marginTier: ci.marginTier ?? linkedFabric.marginTier,
          brandExtra: ci.brandExtra ?? linkedFabric.brandExtra,
          yarns: itemToSave.yarns || linkedFabric.yarns || []
        };
        // _syncedFromSheet는 내부 플래그이므로 DB에 저장하지 않음
        delete fabricToSync._syncedFromSheet;
        saveDocToCloud('fabrics', fabricToSync);
      }
    }

    // 의뢰 연결: devRequestId가 있으면 의뢰에 설계서 ID를 기록
    if (itemToSave.devRequestId && onLinkToDevRequest) {
      onLinkToDevRequest(itemToSave.devRequestId, itemToSave.id);
    }

    // [제거됨] draft → eztex 자동 전환 로직 제거
    // 이유: 설계서 저장 ≠ 단계 전환. 아직 작성 중인 설계서가 강제로 다음 단계로 넘어가는 것을 방지
    // 단계 전환은 생산관리자가 '다음 단계로' 버튼을 명시적으로 클릭해야만 진행됩니다.

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
    const sheet = designSheets.find(s => s.id === id);

    // [방어] 아이템화 완료 설계서는 삭제 차단 — 확정된 생산 데이터 보호
    if (sheet?.stage === 'articled') {
      showToast('아이템화가 완료된 설계서는 삭제할 수 없습니다. (데이터 보호)', 'error');
      return;
    }

    // [방어] 샘플 진행 중인 설계서는 이중 경고
    const msg = sheet?.stage === 'sampling'
      ? '⚠️ 샘플 진행 중인 설계서입니다!\n정말로 영구 삭제하시겠습니까? (복구 불가)'
      : '정말로 이 설계서를 삭제하시겠습니까? (삭제된 설계서는 복구할 수 없습니다.)';

    if (window.confirm(msg)) {
      // [A4 수정] 삭제 전 연결된 의뢰의 linkedDesignSheetId를 해제 → 의뢰 영구잠김 방지
      if (sheet?.devRequestId && devRequests) {
        const linkedDev = devRequests.find(d => d.id === sheet.devRequestId);
        if (linkedDev?.linkedDesignSheetId === id) {
          saveDocToCloud('devRequests', {
            ...linkedDev,
            linkedDesignSheetId: null,
            updatedAt: new Date().toISOString()
          });
        }
      }
      deleteDocFromCloud('designSheets', id).then(() => {
        showToast('설계서가 삭제되었습니다.', 'success');
      });
    }
  };

  // --- 버전(개선) 관리 제거됨 → 변경 이력 방식으로 대체 ---
  // 설계서 수정 시 handleSaveSheet 내부에서 자동으로 changeHistory에 이력 축적

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

  // [D3] generateSelfDevOrderNo 제거됨 — 자체 설계서는 빈칸 유지 정책 (데드코드 정리)

  // 아이템화 시 원단 자동 등록 (savedFabrics에 변환 저장)
  const registerFabricFromSheet = (sheet) => {
    if (!saveFabricFromSheet) return;

    // [A2 방어] 이미 원단이 등록된 설계서는 중복 등록 차단
    if (sheet.linkedFabricId) {
      showToast('이미 원단이 등록된 설계서입니다.', 'error');
      return;
    }

    // [B3 수정] ID를 문자열로 생성하여 타입 불일치 방지
    const fabricId = `fab_${Date.now()}`;
    const ci = sheet.costInput || {};
    const fabricData = {
      id: fabricId,
      linkedSheetId: sheet.id,
      date: new Date().toLocaleDateString(),
      article: sheet.articleNo || '',
      itemName: sheet.fabricName || '',
      // [B4 방어 추가] 빈 문자열("")일 경우에도 기본값이 투입되도록 강제 캐스팅
      widthFull: (ci.widthFull === '' || ci.widthFull == null) ? 58 : Number(ci.widthFull),
      widthCut: (ci.widthCut === '' || ci.widthCut == null) ? 56 : Number(ci.widthCut),
      gsm: (ci.gsm === '' || ci.gsm == null) ? 300 : Number(ci.gsm),
      costGYd: (ci.costGYd === '' || ci.costGYd == null) ? '' : Number(ci.costGYd),
      knittingFee1k: (ci.knittingFee1k === '' || ci.knittingFee1k == null) ? 3000 : Number(ci.knittingFee1k),
      knittingFee3k: (ci.knittingFee3k === '' || ci.knittingFee3k == null) ? 2000 : Number(ci.knittingFee3k),
      knittingFee5k: (ci.knittingFee5k === '' || ci.knittingFee5k == null) ? 2000 : Number(ci.knittingFee5k),
      dyeingFee: (ci.dyeingFee === '' || ci.dyeingFee == null) ? 8800 : Number(ci.dyeingFee),
      extraFee1k: (ci.extraFee1k === '' || ci.extraFee1k == null) ? 900 : Number(ci.extraFee1k),
      extraFee3k: (ci.extraFee3k === '' || ci.extraFee3k == null) ? 700 : Number(ci.extraFee3k),
      extraFee5k: (ci.extraFee5k === '' || ci.extraFee5k == null) ? 500 : Number(ci.extraFee5k),
      losses: ci.losses ?? { tier1k:{knit:5,dye:10}, tier3k:{knit:3,dye:10}, tier5k:{knit:3,dye:9} },
      marginTier: ci.marginTier ?? 3,
      brandExtra: ci.brandExtra ?? { tier1k:1000, tier3k:700, tier5k:500 },
      yarns: sheet.yarns || [],
      remarks: `설계서 아이템화 자동 등록 (${sheet.devOrderNo || ''})`
    };
    saveFabricFromSheet(fabricData);
    
    // 설계서 쪽에도 linkedFabricId 기록
    saveDocToCloud('designSheets', {
        ...sheet,
        stage: 'articled',
        linkedFabricId: fabricId,
        updatedAt: new Date().toISOString()
    });
    
    showToast(`Article ${sheet.articleNo} 원단이 자동 등록되었습니다.`, 'success');
  };

  // DROP 처리 (설계서를 보관함으로 이동, 현황에서 숨김)
  const dropDesignSheet = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    // [방어] 아이템화 완료 설계서는 DROP 차단 — 이미 원단 등록 완료
    if (sheet.stage === 'articled') {
      showToast('아이템화가 완료된 설계서는 DROP할 수 없습니다. (이미 원단 등록 완료)', 'error');
      return;
    }

    if (!window.confirm('이 설계서를 DROP 처리하시겠습니까?\n(보관함으로 이동되며 현황에서 숨겨집니다)')) return;

    // [A5 수정] DROP 시 연결된 의뢰의 linkedDesignSheetId 해제 + 의뢰 상태를 Drop(rejected)으로 변경
    if (sheet.devRequestId && devRequests) {
      const linkedDev = devRequests.find(d => d.id === sheet.devRequestId);
      if (linkedDev?.linkedDesignSheetId === sheetId) {
        saveDocToCloud('devRequests', {
          ...linkedDev,
          status: 'rejected',
          linkedDesignSheetId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }

    saveDocToCloud('designSheets', {
      ...sheet,
      status: 'dropped',
      updatedAt: new Date().toISOString()
    });
    showToast('DROP 처리되었습니다.', 'success');
  };

  // DROP 복원 (실수로 Drop한 것 되돌리기)
  const restoreFromDrop = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (!window.confirm('이 설계서를 복원하시겠습니까?\n(Drop 전 단계로 복원됩니다)')) return;
    const now = new Date().toISOString();
    // [기획오류 #3 수정] 복원 이력을 changeHistory에 기록
    const restoreHistory = {
      date: now,
      fields: { status: 'dropped' },
      reason: 'DROP 복원'
    };
    saveDocToCloud('designSheets', {
      ...sheet,
      status: 'active',
      changeHistory: [restoreHistory, ...(sheet.changeHistory || [])],
      updatedAt: now
    });

    // [Step 1] 복원 시 의뢰↔설계서 1:1 매핑 복구
    // DROP 시 해제되었던 linkedDesignSheetId를 다시 이 설계서 ID로 연결
    if (sheet.devRequestId && devRequests) {
      const linkedDev = devRequests.find(d => d.id === sheet.devRequestId);
      // 의뢰가 존재하고, 아직 다른 설계서와 연결되어 있지 않을 때만 복구
      if (linkedDev && !linkedDev.linkedDesignSheetId) {
        saveDocToCloud('devRequests', {
          ...linkedDev,
          linkedDesignSheetId: sheetId,
          status: 'confirmed',
          updatedAt: now
        });
      }
    }

    showToast('복원되었습니다.', 'success');
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
    addOrderNumber, removeOrderNumber,
    getDesignCost, initFromDevRequest, dropDesignSheet, restoreFromDrop,
    registerFabricFromSheet
  };
};
