import React from 'react';
import { createPortal } from 'react-dom';
import { num, getQuoteValidUntil } from '../../utils/helpers';
import {
  calcQuotePrice, formatQuotePrice, getShownTiers, getShownCustomItems, calcCustomQuotePrice, quotePriceBasis, buildQuoteTerms,
} from '../../utils/quoteModel';

// 견적서 PDF — 단일 연속 표 + 브라우저 자동 페이지 분할 방식.
//  · 행 높이(Spec 줄바꿈)와 무관하게 행이 페이지 경계에서 잘리지 않음 (각 행 break-inside: avoid)
//  · 표 머리글(바이어/날짜 띠 + 컬럼 헤더)을 thead 로 두어 매 인쇄 페이지 상단에 자동 반복
//  · 1페이지 상단에 로고/인사, 표 끝에 약관(Made in Korea)
//  · [구버전 폐기] '페이지당 고정 행수'로 미리 자르던 splitPages 방식은 행이 2줄로 길어지면
//    한 장에 안 들어가 다음 장으로 흘러넘쳐(헤더 없이) 끊겨 보이는 문제가 있어 제거함.
//  · [2026-10-05] kind 로 두 문서를 따로 출력
//    - 'standard' 기준 견적서: 고른 구간(shownTiers)만, 구간 조건·제외 항목·부가세/FOB 문구
//    - 'special'  별도 견적서: 별도 견적 중 '견적서' 체크한 줄만 (수량·컬러·단가). 외관검사·시험성적서 제외는 약관 줄로
//  · 약관·가격 기준 문구는 quoteModel.buildQuoteTerms / quotePriceBasis — 엑셀 내보내기와 같은 문구

// 기준 견적서 열 너비(%) — 구간 수에 따라 스펙 칸과 가격 칸을 나눔
const standardColumns = (n) => {
  const narrow = n >= 6;
  const info = narrow
    ? { article: 10, cut: 4, full: 4, gsm: 5, gyd: 5, mcq: 7 }
    : { article: 12, cut: 5, full: 5, gsm: 6, gyd: 6.5, mcq: 8 };
  const price = n <= 3 ? 11 : n === 4 ? 10 : n === 5 ? 8.5 : 7.5;
  const used = Object.values(info).reduce((s, v) => s + v, 0) + price * n;
  return { ...info, spec: Math.max(10, 100 - used), price };
};

export const PDFRenderer = ({
  isPdfGenerating,
  printRef,
  quoteInput,
  kind = 'standard',
}) => {
  const isSpecial = kind === 'special';
  const currency = quoteInput.currency;
  const items = quoteInput.items || [];
  const shownTiers = getShownTiers(quoteInput);
  const rows = getShownCustomItems(quoteInput);
  const col = standardColumns(shownTiers.length);
  const priceBasis = quotePriceBasis(currency);
  const terms = buildQuoteTerms(quoteInput, isSpecial ? 'special' : 'standard');

  // [PDF 좌측 잘림 v4 — native window.print() 방식]
  //   Chrome native 인쇄(window.print) + @media print CSS (index.css) 로 출력.
  //   PDFRenderer 는 항상 DOM에 존재하지만 화면 밖에 숨김, 인쇄 시점에만 visible.
  return createPortal(
    <div
      className="pdf-render-root"
      data-generating={isPdfGenerating ? 'true' : 'false'}
      style={{
        position: 'fixed',
        top: 0,
        left: '-99999px',
        width: '794px',
        margin: 0,
        padding: 0,
        backgroundColor: '#ffffff',
        zIndex: 9998,
        textAlign: 'left',
        boxSizing: 'border-box'
      }}
    >
      <div ref={printRef} className="pdf-render-inner" style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', textAlign: 'left', boxSizing: 'border-box' }}>
        <div className="px-8 py-6">
          {/* 1페이지 상단: 로고 + 제목 + To/Date (한 덩어리로 안 잘리게) */}
          <div className="avoid-break">
            <div className="flex justify-center mb-6">
              <div className="text-center w-full">
                <img src="/logo.png" alt="GRUBIG Logo" className="h-[100px] object-contain mx-auto mb-2" onError={(e) => e.target.style.display = 'none'} />
              </div>
            </div>
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">FABRIC QUOTATION</h2>
              <p className="text-slate-500 text-sm font-bold">{isSpecial ? `SPECIAL CONDITIONS · ${priceBasis}` : priceBasis}</p>
            </div>
            <div className="flex justify-between mb-6">
              <div className="w-1/2">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">To</p>
                <h2 className="text-xl font-bold text-slate-900 uppercase leading-none mb-1">
                  {quoteInput.buyerName || ''}
                </h2>
                {quoteInput.attention && <p className="text-xs font-bold text-slate-600 uppercase">ATTN: {quoteInput.attention}</p>}
              </div>
              <div className="w-1/2 text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Date</p>
                <h2 className="text-lg font-bold text-slate-900">{quoteInput.date}</h2>
                <p className="text-[10px] text-slate-500 mt-1">Currency: {quoteInput.currency}</p>
              </div>
            </div>
          </div>

          {!isSpecial ? (
            /* ── 기준 견적서: 단일 연속 표 — thead(바이어 띠 + 컬럼헤더)가 매 인쇄 페이지 상단에 자동 반복 ── */
            <table className={`w-full ${shownTiers.length >= 6 ? 'text-[10px]' : 'text-[11px]'} text-left border-collapse`} style={{ tableLayout: 'fixed' }}>
              {/* [D1] colgroup 명시 - Article·Spec 잘림 방지 + 가격 컬럼 일관 폭 */}
              <colgroup>
                <col style={{ width: `${col.article}%` }} />{/* Article */}
                <col style={{ width: `${col.spec}%` }} />{/* Spec (item name) */}
                <col style={{ width: `${col.cut}%` }} />{/* Cut */}
                <col style={{ width: `${col.full}%` }} />{/* Full */}
                <col style={{ width: `${col.gsm}%` }} />{/* GSM */}
                <col style={{ width: `${col.gyd}%` }} />{/* g/YD */}
                <col style={{ width: `${col.mcq}%` }} />{/* MCQ */}
                {shownTiers.map(t => <col key={t.key} style={{ width: `${col.price}%` }} />)}
              </colgroup>
              <thead>
                {/* 바이어/날짜 띠 — 2·3장에서도 어느 견적서인지 식별되도록 매 페이지 반복 */}
                <tr>
                  <th colSpan={7 + shownTiers.length} className="text-left font-bold text-slate-400 uppercase pt-0 pb-1" style={{ fontSize: '9px', letterSpacing: '0.04em' }}>
                    {quoteInput.buyerName || ''} · {quoteInput.date} · {quoteInput.currency}
                  </th>
                </tr>
                <tr className="border-b-2 border-slate-800">
                  <th className="py-2 font-bold text-slate-900 uppercase">Article</th>
                  <th className="py-2 font-bold text-slate-900 uppercase">Spec</th>
                  <th className="py-2 font-bold text-slate-900 text-center uppercase">Cut</th>
                  <th className="py-2 font-bold text-slate-900 text-center uppercase">Full</th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">GSM</th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">g/YD</th>
                  <th className="py-2 font-bold text-slate-900 text-right text-orange-600 uppercase">MCQ<span className="block text-[8px] font-semibold">PER COLOR</span></th>
                  {shownTiers.map(t => (
                    <th key={t.key} className="py-2 font-bold text-slate-900 text-right uppercase">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => (
                  <tr key={idx} className="avoid-break">
                    <td className="py-3 font-bold text-slate-800 uppercase break-words">{item.article}</td>
                    <td className="py-3 text-slate-600 break-words leading-tight">{item.itemName}</td>
                    <td className="py-3 text-center text-slate-500">{item.widthCut}"</td>
                    <td className="py-3 text-center text-slate-500">{item.widthFull}"</td>
                    <td className="py-3 text-right text-slate-500">{item.gsm}</td>
                    <td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td>
                    <td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td>
                    {shownTiers.map(t => (
                      <td key={t.key} className={`py-3 text-right font-mono ${t.main ? 'font-bold' : ''}`}>{formatQuotePrice(calcQuotePrice(item, t.key, quoteInput, currency), currency)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ── 별도 견적서: 줄마다 수량·컬러·조건이 다른 단가 ── */
            <table className="w-full text-[11px] text-left border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '13%' }} />{/* Article */}
                <col style={{ width: '22%' }} />{/* Spec */}
                <col style={{ width: '6%' }} />{/* Cut */}
                <col style={{ width: '6%' }} />{/* Full */}
                <col style={{ width: '6%' }} />{/* GSM */}
                <col style={{ width: '7%' }} />{/* g/YD */}
                <col style={{ width: '10%' }} />{/* Q'TY */}
                <col style={{ width: '7%' }} />{/* COLORS */}
                <col style={{ width: '10%' }} />{/* MCQ / COLOR */}
                <col style={{ width: '13%' }} />{/* PRICE/YD */}
              </colgroup>
              <thead>
                <tr>
                  <th colSpan={10} className="text-left font-bold text-slate-400 uppercase pt-0 pb-1" style={{ fontSize: '9px', letterSpacing: '0.04em' }}>
                    {quoteInput.buyerName || ''} · {quoteInput.date} · {quoteInput.currency} · SPECIAL CONDITIONS
                  </th>
                </tr>
                <tr className="border-b-2 border-slate-800">
                  <th className="py-2 font-bold text-slate-900 uppercase">Article</th>
                  <th className="py-2 font-bold text-slate-900 uppercase">Spec</th>
                  <th className="py-2 font-bold text-slate-900 text-center uppercase">Cut</th>
                  <th className="py-2 font-bold text-slate-900 text-center uppercase">Full</th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">GSM</th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">g/YD</th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">Q'TY</th>
                  <th className="py-2 font-bold text-slate-900 text-center uppercase">Colors</th>
                  <th className="py-2 font-bold text-slate-900 text-right text-orange-600 uppercase">MCQ<span className="block text-[8px] font-semibold">PER COLOR</span></th>
                  <th className="py-2 font-bold text-slate-900 text-right uppercase">Price / YD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr key={row.id || idx} className="avoid-break">
                    <td className="py-3 font-bold text-slate-800 uppercase break-words">{row.article}</td>
                    <td className="py-3 text-slate-600 break-words leading-tight">{row.itemName}</td>
                    <td className="py-3 text-center text-slate-500">{row.widthCut}"</td>
                    <td className="py-3 text-center text-slate-500">{row.widthFull}"</td>
                    <td className="py-3 text-right text-slate-500">{row.gsm}</td>
                    <td className="py-3 text-right text-slate-500 font-mono">{num(row.gYd)}</td>
                    <td className="py-3 text-right text-slate-900 font-mono font-bold">{num(row.qty)} YD</td>
                    <td className="py-3 text-center text-slate-900 font-mono font-bold">{num(row.colors)}</td>
                    <td className="py-3 text-right text-slate-900 font-mono">{num(row.mcqYd || 300)} YD</td>
                    <td className="py-3 text-right font-mono font-bold">{formatQuotePrice(calcCustomQuotePrice(row, quoteInput, currency), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 표 끝 약관 — 한 덩어리로 안 잘리게 */}
          <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed pb-4 avoid-break">
            <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getQuoteValidUntil(quoteInput.date, quoteInput.validityOption)}</span></p>
            {terms.map((line, i) => (
              <p key={line} className={i === terms.length - 1 ? 'mb-4' : 'mb-1'}>• {line}</p>
            ))}
            <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Made in Korea
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
