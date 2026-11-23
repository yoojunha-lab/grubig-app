import React, { useMemo, useRef, useState } from 'react';
import { X, Wand2, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { proposeSheetAlignment, sheetKnitAlarm, inchLabel } from '../../utils/knitFactoryModel';
import { DESIGN_STAGES } from '../../constants/common';

// ============================================================
// [설계서 맞추기] — 예전 설계서 편직 사양을 편직처 기계 현황에 맞춤 (대표님 요청 2026-11-24 '지금까지 되어있는건 맞춰줘')
//  · 편직처 이름 · 기종(기계 현황 종류 이름)을 맞추고, 침수 · 피더는 설계서 값이 있으면 그대로(다르면 '다른 값'), 비었으면 기계 현황 값
//    (침수가 기계 현황에 없으면 계산 값 — 설계서에 ≈ 표시)
//  · 애매: 같은 계열 종류로 (미건 '더블' → 양면 자카드) · 기종 빈 칸은 같은 편직처 · 같은 조직 설계서를 따름 (대표님 결정)
//  · 기계 현황에 없는 설계서는 안 바꾸고 알람만 (설계서를 열면 [기계 현황에 이 가마 추가])
//  · 저장하면 설계서 변경 이력에 '편직처 기계 현황에 맞춤' (useDesignSheet 의 order# 맞춤과 같은 방식)
// ============================================================

const FIELD_LABEL = { factory: '편직처', machineType: '기종', needleCount: '침수', feederCount: '피더' };
const sheetNo = (s) => s.eztexOrderNo || s.articleNo || s.devOrderNo || '(번호 없음)';
const stageLabel = (s) => (s.status === 'dropped' ? 'Drop' : DESIGN_STAGES.find(x => x.key === s.stage)?.label || '설계서 작성');
const sameLink = (a, b) => !!a && !!b && a.factoryId === b.factoryId && a.type === b.type && Number(a.inch) === Number(b.inch) && Number(a.gauge) === Number(b.gauge) && !!a.needleEstimated === !!b.needleEstimated;
const specText = (k) => [k?.factory, k?.machineType, k?.machineInch && `${k.machineInch}"`, k?.gauge && `${k.gauge}G`].filter(Boolean).join(' · ') || '(비어 있음)';

const AlignRow = ({ p, children }) => (
  <tr className="align-top">
    <td className="px-2 py-1.5 whitespace-nowrap">
      <b className="text-slate-800">{sheetNo(p.sheet)}</b>
      {p.kind === 'temp' && <span className="ml-1 text-[9px] font-extrabold px-1 rounded bg-amber-50 text-amber-700 border border-amber-200">가설계서</span>}
      <span className="block text-[10px] text-slate-400">{stageLabel(p.sheet)}</span>
    </td>
    <td className="px-2 py-1.5 text-slate-600 max-w-[220px]"><span className="line-clamp-2">{p.sheet.fabricName || '원단명 없음'}</span></td>
    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{specText(p.sheet.knitting)}</td>
    {children}
  </tr>
);

export const KnitSheetAlignModal = ({
  designSheets = [],
  tempDesignSheets = [],   // 가설계서도 같이 (2026-11-24 — 변경 이력이 없어서 칸만 바뀜)
  knitFactories = [],
  config,
  onApply,     // (proposals) => 저장했으면 true
  onClose,
}) => {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const groups = useMemo(() => {
    const out = { todo: [], done: [], alarm: [], other: [] };
    const all = [...designSheets.map(s => ({ s, kind: 'sheet', list: designSheets })), ...tempDesignSheets.map(s => ({ s, kind: 'temp', list: tempDesignSheets }))];
    all.forEach(({ s, kind, list }) => {
      const p = { ...proposeSheetAlignment(s, knitFactories, config, list), kind };
      if (p.status === 'ok') {
        if (Object.keys(p.changes).length || !sameLink(s.knitLink, p.link)) out.todo.push(p);
        else out.done.push(p);
      } else if (p.status === 'no-factory' || p.status === 'no-machine') out.alarm.push({ ...p, alarm: sheetKnitAlarm(s.knitting, knitFactories, config) });
      else out.other.push(p);
    });
    return out;
  }, [designSheets, tempDesignSheets, knitFactories, config]);
  const diffCount = groups.todo.reduce((n, p) => n + p.diffs.length, 0) + groups.done.reduce((n, p) => n + p.diffs.length, 0);

  const apply = async () => {
    if (busyRef.current || !groups.todo.length) return;
    const temps = groups.todo.filter(p => p.kind === 'temp').length;
    if (!window.confirm(`설계서 ${groups.todo.length - temps}건 · 가설계서 ${temps}건의 편직 사양을 기계 현황에 맞춰요.\n설계서는 바뀌는 칸이 변경 이력에 '편직처 기계 현황에 맞춤'으로 남아요.\n\n계속할까요?`)) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (await onApply(groups.todo)) onClose();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wand2 className="w-5 h-5 text-violet-600" /> 설계서 편직 사양 맞추기</h3>
            <p className="text-[11px] text-slate-500">설계서 {designSheets.length}건 · 가설계서 {tempDesignSheets.length}건을 편직처 기계 현황과 맞춰 봤어요. [맞추기]를 누르기 전엔 아무것도 안 바뀌어요.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-600" title="닫기"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-800 font-bold">맞출 것 {groups.todo.length}건</span>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">이미 맞음 {groups.done.length}건</span>
            <span className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold">기계 현황에 없음 {groups.alarm.length}건</span>
            <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-bold">비었거나 모자람 {groups.other.length}건</span>
            {diffCount > 0 && <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold">설계서 ↔ 기계 현황 다른 값 {diffCount}개</span>}
          </div>
          <p className="text-[11px] text-slate-500 flex items-start gap-1"><Info className="w-3.5 h-3.5 mt-px shrink-0" />
            편직처 이름 · 기종은 기계 현황에 맞추고, 침수 · 피더는 설계서 값이 있으면 그대로 둬요(다르면 '다른 값'에 보여요 — 맞는 쪽으로 기계 현황을 고쳐 주세요). 비어 있으면 기계 현황 값을 넣고, 침수가 기계 현황에 없으면 계산 값(≈)을 넣어요.
          </p>

          {groups.todo.length > 0 && (
            <section>
              <h4 className="font-extrabold text-slate-700 mb-1">맞출 것 ({groups.todo.length})</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[900px]">
                  <thead><tr className="text-[10px] text-slate-500 bg-slate-50 text-left">
                    <th className="px-2 py-1.5 font-bold">설계서</th><th className="px-2 py-1.5 font-bold">원단명</th><th className="px-2 py-1.5 font-bold">지금 편직 사양</th>
                    <th className="px-2 py-1.5 font-bold">바뀌는 칸</th><th className="px-2 py-1.5 font-bold">다른 값 (설계서 / 기계 현황)</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {groups.todo.map(p => (
                      <AlignRow key={`${p.kind}_${p.sheet.id}`} p={p}>
                        <td className="px-2 py-1.5">
                          {Object.keys(p.changes).length ? Object.entries(p.changes).map(([k, [from, to]]) => (
                            <div key={k} className="flex items-center gap-1 whitespace-nowrap">
                              <span className="text-slate-500">{FIELD_LABEL[k] || k}</span>
                              <span className="font-mono text-slate-400">{from || '(빈 칸)'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              <b className="font-mono text-violet-700">{k === 'needleCount' && p.link.needleEstimated ? `≈${to}` : to}</b>
                            </div>
                          )) : <span className="text-slate-400">칸은 그대로 · 기계 현황과 연결만</span>}
                          {p.note && <div className="mt-0.5 text-[10px] text-amber-700">{p.note}</div>}
                        </td>
                        <td className="px-2 py-1.5">
                          {p.diffs.length ? p.diffs.map(d => (
                            <div key={d.label} className="whitespace-nowrap text-amber-800">{d.label} <b className="font-mono">{d.sheet}</b> / <b className="font-mono">{d.machine}</b></div>
                          )) : <span className="text-slate-300">—</span>}
                        </td>
                      </AlignRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {groups.alarm.length > 0 && (
            <section>
              <h4 className="font-extrabold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 기계 현황에 없음 ({groups.alarm.length}) — 안 바꾸고 알람만</h4>
              <div className="overflow-x-auto border border-red-200 rounded-xl">
                <table className="w-full min-w-[760px]">
                  <tbody className="divide-y divide-red-100">
                    {groups.alarm.map(p => (
                      <AlignRow key={`${p.kind}_${p.sheet.id}`} p={p}><td className="px-2 py-1.5 text-red-700 font-bold">{p.alarm}</td></AlignRow>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">설계서를 열면 편직 사양 위에 알람이 떠요 — 맞는 기계면 [기계 현황에 이 가마 추가], 아니면 [기계 현황에서 다시 고르기].</p>
            </section>
          )}

          {groups.other.length > 0 && (
            <section>
              <h4 className="font-extrabold text-slate-600 mb-1">비었거나 모자람 ({groups.other.length}) — 안 바꿈</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[760px]">
                  <tbody className="divide-y divide-slate-100">
                    {groups.other.map(p => (
                      <AlignRow key={`${p.kind}_${p.sheet.id}`} p={p}>
                        <td className="px-2 py-1.5 text-slate-500">
                          {p.status === 'empty' ? '편직 사양이 비어 있어요' : p.status === 'incomplete' ? '인치 · 게이지가 없어요' : `맞는 기계가 여러 개예요 (${(p.match.candidates || []).map(b => `${b.type} ${inchLabel(b.inch)}`).join(' · ')})`}
                        </td>
                      </AlignRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {groups.done.length > 0 && (
            <p className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 이미 맞는 설계서 {groups.done.length}건은 그대로 둬요.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={busy} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">닫기</button>
          <button type="button" onClick={apply} disabled={busy || !groups.todo.length}
            className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {groups.todo.length ? `${groups.todo.length}건 맞추기` : '맞출 것 없음'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};
