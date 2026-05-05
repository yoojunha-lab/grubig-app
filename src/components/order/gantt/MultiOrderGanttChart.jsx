import React, { useMemo } from 'react';
import { ORDER_STATUS_COLORS, PROCESS_TYPES, BATCH_STATUS_COLORS, BATCH_STATUSES, getProcessQtyUnit } from '../../../constants/production';
import {
  enrichProcessesWithEffectiveDates,
  addDaysYmd, diffDaysYmd, todayYmd,
  isBatchOverdue,
} from '../../../utils/orderCalculations';
import { DAY_PX, toDate, dayLabel, weekdayLabel, flattenYarnDeliveries } from './utils';

const LABEL_W = 240;

const procLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;
const procSeq   = (key) => PROCESS_TYPES.find(p => p.key === key)?.defaultSequence || 0;
const statusLabel = (key) => BATCH_STATUSES.find(s => s.key === key)?.label || (key || '대기');

// 오더 → enriched processes (활성, sequenceOrder 순). yarn은 deliveries로 평탄화
const getActiveProcesses = (order) => {
  return enrichProcessesWithEffectiveDates(order)
    .filter(p => p.isActive)
    .map(p => p.processType === 'yarn'
      ? { ...p, batches: flattenYarnDeliveries(p) }
      : p
    )
    .filter(p => (p.batches || []).length > 0)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
};

export const MultiOrderGanttChart = ({ orders = [], onOrderClick }) => {
  // 행 구성: 오더별로 묶고, 각 오더 아래 활성 공정들 펼침
  const orderBlocks = useMemo(() => {
    return (orders || [])
      .map(order => ({
        order,
        processes: getActiveProcesses(order),
      }))
      .filter(b => b.processes.length > 0)
      .sort((a, b) => {
        const da = a.order.finalDueDate || '9999';
        const db = b.order.finalDueDate || '9999';
        return da.localeCompare(db);
      });
  }, [orders]);

  // 시간 범위 (모든 오더의 모든 활성 공정 + 차수 + 최종납기)
  const range = useMemo(() => {
    const dates = [];
    orderBlocks.forEach(({ order, processes }) => {
      processes.forEach(p => {
        if (p.effectiveStart) dates.push(p.effectiveStart);
        if (p.effectiveEnd) dates.push(p.effectiveEnd);
        (p.batches || []).forEach(b => {
          if (b.plannedStartDate) dates.push(b.plannedStartDate);
          if (b.plannedEndDate)   dates.push(b.plannedEndDate);
          if (b.actualEndDate)    dates.push(b.actualEndDate);
          if (b.expectedEndDate)  dates.push(b.expectedEndDate);
        });
      });
      if (order.finalDueDate) dates.push(order.finalDueDate);
    });
    if (dates.length === 0) {
      const today = todayYmd();
      return { start: today, end: addDaysYmd(today, 30), totalDays: 30 };
    }
    dates.sort();
    const start = addDaysYmd(dates[0], -3);
    const end   = addDaysYmd(dates[dates.length - 1], 7);
    return { start, end, totalDays: diffDaysYmd(start, end) };
  }, [orderBlocks]);

  if (orderBlocks.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        표시할 차수가 없습니다. 활성 공정에 차수가 등록된 오더만 표시됩니다.
      </div>
    );
  }

  const dateToLeft = (ymd) => (ymd ? diffDaysYmd(range.start, ymd) * DAY_PX : 0);
  const totalWidth = (range.totalDays + 1) * DAY_PX;
  const todayLeft = dateToLeft(todayYmd());

  // 헤더 일자 배열
  const days = [];
  for (let i = 0; i <= range.totalDays; i++) {
    const d = toDate(addDaysYmd(range.start, i));
    if (d) days.push(d);
  }

  // 월 묶음
  const monthGroups = [];
  let curMonth = -1;
  let curStart = 0;
  days.forEach((d, idx) => {
    if (d.getMonth() !== curMonth) {
      if (curMonth >= 0) monthGroups.push({ month: curMonth, year: days[curStart].getFullYear(), startIdx: curStart, count: idx - curStart });
      curMonth = d.getMonth();
      curStart = idx;
    }
    if (idx === days.length - 1) {
      monthGroups.push({ month: curMonth, year: d.getFullYear(), startIdx: curStart, count: idx - curStart + 1 });
    }
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${LABEL_W + totalWidth}px` }}>
          {/* 타임라인 헤더 */}
          <div className="flex border-b-2 border-slate-200 bg-slate-50 sticky top-0 z-20">
            <div
              className="shrink-0 border-r border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center"
              style={{ width: `${LABEL_W}px` }}
            >
              오더 / 공정 ({orderBlocks.length}개 오더)
            </div>
            <div className="relative" style={{ width: `${totalWidth}px` }}>
              <div className="flex border-b border-slate-200 h-6 text-[11px] font-bold text-slate-500">
                {monthGroups.map(mg => (
                  <div
                    key={`mg-${mg.year}-${mg.month}`}
                    className="border-r border-slate-200 px-2 flex items-center"
                    style={{ width: `${mg.count * DAY_PX}px` }}
                  >
                    {mg.year}.{mg.month + 1}
                  </div>
                ))}
              </div>
              <div className="flex h-8 text-[11px]">
                {days.map((d, i) => {
                  const isToday = d.toISOString().slice(0, 10) === todayYmd();
                  const isSat = d.getDay() === 6;
                  const isSun = d.getDay() === 0;
                  const isWeekend = isSat || isSun;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-r border-slate-100 leading-none ${
                        isToday ? 'bg-teal-100 text-teal-700 font-extrabold' :
                        isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-600'
                      }`}
                      style={{ width: `${DAY_PX}px` }}
                    >
                      <span className="font-bold">{dayLabel(d)}</span>
                      <span className={`text-[9px] mt-0.5 ${isWeekend ? '' : 'text-slate-400'}`}>{weekdayLabel(d)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 오더 블록 반복 */}
          {orderBlocks.map(({ order, processes }) => {
            const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
            const statusText =
              order.status === 'active' ? '진행중' :
              order.status === 'delayed_risk' ? '납기위험' :
              order.status === 'on_hold' ? '보류' :
              order.status === 'completed' ? '완료' : '-';
            const finalLeft = order.finalDueDate ? dateToLeft(order.finalDueDate) : null;

            return (
              <React.Fragment key={order.id}>
                {/* 오더 헤더 행 (sticky 하지 않음 — 각 오더 그룹의 구분선) */}
                <div className="flex border-b-2 border-slate-300 bg-slate-100">
                  <button
                    onClick={() => onOrderClick && onOrderClick(order.id)}
                    className="shrink-0 border-r border-slate-200 px-3 py-2 text-left hover:bg-slate-200 transition-colors flex items-center gap-2"
                    style={{ width: `${LABEL_W}px` }}
                  >
                    <span className="font-mono font-extrabold text-xs text-teal-700">{order.orderNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
                      {statusText}
                    </span>
                    <span className="text-[11px] text-slate-700 truncate font-medium">
                      {order.customer || '-'}{order.articleNo ? ` · ${order.articleNo}` : ''}
                    </span>
                  </button>
                  <div className="relative" style={{ width: `${totalWidth}px`, height: '32px' }}>
                    {/* 격자 (헤더 행에도 옅게) */}
                    <div className="absolute inset-0 flex">
                      {days.map((d, i) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={i}
                            className={`border-r border-slate-200/60 ${isWeekend ? 'bg-slate-200/40' : ''}`}
                            style={{ width: `${DAY_PX}px` }}
                          />
                        );
                      })}
                    </div>
                    {/* 최종 납기 마커 */}
                    {finalLeft !== null && finalLeft >= 0 && finalLeft <= totalWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{ left: `${finalLeft}px` }}
                        title={`최종 납기: ${order.finalDueDate}`}
                      >
                        <span className="absolute -top-0.5 left-1 text-[9px] font-bold text-red-600 bg-white/90 px-1 rounded whitespace-nowrap">
                          납기 {order.finalDueDate}
                        </span>
                      </div>
                    )}
                    {/* 오늘 라인 */}
                    {todayLeft >= 0 && todayLeft <= totalWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-teal-500 z-10"
                        style={{ left: `${todayLeft}px` }}
                      />
                    )}
                  </div>
                </div>

                {/* 공정 행 (활성 공정만, 원사 제외) */}
                {processes.map(p => {
                  const batches = p.batches || [];
                  const rowHeight = Math.max(40, batches.length * 22 + 14);
                  return (
                    <div key={`${order.id}-${p.processType}`} className="flex border-b border-slate-100 hover:bg-slate-50/40">
                      <div
                        className="shrink-0 border-r border-slate-200 px-3 py-2 flex items-center gap-2 bg-white"
                        style={{ width: `${LABEL_W}px`, minHeight: `${rowHeight}px` }}
                      >
                        <span className="w-5 h-5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded flex items-center justify-center shrink-0">
                          {procSeq(p.processType)}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{procLabel(p.processType)}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{batches.length}건</span>
                      </div>
                      <div className="relative" style={{ width: `${totalWidth}px`, minHeight: `${rowHeight}px` }}>
                        {/* 격자 */}
                        <div className="absolute inset-0 flex">
                          {days.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                              <div
                                key={i}
                                className={`border-r border-slate-100 ${isWeekend ? 'bg-slate-50/30' : ''}`}
                                style={{ width: `${DAY_PX}px` }}
                              />
                            );
                          })}
                        </div>
                        {/* 오늘 라인 */}
                        {todayLeft >= 0 && todayLeft <= totalWidth && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-teal-500 z-10"
                            style={{ left: `${todayLeft}px` }}
                          />
                        )}
                        {/* 최종 납기 마커 (각 공정 행에도 옅게) */}
                        {finalLeft !== null && finalLeft >= 0 && finalLeft <= totalWidth && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400/60 z-10"
                            style={{ left: `${finalLeft}px` }}
                          />
                        )}
                        {/* 차수 바 (yarn은 deliveries로 평탄화된 것 포함) */}
                        {batches.map((b, bIdx) => {
                          const isYarn = !!b._isYarn;
                          const start = b.actualStartDate || b.plannedStartDate || p.effectiveStart;
                          const end   = b.actualEndDate || b.expectedEndDate || b.plannedEndDate || p.effectiveEnd;
                          if (!start || !end) return null;

                          const left = dateToLeft(start);
                          const width = Math.max(DAY_PX * 0.5, (diffDaysYmd(start, end) + 1) * DAY_PX - 2);
                          const colors = BATCH_STATUS_COLORS[b.status] || BATCH_STATUS_COLORS.pending;
                          const hasActual = !!b.actualEndDate;
                          const overdue = isYarn ? b._overdue : isBatchOverdue(b);
                          const qtyUnit = isYarn ? null : getProcessQtyUnit(p.processType);
                          const qtyLabel = isYarn ? b.quantity : (qtyUnit ? `${b.quantity}${qtyUnit}` : '');
                          const tooltipText = `${order.orderNumber} · ${procLabel(p.processType)} ${b.batchLabel}\n${qtyLabel} · ${statusLabel(b.status)}\n${start} ~ ${end}${b.notes ? '\n' + b.notes.slice(0, 50) : ''}${overdue ? '\n⚠️ 납기 초과' : ''}`;

                          return (
                            <button
                              key={b.id}
                              onClick={() => onOrderClick && onOrderClick(order.id, p.processType, b.id)}
                              title={tooltipText}
                              className={`absolute rounded-md text-[11px] font-bold text-left px-2 truncate ${colors.bg} ${colors.text} border-2 ${overdue ? 'border-red-500 ring-2 ring-red-200' : colors.border} hover:shadow-md hover:z-20 transition-all`}
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                                top: `${8 + bIdx * 22}px`,
                                height: '20px',
                                opacity: hasActual ? 1 : 0.9,
                              }}
                            >
                              {b.batchLabel}{qtyLabel ? ` · ${qtyLabel}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center gap-4 text-[11px] text-slate-600 flex-wrap">
        <div className="font-bold uppercase tracking-wider text-slate-400">차수 상태:</div>
        {BATCH_STATUSES.map(s => {
          const c = BATCH_STATUS_COLORS[s.key];
          return (
            <div key={s.key} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded ${c.dot}`}></span>
              <span>{s.label}</span>
            </div>
          );
        })}
        <div className="border-l border-slate-300 pl-4 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-0.5 h-3 bg-teal-500"></span>
            <span>오늘</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-0.5 h-3 bg-red-500"></span>
            <span>최종 납기</span>
          </div>
        </div>
      </div>
    </div>
  );
};
