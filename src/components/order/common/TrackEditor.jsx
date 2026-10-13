import { AlertTriangle, Trash2 } from 'lucide-react';
import { StatusSelect } from './StatusSelect';
import { createStatusEvent } from '../../../utils/orderModel';

// ============================================================
// 상태 기록 편집 (입력 창 공용 — 시험성적서 · 브랜드 컨펌 · 외관검사) — 대표님 요청 2026-10-11
// ------------------------------------------------------------
// - 위 드롭다운 = 지금 상태. 바꾸면 그날 날짜로 기록 한 줄이 더해짐 ('드롭다운을 바꿀 때마다 그 날을 날짜로')
// - 아래 기록 줄마다 날짜·상태를 고치거나 지울 수 있음 (잘못 고른 상태는 🗑)
// - 마지막 줄이 지금 상태 / 날짜 순서가 뒤바뀌면 노란 안내만 (막지는 않음)
// props: label, statuses([{ key, label, cls }]), events([{ id, status, date }]), onChange(events), placeholder, dateLabel,
//        showPicker(false = 위 드롭다운 없이 기록 줄만 — 외관검사 창처럼 상태 드롭다운이 따로 있을 때)
// ============================================================

const INPUT_CLS = 'w-full min-w-0 px-1.5 py-1 bg-white border border-slate-300 rounded-md text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/60';

export const TrackEditor = ({ label, statuses = [], events = [], onChange, placeholder = '상태 고르기', dateLabel = '날짜', showPicker = true }) => {
  const current = events.length ? events[events.length - 1].status : '';
  const options = statuses.map(s => ({ key: s.key, label: s.label, cls: s.cls }));

  const addStatus = (status) => {
    if (!status || status === current) return;
    onChange?.([...events, createStatusEvent(status)]);
  };
  const update = (id, patch) => onChange?.(events.map(e => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id) => onChange?.(events.filter(e => e.id !== id));
  const outOfOrder = events.some((e, i) => i > 0 && e.date && events[i - 1].date && e.date < events[i - 1].date);

  return (
    <div className="space-y-1.5">
      {showPicker && (
        <div className="flex items-center gap-2 flex-wrap">
          {label && <span className="text-[11px] font-bold text-slate-500 shrink-0">{label}</span>}
          <StatusSelect value={current} options={options} onChange={addStatus} size="md" placeholder={placeholder} ariaLabel={`${label || ''} 상태`} />
          <span className="text-[10px] text-slate-400">바꾸면 오늘 날짜로 기록돼요</span>
        </div>
      )}
      {events.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          <div className="grid grid-cols-[20px_1fr_128px_24px] gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-400">
            <span />
            <span>상태</span>
            <span>{dateLabel}</span>
            <span />
          </div>
          {events.map((e, i) => {
            const last = i === events.length - 1;
            return (
              <div key={e.id} className={`grid grid-cols-[20px_1fr_128px_24px] items-center gap-1.5 px-2 py-1 ${last ? 'bg-teal-50/40' : ''}`}>
                <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                <select
                  value={e.status}
                  onChange={ev => update(e.id, { status: ev.target.value })}
                  aria-label={`${i + 1}번째 기록 상태`}
                  className={`${INPUT_CLS} font-bold`}
                >
                  {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <input
                  type="date"
                  value={e.date}
                  onChange={ev => update(e.id, { date: ev.target.value })}
                  aria-label={`${i + 1}번째 기록 ${dateLabel}`}
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="이 기록 지우기"
                  aria-label={`${i + 1}번째 기록 지우기`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {outOfOrder && (
        <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
          <AlertTriangle className="w-3 h-3 shrink-0" /> 날짜 순서가 뒤바뀌었어요 — 기록은 위에서 아래로 바꾼 순서예요.
        </p>
      )}
    </div>
  );
};

export default TrackEditor;
