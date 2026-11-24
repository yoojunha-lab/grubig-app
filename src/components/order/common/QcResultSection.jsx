import React from 'react';
import { Ruler } from 'lucide-react';
import { qcActualOf, numOf } from '../../../utils/devFlowModel';

// ============================================================
// 생산 현황 상세창 '메인/QC 결과' 칸 (개발 고도화 3단계, 대표님 요청 2026-11-24)
//  이 오더로 적힌 메인/QC 디테일 시트 — '생산 현황에서 고르기'로 이은 것(orderId) + Order No 글자가 같은 것
//  컬러 · LOT · 가공 GSM · 가공 전폭 · 폭축/장축 · 판정. 오더 스펙(GSM · 전폭)이 있으면 ±5% 넘는 값은 노랑
//  기록이 없으면 안 보임 (QC 작성은 개발 ▾ 메인/QC 디테일 시트)
// ============================================================

const sameNo = (a, b) => !!String(a || '').trim() && String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

/** 이 오더의 QC 시트 (최근 순) */
const qcDetailsOfOrder = (order, mainDetails = []) => (mainDetails || [])
  .filter(d => d && (d.orderId === order?.id || sameNo(d.orderNo, order?.orderNumber)))
  .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

const off = (v, target) => v != null && target ? Math.abs((v - target) / target) * 100 > 5 : false;

export const QcResultSection = ({ order, mainDetails = [] }) => {
  const list = qcDetailsOfOrder(order, mainDetails);
  if (!list.length) return null;
  const targetGsm = numOf(order?.gsm);
  const targetWidth = numOf(order?.widthFull);
  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
          <Ruler className="w-4 h-4 text-teal-600" />메인/QC 결과 <span className="text-[11px] font-bold text-slate-400">{list.length}장</span>
        </h4>
        <span className="text-[10px] text-slate-400">개발 ▾ 메인/QC 디테일 시트에서 적은 것{targetGsm || targetWidth ? ' · 오더 스펙 ±5% 넘으면 노랑' : ''}</span>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs min-w-[460px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] text-slate-500">
              <th className="text-left font-bold px-2 py-1">컬러 · LOT</th>
              <th className="text-right font-bold px-2 py-1">가공 GSM</th>
              <th className="text-right font-bold px-2 py-1">가공 전폭</th>
              <th className="text-right font-bold px-2 py-1">폭축 / 장축</th>
              <th className="text-right font-bold px-2 py-1">판정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(d => {
              const a = qcActualOf(d);
              const tests = d.tests || [];
              const last = tests[tests.length - 1] || {};
              return (
                <tr key={d.id}>
                  <td className="px-2 py-1 font-bold text-slate-700">{[d.colorInfo, d.lotNo && `LOT ${d.lotNo}`].filter(Boolean).join(' · ') || '-'}</td>
                  <td className={`px-2 py-1 text-right font-mono ${off(a.gsm, targetGsm) ? 'text-amber-700 font-extrabold' : 'text-slate-800'}`}>{a.gsm ?? '-'}</td>
                  <td className={`px-2 py-1 text-right font-mono ${off(a.width, targetWidth) ? 'text-amber-700 font-extrabold' : 'text-slate-800'}`}>{a.width ?? '-'}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-600">{[last.shrinkWidth, last.shrinkLength].map(x => x || '-').join(' / ')}</td>
                  <td className="px-2 py-1 text-right">
                    {a.status
                      ? <span className={`text-[10px] font-bold ${a.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'}`}>{a.status}{a.round > 1 ? ` (${a.round}차)` : ''}</span>
                      : <span className="text-[10px] text-slate-400">판정대기</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
