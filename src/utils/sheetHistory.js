// ============================================================
// 설계서 변경 이력 — 공용 계산 (개발 고도화 3단계, 대표님 요청 2026-11-24 '변경 이력 빈틈 메우기')
//  이력 한 건: { date, fields: { 칸: 바뀌기 전 값 }, to: { 칸: 바뀐 뒤 값 }, by: 누가, reason }
//   · to · by 는 2026-11-24부터 (예전 이력은 '옛 값 ▶ 변경됨')
//  · 조직도 피더 줄 요약 / 원단 관리에서 고친 값을 설계서 이력으로 / 화면에 보일 값 글자
// ============================================================

import { DEFAULT_KNIT_GRADE_ID, DEFAULT_PROCESS_TYPE_ID } from '../constants/costing';
import { resolveKnitKgRate, normalizeExtraCosts } from './costModel';
import { num } from './helpers';

const str = (v) => String(v ?? '').trim();

/**
 * 원가 칸의 '예전 값' — 새 원가 필드(편직 난이도 · kg단가 · 가공 유형)가 없던 예전 설계서는 기본값으로 계산돼 왔으므로 그 값
 *  (설계서 저장 · 원단 관리 동기화가 같은 규칙 — 리팩토링 2026-11-24, 예전엔 설계서 저장에만 있었음)
 */
export const defaultedCostValue = (ci, key) => {
  const c = ci || {};
  if (key === 'knitGrade') return c.knitGrade || DEFAULT_KNIT_GRADE_ID;
  if (key === 'knitKgRate') return resolveKnitKgRate(c);
  if (key === 'processType') return c.processType || DEFAULT_PROCESS_TYPE_ID;
  return c[key];
};
// 글자로 비교하는 원가 칸 (그 밖은 숫자)
export const TEXT_COST_KEYS = new Set(['knitGrade', 'processType']);

// 원가 표의 목록 칸 — 이력에는 바뀌기 전 내용을 짧은 글자로 (줄 id 는 빼고 비교)
const toList = (v) => (Array.isArray(v) ? v : []);
export const COST_LIST_SUMMARIES = {
  knitKgRateTiers: { read: toList, summary: (list) => list.map(t => `${num(t.fromKg)}kg~ ${num(t.rate)}원`).join(', ') },
  finishing: { read: toList, summary: (list) => list.map(f => `${f.name || '후가공'} ${num(f.fee)}원·LOSS ${Number(f.lossPct) || 0}%`).join(', ') },
  etcCosts: { read: normalizeExtraCosts, summary: (list) => list.map(e => `${e.name || '추가비용'} ${num(e.perYd)}원/yd`).join(', ') },
};
const comparableList = (list) => JSON.stringify(list.map(({ id: _id, ...rest }) => rest));
/** 원가 목록 칸 비교 → 바뀌었으면 { from, to } 글자, 같으면 null */
export const costListChange = (key, oldVal, newVal) => {
  const { read, summary } = COST_LIST_SUMMARIES[key];
  const a = read(oldVal);
  const b = read(newVal);
  if (comparableList(a) === comparableList(b)) return null;
  return { from: summary(a) || '(없음)', to: summary(b) || '(없음)' };
};

/**
 * 이력에서 '같은 값'인지 — 숫자 칸은 ''·null·0 을 같게, '58' 과 58 도 같게 (리팩토링 2026-11-24)
 *  예전엔 칸이 없던 원사 칸(비율 '')을 0으로 채우거나 위험마진 '' → 0 으로 저장될 때 '바뀜' 이력이 헛으로 생겼음
 */
export const sameHistoryValue = (a, b, { numeric = false } = {}) => {
  if (str(a) === str(b)) return true;
  if (!numeric) return false;
  const na = str(a) === '' ? 0 : Number(a);
  const nb = str(b) === '' ? 0 : Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
};

/** 조직도 피더 줄 → 짧은 글자 ('F1 Y1 ︹︺ L2.8 / F2 …', 비었으면 '(없음)') */
export const feederSummary = (feeders) => {
  const list = (Array.isArray(feeders) ? feeders : [])
    .map((f, i) => {
      const parts = [
        f?.yarnSlot ? `Y${f.yarnSlot}` : '',
        str(f?.symbol),
        str(f?.loopLength) ? `L${str(f.loopLength)}` : '',
      ].filter(Boolean);
      return parts.length ? `F${i + 1} ${parts.join(' ')}` : '';
    })
    .filter(Boolean);
  return list.length ? list.join(' / ') : '(없음)';
};

// 참/거짓 칸 (개폭선 · 오픈개폭)
const BOOL_KEYS = new Set(['knitting.hasOpenWidth', 'knitting.isOpenWidth']);
// 상태 칸 (Drop 복원 이력) — 예전엔 'dropped' 영어가 그대로 보였음 (2026-11-24)
const STATUS_TEXT = { dropped: 'Drop', active: '진행' };

/** 이력에 보일 값 글자 — 빈 값 '(비어있음)', 참/거짓 칸 '있음/없음', 상태 'Drop/진행' */
export const historyValueText = (key, value) => {
  if (BOOL_KEYS.has(key)) return value === true || value === 'true' ? '있음' : '없음';
  if (key === 'status') return STATUS_TEXT[str(value)] || str(value) || '(비어있음)';
  const s = str(value);
  return s || '(비어있음)';
};

/**
 * 원단 관리에서 원단을 고쳐 저장 → 연결된 설계서에 넘어가는 값의 이력 (예전엔 설계서 이력에 안 남았음)
 *  before: 설계서(바뀌기 전) · after: 원단에서 넘어온 값을 얹은 설계서 · yarnName: (yarnId) => 이름
 *  반환: 이력 한 건 (바뀐 칸이 없으면 null)
 */
export const fabricSyncHistoryEntry = ({ before, after, yarnName = () => '', by = '', now = new Date().toISOString() }) => {
  if (!before || !after) return null;
  const fields = {};
  const to = {};
  const put = (key, oldVal, newVal, numeric = false) => {
    if (sameHistoryValue(oldVal, newVal, { numeric })) return;
    fields[key] = str(oldVal);
    to[key] = str(newVal);
  };
  put('articleNo', before.articleNo, after.articleNo);
  put('fabricName', before.fabricName, after.fabricName);
  //  편직 난이도 · kg단가 · 가공 유형은 예전 설계서의 빈 값 = 기본값으로 보고 비교 (설계서 저장과 같은 규칙)
  ['widthFull', 'widthCut', 'gsm', 'costGYd', 'dyeingFee', 'knitGrade', 'knitKgRate', 'processType', 'marginTier', 'riskMarginPct']
    .forEach(k => put(`costInput.${k}`, defaultedCostValue(before.costInput, k), defaultedCostValue(after.costInput, k), !TEXT_COST_KEYS.has(k)));
  //  kg단가 구간 · 후가공 · 추가비용 목록도 (예전엔 원단 관리에서 고쳐도 설계서 이력에 안 남았음)
  Object.keys(COST_LIST_SUMMARIES).forEach(k => {
    const c = costListChange(k, before.costInput?.[k], after.costInput?.[k]);
    if (c) { fields[`costInput.${k}`] = c.from; to[`costInput.${k}`] = c.to; }
  });
  const n = Math.max((before.yarns || []).length, (after.yarns || []).length);
  for (let i = 0; i < n; i += 1) {
    const a = (before.yarns || [])[i] || {};
    const b = (after.yarns || [])[i] || {};
    put(`yarns.${i}.ratio`, a.ratio ?? '', b.ratio ?? '', true);
    if (str(a.yarnId).split('::')[0] !== str(b.yarnId).split('::')[0]) {
      fields[`yarns.${i}.yarnId`] = yarnName(a.yarnId);
      to[`yarns.${i}.yarnId`] = yarnName(b.yarnId);
    }
  }
  if (!Object.keys(fields).length) return null;
  return { date: now, fields, to, by, reason: '원단 관리에서 수정' };
};
