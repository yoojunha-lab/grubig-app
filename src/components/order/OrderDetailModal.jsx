import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, ChevronDown, ChevronUp, Package, Calendar, Palette, Truck,
  Edit2, Settings2, AlertCircle, Plus, Trash2,
  Save, RotateCcw, Play, CheckCircle, Clock,
} from 'lucide-react';
import {
  PROCESS_TYPES, ORDER_STATUSES, ORDER_STATUS_COLORS, START_STAGES,
  BATCH_STATUSES, BATCH_STATUS_COLORS,
} from '../../constants/production';
import {
  calcOrderProgress, getOrderHealth, getHealthColorClass,
  enrichProcessesWithEffectiveDates, analyzeProcessOverruns,
} from '../../utils/orderCalculations';
import { BatchRow, BatchTableHeader } from './editing/BatchRow';
import { DeliveryRow, DeliveryTableHeader } from './editing/DeliveryRow';

// v7: 엑셀 스타일 가로 row 인라인 편집 (BatchInlineEditor 펼침형 폐기)
// - 모든 차수가 항상 표 형태로 펼쳐짐
// - 각 셀(input/select)에서 직접 편집
// - onBlur 시 그 row만 자동 저장 (saveDocToCloud)
// - status 드롭다운 변경 → 즉시 저장 + 자동 날짜 (진행중→실제시작 today, 완료→실제종료 today)
// - 빠른 액션 버튼 폐기 (드롭다운만으로 충분)

// ============================================================
// 원사 발주 1건 — 편집 가능한 카드
// 헤더: 사종명/비율(readonly) + 총수량(input) + 편직처 토글
// 편직처 ON: amber 박스 안내, 발주 표 숨김
// 편직처 OFF: 공급처 input + 입고차수 표 (수량/입고예정/실제입고/상태/삭제) + 추가 버튼
// ============================================================
const YarnOrderCard = ({
  yarnOrder, idx, findYarnName,
  onSaveYarnOrder, onToggleKnitterStock,
  onAddDelivery, onDeleteDelivery, onSaveDelivery,
  focusDeliveryId, highlightTick,
}) => {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(yarnOrder)));
  const [saving, setSaving] = useState(false);

  // 외부 yarnOrder 변경 시 동기화 — 사용자 편집 중이 아닐 때만 (saving 중에도 보호)
  // 키만으로 트리거 (id 변경 시 = 다른 카드). 같은 카드 내 외부 갱신은 onBlur 직후의 onSave 결과로 부모가 새 객체 전달 → 그 시점엔 saving=false
  useEffect(() => {
    if (saving) return;  // 저장 중엔 사용자 입력 보호
    setDraft(JSON.parse(JSON.stringify(yarnOrder)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yarnOrder.id, yarnOrder.updatedAt, (yarnOrder.deliveries || []).length, yarnOrder.useKnitterStock]);

  const update = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const persistField = async (field, value) => {
    if (saving) return;
    if ((yarnOrder[field] ?? '') === (value ?? '')) return;
    setSaving(true);
    try {
      await onSaveYarnOrder({ ...draft, [field]: value });
    } finally {
      setSaving(false);
    }
  };

  const knitter = !!draft.useKnitterStock;
  const cellCls = 'border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div className={`border rounded-lg overflow-hidden ${knitter ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} ${saving ? 'ring-2 ring-amber-200' : ''}`}>
      {/* 헤더 행 */}
      <div className="flex items-center gap-2 flex-wrap p-2 border-b border-slate-100">
        <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
        <span className="text-sm font-bold text-slate-800">
          {draft.yarnTypeName || findYarnName(draft.yarnTypeId)}
          {typeof draft.ratio === 'number' && (
            <span className="text-[11px] text-slate-500 font-normal ml-1">({draft.ratio}%)</span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-500">총수량(kg)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.totalQuantity || ''}
            onChange={e => update('totalQuantity', Number(e.target.value) || 0)}
            onBlur={() => persistField('totalQuantity', draft.totalQuantity)}
            className={`${cellCls} w-24 text-right font-mono font-bold`}
          />
          <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={knitter}
              onChange={e => onToggleKnitterStock(e.target.checked)}
              className="w-3.5 h-3.5 accent-amber-500"
            />
            편직처 보유
          </label>
        </div>
      </div>

      {/* 본문 */}
      {knitter ? (
        <div className="p-2 text-[11px] text-amber-700 font-bold flex items-center gap-1.5">
          <Truck className="w-3 h-3" /> 편직처 보유 원사 사용 — 별도 발주 없음
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {/* 공급처 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 w-16 shrink-0">공급처</label>
            <input
              type="text"
              value={draft.supplier || ''}
              onChange={e => update('supplier', e.target.value)}
              onBlur={() => persistField('supplier', draft.supplier)}
              placeholder="공급처명 입력"
              className={`${cellCls} flex-1`}
            />
          </div>

          {/* 입고차수 표 */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              입고 차수 ({(draft.deliveries || []).length}건)
            </div>
            <button
              onClick={() => onAddDelivery()}
              className="flex items-center gap-1 bg-teal-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-teal-700 shadow-sm"
            >
              <Plus className="w-3 h-3" /> 입고차수 추가
            </button>
          </div>

          {(draft.deliveries || []).length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-2">입고차수 없음</div>
          ) : (
            <div className="border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-xs">
                <DeliveryTableHeader />
                <tbody>
                  {(draft.deliveries || []).map(dv => {
                    const isFocused = focusDeliveryId === dv.id;
                    return (
                      <DeliveryRow
                        key={dv.id}
                        delivery={dv}
                        onSave={(draftDv) => onSaveDelivery(dv.id, draftDv)}
                        onDelete={() => onDeleteDelivery(dv.id)}
                        highlight={isFocused ? highlightTick : 0}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ----------------------------------------------------------------
// 메인 — 오더 상세 모달
// ----------------------------------------------------------------
export const OrderDetailModal = ({
  order, onClose, yarnLibrary = [],
  onEditOrder, onAddBatch, onDeleteBatch, onSaveBatch,
  // 원사 편집 핸들러 (선택적; 없으면 read-only 폴백)
  onSaveYarnOrder, onToggleYarnKnitterStock,
  onAddYarnDelivery, onDeleteYarnDelivery, onSaveYarnDelivery,
  // focusBatch: { processType, batchId } | null
  //   - 진입 시 해당 공정 펼침 + 그 항목으로 스크롤 + 일시 하이라이트
  //   - processType === 'yarn'이면 batchId는 delivery.id로 해석 (yarn 공정엔 batches 없음)
  //   - 명칭은 호환을 위해 focusBatch 유지 (외부 호출 시그니처 변경 없음)
  focusBatch = null,
  // 모든 onSave*/onAdd*/onDelete* 핸들러는 closure로 selectedOrderId 바인딩됨 (App.jsx)
  // 모달은 항상 단일 오더 컨텍스트라 orderId 명시 불필요. 다른 페이지(OrderListPage)에선 4-arg로 전달.
}) => {
  const [expandedProcess, setExpandedProcess] = useState(null);
  // focusBatch 변경 시 일회성 하이라이트 카운터 (같은 차수 재클릭 시도 트리거)
  const [highlightTick, setHighlightTick] = useState(0);

  // ⚠️ 모든 hook은 early return 이전 (Hooks 규칙)
  const enriched = useMemo(() => order ? enrichProcessesWithEffectiveDates(order) : [], [order]);
  const overruns = useMemo(() => order ? analyzeProcessOverruns(order) : [], [order]);

  // focusBatch가 들어오면 해당 공정 자동 펼침 + 하이라이트 트리거
  useEffect(() => {
    if (focusBatch?.processType) {
      setExpandedProcess(focusBatch.processType);
    }
    if (focusBatch?.batchId) {
      setHighlightTick(t => t + 1);
    }
  }, [focusBatch?.processType, focusBatch?.batchId]);

  if (!order) return null;

  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);

  const effMap = Object.fromEntries(enriched.map(p => [p.processType, p]));
  const overrunMap = Object.fromEntries(overruns.map(o => [o.processType, o]));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);
  const findYarnName = (id) => {
    const y = (yarnLibrary || []).find(y => y.id === id);
    return y?.name || '(사종 미지정)';
  };

  const sortedProcesses = (order.processes || []).slice().sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  const activeProcesses = sortedProcesses.filter(p => p.isActive);

  // 차수 status 라벨/색상 매핑 (legacy 데이터 호환)
  const getStatusMeta = (status) => {
    const found = BATCH_STATUSES.find(s => s.key === status);
    if (found) return { label: found.label, colors: BATCH_STATUS_COLORS[found.key] };
    // legacy: '편직중', '대기중' 등 옛 enum
    return { label: status || '대기', colors: BATCH_STATUS_COLORS.pending };
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-teal-100 mb-1 flex-wrap">
              <Package className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{order.orderNumber}</span>
              <span className="text-white/40">•</span>
              <span>{order.type === 'main' ? '메인' : '샘플'}</span>
              {order.startStage && (
                <>
                  <span className="text-white/40">•</span>
                  <span>{START_STAGES.find(s => s.key === order.startStage)?.label || order.startStage}</span>
                </>
              )}
            </div>
            <h3 className="text-lg font-extrabold truncate">{order.articleNo || order.orderName || '-'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEditOrder && (
              <button
                onClick={() => {
                  onEditOrder(order);
                  onClose();
                }}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                title="등록 마법사로 이동: 거래처/시작점/공정 등 구조까지 편집"
              >
                <Settings2 className="w-3.5 h-3.5" /> 전체 편집
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">거래처</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">{order.customer}</div>
              {order.brand && <div className="text-[11px] text-slate-500">{order.brand}</div>}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">수량</div>
              <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                {Number(order.quantityYd ?? order.totalQuantity ?? 0).toLocaleString()} YD
              </div>
              {order.quantityKg > 0 && (
                <div className="text-[11px] text-slate-500 font-mono">
                  ≈ {Number(order.quantityKg).toLocaleString(undefined, { maximumFractionDigits: 2 })} KG
                </div>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">상태</div>
              <div className="mt-1">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
                  {ORDER_STATUSES.find(s => s.key === order.status)?.label || '-'}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">진행률</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-700">{progress}%</span>
              </div>
            </div>
          </div>

          {/* 납기 2단 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 최종 납기
              </div>
              <div className="text-sm font-bold font-mono mt-0.5 text-slate-800">{order.finalDueDate || '-'}</div>
            </div>
            <div className={`rounded-lg p-3 border ${healthColors.bg} ${healthColors.border}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${healthColors.text}`}>
                <Calendar className="w-3 h-3" /> 예상 납기 (자동)
              </div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${healthColors.text}`}>
                {enriched.length > 0 ? (enriched[enriched.length - 1]?.effectiveEnd || '-') : '-'}
              </div>
            </div>
          </div>

          {/* 컬러 */}
          {(order.colors || []).length > 0 && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-4 h-4 text-slate-600" />
                <div className="text-xs font-bold text-slate-700">컬러 ({(order.colors || []).length}종)</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(order.colors || []).map(c => (
                  <span key={c.name} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700">
                    {c.name} <span className="font-mono text-slate-500">{c.quantity}YD</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 비고 */}
          {order.notes && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-bold text-slate-700 mb-1">비고</div>
              <div className="text-xs text-slate-600 whitespace-pre-wrap">{order.notes}</div>
            </div>
          )}

          {/* 공정 아코디언 */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">공정 ({activeProcesses.length}개 활성)</h4>
            <div className="space-y-2">
              {activeProcesses.map(p => {
                const meta = getMeta(p.processType);
                const isOpen = expandedProcess === p.processType;
                const eff = effMap[p.processType];
                const overrun = overrunMap[p.processType];

                const totalBatches = p.processType === 'yarn'
                  ? (p.yarnOrders || []).reduce((s, yo) => s + (yo.deliveries || []).length, 0)
                  : (p.batches || []).length;

                return (
                  <div key={p.processType} className={`border rounded-lg overflow-hidden ${overrun ? 'border-amber-300' : 'border-slate-200'}`}>
                    <button
                      onClick={() => setExpandedProcess(isOpen ? null : p.processType)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between transition-all ${isOpen ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                        <span className="w-6 h-6 bg-teal-100 text-teal-700 text-xs font-bold rounded flex items-center justify-center shrink-0">
                          {p.sequenceOrder}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{meta?.label}</span>
                        <span className="text-[11px] text-slate-500">차수 {totalBatches}건</span>
                        {eff?.effectiveEnd && (
                          <span className="text-[11px] font-mono font-bold text-teal-700">
                            {eff.effectiveStart} ~ {eff.effectiveEnd}
                          </span>
                        )}
                        {overrun && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />{overrun.days}일 초과
                          </span>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {isOpen && (
                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
                        {/* 원사 공정: yarnOrders + deliveries (편집 가능) */}
                        {p.processType === 'yarn' && (
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              사종별 발주 ({(p.yarnOrders || []).length}건) — ART 등록 시 자동 생성됨, 사종 자체 추가/삭제는 불가
                            </div>
                            {(p.yarnOrders || []).length === 0 ? (
                              <div className="text-xs text-slate-400 text-center py-3">
                                원사 발주 없음 — Step1에서 ART(원단)를 선택하면 자동 등록됩니다.
                              </div>
                            ) : (p.yarnOrders || []).map((yo, idx) => {
                              // focusBatch.processType==='yarn'이면 batchId는 delivery.id로 해석.
                              // 이 yo의 deliveries 중에 매칭되는 게 있으면 해당 카드의 DeliveryRow에 highlight 전달
                              const focusDeliveryId = (
                                focusBatch?.processType === 'yarn' &&
                                (yo.deliveries || []).some(dv => dv.id === focusBatch.batchId)
                              ) ? focusBatch.batchId : null;
                              return (
                                <YarnOrderCard
                                  key={yo.id}
                                  yarnOrder={yo}
                                  idx={idx}
                                  findYarnName={findYarnName}
                                  focusDeliveryId={focusDeliveryId}
                                  highlightTick={highlightTick}
                                  onSaveYarnOrder={async (draftYO) => {
                                    if (onSaveYarnOrder) await onSaveYarnOrder(yo.id, draftYO);
                                  }}
                                  onToggleKnitterStock={(value) => {
                                    if (onToggleYarnKnitterStock) onToggleYarnKnitterStock(yo.id, value);
                                  }}
                                  onAddDelivery={() => {
                                    if (onAddYarnDelivery) onAddYarnDelivery(yo.id);
                                  }}
                                  onDeleteDelivery={(dvId) => {
                                    if (onDeleteYarnDelivery) onDeleteYarnDelivery(yo.id, dvId);
                                  }}
                                  onSaveDelivery={async (dvId, draftDv) => {
                                    if (onSaveYarnDelivery) await onSaveYarnDelivery(yo.id, dvId, draftDv);
                                  }}
                                />
                              );
                            })}
                            {(p.yarnOrders || []).length > 0 && (
                              <p className="text-[10px] text-slate-400 px-1">
                                ※ 각 셀에서 입력 후 다른 셀로 이동(또는 Tab)하면 자동 저장됩니다.
                              </p>
                            )}
                          </div>
                        )}

                        {/* 일반 공정: batches 리스트 (각 row에 ✏️/🗑, 헤더에 + 차수 추가) */}
                        {p.processType !== 'yarn' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">차수 ({(p.batches || []).length}건)</div>
                              {onAddBatch && (
                                <button
                                  onClick={() => onAddBatch(p.processType)}
                                  className="flex items-center gap-1 bg-teal-600 text-white px-2.5 py-1 rounded text-[11px] font-bold hover:bg-teal-700 shadow-sm"
                                  title="새 차수 추가 후 바로 편집"
                                >
                                  <Plus className="w-3 h-3" /> 차수 추가
                                </button>
                              )}
                            </div>
                            {(p.batches || []).length === 0 ? (
                              <div className="text-xs text-slate-400 text-center py-3">차수 없음 — 위 [차수 추가] 버튼으로 시작하세요</div>
                            ) : (
                              <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                                <table className="w-full text-xs">
                                  <BatchTableHeader processType={p.processType} hasAnyColors={(order.colors || []).length > 0} />
                                  <tbody>
                                    {(p.batches || []).map(b => {
                                      const isFocused = focusBatch?.processType === p.processType && focusBatch?.batchId === b.id;
                                      return (
                                        <BatchRow
                                          key={b.id}
                                          batch={b}
                                          orderColors={order.colors}
                                          processType={p.processType}
                                          onSave={async (draftBatch) => {
                                            if (onSaveBatch) await onSaveBatch(p.processType, b.id, draftBatch);
                                          }}
                                          onDelete={onDeleteBatch ? () => onDeleteBatch(p.processType, b.id) : null}
                                          highlight={isFocused ? highlightTick : 0}
                                        />
                                      );
                                    })}
                                  </tbody>
                                </table>
                                <p className="text-[10px] text-slate-400 px-2 py-1.5 border-t border-slate-100 bg-slate-50/50">
                                  ※ 각 셀에서 입력 후 다른 셀로 이동(또는 Tab)하면 자동 저장됩니다.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 변경 이력 */}
          <ChangeLogSection changeLog={order.changeLog} />

          {/* 메타 */}
          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-0.5">
            <div>등록: {order.createdAt ? new Date(order.createdAt).toLocaleString('ko-KR') : '-'} ({order.createdBy || '-'})</div>
            <div>수정: {order.updatedAt ? new Date(order.updatedAt).toLocaleString('ko-KR') : '-'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 변경 이력 섹션 (감사 로그)
// ============================================================
const ChangeLogSection = ({ changeLog }) => {
  const [expanded, setExpanded] = useState(false);
  const log = Array.isArray(changeLog) ? changeLog : [];

  if (log.length === 0) {
    return null;
  }

  const visible = expanded ? log : log.slice(0, 5);

  const actionIcon = (action) => {
    if (action === 'order_create') return '📝';
    if (action === 'order_update') return '✏️';
    if (action === 'batch_create') return '➕';
    if (action === 'batch_delete') return '🗑️';
    if (action === 'batch_update') return '🔄';
    return '📌';
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
          📜 변경 이력 <span className="text-slate-400 font-normal">({log.length}건)</span>
        </div>
        {log.length > 5 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-teal-700 hover:text-teal-900 font-bold"
          >
            {expanded ? '접기' : `전체 보기 (${log.length})`}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {visible.map(entry => (
          <div key={entry.id} className="flex items-start gap-2 text-[11px]">
            <span className="shrink-0">{actionIcon(entry.action)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-700 break-words">{entry.summary}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {entry.userEmail || '-'} · {entry.ts ? new Date(entry.ts).toLocaleString('ko-KR') : '-'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
