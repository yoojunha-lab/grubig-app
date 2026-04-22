import React from 'react';
import { FileCheck, AlertCircle, Check, Users, Calendar, Package } from 'lucide-react';
import { PROCESS_TYPES } from '../../../constants/production';
import { calcEstimatedDueDate, diffDaysYmd, getOrderHealth, getHealthColorClass } from '../../../utils/orderCalculations';

export const Step6Review = ({
  orderInput,
  productionAssignees = {},
  yarnLibrary = [],
}) => {
  const estimatedDueDate = calcEstimatedDueDate(orderInput);
  const previewOrder = { ...orderInput, estimatedDueDate };
  const health = getOrderHealth(previewOrder);
  const colors = getHealthColorClass(health);

  const deltaDays = (estimatedDueDate && orderInput.finalDueDate)
    ? diffDaysYmd(estimatedDueDate, orderInput.finalDueDate)
    : null;

  const activeProcesses = (orderInput.processes || [])
    .filter(p => p.isActive)
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);

  const findYarnName = (id) => {
    const y = (yarnLibrary || []).find(y => y.id === id);
    return y?.name || '(사종 미지정)';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <FileCheck className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800">최종 검토 및 확정</h3>
      </div>

      {/* 납기 건강도 배너 */}
      <div className={`rounded-xl border-2 p-4 ${colors.bg} ${colors.border}`}>
        <div className="flex items-start gap-3">
          <div className={`w-3 h-3 rounded-full ${colors.dot} mt-1.5 shrink-0`}></div>
          <div className="flex-1">
            <div className={`text-sm font-bold ${colors.text} mb-1`}>
              {health === 'red' && '🚨 납기 초과 위험'}
              {health === 'amber' && '⚠️ 납기 주의'}
              {health === 'green' && '✅ 정상 (납기 여유 확보)'}
              {health === 'slate' && '정보 부족'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500">최종 납기</span>
                <div className="font-mono font-bold text-slate-800">{orderInput.finalDueDate || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500">예상 납기 (자동)</span>
                <div className={`font-mono font-bold ${colors.text}`}>{estimatedDueDate || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500">여유 / 초과</span>
                <div className={`font-mono font-bold ${colors.text}`}>
                  {deltaDays !== null ? (deltaDays >= 0 ? `+${deltaDays}일 여유` : `${Math.abs(deltaDays)}일 초과`) : '-'}
                </div>
              </div>
            </div>
            {health === 'red' && (
              <div className="mt-2 text-xs text-red-700 font-medium">
                ※ 예상 납기가 최종 납기를 초과하므로 저장 시 상태가 자동으로 <b>납기위험</b>으로 설정됩니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 기본 정보 요약 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-bold text-slate-700">기본 정보</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div><span className="text-slate-500 font-bold">오더명:</span> <span className="ml-2">{orderInput.orderName}</span></div>
          <div><span className="text-slate-500 font-bold">고객:</span> <span className="ml-2">{orderInput.customer}</span> {orderInput.brand && <span className="text-slate-400 ml-1">/ {orderInput.brand}</span>}</div>
          <div><span className="text-slate-500 font-bold">타입:</span> <span className="ml-2">{orderInput.type === 'main' ? '메인' : '샘플'}</span></div>
          <div><span className="text-slate-500 font-bold">염색방식:</span> <span className="ml-2">{orderInput.dyeingMethod === 'yarn_dyed' ? '선염' : '후염'}</span></div>
          <div><span className="text-slate-500 font-bold">총 수량:</span> <span className="ml-2 font-mono">{Number(orderInput.totalQuantity || 0).toLocaleString()} {orderInput.unit}</span></div>
          <div><span className="text-slate-500 font-bold">편직처 보유 원사:</span> <span className="ml-2">{orderInput.useKnitterStockYarn ? '사용' : '미사용'}</span></div>
        </div>
      </div>

      {/* 컬러 요약 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">컬러 ({(orderInput.colors || []).length}종)</h4>
        <div className="flex flex-wrap gap-1.5">
          {(orderInput.colors || []).map(c => (
            <span key={c.name} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700">
              {c.name} <span className="font-mono text-slate-500">{c.quantity}{orderInput.unit}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 담당자 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-bold text-slate-700">담당자 (자동 배정)</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-bold">원사:</span>
            <div className="mt-0.5">{productionAssignees?.yarnAssignee?.name || <span className="text-amber-600">미설정</span>}</div>
          </div>
          <div>
            <span className="text-slate-500 font-bold">편직:</span>
            <div className="mt-0.5">{productionAssignees?.knittingAssignee?.name || <span className="text-amber-600">미설정</span>}</div>
          </div>
          <div>
            <span className="text-slate-500 font-bold">그외:</span>
            <div className="mt-0.5">{productionAssignees?.othersAssignee?.name || <span className="text-amber-600">미설정</span>}</div>
          </div>
        </div>
        {(!productionAssignees?.yarnAssignee?.name || !productionAssignees?.knittingAssignee?.name || !productionAssignees?.othersAssignee?.name) && (
          <div className="mt-2 text-[11px] text-amber-600 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            담당자 마스터가 일부 미설정 상태입니다. 오더는 등록되지만 Firestore의 <code className="bg-amber-100 px-1 rounded">settings/general.productionAssignees</code>에 값을 넣어주세요.
          </div>
        )}
      </div>

      {/* 활성 공정 요약 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-bold text-slate-700">활성 공정 ({activeProcesses.length}개)</h4>
        </div>
        <div className="space-y-2">
          {activeProcesses.map(p => {
            const meta = getMeta(p.processType);
            return (
              <div key={p.processType} className="bg-white border border-slate-200 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">
                    {p.sequenceOrder}. {meta?.label}
                    {p.isParallelTrack && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">병렬</span>}
                  </span>
                </div>
                {p.processType === 'yarn' && (
                  <div className="text-[11px] text-slate-500">
                    발주 {(p.yarnOrders || []).length}건 / 입고 {(p.yarnOrders || []).reduce((s, yo) => s + (yo.deliveries || []).length, 0)}차수
                    {(p.yarnOrders || []).slice(0, 3).map((yo, i) => (
                      <div key={yo.id} className="ml-2">• {findYarnName(yo.yarnTypeId)}{yo.color ? ` / ${yo.color}` : ''} {yo.totalQuantity}kg</div>
                    ))}
                  </div>
                )}
                {p.processType === 'yarn_processing' && (
                  <div className="text-[11px] text-slate-500">
                    가공유형: {p.processingType} / 차수 {(p.batches || []).length}건
                  </div>
                )}
                {p.processType === 'lab_dip' && (
                  <div className="text-[11px] text-slate-500">병렬 트랙 (주 납기 계산 제외)</div>
                )}
                {p.processType === 'knitting' && (
                  <div className="text-[11px] text-slate-500">
                    차수 {(p.batches || []).length}건
                  </div>
                )}
                {p.processType === 'dyeing' && (
                  <div className="text-[11px] text-slate-500">
                    염색+가공: {p.processingDays}일 / 브랜드 컨펌: {p.brandConfirmBufferDays}일 / 차수 {(p.batches || []).length}건
                  </div>
                )}
                {(p.processType === 'visual_inspection' || p.processType === 'physical_test') && (
                  <div className="text-[11px] text-slate-500">자동 생성 검사 공정</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-800 flex items-start gap-2">
        <Check className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          확인이 완료되었으면 하단의 <b>[오더 최종 등록]</b> 버튼을 눌러 Firestore에 저장하세요.
          저장 시 오더번호(O-YYM###)가 자동 발번되고, 담당자 정보가 스냅샷으로 복사됩니다.
        </div>
      </div>
    </div>
  );
};
