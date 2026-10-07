import { isImportSupplier, findImportCountry, getImportFreightRange } from '../../utils/costModel';
import { rateForMarket } from '../../utils/helpers';

// ============================================================
// 원사 목록 — PC 행(YarnLibraryRow)·모바일 카드(MobileYarnCard) 공통 계산 (2026-10-06 모음)
// ============================================================

/**
 * 대표 공급처 기준 단가 정보
 *  · 관세는 내수(Dom)에만 포함, 수출(Export)에는 미포함
 *  · 달러 원사의 원화 단가는 내수 환율로 (목록은 내수 단가를 보여 줌 — 2026-10-07 내수·수출 환율 분리)
 *  · 수입사는 운반비가 원사 kg 구간(원가 설정 · 국가별) → 운반비·내수 단가를 범위(importRange)로 표시
 *  · 최종 수정일: 대표 공급처 단가 이력 history[0](최신), 없으면 원사 updatedAt
 * @param {Object} exchangeRates 공통 환율 두 칸 { domestic, export }
 */
export const getYarnRowInfo = (y, exchangeRates, costSettings) => {
  const defSup = y.suppliers?.find(s => s.isDefault) || y.suppliers?.[0] || {};
  // Number()로 명시적 변환 — Firestore에서 문자열로 올 수 있음
  const rawPrice = Number(defSup.price) || 0;
  const rate = rateForMarket(exchangeRates, 'domestic');
  const convertedPrice = defSup.currency === 'USD' ? rawPrice * rate : rawPrice;
  const tariffAmt = convertedPrice * (Number(defSup.tariff || 0) / 100);
  const isImport = isImportSupplier(defSup);
  const importCountry = isImport ? findImportCountry(costSettings, defSup.importCountry) : null;
  const importRange = isImport ? getImportFreightRange(costSettings, importCountry.id) : null;
  const freightAmt = isImport ? 0 : (Number(defSup.freight) || 0);
  const domPrice = Math.round(convertedPrice + tariffAmt + freightAmt);
  const lastPriceDate = (defSup.history && defSup.history.length > 0) ? defSup.history[0].date : (y.updatedAt || null);
  return { defSup, rate, rawPrice, convertedPrice, tariffAmt, isImport, importCountry, importRange, freightAmt, domPrice, lastPriceDate };
};

// 분류(카테고리) 배지 색 — 이름으로 정해짐 (같은 분류는 늘 같은 색)
const CATEGORY_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
];
export const getCategoryColor = (cat) => {
  const hash = String(cat).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
};
