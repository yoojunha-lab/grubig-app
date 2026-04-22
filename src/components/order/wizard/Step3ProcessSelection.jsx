import React from 'react';
import { Workflow, AlertCircle, Info } from 'lucide-react';
import { PROCESS_TYPES, ASSIGNEE_ROLES } from '../../../constants/production';

export const Step3ProcessSelection = ({
  orderInput,
  toggleProcess,
  updateProcessField,
}) => {
  const processes = orderInput.processes || [];

  // 메타 조회
  const getMeta = (key) => PROCESS_TYPES.find(p => p.key === key);
  const roleLabel = (key) => ASSIGNEE_ROLES.find(r => r.key === key)?.label || '-';

  // 검증: 편직 공정 활성 여부
  const knittingActive = processes.some(p => p.processType === 'knitting' && p.isActive);

  // 원사 공정 강제 비활성 여부 (편직처 보유 원사 옵션)
  const yarnForcedInactive = !!orderInput.useKnitterStockYarn;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Workflow className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800">활성 공정 선택</h3>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
        <div className="flex items-start gap-2 text-xs text-blue-700">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            이 오더에서 관리할 공정을 선택해주세요. 오더 타입({orderInput.type === 'main' ? '메인' : '샘플'})과
            염색 방식({orderInput.dyeingMethod === 'yarn_dyed' ? '선염' : '후염'})에 따라 기본값이 자동 체크되어 있습니다.
            필요에 따라 조정할 수 있습니다.
          </div>
        </div>
        {yarnForcedInactive && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>편직처 보유 원사 사용이 체크되어 있어 <b>원사 공정</b>은 비활성 상태로 고정됩니다.</div>
          </div>
        )}
      </div>

      {/* 경고: 편직 공정 미활성 */}
      {!knittingActive && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div><b>편직 공정</b>은 최소 1개 활성화되어야 합니다.</div>
        </div>
      )}

      {/* 공정 리스트 */}
      <div className="space-y-2">
        {processes
          .slice()
          .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0))
          .map(p => {
            const meta = getMeta(p.processType);
            const isForced = p.processType === 'yarn' && yarnForcedInactive;
            return (
              <div
                key={p.processType}
                className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${
                  p.isActive ? 'bg-teal-50 border-teal-300' : 'bg-white border-slate-200'
                } ${p.isParallelTrack ? 'border-l-4 border-l-violet-400' : ''}`}
              >
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={!!p.isActive}
                  onChange={e => toggleProcess(p.processType, e.target.checked)}
                  disabled={isForced}
                  className="w-5 h-5 accent-teal-600 disabled:opacity-40"
                />

                {/* 공정 정보 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-800">{meta?.label || p.processType}</span>
                    {p.isParallelTrack && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                        병렬 트랙
                      </span>
                    )}
                    {isForced && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                        자동 비활성
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    담당: {roleLabel(p.assigneeRole)}
                  </div>
                </div>

                {/* 순서 입력 */}
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500">순서</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={p.sequenceOrder || 1}
                    onChange={e => updateProcessField(p.processType, 'sequenceOrder', Number(e.target.value) || 1)}
                    className="w-14 border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
