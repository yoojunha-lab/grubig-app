import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, History } from 'lucide-react';
import { num } from '../../utils/helpers';
import { FIELD_LABELS } from './constants';

export const DesktopSheetRow = ({
  sheet, 
  costData, 
  history = [], 
  viewMode, 
  isExpanded, 
  onToggle, 
  handleEditSheet, 
  handleDeleteSheet, 
  getCompositionText,
  getLinkedBuyer
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const buyer = getLinkedBuyer ? getLinkedBuyer(sheet) : '';

  // Calculate prefix matching viewMode
  const prefix = viewMode === 'export' ? '$' : '₩';
  const priceFn = (val) => viewMode === 'export' ? (val || 0).toFixed(2) : num(val || 0);

  return (
    <>
      <tr className={`border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/20' : 'bg-white'}`}
          onClick={onToggle}>
        {/* 1. Date & Info */}
        <td className="p-3 align-middle border-x border-slate-100 first:border-l-0">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">{(sheet.updatedAt || sheet.createdAt || '').substring(0, 10)}</span>
            <span className="font-mono font-black text-emerald-700 text-xs bg-emerald-50 px-1 inline-block w-max rounded border border-emerald-100">{sheet.articleNo || '-'}</span>
            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">{sheet.devOrderNo || '자체설계'}</span>
          </div>
        </td>

        {/* 2. Spec (원단명, 폭, GSM) */}
        <td className="p-3 align-middle border-r border-slate-100">
          <p className="text-[13px] font-extrabold text-slate-800 mb-1">{sheet.fabricName || '-'}</p>
          <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
             <span className="font-mono text-slate-600">"{sheet.costInput?.widthCut || '-'}" / "{sheet.costInput?.widthFull || '-'}"</span>
             <span className="font-mono text-slate-600">{sheet.costInput?.gsm || '-'}g ({sheet.costInput?.costGYd || '-'}g/y)</span>
          </div>
        </td>

        {/* 3. Yarn Mix (원사 배합) */}
        <td className="p-3 align-middle border-r border-slate-100">
          <div className="text-[11px] text-slate-600 line-clamp-2 leading-snug max-w-[150px] break-words">
            {getCompositionText(sheet.yarns) || '혼용률 없음'}
          </div>
        </td>

        {/* 4. Knitting (편직처, 조직, 스펙) */}
        <td className="p-3 align-middle border-r border-slate-100">
          <p className="text-xs font-bold text-indigo-800">{sheet.knitting?.factory || '-'}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{sheet.knitting?.structure || '-'}</p>
          <p className="text-[10px] font-mono text-slate-400">{sheet.knitting?.gauge || '-'}G / {sheet.knitting?.machineInch || '-'}″</p>
        </td>

        {/* 5. Dyeing (염가공처, 후가공) */}
        <td className="p-3 align-middle border-r border-slate-100">
          <p className="text-xs font-bold text-violet-800">{sheet.dyeing?.factory || '-'}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{sheet.finishing?.type || '후가공 없음'}</p>
        </td>

        {/* 6. 단가 요약 (3K 도매가) */}
        <td className="p-3 align-middle border-r border-slate-100 text-right bg-slate-50/50">
          <span className="text-[9px] font-bold text-slate-400 block mb-0.5">3K 도매가</span>
          <span className="text-sm font-black text-blue-600">
             {costData ? `${prefix}${priceFn(viewMode === 'export' ? costData.tier3k?.export?.priceBrand : costData.tier3k?.domestic?.priceBrand)}` : '-'}
          </span>
        </td>

        {/* 7. Action */}
        <td className="p-3 align-middle text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={(e) => { e.stopPropagation(); handleEditSheet(sheet); }}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="수정">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteSheet(sheet.id); }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="삭제">
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="p-1.5 text-slate-300 ml-1 group-hover:text-slate-600 transition-colors">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </td>
      </tr>

      {/* 아코디언 하단 영역 */}
      {isExpanded && (
        <tr className="bg-slate-50 border-b-2 border-slate-300">
          <td colSpan="7" className="p-4 px-6 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
            
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                 상세 원가 명세 (1K / 3K / 5K)
                 {buyer && <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-normal">바이어: {buyer}</span>}
              </h4>
            </div>
            
            {/* 단가 테이블 */}
            {costData ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {[{ label: '1K', tier: 'tier1k' }, { label: '3K', tier: 'tier3k' }, { label: '5K', tier: 'tier5k' }].map(({ label, tier }) => {
                   const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
                   return (
                     <div key={tier} className="bg-white border border-slate-200 shadow-sm rounded-lg p-3">
                       <p className="text-[11px] font-black text-blue-700 mb-2 pb-1 border-b border-slate-100 flex justify-between items-center">
                         {label} 기준
                         <span className="text-[10px] font-normal text-slate-400">YDS</span>
                       </p>
                       <div className="space-y-1.5 mt-2">
                         <div className="flex justify-between text-[11px] bg-slate-50 px-1 py-0.5 rounded">
                           <span className="font-bold text-slate-700">도매가</span>
                           <span className="font-mono font-bold text-blue-600">{prefix}{priceFn(data?.priceBrand)}</span>
                         </div>
                         <div className="flex justify-between text-[11px] px-1 py-0.5 mt-2">
                           <span className="text-slate-500">기본단가</span>
                           <span className="font-mono text-slate-600">{prefix}{priceFn(data?.priceConverter)}</span>
                         </div>
                         <div className="flex justify-between text-[11px] px-1 py-0.5 border-t border-dashed border-slate-200 mt-1 pt-1">
                           <span className="text-slate-500">제조원가(Total)</span>
                           <span className="font-mono text-slate-600 font-bold">{prefix}{priceFn(data?.totalCostYd)}</span>
                         </div>
                         <div className="flex justify-between text-[10px] px-1 text-slate-400 pl-3">
                           <span>└ 원사비</span><span className="font-mono">{prefix}{priceFn(data?.yarnCostYd)}</span>
                         </div>
                         <div className="flex justify-between text-[10px] px-1 text-slate-400 pl-3">
                           <span>└ 편직비</span><span className="font-mono">{prefix}{priceFn(data?.knittingFeeYd)}</span>
                         </div>
                         <div className="flex justify-between text-[10px] px-1 text-slate-400 pl-3">
                           <span>└ 염가공비</span><span className="font-mono">{prefix}{priceFn(data?.dyeingFeeYd)}</span>
                         </div>
                       </div>
                     </div>
                   );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-4 bg-white border border-slate-100 rounded-lg p-4 text-center">저장된 원가 데이터가 없습니다.</p>
            )}

            {/* 변경 이력 */}
            {history && history.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg overflow-hidden shrink-0 mt-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition-colors">
                  <span className="text-[10px] font-extrabold text-amber-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <History className="w-3 h-3" /> 변경 이력 ({history.length}건)
                  </span>
                  {showHistory ? <ChevronUp className="w-3 h-3 text-amber-600" /> : <ChevronDown className="w-3 h-3 text-amber-600" />}
                </button>
                {showHistory && (
                  <div className="p-3 bg-white space-y-3 max-h-48 overflow-y-auto w-full text-left">
                    {history.map((entry, idx) => (
                      <div key={idx} className="relative pl-3 border-l-2 border-amber-300">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-amber-400" />
                        <p className="text-[10px] font-bold text-amber-600 mb-1">
                          {new Date(entry.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {entry.reason && (
                          <p className="text-[10px] text-slate-600 bg-amber-50/50 px-2 py-1 rounded inline-block mb-1.5 italic border border-amber-100/50">
                            사유: {entry.reason}
                          </p>
                        )}
                        <div className="space-y-0.5 mt-1">
                          {Object.entries(entry.fields || {}).map(([fieldKey, oldValue]) => (
                            <div key={fieldKey} className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="font-bold text-slate-500 shrink-0">{FIELD_LABELS[fieldKey] || fieldKey}:</span>
                              <span className="text-red-400 line-through truncate max-w-[100px]">{oldValue || '(비어있음)'}</span>
                              <span className="text-slate-300 text-[8px]">▶</span>
                              <span className="text-emerald-600 font-bold">변경됨</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};
