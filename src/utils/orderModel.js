// GRUBIG ERP - 생산 오더 데이터 모델 (v8: 엑셀형 현황표)
// ------------------------------------------------------------
// 순수 함수만 모음 (Firestore/React 의존 없음). 화면·훅은 모두 이 파일의 구조를 따른다.
//
// ■ v8 오더 문서 구조 (orders 컬렉션, 문서 ID = order.id)
//   {
//     id, schemaVersion: 8,
//     orderNumber, articleNo, detail, customer(buyer), type('main'|'sample'),
//     finalDueDate, lossRate(%), status('active'|'on_hold'|'completed'), notes,
//     linkedFabricId, linkedFabricArticle, dyeVendor(염색소),
//     steps: { yarn, yarn_processing, knitting, finishing, physical_test, visual_inspection }
//            각 { vendor, startDate, endDate, status, doneDate, notes } (+ knitting.dailyKg)
//     colors: [{ id, name, orderKg, workKg(null=자동), greigeOutDate, greigeOutDone,
//                lots: [{ id, no, machineKg, qtyKg, startDate, endDate, status, rolls, notes }],
//                confirmRounds: [{ round, sentDate, resultDate, result }],
//                shipDate, shipDone, notes, legacyYd? }]
//     dailyNotes: [{ id, date, colorId(''=오더 전체), text, tone }]
//     provisionalDue: { yarn, knitting, dyeing, visual_inspection }   // 가납기 ('YYYY-MM-DD', '' = 없음)
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
  normalizeStatus, getStatusLabel, getStepMeta, ORDER_TYPES, ORDER_STATUSES,
  PROVISIONAL_DUE_STEPS, PROVISIONAL_DUE_KEYS,
} from '../constants/production';
import { addDaysYmd, diffDaysYmd, todayYmd, round1, calcKgFromYd, shortDate } from './orderCalculations';

export const ORDER_SCHEMA_VERSION = 8;

// ============================================================
// 1. 빈 구조 생성
// ============================================================
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const STEP_DEFAULTS = { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '' };

export const createStep = (key) => (
  key === 'knitting' ? { ...STEP_DEFAULTS, dailyKg: null } : { ...STEP_DEFAULTS }
);

export const createSteps = () => Object.fromEntries(ORDER_STEP_KEYS.map(k => [k, createStep(k)]));

const COLOR_DEFAULTS = {
  name: '',
  orderKg: null,
  workKg: null,          // null = 자동(오더kg × (1 + 로스율)), 숫자 = 직접 입력값
  greigeOutDate: '',     // 생지 출고일 (편직처 → 염색소)
  greigeOutDone: false,
  lots: [],
  confirmRounds: [],
  shipDate: '',
  shipDone: false,
  notes: '',
};

export const createColor = (name = '') => ({ ...COLOR_DEFAULTS, id: uid('col'), name, lots: [], confirmRounds: [] });

const LOT_DEFAULTS = { no: 1, machineKg: null, qtyKg: null, startDate: '', endDate: '', status: 'pending', rolls: null, notes: '' };

export const createLot = (no = 1, machineKg = null, qtyKg = null) => ({ ...LOT_DEFAULTS, id: uid('lot'), no, machineKg, qtyKg });

export const createConfirmRound = (round = 1) => ({ round, sentDate: '', resultDate: '', result: '' });

// 가납기 빈 값 { yarn: '', knitting: '', dyeing: '', visual_inspection: '' }
export const createProvisionalDue = () => Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => [k, '']));

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
    dyeVendor: '',
    steps: createSteps(),
    colors: [createColor('')],
    dailyNotes: [],
    provisionalDue: createProvisionalDue(),
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

const normalizeStep = (key, raw) => {
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
  };
  if (key === 'knitting') out.dailyKg = numOrNull(s.dailyKg);
  return out;
};

const normalizeLot = (raw, fallbackId, index) => {
  const l = raw && typeof raw === 'object' ? raw : {};
  return {
    ...LOT_DEFAULTS,
    ...l,
    id: l.id || fallbackId,
    no: numOrNull(l.no) ?? index + 1,
    machineKg: numOrNull(l.machineKg),
    qtyKg: numOrNull(l.qtyKg),
    startDate: str(l.startDate),
    endDate: str(l.endDate),
    status: normalizeStatus(l.status),
    rolls: numOrNull(l.rolls),
    notes: str(l.notes),
  };
};

const normalizeColor = (raw, fallbackId) => {
  const c = raw && typeof raw === 'object' ? raw : {};
  const id = c.id || fallbackId;
  return {
    ...COLOR_DEFAULTS,
    ...c,
    id,
    name: str(c.name),
    orderKg: numOrNull(c.orderKg),
    workKg: numOrNull(c.workKg),
    greigeOutDate: str(c.greigeOutDate),
    greigeOutDone: !!c.greigeOutDone,
    lots: (Array.isArray(c.lots) ? c.lots : []).map((l, li) => normalizeLot(l, `${id}_l${li}`, li)),
    confirmRounds: (Array.isArray(c.confirmRounds) ? c.confirmRounds : []).map((r, ri) => ({
      round: numOrNull(r?.round) ?? ri + 1,
      sentDate: str(r?.sentDate),
      resultDate: str(r?.resultDate),
      result: r?.result === 'pass' || r?.result === 'fail' ? r.result : '',
    })),
    shipDate: str(c.shipDate),
    shipDone: !!c.shipDone,
    notes: str(c.notes),
  };
};

// 가납기: 정해진 4공정만, 날짜 글자로 (예전 오더는 없음 → 모두 빈칸)
const normalizeProvisionalDue = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(PROVISIONAL_DUE_KEYS.map(k => [k, str(src[k])]));
};

const normalizeV8 = (raw) => {
  const id = raw.id;
  const steps = Object.fromEntries(ORDER_STEP_KEYS.map(k => [k, normalizeStep(k, raw.steps?.[k])]));
  let colors = (Array.isArray(raw.colors) ? raw.colors : []).map((c, i) => normalizeColor(c, `${id}_c${i}`));
  if (colors.length === 0) colors = [normalizeColor({}, `${id}_c0`)];
  const lossRate = numOrNull(raw.lossRate);
  return {
    ...raw,
    schemaVersion: ORDER_SCHEMA_VERSION,
    orderNumber: str(raw.orderNumber),
    articleNo: str(raw.articleNo),
    detail: str(raw.detail),
    customer: str(raw.customer),
    type: raw.type === 'sample' ? 'sample' : 'main',
    finalDueDate: str(raw.finalDueDate),
    lossRate: lossRate === null ? DEFAULT_LOSS_RATE : lossRate,
    status: normalizeOrderStatus(raw.status),
    notes: str(raw.notes),
    linkedFabricId: raw.linkedFabricId || null,
    linkedFabricArticle: str(raw.linkedFabricArticle),
    dyeVendor: str(raw.dyeVendor),
    steps,
    colors,
    dailyNotes: (Array.isArray(raw.dailyNotes) ? raw.dailyNotes : [])
      .filter(n => n && n.date)
      .map((n, i) => ({ id: n.id || `${id}_n${i}`, date: str(n.date), colorId: str(n.colorId), text: str(n.text), tone: str(n.tone) })),
    provisionalDue: normalizeProvisionalDue(raw.provisionalDue),
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
    schemaVersion: ORDER_SCHEMA_VERSION,
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
  if (Number(raw.schemaVersion) >= ORDER_SCHEMA_VERSION) return normalizeV8(raw);
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
  normalizeStatus(step.status) !== 'pending'
));

// 편직 예상 종료일: 시작일 + 총 작지kg ÷ 일일 생산량 (종료일 직접 입력이 없을 때 참고용)
export const getKnittingEstimatedEnd = (order) => {
  const k = order?.steps?.knitting;
  const daily = numOrNull(k?.dailyKg);
  if (!k?.startDate || !daily || daily <= 0) return '';
  const total = getOrderTotals(order).workKg;
  if (!total) return '';
  return addDaysYmd(k.startDate, Math.max(1, Math.ceil(total / daily)) - 1);
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

export const getLotsTotalKg = (lots = []) => round1(lots.reduce((s, l) => s + (Number(l.qtyKg) || 0), 0));

// 탕 용량별 묶음 요약: "300×2 · 500×1" (용량 미입력은 "용량?×N")
export const getLotSummary = (lots = []) => {
  if (!lots.length) return '';
  const groups = new Map();
  lots.forEach(l => {
    const k = numOrNull(l.machineKg);
    const key = k === null ? '용량?' : String(k);
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return [...groups.entries()].map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(' · ');
};

// 컬러의 염가공 상태 (LOT 없으면 null)
export const getLotsStatus = (lots = []) => (lots.length ? aggregateStatus(lots.map(l => normalizeStatus(l.status))) : null);

/**
 * 탕 용량으로 LOT 자동 분할 제안.
 * 예) 1231.2kg, 500kg 탕 → 3 LOT (410.4 / 410.4 / 410.4)
 * 마지막 LOT가 반올림 오차를 흡수해 합계가 정확히 totalKg와 같다.
 */
export const suggestLots = (totalKg, machineKg, startNo = 1) => {
  const total = Number(totalKg) || 0;
  const cap = Number(machineKg) || 0;
  if (total <= 0 || cap <= 0) return [];
  const n = Math.max(1, Math.ceil(total / cap - 1e-9));
  const each = round1(total / n);
  return Array.from({ length: n }, (_, i) => {
    const qty = i === n - 1 ? round1(total - each * (n - 1)) : each;
    return createLot(startNo + i, cap, qty);
  });
};

// ---------- 컨펌 ----------

// key: 'none' | 'ready'(라운드만 있음) | 'sent'(발송·결과대기) | 'pass' | 'fail'
export const getConfirmState = (color) => {
  const rounds = color?.confirmRounds || [];
  if (!rounds.length) return { key: 'none', label: '', round: 0 };
  const last = rounds[rounds.length - 1];
  const r = last.round || rounds.length;
  if (last.result === 'pass') return { key: 'pass', label: `${r}차 합격`, round: r };
  if (last.result === 'fail') return { key: 'fail', label: `${r}차 불합격`, round: r };
  if (last.sentDate) return { key: 'sent', label: `${r}차 컨펌중`, round: r };
  return { key: 'ready', label: `${r}차 준비`, round: r };
};

// ---------- 컬러 줄 현재 단계 (COLOR_STAGES 키) ----------
// 컬러별 사실(출고·컨펌·LOT·생지출고) 우선 → 오더 공통 공정(편직·원사) 순으로 판단
export const getColorStage = (order, color) => {
  if (!order || !color) return 'waiting';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'on_hold') return 'on_hold';
  if (color.shipDone) return 'shipped';

  const steps = order.steps || {};
  const st = (k) => normalizeStatus(steps[k]?.status);
  const lots = color.lots || [];
  const lotSt = lots.map(l => normalizeStatus(l.status));
  const confirm = getConfirmState(color);

  if (lotSt.includes('issue') || confirm.key === 'fail') return 'issue';
  if (confirm.key === 'pass') return 'ship_wait';
  if (confirm.key === 'sent') return 'confirm';

  const lotsAllDone = lotSt.length > 0 && lotSt.every(s => s === 'done');
  if (lotsAllDone) {
    if (['finishing', 'physical_test', 'visual_inspection'].some(k => st(k) === 'issue')) return 'issue';
    if (st('finishing') === 'in_progress') return 'finishing';
    if (st('physical_test') === 'in_progress' || st('visual_inspection') === 'in_progress') return 'inspection';
    // 후가공 외주처·일정만 입력되고 아직 시작 전 → 후가공대기 / 컨펌 라운드만 만들고 발송 전 → 컨펌대기
    if (isStepUsed(steps.finishing) && st('finishing') !== 'done') return 'finish_wait';
    return confirm.key === 'ready' ? 'confirm_wait' : 'ship_wait';
  }
  if (lotSt.some(s => s === 'in_progress' || s === 'done')) return 'dyeing';
  if (color.greigeOutDone) return 'dye_wait';

  if (['yarn', 'yarn_processing', 'knitting'].some(k => st(k) === 'issue')) return 'issue';
  if (st('knitting') === 'in_progress') return 'knitting';
  if (st('knitting') === 'done') return 'greige_wait';
  if (isStepUsed(steps.knitting)) return 'knit_wait';
  if (lots.length) return 'dye_wait';
  if (st('yarn') === 'in_progress' || st('yarn_processing') === 'in_progress') return 'yarn';
  return 'waiting';
};

// 납기 D-day (양수 = 남은 일수, 0 = 오늘, 음수 = 지남). 납기 없으면 null
export const getDday = (finalDueDate) => (finalDueDate ? diffDaysYmd(todayYmd(), finalDueDate) : null);

// ---------- 가납기 (대략적인 공정별 목표 날짜 — 원사·편직·염가공·외관검사) ----------

/**
 * 가납기와 비교할 그 공정의 "현재 날짜".
 *  - 원사·편직·외관검사: 완료면 완료일(없으면 종료일), 아니면 종료일 (편직은 일일 생산량으로 계산한 예상 종료일도)
 *  - 염가공: 모든 컬러 LOT 중 가장 늦은 완료예정일. LOT 가 전부 완료면 완료
 * 반환 { date('' = 일정 없음), done, estimated(편직 예상 종료) }
 */
export const getStepCurrentEnd = (order, key) => {
  if (key === 'dyeing') {
    const lots = (order?.colors || []).flatMap(c => c.lots || []);
    if (!lots.length) return { date: '', done: false, estimated: false };
    const done = lots.every(l => normalizeStatus(l.status) === 'done');
    return { date: maxYmd(lots.map(l => l.endDate)), done, estimated: false };
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

// 가납기와 비교한 "현재" 설명 (예: '종료 10/28 (예상)', 'LOT 완료예정 11/5', '완료 10/20', '일정 없음')
export const describeStepCurrent = (info) => {
  if (!info?.current) return info?.done ? '완료' : '일정 없음';
  const d = shortDate(info.current);
  if (info.done) return `완료 ${d}`;
  if (info.key === 'dyeing') return `LOT 완료예정 ${d}`;
  return `종료 ${d}${info.estimated ? ' (예상)' : ''}`;
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

export const getOrderTimeline = (order) => {
  const orderBars = [];
  ORDER_STEPS.forEach(meta => {
    const step = order?.steps?.[meta.key];
    if (!step) return;
    const range = span(step.startDate, getStepEnd(order, meta.key));
    if (!range) return;
    orderBars.push({
      id: `step_${meta.key}`,
      kind: 'step',
      stepKey: meta.key,
      theme: meta.key,
      label: `${meta.label}${step.vendor ? ` ${step.vendor}` : ''}`,
      status: normalizeStatus(step.status),
      estimated: meta.key === 'knitting' && !step.endDate,
      ...range,
    });
  });

  const colorRows = (order?.colors || []).map(color => {
    const bars = [];
    if (color.greigeOutDate) {
      bars.push({
        id: `greige_${color.id}`, kind: 'greige', theme: 'greige',
        label: color.greigeOutDone ? '생지출고' : '생지출고 예정',
        status: color.greigeOutDone ? 'done' : 'pending',
        start: color.greigeOutDate, end: color.greigeOutDate,
      });
    }
    (color.lots || []).forEach(lot => {
      const range = span(lot.startDate, lot.endDate);
      if (!range) return;
      bars.push({
        id: `lot_${lot.id}`, kind: 'lot', lotId: lot.id, theme: 'dyeing',
        label: `LOT${lot.no}${lot.machineKg ? ` ${lot.machineKg}kg탕` : ''}`,
        status: normalizeStatus(lot.status),
        ...range,
      });
    });
    (color.confirmRounds || []).forEach((r, ri) => {
      const range = span(r.sentDate, r.resultDate);
      if (!range) return;
      bars.push({
        id: `confirm_${color.id}_${ri}`, kind: 'confirm', theme: 'confirm',
        label: `${r.round || ri + 1}차 컨펌${r.result === 'pass' ? ' 합격' : r.result === 'fail' ? ' 불합격' : ''}`,
        status: r.result === 'pass' ? 'done' : r.result === 'fail' ? 'issue' : 'in_progress',
        ...range,
      });
    });
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
  }
  if (field === 'lossRate') {
    const n = numOrNull(value);
    next.lossRate = n === null ? DEFAULT_LOSS_RATE : Math.max(0, n);
  }
  return next;
};

// 원단 보관함에서 품번 선택 → article#·detail·gsm·폭 채움
export const applyFabric = (order, fabric) => {
  if (!fabric) return order;
  return {
    ...order,
    articleNo: str(fabric.article),
    linkedFabricId: fabric.id || null,
    linkedFabricArticle: str(fabric.article),
    detail: order.detail || str(fabric.itemName),
    gsm: Number(fabric.gsm) || order.gsm || 0,
    widthFull: Number(fabric.widthFull) || order.widthFull || 0,
  };
};

// 컬러 필드 patch
export const applyColorPatch = (order, colorId, patch) => ({
  ...order,
  colors: (order.colors || []).map(c => {
    if (c.id !== colorId) return c;
    const next = { ...c, ...patch };
    if ('name' in patch) next.name = str(patch.name).trim().toUpperCase();
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
  color.greigeOutDate || (color.lots || []).length || (color.confirmRounds || []).length ||
  color.shipDate || color.notes
));

// 공정 patch — 상태 '완료'로 바뀌면 완료일 오늘 자동, 완료가 풀리면 완료일 비움
export const applyStepPatch = (order, key, patch) => {
  const prev = order.steps?.[key] || createStep(key);
  const next = { ...prev, ...patch };
  if ('status' in patch) {
    next.status = normalizeStatus(patch.status);
    if (next.status === 'done' && !next.doneDate) next.doneDate = todayYmd();
    if (next.status !== 'done' && !('doneDate' in patch)) next.doneDate = '';
  }
  if ('dailyKg' in patch) next.dailyKg = numOrNull(patch.dailyKg);
  return { ...order, steps: { ...(order.steps || createSteps()), [key]: next } };
};

// 컬러 LOT 목록 통째로 교체 (번호 1..N 재정렬)
export const applyLots = (order, colorId, lots) => applyColorPatch(order, colorId, {
  lots: (lots || []).map((l, i) => ({ ...l, no: i + 1 })),
});

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
export const applyProvisionalDue = (order, patch) => {
  const next = normalizeProvisionalDue(order.provisionalDue);
  Object.entries(patch || {}).forEach(([k, v]) => {
    if (PROVISIONAL_DUE_KEYS.includes(k)) next[k] = str(v);
  });
  return { ...order, provisionalDue: next };
};

// ============================================================
// 6. 변경 이력 요약 (감사 로그) — 이전/이후 오더 비교해 한국어 한 줄로
// ============================================================
const ORDER_FIELD_LABELS = {
  orderNumber: 'order#', articleNo: 'article#', detail: '디테일', customer: 'buyer',
  type: '구분', finalDueDate: '납기', lossRate: '로스율', status: '오더상태', notes: '메모', dyeVendor: '염색소',
};
const STEP_FIELD_LABELS = {
  vendor: '외주처', startDate: '시작', endDate: '종료', status: '상태', doneDate: '완료일', notes: '메모', dailyKg: '일생산kg',
};
const COLOR_FIELD_LABELS = {
  name: '컬러명', orderKg: '오더kg', workKg: '작지kg', greigeOutDate: '생지출고일', greigeOutDone: '생지출고',
  shipDate: '출고일', shipDone: '출고', notes: '메모',
};
const LOT_FIELD_LABELS = {
  machineKg: '탕', qtyKg: '수량', startDate: '투입', endDate: '완료예정', status: '상태', rolls: '롤', notes: '메모',
};

const fmtVal = (field, v) => {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? '완료' : '미완료';
  if (field === 'status') return ORDER_STATUSES.find(s => s.key === v)?.label || getStatusLabel(v);
  if (field === 'type') return ORDER_TYPES.find(t => t.key === v)?.label || v;
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

export const summarizeOrderChange = (prev, next) => {
  if (!prev || !next) return null;
  const out = [];
  diffFields(prev, next, ORDER_FIELD_LABELS, '', out);

  // 원단 보관함 연결 (article# 글자가 이미 같아도 연결·해제는 변경으로 기록)
  if (str(prev.linkedFabricId) !== str(next.linkedFabricId)) {
    out.push(next.linkedFabricId
      ? `원단 보관함 연결 (${next.linkedFabricArticle || next.articleNo || '-'})`
      : '원단 보관함 연결 해제');
  }

  ORDER_STEP_KEYS.forEach(k => {
    diffFields(prev.steps?.[k], next.steps?.[k], STEP_FIELD_LABELS, `${getStepMeta(k)?.label || k} `, out);
  });

  // 가납기 (예: '가납기 편직 10/25→10/28')
  PROVISIONAL_DUE_STEPS.forEach(s => {
    const a = str(prev.provisionalDue?.[s.key]);
    const b = str(next.provisionalDue?.[s.key]);
    if (a !== b) out.push(`가납기 ${s.label} ${fmtVal('dueDate', a)}→${fmtVal('dueDate', b)}`);
  });

  const prevColors = prev.colors || [];
  const nextColors = next.colors || [];
  nextColors.forEach(c => {
    const old = prevColors.find(p => p.id === c.id);
    const cName = c.name || old?.name || '컬러';
    if (!old) { out.push(`컬러 추가${c.name ? ` (${c.name})` : ''}`); return; }
    diffFields(old, c, COLOR_FIELD_LABELS, `${cName} `, out);
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
      if (ol) diffFields(ol, l, LOT_FIELD_LABELS, `${cName} LOT${l.no} `, out);
    });
    if (JSON.stringify(old.confirmRounds || []) !== JSON.stringify(c.confirmRounds || [])) {
      const st = getConfirmState(c);
      out.push(`${cName} 컨펌 ${st.label || '변경'}`);
    }
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
