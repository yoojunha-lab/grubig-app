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

// (원가 개편 2026-10) 외관검사·이화학검사·운임 기본값은 품목별 기타비용이 아니라
//   전 품목 공통 '원가 설정'으로 이동 → constants/costing.js (DEFAULT_COST_SETTINGS)

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

// 개발 의뢰 Drop 사유 (대표님 요청 2026-10-06 — 원가 견적을 보고 비싸서 Drop된 건을 따로 보려고)
//  key 는 의뢰 문서 dropReason 에 저장되는 값이라 바꾸지 말 것
export const DEV_DROP_REASONS = [
  { key: 'price',    label: '가격',        desc: '견적가가 바이어 예산·타겟 단가보다 높음', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'leadtime', label: '납기',        desc: '샘플·생산 납기를 맞추기 어려움',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'spec',     label: '품질·스펙',   desc: '원하는 스펙·느낌으로 개발하기 어려움',    cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'buyer',    label: '바이어 사정', desc: '바이어 쪽 오더 취소·보류 등',             cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'etc',      label: '기타',        desc: '메모에 사유를 적어 주세요',               cls: 'bg-slate-100 text-slate-600 border-slate-300' }
];

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

// ※ '샘플 진행' 세부단계(SAMPLING_SUBSTAGES: 원사 발주/편직/염가공/중단)는 없앰 (2026-10-10)
//   샘플 진행은 생산 현황 샘플 오더(원사·편직·염가공 LOT·컨펌·출고)로 봄. 예전 설계서 문서의 samplingSub 값은 그대로 남아 있음
