import React, { useRef, useState } from 'react';
import { AlertCircle, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import {
  FLOW_ANCHOR_LABELS, PROCESS_THEME, buildFlowOrder, createCustomStepKey, findStepMeta, getCustomStepDescendants,
} from '../../../constants/production';
import { isStepUsed } from '../../../utils/orderModel';

// ============================================================
// 공정 추가 · 관리 창 (현황표 [공정 추가] — 대표님 요청 2026-10-11 '공정을 추가할 수 있게')
// ------------------------------------------------------------
// - 공정 이름 · 위치(어느 칸 다음) · 외주처 이름(예: 가공처)을 정하면 모든 오더에 그 공정 칸이 생김
//   (칸을 채운 오더만 "사용하는 공정" — 외주처 · 예상 시작/종료일 · 상태 · 메모)
// - 추가 / 이름·위치 바꾸기 / 삭제는 누르는 즉시 저장 (settings/general.productionSteps — 모든 PC 공통)
// - 삭제: 그 공정에 입력한 오더가 있으면 알려 줌 (입력한 값은 오더 문서에 남고 화면에서만 안 보임)
// - 프리세팅처럼 기본으로 있는 공정은 여기서 지우지 않음 (칸 보이기/숨기기로 숨김)
// props: anchorRect, customSteps, stepDefs, orders(입력된 오더 수 세기), onSave(list) => Promise<boolean>, onClose
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400';
const LABEL_CLS = 'block mb-1 text-[11px] font-bold text-slate-500';

// 위치로 고를 수 없는 컬러별 칸 (생지출고 · 컨펌 · 출고 사이에는 끼우지 않음)
const isAnchorToken = (tok) => !tok.startsWith('#') || !!FLOW_ANCHOR_LABELS[tok];

const anchorLabel = (stepDefs, tok) => FLOW_ANCHOR_LABELS[tok] || findStepMeta(stepDefs, tok)?.label || '';

const emptyForm = (after = 'knitting') => ({ label: '', after, vendorLabel: '' });

export const StepManagerPopover = ({ anchorRect = null, customSteps = [], stepDefs = [], orders = [], onSave, onClose }) => {
  const [form, setForm] = useState(() => emptyForm());
  const [editing, setEditing] = useState(null); // { key, label, after, vendorLabel } — 이름·위치 바꾸는 중
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // 처리 중 잠금 (빠른 두 번 누름 방지)

  // 위치 고르기 목록 (흐름 순서) — skipKey: 바꾸는 중인 공정 자신과 그 공정 뒤에 놓인 공정은 빼고 (돌고 도는 위치 방지)
  const anchorOptions = (skipKey = null) => {
    const blocked = skipKey ? getCustomStepDescendants(customSteps, skipKey) : new Set();
    return buildFlowOrder(customSteps)
      .filter(tok => tok !== skipKey && !blocked.has(tok) && isAnchorToken(tok))
      .map(tok => ({ key: tok, label: anchorLabel(stepDefs, tok) }))
      .filter(o => o.label);
  };

  const usedCount = (key) => orders.filter(o => isStepUsed(o.steps?.[key])).length;

  // 같은 이름의 공정이 이미 있는지 (기본 공정 포함, 띄어쓰기·대소문자 무시)
  const nameTaken = (label, skipKey = null) => {
    const t = label.replace(/\s+/g, '').toLowerCase();
    return stepDefs.some(s => s.key !== skipKey && String(s.label).replace(/\s+/g, '').toLowerCase() === t);
  };

  const editingOriginal = editing ? customSteps.find(s => s.key === editing.key) || null : null;
  const editDirty = !!(editing && editingOriginal && (
    editing.label.trim() !== editingOriginal.label
    || editing.after !== editingOriginal.after
    || (editing.vendorLabel.trim() || '외주처') !== (editingOriginal.vendorLabel || '외주처')
  ));
  const isDirty = !!form.label.trim() || editDirty;

  // ---------- 저장 ----------
  const run = async (nextList, after) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(nextList)) !== false;
    } catch {
      ok = false;
    }
    savingRef.current = false;
    setSaving(false);
    if (ok) after?.();
    else setError('저장하지 못했어요. 다시 시도해 주세요.');
    return ok;
  };

  const addStep = () => {
    const label = form.label.trim();
    if (!label) {
      setError('공정 이름을 넣어 주세요.');
      return;
    }
    if (nameTaken(label)) {
      setError(`'${label}' 공정이 이미 있어요.`);
      return;
    }
    setError('');
    const next = [...customSteps, {
      key: createCustomStepKey(),
      label,
      after: form.after,
      vendorLabel: form.vendorLabel.trim() || '외주처',
    }];
    run(next, () => setForm(emptyForm(form.after)));
  };

  const saveEdit = () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) {
      setError('공정 이름을 넣어 주세요.');
      return;
    }
    if (nameTaken(label, editing.key)) {
      setError(`'${label}' 공정이 이미 있어요.`);
      return;
    }
    setError('');
    if (!editDirty) {
      setEditing(null);
      return;
    }
    const next = customSteps.map(s => (s.key === editing.key
      ? { ...s, label, after: editing.after, vendorLabel: editing.vendorLabel.trim() || '외주처' }
      : s));
    run(next, () => setEditing(null));
  };

  const removeStep = (cs) => {
    const n = usedCount(cs.key);
    const msg = n > 0
      ? `'${cs.label}' 공정을 지울까요?\n입력된 오더 ${n}건이 있어요. 입력한 값은 오더에 남지만 현황표·간트에서는 안 보여요.`
      : `'${cs.label}' 공정을 지울까요?`;
    if (!window.confirm(msg)) return;
    // 이 공정 다음에 두었던 다른 추가 공정은 이 공정의 위치로 (순서가 크게 흔들리지 않게)
    const next = customSteps
      .filter(s => s.key !== cs.key)
      .map(s => (s.after === cs.key ? { ...s, after: cs.after } : s));
    run(next, () => {
      if (editing?.key === cs.key) setEditing(null);
    });
  };

  // 저장 안 한 입력이 있을 때 '저장하고 나가기' — 바꾸는 중이면 그 저장, 아니면 추가
  const saveAndClose = async () => {
    if (editDirty) {
      const label = editing.label.trim();
      if (!label || nameTaken(label, editing.key)) {
        saveEdit(); // 오류 문구만 보여 줌
        return;
      }
      const next = customSteps.map(s => (s.key === editing.key
        ? { ...s, label, after: editing.after, vendorLabel: editing.vendorLabel.trim() || '외주처' }
        : s));
      if (await run(next)) onClose?.();
      return;
    }
    const label = form.label.trim();
    if (!label || nameTaken(label)) {
      addStep();
      return;
    }
    const next = [...customSteps, { key: createCustomStepKey(), label, after: form.after, vendorLabel: form.vendorLabel.trim() || '외주처' }];
    if (await run(next)) onClose?.();
  };

  // Enter = 그 칸이 있는 폼 저장 (바꾸는 중인 줄 안이면 그 줄 저장, '새 공정' 칸이면 추가)
  const onFormKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.target?.tagName !== 'INPUT') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target.closest('[data-edit-row]')) saveEdit();
    else addStep();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] text-slate-400 leading-snug">추가·변경·삭제는 바로 저장돼요 (모든 PC 공통).</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
      >
        닫기
      </button>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={440}
      title="공정 추가 · 관리"
      subtitle="추가한 공정은 모든 오더에 칸이 생겨요 (외주처·예상 시작/종료일·상태·메모)"
      onClose={onClose}
      dirty={isDirty && !saving}
      onSaveDirty={saveAndClose}
      dirtyMessage="입력하던 공정이 아직 저장되지 않았어요. 저장할까요?"
      footer={footer}
    >
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onFormKeyDown}>
        {/* 추가한 공정 목록 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500">추가한 공정 ({customSteps.length})</div>
          {customSteps.length === 0 ? (
            <p className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-2.5 py-2">
              아직 추가한 공정이 없어요. 아래에서 이름과 위치를 정해 추가해 주세요. (프리세팅은 기본으로 있어요)
            </p>
          ) : customSteps.map(cs => {
            const n = usedCount(cs.key);
            const isEditing = editing?.key === cs.key;
            if (isEditing) {
              return (
                <div key={cs.key} data-edit-row="" className="rounded-lg border border-indigo-300 bg-indigo-50/60 p-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block min-w-0">
                      <span className={LABEL_CLS}>공정 이름</span>
                      <input
                        type="text"
                        value={editing.label}
                        onChange={e => setEditing(ed => ({ ...ed, label: e.target.value }))}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className={LABEL_CLS}>외주처 이름</span>
                      <input
                        type="text"
                        value={editing.vendorLabel}
                        onChange={e => setEditing(ed => ({ ...ed, vendorLabel: e.target.value }))}
                        placeholder="외주처"
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className={LABEL_CLS}>위치</span>
                    <select
                      value={editing.after}
                      onChange={e => setEditing(ed => ({ ...ed, after: e.target.value }))}
                      className={INPUT_CLS}
                    >
                      {anchorOptions(cs.key).map(o => <option key={o.key} value={o.key}>{o.label} 다음</option>)}
                    </select>
                  </label>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setEditing(null); setError(''); }}
                      className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-3 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={cs.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${PROCESS_THEME.custom.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-slate-800 truncate">{cs.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {anchorLabel(stepDefs, cs.after) || '맨 뒤'} 다음 · 외주처 이름 '{cs.vendorLabel || '외주처'}'
                    {n > 0 ? ` · 입력된 오더 ${n}건` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEditing({ key: cs.key, label: cs.label, after: cs.after, vendorLabel: cs.vendorLabel || '' });
                  }}
                  disabled={saving}
                  className="p-1 rounded text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                  title="이름·위치 바꾸기"
                  aria-label={`${cs.label} 이름·위치 바꾸기`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(cs)}
                  disabled={saving}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                  title="공정 지우기"
                  aria-label={`${cs.label} 지우기`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 새 공정 추가 */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-2.5 space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-800">
            <ListPlus className="w-3.5 h-3.5" /> 새 공정
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className={LABEL_CLS}>공정 이름</span>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="예) 기모, 텐타"
                className={INPUT_CLS}
              />
            </label>
            <label className="block min-w-0">
              <span className={LABEL_CLS}>외주처 이름</span>
              <input
                type="text"
                value={form.vendorLabel}
                onChange={e => setForm(f => ({ ...f, vendorLabel: e.target.value }))}
                placeholder="예) 가공처"
                className={INPUT_CLS}
              />
            </label>
          </div>
          <label className="block">
            <span className={LABEL_CLS}>위치</span>
            <select
              value={form.after}
              onChange={e => setForm(f => ({ ...f, after: e.target.value }))}
              className={INPUT_CLS}
            >
              {anchorOptions().map(o => <option key={o.key} value={o.key}>{o.label} 다음</option>)}
            </select>
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addStep}
              disabled={saving || !form.label.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" /> {saving ? '저장 중…' : '공정 추가'}
            </button>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>
    </PopoverShell>
  );
};

export default StepManagerPopover;
