import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { num } from '../../utils/helpers';
import { isBlank } from './costSettingsForm';

// ============================================================
// 원가 설정 창 공용 부품 — 칸 모양·섹션 카드·구간 편집 표 (CostSettingsModal.jsx에서 옮김 2026-10-06)
// ============================================================

export const inCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right outline-none focus:ring-2 ring-blue-200';
export const txtCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-blue-200';

// 섹션 카드
export const Section = ({ no, title, hint, children }) => (
  <section className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
      <h4 className="text-sm font-extrabold text-slate-800"><span className="text-blue-600 mr-1">{no}.</span>{title}</h4>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </section>
);

// 구간 편집 표 — 마지막 줄은 항상 '직전 경계 초과' (경계값 없음)
//  · strict: 'N 미만' / 마지막 '직전 경계 이상' 으로 표시 (수입 원사 운반비 — 계산도 pickBracket strict)
//  · allLabel: 경계 줄이 하나도 없을 때 마지막 줄 문구
export const BracketEditor = ({ rows, valueKey, unit, valueUnit, onChange, money = false, strict = false, allLabel }) => {
  const upTo = strict ? '미만' : '이하';
  const over = strict ? '이상' : '초과';
  const bounded = rows.slice(0, -1);
  const open = rows[rows.length - 1];
  const lastMax = bounded.length ? bounded[bounded.length - 1].max : null;
  const setRow = (i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => {
    const prev = Number(lastMax) || 0;
    onChange([...bounded, { max: prev > 0 ? prev * 2 : 100, [valueKey]: open[valueKey] }, open]);
  };
  // 폰: 한 구간을 두 줄로 (경계값 / 값), 데스크톱: 한 줄 (경계값 | 값 | 삭제)
  const rowCls = 'grid grid-cols-[1fr_28px] sm:grid-cols-[1fr_1fr_28px] gap-x-2 gap-y-1 items-center';
  const valuePos = 'col-start-1 row-start-2 sm:col-start-2 sm:row-start-1 pl-[82px] sm:pl-0';
  const ValueCell = ({ i, r }) => (
    <div className={`flex items-center gap-1.5 ${valuePos}`}>
      <input type="number" min="0" value={r[valueKey]} onChange={e => setRow(i, valueKey, e.target.value)} className={inCls} />
      <span className="text-xs text-slate-500 min-w-[2rem] shrink-0 whitespace-nowrap">{valueUnit}</span>
      {money && <span className="hidden sm:inline text-[11px] text-slate-400 w-24 shrink-0 text-right">{num(r[valueKey])}원</span>}
    </div>
  );
  return (
    <div className="space-y-2 sm:space-y-1.5">
      {bounded.map((r, i) => (
        <div key={i} className={rowCls}>
          <div className="col-start-1 row-start-1 grid grid-cols-[76px_1fr_auto] gap-1.5 items-center">
            <span className="text-[11px] text-slate-400 text-right whitespace-nowrap">{i > 0 ? `${num(bounded[i - 1].max)} ${over} ~` : ''}</span>
            <input type="number" min="0" value={r.max ?? ''} onChange={e => setRow(i, 'max', e.target.value)} className={inCls} />
            <span className="text-xs text-slate-500 whitespace-nowrap">{unit} {upTo}</span>
          </div>
          {ValueCell({ i, r })}
          <button type="button" onClick={() => removeRow(i)} title="이 구간 삭제" className="col-start-2 row-start-1 sm:col-start-3 text-slate-300 hover:text-red-500 justify-self-center"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className={rowCls}>
        <div className="col-start-1 row-start-1 text-sm font-bold text-slate-600 pl-[82px]">{lastMax !== null && !isBlank(lastMax) ? `${num(lastMax)} ${unit} ${over}` : (allLabel || `모든 ${unit === 'kg' ? '생지 kg' : '수량'}`)}</div>
        {ValueCell({ i: rows.length - 1, r: open })}
      </div>
      <button type="button" onClick={addRow} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
        <Plus className="w-3.5 h-3.5" /> 구간 추가
      </button>
    </div>
  );
};
