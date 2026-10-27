import React, { useState } from 'react';
import { Trash2, History, Undo2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { StageChip } from './LabdipParts';
import { formatMonthDay, todayLocalISO } from '../../utils/helpers';
import {
  currentRound, colorStage, isBlankColor, isFinishedStage, roundNoText, roundLetters, letterOf, letterRangeText,
  arrivalStartIdx, roundRequestDate, roundFactoryDue, dueBadge, daysFromTo, stepBackText,
  LD_LETTERS_PICK, SENT_METHODS, WAITING_WARN_DAYS,
} from '../../utils/labdipModel';

// ============================================================
// LAB-DIP 작성 화면 — 컬러 한 칸
//  ① 컬러명 · PANTONE · 바이어 스와치 첨부 · 낱장 수 · 공장 번호 (지금 차수)
//  ② 공장 메모(의뢰서에 찍힘) · 바이어 시트 코멘트(바이어 시트에 찍힘)
//  ③ 지금 단계 + [기록] [되돌리기] [Drop] — 저장된 L/D만 (진행 버튼은 누르면 바로 저장)
//  [기록]: 차수마다 번호 · 날짜 · 결과를 직접 고치는 칸 (잘못 넣은 것 바로잡기 — [저장]해야 반영)
//  ⚠️ 모듈 레벨 컴포넌트 — 화면 컴포넌트 안에 두면 글자 칠 때마다 다시 만들어져 입력 칸 포커스가 사라짐
// ============================================================

const inputCls = 'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white';
const miniCls = 'border border-slate-200 rounded-md px-1.5 py-1 text-[11px] focus:ring-2 focus:ring-teal-500 outline-none bg-white';
const md = (ymd) => formatMonthDay(ymd) || '-';

/** 지금 단계 설명 한 줄 */
const stageDetail = (c, ld, stage, r, today) => {
  switch (stage) {
    case 'factory': {
      const due = roundFactoryDue(r, ld);
      const b = dueBadge(due, today);
      return (
        <>
          의뢰 {md(roundRequestDate(r, ld))}
          {due ? <> · 공장 납기 {md(due)} {b && <b className={b.tone === 'late' ? 'text-red-600' : b.tone === 'soon' ? 'text-amber-600' : ''}>{b.text}</b>}</> : ' · 공장 납기 미정'}
          {r.requestNote ? <span className="text-slate-400"> · 요청: {r.requestNote}</span> : null}
        </>
      );
    }
    case 'arrived':
      return <>{r.receivedDate ? `도착 ${md(r.receivedDate)}` : '공장 번호 받음'} · <b className="text-indigo-700">바이어 발송 전</b></>;
    case 'waiting': {
      const days = daysFromTo(r.sentDate, today);
      return <>발송 {md(r.sentDate)}{r.sentMethod ? ` ${r.sentMethod}` : ''} · <b className={days !== null && days >= WAITING_WARN_DAYS ? 'text-amber-600' : ''}>보낸 지 {days ?? '-'}일</b></>;
    }
    case 'confirm':
      return <>컨펌 <b>&quot;{r.confirmedLetter || '-'}&quot;</b> · {md(r.resultDate)}{r.buyerComment ? <span className="text-slate-400"> · {r.buyerComment}</span> : null}</>;
    case 'reject':
      return <>리젝 {md(r.resultDate)}{r.buyerComment ? <> — <b>{r.buyerComment}</b></> : ''} · <b className="text-red-600">다시 의뢰 전</b></>;
    case 'drop':
      return <>Drop {md(c.droppedAt)}</>;
    case 'legacy':
      return <>예전 기록{r.sentDate ? ` — 발송 ${md(r.sentDate)}` : ''}</>;
    default:
      return null;
  }
};

/** [기록] — 차수 한 줄 (직접 고치기) */
const RoundEditor = ({ c, ld, r, idx, onPatchRound }) => {
  const set = (fields) => onPatchRound(c.id, idx, fields);
  const letters = roundLetters(r);
  const first = r.no === 1;
  return (
    <div className="border border-slate-200 rounded-lg p-2 bg-white space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="px-1.5 py-px rounded bg-slate-800 text-white text-[10px] font-extrabold">{r.no}차</span>
        <span className="text-slate-400 font-bold">의뢰</span>
        {first
          ? <span className="text-slate-500">{md(roundRequestDate(r, ld))} · 납기 {md(roundFactoryDue(r, ld))} <span className="text-slate-400">(1차는 위 '의뢰일 · 공장 납기')</span></span>
          : (
            <>
              <input type="date" value={r.requestDate || ''} onChange={e => set({ requestDate: e.target.value })} className={miniCls} title="의뢰일" />
              <span className="text-slate-400 font-bold">납기</span>
              <input type="date" value={r.factoryDue || ''} onChange={e => set({ factoryDue: e.target.value })} className={miniCls} title="공장 납기" />
              <input value={r.requestNote || ''} onChange={e => set({ requestNote: e.target.value })} placeholder="공장에 전할 말" className={`${miniCls} flex-1 min-w-[140px]`} />
            </>
          )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-400 font-bold">공장 번호</span>
        <input value={r.factoryNo || ''} onChange={e => set({ factoryNo: e.target.value })} className={`${miniCls} w-24 font-mono font-bold uppercase`} />
        <select value={r.letters} onChange={e => set({ letters: Number(e.target.value) })} className={miniCls} title="낱장 수">
          {Array.from({ length: Math.max(LD_LETTERS_PICK, r.letters) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}장</option>)}
        </select>
        <select value={r.startIdx} onChange={e => set({ startIdx: Number(e.target.value) })} className={miniCls} title="첫 낱장 글자">
          {Array.from({ length: 26 }, (_, i) => i).map(i => <option key={i} value={i}>{letterOf(i)}부터</option>)}
        </select>
        <span className="font-mono font-bold text-teal-700">{letterRangeText(r)}</span>
        <span className="text-slate-400 font-bold ml-2">도착</span>
        <input type="date" value={r.receivedDate || ''} onChange={e => set({ receivedDate: e.target.value })} className={miniCls} />
        <span className="text-slate-400 font-bold ml-2">발송</span>
        <input type="date" value={r.sentDate || ''} onChange={e => set({ sentDate: e.target.value })} className={miniCls} />
        <input value={r.sentMethod || ''} onChange={e => set({ sentMethod: e.target.value })} list="labdip-sent-methods-edit" placeholder="방법" className={`${miniCls} w-20`} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-400 font-bold">결과</span>
        <select value={r.result || ''} onChange={e => set({ result: e.target.value, ...(e.target.value ? {} : { confirmedLetter: '' }) })} className={miniCls}>
          <option value="">아직 없음</option>
          <option value="confirm">컨펌</option>
          <option value="reject">리젝</option>
        </select>
        {r.result === 'confirm' && (
          <select value={r.confirmedLetter || ''} onChange={e => set({ confirmedLetter: e.target.value })} className={miniCls} title="컨펌한 낱장">
            <option value="">낱장?</option>
            {letters.map(L => <option key={L} value={L}>&quot;{L}&quot;</option>)}
          </select>
        )}
        {r.result && <input type="date" value={r.resultDate || ''} onChange={e => set({ resultDate: e.target.value })} className={miniCls} title="결과일" />}
        <input value={r.buyerComment || ''} onChange={e => set({ buyerComment: e.target.value })} placeholder="바이어 코멘트" className={`${miniCls} flex-1 min-w-[140px]`} />
      </div>
    </div>
  );
};

export const LabdipColorCard = ({
  c, index, ld, isSaved,
  onPatch, onPatchRound, onRemove, onStepBack, onDrop,
}) => {
  const [open, setOpen] = useState(false);
  const today = todayLocalISO();
  const r = currentRound(c);
  const rIdx = Math.max(0, (c.rounds || []).length - 1);
  const stage = colorStage(c, ld);
  const blank = isBlankColor(c);
  const back = isSaved && !blank ? stepBackText(c, ld) : '';
  const finished = isFinishedStage(stage);
  const preview = roundNoText(r);

  // 공장 번호를 칸에 바로 넣기 — 2차부터는 앞 차수와 같은 번호면 글자를 이어서
  const changeNo = (value) => onPatchRound(c.id, rIdx, r.no > 1 ? { factoryNo: value, startIdx: arrivalStartIdx(c, value) } : { factoryNo: value });

  return (
    <div className={`border rounded-xl p-3 ${stage === 'drop' ? 'border-slate-200 bg-slate-50/80' : 'border-slate-200 bg-slate-50/50'}`}>
      {/* ① 컬러 · 기준 · 낱장 · 공장 번호 */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">
            <span className="inline-block w-4 text-slate-400 font-mono">{index + 1}</span>컬러명
          </label>
          <input value={c.name ?? ''} onChange={e => onPatch(c.id, { name: e.target.value })} placeholder="NAVY"
            className={`${inputCls} font-bold uppercase`} />
        </div>
        <div className="col-span-7 sm:col-span-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">PANTONE</label>
          <input value={c.pantone ?? ''} onChange={e => onPatch(c.id, { pantone: e.target.value })} placeholder="19-4052 TCX"
            className={`${inputCls} font-mono`} />
        </div>
        <label className="col-span-5 sm:col-span-2 flex items-center gap-1.5 h-[38px] px-2 border border-slate-200 rounded-lg bg-white cursor-pointer text-[11px] font-bold text-slate-600"
          title="체크하면 공장 의뢰서에 스와치 붙이는 칸이 생겨요">
          <input type="checkbox" checked={!!c.swatch} onChange={e => onPatch(c.id, { swatch: e.target.checked })} className="w-4 h-4 accent-teal-600" />
          바이어 스와치
        </label>
        <div className="col-span-4 sm:col-span-1">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">낱장 수</label>
          <select value={r.letters} onChange={e => onPatchRound(c.id, rIdx, { letters: Number(e.target.value) })}
            className={`${inputCls} px-1.5`} title="몇 가지 안을 받을지 (A~)">
            {Array.from({ length: Math.max(LD_LETTERS_PICK, r.letters) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}장</option>)}
          </select>
        </div>
        <div className="col-span-6 sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">공장 번호{r.no > 1 ? ` (${r.no}차)` : ''}</label>
          <input value={r.factoryNo ?? ''} onChange={e => changeNo(e.target.value)} placeholder="L/D 오면"
            className={`${inputCls} font-mono font-bold uppercase`} />
        </div>
        <div className="col-span-2 sm:col-span-1 flex justify-end">
          <button type="button" onClick={() => onRemove(c.id)} title="컬러 빼기"
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ② 메모 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        <input value={c.memo ?? ''} onChange={e => onPatch(c.id, { memo: e.target.value })}
          placeholder="공장 메모 — 의뢰서에 찍혀요 (예: 기존 L/D 25S038 B 참고)" className={`${inputCls} text-xs`} />
        <input value={c.comment ?? ''} onChange={e => onPatch(c.id, { comment: e.target.value })}
          placeholder="바이어 시트 코멘트 — 바이어 시트에 찍혀요 (예: A안 추천)" className={`${inputCls} text-xs`} />
      </div>

      {/* ③ 지금 단계 */}
      {!blank && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
          <StageChip stage={stage} label={stage === 'confirm' && r.confirmedLetter ? `컨펌 "${r.confirmedLetter}"` : undefined} />
          {r.no > 1 && !finished && <span className="text-[10px] font-extrabold text-slate-500">{r.no}차</span>}
          {preview && stage !== 'factory' && <span className="font-mono font-bold text-slate-700">{preview}</span>}
          <span>{stageDetail(c, ld, stage, r, today)}</span>
          {isSaved && (
            <div className="ml-auto flex items-center gap-1">
              {(c.rounds || []).length > 0 && (
                <button type="button" onClick={() => setOpen(v => !v)}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:bg-white border border-transparent hover:border-slate-200">
                  <History className="w-3 h-3" /> 기록{(c.rounds || []).length > 1 ? ` ${(c.rounds || []).length}차` : ''}
                  {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {back && (
                <button type="button" onClick={() => onStepBack(c, back)} title={back}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:bg-white border border-transparent hover:border-slate-200">
                  <Undo2 className="w-3 h-3" /> 되돌리기
                </button>
              )}
              {!finished && (
                <button type="button" onClick={() => onDrop(c)} title="바이어가 이 컬러를 안 하기로 했을 때"
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50">
                  <XCircle className="w-3 h-3" /> Drop
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* [기록] 차수마다 고치기 */}
      {open && isSaved && (
        <div className="mt-2 space-y-1.5">
          {(c.rounds || []).map((round, i) => (
            <RoundEditor key={i} c={c} ld={ld} r={round} idx={i} onPatchRound={onPatchRound} />
          ))}
          <datalist id="labdip-sent-methods-edit">{SENT_METHODS.map(m => <option key={m} value={m} />)}</datalist>
          <p className="text-[10px] text-slate-400">잘못 넣은 번호 · 날짜 · 결과를 여기서 고쳐요 — 위 [저장]을 눌러야 반영돼요.</p>
        </div>
      )}
    </div>
  );
};
