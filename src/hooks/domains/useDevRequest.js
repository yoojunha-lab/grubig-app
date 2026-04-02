import { useState } from 'react';

// GRUBIG ERP - 바이어 R&D 개발 의뢰 관리 훅
// 상태: pending(대기) → analyzing(분석) → confirmed(개발투입확정, 설계서 저장 시 자동) / rejected(미진행)

export const useDevRequest = (devRequests, saveDocToCloud, deleteDocFromCloud, showToast, designSheets) => {
  const [editingDevId, setEditingDevId] = useState(null);

  const getInitialDevInput = () => ({
    devOrderNo: '',            // 사용자 직접 입력 (비어있으면 추천번호 자동 적용)
    buyerName: '',
    assignee: '',
    devItem: '',
    requestDate: new Date().toISOString().slice(0, 10),
    targetSpec: {
      composition: '',
      targetPrice: '',
      feeling: '',
      analysisDeadline: '',
      sampleDeadline: '',
      otherRequests: ''
    },
    swatchNote: '',
    status: 'pending'
  });

  const [devInput, setDevInput] = useState(getInitialDevInput);

  // 개발 오더넘버 자동 채번
  const generateDevOrderNo = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `F-${year}D`;
    const existingNos = (devRequests || [])
      .map(d => d.devOrderNo || '')
      .filter(no => no.startsWith(prefix))
      .map(no => { const n = parseInt(no.replace(prefix, ''), 10); return isNaN(n) ? 0 : n; });
    const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleDevChange = (e) => {
    const { name, value } = e.target;
    setDevInput(prev => ({ ...prev, [name]: name === 'buyerName' ? String(value).toUpperCase() : value }));
  };

  const handleSpecChange = (field, value) => {
    setDevInput(prev => ({
      ...prev,
      targetSpec: { ...prev.targetSpec, [field]: value }
    }));
  };

  const resetDevForm = () => {
    setDevInput(getInitialDevInput());
    setEditingDevId(null);
  };

  // 저장 — boolean 반환 (true=성공, false=실패 → 모달 유지)
  const handleSaveDevRequest = (user) => {
    if (!devInput.buyerName) {
      showToast('바이어명을 선택해주세요.', 'error');
      return false;
    }
    if (!devInput.targetSpec?.analysisDeadline) {
      showToast('분석 납기일자를 입력해주세요.', 'error');
      return false;
    }

    const now = new Date().toISOString();
    const isNew = !editingDevId;
    const existing = isNew ? null : devRequests.find(d => d.id === editingDevId);

    // 개발번호: 사용자 입력값 우선, 없으면 자동 발번
    let devOrderNo;
    if (isNew) {
      devOrderNo = devInput.devOrderNo?.trim() || generateDevOrderNo();
      // 중복 검증
      const isDuplicate = (devRequests || []).some(d => d.devOrderNo === devOrderNo);
      if (isDuplicate) {
        showToast(`개발번호 '${devOrderNo}'는 이미 사용 중입니다. 다른 번호를 입력해주세요.`, 'error');
        return false;
      }
    } else {
      devOrderNo = existing?.devOrderNo || generateDevOrderNo();
    }

    const itemToSave = {
      ...devInput,
      id: editingDevId || `dev_${Date.now()}`,
      devOrderNo,
      linkedDesignSheetId: isNew ? null : (existing?.linkedDesignSheetId || null),
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now
    };

    saveDocToCloud('devRequests', itemToSave);
    resetDevForm();
    showToast(isNew ? '개발 의뢰가 등록되었습니다.' : '개발 의뢰가 수정되었습니다.', 'success');
    return true;
  };

  const handleEditDevRequest = (devReq) => {
    const defaultSpec = getInitialDevInput().targetSpec;
    setDevInput({
      devOrderNo: devReq.devOrderNo || '',
      buyerName: devReq.buyerName || '',
      assignee: devReq.assignee || '',
      devItem: devReq.devItem || '',
      requestDate: devReq.requestDate || new Date().toISOString().slice(0, 10),
      targetSpec: { ...defaultSpec, ...(devReq.targetSpec || {}) },
      swatchNote: devReq.swatchNote || '',
      status: devReq.status || 'pending'
    });
    setEditingDevId(devReq.id);
  };

  const handleDeleteDevRequest = (id) => {
    const devReq = (devRequests || []).find(d => d.id === id);

    // [방어] 설계서가 연결된 의뢰는 삭제 차단 — 고아 설계서 발생 방지
    if (devReq?.linkedDesignSheetId) {
      showToast('설계서가 연결된 의뢰는 삭제할 수 없습니다. 연결된 설계서를 먼저 정리해주세요.', 'error');
      return;
    }

    if (window.confirm('정말로 이 개발 의뢰를 삭제하시겠습니까?')) {
      deleteDocFromCloud('devRequests', id).then(() => {
        showToast('삭제되었습니다.', 'success');
      });
    }
  };

  // 설계서 작성 시 전달할 데이터
  const createDesignSheetFromDev = (devReq) => ({
    devOrderNo: devReq.devOrderNo,
    devRequestId: devReq.id,
    sampleDeadline: devReq.targetSpec?.sampleDeadline || ''
  });

  // 상태 변경 (드롭다운)
  const updateDevStatus = (devReqId, newStatus) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;

    // 참고: confirmed 전환은 드롭다운에서 수동으로도 가능하고,
    // 설계서 저장 시 linkAndConfirm()을 통해 자동으로도 처리됩니다.

    // [방어] confirmed → 다른 상태로 되돌릴 때, 연결된 설계서가 있으면 경고
    if (devReq.status === 'confirmed' && devReq.linkedDesignSheetId) {
      if (!window.confirm('⚠️ 이 의뢰에는 연결된 설계서가 있습니다.\n상태를 변경하면 설계서 연결이 해제됩니다.\n\n정말 계속하시겠습니까?')) {
        return;
      }
    }

    // [A3 수정] confirmed → 다른 상태로 롤백 시, 연결된 설계서의 devRequestId도 해제하여 고아 방지
    if (devReq.status === 'confirmed' && devReq.linkedDesignSheetId && designSheets) {
      const linkedSheet = designSheets.find(s => s.id === devReq.linkedDesignSheetId);
      if (linkedSheet) {
        saveDocToCloud('designSheets', {
          ...linkedSheet,
          devRequestId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // [Step 4] confirmed로 전환 시: 기존에 이 의뢰를 바라보는 active 설계서가 있으면 자동 재연결
    let restoredSheetId = devReq.linkedDesignSheetId || null;
    if (newStatus === 'confirmed' && !restoredSheetId && designSheets) {
      const matchingSheet = designSheets.find(
        s => s.devRequestId === devReqId && s.status === 'active'
      );
      if (matchingSheet) {
        restoredSheetId = matchingSheet.id;
      }
    }

    saveDocToCloud('devRequests', {
      ...devReq,
      status: newStatus,
      // confirmed → 다른 상태로 돌리면 linkedDesignSheetId도 해제
      // confirmed로 전환 시 active 설계서가 있으면 자동 복구
      linkedDesignSheetId: devReq.status === 'confirmed' && newStatus !== 'confirmed'
        ? null
        : restoredSheetId,
      updatedAt: new Date().toISOString()
    });
    showToast(`상태가 변경되었습니다.`, 'success');
  };

  // 설계서 저장 시 자동 확정 (연결 + confirmed 전환)
  // 설계서가 저장되면 이 함수가 호출 → 의뢰를 자동 '개발투입확정'으로
  const linkAndConfirm = (devReqId, designSheetId) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;
    // 이미 확정+연결된 경우 → 중복 저장 방지 (설계서 수정 저장 시)
    if (devReq.status === 'confirmed' && devReq.linkedDesignSheetId === designSheetId) return;
    saveDocToCloud('devRequests', {
      ...devReq,
      linkedDesignSheetId: designSheetId,
      status: 'confirmed',
      updatedAt: new Date().toISOString()
    });
  };

  return {
    devInput, setDevInput,
    editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, linkAndConfirm
  };
};
