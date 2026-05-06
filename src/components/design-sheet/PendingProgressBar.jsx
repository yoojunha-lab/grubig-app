import React from 'react';
import { UNIFIED_PENDING_STAGES } from '../../constants/common';

/**
 * 대기중 목록의 통합 진행 단계 미니바
 * 의뢰 단계(pending/analyzing/hold) + 설계서 단계(draft/eztex/sampling)를
 * 하나의 6칸 진행바로 시각화한다.
 *
 * @param {string} stageKey - 현재 단계 key (UNIFIED_PENDING_STAGES 의 key 중 하나)
 */
export const PendingProgressBar = ({ stageKey }) => {
  const stages = UNIFIED_PENDING_STAGES;
  const currentIndex = stages.findIndex(s => s.key === stageKey);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const current = stages[safeIndex];

  // 의뢰 단계는 보라톤, 설계서 단계는 인디고톤
  const filledColor = (idx) => {
    const src = stages[idx]?.source;
    if (idx > safeIndex) return 'bg-slate-200';
    return src === 'devRequest' ? 'bg-purple-500' : 'bg-indigo-500';
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex gap-0.5 shrink-0">
        {stages.map((s, idx) => (
          <div
            key={s.key}
            title={s.label}
            className={`w-3 h-1.5 rounded-sm transition-colors ${filledColor(idx)}`}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
        {current.label}
        <span className="text-slate-400 font-normal ml-1">({safeIndex + 1}/{stages.length})</span>
      </span>
    </div>
  );
};
