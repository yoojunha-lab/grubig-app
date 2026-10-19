import { Flag, Truck, PackageOpen, Droplets, BadgeCheck, ScanSearch, CalendarClock, ClipboardCheck, Layers } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { PROCESS_THEME, YARN_DYEING_KEY, withSubSteps } from '../../../constants/production';
import {
  isStepUsed, isPieceDyed, getClosingState, getYarnState, canUseYarnDyeing,
  isKnitStock, isStepSkippedByStock, isConfirmSkipped, isInspectionSkipped,
} from '../../../utils/orderModel';

// ============================================================
// 간트 줄 이름 옆 [+] 메뉴 — 아직 막대가 없는 일정도 간트에서 바로 시작 (대표님 요청 2026-10-11 '간트에서도 수정 및 진행')
// ------------------------------------------------------------
// - 오더 줄: 원사(사종 · 재고 사용 — 원사 창) + 공정(원사염색(선염) · 사가공 · 편직 · … 추가 공정) + 프리세팅(염색 전 · 오더 공통) 일정
//   · (후염) 생지 출고 · 가납기 · 마무리
// - 컬러 줄: (선염) 생지 출고 · 염가공 LOT · 컨펌·시험성적서 · 외관검사(LOT별) · 출고
// - 고르면 onPick(kind, extra) → OrderGantt 가 그 입력 창을 같은 자리에 띄움
// - 날짜가 정해진 입력은 빈 날짜 칸을 누르면 (GanttDateMenu)
// - 진행 안 함 (대표님 요청 2026-10-19): 컨펌 · 외관검사 '안 함'이면 그 항목 없음 / 편직 재고 사용이면 사가공 · 원사염색 없음
//   (편직은 '재고' 표시로 남김 — 눌러서 재고 사용을 풀 수 있게)
// props: order, color(null = 오더 줄), stepDefs, anchorRect, onPick(kind, { stepKey?, order? }), onClose, canOpenLots
// ============================================================

const ITEM = 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-slate-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

const COLOR_ITEMS = [
  { kind: 'greige', label: '생지 출고', Icon: PackageOpen, theme: 'greige' },
  { kind: 'lots', label: '염가공 LOT', Icon: Droplets, theme: 'dyeing' },
  { kind: 'confirm', label: '컨펌 · 시험성적서', Icon: BadgeCheck, theme: 'confirm' },
  { kind: 'inspection', label: '외관검사 (LOT별)', Icon: ScanSearch, theme: 'inspection' },
  { kind: 'ship', label: '출고', Icon: Truck, theme: 'ship' },
];

export const GanttAddMenu = ({ order, color = null, stepDefs = [], anchorRect, onPick, onClose, canOpenLots = true }) => {
  if (!order) return null;
  const title = `${order.orderNumber || '새 오더'}${color ? ` · ${color.name || '컬러'}` : ''}`;
  const piece = isPieceDyed(order);
  // 프리세팅은 편직 다음 (공정 칸에서는 빠졌지만 간트에서는 오더 줄 막대 — 염가공 LOT 창과 같은 값)
  // 원사염색은 맨 앞 — 선염 오더(또는 이미 넣은 오더)만
  const knitStock = isKnitStock(order);
  const steps = withSubSteps(stepDefs)
    .filter(m => m.key !== YARN_DYEING_KEY || canUseYarnDyeing(order))
    .filter(m => m.key === 'knitting' || !isStepSkippedByStock(order, m.key));
  const closing = getClosingState(order);
  const yarn = getYarnState(order);
  const skipConfirm = isConfirmSkipped(order);
  const skipInspection = isInspectionSkipped(order);

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={250}
      title={title}
      subtitle={color ? '컬러 일정 입력 · 수정' : '공정 일정 · 가납기 · 마무리 입력 · 수정'}
      onClose={onClose}
    >
      <div className="p-1.5 space-y-0.5 outline-none" tabIndex={-1} data-autofocus>
        {color ? (
          COLOR_ITEMS
            .filter(it => (it.kind !== 'lots' || canOpenLots) && (it.kind !== 'greige' || !piece))
            .filter(it => (it.kind !== 'confirm' || !skipConfirm) && (it.kind !== 'inspection' || !skipInspection))
            .map(({ kind, label, Icon, theme }) => (
              <button key={kind} type="button" onClick={() => onPick(kind)} className={ITEM}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME[theme]?.dot || 'bg-slate-400'}`} />
                <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {label}
              </button>
            ))
        ) : (
          <>
            <button type="button" onClick={() => onPick('yarn')} className={ITEM}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.yarn.dot} ${yarn.used ? '' : 'opacity-30'}`} />
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 min-w-0 truncate">원사 (사종 · 재고 사용)</span>
              <span className="text-[10px] font-normal text-slate-400">
                {yarn.greige ? '생지 재고' : yarn.stock ? '재고' : yarn.items.length ? `사종 ${yarn.items.length}` : '입력'}
              </span>
            </button>
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> 공정 일정
            </div>
            {steps.map(meta => {
              const used = isStepUsed(order.steps?.[meta.key]);
              const theme = PROCESS_THEME[meta.key] || PROCESS_THEME.custom;
              return (
                <button key={meta.key} type="button" onClick={() => onPick('process', { stepKey: meta.key })} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot} ${used ? '' : 'opacity-30'}`} />
                  <span className="flex-1 min-w-0 truncate">
                    {meta.label}
                    {meta.inLot && <span className="ml-1 text-[10px] font-normal text-slate-400">염색 전</span>}
                    {meta.inYarn && <span className="ml-1 text-[10px] font-normal text-slate-400">선염</span>}
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {meta.key === 'knitting' && knitStock ? '재고' : used ? '수정' : '입력'}
                  </span>
                </button>
              );
            })}
            {piece && (
              <button type="button" onClick={() => onPick('greige', { order: true })} className={ITEM}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.greige.dot}`} />
                <PackageOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                생지 출고 (후염 · 오더 전체)
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button type="button" onClick={() => onPick('provisional')} className={ITEM}>
              <Flag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              가납기 (일수 · 날짜)
            </button>
            <button type="button" onClick={() => onPick('closing')} className={ITEM}>
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="flex-1">마무리 (원사재고 · EZTEX)</span>
              <span className="text-[10px] font-normal text-slate-400">{closing.done}/{closing.total}</span>
            </button>
          </>
        )}
      </div>
    </PopoverShell>
  );
};

export default GanttAddMenu;
