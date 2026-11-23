import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Factory, ArrowRight, Check, Undo2 } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { KnitMachineSearch } from './KnitMachineSearch';
import { GaugeChips, CategoryChip } from './KnitParts';
import { sheetFieldsFromMachine, sortFactories, feederLabel } from '../../utils/knitFactoryModel';

// ============================================================
// 설계서 편직 사양 [기계 현황에서 고르기] (편직처 기계 현황 — 대표님 요청 2026-11-23)
//  · 설계서에 적힌 게이지 · 인치로 먼저 걸러서 보여 줌 → 기계 줄(게이지 칩)을 고르면
//  · '바뀌는 칸' 확인 (편직처 · 게이지 · 인치 · 침수 · 피더 — 지금 값 → 새 값) → [설계서에 넣기]
//  · 침수는 기계 현황에 적힌 값만 (계산 값은 안 넣음) · 비어 있는 값은 설계서 칸을 그대로 둠
//  · 설계서 저장은 설계서 창에서 (여기선 칸만 채움)
//  · body에 바로 띄움(포털) — 설계서 창 배경의 흐림(backdrop-blur) 안에서는 fixed 창이 화면이 아니라 설계서 창 기준이 돼서
//    설계서를 아래로 내린 채 열면 창이 위로 잘렸음
// ============================================================

const FIELD_LABEL = { factory: '편직처', gauge: '게이지', machineInch: '인치', needleCount: '침수', feederCount: '피더' };
const FIELD_ORDER = ['factory', 'gauge', 'machineInch', 'needleCount', 'feederCount'];

export const KnitMachinePickerModal = ({
  knitFactories = [],
  knitting = {},     // 설계서 knitting 칸 지금 값
  onApply,           // (fields) => 설계서 knitting 칸에 넣기
  onClose,
}) => {
  const [pick, setPick] = useState(null); // { factory, machine, gauge }

  const choose = (factory, machine, gauge) => {
    // 게이지가 여러 개인 줄을 게이지 없이 눌렀으면 고르는 단계에서 게이지를 고르게
    setPick({ factory, machine, gauge: gauge ?? (machine.gauges.length === 1 ? machine.gauges[0] : null) });
  };
  const fields = pick ? sheetFieldsFromMachine(pick.factory, pick.machine, pick.gauge) : null;
  const changes = fields ? FIELD_ORDER.filter(k => fields[k] !== undefined).map(k => ({
    key: k, from: String(knitting?.[k] ?? '').trim(), to: fields[k],
  })) : [];
  const needGauge = pick && pick.machine.gauges.length > 1 && !pick.gauge;

  return createPortal(
    <ModalBackdrop className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Factory className="w-5 h-5 text-violet-600" /> 편직처 기계 현황에서 고르기</h3>
            <p className="text-[11px] text-slate-500">고른 기계의 편직처 · 게이지 · 인치 · 침수 · 피더를 설계서 편직 사양에 넣어요. 설계서 저장은 설계서 창에서 해 주세요.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0" title="닫기"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {knitFactories.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center">편직처 기계 현황이 비어 있어요. 개발 ▾ 편직처 기계 현황에서 먼저 편직처를 넣어 주세요.</p>
          ) : pick ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="border border-violet-200 bg-violet-50/50 rounded-xl p-3 text-sm space-y-1.5">
                <p className="font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
                  {pick.factory.name}
                  <CategoryChip category={pick.machine.category} />
                  {pick.machine.group && <span className="text-xs font-bold text-slate-600">{pick.machine.group}</span>}
                </p>
                <p className="text-xs text-slate-600">
                  {[pick.machine.count && `${pick.machine.count}대`, pick.machine.inch && `${pick.machine.inch}"`, pick.machine.feeder && feederLabel(pick.machine.feeder), pick.machine.maker, pick.machine.note].filter(Boolean).join(' · ')}
                </p>
                {pick.machine.gauges.length > 1 && (
                  <div className="text-xs flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-600">게이지 고르기</span>
                    <GaugeChips gauges={pick.machine.gauges} hit={pick.gauge ? [pick.gauge] : []} onPick={(g) => setPick(prev => ({ ...prev, gauge: g }))} />
                  </div>
                )}
              </div>
              {needGauge ? (
                <p className="text-sm font-bold text-amber-700">이 기계는 가마(게이지)가 여러 개예요. 위에서 게이지를 골라 주세요.</p>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">설계서에서 바뀌는 칸</p>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <tbody className="divide-y divide-slate-100">
                      {changes.map(c => (
                        <tr key={c.key} className={c.from === c.to ? 'text-slate-400' : ''}>
                          <td className="px-3 py-1.5 font-bold w-24">{FIELD_LABEL[c.key]}</td>
                          <td className="px-3 py-1.5 font-mono">{c.from || <span className="text-slate-300">(빈 칸)</span>}</td>
                          <td className="px-1"><ArrowRight className="w-4 h-4 text-slate-300" /></td>
                          <td className={`px-3 py-1.5 font-mono ${c.from === c.to ? '' : 'font-extrabold text-violet-700'}`}>{c.to}{c.from === c.to ? ' (같음)' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!fields.needleCount && <p className="text-[11px] text-slate-500 mt-1">침수는 기계 현황에 적힌 값이 없어서(또는 가마가 여러 개라) 설계서 칸을 그대로 둬요.</p>}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPick(null)} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold inline-flex items-center gap-1.5">
                  <Undo2 className="w-4 h-4" /> 다시 고르기
                </button>
                <button type="button" disabled={needGauge} onClick={() => { onApply(fields); onClose(); }}
                  className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
                  <Check className="w-4 h-4" /> 설계서에 넣기
                </button>
              </div>
            </div>
          ) : (
            <KnitMachineSearch
              factories={sortFactories(knitFactories)}
              initial={{ gauge: knitting?.gauge, inch: knitting?.machineInch }}
              onPick={choose}
              maxHeight="calc(94vh - 300px)"
            />
          )}
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  );
};
