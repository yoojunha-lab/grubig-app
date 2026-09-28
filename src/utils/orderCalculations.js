// GRUBIG ERP - 생산 모듈 공통 계산 헬퍼 (날짜 / 수량)
// 순수 함수 모음 (외부 I/O 없음). 오더 구조 관련 로직은 orderModel.js 참고.
// v8: 차수 기반 계산(진행률·마감 알림·위험 감지 등)은 차수 폐기와 함께 삭제됨.

import { KG_CONVERSION_COEFFICIENT } from '../constants/production';

// ============================================================
// 1. 날짜 헬퍼 (달력 기준, Working Day 사용 안 함)
//    모든 날짜는 'YYYY-MM-DD' 문자열로 주고받음 (로컬 시간 기준)
// ============================================================

// YYYY-MM-DD 문자열 → Date (로컬 자정)
export const toDate = (s) => {
  if (!s) return null;
  const d = new Date(String(s).length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
};

// Date → YYYY-MM-DD 문자열
export const toYmd = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 날짜 문자열에 N일 더하기
export const addDaysYmd = (ymd, days) => {
  const d = toDate(ymd);
  if (!d) return '';
  d.setDate(d.getDate() + Number(days || 0));
  return toYmd(d);
};

// 두 날짜 차이 (일 단위, b - a). 둘 중 하나라도 없거나 잘못되면 0
export const diffDaysYmd = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
};

// 오늘 YYYY-MM-DD
export const todayYmd = () => toYmd(new Date());

// 'YYYY-MM-DD' → 'M/D' (표에서 짧게 보여줄 때)
export const shortDate = (ymd) => {
  const d = toDate(ymd);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 올바른 'YYYY-MM-DD' 인지
export const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !!toDate(s);

// ============================================================
// 2. 수량 헬퍼
// ============================================================

// 소수 1자리 반올림 (KG 표시/저장 기준)
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// 숫자 입력값 정리: '' / null / 이상값 → null, 그 외 Number
export const toNumberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// KG 표시용 (천단위 콤마, 소수 1자리까지)
export const fmtKg = (n) => {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
};

// YD → KG 환산 (레거시 YD 오더 변환용)
// kg = (yd × gsm × widthFull × 0.02322576) / 1000. gsm 또는 폭이 없으면 0
export const calcKgFromYd = (yd, gsm, widthFull) => {
  const _yd = Number(yd) || 0;
  const _gsm = Number(gsm) || 0;
  const _w = Number(widthFull) || 0;
  if (_yd <= 0 || _gsm <= 0 || _w <= 0) return 0;
  return Math.round((_yd * _gsm * _w * KG_CONVERSION_COEFFICIENT) / 1000 * 100) / 100;
};
