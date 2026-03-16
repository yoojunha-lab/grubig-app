import React from 'react';
import { Calendar, Search, X, Eye, Trash2, AlertCircle } from 'lucide-react';
import { num, usd, smartRound, getLastDayOfQuoteMonth } from '../utils/helpers';

export const QuoteHistoryPage = ({
  quoteBuyerFilter,
  setQuoteBuyerFilter,
  quoteDateFilter,
  setQuoteDateFilter,
  quoteMarketFilter,
  setQuoteMarketFilter,
  quoteAuthorFilter,
  setQuoteAuthorFilter,
  uniqueAuthors,
  filteredQuotesList,
  quickViewQuote,
  setQuickViewQuote,
  setQuoteInput,
  setActiveTab,
  handleDownloadPDF,
  handleDeleteQuote,
  savedQuotes,
  setSavedQuotes
}) => {
  return (
    <>
      <div className="max-w-[1600px] mx-auto space-y-6 print:hidden w-full">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-6 h-6 text-indigo-600" /> Quote History</h2>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
            <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Search className="w-3.5 h-3.5 text-slate-400" /><input type="text" placeholder="바이어 검색..." value={quoteBuyerFilter} onChange={(e) => setQuoteBuyerFilter(e.target.value.toUpperCase())} className="text-sm outline-none w-full sm:w-28 text-slate-600 font-bold uppercase" />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline">Date:</span><input type="date" value={quoteDateFilter} onChange={(e) => setQuoteDateFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold" />
              {quoteDateFilter && <button onClick={() => setQuoteDateFilter('')} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline">Market:</span>
              <select value={quoteMarketFilter} onChange={(e) => setQuoteMarketFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold">
                <option value="All">All</option><option value="domestic">DOM(내수)</option><option value="export">EXP(수출)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline">Author:</span>
              <select value={quoteAuthorFilter} onChange={(e) => setQuoteAuthorFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold">
                {uniqueAuthors.map(author => <option key={author} value={author}>{author === 'All' ? 'All' : author}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr><th className="p-4 w-32">Date</th><th className="p-4">Buyer</th><th className="p-4 w-32">Type</th><th className="p-4 w-24 text-center">Items</th><th className="p-4 w-32">Author</th><th className="p-4 w-56 text-center">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotesList.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50 group">
                  <td className="p-4 font-mono text-slate-500">{quote.date}</td>
                  <td className="p-4 font-bold text-slate-800 text-base uppercase">
                    {quote.buyerName}
                    {quote.remarks && <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate max-w-[200px]" title={quote.remarks}>{quote.remarks}</div>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase ${quote.buyerType === 'converter' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{quote.buyerType}</span>
                      <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase border ${quote.marketType === 'domestic' ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'}`}>{quote.marketType === 'domestic' ? 'DOM' : 'EXP'} ({quote.currency})</span>
                    </div>
                  </td>
                  <td className="p-4 text-center"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">{quote.items?.length || 0}</span></td>
                  <td className="p-4 text-slate-500 font-medium">{quote.authorName}</td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => setQuickViewQuote(quote)} className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1" title="미리보기"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setQuoteInput(quote); setActiveTab('quotation'); }} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition-colors">Edit</button>
                      <button onClick={() => { setQuoteInput(quote); handleDownloadPDF(); }} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">PDF</button>
                      <button onClick={() => handleDeleteQuote(quote.id, (id) => setSavedQuotes(savedQuotes.filter(q => q.id !== id)))} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotesList.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-slate-400">No quotation history found matching the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick View */}
      {quickViewQuote && (
        <div className="fixed inset-0 bg-black/60 z-[10000] p-4 md:p-12 overflow-y-auto flex justify-center items-start backdrop-blur-sm">
          <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-6 md:p-12 relative rounded-xl shadow-2xl my-auto">
            <button onClick={() => setQuickViewQuote(null)} className="absolute right-4 md:right-6 top-4 md:top-6 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors"><X className="w-6 h-6" /></button>

            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="GRUBIG Logo" className="h-16 object-contain mx-auto mb-2" onError={(e) => e.target.style.display = 'none'} />
            </div>
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">FABRIC QUOTATION</h2><p className="text-slate-500 text-sm font-bold">FOB PRICE</p>
            </div>
            <div className="flex justify-between mb-6">
              <div className="w-1/2">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">To</p>
                <h2 className="text-xl font-bold text-slate-900 uppercase">{quickViewQuote.buyerName}</h2>
              </div>
              <div className="w-1/2 text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Date</p>
                <h2 className="text-lg font-bold text-slate-900">{quickViewQuote.date}</h2>
                <p className="text-[10px] text-slate-500 mt-1">Currency: {quickViewQuote.currency}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left mb-8 border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="py-2 font-bold text-slate-900">Article</th><th className="py-2 font-bold text-slate-900">Spec</th><th className="py-2 font-bold text-slate-900 text-center">Cut</th><th className="py-2 font-bold text-slate-900 text-center">Full</th><th className="py-2 font-bold text-slate-900 text-right">GSM</th><th className="py-2 font-bold text-slate-900 text-right">g/YD</th><th className="py-2 font-bold text-slate-900 text-right text-orange-600">MCQ</th><th className="py-2 font-bold text-slate-900 text-right">1,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">3,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">5,000 YD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(quickViewQuote.items || []).map((item, idx) => {
                    const exMarkup = 1 + (Number(quickViewQuote.extraMargin) || 0) / 100;
                    const fmtPrice = (val) => quickViewQuote.currency === 'USD' ? `$${usd(val)}` : `￦${num(val)}`;
                    const p1k = item.basePrice1k ? smartRound(item.basePrice1k * exMarkup, quickViewQuote.currency) : item.price1k;
                    const p3k = item.basePrice3k ? smartRound(item.basePrice3k * exMarkup, quickViewQuote.currency) : item.price3k;
                    const p5k = item.basePrice5k ? smartRound(item.basePrice5k * exMarkup, quickViewQuote.currency) : item.price5k;
                    return (
                      <tr key={idx}>
                        <td className="py-3 font-bold text-slate-800 uppercase">{item.article}</td><td className="py-3 text-slate-600 truncate max-w-[120px]">{item.itemName}</td><td className="py-3 text-center text-slate-500">{item.widthCut}"</td><td className="py-3 text-center text-slate-500">{item.widthFull}"</td><td className="py-3 text-right text-slate-500">{item.gsm}</td><td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td><td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td><td className="py-3 text-right font-mono">{fmtPrice(p1k)}</td><td className="py-3 text-right font-mono font-bold">{fmtPrice(p3k)}</td><td className="py-3 text-right font-mono">{fmtPrice(p5k)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* 내부 참조용 메모는 퀵뷰에서만 보입니다 */}
            {quickViewQuote.remarks && (
              <div className="bg-yellow-50 p-4 border border-yellow-200 rounded-lg mb-8 text-xs text-yellow-800 whitespace-pre-wrap">
                <span className="font-bold flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5" /> 내부 참조용 메모 (PDF 출력 안됨)</span>
                {quickViewQuote.remarks}
              </div>
            )}
            <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed">
              <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfQuoteMonth(quickViewQuote.date)}</span></p>
              <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p><p className="mb-1">• BULK PRICING NEGOTIABLE</p><p>• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
