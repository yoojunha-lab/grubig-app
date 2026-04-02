import { useState, useEffect } from 'react';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅

export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate) => {
  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', attention: '', buyerType: 'converter', marketType: 'domestic', currency: 'KRW', date: new Date().toISOString().split('T')[0], extraMargin: 0, remarks: '', items: []
  });

  // 글로벌 환율 변동 시 기존 아이템 단가 재계산 연동
  useEffect(() => {
    if (quoteInput.items && quoteInput.items.length > 0 && quoteInput.marketType) {
      setQuoteInput(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          return createQuoteItem(fabric, globalExchangeRate, prev.marketType, prev.buyerType);
        })
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalExchangeRate, savedFabrics]);

  const handleQuoteSettingChange = (field, value) => {
    setQuoteInput(prev => {
      // extraMargin: 빈 문자열·NaN 방어 → 0으로 폴백
      const safeValue = field === 'extraMargin' ? (Number(value) || 0) : value;
      let next = { ...prev, [field]: safeValue };
      if (field === 'marketType') next.currency = safeValue === 'export' ? 'USD' : 'KRW';

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
    articles.forEach(art => {
      const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
      if (fabric) { newItems.push(createQuoteItem(fabric, globalExchangeRate, quoteInput.marketType, quoteInput.buyerType)); }
      else { notFound.push(art); }
    });
    if (newItems.length > 0) {
      setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), ...newItems] }));
      showToast(`${newItems.length}개의 원단이 일괄 추가되었습니다.`, 'success');
    }
    if (notFound.length > 0) alert(`다음 Article은 리스트에 없습니다:\n\n${notFound.join('\n')}`);
  };

  const handleQuoteBasePriceChange = (index, field, value) => {
    const newItems = [...quoteInput.items];
    // [기획오류 #13 수정] 음수 방어
    newItems[index][field] = Math.max(0, Number(value));
    setQuoteInput({ ...quoteInput, items: newItems });
  };
  
  const handleRemoveItemFromQuote = (index) => { 
    const newItems = quoteInput.items.filter((_, i) => i !== index); 
    setQuoteInput({ ...quoteInput, items: newItems }); 
  };

  const handleSaveQuote = (savedQuotesCallback) => {
    if (!quoteInput.buyerName) { showToast("바이어 이름을 입력해주세요.", 'error'); return; }
    if (!quoteInput.items || quoteInput.items.length === 0) { showToast("원단을 추가해주세요.", 'error'); return; }
    
    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    // 기존 id가 있으면 유지(수정 모드) → 중복 생성 방지, 없으면 새 ID 부여
    const itemToSave = { id: quoteInput.id || Date.now(), createdAt: quoteInput.createdAt || new Date().toLocaleString(), authorName, ...quoteInput };
    
    if(savedQuotesCallback) savedQuotesCallback(itemToSave);
    saveDocToCloud('quotes', itemToSave); 
    showToast("견적서가 저장되었습니다.", 'success');
  };

  const handleDeleteQuote = (id, syncQuoteCallback) => {
    if (window.confirm("이 견적 히스토리를 정말 삭제하시겠습니까?")) {
      if(syncQuoteCallback) syncQuoteCallback(id);
      deleteDocFromCloud('quotes', id);
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
