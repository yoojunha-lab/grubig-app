import { useState, useEffect, useRef } from 'react';
import { calculateMcqYd } from '../../utils/helpers';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅

export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate, setGlobalExchangeRate) => {
  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', attention: '', marketType: 'domestic', currency: 'KRW', date: new Date().toISOString().split('T')[0],
    // [마진 개편] 매출이익율(%)은 일괄값(원단별로 개별 수정 가능, item.marginRate에 저장) + YD당 정액(구간별).
    bulkMarginRate: 0, marginAdd: { '1k': 0, '3k': 0, '5k': 0 },
    remarks: '', items: []
  });

  // 글로벌 환율 변동 감지 및 재계산 (기준원가만 재계산, 원단별 매출이익율은 보존)
  const isMountedRef = useRef(false);
  const prevExchangeRateRef = useRef(globalExchangeRate);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      prevExchangeRateRef.current = globalExchangeRate;
      return;
    }
    if (prevExchangeRateRef.current === globalExchangeRate) return;

    if (quoteInput.items && quoteInput.items.length > 0 && quoteInput.marketType) {
      setQuoteInput(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          // 환율 변동 → 기준원가만 재계산. 원단별 매출이익율(marginRate)은 유지.
          return createQuoteItem(fabric, globalExchangeRate, prev.marketType, item.marginRate);
        })
      }));
    }
    prevExchangeRateRef.current = globalExchangeRate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalExchangeRate]);

  const handleQuoteSettingChange = (field, value) => {
    setQuoteInput(prev => {
      let next = { ...prev, [field]: value };
      // 시장 구분(내수/수출) 변경 시: 통화 갱신 + 기준원가 재계산(매출이익율은 보존)
      if (field === 'marketType') {
        next.currency = value === 'export' ? 'USD' : 'KRW';
        next.items = (next.items || []).map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          return createQuoteItem(fabric, globalExchangeRate, next.marketType, item.marginRate);
        });
      }
      return next;
    });
  };

  // 구간별 YD당 정액(원/$) 입력. (kind: 'add' — 매출이익율은 일괄/원단별로 별도 관리)
  const handleQuoteMarginChange = (kind, tier, value) => {
    const field = kind === 'rate' ? 'marginRate' : 'marginAdd';
    const v = Math.max(0, Number(value) || 0);
    setQuoteInput(prev => ({ ...prev, [field]: { ...(prev[field] || {}), [tier]: v } }));
  };

  // 일괄 매출이익율(%) — 모든 원단에 일괄 적용 (개별 수정분도 덮어씀). 0~99로 clamp.
  const handleBulkMarginRateChange = (value) => {
    const v = Math.min(99, Math.max(0, Number(value) || 0));
    setQuoteInput(prev => ({
      ...prev,
      bulkMarginRate: v,
      items: (prev.items || []).map(it => ({ ...it, marginRate: v }))
    }));
  };

  // 원단별 매출이익율(%) 개별 수정. 0~99로 clamp.
  const handleQuoteItemMarginChange = (index, value) => {
    const v = Math.min(99, Math.max(0, Number(value) || 0));
    setQuoteInput(prev => {
      const items = [...(prev.items || [])];
      if (!items[index]) return prev;
      items[index] = { ...items[index], marginRate: v };
      return { ...prev, items };
    });
  };

  const createQuoteItem = (fabric, currentExchangeRate, currentMarketType, marginRate = 0) => {
    const safeMarginRate = Math.min(99, Math.max(0, Number(marginRate) || 0));
    const calc = calculateCost(fabric, currentExchangeRate);
    // calculateCost 반환값이 null/undefined일 때 방어 (삭제된 원단 등)
    if (!calc) {
      return {
        fabricId: fabric.id, article: fabric.article || 'N/A', itemName: fabric.itemName || '', widthCut: fabric.widthCut || 0, widthFull: fabric.widthFull || 0, gsm: fabric.gsm || 0,
        gYd: 0, mcqYd: 300, basePrice1k: 0, basePrice3k: 0, basePrice5k: 0, marginRate: safeMarginRate,
      };
    }
    // tier 객체가 없을 수 있으므로 옵셔널 체이닝 + 빈 객체 폴백
    const d1k = calc.tier1k?.[currentMarketType] ?? {};
    const d3k = calc.tier3k?.[currentMarketType] ?? {}; 
    const d5k = calc.tier5k?.[currentMarketType] ?? {};

    // MCQ 결정: 원단에 직접 입력값(fabric.mcqYd)이 있으면 우선, 없으면 자동 계산
    // 자동 계산 식: 100,000g ÷ (G/YD × (1 + 1K tier 염색 LOSS%)), 100단위 올림
    // 자동값에는 최소 300 YD 안전망 유지(직접 입력값에는 안전망 미적용 — 담당자 의도 존중)
    const userMcqYd = Number(fabric.mcqYd) || 0;
    let finalMcqYd;
    if (userMcqYd > 0) {
      finalMcqYd = userMcqYd;
    } else {
      const effectiveGYd = Number(calc.effectiveGYd) || 0;
      const dyeLoss1k = Number(fabric.losses?.tier1k?.dye) || 0;
      const computed = calculateMcqYd(effectiveGYd, dyeLoss1k);
      finalMcqYd = Math.max(300, computed);
    }

    return {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
      gYd: calc.theoreticalGYd ?? 0,
      mcqYd: finalMcqYd,
      basePrice1k: d1k.priceConverter ?? 0,
      basePrice3k: d3k.priceConverter ?? 0,
      basePrice5k: d5k.priceConverter ?? 0,
      marginRate: safeMarginRate,   // 원단별 매출이익율(%) — 일괄값 기본, 표에서 개별 수정 가능
    };
  };

  // 원단 선택 팝업에서 원단 1개를 견적에 추가 (중복 방지). 신규 품목은 일괄 매출이익율을 기본 적용.
  const addFabricToQuoteById = (fabricId) => {
    if (!fabricId) return false;
    const isDuplicate = (quoteInput.items || []).some(item => String(item.fabricId) === String(fabricId));
    if (isDuplicate) { showToast("이미 추가된 품목입니다.", 'error'); return false; }
    const fabric = savedFabrics.find(f => String(f.id) === String(fabricId));
    if (!fabric) { showToast("원단을 찾을 수 없습니다.", 'error'); return false; }
    const newItem = createQuoteItem(fabric, globalExchangeRate, quoteInput.marketType, quoteInput.bulkMarginRate);
    setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    showToast(`${fabric.article} 추가됨`, 'success');
    return true;
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
      if (fabric) { newItems.push(createQuoteItem(fabric, globalExchangeRate, quoteInput.marketType, quoteInput.bulkMarginRate)); }
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
    // [U2] ID와 Date를 갱신하여 복제본 생성. 이미 "(Copy)"로 끝나면 추가하지 않아 누적 방지
    const rawName = String(quoteToCopy.buyerName || '');
    const buyerName = / \(Copy\)$/.test(rawName) ? rawName : `${rawName} (Copy)`;
    const duplicatedQuote = {
      ...quoteToCopy,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      buyerName
    };
    setQuoteInput(duplicatedQuote);
    if(navigateCallback) navigateCallback();
    showToast("견적서가 성공적으로 복제되었습니다. (날짜 최신화)", 'success');
  };

  return {
    quoteInput, setQuoteInput,
    handleQuoteSettingChange, handleQuoteMarginChange,
    handleBulkMarginRateChange, handleQuoteItemMarginChange,
    createQuoteItem, addFabricToQuoteById, handleGridPaste,
    handleRemoveItemFromQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  };
};
