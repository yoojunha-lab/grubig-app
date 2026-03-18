import React, { useState, useMemo, useRef } from 'react';
import { Activity, Edit2, ChevronDown, ChevronUp, ArrowRight, FileText, Plus, X, Check, Trash2, Search, Printer, Clock, AlertTriangle, Link, XCircle } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS } from '../constants/common';
import { DesignStepper } from '../components/design/DesignStepper';

/**
 * 통합 개발 현황
 * - 개발 의뢰: 분석납기 + 샘플납기, 3구역(진행/확정/미진행)
 * - 설계서 진행: 동일 카드 UI, DROP 버튼, 다음 단계
 * - 프린트 2종: 보고용(바이어O) + 편직처용(바이어X)
 */
export const DevStatusPage = ({
  devRequests, designSheets, devInput, editingDevId,
  handleDevChange, handleSpecChange, handleSaveDevRequest,
  handleEditDevRequest, handleDeleteDevRequest, resetDevForm,
  createDesignSheetFromDev, initFromDevRequest, updateDevStatus,
  confirmDevAndLink, handleEditSheet, advanceStage, dropDesignSheet,
  handleSaveSheet, setActiveTab, user, buyers, yarnLibrary, viewMode, devPrintRef
}) => {
  const [activeView, setActiveView] = useState('devRequests');
  const [showDevModal, setShowDevModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRejected, setShowRejected] = useState(false);
  const [printTarget, setPrintTarget] = useState(null);
  const [printType, setPrintType] = useState('report');
  const localPrintRef = useRef(null);

  const statusLabels = { pending: '대기중', analyzing: '분석 중', confirmed: '개발투입확정', rejected: '미진행' };
  const statusCls = {
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    rejected: 'bg-red-100 text-red-700 border-red-300'
  };

  // 납기 D-day (분석 납기 기준)
  const getDaysUntil = (d) => { if(!d) return null; const t=new Date(d),n=new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t-n)/864e5); };
  const deadlineBadge = (d) => {
    const v=getDaysUntil(d); if(v===null) return null;
    if(v<0) return {t:`D+${-v}`,c:'bg-red-100 text-red-700 border-red-300'};
    if(v===0) return {t:'D-Day',c:'bg-red-100 text-red-700 border-red-300'};
    if(v<=7) return {t:`D-${v}`,c:'bg-orange-100 text-orange-700 border-orange-300'};
    return {t:`D-${v}`,c:'bg-slate-100 text-slate-600 border-slate-300'};
  };

  // 분류
  const activeDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status!=='rejected'), [devRequests]);
  const rejectedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='rejected'), [devRequests]);
  const confirmedDevReqs = useMemo(() => activeDevReqs.filter(d=>d.status==='confirmed'), [activeDevReqs]);
  const pendingDevReqs = useMemo(() => activeDevReqs.filter(d=>d.status!=='confirmed'), [activeDevReqs]);
  const activeSheets = useMemo(() => (designSheets||[]).filter(s=>s.status!=='dropped').sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')), [designSheets]);
  const stageCounts = useMemo(() => { const c={}; DESIGN_STAGES.forEach(s=>{c[s.key]=0}); activeSheets.forEach(s=>{if(c[s.stage]!==undefined)c[s.stage]++}); return c; }, [activeSheets]);

  // 유틸
  const getYarnName = (id) => { if(!id) return ''; return (yarnLibrary||[]).find(y=>String(y.id)===String(id).split('::')[0])?.name||''; };
  const getComp = (yarns) => (yarns||[]).filter(y=>y?.yarnId&&Number(y.ratio)>0).map(y=>`${getYarnName(y.yarnId)} ${y.ratio}%`).join(' / ')||'-';
  const getLinkedSheet = (devId) => (designSheets||[]).find(s=>s.devRequestId===devId);
  const getLinkedDev = (devReqId) => (devRequests||[]).find(d=>d.id===devReqId);
  const filterSearch = (items) => items.filter(d=>String(d.buyerName||d.devOrderNo||'').toLowerCase().includes(searchTerm.toLowerCase()));

  // 확정 → 설계서
  const handleConfirmAndGo = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    confirmDevAndLink(devReq.id, null);
    setActiveTab('designSheet');
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };
  const handleModalSave = () => { handleSaveDevRequest(user); setShowDevModal(false); };

  // 프린트 — 별도 iframe이 아닌, 제대로 된 print:block 처리
  const handlePrint = (devReq, type) => { setPrintTarget(devReq); setPrintType(type); setTimeout(()=>window.print(), 300); };

  const stageInfo = (key) => { const s=DESIGN_STAGES.find(x=>x.key===key); const c=STAGE_COLORS[key]||STAGE_COLORS.draft; return {label:s?.label||'작성중',...c}; };

  // 공통 카드 컴포넌트 (개발 의뢰 / 설계서 진행 UI 통일)
  const ItemCard = ({ id, line1Left, line1Right, badges, details, expandContent }) => {
    const isExp = expandedId === id;
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all text-xs">
        <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-50/50"
          onClick={() => setExpandedId(isExp ? null : id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {line1Left}
              {badges}
            </div>
            {details && <div className="flex gap-3 mt-1 text-[10px] text-slate-400">{details}</div>}
          </div>
          <div className="pl-2 shrink-0">{line1Right || (isExp ? <ChevronUp className="w-3.5 h-3.5 text-slate-400"/> : <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>)}</div>
        </div>
        {isExp && expandContent && (
          <div className="border-t border-slate-100 px-3 py-3 bg-slate-50/50 space-y-3">{expandContent}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 rounded-lg text-white shadow-lg shadow-violet-200"><Activity className="w-4 h-4"/></div>
            개발 현황
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">의뢰 접수 · 납기 관리 · 설계서 진행 통합 관리</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5"/> 의뢰 등록
          </button>
          <button onClick={()=>setActiveTab('designSheet')} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all">
            <Edit2 className="w-3.5 h-3.5"/> 자체 설계서
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
        {[{key:'devRequests',label:'개발 의뢰',count:activeDevReqs.length},{key:'designProgress',label:'설계서 진행',count:activeSheets.length}].map(tab=>(
          <button key={tab.key} onClick={()=>setActiveView(tab.key)}
            className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${activeView===tab.key?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            {tab.label} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeView===tab.key?'bg-violet-100 text-violet-700':'bg-slate-200 text-slate-500'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
        <input type="text" placeholder="바이어명, 개발번호 검색..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"/>
      </div>

      {/* === 개발 의뢰 뷰 === */}
      {activeView==='devRequests' && (
        <div className="space-y-3">
          {/* 진행 중 */}
          {filterSearch(pendingDevReqs).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">📋 진행 중 의뢰</h3>
              {filterSearch(pendingDevReqs).sort((a,b)=>(getDaysUntil(a.targetSpec?.analysisDeadline)??9999)-(getDaysUntil(b.targetSpec?.analysisDeadline)??9999)).map(d=>{
                const db = deadlineBadge(d.targetSpec?.analysisDeadline);
                const ls = getLinkedSheet(d.id);
                return (
                  <ItemCard key={d.id} id={`dev-${d.id}`}
                    line1Left={<><span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span><span className="text-xs font-bold text-slate-800">{d.buyerName}</span></>}
                    badges={<>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statusCls[d.status]}`}>{statusLabels[d.status]}</span>
                      {db && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${db.c}`}><Clock className="w-2.5 h-2.5 inline mr-0.5"/>{db.t}</span>}
                      {ls && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-0.5"><Link className="w-2.5 h-2.5"/>{ls.devOrderNo}</span>}
                    </>}
                    details={<>
                      {d.targetSpec?.composition && <span>📋 {d.targetSpec.composition.substring(0,25)}</span>}
                      {d.requestDate && <span>📅 {d.requestDate}</span>}
                      {d.targetSpec?.analysisDeadline && <span>⏰ 분석: {d.targetSpec.analysisDeadline}</span>}
                      {d.targetSpec?.sampleDeadline && <span>🎯 샘플: {d.targetSpec.sampleDeadline}</span>}
                    </>}
                    expandContent={
                      <>
                        <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">상태:</span>
                          <select value={d.status} onChange={e=>updateDevStatus(d.id,e.target.value)}
                            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-bold focus:ring-1 ring-violet-200 outline-none">
                            <option value="pending">대기중</option><option value="analyzing">분석 중</option><option value="confirmed">개발투입확정</option><option value="rejected">미진행</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[['혼용률',d.targetSpec?.composition],['타겟 단가',d.targetSpec?.targetPrice],['느낌',d.targetSpec?.feeling||d.targetSpec?.touch],['의뢰일',d.requestDate],['분석 납기',d.targetSpec?.analysisDeadline],['샘플 납기',d.targetSpec?.sampleDeadline],['기타',d.targetSpec?.otherRequests]].filter(([,v])=>v).map(([l,v])=>(
                            <div key={l}><p className="text-[9px] font-bold text-slate-400 uppercase">{l}</p><p className="text-xs text-slate-700 whitespace-pre-wrap">{v}</p></div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                          <button onClick={()=>openEditModal(d)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Edit2 className="w-3 h-3"/> 수정</button>
                          <button onClick={()=>handleDeleteDevRequest(d.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash2 className="w-3 h-3"/> 삭제</button>
                          <button onClick={()=>handlePrint(d,'report')} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded hover:bg-slate-200"><Printer className="w-3 h-3"/> 보고용</button>
                          <button onClick={()=>handlePrint(d,'factory')} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"><Printer className="w-3 h-3"/> 편직처용</button>
                          {d.status!=='confirmed'&&d.status!=='rejected'&&!ls && (
                            <button onClick={()=>handleConfirmAndGo(d)} className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded shadow-sm hover:shadow-md active:scale-95 ml-auto"><ArrowRight className="w-3 h-3"/> 확정→설계서</button>
                          )}
                          {ls && <button onClick={()=>{handleEditSheet(ls);setActiveTab('designSheet')}} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 ml-auto"><Link className="w-3 h-3"/> 설계서 보기</button>}
                        </div>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* 개발투입확정 그룹 */}
          {filterSearch(confirmedDevReqs).length > 0 && (
            <div className="space-y-1.5 mt-3">
              <h3 className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1"><Check className="w-3 h-3"/> 개발투입확정 ({confirmedDevReqs.length}건)</h3>
              {filterSearch(confirmedDevReqs).map(d=>{
                const db2 = deadlineBadge(d.targetSpec?.sampleDeadline);
                const ls2 = getLinkedSheet(d.id);
                return (
                  <ItemCard key={d.id} id={`dev-${d.id}`}
                    line1Left={<><span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span><span className="text-xs font-bold text-slate-800">{d.buyerName}</span></>}
                    badges={<>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statusCls.confirmed}`}>{statusLabels.confirmed}</span>
                      {db2 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${db2.c}`}><Clock className="w-2.5 h-2.5 inline mr-0.5"/>샘플{db2.t}</span>}
                      {ls2 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-0.5"><Link className="w-2.5 h-2.5"/>{ls2.devOrderNo}</span>}
                    </>}
                    details={<>
                      {d.targetSpec?.composition && <span>📋 {d.targetSpec.composition.substring(0,25)}</span>}
                      {d.targetSpec?.sampleDeadline && <span>🎯 샘플납기: {d.targetSpec.sampleDeadline}</span>}
                    </>}
                    expandContent={
                      <>
                        <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">상태:</span>
                          <select value={d.status} onChange={e=>updateDevStatus(d.id,e.target.value)}
                            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-bold focus:ring-1 ring-violet-200 outline-none">
                            <option value="pending">대기중</option><option value="analyzing">분석 중</option><option value="confirmed">개발투입확정</option><option value="rejected">미진행</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[['혼용률',d.targetSpec?.composition],['타겟 단가',d.targetSpec?.targetPrice],['느낌',d.targetSpec?.feeling||d.targetSpec?.touch],['의뢰일',d.requestDate],['분석 납기',d.targetSpec?.analysisDeadline],['샘플 납기',d.targetSpec?.sampleDeadline]].filter(([,v])=>v).map(([l,v])=>(
                            <div key={l}><p className="text-[9px] font-bold text-slate-400 uppercase">{l}</p><p className="text-xs text-slate-700">{v}</p></div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                          <button onClick={()=>openEditModal(d)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Edit2 className="w-3 h-3"/> 수정</button>
                          <button onClick={()=>handlePrint(d,'report')} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded hover:bg-slate-200"><Printer className="w-3 h-3"/> 보고용</button>
                          {ls2 && <button onClick={()=>{handleEditSheet(ls2);setActiveTab('designSheet')}} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 ml-auto"><Link className="w-3 h-3"/> 설계서 보기</button>}
                        </div>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}

          {activeDevReqs.length===0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20"/>
              <p className="font-bold">개발 의뢰가 없습니다</p>
              <button onClick={openNewModal} className="mt-2 text-xs text-violet-600 font-bold hover:underline">+ 새 의뢰 등록</button>
            </div>
          )}

          {/* 미진행 */}
          {rejectedDevReqs.length>0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <button onClick={()=>setShowRejected(!showRejected)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600">
                {showRejected?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} <XCircle className="w-3 h-3"/> 미진행 ({rejectedDevReqs.length}건)
              </button>
              {showRejected && <div className="space-y-1.5 mt-2 opacity-50">
                {rejectedDevReqs.map(d=>(
                  <ItemCard key={d.id} id={`dev-${d.id}`}
                    line1Left={<><span className="text-xs font-mono font-bold text-slate-400">{d.devOrderNo}</span><span className="text-xs text-slate-500">{d.buyerName}</span></>}
                    badges={<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statusCls.rejected}`}>미진행</span>}
                    expandContent={<div className="flex gap-1.5"><button onClick={()=>openEditModal(d)} className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded"><Edit2 className="w-3 h-3 inline"/> 수정</button><button onClick={()=>handleDeleteDevRequest(d.id)} className="px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded"><Trash2 className="w-3 h-3 inline"/> 삭제</button></div>}
                  />
                ))}
              </div>}
            </div>
          )}
        </div>
      )}

      {/* === 설계서 진행 뷰 (동일 카드 UI) === */}
      {activeView==='designProgress' && (
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto">
            {DESIGN_STAGES.map(s=>{const c=STAGE_COLORS[s.key]||STAGE_COLORS.draft; return (
              <div key={s.key} className={`shrink-0 px-2.5 py-1.5 rounded-lg border ${c.border} ${c.bg} text-center min-w-[70px]`}>
                <p className={`text-base font-extrabold ${c.text}`}>{stageCounts[s.key]||0}</p>
                <p className={`text-[9px] font-bold ${c.text}`}>{s.label}</p>
              </div>
            )})}
          </div>

          {filterSearch(activeSheets).length===0 && (
            <div className="text-center py-12 text-slate-400">
              <Edit2 className="w-12 h-12 mx-auto mb-2 opacity-20"/>
              <p className="font-bold">진행 중인 설계서가 없습니다</p>
            </div>
          )}

          {filterSearch(activeSheets).map(sheet=>{
            const si = stageInfo(sheet.stage);
            const ld = getLinkedDev(sheet.devRequestId);
            return (
              <ItemCard key={sheet.id} id={`sheet-${sheet.id}`}
                line1Left={<><span className="text-xs font-mono font-extrabold text-blue-600">{sheet.devOrderNo||'-'}</span>{sheet.buyerName&&<span className="text-xs font-bold text-slate-700">{sheet.buyerName}</span>}{sheet.fabricName&&<span className="text-xs text-slate-500">· {sheet.fabricName}</span>}</>}
                badges={<>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${si.bg} ${si.text} ${si.border}`}>{si.label}</span>
                  {sheet.version>1&&<span className="text-[10px] font-mono font-bold text-violet-500 bg-violet-50 px-1 py-0.5 rounded">v{sheet.version}</span>}
                  {sheet.articleNo&&<span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{sheet.articleNo}</span>}
                </>}
                details={<>
                  <span>🧶 {getComp(sheet.yarns)}</span>
                  {sheet.knitting?.factory&&<span>🏭 {sheet.knitting.factory}</span>}
                  {ld&&<span>📋 의뢰: {ld.devOrderNo}</span>}
                </>}
                expandContent={
                  <>
                    <DesignStepper currentStage={sheet.stage}/>
                    {ld && (
                      <div className="p-2 bg-violet-50 rounded border border-violet-200">
                        <p className="text-[9px] font-bold text-violet-600 uppercase mb-1">📋 연결 의뢰</p>
                        <div className="flex gap-3 text-[10px] text-slate-600">
                          <span><b className="text-violet-700">{ld.devOrderNo}</b></span>
                          <span>{ld.buyerName}</span>
                          {ld.targetSpec?.feeling && <span>느낌: {ld.targetSpec.feeling}</span>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[['혼용률',getComp(sheet.yarns)],['편직처',sheet.knitting?.factory],['EZ-TEX',sheet.eztexOrderNo],['담당자',sheet.assignee]].filter(([,v])=>v).map(([l,v])=>(
                        <div key={l}><p className="text-[9px] font-bold text-slate-400 uppercase">{l}</p><p className="text-xs text-slate-700 font-mono">{v}</p></div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                      <button onClick={()=>{handleEditSheet(sheet);setActiveTab('designSheet')}} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Edit2 className="w-3 h-3"/> 설계서</button>
                      <button onClick={()=>dropDesignSheet(sheet.id)} className="px-2 py-1 text-[10px] font-bold text-orange-600 bg-orange-50 rounded hover:bg-orange-100">DROP</button>
                      <button onClick={()=>advanceStage(sheet.id)} className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 rounded shadow-sm hover:shadow-md active:scale-95 ml-auto"><ArrowRight className="w-3 h-3"/> 다음 단계</button>
                    </div>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* === 등록/수정 모달 === */}
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
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">바이어명 *</label>
                  <select name="buyerName" value={devInput.buyerName} onChange={handleDevChange}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 ring-violet-200 outline-none uppercase">
                    <option value="">-- 선택 --</option>
                    {(buyers||[]).map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">상태</label>
                  <select name="status" value={devInput.status} onChange={handleDevChange}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 ring-violet-200 outline-none">
                    <option value="pending">대기중</option><option value="analyzing">분석 중</option><option value="confirmed">개발투입확정</option><option value="rejected">미진행</option>
                  </select>
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
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">샘플 생산 납기 📅 <span className="text-slate-400">(설계서 진행 납기)</span></label>
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

      {/* ===== 프린트 영역 (화면에는 숨기고 프린트 시만 표시) ===== */}
      {printTarget && (
        <div className="fixed left-0 top-0 w-full h-full pointer-events-none opacity-0 print:opacity-100 print:pointer-events-auto print:static z-[-1] print:z-50">
          <div ref={localPrintRef} className="w-full bg-white p-10 text-black" style={{fontFamily:'serif',fontSize:'13px'}}>
            {printType === 'report' ? (
              <>
                <h1 className="text-xl font-bold mb-1 text-center">GRUBIG 개발 의뢰 보고서</h1>
                <p className="text-xs text-gray-500 mb-6 text-center">Development Request Report — 내부 보고용</p>
                <div className="flex gap-8 mb-6">
                  <div className="flex-1">
                    <table className="w-full border-collapse" style={{fontSize:'12px'}}>
                      <tbody>
                        {[['개발번호',printTarget.devOrderNo],['바이어',printTarget.buyerName],['의뢰일자',printTarget.requestDate],['분석 납기',printTarget.targetSpec?.analysisDeadline||'-'],['샘플 납기',printTarget.targetSpec?.sampleDeadline||'-'],['상태',statusLabels[printTarget.status]||'-'],['혼용률/스펙',printTarget.targetSpec?.composition||'-'],['타겟 단가',printTarget.targetSpec?.targetPrice||'-'],['원하는 느낌',printTarget.targetSpec?.feeling||'-'],['기타 요청',printTarget.targetSpec?.otherRequests||'-']].map(([l,v])=>(
                          <tr key={l} className="border border-gray-300"><td className="bg-gray-100 font-bold p-2 w-[28%] border-r border-gray-300">{l}</td><td className="p-2 whitespace-pre-wrap">{v}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="w-[80mm] shrink-0">
                    <div className="border-2 border-dashed border-gray-400 w-full aspect-square flex items-center justify-center">
                      <p className="text-gray-400 text-center text-xs">개발 스와치<br/>붙임 공간</p>
                    </div>
                    {printTarget.swatchNote&&<p className="text-xs text-gray-500 mt-1 text-center">{printTarget.swatchNote}</p>}
                  </div>
                </div>
                <div className="border border-gray-300 p-3 mb-4"><p className="text-xs font-bold text-gray-500 mb-2">전무님 의견</p><div className="h-16"></div></div>
                <div className="border-t border-gray-300 pt-2 flex justify-between text-xs text-gray-400"><span>GRUBIG TRADING CO., LTD.</span><span>{new Date().toLocaleDateString()}</span></div>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold mb-1 text-center">원단 분석 의뢰서</h1>
                <p className="text-xs text-gray-500 mb-6 text-center">Fabric Analysis Request — 편직처 제출용</p>
                <table className="w-full border-collapse mb-6" style={{fontSize:'12px'}}>
                  <tbody>
                    {[['개발번호',printTarget.devOrderNo],['의뢰일자',printTarget.requestDate],['분석 납기',printTarget.targetSpec?.analysisDeadline||'-'],['혼용률/스펙',printTarget.targetSpec?.composition||'-'],['원하는 느낌',printTarget.targetSpec?.feeling||'-'],['기타 요청',printTarget.targetSpec?.otherRequests||'-']].map(([l,v])=>(
                      <tr key={l} className="border border-gray-300"><td className="bg-gray-100 font-bold p-2 w-[28%] border-r border-gray-300">{l}</td><td className="p-2 whitespace-pre-wrap">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-2 border-dashed border-gray-400 w-full h-[80mm] flex items-center justify-center mb-6">
                  <p className="text-gray-400 text-center text-xs">개발 스와치 붙임 공간</p>
                </div>
                <div className="border border-gray-300 p-3 mb-4">
                  <p className="text-xs font-bold text-gray-500 mb-2">편직처 분석 기록</p>
                  <div className="grid grid-cols-2 gap-4 h-28 border-t border-gray-200 pt-2" style={{fontSize:'11px'}}>
                    <div><p className="text-gray-400">추천 게이지:</p></div>
                    <div><p className="text-gray-400">예상 편직비:</p></div>
                    <div><p className="text-gray-400">적합 기종:</p></div>
                    <div><p className="text-gray-400">기타 의견:</p></div>
                  </div>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between text-xs text-gray-400"><span>GRUBIG TRADING CO., LTD.</span><span>{new Date().toLocaleDateString()}</span></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
