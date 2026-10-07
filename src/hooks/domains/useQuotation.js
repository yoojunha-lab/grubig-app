import { useState, useRef } from 'react';
import { calculateMcqYd, num, todayLocalISO, rateForMarket, rateLabel } from '../../utils/helpers';
import { QUOTE_TIERS, QUOTE_TIER_KEYS, DEFAULT_SHOWN_TIERS, DEFAULT_CUSTOM_QTY, DEFAULT_CUSTOM_COLORS } from '../../constants/quote';
import {
  normalizeQuote, isNewMarginModel, convertMarginAdd, convertAmount, convertBasePrice, convertCostParts,
  makeDefaultTierRates, makeDefaultTierAdds, toQuoteTierRate, toQuoteTierAdd, defaultTierAdd, computeBaseFromParts, partsFromCost,
  getBasePrice, getShownTiers, getCustomExclude, describeTierDefaults, getMarginAddCurrency, quoteMarket,
  normalizeRunning, customRowCostOpts, sumColorQtys, validateRunning, calcCustomQuotePrice,
} from '../../utils/quoteModel';
import { devQuoteToFabric } from '../../utils/devQuoteModel';

// GRUBIG ERP - 견적서(Quotation) 도메인 로직 및 훅
//
// [구조 — 2026-10-05 개편]
//  · 기준 견적(items): 품목마다 300~5,000YD 6구간 기준원가(basePrice{구간})를 저장. 바이어 견적서에는 고른 구간(shownTiers)만.
//  · 별도 견적(customItems): 줄마다 수량·컬러수를 넣어 원가부터 다시 계산.
//  · 외관검사·시험성적서(이화학) 제외: 기준 견적 전체(excludeVisual/excludeChem) · 별도 견적 전체
//    (customExcludeVisual/customExcludeChem). 원가 조각(costParts)을 같이 저장해서 버튼을 바꾸면
//    다른 원가는 그대로 두고 그 항목만 빼고 넣음.
//  · 원단 추가는 두 칸이 같은 방식 — [원단 검색·추가] 팝업, Article 입력(Enter)·엑셀 세로 복붙, 같은 원단은 한 줄만.
//  · 기준 견적서·별도 견적서는 PDF·엑셀을 따로 출력 (App.jsx handleDownloadPDF / handleDownloadQuoteExcel 의 kind)
//  · 계산 규칙(판매가·기본값·정규화)은 utils/quoteModel.js, 구간·기본 마진은 constants/quote.js
//  · [개발 의뢰 원가 견적 — 2026-10-06] 원단 리스트에 없는 개발 품목도 넣을 수 있음: 의뢰의 원가 견적(costQuote)을
//    '원단 모양'으로 바꿔서(utils/devQuoteModel.devQuoteToFabric) 원단과 똑같이 계산 — fabricId = 의뢰 id,
//    Article = 개발번호. 다시 계산·복제·별도 견적 복사도 findFabric 한 곳에서 의뢰를 찾아 그대로 동작
//  · [러닝 생지 견적 — 2026-10-07] 별도 견적 줄의 한 종류 (row.running = { greigeQty 생지 짠 수량, colorQtys 컬러별 수량 })
//    — 원사·편직은 생지 짠 수량으로 짠 원가, 염색은 컬러별 실제 수량 (실비). [러닝 생지 견적] 창에서 넣고 고침
//    (previewRunningRow·handleSaveRunningRow·handleReleaseRunningRow). 다시 계산·시장 전환·복제는 createCustomItem이 그대로 반영

// 빈 견적서 초기 상태 (신규 작성 / "새 견적서" 초기화 공용 팩토리)
// validityOption 기본값 '2weeks' = 작성일로부터 2주
const makeBlankQuote = () => ({
  buyerName: '', attention: '', marketType: 'domestic',
  currency: 'KRW', date: todayLocalISO(),
  // 구간별 매출이익율·YD당 정액 기본값 (대표님 지정 2026-10-05)
  //  300·500YD 25% · 2,000원 / 800YD 23% · 1,500원 / 1,000YD 20% · 1,000원 / 3,000YD 20% · 800원 / 5,000YD 20% · 500원
  bulkMarginRate: makeDefaultTierRates(), marginAdd: makeDefaultTierAdds('KRW'),
  marginAddCurrency: 'KRW',                   // YD당 정액은 항상 원화로 적음 — 수출 견적은 견적 환율로 나눠 $로 더함
  shownTiers: [...DEFAULT_SHOWN_TIERS],      // 바이어 견적서에 보여줄 구간 (기본 500·800·1,000·3,000YD)
  excludeVisual: false, excludeChem: false,   // 기준 견적 전체: 외관검사·시험성적서(이화학) 제외
  customExcludeVisual: false, customExcludeChem: false, // 별도 견적 전체: 외관검사·시험성적서(이화학) 제외
  remarks: '', items: [], customItems: [], validityOption: '2weeks'
});

// 별도 견적 줄 id
const newRowId = () => `cq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const DELETED_NOTE = '원단(또는 개발 의뢰)이 삭제되어 기준원가를 환율로만 환산함';
// 2026-10-06 전 문구 — 예전 견적에 남아 있으면 새 문구를 붙일 때 빼서 같은 뜻의 경고가 두 줄 나오지 않게
const LEGACY_DELETED_NOTE = '원단이 삭제되어 기준원가를 환율로만 환산함';
const addNote = (warnings, note) => [...new Set([...(warnings || []).filter(w => w !== LEGACY_DELETED_NOTE), note])];
const isBlank = (v) => v === undefined || v === null || v === '';

// [견적 환율 원칙 — 대표님 결정 2026-10-03]
//  · 견적 품목의 기준원가는 넣을 때의 원가·견적 환율(exchangeRate)로 저장하고, 환율이 바뀌어도 자동으로 다시 계산하지 않음
//  · 다시 계산은 [현재 원가로 다시 계산] 버튼(handleRecalcQuote)·복제 때 확인했을 때·시장구분 전환 때만
//  · 별도 견적 줄은 수량·컬러를 바꾸면 그 줄만 견적 환율로 다시 계산 (새로 넣는 것과 같음)
//  · [2026-10-07] 공통 환율이 내수 환율·수출 환율 두 칸 → 견적 환율은 그 견적 시장의 환율로 정함
//    (내수 견적 = 내수 환율, 수출 견적 = 수출 환율. 시장 구분을 바꾸면 바꾼 시장의 지금 환율로 다시 계산)
//  exchangeRates: 화면 위 공통 환율 두 칸 { domestic, export }
export const useQuotation = (savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, exchangeRates, calculateCostAtQty, devRequests = []) => {
  const [quoteInput, setQuoteInput] = useState(makeBlankQuote);
  const savingRef = useRef(false); // 저장 in-flight 가드 (빠른 더블클릭 중복 방지)

  // 품목의 원단 찾기 — 원단 리스트에 없으면 개발 의뢰(원가 견적을 저장한 의뢰)를 '원단 모양'으로 (fabricId = 의뢰 id)
  //  → 다시 계산·복제·별도 견적 복사가 개발 품목도 원단과 똑같이 동작. 둘 다 없으면 undefined (삭제된 품목)
  const findFabric = (fabricId) =>
    savedFabrics.find(f => String(f.id) === String(fabricId))
    || devQuoteToFabric((devRequests || []).find(d => String(d.id) === String(fabricId)))
    || undefined;
  // Article로 원단 찾기 — 없으면 개발번호로 (원가 견적을 저장한 개발 의뢰만). 표 아래 Article 입력·엑셀 복붙용
  const findByArticle = (art) => {
    const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
    if (fabric) return fabric;
    const dev = (devRequests || []).find(d => d?.costQuote && String(d.devOrderNo || '').trim().toUpperCase() === art);
    return dev ? devQuoteToFabric(dev) : null;
  };
  // 시장에 맞는 지금 공통 환율 — 내수 견적은 내수 환율, 수출 견적은 수출 환율
  const currentRateFor = (marketType) => rateForMarket(exchangeRates, marketType);
  // 이 견적의 환율 (품목을 넣을 때 기록. 아직 없으면 그 시장의 지금 환율)
  const quoteRateOf = (q) => Number(q?.exchangeRate) || currentRateFor(quoteMarket(q));
  const currencyOf = (marketType) => (marketType === 'export' ? 'USD' : 'KRW');
  const excludeOf = (q) => ({ excludeVisual: q?.excludeVisual === true, excludeChem: q?.excludeChem === true });

  // MCQ 결정: 원단에 직접 입력값(fabric.mcqYd)이 있으면 우선, 없으면 자동 계산
  // 자동 계산 식: 100,000g ÷ (G/YD × (1 + 가공 LOSS%)), 100단위 올림 — 가공 LOSS는 품목 가공 유형별(원가 설정)
  // 자동값에는 최소 300 YD 안전망 유지(직접 입력값에는 안전망 미적용 — 담당자 의도 존중)
  const resolveMcqYd = (fabric, calc) => {
    const userMcqYd = Number(fabric.mcqYd) || 0;
    if (userMcqYd > 0) return userMcqYd;
    return Math.max(300, calculateMcqYd(Number(calc?.effectiveGYd) || 0, Number(calc?.processLossPct) || 0));
  };

  const fabricSpec = (fabric, calc) => ({
    fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName,
    widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
    gYd: calc?.theoreticalGYd ?? 0,
    mcqYd: resolveMcqYd(fabric, calc),
    // 개발 의뢰 원가 견적에서 온 품목이면 표시용 출처 ('devRequest' — 견적서 화면의 '개발' 배지)
    ...(fabric.sourceType ? { sourceType: fabric.sourceType } : {}),
  });

  // 기준 견적 품목 생성. base = 영업 기준원가(원가 표 같은 구간의 finalCostYd), 판가는 calcQuotePrice에서 마진 적용.
  // marginRate = 원단별 매출이익율(%) — 일괄값을 기본으로 받아 표에서 개별 수정 가능.
  // ⚠️ 기준원가는 이 시점 값으로 품목에 저장(basePrice{구간})되고, 저장된 견적은 원가 설정·계산식·환율이 바뀌어도
  //    다시 계산하지 않음. costParts(원가 조각)는 외관검사·시험성적서 빼기를 다시 적용할 때만 씀.
  //  calc: 같은 원단·같은 환율로 이미 계산해 둔 원가 표 결과(calculateCost)가 있으면 넘겨받아 그대로 씀
  //   (개발 의뢰 원가 견적 창 — 원가 표와 판매가 미리보기가 원가 엔진을 두 번 돌리지 않게)
  const createQuoteItem = (fabric, { rate, marketType = 'domestic', marginRate, excludeVisual = false, excludeChem = false, calc: givenCalc = null } = {}) => {
    const currency = currencyOf(marketType);
    const safeMarginRate = toQuoteTierRate(marginRate);
    const calc = givenCalc || calculateCost(fabric, rate);
    // calculateCost 반환값이 null/undefined일 때 방어 (삭제된 원단 등)
    if (!calc) {
      return {
        fabricId: fabric.id, article: fabric.article || 'N/A', itemName: fabric.itemName || '', widthCut: fabric.widthCut || 0, widthFull: fabric.widthFull || 0, gsm: fabric.gsm || 0,
        gYd: 0, mcqYd: 300, marginRate: safeMarginRate,
        ...Object.fromEntries(QUOTE_TIER_KEYS.map(k => [`basePrice${k}`, 0])),
        costWarnings: ['원가를 계산하지 못함 (기준원가 0)'],
      };
    }
    const costParts = {};
    const basePrices = {};
    let riskPct = 0;
    QUOTE_TIERS.forEach(t => {
      // 원가 표 구간 결과를 그대로 씀 (원가 표에 없는 구간이면 같은 가정으로 수량 계산)
      const tc = calc[t.costKey]
        || (calculateCostAtQty ? calculateCostAtQty(fabric, t.qty, rate, { colors: t.colors, assumeMcq: t.assumeMcq }) : null);
      const parts = partsFromCost(tc?.[marketType]);
      riskPct = Number(tc?.riskPct) || riskPct;
      costParts[t.key] = parts;
      basePrices[`basePrice${t.key}`] = computeBaseFromParts(parts, tc?.riskPct, { excludeVisual, excludeChem }, currency);
    });
    return {
      ...fabricSpec(fabric, calc),
      ...basePrices,
      costParts, riskPct,
      marginRate: safeMarginRate,   // 원단별 매출이익율(%) 구간별 객체 — 일괄값 기본, 표에서 구간마다 개별 수정 가능
      // '원가 확인 필요' 사유 (혼용률·미등록 원사·단가 0원 등) — 기준원가와 같이 이 시점 값으로 저장, 품목 표에 배지로 표시
      costWarnings: calc.costWarnings || [],
    };
  };

  // 별도 견적 줄 만들기 / 다시 계산 — 수량·컬러수를 그대로 원가 엔진에 넣음
  //  (컬러수만큼 이화학, 컬러당 생지가 최소 청구 kg 미만이면 염색 최소 청구가 자동으로 붙음)
  //  수량·컬러가 비었거나 0이면 기준원가 없이(null) 둠 → 판가 '—' (입력 중)
  //  exclude: 별도 견적 전체의 외관검사·시험성적서 제외 (줄마다 하던 예전 값은 버림)
  //  [러닝 생지 견적] row.running이 있으면 원사·편직은 생지 짠 수량으로 짠 원가, 염색은 컬러별 실제 수량.
  //   수량 = 컬러별 합계, 컬러 = 칸 수로 맞춰 둠 (견적서·견적 목록·출력 전 확인이 일반 줄과 같이 읽음)
  const createCustomItem = (fabric, row, { rate, marketType = 'domestic', exclude = {} }) => {
    const currency = currencyOf(marketType);
    const running = normalizeRunning(row.running);
    const qty = running ? sumColorQtys(running.colorQtys) : Math.round(Number(row.qty) || 0);
    const colors = running ? running.colorQtys.length : Math.round(Number(row.colors) || 0);
    const calc = calculateCost(fabric, rate);
    const { excludeVisual: _oldVisual, excludeChem: _oldChem, running: _oldRunning, ...rest } = row;
    const base = {
      ...rest,
      id: row.id || newRowId(),
      ...fabricSpec(fabric, calc),
      qty: running ? qty : row.qty, colors: running ? colors : row.colors,
      ...(running ? { running } : {}),                                // 러닝 생지 줄만 (일반 줄에는 이 칸이 없음)
      marginRate: isBlank(row.marginRate) ? null : row.marginRate,   // 비우면 수량 구간의 견적 일괄값
      marginAdd: isBlank(row.marginAdd) ? null : row.marginAdd,      // 비우면 수량 구간의 견적 정액
      show: row.show !== false,                                       // 별도 견적서에 표시
      costWarnings: calc?.costWarnings || [],
    };
    if (!(qty > 0 && colors > 0) || !calculateCostAtQty) return { ...base, basePrice: null, costParts: null, dye: null };
    const tc = calculateCostAtQty(fabric, qty, rate, customRowCostOpts({ running, colors }));
    const costParts = partsFromCost(tc?.[marketType]);
    return {
      ...base,
      qty, colors,
      costParts, riskPct: Number(tc?.riskPct) || 0,
      basePrice: computeBaseFromParts(costParts, tc?.riskPct, exclude, currency),
      dye: tc?.dye ? {
        perColorKg: tc.dye.perColorKg, minKg: tc.dye.minKg, minApplied: tc.dye.minApplied, billedKg: tc.dye.billedKg,
        // 러닝 생지 줄: 컬러별 생지 kg (염색 최소 청구 안내용, 소수 첫째 자리)
        ...(tc.dye.perColor ? { perColorKgs: tc.dye.perColor.map(c => Math.round(c.kg * 10) / 10) } : {}),
      } : null,
    };
  };

  // 기준 견적 품목을 지금 원가로 다시 만들기 (원단이 삭제된 품목은 그대로 두고 개수만 셈)
  //  toUsd: 통화가 바뀔 때(true = 원→$, false = $→원) 삭제된 원단 품목의 기준원가를 환율로만 환산 (null = 통화 그대로)
  //  convRate: 그 원↔$ 환산에 쓰는 환율 (없으면 rate) — 시장 구분 전환 때 '수출 쪽' 환율 (handleQuoteSettingChange)
  const rebuildItems = (items, rate, marketType, toUsd = null, exclude = {}, convRate = rate) => {
    let missing = 0;
    const next = (items || []).map(item => {
      const fabric = findFabric(item.fabricId);
      if (fabric) return createQuoteItem(fabric, { rate, marketType, marginRate: item.marginRate, ...exclude });
      missing++;
      if (toUsd === null) return item;
      // 원단이 삭제된 품목: 통화만 바꿈. 원가 조각이 있으면 환산한 조각으로 기준원가를 다시 만듦
      //  (반올림된 기준원가를 나누면 나중에 제외 버튼을 눌렀을 때 값과 어긋남) — 조각이 없는 구간만 기준원가를 바로 환산
      const patch = {};
      const parts = item.costParts
        ? Object.fromEntries(Object.entries(item.costParts).map(([k, pt]) => [k, convertCostParts(pt, toUsd, convRate)]))
        : null;
      if (parts) patch.costParts = parts;
      QUOTE_TIER_KEYS.forEach(k => {
        if (parts?.[k]) { patch[`basePrice${k}`] = computeBaseFromParts(parts[k], item.riskPct, exclude, toUsd ? 'USD' : 'KRW'); return; }
        const v = getBasePrice(item, k);
        if (v !== null) patch[`basePrice${k}`] = convertBasePrice(v, toUsd, convRate);
      });
      return { ...item, ...patch, costWarnings: addNote(item.costWarnings, DELETED_NOTE) };
    });
    return { items: next, missing };
  };

  // 별도 견적 줄을 지금 원가로 다시 계산 (줄의 수량·컬러·이익율·정액·표시는 그대로)
  //  toUsd: 통화가 바뀔 때 원단이 삭제된 줄의 기준원가 환산 / addToUsd: 줄에 직접 넣은 정액을 환산할 때만 (예전 $ 정액 → 원화)
  //  convRate: 그 원↔$ 환산에 쓰는 환율 (없으면 rate) — rebuildItems와 같음
  const rebuildCustomItems = (rows, rate, marketType, toUsd = null, exclude = {}, addToUsd = null, convRate = rate) => {
    let missing = 0;
    const next = (rows || []).map(row => {
      const marginAdd = (addToUsd !== null && !isBlank(row.marginAdd)) ? convertAmount(row.marginAdd, addToUsd, convRate) : row.marginAdd;
      const fabric = findFabric(row.fabricId);
      if (fabric) return createCustomItem(fabric, { ...row, marginAdd }, { rate, marketType, exclude });
      missing++;
      if (toUsd === null) return row;
      const patch = { marginAdd };
      // 원가 조각이 있으면 환산한 조각으로 기준원가 (기준 견적 품목과 같은 방식)
      if (row.costParts) {
        patch.costParts = convertCostParts(row.costParts, toUsd, convRate);
        patch.basePrice = computeBaseFromParts(patch.costParts, row.riskPct, exclude, toUsd ? 'USD' : 'KRW');
      } else if (!isBlank(row.basePrice)) {
        patch.basePrice = convertBasePrice(row.basePrice, toUsd, convRate);
      }
      return { ...row, ...patch, costWarnings: addNote(row.costWarnings, DELETED_NOTE) };
    });
    return { rows: next, missing };
  };

  const handleQuoteSettingChange = (field, value) => {
    if (field !== 'marketType') {
      setQuoteInput(prev => ({ ...prev, [field]: value }));
      return;
    }
    if (value === quoteInput.marketType) return;
    // 시장 구분(내수/수출) 변경: 기준원가는 통화·관세 기준이 달라 다시 계산해야 함 → 확인 후 '바꾼 시장의 지금 환율'로 계산
    //  (2026-10-07 대표님 결정 — 내수 → 수출이면 지금 수출 환율, 수출 → 내수면 지금 내수 환율. 예전엔 그 견적의 환율 그대로)
    //  YD당 정액은 원화로 적어 두므로 그대로 (수출이면 판매가 낼 때 견적 환율로 나눔).
    //  예전 수출 견적($로 적은 정액)을 내수로 바꿀 때만 그 견적의 환율로 원화로 바꿔 두고, 그다음부터는 원화로 적음.
    const items = quoteInput.items || [];
    const rows = quoteInput.customItems || [];
    const hasItems = items.length > 0 || rows.length > 0;
    const convertAdd = getMarginAddCurrency(quoteInput) === 'USD' && value !== 'export';
    const hasAdd = convertAdd && (QUOTE_TIER_KEYS.some(t => Number(quoteInput.marginAdd?.[t]) > 0) || rows.some(r => Number(r.marginAdd) > 0));
    if (items.length > 0 && !isNewMarginModel(quoteInput)) {
      showToast('아주 옛날 방식(추가 마크업) 견적이라 시장 구분을 바꿀 수 없어요. 새 견적으로 작성해 주세요.', 'error');
      return;
    }
    const toUsd = value === 'export';
    const oldRate = quoteRateOf(quoteInput);
    const rate = currentRateFor(value);
    // 원↔$ 환산(원단이 삭제된 품목·예전 $ 정액)은 '수출 쪽' 환율로 — 내수 → 수출은 새 수출 환율, 수출 → 내수는 그 $를 낸 견적 환율
    const convRate = toUsd ? rate : oldRate;
    if ((hasItems || hasAdd) && !window.confirm(
      `시장 구분을 ${toUsd ? '수출($)' : '내수(₩)'}로 바꿉니다.\n\n` +
      (hasItems ? `· 기준 견적·별도 견적 단가를 현재 원가로 다시 계산해요\n   적용 환율: ₩${num(oldRate)} → ₩${num(rate)} (지금 ${rateLabel(value)})\n` : '') +
      (hasAdd ? `· 예전 수출 견적의 YD당 정액($)을 이 견적의 환율 ₩${num(convRate)}로 원화로 바꿔요\n` : '') +
      `\n계속할까요?`
    )) return;
    const rebuilt = rebuildItems(items, rate, value, toUsd, excludeOf(quoteInput), convRate);
    const rebuiltRows = rebuildCustomItems(rows, rate, value, toUsd, getCustomExclude(quoteInput), convertAdd ? false : null, convRate);
    setQuoteInput(prev => ({
      ...prev,
      marketType: value,
      currency: currencyOf(value),
      // 품목이 있으면 바꾼 시장의 환율로 다시 계산했으니 그 환율. 없으면 비워 둠 → 처음 넣는 품목 때 그 시장의 지금 환율
      exchangeRate: hasItems ? rate : null,
      ...(convertAdd ? { marginAdd: convertMarginAdd(prev.marginAdd, false, convRate) } : {}),
      marginAddCurrency: 'KRW',
      items: rebuilt.items,
      customItems: rebuiltRows.rows,
    }));
    const missing = rebuilt.missing + rebuiltRows.missing;
    if (missing > 0) showToast(`삭제된 원단 ${missing}개는 원가를 다시 계산하지 못해 환율로만 환산했어요.`, 'error');
  };

  // [현재 원가로 다시 계산] — 견적 단가는 저장 당시 값 그대로가 원칙이라, 누를 때만 지금 원가·지금 환율로 다시 계산.
  //  지금 환율 = 그 견적 시장의 공통 환율 (내수 견적 = 내수 환율, 수출 견적 = 수출 환율)
  //  매출이익율·YD당 정액은 그대로 (YD당 정액은 견적 통화 금액이라 환율이 바뀌어도 그대로). 별도 견적 줄도 같이.
  const handleRecalcQuote = () => {
    const items = quoteInput.items || [];
    const rows = quoteInput.customItems || [];
    const total = items.length + rows.length;
    if (total === 0) { showToast('다시 계산할 품목이 없습니다.', 'error'); return; }
    if (items.length > 0 && !isNewMarginModel(quoteInput)) {
      showToast('아주 옛날 방식(추가 마크업) 견적이라 다시 계산할 수 없어요. 새 견적으로 작성해 주세요.', 'error');
      return;
    }
    const market = quoteMarket(quoteInput);
    const rate = currentRateFor(market);
    const oldRate = Number(quoteInput.exchangeRate) || null;
    if (!window.confirm(
      `기준 견적 ${items.length}개 · 별도 견적 ${rows.length}줄의 기준원가를 지금 원가(원가 설정·원사 단가)로 다시 계산합니다.\n` +
      `적용 환율: ${oldRate ? `₩${num(oldRate)}` : '기록 없음'} → ₩${num(rate)} (지금 ${rateLabel(market)})\n` +
      `매출이익율과 YD당 정액은 그대로 둡니다.\n\n계속할까요?`
    )) return;
    const rebuilt = rebuildItems(items, rate, quoteInput.marketType, null, excludeOf(quoteInput));
    const rebuiltRows = rebuildCustomItems(rows, rate, quoteInput.marketType, null, getCustomExclude(quoteInput));
    setQuoteInput(prev => ({ ...prev, exchangeRate: rate, items: rebuilt.items, customItems: rebuiltRows.rows }));
    const missing = rebuilt.missing + rebuiltRows.missing;
    showToast(
      missing > 0
        ? `${total - missing}개를 다시 계산했어요. (삭제된 원단 ${missing}개는 그대로)`
        : `${total}개를 지금 원가로 다시 계산했어요.`,
      missing > 0 ? 'error' : 'success'
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
    setQuoteInput(prev => {
      const bulk = toQuoteTierRate(prev.bulkMarginRate);
      return {
        ...prev,
        bulkMarginRate: { ...bulk, [tier]: v },
        items: (prev.items || []).map(it => ({
          ...it,
          marginRate: { ...toQuoteTierRate(it.marginRate, (k) => bulk[k]), [tier]: v }
        }))
      };
    });
  };

  // 원단별 매출이익율(%) 개별 수정 — 특정 원단의 특정 구간(tier)만 변경. 0~99로 clamp.
  const handleQuoteItemMarginChange = (index, tier, value) => {
    const v = Math.min(99, Math.max(0, Number(value) || 0));
    setQuoteInput(prev => {
      const items = [...(prev.items || [])];
      if (!items[index]) return prev;
      const bulk = toQuoteTierRate(prev.bulkMarginRate);
      items[index] = { ...items[index], marginRate: { ...toQuoteTierRate(items[index].marginRate, (k) => bulk[k]), [tier]: v } };
      return { ...prev, items };
    });
  };

  // 바이어 견적서에 보여줄 구간 켜고 끄기 (1개 이상). 켠 구간이 예전 품목에 없으면 다시 계산 안내
  const handleToggleShownTier = (key) => {
    const cur = getShownTiers(quoteInput).map(t => t.key);
    const on = cur.includes(key);
    if (on && cur.length <= 1) { showToast('견적서에 보여줄 구간은 1개 이상이어야 해요.', 'error'); return; }
    const next = QUOTE_TIER_KEYS.filter(k => (k === key ? !on : cur.includes(k)));
    setQuoteInput(prev => ({ ...prev, shownTiers: next }));
    if (!on) {
      const lacking = (quoteInput.items || []).filter(it => getBasePrice(it, key) === null).length;
      if (lacking > 0) showToast(`예전에 넣은 품목 ${lacking}개는 이 구간 단가가 없어요. [현재 원가로 다시 계산]을 누르면 채워져요.`, 'info');
    }
  };

  // 구간별 매출이익율·YD당 정액을 기본값으로 (품목별로 바꾼 이익율도 기본값으로)
  const handleResetTierDefaults = () => {
    if (!window.confirm(
      '구간별 매출이익율·YD당 정액을 기본값으로 되돌립니다.\n' +
      `(${describeTierDefaults()}${quoteInput.currency === 'USD' ? ' — 수출은 판매가를 낼 때 견적 환율로 환산' : ''})\n` +
      '품목마다 따로 바꾼 이익율도 기본값으로 바뀌어요. 계속할까요?'
    )) return;
    const rates = makeDefaultTierRates();
    const rate = quoteRateOf(quoteInput);
    // 기본 정액은 원화. 예전 수출 견적($ 정액)이면 줄에 직접 넣은 정액도 원화로 바꿔 둠
    const wasUsdAdd = getMarginAddCurrency(quoteInput) === 'USD';
    setQuoteInput(prev => ({
      ...prev,
      bulkMarginRate: rates,
      marginAdd: makeDefaultTierAdds('KRW'),
      marginAddCurrency: 'KRW',
      items: (prev.items || []).map(it => ({ ...it, marginRate: { ...rates } })),
      ...(wasUsdAdd ? {
        customItems: (prev.customItems || []).map(r => (isBlank(r.marginAdd) ? r : { ...r, marginAdd: convertAmount(r.marginAdd, false, rate) })),
      } : {}),
    }));
    showToast('구간별 이익율·정액을 기본값으로 바꿨어요.', 'success');
  };

  // 기준 견적 전체 — 외관검사 / 시험성적서(이화학) 제외. 원가 조각으로 기준원가만 다시 만듦 (다른 원가는 그대로)
  //  field: 'excludeVisual' | 'excludeChem'
  //  원가 조각이 없는 예전 품목이 하나라도 있으면 바꾸지 않음 — 단가는 그대로인데 견적서에만 'NOT INCLUDED'가
  //  찍히는 일 방지. [현재 원가로 다시 계산]을 먼저 하면 모든 품목에 원가 조각이 생김
  const handleQuoteExcludeChange = (field, checked) => {
    const noParts = (quoteInput.items || []).filter(it => !it.costParts).length;
    if (noParts > 0) {
      showToast(`예전에 넣은 품목 ${noParts}개는 원가 조각이 없어 제외를 적용할 수 없어요. [현재 원가로 다시 계산]을 먼저 눌러 주세요.`, 'error');
      return;
    }
    const exclude = { ...excludeOf(quoteInput), [field]: checked };
    const currency = quoteInput.currency;
    const items = (quoteInput.items || []).map(it => {
      const patch = {};
      QUOTE_TIER_KEYS.forEach(k => {
        if (it.costParts[k]) patch[`basePrice${k}`] = computeBaseFromParts(it.costParts[k], it.riskPct, exclude, currency);
      });
      return { ...it, ...patch };
    });
    setQuoteInput(prev => ({ ...prev, [field]: checked, items }));
  };

  // 아주 옛날(추가 마크업 extraMargin) 견적인지 — 원단을 더 넣으면 기존 품목 단가가 새 방식으로 바뀌므로 추가를 막음
  const isLegacyQuote = () => (quoteInput.items || []).length > 0 && !isNewMarginModel(quoteInput);
  const blockLegacyAdd = () => {
    if (!isLegacyQuote()) return false;
    showToast('아주 옛날 방식(추가 마크업) 견적이라 원단을 더 넣을 수 없어요. 새 견적으로 작성해 주세요.', 'error');
    return true;
  };

  const handleAddFabricToQuote = (selectedFabricIdForQuote, setSelectedFabricIdForQuote) => {
    if (!selectedFabricIdForQuote) { showToast("견적서에 추가할 원단을 선택해주세요.", 'error'); return; }
    if (blockLegacyAdd()) return;

    // [기획 요구사항 2] 중복 추가 방어 로직
    const isDuplicate = (quoteInput.items || []).some(item => String(item.fabricId) === String(selectedFabricIdForQuote));
    if (isDuplicate) {
      showToast("이미 추가된 품목입니다. 기존 항목을 확인해 주세요.", 'error');
      setSelectedFabricIdForQuote('');
      return;
    }

    const fabric = findFabric(selectedFabricIdForQuote);
    if (!fabric) return;
    // 추가 항목은 견적의 기존 환율(있으면)로 계산 → 한 견적 안 항목들의 환율 일관성 유지(옛 견적에 추가해도 혼재 방지)
    //  처음 넣는 품목이면 그 시장의 지금 환율 (내수 환율 / 수출 환율)
    const rate = quoteRateOf(quoteInput);
    const newItem = createQuoteItem(fabric, { rate, marketType: quoteInput.marketType, marginRate: quoteInput.bulkMarginRate, ...excludeOf(quoteInput) });
    setQuoteInput(prev => ({ ...prev, exchangeRate: prev.exchangeRate || rate, items: [...(prev.items || []), newItem] }));
    setSelectedFabricIdForQuote('');
    const warns = newItem.costWarnings || [];
    if (warns.length > 0) showToast(`원단이 추가되었습니다. ⚠ 원가 확인 필요 — ${warns[0]}`, 'error');
    else showToast(`원단이 추가되었습니다.`, 'success');
  };

  // Article 입력(Enter)·엑셀 세로 복붙 — 여러 줄이면 일괄 추가. target: 'standard' 기준 견적 / 'custom' 별도 견적
  const handleGridPaste = (text, target = 'standard') => {
    if (blockLegacyAdd()) return;
    const articles = String(text).split('\n').map(a => String(a).trim().toUpperCase()).filter(a => a);
    if (target === 'custom') {
      const fabrics = [];
      const notFoundCustom = [];
      articles.forEach(art => {
        const fabric = findByArticle(art);
        if (fabric) fabrics.push(fabric); else notFoundCustom.push(art);
      });
      const { rows, duplicates, blocked } = addCustomRows(fabrics);
      if (blocked) return;
      toastCustomAdded(rows, duplicates);
      if (notFoundCustom.length > 0) alert(`다음 Article은 리스트에 없습니다:\n\n${notFoundCustom.join('\n')}\n\n(개발번호는 원가 견적을 저장한 개발 의뢰만 넣을 수 있어요)`);
      return;
    }
    // 추가 항목은 견적의 기존 환율(있으면)로 계산 → 환율 일관성 유지 (처음이면 그 시장의 지금 환율)
    const rate = quoteRateOf(quoteInput);
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

      const fabric = findByArticle(art);
      if (fabric) { newItems.push(createQuoteItem(fabric, { rate, marketType: quoteInput.marketType, marginRate: quoteInput.bulkMarginRate, ...excludeOf(quoteInput) })); }
      else { notFound.push(art); }
    });

    if (newItems.length > 0) {
      setQuoteInput(prev => ({ ...prev, exchangeRate: prev.exchangeRate || rate, items: [...(prev.items || []), ...newItems] }));
      const warned = newItems.filter(it => (it.costWarnings || []).length > 0).length;
      const head = newItems.length === 1 ? `${newItems[0].article} 추가 완료` : `${newItems.length}개의 원단이 일괄 추가되었습니다.`;
      showToast(
        `${head}${duplicates > 0 ? ` (중복 제외됨: ${duplicates}건)` : ''}${warned > 0 ? ` ⚠ 원가 확인 필요 ${warned}개 — 표의 빨간 배지 확인` : ''}`,
        warned > 0 ? 'error' : 'success'
      );
    } else if (duplicates > 0) {
      showToast(`이미 추가된 품목입니다. (중복 제외됨: ${duplicates}건)`, 'error');
    }

    if (notFound.length > 0) alert(`다음 Article은 리스트에 없습니다:\n\n${notFound.join('\n')}\n\n(개발번호는 원가 견적을 저장한 개발 의뢰만 넣을 수 있어요)`);
  };

  const handleRemoveItemFromQuote = (index) => {
    const newItems = quoteInput.items.filter((_, i) => i !== index);
    setQuoteInput({ ...quoteInput, items: newItems });
  };

  // 기준 견적에서 체크한 품목 삭제 (fabricId 목록)
  // 반환: 뺐으면 true (취소면 false — 화면의 체크 선택은 그대로)
  const handleRemoveItemsFromQuote = (fabricIds) => {
    const ids = new Set((fabricIds || []).map(String));
    if (ids.size === 0) return false;
    if (!window.confirm(`기준 견적에서 품목 ${ids.size}개를 뺄까요?`)) return false;
    setQuoteInput(prev => ({ ...prev, items: (prev.items || []).filter(it => !ids.has(String(it.fabricId))) }));
    return true;
  };

  // ── 별도 견적 ──
  // 원단들을 별도 견적 줄로 추가 (수량 300YD · 2컬러로 시작). 기준 견적처럼 같은 원단은 한 줄만 — 이미 있으면 건너뜀
  const addCustomRows = (fabrics) => {
    if (blockLegacyAdd()) return { rows: [], duplicates: 0, blocked: true };
    const existing = new Set((quoteInput.customItems || []).map(r => String(r.fabricId)));
    const fresh = [];
    let duplicates = 0;
    fabrics.forEach(f => {
      if (existing.has(String(f.id))) { duplicates++; return; }
      existing.add(String(f.id));
      fresh.push(f);
    });
    if (fresh.length === 0) return { rows: [], duplicates };
    const rate = quoteRateOf(quoteInput);
    const rows = fresh.map(f => createCustomItem(
      f, { qty: DEFAULT_CUSTOM_QTY, colors: DEFAULT_CUSTOM_COLORS },
      { rate, marketType: quoteInput.marketType, exclude: getCustomExclude(quoteInput) }
    ));
    setQuoteInput(prev => ({ ...prev, exchangeRate: prev.exchangeRate || rate, customItems: [...(prev.customItems || []), ...rows] }));
    return { rows, duplicates };
  };

  // 추가 결과 알림 (기준 견적 추가와 같은 문구 규칙)
  const toastCustomAdded = (rows, duplicates, extra = '') => {
    if (rows.length === 0) {
      if (duplicates > 0) showToast(`이미 별도 견적에 있는 원단이에요. (중복 제외됨: ${duplicates}건)${extra}`, 'error');
      return;
    }
    const warned = rows.filter(r => (r.costWarnings || []).length > 0).length;
    const head = rows.length === 1 ? `${rows[0].article} — 별도 견적에 넣었어요 (300YD · 2컬러로 시작)` : `별도 견적에 ${rows.length}줄을 넣었어요 (300YD · 2컬러로 시작)`;
    showToast(
      `${head}${duplicates > 0 ? ` (중복 제외됨: ${duplicates}건)` : ''}${extra}${warned > 0 ? ` ⚠ 원가 확인 필요 ${warned}개` : ''}`,
      warned > 0 ? 'error' : 'success'
    );
  };

  // 기준 견적에서 체크한 품목 → 별도 견적으로 복사
  // 반환: 복사했으면(이미 있던 원단 포함) true — 막혔거나 복사할 원단이 없으면 false (체크 선택 그대로)
  const handleCopyToCustom = (fabricIds) => {
    const ids = (fabricIds || []).map(String);
    if (ids.length === 0) { showToast('기준 견적에서 복사할 원단을 체크해 주세요.', 'error'); return false; }
    const fabrics = [];
    let deleted = 0;
    ids.forEach(id => { const f = findFabric(id); if (f) fabrics.push(f); else deleted++; });
    const { rows, duplicates, blocked } = addCustomRows(fabrics);
    if (blocked) return false;
    if (rows.length === 0 && duplicates === 0 && deleted > 0) { showToast('원단이 삭제되어 별도 견적으로 복사할 수 없어요.', 'error'); return false; }
    toastCustomAdded(rows, duplicates, deleted > 0 ? ` (삭제된 원단 ${deleted}개 제외)` : '');
    return true;
  };

  // 원단 검색 팝업에서 별도 견적에 추가 (이미 있으면 '추가됨'으로 막힘 — 기준 견적과 같음)
  const handleAddCustomFabric = (fabricId) => {
    const fabric = findFabric(fabricId);
    if (!fabric) return;
    const { rows, duplicates, blocked } = addCustomRows([fabric]);
    if (!blocked) toastCustomAdded(rows, duplicates);
  };

  // 별도 견적 전체 — 외관검사 / 시험성적서(이화학) 제외. 원가 조각으로 모든 줄의 기준원가만 다시 만듦
  //  field: 'excludeVisual' | 'excludeChem'
  const handleCustomExcludeChange = (field, checked) => {
    const noParts = (quoteInput.customItems || []).filter(r => !r.costParts && r.basePrice !== null && r.basePrice !== undefined).length;
    if (noParts > 0) {
      showToast(`원가 조각이 없는 별도 견적 줄 ${noParts}개가 있어 제외를 적용할 수 없어요. [현재 원가로 다시 계산]을 먼저 눌러 주세요.`, 'error');
      return;
    }
    const quoteKey = field === 'excludeVisual' ? 'customExcludeVisual' : 'customExcludeChem';
    const exclude = { ...getCustomExclude(quoteInput), [field]: checked };
    const currency = quoteInput.currency;
    const rows = (quoteInput.customItems || []).map(r => (
      r.costParts ? { ...r, basePrice: computeBaseFromParts(r.costParts, r.riskPct, exclude, currency) } : r
    ));
    setQuoteInput(prev => ({ ...prev, [quoteKey]: checked, customItems: rows }));
  };

  // 별도 견적 줄 수정. 수량·컬러(러닝 생지 조건 포함)는 원가부터 다시 계산, 이익율·정액·표시는 값만
  //  patch.running = null 이면 러닝 생지 해제 (수량·컬러수는 그대로 — 고르게 나눈다고 보고 다시 계산)
  const handleCustomItemChange = (rowId, patch) => {
    const row = (quoteInput.customItems || []).find(r => r.id === rowId);
    if (!row) return;
    const next = { ...row, ...patch };
    let updated = next;
    if ('qty' in patch || 'colors' in patch || 'running' in patch) {
      const fabric = findFabric(row.fabricId);
      if (!fabric) { showToast('원단이 삭제되어 수량·컬러를 바꿔 다시 계산할 수 없어요.', 'error'); return; }
      updated = createCustomItem(fabric, next, { rate: quoteRateOf(quoteInput), marketType: quoteInput.marketType, exclude: getCustomExclude(quoteInput) });
    } else if ('marginRate' in patch) {
      updated = { ...next, marginRate: isBlank(patch.marginRate) ? null : Math.min(99, Math.max(0, Number(patch.marginRate) || 0)) };
    } else if ('marginAdd' in patch) {
      updated = { ...next, marginAdd: isBlank(patch.marginAdd) ? null : Math.max(0, Number(patch.marginAdd) || 0) };
    }
    setQuoteInput(prev => ({ ...prev, customItems: (prev.customItems || []).map(r => (r.id === rowId ? updated : r)) }));
  };

  // 별도 견적 줄 삭제 (id 목록)
  // 반환: 지웠으면 true (취소면 false — 체크 선택 그대로)
  const handleRemoveCustomItems = (rowIds) => {
    const ids = new Set(rowIds || []);
    if (ids.size === 0) return false;
    if (ids.size > 1 && !window.confirm(`별도 견적 ${ids.size}줄을 지울까요?`)) return false;
    setQuoteInput(prev => ({ ...prev, customItems: (prev.customItems || []).filter(r => !ids.has(r.id)) }));
    return true;
  };

  // ── 러닝 생지 견적 (대표님 요청 2026-10-07) ──
  //  미리 짜 둔 생지로 소량·여러 컬러 오더를 받을 때 — 별도 견적 줄의 한 종류 (row.running = { greigeQty, colorQtys })
  //  draft (창의 입력): { rowId: 고칠 줄(없으면 그 원단의 줄 또는 새 줄), fabricId, running: { greigeQty, colorQtys },
  //                     marginRate, marginAdd } — 칸 값은 글자 그대로 받아 여기서 정리

  // 이익율(0~99)·YD당 정액(0 이상) 칸 정리 — 비우면 null (= 일반 별도 견적 줄과 같은 기본값)
  const cleanRowMargin = (v, max) => (isBlank(v) ? null : Math.min(max, Math.max(0, Number(v) || 0)));

  // 창 미리보기 — 별도 견적 줄과 같은 계산(createCustomItem) + 원가 내역·비교 (견적 환율·견적 시장·별도 견적 제외 항목)
  //  반환: null(원단 없음) | {
  //    row: 넣으면 생길 줄, price: 판가/YD (조건이 모자라면 null), calc: 이 오더의 원가 엔진 결과,
  //    freshBase: 비교 — 이 오더 수량으로 새로 짤 때(일반 별도 견적, 컬러별로 고르게) 기준원가,
  //    lotBase: 비교 — 생지 짠 수량으로 한 번에 오더할 때(컬러마다 MCQ 충족) 기준원가,
  //    extras: 소량 추가분 (생지 짠 수량 원가 대비, 실비·오더 총액) [{ key, label, amount }], currency, marketType, exclude }
  const previewRunningRow = (draft) => {
    const fabric = findFabric(draft?.fabricId);
    if (!fabric) return null;
    const rate = quoteRateOf(quoteInput);
    const marketType = quoteInput.marketType;
    const currency = currencyOf(marketType);
    const exclude = getCustomExclude(quoteInput);
    const existing = (quoteInput.customItems || []).find(r => r.id === draft.rowId) || null;
    const row = createCustomItem(
      fabric,
      { ...(existing || {}), running: draft.running, marginRate: cleanRowMargin(draft.marginRate, 99), marginAdd: cleanRowMargin(draft.marginAdd, Infinity) },
      { rate, marketType, exclude }
    );
    const out = { row, price: null, calc: null, freshBase: null, lotBase: null, extras: [], currency, marketType, exclude };
    const running = normalizeRunning(row.running);
    if (!running || isBlank(row.basePrice) || !calculateCostAtQty) return out;
    const calc = calculateCostAtQty(fabric, row.qty, rate, customRowCostOpts(row));
    const fresh = calculateCostAtQty(fabric, row.qty, rate, { colors: row.colors });
    const lot = running.greigeQty > 0 ? calculateCostAtQty(fabric, running.greigeQty, rate, { assumeMcq: true }) : null;
    const baseOf = (tc) => (tc ? computeBaseFromParts(partsFromCost(tc[marketType]), tc.riskPct, exclude, currency) : null);
    // 같은 항목의 YD당 금액 차이 × 수량 (원사·편직·후가공·외관검사·추가비용은 생지 짠 수량 원가와 YD당 같아서 차이 없음)
    const lineAmt = (tc, group, key) => (tc?.[marketType]?.lines?.[group] || []).filter(l => l.key === key).reduce((sum, l) => sum + l.amt, 0);
    const diff = (group, key) => (lineAmt(calc, group, key) - lineAmt(lot, group, key)) * row.qty;
    const extras = lot ? [
      { key: 'dye', label: '염색 (컬러별 최소 청구)', amount: diff('proc', 'dye') },
      ...(exclude.excludeChem ? [] : [{ key: 'chem', label: '이화학', amount: diff('etc', 'chem') }]),
      { key: 'freight', label: '운임', amount: diff('etc', 'freight') },
    ] : [];
    return {
      ...out,
      price: calcCustomQuotePrice(row, quoteInput, currency),
      calc, freshBase: baseOf(fresh), lotBase: baseOf(lot), extras,
    };
  };

  // 창의 [별도 견적에 넣기]·[저장] — 그 원단의 별도 견적 줄을 러닝 생지 줄로 넣거나 고침
  //  같은 원단은 별도 견적에 한 줄만 (지금 규칙) — 일반 줄이 있으면 그 줄이 러닝 생지 줄로 바뀜 (견적서 표시는 그대로)
  //  반환: 넣었으면 true (막히면 알림 후 false — 창은 그대로)
  const handleSaveRunningRow = (draft) => {
    const problem = validateRunning(draft?.running);
    if (problem) { showToast(problem, 'error'); return false; }
    const fabric = findFabric(draft?.fabricId);
    if (!fabric) { showToast('원단을 찾을 수 없어요. (삭제된 원단)', 'error'); return false; }
    const rows = quoteInput.customItems || [];
    const target = rows.find(r => (draft.rowId ? r.id === draft.rowId : String(r.fabricId) === String(fabric.id))) || null;
    if (!target && blockLegacyAdd()) return false;
    const rate = quoteRateOf(quoteInput);
    const built = createCustomItem(
      fabric,
      { ...(target || {}), running: draft.running, marginRate: cleanRowMargin(draft.marginRate, 99), marginAdd: cleanRowMargin(draft.marginAdd, Infinity) },
      { rate, marketType: quoteInput.marketType, exclude: getCustomExclude(quoteInput) }
    );
    setQuoteInput(prev => {
      const list = prev.customItems || [];
      // 같은 원단 줄을 prev에서 다시 찾음 — 빠르게 두 번 눌러도 줄이 두 개 생기지 않게
      const idx = list.findIndex(r => (target ? r.id === target.id : String(r.fabricId) === String(fabric.id)));
      const nextList = idx >= 0 ? list.map((r, i) => (i === idx ? { ...built, id: r.id } : r)) : [...list, built];
      return { ...prev, exchangeRate: prev.exchangeRate || rate, customItems: nextList };
    });
    const running = normalizeRunning(built.running);
    const head = `${fabric.article} — 러닝 생지 견적을 ${target ? '고쳤어요' : '별도 견적에 넣었어요'} (${num(built.qty)}YD · ${built.colors}컬러, 생지 짠 수량 ${num(running.greigeQty)}YD)`;
    const warns = built.costWarnings || [];
    showToast(warns.length > 0 ? `${head} ⚠ 원가 확인 필요 — ${warns[0]}` : head, warns.length > 0 ? 'error' : 'success');
    return true;
  };

  // [러닝 생지 해제] — 일반 별도 견적 줄로 (수량·컬러수는 그대로, 컬러별로 고르게 나눈다고 보고 다시 계산)
  //  반환: 바꿨으면 true
  const handleReleaseRunningRow = (rowId) => {
    const row = (quoteInput.customItems || []).find(r => r.id === rowId);
    if (!row) return false;
    if (!findFabric(row.fabricId)) { showToast('원단이 삭제되어 다시 계산할 수 없어요.', 'error'); return false; }
    handleCustomItemChange(rowId, { running: null });
    showToast(`${row.article} — 일반 별도 견적 줄로 되돌렸어요 (${num(row.qty)}YD · ${num(row.colors)}컬러, 컬러별로 고르게 나눈 기준)`, 'success');
    return true;
  };

  // [개발 의뢰 원가 견적 → 견적서 만들기 — 2026-10-06]
  //  의뢰의 원가 견적으로 새 견적서를 시작: 바이어 = 의뢰 바이어, 기준 견적 품목 1개(Article = 개발번호, Spec = 견적서 품목명),
  //  시장 구분·구간별 매출이익율·YD당 정액(원화)은 원가 견적 창에서 정한 값, 견적 환율 = 그 시장의 지금 공통 환율.
  //  저장은 하지 않음 — 견적서 화면에서 확인 후 저장·PDF (저장 안 하고 나가면 '저장할까요?')
  //  devReq.costQuote 는 방금 저장한 값을 넘겨받음 (목록의 의뢰 값은 서버에서 다시 받아올 때 바뀌어서)
  //  반환: 시작했으면 true
  const startQuoteFromDevRequest = (devReq) => {
    const fabric = devQuoteToFabric(devReq);
    if (!fabric) { showToast('원가 견적을 먼저 저장해 주세요.', 'error'); return false; }
    const cq = devReq.costQuote;
    const marketType = cq.marketType === 'export' ? 'export' : 'domestic';
    const rate = currentRateFor(marketType);
    const bulk = toQuoteTierRate(cq.marginRate);
    const item = createQuoteItem(fabric, { rate, marketType, marginRate: bulk });
    setQuoteInput({
      ...makeBlankQuote(),
      buyerName: devReq.buyerName || '',
      marketType,
      currency: currencyOf(marketType),
      exchangeRate: rate,
      bulkMarginRate: bulk,
      marginAdd: toQuoteTierAdd(cq.marginAdd, (k) => defaultTierAdd(k, 'KRW')),
      marginAddCurrency: 'KRW',
      items: [item],
    });
    const warns = item.costWarnings || [];
    showToast(
      warns.length > 0
        ? `${fabric.article} 견적서를 만들었어요. ⚠ 원가 확인 필요 — ${warns[0]}`
        : `${fabric.article} 견적서를 만들었어요. 구간·마진을 확인하고 저장한 뒤 PDF·엑셀로 보내 주세요.`,
      warns.length > 0 ? 'error' : 'success'
    );
    return true;
  };

  // [신규] 현재 작성 중인 견적서를 비우고 새 견적서 시작
  // 작성 중 내용이 있으면 확인 후 초기화 (수정/복제 모드의 id·createdAt 도 함께 제거됨 → 신규 저장으로 동작)
  // skipConfirm=true : 워크스페이스의 변경사항 가드가 이미 처리했을 때 훅 자체 confirm 생략
  const handleNewQuote = (skipConfirm = false) => {
    const hasContent =
      (quoteInput.items && quoteInput.items.length > 0) ||
      (quoteInput.customItems && quoteInput.customItems.length > 0) ||
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
    const itemCount = (quoteInput.items || []).length + (quoteInput.customItems || []).length;
    if (itemCount === 0) { showToast("기준 견적이나 별도 견적에 원단을 추가해주세요.", 'error'); return false; }

    // [기획 요구사항 3] 저장(Save) 시 자동 정렬 (Article 기반 가나다/오름차순) — 기준 견적만. 별도 견적은 넣은 순서 그대로
    const sortedItems = [...(quoteInput.items || [])].sort((a, b) => String(a.article).localeCompare(String(b.article)));

    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    // 기존 id가 있으면 유지(수정 모드) → 중복 생성 방지, 없으면 새 ID 부여 (스냅샷 정렬 배열 포함)
    // exchangeRate: 이 견적의 단가(원가)를 계산할 때 적용된 환율.
    //   항목을 추가/재계산할 때 quoteInput.exchangeRate가 설정됨(add 경로/재계산/시장전환).
    //   그런 변경 없이 저장하면 작성 당시 환율을 그대로 보존 → 기록(record)이 어긋나지 않음.
    //   레거시 견적(환율 미기록)은 현재 환율을 억지로 찍지 않고 null(미상)로 둠 → 잘못된 기록 방지.
    const savedRate = quoteInput.exchangeRate ?? null;
    const itemToSave = { id: quoteInput.id || Date.now(), createdAt: quoteInput.createdAt || new Date().toLocaleString(), authorName, ...quoteInput, items: sortedItems, customItems: quoteInput.customItems || [], exchangeRate: savedRate };

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
    let duplicatedQuote = normalizeQuote({
      ...rest,
      id: Date.now(),
      date: todayLocalISO(),
      buyerName
    });
    // 단가: 원본 견적 당시 값 그대로 / 지금 원가로 다시 계산 — 물어봄 (아주 옛날 방식 견적은 그대로 복제)
    let recalculated = false;
    let missing = 0;
    const hasRows = (duplicatedQuote.items || []).length > 0 || (duplicatedQuote.customItems || []).length > 0;
    if (isNewMarginModel(duplicatedQuote) && hasRows) {
      const market = quoteMarket(duplicatedQuote);
      const rate = currentRateFor(market);
      const oldRate = Number(duplicatedQuote.exchangeRate) || null;
      if (window.confirm(
        `복제한 견적의 단가를 지금 원가로 다시 계산할까요?\n\n` +
        `[확인] 지금 원가·지금 ${rateLabel(market)}(₩${num(rate)})로 다시 계산 (권장)\n` +
        `[취소] 원본 견적 당시 단가 그대로${oldRate ? ` (원본 환율 ₩${num(oldRate)})` : ''}`
      )) {
        const rebuilt = rebuildItems(duplicatedQuote.items, rate, duplicatedQuote.marketType, null, excludeOf(duplicatedQuote));
        const rebuiltRows = rebuildCustomItems(duplicatedQuote.customItems, rate, duplicatedQuote.marketType, null, getCustomExclude(duplicatedQuote));
        duplicatedQuote = { ...duplicatedQuote, exchangeRate: rate, items: rebuilt.items, customItems: rebuiltRows.rows };
        recalculated = true;
        missing = rebuilt.missing + rebuiltRows.missing;
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
    handleToggleShownTier, handleResetTierDefaults, handleQuoteExcludeChange,
    handleAddFabricToQuote, handleGridPaste,
    handleRemoveItemFromQuote, handleRemoveItemsFromQuote,
    handleCopyToCustom, handleAddCustomFabric, handleCustomItemChange, handleRemoveCustomItems, handleCustomExcludeChange,
    previewRunningRow, handleSaveRunningRow, handleReleaseRunningRow,
    handleNewQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote,
    startQuoteFromDevRequest,
  };
};
