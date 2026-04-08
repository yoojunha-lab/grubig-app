import { useState } from 'react';

// GRUBIG ERP - 메인 디테일 시트 (QC 및 생산 실측 데이터) 로직 훅
export const useMainDetail = (mainDetails, saveDocToCloud, deleteDocFromCloud, showToast) => {
  const [editingDetailId, setEditingDetailId] = useState(null);

  const getInitialMainDetailInput = () => ({
    // 식별자
    orderNo: '',
    articleNo: '',
    colorInfo: '',
    lotNo: '',
    type: 'main', // 'main' | 'sample'
    
    // 생지 정보
    greigeWidthFull: '',
    greigeGsm: '',
    greigeLoopLength: '',
    
    // 가공지 정보 (폭, 중량만 입력. 수축/토킹은 테스트에서)
    finWidthFull: '',
    finGsm: '',
    
    // 수축 TEST 결과 (배열 구조, 초기 1개)
    // 최대 3개 (최초 1 + 재가공 2)
    tests: [
      {
        id: `test_${Date.now()}_0`,
        shrinkWidth: '',   // 폭축(%)
        shrinkLength: '',  // 장축(%)
        torque: '',        // 토킹(%)
        gsm: '',           // QC당시 중량(GSM)
        status: '',        // 'Pass' | 'Fail'
        reworkMethod: ''
      }
    ],
    remarks: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [detailInput, setDetailInput] = useState(getInitialMainDetailInput());

  const resetDetailForm = () => {
    setDetailInput(getInitialMainDetailInput());
    setEditingDetailId(null);
  };

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setDetailInput(prev => ({ ...prev, [name]: value }));
  };

  const handleTestChange = (index, field, value) => {
    setDetailInput(prev => {
      const newTests = [...(prev.tests || [])];
      if (!newTests[index]) return prev;
      newTests[index] = { ...newTests[index], [field]: value };
      return { ...prev, tests: newTests };
    });
  };

  const addTest = () => {
    setDetailInput(prev => {
      if ((prev.tests?.length || 0) >= 3) {
        showToast('수축 TEST는 최대 3번(Retest 2회)까지만 추가할 수 있습니다.', 'error');
        return prev;
      }
      return {
        ...prev,
        tests: [
          ...(prev.tests || []),
          {
            id: `test_${Date.now()}_${prev.tests?.length || 0}`,
            shrinkWidth: '',
            shrinkLength: '',
            torque: '',
            gsm: '',
            status: '',
            reworkMethod: ''
          }
        ]
      };
    });
  };

  const removeTest = (index) => {
    setDetailInput(prev => {
      if ((prev.tests?.length || 0) <= 1) {
        showToast('최소 1개의 기록은 유지해야 합니다.', 'error');
        return prev;
      }
      const newTests = [...(prev.tests || [])];
      newTests.splice(index, 1);
      return { ...prev, tests: newTests };
    });
  };

  const handleSaveDetail = () => {
    if (detailInput.type === 'main' && !detailInput.articleNo?.trim()) {
      showToast('메인(Main) 시트는 Article 번호를 필수로 입력해야 합니다.', 'error');
      return false;
    }
    if (detailInput.type === 'sample' && !detailInput.articleNo?.trim() && !detailInput.orderNo?.trim()) {
      showToast('샘플(Sample) 시트는 Article 번호나 Order No 중 하나는 필수로 입력해야 합니다.', 'error');
      return false;
    }
    
    const idToSave = editingDetailId || `md_${Date.now()}`;
    const dataToSave = {
      ...detailInput,
      id: idToSave,
      updatedAt: new Date().toISOString()
    };
    
    saveDocToCloud('mainDetails', dataToSave);
    showToast(editingDetailId ? '메인 디테일 시트 수정 완료' : '메인 디테일 시트 등록 완료', 'success');
    resetDetailForm();
    return true;
  };

  const handleEditDetail = (id) => {
    const detail = mainDetails?.find(d => d.id === id);
    if (!detail) return;
    setDetailInput({ ...detail });
    setEditingDetailId(id);
  };

  const handleDeleteDetail = async (id) => {
    if (!window.confirm('정말 이 시트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await deleteDocFromCloud('mainDetails', id);
      if (editingDetailId === id) resetDetailForm();
      showToast('삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  const handleQuickStatusChange = (detailId, testIndex, newStatus) => {
    const detail = mainDetails?.find(d => d.id === detailId);
    if (!detail || !detail.tests || !detail.tests[testIndex]) return;
    
    const updatedTests = [...detail.tests];
    updatedTests[testIndex] = { ...updatedTests[testIndex], status: newStatus };
    
    const updatedDetail = {
      ...detail,
      tests: updatedTests,
      updatedAt: new Date().toISOString()
    };
    
    saveDocToCloud('mainDetails', updatedDetail);
    showToast(`[${detail.articleNo || 'No Article'}] 판정이 변경되었습니다.`, 'success');
  };

  return {
    detailInput,
    setDetailInput,
    editingDetailId,
    setEditingDetailId,
    handleDetailChange,
    handleTestChange,
    addTest,
    removeTest,
    handleSaveDetail,
    handleEditDetail,
    handleDeleteDetail,
    resetDetailForm,
    handleQuickStatusChange
  };
};
