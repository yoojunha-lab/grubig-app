import React, { useRef, useState } from 'react';
import { X, XCircle, Target } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { DevQuoteBadge } from './DevQuoteBadge';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { DEV_DROP_REASONS } from '../../constants/common';

const BLANK_DROP = { reason: '', memo: '' };

/**
 * 개발 의뢰 Drop(미진행) — 사유와 같이 (대표님 요청 2026-10-06: 원가 견적을 보고 비싸서 Drop된 건을 따로 보려고)
 *  · 사유는 꼭 골라야 함 (가격·납기·품질/스펙·바이어 사정·기타), 메모는 선택
 *  · 원가 견적·견적서가 있으면 그때 가격을 같이 보여 줌 (가격 Drop 판단용)
 *  · 사유·메모를 고른 채 닫으면 'Drop 처리할까요?' 확인 (팝업 규약 — 쓰던 메모가 그냥 사라지지 않게)
 *  · Drop된 의뢰는 보관함 'Drop된 의뢰'에서 사유별로 볼 수 있고 [복원]하면 사유는 지워짐
 *
 * @param {Object}   devReq    Drop할 의뢰
 * @param {Object}   quoteInfo getDevQuoteBadge 결과 (없으면 null)
 * @param {Object}   sheet     이 의뢰로 쓰고 있는 설계서 (있으면 같이 Drop — 대표님 결정 2026-10-10, 안내 한 줄)
 * @param {string}   orderNo   그 설계서의 생산 현황 샘플 오더 order# (생산 현황에서 샘플을 Drop할 때 — 'Drop'으로 닫힘 안내)
 * @param {Function} onConfirm async (reason, memo) => 저장됐으면 true (그때 부르는 쪽이 창을 닫음)
 */
export const DevDropModal = ({ devReq, quoteInfo, sheet = null, orderNo = '', onClose, onConfirm }) => {
  const [draft, setDraft] = useState(BLANK_DROP);
  const [needReason, setNeedReason] = useState(false); // 사유 없이 Drop 처리를 누르면 빨갛게 안내
  const [leavePending, setLeavePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);                 // 처리 중 잠금 — 빠르게 두 번 눌러도 한 번만
  const guard = useUnsavedGuard(draft, true, { initial: BLANK_DROP });
  const targetPrice = String(devReq?.targetSpec?.targetPrice || '').trim();

  const submit = async () => {
    if (!draft.reason) { setNeedReason(true); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      await onConfirm(draft.reason, draft.memo);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const requestClose = () => { if (guard.isDirty()) setLeavePending(true); else onClose(); };

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" /> Drop (미진행) 처리
                <span className="font-mono text-violet-700">{devReq?.devOrderNo || '-'}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{devReq?.buyerName || '-'} · {devReq?.devItem || devReq?.targetSpec?.composition || '품목명 미입력'}</p>
            </div>
            <button type="button" onClick={requestClose} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0"><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto">
            {sheet && (
              <div className="px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] text-indigo-800 leading-snug">
                <b>설계서({sheet.fabricName || '원단명 미입력'}){orderNo ? `와 생산 현황 샘플 오더(${orderNo})` : ''}도 같이 Drop돼요.</b>
                {orderNo ? ' 의뢰·설계서는 보관함으로, 샘플 오더는 \'Drop\'으로 닫혀요.' : ' 둘 다 보관함으로 가요.'}
                <span className="block text-indigo-600/80">보관함에서 [복원]하면 의뢰('개발 확정')·설계서{orderNo ? '·샘플 오더' : ''}가 같이 돌아와요.</span>
              </div>
            )}
            {(quoteInfo || targetPrice) && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <DevQuoteBadge badge={quoteInfo} size="md" />
                {targetPrice && (
                  <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded border text-[10px] text-amber-800 bg-amber-50 border-amber-200">
                    <Target className="w-2.5 h-2.5" /> 타겟 {targetPrice}
                  </span>
                )}
              </div>
            )}

            <div>
              <div className={`text-[11px] font-bold mb-1.5 ${needReason && !draft.reason ? 'text-red-600' : 'text-slate-600'}`}>
                Drop 사유 <span className="text-red-500">*</span>
                {needReason && !draft.reason && <span className="ml-1 font-extrabold">— 사유를 골라 주세요</span>}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {DEV_DROP_REASONS.map(r => {
                  const on = draft.reason === r.key;
                  return (
                    <button key={r.key} type="button" onClick={() => setDraft(prev => ({ ...prev, reason: r.key }))} aria-pressed={on}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${on ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${on ? 'border-red-500 bg-red-500' : 'border-slate-300'}`} />
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${r.cls}`}>{r.label}</span>
                        {r.desc && <span className="text-[11px] text-slate-500">{r.desc}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">메모 (선택)</label>
              <textarea value={draft.memo} onChange={e => setDraft(prev => ({ ...prev, memo: e.target.value }))} rows={2}
                placeholder={draft.reason === 'price' ? '예: 바이어 타겟 $3.20, 우리 견적 $3.85 — 원사 단가 차이' : '예: 바이어가 다른 업체로 결정'}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-2 ring-red-200 resize-none" />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Drop한 의뢰는 목록에서 빠지고 [보관함 → Drop된 의뢰]에서 사유별로 볼 수 있어요.
              {sheet ? ' [복원]하면 설계서와 같이 \'개발 확정\'으로 돌아가고 사유는 지워져요.' : ' [복원]하면 다시 \'의뢰 접수\'로 돌아가고 사유는 지워져요.'}
            </p>
          </div>

          <div className="p-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button type="button" onClick={requestClose} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
            <button type="button" onClick={submit} disabled={busy}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed ${draft.reason ? '' : 'opacity-60'}`}
              title={draft.reason ? '' : 'Drop 사유를 먼저 골라 주세요'}>
              <XCircle className="w-3.5 h-3.5" /> Drop 처리
            </button>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={leavePending}
        message="고른 Drop 사유·메모가 있어요. 이대로 Drop 처리할까요? ('저장 안 함'을 누르면 Drop하지 않고 닫아요)"
        onSave={() => { setLeavePending(false); submit(); }}
        onDiscard={onClose}
        onKeepEditing={() => setLeavePending(false)}
      />
    </>
  );
};
