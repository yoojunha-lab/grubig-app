import React, { useRef, useState } from 'react';
import { X, Settings2, Trash2, Plus } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { normalizeCare } from '../../utils/hangerSticker';

// ============================================================
// 헹거 스티커 설정 — CATEGORY · CARE 목록 (대표님 요청 2026-10-14 '설정에서 추가 가능')
//  · 회사 공통 (settings/general.hangerStickerOptions) — [추가]·🗑 를 누르면 바로 저장 (원사 분류·바이어 목록과 같은 방식)
//  · CATEGORY 첫 번째 = 새 스티커 기본값 / CARE는 이 순서대로 엑셀 CARE 칸에 한 줄에 하나씩
//  · 목록에서 지워도 이미 만든 스티커의 값은 그대로 (입력 창에 '설정에 없음'으로 보임). 마지막 하나는 못 지움
//  · 추가 칸에 글자를 넣고 [추가]를 안 누른 채 닫으면 '저장할까요?' (팝업 창 규약)
// ============================================================

const SECTIONS = [
  { key: 'categories', title: 'CATEGORY', hint: '가운데 큰 글자 — 첫 번째가 새 스티커 기본값', placeholder: '예: MERINO BASIC' },
  { key: 'careItems', title: 'CARE', hint: '체크해서 넣는 항목 — 이 순서대로 엑셀 CARE 칸에 한 줄에 하나씩', placeholder: '예: DRY FLAT' },
];

const cleanItem = (v) => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();

export const StickerSettingsModal = ({ options, stickers = [], onSave, onClose }) => {
  const [drafts, setDrafts] = useState({ categories: '', careItems: '' }); // 추가 칸 글자
  const [notes, setNotes] = useState({});                                 // 칸마다 안내 (이미 있어요 등)
  const [pendingClose, setPendingClose] = useState(false);
  const busyRef = useRef(false);

  const usedCount = (key, item) => (key === 'categories'
    ? stickers.filter(s => String(s.title || '').toUpperCase() === item).length
    : stickers.filter(s => normalizeCare(s.care).includes(item)).length);

  // 목록 하나만 바꿔서 저장 (App이 최신 설정에 얹음 — 두 목록을 이어서 추가해도 앞의 것이 덮이지 않게)
  const save = async (key, nextList) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    try {
      return (await onSave(key, nextList)) !== false;
    } finally {
      busyRef.current = false;
    }
  };

  const addItem = async (key) => {
    const item = cleanItem(drafts[key]);
    if (!item) return true;
    if ((options[key] || []).includes(item)) {
      setNotes(prev => ({ ...prev, [key]: `'${item}'은(는) 이미 있어요.` }));
      return false;
    }
    const ok = await save(key, [...(options[key] || []), item]);
    if (ok) {
      setDrafts(prev => ({ ...prev, [key]: '' }));
      setNotes(prev => ({ ...prev, [key]: '' }));
    }
    return ok;
  };

  const removeItem = async (key, item) => {
    const list = options[key] || [];
    if (list.length <= 1) {
      setNotes(prev => ({ ...prev, [key]: '마지막 하나는 지울 수 없어요.' }));
      return;
    }
    const used = usedCount(key, item);
    if (!window.confirm(`'${item}'을(를) 목록에서 지울까요?${used ? `\n이미 만든 스티커 ${used}장의 값은 그대로 남아요.` : ''}`)) return;
    if (await save(key, list.filter(x => x !== item))) setNotes(prev => ({ ...prev, [key]: '' }));
  };

  // 닫기 — 추가 칸에 글자가 남아 있으면 묻기
  const hasDraft = SECTIONS.some(s => cleanItem(drafts[s.key]));
  const requestClose = () => { if (hasDraft) setPendingClose(true); else onClose(); };
  const addDraftsAndClose = async () => {
    for (const s of SECTIONS) {
      if (cleanItem(drafts[s.key]) && !(await addItem(s.key))) { setPendingClose(false); return; }
    }
    setPendingClose(false);
    onClose();
  };

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[10005] bg-black/50 flex items-center justify-center p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-amber-600" /> 헹거 스티커 설정
            </h3>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              회사 공통 목록이에요. [추가]·🗑 를 누르면 바로 저장돼요. 목록에서 지워도 이미 만든 스티커의 값은 그대로예요.
            </p>
            {SECTIONS.map(sec => {
              const list = options[sec.key] || [];
              return (
                <section key={sec.key}>
                  <div className="mb-1.5">
                    <h4 className="text-sm font-extrabold text-slate-700">{sec.title}</h4>
                    <p className="text-[11px] text-slate-400">{sec.hint}</p>
                  </div>
                  <ul className="space-y-1.5 mb-2">
                    {list.map((item, idx) => {
                      const used = usedCount(sec.key, item);
                      return (
                        <li key={item} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-1.5 py-1.5">
                          <span className="flex-1 min-w-0 truncate text-sm font-extrabold text-slate-700">{item}</span>
                          {sec.key === 'categories' && idx === 0 && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">기본</span>
                          )}
                          <span className="text-[10px] text-slate-400 shrink-0">{used ? `${used}장 사용` : '사용 안 함'}</span>
                          <button type="button" onClick={() => removeItem(sec.key, item)} title="목록에서 지우기"
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex gap-2">
                    <input type="text" value={drafts[sec.key]} placeholder={sec.placeholder}
                      onChange={e => { const v = e.target.value.toUpperCase(); setDrafts(prev => ({ ...prev, [sec.key]: v })); setNotes(prev => ({ ...prev, [sec.key]: '' })); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addItem(sec.key); }}
                      className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold uppercase outline-none focus:ring-2 ring-amber-200 placeholder:font-normal" />
                    <button type="button" onClick={() => addItem(sec.key)}
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-600 flex items-center gap-1 shrink-0">
                      <Plus className="w-4 h-4" /> 추가
                    </button>
                  </div>
                  {notes[sec.key] && <p className="text-[11px] font-bold text-red-600 mt-1">{notes[sec.key]}</p>}
                </section>
              );
            })}
          </div>

          <div className="flex justify-end px-5 py-3 border-t border-slate-200 shrink-0">
            <button type="button" onClick={requestClose}
              className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">
              닫기
            </button>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={pendingClose}
        message="추가 칸에 [추가]하지 않은 글자가 있어요. 목록에 추가할까요?"
        onSave={addDraftsAndClose}
        onDiscard={() => { setPendingClose(false); onClose(); }}
        onKeepEditing={() => setPendingClose(false)}
      />
    </>
  );
};
