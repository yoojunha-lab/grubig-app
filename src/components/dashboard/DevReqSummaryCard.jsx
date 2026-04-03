import React from 'react';
import { Clock, Trash2, Printer } from 'lucide-react';

export const DevReqSummaryCard = ({
  d,
  statusCls,
  statusLabels,
  deadlineBadge,
  getLinkedSheet,
  updateDevStatus,
  openEditModal,
  handleDeleteDevRequest,
  handlePrint,
  handleGoToSheet
}) => {
  const db = deadlineBadge(d.targetSpec?.analysisDeadline);
  const isLocked = d.status === 'confirmed' && !!getLinkedSheet(d);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all p-2">
      {/* 상단: 상태 및 오더번호 */}
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
        <div className="flex gap-1.5 items-center">
           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${statusCls[d.status] || ''}`}>
             {statusLabels[d.status] || d.status}
           </span>
           <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
        </div>
        {db && (
          <span className={`text-[9px] rounded px-1 py-0.5 whitespace-nowrap leading-none ${db.c}`}>
            <Clock className="w-2.5 h-2.5 inline mr-0.5"/>{db.t}
          </span>
        )}
      </div>
      
      {/* 중앙: 바이어 및 내용 */}
      <div className="mb-2">
        <p className="text-xs font-bold text-slate-800 leading-tight">{d.buyerName}</p>
        <div className="flex gap-1.5 text-[10px] text-slate-500 mt-1 flex-wrap">
           {d.devItem && <span className="bg-slate-100 px-1 py-0.5 leading-none rounded">{d.devItem}</span>}
           {d.targetSpec?.composition && <span>{d.targetSpec.composition.substring(0,25)}</span>}
        </div>
      </div>
      
      {/* 하단: 액션 버튼 */}
      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100 items-center justify-between">
         <div className="flex flex-wrap gap-1 shrink-0">
           {!isLocked && (
             <select 
               value={d.status} 
               onChange={e => updateDevStatus(d.id, e.target.value)}
               className="border border-slate-300 rounded px-1 py-0.5 text-[9px] font-bold outline-none bg-slate-50 cursor-pointer text-slate-700"
             >
               <option value="pending">의뢰 접수</option>
               <option value="analyzing">분석 중</option>
               <option value="hold">대기중</option>
               <option value="confirmed">확정하기</option>
               <option value="rejected">Drop (미진행)</option>
             </select>
           )}
           {!isLocked && (
             <button 
               onClick={() => openEditModal(d)} 
               className="px-1.5 py-0.5 text-[9px] font-bold text-slate-600 hover:text-blue-600 border border-slate-200 rounded leading-none"
             >
               의뢰 수정
             </button>
           )}
           {!isLocked && (d.status === 'pending' || d.status === 'analyzing' || d.status === 'hold' || d.status === 'rejected') && (
             <button 
               onClick={() => handleDeleteDevRequest(d.id)} 
               className="p-0.5 text-slate-400 hover:text-red-500 rounded flex items-center justify-center"
               title="삭제"
             >
               <Trash2 className="w-3.5 h-3.5" />
             </button>
           )}
         </div>
         
         <div className="flex flex-wrap gap-1 shrink-0">
           <button 
             onClick={() => handlePrint(d, 'report')} 
             className="p-0.5 text-slate-400 hover:text-slate-600 rounded flex items-center justify-center"
             title="프린트"
           >
             <Printer className="w-3.5 h-3.5" />
           </button>
           {d.status === 'confirmed' && !getLinkedSheet(d) && (
              <button 
                onClick={() => handleGoToSheet(d)} 
                className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm leading-none whitespace-nowrap"
              >
                설계서 작성
              </button>
           )}
         </div>
      </div>
    </div>
  );
};
