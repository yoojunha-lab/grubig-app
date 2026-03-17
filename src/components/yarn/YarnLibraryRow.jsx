import React, { useMemo } from 'react';
import { History, Edit2, Trash2 } from 'lucide-react';
import { num } from '../../utils/helpers';

export const YarnLibraryRow = React.memo(({
  y,
  globalExchangeRate,
  handleEditYarn,
  handleDeleteYarn,
  yarnLibrary,
  setYarnLibrary
}) => {
  const defSup = y.suppliers?.find(s => s.isDefault) || y.suppliers?.[0] || {};
  const convertedPrice = defSup.currency === 'USD' ? (defSup.price || 0) * (globalExchangeRate || 1450) : (defSup.price || 0);
  const domPrice = Math.round(convertedPrice * (1 + ((defSup.tariff || 0) + (defSup.freight || 0)) / 100));

  const getCategoryColor = (cat) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-rose-100 text-rose-800 border-rose-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
    ];
    const hash = String(cat).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  const catColor = getCategoryColor(y.category || '-');

  return (
    <tr className="hover:bg-blue-50 group transition-colors">
      <td className="px-6 py-5">
        <span className={`text-[11px] font-bold px-2 py-1 rounded-md border uppercase whitespace-nowrap inline-block ${catColor}`}>
          {y.category || '-'}
        </span>
      </td>
      <td className="px-6 py-5 font-bold text-slate-900 uppercase text-base tracking-tight">{y.name}</td>
      <td className="px-6 py-5 font-medium text-slate-600 text-[11px] leading-relaxed uppercase">
        {y.suppliers?.map((s) => (
          <span key={s.id} className="inline-block mr-1 mb-1">
            {s.isDefault ? <strong className="text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.5">[{s.name}]</strong> : <span className="text-slate-500 bg-slate-50 border border-slate-100 rounded px-1 py-0.5">{s.name}</span>}
          </span>
        ))}
      </td>
      <td className="px-6 py-5 text-right font-mono relative group/price">
        <div className="flex items-center justify-end gap-2">
          <span className="font-medium text-slate-700">{defSup.currency === 'USD' ? '$' : '￦'}{num(defSup.price)}</span>
          {defSup.history && defSup.history.length > 0 && (
            <div className="relative">
              <History className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-blue-500" />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 text-white text-[11px] rounded-lg p-3 z-50 hidden group-hover/price:block shadow-xl text-left pointer-events-none border border-slate-700">
                <p className="font-bold mb-2 border-b border-slate-600 pb-2 text-slate-300">[{defSup.name}] 단가 히스토리</p>
                {defSup.history.map((h, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="text-slate-400">{h.date}</span>
                    <span className="font-mono text-emerald-400">￦{num(h.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-5 text-right text-slate-500 font-medium">{defSup.tariff || 0}%</td>
      <td className="px-6 py-5 text-right font-bold text-emerald-600">
        {defSup.freight || 0}%
        {defSup.price > 0 && defSup.freight > 0 && <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">({Math.round(convertedPrice * defSup.freight / 100)}원)</div>}
      </td>
      <td className="px-6 py-5 text-right font-mono font-bold text-[15px]">
        {defSup.currency === 'USD' ? (
          <div className="flex flex-col items-end leading-tight gap-0.5">
            <span className="text-blue-700">￦{num(domPrice)}</span>
            <span className="text-[10px] text-slate-500 font-sans tracking-tight bg-slate-100 px-1 rounded">($적용)</span>
          </div>
        ) : <span className="text-blue-700">￦{num(domPrice)}</span>}
      </td>
      <td className="px-6 py-5 text-slate-500 text-xs max-w-[200px] leading-relaxed">
        <div className="line-clamp-2" title={y.remarks}>{y.remarks}</div>
      </td>
      <td className="px-6 py-5 text-center">
        <div className="flex justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleEditYarn(y)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="수정"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => handleDeleteYarn(y.id, (id) => setYarnLibrary(yarnLibrary.filter(item => item.id !== id)))} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return prevProps.y === nextProps.y &&
         prevProps.globalExchangeRate === nextProps.globalExchangeRate &&
         prevProps.yarnLibrary === nextProps.yarnLibrary;
});
