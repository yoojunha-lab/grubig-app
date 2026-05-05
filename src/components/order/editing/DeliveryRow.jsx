import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import {
  BATCH_STATUSES, BATCH_STATUS_COLORS,
  normalizeDeliveryStatus, DELIVERY_STATUS_TRIGGERS_ARRIVAL,
} from '../../../constants/production';
import { todayYmd, isYarnDeliveryOverdue } from '../../../utils/orderCalculations';

// ============================================================
// 원사 입고차수 1행 — onBlur 자동 저장
// 컬럼: # / 수량(kg) / 입고예정일 / 실제 입고일 / 상태 / 삭제
// ============================================================
export const DeliveryRow = ({ delivery, onSave, onDelete, highlight }) => {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(delivery)));
  const [saving, setSaving] = useState(false);
  const rowRef = useRef(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(delivery)));
  }, [delivery.id, delivery.status, delivery.quantity, delivery.plannedArrivalDate,
      delivery.actualArrivalDate]);

  useEffect(() => {
    if (!highlight) return;
    if (rowRef.current) rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 2400);
    return () => clearTimeout(t);
  }, [highlight]);

  const update = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const persistField = async (field, value) => {
    if (saving) return;
    if ((delivery[field] ?? '') === (value ?? '')) return;
    setSaving(true);
    try { await onSave({ ...draft, [field]: value }); }
    finally { setSaving(false); }
  };

  // 상태(4가지) → '완료'면 actualArrivalDate 자동 today
  const onStatusChange = async (newKey) => {
    const next = { ...draft, status: newKey };
    if (newKey === DELIVERY_STATUS_TRIGGERS_ARRIVAL && !next.actualArrivalDate) {
      next.actualArrivalDate = todayYmd();
    }
    setDraft(next);
    setSaving(true);
    try { await onSave(next); } finally { setSaving(false); }
  };

  const sKey = normalizeDeliveryStatus(draft.status);
  const sColor = BATCH_STATUS_COLORS[sKey] || BATCH_STATUS_COLORS.pending;
  const overdue = isYarnDeliveryOverdue(draft);

  const rowCls = flash
    ? 'bg-teal-100/70 outline outline-2 outline-teal-500 outline-offset-[-2px]'
    : overdue
      ? 'bg-red-50/40'
      : saving
        ? 'bg-amber-50/30'
        : 'hover:bg-slate-50/50';

  const cellCls = 'border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full';

  return (
    <tr ref={rowRef} className={`border-b border-slate-100 transition-all ${rowCls}`}>
      <td className="px-1.5 py-1 text-center text-[11px] font-bold text-slate-500 w-[40px]">
        <div className="flex items-center justify-center gap-0.5">
          {overdue && <AlertCircle className="w-3 h-3 text-red-500" title="입고 예정일 초과" />}
          {draft.deliveryNumber}
        </div>
      </td>
      <td className="px-1.5 py-1">
        <input
          type="number" min="0" step="0.01"
          value={draft.quantity || ''}
          onChange={e => update('quantity', Number(e.target.value) || 0)}
          onBlur={() => persistField('quantity', draft.quantity)}
          className={`${cellCls} text-right font-mono`}
        />
      </td>
      <td className="px-1.5 py-1">
        <input
          type="date"
          value={draft.plannedArrivalDate || ''}
          onChange={e => update('plannedArrivalDate', e.target.value)}
          onBlur={() => persistField('plannedArrivalDate', draft.plannedArrivalDate)}
          className={`${cellCls} ${overdue ? 'bg-red-50 border-red-300 text-red-700 font-bold' : ''}`}
        />
      </td>
      <td className="px-1.5 py-1">
        <input
          type="date"
          value={draft.actualArrivalDate || ''}
          onChange={e => update('actualArrivalDate', e.target.value)}
          onBlur={() => persistField('actualArrivalDate', draft.actualArrivalDate)}
          className={`${cellCls} bg-emerald-50 border-emerald-200`}
        />
      </td>
      <td className="px-1.5 py-1">
        <select
          value={sKey}
          onChange={e => onStatusChange(e.target.value)}
          className={`${cellCls} font-bold ${sColor.bg} ${sColor.text} ${sColor.border}`}
        >
          {BATCH_STATUSES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </td>
      <td className="px-1.5 py-1 text-center w-[40px]">
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            title="이 입고차수 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
};

// 입고차수 표 헤더
export const DeliveryTableHeader = () => (
  <thead className="bg-slate-50 border-b border-slate-200">
    <tr>
      <th className="px-1.5 py-1 text-center text-[10px] font-extrabold text-slate-500 uppercase w-[40px]">#</th>
      <th className="px-1.5 py-1 text-right text-[10px] font-extrabold text-slate-500 uppercase w-[80px]">수량(kg)</th>
      <th className="px-1.5 py-1 text-left text-[10px] font-extrabold text-slate-500 uppercase w-[130px]">입고예정일</th>
      <th className="px-1.5 py-1 text-left text-[10px] font-extrabold text-emerald-700 uppercase w-[130px]">실제 입고일</th>
      <th className="px-1.5 py-1 text-left text-[10px] font-extrabold text-slate-500 uppercase w-[110px]">상태</th>
      <th className="px-1.5 py-1 w-[36px]"></th>
    </tr>
  </thead>
);
