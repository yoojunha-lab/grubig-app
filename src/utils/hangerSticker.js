import { calculateGYd, compareArticle } from './helpers';

// ============================================================
// GRUBIG ERP - 헹거 스티커 (기타 ▾ 헹거 스티커) — 칸 계산 · 저장 모양 (대표님 요청 2026-10-14)
//  · 양식 = 대표님 TAG.xlsx 첫 시트 (스티커 1장 = 시트 1장). 엑셀 만들기는 utils/hangerStickerExcel.js
//  · 아이템(원단 관리)에서: ART(고칠 수 있음) · WIDTH · WEIGHT(고칠 수 없음 — 2차 요청)
//    WIDTH·WEIGHT는 화면·엑셀 모두 '지금 아이템 값'으로 (stickerSpecOf). 아이템이 지워졌으면 마지막 저장 값
//  · 고르는 칸: CATEGORY(예전 '제목' — PERFORMANCE WOOL · WOOL CASUAL …) · CARE(체크, 여러 개) — 목록은 [⚙ 설정]
//    (settings/general.hangerStickerOptions — resolveStickerOptions)
//  · 직접 넣는 칸: CONTENT · TYPE · QR · 아래 설명
//  · QR = EZ-TEX 주소 (https://eztexerp.com/erp/qr/번호). 번호는 EZ-TEX 안에서 정한 번호라 ART로 알 수 없음
//    (ART를 넣은 주소는 EZ-TEX 로그인 화면으로 감 — 2026-10-14 확인)
//    → QR 그림을 올리면 주소를 읽어 저장 (utils/hangerStickerQr.js), 번호만 넣어도 주소로 바꿈
// ============================================================

const EZTEX_QR_BASE = 'https://eztexerp.com/erp/qr/';

/** CATEGORY 기본 목록 (설정을 아직 저장하기 전) — 첫 번째가 새 스티커 기본값 */
const STICKER_DEFAULT_CATEGORIES = ['PERFORMANCE WOOL', 'WOOL CASUAL'];
/** CARE 기본 목록 (대표님 지정 2026-10-14) — 이 순서대로 엑셀 CARE 칸에 한 줄에 하나씩 */
const STICKER_DEFAULT_CARE_ITEMS = ['MACHINE WASHABLE', 'DRY CLEAN', 'HAND WASH', 'TUMBLE DRY'];
/** 새 스티커에 미리 체크해 두는 CARE (기존 16장 모두 기계 세탁) */
const STICKER_DEFAULT_CARE = 'MACHINE WASHABLE';
/** 엑셀 CARE 칸(E13:F13)에 들어가는 줄 수 — 넘으면 잘림 */
export const STICKER_CARE_MAX_LINES = 2;
// 예전 CARE 글자 → 지금 항목 (TAG.xlsx 'WASHING MACHINE')
const CARE_ALIASES = { 'WASHING MACHINE': 'MACHINE WASHABLE' };

/** TYPE 추천 (대표님 TAG.xlsx 16장에 쓰인 값) — 입력 칸 목록에 저장된 스티커 값과 같이 보임 */
export const STICKER_TYPE_SUGGESTIONS = [
  'SINGLE', 'SINGLE SPAN', 'SINGLE P/Q', '2:2 SINGLE', 'P/Q', 'BACK MESH',
  'WAFFLE', 'GREED', 'GREED FLEECE', 'SIRU FLEECE', 'PUNTO',
];

const oneLine = (v) => String(v ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();
const multiLine = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
// 대문자 · 앞뒤 띄어쓰기 정리 · 빈 값 빼기 · 같은 값 한 번만 (순서 유지)
const uniqueUpper = (list) => [...new Set((Array.isArray(list) ? list : [])
  .map(v => oneLine(v).replace(/\s+/g, ' ').toUpperCase())
  .filter(Boolean))];

/**
 * 헹거 스티커 설정 (settings/general.hangerStickerOptions) → 항상 완전한 모양
 *  저장 전(목록이 없음)이면 기본 목록. 저장된 목록은 그대로 (설정 창에서 마지막 하나는 못 지움)
 */
export const resolveStickerOptions = (raw) => ({
  categories: Array.isArray(raw?.categories) ? uniqueUpper(raw.categories) : [...STICKER_DEFAULT_CATEGORIES],
  careItems: Array.isArray(raw?.careItems) ? uniqueUpper(raw.careItems) : [...STICKER_DEFAULT_CARE_ITEMS],
});

/** CARE 값 → 항목 목록 (예전 글자 한 칸 'WASHING MACHINE'·줄바꿈·' / '·쉼표로 이은 글자도 읽음) */
export const normalizeCare = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n|\s\/\s|,/);
  return uniqueUpper(list.map(v => {
    const key = oneLine(v).replace(/\s+/g, ' ').toUpperCase();
    return CARE_ALIASES[key] || key;
  }));
};

/** 체크한 CARE를 설정 목록 순서로 (목록에 없는 예전 값은 뒤에) */
export const orderCare = (care, careItems = []) => {
  const picked = normalizeCare(care);
  return [...careItems.filter(c => picked.includes(c)), ...picked.filter(c => !careItems.includes(c))];
};

/** 새 스티커 (빈 양식) — CATEGORY는 설정 첫 번째, CARE는 MACHINE WASHABLE 체크 (목록에 있으면) */
export const makeBlankSticker = (options = resolveStickerOptions(null)) => ({
  fabricId: '',
  art: '',
  title: options.categories[0] || '',
  content: '',
  type: '',
  width: '',
  weight: '',
  care: options.careItems.includes(STICKER_DEFAULT_CARE) ? [STICKER_DEFAULT_CARE] : [],
  qr: '',
  note: '',
});

const posNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmt1 = (n) => n.toFixed(1);

/** WIDTH — '내폭/외폭' 소수 한 자리 (예: 52.0/54.0). 하나만 있으면 그 값만 */
const stickerWidthOf = (fabric) => {
  const cut = posNum(fabric?.widthCut);
  const full = posNum(fabric?.widthFull);
  if (cut && full) return `${fmt1(cut)}/${fmt1(full)}`;
  if (full) return fmt1(full);
  if (cut) return fmt1(cut);
  return '';
};

/**
 * 스티커 g/yd — 원단 관리의 '실제 G/YD' 그대로 (gsm × 외폭, 원가 계산과 같은 식 · 정수)
 *  대표님 결정 2026-10-14: 5 단위로 내리지 않음 / 생산 G/YD(원가용 직접 입력)는 쓰지 않음
 */
const stickerGYdOf = (fabric) => {
  const gsm = posNum(fabric?.gsm);
  const full = posNum(fabric?.widthFull);
  if (!gsm || !full) return 0;
  return calculateGYd(gsm, full);
};

/** WEIGHT — '150 g/㎡ 188 g/yd' (외폭이 없으면 g/㎡만) */
const stickerWeightOf = (fabric) => {
  const gsm = posNum(fabric?.gsm);
  if (!gsm) return '';
  const gsmText = Number.isInteger(gsm) ? String(gsm) : String(Math.round(gsm * 10) / 10);
  const gYd = stickerGYdOf(fabric);
  return gYd ? `${gsmText} g/㎡ ${gYd} g/yd` : `${gsmText} g/㎡`;
};

/** 아이템(원단 관리)을 고를 때 채우는 칸 — 아이템 연결 · ART · (저장해 둘) WIDTH · WEIGHT */
export const stickerFieldsFromFabric = (fabric) => ({
  fabricId: fabric ? String(fabric.id) : '',
  art: String(fabric?.article || '').trim().toUpperCase(),
  width: stickerWidthOf(fabric),
  weight: stickerWeightOf(fabric),
});

/**
 * 화면·엑셀에 쓰는 WIDTH·WEIGHT — 아이템이 있으면 지금 아이템 값 (고칠 수 없음, 원단 관리에서 바꾸면 따라감)
 *  아이템이 없으면(지워짐 · 예전 스티커) 마지막으로 저장한 값
 * @returns {{ width, weight, fromItem: boolean }}
 */
export const stickerSpecOf = (sticker, fabric) => (fabric
  ? { width: stickerWidthOf(fabric), weight: stickerWeightOf(fabric), fromItem: true }
  : { width: String(sticker?.width || ''), weight: String(sticker?.weight || ''), fromItem: false });

/** ART가 아이템 Article과 다른지 (고칠 수 있는 칸이라 알려만 줌) */
export const stickerArtDiffers = (sticker, fabric) => !!fabric
  && String(fabric.article || '').trim().toUpperCase() !== String(sticker?.art || '').trim().toUpperCase();

/**
 * 엑셀 칸에 들어갈 글자 8개 — 미리보기 · 엑셀 공통
 *  WIDTH·WEIGHT는 stickerSpecOf, CARE는 한 줄에 하나씩 (설정 목록 순서는 저장할 때 맞춰 둠)
 */
export const stickerCellValues = (sticker, fabric) => {
  const s = sticker || {};
  const spec = stickerSpecOf(s, fabric);
  return {
    art: String(s.art || ''),
    title: String(s.title || ''),
    content: String(s.content || ''),
    type: String(s.type || ''),
    width: spec.width,
    weight: spec.weight,
    care: normalizeCare(s.care).join('\n'),
    qr: String(s.qr || ''),
    note: String(s.note || ''),
  };
};

/** 아이템 원사 혼용률 (CONTENT 칸 아래 참고용) — 예: 'MERINO 2/48 87% · NYLON 20D 13%' */
export const fabricYarnHint = (fabric, yarnLibrary = []) => (fabric?.yarns || [])
  .filter(y => y?.yarnId && Number(y.ratio) > 0)
  .map(y => {
    const realId = String(y.yarnId).split('::')[0];
    const yarn = (yarnLibrary || []).find(yl => String(yl.id) === realId);
    return `${yarn?.name || y.tempName || '미등록 원사'} ${y.ratio}%`;
  })
  .join(' · ');

/** QR 칸 — EZ-TEX 번호만 넣으면 주소로 (5542 → https://eztexerp.com/erp/qr/5542). 주소·다른 글자는 그대로 */
export const normalizeQrInput = (raw) => {
  const v = String(raw ?? '').trim();
  if (/^\d+$/.test(v)) return `${EZTEX_QR_BASE}${v}`;
  return v;
};

/** EZ-TEX QR 주소의 번호 (https://eztexerp.com/erp/qr/5542 → '5542'). EZ-TEX 주소가 아니면 '' */
export const eztexQrNumber = (qr) =>
  (String(qr ?? '').trim().match(/^https?:\/\/(?:www\.)?eztexerp\.com\/erp\/qr\/(\d+)\/?$/i) || [])[1] || '';

/** 목록에 보일 짧은 QR 이름 — EZ-TEX 주소면 번호만 (예: 5542), 아니면 글자 그대로 */
export const qrShortLabel = (qr) => eztexQrNumber(qr) || String(qr ?? '').trim();

/**
 * 저장할 모양 — 칸마다 앞뒤 띄어쓰기 정리 (아래 설명만 줄바꿈 허용). ART는 대문자
 *  CARE는 항목 목록(배열) — careItems(설정 목록)를 주면 그 순서로
 */
export const cleanStickerForSave = (s, careItems = null) => ({
  fabricId: String(s?.fabricId || ''),
  art: oneLine(s?.art).toUpperCase(),
  title: oneLine(s?.title),
  content: oneLine(s?.content),
  type: oneLine(s?.type),
  width: oneLine(s?.width),
  weight: oneLine(s?.weight),
  care: careItems ? orderCare(s?.care, careItems) : normalizeCare(s?.care),
  qr: normalizeQrInput(oneLine(s?.qr)),
  note: multiLine(s?.note),
});

/** 저장된 스티커를 입력 창에 (저장 안 된 칸은 새 스티커 값 · 예전 CARE 글자는 항목으로) */
export const normalizeSticker = (doc, options = resolveStickerOptions(null)) =>
  cleanStickerForSave({ ...makeBlankSticker(options), ...(doc || {}) }, options.careItems);

/** ART 순서 (PW1001 · PW1001A · PW1006 … — 원단 목록과 같은 규칙 helpers.compareArticle) */
export const sortStickers = (list = []) => [...list].sort((a, b) =>
  compareArticle(a.art, b.art)
  || String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));

/** 검색 — ART · CATEGORY · CONTENT · TYPE · CARE · QR 번호 · 아래 설명 */
export const stickerMatches = (s, term) => {
  const t = String(term || '').trim().toUpperCase();
  if (!t) return true;
  return [s.art, s.title, s.content, s.type, normalizeCare(s.care).join(' '), qrShortLabel(s.qr), s.note]
    .some(v => String(v || '').toUpperCase().includes(t));
};
