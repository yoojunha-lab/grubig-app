import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import {
  BATCH_STATUSES, BATCH_STATUS_COLORS,
  STATUS_TRIGGERS_END_DATE,
  getProcessQtyUnit, normalizeBatchStatus,
} from '../../../constants/production';
import { todayYmd, isBatchOverdue } from '../../../utils/orderCalculations';

// ============================================================
// 차수 1행 (인라인 편집, onBlur 자동 저장)
// 컬럼: N차 / [수량(공정별 단위, 또는 숨김)] / 상태 / 시작일 / 종료일 / 실제 종료일 / 컬러 / 메모 / 삭제
// (라벨/예상 종료/실제 시작 폐기 — 데이터는 보존, UI에서만 숨김)
//
// 수량 단위 (processType 기반):
//   원사/사가공/편직/염가공/후가공: KG
//   외관검사: YD
//   이화학검사: 수량 컬럼 자체 숨김
// ============================================================
export const BatchRow = ({ batch, orderColors, processType, onSave, onDelete, highlight, showColors = true }) => {
  const qtyUnit = getProcessQtyUnit(processType);  // 'KG' | 'YD' | null
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(batch)));
  const [saving, setSaving] = useState(false);
  const rowRef = useRef(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(batch)));
  }, [batch.id, batch.updatedAt]);

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
    if ((batch[field] ?? '') === (value ?? '')) return;
    setSaving(true);
    try { await onSave({ ...draft, [field]: value }); }
    finally { setSaving(false); }
  };

  // 상태 변경: '완료'로 바뀌면 actualEndDate 자동 today
  const onStatusChange = async (newKey) => {
    const next = { ...draft, status: newKey };
    if (newKey === STATUS_TRIGGERS_END_DATE && !next.actualEndDate) next.actualEndDate = todayYmd();
    setDraft(next);
    setSaving(true);
    try { await onSave(next); } finally { setSaving(false); }
  };

  const toggleColor = async (colorName) => {
    const cur = draft.colors || [];
    const exists = cur.some(c => c.color === colorName);
    const newColors = exists ? cur.filter(c => c.color !== colorName) : [...cur, { color: colorName, quantity: 0 }];
    const next = { ...draft, colors: newColors };
    setDraft(next);
    setSaving(true);
    try { await onSave(next); } finally { setSaving(false); }
  };

  // 정규화 (legacy 한글 → 신규 키). value/색상/트리거 모두 이걸 기준
  const sKey = normalizeBatchStatus(draft.status);
  const statusColor = BATCH_STATUS_COLORS[sKey] || BATCH_STATUS_COLORS.pending;
  const cellCls = 'border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full';

  const overdue = isBatchOverdue(draft);
  const rowCls = flash
    ? 'bg-teal-100/70 outline outline-2 outline-teal-500 outline-offset-[-2px] transition-all'
    : overdue
      ? 'bg-red-50/40'
      : saving
        ? 'bg-amber-50/30'
        : 'hover:bg-slate-50/50';

  return (
    <tr ref={rowRef} className={`border-b border-slate-100 ${rowCls}`}>
      {/* 차수 번호 (자동, 읽기전용) */}
      <td className="px-1.5 py-1.5 text-center w-[50px]">
        <div className="flex items-center justify-center gap-0.5 text-[11px] font-bold text-slate-700">
          {overdue && <AlertCircle className="w-3 h-3 text-red-500" title="계획 종료일 초과" />}
          {draft.batchNumber || '-'}차
        </div>
      </td>
      {/* 수량 (공정에 단위 있을 때만) */}
      {qtyUnit && (
        <td className="px-1.5 py-1.5">
          <input
            type="number" min="0" step="0.01"
            value={draft.quantity || ''}
            onChange={e => update('quantity', Number(e.target.value) || 0)}
            onBlur={() => persistField('quantity', draft.quantity)}
            className={`${cellCls} text-right font-mono`}
          />
        </td>
      )}
      {/* 상태 */}
      <td className="px-1.5 py-1.5">
        <select
          value={sKey}
          onChange={e => onStatusChange(e.target.value)}
          className={`${cellCls} font-bold ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
        >
          {BATCH_STATUSES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </td>
      {/* 시작일 */}
      <td className="px-1.5 py-1.5">
        <input
          type="date"
          value={draft.plannedStartDate || ''}
          onChange={e => update('plannedStartDate', e.target.value)}
          onBlur={() => persistField('plannedStartDate', draft.plannedStartDate)}
          className={cellCls}
        />
      </td>
      {/* 종료일 */}
      <td className="px-1.5 py-1.5">
        <input
          type="date"
          value={draft.plannedEndDate || ''}
          onChange={e => update('plannedEndDate', e.target.value)}
          onBlur={() => persistField('plannedEndDate', draft.plannedEndDate)}
          className={`${cellCls} ${overdue ? 'bg-red-50 border-red-300 text-red-700 font-bold' : ''}`}
        />
      </td>
      {/* 실제 종료일 */}
      <td className="px-1.5 py-1.5">
        <input
          type="date"
          value={draft.actualEndDate || ''}
          onChange={e => update('actualEndDate', e.target.value)}
          onBlur={() => persistField('actualEndDate', draft.actualEndDate)}
          className={`${cellCls} bg-emerald-50 border-emerald-200`}
        />
      </td>
      {/* 컬러 (오더에 컬러 등록되어 있을 때만) */}
      {showColors && (orderColors || []).length > 0 && (
        <td className="px-1.5 py-1.5">
          <div className="flex flex-wrap gap-0.5">
            {(orderColors || []).map(c => {
              const selected = (draft.colors || []).some(bc => bc.color === c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    selected ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </td>
      )}
      {/* 메모 */}
      <td className="px-1.5 py-1.5 min-w-[200px]">
        <textarea
          value={draft.notes || ''}
          onChange={e => update('notes', e.target.value)}
          onBlur={() => persistField('notes', draft.notes)}
          rows={1}
          placeholder="메모..."
          className={`${cellCls} resize-y leading-snug`}
        />
        {draft.status === 'issue' && (
          <input
            type="text"
            value={draft.delayReason || ''}
            onChange={e => update('delayReason', e.target.value)}
            onBlur={() => persistField('delayReason', draft.delayReason)}
            placeholder="문제 사유"
            className={`${cellCls} mt-1 bg-red-50 border-red-200 text-red-700`}
          />
        )}
      </td>
      {/* 삭제 */}
      <td className="px-1.5 py-1.5 text-center w-[40px]">
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            title="이 차수 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
};

// 표 헤더 — BatchRow와 동일한 컬럼 순서, processType 기반 수량 단위/숨김
export const BatchTableHeader = ({ processType, showColors = true, hasAnyColors = false }) => {
  const qtyUnit = getProcessQtyUnit(processType);  // 'KG' | 'YD' | null
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-2 py-1.5 text-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[50px]">차수</th>
        {qtyUnit && (
          <th className="px-2 py-1.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[90px]">수량({qtyUnit})</th>
        )}
        <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[100px]">상태</th>
        <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[130px]">시작일</th>
        <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[130px]">종료일</th>
        <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider w-[130px]">실제 종료일</th>
        {showColors && hasAnyColors && (
          <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider w-[120px]">컬러</th>
        )}
        <th className="px-2 py-1.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider min-w-[200px]">메모</th>
        <th className="px-2 py-1.5 w-[40px]"></th>
      </tr>
    </thead>
  );
};
