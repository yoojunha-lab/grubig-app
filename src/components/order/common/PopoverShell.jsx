import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { UnsavedChangesDialog } from '../../common/UnsavedChangesDialog';

// ============================================================
// 생산 현황 공용 팝오버 틀
// ------------------------------------------------------------
// - anchorRect(DOMRect)가 있으면 그 칸 바로 아래(공간 없으면 위)에 붙어서 뜸
// - anchorRect가 null이면 화면 가운데 모달처럼 뜸 (반투명 배경)
// - 바깥 클릭 / ESC / X → 닫기 (여러 개가 겹쳐 뜨면 맨 위 창만 닫힘)
//   dirty(저장 안 한 변경)가 있으면 바로 닫지 않고 '변경사항이 있습니다' 창
//   (저장하고 나가기 = onSaveDirty / 저장 안 함 = onClose / 계속 편집) — 팝업 창 규약 (terminology §4)
//   · 그 바깥 클릭은 뒤 화면에 닿지 않음 (포커스·다른 칸 입력 창 열기·달력 열기 없음 — 고친 내용이 다른 창에 밀려 사라지지 않게)
//   · 묻는 창이 떠 있는 동안 키보드는 그 창 안에서만 (Tab 은 버튼 사이로, Enter 는 고른 버튼, ESC 는 계속 편집)
// - ESC 는 여기서 처리하고 끝냄 → 아래 깔린 상세창 등이 같이 닫히지 않음
// - 열리면 포커스를 창 안으로 옮김 (data-autofocus 가 붙은 요소, 없으면 창 자체)
//   Tab 은 창 안에서만 돌고, 닫히면 열 때 포커스가 있던 곳(표 칸 등)으로 되돌림
// - document.body 로 포털 렌더 → 표의 sticky/overflow 에 잘리지 않음
// props: anchorRect, width(px), title, subtitle, onClose, children, footer,
//        dirty(저장 안 한 변경이 있는지), onSaveDirty(저장하고 나가기 — 저장에 성공하면 그 창이 닫음), dirtyMessage
// ============================================================
const MARGIN = 8;

// 지금 열려 있는 팝오버 (나중에 뜬 창이 맨 뒤)
const openShells = [];

// Tab 으로 갈 수 있는 요소
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export const PopoverShell = ({
  anchorRect = null, width = 320, title, subtitle, onClose, children, footer,
  dirty = false, onSaveDirty, dirtyMessage,
}) => {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(dirty);
  const saveDirtyRef = useRef(onSaveDirty);
  // '변경사항이 있습니다' 창이 떠 있는지 (바깥 클릭·ESC 리스너는 처음 한 번만 등록하므로 ref 로 봄)
  const [asking, setAsking] = useState(false);
  const askingRef = useRef(false);
  const setAsk = useCallback((v) => {
    askingRef.current = v;
    setAsking(v);
  }, []);

  // 묻는 창을 닫고 다시 이 입력 창으로 (계속 편집)
  const keepEditing = useCallback(() => {
    setAsk(false);
    const panel = panelRef.current;
    if (panel) (panel.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true });
  }, [setAsk]);

  // 닫기 요청 (바깥 클릭·ESC·X): 저장 안 한 변경이 있으면 먼저 묻기
  const requestClose = useCallback(() => {
    if (askingRef.current) return;
    if (dirtyRef.current) {
      setAsk(true);
      return;
    }
    onCloseRef.current?.();
  }, [setAsk]);
  // 열 때 포커스가 있던 곳 (닫힌 뒤 되돌릴 곳) — 키보드로 연 경우(:focus-visible)만
  // (마우스로 연 경우는 예전처럼 그대로 둠 → 간트 막대 툴팁 등이 괜히 다시 뜨지 않게)
  const [returnFocusEl] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    try {
      return el.matches(':focus-visible') ? el : null;
    } catch {
      return el; // :focus-visible 을 모르는 브라우저
    }
  });

  useEffect(() => {
    onCloseRef.current = onClose;
    dirtyRef.current = dirty;
    saveDirtyRef.current = onSaveDirty;
  }, [onClose, dirty, onSaveDirty]);

  // 묻는 창이 뜨면 '저장하고 나가기' 버튼에 포커스 (Enter = 저장하고 나가기)
  useEffect(() => {
    if (!asking) return undefined;
    const t = setTimeout(() => {
      document.querySelector('[data-unsaved-ask] button')?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [asking]);

  // 위치 계산: 실제 높이를 잰 뒤 화면 안으로 보정 (setState 없이 DOM 스타일 직접 지정)
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || !anchorRect) return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const h = el.offsetHeight;
    const w = Math.min(width, winW - MARGIN * 2);

    let left = anchorRect.left;
    if (left + w > winW - MARGIN) left = winW - w - MARGIN;
    if (left < MARGIN) left = MARGIN;

    let top = anchorRect.bottom + 4;
    if (top + h > winH - MARGIN) {
      const above = anchorRect.top - h - 4;
      top = above >= MARGIN ? above : Math.max(MARGIN, winH - h - MARGIN);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  });

  // 포커스: 열리면 창 안으로, 닫히면 열 때 있던 곳으로
  // (위치를 잡아 보이게 된 뒤라 focus 가 먹힘 — 자식 팝오버가 더 알맞은 칸에 커서를 두면 그게 우선)
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const target = panel.querySelector('[data-autofocus]') || panel;
      target.focus({ preventScroll: true });
    }
    return () => {
      // 닫힌 뒤 포커스가 갈 곳이 없을 때(body)만 되돌림 — 다른 칸을 클릭해 닫은 경우는 그 칸 그대로
      setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body) return;
        const el = returnFocusEl;
        if (!el || el === document.body || !el.isConnected || typeof el.focus !== 'function') return;
        // 그 사이 다른 창(상세창 등)이 떴는데 되돌릴 곳이 그 창 밖이면 뒤에 깔린 칸으로 보내지 않음
        const covered = [...document.querySelectorAll('[role="dialog"]')].some(d => !d.contains(el));
        if (!covered) el.focus({ preventScroll: true });
      }, 0);
    };
  }, [returnFocusEl]);

  // 바깥 클릭 / ESC 닫기 (열린 직후의 클릭은 무시하도록 다음 틱에 등록)
  useEffect(() => {
    const entry = { panelRef };
    openShells.push(entry);
    const rootOf = (en) => {
      const p = en.panelRef.current;
      return p ? (p.closest('[data-popover-shell]') || p) : null;
    };

    // 저장 안 한 변경이 있을 때 바깥을 누르면, 그 누름에 이어지는 click 은 뒤 화면에 보내지 않음
    //  (표 칸 click → 다른 입력 창이 이 창을 밀어내 고친 내용이 사라지던 것) — 마우스를 뗀 직후 풀림
    const blockNextClick = () => {
      const block = (ev) => {
        if (ev.target?.closest?.('[data-unsaved-ask]')) return;
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', block, true);
      const release = () => {
        document.removeEventListener('mouseup', release, true);
        setTimeout(() => document.removeEventListener('click', block, true), 0);
      };
      document.addEventListener('mouseup', release, true);
      setTimeout(release, 1500); // 마우스를 창 밖에서 떼는 등 mouseup 이 안 와도 풀리게
    };

    const onDown = (e) => {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (askingRef.current) return; // '변경사항이 있습니다' 창을 누른 것
      // 나중에 뜬 다른 팝오버 안을 누른 거면 이 창은 그대로 둠
      const newer = openShells.slice(openShells.indexOf(entry) + 1);
      if (newer.some(en => rootOf(en)?.contains(e.target))) return;
      if (dirtyRef.current) {
        e.preventDefault(); // 누른 칸으로 포커스가 가거나 달력·목록이 열리지 않게
        blockNextClick();
      }
      requestClose();
    };

    // 묻는 창이 떠 있을 때 키보드: ESC = 계속 편집, Tab = 그 창 버튼 사이로만, 그 밖의 키는 그 창 안에서만
    const onAskKey = (e) => {
      const ask = document.querySelector('[data-unsaved-ask]');
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        keepEditing();
        return;
      }
      if (e.key === 'Tab') {
        const buttons = ask ? [...ask.querySelectorAll('button')] : [];
        if (!buttons.length) return;
        e.preventDefault();
        e.stopPropagation();
        const i = buttons.indexOf(document.activeElement);
        const next = e.shiftKey
          ? (i <= 0 ? buttons.length - 1 : i - 1)
          : (i === -1 || i === buttons.length - 1 ? 0 : i + 1);
        buttons[next].focus();
        return;
      }
      if (!ask || !ask.contains(document.activeElement)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 캡처 단계에서 먼저 받아 처리한 뒤 전파를 끊음 → 아래 상세창의 ESC 리스너까지 가지 않음
    const onKey = (e) => {
      if (openShells[openShells.length - 1] !== entry) return; // 맨 위 창만 처리
      if (askingRef.current) {
        onAskKey(e);
        return;
      }
      // 창 안에서 누른 버튼이 사라져 포커스를 잃었으면(body) Tab 이 창 안에서 이어지게 되돌림
      if (e.key === 'Tab') {
        const active = document.activeElement;
        const panel = panelRef.current;
        if (panel && (!active || active === document.body)) {
          (panel.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true });
        }
        return;
      }
      if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
    }, 0);
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      const idx = openShells.indexOf(entry);
      if (idx >= 0) openShells.splice(idx, 1);
    };
  }, [requestClose, keepEditing]); // 둘 다 바뀌지 않는 함수 → 처음 한 번만 등록

  // Tab / Shift+Tab 이 창 밖(뒤의 표 칸)으로 새지 않게 처음 ↔ 끝을 이어 돌림
  const onPanelKeyDown = (e) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const header = (title || subtitle) && (
    <div className="flex items-start justify-between gap-2 px-3 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
      <div className="min-w-0">
        {title && <div className="text-xs font-extrabold truncate">{title}</div>}
        {subtitle && <div className="text-[10px] text-teal-100 truncate">{subtitle}</div>}
      </div>
      <button type="button" onClick={requestClose} className="text-white/80 hover:text-white shrink-0" title="닫기 (ESC)">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // '변경사항이 있습니다' 창 (상세창·다른 팝오버보다 위 — UnsavedChangesDialog z-[10010])
  //  data-unsaved-ask: 키보드·바깥 클릭 막기에서 이 창 안인지 알아보는 표시
  const askDialog = asking && createPortal(
    <div data-unsaved-ask="">
      <UnsavedChangesDialog
        open
        message={dirtyMessage}
        onSave={() => {
          keepEditing(); // 저장이 막히면(빨간 칸) 이 창으로 돌아와 고칠 수 있게
          saveDirtyRef.current?.();
        }}
        onDiscard={() => {
          setAsk(false);
          onCloseRef.current?.();
        }}
        onKeepEditing={keepEditing}
      />
    </div>,
    document.body
  );

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
      onKeyDown={onPanelKeyDown}
      data-popover-shell={anchorRect ? '' : undefined}
      className={`bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden flex flex-col outline-none ${
        anchorRect ? 'fixed z-[200]' : 'relative w-full'
      }`}
      style={anchorRect
        ? { width: `min(${width}px, calc(100vw - ${MARGIN * 2}px))`, maxHeight: `calc(100vh - ${MARGIN * 2}px)`, left: 0, top: 0, visibility: 'hidden' }
        : { maxWidth: `${width}px`, maxHeight: 'calc(100vh - 32px)' }}
    >
      {header}
      <div className="overflow-y-auto flex-1">{children}</div>
      {footer && <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">{footer}</div>}
    </div>
  );

  if (anchorRect) {
    return (
      <>
        {createPortal(panel, document.body)}
        {askDialog}
      </>
    );
  }

  return (
    <>
      {createPortal(
        <div data-popover-shell="" className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          {panel}
        </div>,
        document.body
      )}
      {askDialog}
    </>
  );
};
