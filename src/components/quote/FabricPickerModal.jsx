import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Check } from 'lucide-react';
import { num, calculateGYd } from '../../utils/helpers';

// 견적서 '원단 추가'용 팝업 — 검색 후 행별 '추가' 버튼으로 견적에 담는다. (참조양식 기반)
export const FabricPickerModal = ({
  isOpen,
  onClose,
  fabrics = [],
  addedFabricIds = new Set(),
  onAdd,
  calculateCost,
  globalExchangeRate,
  currency = 'KRW'
}) => {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return fabrics;
    return (fabrics || []).filter(f =>
      String(f.article || '').toLowerCase().includes(q) ||
      String(f.itemName || '').toLowerCase().includes(q)
    );
  }, [q, fabrics]);

  if (!isOpen) return null;

  const sym = currency === 'USD' ? '$' : '￦';
  const viewMode = currency === 'USD' ? 'export' : 'domestic';

  // 참고용 영업 기준원가(3k) 계산 — 실패 시 0
  const refPrice = (f) => {
    try {
      const calc = calculateCost(f, globalExchangeRate);
      return calc?.tier3k?.[viewMode]?.priceConverter ?? 0;
    } catch {
      return 0;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-500" /> 원단 선택
          </h3>
          <button onClick={onClose} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" /> 닫기
          </button>
        </div>

        {/* 검색 */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Art/No 또는 원단명으로 검색..."
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-400"
            />
          </div>
        </div>

        {/* 표 */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-3">Art/No</th>
                <th className="p-3">원단명</th>
                <th className="p-3 text-center">폭 (Cut/Full)</th>
                <th className="p-3 text-right">GSM</th>
                <th className="p-3 text-right">g/YD</th>
                <th className="p-3 text-right">기준원가(3k)</th>
                <th className="p-3 text-center w-24">추가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold">검색 결과가 없습니다.</td></tr>
              )}
              {filtered.map((f) => {
                const added = addedFabricIds.has(String(f.id));
                const gYd = Number(f.costGYd) > 0 ? Math.round(Number(f.costGYd)) : calculateGYd(f.gsm, f.widthFull);
                return (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-800 uppercase text-xs">{f.article}</td>
                    <td className="p-3 text-slate-600 text-xs max-w-[220px] truncate">{f.itemName}</td>
                    <td className="p-3 text-center text-slate-500 text-xs">{f.widthCut}/{f.widthFull}"</td>
                    <td className="p-3 text-right text-slate-500 text-xs">{f.gsm}</td>
                    <td className="p-3 text-right text-slate-500 font-mono text-xs">{num(gYd)}</td>
                    <td className="p-3 text-right text-emerald-700 font-mono text-xs font-bold">{sym}{num(refPrice(f), viewMode)}</td>
                    <td className="p-2 text-center">
                      {added ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                          <Check className="w-3.5 h-3.5" /> 추가됨
                        </span>
                      ) : (
                        <button
                          onClick={() => onAdd(f.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2.5 py-1 rounded transition-colors active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" /> 원단추가
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 text-[11px] text-slate-400">
          행의 <span className="font-bold text-rose-500">원단추가</span> 버튼을 눌러 견적에 담으세요. 여러 개 연속으로 추가할 수 있습니다.
        </div>
      </div>
    </div>
  );
};
