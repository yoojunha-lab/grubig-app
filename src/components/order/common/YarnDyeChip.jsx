import { YARN_DYEING_KEY, PROGRESS_STATUS_COLORS, getStatusLabel } from '../../../constants/production';
import { isStepUsed } from '../../../utils/orderModel';
import { shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 원사염색 한 줄 표시 (현황표 원사 칸 · 상세창 원사 섹션) — 대표님 요청 2026-10-14 v11
// ------------------------------------------------------------
// 원사염색은 선염 오더에서 원사 칸 · 원사 창으로 관리 (오더에 한 번). 넣은 오더만 보임
//  '원사염색 진행중 10/21~10/25' / '원사염색 완료'
// props: order, className
// ============================================================

const fmtRange = (start, end) => {
  if (!start && !end) return '';
  if (start && end) return `${shortDate(start)}~${shortDate(end)}`;
  return start ? `${shortDate(start)}~` : `~${shortDate(end)}`;
};

export const YarnDyeChip = ({ order, className = '' }) => {
  const step = order?.steps?.[YARN_DYEING_KEY];
  if (!isStepUsed(step)) return null;
  const st = step.status || 'pending';
  const c = PROGRESS_STATUS_COLORS[st] || PROGRESS_STATUS_COLORS.pending;
  const range = fmtRange(step.startDate, step.endDate);
  return (
    <div
      className={`inline-flex items-center gap-1 max-w-full px-1 py-px rounded border text-[9px] font-bold bg-pink-50 text-pink-800 border-pink-200 ${className}`}
      title={`원사염색 (선염 · 오더 공통) ${getStatusLabel(st)}${step.vendor ? ` · ${step.vendor}` : ''}${range ? ` · 예상 ${range}` : ''}${step.notes ? ` · ${step.notes}` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className="truncate">원사염색 {st === 'done' ? '완료' : getStatusLabel(st)}{range && st !== 'done' ? ` ${range}` : ''}</span>
    </div>
  );
};

export default YarnDyeChip;
