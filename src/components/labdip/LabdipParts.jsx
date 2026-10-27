import React, { useState } from 'react';
import { Factory, Send } from 'lucide-react';
import { PopoverShell } from '../order/common/PopoverShell';
import { LD_STAGES, LD_MODES, LD_LETTERS_PICK, letterOf } from '../../utils/labdipModel';

// ============================================================
// LAB-DIP 화면 공용 부품 — 단계 칩 · 납기 글자 · 입력 칸 · 낱장 고르기 · [+ 새 L/D ▾] 메뉴 · 진행 창 틀
// ============================================================

/** 컬러 단계 칩 (공장 진행중 · L/D 도착 · 리젝 · 컨펌대기 · 컨펌 · Drop · 예전 기록) */
export const StageChip = ({ stage, label, title, dim = false, className = '' }) => {
  const s = LD_STAGES[stage] || LD_STAGES.factory;
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] font-extrabold whitespace-nowrap ${s.cls} ${dim ? 'opacity-35' : ''} ${className}`}>
      {label || s.label}
    </span>
  );
};

const TONE_CLS = {
  late: 'text-red-600 font-extrabold',
  soon: 'text-amber-600 font-extrabold',
  ok: 'text-slate-600 font-bold',
};
/** 납기 한 줄 — '공장 11/03 · D-3' (badge = labdipModel.dueBadge) */
export const DueLine = ({ label, date, badge }) => {
  if (!date) return null;
  return (
    <div className="whitespace-nowrap text-[11px]">
      <span className="text-slate-400 font-bold mr-1">{label}</span>
      <span className="text-slate-500">{date.slice(5).replace('-', '/')}</span>
      {badge && <span className={`ml-1 ${TONE_CLS[badge.tone] || ''}`}>{badge.text}</span>}
    </div>
  );
};

/** 라벨 + 입력 칸 */
export const LdField = ({ label, hint, className = '', children }) => (
  <div className={className}>
    <label className="block text-[11px] font-bold text-slate-500 mb-1">
      {label}{hint && <span className="ml-1 font-medium text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
);
export const ldInputCls = 'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white';
/** 작은 칸 (진행 창 · [기록]) */
export const ldSmallCls = 'border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none bg-white';

/** 낱장 수 고르기 (1~8장, 저장된 값이 더 크면 거기까지) — label: (n) => 보이는 글자 */
export const LettersSelect = ({ value, onChange, disabled = false, className = ldSmallCls, label = (n) => `낱장 ${n}장` }) => (
  <select value={value} onChange={e => onChange(Number(e.target.value))} disabled={disabled} className={className} title="낱장 수">
    {Array.from({ length: Math.max(LD_LETTERS_PICK, Number(value) || 0) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{label(n)}</option>)}
  </select>
);

/** 첫 낱장 글자 고르기 (A부터 ~ Z부터) */
export const StartLetterSelect = ({ value, onChange, disabled = false, className = ldSmallCls }) => (
  <select value={value} onChange={e => onChange(Number(e.target.value))} disabled={disabled} className={className} title="첫 낱장 글자">
    {Array.from({ length: 26 }, (_, i) => i).map(i => <option key={i} value={i}>{letterOf(i)}부터</option>)}
  </select>
);

/** [+ 새 L/D ▾] — 공장에 의뢰 / 바이어 발송만 (EZ-TEX 의뢰) 고르기 */
export const NewLabdipMenu = ({ onPick, className = '', children }) => {
  const [anchorRect, setAnchorRect] = useState(null);
  const pick = (mode) => {
    setAnchorRect(null);
    onPick?.(mode);
  };
  return (
    <>
      <button type="button" onClick={e => setAnchorRect(e.currentTarget.getBoundingClientRect())}
        className={className} aria-haspopup="menu" aria-expanded={!!anchorRect}>
        {children}
      </button>
      {anchorRect && (
        <PopoverShell anchorRect={anchorRect} width={320} title="어떤 L/D를 만들까요?" subtitle="L/D NO.는 저장할 때 붙어요" onClose={() => setAnchorRect(null)}>
          <div className="p-1.5 space-y-1" role="menu">
            {LD_MODES.map((m, i) => (
              <button key={m.key} type="button" role="menuitem" data-autofocus={i === 0 ? '' : undefined} onClick={() => pick(m.key)}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 focus:bg-slate-100 outline-none transition-colors">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  {m.key === 'factory' ? <Factory className="w-3.5 h-3.5 text-teal-600" /> : <Send className="w-3.5 h-3.5 text-indigo-600" />}
                  {m.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{m.desc}</div>
              </button>
            ))}
          </div>
        </PopoverShell>
      )}
    </>
  );
};
