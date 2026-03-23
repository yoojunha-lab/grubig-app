import React, { useState, useMemo, useRef } from 'react';
import { Activity, Edit2, ChevronDown, ChevronUp, ArrowRight, FileText, Plus, X, Check, Trash2, Search, Printer, Clock, AlertTriangle, Link, XCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS } from '../constants/common';
import { num } from '../utils/helpers';
import { DesignStepper } from '../components/design/DesignStepper';

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
  handleSaveSheet, setActiveTab, user, buyers, yarnLibrary, viewMode, devPrintRef
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRejected, setShowRejected] = useState(false);
  const [printTarget, setPrintTarget] = useState(null);
  const [printType, setPrintType] = useState('report');
  // EZ-TEX O/D NO. 인라인 입력용 ref 저장소
  const eztexInputRefs = useRef({});

  const statusLabels = { pending: '대기중', analyzing: '분석 중', confirmed: '개발투입확정', rejected: '미진행' };
  const statusCls = {
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    rejected: 'bg-red-100 text-red-700 border-red-300'
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

  const handleGoToSheet = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    setActiveTab('designSheet');
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };

  const handleModalSave = () => {
    if (handleSaveDevRequest(user)) setShowDevModal(false);
  };

  const handlePrint = (devReq, type) => { setPrintTarget(devReq); setPrintType(type); setTimeout(()=>window.print(), 300); };
  const stageInfo = (key) => { const s=DESIGN_STAGES.find(x=>x.key===key); const c=STAGE_COLORS[key]||STAGE_COLORS.draft; return {label:s?.label||'작성중',...c}; };

  // ==========================================
  // [컴포넌트] 의뢰 요약 카드 (Dashboard 형)
  // ==========================================
  const DevReqSummaryCard = ({ d }) => {
    const db = deadlineBadge(d.targetSpec?.analysisDeadline);
    const isLocked = d.status === 'confirmed' && !!getLinkedSheet(d);
    
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all p-3">
        {/* 상단: 상태 및 오더번호 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1.5 items-center">
             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusCls[d.status]}`}>{statusLabels[d.status]}</span>
             <span className="text-sm font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
          </div>
          {db && <span className={`text-[10px] rounded px-1.5 py-0.5 ${db.c}`}><Clock className="w-2.5 h-2.5 inline mr-0.5"/>{db.t}</span>}
        </div>
        
        {/* 중앙: 바이어 및 내용 */}
        <div className="mb-3">
          <p className="text-sm font-bold text-slate-800">{d.buyerName}</p>
          <div className="flex gap-2 text-xs text-slate-500 mt-1 flex-wrap">
             {d.devItem && <span className="bg-slate-100 px-1.5 py-0.5 leading-none rounded">{d.devItem}</span>}
             {d.targetSpec?.composition && <span>{d.targetSpec.composition.substring(0,25)}</span>}
          </div>
        </div>
        
        {/* 하단: 액션 버튼 */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
           {!isLocked && (
             <select value={d.status} onChange={e=>updateDevStatus(d.id,e.target.value)}
               className="border border-slate-300 rounded px-1.5 py-1 text-[10px] font-bold outline-none bg-slate-50">
               <option value="pending">대기중</option><option value="analyzing">분석 중</option><option value="confirmed">확정하기</option><option value="rejected">미진행</option>
             </select>
           )}
           {!isLocked && <button onClick={()=>openEditModal(d)} className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-blue-600 border border-slate-200 rounded">의뢰 수정</button>}
           {/* 삭제 버튼 추가 */}
           {!isLocked && (d.status === 'pending' || d.status === 'rejected') && (
             <button onClick={()=>handleDeleteDevRequest(d.id)} className="px-2 py-1 text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 border border-red-200 rounded flex items-center gap-1">
               <Trash2 className="w-3 h-3" /> 삭제
             </button>
           )}
           {d.status === 'confirmed' && !getLinkedSheet(d) && (
              <button onClick={()=>handleGoToSheet(d)} className="px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm ml-auto">설계서 작성 시작</button>
           )}
        </div>
      </div>
    );
  };

  // ==========================================
  // [컴포넌트] 생산 관리용 "문서(표)형" 설계서 카드
  // ==========================================
  const DesignSheetTableCard = ({ sheet }) => {
    const si = stageInfo(sheet.stage);
    const ld = getLinkedDev(sheet.devRequestId);
    const dlBadge = deadlineBadge(sheet.deadline);
    const comp = getComp(sheet.yarns);
    const cost = viewMode==='export' ? `$${(sheet.costInput?.costGYd||0)}/yd` : `₩${num(sheet.costInput?.costGYd||0)}`;
    const isEditingEztex = sheet.stage === 'eztex';
    
    return (
      <div className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-all ${dlBadge?.urgent ? 'border-red-300' : 'border-slate-200'}`}>
        
        {/* 헤더: 진행단계, 관리번호, 원단명 */}
        <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between border-b ${dlBadge?.urgent ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
           <div className="flex items-center gap-2">
             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${si.bg} ${si.text} ${si.border}`}>{si.label}</span>
             <span className="text-sm font-mono font-extrabold text-slate-700">{sheet.devOrderNo||'-'}</span>
             {sheet.eztexOrderNo && <span className="text-[10px] font-mono font-bold text-violet-600 bg-violet-100 border border-violet-200 px-1.5 py-0.5 rounded leading-none">{sheet.eztexOrderNo}</span>}
             <span className="text-sm font-bold text-blue-900 border-l border-slate-300 pl-2">
               {sheet.fabricName || '(원단명 미입력)'}
               {ld?.buyerName && <span className="text-xs font-normal text-slate-500 ml-1">· {ld.buyerName}</span>}
             </span>
           </div>
           
           <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {sheet.changeHistory?.length > 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">📝 이력 {sheet.changeHistory.length}건</span>}
              {dlBadge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${dlBadge.c}`}><Clock className="w-2.5 h-2.5 inline mr-1"/>{dlBadge.t}</span>}
           </div>
        </div>

        {/* 바디: 실제 설계서 느낌의 격자(Grid) 표 */}
        <div className="p-0">
          <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-slate-100">
              <tr>
                 <th className="bg-slate-50 px-4 py-2 w-[15%] min-w-[70px] text-slate-500 font-bold border-r border-slate-100">혼용률</th>
                 <td className="px-4 py-2 w-[35%] text-slate-800 border-r border-slate-100 font-medium">{comp}</td>
                 <th className="bg-slate-50 px-4 py-2 w-[15%] min-w-[70px] text-slate-500 font-bold border-r border-slate-100">생산 요약</th>
                 <td className="px-4 py-2 w-[35%] text-slate-700">
                   <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">편직: <strong className="text-slate-800">{sheet.knitting?.factory||'-'}</strong></span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">염색: <strong className="text-slate-800">{sheet.dyeing?.factory||'-'}</strong></span>
                   </div>
                 </td>
              </tr>
              <tr>
                 <th className="bg-slate-50 px-4 py-2 text-slate-500 font-bold border-r border-slate-100">스펙</th>
                 <td className="px-4 py-2 text-slate-700 border-r border-slate-100">
                   폭: <span className="font-mono">{sheet.costInput?.widthCut||'-'}/{sheet.costInput?.widthFull||'-'}"</span> · 중량: <span className="font-mono">{sheet.costInput?.gsm||'-'}g</span>
                 </td>
                 <th className="bg-slate-50 px-4 py-2 text-slate-500 font-bold border-r border-slate-100">원가/야드</th>
                 <td className="px-4 py-2 text-emerald-700 font-extrabold font-mono text-sm">{cost}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 인라인 진행 입력 (EZ-TEX 대기 상태) */}
        {isEditingEztex && (
          <div className="bg-violet-50/50 border-t border-violet-100 px-4 py-2.5 flex items-center justify-between">
             <div className="text-[10px] font-extrabold text-violet-700 uppercase flex items-center gap-1.5">
               <ArrowRight className="w-3.5 h-3.5"/> 다음 작업: EZ-TEX O/D NO. 발행 및 저장
             </div>
             <div className="flex gap-2 w-full max-w-[250px]">
                <input type="text" placeholder="예: F-26S001" defaultValue={sheet.eztexOrderNo||''}
                  ref={el => { eztexInputRefs.current[sheet.id] = el; }}
                  className="flex-1 w-full border border-violet-300 shadow-inner rounded px-2 py-1 text-xs font-mono font-bold focus:ring-2 ring-violet-400 outline-none uppercase"/>
                <button onClick={()=>{
                  const inputVal = eztexInputRefs.current[sheet.id]?.value;
                  if(!inputVal) return alert('번호를 입력해주세요.');
                  autoAdvanceEztex(sheet.id, inputVal);
                }} className="shrink-0 px-3 py-1 text-xs font-bold text-white bg-violet-600 rounded shadow hover:bg-violet-700">
                  발번 & 샘플이동
                </button>
             </div>
          </div>
        )}

        {/* 하단 투명 액션 바 */}
        <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/30 flex items-center justify-between text-[10px]">
           <button onClick={()=>{handleEditSheet(sheet);setActiveTab('designSheet')}} className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white border border-blue-200 px-2 py-1 rounded shadow-sm">
             <Edit2 className="w-3 h-3"/> 설계서 원본 바로입력
           </button>
           
           <div className="flex gap-2">
             <button onClick={()=>dropDesignSheet(sheet.id)} className="font-bold text-slate-400 hover:text-red-600 px-2 py-1">DROP 처리</button>
             {sheet.stage === 'draft' && (
               <button onClick={()=>handleDeleteSheet(sheet.id)} className="font-bold text-red-500 hover:text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded shadow-sm flex items-center gap-1">
                 <Trash2 className="w-3 h-3" /> 영구 삭제
               </button>
             )}
             {!isEditingEztex && sheet.stage !== 'articled' && (
                <button onClick={()=>advanceStage(sheet.id)} className="flex items-center gap-1 font-bold text-white bg-emerald-600 px-3 py-1 rounded shadow hover:bg-emerald-700">
                  다음 단계로 <ChevronRight className="w-3 h-3"/>
                </button>
             )}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 🚀 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Activity className="w-4 h-4"/>
            </div>
            생산 파이프라인 (대시보드)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">의뢰 접수부터 설계, 생산, 아이템화까지 하나의 흐름으로 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5"/> 새 의뢰 등록
          </button>
          <button onClick={()=>setActiveTab('designSheet')} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-all">
            <Edit2 className="w-3.5 h-3.5"/> 자체 설계서
          </button>
        </div>
      </div>

      {/* 📊 2. 통합 파이프라인 요약 (Dashboard) */}
      <div className="bg-slate-800 rounded-xl p-4 shadow-inner overflow-x-auto">
        <div className="flex items-center justify-between min-w-max gap-3 px-2">
           {/* 의뢰 파트 */}
           <div className="flex items-center gap-3">
              <div className="text-center">
                 <p className="text-[10px] text-slate-400 font-bold mb-1">요구 분석</p>
                 <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold mx-auto shadow-md border-2 border-amber-300">{pipelineCounts.requests}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600"/>
              <div className="text-center">
                 <p className="text-[10px] text-slate-400 font-bold mb-1">설계 작성 대기</p>
                 <div className="bg-emerald-100 text-emerald-700 w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold mx-auto shadow-md border-2 border-emerald-300">{pipelineCounts.confirmedReqs - pipelineCounts.draft - pipelineCounts.eztex - pipelineCounts.sampling - pipelineCounts.articled > 0 ? pipelineCounts.confirmedReqs - pipelineCounts.draft - pipelineCounts.eztex - pipelineCounts.sampling - pipelineCounts.articled : 0}</div>
              </div>
           </div>
           
           <div className="w-6 h-1 bg-slate-700 rounded-full mx-2" />
           
           {/* 생산 파트 */}
           <div className="flex items-center gap-3">
              {Object.keys(sheetsByStage).map((stage, i) => {
                 const sInfo = DESIGN_STAGES.find(s=>s.key===stage);
                 const count = pipelineCounts[stage];
                 const isLast = i === Object.keys(sheetsByStage).length - 1;
                 const isActive = count > 0;
                 return (
                   <React.Fragment key={stage}>
                     <div className="text-center">
                        <p className={`text-[10px] ${isActive ? 'text-blue-300 font-bold' : 'text-slate-500'} mb-1`}>{sInfo.label.split(' ')[0]}</p>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold mx-auto border-2 transition-all
                           ${isActive ? `bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]` : `bg-slate-700 text-slate-400 border-slate-600`}`}>
                           {count}
                        </div>
                     </div>
                     {!isLast && <ChevronRight className="w-5 h-5 text-slate-600"/>}
                   </React.Fragment>
                 )
              })}
           </div>
        </div>
      </div>

      {/* 🔍 검색 바 */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"/>
        <input type="text" placeholder="오더번호, 바이어명, 원단명으로 전체 진행 건 찾기..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 ring-indigo-100 outline-none transition-all shadow-sm"/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* ----------------------------------------- */}
        {/* 섹션 1: 신규 접수 & 분석 중 (의뢰 건) */}
        {/* ----------------------------------------- */}
        <div className="xl:col-span-1 space-y-4">
           <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 border-b-2 border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"/> 처리 대기중인 의뢰 <span className="text-slate-400">({filterSearch([...pendingDevReqs, ...confirmedDevReqs.filter(d=>!getLinkedSheet(d))]).length})</span>
           </h3>
           
           <div className="space-y-3">
             {filterSearch([...pendingDevReqs, ...confirmedDevReqs.filter(d=>!getLinkedSheet(d))])
                 .sort((a,b)=>(getDaysUntil(a.targetSpec?.analysisDeadline)??9999)-(getDaysUntil(b.targetSpec?.analysisDeadline)??9999))
                 .map(d => <DevReqSummaryCard key={d.id} d={d} />)}
                 
             {filterSearch([...pendingDevReqs, ...confirmedDevReqs.filter(d=>!getLinkedSheet(d))]).length === 0 && (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-500"/>
                  <span className="text-xs font-bold">밀린 요건 분석이 없습니다.</span>
                </div>
             )}
           </div>

           {/* 미진행 처리건 열기 */}
           {rejectedDevReqs.length > 0 && (
             <div className="pt-4">
                <button onClick={()=>setShowRejected(!showRejected)} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-1 transition-colors">
                  {showRejected?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>} 삭제/미진행 이력 열람
                </button>
                {showRejected && (
                  <div className="mt-3 space-y-2 opacity-60">
                    {rejectedDevReqs.map(d => <DevReqSummaryCard key={d.id} d={d} />)}
                  </div>
                )}
             </div>
           )}
        </div>


        {/* ----------------------------------------- */}
        {/* 섹션 2: 생산 라인 (설계서 카드들) */}
        {/* ----------------------------------------- */}
        <div className="xl:col-span-2 space-y-8">
           
           {/* 단계별로 필터링된 내용을 렌더링. 단, 아이템화 완료는 별도 처리 */}
           {['draft', 'eztex', 'sampling'].map(stageKey => {
             const items = filterSearch(sheetsByStage[stageKey]);
             if (items.length === 0) return null;
             
             const stg = DESIGN_STAGES.find(s=>s.key===stageKey);
             const col = STAGE_COLORS[stageKey];
             
             return (
               <div key={stageKey} className="space-y-3">
                 <h3 className={`flex items-center gap-2 text-sm font-extrabold text-slate-800 border-b-2 pb-2`} style={{borderColor: col.text.split('text-')[1] ? `var(--${col.text.split('text-')[1]})` : '#334155'}}>
                   <span className={`px-2 py-0.5 rounded text-[10px] text-white bg-slate-800`}>{stg.label} 진행중</span>
                   <span className="text-slate-400 text-xs">총 {items.length}건</span>
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                   {items.map(sheet => <DesignSheetTableCard key={sheet.id} sheet={sheet} />)}
                 </div>
               </div>
             );
           })}

           {/* 아이템화 완료건 (별도 하단 처리) */}
           {filterSearch(sheetsByStage.articled).length > 0 && (
             <div className="pt-6 border-t border-slate-200">
               <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-500 mb-3 ml-2">
                 ✅ 생산 완료 (아이템화)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-90">
                 {filterSearch(sheetsByStage.articled).map(sheet => <DesignSheetTableCard key={sheet.id} sheet={sheet} />)}
               </div>
             </div>
           )}

           {filterSearch(activeSheets).length === 0 && (
              <div className="text-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-400 w-full">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                <span className="text-sm font-bold">진행 중인 생산(설계서) 스케줄이 없습니다.</span>
              </div>
           )}
        </div>
      </div>

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-red-500 mb-0.5">바이어명 *</label>
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
  );
};
