import { useState } from 'react';

// GRUBIG ERP - 컬렉션 관리 (영업: 시즌/전시회/바이어/월별 아티클 묶음) 로직 훅
//  - 컬렉션 메타(이름/분류/날짜 등) CRUD
//  - 아티클(원단)은 원단 리스트(savedFabrics)를 fabricId로 참조해서 담기/빼기
//  - items 변경은 collections 라이브 문서를 찾아 통째로 저장 (useOrder 패턴 동일)
export const useCollection = (collections, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast) => {
  const [editingCollectionId, setEditingCollectionId] = useState(null);

  const getInitialCollectionInput = () => ({
    name: '',
    type: '시즌',        // 시즌 | 전시회 | 바이어 | 월별 | 기타
    buyer: '',
    eventName: '',
    date: '',
    description: '',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [collectionInput, setCollectionInput] = useState(getInitialCollectionInput());

  const resetCollectionForm = () => {
    setCollectionInput(getInitialCollectionInput());
    setEditingCollectionId(null);
  };

  const handleCollectionChange = (e) => {
    const { name, value } = e.target;
    setCollectionInput(prev => ({ ...prev, [name]: value }));
  };

  // 컬렉션 메타정보 저장 (이름/분류/바이어/전시회명/날짜/설명)
  //  - 아티클(items)은 폼이 아니라 라이브 데이터에서 가져와 보존
  //  - 성공 시 저장된 id 반환(호출 측에서 자동 선택), 실패 시 false
  const handleSaveCollection = () => {
    const name = String(collectionInput.name || '').trim();
    if (!name) {
      showToast('컬렉션 이름을 입력해주세요.', 'error');
      return false;
    }

    const idToSave = editingCollectionId || `col_${Date.now()}`;

    // 수정 시 items는 라이브 데이터에서 가져옴 (메타 편집 중 아티클 변경분 보존)
    const liveItems = editingCollectionId
      ? ((collections || []).find(c => c.id === editingCollectionId)?.items || [])
      : (collectionInput.items || []);

    const dataToSave = {
      ...collectionInput,
      id: idToSave,
      name,
      items: liveItems,
      createdAt: collectionInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveDocToCloud('collections', dataToSave);
    showToast(editingCollectionId ? '컬렉션이 수정되었습니다.' : '새 컬렉션이 생성되었습니다.', 'success');
    resetCollectionForm();
    return idToSave;
  };

  const handleEditCollection = (id) => {
    const col = (collections || []).find(c => c.id === id);
    if (!col) return;
    setCollectionInput({ ...getInitialCollectionInput(), ...col, items: col.items || [] });
    setEditingCollectionId(id);
  };

  const handleDeleteCollection = async (id) => {
    const col = (collections || []).find(c => c.id === id);
    const label = col?.name || '컬렉션';
    if (!window.confirm(`'${label}' 컬렉션을 삭제하시겠습니까?\n담긴 아티클 목록도 함께 사라집니다. (원단 원본은 삭제되지 않습니다)`)) return;
    try {
      await deleteDocFromCloud('collections', id);
      if (editingCollectionId === id) resetCollectionForm();
      showToast('컬렉션이 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  // ── 아티클(원단) 담기 ──────────────────────────────────────
  //  fabrics: 담을 원단 객체 배열 (savedFabrics에서 선택된 것들)
  //  이미 담긴 fabricId는 자동 제외, article/itemName은 스냅샷으로 함께 저장(원단 삭제 대비)
  const addArticlesToCollection = (collectionId, fabrics) => {
    const col = (collections || []).find(c => c.id === collectionId);
    if (!col) return;

    const existingIds = new Set((col.items || []).map(it => String(it.fabricId)));
    const newItems = (fabrics || [])
      .filter(f => f && !existingIds.has(String(f.id)))
      .map(f => ({
        fabricId: f.id,
        article: f.article || '',
        itemName: f.itemName || '',
        addedAt: new Date().toISOString(),
      }));

    if (newItems.length === 0) {
      showToast('이미 담겨 있는 아티클입니다.', 'error');
      return;
    }

    const updatedCol = {
      ...col,
      items: [...(col.items || []), ...newItems],
      updatedAt: new Date().toISOString(),
    };
    saveDocToCloud('collections', updatedCol);
    showToast(`${newItems.length}개 아티클을 담았습니다.`, 'success');
  };

  // ── 아티클(원단) 빼기 ──────────────────────────────────────
  const removeArticleFromCollection = (collectionId, fabricId) => {
    const col = (collections || []).find(c => c.id === collectionId);
    if (!col) return;
    const updatedCol = {
      ...col,
      items: (col.items || []).filter(it => String(it.fabricId) !== String(fabricId)),
      updatedAt: new Date().toISOString(),
    };
    saveDocToCloud('collections', updatedCol);
    showToast('아티클을 컬렉션에서 제외했습니다.', 'success');
  };

  return {
    collectionInput,
    setCollectionInput,
    editingCollectionId,
    setEditingCollectionId,
    getInitialCollectionInput,
    handleCollectionChange,
    resetCollectionForm,
    handleSaveCollection,
    handleEditCollection,
    handleDeleteCollection,
    addArticlesToCollection,
    removeArticleFromCollection,
  };
};
