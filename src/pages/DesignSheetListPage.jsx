import React, { useState, useMemo } from 'react';
import { Search, Plus, Archive, Check } from 'lucide-react';
import { MobileSheetCard } from '../components/design-sheet/MobileSheetCard';
import { DesktopSheetRow } from '../components/design-sheet/DesktopSheetRow';
import { DropSheetModal } from '../components/design-sheet/DropSheetModal';

export const DesignSheetListPage = ({
  designSheets,
  devRequests,
  handleEditSheet,
  handleDeleteSheet,
  getDesignCost,
  user,
  viewMode,
  yarnLibrary,
  restoreFromDrop,
  resetSheetForm,
  setIsDesignSheetModalOpen
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 필터
  const [knitFactoryFilter, setKnitFactoryFilter] = useState('All');
  const [machineTypeFilter, setMachineTypeFilter] = useState('All');
  const [gaugeFilter, setGaugeFilter] = useState('All');

  const [expandedId, setExpandedId] = useState(null);
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);

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

  const factories = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.factory).filter(Boolean))];
  const machineTypes = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.machineType).filter(Boolean))];
  const gauges = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.gauge).filter(Boolean))];

  const itemizedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.stage === 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter]);

  const droppedSheets = useMemo(() =>
    (designSheets || []).filter(s => s.status === 'dropped')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets]);

  const getYarnName = (yarnId) => {
    if (!yarnId) return '';
    return (yarnLibrary || []).find(y => String(y.id) === String(yarnId).split('::')[0])?.name || '';
  };

  const getCompositionText = (yarns) => (yarns || []).filter(y => y?.yarnId && Number(y.ratio) > 0)
    .map(y => `${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ') || '-';

  const getLinkedBuyer = (sheet) => (devRequests||[]).find(d=>d.id===sheet.devRequestId)?.buyerName || '';

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
      {/* 1. 헤더 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-lg text-white shadow-md">
              <Archive className="w-5 h-5" />
            </div>
            설계서 보관함
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            아이템화 완료된 원단 설계서 보관함 — 진행 중 의뢰·설계서는 [개발/설계 현황] 페이지에서 관리
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsDropModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
            <Archive className="w-3.5 h-3.5" /> DROP 보관함
            <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] ml-1">{droppedSheets.length}</span>
          </button>

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

      {/* 2. 검색 & 필터 */}
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

      {/* 3. 아이템화 완료 목록 */}
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

            <div className="block md:hidden p-3 bg-slate-50">
               {itemizedSheets.map(sheet => (
                 <MobileSheetCard key={sheet.id} {...getCardProps(sheet)} />
               ))}
            </div>
          </>
        )}
      </div>

      {/* 4. DROP 보관함 모달 */}
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
