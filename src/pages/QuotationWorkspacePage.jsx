import React, { useState, useMemo } from 'react';
import { Plus, Home, Globe } from 'lucide-react';
import { QuotationPage } from './QuotationPage';
import { QuoteHistoryPage } from './QuoteHistoryPage';
import { normalizeQuoteMargins } from '../utils/helpers';

// ============================================================
// 견적서 워크스페이스 — '견적서 작성' + '견적 히스토리'를 한 메뉴로 병합
//  - 기본(list) : 견적 히스토리(전체 표) + [새 견적서]
//  - 작성/편집(form) : 좌측 견적 목록 + 우측 작성 폼 (좌측 클릭 시 즉시 로드)
//  기존 QuotationPage / QuoteHistoryPage 를 그대로 재사용 (PI 워크스페이스와 동일한 패턴)
// ============================================================
export const QuotationWorkspacePage = (props) => {
  const {
    quoteInput, setQuoteInput, handleNewQuote,
    savedQuotes = [], setActiveTab,
  } = props;

  const [mode, setMode] = useState('list');

  const openForm = () => setMode('form');
  const backToList = () => setMode('list');
  const openNew = () => { handleNewQuote(); setMode('form'); };
  const loadQuote = (quote) => { setQuoteInput(normalizeQuoteMargins(quote)); setMode('form'); };

  // 히스토리의 '수정/복제'는 setActiveTab('quotation')을 호출 → 폼 모드로 가로채기
  const historySetActiveTab = (tab) => {
    if (tab === 'quotation') openForm();
    else if (setActiveTab) setActiveTab(tab);
  };

  // 좌측 좁은 목록용 정렬 (최신순)
  const sortedQuotes = useMemo(
    () => [...(savedQuotes || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (b.id || 0) - (a.id || 0)),
    [savedQuotes]
  );

  const marketBadge = (m) =>
    (m === 'domestic')
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><Home className="w-3 h-3" /> 내수</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><Globe className="w-3 h-3" /> 수출</span>;

  // ── 기본: 견적 히스토리 전체 표 ──
  if (mode === 'list') {
    return (
      <QuoteHistoryPage
        {...props}
        setActiveTab={historySetActiveTab}
        onNewQuote={openNew}
      />
    );
  }

  // ── 작성/편집: 좌측 목록 + 우측 작성 폼 ──
  const compactList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-150px)]">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <span className="text-xs font-extrabold text-slate-500">견적 목록 ({sortedQuotes.length})</span>
        <button onClick={openNew} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
          <Plus className="w-3.5 h-3.5" /> 새로 작성
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {sortedQuotes.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">저장된 견적서가 없습니다.</div>
        ) : sortedQuotes.map(q => (
          <button key={q.id} onClick={() => loadQuote(q)}
            className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-indigo-50/60 transition-colors ${String(quoteInput.id) === String(q.id) ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'border-l-[3px] border-l-transparent'}`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[13px] font-bold text-slate-800 truncate uppercase">{q.buyerName || '(바이어 미입력)'}</span>
              {marketBadge(q.marketType)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
              <span>{q.date}</span>
              <span className="text-slate-500">{(q.items || []).length} items · {q.currency}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto w-full print:hidden">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <aside className="w-full lg:w-72 shrink-0">{compactList}</aside>
        <div className="flex-1 min-w-0 w-full">
          <QuotationPage {...props} onBackToList={backToList} />
        </div>
      </div>
    </div>
  );
};
