import { AlertTriangle, BadgeCheck, CalendarPlus, Droplets, FileCheck2, Layers, PackageOpen, ScanSearch, StickyNote, Truck } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { INSPECTION_STATUSES, PROCESS_THEME, YARN_DYEING_KEY, findStatusMeta, withSubSteps } from '../../../constants/production';
import {
  getStepEnd, getLotOverview, getGreigeStateFor, isPieceDyed, getLotCurrentRound, getRoundStatus, getLotRounds,
  getYarnState, getYarnOrderStatus, getYarnOrderStatusDate, canUseYarnDyeing,
  isStepSkippedByStock, isConfirmSkipped, isInspectionSkipped,
} from '../../../utils/orderModel';
import { shortDate } from '../../../utils/orderCalculations';
import { fmtDayLabel } from './ganttLayout';

// ============================================================
// 간트 날짜 칸 메뉴 — 빈 날짜를 누르면 그 날에 공정 넣기 (대표님 요청 2026-10-14 '메모 대신 공정을 넣을 수 있게')
// ------------------------------------------------------------
// - 오더 줄: 원사(사종 · 재고 사용 — 원사 창) + 공정(원사염색(선염) · 사가공 · 편직 · 후가공 · 이화학 · 추가 공정) + 프리세팅 + (후염) 생지 출고
//   · 일정이 없는 공정 → [여기서 시작] (그 날 = 예상 시작일)
//   · 일정이 있는 공정 → [시작일로] [종료일로] (그 날로 옮기기)
// - 컬러 줄: (선염) 생지 출고 · 새 염가공 LOT(그 날 투입) · 외관검사(LOT마다 지금 차수 — 시작일로/종료일로) ·
//   브랜드 컨펌 전달 · 시험성적서 발행 예상일 · 출고일
// - 고르면 그 날짜가 들어간 입력 창이 열림 → [저장]해야 반영 (현황표와 같은 값 — 같은 저장 함수)
// - 앞 공정보다 빠른 날이면 노란 안내 (막지는 않음)
// - 맨 아래 '이 날 메모' (예전 날짜 메모 — 대표님 결정: 메뉴 맨 아래로)
// - 진행 안 함 (대표님 요청 2026-10-19): 편직 재고 사용이면 편직 · 사가공 · 원사염색 없음 / 컨펌 · 외관검사 '안 함'이면 그 항목 없음
// props: order, color(null = 오더 줄), date, stepDefs, anchorRect, onPick(kind, extra), onClose, canOpenLots, hasNote
// ============================================================

const ITEM = 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-slate-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const MINI = 'shrink-0 px-1.5 py-0.5 rounded-md border border-teal-200 bg-white text-[10px] font-bold text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const SECTION = 'px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold text-slate-400';

const Warn = ({ children }) => (
  <div className="flex items-start gap-1 px-2.5 pb-1 -mt-0.5 text-[10px] font-bold text-amber-600 leading-snug">
    <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
    <span>{children}</span>
  </div>
);

const maxDate = (list) => list.filter(Boolean).sort().pop() || '';

// 원사 입고 (원사염색 전) — 재고 사용이면 없음, 아니면 중지 뺀 사종의 입고한 날 · 입고 예정일 중 가장 늦은 날
const yarnArrivalEnd = (o) => {
  const y = getYarnState(o);
  if (y.stock) return '';
  return maxDate(y.active.map(r => (getYarnOrderStatus(r) === 'arrived' ? getYarnOrderStatusDate(r) : r.expectedDate)));
};

// 앞 공정들 중 가장 늦은 예상 종료 { date, label } — 공정 순서: 원사 입고 · 원사염색 · 사가공 · 편직 · 프리세팅 · (염가공 LOT) · 후가공 · 이화학 · 추가 공정
const predecessorOf = (order, key, seq) => {
  let best = { date: '', label: '' };
  for (const item of seq) {
    if (item.key === key) break;
    const d = item.end(order);
    if (d && d > best.date) best = { date: d, label: item.label };
  }
  return best.date ? best : null;
};

export const GanttDateMenu = ({
  order, color = null, date, stepDefs = [], anchorRect, onPick, onClose, canOpenLots = true, hasNote = false,
}) => {
  if (!order || !date) return null;
  const piece = isPieceDyed(order);
  const title = `${order.orderNumber || '새 오더'}${color ? ` · ${color.name || '컬러'}` : ' · 오더 전체'} · ${fmtDayLabel(date)}`;

  // 공정 흐름 (앞 공정 비교용) — 원사 입고가 맨 앞, 원사염색(선염 오더만)은 그 다음, 프리세팅은 편직 다음,
  //  염가공 LOT 는 후가공(또는 염가공 다음에 둔 추가 공정) 앞
  const metas = withSubSteps(stepDefs)
    .filter(m => m.key !== YARN_DYEING_KEY || canUseYarnDyeing(order))
    .filter(m => !isStepSkippedByStock(order, m.key)); // 편직 재고 사용(생지 재고)이면 편직 · 사가공 · 원사염색 없음
  const skipConfirm = isConfirmSkipped(order);
  const skipInspection = isInspectionSkipped(order);
  const lotsEnd = (o) => maxDate((o.colors || []).map(c => getLotOverview(c.lots || []).end));
  const lotsItem = { key: '#lots', label: '염가공 LOT', end: lotsEnd };
  const dyeAt = metas.findIndex(m => m.key === 'finishing' || m.after === '#dyeing');
  const seq = [{ key: '#yarn', label: '원사 입고', end: yarnArrivalEnd }];
  metas.forEach((meta, i) => {
    if (i === dyeAt) seq.push(lotsItem);
    seq.push({ key: meta.key, label: meta.label, meta, end: (o) => getStepEnd(o, meta.key) });
  });
  if (dyeAt === -1) seq.push(lotsItem);

  const processItems = seq.filter(s => s.meta).map(s => {
    const step = order.steps?.[s.key] || {};
    const has = !!(step.startDate || step.endDate);
    const prev = predecessorOf(order, s.key, seq);
    return { meta: s.meta, key: s.key, step, has, early: prev && date < prev.date ? prev : null };
  });

  // ---------- 컬러 줄 ----------
  const lots = color?.lots || [];
  const greige = color ? getGreigeStateFor(order, color) : null;

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={300}
      title={title}
      subtitle="이 날에 넣기 — 고르면 입력 창이 열려요 ([저장]해야 반영)"
      onClose={onClose}
    >
      <div className="p-1.5 space-y-0.5 outline-none max-h-[70vh] overflow-y-auto" tabIndex={-1} data-autofocus>
        {!color ? (
          <>
            <button type="button" onClick={() => onPick('yarn')} className={ITEM}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.yarn.dot}`} />
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              원사 (사종 · 재고 사용)
            </button>
            <div className={SECTION}>공정 일정</div>
            {processItems.map(({ meta, key, step, has, early }) => {
              const theme = PROCESS_THEME[key] || PROCESS_THEME.custom;
              return (
                <div key={key}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot} ${has ? '' : 'opacity-40'}`} />
                    <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-700" title={has ? `예상 ${shortDate(step.startDate) || '?'}~${shortDate(step.endDate) || '?'}` : undefined}>
                      {meta?.label || key}
                      {has && <span className="ml-1 font-mono text-[10px] font-normal text-slate-400">{shortDate(step.startDate) || '?'}~{shortDate(step.endDate) || '?'}</span>}
                    </span>
                    {has ? (
                      <>
                        <button type="button" className={MINI} onClick={() => onPick('process', { stepKey: key, field: 'startDate' })}>시작일로</button>
                        <button type="button" className={MINI} onClick={() => onPick('process', { stepKey: key, field: 'endDate' })}>종료일로</button>
                      </>
                    ) : (
                      <button type="button" className={MINI} onClick={() => onPick('process', { stepKey: key, field: 'startDate' })}>여기서 시작</button>
                    )}
                  </div>
                  {early && <Warn>앞 공정 {early.label} 예상 종료 {shortDate(early.date)}보다 빨라요</Warn>}
                </div>
              );
            })}
            {piece && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" onClick={() => onPick('greige')} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.greige.dot}`} />
                  <PackageOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  생지 출고 (후염 · 오더 전체)
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {!piece && (
              <button type="button" onClick={() => onPick('greige')} className={ITEM}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.greige.dot}`} />
                <PackageOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                생지 출고
              </button>
            )}
            {canOpenLots && (
              <>
                <button type="button" onClick={() => onPick('lots')} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.dyeing.dot}`} />
                  <Droplets className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  새 염가공 LOT (이 날 투입)
                </button>
                {greige && !greige.fullDone && (
                  <Warn>{greige.entries.length ? '생지 전체 출고 전이에요 (부분 출고만)' : '생지 출고 기록이 아직 없어요'}</Warn>
                )}
              </>
            )}

            {!skipInspection && <div className={SECTION}>외관검사 (LOT · 지금 차수)</div>}
            {skipInspection ? null : lots.length === 0 ? (
              <div className="px-2.5 pb-1 text-[11px] text-slate-400">LOT가 없어요 — 먼저 새 염가공 LOT를 넣어 주세요.</div>
            ) : lots.map(lot => {
              const round = getLotCurrentRound(lot);
              const roundNo = Math.max(1, getLotRounds(lot).length);
              const st = findStatusMeta(INSPECTION_STATUSES, getRoundStatus(round));
              const early = lot.endDate && date < lot.endDate;
              return (
                <div key={lot.id}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-50">
                    <ScanSearch className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-700">
                      LOT{lot.no} {roundNo}차
                      <span className="ml-1 text-[10px] font-normal text-slate-400">{st && st.key !== 'waiting' ? st.label : '투입 전'}</span>
                    </span>
                    <button type="button" className={MINI} onClick={() => onPick('inspection', { lotId: lot.id, field: 'startDate' })}>시작일로</button>
                    <button type="button" className={MINI} onClick={() => onPick('inspection', { lotId: lot.id, field: 'endDate' })}>종료일로</button>
                  </div>
                  {early && <Warn>LOT{lot.no} 염가공 완료예정 {shortDate(lot.endDate)}보다 빨라요</Warn>}
                </div>
              );
            })}

            <div className="my-1 border-t border-slate-100" />
            {!skipConfirm && (
              <>
                <button type="button" onClick={() => onPick('confirm', { brandSent: true })} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.confirm.dot}`} />
                  <BadgeCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  브랜드 컨펌 전달 (이 날)
                </button>
                <button type="button" onClick={() => onPick('confirm', { testExpected: true })} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.test.dot}`} />
                  <FileCheck2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  시험성적서 발행 예상일
                </button>
              </>
            )}
            <button type="button" onClick={() => onPick('ship')} className={ITEM}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.ship.dot}`} />
              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              출고일
            </button>
          </>
        )}

        <div className="my-1 border-t border-slate-100" />
        <button type="button" onClick={() => onPick('note')} className={`${ITEM} !text-slate-500`}>
          <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          이 날 메모{hasNote ? ' (수정)' : ''}
          <CalendarPlus className="w-3 h-3 ml-auto text-slate-300" />
        </button>
      </div>
    </PopoverShell>
  );
};

export default GanttDateMenu;
