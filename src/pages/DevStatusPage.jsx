import React, { useState, useMemo, useRef } from 'react';
import { Activity, Edit2, ChevronDown, ChevronUp, ArrowRight, FileText, Plus, X, Check, Trash2, Search, Printer, Clock, AlertTriangle, Link, XCircle, ChevronRight, CheckCircle2, Archive, LayoutGrid, List, Flame, Hourglass, Sparkles } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS, DEV_REQUEST_STATUS_LABELS, DEV_REQUEST_STATUS_BADGE_CLS } from '../constants/common';
import { num } from '../utils/helpers';
import { DesignStepper } from '../components/design/DesignStepper';
import { DevReqSummaryCard } from '../components/dashboard/DevReqSummaryCard';
import { DevRequestFormModal } from '../components/dashboard/DevRequestFormModal';
import { DevArchiveModal } from '../components/dashboard/DevArchiveModal';
import { SearchableSelect } from '../components/common/SearchableSelect';

// 단계 진입 날짜 → "MM/DD · N일째" 포맷
const formatStageEntry = (iso) => {
  if (!iso) return null;
  const t = new Date(iso); if (isNaN(t)) return null;
  const days = Math.floor((new Date().setHours(0,0,0,0) - new Date(t).setHours(0,0,0,0)) / 86400000);
  const mm = String(t.getMonth()+1).padStart(2,'0');
  const dd = String(t.getDate()).padStart(2,'0');
  return `${mm}/${dd} · ${days === 0 ? '오늘' : `${days}일째`}`;
};

/**
 * [생산 관리자 관점] 통합 개발 현황 대시보드
 * 의뢰 접수부터 설계서 작성, 샘플 생산, 아이템화까지 하나의 파이프라인으로 관리
 */
export const DevStatusPage = ({
  devRequests, designSheets, devInput, editingDevId,
  handleDevChange, handleSpecChange, handleSaveDevRequest,
  handleEditDevRequest, handleDeleteDevRequest, resetDevForm,
  createDesignSheetFromDev, initFromDevRequest, updateDevStatus,
  handleEditSheet, handleDeleteSheet, advanceStage, advanceToEztex, autoAdvanceEztex, dropDesignSheet,
  setActiveTab, user, buyers, yarnLibrary, viewMode, devPrintRef,
  addMasterItem, generateDevOrderNo, setIsBuyerModalOpen,
  setIsDesignSheetModalOpen
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [printType, setPrintType] = useState('report');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  // [신규] 컴팩트 모드 토글 (localStorage 보존)
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem('devStatusCompactMode') === '1'; } catch { return false; }
  });
  const toggleCompact = () => {
    setCompactMode(v => {
      const next = !v;
      try { localStorage.setItem('devStatusCompactMode', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  // [신규] 우선순위 필터 (요약바 카드 클릭 시): 'all' | 'overdue' | 'urgent' | 'newToday'
  const [priorityFilter, setPriorityFilter] = useState('all');
  // EZ-TEX O/D NO. 인라인 입력용 ref 저장소
  const eztexInputRefs = useRef({});

  const statusLabels = DEV_REQUEST_STATUS_LABELS;
  const statusCls = DEV_REQUEST_STATUS_BADGE_CLS;

  const getDaysUntil = (d) => { if(!d) return null; const t=new Date(d),n=new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t-n)/864e5); };
  
  // 납기 뱃지 표시 로직 (D+1 이상은 강조 경고)
  const deadlineBadge = (d) => {
    const v=getDaysUntil(d); if(v===null) return null;
    if(v<0) return { t:`D+${-v} 지연!`, c:'bg-red-500 text-white shadow-sm ring-2 ring-red-200 animate-pulse', urgent: true };
    if(v===0) return { t:'Today 마감', c:'bg-red-500 text-white shadow-sm', urgent: true };
    if(v<=3) return { t:`D-${v} 임박`, c:'bg-orange-100 text-orange-700 border border-orange-300 font-bold' };
    return { t:`D-${v}`, c:'bg-slate-100 text-slate-600 border border-slate-300' };
  };

  // 데이터 분류
  const pendingDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='pending'||d.status==='analyzing'), [devRequests]);
  const confirmedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='confirmed'), [devRequests]);
  const rejectedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='rejected'), [devRequests]);

  const activeSheets = useMemo(() => (designSheets||[]).filter(s=>s.status!=='dropped').sort((a,b)=> {
    // 납기 임박순 1차 정렬, 업데이트순 2차 정렬
    const da = getDaysUntil(a.deadline) ?? 9999;
    const db = getDaysUntil(b.deadline) ?? 9999;
    if (da !== db) return da - db;
    return (b.updatedAt||'').localeCompare(a.updatedAt||'');
  }), [designSheets]);

  // 스테이지별 설계서 분류
  const sheetsByStage = useMemo(() => {
    const grouped = { draft: [], eztex: [], sampling: [], articled: [] };
    activeSheets.forEach(s => { if(grouped[s.stage]) grouped[s.stage].push(s); });
    return grouped;
  }, [activeSheets]);

  // [신규] 보관함 대상 분류
  const confirmedLinkedDevs = useMemo(
    () => confirmedDevReqs.filter(d => {
      if (d.linkedDesignSheetId) return true;
      return (designSheets||[]).some(s => s.devRequestId === d.id && s.status !== 'dropped');
    }),
    [confirmedDevReqs, designSheets]
  );
  const articledSheets = sheetsByStage.articled;
  const archiveCount = rejectedDevReqs.length + confirmedLinkedDevs.length + articledSheets.length;

  // 메인 칸반에 표시할 "설계 대기" 컬럼: confirmed + 설계서 미연결
  const designPendingDevs = useMemo(
    () => confirmedDevReqs.filter(d => !d.linkedDesignSheetId &&
      !(designSheets||[]).some(s => s.devRequestId === d.id && s.status !== 'dropped')),
    [confirmedDevReqs, designSheets]
  );

  // [신규] 카드 우선순위 계산 (의뢰/설계서 공통)
  const getDevReqDeadline = (d) =>
    (d.status === 'pending' || d.status === 'analyzing') ? d.targetSpec?.analysisDeadline
    : (d.status === 'hold' || d.status === 'confirmed') ? d.targetSpec?.sampleDeadline
    : null;
  const getUrgency = (deadlineDate) => {
    const days = getDaysUntil(deadlineDate);
    if (days === null) return 'normal';
    if (days < 0) return 'overdue';
    if (days <= 3) return 'urgent';
    return 'normal';
  };
  const getDevReqUrgency = (d) => getUrgency(getDevReqDeadline(d));
  const getSheetUrgency = (s) => getUrgency(s.deadline);

  // [신규] 오늘 신규 등록 (createdAt 기준)
  const isCreatedToday = (iso) => {
    if (!iso) return false;
    const t = new Date(iso); const n = new Date();
    return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
  };

  // [신규] 메인에 노출되는 "진행중" 카드 (의뢰 + 설계서)
  const allActiveItems = useMemo(() => {
    const reqs = (devRequests||[]).filter(d => ['pending','analyzing','hold'].includes(d.status))
      .concat(designPendingDevs)
      .map(d => ({ kind: 'devReq', item: d, urgency: getDevReqUrgency(d) }));
    const sheets = activeSheets.filter(s => s.stage !== 'articled')
      .map(s => ({ kind: 'sheet', item: s, urgency: getSheetUrgency(s) }));
    return [...reqs, ...sheets];
  }, [devRequests, designPendingDevs, activeSheets]);

  // [신규] 요약바 메트릭
  const metrics = useMemo(() => ({
    total: allActiveItems.length,
    overdue: allActiveItems.filter(x => x.urgency === 'overdue').length,
    urgent: allActiveItems.filter(x => x.urgency === 'urgent').length,
    newToday: (devRequests||[]).filter(d => isCreatedToday(d.createdAt)).length
  }), [allActiveItems, devRequests]);

  // [신규] 우선순위 필터 적용 (priorityFilter에 따라 카드 솎기)
  const passesPriority = (urgency, item) => {
    if (priorityFilter === 'all') return true;
    if (priorityFilter === 'overdue') return urgency === 'overdue';
    if (priorityFilter === 'urgent') return urgency === 'urgent';
    if (priorityFilter === 'newToday') return isCreatedToday(item?.createdAt);
    return true;
  };

  const pipelineCounts = {
    requests: pendingDevReqs.length,
    confirmedReqs: confirmedDevReqs.length, // 설계서 미연결
    draft: sheetsByStage.draft.length,
    eztex: sheetsByStage.eztex.length,
    sampling: sheetsByStage.sampling.length,
    articled: sheetsByStage.articled.length
  };

  const getYarnName = (id) => { if(!id) return ''; return (yarnLibrary||[]).find(y=>String(y.id)===String(id).split('::')[0])?.name||''; };
  const getComp = (yarns) => (yarns||[]).filter(y=>y?.yarnId&&Number(y.ratio)>0).map(y=>`${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ')||'-';
  
  const getLinkedSheet = (devReq) => {
    if (!devReq) return null;
    if (devReq.linkedDesignSheetId) return (designSheets||[]).find(s => s.id === devReq.linkedDesignSheetId) || null;
    return (designSheets||[]).find(s => s.devRequestId === devReq.id) || null;
  };
  const getLinkedDev = (devReqId) => (devRequests||[]).find(d=>d.id===devReqId);
  
  const filterSearch = (items) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(d => {
      const buyerMatch = String(d.buyerName || '').toLowerCase().includes(q);
      const orderMatch = String(d.devOrderNo || '').toLowerCase().includes(q);
      const fabricMatch = String(d.fabricName || '').toLowerCase().includes(q);
      return buyerMatch || orderMatch || fabricMatch;
    });
  };

  // 설계서 작성 시작 → 의뢰 정보로 설계서 모달을 그 자리에서 바로 오픈
  // (가로카드를 통한 진입점이 사라졌으므로 카드의 "설계서 작성" 버튼이 모달을 직접 연다)
  const handleGoToSheet = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    if (setIsDesignSheetModalOpen) {
      setIsDesignSheetModalOpen(true);
    } else {
      // fallback: 모달 prop이 없으면 보관함 탭으로 이동
      setActiveTab('designList');
    }
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };

  const handleModalSave = () => {
    if (handleSaveDevRequest(user)) setShowDevModal(false);
  };

  // 의뢰접수(pending) 상태에서 Print 시 자동으로 분석중(analyzing)으로 전환
  const handlePrint = (devReq, type) => {
    if (devReq.status === 'pending' && updateDevStatus) {
      updateDevStatus(devReq.id, 'analyzing');
    }
    setPrintTarget(devReq);
    setPrintType(type);
    setTimeout(()=>window.print(), 300);
  };
  const stageInfo = (key) => { const s=DESIGN_STAGES.find(x=>x.key===key); const c=STAGE_COLORS[key]||STAGE_COLORS.draft; return {label:s?.label||'작성중',...c}; };

  // ==========================================

  const renderCard = (d) => {
    const urgency = getDevReqUrgency(d);
    if (!passesPriority(urgency, d)) return null;
    return (
      <DevReqSummaryCard
        key={d.id}
        d={d}
        statusCls={statusCls}
        statusLabels={statusLabels}
        deadlineBadge={deadlineBadge}
        getLinkedSheet={getLinkedSheet}
        updateDevStatus={updateDevStatus}
        openEditModal={openEditModal}
        handleDeleteDevRequest={handleDeleteDevRequest}
        handlePrint={handlePrint}
        handleGoToSheet={handleGoToSheet}
        compact={compactMode}
        urgency={urgency}
      />
    );
  };

  // [신규] 컬럼별 지연 카운트 헬퍼
  const countOverdueDev = (items) => items.filter(d => getDevReqUrgency(d) === 'overdue').length;
  const countOverdueSheet = (items) => items.filter(s => getSheetUrgency(s) === 'overdue').length;



  return (
    <div>
      <div className="space-y-6 print:hidden">
        {/* 🚀 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200"><Activity className="w-6 h-6 text-white"/></div>
            개발의뢰 현황
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">의뢰 접수부터 설계, 생산, 아이템화까지 하나의 흐름으로 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* 검색바 */}
          <div className="relative flex-1 min-w-[200px] md:max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="바이어/개발번호/원단명 검색..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 transition-shadow"
            />
          </div>
          {/* 컴팩트 모드 토글 */}
          <button onClick={toggleCompact}
            className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-bold rounded-lg transition-colors ${compactMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            title={compactMode ? '표준 보기로 전환' : '컴팩트 보기로 전환 (한 화면에 더 많이 보기)'}
          >
            {compactMode ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            {compactMode ? '컴팩트' : '표준'}
          </button>
          {/* 보관함 버튼 */}
          <button onClick={() => setIsArchiveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
            title="Drop된 의뢰 / 진행중(설계서 연결됨) / 아이템화 완료 항목 보기"
          >
            <Archive className="w-3.5 h-3.5" /> 보관함
            {archiveCount > 0 && (
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{archiveCount}</span>
            )}
          </button>
          <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5"/> 새 의뢰 등록
          </button>
        </div>
      </div>

      {/* 📊 [신규] 파이프라인 요약 바 — 위급 상황 한눈에 파악 + 클릭 시 필터링 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <SummaryCard
          icon={Activity}
          label="진행중"
          value={metrics.total}
          tone="slate"
          active={priorityFilter === 'all'}
          onClick={() => setPriorityFilter('all')}
          subtext="전체 활성 카드"
        />
        <SummaryCard
          icon={Flame}
          label="지연"
          value={metrics.overdue}
          tone="rose"
          active={priorityFilter === 'overdue'}
          onClick={() => setPriorityFilter(priorityFilter === 'overdue' ? 'all' : 'overdue')}
          subtext="납기 초과"
        />
        <SummaryCard
          icon={Hourglass}
          label="임박"
          value={metrics.urgent}
          tone="orange"
          active={priorityFilter === 'urgent'}
          onClick={() => setPriorityFilter(priorityFilter === 'urgent' ? 'all' : 'urgent')}
          subtext="D-3 이내"
        />
        <SummaryCard
          icon={Sparkles}
          label="오늘 신규"
          value={metrics.newToday}
          tone="blue"
          active={priorityFilter === 'newToday'}
          onClick={() => setPriorityFilter(priorityFilter === 'newToday' ? 'all' : 'newToday')}
          subtext="오늘 등록된 의뢰"
        />
      </div>

      {/* 📊 2. 의뢰 칸반 (4컬럼) — 진행 중인 의뢰만 표시. Drop / 설계서 연결됨은 보관함으로 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-start">
         {/* 의뢰 접수 (pending) */}
         {(() => {
           const items = filterSearch(devRequests.filter(d=>d.status==='pending'));
           const overdue = countOverdueDev(items);
           return (
             <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] flex flex-col">
                <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-amber-300 pb-1.5 shrink-0">
                   <span className="flex items-center gap-1.5">
                     의뢰 접수 <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px]">{items.length}</span>
                   </span>
                   {overdue > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>{overdue}</span>}
                </h3>
                <div className={`${compactMode ? 'space-y-1' : 'space-y-2'} overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-280px)]`}>
                   {items.map(d => renderCard(d))}
                </div>
             </div>
           );
         })()}

         {/* 분석중 (analyzing) */}
         {(() => {
           const items = filterSearch(devRequests.filter(d=>d.status==='analyzing'));
           const overdue = countOverdueDev(items);
           return (
             <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] flex flex-col">
                <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-blue-300 pb-1.5 shrink-0">
                   <span className="flex items-center gap-1.5">
                     분석 중 <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[9px]">{items.length}</span>
                   </span>
                   {overdue > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>{overdue}</span>}
                </h3>
                <div className={`${compactMode ? 'space-y-1' : 'space-y-2'} overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-280px)]`}>
                   {items.map(d => renderCard(d))}
                </div>
             </div>
           );
         })()}

         {/* 대기중 (hold) */}
         {(() => {
           const items = filterSearch(devRequests.filter(d=>d.status==='hold'));
           const overdue = countOverdueDev(items);
           return (
             <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] flex flex-col">
                <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-purple-300 pb-1.5 shrink-0">
                   <span className="flex items-center gap-1.5">
                     대기중 <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[9px]">{items.length}</span>
                   </span>
                   {overdue > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>{overdue}</span>}
                </h3>
                <div className={`${compactMode ? 'space-y-1' : 'space-y-2'} overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-280px)]`}>
                   {items.map(d => renderCard(d))}
                </div>
             </div>
           );
         })()}

         {/* 설계 대기 (confirmed + 설계서 미연결) */}
         {(() => {
           const items = filterSearch(designPendingDevs);
           const overdue = countOverdueDev(items);
           return (
             <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] flex flex-col">
                <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-emerald-300 pb-1.5 shrink-0">
                   <span className="flex items-center gap-1.5">
                     설계 대기 <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[9px]" title="개발투입확정 + 설계서 미작성">{items.length}</span>
                   </span>
                   {overdue > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>{overdue}</span>}
                </h3>
                <div className={`${compactMode ? 'space-y-1' : 'space-y-2'} overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-280px)]`}>
                   {items.map(d => renderCard(d))}
                </div>
             </div>
           );
         })()}
      </div>

      {/* 두 칸반 사이 흐름 안내 — "의뢰" → "설계서" 한 파이프라인이라는 시각 신호 */}
      {activeSheets.length > 0 && (
        <div className="flex items-center gap-3 my-1 select-none">
          <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 via-violet-200 to-transparent"></div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full">
            <ArrowRight className="w-3 h-3"/> 설계 단계로 진행
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-violet-200 via-violet-200 to-transparent"></div>
        </div>
      )}

      {/* 📋 설계서 단계 현황 — 단계별 칸반 그룹 (아이템화는 보관함으로 이동, 3컬럼) */}
      {(() => {
        // [D2 최적화] 상단 useMemo에서 이미 계산한 sheetsByStage를 사용 (이중 계산 제거)
        if (activeSheets.length === 0) return null;

        const stageStyle = {
          draft: { borderLine: 'border-slate-400', badgeInfo: 'bg-slate-200 text-slate-800' },
          eztex: { borderLine: 'border-violet-300', badgeInfo: 'bg-violet-100 text-violet-700' },
          sampling: { borderLine: 'border-amber-300', badgeInfo: 'bg-amber-100 text-amber-700' }
        };

        // articled는 보관함으로 분리 → 메인 칸반에서 제외
        const visibleStages = DESIGN_STAGES.filter(s => s.key !== 'articled');

        // 검색 필터 — 설계서용
        const filterSheet = (sheets) => {
          if (!searchTerm.trim()) return sheets;
          const q = searchTerm.toLowerCase();
          return sheets.filter(s => {
            const linkedDev = getLinkedDev(s.devRequestId);
            return String(s.fabricName||'').toLowerCase().includes(q)
              || String(s.devOrderNo||'').toLowerCase().includes(q)
              || String(s.articleNo||'').toLowerCase().includes(q)
              || String(s.eztexOrderNo||'').toLowerCase().includes(q)
              || String(linkedDev?.buyerName||'').toLowerCase().includes(q);
          });
        };

        return (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 mb-2">
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 rounded-lg text-white shadow-lg shadow-violet-200">
                <FileText className="w-4 h-4"/>
              </div>
              설계서 단계 현황
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-start">
              {visibleStages.map(stage => {
                const itemsAll = filterSheet(sheetsByStage[stage.key] || []);
                // 우선순위 필터 적용
                const items = itemsAll.filter(s => passesPriority(getSheetUrgency(s), s));
                const overdue = countOverdueSheet(itemsAll);
                const style = stageStyle[stage.key];
                return (
                  <div key={stage.key} className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] flex flex-col">
                    {/* 칼럼 헤더 (상단 칸반과 동일한 구조) */}
                    <h3 className={`flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 ${style.borderLine} pb-1.5 shrink-0`}>
                      <span className="flex items-center gap-1.5">
                        {stage.label} <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${style.badgeInfo}`}>{itemsAll.length}</span>
                      </span>
                      {overdue > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>{overdue}</span>}
                    </h3>

                    {/* 아이템 목록 */}
                    <div className={`${compactMode ? 'space-y-1' : 'space-y-2'} overflow-y-auto custom-scrollbar pr-1 pb-2 max-h-[calc(100vh-280px)]`}>
                      {items.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8 font-medium">항목 없음</p>
                      ) : items.map(s => {
                        const linkedDev = getLinkedDev(s.devRequestId);
                        const db = deadlineBadge(s.deadline);
                        const stageEntry = formatStageEntry(s.stageEnteredAt?.[s.stage] || s.updatedAt);
                        const sheetUrgency = getSheetUrgency(s);
                        const sheetBorderCls = sheetUrgency === 'overdue' ? 'border-l-4 border-l-rose-500'
                          : sheetUrgency === 'urgent' ? 'border-l-4 border-l-orange-400' : '';
                        const sheetBgCls = sheetUrgency === 'overdue' ? 'bg-rose-50/40' : 'bg-white';

                        // 컴팩트 모드 카드
                        if (compactMode) {
                          return (
                            <div key={s.id} onClick={() => handleEditSheet?.(s)}
                              className={`${sheetBgCls} rounded-md ${sheetBorderCls} border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow transition-all px-2 py-1.5 cursor-pointer flex items-center gap-1.5 text-[11px]`}>
                              <span className="font-mono font-extrabold text-violet-600 shrink-0">{s.devOrderNo || '자체'}</span>
                              <span className="font-bold text-slate-700 truncate flex-1 uppercase">{s.fabricName || '원단명 미입력'}</span>
                              {db && <span className={`text-[9px] rounded px-1 py-0.5 whitespace-nowrap leading-none shrink-0 ${db.c}`}>{db.t}</span>}
                            </div>
                          );
                        }
                        return (
                          <div key={s.id} className={`${sheetBgCls} hover:bg-slate-50 rounded-xl ${sheetBorderCls} border border-slate-200 hover:border-blue-300 shadow-sm p-3.5 cursor-pointer transition-all flex flex-col gap-2.5 relative group`}
                            onClick={() => handleEditSheet?.(s)}>
                            {/* 상단 뱃지 / 디데이 */}
                            <div className="flex items-start justify-between">
                              <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded-md border border-violet-100 shrink-0">{s.devOrderNo || '자체 설계'}</span>
                              <div className="flex flex-col items-end gap-1">
                                {db && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shadow-sm ${db.c}`}><Clock className="w-2.5 h-2.5 inline mr-0.5"/>{db.t}</span>}
                              </div>
                            </div>

                            {/* 메인 정보 (원단명) */}
                            <div>
                              <h4 className="text-[15px] font-extrabold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors uppercase">{s.fabricName || '원단명 미입력'}</h4>
                              {/* 꼬리표 정보 */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {linkedDev?.buyerName && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{linkedDev.buyerName}</span>}
                                {s.articleNo && <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-100">{s.articleNo}</span>}
                              </div>
                              {/* 단계 진입 날짜 */}
                              {stageEntry && (
                                <div className="text-[9px] text-slate-400 font-medium mt-1.5" title={`${stage.label} 진입`}>
                                  📅 {stageEntry}
                                </div>
                              )}
                            </div>

                            {/* EZ-TEX 단계: 인라인 O/D NO. 입력 */}
                            {stage.key === 'eztex' && (
                              <div className="mt-1 flex items-center gap-1.5 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                <input
                                  ref={el => { eztexInputRefs.current[s.id] = el; }}
                                  type="text"
                                  placeholder="EZTEX O/D 입고용 입력"
                                  defaultValue={s.eztexOrderNo || ''}
                                  className="flex-1 w-0 border border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none transition-all placeholder:text-slate-300"
                                  onKeyDown={e => { if (e.key === 'Enter') { const val = eztexInputRefs.current[s.id]?.value?.trim(); if (val) autoAdvanceEztex(s.id, val); }}}
                                />
                                <button
                                  onClick={() => { const val = eztexInputRefs.current[s.id]?.value?.trim(); if (val) autoAdvanceEztex(s.id, val); else alert('O/D NO.를 입력해주세요.'); }}
                                  className="px-2.5 py-1.5 bg-violet-600 text-white text-[10px] font-bold rounded hover:bg-violet-700 active:scale-95 transition-all shadow-sm shrink-0 whitespace-nowrap"
                                >
                                  등록
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      {/* [R4] 의뢰 등록/수정 모달 — 분리된 컴포넌트 호출 */}
      <DevRequestFormModal
        isOpen={showDevModal}
        onClose={() => setShowDevModal(false)}
        editingDevId={editingDevId}
        devInput={devInput}
        handleDevChange={handleDevChange}
        handleSpecChange={handleSpecChange}
        onSave={handleModalSave}
        buyers={buyers}
        setIsBuyerModalOpen={setIsBuyerModalOpen}
        generateDevOrderNo={generateDevOrderNo}
      />

      {/* [신규] 통합 보관함 모달 */}
      <DevArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        rejectedDevs={rejectedDevReqs}
        confirmedLinkedDevs={confirmedLinkedDevs}
        articledSheets={articledSheets}
        designSheets={designSheets}
        updateDevStatus={updateDevStatus}
        handleEditSheet={handleEditSheet}
        statusLabels={statusLabels}
        statusCls={statusCls}
      />
      </div>

      {/* 편직처 제출용 프린트 영역 (화면에선 숨김, 프린트 시에만 표시) */}
      <div className="hidden print:block font-sans">
        <div ref={devPrintRef} className="w-[210mm] h-[290mm] mx-auto bg-white text-slate-800 p-8 box-border relative font-sans">
          {printTarget && (
            <div className="w-full h-full border-2 border-slate-200 rounded-3xl p-8 flex flex-col shadow-sm">
              {/* 1. Header */}
              <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">개발 의뢰서</h1>
                  <p className="text-slate-400 text-xs mt-1.5 tracking-widest uppercase font-bold">Development Request Sheet</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Number / O.D</span>
                  <span className="text-xl font-mono font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">{printTarget.devOrderNo || 'N/A'}</span>
                </div>
              </div>

              {/* 2. Top Info Grid */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">받은 날짜</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.requestDate || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">요청 업체</p>
                  <p className="font-extrabold text-slate-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{printTarget.buyerName || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">담당자</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.assignee || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] text-red-500 font-bold mb-1">요청 납기</p>
                  <p className="font-bold text-red-600 text-sm">{printTarget.targetSpec?.analysisDeadline || printTarget.targetSpec?.deliveryDate || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">생산 납기</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.targetSpec?.sampleDeadline || '-'}</p>
                </div>
              </div>

              {/* 3. Sample Attachment Area (Flex Grow) */}
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center bg-slate-50/50 mb-6 relative overflow-hidden">
                <div className="opacity-20"><FileText className="w-16 h-16 text-slate-400 mb-4" /></div>
                <span className="font-black text-4xl tracking-widest text-slate-200">ATTACH SAMPLE</span>
                <p className="text-slate-400 text-sm mt-3 font-medium">이곳에 스와치를 부착해주세요 (최소 9x9cm 권장)</p>
                {printTarget.swatchNote && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm max-w-[80%]">
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2">📌 <span>{printTarget.swatchNote}</span></p>
                  </div>
                )}
              </div>

              {/* 4. Specifications & Notes (Two Columns) */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-slate-800 border-b-2 border-slate-800 pb-2 flex items-center gap-2 tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>SPECIFICATION
                  </h3>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">혼용률/스펙</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.composition || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">폭/중량</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.widthWeight || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">단가</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.targetPrice || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start pb-1">
                       <span className="text-xs font-bold text-slate-500 w-1/3">느낌/터치</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.feeling || printTarget.targetSpec?.touch || '-'}</span>
                     </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-slate-800 border-b-2 border-slate-800 pb-2 flex items-center gap-2 tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>ITEM NOTES
                  </h3>
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex-1 h-[146px] shadow-sm">
                     <p className="text-[10px] font-extrabold text-emerald-800/60 mb-1.5 uppercase tracking-widest">Detail & Feature</p>
                     <p className="font-semibold text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                        {printTarget.devItem ? `[ITEM] ${printTarget.devItem}\n` : ''}
                        {printTarget.targetSpec?.customerNotes || '등록된 특이사항이 없습니다.'}
                     </p>
                  </div>
                </div>
              </div>

              {/* 5. Footer Notes */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
                <h3 className="text-xs font-extrabold text-slate-800 mb-2.5 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> 영업자 추가 의뢰사항
                </h3>
                <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[40px]">
                  {printTarget.targetSpec?.otherRequests || '추가 요청사항 없음'}
                </p>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 상단 파이프라인 요약 카드 — 클릭 시 우선순위 필터 토글
const SummaryCard = ({ icon: Icon, label, value, tone, active, onClick, subtext }) => {
  const tones = {
    slate:  { ring: 'ring-slate-300',  bgActive: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',   value: 'text-slate-800' },
    rose:   { ring: 'ring-rose-300',   bgActive: 'bg-rose-50',    icon: 'bg-rose-100 text-rose-600',     value: 'text-rose-700' },
    orange: { ring: 'ring-orange-300', bgActive: 'bg-orange-50',  icon: 'bg-orange-100 text-orange-600', value: 'text-orange-700' },
    blue:   { ring: 'ring-blue-300',   bgActive: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',     value: 'text-blue-700' }
  };
  const t = tones[tone] || tones.slate;
  return (
    <button
      onClick={onClick}
      className={`group relative bg-white rounded-xl border border-slate-200 p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${active ? `ring-2 ${t.ring} ${t.bgActive}` : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-extrabold leading-none ${t.value}`}>{value}</span>
            <span className="text-[10px] font-bold text-slate-500">건</span>
          </div>
          <div className="text-[11px] font-bold text-slate-700 mt-0.5">{label}</div>
          {subtext && <div className="text-[9px] text-slate-400 truncate">{subtext}</div>}
        </div>
      </div>
    </button>
  );
};
