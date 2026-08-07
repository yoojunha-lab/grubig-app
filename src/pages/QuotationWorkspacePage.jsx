import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Home, Globe, Save, LogOut, X } from 'lucide-react';
import { QuotationPage } from './QuotationPage';
import { QuoteHistoryPage } from './QuoteHistoryPage';
import { normalizeQuoteMargins } from '../utils/helpers';

// ============================================================
// 견적서 워크스페이스 — '견적서 작성' + '견적 히스토리'를 한 메뉴로 병합
//  - 기본(list) : 견적 히스토리(전체 표) + [새 견적서]
//  - 작성/편집(form) : 좌측 견적 목록 + 우측 작성 폼 (좌측 클릭 시 즉시 로드)
//  - 편집 중 변경사항이 있으면 나갈 때 "저장할까요?" 확인, 변경 없으면 조용히 이동
// ============================================================
export const QuotationWorkspacePage = (props) => {
  const {
    quoteInput, setQuoteInput, handleNewQuote, handleSaveQuote,
    savedQuotes = [], setSavedQuotes, setActiveTab, showToast,
    navGuardRef,
  } = props;

  const [mode, setMode] = useState('list');

  // ── 변경사항(dirty) 감지용 기준 스냅샷 ──
  //  loadNonce 가 바뀔 때(폼 진입/견적 로드/새 견적/저장 직후)만 기준을 다시 캡처.
  //  이후 사용자의 편집은 nonce를 안 바꾸므로 기준은 로드시점 상태로 고정 → 현재 상태와 비교해 dirty 판정.
  const baselineRef = useRef(JSON.stringify(quoteInput));
  const [loadNonce, setLoadNonce] = useState(0);
  useEffect(() => { baselineRef.current = JSON.stringify(quoteInput); }, [loadNonce]);
  const captureBaseline = () => setLoadNonce(n => n + 1);
  const isDirty = () => JSON.stringify(quoteInput) !== baselineRef.current;

  const [pendingLeave, setPendingLeave] = useState(null); // 나가기 대기 액션 (dirty일 때)

  const enterForm = () => { setMode('form'); captureBaseline(); };

  // 실제 저장 (QuotationPage의 Save와 동일한 후처리)
  const persistQuote = () => {
    const willSave = quoteInput.buyerName && (quoteInput.items || []).length > 0;
    handleSaveQuote((item) => {
      if (item.id && savedQuotes.some(q => q.id === item.id)) setSavedQuotes(savedQuotes.map(q => q.id === item.id ? item : q));
      else setSavedQuotes([item, ...savedQuotes]);
    });
    if (willSave) captureBaseline();
    return willSave;
  };
  // QuotationPage에 넘길 저장 핸들러: 저장 후 기준 스냅샷 갱신(저장 직후 나가면 재확인 안 뜨게)
  const guardedSave = (cb) => {
    const willSave = quoteInput.buyerName && (quoteInput.items || []).length > 0;
    handleSaveQuote(cb);
    if (willSave) captureBaseline();
  };

  // 나가기/이동 가드: 폼에서 변경사항이 있으면 확인 모달, 없으면 즉시 실행
  const guard = (action) => {
    if (mode === 'form' && isDirty()) setPendingLeave(() => action);
    else action();
  };

  const backToList = () => guard(() => setMode('list'));
  const openNew = () => guard(() => { handleNewQuote(true); enterForm(); });
  const loadQuote = (quote) => guard(() => { setQuoteInput(normalizeQuoteMargins(quote)); enterForm(); });

  // 상단 네비 등 화면 밖으로 이탈할 때도 변경사항 확인 (App의 requestSetActiveTab이 이 가드를 통과)
  //  dep 배열 없음 → 매 렌더마다 최신 mode/quoteInput 클로저로 갱신, 언마운트 시 해제
  useEffect(() => {
    if (!navGuardRef) return;
    navGuardRef.current = (proceed) => {
      if (mode === 'form' && isDirty()) setPendingLeave(() => proceed);
      else proceed();
    };
    return () => { if (navGuardRef) navGuardRef.current = null; };
  });

  // 히스토리의 '수정/복제'는 setActiveTab('quotation') 호출 → 폼 진입으로 가로채기(기준 캡처 포함)
  const historySetActiveTab = (tab) => {
    if (tab === 'quotation') enterForm();
    else if (setActiveTab) setActiveTab(tab);
  };

  // 확인 모달 액션들
  const closeGuard = () => setPendingLeave(null);
  const guardSaveAndLeave = () => {
    if (!quoteInput.buyerName || !(quoteInput.items || []).length) {
      showToast && showToast('바이어 이름과 품목이 있어야 저장할 수 있어요.', 'error');
      return;
    }
    persistQuote();
    const act = pendingLeave;
    setPendingLeave(null);
    act && act();
  };
  const guardLeaveWithoutSave = () => {
    const act = pendingLeave;
    setPendingLeave(null);
    act && act();
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

  // ── 변경사항 확인 모달 ──
  const leaveGuardModal = pendingLeave && (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeGuard}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-1">변경사항이 있습니다</h3>
        <p className="text-sm text-slate-500 mb-5">작성 중인 견적서에 저장하지 않은 변경사항이 있어요. 저장할까요?</p>
        <div className="flex flex-col gap-2">
          <button onClick={guardSaveAndLeave} className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> 저장하고 나가기
          </button>
          <div className="flex gap-2">
            <button onClick={guardLeaveWithoutSave} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <LogOut className="w-4 h-4" /> 저장 안 함
            </button>
            <button onClick={closeGuard} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <X className="w-4 h-4" /> 계속 편집
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 기본: 견적 히스토리 전체 표 ──
  if (mode === 'list') {
    return (
      <>
        <QuoteHistoryPage
          {...props}
          setActiveTab={historySetActiveTab}
          onNewQuote={openNew}
        />
        {leaveGuardModal}
      </>
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
            className={`w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-indigo-50/60 transition-colors ${String(quoteInput.id) === String(q.id) ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'border-l-[3px] border-l-transparent'}`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[13px] font-bold text-slate-800 truncate uppercase">{q.buyerName || '(바이어 미입력)'}</span>
              {marketBadge(q.marketType)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
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
          <QuotationPage
            {...props}
            handleNewQuote={openNew}
            handleSaveQuote={guardedSave}
            onBackToList={backToList}
          />
        </div>
      </div>
      {leaveGuardModal}
    </div>
  );
};
