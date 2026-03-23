import React, { useState, useMemo, useRef } from 'react';
import { Search, Edit2, Trash2, Plus, X, Check, FileText, Archive, ChevronDown, ChevronUp, RotateCcw, History } from 'lucide-react';
import { STAGE_COLORS } from '../constants/common';
import { num } from '../utils/helpers';

/**
 * 설계서 보관함
 * - 아이템 등록: Article 기준
 * - DROP: EZ-TEX O/D NO. 기준, 데이터 보관만, 복원 가능
 * - 진행 중: 개발현황에서 관리
 * - 변경 이력: 수정된 항목의 과거 값 + 변경사유 타임라인 표시
 */
export const DesignSheetListPage = ({
  designSheets,
  devRequests,
  handleEditSheet,
  handleDeleteSheet,
  advanceStage,
  getDesignCost,
  setActiveTab,
  user,
  viewMode,
  yarnLibrary,
  saveDocToCloud,
  restoreFromDrop
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [showHistoryFor, setShowHistoryFor] = useState({});
  const eztexInputRef = useRef({});

  // 카테고리 분류
  const categorize = (sheet) => {
    if (sheet.stage === 'articled' && sheet.status !== 'dropped') return 'itemized';
    if (sheet.status === 'dropped') return 'dropped';
    return 'inProgress';
  };

  const categoryInfo = {
    itemized: { label: '아이템 등록', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', count: 0 },
    dropped: { label: 'DROP', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', count: 0 },
    inProgress: { label: '진행 중', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', count: 0 }
  };

  // 활성 설계서만 카운트
  (designSheets || []).filter(s => !s.isArchived).forEach(s => {
    const cat = categorize(s);
    if (categoryInfo[cat]) categoryInfo[cat].count++;
  });

  const matchSearch = (s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return String(s.devOrderNo || '').toLowerCase().includes(q) ||
      String(s.articleNo || '').toLowerCase().includes(q) ||
      String(s.eztexOrderNo || '').toLowerCase().includes(q) ||
      String(s.fabricName || '').toLowerCase().includes(q);
  };

  // === 아이템화 ===
  const itemizedSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.stage === 'articled' && s.status !== 'dropped' && !s.isArchived && matchSearch(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm]);

  // === DROP ===
  const droppedSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.status === 'dropped' && matchSearch(s))
      .sort((a, b) => {
        const aEz = a.eztexOrderNo || '', bEz = b.eztexOrderNo || '';
        if (aEz && !bEz) return -1;
        if (!aEz && bEz) return 1;
        return bEz.localeCompare(aEz) || (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }),
  [designSheets, searchTerm]);

  // === 진행 중 ===
  const inProgressSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.stage !== 'articled' && s.status !== 'dropped' && !s.isArchived && matchSearch(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm]);

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
  const getLinkedBuyer = (sheet) => (devRequests||[]).find(d=>d.id===sheet.devRequestId)?.buyerName || '';

  const handleDrop = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (window.confirm('이 설계서를 DROP 처리하시겠습니까?\n(보관함에 남아있습니다)')) {
      saveDocToCloud?.('designSheets', { ...sheet, status: 'dropped', updatedAt: new Date().toISOString() });
    }
  };

  // EZ-TEX O/D NO. 수정
  const handleUpdateEztex = (sheetId) => {
    const val = eztexInputRef.current[sheetId]?.value?.trim().toUpperCase();
    if (!val) return;
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    saveDocToCloud?.('designSheets', { ...sheet, eztexOrderNo: val, updatedAt: new Date().toISOString() });
  };

  // 변경 이력 필드명 → 한국어
  const FIELD_LABELS = {
    fabricName: '원단명', eztexOrderNo: 'EZ-TEX O/D NO.', articleNo: 'Article', deadline: '납기', devOrderNo: '개발번호',
    'knitting.factory': '편직처', 'knitting.structure': '조직', 'knitting.machineType': '기종',
    'knitting.gauge': '게이지', 'knitting.machineInch': '인치', 'knitting.needleCount': '침수',
    'knitting.feederCount': '피더수', 'knitting.remarks': '편직 특이사항',
    'dyeing.factory': '염가공처', 'dyeing.dyedWidth': '염색 후 폭', 'dyeing.tenterWidth': '텐타폭',
    'dyeing.tenterTemp': '텐타온도', 'dyeing.fabricSpeed': '포속', 'dyeing.overFeeder': '오버피더',
    'dyeing.processMethod': '가공방법', 'dyeing.remarks': '염가공 특이사항',
    'finishing.factory': '후가공업체', 'finishing.type': '후가공종류', 'finishing.method': '후가공방법', 'finishing.remarks': '후가공 특이사항',
    'actualData.greigeWeight': '생지중량', 'actualData.finishedWidthCut': '내폭', 'actualData.finishedWidthFull': '외폭',
    'actualData.finishedGsm': 'GSM', 'actualData.remarks': '실측 메모',
    'costInput.widthFull': '외폭(Cost)', 'costInput.widthCut': '내폭(Cost)', 'costInput.gsm': 'GSM(Cost)',
    'costInput.costGYd': 'G/YD', 'costInput.knittingFee1k': '편직비1K', 'costInput.knittingFee3k': '편직비3K',
    'costInput.knittingFee5k': '편직비5K', 'costInput.dyeingFee': '염가공비',
    'costInput.extraFee1k': '부대비1K', 'costInput.extraFee3k': '부대비3K', 'costInput.extraFee5k': '부대비5K',
    'costInput.marginTier': '마진등급'
  };

  // 공통 시트 카드
  const renderSheetCard = (sheet, { showArticlePrimary = false, showEztexPrimary = false, isDropped = false } = {}) => {
    const isExpanded = expandedId === sheet.id;
    const stageInfo = getStageLabelAndColor(sheet.stage);
    const costData = getDesignCost?.(sheet);
    const buyer = getLinkedBuyer(sheet);
    const history = sheet.changeHistory || [];

    return (
      <div key={sheet.id} className={`bg-white rounded-lg border shadow-sm overflow-hidden hover:border-slate-300 transition-all ${
        isDropped ? 'border-red-200 opacity-75' : 'border-slate-200'
      }`}>
        <div className="flex items-start justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-50/50"
          onClick={() => setExpandedId(isExpanded ? null : sheet.id)}>
          <div className="min-w-0 flex-1">
            {/* 1줄: 식별 정보 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {showArticlePrimary && sheet.articleNo && (
                <span className="text-sm font-mono font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">{sheet.articleNo}</span>
              )}
              {showEztexPrimary && sheet.eztexOrderNo && (
                <span className="text-sm font-mono font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md shrink-0">{sheet.eztexOrderNo}</span>
              )}
              <span className={`text-xs font-mono font-bold ${showArticlePrimary || showEztexPrimary ? 'text-slate-400' : 'text-blue-600 text-sm font-extrabold'} shrink-0`}>{sheet.devOrderNo || '-'}</span>
              {buyer && <span className="text-xs font-bold text-slate-700 truncate">{buyer}</span>}
              {sheet.fabricName && <span className="text-xs text-slate-600 font-bold truncate">· {sheet.fabricName}</span>}
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>{stageInfo.label}</span>
              {isDropped && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">DROP</span>}
              {history.length > 0 && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                  📝 {history.length}건 수정
                </span>
              )}
            </div>
            {/* 2줄: 스펙 요약 (내폭/외폭, GSM, G/YD) — 접힌 상태에서 바로 확인 */}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
              <span className="font-mono">{sheet.costInput?.widthCut || '-'}<span className="text-slate-300">/</span>{sheet.costInput?.widthFull || '-'}"</span>
              <span className="font-mono">GSM {sheet.costInput?.gsm || '-'}</span>
              {sheet.costInput?.costGYd && <span className="font-mono">G/YD {sheet.costInput.costGYd}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2 mt-1">
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
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">내폭/외폭</p><p className="text-slate-700 font-mono">{sheet.costInput?.widthCut||'-'}\"/{sheet.costInput?.widthFull||'-'}\"</p></div>
              <div><p className="text-[9px] font-bold text-slate-400 uppercase">GSM</p><p className="text-slate-700 font-mono">{sheet.costInput?.gsm||'-'}</p></div>
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
                      <p className="text-[8px] text-slate-500">기본 {prefix}{viewMode === 'export' ? (data?.priceConverter || 0).toFixed(2) : num(data?.priceConverter || 0)}</p>
                      <p className="text-[8px] text-slate-500">원가 {prefix}{viewMode === 'export' ? (data?.totalCostYd || 0).toFixed(2) : num(data?.totalCostYd || 0)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* === 변경 이력 === */}
            {history.length > 0 && (
              <div className="border border-amber-200 rounded-lg overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHistoryFor(prev => ({ ...prev, [sheet.id]: !prev[sheet.id] })); }}
                  className="w-full flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase tracking-wider hover:bg-amber-100 transition-colors">
                  <History className="w-3 h-3" />
                  변경 이력 ({history.length}건)
                  {showHistoryFor[sheet.id] ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                </button>
                {showHistoryFor[sheet.id] && (
                  <div className="bg-white p-3 space-y-3 max-h-60 overflow-y-auto">
                    {history.map((entry, idx) => (
                      <div key={idx} className="relative pl-4 border-l-2 border-amber-300">
                        {/* 타임라인 점 */}
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-amber-400" />
                        <p className="text-[10px] font-bold text-amber-600 mb-1">
                          {new Date(entry.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {/* 변경사유 */}
                        {entry.reason && (
                          <p className="text-[10px] text-slate-600 bg-amber-50 px-2 py-1 rounded mb-1.5 italic">
                            사유: {entry.reason}
                          </p>
                        )}
                        {/* 변경된 필드들 */}
                        <div className="space-y-0.5">
                          {Object.entries(entry.fields || {}).map(([fieldKey, oldValue]) => (
                            <div key={fieldKey} className="flex items-start gap-1 text-[10px]">
                              <span className="font-bold text-slate-500 shrink-0">{FIELD_LABELS[fieldKey] || fieldKey}:</span>
                              <span className="text-red-400 line-through">{oldValue || '(비어있음)'}</span>
                              <span className="text-slate-300">→</span>
                              <span className="text-emerald-600 font-bold">현재값</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 액션 */}
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200">
              {!isDropped && (
                <button onClick={() => { handleEditSheet(sheet); setActiveTab('designSheet'); }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100">
                  <Edit2 className="w-3 h-3" /> 수정
                </button>
              )}
              {!isDropped && (
                <button onClick={() => handleDrop(sheet.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-600 bg-orange-50 rounded hover:bg-orange-100">
                  DROP
                </button>
              )}
              {/* Drop 복원 */}
              {isDropped && restoreFromDrop && (
                <button onClick={() => restoreFromDrop(sheet.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                  <RotateCcw className="w-3 h-3" /> 복원
                </button>
              )}
              {sheet.stage !== 'articled' && (
                <button onClick={() => handleDeleteSheet(sheet.id)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded hover:bg-red-100 ml-auto">
                <Trash2 className="w-3 h-3" /> 삭제
              </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
          <p className="text-xs text-slate-500 mt-0.5">아이템 관리 · 변경 이력 · 오더넘버 연결</p>
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
          <p className="text-lg font-extrabold text-slate-800">{(designSheets || []).filter(s=>!s.isArchived).length}</p>
          <p className="text-[10px] font-bold text-slate-500">전체 (활성)</p>
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

      {/* === 아이템 등록 === */}
      {shouldShow('itemized') && itemizedSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Check className="w-3 h-3"/> 아이템 등록 ({categoryInfo.itemized.count}건)
          </h3>
          {itemizedSheets.map(sheet => renderSheetCard(sheet, { showArticlePrimary: true }))}
        </div>
      )}

      {/* === DROP === */}
      {shouldShow('dropped') && droppedSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-red-500 uppercase tracking-wider flex items-center gap-1">
            <X className="w-3 h-3"/> DROP ({categoryInfo.dropped.count}건)
            <span className="text-slate-400 font-normal normal-case">— EZ-TEX O/D NO. 기준, 데이터 보관</span>
          </h3>
          {droppedSheets.map(sheet => renderSheetCard(sheet, { showEztexPrimary: true, isDropped: true }))}
        </div>
      )}

      {/* === 진행 중 === */}
      {shouldShow('inProgress') && inProgressSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3"/> 진행 중 ({categoryInfo.inProgress.count}건)
            <span className="text-slate-400 font-normal normal-case">— 개발현황에서 관리</span>
          </h3>
          {inProgressSheets.map(sheet => renderSheetCard(sheet))}
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
