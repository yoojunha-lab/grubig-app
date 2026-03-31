import React, { useState } from 'react';
import { Calendar, Search, X, Eye, Trash2, AlertCircle, Copy, ChevronDown, ChevronRight, CheckCircle2, FileText } from 'lucide-react';
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
  setSavedQuotes,
  handleDuplicateQuote
}) => {
  const [expandedRowId, setExpandedRowId] = useState(null);

  const toggleExpand = (id, e) => {
    // 버튼 클릭 시에는 아코디언 이벤트 방지
    if (e.target.closest('button')) return;
    setExpandedRowId(expandedRowId === id ? null : id);
  };

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
              {filteredQuotesList.map(quote => {
                const isExpanded = expandedRowId === quote.id;
                return (
                <React.Fragment key={quote.id}>
                <tr className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`} onClick={(e) => toggleExpand(quote.id, e)}>
                  <td className="p-4 font-mono text-slate-500">{quote.date}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-base uppercase">{quote.buyerName}</span>
                        {quote.remarks && <span className="text-[11px] text-slate-500 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 max-w-[200px] truncate" title={quote.remarks}>{quote.remarks}</span>}
                      </div>
                      {quote.attention && <div className="text-[11px] text-indigo-500 font-bold uppercase tracking-tight">ATTN: {quote.attention}</div>}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase ${quote.buyerType === 'converter' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{quote.buyerType}</span>
                      <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase border ${quote.marketType === 'domestic' ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'}`}>{quote.marketType === 'domestic' ? 'DOM' : 'EXP'} ({quote.currency})</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`px-3 py-1 rounded-full font-bold flex items-center justify-center gap-1 w-max mx-auto shadow-sm select-none transition-colors ${isExpanded ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                      {quote.items?.length || 0} items
                      {isExpanded ? <ChevronDown className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-70" />}
                    </div>
                  </td>
                  <td className="p-4 text-slate-500 font-medium">{quote.authorName}</td>
                  <td className="p-4">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); setQuickViewQuote(quote); }} className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1" title="PDF 미리보기"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicateQuote(quote, () => setActiveTab('quotation')); }} className="bg-emerald-50 text-emerald-600 px-2 py-1.5 rounded text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1" title="이 견적서를 복사하여 새 견적서 작성하기"><Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">복제</span></button>
                      <button onClick={(e) => { e.stopPropagation(); setQuoteInput(quote); setActiveTab('quotation'); }} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition-colors">수정</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(quote); }} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">PDF</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id, (id) => setSavedQuotes(savedQuotes.filter(q => q.id !== id))); }} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                {/* 확장된 미리보기 (Accordion) 영역 */}
                {isExpanded && (
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td colSpan="6" className="p-0">
                      <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> 포함된 품목 리스트</p>
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr><th className="py-2 px-3 font-bold">Article</th><th className="py-2 px-3">Spec</th><th className="py-2 px-3 text-right">MCQ</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(quote.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-bold text-slate-800 uppercase">{item.article}</td>
                                    <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]" title={item.itemName}>{item.itemName}</td>
                                    <td className="py-2 px-3 text-right text-orange-600 font-bold">{num(item.mcqYd || 300)} YD</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col justify-end">
                           <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
                             <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                             <div className="text-xs text-blue-800 leading-relaxed">
                               이 견적서는 <strong className="font-bold">{quote.date}</strong>에 작성되었습니다.<br/>
                               새로운 견적서가 필요하다면 우측 상단의 <strong className="text-emerald-600">[복제]</strong> 버튼을 눌러보세요.
                             </div>
                           </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
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
                <h2 className="text-xl font-bold text-slate-900 uppercase leading-none mb-1">{quickViewQuote.buyerName}</h2>
                {quickViewQuote.attention && <p className="text-xs font-bold text-slate-600 uppercase">ATTN: {quickViewQuote.attention}</p>}
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
