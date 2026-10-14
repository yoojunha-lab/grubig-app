// GRUBIG ERP - 생산 오더 데이터 모델 (v8: 엑셀형 현황표)
// ------------------------------------------------------------
// 순수 함수만 모음 (Firestore/React 의존 없음). 화면·훅은 모두 이 파일의 구조를 따른다.
//
// ■ v8 오더 문서 구조 (orders 컬렉션, 문서 ID = order.id)
//   {
//     id, schemaVersion: 8,
//     orderNumber, articleNo, detail, customer(buyer), type('main'|'sample'),
//     finalDueDate, lossRate(%), status('active'|'on_hold'|'completed'), notes,
//     linkedFabricId, linkedFabricArticle, dyeVendor(염색소), inspectVendor(외관검사 검사처 — 오더 공통),
//     gsm, widthFull (원단 스펙 — 원단 보관함에서 고르면 채워짐, 없으면 LOT 창에서 직접 — 배색량 → 예상 YD 환산용),
//     linkedSheetId(설계서 id — 설계서 EZ-TEX O/D NO. 등록으로 만든 샘플 오더. 연결은 오더 쪽에만 저장),
//     dropInfo(설계서 Drop으로 닫힌 샘플 { prevStatus: Drop 전 오더상태, at } — 없으면 null. status 는 'completed'),
//     dyeMethod: 'yarn'(선염 — 생지 출고 컬러마다) | 'piece'(후염 — 생지 출고 오더에 한 번) | ''(안 고름 — 컬러마다)  (2026-10-14)
//     greigeOuts: [{ id, date, kind, memo, done, kg }]  (후염 오더의 생지 출고 — 오더 전체 한 번에)
//     closing: { yarnStock, eztexStock, eztexClosed } 각 { done, date, memo }  (오더 마무리 체크 — 2026-10-14)
//     closingAuto: 마무리 3개를 다 체크해서 자동으로 '완료'가 된 오더 { prevStatus, at } — 체크를 풀면 prevStatus 로 (없으면 null)
//     steps: { yarn, yarn_processing, knitting, presetting, finishing, physical_test }
//            각 { vendor, startDate(예상 시작일), endDate(예상 종료일), status, doneDate, notes,
//                 endHistory: [{ date: 예전 예상 종료일, at: 바꾼 날 }] (오래된 것이 앞 — [0] = 최초 예상 종료일) }
//            + knitting.machines: [{ id, name('1호기'), dailyKg }] (기계별 일일 생산량), knitting.dailyKg = 기계 합계
//            presetting 은 공정 칸이 아니라 염가공 LOT 창에서 (오더 공통 — 2026-10-14)
//     colors: [{ id, name, orderKg, workKg(null=자동),
//                greigeOuts: [{ id, date, kind('full'|'partial'), memo, done, kg }]  (생지 출고 — 선염·안 고른 오더, 여러 번, 전체/부분)
//                greigeOutDate, greigeOutDone (← greigeOuts 에서 계산해 같이 저장하는 값: 마지막 출고일 · 전체 출고 끝)
//                lots: [{ id, no, startDate(투입), endDate(완료예정), status, notes,
//                         dyeKg(배색량 — 염색소에 배색할 생지 kg, 2026-10-14),
//                         inspections: [{ id, startDate(예상 시작일), endDate(예상 종료일), events: [{ id, status, date }], notes }] }]
//                  (외관검사 — LOT별 1차·2차… [0] = 1차. 탕·수량·롤은 예전 값만 남음)
//                testReport: { needed(시험성적서 체크), expectedDate(발행 예상일), events: [{ id, status, date }] }
//                brandConfirm: { events: [{ id, status('sent'|'confirmed'|'rejected'), date }] }
//                  (상태 드롭다운을 바꿀 때마다 그날 날짜로 한 줄 — 마지막 줄 = 지금 상태. 예전 confirmRounds 는 자동 변환)
//                shipDate, shipDone, notes, legacyYd? }]
//     dailyNotes: [{ id, date, colorId(''=오더 전체), text, tone }]
//     provisionalDue: { yarn, knitting, dyeing, visual_inspection }   // 가납기 ('YYYY-MM-DD', '' = 없음)
//     provisionalPlan: { base: 기준일, days: { yarn, knitting, dyeing, visual_inspection } }  // 가납기 일수 (null = 날짜만)
//       가납기 = 앞 공정 가납기(첫 공정은 기준일) + 일수 (대표님 요청 2026-10-11) — 기준일이 비면 오더 등록일
//     changeLog, createdBy, createdAt, updatedAt
//   }
//
// ■ 기존(v7 이전) 오더는 normalizeOrder()가 읽을 때 자동 변환한다.
//   - 차수(batches) 날짜를 합쳐 공정 전체 일정으로 (가장 빠른 시작 ~ 가장 늦은 종료)
//   - 염가공 차수의 컬러별 항목 → 컬러별 LOT
//   - 레거시 필드(processes, quantityYd 등)는 문서에 그대로 남겨둔다 (삭제하지 않음)
//   - 변환은 결정적(deterministic): 같은 문서는 항상 같은 id로 변환되어 화면 key가 흔들리지 않음

import {
  ORDER_STEPS, ORDER_STEP_KEYS, DEFAULT_LOSS_RATE,
  normalizeStatus, getStatusLabel, getStepMeta, getStepDefs, withPresettingStep, ORDER_TYPES, ORDER_STATUSES,
  PROVISIONAL_DUE_STEPS, PROVISIONAL_DUE_KEYS, PROCESS_THEME, isCustomStepKey,
  TEST_REPORT_STATUSES, BRAND_CONFIRM_STATUSES, INSPECTION_STATUSES, findStatusMeta,
  DEFAULT_DYE_METHOD, DYE_METHODS, CLOSING_ITEMS, CLOSING_KEYS, KG_CONVERSION_COEFFICIENT, PRESETTING_KEY,
} from '../constants/production';
import { addDaysYmd, diffDaysYmd, todayYmd, toYmd, round1, calcKgFromYd, shortDate, fmtKg } from './orderCalculations';

// v9 (2026-10-11): 컬러별 외관검사 · 생지 출고 기록(전체/부분) · 시험성적서/브랜드 컨펌 상태 기록 · 편직 기계 · 가납기 일수
// v10 (2026-10-14): 외관검사 LOT별 1차·2차 · LOT 배색량 · 선염/후염(후염 = 생지 출고 오더에 한 번) · 생지 출고 kg ·
//                   오더 마무리 체크 · 프리세팅은 LOT 창에서
//  예전 문서는 읽을 때 자동으로 맞춤 (오더 단위 외관검사 → 컬러별 → LOT별, 예전 컨펌 라운드 → 상태 기록)
export const ORDER_SCHEMA_VERSION = 10;

// 공정 목록 기본값 (추가 공정이 없을 때 — 프리세팅은 LOT 창에서 관리하므로 빠짐)
const DEFAULT_STEP_DEFS = getStepDefs([]);

// ============================================================
// 1. 빈 구조 생성
// ============================================================
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const STEP_DEFAULTS = { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '' };

// 배열 칸은 공정마다 새로 만듦 (같은 배열을 여러 공정이 나눠 쓰지 않게)
export const createStep = (key) => (
  key === 'knitting'
    ? { ...STEP_DEFAULTS, endHistory: [], dailyKg: null, machines: [] }
    : { ...STEP_DEFAULTS, endHistory: [] }
);

// 편직 기계 한 대 (일일 생산량 kg)
export const createMachine = (name = '', dailyKg = null) => ({ id: uid('mc'), name, dailyKg });

export const createSteps = () => Object.fromEntries(ORDER_STEP_KEYS.map(k => [k, createStep(k)]));

const COLOR_DEFAULTS = {
  name: '',
  orderKg: null,
  workKg: null,          // null = 자동(오더kg × (1 + 로스율)), 숫자 = 직접 입력값
  greigeOuts: [],        // 생지 출고 기록 (편직처 → 염색소) [{ id, date, kind, memo, done }]
  greigeOutDate: '',     // ↑ 에서 계산 (마지막 출고일) — 예전 화면·리포트 호환
  greigeOutDone: false,  // ↑ 에서 계산 (전체 출고 끝)
  lots: [],
  confirmRounds: [],     // 예전 브랜드 컨펌 라운드 (읽기 전용 — brandConfirm 으로 변환)
  shipDate: '',
  shipDone: false,
  notes: '',
};

// 시험성적서 · 브랜드 컨펌 빈 값 (컬러마다 새 객체)
export const createTestReport = () => ({ needed: false, expectedDate: '', events: [] });
export const createBrandConfirm = () => ({ events: [] });

export const createColor = (name = '') => ({
  ...COLOR_DEFAULTS, id: uid('col'), name, greigeOuts: [], lots: [], confirmRounds: [],
  testReport: createTestReport(), brandConfirm: createBrandConfirm(),
});

// 상태 기록 한 줄 (드롭다운을 바꾼 날 — 고칠 수 있음)
export const createStatusEvent = (status, date = todayYmd()) => ({ id: uid('ev'), status, date });

// 상태 기록 종류별 상태 목록 (칸 이름 → 상태 목록). inspection = LOT 외관검사 차수의 기록
export const TRACK_STATUSES = {
  testReport: TEST_REPORT_STATUSES,
  brandConfirm: BRAND_CONFIRM_STATUSES,
  inspection: INSPECTION_STATUSES,
};

// 생지 출고 한 번 (첫 출고는 '전체', 그 뒤는 '부분'이 보통). kg = 그 출고 생지 무게 (모르면 비워 둠)
export const createGreigeOut = (kind = 'full', date = '') => ({ id: uid('go'), date, kind, memo: '', done: false, kg: null });

// LOT 기본값 — machineKg·qtyKg·rolls 는 예전 오더 값만 그대로 남김 (화면에서는 안 씀)
//  dyeKg = 배색량 (염색소에 배색할 생지 kg — 대표님 요청 2026-10-14) / inspections = 외관검사 차수 (1차·2차…)
const LOT_DEFAULTS = { no: 1, machineKg: null, qtyKg: null, startDate: '', endDate: '', status: 'pending', rolls: null, notes: '', dyeKg: null };

export const createLot = (no = 1, startDate = '') => ({ ...LOT_DEFAULTS, id: uid('lot'), no, startDate, inspections: [] });

// 외관검사 한 차수 (LOT 마다 1차 · 2차 …)
export const createInspectionRound = () => ({ id: uid('ir'), startDate: '', endDate: '', events: [], notes: '' });

// 오더 마무리 체크 빈 값 { yarnStock: { done, date, memo }, … }
export const createClosing = () => Object.fromEntries(CLOSING_KEYS.map(k => [k, { done: false, date: '', memo: '' }]));

// 가납기 빈 값 { yarn: '', knitting: '', dyeing: '', visual_inspection: '' }
export const createProvisionalDue = () => Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => [k, '']));

// 가납기 일수 빈 값 { base: '', days: { yarn: null, … } }
export const createProvisionalPlan = () => ({
  base: '',
  days: Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => [k, null])),
});

// 새 오더 (현황표 [+ 오더 추가]) — order#를 입력해야 저장된다
export const createEmptyOrder = (userEmail = '') => {
  const now = new Date().toISOString();
  return {
    id: uid('ord'),
    schemaVersion: ORDER_SCHEMA_VERSION,
    orderNumber: '',
    articleNo: '',
    detail: '',
    customer: '',
    type: 'main',
    finalDueDate: '',
    lossRate: DEFAULT_LOSS_RATE,
    status: 'active',
    notes: '',
    linkedFabricId: null,
    linkedFabricArticle: '',
    linkedSheetId: null,
    dropInfo: null,
    dyeVendor: '',
    inspectVendor: '',
    dyeMethod: DEFAULT_DYE_METHOD,   // 새 오더는 후염 (대표님 결정 2026-10-14)
    greigeOuts: [],
    closing: createClosing(),
    closingAuto: null,
    steps: createSteps(),
    colors: [createColor('')],
    dailyNotes: [],
    provisionalDue: createProvisionalDue(),
    provisionalPlan: createProvisionalPlan(),
    changeLog: [],
    createdBy: userEmail || '',
    createdAt: now,
    updatedAt: now,
  };
};

// ============================================================
// 2. 정규화 (v8 문서 기본값 채우기 + 레거시 자동 변환)
// ============================================================
const str = (v) => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(typeof v === 'string' ? v.replace(/,/g, '').trim() : v);
  return typeof v === 'string' && !v.trim() ? null : (Number.isFinite(n) ? n : null);
};
const sameName = (a, b) => str(a).trim().toLowerCase() === str(b).trim().toLowerCase();
const maxYmd = (list) => list.filter(Boolean).sort().pop() || '';
const minYmd = (list) => list.filter(Boolean).sort()[0] || '';
const normalizeOrderStatus = (s) => (s === 'completed' ? 'completed' : s === 'on_hold' ? 'on_hold' : 'active');

// 설계서 Drop으로 닫힌 샘플 표시 { prevStatus, at } — '완료'로 닫힌 오더에만 남김 (그 밖은 null)
const normalizeDropInfo = (raw, status) => {
  if (status !== 'completed' || !raw || typeof raw !== 'object') return null;
  return { prevStatus: normalizeOrderStatus(raw.prevStatus), at: str(raw.at) };
};

// 예전 예상 종료일 기록 [{ date, at }] — 날짜가 없는 줄은 버림
const normalizeEndHistory = (list) => (Array.isArray(list) ? list : [])
  .filter(h => h && typeof h === 'object' && str(h.date))
  .map(h => ({ date: str(h.date), at: str(h.at) }));

// 편직 기계 목록 [{ id, name, dailyKg }] — 이름도 생산량도 없는 줄은 버림, 생산량은 0보다 큰 숫자만
const cleanMachines = (list, idBase = 'mc') => (Array.isArray(list) ? list : [])
  .filter(m => m && typeof m === 'object')
  .map((m, i) => {
    const kg = numOrNull(m.dailyKg);
    return { id: m.id || `${idBase}_m${i}`, name: str(m.name).trim(), dailyKg: kg !== null && kg > 0 ? kg : null };
  })
  .filter(m => m.name || m.dailyKg !== null);

// 기계 일일 생산량 합계 (넣은 기계가 없으면 null)
export const sumMachinesKg = (machines) => {
  const list = (machines || []).map(m => numOrNull(m?.dailyKg)).filter(v => v !== null && v > 0);
  return list.length ? round1(list.reduce((s, v) => s + v, 0)) : null;
};

// idBase: 기계 id 를 만들 기준 (같은 문서는 항상 같은 id → 화면 key 가 흔들리지 않게)
const normalizeStep = (key, raw, idBase = key) => {
  const base = createStep(key);
  const s = raw && typeof raw === 'object' ? raw : {};
  const out = {
    ...base,
    ...s,
    vendor: str(s.vendor),
    startDate: str(s.startDate),
    endDate: str(s.endDate),
    status: normalizeStatus(s.status),
    doneDate: str(s.doneDate),
    notes: str(s.notes),
    endHistory: normalizeEndHistory(s.endHistory),
  };
  if (key === 'knitting') {
    // 예전 오더(기계 목록 없이 일일 생산량 하나) → '1호기' 한 대로
    //  기계가 하나도 없는데 일일 생산량이 남아 있으면 예전 값 (v9 에서는 기계를 다 빼면 일일 생산량도 null 이 됨)
    let machines = cleanMachines(s.machines, idBase);
    const legacy = numOrNull(s.dailyKg);
    if (!machines.length && legacy !== null && legacy > 0) {
      machines = [{ id: `${idBase}_m0`, name: '1호기', dailyKg: legacy }];
    }
    out.machines = machines;
    out.dailyKg = sumMachinesKg(machines);
  }
  return out;
};

// 0 보다 큰 숫자만 (그 밖은 null) — 배색량 · 생지 출고 kg
const positiveOrNull = (v) => {
  const n = numOrNull(v);
  return n !== null && n > 0 ? n : null;
};

// 상태 기록 정리 — 그 칸에 없는 상태는 버림 (id 가 없으면 결정적으로 만듦)
const normalizeEvents = (list, track, idBase) => {
  const allowed = (TRACK_STATUSES[track] || []).map(s => s.key);
  return (Array.isArray(list) ? list : [])
    .filter(e => e && typeof e === 'object' && allowed.includes(e.status))
    .map((e, i) => ({ id: e.id || `${idBase}_e${i}`, status: e.status, date: str(e.date) }));
};

// LOT 외관검사 차수 정리 (1차 · 2차 … — 빈 차수도 남김: 대표님이 일부러 추가했거나 '재가공'으로 생긴 다음 차수)
const normalizeRounds = (list, lotId) => (Array.isArray(list) ? list : [])
  .filter(r => r && typeof r === 'object')
  .map((r, i) => {
    const id = r.id || `${lotId}_r${i}`;
    return {
      id,
      startDate: str(r.startDate),
      endDate: str(r.endDate),
      events: normalizeEvents(r.events, 'inspection', id),
      notes: str(r.notes),
    };
  });

const normalizeLot = (raw, fallbackId, index) => {
  const l = raw && typeof raw === 'object' ? raw : {};
  const id = l.id || fallbackId;
  return {
    ...LOT_DEFAULTS,
    ...l,
    id,
    no: numOrNull(l.no) ?? index + 1,
    machineKg: numOrNull(l.machineKg),
    qtyKg: numOrNull(l.qtyKg),
    startDate: str(l.startDate),
    endDate: str(l.endDate),
    status: normalizeStatus(l.status),
    rolls: numOrNull(l.rolls),
    notes: str(l.notes),
    dyeKg: positiveOrNull(l.dyeKg),
    inspections: normalizeRounds(l.inspections, id),
  };
};

// 생지 출고 목록 정리 [{ id, date, kind, memo, done, kg }]
const cleanGreigeList = (list, idBase) => (Array.isArray(list) ? list : [])
  .filter(g => g && typeof g === 'object')
  .map((g, i) => ({
    id: g.id || `${idBase}_g${i}`,
    date: str(g.date),
    kind: g.kind === 'partial' ? 'partial' : 'full',
    memo: str(g.memo),
    done: !!g.done,
    kg: positiveOrNull(g.kg),
  }));

// 컬러 생지 출고 기록 정리 — 예전 오더(출고일·출고 체크 한 칸)는 '전체 출고' 한 줄로
const normalizeGreigeOuts = (c, colorId) => {
  if (Array.isArray(c.greigeOuts)) return cleanGreigeList(c.greigeOuts, colorId);
  if (str(c.greigeOutDate) || c.greigeOutDone) {
    return [{ id: `${colorId}_g0`, date: str(c.greigeOutDate), kind: 'full', memo: '', done: !!c.greigeOutDone, kg: null }];
  }
  return [];
};

const sumKg = (list) => {
  const kgs = list.map(g => positiveOrNull(g.kg)).filter(v => v !== null);
  return kgs.length ? round1(kgs.reduce((s, v) => s + v, 0)) : null;
};

// 생지 출고 상태 { entries, fullDone(전체 출고 끝), partialDone(부분만 나감), lastDate(마지막 출고·예정일), doneCount,
//                 doneKg(출고 체크한 kg 합계), totalKg(적어 둔 kg 합계 — 예정 포함), null = kg 안 적음 }
//  holder: 컬러 또는 { greigeOuts } (후염 오더는 오더 — getGreigeStateFor)
export const getGreigeState = (holder) => {
  const entries = holder?.greigeOuts || [];
  const done = entries.filter(g => g.done);
  const fullDone = done.some(g => g.kind === 'full');
  return {
    entries,
    fullDone,
    partialDone: !fullDone && done.length > 0,
    lastDate: maxYmd(entries.map(g => g.date)),
    doneCount: done.length,
    doneKg: sumKg(done),
    totalKg: sumKg(entries),
  };
};

// 후염 오더인지 (생지 출고를 오더에 한 번 — 대표님 요청 2026-10-14)
export const isPieceDyed = (order) => order?.dyeMethod === 'piece';

// 그 컬러의 생지 출고 상태 — 후염 오더는 오더 전체 출고 기록, 그 밖(선염·안 고름)은 컬러 기록
export const getGreigeStateFor = (order, color) => getGreigeState(isPieceDyed(order) ? order : color);

// greigeOuts → 예전 칸(greigeOutDate · greigeOutDone) 맞추기
const withGreigeSummary = (color) => {
  const st = getGreigeState(color);
  return { ...color, greigeOutDate: st.lastDate, greigeOutDone: st.fullDone };
};

const normalizeTestReport = (raw, idBase) => {
  const t = raw && typeof raw === 'object' ? raw : {};
  return { needed: !!t.needed, expectedDate: str(t.expectedDate), events: normalizeEvents(t.events, 'testReport', `${idBase}_t`) };
};

// 브랜드 컨펌 — 예전 1차·2차 라운드(발송일·결과일·합격/불합격)는 전달 → 컨펌/리젝 기록으로
const normalizeBrandConfirm = (raw, c, idBase) => {
  if (raw && typeof raw === 'object') {
    return { events: normalizeEvents(raw.events, 'brandConfirm', `${idBase}_b`) };
  }
  const events = [];
  (Array.isArray(c.confirmRounds) ? c.confirmRounds : []).forEach(r => {
    if (!r) return;
    if (str(r.sentDate)) events.push({ status: 'sent', date: str(r.sentDate) });
    if (r.result === 'pass') events.push({ status: 'confirmed', date: str(r.resultDate) });
    if (r.result === 'fail') events.push({ status: 'rejected', date: str(r.resultDate) });
  });
  return { events: normalizeEvents(events, 'brandConfirm', `${idBase}_b`) };
};

// 예전(v9) 컬러별 외관검사 정리 — 읽을 때 LOT 외관검사(1차)로 옮기기 전까지만
const normalizeInspection = (raw, idBase) => {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    startDate: str(t.startDate),
    endDate: str(t.endDate),
    events: normalizeEvents(t.events, 'inspection', `${idBase}_i`),
    notes: str(t.notes),
  };
};

// 예전 컬러별 외관검사에 입력이 있는지 (투입일·종료예정일·상태·메모 중 하나라도)
const legacyInspectionHasData = (i) => !!(i && (i.startDate || i.endDate || (i.events || []).length || i.notes));

/**
 * 예전(v9) 컬러별 외관검사 → 그 컬러 LOT 마다 1차 검사로 (대표님 요청 2026-10-14 'LOT마다 1차 2차')
 *  · LOT 가 있으면 외관검사 기록이 없는 LOT 마다 같은 값 (상태 기록까지)
 *  · LOT 가 없던 컬러는 상태 기록이 있을 때만 LOT1 을 만들어 옮김 (검사를 했으면 염색은 끝난 것 — 완료)
 *    예상 일정·메모만 있던 컬러는 LOT 를 만들지 않고 예전 값을 inspectionV9 에 보관 (화면엔 안 보임 — 아직 염색 전이라
 *    LOT 가 생기면 그때 LOT 마다 계획. 빈 LOT1 이 생겨 'LOT 1개'·염가공 미완료로 보이지 않게 — 2026-10-14 검토)
 *  · migrate=false(v10 문서)면 컬러 칸만 지움. id 는 결정적 (같은 문서는 항상 같은 id)
 */
const moveColorInspectionToLots = (color, migrate) => {
  const { inspection, ...rest } = color;
  if (!migrate || !legacyInspectionHasData(inspection)) return rest;
  if (!(rest.lots || []).length && !(inspection.events || []).length) {
    return { ...rest, inspectionV9: { startDate: inspection.startDate, endDate: inspection.endDate, notes: inspection.notes } };
  }
  const roundFor = (lotId) => ({
    id: `${lotId}_r0`,
    startDate: inspection.startDate,
    endDate: inspection.endDate,
    notes: inspection.notes,
    events: (inspection.events || []).map((e, i) => ({ id: `${lotId}_r0_e${i}`, status: e.status, date: e.date })),
  });
  const lots = rest.lots || [];
  if (!lots.length) {
    const lotId = `${color.id}_l0`;
    const status = (inspection.events || []).length ? 'done' : 'pending';
    return { ...rest, lots: [normalizeLot({ id: lotId, no: 1, status, inspections: [roundFor(lotId)] }, lotId, 0)] };
  }
  return {
    ...rest,
    lots: lots.map(l => ((l.inspections || []).length ? l : { ...l, inspections: normalizeRounds([roundFor(l.id)], l.id) })),
  };
};

// 예전 오더 단위 외관검사(공정 칸) → 컬러 외관검사 모양 (v8 이전 오더를 읽을 때 — 입력이 없으면 null)
const legacyInspectionOf = (step) => {
  if (!step || typeof step !== 'object') return null;
  const st = normalizeStatus(step.status);
  if (!(step.startDate || step.endDate || step.notes || step.vendor || st !== 'pending')) return null;
  const events = [];
  if (st === 'in_progress') events.push({ status: 'inspecting', date: str(step.startDate) });
  if (st === 'issue') events.push({ status: 'defect', date: str(step.endDate || step.startDate) });
  if (st === 'done') events.push({ status: 'ready', date: str(step.doneDate || step.endDate) });
  return { startDate: str(step.startDate), endDate: str(step.endDate), events, notes: str(step.notes) };
};

const normalizeColor = (raw, fallbackId) => {
  const c = raw && typeof raw === 'object' ? raw : {};
  const id = c.id || fallbackId;
  const greigeOuts = normalizeGreigeOuts(c, id);
  const greige = getGreigeState({ greigeOuts });
  return {
    ...COLOR_DEFAULTS,
    ...c,
    id,
    name: str(c.name),
    orderKg: numOrNull(c.orderKg),
    workKg: numOrNull(c.workKg),
    greigeOuts,
    greigeOutDate: greige.lastDate,
    greigeOutDone: greige.fullDone,
    lots: (Array.isArray(c.lots) ? c.lots : []).map((l, li) => normalizeLot(l, `${id}_l${li}`, li)),
    confirmRounds: (Array.isArray(c.confirmRounds) ? c.confirmRounds : []).map((r, ri) => ({
      round: numOrNull(r?.round) ?? ri + 1,
      sentDate: str(r?.sentDate),
      resultDate: str(r?.resultDate),
      result: r?.result === 'pass' || r?.result === 'fail' ? r.result : '',
    })),
    testReport: normalizeTestReport(c.testReport, id),
    brandConfirm: normalizeBrandConfirm(c.brandConfirm, c, id),
    inspection: normalizeInspection(c.inspection, id),
    shipDate: str(c.shipDate),
    shipDone: !!c.shipDone,
    // 외관검사 '출고완료'가 출고 칸을 자동으로 체크했을 때 { filledDate: 그때 채운 출고일('' = 원래 있던 날짜) } — 되돌릴 때 씀
    shipAuto: c.shipAuto && typeof c.shipAuto === 'object' ? { filledDate: str(c.shipAuto.filledDate) } : null,
    notes: str(c.notes),
  };
};

// 오더 마무리 체크 { yarnStock: { done, date, memo }, … } (예전 오더는 모두 빈칸)
const normalizeClosing = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(CLOSING_KEYS.map(k => {
    const it = src[k] && typeof src[k] === 'object' ? src[k] : {};
    return [k, { done: !!it.done, date: str(it.date), memo: str(it.memo) }];
  }));
};

// 마무리 체크로 자동 '완료'된 표시 — '완료'인 오더에만 남김
const normalizeClosingAuto = (raw, status) => {
  if (status !== 'completed' || !raw || typeof raw !== 'object') return null;
  return { prevStatus: raw.prevStatus === 'on_hold' ? 'on_hold' : 'active', at: str(raw.at) };
};

const normalizeDyeMethod = (v) => (DYE_METHODS.some(m => m.key === v) ? v : '');

// 가납기: 정해진 4공정만, 날짜 글자로 (예전 오더는 없음 → 모두 빈칸)
const normalizeProvisionalDue = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => [k, str(src[k])]));
};

// 가납기 일수: 0 이상 정수만 (그 밖은 null = 일수 안 씀)
const normalizeProvisionalPlan = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const days = src.days && typeof src.days === 'object' ? src.days : {};
  return {
    base: str(src.base),
    days: Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => {
      const n = numOrNull(days[k]);
      return [k, n !== null && n >= 0 ? Math.round(n) : null];
    })),
  };
};

const normalizeV8 = (raw) => {
  const id = raw.id;
  const steps = Object.fromEntries(ORDER_STEP_KEYS.map(k => [k, normalizeStep(k, raw.steps?.[k], `${id}_${k}`)]));
  // 추가 공정(cs_…) 값도 그대로 정리해서 남김 (설정에서 지운 공정도 문서의 값은 지우지 않음)
  Object.keys(raw.steps || {}).filter(isCustomStepKey).forEach(k => {
    steps[k] = normalizeStep(k, raw.steps[k], `${id}_${k}`);
  });
  let colors = (Array.isArray(raw.colors) ? raw.colors : []).map((c, i) => normalizeColor(c, `${id}_c${i}`));
  if (colors.length === 0) colors = [normalizeColor({}, `${id}_c0`)];
  // v8 이전 오더: 오더 단위 외관검사 → 컬러별로 (아래에서 다시 LOT 별로)
  //  · 입력이 있는 컬러에만 (없으면 첫 줄) — 빈 컬러 줄에 일정이 생겨 남은 일·가납기가 늘지 않게
  //  · 일정·메모는 모두에게, 상태는 이미 출고했거나 LOT 이 모두 끝난 컬러에만 (염색 중인 컬러가 '검사중'으로 보이지 않게)
  const schema = Number(raw.schemaVersion) || 0;
  const isV9 = schema >= 9;
  const legacyInsp = isV9 ? null : legacyInspectionOf(raw.steps?.visual_inspection);
  if (legacyInsp) {
    const withData = colors.filter(colorHasData);
    const targets = new Set((withData.length ? withData : colors.slice(0, 1)).map(c => c.id));
    colors = colors.map(c => {
      if (!targets.has(c.id) || legacyInspectionHasData(c.inspection)) return c;
      const lots = c.lots || [];
      const finished = c.shipDone || (lots.length > 0 && lots.every(l => normalizeStatus(l.status) === 'done'));
      return { ...c, inspection: normalizeInspection({ ...legacyInsp, events: finished ? legacyInsp.events : [] }, c.id) };
    });
  }
  // v10 전 오더: 컬러별 외관검사 → LOT 마다 1차 검사로 (v10 문서는 컬러 칸만 지움)
  colors = colors.map(c => moveColorInspectionToLots(c, schema < 10));
  const lossRate = numOrNull(raw.lossRate);
  const status = normalizeOrderStatus(raw.status);
  const { newerSchema: _oldFlag, ...rest } = raw;
  return {
    ...rest,
    // 이 화면보다 새 형식으로 저장된 오더 (다른 PC가 새 버전) — useOrder 가 수정을 막음 (새로고침 안내)
    ...(Number(raw.schemaVersion) > ORDER_SCHEMA_VERSION ? { newerSchema: true } : {}),
    schemaVersion: ORDER_SCHEMA_VERSION,
    orderNumber: str(raw.orderNumber),
    articleNo: str(raw.articleNo),
    detail: str(raw.detail),
    customer: str(raw.customer),
    type: raw.type === 'sample' ? 'sample' : 'main',
    finalDueDate: str(raw.finalDueDate),
    lossRate: lossRate === null ? DEFAULT_LOSS_RATE : lossRate,
    status,
    notes: str(raw.notes),
    linkedFabricId: raw.linkedFabricId || null,
    linkedFabricArticle: str(raw.linkedFabricArticle),
    linkedSheetId: raw.linkedSheetId || null,
    dropInfo: normalizeDropInfo(raw.dropInfo, status),
    dyeVendor: str(raw.dyeVendor),
    inspectVendor: str(raw.inspectVendor) || (isV9 ? '' : str(raw.steps?.visual_inspection?.vendor)),
    dyeMethod: normalizeDyeMethod(raw.dyeMethod),   // 예전 오더는 '' (안 고름 — 컬러마다 출고)
    greigeOuts: cleanGreigeList(raw.greigeOuts, `${id}_o`),
    closing: normalizeClosing(raw.closing),
    closingAuto: normalizeClosingAuto(raw.closingAuto, status),
    steps,
    colors,
    dailyNotes: (Array.isArray(raw.dailyNotes) ? raw.dailyNotes : [])
      .filter(n => n && n.date)
      .map((n, i) => ({ id: n.id || `${id}_n${i}`, date: str(n.date), colorId: str(n.colorId), text: str(n.text), tone: str(n.tone) })),
    provisionalDue: normalizeProvisionalDue(raw.provisionalDue),
    provisionalPlan: normalizeProvisionalPlan(raw.provisionalPlan),
    changeLog: Array.isArray(raw.changeLog) ? raw.changeLog : [],
  };
};

// ---------- 레거시(v7 이전) 변환 ----------

// v3~v7 공정 체인: startDate 비면 이전 활성 공정 종료일, 종료일 = 시작 + durationDays
const legacyEnrich = (processes) => {
  const sorted = processes
    .filter(p => p && p.isActive)
    .slice()
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  const map = {};
  let prevEnd = '';
  sorted.forEach(p => {
    const effectiveStart = p.startDate || prevEnd || '';
    const dur = Number(p.durationDays) || 0;
    const effectiveEnd = effectiveStart && dur > 0 ? addDaysYmd(effectiveStart, dur) : '';
    if (effectiveEnd) prevEnd = effectiveEnd;
    map[p.processType] = { ...p, effectiveStart, effectiveEnd };
  });
  return map;
};

// 여러 상태 → 하나로: 문제 우선, 전부 완료면 완료, 하나라도 진행/완료면 진행중
const aggregateStatus = (statuses) => {
  if (!statuses.length) return 'pending';
  if (statuses.includes('issue')) return 'issue';
  if (statuses.every(s => s === 'done')) return 'done';
  if (statuses.some(s => s === 'in_progress' || s === 'done')) return 'in_progress';
  return 'pending';
};

const legacyStep = (key, p) => {
  const step = createStep(key);
  if (!p) return step;

  if (key === 'yarn') {
    const yarnOrders = Array.isArray(p.yarnOrders) ? p.yarnOrders : [];
    const deliveries = yarnOrders.filter(y => !y.useKnitterStock).flatMap(y => y.deliveries || []);
    const arrival = deliveries.map(d => d.actualArrivalDate || d.expectedArrivalDate || d.plannedArrivalDate);
    const statuses = deliveries.map(d => normalizeStatus(d.status));
    step.startDate = str(p.startDate || p.effectiveStart);
    step.endDate = maxYmd(arrival) || str(p.effectiveEnd);
    step.status = aggregateStatus(statuses);
    step.doneDate = step.status === 'done' ? maxYmd(deliveries.map(d => d.actualArrivalDate)) : '';
    step.vendor = [...new Set(yarnOrders.map(y => str(y.supplier).trim()).filter(Boolean))].join(', ');
    step.notes = yarnOrders
      .map(y => `${y.yarnTypeName || '사종'}${y.totalQuantity ? ` ${y.totalQuantity}kg` : ''}${y.useKnitterStock ? '(편직처 보유)' : ''}`)
      .join(', ');
    return step;
  }

  const batches = Array.isArray(p.batches) ? p.batches : [];
  const starts = batches.map(b => b.actualStartDate || b.plannedStartDate);
  const ends = batches.map(b => b.actualEndDate || b.expectedEndDate || b.plannedEndDate);
  step.startDate = minYmd(starts) || str(p.startDate || p.effectiveStart);
  step.endDate = maxYmd(ends) || str(p.effectiveEnd);
  step.status = aggregateStatus(batches.map(b => normalizeStatus(b.status)));
  step.doneDate = step.status === 'done' ? maxYmd(batches.map(b => b.actualEndDate)) : '';
  step.notes = batches
    .map(b => [b.notes, b.delayReason].map(str).filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' / ');
  if (key === 'knitting') {
    const caps = batches.map(b => numOrNull(b.dailyCapacityOverride)).filter(v => v);
    step.dailyKg = caps.length ? caps[0] : null;
  }
  return step;
};

const migrateLegacy = (raw) => {
  const id = raw.id;
  const processes = Array.isArray(raw.processes) ? raw.processes : [];
  const eff = legacyEnrich(processes);

  const steps = Object.fromEntries(ORDER_STEP_KEYS.map(k => [k, legacyStep(k, eff[k])]));
  // 예전 외관검사 공정 → normalizeV8 이 컬러별 외관검사로 옮김
  if (eff.visual_inspection) steps.visual_inspection = legacyStep('visual_inspection', eff.visual_inspection);

  // 컬러 수량 단위
  //  - v2~v7: quantityYd(오더 전체 YD) + colors[].quantity(YD) → gsm·폭이 있을 때만 KG 환산, 원래 YD는 legacyYd로 보존
  //  - 1단계(최초) 오더: quantityYd 없이 totalQuantity + unit('kg'|'yd'), colors[].quantity 도 그 단위
  //    unit 이 kg 이면 그대로 오더kg 로 사용 (YD 로 잘못 표시하지 않음)
  const hasYd = raw.quantityYd !== undefined && raw.quantityYd !== null;
  const hasV1Total = !hasYd && raw.totalQuantity !== undefined && raw.totalQuantity !== null;
  const v1Kg = hasV1Total && str(raw.unit || 'kg').trim().toLowerCase() !== 'yd';
  const totalYd = hasYd ? raw.quantityYd : (hasV1Total && !v1Kg ? raw.totalQuantity : null);
  const legacyColors = Array.isArray(raw.colors) ? raw.colors : [];
  let colors;
  if (legacyColors.length === 0) {
    const kg = v1Kg
      ? numOrNull(raw.totalQuantity) || null
      : numOrNull(raw.quantityKg) || calcKgFromYd(totalYd, raw.gsm, raw.widthFull) || null;
    colors = [normalizeColor({ name: '', orderKg: kg, legacyYd: v1Kg ? null : numOrNull(totalYd) }, `${id}_c0`)];
  } else {
    colors = legacyColors.map((c, i) => normalizeColor({
      name: str(c?.name ?? c?.color),
      orderKg: v1Kg
        ? numOrNull(c?.quantity) || null
        : calcKgFromYd(c?.quantity, raw.gsm, raw.widthFull) || null,
      legacyYd: v1Kg ? null : numOrNull(c?.quantity),
    }, `${id}_c${i}`));
  }

  // 염가공 차수 → 컬러별 LOT (+ 컬러별 브랜드 컨펌 / Shipping Sample)
  const dye = eff.dyeing;
  if (dye) {
    const lotsByColor = new Map(colors.map(c => [c.id, []]));
    const pushLot = (color, lot) => {
      const list = lotsByColor.get(color.id);
      list.push(normalizeLot({ ...lot, no: list.length + 1 }, `${color.id}_l${list.length}`, list.length));
    };
    (dye.batches || []).forEach(b => {
      const bLabel = `구 ${b.batchNumber || ''}차`.trim();
      const bStart = str(b.actualStartDate || b.plannedStartDate || dye.effectiveStart);
      const bEnd = str(b.actualEndDate || b.expectedEndDate || b.plannedEndDate || dye.effectiveEnd);
      const bColors = Array.isArray(b.colors) ? b.colors : [];
      if (bColors.length === 0) {
        pushLot(colors[0], {
          qtyKg: numOrNull(b.quantity),
          startDate: bStart,
          endDate: bEnd,
          status: normalizeStatus(b.status),
          notes: [bLabel + (colors.length > 1 ? ' (컬러 미지정)' : ''), str(b.notes)].filter(Boolean).join(' '),
        });
        return;
      }
      bColors.forEach(bc => {
        const target = colors.find(c => sameName(c.name, bc.color)) || colors[0];
        pushLot(target, {
          qtyKg: numOrNull(bc.quantity),
          startDate: str(bc.plannedStartDate) || bStart,
          endDate: str(bc.actualEndDate || bc.plannedEndDate) || bEnd,
          status: bc.actualEndDate ? 'done' : normalizeStatus(b.status),
          notes: [bLabel, target.name && !sameName(target.name, bc.color) ? `(${bc.color})` : '', str(b.notes)].filter(Boolean).join(' '),
        });
        const idx = colors.findIndex(c => c.id === target.id);
        const rounds = (Array.isArray(bc.brandConfirms) ? bc.brandConfirms : [])
          .filter(r => r && (r.sentDate || r.resultDate || r.result));
        const ship = bc.shippingSample || {};
        colors[idx] = {
          ...colors[idx],
          brandConfirm: null, // 아래에서 붙인 라운드로 normalizeV8 이 다시 만듦 (이미 만든 빈 기록이 남지 않게)
          confirmRounds: [...colors[idx].confirmRounds, ...rounds.map((r, ri) => ({
            round: colors[idx].confirmRounds.length + ri + 1,
            sentDate: str(r.sentDate),
            resultDate: str(r.resultDate),
            result: r.result === 'pass' || r.result === 'fail' ? r.result : '',
          }))],
          shipDate: colors[idx].shipDate || str(ship.sentDate),
          shipDone: colors[idx].shipDone || !!ship.sentDate,
        };
      });
    });
    colors = colors.map(c => ({ ...c, lots: lotsByColor.get(c.id) || [] }));
  }

  return normalizeV8({
    ...raw,                    // 레거시 필드(processes, quantityYd, startStage 등) 보존
    schemaVersion: 8,          // v8 모양으로 만든 뒤 normalizeV8 이 v9 로 (외관검사 → 컬러별)
    migratedFromLegacy: true,
    detail: raw.detail || raw.orderName || '',
    lossRate: DEFAULT_LOSS_RATE,
    dyeVendor: '',
    steps,
    colors,
    dailyNotes: [],
  });
};

/**
 * Firestore에서 읽은 오더 문서를 v8 구조로 정규화.
 * - v8 문서: 누락 필드 기본값 채움
 * - v7 이전 문서: 자동 변환 (원본 레거시 필드는 그대로 유지)
 */
export const normalizeOrder = (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  if (Number(raw.schemaVersion) >= 8) return normalizeV8(raw); // v8 · v9 (v8 은 normalizeV8 안에서 v9 로 맞춤)
  return migrateLegacy(raw);
};

// ============================================================
// 3. 계산 (수량 / 공정 / LOT / 컨펌 / 단계)
// ============================================================

export const getLossRate = (order) => {
  const n = numOrNull(order?.lossRate);
  return n === null ? DEFAULT_LOSS_RATE : n;
};

export const isWorkKgManual = (color) => numOrNull(color?.workKg) !== null;

// 작지수량(KG): 직접 입력값 우선, 없으면 오더수량 × (1 + 로스율)
export const getWorkKg = (color, lossRate) => {
  const manual = numOrNull(color?.workKg);
  if (manual !== null) return manual;
  const orderKg = numOrNull(color?.orderKg);
  if (orderKg === null) return null;
  return round1(orderKg * (1 + (Number(lossRate) || 0) / 100));
};

export const getOrderTotals = (order) => {
  const lossRate = getLossRate(order);
  let orderKg = 0;
  let workKg = 0;
  (order?.colors || []).forEach(c => {
    orderKg += Number(c.orderKg) || 0;
    workKg += Number(getWorkKg(c, lossRate)) || 0;
  });
  return { orderKg: round1(orderKg), workKg: round1(workKg) };
};

// 공정 칸에 뭐라도 입력돼 있으면 "사용하는 공정"
export const isStepUsed = (step) => !!(step && (
  step.vendor || step.startDate || step.endDate || step.notes || step.dailyKg ||
  (step.machines || []).some(m => m?.name || m?.dailyKg) ||
  normalizeStatus(step.status) !== 'pending'
));

// 편직 하루 생산량 (기계별 합계, 예전 오더는 일일 생산량 하나)
//  기계 목록이 있으면 그 합계만 (기계를 다 뺐으면 null), 기계 목록 자체가 없는 예전 값만 일일 생산량 하나
export const getKnittingDailyKg = (step) => (
  Array.isArray(step?.machines) ? sumMachinesKg(step.machines) : numOrNull(step?.dailyKg)
);

/**
 * 편직 소요일 계산 (기계별 일일 생산량 — 대표님 요청 2026-10-11)
 *  daily = 기계 합계 kg/일, total = 총 작지kg, days = 올림(total ÷ daily)
 *  end = 예상 시작일 + days - 1 (시작일이 없으면 '')
 *  반환 { daily, total, days, end } — 계산할 수 없으면 days 0
 */
export const getKnittingPlan = (order, step = order?.steps?.knitting) => {
  const daily = getKnittingDailyKg(step);
  const total = getOrderTotals(order).workKg;
  if (!daily || daily <= 0 || !total) return { daily: daily || null, total, days: 0, end: '' };
  // 소수점 오차 보정 (2.1 ÷ 0.3 = 7.000…01 → 8일이 되지 않게)
  const days = Math.max(1, Math.ceil(total / daily - 1e-9));
  return { daily, total, days, end: step?.startDate ? addDaysYmd(step.startDate, days - 1) : '' };
};

// 편직 계산 종료일: 예상 시작일 + 총 작지kg ÷ 하루 생산량 (예상 종료일을 직접 넣지 않았을 때 참고용)
export const getKnittingEstimatedEnd = (order) => getKnittingPlan(order).end;

// 최초 예상 종료일 비교 — 예상 종료일을 바꾼 적이 있으면 { first: 최초 날짜, current, diff(+ = 늦어짐), count: 바꾼 횟수 }
export const getEndShift = (step) => {
  const hist = step?.endHistory || [];
  if (!hist.length) return null;
  const first = hist[0].date;
  const current = str(step?.endDate);
  return { first, current, diff: current ? diffDaysYmd(first, current) : null, count: hist.length };
};

// 공정 종료일 (직접 입력 우선, 편직은 예상 종료일로 보조)
export const getStepEnd = (order, key) => {
  const step = order?.steps?.[key];
  if (!step) return '';
  if (step.endDate) return step.endDate;
  if (key === 'knitting') return getKnittingEstimatedEnd(order);
  return '';
};

// ---------- LOT ----------
// LOT = 염색기(탕)를 한 번 돌리는 단위. 탕·수량·롤은 쓰지 않음 (대표님 요청 2026-10-11) — 투입일·완료예정·상태·메모
//  + 배색량(염색소에 배색할 생지 kg → LOSS 를 뺀 예상 가공지 kg · 예상 YD — 2026-10-14) + 외관검사 차수

// 컬러의 염가공 상태 (LOT 없으면 null)
export const getLotsStatus = (lots = []) => (lots.length ? aggregateStatus(lots.map(l => normalizeStatus(l.status))) : null);

// LOT 요약 { count, done, inProgress, issue, start(가장 이른 투입), end(가장 늦은 완료예정), dyeKg(배색량 합계, 없으면 null) }
export const getLotOverview = (lots = []) => {
  const st = lots.map(l => normalizeStatus(l.status));
  const kgs = lots.map(l => positiveOrNull(l.dyeKg)).filter(v => v !== null);
  return {
    count: lots.length,
    done: st.filter(x => x === 'done').length,
    inProgress: st.filter(x => x === 'in_progress').length,
    issue: st.filter(x => x === 'issue').length,
    start: minYmd(lots.map(l => l.startDate)),
    end: maxYmd(lots.map(l => l.endDate)),
    dyeKg: kgs.length ? round1(kgs.reduce((s, v) => s + v, 0)) : null,
  };
};

// ---------- 배색량 → 예상 가공지 kg · 예상 YD (대표님 결정 2026-10-14) ----------
//  예상 가공지 kg = 배색량 ÷ (1 + 로스율) — 작지kg(= 오더kg × (1 + 로스율))을 전부 배색하면 정확히 오더kg 이 나오게
//  예상 YD = 예상 가공지 kg ÷ 1야드 무게 (gsm × 전폭(인치) × 0.02322576 g)

// 1야드 무게(g) — 스펙이 없으면 null
export const gramsPerYd = (spec) => {
  const g = positiveOrNull(spec?.gsm);
  const w = positiveOrNull(spec?.widthFull);
  return g && w ? g * w * KG_CONVERSION_COEFFICIENT : null;
};

/**
 * 배색량 → { dyeKg, finishedKg(예상 가공지 kg), yd(예상 YD — 스펙이 없으면 null) } (배색량이 없으면 null)
 *  lossRate: 오더 로스율(%) / spec: { gsm, widthFull } (resolveYieldSpec)
 */
export const getDyeYield = (dyeKg, lossRate, spec) => {
  const kg = positiveOrNull(dyeKg);
  if (kg === null) return null;
  const finished = kg / (1 + (Number(lossRate) || 0) / 100);
  const g = gramsPerYd(spec);
  return { dyeKg: kg, finishedKg: round1(finished), yd: g ? Math.round((finished * 1000) / g) : null };
};

/**
 * 예상 YD 환산에 쓸 원단 스펙 { gsm, widthFull, source(어디서 가져왔는지), kind } — 없으면 null
 *  ① 연결된 원단(원단 보관함) → ② 오더에 저장된 값(LOT 창에서 직접 넣었거나 예전에 고른 원단) → ③ 같은 Article 원단 → ④ 설계서 최종 스펙(샘플)
 */
export const resolveYieldSpec = (order, { linkedFabric = null, articleFabric = null, sheet = null } = {}) => {
  const pick = (gsm, widthFull) => (positiveOrNull(gsm) && positiveOrNull(widthFull)
    ? { gsm: positiveOrNull(gsm), widthFull: positiveOrNull(widthFull) }
    : null);
  const tries = [
    [linkedFabric && pick(linkedFabric.gsm, linkedFabric.widthFull), `원단 보관함 ${str(linkedFabric?.article)}`.trim(), 'fabric'],
    [pick(order?.gsm, order?.widthFull), order?.specManual ? '직접 넣은 값' : '오더에 저장된 값', 'order'],
    [articleFabric && pick(articleFabric.gsm, articleFabric.widthFull), `원단 보관함 ${str(articleFabric?.article)}`.trim(), 'fabric'],
    [sheet && pick(sheet.costInput?.gsm, sheet.costInput?.widthFull), '설계서 최종 스펙', 'sheet'],
  ];
  const hit = tries.find(t => t[0]);
  return hit ? { ...hit[0], source: hit[1], kind: hit[2] } : null;
};

// ---------- LOT 외관검사 (1차 · 2차 … — 대표님 요청 2026-10-14) ----------
//  차수마다 예상 시작일 · 예상 종료일 · 상태 기록 · 메모. 마지막 차수 = 지금 차수, 그 차수의 마지막 기록 = 지금 상태
//  상태 '' (기록 없음) 와 'waiting' 은 둘 다 '투입 전'

const INSPECTION_DONE = ['ready', 'shipped'];

// 차수의 지금 상태 ('' = 기록 없음)
export const getRoundStatus = (round) => {
  const ev = round?.events || [];
  return ev.length ? ev[ev.length - 1].status : '';
};
const isActiveStatus = (s) => !!s && s !== 'waiting';
export const isRoundDone = (round) => INSPECTION_DONE.includes(getRoundStatus(round));
// 차수에 입력이 있는지 (예상 일정 · 기록 · 메모)
export const roundHasData = (round) => !!(round && (round.startDate || round.endDate || (round.events || []).length || round.notes));
// 실제로 검사를 시작한 날 (투입 전이 아닌 첫 기록)
export const getRoundStartedDate = (round) => str((round?.events || []).find(e => isActiveStatus(e.status) && e.date)?.date);
// 검사가 끝난 날 — 마지막 줄부터 거슬러 이어진 출고준비완료·출고완료의 첫 날 (중간에 불량컨펌중이 있었으면 그 뒤)
export const getRoundDoneDate = (round) => {
  const events = round?.events || [];
  let date = '';
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (!INSPECTION_DONE.includes(events[i].status)) break;
    if (events[i].date) date = events[i].date;
  }
  return str(date);
};
// 그 상태를 고른 날 (지금 상태 기록의 날짜)
export const getRoundStatusDate = (round) => {
  const ev = round?.events || [];
  return ev.length ? str(ev[ev.length - 1].date) : '';
};

export const getLotRounds = (lot) => lot?.inspections || [];
export const getLotCurrentRound = (lot) => {
  const rounds = getLotRounds(lot);
  return rounds.length ? rounds[rounds.length - 1] : null;
};
// LOT 의 지금 외관검사 상태 ('' = 차수 없음 또는 기록 없음)
export const getLotInspectionStatus = (lot) => getRoundStatus(getLotCurrentRound(lot));
export const isLotInspectionUsed = (lot) => getLotRounds(lot).length > 0;
export const isLotInspectionDone = (lot) => isRoundDone(getLotCurrentRound(lot));

/**
 * 컬러의 외관검사 요약 (LOT 기준)
 *  rows: [{ lot, round(지금 차수), roundNo, status, used, done, redyeing }]
 *   redyeing: 재가공 중 — 지금 차수가 '재가공'이거나, 앞 차수가 '재가공'이고 지금 차수(2차…)가 아직 투입 전
 *  allDone: LOT 가 모두 출고준비완료·출고완료 / allShipped: LOT 가 모두 출고완료 (→ 컬러 출고 칸 자동 완료)
 */
export const getColorInspection = (color) => {
  const lots = color?.lots || [];
  const rows = lots.map(lot => {
    const rounds = getLotRounds(lot);
    const round = rounds.length ? rounds[rounds.length - 1] : null;
    const status = getRoundStatus(round);
    const prevStatus = rounds.length > 1 ? getRoundStatus(rounds[rounds.length - 2]) : '';
    return {
      lot, round, roundNo: rounds.length, status,
      used: rounds.length > 0,
      done: INSPECTION_DONE.includes(status),
      redyeing: status === 'redye' || (!isActiveStatus(status) && prevStatus === 'redye'),
    };
  });
  return {
    rows,
    used: rows.some(r => r.used),
    allDone: rows.length > 0 && rows.every(r => r.done),
    allShipped: rows.length > 0 && rows.every(r => r.status === 'shipped'),
    doneCount: rows.filter(r => r.done).length,
    shippedCount: rows.filter(r => r.status === 'shipped').length,
    anyDefect: rows.some(r => r.status === 'defect'),
    anyRedye: rows.some(r => r.redyeing),
    anyInspecting: rows.some(r => r.status === 'inspecting'),
  };
};

// 외관검사를 쓰는 컬러인지 (LOT 중 하나라도 검사 차수가 있으면)
export const isInspectionUsed = (color) => (color?.lots || []).some(isLotInspectionUsed);

// ---------- 상태 기록 (시험성적서 · 브랜드 컨펌 …) ----------

// 지금 상태 = 마지막 줄 (없으면 null / '')
export const getTrackEvent = (color, track) => {
  const events = color?.[track]?.events || [];
  return events.length ? events[events.length - 1] : null;
};
export const getTrackStatus = (color, track) => getTrackEvent(color, track)?.status || '';
export const getTrackStatusMeta = (color, track) => findStatusMeta(TRACK_STATUSES[track], getTrackStatus(color, track));

/**
 * 상태 기록 → 차수 (간트 막대 · 요약용)
 *  시작 상태(전달 · 발행중 · 재투입)로 한 차수가 시작되고 결과(컨펌·리젝 / 합격·불합격·재합격)로 끝남
 *  [{ no, start, end, startStatus, result('' = 아직), startEventId }]
 */
export const getTrackRounds = (events, track) => {
  const list = TRACK_STATUSES[track] || [];
  const rounds = [];
  let cur = null;
  (events || []).forEach(e => {
    const meta = findStatusMeta(list, e.status);
    if (!meta) return;
    if (meta.startsRound) {
      if (cur) rounds.push(cur);
      cur = { start: e.date, end: '', startStatus: e.status, result: '', startEventId: e.id };
      return;
    }
    if (!cur) cur = { start: e.date, end: '', startStatus: '', result: '', startEventId: e.id };
    cur.end = e.date;
    cur.result = e.status;
    rounds.push(cur);
    cur = null;
  });
  if (cur) rounds.push(cur);
  return rounds.map((r, i) => ({ ...r, no: i + 1 }));
};

// 시험성적서 합격(재합격 포함)인지 — 체크 안 한 컬러는 성적서가 필요 없으니 true
export const isTestReportPassed = (color) => {
  if (!color?.testReport?.needed) return true;
  const s = getTrackStatus(color, 'testReport');
  return s === 'pass' || s === 'repass';
};

// ---------- 컬러 줄 현재 단계 (COLOR_STAGES 키) ----------
// 컬러별 사실(출고·컨펌·LOT·생지출고) 우선 → 오더 공통 공정(편직·원사) 순으로 판단
export const getColorStage = (order, color) => {
  if (!order || !color) return 'waiting';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'on_hold') return 'on_hold';
  // 출고완료는 출고 칸 기준 (외관검사 '출고완료'를 고르면 출고 칸도 같이 체크됨 — 출고 칸을 손으로 풀면 출고 전으로)
  if (color.shipDone) return 'shipped';

  const steps = order.steps || {};
  const st = (k) => normalizeStatus(steps[k]?.status);
  const lots = color.lots || [];
  const lotSt = lots.map(l => normalizeStatus(l.status));
  const insp = getColorInspection(color);
  const brand = getTrackStatus(color, 'brandConfirm');
  const testNeeded = !!color.testReport?.needed;
  const test = testNeeded ? getTrackStatus(color, 'testReport') : '';
  const testPassed = isTestReportPassed(color);
  const confirmActive = brand === 'sent' || test === 'issuing' || test === 'resubmit'; // 컨펌·성적서 진행 중

  // 대표님이 추가한 공정(cs_…)이 '문제'면 그 오더 컬러 모두 문제 (언제든)
  const customIssue = Object.keys(steps).some(k => isCustomStepKey(k) && st(k) === 'issue');
  if (lotSt.includes('issue') || brand === 'rejected' || test === 'fail' || customIssue) return 'issue';
  // 외관검사 (LOT별 지금 차수) — 불량컨펌중 > 재가공 > (모두 끝) > 검사중
  if (insp.anyDefect) return 'defect';
  if (insp.anyRedye) return 'redye';
  if (insp.allDone) {
    // 검사는 끝났어도 컨펌·성적서가 남았으면 출고 못 함 → 컨펌중 / 컨펌대기
    if (confirmActive) return 'confirm';
    if (!testPassed) return 'confirm_wait';
    return 'ship_wait';
  }
  if (insp.anyInspecting) return 'inspection';
  if (brand === 'confirmed' && testPassed) {
    return insp.used ? 'inspect_wait' : 'ship_wait'; // 외관검사 일정이 있으면 검사대기
  }
  if (confirmActive) return 'confirm';

  const lotsAllDone = lotSt.length > 0 && lotSt.every(s => s === 'done');
  if (lotsAllDone) {
    if (['finishing', 'physical_test'].some(k => st(k) === 'issue')) return 'issue';
    if (st('finishing') === 'in_progress') return 'finishing';
    if (st('physical_test') === 'in_progress') return 'inspection';
    // 후가공 외주처·일정만 입력되고 아직 시작 전 → 후가공대기 / 시험성적서가 아직(체크한 컬러) → 컨펌대기
    if (isStepUsed(steps.finishing) && st('finishing') !== 'done') return 'finish_wait';
    if (!testPassed) return 'confirm_wait';
    return insp.used ? 'inspect_wait' : 'ship_wait';
  }
  if (lotSt.some(s => s === 'in_progress' || s === 'done')) return 'dyeing';
  // 프리세팅 (염색 전 — 염가공 LOT 창에서 관리, 오더 공통 · 2026-10-14): 생지 출고 → 프리세팅중 → 염색중
  if (st(PRESETTING_KEY) === 'issue') return 'issue';
  if (st(PRESETTING_KEY) === 'in_progress') return 'presetting';
  const greige = getGreigeStateFor(order, color);
  if (greige.fullDone) return 'dye_wait';

  if (['yarn', 'yarn_processing', 'knitting'].some(k => st(k) === 'issue')) return 'issue';
  if (st('knitting') === 'in_progress') return 'knitting';
  if (greige.partialDone) return 'greige_partial';
  if (st('knitting') === 'done') return 'greige_wait';
  if (isStepUsed(steps.knitting)) return 'knit_wait';
  if (lots.length) return 'dye_wait';
  if (st('yarn') === 'in_progress' || st('yarn_processing') === 'in_progress') return 'yarn';
  return 'waiting';
};

// 외주처 자동완성 목록 — 마스터 목록(문자열 또는 { name }) + 다른 오더들이 쓴 값 (빈값·중복 제거)
//  pick(order) → 그 오더에서 쓴 값 (예: o => o.steps?.knitting?.vendor), excludeOrderId: 지금 고치는 오더는 빼고
export const collectVendorOptions = (masterList, orders = [], pick = null, excludeOrderId = null) => {
  const fromMaster = (Array.isArray(masterList) ? masterList : []).map(v => (typeof v === 'string' ? v : v?.name));
  const fromOrders = pick ? (orders || []).filter(o => o && o.id !== excludeOrderId).map(pick) : [];
  return [...new Set([...fromMaster, ...fromOrders].map(v => String(v ?? '').trim()).filter(Boolean))];
};

// 납기 D-day (양수 = 남은 일수, 0 = 오늘, 음수 = 지남). 납기 없으면 null
export const getDday = (finalDueDate) => (finalDueDate ? diffDaysYmd(todayYmd(), finalDueDate) : null);

// ---------- 가납기 (대략적인 공정별 목표 날짜 — 원사·편직·염가공·외관검사) ----------

// 외관검사가 끝난 컬러인지 (LOT 가 모두 출고준비완료·출고완료, 또는 출고 칸 완료)
export const isInspectionDone = (color) => !!color?.shipDone || getColorInspection(color).allDone;
// 끝난 날 — LOT 마다 지금 차수가 끝난 날 중 가장 늦은 날 (출고준비완료 → 불량컨펌중 → 출고준비완료 면 마지막 출고준비완료)
//  끝나지 않았으면 출고일 → 가장 늦은 예상 종료일
export const getInspectionDoneDate = (color) => {
  const lots = color?.lots || [];
  if (lots.length && lots.every(isLotInspectionDone)) {
    const d = maxYmd(lots.map(l => getRoundDoneDate(getLotCurrentRound(l))));
    if (d) return d;
  }
  return str(color?.shipDate) || maxYmd(lots.map(l => getLotCurrentRound(l)?.endDate));
};

/**
 * 가납기와 비교할 그 공정의 "현재 날짜".
 *  - 원사·편직: 완료면 완료일(없으면 종료일), 아니면 종료일 (편직은 일일 생산량으로 계산한 예상 종료일도)
 *  - 염가공: 모든 컬러 LOT 중 가장 늦은 완료예정일. LOT 가 전부 완료면 완료
 *    단, 외관검사에서 '재가공'으로 염가공소에 다시 들어간 LOT 가 있으면 아직 완료 아님 (2026-10-14)
 *  - 외관검사: LOT 기준 (아래)
 * 반환 { date('' = 일정 없음), done, estimated(편직 예상 종료) }
 */
export const getStepCurrentEnd = (order, key) => {
  if (key === 'visual_inspection') {
    // 외관검사 (LOT별) — 컬러가 모두 끝나야(LOT 모두 출고준비완료·출고완료 또는 출고) 완료: 가장 늦게 끝난 날
    //  아직이면 안 끝난 LOT 지금 차수의 가장 늦은 예상 종료일 (일정이 없으면 '일정 미입력')
    const colors = (order?.colors || []).filter(colorHasData);
    if (colors.length && colors.every(isInspectionDone)) {
      return { date: maxYmd(colors.map(getInspectionDoneDate)), done: true, estimated: false };
    }
    if (!colors.some(isInspectionUsed)) return { date: '', done: false, estimated: false };
    return {
      date: maxYmd(colors
        .filter(c => !isInspectionDone(c))
        .flatMap(c => (c.lots || []).filter(l => !isLotInspectionDone(l)).map(l => getLotCurrentRound(l)?.endDate))),
      done: false,
      estimated: false,
    };
  }
  if (key === 'dyeing') {
    const lots = (order?.colors || []).flatMap(c => c.lots || []);
    if (!lots.length) return { date: '', done: false, estimated: false };
    // 외관검사 불량으로 재가공 중인 LOT 는 염가공이 다시 진행 중 — 다음 차수 검사 예상 시작일까지 (없으면 원래 완료예정)
    const redyeing = (order?.colors || []).flatMap(c => getColorInspection(c).rows).filter(r => r.redyeing);
    const done = lots.every(l => normalizeStatus(l.status) === 'done') && redyeing.length === 0;
    const redyeDates = redyeing.map(r => (r.status === 'redye' ? '' : str(r.round?.startDate)));
    return { date: maxYmd([...lots.map(l => l.endDate), ...redyeDates]), done, estimated: false };
  }
  const step = order?.steps?.[key];
  if (!step) return { date: '', done: false, estimated: false };
  if (normalizeStatus(step.status) === 'done') {
    return { date: str(step.doneDate || step.endDate), done: true, estimated: false };
  }
  const end = getStepEnd(order, key);
  return { date: end, done: false, estimated: !!end && !step.endDate };
};

/**
 * 가납기 비교 (현황표 가납기 칸 · 상세창 · 입력 창 · 간트 깃발 공용)
 *  state: 'none'(가납기 없음) | 'unplanned'(일정 미입력) | 'ok'(맞음·여유) | 'late'(현재 일정이 늦음)
 *         | 'overdue'(가납기가 지났는데 아직 완료 아님) | 'done'(가납기 안에 완료) | 'done_late'(늦게 완료)
 *  diff : late·done_late·ok = 현재 날짜 - 가납기 (양수 = 늦음) / overdue = 가납기가 지난 날 수
 *  완료된 오더는 아직 완료 체크가 안 된 공정도 끝난 것으로 봄 (빨간 경고가 남지 않게)
 */
export const getProvisionalDueInfo = (order, key, today = todayYmd()) => {
  const due = str(order?.provisionalDue?.[key]);
  const cur = getStepCurrentEnd(order, key);
  const done = cur.done || order?.status === 'completed';
  const base = { key, due, current: cur.date, done, estimated: cur.estimated, diff: null };
  if (!due) return { ...base, state: 'none' };
  if (done) {
    if (!cur.date) return { ...base, state: 'done' };
    const diff = diffDaysYmd(due, cur.date);
    return { ...base, diff, state: diff > 0 ? 'done_late' : 'done' };
  }
  if (cur.date) {
    const diff = diffDaysYmd(due, cur.date);
    if (diff > 0) return { ...base, diff, state: 'late' };
    if (due < today) return { ...base, diff: diffDaysYmd(due, today), state: 'overdue' };
    return { ...base, diff, state: 'ok' };
  }
  if (due < today) return { ...base, diff: diffDaysYmd(due, today), state: 'overdue' };
  return { ...base, state: 'unplanned' };
};

// 가납기 비교 글자 — text: 뱃지 (예: '3일 늦음') / short: 간트 깃발 꼬리 (예: '+3')
export const describeProvisionalDue = (info) => {
  const d = Number(info?.diff) || 0;
  switch (info?.state) {
    case 'ok':        return { text: d < 0 ? `${-d}일 여유` : '맞음', short: '' };
    case 'late':      return { text: `${d}일 늦음`, short: `+${d}` };
    case 'overdue':   return { text: `${d}일 지남`, short: '지남' };
    case 'done':      return { text: '완료', short: '✓' };
    case 'done_late': return { text: `${d}일 늦게 완료`, short: `+${d}` };
    case 'unplanned': return { text: '일정 미입력', short: '' };
    default:          return { text: '', short: '' };
  }
};

// 가납기와 비교한 "현재" 설명 (예: '예상 종료 10/28', '예상 종료 10/28 (생산량 계산)', 'LOT 완료예정 11/5', '완료 10/20', '일정 없음')
export const describeStepCurrent = (info) => {
  if (!info?.current) return info?.done ? '완료' : '일정 없음';
  const d = shortDate(info.current);
  if (info.done) return `완료 ${d}`;
  if (info.key === 'dyeing') return `LOT 완료예정 ${d}`;
  if (info.key === 'visual_inspection') return `외관검사 예상 종료 ${d}`;
  return `예상 종료 ${d}${info.estimated ? ' (생산량 계산)' : ''}`;
};

// 가납기 기준일 — 저장한 기준일, 없으면 오더 등록일 (새 줄이면 오늘)
export const getProvisionalBase = (order) => {
  const saved = str(order?.provisionalPlan?.base);
  if (saved) return saved;
  const created = order?.createdAt ? new Date(order.createdAt) : null;
  return created && !Number.isNaN(created.getTime()) ? toYmd(created) : todayYmd();
};

/**
 * 가납기 일수 → 날짜 이어서 계산 (대표님 요청 2026-10-11 '각 단계별로 일 수를 쓰면 자동으로 날짜')
 *  가납기 = 앞 공정 가납기(첫 공정은 기준일) + 일수
 *  일수가 없는 공정은 날짜를 그대로 두고, 그 날짜가 다음 공정의 기준 / 날짜도 일수도 없는 공정은 건너뜀
 *  rows: { [key]: { days: number|null, date } } → 같은 모양 (일수가 있는 공정만 날짜가 바뀜)
 */
export const chainProvisionalDates = (base, rows) => {
  let anchor = str(base);
  const out = {};
  PROVISIONAL_DUE_KEYS.forEach(k => {
    const r = rows?.[k] || { days: null, date: '' };
    const days = numOrNull(r.days);
    const date = days !== null && days >= 0 && anchor ? addDaysYmd(anchor, Math.round(days)) : str(r.date);
    out[k] = { ...r, date };
    if (date) anchor = date;
  });
  return out;
};

// 그 공정 가납기의 기준 날짜 (앞 공정 중 가장 가까운 가납기, 없으면 기준일) — 날짜를 직접 고쳤을 때 일수 다시 세기용
export const provisionalAnchorOf = (base, rows, key) => {
  let anchor = str(base);
  for (const k of PROVISIONAL_DUE_KEYS) {
    if (k === key) return anchor;
    if (rows?.[k]?.date) anchor = rows[k].date;
  }
  return anchor;
};

// 간트 가납기 깃발 — 가납기가 있는 공정만 [{ key, label, short, date, info }]
export const getProvisionalDueMarks = (order, today = todayYmd()) => PROVISIONAL_DUE_STEPS
  .map(s => ({ key: s.key, label: s.label, short: s.short, info: getProvisionalDueInfo(order, s.key, today) }))
  .filter(m => m.info.due)
  .map(m => ({ ...m, date: m.info.due }));

// ============================================================
// 4. 간트용 타임라인 막대
// ------------------------------------------------------------
//  theme 은 PROCESS_THEME 키. start/end 는 'YYYY-MM-DD' (한쪽만 있으면 하루짜리 막대)
//  { orderBars: [...], colorRows: [{ color, bars: [...] }] }
// ============================================================
const span = (a, b) => {
  const s = a || b;
  const e = b || a;
  if (!s) return null;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
};

// 생지 출고 → 하루짜리 막대 ('생지 부분출고 300kg' · '생지 전체출고', 체크 전이면 '예정')
//  scope: 'color'(선염 — 컬러 줄) | 'order'(후염 — 오더 줄)
const greigeBars = (list, scope) => (list || []).filter(g => g.date).map(g => ({
  id: `greige_${g.id}`, kind: 'greige', greigeId: g.id, scope, theme: 'greige',
  label: `생지 ${g.kind === 'partial' ? '부분' : '전체'}출고${g.kg ? ` ${fmtKg(g.kg)}kg` : ''}${g.done ? '' : ' 예정'}`,
  status: g.done ? 'done' : 'pending',
  start: g.date, end: g.date,
}));

// 공정 한 칸 → 막대 (예상 시작 ~ 예상 종료, 편직은 생산량 계산 종료) — 없으면 null
const stepBar = (order, meta, extra = {}) => {
  const step = order?.steps?.[meta.key];
  if (!step) return null;
  const range = span(step.startDate, getStepEnd(order, meta.key));
  if (!range) return null;
  // 최초 예상 종료일 (예상 종료일을 바꾼 적이 있을 때) — 간트에 회색 점선 테두리로 같이 그림
  const firstEnd = step.endHistory?.[0]?.date || '';
  return {
    id: `step_${meta.key}`,
    kind: 'step',
    stepKey: meta.key,
    theme: PROCESS_THEME[meta.key] ? meta.key : 'custom',
    label: `${meta.label}${step.vendor ? ` ${step.vendor}` : ''}`,
    status: normalizeStatus(step.status),
    estimated: meta.key === 'knitting' && !step.endDate,
    baseEnd: firstEnd && firstEnd !== range.end ? firstEnd : '',
    ...range,
    ...extra,
  };
};

// 외관검사 차수 상태 → 막대 상태 (끝 = done, 불량·재가공 = issue, 검사중 = in_progress, 투입 전 = pending)
const roundBarStatus = (status) => {
  const meta = findStatusMeta(INSPECTION_STATUSES, status);
  if (!meta || meta.phase === 'pending') return 'pending';
  if (meta.phase === 'done') return 'done';
  if (meta.phase === 'issue' || meta.phase === 'rework') return 'issue';
  return 'in_progress';
};

// LOT 외관검사 → 차수마다 막대 (+ 재가공 → 다음 차수 사이 '재가공' 막대)
//  차수 막대: 예상 시작일(없으면 검사 시작한 날) ~ 끝난 날(없으면 예상 종료일 · 마지막 기록일)
//  아직 투입 전이면 점선 (계획만)
const lotInspectionBars = (lot, today) => {
  const bars = [];
  const rounds = getLotRounds(lot);
  rounds.forEach((r, i) => {
    const status = getRoundStatus(r);
    const meta = findStatusMeta(INSPECTION_STATUSES, status);
    const started = isActiveStatus(status) || (r.events || []).some(e => isActiveStatus(e.status));
    const startedAt = getRoundStartedDate(r);
    const doneDate = isRoundDone(r) ? getRoundDoneDate(r) : '';
    const lastDate = (r.events || []).map(e => e.date).filter(Boolean).pop() || '';
    const range = span(r.startDate || startedAt, doneDate || r.endDate || lastDate);
    const no = i + 1;
    if (range) {
      bars.push({
        id: `insp_${lot.id}_${r.id}`, kind: 'inspection', lotId: lot.id, roundId: r.id, theme: 'inspection',
        label: `LOT${lot.no} 검사${rounds.length > 1 || no > 1 ? ` ${no}차` : ''} ${meta && meta.phase !== 'pending' ? meta.label : '예정'}`,
        status: roundBarStatus(status),
        dashed: !started,
        ...range,
      });
    }
    // 재가공: 재가공을 고른 날 ~ 다음 차수 시작 (다음 차수가 아직이면 오늘까지)
    const redye = (r.events || []).filter(e => e.status === 'redye' && e.date).pop();
    if (redye) {
      const next = rounds[i + 1];
      const nextStart = next ? (getRoundStartedDate(next) || next.startDate) : '';
      const end = nextStart || (redye.date <= today ? today : redye.date);
      const redyeRange = span(redye.date, end);
      if (redyeRange) {
        bars.push({
          id: `redye_${lot.id}_${r.id}`, kind: 'redye', lotId: lot.id, roundId: r.id, theme: 'redye',
          label: `LOT${lot.no} 재가공${nextStart ? '' : ' (진행)'}`,
          status: nextStart ? 'done' : 'in_progress',
          dashed: true,
          ...redyeRange,
        });
      }
    }
  });
  return bars;
};

export const getOrderTimeline = (order, stepDefs = DEFAULT_STEP_DEFS) => {
  const orderBars = [];
  stepDefs.forEach(meta => {
    const bar = stepBar(order, meta);
    if (bar) orderBars.push(bar);
  });
  // 프리세팅 (염가공 LOT 창에서 관리 — 오더 공통, 2026-10-14). 막대는 오더 줄에
  const presetBar = stepBar(order, getStepMeta(PRESETTING_KEY), { kind: 'presetting' });
  if (presetBar) orderBars.push(presetBar);
  // 후염: 생지 출고는 오더 줄 (오더에 한 번)
  const piece = isPieceDyed(order);
  if (piece) orderBars.push(...greigeBars(order?.greigeOuts, 'order'));

  const today = todayYmd();
  const colorRows = (order?.colors || []).map(color => {
    const bars = [];
    // 생지 출고 — 선염·안 고른 오더는 컬러마다
    if (!piece) bars.push(...greigeBars(color.greigeOuts, 'color'));
    (color.lots || []).forEach(lot => {
      const range = span(lot.startDate, lot.endDate);
      if (range) {
        bars.push({
          id: `lot_${lot.id}`, kind: 'lot', lotId: lot.id, theme: 'dyeing',
          label: `LOT${lot.no}${lot.dyeKg ? ` ${fmtKg(lot.dyeKg)}kg` : ''}`,
          status: normalizeStatus(lot.status),
          ...range,
        });
      }
      // 외관검사 (LOT별 차수)
      bars.push(...lotInspectionBars(lot, today));
    });
    // 브랜드 컨펌 · 시험성적서 — 차수마다 막대 (시작 ~ 결과, 결과 전이면 오늘까지)
    const trackBars = (track, kind, theme, name) => {
      const list = TRACK_STATUSES[track];
      getTrackRounds(color[track]?.events, track).forEach(r => {
        const open = !r.result;
        const end = open && r.start && r.start <= today ? today : r.end;
        const range = span(r.start, end);
        if (!range) return;
        const result = findStatusMeta(list, r.result);
        const startMeta = findStatusMeta(list, r.startStatus);
        bars.push({
          id: `${kind}_${color.id}_${r.no}`, kind, theme, round: r.no,
          label: `${name} ${r.no > 1 ? `${r.no}차 ` : ''}${result ? result.label : (startMeta?.label || '진행')}${open ? ' (결과 전)' : ''}`,
          status: result ? (result.phase === 'done' ? 'done' : result.phase === 'issue' ? 'issue' : 'in_progress') : 'in_progress',
          open,
          ...range,
        });
      });
    };
    trackBars('brandConfirm', 'confirm', 'confirm', '브랜드');
    if (color.testReport?.needed) {
      trackBars('testReport', 'test', 'test', '성적서');
      // 발행 예상일 (아직 합격 전이면 점선 하루짜리)
      if (color.testReport.expectedDate && !isTestReportPassed(color)) {
        bars.push({
          id: `testdue_${color.id}`, kind: 'test', theme: 'test', dashed: true,
          label: '성적서 발행예정', status: 'pending',
          start: color.testReport.expectedDate, end: color.testReport.expectedDate,
        });
      }
    }
    if (color.shipDate) {
      bars.push({
        id: `ship_${color.id}`, kind: 'ship', theme: 'ship',
        label: color.shipDone ? '출고' : '출고 예정',
        status: color.shipDone ? 'done' : 'pending',
        start: color.shipDate, end: color.shipDate,
      });
    }
    return { color, bars };
  });

  return { orderBars, colorRows };
};

// ============================================================
// 5. 변경 함수 (불변: 새 오더 객체 반환)
// ============================================================

// 오더 단일 필드
export const applyOrderField = (order, field, value) => {
  const next = { ...order, [field]: value };
  if (field === 'orderNumber') {
    next.orderNumber = str(value).trim().toUpperCase();
  }
  if (field === 'articleNo') {
    next.articleNo = str(value).trim();
    // 연결된 원단 품번과 달라지면 연결 해제
    if (order.linkedFabricId && !sameName(next.articleNo, order.linkedFabricArticle)) {
      next.linkedFabricId = null;
      next.linkedFabricArticle = '';
    }
    // 다른 article 로 바꾸면 예전 원단에서 가져온 gsm · 전폭도 지움 (예상 YD 가 예전 원단 스펙으로 계산되지 않게)
    //  LOT 창에서 직접 넣은 스펙(specManual)은 그대로
    if (!sameName(next.articleNo, order.articleNo) && !order.specManual) {
      next.gsm = null;
      next.widthFull = null;
    }
  }
  if (field === 'lossRate') {
    const n = numOrNull(value);
    next.lossRate = n === null ? DEFAULT_LOSS_RATE : Math.max(0, n);
  }
  // 오더상태를 손으로 바꾸면 'Drop으로 닫힘' · '마무리 체크로 자동 완료' 표시는 지움 (그 뒤엔 체크를 풀어도 상태 그대로)
  if (field === 'status' && value !== order.status) {
    next.dropInfo = null;
    next.closingAuto = null;
  }
  if (field === 'dyeMethod') return applyDyeMethod(order, value);
  return next;
};

// 원단 스펙 직접 넣기 (LOT 창 — 원단 보관함·설계서에 스펙이 없을 때 예상 YD 환산용) { gsm?, widthFull? }
//  specManual: 직접 넣은 스펙 표시 — article# 를 다른 원단으로 바꿔도 지우지 않음 (원단에서 온 값은 article# 가 바뀌면 지움)
export const applyOrderSpec = (order, spec) => {
  const next = { ...order };
  if (spec && 'gsm' in spec) next.gsm = positiveOrNull(spec.gsm);
  if (spec && 'widthFull' in spec) next.widthFull = positiveOrNull(spec.widthFull);
  next.specManual = positiveOrNull(next.gsm) !== null || positiveOrNull(next.widthFull) !== null;
  return next;
};

/**
 * 컬러별 생지 출고 기록 → 오더 출고 목록 (후염으로 바꿀 때 — 같은 날짜·종류끼리 하나로)
 *  · 체크는 모두 체크된 경우만, kg 은 더함, 메모는 '컬러 메모'로 이어 붙임. 날짜 순서
 *  · '전체'는 오더 전체 생지가 다 나간 것 → 입력이 있는 컬러가 모두 그날 '전체'일 때만 '전체',
 *    몇 컬러만이면 '부분' + 메모 'BLACK·WHITE 전체' (출고 기록이 없는 컬러가 있으면 '전체' 없음)
 *  · 컬러마다 전체 출고가 다 끝나 있었으면 마지막 '전체' 줄은 '전체' (오더 생지 출고 끝)
 */
const mergeColorGreigeOuts = (colors = []) => {
  // 입력이 있는 컬러 모두 기준 — 출고 기록이 없는 컬러가 있으면 오더 전체 '전체 출고'가 아님 (그 컬러 생지는 아직)
  const targets = colors.filter(c => (c.greigeOuts || []).length || colorHasData(c));
  const groups = new Map();
  targets.forEach(c => (c.greigeOuts || []).forEach(g => {
    const key = `${g.date}|${g.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ g, color: c });
  }));
  const rows = [...groups.values()]
    .map(list => {
      const first = list[0].g;
      const colorIds = new Set(list.map(x => x.color.id));
      const coversAll = colorIds.size === targets.length;
      const names = [...new Set(list.map(x => x.color.name).filter(Boolean))].join('·');
      const memos = list.filter(x => x.g.memo).map(x => `${x.color.name ? `${x.color.name} ` : ''}${x.g.memo}`);
      const kind = first.kind === 'full' && coversAll ? 'full' : 'partial';
      const fromFull = first.kind === 'full' && kind === 'partial';
      return {
        ...createGreigeOut(kind, first.date),
        done: list.every(x => x.g.done),
        memo: [fromFull && names ? `${names} 전체` : '', ...memos].filter(Boolean).join(' / '),
        kg: sumKg(list.map(x => x.g)),
        fromFull,
      };
    })
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const allColorsFull = targets.length > 0 && targets.every(c => getGreigeState(c).fullDone);
  if (allColorsFull && !rows.some(r => r.kind === 'full' && r.done)) {
    const last = [...rows].reverse().find(r => r.fromFull && r.done);
    if (last) last.kind = 'full';
  }
  return rows.map(({ fromFull: _f, ...r }) => r);
};

/**
 * 염색 방식 (선염 / 후염) 바꾸기 — 대표님 요청 2026-10-14
 *  후염으로 바꿀 때 오더 출고 목록이 비어 있으면 컬러별 기록을 같은 날짜끼리 합쳐서 가져옴
 *  (컬러 기록은 지우지 않음 → 선염으로 되돌리면 다시 보임)
 */
export const applyDyeMethod = (order, method) => {
  const m = normalizeDyeMethod(method);
  if (m === (order.dyeMethod || '')) return order;
  const next = { ...order, dyeMethod: m };
  if (m === 'piece' && !(order.greigeOuts || []).length) {
    const merged = mergeColorGreigeOuts(order.colors);
    if (merged.length) next.greigeOuts = merged;
  }
  return next;
};

// 후염 오더 생지 출고 기록 바꾸기 (오더 전체 — base 를 주면 열 때 목록과 3방향 합침)
export const applyOrderGreigeOuts = (order, entries, base = undefined) => {
  const list = Array.isArray(base) ? mergeById(base, entries || [], order.greigeOuts || []) : (entries || []);
  return { ...order, greigeOuts: cleanGreigeList(list, `${order.id}_o`) };
};

// ---------- 오더 마무리 체크 (원사재고정리 · EZTEX 재고정리 · EZTEX 종결 — 대표님 요청 2026-10-14) ----------

// 마무리 상태 { items, done(체크 수), total, complete(모두 체크), missing: [{ key, label }] }
export const getClosingState = (order) => {
  const items = normalizeClosing(order?.closing);
  const missing = CLOSING_ITEMS.filter(i => !items[i.key].done);
  return { items, done: CLOSING_ITEMS.length - missing.length, total: CLOSING_ITEMS.length, complete: missing.length === 0, missing };
};

// 컬러 출고가 모두 끝났는지 (입력이 있는 컬러만 — 하나도 없으면 false)
export const isShippingDone = (order) => {
  const colors = (order?.colors || []).filter(colorHasData);
  return colors.length > 0 && colors.every(c => c.shipDone);
};

// '마무리 대기' — 출고는 다 끝났는데 마무리 체크가 남은 진행 중 오더
export const isClosingPending = (order) => !!order && order.status !== 'completed'
  && isShippingDone(order) && !getClosingState(order).complete;

/**
 * 마무리 체크 바꾸기 — patchByKey: { yarnStock: { done?, date?, memo? }, … } (주는 칸만)
 *  · 체크하면 날짜가 비었을 때 오늘, 체크를 풀면 날짜도 비움
 *  · 3개가 모두 체크되는 순간 오더 '완료' (대표님 결정 ③) + closingAuto { prevStatus, at }
 *  · 자동으로 완료된 오더에서 체크를 풀면 다시 그 전 상태로 (대표님: '잘못 눌렀으니 체크해제하면 다시 완료가 풀림')
 *    손으로 '완료'한 오더는 체크를 풀어도 그대로
 */
export const applyClosing = (order, patchByKey) => {
  const cur = normalizeClosing(order.closing);
  const next = { ...cur };
  Object.entries(patchByKey || {}).forEach(([k, p]) => {
    if (!CLOSING_KEYS.includes(k) || !p || typeof p !== 'object') return;
    const item = { ...cur[k], ...p };
    if ('done' in p) {
      item.done = !!p.done;
      if (item.done && !item.date) item.date = todayYmd();
      if (!item.done && !('date' in p)) item.date = '';
    }
    next[k] = { done: !!item.done, date: str(item.date), memo: str(item.memo).trim() };
  });
  const out = { ...order, closing: next };
  const wasAll = CLOSING_KEYS.every(k => cur[k].done);
  const nowAll = CLOSING_KEYS.every(k => next[k].done);
  if (!wasAll && nowAll && order.status !== 'completed') {
    out.status = 'completed';
    out.dropInfo = null;
    out.closingAuto = { prevStatus: order.status === 'on_hold' ? 'on_hold' : 'active', at: new Date().toISOString() };
  } else if (wasAll && !nowAll && order.status === 'completed' && order.closingAuto && !order.dropInfo) {
    // (설계서 Drop 으로 닫힌 샘플은 체크를 풀어도 그대로 — 다시 열려면 설계서 복원)
    out.status = order.closingAuto.prevStatus === 'on_hold' ? 'on_hold' : 'active';
    out.closingAuto = null;
  }
  return out;
};

// 원단 보관함에서 품번 선택 → article#·detail·gsm·폭 채움
//  gsm · 전폭은 원단 값으로 (원단에 없는 값만 오더 값 그대로). 원단 값을 다 받았으면 '직접 넣은 스펙' 표시는 지움
export const applyFabric = (order, fabric) => {
  if (!fabric) return order;
  const fGsm = positiveOrNull(fabric.gsm);
  const fWidth = positiveOrNull(fabric.widthFull);
  return {
    ...order,
    articleNo: str(fabric.article),
    linkedFabricId: fabric.id || null,
    linkedFabricArticle: str(fabric.article),
    detail: order.detail || str(fabric.itemName),
    gsm: fGsm ?? positiveOrNull(order.gsm),
    widthFull: fWidth ?? positiveOrNull(order.widthFull),
    specManual: fGsm !== null && fWidth !== null ? false : !!order.specManual,
  };
};

// 컬러 필드 patch
export const applyColorPatch = (order, colorId, patch) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const next = { ...c, ...patch };
    if ('name' in patch) next.name = str(patch.name).trim().toUpperCase();
    // 출고 칸을 손으로 바꾸면 외관검사가 자동으로 체크했던 표시는 지움 (그 뒤엔 외관검사 상태가 되돌리지 않음)
    if ('shipDone' in patch || 'shipDate' in patch) next.shipAuto = null;
    return next;
  }),
});

// 컬러 줄 추가 (afterColorId 뒤에, 없으면 맨 끝)
export const addColorRow = (order, afterColorId = null) => {
  const list = [...(order.colors || [])];
  const idx = afterColorId ? list.findIndex(c => c.id === afterColorId) : -1;
  const newColor = createColor('');
  if (idx >= 0) list.splice(idx + 1, 0, newColor);
  else list.push(newColor);
  return { order: { ...order, colors: list }, colorId: newColor.id };
};

// 컬러 줄 삭제 (마지막 1줄은 지우지 않고 비움)
export const removeColorRow = (order, colorId) => {
  const list = (order.colors || []).filter(c => c.id !== colorId);
  if (list.length === 0) return { ...order, colors: [createColor('')] };
  return { ...order, colors: list };
};

// 컬러에 입력된 데이터가 있는지 (삭제 확인용)
export const colorHasData = (color) => !!(color && (
  color.name || numOrNull(color.orderKg) !== null || numOrNull(color.workKg) !== null ||
  (color.greigeOuts || []).length || color.greigeOutDate || (color.lots || []).length ||
  color.testReport?.needed || (color.testReport?.events || []).length || (color.brandConfirm?.events || []).length ||
  isInspectionUsed(color) || color.shipDate || color.notes
));

// 공정 patch — 상태 '완료'로 바뀌면 완료일 오늘 자동, 완료가 풀리면 완료일 비움
//  예상 종료일이 바뀌면 예전 날짜를 endHistory 에 남김 (대표님 요청 2026-10-11 — '1차에 예상했던 종료일')
//   · patch 에 endHistory 가 있으면 그 목록 그대로 (입력 창에서 기록을 지웠거나 [비우기] — 부른 쪽이 계산)
//  machines(편직 기계) 가 바뀌면 dailyKg = 기계 합계
export const applyStepPatch = (order, key, patch) => {
  const prev = order.steps?.[key] || createStep(key);
  const next = { ...prev, ...patch };
  if ('status' in patch) {
    next.status = normalizeStatus(patch.status);
    if (next.status === 'done' && !next.doneDate) next.doneDate = todayYmd();
    if (next.status !== 'done' && !('doneDate' in patch)) next.doneDate = '';
  }
  if ('endHistory' in patch) {
    next.endHistory = normalizeEndHistory(patch.endHistory);
  } else if ('endDate' in patch) {
    const before = str(prev.endDate);
    if (before && before !== str(patch.endDate)) {
      next.endHistory = [...normalizeEndHistory(prev.endHistory), { date: before, at: todayYmd() }];
    }
  }
  if ('machines' in patch) {
    next.machines = cleanMachines(patch.machines, `${key}_${Date.now().toString(36)}`);
    next.dailyKg = sumMachinesKg(next.machines);
  } else if ('dailyKg' in patch) {
    next.dailyKg = numOrNull(patch.dailyKg);
  }
  return { ...order, steps: { ...(order.steps || createSteps()), [key]: next } };
};

/**
 * 목록 합치기 (id 기준 3방향) — 입력 창을 열어 둔 사이 다른 PC·현황표 칸에서 바뀐 줄을 지우지 않게
 *  base: 창을 열 때 목록 / mine: 창에서 고친 목록 / theirs: 지금 저장된 목록
 *  · 내가 안 고친 줄은 지금 저장된 값으로 (다른 곳에서 고쳤으면 그 값, 지웠으면 빠짐)
 *  · 내가 고치거나 새로 넣은 줄은 내 값, 내가 지운 줄은 빠짐
 *  · 다른 곳에서 새로 넣은 줄은 뒤에 붙임
 */
export const mergeById = (base = [], mine = [], theirs = []) => {
  const key = (x) => JSON.stringify(x);
  const baseMap = new Map(base.map(x => [x.id, x]));
  const theirMap = new Map(theirs.map(x => [x.id, x]));
  const mineIds = new Set(mine.map(x => x.id));
  const out = [];
  mine.forEach(x => {
    const b = baseMap.get(x.id);
    if (b && key(b) === key(x)) {
      if (theirMap.has(x.id)) out.push(theirMap.get(x.id)); // 안 고친 줄 → 지금 값 (다른 곳에서 지웠으면 빠짐)
      return;
    }
    out.push(x);
  });
  theirs.forEach(x => {
    if (!baseMap.has(x.id) && !mineIds.has(x.id)) out.push(x);
  });
  return out;
};

// 컬러 생지 출고 기록 바꾸기 (+ 마지막 출고일 · 전체 출고 끝 칸도 맞춤)
//  base: 입력 창을 열 때 목록 — 주면 지금 저장된 목록과 합침 (mergeById), 안 주면 통째로 교체
export const applyGreigeOuts = (order, colorId, entries, base = undefined) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const list = Array.isArray(base) ? mergeById(base, entries || [], c.greigeOuts || []) : (entries || []);
    return withGreigeSummary({ ...c, greigeOuts: normalizeGreigeOuts({ greigeOuts: list }, c.id) });
  }),
});

// 상태 기록 칸 patch 를 지금 값에 얹기 — patch 에 eventsBase(열 때 기록)가 있으면 기록은 합침 (mergeById)
const mergeTrackPatch = (cur, patch) => {
  const { eventsBase, ...rest } = patch || {};
  const next = { ...(cur || {}), ...rest };
  if ('events' in rest && Array.isArray(eventsBase)) next.events = mergeById(eventsBase, rest.events || [], cur?.events || []);
  return next;
};

// 컬러 상태 기록 칸 바꾸기 — patch: { testReport?, brandConfirm? } (주는 칸만 — 안의 값은 합쳐서)
//  외관검사는 LOT 별 (applyLotInspections)
export const applyColorTracks = (order, colorId, patch) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const next = { ...c };
    if (patch?.testReport) next.testReport = normalizeTestReport(mergeTrackPatch(c.testReport, patch.testReport), c.id);
    if (patch?.brandConfirm) next.brandConfirm = normalizeBrandConfirm(mergeTrackPatch(c.brandConfirm, patch.brandConfirm), c, c.id);
    return next;
  }),
});

// 상태 드롭다운을 바꿈 → 그날 날짜로 기록 한 줄 (지금 상태와 같으면 그대로) — 시험성적서 · 브랜드 컨펌
export const addColorTrackEvent = (order, colorId, track, status, date = todayYmd()) => {
  if (track !== 'testReport' && track !== 'brandConfirm') return order;
  const color = (order.colors || []).find(c => c.id === colorId);
  if (!color || !findStatusMeta(TRACK_STATUSES[track], status)) return order;
  if (getTrackStatus(color, track) === status) return order;
  const events = [...(color[track]?.events || []), createStatusEvent(status, date)];
  return applyColorTracks(order, colorId, { [track]: { ...(color[track] || {}), events } });
};

// LOT 들의 마지막 '출고완료' 기록 날짜 (자동 출고 체크 때 출고일로)
const lastShippedDate = (color) => maxYmd((color?.lots || []).map(l => {
  const ev = (getLotCurrentRound(l)?.events || []).filter(e => e.status === 'shipped' && e.date);
  return ev.length ? ev[ev.length - 1].date : '';
}));

/**
 * 외관검사 '출고완료' ↔ 컬러 출고 칸 (LOT 기준 — 대표님 결정 2026-10-11 → LOT별 2026-10-14)
 *  · 그 컬러 LOT 가 모두 '출고완료'가 되면 출고 칸 완료 (출고일이 비었으면 마지막 출고완료 날) + shipAuto 표시
 *  · 자동으로 체크한 출고는 '모두 출고완료'가 풀리면(다른 상태 · 기록 삭제 · 새 LOT) 되돌림. 손으로 체크한 출고는 그대로
 */
const syncShipFromInspection = (prevColor, nextColor) => {
  const before = getColorInspection(prevColor).allShipped;
  const after = getColorInspection(nextColor).allShipped;
  if (after && !before && !nextColor.shipDone) {
    const filled = nextColor.shipDate ? '' : (lastShippedDate(nextColor) || todayYmd());
    return { ...nextColor, shipDone: true, ...(filled ? { shipDate: filled } : {}), shipAuto: { filledDate: filled } };
  }
  if (before && !after && nextColor.shipAuto) {
    const out = { ...nextColor, shipDone: false, shipAuto: null };
    if (nextColor.shipAuto.filledDate && nextColor.shipDate === nextColor.shipAuto.filledDate) out.shipDate = '';
    return out;
  }
  return nextColor;
};

// 컬러 LOT 목록 통째로 교체 (번호 1..N 재정렬)
//  LOT 편집 창은 외관검사를 건드리지 않음 → 외관검사 차수는 지금 저장된 값 그대로 (열어 둔 사이 바뀐 기록이 지워지지 않게)
export const applyLots = (order, colorId, lots) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const curById = new Map((c.lots || []).map(l => [l.id, l]));
    const nextLots = (lots || []).map((l, i) => {
      const cur = curById.get(l.id);
      const lotNo = i + 1;
      return normalizeLot({ ...l, no: lotNo, inspections: cur ? cur.inspections : l.inspections }, l.id, i);
    });
    return syncShipFromInspection(c, { ...c, lots: nextLots });
  }),
});

// 외관검사 차수 한 줄 비교용 (예상 일정 · 메모 · 기록)
const roundKey = (r) => JSON.stringify([
  str(r?.startDate), str(r?.endDate), str(r?.notes).trim(),
  (r?.events || []).map(e => [e.id, e.status, str(e.date)]),
]);

/**
 * 외관검사 차수 합치기 (3방향 — 입력 창을 열어 둔 사이 현황표 드롭다운·다른 PC에서 바뀐 값 지키기)
 *  · 안 고친 차수 → 지금 저장된 값 / 고친 차수 → 고친 칸만 내 값, 상태 기록은 mergeById
 *  · 내가 새로 넣은 차수는 넣고, 지운 차수는 빼고, 다른 곳에서 새로 생긴 차수는 뒤에 붙임
 */
const mergeRounds = (base = [], mine = [], theirs = []) => {
  const baseMap = new Map(base.map(r => [r.id, r]));
  const theirMap = new Map(theirs.map(r => [r.id, r]));
  const mineIds = new Set(mine.map(r => r.id));
  const out = [];
  mine.forEach(r => {
    const b = baseMap.get(r.id);
    if (!b) {
      out.push(r);
      return;
    }
    const t = theirMap.get(r.id);
    if (roundKey(b) === roundKey(r)) {
      if (t) out.push(t);
      return;
    }
    const cur = t || b;
    const merged = { ...cur };
    ['startDate', 'endDate', 'notes'].forEach(f => {
      if (str(r[f]) !== str(b[f])) merged[f] = r[f];
    });
    merged.events = mergeById(b.events || [], r.events || [], cur.events || []);
    out.push(merged);
  });
  theirs.forEach(t => {
    if (!baseMap.has(t.id) && !mineIds.has(t.id)) out.push(t);
  });
  return out;
};

/**
 * LOT 외관검사 차수 바꾸기 (외관검사 입력 창) — patchByLot: { [lotId]: { rounds, base? } }
 *  base(열 때 차수 목록)를 주면 지금 저장된 값과 합침. 저장 뒤 컬러 출고 칸 연동 (syncShipFromInspection)
 */
export const applyLotInspections = (order, colorId, patchByLot) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const lots = (c.lots || []).map(l => {
      const p = patchByLot?.[l.id];
      if (!p) return l;
      const list = Array.isArray(p.base) ? mergeRounds(p.base, p.rounds || [], l.inspections || []) : (p.rounds || []);
      return { ...l, inspections: normalizeRounds(list, l.id) };
    });
    return syncShipFromInspection(c, { ...c, lots });
  }),
});

/**
 * LOT 외관검사 상태 드롭다운 (현황표·상세창 칸 — 바로 저장) → 지금 차수에 그날 날짜로 기록 한 줄
 *  · 차수가 없으면 1차를 만들어서 ('투입 전'은 그대로)
 *  · '재가공'을 고르면 다음 차수(2차…) 검사 줄을 자동으로 (대표님 요청 — 불량 → 염가공소 → 2차 검사)
 */
export const addLotInspectionEvent = (order, colorId, lotId, status, date = todayYmd()) => {
  const color = (order.colors || []).find(c => c.id === colorId);
  const lot = (color?.lots || []).find(l => l.id === lotId);
  if (!lot || !findStatusMeta(INSPECTION_STATUSES, status)) return order;
  let rounds = [...getLotRounds(lot)];
  if (!rounds.length) {
    if (status === 'waiting') return order;
    rounds = [createInspectionRound()];
  }
  const last = rounds[rounds.length - 1];
  if ((getRoundStatus(last) || 'waiting') === status) return order;
  rounds[rounds.length - 1] = { ...last, events: [...(last.events || []), createStatusEvent(status, date)] };
  if (status === 'redye') rounds.push(createInspectionRound());
  return applyLotInspections(order, colorId, { [lotId]: { rounds } });
};

// 날짜 메모 upsert — text가 비면 삭제
export const applyDailyNote = (order, { date, colorId = '', text = '', tone = '' }) => {
  const list = (order.dailyNotes || []).filter(n => !(n.date === date && str(n.colorId) === str(colorId)));
  const t = str(text).trim();
  if (t) list.push({ id: uid('note'), date, colorId: str(colorId), text: t, tone: str(tone) });
  list.sort((a, b) => a.date.localeCompare(b.date));
  return { ...order, dailyNotes: list };
};

export const findDailyNote = (order, date, colorId = '') =>
  (order?.dailyNotes || []).find(n => n.date === date && str(n.colorId) === str(colorId)) || null;

// 가납기 patch ({ knitting: '2026-10-25', dyeing: '' … }) — 정해진 4공정만 바꿈, 빈칸 = 지움
//  plan: 가납기 일수 — 바뀐 칸만 { base?, days?: { knitting: 10 … } } (안 준 칸은 그대로, 안 주면 일수 전체 그대로)
export const applyProvisionalDue = (order, patch, plan = undefined) => {
  const next = normalizeProvisionalDue(order.provisionalDue);
  Object.entries(patch || {}).forEach(([k, v]) => {
    if (PROVISIONAL_DUE_KEYS.includes(k)) next[k] = str(v);
  });
  const out = { ...order, provisionalDue: next };
  if (plan && typeof plan === 'object') {
    const cur = normalizeProvisionalPlan(order.provisionalPlan);
    out.provisionalPlan = normalizeProvisionalPlan({
      base: 'base' in plan ? plan.base : cur.base,
      days: { ...cur.days, ...(plan.days || {}) },
    });
  }
  return out;
};

// ============================================================
// 6. 변경 이력 요약 (감사 로그) — 이전/이후 오더 비교해 한국어 한 줄로
// ============================================================
const ORDER_FIELD_LABELS = {
  orderNumber: 'order#', articleNo: 'article#', detail: '디테일', customer: 'buyer',
  type: '구분', finalDueDate: '납기', lossRate: '로스율', status: '오더상태', notes: '메모', dyeVendor: '염색소',
  inspectVendor: '검사처', dyeMethod: '염색 방식', gsm: 'gsm', widthFull: '전폭',
};
const STEP_FIELD_LABELS = {
  vendor: '외주처', startDate: '예상 시작', endDate: '예상 종료', status: '상태', doneDate: '완료일', notes: '메모', dailyKg: '일생산kg',
};

// 편직 기계 목록 → 한 줄 ('1호기 300 · 2호기 250kg/일')
const machinesText = (list) => {
  const t = (list || [])
    .filter(m => m && (m.name || m.dailyKg))
    .map(m => `${m.name || '기계'} ${m.dailyKg ?? '-'}`)
    .join(' · ');
  return t ? `${t}kg/일` : '';
};

// 공정 한 칸 비교 (외주처·일정·상태·메모 + 편직 기계 + 예전 예상 종료일 기록 삭제)
const diffStep = (a, b, label, out) => {
  const before = out.length;
  const mA = machinesText(a?.machines);
  const mB = machinesText(b?.machines);
  const labels = mA !== mB ? { ...STEP_FIELD_LABELS, dailyKg: undefined } : STEP_FIELD_LABELS; // 기계가 바뀌면 합계는 따로 안 적음
  diffFields(a, b, Object.fromEntries(Object.entries(labels).filter(([, v]) => v)), `${label} `, out);
  if (mA !== mB) out.push(`${label} 기계 ${mB || '없음'}`);
  // 예전 예상 종료일 기록을 지웠으면 (다른 칸을 같이 바꿨어도) 따로 남김
  const histKey = (h) => `${h.date}|${h.at}`;
  const kept = new Set((b?.endHistory || []).map(histKey));
  const removed = (a?.endHistory || []).filter(h => !kept.has(histKey(h))).length;
  if (removed > 0) out.push(`${label} 예전 예상 종료일 기록 ${removed}개 삭제`);
  return out.length > before;
};
const COLOR_FIELD_LABELS = {
  name: '컬러명', orderKg: '오더kg', workKg: '작지kg',
  shipDate: '출고일', shipDone: '출고', notes: '메모',
};

// 생지 출고 기록 → 한 줄 ('부분 10/5 300kg✓ · 전체 10/9')
const greigeText = (list) => (list || [])
  .map(g => `${g.kind === 'partial' ? '부분' : '전체'} ${g.date ? shortDate(g.date) : '날짜?'}${g.kg ? ` ${fmtKg(g.kg)}kg` : ''}${g.done ? '✓' : ''}${g.memo ? `(${g.memo.slice(0, 12)})` : ''}`)
  .join(' · ');
const LOT_FIELD_LABELS = {
  startDate: '투입', endDate: '완료예정', status: '상태', dyeKg: '배색량', notes: '메모',
};
const ROUND_FIELD_LABELS = { startDate: '예상 시작', endDate: '예상 종료', notes: '메모' };

// LOT 외관검사 비교 → 'BLACK LOT1 외관검사 2차 추가' · 'BLACK LOT1 1차 검사중→재가공' · 'BLACK LOT1 1차 예상 종료 10/10→10/12'
const diffLotInspections = (oldLot, newLot, prefix, out) => {
  const a = oldLot?.inspections || [];
  const b = newLot?.inspections || [];
  if (b.length > a.length) out.push(`${prefix} 외관검사 ${b.length}차${b.length - a.length > 1 ? `까지` : ''} 추가`);
  if (b.length < a.length) out.push(`${prefix} 외관검사 차수 삭제 ${a.length}→${b.length}차`);
  b.forEach((r, i) => {
    const old = a.find(x => x.id === r.id);
    if (!old) return;
    const name = `${prefix} ${i + 1}차`;
    diffFields(old, r, ROUND_FIELD_LABELS, `${name} 외관검사 `, out);
    const sa = getRoundStatus(old);
    const sb = getRoundStatus(r);
    const label = (s) => findStatusMeta(INSPECTION_STATUSES, s)?.label || '투입 전';
    if (sa !== sb) out.push(`${name} 외관검사 ${label(sa)}→${label(sb)}`);
    else if (JSON.stringify((old.events || []).map(e => [e.status, e.date])) !== JSON.stringify((r.events || []).map(e => [e.status, e.date]))) {
      out.push(`${name} 외관검사 기록 수정`);
    }
  });
};

// 상태 기록 비교 → '시험성적서 발행중→불합격' / '시험성적서 기록 수정'
const diffTrack = (oldC, newC, track, name, cName, out) => {
  const list = TRACK_STATUSES[track];
  const a = getTrackStatus(oldC, track);
  const b = getTrackStatus(newC, track);
  if (a !== b) {
    out.push(`${cName} ${name} ${findStatusMeta(list, a)?.label || '-'}→${findStatusMeta(list, b)?.label || '-'}`);
    return;
  }
  const key = (c) => JSON.stringify((c?.[track]?.events || []).map(e => [e.status, e.date]));
  if (key(oldC) !== key(newC)) out.push(`${cName} ${name} 기록 수정`);
};

const fmtVal = (field, v) => {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? '완료' : '미완료';
  if (field === 'status') return ORDER_STATUSES.find(s => s.key === v)?.label || getStatusLabel(v);
  if (field === 'type') return ORDER_TYPES.find(t => t.key === v)?.label || v;
  if (field === 'dyeMethod') return DYE_METHODS.find(m => m.key === v)?.label || v;
  if (field === 'dyeKg') return `${fmtKg(v)}kg`;
  if (/Date$/.test(field)) return shortDate(v) || String(v);
  const s = String(v);
  return s.length > 20 ? `${s.slice(0, 20)}…` : s;
};

const diffFields = (prev, next, labels, prefix, out) => {
  Object.keys(labels).forEach(f => {
    const a = prev?.[f] ?? '';
    const b = next?.[f] ?? '';
    if (String(a) !== String(b)) out.push(`${prefix}${labels[f]} ${fmtVal(f, a)}→${fmtVal(f, b)}`);
  });
};

export const summarizeOrderChange = (prev, next, stepDefs = DEFAULT_STEP_DEFS) => {
  if (!prev || !next) return null;
  const out = [];
  diffFields(prev, next, ORDER_FIELD_LABELS, '', out);
  // 마무리 체크로 자동 완료 / 체크를 풀어 다시 진행 (오더상태 줄 앞에 까닭)
  //  손으로 상태를 바꿔 자동 완료 표시가 지워진 경우(체크는 그대로)는 '오더상태' 줄만 남김
  if (!prev.closingAuto && next.closingAuto) out.push('마무리 체크 3개 끝 → 자동 완료');
  if (prev.closingAuto && !next.closingAuto && prev.status === 'completed' && next.status !== 'completed'
    && getClosingState(prev).complete && !getClosingState(next).complete) {
    out.push('마무리 체크를 풀어서 완료 취소');
  }

  // 후염 오더 생지 출고 (오더 전체)
  const ogA = greigeText(prev.greigeOuts);
  const ogB = greigeText(next.greigeOuts);
  if (ogA !== ogB) out.push(`생지 출고(오더 전체) ${ogB || '없음'}`);

  // 마무리 체크 (원사재고정리 · EZTEX 재고정리 · EZTEX 종결)
  const clA = normalizeClosing(prev.closing);
  const clB = normalizeClosing(next.closing);
  CLOSING_ITEMS.forEach(it => {
    const a = clA[it.key];
    const b = clB[it.key];
    if (a.done !== b.done) out.push(`마무리 ${it.label} ${b.done ? '체크' : '체크 해제'}`);
    else if (a.done && a.date !== b.date) out.push(`마무리 ${it.label} 날짜 ${fmtVal('d', shortDate(a.date))}→${fmtVal('d', shortDate(b.date))}`);
    if (a.memo !== b.memo) out.push(`마무리 ${it.label} 메모 ${b.memo ? '수정' : '삭제'}`);
  });

  // 원단 보관함 연결 (article# 글자가 이미 같아도 연결·해제는 변경으로 기록)
  if (str(prev.linkedFabricId) !== str(next.linkedFabricId)) {
    out.push(next.linkedFabricId
      ? `원단 보관함 연결 (${next.linkedFabricArticle || next.articleNo || '-'})`
      : '원단 보관함 연결 해제');
  }

  // 설계서 연결 (설계서 EZ-TEX O/D NO. 등록으로 만든·연결한 샘플 오더)
  if (str(prev.linkedSheetId) !== str(next.linkedSheetId)) {
    out.push(next.linkedSheetId ? '설계서 연결' : '설계서 연결 해제');
  }

  // 설계서 Drop 으로 닫힘 / 풀림 (이미 '완료'였던 오더도 Drop 표시는 변경으로 기록)
  if (!!prev.dropInfo !== !!next.dropInfo) {
    out.push(next.dropInfo ? '샘플 Drop으로 닫음' : 'Drop 표시 해제');
  }

  // 공정 (기본 + 추가 공정 — 목록에 없는 추가 공정은 이름 대신 '추가 공정')
  const stepKeys = [...new Set([
    ...stepDefs.map(m => m.key),
    ...ORDER_STEP_KEYS,
    ...Object.keys(prev.steps || {}).filter(isCustomStepKey),
    ...Object.keys(next.steps || {}).filter(isCustomStepKey),
  ])];
  stepKeys.forEach(k => {
    const label = stepDefs.find(m => m.key === k)?.label || getStepMeta(k)?.label || '추가 공정';
    // 처음 입력하는 공정(문서에 아직 없음)은 빈 공정과 비교 — '상태 -→대기' 같은 줄이 남지 않게
    diffStep(prev.steps?.[k] || createStep(k), next.steps?.[k] || createStep(k), label, out);
  });

  // 가납기 (예: '가납기 편직 10/25→10/28') + 기준일 · 일수 (날짜가 그대로인데 일수만 바뀐 경우)
  const planA = normalizeProvisionalPlan(prev.provisionalPlan);
  const planB = normalizeProvisionalPlan(next.provisionalPlan);
  if (planA.base !== planB.base && (planA.base || planB.base)) {
    out.push(`가납기 기준일 ${fmtVal('baseDate', planA.base)}→${fmtVal('baseDate', planB.base)}`);
  }
  PROVISIONAL_DUE_STEPS.forEach(s => {
    const a = str(prev.provisionalDue?.[s.key]);
    const b = str(next.provisionalDue?.[s.key]);
    if (a !== b) out.push(`가납기 ${s.label} ${fmtVal('dueDate', a)}→${fmtVal('dueDate', b)}`);
    else if (planA.days[s.key] !== planB.days[s.key]) {
      out.push(`가납기 ${s.label} 일수 ${planA.days[s.key] ?? '-'}→${planB.days[s.key] ?? '-'}일`);
    }
  });

  const prevColors = prev.colors || [];
  const nextColors = next.colors || [];
  nextColors.forEach(c => {
    const old = prevColors.find(p => p.id === c.id);
    const cName = c.name || old?.name || '컬러';
    if (!old) { out.push(`컬러 추가${c.name ? ` (${c.name})` : ''}`); return; }
    diffFields(old, c, COLOR_FIELD_LABELS, `${cName} `, out);
    const gA = greigeText(old.greigeOuts);
    const gB = greigeText(c.greigeOuts);
    if (gA !== gB) out.push(`${cName} 생지 출고 ${gB || '없음'}`);
    const oldLots = old.lots || [];
    const newLots = c.lots || [];
    // LOT 구성 변경: 개수가 같아도 id 가 바뀌면(자동 나누기 재실행, 삭제 후 새로 추가) 변경으로 기록
    const oldIds = oldLots.map(l => l.id);
    const newIds = newLots.map(l => l.id);
    const lotAdded = newIds.some(x => !oldIds.includes(x));
    const lotRemoved = oldIds.some(x => !newIds.includes(x));
    const lotCount = `${oldLots.length}→${newLots.length}개`;
    if (lotAdded && lotRemoved) out.push(`${cName} LOT 계획 변경 ${lotCount}`);
    else if (lotAdded) out.push(`${cName} LOT 추가 ${lotCount}`);
    else if (lotRemoved) out.push(`${cName} LOT 삭제 ${lotCount}`);
    else if (oldIds.join('|') !== newIds.join('|')) out.push(`${cName} LOT 순서 변경`);
    newLots.forEach(l => {
      const ol = oldLots.find(x => x.id === l.id);
      if (!ol) return;
      diffFields(ol, l, LOT_FIELD_LABELS, `${cName} LOT${l.no} `, out);
      // 외관검사 (LOT별 차수 — 예상 일정 · 메모 · 상태)
      diffLotInspections(ol, l, `${cName} LOT${l.no}`, out);
    });
    // 시험성적서 (체크 · 발행 예상일 · 상태) / 브랜드 컨펌 (상태)
    if (!!old.testReport?.needed !== !!c.testReport?.needed) {
      out.push(`${cName} 시험성적서 ${c.testReport?.needed ? '체크' : '체크 해제'}`);
    }
    if (str(old.testReport?.expectedDate) !== str(c.testReport?.expectedDate)) {
      out.push(`${cName} 성적서 발행예정 ${fmtVal('dueDate', old.testReport?.expectedDate)}→${fmtVal('dueDate', c.testReport?.expectedDate)}`);
    }
    diffTrack(old, c, 'testReport', '시험성적서', cName, out);
    diffTrack(old, c, 'brandConfirm', '브랜드 컨펌', cName, out);
  });
  prevColors.forEach(p => {
    if (!nextColors.some(c => c.id === p.id)) out.push(`컬러 삭제${p.name ? ` (${p.name})` : ''}`);
  });

  const noteKey = (n) => `${n.date}|${n.colorId}|${n.text}|${n.tone}`;
  const prevNotes = (prev.dailyNotes || []).map(noteKey).sort().join('\n');
  const nextNotes = (next.dailyNotes || []).map(noteKey).sort().join('\n');
  if (prevNotes !== nextNotes) out.push('날짜 메모 변경');

  if (!out.length) return null;
  const summary = out.join(', ');
  return summary.length > 300 ? `${summary.slice(0, 300)}…` : summary;
};

// (참고) 그 컬러 외관검사를 한 줄로 — 'LOT1 2차 투입 전(재가공중) · LOT2 출고준비완료' (툴팁·모바일용)
export const describeColorInspection = (color) => getColorInspection(color).rows
  .filter(r => r.used)
  .map(r => `LOT${r.lot.no}${r.roundNo > 1 ? ` ${r.roundNo}차` : ''} ${findStatusMeta(INSPECTION_STATUSES, r.status)?.label || '투입 전'}${r.redyeing && r.status !== 'redye' ? '(재가공중)' : ''}`)
  .join(' · ');

// 키 순서와 무관한 비교용 문자열 (undefined 값은 없는 것으로 봄)
const stableKey = (v) => {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter(k => v[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${stableKey(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
};

/**
 * 두 오더의 저장 내용이 같은지 (저장 시각·변경 이력 제외).
 * summarizeOrderChange 가 요약하지 못하는 변경(원단 gsm·폭 등)도 저장에서 빠지지 않도록 쓰는 보조 비교.
 * 날짜 메모는 요약이 내용(날짜·컬러·글·색)을 전부 비교하므로 제외 (upsert 때마다 id 가 새로 생김)
 */
export const isSameOrderContent = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const pick = (o) => {
    const { updatedAt: _updatedAt, changeLog: _changeLog, dailyNotes: _dailyNotes, ...rest } = o;
    return stableKey(rest);
  };
  return pick(a) === pick(b);
};

// ============================================================
// 7. 설계서 ↔ 샘플 오더 (대표님 요청 2026-10-10)
// ------------------------------------------------------------
//  설계서에 EZ-TEX O/D NO.를 등록하면 그 번호(order#)로 생산 현황에 샘플 오더가 생기고,
//  샘플 진행(원사·편직·염가공·컨펌·출고)은 생산 현황에서 기록한다. 아이템화되면 오더는 '완료',
//  Drop 되면 '완료' + dropInfo(Drop 전 상태 기억 — 화면·리포트에는 'Drop', 복원하면 그 상태로).
//  연결은 오더 쪽 linkedSheetId 하나만 저장 (설계서 → 오더는 linkedSheetId 로 찾음)
// ============================================================

// 설계서 Drop 으로 닫힌 샘플 오더인지 (완료 통계·'완료' 표시에서 따로 봄)
export const isDropClosed = (order) => !!order && order.status === 'completed' && !!order.dropInfo;

// 아직 끝나지 않은 공정 — 아이템화·샘플 끝내기 확인 창에 알려 줌 (예: ['편직 진행중', '염가공 LOT 2개', '출고 1건'])
//  공정: 진행중·문제 + 일정만 잡힌 것(예정) / 염가공 LOT: 완료 전 LOT 중 일정·상태가 있는 것 / 출고: 출고일만 있고 완료 전
//  완료된 오더는 빈 목록
export const getOpenWork = (order, stepDefs = DEFAULT_STEP_DEFS) => {
  if (!order || order.status === 'completed') return [];
  const out = [];
  // 공정 + 프리세팅 (LOT 창에서 관리하는 오더 공통 공정 — 편직 다음 순서로)
  withPresettingStep(stepDefs).forEach(meta => {
    const step = order.steps?.[meta.key];
    if (!step) return;
    const st = normalizeStatus(step.status);
    if (st === 'in_progress') out.push(`${meta.label} 진행중`);
    else if (st === 'issue') out.push(`${meta.label} 문제`);
    else if (st === 'pending' && (step.startDate || step.endDate)) out.push(`${meta.label} 예정`);
  });
  const colors = order.colors || [];
  const openLots = colors.flatMap(c => c.lots || []).filter(l => {
    const st = normalizeStatus(l.status);
    return st !== 'done' && (st !== 'pending' || l.startDate || l.endDate);
  });
  if (openLots.length) out.push(`염가공 LOT ${openLots.length}개`);
  const testOpen = colors.filter(c => c.testReport?.needed && !isTestReportPassed(c)).length;
  if (testOpen) out.push(`시험성적서 ${testOpen}건`);
  const brandOpen = colors.filter(c => {
    const st = getTrackStatus(c, 'brandConfirm');
    return st && st !== 'confirmed';
  }).length;
  if (brandOpen) out.push(`브랜드 컨펌 ${brandOpen}건`);
  const inspOpen = colors
    .filter(c => !c.shipDone)
    .flatMap(c => (c.lots || []).filter(l => isLotInspectionUsed(l) && !isLotInspectionDone(l))).length;
  if (inspOpen) out.push(`외관검사 LOT ${inspOpen}개`);
  const ships = colors.filter(c => c.shipDate && !c.shipDone).length;
  if (ships) out.push(`출고 ${ships}건`);
  const closing = getClosingState(order);
  if (!closing.complete) out.push(`마무리 체크 ${closing.missing.length}개 (${closing.missing.map(m => m.label).join('·')})`);
  return out;
};

/**
 * 설계서 값으로 샘플 오더 칸 채우기 (구분 = 샘플 + 설계서 연결)
 *  detail = 원단명 · buyer = 의뢰 바이어 · 납기 = 설계서 납기 · article# = 설계서 Article (원단이 연결돼 있으면 연결도)
 *  편직처 = 설계서 편직처 · 염색소 = 설계서 염색처 · 후가공처 = 설계서 후가공처
 *  onlyEmpty: 이미 있는 오더에 연결할 때 — 비어 있는 칸만 채움 (생산 현황에 적어 둔 값은 그대로)
 */
export const fillOrderFromSheet = (order, sheet, { buyerName = '', onlyEmpty = false } = {}) => {
  if (!order || !sheet) return order;
  const take = (cur, val) => {
    const v = str(val).trim();
    if (!v) return cur;
    return onlyEmpty && str(cur).trim() ? cur : v;
  };
  let next = {
    ...order,
    type: 'sample',
    linkedSheetId: sheet.id,
    detail: take(order.detail, sheet.fabricName),
    customer: take(order.customer, buyerName),
    finalDueDate: take(order.finalDueDate, sheet.deadline),
    dyeVendor: take(order.dyeVendor, sheet.dyeing?.factory),
  };
  const article = str(sheet.articleNo).trim();
  if (article && !(onlyEmpty && str(order.articleNo).trim())) {
    next.articleNo = article;
    next.linkedFabricId = sheet.linkedFabricId || null;
    next.linkedFabricArticle = sheet.linkedFabricId ? article : '';
  }
  [['knitting', sheet.knitting?.factory], ['finishing', sheet.finishing?.factory]].forEach(([key, vendor]) => {
    const cur = next.steps?.[key]?.vendor || '';
    const v = take(cur, vendor);
    if (v !== cur) next = applyStepPatch(next, key, { vendor: v });
  });
  return next;
};

// 오더 진행을 한 단계로 (개발/설계 현황의 '샘플 진행' 칸) — 가장 덜 진행된 컬러 기준, 문제가 있으면 '문제'
// 반환: COLOR_STAGES 키 (오더가 없으면 null)
const STAGE_FLOW = [
  'waiting', 'yarn', 'knit_wait', 'knitting', 'greige_wait', 'greige_partial', 'dye_wait', 'presetting', 'dyeing', 'redye',
  'finish_wait', 'finishing', 'confirm_wait', 'confirm', 'inspect_wait', 'inspection', 'defect', 'ship_wait', 'shipped',
];
export const getOrderProgressStage = (order) => {
  if (!order) return null;
  if (order.status === 'completed') return 'completed';
  if (order.status === 'on_hold') return 'on_hold';
  const stages = (order.colors || []).map(c => getColorStage(order, c));
  if (!stages.length) return 'waiting';
  if (stages.includes('issue')) return 'issue';
  return stages.reduce((min, s) => (STAGE_FLOW.indexOf(s) < STAGE_FLOW.indexOf(min) ? s : min), stages[0]);
};
