// GRUBIG ERP - 견적 계산 (순수 함수 — React/Firestore 의존 없음)
//
// ■ 기준 견적: 품목마다 구간별 영업 기준원가(basePrice{구간})를 넣을 때의 값으로 저장
//   판매가 = 기준원가 ÷ (1 − 매출이익율%) + YD당 정액 → 통화별 반올림 (원 100원 / $ 센트)
//   · 매출이익율: 품목 값 → 견적 일괄값 → 구간 기본값 순으로 찾음 (빈 구간이 0%가 되지 않게)
//   · YD당 정액: 항상 원화로 적음 (marginAddCurrency 'KRW', 대표님 요청 2026-10-05).
//     수출 견적은 판매가를 낼 때 견적 환율로 나눠 $로 더함. 예전 수출 견적은 $로 적혀 있어
//     (marginAddCurrency 없음 + 통화 USD) 그 값 그대로 씀 → 예전 견적 판매가는 바뀌지 않음
// ■ 별도 견적: 줄마다 수량·컬러수를 넣어 원가부터 다시 계산한 기준원가(basePrice)
//   이익율을 비워 두면 수량이 속한 기준 구간의 견적 일괄값, YD당 정액은 비워 두면 0 (대표님 지정 2026-10-05)
// ■ 외관검사·시험성적서(이화학) 제외: 기준 견적 전체(excludeVisual/excludeChem) · 별도 견적 전체
//   (customExcludeVisual/customExcludeChem — 2026-10-05 대표님 요청으로 줄마다 → 칸 전체).
//   원가 조각(costParts: 반올림·위험마진 전 YD당 순원가와 그중 이화학·외관검사 몫)을 같이 저장해 두고,
//   버튼을 바꾸면 조각으로 기준원가를 다시 만듦 (다른 원가는 그대로)

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

/** 구간 기본값 요약 (확인 창 문구용) — 예: '300·500YD 25% · 2,000원 / 800YD 23% · 1,500원 / …' */
export const describeTierDefaults = () => {
  const groups = [];
  QUOTE_TIERS.forEach(t => {
    const last = groups[groups.length - 1];
    const label = t.label.replace(' YD', '');
    if (last && last.rate === t.defaultRate && last.add === t.defaultAddKrw) last.labels.push(label);
    else groups.push({ labels: [label], rate: t.defaultRate, add: t.defaultAddKrw });
  });
  return groups.map(g => `${g.labels.join('·')}YD ${g.rate}% · ${num(g.add)}원`).join(' / ');
};

/** YD당 정액을 적어 둔 통화 — 'KRW'(2026-10-05부터 항상 원화) / 'USD'(예전 수출 견적: $로 적혀 있음) */
export const getMarginAddCurrency = (quote) =>
  quote?.marginAddCurrency || (quote?.currency === 'USD' ? 'USD' : 'KRW');

/**
 * 적어 둔 YD당 정액 → 견적 통화 금액 (반올림 전). 원화로 적은 정액을 수출 견적에서는 견적 환율로 나눔.
 * (예전 수출 견적의 $ 정액은 그대로)
 */
export const toQuoteCurrencyAdd = (value, quote) => {
  const v = Math.max(0, Number(value) || 0);
  const basis = getMarginAddCurrency(quote);
  const isUsdQuote = quote?.currency === 'USD';
  if (isUsdQuote && basis === 'KRW') return v / safeRate(quote?.exchangeRate);
  if (!isUsdQuote && basis === 'USD') return v * safeRate(quote?.exchangeRate); // 안전장치 (내수로 바꿀 때 원화로 바꿔 두므로 보통 없음)
  return v;
};

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
  const addBasis = getMarginAddCurrency(quote);
  const bulk = toQuoteTierRate(quote.bulkMarginRate);
  return {
    ...base,
    bulkMarginRate: bulk,
    marginAddCurrency: addBasis,
    marginAdd: toQuoteTierAdd(quote.marginAdd, (k) => (LEGACY_TIER_KEYS.includes(k) ? 0 : defaultTierAdd(k, addBasis, quote.exchangeRate))),
    shownTiers: getShownTiers(quote).map(t => t.key),
    excludeVisual: quote.excludeVisual === true,
    excludeChem: quote.excludeChem === true,
    customExcludeVisual: quote.customExcludeVisual === true,
    customExcludeChem: quote.customExcludeChem === true,
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

/** 견적의 구간 YD당 정액 — 적어 둔 값 그대로 (원화 / 예전 수출 견적은 $). 없으면 예전 3구간 0, 새 구간 기본값 */
export const getTierAddRaw = (quote, tier) => {
  const v = quote?.marginAdd?.[tier];
  if (!isBlank(v)) return Math.max(0, Number(v) || 0);
  return LEGACY_TIER_KEYS.includes(tier) ? 0 : defaultTierAdd(tier, getMarginAddCurrency(quote), quote?.exchangeRate);
};

/** 견적 통화로 바꾼 구간 YD당 정액 (판매가 계산용) */
export const getTierAdd = (quote, tier) => toQuoteCurrencyAdd(getTierAddRaw(quote, tier), quote);

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

/** 별도 견적 줄 YD당 정액 — 적어 둔 값 (줄에 넣은 값, 비었으면 0 — 대표님 지정 2026-10-05). 원화 / 예전 수출 견적은 $ */
export const getCustomRowAddRaw = (row, _quote) =>
  (isBlank(row?.marginAdd) ? 0 : Math.max(0, Number(row.marginAdd) || 0));

/** 견적 통화로 바꾼 별도 견적 줄 YD당 정액 (판매가 계산용) */
export const getCustomRowAdd = (row, quote) => toQuoteCurrencyAdd(getCustomRowAddRaw(row, quote), quote);

/** 별도 견적 판매가 (YD당). 기준원가가 없으면(수량·컬러 미입력) null */
export const calcCustomQuotePrice = (row, quote, currency) => {
  if (isBlank(row?.basePrice)) return null;
  return smartRound(applyGrossMargin(Number(row.basePrice) || 0, getCustomRowRate(row, quote)) + getCustomRowAdd(row, quote), currency);
};

/** 바이어 별도 견적서에 나갈 줄 (견적서 표시 체크된 줄) */
export const getShownCustomItems = (quote) => (quote?.customItems || []).filter(r => r && r.show !== false);

/** 별도 견적 전체 — 외관검사 / 시험성적서 제외 */
export const getCustomExclude = (quote) => ({
  excludeVisual: quote?.customExcludeVisual === true,
  excludeChem: quote?.customExcludeChem === true,
});

/**
 * 바이어 견적서(PDF·엑셀)로 내보내기 전에 확인
 *  - errors: 하나라도 있으면 내보내지 않음 (바이어 이름 없음, 단가 '—' 칸, 수량·컬러 빈 별도 견적 줄 등)
 *  - warnings: 확인 창을 띄우고 진행 ('원가 확인 필요' 품목 등)
 * @param {'standard'|'special'} kind
 */
export const validateQuoteForExport = (quote, kind = 'standard') => {
  const errors = [];
  const warnings = [];
  if (!String(quote?.buyerName || '').trim()) errors.push('바이어 이름을 넣어 주세요.');
  const listOf = (arr, max = 8) => `${arr.slice(0, max).join(', ')}${arr.length > max ? ` 외 ${arr.length - max}개` : ''}`;
  if (kind === 'special') {
    const rows = getShownCustomItems(quote);
    if (rows.length === 0) errors.push("별도 견적서에 넣을 줄이 없어요. (별도 견적의 '견적서' 체크 확인)");
    const bad = rows.filter(r => isBlank(r.basePrice) || !(Number(r.qty) > 0) || !(Number(r.colors) > 0));
    if (bad.length) errors.push(`수량·컬러가 비어 있거나 원가가 없는 줄이 있어요: ${listOf(bad.map(r => r.article))}`);
    const warned = rows.filter(r => (r.costWarnings || []).length > 0);
    if (warned.length) warnings.push(`'원가 확인 필요' 줄 ${warned.length}개: ${listOf(warned.map(r => r.article))}`);
    return { errors, warnings };
  }
  const items = quote?.items || [];
  if (items.length === 0) errors.push('기준 견적에 품목이 없어요.');
  const tiers = getShownTiers(quote);
  const missing = [];
  items.forEach(it => tiers.forEach(t => { if (getBasePrice(it, t.key) === null) missing.push(`${it.article} ${t.label}`); }));
  if (missing.length) {
    errors.push(`단가가 없는 칸이 있어요 (예전에 넣은 품목): ${listOf(missing, 6)}\n→ [현재 원가로 다시 계산]을 누르거나, 그 구간의 '견적서 표시'를 끄세요.`);
  }
  const warned = items.filter(it => (it.costWarnings || []).length > 0);
  if (warned.length) warnings.push(`'원가 확인 필요' 품목 ${warned.length}개: ${listOf(warned.map(it => it.article))}`);
  return { errors, warnings };
};

// ----------------------------------------------------------------------
// 5. 바이어 견적서 문구 (PDF·엑셀 공통 — 한 곳에서만 관리)
// ----------------------------------------------------------------------

/** 가격 기준 문구: 원화 = 부가세 별도, 수출 = FOB */
export const quotePriceBasis = (currency) => (currency === 'USD' ? 'FOB PRICE' : 'PRICE IN KRW · VAT EXCLUDED');

/** 구간 이름 묶음 (예: '500 / 800 YD') */
export const tierLabels = (tiers) => `${tiers.map(t => t.label.replace(' YD', '')).join(' / ')} YD`;

/**
 * 바이어 견적서 약관 줄 (VALID UNTIL 제외 — PDF는 굵게, 엑셀은 머리줄에 따로 씀)
 * @param {Object} quote
 * @param {'standard'|'special'} kind 기준 견적서 / 별도 견적서
 * @returns {string[]}
 */
export const buildQuoteTerms = (quote, kind = 'standard') => {
  const isKrw = quote?.currency !== 'USD';
  const lines = ['±5% WEIGHT AND WIDTH TOLERANCE'];
  if (kind === 'special') {
    const ex = getCustomExclude(quote);
    lines.push('PRICES APPLY ONLY TO THE QUANTITY (TOTAL PER ORDER) AND NUMBER OF COLORS STATED');
    if (ex.excludeVisual) lines.push('VISUAL INSPECTION NOT INCLUDED');
    if (ex.excludeChem) lines.push('TEST REPORT NOT INCLUDED');
    if (isKrw) lines.push('VAT EXCLUDED');
    lines.push('OTHER QUANTITIES OR COLORS: PLEASE ASK FOR A NEW QUOTATION');
    return lines;
  }
  const tiers = getShownTiers(quote);
  const small = tiers.filter(t => t.group === 'small');
  const mcq = tiers.filter(t => t.group === 'mcq');
  lines.push('PRICES ARE PER YARD, BASED ON TOTAL ORDER QUANTITY');
  if (small.length) lines.push(`${tierLabels(small)}: UP TO 2 COLORS (SMALL-LOT DYEING CHARGE INCLUDED)`);
  if (mcq.length) lines.push(`${tierLabels(mcq)}: MCQ PER COLOR REQUIRED`);
  if (quote?.excludeVisual === true) lines.push('VISUAL INSPECTION NOT INCLUDED');
  if (quote?.excludeChem === true) lines.push('TEST REPORT NOT INCLUDED');
  if (isKrw) lines.push('VAT EXCLUDED');
  lines.push('BULK PRICING NEGOTIABLE');
  lines.push('UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ');
  return lines;
};
