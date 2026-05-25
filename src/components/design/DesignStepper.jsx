import React from 'react';
import { Edit2, Check, Database, Factory, Award } from 'lucide-react';
import { DESIGN_STAGES, STAGE_COLORS } from '../../constants/common';

const ICON_MAP = {
  Edit2: Edit2,
  Check: Check,
  Database: Database,
  Factory: Factory,
  Award: Award
};

export const DesignStepper = ({ currentStage, onStageClick }) => {
  const currentIdx = DESIGN_STAGES.findIndex(s => s.key === currentStage);
  const clickable = typeof onStageClick === 'function';

  return (
    <div className="w-full">
      {/* 데스크톱: 가로 스텝퍼 */}
      <div className="hidden md:flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 z-0 transition-all duration-500"
          style={{ width: currentIdx >= 0 ? `${(currentIdx / (DESIGN_STAGES.length - 1)) * 100}%` : '0%' }}
        />

        {DESIGN_STAGES.map((stage, idx) => {
          const IconComp = ICON_MAP[stage.icon] || Edit2;
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const colors = STAGE_COLORS[stage.key] || STAGE_COLORS.draft;

          const circleClass = `
            w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
            ${isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
              : isCurrent
                ? `${colors.bg} ${colors.border} ${colors.text} shadow-md ring-2 ring-offset-2 ring-blue-200`
                : 'bg-white border-slate-300 text-slate-400'
            }
            ${clickable ? 'cursor-pointer hover:scale-110 hover:shadow-lg active:scale-95' : ''}
          `;
          const labelClass = `
            text-xs font-bold mt-2 whitespace-nowrap
            ${isCurrent ? colors.text : isCompleted ? 'text-emerald-600' : 'text-slate-400'}
          `;

          const inner = (
            <>
              <div className={circleClass}>
                {isCompleted ? <Check className="w-5 h-5" /> : <IconComp className="w-4 h-4" />}
              </div>
              <span className={labelClass}>{stage.label}</span>
            </>
          );

          return clickable ? (
            <button
              key={stage.key}
              type="button"
              onClick={() => onStageClick(stage.key)}
              className="flex flex-col items-center z-10 relative bg-transparent border-0 p-0"
              title={`'${stage.label}' 단계로 이동`}
            >
              {inner}
            </button>
          ) : (
            <div key={stage.key} className="flex flex-col items-center z-10 relative">
              {inner}
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

          const badgeClass = `
            shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
            ${isCompleted
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : isCurrent
                ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-offset-1 ring-blue-200`
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }
            ${clickable ? 'cursor-pointer active:scale-95' : ''}
          `;
          const label = `${isCompleted ? '✓ ' : ''}${stage.label}`;

          return clickable ? (
            <button
              key={stage.key}
              type="button"
              onClick={() => onStageClick(stage.key)}
              className={badgeClass}
            >
              {label}
            </button>
          ) : (
            <span key={stage.key} className={badgeClass}>
              {label}
            </span>
          );
        })}
      </div>

      {clickable && (
        <p className="mt-2 text-[10px] text-slate-400 text-center">
          💡 단계를 클릭하면 해당 단계로 이동합니다.
        </p>
      )}
    </div>
  );
};
