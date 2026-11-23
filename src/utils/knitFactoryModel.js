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
//     memos: [{ id, date, text, by }], checkedAt('YYYY-MM-DD'), geo: { lat, lng, address(이 주소로 찾음), manual(지도에서 찍음) } | null,
//     source('excel'), createdAt, createdBy, updatedAt, updatedBy }
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
export const EMPTY_MACHINE_FILTERS = { gauge: '', inch: '', family: '', type: '', maker: '', region: '', spandex: '', text: '', near: true };

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

/** 편직처 검색 (이름·지역·주소·담당자·메모·편직료·기계 종류·제조사) */
export const factoryMatches = (factory, query) => {
  const q = str(query).toLowerCase();
  if (!q) return true;
  const hay = [
    factory.name, factory.region, factory.phone, ...(factory.addresses || []),
    ...(factory.contacts || []).map(c => `${c.name} ${c.mobile}`),
    ...(factory.memos || []).map(m => m.text), factory.knitFee,
    ...(factory.machines || []).map(m => `${m.type} ${m.maker} ${m.note}`),
  ].join(' ').toLowerCase();
  return hay.includes(q);
};

// ============================================================
// 3. 기계로 찾기
// ============================================================
/**
 * 모든 편직처의 기계 줄을 한 표로 + 거르기
 *  filters: { gauge, inch, family, type, maker, region, spandex('yes'|''), text, near }
 *  상태(게이지를 넣었을 때): 'now' 지금 꼽혀 있음 / 'swap' 같은 종류·인치 보유 가마로 바꾸면 됨 / 'near' 근접(±1G · ±2")
 *  반환: [{ factory, machine, block, status, hitGauges }] — now → swap → near, 그 안에서 편직처 · 종류 · 인치 순
 */
export const searchMachines = (factories, filters = {}, config) => {
  const gauge = Number(filters.gauge) > 0 ? Number(filters.gauge) : null;
  const inch = Number(filters.inch) > 0 ? Number(filters.inch) : null;
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
        if (inchNear) status = 'near';
        out.push({ factory, machine, block, status, hitGauges });
      });
    });
  });
  const rank = { now: 0, swap: 1, near: 2 };
  return out.sort((a, b) => ((rank[a.status] ?? 0) - (rank[b.status] ?? 0))
    || str(a.factory.name).localeCompare(str(b.factory.name), 'ko')
    || (familyIndex(config, a.block.family) - familyIndex(config, b.block.family))
    || (typeIndex(config, a.block.type) - typeIndex(config, b.block.type))
    || ((a.block.inch || 0) - (b.block.inch || 0))
    || ((a.machine.gauge || 0) - (b.machine.gauge || 0)));
};

/** 거르기가 하나라도 있는지 (지도 '찾기 결과만') */
export const hasMachineFilter = (f) => !!(Number(f?.gauge) > 0 || Number(f?.inch) > 0 || f?.family || f?.type || f?.maker || f?.spandex || str(f?.text));

// ============================================================
// 4. 설계서에 넣을 값 (설계서 편직 사양 [기계 현황에서 고르기])
// ============================================================
/** 고른 기계 + 게이지 → 설계서 knitting 칸 값 (빈 값은 안 넣음 — 설계서 칸 유지). 침수는 적힌 값만 (계산 값 X) */
export const sheetFieldsFromPick = (factory, machine, gauge) => {
  const fields = { factory: str(factory?.name) };
  const g = Number(gauge) > 0 ? Number(gauge) : machine.gauge;
  if (g) fields.gauge = String(g);
  if (machine.inch) fields.machineInch = String(machine.inch);
  const n = g ? needlesFor(factory, machine.type, machine.inch, g, g === machine.gauge ? machine.needles : null) : null;
  if (n && !n.estimated) fields.needleCount = String(n.value);
  const feeder = str(machine.feeder);
  if (/^\d+$/.test(feeder)) fields.feederCount = feeder;
  return fields;
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
/** 대표 주소가 바뀌어서(또는 처음이라) 좌표를 다시 찾아야 하는지 (지도에서 직접 찍은 좌표는 그대로) */
export const needsGeocode = (factory) => {
  const addr = str((factory?.addresses || [])[0]);
  if (!addr) return false;
  const g = factory?.geo;
  return !g || (!g.manual && g.address !== addr);
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
