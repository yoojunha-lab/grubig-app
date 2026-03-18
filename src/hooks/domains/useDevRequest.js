import { useState } from 'react';

// GRUBIG ERP - 바이어 R&D 개발 의뢰 관리 훅

export const useDevRequest = (devRequests, saveDocToCloud, deleteDocFromCloud, showToast) => {
  const [editingDevId, setEditingDevId] = useState(null);

  // 개발 의뢰 초기 입력 폼
  const getInitialDevInput = () => ({
    buyerName: '',
    requestDate: new Date().toISOString().slice(0, 10),
    targetSpec: {
      composition: '',        // 혼용률
      targetPrice: '',        // 타겟 단가
      feeling: '',             // 원하는 느낌
      analysisDeadline: '',   // 분석 납기일자
      sampleDeadline: '',     // 샘플 생산 납기일자 (설계서 진행 납기)
      otherRequests: ''       // 기타 요청사항
    },
    swatchNote: '',            // 스와치 관련 메모
    status: 'pending'          // pending | analyzing | confirmed | rejected
  });

  const [devInput, setDevInput] = useState(getInitialDevInput);

  // 개발 오더넘버 자동 채번: F-[끝2자리연도]D[3자리순번]
  // 예) 2026년 → F-26D001, F-26D002 ...
  const generateDevOrderNo = () => {
    const year = new Date().getFullYear().toString().slice(-2); // '26'
    const prefix = `F-${year}D`;

    // 같은 연도의 기존 개발 의뢰 중 가장 큰 순번을 찾아 +1
    const existingNos = (devRequests || [])
      .map(d => d.devOrderNo || '')
      .filter(no => no.startsWith(prefix))
      .map(no => {
        const numPart = parseInt(no.replace(prefix, ''), 10);
        return isNaN(numPart) ? 0 : numPart;
      });

    const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  // 일반 필드 변경 핸들러
  const handleDevChange = (e) => {
    const { name, value } = e.target;
    setDevInput(prev => ({ ...prev, [name]: name === 'buyerName' ? String(value).toUpperCase() : value }));
  };

  // 중첩 필드(targetSpec) 변경 핸들러
  const handleSpecChange = (field, value) => {
    setDevInput(prev => ({
      ...prev,
      targetSpec: { ...prev.targetSpec, [field]: value }
    }));
  };

  // 폼 리셋
  const resetDevForm = () => {
    setDevInput(getInitialDevInput());
    setEditingDevId(null);
  };

  // 저장 (새로 생성 or 수정)
  const handleSaveDevRequest = (user) => {
    if (!devInput.buyerName) {
      showToast('바이어명을 입력해주세요.', 'error');
      return;
    }
    // 분석 납기 필수
    if (!devInput.targetSpec?.analysisDeadline) {
      showToast('분석 납기일자를 입력해주세요.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const isNew = !editingDevId;

    const itemToSave = {
      ...devInput,
      id: editingDevId || `dev_${Date.now()}`,
      devOrderNo: isNew ? generateDevOrderNo() : (devRequests.find(d => d.id === editingDevId)?.devOrderNo || generateDevOrderNo()),
      linkedDesignSheetId: isNew ? null : (devRequests.find(d => d.id === editingDevId)?.linkedDesignSheetId || null),
      createdBy: isNew ? (user?.email || '') : (devRequests.find(d => d.id === editingDevId)?.createdBy || ''),
      createdAt: isNew ? now : (devRequests.find(d => d.id === editingDevId)?.createdAt || now),
      updatedAt: now
    };

    saveDocToCloud('devRequests', itemToSave);
    resetDevForm();
    showToast(isNew ? '개발 의뢰가 등록되었습니다.' : '개발 의뢰가 수정되었습니다.', 'success');
  };

  // 수정 모드 진입
  const handleEditDevRequest = (devReq) => {
    setDevInput({
      buyerName: devReq.buyerName || '',
      requestDate: devReq.requestDate || new Date().toISOString().slice(0, 10),
      targetSpec: devReq.targetSpec || getInitialDevInput().targetSpec,
      swatchNote: devReq.swatchNote || '',
      status: devReq.status || 'pending'
    });
    setEditingDevId(devReq.id);
  };

  // 삭제
  const handleDeleteDevRequest = (id) => {
    if (window.confirm('정말로 이 개발 의뢰를 삭제하시겠습니까?')) {
      deleteDocFromCloud('devRequests', id).then(() => {
        showToast('삭제되었습니다.', 'success');
      });
    }
  };

  // 개발 확정→설계서 연동용 초기 데이터 생성
  const createDesignSheetFromDev = (devReq) => {
    return {
      devOrderNo: devReq.devOrderNo,
      buyerName: devReq.buyerName,
      devRequestId: devReq.id,
      initialComposition: devReq.targetSpec?.composition || '',
      feeling: devReq.targetSpec?.feeling || '',
      sampleDeadline: devReq.targetSpec?.sampleDeadline || ''  // 설계서 진행 납기로 전달
    };
  };

  // 상태만 변경 (아코디언 내 드롭다운용)
  const updateDevStatus = (devReqId, newStatus) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;
    saveDocToCloud('devRequests', {
      ...devReq,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    showToast(`상태가 변경되었습니다.`, 'success');
  };

  // 확정 + 설계서 연결 (설계서 ID를 받아서 의뢰에 기록)
  const confirmDevAndLink = (devReqId, designSheetId) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;
    saveDocToCloud('devRequests', {
      ...devReq,
      status: 'confirmed',
      linkedDesignSheetId: designSheetId || null,
      updatedAt: new Date().toISOString()
    });
  };

  return {
    devInput, setDevInput,
    editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, confirmDevAndLink
  };
};
