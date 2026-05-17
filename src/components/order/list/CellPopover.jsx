import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ExternalLink } from 'lucide-react';
import { BATCH_STATUSES, getProcessQtyUnit, PROCESS_TYPES } from '../../../constants/production';

// ============================================================
// 셀 클릭 시 뜨는 빠른 편집 팝오버
// props:
//   orderId, processType, batchId?, colorName?, anchorRect (DOMRect)
//   orders[], onClose(), onSaveBatch(), onSaveYarnDelivery(), onOpenDetail()
// ============================================================
const POPOVER_W = 300;
const POPOVER_EST_H = 280;

export const CellPopover = ({
  orderId, processType, batchId, colorName,
  anchorRect, orders, onClose,
  onSaveBatch, onSaveYarnDelivery, onOpenDetail,
}) => {
  const popRef = useRef(null);
  // 팝오버 첫 마운트 직후의 mousedown 한 번은 무시 (셀 클릭 자체가 그 이벤트라 즉시 닫히는 문제 회피)
  const ignoreFirstRef = useRef(true);

  useEffect(() => {
    const onDown = (e) => {
      if (ignoreFirstRef.current) {
        ignoreFirstRef.current = false;
        return;
      }
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  // 위치 계산
  const pos = computePosition(anchorRect);

  // 데이터 추출
  const order = orders.find(o => o.id === orderId);
  if (!order) return null;
  const proc = (order.processes || []).find(p => p.processType === processType);
  const batch = batchId ? (proc?.batches || []).find(b => b.id === batchId) : (proc?.batches || [])[0];

  const procLabel = PROCESS_TYPES.find(p => p.key === processType)?.label || processType;
  const qtyUnit = getProcessQtyUnit(processType) || '';

  // 편집 가능 여부
  const editable = !!batch;

  return (
    <div
      ref={popRef}
      className="fixed z-[9999] w-[300px] bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
    >
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-3 py-2 flex items-center justify-between">
        <div className="text-xs font-extrabold">
          {procLabel}
          {batch && <span className="ml-1.5 text-teal-100">· {batch.batchLabel || `${batch.batchNumber || ''}차`}</span>}
          {colorName && <span className="ml-1.5 text-teal-100">({colorName})</span>}
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 본문 */}
      <div className="p-3">
        {editable ? (
          <BatchQuickEdit
            order={order}
            processType={processType}
            batch={batch}
            qtyUnit={qtyUnit}
            onSave={(draft) => {
              onSaveBatch && onSaveBatch(orderId, processType, batch.id, draft);
              onClose();
            }}
          />
        ) : (
          <div className="text-xs text-slate-500 py-2 text-center">
            편집 가능한 차수가 없습니다.
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono truncate">{order.orderNumber}</span>
        <button
          onClick={onOpenDetail}
          className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900"
        >
          상세 편집 <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 빠른 편집 폼 (상태/수량/시작/종료)
// ============================================================
const BatchQuickEdit = ({ order, processType, batch, qtyUnit, onSave }) => {
  const [draft, setDraft] = useState({
    status: batch.status || 'pending',
    quantity: batch.quantity ?? 0,
    plannedStartDate: batch.plannedStartDate || '',
    plannedEndDate: batch.plannedEndDate || '',
    actualEndDate: batch.actualEndDate || '',
    notes: batch.notes || '',
  });

  const update = (patch) => setDraft(prev => ({ ...prev, ...patch }));

  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none';
  const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block';

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>상태</label>
        <select value={draft.status} onChange={(e) => update({ status: e.target.value })} className={inputCls}>
          {BATCH_STATUSES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {qtyUnit && (
        <div>
          <label className={labelCls}>수량 ({qtyUnit})</label>
          <input
            type="number"
            value={draft.quantity}
            onChange={(e) => update({ quantity: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>시작일</label>
          <input
            type="date"
            value={draft.plannedStartDate}
            onChange={(e) => update({ plannedStartDate: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>종료일</label>
          <input
            type="date"
            value={draft.plannedEndDate}
            onChange={(e) => update({ plannedEndDate: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>실제 종료일 (완료 시)</label>
        <input
          type="date"
          value={draft.actualEndDate}
          onChange={(e) => update({ actualEndDate: e.target.value })}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>메모</label>
        <input
          type="text"
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="간단한 메모..."
          className={inputCls}
        />
      </div>

      <button
        onClick={() => onSave({ ...batch, ...draft })}
        className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-1.5 rounded text-xs font-bold hover:shadow-md transition-shadow"
      >
        <Save className="w-3 h-3" /> 저장
      </button>
    </div>
  );
};

// ============================================================
// 위치 계산 — 화면 가장자리 자동 보정
// ============================================================
function computePosition(rect) {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  if (!rect) return { x: 100, y: 100 };

  // 셀 위쪽에 띄우는 게 기본
  let x = rect.left;
  let y = rect.top - POPOVER_EST_H - 8;

  // 좌측 잘리면 보정
  if (x + POPOVER_W > winW - 12) x = winW - POPOVER_W - 12;
  if (x < 12) x = 12;

  // 위쪽 잘리면 아래로
  if (y < 12) y = rect.bottom + 8;
  // 그래도 아래로 넘치면 위에 강제
  if (y + POPOVER_EST_H > winH - 12) y = Math.max(12, winH - POPOVER_EST_H - 12);

  return { x, y };
}
