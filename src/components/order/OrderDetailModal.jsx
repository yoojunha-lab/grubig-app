import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Package, Calendar, Users, Palette, Truck } from 'lucide-react';
import { PROCESS_TYPES, ORDER_STATUS_COLORS } from '../../constants/production';
import { calcOrderProgress, getOrderHealth, getHealthColorClass } from '../../utils/orderCalculations';

export const OrderDetailModal = ({ order, onClose, yarnLibrary = [] }) => {
  const [expandedProcess, setExpandedProcess] = useState(null);

  if (!order) return null;

  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const health = getOrderHealth(order);
  const healthColors = getHealthColorClass(health);
  const progress = calcOrderProgress(order);

  const activeProcesses = (order.processes || [])
    .filter(p => p.isActive)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);

  const findYarnName = (id) => {
    const y = (yarnLibrary || []).find(y => y.id === id);
    return y?.name || '(사종 미지정)';
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
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-teal-100 mb-1">
              <Package className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{order.orderNumber}</span>
              <span className="text-white/40">•</span>
              <span>{order.type === 'main' ? '메인' : '샘플'}</span>
              <span className="text-white/40">•</span>
              <span>{order.dyeingMethod === 'yarn_dyed' ? '선염' : '후염'}</span>
            </div>
            <h3 className="text-lg font-extrabold">{order.orderName}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">고객</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">{order.customer}</div>
              {order.brand && <div className="text-[11px] text-slate-500">{order.brand}</div>}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">총 수량</div>
              <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                {Number(order.totalQuantity || 0).toLocaleString()} {order.unit}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">상태</div>
              <div className="mt-0.5">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
                  {order.status === 'active' && '진행중'}
                  {order.status === 'completed' && '완료'}
                  {order.status === 'on_hold' && '보류'}
                  {order.status === 'delayed_risk' && '납기위험'}
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

          {/* 납기 3단 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 최종 납기 (고정)
              </div>
              <div className="text-sm font-bold font-mono mt-0.5 text-slate-800">{order.finalDueDate || '-'}</div>
            </div>
            <div className={`rounded-lg p-3 border ${healthColors.bg} ${healthColors.border}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${healthColors.text}`}>
                <Calendar className="w-3 h-3" /> 예상 납기 (계산)
              </div>
              <div className={`text-sm font-bold font-mono mt-0.5 ${healthColors.text}`}>{order.estimatedDueDate || '-'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" /> 담당자
              </div>
              <div className="text-[11px] text-slate-700 mt-0.5 space-y-0.5">
                <div>원사: {order.assignees?.yarnAssignee?.name || '-'}</div>
                <div>편직: {order.assignees?.knittingAssignee?.name || '-'}</div>
                <div>그외: {order.assignees?.othersAssignee?.name || '-'}</div>
              </div>
            </div>
          </div>

          {/* 컬러 */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-slate-600" />
              <div className="text-xs font-bold text-slate-700">컬러 ({(order.colors || []).length}종)</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(order.colors || []).map(c => (
                <span key={c.name} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700">
                  {c.name} <span className="font-mono text-slate-500">{c.quantity}{order.unit}</span>
                </span>
              ))}
            </div>
          </div>

          {/* 공정별 아코디언 */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">활성 공정</h4>
            <div className="space-y-2">
              {activeProcesses.map(p => {
                const meta = getMeta(p.processType);
                const isOpen = expandedProcess === p.processType;
                const totalBatches = p.processType === 'yarn'
                  ? (p.yarnOrders || []).reduce((s, yo) => s + (yo.deliveries || []).length, 0)
                  : (p.batches || []).length;
                return (
                  <div key={p.processType} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <button
                      onClick={() => setExpandedProcess(isOpen ? null : p.processType)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between transition-all ${isOpen ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-teal-100 text-teal-700 text-xs font-bold rounded flex items-center justify-center">
                          {p.sequenceOrder}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{meta?.label}</span>
                        {p.isParallelTrack && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">병렬</span>
                        )}
                        <span className="text-[11px] text-slate-500">차수 {totalBatches}건</span>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        {p.processType === 'yarn' && (
                          <div className="space-y-3">
                            {(p.yarnOrders || []).length === 0 ? (
                              <p className="text-xs text-slate-400">원사 발주 없음</p>
                            ) : (
                              (p.yarnOrders || []).map((yo, idx) => (
                                <div key={yo.id} className="bg-white border border-slate-200 rounded p-3">
                                  <div className="text-xs font-bold text-slate-700 mb-1.5">
                                    발주 #{idx + 1}: {yo.yarnTypeName || findYarnName(yo.yarnTypeId)}
                                    {yo.color ? ` / ${yo.color}` : ''}
                                    <span className="text-slate-500 font-normal ml-2">{yo.totalQuantity}kg @ {yo.supplier || '-'}</span>
                                  </div>
                                  <div className="space-y-1">
                                    {(yo.deliveries || []).map((dv, dIdx) => (
                                      <div key={dv.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                                        <Truck className="w-3 h-3" />
                                        <span className="font-bold">{dIdx + 1}차</span>
                                        <span>{dv.quantity}kg</span>
                                        <span className="text-slate-400">|</span>
                                        <span className="font-mono">{dv.plannedArrivalDate || '-'}</span>
                                        <span className="ml-auto px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{dv.status}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {p.processType === 'yarn_processing' && (
                          <div className="text-xs text-slate-600 space-y-2">
                            <div>가공유형: <b>{p.processingType}</b></div>
                            {(p.batches || []).map(b => (
                              <div key={b.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded p-2">
                                <span className="font-bold">{b.batchLabel}</span>
                                <span>{b.quantity}{order.unit}</span>
                                <span className="text-slate-400 mx-1">|</span>
                                <span className="font-mono text-[11px]">{b.plannedStartDate || '-'} ~ {b.plannedEndDate || '-'}</span>
                                <span className="ml-auto px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{b.status}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {p.processType === 'lab_dip' && (
                          <div className="text-xs text-slate-600">
                            병렬 트랙. {p.notes ? <div className="mt-1">{p.notes}</div> : null}
                          </div>
                        )}

                        {p.processType === 'knitting' && (
                          <div className="space-y-2">
                            {(p.batches || []).map(b => (
                              <div key={b.id} className="bg-white border border-slate-200 rounded p-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{b.batchLabel}</span>
                                  <span>{b.quantity}{order.unit}</span>
                                  <span className="text-slate-400 mx-1">|</span>
                                  <span className="font-mono text-[11px]">{b.plannedStartDate || '-'} ~ {b.plannedEndDate || '-'}</span>
                                  <span className="ml-auto px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{b.status}</span>
                                </div>
                                {(b.colors || []).length > 0 && (
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    컬러: {(b.colors || []).map(c => c.color).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {p.processType === 'dyeing' && (
                          <div className="text-xs text-slate-600 space-y-2">
                            <div>염색+가공 {p.processingDays}일 / 브랜드 컨펌 {p.brandConfirmBufferDays}일</div>
                            {(p.batches || []).map(b => (
                              <div key={b.id} className="bg-white border border-slate-200 rounded p-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{b.batchLabel}</span>
                                  <span>{b.quantity}{order.unit}</span>
                                  <span className="text-slate-400 mx-1">|</span>
                                  <span className="font-mono text-[11px]">{b.plannedStartDate || '-'} ~ {b.plannedEndDate || '-'}</span>
                                  <span className="ml-auto px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{b.status}</span>
                                </div>
                                {(b.colors || []).length > 0 && (
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    컬러: {(b.colors || []).map(c => c.color).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {(p.processType === 'visual_inspection' || p.processType === 'physical_test') && (
                          <div className="text-xs text-slate-500">
                            자동 생성 검사 공정 — 차수는 생산 진행 시 생성됩니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 메타 */}
          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-0.5">
            <div>등록: {order.createdAt ? new Date(order.createdAt).toLocaleString('ko-KR') : '-'} ({order.createdBy || '-'})</div>
            <div>수정: {order.updatedAt ? new Date(order.updatedAt).toLocaleString('ko-KR') : '-'}</div>
            {order.notes && <div className="pt-2 text-slate-600">비고: {order.notes}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
