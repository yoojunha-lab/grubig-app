import { calculateGYd } from './helpers';

// ============================================================
// GRUBIG ERP - 헹거 스티커 (기타 ▾ 헹거 스티커) — 칸 계산 · 저장 모양 (대표님 요청 2026-10-14)
//  · 양식 = 대표님 TAG.xlsx 첫 시트 (스티커 1장 = 시트 1장). 엑셀 만들기는 utils/hangerStickerExcel.js
//  · 아이템(원단 관리)에서 가져오는 칸: ART · WIDTH · WEIGHT — 가져온 뒤에도 고칠 수 있음
//  · 직접 넣는 칸: 제목(큰 글자, 기본 PERFORMANCE WOOL) · CONTENT · TYPE · CARE(기본 WASHING MACHINE) · QR · 아래 설명
//  · QR = EZ-TEX 주소 (https://eztexerp.com/erp/qr/번호). 번호는 EZ-TEX 안에서 정한 번호라 ART로 알 수 없음
//    (ART를 넣은 주소는 EZ-TEX 로그인 화면으로 감 — 2026-10-14 확인)
//    → QR 그림을 올리면 주소를 읽어 저장 (utils/hangerStickerQr.js), 번호만 넣어도 주소로 바꿈
// ============================================================

export const STICKER_DEFAULT_TITLE = 'PERFORMANCE WOOL';
export const STICKER_DEFAULT_CARE = 'WASHING MACHINE';
export const EZTEX_QR_BASE = 'https://eztexerp.com/erp/qr/';

/** TYPE 추천 (대표님 TAG.xlsx 16장에 쓰인 값) — 입력 칸 목록에 저장된 스티커 값과 같이 보임 */
export const STICKER_TYPE_SUGGESTIONS = [
  'SINGLE', 'SINGLE SPAN', 'SINGLE P/Q', '2:2 SINGLE', 'P/Q', 'BACK MESH',
  'WAFFLE', 'GREED', 'GREED FLEECE', 'SIRU FLEECE', 'PUNTO',
];

/** 새 스티커 (빈 양식) — 제목·CARE는 기존 16장과 같은 값으로 채워 둠 */
export const makeBlankSticker = () => ({
  fabricId: '',
  art: '',
  title: STICKER_DEFAULT_TITLE,
  content: '',
  type: '',
  width: '',
  weight: '',
  care: STICKER_DEFAULT_CARE,
  qr: '',
  note: '',
});

const posNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmt1 = (n) => n.toFixed(1);

/** WIDTH — '내폭/외폭' 소수 한 자리 (예: 52.0/54.0). 하나만 있으면 그 값만 */
export const stickerWidthOf = (fabric) => {
  const cut = posNum(fabric?.widthCut);
  const full = posNum(fabric?.widthFull);
  if (cut && full) return `${fmt1(cut)}/${fmt1(full)}`;
  if (full) return fmt1(full);
  if (cut) return fmt1(cut);
  return '';
};

/** 스티커 g/yd — 원가 계산과 같은 식(gsm × 외폭)을 5 단위로 내림 (기존 16장 모두 이렇게: 238 → 235) */
export const stickerGYdOf = (fabric) => {
  const gsm = posNum(fabric?.gsm);
  const full = posNum(fabric?.widthFull);
  if (!gsm || !full) return 0;
  return Math.floor(calculateGYd(gsm, full) / 5) * 5;
};

/** WEIGHT — '150 g/㎡ 195 g/yd' (외폭이 없으면 g/㎡만) */
export const stickerWeightOf = (fabric) => {
  const gsm = posNum(fabric?.gsm);
  if (!gsm) return '';
  const gsmText = Number.isInteger(gsm) ? String(gsm) : String(Math.round(gsm * 10) / 10);
  const gYd = stickerGYdOf(fabric);
  return gYd ? `${gsmText} g/㎡ ${gYd} g/yd` : `${gsmText} g/㎡`;
};

/** 아이템(원단 관리)에서 가져오는 칸 — 아이템 연결 · ART · WIDTH · WEIGHT */
export const stickerFieldsFromFabric = (fabric) => ({
  fabricId: fabric ? String(fabric.id) : '',
  art: String(fabric?.article || '').trim().toUpperCase(),
  width: stickerWidthOf(fabric),
  weight: stickerWeightOf(fabric),
});

// 비교용 — 앞뒤·여러 칸 띄어쓰기 · 대소문자 무시
const sameText = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim().toUpperCase() === String(b ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

const FABRIC_FIELDS = [['art', 'ART'], ['width', 'WIDTH'], ['weight', 'WEIGHT']];

/**
 * 아이템 정보와 다른 칸 — 아이템의 폭·중량이 나중에 바뀌었을 때 알려 주기
 *  아이템 쪽 값이 비어 있는 칸(예: gsm 없음)은 비교하지 않음
 * @returns {Array<{ key, label, sticker, item }>}
 */
export const stickerFabricDiffs = (sticker, fabric) => {
  if (!sticker || !fabric) return [];
  const from = stickerFieldsFromFabric(fabric);
  return FABRIC_FIELDS
    .filter(([key]) => from[key] && !sameText(sticker[key], from[key]))
    .map(([key, label]) => ({ key, label, sticker: String(sticker[key] || ''), item: from[key] }));
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

const oneLine = (v) => String(v ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();
const multiLine = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();

/** 저장할 모양 — 칸마다 앞뒤 띄어쓰기 정리 (아래 설명만 줄바꿈 허용). ART는 대문자 */
export const cleanStickerForSave = (s) => ({
  fabricId: String(s?.fabricId || ''),
  art: oneLine(s?.art).toUpperCase(),
  title: oneLine(s?.title),
  content: oneLine(s?.content),
  type: oneLine(s?.type),
  width: oneLine(s?.width),
  weight: oneLine(s?.weight),
  care: oneLine(s?.care),
  qr: normalizeQrInput(oneLine(s?.qr)),
  note: multiLine(s?.note),
});

/** 저장된 스티커를 입력 창에 (저장 안 된 칸은 새 스티커 값) */
export const normalizeSticker = (doc) => cleanStickerForSave({ ...makeBlankSticker(), ...(doc || {}) });

/** ART 순서 (PW1001 · PW1001A · PW1006 …) */
export const sortStickers = (list = []) => [...list].sort((a, b) =>
  String(a.art || '').localeCompare(String(b.art || ''), undefined, { numeric: true })
  || String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));

/** 검색 — ART · 제목 · CONTENT · TYPE · QR 번호 · 아래 설명 */
export const stickerMatches = (s, term) => {
  const t = String(term || '').trim().toUpperCase();
  if (!t) return true;
  return [s.art, s.title, s.content, s.type, s.care, qrShortLabel(s.qr), s.note]
    .some(v => String(v || '').toUpperCase().includes(t));
};
