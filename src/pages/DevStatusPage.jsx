import React, { useState, useMemo, useRef } from 'react';
import { Activity, Edit2, FileText, Plus, Search, Printer, Archive, ArrowRight, XCircle, Flame, Hourglass, Sparkles, ClipboardList, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { DEV_REQUEST_STATUS_LABELS, DEV_REQUEST_STATUS_BADGE_CLS } from '../constants/common';
import { PendingProgressBar } from '../components/design-sheet/PendingProgressBar';
import { DevRequestFormModal } from '../components/dashboard/DevRequestFormModal';
import { DevArchiveModal } from '../components/dashboard/DevArchiveModal';

// 개발 의뢰 단계 설명 (바이어 의뢰 접수~개발 가능 여부 확인까지)
const DEV_REQ_STAGE_GUIDE = [
  { key: 'pending',   label: '의뢰 접수', desc: '바이어로부터 개발 의뢰서 접수 완료, 분석 전 상태', dot: 'bg-amber-400' },
  { key: 'analyzing', label: '분석 중',   desc: '의뢰 내용 분석 (맞는 원사·편직기·단가 검토 진행)', dot: 'bg-blue-400' },
  { key: 'hold',      label: '대기 중',   desc: '분석 완료, 개발 진행 여부 최종 결정 대기', dot: 'bg-purple-400' }
];

// 설계서 단계 설명 (개발 확정 / 자체 개발 → 아이템화)
const DESIGN_STAGE_GUIDE = [
  { key: 'draft',    label: '설계서 작성',     desc: '원단 설계서 초안 작성 (스펙·원사 배합 등)',          dot: 'bg-slate-400' },
  { key: 'eztex',    label: 'EZ-TEX O/D NO.', desc: '작성된 설계서를 EZ-TEX(그루빅 생산 ERP)에 오더 등록', dot: 'bg-violet-400' },
  { key: 'sampling', label: '샘플 진행',       desc: '생산 진행 중 (원사 발주, 편직, 염가공 등)',          dot: 'bg-amber-400' },
  { key: 'articled', label: '아이템화',        desc: '완성된 원단 설계서를 정식 등록 (최종, 보관함 이동)',  dot: 'bg-emerald-500' }
];

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
 * 개발/설계 현황 — 리스트형 대시보드
 * - 섹션 A: 개발 의뢰 현황 (pending/analyzing/hold + 확정-설계서미연결)
 * - 섹션 B: 설계서 진행 현황 (draft/eztex/sampling)
 * - 아이템화 완료된 설계서는 [설계서 보관함] 페이지에서 관리
 */
export const DevStatusPage = ({
  devRequests, designSheets, devInput, editingDevId,
  handleDevChange, handleSpecChange, handleSaveDevRequest,
  handleEditDevRequest, handleDeleteDevRequest, resetDevForm,
  createDesignSheetFromDev, initFromDevRequest, updateDevStatus,
  handleEditSheet, handleDeleteSheet, saveDocToCloud, setStage, dropDesignSheet,
  setActiveTab, user, buyers, yarnLibrary, viewMode, devPrintRef,
  addMasterItem, generateDevOrderNo, setIsBuyerModalOpen,
  setIsDesignSheetModalOpen
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [printType, setPrintType] = useState('report');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showGuide, setShowGuide] = useState(false);
  const [devSortBy, setDevSortBy] = useState('date');   // date | stage | buyer
  const [sheetSortBy, setSheetSortBy] = useState('date'); // date | stage | buyer
  const eztexInputRefs = useRef({});

  const statusLabels = DEV_REQUEST_STATUS_LABELS;
  const statusCls = DEV_REQUEST_STATUS_BADGE_CLS;

  const getDaysUntil = (d) => { if(!d) return null; const t=new Date(d),n=new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t-n)/864e5); };

  const deadlineBadge = (d) => {
    const v=getDaysUntil(d); if(v===null) return null;
    if(v<0) return { t:`D+${-v} 지연`, c:'bg-red-500 text-white' };
    if(v===0) return { t:'Today', c:'bg-red-500 text-white' };
    if(v<=3) return { t:`D-${v} 임박`, c:'bg-orange-100 text-orange-700 border border-orange-300' };
    return { t:`D-${v}`, c:'bg-slate-100 text-slate-600 border border-slate-300' };
  };

  // 경과일 계산 (updatedAt 기준)
  const daysSince = (iso) => {
    if (!iso) return null;
    const t = new Date(iso); const n = new Date();
    return Math.floor((n - t) / 86400000);
  };

  // 데이터 분류
  const confirmedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='confirmed'), [devRequests]);
  const rejectedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='rejected'), [devRequests]);

  const activeSheets = useMemo(() => (designSheets||[]).filter(s=>s.status!=='dropped').sort((a,b)=> {
    const da = getDaysUntil(a.deadline) ?? 9999;
    const db = getDaysUntil(b.deadline) ?? 9999;
    if (da !== db) return da - db;
    return (b.updatedAt||'').localeCompare(a.updatedAt||'');
  }), [designSheets]);

  const sheetsByStage = useMemo(() => {
    const grouped = { draft: [], eztex: [], sampling: [], articled: [] };
    activeSheets.forEach(s => { if(grouped[s.stage]) grouped[s.stage].push(s); });
    return grouped;
  }, [activeSheets]);

  const confirmedLinkedDevs = useMemo(
    () => confirmedDevReqs.filter(d => {
      if (d.linkedDesignSheetId) return true;
      return (designSheets||[]).some(s => s.devRequestId === d.id && s.status !== 'dropped');
    }),
    [confirmedDevReqs, designSheets]
  );
  const articledSheets = sheetsByStage.articled;
  const archiveCount = rejectedDevReqs.length + confirmedLinkedDevs.length + articledSheets.length;

  // confirmed 이지만 설계서 미연결 → "설계 대기" (의뢰 리스트에 포함)
  const designPendingDevs = useMemo(
    () => confirmedDevReqs.filter(d => !d.linkedDesignSheetId &&
      !(designSheets||[]).some(s => s.devRequestId === d.id && s.status !== 'dropped')),
    [confirmedDevReqs, designSheets]
  );

  // 우선순위 (지연/임박/오늘 신규)
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

  const isCreatedToday = (iso) => {
    if (!iso) return false;
    const t = new Date(iso); const n = new Date();
    return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
  };

  // 의뢰 리스트 데이터: pending/analyzing/hold + confirmed(설계서 미연결)
  const devReqItems = useMemo(() => {
    const active = (devRequests||[]).filter(d => ['pending','analyzing','hold'].includes(d.status));
    return [...active, ...designPendingDevs];
  }, [devRequests, designPendingDevs]);

  // 설계서 리스트 데이터: articled 제외
  const sheetItems = useMemo(() =>
    activeSheets.filter(s => s.stage !== 'articled')
  , [activeSheets]);

  const passesPriority = (urgency, item) => {
    if (priorityFilter === 'all') return true;
    if (priorityFilter === 'overdue') return urgency === 'overdue';
    if (priorityFilter === 'urgent') return urgency === 'urgent';
    if (priorityFilter === 'newToday') return isCreatedToday(item?.createdAt);
    return true;
  };

  // 요약 메트릭
  const metrics = useMemo(() => {
    const allItems = [
      ...devReqItems.map(d => ({ urgency: getDevReqUrgency(d), createdAt: d.createdAt })),
      ...sheetItems.map(s => ({ urgency: getSheetUrgency(s), createdAt: s.createdAt }))
    ];
    return {
      total: allItems.length,
      overdue: allItems.filter(x => x.urgency === 'overdue').length,
      urgent: allItems.filter(x => x.urgency === 'urgent').length,
      newToday: (devRequests||[]).filter(d => isCreatedToday(d.createdAt)).length
    };
  }, [devReqItems, sheetItems, devRequests]);

  // 의뢰 상태 → 통합 단계 매핑
  const devStageKey = (d) => {
    if (d.status === 'confirmed') return 'hold'; // confirmed(설계 대기) = 단계 3
    return d.status;
  };

  const getLinkedDev = (devReqId) => (devRequests||[]).find(d=>d.id===devReqId);

  const filterSearchDev = (items) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(d =>
      String(d.buyerName || '').toLowerCase().includes(q) ||
      String(d.devOrderNo || '').toLowerCase().includes(q) ||
      String(d.devItem || '').toLowerCase().includes(q) ||
      String(d.targetSpec?.composition || '').toLowerCase().includes(q)
    );
  };
  const filterSearchSheet = (items) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(s => {
      const dev = getLinkedDev(s.devRequestId);
      return String(s.fabricName||'').toLowerCase().includes(q) ||
        String(s.devOrderNo||'').toLowerCase().includes(q) ||
        String(s.articleNo||'').toLowerCase().includes(q) ||
        String(s.eztexOrderNo||'').toLowerCase().includes(q) ||
        String(dev?.buyerName||'').toLowerCase().includes(q);
    });
  };

  // 의뢰의 통합 단계 인덱스 (단계순 정렬용)
  const devStageOrder = { pending: 0, analyzing: 1, hold: 2, confirmed: 3 };
  const sheetStageOrder = { draft: 0, eztex: 1, sampling: 2, articled: 3 };

  const visibleDevReqs = useMemo(() => {
    const filtered = filterSearchDev(devReqItems).filter(d => passesPriority(getDevReqUrgency(d), d));
    const sorted = [...filtered];
    if (devSortBy === 'date') {
      sorted.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    } else if (devSortBy === 'stage') {
      sorted.sort((a, b) => (devStageOrder[a.status] ?? 99) - (devStageOrder[b.status] ?? 99));
    } else if (devSortBy === 'buyer') {
      sorted.sort((a, b) => String(a.buyerName || '').localeCompare(String(b.buyerName || ''), 'ko'));
    }
    return sorted;
  }, [devReqItems, searchTerm, priorityFilter, devSortBy]);

  const visibleSheets = useMemo(() => {
    const filtered = filterSearchSheet(sheetItems).filter(s => passesPriority(getSheetUrgency(s), s));
    const sorted = [...filtered];
    if (sheetSortBy === 'date') {
      // 등록 날짜(registeredDate) 우선, 없으면 createdAt 의 날짜 부분으로 폴백 (최신순)
      sorted.sort((a, b) => {
        const ka = a.registeredDate || (a.createdAt || '').slice(0, 10);
        const kb = b.registeredDate || (b.createdAt || '').slice(0, 10);
        return kb.localeCompare(ka);
      });
    } else if (sheetSortBy === 'stage') {
      sorted.sort((a, b) => (sheetStageOrder[a.stage] ?? 99) - (sheetStageOrder[b.stage] ?? 99));
    } else if (sheetSortBy === 'buyer') {
      sorted.sort((a, b) => {
        const da = getLinkedDev(a.devRequestId)?.buyerName || (a.devRequestId ? '' : 'zzz_자체개발');
        const db = getLinkedDev(b.devRequestId)?.buyerName || (b.devRequestId ? '' : 'zzz_자체개발');
        return String(da).localeCompare(String(db), 'ko');
      });
    }
    return sorted;
  }, [sheetItems, searchTerm, priorityFilter, sheetSortBy]);

  // 핸들러
  const handleGoToSheet = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    if (setIsDesignSheetModalOpen) setIsDesignSheetModalOpen(true);
    else setActiveTab('designList');
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };

  const handleModalSave = () => {
    if (handleSaveDevRequest(user)) setShowDevModal(false);
  };

  const handlePrint = (devReq, type) => {
    if (devReq.status === 'pending' && updateDevStatus) {
      updateDevStatus(devReq.id, 'analyzing');
    }
    setPrintTarget(devReq);
    setPrintType(type);
    setTimeout(()=>window.print(), 300);
  };

  const handleDropDev = (devReq) => {
    if (!updateDevStatus) return;
    if (window.confirm(`개발 의뢰 ${devReq.devOrderNo}를 Drop(미진행) 처리할까요?`)) {
      updateDevStatus(devReq.id, 'rejected');
    }
  };

  const handleDropSheet = (sheetId) => {
    if (dropDesignSheet) dropDesignSheet(sheetId);
  };

  // 상태별 다음 단계 액션
  const nextStatusAction = (status) => {
    if (status === 'pending') return { next: 'analyzing', label: '분석 시작' };
    if (status === 'analyzing') return { next: 'hold', label: '분석 완료' };
    if (status === 'hold') return { next: 'confirmed', label: '개발 확정' };
    return null;
  };

  const handleEztexSubmit = (sheet) => {
    const val = eztexInputRefs.current[sheet.id]?.value?.trim();
    if (!val) { alert('EZ-TEX O/D NO.를 입력해주세요.'); return; }
    if (!saveDocToCloud) return;
    saveDocToCloud('designSheets', {
      ...sheet,
      eztexOrderNo: val,
      updatedAt: new Date().toISOString()
    });
  };

  // 우선순위에 따른 행 배경/테두리
  const rowBg = (urgency) =>
    urgency === 'overdue' ? 'bg-rose-50/40 border-l-4 border-l-rose-500' :
    urgency === 'urgent' ? 'border-l-4 border-l-orange-400' : '';

  return (
    <div>
      <div className="space-y-6 print:hidden">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200"><Activity className="w-6 h-6 text-white"/></div>
              개발/설계 현황
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">의뢰 접수부터 설계, 샘플 진행까지 한 곳에서 관리합니다. (아이템화 완료는 [설계서 보관함])</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
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
            <button onClick={() => setIsArchiveOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
              title="Drop 의뢰 / 설계서 연결됨 / 아이템화 완료 항목 보기"
            >
              <Archive className="w-3.5 h-3.5" /> 보관함
              {archiveCount > 0 && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{archiveCount}</span>}
            </button>
            <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
              <Plus className="w-3.5 h-3.5"/> 새 의뢰 등록
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <SummaryCard icon={Activity} label="진행중" value={metrics.total} tone="slate"
            active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} subtext="전체 활성 카드" />
          <SummaryCard icon={Flame} label="지연" value={metrics.overdue} tone="rose"
            active={priorityFilter === 'overdue'} onClick={() => setPriorityFilter(priorityFilter === 'overdue' ? 'all' : 'overdue')} subtext="납기 초과" />
          <SummaryCard icon={Hourglass} label="임박" value={metrics.urgent} tone="orange"
            active={priorityFilter === 'urgent'} onClick={() => setPriorityFilter(priorityFilter === 'urgent' ? 'all' : 'urgent')} subtext="D-3 이내" />
          <SummaryCard icon={Sparkles} label="오늘 신규" value={metrics.newToday} tone="blue"
            active={priorityFilter === 'newToday'} onClick={() => setPriorityFilter(priorityFilter === 'newToday' ? 'all' : 'newToday')} subtext="오늘 등록된 의뢰" />
        </div>

        {/* 📖 단계 안내 토글 */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600"/>
              단계 안내 — 개발 의뢰 3단계 + 설계서 4단계
            </span>
            {showGuide ? <ChevronUp className="w-4 h-4 text-slate-500"/> : <ChevronDown className="w-4 h-4 text-slate-500"/>}
          </button>
          {showGuide && (
            <div className="border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/40">
              {/* 개발 의뢰 단계 */}
              <div className="bg-white rounded-lg border border-purple-100 p-3">
                <div className="text-xs font-extrabold text-purple-700 mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5"/> 개발 의뢰 단계 (3)
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  바이어로부터 받은 개발 건의 가능 여부(원사·편직기·단가)를 확인하는 단계입니다.
                </p>
                <ol className="space-y-2">
                  {DEV_REQ_STAGE_GUIDE.map((s, i) => (
                    <li key={s.key} className="flex items-start gap-2 text-[11px]">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`}></span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{i+1}. {s.label}</div>
                        <div className="text-slate-500 leading-snug">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {/* 설계서 단계 */}
              <div className="bg-white rounded-lg border border-indigo-100 p-3">
                <div className="text-xs font-extrabold text-indigo-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5"/> 설계서 단계 (4)
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  개발 확정된 의뢰 또는 그루빅 자체 개발 건을 설계서로 작성·생산하는 단계입니다.
                </p>
                <ol className="space-y-2">
                  {DESIGN_STAGE_GUIDE.map((s, i) => (
                    <li key={s.key} className="flex items-start gap-2 text-[11px]">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`}></span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{i+1}. {s.label}</div>
                        <div className="text-slate-500 leading-snug">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* === 섹션 A: 개발 의뢰 현황 === */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-600"/>
              개발 의뢰 현황
              <span className="text-[11px] font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{visibleDevReqs.length}건</span>
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 font-bold">정렬</label>
              <select
                value={devSortBy}
                onChange={(e) => setDevSortBy(e.target.value)}
                className="text-[11px] font-bold border border-slate-300 rounded px-2 py-1 bg-white hover:border-purple-300 focus:ring-2 ring-purple-200 outline-none cursor-pointer"
              >
                <option value="date">날짜순 (최신)</option>
                <option value="stage">단계순</option>
                <option value="buyer">바이어순</option>
              </select>
            </div>
          </div>

          {visibleDevReqs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p className="text-xs font-bold">진행 중인 개발 의뢰가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 데스크톱 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                      <th className="p-3 w-[120px]">O/D No.</th>
                      <th className="p-3 w-[140px]">바이어</th>
                      <th className="p-3">품목명</th>
                      <th className="p-3 w-[200px]">현재 단계</th>
                      <th className="p-3 w-[80px] text-right">경과</th>
                      <th className="p-3 w-[320px] text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevReqs.map(d => {
                      const days = daysSince(d.updatedAt || d.createdAt);
                      const urgency = getDevReqUrgency(d);
                      const stageEntry = formatStageEntry(d.statusEnteredAt?.[d.status] || d.updatedAt || d.createdAt);
                      const db = deadlineBadge(getDevReqDeadline(d));
                      const nextAction = nextStatusAction(d.status);
                      return (
                        <tr key={d.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${rowBg(urgency)}`}>
                          <td className="p-3 text-xs font-mono font-extrabold text-violet-700">{d.devOrderNo || '-'}</td>
                          <td className="p-3 text-xs font-bold text-slate-700 truncate">{d.buyerName || '-'}</td>
                          <td className="p-3 text-sm font-bold text-slate-800 truncate">
                            {d.devItem || d.targetSpec?.composition || '품목명 미입력'}
                            {stageEntry && <div className="text-[9px] text-slate-400 font-medium mt-0.5">📅 {stageEntry}</div>}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <PendingProgressBar stageKey={devStageKey(d)} />
                                {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                              </div>
                              <select
                                value={d.status}
                                onChange={(e) => updateDevStatus && updateDevStatus(d.id, e.target.value)}
                                title="단계를 변경하려면 선택하세요"
                                className="w-full max-w-[180px] text-[10px] font-bold border border-slate-300 rounded px-1.5 py-1 bg-white hover:border-purple-300 focus:ring-2 ring-purple-200 outline-none cursor-pointer"
                              >
                                {DEV_REQ_STAGE_GUIDE.map(s => (
                                  <option key={s.key} value={s.key} title={s.desc}>{s.label}</option>
                                ))}
                                <option value="confirmed" title="개발 가능 확정 — 설계서 작성 가능">개발 확정</option>
                              </select>
                            </div>
                          </td>
                          <td className="p-3 text-xs text-slate-500 text-right">{days != null ? `${days}일` : '-'}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {d.status === 'confirmed' ? (
                                <button onClick={() => handleGoToSheet(d)}
                                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm"
                                  title="설계서 작성 시작">
                                  <ArrowRight className="w-3 h-3"/> 설계 시작
                                </button>
                              ) : nextAction && (
                                <button onClick={() => updateDevStatus(d.id, nextAction.next)}
                                  className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-sm"
                                  title={`다음 단계: ${nextAction.label}`}>
                                  <ArrowRight className="w-3 h-3"/> {nextAction.label}
                                </button>
                              )}
                              <button onClick={() => handlePrint(d, 'request')}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 text-[10px] font-bold rounded border border-slate-200"
                                title="의뢰서 인쇄">
                                <Printer className="w-3 h-3"/>
                              </button>
                              <button onClick={() => openEditModal(d)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200"
                                title="의뢰 수정">
                                <Edit2 className="w-3 h-3"/> 수정
                              </button>
                              <button onClick={() => handleDropDev(d)}
                                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200"
                                title="의뢰 Drop">
                                <XCircle className="w-3 h-3"/> Drop
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 모바일 카드 */}
              <div className="block md:hidden p-3 space-y-2 bg-slate-50">
                {visibleDevReqs.map(d => {
                  const days = daysSince(d.updatedAt || d.createdAt);
                  const db = deadlineBadge(getDevReqDeadline(d));
                  const nextAction = nextStatusAction(d.status);
                  return (
                    <div key={d.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">의뢰</span>
                        <span className="text-[10px] text-slate-400">{days != null ? `${days}일 경과` : ''}</span>
                      </div>
                      <p className="text-xs font-mono font-extrabold text-violet-700 mb-0.5">{d.devOrderNo || '-'}</p>
                      <p className="text-sm font-bold text-slate-800 mb-0.5">{d.devItem || d.targetSpec?.composition || '품목명 미입력'}</p>
                      <p className="text-[11px] text-slate-500 mb-2">{d.buyerName || '-'}</p>
                      <div className="mb-2 flex items-center gap-2">
                        <PendingProgressBar stageKey={devStageKey(d)} />
                        {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                      </div>
                      <select
                        value={d.status}
                        onChange={(e) => updateDevStatus && updateDevStatus(d.id, e.target.value)}
                        className="mb-2 w-full text-[11px] font-bold border border-slate-300 rounded px-2 py-1.5 bg-white"
                      >
                        {DEV_REQ_STAGE_GUIDE.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                        <option value="confirmed">개발 확정</option>
                      </select>
                      <div className="flex flex-wrap gap-1.5">
                        {d.status === 'confirmed' ? (
                          <button onClick={() => handleGoToSheet(d)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded">
                            <ArrowRight className="w-3 h-3"/> 설계 시작
                          </button>
                        ) : nextAction && (
                          <button onClick={() => updateDevStatus(d.id, nextAction.next)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded">
                            <ArrowRight className="w-3 h-3"/> {nextAction.label}
                          </button>
                        )}
                        <button onClick={() => openEditModal(d)} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded border border-blue-200">
                          <Edit2 className="w-3 h-3"/> 수정
                        </button>
                        <button onClick={() => handleDropDev(d)} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200">
                          <XCircle className="w-3 h-3"/> Drop
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* === 섹션 B: 설계서 진행 현황 === */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600"/>
              설계서 진행 현황
              <span className="text-[11px] font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{visibleSheets.length}건</span>
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 font-bold">정렬</label>
              <select
                value={sheetSortBy}
                onChange={(e) => setSheetSortBy(e.target.value)}
                className="text-[11px] font-bold border border-slate-300 rounded px-2 py-1 bg-white hover:border-indigo-300 focus:ring-2 ring-indigo-200 outline-none cursor-pointer"
              >
                <option value="date">등록 날짜순 (최신)</option>
                <option value="stage">단계순</option>
                <option value="buyer">바이어순</option>
              </select>
            </div>
          </div>

          {visibleSheets.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p className="text-xs font-bold">진행 중인 설계서가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                      <th className="p-3 w-[120px]">O/D No.</th>
                      <th className="p-3 w-[140px]">바이어</th>
                      <th className="p-3 w-[100px]">등록 날짜</th>
                      <th className="p-3">원단명</th>
                      <th className="p-3 w-[200px]">현재 단계</th>
                      <th className="p-3 w-[80px] text-right">경과</th>
                      <th className="p-3 w-[320px] text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSheets.map(s => {
                      const dev = getLinkedDev(s.devRequestId);
                      const isSelfDev = !s.devRequestId || !dev;
                      const days = daysSince(s.updatedAt || s.createdAt);
                      const urgency = getSheetUrgency(s);
                      const stageEntry = formatStageEntry(s.stageEnteredAt?.[s.stage] || s.updatedAt);
                      const db = deadlineBadge(s.deadline);
                      const regDate = s.registeredDate || (s.createdAt || '').slice(0, 10) || '-';
                      return (
                        <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${rowBg(urgency)}`}>
                          <td className="p-3 text-xs font-mono font-extrabold text-violet-700">{s.devOrderNo || '자체'}</td>
                          <td className="p-3 text-xs font-bold text-slate-700 truncate">
                            {isSelfDev
                              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>
                              : (dev?.buyerName || '-')}
                          </td>
                          <td className="p-3 text-xs font-mono text-blue-700 font-bold">{regDate}</td>
                          <td className="p-3 text-sm font-bold text-slate-800 truncate">
                            {s.fabricName || '원단명 미입력'}
                            {stageEntry && <div className="text-[9px] text-slate-400 font-medium mt-0.5">📅 {stageEntry}</div>}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <PendingProgressBar stageKey={s.stage} />
                                {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                              </div>
                              <select
                                value={s.stage}
                                onChange={(e) => setStage && setStage(s.id, e.target.value)}
                                title="단계를 변경하려면 선택하세요"
                                className="w-full max-w-[180px] text-[10px] font-bold border border-slate-300 rounded px-1.5 py-1 bg-white hover:border-indigo-300 focus:ring-2 ring-indigo-200 outline-none cursor-pointer"
                              >
                                {DESIGN_STAGE_GUIDE.map(stage => (
                                  <option key={stage.key} value={stage.key} title={stage.desc}>{stage.label}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="p-3 text-xs text-slate-500 text-right">{days != null ? `${days}일` : '-'}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end items-center">
                              {s.stage === 'eztex' && (
                                <>
                                  <input
                                    ref={el => { eztexInputRefs.current[s.id] = el; }}
                                    type="text"
                                    placeholder="EZ-TEX O/D"
                                    defaultValue={s.eztexOrderNo || ''}
                                    onKeyDown={e => { if (e.key === 'Enter') handleEztexSubmit(s); }}
                                    className="w-[110px] border border-violet-200 bg-violet-50/40 rounded px-2 py-1 text-[10px] font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"
                                  />
                                  <button onClick={() => handleEztexSubmit(s)}
                                    className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded shadow-sm">
                                    등록
                                  </button>
                                </>
                              )}
                              <button onClick={() => handleEditSheet?.(s)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200"
                                title="설계서 수정">
                                <Edit2 className="w-3 h-3"/> 수정
                              </button>
                              <button onClick={() => handleDropSheet(s.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200"
                                title="설계서 Drop">
                                <XCircle className="w-3 h-3"/> Drop
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden p-3 space-y-2 bg-slate-50">
                {visibleSheets.map(s => {
                  const dev = getLinkedDev(s.devRequestId);
                  const isSelfDev = !s.devRequestId || !dev;
                  const days = daysSince(s.updatedAt || s.createdAt);
                  const db = deadlineBadge(s.deadline);
                  return (
                    <div key={s.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">설계서</span>
                        <span className="text-[10px] text-slate-400">{days != null ? `${days}일 경과` : ''}</span>
                      </div>
                      <p className="text-xs font-mono font-extrabold text-violet-700 mb-0.5">{s.devOrderNo || '자체'}</p>
                      <p className="text-sm font-bold text-slate-800 mb-0.5">{s.fabricName || '원단명 미입력'}</p>
                      <p className="text-[11px] text-slate-500 mb-2">
                        {isSelfDev
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>
                          : (dev?.buyerName || '-')}
                      </p>
                      <div className="mb-2 flex items-center gap-2">
                        <PendingProgressBar stageKey={s.stage} />
                        {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                      </div>
                      <select
                        value={s.stage}
                        onChange={(e) => setStage && setStage(s.id, e.target.value)}
                        className="mb-2 w-full text-[11px] font-bold border border-slate-300 rounded px-2 py-1.5 bg-white"
                      >
                        {DESIGN_STAGE_GUIDE.map(stage => (
                          <option key={stage.key} value={stage.key}>{stage.label}</option>
                        ))}
                      </select>
                      {s.stage === 'eztex' && (
                        <div className="flex gap-1.5 mb-2">
                          <input
                            ref={el => { eztexInputRefs.current[s.id] = el; }}
                            type="text"
                            placeholder="EZ-TEX O/D NO."
                            defaultValue={s.eztexOrderNo || ''}
                            onKeyDown={e => { if (e.key === 'Enter') handleEztexSubmit(s); }}
                            className="flex-1 w-0 border border-violet-200 bg-violet-50/40 rounded px-2 py-1.5 text-xs font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"
                          />
                          <button onClick={() => handleEztexSubmit(s)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-[11px] font-bold rounded">
                            등록
                          </button>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <button onClick={() => handleEditSheet?.(s)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded border border-blue-200">
                          <Edit2 className="w-3 h-3"/> 수정
                        </button>
                        <button onClick={() => handleDropSheet(s.id)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200">
                          <XCircle className="w-3 h-3"/> Drop
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 의뢰 등록/수정 모달 */}
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

        {/* 통합 보관함 모달 */}
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

      {/* 편직처 제출용 프린트 영역 */}
      <div className="hidden print:block font-sans">
        <div ref={devPrintRef} className="w-[210mm] h-[290mm] mx-auto bg-white text-slate-800 p-8 box-border relative font-sans">
          {printTarget && (
            <div className="w-full h-full border-2 border-slate-200 rounded-3xl p-8 flex flex-col shadow-sm">
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

              <div className="grid grid-cols-2 gap-6 mb-6">
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
