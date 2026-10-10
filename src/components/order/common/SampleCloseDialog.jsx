import React from 'react';
import { Award, XCircle, CheckCircle2, X } from 'lucide-react';
import { ModalBackdrop } from '../../common/ModalBackdrop';
import { getOpenWork } from '../../../utils/orderModel';

// ============================================================
// 샘플 끝내기 (대표님 결정 2026-10-10)
// ------------------------------------------------------------
// 설계서와 연결된 샘플 오더를 '완료'로 바꿀 때, 설계서가 아직 아이템화·Drop 전이면 이 창이 뜬다.
//  샘플은 아이템화 아니면 Drop 으로 끝남 → 오더만 완료하면 설계서가 '샘플 진행'에 멈추므로 여기서 고름
//   [아이템화 (원단 등록)]  설계서 아이템화 → 원단 등록 + 이 오더 article# 연결·완료 (OrderListPage.itemizeSheet)
//   [Drop (샘플 종료)]      설계서 Drop → 이 오더 'Drop' (의뢰가 있으면 Drop 사유 창 — OrderListPage.requestSampleDrop)
//   [오더만 완료]           오더만 완료 — '아이템화 대기' 표시를 달고 '진행 중' 목록에 남음 (나중에 ⋯ 메뉴에서 아이템화·Drop)
// 고르면 창은 바로 닫히고, 그다음 확인 창·Drop 사유 창은 각 기능이 띄움
// props: order(완료로 바꾸려는 샘플 오더 — 아직 끝나지 않은 공정을 같이 보여 줌), sheetLabel, onItemize, onDrop, onCompleteOnly, onClose
// ============================================================

export const SampleCloseDialog = ({ order, sheetLabel, onItemize, onDrop, onCompleteOnly, onClose }) => {
  const openWork = getOpenWork(order);
  return (
    <ModalBackdrop className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()} role="dialog" aria-label="샘플 끝내기">
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800">샘플을 어떻게 끝낼까요?</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 break-words">
              <span className="font-mono font-bold text-teal-700">{order?.orderNumber || '-'}</span>
              {sheetLabel ? <> · 설계서 {sheetLabel}</> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0" title="닫기">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            샘플은 <b className="text-slate-700">아이템화</b> 아니면 <b className="text-slate-700">Drop</b>으로 끝나요.
            아직 정하지 못했으면 오더만 완료해 두고 나중에 ⋯ 메뉴에서 골라도 돼요.
          </p>
          {openWork.length > 0 && (
            <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
              아직 끝나지 않은 공정이 있어요: {openWork.join(', ')}
            </p>
          )}

          <button type="button" onClick={onItemize}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700">
              <Award className="w-4 h-4 shrink-0" /> 아이템화 (원단 등록)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 pl-6">원단 관리에 등록하고 이 오더 article#를 그 원단으로 연결해요. 오더는 '완료'.</div>
          </button>

          <button type="button" onClick={onDrop}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 hover:border-rose-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600">
              <XCircle className="w-4 h-4 shrink-0" /> Drop (샘플 종료)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 pl-6">설계서를 보관함으로 (개발 의뢰가 있으면 사유를 골라 같이 Drop). 오더는 'Drop'.</div>
          </button>

          <button type="button" onClick={onCompleteOnly}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> 오더만 완료 — 나중에 정하기
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 pl-6">'아이템화 대기' 표시를 달고 '진행 중' 목록에 남아요.</div>
          </button>
        </div>

        <div className="px-4 pb-4 flex justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default SampleCloseDialog;
