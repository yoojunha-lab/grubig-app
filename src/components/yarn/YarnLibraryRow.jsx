import React from 'react';
import { History, Edit2, Trash2 } from 'lucide-react';
import { num, usd } from '../../utils/helpers';
import { describeImportBrackets, isImportSupplier } from '../../utils/costModel';
import { getYarnRowInfo, getCategoryColor } from './yarnRowModel';

export const YarnLibraryRow = React.memo(({
  y,
  exchangeRates,
  handleEditYarn,
  handleDeleteYarn,
  yarnLibrary,
  setYarnLibrary,
  costSettings = null, // 수입 원사 운반비 구간 (원가 설정)
}) => {
  // 대표 공급처 단가·관세·운반비·내수 단가·최종 수정일 — yarnRowModel (PC 행·모바일 카드 공통)
  const { defSup, isImport, importCountry, importRange, freightAmt, domPrice, lastPriceDate } =
    getYarnRowInfo(y, exchangeRates, costSettings);
  const importTip = isImport
    ? [`${importCountry.name} 운반비 (원사 kg 구간)`, ...describeImportBrackets(importCountry).map(b => `${b.label}: ${num(b.perKg)}원/kg`)].join('\n')
    : undefined;
  const catColor = getCategoryColor(y.category || '-');

  return (
    <tr className="hover:bg-blue-50 group transition-colors">
      <td className="px-6 py-2.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase whitespace-nowrap inline-block ${catColor}`}>
          {y.category || '-'}
        </span>
      </td>
      <td className="px-6 py-2.5 font-bold text-slate-900 uppercase text-sm tracking-tight">{y.name}</td>
      <td className="px-6 py-2.5 font-medium text-slate-600 text-[11px] uppercase">
        {y.suppliers?.map((s) => (
          <span key={s.id} className="inline-block mr-1">
            {s.isDefault ? <strong className="text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.5">[{s.name}]</strong> : <span className="text-slate-500 bg-slate-50 border border-slate-100 rounded px-1 py-0.5">{s.name}</span>}
            {isImportSupplier(s) && <span className="ml-0.5 text-[9px] font-bold text-emerald-700 normal-case">수입</span>}
          </span>
        ))}
      </td>
      <td className="px-6 py-2.5 text-right font-mono relative group/price">
        <div className="flex items-center justify-end gap-2">
          <span className="font-medium text-slate-700">{defSup.currency === 'USD' ? '$' : '￦'}{defSup.currency === 'USD' ? usd(defSup.price) : num(defSup.price)}</span>
          {defSup.history && defSup.history.length > 0 && (
            <div className="relative">
              <History className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-blue-500" />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 text-white text-[11px] rounded-lg p-3 z-50 hidden group-hover/price:block shadow-xl text-left pointer-events-none border border-slate-700">
                <p className="font-bold mb-2 border-b border-slate-600 pb-2 text-slate-300">[{defSup.name}] 단가 히스토리</p>
                {defSup.history.map((h, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="text-slate-400">{h.date}</span>
                    <span className="font-mono text-emerald-400">{defSup.currency === 'USD' ? '$' : '￦'}{defSup.currency === 'USD' ? usd(h.price) : num(h.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-2.5 text-right text-slate-500 font-medium text-sm">{defSup.tariff || 0}%</td>
      <td className="px-6 py-2.5 text-right font-bold text-emerald-600 text-sm" title={importTip}>
        {isImport ? (
          <div className="flex flex-col items-end gap-0.5 cursor-help">
            <span className="whitespace-nowrap">￦{num(importRange.min)}~{num(importRange.max)}</span>
            <span className="text-[9px] text-emerald-700 font-sans tracking-tight bg-emerald-50 border border-emerald-100 px-1 rounded leading-none whitespace-nowrap">수입 · {importCountry.name} 구간</span>
          </div>
        ) : <>￦{num(freightAmt)}</>}
      </td>
      <td className="px-6 py-2.5 text-right font-mono font-bold text-sm">
        {isImport ? (
          <div className="flex flex-col items-end gap-0.5" title={importTip}>
            <span className="text-blue-700 whitespace-nowrap">￦{num(domPrice + importRange.min)}~{num(domPrice + importRange.max)}</span>
            <span className="text-[9px] text-slate-500 font-sans tracking-tight bg-slate-100 px-1 rounded leading-none">(운반비 구간{defSup.currency === 'USD' ? ' · $적용' : ''})</span>
          </div>
        ) : defSup.currency === 'USD' ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-blue-700">￦{num(domPrice)}</span>
            <span className="text-[9px] text-slate-500 font-sans tracking-tight bg-slate-100 px-1 rounded leading-none">($적용)</span>
          </div>
        ) : <span className="text-blue-700">￦{num(domPrice)}</span>}
      </td>
      <td className="px-6 py-2.5 text-center whitespace-nowrap">
        {lastPriceDate
          ? <span className="text-slate-600 font-medium font-mono text-[12px]">{lastPriceDate}</span>
          : <span className="text-slate-300">-</span>}
      </td>
      <td className="px-6 py-2.5 text-slate-500 text-xs max-w-[200px]">
        <div className="line-clamp-2 leading-tight" title={y.remarks}>{y.remarks}</div>
      </td>
      <td className="px-6 py-2.5 text-center">
        <div className="flex justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleEditYarn(y)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="수정"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDeleteYarn(y.id, (id) => setYarnLibrary(yarnLibrary.filter(item => item.id !== id)))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-md transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return prevProps.y === nextProps.y &&
         prevProps.exchangeRates === nextProps.exchangeRates &&
         prevProps.yarnLibrary === nextProps.yarnLibrary &&
         // 원가 설정(수입 운반비 구간)이 바뀌면 운반비·내수 단가 범위가 달라지므로 재렌더
         prevProps.costSettings === nextProps.costSettings;
});
