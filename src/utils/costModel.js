// GRUBIG ERP - 원단 원가 모델 (순수 함수 — React/Firestore 의존 없음)
//
// ■ 핵심: 수량(YD)을 넣으면 그 수량으로 오더 1건을 만들 때의 원가를 계산한다 → computeCostAtQty()
//   원가 표는 300·500·800YD(2컬러 기준) + 1,000·3,000·5,000YD(MCQ 충족 기준)를 넣은 결과를 보여준다
//   → calculateCostTiers() (구간 정의는 constants/costing.js의 COST_DISPLAY_TIERS)
//   나중에 임의 수량(예: 15,000YD) 칸을 만들 때도 computeCostAtQty 만 부르면 된다 (컬러수·MCQ 가정은 옵션).
//
// ■ 계산 순서 (오더 전체 금액으로 계산 → 마지막에 ÷ 수량 = YD당)
//   1) 가공지 kg   = 수량 × G/YD ÷ 1000
//   2) 생지 kg    = 가공지 kg × (1 + (가공 LOSS% + 후가공 LOSS%) ÷ 100)   ← 가공 LOSS는 가공 유형별(설정)
//   3) 편직 LOSS% = 생지 kg가 속한 구간의 % (설정, 'N kg 이하' 구간)
//   4) 원사 kg    = 생지 kg × (1 + 편직 LOSS% ÷ 100)
//   5) 재료비     = 원사 kg × 원사 단가(혼용 가중. 내수=관세포함 / 수출=관세제외)
//                  + 수입 원사 운반비 = 그 원사 kg(원사 kg × 혼용률) × 수입 국가 kg 구간의 kg당 금액 (설정)
//   6) 편직비     = max(난이도 정액, 생지 kg × kg단가)   ← 택시 기본요금 방식
//   7) 염가공비   = 청구 kg × 염가공료 — 컬러마다 따로 염색, 컬러당 가공지 kg가 최소 청구 kg(설정, 기본 100kg)
//                  미만이면 최소 kg로 청구. 'MCQ 충족' 가정이면 최소 청구 없음 (청구 kg = 가공지 kg)
//                  후가공비 = 가공지 kg × 후가공료
//   8) 이화학     = 컬러수 × 1컬러당 검사비 (컬러수 = 구간 가정, 없으면 수량 구간),  운임 = 수량 구간 금액(오더당),
//                  외관검사 = YD당 단가 × 수량
//   9) 품목별 추가비용 = YD당 금액 × 수량
//   → 순원가/YD = 합계 ÷ 수량,  영업 기준원가 = 순원가 × (1 + 위험마진%)  (반올림은 마지막에만)
//
// ■ settings 인자는 항상 resolveCostSettings() 결과(빈 칸이 기본값으로 채워진 설정)를 넘긴다.

import { calculateGYd, smartRound, num } from './helpers';
import {
  DEFAULT_COST_SETTINGS, DEFAULT_KNIT_GRADE_ID, DEFAULT_PROCESS_TYPE_ID, DEFAULT_KNIT_KG_RATE,
  DEFAULT_IMPORT_COUNTRY_ID, COST_DISPLAY_TIERS, LEGACY_ETC_IDS, LEGACY_ETC_NAMES,
} from '../constants/costing';

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const isBlank = (v) => v === undefined || v === null || v === '';

// ----------------------------------------------------------------------
// 1. 설정 정리
// ----------------------------------------------------------------------

/**
 * 구간 목록 정리: 경계값 숫자화 → 오름차순 정렬 → 같은 경계 중복 제거 → 마지막은 '초과' 구간(max=null)
 * @param {Array} list      [{ max, [valueKey] }]
 * @param {string} valueKey 'pct' | 'colors' | 'amount'
 * @param {Object} opts     maxValue: 값 상한 (LOSS%는 99), integer: 정수로 반올림
 */
export const normalizeBrackets = (list, valueKey, { maxValue = Infinity, integer = false } = {}) => {
  const fix = (v) => {
    const n = clamp(toNum(v), 0, maxValue);
    return integer ? Math.round(n) : n;
  };
  const rows = (Array.isArray(list) ? list : []).map(b => ({
    max: isBlank(b?.max) ? null : Number(b.max),
    value: fix(b?.[valueKey]),
  }));
  const bounded = rows
    .filter(r => r.max !== null && Number.isFinite(r.max) && r.max > 0)
    .sort((a, b) => a.max - b.max)
    .filter((r, i, arr) => i === 0 || r.max !== arr[i - 1].max);
  const opens = rows.filter(r => r.max === null);
  const openValue = opens.length
    ? opens[opens.length - 1].value
    : (bounded.length ? bounded[bounded.length - 1].value : 0);
  return [
    ...bounded.map(r => ({ max: r.max, [valueKey]: r.value })),
    { max: null, [valueKey]: openValue },
  ];
};

// 같은 id 중복 제거 (앞의 것 유지)
const uniqById = (list) => list.filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i);

/**
 * Firestore에 저장된 원가 설정(없거나 일부 빠져도 됨)을 계산에 바로 쓸 수 있는 완전한 설정으로 정리.
 * 항목이 비어 있으면 DEFAULT_COST_SETTINGS 로 채운다.
 */
export const resolveCostSettings = (raw) => {
  const r = (raw && typeof raw === 'object') ? raw : {};
  const d = DEFAULT_COST_SETTINGS;
  const pickList = (v, fallback) => (Array.isArray(v) && v.length ? v : fallback);
  const chem = (r.chemTest && typeof r.chemTest === 'object') ? r.chemTest : {};
  const defaultImportBrackets = d.importCountries[0].brackets;

  return {
    knitGrades: uniqById(pickList(r.knitGrades, d.knitGrades).map((g, i) => {
      const id = String(g?.id || `grade_${i}`);
      return {
        id,
        name: String(g?.name ?? '').trim() || id,
        fixedFee: Math.max(0, toNum(g?.fixedFee)),
        desc: String(g?.desc || ''),
      };
    })),
    knitLossBrackets: normalizeBrackets(pickList(r.knitLossBrackets, d.knitLossBrackets), 'pct', { maxValue: 99 }),
    processTypes: uniqById(pickList(r.processTypes, d.processTypes).map((t, i) => {
      const id = String(t?.id || `ptype_${i}`);
      return {
        id,
        name: String(t?.name ?? '').trim() || id,
        lossPct: clamp(toNum(t?.lossPct), 0, 99),
      };
    })),
    chemTest: {
      feePerColor: Math.max(0, toNum(isBlank(chem.feePerColor) ? d.chemTest.feePerColor : chem.feePerColor)),
      colorBrackets: normalizeBrackets(pickList(chem.colorBrackets, d.chemTest.colorBrackets), 'colors', { integer: true }),
    },
    freightBrackets: normalizeBrackets(pickList(r.freightBrackets, d.freightBrackets), 'amount'),
    visualInspectionPerYd: Math.max(0, toNum(isBlank(r.visualInspectionPerYd) ? d.visualInspectionPerYd : r.visualInspectionPerYd)),
    dyeMinKgPerColor: Math.max(0, toNum(isBlank(r.dyeMinKgPerColor) ? d.dyeMinKgPerColor : r.dyeMinKgPerColor)),
    // 수입 원사 운반비 — 국가별 kg 구간 ('N kg 미만'). 구간이 비면 기본(중국) 구간으로
    importCountries: uniqById(pickList(r.importCountries, d.importCountries).map((c, i) => {
      const id = String(c?.id || `ic_${i}`);
      return {
        id,
        name: String(c?.name ?? '').trim() || id,
        brackets: normalizeBrackets(pickList(c?.brackets, defaultImportBrackets), 'perKg'),
      };
    })),
    updatedAt: String(r.updatedAt || ''),
    updatedBy: String(r.updatedBy || ''),
  };
};

// ----------------------------------------------------------------------
// 2. 설정 조회 (구간 / 등급 / 유형)
// ----------------------------------------------------------------------

/**
 * 값이 속한 구간 ('max 이하' 규칙, 마지막 max=null 은 '초과' 구간). 목록이 비면 null
 *  · strict: true 면 'max 미만' 규칙 (마지막은 '이상' 구간) — 수입 원사 운반비
 */
export const pickBracket = (brackets, value, { strict = false } = {}) => {
  const list = Array.isArray(brackets) ? brackets : [];
  if (list.length === 0) return null;
  const v = toNum(value);
  return list.find(b => isBlank(b.max) || (strict ? v < Number(b.max) : v <= Number(b.max))) || list[list.length - 1];
};

/** 편직 난이도 — 없거나 삭제된 id면 기본(A) → 첫 번째 등급 */
export const findKnitGrade = (settings, gradeId) => {
  const list = settings?.knitGrades || [];
  const want = String(gradeId || DEFAULT_KNIT_GRADE_ID);
  return list.find(g => g.id === want)
    || list.find(g => g.id === DEFAULT_KNIT_GRADE_ID)
    || list[0]
    || { id: DEFAULT_KNIT_GRADE_ID, name: DEFAULT_KNIT_GRADE_ID, fixedFee: 0, desc: '' };
};

/** 가공 유형 — 없거나 삭제된 id면 기본(일반) → 첫 번째 유형 */
export const findProcessType = (settings, typeId) => {
  const list = settings?.processTypes || [];
  const want = String(typeId || DEFAULT_PROCESS_TYPE_ID);
  return list.find(t => t.id === want)
    || list.find(t => t.id === DEFAULT_PROCESS_TYPE_ID)
    || list[0]
    || { id: DEFAULT_PROCESS_TYPE_ID, name: '일반', lossPct: 0 };
};

/** 편직 LOSS% — 오더 전체 생지 kg 기준 */
export const getKnitLossPct = (settings, greigeKg) => toNum(pickBracket(settings?.knitLossBrackets, greigeKg)?.pct);

/** 이화학 검사 컬러수 — 오더 수량(YD) 기준 */
export const getChemColors = (settings, qty) => toNum(pickBracket(settings?.chemTest?.colorBrackets, qty)?.colors);

/**
 * 오더 컬러수 — 구간이 정한 컬러수(예: 소량 2컬러)가 있으면 그 값, 없으면 이화학 수량 구간의 컬러수.
 * 이화학 검사 횟수와 염색(컬러마다 따로) 양쪽에 쓴다.
 */
export const resolveOrderColors = (settings, qty, colors) =>
  (isBlank(colors) ? getChemColors(settings, qty) : Math.max(0, Math.round(toNum(colors))));

/** 운임 오더 총액 — 오더 수량(YD) 기준 */
export const getFreightAmount = (settings, qty) => toNum(pickBracket(settings?.freightBrackets, qty)?.amount);

/** 원사 공급처가 수입사인지 (원사 라이브러리 공급처 줄의 [수입] 체크) */
export const isImportSupplier = (sup) => sup?.isImport === true;

/** 수입 국가 — 없거나 삭제된 id면 기본(중국) → 첫 번째 국가 */
export const findImportCountry = (settings, countryId) => {
  const list = settings?.importCountries || [];
  const want = String(countryId || DEFAULT_IMPORT_COUNTRY_ID);
  return list.find(c => c.id === want)
    || list.find(c => c.id === DEFAULT_IMPORT_COUNTRY_ID)
    || list[0]
    || DEFAULT_COST_SETTINGS.importCountries[0];
};

/** 수입 원사 운반비 (원/kg) — 그 원사의 오더 투입 kg가 속한 구간 ('N kg 미만' 규칙) */
export const getImportFreightPerKg = (settings, countryId, yarnKg) =>
  toNum(pickBracket(findImportCountry(settings, countryId).brackets, yarnKg, { strict: true })?.perKg);

/** 국가 구간의 kg당 운반비 최저·최고 — 원사 라이브러리 목록의 범위 표시용 */
export const getImportFreightRange = (settings, countryId) => {
  const values = (findImportCountry(settings, countryId).brackets || []).map(b => toNum(b.perKg));
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 0 };
};

/** 국가 구간을 화면용 문구로 → [{ label: '300kg 미만' | '300~1,000kg' | '2,000kg 이상', perKg }] */
export const describeImportBrackets = (country) => {
  const list = Array.isArray(country?.brackets) ? country.brackets : [];
  return list.map((b, i) => {
    const prev = i > 0 ? list[i - 1].max : null;
    let label;
    if (isBlank(b.max)) label = isBlank(prev) ? '모든 kg' : `${num(prev)}kg 이상`;
    else if (isBlank(prev)) label = `${num(b.max)}kg 미만`;
    else label = `${num(prev)}~${num(b.max)}kg`;
    return { label, perKg: toNum(b.perKg) };
  });
};

// ----------------------------------------------------------------------
// 3. 품목 값 정리 (기존 품목 호환)
// ----------------------------------------------------------------------

/**
 * 품목의 기본 편직 kg단가.
 * 신규 필드(knitKgRate) 우선 → 없으면 기존 품목의 5,000YD → 3,000YD 편직료 → 그래도 없으면 기본값.
 */
export const resolveKnitKgRate = (item) => {
  const candidates = [item?.knitKgRate, item?.knittingFee5k, item?.knittingFee3k];
  const found = candidates.find(v => !isBlank(v) && Number.isFinite(Number(v)));
  return found === undefined ? DEFAULT_KNIT_KG_RATE : Math.max(0, Number(found));
};

/** 품목별 구간 단가 [{ fromKg, rate }] 정리 — fromKg 0 이하(작성 중인 칸)는 제외, kg 오름차순 */
export const normalizeKnitRateTiers = (tiers) => (Array.isArray(tiers) ? tiers : [])
  .map(t => ({ fromKg: toNum(t?.fromKg), rate: Math.max(0, toNum(t?.rate)) }))
  .filter(t => t.fromKg > 0)
  .sort((a, b) => a.fromKg - b.fromKg)
  .filter((t, i, arr) => i === 0 || t.fromKg !== arr[i - 1].fromKg);

/**
 * 편직비 (오더 전체) = max(정액, 생지 kg × kg단가)
 *  · 품목별 구간 단가가 있으면 생지 kg가 속한 구간의 단가를 전체 kg에 적용
 *  · 구간이 바뀌며 단가가 내려가도 총액이 줄지 않게 '직전 구간 끝 금액'을 하한으로 둔다 (정액과 같은 원리)
 * @returns {{ total, rate, byKg, fixedFee, floor, mode }} mode: 'fixed'(정액) | 'kg'(kg 계산) | 'floor'(구간 하한)
 */
export const calcKnitFee = (item, greigeKg, fixedFee) => {
  const kg = Math.max(0, toNum(greigeKg));
  const steps = [{ fromKg: 0, rate: resolveKnitKgRate(item) }, ...normalizeKnitRateTiers(item?.knitKgRateTiers)];
  let idx = 0;
  steps.forEach((s, i) => { if (kg >= s.fromKg) idx = i; });
  const rate = steps[idx].rate;
  const byKg = kg * rate;
  let floor = 0;
  for (let i = 0; i < idx; i++) floor = Math.max(floor, steps[i + 1].fromKg * steps[i].rate);
  const fixed = Math.max(0, toNum(fixedFee));
  const total = Math.max(fixed, byKg, floor);
  const mode = (fixed >= byKg && fixed >= floor) ? 'fixed' : (byKg >= floor ? 'kg' : 'floor');
  return { total, rate, byKg, fixedFee: fixed, floor, mode };
};

// 레거시 기본 기타비용(외관검사·이화학·운임) — 이제 설정값으로 계산
const isLegacyDefaultEtc = (e) =>
  LEGACY_ETC_IDS.includes(e?.id) || (e?.vals && LEGACY_ETC_NAMES.includes(String(e?.name || '').trim()));

/**
 * 품목별 추가비용(YD당) 정리 → [{ id, name, perYd }]
 *  · 레거시 기본 3항목(외관검사·이화학·운임)은 제외 (원가 설정에서 공통 계산)
 *  · 레거시 구간별 값(vals.tier1k/3k/5k)만 있는 항목은 3,000YD 값을 YD당 금액으로 사용
 */
export const normalizeExtraCosts = (etcCosts) => (Array.isArray(etcCosts) ? etcCosts : [])
  .filter(e => e && !isLegacyDefaultEtc(e))
  .map((e, i) => ({
    id: String(e.id || `etc_${i}`),
    name: String(e.name || ''),
    perYd: Math.max(0, toNum(isBlank(e.perYd) ? (e.vals?.tier3k ?? e.vals?.tier1k) : e.perYd)),
  }));

/**
 * 원사 배합 → 라인별 kg당 금액(단가 × 혼용률). 내수 = 관세포함, 수출 = 관세제외.
 * 가설계서 전용 priceOverride(직접 입력 단가, 원/kg)가 있으면 내수·수출 동일하게 그 값을 쓴다.
 * 수입사 원사(isImport)는 운반비를 빼고 담는다 — 운반비가 그 원사 kg 구간으로 정해져서 수량별로
 * costAtQty 에서 더함. 그래서 perKgDomestic/perKgExport 에도 수입 원사 운반비는 빠져 있다.
 */
export const buildMaterialLines = (yarns, yarnLibrary, exchangeRate) => {
  const lines = [];
  const missingYarnIds = [];
  let perKgDomestic = 0;
  let perKgExport = 0;
  (Array.isArray(yarns) ? yarns : []).forEach(slot => {
    if (!slot) return;
    const ratio = Number(slot.ratio) / 100;
    if (!(ratio > 0)) return;

    const overrideNum = Number(slot.priceOverride);
    if (!isBlank(slot.priceOverride) && Number.isFinite(overrideNum) && overrideNum > 0) {
      const w = overrideNum * ratio;
      perKgDomestic += w; perKgExport += w;
      lines.push({ name: '단가 직접입력', supplierName: '', wDomestic: w, wExport: w, ratio, isImport: false, importCountry: '' });
      return;
    }
    if (!slot.yarnId) return;

    const realYarnId = String(slot.yarnId).split('::')[0];
    const yarn = (yarnLibrary || []).find(y => String(y.id) === String(realYarnId));
    if (!yarn) { missingYarnIds.push(realYarnId); return; } // 라이브러리에서 사라진 사종 — 경고 배너용
    const sup = yarn.suppliers?.find(s => s.isDefault) || yarn.suppliers?.[0];
    if (!sup) return;
    const isImport = isImportSupplier(sup);
    const priceInKrw = sup.currency === 'USD' ? Number(sup.price || 0) * exchangeRate : Number(sup.price || 0);
    const tariffAmt = priceInKrw * ((Number(sup.tariff) || 0) / 100);
    const freightAmt = isImport ? 0 : (Number(sup.freight) || 0); // 수입사는 kg 구간 운반비 (costAtQty)
    const wDom = (priceInKrw + tariffAmt + freightAmt) * ratio; // 관세는 내수만
    const wExp = (priceInKrw + freightAmt) * ratio;             // 수출은 관세 제외
    perKgDomestic += wDom; perKgExport += wExp;
    lines.push({
      name: yarn.name || '원사', supplierName: String(sup.name || ''), wDomestic: wDom, wExport: wExp,
      ratio, isImport, importCountry: isImport ? String(sup.importCountry || '') : '',
    });
  });
  return { lines, missingYarnIds, perKgDomestic, perKgExport };
};

// ----------------------------------------------------------------------
// 4. 원가 계산
// ----------------------------------------------------------------------

// 수량과 무관한 값(원사 단가·중량·등급·유형 등)을 한 번만 준비
const prepareCost = (fabric, { yarnLibrary = [], exchangeRate = 1450, settings } = {}) => {
  const s = settings || resolveCostSettings(null);
  const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1450;
  const material = buildMaterialLines(fabric?.yarns, yarnLibrary, rate);
  const theoreticalGYd = calculateGYd(toNum(fabric?.gsm), toNum(fabric?.widthFull));
  const effectiveGYd = toNum(fabric?.costGYd) > 0 ? toNum(fabric.costGYd) : theoreticalGYd;
  const processType = findProcessType(s, fabric?.processType);
  const finishing = (Array.isArray(fabric?.finishing) ? fabric.finishing : []).map(f => ({
    name: f?.name || '후가공',
    fee: Math.max(0, toNum(f?.fee)),
    lossPct: clamp(toNum(f?.lossPct), 0, 99),
  }));
  return {
    fabric,
    settings: s,
    rate,
    ...material,
    theoreticalGYd,
    effectiveGYd,
    weightPerYdKg: (effectiveGYd || 0) / 1000,
    grade: findKnitGrade(s, fabric?.knitGrade),
    processType,
    processLossPct: processType.lossPct,
    finishing,
    finishingLossPct: finishing.reduce((sum, f) => sum + f.lossPct, 0),
    dyeingFee: Math.max(0, toNum(fabric?.dyeingFee)),
    knitKgRate: resolveKnitKgRate(fabric),
    extraCosts: normalizeExtraCosts(fabric?.etcCosts),
    riskPct: Math.max(0, toNum(fabric?.riskMarginPct)),
  };
};

const emptyMode = () => ({
  yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, riskAmtYd: 0, finalCostYd: 0,
  priceConverter: 0, priceBrand: 0, pricePerM: 0, pricePerKg: 0,
  lines: { material: [], knit: [], proc: [], etc: [] },
});

const emptyTier = (qty = 0) => ({
  qty,
  kg: { finished: 0, greige: 0, yarn: 0, processLossPct: 0, finishingLossPct: 0, knitLossPct: 0 },
  knit: { total: 0, rate: 0, byKg: 0, fixedFee: 0, floor: 0, mode: 'fixed', gradeId: '', gradeName: '' },
  chem: { colors: 0, feePerColor: 0, total: 0 },
  dye: { colors: 0, perColorKg: 0, minKg: 0, minApplied: false, assumeMcq: false, billedKg: 0, total: 0 },
  freight: { total: 0 },
  visual: { perYd: 0, total: 0 },
  importFreight: { lines: [], total: 0 },
  domestic: emptyMode(),
  export: emptyMode(),
  requiredKg: 0,
});

// 준비된 값(prep)으로 수량 1개의 원가 계산
//  opts.colors: 컬러수 가정 (없으면 이화학 수량 구간), opts.assumeMcq: 컬러마다 MCQ 충족 → 염색 최소 청구 없음
const costAtQty = (p, qtyRaw, opts = {}) => {
  const qty = Math.max(0, toNum(qtyRaw));
  if (qty <= 0) return emptyTier(0);
  const s = p.settings;

  // ── kg 흐름: 가공지 → 생지(가공 LOSS) → 원사(편직 LOSS) ──
  const finishedKg = qty * p.weightPerYdKg;
  const greigeKg = finishedKg * (1 + (p.processLossPct + p.finishingLossPct) / 100);
  const knitLossPct = getKnitLossPct(s, greigeKg);
  const yarnKg = greigeKg * (1 + knitLossPct / 100);

  // ── 오더 총액 항목 ──
  const knit = calcKnitFee(p.fabric, greigeKg, p.grade.fixedFee);
  const colors = resolveOrderColors(s, qty, opts.colors);
  const chemTotal = colors * s.chemTest.feePerColor;
  const freightTotal = getFreightAmount(s, qty);
  const visualTotal = s.visualInspectionPerYd * qty;

  // ── 염색 최소 청구: 컬러마다 따로 염색 → 한 컬러의 가공지 kg가 최소 청구 kg(설정)보다 적으면 최소 kg로 청구 ──
  //   기준 kg는 염가공료와 같은 가공지 kg. 'MCQ 충족' 가정이면 컬러마다 100kg 이상으로 보고 적용하지 않음
  const assumeMcq = opts.assumeMcq === true;
  const dyeColors = Math.max(1, colors);
  const perColorKg = finishedKg / dyeColors;
  const dyeMinKg = s.dyeMinKgPerColor;
  const dyeMinApplied = !assumeMcq && dyeMinKg > 0 && perColorKg < dyeMinKg;
  const dyeBilledKg = dyeMinApplied ? dyeMinKg * dyeColors : finishedKg;
  const dyeTotal = p.dyeingFee * dyeBilledKg;

  // ── 수입 원사 운반비: 원사마다 그 원사 kg(원사 kg × 혼용률)가 속한 수입 국가 구간의 kg당 금액 ──
  //   수량이 바뀌면 kg가 바뀌어 구간도 바뀜 → 원가 표 모든 구간·임의 수량 모두 여기서 자동 반영
  const lineFreight = p.lines.map(m => {
    if (!m.isImport) return null;
    const kg = yarnKg * m.ratio;
    const country = findImportCountry(s, m.importCountry);
    const perKg = getImportFreightPerKg(s, country.id, kg);
    return { name: m.name, supplierName: m.supplierName, countryId: country.id, countryName: country.name, kg, perKg, total: kg * perKg };
  });
  const importFreightLines = lineFreight.filter(Boolean);
  const importFreightTotal = importFreightLines.reduce((sum, f) => sum + f.total, 0);

  // 한 모드(내수/수출)의 YD당 라인 (원화). 중간 반올림 없음.
  const build = (useExport) => {
    const material = p.lines.map((m, i) => ({
      name: m.name,
      amt: ((useExport ? m.wExport : m.wDomestic) * yarnKg + (lineFreight[i]?.total || 0)) / qty,
    }));
    const knitLines = [{ key: 'knit', name: '편직비', amt: knit.total / qty }];
    const proc = [
      { key: 'dye', name: '염가공료', amt: dyeTotal / qty },
      ...p.finishing.map(f => ({ key: 'fin', name: f.name, amt: f.fee * finishedKg / qty })),
    ];
    const etc = [
      { key: 'chem', name: '이화학검사', amt: chemTotal / qty },
      { key: 'freight', name: '운임', amt: freightTotal / qty },
      { key: 'visual', name: '외관검사', amt: visualTotal / qty },
      ...p.extraCosts.map(e => ({ key: 'custom', name: e.name || '추가비용', amt: e.perYd })),
    ];
    const sum = (arr) => arr.reduce((acc, l) => acc + l.amt, 0);
    const matSub = sum(material);
    const knitSub = sum(knitLines);
    const procSub = sum(proc);
    const etcSub = sum(etc);
    return { material, knit: knitLines, proc, etc, matSub, knitSub, procSub, etcSub, total: matSub + knitSub + procSub + etcSub };
  };

  const ydPerM = 1 / 0.9144;
  const perKgFactor = p.weightPerYdKg > 0 ? 1 / p.weightPerYdKg : 0; // /yd가 × (yd/kg) = /kg가
  const riskFactor = 1 + p.riskPct / 100;

  // [표시 일관성] 순원가도 영업 기준원가와 같은 단위(100원/센트)로 반올림하고 위험마진 = 둘의 차이로 역산
  const dom = build(false);
  const domTotal = smartRound(dom.total, 'KRW');
  const domFinal = smartRound(dom.total * riskFactor, 'KRW'); // 영업 기준원가

  const exp = build(true);
  const toUsd = (v) => v / p.rate;
  const expUSDraw = toUsd(exp.total);
  const expTotal = smartRound(expUSDraw, 'USD');
  const expFinal = smartRound(expUSDraw * riskFactor, 'USD');
  const usdLines = (lines) => lines.map(l => ({ ...l, amt: toUsd(l.amt) }));

  return {
    qty,
    kg: { finished: finishedKg, greige: greigeKg, yarn: yarnKg, processLossPct: p.processLossPct, finishingLossPct: p.finishingLossPct, knitLossPct },
    knit: { ...knit, gradeId: p.grade.id, gradeName: p.grade.name },
    chem: { colors, feePerColor: s.chemTest.feePerColor, total: chemTotal },
    // 염색 청구 내역 (오더 총액, 원화) — 염가공비 줄의 설명·마우스오버용
    dye: { colors: dyeColors, perColorKg, minKg: dyeMinKg, minApplied: dyeMinApplied, assumeMcq, billedKg: dyeBilledKg, total: dyeTotal },
    freight: { total: freightTotal },
    visual: { perYd: s.visualInspectionPerYd, total: visualTotal },
    // 수입 원사 운반비 (원화, 오더 총액) — 재료비에 이미 포함. 화면 표시용 내역
    importFreight: { lines: importFreightLines, total: importFreightTotal },
    domestic: {
      yarnCostYd: dom.matSub, knitCostYd: dom.knitSub, dyeCostYd: dom.procSub, extraFeeYd: dom.etcSub,
      totalCostYd: domTotal, riskAmtYd: domFinal - domTotal, finalCostYd: domFinal,
      // 판매가가 아니라 '영업 기준원가'(판매마진은 견적에서 적용). 견적/리스트 호환 위해 필드명 유지.
      priceConverter: domFinal, priceBrand: domFinal,
      pricePerM: smartRound(domFinal * ydPerM, 'KRW'), pricePerKg: smartRound(domFinal * perKgFactor, 'KRW'),
      lines: { material: dom.material, knit: dom.knit, proc: dom.proc, etc: dom.etc },
    },
    export: {
      yarnCostYd: toUsd(exp.matSub), knitCostYd: toUsd(exp.knitSub), dyeCostYd: toUsd(exp.procSub), extraFeeYd: toUsd(exp.etcSub),
      totalCostYd: expTotal, riskAmtYd: Number((expFinal - expTotal).toFixed(2)), finalCostYd: expFinal,
      priceConverter: expFinal, priceBrand: expFinal,
      pricePerM: Number((expFinal * ydPerM).toFixed(2)), pricePerKg: Number((expFinal * perKgFactor).toFixed(2)),
      lines: { material: usdLines(exp.material), knit: usdLines(exp.knit), proc: usdLines(exp.proc), etc: usdLines(exp.etc) },
    },
    requiredKg: Math.round(yarnKg), // 원사 투입 kg (LOSS 포함)
  };
};

/**
 * 임의 수량(YD) 1개의 원가.
 * @param {Object} fabric 원단(또는 설계서 costInput + yarns)
 * @param {number} qty    오더 수량 (YD)
 * @param {Object} ctx    { yarnLibrary, exchangeRate, settings(resolveCostSettings 결과) }
 * @param {Object} opts   { colors: 컬러수 가정(없으면 이화학 수량 구간), assumeMcq: 컬러마다 MCQ 충족 → 염색 최소 청구 없음 }
 */
export const computeCostAtQty = (fabric, qty, ctx = {}, opts = {}) => {
  if (!fabric) return emptyTier(0);
  return costAtQty(prepareCost(fabric, ctx), qty, opts);
};

/**
 * 원가 표용 구간(COST_DISPLAY_TIERS — 300·500·800·1,000·3,000·5,000YD) 계산.
 * 반환 모양은 기존 calculateCost와 같음 (tier1k/tier3k/tier5k 의 domestic/export — 견적·원단 목록이 읽음)
 * + 소량 구간 tier300/tier500/tier800 + 새 정보(kg 흐름·편직비 방식·이화학 컬러수·염색 청구 등).
 */
export const calculateCostTiers = (fabric, ctx = {}) => {
  if (!fabric || !fabric.yarns) {
    const empty = { avgYarnCostDomestic: 0, avgYarnCostExport: 0, effectiveGYd: 0, theoreticalGYd: 0, ydPerKg: 0, missingYarnIds: [], processLossPct: 0, finishingLossPct: 0, knitKgRate: 0, hasImportFreight: false };
    COST_DISPLAY_TIERS.forEach(t => { empty[t.key] = emptyTier(t.qty); });
    return empty;
  }
  const p = prepareCost(fabric, ctx);
  const out = {
    // 원사 단가(혼용 가중) — 수입 원사 운반비(수량별 kg 구간)는 빠진 값
    avgYarnCostDomestic: Math.round(p.perKgDomestic), avgYarnCostExport: Math.round(p.perKgExport),
    effectiveGYd: p.effectiveGYd, theoreticalGYd: p.theoreticalGYd,
    ydPerKg: p.weightPerYdKg > 0 ? 1 / p.weightPerYdKg : 0,
    missingYarnIds: p.missingYarnIds,
    knitGrade: p.grade, processType: p.processType,
    processLossPct: p.processLossPct, finishingLossPct: p.finishingLossPct,
    knitKgRate: p.knitKgRate,
    hasImportFreight: p.lines.some(m => m.isImport),
  };
  COST_DISPLAY_TIERS.forEach(t => { out[t.key] = costAtQty(p, t.qty, { colors: t.colors, assumeMcq: t.assumeMcq }); });
  return out;
};
