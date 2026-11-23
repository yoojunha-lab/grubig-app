// ============================================================
// GRUBIG ERP - 편직처 기계 현황 (개발 ▾ 편직처 기계 현황) 계산 — 대표님 요청 2026-11-23
//  순수 함수만 (React·Firestore 없음 — Node에서도 돌아감). 화면·훅은 이 파일의 모양을 따름.
//
// ■ knitFactories 문서 (Firestore 컬렉션 knitFactories, 문서 ID = id)
//   {
//     id, name(편직처 이름 — 설계서 편직처 목록과 같은 이름),
//     phone(전화), fax(팩스), contacts: [{ id, name(담당자·직함), mobile(핸드폰) }],
//     addresses: [주소…](첫 번째가 대표 주소), region(지역 — 주소에서 자동, 고칠 수 있음),
//     knitFee(편직료 — 여러 줄 글자),
//     machines: [기계 줄 — 아래], memos: [{ id, date, text, by }](메모 — 최신이 위),
//     checkedAt('YYYY-MM-DD' — 기계 현황 마지막 확인일), source('excel' — 엑셀에서 옮김),
//     createdAt, createdBy, updatedAt, updatedBy,
//   }
// ■ 기계 줄 (machines[])
//   { id, category('single'|'double'|'jacquard'|'etc'), group(세부 종류 — 엑셀의 '싱글(SPAN)'·'쥬리' 같은 묶음 이름),
//     count(기계 대수), inch(인치 = 엑셀 '폭(")'), feeder(피더 — 글자: '96' · '12*3' · '36/48'),
//     needles(침수), cylinders(가마수), gauges([게이지… — 그 인치에 낄 수 있는 가마들. 예: 26"에 28·30·32G]),
//     maker(제조사 — 금용·쌍용·삼세스…), note(메모) }
//   · 가마 = 갈아 끼우는 실린더(게이지) — 대표님 설명 2026-11-23. 가마수 = 그 게이지 가마 개수
//   · 침수 ≈ 게이지 × 3.14 × 인치 (28G 30" → 2,639) — 빈 칸은 화면에서 '≈ 계산 값'으로만 보여 줌 (저장은 안 함)
// ============================================================

import { todayLocalISO } from './helpers';

export const KNIT_FACTORY_COLLECTION = 'knitFactories';

// 기계 종류 4묶음 (엑셀 칸 묶음 그대로)
export const KNIT_CATEGORIES = [
  { key: 'single', label: '싱글', tone: 'sky' },
  { key: 'double', label: '더블', tone: 'violet' },
  { key: 'jacquard', label: '자카드', tone: 'amber' },
  { key: 'etc', label: '기타', hint: '양두·테리·벨로아 등', tone: 'emerald' },
];
export const KNIT_CATEGORY_KEYS = KNIT_CATEGORIES.map(c => c.key);
// 종류 칩 색 (Tailwind 글자)
const CATEGORY_TONE_CLASS = {
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
export const categoryTone = (key) => CATEGORY_TONE_CLASS[KNIT_CATEGORIES.find(c => c.key === key)?.tone || 'emerald'];
/** 피더 표시 — 숫자만이면 '96F', 그 밖('12*3' · '36/48')은 그대로 */
export const feederLabel = (feeder) => {
  const f = String(feeder || '').trim();
  return /^\d+$/.test(f) ? `${f}F` : f;
};
/** 숫자 → '1,234' (없으면 빈 글자) */
export const fmtNum = (n) => (n || n === 0 ? Number(n).toLocaleString() : '');
export const categoryLabel = (key) => KNIT_CATEGORIES.find(c => c.key === key)?.label || '기타';

// 제조사 — 엑셀에 쓰인 다른 글자(금융·후꾸하라·Terrot)도 같은 제조사로
export const KNIT_MAKERS = [
  { name: '금용', aliases: ['금용', '금융'] },
  { name: '쌍용', aliases: ['쌍용'] },
  { name: '삼세스', aliases: ['삼세스'] },
  { name: '후쿠하라', aliases: ['후쿠하라', '후꾸하라', 'fukuhara'] },
  { name: '테롯', aliases: ['테롯', 'terrot'] },
  { name: '오로조', aliases: ['오로조', 'orizio'] },
  { name: '마이어', aliases: ['마이어', 'mayer'] },
  { name: '창대', aliases: ['창대'] },
];

// 기계 현황을 확인한 지 이만큼 지나면 '오래됨' 표시
export const KNIT_CHECK_STALE_DAYS = 180;

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const str = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ============================================================
// 1. 빈 양식 · 정리
// ============================================================
export const makeBlankMachine = (category = 'single', group = '') => ({
  id: uid('km'), category, group, count: null, inch: null, feeder: '', needles: null, cylinders: null, gauges: [], maker: '', note: '',
});
export const makeBlankContact = () => ({ id: uid('kc'), name: '', mobile: '' });

export const makeBlankFactory = () => ({
  name: '', phone: '', fax: '', contacts: [makeBlankContact()], addresses: [''], region: '', knitFee: '',
  machines: [], memos: [], checkedAt: '',
});

const normalizeGauges = (v) => {
  const list = Array.isArray(v) ? v : parseGaugeInput(v);
  return [...new Set(list.map(Number).filter(n => Number.isFinite(n) && n > 0))];
};

export const normalizeMachine = (m = {}) => ({
  id: m.id || uid('km'),
  category: KNIT_CATEGORY_KEYS.includes(m.category) ? m.category : 'etc',
  group: str(m.group),
  count: numOrNull(m.count),
  inch: numOrNull(m.inch),
  feeder: str(m.feeder),
  needles: numOrNull(m.needles),
  cylinders: numOrNull(m.cylinders),
  gauges: normalizeGauges(m.gauges),
  maker: str(m.maker),
  note: str(m.note),
});

/** 저장소 문서 → 화면 양식 (빠진 칸 채우기). 입력 창은 이 모양으로 엶 */
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
  memos: Array.isArray(doc.memos) ? doc.memos : [],
  checkedAt: str(doc.checkedAt),
});

/** 저장 전 정리 — 빈 담당자·주소·기계 줄 빼기, 지역이 비었으면 주소에서 */
export const cleanFactoryForSave = (input) => {
  const f = normalizeFactory(input);
  const addresses = f.addresses.map(str).filter(Boolean);
  const machines = f.machines.filter(m => !isEmptyMachine(m));
  return {
    ...f,
    name: f.name.replace(/\s+/g, ' '),
    contacts: f.contacts.filter(c => c.name || c.mobile),
    addresses,
    region: f.region || regionFromAddresses(addresses),
    knitFee: String(f.knitFee || '').replace(/\s+$/, ''),
    machines,
  };
};

export const isEmptyMachine = (m) => !m.count && !m.inch && !str(m.feeder) && !m.needles && !m.cylinders
  && !(m.gauges || []).length && !str(m.maker) && !str(m.note);

// 기계 줄 비교용 (고쳤는지 — 확인일 자동 갱신)
const machineSig = (list) => JSON.stringify((list || []).filter(m => !isEmptyMachine(m)).map(m => {
  const { id: _id, ...rest } = normalizeMachine(m);
  return rest;
}));
export const machinesChanged = (before, after) => machineSig(before) !== machineSig(after);

/** 같은 이름 비교 (띄어쓰기·대소문자 무시) */
export const sameFactoryName = (a, b) => str(a).replace(/\s+/g, '').toLowerCase() === str(b).replace(/\s+/g, '').toLowerCase();

// ============================================================
// 2. 게이지 · 침수 · 지역 · 합계
// ============================================================
/** '28, 30, 32' · '28/30' · '28G 30G' → [28, 30, 32] */
export const parseGaugeInput = (text) => {
  const s = str(text);
  if (!s) return [];
  return [...new Set((s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n <= 90))];
};
export const formatGauges = (gauges) => {
  const list = normalizeGauges(gauges);
  return list.length ? `${list.join(' · ')}G` : '';
};
export const gaugeInputText = (gauges) => normalizeGauges(gauges).join(', ');

/** 침수 계산 값 = 게이지 × π × 인치 (게이지가 하나일 때만) */
export const estimateNeedles = (gauge, inch) => {
  const g = Number(gauge);
  const i = Number(inch);
  if (!(g > 0) || !(i > 0)) return null;
  return Math.round(g * Math.PI * i);
};
/** 이 기계 줄의 침수 — 넣은 값 { value, estimated: false } / 계산 값 { value, estimated: true } / 없음 null */
export const machineNeedles = (m) => {
  if (m?.needles) return { value: m.needles, estimated: false };
  const gauges = normalizeGauges(m?.gauges);
  if (gauges.length !== 1) return null;
  const est = estimateNeedles(gauges[0], m?.inch);
  return est ? { value: est, estimated: true } : null;
};

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

/** 편직처 기계 합계 { total(대수 합), byCategory: { single: 대수 }, lines(줄 수), counted(대수를 적은 줄 수) } */
export const factoryTotals = (factory) => {
  const byCategory = Object.fromEntries(KNIT_CATEGORY_KEYS.map(k => [k, 0]));
  const linesByCategory = Object.fromEntries(KNIT_CATEGORY_KEYS.map(k => [k, 0]));
  let total = 0;
  let counted = 0;
  // 입력 창 값(글자)도 숫자로 바꿔서 셈 — 그냥 더하면 '3' + '3' = '33'
  const machines = (factory?.machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m));
  machines.forEach(m => {
    const key = KNIT_CATEGORY_KEYS.includes(m.category) ? m.category : 'etc';
    linesByCategory[key] += 1;
    if (m.count) { byCategory[key] += m.count; total += m.count; counted += 1; }
  });
  return { total, byCategory, linesByCategory, lines: machines.length, counted };
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

// 목록 정렬 — 이름 가나다
export const sortFactories = (list) => [...(list || [])].sort((a, b) => str(a.name).localeCompare(str(b.name), 'ko'));

// ============================================================
// 3. 기계로 찾기
// ============================================================
/**
 * 모든 편직처의 기계 줄을 한 표로 + 거르기
 *  filters: { gauge, inch, category('all'|key), maker, region, text, near(true면 게이지 ±1 · 인치 ±2 도 '근접'으로) }
 *  반환: [{ factory, machine, gaugeHit(맞는 게이지 목록), near(근접으로 걸림) }] — 딱 맞는 것 먼저, 그다음 근접, 같은 편직처끼리
 */
export const searchMachines = (factories, filters = {}) => {
  const gauge = Number(filters.gauge) > 0 ? Number(filters.gauge) : null;
  const inch = Number(filters.inch) > 0 ? Number(filters.inch) : null;
  const text = str(filters.text).toLowerCase();
  const out = [];
  (factories || []).forEach(factory => {
    if (filters.region && str(factory.region) !== filters.region) return;
    (factory.machines || []).forEach(raw => {
      const machine = normalizeMachine(raw);
      if (isEmptyMachine(machine)) return;
      if (filters.category && filters.category !== 'all' && machine.category !== filters.category) return;
      if (filters.maker && machine.maker !== filters.maker) return;
      if (text) {
        const hay = [factory.name, machine.group, machine.note, machine.maker, machine.feeder].join(' ').toLowerCase();
        if (!hay.includes(text)) return;
      }
      let near = false;
      let gaugeHit = machine.gauges;
      if (gauge !== null) {
        const exact = machine.gauges.filter(g => g === gauge);
        const close = filters.near ? machine.gauges.filter(g => g !== gauge && Math.abs(g - gauge) <= 1) : [];
        if (!exact.length && !close.length) return;
        if (!exact.length) near = true;
        gaugeHit = exact.length ? exact : close;
      }
      if (inch !== null) {
        if (machine.inch === inch) { /* 딱 맞음 */ } else if (filters.near && machine.inch && Math.abs(machine.inch - inch) <= 2) near = true;
        else return;
      }
      out.push({ factory, machine, gaugeHit, near });
    });
  });
  return out.sort((a, b) => (a.near - b.near)
    || str(a.factory.name).localeCompare(str(b.factory.name), 'ko')
    || (KNIT_CATEGORY_KEYS.indexOf(a.machine.category) - KNIT_CATEGORY_KEYS.indexOf(b.machine.category))
    || ((a.machine.inch || 0) - (b.machine.inch || 0))
    || ((a.machine.gauges[0] || 0) - (b.machine.gauges[0] || 0)));
};

/** 편직처 목록 검색 (이름·지역·주소·담당자·메모·기계 세부) */
export const factoryMatches = (factory, query) => {
  const q = str(query).toLowerCase();
  if (!q) return true;
  const hay = [
    factory.name, factory.region, factory.phone, ...(factory.addresses || []),
    ...(factory.contacts || []).map(c => `${c.name} ${c.mobile}`),
    ...(factory.memos || []).map(m => m.text), factory.knitFee,
    ...(factory.machines || []).map(m => `${m.group} ${m.maker} ${m.note}`),
  ].join(' ').toLowerCase();
  return hay.includes(q);
};

/** 기계 줄 묶기 — 종류 → 세부 종류(group) 순서는 넣은 순서 그대로 */
export const groupMachines = (machines) => KNIT_CATEGORIES.map(cat => {
  const rows = (machines || []).filter(m => (KNIT_CATEGORY_KEYS.includes(m.category) ? m.category : 'etc') === cat.key && !isEmptyMachine(m));
  const groups = [];
  rows.forEach(m => {
    const name = str(m.group);
    let g = groups.find(x => x.name === name);
    if (!g) { g = { name, rows: [] }; groups.push(g); }
    g.rows.push(m);
  });
  return { ...cat, groups, count: rows.reduce((s, m) => s + (m.count || 0), 0), lines: rows.length };
}).filter(c => c.lines > 0);

// ============================================================
// 4. 설계서에 넣을 값 (설계서 편직 사양 [기계 현황에서 고르기])
// ============================================================
/** 고른 기계 줄 + 게이지 → 설계서 knitting 칸 값 (빈 값은 안 넣음 — 기존 칸 유지) */
export const sheetFieldsFromMachine = (factory, machine, gauge) => {
  const fields = { factory: str(factory?.name) };
  const g = Number(gauge) > 0 ? Number(gauge) : (machine.gauges?.length === 1 ? machine.gauges[0] : null);
  if (g) fields.gauge = String(g);
  if (machine.inch) fields.machineInch = String(machine.inch);
  // 침수는 넣은 값만 (계산 값은 실제와 다를 수 있음) — 게이지가 하나인 줄일 때만 그 줄 침수가 이 게이지 침수
  if (machine.needles && (machine.gauges || []).length <= 1) fields.needleCount = String(machine.needles);
  const feeder = str(machine.feeder);
  if (/^\d+$/.test(feeder)) fields.feederCount = feeder;
  return fields;
};

// ============================================================
// 5. 엑셀 가져오기 (지금까지 쓰던 '편직처..xls' 양식)
//   · 1줄 = 편직처 이름(A)·전화(B)·팩스(C)·핸드폰(D)·대표/담당(E) / 기계 4묶음 칸(기계수·폭·피다수·침수·가마수·기종) / 비고 · 편직료 · 주소
//   · A칸에 이름이 있으면 새 편직처, 비어 있으면 위 편직처의 다음 줄
//   · '기종' 글자에서 게이지·제조사·메모를 나눔: '22G(금용,스판겸용)' → 22 · 금용 · 스판겸용 / '28G.22G,20G' → 28·22·20
//   · 숫자 없이 글자만 있는 칸 = 세부 종류 이름 ('싱글(SPAN)'·'쥬리'·'BL=OPEN기계') → 아래 줄들의 세부 종류
//   · '"' = 위와 같음 · 가마수 칸에 100 넘는 숫자 = 침수가 잘못 들어간 것 → 침수로
// ============================================================
const ADDRESS_RE = /(로|길|리|동|면|읍|가|번지)\s*\d|\d+-\d+\s*(번지)?$|(시|군|구)\s+[가-힣]+(로|길|면|읍|동|리)/;
const looksLikeAddress = (s) => ADDRESS_RE.test(s) && !/\/\s*k/i.test(s) && !/^총\s*\d/.test(s);
const hasDigit = (s) => /\d/.test(s);
const isDitto = (s) => /^["“”″]+$/.test(str(s));

const findMaker = (text) => {
  const lower = str(text).toLowerCase();
  for (const m of KNIT_MAKERS) {
    const alias = m.aliases.find(a => lower.includes(a.toLowerCase()));
    if (alias) return { name: m.name, alias };
  }
  return null;
};

const tidyNote = (s) => str(s)
  .replace(/[()]/g, ' ')
  .replace(/\s+-\s*/g, ',')
  .split(',')
  .map(t => t.replace(/\s+/g, ' ').replace(/^[-.\s=]+|[-.\s=]+$/g, ''))
  .filter(Boolean)
  .join(', ');

/** 엑셀 '기종' 글자 → { gauges, maker, note } */
export const parseModelText = (text) => {
  const s = str(text);
  if (!s) return { gauges: [], maker: '', note: '' };
  const cut = s.indexOf('(');
  let head = cut >= 0 ? s.slice(0, cut) : s;
  const tail = cut >= 0 ? s.slice(cut) : '';
  const gauges = [];
  const ok = (n) => n > 0 && n <= 60;
  // 11-12G (범위)
  head = head.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*G(?![A-Za-z])/gi, (m, a, b) => {
    if (!ok(Number(a)) || !ok(Number(b))) return m;
    gauges.push(Number(a), Number(b));
    return ' ';
  });
  head = head.replace(/(\d+(?:\.\d+)?)\s*G(?![A-Za-z])/gi, (m, a) => {
    if (!ok(Number(a))) return m;
    gauges.push(Number(a));
    return ' ';
  });
  let rest = `${head} ${tail}`;
  const maker = findMaker(rest);
  if (maker) rest = rest.replace(new RegExp(maker.alias, 'i'), ' ');
  return { gauges: [...new Set(gauges)], maker: maker?.name || '', note: tidyNote(rest) };
};

const parseCount = (s) => {
  const t = str(s).replace(/대$/, '').trim();
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
const parseInch = (s) => {
  const nums = (str(s).match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n < 100);
  return { inch: nums[0] || null, multi: nums.length > 1 };
};
const normalizeFeeder = (s) => str(s).replace(/(\d)\s*F\b/gi, '$1').replace(/\s+/g, '');
const fixPhone = (s) => str(s).replace(/-{2,}/g, '-');

/**
 * 엑셀 표(2차원 배열 — 시트 줄마다 칸 글자) → 편직처 목록
 *  반환: { factories: [{ …편직처 양식, warnings: [글자] }], error }
 */
export const parseKnitFactorySheet = (rows) => {
  const grid = (rows || []).map(r => (Array.isArray(r) ? r.map(c => str(c)) : []));
  const headerIdx = grid.findIndex(r => r.filter(c => c.replace(/\s/g, '') === '기계수').length >= 2);
  if (headerIdx < 0) return { factories: [], error: "편직처 엑셀 양식이 아니에요 — '기계수' 칸이 있는 줄을 찾지 못했어요." };
  const header = grid[headerIdx];
  const blockStarts = header.map((c, i) => (c.replace(/\s/g, '') === '기계수' ? i : -1)).filter(i => i >= 0).slice(0, 4);
  const blocks = blockStarts.map((start, i) => ({ start, category: KNIT_CATEGORY_KEYS[i] || 'etc' }));
  // 비고 · 편직료 · 주소 칸 (머리 줄에서 — 편직료 글자는 머리 칸보다 한 칸 앞에 적힌 줄도 있어서 비고 다음 칸부터 주소 앞 칸까지)
  const titleRow = grid.slice(0, headerIdx + 1).find(r => r.some(c => c.replace(/\s/g, '') === '주소')) || [];
  const col = (label, fallback) => {
    const i = titleRow.findIndex(c => c.replace(/\s/g, '') === label);
    return i >= 0 ? i : fallback;
  };
  const lastBlockEnd = (blockStarts[blockStarts.length - 1] ?? 23) + 6;
  const noteCol = col('비고', lastBlockEnd + 1);
  const addrCol = col('주소', noteCol + 3);
  const feeCols = [];
  for (let i = noteCol + 1; i < addrCol; i += 1) feeCols.push(i);

  const factories = [];
  let cur = null;
  let lastInBlock = {};   // 블록마다 바로 위 기계 줄 ('"' 채우기)
  let groupInBlock = {};  // 블록마다 지금 세부 종류 이름
  let makerInBlock = {};  // 세부 종류 이름에 들어 있던 제조사 (아래 줄 제조사가 없으면 이걸로)
  const memoLines = new Map(); // 편직처 → 메모 줄
  const feeLines = new Map();

  const startFactory = (name) => {
    cur = { ...makeBlankFactory(), name, contacts: [], addresses: [], source: 'excel', warnings: [] };
    factories.push(cur);
    memoLines.set(cur, []);
    feeLines.set(cur, []);
    lastInBlock = {};
    groupInBlock = {};
    makerInBlock = {};
  };

  for (let r = headerIdx + 1; r < grid.length; r += 1) {
    const row = grid[r];
    if (!row.some(Boolean)) continue;
    const rowNo = r + 1;
    const a = row[0] || '';
    if (a && !/^[`'".\s]+$/.test(a) && !/^\(.*\)$/.test(a)) startFactory(a.replace(/\s+/g, ' '));
    if (!cur) continue;
    if (/^\(.*\)$/.test(a)) memoLines.get(cur).push(a.replace(/^\(|\)$/g, ''));

    // 연락처
    const phone = fixPhone(row[1]);
    let fax = fixPhone(row[2]);
    let mobile = fixPhone(row[3]);
    const person = str(row[4]);
    if (/^01\d/.test(fax)) { // 팩스 칸에 핸드폰을 적은 줄
      if (!mobile) mobile = fax; else memoLines.get(cur).push(`핸드폰 ${fax}`);
      fax = '';
    }
    if (phone) cur.phone = cur.phone ? `${cur.phone} / ${phone}` : phone;
    if (fax) cur.fax = cur.fax ? `${cur.fax} / ${fax}` : fax;
    if (mobile || person) cur.contacts.push({ id: uid('kc'), name: person, mobile });
    if (/--/.test(str(row[1]) + str(row[2]) + str(row[3]))) cur.warnings.push(`${rowNo}줄 전화번호의 '--'를 '-'로 고쳤어요`);

    // 기계 4묶음
    const rowMachines = [];
    blocks.forEach(({ start, category }) => {
      const cells = row.slice(start, start + 6).map(str);
      if (!cells.some(Boolean)) return;
      const [cCount, cInch, cFeeder, cNeedle, cCyl, cModel] = cells;
      const numericCells = [cCount, cInch, cFeeder, cNeedle, cCyl].some(c => hasDigit(c) || isDitto(c));
      const model = parseModelText(cModel);
      const countFromModel = /^\d+\s*대$/.test(cModel) ? Number(cModel.replace(/\D/g, '')) : null;
      // 세부 종류 이름 줄 (숫자 없이 글자만)
      if (!numericCells && !model.gauges.length && countFromModel === null) {
        const label = cells.filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/[,.\s]+$/, '');
        groupInBlock[start] = label;
        makerInBlock[start] = findMaker(label)?.name || '';
        return;
      }
      const prev = lastInBlock[start] || null;
      // 인치: '"' 또는 빈 칸이면 같은 묶음 위 줄 인치 (엑셀에서 같은 인치는 비워 두거나 '"'로 적었음)
      let inchInfo = parseInch(cInch);
      let inchFilled = false;
      if (!inchInfo.inch && prev?.inch && (isDitto(cInch) || !cInch)) {
        inchInfo = { inch: prev.inch, multi: false };
        inchFilled = !isDitto(cInch);
      }
      let needles = isDitto(cNeedle) ? (prev?.needles || null) : parseCount(cNeedle);
      let cylinders = parseCount(cCyl);
      const notes = [];
      if (cylinders && cylinders > 100) {
        if (!needles) { needles = cylinders; cylinders = null; cur.warnings.push(`${rowNo}줄 가마수 칸의 ${needles}은 침수로 옮겼어요`); }
        else { notes.push(`가마수 칸 ${cylinders}`); cylinders = null; }
      }
      if (inchInfo.multi) notes.push(`인치 ${cInch}`);
      if (model.note) notes.push(model.note);
      const machine = normalizeMachine({
        category,
        group: groupInBlock[start] || '',
        count: parseCount(cCount) ?? countFromModel,
        inch: inchInfo.inch,
        feeder: isDitto(cFeeder) ? (prev?.feeder || '') : normalizeFeeder(cFeeder),
        needles,
        cylinders,
        gauges: model.gauges,
        maker: model.maker || makerInBlock[start] || '',
        note: notes.join(', '),
      });
      if (isDitto(cInch) || isDitto(cFeeder) || isDitto(cNeedle)) machine._ditto = true;
      if (inchFilled) machine._inchFilled = true;
      cur.machines.push(machine);
      rowMachines.push({ machine, modelText: cModel });
      lastInBlock[start] = machine;
    });

    // 비고 · 편직료 · 주소
    const note = str(row[noteCol]);
    const fee = feeCols.map(i => str(row[i])).filter(Boolean).join(' ');
    const addr = str(row[addrCol]);
    if (fee) {
      const context = note || (rowMachines.length === 1 ? rowMachines[0].modelText : '');
      feeLines.get(cur).push(context ? `${context}: ${fee}` : fee);
    } else if (note) {
      if (rowMachines.length === 1) {
        const m = rowMachines[0].machine;
        m.note = m.note ? `${m.note}, ${note}` : note;
      } else memoLines.get(cur).push(note);
    }
    if (addr) {
      if (looksLikeAddress(addr)) cur.addresses.push(addr);
      else memoLines.get(cur).push(addr);
    }
  }

  const today = todayLocalISO();
  const out = factories.map(f => {
    const memoText = memoLines.get(f).join('\n');
    const dittoCount = f.machines.filter(m => m._ditto).length;
    const warnings = [...f.warnings];
    if (dittoCount) warnings.push(`'"'(위와 같음) ${dittoCount}줄은 위 줄 값으로 채웠어요`);
    const inchFilledCount = f.machines.filter(m => m._inchFilled).length;
    if (inchFilledCount) warnings.push(`인치가 빈 ${inchFilledCount}줄은 위 줄 인치로 채웠어요`);
    const noGauge = f.machines.filter(m => !m.gauges.length).length;
    if (noGauge) warnings.push(`게이지를 못 읽은 기계 ${noGauge}줄 — 메모를 확인해 주세요`);
    if (!f.machines.length) warnings.push('기계 줄이 없어요');
    const machines = f.machines.map(({ _ditto, _inchFilled, ...m }) => m);
    const addresses = f.addresses;
    return {
      ...f,
      contacts: f.contacts.length ? f.contacts : [makeBlankContact()],
      addresses: addresses.length ? addresses : [''],
      region: regionFromAddresses(addresses),
      knitFee: feeLines.get(f).join('\n'),
      machines,
      memos: memoText ? [{ id: uid('kmemo'), date: today, text: `엑셀 비고에서 옮김\n${memoText}`, by: '엑셀' }] : [],
      warnings,
    };
  });
  return { factories: out, error: out.length ? '' : '편직처를 하나도 찾지 못했어요.' };
};
