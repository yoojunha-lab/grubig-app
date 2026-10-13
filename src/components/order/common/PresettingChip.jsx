import { PRESETTING_KEY, PROGRESS_STATUS_COLORS, getStatusLabel } from '../../../constants/production';
import { isStepUsed } from '../../../utils/orderModel';
import { shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 프리세팅 한 줄 표시 (현황표 염가공 LOT 칸 · 상세창 LOT 카드) — 대표님 요청 2026-10-14
// ------------------------------------------------------------
// 프리세팅은 공정 칸이 아니라 염가공 LOT 창에서 관리 (염색 전 · 오더 공통). 쓰는 오더만 보임
//  '프리세팅 진행중 10/14~10/16' / '프리세팅 완료'
// props: order, className
// ============================================================

const fmtRange = (start, end) => {
  if (!start && !end) return '';
  if (start && end) return `${shortDate(start)}~${shortDate(end)}`;
  return start ? `${shortDate(start)}~` : `~${shortDate(end)}`;
};

export const PresettingChip = ({ order, className = '' }) => {
  const step = order?.steps?.[PRESETTING_KEY];
  if (!isStepUsed(step)) return null;
  const st = step.status || 'pending';
  const c = PROGRESS_STATUS_COLORS[st] || PROGRESS_STATUS_COLORS.pending;
  const range = fmtRange(step.startDate, step.endDate);
  return (
    <div
      className={`inline-flex items-center gap-1 max-w-full px-1 py-px rounded border text-[9px] font-bold bg-cyan-50 text-cyan-800 border-cyan-200 ${className}`}
      title={`프리세팅 (염색 전 · 오더 공통) ${getStatusLabel(st)}${range ? ` · 예상 ${range}` : ''}${step.notes ? ` · ${step.notes}` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className="truncate">프리세팅 {st === 'done' ? '완료' : getStatusLabel(st)}{range && st !== 'done' ? ` ${range}` : ''}</span>
    </div>
  );
};

export default PresettingChip;
