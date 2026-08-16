import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Save, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Landmark, FileText, Globe, Home,
} from 'lucide-react';
import { getEffectivePISettings, defaultPITerms, PI_BANK_FIELDS } from '../../constants/proformaInvoice';

// ============================================================
// PI 설정 모달 — 은행정보 + 약관(Terms & Conditions)을 수출/내수 각각 편집
//  · 저장값은 settings/general.piSettings 로 보관 (App.jsx의 savePISettings)
//  · 저장값이 없으면 상수 기본값을 시드해 보여줌
//  · 수출=USD 계좌 / 내수=원화 계좌 를 여기서 입력
//  · 부모(App)에서 열릴 때만 마운트 → useState 초기화로 편집 상태 시드 (effect 불필요)
// ============================================================
export const PISettingsModal = ({ onClose, piSettings, onSave, showToast }) => {
  const [tab, setTab] = useState('export');   // 'export' | 'domestic'
  // 마운트 시점(=열릴 때)의 설정을 깊은 복제해 편집 상태로 시드
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(getEffectivePISettings(piSettings))));

  if (!local) return null;

  const isExport = tab === 'export';
  const cur = local[tab];
  const bankFields = PI_BANK_FIELDS[tab];

  // ── 편집 헬퍼 ──
  const setBank = (key, value) =>
    setLocal(prev => ({ ...prev, [tab]: { ...prev[tab], bank: { ...prev[tab].bank, [key]: value } } }));

  const setTerm = (idx, field, value) =>
    setLocal(prev => {
      const terms = [...prev[tab].terms];
      terms[idx] = { ...terms[idx], [field]: value };
      return { ...prev, [tab]: { ...prev[tab], terms } };
    });

  const addTerm = () =>
    setLocal(prev => ({ ...prev, [tab]: { ...prev[tab], terms: [...prev[tab].terms, { title: '', body: '' }] } }));

  const removeTerm = (idx) =>
    setLocal(prev => ({ ...prev, [tab]: { ...prev[tab], terms: prev[tab].terms.filter((_, i) => i !== idx) } }));

  const moveTerm = (idx, dir) =>
    setLocal(prev => {
      const terms = [...prev[tab].terms];
      const j = dir === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= terms.length) return prev;
      [terms[idx], terms[j]] = [terms[j], terms[idx]];
      return { ...prev, [tab]: { ...prev[tab], terms } };
    });

  const resetTerms = () => {
    if (!window.confirm(`${isExport ? '수출' : '내수'} 약관을 기본값으로 되돌릴까요? (저장 전까지는 반영 안 됨)`)) return;
    setLocal(prev => ({ ...prev, [tab]: { ...prev[tab], terms: defaultPITerms(isExport) } }));
  };

  const handleSave = () => {
    const clean = (m) => ({
      bank: local[m].bank,
      terms: local[m].terms
        .map(t => ({ title: String(t.title || '').trim(), body: String(t.body || '').trim() }))
        .filter(t => t.title || t.body),
    });
    onSave({ export: clean('export'), domestic: clean('domestic') });
    showToast && showToast('PI 설정이 저장되었습니다.', 'success');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9995] bg-black/40 flex items-start justify-center p-4 overflow-y-auto print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" /> PI / 거래확인서 설정
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* 수출/내수 탭 */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
            <button onClick={() => setTab('export')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${isExport ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <Globe className="w-4 h-4" /> 수출 PI
            </button>
            <button onClick={() => setTab('domestic')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${!isExport ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <Home className="w-4 h-4" /> 내수 거래확인서
            </button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-6">
          {/* 은행 정보 */}
          <section>
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" /> 입금 계좌 {isExport ? '(USD)' : '(원화)'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bankFields.map(f => (
                <div key={f.key} className={f.key === 'beneficiaryAddress' ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{f.label}</label>
                  <input
                    value={cur.bank[f.key] ?? ''}
                    onChange={e => setBank(f.key, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 약관 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> 약관 (Terms &amp; Conditions) · {cur.terms.length}개 조항
              </h4>
              <div className="flex items-center gap-1.5">
                <button onClick={resetTerms} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50">
                  <RotateCcw className="w-3.5 h-3.5" /> 기본값 복원
                </button>
                <button onClick={addTerm} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50">
                  <Plus className="w-3.5 h-3.5" /> 조항 추가
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {cur.terms.map((t, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                    <input
                      value={t.title ?? ''}
                      onChange={e => setTerm(idx, 'title', e.target.value)}
                      placeholder="조항 제목 (예: ACCEPTANCE / 계약의 성립)"
                      className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => moveTerm(idx, 'up')} disabled={idx === 0} title="위로"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => moveTerm(idx, 'down')} disabled={idx === cur.terms.length - 1} title="아래로"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                      <button onClick={() => removeTerm(idx)} title="삭제"
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <textarea
                    value={t.body ?? ''}
                    onChange={e => setTerm(idx, 'body', e.target.value)}
                    rows={2}
                    placeholder="조항 내용"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-[13px] leading-snug focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                  />
                </div>
              ))}
              {cur.terms.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  약관이 없습니다. ‘조항 추가’ 또는 ‘기본값 복원’을 눌러주세요.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
          <span className="text-[11px] text-slate-400">수출/내수 설정은 각각 저장됩니다. (탭을 바꿔 확인하세요)</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100">닫기</button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800">
              <Save className="w-4 h-4" /> 저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
