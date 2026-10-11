import React, { useEffect, useRef, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { GREIGE_OUT_KINDS } from '../../../constants/production';
import { createGreigeOut, getGreigeState } from '../../../utils/orderModel';
import { shortDate, todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 생지 출고 입력 창 (컬러 1개 — 현황표 생지출고 칸 · 상세창 · 간트 공용) — 대표님 요청 2026-10-11
// ------------------------------------------------------------
// - 출고마다 한 줄: 날짜 · 전체/부분 · 메모(부분이면 어떤 분인지) · 출고 체크
//   · 전체 출고 = 남은 생지 전부 → 체크하면 그 컬러 생지 출고 끝 (염색대기)
//   · 부분 출고 = 일부만 → 컬러 단계 '생지 부분출고'
// - 출고 체크했는데 날짜가 비었으면 오늘로 채움 (간트에 보이게)
// - 로컬 draft 로 편집 → [저장] 한 번에 onSave(entries). Enter = 저장, 닫을 때 저장 안 한 변경이 있으면 묻기
// props: order, color, anchorRect(null = 화면 가운데), onClose, onSave(entries) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

const toRows = (color) => (color?.greigeOuts || []).map(g => ({ ...g }));

const clean = (rows) => rows.map(r => ({ id: r.id, date: r.date || '', kind: r.kind === 'partial' ? 'partial' : 'full', memo: String(r.memo || '').trim(), done: !!r.done }));

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox';
};

export const GreigeOutPopover = ({ order, color, anchorRect = null, onClose, onSave }) => {
  const [initial] = useState(() => toRows(color));
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order || !color) return null;

  const isDirty = JSON.stringify(clean(rows)) !== JSON.stringify(clean(initial));
  const state = getGreigeState({ greigeOuts: clean(rows) });
  const route = `${order.steps?.knitting?.vendor || '편직처'} → ${order.dyeVendor || '염색소'}`;

  // ---------- 변경 ----------
  const update = (id, patch) => setRows(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const toggleDone = (id, done) => setRows(list => list.map(r => {
    if (r.id !== id) return r;
    return done && !r.date ? { ...r, done, date: todayYmd() } : { ...r, done };
  }));
  const remove = (id) => setRows(list => list.filter(r => r.id !== id));
  // 첫 출고는 '전체', 이미 출고가 있으면 '부분' (나머지를 보낼 땐 '전체'로 바꿔서)
  const add = () => setRows(list => [...list, createGreigeOut(list.length ? 'partial' : 'full')]);

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!isDirty) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(clean(rows))) !== false;
    } catch {
      ok = false;
    }
    savingRef.current = false;
    if (closedRef.current) return;
    if (ok) close();
    else setSaving(false);
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500">
        {state.fullDone
          ? '전체 출고 끝 — 염색대기'
          : state.partialDone ? `부분 출고 ${state.doneCount}건 — 나머지가 나가면 '전체'로 체크` : '아직 출고 전'}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={close}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={500}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 생지 출고`}
      subtitle={route}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-2 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {rows.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-slate-400">아직 생지 출고 기록이 없어요. 아래 [출고 추가]로 넣어 주세요.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => {
              const partial = r.kind === 'partial';
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border p-2 space-y-1.5 ${r.done ? 'border-lime-300 bg-lime-50/60' : 'border-slate-200 bg-white'}`}
                >
                  <div className="grid grid-cols-[28px_128px_1fr_auto_auto] items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-lime-800">{i + 1}차</span>
                    <input
                      type="date"
                      value={r.date}
                      onChange={e => update(r.id, { date: e.target.value })}
                      aria-label={`${i + 1}차 출고일`}
                      className={INPUT_CLS}
                    />
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden" role="radiogroup" aria-label={`${i + 1}차 전체/부분`}>
                      {GREIGE_OUT_KINDS.map(k => {
                        const active = r.kind === k.key;
                        return (
                          <button
                            key={k.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => update(r.id, { kind: k.key })}
                            className={`flex-1 px-2 py-1 text-[11px] font-bold transition-colors ${active ? `${k.cls} border-0` : 'bg-white text-slate-400 hover:text-slate-600'}`}
                          >
                            {k.short}
                          </button>
                        );
                      })}
                    </div>
                    <label className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!r.done}
                        onChange={e => toggleDone(r.id, e.target.checked)}
                        className="w-3.5 h-3.5 accent-lime-600"
                      />
                      출고
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title={`${i + 1}차 출고 지우기`}
                      aria-label={`${i + 1}차 출고 지우기`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.memo}
                    onChange={e => update(r.id, { memo: e.target.value })}
                    placeholder={partial ? '어떤 분인지 (예: LOT1·2분 600kg, 롤 12개)' : '메모 (선택)'}
                    aria-label={`${i + 1}차 출고 메모`}
                    className={`${INPUT_CLS} ${partial && !r.memo.trim() ? 'border-amber-300 bg-amber-50/40' : ''}`}
                  />
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={add}
          className="w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-lime-400 bg-white text-[11px] font-bold text-lime-800 hover:bg-lime-50"
        >
          <Plus className="w-3.5 h-3.5" /> 출고 추가 ({rows.length + 1}차)
        </button>

        <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
          <Info className="w-3 h-3 mt-px shrink-0" />
          <span>
            <b>전체</b> = 남은 생지 전부 (체크하면 이 컬러 생지 출고 끝) · <b>부분</b> = 일부만 — 메모에 어떤 분인지 적어 주세요.
            {state.lastDate ? ` 마지막 출고(예정) ${shortDate(state.lastDate)}.` : ''}
          </span>
        </p>
      </div>
    </PopoverShell>
  );
};

export default GreigeOutPopover;
