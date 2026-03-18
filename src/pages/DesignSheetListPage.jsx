import React, { useState } from 'react';
import { Search, Edit2, Trash2, Copy, Plus, Link, X, Check, FileText, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { STAGE_COLORS } from '../constants/common';
import { num } from '../utils/helpers';

/**
 * 설계서 보관함 — 최종 상태별 분류
 * - 아이템 등록됨 (아이템화 완료)
 * - 샘플 DROP (샘플 진행 후 미채택)
 * - 설계서 DROP (설계서만 작성하고 미진행)
 * 
 * 모든 설계서를 보관, 버전관리, 오더넘버 연결
 */
export const DesignSheetListPage = ({
  designSheets,
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

  // 카테고리 분류 로직
  const categorize = (sheet) => {
    if (sheet.stage === 'articled') return 'itemized';           // 아이템 등록됨
    if (sheet.status === 'dropped') return 'dropped';             // DROP (명시적 드롭)
    if (sheet.stage === 'draft' && sheet.status === 'dropped') return 'draftDrop';
    // 진행 중인 건은 개발현황에서 관리하므로 여기선 '전체' 필터에서만 노출
    return 'inProgress';
  };

  // 카테고리별 라벨/색상
  const categoryInfo = {
    itemized: { label: '아이템 등록', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', count: 0 },
    dropped: { label: 'DROP', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', count: 0 },
    inProgress: { label: '진행 중', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', count: 0 }
  };

  // 건수 카운트
  (designSheets || []).forEach(s => {
    const cat = categorize(s);
    if (categoryInfo[cat]) categoryInfo[cat].count++;
  });

  // 필터링
  const filteredSheets = (designSheets || []).filter(s => {
    const matchSearch =
      String(s.devOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.articleNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.buyerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.eztexOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const cat = categorize(s);
    const matchCategory = categoryFilter === 'All' || cat === categoryFilter;
    return matchSearch && matchCategory;
  }).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

  // 원사 이름
  const getYarnName = (yarnId) => {
    if (!yarnId) return '';
    const realId = String(yarnId).split('::')[0];
    return (yarnLibrary || []).find(y => String(y.id) === String(realId))?.name || '';
  };

  const getCompositionText = (yarns) => {
    return (yarns || []).filter(y => y?.yarnId && Number(y.ratio) > 0)
      .map(y => `${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ') || '-';
  };

  const getStageLabelAndColor = (stageKey) => {
    const colors = STAGE_COLORS[stageKey] || STAGE_COLORS.draft;
    const labels = { draft: '설계서 작성', confirmed: '진행 확정', eztex: 'EZ-TEX', sampling: '샘플 진행', articled: '아이템화' };
    return { label: labels[stageKey] || '작성중', ...colors };
  };

  // DROP 처리
  const handleDrop = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (window.confirm('이 설계서를 DROP(미진행) 처리하시겠습니까?\n(설계서는 보관함에 남아있습니다)')) {
      const updatedSheet = { ...sheet, status: 'dropped', updatedAt: new Date().toISOString() };
      saveDocToCloud?.('designSheets', updatedSheet);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
              <Archive className="w-5 h-5" />
            </div>
            설계서 보관함
          </h2>
          <p className="text-sm text-slate-500 mt-1">모든 설계서의 보관, 버전관리, 오더넘버 연결</p>
        </div>
        <button onClick={() => setActiveTab('designSheet')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95">
          <Plus className="w-4 h-4" /> 새 설계서
        </button>
      </div>

      {/* 카테고리 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setCategoryFilter('All')}
          className={`p-3 rounded-xl border-2 transition-all text-left ${categoryFilter === 'All' ? 'border-slate-400 bg-slate-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <p className="text-xl font-extrabold text-slate-800">{(designSheets || []).length}</p>
          <p className="text-xs font-bold text-slate-500">전체</p>
        </button>
        {Object.entries(categoryInfo).map(([key, info]) => (
          <button key={key} onClick={() => setCategoryFilter(categoryFilter === key ? 'All' : key)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${categoryFilter === key ? `${info.border} ${info.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <p className={`text-xl font-extrabold ${categoryFilter === key ? info.text : 'text-slate-800'}`}>{info.count}</p>
            <p className={`text-xs font-bold ${categoryFilter === key ? info.text : 'text-slate-500'}`}>{info.label}</p>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="text" placeholder="개발번호, 아티클, 바이어, EZ-TEX번호 검색..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 ring-blue-200 outline-none" />
      </div>

      {/* 설계서 카드 목록 */}
      <div className="space-y-3">
        {filteredSheets.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Archive className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="font-bold text-lg">해당하는 설계서가 없습니다</p>
          </div>
        )}

        {filteredSheets.map(sheet => {
          const isExpanded = expandedId === sheet.id;
          const stageInfo = getStageLabelAndColor(sheet.stage);
          const costData = getDesignCost?.(sheet);
          const cat = categorize(sheet);

          return (
            <div key={sheet.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:border-slate-300 transition-all ${
              sheet.status === 'dropped' ? 'border-red-200 opacity-75' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : sheet.id)}>
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  <span className="text-sm font-mono font-extrabold text-blue-600 shrink-0">{sheet.devOrderNo || '-'}</span>
                  {sheet.articleNo && <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">{sheet.articleNo}</span>}
                  {sheet.buyerName && <span className="text-sm font-bold text-slate-700 truncate">{sheet.buyerName}</span>}
                  {sheet.fabricName && <span className="text-xs text-slate-500 truncate">· {sheet.fabricName}</span>}
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>{stageInfo.label}</span>
                  {sheet.version > 1 && <span className="text-[10px] font-mono font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded shrink-0">v{sheet.version}</span>}
                  {sheet.status === 'dropped' && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">DROP</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {costData && (
                    <span className="hidden md:inline text-xs font-mono font-bold text-slate-500">
                      {viewMode === 'export' ? `$${(costData.tier3k?.export?.priceBrand || 0).toFixed(2)}` : `₩${num(costData.tier3k?.domestic?.priceBrand || 0)}`}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">EZ-TEX 번호</p><p className="text-sm text-slate-700 font-mono">{sheet.eztexOrderNo || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">담당자</p><p className="text-sm text-slate-700">{sheet.assignee || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">혼용률</p><p className="text-sm text-slate-700">{getCompositionText(sheet.yarns)}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">편직처</p><p className="text-sm text-slate-700">{sheet.knitting?.factory || '-'}</p></div>
                  </div>

                  {/* 오더넘버(O/N) 연결 */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">🔗 연결된 오더넘버 (O/N)</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(sheet.orderNumbers || []).length === 0 && <span className="text-xs text-slate-400">연결된 오더가 없습니다</span>}
                      {(sheet.orderNumbers || []).map(on => (
                        <span key={on} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-200">
                          {on}
                          <button onClick={(e) => { e.stopPropagation(); removeOrderNumber(sheet.id, on); }}
                            className="text-blue-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="오더넘버 입력..." value={orderInput}
                        onChange={(e) => setOrderInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') { addOrderNumber(sheet.id, orderInput); setOrderInput(''); } }}
                        className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-1 ring-blue-300 outline-none uppercase"
                        onClick={(e) => e.stopPropagation()} />
                      <button onClick={(e) => { e.stopPropagation(); addOrderNumber(sheet.id, orderInput); setOrderInput(''); }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors">
                        <Link className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 단가 */}
                  {costData && (
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-800 rounded-lg text-white">
                      {[{ label: '1K', tier: 'tier1k' }, { label: '3K', tier: 'tier3k' }, { label: '5K', tier: 'tier5k' }].map(({ label, tier }) => {
                        const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
                        const prefix = viewMode === 'export' ? '$' : '₩';
                        return (
                          <div key={tier} className="text-center">
                            <p className="text-[9px] text-slate-400 font-bold">{label} YDS</p>
                            <p className="text-sm font-extrabold">{prefix}{viewMode === 'export' ? (data?.priceBrand || 0).toFixed(2) : num(data?.priceBrand || 0)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    <button onClick={() => { handleEditSheet(sheet); setActiveTab('designSheet'); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      <Edit2 className="w-3 h-3" /> 수정
                    </button>
                    <button onClick={() => createImprovedVersion(sheet, user)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors">
                      <Copy className="w-3 h-3" /> 개선본(V{(sheet.version || 1) + 1}) 생성
                    </button>
                    {sheet.status !== 'dropped' && (
                      <button onClick={() => handleDrop(sheet.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        DROP
                      </button>
                    )}
                    <button onClick={() => handleDeleteSheet(sheet.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto">
                      <Trash2 className="w-3 h-3" /> 영구 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
