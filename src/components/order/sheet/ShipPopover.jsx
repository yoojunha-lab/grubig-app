import React, { useState } from 'react';
import { PopoverShell } from '../common/PopoverShell';
import { usePopoverSave } from '../common/usePopoverSave';
import { todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 출고 입력 창 (컬러 1개 — 간트 출고 막대 · [+] 메뉴) — 현황표 출고 칸과 같은 값 (출고일 · 출고 완료)
// ------------------------------------------------------------
// - 완료를 체크했는데 출고일이 비었으면 오늘로 채움 (현황표·상세창과 같은 규칙)
// - [저장] → 바뀐 칸만 onSave({ shipDate?, shipDone? }). Enter = 저장, 닫을 때 저장 안 한 변경이 있으면 묻기
// props: order, color, anchorRect(null = 화면 가운데), onClose, onSave(patch) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

export const ShipPopover = ({ order, color, anchorRect = null, onClose, onSave }) => {
  const [initial] = useState(() => ({ shipDate: color?.shipDate || '', shipDone: !!color?.shipDone }));
  const [form, setForm] = useState(initial);
  const { saving, close, run } = usePopoverSave(onClose);

  if (!order || !color) return null;

  const patch = {};
  if (form.shipDate !== initial.shipDate) patch.shipDate = form.shipDate;
  if (form.shipDone !== initial.shipDone) patch.shipDone = form.shipDone;
  const isDirty = Object.keys(patch).length > 0;

  const handleSave = () => {
    if (saving) return;
    if (!isDirty) {
      close();
      return;
    }
    run(() => onSave?.(patch));
  };

  const footer = (
    <div className="flex items-center justify-end gap-1.5">
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
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={300}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 출고`}
      subtitle={order.customer || undefined}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div
        className="p-3 space-y-2.5 outline-none"
        tabIndex={-1}
        data-autofocus
        onKeyDown={e => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.target?.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
          e.preventDefault();
          e.stopPropagation();
          handleSave();
        }}
      >
        <label className="block">
          <span className="block mb-1 text-[11px] font-bold text-slate-500">출고일</span>
          <input
            type="date"
            value={form.shipDate}
            onChange={e => setForm(f => ({ ...f, shipDate: e.target.value }))}
            className={INPUT_CLS}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.shipDone}
            onChange={e => {
              const done = e.target.checked;
              setForm(f => ({ ...f, shipDone: done, shipDate: done && !f.shipDate ? todayYmd() : f.shipDate }));
            }}
            className="w-4 h-4 accent-blue-600"
          />
          출고 완료
        </label>
      </div>
    </PopoverShell>
  );
};

export default ShipPopover;
