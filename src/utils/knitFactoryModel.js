// ============================================================
// GRUBIG ERP - 편직처 기계 현황 (개발 ▾ 편직처 기계 현황) 계산 — 대표님 요청 2026-11-23, 2차 개편 같은 날
//  순수 함수만 (React·Firestore 없음 — Node에서도 돌아감). 화면·훅은 이 파일의 모양을 따름.
//
// ■ 2차에서 바뀐 것 (대표님 피드백)
//   · 기계 종류는 회사 설정 목록 (싱글 · 싱글 자카드 · 양면 · 양면 자카드 · 벨로아 … 직접 추가) + 계열(그룹)도 직접 정함
//     → '자카드'를 싱글·더블과 나란히 두지 않음 (자카드는 싱글 기계 안 · 양면 기계 안의 종류)
//   · 가마 = 갈아 끼우는 실린더(게이지). **같은 편직처 · 같은 종류 · 같은 인치 기계끼리 돌려 씀** (대표님 답)
//     → 기계 줄에는 '지금 꼽힌 가마'(게이지 하나), 편직처에 '보유 가마' 목록(종류 · 인치 · 게이지 · 개수 · 침수)
//   · 스판장치 (있음 · 없음 · 모름) — 엑셀 '스판겸용' = 있음, 'NON SPAN' · '스판 NO' = 없음
//   · 지도 — 대표 주소(첫 번째)의 좌표를 저장 (geo)
//
// ■ knitFactories 문서 (Firestore 컬렉션 knitFactories, 문서 ID = id)
//   { id, schema: 2, name, phone, fax, contacts: [{ id, name, mobile }], addresses: [..](첫 번째 = 대표 주소), region, knitFee,
//     machines: [{ id, type(종류 이름), inch, feeder(글자), count(대수), gauge(지금 꼽힌 가마 게이지), needles(침수 — 비우면 가마·계산 값),
//                  spandex('yes'|'no'|''), maker, note }],
//     cylinders: [{ id, type, inch, gauge, count(개수 — 꼽힌 것 포함 전체), needles, note }],   ← 보유 가마
//     memos: [{ id, date, kind('memo'|'visit'|'call' — 없으면 메모), text, by, writtenAt?(날짜를 골라 남긴 날), editedAt?, editedBy? }],
//     checkedAt('YYYY-MM-DD'), geo: { lat, lng, address(이 주소로 찾음), manual(지도에서 찍음) } | null,
//     source('excel'), createdAt, createdBy, updatedAt, updatedBy }
// ■ 2026-11-24 개발 고도화 3단계: [기계로 찾기] 피더 칸 · 엑셀로 내보내기(시트 4개) · 메모 종류(메모 / 방문 / 통화 → 확인일)
// ■ 회사 설정 settings/general.knitMachineConfig = { families: ['싱글', '양면', '기타'], types: [{ name, family }] }
//   · 저장 전이면 DEFAULT_KNIT_CONFIG. 순서 = 화면 순서
// ============================================================

import { todayLocalISO } from './helpers';

export const KNIT_FACTORY_COLLECTION = 'knitFactories';
export const KNIT_SCHEMA = 2;

// ── 기계 종류 · 계열 기본값 (대표님이 [⚙ 기계 종류]에서 고침) ──
export const DEFAULT_KNIT_CONFIG = {
  families: ['싱글', '양면', '기타'],
  types: [
    { name: '싱글', family: '싱글' },
    { name: '싱글 자카드', family: '싱글' },
    { name: '쥬리', family: '싱글' },
    { name: '벨로아', family: '싱글' },
    { name: '벨로아 자카드', family: '싱글' },
    { name: '테리', family: '싱글' },
    { name: '테리 자카드', family: '싱글' },
    { name: '시루', family: '싱글' },
    { name: '양면', family: '양면' },
    { name: '양면 자카드', family: '양면' },
    { name: '양면벨로아', family: '양면' },
    { name: '양두 자카드', family: '양면' },
    { name: '기타', family: '기타' },
  ],
};
export const UNGROUPED_FAMILY = '미분류';

const str = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').replace(/[″"]/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** 설정 값 정리 — 이름 겹침·빈 이름 빼기, 계열이 없는 종류는 '미분류' */
export const resolveKnitConfig = (raw) => {
  const src = raw && Array.isArray(raw.types) ? raw : DEFAULT_KNIT_CONFIG;
  const families = [...new Set((Array.isArray(src.families) ? src.families : DEFAULT_KNIT_CONFIG.families).map(str).filter(Boolean))]
    .filter(f => f !== UNGROUPED_FAMILY);
  const seen = new Set();
  const types = [];
  (src.types || []).forEach(t => {
    const name = str(t?.name);
    if (!name || seen.has(name)) return;
    seen.add(name);
    types.push({ name, family: families.includes(str(t.family)) ? str(t.family) : UNGROUPED_FAMILY });
  });
  const allFamilies = types.some(t => t.family === UNGROUPED_FAMILY) ? [...families, UNGROUPED_FAMILY] : families;
  return { families: allFamilies, types };
};

/** 종류 → 계열 (설정에 없는 종류면 '미분류') */
export const familyOf = (config, type) => config?.types?.find(t => t.name === str(type))?.family || UNGROUPED_FAMILY;
export const isKnownType = (config, type) => !!config?.types?.some(t => t.name === str(type));
const typeIndex = (config, type) => {
  const i = (config?.types || []).findIndex(t => t.name === str(type));
  return i < 0 ? 999 : i;
};
const familyIndex = (config, family) => {
  const i = (config?.families || []).indexOf(family);
  return i < 0 ? 999 : i;
};

// 계열마다 색 (설정 순서대로)
const FAMILY_TONES = [
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
];
export const familyTone = (config, family) => (family === UNGROUPED_FAMILY || familyIndex(config, family) === 999
  ? 'bg-slate-100 text-slate-600 border-slate-300'
  : FAMILY_TONES[familyIndex(config, family) % FAMILY_TONES.length]);
export const typeTone = (config, type) => familyTone(config, familyOf(config, type));

// ── 스판장치 ──
export const SPANDEX_OPTIONS = [
  { key: 'yes', label: '있음' },
  { key: 'no', label: '없음' },
  { key: '', label: '모름' },
];
export const spandexLabel = (v) => SPANDEX_OPTIONS.find(o => o.key === (v || ''))?.label || '모름';

// 기계 현황을 확인한 지 이만큼 지나면 '확인 필요'
export const KNIT_CHECK_STALE_DAYS = 180;

// 제조사 추천 목록 (입력 칸 자동 완성 — 다른 이름도 넣을 수 있음)
export const KNIT_MAKERS = ['금용', '쌍용', '삼세스', '후쿠하라', '테롯', '오로조', '마이어', '창대'];

// [기계로 찾기] 거르기 빈 값 (편직처 화면 · 지도 · 설계서 고르기 창이 같이 씀)
//  feeder · feederUnknown: 피더 칸 · '피더 모르는 기계도 보기' (2026-11-24, 개발 고도화 3단계)
export const EMPTY_MACHINE_FILTERS = {
  gauge: '', inch: '', feeder: '', feederUnknown: false, family: '', type: '', maker: '', region: '', spandex: '', text: '', near: true,
};

// ============================================================
// 1. 빈 양식 · 정리
// ============================================================
export const makeBlankMachine = (type = '', inch = null) => ({
  id: uid('km'), type, inch, feeder: '', count: null, gauge: null, needles: null, spandex: '', maker: '', note: '',
});
export const makeBlankCylinder = (type = '', inch = null) => ({
  id: uid('kcy'), type, inch, gauge: null, count: null, needles: null, note: '',
});
export const makeBlankContact = () => ({ id: uid('kc'), name: '', mobile: '' });
export const makeBlankFactory = () => ({
  name: '', phone: '', fax: '', contacts: [makeBlankContact()], addresses: [''], region: '', knitFee: '',
  machines: [], cylinders: [], memos: [], checkedAt: '', geo: null,
});

const normalizeSpandex = (v) => (v === 'yes' || v === 'no' ? v : '');

export const normalizeMachine = (m = {}) => ({
  id: m.id || uid('km'),
  type: str(m.type),
  inch: numOrNull(m.inch),
  feeder: str(m.feeder),
  count: numOrNull(m.count),
  // 1차(가마 여러 개 gauges) 문서도 읽히게 — 하나면 그게 지금 가마
  gauge: numOrNull(m.gauge ?? (Array.isArray(m.gauges) && m.gauges.length === 1 ? m.gauges[0] : null)),
  needles: numOrNull(m.needles),
  spandex: normalizeSpandex(m.spandex),
  maker: str(m.maker),
  note: str(m.note),
});
export const normalizeCylinder = (c = {}) => ({
  id: c.id || uid('kcy'),
  type: str(c.type),
  inch: numOrNull(c.inch),
  gauge: numOrNull(c.gauge),
  count: numOrNull(c.count),
  needles: numOrNull(c.needles),
  note: str(c.note),
});

export const isEmptyMachine = (m) => !m.type && !m.inch && !str(m.feeder) && !m.count && !m.gauge && !m.needles && !m.spandex && !str(m.maker) && !str(m.note);
export const isEmptyCylinder = (c) => !c.type && !c.inch && !c.gauge && !c.count && !c.needles && !str(c.note);

const normalizeGeo = (g) => (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng))
  ? { lat: Number(g.lat), lng: Number(g.lng), address: str(g.address), manual: !!g.manual, byName: !!g.byName }
  : null);

/** 저장소 문서 → 화면 양식 (빠진 칸 채우기) */
export const normalizeFactory = (doc = {}) => ({
  ...makeBlankFactory(),
  ...doc,
  name: str(doc.name),
  phone: str(doc.phone),
  fax: str(doc.fax),
  contacts: (Array.isArray(doc.contacts) && doc.contacts.length ? doc.contacts : [makeBlankContact()])
    .map(c => ({ id: c.id || uid('kc'), name: str(c.name), mobile: str(c.mobile) })),
  addresses: Array.isArray(doc.addresses) && doc.addresses.length ? doc.addresses.map(str) : [''],
  region: str(doc.region),
  knitFee: String(doc.knitFee || ''),
  machines: (Array.isArray(doc.machines) ? doc.machines : []).map(normalizeMachine),
  cylinders: (Array.isArray(doc.cylinders) ? doc.cylinders : []).map(normalizeCylinder),
  memos: Array.isArray(doc.memos) ? doc.memos : [],
  checkedAt: str(doc.checkedAt),
  geo: normalizeGeo(doc.geo),
});

/** 저장 전 정리 — 빈 담당자·주소·줄 빼기, 지역이 비었으면 주소에서, 대표 주소가 바뀌면 좌표 비움 */
export const cleanFactoryForSave = (input) => {
  const f = normalizeFactory(input);
  const addresses = f.addresses.map(str).filter(Boolean);
  const geo = f.geo && (f.geo.manual || f.geo.address === (addresses[0] || '')) ? f.geo : null;
  return {
    ...f,
    schema: KNIT_SCHEMA,
    name: f.name.replace(/\s+/g, ' '),
    contacts: f.contacts.filter(c => c.name || c.mobile),
    addresses,
    region: f.region || regionFromAddresses(addresses),
    knitFee: String(f.knitFee || '').replace(/\s+$/, ''),
    machines: f.machines.filter(m => !isEmptyMachine(m)),
    cylinders: f.cylinders.filter(c => !isEmptyCylinder(c)),
    geo,
  };
};

// 기계 · 가마 비교용 (고쳤는지 — 확인일 자동 갱신)
const equipSig = (f) => JSON.stringify({
  m: (f?.machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m)).map(({ id: _id, ...rest }) => rest),
  c: (f?.cylinders || []).map(normalizeCylinder).filter(c => !isEmptyCylinder(c)).map(({ id: _id, ...rest }) => rest),
});
export const equipmentChanged = (before, after) => equipSig(before) !== equipSig(after);

/** 같은 이름 비교 (띄어쓰기·대소문자 무시) */
export const sameFactoryName = (a, b) => str(a).replace(/\s+/g, '').toLowerCase() === str(b).replace(/\s+/g, '').toLowerCase();

// ============================================================
// 2. 표시 · 계산
// ============================================================
/** 숫자 → '1,234' (없으면 빈 글자) */
export const fmtNum = (n) => (n || n === 0 ? Number(n).toLocaleString() : '');
/** 피더 표시 — 숫자만이면 '96F', 그 밖('12*3' · '36/48')은 그대로 */
export const feederLabel = (feeder) => {
  const f = str(feeder);
  return /^\d+$/.test(f) ? `${f}F` : f;
};
export const inchLabel = (i) => (i ? `${i}"` : '');

// ── 피더로 찾기 (2026-11-24, 개발 고도화 3단계) ──
//  피더는 글자로 저장 ('96' · '96F' · '36/48' · '60/48' · '12*3') — 숫자만 뽑아서 비교
//   · '36/48'(바꿔 쓰는 기계)은 36 · 48 둘 다 · '12*3'은 12 × 3 = 36 · '3본 96F'처럼 F가 붙은 숫자가 있으면 그 숫자
/** 피더 글자 → 숫자들 ('96F' → [96], '36/48' → [36, 48], '12*3' → [36]) — 못 읽으면 [] */
export const feederNumbers = (feeder) => {
  const out = [];
  str(feeder).split(/[/,·~|]|또는/).forEach(part => {
    const prod = part.match(/(\d+)\s*[*×xX]\s*(\d+)/);
    const withF = part.match(/(\d+)\s*F/i);
    const first = part.match(/\d+/);
    const n = prod ? Number(prod[1]) * Number(prod[2]) : withF ? Number(withF[1]) : first ? Number(first[0]) : null;
    if (n > 0 && n < 1000) out.push(n);
  });
  return [...new Set(out)];
};
/** 찾을 피더 — 거르기 칸 '96' · '96F' → 96 (못 읽으면 null) */
export const feederQuery = (v) => feederNumbers(v)[0] ?? null;
// 근접 = 피더 ±10% (적어도 ±2F — 96F면 86~106F)
export const FEEDER_NEAR_RATIO = 0.1;
export const feederNearTolerance = (target) => Math.max(2, Math.round(Number(target) * FEEDER_NEAR_RATIO));

// ── 메모 종류 — 메모 / 방문 / 통화 (2026-11-24, 개발 고도화 3단계) ──
//  · 방문 · 통화 기록을 남기면 편직처 확인일도 그 날로 (지금 확인일보다 최근일 때만 — 예전 날짜 기록이 확인일을 되돌리지 않게)
//  · 예전 메모(kind 없음)는 메모 · 기록을 지워도 확인일은 그대로
export const MEMO_KINDS = [
  { key: 'memo', label: '메모', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'visit', label: '방문', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'call', label: '통화', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
];
export const normalizeMemoKind = (kind) => (MEMO_KINDS.some(k => k.key === kind) ? kind : 'memo');
export const memoKindOf = (memo) => normalizeMemoKind(memo?.kind);
export const memoKindInfo = (kind) => MEMO_KINDS.find(k => k.key === normalizeMemoKind(kind));
/** 방문 · 통화 (확인일을 바꾸는 기록) */
export const isContactKind = (kind) => kind === 'visit' || kind === 'call';
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(str(s));
/** 방문 · 통화 기록 날짜 확인 — 문제면 안내 글자, 괜찮으면 '' (메모는 확인 안 함) */
export const memoDateError = (kind, date, today = todayLocalISO()) => {
  if (!isContactKind(kind)) return '';
  if (!isYmd(date)) return `${memoKindInfo(kind).label}한 날을 넣어 주세요.`;
  if (str(date) > today) return '앞으로 날짜는 넣을 수 없어요. 다녀온 날 · 통화한 날을 골라 주세요.';
  return '';
};
/** 방문 · 통화 기록 → 새 확인일 (지금 확인일보다 최근일 때만, 아니면 '') */
export const checkedAtFromRecord = (currentCheckedAt, kind, date) => (
  isContactKind(kind) && isYmd(date) && (!isYmd(currentCheckedAt) || str(date) > str(currentCheckedAt)) ? str(date) : '');
/** 메모를 날짜 최신 순으로 (같은 날은 저장된 순서 — 나중에 남긴 것이 위) */
export const sortMemos = (memos) => (Array.isArray(memos) ? memos : [])
  .map((m, i) => ({ m, i }))
  .sort((a, b) => str(b.m?.date).localeCompare(str(a.m?.date)) || a.i - b.i)
  .map(x => x.m);
/** 마지막 방문 · 통화 기록 (없으면 null) */
export const lastContactRecord = (memos) => sortMemos(memos).find(m => isContactKind(memoKindOf(m))) || null;

/** 침수 계산 값 = 게이지 × π × 인치 */
export const estimateNeedles = (gauge, inch) => {
  const g = Number(gauge);
  const i = Number(inch);
  if (!(g > 0) || !(i > 0)) return null;
  return Math.round(g * Math.PI * i);
};

/** 같은 종류 · 같은 인치 보유 가마 (돌려 쓰는 묶음) */
export const cylindersFor = (factory, type, inch) => (factory?.cylinders || [])
  .map(normalizeCylinder)
  .filter(c => !isEmptyCylinder(c) && c.type === str(type) && c.inch === numOrNull(inch) && c.gauge);

/** 이 종류 · 인치 · 게이지의 침수 — 기계에 적은 값 > 가마에 적은 값 > 계산 값(estimated) */
export const needlesFor = (factory, type, inch, gauge, machineNeedles = null) => {
  if (machineNeedles) return { value: machineNeedles, estimated: false };
  const cyl = cylindersFor(factory, type, inch).find(c => c.gauge === Number(gauge) && c.needles);
  if (cyl) return { value: cyl.needles, estimated: false };
  const est = estimateNeedles(gauge, inch);
  return est ? { value: est, estimated: true } : null;
};

/**
 * 기계 · 가마를 '종류 + 인치' 묶음으로 (돌려 쓰는 단위) — 계열 → 종류 → 인치 순서
 *  반환: [{ key, type, family, inch, machines, cylinders, count(대수 합), countKnown, cylinderCount, mounted(지금 꼽힌 게이지들), gauges(쓸 수 있는 게이지 전부) }]
 */
export const buildBlocks = (factory, config) => {
  const map = new Map();
  const get = (type, inch) => {
    const key = `${type}__${inch || ''}`;
    if (!map.has(key)) map.set(key, { key, type, family: familyOf(config, type), inch: inch || null, machines: [], cylinders: [] });
    return map.get(key);
  };
  (factory?.machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m)).forEach(m => get(m.type, m.inch).machines.push(m));
  (factory?.cylinders || []).map(normalizeCylinder).filter(c => !isEmptyCylinder(c)).forEach(c => get(c.type, c.inch).cylinders.push(c));
  return [...map.values()].map(b => {
    const mounted = [...new Set(b.machines.map(m => m.gauge).filter(Boolean))].sort((x, y) => x - y);
    const cylGauges = [...new Set(b.cylinders.map(c => c.gauge).filter(Boolean))];
    return {
      ...b,
      cylinders: [...b.cylinders].sort((x, y) => (x.gauge || 0) - (y.gauge || 0)),
      count: b.machines.reduce((s, m) => s + (m.count || 0), 0),
      countKnown: b.machines.some(m => m.count),
      cylinderCount: b.cylinders.reduce((s, c) => s + (c.count || 0), 0),
      mounted,
      gauges: [...new Set([...mounted, ...cylGauges])].sort((x, y) => x - y),
    };
  }).sort((a, b) => (familyIndex(config, a.family) - familyIndex(config, b.family))
    || (typeIndex(config, a.type) - typeIndex(config, b.type))
    || str(a.type).localeCompare(str(b.type), 'ko')
    || ((a.inch || 0) - (b.inch || 0)));
};

/** 게이지 범위 글자 — [18, 22, 24, 28] → '18~28G' (3개 이하면 '18·22·24G') */
export const gaugeRangeLabel = (gauges) => {
  const list = [...new Set((gauges || []).filter(Boolean))].sort((a, b) => a - b);
  if (!list.length) return '';
  if (list.length <= 3) return `${list.join('·')}G`;
  return `${list[0]}~${list[list.length - 1]}G`;
};

/** 편직처 합계 { total(기계 대수 합), lines(기계 줄), cylinders(가마 개수 합), cylinderLines, blocks } */
export const factoryTotals = (factory, config) => {
  const blocks = buildBlocks(factory, config);
  return {
    total: blocks.reduce((s, b) => s + b.count, 0),
    lines: blocks.reduce((s, b) => s + b.machines.length, 0),
    cylinders: blocks.reduce((s, b) => s + b.cylinderCount, 0),
    cylinderLines: blocks.reduce((s, b) => s + b.cylinders.length, 0),
    blocks,
  };
};

/**
 * 종류별 한 줄 요약 (편직처 목록 — 2026-11-24 '보기 쉽게')
 *  반환: [{ type, family, total(대수 합), unknown(대수 모르는 줄 있음), inches: [{ inch, count, unknown }], gauges, mounted, spandex: 'yes'|'no'|'' (하나라도 있음이면 yes) }]
 */
export const typeSummaries = (blocks) => {
  const map = new Map();
  (blocks || []).forEach(b => {
    if (!map.has(b.type)) map.set(b.type, { type: b.type, family: b.family, total: 0, unknown: false, inches: [], gauges: new Set(), mounted: new Set(), spandex: new Set() });
    const t = map.get(b.type);
    const unknown = b.machines.some(m => !m.count);
    t.total += b.count;
    t.unknown = t.unknown || unknown;
    if (b.machines.length) t.inches.push({ inch: b.inch, count: b.count, unknown });
    b.gauges.forEach(g => t.gauges.add(g));
    b.mounted.forEach(g => t.mounted.add(g));
    b.machines.forEach(m => t.spandex.add(m.spandex));
  });
  return [...map.values()].map(t => ({
    ...t,
    gauges: [...t.gauges].sort((a, b) => a - b),
    mounted: [...t.mounted].sort((a, b) => a - b),
    spandex: t.spandex.has('yes') ? 'yes' : (t.spandex.size === 1 && t.spandex.has('no') ? 'no' : ''),
  }));
};
/** 계열별 대수 { 싱글: 41, 양면: 12 } */
export const familyTotals = (blocks) => (blocks || []).reduce((acc, b) => { acc[b.family] = (acc[b.family] || 0) + b.count; return acc; }, {});

/** 확인일 → 지난 날 수 (없으면 null) */
export const daysSince = (ymd, today = todayLocalISO()) => {
  const a = /^\d{4}-\d{2}-\d{2}$/.test(str(ymd)) ? new Date(`${ymd}T00:00:00`) : null;
  const b = new Date(`${today}T00:00:00`);
  if (!a || Number.isNaN(a.getTime())) return null;
  return Math.round((b - a) / 86400000);
};
export const checkState = (factory, today) => {
  const days = daysSince(factory?.checkedAt, today);
  if (days === null) return { tone: 'none', days: null, label: '확인일 없음' };
  if (days > KNIT_CHECK_STALE_DAYS) return { tone: 'stale', days, label: `${factory.checkedAt} 확인 (${Math.floor(days / 30)}개월 전)` };
  return { tone: 'ok', days, label: days === 0 ? '오늘 확인' : `${factory.checkedAt} 확인 (${days}일 전)` };
};
export const needsCheck = (factory, today) => checkState(factory, today).tone !== 'ok';

// 주소에 시·군 이름이 없을 때 쓰는 동네 → 지역 (엑셀에 있던 것)
const AREA_HINTS = [
  ['가산면', '포천'], ['소흘읍', '포천'], ['소홀읍', '포천'], ['소홀면', '포천'], ['군내면', '포천'], ['자작동', '포천'],
  ['설운동', '포천'], ['정교리', '포천'], ['이동교리', '포천'], ['은현면', '양주'], ['회암동', '양주'], ['봉양동', '양주'],
  ['단원구', '안산'], ['성곡동', '안산'],
];
/** 주소 → 지역 ('경기도 포천시 …' → '포천') */
export const regionFromAddress = (address) => {
  const s = str(address);
  if (!s) return '';
  const m = s.match(/([가-힣]{1,4})(시|군)(?=\s|$)/);
  if (m && m[1] !== '경기' && !/도$/.test(m[1])) return m[1];
  const hint = AREA_HINTS.find(([k]) => s.includes(k));
  return hint ? hint[1] : '';
};
export const regionFromAddresses = (addresses) => {
  for (const a of addresses || []) {
    const r = regionFromAddress(a);
    if (r) return r;
  }
  return '';
};

export const sortFactories = (list) => [...(list || [])].sort((a, b) => str(a.name).localeCompare(str(b.name), 'ko'));

/**
 * 편직처 검색 (이름·지역·주소·담당자·메모·편직료·기계 종류·제조사·피더)
 *  · '96F'처럼 숫자 + F면 피더가 96인 기계가 있는 편직처 ('36/48' 기계도 48F로 찾힘 — 2026-11-24, 개발 고도화 3단계)
 *  · '방문' · '통화'는 그 기록이 있는 편직처도
 */
export const factoryMatches = (factory, query) => {
  const q = str(query).toLowerCase();
  if (!q) return true;
  const feederQ = /^\d{2,3}\s*f$/i.test(q) ? Number(q.replace(/\D/g, '')) : null;
  if (feederQ && (factory.machines || []).some(m => feederNumbers(m?.feeder).includes(feederQ))) return true;
  const hay = [
    factory.name, factory.region, factory.phone, ...(factory.addresses || []),
    ...(factory.contacts || []).map(c => `${c.name} ${c.mobile}`),
    ...(factory.memos || []).map(m => `${m?.text || ''}${isContactKind(memoKindOf(m)) ? ` ${memoKindInfo(m.kind).label}` : ''}`), factory.knitFee,
    ...(factory.machines || []).map(m => `${m.type} ${m.maker} ${m.note} ${feederLabel(m.feeder)}`),
  ].join(' ').toLowerCase();
  return hay.includes(q);
};

// ============================================================
// 3. 기계로 찾기
// ============================================================
/**
 * 모든 편직처의 기계 줄을 한 표로 + 거르기
 *  filters: { gauge, inch, feeder, feederUnknown, family, type, maker, region, spandex('yes'|''), text, near }
 *  상태(게이지를 넣었을 때): 'now' 지금 꼽혀 있음 / 'swap' 같은 종류·인치 보유 가마로 바꾸면 됨 / 'near' 근접(±1G · ±2" · 피더 ±10%)
 *  피더(2026-11-24, 개발 고도화 3단계): 기계 줄 피더 글자의 숫자와 같으면 'exact', 근접 포함이면 ±10% 'near'(상태도 근접)
 *    피더가 안 적힌 기계는 빼고, feederUnknown 이면 'unknown'으로 같이 (같은 상태 안에서 맨 뒤)
 *  반환: [{ factory, machine, block, status, hitGauges, feederHit }] — now → swap → near, 그 안에서 편직처 · 종류 · 인치 순
 */
export const searchMachines = (factories, filters = {}, config) => {
  const gauge = Number(filters.gauge) > 0 ? Number(filters.gauge) : null;
  const inch = Number(filters.inch) > 0 ? Number(filters.inch) : null;
  const feeder = feederQuery(filters.feeder);
  const text = str(filters.text).toLowerCase();
  const out = [];
  (factories || []).forEach(factory => {
    if (filters.region && str(factory.region) !== filters.region) return;
    buildBlocks(factory, config).forEach(block => {
      if (filters.family && block.family !== filters.family) return;
      if (filters.type && block.type !== filters.type) return;
      // 인치
      let inchNear = false;
      if (inch !== null && block.inch !== inch) {
        if (filters.near && block.inch && Math.abs(block.inch - inch) <= 2) inchNear = true;
        else return;
      }
      block.machines.forEach(machine => {
        if (filters.maker && machine.maker !== filters.maker) return;
        if (filters.spandex === 'yes' && machine.spandex !== 'yes') return;
        if (text) {
          const hay = [factory.name, machine.type, machine.note, machine.maker, machine.feeder].join(' ').toLowerCase();
          if (!hay.includes(text)) return;
        }
        // 피더
        let feederHit = null;
        if (feeder !== null) {
          const nums = feederNumbers(machine.feeder);
          if (!nums.length) {
            if (!filters.feederUnknown) return;
            feederHit = 'unknown';
          } else if (nums.includes(feeder)) feederHit = 'exact';
          else if (filters.near && nums.some(n => Math.abs(n - feeder) <= feederNearTolerance(feeder))) feederHit = 'near';
          else return;
        }
        let status = null;
        let hitGauges = [];
        if (gauge !== null) {
          const cylGauges = block.cylinders.map(c => c.gauge);
          if (machine.gauge === gauge) { status = 'now'; hitGauges = [gauge]; }
          else if (cylGauges.includes(gauge)) { status = 'swap'; hitGauges = [gauge]; }
          else if (filters.near) {
            const close = [...new Set([machine.gauge, ...cylGauges].filter(g => g && Math.abs(g - gauge) <= 1))];
            if (!close.length) return;
            status = 'near';
            hitGauges = close;
          } else return;
        }
        if (inchNear || feederHit === 'near') status = 'near';
        out.push({ factory, machine, block, status, hitGauges, feederHit });
      });
    });
  });
  const rank = { now: 0, swap: 1, near: 2 };
  return out.sort((a, b) => ((rank[a.status] ?? 0) - (rank[b.status] ?? 0))
    || ((a.feederHit === 'unknown' ? 1 : 0) - (b.feederHit === 'unknown' ? 1 : 0))
    || str(a.factory.name).localeCompare(str(b.factory.name), 'ko')
    || (familyIndex(config, a.block.family) - familyIndex(config, b.block.family))
    || (typeIndex(config, a.block.type) - typeIndex(config, b.block.type))
    || ((a.block.inch || 0) - (b.block.inch || 0))
    || ((a.machine.gauge || 0) - (b.machine.gauge || 0)));
};

/** 거르기가 하나라도 있는지 (지도 '찾기 결과만') */
export const hasMachineFilter = (f) => !!(Number(f?.gauge) > 0 || Number(f?.inch) > 0 || feederQuery(f?.feeder) !== null
  || f?.family || f?.type || f?.maker || f?.spandex || str(f?.text));
/** 거르기 글자 한 줄 (지도 '[기계로 찾기] 조건에 맞는 곳만' 아래) — '28G · 30" · 피더 96F · 싱글 계열 …' */
export const machineFilterLabel = (f) => [
  Number(f?.gauge) > 0 && `${f.gauge}G`, Number(f?.inch) > 0 && `${f.inch}"`, feederQuery(f?.feeder) !== null && `피더 ${feederQuery(f.feeder)}F`,
  f?.family && `${f.family} 계열`, f?.type, f?.maker, f?.spandex === 'yes' && '스판장치', str(f?.text),
].filter(Boolean).join(' · ');

// ============================================================
// 4. 설계서에 넣을 값 (설계서 편직 사양 [기계 현황에서 고르기])
// ============================================================
//  2026-11-24 대표님: 설계서 편직 사양(편직처 · 기종 · 게이지 · 인치 · 침수 · 피더)은 기계 현황에서만 고름
//   · 기종 = 기계 현황 종류 이름 · 침수가 안 적힌 기계면 계산 값을 넣고 '≈ 계산 값' 표시(knitLink.needleEstimated)
//   · 피더는 기계 것 (가마에는 없음) — 고른 기계 줄의 피더 그대로
/**
 * 고른 기계 + 게이지 → { fields: 설계서 knitting 칸 값, link: 설계서 knitLink }
 *  fields: factory · machineType(종류) · gauge · machineInch · needleCount · feederCount (빈 값은 '')
 */
export const sheetFieldsFromPick = (factory, machine, gauge) => {
  const g = Number(gauge) > 0 ? Number(gauge) : machine.gauge;
  const n = g ? needlesFor(factory, machine.type, machine.inch, g, g === machine.gauge ? machine.needles : null) : null;
  const fields = {
    factory: str(factory?.name),
    machineType: str(machine.type),
    gauge: g ? String(g) : '',
    machineInch: machine.inch ? String(machine.inch) : '',
    needleCount: n ? String(n.value) : '',
    feederCount: str(machine.feeder),
  };
  const link = {
    factoryId: factory?.id || '', factoryName: str(factory?.name), machineId: machine.id || '', type: str(machine.type),
    inch: machine.inch || null, gauge: g || null, needleEstimated: !!n?.estimated, at: new Date().toISOString(),
  };
  return { fields, link };
};

// ── 설계서 ↔ 기계 현황 맞춰 보기 (알람 · 예전 설계서 맞추기) ──
// 예전 설계서 기종 글자 → 종류 (설정 목록에서 같은 이름 · 그 이름을 품은 종류 — 예: 쥬리 → '쥬리전용')
const LEGACY_TYPE_WORDS = [
  [/^(double\s*jacquard|더블\s*자카드|양면\s*자카드)$/i, '양면 자카드'],
  [/^(single\s*jacquard|싱글\s*자카드)$/i, '싱글 자카드'],
  [/^(single|싱글)$/i, '싱글'],
  [/^(double|더블|양면|interlock|인터록|rib)$/i, '양면'],
  [/^(siru|시루)/i, '시루'],
  [/^(jurry|jury|쥬리|쭈리)/i, '쥬리'],
  [/(양면\s*벨로아)/i, '양면 벨로아'],
  [/(벨로아|velour)/i, '벨로아'],
  [/(테리|terry)/i, '테리'],
];
const squash = (s) => str(s).replace(/\s+/g, '');
export const typeFromSheetMachine = (machineType, config) => {
  const t = str(machineType);
  if (!t) return '';
  if (isKnownType(config, t)) return t;
  const hit = LEGACY_TYPE_WORDS.find(([re]) => re.test(t));
  if (!hit) return '';
  const types = config?.types || [];
  return types.find(x => squash(x.name) === squash(hit[1]))?.name
    || types.find(x => squash(x.name).includes(squash(hit[1])))?.name || '';
};

/**
 * 설계서 편직 사양이 기계 현황의 어느 묶음(종류 + 인치)인지
 *  status: 'empty'(편직 칸 비어 있음) · 'incomplete'(인치 · 게이지가 없음) · 'no-factory' · 'no-machine' · 'ambiguous' · 'ok'
 *  ok 일 때 exact = 설계서 기종이 기계 현황 종류 이름과 똑같은지 (예전 'SINGLE'이면 false)
 */
export const matchSheetKnitting = (knitting, factories, config) => {
  const k = knitting || {};
  const name = str(k.factory);
  const gauge = numOrNull(k.gauge);
  const inch = numOrNull(k.machineInch);
  if (!name && !gauge && !inch && !str(k.machineType)) return { status: 'empty' };
  // 편직처가 비어 있으면 '덜 채워짐' (노란 안내) — 가설계서(레시피)는 편직처 없이 쓰는 게 보통이라 빨간 알람은 안 띄움 (2026-11-24)
  if (!name) return { status: 'incomplete', factory: null, typeHint: typeFromSheetMachine(k.machineType, config) };
  const factory = (factories || []).find(f => sameFactoryName(f.name, name)) || null;
  if (!factory) return { status: 'no-factory', name };
  const typeHint = typeFromSheetMachine(k.machineType, config);
  if (!gauge || !inch) return { status: 'incomplete', factory, typeHint };
  const blocks = buildBlocks(factory, config).filter(b => b.inch === inch && b.gauges.includes(gauge));
  if (!blocks.length) return { status: 'no-machine', factory, typeHint, gauge, inch };
  let pick = typeHint ? blocks.filter(b => b.type === typeHint) : [];
  if (!pick.length && typeHint) pick = blocks.filter(b => b.family === familyOf(config, typeHint));
  if (!pick.length && blocks.length === 1) pick = blocks;
  if (pick.length === 1) return { status: 'ok', factory, block: pick[0], typeHint, exact: pick[0].type === str(k.machineType) };
  return { status: 'ambiguous', factory, candidates: pick.length ? pick : blocks, typeHint };
};

/** 알람 글자 — 기계 현황에 없는 기계면 글자, 아니면 '' (목록 ⚠ · 설계서 편직 사양 위) */
export const sheetKnitAlarm = (knitting, factories, config) => {
  const m = matchSheetKnitting(knitting, factories, config);
  const k = knitting || {};
  if (m.status === 'no-factory') return `편직처 '${m.name}'이(가) 기계 현황에 없어요`;
  if (m.status === 'no-machine') return `${m.factory.name}에 ${m.typeHint || str(k.machineType) || ''} ${inchLabel(m.inch)} ${m.gauge}G 기계 · 가마가 없어요`.replace(/\s+/g, ' ');
  return '';
};

const feederKey = (f) => str(f).replace(/F/gi, '').replace(/\s+/g, '');
/**
 * 예전 설계서 하나를 기계 현황에 맞추는 안 (대표님 2026-11-24 결정)
 *  · 편직처 이름 · 기종(종류 이름)을 기계 현황에 맞춤 · 침수 · 피더는 설계서 값이 있으면 그대로(다르면 diffs), 비었으면 기계 현황 값(침수 없으면 계산 값)
 *  · 애매하고 기종이 비었으면 같은 편직처 · 같은 조직 설계서의 기종을 따름
 *  반환: { sheet, status, match, changes: { 칸: [전, 후] }, diffs: [{ label, sheet, machine }], link, note }
 */
export const proposeSheetAlignment = (sheet, factories, config, allSheets = []) => {
  const k = sheet?.knitting || {};
  let m = matchSheetKnitting(k, factories, config);
  let note = '';
  if (m.status === 'ambiguous' && !m.typeHint && str(k.structure)) {
    const sib = allSheets.find(x => x.id !== sheet.id && sameFactoryName(x.knitting?.factory, k.factory)
      && squash(x.knitting?.structure) === squash(k.structure) && typeFromSheetMachine(x.knitting?.machineType, config));
    const t = sib ? typeFromSheetMachine(sib.knitting.machineType, config) : '';
    const hit = t ? m.candidates.filter(b => b.type === t) : [];
    if (hit.length === 1) {
      m = { status: 'ok', factory: m.factory, block: hit[0], typeHint: t, exact: false };
      note = `기종이 비어서 같은 편직처 · 같은 조직(${k.structure}) 설계서 ${sib.eztexOrderNo || sib.articleNo || ''}처럼 ${t}`;
    }
  }
  if (m.status !== 'ok') return { sheet, status: m.status, match: m, changes: {}, diffs: [], link: null, note };
  const { factory, block } = m;
  if (m.typeHint && m.typeHint !== block.type) note = `기종 '${k.machineType}' → 같은 계열의 ${block.type} (${factory.name}엔 ${m.typeHint} ${inchLabel(block.inch)} ${k.gauge}G가 없어요)`;
  const g = numOrNull(k.gauge);
  // 같은 게이지가 꽂힌 기계가 여럿이면 설계서 피더와 같은 기계 (명진 12G 36": 60/48F · 48F)
  const withGauge = block.machines.filter(x => x.gauge === g);
  const mounted = withGauge.find(x => str(k.feederCount) && feederKey(x.feeder) === feederKey(k.feederCount)) || withGauge[0];
  const feeders = [...new Set(block.machines.map(x => str(x.feeder)).filter(Boolean))];
  const machineFeeder = str(mounted?.feeder) || (feeders.length === 1 ? feeders[0] : '');
  const needles = needlesFor(factory, block.type, block.inch, g, mounted?.needles || null);
  const changes = {};
  const diffs = [];
  if (str(k.factory) !== factory.name) changes.factory = [str(k.factory), factory.name];
  if (str(k.machineType) !== block.type) changes.machineType = [str(k.machineType), block.type];
  let needleEstimated = false;
  if (!str(k.needleCount)) {
    if (needles) { changes.needleCount = ['', String(needles.value)]; needleEstimated = needles.estimated; }
  } else if (needles && !needles.estimated && Number(k.needleCount) !== needles.value) {
    diffs.push({ label: '침수', sheet: str(k.needleCount), machine: String(needles.value) });
  }
  if (!str(k.feederCount)) {
    if (machineFeeder) changes.feederCount = ['', machineFeeder];
  } else if (machineFeeder && feederKey(k.feederCount) !== feederKey(machineFeeder)) {
    diffs.push({ label: '피더', sheet: str(k.feederCount), machine: machineFeeder });
  }
  const link = {
    factoryId: factory.id || '', factoryName: factory.name, machineId: mounted?.id || block.machines[0]?.id || '', type: block.type,
    inch: block.inch, gauge: g, needleEstimated: needleEstimated || !!(sheet.knitLink?.needleEstimated && !changes.needleCount && str(k.needleCount)),
  };
  return { sheet, status: 'ok', match: m, changes, diffs, link, note };
};

// ── 이름으로 이어진 곳 (편직처 이름 바꾸기 — 2026-11-24 빈틈 막기) ──
/** 설계서 · 가설계서가 이 편직처를 쓰는지 (knitLink 편직처 번호 또는 이름) */
export const sheetUsesFactory = (sheet, factoryId, name) => (!!factoryId && sheet?.knitLink?.factoryId === factoryId)
  || (!!str(name) && sameFactoryName(sheet?.knitting?.factory, name));
/** 생산 오더가 이 편직처에 편직을 맡겼는지 (이름) */
export const orderUsesFactory = (order, name) => !!str(name) && sameFactoryName(order?.steps?.knitting?.vendor, name);

// ── 가마 메모에 섞인 피더 ('48F' · '104F') — 피더는 기계 것 (2026-11-24) ──
const FEEDER_IN_NOTE = /(^|[\s·,(])(\d{2,3})\s*F(?=$|[\s·,)])/gi;
export const feedersInNote = (note) => [...str(note).matchAll(FEEDER_IN_NOTE)].map(m => `${m[2]}F`);
export const stripFeederFromNote = (note) => str(note).replace(FEEDER_IN_NOTE, '$1').replace(/\s*·\s*(·\s*)+/g, ' · ').replace(/^[\s·,]+|[\s·,]+$/g, '').replace(/\s{2,}/g, ' ');

// ── 기계 수정 기록 — 바뀐 것을 짧은 글자로 (2026-11-24 고도화) ──
const blockName = (type, inch) => `${type || '종류 없음'} ${inchLabel(inch) || '인치?'}`;
/** 기계 · 가마 전 → 후 비교 → ['싱글 26" 기계 27대 → 8대', '싱글 32" 가마 30G 추가', …] (최대 12줄) */
export const describeEquipmentChanges = (before, after) => {
  const out = [];
  const bm = new Map((before?.machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m)).map(m => [m.id, m]));
  const am = new Map((after?.machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m)).map(m => [m.id, m]));
  am.forEach((m, id) => {
    const o = bm.get(id);
    const where = blockName(m.type, m.inch);
    if (!o) { out.push(`${where} 기계 줄 추가${m.count ? ` (${m.count}대)` : ''}${m.gauge ? ` ${m.gauge}G` : ''}`); return; }
    if (o.type !== m.type || o.inch !== m.inch) out.push(`${blockName(o.type, o.inch)} 기계 → ${where}`);
    if (o.count !== m.count) out.push(`${where} 기계 대수 ${o.count ?? '?'} → ${m.count ?? '?'}대`);
    if (o.gauge !== m.gauge) out.push(`${where} 지금 가마 ${o.gauge ? `${o.gauge}G` : '모름'} → ${m.gauge ? `${m.gauge}G` : '모름'}`);
    if (o.feeder !== m.feeder) out.push(`${where} 피더 ${o.feeder || '없음'} → ${m.feeder || '없음'}`);
    if (o.needles !== m.needles) out.push(`${where} 침수 ${o.needles ?? '없음'} → ${m.needles ?? '없음'}`);
    if (o.spandex !== m.spandex) out.push(`${where} 스판장치 ${spandexLabel(o.spandex)} → ${spandexLabel(m.spandex)}`);
    if (o.maker !== m.maker) out.push(`${where} 제조사 ${o.maker || '없음'} → ${m.maker || '없음'}`);
    if (o.note !== m.note) out.push(`${where} 기계 메모 고침`);
  });
  bm.forEach((o, id) => { if (!am.has(id)) out.push(`${blockName(o.type, o.inch)} 기계 줄 지움${o.count ? ` (${o.count}대)` : ''}`); });
  const bc = new Map((before?.cylinders || []).map(normalizeCylinder).filter(c => !isEmptyCylinder(c)).map(c => [c.id, c]));
  const ac = new Map((after?.cylinders || []).map(normalizeCylinder).filter(c => !isEmptyCylinder(c)).map(c => [c.id, c]));
  ac.forEach((c, id) => {
    const o = bc.get(id);
    const where = blockName(c.type, c.inch);
    if (!o) { out.push(`${where} 가마 ${c.gauge || '?'}G 추가${c.count ? ` (${c.count}개)` : ''}`); return; }
    if (o.gauge !== c.gauge || o.type !== c.type || o.inch !== c.inch) out.push(`${blockName(o.type, o.inch)} 가마 ${o.gauge}G → ${where} ${c.gauge}G`);
    if (o.count !== c.count) out.push(`${where} 가마 ${c.gauge}G 개수 ${o.count ?? '?'} → ${c.count ?? '?'}개`);
    if (o.needles !== c.needles) out.push(`${where} 가마 ${c.gauge}G 침수 ${o.needles ?? '없음'} → ${c.needles ?? '없음'}`);
    if (o.note !== c.note) out.push(`${where} 가마 ${c.gauge}G 메모 고침`);
  });
  bc.forEach((o, id) => { if (!ac.has(id)) out.push(`${blockName(o.type, o.inch)} 가마 ${o.gauge}G 지움`); });
  return out.length > 12 ? [...out.slice(0, 11), `그 밖에 ${out.length - 11}가지`] : out;
};
/** 기록 한 줄 붙이기 (최신이 위 · 100개까지) */
export const appendChangeLog = (factory, items, by) => (items && items.length
  ? [{ at: new Date().toISOString(), by: str(by), items }, ...(Array.isArray(factory?.changeLog) ? factory.changeLog : [])].slice(0, 100)
  : (factory?.changeLog || []));

// ── 편직 중인 오더 (생산 현황 연결 — 2026-11-24 고도화) ──
/**
 * 이 편직처에 편직을 맡긴, 끝나지 않은 오더 → 어느 묶음(종류 + 인치) · 게이지인지
 *  오더 → 연결 설계서(linkedSheetId) 또는 연결 원단의 설계서(fabric.linkedSheetId) → 그 설계서 편직 사양
 *  반환: [{ order, state: 'knitting'(편직 중) | 'waiting'(편직 대기), blockKey | null, type, inch, gauge, sheet }]
 */
export const knitJobsFor = (factory, { orders = [], designSheets = [], fabrics = [] } = {}, config) => {
  if (!factory) return [];
  const sheetById = new Map(designSheets.map(s => [String(s.id), s]));
  const fabricById = new Map(fabrics.map(f => [String(f.id), f]));
  const blocks = buildBlocks(factory, config);
  return orders.filter(o => o?.status === 'active' && orderUsesFactory(o, factory.name)
    && !o?.steps?.knitting?.stock && ['in_progress', 'pending', 'issue'].includes(o?.steps?.knitting?.status || 'pending'))
    .map(o => {
      const sheet = sheetById.get(String(o.linkedSheetId || ''))
        || sheetById.get(String(fabricById.get(String(o.linkedFabricId || ''))?.linkedSheetId || '')) || null;
      const k = sheet?.knitting || {};
      const type = sheet?.knitLink?.type || typeFromSheetMachine(k.machineType, config);
      const inch = numOrNull(k.machineInch);
      const gauge = numOrNull(k.gauge);
      const block = blocks.find(b => b.type === type && b.inch === inch) || null;
      return { order: o, state: o.steps.knitting.status === 'in_progress' ? 'knitting' : 'waiting', blockKey: block?.key || null, type, inch, gauge, sheet };
    });
};

// ============================================================
// 5. 지도 (카카오맵)
// ============================================================
/** 좌표를 찾을 주소 — 대표 주소에 시·군이 없으면 지역을 앞에 붙임 ('정교리 161-1' → '포천 정교리 161-1') */
export const geocodeQuery = (factory) => {
  const addr = str((factory?.addresses || [])[0]);
  if (!addr) return '';
  const hasCity = /([가-힣]{1,4})(시|군)(?=\s)/.test(addr);
  return !hasCity && factory.region ? `${factory.region} ${addr}` : addr;
};
/**
 * 대표 주소가 바뀌어서(또는 처음이라) 좌표를 다시 찾아야 하는지
 *  · 지도에서 직접 찍은 좌표는 주소가 그대로면 그대로 둠
 *  · 주소를 고치면 직접 찍은 좌표도 다시 찾음 (예전엔 직접 찍으면 영영 주소로 안 돌아갔음 — 2026-11-24)
 */
export const needsGeocode = (factory) => {
  const addr = str((factory?.addresses || [])[0]);
  if (!addr) return false;
  const g = factory?.geo;
  return !g || str(g.address) !== addr;
};
/** 두 좌표 사이 직선 거리 (km) */
export const distanceKm = (a, b) => {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const enc = (s) => encodeURIComponent(str(s).replace(/,/g, ' '));
/** 카카오맵 링크 (키 없이 됨) — 길찾기(도착) · 출발→도착 · 주소 검색 */
export const kakaoLinkTo = (name, geo) => (geo ? `https://map.kakao.com/link/to/${enc(name)},${geo.lat},${geo.lng}` : '');
export const kakaoLinkFromTo = (a, b) => (a?.geo && b?.geo
  ? `https://map.kakao.com/link/from/${enc(a.name)},${a.geo.lat},${a.geo.lng}/to/${enc(b.name)},${b.geo.lat},${b.geo.lng}`
  : '');
export const kakaoLinkSearch = (query) => (str(query) ? `https://map.kakao.com/link/search/${encodeURIComponent(str(query))}` : '');

// ============================================================
// 6. 정리본 가져오기 (예전 엑셀 → 그루빅이 한 줄씩 보고 정리한 JSON 파일 — 대표님 결정 2026-11-23)
//   { kind: 'grubig-knit-factories', version: 2, config: { families, types }, factories: [... + review: [확인할 것]], notes: [..] }
// ============================================================
export const SEED_KIND = 'grubig-knit-factories';
export const readSeedFile = (json) => {
  if (!json || json.kind !== SEED_KIND || !Array.isArray(json.factories)) {
    return { factories: [], error: '편직처 정리본 파일이 아니에요. 그루빅에서 만든 편직처 정리본(.json)을 올려 주세요.' };
  }
  const factories = json.factories
    .map(f => ({ ...cleanFactoryForSave(f), source: 'excel', review: Array.isArray(f.review) ? f.review.map(str).filter(Boolean) : [] }))
    .filter(f => f.name);
  return { factories, config: json.config || null, notes: Array.isArray(json.notes) ? json.notes : [], error: factories.length ? '' : '편직처가 없어요.' };
};
/** 정리본에 쓰인 종류 중 설정에 없는 것 → [{ name, family }] (정리본의 계열로) */
export const missingTypes = (config, seedConfig, factories) => {
  const used = new Set();
  (factories || []).forEach(f => {
    (f.machines || []).forEach(m => m.type && used.add(m.type));
    (f.cylinders || []).forEach(c => c.type && used.add(c.type));
  });
  const seedTypes = (seedConfig?.types || []);
  return [...used].filter(t => !isKnownType(config, t)).map(name => ({
    name, family: seedTypes.find(t => t.name === name)?.family || UNGROUPED_FAMILY,
  }));
};

// ============================================================
// 7. 엑셀로 내보내기 (2026-11-24, 개발 고도화 3단계)
//   시트 4개: 편직처(한 곳 한 줄) · 기계(기계 줄 한 줄) · 보유 가마(가마 줄 한 줄) · 메모(메모 · 방문 · 통화)
//   · 화면 거르기(검색 · 지역 · 계열)와 상관없이 전부 · 숫자 칸은 숫자로 (엑셀에서 더하기 · 정렬)
//   · 침수: 적힌 값(기계 > 가마)은 '침수', 안 적혀서 계산한 값은 '침수 ≈계산' 칸에 따로
//   · 우리 작업(설계서 · 생산 오더 수)은 상세 '우리 작업 이력'과 같은 기준 (이름)
// ============================================================
export const knitExportFileName = (today = todayLocalISO()) => `편직처_기계현황_${today}.xlsx`;

const localDate = (iso) => {
  if (!iso) return '';
  if (isYmd(iso)) return str(iso);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayLocalISO(d);
};
const cellNum = (n) => (Number(n) > 0 ? Number(n) : '');
const oneLine = (s) => str(s).replace(/\s*\n+\s*/g, ' / ');
/** 피더 칸 — 숫자 하나면 숫자('96' · '96F' → 96, 엑셀에서 정렬 · 거르기), 그 밖('36/48' · '12*3')은 글자 그대로 */
const feederCell = (feeder) => (/^\d+\s*F?$/i.test(str(feeder)) ? Number(str(feeder).replace(/\D/g, '')) : str(feeder));

/**
 * 내보낼 시트 4개 → [{ name, header, rows(줄마다 칸 배열), widths(칸 너비 — 글자 수) }]
 *  ctx: { designSheets, orders, today }
 */
export const buildKnitExportSheets = (factories, config, { designSheets = [], orders = [], today = todayLocalISO() } = {}) => {
  const list = sortFactories((factories || []).map(normalizeFactory));
  const factoryRows = [];
  const machineRows = [];
  const cylinderRows = [];
  const memoRows = [];
  list.forEach(f => {
    const totals = factoryTotals(f, config);
    const st = checkState(f, today);
    const memos = sortMemos(f.memos);
    const lastMemo = memos[0] || null;
    const lastContact = lastContactRecord(f.memos);
    const addresses = f.addresses.filter(Boolean);
    const sheets = (designSheets || []).filter(s => sameFactoryName(s?.knitting?.factory, f.name)).length;
    const knitOrders = (orders || []).filter(o => orderUsesFactory(o, f.name)).length;
    factoryRows.push([
      f.name, f.region, addresses[0] || '', addresses.slice(1).join(' / '), f.phone, f.fax,
      f.contacts.filter(c => c.name || c.mobile).map(c => `${c.name} ${c.mobile}`.trim()).join(' / '),
      totals.total || '', totals.lines || '', totals.cylinders || '',
      typeSummaries(totals.blocks).map(t => [t.type, t.inches.map(x => inchLabel(x.inch)).filter(Boolean).join('·'), gaugeRangeLabel(t.gauges)].filter(Boolean).join(' ')).join(' / '),
      f.checkedAt, st.tone === 'ok' ? '' : (st.tone === 'none' ? '확인일 없음' : `확인 필요 (${Math.floor(st.days / 30)}개월 전)`),
      lastContact ? `${lastContact.date} ${memoKindInfo(lastContact.kind).label}` : '',
      lastMemo ? `${lastMemo.date || ''} [${memoKindInfo(lastMemo.kind).label}] ${oneLine(lastMemo.text)}`.trim() : '',
      memos.length || '', sheets || '', knitOrders || '', oneLine(f.knitFee), localDate(f.updatedAt),
    ]);
    totals.blocks.forEach(b => {
      b.machines.forEach(m => {
        const n = m.gauge ? needlesFor(f, m.type, m.inch, m.gauge, m.needles) : (m.needles ? { value: m.needles, estimated: false } : null);
        machineRows.push([
          f.name, f.region, b.family, m.type, cellNum(m.inch), cellNum(m.gauge), cellNum(m.count), feederCell(m.feeder),
          n && !n.estimated ? n.value : '', n && n.estimated ? n.value : '',
          spandexLabel(m.spandex), m.maker, b.gauges.map(g => `${g}G`).join(' · '), oneLine(m.note),
        ]);
      });
      b.cylinders.forEach(c => {
        // 이 게이지가 지금 꼽힌 기계 대수 (대수 모르는 줄이 있으면 '+?')
        const mountedOn = b.machines.filter(m => m.gauge === c.gauge);
        const onSum = mountedOn.reduce((s, m) => s + (m.count || 0), 0);
        const mountedCount = !mountedOn.length ? '' : mountedOn.some(m => !m.count) ? (onSum ? `${onSum}+?` : '?') : onSum;
        const est = !c.needles ? estimateNeedles(c.gauge, c.inch) : null;
        cylinderRows.push([
          f.name, f.region, b.family, c.type, cellNum(c.inch), cellNum(c.gauge), cellNum(c.count), mountedCount,
          cellNum(c.needles), est || '', oneLine(c.note),
        ]);
      });
    });
    memos.forEach(m => {
      memoRows.push([
        f.name, str(m?.date), memoKindInfo(m?.kind).label, str(m?.text), str(m?.by),
        [m?.writtenAt && `${m.writtenAt} 남김`, m?.editedAt && `${m.editedAt} 고침${m.editedBy ? ` (${m.editedBy})` : ''}`].filter(Boolean).join(' · '),
      ]);
    });
  });
  return [
    {
      name: '편직처',
      header: ['편직처', '지역', '대표 주소', '다른 주소', '전화', '팩스', '담당자', '기계 대수', '기계 줄', '보유 가마(개)', '기계 종류',
        '확인일', '확인 필요', '최근 방문 · 통화', '최근 메모', '메모 수', '설계서', '생산 오더', '편직료', '마지막 저장'],
      rows: factoryRows,
      widths: [14, 7, 34, 24, 14, 14, 26, 9, 8, 11, 40, 11, 16, 16, 40, 7, 7, 8, 30, 11],
    },
    {
      name: '기계',
      header: ['편직처', '지역', '계열', '종류', '인치', '지금 게이지', '대수', '피더', '침수', '침수 ≈계산', '스판장치', '제조사', '쓸 수 있는 가마', '메모'],
      rows: machineRows,
      widths: [14, 7, 7, 12, 6, 10, 6, 8, 7, 10, 8, 9, 30, 30],
    },
    {
      name: '보유 가마',
      header: ['편직처', '지역', '계열', '종류', '인치', '게이지', '가마 개수', '지금 꼽힌 기계(대)', '침수', '침수 ≈계산', '메모'],
      rows: cylinderRows,
      widths: [14, 7, 7, 12, 6, 7, 9, 16, 7, 10, 30],
    },
    {
      name: '메모',
      header: ['편직처', '날짜', '종류', '내용', '쓴 사람', '남김 · 고침'],
      rows: memoRows,
      widths: [14, 11, 6, 60, 10, 24],
    },
  ];
};
