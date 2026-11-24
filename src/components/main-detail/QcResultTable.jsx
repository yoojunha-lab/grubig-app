import React from 'react';
import { qcActualOf, specDiffPct, isOffSpec } from '../../utils/devFlowModel';

// ============================================================
// 메인/QC 결과 표 — 설계서 '실측 vs 설계' 칸 · 생산 현황 상세창 '메인/QC 결과' 공용 (리팩토링 2026-11-24 — 두 곳이 따로 만들었음)
//  줄: 컬러 · LOT / 가공 GSM / 가공 전폭 / (폭축 · 장축) / 판정 — 목표(GSM · 전폭)가 있으면 ±5% 넘는 값은 노랑
//  details: 메인/QC 시트 목록 (devFlowModel.qcDetailsFor) · targetGsm · targetWidth: 목표 · max: 보여 줄 줄 수
// ============================================================

const Value = ({ actual, target, unit, showPct }) => {
  if (actual == null) return <span className="text-slate-300">-</span>;
  const p = specDiffPct(actual, target);
  const off = isOffSpec(actual, target);
  return (
    <span className={`font-mono ${off ? 'text-amber-700 font-extrabold' : 'text-slate-800 font-bold'}`}
      title={target ? `목표 ${target}${unit} 대비 ${p > 0 ? '+' : ''}${p}%${off ? ' — ±5% 밖' : ''}` : '목표 값이 비어 있어요'}>
      {actual}{unit}
      {showPct && p != null && <span className={`ml-1 text-[9px] ${off ? '' : 'text-slate-400 font-normal'}`}>({p > 0 ? '+' : ''}{p}%)</span>}
    </span>
  );
};

export const QcResultTable = ({ details = [], targetGsm = null, targetWidth = null, max = 0, showShrink = false, showPct = true, size = 'sm' }) => {
  const rows = max > 0 ? details.slice(0, max) : details;
  const text = size === 'xs' ? 'text-[11px]' : 'text-xs';
  return (
    <>
      <table className={`w-full ${text}`}>
        <thead>
          <tr className="text-[10px] text-slate-500 border-b border-slate-200">
            <th className="text-left font-bold py-0.5 px-2">컬러 · LOT</th>
            <th className="text-right font-bold py-0.5 px-2">가공 GSM</th>
            <th className="text-right font-bold py-0.5 px-2">가공 전폭</th>
            {showShrink && <th className="text-right font-bold py-0.5 px-2">폭축 / 장축</th>}
            <th className="text-right font-bold py-0.5 px-2">판정</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(d => {
            const a = qcActualOf(d);
            const tests = d.tests || [];
            const last = tests[tests.length - 1] || {};
            return (
              <tr key={d.id}>
                <td className="py-0.5 px-2 font-bold text-slate-700">{[d.colorInfo, d.lotNo && `LOT ${d.lotNo}`].filter(Boolean).join(' · ') || d.orderNo || '-'}</td>
                <td className="py-0.5 px-2 text-right"><Value actual={a.gsm} target={targetGsm} unit="g" showPct={showPct} /></td>
                <td className="py-0.5 px-2 text-right"><Value actual={a.width} target={targetWidth} unit={'"'} showPct={showPct} /></td>
                {showShrink && <td className="py-0.5 px-2 text-right font-mono text-slate-600">{[last.shrinkWidth, last.shrinkLength].map(x => x || '-').join(' / ')}</td>}
                <td className="py-0.5 px-2 text-right">
                  {a.status
                    ? <span className={`text-[10px] font-bold ${a.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'}`}>{a.status}{a.round > 1 ? ` (${a.round}차)` : ''}</span>
                    : <span className="text-[10px] text-slate-400">판정대기</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {details.length > rows.length && <p className="text-[10px] text-slate-400 mt-0.5">외 {details.length - rows.length}장 — [메인 디테일 연동 현황]에서 다 볼 수 있어요</p>}
    </>
  );
};
