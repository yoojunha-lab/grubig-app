import React, { useState } from 'react';
import { Plus, Package, Calendar, Scale, FileSpreadsheet, Link2, Unlink, Settings2 } from 'lucide-react';
import { SearchableSelect } from '../../common/SearchableSelect';
import { PartnerSelectField } from '../../common/PartnerSelectField';
import { OrderTypeModal } from '../modals/OrderTypeModal';
import { ORDER_TYPES, START_STAGES } from '../../../constants/production';

export const Step1BasicInfo = ({
  orderInput,
  editingOrderId,
  handleOrderChange,
  setOrderType,
  savedFabrics = [],
  onApplyFabric,
  onDetachFabric,
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
}) => {
  const [orderTypeModalOpen, setOrderTypeModalOpen] = useState(false);

  const fabricOptions = (savedFabrics || []).map(f => ({
    id: f.id,
    name: `${f.article || ''}${f.itemName ? ` — ${f.itemName}` : ''}`.trim() || '(이름없음)',
  }));

  const isLinked = !!orderInput.linkedFabricId;
  const typeLabel = ORDER_TYPES.find(t => t.key === orderInput.type)?.label || '-';
  const stageLabel = START_STAGES.find(s => s.key === orderInput.startStage)?.label || '-';

  return (
    <div className="space-y-5">
      {/* 오더 타입 카드 (모달 트리거) */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">
          오더 타입 <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => setOrderTypeModalOpen(true)}
          className="w-full flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl hover:border-teal-400 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow">
              <Package className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-extrabold text-slate-800">
                {typeLabel} × {stageLabel}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                클릭해서 변경
              </div>
            </div>
          </div>
          <Settings2 className="w-4 h-4 text-teal-600" />
        </button>
      </div>

      {/* 거래처 + 오더(자체번호) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            거래처 <span className="text-red-500">*</span>
          </label>
          <PartnerSelectField
            value={orderInput.customer || ''}
            onSelect={(p) => handleOrderChange('customer', p.name)}
            partners={partners}
            savePartner={savePartner}
            deletePartner={deletePartner}
            makeEmptyPartner={makeEmptyPartner}
            placeholder="거래처 선택 / 등록"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            오더 (자체번호) <span className="text-red-500">*</span>
            {editingOrderId && <span className="ml-1 text-amber-600 text-[11px]">(수정 모드: 변경 불가)</span>}
          </label>
          <input
            type="text"
            value={orderInput.orderNumber || ''}
            onChange={e => handleOrderChange('orderNumber', e.target.value.toUpperCase())}
            placeholder="예: O-001"
            disabled={!!editingOrderId}
            className={`w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none uppercase font-mono ${
              editingOrderId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
            }`}
          />
        </div>
      </div>

      {/* ART (원단 라이브러리에서 선택) */}
      {isLinked ? (
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link2 className="w-5 h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-teal-100 uppercase tracking-wider">ART (연결된 원단)</div>
                <div className="text-sm font-extrabold truncate">{orderInput.articleNo || orderInput.linkedFabricArticle || '(품번 없음)'}</div>
                <div className="text-[11px] text-teal-100 mt-0.5">
                  GSM {orderInput.gsm || '-'} · 폭 {orderInput.widthFull || '-'} · 원사 발주 사종/수량 잠김
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onDetachFabric}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
            >
              <Unlink className="w-3.5 h-3.5" /> 해제
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <label className="text-xs font-bold text-slate-600">
              ART <span className="text-red-500">*</span> <span className="text-slate-400">(원단 라이브러리에서 선택)</span>
            </label>
          </div>
          <SearchableSelect
            value=""
            options={fabricOptions}
            onChange={(fabricId) => {
              if (!fabricId) return;
              onApplyFabric && onApplyFabric(fabricId);
            }}
            placeholder="원단 검색·선택..."
          />
          <p className="text-[11px] text-slate-500 mt-1">
            ART는 원단 라이브러리에 등록된 원단만 선택 가능합니다. 선택 시 GSM/폭이 자동 채워지고 원사 발주가 비율 × 수량으로 자동 생성됩니다.
          </p>
        </div>
      )}

      {/* 최종 납기일 */}
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

      {/* 수량 (YD 입력 + KG 자동) */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">
          <Scale className="w-3 h-3 inline mr-1" />
          수량 (YD) <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-[2fr_1fr] gap-2 items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={orderInput.quantityYd || ''}
            onChange={e => handleOrderChange('quantityYd', Number(e.target.value) || 0)}
            placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono text-right"
          />
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600 font-mono text-right">
            ≈ {Number(orderInput.quantityKg || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} KG
          </div>
        </div>
        {!isLinked && (orderInput.quantityKg === 0 || !orderInput.gsm) && (
          <p className="text-[11px] text-amber-600 mt-1">
            ※ KG 환산을 위해서는 ART(원단)을 선택하거나 GSM/폭을 직접 입력해주세요.
          </p>
        )}
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

      {/* 오더 타입 모달 */}
      <OrderTypeModal
        isOpen={orderTypeModalOpen}
        onClose={() => setOrderTypeModalOpen(false)}
        currentType={orderInput.type}
        currentStartStage={orderInput.startStage}
        onSelect={(type, stage) => setOrderType(type, stage)}
      />
    </div>
  );
};
