import React from 'react';
import { Cloud, Menu, Layers, Home, Globe, Calculator, FileSpreadsheet, Box, FileText, Calendar, LogOut, DollarSign, Edit2, Activity, Archive } from 'lucide-react';

export const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen, activeTab, setActiveTab, viewMode, setViewMode, syncStatus, handleLogout, globalExchangeRate, setGlobalExchangeRate }) => {
  return (
    <>
      <div className="md:hidden bg-slate-900/90 backdrop-blur-md text-white p-4 flex justify-between items-center z-50 sticky top-0 h-[60px] border-b border-slate-800/50 shadow-sm print:hidden">
        <div className="font-extrabold flex items-center gap-2.5 tracking-tight"><Cloud className="w-5 h-5 text-blue-400 drop-shadow-md" /> GRUBIG ERP</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"><Menu className="w-5 h-5" /></button>
      </div>

      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:flex w-full md:w-64 bg-slate-900 text-slate-300 p-4 xl:p-5 flex-col shrink-0 print:hidden absolute top-[60px] md:top-0 md:relative z-40 h-[calc(100vh-60px)] md:min-h-screen overflow-y-auto border-r border-slate-800/50 shadow-xl md:shadow-none`}>
        <div className="flex items-center justify-between mb-8 px-2 mt-2 md:mt-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Fabric Cost</h1>
              <p className="text-[10px] text-blue-300/80 font-mono uppercase tracking-widest mt-0.5">Master Manager</p>
            </div>
          </div>
          {syncStatus === 'syncing' ? <Cloud className="w-4 h-4 text-yellow-400 animate-pulse drop-shadow-md" title="동기화 중..." /> : <Cloud className="w-4 h-4 text-emerald-400 drop-shadow-md" title="안전하게 저장됨" />}
        </div>
        
        <div className="mb-6 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
          <label className="text-[10px] text-slate-400 font-bold mb-2 block uppercase tracking-wider flex items-center gap-1"><DollarSign className="w-4 h-4 text-yellow-500" /> 전역 적용 환율 (Global)</label>
          <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
            <span className="text-yellow-500 font-bold text-sm pl-1">￦</span>
            <input type="number" value={globalExchangeRate} onChange={e => setGlobalExchangeRate(Number(e.target.value))} className="w-full bg-transparent border-none text-white text-right font-mono font-bold focus:ring-0 outline-none p-0 text-base" />
            <span className="text-slate-500 font-bold text-xs pr-1">/ $</span>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-1.5 rounded-xl mb-6 flex text-xs font-bold border border-slate-700/50 shadow-inner">
          <button onClick={() => setViewMode('domestic')} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${viewMode === 'domestic' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-900/50 translate-x-0' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'}`}><Home className="w-3.5 h-3.5" /> 내수</button>
          <button onClick={() => setViewMode('export')} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${viewMode === 'export' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-900/50 -translate-x-0' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'}`}><Globe className="w-3.5 h-3.5" /> 수출</button>
        </div>

        <nav className="flex-1 space-y-1.5">
          <button onClick={() => { setActiveTab('calculator'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'calculator' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><Calculator className="w-4 h-4" /> <span>새 원단 등록</span></button>
          <button onClick={() => { setActiveTab('list'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'list' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><FileSpreadsheet className="w-4 h-4" /> <span>원단 리스트</span></button>
          <button onClick={() => { setActiveTab('yarns'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'yarns' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><Box className="w-4 h-4" /> <span>원사 라이브러리</span></button>
          
          {/* Sales & Export */}
          <div className="pt-6 mt-6 border-t border-slate-800/80">
            <p className="px-4 text-[10px] font-extrabold text-slate-500 mb-2.5 uppercase tracking-widest">Sales & Export</p>
            <div className="space-y-1.5">
              <button onClick={() => { setActiveTab('quotation'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'quotation' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><FileText className="w-4 h-4" /> <span>견적서 작성</span></button>
              <button onClick={() => { setActiveTab('quoteHistory'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'quoteHistory' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><Calendar className="w-4 h-4" /> <span>견적 히스토리</span></button>
            </div>
          </div>

          {/* Development — 통합 */}
          <div className="pt-6 mt-6 border-t border-slate-800/80">
            <p className="px-4 text-[10px] font-extrabold text-slate-500 mb-2.5 uppercase tracking-widest">Development</p>
            <div className="space-y-1.5">
              <button onClick={() => { setActiveTab('devStatus'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'devStatus' ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><Activity className="w-4 h-4" /> <span>개발/설계 현황</span></button>
              <button onClick={() => { setActiveTab('designList'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-medium ${activeTab === 'designList' ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/20 translate-x-1' : 'hover:bg-slate-800 hover:translate-x-1 text-slate-400'}`}><Archive className="w-4 h-4" /> <span>설계서 보관함</span></button>
            </div>
          </div>
        </nav>
        
        <button onClick={handleLogout} className="mt-8 flex items-center justify-center gap-2 px-4 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all duration-300 active:scale-95 w-full"><LogOut className="w-4 h-4" /> 로그아웃</button>
      </div>
    </>
  );
};
