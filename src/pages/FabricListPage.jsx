import React from 'react';
import { Search, X, Database, Upload, DollarSign, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { DesktopFabricRow } from '../components/fabric/DesktopFabricRow';
import { MobileFabricCard } from '../components/fabric/MobileFabricCard';

const PAGE_SIZE = 20; // 1페이지당 원단 수 (로드 성능)

export const FabricListPage = ({
  filteredFabrics,
  viewMode,
  fabricSearchTerm,
  setFabricSearchTerm,
  handleBackupFabrics,
  setIsBulkModalOpen,
  expandedFabricId,
  setExpandedFabricId,
  calculateCost,
  handleEditFabric,
  handleDeleteFabric,
  setActiveTab,
  yarnLibrary,
  designSheets,
  handleEditSheet,
  setIsDesignSheetModalOpen,
  globalExchangeRate,
  page = 0,
  setPage,
  onNewFabric,
}) => {
  // 페이지네이션 계산
  const total = filteredFabrics.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const pageFabrics = filteredFabrics.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = total === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, safePage * PAGE_SIZE + PAGE_SIZE);

  const goPage = (p) => setPage && setPage(Math.min(Math.max(0, p), totalPages - 1));

  // 페이지 번호 버튼 목록 (현재 페이지 주변 최대 7개)
  const pageNums = () => {
    const nums = [];
    let s = Math.max(0, safePage - 3);
    let e = Math.min(totalPages - 1, s + 6);
    s = Math.max(0, e - 6);
    for (let i = s; i <= e; i++) nums.push(i);
    return nums;
  };

  const Pagination = totalPages > 1 && (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-slate-500">{rangeStart}–{rangeEnd} / 총 {total}종</span>
      <div className="flex items-center gap-1">
        <button onClick={() => goPage(safePage - 1)} disabled={safePage === 0} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        {pageNums().map(n => (
          <button key={n} onClick={() => goPage(n)} className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-bold transition-colors ${n === safePage ? 'bg-blue-600 text-white shadow' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n + 1}</button>
        ))}
        <button onClick={() => goPage(safePage + 1)} disabled={safePage >= totalPages - 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto print:hidden w-full">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">원단 관리 <span className="text-base font-bold text-slate-400">({total})</span></h2>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {viewMode === 'domestic' ? '기준: 내수(관세포함)' : '기준: 수출(관세제외)'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <input type="text" placeholder="Article 검색..." value={fabricSearchTerm} onChange={(e) => setFabricSearchTerm(e.target.value.toUpperCase())} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white uppercase focus:ring-2 focus:ring-blue-500 transition-shadow" />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {fabricSearchTerm && <button onClick={() => setFabricSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm">
            <button onClick={handleBackupFabrics} className="justify-center items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex transition-colors"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
            <button onClick={() => setIsBulkModalOpen(true)} className="justify-center items-center gap-1.5 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex transition-colors"><Upload className="w-4 h-4" /> 엑셀</button>
          </div>
          <button onClick={onNewFabric} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 text-sm font-bold shadow-lg shadow-blue-200 shrink-0">
            <Plus className="w-4 h-4" /> 새 원단 등록
          </button>
        </div>
      </div>

      {/* 통계 카드 (컴팩트 2개) */}
      <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Database className="w-4 h-4" /></div>
          <div><p className="text-[10px] font-bold text-slate-500">총 등록 원단</p><p className="text-lg font-extrabold text-slate-800 leading-tight">{total} <span className="text-xs font-normal text-slate-500">종</span></p></div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
          <div><p className="text-[10px] font-bold text-slate-500">현재 단가 모드</p><p className="text-lg font-extrabold text-slate-800 leading-tight">{viewMode === 'domestic' ? '내수용' : '수출용'}</p></div>
        </div>
      </div>

      {/* 데스크탑 표 */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto w-full">
        <table className="w-full text-sm text-left min-w-[1200px]">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <tr className="text-xs uppercase tracking-wider text-slate-500 bg-slate-100/50">
              <th className="font-bold p-2 text-center border-r border-slate-200 w-10"><Filter className="w-4 h-4 mx-auto" /></th>
              <th className="font-bold p-2 text-left border-r border-slate-200 w-1/5 min-w-[180px]">Article & Info</th>
              <th className="font-bold p-2 text-center border-r border-slate-200 w-28 text-blue-700 bg-blue-50/50">연동 설계서</th>
              <th className="font-bold p-2 text-left border-r border-slate-200 min-w-[140px]">Spec</th>
              <th className="font-bold p-2 text-left border-r border-slate-200 min-w-[220px]">사용 원사 (Yarn Mix)</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">편직비 & LOSS</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">염가공 & LOSS</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">위험마진(%)</th>
              <th colSpan="3" className="font-bold p-2 text-center border-r border-slate-200 text-emerald-700 bg-emerald-50/50">영업 기준원가</th>
              <th className="font-bold p-2 text-center w-12"></th>
            </tr>
            <tr className="text-[10px] text-center bg-slate-50/50">
              <th className="p-1 border-b border-r border-slate-200" colSpan="8"></th>
              <th className="p-1 border-b border-r border-slate-200 text-slate-500">1k</th>
              <th className="p-1 border-b border-r border-slate-200 font-bold text-slate-600 bg-slate-100/50">3k</th>
              <th className="p-1 border-b border-r border-slate-200 text-slate-500">5k</th>
              <th className="p-1 border-b"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageFabrics.map(f => (
              <DesktopFabricRow
                key={f.id}
                f={f}
                viewMode={viewMode}
                isExpanded={expandedFabricId === f.id}
                onToggleExpand={() => setExpandedFabricId(expandedFabricId === f.id ? null : f.id)}
                handleEditFabric={handleEditFabric}
                handleDeleteFabric={handleDeleteFabric}
                setActiveTab={setActiveTab}
                calculateCost={calculateCost}
                yarnLibrary={yarnLibrary}
                designSheets={designSheets}
                handleEditSheet={handleEditSheet}
                setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
                globalExchangeRate={globalExchangeRate}
              />
            ))}
            {total === 0 && (
              <tr>
                <td colSpan="13" className="p-14 text-center bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Search className="w-10 h-10 mb-3 text-slate-300" />
                    <p className="text-base font-bold text-slate-600 mb-1">검색 결과가 없거나 등록된 원단이 없습니다.</p>
                    <p className="text-sm">‘새 원단 등록’으로 추가하거나 검색 조건을 바꿔보세요.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3 pb-6">
        {pageFabrics.map(f => (
          <MobileFabricCard
            key={f.id}
            f={f}
            viewMode={viewMode}
            isExpanded={expandedFabricId === f.id}
            onToggleExpand={() => setExpandedFabricId(expandedFabricId === f.id ? null : f.id)}
            handleEditFabric={handleEditFabric}
            handleDeleteFabric={handleDeleteFabric}
            setActiveTab={setActiveTab}
            calculateCost={calculateCost}
            yarnLibrary={yarnLibrary}
            designSheets={designSheets}
            handleEditSheet={handleEditSheet}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
            globalExchangeRate={globalExchangeRate}
          />
        ))}
        {total === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-sm">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-extrabold text-slate-700 mb-1">등록된 원단이 없습니다.</p>
            <p className="text-[11px] text-slate-400">‘새 원단 등록’으로 추가해주세요.</p>
          </div>
        )}
      </div>

      {Pagination}
    </div>
  );
};
