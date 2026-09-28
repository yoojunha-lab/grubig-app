import React, { useId, useRef, useState } from 'react';
import { Plus, Trash2, Wand2, AlertTriangle, Info, Save } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import {
  DYEING_STEP, DYE_MACHINE_PRESETS, PROGRESS_STATUSES, PROGRESS_STATUS_COLORS, PROCESS_THEME, normalizeStatus,
} from '../../../constants/production';
import {
  getWorkKg, getLossRate, suggestLots, createLot, getLotsTotalKg, getLotSummary,
} from '../../../utils/orderModel';
import { toNumberOrNull, fmtKg, round1 } from '../../../utils/orderCalculations';

// ============================================================
// 염가공 LOT 편집 팝오버 (컬러 1개의 염색탕 계획)
// ------------------------------------------------------------
// - LOT = 염색기(탕)를 한 번 돌리는 단위. 탕 용량은 300kg / 500kg 등 염색소 기계마다 다름
// - [자동 나누기]: 작지kg ÷ 탕 용량으로 LOT 를 균등하게 나눔 (orderModel.suggestLots)
// - 표는 로컬 draft 로 편집 → [저장] 한 번에 확정 (Enter=저장, ESC=닫기)
// - 염색소는 오더 전체 공통 값(order.dyeVendor) — 바뀌었을 때만 따로 저장
// props: order, color, anchorRect, onClose, onSaveLots(lots), onSaveDyeVendor(vendor), dyeVendorOptions
// ============================================================
const WIDTH = 720;
const DIFF_WARN_RATIO = 0.01; // LOT 합계가 작지의 1% 넘게 다르면 경고

const labelCls = 'block text-[10px] font-bold text-slate-500 mb-0.5';
const inputCls = 'w-full border border-slate-300 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-slate-100 disabled:text-slate-400';
// 폭·배경은 칸마다 따로 붙임 (w-full + w-16, bg-white + bg-orange-50 처럼 같은 속성 클래스가 겹치면 의도와 다르게 보임)
const cellBaseCls = 'border rounded px-1.5 py-1 text-[11px] focus:ring-2 focus:ring-teal-500 outline-none';
const cellCls = `w-full ${cellBaseCls}`;
const okBorder = 'border-slate-200 bg-white';
const warnBorder = 'border-orange-400 bg-orange-50';
const errBorder = 'border-red-400 bg-red-50';

// ============================================================
// 1. 숫자/행 변환 헬퍼 (숫자 칸은 입력 중 글자를 그대로 두려고 문자열로 편집)
// ============================================================
const numText = (v) => (v === null || v === undefined ? '' : String(v));

// 숫자 칸 검사: 빈칸 = null(허용), 글자·음수·0(용량) 등은 invalid
const parseNum = (text, { positive = false, integer = false } = {}) => {
  const t = String(text ?? '').trim();
  if (!t) return { value: null, invalid: false };
  const n = toNumberOrNull(t);
  const bad = n === null || n < 0 || (positive && n === 0) || (integer && !Number.isInteger(n));
  return { value: bad ? null : n, invalid: bad };
};

// LOT → 편집 행 (base 에 원본을 보관해 모르는 필드도 저장 시 그대로 유지)
const toRow = (lot) => ({
  base: lot,
  id: lot.id,
  machine: numText(lot.machineKg),
  qty: numText(lot.qtyKg),
  rolls: numText(lot.rolls),
  startDate: lot.startDate || '',
  endDate: lot.endDate || '',
  status: normalizeStatus(lot.status),
  notes: lot.notes || '',
});

// 행 검사 (칸별 오류/경고)
const checkRow = (row) => {
  const machine = parseNum(row.machine, { positive: true });
  const qty = parseNum(row.qty);
  const rolls = parseNum(row.rolls, { integer: true });
  const dateBad = !!(row.startDate && row.endDate && row.startDate > row.endDate);
  const overCap = machine.value !== null && qty.value !== null && qty.value > machine.value;
  return {
    machine, qty, rolls, dateBad, overCap,
    blocking: machine.invalid || qty.invalid || rolls.invalid || dateBad,
  };
};

// 편집 행 → 저장할 LOT
const fromRow = (row, index, check) => ({
  ...row.base,
  id: row.id,
  no: index + 1,
  machineKg: check.machine.value,
  qtyKg: check.qty.value,
  rolls: check.rolls.value,
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.status,
  notes: row.notes.trim(),
});

// 저장 필요 여부 비교 (의미 있는 필드 + 순서) — 원본도 같은 변환을 거친 값과 비교
const lotKey = (l) => [
  l.id, l.machineKg ?? '', l.qtyKg ?? '', l.rolls ?? '',
  l.startDate || '', l.endDate || '', normalizeStatus(l.status), String(l.notes || '').trim(),
].join('|');
const sameLots = (a, b) => a.length === b.length && a.every((l, i) => lotKey(l) === lotKey(b[i]));

// 열릴 때의 편집 상태 (key: 어떤 오더/컬러의 draft 인지)
// vendor / rows 가 null 이면 "아직 안 건드림" → 화면은 최신 order.dyeVendor / color.lots 를 그대로 보여줌
// (열어둔 사이 다른 사람이 바꾼 값을, 건드리지도 않은 옛 값으로 덮어쓰지 않도록)
const makeDraft = (order, color) => {
  const lots = color?.lots || [];
  const lastMachine = toNumberOrNull(lots[lots.length - 1]?.machineKg);
  return {
    key: `${order?.id}|${color?.id}`,
    vendor: null,
    rows: null,
    capacity: String(lastMachine && lastMachine > 0 ? lastMachine : (DYE_MACHINE_PRESETS[0] ?? '')),
  };
};

// ============================================================
// 2. 컴포넌트
// ============================================================
export const LotEditor = ({
  order, color, anchorRect = null, onClose,
  onSaveLots, onSaveDyeVendor, dyeVendorOptions = [],
}) => {
  const uid = useId();
  const sourceKey = `${order?.id}|${color?.id}`;
  const [draft, setDraft] = useState(() => makeDraft(order, color));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 닫기 횟수 — 저장 중에 창을 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
  // (그 사이 새로 연 다른 LOT 창이 닫혀 버리는 것 방지)
  const closeCountRef = useRef(0);

  // 다른 오더/컬러로 다시 열리면 draft 새로 시작 (effect 없이 렌더 중 맞춤)
  if (draft.key !== sourceKey) {
    setDraft(makeDraft(order, color));
    setError('');
  }

  if (!order || !color) return null;

  // ---------- 파생 값 ----------
  const { capacity } = draft;
  const liveRows = (color.lots || []).map(toRow);
  const rows = draft.rows ?? liveRows;
  const vendor = draft.vendor ?? (order.dyeVendor || '');
  const workKg = getWorkKg(color, getLossRate(order));
  const orderKg = toNumberOrNull(color.orderKg);
  const hasWorkKg = workKg !== null && workKg > 0;
  const cap = parseNum(capacity, { positive: true });

  const checks = rows.map(checkRow);
  const nextLots = rows.map((row, i) => fromRow(row, i, checks[i]));
  const baseLots = liveRows.map((row, i) => fromRow(row, i, checkRow(row)));
  const blockingNos = checks.map((c, i) => (c.blocking ? i + 1 : 0)).filter(Boolean);
  const totalKg = getLotsTotalKg(nextLots);
  const summary = getLotSummary(nextLots);
  const diffKg = hasWorkKg ? round1(totalKg - workKg) : 0;
  const showDiff = hasWorkKg && rows.length > 0 && Math.abs(diffKg) > workKg * DIFF_WARN_RATIO;

  // 자동 나누기 미리보기 (suggestLots 와 같은 계산)
  const previewCount = hasWorkKg && cap.value ? Math.max(1, Math.ceil(workKg / cap.value - 1e-9)) : 0;
  const previewEach = previewCount ? round1(workKg / previewCount) : 0;

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

  // [+ LOT 추가] — 탕 용량은 마지막 LOT 값 (LOT 가 없으면 위에서 고른 용량)
  const addRow = () => {
    const last = rows[rows.length - 1];
    const machine = last ? parseNum(last.machine, { positive: true }).value : cap.value;
    const lot = createLot(rows.length + 1, machine, null);
    editRows(list => [...list, toRow(lot)]);
  };

  // [자동 나누기] — 기존 LOT 가 있으면 확인 후 통째로 교체
  const runAutoSplit = () => {
    if (!hasWorkKg || cap.value === null) return;
    if (rows.length > 0) {
      const hasInput = rows.some(r => r.status !== 'pending' || r.startDate || r.endDate || r.rolls.trim() || r.notes.trim());
      const msg = `기존 LOT ${rows.length}개를 새로 나눈 LOT으로 바꿀까요?`
        + (hasInput ? '\n입력해 둔 투입일·완료예정·상태·롤·메모도 함께 지워져요.' : '');
      if (!window.confirm(msg)) return;
    }
    const lots = suggestLots(workKg, cap.value, 1);
    setDraft(d => ({ ...d, rows: lots.map(toRow) }));
    setError('');
  };

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closeCountRef.current += 1;
    onClose();
  };

  const handleSave = async () => {
    if (saving || blockingNos.length) return;
    if (!dirty) {
      close();
      return;
    }
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
      if (closeCountRef.current !== closeCount) return; // 저장 중에 이미 닫힘
      if (!vendorOk || !lotsOk) {
        const failed = [!vendorOk && '염색소', !lotsOk && 'LOT'].filter(Boolean).join('·');
        setError(`${failed} 저장에 실패했어요. 다시 시도해 주세요.`);
        setSaving(false);
        return;
      }
      close();
    } catch {
      if (closeCountRef.current !== closeCount) return;
      setError('저장 중 문제가 생겼어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  // 바깥 클릭 / ESC / X 로 닫을 때: 저장 안 한 변경이 있으면 한 번 묻기
  const requestClose = () => {
    if (!saving && dirty && !window.confirm('저장하지 않은 LOT 변경 내용이 있어요. 닫을까요?')) return;
    close();
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

  // 탕 용량 칸에서 Enter = 자동 나누기
  const onCapacityKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    e.stopPropagation();
    runAutoSplit();
  };

  // ---------- 화면 ----------
  const title = `${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 염가공 LOT 계획`;
  const subtitle = `작지 ${workKg !== null ? `${fmtKg(workKg)}kg` : '미입력'} · 오더 ${orderKg !== null ? `${fmtKg(orderKg)}kg` : '미입력'}`;

  let footerMsg = null;
  if (error) {
    footerMsg = <span className="text-red-600 font-bold">{error}</span>;
  } else if (blockingNos.length) {
    footerMsg = <span className="text-red-600 font-bold">LOT {blockingNos.join(', ')}의 빨간 칸을 고쳐야 저장할 수 있어요.</span>;
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
          disabled={saving || blockingNos.length > 0}
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
      onClose={requestClose}
      footer={footer}
    >
      {/* 열리면 이 영역에 포커스(data-autofocus) → 키보드로 바로 Tab 이동 · Enter 저장 */}
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onFormKeyDown}>
        {/* ===== 상단: 염색소 + 자동 나누기 ===== */}
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex-1 min-w-[180px] rounded-lg border border-slate-200 p-2">
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

          <div className="flex-[2] min-w-[260px] rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className={labelCls}>자동 나누기 (탕 용량)</div>
            {hasWorkKg ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DYE_MACHINE_PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => patchDraft({ capacity: String(p) })}
                      className={`px-2 py-1 rounded-md border text-[11px] font-bold ${
                        cap.value === p
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'
                      }`}
                    >
                      {p}kg
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      value={capacity}
                      onChange={(e) => patchDraft({ capacity: e.target.value })}
                      onKeyDown={onCapacityKeyDown}
                      inputMode="decimal"
                      placeholder="직접"
                      aria-label="탕 용량 직접 입력 (kg)"
                      title={cap.invalid ? '0보다 큰 숫자를 입력하세요' : undefined}
                      className={`${cellBaseCls} w-16 text-right ${cap.invalid ? errBorder : okBorder}`}
                    />
                    <span className="text-[11px] text-slate-500">kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={runAutoSplit}
                    disabled={cap.value === null}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-teal-500 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> 자동 나누기
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {previewCount
                    ? `작지 ${fmtKg(workKg)}kg ÷ ${fmtKg(cap.value)}kg 탕 → ${previewCount} LOT (약 ${fmtKg(previewEach)}kg씩)`
                    : '탕 용량을 고르거나 입력해 주세요.'}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-1 text-[11px] text-slate-500 leading-snug">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>작지수량이 없어서 자동으로 나눌 수 없어요. 현황표에서 오더kg(또는 작지kg)을 먼저 입력해 주세요. 아래 [LOT 추가]로 직접 만들 수는 있어요.</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== LOT 표 ===== */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[680px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500">
                <th className="w-10 px-1.5 py-1.5 text-center">LOT</th>
                <th className="w-[72px] px-1 py-1.5 text-right">탕(kg)</th>
                <th className="w-[84px] px-1 py-1.5 text-right">수량(kg)</th>
                <th className="w-[52px] px-1 py-1.5 text-right">롤</th>
                <th className="w-[120px] px-1 py-1.5 text-left">투입일</th>
                <th className="w-[120px] px-1 py-1.5 text-left">완료예정</th>
                <th className="w-[80px] px-1 py-1.5 text-left">상태</th>
                <th className="px-1 py-1.5 text-left">메모</th>
                <th className="w-8 px-1 py-1.5"><span className="sr-only">삭제</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                    아직 LOT이 없어요. 위의 [자동 나누기] 또는 아래 [LOT 추가]로 만들어 주세요.
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const chk = checks[i];
                const st = PROGRESS_STATUS_COLORS[row.status] || PROGRESS_STATUS_COLORS.pending;
                const no = i + 1;
                const dateTitle = chk.dateBad ? '투입일이 완료예정일보다 늦어요' : undefined;
                return (
                  <tr key={row.id} className="border-t border-slate-100 align-middle">
                    <td className="px-1.5 py-1 text-center font-extrabold text-orange-700">{no}</td>
                    <td className="px-1 py-1">
                      <input
                        value={row.machine}
                        onChange={(e) => updateRow(row.id, { machine: e.target.value })}
                        inputMode="decimal"
                        placeholder="용량"
                        aria-label={`LOT ${no} 탕 용량(kg)`}
                        title={chk.machine.invalid ? '0보다 큰 숫자를 입력하세요' : undefined}
                        className={`${cellCls} text-right ${chk.machine.invalid ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                        inputMode="decimal"
                        placeholder="-"
                        aria-label={`LOT ${no} 수량(kg)`}
                        title={chk.qty.invalid ? '0 이상의 숫자를 입력하세요' : chk.overCap ? '탕 용량 초과' : undefined}
                        className={`${cellCls} text-right font-bold ${chk.qty.invalid ? errBorder : chk.overCap ? warnBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.rolls}
                        onChange={(e) => updateRow(row.id, { rolls: e.target.value })}
                        inputMode="numeric"
                        placeholder="-"
                        aria-label={`LOT ${no} 롤 수`}
                        title={chk.rolls.invalid ? '0 이상의 정수를 입력하세요' : undefined}
                        className={`${cellCls} text-right ${chk.rolls.invalid ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateRow(row.id, { startDate: e.target.value })}
                        aria-label={`LOT ${no} 투입일`}
                        title={dateTitle}
                        className={`${cellCls} ${chk.dateBad ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateRow(row.id, { endDate: e.target.value })}
                        aria-label={`LOT ${no} 완료예정일`}
                        title={dateTitle}
                        className={`${cellCls} ${chk.dateBad ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={row.status}
                        onChange={(e) => updateRow(row.id, { status: e.target.value })}
                        aria-label={`LOT ${no} 상태`}
                        className={`w-full border rounded px-1 py-1 text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500 ${st.bg} ${st.text} ${st.border}`}
                      >
                        {PROGRESS_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
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

        {/* ===== 표 아래: LOT 추가 + 합계 ===== */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-teal-400 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50"
          >
            <Plus className="w-3.5 h-3.5" /> LOT 추가
          </button>
          <div className="ml-auto text-right">
            <div className={`flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-bold ${showDiff ? 'text-orange-600' : 'text-slate-700'}`}>
              {summary && (
                <span className={`px-1.5 py-0.5 rounded font-mono ${PROCESS_THEME.dyeing.cell}`}>{summary}</span>
              )}
              <span>
                LOT 합계 {fmtKg(totalKg)}kg / 작지 {hasWorkKg ? `${fmtKg(workKg)}kg` : '미입력'}
              </span>
            </div>
            {showDiff && (
              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-orange-600">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                합계가 작지수량과 {fmtKg(Math.abs(diffKg))}kg 달라요 ({diffKg > 0 ? '초과' : '부족'})
              </div>
            )}
          </div>
        </div>
      </div>
    </PopoverShell>
  );
};

export default LotEditor;
