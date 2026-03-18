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

// 원단 설계서 진행 5단계
export const DESIGN_STAGES = [
  { key: 'draft', label: '설계서 작성', icon: 'Edit2' },
  { key: 'confirmed', label: '진행 확정', icon: 'Check' },
  { key: 'eztex', label: 'EZ-TEX 등록', icon: 'Database' },
  { key: 'sampling', label: '샘플 진행', icon: 'Factory' },
  { key: 'articled', label: '아이템화', icon: 'Award' }
];

// 단계별 UI 색상 배지
export const STAGE_COLORS = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  eztex: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  sampling: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  articled: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
};
