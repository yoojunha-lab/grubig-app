import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { makeQrMatrix, qrSvgPath } from '../../utils/hangerStickerQr';

// ============================================================
// 헹거 스티커 미리보기 — 엑셀 양식(TAG.xlsx 첫 시트, 인쇄 영역 D2:F18)의 칸 크기·글자 크기를 그대로 줄여 그림 (2026-10-14)
//  · 칸 너비·줄 높이(pt)는 엑셀에서 잰 값: C 20.25 · D 54 · E 63.75 · F 72.75 · G 11.25 / 줄은 양식 그대로 (17.1 → 엑셀 17)
//  · 글자: ART. 14pt 굵게 · ART 값 12pt 굵게 · CATEGORY 18pt 굵게 · 이름표 10pt 굵게 · 값 10pt · 아래 설명 7.5pt
//  · '셀에 맞춤'(ART·TYPE·WIDTH·WEIGHT 값)은 글자를 줄이고, '자동 줄 바꿈'(CONTENT·CARE·아래 설명)은 줄을 바꿈
//  · CATEGORY는 한 줄 — 'PERFORMANCE WOOL'도 D~F보다 넓어서 엑셀에서 양옆 빈 칸(C·G열)까지 넘쳐 찍힘 (2026-10-14 엑셀 PDF로 확인)
//    → 미리보기도 C~G 너비로 그리고, 'PERFORMANCE WOOL'보다 길면 '잘릴 수 있어요'
//  · 엑셀(윈도 글꼴 그리기)은 브라우저보다 글자를 조금 넓게 그림 (10pt에서 글자당 약 0.27pt) → 값 칸에 글자 간격을 조금 줌
//  · 칸보다 글이 길면(엑셀에서 잘릴 수 있음) 빨간 점선 — 브라우저로 그려서 엑셀과 조금 다를 수 있음
//  · QR 자리: 회색 자리(62.4pt) 위에 QR 그림(60pt) — 엑셀에 넣는 QR 그림과 같은 둘레 여백 2칸
// ============================================================

const COLS_PT = [20.25, 54, 63.75, 72.75, 11.25]; // C · D · E · F · G
const ROWS_PT = [16.5, 16.5, 16.5, 16.5, 9.75, 17.25, 18, 24, 17, 17, 17, 26.25, 17, 16.5, 5.25, 16.5, 18]; // 2~18행
const PAD_PT = 1.5;           // 칸 안 좌우 여백
const VALUE_SPACING = '0.027em'; // 엑셀처럼 조금 넓게
const FONT = "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const QR_BOX = { left: 5.25, top: 4.5, size: 62.4 }; // F열 왼쪽·2행 위에서
const QR_PIC = { left: 6.75, top: 4.5, size: 60 };
const QR_MARGIN = 2;
const TITLE_REFERENCE = 'PERFORMANCE WOOL'; // 엑셀에서 양옆 빈 칸까지 꽉 차게 찍히는 길이 — 이보다 길면 잘림

// col·row = 그리드 선 번호 [시작, 끝) — 열은 C가 1번(D=2 · E=3 · F=4 · G=5), 행은 2행이 1번
const CELLS = [
  { key: 'artLabel', text: 'ART.', col: [2, 3], row: [2, 4], pt: 14, bold: true },
  { key: 'art', field: 'art', col: [3, 4], row: [2, 4], pt: 12, bold: true, fit: 'shrink' },
  { key: 'title', field: 'title', col: [1, 6], row: [5, 7], pt: 18, bold: true, fit: 'title' },
  { key: 'contentLabel', text: 'CONTENT', col: [2, 3], row: [7, 9], pt: 10, bold: true },
  { key: 'content', field: 'content', col: [3, 5], row: [7, 9], pt: 10, fit: 'wrap' },
  { key: 'typeLabel', text: 'TYPE', col: [2, 3], row: [9, 10], pt: 10, bold: true },
  { key: 'type', field: 'type', col: [3, 5], row: [9, 10], pt: 10, fit: 'shrink' },
  { key: 'widthLabel', text: 'WIDTH', col: [2, 3], row: [10, 11], pt: 10, bold: true },
  { key: 'width', field: 'width', col: [3, 5], row: [10, 11], pt: 10, fit: 'shrink' },
  { key: 'weightLabel', text: 'WEIGHT', col: [2, 3], row: [11, 12], pt: 10, bold: true },
  { key: 'weight', field: 'weight', col: [3, 5], row: [11, 12], pt: 10, fit: 'shrink' },
  { key: 'careLabel', text: 'CARE', col: [2, 3], row: [12, 13], pt: 10, bold: true },
  { key: 'care', field: 'care', col: [3, 5], row: [12, 13], pt: 10, fit: 'wrap' },
  { key: 'note', field: 'note', col: [2, 5], row: [13, 18], pt: 7.5, fit: 'wrap' },
];

// values = 엑셀 칸에 들어갈 글자 (utils/hangerSticker.stickerCellValues — WIDTH·WEIGHT는 아이템 값, CARE는 한 줄에 하나씩)
export const StickerPreview = ({ values, scale = 1.4 }) => {
  const s = values || {};
  const qrText = String(s.qr || '').trim();
  const matrix = useMemo(() => makeQrMatrix(qrText), [qrText]);
  const qrPath = useMemo(() => qrSvgPath(matrix, QR_MARGIN), [matrix]);
  const qrSize = matrix ? matrix.length + QR_MARGIN * 2 : 0;
  const cellRefs = useRef({});
  const titleRefRef = useRef(null); // 'PERFORMANCE WOOL' 기준 글자 (안 보임)
  const warnRef = useRef(null);
  const px = (pt) => pt * scale;

  // 글자 맞추기 · 넘침 표시 (그린 뒤 크기를 재서 바로 고침 — 화면에 그리기 전이라 깜빡이지 않음)
  useLayoutEffect(() => {
    let overflow = false;
    CELLS.forEach(cell => {
      const el = cellRefs.current[cell.key];
      const inner = el?.firstElementChild;
      if (!cell.field || !el || !inner) return;
      const base = cell.pt * scale;
      inner.style.fontSize = `${base}px`;
      el.style.outline = '';
      let over = false;
      if (cell.fit === 'shrink') {
        const avail = el.clientWidth - PAD_PT * scale * 2;
        const need = inner.offsetWidth;
        if (need > avail && avail > 0) inner.style.fontSize = `${Math.max(base * 0.25, (base * avail) / need)}px`;
      } else if (cell.fit === 'title') {
        const limit = titleRefRef.current?.offsetWidth || el.clientWidth;
        over = inner.offsetWidth > limit * 1.01;
      } else {
        over = inner.offsetHeight > el.clientHeight + 1;
      }
      if (over) {
        el.style.outline = '1.5px dashed #ef4444';
        el.style.outlineOffset = '-1.5px';
        overflow = true;
      }
    });
    if (warnRef.current) warnRef.current.hidden = !overflow;
  });

  const totalW = COLS_PT.reduce((a, b) => a + b, 0);
  const totalH = ROWS_PT.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative bg-white shadow-md ring-1 ring-slate-300 text-black select-none"
        style={{
          width: px(totalW),
          height: px(totalH),
          display: 'grid',
          gridTemplateColumns: COLS_PT.map(w => `${px(w)}px`).join(' '),
          gridTemplateRows: ROWS_PT.map(h => `${px(h)}px`).join(' '),
          fontFamily: FONT,
          letterSpacing: 0,
        }}
      >
        {/* QR 자리 (F2:F5) — 회색 자리가 5행 아래로 조금 넘침 (양식 그대로) */}
        <div className="relative" style={{ gridColumn: '4 / 5', gridRow: '1 / 5' }}>
          {matrix ? (
            <>
              <div className="absolute" style={{ left: px(QR_BOX.left), top: px(QR_BOX.top), width: px(QR_BOX.size), height: px(QR_BOX.size), background: '#f2f2f2' }} />
              <svg
                className="absolute"
                style={{ left: px(QR_PIC.left), top: px(QR_PIC.top), width: px(QR_PIC.size), height: px(QR_PIC.size) }}
                viewBox={`0 0 ${qrSize} ${qrSize}`}
                shapeRendering="crispEdges"
              >
                <rect width={qrSize} height={qrSize} fill="#ffffff" />
                <path d={qrPath} fill="#000000" />
              </svg>
            </>
          ) : (
            // 화면에만 보이는 안내 — 엑셀에서는 QR 자리를 비움
            <div
              className="absolute flex items-center justify-center text-center whitespace-pre-line border border-dashed border-amber-400 text-amber-600 font-sans font-bold leading-tight"
              style={{ left: px(QR_PIC.left), top: px(QR_PIC.top), width: px(QR_PIC.size), height: px(QR_PIC.size), fontSize: px(7) }}
            >
              {qrText ? 'QR 글자가\n너무 길어요' : 'QR 없음'}
            </div>
          )}
        </div>

        {CELLS.map(cell => {
          const value = cell.field ? String(s[cell.field] ?? '') : cell.text;
          const wrap = cell.fit === 'wrap';
          return (
            <div
              key={cell.key}
              ref={el => { cellRefs.current[cell.key] = el; }}
              className="relative flex items-center justify-center text-center overflow-hidden"
              style={{ gridColumn: `${cell.col[0]} / ${cell.col[1]}`, gridRow: `${cell.row[0]} / ${cell.row[1]}`, padding: `0 ${px(PAD_PT)}px` }}
            >
              <span
                style={{
                  display: wrap ? 'block' : 'inline-block',
                  width: wrap ? '100%' : undefined,
                  whiteSpace: wrap ? 'pre-wrap' : 'pre',
                  overflowWrap: wrap ? 'anywhere' : undefined,
                  fontWeight: cell.bold ? 700 : 400,
                  fontSize: cell.field ? undefined : px(cell.pt),
                  letterSpacing: cell.field && cell.fit !== 'title' ? VALUE_SPACING : undefined,
                  lineHeight: 1.25,
                }}
              >
                {value}
              </span>
              {cell.fit === 'title' && (
                <span ref={titleRefRef} aria-hidden="true" className="absolute invisible whitespace-pre"
                  style={{ fontWeight: 700, fontSize: px(cell.pt), lineHeight: 1.25 }}>
                  {TITLE_REFERENCE}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p ref={warnRef} hidden className="text-[11px] font-bold text-red-600">빨간 점선 칸은 글이 칸보다 길어서 엑셀에서 잘릴 수 있어요.</p>
      <p className="text-[10px] text-slate-400">미리보기 — 실제 모양은 엑셀 양식 (글꼴에 따라 조금 다를 수 있어요)</p>
    </div>
  );
};
