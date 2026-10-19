import React, { useRef, useState } from 'react';
import { X, Tags, Lock } from 'lucide-react';
import { ModalBackdrop } from '../../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../../common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { ORDER_KINDS, detectOrderType } from '../../../constants/production';
import { getOrderKind, getOrderKindMeta, isKindLocked } from '../../../utils/orderModel';

// ============================================================
// 구분 바꾸기 / 샘플 종류 정하기 (대표님 요청 2026-10-19 '샘플/메인을 함부로 바꿀 수 있으면 안 됨')
// ------------------------------------------------------------
// - 구분은 오더를 만들 때 정하고 잠김 → 잘못 고른 경우에만 이 창에서 바꿈 (⋯ 메뉴 · 상세창 [구분 바꾸기])
//   · 사유를 꼭 적어야 저장 — 변경 이력에 '구분 변경 (사유: …) — 구분 신제품→재샘플'
//   · 종류 미정(예전 샘플)에 신제품 · 재샘플을 처음 고르는 것은 사유 없이도 ('샘플 종류 정하기')
//     메인을 고르면 샘플을 메인으로 바꾸는 것이라 사유 필수 (대표님 결정 2026-10-19 검토 ⑥ — useOrder 도 막음)
// - 설계서와 연결된 신제품은 못 바꿈 (안내만 — 샘플을 그만두려면 Drop)
// - 고른 구분 · 적은 사유가 있는데 닫으면 '변경사항이 있습니다' (팝업 창 규약 — terminology §4)
// - 저장은 onSave(kind, reason) → 성공(true)하면 이 창이 닫음 (막히면 알림은 useOrder 가 띄움)
// props: order, onSave(kind, reason) => Promise<boolean>, onClose
// ============================================================

const BLANK = { kind: '', reason: '' };

export const OrderKindDialog = ({ order, onSave, onClose }) => {
  const [draft, setDraft] = useState(BLANK);
  const [needKind, setNeedKind] = useState(false);     // 구분을 안 고르고 저장을 누르면 빨갛게 안내
  const [needReason, setNeedReason] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false); // 처리 중 잠금 — 빠르게 두 번 눌러도 한 번만
  const guard = useUnsavedGuard(draft, true, { initial: BLANK });

  const current = getOrderKind(order);
  const currentMeta = getOrderKindMeta(current);
  const first = current === 'unknown';             // 종류 미정 → 처음 고르기 ('샘플 종류 정하기')
  const locked = isKindLocked(order);               // 설계서와 연결된 신제품
  const target = ORDER_KINDS.find(k => k.key === draft.kind) || null;
  // 사유: 종류 미정에 신제품 · 재샘플을 고를 때만 선택 — 메인은 샘플을 메인으로 바꾸는 것이라 필수 (⑥)
  const reasonOptional = first && target?.key !== 'main';
  const reasonMissing = !reasonOptional && !draft.reason.trim();

  // 고른 구분에 따라 알려 줄 것
  const notes = [];
  if (target) {
    if (target.key === 'resample' && !order?.linkedFabricId) {
      notes.push('재샘플은 article# 칸에서 기존 아이템(원단 관리)을 골라야 완료할 수 있어요.');
    }
    if (target.key === 'new' && !order?.linkedSheetId) {
      notes.push('신제품은 ⋯ 메뉴(또는 상세창)에서 [새 설계서 작성] 또는 [작성 중인 설계서 연결]을 하면 아이템화할 수 있어요.');
    }
    if (target.key === 'main' && first) {
      notes.push('종류 미정 샘플을 메인으로 바꾸는 것이라 사유를 꼭 적어 주세요 (변경 이력에 남아요).');
    }
    if (target.key === 'main' && current !== 'main') {
      notes.push("메인이 되면 [샘플] 목록 · 리포트 샘플 통계에서 빠지고 메인으로 셈해요.");
    }
    const detected = detectOrderType(order?.orderNumber);
    if (detected && detected !== target.type) {
      notes.push(`order# ${order.orderNumber}는 ${detected === 'sample' ? '샘플(S)' : '메인(M)'} 번호예요 — 번호는 그대로예요.`);
    }
  }

  const submit = async () => {
    if (locked) return;
    if (!target || target.key === current) {
      setNeedKind(true);
      return;
    }
    if (reasonMissing) {
      setNeedReason(true);
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    let ok = false;
    try {
      ok = (await onSave?.(target.key, draft.reason.trim())) !== false;
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
    if (ok) onClose?.();
  };

  const requestClose = () => {
    if (!locked && guard.isDirty()) setLeavePending(true);
    else onClose?.();
  };

  const canSave = !locked && !!target && target.key !== current && !reasonMissing;

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={requestClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-label={first ? '샘플 종류 정하기' : '구분 바꾸기'}
        >
          <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Tags className="w-4 h-4 text-teal-600" /> {first ? '샘플 종류 정하기' : '구분 바꾸기'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                <span className="font-mono font-bold text-teal-700">{order?.orderNumber || '-'}</span>
                {' · 지금 '}
                <span className={`px-1.5 py-px rounded border text-[10px] font-extrabold ${currentMeta.chip}`}>{currentMeta.label}</span>
              </p>
            </div>
            <button type="button" onClick={requestClose} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0" title="닫기">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto">
            {locked ? (
              <div className="px-3 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] text-indigo-800 leading-relaxed">
                <div className="font-extrabold flex items-center gap-1"><Lock className="w-3 h-3" /> 설계서와 연결된 신제품 샘플은 구분을 바꿀 수 없어요.</div>
                설계서 아이템화 · Drop 때 이 오더가 같이 닫히기 때문이에요.
                샘플을 그만두려면 ⋯ 메뉴(또는 상세창)의 <b>설계서 Drop</b>을 써 주세요.
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {first
                    ? '예전에 만든 샘플이라 종류를 몰라요. 한 번 고르면 잠겨요 (그 뒤엔 사유를 적어야 바꿀 수 있어요). 메인으로 바꿀 때는 사유가 꼭 필요해요.'
                    : '구분은 오더를 만들 때 정해요. 잘못 골랐을 때만 바꾸고, 사유는 변경 이력에 남아요.'}
                </p>
                {needKind && !target && (
                  <p className="text-[11px] font-extrabold text-red-600">바꿀 구분을 골라 주세요.</p>
                )}
                <div className="grid grid-cols-1 gap-1.5">
                  {ORDER_KINDS.map(k => {
                    const isCurrent = k.key === current;
                    const on = draft.kind === k.key;
                    return (
                      <button
                        key={k.key}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => setDraft(prev => ({ ...prev, kind: k.key }))}
                        aria-pressed={on}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors disabled:cursor-default ${
                          on
                            ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
                            : isCurrent
                              ? 'border-slate-200 bg-slate-50 opacity-60'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${on ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`} />
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${k.chip}`}>{k.label}</span>
                          <span className="text-xs font-bold text-slate-700">{k.menuLabel}</span>
                          {isCurrent && <span className="ml-auto text-[10px] font-bold text-slate-400">지금</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 pl-5 leading-snug">{k.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${needReason && reasonMissing ? 'text-red-600' : 'text-slate-600'}`}>
                    사유 {reasonOptional ? '(선택)' : <span className="text-red-500">*</span>}
                    {needReason && reasonMissing && <span className="ml-1 font-extrabold">— 사유를 적어 주세요</span>}
                  </label>
                  <textarea
                    value={draft.reason}
                    onChange={e => setDraft(prev => ({ ...prev, reason: e.target.value }))}
                    rows={2}
                    placeholder={reasonOptional ? '예: 기존 PW1060 재샘플' : first ? '예: 사실 메인 오더였음' : '예: 오더 추가할 때 메인으로 잘못 골랐음'}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-2 ring-teal-200 resize-none"
                  />
                </div>

                {notes.length > 0 && (
                  <ul className="space-y-1">
                    {notes.map(n => (
                      <li key={n} className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button type="button" onClick={requestClose} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {locked ? '닫기' : '취소'}
            </button>
            {!locked && (
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed ${canSave ? '' : 'opacity-60'}`}
                title={!target ? '바꿀 구분을 먼저 골라 주세요' : reasonMissing ? '사유를 적어 주세요' : ''}
              >
                <Tags className="w-3.5 h-3.5" /> {first ? '이 종류로 정하기' : '구분 바꾸기'}
              </button>
            )}
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={leavePending}
        message="고른 구분 · 적은 사유가 있어요. 이대로 바꿀까요? ('저장 안 함'을 누르면 바꾸지 않고 닫아요)"
        onSave={() => { setLeavePending(false); submit(); }}
        onDiscard={onClose}
        onKeepEditing={() => setLeavePending(false)}
      />
    </>
  );
};

export default OrderKindDialog;
