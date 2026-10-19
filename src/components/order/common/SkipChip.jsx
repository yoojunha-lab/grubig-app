import { DONE_TONE } from '../../../constants/production';
import { stockSkipLabel } from '../../../utils/orderModel';

// ============================================================
// '재고 사용' · '생지 재고' · '안 함' 표시 (대표님 요청 2026-10-19)
// ------------------------------------------------------------
// - 편직 [재고 사용](생지 재고) · 컨펌 · 성적서 / 외관검사 '안 함' — 진행하지 않는 칸 = 끝난 것처럼 회색
//   (칸을 누르면 입력 창에서 다시 진행) — 현황표 · 상세창 공용 (2026-10-19 검토 — 한 곳으로)
// - StockSkipChip: 편직 재고 사용으로 건너뛴 칸 — 편직 = '재고 사용', 원사 · 사가공 · 원사염색 · 편직 앞 추가 공정 = '생지 재고'
// ============================================================

export const SkipChip = ({ label, title, className = '' }) => (
  <span
    className={`inline-flex items-center px-1.5 py-px rounded-full border text-[10px] font-extrabold whitespace-nowrap ${DONE_TONE.chip} ${className}`}
    title={title}
  >
    {label}
  </span>
);

const STOCK_SKIP_TITLES = {
  knitting: '편직 재고 사용 — 생지 재고로 진행해요 (원사 · 편직 안 함). 풀려면 칸을 눌러 [재고 사용] 체크 해제',
  yarn: '편직 재고 사용(생지 재고) — 원사가 필요 없어요 (사종 줄은 참고만)',
};

export const StockSkipChip = ({ stepKey, className = '' }) => (
  <SkipChip
    label={stockSkipLabel(stepKey)}
    title={STOCK_SKIP_TITLES[stepKey] || '편직 재고 사용(생지 재고) — 이 공정은 안 해요'}
    className={className}
  />
);

export default SkipChip;
