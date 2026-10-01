// GRUBIG ERP - 원단 원가(Costing) 설정 기본값
//  · 저장 위치: Firestore settings/general.costSettings (App.jsx의 saveCostSettings)
//  · 저장값이 없거나 일부 항목이 빠져 있으면 아래 기본값으로 채움 (utils/costModel.js의 resolveCostSettings)
//  · 구간(bracket) 공통 규칙: max = 'N 이하' 경계값, 마지막 구간은 max = null → '직전 경계 초과'
//  · 계산 방식 전체 설명은 docs/costing-model.md

// 품목.knitGrade 가 없을 때(기존 품목) 쓰는 편직 난이도
export const DEFAULT_KNIT_GRADE_ID = 'A';
// 품목.processType 이 없을 때(기존 품목) 쓰는 가공 유형
export const DEFAULT_PROCESS_TYPE_ID = 'normal';
// 편직 kg단가 기본값 (신규 품목, 또는 기존 품목에 레거시 편직료도 없을 때)
export const DEFAULT_KNIT_KG_RATE = 2000;

export const DEFAULT_COST_SETTINGS = {
  // 편직 난이도별 정액 — 편직비 = max(정액, 생지kg × kg단가)
  knitGrades: [
    { id: 'A', name: 'A', fixedFee: 600000, desc: '싱글 등 쉬운 아이템' },
    { id: 'B', name: 'B', fixedFee: 1000000, desc: '기계 손이 많이 가는 아이템' },
  ],
  // 편직 LOSS — 오더 전체 생지 kg(가공 LOSS 포함) 구간별
  knitLossBrackets: [
    { max: 100, pct: 10 },
    { max: 300, pct: 8 },
    { max: 1000, pct: 5 },
    { max: null, pct: 3 },
  ],
  // 가공 유형별 가공 LOSS — 생지 kg = 가공지 kg × (1 + LOSS%)
  processTypes: [
    { id: 'normal', name: '일반', lossPct: 10 },
    { id: 'span', name: '스판물', lossPct: 13 },
    { id: 'brushed', name: '기모물', lossPct: 12 },
  ],
  // 이화학 검사 — 오더 총액 = 컬러수(수량 구간) × 1컬러당 검사비
  chemTest: {
    feePerColor: 200000,
    colorBrackets: [
      { max: 1000, colors: 2 },
      { max: 3000, colors: 4 },
      { max: 5000, colors: 6 },
      { max: null, colors: 6 },
    ],
  },
  // 운임 — 오더당 총액(원), 수량(YD) 구간별
  freightBrackets: [
    { max: 500, amount: 300000 },
    { max: 1000, amount: 500000 },
    { max: 3000, amount: 900000 },
    { max: 5000, amount: 1000000 },
    { max: null, amount: 1000000 },
  ],
  // 외관검사 — YD당 단가 (전 품목 공통)
  visualInspectionPerYd: 190,
};

// 원가 표에 보여주는 기준 수량 3구간. 계산 자체는 임의 수량 함수(computeCostAtQty)라 수량만 바꾸면 됨.
//  key(tier1k/3k/5k)는 견적(basePrice1k/3k/5k)·설계서 화면이 읽는 기존 키 그대로 유지
export const COST_DISPLAY_TIERS = [
  { key: 'tier1k', label: '1,000 YD', qty: 1000 },
  { key: 'tier3k', label: '3,000 YD', qty: 3000, main: true },
  { key: 'tier5k', label: '5,000 YD', qty: 5000 },
];

// 편직비가 어떤 기준으로 정해졌는지 (computeCostAtQty 결과 knit.mode) — 화면 표시용
export const KNIT_FEE_MODE_LABEL = { fixed: '정액', kg: 'kg계산', floor: '구간하한' };

// 레거시 기타비용 기본 3항목 — 이제 원가 설정값으로 계산하므로 품목에 남아 있는 값은 무시
export const LEGACY_ETC_IDS = ['etc_visual', 'etc_chem', 'etc_freight'];
export const LEGACY_ETC_NAMES = ['외관검사', '이화학검사', '운임'];
