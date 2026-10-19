import { useState } from 'react';
import { compareArticle, sortByArticle } from '../../utils/helpers';

// GRUBIG ERP - 컬렉션 관리 (영업: 시즌/전시회/바이어/월별 아티클 묶음) 로직 훅
//  - 컬렉션 메타(이름/분류/날짜 등) CRUD
//  - 아티클(원단)은 원단 리스트(savedFabrics)를 fabricId로 참조해서 담기/빼기
//  - items 변경은 collections 라이브 문서를 찾아 통째로 저장 (useOrder 패턴 동일)
//  - 아티클 순서 (대표님 결정 2026-10-14): 새로 담으면 Article 순서 자리에 끼워 넣음 + [ART 순서로 정렬]로 한 번에 정리
//    ↑↓로 직접 바꾸는 것도 그대로 (예전엔 담은 순서대로 뒤에 붙어서 PW 번호가 섞였음)
//  - 검토 (2026-10-19): Article·아이템명은 늘 원단 관리의 지금 값으로 정렬·저장 (담을 때 적어 둔 값은 원단이 지워졌을 때만 씀)
//    저장·삭제는 끝나고 성공했을 때만 '됐습니다' 알림·창 닫기 (docs/terminology.md §3)
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

  const findCollection = (id) => (collections || []).find(c => c.id === id);

  // 담긴 아티클의 원단 (원단 관리에서 지웠으면 없음)
  const fabricOf = (item) => (savedFabrics || []).find(f => String(f.id) === String(item?.fabricId));

  // 담을 때 적어 둔 Article·아이템명을 지금 원단 값으로 — 원단 관리에서 Article을 고쳐도 정렬이 맞게.
  //  원단이 지워졌으면 적어 둔 값 그대로 (그래서 저장할 때마다 최신 값으로 다시 적어 둠)
  const withLiveSnapshot = (item) => {
    const fabric = fabricOf(item);
    if (!fabric) return item;
    return {
      ...item,
      article: fabric.article || item.article || '',
      itemName: fabric.itemName || item.itemName || '',
    };
  };

  // 아티클 목록을 바꿔 컬렉션 저장 — 성공 true / 실패 false ('저장 실패' 알림은 saveDocToCloud가 띄움)
  const saveItems = (col, items) => saveDocToCloud('collections', {
    ...col,
    items: items.map(withLiveSnapshot),
    updatedAt: new Date().toISOString(),
  });

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
  //  - 저장이 끝나고 성공하면 저장된 id 반환(호출 측에서 자동 선택), 실패하면 false — 입력값 그대로 (창도 그대로)
  const handleSaveCollection = async () => {
    const name = String(collectionInput.name || '').trim();
    if (!name) {
      showToast('컬렉션 이름을 입력해주세요.', 'error');
      return false;
    }

    const idToSave = editingCollectionId || `col_${Date.now()}`;

    // 수정 시 items는 라이브 데이터에서 가져옴 (메타 편집 중 아티클 변경분 보존)
    const liveItems = editingCollectionId
      ? (findCollection(editingCollectionId)?.items || [])
      : (collectionInput.items || []);

    const dataToSave = {
      ...collectionInput,
      id: idToSave,
      name,
      items: liveItems,
      createdAt: collectionInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ok = await saveDocToCloud('collections', dataToSave);
    if (!ok) return false;
    showToast(editingCollectionId ? '컬렉션이 수정되었습니다.' : '새 컬렉션이 생성되었습니다.', 'success');
    resetCollectionForm();
    return idToSave;
  };

  const handleEditCollection = (id) => {
    const col = findCollection(id);
    if (!col) return;
    setCollectionInput({ ...getInitialCollectionInput(), ...col, items: col.items || [] });
    setEditingCollectionId(id);
  };

  const handleDeleteCollection = async (id) => {
    const col = findCollection(id);
    const label = col?.name || '컬렉션';
    if (!window.confirm(`'${label}' 컬렉션을 삭제하시겠습니까?\n담긴 아티클 목록도 함께 사라집니다. (원단 원본은 삭제되지 않습니다)`)) return;
    // 실패하면 false — '삭제 실패' 알림은 deleteDocFromCloud가 띄움 (예전엔 실패해도 '삭제되었습니다'가 같이 떴음)
    const ok = await deleteDocFromCloud('collections', id);
    if (!ok) return;
    if (editingCollectionId === id) resetCollectionForm();
    showToast('컬렉션이 삭제되었습니다.', 'success');
  };

  // ── 아티클(원단) 담기 ──────────────────────────────────────
  //  fabrics: 담을 원단 객체 배열 (savedFabrics에서 선택된 것들)
  //  이미 담긴 fabricId는 자동 제외, article/itemName은 스냅샷으로 함께 저장(원단 삭제 대비)
  //  새 아티클은 Article 순서 자리에 끼워 넣음 — 지금 목록에서 처음으로 Article이 더 큰 아티클 앞 (없으면 맨 뒤)
  const addArticlesToCollection = async (collectionId, fabrics) => {
    const col = findCollection(collectionId);
    if (!col) return;

    const existingIds = new Set((col.items || []).map(it => String(it.fabricId)));
    const newItems = sortByArticle((fabrics || []).filter(f => f && !existingIds.has(String(f.id))))
      .map(f => ({
        fabricId: f.id,
        article: f.article || '',
        itemName: f.itemName || '',
        memo: '',
        addedAt: new Date().toISOString(),
      }));

    if (newItems.length === 0) {
      showToast('이미 담겨 있는 아티클입니다.', 'error');
      return;
    }

    // 끼워 넣을 자리도 지금 Article 기준 (원단 관리에서 Article을 고친 아티클이 있어도 맞는 자리에)
    const items = (col.items || []).map(withLiveSnapshot);
    newItems.forEach(item => {
      const at = items.findIndex(it => compareArticle(it.article, item.article) > 0);
      if (at === -1) items.push(item);
      else items.splice(at, 0, item);
    });
    if (await saveItems(col, items)) showToast(`${newItems.length}개 아티클을 담았습니다.`, 'success');
  };

  // ── 아티클 ART 순서로 정렬 (한 번에 — ↑↓로 바꾼 순서는 사라져서 먼저 확인) ──
  const sortCollectionArticles = async (collectionId) => {
    const col = findCollection(collectionId);
    if (!col) return;
    const items = (col.items || []).map(withLiveSnapshot);
    const sorted = sortByArticle(items);
    if (sorted.every((it, i) => it.fabricId === items[i].fabricId)) {
      showToast('이미 ART 순서예요.', 'info');
      return;
    }
    if (!window.confirm(`'${col.name || '컬렉션'}'의 아티클 ${items.length}개를 ART 순서(PW1001 → PW1002 …)로 바꿀까요?\n↑↓로 직접 바꾼 순서는 사라져요.`)) return;
    if (await saveItems(col, sorted)) showToast('아티클을 ART 순서로 정렬했어요.', 'success');
  };

  // ── 아티클(원단) 빼기 ──────────────────────────────────────
  const removeArticleFromCollection = async (collectionId, fabricId) => {
    const col = findCollection(collectionId);
    if (!col) return;
    const items = (col.items || []).filter(it => String(it.fabricId) !== String(fabricId));
    if (await saveItems(col, items)) showToast('아티클을 컬렉션에서 제외했습니다.', 'success');
  };

  // ── 아티클 메모 수정 (blur 시 호출, 앞뒤 공백 빼고 변경 없으면 스킵 — 토스트 없이 조용히 저장) ──
  const updateArticleMemo = (collectionId, fabricId, memo) => {
    const col = findCollection(collectionId);
    if (!col) return;
    const items = col.items || [];
    const target = items.find(it => String(it.fabricId) === String(fabricId));
    if (!target) return;
    const nextMemo = String(memo || '').trim();
    if ((target.memo || '') === nextMemo) return; // 변경 없으면 저장 안 함
    saveItems(col, items.map(it => String(it.fabricId) === String(fabricId) ? { ...it, memo: nextMemo } : it));
  };

  // ── 아티클 순서 이동 (위/아래 이웃과 swap — 토스트 없이 조용히) ──
  const moveArticle = (collectionId, fabricId, direction) => {
    const col = findCollection(collectionId);
    if (!col) return;
    const items = [...(col.items || [])];
    const idx = items.findIndex(it => String(it.fabricId) === String(fabricId));
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= items.length) return;
    [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
    saveItems(col, items);
  };

  return {
    collectionInput,
    editingCollectionId,
    handleCollectionChange,
    resetCollectionForm,
    handleSaveCollection,
    handleEditCollection,
    handleDeleteCollection,
    addArticlesToCollection,
    removeArticleFromCollection,
    updateArticleMemo,
    moveArticle,
    sortCollectionArticles,
  };
};
