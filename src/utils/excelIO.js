// GRUBIG ERP - 엑셀 업로드 공통 (원단·원사 일괄 등록)
//
// ■ 칸 값을 두 가지로 읽음 — 실제 값(raw) + 화면에 보이는 글자(text)
//   · 숫자 칸은 실제 값 우선 (서식 때문에 4.25가 '4'로 보여도 4.25)
//   · 퍼센트 칸은 보이는 글자에 %가 있으면 글자로 읽음
//     (엑셀 % 서식 칸은 실제 값이 0.08 → 그대로 읽으면 8%가 0.08%가 됨)
// ■ 글자로 적은 숫자도 읽음: '18,000' · '₩8,800' · '320g' · '8%'

/**
 * 첫 시트를 행 목록으로 — [{ raw, text }] (머리줄 = 열 이름, 빈 행 제외)
 * @param {Object} XLSX SheetJS (window.XLSX)
 * @param {string} binary FileReader.readAsBinaryString 결과
 */
export const readFirstSheetRows = (XLSX, binary) => {
  const wb = XLSX.read(binary, { type: 'binary' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const textRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const textByRowNum = new Map(textRows.map(r => [r.__rowNum__, r]));
  return rawRows.map(r => ({ raw: r, text: textByRowNum.get(r.__rowNum__) || r }));
};

/** 빈 칸인지 (공백만 있어도 빈 칸) */
export const isBlankCell = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * 숫자 칸 — 못 읽으면 null.
 * 숫자는 그대로, 글자는 쉼표·공백·앞쪽 통화기호를 떼고 앞쪽 숫자만 ('320g' → 320, '₩8,800' → 8800, '8%' → 8)
 */
export const parseNumCell = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (isBlankCell(v)) return null;
  const s = String(v).replace(/[,\s]/g, '').replace(/^[₩￦$＄]/, '');
  const m = s.match(/^[-+]?(\d+(\.\d*)?|\.\d+)/);
  return m ? Number(m[0]) : null;
};

/** 퍼센트 칸 — 보이는 글자에 %가 있으면 그 숫자(8% → 8), 아니면 숫자 칸처럼 */
export const parsePercentCell = (rawValue, textValue) => (
  typeof textValue === 'string' && textValue.includes('%') ? parseNumCell(textValue) : parseNumCell(rawValue)
);

/** 예/아니오 칸 — Y·YES·TRUE·O·V·1·예·수입 (엑셀 체크값 TRUE 포함) */
const YES_WORDS = ['Y', 'YES', 'TRUE', 'O', 'V', '1', '예', '수입', '✓', '✔'];
export const parseYesCell = (v) => {
  if (v === true) return true;
  if (typeof v === 'number') return v === 1;
  return YES_WORDS.includes(String(v ?? '').trim().toUpperCase());
};

/** '아니오' 칸 — N·NO·FALSE·X·0·아니오·국내. 빈 칸은 '아니오'가 아님 (빈 칸 = 그대로 둠) */
const NO_WORDS = ['N', 'NO', 'FALSE', 'X', '0', '아니오', '국내'];
export const parseNoCell = (v) => {
  if (v === false) return true;
  if (typeof v === 'number') return v === 0;
  return NO_WORDS.includes(String(v ?? '').trim().toUpperCase());
};

/** 통화 칸 — 'KRW' / 'USD' 로 맞춤. 비었으면 'KRW', 모르는 값이면 null */
export const parseCurrencyCell = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s || ['KRW', '₩', '￦', 'WON', '원'].includes(s)) return 'KRW';
  if (['USD', '$', '＄', 'US$', 'DOLLAR', '달러'].includes(s)) return 'USD';
  return null;
};
