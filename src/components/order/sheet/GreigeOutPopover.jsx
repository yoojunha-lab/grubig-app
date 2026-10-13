import React, { useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { usePopoverSave } from '../common/usePopoverSave';
import { GREIGE_OUT_KINDS, DYE_METHODS } from '../../../constants/production';
import { createGreigeOut, getGreigeState, isPieceDyed, getOrderTotals, getWorkKg, getLossRate } from '../../../utils/orderModel';
import { fmtKg, shortDate, todayYmd, toNumberOrNull } from '../../../utils/orderCalculations';

// ============================================================
// 생지 출고 입력 창 (현황표 생지출고 칸 · 상세창 · 간트 공용) — 대표님 요청 2026-10-11 → 선염/후염 2026-10-14
// ------------------------------------------------------------
// - 염색 방식: 선염 = 컬러마다 출고 (지금처럼) / 후염 = 오더 전체 한 번에 (모든 컬러 공통 출고 기록)
//   위 [선염 · 후염]을 누르면 바로 저장 (저장 안 한 출고 변경이 있으면 먼저 저장해야 바꿀 수 있음)
//   후염으로 바꿀 때 컬러별로 넣어 둔 기록은 같은 날짜끼리 합쳐서 가져옴 (orderModel.applyDyeMethod)
// - 출고마다 한 줄: 날짜 · 전체/부분 · kg · 메모(부분이면 어떤 분인지) · 출고 체크
//   · 전체 출고 = 남은 생지 전부 → 체크하면 생지 출고 끝 (염색대기)
//   · 부분 출고 = 일부만 → 컬러 단계 '생지 부분출고'
//   · kg 은 LOT 배색량 합계와 비교할 때 씀 (LOT 창 — '생지 출고 900kg 중 배색 820kg')
// - 출고 체크했는데 날짜가 비었으면 오늘로 채움 (간트에 보이게)
// - 로컬 draft 로 편집 → [저장] 한 번에 onSave(entries, base). Enter = 저장, 닫을 때 저장 안 한 변경이 있으면 묻기
//   base = 열 때 목록 → 저장할 때 지금 저장된 목록과 합침 (열어 둔 사이 현황표에서 체크한 출고가 지워지지 않게 — orderModel.mergeById)
// props: order, color(선염 컬러 — 후염이면 없어도 됨), anchorRect(null = 화면 가운데), onClose,
//        onSave(entries, base, scope('order'|'color')) => Promise<boolean>, onSetDyeMethod(method) => Promise<boolean>,
//        prefillDate(간트에서 고른 날 — 그 날 출고 줄을 미리 넣어 둠)
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

const kgText = (v) => (v === null || v === undefined ? '' : String(v));
const kgBad = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return false;
  const n = toNumberOrNull(t);
  return n === null || n <= 0;
};
const kgOf = (text) => {
  const n = toNumberOrNull(String(text ?? '').trim());
  return n !== null && n > 0 ? n : null;
};

const scopeOf = (order) => (isPieceDyed(order) ? 'order' : 'color');
const sourceRows = (order, color) => ((scopeOf(order) === 'order' ? order?.greigeOuts : color?.greigeOuts) || [])
  .map(g => ({ ...g, kg: kgText(g.kg) }));

const clean = (rows) => rows.map(r => ({
  id: r.id, date: r.date || '', kind: r.kind === 'partial' ? 'partial' : 'full',
  memo: String(r.memo || '').trim(), done: !!r.done, kg: kgOf(r.kg),
}));

const makeState = (order, color, prefillDate = '') => {
  const initial = sourceRows(order, color);
  const rows = prefillDate
    ? [...initial, { ...createGreigeOut(initial.length ? 'partial' : 'full', prefillDate), kg: '' }]
    : initial;
  return { scope: scopeOf(order), initial, rows };
};

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox';
};

export const GreigeOutPopover = ({ order, color = null, anchorRect = null, onClose, onSave, onSetDyeMethod, prefillDate = '' }) => {
  const [state, setState] = useState(() => makeState(order, color, prefillDate));
  const [switching, setSwitching] = useState(false);
  const { saving, close, run } = usePopoverSave(onClose);

  // 선염 ↔ 후염을 바꾸면 보여 줄 목록이 바뀜 → 그 목록으로 새로 시작 (effect 없이 렌더 중 맞춤)
  const scope = scopeOf(order);
  if (order && state.scope !== scope) setState(makeState(order, color));

  if (!order) return null;
  // 오더 전체(후염) 창을 연 채로 선염으로 바꾼 경우 — 컬러마다 입력하라고 안내
  if (scope === 'color' && !color) {
    return (
      <PopoverShell anchorRect={anchorRect} width={340} title={`${order.orderNumber || '새 오더'} · 생지 출고`} onClose={close}>
        <div className="p-3 space-y-2 text-[11px] text-slate-600 leading-snug outline-none" tabIndex={-1} data-autofocus>
          <p>
            {order.dyeMethod === 'yarn' ? '선염으로 바꿨어요' : '후염이 아닌 오더예요'} — 생지 출고는 <b>컬러마다</b> 기록해요.
            현황표 컬러 줄의 '생지출고' 칸(상세창은 컬러 카드)에서 입력해 주세요.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>
      </PopoverShell>
    );
  }

  const { initial, rows } = state;
  const isDirty = JSON.stringify(clean(rows)) !== JSON.stringify(clean(initial));
  const badKg = rows.some(r => kgBad(r.kg));
  const st = getGreigeState({ greigeOuts: clean(rows) });
  const route = `${order.steps?.knitting?.vendor || '편직처'} → ${order.dyeVendor || '염색소'}`;
  const piece = scope === 'order';
  const needKg = piece
    ? getOrderTotals(order).workKg
    : getWorkKg(color, getLossRate(order));

  // ---------- 변경 ----------
  const setRows = (fn) => setState(s => ({ ...s, rows: fn(s.rows) }));
  const update = (id, patch) => setRows(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const toggleDone = (id, done) => setRows(list => list.map(r => {
    if (r.id !== id) return r;
    return done && !r.date ? { ...r, done, date: todayYmd() } : { ...r, done };
  }));
  const remove = (id) => setRows(list => list.filter(r => r.id !== id));
  // 첫 출고는 '전체', 이미 출고가 있으면 '부분' (나머지를 보낼 땐 '전체'로 바꿔서)
  const add = () => setRows(list => [...list, { ...createGreigeOut(list.length ? 'partial' : 'full'), kg: '' }]);

  const changeMethod = async (m) => {
    if (switching || m === order.dyeMethod || !onSetDyeMethod) return;
    if (isDirty) return;
    setSwitching(true);
    try {
      await onSetDyeMethod(m);
    } finally {
      setSwitching(false);
    }
  };

  // ---------- 저장 / 닫기 ----------
  const handleSave = () => {
    if (saving || badKg) return;
    if (!isDirty) {
      close();
      return;
    }
    run(() => onSave?.(clean(rows), clean(initial), scope));
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500 min-w-0">
        {badKg ? <b className="text-red-600">kg 은 0보다 큰 숫자로 넣어 주세요.</b>
          : prefillDate && isDirty ? <b className="text-teal-700">간트에서 고른 {shortDate(prefillDate)} 출고 줄을 넣었어요 — [저장]하면 현황표에도 반영돼요.</b>
            : st.fullDone
              ? `전체 출고 끝 — ${piece ? '모든 컬러 ' : ''}염색대기`
              : st.partialDone ? `부분 출고 ${st.doneCount}건 — 나머지가 나가면 '전체'로 체크` : '아직 출고 전'}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
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
          disabled={saving || badKg}
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
      width={560}
      title={`${order.orderNumber || '새 오더'} · ${piece ? '오더 전체' : (color?.name || '컬러')} 생지 출고`}
      subtitle={route}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-2 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* 염색 방식 (오더마다) — 선염: 컬러마다 / 후염: 오더에 한 번 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600">염색 방식</span>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden" role="radiogroup" aria-label="염색 방식">
              {DYE_METHODS.map(m => {
                const active = order.dyeMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={switching || (isDirty && !active) || !onSetDyeMethod}
                    onClick={() => changeMethod(m.key)}
                    title={isDirty && !active ? '저장 안 한 출고 변경을 먼저 저장해 주세요' : m.desc}
                    className={`px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed ${active ? m.cls : 'bg-white text-slate-400 hover:text-slate-600 disabled:hover:text-slate-400'}`}
                  >
                    {m.label} <span className="font-normal">· {m.desc.replace('생지 출고 ', '')}</span>
                  </button>
                );
              })}
            </div>
            {switching && <span className="text-[10px] text-slate-400">바꾸는 중…</span>}
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">
            {piece
              ? '후염 — 생지를 오더 전체 한 번에 출고해요. 여기 기록이 모든 컬러에 같이 적용돼요.'
              : order.dyeMethod === 'yarn'
                ? '선염 — 컬러마다 생지 출고를 기록해요.'
                : '아직 안 골랐어요 — 지금은 컬러마다 기록해요. 후염이면 [후염]을 눌러 주세요 (바로 저장).'}
          </p>
        </div>

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
                  <div className="grid grid-cols-[28px_128px_1fr_84px_auto_auto] items-center gap-1.5">
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
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.kg}
                        onChange={e => update(r.id, { kg: e.target.value })}
                        placeholder="kg"
                        aria-label={`${i + 1}차 출고 kg`}
                        className={`${INPUT_CLS} pr-6 text-right font-mono ${kgBad(r.kg) ? '!border-red-400 bg-red-50' : ''}`}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">kg</span>
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
                    placeholder={partial ? '어떤 분인지 (예: LOT1·2분, 롤 12개)' : '메모 (선택)'}
                    aria-label={`${i + 1}차 출고 메모`}
                    className={`${INPUT_CLS} ${partial && !String(r.memo || '').trim() ? 'border-amber-300 bg-amber-50/40' : ''}`}
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

        {(st.totalKg || needKg) ? (
          <p className="text-[11px] text-slate-600">
            {st.totalKg ? <>출고 kg 합계 <b className="font-mono">{fmtKg(st.totalKg)}kg</b>{st.doneKg !== null && st.doneKg !== st.totalKg ? ` (체크한 출고 ${fmtKg(st.doneKg)}kg)` : ''}</> : '출고 kg 미입력'}
            {needKg ? <span className="text-slate-400"> · 작지 {piece ? '합계 ' : ''}{fmtKg(needKg)}kg</span> : null}
          </p>
        ) : null}

        <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
          <Info className="w-3 h-3 mt-px shrink-0" />
          <span>
            <b>전체</b> = 남은 생지 전부 (체크하면 생지 출고 끝) · <b>부분</b> = 일부만 — 메모에 어떤 분인지 적어 주세요.
            kg을 넣으면 LOT 창에서 배색량 합계와 비교해 드려요.
            {st.lastDate ? ` 마지막 출고(예정) ${shortDate(st.lastDate)}.` : ''}
          </span>
        </p>
      </div>
    </PopoverShell>
  );
};

export default GreigeOutPopover;
