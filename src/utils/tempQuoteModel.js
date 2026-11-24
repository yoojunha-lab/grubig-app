// GRUBIG ERP - 가설계서 판매가 시뮬레이션 · 가견적서 (순수 함수 — React/Firestore 의존 없음)
//
// ■ 견적서와 같은 계산 (대표님 요청 2026-11-24 — 가설계서 costing을 견적서처럼)
//   · 시장 구분 [내수 ₩ | 수출 $] — 가설계서마다 저장 (marketType). 화면 위 [내수|수출] 보기와 상관없이 그 시장으로 계산
//     환율 = 그 시장의 지금 공통 환율 (내수 환율 / 수출 환율). 값이 없는 예전 가설계서 = 내수
//   · 외관검사 제외 · 시험성적서(이화학) 제외 — 가설계서마다 저장 (excludeVisual · excludeChem).
//     견적서와 같이 원가 조각(반올림·위험마진 전 YD당 순원가와 그중 이화학·외관검사 몫)에서 그 항목만 빼고 위험마진을 다시 붙임
//   · 구간 6개 (300·500·700 / 1,000·3,000·5,000YD) — 견적서·원가 표와 같음. 판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액
//     새 가설계서 = 견적서 기본 이익율·정액. 예전 가설계서(1K/3K/5K만 있음)는 그 값 그대로 + 새 구간(300·500·700)은 견적서 기본값
//   · YD당 정액은 늘 원화로 적음 → 수출이면 그 시장 환율로 나눠 $로 더함 (견적서와 같음)
// ■ 가견적서 (대표님 요청 2026-11-24 — '가견적서'라는 이름은 대표님 결정): 견적서와 같은 PDF·엑셀 양식 (기준 견적서 모양)
//   · Article 칸 = 원단명, Spec 칸 = 가견적서 Spec(선택), Cut·Full·GSM·g/YD = 가설계서 폭·중량
//   · 견적서에 나갈 구간 = '가견적서 표시' 체크 (quoteShownTiers, 기본 500·700·1,000·3,000YD) · 유효기간 (quoteValidityOption, 기본 2주)
//   · 견적 이력에는 남기지 않음 (PDF·엑셀만) — 견적 모양은 내보낼 때마다 지금 원가로 새로 만듦

import { calculateMcqYd, rateForMarket, todayLocalISO } from './helpers';
import { isYarnRatioComplete, sumYarnRatio } from './costModel';
import { QUOTE_TIERS, QUOTE_TIER_KEYS, LEGACY_TIER_KEYS, DEFAULT_SHOWN_TIERS } from '../constants/quote';
import {
  toQuoteTierRate, toQuoteTierAdd, defaultTierRate, defaultTierAdd, makeDefaultTierRates, makeDefaultTierAdds,
  partsFromCost, computeBaseFromParts, calcQuotePrice,
} from './quoteModel';

/** 가설계서 시장 — 'export'(수출, $) / 'domestic'(내수, ₩). 값이 없는 예전 가설계서는 내수 */
export const tempMarket = (sheet) => (sheet?.marketType === 'export' ? 'export' : 'domestic');

/** 가설계서 통화 — 수출 'USD' / 내수 'KRW' */
export const tempCurrency = (sheet) => (tempMarket(sheet) === 'export' ? 'USD' : 'KRW');

// 비어 있는 구간 값: 예전 3구간(1k/3k/5k)은 0 (예전 판매가 그대로), 새 구간(300·500·700)은 견적서 기본값
const tempRateFallback = (k) => (LEGACY_TIER_KEYS.includes(k) ? 0 : defaultTierRate(k));
const tempAddFallback = (k) => (LEGACY_TIER_KEYS.includes(k) ? 0 : defaultTierAdd(k, 'KRW'));

/** 매출이익율 { 구간: % } — 6구간 객체로 (아주 예전 단일 숫자는 1k/3k/5k에만) */
export const toTempTierRate = (val) => toQuoteTierRate(val, tempRateFallback);

/** YD당 정액 { 구간: 원 } — 6구간 객체로 (원화) */
export const toTempTierAdd = (val) => toQuoteTierAdd(val, tempAddFallback);

/** 가견적서에 나갈 구간 키 (수량 순). 저장값이 없으면 견적서 기본 표시 구간 */
export const tempShownTiers = (sheet) => {
  const saved = Array.isArray(sheet?.quoteShownTiers) && sheet.quoteShownTiers.length ? sheet.quoteShownTiers : DEFAULT_SHOWN_TIERS;
  const keys = QUOTE_TIER_KEYS.filter(k => saved.includes(k));
  return keys.length ? keys : [...DEFAULT_SHOWN_TIERS];
};

/** 새 가설계서의 판매가·가견적서 칸 기본값 (견적서 기본 이익율·정액) */
export const makeTempQuoteDefaults = () => ({
  marketType: 'domestic',
  excludeVisual: false,
  excludeChem: false,
  quoteMarginRate: makeDefaultTierRates(),
  quoteMarginAdd: makeDefaultTierAdds('KRW'),
  quoteShownTiers: [...DEFAULT_SHOWN_TIERS],
  quoteValidityOption: '2weeks',
  quoteSpec: '',
});

/** 저장된 가설계서를 편집 창에 불러올 때 — 판매가 칸을 6구간·기본값으로 맞춤 (예전 가설계서 판매가는 그대로) */
export const normalizeTempQuoteFields = (sheet) => ({
  marketType: tempMarket(sheet),
  excludeVisual: sheet?.excludeVisual === true,
  excludeChem: sheet?.excludeChem === true,
  quoteMarginRate: toTempTierRate(sheet?.quoteMarginRate),
  quoteMarginAdd: toTempTierAdd(sheet?.quoteMarginAdd),
  quoteShownTiers: tempShownTiers(sheet),
  quoteValidityOption: sheet?.quoteValidityOption || '2weeks',
  quoteSpec: String(sheet?.quoteSpec ?? ''),
});

/**
 * 가설계서 → 견적서 품목 (견적서 createQuoteItem과 같은 모양 — 구간별 기준원가 · 원가 조각 · MCQ · 원가 확인 사유)
 * @param {Object} sheet 가설계서 (costInput · yarns · 판매가 칸)
 * @param {Object} calc  원가 엔진 결과 (calculateCost — 6구간)
 */
export const buildTempQuoteItem = (sheet, calc) => {
  const market = tempMarket(sheet);
  const currency = tempCurrency(sheet);
  const exclude = { excludeVisual: sheet?.excludeVisual === true, excludeChem: sheet?.excludeChem === true };
  const ci = sheet?.costInput || {};
  const item = {
    fabricId: sheet?.id || '',
    sourceType: 'tempSheet',
    article: String(sheet?.fabricName || '').trim(),   // 가견적서 Article 칸 = 원단명 (대표님 결정)
    itemName: String(sheet?.quoteSpec || '').trim(),   // Spec 칸 (선택)
    widthCut: ci.widthCut ?? '', widthFull: ci.widthFull ?? '', gsm: ci.gsm ?? '',
    gYd: Number(calc?.theoreticalGYd) || 0,             // 견적서와 같은 이론 G/YD
    // MCQ = 100kg ÷ (G/YD × (1 + 가공 LOSS%)), 100YD 단위 올림, 최소 300YD (견적서 자동값과 같음)
    mcqYd: Math.max(300, calculateMcqYd(Number(calc?.effectiveGYd) || 0, Number(calc?.processLossPct) || 0)),
    costParts: {},
    riskPct: 0,
    costWarnings: Array.isArray(calc?.costWarnings) ? calc.costWarnings : [],
  };
  QUOTE_TIERS.forEach(t => {
    const tc = calc?.[t.costKey];
    if (!tc) { item[`basePrice${t.key}`] = null; return; }
    const parts = partsFromCost(tc[market]);
    item.costParts[t.key] = parts;
    item.riskPct = Number(tc.riskPct) || 0;
    item[`basePrice${t.key}`] = computeBaseFromParts(parts, tc.riskPct, exclude, currency);
  });
  return item;
};

/**
 * 가설계서 → 견적서 모양 (견적서 판매가 계산 calcQuotePrice · PDF · 엑셀이 그대로 읽음)
 * @param {Object} sheet 가설계서
 * @param {Object} calc  원가 엔진 결과
 * @param {{domestic:number, export:number}} exchangeRates 공통 환율 두 칸
 * @returns {{ quote, item, rate, currency, market }}
 */
export const buildTempQuote = (sheet, calc, exchangeRates) => {
  const market = tempMarket(sheet);
  const currency = tempCurrency(sheet);
  const rate = rateForMarket(exchangeRates, market);
  const item = buildTempQuoteItem(sheet, calc);
  const quote = {
    id: `temp_${sheet?.id || 'new'}`,   // 내보내기 함수가 '편집 중인 견적서' 대신 이 견적을 쓰게 (id가 있어야 함)
    sourceType: 'tempSheet',
    buyerName: String(sheet?.buyerName || '').trim(),
    attention: '',
    marketType: market,
    currency,
    exchangeRate: rate,
    date: todayLocalISO(),
    validityOption: sheet?.quoteValidityOption || '2weeks',
    bulkMarginRate: toTempTierRate(sheet?.quoteMarginRate),
    marginAdd: toTempTierAdd(sheet?.quoteMarginAdd),
    marginAddCurrency: 'KRW',
    shownTiers: tempShownTiers(sheet),
    excludeVisual: sheet?.excludeVisual === true,
    excludeChem: sheet?.excludeChem === true,
    priceUnit: 'YD',
    items: [item],
    customItems: [],
  };
  return { quote, item, rate, currency, market };
};

/** 구간 판매가 (buildTempQuote 결과로) — 견적서와 같은 calcQuotePrice */
export const tempSellPrice = (built, tierKey) => calcQuotePrice(built?.item, tierKey, built?.quote, built?.currency);

/** 구간 영업 기준원가 — 제외 전 (원가 표의 영업 기준원가) */
export const tempBaseBeforeExclude = (calc, sheet, tierKey) => {
  const tier = QUOTE_TIERS.find(t => t.key === tierKey);
  return Number(calc?.[tier?.costKey]?.[tempMarket(sheet)]?.finalCostYd) || 0;
};

/** 가견적서를 만들 수 없는 사유 (바이어 이름은 견적서 확인 validateQuoteForExport가 봄) */
export const validateTempSheetForQuote = (sheet) => {
  const errors = [];
  if (!String(sheet?.fabricName || '').trim()) errors.push('원단명을 넣어 주세요. (가견적서 Article 칸에 나가요)');
  if (!isYarnRatioComplete(sheet?.yarns)) errors.push(`원사 혼용률 합계가 100%가 아니에요 (지금 ${sumYarnRatio(sheet?.yarns)}%).`);
  return errors;
};

/** 가견적서 파일 이름 — Quotation_바이어_원단명_날짜 (PDF·엑셀 같이) */
export const tempQuoteFileName = (sheet, quote) => {
  const safe = (v) => String(v || '').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim();
  return ['Quotation', safe(sheet?.buyerName), safe(sheet?.fabricName), quote?.date].filter(Boolean).join('_');
};
