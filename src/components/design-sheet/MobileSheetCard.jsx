import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, History, RotateCcw } from 'lucide-react';
import { num } from '../../utils/helpers';
import { FIELD_LABELS } from './constants';
import { STAGE_COLORS } from '../../constants/common';

export const MobileSheetCard = ({
  sheet, 
  costData, 
  history = [], 
  viewMode, 
  isExpanded, 
  onToggle, 
  handleEditSheet, 
  handleDeleteSheet, 
  getCompositionText,
  getLinkedBuyer,
  isDropped = false,
  restoreFromDrop
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const buyer = getLinkedBuyer ? getLinkedBuyer(sheet) : '';

  const prefix = viewMode === 'export' ? '$' : '₩';
  const priceFn = (val) => viewMode === 'export' ? (val || 0).toFixed(2) : num(val || 0);

  const getStageLabelAndColor = (stageKey) => {
    const colors = STAGE_COLORS[stageKey] || STAGE_COLORS.draft;
    const labels = { draft: '설계서 작성', eztex: 'EZ-TEX O/D NO.', sampling: '샘플 진행', articled: '아이템화' };
    return { label: labels[stageKey] || '작성중', ...colors };
  };

  const stageInfo = getStageLabelAndColor(sheet.stage);

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden mb-3 transition-colors ${
      isDropped ? 'border-red-200 grayscale-[0.3]' : 'border-slate-200 hover:border-blue-300'
    }`}>
      {/* 요약 헤더 (언제나 보임) */}
      <div className="p-3 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5">
              {!isDropped && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>{stageInfo.label}</span>}
              {isDropped && <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1 py-0.5 rounded">DROP</span>}
              
              {(sheet.articleNo || sheet.eztexOrderNo) && (
                <span className={`text-[10px] font-mono font-black border px-1.5 py-0.5 rounded ${isDropped ? 'text-violet-700 bg-violet-50 border-violet-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                  {isDropped ? (sheet.eztexOrderNo || 'EZ-TEX 없음') : (sheet.articleNo || sheet.eztexOrderNo)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{sheet.devOrderNo || '자체설계'}</span>
          </div>

          <div className="flex items-center gap-1">
             {(isDropped && restoreFromDrop) && (
               <button onClick={(e) => { e.stopPropagation(); restoreFromDrop(sheet.id); }}
                 className="p-1 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 mr-1" title="복원">
                 <RotateCcw className="w-3.5 h-3.5" />
               </button>
             )}
             {!isDropped && (
               <button onClick={(e) => { e.stopPropagation(); handleEditSheet(sheet); }}
                 className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="수정">
                 <Edit2 className="w-3.5 h-3.5" />
               </button>
             )}
             <button onClick={(e) => { e.stopPropagation(); handleDeleteSheet(sheet.id); }}
               className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors mr-1" title="삭제">
               <Trash2 className="w-3.5 h-3.5" />
             </button>
             <div className="p-1 text-slate-400 bg-slate-50 rounded">
               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
             </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-extrabold text-slate-800 break-words pr-2">{sheet.fabricName || '원단명 미입력'}</h4>
          <div className="flex justify-between items-end mt-1 text-[11px]">
            <div className="text-slate-500 line-clamp-2 w-[60%] leading-tight break-words">
              {getCompositionText(sheet.yarns) || '혼용률 없음'}
            </div>
            {!isDropped && (
               <div className="text-right shrink-0">
                 <span className="text-[9px] font-bold text-slate-400 block">3K 도매가</span>
                 <span className="font-mono font-black text-blue-600 text-[13px]">
                   {costData ? `${prefix}${priceFn(viewMode === 'export' ? costData.tier3k?.export?.priceBrand : costData.tier3k?.domestic?.priceBrand)}` : '-'}
                 </span>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* 아코디언 상세 내역 */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-[11px] space-y-3">
           <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-slate-700 bg-white p-2.5 rounded border border-slate-100">
             <div><span className="text-[9px] text-slate-400 block mb-0.5">편직처 / 기종</span> <span className="font-bold">{sheet.knitting?.factory || '-'}</span> <span className="text-slate-500">({sheet.knitting?.machineType || '-'})</span></div>
             <div><span className="text-[9px] text-slate-400 block mb-0.5">염가공 / 후가공</span> <span className="font-bold">{sheet.dyeing?.factory || '-'}</span> <span className="text-slate-500">({sheet.finishing?.type || '-'})</span></div>
             <div><span className="text-[9px] text-slate-400 block mb-0.5">내폭 / 외폭</span> <span className="font-mono font-medium">"{sheet.costInput?.widthCut||'-'}" / "{sheet.costInput?.widthFull||'-'}"</span></div>
             <div><span className="text-[9px] text-slate-400 block mb-0.5">중량(GSM)</span> <span className="font-mono font-medium">{sheet.costInput?.gsm||'-'}g ({sheet.costInput?.costGYd||'-'}g/y)</span></div>
           </div>

           {/* 모바일용 단가 카드 */}
           {costData && !isDropped && (
             <div className="space-y-2">
               <h5 className="text-[10px] font-bold text-slate-500 pl-1">구간별 도매가 / 제조원가</h5>
               <div className="grid grid-cols-3 gap-2">
                 {[{ label: '1K', tier: 'tier1k' }, { label: '3K', tier: 'tier3k' }, { label: '5K', tier: 'tier5k' }].map(({ label, tier }) => {
                    const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
                    return (
                      <div key={tier} className="bg-white border border-slate-200 rounded p-2 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <p className="text-[10px] font-black text-blue-700 mb-1">{label}</p>
                        <p className="text-[11px] font-mono font-bold text-slate-800">{prefix}{priceFn(data?.priceBrand)}</p>
                        <p className="text-[9px] font-mono text-slate-500 pt-0.5 border-t border-slate-100 mt-0.5">{prefix}{priceFn(data?.totalCostYd)}</p>
                      </div>
                    );
                 })}
               </div>
             </div>
           )}

           {/* 이력 */}
           {history && history.length > 0 && (
             <div className="mt-2 border border-amber-200 rounded overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 transition-colors">
                  <span className="text-[9px] font-extrabold text-amber-700 flex items-center gap-1">
                    <History className="w-2.5 h-2.5" /> 이력 ({history.length})
                  </span>
                  {showHistory ? <ChevronUp className="w-3 h-3 text-amber-600" /> : <ChevronDown className="w-3 h-3 text-amber-600" />}
                </button>
                {showHistory && (
                  <div className="p-2.5 bg-white space-y-2 max-h-40 overflow-y-auto w-full text-left">
                    {history.map((entry, idx) => (
                      <div key={idx} className="relative pl-3 border-l-2 border-amber-300 mb-2 last:mb-0">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-amber-400" />
                        <p className="text-[9px] font-bold text-amber-600 mb-0.5">
                          {new Date(entry.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric' })}
                        </p>
                        {entry.reason && <p className="text-[9px] text-slate-600 bg-amber-50/50 px-1 py-0.5 rounded inline-block mb-1 italic">사유: {entry.reason}</p>}
                        <div className="space-y-0.5">
                           {Object.entries(entry.fields || {}).map(([fieldKey, oldValue]) => (
                             <div key={fieldKey} className="text-[9px] flex flex-wrap gap-1">
                               <span className="font-bold text-slate-500">{FIELD_LABELS[fieldKey] || fieldKey}:</span>
                               <span className="text-emerald-600">수정됨</span>
                             </div>
                           ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
