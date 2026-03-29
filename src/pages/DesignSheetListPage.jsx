import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  initFromDevRequest,
  advanceStage,
  getDesignCost,
  setActiveTab,
  user,
  viewMode,
  yarnLibrary,
  saveDocToCloud,
  restoreFromDrop,
  resetSheetForm,
  setIsDesignSheetModalOpen,
  setSheetInput
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropped, setShowDropped] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showRegisterMenu, setShowRegisterMenu] = useState(false);
  
  // 새 필터 추가
  const [knitFactoryFilter, setKnitFactoryFilter] = useState('All');
  const [machineTypeFilter, setMachineTypeFilter] = useState('All');
  const [gaugeFilter, setGaugeFilter] = useState('All');
  const [showSelfDesignOnly, setShowSelfDesignOnly] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [showHistoryFor, setShowHistoryFor] = useState({});
  const eztexInputRef = useRef({});
  const registerMenuRef = useRef(null);

  // 드롭다운 밖 클릭 시 닫기
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

  // 카테고리 분류
  const categorize = (sheet) => {
    if (sheet.stage === 'articled' && sheet.status !== 'dropped') return 'itemized';
    if (sheet.status === 'dropped') return 'dropped';
    return 'inProgress';
  };

  const categoryInfo = {
    inProgress: { label: '진행 중', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', count: 0 },
    itemized: { label: '아이템 등록', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', count: 0 },
    dropped: { label: 'DROP', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', count: 0 }
  };

  // 활성 설계서만 카운트
  (designSheets || []).filter(s => !s.isArchived).forEach(s => {
    const cat = categorize(s);
    if (categoryInfo[cat]) categoryInfo[cat].count++;
  });

  const filterSheet = (s) => {
    if (showSelfDesignOnly && s.devRequestId) return false;
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

  // === 필터 옵션 추출 ===
  const factories = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.factory).filter(Boolean))];
  const machineTypes = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.machineType).filter(Boolean))];
  const gauges = ['All', ...new Set((designSheets||[]).map(s=>s.knitting?.gauge).filter(Boolean))];
  
  // === 확정된 개발 오더 (설계 대기) ===
  const getLinkedSheet = (devReqId) => designSheets?.find(s => s.devRequestId === devReqId);
  const waitingDevReqs = useMemo(() => 
    (devRequests || [])
      .filter(d => d.status === 'confirmed' && !getLinkedSheet(d.id))
      .sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [devRequests, designSheets]);

  // === 아이템화 ===
  const itemizedSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.stage === 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter, showSelfDesignOnly]);

  // === DROP ===
  const droppedSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.status === 'dropped' && filterSheet(s))
      .sort((a, b) => {
        const aEz = a.eztexOrderNo || '', bEz = b.eztexOrderNo || '';
        if (aEz && !bEz) return -1;
        if (!aEz && bEz) return 1;
        return bEz.localeCompare(aEz) || (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter, showSelfDesignOnly]);

  // === 진행 중 ===
  const inProgressSheets = useMemo(() =>
    (designSheets || [])
      .filter(s => s.stage !== 'articled' && s.status !== 'dropped' && !s.isArchived && filterSheet(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  [designSheets, searchTerm, knitFactoryFilter, machineTypeFilter, gaugeFilter, showSelfDesignOnly]);

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
      <div key={sheet.id} className={`bg-white rounded-lg border border-b-2 shadow-sm overflow-hidden transition-all group ${
        isDropped ? 'border-b-red-300 border-slate-200 opacity-75 grayscale-[0.3]' : 'border-b-slate-200 border-slate-200 hover:border-y-blue-400 hover:shadow-md'
      }`}>
        {/* === 메인 Row 뷰 (접힌 상태) === */}
        <div className="flex items-center gap-4 px-4 py-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setExpandedId(isExpanded ? null : sheet.id)}>
          {/* 1. 상태 & 식별자 (왼쪽 고정) */}
          <div className="flex flex-col gap-1 w-[130px] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>{stageInfo.label}</span>
              {isDropped && <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1 py-0.5 rounded">DROP</span>}
            </div>
            {/* 식별자 (Article No > EZTEX NO > DevReq NO 순 우선순위) */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {showArticlePrimary && sheet.articleNo ? (
                <span className="text-[13px] font-mono font-black text-emerald-700 bg-emerald-50 px-1.5 rounded">{sheet.articleNo}</span>
              ) : showEztexPrimary && sheet.eztexOrderNo ? (
                <span className="text-[13px] font-mono font-black text-violet-700 bg-violet-50 px-1.5 rounded">{sheet.eztexOrderNo}</span>
              ) : (
                <span className="text-[13px] font-mono font-bold text-slate-500">{sheet.devOrderNo || '자체설계'}</span>
              )}
            </div>
          </div>

          {/* 2. 핵심 요약 (원단명, 혼용률, 바이어) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-extrabold text-slate-800 truncate uppercase">{sheet.fabricName || '원단명 미입력'}</h4>
              {history.length > 0 && <span className="text-[9px] font-bold text-amber-600 shrink-0"><History className="w-2.5 h-2.5 inline mr-0.5" />{history.length}</span>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap h-[18px] overflow-hidden">
              {buyer && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{buyer}</span>}
              <span className="text-[10px] text-slate-500 font-medium truncate">{getCompositionText(sheet.yarns) || '혼용률 없음'}</span>
            </div>
          </div>

          {/* 3. 주요 스펙 요약 (우측) */}
          <div className="hidden md:flex flex-col gap-0.5 w-[140px] shrink-0 justify-center border-l border-slate-100 pl-4">
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span className="font-bold text-slate-400">폭(내/외)</span>
              <span className="font-mono text-slate-700">{sheet.costInput?.widthCut||'-'}"/{sheet.costInput?.widthFull||'-'}"</span>
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span className="font-bold text-slate-400">GSM</span>
              <span className="font-mono text-slate-700">{sheet.costInput?.gsm||'-'}</span>
            </div>
          </div>

          {/* 4. 단가 요약 (우측 끝) */}
          <div className="hidden sm:flex flex-col items-end justify-center w-[110px] shrink-0 border-l border-slate-100 pl-4">
            <span className="text-[9px] font-bold text-slate-400 mb-0.5">{viewMode==='export'?'3K 단가 (USD)':'3K 단가 (KRW)'}</span>
            <span className="text-[15px] font-black text-blue-600 leading-none">
              {costData ? (viewMode==='export' ? `$${(costData.tier3k?.export?.priceBrand||0).toFixed(2)}` : `₩${num(costData.tier3k?.domestic?.priceBrand||0)}`) : '-'}
            </span>
          </div>

          {/* 5. 토글 아이콘 */}
          <div className="w-6 flex justify-end shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
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
                <button onClick={() => handleEditSheet(sheet)}
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
        <div className="relative" ref={registerMenuRef}>
          <button onClick={() => setShowRegisterMenu(!showRegisterMenu)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
            <Plus className="w-3.5 h-3.5" /> 설계서 등록
            <ChevronDown className="w-3 h-3" />
          </button>
          {showRegisterMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden">
              {/* 확정 오더에서 선택 */}
              {(devRequests||[]).filter(d => d.status === 'confirmed' && !designSheets?.find(s => s.devRequestId === d.id)).length > 0 && (
                <div className="border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 px-3 pt-2 pb-1">확정된 개발오더에서 선택</p>
                  {(devRequests||[]).filter(d => d.status === 'confirmed' && !designSheets?.find(s => s.devRequestId === d.id)).map(req => (
                    <button key={req.id} onClick={() => {
                      if(initFromDevRequest) initFromDevRequest({ devOrderNo: req.devOrderNo, devRequestId: req.id, sampleDeadline: req.targetSpec?.sampleDeadline || '' });
                      setIsDesignSheetModalOpen(true);
                      setShowRegisterMenu(false);
                    }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2 transition-colors">
                      <span className="font-mono font-bold text-violet-600">{req.devOrderNo}</span>
                      <span className="text-slate-500 truncate">{req.buyerName} {req.devItem ? `· ${req.devItem}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* 자체 설계서 */}
              <button onClick={() => {
                if(resetSheetForm) resetSheetForm();
                // 자체 설계서는 devOrderNo 없이 빈 칸으로 시작됨
                setIsDesignSheetModalOpen(true);
                setShowRegisterMenu(false);
              }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 transition-colors">
                <Edit2 className="w-3.5 h-3.5" /> 자체 설계서 (오더 없이 진행)
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* === 확정된 의뢰건 (설계 대기) === */}
      {waitingDevReqs.length > 0 && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm">
           <h3 className="text-xs font-extrabold text-emerald-800 flex items-center gap-2 mb-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             개발 확정건 (설계 작성 대기) <span className="text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full">{waitingDevReqs.length}건</span>
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             {waitingDevReqs.map(req => (
               <div key={req.id} className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm hover:border-emerald-300 transition-colors flex items-center justify-between">
                 <div className="min-w-0 flex-1 pr-3">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-xs font-mono font-extrabold text-slate-800">{req.devOrderNo}</span>
                     <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">개발오더</span>
                   </div>
                   <p className="text-sm font-bold text-blue-900 truncate">{req.devItem || '아이템명 미입력'}</p>
                   {req.buyerName && <p className="text-[10px] text-slate-500 mt-1">{req.buyerName}</p>}
                 </div>
                 <button onClick={() => {
                   if(initFromDevRequest) initFromDevRequest({ devOrderNo: req.devOrderNo, devRequestId: req.id, sampleDeadline: req.targetSpec?.sampleDeadline || '' });
                   setIsDesignSheetModalOpen(true);
                 }} className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm flex items-center gap-1 transition-colors">
                   <Plus className="w-3.5 h-3.5" /> 설계서 작성
                 </button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* 카테고리 제거 - 하단 리스트에 그룹핑되어 있어 중복됨 */}
      {/* 검색 및 필터 */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
         <div className="relative">
           <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
           <input type="text" placeholder="Article, 개발번호, EZ-TEX O/D NO., 원단명 검색..." value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 ring-blue-200 outline-none" />
         </div>
         
         <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">


            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-600">편직처:</span>
               <select value={knitFactoryFilter} onChange={e=>setKnitFactoryFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-1 outline-none min-w-[100px]">
                 {factories.map(f => <option key={f} value={f}>{f==='All'?'모든 편직처':f}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-600">기종:</span>
               <select value={machineTypeFilter} onChange={e=>setMachineTypeFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-1 outline-none min-w-[100px]">
                 {machineTypes.map(m => <option key={m} value={m}>{m==='All'?'모든 기종':m}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-600">게이지:</span>
               <select value={gaugeFilter} onChange={e=>setGaugeFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-xs rounded px-2 py-1 outline-none min-w-[100px]">
                 {gauges.map(g => <option key={g} value={g}>{g==='All'?'모든 게이지':g}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* === 1. 진행 중 (맨 위) === */}
      {shouldShow('inProgress') && inProgressSheets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3"/> 진행 중 ({categoryInfo.inProgress.count}건)
          </h3>
          {inProgressSheets.map(sheet => renderSheetCard(sheet))}
        </div>
      )}

      {/* === 2. 아이템 등록 (메인 — 항상 표시) === */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
          <Check className="w-3 h-3"/> 아이템 등록 ({categoryInfo.itemized.count}건)
          <span className="text-slate-400 font-normal normal-case">— Article 부여, 원단 리스트 연동</span>
        </h3>
        {itemizedSheets.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">등록된 아이템 없음</p>
        ) : itemizedSheets.map(sheet => renderSheetCard(sheet, { showArticlePrimary: true }))}
      </div>

      {/* === 3. DROP (접힘 — 클릭 시 펼침) === */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDropped(!showDropped)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <h3 className="text-[10px] font-extrabold text-red-500 uppercase tracking-wider flex items-center gap-1">
            <X className="w-3 h-3"/> DROP ({categoryInfo.dropped.count}건)
            <span className="text-slate-400 font-normal normal-case">— 데이터 보관</span>
          </h3>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showDropped ? 'rotate-180' : ''}`}/>
        </button>
        {showDropped && (
          <div className="p-3 space-y-2 border-t border-slate-200 bg-white">
            {droppedSheets.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">DROP 항목 없음</p>
            ) : droppedSheets.map(sheet => renderSheetCard(sheet, { showEztexPrimary: true, isDropped: true }))}
          </div>
        )}
      </div>

      {/* 빈 상태 */}
      {(designSheets || []).length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p className="font-bold">설계서가 없습니다</p>
          <p className="text-[11px] mt-1">우측 상단 [설계서 등록] 버튼을 이용해주세요.</p>
        </div>
      )}
    </div>
  );
};
