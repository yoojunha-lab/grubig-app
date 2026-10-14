import { PRESETTING_KEY } from '../../../constants/production';
import { StepChip } from './StepChip';

// ============================================================
// 프리세팅 한 줄 표시 (현황표 염가공 LOT 칸 · 상세창 LOT 카드) — 대표님 요청 2026-10-14
// ------------------------------------------------------------
// 프리세팅은 공정 칸이 아니라 염가공 LOT 창에서 관리 (염색 전 · 오더 공통). 쓰는 오더만 보임
//  '프리세팅 진행중 10/14~10/16' / '프리세팅 완료'
// props: order, className
// ============================================================

export const PresettingChip = ({ order, className = '' }) => (
  <StepChip
    order={order}
    stepKey={PRESETTING_KEY}
    label="프리세팅"
    scope="염색 전 · 오더 공통"
    tone="bg-cyan-50 text-cyan-800 border-cyan-200"
    className={className}
  />
);

export default PresettingChip;
