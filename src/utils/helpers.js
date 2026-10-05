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
 * 큰 원화 금액을 '만' 단위로 짧게 표기합니다. (예: 739,020 → '73.9만', 600,000 → '60만')
 * 1만 미만은 그대로 천 단위 콤마.
 */
export const fmtMan = (v) => {
  const n = Number(v) || 0;
  return Math.abs(n) >= 10000
    ? `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}만`
    : num(n);
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
 * 공식: 100,000g ÷ (G/YD × (1 + 가공 LOSS%))   ← 가공 LOSS는 품목 가공 유형별 (원가 설정)
 * 결과는 100단위 올림(Math.ceil) 처리하여 실무 단위(100yd 묶음)에 맞춥니다.
 *
 * @param {number} gYd - 야드당 중량 (g/yd)
 * @param {number} dyeLossPct - 가공 LOSS 백분율 (예: 10 = 10%)
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
 * YD당 정액(quoteMarginAdd)은 항상 원화로 저장 → 수출 보기에서는 환율로 나눠 $로 더함
 *  (예전엔 화면 통화 그대로 더해서 내수/수출 보기를 바꾸면 ₩300이 $300이 되던 문제 수정)
 * @param {Object} cost   calculateCost 결과
 * @param {Object} sheet  quoteMarginRate·quoteMarginAdd 보유 시트 (구간별 {'1k','3k','5k'} 또는 레거시 단일값)
 * @param {string} viewMode 'domestic' | 'export'
 * @param {string} tierKey 'tier1k' | 'tier3k' | 'tier5k'
 * @param {number} exchangeRate 원/$ (수출 보기에서 YD당 정액 환산용)
 */
export const computeSellPrice = (cost, sheet, viewMode, tierKey, exchangeRate = 1450) => {
  const base = cost?.[tierKey]?.[viewMode]?.finalCostYd || 0;
  const t = tierKey.replace('tier', '');                   // 'tier1k' → '1k'
  const rate = toTierRate(sheet?.quoteMarginRate)[t] || 0; // 구간별 매출이익율(%)
  const addKrw = toTierAdd(sheet?.quoteMarginAdd)[t] || 0; // 구간별 YD당 정액 (원화)
  const isExport = viewMode === 'export';
  const add = isExport ? addKrw / (Number(exchangeRate) > 0 ? Number(exchangeRate) : 1450) : addKrw;
  return smartRound(applyGrossMargin(base, rate) + add, isExport ? 'USD' : 'KRW');
};

/**
 * [가설계서 판매가 시뮬레이션 전용] 견적서는 utils/quoteModel.js 의 toQuoteTierRate (300~5,000YD 6구간)
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
 * YD당 정액을 구간별 객체 { '1k', '3k', '5k' } 로 정규화합니다. (정액이므로 상한 clamp 없음)
 *  - 숫자(레거시 단일값) → 세 구간 모두 같은 값으로 펼침
 *  - 객체(신규 구간별) → 각 구간값을 숫자화
 *  - null/undefined/빈값 → { '1k':0, '3k':0, '5k':0 }
 */
export const toTierAdd = (val) => {
  const n = (x) => Number(x) || 0;
  if (val && typeof val === 'object') {
    return { '1k': n(val['1k']), '3k': n(val['3k']), '5k': n(val['5k']) };
  }
  const v = n(val);
  return { '1k': v, '3k': v, '5k': v };
};

/**
 * 날짜 → 'YYYY-MM-DD' (이 PC의 현지 시간 기준). 기본은 오늘.
 * toISOString()은 UTC라 한국 시간 오전 9시 전에는 어제 날짜가 나옴 → 날짜만 필요한 곳은 이 함수로.
 */
export const todayLocalISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

// 견적서 가격 계산(기준원가·판매가·별도 견적)은 utils/quoteModel.js 로 옮김 (2026-10-05)
