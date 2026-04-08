import React, { useState, useMemo, useRef } from 'react';
import { Activity, Edit2, ChevronDown, ChevronUp, ArrowRight, FileText, Plus, X, Check, Trash2, Search, Printer, Clock, AlertTriangle, Link, XCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS } from '../constants/common';
import { num } from '../utils/helpers';
import { DesignStepper } from '../components/design/DesignStepper';
import { DevReqSummaryCard } from '../components/dashboard/DevReqSummaryCard';

/**
 * [생산 관리자 관점] 통합 개발 현황 대시보드
 * 의뢰 접수부터 설계서 작성, 샘플 생산, 아이템화까지 하나의 파이프라인으로 관리
 */
export const DevStatusPage = ({
  devRequests, designSheets, devInput, editingDevId,
  handleDevChange, handleSpecChange, handleSaveDevRequest,
  handleEditDevRequest, handleDeleteDevRequest, resetDevForm,
  createDesignSheetFromDev, initFromDevRequest, updateDevStatus,
  handleEditSheet, handleDeleteSheet, advanceStage, advanceToEztex, autoAdvanceEztex, dropDesignSheet,
  setActiveTab, user, buyers, yarnLibrary, viewMode, devPrintRef,
  addMasterItem, generateDevOrderNo, setIsBuyerModalOpen
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [printType, setPrintType] = useState('report');
  // EZ-TEX O/D NO. 인라인 입력용 ref 저장소
  const eztexInputRefs = useRef({});

  const statusLabels = { pending: '의뢰 접수', analyzing: '분석 중', hold: '대기중', confirmed: '개발투입확정', rejected: 'Drop(미진행)' };
  const statusCls = {
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
    hold: 'bg-purple-100 text-purple-700 border-purple-300',
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    rejected: 'bg-slate-200 text-slate-700 border-slate-300'
  };

  const getDaysUntil = (d) => { if(!d) return null; const t=new Date(d),n=new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t-n)/864e5); };
  
  // 납기 뱃지 표시 로직 (D+1 이상은 강조 경고)
  const deadlineBadge = (d) => {
    const v=getDaysUntil(d); if(v===null) return null;
    if(v<0) return { t:`D+${-v} 지연!`, c:'bg-red-500 text-white shadow-sm ring-2 ring-red-200 animate-pulse', urgent: true };
    if(v===0) return { t:'Today 마감', c:'bg-red-500 text-white shadow-sm', urgent: true };
    if(v<=3) return { t:`D-${v} 임박`, c:'bg-orange-100 text-orange-700 border border-orange-300 font-bold' };
    return { t:`D-${v}`, c:'bg-slate-100 text-slate-600 border border-slate-300' };
  };

  // 데이터 분류
  const pendingDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='pending'||d.status==='analyzing'), [devRequests]);
  const confirmedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='confirmed'), [devRequests]);
  const rejectedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='rejected'), [devRequests]);
  
  const activeSheets = useMemo(() => (designSheets||[]).filter(s=>s.status!=='dropped').sort((a,b)=> {
    // 납기 임박순 1차 정렬, 업데이트순 2차 정렬
    const da = getDaysUntil(a.deadline) ?? 9999;
    const db = getDaysUntil(b.deadline) ?? 9999;
    if (da !== db) return da - db;
    return (b.updatedAt||'').localeCompare(a.updatedAt||'');
  }), [designSheets]);

  // 스테이지별 설계서 분류
  const sheetsByStage = useMemo(() => {
    const grouped = { draft: [], eztex: [], sampling: [], articled: [] };
    activeSheets.forEach(s => { if(grouped[s.stage]) grouped[s.stage].push(s); });
    return grouped;
  }, [activeSheets]);

  const pipelineCounts = {
    requests: pendingDevReqs.length,
    confirmedReqs: confirmedDevReqs.length, // 설계서 미연결
    draft: sheetsByStage.draft.length,
    eztex: sheetsByStage.eztex.length,
    sampling: sheetsByStage.sampling.length,
    articled: sheetsByStage.articled.length
  };

  const getYarnName = (id) => { if(!id) return ''; return (yarnLibrary||[]).find(y=>String(y.id)===String(id).split('::')[0])?.name||''; };
  const getComp = (yarns) => (yarns||[]).filter(y=>y?.yarnId&&Number(y.ratio)>0).map(y=>`${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ')||'-';
  
  const getLinkedSheet = (devReq) => {
    if (!devReq) return null;
    if (devReq.linkedDesignSheetId) return (designSheets||[]).find(s => s.id === devReq.linkedDesignSheetId) || null;
    return (designSheets||[]).find(s => s.devRequestId === devReq.id) || null;
  };
  const getLinkedDev = (devReqId) => (devRequests||[]).find(d=>d.id===devReqId);
  
  const filterSearch = (items) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(d => {
      const buyerMatch = String(d.buyerName || '').toLowerCase().includes(q);
      const orderMatch = String(d.devOrderNo || '').toLowerCase().includes(q);
      const fabricMatch = String(d.fabricName || '').toLowerCase().includes(q);
      return buyerMatch || orderMatch || fabricMatch;
    });
  };

  // [기획오류 #9 수정] 설계서 작성 시작 → 보관함 이동 + 모달 자동 열기
  const handleGoToSheet = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    setActiveTab('designList');
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };

  const handleModalSave = () => {
    if (handleSaveDevRequest(user)) setShowDevModal(false);
  };

  const handlePrint = (devReq, type) => { setPrintTarget(devReq); setPrintType(type); setTimeout(()=>window.print(), 300); };
  const stageInfo = (key) => { const s=DESIGN_STAGES.find(x=>x.key===key); const c=STAGE_COLORS[key]||STAGE_COLORS.draft; return {label:s?.label||'작성중',...c}; };

  // ==========================================

  const renderCard = (d) => (
    <DevReqSummaryCard
      key={d.id}
      d={d}
      statusCls={statusCls}
      statusLabels={statusLabels}
      deadlineBadge={deadlineBadge}
      getLinkedSheet={getLinkedSheet}
      updateDevStatus={updateDevStatus}
      openEditModal={openEditModal}
      handleDeleteDevRequest={handleDeleteDevRequest}
      handlePrint={handlePrint}
      handleGoToSheet={handleGoToSheet}
    />
  );



  return (
    <div>
      <div className="space-y-6 print:hidden">
        {/* 🚀 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200"><Activity className="w-6 h-6 text-white"/></div>
            개발의뢰 현황
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">의뢰 접수부터 설계, 생산, 아이템화까지 하나의 흐름으로 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5"/> 새 의뢰 등록
          </button>
        </div>
      </div>

      {/* 📊 2. 통합 파이프라인 요약 (Dashboard) 대신 칸반 보드 형태 제공 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-start">
         {/* 의뢰 접수 (pending) */}
         <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px]">
            <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-amber-300 pb-1.5">
               의뢰 접수 <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px]">{filterSearch(devRequests.filter(d=>d.status==='pending')).length}</span>
            </h3>
            <div className="space-y-2">
               {filterSearch(devRequests.filter(d=>d.status==='pending')).map(d => renderCard(d))}
            </div>
         </div>

         {/* 분석중 (analyzing) */}
         <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px]">
            <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-blue-300 pb-1.5">
               분석 중 <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[9px]">{filterSearch(devRequests.filter(d=>d.status==='analyzing')).length}</span>
            </h3>
            <div className="space-y-2">
               {filterSearch(devRequests.filter(d=>d.status==='analyzing')).map(d => renderCard(d))}
            </div>
         </div>

         {/* 대기중 (hold) */}
         <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px]">
            <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-purple-300 pb-1.5">
               대기중 <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[9px]">{filterSearch(devRequests.filter(d=>d.status==='hold')).length}</span>
            </h3>
            <div className="space-y-2">
               {filterSearch(devRequests.filter(d=>d.status==='hold')).map(d => renderCard(d))}
            </div>
         </div>

         {/* 확정하기 (confirmed) */}
         <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px]">
            <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-emerald-300 pb-1.5">
               개발투입확정 <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[9px]">{filterSearch(devRequests.filter(d=>d.status==='confirmed')).length}</span>
            </h3>
            <div className="space-y-2">
               {filterSearch(devRequests.filter(d=>d.status==='confirmed')).map(d => renderCard(d))}
            </div>
         </div>

         {/* 미진행 (rejected) */}
         <div className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px] opacity-70">
            <h3 className="flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 border-slate-300 pb-1.5">
               Drop (미진행) <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[9px]">{filterSearch(devRequests.filter(d=>d.status==='rejected')).length}</span>
            </h3>
            <div className="space-y-2">
               {filterSearch(devRequests.filter(d=>d.status==='rejected')).map(d => renderCard(d))}
            </div>
         </div>
      </div>

      {/* 📋 설계서 단계 현황 — 단계별 칸반 그룹 */}
      {(() => {
        // [D2 최적화] 상단 useMemo에서 이미 계산한 sheetsByStage를 사용 (이중 계산 제거)
        if (activeSheets.length === 0) return null;

        const stageStyle = {
          draft: { borderLine: 'border-slate-400', badgeInfo: 'bg-slate-200 text-slate-800' },
          eztex: { borderLine: 'border-violet-300', badgeInfo: 'bg-violet-100 text-violet-700' },
          sampling: { borderLine: 'border-amber-300', badgeInfo: 'bg-amber-100 text-amber-700' },
          articled: { borderLine: 'border-emerald-300', badgeInfo: 'bg-emerald-100 text-emerald-700' }
        };

        return (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 mb-2">
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 rounded-lg text-white shadow-lg shadow-violet-200">
                <FileText className="w-4 h-4"/>
              </div>
              설계서 단계 현황
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 items-start">
              {DESIGN_STAGES.map(stage => {
                const items = sheetsByStage[stage.key] || [];
                const style = stageStyle[stage.key];
                return (
                  <div key={stage.key} className="bg-slate-100/50 rounded-xl p-2.5 border border-slate-200 min-h-[500px]">
                    {/* 칼럼 헤더 (상단 칸반과 동일한 구조) */}
                    <h3 className={`flex justify-between items-center text-[11px] font-extrabold text-slate-700 mb-2 border-b-2 ${style.borderLine} pb-1.5`}>
                      {stage.label} <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${style.badgeInfo}`}>{items.length}</span>
                    </h3>

                    {/* 아이템 목록 */}
                    <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 pb-2">
                      {items.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8 font-medium">항목 없음</p>
                      ) : items.map(s => {
                        const linkedDev = getLinkedDev(s.devRequestId);
                        const db = deadlineBadge(s.deadline);
                        return (
                          <div key={s.id} className="bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 shadow-sm p-3.5 cursor-pointer transition-all flex flex-col gap-2.5 relative group"
                            onClick={() => handleEditSheet?.(s)}>
                            {/* 상단 뱃지 / 디데이 */}
                            <div className="flex items-start justify-between">
                              <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded-md border border-violet-100 shrink-0">{s.devOrderNo || '자체 설계'}</span>
                              <div className="flex flex-col items-end gap-1">
                                {db && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shadow-sm ${db.c}`}><Clock className="w-2.5 h-2.5 inline mr-0.5"/>{db.t}</span>}
                              </div>
                            </div>
                            
                            {/* 메인 정보 (원단명) */}
                            <div>
                              <h4 className="text-[15px] font-extrabold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors uppercase">{s.fabricName || '원단명 미입력'}</h4>
                              {/* 꼬리표 정보 */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {linkedDev?.buyerName && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{linkedDev.buyerName}</span>}
                                {s.articleNo && <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-100">{s.articleNo}</span>}
                              </div>
                            </div>

                            {/* EZ-TEX 단계: 인라인 O/D NO. 입력 */}
                            {stage.key === 'eztex' && (
                              <div className="mt-1 flex items-center gap-1.5 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                <input
                                  ref={el => { eztexInputRefs.current[s.id] = el; }}
                                  type="text"
                                  placeholder="EZTEX O/D 입고용 입력"
                                  defaultValue={s.eztexOrderNo || ''}
                                  className="flex-1 w-0 border border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none transition-all placeholder:text-slate-300"
                                  onKeyDown={e => { if (e.key === 'Enter') { const val = eztexInputRefs.current[s.id]?.value?.trim(); if (val) autoAdvanceEztex(s.id, val); }}}
                                />
                                <button
                                  onClick={() => { const val = eztexInputRefs.current[s.id]?.value?.trim(); if (val) autoAdvanceEztex(s.id, val); else alert('O/D NO.를 입력해주세요.'); }}
                                  className="px-2.5 py-1.5 bg-violet-600 text-white text-[10px] font-bold rounded hover:bg-violet-700 active:scale-95 transition-all shadow-sm shrink-0 whitespace-nowrap"
                                >
                                  등록
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      {/* 모달 등 팝업 (코드 생략 없이 원본유지) */}
      {showDevModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={()=>setShowDevModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 rounded-t-2xl flex items-center justify-between z-10">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                {editingDevId?<Edit2 className="w-4 h-4 text-blue-500"/>:<Plus className="w-4 h-4 text-emerald-500"/>}
                {editingDevId?'개발 의뢰 수정':'새 개발 의뢰 등록'}
              </h3>
              <button onClick={()=>setShowDevModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="p-4 space-y-3">
              {/* 개발번호 입력란 (새 의뢰일 때만 표시) */}
              {!editingDevId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">개발번호 <span className="text-slate-400">(비워두면 자동 발번)</span></label>
                  <input type="text" name="devOrderNo" value={devInput.devOrderNo||''} onChange={handleDevChange}
                    placeholder={generateDevOrderNo ? generateDevOrderNo() : 'F-26D001'}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono font-bold focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"/>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="block text-[10px] font-bold text-red-500">바이어명 *</label>
                    <button type="button" onClick={() => setIsBuyerModalOpen(true)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors whitespace-nowrap">
                      + 바이어 관리
                    </button>
                  </div>
                  <select name="buyerName" value={devInput.buyerName} onChange={handleDevChange}
                    className="w-full border border-red-300 rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 ring-red-200 outline-none uppercase bg-red-50/30">
                    <option value="">-- 선택 --</option>
                    {(buyers||[]).map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">담당자</label>
                  <input type="text" name="assignee" value={devInput.assignee||''} onChange={handleDevChange}
                    placeholder="영업 담당자" className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">개발 아이템 <span className="text-slate-400">(어떤 것을 개발하는지)</span></label>
                  <input type="text" name="devItem" value={devInput.devItem||''} onChange={handleDevChange}
                    placeholder="예: 니트 저지, 울혼방 트윌 등" className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">의뢰 일자</label>
                  <input type="date" name="requestDate" value={devInput.requestDate} onChange={handleDevChange}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-red-500 mb-0.5">분석 납기 * 📅</label>
                  <input type="date" value={devInput.targetSpec?.analysisDeadline||''}
                    onChange={e=>handleSpecChange('analysisDeadline',e.target.value)}
                    className="w-full border border-red-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-red-200 outline-none bg-red-50/30"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">샘플 생산 납기 📅 <span className="text-slate-400">(개발투입확정 시 필수)</span></label>
                  <input type="date" value={devInput.targetSpec?.sampleDeadline||''}
                    onChange={e=>handleSpecChange('sampleDeadline',e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">타겟 단가</label>
                <input type="text" placeholder="예: $3.50/yd" value={devInput.targetSpec?.targetPrice||''}
                  onChange={e=>handleSpecChange('targetPrice',e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">혼용률 / 스펙</label>
                <input type="text" placeholder="울 80% 나일론 20%" value={devInput.targetSpec?.composition||''}
                  onChange={e=>handleSpecChange('composition',e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">원하는 느낌</label>
                <input type="text" placeholder="부드럽고 드레이프감" value={devInput.targetSpec?.feeling||''}
                  onChange={e=>handleSpecChange('feeling',e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">기타 요청</label>
                <textarea placeholder="추가 요청..." value={devInput.targetSpec?.otherRequests||''}
                  onChange={e=>handleSpecChange('otherRequests',e.target.value)} rows={2}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none resize-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">스와치 메모</label>
                <input type="text" placeholder="스와치 관련" name="swatchNote" value={devInput.swatchNote||''} onChange={handleDevChange}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 rounded-b-2xl flex gap-2 justify-end">
              <button onClick={()=>setShowDevModal(false)} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
              <button onClick={handleModalSave} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95">
                <Check className="w-3.5 h-3.5"/> {editingDevId?'수정 저장':'의뢰 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* 편직처 제출용 프린트 영역 (화면에선 숨김, 프린트 시에만 표시) */}
      <div className="hidden print:block font-sans">
        <div ref={devPrintRef} className="w-[210mm] h-[290mm] mx-auto bg-white text-slate-800 p-8 box-border relative font-sans">
          {printTarget && (
            <div className="w-full h-full border-2 border-slate-200 rounded-3xl p-8 flex flex-col shadow-sm">
              {/* 1. Header */}
              <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">개발 의뢰서</h1>
                  <p className="text-slate-400 text-xs mt-1.5 tracking-widest uppercase font-bold">Development Request Sheet</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Number / O.D</span>
                  <span className="text-xl font-mono font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">{printTarget.devOrderNo || 'N/A'}</span>
                </div>
              </div>

              {/* 2. Top Info Grid */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">받은 날짜</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.requestDate || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">요청 업체</p>
                  <p className="font-extrabold text-slate-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{printTarget.buyerName || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">담당자</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.assignee || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] text-red-500 font-bold mb-1">요청 납기</p>
                  <p className="font-bold text-red-600 text-sm">{printTarget.targetSpec?.analysisDeadline || printTarget.targetSpec?.deliveryDate || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">생산 납기</p>
                  <p className="font-bold text-slate-800 text-sm">{printTarget.targetSpec?.sampleDeadline || '-'}</p>
                </div>
              </div>

              {/* 3. Sample Attachment Area (Flex Grow) */}
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center bg-slate-50/50 mb-6 relative overflow-hidden">
                <div className="opacity-20"><FileText className="w-16 h-16 text-slate-400 mb-4" /></div>
                <span className="font-black text-4xl tracking-widest text-slate-200">ATTACH SAMPLE</span>
                <p className="text-slate-400 text-sm mt-3 font-medium">이곳에 스와치를 부착해주세요 (최소 9x9cm 권장)</p>
                {printTarget.swatchNote && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm max-w-[80%]">
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2">📌 <span>{printTarget.swatchNote}</span></p>
                  </div>
                )}
              </div>

              {/* 4. Specifications & Notes (Two Columns) */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-slate-800 border-b-2 border-slate-800 pb-2 flex items-center gap-2 tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>SPECIFICATION
                  </h3>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">혼용률/스펙</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.composition || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">폭/중량</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.widthWeight || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start border-b border-slate-200 border-dashed pb-2">
                       <span className="text-xs font-bold text-slate-500 w-1/3">단가</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.targetPrice || '-'}</span>
                     </div>
                     <div className="flex justify-between items-start pb-1">
                       <span className="text-xs font-bold text-slate-500 w-1/3">느낌/터치</span>
                       <span className="font-bold text-slate-800 text-right w-2/3 leading-snug">{printTarget.targetSpec?.feeling || printTarget.targetSpec?.touch || '-'}</span>
                     </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-slate-800 border-b-2 border-slate-800 pb-2 flex items-center gap-2 tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>ITEM NOTES
                  </h3>
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex-1 h-[146px] shadow-sm">
                     <p className="text-[10px] font-extrabold text-emerald-800/60 mb-1.5 uppercase tracking-widest">Detail & Feature</p>
                     <p className="font-semibold text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                        {printTarget.devItem ? `[ITEM] ${printTarget.devItem}\n` : ''}
                        {printTarget.targetSpec?.customerNotes || '등록된 특이사항이 없습니다.'}
                     </p>
                  </div>
                </div>
              </div>

              {/* 5. Footer Notes */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
                <h3 className="text-xs font-extrabold text-slate-800 mb-2.5 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> 영업자 추가 의뢰사항
                </h3>
                <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[40px]">
                  {printTarget.targetSpec?.otherRequests || '추가 요청사항 없음'}
                </p>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
