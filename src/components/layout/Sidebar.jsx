import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud, Menu, Layers, Home, Globe, Calculator, FileSpreadsheet, Box, FileText,
  Calendar, LogOut, DollarSign, Activity, Archive, FileCheck, FlaskConical,
  ClipboardEdit, LayoutDashboard, TrendingUp, ChevronDown, X, Boxes,
} from 'lucide-react';

// 그룹 정의: 활성 탭이 어느 그룹에 속하는지 판단 + 드롭다운 항목 렌더링
const NAV_GROUPS = [
  {
    key: 'fabric',
    label: '원단',
    color: 'blue',
    items: [
      { tab: 'calculator', label: '새 원단 등록', icon: Calculator },
      { tab: 'list',       label: '원단 리스트', icon: FileSpreadsheet },
      { tab: 'yarns',      label: '원사 라이브러리', icon: Box },
    ],
  },
  {
    key: 'sales',
    label: '영업',
    color: 'indigo',
    items: [
      { tab: 'quotation',    label: '견적서 작성', icon: FileText },
      { tab: 'quoteHistory', label: '견적 히스토리', icon: Calendar },
      { tab: 'collection',   label: '컬렉션 관리', icon: Boxes },
    ],
  },
  {
    key: 'development',
    label: '개발',
    color: 'violet',
    items: [
      { tab: 'mainDetail', label: '메인/QC 디테일 시트', icon: FileCheck },
      { tab: 'devStatus',  label: '개발/설계 현황', icon: Activity },
      { tab: 'designList', label: '설계서 보관함', icon: Archive },
      { tab: 'tempDesign', label: '가설계서 (레시피)', icon: FlaskConical },
    ],
  },
  {
    key: 'production',
    label: '생산',
    color: 'teal',
    items: [
      { tab: 'orderList',   label: '생산 현황', icon: LayoutDashboard },
      { tab: 'orderWizard', label: '오더 등록', icon: ClipboardEdit },
      { tab: 'orderReport', label: '리포트', icon: TrendingUp },
    ],
  },
];

// 그룹 컬러 → Tailwind 클래스 매핑
const GROUP_COLOR_CLASSES = {
  blue:   { active: 'from-blue-600 to-blue-500 shadow-blue-500/20',     hover: 'hover:bg-blue-500/10 hover:text-blue-300',     dot: 'bg-blue-400' },
  indigo: { active: 'from-indigo-600 to-indigo-500 shadow-indigo-500/20', hover: 'hover:bg-indigo-500/10 hover:text-indigo-300', dot: 'bg-indigo-400' },
  violet: { active: 'from-violet-600 to-purple-500 shadow-violet-500/20', hover: 'hover:bg-violet-500/10 hover:text-violet-300', dot: 'bg-violet-400' },
  teal:   { active: 'from-teal-600 to-cyan-500 shadow-teal-500/20',     hover: 'hover:bg-teal-500/10 hover:text-teal-300',     dot: 'bg-teal-400' },
};

export const Sidebar = ({
  isMobileMenuOpen, setIsMobileMenuOpen,
  activeTab, setActiveTab,
  viewMode, setViewMode,
  syncStatus, handleLogout,
  globalExchangeRate, setGlobalExchangeRate,
}) => {
  const [openGroup, setOpenGroup] = useState(null); // 현재 펼쳐진 그룹 key
  const navRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!openGroup) return;
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openGroup]);

  // 활성 탭이 어느 그룹에 속하는지 찾기
  const activeGroupKey = NAV_GROUPS.find(g => g.items.some(it => it.tab === activeTab))?.key;

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setOpenGroup(null);
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-40 bg-slate-900 text-slate-300 border-b border-slate-800/50 shadow-xl print:hidden"
    >
      {/* ─────────── 데스크탑 + 모바일 공통: 상단 바 ─────────── */}
      <div className="flex items-center justify-between px-3 md:px-5 h-[60px] gap-3">
        {/* 좌: 로고 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-extrabold text-white tracking-tight leading-none">GRUBIG</h1>
            <p className="text-[9px] text-blue-300/80 font-mono uppercase tracking-widest mt-0.5">ERP</p>
          </div>
        </div>

        {/* 중: 그룹 메뉴 (데스크탑만) */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {NAV_GROUPS.map(group => {
            const isActiveGroup = activeGroupKey === group.key;
            const isOpen = openGroup === group.key;
            const colors = GROUP_COLOR_CLASSES[group.color];
            return (
              <div key={group.key} className="relative">
                <button
                  onClick={() => setOpenGroup(isOpen ? null : group.key)}
                  className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActiveGroup
                      ? `bg-gradient-to-r ${colors.active} text-white shadow-lg`
                      : `text-slate-400 ${colors.hover}`
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* 드롭다운 */}
                {isOpen && (
                  <div className="absolute left-0 mt-2 w-60 bg-slate-900 border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const isActiveItem = activeTab === item.tab;
                      return (
                        <button
                          key={item.tab}
                          onClick={() => handleSelectTab(item.tab)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            isActiveItem
                              ? `bg-gradient-to-r ${colors.active} text-white`
                              : `text-slate-300 ${colors.hover}`
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {isActiveItem && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${colors.dot}`} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 우: 환율 + 내수/수출 + 동기화 + 로그아웃 (데스크탑) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
            <DollarSign className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-yellow-500 font-bold text-xs">￦</span>
            <input
              type="number"
              value={globalExchangeRate}
              onChange={e => setGlobalExchangeRate(Number(e.target.value))}
              className="w-14 bg-transparent border-none text-white text-right font-mono font-bold focus:ring-0 outline-none p-0 text-xs"
              title="전역 적용 환율"
            />
            <span className="text-slate-500 text-[10px]">/$</span>
          </div>

          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setViewMode('domestic')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                viewMode === 'domestic'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Home className="w-3 h-3" /> 내수
            </button>
            <button
              onClick={() => setViewMode('export')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                viewMode === 'export'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3" /> 수출
            </button>
          </div>

          <Cloud
            className={`w-4 h-4 drop-shadow-md ${syncStatus === 'syncing' ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'}`}
            title={syncStatus === 'syncing' ? '동기화 중...' : '안전하게 저장됨'}
          />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all active:scale-95"
            title="로그아웃"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 모바일 햄버거 */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ─────────── 모바일 메뉴 (슬라이드 다운) ─────────── */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/50 max-h-[calc(100vh-60px)] overflow-y-auto">
          {/* 환율 + 내수/수출 */}
          <div className="p-4 space-y-3 border-b border-slate-800/50">
            <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
              <label className="text-[10px] text-slate-400 font-bold mb-2 block uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-yellow-500" /> 전역 적용 환율
              </label>
              <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <span className="text-yellow-500 font-bold text-sm pl-1">￦</span>
                <input
                  type="number"
                  value={globalExchangeRate}
                  onChange={e => setGlobalExchangeRate(Number(e.target.value))}
                  className="w-full bg-transparent border-none text-white text-right font-mono font-bold focus:ring-0 outline-none p-0 text-base"
                />
                <span className="text-slate-500 font-bold text-xs pr-1">/ $</span>
              </div>
            </div>

            <div className="bg-slate-800/50 p-1.5 rounded-xl flex text-xs font-bold border border-slate-700/50">
              <button
                onClick={() => setViewMode('domestic')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  viewMode === 'domestic'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                    : 'text-slate-400'
                }`}
              >
                <Home className="w-3.5 h-3.5" /> 내수
              </button>
              <button
                onClick={() => setViewMode('export')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  viewMode === 'export'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md'
                    : 'text-slate-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> 수출
              </button>
            </div>
          </div>

          {/* 그룹별 메뉴 */}
          <nav className="p-3 space-y-4">
            {NAV_GROUPS.map(group => {
              const colors = GROUP_COLOR_CLASSES[group.color];
              return (
                <div key={group.key}>
                  <p className="px-2 text-[10px] font-extrabold text-slate-500 mb-2 uppercase tracking-widest">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.tab;
                      return (
                        <button
                          key={item.tab}
                          onClick={() => handleSelectTab(item.tab)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                            isActive
                              ? `bg-gradient-to-r ${colors.active} text-white shadow-lg`
                              : 'hover:bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* 로그아웃 + 동기화 */}
          <div className="p-3 border-t border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Cloud className={`w-4 h-4 ${syncStatus === 'syncing' ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'}`} />
              {syncStatus === 'syncing' ? '동기화 중...' : '저장됨'}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" /> 로그아웃
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
