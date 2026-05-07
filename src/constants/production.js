// GRUBIG ERP - 원단 생산 스케줄 모듈 상수

// ============================================================
// 1. 공정 7종 (v2: L/D 제거, 후가공 추가 / v4: assigneeRole 폐기)
//   qtyUnit: 차수의 수량 단위. 'kg' | 'yd' | null(수량 무관)
//     - 원사/사가공/편직/염가공/후가공: kg
//     - 외관검사: yd
//     - 이화학검사: 수량 무관 (검사 자체)
// ============================================================
export const PROCESS_TYPES = [
  { key: 'yarn',              label: '원사',       defaultSequence: 1, isParallelTrack: false, qtyUnit: 'kg' },
  { key: 'yarn_processing',   label: '사가공',     defaultSequence: 2, isParallelTrack: false, qtyUnit: 'kg' },
  { key: 'knitting',          label: '편직',       defaultSequence: 3, isParallelTrack: false, qtyUnit: 'kg' },
  { key: 'dyeing',            label: '염가공',     defaultSequence: 4, isParallelTrack: false, qtyUnit: 'kg' },
  { key: 'finishing',         label: '후가공',     defaultSequence: 5, isParallelTrack: false, qtyUnit: 'kg' },
  { key: 'physical_test',     label: '이화학검사', defaultSequence: 6, isParallelTrack: false, qtyUnit: null },
  { key: 'visual_inspection', label: '외관검사',   defaultSequence: 7, isParallelTrack: false, qtyUnit: 'yd' },
];

// 공정 key로 메타 조회
export const getProcessMeta = (key) => PROCESS_TYPES.find(p => p.key === key) || null;

// 공정의 수량 단위 (대문자 라벨, "KG"/"YD") — 표시용
export const getProcessQtyUnit = (key) => {
  const u = getProcessMeta(key)?.qtyUnit;
  return u ? u.toUpperCase() : null;
};

// ============================================================
// 2. 시작점(STAGE) 모델 — v2 신규
// 메인/샘플과 별도로 "어디부터 시작하는 오더인지" 구분
// ============================================================
export const START_STAGES = [
  { key: 'yarn',            label: '원사부터',         description: '원사 발주부터 시작하는 일반 오더' },
  { key: 'knitting',        label: '편직(생지)부터',   description: '생지가 이미 있는 가정으로 편직부터 시작' },
  { key: 'finished_fabric', label: '가공지부터(재염)', description: '가공지가 있어 재염 후 출고' },
];

// 시작점별 자동 비활성화 공정 (이전 단계 공정 잠금)
export const START_STAGE_DEACTIVATIONS = {
  yarn: [],
  knitting: ['yarn', 'yarn_processing'],
  finished_fabric: ['yarn', 'yarn_processing', 'knitting'],
};

// 시작점 + 타입 기반 기본 활성 공정
// 샘플은 보통 검사 공정 비활성, 메인은 기본 모두 활성
export const PROCESS_DEFAULT_ACTIVE = {
  main: {
    yarn:            ['yarn', 'yarn_processing', 'knitting', 'dyeing', 'finishing', 'physical_test', 'visual_inspection'],
    knitting:        ['knitting', 'dyeing', 'finishing', 'physical_test', 'visual_inspection'],
    finished_fabric: ['dyeing', 'finishing', 'physical_test', 'visual_inspection'],
  },
  sample: {
    yarn:            ['yarn', 'yarn_processing', 'knitting', 'dyeing', 'finishing'],
    knitting:        ['knitting', 'dyeing', 'finishing'],
    finished_fabric: ['dyeing', 'finishing'],
  },
};

// ============================================================
// 3. 차수 상태 (v5: 공정별 enum 폐기, 4가지로 단순화)
// ============================================================
export const BATCH_STATUSES = [
  { key: 'pending',     label: '대기',   color: 'slate'   },
  { key: 'in_progress', label: '진행중', color: 'blue'    },
  { key: 'issue',       label: '문제',   color: 'red'     },
  { key: 'done',        label: '완료',   color: 'emerald' },
];

// Tailwind 클래스 매핑
export const BATCH_STATUS_COLORS = {
  pending:     { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  in_progress: { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  issue:       { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
  done:        { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
};

// 차수 기본 상태 (모든 공정 공통)
export const PROCESS_DEFAULT_STATUS = 'pending';

// 자동 날짜 트리거 status keys
export const STATUS_TRIGGERS_START_DATE = 'in_progress';  // 진행중 → actualStartDate=today
export const STATUS_TRIGGERS_END_DATE   = 'done';         // 완료 → actualEndDate=today

// ============================================================
// 염가공 컬러별 브랜드 컨펌 결과
// ------------------------------------------------------------
// 라운드별 result 값. 빈 문자열('')은 미설정(진행 전).
// ============================================================
export const BRAND_CONFIRM_RESULTS = [
  { key: 'pass',   label: '합격',   color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { key: 'fail',   label: '불합격', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { key: 'retest', label: '재시험', color: 'bg-amber-100 text-amber-700 border-amber-300' }
];

// 레거시 한글 차수 status → 신규 4상태 키 매핑 (옛 enum 데이터 호환)
export const LEGACY_BATCH_STATUS_MAP = {
  // 사가공
  '대기중': 'pending', '가공중': 'in_progress', '완료': 'done', '보류': 'issue',
  // 편직
  '투입예정': 'in_progress', '편직중': 'in_progress',
  // 염가공
  '염색대기': 'pending', '염색중': 'in_progress', '가공중인': 'in_progress',
  '가공완료': 'done', '재가공중': 'in_progress',
  // 검사 (외관/이화학/L/D 등)
  '대기': 'pending', '진행중': 'in_progress', 'Pass': 'done', 'Fail': 'issue',
  '재진행중': 'in_progress', '재test중': 'in_progress', '재컨펌중': 'in_progress',
  // 브랜드 컨펌
  '가공지발송': 'in_progress', '컨펌대기': 'in_progress', '컨펌중': 'in_progress',
};

/**
 * 차수 status를 표준 4상태 키 중 하나로 정규화.
 * - 이미 신규 키면 그대로
 * - 한글 레거시면 매핑
 * - 미지정/이상값이면 'pending' 폴백
 */
export const normalizeBatchStatus = (status) => {
  if (!status) return 'pending';
  if (BATCH_STATUSES.some(s => s.key === status)) return status;
  return LEGACY_BATCH_STATUS_MAP[status] || 'pending';
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

// Tailwind 클래스 매핑
export const ORDER_STATUS_COLORS = {
  active:       { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  completed:    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  on_hold:      { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  delayed_risk: { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
};

// 납기 건강도 색상
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

// 단위는 YD가 주, KG는 자동 환산값(표시용)
export const UNIT_PRIMARY = 'yd';

// 사가공 유형 — v2에서는 단순화: 사용자가 자유 선택
export const YARN_PROCESSING_TYPES = [
  { key: 'twisting',    label: '연사' },
  { key: 'reconing',    label: '분콘' },
  { key: 'yarn_dyeing', label: '사염' },
];

// 원사 입고 상태 — v6: BATCH_STATUSES와 동일한 4개로 통일
// 기존 한글 enum은 legacy 데이터 호환용으로 매핑만 유지 (강제 마이그레이션 없음)
// 필요 시 UI에서 normalizeDeliveryStatus()로 표준화하여 표시
export const YARN_DELIVERY_STATUSES = BATCH_STATUSES;
export const YARN_DELIVERY_STATUS_COLORS = BATCH_STATUS_COLORS;

// 레거시 한글 상태 → 신규 4상태 키 매핑
export const LEGACY_YARN_DELIVERY_STATUS_MAP = {
  '발주대기': 'pending',
  '생산중':   'in_progress',
  '운송중':   'in_progress',
  '입고대기': 'in_progress',
  '입고완료': 'done',
  '보류':     'issue',
};

/**
 * 입고차수 status를 표준 4상태 키(pending/in_progress/issue/done) 중 하나로 정규화.
 * - 이미 신규 키면 그대로
 * - 한글 레거시면 매핑
 * - 미지정/이상값이면 'pending' 폴백
 */
export const normalizeDeliveryStatus = (status) => {
  if (!status) return 'pending';
  if (BATCH_STATUSES.some(s => s.key === status)) return status;
  return LEGACY_YARN_DELIVERY_STATUS_MAP[status] || 'pending';
};

// 입고완료(=done) 트리거 → actualArrivalDate=today
export const DELIVERY_STATUS_TRIGGERS_ARRIVAL = 'done';

// v4: 담당자 시스템 폐기 — ASSIGNEE_ROLES 제거됨

// ============================================================
// 6. KG 환산 상수 (helpers.js calculateGYd 기반)
// ============================================================
// 야드당 그램 = gsm × widthFull × 0.02322576
// kg = (yd × 야드당그램) / 1000
export const KG_CONVERSION_COEFFICIENT = 0.02322576;
