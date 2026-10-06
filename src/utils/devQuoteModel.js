// GRUBIG ERP - 개발 의뢰 '원가 견적' (순수 함수 — React/Firestore 의존 없음)
//
// ■ 바이어가 개발 전에 가격부터 보는 경우 (비싸면 Drop) — 대표님 요청 2026-10-06
//   · 개발 의뢰(devRequests/{id}.costQuote)에 '예상 스펙'을 저장하고, 원단과 같은 원가 엔진(calculateCostTiers)으로 계산
//   · 원사 칸: 라이브러리 원사(yarnId) 또는 직접 입력(원사명 + 단가 원/kg)
//     직접 입력 단가는 관세·운반비까지 넣은 최종 원/kg — 가설계서 단가 직접 입력(priceOverride)과 같은 규칙 (내수·수출 같은 단가)
//   · 판매가 미리보기: 견적서와 같은 6구간·같은 계산 (useQuotation.createQuoteItem → quoteModel.calcQuotePrice)
// ■ 견적서에는 의뢰를 '원단 모양'으로 바꿔서 넣음 (fabricId = 의뢰 id, Article = 개발번호, Spec = 견적서 품목명)
//   → 견적서의 [현재 원가로 다시 계산]·복제·별도 견적 복사가 원단과 똑같이 동작 (useQuotation.findFabric)
// ■ 설계 시작 때 이어받기: devQuoteToSheetFields — 직접 입력 원사는 설계서에서 라이브러리 원사를 골라야 함
// ■ 설명 문서: docs/costing-model.md §5-C

import { QUOTE_TIERS, QUOTE_TIER_KEYS } from '../constants/quote';
import { makeInitialCostFields } from './costFields';
import { sumYarnRatio, isYarnRatioComplete, buildMaterialLines } from './costModel';
import {
  makeDefaultTierRates, makeDefaultTierAdds, toQuoteTierRate, toQuoteTierAdd, defaultTierAdd,
  calcQuotePrice, calcCustomQuotePrice, getBasePrice, getShownTiers, formatQuotePrice,
} from './quoteModel';
import { num } from './helpers';

export const DEV_QUOTE_SOURCE = 'devRequest';  // 견적 품목 sourceType — 개발 의뢰 원가 견적에서 온 품목
export const DEV_QUOTE_YARN_SLOTS = 4;         // 원사 칸 수 (설계서와 같게 — 설계 시작 때 그대로 이어받기)
// 의뢰 목록 배지에 보여줄 구간 (견적서 기준 구간 — 3,000YD)
export const DEV_QUOTE_MAIN_TIER = QUOTE_TIERS.find(t => t.main) || QUOTE_TIERS[0];

const isBlank = (v) => v === undefined || v === null || v === '';
// 원가 엔진이 읽는 원가 칸 (예전 원가 칸 — 1K/3K/5K 편직료·LOSS 등은 원가 견적에 넣지 않음)
const COST_FIELD_KEYS = ['knitGrade', 'knitKgRate', 'knitKgRateTiers', 'processType', 'dyeingFee', 'finishing', 'etcCosts', 'riskMarginPct'];
const SPEC_FIELD_KEYS = ['widthFull', 'widthCut', 'gsm', 'costGYd'];

// 'YYYY-MM-DD' → 'MM/DD'
const ymdToMmdd = (s) => {
  const m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${m[1]}/${m[2]}` : '';
};
// ISO 시각 → 이 PC 날짜 'MM/DD'
const isoToMmdd = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// ----------------------------------------------------------------------
// 1. 양식
// ----------------------------------------------------------------------

/** 원사 칸 하나 — mode: 'library'(라이브러리 원사) | 'manual'(직접 입력: 원사명 + 단가 원/kg) */
export const makeDevQuoteYarnSlot = (ratio = 0) => ({ mode: 'library', yarnId: '', manualName: '', priceOverride: '', ratio });

/** 새 원가 견적 양식 — 개발 아이템을 견적서 품목명으로, 마진은 견적서 기본값 (구간별 이익율 · YD당 정액 원화) */
export const makeBlankDevCostQuote = (devReq) => {
  const base = makeInitialCostFields();
  return {
    itemName: String(devReq?.devItem || devReq?.targetSpec?.composition || '').trim(),
    marketType: 'domestic',
    yarns: Array.from({ length: DEV_QUOTE_YARN_SLOTS }, (_, i) => makeDevQuoteYarnSlot(i === 0 ? 100 : 0)),
    costInput: {
      widthFull: 58, widthCut: 56, gsm: 300, costGYd: '',
      ...Object.fromEntries(COST_FIELD_KEYS.map(k => [k, base[k]])),
    },
    marginRate: makeDefaultTierRates(),
    marginAdd: makeDefaultTierAdds('KRW'),
  };
};

/** 저장된 원가 견적 → 창에서 고칠 양식 (빠진 칸은 기본값, 원사는 4칸) */
export const toDevCostQuoteForm = (devReq) => {
  const blank = makeBlankDevCostQuote(devReq);
  const saved = devReq?.costQuote;
  if (!saved || typeof saved !== 'object') return blank;
  const savedYarns = Array.isArray(saved.yarns) ? saved.yarns : [];
  return {
    itemName: isBlank(saved.itemName) ? blank.itemName : String(saved.itemName),
    marketType: saved.marketType === 'export' ? 'export' : 'domestic',
    yarns: Array.from({ length: Math.max(DEV_QUOTE_YARN_SLOTS, savedYarns.length) }, (_, i) => ({
      ...makeDevQuoteYarnSlot(0),
      ...(savedYarns[i] && typeof savedYarns[i] === 'object' ? savedYarns[i] : {}),
    })),
    costInput: { ...blank.costInput, ...(saved.costInput || {}) },
    marginRate: toQuoteTierRate(saved.marginRate),
    marginAdd: toQuoteTierAdd(saved.marginAdd, (k) => defaultTierAdd(k, 'KRW')),
  };
};

/**
 * 저장할 원사 칸 정리 — 창에서는 [라이브러리]↔[직접 입력]을 오가도 입력값을 남겨 두지만(다시 돌아오면 그대로),
 * 저장할 때는 고른 방식의 값만 남김 (계산·설계서 이어받기는 mode 기준이라 결과는 같음)
 */
export const cleanDevQuoteYarns = (yarns) => (Array.isArray(yarns) ? yarns : []).map(s => {
  const ratio = Number(s?.ratio) || 0;
  if (s?.mode === 'manual') {
    const price = Number(s.priceOverride);
    return { mode: 'manual', yarnId: '', manualName: String(s.manualName || '').trim(), priceOverride: Number.isFinite(price) && price > 0 ? price : '', ratio };
  }
  return { mode: 'library', yarnId: String(s?.yarnId || ''), manualName: '', priceOverride: '', ratio };
});

// ----------------------------------------------------------------------
// 2. 원가 엔진·견적서용 변환
// ----------------------------------------------------------------------

/** 원가 엔진에 넣을 원사 칸 — 직접 입력이면 원사 id를 비우고 단가(priceOverride), 라이브러리면 단가를 비움 */
export const toEngineYarns = (yarns) => (Array.isArray(yarns) ? yarns : []).map(s => {
  if (!s || typeof s !== 'object') return { yarnId: '', ratio: 0, priceOverride: '' };
  const ratio = Number(s.ratio) || 0;
  if (s.mode === 'manual') {
    const price = Number(s.priceOverride);
    return { yarnId: '', ratio, priceOverride: Number.isFinite(price) && price > 0 ? price : '', manualName: String(s.manualName || '') };
  }
  return { yarnId: String(s.yarnId || ''), ratio, priceOverride: '' };
});

/**
 * 개발 의뢰 → 원가 엔진·견적서가 읽는 '원단 모양' 데이터 (원가 견적이 없으면 null)
 *  fabricId = 의뢰 id, Article = 개발번호, Spec = 견적서 품목명. MCQ는 원단처럼 자동 (G/YD·가공 LOSS)
 * @param {Object} devReq 개발 의뢰
 * @param {Object} form   원가 견적 (기본: 저장된 devReq.costQuote — 창에서는 고치는 중인 양식)
 */
export const devQuoteToFabric = (devReq, form = devReq?.costQuote) => {
  if (!devReq || !form || typeof form !== 'object') return null;
  const ci = form.costInput || {};
  return {
    ...ci,
    id: devReq.id,
    sourceType: DEV_QUOTE_SOURCE,
    article: String(devReq.devOrderNo || '').trim() || 'DEV',
    itemName: String(form.itemName || '').trim() || String(devReq.devItem || '').trim(),
    yarns: toEngineYarns(form.yarns),
  };
};

/**
 * 원사 칸 단가 (원/kg, 그 원사 100% 기준 — 화면 표시용)
 *  라이브러리 원사 = 대표 공급처 단가 + 관세(내수만) + 국내 운반비. 수입 원사 운반비는 수량별 kg 구간이라 원가 표에서 더함
 * @returns {null | { domestic, export, isImport, importCountry, missing, zero }}
 */
export const yarnSlotUnitPrice = (slot, yarnLibrary, exchangeRate) => {
  if (!slot) return null;
  if (slot.mode === 'manual') {
    const p = Number(slot.priceOverride);
    return p > 0 ? { domestic: p, export: p, isImport: false, importCountry: '', missing: false, zero: false } : null;
  }
  if (!slot.yarnId) return null;
  const m = buildMaterialLines([{ yarnId: slot.yarnId, ratio: 100 }], yarnLibrary, exchangeRate);
  if (m.missingYarnNames.length > 0) return { domestic: 0, export: 0, isImport: false, importCountry: '', missing: true, zero: false };
  const line = m.lines[0];
  if (!line) return { domestic: 0, export: 0, isImport: false, importCountry: '', missing: false, zero: true };
  return {
    domestic: line.wDomestic, export: line.wExport, isImport: line.isImport, importCountry: line.importCountry,
    missing: false, zero: !(line.wDomestic > 0),
  };
};

// ----------------------------------------------------------------------
// 3. 저장 전 확인 · 판매가 미리보기 · 저장값
// ----------------------------------------------------------------------

/** 저장 전 확인 — 저장을 막는 사유 목록 (없으면 []) */
export const validateDevCostQuote = (form) => {
  const errors = [];
  const yarns = Array.isArray(form?.yarns) ? form.yarns : [];
  if (!isYarnRatioComplete(yarns)) errors.push(`원사 혼용률 합계가 100%가 아니에요 (지금 ${sumYarnRatio(yarns)}%).`);
  yarns.forEach((s, i) => {
    if (!s || !(Number(s.ratio) > 0)) return;
    if (s.mode === 'manual') {
      if (!(Number(s.priceOverride) > 0)) errors.push(`원사 ${i + 1}번 칸: 직접 입력한 원사의 단가(원/kg)를 넣어 주세요.`);
    } else if (!s.yarnId) {
      errors.push(`원사 ${i + 1}번 칸: 라이브러리에서 원사를 고르거나 [직접 입력]으로 바꿔 주세요.`);
    }
  });
  const ci = form?.costInput || {};
  const hasWeight = Number(ci.costGYd) > 0 || (Number(ci.gsm) > 0 && Number(ci.widthFull) > 0);
  if (!hasWeight) errors.push('GSM과 외폭(또는 생산 G/YD)을 넣어 주세요.');
  return errors;
};

/** 판매가 미리보기용 견적 — 견적서와 같은 함수(calcQuotePrice)로 판매가를 내려고 견적 모양으로 만듦 */
export const makeDevPreviewQuote = (form, exchangeRate) => {
  const isExport = form?.marketType === 'export';
  return {
    marketType: isExport ? 'export' : 'domestic',
    currency: isExport ? 'USD' : 'KRW',
    exchangeRate: Number(exchangeRate) > 0 ? Number(exchangeRate) : 1450,
    bulkMarginRate: toQuoteTierRate(form?.marginRate),
    marginAdd: toQuoteTierAdd(form?.marginAdd, (k) => defaultTierAdd(k, 'KRW')),
    marginAddCurrency: 'KRW',
  };
};

/**
 * 저장할 때의 값 — 의뢰 목록 '예상가' 배지 (원가·환율이 바뀌어도 저장값 그대로)
 * @param {Object} item         createQuoteItem 결과 (견적서 품목과 같은 모양)
 * @param {Object} previewQuote makeDevPreviewQuote 결과
 */
export const buildDevQuoteSnapshot = (item, previewQuote) => {
  const currency = previewQuote.currency;
  return {
    at: new Date().toISOString(),
    marketType: previewQuote.marketType,
    currency,
    exchangeRate: previewQuote.exchangeRate,
    mcqYd: Number(item?.mcqYd) || 0,
    basePrice: Object.fromEntries(QUOTE_TIER_KEYS.map(k => [k, getBasePrice(item, k)])),
    sellPrice: Object.fromEntries(QUOTE_TIER_KEYS.map(k => [k, calcQuotePrice(item, k, previewQuote, currency)])),
    costWarnings: Array.isArray(item?.costWarnings) ? item.costWarnings : [],
  };
};

// ----------------------------------------------------------------------
// 4. 견적서 연결 · 목록 배지
// ----------------------------------------------------------------------

/** 이 의뢰로 만든 견적서 (최근 순) — 기준·별도 견적 품목의 fabricId가 의뢰 id */
export const findDevQuotes = (quotes, devReqId) => {
  const id = String(devReqId);
  return (Array.isArray(quotes) ? quotes : [])
    .filter(q => [...(q?.items || []), ...(q?.customItems || [])].some(it => String(it?.fabricId) === id))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.id) || 0) - (Number(a.id) || 0));
};

/**
 * 의뢰 목록 배지 — 견적서를 만들었으면 최근 견적서의 3,000YD 판매가, 아니면 원가 견적 저장값(예상가)
 * @returns {null | { kind: 'quote'|'estimate', price, qtyLabel, date, count, detail }}
 *   price: 표시 문자열(￦9,800 / $6.75), detail: 마우스를 올리면 보이는 구간별 판매가
 */
export const getDevQuoteBadge = (devReq, quotes) => {
  if (!devReq) return null;
  const linked = findDevQuotes(quotes, devReq.id);
  const latest = linked[0];
  if (latest) {
    const cur = latest.currency === 'USD' ? 'USD' : 'KRW';
    const head = `최근 견적서 ${latest.date || ''}${linked.length > 1 ? ` (이 의뢰로 만든 견적서 ${linked.length}건)` : ''}`;
    const item = (latest.items || []).find(it => String(it?.fabricId) === String(devReq.id));
    if (item) {
      const shown = getShownTiers(latest).map(t => t.key);
      const lines = QUOTE_TIERS
        .filter(t => getBasePrice(item, t.key) !== null)
        .map(t => `${t.label} ${formatQuotePrice(calcQuotePrice(item, t.key, latest, cur), cur)}${shown.includes(t.key) ? '' : ' (견적서에 안 나감)'}`);
      const main = getBasePrice(item, DEV_QUOTE_MAIN_TIER.key) !== null
        ? DEV_QUOTE_MAIN_TIER
        : (getShownTiers(latest)[0] || DEV_QUOTE_MAIN_TIER);
      return {
        kind: 'quote', count: linked.length, date: ymdToMmdd(latest.date),
        price: formatQuotePrice(calcQuotePrice(item, main.key, latest, cur), cur),
        qtyLabel: main.label,
        detail: [head, ...lines].join('\n'),
      };
    }
    const row = (latest.customItems || []).find(r => String(r?.fabricId) === String(devReq.id));
    if (row) {
      const qtyLabel = `${num(row.qty)} YD · ${num(row.colors)}컬러`;
      const price = formatQuotePrice(calcCustomQuotePrice(row, latest, cur), cur);
      return {
        kind: 'quote', count: linked.length, date: ymdToMmdd(latest.date), price, qtyLabel,
        detail: [head, `별도 견적 ${qtyLabel} ${price}`].join('\n'),
      };
    }
  }
  const snap = devReq.costQuote?.snapshot;
  if (snap && snap.sellPrice && typeof snap.sellPrice === 'object') {
    const cur = snap.currency === 'USD' ? 'USD' : 'KRW';
    const lines = QUOTE_TIERS.map(t => `${t.label} ${formatQuotePrice(snap.sellPrice[t.key] ?? null, cur)}`);
    return {
      kind: 'estimate', count: 0, date: isoToMmdd(snap.at),
      price: formatQuotePrice(snap.sellPrice[DEV_QUOTE_MAIN_TIER.key] ?? null, cur),
      qtyLabel: DEV_QUOTE_MAIN_TIER.label,
      detail: [`원가 견적 예상 판매가 (${isoToMmdd(snap.at)} 저장 · 견적서는 아직 없음)`, ...lines].join('\n'),
    };
  }
  return null;
};

// ----------------------------------------------------------------------
// 5. 설계 시작 때 이어받기
// ----------------------------------------------------------------------

/**
 * 설계서에 채울 칸 — 원가 견적의 원사·폭·GSM·편직/염가공 조건·위험마진 (견적서 품목명 → 원단명)
 *  직접 입력 원사는 설계서에 단가 칸이 없어 원사 칸을 비우고 비율만 둠 → 설계서에서 라이브러리 원사를 골라야 원가가 계산됨
 * @param {Object} costQuote    저장된 원가 견적 (없으면 null 반환)
 * @param {Object} initialSheet 설계서 빈 양식 (useDesignSheet의 getInitialSheetInput)
 * @returns {null | { fields: Object, manualNames: string[] }}
 */
export const devQuoteToSheetFields = (costQuote, initialSheet) => {
  if (!costQuote || typeof costQuote !== 'object') return null;
  const slots = Array.isArray(costQuote.yarns) ? costQuote.yarns : [];
  const yarns = Array.from({ length: Math.max(DEV_QUOTE_YARN_SLOTS, slots.length) }, (_, i) => {
    const s = slots[i];
    const ratio = Number(s?.ratio) || 0;
    if (!s || s.mode === 'manual') return { yarnId: '', ratio };
    return { yarnId: String(s.yarnId || ''), ratio };
  });
  const manualNames = slots
    .filter(s => s && s.mode === 'manual' && Number(s.ratio) > 0)
    .map(s => String(s.manualName || '').trim() || '이름 없는 원사');
  const ci = costQuote.costInput || {};
  const picked = Object.fromEntries(
    [...SPEC_FIELD_KEYS, ...COST_FIELD_KEYS].filter(k => ci[k] !== undefined).map(k => [k, ci[k]])
  );
  return {
    fields: {
      fabricName: String(costQuote.itemName || '').trim() || initialSheet.fabricName,
      yarns,
      costInput: { ...initialSheet.costInput, ...picked },
    },
    manualNames,
  };
};
