import React, { useState } from 'react';
import { ORDER_KINDS } from '../../../constants/production';
import { PopoverShell } from './PopoverShell';

// ============================================================
// [+ 오더 추가 ▾] — 메인 / 신제품 샘플 / 재샘플 고르기 (대표님 요청 2026-10-19 '구분은 오더를 만들 때 정함')
// ------------------------------------------------------------
// - 버튼을 누르면 그 아래에 고르는 메뉴 (PopoverShell — 바깥 클릭 · ESC 로 닫힘)
// - 고르면 onPick(kind) — 'main' | 'new' | 'resample' → 그 구분으로 새 줄 (order# 를 넣어 저장하면 구분은 잠김)
// - 생산 현황 툴바 · 현황표 맨 아래 줄 · 첫 오더 추가 · 모바일 목록이 같이 씀 (버튼 모양은 className · children 으로)
// props: onPick(kind), className, children(버튼 안 글자), title
// ============================================================

export const AddOrderMenu = ({ onPick, className = '', children, title = '오더 추가 — 메인 · 신제품 샘플 · 재샘플 중에서 골라요' }) => {
  const [anchorRect, setAnchorRect] = useState(null);

  const pick = (kind) => {
    setAnchorRect(null);
    onPick?.(kind);
  };

  return (
    <>
      <button
        type="button"
        onClick={e => setAnchorRect(e.currentTarget.getBoundingClientRect())}
        className={className}
        title={title}
        aria-haspopup="menu"
        aria-expanded={!!anchorRect}
      >
        {children}
      </button>
      {anchorRect && (
        <PopoverShell
          anchorRect={anchorRect}
          width={300}
          title="어떤 오더를 추가할까요?"
          subtitle="구분은 order#를 넣어 저장하면 잠겨요"
          onClose={() => setAnchorRect(null)}
        >
          <div className="p-1.5 space-y-1" role="menu">
            {ORDER_KINDS.map((k, i) => (
              <button
                key={k.key}
                type="button"
                role="menuitem"
                data-autofocus={i === 0 ? '' : undefined}
                onClick={() => pick(k.key)}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 focus:bg-slate-100 outline-none transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-px rounded border text-[10px] font-extrabold ${k.chip}`}>{k.label}</span>
                  <span className="text-xs font-bold text-slate-700">{k.menuLabel}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{k.desc}</div>
              </button>
            ))}
          </div>
          <p className="px-3 pb-2.5 text-[10px] text-slate-400 leading-snug">
            개발/설계 현황에서 설계서에 EZ-TEX O/D NO.를 등록하면 신제품 샘플이 저절로 생겨요.
          </p>
        </PopoverShell>
      )}
    </>
  );
};

export default AddOrderMenu;
