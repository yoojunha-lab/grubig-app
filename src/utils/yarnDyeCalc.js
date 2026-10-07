// GRUBIG ERP - 선염 계산기 (순수 함수 — React/Firestore 의존 없음)
//  생산 ▾ 계산기 (대표님 요청 2026-10-07). 저장: Firestore yarnDyeCalcs (hooks/domains/useYarnDyeCalc.js)
//
// ■ ① 스트라이프 선염 (kind 'stripe')
//   오더 컬러(예: APRICOT/BARK BROWN)마다 원사 컬러별 비율(%)을 넣으면 → 원사 컬러별 수량·혼용율
//   · 오더 컬러 수량 × 원사 비율% = 그 원사 컬러 수량. 같은 원사 컬러(대소문자·띄어쓰기 무시)는 합침 (컬러 공용)
//   · 혼용율 = 원사 컬러 수량 ÷ 전체 원사 수량. 로스는 넣지 않음 (대표님 지정 — 오더 수량 그대로)
//   · 원사명 = ARTICLE(원단)의 원사 + 컬러 (예: 'F/60Nm SW/N 87/13' + 'APRICOT'). 원사가 여러 개면 선염할 원사 하나를 고름
//   · 컬러명을 '/'로 나눠 원사 컬러 칸을 채움 (APRICOT/BARK BROWN → APRICOT, BARK BROWN)
// ■ ② 멜란지 선염 (kind 'melange')
//   줄마다 멜란지(1%·8% …)와 수량 → 수량 비율 (대표님 지정: 비율 = 수량 비율)
// ■ 화면 기본 정보는 O/D(생산 현황 오더) · ARTICLE(원단 관리) · 메모 (대표님 지정 2026-10-07 — 제목 칸 없음)
//   저장 제목(title)은 'O/D · ARTICLE'로 자동 (목록 표시·검색용)
//
// ■ 저장 문서 { id, kind, title, orderId, orderNumber, fabricId, articleNo, baseYarnName, unit('kg'|'yd'), memo,
//               rows, createdAt, createdBy, updatedAt, updatedBy }
//   rows — stripe: [{ id, name, qty, yarns: [{ id, color, pct }] }] / melange: [{ id, label, qty }]
//   화면 입력 칸은 글자 그대로 들고 있다가, 저장할 때 숫자로 정리 (cleanCalcForSave)

export const CALC_KINDS = [
  { key: 'stripe', label: '스트라이프 선염', hint: '오더 컬러 → 원사 컬러별 수량·혼용율' },
  { key: 'melange', label: '멜란지 선염', hint: '멜란지별 수량 → 수량 비율' },
];
export const calcKindLabel = (kind) => CALC_KINDS.find(k => k.key === kind)?.label || '선염 계산';

export const CALC_UNITS = [
  { key: 'kg', label: 'kg' },
  { key: 'yd', label: 'YD' },
];
export const unitLabel = (unit) => (unit === 'yd' ? 'YD' : 'kg');

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
// 칸 값 → 숫자 ('1,234.5'처럼 쉼표가 있어도). 빈 칸·숫자가 아니면 null
const numOrNull = (v) => {
  if (isBlank(v)) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const toNum = (v) => numOrNull(v) ?? 0;
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const toInput = (v) => (v === null || v === undefined ? '' : String(v));

// ----------------------------------------------------------------------
// 1. 양식
// ----------------------------------------------------------------------

/** 원사 컬러 이름 비교용 — 대소문자·띄어쓰기 무시 ('Bark Brown' = 'BARK BROWN') */
export const colorKey = (name) => String(name || '').replace(/\s+/g, '').toUpperCase();

/** 컬러명을 '/'로 나눈 원사 컬러 — 'APRICOT/BARK BROWN' → ['APRICOT', 'BARK BROWN'] */
export const splitColorName = (name) => String(name || '').split('/').map(s => s.trim()).filter(Boolean);

export const makeYarnSlot = (color = '', pct = '') => ({ id: uid('y'), color, pct });

/** 스트라이프 오더 컬러 한 줄 — 컬러명에 '/'가 있으면 원사 컬러 칸을 나눠 채움 (없으면 빈 칸 2개). 컬러 이름은 대문자로 */
export const makeStripeRow = (name = '', qty = '') => {
  const upper = String(name || '').toUpperCase();
  const parts = splitColorName(upper);
  const colors = parts.length >= 2 ? parts : ['', ''];
  return { id: uid('r'), name: upper, qty, yarns: colors.map(c => makeYarnSlot(c)) };
};

export const makeMelangeRow = (label = '', qty = '') => ({ id: uid('m'), label, qty });

/** 빈 계산 (새로 계산) */
export const makeBlankCalc = (kind = 'stripe') => ({
  kind: kind === 'melange' ? 'melange' : 'stripe',
  orderId: '', orderNumber: '',          // O/D (생산 현황 오더)
  fabricId: '', articleNo: '',           // ARTICLE (원단 관리 원단)
  baseYarnName: '',                      // 선염할 원사 이름 (ARTICLE의 원사) — 결과 원사명 앞부분
  unit: kind === 'melange' ? 'yd' : 'kg',   // 대표님 예시: 스트라이프는 오더 kg, 멜란지는 YD
  memo: '',
  rows: kind === 'melange' ? [makeMelangeRow(), makeMelangeRow()] : [makeStripeRow(), makeStripeRow()],
});

/** 목록에 보일 제목 — 'O/D · ARTICLE' (둘 다 없으면 '') */
export const calcAutoTitle = (calc) =>
  [calc?.orderNumber, calc?.articleNo].map(s => String(s || '').trim()).filter(Boolean).join(' · ');

/** 오더의 원단 찾기 — 원단이 연결돼 있으면 그 원단, 아니면 오더의 Article 번호와 같은 원단 (대소문자·띄어쓰기 무시) */
export const findFabricForOrder = (order, fabrics) => {
  const list = Array.isArray(fabrics) ? fabrics : [];
  if (order?.linkedFabricId) {
    const linked = list.find(f => String(f.id) === String(order.linkedFabricId));
    if (linked) return linked;
  }
  const key = colorKey(order?.articleNo);
  return key ? list.find(f => colorKey(f?.article) === key) || null : null;
};

/**
 * 원단(ARTICLE)의 원사 목록 — [{ yarnId, name, ratio }] (혼용률이 있는 칸만, 혼용률 큰 순)
 *  이름은 원사 라이브러리 이름 (라이브러리에 없으면 엑셀 등록 때 이름)
 */
export const fabricYarnOptions = (fabric, yarnLibrary) => (Array.isArray(fabric?.yarns) ? fabric.yarns : [])
  .filter(y => y && (y.yarnId || y.tempName) && Number(y.ratio) > 0)
  .map(y => {
    const yarnId = String(y.yarnId || '').split('::')[0];
    const lib = (yarnLibrary || []).find(l => String(l.id) === yarnId);
    return { yarnId, name: String(lib?.name || y.tempName || '').trim(), ratio: Number(y.ratio) || 0 };
  })
  .filter(y => y.name)
  .sort((a, b) => b.ratio - a.ratio);

/**
 * 생산 현황 오더 → 계산 양식 (O/D·컬러명·오더 kg)
 *  fabricId·articleNo·baseYarnName: 그 오더의 원단(ARTICLE)과 원사 — 호출하는 쪽에서 찾아 넘김 (findFabricForOrder)
 */
export const calcFromOrder = (order, kind = 'stripe', { fabricId = '', articleNo = '', baseYarnName = '' } = {}) => {
  const blank = makeBlankCalc(kind);
  const colors = (order?.colors || []).filter(c => String(c?.name || '').trim() || numOrNull(c?.orderKg) !== null);
  const rows = colors.map(c => (kind === 'melange'
    ? makeMelangeRow(String(c.name || '').trim(), toInput(numOrNull(c.orderKg)))
    : makeStripeRow(String(c.name || '').trim(), toInput(numOrNull(c.orderKg)))));
  return {
    ...blank,
    orderId: String(order?.id || ''),
    orderNumber: String(order?.orderNumber || ''),
    fabricId: String(fabricId || ''),
    articleNo: String(articleNo || order?.articleNo || ''),
    baseYarnName: kind === 'stripe' ? String(baseYarnName || '') : '',
    unit: 'kg',   // 생산 오더 수량은 kg
    rows: rows.length ? rows : blank.rows,
  };
};

/** 저장된 문서(또는 예전 값)를 화면 양식으로 — 칸이 빠져 있어도 깨지지 않게 */
export const normalizeCalc = (doc) => {
  const kind = doc?.kind === 'melange' ? 'melange' : 'stripe';
  const blank = makeBlankCalc(kind);
  const rows = (Array.isArray(doc?.rows) ? doc.rows : []).map(r => (kind === 'melange'
    ? { id: r?.id || uid('m'), label: String(r?.label ?? ''), qty: toInput(r?.qty) }
    : {
      id: r?.id || uid('r'),
      name: String(r?.name ?? ''),
      qty: toInput(r?.qty),
      yarns: (Array.isArray(r?.yarns) && r.yarns.length ? r.yarns : [{}, {}])
        .map(y => ({ id: y?.id || uid('y'), color: String(y?.color ?? ''), pct: toInput(y?.pct) })),
    }));
  return {
    ...blank,
    ...(doc?.id ? { id: doc.id } : {}),
    orderId: String(doc?.orderId ?? ''),
    orderNumber: String(doc?.orderNumber ?? ''),
    fabricId: String(doc?.fabricId ?? ''),
    articleNo: String(doc?.articleNo ?? ''),
    baseYarnName: String(doc?.baseYarnName ?? ''),
    unit: doc?.unit === 'yd' ? 'yd' : (doc?.unit === 'kg' ? 'kg' : blank.unit),
    memo: String(doc?.memo ?? ''),
    rows: rows.length ? rows : blank.rows,
    ...(doc?.createdAt ? { createdAt: doc.createdAt } : {}),
    ...(doc?.createdBy ? { createdBy: doc.createdBy } : {}),
    ...(doc?.updatedAt ? { updatedAt: doc.updatedAt } : {}),
    ...(doc?.updatedBy ? { updatedBy: doc.updatedBy } : {}),
  };
};

// 아무것도 안 넣은 줄인지 (저장할 때 뺌)
const isEmptyStripeRow = (r) => isBlank(r?.name) && isBlank(r?.qty) && (r?.yarns || []).every(y => isBlank(y?.color) && isBlank(y?.pct));
const isEmptyMelangeRow = (r) => isBlank(r?.label) && isBlank(r?.qty);

/** 저장할 모양 — 글자 정리·숫자로 바꾸기·빈 줄 빼기 (id·작성 정보는 저장하는 쪽에서 붙임) */
export const cleanCalcForSave = (calc) => {
  const kind = calc?.kind === 'melange' ? 'melange' : 'stripe';
  const rows = kind === 'melange'
    ? (calc?.rows || []).filter(r => !isEmptyMelangeRow(r)).map(r => ({
      id: r.id, label: String(r.label || '').trim(), qty: numOrNull(r.qty),
    }))
    : (calc?.rows || []).filter(r => !isEmptyStripeRow(r)).map(r => ({
      id: r.id,
      name: String(r.name || '').trim(),
      qty: numOrNull(r.qty),
      yarns: (r.yarns || []).filter(y => !(isBlank(y?.color) && isBlank(y?.pct)))
        .map(y => ({ id: y.id, color: String(y.color || '').trim(), pct: numOrNull(y.pct) })),
    }));
  return {
    kind,
    orderId: String(calc?.orderId || ''),
    orderNumber: String(calc?.orderNumber || '').trim(),
    fabricId: String(calc?.fabricId || ''),
    articleNo: String(calc?.articleNo || '').trim(),
    baseYarnName: kind === 'stripe' ? String(calc?.baseYarnName || '').trim() : '',
    unit: calc?.unit === 'yd' ? 'yd' : 'kg',
    memo: String(calc?.memo || '').trim(),
    rows,
  };
};

/** 넣은 값이 하나라도 있는지 (오더를 불러올 때 지금 줄을 바꿀지 물어볼지) */
export const calcHasData = (calc) => {
  const c = cleanCalcForSave(calc);
  return !!(c.memo || c.baseYarnName || c.orderId || c.fabricId || c.rows.length);
};

// ----------------------------------------------------------------------
// 2. 계산
// ----------------------------------------------------------------------

/** 스트라이프 한 줄의 원사 비율 합계 (%) — 소수 첫째 자리 */
export const stripeRowPctSum = (row) => round1((row?.yarns || []).reduce((s, y) => s + toNum(y?.pct), 0));

/** 원사 비율 칸이 하나만 비었을 때 그 칸에 들어가면 100%가 되는 값 (칸 안내용) — 없으면 '' */
export const stripeRemainderHint = (row, yarnId) => {
  const yarns = row?.yarns || [];
  const blanks = yarns.filter(y => isBlank(y?.pct));
  if (blanks.length !== 1 || blanks[0].id !== yarnId) return '';
  const rest = round1(100 - stripeRowPctSum(row));
  return rest > 0 ? String(rest) : '';
};

/**
 * 스트라이프 선염 결과 — 원사 컬러별 (같은 이름은 합침, 처음 나온 순서)
 * @returns {{
 *   lines: [{ key, color, yarnName, qty, pct, sources: [{ rowId, rowName, qty, pct }] }],
 *   orderTotal: 오더 컬러 수량 합계, yarnTotal: 원사로 나눈 수량 합계,
 *   issues: [{ rowId, text }] — 원사 비율 합계 ≠ 100% · 원사 컬러 이름이 빈 칸 · 수량 없음
 * }}
 */
export const computeStripe = (calc) => {
  const lines = [];
  const byKey = new Map();
  const issues = [];
  const base = String(calc?.baseYarnName || '').trim();
  let orderTotal = 0;
  (calc?.rows || []).forEach((row, idx) => {
    if (isEmptyStripeRow(row)) return;
    const name = String(row.name || '').trim() || `${idx + 1}번째 줄`;
    const qty = toNum(row.qty);
    const hasYarn = (row.yarns || []).some(y => toNum(y?.pct) > 0);
    if (!(qty > 0)) {
      if (hasYarn || !isBlank(row.name)) issues.push({ rowId: row.id, text: `${name} — 수량이 비어 있어요` });
      return;
    }
    orderTotal += qty;
    const sum = stripeRowPctSum(row);
    // 비율을 하나도 안 넣은 줄은 아직 입력 전 — 알리지 않음 (결과에서 빠지고, 합계 줄에 '오더 합계와 달라요'로 보임)
    if (sum > 0 && Math.abs(sum - 100) > 0.05) issues.push({ rowId: row.id, text: `${name} — 원사 비율 합계 ${sum}% (100%가 되어야 정확해요)` });
    (row.yarns || []).forEach(y => {
      const pct = toNum(y?.pct);
      if (!(pct > 0)) return;
      const color = String(y.color || '').trim();
      if (!color) { issues.push({ rowId: row.id, text: `${name} — 원사 컬러 이름이 빈 칸이 있어요 (비율 ${pct}%)` }); return; }
      const amount = qty * pct / 100;
      const key = colorKey(color);
      let line = byKey.get(key);
      if (!line) {
        line = { key, color, qty: 0, sources: [] };
        byKey.set(key, line);
        lines.push(line);
      }
      line.qty += amount;
      line.sources.push({ rowId: row.id, rowName: name, qty: amount, pct });
    });
  });
  const yarnTotal = lines.reduce((s, l) => s + l.qty, 0);
  lines.forEach(l => {
    l.pct = yarnTotal > 0 ? (l.qty / yarnTotal) * 100 : 0;
    l.yarnName = [base, l.color].filter(Boolean).join(' ');
  });
  return { lines, orderTotal, yarnTotal, issues };
};

/**
 * 멜란지 선염 결과 — 줄마다 수량 비율 (대표님 지정: 비율 = 수량 비율)
 * @returns {{ lines: [{ id, label, qty, pct }], total }}
 */
export const computeMelange = (calc) => {
  const lines = (calc?.rows || [])
    .filter(r => toNum(r?.qty) > 0)
    .map(r => ({ id: r.id, label: String(r.label || '').trim(), qty: toNum(r.qty) }));
  const total = lines.reduce((s, l) => s + l.qty, 0);
  lines.forEach(l => { l.pct = total > 0 ? (l.qty / total) * 100 : 0; });
  return { lines, total };
};

/** 보기 좋은 숫자 — 소수 첫째 자리까지 (예: 1,234.5) */
export const fmt1 = (v) => (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 비율 — 소수 첫째 자리 % (예: 21.9%) */
export const fmtPct = (v) => `${(Number(v) || 0).toFixed(1)}%`;

/** [결과 복사] — 엑셀·다른 프로그램에 붙여 넣는 탭 구분 글자 */
export const buildCalcCopyText = (calc) => {
  const unit = unitLabel(calc?.unit);
  if (calc?.kind === 'melange') {
    const { lines, total } = computeMelange(calc);
    return [
      ['멜란지', `수량(${unit})`, '비율(%)'],
      ...lines.map(l => [l.label, round1(l.qty), round1(l.pct)]),
      ['합계', round1(total), lines.length ? 100 : 0],
    ].map(r => r.join('\t')).join('\n');
  }
  const { lines, yarnTotal } = computeStripe(calc);
  return [
    ['원사명', '혼용율(%)', `수량(${unit})`],
    ...lines.map(l => [l.yarnName, round1(l.pct), round1(l.qty)]),
    ['합계', lines.length ? 100 : 0, round1(yarnTotal)],
  ].map(r => r.join('\t')).join('\n');
};
