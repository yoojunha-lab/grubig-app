import React, { useId, useRef, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { StatusSelect } from '../common/StatusSelect';
import {
  DYEING_STEP, PROGRESS_STATUS_OPTIONS, PROCESS_THEME, normalizeStatus,
} from '../../../constants/production';
import { createLot, getLotOverview } from '../../../utils/orderModel';
import { shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 염가공 LOT 편집 창 (컬러 1개의 염색 LOT 계획)
// ------------------------------------------------------------
// - LOT = 염색기를 한 번 돌리는 단위. LOT 마다 투입일 · 완료예정 · 상태 · 메모
//   (탕·수량·롤 칸은 없앰 — 대표님 요청 2026-10-11. 예전에 넣은 값은 문서에 그대로 남음)
// - 표는 로컬 draft 로 편집 → [저장] 한 번에 확정 (Enter=저장, 닫을 때 저장 안 한 변경이 있으면 '변경사항이 있습니다')
// - 염색소는 오더 전체 공통 값(order.dyeVendor) — 바뀌었을 때만 따로 저장
// props: order, color, anchorRect, onClose, onSaveLots(lots), onSaveDyeVendor(vendor), dyeVendorOptions
// ============================================================
const WIDTH = 600;

const labelCls = 'block text-[10px] font-bold text-slate-500 mb-0.5';
const inputCls = 'w-full border border-slate-300 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-slate-100 disabled:text-slate-400';
const cellCls = 'w-full border rounded px-1.5 py-1 text-[11px] focus:ring-2 focus:ring-teal-500 outline-none';
const okBorder = 'border-slate-200 bg-white';
const errBorder = 'border-red-400 bg-red-50';

// LOT → 편집 행 (base 에 원본을 보관해 모르는 필드(예전 탕·수량·롤)도 저장 시 그대로 유지)
const toRow = (lot) => ({
  base: lot,
  id: lot.id,
  startDate: lot.startDate || '',
  endDate: lot.endDate || '',
  status: normalizeStatus(lot.status),
  notes: lot.notes || '',
});

const dateBadOf = (row) => !!(row.startDate && row.endDate && row.startDate > row.endDate);

// 편집 행 → 저장할 LOT
const fromRow = (row, index) => ({
  ...row.base,
  id: row.id,
  no: index + 1,
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.status,
  notes: row.notes.trim(),
});

// 저장 필요 여부 비교 (의미 있는 필드 + 순서)
const lotKey = (l) => [l.id, l.startDate || '', l.endDate || '', normalizeStatus(l.status), String(l.notes || '').trim()].join('|');
const sameLots = (a, b) => a.length === b.length && a.every((l, i) => lotKey(l) === lotKey(b[i]));

// 열릴 때의 편집 상태 (key: 어떤 오더/컬러의 draft 인지)
// vendor / rows 가 null 이면 "아직 안 건드림" → 화면은 최신 order.dyeVendor / color.lots 를 그대로 보여줌
// (열어둔 사이 다른 사람이 바꾼 값을, 건드리지도 않은 옛 값으로 덮어쓰지 않도록)
const makeDraft = (order, color) => ({ key: `${order?.id}|${color?.id}`, vendor: null, rows: null });

export const LotEditor = ({
  order, color, anchorRect = null, onClose,
  onSaveLots, onSaveDyeVendor, dyeVendorOptions = [],
}) => {
  const uid = useId();
  const sourceKey = `${order?.id}|${color?.id}`;
  const [draft, setDraft] = useState(() => makeDraft(order, color));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  // 닫기 횟수 — 저장 중에 창을 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
  const closeCountRef = useRef(0);

  // 다른 오더/컬러로 다시 열리면 draft 새로 시작 (effect 없이 렌더 중 맞춤)
  if (draft.key !== sourceKey) {
    setDraft(makeDraft(order, color));
    setError('');
  }

  if (!order || !color) return null;

  // ---------- 파생 값 ----------
  const liveRows = (color.lots || []).map(toRow);
  const rows = draft.rows ?? liveRows;
  const vendor = draft.vendor ?? (order.dyeVendor || '');
  const nextLots = rows.map(fromRow);
  const baseLots = liveRows.map(fromRow);
  const badNos = rows.map((r, i) => (dateBadOf(r) ? i + 1 : 0)).filter(Boolean);
  const overview = getLotOverview(nextLots);

  const vendorOptions = [...new Set((dyeVendorOptions || []).map(v => String(v || '').trim()).filter(Boolean))];
  const vendorTrim = vendor.trim();
  const vendorChanged = !!onSaveDyeVendor && vendorTrim !== (order.dyeVendor || '').trim();
  const lotsChanged = !!onSaveLots && !sameLots(nextLots, baseLots);
  const dirty = vendorChanged || lotsChanged;
  const isDraftOrder = !order.orderNumber;

  // ---------- 편집 ----------
  const patchDraft = (patch) => setDraft(d => ({ ...d, ...patch }));
  // 표를 처음 건드리는 순간 최신 LOT 목록을 draft 로 옮긴 뒤 수정
  const editRows = (fn) => setDraft(d => ({ ...d, rows: fn(d.rows ?? liveRows) }));
  const updateRow = (id, patch) => editRows(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => editRows(list => list.filter(r => r.id !== id));
  const addRow = () => editRows(list => [...list, toRow(createLot(list.length + 1))]);

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closeCountRef.current += 1;
    onClose();
  };

  const handleSave = async () => {
    if (savingRef.current || badNos.length) return;
    if (!dirty) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    const closeCount = closeCountRef.current;
    try {
      // 염색소 → LOT 순서로 저장. 두 호출을 연달아 시작해야 훅이 LOT 변경을 염색소 변경 위에 이어서 적용한다.
      // (첫 저장이 끝난 뒤에 부르면 이 창이 들고 있는 예전 함수가 저장 전 오더를 기준으로 덮어써
      //  염색소 변경이 사라질 수 있음 — useOrder 의 "연속 수정" 방식에 맞춘 것)
      const vendorTask = vendorChanged ? Promise.resolve(onSaveDyeVendor(vendorTrim)) : Promise.resolve(true);
      const lotsTask = lotsChanged ? Promise.resolve(onSaveLots(nextLots)) : Promise.resolve(true);
      const [vendorOk, lotsOk] = await Promise.all([vendorTask, lotsTask]);
      savingRef.current = false;
      if (closeCountRef.current !== closeCount) return; // 저장 중에 이미 닫힘
      if (!vendorOk || !lotsOk) {
        const failed = [!vendorOk && '염색소', !lotsOk && 'LOT'].filter(Boolean).join('·');
        setError(`${failed} 저장에 실패했어요. 다시 시도해 주세요.`);
        setSaving(false);
        return;
      }
      close();
    } catch {
      savingRef.current = false;
      if (closeCountRef.current !== closeCount) return;
      setError('저장 중 문제가 생겼어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  // 입력칸(또는 열릴 때 포커스가 가는 본문 영역)에서 Enter = 저장 (한글 조합 중 Enter, 자동완성 목록이 달린 칸은 제외)
  const onFormKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const el = e.target;
    const onBody = el === e.currentTarget;
    if (!onBody && (el.tagName !== 'INPUT' || el.getAttribute('list'))) return;
    e.preventDefault();
    handleSave();
  };

  // ---------- 화면 ----------
  const title = `${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 염가공 LOT`;
  const subtitle = overview.count
    ? `LOT ${overview.count}개 · 완료 ${overview.done}${overview.start || overview.end ? ` · ${shortDate(overview.start) || '?'}~${shortDate(overview.end) || '?'}` : ''}`
    : 'LOT마다 투입일 · 완료예정 · 상태';

  let footerMsg = null;
  if (error) {
    footerMsg = <span className="text-red-600 font-bold">{error}</span>;
  } else if (badNos.length) {
    footerMsg = <span className="text-red-600 font-bold">LOT {badNos.join(', ')}의 투입일이 완료예정일보다 늦어요.</span>;
  } else if (isDraftOrder) {
    footerMsg = <span className="text-slate-500">order#를 입력해야 서버에 저장돼요. (지금은 화면에만 반영)</span>;
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1 text-[10px] leading-snug">{footerMsg}</div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={close}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || badNos.length > 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-bold hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={WIDTH}
      title={title}
      subtitle={subtitle}
      onClose={close}
      dirty={dirty && !saving}
      onSaveDirty={handleSave}
      dirtyMessage="저장하지 않은 LOT 변경이 있어요. 저장할까요?"
      footer={footer}
    >
      {/* 열리면 이 영역에 포커스(data-autofocus) → 키보드로 바로 Tab 이동 · Enter 저장 */}
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onFormKeyDown}>
        {/* ===== 염색소 (오더 전체 공통) ===== */}
        <div className="rounded-lg border border-slate-200 p-2">
          <label htmlFor={`${uid}-vendor`} className={labelCls}>
            {DYEING_STEP.vendorLabel} <span className="font-normal text-slate-400">(오더 전체 공통)</span>
          </label>
          <input
            id={`${uid}-vendor`}
            list={`${uid}-vendors`}
            value={vendor}
            onChange={(e) => patchDraft({ vendor: e.target.value })}
            disabled={!onSaveDyeVendor || saving}
            placeholder="염색소 이름"
            className={inputCls}
          />
          <datalist id={`${uid}-vendors`}>
            {vendorOptions.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        {/* ===== LOT 표 ===== */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[540px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500">
                <th className="w-10 px-1.5 py-1.5 text-center">LOT</th>
                <th className="w-[124px] px-1 py-1.5 text-left">투입일</th>
                <th className="w-[124px] px-1 py-1.5 text-left">완료예정</th>
                <th className="w-[92px] px-1 py-1.5 text-left">상태</th>
                <th className="px-1 py-1.5 text-left">메모</th>
                <th className="w-8 px-1 py-1.5"><span className="sr-only">삭제</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                    아직 LOT이 없어요. 아래 [LOT 추가]로 만들어 주세요.
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const no = i + 1;
                const bad = dateBadOf(row);
                const dateTitle = bad ? '투입일이 완료예정일보다 늦어요' : undefined;
                return (
                  <tr key={row.id} className="border-t border-slate-100 align-middle">
                    <td className="px-1.5 py-1 text-center font-extrabold text-orange-700">{no}</td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateRow(row.id, { startDate: e.target.value })}
                        aria-label={`LOT ${no} 투입일`}
                        title={dateTitle}
                        className={`${cellCls} ${bad ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateRow(row.id, { endDate: e.target.value })}
                        aria-label={`LOT ${no} 완료예정일`}
                        title={dateTitle}
                        className={`${cellCls} ${bad ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <StatusSelect
                        value={row.status}
                        options={PROGRESS_STATUS_OPTIONS}
                        onChange={s => updateRow(row.id, { status: s })}
                        size="md"
                        ariaLabel={`LOT ${no} 상태`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.notes}
                        onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                        placeholder="메모"
                        aria-label={`LOT ${no} 메모`}
                        title={row.notes || undefined}
                        className={`${cellCls} ${okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title={`LOT ${no} 삭제`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ===== 표 아래: LOT 추가 + 요약 ===== */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-teal-400 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50"
          >
            <Plus className="w-3.5 h-3.5" /> LOT 추가
          </button>
          {overview.count > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${PROCESS_THEME.dyeing.cell}`}>
              LOT {overview.count}개 · 완료 {overview.done}{overview.inProgress ? ` · 진행 ${overview.inProgress}` : ''}{overview.issue ? ` · 문제 ${overview.issue}` : ''}
            </span>
          )}
        </div>
      </div>
    </PopoverShell>
  );
};

export default LotEditor;
