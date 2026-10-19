import React, { useId, useState } from 'react';
import { AlertCircle, ChevronDown, Droplets, History, Info, Plus, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { StatusSelect } from '../common/StatusSelect';
import { TrackEditor } from '../common/TrackEditor';
import { SkipBar, SkippedPopover } from '../common/SkipBar';
import { usePopoverSave } from '../common/usePopoverSave';
import { INSPECTION_STATUSES, PROGRESS_STATUS_COLORS, getStatusLabel, normalizeStatus } from '../../../constants/production';
import {
  createInspectionRound, createStatusEvent, getColorInspection, getRoundStatus, roundHasData, isInspectionSkipped,
} from '../../../utils/orderModel';
import { fmtKg, shortDate } from '../../../utils/orderCalculations';

// ============================================================
// 외관검사 입력 창 (컬러 1개 — 현황표 외관검사 칸 · 상세창 · 간트 공용) — 대표님 요청 2026-10-14 'LOT마다 1차 2차'
// ------------------------------------------------------------
// - LOT 마다 검사 차수(1차 · 2차 …): 예상 시작일 · 예상 종료일 · 상태 · 메모
//   · 상태: 투입 전(되돌리기) · 검사중 · 불량컨펌중 · 재가공 · 출고준비완료 · 출고완료
//   · 상태를 바꾸면 오늘 날짜로 기록 한 줄 (날짜는 옆 칸에서 고침, [기록]에서 줄마다 고치기·지우기)
//   · '재가공'(불량 → 염가공소 재투입)을 고르면 다음 차수 검사 줄이 자동으로 생김
// - 그 컬러 LOT 가 모두 '출고완료'면 컬러 출고 칸도 완료로 체크 (orderModel.applyLotInspections)
// - 검사처는 오더 전체 공통 값(order.inspectVendor) — 바뀌었을 때만 따로 저장
// - LOT 가 없는 컬러는 [LOT 만들기] (onOpenLots)
// - 로컬 draft 로 편집 → [저장] 시 바뀐 LOT 만 onSave({ [lotId]: { rounds, base } }) — base(열 때 차수)와 같이 보내서
//   지금 저장된 값과 합침 (열어 둔 사이 현황표에서 고른 상태가 지워지지 않게). Enter = 저장, 닫을 때 저장 안 한 변경이 있으면 묻기
// - 맨 위 [이 오더는 외관검사 안 함] (대표님 요청 2026-10-19) — 오더 전체 '안 함'으로 바로 저장하고 창 닫힘
//   '안 함'인 오더는 안내 + [다시 진행]만 (검사 기록은 지우지 않음 — 다시 진행하면 그대로)
// props: order, color, anchorRect(null = 화면 가운데), onClose, onSave(patchByLot) => Promise<boolean>,
//        onSaveVendor(vendor) => Promise<boolean>, vendorOptions, onOpenLots(), prefill({ lotId, field, date } — 간트에서 고른 날),
//        onSetSkip(skip: boolean) => Promise<boolean> ('안 함' 켜고 끄기 — 없으면 버튼 숨김)
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1 bg-white border rounded-md text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';
const LABEL_CLS = 'block mb-0.5 text-[10px] font-bold text-slate-500';

const copyRounds = (lot) => (lot?.inspections || []).map(r => ({ ...r, events: (r.events || []).map(e => ({ ...e })) }));

// 비교용 (예상 일정 · 메모 · 기록)
const roundsKey = (list) => JSON.stringify((list || []).map(r => [
  r.id, r.startDate || '', r.endDate || '', String(r.notes || '').trim(), (r.events || []).map(e => [e.id, e.status, e.date || '']),
]));

const cleanRounds = (list) => (list || []).map(r => ({ ...r, notes: String(r.notes || '').trim() }));

const makeInitial = (color, prefill) => {
  const out = Object.fromEntries((color?.lots || []).map(l => [l.id, copyRounds(l)]));
  return { base: out, draft: applyPrefill(out, prefill) };
};

// 간트에서 고른 날 → 그 LOT 지금 차수(없으면 1차)의 예상 시작일·종료일
function applyPrefill(byLot, prefill) {
  if (!prefill?.lotId || !prefill.date || !(prefill.lotId in byLot)) return byLot;
  const list = byLot[prefill.lotId].map(r => ({ ...r }));
  if (!list.length) list.push(createInspectionRound());
  const field = prefill.field === 'endDate' ? 'endDate' : 'startDate';
  list[list.length - 1] = { ...list[list.length - 1], [field]: prefill.date };
  return { ...byLot, [prefill.lotId]: list };
}

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox' && !e.target.getAttribute('list');
};

export const InspectionPopover = ({
  order, color, anchorRect = null, onClose, onSave, onSaveVendor, vendorOptions = [], onOpenLots, prefill = null,
  onSetSkip = null,
}) => {
  const listId = useId();
  const [init] = useState(() => makeInitial(color, prefill));
  const [draft, setDraft] = useState(init.draft);
  const [openHistory, setOpenHistory] = useState({}); // { [roundId]: true } 기록 펼침
  const [initialVendor] = useState(() => order?.inspectVendor || '');
  const [vendor, setVendor] = useState(initialVendor);
  const [error, setError] = useState('');
  const { saving, close, run } = usePopoverSave(onClose);

  if (!order || !color) return null;

  // ---------- '안 함' (오더 전체 — 2026-10-19) — 안내 + [다시 진행]만 (컨펌 창과 같은 화면) ----------
  if (isInspectionSkipped(order)) {
    return (
      <SkippedPopover
        kind="inspection"
        order={order}
        title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 외관검사`}
        anchorRect={anchorRect}
        onClose={close}
        onSetSkip={onSetSkip}
      />
    );
  }

  const lots = color.lots || [];
  // 바뀐 LOT 만 (열 때 차수와 비교)
  const patchByLot = {};
  lots.forEach(l => {
    const mine = draft[l.id];
    const base = init.base[l.id];
    if (!mine || !base) return; // 창을 연 뒤 새로 생긴 LOT — 이 창에서는 안 건드림
    if (roundsKey(mine) !== roundsKey(base)) patchByLot[l.id] = { rounds: cleanRounds(mine), base };
  });
  const lotsChanged = Object.keys(patchByLot).length > 0;
  const vendorChanged = !!onSaveVendor && vendor.trim() !== initialVendor.trim();
  const isDirty = lotsChanged || vendorChanged;
  const badRounds = [];
  lots.forEach(l => (draft[l.id] || []).forEach((r, i) => {
    if (r.startDate && r.endDate && r.startDate > r.endDate) badRounds.push(`LOT${l.no} ${i + 1}차`);
  }));

  // 출고 칸 연동 미리 보기 (LOT 가 모두 '출고완료'가 되면 / 풀리면)
  const withDraft = (byLot) => ({ ...color, lots: lots.map(l => ({ ...l, inspections: byLot[l.id] || l.inspections || [] })) });
  const shippedBefore = getColorInspection(withDraft(init.base)).allShipped;
  const shippedAfter = getColorInspection(withDraft(draft)).allShipped;
  const willShip = shippedAfter && !shippedBefore && !color.shipDone;
  const willUnship = shippedBefore && !shippedAfter && !!color.shipAuto;

  const options = [...new Set((vendorOptions || []).map(v => String(v ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  // ---------- 변경 ----------
  const setRounds = (lotId, fn) => setDraft(d => ({ ...d, [lotId]: fn(d[lotId] || []) }));
  const updateRound = (lotId, roundId, patch) => setRounds(lotId, list => list.map(r => (r.id === roundId ? { ...r, ...patch } : r)));
  const addRound = (lotId) => setRounds(lotId, list => [...list, createInspectionRound()]);
  const removeRound = (lotId, round, no) => {
    if (roundHasData(round) && !window.confirm(`${no}차 검사에 입력한 일정·상태·메모를 지울까요? (저장해야 지워져요)`)) return;
    setRounds(lotId, list => list.filter(r => r.id !== round.id));
  };
  // 상태 드롭다운 → 오늘 날짜로 기록 한 줄 ('재가공'이고 마지막 차수면 다음 차수 줄도)
  const setStatus = (lotId, round, status) => setRounds(lotId, list => {
    const cur = getRoundStatus(round) || 'waiting';
    if (!status || cur === status) return list;
    const next = list.map(r => (r.id === round.id ? { ...r, events: [...(r.events || []), createStatusEvent(status)] } : r));
    const isLast = list[list.length - 1]?.id === round.id;
    if (status === 'redye' && isLast) next.push(createInspectionRound());
    return next;
  });
  // 지금 상태를 고른 날 고치기 (마지막 기록의 날짜)
  const setStatusDate = (lotId, round, date) => {
    const ev = round.events || [];
    if (!ev.length) return;
    const last = ev[ev.length - 1];
    updateRound(lotId, round.id, { events: ev.map(e => (e.id === last.id ? { ...e, date } : e)) });
  };

  // ---------- 저장 / 닫기 ----------
  const handleSave = () => {
    if (saving || badRounds.length) return;
    if (!isDirty) {
      close();
      return;
    }
    setError('');
    run(async () => {
      try {
        // 검사처 → 외관검사 순서로 연달아 시작 (useOrder 가 앞 저장 위에 이어서 적용 — LOT 편집과 같은 방식)
        const vendorTask = vendorChanged ? Promise.resolve(onSaveVendor(vendor.trim())) : Promise.resolve(true);
        const inspTask = lotsChanged ? Promise.resolve(onSave?.(patchByLot)) : Promise.resolve(true);
        const [vOk, iOk] = await Promise.all([vendorTask, inspTask]);
        if (vOk === false || iOk === false) {
          setError(`${[vOk === false && '검사처', iOk === false && '외관검사'].filter(Boolean).join('·')} 저장에 실패했어요. 다시 시도해 주세요.`);
          return false;
        }
        return true;
      } catch {
        setError('저장 중 문제가 생겼어요. 다시 시도해 주세요.');
        return false;
      }
    });
  };

  // [이 오더는 외관검사 안 함] — 저장되면 창 닫힘 (이 창에서 고친 내용은 저장하지 않으니, 고친 게 있으면 먼저 물음)
  const requestSkip = () => {
    if (!onSetSkip || saving) return;
    if (isDirty && !window.confirm('이 창에서 고친 내용은 저장하지 않고 이 오더를 \'외관검사 안 함\'으로 바꿀까요?')) return;
    run(() => onSetSkip(true));
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
        {error ? <span className="font-bold text-red-600">{error}</span>
          : badRounds.length ? <span className="font-bold text-red-600">{badRounds.join(', ')}: 예상 종료일이 예상 시작일보다 빨라요.</span>
            : willShip ? <span className="font-bold text-emerald-700">LOT가 모두 출고완료 — 저장하면 이 컬러 출고 칸도 '완료'로 체크돼요.</span>
              : willUnship ? <span className="font-bold text-amber-700">저장하면 '출고완료'로 자동 체크했던 출고가 풀려요.</span>
                : prefill?.date && isDirty ? <span className="font-bold text-teal-700">간트에서 고른 {shortDate(prefill.date)}을 넣었어요 — [저장]하면 현황표에도 반영돼요.</span>
                  : null}
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
          disabled={saving || badRounds.length > 0}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={640}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 외관검사`}
      subtitle="LOT마다 1차 · 2차 — 불량으로 염가공소에 다시 들어가면 '재가공' → 다음 차수"
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* [이 오더는 외관검사 안 함] — 오더 전체 (2026-10-19) */}
        <SkipBar kind="inspection" skipped={false} busy={saving} onSkip={onSetSkip ? requestSkip : undefined} />
        {/* 검사처 (오더 공통) */}
        <label className="block">
          <span className={LABEL_CLS}>검사처 <span className="font-normal text-slate-400">(오더 전체 공통)</span></span>
          <input
            type="text"
            list={listId}
            value={vendor}
            onChange={e => setVendor(e.target.value)}
            disabled={!onSaveVendor}
            placeholder={options.length ? '목록에서 고르거나 직접 입력' : '검사처 이름'}
            className={`${INPUT_CLS} !py-1.5 !text-xs border-slate-300 font-bold`}
          />
          <datalist id={listId}>
            {options.map(v => <option key={v} value={v} />)}
          </datalist>
        </label>

        {lots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50/40 p-3 text-center space-y-2">
            <p className="text-[11px] text-slate-600">이 컬러는 아직 염가공 LOT가 없어요. 외관검사는 LOT마다 해요.</p>
            {onOpenLots && (
              <button
                type="button"
                onClick={() => { close(); onOpenLots(); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-300 bg-white text-[11px] font-bold text-orange-800 hover:bg-orange-50"
              >
                <Droplets className="w-3.5 h-3.5" /> 염가공 LOT 만들기
              </button>
            )}
          </div>
        ) : lots.map(lot => {
          const rounds = draft[lot.id] || [];
          const lotSt = normalizeStatus(lot.status);
          const lotNew = !(lot.id in init.base);
          return (
            <section key={lot.id} className="rounded-lg border border-violet-200 bg-violet-50/30 p-2 space-y-1.5">
              {/* LOT 머리: 번호 · 배색량 · 염가공 상태 · 투입~완료예정 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-orange-700">LOT {lot.no}</span>
                {lot.dyeKg ? <span className="text-[10px] font-mono text-slate-500">배색 {fmtKg(lot.dyeKg)}kg</span> : null}
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${PROGRESS_STATUS_COLORS[lotSt]?.dot || 'bg-slate-400'}`} />
                  염가공 {getStatusLabel(lotSt)}
                  {(lot.startDate || lot.endDate) && <span className="font-mono">· {shortDate(lot.startDate) || '?'}~{shortDate(lot.endDate) || '?'}</span>}
                </span>
                {lotNew && <span className="text-[10px] text-amber-700">창을 연 뒤 생긴 LOT — 다시 열어서 입력</span>}
              </div>

              {rounds.length === 0 && !lotNew && (
                <p className="text-[11px] text-slate-400">아직 검사 일정이 없어요 — [1차 검사 추가]</p>
              )}

              {rounds.map((r, i) => {
                const no = i + 1;
                const status = getRoundStatus(r);
                const ev = r.events || [];
                const lastEv = ev[ev.length - 1];
                const bad = !!(r.startDate && r.endDate && r.startDate > r.endDate);
                const histOpen = !!openHistory[r.id];
                const isLast = i === rounds.length - 1;
                const afterRedye = i > 0 && getRoundStatus(rounds[i - 1]) === 'redye';
                return (
                  <div key={r.id} className={`rounded-md border bg-white p-1.5 space-y-1 ${isLast ? 'border-violet-300' : 'border-slate-200 opacity-90'}`}>
                    <div className="grid grid-cols-[34px_120px_120px_1fr_116px_24px] items-end gap-1.5">
                      <span className="pb-1 text-[11px] font-extrabold text-violet-700">{no}차</span>
                      <label className="block min-w-0">
                        <span className={LABEL_CLS}>예상 시작일</span>
                        <input
                          type="date"
                          value={r.startDate}
                          onChange={e => updateRound(lot.id, r.id, { startDate: e.target.value })}
                          aria-label={`LOT${lot.no} ${no}차 예상 시작일`}
                          className={`${INPUT_CLS} ${bad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className={LABEL_CLS}>예상 종료일</span>
                        <input
                          type="date"
                          value={r.endDate}
                          onChange={e => updateRound(lot.id, r.id, { endDate: e.target.value })}
                          aria-label={`LOT${lot.no} ${no}차 예상 종료일`}
                          className={`${INPUT_CLS} ${bad ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                        />
                      </label>
                      <div className="min-w-0">
                        <span className={LABEL_CLS}>상태</span>
                        <StatusSelect
                          value={status || 'waiting'}
                          options={INSPECTION_STATUSES}
                          onChange={st => setStatus(lot.id, r, st)}
                          size="md"
                          instant={false}
                          ariaLabel={`LOT${lot.no} ${no}차 상태`}
                        />
                      </div>
                      <label className="block min-w-0">
                        <span className={LABEL_CLS}>그 상태 날짜</span>
                        <input
                          type="date"
                          value={lastEv?.date || ''}
                          disabled={!lastEv}
                          onChange={e => setStatusDate(lot.id, r, e.target.value)}
                          aria-label={`LOT${lot.no} ${no}차 상태 날짜`}
                          className={`${INPUT_CLS} border-slate-300 disabled:bg-slate-50 disabled:text-slate-300`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRound(lot.id, r, no)}
                        className="mb-0.5 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title={`${no}차 검사 지우기`}
                        aria-label={`LOT${lot.no} ${no}차 검사 지우기`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={r.notes}
                        onChange={e => updateRound(lot.id, r.id, { notes: e.target.value })}
                        placeholder={afterRedye ? '재가공 내용 · 2차 검사 메모' : '불량 내용 · 출고 준비 사항'}
                        aria-label={`LOT${lot.no} ${no}차 메모`}
                        className={`${INPUT_CLS} border-slate-300`}
                      />
                      {ev.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenHistory(h => ({ ...h, [r.id]: !h[r.id] }))}
                          className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                          title="상태를 바꾼 기록 — 날짜·상태 고치기 · 지우기"
                        >
                          <History className="w-3 h-3" /> 기록 {ev.length}
                          <ChevronDown className={`w-3 h-3 transition-transform ${histOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {histOpen && (
                      <TrackEditor
                        label=""
                        statuses={INSPECTION_STATUSES}
                        events={ev}
                        showPicker={false}
                        onChange={events => updateRound(lot.id, r.id, { events })}
                      />
                    )}
                    {status === 'redye' && isLast && (
                      <p className="text-[10px] font-bold text-orange-700">재가공 — 다시 검사할 {no + 1}차 줄을 추가해 주세요.</p>
                    )}
                  </div>
                );
              })}

              {!lotNew && (
                <button
                  type="button"
                  onClick={() => addRound(lot.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-violet-300 bg-white text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                >
                  <Plus className="w-3 h-3" /> {rounds.length + 1}차 검사 추가
                </button>
              )}
            </section>
          );
        })}

        {badRounds.length > 0 && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> 예상 종료일이 예상 시작일보다 빠른 차수가 있어요.
          </p>
        )}
        <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
          <Info className="w-3 h-3 mt-px shrink-0" />
          <span>
            상태를 바꾸면 오늘 날짜로 기록돼요 ('그 상태 날짜'에서 고침). <b>투입 전</b>으로 되돌릴 수 있고,
            <b> 재가공</b>을 고르면 다음 차수 줄이 생겨요. LOT가 모두 '출고완료'면 이 컬러 출고 칸도 완료로 체크돼요.
          </span>
        </p>
      </div>
    </PopoverShell>
  );
};

export default InspectionPopover;
