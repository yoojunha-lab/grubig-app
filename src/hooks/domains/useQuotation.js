import { useState } from 'react';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅

export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', buyerType: 'converter', marketType: 'domestic', currency: 'KRW', exchangeRate: 1450, date: new Date().toISOString().split('T')[0], extraMargin: 0, remarks: '', items: []
  });

  const handleQuoteSettingChange = (field, value) => {
    setQuoteInput(prev => {
      let next = { ...prev, [field]: value };
      if (field === 'marketType') next.currency = value === 'export' ? 'USD' : 'KRW';

      if (['exchangeRate', 'marketType', 'buyerType'].includes(field)) {
        next.items = next.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          return createQuoteItem(fabric, next.exchangeRate, next.marketType, next.buyerType);
        });
      }
      return next;
    });
  };

  const createQuoteItem = (fabric, currentExchangeRate, currentMarketType, currentBuyerType) => {
    const calc = calculateCost(fabric, currentExchangeRate);
    const isBrand = currentBuyerType === 'brand';
    const d1k = calc.tier1k[currentMarketType]; 
    const d3k = calc.tier3k[currentMarketType]; 
    const d5k = calc.tier5k[currentMarketType];

    // MCQ는 실제 중량 베이스로 로스 10% 감안하여 계산
    const weightWithLoss = calc.effectiveGYd * 1.1;
    const rawMcqYd = 100000 / weightWithLoss;
    const roundedMcq = Math.round(rawMcqYd / 100) * 100;
    const finalMcqYd = Math.max(300, roundedMcq);

    return {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
      gYd: calc.theoreticalGYd, 
      mcqYd: finalMcqYd,
      basePrice1k: isBrand ? d1k.priceBrand : d1k.priceConverter,
      basePrice3k: isBrand ? d3k.priceBrand : d3k.priceConverter,
      basePrice5k: isBrand ? d5k.priceBrand : d5k.priceConverter,
    };
  };

  const handleAddFabricToQuote = (selectedFabricIdForQuote, setSelectedFabricIdForQuote) => {
    if (!selectedFabricIdForQuote) { showToast("견적서에 추가할 원단을 선택해주세요.", 'error'); return; }
    const fabric = savedFabrics.find(f => String(f.id) === String(selectedFabricIdForQuote));
    if (!fabric) return;
    const newItem = createQuoteItem(fabric, quoteInput.exchangeRate, quoteInput.marketType, quoteInput.buyerType);
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
      if (fabric) { newItems.push(createQuoteItem(fabric, quoteInput.exchangeRate, quoteInput.marketType, quoteInput.buyerType)); }
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
    newItems[index][field] = Number(value);
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
    const itemToSave = { id: Date.now(), createdAt: new Date().toLocaleString(), authorName, ...quoteInput };
    
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

  return {
    quoteInput, setQuoteInput,
    handleQuoteSettingChange, createQuoteItem,
    handleAddFabricToQuote, handleGridPaste, handleQuoteBasePriceChange,
    handleRemoveItemFromQuote, handleSaveQuote, handleDeleteQuote
  };
};
