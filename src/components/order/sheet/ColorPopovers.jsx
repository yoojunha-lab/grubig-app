import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { CONFIRM_RESULTS } from '../../../constants/production';
import { createConfirmRound, getConfirmState } from '../../../utils/orderModel';
import { todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 컬러 줄 팝오버 모음
// ------------------------------------------------------------
// ConfirmPopover: 브랜드 컨펌 라운드(1차, 2차…) 편집
// - 라운드마다 발송일 · 결과일 · 결과(합격/불합격/미정)
// - 마지막 라운드가 불합격일 때만 [재컨펌(n차) 추가]
// - 로컬 draft 로 편집 → [저장] 시 onSave(rounds) 한 번에 확정
// - Enter = 저장, ESC / 바깥 클릭 = 닫기 (PopoverShell 이 처리) — 저장 안 한 변경이 있으면 한 번 묻기
// props: order, color, anchorRect(null=화면 가운데), onClose, onSave(rounds) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

// 결과 버튼: 합격 / 불합격 / 미정
const RESULT_OPTIONS = [
  ...CONFIRM_RESULTS,
  { key: '', label: '미정', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
];

// 컨펌 상태 뱃지 색 (합격=초록, 불합격=빨강, 컨펌중=하늘, 준비=회색)
const CONFIRM_STATE_CLS = {
  pass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  fail: 'bg-rose-100 text-rose-700 border-rose-300',
  sent: 'bg-sky-100 text-sky-700 border-sky-300',
  ready: 'bg-slate-100 text-slate-600 border-slate-300',
};

// 저장된 라운드 정리 (차수 1..N 재정렬, 결과값 정리)
const cleanRounds = (rounds) => (Array.isArray(rounds) ? rounds : []).map((r, i) => ({
  round: i + 1,
  sentDate: r?.sentDate || '',
  resultDate: r?.resultDate || '',
  result: r?.result === 'pass' || r?.result === 'fail' ? r.result : '',
}));

// Enter 로 저장할지 (한글 조합 중 Enter · 버튼 누름은 제외)
const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag !== 'TEXTAREA' && tag !== 'BUTTON';
};

export const ConfirmPopover = ({ order, color, anchorRect = null, onClose, onSave }) => {
  // 열 때 값(original)과 비교해 바뀐 게 없으면 저장하지 않음 (열어둔 사이 다른 변경을 덮어쓰지 않도록)
  const [original] = useState(() => cleanRounds(color?.confirmRounds));
  const [rounds, setRounds] = useState(original);
  const [saving, setSaving] = useState(false);
  // 이 창이 이미 닫혔는지 — 저장 중에 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
  // (그 사이 새로 연 다른 컬러의 컨펌 창이 닫혀 버리는 것 방지)
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order || !color) return null;

  const isDirty = JSON.stringify(rounds) !== JSON.stringify(original);
  const last = rounds[rounds.length - 1] || null;
  const state = getConfirmState({ confirmRounds: rounds });

  // 발송일보다 결과일이 빠른 라운드 (저장 막음)
  const badDate = (r) => !!(r.sentDate && r.resultDate && r.sentDate > r.resultDate);
  const hasError = rounds.some(badDate);

  // ---------- 변경 ----------
  const updateRound = (idx, patch) => setRounds(list => list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // 결과 선택 → 결과일이 비어 있으면 오늘로 채움 (발송일이 미래면 채우지 않음)
  // 미정으로 되돌리면, 방금 자동으로 채운 결과일(열 때는 비어 있던 오늘 날짜)도 함께 비움
  const setResult = (idx, result) => setRounds(list => list.map((r, i) => {
    if (i !== idx) return r;
    const today = todayYmd();
    if (!result) {
      const autoFilled = !!r.result && r.resultDate === today && !original[idx]?.resultDate;
      return { ...r, result, resultDate: autoFilled ? '' : r.resultDate };
    }
    const fillToday = !r.resultDate && (!r.sentDate || r.sentDate <= today);
    return { ...r, result, resultDate: fillToday ? today : r.resultDate };
  }));

  const addRound = () => setRounds(list => [...list, createConfirmRound(list.length + 1)]);
  const removeLastRound = () => setRounds(list => list.slice(0, -1));
  const clearAll = () => setRounds([]);

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  // 바깥 클릭 / ESC / X 로 닫을 때: 저장 안 한 변경이 있으면 한 번 묻기
  const requestClose = () => {
    if (!saving && isDirty && !window.confirm('저장하지 않은 컨펌 변경 내용이 있어요. 닫을까요?')) return;
    close();
  };

  const handleSave = async () => {
    if (saving || hasError) return;
    if (!isDirty) {
      close(); // 바뀐 게 없으면 저장하지 않고 닫기
      return;
    }
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(cleanRounds(rounds))) !== false;
    } catch {
      ok = false;
    }
    if (closedRef.current) return; // 저장 중에 이미 닫힘
    if (ok) close();
    else setSaving(false);
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation(); // 포털이어도 React 이벤트는 부모(표 칸)로 올라가므로 저장용 Enter 는 여기서 끝냄
    handleSave();
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {rounds.length > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          disabled={saving}
          className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
          title="1차부터 모든 컨펌 기록을 지워요 ([저장]을 눌러야 반영)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          컨펌 기록 지우기
        </button>
      ) : <span />}
      <div className="flex items-center gap-1.5">
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
          disabled={saving || hasError}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  const subtitle = [order.articleNo, order.customer].filter(Boolean).join(' · ');

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={360}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 브랜드 컨펌`}
      subtitle={subtitle || undefined}
      onClose={requestClose}
      footer={footer}
    >
      {/* 열리면 이 영역에 포커스(data-autofocus) → 바로 Enter 로 저장, Tab 으로 칸 이동 */}
      <div className="p-3 space-y-2 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* 현재 상태 요약 */}
        {rounds.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold">현재</span>
            <span className={`px-1.5 py-0.5 rounded border font-bold ${CONFIRM_STATE_CLS[state.key] || CONFIRM_STATE_CLS.ready}`}>
              {state.label}
            </span>
          </div>
        )}

        {/* 라운드 목록 */}
        {rounds.map((r, idx) => {
          const isLast = idx === rounds.length - 1;
          const err = badDate(r);
          return (
            <div
              key={r.round}
              className={`rounded-lg border p-2 space-y-1.5 ${isLast ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-8 text-xs font-extrabold text-sky-800">{r.round}차</span>
                <div className="flex-1 min-w-0 grid grid-cols-3 gap-1" role="radiogroup" aria-label={`${r.round}차 결과`}>
                  {RESULT_OPTIONS.map(opt => {
                    const active = r.result === opt.key;
                    return (
                      <button
                        key={opt.key || 'none'}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setResult(idx, opt.key)}
                        className={`py-1 rounded-md border text-[11px] font-bold transition ${
                          active ? `${opt.cls} shadow-sm` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {isLast && idx >= 1 ? (
                  <button
                    type="button"
                    onClick={removeLastRound}
                    className="shrink-0 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title={`${r.round}차 삭제`}
                    aria-label={`${r.round}차 삭제`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="shrink-0 w-[22px]" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <label className="block min-w-0">
                  <span className="block mb-0.5 text-[10px] font-bold text-slate-500">발송일</span>
                  <input
                    type="date"
                    value={r.sentDate}
                    onChange={e => updateRound(idx, { sentDate: e.target.value })}
                    className={`${INPUT_CLS} ${err ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="block mb-0.5 text-[10px] font-bold text-slate-500">결과일</span>
                  <input
                    type="date"
                    value={r.resultDate}
                    onChange={e => updateRound(idx, { resultDate: e.target.value })}
                    className={`${INPUT_CLS} ${err ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  />
                </label>
              </div>
              {err && (
                <p className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  결과일이 발송일보다 빨라요.
                </p>
              )}
            </div>
          );
        })}

        {/* 라운드 없음 → 1차 시작 */}
        {rounds.length === 0 && (
          <div className="py-3 text-center space-y-2">
            <p className="text-[11px] text-slate-400">
              {original.length > 0
                ? '컨펌 기록을 모두 지웠어요. [저장]을 눌러야 반영돼요.'
                : '아직 컨펌 기록이 없어요.'}
            </p>
            <button
              type="button"
              onClick={addRound}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-sky-300 bg-sky-50 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
            >
              <Plus className="w-3.5 h-3.5" />
              1차 컨펌 시작
            </button>
          </div>
        )}

        {/* 마지막 라운드가 불합격일 때만 재컨펌 추가 */}
        {last?.result === 'fail' && (
          <button
            type="button"
            onClick={addRound}
            className="w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-rose-300 bg-rose-50 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
          >
            <Plus className="w-3.5 h-3.5" />
            재컨펌({rounds.length + 1}차) 추가
          </button>
        )}
        {last && last.result === '' && (
          <p className="text-[10px] text-slate-400">결과가 불합격이면 재컨펌을 추가할 수 있어요.</p>
        )}
      </div>
    </PopoverShell>
  );
};

export default ConfirmPopover;
