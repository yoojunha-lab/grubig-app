// GRUBIG ERP - 공통 유틸리티 함수

/**
 * 숫자를 한국어 표기법(천 단위 콤마)으로 포맷팅합니다.
 * 내수(domestic)일 경우 정수(소수점 0자리), 수출(export)일 경우 소수점 둘째 자리 고정.
 */
export const num = (v, viewMode = 'domestic') => {
  const isExport = viewMode === 'export';
  return Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: isExport ? 2 : 0,
    maximumFractionDigits: isExport ? 2 : 0
  });
};

/**
 * 숫자를 USD(미국 달러) 표기법으로 소수점 둘째 자리까지 포맷팅합니다.
 */
export const usd = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 주어진 기준(gsm, widthFull)으로 이론상의 야드당 중량(G/YD)을 계산합니다.
 */
export const calculateGYd = (gsm, widthFull) => Math.round(gsm * widthFull * 0.02322576);

/**
 * MCQ(Minimum Color Quantity)를 100kg(=100,000g) 기준 야드(YD)로 계산합니다.
 * 공식: 100,000g ÷ (G/YD × (1 + 염색 LOSS%))
 * 결과는 100단위 올림(Math.ceil) 처리하여 실무 단위(100yd 묶음)에 맞춥니다.
 *
 * @param {number} gYd - 야드당 중량 (g/yd)
 * @param {number} dyeLossPct - 염색 LOSS 백분율 (예: 10 = 10%)
 * @returns {number} 100단위 올림된 MCQ 야드 (계산 불가 시 0)
 */
export const calculateMcqYd = (gYd, dyeLossPct) => {
  const g = Number(gYd) || 0;
  if (g <= 0) return 0;
  const lossRatio = 1 + ((Number(dyeLossPct) || 0) / 100);
  const denom = g * lossRatio;
  if (denom <= 0) return 0;
  const rawYd = 100000 / denom;
  return Math.ceil(rawYd / 100) * 100;
};

/**
 * 숫자를 [min, max] 범위로 clamp. NaN/null/undefined는 0으로 처리.
 * - 음수/100% 초과 입력 차단 등 입력 검증에 사용
 */
export const clampNum = (value, min = 0, max = Infinity) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

/**
 * 가격을 통화에 맞추어 스마트하게 반올림 처리합니다.
 * - USD: 소수점 2자리로 반올림
 * - KRW: 백 원 단위로 반올림
 */
export const smartRound = (value, currency) => {
  const safeVal = Number(value) || 0;
  return currency === 'USD' ? Number(safeVal.toFixed(2)) : Math.round(safeVal / 100) * 100;
};

/**
 * 타겟 마진율(%)에 맞춰 원가에서 판매가를 산출(Gross Margin)합니다.
 * 공식: cost / (1 - margin%)
 */
export const applyGrossMargin = (cost, margin) =>
  margin >= 100 ? 0 : cost / (1 - (margin / 100));

/**
 * 가설계서 영업견적 판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액.
 * DesignSheetPage(isTempMode)·TempDesignSheetListPage 공용 (중복 제거).
 * @param {Object} cost   calculateCost 결과
 * @param {Object} sheet  quoteMarginRate·quoteMarginAdd 보유 시트
 * @param {string} viewMode 'domestic' | 'export'
 * @param {string} tierKey 'tier1k' | 'tier3k' | 'tier5k'
 */
export const computeSellPrice = (cost, sheet, viewMode, tierKey) => {
  const base = cost?.[tierKey]?.[viewMode]?.finalCostYd || 0;
  const rate = Number(sheet?.quoteMarginRate) || 0;
  const add = Number(sheet?.quoteMarginAdd) || 0;
  return smartRound(applyGrossMargin(base, rate) + add, viewMode === 'export' ? 'USD' : 'KRW');
};

/**
 * 매출이익율(%) 값을 구간별 객체 { '1k', '3k', '5k' } 로 정규화합니다. (0~99 clamp)
 *  - 숫자(레거시 단일값) → 세 구간 모두 같은 값으로 펼침
 *  - 객체(신규 구간별) → 각 구간값을 clamp
 *  - null/undefined/빈값 → { '1k':0, '3k':0, '5k':0 }
 */
export const toTierRate = (val) => {
  const clamp = (n) => Math.min(99, Math.max(0, Number(n) || 0));
  if (val && typeof val === 'object') {
    return { '1k': clamp(val['1k']), '3k': clamp(val['3k']), '5k': clamp(val['5k']) };
  }
  const v = clamp(val);
  return { '1k': v, '3k': v, '5k': v };
};

/**
 * 견적서를 에디터(작성/수정/복제)로 불러올 때, 매출이익율을 구간별 객체로 정규화합니다.
 *  - 일괄값(bulkMarginRate)과 각 품목(item.marginRate)을 { '1k','3k','5k' } 형태로 통일
 *  - 단, 아주 옛날 'extraMargin'만 가진 레거시 견적은 그대로 둠(가격 보존)
 */
export const normalizeQuoteMargins = (quote) => {
  if (!quote) return quote;
  const isNewModel =
    quote.bulkMarginRate !== undefined ||
    quote.marginAdd !== undefined ||
    (quote.items || []).some(it => it && it.marginRate !== undefined);
  if (!isNewModel) return quote; // extraMargin 기반 구버전 견적은 손대지 않음
  return {
    ...quote,
    bulkMarginRate: toTierRate(quote.bulkMarginRate),
    items: (quote.items || []).map(it => ({ ...it, marginRate: toTierRate(it.marginRate) })),
  };
};

/**
 * 특정 날짜 문자열(YYYY-MM-DD 등)을 입력받아 해당 달의 마지막 날짜를
 * 'MMM DD, YYYY' 영문 대문자 포맷으로 반환합니다. (견적서 유효기간 표기용)
 */
export const getLastDayOfQuoteMonth = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    .toUpperCase();
};

/**
 * 견적서 유효기간(Valid Until) 선택 옵션 목록.
 * value: quoteInput.validityOption 에 저장되는 키
 * label: 화면(드롭다운) 표시용 한국어 라벨
 */
export const QUOTE_VALIDITY_OPTIONS = [
  { value: '2weeks', label: '2주 (견적일 + 14일)' },
  { value: '1month', label: '1개월' },
  { value: '2months', label: '2개월' },
  { value: '3months', label: '3개월' },
  { value: 'endOfMonth', label: '이번 달 말일' },
];

/**
 * 견적 작성일과 선택 옵션을 받아 유효기간 만료일을
 * 'MMM DD, YYYY' 영문 대문자 포맷으로 반환합니다. (견적서 VALID UNTIL 표기용)
 * - 옵션 값이 없으면(예전 저장 견적서 등) 기본값 '2weeks'(작성일 + 2주) 적용.
 * @param {string} dateString - 견적 작성일 (YYYY-MM-DD)
 * @param {string} option - '2weeks' | '1month' | '2months' | '3months' | 'endOfMonth'
 */
export const getQuoteValidUntil = (dateString, option = '2weeks') => {
  const base = dateString ? new Date(dateString) : new Date();
  let target;
  switch (option) {
    case '1month':
      target = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
      break;
    case '2months':
      target = new Date(base.getFullYear(), base.getMonth() + 2, base.getDate());
      break;
    case '3months':
      target = new Date(base.getFullYear(), base.getMonth() + 3, base.getDate());
      break;
    case 'endOfMonth':
      return getLastDayOfQuoteMonth(dateString);
    case '2weeks':
    default:
      target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 14);
      break;
  }
  return target
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    .toUpperCase();
};

// ----------------------------------------------------------------------
// 견적서 가격 표시 공통 헬퍼 (R1)
// 견적 아이템의 신규/레거시 필드 호환 + extraMargin 가산 + 통화 포맷을
// 단일 진실원에서 처리하여 Quotation/History/PDF 4곳에서 일관된 가격 표시.
// ----------------------------------------------------------------------

/**
 * 견적 아이템에서 tier별 base price를 안전하게 추출.
 * 신규 필드(basePrice1k/3k/5k) 우선, 레거시 필드(price1k/3k/5k) 폴백.
 * @param {Object} item - 견적 아이템 객체
 * @param {string} tier - '1k' | '3k' | '5k'
 */
export const getBasePrice = (item, tier) => {
  const newKey = `basePrice${tier}`;
  const oldKey = `price${tier}`;
  return Number(item?.[newKey] ?? item?.[oldKey] ?? 0);
};

/**
 * 견적 가격 계산: '매출이익율(%)'(원단별·구간별) + 'YD당 정액(원/$)'(구간별)을 적용한 뒤 통화별 스마트 반올림.
 * 공식: 판가 = base / (1 - rate%) + add
 *  - rate = 원단별 매출이익율(item.marginRate[tier]). 없으면 일괄값(quote.bulkMarginRate[tier])
 *           ※ 레거시 저장본은 객체가 아닌 단일 숫자일 수 있어 그 경우 모든 구간에 동일 적용
 *  - add  = 구간별 YD당 정액(quote.marginAdd[tier])
 *  - rate=0, add=0 → 판가 = base (영업 기준원가 그대로)
 * @param {Object} item - 견적 아이템 (basePrice1k/3k/5k, marginRate 보유)
 * @param {string} tier - '1k' | '3k' | '5k'
 * @param {Object} quote - 견적 객체 (bulkMarginRate/marginAdd). 구버전은 extraMargin(%) 폴백.
 * @param {string} currency - 'USD' | 'KRW'
 */
export const calcQuotePrice = (item, tier, quote, currency) => {
  const base = getBasePrice(item, tier);
  const isNewModel =
    (quote && (quote.marginAdd !== undefined || quote.bulkMarginRate !== undefined)) ||
    (item && item.marginRate !== undefined);
  if (!isNewModel) {
    // 레거시 견적(extraMargin만 보유): 기존 마크업 방식으로 과거 숫자를 그대로 보존
    const markup = 1 + (Number(quote?.extraMargin) || 0) / 100;
    return smartRound(base * markup, currency);
  }
  // 매출이익율(%): 구간별 객체/단일 숫자 모두 지원. 원단별(item) 값 우선, 없으면 일괄값(quote).
  const pickRate = (val) => {
    if (val === undefined || val === null) return undefined;
    return (typeof val === 'object') ? (Number(val[tier]) || 0) : (Number(val) || 0);
  };
  const rate = pickRate(item?.marginRate) ?? pickRate(quote?.bulkMarginRate) ?? 0;
  const add = Number(quote?.marginAdd?.[tier]) || 0;
  return smartRound(applyGrossMargin(base, rate) + add, currency);
};

/**
 * 견적 가격을 통화별 표기(￦/$)로 포맷팅.
 * @param {number} price
 * @param {string} currency - 'USD' | 'KRW'
 */
export const formatQuotePrice = (price, currency) => {
  return currency === 'USD' ? `$${usd(price)}` : `￦${num(price)}`;
};
