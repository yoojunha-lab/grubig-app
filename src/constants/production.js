// GRUBIG ERP - 원단 생산 스케줄 모듈 상수

// ============================================================
// 1. 공정 7종 (기획서 1.7 기준)
// ============================================================
export const PROCESS_TYPES = [
  { key: 'yarn',              label: '원사',       assigneeRole: 'yarn',     defaultSequence: 1, isParallelTrack: false },
  { key: 'yarn_processing',   label: '사가공',     assigneeRole: 'others',   defaultSequence: 2, isParallelTrack: false },
  { key: 'lab_dip',           label: 'L/D',       assigneeRole: 'others',   defaultSequence: 3, isParallelTrack: true  },
  { key: 'knitting',          label: '편직',       assigneeRole: 'knitting', defaultSequence: 4, isParallelTrack: false },
  { key: 'dyeing',            label: '염가공',     assigneeRole: 'others',   defaultSequence: 5, isParallelTrack: false },
  { key: 'visual_inspection', label: '외관검사',   assigneeRole: 'others',   defaultSequence: 6, isParallelTrack: false },
  { key: 'physical_test',     label: '이화학검사', assigneeRole: 'others',   defaultSequence: 7, isParallelTrack: false },
];

// 공정 key로 메타 조회
export const getProcessMeta = (key) => PROCESS_TYPES.find(p => p.key === key) || null;

// ============================================================
// 2. 오더 타입 × 염색방식 별 기본 활성 공정 맵
// ------------------------------------------------------------
// 메인/샘플 × 후염/선염 4케이스
// ============================================================
export const PROCESS_DEFAULT_ACTIVE = {
  main: {
    post_dyed: ['yarn', 'knitting', 'dyeing', 'visual_inspection', 'physical_test'],
    yarn_dyed: ['yarn', 'yarn_processing', 'lab_dip', 'knitting', 'visual_inspection', 'physical_test'],
  },
  sample: {
    post_dyed: ['yarn', 'knitting', 'dyeing'],
    yarn_dyed: ['yarn', 'yarn_processing', 'lab_dip', 'knitting'],
  },
};

// ============================================================
// 3. 공정별 상태 Enum (기획서 2.5)
// ============================================================
export const PROCESS_STATUS_MAP = {
  yarn: ['발주대기', '생산중', '운송중', '입고대기', '입고완료', '보류'],
  yarn_processing: ['대기중', '가공중', '완료', '보류'],
  lab_dip: ['의뢰준비', '의뢰중', '컨펌대기', 'Pass', 'Fail', '재진행중'],
  knitting: ['대기중', '투입예정', '편직중', '보류', '완료'],
  dyeing: ['염색대기', '투입예정', '염색중', '가공중', '가공완료', '재가공중', '보류'],
  dyeing_brand_confirm: ['대기', '가공지발송', '컨펌중', 'Pass', 'Fail', '재컨펌중'],
  visual_inspection: ['대기', '진행중', 'Pass', 'Fail', '완료'],
  physical_test: ['대기', '진행중', 'Pass', 'Fail', '재test중', '완료'],
};

// 공정별 기본(대기) 상태 — 신규 차수 생성 시 초기값
export const PROCESS_DEFAULT_STATUS = {
  yarn: '발주대기',
  yarn_processing: '대기중',
  lab_dip: '의뢰준비',
  knitting: '대기중',
  dyeing: '염색대기',
  visual_inspection: '대기',
  physical_test: '대기',
};

// ============================================================
// 4. 오더 상태
// ============================================================
export const ORDER_STATUSES = [
  { key: 'active',        label: '진행중' },
  { key: 'completed',     label: '완료' },
  { key: 'on_hold',       label: '보류' },
  { key: 'delayed_risk',  label: '납기위험' },
];

// Tailwind 클래스 매핑 (기획서 4.1 색상 시스템)
export const ORDER_STATUS_COLORS = {
  active:       { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  completed:    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  on_hold:      { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  delayed_risk: { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
};

// 납기 건강도 색상 (기획서 4.1: 녹/황/적)
// - green: expected <= planned (정상/당김)
// - amber: expected > planned 이지만 final 이내 (주의)
// - red  : expected > final (위험)
// - slate: 대기 상태
export const DUE_HEALTH_COLORS = {
  green: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500'   },
  red:   { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
  slate: { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  blue:  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
};

// ============================================================
// 5. 기타
// ============================================================
export const ORDER_TYPES = [
  { key: 'main',   label: '메인' },
  { key: 'sample', label: '샘플' },
];

export const DYEING_METHODS = [
  { key: 'post_dyed', label: '후염' },
  { key: 'yarn_dyed', label: '선염' },
];

export const UNITS = [
  { key: 'kg', label: 'kg' },
  { key: 'yd', label: 'yd' },
];

// 사가공 유형 (기획서 2.2)
// - 후염 오더: twisting, reconing만 허용
// - 선염 오더: 3종 모두 허용
export const YARN_PROCESSING_TYPES = [
  { key: 'twisting',    label: '연사',    allowedFor: ['post_dyed', 'yarn_dyed'] },
  { key: 'reconing',    label: '분콘',    allowedFor: ['post_dyed', 'yarn_dyed'] },
  { key: 'yarn_dyeing', label: '사염',    allowedFor: ['yarn_dyed'] },
];

// 원사 입고 상태 (기획서 2.5)
export const YARN_DELIVERY_STATUSES = ['발주대기', '생산중', '운송중', '입고대기', '입고완료', '보류'];

// 담당자 역할
export const ASSIGNEE_ROLES = [
  { key: 'yarn',     label: '원사 담당자' },
  { key: 'knitting', label: '편직 담당자' },
  { key: 'others',   label: '그외 담당자' },
];
