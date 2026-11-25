import React, { useState } from 'react';
import { Factory, Send, Activity } from 'lucide-react';
import { PopoverShell } from '../order/common/PopoverShell';
import { LD_STAGES, LD_MODES, LD_LETTERS_PICK, letterOf, roundLdNo } from '../../utils/labdipModel';

// ============================================================
// LAB-DIP 화면 공용 부품 — 단계 칩 · 납기 글자 · 입력 칸 · 낱장 고르기 · [+ 새 L/D ▾] 메뉴 · 진행 창 틀
//  · 개발 건 칩 '개발 F-26D011' (+ 그 뒤 아이템화됐으면 '→ PW1060') — 2026-11-24 개발 고도화 3단계
//  · 차수 번호 '2차 GB26026-2' — 2026-11-25 (공장 의뢰서 · 바이어 시트에 찍히는 번호와 같음)
// ============================================================

/** 차수 L/D NO. — 2차부터 '2차 GB26026-2' (L/D NO.가 없으면 '2차'만), 1차는 안 보임 */
export const RoundLdChip = ({ ldNo, roundNo, prefix = '', className = '' }) => {
  if (!(Number(roundNo) > 1)) return null;
  const no = roundLdNo(ldNo, roundNo);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-500 whitespace-nowrap ${className}`}
      title={no ? `공장 의뢰서 · 바이어 시트에 ${no}로 찍혀요` : undefined}>
      {prefix}{roundNo}차{no && <span className="font-mono text-slate-800">{no}</span>}
    </span>
  );
};

/**
 * 개발 건 칩 — link = labdipDevLink(…) (null이면 안 보임)
 *  보라 = 개발 메뉴 색 · 아이템화됐으면 초록 '→ PW1060' · Drop · 찾을 수 없음은 회색 점선
 *  size: 'sm'(목록) | 'md'(작성 화면)
 */
export const LabdipDevChip = ({ link, size = 'sm' }) => {
  if (!link) return null;
  const text = size === 'sm' ? 'text-[9px] px-1' : 'text-[10px] px-1.5';
  const dim = link.missing || link.dropped;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle" title={link.title}>
      <span className={`inline-flex items-center gap-0.5 py-px rounded border font-extrabold whitespace-nowrap ${text} ${dim ? 'bg-white text-slate-400 border-slate-300 border-dashed' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
        <Activity className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        {link.label}{link.dropped ? ' · Drop' : link.missing ? ' · 없음' : ''}
      </span>
      {link.articled && (
        <span className={`py-px rounded border font-extrabold whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200 ${text}`}>
          → {link.articledArticle || '아이템화'}
        </span>
      )}
    </span>
  );
};

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
