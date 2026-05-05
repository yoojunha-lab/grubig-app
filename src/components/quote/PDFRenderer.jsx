import React from 'react';
import { num, smartRound, getLastDayOfQuoteMonth } from '../../utils/helpers';

// A4 한 장 기준 담을 수 있는 행 수 (패딩/마진 감안 경험치)
const SINGLE_PAGE_MAX = 13;     // 로고+인사+품목+하단약관을 한 장에 다 담는 최대 품목수
const FIRST_PAGE_ITEMS = 17;    // 멀티페이지 시 첫 페이지(로고+인사, footer 없음)
const MIDDLE_PAGE_ITEMS = 22;   // 중간 페이지 (cont-header + 표만)
const LAST_PAGE_MAX = 18;       // 마지막 페이지 (cont-header + 표 + footer)

// 품목 리스트를 A4 페이지 단위로 분할
// 모든 경로에서 반드시 마지막 페이지가 isLast=true로 끝나도록 보장
const splitPages = (items) => {
  const list = items || [];
  if (list.length === 0) return [{ items: [], isFirst: true, isLast: true }];
  if (list.length <= SINGLE_PAGE_MAX) return [{ items: list, isFirst: true, isLast: true }];

  const pages = [];
  // 첫 페이지: 만약 이걸로 다 소진되면 뒷 페이지에 footer만 남게 되므로 절반으로 잘라서 2페이지 보장
  let firstChunk = Math.min(FIRST_PAGE_ITEMS, list.length);
  if (list.length - firstChunk === 0) {
    firstChunk = Math.max(1, Math.floor(list.length / 2));
  }
  pages.push({ items: list.slice(0, firstChunk), isFirst: true, isLast: false });

  let i = firstChunk;
  while (i < list.length) {
    const remaining = list.length - i;
    // 남은 품목이 마지막 페이지에 다 들어가면 거기서 종료 (footer 포함)
    if (remaining <= LAST_PAGE_MAX) {
      pages.push({ items: list.slice(i), isFirst: false, isLast: true });
      break;
    }
    // 중간 페이지 1장 떼고 나머지가 없어지면 그걸 last로 처리 (footer 자리 보장)
    if (remaining - MIDDLE_PAGE_ITEMS <= 0) {
      pages.push({ items: list.slice(i), isFirst: false, isLast: true });
      break;
    }
    pages.push({ items: list.slice(i, i + MIDDLE_PAGE_ITEMS), isFirst: false, isLast: false });
    i += MIDDLE_PAGE_ITEMS;
  }

  // 최후 방어: 마지막 페이지가 어떤 이유로 !isLast이면 강제로 isLast로 전환
  if (pages.length > 0 && !pages[pages.length - 1].isLast) {
    pages[pages.length - 1].isLast = true;
  }
  return pages;
};

// 표 헤더 (매 페이지 상단에 반복)
const TableHeader = () => (
  <thead>
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
);

export const PDFRenderer = ({
  isPdfGenerating,
  printRef,
  quoteInput,
  formatQuotePrice,
  getBasePrice,
  extraMarkup
}) => {
  const pages = splitPages(quoteInput.items || []);
  const totalPages = pages.length;

  return (
    <div className={`fixed top-0 left-0 z-[9998] w-[210mm] bg-white ${isPdfGenerating ? 'block' : 'hidden'}`}>
      <div ref={printRef} className="w-[210mm] bg-white">
        {pages.map((page, pageIdx) => (
          <div
            key={pageIdx}
            className="px-8 py-6"
            style={pageIdx > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
          >
            {page.isFirst ? (
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
            ) : (
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-300 avoid-break">
                <div className="text-xs font-bold text-slate-600 uppercase">
                  {quoteInput.buyerName} — Fabric Quotation (Continued)
                </div>
                <div className="text-[10px] text-slate-400">
                  {quoteInput.date} · Page {pageIdx + 1} / {totalPages}
                </div>
              </div>
            )}

            <table className="w-full text-[11px] text-left border-collapse">
              <TableHeader />
              <tbody className="divide-y divide-slate-200">
                {page.items.map((item, idx) => (
                  <tr key={idx} className="avoid-break">
                    <td className="py-3 font-bold text-slate-800 uppercase">{item.article}</td>
                    <td className="py-3 text-slate-600 truncate max-w-[120px]">{item.itemName}</td>
                    <td className="py-3 text-center text-slate-500">{item.widthCut}"</td>
                    <td className="py-3 text-center text-slate-500">{item.widthFull}"</td>
                    <td className="py-3 text-right text-slate-500">{item.gsm}</td>
                    <td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td>
                    <td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td>
                    <td className="py-3 text-right font-mono">{formatQuotePrice(smartRound((getBasePrice(item, '1k') || 0) * extraMarkup, quoteInput.currency))}</td>
                    <td className="py-3 text-right font-mono font-bold">{formatQuotePrice(smartRound((getBasePrice(item, '3k') || 0) * extraMarkup, quoteInput.currency))}</td>
                    <td className="py-3 text-right font-mono">{formatQuotePrice(smartRound((getBasePrice(item, '5k') || 0) * extraMarkup, quoteInput.currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {page.isLast && (
              <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed pb-4 avoid-break">
                <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfQuoteMonth(quoteInput.date)}</span></p>
                <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p>
                <p className="mb-1">• BULK PRICING NEGOTIABLE</p>
                <p className="mb-4">• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
                <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Made in Korea
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
