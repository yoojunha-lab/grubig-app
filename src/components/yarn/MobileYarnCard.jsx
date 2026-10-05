import React from 'react';
import { History, Edit2, Trash2, Info } from 'lucide-react';
import { num, usd } from '../../utils/helpers';
import { isImportSupplier } from '../../utils/costModel';
import { getYarnRowInfo, getCategoryColor } from './yarnRowModel';

export const MobileYarnCard = React.memo(({
  y,
  globalExchangeRate,
  handleEditYarn,
  handleDeleteYarn,
  yarnLibrary,
  setYarnLibrary,
  costSettings = null, // 수입 원사 운반비 구간 (원가 설정)
}) => {
  // 대표 공급처 단가·관세·운반비·내수 단가·최종 수정일 — yarnRowModel (PC 행·모바일 카드 공통)
  const { defSup, convertedPrice, isImport, importCountry, importRange, freightAmt, domPrice, lastPriceDate } =
    getYarnRowInfo(y, globalExchangeRate, costSettings);
  const catColor = getCategoryColor(y.category || '-');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-3">
      {/* 카드 상단: 카테고리, 원사명, 액션 버튼 */}
      <div className="p-3.5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
        <div className="flex-1 pr-3">
          <div className="mb-1.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase inline-block ${catColor}`}>{y.category || '-'}</span></div>
          <div className="font-extrabold text-slate-900 uppercase text-lg tracking-tight leading-tight">{y.name}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => handleEditYarn(y)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg shadow-sm active:scale-95 transition-all"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDeleteYarn(y.id, (id) => setYarnLibrary(yarnLibrary.filter(item => item.id !== id)))} className="p-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg shadow-sm active:scale-95 transition-all"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* 공급처 및 기본 정보 */}
      <div className="p-3.5 space-y-3">
        <div className="flex flex-col gap-1.5 text-xs text-slate-600">
          <div className="font-bold text-slate-500 mb-0.5 text-[11px]">공급처 (Suppliers)</div>
          <div className="flex flex-wrap gap-1.5">
            {y.suppliers?.map((s) => (
              <span key={s.id} className="inline-block uppercase text-[11px]">
                {s.isDefault ? <strong className="text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 shadow-sm">[{s.name}]</strong> : <span className="text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">{s.name}</span>}
                {isImportSupplier(s) && <span className="ml-0.5 text-[9px] font-bold text-emerald-700">수입</span>}
              </span>
            ))}
          </div>
        </div>

        {/* 단가 정보 블록 (메인) */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative overflow-hidden">
          {/* 장식용 패턴 */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none -mt-4 -mr-4"></div>

          <div className="mb-2 border-b border-slate-200/60 pb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-slate-500">수입단가 (Price Exp. /kg)</span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-700">
                {defSup.currency === 'USD' ? '$' : '￦'}{defSup.currency === 'USD' ? usd(defSup.price) : num(defSup.price)}
                {defSup.history && defSup.history.length > 0 && <History className="w-3.5 h-3.5 text-slate-400" />}
              </div>
            </div>
            {defSup.currency === 'USD' && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">환율 {globalExchangeRate} 적용시:</span>
                <span className="text-slate-500 font-mono">￦{num(convertedPrice)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
              <div className="flex justify-between w-24"><span className="text-slate-400">관세(Tariff)</span><span>{defSup.tariff || 0}%</span></div>
              {isImport ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5"><span className="text-slate-400">운반비</span><span className="text-emerald-600 font-bold font-mono">￦{num(importRange.min)}~{num(importRange.max)}</span></div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 rounded w-fit">수입 · {importCountry.name} kg 구간</span>
                </div>
              ) : (
                <div className="flex justify-between w-24"><span className="text-slate-400">부대(Freight/kg)</span><span className="text-emerald-600">￦{num(freightAmt)}</span></div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-blue-500 mb-0.5">최종 내수전환 단가 (/kg)</div>
              {isImport ? (
                <div className="font-mono font-extrabold text-[14px] text-blue-700 leading-none whitespace-nowrap">￦{num(domPrice + importRange.min)}~{num(domPrice + importRange.max)}</div>
              ) : (
                <div className="font-mono font-extrabold text-[17px] text-blue-700 leading-none">￦{num(domPrice)}</div>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between items-center text-[10px]">
            <span className="text-slate-400 font-bold">단가 수정일</span>
            <span className="font-mono text-slate-500">{lastPriceDate || '-'}</span>
          </div>
        </div>

        {/* Remarks (특이사항) */}
        {y.remarks && (
          <div className="text-[11px] text-slate-600 bg-yellow-50/50 border border-yellow-100 p-2.5 rounded-lg leading-relaxed shadow-sm">
            <span className="font-bold flex items-center gap-1 mb-1 text-[10px] text-yellow-600 uppercase tracking-wider"><Info className="w-3 h-3" /> Memo</span>
            <div className="line-clamp-3">{y.remarks}</div>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.y === nextProps.y &&
         prevProps.globalExchangeRate === nextProps.globalExchangeRate &&
         prevProps.yarnLibrary === nextProps.yarnLibrary &&
         // 원가 설정(수입 운반비 구간)이 바뀌면 운반비·내수 단가 범위가 달라지므로 재렌더
         prevProps.costSettings === nextProps.costSettings;
});
