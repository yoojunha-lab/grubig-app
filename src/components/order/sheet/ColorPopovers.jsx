import React, { useEffect, useRef, useState } from 'react';
import { FileCheck2, BadgeCheck } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { TrackEditor } from '../common/TrackEditor';
import { BRAND_CONFIRM_STATUSES, TEST_REPORT_STATUSES } from '../../../constants/production';
import { shortDate, todayYmd } from '../../../utils/orderCalculations';

// ============================================================
// 컬러 줄 팝오버 모음
// ------------------------------------------------------------
// ConfirmPopover: 컨펌 칸 — 시험성적서 + 브랜드 컨펌 (대표님 요청 2026-10-11)
// - 시험성적서: [✓ 시험성적서] 체크한 컬러만 → 발행 예상일 + 상태(발행중·합격·불합격·재투입·재합격)
// - 브랜드 컨펌: 상태(전달·컨펌·리젝)
// - 상태 드롭다운을 바꿀 때마다 그날 날짜로 기록 한 줄 (날짜·상태 고치기 · 지우기 가능 — TrackEditor)
// - 로컬 draft 로 편집 → [저장] 시 바뀐 칸만 onSave({ testReport?, brandConfirm? })
// - Enter = 저장, ESC / 바깥 클릭 = 닫기 — 저장 안 한 변경이 있으면 '변경사항이 있습니다' 창 (PopoverShell)
// props: order, color, anchorRect(null=화면 가운데), onClose, onSave(patch) => Promise<boolean>
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400';

const toDraft = (color) => ({
  testReport: {
    needed: !!color?.testReport?.needed,
    expectedDate: color?.testReport?.expectedDate || '',
    events: (color?.testReport?.events || []).map(e => ({ ...e })),
  },
  brandConfirm: {
    events: (color?.brandConfirm?.events || []).map(e => ({ ...e })),
  },
});

const key = (v) => JSON.stringify(v);

// Enter 로 저장할지 (한글 조합 중 Enter · 버튼 · 고르기 칸은 제외)
const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false;
  const tag = e.target?.tagName;
  return tag === 'INPUT' && e.target.type !== 'checkbox';
};

export const ConfirmPopover = ({ order, color, anchorRect = null, onClose, onSave }) => {
  // 열 때 값과 비교해 바뀐 칸만 저장 (열어둔 사이 다른 칸의 변경을 덮어쓰지 않도록)
  const [initial] = useState(() => toDraft(color));
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // 저장 중에 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  if (!order || !color) return null;

  const patch = {};
  if (key(draft.testReport) !== key(initial.testReport)) patch.testReport = draft.testReport;
  if (key(draft.brandConfirm) !== key(initial.brandConfirm)) patch.brandConfirm = draft.brandConfirm;
  const isDirty = Object.keys(patch).length > 0;

  const t = draft.testReport;
  const testDone = ['pass', 'repass'].includes(t.events[t.events.length - 1]?.status);
  const expectedLate = t.needed && t.expectedDate && !testDone && t.expectedDate < todayYmd();

  // ---------- 변경 ----------
  const setTest = (p) => setDraft(d => ({ ...d, testReport: { ...d.testReport, ...p } }));
  const setBrandEvents = (events) => setDraft(d => ({ ...d, brandConfirm: { ...d.brandConfirm, events } }));

  // ---------- 저장 / 닫기 ----------
  const close = () => {
    closedRef.current = true;
    onClose?.();
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!isDirty) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.(patch)) !== false;
    } catch {
      ok = false;
    }
    savingRef.current = false;
    if (closedRef.current) return;
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
    <div className="flex items-center justify-end gap-1.5">
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
        disabled={saving}
        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );

  const subtitle = [order.articleNo, order.customer].filter(Boolean).join(' · ');

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={420}
      title={`${order.orderNumber || '새 오더'} · ${color.name || '컬러'} 컨펌`}
      subtitle={subtitle || undefined}
      onClose={close}
      dirty={isDirty && !saving}
      onSaveDirty={handleSave}
      footer={footer}
    >
      {/* 열리면 이 영역에 포커스(data-autofocus) → Tab 으로 칸 이동, 날짜 칸에서 Enter = 저장 */}
      <div className="p-3 space-y-3 outline-none" tabIndex={-1} data-autofocus onKeyDown={onKeyDown}>
        {/* ---------- 시험성적서 ---------- */}
        <section className={`rounded-lg border p-2.5 space-y-2 ${t.needed ? 'border-fuchsia-200 bg-fuchsia-50/40' : 'border-dashed border-slate-200'}`}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={t.needed}
              onChange={e => setTest({ needed: e.target.checked })}
              className="w-4 h-4 accent-fuchsia-600"
            />
            <FileCheck2 className="w-4 h-4 text-fuchsia-600" />
            <span className="text-xs font-extrabold text-slate-700">시험성적서</span>
            <span className="text-[10px] text-slate-400">{t.needed ? '이 컬러는 시험성적서를 받아요' : '필요한 컬러만 체크'}</span>
          </label>
          {t.needed ? (
            <>
              <label className="grid grid-cols-[76px_1fr] items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">발행 예상일</span>
                <input
                  type="date"
                  value={t.expectedDate}
                  onChange={e => setTest({ expectedDate: e.target.value })}
                  className={`${INPUT_CLS} ${expectedLate ? 'border-red-300 bg-red-50' : ''}`}
                />
              </label>
              {expectedLate && (
                <p className="text-[10px] font-bold text-red-600">발행 예상일({shortDate(t.expectedDate)})이 지났는데 아직 합격 전이에요.</p>
              )}
              <TrackEditor
                label="상태"
                statuses={TEST_REPORT_STATUSES}
                events={t.events}
                onChange={events => setTest({ events })}
              />
            </>
          ) : (
            t.events.length > 0 && (
              <p className="text-[10px] text-slate-500">체크를 풀면 성적서 기록({t.events.length}줄)은 남지만 진행 상태·간트에서 빠져요.</p>
            )
          )}
        </section>

        {/* ---------- 브랜드 컨펌 ---------- */}
        <section className="rounded-lg border border-sky-200 bg-sky-50/40 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-extrabold text-slate-700">브랜드 컨펌</span>
            <span className="text-[10px] text-slate-400">가공지를 브랜드에 보내 승인받기</span>
          </div>
          <TrackEditor
            label="상태"
            statuses={BRAND_CONFIRM_STATUSES}
            events={draft.brandConfirm.events}
            onChange={setBrandEvents}
          />
        </section>
      </div>
    </PopoverShell>
  );
};

export default ConfirmPopover;
