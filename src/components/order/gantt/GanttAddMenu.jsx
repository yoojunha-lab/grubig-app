import { Flag, Truck, PackageOpen, Droplets, BadgeCheck, ScanSearch, CalendarClock } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { PROCESS_THEME } from '../../../constants/production';
import { isStepUsed } from '../../../utils/orderModel';

// ============================================================
// 간트 줄 이름 옆 [+] 메뉴 — 아직 막대가 없는 일정도 간트에서 바로 시작 (대표님 요청 2026-10-11 '간트에서도 수정 및 진행')
// ------------------------------------------------------------
// - 오더 줄: 공정(원사 · 사가공 · 편직 · 프리세팅 · … 추가 공정) 일정 · 가납기
// - 컬러 줄: 생지 출고 · 염가공 LOT · 컨펌·시험성적서 · 외관검사 · 출고
// - 고르면 onPick(kind, extra) → OrderGantt 가 그 입력 창을 같은 자리에 띄움
// props: order, color(null = 오더 줄), stepDefs, anchorRect, onPick(kind, { stepKey? }), onClose, canOpenLots
// ============================================================

const ITEM = 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-slate-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

const COLOR_ITEMS = [
  { kind: 'greige', label: '생지 출고', Icon: PackageOpen, theme: 'greige' },
  { kind: 'lots', label: '염가공 LOT', Icon: Droplets, theme: 'dyeing' },
  { kind: 'confirm', label: '컨펌 · 시험성적서', Icon: BadgeCheck, theme: 'confirm' },
  { kind: 'inspection', label: '외관검사', Icon: ScanSearch, theme: 'inspection' },
  { kind: 'ship', label: '출고', Icon: Truck, theme: 'ship' },
];

export const GanttAddMenu = ({ order, color = null, stepDefs = [], anchorRect, onPick, onClose, canOpenLots = true }) => {
  if (!order) return null;
  const title = `${order.orderNumber || '새 오더'}${color ? ` · ${color.name || '컬러'}` : ''}`;

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={240}
      title={title}
      subtitle={color ? '컬러 일정 입력 · 수정' : '공정 일정 · 가납기 입력 · 수정'}
      onClose={onClose}
    >
      <div className="p-1.5 space-y-0.5 outline-none" tabIndex={-1} data-autofocus>
        {color ? (
          COLOR_ITEMS.filter(it => it.kind !== 'lots' || canOpenLots).map(({ kind, label, Icon, theme }) => (
            <button key={kind} type="button" onClick={() => onPick(kind)} className={ITEM}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME[theme]?.dot || 'bg-slate-400'}`} />
              <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {label}
            </button>
          ))
        ) : (
          <>
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> 공정 일정
            </div>
            {stepDefs.map(meta => {
              const used = isStepUsed(order.steps?.[meta.key]);
              const theme = PROCESS_THEME[meta.key] || PROCESS_THEME.custom;
              return (
                <button key={meta.key} type="button" onClick={() => onPick('process', { stepKey: meta.key })} className={ITEM}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot} ${used ? '' : 'opacity-30'}`} />
                  <span className="flex-1 min-w-0 truncate">{meta.label}</span>
                  <span className="text-[10px] font-normal text-slate-400">{used ? '수정' : '입력'}</span>
                </button>
              );
            })}
            <div className="my-1 border-t border-slate-100" />
            <button type="button" onClick={() => onPick('provisional')} className={ITEM}>
              <Flag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              가납기 (일수 · 날짜)
            </button>
          </>
        )}
      </div>
    </PopoverShell>
  );
};

export default GanttAddMenu;
