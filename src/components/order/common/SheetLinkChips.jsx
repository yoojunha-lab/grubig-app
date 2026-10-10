import React from 'react';
import { FileText } from 'lucide-react';

// ============================================================
// 설계서 연결 표시 (대표님 요청 2026-10-10 — 설계서 EZ-TEX O/D NO. 등록으로 만든 생산 현황 샘플 오더)
// ------------------------------------------------------------
// - [설계서] 누르면 설계서 작성 창 (onOpen) — 누를 수 없는 곳(간트 라벨처럼 버튼 안)은 onOpen 없이 → 글자만
// - Drop된 설계서 = 'Drop', 아이템화된 설계서 = '아이템화' 꼬리표 (샘플이 어떻게 끝났는지)
// props: info = OrderListPage.sheetInfoOf(order) ({ sheet, dropped, articled, devOrderNo, buyerName, stageLabel }) | null
//        onOpen(sheetId)?, size: 'sm'(표·간트) | 'md'(모바일·상세창)
// ============================================================

export const SheetLinkChips = ({ info, onOpen, size = 'sm' }) => {
  if (!info) return null;
  const s = info.sheet;
  const title = [
    onOpen ? '설계서 열기' : '설계서와 연결된 샘플 오더',
    [info.devOrderNo || '자체개발', s.fabricName, info.buyerName].filter(Boolean).join(' · '),
    info.dropped ? 'Drop됨 — 복원하려면 ⋯ 메뉴 / 상세창' : info.stageLabel ? `설계서 단계: ${info.stageLabel}` : '',
  ].filter(Boolean).join('\n');
  const text = size === 'sm' ? 'text-[9px] px-1' : 'text-[10px] px-1.5';
  const chipCls = `inline-flex items-center gap-0.5 py-px rounded border font-extrabold bg-indigo-50 text-indigo-700 border-indigo-200 ${text}`;
  return (
    <>
      {onOpen ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={e => {
            e.stopPropagation(); // 모바일 카드처럼 눌러서 여는 칸 안에 있어도 설계서만 열리게
            onOpen(s.id);
          }}
          title={title}
          className={`${chipCls} hover:bg-indigo-100`}
        >
          <FileText className="w-2.5 h-2.5" /> 설계서
        </button>
      ) : (
        <span className={chipCls} title={title}>
          <FileText className="w-2.5 h-2.5" /> 설계서
        </span>
      )}
      {info.dropped && (
        <span className={`py-px rounded border font-extrabold bg-rose-50 text-rose-600 border-rose-200 ${text}`} title="설계서가 Drop됐어요 (샘플 종료)">
          Drop
        </span>
      )}
      {info.articled && (
        <span className={`py-px rounded border font-extrabold bg-emerald-50 text-emerald-700 border-emerald-200 ${text}`} title="설계서 아이템화 완료 (원단 관리에 등록)">
          아이템화
        </span>
      )}
    </>
  );
};

export default SheetLinkChips;
