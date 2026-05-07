import React from 'react';
import { Clock, Trash2, Printer, CheckCircle2, XCircle, ArrowRight, Calendar } from 'lucide-react';

// 진입 날짜 → "MM/DD · N일째" 포맷 (없으면 null)
const formatStageEntry = (iso) => {
  if (!iso) return null;
  const t = new Date(iso); if (isNaN(t)) return null;
  const now = new Date();
  const days = Math.floor((now.setHours(0,0,0,0) - new Date(t).setHours(0,0,0,0)) / 86400000);
  const mm = String(t.getMonth()+1).padStart(2,'0');
  const dd = String(t.getDate()).padStart(2,'0');
  return `${mm}/${dd} · ${days === 0 ? '오늘' : `${days}일째`}`;
};

// 우선순위 (지연/임박/정상) → 카드 좌측 보더 컬러 매핑
const urgencyBorderCls = {
  overdue: 'border-l-4 border-l-rose-500',
  urgent: 'border-l-4 border-l-orange-400',
  normal: ''
};

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
  handleGoToSheet,
  compact = false,
  urgency = 'normal'  // 'overdue' | 'urgent' | 'normal'
}) => {
  // 단계별로 다른 마감일을 사용
  // - pending/analyzing: 분석 납기 (analysisDeadline)
  // - hold/confirmed: 샘플 납기 (sampleDeadline) — 분석은 끝났으므로
  // - rejected: 표시 없음
  const deadlineForStage = (d.status === 'pending' || d.status === 'analyzing')
    ? d.targetSpec?.analysisDeadline
    : (d.status === 'hold' || d.status === 'confirmed')
      ? d.targetSpec?.sampleDeadline
      : null;
  const deadlineLabel = (d.status === 'pending' || d.status === 'analyzing')
    ? '분석'
    : (d.status === 'hold' || d.status === 'confirmed')
      ? '샘플'
      : '';
  const db = deadlineBadge(deadlineForStage);
  const isLocked = d.status === 'confirmed' && !!getLinkedSheet(d);

  // 현재 status 진입 날짜 (없으면 updatedAt fallback)
  const stageEntryStr = formatStageEntry(d.statusEnteredAt?.[d.status] || d.updatedAt);

  const borderCls = urgencyBorderCls[urgency] || '';
  const bgUrgencyCls = urgency === 'overdue' ? 'bg-rose-50/40' : 'bg-white';

  // ============ 컴팩트 모드 ============
  if (compact) {
    return (
      <div
        onClick={() => openEditModal(d)}
        className={`${bgUrgencyCls} rounded-md ${borderCls} border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow transition-all px-2 py-1.5 cursor-pointer flex items-center gap-1.5 text-[11px]`}
      >
        <span className="font-mono font-extrabold text-violet-600 shrink-0">{d.devOrderNo}</span>
        <span className="font-bold text-slate-700 truncate flex-1">{d.buyerName}</span>
        {db && (
          <span className={`text-[9px] rounded px-1 py-0.5 whitespace-nowrap leading-none shrink-0 ${db.c}`} title={`${deadlineLabel} 납기`}>
            {db.t}
          </span>
        )}
      </div>
    );
  }
  // =====================================

  // 상태별 명시 액션 버튼 노출 조건
  const showAnalyzeDone = d.status === 'analyzing';
  const showStartDesign = d.status === 'hold' || (d.status === 'confirmed' && !getLinkedSheet(d));
  const showDropBtn = d.status === 'analyzing' || d.status === 'hold';

  const handleDropClick = () => {
    if (window.confirm('이 개발 의뢰를 Drop(미진행) 처리할까요?\n나중에 상태를 다시 변경할 수 있습니다.')) {
      updateDevStatus(d.id, 'rejected');
    }
  };

  return (
    <div className={`${bgUrgencyCls} rounded-xl ${borderCls} border border-slate-200 shadow-sm hover:border-slate-300 transition-all p-2`}>
      {/* 상단: 상태 및 오더번호 */}
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
        <div className="flex gap-1.5 items-center">
           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${statusCls[d.status] || ''}`}>
             {statusLabels[d.status] || d.status}
           </span>
           <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
        </div>
        {db && (
          <span
            className={`text-[9px] rounded px-1 py-0.5 whitespace-nowrap leading-none ${db.c}`}
            title={`${deadlineLabel} 납기 기준`}
          >
            <Clock className="w-2.5 h-2.5 inline mr-0.5"/>{deadlineLabel ? `${deadlineLabel} ${db.t}` : db.t}
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
        {/* 단계 진입 날짜 */}
        {stageEntryStr && (
          <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1" title={`${statusLabels[d.status] || d.status} 진입`}>
            <Calendar className="w-2.5 h-2.5" />
            <span className="font-medium">{stageEntryStr}</span>
          </div>
        )}
      </div>

      {/* 명시 액션 버튼 영역 (상태별) */}
      {!isLocked && (showAnalyzeDone || showStartDesign || showDropBtn) && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {showAnalyzeDone && (
            <button
              onClick={() => updateDevStatus(d.id, 'hold')}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors"
              title="분석을 완료하고 대기중 단계로 이동"
            >
              <CheckCircle2 className="w-3 h-3" /> 분석완료
            </button>
          )}
          {showStartDesign && (
            <button
              onClick={() => handleGoToSheet(d)}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors"
              title="설계서 작성을 시작합니다"
            >
              <ArrowRight className="w-3 h-3" /> 설계서 작성
            </button>
          )}
          {showDropBtn && (
            <button
              onClick={handleDropClick}
              className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200 transition-colors"
              title="이 의뢰를 Drop(미진행) 처리"
            >
              <XCircle className="w-3 h-3" /> Drop
            </button>
          )}
        </div>
      )}

      {/* 하단: 보조 컨트롤 (드롭다운 / 수정 / 삭제 / 프린트) */}
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
               <option value="confirmed">개발투입확정</option>
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
             title={d.status === 'pending' ? '프린트 (자동으로 분석중 단계로 진행)' : '프린트'}
           >
             <Printer className="w-3.5 h-3.5" />
           </button>
         </div>
      </div>
    </div>
  );
};
