import React from 'react';
import { Palette, Plus, Trash2, AlertCircle, Check } from 'lucide-react';
import { sumQty, qtyMatches } from '../../../utils/orderCalculations';

export const Step2Colors = ({
  orderInput,
  addColor,
  removeColor,
  updateColor,
}) => {
  const colors = orderInput.colors || [];
  const total = sumQty(colors);
  const match = qtyMatches(total, orderInput.totalQuantity);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-bold text-slate-800">컬러 등록</h3>
        </div>
        <button
          onClick={addColor}
          className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-teal-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> 컬러 추가
        </button>
      </div>

      {/* 안내 배너 */}
      <div className={`rounded-lg border px-4 py-3 ${
        orderInput.dyeingMethod === 'yarn_dyed'
          ? 'bg-violet-50 border-violet-200 text-violet-700'
          : 'bg-blue-50 border-blue-200 text-blue-700'
      }`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            {orderInput.dyeingMethod === 'yarn_dyed'
              ? '선염 오더: 원사부터 컬러 관리가 시작됩니다. 등록한 컬러는 원사/편직/검사 공정에 모두 반영됩니다.'
              : '후염 오더: 염가공부터 컬러 관리가 시작됩니다. 편직은 단색 생지로 진행됩니다.'
            }
          </div>
        </div>
      </div>

      {/* 총 수량 요약 */}
      <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
        match ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {match ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
          <span className={`text-xs font-bold ${match ? 'text-emerald-700' : 'text-amber-700'}`}>
            컬러 수량 합: <span className="font-mono">{total.toLocaleString()}</span> / 총 수량: <span className="font-mono">{Number(orderInput.totalQuantity || 0).toLocaleString()}</span> {orderInput.unit}
          </span>
        </div>
        {!match && (
          <span className="text-xs text-amber-700 font-bold">
            차이: {(Number(orderInput.totalQuantity || 0) - total).toLocaleString()}
          </span>
        )}
      </div>

      {/* 컬러 리스트 */}
      {colors.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
          <Palette className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-3">등록된 컬러가 없습니다.</p>
          <button
            onClick={addColor}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-teal-700"
          >
            <Plus className="w-3.5 h-3.5" /> 첫 컬러 추가
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {colors.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
              <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </span>
              <input
                type="text"
                value={c.name || ''}
                onChange={e => updateColor(idx, 'name', e.target.value)}
                placeholder="컬러명 (예: NAVY)"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none uppercase"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={c.quantity || ''}
                onChange={e => updateColor(idx, 'quantity', e.target.value)}
                placeholder="수량"
                className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono text-right"
              />
              <span className="text-xs text-slate-500 font-bold w-8">{orderInput.unit}</span>
              <button
                onClick={() => removeColor(idx)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="컬러 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
