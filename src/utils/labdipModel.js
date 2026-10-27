import { todayLocalISO } from './helpers';
import { DONE_TONE } from '../constants/production';

// ============================================================
// GRUBIG ERP - LAB-DIP (생산 ▾ LAB-DIP) 계산 모음 — 대표님 요청 2026-10-27
//  · 의뢰 한 건 = L/D NO. 하나(GB26023) = 아티클 하나 + 컬러 여러 개
//  · 흐름: [공장에 의뢰] 의뢰서 인쇄 / [바이어 발송만] EZ-TEX에서 의뢰
//          → L/D 도착(공장 번호 25S038 · 낱장 A~) → 바이어 발송 → 컨펌 · 리젝(→ 같은 번호 2차 의뢰) · Drop
//  · 상태는 컬러마다 — 컬러의 차수(rounds) 중 마지막이 지금. 의뢰 줄은 컬러 상태를 모아 탭(진행중 · 컨펌대기중 · 완료)에 나눔
//  · 바이어 시트에는 공장을 절대 안 찍음 (buildBuyerSheet에 공장 칸이 아예 없음)
//    공장 의뢰서에는 바이어 · STYLE을 안 찍음 (대표님 결정 2026-10-27 — 공장에도 바이어를 숨김)
//  · 예전 'Lab-Dip 발송' 기록(schemaVersion 없음)은 normalizeLabdip이 새 모양으로 바꿔 읽음 → '완료'(예전 기록)
//  · 화면 · 인쇄 · 저장이 모두 이 함수들을 씀 (React 없음 — Node에서도 시험 가능)
// ============================================================

export const LD_SCHEMA_VERSION = 2;

/** 해마다 이 화면 밖에서 이미 쓴 마지막 번호 — 26년은 22번까지 썼음 → GB26023부터 (대표님 2026-10-27). 다른 해는 001부터 */
export const LD_NO_USED_BEFORE = { 26: 22 };

/** 의뢰 방식 — 만들 때 [+ 새 L/D ▾]에서 고름 (작성 화면에서 바꿀 수 있음) */
export const LD_MODES = [
  { key: 'factory', label: '공장에 의뢰', short: '공장 의뢰', desc: '의뢰서를 인쇄해 공장에 보내요 — PANTONE 번호를 적거나 바이어 스와치를 붙여서' },
  { key: 'direct', label: '바이어 발송만 (EZ-TEX 의뢰)', short: 'EZ-TEX 의뢰', desc: '공장 의뢰는 EZ-TEX에서 했어요 — 여기서는 L/D가 오면 바이어 발송 · 결과만' },
];
export const ldModeOf = (key) => LD_MODES.find(m => m.key === key) || LD_MODES[0];

// ── 컬러 단계 ────────────────────────────────────────────────
//  tab: 이 단계 컬러가 있으면 의뢰 줄이 그 탭에 나옴 (완료 탭은 모든 컬러가 끝났을 때만)
//  색: 진행중 파랑 · 문제(리젝) 빨강 · 끝남 회색 (생산 현황 색 규칙과 같게 — DONE_TONE)
export const LD_STAGES = {
  factory: { label: '공장 진행중', tab: 'active', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  arrived: { label: 'L/D 도착', tab: 'active', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  reject: { label: '리젝', tab: 'active', cls: 'bg-red-100 text-red-700 border-red-300' },
  waiting: { label: '컨펌대기', tab: 'waiting', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  confirm: { label: '컨펌', tab: 'done', cls: DONE_TONE.chip },
  drop: { label: 'Drop', tab: 'done', cls: 'bg-white text-slate-400 border-slate-300 border-dashed line-through' },
  legacy: { label: '예전 기록', tab: 'done', cls: DONE_TONE.chip },
};
export const LD_STAGE_ORDER = ['factory', 'arrived', 'reject', 'waiting', 'confirm', 'drop', 'legacy'];
export const isFinishedStage = (stage) => stage === 'confirm' || stage === 'drop' || stage === 'legacy';

export const LD_TABS = [
  { key: 'active', label: '진행중', hint: '공장이 만드는 중 · 도착했는데 아직 바이어에게 안 보냄 · 리젝(2차 의뢰 전)' },
  { key: 'waiting', label: '컨펌대기중', hint: '바이어에게 보내고 결과를 기다리는 중' },
  { key: 'done', label: '완료', hint: '모든 컬러가 컨펌 또는 Drop' },
];

/** 광원 — 바이어가 색을 보는 조명 (공장 의뢰서에 찍힘) */
export const LIGHT_SOURCES = ['D65', 'TL84', 'CWF', 'A'];

/** 울 종류 — ITEM NAME에 슈퍼워시인지 안 써 있어서 따로 고름 (원사 이름에 SW가 있으면 슈퍼워시로 자동) */
export const WOOL_TYPES = [
  { key: 'superwash', label: '슈퍼워시 (SW)', sheet: '슈퍼워시 울 (SUPERWASH)' },
  { key: 'regular', label: '레귤러 울', sheet: '레귤러 울 (REGULAR WOOL)' },
  { key: 'none', label: '울 없음', sheet: '' },
];
export const woolTypeOf = (key) => WOOL_TYPES.find(w => w.key === key) || null;

/** 발송 방법 빠른 선택값 (자유 입력도 됨 — datalist) */
export const SENT_METHODS = ['퀵서비스', '택배', '방문 수령', '직접 전달', 'DHL', 'EMS', '이메일(스캔)'];

export const LD_LETTERS_DEFAULT = 2;  // 낱장 수 기본 (A~B)
export const LD_LETTERS_PICK = 8;     // 낱장 수 고르기 칸 (1~8장)
export const WAITING_WARN_DAYS = 7;   // 컨펌대기 — 보낸 지 이만큼 지나면 노랑 (바이어 재촉)

const str = (v) => (v === undefined || v === null ? '' : String(v));
const clampInt = (v, min, max, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
let localSeq = 0;
const newLocalId = (prefix) => `${prefix}_${Date.now()}_${(localSeq++).toString(36)}${Math.floor(Math.random() * 1000)}`;
export const newLabdipId = () => `labdip_${Date.now()}`;

// ── 낱장 글자 ─────────────────────────────────────────────────
/** 낱장 수 → 글자 (3 → A B C, 시작 3이면 D E F) */
export const labdipLetters = (count, start = 0) => {
  const s = clampInt(start, 0, 25, 0);
  const n = clampInt(count, 0, 26 - s, 0);
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + s + i));
};
export const letterOf = (idx) => String.fromCharCode(65 + clampInt(idx, 0, 25, 0));
export const roundLetters = (round) => labdipLetters(round?.letters, round?.startIdx);
/** 'A~C' (한 장이면 'A') */
export const letterRangeText = (round) => {
  const ls = roundLetters(round);
  if (!ls.length) return '';
  return ls.length === 1 ? ls[0] : `${ls[0]}~${ls[ls.length - 1]}`;
};
/** 바이어 시트 번호 — '25S038 "A" "B"' */
export const roundNoText = (round) => {
  const no = str(round?.factoryNo).trim();
  const ls = roundLetters(round).map(L => `"${L}"`).join(' ');
  return [no, ls].filter(Boolean).join(' ');
};

// ── 빈 모양 ───────────────────────────────────────────────────
/**
 * 차수 한 번 — 1차의 의뢰일 · 공장 납기는 의뢰(머리) 값을 씀, 2차부터는 차수에 따로
 *  letters: 낱장 수 (의뢰할 때는 몇 가지 받을지, 도착하면 실제 낱장 수)
 *  startIdx: 첫 낱장 글자 (0 = A) — 2차가 1차와 같은 공장 번호면 이어서 (1차 A~C → 2차 D~)
 */
export const makeRound = (no = 1, fields = {}) => ({
  no,
  requestDate: '',
  factoryDue: '',
  requestNote: '',       // 2차부터 — 공장에 전할 말 (바이어 리젝 코멘트에서 채움)
  letters: LD_LETTERS_DEFAULT,
  startIdx: 0,
  factoryNo: '',         // 공장 번호 (예: 25S038)
  receivedDate: '',      // L/D 도착일
  sentDate: '',          // 바이어 발송일
  sentMethod: '',
  result: '',            // '' | 'confirm' | 'reject'
  resultDate: '',
  confirmedLetter: '',   // 컨펌한 낱장 (예: 'B')
  buyerComment: '',      // 바이어 코멘트 (리젝이면 → 다음 차수 의뢰 메모)
  ...fields,
});

export const makeColor = (fields = {}) => ({
  id: newLocalId('c'),
  name: '',
  pantone: '',           // PANTONE 번호 (공장 의뢰서)
  swatch: false,         // 바이어 스와치 첨부 — 의뢰서에 붙이는 칸
  memo: '',              // 공장에 전할 말 (의뢰서)
  comment: '',           // 바이어 시트 컬러 코멘트 (예전 '컬러 코멘트' 그대로)
  droppedAt: '',         // Drop한 날 (바이어가 이 컬러를 안 하기로)
  rounds: [makeRound(1)],
  ...fields,
});

export const makeBlankLabdip = (mode = 'factory', today = todayLocalISO()) => ({
  schemaVersion: LD_SCHEMA_VERSION,
  ldNo: '',              // 저장할 때 자동 (GB + 의뢰일 연도 2자리 + 3자리)
  mode: mode === 'direct' ? 'direct' : 'factory',
  eztexNo: '',           // EZ-TEX L/D 번호 (바이어 발송만)
  buyerName: '',
  factory: '',           // 염가공처 — 바이어 시트에는 절대 안 찍힘
  requestDate: today,    // 의뢰일 (번호 연도 기준)
  factoryDue: '',        // 공장 납기 (1차 — L/D가 와야 하는 날)
  buyerDue: '',          // 바이어 납기 (바이어에게 보내기로 한 날, 선택)
  fabricId: '',          // 원단 관리 연결 (고를 때 아래 값을 복사 — 의뢰서에 적은 값이 그대로 남게)
  article: '',
  itemName: '',
  gsm: '',
  widthCut: '',
  widthFull: '',
  style: '',             // 바이어 STYLE — 공장 의뢰서에는 안 찍힘
  woolType: '',          // 'superwash' | 'regular' | 'none' | '' (아직 모름)
  woolManual: false,     // 담당자가 직접 고름 → 원단 · ITEM NAME이 바뀌어도 자동으로 안 바꿈
  lightSources: [],
  remarks: '',           // 특이사항 (공장 의뢰서에 찍힘)
  memo: '',              // 내부 메모 (어디에도 안 찍힘)
  legacy: false,         // 예전 'Lab-Dip 발송' 기록에서 옴
  legacyDone: false,     // 예전 기록을 '완료'로 보관 중 ([컨펌대기로] 누르면 false)
  colors: [makeColor()],
});

// ── 읽기 (저장된 문서 → 화면 모양) ─────────────────────────────
const normalizeRound = (r, i) => {
  const startIdx = clampInt(r?.startIdx, 0, 25, 0);
  return {
    ...makeRound(i + 1),
    ...(r || {}),
    no: i + 1,
    letters: clampInt(r?.letters, 1, 26 - startIdx, LD_LETTERS_DEFAULT),
    startIdx,
    result: r?.result === 'confirm' || r?.result === 'reject' ? r.result : '',
  };
};

const normalizeColor = (c) => ({
  ...makeColor(),
  ...(c || {}),
  id: str(c?.id) || newLocalId('c'),
  swatch: !!c?.swatch,
  droppedAt: str(c?.droppedAt),
  rounds: (Array.isArray(c?.rounds) && c.rounds.length ? c.rounds : [{}]).map(normalizeRound),
});

/** 예전 'Lab-Dip 발송' 기록 (2026-08 ~ 10, 바이어 시트만 있던 기록) → 새 모양 */
const fromLegacy = (raw) => {
  const base = makeBlankLabdip('direct', str(raw.date) || todayLocalISO());
  const colors = (Array.isArray(raw.colors) ? raw.colors : []).map(c => makeColor({
    id: str(c?.id) || newLocalId('c'),
    name: str(c?.name),
    comment: str(c?.comment),
    rounds: [makeRound(1, {
      factoryNo: str(c?.baseNo),
      letters: clampInt(c?.letters, 1, 26, LD_LETTERS_DEFAULT),
      receivedDate: str(raw.date),
      sentDate: str(raw.sentDate),
      sentMethod: str(raw.sentMethod),
    })],
  }));
  return {
    ...base,
    id: raw.id,
    buyerName: str(raw.buyerName),
    article: str(raw.article),
    style: str(raw.style),
    memo: str(raw.remarks),       // 예전 '특이사항'은 PDF에 안 찍히던 기록용 → 내부 메모
    legacy: true,
    legacyDone: true,             // 예전 기록은 '완료'로 보관 — 아직 회신을 기다리면 [컨펌대기로]
    colors: colors.length ? colors : [makeColor()],
    authorName: raw.authorName,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

/** 저장된 문서(새 모양 · 예전 기록) → 화면에서 쓰는 모양 */
export const normalizeLabdip = (raw) => {
  if (!raw) return makeBlankLabdip();
  if (!raw.schemaVersion) return fromLegacy(raw);
  const colors = (Array.isArray(raw.colors) ? raw.colors : []).map(normalizeColor);
  return {
    ...makeBlankLabdip(raw.mode),
    ...raw,
    mode: raw.mode === 'direct' ? 'direct' : 'factory',
    woolManual: !!raw.woolManual,
    lightSources: Array.isArray(raw.lightSources) ? raw.lightSources.filter(l => LIGHT_SOURCES.includes(l)) : [],
    legacy: !!raw.legacy,
    legacyDone: !!raw.legacyDone,
    colors: colors.length ? colors : [makeColor()],
  };
};

// ── 컬러 상태 ─────────────────────────────────────────────────
export const currentRound = (color) => {
  const rs = color?.rounds;
  return Array.isArray(rs) && rs.length ? rs[rs.length - 1] : makeRound(1);
};
export const prevRound = (color) => {
  const rs = color?.rounds || [];
  return rs.length >= 2 ? rs[rs.length - 2] : null;
};

/** 칸이 다 빈 컬러 줄 (작성 중 새 줄) — 저장 · 상태 계산에서 뺌 */
export const isBlankColor = (c) => !str(c?.name).trim() && !str(c?.pantone).trim()
  && !(c?.rounds || []).some(r => str(r?.factoryNo).trim());
export const realColors = (ld) => (ld?.colors || []).filter(c => !isBlankColor(c));

/** 컬러의 지금 단계 — factory · arrived · reject · waiting · confirm · drop · legacy */
export const colorStage = (color, ld) => {
  if (color?.droppedAt) return 'drop';
  const r = currentRound(color);
  if (r.result === 'confirm') return 'confirm';
  if (r.result === 'reject') return 'reject';
  if (ld?.legacyDone) return 'legacy';
  if (r.sentDate) return 'waiting';
  if (r.receivedDate || str(r.factoryNo).trim()) return 'arrived';
  return 'factory';
};

/** 단계별 컬러 수 — { factory: 2, waiting: 1, … } */
export const stageCounts = (ld) => {
  const counts = {};
  realColors(ld).forEach(c => {
    const s = colorStage(c, ld);
    counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
};

/** 이 의뢰가 나오는 탭 — 끝나지 않은 컬러의 탭 모두 (섞여 있으면 둘 다), 모든 컬러가 끝났으면 완료 */
export const labdipTabKeys = (ld) => {
  const stages = realColors(ld).map(c => colorStage(c, ld));
  if (!stages.length) return ['active'];
  const open = stages.filter(s => !isFinishedStage(s));
  if (!open.length) return ['done'];
  return [...new Set(open.map(s => LD_STAGES[s].tab))];
};
export const isAllDropped = (ld) => {
  const cs = realColors(ld);
  return cs.length > 0 && cs.every(c => !!c.droppedAt);
};

/** 차수의 의뢰일 · 공장 납기 — 1차는 의뢰(머리) 값 */
export const roundRequestDate = (round, ld) => (round?.no > 1 ? str(round.requestDate) : str(round?.requestDate) || str(ld?.requestDate));
export const roundFactoryDue = (round, ld) => (round?.no > 1 ? str(round.factoryDue) : str(round?.factoryDue) || str(ld?.factoryDue));

// ── 날짜 · 납기 ───────────────────────────────────────────────
const ymdToUtc = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(ymd));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
/** from → to 며칠 ('YYYY-MM-DD' 둘 중 하나라도 없으면 null) */
export const daysFromTo = (from, to) => {
  const a = ymdToUtc(from);
  const b = ymdToUtc(to);
  return a === null || b === null ? null : Math.round((b - a) / 86400000);
};

/** 납기 배지 — { text: 'D-3' | 'D-day' | '2일 지남', tone: 'late' | 'soon' | 'ok' } (날짜가 없으면 null) */
export const dueBadge = (due, today = todayLocalISO()) => {
  const d = daysFromTo(today, due);
  if (d === null) return null;
  if (d < 0) return { text: `${-d}일 지남`, tone: 'late', days: d };
  if (d === 0) return { text: 'D-day', tone: 'soon', days: d };
  return { text: `D-${d}`, tone: d <= 2 ? 'soon' : 'ok', days: d };
};

/**
 * 의뢰 한 건의 납기 · 경과
 *  factoryDue: 공장 진행중 컬러 중 가장 이른 공장 납기
 *  buyerDue: 아직 바이어에게 안 보낸 컬러(공장 진행중 · 도착 · 리젝)가 있을 때만
 *  waitingSince / waitingDays: 컨펌대기 컬러 중 가장 먼저 보낸 날 · 그날부터 며칠
 *  doneDate: 컨펌 · Drop 날짜 중 가장 늦은 날
 */
export const labdipTiming = (ld, today = todayLocalISO()) => {
  const cs = realColors(ld).map(c => ({ c, s: colorStage(c, ld), r: currentRound(c) }));
  const factoryDues = cs.filter(x => x.s === 'factory').map(x => roundFactoryDue(x.r, ld)).filter(Boolean).sort();
  const notSent = cs.some(x => x.s === 'factory' || x.s === 'arrived' || x.s === 'reject');
  const sent = cs.filter(x => x.s === 'waiting').map(x => str(x.r.sentDate)).filter(Boolean).sort();
  const ends = cs.map(x => (x.s === 'drop' ? x.c.droppedAt : x.s === 'confirm' ? x.r.resultDate : '')).filter(Boolean).sort();
  return {
    factoryDue: factoryDues[0] || '',
    buyerDue: notSent ? str(ld?.buyerDue) : '',
    waitingSince: sent[0] || '',
    waitingDays: sent[0] ? daysFromTo(sent[0], today) : null,
    doneDate: ends[ends.length - 1] || '',
  };
};

// ── L/D NO. ──────────────────────────────────────────────────
const LD_NO_RE = /^GB(\d{2})(\d+)$/;
export const normalizeLdNo = (v) => str(v).trim().toUpperCase().replace(/\s+/g, '');
/** 의뢰일 → 번호 연도 2자리 ('2026-10-27' → '26', 없으면 오늘) */
export const ldYearOf = (ymd) => {
  const m = /^\d{2}(\d{2})-\d{2}-\d{2}$/.exec(str(ymd));
  return m ? m[1] : todayLocalISO().slice(2, 4);
};
/** 다음 L/D NO. — 그해 쓴 번호 중 가장 큰 번호 + 1 (26년은 22번까지 쓴 걸로 시작) */
export const nextLdNo = (labdips, requestDate) => {
  const yy = ldYearOf(requestDate);
  let max = LD_NO_USED_BEFORE[Number(yy)] || 0;
  (labdips || []).forEach(d => {
    const m = LD_NO_RE.exec(normalizeLdNo(d?.ldNo));
    if (m && m[1] === yy) max = Math.max(max, parseInt(m[2], 10));
  });
  return `GB${yy}${String(max + 1).padStart(3, '0')}`;
};
/** 같은 L/D NO.를 쓰는 다른 의뢰 (없으면 null) */
export const findLdNoOwner = (labdips, ldNo, selfId) => {
  const key = normalizeLdNo(ldNo);
  if (!key) return null;
  return (labdips || []).find(d => String(d?.id) !== String(selfId || '') && normalizeLdNo(d?.ldNo) === key) || null;
};

// ── 원단 · 울 종류 ─────────────────────────────────────────────
const SW_RE = /(^|[^A-Z0-9])(SW|SUPER\s*WASH)(?![A-Z0-9])/i;
const WOOL_NAME_RE = /WOOL|MERINO|LAMB|울|양모/i;
const WOOL_CODE_RE = /(^|[^A-Z0-9])(W|WO)(?=[^A-Z0-9]|$)/i;  // ITEM NAME 혼용률 표기 (W/N=87/13 · W100)
const WOOL_CATEGORIES = ['소모', '방모'];

/** 원단의 원사 — [{ name, category, ratio }] (혼용률 있는 칸만) */
export const fabricYarnList = (fabric, yarnLibrary = []) => (fabric?.yarns || [])
  .filter(y => y?.yarnId && Number(y.ratio) > 0)
  .map(y => {
    const realId = String(y.yarnId).split('::')[0];
    const yarn = (yarnLibrary || []).find(yl => String(yl.id) === realId);
    return { name: str(yarn?.name || y.tempName).trim(), category: str(yarn?.category), ratio: Number(y.ratio) };
  })
  .filter(y => y.name || y.category);

/**
 * 울 종류 자동 판단 — { type, reason }
 *  ① 원사 이름에 SW → 슈퍼워시 (대표님: '원사에 SW가 들어가면 슈퍼워시')  ② ITEM NAME에 SW → 슈퍼워시
 *  ③ 울 원사(소모 · 방모 · WOOL · MERINO)인데 SW 없음 → 레귤러 울  ④ ITEM NAME에 울(W/…)만 → 레귤러 울
 *  ⑤ 원사 · ITEM NAME은 있는데 울이 없음 → 울 없음  ⑥ 아무것도 없으면 '' (아직 모름)
 */
export const detectWoolType = ({ fabric = null, yarnLibrary = [], itemName } = {}) => {
  const yarns = fabricYarnList(fabric, yarnLibrary);
  const item = str(itemName ?? fabric?.itemName);
  const swYarn = yarns.find(y => SW_RE.test(y.name));
  if (swYarn) return { type: 'superwash', reason: `원사 '${swYarn.name}'에 SW가 있어 슈퍼워시로 체크했어요` };
  if (SW_RE.test(item)) return { type: 'superwash', reason: 'ITEM NAME에 SW가 있어 슈퍼워시로 체크했어요' };
  const woolYarn = yarns.find(y => WOOL_NAME_RE.test(y.name) || WOOL_CATEGORIES.includes(y.category));
  if (woolYarn) return { type: 'regular', reason: `원사 '${woolYarn.name || woolYarn.category}'에 SW가 없어 레귤러 울로 골랐어요 — 슈퍼워시면 바꿔 주세요` };
  if (WOOL_NAME_RE.test(item) || WOOL_CODE_RE.test(item)) return { type: 'regular', reason: 'ITEM NAME에 울(W)이 있고 SW가 없어 레귤러 울로 골랐어요 — 슈퍼워시면 바꿔 주세요' };
  if (yarns.length || item.trim()) return { type: 'none', reason: '원사 · ITEM NAME에 울이 없어요' };
  return { type: '', reason: '' };
};

/** 원단 관리 원단 → 의뢰 칸 (고를 때 복사) */
export const fieldsFromFabric = (fabric) => ({
  fabricId: str(fabric?.id),
  article: str(fabric?.article).trim(),
  itemName: str(fabric?.itemName).trim(),
  gsm: Number(fabric?.gsm) > 0 ? str(fabric.gsm) : '',
  widthCut: Number(fabric?.widthCut) > 0 ? str(fabric.widthCut) : '',
  widthFull: Number(fabric?.widthFull) > 0 ? str(fabric.widthFull) : '',
});

const fmtNum = (v) => {
  const t = str(v).trim();
  const n = Number(t);
  if (!t) return '';
  if (!Number.isFinite(n)) return t;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
};
/** 폭 — '53/55"' (내폭/외폭, 하나만 있으면 그 값) */
export const widthText = (ld) => {
  const cut = fmtNum(ld?.widthCut);
  const full = fmtNum(ld?.widthFull);
  if (cut && full) return `${cut}/${full}"`;
  return full ? `${full}"` : cut ? `${cut}"` : '';
};
export const gsmText = (ld) => {
  const g = fmtNum(ld?.gsm);
  return g ? `${g} g/㎡` : '';
};

// ── 저장 모양 ─────────────────────────────────────────────────
const numOrText = (v) => {
  const t = str(v).trim();
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : t;
};

const cleanRound = (r, i) => {
  const startIdx = clampInt(r?.startIdx, 0, 25, 0);
  const result = r?.result === 'confirm' || r?.result === 'reject' ? r.result : '';
  return {
    no: i + 1,
    requestDate: str(r?.requestDate),
    factoryDue: str(r?.factoryDue),
    requestNote: str(r?.requestNote).trim(),
    letters: clampInt(r?.letters, 1, 26 - startIdx, LD_LETTERS_DEFAULT),
    startIdx,
    factoryNo: str(r?.factoryNo).trim().toUpperCase(),
    receivedDate: str(r?.receivedDate),
    sentDate: str(r?.sentDate),
    sentMethod: str(r?.sentMethod).trim(),
    result,
    resultDate: result ? str(r?.resultDate) : '',
    confirmedLetter: result === 'confirm' ? str(r?.confirmedLetter).trim().toUpperCase() : '',
    buyerComment: str(r?.buyerComment).trim(),
  };
};

/** 저장할 모양 — 빈 컬러 줄은 빼고 글자는 다듬음 (저장 안 한 변경 비교도 이 모양으로) */
export const cleanLabdipForSave = (ld) => ({
  schemaVersion: LD_SCHEMA_VERSION,
  ldNo: normalizeLdNo(ld?.ldNo),
  mode: ld?.mode === 'direct' ? 'direct' : 'factory',
  eztexNo: str(ld?.eztexNo).trim().toUpperCase(),
  buyerName: str(ld?.buyerName).trim(),
  factory: str(ld?.factory).trim(),
  requestDate: str(ld?.requestDate),
  factoryDue: str(ld?.factoryDue),
  buyerDue: str(ld?.buyerDue),
  fabricId: str(ld?.fabricId),
  article: str(ld?.article).trim().toUpperCase(),
  itemName: str(ld?.itemName).trim(),
  gsm: numOrText(ld?.gsm),
  widthCut: numOrText(ld?.widthCut),
  widthFull: numOrText(ld?.widthFull),
  style: str(ld?.style).trim(),
  woolType: woolTypeOf(ld?.woolType) ? ld.woolType : '',
  woolManual: !!ld?.woolManual,
  lightSources: LIGHT_SOURCES.filter(l => (ld?.lightSources || []).includes(l)),
  remarks: str(ld?.remarks).trim(),
  memo: str(ld?.memo).trim(),
  legacy: !!ld?.legacy,
  legacyDone: !!ld?.legacyDone,
  colors: (ld?.colors || []).filter(c => !isBlankColor(c)).map(c => ({
    id: str(c.id),
    name: str(c.name).trim(),
    pantone: str(c.pantone).trim(),
    swatch: !!c.swatch,
    memo: str(c.memo).trim(),
    comment: str(c.comment).trim(),
    droppedAt: str(c.droppedAt),
    rounds: (Array.isArray(c.rounds) && c.rounds.length ? c.rounds : [makeRound(1)]).map(cleanRound),
  })),
});

/** 저장 전 확인 — 문제가 있으면 알림 글자, 없으면 '' */
export const validateLabdip = (clean, { labdips = [], selfId = '' } = {}) => {
  if (!clean.buyerName) return '바이어(거래처)를 골라 주세요.';
  if (!clean.colors.length) return '컬러를 하나 이상 넣어 주세요. (컬러명 또는 PANTONE)';
  const owner = clean.ldNo ? findLdNoOwner(labdips, clean.ldNo, selfId) : null;
  if (owner) return `L/D NO. ${clean.ldNo}는 이미 있어요 (${owner.buyerName || '바이어 미입력'} · ${owner.article || '-'}). 다른 번호를 넣어 주세요.`;
  return '';
};

// ── 진행 (도착 · 발송 · 결과 · 2차 의뢰 · Drop · 되돌리기) — 새 모양을 돌려줌 ──
const patchCurrentRound = (c, fields) => {
  const rs = Array.isArray(c.rounds) && c.rounds.length ? [...c.rounds] : [makeRound(1)];
  rs[rs.length - 1] = { ...rs[rs.length - 1], ...fields };
  return { ...c, rounds: rs };
};
const mapById = (ld, entries, fn) => {
  const byId = new Map((entries || []).map(e => [e.colorId, e]));
  return { ...ld, colors: (ld.colors || []).map(c => (byId.has(c.id) ? fn(c, byId.get(c.id)) : c)) };
};

/** 2차부터 도착할 때 첫 낱장 — 앞 차수와 같은 공장 번호면 글자를 이어서 (1차 A~C → 2차 D), 번호가 다르면 A */
export const arrivalStartIdx = (color, factoryNo) => {
  const prev = prevRound(color);
  if (!prev) return 0;
  const same = normalizeLdNo(prev.factoryNo) && normalizeLdNo(prev.factoryNo) === normalizeLdNo(factoryNo);
  return same ? Math.min(25, clampInt(prev.startIdx, 0, 25, 0) + clampInt(prev.letters, 1, 26, 1)) : 0;
};

/** L/D 도착 — entries: [{ colorId, factoryNo, letters, startIdx }] */
export const withArrival = (ld, entries, date) => mapById(ld, entries, (c, e) => patchCurrentRound(c, {
  factoryNo: str(e.factoryNo).trim().toUpperCase(),
  letters: clampInt(e.letters, 1, 26, LD_LETTERS_DEFAULT),
  startIdx: clampInt(e.startIdx, 0, 25, 0),
  receivedDate: date,
}));

/** 바이어 발송 — 고른 컬러의 지금 차수에 발송일 · 방법 */
export const withSend = (ld, colorIds, date, method) => mapById(ld, (colorIds || []).map(colorId => ({ colorId })),
  c => patchCurrentRound(c, { sentDate: date, sentMethod: str(method).trim() }));

/** 바이어 결과 — entries: [{ colorId, result: 'confirm' | 'reject' | 'drop', letter, comment }] */
export const withResults = (ld, entries, date) => mapById(ld, entries, (c, e) => {
  const comment = str(e.comment).trim();
  if (e.result === 'drop') return { ...patchCurrentRound(c, comment ? { buyerComment: comment } : {}), droppedAt: date };
  return patchCurrentRound(c, {
    result: e.result,
    resultDate: date,
    confirmedLetter: e.result === 'confirm' ? str(e.letter).toUpperCase() : '',
    buyerComment: comment,
  });
});

/** 다음 차수 의뢰 (리젝 → 2차) — entries: [{ colorId, requestNote, letters }] */
export const withRedip = (ld, entries, { requestDate, factoryDue }) => mapById(ld, entries, (c, e) => ({
  ...c,
  rounds: [...(c.rounds || []), makeRound((c.rounds || []).length + 1, {
    requestDate,
    factoryDue,
    requestNote: str(e.requestNote).trim(),
    letters: clampInt(e.letters, 1, 26, LD_LETTERS_DEFAULT),
  })],
}));

/** 컬러 Drop (바이어가 이 컬러를 안 하기로) */
export const withColorDrop = (ld, colorId, date) => mapById(ld, [{ colorId }], c => ({ ...c, droppedAt: date }));
/** 아직 안 끝난 컬러 모두 Drop (의뢰를 그만둠) */
export const withDropOpen = (ld, date) => ({
  ...ld,
  colors: (ld.colors || []).map(c => (!isBlankColor(c) && !isFinishedStage(colorStage(c, ld)) ? { ...c, droppedAt: date } : c)),
});
/** Drop한 컬러 모두 되돌리기 */
export const withRestoreDropped = (ld) => ({ ...ld, colors: (ld.colors || []).map(c => (c.droppedAt ? { ...c, droppedAt: '' } : c)) });
/** 예전 기록을 다시 진행 — 보낸 컬러는 컨펌대기로 */
export const withLegacyReopen = (ld) => ({ ...ld, legacyDone: false });

/** 한 단계 되돌리기 — 무엇이 되돌려지는지 (되돌릴 게 없으면 '') */
export const stepBackText = (color, ld) => {
  const r = currentRound(color);
  switch (colorStage(color, ld)) {
    case 'drop': return 'Drop을 풀어요';
    case 'confirm': return `컨펌 결과(${r.confirmedLetter || '-'})를 지우고 컨펌대기로 되돌려요`;
    case 'reject': return '리젝 결과를 지우고 컨펌대기로 되돌려요';
    case 'waiting': return '바이어 발송 기록을 지우고 L/D 도착(발송 전)으로 되돌려요';
    case 'arrived': return `L/D 도착(공장 번호 ${r.factoryNo || '없음'})을 지우고 공장 진행중으로 되돌려요`;
    case 'factory': return r.no > 1 ? `${r.no}차 의뢰를 지우고 ${r.no - 1}차 리젝으로 되돌려요` : '';
    default: return '';
  }
};
export const withStepBack = (ld, colorId) => mapById(ld, [{ colorId }], c => {
  switch (colorStage(c, ld)) {
    case 'drop': return { ...c, droppedAt: '' };
    case 'confirm':
    case 'reject': return patchCurrentRound(c, { result: '', resultDate: '', confirmedLetter: '' });
    case 'waiting': return patchCurrentRound(c, { sentDate: '', sentMethod: '' });
    case 'arrived': return patchCurrentRound(c, { receivedDate: '', factoryNo: '' });
    case 'factory': return (c.rounds || []).length > 1 ? { ...c, rounds: c.rounds.slice(0, -1) } : c;
    default: return c;
  }
});

/** 복제 — 같은 바이어 · 원단 · 컬러로 새 의뢰 (번호 · 진행 기록은 빼고 1차부터) */
export const duplicateLabdip = (src, today = todayLocalISO()) => {
  const ld = normalizeLabdip(src);
  const colors = realColors(ld).map(c => makeColor({
    name: c.name, pantone: c.pantone, swatch: c.swatch, memo: c.memo, comment: c.comment,
    rounds: [makeRound(1, { letters: (c.rounds || [])[0]?.letters || LD_LETTERS_DEFAULT })],
  }));
  return {
    ...makeBlankLabdip(ld.mode, today),
    buyerName: ld.buyerName,
    factory: ld.factory,
    fabricId: ld.fabricId,
    article: ld.article,
    itemName: ld.itemName,
    gsm: ld.gsm,
    widthCut: ld.widthCut,
    widthFull: ld.widthFull,
    style: ld.style,
    woolType: ld.woolType,
    woolManual: ld.woolManual,
    lightSources: [...(ld.lightSources || [])],
    remarks: ld.remarks,
    colors: colors.length ? colors : [makeColor()],
  };
};

// ── 인쇄 모양 ─────────────────────────────────────────────────
const pickColors = (ld, colorIds) => {
  const ids = colorIds ? new Set(colorIds) : null;
  return realColors(ld).filter(c => !c.droppedAt && (!ids || ids.has(c.id)));
};

/** 바이어 시트 (A4) — 공장 칸은 아예 없음 (바이어에게 공장을 밝히지 않음) */
export const buildBuyerSheet = (ld, colorIds, date) => ({
  kind: 'buyer',
  ldNo: normalizeLdNo(ld?.ldNo),
  buyerName: str(ld?.buyerName).trim(),
  date: date || todayLocalISO(),
  article: str(ld?.article).trim(),
  style: str(ld?.style).trim(),
  rows: pickColors(ld, colorIds).map(c => {
    const r = currentRound(c);
    return { id: c.id, name: str(c.name).trim(), comment: str(c.comment).trim(), factoryNo: str(r.factoryNo).trim(), letters: roundLetters(r) };
  }),
});

/** 공장 의뢰서에 넣을 컬러 — 지금 공장 진행중인 컬러, 없으면 Drop 안 한 컬러 모두 (다시 인쇄) */
export const factoryPrintColorIds = (ld) => {
  const pending = realColors(ld).filter(c => colorStage(c, ld) === 'factory').map(c => c.id);
  return pending.length ? pending : pickColors(ld, null).map(c => c.id);
};

/** 공장 의뢰서 (A4) — 바이어 · STYLE은 안 찍음 */
export const buildFactorySheet = (ld, colorIds, { author = '' } = {}) => {
  const rows = pickColors(ld, colorIds).map((c, i) => {
    const r = currentRound(c);
    const prev = prevRound(c);
    return {
      id: c.id,
      no: i + 1,
      name: str(c.name).trim(),
      pantone: str(c.pantone).trim(),
      swatch: !!c.swatch,
      memo: str(c.memo).trim(),
      letters: r.letters,
      roundNo: r.no,
      requestDate: roundRequestDate(r, ld),
      due: roundFactoryDue(r, ld),
      requestNote: str(r.requestNote).trim(),
      prev: prev ? { no: prev.no, factoryNo: str(prev.factoryNo).trim(), range: letterRangeText(prev), comment: str(prev.buyerComment).trim() } : null,
    };
  });
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const dues = uniq(rows.map(r => r.due));
  const reqDates = uniq(rows.map(r => r.requestDate));
  const roundNos = uniq(rows.map(r => r.roundNo));
  const wool = woolTypeOf(ld?.woolType);
  return {
    kind: 'factory',
    ldNo: normalizeLdNo(ld?.ldNo),
    factory: str(ld?.factory).trim(),
    author: str(author).trim(),
    requestDate: reqDates.length === 1 ? reqDates[0] : str(ld?.requestDate),
    due: dues.length === 1 ? dues[0] : '',
    duePerRow: dues.length > 1,
    roundLabel: roundNos.length === 1 ? `${roundNos[0]}차` : '컬러마다 다름',
    article: str(ld?.article).trim(),
    itemName: str(ld?.itemName).trim(),
    wool: wool?.sheet || '',
    gsm: gsmText(ld),
    width: widthText(ld),
    lightSources: (ld?.lightSources || []).join(' · '),
    remarks: str(ld?.remarks).trim(),
    rows,
  };
};

/** 검색용 글자 (대문자) */
export const labdipSearchText = (ld) => [
  ld?.ldNo, ld?.buyerName, ld?.article, ld?.itemName, ld?.factory, ld?.style, ld?.eztexNo, ld?.remarks, ld?.memo,
  ...(ld?.colors || []).flatMap(c => [c.name, c.pantone, ...(c.rounds || []).map(r => r.factoryNo)]),
].map(str).join(' ').toUpperCase();
