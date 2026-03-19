import React, { useState, useMemo } from 'react';
import { Search, Edit2, Trash2, Copy, Plus, Link, X, Check, FileText, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { STAGE_COLORS } from '../constants/common';
import { num } from '../utils/helpers';

/**
 * 설계서 보관함 — 최종 상태별 분류
 * - 아이템 등록: Article 번호 우선, 같은 설계서 V1/V2/V3 그룹핑
 * - DROP: EZ-TEX O/D NO. 기준 관리
 * - 진행 중: 개발현황에서 관리 (여기선 전체 필터에서만 노출)
 */
export const DesignSheetListPage = ({
  designSheets,
  devRequests,
  handleEditSheet,
  handleDeleteSheet,
  createImprovedVersion,
  addOrderNumber,
  removeOrderNumber,
  advanceStage,
  getDesignCost,
  setActiveTab,
  user,
  viewMode,
  yarnLibrary,
  saveDocToCloud
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [orderInput, setOrderInput] = useState('');

  // 카테고리 분류
  const categorize = (sheet) => {
    if (sheet.stage === 'articled') return 'itemized';
    if (sheet.status === 'dropped') return 'dropped';
    return 'inProgress';
  };

  const categoryInfo = {
    itemized: { label: '아이템 등록', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', count: 0 },
    dropped: { label: 'DROP', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', count: 0 },
    inProgress: { label: '진행 중', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', count: 0 }
  };

  (designSheets || []).forEach(s => {
    const cat = categorize(s);
    if (categoryInfo[cat]) categoryInfo[cat].count++;
  });

  // 검색 필터
  const matchSearch = (s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return String(s.devOrderNo || '').toLowerCase().includes(q) ||
      String(s.articleNo || '').toLowerCase().includes(q) ||
      String(s.eztexOrderNo || '').toLowerCase().includes(q) ||
      String(s.fabricName || '').toLowerCase().includes(q);
  };

  // === 아이템화: Article 기준 그룹핑 (rootId 또는 자기자신 기준) ===
  const itemizedGroups = useMemo(() => {
    const articled = (designSheets || []).filter(s => s.stage === 'articled' && matchSearch(s));
    // rootId 기준으로 그룹핑 (rootId = parentId가 없으면 자기 자신)
    const groups = {};
    articled.forEach(s => {
      const rootId = s.parentId || s.id;
      if (!groups[rootId]) groups[rootId] = [];
      groups[rootId].push(s);
    });
    // 각 그룹 내에서 version 정렬
    Object.values(groups).forEach(group => group.sort((a, b) => (a.version || 1) - (b.version || 1)));
    // 그룹을 최신 updatedAt 기준으로 정렬
    return Object.values(groups).sort((a, b) => {
      const latestA = a[a.length - 1]?.updatedAt || '';
      const latestB = b[b.length - 1]?.updatedAt || '';
      return latestB.localeCompare(latestA);
    });
  }, [designSheets, searchTerm]);

  // === DROP: EZ-TEX O/D NO. 기준 정렬 ===
  const droppedSheets = useMemo(() => {
    return (designSheets || [])
      .filter(s => s.status === 'dropped' && matchSearch(s))
      .sort((a, b) => {
        // EZ-TEX O/D NO.가 있는 것 우선, 그 안에서 EZ-TEX 기준 정렬
        const aEz = a.eztexOrderNo || '';
        const bEz = b.eztexOrderNo || '';
        if (aEz && !bEz) return -1;
        if (!aEz && bEz) return 1;
        return bEz.localeCompare(aEz) || (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [designSheets, searchTerm]);

  // === 진행 중 ===
  const inProgressSheets = useMemo(() => {
    return (designSheets || [])
      .filter(s => s.stage !== 'articled' && s.status !== 'dropped' && matchSearch(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [designSheets, searchTerm]);

  // 유틸
  const getYarnName = (yarnId) => {
    if (!yarnId) return '';
    return (yarnLibrary || []).find(y => String(y.id) === String(yarnId).split('::')[0])?.name || '';
  };
  const getCompositionText = (yarns) => (yarns || []).filter(y => y?.yarnId && Number(y.ratio) > 0)
    .map(y => `${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ') || '-';
  const getStageLabelAndColor = (stageKey) => {
    const colors = STAGE_COLORS[stageKey] || STAGE_COLORS.draft;
    const labels = { draft: '설계서 작성', eztex: 'EZ-TEX O/D NO.', sampling: '샘플 진행', articled: '아이템화' };
    return { label: labels[stageKey] || '작성중', ...colors };
  };
  const getLinkedBuyer = (sheet) => {
    const ld = (devRequests||[]).find(d=>d.id===sheet.devRequestId);
    return ld?.buyerName || '';
  };

  const handleDrop = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (window.confirm('이 설계서를 DROP(미진행) 처리하시겠습니까?\n(설계서는 보관함에 남아있습니다)')) {
      saveDocToCloud?.('designSheets', { ...sheet, status: 'dropped', updatedAt: new Date().toISOString() });
    }
  };

  // 공통 시트 카드 (아이템/DROP/진행중 공용)
  const SheetCard = ({ sheet, showArticlePrimary = false, showEztexPrimary = false }) => {
    const isExpanded = expandedId === sheet.id;
    const stageInfo = getStageLabelAndColor(sheet.stage);
    const costData = getDesignCost?.(sheet);
    const buyer = getLinkedBuyer(sheet);

    return (
      <div className={`bg-white rounded-lg border shadow-sm overflow-hidden hover:border-slate-300 transition-all ${
        sheet.status === 'dropped' ? 'border-red-200 opacity-75' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : sheet.id)}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
            {/* 아이템화: Article 우선 표시 */}
            {showArticlePrimary && sheet.articleNo && (
              <span className="text-sm font-mono font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">{sheet.articleNo}</span>
            )}
            {/* DROP: EZ-TEX 우선 표시 */}
            {showEztexPrimary && sheet.eztexOrderNo && (
              <span className="text-sm font-mono font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md shrink-0">{sheet.eztexOrderNo}</span>
            )}
            <span className={`text-xs font-mono font-bold ${showArticlePrimary || showEztexPrimary ? 'text-slate-400' : 'text-blue-600 text-sm font-extrabold'} shrink-0`}>{sheet.devOrderNo || '-'}</span>
            {buyer && <span className="text-xs font-bold text-slate-700 truncate">{buyer}</span>}
            {sheet.fabricName && <span className="text-xs text-slate-500 truncate">· {sheet.fabricName}</span>}
            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>{stageInfo.label}</span>
            {sheet.version > 1 && <span className="text-[10px] font-mono font-bold text-violet-500 bg-violet-50 px-1 py-0.5 rounded shrink-0">v{sheet.version}</span>}
            {sheet.status === 'dropped' && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">DROP</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {costData && (
              <span className="hidden md:inline text-xs font-mono font-bold text-slate-500">
                {viewMode === 'export' ? `$${(costData.tier3k?.export?.priceBrand || 0).toFixed(2)}` : `₩${num(costData.tier3k?.domestic?.priceBrand || 0)}`}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-100 p-3 bg-slate-50/50 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">원단명</p><p className="text-slate-700">{sheet.fabricName || '-'}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">EZ-TEX O/D NO.</p><p className="text-slate-700 font-mono">{sheet.eztexOrderNo || '-'}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">혼용률</p><p className="text-slate-700">{getCompositionText(sheet.yarns)}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">편직처</p><p className="text-slate-700">{sheet.knitting?.factory || '-'}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">염가공처</p><p className="text-slate-700">{sheet.dyeing?.factory || '-'}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">후가공</p><p className="text-slate-700">{sheet.finishing?.type || '-'}</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">내폭/외폭</p><p className="text-slate-700 font-mono">{sheet.costInput?.widthCut||'-'}"/{sheet.costInput?.widthFull||'-'}"</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">GSM</p><p className="text-slate-700 font-mono">{sheet.costInput?.gsm||'-'}</p></div>
            </div>

            {/* 오더넘버(O/N) */}
            <div className="p-2 bg-white rounded border border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5">🔗 연결된 오더넘버</p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {(sheet.orderNumbers || []).length === 0 && <span className="text-[10px] text-slate-400">없음</span>}
                {(sheet.orderNumbers || []).map(on => (
                  <span key={on} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                    {on}
                    <button onClick={(e) => { e.stopPropagation(); removeOrderNumber(sheet.id, on); }}
                      className="text-blue-400 hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="text" placeholder="오더넘버" value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addOrderNumber(sheet.id, orderInput); setOrderInput(''); } }}
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-[10px] font-mono focus:ring-1 ring-blue-300 outline-none uppercase"
                  onClick={(e) => e.stopPropagation()} />
                <button onClick={(e) => { e.stopPropagation(); addOrderNumber(sheet.id, orderInput); setOrderInput(''); }}
                  className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700">
                  <Link className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 단가 */}
            {costData && (
              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-800 rounded text-white">
                {[{ label: '1K', tier: 'tier1k' }, { label: '3K', tier: 'tier3k' }, { label: '5K', tier: 'tier5k' }].map(({ label, tier }) => {
                  const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
                  const prefix = viewMode === 'export' ? '$' : '₩';
                  return (
                    <div key={tier} className="text-center">
                      <p className="text-[8px] text-slate-400 font-bold">{label} YDS</p>
                      <p className="text-xs font-extrabold">{prefix}{viewMode === 'export' ? (data?.priceBrand || 0).toFixed(2) : num(data?.priceBrand || 0)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 액션 */}
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200">
              <button onClick={() => { handleEditSheet(sheet); setActiveTab('designSheet'); }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100">
                <Edit2 className="w-3 h-3" /> 수정
              </button>
              <button onClick={() => createImprovedVersion(sheet, user)}
                disabled={sheet.stage !== 'articled'}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded ${
                  sheet.stage === 'articled' ? 'text-violet-600 bg-violet-50 hover:bg-violet-100' : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                }`}>
                <Copy className="w-3 h-3" /> 개선본(V{(sheet.version || 1) + 1})
              </button>
              {sheet.status !== 'dropped' && (
                <button onClick={() => handleDrop(sheet.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-600 bg-orange-50 rounded hover:bg-orange-100">
                  DROP
                </button>
              )}
              <button onClick={() => handleDeleteSheet(sheet.id)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded hover:bg-red-100 ml-auto">
                <Trash2 className="w-3 h-3" /> 삭제
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 보여줄 목록 결정
  const shouldShow = (cat) => categoryFilter === 'All' || categoryFilter === cat;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Archive className="w-4 h-4" />
            </div>
            설계서 보관함
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">아이템 관리 · 버전 관리 · 오더넘버 연결</p>
        </div>
        <button onClick={() => setActiveTab('designSheet')}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
          <Plus className="w-3.5 h-3.5" /> 새 설계서
        </button>
      </div>

      {/* 카테고리 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button onClick={() => setCategoryFilter('All')}
          className={`p-2.5 rounded-lg border-2 transition-all text-left ${categoryFilter === 'All' ? 'border-slate-400 bg-slate-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <p className="text-lg font-extrabold text-slate-800">{(designSheets || []).length}</p>
          <p className="text-[10px] font-bold text-slate-500">전체</p>
        </button>
        {Object.entries(categoryInfo).map(([key, info]) => (
          <button key={key} onClick={() => setCategoryFilter(categoryFilter === key ? 'All' : key)}
            className={`p-2.5 rounded-lg border-2 transition-all text-left ${categoryFilter === key ? `${info.border} ${info.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <p className={`text-lg font-extrabold ${categoryFilter === key ? info.text : 'text-slate-800'}`}>{info.count}</p>
            <p className={`text-[10px] font-bold ${categoryFilter === key ? info.text : 'text-slate-500'}`}>{info.label}</p>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="text" placeholder="Article, 개발번호, EZ-TEX O/D NO., 원단명 검색..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-2 ring-blue-200 outline-none" />
      </div>

      {/* === 아이템 등록 (Article 기준 그룹) === */}
      {shouldShow('itemized') && itemizedGroups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Check className="w-3 h-3"/> 아이템 등록 ({categoryInfo.itemized.count}건)
            <span className="text-slate-400 font-normal normal-case">— Article 기준, 버전별 관리</span>
          </h3>
          {itemizedGroups.map(group => {
            const primary = group[group.length - 1]; // 최신 버전이 대표
            return (
              <div key={primary.id} className="space-y-1">
                {/* 버전이 여러 개면 그룹 헤더 */}
                {group.length > 1 && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 rounded-t border border-emerald-200 border-b-0">
                    <span className="text-[10px] font-extrabold text-emerald-700">{primary.articleNo || primary.devOrderNo}</span>
                    <span className="text-[10px] text-emerald-500">— {group.length}개 버전</span>
                  </div>
                )}
                {group.map(sheet => (
                  <SheetCard key={sheet.id} sheet={sheet} showArticlePrimary={true} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* === DROP (EZ-TEX O/D NO. 기준) === */}
      {shouldShow('dropped') && droppedSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-red-500 uppercase tracking-wider flex items-center gap-1">
            <X className="w-3 h-3"/> DROP ({categoryInfo.dropped.count}건)
            <span className="text-slate-400 font-normal normal-case">— EZ-TEX O/D NO. 기준 관리</span>
          </h3>
          {droppedSheets.map(sheet => (
            <SheetCard key={sheet.id} sheet={sheet} showEztexPrimary={true} />
          ))}
        </div>
      )}

      {/* === 진행 중 === */}
      {shouldShow('inProgress') && inProgressSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3"/> 진행 중 ({categoryInfo.inProgress.count}건)
            <span className="text-slate-400 font-normal normal-case">— 개발현황에서 관리</span>
          </h3>
          {inProgressSheets.map(sheet => (
            <SheetCard key={sheet.id} sheet={sheet} />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {(designSheets || []).length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p className="font-bold">설계서가 없습니다</p>
          <button onClick={() => setActiveTab('designSheet')} className="mt-2 text-xs text-blue-600 font-bold hover:underline">+ 새 설계서</button>
        </div>
      )}
    </div>
  );
};
