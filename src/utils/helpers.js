// GRUBIG ERP - 공통 유틸리티 함수

/**
 * 숫자를 한국어 표기법(천 단위 콤마)으로 포맷팅합니다.
 */
export const num = (v) => Number(v || 0).toLocaleString();

/**
 * 숫자를 USD(미국 달러) 표기법으로 소수점 둘째 자리까지 포맷팅합니다.
 */
export const usd = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 주어진 기준(gsm, widthFull)으로 이론상의 야드당 중량(G/YD)을 계산합니다.
 */
export const calculateGYd = (gsm, widthFull) => Math.round(gsm * widthFull * 0.02322576);

/**
 * 가격을 통화에 맞추어 스마트하게 반올림 처리합니다.
 * - USD: 소수점 2자리로 반올림
 * - KRW: 백 원 단위로 반올림
 */
export const smartRound = (value, currency) => 
  currency === 'USD' ? Number(value.toFixed(2)) : Math.round(value / 100) * 100;

/**
 * 타겟 마진율(%)에 맞춰 원가에서 판매가를 산출(Gross Margin)합니다.
 * 공식: cost / (1 - margin%)
 */
export const applyGrossMargin = (cost, margin) => 
  margin >= 100 ? 0 : cost / (1 - (margin / 100));

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
