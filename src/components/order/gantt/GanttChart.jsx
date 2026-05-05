import React, { useMemo } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { PROCESS_TYPES, BATCH_STATUS_COLORS, BATCH_STATUSES, getProcessQtyUnit } from '../../../constants/production';
import {
  enrichProcessesWithEffectiveDates, addDaysYmd, diffDaysYmd, todayYmd,
  isBatchOverdue,
} from '../../../utils/orderCalculations';
import { DAY_PX, WEEKDAY_KO, toDate, dayLabel, weekdayLabel, flattenYarnDeliveries } from './utils';

// 다른 컴포넌트가 GanttChart에서 import 하던 호환용 re-export (점진적 마이그레이션)
export { DAY_PX, WEEKDAY_KO, toDate, dayLabel, weekdayLabel };

// 간트 차트 (Tailwind 자체 구현)
// - 가로축: 일 단위, 자동 범위 (오더 시작 ~ 예상 종료, 좌우 패딩 7일)
// - 세로축: 활성 공정 sequenceOrder 순
// - 각 차수: 가로 바 (effectiveStart ~ effectiveEnd 또는 plannedStart~plannedEnd)
// - 바 색상: status에 따른 BATCH_STATUS_COLORS
// - 호버 툴팁: 차수명/일정/상태


export const GanttChart = ({ order, onBatchClick }) => {
  const enriched = useMemo(() => enrichProcessesWithEffectiveDates(order), [order]);

  // 모든 활성 공정 (yarn 포함). yarn은 batches 대신 flattenYarnDeliveries 사용
  const processes = useMemo(() => {
    return enriched
      .filter(p => p.isActive)
      .map(p => p.processType === 'yarn'
        ? { ...p, batches: flattenYarnDeliveries(p) }
        : p
      )
      .filter(p => (p.batches || []).length > 0 || p.processType !== 'yarn');
  }, [enriched]);

  // 시간 범위 계산 (yarn deliveries 포함)
  const range = useMemo(() => {
    const dates = [];
    enriched.forEach(p => {
      if (p.effectiveStart) dates.push(p.effectiveStart);
      if (p.effectiveEnd) dates.push(p.effectiveEnd);
      if (p.processType === 'yarn') {
        (p.yarnOrders || []).forEach(yo => {
          (yo.deliveries || []).forEach(dv => {
            if (dv.plannedArrivalDate) dates.push(dv.plannedArrivalDate);
            if (dv.actualArrivalDate) dates.push(dv.actualArrivalDate);
          });
        });
      } else {
        (p.batches || []).forEach(b => {
          if (b.plannedStartDate) dates.push(b.plannedStartDate);
          if (b.plannedEndDate)   dates.push(b.plannedEndDate);
          if (b.actualEndDate)    dates.push(b.actualEndDate);
        });
      }
    });
    if (order.finalDueDate) dates.push(order.finalDueDate);

    if (dates.length === 0) {
      const today = todayYmd();
      return { start: today, end: addDaysYmd(today, 30), totalDays: 30 };
    }

    dates.sort();
    const start = addDaysYmd(dates[0], -3);  // 좌측 3일 패딩
    const end   = addDaysYmd(dates[dates.length - 1], 7);  // 우측 7일 패딩
    const totalDays = diffDaysYmd(start, end);
    return { start, end, totalDays };
  }, [enriched, order.finalDueDate]);

  if (processes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        활성 공정이 없습니다. 오더 등록 후 공정을 활성화하면 간트가 표시됩니다.
      </div>
    );
  }

  // 날짜 → 좌측 px 위치
  const dateToLeft = (ymd) => {
    if (!ymd) return 0;
    return diffDaysYmd(range.start, ymd) * DAY_PX;
  };

  // 헤더 일자 배열 생성
  const days = [];
  for (let i = 0; i <= range.totalDays; i++) {
    const d = toDate(addDaysYmd(range.start, i));
    if (d) days.push(d);
  }

  // 월 묶음 (헤더 위쪽에 월 표시용)
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

  const todayLeft = dateToLeft(todayYmd());
  const finalLeft = order.finalDueDate ? dateToLeft(order.finalDueDate) : null;

  const totalWidth = (range.totalDays + 1) * DAY_PX;

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);
  const getStatusLabel = (key) => BATCH_STATUSES.find(s => s.key === key)?.label || (key || '대기');

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 가로 스크롤 영역 */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${200 + totalWidth}px` }}>
          {/* 타임라인 헤더 */}
          <div className="flex border-b-2 border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="w-[200px] shrink-0 border-r border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
              공정 / 차수
            </div>
            <div className="relative" style={{ width: `${totalWidth}px` }}>
              {/* 월 라벨 (위) */}
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
              {/* 일 라벨 (아래) — 일자 + 요일 */}
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

          {/* 공정 행 */}
          {processes.map(p => {
            const meta = getMeta(p.processType);
            const batches = p.batches || [];
            return (
              <div key={p.processType} className="flex border-b border-slate-100 hover:bg-slate-50/30">
                <div className="w-[200px] shrink-0 border-r border-slate-200 px-3 py-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-teal-100 text-teal-700 text-xs font-bold rounded flex items-center justify-center shrink-0">
                    {p.sequenceOrder}
                  </span>
                  <span className="text-sm font-bold text-slate-700">{meta?.label}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{batches.length}건</span>
                </div>
                <div
                  className="relative"
                  style={{
                    width: `${totalWidth}px`,
                    minHeight: `${Math.max(56, batches.length * 22 + 16)}px`,
                  }}
                >
                  {/* 격자 (일 단위 세로선) */}
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
                      title="오늘"
                    />
                  )}

                  {/* 최종 납기 라인 */}
                  {finalLeft !== null && finalLeft >= 0 && finalLeft <= totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                      style={{ left: `${finalLeft}px` }}
                      title="최종 납기"
                    />
                  )}

                  {/* 차수 바 (yarn은 deliveries로 평탄화된 것 포함) */}
                  {batches.map((b, bIdx) => {
                    const isYarn = !!b._isYarn;
                    // 표시 일정 우선순위: 실제(완료) > 예상 > 계획
                    const start = b.actualStartDate || b.plannedStartDate || p.effectiveStart;
                    const end   = b.actualEndDate || b.expectedEndDate || b.plannedEndDate || p.effectiveEnd;
                    if (!start || !end) return null;

                    const left = dateToLeft(start);
                    const width = Math.max(DAY_PX * 0.5, (diffDaysYmd(start, end) + 1) * DAY_PX - 2);
                    const colors = BATCH_STATUS_COLORS[b.status] || BATCH_STATUS_COLORS.pending;

                    const hasActual = !!b.actualEndDate;
                    const overdue = isYarn ? b._overdue : isBatchOverdue(b);
                    // yarn: b.quantity 이미 단위 포함 ("1000kg"), 일반 공정: 단위 동적
                    const qtyUnit = isYarn ? null : getProcessQtyUnit(p.processType);
                    const qtyLabel = isYarn ? b.quantity : (qtyUnit ? `${b.quantity}${qtyUnit}` : '');
                    const tooltipText = `${b.batchLabel} · ${qtyLabel} · ${getStatusLabel(b.status)}\n${start} ~ ${end}${b.notes ? '\n' + b.notes.slice(0, 50) : ''}${overdue ? '\n⚠️ 납기 초과' : ''}`;

                    return (
                      <button
                        key={b.id}
                        onClick={() => onBatchClick && onBatchClick(p.processType, b.id)}
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
        </div>
      </div>

      {/* 범례 */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center gap-4 text-[11px] text-slate-600 flex-wrap">
        <div className="font-bold uppercase tracking-wider text-slate-400">상태:</div>
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
