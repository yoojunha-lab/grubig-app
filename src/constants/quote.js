// GRUBIG ERP - 견적서 상수 (기준 견적 구간 · 기본 마진)
//
// ■ 기준 견적 구간 = 원가 표 6구간과 같은 수량·가정 (constants/costing.js COST_DISPLAY_TIERS)
//   · group 'small' (300·500·800YD): 2컬러까지 → 컬러당 염색 최소 청구 포함
//   · group 'mcq'  (1,000·3,000·5,000YD): 컬러마다 MCQ 이상
//   · key 는 견적 품목 필드 이름(basePrice{key}, marginRate[key], marginAdd[key])이라 바꾸지 말 것
//     (1k/3k/5k 는 예전 견적과 같은 키 — 예전 견적도 그대로 읽힘)
//   · costKey: 원가 엔진(calculateCostTiers) 결과의 구간 키
//
// ■ 기본 마진 (대표님 지정, 2026-10-05)
//   · 매출이익율: 300·500·800YD 25% / 1,000YD 이상 20%
//   · YD당 정액(원): 300·500·800YD 2,000 / 1,000YD 1,000 / 3,000YD 800 / 5,000YD 500
//     (수출 견적은 견적 환율로 환산해서 $로 넣음)

export const QUOTE_TIERS = [
  { key: '300', costKey: 'tier300', label: '300 YD', qty: 300, group: 'small', colors: 2, defaultRate: 25, defaultAddKrw: 2000 },
  { key: '500', costKey: 'tier500', label: '500 YD', qty: 500, group: 'small', colors: 2, defaultRate: 25, defaultAddKrw: 2000 },
  { key: '800', costKey: 'tier800', label: '800 YD', qty: 800, group: 'small', colors: 2, defaultRate: 25, defaultAddKrw: 2000 },
  { key: '1k', costKey: 'tier1k', label: '1,000 YD', qty: 1000, group: 'mcq', assumeMcq: true, defaultRate: 20, defaultAddKrw: 1000 },
  { key: '3k', costKey: 'tier3k', label: '3,000 YD', qty: 3000, group: 'mcq', assumeMcq: true, main: true, defaultRate: 20, defaultAddKrw: 800 },
  { key: '5k', costKey: 'tier5k', label: '5,000 YD', qty: 5000, group: 'mcq', assumeMcq: true, defaultRate: 20, defaultAddKrw: 500 },
];

export const QUOTE_TIER_KEYS = QUOTE_TIERS.map(t => t.key);

// 구간 묶음 머리 (QUOTE_TIERS의 group 순서대로)
export const QUOTE_TIER_GROUPS = [
  { key: 'small', label: '2컬러 기준', hint: '2컬러까지 · 컬러당 염색 최소 청구 포함' },
  { key: 'mcq', label: 'MCQ 충족 기준', hint: '컬러마다 MCQ 이상' },
];

// 새 견적서에서 바이어 견적서에 기본으로 보여줄 구간 (대표님 지정, 2026-10-05)
export const DEFAULT_SHOWN_TIERS = ['500', '800', '1k', '3k'];

// 예전 견적(구간 선택 기능 전)의 구간 — 표시 구간 저장값이 없으면 이 3구간
export const LEGACY_TIER_KEYS = ['1k', '3k', '5k'];

// 별도 견적 줄을 새로 만들 때 기본 수량·컬러
export const DEFAULT_CUSTOM_QTY = 300;
export const DEFAULT_CUSTOM_COLORS = 2;
