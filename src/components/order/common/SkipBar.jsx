import React, { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { PopoverShell } from './PopoverShell';
import { countSkippedRecords } from '../../../utils/orderModel';

// ============================================================
// '안 함' 줄 — 컨펌 · 성적서 / 외관검사 입력 창 맨 위 (대표님 요청 2026-10-19 '진행 안 해도 되는 버튼')
// ------------------------------------------------------------
// - 진행 중: [이 오더는 {label} 안 함] — 누르면 오더 전체(모든 컬러) '안 함'으로 바로 저장 (창은 부른 쪽이 닫음)
// - 안 함: '이 오더는 {label} 안 함' + [다시 진행] — 누르면 바로 저장, 창은 그대로 (이어서 입력)
//   넣어 둔 기록은 지우지 않고 남겨 둠 (recordCount — 오더 전체 기준, 다시 진행하면 그대로 보임)
// - kind 마다 빠지는 곳이 달라서 안내도 따로 (2026-10-19 검토 — 컨펌에는 가납기가 없음)
// - SkippedPopover: '안 함'인 오더의 입력 창 화면 (안내 + [다시 진행] + 닫기) — 컨펌 · 외관검사 창 공용
// props(SkipBar): kind('confirm' | 'inspection'), skipped, recordCount, busy, onSkip(), onResume()
// ============================================================

const SKIP_TEXT = {
  confirm: {
    label: '컨펌 · 성적서',
    effect: '브랜드 컨펌 · 시험성적서 둘 다 컬러 단계 · 남은 일 · 간트에서 빠져요.',
  },
  inspection: {
    label: '외관검사',
    effect: '컬러 단계 · 가납기 · 남은 일 · 간트에서 빠지고, 출고 칸도 검사 기록으로 저절로 바뀌지 않아요 (출고는 직접 체크).',
  },
};

export const SkipBar = ({ kind, skipped, recordCount = 0, busy = false, onSkip, onResume }) => {
  const text = SKIP_TEXT[kind] || SKIP_TEXT.confirm;
  if (skipped) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 space-y-2">
        <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
          <Ban className="w-4 h-4 text-slate-500" /> 이 오더는 {text.label} 안 함 (오더 전체)
        </p>
        <p className="text-[11px] text-slate-500 leading-snug">
          {text.effect}
          {recordCount > 0 ? ` 이 오더에 넣어 둔 기록 ${recordCount}줄은 그대로 남아 있어요 (모든 컬러).` : ''}
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
        title={`이 오더는 ${text.label} 안 함 (오더 전체) — 모든 컬러 칸이 회색 '안 함' (칸을 다시 누르면 [다시 진행])`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait"
      >
        <Ban className="w-3.5 h-3.5" /> 이 오더는 {text.label} 안 함
      </button>
    </div>
  );
};

/**
 * '안 함'인 오더의 입력 창 — 안내 + [다시 진행] (바로 저장, 창은 그대로 → 부른 창이 원래 입력 화면으로 바뀜) + [닫기]
 * props: kind, order, title, anchorRect, onClose, onSetSkip(skip: boolean) => Promise<boolean> (없으면 [다시 진행] 숨김)
 */
export const SkippedPopover = ({ kind, order, title, anchorRect = null, onClose, onSetSkip = null }) => {
  const [resuming, setResuming] = useState(false);
  const text = SKIP_TEXT[kind] || SKIP_TEXT.confirm;
  const resume = async () => {
    if (!onSetSkip || resuming) return;
    setResuming(true);
    try {
      await onSetSkip(false); // 창은 그대로 — 이어서 입력
    } finally {
      setResuming(false);
    }
  };
  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={420}
      title={title}
      subtitle={`${text.label} 안 함 (이 오더 전체)`}
      onClose={onClose}
      footer={(
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      )}
    >
      <div className="p-3 outline-none" tabIndex={-1} data-autofocus>
        <SkipBar
          kind={kind}
          skipped
          recordCount={countSkippedRecords(order, kind)}
          busy={resuming}
          onResume={onSetSkip ? resume : undefined}
        />
      </div>
    </PopoverShell>
  );
};

export default SkipBar;
