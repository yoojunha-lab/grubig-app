import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Archive, ChevronDown, FileText, Check } from 'lucide-react';
import { MobileSheetCard } from '../components/design-sheet/MobileSheetCard';
import { DesktopSheetRow } from '../components/design-sheet/DesktopSheetRow';
import { DropSheetModal } from '../components/design-sheet/DropSheetModal';
import { STAGE_COLORS } from '../constants/common';

export const DesignSheetListPage = ({
  designSheets,
  devRequests,
  handleEditSheet,
  handleDeleteSheet,
  initFromDevRequest,
  advanceStage,
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
  setSheetInput
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegisterMenu, setShowRegisterMenu] = useState(false);
  
  // 필터
  const [knitFactoryFilter, setKnitFactoryFilter] = useState('All');
  const [machineTypeFilter, setMachineTypeFilter] = useState('All');
  const [gaugeFilter, setGaugeFilter] = useState('All');
  
  const [expandedId, setExpandedId] = useState(null);
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const registerMenuRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!showRegisterMenu) return;
    const handleClick = (e) => {
      if (registerMenuRef.current && !registerMenuRef.current.contains(e.target)) {
        setShowRegisterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRegisterMenu]);

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
  const getLinkedSheet = (devReqId) => designSheets?.find(s => s.devRequestId === devReqId);
  const waitingDevReqs = useMemo(() => 
    (devRequests || []).filter(d => d.status === 'confirmed' && !getLinkedSheet(d.id))
      .sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [devRequests, designSheets]);

  const itemizedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.stage === 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter]);

  const droppedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.status === 'dropped')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets]); // DROP 창에는 필터 미적용, 자체 검색 이용

  const inProgressSheets = useMemo(() =>
    (designSheets || []).filter(s => s.stage !== 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter]);

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
          
          {/* 신규 등록 드롭다운 */}
          <div className="relative" ref={registerMenuRef}>
            <button onClick={() => setShowRegisterMenu(!showRegisterMenu)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> 새 설계서 등록
              <ChevronDown className="w-3 h-3" />
            </button>
            {showRegisterMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-30">
                {(devRequests||[]).filter(d => d.status === 'confirmed' && !designSheets?.find(s => s.devRequestId === d.id)).length > 0 && (
                  <div className="border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 px-3 pt-2 pb-1">확정 오더 연동 (설계 대기)</p>
                    {(devRequests||[]).filter(d => d.status === 'confirmed' && !designSheets?.find(s => s.devRequestId === d.id)).map(req => (
                      <button key={req.id} onClick={() => {
                        if(initFromDevRequest) initFromDevRequest({ devOrderNo: req.devOrderNo, devRequestId: req.id, sampleDeadline: req.targetSpec?.sampleDeadline || '' });
                        setIsDesignSheetModalOpen(true);
                        setShowRegisterMenu(false);
                      }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2 transition-colors">
                        <span className="font-mono font-bold text-violet-600">{req.devOrderNo}</span>
                        <span className="text-slate-500 truncate">{req.buyerName}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => {
                  if(resetSheetForm) resetSheetForm();
                  setIsDesignSheetModalOpen(true);
                  setShowRegisterMenu(false);
                }} className="w-full text-left px-3 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 rounded-b-xl">
                  자체 설계서 (오더 없이 직접 작성)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* === 대기중인 확정 의뢰 === */}
      {waitingDevReqs.length > 0 && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm mb-4">
           <h3 className="text-xs font-extrabold text-emerald-800 flex items-center gap-2 mb-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             결재 완료된 신규 개발건 <span className="bg-emerald-100 px-1.5 py-0.5 rounded-full text-emerald-700">{waitingDevReqs.length}건</span>
           </h3>
           <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
             {waitingDevReqs.map(req => (
               <div key={req.id} className="min-w-[280px] snap-start shrink-0 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm hover:border-emerald-300 transition-colors flex flex-col justify-between">
                 <div>
                   <span className="text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-1.5 rounded mr-1">{req.devOrderNo}</span>
                   <p className="text-sm font-bold text-blue-900 mt-1 truncate">{req.devItem || '아이템명 미입력'}</p>
                   <p className="text-[10px] text-slate-500 mt-0.5">{req.buyerName}</p>
                 </div>
                 <button onClick={() => {
                   if(initFromDevRequest) initFromDevRequest({ devOrderNo: req.devOrderNo, devRequestId: req.id, sampleDeadline: req.targetSpec?.sampleDeadline || '' });
                   setIsDesignSheetModalOpen(true);
                 }} className="mt-3 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center justify-center gap-1">
                   <Plus className="w-3 h-3" /> 설계 시작
                 </button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* 2. 구역 A: 진행 중인 설계서 (가로 스크롤 소형 카드) */}
      {inProgressSheets.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-3">
             <FileText className="w-4 h-4 text-blue-500"/> 
             진행 중인 설계서 
             <span className="text-[11px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{inProgressSheets.length}건</span>
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
            {inProgressSheets.map(sheet => (
              <div key={sheet.id} className="snap-start shrink-0 w-[300px] h-full">
                <MobileSheetCard {...getCardProps(sheet)} />
              </div>
            ))}
          </div>
        </div>
      )}

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
