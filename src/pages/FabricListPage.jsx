import React from 'react';
import { Search, X, Database, Upload, TrendingUp, DollarSign, Filter } from 'lucide-react';
import { DesktopFabricRow } from '../components/fabric/DesktopFabricRow';
import { MobileFabricCard } from '../components/fabric/MobileFabricCard';

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
  designSheets
}) => {
  return (
    <div className="max-w-[1600px] mx-auto print:hidden w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">원단 리스트 ({filteredFabrics.length})</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {viewMode === 'domestic' ? '기준: 내수(관세포함)' : '기준: 수출(관세제외)'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input type="text" placeholder="Article 검색..." value={fabricSearchTerm} onChange={(e) => setFabricSearchTerm(e.target.value.toUpperCase())} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white uppercase focus:ring-2 focus:ring-blue-500 transition-shadow" />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {fabricSearchTerm && <button onClick={() => setFabricSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto transition-shadow hover:shadow-md">
            <button onClick={handleBackupFabrics} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex transition-colors"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
            <button onClick={() => setIsBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex transition-colors"><Upload className="w-4 h-4" /> 엑셀</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Database className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">총 등록 원단</p><p className="text-xl font-extrabold text-slate-800">{filteredFabrics.length} <span className="text-sm font-normal text-slate-500">종</span></p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">현재 단가 모드</p><p className="text-xl font-extrabold text-slate-800">{viewMode === 'domestic' ? '내수용' : '수출용'}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">최근 업데이트</p><p className="text-xl font-extrabold text-slate-800">최신 유지 관리</p></div>
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto w-full relative h-[calc(100vh-250px)]">
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
              <th className="font-bold p-2 text-center border-r border-slate-200">Margin(%)</th>
              <th colSpan="3" className="font-bold p-2 text-center border-r border-slate-200 text-slate-500 bg-slate-50">CONV (도매 단가)</th>
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
            {filteredFabrics.map(f => (
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
              />
            ))}
            {filteredFabrics.length === 0 && (
              <tr>
                <td colSpan="13" className="p-16 text-center bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Search className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="text-lg font-bold text-slate-600 mb-1">검색 결과가 없거나 등록된 원단이 없습니다.</p>
                    <p className="text-sm">입력하신 조건과 일치하는 Article/ItemName이 없습니다.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4 pb-6">
        {filteredFabrics.map(f => (
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
          />
        ))}
        {filteredFabrics.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-sm">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-extrabold text-slate-700 mb-1">등록된 원단이 없습니다.</p>
            <p className="text-[11px] text-slate-400">검색 조건을 변경하거나 새 원단을 등록해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
