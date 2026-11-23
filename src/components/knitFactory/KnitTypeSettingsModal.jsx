import React, { useRef, useState } from 'react';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown, Layers, Loader2, Info } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { UNGROUPED_FAMILY, familyTone } from '../../utils/knitFactoryModel';

// ============================================================
// [⚙ 기계 종류] 설정 창 (편직처 기계 현황 — 대표님 요청 2026-11-23, 2차)
//  · 계열(그룹) 목록 — 이름 · 순서 · 추가 · 지우기 (그 계열의 종류가 있으면 못 지움)
//  · 기계 종류 목록 — 이름 · 계열 · 순서 · 추가 · 지우기 (예: 싱글 · 싱글 자카드 · 양면 · 양면 자카드 · 벨로아 · 양면벨로아 · 시루)
//  · 종류 이름을 바꾸면 그 종류를 쓰는 편직처 기계 · 가마 줄도 같이 바뀜 (확인 창)
//  · 쓰는 종류를 지워도 그 기계는 남고 '설정에 없음' 표시
//  · 회사 공통 (settings/general.knitMachineConfig) — [저장]을 눌러야 저장
// ============================================================

const cellCls = 'w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 ring-violet-200';
const rid = () => `r_${Math.random().toString(36).slice(2, 8)}`;
const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export const KnitTypeSettingsModal = ({
  config,             // 지금 설정 { families, types }
  typeUsage,          // (종류 이름) => 쓰는 편직처 수
  onSave,             // ({ families, types }, renames: [{ from, to }]) => 성공 true
  onClose,
}) => {
  const [baseline] = useState(() => ({
    families: config.families.filter(f => f !== UNGROUPED_FAMILY).map(name => ({ id: rid(), name, orig: name })),
    types: config.types.map(t => ({ id: rid(), name: t.name, family: t.family, orig: t.name })),
  }));
  const [form, setForm] = useState(baseline);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const { isDirty } = useUnsavedGuard(form, true, { initial: baseline });

  const famNames = form.families.map(f => f.name.trim()).filter(Boolean);
  const setFamily = (id, name) => setForm(prev => {
    const old = prev.families.find(f => f.id === id)?.name;
    return {
      families: prev.families.map(f => (f.id === id ? { ...f, name } : f)),
      // 계열 이름을 바꾸면 그 계열의 종류도 따라감
      types: prev.types.map(t => (t.family === old ? { ...t, family: name } : t)),
    };
  });
  const removeFamily = (id) => {
    const fam = form.families.find(f => f.id === id);
    const used = form.types.filter(t => t.family === fam?.name).length;
    if (used) { setError(`'${fam.name}' 계열에 종류가 ${used}개 있어요. 종류를 다른 계열로 옮긴 뒤 지워 주세요.`); return; }
    setError('');
    setForm(prev => ({ ...prev, families: prev.families.filter(f => f.id !== id) }));
  };
  const addFamily = () => setForm(prev => ({ ...prev, families: [...prev.families, { id: rid(), name: '', orig: '' }] }));
  const setType = (id, fields) => setForm(prev => ({ ...prev, types: prev.types.map(t => (t.id === id ? { ...t, ...fields } : t)) }));
  const addType = () => setForm(prev => ({ ...prev, types: [...prev.types, { id: rid(), name: '', family: famNames[0] || '', orig: '' }] }));
  const removeType = (id) => {
    const t = form.types.find(x => x.id === id);
    const used = t?.orig ? typeUsage?.(t.orig) || 0 : 0;
    if (used && !window.confirm(`'${t.orig}' 종류를 쓰는 편직처가 ${used}곳 있어요.\n목록에서 빼도 그 기계 · 가마 줄은 그대로 남고 '설정에 없음'으로 보여요.\n\n뺄까요?`)) return;
    setForm(prev => ({ ...prev, types: prev.types.filter(x => x.id !== id) }));
  };

  const doSave = async () => {
    if (busyRef.current) return false;
    const families = form.families.map(f => f.name.trim()).filter(Boolean);
    const types = form.types.map(t => ({ ...t, name: t.name.trim() })).filter(t => t.name);
    if (new Set(families).size !== families.length) { setError('계열 이름이 겹쳐요.'); return false; }
    if (new Set(types.map(t => t.name)).size !== types.length) { setError('종류 이름이 겹쳐요.'); return false; }
    if (families.includes(UNGROUPED_FAMILY)) { setError(`'${UNGROUPED_FAMILY}'는 계열 이름으로 쓸 수 없어요.`); return false; }
    const noFamily = types.filter(t => !families.includes(t.family));
    if (noFamily.length) { setError(`계열을 고르지 않은 종류가 있어요: ${noFamily.map(t => t.name).join(', ')}`); return false; }
    const renames = types.filter(t => t.orig && t.orig !== t.name).map(t => ({ from: t.orig, to: t.name, used: typeUsage?.(t.orig) || 0 }));
    const usedRenames = renames.filter(r => r.used);
    if (usedRenames.length && !window.confirm(
      `종류 이름을 바꾸면 그 종류를 쓰는 편직처 기계 · 가마 줄도 같이 바뀌어요.\n\n${usedRenames.map(r => `· ${r.from} → ${r.to} (${r.used}곳)`).join('\n')}\n\n계속할까요?`,
    )) return false;
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      return await onSave({ families, types: types.map(t => ({ name: t.name, family: t.family })) }, renames);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const handleSave = async () => { if (await doSave()) onClose(); };
  const requestClose = () => { if (isDirty()) setPending(() => onClose); else onClose(); };

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[10005] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-violet-600" /> 기계 종류 · 계열</h3>
              <p className="text-[11px] text-slate-500">회사 공통 목록이에요. 순서대로 목록 · 찾기 · 지도에 묶여 보여요.</p>
            </div>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
            {/* 계열 */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-700">계열 (그룹)</h4>
              {form.families.map((f, i) => (
                <div key={f.id} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full border shrink-0 ${familyTone({ families: famNames }, f.name.trim())}`} />
                  <input value={f.name} onChange={e => setFamily(f.id, e.target.value)} placeholder="계열 이름" className={cellCls} />
                  <button type="button" onClick={() => setForm(p => ({ ...p, families: move(p.families, i, -1) }))} className="p-1 text-slate-400 hover:text-slate-700" title="위로"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, families: move(p.families, i, 1) }))} className="p-1 text-slate-400 hover:text-slate-700" title="아래로"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => removeFamily(f.id)} className="p-1 text-slate-400 hover:text-red-600" title="지우기"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={addFamily} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 계열 추가</button>
            </section>

            {/* 종류 */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-700">기계 종류</h4>
              {form.types.map((t, i) => {
                const used = t.orig ? typeUsage?.(t.orig) || 0 : 0;
                return (
                  <div key={t.id} className="flex items-center gap-1">
                    <input value={t.name} onChange={e => setType(t.id, { name: e.target.value })} placeholder="예: 싱글 자카드" className={`${cellCls} flex-1`} />
                    <select value={famNames.includes(t.family) ? t.family : ''} onChange={e => setType(t.id, { family: e.target.value })} className={`${cellCls} w-28 ${famNames.includes(t.family) ? '' : 'border-red-300'}`}>
                      <option value="">계열 고르기</option>
                      {famNames.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <span className="w-14 text-[10px] text-slate-400 text-right" title="이 종류를 쓰는 편직처">{used ? `${used}곳` : ''}</span>
                    <button type="button" onClick={() => setForm(p => ({ ...p, types: move(p.types, i, -1) }))} className="p-1 text-slate-400 hover:text-slate-700" title="위로"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, types: move(p.types, i, 1) }))} className="p-1 text-slate-400 hover:text-slate-700" title="아래로"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => removeType(t.id)} className="p-1 text-slate-400 hover:text-red-600" title="목록에서 빼기"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button type="button" onClick={addType} className="text-xs font-bold text-violet-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 종류 추가</button>
              <p className="text-[11px] text-slate-500 flex items-start gap-1 pt-1"><Info className="w-3.5 h-3.5 mt-px shrink-0" /> 이름을 바꾸면 그 종류를 쓰는 편직처도 같이 바뀌어요. 빼면 그 기계는 남고 '설정에 없음'으로 보여요.</p>
            </section>
          </div>

          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
            <p className="text-xs font-bold text-red-600">{error}</p>
            <div className="flex gap-2">
              <button type="button" onClick={requestClose} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">취소</button>
              <button type="button" onClick={handleSave} disabled={busy}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>
      <UnsavedChangesDialog
        open={!!pending}
        message="기계 종류 목록에 저장하지 않은 변경이 있어요. 저장할까요?"
        onSave={async () => { const act = pending; if (await doSave()) { setPending(null); if (act) act(); } else setPending(null); }}
        onDiscard={() => { const act = pending; setPending(null); if (act) act(); }}
        onKeepEditing={() => setPending(null)}
      />
    </>
  );
};
