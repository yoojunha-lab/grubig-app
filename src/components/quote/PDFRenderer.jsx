import React from 'react';
import { createPortal } from 'react-dom';
import { num, getQuoteValidUntil, calcQuotePrice, formatQuotePrice } from '../../utils/helpers';

// 견적서 PDF — 단일 연속 표 + 브라우저 자동 페이지 분할 방식.
//  · 행 높이(Spec 줄바꿈)와 무관하게 행이 페이지 경계에서 잘리지 않음 (각 행 break-inside: avoid)
//  · 표 머리글(바이어/날짜 띠 + 컬럼 헤더)을 thead 로 두어 매 인쇄 페이지 상단에 자동 반복
//  · 1페이지 상단에 로고/인사, 표 끝에 약관(Made in Korea)
//  · [구버전 폐기] '페이지당 고정 행수'로 미리 자르던 splitPages 방식은 행이 2줄로 길어지면
//    한 장에 안 들어가 다음 장으로 흘러넘쳐(헤더 없이) 끊겨 보이는 문제가 있어 제거함.

export const PDFRenderer = ({
  isPdfGenerating,
  printRef,
  quoteInput
}) => {
  const items = quoteInput.items || [];
  const currency = quoteInput.currency;

  // [PDF 좌측 잘림 v4 — native window.print() 방식]
  //   Chrome native 인쇄(window.print) + @media print CSS (index.css) 로 출력.
  //   PDFRenderer 는 항상 DOM에 존재하지만 화면 밖에 숨김, 인쇄 시점에만 visible.
  return createPortal(
    <div
      className="pdf-render-root"
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
              <p className="text-slate-500 text-sm font-bold">FOB PRICE</p>
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

          {/* 단일 연속 표 — thead(바이어 띠 + 컬럼헤더)가 매 인쇄 페이지 상단에 자동 반복,
              각 행은 break-inside:avoid 로 페이지 경계에서 잘리지 않음 */}
          <table className="w-full text-[11px] text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            {/* [D1] colgroup 명시 - Article·Spec 잘림 방지 + 가격 컬럼 일관 폭 */}
            <colgroup>
              <col style={{ width: '13%' }} />{/* Article */}
              <col style={{ width: '21%' }} />{/* Spec (item name) — 두 줄 줄바꿈 위해 확대 */}
              <col style={{ width: '5%' }} />{/* Cut */}
              <col style={{ width: '5%' }} />{/* Full */}
              <col style={{ width: '6%' }} />{/* GSM */}
              <col style={{ width: '7%' }} />{/* g/YD */}
              <col style={{ width: '11%' }} />{/* MCQ */}
              <col style={{ width: '10%' }} />{/* 1,000 YD */}
              <col style={{ width: '11%' }} />{/* 3,000 YD */}
              <col style={{ width: '11%' }} />{/* 5,000 YD */}
            </colgroup>
            <thead>
              {/* 바이어/날짜 띠 — 2·3장에서도 어느 견적서인지 식별되도록 매 페이지 반복 */}
              <tr>
                <th colSpan={10} className="text-left font-bold text-slate-400 uppercase pt-0 pb-1" style={{ fontSize: '9px', letterSpacing: '0.04em' }}>
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
                <th className="py-2 font-bold text-slate-900 text-right text-orange-600 uppercase">MCQ</th>
                <th className="py-2 font-bold text-slate-900 text-right uppercase">1,000 YD</th>
                <th className="py-2 font-bold text-slate-900 text-right uppercase">3,000 YD</th>
                <th className="py-2 font-bold text-slate-900 text-right uppercase">5,000 YD</th>
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
                  <td className="py-3 text-right font-mono">{formatQuotePrice(calcQuotePrice(item, '1k', quoteInput, currency), currency)}</td>
                  <td className="py-3 text-right font-mono font-bold">{formatQuotePrice(calcQuotePrice(item, '3k', quoteInput, currency), currency)}</td>
                  <td className="py-3 text-right font-mono">{formatQuotePrice(calcQuotePrice(item, '5k', quoteInput, currency), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 표 끝 약관 — 한 덩어리로 안 잘리게 */}
          <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed pb-4 avoid-break">
            <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getQuoteValidUntil(quoteInput.date, quoteInput.validityOption)}</span></p>
            <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p>
            <p className="mb-1">• BULK PRICING NEGOTIABLE</p>
            <p className="mb-4">• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
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
