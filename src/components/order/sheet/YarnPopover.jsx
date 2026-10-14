import React, { useId, useState } from 'react';
import { Plus, Trash2, History, Download, Minus, Info } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { usePopoverSave } from '../common/usePopoverSave';
import { StatusSelect } from '../common/StatusSelect';
import { TrackEditor } from '../common/TrackEditor';
import {
  YARN_ORDER_STATUSES, PROGRESS_STATUS_OPTIONS, YARN_DYEING_KEY, normalizeStatus, getDyeMethodMeta,
} from '../../../constants/production';
import {
  createYarnOrder, createStatusEvent, getYarnOrderStatus, getYarnRowInfo, isStepUsed, canUseYarnDyeing, getEndShift,
} from '../../../utils/orderModel';
import { shortDate, todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 원사 입력 창 (오더 단위 — 대표님 요청 2026-10-14 v11)
// ------------------------------------------------------------
// - [재고 사용] (오더 전체): 체크하면 원사 발주는 신경 안 써도 됨 → 원사는 끝난 것으로 봄 (사종 줄은 참고만)
// - 사종 줄: 사종 · 원사처 · 상태(발주대기 · 발주완료 · 입고완료 · 중지) · 입고 예정일 · 메모
//   · 상태를 바꾸면 그날 날짜로 기록 한 줄 ([기록]에서 날짜·상태 고치기 · 지우기)
//   · [원단 원사 불러오기]: 오더 article# 원단의 원사(혼용률 큰 순)로 사종 줄 채우기 (이미 있는 사종은 빼고)
// - 원사염색 (선염 — 오더에 한 번): 염색처 · 예상 시작/종료일 · 상태 · 메모 → steps.yarn_dyeing
//   ([+ 원사염색]은 선염 오더에서만 — 이미 넣은 값이 있으면 염색 방식과 상관없이 보임)
// - 로컬 draft 로 편집 → [저장] 한 번에 (Enter = 저장, 닫을 때 바뀐 게 있으면 '변경사항이 있습니다')
//   · 사종 줄은 열 때 목록과 3방향 합침 (열어 둔 사이 현황표 칸에서 고른 상태가 지워지지 않게 — orderModel.applyYarn)
//   · 원사염색은 바뀐 칸만 (예상 종료일을 바꾸면 예전 날짜는 기록으로 남음 — applyStepPatch)
// props: order, anchorRect(null = 화면 가운데), onClose, onSaveYarn(patch), onSaveYarnDyeing(patch),
//        vendorOptions(원사처 제안), dyeVendorOptions(염색처 제안), yarnNameOptions(사종 제안),
//        articleYarns([{ name, ratio }] — 오더 article# 원단의 원사), articleLabel(그 원단 article#)
// ============================================================
const WIDTH = 780;

const cellCls = 'w-full border rounded px-1.5 py-1 text-[11px] bg-white focus:ring-2 focus:ring-teal-500 outline-none';
const okBorder = 'border-slate-200';
const errBorder = 'border-red-400 bg-red-50';
const inputCls = 'w-full border border-slate-300 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-teal-500 outline-none';
const labelCls = 'block text-[10px] font-bold text-slate-500 mb-0.5';

// 사종 줄 → 편집 줄 (저장된 모양과 같은 키 순서 — 3방향 합칠 때 '안 고친 줄'을 알아보려고)
const toRow = (y) => ({
  id: y.id,
  name: y.name || '',
  vendor: y.vendor || '',
  expectedDate: y.expectedDate || '',
  events: y.events || [],
  notes: y.notes || '',
});
const cleanRow = (y) => ({ ...y, name: y.name.trim(), vendor: y.vendor.trim(), notes: y.notes.trim() });
const isEmptyRow = (y) => !y.name.trim() && !y.vendor.trim() && !y.expectedDate && !(y.events || []).length && !y.notes.trim();
const rowKey = (y) => JSON.stringify(cleanRow(y));

// 원사염색 폼 (steps.yarn_dyeing)
const DYE_FIELDS = ['vendor', 'startDate', 'endDate', 'status', 'notes'];
const TRIM_FIELDS = new Set(['vendor', 'notes']);
const toDye = (step) => ({
  vendor: step?.vendor || '',
  startDate: step?.startDate || '',
  endDate: step?.endDate || '',
  status: normalizeStatus(step?.status),
  notes: step?.notes || '',
});
const EMPTY_DYE = toDye(null);

export const YarnPopover = ({
  order, anchorRect = null, onClose, onSaveYarn, onSaveYarnDyeing,
  vendorOptions = [], dyeVendorOptions = [], yarnNameOptions = [], articleYarns = [], articleLabel = '',
}) => {
  const uid = useId();
  const [initial] = useState(() => ({
    stock: !!order?.yarnStock,
    rows: (order?.yarnOrders || []).map(toRow),
    dye: toDye(order?.steps?.[YARN_DYEING_KEY]),
    dyeShown: isStepUsed(order?.steps?.[YARN_DYEING_KEY]),
  }));
  const [stock, setStock] = useState(initial.stock);
  const [rows, setRows] = useState(initial.rows);
  const [dye, setDye] = useState(initial.dye);
  const [dyeShown, setDyeShown] = useState(initial.dyeShown);
  const [trackOpenId, setTrackOpenId] = useState(null); // 기록을 펼친 사종 줄
  const [notice, setNotice] = useState('');
  const { saving, close, run } = usePopoverSave(onClose);

  if (!order) return null;

  const today = todayYmd();
  const initialIds = new Set(initial.rows.map(r => r.id));
  const initialEventIds = new Set(initial.rows.flatMap(r => (r.events || []).map(e => e.id)));

  // ---------- 바뀐 것 ----------
  // 새로 넣고 비워 둔 줄은 저장 안 함 (예전부터 있던 줄은 비워도 그대로 — 지우려면 🗑)
  const rowsOut = rows.filter(r => initialIds.has(r.id) || !isEmptyRow(r)).map(cleanRow);
  const baseRows = initial.rows.map(cleanRow);
  const rowsChanged = rowsOut.length !== baseRows.length || rowsOut.some((r, i) => rowKey(r) !== rowKey(baseRows[i]));
  const stockChanged = stock !== initial.stock;

  // 원사염색: 보이면 처음 값과 다른 칸만 / [빼기]면 처음 상태로 (예상 종료일 기록도)
  const dyePatch = {};
  if (dyeShown) {
    DYE_FIELDS.forEach(f => {
      const a = TRIM_FIELDS.has(f) ? initial.dye[f].trim() : initial.dye[f];
      const b = TRIM_FIELDS.has(f) ? dye[f].trim() : dye[f];
      if (a !== b) dyePatch[f] = b;
    });
  } else if (initial.dyeShown) {
    Object.assign(dyePatch, { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '', endHistory: [] });
  }
  const dyeChanged = Object.keys(dyePatch).length > 0;
  const dirty = rowsChanged || stockChanged || dyeChanged;
  const dyeDateBad = dyeShown && !!(dye.startDate && dye.endDate && dye.startDate > dye.endDate);

  const canDye = canUseYarnDyeing(order);
  const dyeStep = order.steps?.[YARN_DYEING_KEY];
  const dyeShift = getEndShift(dyeStep);
  const methodLabel = getDyeMethodMeta(order.dyeMethod)?.label || '안 고름';

  // ---------- 편집 (고치면 [원단 원사 불러오기] 안내 글은 지움) ----------
  const editRows = (fn) => {
    setRows(fn);
    setNotice('');
  };
  const updateRow = (id, patch) => editRows(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)));
  // 상태를 고르면 그날 날짜로 기록 한 줄 (지금 상태와 같으면 그대로)
  //  이 창에서 방금 고른 상태(아직 저장 전 기록)를 다시 바꾸면 그 줄을 바꿔 씀 — 고르다 마음을 바꿔도 기록이 쌓이지 않게
  const setRowStatus = (id, status) => editRows(list => list.map(r => {
    if (r.id !== id) return r;
    let events = r.events || [];
    const last = events[events.length - 1];
    if (last && !initialEventIds.has(last.id)) events = events.slice(0, -1);
    if (getYarnOrderStatus({ events }) === status) return { ...r, events };
    return { ...r, events: [...events, createStatusEvent(status)] };
  }));
  const addRow = () => editRows(list => [...list, toRow(createYarnOrder(''))]);
  const removeRow = (row) => {
    if ((row.events || []).length && !window.confirm(`'${row.name || '사종'}' 줄에 상태 기록이 있어요. 지울까요? (저장해야 지워져요)`)) return;
    editRows(list => list.filter(r => r.id !== row.id));
    if (trackOpenId === row.id) setTrackOpenId(null);
  };
  const toggleStock = (on) => {
    setStock(on);
    setNotice('');
  };

  // 오더 article# 원단의 원사로 사종 줄 채우기 (이미 있는 사종 이름은 빼고, 새로 넣고 비워 둔 줄은 그 자리에)
  const loadArticleYarns = () => {
    const have = new Set(rows.map(r => r.name.trim().toLowerCase()).filter(Boolean));
    const missing = (articleYarns || []).filter(y => y.name && !have.has(y.name.trim().toLowerCase()));
    if (!missing.length) {
      setNotice('원단 원사가 이미 모두 들어 있어요.');
      return;
    }
    setRows(list => [
      ...list.filter(r => initialIds.has(r.id) || !isEmptyRow(r)),
      ...missing.map(y => toRow(createYarnOrder(y.name))),
    ]);
    setNotice(`원단 원사 ${missing.length}개를 넣었어요: ${missing.map(y => y.name).join(', ')}`);
  };

  const setDyeField = (patch) => setDye(d => ({ ...d, ...patch }));
  const showDye = () => {
    setDyeShown(true);
    if (!initial.dyeShown) setDye(EMPTY_DYE);
  };
  const hideDye = () => {
    if (initial.dyeShown && !window.confirm('원사염색 일정·상태·메모를 비울까요? (저장해야 지워져요)')) return;
    setDyeShown(false);
    setDye(EMPTY_DYE);
  };

  // ---------- 저장 / 닫기 ----------
  const handleSave = () => {
    if (saving || dyeDateBad) return;
    if (!dirty) {
      close();
      return;
    }
    run(async () => {
      const yarnPatch = {};
      if (stockChanged) yarnPatch.yarnStock = stock;
      if (rowsChanged) {
        yarnPatch.yarnOrders = rowsOut;
        yarnPatch.yarnOrdersBase = baseRows;
      }
      // 원사 → 원사염색 순서로 연달아 시작 (훅이 앞 변경 위에 이어서 적용 — LOT 창과 같은 방식)
      const yarnTask = Object.keys(yarnPatch).length ? Promise.resolve(onSaveYarn?.(yarnPatch)) : Promise.resolve(true);
      const dyeTask = dyeChanged ? Promise.resolve(onSaveYarnDyeing?.(dyePatch)) : Promise.resolve(true);
      const results = await Promise.all([yarnTask, dyeTask]);
      return results.every(r => r !== false);
    });
  };

  // 입력칸(또는 열릴 때 포커스가 가는 본문)에서 Enter = 저장 (한글 조합 중 · 자동완성 목록이 달린 칸은 제외)
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const el = e.target;
    const onBody = el === e.currentTarget;
    if (!onBody && (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.getAttribute('list'))) return;
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };

  // ---------- 화면 ----------
  const counts = { waiting: 0, ordered: 0, arrived: 0, stopped: 0 };
  rowsOut.forEach(r => { counts[getYarnOrderStatus(r)] += 1; });
  const summary = rowsOut.length
    ? `사종 ${rowsOut.length}개${YARN_ORDER_STATUSES.filter(s => counts[s.key]).map(s => ` · ${s.label} ${counts[s.key]}`).join('')}`
    : '사종 줄 없음';

  const noNameCount = rowsOut.filter(r => !r.name).length;

  let footerMsg;
  if (dyeDateBad) footerMsg = <span className="font-bold text-red-600">원사염색 예상 종료일이 예상 시작일보다 빨라요.</span>;
  else if (notice) footerMsg = <span className="font-bold text-teal-700">{notice}</span>;
  else if (noNameCount) footerMsg = <span className="font-bold text-amber-600">사종 이름이 빈 줄이 {noNameCount}개 있어요 (저장은 돼요 — 현황표에 '사종?'으로 보여요).</span>;
  else if (stock) footerMsg = <span className="font-bold text-emerald-700">재고 사용 — 원사 발주는 끝난 것으로 봐요.</span>;
  else footerMsg = <span className="text-slate-500">{summary}</span>;

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1 text-[10px] leading-snug">{footerMsg}</div>
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
          disabled={saving || dyeDateBad}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  const nameListId = `${uid}-yarn-names`;
  const vendorListId = `${uid}-yarn-vendors`;
  const dyeVendorListId = `${uid}-dye-vendors`;

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={WIDTH}
      title={`${order.orderNumber || '새 오더'} · 원사`}
      subtitle="사종마다 발주대기 · 발주완료 · 입고완료 · 중지 · 재고 사용 · 원사염색(선염)"
      onClose={close}
      dirty={dirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        <datalist id={nameListId}>{yarnNameOptions.map(n => <option key={n} value={n} />)}</datalist>
        <datalist id={vendorListId}>{vendorOptions.map(v => <option key={v} value={v} />)}</datalist>
        <datalist id={dyeVendorListId}>{dyeVendorOptions.map(v => <option key={v} value={v} />)}</datalist>

        {/* ===== 재고 사용 (오더 전체) ===== */}
        <label className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer select-none ${stock ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
          <input
            type="checkbox"
            checked={stock}
            onChange={e => toggleStock(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-600"
          />
          <span className="min-w-0">
            <span className={`block text-xs font-extrabold ${stock ? 'text-emerald-800' : 'text-slate-700'}`}>재고 사용</span>
            <span className="block text-[10px] text-slate-500 leading-snug">
              재고 원사를 써요 — 체크하면 원사 발주는 신경 안 써도 돼요 (원사는 끝난 것으로 봐요)
            </span>
          </span>
        </label>

        {/* ===== 사종 줄 ===== */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-stone-700">사종별 발주</span>
            {stock && <span className="text-[10px] text-slate-500">재고 사용 중 — 사종 줄은 참고만 (진행 계산에서 빠져요)</span>}
          </div>
          <div className={`overflow-x-auto rounded-lg border border-slate-200 ${stock ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[720px] border-collapse text-[11px]">
              <thead>
                <tr className="bg-stone-50 text-[10px] font-bold text-slate-500">
                  <th className="px-1.5 py-1.5 text-left">사종</th>
                  <th className="w-[120px] px-1 py-1.5 text-left">원사처</th>
                  <th className="w-[112px] px-1 py-1.5 text-left">상태</th>
                  <th className="w-[124px] px-1 py-1.5 text-left">입고 예정일</th>
                  <th className="w-[150px] px-1 py-1.5 text-left">메모</th>
                  <th className="w-[52px] px-1 py-1.5"><span className="sr-only">기록</span></th>
                  <th className="w-8 px-1 py-1.5"><span className="sr-only">삭제</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-5 text-center text-slate-400">
                      {stock ? '재고 사용 — 사종 줄 없이도 괜찮아요.' : '아직 사종이 없어요. 아래 [사종 추가] 또는 [원단 원사 불러오기]로 넣어 주세요.'}
                    </td>
                  </tr>
                ) : rows.map((row, i) => {
                  const { status, statusDate, late } = getYarnRowInfo(order, row, today);
                  const trackOpen = trackOpenId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-t border-slate-100 align-middle">
                        <td className="px-1 py-1">
                          <input
                            value={row.name}
                            onChange={e => updateRow(row.id, { name: e.target.value })}
                            list={nameListId}
                            placeholder="예: CM30/1 면"
                            aria-label={`${i + 1}번째 사종`}
                            className={`${cellCls} ${okBorder} font-bold`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.vendor}
                            onChange={e => updateRow(row.id, { vendor: e.target.value })}
                            list={vendorListId}
                            placeholder="원사처"
                            aria-label={`${i + 1}번째 사종 원사처`}
                            className={`${cellCls} ${okBorder}`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <StatusSelect
                            value={status}
                            options={YARN_ORDER_STATUSES}
                            onChange={s => setRowStatus(row.id, s)}
                            instant={false}
                            ariaLabel={`${row.name || `${i + 1}번째 사종`} 상태`}
                          />
                          {statusDate && <span className="ml-1 font-mono text-[9px] text-slate-400">{shortDate(statusDate)}</span>}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="date"
                            value={row.expectedDate}
                            onChange={e => updateRow(row.id, { expectedDate: e.target.value })}
                            aria-label={`${row.name || `${i + 1}번째 사종`} 입고 예정일`}
                            title={late ? '입고 예정일이 지났는데 아직 입고 전이에요' : '입고 예정일'}
                            className={`${cellCls} ${late ? errBorder : okBorder}`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.notes}
                            onChange={e => updateRow(row.id, { notes: e.target.value })}
                            placeholder="메모 (예: 500kg · 2차 입고분)"
                            aria-label={`${row.name || `${i + 1}번째 사종`} 메모`}
                            title={row.notes || undefined}
                            className={`${cellCls} ${okBorder}`}
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => setTrackOpenId(trackOpen ? null : row.id)}
                            disabled={!(row.events || []).length}
                            className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold ${trackOpen ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-30 disabled:hover:bg-transparent`}
                            title="상태 기록 (날짜 고치기 · 지우기)"
                          >
                            <History className="w-3 h-3" />
                            {(row.events || []).length || ''}
                          </button>
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(row)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title={`${row.name || '사종'} 줄 삭제`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {trackOpen && (
                        <tr>
                          <td colSpan={7} className="px-2 pb-2 bg-slate-50/60">
                            <TrackEditor
                              statuses={YARN_ORDER_STATUSES}
                              events={row.events || []}
                              onChange={events => updateRow(row.id, { events })}
                              showPicker={false}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-teal-400 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50"
            >
              <Plus className="w-3.5 h-3.5" /> 사종 추가
            </button>
            <button
              type="button"
              onClick={loadArticleYarns}
              disabled={!articleYarns.length}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-[11px] font-bold hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
              title={articleYarns.length
                ? `${articleLabel || '원단'}의 원사: ${articleYarns.map(y => `${y.name}${y.ratio ? ` ${y.ratio}%` : ''}`).join(', ')}`
                : 'article#가 원단 보관함 원단과 연결돼야 원사를 불러올 수 있어요'}
            >
              <Download className="w-3.5 h-3.5" /> 원단 원사 불러오기{articleLabel ? ` (${articleLabel})` : ''}
            </button>
            <span className="text-[10px] text-slate-400">상태를 바꾸면 오늘 날짜로 기록돼요 · 날짜는 기록(<History className="inline w-3 h-3" />)에서 고쳐요</span>
          </div>
        </div>

        {/* ===== 원사염색 (선염 — 오더에 한 번) ===== */}
        {dyeShown ? (
          <div className="rounded-lg border border-pink-200 bg-pink-50/40 p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-pink-800">원사염색 <span className="font-normal text-pink-700/70">(선염 · 오더 전체 한 번)</span></span>
              <button
                type="button"
                onClick={hideDye}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50"
                title="원사염색 빼기"
              >
                <Minus className="w-3 h-3" /> 빼기
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className={labelCls} htmlFor={`${uid}-dye-vendor`}>염색처</label>
                <input
                  id={`${uid}-dye-vendor`}
                  value={dye.vendor}
                  onChange={e => setDyeField({ vendor: e.target.value })}
                  list={dyeVendorListId}
                  placeholder="염색처"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${uid}-dye-start`}>예상 시작일</label>
                <input
                  id={`${uid}-dye-start`}
                  type="date"
                  value={dye.startDate}
                  onChange={e => setDyeField({ startDate: e.target.value })}
                  className={`${inputCls} ${dyeDateBad ? errBorder : ''}`}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${uid}-dye-end`}>예상 종료일</label>
                <input
                  id={`${uid}-dye-end`}
                  type="date"
                  value={dye.endDate}
                  onChange={e => setDyeField({ endDate: e.target.value })}
                  className={`${inputCls} ${dyeDateBad ? errBorder : ''}`}
                />
              </div>
              <div>
                <span className={labelCls}>상태</span>
                <StatusSelect
                  value={dye.status}
                  options={PROGRESS_STATUS_OPTIONS}
                  onChange={s => setDyeField({ status: s })}
                  size="md"
                  instant={false}
                  ariaLabel="원사염색 상태"
                />
              </div>
            </div>
            <input
              value={dye.notes}
              onChange={e => setDyeField({ notes: e.target.value })}
              placeholder="메모 (예: 컬러 3가지 · 랩딥 컨펌 후 투입)"
              aria-label="원사염색 메모"
              className={inputCls}
            />
            {dyeShift && (
              <p className="text-[10px] text-pink-900/70">
                최초 예상 종료 {shortDate(dyeShift.first)} — 예상 종료일을 {dyeShift.count}번 바꿨어요
              </p>
            )}
            {dyeStep?.status === 'done' && dyeStep.doneDate && (
              <p className="text-[10px] text-pink-900/70">완료 {shortDate(dyeStep.doneDate)}</p>
            )}
          </div>
        ) : canDye ? (
          <button
            type="button"
            onClick={showDye}
            className="w-full flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-dashed border-pink-300 bg-white text-pink-700 text-[11px] font-bold hover:bg-pink-50"
          >
            <Plus className="w-3.5 h-3.5" /> 원사염색 (선염 — 원사를 먼저 염색할 때)
          </button>
        ) : (
          <p className="flex items-start gap-1 text-[10px] text-slate-400 leading-snug">
            <Info className="w-3 h-3 mt-px shrink-0" />
            <span>원사염색은 선염 오더에서 넣어요 — 이 오더 염색 방식: {methodLabel} (현황표 order# 칸 · 생지 출고 창에서 바꿔요)</span>
          </p>
        )}
      </div>
    </PopoverShell>
  );
};

export default YarnPopover;
