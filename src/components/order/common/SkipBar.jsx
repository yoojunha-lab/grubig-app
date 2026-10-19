import React from 'react';
import { Ban, RotateCcw } from 'lucide-react';

// ============================================================
// '안 함' 줄 — 컨펌 · 성적서 / 외관검사 입력 창 맨 위 (대표님 요청 2026-10-19 '진행 안 해도 되는 버튼')
// ------------------------------------------------------------
// - 진행 중: [이 오더는 {label} 안 함] — 누르면 오더 전체(모든 컬러) '안 함'으로 바로 저장 (창은 부른 쪽이 닫음)
// - 안 함: '이 오더는 {label} 안 함' + [다시 진행] — 누르면 바로 저장, 창은 그대로 (이어서 입력)
//   넣어 둔 기록은 지우지 않고 남겨 둠 (recordCount — 다시 진행하면 그대로 보임)
// props: label, skipped, recordCount, busy, onSkip(), onResume()
// ============================================================

export const SkipBar = ({ label, skipped, recordCount = 0, busy = false, onSkip, onResume }) => {
  if (skipped) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 space-y-2">
        <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
          <Ban className="w-4 h-4 text-slate-500" /> 이 오더는 {label} 안 함 (모든 컬러)
        </p>
        <p className="text-[11px] text-slate-500 leading-snug">
          진행 계산 · 가납기 · 남은 일 · 간트에서 빠져요.
          {recordCount > 0 ? ` 넣어 둔 기록 ${recordCount}줄은 그대로 남아 있어요.` : ''}
        </p>
        {onResume && (
          <button
            type="button"
            onClick={onResume}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-300 bg-white text-[11px] font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-wait"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {busy ? '바꾸는 중…' : '다시 진행'}
          </button>
        )}
      </div>
    );
  }
  if (!onSkip) return null;
  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        title={`이 오더는 ${label} 안 함 — 모든 컬러 칸이 회색 '안 함' (칸을 다시 누르면 [다시 진행])`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait"
      >
        <Ban className="w-3.5 h-3.5" /> 이 오더는 {label} 안 함
      </button>
    </div>
  );
};

export default SkipBar;
