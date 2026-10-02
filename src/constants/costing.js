// GRUBIG ERP - 원단 원가(Costing) 설정 기본값
//  · 저장 위치: Firestore settings/general.costSettings (App.jsx의 saveCostSettings)
//  · 저장값이 없거나 일부 항목이 빠져 있으면 아래 기본값으로 채움 (utils/costModel.js의 resolveCostSettings)
//  · 구간(bracket) 공통 규칙: max = 'N 이하' 경계값, 마지막 구간은 max = null → '직전 경계 초과'
//    (예외: 수입 원사 운반비만 'N 미만' / 마지막 '직전 경계 이상' — 대표님 기준표 그대로)
//  · 계산 방식 전체 설명은 docs/costing-model.md

// 품목.knitGrade 가 없을 때(기존 품목) 쓰는 편직 난이도
export const DEFAULT_KNIT_GRADE_ID = 'A';
// 품목.processType 이 없을 때(기존 품목) 쓰는 가공 유형
export const DEFAULT_PROCESS_TYPE_ID = 'normal';
// 편직 kg단가 기본값 (신규 품목, 또는 기존 품목에 레거시 편직료도 없을 때)
export const DEFAULT_KNIT_KG_RATE = 2000;
// 수입 원사의 수입 국가가 비어 있거나 삭제된 국가일 때 쓰는 국가 (기존 수입사는 모두 중국 — 대표님 지정)
export const DEFAULT_IMPORT_COUNTRY_ID = 'CN';

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
  // 염색 최소 청구 kg (컬러당) — 한 컬러를 이 kg보다 적게 염색해도 이 kg로 청구 (대표님 지정, 2026-10-02)
  //  · 기준 kg는 염가공료와 같은 생지 kg (MCQ와 같은 기준). 'MCQ 충족' 구간(1,000YD 이상)은 적용하지 않음
  dyeMinKgPerColor: 100,
  // 수입 원사 운반비 (원/kg) — 원사 라이브러리에서 공급처를 [수입]으로 체크한 원사만, 수입 국가별 구간
  //  · kg = 그 원사의 오더 투입 kg (원사 투입 kg × 혼용률) → 속한 구간의 kg당 금액을 원사 단가에 더함
  //  · 'N kg 미만' 규칙, 마지막 max = null → '직전 경계 이상'. 기본값은 중국 기준 (대표님 지정, 2026-10-02)
  importCountries: [
    {
      id: 'CN',
      name: '중국',
      brackets: [
        { max: 300, perKg: 2500 },
        { max: 1000, perKg: 2000 },
        { max: 2000, perKg: 1500 },
        { max: null, perKg: 1500 },
      ],
    },
  ],
};

// 원가 표에 보여주는 기준 수량 6구간 (대표님 지정, 2026-10-02). 계산 자체는 임의 수량 함수
// (computeCostAtQty)라 수량·컬러 가정만 바꾸면 됨.
//  · group 'small' (300·500·800YD): 2컬러로 나눠 염색한다고 봄 → 컬러당 염색 최소 청구 적용, 이화학도 2컬러
//  · group 'mcq'  (1,000·3,000·5,000YD): 컬러마다 MCQ를 맞췄다고 봄(assumeMcq) → 염색 최소 청구 없음,
//    이화학은 원가 설정의 수량 구간 컬러수
//  · key tier1k/3k/5k는 견적(basePrice1k/3k/5k)·원단 목록·설계서 화면이 읽는 기존 키 그대로 유지
export const COST_DISPLAY_TIERS = [
  { key: 'tier300', label: '300 YD', qty: 300, group: 'small', colors: 2 },
  { key: 'tier500', label: '500 YD', qty: 500, group: 'small', colors: 2 },
  { key: 'tier800', label: '800 YD', qty: 800, group: 'small', colors: 2 },
  { key: 'tier1k', label: '1,000 YD', qty: 1000, group: 'mcq', assumeMcq: true },
  { key: 'tier3k', label: '3,000 YD', qty: 3000, group: 'mcq', assumeMcq: true, main: true },
  { key: 'tier5k', label: '5,000 YD', qty: 5000, group: 'mcq', assumeMcq: true },
];

// 원가 표 구간 묶음 머리 (COST_DISPLAY_TIERS의 group 순서대로, 같은 묶음끼리 붙어 있어야 함)
export const COST_TIER_GROUPS = [
  { key: 'small', label: '2컬러 기준', hint: '2컬러로 나눠 염색 · 컬러당 최소 청구 적용' },
  { key: 'mcq', label: 'MCQ 충족 기준', hint: '컬러마다 MCQ 이상 · 염색 최소 청구 없음' },
];

// 편직비가 어떤 기준으로 정해졌는지 (computeCostAtQty 결과 knit.mode) — 화면 표시용
export const KNIT_FEE_MODE_LABEL = { fixed: '정액', kg: 'kg계산', floor: '구간하한' };

// 레거시 기타비용 기본 3항목 — 이제 원가 설정값으로 계산하므로 품목에 남아 있는 값은 무시
export const LEGACY_ETC_IDS = ['etc_visual', 'etc_chem', 'etc_freight'];
export const LEGACY_ETC_NAMES = ['외관검사', '이화학검사', '운임'];
