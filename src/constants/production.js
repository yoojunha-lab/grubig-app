// GRUBIG ERP - 원단 생산 스케줄 모듈 상수 (v8: 엑셀형 현황표 개편)
// ------------------------------------------------------------
// v8 핵심 변경
//  - 차수(1차/2차) 폐기 → 공정마다 "전체 일정" 한 세트(외주처·시작일·종료일·상태·메모)
//  - 수량은 KG 기준 (오더수량 / 작지수량 = 오더수량 × (1 + 로스율))
//  - 염가공은 컬러별 LOT(염색탕) 목록으로 계획
//  - 오더 타입·시작점·공정 활성화 설정 폐기 → 칸을 채운 공정 = 사용하는 공정
// 데이터 구조/변환 로직은 src/utils/orderModel.js 참고

// ============================================================
// 1. 진행 상태 (모든 공정·LOT 공통 4단계)
// ============================================================
export const PROGRESS_STATUSES = [
  { key: 'pending',     label: '대기'   },
  { key: 'in_progress', label: '진행중' },
  { key: 'issue',       label: '문제'   },
  { key: 'done',        label: '완료'   },
];

export const PROGRESS_STATUS_COLORS = {
  pending:     { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  in_progress: { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  issue:       { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
  done:        { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
};

export const getStatusLabel = (key) => PROGRESS_STATUSES.find(s => s.key === key)?.label || '대기';

// 레거시(v7 이전) 한글 상태값 → 4단계 키 (기존 오더 자동 변환용)
const LEGACY_STATUS_MAP = {
  '대기중': 'pending', '가공중': 'in_progress', '완료': 'done', '보류': 'issue',
  '투입예정': 'in_progress', '편직중': 'in_progress',
  '염색대기': 'pending', '염색중': 'in_progress', '가공중인': 'in_progress',
  '가공완료': 'done', '재가공중': 'in_progress',
  '대기': 'pending', '진행중': 'in_progress', 'Pass': 'done', 'Fail': 'issue',
  '재진행중': 'in_progress', '재test중': 'in_progress', '재컨펌중': 'in_progress',
  '가공지발송': 'in_progress', '컨펌대기': 'in_progress', '컨펌중': 'in_progress',
  '발주대기': 'pending', '생산중': 'in_progress', '운송중': 'in_progress',
  '입고대기': 'in_progress', '입고완료': 'done',
};

/** 어떤 상태값이든 4단계 키로 정규화 (신규 키는 그대로, 레거시 한글은 매핑, 이상값은 'pending') */
export const normalizeStatus = (status) => {
  if (!status) return 'pending';
  if (PROGRESS_STATUSES.some(s => s.key === status)) return status;
  return LEGACY_STATUS_MAP[status] || 'pending';
};

// ============================================================
// 2. 오더 단위 공정 (차수 없음 — 공정마다 일정 한 세트)
// ------------------------------------------------------------
//  vendorMaster: 외주처 자동완성 목록으로 쓸 settings/general 마스터 키 (없으면 자유입력만)
//  염가공은 오더 단위가 아니라 컬러별 LOT로 관리하므로 여기 없음 (DYEING_STEP 참고)
// ============================================================
export const ORDER_STEPS = [
  { key: 'yarn',              label: '원사',       vendorLabel: '원사처',   vendorMaster: 'yarnSuppliers' },
  { key: 'yarn_processing',   label: '사가공',     vendorLabel: '가공처',   vendorMaster: null },
  { key: 'knitting',          label: '편직',       vendorLabel: '편직처',   vendorMaster: 'knittingFactories' },
  { key: 'finishing',         label: '후가공',     vendorLabel: '가공처',   vendorMaster: 'dyeingFactories' },
  { key: 'physical_test',     label: '이화학검사', vendorLabel: '시험기관', vendorMaster: null },
  { key: 'visual_inspection', label: '외관검사',   vendorLabel: '검사처',   vendorMaster: null },
];

export const ORDER_STEP_KEYS = ORDER_STEPS.map(s => s.key);

export const getStepMeta = (key) => ORDER_STEPS.find(s => s.key === key) || null;

// 염가공(컬러별 LOT) 메타 — 표시 라벨/색상 통일용
export const DYEING_STEP = { key: 'dyeing', label: '염가공', vendorLabel: '염색소', vendorMaster: 'dyeingFactories' };

// ============================================================
// 3. 공정/단계별 색상 테마 (엑셀 현황표 색감 기준)
// ------------------------------------------------------------
//  엑셀: 편직=노랑, 생지출고·염색대기=초록, 염가공=주황, 컨펌·출고=파랑
//  cell: 표 칸/뱃지 배경+글자, bar: 간트 막대(진한 배경+테두리), dot: 범례 점
// ============================================================
export const PROCESS_THEME = {
  yarn:              { label: '원사',       cell: 'bg-stone-100 text-stone-700',     bar: 'bg-stone-200 border-stone-400 text-stone-800',     dot: 'bg-stone-400'   },
  yarn_processing:   { label: '사가공',     cell: 'bg-stone-100 text-stone-700',     bar: 'bg-stone-200 border-stone-400 text-stone-800',     dot: 'bg-stone-400'   },
  knitting:          { label: '편직',       cell: 'bg-yellow-100 text-yellow-800',   bar: 'bg-yellow-200 border-yellow-400 text-yellow-900',  dot: 'bg-yellow-400'  },
  greige:            { label: '생지출고',   cell: 'bg-lime-100 text-lime-800',       bar: 'bg-lime-200 border-lime-500 text-lime-900',        dot: 'bg-lime-500'    },
  dyeing:            { label: '염가공',     cell: 'bg-orange-100 text-orange-800',   bar: 'bg-orange-200 border-orange-400 text-orange-900',  dot: 'bg-orange-400'  },
  finishing:         { label: '후가공',     cell: 'bg-amber-100 text-amber-800',     bar: 'bg-amber-200 border-amber-400 text-amber-900',     dot: 'bg-amber-400'   },
  physical_test:     { label: '이화학검사', cell: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-200 border-violet-400 text-violet-900',  dot: 'bg-violet-400'  },
  visual_inspection: { label: '외관검사',   cell: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-200 border-violet-400 text-violet-900',  dot: 'bg-violet-400'  },
  confirm:           { label: '컨펌',       cell: 'bg-sky-100 text-sky-800',         bar: 'bg-sky-200 border-sky-400 text-sky-900',           dot: 'bg-sky-400'     },
  ship:              { label: '출고',       cell: 'bg-blue-100 text-blue-800',       bar: 'bg-blue-200 border-blue-400 text-blue-900',        dot: 'bg-blue-500'    },
};

// ============================================================
// 4. 컬러 줄의 "현재 단계" (입력한 일정/상태로 자동 계산 — orderModel.getColorStage)
// ============================================================
export const COLOR_STAGES = {
  waiting:     { label: '대기',       cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  yarn:        { label: '원사진행',   cls: 'bg-stone-100 text-stone-700 border-stone-300' },
  knit_wait:   { label: '편직대기',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  knitting:    { label: '편직중',     cls: 'bg-yellow-200 text-yellow-900 border-yellow-400' },
  greige_wait: { label: '생지출고대기', cls: 'bg-lime-100 text-lime-800 border-lime-300' },
  dye_wait:    { label: '염색대기',   cls: 'bg-lime-100 text-lime-800 border-lime-400' },
  dyeing:      { label: '염색중',     cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  finish_wait: { label: '후가공대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  finishing:   { label: '후가공중',   cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  inspection:  { label: '검사중',     cls: 'bg-violet-100 text-violet-800 border-violet-300' },
  confirm_wait: { label: '컨펌대기',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  confirm:     { label: '컨펌중',     cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  ship_wait:   { label: '출고대기',   cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  shipped:     { label: '출고완료',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  issue:       { label: '문제',       cls: 'bg-red-100 text-red-700 border-red-300' },
  on_hold:     { label: '보류',       cls: 'bg-slate-200 text-slate-600 border-slate-300' },
  completed:   { label: '완료',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

// ============================================================
// 5. 오더 상태 (오더 전체) — 진행중 / 보류 / 완료
// ============================================================
export const ORDER_STATUSES = [
  { key: 'active',    label: '진행중' },
  { key: 'on_hold',   label: '보류'   },
  { key: 'completed', label: '완료'   },
];

export const ORDER_STATUS_COLORS = {
  active:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  on_hold:   { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
};

// ============================================================
// 6. 오더 구분 (메인/샘플) — order#에 S/M이 있으면 자동 선택
//    예) F-26S046 → 샘플, F-26M020 → 메인 (접두 영문 + 연도 2자리 뒤의 S/M)
// ============================================================
export const ORDER_TYPES = [
  { key: 'main',   label: '메인' },
  { key: 'sample', label: '샘플' },
];

export const detectOrderType = (orderNumber) => {
  const m = String(orderNumber || '').trim().toUpperCase().match(/^[A-Z]+-?\d{2}([SM])/);
  if (!m) return null;
  return m[1] === 'S' ? 'sample' : 'main';
};

// ============================================================
// 7. 수량 / 로스율 / 염색탕(LOT)
// ============================================================
// 작지수량 = 오더수량 × (1 + 로스율/100). 엑셀 실측 대부분 10%
export const DEFAULT_LOSS_RATE = 10;

// 염색탕 용량 프리셋 (kg). 목록에 없으면 LOT 편집에서 직접 입력
export const DYE_MACHINE_PRESETS = [300, 500];

// 브랜드 컨펌 결과
export const CONFIRM_RESULTS = [
  { key: 'pass', label: '합격',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { key: 'fail', label: '불합격', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
];

// 간트/일일 메모 칸 색상 선택지 (엑셀처럼 칸 색으로 단계 표시). '' = 자동(그날 진행 공정 색)
export const NOTE_TONES = [
  { key: '',         label: '자동' },
  { key: 'knitting', label: '편직' },
  { key: 'greige',   label: '생지·대기' },
  { key: 'dyeing',   label: '염가공' },
  { key: 'ship',     label: '컨펌·출고' },
  { key: 'issue',    label: '문제' },
];

export const NOTE_TONE_CLASSES = {
  knitting: 'bg-yellow-100 text-yellow-900',
  greige:   'bg-lime-100 text-lime-900',
  dyeing:   'bg-orange-100 text-orange-900',
  ship:     'bg-sky-100 text-sky-900',
  issue:    'bg-red-100 text-red-800',
};

// ============================================================
// 8. KG 환산 (레거시 YD 오더 변환 전용)
//    kg = yd × gsm × widthFull × 0.02322576 / 1000
// ============================================================
export const KG_CONVERSION_COEFFICIENT = 0.02322576;

// ============================================================
// 9. 가납기 (대표님 요청 2026-10-10 — 대략적인 공정별 목표 날짜)
// ------------------------------------------------------------
//  오더마다 4개 (염가공도 컬러별이 아니라 오더 하나에 하나).
//  현재 일정(종료일·완료일, 염가공은 가장 늦은 LOT 완료예정일)과 비교해 늦음/맞음 표시 → orderModel.getProvisionalDueInfo
//  short: 간트 깃발·현황표 칸처럼 좁은 곳에 쓰는 이름
// ============================================================
export const PROVISIONAL_DUE_STEPS = [
  { key: 'yarn',              label: '원사',     short: '원사' },
  { key: 'knitting',          label: '편직',     short: '편직' },
  { key: 'dyeing',            label: '염가공',   short: '염가공' },
  { key: 'visual_inspection', label: '외관검사', short: '외관' },
];

export const PROVISIONAL_DUE_KEYS = PROVISIONAL_DUE_STEPS.map(s => s.key);

// 가납기 비교 상태별 색 (getProvisionalDueInfo().state)
//  chip: 현황표·상세창·입력 창 뱃지 / flag: 간트 깃발 / line: 간트 세로 점선 / rank: 깃발을 합칠 때 더 나쁜 상태 우선
export const PROVISIONAL_STATES = {
  none:      { rank: 0, chip: 'bg-white text-slate-300 border-slate-200',          flag: 'bg-white text-slate-500 border-slate-300',          line: 'border-slate-300'   },
  done:      { rank: 1, chip: 'bg-emerald-100 text-emerald-700 border-emerald-300', flag: 'bg-emerald-100 text-emerald-800 border-emerald-400', line: 'border-emerald-500' },
  ok:        { rank: 2, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',  flag: 'bg-emerald-50 text-emerald-800 border-emerald-400',  line: 'border-emerald-500' },
  unplanned: { rank: 3, chip: 'bg-slate-100 text-slate-500 border-slate-200',      flag: 'bg-white text-slate-600 border-slate-400',          line: 'border-slate-400'   },
  done_late: { rank: 4, chip: 'bg-orange-100 text-orange-700 border-orange-300',   flag: 'bg-orange-100 text-orange-800 border-orange-400',   line: 'border-orange-500'  },
  late:      { rank: 5, chip: 'bg-red-100 text-red-700 border-red-300',            flag: 'bg-red-500 text-white border-red-600',              line: 'border-red-500'     },
  overdue:   { rank: 5, chip: 'bg-red-100 text-red-700 border-red-300',            flag: 'bg-red-500 text-white border-red-600',              line: 'border-red-500'     },
};
