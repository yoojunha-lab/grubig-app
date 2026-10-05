// GRUBIG ERP - 견적 계산 (순수 함수 — React/Firestore 의존 없음)
//
// ■ 기준 견적: 품목마다 구간별 영업 기준원가(basePrice{구간})를 넣을 때의 값으로 저장
//   판매가 = 기준원가 ÷ (1 − 매출이익율%) + YD당 정액 → 통화별 반올림 (원 100원 / $ 센트)
//   · 매출이익율: 품목 값 → 견적 일괄값 → 구간 기본값 순으로 찾음 (빈 구간이 0%가 되지 않게)
//   · YD당 정액: 견적 값 (견적 통화 금액)
// ■ 별도 견적: 줄마다 수량·컬러수를 넣어 원가부터 다시 계산한 기준원가(basePrice)
//   이익율·정액을 비워 두면 수량이 속한 기준 구간의 견적 일괄값을 씀
// ■ 외관검사·시험성적서(이화학) 빼기: 원가 조각(costParts: 반올림·위험마진 전 YD당 순원가와 그중
//   이화학·외관검사 몫)을 같이 저장해 두고, 체크를 바꾸면 조각으로 기준원가를 다시 만듦 (다른 원가는 그대로)

import { smartRound, applyGrossMargin, num, usd } from './helpers';
import { QUOTE_TIERS, QUOTE_TIER_KEYS, LEGACY_TIER_KEYS } from '../constants/quote';

const isBlank = (v) => v === undefined || v === null || v === '';
const clampRate = (n) => Math.min(99, Math.max(0, Number(n) || 0));
const safeRate = (rate) => (Number(rate) > 0 ? Number(rate) : 1450);

export const findQuoteTier = (key) => QUOTE_TIERS.find(t => t.key === key);

// ----------------------------------------------------------------------
// 1. 기본값 · 정규화
// ----------------------------------------------------------------------

/** 구간 기본 매출이익율(%) */
export const defaultTierRate = (key) => findQuoteTier(key)?.defaultRate ?? 0;

/** 원 ↔ $ 환산 (원 → $ 센트, $ → 원 1원 단위) */
export const convertAmount = (value, toUsd, rate) => {
  const v = Number(value) || 0;
  const r = safeRate(rate);
  return toUsd ? Number((v / r).toFixed(2)) : Math.round(v * r);
};

/** 구간 기본 YD당 정액 — 견적 통화로 (수출은 원화 기본값을 견적 환율로 환산) */
export const defaultTierAdd = (key, currency, rate) => {
  const krw = findQuoteTier(key)?.defaultAddKrw || 0;
  return currency === 'USD' ? convertAmount(krw, true, rate) : krw;
};

export const makeDefaultTierRates = () => Object.fromEntries(QUOTE_TIERS.map(t => [t.key, t.defaultRate]));
export const makeDefaultTierAdds = (currency = 'KRW', rate) =>
  Object.fromEntries(QUOTE_TIERS.map(t => [t.key, defaultTierAdd(t.key, currency, rate)]));

// 구간별 값 하나 꺼내기: 객체면 그 구간 값, 숫자(아주 예전 단일값)면 예전 3구간(1k/3k/5k)에만 적용
const pickTierValue = (val, key) => {
  if (val && typeof val === 'object') return val[key];
  return LEGACY_TIER_KEYS.includes(key) ? val : undefined;
};

/** 매출이익율 { 구간: % } 정규화 (0~99). 빈 구간은 fallback(key) — 기본: 구간 기본값 */
export const toQuoteTierRate = (val, fallback = defaultTierRate) =>
  Object.fromEntries(QUOTE_TIER_KEYS.map(k => {
    const v = pickTierValue(val, k);
    return [k, clampRate(isBlank(v) ? fallback(k) : v)];
  }));

/** YD당 정액 { 구간: 금액 } 정규화. 빈 구간은 fallback(key) */
export const toQuoteTierAdd = (val, fallback) =>
  Object.fromEntries(QUOTE_TIER_KEYS.map(k => {
    const v = pickTierValue(val, k);
    return [k, Math.max(0, Number(isBlank(v) ? fallback(k) : v) || 0)];
  }));

/** 견적이 지금 마진 방식(매출이익율·YD당 정액)인지 — 아니면 아주 옛날 extraMargin(마크업) 견적 */
export const isNewMarginModel = (quote) =>
  quote?.bulkMarginRate !== undefined ||
  quote?.marginAdd !== undefined ||
  (quote?.items || []).some(it => it && it.marginRate !== undefined);

/** 바이어 견적서에 보여줄 구간 (QUOTE_TIERS 순서). 저장값이 없으면 예전 견적 = 1,000/3,000/5,000 */
export const getShownTiers = (quote) => {
  const saved = Array.isArray(quote?.shownTiers) && quote.shownTiers.length ? quote.shownTiers : LEGACY_TIER_KEYS;
  return QUOTE_TIERS.filter(t => saved.includes(t.key));
};

/**
 * 견적을 작성 화면으로 불러올 때 정규화 (작성·수정·복제).
 *  - 구간별 이익율·정액을 6구간 객체로 (빈 구간은 기본값 → 예전 견적에 새 구간을 켜도 이익율 0% 안 됨)
 *  - 표시 구간·외관검사/시험성적서 빼기·별도 견적 기본값
 *  - 아주 옛날 extraMargin 견적은 가격 보존을 위해 마진은 손대지 않음
 */
export const normalizeQuote = (quote) => {
  if (!quote) return quote;
  const base = { ...quote, customItems: Array.isArray(quote.customItems) ? quote.customItems : [] };
  if (!isNewMarginModel(quote)) return base;
  const currency = quote.currency || 'KRW';
  const bulk = toQuoteTierRate(quote.bulkMarginRate);
  return {
    ...base,
    bulkMarginRate: bulk,
    marginAdd: toQuoteTierAdd(quote.marginAdd, (k) => (LEGACY_TIER_KEYS.includes(k) ? 0 : defaultTierAdd(k, currency, quote.exchangeRate))),
    shownTiers: getShownTiers(quote).map(t => t.key),
    excludeVisual: quote.excludeVisual === true,
    excludeChem: quote.excludeChem === true,
    items: (quote.items || []).map(it => ({ ...it, marginRate: toQuoteTierRate(it.marginRate, (k) => bulk[k]) })),
  };
};

/** 견적 YD당 정액(모든 구간)을 통화가 바뀔 때 견적 환율로 환산 */
export const convertMarginAdd = (marginAdd, toUsd, rate) =>
  Object.fromEntries(QUOTE_TIER_KEYS.map(k => [k, convertAmount(marginAdd?.[k], toUsd, rate)]));

/** 원가 조각 환산 (원가 조각은 반올림 전 값이라 그대로 나누기/곱하기) */
export const convertCostParts = (parts, toUsd, rate) => {
  if (!parts) return parts;
  const r = safeRate(rate);
  const f = (v) => (toUsd ? (Number(v) || 0) / r : (Number(v) || 0) * r);
  return { raw: f(parts.raw), chem: f(parts.chem), visual: f(parts.visual) };
};

// ----------------------------------------------------------------------
// 2. 기준원가 (외관검사·시험성적서 빼기)
// ----------------------------------------------------------------------

/**
 * 원가 조각 → 영업 기준원가. 빼기 없으면 원가 엔진의 finalCostYd와 같은 값.
 * @param {{raw, chem, visual}} parts 반올림·위험마진 전 YD당 순원가와 그중 이화학·외관검사 몫 (견적 통화)
 * @param {number} riskPct 위험마진(%)
 * @param {{excludeVisual, excludeChem}} exclude
 * @param {string} currency 'KRW' | 'USD'
 */
export const computeBaseFromParts = (parts, riskPct, exclude = {}, currency) => {
  if (!parts) return null;
  const raw = (Number(parts.raw) || 0)
    - (exclude.excludeVisual ? Number(parts.visual) || 0 : 0)
    - (exclude.excludeChem ? Number(parts.chem) || 0 : 0);
  return smartRound(Math.max(0, raw) * (1 + (Number(riskPct) || 0) / 100), currency);
};

/** 원가 엔진 결과(한 구간·한 시장)에서 원가 조각 꺼내기 */
export const partsFromCost = (modeResult) => ({
  raw: Number(modeResult?.rawCostYd) || 0,
  chem: Number(modeResult?.chemYd) || 0,
  visual: Number(modeResult?.visualYd) || 0,
});

// ----------------------------------------------------------------------
// 3. 기준 견적 판매가
// ----------------------------------------------------------------------

/** 품목의 구간 기준원가 — 없으면 null (예전 견적에 새로 켠 구간 등) */
export const getBasePrice = (item, tier) => {
  const v = item?.[`basePrice${tier}`] ?? item?.[`price${tier}`];
  return isBlank(v) ? null : Number(v) || 0;
};

/** 품목·구간 매출이익율 — 품목 값 → 견적 일괄값 → 구간 기본값 */
export const getItemTierRate = (item, quote, tier) => {
  const fromItem = pickTierValue(item?.marginRate, tier);
  if (!isBlank(fromItem)) return clampRate(fromItem);
  const fromQuote = pickTierValue(quote?.bulkMarginRate, tier);
  if (!isBlank(fromQuote)) return clampRate(fromQuote);
  return defaultTierRate(tier);
};

/** 견적의 구간 YD당 정액 — 저장값이 없으면 예전 3구간은 0, 새 구간은 기본값 */
export const getTierAdd = (quote, tier) => {
  const v = quote?.marginAdd?.[tier];
  if (!isBlank(v)) return Math.max(0, Number(v) || 0);
  return LEGACY_TIER_KEYS.includes(tier) ? 0 : defaultTierAdd(tier, quote?.currency, quote?.exchangeRate);
};

/**
 * 기준 견적 판매가 (화면·PDF·엑셀·견적 목록 공통). 기준원가가 없으면 null ('—' 표시).
 * 아주 옛날 extraMargin 견적은 예전 마크업 방식으로 숫자 보존.
 */
export const calcQuotePrice = (item, tier, quote, currency) => {
  const base = getBasePrice(item, tier);
  if (base === null) return null;
  const isNewModel =
    (quote && (quote.marginAdd !== undefined || quote.bulkMarginRate !== undefined)) ||
    (item && item.marginRate !== undefined);
  if (!isNewModel) {
    const markup = 1 + (Number(quote?.extraMargin) || 0) / 100;
    return smartRound(base * markup, currency);
  }
  return smartRound(applyGrossMargin(base, getItemTierRate(item, quote, tier)) + getTierAdd(quote, tier), currency);
};

/** 견적 가격 표기 (￦/$). null 이면 '—' */
export const formatQuotePrice = (price, currency) => {
  if (price === null || price === undefined) return '—';
  return currency === 'USD' ? `$${usd(price)}` : `￦${num(price)}`;
};

// ----------------------------------------------------------------------
// 4. 별도 견적
// ----------------------------------------------------------------------

/** 수량이 속한 기준 구간 (그 수량 이하 중 가장 큰 구간, 300YD 미만은 300YD 구간) */
export const tierForQty = (qty) => {
  const q = Number(qty) || 0;
  let found = QUOTE_TIERS[0];
  QUOTE_TIERS.forEach(t => { if (q >= t.qty) found = t; });
  return found;
};

/** 별도 견적 줄 매출이익율 — 줄에 넣은 값, 비었으면 수량 구간의 견적 일괄값 */
export const getCustomRowRate = (row, quote) =>
  (isBlank(row?.marginRate) ? getItemTierRate(null, quote, tierForQty(row?.qty).key) : clampRate(row.marginRate));

/** 별도 견적 줄 YD당 정액 — 줄에 넣은 값, 비었으면 수량 구간의 견적 정액 */
export const getCustomRowAdd = (row, quote) =>
  (isBlank(row?.marginAdd) ? getTierAdd(quote, tierForQty(row?.qty).key) : Math.max(0, Number(row.marginAdd) || 0));

/** 별도 견적 판매가 (YD당). 기준원가가 없으면(수량·컬러 미입력) null */
export const calcCustomQuotePrice = (row, quote, currency) => {
  if (isBlank(row?.basePrice)) return null;
  return smartRound(applyGrossMargin(Number(row.basePrice) || 0, getCustomRowRate(row, quote)) + getCustomRowAdd(row, quote), currency);
};

/** 바이어 별도 견적서에 나갈 줄 (견적서 표시 체크된 줄) */
export const getShownCustomItems = (quote) => (quote?.customItems || []).filter(r => r && r.show !== false);

/** 별도 견적 조건 문구 (바이어 견적서용 영문) */
export const describeCustomConditions = (row) => {
  const parts = [];
  if (row?.excludeVisual) parts.push('EXCL. VISUAL INSPECTION');
  if (row?.excludeChem) parts.push('EXCL. TEST REPORT');
  return parts.join(' / ');
};
