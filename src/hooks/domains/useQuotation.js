import { useState, useRef } from 'react';
import { calculateMcqYd, toTierRate, normalizeQuoteMargins, num, getBasePrice, convertMarginAdd, isNewMarginModel } from '../../utils/helpers';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅

// 빈 견적서 초기 상태 (신규 작성 / "새 견적서" 초기화 공용 팩토리)
// [마진 모델] 매출이익율(%)은 구간별 객체 — 일괄값(bulkMarginRate{1k,3k,5k}) + 원단별 개별(item.marginRate{1k,3k,5k}),
//             추가 영업마진은 구간별 YD당 정액(marginAdd) — 전체 적용.
// validityOption 기본값 '2weeks' = 작성일로부터 2주
const makeBlankQuote = () => ({
  buyerName: '', attention: '', marketType: 'domestic',
  currency: 'KRW', date: new Date().toISOString().split('T')[0],
  // 매출이익율 기본값: 1,000YD 22% / 3,000YD 20% / 5,000YD 18% (물량 많을수록 마진 낮춤)
  bulkMarginRate: { '1k': 22, '3k': 20, '5k': 18 }, marginAdd: { '1k': 0, '3k': 0, '5k': 0 },
  remarks: '', items: [], validityOption: '2weeks'
});

// [견적 환율 원칙 — 대표님 결정 2026-10-03]
//  · 견적 품목의 기준원가는 넣을 때의 원가·견적 환율(exchangeRate)로 저장하고, 환율이 바뀌어도 자동으로 다시 계산하지 않음
//  · 다시 계산은 [현재 원가로 다시 계산] 버튼(handleRecalcQuote)·복제 때 확인했을 때·시장구분 전환 때만
export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate) => {
  const [quoteInput, setQuoteInput] = useState(makeBlankQuote);
  const savingRef = useRef(false); // 저장 in-flight 가드 (빠른 더블클릭 중복 방지)

  // 품목 기준원가를 지금 원가로 다시 계산 (원단이 삭제된 품목은 그대로 두고 개수만 셈)
  //  convertDeleted: 통화가 바뀔 때(true = 원→$, false = $→원) 삭제된 원단 품목의 기준원가를 환율로만 환산
  const rebuildItems = (items, rate, marketType, convertDeleted = null) => {
    let missing = 0;
    const next = (items || []).map(item => {
      const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
      if (fabric) return createQuoteItem(fabric, rate, marketType, item.marginRate);
      missing++;
      if (convertDeleted === null) return item;
      const conv = (tier) => {
        const v = getBasePrice(item, tier);
        return convertDeleted ? Number((v / rate).toFixed(2)) : Math.round((v * rate) / 100) * 100;
      };
      return {
        ...item,
        basePrice1k: conv('1k'), basePrice3k: conv('3k'), basePrice5k: conv('5k'),
        costWarnings: [...(item.costWarnings || []), '원단이 삭제되어 기준원가를 환율로만 환산함'],
      };
    });
    return { items: next, missing };
  };

  const handleQuoteSettingChange = (field, value) => {
    if (field !== 'marketType') {
      setQuoteInput(prev => ({ ...prev, [field]: value }));
      return;
    }
    if (value === quoteInput.marketType) return;
    // 시장 구분(내수/수출) 변경: 기준원가는 통화·관세 기준이 달라 다시 계산해야 함 → 확인 후 '견적 환율'로 계산.
    //  YD당 정액은 같은 환율로 환산 (₩300 → $0.21). 예전엔 숫자가 그대로 남아 ₩300이 $300이 됐음.
    const items = quoteInput.items || [];
    const hasItems = items.length > 0;
    const hasAdd = ['1k', '3k', '5k'].some(t => Number(quoteInput.marginAdd?.[t]) > 0);
    if (hasItems && !isNewMarginModel(quoteInput)) {
      showToast('아주 옛날 방식(추가 마크업) 견적이라 시장 구분을 바꿀 수 없어요. 새 견적으로 작성해 주세요.', 'error');
      return;
    }
    const rate = Number(quoteInput.exchangeRate) || Number(globalExchangeRate) || 1450;
    const toUsd = value === 'export';
    if ((hasItems || hasAdd) && !window.confirm(
      `시장 구분을 ${toUsd ? '수출($)' : '내수(₩)'}로 바꿉니다.\n\n` +
      (hasItems ? `· 모든 품목 단가를 현재 원가로 다시 계산해요 (이 견적의 환율 ₩${num(rate)} 기준)\n` : '') +
      (hasAdd ? `· YD당 정액도 같은 환율로 환산해요\n` : '') +
      `\n계속할까요?`
    )) return;
    const rebuilt = rebuildItems(items, rate, value, toUsd);
    setQuoteInput(prev => ({
      ...prev,
      marketType: value,
      currency: toUsd ? 'USD' : 'KRW',
      exchangeRate: hasItems ? rate : prev.exchangeRate,
      marginAdd: convertMarginAdd(prev.marginAdd, toUsd, rate),
      items: rebuilt.items,
    }));
    if (rebuilt.missing > 0) showToast(`삭제된 원단 ${rebuilt.missing}개는 원가를 다시 계산하지 못해 환율로만 환산했어요.`, 'error');
  };

  // [현재 원가로 다시 계산] — 견적 단가는 저장 당시 값 그대로가 원칙이라, 누를 때만 지금 원가·지금 환율로 다시 계산.
  //  매출이익율·YD당 정액은 그대로 (YD당 정액은 견적 통화 금액이라 환율이 바뀌어도 그대로)
  const handleRecalcQuote = () => {
    const items = quoteInput.items || [];
    if (items.length === 0) { showToast('다시 계산할 품목이 없습니다.', 'error'); return; }
    if (!isNewMarginModel(quoteInput)) {
      showToast('아주 옛날 방식(추가 마크업) 견적이라 다시 계산할 수 없어요. 새 견적으로 작성해 주세요.', 'error');
      return;
    }
    const rate = Number(globalExchangeRate) || 1450;
    const oldRate = Number(quoteInput.exchangeRate) || null;
    if (!window.confirm(
      `모든 품목(${items.length}개)의 기준원가를 지금 원가(원가 설정·원사 단가)로 다시 계산합니다.\n` +
      `적용 환율: ${oldRate ? `₩${num(oldRate)}` : '기록 없음'} → ₩${num(rate)}\n` +
      `매출이익율과 YD당 정액은 그대로 둡니다.\n\n계속할까요?`
    )) return;
    const rebuilt = rebuildItems(items, rate, quoteInput.marketType);
    setQuoteInput(prev => ({ ...prev, exchangeRate: rate, items: rebuilt.items }));
    showToast(
      rebuilt.missing > 0
        ? `${items.length - rebuilt.missing}개 품목을 다시 계산했어요. (삭제된 원단 ${rebuilt.missing}개는 그대로)`
        : `${items.length}개 품목을 지금 원가로 다시 계산했어요.`,
      rebuilt.missing > 0 ? 'error' : 'success'
    );
  };

  // 구간별 YD당 정액(원/$) 입력 — 추가 영업마진(전체 적용). kind: 'add'
  const handleQuoteMarginChange = (kind, tier, value) => {
    const field = kind === 'rate' ? 'marginRate' : 'marginAdd';
    const v = Math.max(0, Number(value) || 0);
    setQuoteInput(prev => ({ ...prev, [field]: { ...(prev[field] || {}), [tier]: v } }));
  };

  // 일괄 매출이익율(%) — 특정 구간(tier)을 모든 원단의 같은 구간에 일괄 적용 (개별 수정분도 덮어씀). 0~99로 clamp.
  const handleBulkMarginRateChange = (tier, value) => {
    const v = Math.min(99, Math.max(0, Number(value) || 0));
    setQuoteInput(prev => ({
      ...prev,
      bulkMarginRate: { ...toTierRate(prev.bulkMarginRate), [tier]: v },
      items: (prev.items || []).map(it => ({
        ...it,
        marginRate: { ...toTierRate(it.marginRate), [tier]: v }
      }))
    }));
  };

  // 원단별 매출이익율(%) 개별 수정 — 특정 원단의 특정 구간(tier)만 변경. 0~99로 clamp.
  const handleQuoteItemMarginChange = (index, tier, value) => {
    const v = Math.min(99, Math.max(0, Number(value) || 0));
    setQuoteInput(prev => {
      const items = [...(prev.items || [])];
      if (!items[index]) return prev;
      items[index] = { ...items[index], marginRate: { ...toTierRate(items[index].marginRate), [tier]: v } };
      return { ...prev, items };
    });
  };

  // 견적 품목 생성. base = 영업 기준원가(도매 기준 priceConverter), 판가는 calcQuotePrice에서 마진 적용.
  // marginRate = 원단별 매출이익율(%) — 일괄값을 기본으로 받아 표에서 개별 수정 가능.
  // ⚠️ 기준원가는 이 시점 값으로 품목에 저장(basePrice1k/3k/5k)되고, 저장된 견적은 원가 설정·계산식이
  //    바뀌어도 다시 계산하지 않음 (견적을 열어 시장구분·환율을 바꾸거나 품목을 새로 넣을 때만 새로 계산).
  const createQuoteItem = (fabric, currentExchangeRate, currentMarketType, marginRate = 0) => {
    // marginRate는 구간별 객체 {1k,3k,5k} 또는 레거시 단일 숫자 모두 허용 → 객체로 정규화
    const safeMarginRate = toTierRate(marginRate);
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
    // 자동 계산 식: 100,000g ÷ (G/YD × (1 + 가공 LOSS%)), 100단위 올림 — 가공 LOSS는 품목 가공 유형별(원가 설정)
    // 자동값에는 최소 300 YD 안전망 유지(직접 입력값에는 안전망 미적용 — 담당자 의도 존중)
    const userMcqYd = Number(fabric.mcqYd) || 0;
    let finalMcqYd;
    if (userMcqYd > 0) {
      finalMcqYd = userMcqYd;
    } else {
      const effectiveGYd = Number(calc.effectiveGYd) || 0;
      const processLoss = Number(calc.processLossPct) || 0;
      const computed = calculateMcqYd(effectiveGYd, processLoss);
      finalMcqYd = Math.max(300, computed);
    }

    return {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
      gYd: calc.theoreticalGYd ?? 0,
      mcqYd: finalMcqYd,
      basePrice1k: d1k.priceConverter ?? 0,
      basePrice3k: d3k.priceConverter ?? 0,
      basePrice5k: d5k.priceConverter ?? 0,
      marginRate: safeMarginRate,   // 원단별 매출이익율(%) 구간별 객체 — 일괄값 기본, 표에서 구간마다 개별 수정 가능
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
    // 추가 항목은 견적의 기존 환율(있으면)로 계산 → 한 견적 안 항목들의 환율 일관성 유지(옛 견적에 추가해도 혼재 방지)
    const rate = quoteInput.exchangeRate || globalExchangeRate;
    const newItem = createQuoteItem(fabric, rate, quoteInput.marketType, quoteInput.bulkMarginRate);
    setQuoteInput(prev => ({ ...prev, exchangeRate: prev.exchangeRate || globalExchangeRate, items: [...(prev.items || []), newItem] }));
    setSelectedFabricIdForQuote('');
    showToast(`원단이 추가되었습니다.`, 'success');
  };

  const handleGridPaste = (text) => {
    const articles = String(text).split('\n').map(a => String(a).trim().toUpperCase()).filter(a => a);
    // 추가 항목은 견적의 기존 환율(있으면)로 계산 → 환율 일관성 유지
    const rate = quoteInput.exchangeRate || globalExchangeRate;
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
      if (fabric) { newItems.push(createQuoteItem(fabric, rate, quoteInput.marketType, quoteInput.bulkMarginRate)); }
      else { notFound.push(art); }
    });

    if (newItems.length > 0) {
      setQuoteInput(prev => ({ ...prev, exchangeRate: prev.exchangeRate || globalExchangeRate, items: [...(prev.items || []), ...newItems] }));
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

  // [신규] 현재 작성 중인 견적서를 비우고 새 견적서 시작
  // 작성 중 내용이 있으면 확인 후 초기화 (수정/복제 모드의 id·createdAt 도 함께 제거됨 → 신규 저장으로 동작)
  // skipConfirm=true : 워크스페이스의 변경사항 가드가 이미 처리했을 때 훅 자체 confirm 생략
  const handleNewQuote = (skipConfirm = false) => {
    const hasContent =
      (quoteInput.items && quoteInput.items.length > 0) ||
      quoteInput.buyerName || quoteInput.attention || quoteInput.remarks;
    if (!skipConfirm && hasContent && !window.confirm("현재 작성 중인 견적서를 비우고 새 견적서를 시작할까요?\n저장하지 않은 내용은 사라집니다.")) return;
    setQuoteInput(makeBlankQuote());
    showToast("새 견적서를 시작합니다.", 'success');
  };

  // 저장: 클라우드 저장 성공 시 itemToSave.id 반환, 검증 실패/중복호출/저장실패 시 false.
  //  - async로 saveDocToCloud 결과를 관찰 → 실패 시 성공 토스트/로컬 목록 반영 안 함(거짓 성공 방지)
  //  - savingRef로 빠른 더블클릭 중복 저장 차단
  const handleSaveQuote = async (savedQuotesCallback) => {
    if (savingRef.current) return false; // 저장 진행 중이면 무시
    if (!quoteInput.buyerName) { showToast("바이어 이름을 입력해주세요.", 'error'); return false; }
    if (!quoteInput.items || quoteInput.items.length === 0) { showToast("원단을 추가해주세요.", 'error'); return false; }

    // [기획 요구사항 3] 저장(Save) 시 자동 정렬 (Article 기반 가나다/오름차순)
    const sortedItems = [...quoteInput.items].sort((a, b) => String(a.article).localeCompare(String(b.article)));

    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    // 기존 id가 있으면 유지(수정 모드) → 중복 생성 방지, 없으면 새 ID 부여 (스냅샷 정렬 배열 포함)
    // exchangeRate: 이 견적의 단가(원가)를 계산할 때 적용된 환율.
    //   항목을 추가/재계산할 때 quoteInput.exchangeRate가 설정됨(add 경로/effect/시장전환).
    //   그런 변경 없이 저장하면 작성 당시 환율을 그대로 보존 → 기록(record)이 어긋나지 않음.
    //   레거시 견적(환율 미기록)은 현재 환율을 억지로 찍지 않고 null(미상)로 둠 → 잘못된 기록 방지.
    const savedRate = quoteInput.exchangeRate ?? null;
    const itemToSave = { id: quoteInput.id || Date.now(), createdAt: quoteInput.createdAt || new Date().toLocaleString(), authorName, ...quoteInput, items: sortedItems, exchangeRate: savedRate };

    // id/생성일/환율/정렬을 즉시 반영 → 다시 Save 눌러도 같은 문서를 덮어써 중복 저장 방지(저장 실패해도 id는 고정)
    setQuoteInput(prev => ({ ...prev, id: itemToSave.id, createdAt: itemToSave.createdAt, exchangeRate: savedRate, items: sortedItems }));

    savingRef.current = true;
    try {
      const ok = await saveDocToCloud('quotes', itemToSave);
      if (ok === false) return false; // 클라우드 저장 실패 → 성공 토스트/로컬 목록 반영 안 함(saveDocToCloud가 실패 토스트 표시)
      if (savedQuotesCallback) savedQuotesCallback(itemToSave);
      showToast("견적 관리: 품목 코드(가나다) 순으로 자동 정렬되어 저장되었습니다.", 'success');
      return itemToSave.id;
    } finally {
      savingRef.current = false;
    }
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
    // 복제본은 새 견적 — 작성자·작성일은 저장하는 사람·시점으로 (원본 값은 빼고 복사)
    const { authorName: _authorName, createdAt: _createdAt, ...rest } = quoteToCopy;
    let duplicatedQuote = normalizeQuoteMargins({
      ...rest,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      buyerName
    });
    // 단가: 원본 견적 당시 값 그대로 / 지금 원가로 다시 계산 — 물어봄 (아주 옛날 방식 견적은 그대로 복제)
    let recalculated = false;
    let missing = 0;
    if (isNewMarginModel(duplicatedQuote) && (duplicatedQuote.items || []).length > 0) {
      const rate = Number(globalExchangeRate) || 1450;
      const oldRate = Number(duplicatedQuote.exchangeRate) || null;
      if (window.confirm(
        `복제한 견적의 단가를 지금 원가로 다시 계산할까요?\n\n` +
        `[확인] 지금 원가·지금 환율(₩${num(rate)})로 다시 계산 (권장)\n` +
        `[취소] 원본 견적 당시 단가 그대로${oldRate ? ` (원본 환율 ₩${num(oldRate)})` : ''}`
      )) {
        const rebuilt = rebuildItems(duplicatedQuote.items, rate, duplicatedQuote.marketType);
        duplicatedQuote = { ...duplicatedQuote, exchangeRate: rate, items: rebuilt.items };
        recalculated = true;
        missing = rebuilt.missing;
      }
    }
    setQuoteInput(duplicatedQuote);
    if(navigateCallback) navigateCallback();
    if (missing > 0) showToast(`복제했어요. 삭제된 원단 ${missing}개는 원본 단가 그대로예요.`, 'error');
    else showToast(recalculated ? '견적서를 복제하고 단가를 지금 원가로 다시 계산했어요.' : '견적서를 복제했어요. (단가는 원본 견적 그대로)', 'success');
  };

  return {
    quoteInput, setQuoteInput,
    handleQuoteSettingChange, handleRecalcQuote, createQuoteItem,
    handleQuoteMarginChange, handleBulkMarginRateChange, handleQuoteItemMarginChange,
    handleAddFabricToQuote, handleGridPaste,
    handleRemoveItemFromQuote, handleNewQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  };
};
