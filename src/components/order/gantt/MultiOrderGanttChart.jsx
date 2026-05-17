import React, { useMemo, useRef, useEffect, useState } from 'react';
import { PROCESS_TYPES, BATCH_STATUS_COLORS, BATCH_STATUSES, getProcessQtyUnit } from '../../../constants/production';
import {
  enrichProcessesWithEffectiveDates,
  addDaysYmd, diffDaysYmd, todayYmd,
  isBatchOverdue,
} from '../../../utils/orderCalculations';
import { DAY_PX, toDate, dayLabel, weekdayLabel, flattenYarnDeliveries } from './utils';

const LABEL_W = 180;
const ROW_PAD_Y = 8;       // 행 상단 패딩
const BAR_H = 22;          // 차수 바 높이
const BAR_GAP = 4;         // 레인 간 세로 간격
const MIN_ROW_H = 48;

const procLabel = (key) => PROCESS_TYPES.find(p => p.key === key)?.label || key;
const procSeq   = (key) => PROCESS_TYPES.find(p => p.key === key)?.defaultSequence || 0;
const statusLabel = (key) => BATCH_STATUSES.find(s => s.key === key)?.label || (key || '대기');

// 한 공정 내 차수들의 시간 겹침을 풀어 레인 번호 부여
// items: [{ start, end, ...rest }] → 각 item에 .lane(number) 추가, laneCount 반환
const assignLanes = (items) => {
  const sorted = [...items].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const laneEnds = []; // 각 레인의 마지막 end (yyyy-mm-dd)
  sorted.forEach(item => {
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < item.start) {
        item.lane = i;
        laneEnds[i] = item.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.lane = laneEnds.length;
      laneEnds.push(item.end);
    }
  });
  return { items: sorted, laneCount: laneEnds.length };
};

// 오더 → enriched processes (활성, yarn은 deliveries로 평탄화)
const getActiveProcesses = (order) => {
  return enrichProcessesWithEffectiveDates(order)
    .filter(p => p.isActive)
    .map(p => p.processType === 'yarn'
      ? { ...p, batches: flattenYarnDeliveries(p) }
      : p
    )
    .filter(p => (p.batches || []).length > 0);
};

export const MultiOrderGanttChart = ({ orders = [], onOrderClick }) => {
  // 1. 모든 오더의 모든 차수를 공정별로 그룹핑
  //    processGroups: { [processType]: [{ order, process, batch, start, end }] }
  const { processGroups, range } = useMemo(() => {
    const groups = {};
    const allDates = [];

    (orders || []).forEach(order => {
      const procs = getActiveProcesses(order);
      procs.forEach(p => {
        (p.batches || []).forEach(b => {
          const start = b.actualStartDate || b.plannedStartDate || p.effectiveStart;
          const end   = b.actualEndDate || b.expectedEndDate || b.plannedEndDate || p.effectiveEnd;
          if (!start || !end) return;
          allDates.push(start, end);

          if (!groups[p.processType]) groups[p.processType] = [];
          groups[p.processType].push({ order, process: p, batch: b, start, end });
        });
      });
      if (order.finalDueDate) allDates.push(order.finalDueDate);
    });

    // 시간 범위
    let r;
    if (allDates.length === 0) {
      const today = todayYmd();
      r = { start: today, end: addDaysYmd(today, 30), totalDays: 30 };
    } else {
      allDates.sort();
      const start = addDaysYmd(allDates[0], -3);
      const end   = addDaysYmd(allDates[allDates.length - 1], 7);
      r = { start, end, totalDays: diffDaysYmd(start, end) };
    }

    return { processGroups: groups, range: r };
  }, [orders]);

  // 2. 공정별 레인 할당 + 행 높이 계산 — PROCESS_TYPES 순서 유지
  const processRows = useMemo(() => {
    return PROCESS_TYPES
      .map(meta => {
        const items = processGroups[meta.key] || [];
        if (items.length === 0) return null;
        const { items: laneItems, laneCount } = assignLanes(items);
        const rowHeight = Math.max(MIN_ROW_H, laneCount * (BAR_H + BAR_GAP) + ROW_PAD_Y * 2 - BAR_GAP);
        return { meta, items: laneItems, laneCount, rowHeight };
      })
      .filter(Boolean);
  }, [processGroups]);

  const dateToLeft = (ymd) => (ymd ? diffDaysYmd(range.start, ymd) * DAY_PX : 0);
  const totalWidth = (range.totalDays + 1) * DAY_PX;
  const todayLeft = dateToLeft(todayYmd());

  // 오늘 위치로 자동 가로 스크롤
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = todayLeft >= 0 && todayLeft <= totalWidth
      ? Math.max(0, todayLeft - 60)
      : 0;
    scrollRef.current.scrollLeft = target;
  }, [todayLeft, totalWidth, processRows.length]);

  // 마우스를 따라다니는 툴팁 상태
  const [hover, setHover] = useState(null); // { item, x, y } | null

  if (processRows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        표시할 차수가 없습니다. 활성 공정에 차수가 등록된 오더만 표시됩니다.
      </div>
    );
  }

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

  // 차수 바 1개 → 툴팁 데이터 빌드
  const buildTooltipData = ({ order, process, batch, start, end }) => {
    const isYarn = !!batch._isYarn;
    const qtyUnit = isYarn ? null : getProcessQtyUnit(process.processType);
    const qtyLabel = isYarn ? batch.quantity : (qtyUnit ? `${batch.quantity}${qtyUnit}` : String(batch.quantity || ''));
    const overdue = isYarn ? batch._overdue : isBatchOverdue(batch);

    // 컬러: batch.colors[] 우선, 없으면 order.colors[]
    const batchColors = (batch.colors || []).map(c => c.color).filter(Boolean);
    const orderColors = (order.colors || []).map(c => c.color).filter(Boolean);
    const colorList = batchColors.length > 0 ? batchColors : orderColors;

    return {
      orderNumber: order.orderNumber,
      articleNo: order.articleNo || order.orderName || '-',
      customer: order.customer,
      brand: order.brand,
      processName: procLabel(process.processType),
      batchLabel: batch.batchLabel || `${batch.batchNumber || ''}차`,
      qtyLabel,
      colorList,
      statusLabel: statusLabel(batch.status),
      statusKey: batch.status || 'pending',
      start,
      end,
      finalDueDate: order.finalDueDate,
      overdue,
      notes: batch.notes,
    };
  };

  // 헤더 행 (sticky top): 통계 한 줄
  const orderCount = (orders || []).length;
  const totalBatchCount = processRows.reduce((acc, r) => acc + r.items.length, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ minWidth: `${LABEL_W + totalWidth}px` }}>
          {/* 타임라인 헤더 */}
          <div className="flex border-b-2 border-slate-200 bg-slate-50 sticky top-0 z-30">
            <div
              className="shrink-0 sticky left-0 z-40 bg-slate-50 border-r border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
              style={{ width: `${LABEL_W}px` }}
            >
              공정 / 차수
              <span className="ml-auto text-[10px] text-slate-400 normal-case font-bold">
                {orderCount}오더 · {totalBatchCount}차수
              </span>
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

          {/* 공정 행 (PROCESS_TYPES 순서, 데이터 있는 공정만) */}
          {processRows.map(({ meta, items, rowHeight }) => (
            <div key={meta.key} className="flex border-b border-slate-100 hover:bg-slate-50/30">
              <div
                className="shrink-0 sticky left-0 z-30 bg-white border-r border-slate-200 px-3 py-2 flex items-center gap-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                style={{ width: `${LABEL_W}px`, minHeight: `${rowHeight}px` }}
              >
                <span className="w-6 h-6 bg-teal-100 text-teal-700 text-xs font-bold rounded flex items-center justify-center shrink-0">
                  {procSeq(meta.key)}
                </span>
                <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{items.length}건</span>
              </div>
              <div className="relative" style={{ width: `${totalWidth}px`, minHeight: `${rowHeight}px` }}>
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

                {/* 차수 바 (모든 오더 평면화) */}
                {items.map((item) => {
                  const { order, process, batch, start, end, lane } = item;
                  const left = dateToLeft(start);
                  const width = Math.max(DAY_PX * 0.5, (diffDaysYmd(start, end) + 1) * DAY_PX - 2);
                  const colors = BATCH_STATUS_COLORS[batch.status] || BATCH_STATUS_COLORS.pending;
                  const hasActual = !!batch.actualEndDate;
                  const td = buildTooltipData(item);
                  const barLabel = `${td.orderNumber} · ${td.articleNo}`;

                  return (
                    <button
                      key={`${order.id}-${process.processType}-${batch.id}`}
                      onClick={() => onOrderClick && onOrderClick(order.id, process.processType, batch.id)}
                      onMouseEnter={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHover(null)}
                      className={`absolute rounded-md text-[11px] font-bold text-left px-2 truncate ${colors.bg} ${colors.text} border-2 ${td.overdue ? 'border-red-500 ring-2 ring-red-200' : colors.border} hover:shadow-md hover:z-20 transition-all`}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: `${ROW_PAD_Y + lane * (BAR_H + BAR_GAP)}px`,
                        height: `${BAR_H - 2}px`,
                        opacity: hasActual ? 1 : 0.9,
                      }}
                    >
                      {barLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 마우스 추적 툴팁 (fixed) */}
      {hover && <HoverTooltip data={buildTooltipData(hover.item)} x={hover.x} y={hover.y} />}

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
        </div>
        <div className="ml-auto text-[10px] text-slate-400">막대 위로 마우스를 올리면 바이어·컬러·수량 등 상세 정보가 표시됩니다</div>
      </div>
    </div>
  );
};

// ============================================================
// HoverTooltip — 마우스 좌표를 따라 fixed 포지션으로 표시
// 우측/하단 가장자리 보정 자동
// ============================================================
const TOOLTIP_W = 288;     // w-72
const TOOLTIP_EST_H = 220; // 대략 높이 (컨텐츠 따라 가변)
const HoverTooltip = ({ data: td, x, y }) => {
  // 우측 끝에 가까우면 왼쪽으로 띄움
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = x + 14;
  if (left + TOOLTIP_W > winW - 8) {
    left = x - 14 - TOOLTIP_W;
  }
  // 마우스 위쪽으로 띄우되, 위로 잘리면 아래로
  let top = y - 12 - TOOLTIP_EST_H;
  if (top < 8) top = y + 20;
  if (top + TOOLTIP_EST_H > winH - 8) top = winH - TOOLTIP_EST_H - 8;
  if (left < 8) left = 8;

  return (
    <div
      className="fixed z-[9999] w-72 bg-slate-900 text-white rounded-lg shadow-2xl p-3 pointer-events-none text-left border border-slate-700"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {/* 헤더: 오더번호 · 아티클 */}
      <div className="font-extrabold text-[12px] mb-1.5 text-white flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-teal-300">{td.orderNumber}</span>
        <span className="text-slate-400">·</span>
        <span className="font-mono">{td.articleNo}</span>
        {td.overdue && (
          <span className="ml-auto text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">⚠ 납기초과</span>
        )}
      </div>

      {/* 상세 정보 */}
      <div className="space-y-1 text-[11px]">
        {(td.customer || td.brand) && (
          <div className="flex gap-2">
            <span className="text-slate-400 font-bold w-12 shrink-0">바이어</span>
            <span className="text-slate-100">{td.customer || '-'}{td.brand ? ` / ${td.brand}` : ''}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-slate-400 font-bold w-12 shrink-0">공정</span>
          <span className="text-slate-100">{td.processName} · <span className="font-bold">{td.batchLabel}</span></span>
        </div>
        {td.qtyLabel && (
          <div className="flex gap-2">
            <span className="text-slate-400 font-bold w-12 shrink-0">수량</span>
            <span className="text-slate-100 font-mono">{td.qtyLabel}</span>
          </div>
        )}
        {td.colorList.length > 0 && (
          <div className="flex gap-2">
            <span className="text-slate-400 font-bold w-12 shrink-0">컬러</span>
            <div className="flex flex-wrap gap-1">
              {td.colorList.slice(0, 8).map((c, i) => (
                <span key={i} className="text-[10px] bg-slate-700 text-slate-100 px-1.5 py-0.5 rounded">{c}</span>
              ))}
              {td.colorList.length > 8 && (
                <span className="text-[10px] text-slate-400">+{td.colorList.length - 8}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-slate-400 font-bold w-12 shrink-0">상태</span>
          <span className="text-slate-100">{td.statusLabel}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-400 font-bold w-12 shrink-0">일정</span>
          <span className="text-slate-100 font-mono">{td.start} ~ {td.end}</span>
        </div>
        {td.finalDueDate && (
          <div className="flex gap-2">
            <span className="text-slate-400 font-bold w-12 shrink-0">최종납기</span>
            <span className={`font-mono ${td.overdue ? 'text-red-300 font-bold' : 'text-slate-100'}`}>{td.finalDueDate}</span>
          </div>
        )}
        {td.notes && (
          <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-700">
            <span className="text-slate-400 font-bold w-12 shrink-0">메모</span>
            <span className="text-slate-300 text-[10px] leading-relaxed">{String(td.notes).slice(0, 100)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
