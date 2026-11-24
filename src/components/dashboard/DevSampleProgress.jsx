import React from 'react';
import { PackageCheck, FileText, Edit2, ExternalLink, Factory } from 'lucide-react';

// ============================================================
// 개발/설계 현황 — '샘플 진행 (생산 현황)' 표 (개발 고도화 2026-11-24)
//  EZ-TEX 를 등록해 생산 현황 샘플 오더로 넘어간 개발 건 — 예전엔 등록하는 순간 이 화면에서 사라져서
//  납기 · 지연이 개발 메뉴에서 안 보였음. 진행 · 아이템화 · Drop 은 그대로 생산 현황에서 (여기는 보기 + 바로 가기)
//  한 줄 = { key, dev, sheet, order, linkedDev, state, deadline, urgency, sampleDays, replyWait }
//   state: utils/devFlowModel.productionStateOf (편직중 · 염색중 · 완료 · 아이템화 대기 …)
//  빠지는 것: 아이템화(→ 보관함 '아이템화 완료') · Drop(→ 보관함 'Drop된 의뢰')
// ============================================================

const ROW_BG = {
  overdue: 'bg-rose-50/40 border-l-4 border-l-rose-500',
  urgent: 'border-l-4 border-l-orange-400',
  normal: '',
};

const Buyer = ({ row }) => {
  const buyer = row.dev?.buyerName || row.linkedDev?.buyerName || '';
  return (
    <>
      {buyer
        ? <span className="truncate">{buyer}</span>
        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>}
      {row.dev?.assignee && <span className="block text-[9px] font-normal text-slate-400 truncate">담당 {row.dev.assignee}</span>}
    </>
  );
};

const StateChip = ({ state }) => (state
  ? <span className={`inline-block w-fit text-[10px] font-bold px-1.5 py-0.5 rounded border ${state.cls}`} title="생산 현황 샘플 오더의 지금 상황">{state.label}</span>
  : <span className="text-[10px] text-slate-400">-</span>);

export const DevSampleProgress = ({
  rows = [],
  deadlineBadge,          // (날짜) => { t, c } | null — 개발 의뢰 현황 표와 같은 D-day 배지
  onOpenProductionOrder,  // (order#) => 생산 현황으로 가서 그 오더 보기
  onOpenSheet,            // (설계서) => 설계서 창
  onEditDev,              // (의뢰) => 의뢰 수정 창
}) => {
  if (!rows.length) return null;
  const openOrder = (row) => row.order?.orderNumber && onOpenProductionOrder?.(row.order.orderNumber);
  const odNo = (row) => String(row.dev?.devOrderNo || row.sheet?.devOrderNo || '').trim();
  const title = (row) => row.dev?.devItem || row.sheet?.fabricName || '원단명 미입력';
  const sheetName = (row) => (row.dev && String(row.sheet?.fabricName || '').trim() !== String(title(row)).trim() ? row.sheet?.fabricName : '');

  return (
    <div id="dev-sample-progress" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Factory className="w-4 h-4 text-amber-600" />
          샘플 진행 (생산 현황)
          <span className="text-[11px] font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{rows.length}건</span>
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">EZ-TEX를 등록해 생산 현황에서 진행 중인 샘플이에요. 진행 · 아이템화 · Drop은 생산 현황에서 해요 — 아이템화되면 여기서 빠져요.</p>
      </div>

      {/* PC 표 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-100/70 text-[10px] font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
              <th className="px-2 py-1.5 border-r border-slate-200 w-[120px]">O/D No. · EZ-TEX</th>
              <th className="px-2 py-1.5 border-r border-slate-200 w-[130px]">바이어</th>
              <th className="px-2 py-1.5 border-r border-slate-200">품목명 · 설계서</th>
              <th className="px-2 py-1.5 border-r border-slate-200 w-[170px]">생산 상황</th>
              <th className="px-2 py-1.5 border-r border-slate-200 w-[115px]">납기</th>
              <th className="px-2 py-1.5 w-[300px] text-right">바로 가기</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const db = !row.done && row.deadline && deadlineBadge ? deadlineBadge(row.deadline) : null;
              return (
                <tr key={row.key} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${ROW_BG[row.urgency] || ''}`}>
                  <td className="px-2 py-1.5 border-r border-slate-100 text-[11px] font-mono">
                    <div className="font-extrabold text-violet-700">{odNo(row) || <span className="text-slate-500">자체</span>}</div>
                    {row.order?.orderNumber && <div className="text-[10px] font-bold text-slate-500">{row.order.orderNumber}</div>}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-100 text-[11px] font-bold text-slate-700 max-w-[130px]"><Buyer row={row} /></td>
                  <td className="px-2 py-1.5 border-r border-slate-100 text-xs font-bold text-slate-800">
                    <div className="truncate">{title(row)}</div>
                    {row.labdip?.total > 0 && (
                      <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" title="이 개발 건으로 의뢰한 L/D">L/D {row.labdip.label}</span>
                    )}
                    {sheetName(row) && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 min-w-0">
                        <FileText className="w-3 h-3 shrink-0" /><span className="truncate">{sheetName(row)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-100">
                    <div className="flex flex-col gap-0.5">
                      <StateChip state={row.state} />
                      {row.sampleDays != null && <span className="text-[9px] text-slate-400">샘플 진행 {row.sampleDays === 0 ? '오늘부터' : `${row.sampleDays}일째`}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-100 text-xs">
                    {row.deadline ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-slate-700">{row.deadline}</span>
                        {db && <span className={`inline-block w-fit text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                      </div>
                    ) : <span className="text-slate-400" title="생산 현황 오더 · 설계서 · 의뢰 어디에도 납기가 없어요">납기 없음</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end flex-wrap items-center">
                      {row.order?.orderNumber && onOpenProductionOrder && (
                        <button onClick={() => openOrder(row)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded shadow-sm"
                          title={`생산 현황에서 샘플 오더 ${row.order.orderNumber} 보기 (진행 · 아이템화 · Drop)`}>
                          <ExternalLink className="w-3 h-3" /> 생산 현황 열기
                        </button>
                      )}
                      {onOpenSheet && (
                        <button onClick={() => onOpenSheet(row.sheet)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded border border-indigo-200"
                          title="설계서 열기 (보기 · 수정)">
                          <FileText className="w-3 h-3" /> 설계서 열기
                        </button>
                      )}
                      {row.dev && onEditDev && (
                        <button onClick={() => onEditDev(row.dev)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200"
                          title="의뢰 수정 — 샘플 납기 · 바이어를 바꾸면 설계서 · 샘플 오더도 바꿀지 물어봐요">
                          <Edit2 className="w-3 h-3" /> 의뢰 수정
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="block md:hidden p-3 space-y-2 bg-slate-50">
        {rows.map(row => {
          const db = !row.done && row.deadline && deadlineBadge ? deadlineBadge(row.deadline) : null;
          return (
            <div key={row.key} className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm ${ROW_BG[row.urgency] || ''}`}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 inline-flex items-center gap-1">
                  <PackageCheck className="w-3 h-3" /> 샘플 진행
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500">{row.order?.orderNumber || ''}</span>
              </div>
              <p className="text-xs font-mono font-extrabold text-violet-700 mb-0.5">{odNo(row) || '자체'}</p>
              <p className="text-sm font-bold text-slate-800 mb-0.5">{title(row)}</p>
              {sheetName(row) && <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 mb-0.5"><FileText className="w-3 h-3 shrink-0" /> {sheetName(row)}</p>}
              <p className="text-[11px] text-slate-500 mb-2"><Buyer row={row} /></p>
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <StateChip state={row.state} />
                {row.deadline && <span className="text-[10px] font-mono font-bold text-slate-600">{row.deadline}</span>}
                {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.order?.orderNumber && onOpenProductionOrder && (
                  <button onClick={() => openOrder(row)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded">
                    <ExternalLink className="w-3 h-3" /> 생산 현황 열기
                  </button>
                )}
                {onOpenSheet && (
                  <button onClick={() => onOpenSheet(row.sheet)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded border border-indigo-200">
                    <FileText className="w-3 h-3" /> 설계서 열기
                  </button>
                )}
                {row.dev && onEditDev && (
                  <button onClick={() => onEditDev(row.dev)} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded border border-blue-200">
                    <Edit2 className="w-3 h-3" /> 의뢰 수정
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
