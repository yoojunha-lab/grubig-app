import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Archive, FileText, Check, Clock, Edit2, ArrowRight, XCircle } from 'lucide-react';
import { MobileSheetCard } from '../components/design-sheet/MobileSheetCard';
import { DesktopSheetRow } from '../components/design-sheet/DesktopSheetRow';
import { DropSheetModal } from '../components/design-sheet/DropSheetModal';
import { PendingProgressBar } from '../components/design-sheet/PendingProgressBar';
import { STAGE_COLORS } from '../constants/common';

export const DesignSheetListPage = ({
  designSheets,
  devRequests,
  handleEditSheet,
  handleDeleteSheet,
  initFromDevRequest,
  createDesignSheetFromDev,
  advanceStage,
  autoAdvanceEztex,
  getDesignCost,
  setActiveTab,
  user,
  viewMode,
  yarnLibrary,
  saveDocToCloud,
  restoreFromDrop,
  dropDesignSheet,
  resetSheetForm,
  setIsDesignSheetModalOpen,
  setSheetInput,
  updateDevStatus
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 필터
  const [knitFactoryFilter, setKnitFactoryFilter] = useState('All');
  const [machineTypeFilter, setMachineTypeFilter] = useState('All');
  const [gaugeFilter, setGaugeFilter] = useState('All');

  const [expandedId, setExpandedId] = useState(null);
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);

  // 대기중 목록의 eztex 단계 행에서 사용할 EZ-TEX O/D NO. 인라인 입력 ref
  const eztexInputRefs = useRef({});

  const handleEztexSubmit = (sheetId) => {
    if (!autoAdvanceEztex) return;
    const val = eztexInputRefs.current[sheetId]?.value?.trim();
    if (!val) {
      alert('EZ-TEX O/D NO.를 입력해주세요.');
      return;
    }
    autoAdvanceEztex(sheetId, val);
  };

  // 필터 로직
  const filterSheet = (s) => {
    if (knitFactoryFilter !== 'All' && s.knitting?.factory !== knitFactoryFilter) return false;
    if (machineTypeFilter !== 'All' && s.knitting?.machineType !== machineTypeFilter) return false;
    if (gaugeFilter !== 'All' && s.knitting?.gauge !== gaugeFilter) return false;
    
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return String(s.devOrderNo || '').toLowerCase().includes(q) ||
      String(s.articleNo || '').toLowerCase().includes(q) ||
      String(s.eztexOrderNo || '').toLowerCase().includes(q) ||
      String(s.fabricName || '').toLowerCase().includes(q);
  };

  // 옵션 추출
  const factories = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.factory).filter(Boolean))];
  const machineTypes = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.machineType).filter(Boolean))];
  const gauges = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.gauge).filter(Boolean))];
  
  // 데이터 분류
  // [기획 #3 수정] dropped 설계서는 제외 → 의뢰를 DROP 후 재확정할 때 "대기중 목록"에 다시 표시되도록
  const getLinkedSheet = (devReqId) => designSheets?.find(s => s.devRequestId === devReqId && s.status !== 'dropped');

  const itemizedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.stage === 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter]);

  const droppedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.status === 'dropped')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets]); // DROP 창에는 필터 미적용, 자체 검색 이용

  // ▼ 통합 "대기중 목록" - 아이템화 직전까지의 모든 건 (의뢰 + 진행중 설계서)
  // - 의뢰: hold 상태 또는 confirmed && 설계서 미연결(안전망)
  // - 설계서: stage !== 'articled' && status !== 'dropped'
  const pendingItems = useMemo(() => {
    const fromDevReqs = (devRequests || [])
      .filter(d => {
        const noSheet = !getLinkedSheet(d.id);
        if (!noSheet) return false;
        return d.status === 'hold' || d.status === 'confirmed';
      })
      .filter(d => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return String(d.devOrderNo || '').toLowerCase().includes(q)
          || String(d.buyerName || '').toLowerCase().includes(q)
          || String(d.devItem || '').toLowerCase().includes(q);
      })
      .map(d => ({
        kind: 'devRequest',
        id: d.id,
        // hold/confirmed 둘 다 통합바에서는 단계 3 "대기중" 위치
        stageKey: 'hold',
        devOrderNo: d.devOrderNo || '-',
        buyerName: d.buyerName || '-',
        fabricName: d.devItem || d.targetSpec?.composition || '품목명 미입력',
        updatedAt: d.updatedAt || d.createdAt,
        raw: d
      }));

    const fromSheets = (designSheets || [])
      .filter(s => s.stage !== 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .map(s => {
        const dev = (devRequests || []).find(d => d.id === s.devRequestId);
        const isSelfDev = !s.devRequestId || !dev;
        return {
          kind: 'designSheet',
          id: s.id,
          stageKey: s.stage,
          devOrderNo: s.devOrderNo || '-',
          buyerName: isSelfDev ? '자체개발' : (dev?.buyerName || '-'),
          isSelfDev,
          fabricName: s.fabricName || '원단명 미입력',
          eztexOrderNo: s.eztexOrderNo || '',
          updatedAt: s.updatedAt || s.createdAt,
          raw: s
        };
      });

    return [...fromDevReqs, ...fromSheets]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [devRequests, designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter]);

  // 행 단위 액션 핸들러
  // [R2] useDevRequest의 createDesignSheetFromDev 헬퍼를 단일 진실원으로 사용
  const handleStartDesignFromDev = (devReq) => {
    if (!createDesignSheetFromDev || !initFromDevRequest) return;
    initFromDevRequest(createDesignSheetFromDev(devReq));
    setIsDesignSheetModalOpen(true);
  };

  const handleDropDevRequest = (devReq) => {
    if (!updateDevStatus) return;
    if (window.confirm(`개발 의뢰 ${devReq.devOrderNo}를 Drop(미진행) 처리할까요?\n나중에 상태를 다시 변경할 수 있습니다.`)) {
      updateDevStatus(devReq.id, 'rejected');
    }
  };

  // 경과일 계산 (updatedAt 기준)
  const daysSince = (iso) => {
    if (!iso) return null;
    const t = new Date(iso); const n = new Date();
    return Math.floor((n - t) / 86400000);
  };

  // 유틸 함수
  const getYarnName = (yarnId) => {
    if (!yarnId) return '';
    return (yarnLibrary || []).find(y => String(y.id) === String(yarnId).split('::')[0])?.name || '';
  };
  
  const getCompositionText = (yarns) => (yarns || []).filter(y => y?.yarnId && Number(y.ratio) > 0)
    .map(y => `${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ') || '-';
    
  const getLinkedBuyer = (sheet) => (devRequests||[]).find(d=>d.id===sheet.devRequestId)?.buyerName || '';

  const handleDrop = (sheetId) => { if (dropDesignSheet) dropDesignSheet(sheetId); };
  
  // 자식 컴포넌트용 공통 Props 래퍼
  const getCardProps = (sheet) => ({
    sheet,
    costData: getDesignCost?.(sheet),
    history: sheet.changeHistory || [],
    viewMode,
    isExpanded: expandedId === sheet.id,
    onToggle: () => setExpandedId(expandedId === sheet.id ? null : sheet.id),
    handleEditSheet,
    handleDeleteSheet,
    getCompositionText,
    getLinkedBuyer
  });

  return (
    <div className="space-y-6">
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-lg text-white shadow-md">
              <Archive className="w-5 h-5" />
            </div>
            설계서 보관함
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            원단 설계서 아이템 관리, 단가 확인 및 변경 이력 추적
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* DROP 보관함 버튼 */}
          <button onClick={() => setIsDropModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
            <Archive className="w-3.5 h-3.5" /> DROP 보관함
            <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] ml-1">{droppedSheets.length}</span>
          </button>
          
          {/* 자체 설계서 등록 (의뢰 연동은 "대기중 목록"의 [설계 시작] 버튼으로) */}
          <button
            onClick={() => {
              if (resetSheetForm) resetSheetForm();
              setIsDesignSheetModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
            title="의뢰 없이 자체 설계서를 작성합니다"
          >
            <Plus className="w-3.5 h-3.5" /> 자체 설계서 등록
          </button>
        </div>
      </div>
      
      {/* === 대기중 목록 (의뢰 + 진행중 설계서 통합) === */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600"/>
            대기중 목록
            <span className="text-[11px] font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{pendingItems.length}건</span>
          </h3>
          <span className="text-[10px] text-slate-500 hidden md:inline">아이템화 전 모든 의뢰·설계서를 한 곳에서 관리</span>
        </div>

        {pendingItems.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30"/>
            <p className="text-xs font-bold">대기중인 항목이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                    <th className="p-3 w-[70px]">유형</th>
                    <th className="p-3 w-[120px]">O/D No.</th>
                    <th className="p-3 w-[140px]">바이어</th>
                    <th className="p-3">품목명</th>
                    <th className="p-3 w-[200px]">현재 단계</th>
                    <th className="p-3 w-[70px] text-right">경과</th>
                    <th className="p-3 w-[300px] text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map(item => {
                    const days = daysSince(item.updatedAt);
                    const isDev = item.kind === 'devRequest';
                    return (
                      <tr key={`${item.kind}-${item.id}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          {isDev ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">의뢰</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">설계서</span>
                          )}
                        </td>
                        <td className="p-3 text-xs font-mono font-extrabold text-violet-700">{item.devOrderNo}</td>
                        <td className="p-3 text-xs font-bold text-slate-700 truncate">
                          {item.isSelfDev ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>
                          ) : item.buyerName}
                        </td>
                        <td className="p-3 text-sm font-bold text-slate-800 truncate">{item.fabricName}</td>
                        <td className="p-3"><PendingProgressBar stageKey={item.stageKey} /></td>
                        <td className="p-3 text-xs text-slate-500 text-right">{days != null ? `${days}일` : '-'}</td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            {isDev ? (
                              <>
                                <button
                                  onClick={() => handleStartDesignFromDev(item.raw)}
                                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm"
                                  title="설계서 작성을 시작합니다"
                                >
                                  <ArrowRight className="w-3 h-3"/> 설계 시작
                                </button>
                                <button
                                  onClick={() => handleDropDevRequest(item.raw)}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200"
                                  title="의뢰 Drop"
                                >
                                  <XCircle className="w-3 h-3"/> Drop
                                </button>
                              </>
                            ) : (
                              <>
                                {item.stageKey === 'eztex' && (
                                  <>
                                    <input
                                      ref={el => { eztexInputRefs.current[item.id] = el; }}
                                      type="text"
                                      placeholder="EZ-TEX O/D"
                                      defaultValue={item.eztexOrderNo}
                                      onKeyDown={e => { if (e.key === 'Enter') handleEztexSubmit(item.id); }}
                                      className="w-[110px] border border-violet-200 bg-violet-50/40 rounded px-2 py-1 text-[10px] font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"
                                    />
                                    <button
                                      onClick={() => handleEztexSubmit(item.id)}
                                      className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded shadow-sm"
                                      title="EZ-TEX O/D 등록 → 샘플 진행 단계"
                                    >
                                      등록
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleEditSheet(item.raw)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200"
                                  title="설계서 수정"
                                >
                                  <Edit2 className="w-3 h-3"/> 수정
                                </button>
                                <button
                                  onClick={() => handleDrop(item.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200"
                                  title="설계서 Drop"
                                >
                                  <XCircle className="w-3 h-3"/> Drop
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 리스트 */}
            <div className="block md:hidden p-3 space-y-2 bg-slate-50">
              {pendingItems.map(item => {
                const days = daysSince(item.updatedAt);
                const isDev = item.kind === 'devRequest';
                return (
                  <div key={`${item.kind}-${item.id}`} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      {isDev ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">의뢰</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">설계서</span>
                      )}
                      <span className="text-[10px] text-slate-400">{days != null ? `${days}일 경과` : ''}</span>
                    </div>
                    <p className="text-xs font-mono font-extrabold text-violet-700 mb-0.5">{item.devOrderNo}</p>
                    <p className="text-sm font-bold text-slate-800 mb-0.5">{item.fabricName}</p>
                    <p className="text-[11px] text-slate-500 mb-2">
                      {item.isSelfDev ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>
                      ) : item.buyerName}
                    </p>
                    <div className="mb-2">
                      <PendingProgressBar stageKey={item.stageKey} />
                    </div>
                    {!isDev && item.stageKey === 'eztex' && (
                      <div className="flex gap-1.5 mb-2">
                        <input
                          ref={el => { eztexInputRefs.current[item.id] = el; }}
                          type="text"
                          placeholder="EZ-TEX O/D NO."
                          defaultValue={item.eztexOrderNo}
                          onKeyDown={e => { if (e.key === 'Enter') handleEztexSubmit(item.id); }}
                          className="flex-1 w-0 border border-violet-200 bg-violet-50/40 rounded px-2 py-1.5 text-xs font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"
                        />
                        <button
                          onClick={() => handleEztexSubmit(item.id)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-[11px] font-bold rounded"
                        >
                          등록
                        </button>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {isDev ? (
                        <>
                          <button
                            onClick={() => handleStartDesignFromDev(item.raw)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded"
                          >
                            <ArrowRight className="w-3 h-3"/> 설계 시작
                          </button>
                          <button
                            onClick={() => handleDropDevRequest(item.raw)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200"
                          >
                            <XCircle className="w-3 h-3"/> Drop
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditSheet(item.raw)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded border border-blue-200"
                          >
                            <Edit2 className="w-3 h-3"/> 수정
                          </button>
                          <button
                            onClick={() => handleDrop(item.id)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200"
                          >
                            <XCircle className="w-3 h-3"/> Drop
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 3. 검색 & 공통 필터 영역 */}
      <div className="bg-white p-3 rounded-t-xl border border-b-0 border-slate-200">
         <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Article, 개발번호, 식별자 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 ring-blue-200 outline-none" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
               <select value={knitFactoryFilter} onChange={e=>setKnitFactoryFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-2 outline-none shrink-0">
                 {factories.map(f => <option key={f} value={f}>{f==='All'?'편직처 - 전체':f}</option>)}
               </select>
               <select value={machineTypeFilter} onChange={e=>setMachineTypeFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-2 outline-none shrink-0">
                 {machineTypes.map(m => <option key={m} value={m}>{m==='All'?'기종 - 전체':m}</option>)}
               </select>
               <select value={gaugeFilter} onChange={e=>setGaugeFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-2 outline-none shrink-0">
                 {gauges.map(g => <option key={g} value={g}>{g==='All'?'게이지 - 전체':g}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* 4. 구역 B: 아이템화 완료된 설계서 (메인 데이터 테이블) */}
      <div className="bg-white border text-center border-slate-200 rounded-b-xl shadow-sm overflow-hidden">
        <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
           <h3 className="text-sm font-extrabold text-emerald-800 flex items-center gap-2">
             <Check className="w-4 h-4 text-emerald-600"/> 
             아이템화 완료 목록
             <span className="text-[11px] font-normal text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{itemizedSheets.length}건</span>
           </h3>
        </div>

        {itemizedSheets.length === 0 ? (
           <p className="text-xs text-slate-400 py-12">검색된 아이템이 없습니다.</p>
        ) : (
          <>
            {/* 데스크톱 웹용 데이터 테이블 (md 이상에서만 표시) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                    <th className="p-3 w-[120px]">Date / 식별자</th>
                    <th className="p-3 w-[150px]">원단명 / 스펙</th>
                    <th className="p-3 w-[160px]">원사 배합</th>
                    <th className="p-3 w-[140px]">편직 정보</th>
                    <th className="p-3 w-[130px]">염색 / 후가공</th>
                    <th className="p-3 w-[100px] text-right">3K 도매가</th>
                    <th className="p-3 w-[80px] text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {itemizedSheets.map(sheet => (
                    <DesktopSheetRow key={sheet.id} {...getCardProps(sheet)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 하이브리드 리스트 (md 미만에서만 표시) */}
            <div className="block md:hidden p-3 bg-slate-50">
               {itemizedSheets.map(sheet => (
                 <MobileSheetCard key={sheet.id} {...getCardProps(sheet)} />
               ))}
            </div>
          </>
        )}
      </div>

      {/* 5. 구역 C: DROP 보관함 모달 */}
      <DropSheetModal
        isOpen={isDropModalOpen}
        onClose={() => setIsDropModalOpen(false)}
        droppedSheets={droppedSheets}
        restoreFromDrop={restoreFromDrop}
        handleDeleteSheet={handleDeleteSheet}
        getCompositionText={getCompositionText}
      />
    </div>
  );
};
