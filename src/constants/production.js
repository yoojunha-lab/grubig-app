// GRUBIG ERP - 원단 생산 스케줄 모듈 상수 (v8: 엑셀형 현황표 개편)
// ------------------------------------------------------------
// v8 핵심 변경
//  - 차수(1차/2차) 폐기 → 공정마다 "전체 일정" 한 세트(외주처·시작일·종료일·상태·메모)
//  - 수량은 KG 기준 (오더수량 / 생지kg = 오더수량 × (1 + 로스율) — 예전 이름 '작지수량', 2026-10-14)
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

// 끝난 것(종결) 공통 회색 — 현황표 칸 · 간트 막대 · 상태 배지 (대표님 요청 2026-10-14 '종결된 건 회색으로 통일')
//  완료된 오더(마무리 끝 · Drop)는 줄 전체, 진행 중인 오더는 끝난 칸 · 막대만. 진행 중(파랑) · 문제(빨강)만 색으로 남음
//  cell: 표 칸 배경+글자 / bar: 간트 막대 / chip: 상태 드롭다운 · 배지 / dot: 점
export const DONE_TONE = {
  cell: 'bg-slate-100 text-slate-500',
  bar: 'bg-slate-200 border-slate-400 text-slate-600',
  chip: 'bg-slate-200 text-slate-600 border-slate-400',
  dot: 'bg-slate-400',
};

//  대기 = 흰 바탕(아직 시작 전) / 완료 = 회색(끝남 — DONE_TONE) — 둘 다 회색이면 헷갈려서 대기는 흰색
export const PROGRESS_STATUS_COLORS = {
  pending:     { bg: 'bg-white',       text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-300'   },
  in_progress: { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  issue:       { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500'     },
  done:        { bg: 'bg-slate-200',   text: 'text-slate-600',   border: 'border-slate-400',   dot: DONE_TONE.dot    },
};

export const getStatusLabel = (key) => PROGRESS_STATUSES.find(s => s.key === key)?.label || '대기';

// 상태 드롭다운 선택지 (공정·LOT 공통 — StatusSelect 에 그대로 넘김)
export const PROGRESS_STATUS_OPTIONS = PROGRESS_STATUSES.map(s => {
  const c = PROGRESS_STATUS_COLORS[s.key];
  return { key: s.key, label: s.label, cls: `${c.bg} ${c.text} ${c.border}` };
});

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
//  외관검사는 LOT별 1차·2차 (lot.inspections — 대표님 요청 2026-10-14). 예전 컬러별·오더 단위 외관검사는 읽을 때 LOT로 옮김
//  일정 = 예상 시작일·예상 종료일 (예상 종료일을 바꾸면 예전 날짜가 endHistory 에 남음 — 대표님 요청 2026-10-11)
//  프리세팅: 공정 칸에서 빠지고 염가공 LOT 창에서 관리 (대표님 요청 2026-10-14 — 염색 전에 하는 일, 오더에 한 번)
//   · 값은 그대로 steps.presetting (오더 공통) — 흐름 순서(FLOW_ORDER)·공정 목록(getStepDefs)에는 없음
//  원사 (대표님 요청 2026-10-14 v11): 공정 한 세트가 아니라 원사 칸 하나에 '사종 줄'(발주대기·발주완료·입고완료·중지) + [재고 사용]
//   + 원사염색(선염 — 오더에 한 번). 원사 칸은 '#yarn'(오더 단위 특별 칸) — steps.yarn 은 예전 값만 남음 (읽을 때 사종 한 줄로 옮김)
//   · 원사염색은 steps.yarn_dyeing (공정 한 세트 — 염색처 · 예상 시작/종료일 · 상태 · 메모). 원사 칸·원사 창에서 관리 (inYarn)
// ============================================================
export const ORDER_STEPS = [
  { key: 'yarn',              label: '원사',       vendorLabel: '원사처',   vendorMaster: 'yarnSuppliers' },
  { key: 'yarn_dyeing',       label: '원사염색',   vendorLabel: '염색처',   vendorMaster: 'dyeingFactories', inYarn: true },
  { key: 'yarn_processing',   label: '사가공',     vendorLabel: '가공처',   vendorMaster: null },
  { key: 'knitting',          label: '편직',       vendorLabel: '편직처',   vendorMaster: 'knittingFactories' },
  { key: 'presetting',        label: '프리세팅',   vendorLabel: '가공처',   vendorMaster: 'dyeingFactories', inLot: true },
  { key: 'finishing',         label: '후가공',     vendorLabel: '가공처',   vendorMaster: 'dyeingFactories' },
  { key: 'physical_test',     label: '이화학검사', vendorLabel: '시험기관', vendorMaster: null },
];

export const ORDER_STEP_KEYS = ORDER_STEPS.map(s => s.key);

export const getStepMeta = (key) => ORDER_STEPS.find(s => s.key === key) || null;

// 염가공 LOT 창에서 관리하는 프리세팅 (오더 공통 — 외주처 칸 없이 예상 시작·종료일 · 상태 · 메모)
export const PRESETTING_KEY = 'presetting';

// 원사 칸 · 원사 창에서 관리하는 원사염색 (선염 — 오더에 한 번, 염색처 · 예상 시작/종료일 · 상태 · 메모)
export const YARN_DYEING_KEY = 'yarn_dyeing';

// ============================================================
// 2-B. 공정 흐름 순서 + 추가 공정 (대표님 요청 2026-10-11 '공정을 추가할 수 있게')
// ------------------------------------------------------------
//  FLOW_ORDER: 현황표 칸 · 간트 · 상세창 공정 순서의 기준. '#'으로 시작하는 건 컬러별 칸 (공정 아님)
//  추가 공정 = settings/general.productionSteps [{ key: 'cs_…', label, after, vendorLabel }]
//   · after: 어느 칸 다음에 둘지 — 공정 key, '#dyeing'(염가공 LOT), 다른 추가 공정 key
//   · 모든 오더에 칸이 생김 (칸을 채운 오더만 "사용하는 공정"). 일정 = 외주처·예상 시작/종료일·상태·메모
// ============================================================
//  '#closing' = 오더 마무리 (원사재고정리 · EZTEX 재고정리 · EZTEX 종결 — 오더 단위 칸, 대표님 요청 2026-10-14)
//  '#yarn' = 원사 (사종 줄 · 재고 사용 · 원사염색 — 오더 단위 칸, 대표님 요청 2026-10-14 v11)
export const FLOW_ORDER = [
  '#yarn', 'yarn_processing', 'knitting', '#greige', '#dyeing',
  'finishing', 'physical_test', '#confirm', '#inspection', '#ship', '#closing',
];

// 추가 공정 위치로 고를 수 있는 특별 칸 (공정 사이에 끼울 수 있는 것만)
export const FLOW_ANCHOR_LABELS = { '#yarn': '원사', '#dyeing': '염가공', '#inspection': '외관검사' };

export const isCustomStepKey = (key) => /^cs_/.test(String(key || ''));

// 설정 값 → [{ key, label, after, vendorLabel }] (이름이 없거나 key 가 이상한 줄 · 같은 key 가 또 나온 줄은 버림)
export const normalizeCustomSteps = (list) => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(s => s && typeof s === 'object' && isCustomStepKey(s.key) && String(s.label || '').trim())
    .filter(s => (seen.has(s.key) ? false : seen.add(s.key)))
    .map(s => ({
      key: s.key,
      label: String(s.label).trim(),
      // 예전 오더 단위 '외관검사' 다음 → 외관검사 칸 다음 / '프리세팅' 다음 → 편직 다음 (프리세팅이 LOT 창으로 가서 같은 자리)
      //  '원사' 다음 → 원사 칸('#yarn') 다음 (원사가 특별 칸이 됨 — 2026-10-14 v11)
      after: s.after === 'visual_inspection' ? '#inspection'
        : s.after === 'presetting' ? 'knitting'
          : s.after === 'yarn' ? '#yarn'
            : String(s.after || ''),
      vendorLabel: String(s.vendorLabel || '').trim() || '외주처',
    }));
};

export const createCustomStepKey = () => `cs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// 추가 공정 key 가 anchor 의 (바로 또는 다른 추가 공정을 거쳐) 다음에 있는지 — 위치가 돌고 돌면 false
const isPlacedAfter = (byKey, key, anchor) => {
  const seen = new Set();
  let cur = byKey.get(key);
  while (cur && !seen.has(cur.key)) {
    if (cur.after === anchor) return true;
    seen.add(cur.key);
    cur = byKey.get(cur.after);
  }
  return false;
};

// 이 추가 공정 다음에 놓인 추가 공정들 (공정 추가 창에서 위치를 고를 때 돌고 도는 위치를 막으려고)
export const getCustomStepDescendants = (customSteps, key) => {
  const list = normalizeCustomSteps(customSteps);
  const byKey = new Map(list.map(cs => [cs.key, cs]));
  return new Set(list.filter(cs => cs.key !== key && isPlacedAfter(byKey, cs.key, key)).map(cs => cs.key));
};

/**
 * 흐름 순서 = 기본 칸 + 추가 공정 (각자 'after' 칸 바로 다음)
 *  - 같은 칸 다음에 여러 개면 목록 순서대로 (먼저 들어간 공정과 그 공정 다음에 놓인 공정들 뒤로)
 *  - 다른 추가 공정 다음이면 그 공정 바로 다음 (목록에서 뒤에 있어도 — 몇 단계든)
 *  - 위치 칸이 없어졌거나 서로 돌고 도는 위치면 컬러별 마무리 칸(컨펌) 앞
 * 반환: ['yarn', …, 'cs_x', …, '#ship']
 */
export const buildFlowOrder = (customSteps = []) => {
  const customs = normalizeCustomSteps(customSteps);
  const byKey = new Map(customs.map(cs => [cs.key, cs]));
  const list = [...FLOW_ORDER];
  let pending = customs;
  // 다른 추가 공정 다음에 두는 공정은 그 공정이 먼저 들어가야 하므로 여러 번 돌림 (공정 수만큼이면 충분)
  for (let pass = 0; pass <= customs.length && pending.length; pass += 1) {
    const rest = [];
    pending.forEach(cs => {
      const i = list.indexOf(cs.after);
      if (i === -1) {
        rest.push(cs);
        return;
      }
      let j = i + 1;
      while (j < list.length && isCustomStepKey(list[j]) && isPlacedAfter(byKey, list[j], cs.after)) j += 1;
      list.splice(j, 0, cs.key);
    });
    if (rest.length === pending.length) break;
    pending = rest;
  }
  pending.forEach(cs => {
    if (list.includes(cs.key)) return;
    list.splice(list.indexOf('#confirm'), 0, cs.key);
  });
  return list;
};

// 추가 공정 메타 (기본 공정과 같은 모양 + custom 표시)
const customStepMeta = (cs) => ({
  key: cs.key, label: cs.label, vendorLabel: cs.vendorLabel || '외주처', vendorMaster: null, custom: true, after: cs.after,
});

// 공정 목록 (흐름 순서, 기본 공정 + 추가 공정) — 현황표 · 간트 · 상세창 · 리포트 · 변경 이력 공용
export const getStepDefs = (customSteps = []) => {
  const custom = new Map(normalizeCustomSteps(customSteps).map(cs => [cs.key, cs]));
  return buildFlowOrder(customSteps)
    .filter(k => !k.startsWith('#'))
    .map(k => getStepMeta(k) || (custom.has(k) ? customStepMeta(custom.get(k)) : null))
    .filter(Boolean);
};

// 공정 key → 메타 (목록에 없으면 기본 공정에서, 그래도 없으면 null)
export const findStepMeta = (stepDefs, key) => (stepDefs || []).find(s => s.key === key) || getStepMeta(key);

// 공정 목록 + 원사염색(맨 앞 — 원사 다음, 메타에 inYarn: true) + 프리세팅(편직 바로 다음, 편직이 없으면 맨 뒤 — 메타에 inLot: true)
//  둘 다 공정 칸에는 없지만 간트 [+]·날짜 메뉴 · 리포트 소요일 · 남은 일에서는 같이 보여 줌 (2026-10-14)
//  (원사염색은 선염 오더에만 — 간트 메뉴는 orderModel.canUseYarnDyeing 으로 거름)
export const withSubSteps = (stepDefs = []) => {
  const list = (stepDefs || []).filter(s => s.key !== PRESETTING_KEY && s.key !== YARN_DYEING_KEY);
  const at = list.findIndex(s => s.key === 'knitting');
  list.splice(at === -1 ? list.length : at + 1, 0, getStepMeta(PRESETTING_KEY));
  list.unshift(getStepMeta(YARN_DYEING_KEY));
  return list;
};

// 염가공(컬러별 LOT) 메타 — 표시 라벨/색상 통일용
export const DYEING_STEP = { key: 'dyeing', label: '염가공', vendorLabel: '염색소', vendorMaster: 'dyeingFactories' };

// ============================================================
// 3. 공정/단계별 색상 테마 (엑셀 현황표 색감 기준)
// ------------------------------------------------------------
//  엑셀: 편직=노랑, 생지출고·염색대기=초록, 염가공=주황, 컨펌·출고=파랑
//  cell: 표 칸/뱃지 배경+글자, bar: 간트 막대(진한 배경+테두리), dot: 범례 점
// ============================================================
//  원사 · 사가공은 초록 (예전 회갈색은 '끝남' 회색과 헷갈려서 — 2026-10-14)
export const PROCESS_THEME = {
  yarn:              { label: '원사',       cell: 'bg-green-50 text-green-900',      bar: 'bg-green-200 border-green-500 text-green-900',     dot: 'bg-green-500'   },
  yarn_dyeing:       { label: '원사염색',   cell: 'bg-pink-50 text-pink-800',        bar: 'bg-pink-200 border-pink-400 text-pink-900',        dot: 'bg-pink-400'    },
  yarn_processing:   { label: '사가공',     cell: 'bg-green-50 text-green-900',      bar: 'bg-green-100 border-green-400 text-green-900',     dot: 'bg-green-400'   },
  knitting:          { label: '편직',       cell: 'bg-yellow-100 text-yellow-800',   bar: 'bg-yellow-200 border-yellow-400 text-yellow-900',  dot: 'bg-yellow-400'  },
  presetting:        { label: '프리세팅',   cell: 'bg-cyan-100 text-cyan-800',       bar: 'bg-cyan-200 border-cyan-400 text-cyan-900',        dot: 'bg-cyan-400'    },
  greige:            { label: '생지출고',   cell: 'bg-lime-100 text-lime-800',       bar: 'bg-lime-200 border-lime-500 text-lime-900',        dot: 'bg-lime-500'    },
  dyeing:            { label: '염가공',     cell: 'bg-orange-100 text-orange-800',   bar: 'bg-orange-200 border-orange-400 text-orange-900',  dot: 'bg-orange-400'  },
  finishing:         { label: '후가공',     cell: 'bg-amber-100 text-amber-800',     bar: 'bg-amber-200 border-amber-400 text-amber-900',     dot: 'bg-amber-400'   },
  physical_test:     { label: '이화학검사', cell: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-200 border-violet-400 text-violet-900',  dot: 'bg-violet-400'  },
  visual_inspection: { label: '외관검사',   cell: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-200 border-violet-400 text-violet-900',  dot: 'bg-violet-400'  },
  inspection:        { label: '외관검사',   cell: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-200 border-violet-400 text-violet-900',  dot: 'bg-violet-500'  },
  confirm:           { label: '컨펌',       cell: 'bg-sky-100 text-sky-800',         bar: 'bg-sky-200 border-sky-400 text-sky-900',           dot: 'bg-sky-400'     },
  test:              { label: '시험성적서', cell: 'bg-fuchsia-100 text-fuchsia-800', bar: 'bg-fuchsia-200 border-fuchsia-400 text-fuchsia-900', dot: 'bg-fuchsia-400' },
  ship:              { label: '출고',       cell: 'bg-blue-100 text-blue-800',       bar: 'bg-blue-200 border-blue-400 text-blue-900',        dot: 'bg-blue-500'    },
  custom:            { label: '추가 공정',  cell: 'bg-indigo-100 text-indigo-800',   bar: 'bg-indigo-200 border-indigo-400 text-indigo-900',  dot: 'bg-indigo-400'  },
  redye:             { label: '재가공',     cell: 'bg-orange-50 text-orange-800',    bar: 'bg-orange-100 border-orange-500 text-orange-900',  dot: 'bg-orange-500'  },
  closing:           { label: '마무리',     cell: 'bg-emerald-50 text-emerald-800',  bar: 'bg-emerald-200 border-emerald-400 text-emerald-900', dot: 'bg-emerald-500' },
};

// ============================================================
// 4. 컬러 줄의 "현재 단계" (입력한 일정/상태로 자동 계산 — orderModel.getColorStage)
// ============================================================
export const COLOR_STAGES = {
  waiting:     { label: '대기',       cls: 'bg-white text-slate-500 border-slate-300' },     // 시작 전 = 흰색 (끝남 회색과 구분)
  yarn:        { label: '원사진행',   cls: 'bg-green-50 text-green-800 border-green-300' },
  yarn_dyeing: { label: '원사염색중', cls: 'bg-pink-50 text-pink-800 border-pink-300' },
  knit_wait:   { label: '편직대기',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  knitting:    { label: '편직중',     cls: 'bg-yellow-200 text-yellow-900 border-yellow-400' },
  presetting:  { label: '프리세팅중', cls: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  greige_wait: { label: '생지출고대기', cls: 'bg-lime-100 text-lime-800 border-lime-300' },
  greige_partial: { label: '생지 부분출고', cls: 'bg-lime-50 text-lime-800 border-lime-300 border-dashed' },
  dye_wait:    { label: '염색대기',   cls: 'bg-lime-100 text-lime-800 border-lime-400' },
  dyeing:      { label: '염색중',     cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  redye:       { label: '재가공중',   cls: 'bg-orange-50 text-orange-800 border-orange-400 border-dashed' },
  finish_wait: { label: '후가공대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  finishing:   { label: '후가공중',   cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  inspection:  { label: '검사중',     cls: 'bg-violet-100 text-violet-800 border-violet-300' },
  inspect_wait: { label: '검사대기',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  defect:      { label: '불량컨펌중', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  confirm_wait: { label: '컨펌대기',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  confirm:     { label: '컨펌중',     cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  ship_wait:   { label: '출고대기',   cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  shipped:     { label: '출고완료',   cls: DONE_TONE.chip },   // 끝남 = 회색 (2026-10-14)
  issue:       { label: '문제',       cls: 'bg-red-100 text-red-700 border-red-300' },
  on_hold:     { label: '보류',       cls: 'bg-white text-slate-500 border-slate-300 border-dashed' },
  completed:   { label: '완료',       cls: DONE_TONE.chip },
};

// ============================================================
// 5. 오더 상태 (오더 전체) — 진행중 / 보류 / 완료
// ============================================================
export const ORDER_STATUSES = [
  { key: 'active',    label: '진행중' },
  { key: 'on_hold',   label: '보류'   },
  { key: 'completed', label: '완료'   },
];

//  완료 = 회색 (끝남 — DONE_TONE, 2026-10-14) · 보류 = 흰 바탕 점선 느낌의 연한 회색
export const ORDER_STATUS_COLORS = {
  active:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  on_hold:   { bg: 'bg-white',       text: 'text-slate-500',   border: 'border-slate-300',   dot: 'bg-slate-300'   },
  completed: { bg: 'bg-slate-200',   text: 'text-slate-600',   border: 'border-slate-400',   dot: DONE_TONE.dot    },
};

// ============================================================
// 6. 오더 구분 — 메인 / 신제품 / 재샘플 (대표님 요청 2026-10-19 '샘플/메인을 함부로 바꿀 수 있으면 안 됨')
//    type: 'main' | 'sample' — [전체 · 메인 · 샘플] 버튼 · 리포트는 이 값 (샘플 = 신제품 + 재샘플)
//    sampleKind: 'new'(신제품 — 설계서 → 아이템화 또는 Drop) | 'resample'(재샘플 — 기존 아이템을 한 번 더) | ''(메인 · 종류 미정)
//    구분은 [+ 오더 추가]에서 고르고, 저장되면 잠김 → 바꾸려면 ⋯ 메뉴 [구분 바꾸기] (사유 — 변경 이력에 남음)
//    order# 의 S/M 은 새 줄을 저장할 때 고른 구분과 다르면 한 번 묻는 데만 씀 (예전처럼 저절로 바꾸지 않음)
//    예) F-26S046 → 샘플, F-26M020 → 메인 (접두 영문 + 연도 2자리 뒤의 S/M)
// ============================================================
export const ORDER_TYPES = [
  { key: 'main',   label: '메인' },
  { key: 'sample', label: '샘플' },
];

// 구분 3가지 (오더 추가 메뉴 · 구분 표시 · 구분 바꾸기 창)
//  menuLabel: 오더 추가 메뉴 글자 / desc: 메뉴·창 설명 / chip: 구분 표시 색
export const ORDER_KINDS = [
  {
    key: 'main', label: '메인', type: 'main', sampleKind: '',
    menuLabel: '메인 오더', desc: '생산 오더 (보통 M 번호)',
    chip: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    key: 'new', label: '신제품', type: 'sample', sampleKind: 'new',
    menuLabel: '신제품 샘플', desc: '설계서를 쓰고 아이템화(원단 등록) 또는 Drop으로 끝내요 (보통 S 번호)',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    key: 'resample', label: '재샘플', type: 'sample', sampleKind: 'resample',
    menuLabel: '재샘플', desc: '기존 아이템(원단 관리)을 한 번 더 샘플 — article#에서 아이템을 골라요',
    chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  },
];
export const SAMPLE_KIND_KEYS = ['new', 'resample'];

// 예전 샘플 오더 중 설계서 · 원단 연결이 없어 종류를 모르는 것 (한 번 고르면 잠김)
export const UNKNOWN_ORDER_KIND = {
  key: 'unknown', label: '종류 미정', type: 'sample', sampleKind: '',
  menuLabel: '종류 미정', desc: '예전에 만든 샘플 — 신제품인지 재샘플인지 한 번 골라 주세요',
  chip: 'bg-amber-50 text-amber-800 border-amber-300',
};

// 구분 때문에 남은 할 일 꼬리표 (진행 중 오더만 — orderModel.getOrderKindTodo)
//  sheet: 신제품인데 설계서 없음 / item: 재샘플인데 아이템(원단 관리 원단) 안 고름 — 고르기 전에는 '완료' 못 함
//  (종류 미정은 구분 표시 자체가 노란 '종류 미정')
export const ORDER_KIND_TODOS = {
  sheet: {
    label: '설계서 없음',
    cls: 'bg-amber-50 text-amber-800 border-amber-300',
    title: '신제품 샘플인데 설계서가 아직 없어요 — ⋯ 메뉴에서 [새 설계서 작성] 또는 [작성 중인 설계서 연결] (설계서가 있어야 아이템화)',
  },
  item: {
    label: '아이템 선택',
    cls: 'bg-red-50 text-red-700 border-red-300',
    title: '재샘플은 article# 칸에서 기존 아이템(원단 관리)을 골라야 해요 — 고르기 전에는 완료할 수 없어요',
  },
};

export const detectOrderType = (orderNumber) => {
  const m = String(orderNumber || '').trim().toUpperCase().match(/^[A-Z]+-?\d{2}([SM])/);
  if (!m) return null;
  return m[1] === 'S' ? 'sample' : 'main';
};

// ============================================================
// 7. 수량 / 로스율 / 생지 출고
// ============================================================
// 생지kg = 오더수량 × (1 + 로스율/100). 엑셀 실측 대부분 10%
export const DEFAULT_LOSS_RATE = 10;

// 남은 배색량 (생지kg − 배색량 합계 — 대표님 요청 2026-10-14) 색
//  left = 더 배색할 게 남음(주황) / done = 딱 맞음(회색 — 끝남) / over = 생지kg 보다 더 배색(빨강)
//  text = 칸 안 글자, badge = LOT 창 배지
export const DYE_REMAIN_STATES = {
  left: { text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  done: { text: 'text-slate-500', badge: DONE_TONE.chip },
  over: { text: 'text-red-600', badge: 'bg-red-50 text-red-700 border-red-300' },
};

// 생지 출고 종류 (출고 기록 한 줄마다 — 대표님 요청 2026-10-11)
//  전체 = 남은 생지 전부 (체크하면 생지 출고 끝) / 부분 = 일부만 (메모에 어떤 분인지). 줄마다 kg (2026-10-14)
export const GREIGE_OUT_KINDS = [
  { key: 'full',    label: '전체 출고', short: '전체', cls: 'bg-lime-100 text-lime-800 border-lime-300' },
  { key: 'partial', label: '부분 출고', short: '부분', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
];

// 염색 방식 (오더마다 — 대표님 요청 2026-10-14)
//  선염 = 원사를 먼저 염색 → 생지 출고는 컬러마다 / 후염 = 생지를 염색 → 생지 출고는 오더에 한 번
//  '' = 아직 안 고름 (예전 오더 — 컬러마다 출고, 지금까지처럼). 새 오더는 후염
export const DYE_METHODS = [
  { key: 'yarn',  label: '선염', desc: '생지 출고 컬러마다', cls: 'bg-pink-50 text-pink-700 border-pink-300' },
  { key: 'piece', label: '후염', desc: '생지 출고 오더에 한 번', cls: 'bg-sky-50 text-sky-700 border-sky-300' },
];
export const DEFAULT_DYE_METHOD = 'piece';
export const getDyeMethodMeta = (key) => DYE_METHODS.find(m => m.key === key) || null;

// 오더 마무리 체크 (대표님 요청 2026-10-14 — 이걸 끝내야 오더가 최종 마무리)
//  3개를 모두 체크하면 오더가 자동으로 '완료' (체크를 풀면 다시 진행중 — 자동으로 완료한 경우만)
export const CLOSING_ITEMS = [
  { key: 'yarnStock',   label: '원사재고정리',   short: '원사재고' },
  { key: 'eztexStock',  label: 'EZTEX 재고정리', short: 'EZTEX 재고' },
  { key: 'eztexClosed', label: 'EZTEX 종결',     short: 'EZTEX 종결' },
];
export const CLOSING_KEYS = CLOSING_ITEMS.map(i => i.key);
// '마무리 안 됨' 모아 보기 기준일 (대표님 요청 2026-10-19) — 마무리 체크가 생긴 날. 이 날 전에 완료된 예전 오더는 빼요
export const CLOSING_SINCE = '2026-10-14';

// ============================================================
// 7-B. 상태 기록 드롭다운 (컬러별 — 대표님 요청 2026-10-11)
// ------------------------------------------------------------
//  드롭다운을 바꿀 때마다 그날 날짜로 한 줄씩 남음 (날짜는 고칠 수 있음) → 마지막 줄이 지금 상태
//  phase: 'active'(진행) · 'done'(끝) · 'issue'(문제) — 간트 막대 색 · 컬러 단계 계산용
//  startsRound: 이 상태로 새 차수가 시작됨 (간트 막대 = 시작 ~ 결과)
//  끝(done) 상태는 회색 (DONE_TONE — 2026-10-14 '종결된 건 회색')
// ============================================================
// 시험성적서 (컨펌 칸 — '시험성적서'를 체크한 컬러만)
export const TEST_REPORT_STATUSES = [
  { key: 'issuing',  label: '발행중', phase: 'active', startsRound: true,  cls: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' },
  { key: 'pass',     label: '합격',   phase: 'done',   startsRound: false, cls: DONE_TONE.chip },
  { key: 'fail',     label: '불합격', phase: 'issue',  startsRound: false, cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  { key: 'resubmit', label: '재투입', phase: 'active', startsRound: true,  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'repass',   label: '재합격', phase: 'done',   startsRound: false, cls: DONE_TONE.chip },
];

// 브랜드 컨펌 (가공지를 브랜드에 보내 승인받기)
export const BRAND_CONFIRM_STATUSES = [
  { key: 'sent',      label: '전달', phase: 'active', startsRound: true,  cls: 'bg-sky-100 text-sky-700 border-sky-300' },
  { key: 'confirmed', label: '컨펌', phase: 'done',   startsRound: false, cls: DONE_TONE.chip },
  { key: 'rejected',  label: '리젝', phase: 'issue',  startsRound: false, cls: 'bg-rose-100 text-rose-700 border-rose-300' },
];

// 외관검사 (LOT별 · 1차·2차 차수마다 — 대표님 요청 2026-10-14) — 예상 시작일 · 예상 종료일 · 상태 · 메모
//  '투입 전' = 아직 안 넣음 (언제든 되돌릴 수 있게) / '검사중' = 투입하고 결과 전
//  '재가공' = 불량으로 염가공소에 다시 들어감 → 그 LOT 에 다음 차수(2차) 검사 줄이 자동으로 생김
//  컬러의 LOT 가 모두 '출고완료'면 그 컬러 출고 칸도 완료로 (orderModel.syncShipFromInspection)
export const INSPECTION_STATUSES = [
  { key: 'waiting',    label: '투입 전',      phase: 'pending', startsRound: false, cls: 'bg-white text-slate-500 border-slate-300' },
  { key: 'inspecting', label: '검사중',       phase: 'active',  startsRound: true,  cls: 'bg-violet-100 text-violet-700 border-violet-300' },
  { key: 'defect',     label: '불량컨펌중',   phase: 'issue',   startsRound: false, cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  { key: 'redye',      label: '재가공',       phase: 'rework',  startsRound: false, cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  { key: 'ready',      label: '출고준비완료', phase: 'done',    startsRound: false, cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'shipped',    label: '출고완료',     phase: 'done',    startsRound: false, cls: DONE_TONE.chip },
];

// 원사 사종 줄 (원사 칸 — 대표님 요청 2026-10-14 v11) — 발주대기 · 발주완료 · 입고완료 · 중지
//  드롭다운을 바꿀 때마다 그날 날짜로 기록 (시험성적서와 같은 방식). 기록이 없으면 '발주대기'
//  '중지' = 그 사종 발주를 멈춤 → 원사가 끝났는지 볼 때 빠짐
//  [재고 사용](오더 전체)을 체크하면 사종 줄과 상관없이 원사 발주는 끝난 것으로 봄
export const YARN_ORDER_STATUSES = [
  { key: 'waiting', label: '발주대기', phase: 'pending', cls: 'bg-white text-slate-600 border-slate-300' },
  { key: 'ordered', label: '발주완료', phase: 'active',  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'arrived', label: '입고완료', phase: 'done',    cls: DONE_TONE.chip },
  { key: 'stopped', label: '중지',     phase: 'stopped', cls: 'bg-slate-50 text-slate-400 border-slate-300 border-dashed' },
];

// 상태 목록에서 한 줄 찾기 (없으면 null)
export const findStatusMeta = (list, key) => (list || []).find(s => s.key === key) || null;

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
  done:      { rank: 1, chip: DONE_TONE.chip, flag: DONE_TONE.chip, line: 'border-slate-400' },   // 가납기 안에 끝남 = 회색 (2026-10-14)
  ok:        { rank: 2, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',  flag: 'bg-emerald-50 text-emerald-800 border-emerald-400',  line: 'border-emerald-500' },
  unplanned: { rank: 3, chip: 'bg-slate-100 text-slate-500 border-slate-200',      flag: 'bg-white text-slate-600 border-slate-400',          line: 'border-slate-400'   },
  done_late: { rank: 4, chip: 'bg-orange-100 text-orange-700 border-orange-300',   flag: 'bg-orange-100 text-orange-800 border-orange-400',   line: 'border-orange-500'  },
  late:      { rank: 5, chip: 'bg-red-100 text-red-700 border-red-300',            flag: 'bg-red-500 text-white border-red-600',              line: 'border-red-500'     },
  overdue:   { rank: 5, chip: 'bg-red-100 text-red-700 border-red-300',            flag: 'bg-red-500 text-white border-red-600',              line: 'border-red-500'     },
};
