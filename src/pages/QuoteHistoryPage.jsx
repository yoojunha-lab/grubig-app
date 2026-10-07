import React, { useState } from 'react';
import { Search, X, Trash2, Copy, ChevronDown, ChevronRight, CheckCircle2, FileText, FileSpreadsheet, FilePlus } from 'lucide-react';
import { num } from '../utils/helpers';
import {
  calcQuotePrice, formatQuotePrice, normalizeQuote, getShownTiers, getShownCustomItems, calcCustomQuotePrice,
  normalizeRunning, formatColorSplit,
} from '../utils/quoteModel';
import { RunningGreigeBadge } from '../components/quote/QuoteParts';

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
  setQuoteInput,
  setActiveTab,
  handleDownloadPDF,
  handleDownloadQuoteExcel,
  handleDeleteQuote,
  savedQuotes,
  setSavedQuotes,
  handleDuplicateQuote,
  onNewQuote,             // 병합 화면: [새 견적서] 버튼 (없으면 미표시)
}) => {
  const [expandedRowId, setExpandedRowId] = useState(null);

  const toggleExpand = (id, e) => {
    // 버튼 클릭 시에는 아코디언 이벤트 방지
    if (e.target.closest('button')) return;
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <>
      <div className="max-w-[1600px] mx-auto space-y-4 print:hidden w-full">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> 견적서 <span className="text-sm font-bold text-slate-400">({(savedQuotes || []).length})</span></h2>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
            {onNewQuote && (
              <button onClick={() => onNewQuote()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 text-sm font-bold shadow-lg shadow-indigo-200 shrink-0 order-first xl:order-none">
                <FilePlus className="w-4 h-4" /> 새 견적서
              </button>
            )}
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
          <table className="w-full text-xs text-left min-w-[820px] border-collapse">
            <thead className="bg-slate-50 text-slate-400 font-bold border-b-2 border-slate-200">
              <tr className="text-[10px] uppercase tracking-wide divide-x divide-slate-200"><th className="py-2 px-3 w-24">Date</th><th className="py-2 px-3 w-36">Buyer</th><th className="py-2 px-3 w-28">ATTN (담당자)</th><th className="py-2 px-3">Remark (비고)</th><th className="py-2 px-3 w-28">Type</th><th className="py-2 px-3 w-20 text-center">Items</th><th className="py-2 px-3 w-24">Author</th><th className="py-2 px-3 w-[22rem] text-center">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...filteredQuotesList]
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || b.id - a.id)
                .map(quote => {
                const isExpanded = expandedRowId === quote.id;
                return (
                <React.Fragment key={quote.id}>
                <tr className={`group cursor-pointer transition-colors divide-x divide-slate-100 ${isExpanded ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`} onClick={(e) => toggleExpand(quote.id, e)}>
                  <td className="py-1.5 px-3 font-mono text-slate-500 whitespace-nowrap">{quote.date}</td>
                  <td className="py-1.5 px-3">
                    <span className="font-bold text-slate-800 text-[13px] uppercase leading-tight">{quote.buyerName}</span>
                  </td>
                  <td className="py-1.5 px-3 text-slate-600 text-xs uppercase">
                    {quote.attention || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600 text-xs">
                    {quote.remarks
                      ? <div className="line-clamp-2 break-words leading-tight" title={quote.remarks}>{quote.remarks}</div>
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {quote.buyerType && <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${quote.buyerType === 'converter' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{quote.buyerType}</span>}
                      <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase border ${quote.marketType === 'domestic' ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'}`}>{quote.marketType === 'domestic' ? 'DOM' : 'EXP'} ({quote.currency})</span>
                    </div>
                    {quote.exchangeRate ? <div className="text-[9px] text-slate-400 font-mono mt-0.5">환율 ￦{num(quote.exchangeRate)}/$</div> : null}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <div className={`px-2 py-0.5 text-xs rounded-full font-bold flex items-center justify-center gap-0.5 w-max mx-auto select-none transition-colors ${isExpanded ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                      {quote.items?.length || 0}
                      {(quote.customItems || []).length > 0 && <span className="text-amber-600" title="별도 견적 줄 수">+{quote.customItems.length}</span>}
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-70" /> : <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-slate-500 text-xs">{quote.authorName}</td>
                  <td className="py-1.5 px-3">
                    <div className="flex gap-1 justify-center flex-nowrap">
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicateQuote(quote, () => setActiveTab('quotation')); }} className="shrink-0 whitespace-nowrap bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[11px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1" title="이 견적서를 복사하여 새 견적서 작성하기"><Copy className="w-3 h-3" /> <span className="hidden sm:inline">복제</span></button>
                      <button onClick={(e) => { e.stopPropagation(); setQuoteInput(normalizeQuote(quote)); setActiveTab('quotation'); }} className="shrink-0 whitespace-nowrap bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-[11px] font-bold hover:bg-slate-200 transition-colors">수정</button>
                      {(quote.items || []).length > 0 && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(quote, 'standard'); }} title="기준 견적서 PDF" className="shrink-0 whitespace-nowrap bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded text-[11px] font-bold hover:bg-indigo-100 transition-colors">PDF</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadQuoteExcel(quote, 'standard'); }} className="shrink-0 whitespace-nowrap bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1" title="기준 견적서 엑셀"><FileSpreadsheet className="w-3 h-3" /> <span className="hidden sm:inline">Excel</span></button>
                        </>
                      )}
                      {getShownCustomItems(quote).length > 0 && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(quote, 'special'); }} title="별도 견적서 PDF" className="shrink-0 whitespace-nowrap bg-amber-50 text-amber-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-amber-100 transition-colors">별도 PDF</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadQuoteExcel(quote, 'special'); }} title="별도 견적서 엑셀" className="shrink-0 whitespace-nowrap bg-amber-50 text-amber-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> <span className="hidden sm:inline">별도</span></button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id, (id) => setSavedQuotes(savedQuotes.filter(q => q.id !== id))); }} className="shrink-0 text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
                {/* 확장된 미리보기 (Accordion) 영역 */}
                {isExpanded && (
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td colSpan="8" className="p-0">
                      <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                        <div className="space-y-3 min-w-0">
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1 flex-wrap"><FileText className="w-3.5 h-3.5" /> 기준 견적 — 견적서에 나간 구간
                              {(quote.excludeVisual === true || quote.excludeChem === true) && (
                                <span className="font-bold text-rose-600">· {[quote.excludeVisual === true && '외관검사 제외', quote.excludeChem === true && '시험성적서 제외'].filter(Boolean).join(' · ')}</span>
                              )}
                            </p>
                            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shrink-0">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="py-2 px-3 font-bold">Article</th>
                                    <th className="py-2 px-3">Spec</th>
                                    <th className="py-2 px-3 text-right">MCQ</th>
                                    {getShownTiers(quote).map(t => (
                                      <th key={t.key} className={`py-2 px-3 text-right whitespace-nowrap ${t.main ? 'font-bold text-blue-600' : ''}`}>{t.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(quote.items || []).length === 0 && (
                                    <tr><td colSpan={3 + getShownTiers(quote).length} className="py-3 px-3 text-center text-slate-400">기준 견적 품목 없음</td></tr>
                                  )}
                                  {(quote.items || []).map((item, idx) => {
                                    // 실제 나간 단가로 표시: calcQuotePrice = 기준원가 + 매출이익율(%) + YD당 정액.
                                    // (기존엔 getBasePrice=마진 미포함 기준원가만 보여 PDF/실제 견적가와 달랐음 → 버그 수정)
                                    const cur = quote.currency;
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-bold text-slate-800 uppercase whitespace-nowrap">{item.article}</td>
                                        <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]" title={item.itemName}>{item.itemName}</td>
                                        <td className="py-2 px-3 text-right text-orange-600 font-bold whitespace-nowrap">{num(item.mcqYd || 300)} YD</td>
                                        {getShownTiers(quote).map(t => (
                                          <td key={t.key} className={`py-2 px-3 text-right font-mono whitespace-nowrap ${t.main ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>{formatQuotePrice(calcQuotePrice(item, t.key, quote, cur), cur)}</td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          {(quote.customItems || []).length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1 flex-wrap"><FileText className="w-3.5 h-3.5" /> 별도 견적 <span className="font-medium text-slate-400">(흐린 줄은 견적서에 안 나감)</span>
                                {(quote.customExcludeVisual === true || quote.customExcludeChem === true) && (
                                  <span className="font-bold text-rose-600">· {[quote.customExcludeVisual === true && '외관검사 제외', quote.customExcludeChem === true && '시험성적서 제외'].filter(Boolean).join(' · ')}</span>
                                )}
                              </p>
                              <div className="bg-white border border-amber-200 rounded-lg overflow-x-auto shrink-0">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-amber-50/60 text-slate-500">
                                    <tr>
                                      <th className="py-2 px-3 font-bold">Article</th>
                                      <th className="py-2 px-3 text-right">수량</th>
                                      <th className="py-2 px-3 text-center">컬러</th>
                                      <th className="py-2 px-3 text-right">판가/YD</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {quote.customItems.map((row, idx) => {
                                      // 러닝 생지 견적 줄 (2026-10-07) — 배지 + 수량 칸 아래 컬러별 수량
                                      const running = normalizeRunning(row.running);
                                      return (
                                        <tr key={row.id || idx} className={row.show === false ? 'opacity-50' : ''}>
                                          <td className="py-2 px-3 font-bold text-slate-800 uppercase whitespace-nowrap">
                                            {row.article}
                                            {running && <RunningGreigeBadge greigeQty={running.greigeQty} />}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                                            {num(row.qty)} YD
                                            {running && <span className="block text-[10px] text-teal-700">{formatColorSplit(row)}</span>}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono">{num(row.colors)}</td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">{formatQuotePrice(calcCustomQuotePrice(row, quote, quote.currency), quote.currency)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
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
              {filteredQuotesList.length === 0 && <tr><td colSpan="8" className="p-12 text-center text-slate-400">No quotation history found matching the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
