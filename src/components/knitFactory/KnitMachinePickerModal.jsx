import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Factory, ArrowRight, Check, Undo2 } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { KnitMachineSearch } from './KnitMachineSearch';
import { GaugeChips, TypeChip } from './KnitParts';
import { sheetFieldsFromPick, sortFactories, feederLabel, inchLabel, buildBlocks, spandexLabel } from '../../utils/knitFactoryModel';

// ============================================================
// 설계서 편직 사양 [기계 현황에서 고르기] (편직처 기계 현황 — 대표님 요청 2026-11-23, 2차 · 2026-11-24 편직 사양은 여기서만 고름)
//  · 설계서에 적힌 게이지 · 인치로 먼저 걸러서 [기계로 찾기] → 기계 줄(게이지 칩)을 고르면
//  · '바뀌는 칸' 확인 (편직처 · 게이지 · 인치 · 침수 · 피더 — 지금 값 → 새 값) → [설계서에 넣기]
//  · 게이지는 그 기계의 지금 가마 + 같은 종류 · 인치 보유 가마 중에서 (가마를 바꿔 짤 수도 있으니까)
//  · 넣는 칸: 편직처 · 기종(종류) · 게이지 · 인치 · 침수(안 적혀 있으면 계산 값 — ≈ 표시) · 피더(그 기계 줄)
//  · [편직 사양 비우기]
//  · body에 바로 띄움(포털) — 설계서 창 배경 흐림(backdrop-blur) 안에서는 fixed 창이 설계서 창 기준이 되어 잘려 보였음
// ============================================================

const FIELD_LABEL = { factory: '편직처', machineType: '기종', gauge: '게이지', machineInch: '인치', needleCount: '침수', feederCount: '피더' };
const FIELD_ORDER = ['factory', 'machineType', 'gauge', 'machineInch', 'needleCount', 'feederCount'];
const EMPTY_FIELDS = Object.fromEntries(FIELD_ORDER.map(k => [k, '']));

export const KnitMachinePickerModal = ({
  knitFactories = [],
  config,
  knitting = {},     // 설계서 knitting 칸 지금 값
  onApply,           // (fields, link) => 설계서 knitting 칸 + knitLink 에 넣기 (비우기면 link = null)
  onClose,
}) => {
  const hasValues = FIELD_ORDER.some(k => String(knitting?.[k] ?? '').trim());
  const [pick, setPick] = useState(null); // { factory, machine, gauge }

  const choose = (factory, machine, gauge) => setPick({ factory, machine, gauge: gauge || machine.gauge || null });
  const block = pick ? buildBlocks(pick.factory, config).find(b => b.type === pick.machine.type && b.inch === pick.machine.inch) : null;
  const gaugeChoices = block ? block.gauges : [];
  const result = pick && pick.gauge ? sheetFieldsFromPick(pick.factory, pick.machine, pick.gauge) : null;
  const fields = result?.fields || null;
  const changes = fields ? FIELD_ORDER.map(k => ({
    key: k, from: String(knitting?.[k] ?? '').trim(), to: fields[k],
  })).filter(c => c.from || c.to) : [];
  const swapping = pick && pick.gauge && pick.machine.gauge && pick.gauge !== pick.machine.gauge;

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
                  {pick.factory.name} <TypeChip config={config} type={pick.machine.type} />
                </p>
                <p className="text-xs text-slate-600">
                  {[inchLabel(pick.machine.inch), pick.machine.count && `${pick.machine.count}대`, feederLabel(pick.machine.feeder), pick.machine.gauge && `지금 ${pick.machine.gauge}G`, `스판장치 ${spandexLabel(pick.machine.spandex)}`, pick.machine.maker, pick.machine.note].filter(Boolean).join(' · ')}
                </p>
                {gaugeChoices.length > 0 && (
                  <div className="text-xs flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-600">게이지 고르기</span>
                    <GaugeChips gauges={gaugeChoices} hit={pick.gauge ? [pick.gauge] : []} mounted={pick.machine.gauge ? [pick.machine.gauge] : []}
                      counts={Object.fromEntries((block?.cylinders || []).map(c => [c.gauge, c.count]))} onPick={(g) => setPick(prev => ({ ...prev, gauge: g }))} />
                  </div>
                )}
                {swapping && <p className="text-[11px] font-bold text-sky-700">지금 {pick.machine.gauge}G가 꼽혀 있어서 {pick.gauge}G 가마로 바꿔야 해요.</p>}
              </div>
              {!pick.gauge ? (
                <p className="text-sm font-bold text-amber-700">게이지를 골라 주세요. (이 기계는 지금 가마를 몰라요)</p>
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
                          <td className={`px-3 py-1.5 font-mono ${c.from === c.to ? '' : 'font-extrabold text-violet-700'}`}>
                            {c.to ? (c.key === 'needleCount' && result.link.needleEstimated ? `≈${c.to}` : c.to) : <span className="font-normal text-slate-300">(빈 칸)</span>}{c.from === c.to ? ' (같음)' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.link.needleEstimated && <p className="text-[11px] text-slate-500 mt-1">침수가 기계 현황에 안 적혀 있어서 게이지 × 3.14 × 인치로 계산한 값을 넣어요 (설계서에 ≈ 표시). 실제 침수는 기계 현황에 적어 주세요.</p>}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPick(null)} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold inline-flex items-center gap-1.5">
                  <Undo2 className="w-4 h-4" /> 다시 고르기
                </button>
                <button type="button" disabled={!pick.gauge} onClick={() => { onApply(fields, result.link); onClose(); }}
                  className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
                  <Check className="w-4 h-4" /> 설계서에 넣기
                </button>
              </div>
            </div>
          ) : (
            <>
            {hasValues && (
              <div className="flex justify-end mb-2">
                <button type="button" onClick={() => { if (window.confirm('설계서의 편직처 · 기종 · 게이지 · 인치 · 침수 · 피더를 비울까요?')) { onApply(EMPTY_FIELDS, null); onClose(); } }}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline">편직 사양 비우기</button>
              </div>
            )}
            <KnitMachineSearch
              factories={sortFactories(knitFactories)}
              config={config}
              initial={{ gauge: knitting?.gauge, inch: knitting?.machineInch }}
              onPick={choose}
              maxHeight="calc(94vh - 340px)"
            />
            </>
          )}
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  );
};
