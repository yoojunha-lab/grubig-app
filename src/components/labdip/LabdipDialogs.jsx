import React, { useRef, useState } from 'react';
import { PackageCheck, Send, ClipboardCheck, RotateCcw, Printer, Info } from 'lucide-react';
import { PopoverShell } from '../order/common/PopoverShell';
import { StageChip } from './LabdipParts';
import { todayLocalISO } from '../../utils/helpers';
import {
  realColors, colorStage, currentRound, prevRound, arrivalStartIdx, roundLetters, roundNoText, letterRangeText, letterOf,
  LD_LETTERS_PICK, SENT_METHODS,
} from '../../utils/labdipModel';

// ============================================================
// LAB-DIP 진행 창 4개 — L/D 도착 · 바이어 발송 · 바이어 결과 · 다음 차수 의뢰
//  - 생산 현황 팝업 틀(PopoverShell, 화면 가운데) — 고친 내용이 있으면 닫기 전에 '저장할까요?' (팝업 규약)
//  - [저장]을 누르면 그 의뢰를 바로 저장 (onSave가 저장본을 돌려주면 창을 닫음, 실패하면 그대로)
//  - 처리 중 잠금은 useRef (빠르게 두 번 눌러도 한 번만)
// ============================================================

const smallInput = 'border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none bg-white';

/** 창 공통: 처음 값 · 지금 값 · 저장 중 잠금 · 알림 */
const useDialogForm = (makeInitial) => {
  const [initial] = useState(makeInitial);
  const [form, setForm] = useState(initial);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  // 고치기 시작하면 빨간 알림은 지움
  const changeForm = (update) => { setProblem(''); setForm(update); };
  const patchRow = (colorId, fields) => changeForm(prev => ({
    ...prev, rows: prev.rows.map(r => (r.colorId === colorId ? { ...r, ...fields } : r)),
  }));
  const run = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await fn(); } finally { busyRef.current = false; setBusy(false); }
  };
  return { form, setForm: changeForm, patchRow, dirty, problem, setProblem, busy, run };
};

const Problem = ({ text }) => (text ? (
  <div className="mx-3 mb-3 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">{text}</div>
) : null);

const FooterButtons = ({ onCancel, children }) => (
  <div className="flex items-center justify-end gap-2">
    <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">취소</button>
    {children}
  </div>
);
const primaryBtn = 'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50';

const colorName = (c) => String(c?.name || '').trim() || '(컬러명 없음)';

// ════════════════════════════════════════════════════════════
// ① L/D 도착 — 공장 번호 · 낱장 수 넣기 (공장 진행중 컬러)
// ════════════════════════════════════════════════════════════
export const ArrivalDialog = ({ ld, onClose, onSave }) => {
  const colors = realColors(ld).filter(c => colorStage(c, ld) === 'factory');
  const byId = new Map(colors.map(c => [c.id, c]));
  const { form, setForm, patchRow, dirty, problem, setProblem, busy, run } = useDialogForm(() => ({
    date: todayLocalISO(),
    rows: colors.map(c => {
      const r = currentRound(c);
      return { colorId: c.id, on: true, factoryNo: r.factoryNo || '', letters: r.letters, startIdx: r.no > 1 ? arrivalStartIdx(c, r.factoryNo) : 0, startTouched: false };
    }),
  }));

  // 2차부터: 공장 번호가 앞 차수와 같으면 글자를 이어서 (직접 고른 시작 글자는 그대로)
  const changeNo = (row, value) => {
    const c = byId.get(row.colorId);
    const auto = currentRound(c).no > 1 && !row.startTouched ? { startIdx: arrivalStartIdx(c, value) } : {};
    patchRow(row.colorId, { factoryNo: value, ...auto });
  };

  const submit = () => run(async () => {
    const picked = form.rows.filter(r => r.on);
    if (!picked.length) { setProblem('도착한 컬러를 하나 이상 체크해 주세요.'); return; }
    const missing = picked.filter(r => !String(r.factoryNo).trim());
    if (missing.length) {
      setProblem(`공장 번호를 넣어 주세요 — ${missing.map(r => colorName(byId.get(r.colorId))).join(', ')} (바이어 시트에 찍혀요)`);
      return;
    }
    const saved = await onSave(picked.map(r => ({ colorId: r.colorId, factoryNo: r.factoryNo, letters: r.letters, startIdx: r.startIdx })), form.date || todayLocalISO());
    if (saved) onClose();
  });

  return (
    <PopoverShell width={720} title="L/D 도착 — 공장 번호 넣기" subtitle={`${ld.ldNo || '새 L/D'} · ${ld.factory || '공장 미정'}`}
      onClose={onClose} dirty={dirty} onSaveDirty={submit} dirtyMessage="넣은 공장 번호가 있어요. 저장할까요?"
      footer={(
        <FooterButtons onCancel={onClose}>
          <button type="button" onClick={submit} disabled={busy} className={primaryBtn}><PackageCheck className="w-3.5 h-3.5" /> 도착 저장</button>
        </FooterButtons>
      )}>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">도착일</label>
          <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className={smallInput} data-autofocus="" />
          <span className="text-[10px] text-slate-400">공장에서 온 번호(예: 25S038)와 낱장 수를 컬러마다 넣어요</span>
        </div>
        {form.rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">공장 진행중인 컬러가 없어요.</div>
        ) : (
          <div className="space-y-1.5">
            {form.rows.map(row => {
              const c = byId.get(row.colorId);
              const r = currentRound(c);
              const prev = prevRound(c);
              const preview = roundNoText({ factoryNo: row.factoryNo, letters: row.letters, startIdx: row.startIdx });
              return (
                <div key={row.colorId} className={`border rounded-lg px-2.5 py-2 ${row.on ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 min-w-[140px] cursor-pointer">
                      <input type="checkbox" checked={row.on} onChange={e => patchRow(row.colorId, { on: e.target.checked })} className="w-4 h-4 accent-teal-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase">{colorName(c)}</span>
                      {r.no > 1 && <span className="text-[10px] font-extrabold text-slate-500">{r.no}차</span>}
                    </label>
                    <input value={row.factoryNo} onChange={e => changeNo(row, e.target.value)} disabled={!row.on}
                      placeholder={prev?.factoryNo ? `${prev.no}차 ${prev.factoryNo}` : '공장 번호'}
                      className={`${smallInput} w-32 font-mono font-bold uppercase`} />
                    <select value={row.letters} onChange={e => patchRow(row.colorId, { letters: Number(e.target.value) })} disabled={!row.on} className={smallInput} title="낱장 수">
                      {Array.from({ length: Math.max(LD_LETTERS_PICK, row.letters) }, (_, i) => i + 1).map(n => <option key={n} value={n}>낱장 {n}장</option>)}
                    </select>
                    {r.no > 1 && (
                      <select value={row.startIdx} onChange={e => patchRow(row.colorId, { startIdx: Number(e.target.value), startTouched: true })} disabled={!row.on} className={smallInput} title="첫 낱장 글자">
                        {Array.from({ length: 26 }, (_, i) => i).map(i => <option key={i} value={i}>{letterOf(i)}부터</option>)}
                      </select>
                    )}
                    <span className="text-[11px] font-mono font-bold text-teal-700">{preview}</span>
                  </div>
                  {prev && (
                    <div className="mt-1 pl-6 text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span>{prev.no}차 {[prev.factoryNo, letterRangeText(prev)].filter(Boolean).join(' ')} 리젝{prev.buyerComment ? ` — 바이어: ${prev.buyerComment}` : ''}</span>
                      {prev.factoryNo && row.factoryNo.trim().toUpperCase() !== prev.factoryNo.toUpperCase() && row.on && (
                        <button type="button" onClick={() => changeNo(row, prev.factoryNo)} className="font-bold text-teal-700 hover:underline">{prev.no}차 번호 그대로 (글자 이어서)</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Problem text={problem} />
    </PopoverShell>
  );
};

// ════════════════════════════════════════════════════════════
// ② 바이어 발송 — 보낼 컬러 고르기 · 바이어 시트 PDF · 발송일 · 방법
// ════════════════════════════════════════════════════════════
export const SendDialog = ({ ld, onClose, onSave, onPrint }) => {
  const colors = realColors(ld).filter(c => ['arrived', 'waiting'].includes(colorStage(c, ld)));
  const byId = new Map(colors.map(c => [c.id, c]));
  const { form, setForm, patchRow, dirty, problem, setProblem, busy, run } = useDialogForm(() => ({
    date: todayLocalISO(),
    method: '',
    rows: colors.map(c => ({ colorId: c.id, on: colorStage(c, ld) === 'arrived' })),
  }));
  const pickedIds = form.rows.filter(r => r.on).map(r => r.colorId);

  const print = () => {
    if (!pickedIds.length) { setProblem('바이어 시트에 넣을 컬러를 체크해 주세요.'); return; }
    setProblem('');
    onPrint(pickedIds, form.date || todayLocalISO());
  };
  const submit = () => run(async () => {
    if (!pickedIds.length) { setProblem('보낸 컬러를 하나 이상 체크해 주세요.'); return; }
    const saved = await onSave(pickedIds, form.date || todayLocalISO(), form.method);
    if (saved) onClose();
  });

  return (
    <PopoverShell width={640} title="바이어 발송" subtitle={`${ld.ldNo || '새 L/D'} · ${ld.buyerName || '바이어 미입력'}`}
      onClose={onClose} dirty={dirty} onSaveDirty={submit} dirtyMessage="고른 발송 내용이 있어요. 발송 기록을 저장할까요?"
      footer={(
        <FooterButtons onCancel={onClose}>
          <button type="button" onClick={print} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-white border border-teal-300 rounded-lg hover:bg-teal-50">
            <Printer className="w-3.5 h-3.5" /> 바이어 시트 PDF
          </button>
          <button type="button" onClick={submit} disabled={busy} className={primaryBtn}><Send className="w-3.5 h-3.5" /> 발송 저장</button>
        </FooterButtons>
      )}>
      <div className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">발송일</label>
          <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className={smallInput} data-autofocus="" />
          <label className="text-[11px] font-bold text-slate-500 ml-2">발송 방법</label>
          <input value={form.method} onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))} list="labdip-sent-methods"
            placeholder="퀵 / 택배 / 방문 …" className={`${smallInput} w-36`} />
          <datalist id="labdip-sent-methods">{SENT_METHODS.map(m => <option key={m} value={m} />)}</datalist>
        </div>
        {form.rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">보낼 컬러가 없어요 — 먼저 [L/D 도착]으로 공장 번호를 넣어 주세요.</div>
        ) : (
          <div className="space-y-1.5">
            {form.rows.map(row => {
              const c = byId.get(row.colorId);
              const r = currentRound(c);
              const sentBefore = colorStage(c, ld) === 'waiting';
              return (
                <label key={row.colorId} className={`flex flex-wrap items-center gap-2 border rounded-lg px-2.5 py-2 cursor-pointer ${row.on ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" checked={row.on} onChange={e => patchRow(row.colorId, { on: e.target.checked })} className="w-4 h-4 accent-teal-600" />
                  <span className="text-xs font-extrabold text-slate-800 uppercase min-w-[110px]">{colorName(c)}</span>
                  <span className="text-[11px] font-mono font-bold text-slate-700">{roundNoText(r) || '(공장 번호 없음)'}</span>
                  {sentBefore && <StageChip stage="waiting" label={`${(r.sentDate || '').slice(5).replace('-', '/')} 보냄 — 다시 보내기`} />}
                  {c.comment && <span className="text-[10px] text-slate-500 italic truncate">— {c.comment}</span>}
                </label>
              );
            })}
          </div>
        )}
        <p className="flex items-start gap-1 text-[10px] text-slate-500 leading-snug">
          <Info className="w-3 h-3 shrink-0 mt-px" />
          <span>바이어 시트에는 <b>공장 이름 · PANTONE · 공장 메모가 안 찍혀요.</b> 컬러 옆 코멘트는 작성 화면 컬러 칸의 '바이어 시트 코멘트'예요. [발송 저장]을 누르면 체크한 컬러가 컨펌대기로 넘어가요.</span>
        </p>
      </div>
      <Problem text={problem} />
    </PopoverShell>
  );
};

// ════════════════════════════════════════════════════════════
// ③ 바이어 결과 — 컬러마다 컨펌(낱장 고르기) · 리젝(코멘트) · Drop
// ════════════════════════════════════════════════════════════
const RESULT_CHOICES = [
  { key: '', label: '그대로', cls: 'border-slate-300 text-slate-500 bg-white', on: 'border-slate-500 bg-slate-100 text-slate-700' },
  { key: 'confirm', label: '컨펌', cls: 'border-slate-300 text-slate-600 bg-white', on: 'border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-200' },
  { key: 'reject', label: '리젝', cls: 'border-slate-300 text-slate-600 bg-white', on: 'border-red-400 bg-red-50 text-red-700 ring-2 ring-red-200' },
  { key: 'drop', label: 'Drop', cls: 'border-slate-300 text-slate-600 bg-white', on: 'border-slate-500 bg-slate-200 text-slate-700 ring-2 ring-slate-300' },
];

export const ResultDialog = ({ ld, onClose, onSave }) => {
  const colors = realColors(ld).filter(c => colorStage(c, ld) === 'waiting');
  const byId = new Map(colors.map(c => [c.id, c]));
  const { form, setForm, patchRow, dirty, problem, setProblem, busy, run } = useDialogForm(() => ({
    date: todayLocalISO(),
    rows: colors.map(c => ({ colorId: c.id, result: '', letter: '', comment: '' })),
  }));

  const submit = () => run(async () => {
    const picked = form.rows.filter(r => r.result);
    if (!picked.length) { setProblem('결과를 하나 이상 골라 주세요. (아직 회신이 없는 컬러는 \'그대로\')'); return; }
    const noLetter = picked.filter(r => r.result === 'confirm' && !r.letter);
    if (noLetter.length) { setProblem(`컨펌한 낱장을 골라 주세요 — ${noLetter.map(r => colorName(byId.get(r.colorId))).join(', ')}`); return; }
    const saved = await onSave(picked.map(r => ({ colorId: r.colorId, result: r.result, letter: r.letter, comment: r.comment })), form.date || todayLocalISO());
    if (saved) onClose();
  });

  return (
    <PopoverShell width={680} title="바이어 결과 넣기" subtitle={`${ld.ldNo || '새 L/D'} · ${ld.buyerName || '바이어 미입력'}`}
      onClose={onClose} dirty={dirty} onSaveDirty={submit} dirtyMessage="고른 결과가 있어요. 저장할까요?"
      footer={(
        <FooterButtons onCancel={onClose}>
          <button type="button" onClick={submit} disabled={busy} className={primaryBtn}><ClipboardCheck className="w-3.5 h-3.5" /> 결과 저장</button>
        </FooterButtons>
      )}>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">결과일</label>
          <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className={smallInput} data-autofocus="" />
          <span className="text-[10px] text-slate-400">회신이 온 컬러만 고르고, 아직 안 온 컬러는 '그대로' 두세요</span>
        </div>
        {form.rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">컨펌대기 중인 컬러가 없어요.</div>
        ) : (
          <div className="space-y-1.5">
            {form.rows.map(row => {
              const c = byId.get(row.colorId);
              const r = currentRound(c);
              const letters = roundLetters(r);
              return (
                <div key={row.colorId} className="border border-slate-200 rounded-lg px-2.5 py-2 bg-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-800 uppercase min-w-[110px]">{colorName(c)}</span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">{roundNoText(r)}</span>
                    <div className="ml-auto flex gap-1">
                      {RESULT_CHOICES.map(ch => (
                        <button key={ch.key || 'keep'} type="button" onClick={() => patchRow(row.colorId, { result: ch.key, ...(ch.key === 'confirm' && letters.length === 1 ? { letter: letters[0] } : {}) })}
                          className={`px-2.5 py-1 rounded-md border text-[11px] font-extrabold ${row.result === ch.key ? ch.on : ch.cls}`}>
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {row.result === 'confirm' && (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-1">
                      <span className="text-[10px] font-bold text-slate-500">컨펌한 낱장</span>
                      {letters.map(L => (
                        <button key={L} type="button" onClick={() => patchRow(row.colorId, { letter: L })}
                          className={`w-8 py-1 rounded-md border text-xs font-mono font-extrabold ${row.letter === L ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                          {L}
                        </button>
                      ))}
                    </div>
                  )}
                  {row.result && (
                    <input value={row.comment} onChange={e => patchRow(row.colorId, { comment: e.target.value })}
                      placeholder={row.result === 'reject' ? '바이어 코멘트 (예: 더 붉게) — 2차 의뢰서에 찍혀요' : '바이어 코멘트 (선택)'}
                      className={`${smallInput} w-full mt-1.5`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Problem text={problem} />
    </PopoverShell>
  );
};

// ════════════════════════════════════════════════════════════
// ④ 다음 차수 의뢰 — 리젝 컬러를 같은 L/D NO.로 공장에 다시 (2차 · 3차 …)
// ════════════════════════════════════════════════════════════
export const RedipDialog = ({ ld, onClose, onSave, canPrint = false }) => {
  const colors = realColors(ld).filter(c => colorStage(c, ld) === 'reject');
  const byId = new Map(colors.map(c => [c.id, c]));
  const { form, setForm, patchRow, dirty, problem, setProblem, busy, run } = useDialogForm(() => ({
    requestDate: todayLocalISO(),
    factoryDue: '',
    // 의뢰 메모는 비워 둠 — 앞 차수 바이어 코멘트는 의뢰서에 '1차 … 리젝 — 바이어: …'로 따로 찍혀서 (같은 말 두 번 안 찍히게)
    rows: colors.map(c => ({ colorId: c.id, on: true, requestNote: '', letters: currentRound(c).letters })),
  }));
  const nextNos = [...new Set(colors.map(c => (c.rounds || []).length + 1))];
  const title = nextNos.length === 1 ? `${nextNos[0]}차 의뢰 — 리젝 컬러 다시 의뢰` : '다음 차수 의뢰 — 리젝 컬러 다시 의뢰';

  const submit = (print = false) => run(async () => {
    const picked = form.rows.filter(r => r.on);
    if (!picked.length) { setProblem('다시 의뢰할 컬러를 하나 이상 체크해 주세요.'); return; }
    const saved = await onSave(
      picked.map(r => ({ colorId: r.colorId, requestNote: r.requestNote, letters: r.letters })),
      { requestDate: form.requestDate || todayLocalISO(), factoryDue: form.factoryDue },
      { print },
    );
    if (saved) onClose();
  });

  return (
    <PopoverShell width={680} title={title} subtitle={`${ld.ldNo || '새 L/D'} · ${ld.factory || '공장 미정'} — 같은 L/D NO.로 다시 의뢰해요`}
      onClose={onClose} dirty={dirty} onSaveDirty={() => submit(false)} dirtyMessage="다시 의뢰할 내용이 있어요. 저장할까요?"
      footer={(
        <FooterButtons onCancel={onClose}>
          <button type="button" onClick={() => submit(false)} disabled={busy} className={canPrint ? 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 disabled:opacity-50' : primaryBtn}>
            <RotateCcw className="w-3.5 h-3.5" /> 의뢰 저장
          </button>
          {canPrint && (
            <button type="button" onClick={() => submit(true)} disabled={busy} className={primaryBtn}>
              <Printer className="w-3.5 h-3.5" /> 저장하고 의뢰서 인쇄
            </button>
          )}
        </FooterButtons>
      )}>
      <div className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">의뢰일</label>
          <input type="date" value={form.requestDate} onChange={e => setForm(prev => ({ ...prev, requestDate: e.target.value }))} className={smallInput} data-autofocus="" />
          <label className="text-[11px] font-bold text-slate-500 ml-2">공장 납기</label>
          <input type="date" value={form.factoryDue} onChange={e => setForm(prev => ({ ...prev, factoryDue: e.target.value }))} className={smallInput} />
        </div>
        {form.rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">리젝된 컬러가 없어요.</div>
        ) : (
          <div className="space-y-1.5">
            {form.rows.map(row => {
              const c = byId.get(row.colorId);
              const r = currentRound(c);
              return (
                <div key={row.colorId} className={`border rounded-lg px-2.5 py-2 ${row.on ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 min-w-[150px] cursor-pointer">
                      <input type="checkbox" checked={row.on} onChange={e => patchRow(row.colorId, { on: e.target.checked })} className="w-4 h-4 accent-teal-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase">{colorName(c)}</span>
                      <span className="text-[10px] font-extrabold text-slate-500">→ {(c.rounds || []).length + 1}차</span>
                    </label>
                    <span className="text-[10px] text-slate-500">{r.no}차 {[r.factoryNo, letterRangeText(r)].filter(Boolean).join(' ')} 리젝</span>
                    <select value={row.letters} onChange={e => patchRow(row.colorId, { letters: Number(e.target.value) })} disabled={!row.on} className={`${smallInput} ml-auto`} title="낱장 수">
                      {Array.from({ length: Math.max(LD_LETTERS_PICK, row.letters) }, (_, i) => i + 1).map(n => <option key={n} value={n}>낱장 {n}장</option>)}
                    </select>
                  </div>
                  {r.buyerComment && <div className="mt-1 text-[11px] text-slate-600">바이어 코멘트: <b>{r.buyerComment}</b> <span className="text-slate-400">— 의뢰서에 같이 찍혀요</span></div>}
                  <input value={row.requestNote} onChange={e => patchRow(row.colorId, { requestNote: e.target.value })} disabled={!row.on}
                    placeholder="공장에 더 전할 말 (선택 — 예: 1차 B안보다 조금 더) — 의뢰서에 찍혀요" className={`${smallInput} w-full mt-1.5`} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Problem text={problem} />
    </PopoverShell>
  );
};
