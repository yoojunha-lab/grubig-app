import React from 'react';
import { fieldLabel } from './constants';
import { historyValueText } from '../../utils/sheetHistory';

// ============================================================
// 설계서 변경 이력 한 줄 — '칸 이름: 옛 값 → 새 값' (개발 고도화 3단계 2026-11-24)
//  · 칸 이름은 한국어 (constants.fieldLabel — 예전 설계서 창은 'costInput.gsm' 같은 영어 키가 보였음)
//  · 새 값은 2026-11-24부터 저장된 이력에만 (entry.to). 그 전 이력은 '바뀜'
//  설계서 창 · 설계서 보관함 표 · 모바일 카드가 같이 씀
// ============================================================

export const HistoryFieldLine = ({ fieldKey, oldValue, entry, size = 'sm' }) => {
  const hasTo = !!entry?.to && Object.prototype.hasOwnProperty.call(entry.to, fieldKey);
  const text = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  return (
    <div className={`flex flex-wrap items-baseline gap-1 ${text}`}>
      <span className="font-bold text-slate-500 shrink-0">{fieldLabel(fieldKey)}:</span>
      <span className="text-red-400 line-through break-all">{historyValueText(fieldKey, oldValue)}</span>
      <span className="text-slate-300">→</span>
      {hasTo
        ? <span className="text-emerald-700 font-bold break-all">{historyValueText(fieldKey, entry.to[fieldKey])}</span>
        : <span className="text-emerald-600">바뀜</span>}
    </div>
  );
};

/** 이력 머리 — 날짜 · 누가 (by 는 2026-11-24부터) */
export const HistoryWho = ({ entry }) => (entry?.by
  ? <span className="ml-1 font-normal text-slate-400">· {String(entry.by).split('@')[0]}</span>
  : null);
