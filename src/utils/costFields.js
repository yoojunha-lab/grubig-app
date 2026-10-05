import { DEFAULT_KNIT_GRADE_ID, DEFAULT_KNIT_KG_RATE, DEFAULT_PROCESS_TYPE_ID } from '../constants/costing';

// ============================================================
// 원가 칸 초기값 — 원단(fabricInput) · 설계서 costInput · 가설계서 costInput 공통 (새로 작성할 때)
//  (2026-10-06 세 훅에 똑같이 적혀 있던 값을 한 곳으로 — 값은 그대로)
//  [원가 개편 2026-10] 편직비 = max(난이도 정액, 생지kg × kg단가), 가공 LOSS = 가공 유형별 (정액·LOSS 값은 원가 설정)
//  외관검사·이화학·운임은 원가 설정에서 공통 계산
// ============================================================
export const makeInitialCostFields = () => ({
  knitGrade: DEFAULT_KNIT_GRADE_ID,     // 편직 난이도 (A/B…) → 정액
  knitKgRate: DEFAULT_KNIT_KG_RATE,     // 편직 kg단가 (원/kg)
  knitKgRateTiers: [],                  // 구간 단가 [{ fromKg, rate }] — 예: 1,000kg 이상 1,800원
  processType: DEFAULT_PROCESS_TYPE_ID, // 가공 유형 (일반/스판물/기모물…) → 가공 LOSS
  dyeingFee: 8800,
  // (레거시 — 계산에 안 씀) 구간별 편직료·LOSS·extraFee·brandExtra. 기존 문서·동기화 호환용으로만 유지
  knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
  losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
  marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
  finishing: [],      // 후가공 [{ name, fee(원/kg), lossPct }]
  etcCosts: [],       // 품목별 추가비용 [{ id, name, perYd }]
  riskMarginPct: 0,   // 위험 마진(%) — 메인 전·위험 원단 추가 마진 (영업 기준원가에 가산)
  offerPrice: '',
});
