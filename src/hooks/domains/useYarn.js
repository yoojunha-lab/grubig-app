import { useState } from 'react';

// GRUBIG ERP - 원사(Yarn) 도메인 로직 및 훅

export const useYarn = (yarnLibrary, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast) => {
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
    setYarnInput({ category: yarn.category || '소모', name: yarn.name, remarks: yarn.remarks || '', suppliers: safeSuppliers });
    setEditingYarnId(yarn.id);
  };

  const handleSaveYarn = () => {
    if (!yarnInput.name) {
      showToast('원사명을 입력해주세요', 'error');
      return;
    }
    const itemToSave = { 
      id: editingYarnId || `y${Date.now()}`, 
      ...yarnInput, 
      name: String(yarnInput.name).toUpperCase(), 
      category: String(yarnInput.category).toUpperCase(), 
      suppliers: yarnInput.suppliers.map(s => ({ ...s, name: String(s.name).toUpperCase(), history: s.history || [] })) 
    };
    saveDocToCloud('yarns', itemToSave); 
    resetYarnForm();
    showToast('원사가 저장되었습니다.', 'success');
  };

  const handleDeleteYarn = (id, syncYarnLibraryStateCallback) => {
    const isUsed = savedFabrics.some(fabric => 
      fabric.yarns.some(y => y.yarnId && String(y.yarnId).split('::')[0] === String(id) && y.ratio > 0)
    );
    if (isUsed) { 
      alert("🚨 경고: 이 원사를 사용 중인 원단이 있습니다! 삭제 불가."); 
      return; 
    }
    if (window.confirm("이 원사와 등록된 모든 공급처 정보가 삭제됩니다. 삭제하시겠습니까?")) { 
      if(syncYarnLibraryStateCallback) syncYarnLibraryStateCallback(id);
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
      ...prev, suppliers: prev.suppliers.map(s => {
        if (field === 'isDefault' && value === true) return { ...s, isDefault: s.id === supId };
        if (s.id === supId) return { ...s, [field]: field === 'name' ? String(value).toUpperCase() : value };
        return s;
      })
    }));
  };

  const handleDeleteHistoryItem = (supId, hIdx) => {
    setYarnInput(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => {
        if (s.id === supId) {
          const newHistory = [...s.history];
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
