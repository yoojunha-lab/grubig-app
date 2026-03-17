import React from 'react';
import { num, smartRound, getLastDayOfQuoteMonth } from '../../utils/helpers';

export const PDFRenderer = ({
  isPdfGenerating,
  printRef,
  quoteInput,
  formatQuotePrice,
  getBasePrice,
  extraMarkup
}) => {
  return (
    <div className={`fixed top-0 left-0 z-[9998] w-[210mm] bg-white ${isPdfGenerating ? 'block' : 'hidden'}`}>
      <div ref={printRef} className="w-[210mm] min-h-[297mm] bg-white px-10 py-12">
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
        <table className="w-full text-[11px] text-left mb-8 border-collapse">
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
          <tbody className="divide-y divide-slate-200">
            {(quoteInput.items || []).map((item, idx) => (
              <tr key={idx}>
                <td className="py-3 font-bold text-slate-800 uppercase">{item.article}</td>
                <td className="py-3 text-slate-600 truncate max-w-[120px]">{item.itemName}</td>
                <td className="py-3 text-center text-slate-500">{item.widthCut}"</td>
                <td className="py-3 text-center text-slate-500">{item.widthFull}"</td>
                <td className="py-3 text-right text-slate-500">{item.gsm}</td>
                <td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td>
                <td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td>
                <td className="py-3 text-right font-mono">{formatQuotePrice(smartRound(getBasePrice(item, '1k') * extraMarkup, quoteInput.currency))}</td>
                <td className="py-3 text-right font-mono font-bold">{formatQuotePrice(smartRound(getBasePrice(item, '3k') * extraMarkup, quoteInput.currency))}</td>
                <td className="py-3 text-right font-mono">{formatQuotePrice(smartRound(getBasePrice(item, '5k') * extraMarkup, quoteInput.currency))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed pb-8">
          <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfQuoteMonth(quoteInput.date)}</span></p>
          <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p>
          <p className="mb-1">• BULK PRICING NEGOTIABLE</p>
          <p className="mb-4">• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
          
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            Made in Korea
          </div>
        </div>
      </div>
    </div>
  );
};
