import { useState, useEffect, useRef } from 'react';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅

export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate) => {
  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', attention: '', buyerType: 'converter', marketType: 'domestic', currency: 'KRW', date: new Date().toISOString().split('T')[0], extraMargin: 0, remarks: '', items: []
  });

  // 글로벌 환율 변동 감지 및 재계산 
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    
    if (quoteInput.items && quoteInput.items.length > 0 && quoteInput.marketType) {
      const hasManualOverride = quoteInput.items.some(item => item.isManualOverride);
      if (hasManualOverride) {
        const confirmReset = window.confirm("수동으로 변경된 단가가 있습니다. 환율을 변동하면 수정한 단가가 원본으로 초기화됩니다. 계속하시겠습니까?");
        if (!confirmReset) return;
      }

      setQuoteInput(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          // createQuoteItem은 새로운 객체를 반환하므로 isManualOverride 플래그가 자동 삭제됨
          return createQuoteItem(fabric, globalExchangeRate, prev.marketType, prev.buyerType);
        })
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalExchangeRate]);
  const handleQuoteSettingChange = (field, value) => {
    // [사이드 이펙트 방지 방어 코드] extraMargin 변경 시 초기화 경고 예외 처리
    if (field === 'extraMargin') {
      setQuoteInput(prev => ({ ...prev, extraMargin: Number(value) || 0 }));
      return;
    }

    const hasManualOverride = (quoteInput.items || []).some(item => item.isManualOverride);
    if (['marketType', 'buyerType'].includes(field) && hasManualOverride) {
      const confirmReset = window.confirm("수동으로 변경된 단가가 있습니다. 설정을 변경하면 수정한 단가가 모두 초기화됩니다. 계속하시겠습니까?");
      if (!confirmReset) return;
    }

    setQuoteInput(prev => {
      const safeValue = value;
      let next = { ...prev, [field]: safeValue };
      if (field === 'marketType') next.currency = safeValue === 'export' ? 'USD' : 'KRW';
      
      // 확인을 누르면 모든 아이템 재계산 수행 후 덮어쓰기 (isManualOverride 초기화)
      if (['marketType', 'buyerType'].includes(field)) {
        next.items = next.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          return createQuoteItem(fabric, globalExchangeRate, next.marketType, next.buyerType);
        });
      }
      return next;
    });
  };

  const createQuoteItem = (fabric, currentExchangeRate, currentMarketType, currentBuyerType) => {
    const calc = calculateCost(fabric, currentExchangeRate);
    // calculateCost 반환값이 null/undefined일 때 방어 (삭제된 원단 등)
    if (!calc) {
      return {
        fabricId: fabric.id, article: fabric.article || 'N/A', itemName: fabric.itemName || '', widthCut: fabric.widthCut || 0, widthFull: fabric.widthFull || 0, gsm: fabric.gsm || 0,
        gYd: 0, mcqYd: 300, basePrice1k: 0, basePrice3k: 0, basePrice5k: 0,
      };
    }
    const isBrand = currentBuyerType === 'brand';
    // tier 객체가 없을 수 있으므로 옵셔널 체이닝 + 빈 객체 폴백
    const d1k = calc.tier1k?.[currentMarketType] ?? {}; 
    const d3k = calc.tier3k?.[currentMarketType] ?? {}; 
    const d5k = calc.tier5k?.[currentMarketType] ?? {};

    // MCQ는 실제 중량 베이스로 로스 10% 감안하여 계산
    const effectiveGYd = Number(calc.effectiveGYd) || 0;
    const weightWithLoss = effectiveGYd * 1.1;
    // effectiveGYd가 0이면 Infinity 방지 → MCQ 최소 300 보장
    const rawMcqYd = weightWithLoss > 0 ? (100000 / weightWithLoss) : 0;
    const roundedMcq = Math.round(rawMcqYd / 100) * 100;
    const finalMcqYd = Math.max(300, roundedMcq);

    return {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
      gYd: calc.theoreticalGYd ?? 0, 
      mcqYd: finalMcqYd,
      basePrice1k: (isBrand ? d1k.priceBrand : d1k.priceConverter) ?? 0,
      basePrice3k: (isBrand ? d3k.priceBrand : d3k.priceConverter) ?? 0,
      basePrice5k: (isBrand ? d5k.priceBrand : d5k.priceConverter) ?? 0,
    };
  };

  const handleAddFabricToQuote = (selectedFabricIdForQuote, setSelectedFabricIdForQuote) => {
    if (!selectedFabricIdForQuote) { showToast("견적서에 추가할 원단을 선택해주세요.", 'error'); return; }
    
    // [기획 요구사항 2] 중복 추가 방어 로직
    const isDuplicate = (quoteInput.items || []).some(item => String(item.fabricId) === String(selectedFabricIdForQuote));
    if (isDuplicate) {
      showToast("이미 추가된 품목입니다. 기존 항목을 확인해 주세요.", 'error');
      setSelectedFabricIdForQuote(''); 
      return;
    }

    const fabric = savedFabrics.find(f => String(f.id) === String(selectedFabricIdForQuote));
    if (!fabric) return;
    const newItem = createQuoteItem(fabric, globalExchangeRate, quoteInput.marketType, quoteInput.buyerType);
    setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), newItem] })); 
    setSelectedFabricIdForQuote(''); 
    showToast(`원단이 추가되었습니다.`, 'success');
  };

  const handleGridPaste = (text) => {
    const articles = String(text).split('\n').map(a => String(a).trim().toUpperCase()).filter(a => a);
    let newItems = [];
    let notFound = [];
    let duplicates = 0;

    articles.forEach(art => {
      // [기획 요구사항 2] 엑셀 복붙 시에도 기존 리스트 및 현재 추가 중인 리스트와 중복 비교 방어
      const isAlreadyInCurrentList = (quoteInput.items || []).some(item => String(item.article).toUpperCase() === art);
      const isAlreadyInNewItems = newItems.some(item => String(item.article).toUpperCase() === art);
      if (isAlreadyInCurrentList || isAlreadyInNewItems) {
        duplicates++;
        return;
      }

      const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
      if (fabric) { newItems.push(createQuoteItem(fabric, globalExchangeRate, quoteInput.marketType, quoteInput.buyerType)); }
      else { notFound.push(art); }
    });

    if (newItems.length > 0) {
      setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), ...newItems] }));
      showToast(`${newItems.length}개의 원단이 일괄 추가되었습니다.${duplicates > 0 ? ` (중복 제외됨: ${duplicates}건)` : ''}`, 'success');
    } else if (duplicates > 0) {
      showToast(`이미 추가된 품목입니다. (중복 제외됨: ${duplicates}건)`, 'error');
    }

    if (notFound.length > 0) alert(`다음 Article은 리스트에 없습니다:\n\n${notFound.join('\n')}`);
  };

  const handleQuoteBasePriceChange = (index, field, value) => {
    const newItems = [...quoteInput.items];
    // [기획오류 #13 수정] 음수 방어
    newItems[index][field] = Math.max(0, Number(value));
    // [Step 2] 수동 수정 상태 플래그 부여
    newItems[index].isManualOverride = true;
    setQuoteInput({ ...quoteInput, items: newItems });
  };
  
  const handleRemoveItemFromQuote = (index) => { 
    const newItems = quoteInput.items.filter((_, i) => i !== index); 
    setQuoteInput({ ...quoteInput, items: newItems }); 
  };

  const handleSaveQuote = (savedQuotesCallback) => {
    if (!quoteInput.buyerName) { showToast("바이어 이름을 입력해주세요.", 'error'); return; }
    if (!quoteInput.items || quoteInput.items.length === 0) { showToast("원단을 추가해주세요.", 'error'); return; }
    
    // [기획 요구사항 3] 저장(Save) 시 자동 정렬 (Article 기반 가나다/오름차순)
    const sortedItems = [...quoteInput.items].sort((a, b) => String(a.article).localeCompare(String(b.article)));
    
    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    // 기존 id가 있으면 유지(수정 모드) → 중복 생성 방지, 없으면 새 ID 부여 (스냅샷 정렬 배열 포함)
    const itemToSave = { id: quoteInput.id || Date.now(), createdAt: quoteInput.createdAt || new Date().toLocaleString(), authorName, ...quoteInput, items: sortedItems };
    
    // UI에 보여지는 상태도 즉시 정렬되게끔 업데이트
    setQuoteInput(prev => ({ ...prev, items: sortedItems }));

    if(savedQuotesCallback) savedQuotesCallback(itemToSave);
    saveDocToCloud('quotes', itemToSave); 
    showToast("견적 관리: 품목 코드(가나다) 순으로 자동 정렬되어 저장되었습니다.", 'success');
  };

  const handleDeleteQuote = async (id, syncQuoteCallback) => {
    if (!window.confirm("이 견적 히스토리를 정말 삭제하시겠습니까?")) return;
    if(syncQuoteCallback) syncQuoteCallback(id);
    try {
      await deleteDocFromCloud('quotes', id);
      showToast('견적 히스토리가 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  const handleDuplicateQuote = (quoteToCopy, navigateCallback) => {
    // ID와 Date를 갱신하여 복제본 생성
    const duplicatedQuote = {
      ...quoteToCopy,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      buyerName: quoteToCopy.buyerName + ' (Copy)'
    };
    setQuoteInput(duplicatedQuote);
    if(navigateCallback) navigateCallback();
    showToast("견적서가 성공적으로 복제되었습니다. (날짜 최신화)", 'success');
  };

  return {
    quoteInput, setQuoteInput,
    handleQuoteSettingChange, createQuoteItem,
    handleAddFabricToQuote, handleGridPaste, handleQuoteBasePriceChange,
    handleRemoveItemFromQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  };
};
