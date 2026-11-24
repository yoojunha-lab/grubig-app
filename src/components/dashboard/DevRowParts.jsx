import React from 'react';
import { MessageSquareMore } from 'lucide-react';
import { DEV_REQUEST_STATUS_LABELS } from '../../constants/common';
import { replyWaitOf, REPLY_WAIT_CLS } from '../../utils/devFlowModel';

// ============================================================
// 개발 건 한 줄의 작은 부품 — 개발/설계 현황 표 · 샘플 진행 (생산 현황) 표 공용
//  (리팩토링 2026-11-24 — 두 표가 따로 만들어서 샘플 진행 표는 가설계서 바이어 · 의뢰 상태가 빠져 있었음)
//  줄 값 계산(번호 · 품목명 · 바이어 글자)은 utils/devFlowModel (rowOdNo · rowTitle · showSheetName · rowBuyerName)
// ============================================================

/** 바이어 칸: 의뢰 바이어(+ 담당) / 설계서가 가리키는 의뢰(Drop 등)의 바이어 + 상태 / 가설계서 바이어 / 자체개발 */
export const RowBuyer = ({ row }) => {
  if (row.dev) {
    return (
      <>
        {row.dev.buyerName || '-'}
        {row.dev.assignee && <span className="block text-[9px] font-normal text-slate-400 truncate" title="영업 담당자">담당 {row.dev.assignee}</span>}
      </>
    );
  }
  if (row.linkedDev) {
    return (
      <span title="이 설계서가 가리키는 개발 의뢰는 지금 이 표에 없어요 (Drop 등)">
        {row.linkedDev.buyerName || '-'}
        <span className="ml-1 text-[9px] font-normal text-slate-400">(의뢰 {DEV_REQUEST_STATUS_LABELS[row.linkedDev.status] || row.linkedDev.status})</span>
      </span>
    );
  }
  if (row.sheet?.fromTemp?.buyerName) {
    return (
      <span title="가설계서(레시피)에 적은 바이어 — 개발 의뢰는 없어요">
        {row.sheet.fromTemp.buyerName}
        <span className="ml-1 text-[9px] font-normal text-slate-400">(가설계서)</span>
      </span>
    );
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>;
};

/** 이 개발 건의 L/D 요약 배지 — 예: 'L/D 3컬러 · 컨펌 1 · 진행 2' (labdipModel.labdipDevSummary) */
export const LabdipChip = ({ summary }) => (summary?.total
  ? <span className="inline-flex items-center w-fit text-[9px] font-bold px-1.5 py-0.5 rounded border bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 whitespace-nowrap"
      title={`이 개발 건으로 의뢰한 L/D ${summary.ldNos?.join(', ') || ''} — 생산 ▾ LAB-DIP에서 봐요`}>L/D {summary.label}</span>
  : null);

/** 견적 회신 대기 N일 배지 (원가 견적을 내고 '대기 중'인 의뢰) */
export const ReplyWaitChip = ({ dev }) => {
  const w = replyWaitOf(dev);
  if (!w) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 w-fit text-[9px] font-bold px-1.5 py-0.5 rounded border ${REPLY_WAIT_CLS[w.tone]}`}
      title={`원가 견적을 보내고 바이어 회신을 기다린 지 ${w.days}일 (7일부터 노랑 · 14일부터 빨강)`}>
      <MessageSquareMore className="w-2.5 h-2.5" /> 회신 대기 {w.days === 0 ? '오늘' : `${w.days}일`}
    </span>
  );
};
