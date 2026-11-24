import React from 'react';
import { Ruler } from 'lucide-react';
import { qcDetailsFor, numOf } from '../../../utils/devFlowModel';
import { QcResultTable } from '../../main-detail/QcResultTable';

// ============================================================
// 생산 현황 상세창 '메인/QC 결과' 칸 (개발 고도화 3단계, 대표님 요청 2026-11-24)
//  이 오더로 적힌 메인/QC 디테일 시트 — '생산 현황에서 고르기'로 이은 것(orderId)은 그 오더에만, 예전 시트는 Order No 글자로
//  (devFlowModel.qcDetailsFor — 설계서 칸과 같은 규칙). 오더 스펙(GSM · 전폭)이 있으면 ±5% 넘는 값은 노랑
//  기록이 없으면 안 보임 (QC 작성은 개발 ▾ 메인/QC 디테일 시트)
// ============================================================

export const QcResultSection = ({ order, mainDetails = [] }) => {
  const list = qcDetailsFor(mainDetails, { orderId: order?.id, orderNo: order?.orderNumber });
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
        <div className="min-w-[460px]">
          <QcResultTable details={list} targetGsm={targetGsm} targetWidth={targetWidth} showShrink showPct={false} />
        </div>
      </div>
    </section>
  );
};
