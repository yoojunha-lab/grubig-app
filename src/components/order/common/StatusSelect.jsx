import { ChevronDown } from 'lucide-react';

// ============================================================
// 상태 드롭다운 (뱃지 모양) — 현황표 칸 · 상세창 · 입력 창 · 간트 입력 창 공용 (대표님 요청 2026-10-11 '상태는 드롭다운')
// ------------------------------------------------------------
// - options: [{ key, label, cls }] — cls 는 고른 상태의 뱃지 색 (예: 'bg-blue-100 text-blue-700 border-blue-300')
// - value 가 '' 이면 placeholder 를 흐리게 보여 줌 (상태를 아직 안 고름)
// - 표 칸 안에 넣어도 칸 클릭(입력 창 열기)이 같이 일어나지 않게 click 은 여기서 멈춤
//   (mousedown 은 그대로 → 떠 있던 다른 입력 창은 '바깥 클릭'으로 닫힘)
// - instant(기본): 고르는 즉시 저장되는 곳 (현황표·상세창 칸, 상태 기록 드롭다운)
//   · 고른 뒤 포커스를 내려놓음 — 그대로 두면 방향키(윈도우)로 값이 바뀌어 또 저장·기록되므로
//   · 같은 이유로 방향키·PageUp/Down·Home/End 로는 값을 안 바꿈 (마우스·Space 로 열어서 고르기)
//   instant={false}: 입력 창 안에서 [저장]을 눌러야 저장되는 곳 (방향키로 골라도 됨)
// - Enter 는 여기서 멈춤 (입력 창의 'Enter = 저장'이 고르는 중에 일어나지 않게). ESC 는 그대로 위로 (창 닫기)
// - 현황표 칸 안에서는 tabIndex={-1} — Tab 으로 칸을 옮겨 다닐 때 들어오지 않게 (마우스로만)
// props: value, options, onChange(key), placeholder, size('sm' | 'md'), title, disabled, className, ariaLabel, tabIndex, instant
// ============================================================

const SIZE = {
  sm: 'pl-1.5 pr-4 py-px text-[10px]',
  md: 'pl-2.5 pr-6 py-1 text-xs',
};

const VALUE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export const StatusSelect = ({
  value = '', options = [], onChange, placeholder = '선택', size = 'sm',
  title, disabled = false, className = '', ariaLabel, tabIndex, instant = true,
}) => {
  const current = options.find(o => o.key === value) || null;
  const cls = current?.cls || 'bg-white text-slate-400 border-slate-300 border-dashed';
  return (
    <span
      className={`relative inline-flex items-center max-w-full ${className}`}
      onClick={e => e.stopPropagation()}
    >
      <select
        value={current ? value : ''}
        onChange={e => {
          const v = e.target.value;
          if (instant) e.target.blur();
          onChange?.(v);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.stopPropagation();
          if (instant && VALUE_KEYS.has(e.key) && !e.altKey) e.preventDefault();
        }}
        disabled={disabled}
        tabIndex={tabIndex}
        title={title}
        aria-label={ariaLabel || title || placeholder}
        className={`appearance-none max-w-full truncate rounded-full border font-bold leading-tight cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-default disabled:opacity-60 ${SIZE[size] || SIZE.sm} ${cls}`}
      >
        {!current && <option value="" disabled>{placeholder}</option>}
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <ChevronDown className={`pointer-events-none absolute opacity-60 ${size === 'md' ? 'right-2 w-3 h-3' : 'right-1 w-2.5 h-2.5'}`} />
    </span>
  );
};

export default StatusSelect;
