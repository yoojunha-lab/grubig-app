import React, { useState } from 'react';
import { X, XCircle, Target, FileText } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { DEV_DROP_REASONS } from '../../constants/common';

/**
 * 개발 의뢰 Drop(미진행) — 사유와 같이 (대표님 요청 2026-10-06: 원가 견적을 보고 비싸서 Drop된 건을 따로 보려고)
 *  · 사유는 꼭 골라야 함 (가격·납기·품질/스펙·바이어 사정·기타), 메모는 선택
 *  · 원가 견적·견적서가 있으면 그때 가격을 같이 보여 줌 (가격 Drop 판단용)
 *  · Drop된 의뢰는 보관함 'Drop된 의뢰'에서 사유별로 볼 수 있고 [복원]하면 사유는 지워짐
 *
 * @param {Object}   devReq    Drop할 의뢰
 * @param {Object}   quoteInfo getDevQuoteBadge 결과 (없으면 null)
 * @param {Function} onConfirm async (reason, memo) => 저장됐으면 true
 */
export const DevDropModal = ({ devReq, quoteInfo, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const targetPrice = String(devReq?.targetSpec?.targetPrice || '').trim();

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await onConfirm(reason, memo);
    } finally {
      setBusy(false);
    }
  };

  return (
    // marginTop 0: 개발 현황 화면의 세로 간격(space-y)이 팝업에 위 여백을 붙이지 않게
    <ModalBackdrop className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ marginTop: 0 }} onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Drop (미진행) 처리
              <span className="font-mono text-violet-700">{devReq?.devOrderNo || '-'}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{devReq?.buyerName || '-'} · {devReq?.devItem || devReq?.targetSpec?.composition || '품목명 미입력'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {(quoteInfo || targetPrice) && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {quoteInfo && (
                <span className={`font-bold px-2 py-0.5 rounded border ${quoteInfo.kind === 'quote' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`} title={quoteInfo.detail}>
                  <FileText className="w-3 h-3 inline -mt-0.5" /> {quoteInfo.kind === 'quote' ? '견적' : '예상'} {quoteInfo.qtyLabel} {quoteInfo.price}{quoteInfo.date ? ` · ${quoteInfo.date}` : ''}
                </span>
              )}
              {targetPrice && (
                <span className="font-bold px-2 py-0.5 rounded border text-amber-800 bg-amber-50 border-amber-200">
                  <Target className="w-3 h-3 inline -mt-0.5" /> 타겟 {targetPrice}
                </span>
              )}
            </div>
          )}

          <div>
            <div className="text-[11px] font-bold text-slate-600 mb-1.5">Drop 사유 <span className="text-red-500">*</span></div>
            <div className="grid grid-cols-1 gap-1.5">
              {DEV_DROP_REASONS.map(r => {
                const on = reason === r.key;
                return (
                  <button key={r.key} type="button" onClick={() => setReason(r.key)} aria-pressed={on}
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
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
              placeholder={reason === 'price' ? '예: 바이어 타겟 $3.20, 우리 견적 $3.85 — 원사 단가 차이' : '예: 바이어가 다른 업체로 결정'}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-2 ring-red-200 resize-none" />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Drop한 의뢰는 목록에서 빠지고 [보관함 → Drop된 의뢰]에서 사유별로 볼 수 있어요. [복원]하면 다시 '의뢰 접수'로 돌아가고 사유는 지워져요.
          </p>
        </div>

        <div className="p-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
          <button type="button" onClick={submit} disabled={!reason || busy}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={reason ? '' : 'Drop 사유를 먼저 골라 주세요'}>
            <XCircle className="w-3.5 h-3.5" /> Drop 처리
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};
