import React, { useMemo, useRef, useState } from 'react';
import { X, Link2, Search, FilePlus2, FileText } from 'lucide-react';
import { ModalBackdrop } from '../../common/ModalBackdrop';
import { formatSheetLabel } from '../../../utils/orderModel';

// ============================================================
// 작성 중인 설계서 연결 (대표님 요청 2026-10-19 — 생산 현황에서 만든 신제품 샘플에 설계서 붙이기)
// ------------------------------------------------------------
// - 고를 수 있는 설계서 = 아직 생산 현황 샘플 오더가 없는 진행 중 설계서 (Drop · 아이템화 빼고 — OrderListPage.linkCandidates)
//   · EZ-TEX O/D NO.가 이 오더 order# 와 같은 설계서는 맨 위에 '번호 같음'
// - [연결] → 확인 창 → onLink(sheetId): 그 설계서에 이 오더 번호를 EZ-TEX O/D NO.로 [등록]
//   (개발/설계 현황 [등록]과 같은 함수 — 설계서는 '샘플 진행', 이 오더는 신제품 + 설계서 연결)
//   연결에 실패하면(onLink → false) 창은 그대로 — 다시 고르거나 다시 누를 수 있게 (2026-10-19 검토)
// - 고르는 칸만 있는 창이라 '저장할까요?'는 없음 (연결은 [연결] 누를 때 바로)
// props: order, candidates [{ sheet, devOrderNo, buyerName, stageLabel, sameNumber }], onLink(sheetId) => Promise<boolean>,
//        onCreate()(새 설계서 작성 — 없으면 버튼 숨김), onClose
// ============================================================

const sheetLabelOf = (c) => formatSheetLabel(c.sheet, { devOrderNo: c.devOrderNo, emptyName: '원단명 미입력' });

export const LinkSheetDialog = ({ order, candidates = [], onLink, onCreate, onClose }) => {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const busyRef = useRef(false); // 처리 중 잠금 — 빠르게 두 번 눌러도 한 번만
  const orderNo = String(order?.orderNumber || '').trim().toUpperCase();

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter(c => [
      c.devOrderNo, c.sheet?.fabricName, c.sheet?.eztexOrderNo, c.sheet?.articleNo, c.buyerName,
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [candidates, search]);

  const link = async (c) => {
    if (busyRef.current || !c?.sheet) return;
    const s = c.sheet;
    const prevNo = String(s.eztexOrderNo || '').trim().toUpperCase();
    const toSampling = ['draft', 'eztex', '', undefined].includes(s.stage);
    const ok = window.confirm(
      `설계서 '${sheetLabelOf(c)}'를 이 오더(${orderNo})와 연결할까요?\n\n`
      + `· 설계서 EZ-TEX O/D NO.가 ${orderNo}(으)로 저장돼요.${prevNo && prevNo !== orderNo ? ` (예전 번호 ${prevNo}는 지워져요)` : ''}\n`
      + (toSampling ? "· 설계서는 '샘플 진행'으로 넘어가요.\n" : '')
      + '· 개발/설계 현황 목록에서는 빠지고, 샘플은 생산 현황에서 진행해요 (끝 = 아이템화 또는 Drop).'
    );
    if (!ok) return;
    busyRef.current = true;
    setBusyId(s.id);
    let done = false;
    try {
      done = (await onLink?.(s.id)) !== false;
    } catch {
      done = false;
    } finally {
      busyRef.current = false;
      setBusyId('');
    }
    if (done) onClose?.();
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="작성 중인 설계서 연결"
      >
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" /> 작성 중인 설계서 연결
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 break-words">
              신제품 샘플 <span className="font-mono font-bold text-teal-700">{orderNo || '-'}</span>
              {order?.detail ? <> · {order.detail}</> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg shrink-0" title="닫기">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            아직 생산 현황에 올라오지 않은 설계서예요 (개발/설계 현황의 의뢰 · 자체개발 설계서). 고르면 이 오더 번호로 EZ-TEX [등록]과 같이 처리돼요.
          </p>
          {candidates.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="개발번호 · 원단명 · EZ-TEX · Article · 바이어 검색"
                className="w-full pl-8 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
              />
            </div>
          )}

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-6 px-4 text-center">
              <FileText className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-slate-500">연결할 수 있는 설계서가 없어요</div>
              <div className="text-[11px] text-slate-400 mt-0.5">새 설계서를 쓰거나, 개발/설계 현황에서 설계서를 먼저 만들어 주세요.</div>
            </div>
          ) : list.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400 py-4">'{search}' 검색 결과가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map(c => {
                const s = c.sheet;
                return (
                  <li
                    key={s.id}
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border ${c.sameNumber ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 break-words">
                        {sheetLabelOf(c)}
                        {c.sameNumber && (
                          <span className="ml-1.5 align-middle px-1.5 py-px rounded border text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border-indigo-300">
                            번호 같음
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                        {c.stageLabel && <span>단계 <b className="text-slate-700">{c.stageLabel}</b></span>}
                        {s.eztexOrderNo && <span>EZ-TEX <b className="font-mono text-violet-700">{s.eztexOrderNo}</b></span>}
                        {c.buyerName && <span>바이어 <b className="text-slate-700">{c.buyerName}</b></span>}
                        {s.articleNo && <span>Article <b className="font-mono text-slate-700">{s.articleNo}</b></span>}
                        {s.deadline && <span>납기 <b className="font-mono text-slate-700">{s.deadline}</b></span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => link(c)}
                      disabled={!!busyId}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <Link2 className="w-3 h-3" /> {busyId === s.id ? '연결 중…' : '연결'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {onCreate ? (
            <button
              type="button"
              onClick={() => { onClose?.(); onCreate(); }}
              disabled={!!busyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50"
            >
              <FilePlus2 className="w-3.5 h-3.5" /> 새 설계서 작성
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">닫기</button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default LinkSheetDialog;
