import React, { useId, useRef, useState } from 'react';
import { Plus, Trash2, Save, CalendarPlus, Info, Minus } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { StatusSelect } from '../common/StatusSelect';
import {
  DYEING_STEP, PROGRESS_STATUS_OPTIONS, PROCESS_THEME, PRESETTING_KEY, normalizeStatus,
} from '../../../constants/production';
import {
  createLot, getLotOverview, getDyeYield, getLossRate, getWorkKg, getGreigeStateFor, isPieceDyed, isStepUsed,
  getEndShift, isLotInspectionUsed, getLotRounds,
} from '../../../utils/orderModel';
import { shortDate, fmtKg, round1, toNumberOrNull } from '../../../utils/orderCalculations';

// ============================================================
// 염가공 LOT 편집 창 (컬러 1개의 염색 LOT 계획)
// ------------------------------------------------------------
// - LOT = 염색기를 한 번 돌리는 단위. LOT 마다 투입일 · 완료예정 · 상태 · 배색량 · 메모
//   · 배색량 = 염색소에 배색할 생지 kg → LOSS(오더 로스율)를 뺀 예상 가공지 kg · 예상 YD (대표님 요청 2026-10-14)
//     예상 가공지 kg = 배색량 ÷ (1 + 로스율), 예상 YD = 그 kg ÷ 1야드 무게(gsm × 전폭)
//   · 탕·수량·롤 칸은 없음 (예전에 넣은 값은 문서에 그대로 남음)
// - 프리세팅 (오더 공통 — 염색 전에 하는 일, 원단마다 달라서 [+ 프리세팅]으로 필요할 때만): 예상 시작일 · 예상 종료일 · 상태 · 메모
// - 원단 스펙(gsm · 전폭)은 원단 보관함 · 설계서에서 가져오고, 없으면 여기서 넣으면 오더에 저장 (예상 YD 환산용)
// - 외관검사 차수는 여기서 안 건드림 (외관검사 칸 — LOT 를 지울 때만 같이 지워짐, 확인 창)
// - 표는 로컬 draft 로 편집 → [저장] 한 번에 확정 (Enter=저장, 닫을 때 저장 안 한 변경이 있으면 '변경사항이 있습니다')
// - 염색소는 오더 전체 공통 값(order.dyeVendor) — 바뀌었을 때만 따로 저장
// props: order, color, anchorRect, onClose, onSaveLots(lots), onSaveDyeVendor(vendor), dyeVendorOptions,
//        onSavePresetting(patch), spec(resolveYieldSpec — { gsm, widthFull, source, kind } | null), onSaveSpec({ gsm, widthFull }),
//        prefillNewLotDate(간트에서 고른 날 — 그 날 투입하는 새 LOT 를 미리 넣어 둠)
// ============================================================
const WIDTH = 860;

const labelCls = 'block text-[10px] font-bold text-slate-500 mb-0.5';
const inputCls = 'w-full border border-slate-300 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-slate-100 disabled:text-slate-400';
const cellCls = 'w-full border rounded px-1.5 py-1 text-[11px] focus:ring-2 focus:ring-teal-500 outline-none';
const okBorder = 'border-slate-200 bg-white';
const errBorder = 'border-red-400 bg-red-50';

const numText = (v) => (v === null || v === undefined ? '' : String(v));
// 0 보다 큰 숫자 칸인지 (빈칸 = 괜찮음, 글자·0 이하 = 잘못)
const badPositive = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return false;
  const n = toNumberOrNull(t);
  return n === null || n <= 0;
};
const positiveOf = (text) => {
  const n = toNumberOrNull(String(text ?? '').trim());
  return n !== null && n > 0 ? n : null;
};

// LOT → 편집 행 (base 에 원본을 보관해 모르는 필드(예전 탕·수량·롤, 외관검사)도 저장 시 그대로 유지)
const toRow = (lot) => ({
  base: lot,
  id: lot.id,
  startDate: lot.startDate || '',
  endDate: lot.endDate || '',
  status: normalizeStatus(lot.status),
  dyeKg: numText(lot.dyeKg),
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
  dyeKg: positiveOf(row.dyeKg),
  notes: row.notes.trim(),
});

// 저장 필요 여부 비교 (의미 있는 필드 + 순서)
const lotKey = (l) => [l.id, l.startDate || '', l.endDate || '', normalizeStatus(l.status), l.dyeKg ?? '', String(l.notes || '').trim()].join('|');
const sameLots = (a, b) => a.length === b.length && a.every((l, i) => lotKey(l) === lotKey(b[i]));

// 프리세팅 폼 (오더 공통 steps.presetting)
const PRESET_FIELDS = ['startDate', 'endDate', 'status', 'notes'];
const toPreset = (step) => ({
  startDate: step?.startDate || '',
  endDate: step?.endDate || '',
  status: normalizeStatus(step?.status),
  notes: step?.notes || '',
});
const EMPTY_PRESET = toPreset(null);

// 열릴 때의 편집 상태 (key: 어떤 오더/컬러의 draft 인지)
// vendor / rows / preset / spec 이 null 이면 "아직 안 건드림" → 화면은 최신 값을 그대로 보여줌
// (열어둔 사이 다른 사람이 바꾼 값을, 건드리지도 않은 옛 값으로 덮어쓰지 않도록)
// prefillNewLotDate: 간트에서 고른 날 투입하는 새 LOT 를 처음부터 넣어 둠 (저장해야 반영)
const makeDraft = (order, color, prefillNewLotDate = '') => {
  const lots = color?.lots || [];
  return {
    key: `${order?.id}|${color?.id}`,
    vendor: null,
    rows: prefillNewLotDate ? [...lots.map(toRow), toRow(createLot(lots.length + 1, prefillNewLotDate))] : null,
    preset: null,
    presetShown: null,
    spec: null,
  };
};

// 예상 가공지 kg · YD 글자 ('300kg · 1,076YD')
const yieldText = (y) => (y ? `${fmtKg(y.finishedKg)}kg${y.yd !== null ? ` · ${y.yd.toLocaleString()}YD` : ''}` : '');

export const LotEditor = ({
  order, color, anchorRect = null, onClose,
  onSaveLots, onSaveDyeVendor, dyeVendorOptions = [],
  onSavePresetting, spec = null, onSaveSpec, prefillNewLotDate = '',
}) => {
  const uid = useId();
  const sourceKey = `${order?.id}|${color?.id}`;
  const [draft, setDraft] = useState(() => makeDraft(order, color, prefillNewLotDate));
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
  const badKgNos = rows.map((r, i) => (badPositive(r.dyeKg) ? i + 1 : 0)).filter(Boolean);
  const overview = getLotOverview(nextLots);
  const lossRate = getLossRate(order);

  // 프리세팅 (오더 공통)
  const presetStep = order.steps?.[PRESETTING_KEY];
  const presetUsed = isStepUsed(presetStep);
  const livePreset = toPreset(presetStep);
  const preset = draft.preset ?? livePreset;
  const presetShown = draft.presetShown ?? presetUsed;
  const presetDateBad = presetShown && !!(preset.startDate && preset.endDate && preset.startDate > preset.endDate);
  const presetPatch = {};
  if (presetShown) {
    PRESET_FIELDS.forEach(f => {
      const a = f === 'notes' ? livePreset[f].trim() : livePreset[f];
      const b = f === 'notes' ? preset[f].trim() : preset[f];
      if (a !== b) presetPatch[f] = b;
    });
  } else if (presetUsed) {
    // [빼기] — 프리세팅 칸을 처음 상태로 (예상 종료일 기록도)
    Object.assign(presetPatch, { vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '', endHistory: [] });
  }
  const presetShift = getEndShift(presetStep);

  // 원단 스펙 (예상 YD 환산) — 원단 보관함·설계서에서 온 값은 읽기만, 없거나 오더에 저장된 값은 여기서 고침
  const specEditable = !spec || spec.kind === 'order';
  const liveSpecForm = { gsm: numText(spec?.kind === 'order' ? spec.gsm : ''), widthFull: numText(spec?.kind === 'order' ? spec.widthFull : '') };
  const specForm = draft.spec ?? liveSpecForm;
  const specBad = specEditable && (badPositive(specForm.gsm) || badPositive(specForm.widthFull));
  const draftSpec = specEditable
    ? (positiveOf(specForm.gsm) && positiveOf(specForm.widthFull) ? { gsm: positiveOf(specForm.gsm), widthFull: positiveOf(specForm.widthFull) } : null)
    : spec;
  const specChanged = !!onSaveSpec && specEditable
    && (positiveOf(specForm.gsm) !== positiveOf(liveSpecForm.gsm) || positiveOf(specForm.widthFull) !== positiveOf(liveSpecForm.widthFull));

  const vendorOptions = [...new Set((dyeVendorOptions || []).map(v => String(v || '').trim()).filter(Boolean))];
  const vendorTrim = vendor.trim();
  const vendorChanged = !!onSaveDyeVendor && vendorTrim !== (order.dyeVendor || '').trim();
  const lotsChanged = !!onSaveLots && !sameLots(nextLots, baseLots);
  const presetChanged = !!onSavePresetting && Object.keys(presetPatch).length > 0;
  const dirty = vendorChanged || lotsChanged || presetChanged || specChanged;
  const hasError = badNos.length > 0 || badKgNos.length > 0 || presetDateBad || specBad;
  const isDraftOrder = !order.orderNumber;

  // 합계 · 비교 (배색량 → 예상 가공지 kg · YD / 오더kg · 작지kg / 생지 출고 kg)
  const totalYield = getDyeYield(overview.dyeKg, lossRate, draftSpec);
  const orderKg = toNumberOrNull(color.orderKg);
  const workKg = getWorkKg(color, lossRate);
  const gap = totalYield && orderKg !== null ? round1(totalYield.finishedKg - orderKg) : null;
  const piece = isPieceDyed(order);
  const greige = getGreigeStateFor(order, color);
  // 후염: 생지는 오더에 한 번 → 모든 컬러 배색 합계와 비교 (이 컬러는 편집 중인 값으로)
  const allDyeKg = piece
    ? round1((order.colors || []).reduce((s, c) => s + (c.id === color.id ? (overview.dyeKg || 0) : (getLotOverview(c.lots || []).dyeKg || 0)), 0))
    : (overview.dyeKg || 0);
  const greigeKg = greige.doneKg ?? null;

  // ---------- 편집 ----------
  const patchDraft = (patch) => setDraft(d => ({ ...d, ...patch }));
  // 표를 처음 건드리는 순간 최신 LOT 목록을 draft 로 옮긴 뒤 수정
  const editRows = (fn) => setDraft(d => ({ ...d, rows: fn(d.rows ?? liveRows) }));
  const updateRow = (id, patch) => editRows(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (row, no) => {
    const lot = row.base;
    if (lot && isLotInspectionUsed(lot)) {
      const n = getLotRounds(lot).length;
      if (!window.confirm(`LOT ${no}에 외관검사 기록(${n}차까지)이 있어요.\nLOT를 지우면 외관검사 기록도 같이 지워져요. (저장해야 지워져요)\n지울까요?`)) return;
    }
    editRows(list => list.filter(r => r.id !== row.id));
  };
  const addRow = () => editRows(list => [...list, toRow(createLot(list.length + 1))]);
  const setPreset = (patch) => setDraft(d => ({ ...d, preset: { ...(d.preset ?? livePreset), ...patch } }));
  const showPreset = () => patchDraft({ presetShown: true });
  const hidePreset = () => {
    if (presetUsed && !window.confirm('프리세팅 일정·상태·메모를 비울까요? (저장해야 지워져요)')) return;
    patchDraft({ presetShown: false, preset: EMPTY_PRESET });
  };
  const setSpecField = (field, value) => setDraft(d => ({ ...d, spec: { ...(d.spec ?? liveSpecForm), [field]: value } }));

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closeCountRef.current += 1;
    onClose();
  };

  const handleSave = async () => {
    if (savingRef.current || hasError) return;
    if (!dirty) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    const closeCount = closeCountRef.current;
    try {
      // 염색소 → LOT → 프리세팅 → 스펙 순서로 저장. 모두 연달아 시작해야 훅이 앞 변경 위에 이어서 적용한다.
      // (첫 저장이 끝난 뒤에 부르면 이 창이 들고 있는 예전 함수가 저장 전 오더를 기준으로 덮어써
      //  앞 변경이 사라질 수 있음 — useOrder 의 "연속 수정" 방식에 맞춘 것)
      const vendorTask = vendorChanged ? Promise.resolve(onSaveDyeVendor(vendorTrim)) : Promise.resolve(true);
      const lotsTask = lotsChanged ? Promise.resolve(onSaveLots(nextLots)) : Promise.resolve(true);
      const presetTask = presetChanged ? Promise.resolve(onSavePresetting(presetPatch)) : Promise.resolve(true);
      const specTask = specChanged
        ? Promise.resolve(onSaveSpec({ gsm: positiveOf(specForm.gsm), widthFull: positiveOf(specForm.widthFull) }))
        : Promise.resolve(true);
      const [vendorOk, lotsOk, presetOk, specOk] = await Promise.all([vendorTask, lotsTask, presetTask, specTask]);
      savingRef.current = false;
      if (closeCountRef.current !== closeCount) return; // 저장 중에 이미 닫힘
      if (vendorOk === false || lotsOk === false || presetOk === false || specOk === false) {
        const failed = [vendorOk === false && '염색소', lotsOk === false && 'LOT', presetOk === false && '프리세팅', specOk === false && '원단 스펙']
          .filter(Boolean).join('·');
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
    ? `LOT ${overview.count}개 · 완료 ${overview.done}${overview.start || overview.end ? ` · ${shortDate(overview.start) || '?'}~${shortDate(overview.end) || '?'}` : ''}${overview.dyeKg ? ` · 배색 ${fmtKg(overview.dyeKg)}kg` : ''}`
    : 'LOT마다 투입일 · 완료예정 · 상태 · 배색량';

  let footerMsg = null;
  if (error) {
    footerMsg = <span className="text-red-600 font-bold">{error}</span>;
  } else if (badNos.length) {
    footerMsg = <span className="text-red-600 font-bold">LOT {badNos.join(', ')}의 투입일이 완료예정일보다 늦어요.</span>;
  } else if (badKgNos.length) {
    footerMsg = <span className="text-red-600 font-bold">LOT {badKgNos.join(', ')}의 배색량은 0보다 큰 숫자로 넣어 주세요.</span>;
  } else if (presetDateBad) {
    footerMsg = <span className="text-red-600 font-bold">프리세팅 예상 종료일이 예상 시작일보다 빨라요.</span>;
  } else if (specBad) {
    footerMsg = <span className="text-red-600 font-bold">gsm · 전폭은 0보다 큰 숫자로 넣어 주세요.</span>;
  } else if (isDraftOrder) {
    footerMsg = <span className="text-slate-500">order#를 입력해야 서버에 저장돼요. (지금은 화면에만 반영)</span>;
  } else if (prefillNewLotDate && dirty) {
    footerMsg = <span className="text-teal-700 font-bold">간트에서 고른 {shortDate(prefillNewLotDate)} 투입 LOT를 넣었어요 — [저장]하면 현황표에도 반영돼요.</span>;
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
          disabled={saving || hasError}
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
        {/* ===== 염색소 (오더 전체 공통) + 프리세팅 버튼 ===== */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px] rounded-lg border border-slate-200 p-2">
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
          {!presetShown && onSavePresetting && (
            <button
              type="button"
              onClick={showPreset}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-dashed border-cyan-400 bg-white text-cyan-800 text-[11px] font-bold hover:bg-cyan-50"
              title="염색 전에 프리세팅을 하는 원단만 — 오더 전체 공통 (LOT별 관리 없음)"
            >
              <Plus className="w-3.5 h-3.5" /> 프리세팅
            </button>
          )}
        </div>

        {/* ===== 프리세팅 (오더 공통 — 염색 전) ===== */}
        {presetShown && (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-cyan-900">
                프리세팅 <span className="font-normal text-cyan-800/70">(염색 전 · 오더 전체 공통 — 어느 컬러에서 열어도 같은 값)</span>
              </span>
              <button
                type="button"
                onClick={hidePreset}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50"
                title="이 오더는 프리세팅을 안 해요 (입력한 값 비우기)"
              >
                <Minus className="w-3 h-3" /> 빼기
              </button>
            </div>
            <div className="grid grid-cols-[124px_124px_100px_1fr] gap-1.5 items-end">
              <label className="block min-w-0">
                <span className={labelCls}>예상 시작일</span>
                <input
                  type="date"
                  value={preset.startDate}
                  onChange={e => setPreset({ startDate: e.target.value })}
                  aria-label="프리세팅 예상 시작일"
                  className={`${cellCls} ${presetDateBad ? errBorder : okBorder}`}
                />
              </label>
              <label className="block min-w-0">
                <span className={labelCls}>예상 종료일</span>
                <input
                  type="date"
                  value={preset.endDate}
                  onChange={e => setPreset({ endDate: e.target.value })}
                  aria-label="프리세팅 예상 종료일"
                  className={`${cellCls} ${presetDateBad ? errBorder : okBorder}`}
                />
              </label>
              <div className="min-w-0">
                <span className={labelCls}>상태</span>
                <StatusSelect
                  value={preset.status}
                  options={PROGRESS_STATUS_OPTIONS}
                  onChange={s => setPreset({ status: s })}
                  size="md"
                  instant={false}
                  ariaLabel="프리세팅 상태"
                />
              </div>
              <label className="block min-w-0">
                <span className={labelCls}>메모</span>
                <input
                  value={preset.notes}
                  onChange={e => setPreset({ notes: e.target.value })}
                  placeholder="온도 · 폭 · 특이사항"
                  aria-label="프리세팅 메모"
                  className={`${cellCls} ${okBorder}`}
                />
              </label>
            </div>
            {presetShift && (
              <p className={`text-[10px] font-bold ${presetShift.diff > 0 ? 'text-red-600' : presetShift.diff < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                최초 예상 종료 {shortDate(presetShift.first)}{presetShift.diff ? ` → ${presetShift.diff > 0 ? `${presetShift.diff}일 늦어짐` : `${-presetShift.diff}일 당겨짐`}` : ''}
              </p>
            )}
            {presetStep?.status === 'done' && presetStep.doneDate && (
              <p className="text-[10px] text-cyan-900/70">완료 {shortDate(presetStep.doneDate)}</p>
            )}
          </div>
        )}

        {/* ===== LOT 표 ===== */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[800px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500">
                <th className="w-10 px-1.5 py-1.5 text-center">LOT</th>
                <th className="w-[124px] px-1 py-1.5 text-left">투입일</th>
                <th className="w-[124px] px-1 py-1.5 text-left">완료예정</th>
                <th className="w-[92px] px-1 py-1.5 text-left">상태</th>
                <th className="w-[84px] px-1 py-1.5 text-right" title="염색소에 배색할 생지 kg">배색량 kg</th>
                <th className="w-[124px] px-1 py-1.5 text-left" title={`예상 가공지 kg = 배색량 ÷ (1 + 로스 ${fmtKg(lossRate)}%) · 예상 YD = 가공지 kg ÷ 1야드 무게`}>
                  → 예상 (LOSS 뺀)
                </th>
                <th className="px-1 py-1.5 text-left">메모</th>
                <th className="w-8 px-1 py-1.5"><span className="sr-only">삭제</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                    아직 LOT이 없어요. 아래 [LOT 추가]로 만들어 주세요.
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const no = i + 1;
                const bad = dateBadOf(row);
                const kgBad = badPositive(row.dyeKg);
                const dateTitle = bad ? '투입일이 완료예정일보다 늦어요' : undefined;
                const y = getDyeYield(positiveOf(row.dyeKg), lossRate, draftSpec);
                const inspN = row.base ? getLotRounds(row.base).length : 0;
                return (
                  <tr key={row.id} className="border-t border-slate-100 align-middle">
                    <td className="px-1.5 py-1 text-center font-extrabold text-orange-700">
                      {no}
                      {inspN > 0 && <div className="text-[8px] font-bold text-violet-600" title={`외관검사 ${inspN}차까지`}>검사{inspN > 1 ? `${inspN}차` : ''}</div>}
                    </td>
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
                        instant={false}
                        ariaLabel={`LOT ${no} 상태`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.dyeKg}
                        onChange={(e) => updateRow(row.id, { dyeKg: e.target.value })}
                        placeholder="kg"
                        aria-label={`LOT ${no} 배색량 (kg)`}
                        className={`${cellCls} text-right font-mono ${kgBad ? errBorder : okBorder}`}
                      />
                    </td>
                    <td className="px-1 py-1 font-mono text-[11px] text-orange-900 whitespace-nowrap">
                      {y ? yieldText(y) : <span className="text-slate-300">-</span>}
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
                        onClick={() => removeRow(row, no)}
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

        {/* ===== 배색 합계 → 예상 수량 · 오더/작지/생지와 비교 ===== */}
        <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-2 space-y-1 text-[11px] text-slate-700">
          {overview.dyeKg ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-extrabold text-orange-900">배색 합계 {fmtKg(overview.dyeKg)}kg</span>
                <span className="text-slate-400">→</span>
                <span className="font-bold">예상 {yieldText(totalYield)}</span>
                {orderKg !== null && (
                  <span className={`px-1.5 py-px rounded-full border text-[10px] font-bold ${gap < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    오더 {fmtKg(orderKg)}kg {gap < 0 ? `${fmtKg(-gap)}kg 모자람` : gap > 0 ? `+${fmtKg(gap)}kg 여유` : '딱 맞음'}
                  </span>
                )}
                {workKg !== null && (
                  <span className="text-[10px] text-slate-500">
                    작지 {fmtKg(workKg)}kg {overview.dyeKg < workKg ? `중 ${fmtKg(round1(workKg - overview.dyeKg))}kg 아직 배색 전` : overview.dyeKg > workKg ? `보다 ${fmtKg(round1(overview.dyeKg - workKg))}kg 더 배색` : '전부 배색'}
                  </span>
                )}
              </div>
              {greigeKg !== null && (
                <div className="text-[10px] text-lime-900">
                  생지 출고 {fmtKg(greigeKg)}kg{piece ? ' (오더 전체 · 후염)' : ''} 중 배색 {fmtKg(allDyeKg)}kg{piece ? ' (모든 컬러)' : ''}
                  {' → '}
                  <b className={greigeKg - allDyeKg < 0 ? 'text-red-600' : ''}>
                    {greigeKg - allDyeKg >= 0 ? `${fmtKg(round1(greigeKg - allDyeKg))}kg 남음` : `${fmtKg(round1(allDyeKg - greigeKg))}kg 넘음 (출고 kg 확인)`}
                  </b>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500">LOT마다 <b>배색량(kg)</b>을 넣으면 LOSS를 뺀 예상 가공지 kg · 예상 YD를 바로 계산해 드려요.</p>
          )}

          {/* 환산 기준: 로스율 + 원단 스펙 */}
          <div className="pt-1 border-t border-orange-200/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
            <Info className="w-3 h-3 shrink-0" />
            <span>LOSS = 오더 로스율 <b className="text-slate-700">{fmtKg(lossRate)}%</b> (작지kg 계산과 같은 값)</span>
            <span className="text-slate-300">|</span>
            {specEditable ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span>{spec ? '원단 스펙 (오더에 저장된 값)' : 'YD 환산에 원단 스펙이 필요해요 —'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={specForm.gsm}
                  onChange={e => setSpecField('gsm', e.target.value)}
                  placeholder="gsm"
                  aria-label="원단 gsm"
                  className={`w-16 border rounded px-1.5 py-0.5 text-[11px] text-right font-mono ${badPositive(specForm.gsm) ? errBorder : okBorder}`}
                />
                <span>g/m² · 전폭</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={specForm.widthFull}
                  onChange={e => setSpecField('widthFull', e.target.value)}
                  placeholder="인치"
                  aria-label="원단 전폭 (인치)"
                  className={`w-14 border rounded px-1.5 py-0.5 text-[11px] text-right font-mono ${badPositive(specForm.widthFull) ? errBorder : okBorder}`}
                />
                <span>″ (넣으면 이 오더에 저장)</span>
              </span>
            ) : (
              <span>
                원단 스펙 <b className="text-slate-700">{fmtKg(spec.gsm)}g/m² · 전폭 {fmtKg(spec.widthFull)}″</b> ({spec.source})
              </span>
            )}
          </div>
        </div>

        {prefillNewLotDate && (
          <p className="flex items-center gap-1 text-[10px] text-teal-700">
            <CalendarPlus className="w-3 h-3 shrink-0" />
            간트에서 고른 날짜({shortDate(prefillNewLotDate)})를 투입일로 한 새 LOT가 표 맨 아래에 있어요.
          </p>
        )}
      </div>
    </PopoverShell>
  );
};

export default LotEditor;
