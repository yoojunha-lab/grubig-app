import React, { useState, useRef } from 'react';
import { Download, ClipboardPaste, FileSpreadsheet, Search, ChevronDown, ChevronRight, Square, CheckSquare } from 'lucide-react';
import { num } from '../../utils/helpers';

// ============================================================
// 견적서 화면 공용 부품 — 기준 견적·별도 견적 칸이 같이 씀 (QuotationPage.jsx에서 옮김, 2026-10-06)
// ============================================================

// 숫자 칸 — 지우고 새로 칠 수 있게. 칠 때마다 숫자면 바로 반영(가격도 바로 바뀜),
//  비운 채로 칸을 떠나면 칸에 들어올 때의 값으로 되돌림 (한 글자씩 지우며 지나간 '2' 같은 값이 남지 않게)
//  (예전엔 칸을 지우는 순간 0이 들어가서 이어서 치면 '05'가 됐음)
export const DraftNumberInput = ({ value, onValue, ...rest }) => {
  const [draft, setDraft] = useState(null);
  const valueOnFocus = useRef('');
  return (
    <input
      type="number"
      {...rest}
      value={draft ?? value}
      onFocus={() => { valueOnFocus.current = value; }}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        if (t.trim() !== '' && Number.isFinite(Number(t))) onValue(t);
      }}
      onBlur={() => {
        const start = String(valueOnFocus.current ?? '');
        if (draft !== null && draft.trim() === '' && start !== '') onValue(start);
        setDraft(null);
      }}
    />
  );
};

// 접고 펴는 칸 — 머리줄(아이콘·제목·개수) + 오른쪽 버튼
export const QuoteSection = ({ icon: Icon, title, count, desc, tone = 'blue', open, onToggle, actions, children }) => {
  const head = tone === 'amber'
    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
    : 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200';
  const iconColor = tone === 'amber' ? 'text-amber-600' : 'text-sky-700';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${head}`}>
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left min-w-0" title={open ? '접기' : '펼치기'}>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
          <span className="text-base font-extrabold text-slate-800">{title}</span>
          <span className="text-xs font-bold text-slate-400">({count})</span>
          {desc && <span className="hidden lg:inline text-[11px] text-slate-500 font-medium truncate">{desc}</span>}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      </div>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
};

// 칸 머리줄의 PDF·엑셀 버튼
export const ExportButtons = ({ onPdf, onExcel, label }) => (
  <>
    <button type="button" onClick={onPdf} title={`${label} PDF`} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 text-xs font-bold shadow-sm">
      <Download className="w-3.5 h-3.5" /> {label} PDF
    </button>
    <button type="button" onClick={onExcel} title={`${label} 엑셀`} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 text-xs font-bold shadow-sm">
      <FileSpreadsheet className="w-3.5 h-3.5" /> 엑셀
    </button>
  </>
);

// 외관검사·시험성적서 제외 — 칸 전체에 적용하는 켜고 끄는 버튼 (켜지면 빨간색)
export const ToggleButton = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${on ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
    {on ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />} {children}
  </button>
);

export const ExcludeToggles = ({ label, visual, chem, onChange, note }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
    <span className="font-extrabold text-slate-600">{label}</span>
    <ToggleButton on={visual} onClick={() => onChange('excludeVisual', !visual)}>외관검사 제외</ToggleButton>
    <ToggleButton on={chem} onClick={() => onChange('excludeChem', !chem)}>시험성적서(이화학) 제외</ToggleButton>
    <span className="text-[10px] text-slate-400">{note}</span>
  </div>
);

// 개발 의뢰 원가 견적에서 온 품목 표시 (원단 리스트에 없는 개발 품목 — Article = 개발번호)
export const DevSourceBadge = () => (
  <span
    title="개발 의뢰 원가 견적에서 온 품목이에요 (원단 리스트에 없음). [현재 원가로 다시 계산]은 그 의뢰의 원가 견적으로 계산해요."
    className="ml-1 inline-block align-middle normal-case whitespace-nowrap text-[9px] font-extrabold leading-none text-violet-700 bg-violet-50 border border-violet-200 rounded px-1 py-0.5"
  >
    개발
  </span>
);

// 러닝 생지 견적 줄 표시 (별도 견적 — 미리 짜 둔 생지로 받는 오더, 2026-10-07). 바이어 견적서에는 안 나감
export const RunningGreigeBadge = ({ greigeQty }) => (
  <span
    title={`러닝 생지 견적 — 원사·편직은 생지 짠 수량${Number(greigeQty) > 0 ? `(${num(greigeQty)}YD)` : ''}으로 짠 원가, 염색은 컬러별 실제 수량이에요. (바이어 견적서에는 이 표시가 안 나가요)`}
    className="ml-1 inline-block align-middle normal-case whitespace-nowrap text-[9px] font-extrabold leading-none text-teal-700 bg-teal-50 border border-teal-200 rounded px-1 py-0.5"
  >
    러닝 생지
  </span>
);

// 표 아래 Article 입력(Enter)·엑셀 세로 복붙 칸 — 기준·별도 견적 공통
//  개발번호(원가 견적을 저장한 개발 의뢰)도 넣을 수 있음
export const ArticleQuickAdd = ({ onAdd, tone = 'indigo' }) => (
  <input
    type="text"
    placeholder="Article·개발번호 입력 후 Enter 또는 엑셀(세로) 복붙..."
    className={`w-full border rounded px-3 py-2 outline-none focus:ring-2 text-xs font-bold shadow-sm uppercase ${tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800 focus:ring-amber-400' : 'bg-indigo-50 border-indigo-200 text-indigo-800 focus:ring-indigo-400'}`}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const art = String(e.target.value).trim().toUpperCase();
        if (!art) return;
        onAdd(art);
        e.target.value = '';
      }
    }}
    onPaste={(e) => {
      e.preventDefault();
      onAdd(e.clipboardData.getData('text'));
      e.target.value = '';
    }}
  />
);

export const PasteHint = () => (
  <div className="flex items-center gap-1 whitespace-nowrap">
    <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> <span className="hidden sm:inline">왼쪽 칸을 클릭하고</span> 엑셀 Article(원단명) 열을 복사 후 붙여넣어 보세요.
  </div>
);

// [원단 검색·추가] 버튼 — 기준·별도 견적 공통
export const AddFromListButton = ({ onClick, tone = 'indigo' }) => (
  <button
    onClick={onClick}
    className={`w-full sm:w-max px-3 py-1.5 rounded-lg font-bold text-sm border flex items-center justify-center gap-1.5 shrink-0 ${tone === 'amber' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200'}`}
  >
    <Search className="w-4 h-4" /> 원단 검색·추가 (목록에서 선택)
  </button>
);
