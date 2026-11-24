import React, { useMemo, useState } from 'react';
import { Factory } from 'lucide-react';
import { SearchableSelect } from '../common/SearchableSelect';

// ============================================================
// 메인/QC 디테일 시트 — '생산 현황에서 고르기' (개발 고도화 3단계, 대표님 요청 2026-11-24)
//  생산 현황 오더 → 컬러 → LOT 을 고르면 Order No · Article · Color · LOT · 유형(메인/샘플)을 채움
//  (예전엔 손으로 쳐서 오더와 글자가 어긋나면 설계서 · 샘플 오더에서 QC 결과를 못 찾았음)
//  고른 오더 · 컬러 · LOT id 도 같이 남김 (orderId · colorId · lotId) — 글자를 고쳐도 이어지게
//  onPick({ orderNo, articleNo, colorInfo, lotNo, type, orderId, colorId, lotId })
// ============================================================

export const OrderLotPicker = ({ orders = [], value = {}, onPick }) => {
  const [orderId, setOrderId] = useState(value.orderId || '');
  const [colorId, setColorId] = useState(value.colorId || '');
  const options = useMemo(() => (orders || [])
    .filter(o => o && String(o.orderNumber || '').trim())
    .map(o => ({
      id: o.id,
      label: [o.orderNumber, o.articleNo, o.detail, o.customer, o.status === 'completed' ? '(완료)' : ''].filter(Boolean).join(' · '),
      done: o.status === 'completed',
    }))
    .sort((a, b) => (a.done - b.done) || a.label.localeCompare(b.label, 'ko')), [orders]);
  const order = (orders || []).find(o => String(o.id) === String(orderId)) || null;
  const colors = order?.colors || [];
  const color = colors.find(c => String(c.id) === String(colorId)) || null;
  const lots = color?.lots || [];

  const pick = (o, c, l) => {
    if (!o) return;
    onPick?.({
      orderNo: String(o.orderNumber || '').trim().toUpperCase(),
      articleNo: String(o.articleNo || '').trim().toUpperCase(),
      colorInfo: c ? String(c.name || '').trim().toUpperCase() : '',
      lotNo: l ? String(l.no ?? '') : '',
      type: o.type === 'sample' ? 'sample' : 'main',
      orderId: o.id,
      colorId: c?.id || null,
      lotId: l?.id || null,
    });
  };

  if (!options.length) return null;
  return (
    <div className="col-span-2 border border-teal-200 bg-teal-50/40 rounded-lg p-2.5">
      <p className="text-[11px] font-extrabold text-teal-800 mb-1.5 flex items-center gap-1">
        <Factory className="w-3.5 h-3.5" /> 생산 현황에서 고르기
        <span className="font-normal text-[10px] text-slate-500">— 오더 · 컬러 · LOT을 고르면 아래 칸이 채워져요 (손으로 고쳐도 돼요)</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
        <SearchableSelect
          size="small"
          value={orderId}
          options={options}
          labelKey="label"
          valueKey="id"
          placeholder="order# · Article 검색"
          onChange={(id) => {
            setOrderId(id || '');
            setColorId('');
            const o = (orders || []).find(x => String(x.id) === String(id));
            const only = o && (o.colors || []).length === 1 ? o.colors[0] : null;
            if (only) setColorId(only.id);
            pick(o, only, null);
          }}
        />
        <select value={colorId} disabled={!order || colors.length === 0}
          onChange={(e) => { setColorId(e.target.value); const c = colors.find(x => String(x.id) === e.target.value); pick(order, c, null); }}
          className="border border-slate-200 rounded px-2 py-1 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-300">
          <option value="">{order && colors.length === 0 ? '컬러 없음' : '컬러'}</option>
          {colors.map(c => <option key={c.id} value={c.id}>{c.name || '(이름 없음)'}</option>)}
        </select>
        <select value="" disabled={!color || lots.length === 0}
          onChange={(e) => { const l = lots.find(x => String(x.id) === e.target.value); pick(order, color, l); }}
          className="border border-slate-200 rounded px-2 py-1 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-300">
          <option value="">{color && lots.length === 0 ? 'LOT 없음' : (value.lotId && color ? `LOT ${lots.find(l => l.id === value.lotId)?.no ?? ''}` : 'LOT')}</option>
          {lots.map(l => <option key={l.id} value={l.id}>LOT {l.no}{l.status === 'done' ? ' (완료)' : ''}</option>)}
        </select>
      </div>
    </div>
  );
};
