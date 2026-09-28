import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { NOTE_TONES, NOTE_TONE_CLASSES } from '../../../constants/production';
import { findDailyNote } from '../../../utils/orderModel';
import { fmtDayLabel } from './ganttLayout';

// ============================================================
// 간트 날짜 칸 메모 팝오버 (엑셀 현황표의 날짜별 status 칸)
// ------------------------------------------------------------
// - 그날 그 줄(오더 전체 또는 컬러)의 짧은 현황 메모 + 칸 색(tone)
// - [저장] → onSave({ date, colorId, text, tone }) · 글자를 비우고 저장하면 삭제
// - Enter = 저장, Shift+Enter = 줄바꿈, ESC / 바깥 클릭 = 닫기
// - weekendNotes: 주말을 숨겼을 때 이 월요일 칸에 함께 보이는 토·일 메모 (읽기 전용 안내만)
// props: order, color(null = 오더 줄), date, weekendNotes?, anchorRect, onClose, onSave(note) => Promise<boolean>
// ============================================================

const isSubmitEnter = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return false; // 한글 조합 중 Enter 무시
  return e.target?.tagName !== 'BUTTON';
};

export const DayNotePopover = ({ order, color = null, date, weekendNotes = [], anchorRect = null, onClose, onSave }) => {
  const colorId = color ? String(color.id) : '';
  const [existing] = useState(() => findDailyNote(order, date, colorId));
  const [text, setText] = useState(() => existing?.text || '');
  const [tone, setTone] = useState(() => existing?.tone || '');
  const [saving, setSaving] = useState(false);

  // PopoverShell 이 위치를 잡은 뒤 커서 (autoFocus 는 숨김 상태라 먹히지 않음)
  const textRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => textRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  if (!order || !date) return null;

  const target = color ? (color.name || '컬러') : '오더 전체';
  const title = `${order.orderNumber || '새 오더'} · ${target} · ${fmtDayLabel(date)}`;

  const submit = async (nextText, nextTone) => {
    if (saving) return;
    const t = nextText.trim();
    // 바뀐 게 없으면 저장하지 않고 닫기 (불필요한 변경 이력 방지)
    const same = existing
      ? t === existing.text && nextTone === (existing.tone || '')
      : !t;
    if (same) {
      onClose?.();
      return;
    }
    setSaving(true);
    let ok = false;
    try {
      ok = (await onSave?.({ date, colorId, text: t, tone: t ? nextTone : '' })) !== false;
    } catch {
      ok = false;
    }
    if (ok) onClose?.();
    else setSaving(false);
  };

  const onKeyDown = (e) => {
    if (!isSubmitEnter(e)) return;
    e.preventDefault();
    e.stopPropagation();
    submit(text, tone);
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {existing ? (
        <button
          type="button"
          onClick={() => submit('', '')}
          disabled={saving}
          className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
          title="이 날짜 메모를 지워요"
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      ) : <span />}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onClose?.()}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => submit(text, tone)}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-[11px] font-bold shadow-sm hover:shadow disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={300}
      title={title}
      subtitle="그날 현황을 짧게 적어두세요 (엑셀 날짜 칸처럼)"
      onClose={onClose}
      footer={footer}
    >
      <div className="p-3 space-y-2.5" onKeyDown={onKeyDown}>
        {weekendNotes.length > 0 && (
          <div className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
            {weekendNotes.map(n => (
              <div key={n.id || n.date} className="break-words">
                <span className="font-bold text-slate-500">{fmtDayLabel(n.date)}</span> {n.text}
              </div>
            ))}
            <div className="text-[10px] text-slate-400">주말 메모도 이 칸에 함께 보여요. 고치려면 &apos;주말 숨기기&apos;를 꺼 주세요.</div>
          </div>
        )}
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="예: 9/15 접수 / 배색 중"
          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:border-teal-400"
        />
        <div>
          <div className="mb-1 text-[11px] font-bold text-slate-500">칸 색</div>
          <div className="flex flex-wrap gap-1">
            {NOTE_TONES.map(t => {
              const active = tone === t.key;
              const swatch = t.key ? NOTE_TONE_CLASSES[t.key] : 'bg-white text-slate-500 border-dashed';
              return (
                <button
                  key={t.key || 'auto'}
                  type="button"
                  onClick={() => setTone(t.key)}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold transition-all ${swatch} ${
                    active ? 'border-teal-500 ring-2 ring-teal-400/60' : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                  title={t.key ? `${t.label} 색` : '그날 걸친 공정 색을 자동으로 써요'}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">Enter 저장 · Shift+Enter 줄바꿈 · 글자를 지우고 저장하면 메모 삭제</p>
      </div>
    </PopoverShell>
  );
};

export default DayNotePopover;
