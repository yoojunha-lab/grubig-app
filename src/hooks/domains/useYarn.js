import { useState } from 'react';

// GRUBIG ERP - 원사(Yarn) 도메인 로직 및 훅

export const useYarn = (yarnLibrary, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast, designSheets) => {
  const [editingYarnId, setEditingYarnId] = useState(null);

  const initialYarnInput = {
    category: '소모', name: '', remarks: '',
    suppliers: [{ id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: true }]
  };

  const [yarnInput, setYarnInput] = useState(initialYarnInput);

  const resetYarnForm = () => {
    setEditingYarnId(null);
    setYarnInput({
      category: '소모', name: '', remarks: '',
      suppliers: [{ id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: true }]
    });
  };

  const handleEditYarn = (yarn) => {
    const safeSuppliers = yarn.suppliers && yarn.suppliers.length > 0
      ? yarn.suppliers
      : [{ id: 'sup_legacy', name: yarn.supplier || '기본업체', currency: yarn.currency || 'KRW', price: yarn.price || 0, tariff: yarn.tariff || 0, freight: yarn.freight || 0, history: yarn.history || [], isDefault: true }];
    setYarnInput({ category: yarn.category || '소모', name: yarn.name || '', remarks: yarn.remarks || '', suppliers: safeSuppliers });
    setEditingYarnId(yarn.id);
  };

  const handleSaveYarn = () => {
    if (!yarnInput.name) {
      showToast('원사명을 입력해주세요', 'error');
      return;
    }

    const normalizedName = String(yarnInput.name).trim().toUpperCase();

    // [Step 3] 중복 원사명 등록 차단 (수정 모드에서는 본인 제외)
    const isDuplicate = (yarnLibrary || []).some(y =>
      String(y.name || '').toUpperCase() === normalizedName && y.id !== editingYarnId
    );
    if (isDuplicate) {
      showToast('이미 존재하는 원사명입니다.', 'error');
      return;
    }

    // [Step 1] 단가 변경 자동 히스토리 기록
    const existingYarn = editingYarnId ? (yarnLibrary || []).find(y => y.id === editingYarnId) : null;
    const today = new Date().toISOString().slice(0, 10);

    const suppliersWithHistory = yarnInput.suppliers.map(s => {
      const updatedSupplier = { ...s, name: String(s.name).toUpperCase(), history: [...(s.history || [])] };

      if (existingYarn) {
        // 수정 모드: 기존 공급처와 단가 비교 → 변경 시 히스토리 추가
        const oldSupplier = (existingYarn.suppliers || []).find(os => os.id === s.id);
        if (oldSupplier && Number(oldSupplier.price) !== Number(s.price) && s.price !== '' && s.price !== undefined) {
          updatedSupplier.history = [{ date: today, price: Number(s.price) }, ...updatedSupplier.history];
        }
      } else {
        // 새 원사 등록: 최초 단가를 히스토리에 기록
        if (s.price !== '' && s.price !== undefined && updatedSupplier.history.length === 0) {
          updatedSupplier.history = [{ date: today, price: Number(s.price) }];
        }
      }
      return updatedSupplier;
    });

    const itemToSave = {
      id: editingYarnId || `y${Date.now()}`,
      ...yarnInput,
      name: normalizedName,
      category: String(yarnInput.category).toUpperCase(),
      suppliers: suppliersWithHistory
    };
    saveDocToCloud('yarns', itemToSave);
    resetYarnForm();
    showToast('원사가 저장되었습니다.', 'success');
  };

  const handleDeleteYarn = (id, syncYarnLibraryStateCallback) => {
    // [방어] savedFabrics/fabric.yarns가 null/undefined일 때 크래시 방지
    const isUsed = (savedFabrics || []).some(fabric =>
      (fabric.yarns || []).some(y => y.yarnId && String(y.yarnId).split('::')[0] === String(id) && y.ratio > 0)
    );
    // [기획오류 #11 수정] 설계서에서도 원사 사용 체크
    const isUsedInSheet = (designSheets || []).some(sheet =>
      (sheet.yarns || []).some(y => y.yarnId && String(y.yarnId).split('::')[0] === String(id) && y.ratio > 0)
    );
    if (isUsed || isUsedInSheet) {
      alert("🚨 경고: 이 원사를 사용 중인 원단 또는 설계서가 있습니다! 삭제 불가.");
      return;
    }
    if (window.confirm("이 원사와 등록된 모든 공급처 정보가 삭제됩니다. 삭제하시겠습니까?")) {
      if (syncYarnLibraryStateCallback) syncYarnLibraryStateCallback(id);
      deleteDocFromCloud('yarns', id);
      showToast('삭제 완료', 'success');
    }
  };

  // --- 공급처(Supplier) 하위 로직 ---
  const handleAddSupplier = () => {
    setYarnInput(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, { id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: prev.suppliers.length === 0 }]
    }));
  };

  const handleRemoveSupplier = (supId) => {
    setYarnInput(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter(s => s.id !== supId).map((s, i) => ({ ...s, isDefault: i === 0 }))
    }));
  };

  const handleSupplierChange = (supId, field, value) => {
    setYarnInput(prev => ({
      ...prev, suppliers: (prev.suppliers || []).map(s => {
        if (field === 'isDefault' && value === true) return { ...s, isDefault: s.id === supId };
        if (s.id === supId) {
          // [방어] 숫자 필드는 NaN 방지
          const numFields = ['price', 'tariff', 'freight'];
          const safeValue = field === 'name' ? String(value).toUpperCase()
            : numFields.includes(field) ? (Number(value) || 0)
            : value;
          return { ...s, [field]: safeValue };
        }
        return s;
      })
    }));
  };

  const handleDeleteHistoryItem = (supId, hIdx) => {
    setYarnInput(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => {
        if (s.id === supId) {
          const newHistory = [...(s.history || [])];
          newHistory.splice(hIdx, 1);
          return { ...s, history: newHistory };
        }
        return s;
      })
    }));
  };

  return {
    yarnInput, setYarnInput, editingYarnId,
    handleSaveYarn, handleEditYarn, handleDeleteYarn, resetYarnForm,
    handleAddSupplier, handleRemoveSupplier, handleSupplierChange, handleDeleteHistoryItem
  };
};
