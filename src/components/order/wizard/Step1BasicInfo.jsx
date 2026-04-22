import React from 'react';
import { Users, Plus, Package, Calendar, Scale, FileSpreadsheet } from 'lucide-react';
import { SearchableSelect } from '../../common/SearchableSelect';
import { ORDER_TYPES, DYEING_METHODS, UNITS } from '../../../constants/production';

export const Step1BasicInfo = ({
  orderInput,
  handleOrderChange,
  handleTypeOrMethodChange,
  handleUseKnitterStockYarn,
  buyers = [],
  setIsBuyerModalOpen,
  savedFabrics = [],
  onApplyFabric,
}) => {
  const buyerOptions = (buyers || []).map(b => ({ id: b, name: b }));
  const fabricOptions = (savedFabrics || []).map(f => ({
    id: f.id,
    name: `${f.article || ''}${f.itemName ? ` — ${f.itemName}` : ''}`.trim() || '(이름없음)',
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Package className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800">기본 정보 입력</h3>
      </div>

      {/* 기존 원단 불러오기 */}
      {onApplyFabric && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <label className="text-xs font-bold text-teal-800">기존 원단 불러오기 (선택)</label>
          </div>
          <SearchableSelect
            value=""
            options={fabricOptions}
            onChange={(fabricId) => {
              if (!fabricId) return;
              onApplyFabric(fabricId);
            }}
            placeholder="원단을 선택하면 원사 구성이 자동으로 채워집니다..."
          />
          <p className="text-[11px] text-teal-700 mt-1.5">
            ※ 원단 선택 시 <b>원사 발주 리스트</b>가 비율 × 총 수량으로 자동 계산됩니다. 총 수량을 먼저 입력한 뒤 원단을 선택하면 정확합니다.
          </p>
        </div>
      )}

      {/* 오더명 */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">
          오더명 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={orderInput.orderName || ''}
          onChange={e => handleOrderChange('orderName', e.target.value)}
          placeholder="예: 2026 SS 메인 COTTON JERSEY 오더"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
        />
      </div>

      {/* 고객/브랜드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-600">
              고객사 (바이어) <span className="text-red-500">*</span>
            </label>
            {setIsBuyerModalOpen && (
              <button
                type="button"
                onClick={() => setIsBuyerModalOpen(true)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-bold"
              >
                <Plus className="w-3 h-3" /> 바이어 등록
              </button>
            )}
          </div>
          <SearchableSelect
            value={orderInput.customer || ''}
            options={buyerOptions}
            onChange={(v) => handleOrderChange('customer', v)}
            placeholder="바이어 선택..."
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">브랜드</label>
          <input
            type="text"
            value={orderInput.brand || ''}
            onChange={e => handleOrderChange('brand', e.target.value.toUpperCase())}
            placeholder="예: ZARA"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none uppercase"
          />
        </div>
      </div>

      {/* 타입 & 염색방식 (라디오) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">오더 타입 <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => handleTypeOrMethodChange('type', t.key)}
                className={`px-3 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                  orderInput.type === t.key
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">염색 방식 <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {DYEING_METHODS.map(m => (
              <button
                key={m.key}
                onClick={() => handleTypeOrMethodChange('dyeingMethod', m.key)}
                className={`px-3 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                  orderInput.dyeingMethod === m.key
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {orderInput.dyeingMethod === 'yarn_dyed' && (
            <p className="text-[11px] text-amber-600 font-medium mt-1.5">
              ⚠️ 선염 오더: 편직처 보유 원사 사용 불가, 원사부터 컬러 관리 시작
            </p>
          )}
        </div>
      </div>

      {/* 총 수량 + 단위 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            <Scale className="w-3 h-3 inline mr-1" />
            총 수량 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={orderInput.totalQuantity || ''}
            onChange={e => handleOrderChange('totalQuantity', Number(e.target.value) || 0)}
            placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono text-right"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">단위</label>
          <div className="grid grid-cols-2 gap-2">
            {UNITS.map(u => (
              <button
                key={u.key}
                onClick={() => handleOrderChange('unit', u.key)}
                className={`px-3 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                  orderInput.unit === u.key
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 최종 납기일 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            <Calendar className="w-3 h-3 inline mr-1" />
            최종 납기일 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={orderInput.finalDueDate || ''}
            onChange={e => handleOrderChange('finalDueDate', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">기본 일일 편직량 (kg)</label>
          <input
            type="number"
            min="0"
            value={orderInput.defaultDailyKnittingCapacity || ''}
            onChange={e => handleOrderChange('defaultDailyKnittingCapacity', Number(e.target.value) || 0)}
            placeholder="예: 100"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono text-right"
          />
        </div>
      </div>

      {/* 편직처 보유 원사 체크 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!orderInput.useKnitterStockYarn}
            onChange={e => handleUseKnitterStockYarn(e.target.checked)}
            disabled={orderInput.dyeingMethod === 'yarn_dyed'}
            className="mt-1 w-4 h-4 accent-teal-600 disabled:opacity-40"
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-800">편직처 보유 원사 사용</div>
            <div className="text-xs text-slate-500 mt-0.5">
              편직처에 이미 보유 중인 원사를 사용하는 경우. 체크 시 원사 공정은 체크박스로만 남고 발주 관리는 생략됩니다.
            </div>
            {orderInput.dyeingMethod === 'yarn_dyed' && (
              <div className="text-[11px] text-amber-600 font-medium mt-1.5">
                ※ 선염 오더에서는 이 옵션을 사용할 수 없습니다.
              </div>
            )}
          </div>
        </label>
      </div>

      {/* 비고 */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">비고</label>
        <textarea
          rows={2}
          value={orderInput.notes || ''}
          onChange={e => handleOrderChange('notes', e.target.value)}
          placeholder="추가 메모 (선택)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
        />
      </div>
    </div>
  );
};
