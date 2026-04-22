import React from 'react';
import { CalendarDays, AlertCircle } from 'lucide-react';
import { PROCESS_TYPES } from '../../../constants/production';
import { diffDaysYmd, checkSequenceConflicts } from '../../../utils/orderCalculations';

export const Step5Schedule = ({
  orderInput,
  updateBatchField,
  updateDelivery,
}) => {
  const activeProcesses = (orderInput.processes || [])
    .filter(p => p.isActive)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);

  // 공정 간 시퀀스 경고 체크
  const conflicts = checkSequenceConflicts(orderInput);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <CalendarDays className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800">공정별 계획 일자 입력</h3>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>각 공정의 차수/입고에 <b>계획 시작일</b>과 <b>계획 종료일</b>을 입력하세요. 달력 기준(Working Day 아님)이며, L/D는 병렬 트랙이므로 입력하지 않아도 됩니다.</div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
          <div className="flex items-center gap-1 font-bold"><AlertCircle className="w-4 h-4" /> 공정 간 일정 역전 경고</div>
          {conflicts.map((c, idx) => (
            <div key={idx}>
              • <b>{getMeta(c.prev)?.label}</b> 종료({c.prevEnd}) → <b>{getMeta(c.next)?.label}</b> 시작({c.nextStart}) : {c.delta}일 겹침
            </div>
          ))}
          <div className="text-[11px] text-amber-600">※ 경고만 표시되며 진행은 가능합니다. 필요 시 일정을 조정하세요.</div>
        </div>
      )}

      {activeProcesses.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          활성 공정이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {activeProcesses.map(p => {
            const meta = getMeta(p.processType);

            if (p.processType === 'lab_dip') {
              return (
                <div key={p.processType} className="border border-slate-200 rounded-xl bg-white p-4">
                  <div className="text-sm font-bold text-slate-700 mb-2">{meta?.label}</div>
                  <p className="text-xs text-slate-500">L/D는 병렬 트랙입니다. 일정 입력이 필요 없습니다.</p>
                </div>
              );
            }

            if (p.processType === 'dyeing') {
              return (
                <div key={p.processType} className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-700">{meta?.label}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div>염색+가공: {p.processingDays}일</div>
                    <div>브랜드 컨펌: {p.brandConfirmBufferDays}일</div>
                    <div>총 소요: {Number(p.processingDays || 0) + Number(p.brandConfirmBufferDays || 0)}일</div>
                  </div>
                  {/* 염가공도 차수별 시작/종료 입력 */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    {(p.batches || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center">Step4에서 차수를 등록해주세요.</p>
                    ) : (
                      (p.batches || []).map(b => (
                        <div key={b.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50/50 p-2 rounded">
                          <div className="text-xs font-bold text-slate-700">{b.batchLabel} ({b.quantity}{orderInput.unit})</div>
                          <input
                            type="date"
                            value={b.plannedStartDate || ''}
                            onChange={e => updateBatchField(p.processType, b.id, 'plannedStartDate', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                          />
                          <input
                            type="date"
                            value={b.plannedEndDate || ''}
                            onChange={e => updateBatchField(p.processType, b.id, 'plannedEndDate', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                          />
                          <div className="text-[11px] text-slate-500 text-right">
                            {b.plannedStartDate && b.plannedEndDate ? `${diffDaysYmd(b.plannedStartDate, b.plannedEndDate)}일` : '-'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }

            if (p.processType === 'yarn') {
              return (
                <div key={p.processType} className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-700">{meta?.label} (입고 차수별 계획일)</div>
                  {(p.yarnOrders || []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">원사 발주가 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {(p.yarnOrders || []).map((yo, yIdx) => (
                        <div key={yo.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                          <div className="text-xs font-bold text-slate-700 mb-2">발주 #{yIdx + 1}: {yo.yarnTypeName || '사종 미지정'}{yo.color ? ` / ${yo.color}` : ''}</div>
                          {(yo.deliveries || []).length === 0 ? (
                            <p className="text-[11px] text-slate-400">입고 차수가 없습니다.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(yo.deliveries || []).map((dv, dIdx) => (
                                <div key={dv.id} className="grid grid-cols-3 gap-2 items-center">
                                  <div className="text-[11px] font-bold text-slate-600">{dIdx + 1}차 ({dv.quantity}kg)</div>
                                  <input
                                    type="date"
                                    value={dv.plannedArrivalDate || ''}
                                    onChange={e => updateDelivery(yo.id, dv.id, 'plannedArrivalDate', e.target.value)}
                                    className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                                  />
                                  <div className="text-[11px] text-slate-500 text-right">계획 입고일</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // 일반 차수형 공정 (사가공, 편직, 외관, 이화학)
            return (
              <div key={p.processType} className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
                <div className="text-sm font-bold text-slate-700">{meta?.label}</div>
                <div className="space-y-2">
                  {(p.batches || []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center">
                      {p.processType === 'visual_inspection' || p.processType === 'physical_test'
                        ? '외관/이화학 검사는 Step4에서 자동 생성됩니다.'
                        : 'Step4에서 차수를 등록해주세요.'}
                    </p>
                  ) : (
                    (p.batches || []).map(b => (
                      <div key={b.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50/50 p-2 rounded">
                        <div className="text-xs font-bold text-slate-700">{b.batchLabel} ({b.quantity}{orderInput.unit})</div>
                        <input
                          type="date"
                          value={b.plannedStartDate || ''}
                          onChange={e => updateBatchField(p.processType, b.id, 'plannedStartDate', e.target.value)}
                          className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                        <input
                          type="date"
                          value={b.plannedEndDate || ''}
                          onChange={e => updateBatchField(p.processType, b.id, 'plannedEndDate', e.target.value)}
                          className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                        <div className="text-[11px] text-slate-500 text-right">
                          {b.plannedStartDate && b.plannedEndDate ? `${diffDaysYmd(b.plannedStartDate, b.plannedEndDate)}일` : '-'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
