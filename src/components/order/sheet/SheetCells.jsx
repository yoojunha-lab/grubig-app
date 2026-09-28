import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtKg, isYmd, toNumberOrNull, todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 생산 현황표 인라인 편집 칸 (엑셀처럼)
// ------------------------------------------------------------
// - 표시 상태에서는 글자(div). 클릭하거나 Tab 으로 포커스가 오면 입력칸으로 바뀜
// - 텍스트/숫자: Enter·blur 에 확정 (Enter = 확정 후 아래 칸으로), Esc = 취소, 값이 같으면 저장 안 함
// - 날짜: 달력에서 고르면 즉시 확정 / 키보드로 입력하면 Enter·blur 때 확정
// - 체크박스: 클릭 즉시 확정
// - ↑/↓: 같은 열(data-nav 값이 같은 칸)의 위/아래 칸으로 이동
// - 한글 입력(IME) 조합 중 Enter/방향키는 무시 → 마지막 글자 잘림 방지
// ============================================================

const FOCUSABLE = '[tabindex="0"], input, textarea, button';

// 같은 열의 위(-1)/아래(+1) 칸으로 포커스 이동. 이동했으면 true
const focusVertical = (fromEl, dir) => {
  const root = fromEl?.closest?.('[data-nav]');
  const key = root?.getAttribute('data-nav');
  const table = root?.closest('table');
  if (!key || !table) return false;
  const list = Array.from(table.querySelectorAll(`[data-nav="${key}"]`));
  const target = list[list.indexOf(root) + dir];
  if (!target) return false;
  const el = target.matches(FOCUSABLE) ? target : target.querySelector(FOCUSABLE);
  if (!el) return false;
  el.focus();
  return true;
};

const isComposing = (e) => e.nativeEvent?.isComposing || e.keyCode === 229;

// 날짜 표시: 올해면 'M/D', 다른 해면 'YY.M.D'
const fmtDate = (ymd) => {
  if (!isYmd(ymd)) return ymd || '';
  const [y, m, d] = ymd.split('-');
  const md = `${Number(m)}/${Number(d)}`;
  return y === todayYmd().slice(0, 4) ? md : `${y.slice(2)}.${Number(m)}.${Number(d)}`;
};

// 표시칸 ↔ 입력칸 공통 테두리/여백 (전환할 때 줄 높이가 흔들리지 않도록 같은 크기)
const BOX = 'px-1 py-0.5 border rounded';
const INPUT_CLS = `${BOX} w-full min-w-0 bg-white border-teal-400 ring-2 ring-teal-100 outline-none text-[11px] leading-snug`;
const DISPLAY_CLS = `${BOX} border-transparent min-h-[20px] break-words [overflow-wrap:anywhere]`;

// ============================================================
// 편집 상태 훅 (effect 없이: 포커스될 때 draft 를 채우고, 편집 중에만 draft 를 보여줌)
// ============================================================
const useInlineEdit = (text, startEditing, onStartEditingDone) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef(null);
  const doneRef = useRef(true);        // 이번 편집이 이미 확정/취소됐는지 (blur 중복 확정 방지)
  const skipFocusRef = useRef(false);  // 표시칸에 포커스만 돌려놓을 때 편집 재시작 방지
  const selectAllRef = useRef(true);   // 편집 시작 시 전체 선택 (엑셀처럼 바로 덮어쓰기)
  const isEditing = editing || !!startEditing;

  const begin = (initial = text, selectAll = true) => {
    doneRef.current = false;
    selectAllRef.current = selectAll;
    setDraft(initial);
    setEditing(true);
  };

  // 편집 끝내기. 이미 끝났으면 false
  const finish = () => {
    if (doneRef.current) return false;
    doneRef.current = true;
    setEditing(false);
    return true;
  };

  // 표시칸에 포커스만 돌려두기 (Esc 후 / 마지막 줄에서 Enter 후) → 키보드로 계속 이동 가능
  const parkFocus = () => {
    skipFocusRef.current = true;
    rootRef.current?.focus();
  };

  const moveOrPark = (dir) => {
    if (!focusVertical(rootRef.current, dir)) parkFocus();
  };

  const onRootFocus = (e) => {
    if (e.target !== e.currentTarget) return; // 안쪽 입력칸에서 올라온 포커스는 무시
    if (skipFocusRef.current) {
      skipFocusRef.current = false;
      return;
    }
    if (!isEditing) begin(text);
  };

  // 이미 포커스가 있는 표시칸(Esc 뒤 · 마지막 줄 Enter 뒤)을 다시 클릭 → 포커스 이벤트가 안 오므로 여기서 편집 시작
  const onRootClick = (e) => {
    if (isEditing || e.currentTarget !== document.activeElement) return;
    begin(text);
  };

  const onRootKeyDown = (e, typeToStart = true) => {
    if (e.target !== e.currentTarget || isEditing) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      begin(text);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusVertical(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
    } else if (typeToStart && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 표시칸에서 바로 타이핑 → 그 글자로 새로 입력 (엑셀처럼)
      e.preventDefault();
      begin(e.key, false);
    }
  };

  const onInputFocus = (e) => {
    if (!editing) {
      // startEditing 으로 입력칸이 바로 열린 경우 (새 줄 order#, 새 컬러 줄)
      begin(text);
      onStartEditingDone?.();
    }
    const el = e.target;
    if (el.type === 'date' || el.type === 'checkbox') return;
    try {
      if (selectAllRef.current) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    } catch { /* 선택을 지원하지 않는 입력칸 */ }
  };

  return {
    editing, isEditing, draft, setDraft, rootRef,
    begin, finish, parkFocus, moveOrPark,
    onRootFocus, onRootClick, onRootKeyDown, onInputFocus,
  };
};

// ============================================================
// 자동완성 목록 (body 포털 + fixed 위치 → 표 overflow 에 잘리지 않음)
// ============================================================
const SuggestList = ({ anchorRef, items, activeIdx, title, onPick }) => {
  const listRef = useRef(null);

  // 입력칸 바로 아래(공간 없으면 위)에 위치. 스크롤/창 크기 변경 시 다시 계산
  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current;
      const el = listRef.current;
      if (!a || !el) return;
      const r = a.getBoundingClientRect();
      const w = Math.min(Math.max(r.width, 240), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      let top = r.bottom + 2;
      if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 2);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${w}px`;
      el.style.visibility = 'visible';
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  });

  return createPortal(
    <div
      ref={listRef}
      className="fixed z-[210] bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto"
      style={{ left: 0, top: 0, visibility: 'hidden' }}
      onMouseDown={e => e.preventDefault()}
    >
      {title && (
        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-50 border-b border-slate-100">{title}</div>
      )}
      {items.map((it, i) => (
        <button
          key={it.key}
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); onPick(it); }}
          className={`w-full text-left px-2 py-1.5 border-b border-slate-50 last:border-b-0 ${
            i === activeIdx ? 'bg-teal-50' : 'hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-800 truncate">{it.label}</div>
          {it.sub && <div className="text-[10px] text-slate-500 truncate">{it.sub}</div>}
        </button>
      ))}
    </div>,
    document.body
  );
};

// ============================================================
// 텍스트/숫자 공용 편집기 (내부용)
//  onCommitText(draft) : 확정 시 호출 — 값 비교/변환은 호출하는 쪽(CellText/CellNumber)에서
// ============================================================
const InlineEditor = ({
  navKey, text, display, placeholder = '', title,
  className = '', rootClassName = '', displayClassName = '',
  multiline = false, inputMode, uppercase = false,
  onCommitText, startEditing = false, onStartEditingDone,
  suggest, onPick, suggestTitle,
}) => {
  const {
    editing, isEditing, draft, setDraft, rootRef,
    finish, parkFocus, moveOrPark, onRootFocus, onRootClick, onRootKeyDown, onInputFocus,
  } = useInlineEdit(text, startEditing, onStartEditingDone);
  const inputRef = useRef(null);
  const [active, setActive] = useState(-1);

  const items = editing && suggest ? suggest(draft) : [];
  const activeIdx = active < items.length ? active : -1;

  const commit = () => {
    if (!finish()) return;
    setActive(-1);
    onCommitText(draft);
  };

  const commitAndMove = (dir) => {
    commit();
    moveOrPark(dir);
  };

  const cancel = () => {
    if (!finish()) return;
    setActive(-1);
    parkFocus();
  };

  // 자동완성 항목 선택. move: 'down'(Enter) | 'stay'(마우스) | 'none'(Tab — 포커스는 브라우저가 이동)
  const pick = (item, move) => {
    if (!finish()) return;
    setActive(-1);
    onPick?.(item);
    if (move === 'down') moveOrPark(1);
    else if (move === 'stay') parkFocus();
  };

  const onKeyDown = (e) => {
    if (isComposing(e)) return;
    const listOpen = items.length > 0;
    if (listOpen && e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(items.length - 1, activeIdx + 1));
      return;
    }
    if (listOpen && e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(-1, activeIdx - 1));
      return;
    }
    if (listOpen && activeIdx >= 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      if (e.key === 'Enter') e.preventDefault();
      pick(items[activeIdx], e.key === 'Enter' ? 'down' : 'none');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === 'Enter') {
      if (multiline && e.shiftKey) return; // Shift+Enter: 기본 줄바꿈
      if (multiline && e.altKey) {
        // Alt+Enter: 엑셀처럼 칸 안 줄바꿈
        e.preventDefault();
        const el = e.currentTarget;
        el.setRangeText('\n', el.selectionStart, el.selectionEnd, 'end');
        setDraft(el.value);
        return;
      }
      e.preventDefault();
      commitAndMove(!multiline && e.shiftKey ? -1 : 1);
      return;
    }
    if (!multiline && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      commitAndMove(e.key === 'ArrowDown' ? 1 : -1);
    }
  };

  const onChange = (e) => {
    setDraft(e.target.value);
    setActive(-1);
  };

  const shown = editing ? draft : text;
  const inputCls = `${INPUT_CLS} ${uppercase ? 'uppercase' : ''} ${className}`;
  const inputProps = {
    autoFocus: true,
    value: shown,
    onChange,
    onKeyDown,
    onFocus: onInputFocus,
    onBlur: commit,
  };

  return (
    <div
      ref={rootRef}
      data-nav={navKey}
      tabIndex={isEditing ? -1 : 0}
      onFocus={onRootFocus}
      onClick={onRootClick}
      onKeyDown={onRootKeyDown}
      title={isEditing ? undefined : title}
      className={`rounded outline-none focus:ring-2 focus:ring-teal-400 ${isEditing ? '' : 'cursor-text'} ${rootClassName}`}
    >
      {isEditing ? (
        multiline ? (
          <textarea
            {...inputProps}
            ref={inputRef}
            rows={Math.min(8, Math.max(2, shown.split('\n').length))}
            className={`${inputCls} resize-none`}
          />
        ) : (
          <input {...inputProps} ref={inputRef} type="text" inputMode={inputMode} className={inputCls} />
        )
      ) : (
        <div className={`${DISPLAY_CLS} ${multiline ? 'whitespace-pre-wrap' : ''} ${className} ${displayClassName}`}>
          {text ? (display ?? text) : <span className="text-slate-300 font-normal">{placeholder}</span>}
        </div>
      )}
      {items.length > 0 && (
        <SuggestList
          anchorRef={inputRef}
          items={items}
          activeIdx={activeIdx}
          title={suggestTitle}
          onPick={it => pick(it, 'stay')}
        />
      )}
    </div>
  );
};

// ============================================================
// 텍스트 칸
//  uppercase: 대문자로 비교/저장 (order#, color)
//  multiline: 여러 줄 (Alt+Enter / Shift+Enter 줄바꿈), clamp: 표시 줄 수 제한(전체는 툴팁)
//  suggest(draft) => [{ key, label, sub }] + onPick(item): 자동완성
// ============================================================
export const CellText = ({
  value, onCommit, uppercase = false, multiline = false, clamp = 0,
  className = '', title, ...rest
}) => {
  const text = value === null || value === undefined ? '' : String(value);
  const norm = (s) => {
    const t = String(s ?? '').trim();
    return uppercase ? t.toUpperCase() : t;
  };
  const clampCls = clamp === 2 ? 'line-clamp-2' : clamp === 3 ? 'line-clamp-3' : clamp === 4 ? 'line-clamp-4' : '';
  return (
    <InlineEditor
      {...rest}
      text={text}
      uppercase={uppercase}
      multiline={multiline}
      className={className}
      display={clampCls ? <span className={clampCls}>{text}</span> : undefined}
      title={title ?? (clampCls && text ? text : undefined)}
      onCommitText={(draft) => {
        const next = norm(draft);
        if (next !== norm(text)) onCommit?.(next);
      }}
    />
  );
};

// ============================================================
// 숫자 칸 (콤마 입력 허용, 빈칸 확정 = null, 잘못된 값/최솟값 미만은 취소)
//  display(value) 로 표시 모양을 바꿀 수 있음 (예: '로스 10%' 뱃지)
// ============================================================
export const CellNumber = ({
  value, onCommit, decimals = 1, min = 0, display, align = 'right', className = '', ...rest
}) => {
  const num = value === null || value === undefined || value === '' ? null : Number(value);
  const has = num !== null && Number.isFinite(num);
  const text = has ? String(num) : '';
  const factor = 10 ** decimals;
  return (
    <InlineEditor
      {...rest}
      text={text}
      inputMode="decimal"
      className={`font-mono ${align === 'right' ? 'text-right' : ''} ${className}`}
      display={has ? (display ? display(num) : fmtKg(num)) : undefined}
      onCommitText={(draft) => {
        const raw = String(draft ?? '').trim();
        // 고치지 않고 지나간 칸(Tab 이동 등)은 저장 안 함
        // (예전 YD→KG 변환 값 242.48 처럼 소수 둘째 자리 값이 반올림돼 바뀌거나 변경 이력이 쌓이는 것 방지)
        if (raw === text) return;
        if (raw === '') {
          if (has) onCommit?.(null);
          return;
        }
        const n = toNumberOrNull(raw);
        if (n === null || n < min) return; // 숫자가 아니거나 음수 → 원래 값 유지
        if (has && n === num) return;      // 같은 값을 다시 입력 (예: '1,000' ↔ 1000)
        const rounded = Math.round(n * factor) / factor;
        if (!has || rounded !== num) onCommit?.(rounded);
      }}
    />
  );
};

// ============================================================
// 날짜 칸
// - 달력(마우스)에서 고르면 즉시 확정
// - 키보드로 숫자를 입력하는 중에는 확정하지 않고 Enter·blur 때 확정
//   (연도 한 자리씩 입력할 때 0002년, 0020년… 이 저장되는 것 방지)
// - 표시칸을 마우스로 클릭하면 달력을 바로 띄움
// ============================================================
export const CellDate = ({
  value, onCommit, navKey, placeholder = '', title,
  className = '', rootClassName = '',
}) => {
  const text = value || '';
  const {
    editing, isEditing, draft, setDraft, rootRef,
    finish, parkFocus, moveOrPark, onRootFocus, onRootClick, onRootKeyDown, onInputFocus,
  } = useInlineEdit(text, false);
  const typingRef = useRef(false);
  const pickerRef = useRef(false);
  const lastRef = useRef(null); // 달력으로 즉시 확정한 값 (blur 때 중복 저장 방지)

  const commit = () => {
    if (!finish()) return;
    typingRef.current = false;
    pickerRef.current = false;
    const v = draft;
    if (v === text || v === lastRef.current) return;
    if (v === '' || isYmd(v)) onCommit?.(v);
  };

  const onChange = (e) => {
    const v = e.target.value;
    setDraft(v);
    if (typingRef.current || !isYmd(v) || v === text) return;
    lastRef.current = v;
    onCommit?.(v);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      moveOrPark(1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      typingRef.current = false;
      if (finish()) parkFocus();
      return;
    }
    if (e.key !== 'Tab' && e.key !== 'Shift') typingRef.current = true;
  };

  const onFocus = (e) => {
    lastRef.current = null;
    onInputFocus(e);
    if (pickerRef.current) {
      pickerRef.current = false;
      try { e.target.showPicker?.(); } catch { /* 달력 자동 열기 미지원 브라우저 */ }
    }
  };

  return (
    <div
      ref={rootRef}
      data-nav={navKey}
      tabIndex={isEditing ? -1 : 0}
      onFocus={onRootFocus}
      onKeyDown={e => onRootKeyDown(e, false)}
      onMouseDown={e => {
        // 포커스가 새로 들어오는 클릭만 달력 예약 (이미 포커스된 칸은 onClick 에서 처리 → 예약이 남아 나중에 Tab 때 달력이 뜨는 것 방지)
        if (!isEditing && e.currentTarget !== document.activeElement) pickerRef.current = true;
      }}
      onClick={e => {
        if (!isEditing && e.currentTarget === document.activeElement) pickerRef.current = true;
        onRootClick(e);
      }}
      title={isEditing ? undefined : (title ?? (text || undefined))}
      className={`rounded outline-none focus:ring-2 focus:ring-teal-400 ${isEditing ? '' : 'cursor-pointer'} ${rootClassName}`}
    >
      {isEditing ? (
        <input
          type="date"
          autoFocus
          value={editing ? draft : text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onKeyUp={() => { typingRef.current = false; }}
          onFocus={onFocus}
          onBlur={commit}
          className={`${INPUT_CLS} relative z-[1] min-w-[112px] font-mono ${className}`}
        />
      ) : (
        <div className={`${DISPLAY_CLS} font-mono whitespace-nowrap ${className}`}>
          {text ? fmtDate(text) : <span className="text-slate-300 font-normal font-sans">{placeholder}</span>}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 체크박스 칸 (클릭/스페이스 즉시 확정, ↑/↓ 위아래 이동)
// ============================================================
export const CellCheck = ({ checked, onCommit, label, navKey, title, className = '' }) => (
  <label
    data-nav={navKey}
    title={title}
    className={`inline-flex items-center gap-1 cursor-pointer select-none text-[10px] font-bold ${className}`}
  >
    <input
      type="checkbox"
      checked={!!checked}
      onChange={e => onCommit?.(e.target.checked)}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          focusVertical(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
        }
      }}
      className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
    />
    {label}
  </label>
);

// ============================================================
// 클릭해서 팝오버를 여는 칸의 키보드 담당 (공정·LOT·컨펌 칸)
//  - Tab 으로 포커스, Enter/Space = 열기, ↑/↓ = 위아래 이동
//  - onActivate(el): el = 이 칸을 감싼 <td> (팝오버 위치 기준)
//  - 마우스 클릭은 바깥 <td> 의 onClick 이 담당 (칸 전체가 클릭 영역)
// ============================================================
export const CellAction = ({ navKey, onActivate, disabled = false, title, className = '', children }) => (
  <div
    data-nav={navKey}
    tabIndex={disabled ? -1 : 0}
    role={disabled ? undefined : 'button'}
    title={title}
    onKeyDown={e => {
      if (e.target !== e.currentTarget) return;
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onActivate?.(e.currentTarget.closest('td') || e.currentTarget);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusVertical(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
      }
    }}
    className={`outline-none min-h-[20px] ${className}`}
  >
    {children}
  </div>
);
