import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { usePopoverSave } from '../common/usePopoverSave';
import { CLOSING_ITEMS } from '../../../constants/production';
import { getClosingState, colorHasData } from '../../../utils/orderModel';
import { todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 오더 마무리 창 — 원사재고정리 · EZTEX 재고정리 · EZTEX 종결 (대표님 요청 2026-10-14)
// ------------------------------------------------------------
// - 3개 체크(체크한 날) + 각각 메모. 3개를 모두 끝내야 오더가 최종 마무리 → 모두 체크하면 오더 자동 '완료'
//   (자동으로 완료된 오더는 체크를 풀면 다시 진행중 — orderModel.applyClosing)
// - mode 'complete': 마무리 체크가 남았는데 오더를 '완료'로 바꾸려 할 때 (OrderListPage) — 위에 안내 +
//   [체크 없이 완료] (onForceComplete — 예전에 끝난 오더처럼 체크 없이 닫을 때)
// - 로컬 draft 로 편집 → [저장] 시 바뀐 칸만 onSave({ yarnStock: { done?, date?, memo? }, … }). Enter = 저장
// props: order, anchorRect(null = 화면 가운데), onClose, onSave(patch) => Promise<boolean>, mode, onForceComplete
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

const toDraft = (order) => {
  const { items } = getClosingState(order);
  return Object.fromEntries(CLOSING_ITEMS.map(i => [i.key, { ...items[i.key] }]));
};

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox';
};

export const ClosingPopover = ({ order, anchorRect = null, onClose, onSave, mode = 'edit', onForceComplete }) => {
  const [initial] = useState(() => toDraft(order));
  const [draft, setDraft] = useState(initial);
  const { saving, close, run } = usePopoverSave(onClose);

  if (!order) return null;

  // 바뀐 칸만
  const patch = {};
  CLOSING_ITEMS.forEach(({ key }) => {
    const a = initial[key];
    const b = draft[key];
    const p = {};
    if (a.done !== b.done) p.done = b.done;
    if (a.date !== b.date) p.date = b.date;
    if (a.memo.trim() !== b.memo.trim()) p.memo = b.memo.trim();
    if (Object.keys(p).length) patch[key] = p;
  });
  const isDirty = Object.keys(patch).length > 0;
  const doneCount = CLOSING_ITEMS.filter(i => draft[i.key].done).length;
  const allDone = doneCount === CLOSING_ITEMS.length;
  const wasAll = CLOSING_ITEMS.every(i => initial[i.key].done);
  const completed = order.status === 'completed';
  const willComplete = allDone && !wasAll && !completed;
  const willReopen = !allDone && wasAll && completed && !!order.closingAuto;
  const unshipped = (order.colors || []).filter(c => colorHasData(c) && !c.shipDone);

  const setItem = (key, p) => setDraft(d => ({ ...d, [key]: { ...d[key], ...p } }));
  const toggle = (key, done) => setItem(key, { done, date: done ? (draft[key].date || todayYmd()) : '' });

  // ---------- 저장 / 닫기 ----------
  const handleSave = () => {
    if (saving) return;
    if (!isDirty) {
      close();
      return;
    }
    run(() => onSave?.(patch));
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1 text-[10px] leading-snug">
        {willComplete ? <span className="font-bold text-emerald-700">저장하면 오더가 '완료'로 바뀌어요.</span>
          : willReopen ? <span className="font-bold text-amber-700">저장하면 자동 완료가 풀리고 다시 진행중이 돼요.</span>
            : mode === 'complete' && onForceComplete ? (
              <button
                type="button"
                onClick={() => { close(); onForceComplete(); }}
                className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                title="마무리 체크 없이 오더만 완료 (체크는 나중에 해도 돼요)"
              >
                체크 없이 완료
              </button>
            ) : <span className="text-slate-500">3개를 모두 체크하면 오더가 자동으로 '완료'돼요.</span>}
      </div>
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
      width={440}
      title={`${order.orderNumber || '새 오더'} · 마무리`}
      subtitle="원사재고정리 · EZTEX 재고정리 · EZTEX 종결 — 다 끝내야 오더 최종 마무리"
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-2.5 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {mode === 'complete' && !completed && (
          <p className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-800 leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>
              마무리 체크 {CLOSING_ITEMS.length - CLOSING_ITEMS.filter(i => initial[i.key].done).length}개가 남았어요
              ({CLOSING_ITEMS.filter(i => !initial[i.key].done).map(i => i.label).join(' · ')}).
              체크하고 저장하면 오더가 '완료'돼요.
            </span>
          </p>
        )}

        {CLOSING_ITEMS.map(item => {
          const d = draft[item.key];
          return (
            <div
              key={item.key}
              className={`rounded-lg border p-2 space-y-1.5 ${d.done ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={d.done}
                    onChange={e => toggle(item.key, e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className={`text-xs font-extrabold ${d.done ? 'text-emerald-800' : 'text-slate-700'}`}>{item.label}</span>
                  {d.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </label>
                {d.done && (
                  <input
                    type="date"
                    value={d.date}
                    onChange={e => setItem(item.key, { date: e.target.value })}
                    aria-label={`${item.label} 한 날`}
                    className={`${INPUT_CLS} !w-[132px] !py-1`}
                  />
                )}
              </div>
              <input
                type="text"
                value={d.memo}
                onChange={e => setItem(item.key, { memo: e.target.value })}
                placeholder="메모 (예: 남은 원사 120kg 편직처 보관)"
                aria-label={`${item.label} 메모`}
                className={INPUT_CLS}
              />
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className={`font-bold ${allDone ? 'text-emerald-700' : 'text-slate-500'}`}>마무리 {doneCount}/{CLOSING_ITEMS.length}</span>
          {completed && order.closingAuto && (
            <span className="text-[10px] text-slate-500">마무리 체크로 자동 완료된 오더 — 체크를 풀면 다시 진행중</span>
          )}
        </div>
        {unshipped.length > 0 && (
          <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
            <Info className="w-3 h-3 mt-px shrink-0" />
            <span>아직 출고가 안 끝난 컬러가 있어요: {unshipped.map(c => c.name || '컬러').join(', ')}</span>
          </p>
        )}
      </div>
    </PopoverShell>
  );
};

export default ClosingPopover;
