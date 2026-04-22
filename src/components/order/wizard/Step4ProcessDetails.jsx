import React, { useState } from 'react';
import { Settings, Plus, Trash2, ChevronDown, ChevronUp, Package, AlertCircle, Truck } from 'lucide-react';
import { SearchableSelect } from '../../common/SearchableSelect';
import { PROCESS_TYPES, YARN_PROCESSING_TYPES } from '../../../constants/production';
import { sumQty, qtyMatchesPercent } from '../../../utils/orderCalculations';

// -----------------------------------------------------------
// 원사 공정 서브폼
// -----------------------------------------------------------
const YarnSubform = ({ process, yarnLibrary, addYarnOrder, removeYarnOrder, updateYarnOrder, addDelivery, removeDelivery, updateDelivery, orderInput }) => {
  const yarnOptions = (yarnLibrary || []).map(y => ({ id: y.id, name: y.name, category: y.category }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">사종별 발주 + 시간차 분할 입고 관리</p>
        <button
          onClick={addYarnOrder}
          className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700"
        >
          <Plus className="w-3 h-3" /> 원사 발주 추가
        </button>
      </div>

      {(process.yarnOrders || []).length === 0 && (
        <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          등록된 원사 발주가 없습니다.
        </div>
      )}

      {(process.yarnOrders || []).map((yo, idx) => (
        <div key={yo.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">발주 #{idx + 1}</span>
            <button
              onClick={() => removeYarnOrder(yo.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">사종 *</label>
              <SearchableSelect
                value={yo.yarnTypeId || ''}
                options={yarnOptions}
                onChange={(v) => {
                  const found = (yarnLibrary || []).find(y => y.id === v);
                  updateYarnOrder(yo.id, 'yarnTypeId', v);
                  updateYarnOrder(yo.id, 'yarnTypeName', found?.name || '');
                }}
                placeholder="사종 선택..."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                컬러 {orderInput.dyeingMethod === 'yarn_dyed' ? '*' : '(선택)'}
              </label>
              {orderInput.dyeingMethod === 'yarn_dyed' ? (
                <select
                  value={yo.color || ''}
                  onChange={e => updateYarnOrder(yo.id, 'color', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">선택...</option>
                  {(orderInput.colors || []).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={yo.color || ''}
                  disabled
                  placeholder="후염: 컬러 무관"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-400"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">총 발주량 (kg)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={yo.totalQuantity || ''}
                onChange={e => updateYarnOrder(yo.id, 'totalQuantity', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">공급처</label>
              <input
                type="text"
                value={yo.supplier || ''}
                onChange={e => updateYarnOrder(yo.id, 'supplier', e.target.value.toUpperCase())}
                placeholder="예: XINAO"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none uppercase"
              />
            </div>
          </div>

          {/* 입고 차수 (deliveries) */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Truck className="w-3 h-3" /> 입고 차수
              </label>
              <button
                onClick={() => addDelivery(yo.id)}
                className="flex items-center gap-1 bg-white border border-teal-300 text-teal-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-teal-50"
              >
                <Plus className="w-3 h-3" /> 차수 추가
              </button>
            </div>
            {(yo.deliveries || []).length === 0 ? (
              <div className="text-[11px] text-slate-400 text-center py-3 bg-white border border-dashed border-slate-200 rounded">
                입고 차수를 추가하세요.
              </div>
            ) : (
              <div className="space-y-1.5">
                {(yo.deliveries || []).map((dv, dIdx) => (
                  <div key={dv.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded p-2">
                    <span className="text-[11px] font-bold text-slate-600 w-10">{dIdx + 1}차</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dv.quantity || ''}
                      onChange={e => updateDelivery(yo.id, dv.id, 'quantity', e.target.value)}
                      placeholder="수량"
                      className="w-28 border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <span className="text-[11px] text-slate-400">kg</span>
                    <button
                      onClick={() => removeDelivery(yo.id, dv.id)}
                      className="ml-auto p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// -----------------------------------------------------------
// L/D 서브폼 (메타만)
// -----------------------------------------------------------
const LabDipSubform = ({ process, updateProcessField }) => (
  <div className="space-y-3">
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-700">
      L/D는 병렬 트랙으로, 주 납기 계산에서 제외됩니다. 원사+편직 기간 내 완료된다고 가정합니다.
    </div>
    <div>
      <label className="text-xs font-bold text-slate-600 mb-1.5 block">비고</label>
      <textarea
        rows={2}
        value={process.notes || ''}
        onChange={e => updateProcessField(process.processType, 'notes', e.target.value)}
        placeholder="L/D 의뢰 관련 메모"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
      />
    </div>
  </div>
);

// -----------------------------------------------------------
// 사가공 서브폼 (가공 유형 + 차수)
// -----------------------------------------------------------
const YarnProcessingSubform = ({ process, updateProcessField, orderInput, addBatch, removeBatch, updateBatchField }) => {
  const allowedTypes = YARN_PROCESSING_TYPES.filter(t => t.allowedFor.includes(orderInput.dyeingMethod));
  const total = sumQty(process.batches);
  const matches = qtyMatchesPercent(total, orderInput.totalQuantity, 1);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-slate-600 mb-2 block">가공 유형</label>
        <div className="grid grid-cols-3 gap-2">
          {YARN_PROCESSING_TYPES.map(t => {
            const allowed = allowedTypes.some(a => a.key === t.key);
            const selected = process.processingType === t.key;
            return (
              <button
                key={t.key}
                onClick={() => allowed && updateProcessField(process.processType, 'processingType', t.key)}
                disabled={!allowed}
                className={`px-3 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                  selected
                    ? 'bg-teal-600 text-white border-teal-600'
                    : allowed
                      ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                {t.label}
                {!allowed && <span className="block text-[10px] font-normal">선염 전용</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          ※ 후염 오더에서는 <b>사염</b>을 선택할 수 없습니다.
        </p>
      </div>

      {/* 차수 리스트 */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`text-xs font-bold ${matches ? 'text-emerald-600' : 'text-amber-600'}`}>
            차수 수량 합: <span className="font-mono">{total.toLocaleString()}</span> / 총 수량: <span className="font-mono">{Number(orderInput.totalQuantity || 0).toLocaleString()}</span>
          </div>
          <button
            onClick={() => addBatch(process.processType)}
            className="flex items-center gap-1 bg-teal-600 text-white px-2.5 py-1.5 rounded text-[11px] font-bold hover:bg-teal-700"
          >
            <Plus className="w-3 h-3" /> 차수 추가
          </button>
        </div>

        {(process.batches || []).length === 0 && (
          <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded border-2 border-dashed border-slate-200">
            차수를 추가해주세요.
          </div>
        )}

        <div className="space-y-2">
          {(process.batches || []).map((b, idx) => (
            <div key={b.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
              <input
                type="text"
                value={b.batchLabel || ''}
                onChange={e => updateBatchField(process.processType, b.id, 'batchLabel', e.target.value)}
                placeholder={`${idx + 1}차`}
                className="w-20 border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={b.quantity || ''}
                onChange={e => updateBatchField(process.processType, b.id, 'quantity', e.target.value)}
                placeholder="수량"
                className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <span className="text-[11px] text-slate-400">{orderInput.unit}</span>
              <button
                onClick={() => removeBatch(process.processType, b.id)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// 편직 서브폼
// -----------------------------------------------------------
const KnittingSubform = ({ process, addBatch, removeBatch, updateBatchField, updateBatchColors, orderInput }) => {
  const total = sumQty(process.batches);
  const matches = qtyMatchesPercent(total, orderInput.totalQuantity, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-bold ${matches ? 'text-emerald-600' : 'text-amber-600'}`}>
          차수 수량 합: <span className="font-mono">{total.toLocaleString()}</span> / 총 수량: <span className="font-mono">{Number(orderInput.totalQuantity || 0).toLocaleString()}</span>
          {!matches && <span className="ml-2 text-amber-700">(±1% 이내 권장)</span>}
        </div>
        <button
          onClick={() => addBatch(process.processType)}
          className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700"
        >
          <Plus className="w-3 h-3" /> 차수 추가
        </button>
      </div>

      {(process.batches || []).length === 0 && (
        <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          등록된 차수가 없습니다.
        </div>
      )}

      <div className="space-y-2">
        {(process.batches || []).map((b, idx) => (
          <div key={b.id} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">{b.batchLabel || `${idx + 1}차`}</span>
              <button
                onClick={() => removeBatch(process.processType, b.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">차수 라벨</label>
                <input
                  type="text"
                  value={b.batchLabel || ''}
                  onChange={e => updateBatchField(process.processType, b.id, 'batchLabel', e.target.value)}
                  placeholder={`${idx + 1}차`}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">수량 ({orderInput.unit})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.quantity || ''}
                  onChange={e => updateBatchField(process.processType, b.id, 'quantity', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            {/* 편직은 선염일 때만 컬러 지정, 후염은 생지 */}
            {orderInput.dyeingMethod === 'yarn_dyed' && (orderInput.colors || []).length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">포함 컬러 (선염)</label>
                <div className="flex flex-wrap gap-1.5">
                  {(orderInput.colors || []).map(c => {
                    const selected = (b.colors || []).some(bc => bc.color === c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          const currentColors = b.colors || [];
                          const newColors = selected
                            ? currentColors.filter(bc => bc.color !== c.name)
                            : [...currentColors, { color: c.name, quantity: 0 }];
                          updateBatchColors(process.processType, b.id, newColors);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${
                          selected
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">일일 편직량 오버라이드 (kg, 선택)</label>
              <input
                type="number"
                min="0"
                value={b.dailyCapacityOverride ?? ''}
                onChange={e => updateBatchField(process.processType, b.id, 'dailyCapacityOverride', e.target.value)}
                placeholder={`기본값 ${orderInput.defaultDailyKnittingCapacity || '-'}`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// 염가공 서브폼
// -----------------------------------------------------------
const DyeingSubform = ({ process, updateProcessField, orderInput, addBatch, removeBatch, updateBatchField, updateBatchColors }) => {
  const isSample = orderInput.type === 'sample';
  const total = sumQty(process.batches);
  const matches = qtyMatchesPercent(total, orderInput.totalQuantity, 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            염색+가공 일수 (일)
          </label>
          <input
            type="number"
            min="0"
            value={process.processingDays ?? ''}
            onChange={e => updateProcessField(process.processType, 'processingDays', Number(e.target.value) || 0)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            브랜드 컨펌 대기일 (일)
          </label>
          <input
            type="number"
            min="0"
            value={process.brandConfirmBufferDays ?? ''}
            onChange={e => updateProcessField(process.processType, 'brandConfirmBufferDays', Number(e.target.value) || 0)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
          />
          {isSample && (
            <p className="text-[11px] text-slate-500 mt-1">샘플 오더는 보통 0일입니다.</p>
          )}
        </div>
      </div>

      {/* 염가공 차수 (컬러 분배) */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-600">염가공 차수별 컬러 분배</label>
          <button
            onClick={() => addBatch(process.processType)}
            className="flex items-center gap-1 bg-teal-600 text-white px-2.5 py-1.5 rounded text-[11px] font-bold hover:bg-teal-700"
          >
            <Plus className="w-3 h-3" /> 차수 추가
          </button>
        </div>

        <div className={`text-[11px] font-bold mb-2 ${matches ? 'text-emerald-600' : 'text-amber-600'}`}>
          차수 수량 합: <span className="font-mono">{total.toLocaleString()}</span> / 총 수량: <span className="font-mono">{Number(orderInput.totalQuantity || 0).toLocaleString()}</span>
        </div>

        {(process.batches || []).length === 0 && (
          <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded border-2 border-dashed border-slate-200">
            차수를 추가하여 컬러를 분배하세요.
          </div>
        )}

        <div className="space-y-2">
          {(process.batches || []).map((b, idx) => (
            <div key={b.id} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{b.batchLabel || `${idx + 1}차`}</span>
                <button
                  onClick={() => removeBatch(process.processType, b.id)}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={b.batchLabel || ''}
                  onChange={e => updateBatchField(process.processType, b.id, 'batchLabel', e.target.value)}
                  placeholder={`${idx + 1}차`}
                  className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.quantity || ''}
                  onChange={e => updateBatchField(process.processType, b.id, 'quantity', e.target.value)}
                  placeholder="수량"
                  className="border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">포함 컬러</label>
                <div className="flex flex-wrap gap-1.5">
                  {(orderInput.colors || []).map(c => {
                    const selected = (b.colors || []).some(bc => bc.color === c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          const currentColors = b.colors || [];
                          const newColors = selected
                            ? currentColors.filter(bc => bc.color !== c.name)
                            : [...currentColors, { color: c.name, quantity: 0 }];
                          updateBatchColors(process.processType, b.id, newColors);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                          selected ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// 검사류 서브폼 (외관/이화학) — 자동 생성 프리뷰
// -----------------------------------------------------------
const InspectionPreviewSubform = ({ process, orderInput }) => {
  const dyeingProcess = (orderInput.processes || []).find(p => p.processType === 'dyeing' && p.isActive);
  const isVisual = process.processType === 'visual_inspection';

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          {isVisual
            ? '외관검사는 염가공 차수 × 컬러 단위로 자동 생성됩니다.'
            : '이화학검사는 컬러 단위로 자동 생성됩니다.'}
          {' '}실제 차수는 오더 등록 후 공정 상세에서 확인할 수 있습니다.
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
        <p className="text-xs font-bold text-slate-700 mb-2">예상 생성 단위</p>
        {isVisual ? (
          dyeingProcess && (dyeingProcess.batches || []).length > 0 ? (
            <div className="space-y-1">
              {(dyeingProcess.batches || []).map((b, idx) => (
                <div key={b.id} className="text-xs text-slate-600">
                  • {b.batchLabel || `${idx + 1}차`}: {(b.colors || []).map(c => c.color).join(', ') || '컬러 미지정'}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">염가공 차수를 먼저 등록해주세요.</p>
          )
        ) : (
          (orderInput.colors || []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(orderInput.colors || []).map(c => (
                <span key={c.name} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700">
                  {c.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">컬러를 먼저 등록해주세요.</p>
          )
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// 메인 컴포넌트
// -----------------------------------------------------------
export const Step4ProcessDetails = ({
  orderInput,
  updateProcessField,
  addBatch, removeBatch, updateBatchField, updateBatchColors,
  addYarnOrder, removeYarnOrder, updateYarnOrder,
  addDelivery, removeDelivery, updateDelivery,
  yarnLibrary = [],
}) => {
  const [expandedKey, setExpandedKey] = useState(null);

  const activeProcesses = (orderInput.processes || [])
    .filter(p => p.isActive)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Settings className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800">공정별 차수/발주 설정</h3>
      </div>

      {activeProcesses.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          이전 단계에서 활성 공정을 선택해주세요.
        </div>
      ) : (
        <div className="space-y-2">
          {activeProcesses.map(p => {
            const meta = getMeta(p.processType);
            const isOpen = expandedKey === p.processType;
            return (
              <div key={p.processType} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedKey(isOpen ? null : p.processType)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-all ${
                    isOpen ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold text-slate-800">{meta?.label || p.processType}</span>
                    {p.isParallelTrack && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">병렬</span>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                    {p.processType === 'yarn' && (
                      <YarnSubform
                        process={p}
                        yarnLibrary={yarnLibrary}
                        orderInput={orderInput}
                        addYarnOrder={addYarnOrder}
                        removeYarnOrder={removeYarnOrder}
                        updateYarnOrder={updateYarnOrder}
                        addDelivery={addDelivery}
                        removeDelivery={removeDelivery}
                        updateDelivery={updateDelivery}
                      />
                    )}
                    {p.processType === 'yarn_processing' && (
                      <YarnProcessingSubform
                        process={p}
                        updateProcessField={updateProcessField}
                        orderInput={orderInput}
                        addBatch={addBatch}
                        removeBatch={removeBatch}
                        updateBatchField={updateBatchField}
                      />
                    )}
                    {p.processType === 'lab_dip' && (
                      <LabDipSubform process={p} updateProcessField={updateProcessField} />
                    )}
                    {p.processType === 'knitting' && (
                      <KnittingSubform
                        process={p}
                        orderInput={orderInput}
                        addBatch={addBatch}
                        removeBatch={removeBatch}
                        updateBatchField={updateBatchField}
                        updateBatchColors={updateBatchColors}
                      />
                    )}
                    {p.processType === 'dyeing' && (
                      <DyeingSubform
                        process={p}
                        updateProcessField={updateProcessField}
                        orderInput={orderInput}
                        addBatch={addBatch}
                        removeBatch={removeBatch}
                        updateBatchField={updateBatchField}
                        updateBatchColors={updateBatchColors}
                      />
                    )}
                    {(p.processType === 'visual_inspection' || p.processType === 'physical_test') && (
                      <InspectionPreviewSubform process={p} orderInput={orderInput} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
