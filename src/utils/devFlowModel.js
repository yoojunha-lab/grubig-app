// ============================================================
// 개발 흐름 (개발 의뢰 → 설계서 → 생산 현황 샘플 → 아이템화 / Drop) — 화면과 무관한 순수 함수
//  개발 고도화 (대표님 요청 2026-11-24 '개발 고도화 좀 시켜줘' → 1·2단계)
//   · 샘플 진행 줄: EZ-TEX 를 등록해 생산 현황으로 간 건도 개발/설계 현황에 계속 보이게 (생산 상황 · 납기 · D-day)
//   · 견적 회신 대기 N일 (원가 견적을 내고 '대기 중'인 의뢰)
//   · 개발 통계: 의뢰 → 아이템화 걸린 날 · 아이템화/Drop 비율 · Drop 사유별 · 바이어별
// ============================================================
import { COLOR_STAGES } from '../constants/production';
import { DEV_DROP_REASONS } from '../constants/common';
import { getOrderProgressStage, isDropClosed } from './orderModel';

const str = (v) => String(v ?? '').trim();

// 날짜(YYYY-MM-DD 또는 ISO) → 그날 0시 (못 읽으면 null)
const toDay = (v) => {
  if (!v) return null;
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

/** from → to 사이 날 수 (둘 중 하나라도 못 읽으면 null) */
export const daysBetween = (from, to = new Date()) => {
  const a = toDay(from);
  const b = toDay(to);
  return a && b ? Math.round((b - a) / 864e5) : null;
};

// ── 생산 현황 샘플 오더의 지금 상황 ──
//  Drop 으로 닫힘 / 완료했지만 설계서가 아직 = 아이템화 대기 / 보류 / 그 밖엔 가장 덜 진행된 컬러 단계 (편직중·염색중 …)
//  반환 { key, label, cls } (오더가 없으면 null) — 개발/설계 현황 '샘플 진행' 표 · 보관함 '샘플 진행' 카드가 같이 씀
export const productionStateOf = (order, sheet) => {
  if (!order) return null;
  if (isDropClosed(order)) return { key: 'drop', label: 'Drop', cls: 'bg-rose-50 text-rose-600 border-rose-200' };
  if (order.status === 'completed' && sheet?.stage !== 'articled') {
    return { key: 'awaiting', label: '완료 · 아이템화 대기', cls: 'bg-amber-50 text-amber-800 border-amber-300' };
  }
  if (order.status === 'completed') return { key: 'completed', label: '완료', cls: 'bg-slate-100 text-slate-600 border-slate-300' };
  if (order.status === 'on_hold') return { key: 'on_hold', label: '보류', cls: 'bg-white text-slate-500 border-slate-300 border-dashed' };
  const key = getOrderProgressStage(order);
  if (key === 'issue') return { key, label: '문제 있음', cls: 'bg-rose-100 text-rose-700 border-rose-300' };
  const stage = COLOR_STAGES[key];
  return stage ? { key, label: stage.label, cls: stage.cls } : null;
};

/** 샘플 진행 줄의 납기 — 생산 현황 오더 납기 → 설계서 납기 → 의뢰 샘플 납기 */
export const sampleRowDeadline = ({ order, sheet, dev }) =>
  str(order?.finalDueDate) || str(sheet?.deadline) || str(dev?.targetSpec?.sampleDeadline) || null;

/** 글자에서 첫 숫자 (예: '58"' → 58, '300g/m2' → 300, '58/60' → 58, 못 읽으면 null)
 *  디버깅 2026-11-24: 예전엔 숫자 아닌 글자를 다 지우고 읽어서 '300g/m2' → 3002, '58/60' → 5860 이 됐음 */
export const numOf = (v) => {
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** 메인/QC 디테일 시트 한 장 → 마지막 수축 TEST 기준 실측 { gsm, width, status, round } (설계서 '실측 vs 설계' 칸) */
export const qcActualOf = (d) => {
  const tests = d?.tests || [];
  const last = tests[tests.length - 1] || {};
  const first = tests[0] || {};
  return {
    gsm: numOf(last.finGsm) ?? numOf(first.finGsm) ?? numOf(d?.finGsm),
    width: numOf(last.finWidthFull) ?? numOf(first.finWidthFull) ?? numOf(d?.finWidthFull),
    status: last.status || '',
    round: tests.length,
  };
};

/** 샘플 오더가 끝났는지 (완료 — 아이템화 대기 · Drop) → 납기 지연·임박으로 안 셈 */
export const isSampleOrderDone = (order) => order?.status === 'completed';

// ── 견적 회신 대기 ──
//  원가 견적을 저장하면 의뢰가 '대기 중'(바이어 결정 대기)으로 감 → 그때부터 며칠째인지
//  반환 { days, since, tone } (대기 중이 아니거나 원가 견적이 없으면 null)
export const replyWaitOf = (dev, today = new Date()) => {
  if (!dev || dev.status !== 'hold' || !dev.costQuote) return null;
  //  '대기 중'에 들어간 날과 원가 견적을 (다시) 저장한 날 중 늦은 날부터 — 견적을 늦게 보내거나 고쳐 다시 보내면 그날부터 셈
  //  (디버깅 2026-11-24: 예전엔 '대기 중' 들어간 날만 봐서 견적을 보낸 날에 벌써 '회신 대기 23일'이 떴음)
  const since = [dev.statusEnteredAt?.hold, dev.costQuote.updatedAt].filter(Boolean).sort().pop() || dev.updatedAt || '';
  const days = daysBetween(since, today);
  if (days == null || days < 0) return null;
  const tone = days >= 14 ? 'red' : days >= 7 ? 'amber' : 'slate';
  return { days, since, tone };
};
export const REPLY_WAIT_CLS = {
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  slate: 'bg-slate-50 text-slate-500 border-slate-200',
};

// ── 개발 의뢰가 쓰는 설계서 (Drop 제외) ──
export const liveSheetOfDev = (dev, designSheets = []) => (designSheets || []).find(s => s && s.status !== 'dropped'
  && (s.devRequestId === dev.id || (dev.linkedDesignSheetId && s.id === dev.linkedDesignSheetId))) || null;

/** 의뢰 결과 — 'articled'(아이템화) · 'dropped' · 'open'(진행 중). 예전 의뢰(상태가 '개발 확정'에 남은 것)는 설계서 단계로 봄 */
export const devOutcomeOf = (dev, sheet) => {
  if (dev?.status === 'rejected') return 'dropped';
  if (dev?.status === 'articled' || sheet?.stage === 'articled') return 'articled';
  return 'open';
};

/** 의뢰 → 아이템화 날 — 의뢰 일자(없으면 등록 시각)부터 아이템화된 날까지 */
export const devLeadDays = (dev, sheet) => {
  const start = dev?.requestDate || dev?.createdAt;
  const end = dev?.articledInfo?.at || dev?.statusEnteredAt?.articled || sheet?.stageEnteredAt?.articled;
  const d = daysBetween(start, end);
  return d == null || d < 0 ? null : d;
};

const avg = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
const median = (list) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * 개발 통계 (개발/설계 현황 '개발 통계' 칸)
 *  period: 'all' | 'year'(올해 의뢰) | '6m'(최근 6개월 의뢰) — 의뢰 일자 기준
 *  반환 {
 *    total, articled, dropped, open, articledPct, droppedPct,
 *    leadAvg, leadMedian, leadCount,          // 의뢰 → 아이템화 (끝난 의뢰만)
 *    drops: [{ key, label, cls, count, pct }], // Drop 사유별 (사유 없음 포함)
 *    buyers: [{ buyer, total, articled, dropped, open, leadAvg }], // 의뢰 많은 순
 *    selfArticled,                             // 같은 기간 아이템화된 자체개발 설계서
 *  }
 */
export const buildDevStats = ({ devRequests = [], designSheets = [], period = 'all', today = new Date() }) => {
  const now = toDay(today) || new Date();
  const from = period === 'year'
    ? new Date(now.getFullYear(), 0, 1)
    : period === '6m' ? new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) : null;
  const inPeriod = (dateLike) => {
    if (!from) return true;
    const d = toDay(dateLike);
    return !!d && d >= from;
  };

  const devs = (devRequests || []).filter(d => d && inPeriod(d.requestDate || d.createdAt));
  const rows = devs.map(d => {
    const sheet = liveSheetOfDev(d, designSheets);
    const outcome = devOutcomeOf(d, sheet);
    return { dev: d, sheet, outcome, lead: outcome === 'articled' ? devLeadDays(d, sheet) : null };
  });
  const total = rows.length;
  const count = (k) => rows.filter(r => r.outcome === k).length;
  const articled = count('articled');
  const dropped = count('dropped');
  const open = total - articled - dropped;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const leads = rows.map(r => r.lead).filter(n => n != null);

  // Drop 사유별 (사유 기능 전에 Drop된 의뢰 = 사유 없음)
  const droppedRows = rows.filter(r => r.outcome === 'dropped');
  const drops = [
    ...DEV_DROP_REASONS.map(r => ({ key: r.key, label: r.label, cls: r.cls, count: droppedRows.filter(x => x.dev.dropReason === r.key).length })),
    { key: 'none', label: '사유 없음', cls: 'bg-white text-slate-400 border-slate-200',
      count: droppedRows.filter(x => !DEV_DROP_REASONS.some(r => r.key === x.dev.dropReason)).length },
  ].filter(x => x.count > 0)
    .map(x => ({ ...x, pct: droppedRows.length ? Math.round((x.count / droppedRows.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // 바이어별
  const byBuyer = new Map();
  rows.forEach(r => {
    const buyer = str(r.dev.buyerName) || '(바이어 없음)';
    if (!byBuyer.has(buyer)) byBuyer.set(buyer, { buyer, total: 0, articled: 0, dropped: 0, open: 0, leads: [] });
    const b = byBuyer.get(buyer);
    b.total += 1;
    b[r.outcome] += 1;
    if (r.lead != null) b.leads.push(r.lead);
  });
  const buyers = [...byBuyer.values()]
    .map(({ leads: l, ...b }) => ({ ...b, leadAvg: avg(l) }))
    .sort((a, b) => b.total - a.total || a.buyer.localeCompare(b.buyer, 'ko'));

  // 자체개발 설계서 (의뢰 없이) — 같은 기간 아이템화된 것
  const selfArticled = (designSheets || []).filter(s => s && s.status !== 'dropped' && s.stage === 'articled'
    && !(devRequests || []).some(d => d.id === s.devRequestId)
    && inPeriod(s.stageEnteredAt?.articled || s.updatedAt)).length;

  return {
    total, articled, dropped, open,
    articledPct: pct(articled), droppedPct: pct(dropped),
    leadAvg: avg(leads), leadMedian: median(leads), leadCount: leads.length,
    drops, buyers, selfArticled,
  };
};

// ── 의뢰를 고칠 때 연결된 곳 (설계서 · 생산 현황 샘플 오더) 에 넘길 값 ──
//  before: 저장 전 의뢰 · after: 저장한 폼 값 · sheet: 그 의뢰의 설계서 · order: 그 설계서의 샘플 오더
//  반환 [{ target: 'sheet'|'order', field, label, from, to }] — 바뀌는 칸만 (값이 이미 같으면 뺌)
export const devChangePlan = ({ before, after, sheet, order }) => {
  if (!before || !after) return [];
  const plan = [];
  const oldDue = str(before.targetSpec?.sampleDeadline);
  const newDue = str(after.targetSpec?.sampleDeadline);
  //  샘플이 이미 끝났으면(완료 · Drop) 설계서 납기도 그대로 (디버깅 2026-11-24 — 예전엔 끝난 샘플의 설계서 납기만 바꾸자고 했음)
  if (newDue && newDue !== oldDue && !isSampleOrderDone(order)) {
    if (sheet && str(sheet.deadline) !== newDue) plan.push({ target: 'sheet', field: 'deadline', label: '설계서 납기', from: str(sheet.deadline), to: newDue });
    if (order && str(order.finalDueDate) !== newDue) {
      plan.push({ target: 'order', field: 'finalDueDate', label: `샘플 오더(${order.orderNumber || '-'}) 납기`, from: str(order.finalDueDate), to: newDue });
    }
  }
  const oldBuyer = str(before.buyerName);
  const newBuyer = str(after.buyerName);
  if (newBuyer && newBuyer !== oldBuyer && order && str(order.customer) !== newBuyer) {
    plan.push({ target: 'order', field: 'customer', label: `샘플 오더(${order.orderNumber || '-'}) 바이어`, from: str(order.customer), to: newBuyer });
  }
  return plan;
};

// ── 가설계서 → 정식 설계서 (개발 고도화 3단계 2026-11-24) ──
/** 이 가설계서로 만든 정식 설계서 (Drop 빼고) — 설계서 fromTemp.tempId 로 찾음 */
export const promotedSheetsOfTemp = (tempId, designSheets = []) => (tempId
  ? (designSheets || []).filter(s => s && s.status !== 'dropped' && String(s.fromTemp?.tempId || '') === String(tempId))
  : []);
/** 설계서를 가리키는 짧은 이름 — 'PW1050 · 코튼 스판 저지' */
export const sheetShortLabel = (s) => [s?.articleNo || s?.eztexOrderNo || s?.devOrderNo, s?.fabricName].map(v => String(v || '').trim()).filter(Boolean).join(' · ') || '이름 없는 설계서';

// ── 개발 의뢰 '아이템화 완료' ↔ '개발 확정' 바꾸는 값 (리팩토링 2026-11-24 — useDesignSheet 네 곳이 따로 만들던 것을 하나로) ──
/** 아이템화 완료로 — { status, linkedDesignSheetId, articledInfo, statusEnteredAt, updatedAt }
 *  linkAndConfirm 이 바로 앞에서 '개발 확정'으로 바꾸고 아직 목록에 안 들어온 경우에도 확정 날짜가 비지 않게 confirmed 도 채움 */
export const devArticledPatch = (dev, { sheet, fabric = null, at = new Date().toISOString() }) => ({
  status: 'articled',
  linkedDesignSheetId: sheet?.id || null,
  articledInfo: dev?.articledInfo && dev.articledInfo.sheetId === sheet?.id ? dev.articledInfo : {
    sheetId: sheet?.id || null,
    articleNo: String(fabric?.article || sheet?.articleNo || ''),
    fabricId: fabric?.id || sheet?.linkedFabricId || null,
    at: sheet?.stageEnteredAt?.articled || at,
    prevStatus: dev?.status || '',
  },
  statusEnteredAt: {
    ...(dev?.statusEnteredAt || {}),
    confirmed: dev?.statusEnteredAt?.confirmed || at,
    articled: at,
  },
  updatedAt: at,
});
/** '개발 확정'으로 되돌리기 (아이템화를 되돌림 · 설계서 연결 해제) — articledInfo 는 빼고 확정 날짜를 새로 */
export const devReopenDoc = (dev, { sheetId = null, at = new Date().toISOString() } = {}) => {
  const { articledInfo: _articledInfo, ...rest } = dev || {};
  return {
    ...rest,
    status: 'confirmed',
    linkedDesignSheetId: sheetId,
    statusEnteredAt: { ...(dev?.statusEnteredAt || {}), confirmed: at },
    updatedAt: at,
  };
};

// ── 개발 건 한 줄 (개발/설계 현황 표 · 샘플 진행 표 공용 — 리팩토링 2026-11-24) ──
//  row = { dev, sheet, linkedDev, ... }
export const rowOdNo = (row) => str(row?.dev?.devOrderNo || row?.sheet?.devOrderNo);
export const rowTitle = (row) => (row?.dev
  ? (row.dev.devItem || row.dev.targetSpec?.composition || '품목명 미입력')
  : (row?.sheet?.fabricName || '원단명 미입력'));
/** 의뢰 + 설계서 줄: 설계서 원단명을 둘째 줄에 (품목명과 같으면 한 번만) */
export const showSheetName = (row) => !!(row?.dev && row?.sheet) && str(row.sheet.fabricName) !== str(rowTitle(row));
/** 바이어 — 의뢰 바이어 / 설계서가 가리키는 의뢰(Drop 등) / 가설계서에 적은 바이어 */
export const rowBuyerName = (row) => row?.dev?.buyerName || row?.linkedDev?.buyerName || row?.sheet?.fromTemp?.buyerName || '';

// ── 메인/QC 디테일 시트 찾기 (설계서 칸 · 생산 현황 상세창 공용 — 디버깅 2026-11-24) ──
const sameText = (a, b) => !!str(a) && str(a).toUpperCase() === str(b).toUpperCase();
/**
 * 이 오더 · 설계서의 QC 시트 (최근 순)
 *  · '생산 현황에서 고르기'로 오더를 이은 시트(orderId)는 그 오더에만 — 예전엔 order# 글자가 같은 다른 오더에도 보였음
 *  · 오더를 안 이은 예전 시트는 Order No 글자로 · 설계서는 Article 글자로도
 */
export const qcDetailsFor = (mainDetails = [], { orderId = null, orderNo = '', articleNo = '' } = {}) => (mainDetails || [])
  .filter(d => d && (
    (orderId && d.orderId === orderId)
    || (!d.orderId && orderNo && sameText(d.orderNo, orderNo))
    || (articleNo && sameText(d.articleNo, articleNo))
  ))
  .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

/** 실측이 설계(목표)에서 몇 % 벗어났는지 — 목표가 없으면 null */
export const specDiffPct = (actual, target) => (actual != null && target ? Math.round(((actual - target) / target) * 1000) / 10 : null);
/** ±5% 밖인지 (견적서 '중량·폭 ±5% 오차 허용'과 같은 기준) */
export const SPEC_TOL_PCT = 5;
export const isOffSpec = (actual, target) => {
  const p = specDiffPct(actual, target);
  return p != null && Math.abs(p) > SPEC_TOL_PCT;
};
