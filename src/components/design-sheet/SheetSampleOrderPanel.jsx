import React from 'react';
import { Factory, ExternalLink, Ruler } from 'lucide-react';
import { productionStateOf, sampleRowDeadline, daysBetween, qcActualOf, numOf } from '../../utils/devFlowModel';

// ============================================================
// 설계서 안 '샘플 오더 진행' 칸 (개발 고도화 3단계, 대표님 요청 2026-11-24)
//  · 생산 현황 샘플 오더가 있는 설계서: order# · 지금 상황(편직중 · 염색중 · 아이템화 대기 …) · 납기 D-day · [생산 현황 열기]
//  · 실측 vs 설계: 메인/QC 디테일 시트(이 설계서 EZ-TEX order# 또는 Article) 의 가공 GSM · 전폭을 설계 값(GSM · 외폭) 옆에
//    차이가 ±5% 넘으면 노랑 (견적서 '중량·폭 ±5% 오차 허용'과 같은 기준)
//  · 샘플 오더도 QC 기록도 없으면 안 보임
// ============================================================

const TOL = 5; // %
const diffPct = (actual, target) => (actual != null && target ? Math.round(((actual - target) / target) * 1000) / 10 : null);

const Diff = ({ actual, target, unit }) => {
  if (actual == null) return <span className="text-slate-300">-</span>;
  const p = diffPct(actual, target);
  const off = p != null && Math.abs(p) > TOL;
  return (
    <span className={`font-mono ${off ? 'text-amber-700 font-extrabold' : 'text-slate-800 font-bold'}`}
      title={target ? `설계 ${target}${unit} 대비 ${p > 0 ? '+' : ''}${p}%${off ? ' — ±5% 밖' : ''}` : '설계 값이 비어 있어요'}>
      {actual}{unit}
      {p != null && <span className={`ml-1 text-[9px] ${off ? '' : 'text-slate-400 font-normal'}`}>({p > 0 ? '+' : ''}{p}%)</span>}
    </span>
  );
};

//  labdipSummary: 이 설계서(또는 그 의뢰)로 의뢰한 L/D 요약 (labdipModel.labdipDevSummary — 2026-11-24)
export const SheetSampleOrderPanel = ({ sheet, order, qcDetails = [], onOpenProductionOrder, labdipSummary = null }) => {
  if (!sheet || (!order && qcDetails.length === 0 && !labdipSummary?.total)) return null;
  const state = productionStateOf(order, sheet);
  const deadline = order ? sampleRowDeadline({ order, sheet }) : null;
  const dday = deadline && order?.status !== 'completed' ? daysBetween(new Date(), deadline) : null;
  const ddayCls = dday == null ? '' : dday < 0 ? 'bg-red-500 text-white' : dday <= 3 ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-slate-100 text-slate-600 border border-slate-300';
  const targetGsm = numOf(sheet.costInput?.gsm);
  const targetWidth = numOf(sheet.costInput?.widthFull);
  const rows = qcDetails.slice(0, 8);

  return (
    <div className="mb-4 border border-amber-200 bg-amber-50/40 px-3 py-2 text-[11px] print:hidden">
      {order && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-amber-800 flex items-center gap-1"><Factory className="w-3.5 h-3.5" /> 생산 현황 샘플 오더</span>
          <span className="font-mono font-extrabold text-slate-800">{order.orderNumber}</span>
          {state && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${state.cls}`}>{state.label}</span>}
          {deadline && <span className="font-mono text-slate-600">납기 {deadline}</span>}
          {dday != null && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ddayCls}`}>{dday < 0 ? `D+${-dday} 지연` : dday === 0 ? 'Today' : `D-${dday}`}</span>}
          {(order.colors || []).length > 0 && <span className="text-slate-500">컬러 {(order.colors || []).length}개</span>}
          {onOpenProductionOrder && (
            <button type="button" onClick={() => onOpenProductionOrder(order.orderNumber)}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded shadow-sm"
              title="생산 현황에서 이 샘플 오더 보기 (진행 · 아이템화 · Drop)">
              <ExternalLink className="w-3 h-3" /> 생산 현황 열기
            </button>
          )}
        </div>
      )}
      {labdipSummary?.total > 0 && (
        <p className={`flex items-center gap-1.5 flex-wrap ${order ? 'mt-1.5' : ''}`}>
          <span className="font-bold text-fuchsia-700">L/D</span>
          <span className="text-slate-700 font-bold">{labdipSummary.label}</span>
          {labdipSummary.ldNos?.length > 0 && <span className="font-mono text-slate-400">{labdipSummary.ldNos.join(' · ')}</span>}
          <span className="text-[10px] text-slate-400">— 생산 ▾ LAB-DIP</span>
        </p>
      )}
      {rows.length > 0 && (
        <div className={order || labdipSummary?.total ? 'mt-2 pt-2 border-t border-amber-200' : ''}>
          <p className="font-bold text-slate-600 mb-1 flex items-center gap-1">
            <Ruler className="w-3 h-3" /> 실측 vs 설계 <span className="font-normal text-slate-400">— 메인/QC 디테일 시트 (설계 GSM {targetGsm ?? '-'} · 외폭 {targetWidth ?? '-'}", ±5% 넘으면 노랑)</span>
          </p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[10px] text-slate-500 border-b border-amber-200">
                <th className="text-left font-bold py-0.5 pr-2">컬러 · LOT</th>
                <th className="text-right font-bold py-0.5 px-2">가공 GSM</th>
                <th className="text-right font-bold py-0.5 px-2">가공 전폭</th>
                <th className="text-right font-bold py-0.5 pl-2">판정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const a = qcActualOf(d);
                return (
                  <tr key={d.id} className="border-b border-amber-100 last:border-0">
                    <td className="py-0.5 pr-2 font-bold text-slate-700">{[d.colorInfo, d.lotNo && `LOT ${d.lotNo}`].filter(Boolean).join(' · ') || d.orderNo || '-'}</td>
                    <td className="py-0.5 px-2 text-right"><Diff actual={a.gsm} target={targetGsm} unit="g" /></td>
                    <td className="py-0.5 px-2 text-right"><Diff actual={a.width} target={targetWidth} unit={'"'} /></td>
                    <td className="py-0.5 pl-2 text-right">
                      {a.status
                        ? <span className={`text-[10px] font-bold ${a.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'}`}>{a.status}{a.round > 1 ? ` (${a.round}차)` : ''}</span>
                        : <span className="text-slate-400">판정대기</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {qcDetails.length > rows.length && <p className="text-[10px] text-slate-400 mt-0.5">외 {qcDetails.length - rows.length}장 — [메인 디테일 연동 현황]에서 다 볼 수 있어요</p>}
        </div>
      )}
    </div>
  );
};
