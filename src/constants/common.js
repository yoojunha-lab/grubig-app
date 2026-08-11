// GRUBIG ERP - 공통 상수 정의

export const ALLOWED_DOMAIN = "@grubig.kr";

export const DEFAULT_YARN_CATEGORIES = [
  '소모', '방모', '화섬', 'SPANDEX', '면방', '린넨방'
];

export const MARGIN_TIERS = {
  0: 10,
  1: 13,
  2: 16,
  3: 19,
  4: 22,
  5: 25,
  6: 28
};

// 기타비용 기본값 (외관검사/이화학검사/운임) — 구간별 원/yd. 신규·기존 원단 공통 기본.
export const DEFAULT_ETC_COSTS = [
  { id: 'etc_visual', name: '외관검사',   vals: { tier1k: 190, tier3k: 190, tier5k: 190 } },
  { id: 'etc_chem',   name: '이화학검사', vals: { tier1k: 400, tier3k: 300, tier5k: 200 } },
  { id: 'etc_freight', name: '운임',      vals: { tier1k: 500, tier3k: 300, tier5k: 200 } },
];
// state 시드용 — 깊은 복사본 반환 (상수 직접 변형 방지)
export const makeDefaultEtcCosts = () => DEFAULT_ETC_COSTS.map(e => ({ ...e, vals: { ...e.vals } }));

// 원단 설계서 진행 4단계 (confirmed 삭제됨)
export const DESIGN_STAGES = [
  { key: 'draft', label: '설계서 작성', icon: 'Edit2' },
  { key: 'eztex', label: 'EZ-TEX O/D NO.', icon: 'Database' },
  { key: 'sampling', label: '샘플 진행', icon: 'Factory' },
  { key: 'articled', label: '아이템화', icon: 'Award' }
];

// 단계별 UI 색상 배지
export const STAGE_COLORS = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  eztex: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  sampling: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  articled: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
};

// 개발 의뢰 상태값 (5단계)
export const DEV_REQUEST_STATUSES = {
  PENDING: 'pending',     // 의뢰 접수
  ANALYZING: 'analyzing', // 분석 중
  HOLD: 'hold',           // 대기중 (분석완료, 설계서 작성 대기)
  CONFIRMED: 'confirmed', // 개발투입확정 (설계서 연결됨)
  REJECTED: 'rejected'    // Drop (미진행)
};

export const DEV_REQUEST_STATUS_LABELS = {
  pending: '의뢰 접수',
  analyzing: '분석 중',
  hold: '대기중',
  confirmed: '개발투입확정',
  rejected: 'Drop (미진행)'
};

// 개발 의뢰 상태 칩의 Tailwind 색상 클래스 (배경/텍스트/테두리)
export const DEV_REQUEST_STATUS_BADGE_CLS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
  hold: 'bg-purple-100 text-purple-700 border-purple-300',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-slate-200 text-slate-700 border-slate-300'
};

// 설계서 보관함 "대기중 목록"용 통합 진행 6단계 (아이템화 직전까지)
// 의뢰(devRequest.status) + 설계서(designSheet.stage) 두 축을 하나의 흐름으로 시각화
export const UNIFIED_PENDING_STAGES = [
  { key: 'pending',   label: '의뢰접수',   source: 'devRequest' },
  { key: 'analyzing', label: '분석중',     source: 'devRequest' },
  { key: 'hold',      label: '대기중',     source: 'devRequest' },
  { key: 'draft',     label: '설계서작성', source: 'designSheet' },
  { key: 'eztex',     label: 'EZ-TEX',     source: 'designSheet' },
  { key: 'sampling',  label: '샘플진행',   source: 'designSheet' }
];

// '샘플 진행(sampling)' 단계의 세부 진행 상태
// 원사 발주 → 편직 → 염가공 순으로 진행되며, '중단'은 일시 정지(보류) 상태
export const SAMPLING_SUBSTAGES = [
  { key: 'yarn',     label: '원사 발주', dot: 'bg-sky-400',    cls: 'bg-sky-100 text-sky-700 border-sky-300' },
  { key: 'knitting', label: '편직',      dot: 'bg-indigo-400', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { key: 'dyeing',   label: '염가공',    dot: 'bg-amber-400',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'stopped',  label: '중단',      dot: 'bg-rose-400',   cls: 'bg-rose-100 text-rose-700 border-rose-300' }
];
