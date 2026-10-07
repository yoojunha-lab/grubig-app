import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud, Menu, Layers, Home, Globe, FileSpreadsheet, Box, FileText, LogOut, DollarSign, Activity, Archive,
  FileCheck, FlaskConical, LayoutDashboard, TrendingUp, ChevronDown, X, Boxes, FileSignature, SwatchBook, ExternalLink,
} from 'lucide-react';
import { rateLabel } from '../../utils/helpers';
import { useMarketRate, NAVER_FX_URL } from '../../hooks/useMarketRate';

// 공통 환율 칸 순서 (내수 → 수출)
const RATE_MARKETS = ['domestic', 'export'];
const RATE_SHORT = { domestic: '내수', export: '수출' };
const RATE_USE = {
  domestic: '내수 원가·내수 견적에 써요 (달러로 사는 원사 → 원화)',
  export: '수출 원가·수출 견적에 써요 (원화 원가 → 달러)',
};
// 화면 위 [내수|수출] 보기와 같은 쪽 칸을 색으로 강조
const RATE_ACTIVE = {
  domestic: 'bg-blue-500/15 ring-1 ring-blue-400/60',
  export: 'bg-emerald-500/15 ring-1 ring-emerald-400/60',
};
const RATE_TEXT = { domestic: 'text-blue-300', export: 'text-emerald-300' };

const fmtRate = (v) => Number(v || 0).toLocaleString();
const fmtLive = (v, digits = 1) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pad2 = (n) => String(n).padStart(2, '0');
// 실시간 환율 기준 시각 — 오늘이면 '09:22', 아니면 '10/06'
const fmtLiveTime = (d) => {
  if (!d) return '';
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
};

// 그룹 정의: 활성 탭이 어느 그룹에 속하는지 판단 + 드롭다운 항목 렌더링
const NAV_GROUPS = [
  {
    key: 'fabric',
    label: '원단',
    color: 'blue',
    items: [
      { tab: 'list',       label: '원단 관리', icon: FileSpreadsheet },
      { tab: 'yarns',      label: '원사 라이브러리', icon: Box },
    ],
  },
  {
    key: 'sales',
    label: '영업',
    color: 'indigo',
    items: [
      { tab: 'quotation',    label: '견적서', icon: FileText },
      { tab: 'proformaInvoice', label: 'PI / 거래확인서', icon: FileSignature },
      { tab: 'labdip',       label: 'Lab-Dip 발송', icon: SwatchBook },
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
  exchangeRates,        // 공통 환율 두 칸 { domestic: 내수 환율, export: 수출 환율 }
  exchangeRatesMeta,    // 칸마다 { updatedAt, updatedBy } | null(아직 공통 저장 전 — 수출은 '아직 따로 정하지 않음')
  onCommitExchangeRate, // 공통 환율 저장 (App.saveExchangeRate(market, value)) — 확인 후 회사 공통 설정에 저장
}) => {
  const [openGroup, setOpenGroup] = useState(null); // 현재 펼쳐진 그룹 key
  const navRef = useRef(null);

  // ── 공통 환율 입력 (내수 환율 · 수출 환율 두 칸 — 2026-10-07 대표님 요청) ──
  //   치는 동안은 칸에만 두고(draft), Enter·칸 밖 클릭 때 확인 후 저장
  //   (예전엔 한 글자 칠 때마다 바로 바뀌어 원가가 중간값으로 계산됐음. Esc = 입력 취소)
  const [rateDraft, setRateDraft] = useState({ domestic: null, export: null });
  const commitRate = (market) => {
    const draft = rateDraft[market];
    if (draft === null) return;
    setRateDraft(prev => ({ ...prev, [market]: null }));
    const v = Number(draft);
    const cur = Number(exchangeRates?.[market]);
    const saved = !!exchangeRatesMeta?.[market];
    // 같은 값이면 저장할 필요 없음 — 단, 아직 회사 공통으로 저장 전이면 지금 보이는 값 그대로도 공통으로 저장할 수 있게
    if (!(v > 0) || (v === cur && saved)) return;
    const label = rateLabel(market);
    // 수출 환율을 아직 따로 정하지 않았으면 내수 환율을 바꿀 때 같이 바뀜 (App.saveExchangeRate)
    const followNote = market === 'domestic' && !exchangeRatesMeta?.export
      ? `수출 환율은 아직 따로 정하지 않아서 같이 ₩${fmtRate(v)}로 바뀌어요.\n`
      : '';
    if (!window.confirm(
      (v === cur
        ? `지금 ${label} ₩${fmtRate(v)}을 회사 공통으로 저장합니다.\n\n`
        : `${label}을 ₩${fmtRate(cur)} → ₩${fmtRate(v)}로 바꿉니다.\n\n`) +
      `모든 직원의 ${market === 'export' ? '수출 원가·새 수출 견적' : '내수 원가·새 내수 견적'}에 바로 적용돼요.\n` +
      followNote +
      `이미 저장한 견적은 그 견적의 환율 그대로예요.\n\n계속할까요?`
    )) return;
    if (onCommitExchangeRate) onCommitExchangeRate(market, v);
  };
  const rateInputProps = (market) => ({
    type: 'number',
    value: rateDraft[market] ?? exchangeRates?.[market] ?? '',
    onChange: e => { const val = e.target.value; setRateDraft(prev => ({ ...prev, [market]: val })); },
    onBlur: () => commitRate(market),
    onKeyDown: e => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') setRateDraft(prev => ({ ...prev, [market]: null }));
    },
  });
  const rateTitle = (market) => {
    const label = rateLabel(market);
    const meta = exchangeRatesMeta?.[market];
    if (meta) {
      const when = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('ko-KR') : '-';
      return `${label} (전 직원 공통) — ${RATE_USE[market]}\n마지막 변경: ${when}${meta.updatedBy ? ` · ${meta.updatedBy}` : ''}\n바꾸려면 숫자 입력 후 Enter`;
    }
    if (market === 'export') {
      return `${label} — ${RATE_USE[market]}\n아직 따로 정하지 않아 내수 환율과 같은 값이에요. 숫자 입력 후 Enter로 저장하면 모든 직원에게 적용돼요.`;
    }
    return `${label} — ${RATE_USE[market]}\n아직 회사 공통으로 저장 전이라 이 PC 값이에요. 숫자 입력 후 Enter로 저장하면 모든 직원에게 적용돼요.`;
  };

  // ── 실시간 환율 (참고용 — 보기만, 내수·수출 환율은 바꾸지 않음) ──
  const live = useMarketRate();
  const liveTime = fmtLiveTime(live.at);
  const liveTitle = live.rate
    ? `실시간 환율 (참고용) ₩${fmtLive(live.rate, 2)}\n` +
      `${live.at ? `${live.at.toLocaleString('ko-KR')} 기준 · ` : ''}출처 ${live.source}\n` +
      `국제 시장 환율이라 은행 매매기준율과 1~3원쯤 다를 수 있어요.\n` +
      (live.error ? '⚠ 방금 새로 받아오지 못해 마지막으로 받은 값이에요.\n' : '') +
      `누르면 새로 받아와요 (10분마다 저절로). 내수·수출 환율은 옆 칸에 직접 넣어요.`
    : live.loading
      ? '실시간 환율을 받아오는 중이에요…'
      : '실시간 환율을 받아오지 못했어요 (인터넷 연결 확인). 누르면 다시 받아와요.';

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
          {/* 태블릿 폭(md)에서는 환율 칸 자리를 위해 글자를 숨김 */}
          <div className="hidden sm:block md:hidden lg:block">
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
                  className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
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

        {/* 우: 환율(내수·수출) + 실시간 환율 + 내수/수출 + 동기화 + 로그아웃 (데스크탑) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* 공통 환율 두 칸 — 지금 보기(내수/수출)와 같은 칸을 색으로 강조. 화면이 좁으면 ￦·아이콘은 숨김 */}
          <div className="flex items-center gap-0.5 bg-slate-800/40 p-1 rounded-lg border border-slate-700/50">
            <DollarSign className="w-3.5 h-3.5 text-yellow-500 mx-0.5 hidden xl:block" />
            {RATE_MARKETS.map(m => (
              <label
                key={m}
                title={rateTitle(m)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md cursor-text ${viewMode === m ? RATE_ACTIVE[m] : ''}`}
              >
                <span className={`text-[10px] font-bold whitespace-nowrap ${RATE_TEXT[m]}`}>{RATE_SHORT[m]}</span>
                <span className="text-yellow-500 font-bold text-[11px] hidden xl:inline">￦</span>
                <input
                  {...rateInputProps(m)}
                  className="w-12 bg-transparent border-none text-white text-right font-mono font-bold focus:ring-0 outline-none p-0 text-xs"
                  aria-label={rateLabel(m)}
                />
                {!exchangeRatesMeta?.[m] && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              </label>
            ))}
          </div>

          {/* 실시간 환율 (참고용) — 누르면 새로 받아옴 · ↗ 네이버 환율(은행 매매기준율). 화면이 좁으면 글자·시각은 숨김 */}
          <div className="hidden lg:flex items-center bg-slate-800/40 rounded-lg border border-slate-700/50 overflow-hidden">
            <button
              type="button"
              onClick={live.refresh}
              title={liveTitle}
              className="flex items-center gap-1 pl-2 pr-1.5 py-1.5 hover:bg-slate-700/40 transition-colors whitespace-nowrap"
            >
              <TrendingUp className={`w-3.5 h-3.5 text-sky-400 ${live.loading ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-bold text-slate-400 hidden xl:inline">실시간</span>
              <span className={`font-mono font-bold text-xs ${live.rate && !live.error ? 'text-white' : 'text-slate-500'}`}>
                {live.rate ? `￦${fmtLive(live.rate)}` : '—'}
              </span>
              {liveTime && <span className="text-[10px] font-mono text-slate-500 hidden xl:inline">{liveTime}</span>}
            </button>
            <a
              href={NAVER_FX_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="네이버 환율 (은행 매매기준율) — 새 창으로 열기"
              className="self-stretch flex items-center px-1.5 text-slate-500 hover:text-white hover:bg-slate-700/40 border-l border-slate-700/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 whitespace-nowrap">
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
                <DollarSign className="w-3.5 h-3.5 text-yellow-500" /> 공통 환율 (전 직원)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {RATE_MARKETS.map(m => (
                  <label
                    key={m}
                    className={`flex items-center gap-1.5 bg-slate-900/50 p-2 rounded-lg border ${viewMode === m ? `border-transparent ${RATE_ACTIVE[m]}` : 'border-slate-700'}`}
                  >
                    <span className={`text-[11px] font-bold shrink-0 ${RATE_TEXT[m]}`}>{RATE_SHORT[m]}</span>
                    <span className="text-yellow-500 font-bold text-sm">￦</span>
                    <input
                      {...rateInputProps(m)}
                      className="w-full min-w-0 bg-transparent border-none text-white text-right font-mono font-bold focus:ring-0 outline-none p-0 text-base"
                      aria-label={rateLabel(m)}
                    />
                    {!exchangeRatesMeta?.[m] && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                내수 = 달러 원사 → 원화 · 수출 = 원화 원가 → 달러. 입력 후 완료(Enter)하면 모든 직원에게 적용돼요.
                {!exchangeRatesMeta?.export && ' (수출 환율은 아직 따로 정하지 않아 내수 환율과 같은 값)'}
              </p>
              {/* 실시간 환율 (참고용) — 누르면 새로 받아옴 */}
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/50">
                <button type="button" onClick={live.refresh} className="flex items-center gap-1.5 text-left">
                  <TrendingUp className={`w-3.5 h-3.5 text-sky-400 ${live.loading ? 'animate-pulse' : ''}`} />
                  <span className="text-[11px] font-bold text-slate-400">실시간</span>
                  <span className={`font-mono font-bold text-sm ${live.rate && !live.error ? 'text-white' : 'text-slate-500'}`}>
                    {live.rate ? `￦${fmtLive(live.rate)}` : '—'}
                  </span>
                  {liveTime && <span className="text-[10px] font-mono text-slate-500">{liveTime}</span>}
                </button>
                <a href={NAVER_FX_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white shrink-0">
                  네이버 환율 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {live.rate ? '참고용 시장 환율 — 은행 기준율과 1~3원 다를 수 있어요. 누르면 새로 받아와요.' : liveTitle}
              </p>
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
