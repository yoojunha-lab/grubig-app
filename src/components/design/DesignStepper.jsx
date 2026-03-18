import React from 'react';
import { Edit2, Check, Database, Factory, Award } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS } from '../../constants/common';

// 아이콘 매핑 (lucide-react 컴포넌트)
const ICON_MAP = {
  Edit2: Edit2,
  Check: Check,
  Database: Database,
  Factory: Factory,
  Award: Award
};

/**
 * 원단 설계서 5단계 진행 스텝퍼 UI
 * - 현재 단계를 시각적으로 표시하고, 완료된 단계와 미진행 단계를 구분
 */
export const DesignStepper = ({ currentStage, onAdvance }) => {
  const currentIdx = DESIGN_STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="w-full">
      {/* 데스크톱: 가로 스텝퍼 */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* 배경 연결 라인 */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 z-0 transition-all duration-500"
          style={{ width: currentIdx >= 0 ? `${(currentIdx / (DESIGN_STAGES.length - 1)) * 100}%` : '0%' }}
        />

        {DESIGN_STAGES.map((stage, idx) => {
          const IconComp = ICON_MAP[stage.icon] || Edit2;
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;
          const colors = STAGE_COLORS[stage.key] || STAGE_COLORS.draft;

          return (
            <div key={stage.key} className="flex flex-col items-center z-10 relative">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                  : isCurrent
                    ? `${colors.bg} ${colors.border} ${colors.text} shadow-md ring-2 ring-offset-2 ring-blue-200`
                    : 'bg-white border-slate-300 text-slate-400'
                }
              `}>
                {isCompleted ? <Check className="w-5 h-5" /> : <IconComp className="w-4 h-4" />}
              </div>
              <span className={`
                text-xs font-bold mt-2 whitespace-nowrap
                ${isCurrent ? colors.text : isCompleted ? 'text-emerald-600' : 'text-slate-400'}
              `}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 모바일: 간소화된 배지 형태 */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2">
        {DESIGN_STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const colors = STAGE_COLORS[stage.key] || STAGE_COLORS.draft;

          return (
            <span
              key={stage.key}
              className={`
                shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                ${isCompleted
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : isCurrent
                    ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-offset-1 ring-blue-200`
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }
              `}
            >
              {isCompleted ? '✓ ' : ''}{stage.label}
            </span>
          );
        })}
      </div>

      {/* 다음 단계 버튼 */}
      {onAdvance && currentIdx < DESIGN_STAGES.length - 1 && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onAdvance}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            다음 단계: {DESIGN_STAGES[currentIdx + 1]?.label} →
          </button>
        </div>
      )}
    </div>
  );
};
