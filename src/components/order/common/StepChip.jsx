import { PROGRESS_STATUS_COLORS, getStatusLabel } from '../../../constants/production';
import { isStepUsed } from '../../../utils/orderModel';
import { shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 오더 공통 공정 한 줄 표시 (공정 칸이 아닌 곳에서 관리하는 공정) — PresettingChip · YarnDyeChip 공용
// ------------------------------------------------------------
//  '프리세팅 진행중 10/14~10/16' / '원사염색 완료' — 입력이 있는 오더만 보임
// props: order, stepKey, label(이름), scope(툴팁 앞 설명 — 예: '염색 전 · 오더 공통'), tone(칩 색 클래스), className
// ============================================================

const fmtRange = (start, end) => {
  if (!start && !end) return '';
  if (start && end) return `${shortDate(start)}~${shortDate(end)}`;
  return start ? `${shortDate(start)}~` : `~${shortDate(end)}`;
};

export const StepChip = ({ order, stepKey, label, scope = '', tone = '', className = '' }) => {
  const step = order?.steps?.[stepKey];
  if (!isStepUsed(step)) return null;
  const st = step.status || 'pending';
  const c = PROGRESS_STATUS_COLORS[st] || PROGRESS_STATUS_COLORS.pending;
  const range = fmtRange(step.startDate, step.endDate);
  return (
    <div
      className={`inline-flex items-center gap-1 max-w-full px-1 py-px rounded border text-[9px] font-bold ${tone} ${className}`}
      title={`${label}${scope ? ` (${scope})` : ''} ${getStatusLabel(st)}${step.vendor ? ` · ${step.vendor}` : ''}${range ? ` · 예상 ${range}` : ''}${step.notes ? ` · ${step.notes}` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className="truncate">{label} {st === 'done' ? '완료' : getStatusLabel(st)}{range && st !== 'done' ? ` ${range}` : ''}</span>
    </div>
  );
};

export default StepChip;
