import React, { useMemo } from 'react';
import {
  Save, X, Printer, Copy, Trash2, Plus, Palette, PackageCheck, Send, ClipboardCheck, RotateCcw, Undo2, Sparkles,
} from 'lucide-react';
import { PartnerSelectField } from '../common/PartnerSelectField';
import { SearchableSelect } from '../common/SearchableSelect';
import { LabdipColorCard } from './LabdipColorCard';
import { StageChip, LdField, ldInputCls } from './LabdipParts';
import {
  LD_MODES, WOOL_TYPES, LIGHT_SOURCES, ldModeOf, woolTypeOf, makeColor, detectWoolType, fieldsFromFabric, fabricYarnList,
  findLdNoOwner, realColors, stageCounts, isAllDropped, colorStage, isBlankColor,
} from '../../utils/labdipModel';

// ============================================================
// LAB-DIP 작성 화면 (오른쪽) — 대표님 요청 2026-10-27
//  머리: L/D NO. · 의뢰 방식 · [공장 의뢰서] [복제] [삭제] [저장] [닫기]
//  진행 상황 (저장된 L/D만): 공장 진행중 → [L/D 도착] / 도착 → [바이어 발송] / 컨펌대기 → [결과 넣기] / 리젝 → [2차 의뢰]
//                          진행 버튼은 누르면 바로 저장
//  기본 정보: L/D NO.(저장할 때 자동) · 의뢰 방식 · EZ-TEX 번호 · 바이어 · 공장 · 의뢰일 · 공장 납기 · 바이어 납기
//  원단: 원단 관리에서 고르기 → ARTICLE · ITEM NAME · GSM · 폭 / 울 종류(원사 SW → 슈퍼워시 자동) / 광원
//  컬러: LabdipColorCard / 메모: 특이사항(공장 의뢰서) · 내부 메모(안 찍힘)
// ============================================================

const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">{children}</h3>
    {right}
  </div>
);

/** 진행 상황 한 칸 — 단계 칩 · 컬러 수 · 진행 버튼 */
const StepBox = ({ stage, count, label, actionLabel, icon: Icon, onClick, enabled }) => (
  <div className={`rounded-lg border px-2.5 py-2 flex flex-col gap-1.5 ${count > 0 ? 'bg-white border-slate-200' : 'bg-white/60 border-slate-100'}`}>
    <div className="flex items-center gap-1.5">
      <StageChip stage={stage} label={label} dim={count === 0} />
      <span className={`text-sm font-extrabold ${count > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{count}</span>
    </div>
    <button type="button" onClick={onClick} disabled={!enabled}
      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold border transition-colors disabled:opacity-35 disabled:cursor-not-allowed bg-teal-600 text-white border-teal-600 hover:bg-teal-700">
      <Icon className="w-3.5 h-3.5" /> {actionLabel}
    </button>
  </div>
);

export const LabdipForm = ({
  ld, setLd, isSaved, dirty, busy, nextNo, labdips = [], editingId,
  savedFabrics = [], yarnLibrary = [], dyeingFactories = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner, onOpenFactoryMaster,
  onSave, onClose, onPrintFactory, onDuplicate, onDelete,
  onArrival, onSend, onResult, onRedip, onStepBack, onDropColor, onDropOpen, onRestoreDropped, onReopenLegacy,
}) => {
  const patch = (fields) => setLd(prev => ({ ...prev, ...fields }));
  const patchColor = (colorId, fields) => setLd(prev => ({
    ...prev, colors: prev.colors.map(c => (c.id === colorId ? { ...c, ...fields } : c)),
  }));
  const patchRound = (colorId, idx, fields) => setLd(prev => ({
    ...prev,
    colors: prev.colors.map(c => (c.id !== colorId ? c : { ...c, rounds: c.rounds.map((r, i) => (i === idx ? { ...r, ...fields } : r)) })),
  }));
  const addColor = () => setLd(prev => ({ ...prev, colors: [...prev.colors, makeColor()] }));
  const removeColor = (colorId) => {
    const c = ld.colors.find(x => x.id === colorId);
    if (c && isSaved && !isBlankColor(c)
      && !window.confirm(`'${c.name || c.pantone || '이름 없음'}' — 이 컬러를 뺄까요?\n진행 기록(공장 번호 · 발송 · 결과)도 같이 빠져요. [저장]해야 반영돼요.\n\n바이어가 안 하기로 한 컬러는 빼지 말고 [Drop]으로 남겨 두세요.`)) return;
    setLd(prev => {
      const next = prev.colors.filter(x => x.id !== colorId);
      return { ...prev, colors: next.length ? next : [makeColor()] };
    });
  };

  // ── 원단 (원단 관리 — App에서 이미 Article 순서로 정렬해 둔 목록) ──
  const fabricOptions = useMemo(() => (savedFabrics || [])
    .filter(f => String(f?.article || '').trim())
    .map(f => ({ id: String(f.id), name: `${f.article}${f.itemName ? ` · ${f.itemName}` : ''}` })), [savedFabrics]);
  const linkedFabric = ld.fabricId ? (savedFabrics || []).find(f => String(f.id) === String(ld.fabricId)) || null : null;
  const yarnHint = linkedFabric ? fabricYarnList(linkedFabric, yarnLibrary).map(y => `${y.name || y.category} ${y.ratio}%`).join(' · ') : '';
  const autoWool = detectWoolType({ fabric: linkedFabric, yarnLibrary, itemName: ld.itemName });

  // 원단을 고르면 ARTICLE · ITEM NAME · GSM · 폭을 복사 + 울 종류 자동 / 칸을 비우면 연결만 풂 (적어 둔 값은 그대로)
  const applyFabric = (fabricId) => {
    const f = (savedFabrics || []).find(x => String(x.id) === String(fabricId)) || null;
    if (!f) { patch({ fabricId: '' }); return; }
    const fields = fieldsFromFabric(f);
    patch({ ...fields, woolType: detectWoolType({ fabric: f, yarnLibrary, itemName: fields.itemName }).type, woolManual: false });
  };
  // ITEM NAME을 고치면 울 종류도 다시 (담당자가 직접 고른 뒤에는 그대로)
  const changeItemName = (value) => setLd(prev => (prev.woolManual
    ? { ...prev, itemName: value }
    : { ...prev, itemName: value, woolType: detectWoolType({ fabric: linkedFabric, yarnLibrary, itemName: value }).type }));
  const toggleLight = (l) => setLd(prev => ({
    ...prev,
    lightSources: (prev.lightSources || []).includes(l) ? prev.lightSources.filter(x => x !== l) : [...(prev.lightSources || []), l],
  }));

  const owner = ld.ldNo ? findLdNoOwner(labdips, ld.ldNo, editingId) : null;
  const factoryOptions = [...(dyeingFactories || [])];
  if (ld.factory && !factoryOptions.includes(ld.factory)) factoryOptions.unshift(ld.factory);

  // ── 진행 상황 ──
  const counts = stageCounts(ld);
  const n = (k) => counts[k] || 0;
  const total = realColors(ld).length;
  const finished = n('confirm') + n('drop') + n('legacy');
  const redipNos = [...new Set(realColors(ld).filter(c => colorStage(c, ld) === 'reject').map(c => (c.rounds || []).length + 1))];
  const redipLabel = redipNos.length <= 1 ? `${redipNos[0] || 2}차 의뢰` : '다시 의뢰';

  // 울 종류 설명 한 줄
  const woolNote = (() => {
    if (!ld.woolManual) {
      if (autoWool.type && autoWool.type === ld.woolType) return { tone: 'auto', text: autoWool.reason };
      if (autoWool.type) return { tone: 'suggest', text: `자동으로는 '${woolTypeOf(autoWool.type)?.label}' — ${autoWool.reason}` };
      return { tone: 'muted', text: '원단을 고르거나 ITEM NAME을 넣으면 자동으로 골라요 (원사 이름에 SW → 슈퍼워시)' };
    }
    if (autoWool.type && autoWool.type !== ld.woolType) return { tone: 'suggest', text: `담당자가 바꿨어요 — 자동으로는 '${woolTypeOf(autoWool.type)?.label}' (${autoWool.reason})` };
    return { tone: 'muted', text: '담당자가 골랐어요' };
  })();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ── 머리 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-4 sm:px-5 py-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{ld.ldNo || (isSaved ? '번호 없음' : '새 L/D')}</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${ld.mode === 'direct' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-teal-700 bg-teal-50 border-teal-200'}`}>{ldModeOf(ld.mode).short}</span>
            {ld.legacy && <StageChip stage="legacy" />}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isSaved
              ? <>작성 {ld.authorName || '-'}{ld.buyerName ? ` · ${ld.buyerName}` : ''}</>
              : <>저장하면 붙는 L/D NO. <b className="font-mono">{ld.ldNo || nextNo}</b></>}
            {dirty && <span className="ml-2 font-bold text-amber-600">● 저장 안 한 변경 있음</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ld.mode === 'factory' && (
            <button type="button" onClick={onPrintFactory} disabled={busy} title="공장 진행중인 컬러로 의뢰서를 인쇄해요 (저장 안 한 변경은 먼저 저장)"
              className="bg-white border border-teal-300 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
              <Printer className="w-4 h-4" /> 공장 의뢰서
            </button>
          )}
          {isSaved && (
            <button type="button" onClick={onDuplicate} title="같은 바이어 · 원단 · 컬러로 새 의뢰"
              className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-sm font-bold">
              <Copy className="w-4 h-4" /> 복제
            </button>
          )}
          {isSaved && (
            <button type="button" onClick={onDelete}
              className="bg-white border border-slate-300 text-slate-500 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center gap-1.5 text-sm font-bold">
              <Trash2 className="w-4 h-4" /> 삭제
            </button>
          )}
          <button type="button" onClick={onSave} disabled={busy}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
            <Save className="w-4 h-4" /> 저장
          </button>
          <button type="button" onClick={onClose}
            className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-sm font-bold">
            <X className="w-4 h-4" /> 닫기
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ── 진행 상황 ── */}
        {isSaved ? (
          <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-extrabold text-teal-800">진행 상황</span>
              <span className="text-[11px] text-slate-500">컬러 {total}개 · 끝남 {finished}</span>
              {n('confirm') > 0 && <StageChip stage="confirm" label={`컨펌 ${n('confirm')}`} />}
              {n('drop') > 0 && <StageChip stage="drop" label={`Drop ${n('drop')}`} />}
              <div className="ml-auto flex gap-1.5">
                {isAllDropped(ld) && (
                  <button type="button" onClick={onRestoreDropped} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50">
                    <Undo2 className="w-3 h-3" /> Drop 모두 되돌리기
                  </button>
                )}
                {total - finished > 0 && !ld.legacyDone && (
                  <button type="button" onClick={onDropOpen} title="의뢰를 그만둘 때 — 아직 안 끝난 컬러를 모두 Drop (되돌릴 수 있어요)"
                    className="px-2 py-1 rounded-md text-[11px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50">
                    남은 컬러 모두 Drop
                  </button>
                )}
              </div>
            </div>
            {ld.legacyDone ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span>예전 'Lab-Dip 발송'에서 온 기록이라 <b>'완료'로 보관</b>하고 있어요. 아직 바이어 회신을 기다리는 L/D면 →</span>
                <button type="button" onClick={onReopenLegacy} className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600">컨펌대기로</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <StepBox stage="factory" count={n('factory')} label="공장 진행중" actionLabel="L/D 도착" icon={PackageCheck} onClick={onArrival} enabled={n('factory') > 0} />
                <StepBox stage="arrived" count={n('arrived')} label="L/D 도착 (발송 전)" actionLabel="바이어 발송" icon={Send} onClick={onSend} enabled={n('arrived') + n('waiting') > 0} />
                <StepBox stage="waiting" count={n('waiting')} label="컨펌대기" actionLabel="결과 넣기" icon={ClipboardCheck} onClick={onResult} enabled={n('waiting') > 0} />
                <StepBox stage="reject" count={n('reject')} label="리젝" actionLabel={redipLabel} icon={RotateCcw} onClick={onRedip} enabled={n('reject') > 0} />
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-500">진행 버튼은 누르면 바로 저장돼요 (그때 고쳐 둔 다른 칸도 같이). 잘못 눌렀으면 컬러 칸의 [되돌리기].</p>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/30 px-3 py-2.5 text-[11px] text-teal-800">
            {ld.mode === 'factory'
              ? <>① 아래를 채우고 <b>[저장]</b> → L/D NO.가 붙어요. ② <b>[공장 의뢰서]</b>로 인쇄해 공장에 보내요. ③ L/D가 오면 [L/D 도착] → [바이어 발송] → [결과 넣기].</>
              : <>EZ-TEX에서 공장에 의뢰한 L/D예요. 아래를 채우고 <b>[저장]</b>하면 L/D NO.가 붙어요. L/D가 오면 컬러마다 공장 번호를 넣고 [바이어 발송] → [결과 넣기].</>}
          </div>
        )}

        {/* ── 기본 정보 ── */}
        <section>
          <SectionTitle>기본 정보</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LdField label="L/D NO." hint={ld.legacy ? '예전 기록 — 넣으면 붙어요' : '비우면 저장할 때 자동'}>
              <input value={ld.ldNo || ''} onChange={e => patch({ ldNo: e.target.value.toUpperCase() })}
                placeholder={ld.legacy ? '번호 없음' : nextNo}
                className={`${ldInputCls} font-mono font-bold uppercase ${owner ? 'border-red-400 ring-1 ring-red-200' : ''}`} />
              {owner && <p className="text-[10px] text-red-600 font-bold mt-0.5">이미 있는 번호예요 ({owner.buyerName || '바이어 미입력'} · {owner.article || '-'})</p>}
            </LdField>
            <LdField label="의뢰 방식" className="md:col-span-2">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
                {LD_MODES.map(m => (
                  <button key={m.key} type="button" onClick={() => patch({ mode: m.key })} title={m.desc}
                    className={`flex-1 px-2 py-2 text-xs font-bold transition-colors ${ld.mode === m.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </LdField>
            {ld.mode === 'direct' ? (
              <LdField label="EZ-TEX 번호" hint="선택">
                <input value={ld.eztexNo || ''} onChange={e => patch({ eztexNo: e.target.value })} placeholder="EZ-TEX L/D 번호" className={`${ldInputCls} font-mono uppercase`} />
              </LdField>
            ) : <div className="hidden md:block" />}

            <LdField label="바이어 *" hint="공장 의뢰서엔 안 찍혀요" className="col-span-2">
              <PartnerSelectField value={ld.buyerName || ''} onSelect={p => patch({ buyerName: p.name || '' })}
                partners={partners} savePartner={savePartner} deletePartner={deletePartner} makeEmptyPartner={makeEmptyPartner}
                placeholder="거래처 선택 / 등록" />
            </LdField>
            <LdField label="공장" hint="바이어 시트엔 안 찍혀요" className="col-span-2">
              <div className="flex gap-1.5">
                <select value={ld.factory || ''} onChange={e => patch({ factory: e.target.value })} className={ldInputCls}>
                  <option value="">-- 공장 고르기 --</option>
                  {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button type="button" onClick={onOpenFactoryMaster} title="염가공처 목록에 공장 등록"
                  className="shrink-0 px-2.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">+ 등록</button>
              </div>
            </LdField>

            <LdField label="의뢰일" hint="번호 연도 기준">
              <input type="date" value={ld.requestDate || ''} onChange={e => patch({ requestDate: e.target.value })} className={ldInputCls} />
            </LdField>
            <LdField label="공장 납기" hint="1차 — L/D 오는 날">
              <input type="date" value={ld.factoryDue || ''} onChange={e => patch({ factoryDue: e.target.value })} className={ldInputCls} />
            </LdField>
            <LdField label="바이어 납기" hint="선택 — 보내기로 한 날">
              <input type="date" value={ld.buyerDue || ''} onChange={e => patch({ buyerDue: e.target.value })} className={ldInputCls} />
            </LdField>
          </div>
        </section>

        {/* ── 원단 ── */}
        <section>
          <SectionTitle>원단</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <LdField label="원단 관리에서 고르기" hint="고르면 ARTICLE · ITEM NAME · GSM · 폭이 채워져요 (없는 원단은 아래에 직접)" className="col-span-2 md:col-span-6">
              <SearchableSelect value={ld.fabricId || ''} options={fabricOptions} onChange={applyFabric} placeholder="Article · 원단명으로 검색" />
              {ld.fabricId && !linkedFabric && <p className="text-[10px] text-amber-600 mt-0.5">연결된 원단을 원단 관리에서 찾을 수 없어요 — 적어 둔 값은 그대로예요.</p>}
              {yarnHint && <p className="text-[10px] text-slate-400 mt-0.5">원사: {yarnHint}</p>}
            </LdField>
            <LdField label="ARTICLE" className="col-span-1 md:col-span-2">
              <input value={ld.article || ''} onChange={e => patch({ article: e.target.value })} placeholder="PW1050" className={`${ldInputCls} font-bold uppercase`} />
            </LdField>
            <LdField label="ITEM NAME (혼용률)" className="col-span-2 md:col-span-4">
              <input value={ld.itemName || ''} onChange={e => changeItemName(e.target.value)} placeholder="W/N=87/13 SINGLE STRIPE" className={ldInputCls} />
            </LdField>
            <LdField label="STYLE" hint="공장 의뢰서엔 안 찍혀요" className="col-span-1 md:col-span-2">
              <input value={ld.style || ''} onChange={e => patch({ style: e.target.value })} placeholder="선택 입력" className={`${ldInputCls} uppercase`} />
            </LdField>
            <LdField label="GSM">
              <input value={ld.gsm ?? ''} onChange={e => patch({ gsm: e.target.value })} inputMode="decimal" placeholder="145" className={ldInputCls} />
            </LdField>
            <LdField label="내폭 (인치)">
              <input value={ld.widthCut ?? ''} onChange={e => patch({ widthCut: e.target.value })} inputMode="decimal" placeholder="53" className={ldInputCls} />
            </LdField>
            <LdField label="외폭 (인치)">
              <input value={ld.widthFull ?? ''} onChange={e => patch({ widthFull: e.target.value })} inputMode="decimal" placeholder="55" className={ldInputCls} />
            </LdField>
            <div className="hidden md:block" />

            <LdField label="울 종류" className="col-span-2 md:col-span-6">
              <div className="flex flex-wrap items-center gap-1.5">
                {WOOL_TYPES.map(w => (
                  <button key={w.key} type="button" onClick={() => patch({ woolType: w.key, woolManual: true })} aria-pressed={ld.woolType === w.key}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${ld.woolType === w.key ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {w.label}
                  </button>
                ))}
                <span className={`flex items-center gap-1 text-[11px] ${woolNote.tone === 'auto' ? 'text-teal-700 font-bold' : woolNote.tone === 'suggest' ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                  {woolNote.tone === 'auto' && <Sparkles className="w-3 h-3" />}
                  {woolNote.text}
                </span>
                {woolNote.tone === 'suggest' && (
                  <button type="button" onClick={() => patch({ woolType: autoWool.type, woolManual: false })}
                    className="text-[11px] font-bold text-teal-700 hover:underline">자동 값으로</button>
                )}
              </div>
            </LdField>
            <LdField label="광원" hint="공장 의뢰서에 찍혀요 — 바이어가 색을 보는 조명" className="col-span-2 md:col-span-6">
              <div className="flex flex-wrap gap-1.5">
                {LIGHT_SOURCES.map(l => {
                  const on = (ld.lightSources || []).includes(l);
                  return (
                    <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${on ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleLight(l)} className="w-3.5 h-3.5 accent-teal-600" />
                      {l}
                    </label>
                  );
                })}
              </div>
            </LdField>
          </div>
        </section>

        {/* ── 컬러 ── */}
        <section>
          <SectionTitle right={(
            <button type="button" onClick={addColor} className="flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-teal-100">
              <Plus className="w-4 h-4" /> 컬러 추가
            </button>
          )}>
            <Palette className="w-4 h-4" /> 컬러 ({total})
          </SectionTitle>
          <div className="space-y-2.5">
            {(ld.colors || []).map((c, i) => (
              <LabdipColorCard key={c.id} c={c} index={i} ld={ld} isSaved={isSaved}
                onPatch={patchColor} onPatchRound={patchRound} onRemove={removeColor} onStepBack={onStepBack} onDrop={onDropColor} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">PANTONE을 적거나, 바이어에게 받은 스와치를 붙일 컬러는 '바이어 스와치'를 체크하세요 — 공장 의뢰서에 붙이는 칸이 생겨요. 공장 번호는 L/D가 오면 넣어요.</p>
        </section>

        {/* ── 메모 ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LdField label="특이사항" hint="공장 의뢰서에 찍혀요">
            <textarea value={ld.remarks || ''} onChange={e => patch({ remarks: e.target.value })} rows={2}
              placeholder="예: 기존 L/D와 같은 생지로 / 선염 원사 L/D" className={`${ldInputCls} resize-none leading-snug`} />
          </LdField>
          <LdField label="내부 메모" hint="어디에도 안 찍혀요">
            <textarea value={ld.memo || ''} onChange={e => patch({ memo: e.target.value })} rows={2}
              placeholder="예: 바이어 담당자 요청사항 / 재발송 건" className={`${ldInputCls} resize-none leading-snug`} />
          </LdField>
        </section>
      </div>
    </div>
  );
};
