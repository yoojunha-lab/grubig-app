import React, { useState, useMemo } from 'react';
import {
  SwatchBook, Save, Download, FilePlus, Trash2, Plus, Copy, Pencil, X, Search,
  Palette, Send, Info,
} from 'lucide-react';
import { PartnerSelectField } from '../components/common/PartnerSelectField';
import { labdipLetters } from '../hooks/domains/useLabdip';

// 발송 방법 빠른 선택값 (자유 입력도 가능 — datalist)
const SENT_METHODS = ['퀵서비스', '택배', '방문 수령', '직접 전달', 'DHL', 'EMS', '이메일(스캔)'];

// ── 작은 입력 필드 (라벨 + input) ───────────────────────────
const Field = ({ label, value, onChange, placeholder = '', type = 'text', className = '', list, upper = false }) => (
  <div className={className}>
    <label className="block text-[11px] font-bold text-slate-500 mb-1">{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      list={list}
      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${upper ? 'uppercase font-bold' : ''}`}
    />
  </div>
);

// 스와치(낱장) 총 개수
const swatchCount = (labdip) =>
  (labdip.colors || []).reduce((s, c) => s + (Math.max(1, Number(c.letters) || 1)), 0);

// 발송 상태 뱃지
const sentBadge = (labdip) =>
  labdip.sentDate
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><Send className="w-3 h-3" /> 발송 {labdip.sentDate}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">미발송</span>;

// ── 컬러 한 행 (모듈 레벨 컴포넌트) ─────────────────────────
//  ⚠️ 반드시 컴포넌트 밖(모듈 레벨)에 둘 것. LabdipPage 안에 정의하면
//     렌더마다 새 함수가 되어 매 글자 입력 시 input이 리마운트→포커스 유실됨.
const ColorRow = ({ c, updateColor, removeColor }) => {
  const letters = labdipLetters(c.letters);
  const preview = (c.baseNo || c.name)
    ? `${c.baseNo || '(넘버)'} ${letters.map(L => `"${L}"`).join(', ')}`
    : '';
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-6 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">컬러명</label>
          <input value={c.name ?? ''} onChange={e => updateColor(c.id, 'name', e.target.value)} placeholder="CHARCOAL"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">베이스 넘버</label>
          <input value={c.baseNo ?? ''} onChange={e => updateColor(c.id, 'baseNo', e.target.value)} placeholder="25S038"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="col-span-5 sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">낱장 수</label>
          <select value={c.letters ?? 2} onChange={e => updateColor(c.id, 'letters', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
            {Array.from({ length: 8 }, (_, i) => i + 1).map(n => {
              const ls = labdipLetters(n);
              return <option key={n} value={n}>{n === 1 ? 'A' : `A~${ls[ls.length - 1]}`} ({n}장)</option>;
            })}
          </select>
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">컬러 코멘트</label>
          <input value={c.comment ?? ''} onChange={e => updateColor(c.id, 'comment', e.target.value)} placeholder="예: A안 채택 요망"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="col-span-1 flex justify-end">
          <button onClick={() => removeColor(c.id)} title="컬러 삭제"
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* 자동 생성 미리보기 */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-600">
        <SwatchBook className="w-3.5 h-3.5 shrink-0" />
        <span className="font-bold">생성:</span>
        <span className="font-mono truncate">{preview || <span className="text-slate-400 font-sans">컬러명 또는 넘버를 입력하면 자동 생성됩니다</span>}</span>
      </div>
    </div>
  );
};

export const LabdipPage = ({
  labdipInput, setLabdipInput, editingLabdipId,
  handleLabdipChange, resetLabdipForm,
  addColor, removeColor, updateColor,
  handleSaveLabdip, handleEditLabdip, handleDuplicateLabdip, handleDeleteLabdip,
  handlePrintLabdip,
  labdips = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처(견적서 공유)
}) => {
  const [mode, setMode] = useState('list');     // 'list' | 'form'
  const [listSearch, setListSearch] = useState('');

  // ── 모드 전환 ──
  const openNew = () => { resetLabdipForm(); setMode('form'); };
  const openEdit = (id) => { handleEditLabdip(id); setMode('form'); };
  const backToList = () => { setMode('list'); resetLabdipForm(); };
  const onSave = async () => { await handleSaveLabdip(); /* 저장 후 폼 유지 (인쇄/추가편집 가능) */ };

  // 보관함 목록 (검색 + 최신순)
  const filteredList = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    return [...(labdips || [])]
      .filter(t =>
        !term ||
        String(t.buyerName || '').toLowerCase().includes(term) ||
        String(t.article || '').toLowerCase().includes(term) ||
        String(t.style || '').toLowerCase().includes(term) ||
        (t.colors || []).some(c => String(c.name || '').toLowerCase().includes(term) || String(c.baseNo || '').toLowerCase().includes(term))
      )
      .sort((a, b) => String(b.updatedAt || b.date || '').localeCompare(String(a.updatedAt || a.date || '')));
  }, [labdips, listSearch]);

  // ════════════════════════════════════════════════════════
  // 상단 공통 헤더
  // ════════════════════════════════════════════════════════
  const Header = (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <SwatchBook className="w-6 h-6 text-indigo-600" /> Lab-Dip 발송
        <span className="text-base font-bold text-slate-400">({(labdips || []).length})</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="바이어·아티클·컬러 검색"
            className="border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm w-52 focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 text-sm font-bold shadow-lg shadow-indigo-200">
          <FilePlus className="w-4 h-4" /> 새 Lab-Dip
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 작성/편집 폼
  // ════════════════════════════════════════════════════════
  const FormPanel = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 폼 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-4 sm:px-5 py-3">
        <h3 className="text-base font-bold text-slate-800 shrink-0">
          {(editingLabdipId || labdipInput.id) ? 'Lab-Dip 편집' : 'Lab-Dip 작성'}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => handlePrintLabdip(labdipInput)} className="bg-white border border-slate-300 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 text-sm font-bold">
            <Download className="w-4 h-4" /> PDF 인쇄
          </button>
          <button onClick={onSave} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-sm font-bold">
            <Save className="w-4 h-4" /> 저장
          </button>
          <button onClick={backToList} className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-sm font-bold">
            <X className="w-4 h-4" /> 닫기
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* 발송 정보 (헤더) */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">발송 정보 (시트 상단)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">바이어 * (거래처)</label>
              <PartnerSelectField
                value={labdipInput.buyerName || ''}
                onSelect={(p) => setLabdipInput(prev => ({ ...prev, buyerName: p.name || '' }))}
                partners={partners}
                savePartner={savePartner}
                deletePartner={deletePartner}
                makeEmptyPartner={makeEmptyPartner}
                placeholder="거래처 선택 / 등록"
              />
            </div>
            <Field label="작성일 (DATE)" type="date" value={labdipInput.date} onChange={e => handleLabdipChange('date', e.target.value)} />
            <div />
            <Field label="ARTICLE" value={labdipInput.article} onChange={e => handleLabdipChange('article', e.target.value)} placeholder="PW1000" upper />
            <Field label="STYLE" value={labdipInput.style} onChange={e => handleLabdipChange('style', e.target.value)} placeholder="선택 입력" upper />
          </div>
        </section>

        {/* 컬러 & 낱장 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Palette className="w-4 h-4" /> 컬러 &amp; 낱장 (Lab-Dip)
            </h3>
            <button onClick={addColor} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100">
              <Plus className="w-4 h-4" /> 컬러 추가
            </button>
          </div>
          <div className="space-y-2.5">
            {(labdipInput.colors || []).map((c) => <ColorRow key={c.id} c={c} updateColor={updateColor} removeColor={removeColor} />)}
            {(labdipInput.colors || []).length === 0 && (
              <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                ‘컬러 추가’로 컬러를 넣어주세요.
              </div>
            )}
          </div>
        </section>

        {/* 발송 기록 (PDF 미표시) */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">발송 기록</h3>
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold">
              <Info className="w-3 h-3" /> PDF에는 표시되지 않는 내부 기록용입니다
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="발송일" type="date" value={labdipInput.sentDate} onChange={e => handleLabdipChange('sentDate', e.target.value)} />
            <Field label="발송 방법" value={labdipInput.sentMethod} onChange={e => handleLabdipChange('sentMethod', e.target.value)} placeholder="퀵 / 택배 / 방문 …" list="labdip-sent-methods" />
            <datalist id="labdip-sent-methods">
              {SENT_METHODS.map(m => <option key={m} value={m} />)}
            </datalist>
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">특이사항</label>
              <textarea value={labdipInput.remarks ?? ''} onChange={e => handleLabdipChange('remarks', e.target.value)} rows={1}
                placeholder="예: 원단 로트 상이 / 재발송 건 / 바이어 요청사항 등"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-snug" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 좌측 좁은 목록 (폼 열렸을 때)
  // ════════════════════════════════════════════════════════
  const compactList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-150px)]">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <span className="text-xs font-extrabold text-slate-500">보관함 ({filteredList.length})</span>
        <button onClick={openNew} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
          <Plus className="w-3.5 h-3.5" /> 새로 작성
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {filteredList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">저장된 기록이 없습니다.</div>
        ) : filteredList.map(t => (
          <button key={t.id} onClick={() => openEdit(t.id)}
            className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-indigo-50/60 transition-colors ${String(labdipInput.id) === String(t.id) ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'border-l-[3px] border-l-transparent'}`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[13px] font-bold text-slate-800 truncate uppercase">{t.buyerName || '(바이어 미입력)'}</span>
              {sentBadge(t)}
            </div>
            <div className="text-[11px] text-slate-500 truncate uppercase">{t.article || '-'}{t.style ? ` · ${t.style}` : ''}</div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
              <span>{t.date}</span>
              <span>{(t.colors || []).length}컬러 · {swatchCount(t)}장</span>
            </div>
            {t.remarks ? <div className="text-[10px] text-amber-600 truncate mt-0.5" title={t.remarks}>※ {t.remarks}</div> : null}
          </button>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 보관함 전체 표 (기본 화면)
  // ════════════════════════════════════════════════════════
  const fullList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {filteredList.length === 0 ? (
        <div className="py-20 text-center">
          <SwatchBook className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-4">저장된 Lab-Dip 발송 기록이 없습니다.</p>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-lg shadow-indigo-200">
            <FilePlus className="w-4 h-4" /> 첫 Lab-Dip 작성하기
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold">작성일</th>
                <th className="py-2.5 px-3 font-bold">바이어</th>
                <th className="py-2.5 px-3 font-bold">ARTICLE / STYLE</th>
                <th className="py-2.5 px-3 font-bold text-center">컬러 · 낱장</th>
                <th className="py-2.5 px-3 font-bold">발송 상태</th>
                <th className="py-2.5 px-3 font-bold">특이사항</th>
                <th className="py-2.5 px-3 font-bold">작성자</th>
                <th className="py-2.5 px-3 font-bold text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map(t => (
                <tr key={t.id} onClick={() => openEdit(t.id)} className="hover:bg-indigo-50/40 cursor-pointer">
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{t.date}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 uppercase">{t.buyerName}</td>
                  <td className="py-2.5 px-3 text-slate-700 uppercase">
                    {t.article || '-'}
                    {t.style ? <span className="text-slate-400"> · {t.style}</span> : null}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500 whitespace-nowrap">
                    {(t.colors || []).length}컬러 · {swatchCount(t)}장
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {sentBadge(t)}
                    {t.sentMethod ? <span className="ml-1 text-[10px] text-slate-400">{t.sentMethod}</span> : null}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs max-w-[220px]">
                    <span className="block truncate" title={t.remarks || ''}>{t.remarks || <span className="text-slate-300">—</span>}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{t.authorName || '-'}</td>
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(t.id)} title="편집" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handlePrintLabdip(t)} title="PDF 인쇄" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Download className="w-4 h-4" /></button>
                      <button onClick={() => { handleDuplicateLabdip(t.id); setMode('form'); }} title="복제" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteLabdip(t.id)} title="삭제" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto w-full print:hidden">
      {Header}
      {mode === 'list' ? (
        fullList
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <aside className="w-full lg:w-72 shrink-0">{compactList}</aside>
          <div className="flex-1 min-w-0 w-full max-w-5xl">{FormPanel}</div>
        </div>
      )}
    </div>
  );
};
