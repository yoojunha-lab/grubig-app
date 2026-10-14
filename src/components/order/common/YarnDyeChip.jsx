import { YARN_DYEING_KEY } from '../../../constants/production';
import { StepChip } from './StepChip';

// ============================================================
// 원사염색 한 줄 표시 (현황표 원사 칸 · 상세창 원사 상자) — 대표님 요청 2026-10-14 v11
// ------------------------------------------------------------
// 원사염색은 선염 오더에서 원사 칸 · 원사 창으로 관리 (오더에 한 번). 넣은 오더만 보임
//  '원사염색 진행중 10/21~10/25' / '원사염색 완료'
// props: order, className
// ============================================================

export const YarnDyeChip = ({ order, className = '' }) => (
  <StepChip
    order={order}
    stepKey={YARN_DYEING_KEY}
    label="원사염색"
    scope="선염 · 오더 공통"
    tone="bg-pink-50 text-pink-800 border-pink-200"
    className={className}
  />
);

export default YarnDyeChip;
