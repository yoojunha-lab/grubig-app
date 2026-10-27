import React, { useEffect, useMemo, useState } from 'react';
import { SwatchBook, FilePlus, Search, Copy, Trash2, ChevronDown, Plus } from 'lucide-react';
import { UnsavedChangesDialog } from '../components/common/UnsavedChangesDialog';
import { LabdipForm } from '../components/labdip/LabdipForm';
import { ArrivalDialog, SendDialog, ResultDialog, RedipDialog } from '../components/labdip/LabdipDialogs';
import { StageChip, DueLine, NewLabdipMenu } from '../components/labdip/LabdipParts';
import { todayLocalISO, formatMonthDay } from '../utils/helpers';
import {
  normalizeLabdip, labdipTabKeys, labdipTiming, labdipSearchText, realColors, colorStage, currentRound, isFinishedStage,
  dueBadge, nextLdNo, buildBuyerSheet, buildFactorySheet, factoryPrintColorIds, isAllDropped,
  LD_TABS, LD_STAGES, LD_STAGE_ORDER, WAITING_WARN_DAYS,
} from '../utils/labdipModel';

// ============================================================
// GRUBIG ERP - 생산 ▾ LAB-DIP — 대표님 요청 2026-10-27 (예전 '영업 ▾ Lab-Dip 발송'을 옮겨 고도화)
//  - 목록: [진행중 · 컨펌대기중 · 완료] 탭 — 의뢰 한 건(L/D NO.) 한 줄, 컬러는 단계 색 칩
//          (한 의뢰에 단계가 섞이면 두 탭 모두에 나오고 그 탭 컬러만 진하게)
//  - [+ 새 L/D ▾]: 공장에 의뢰 / 바이어 발송만 (EZ-TEX 의뢰)
//  - 작성 화면(LabdipForm) + 진행 창 4개(LabdipDialogs) — 진행 버튼은 바로 저장
//  - 인쇄: 공장 의뢰서(바이어 안 찍힘) / 바이어 시트(공장 안 찍힘) — App.handlePrintLabdip
//  - 저장 안 한 변경이 있으면 다른 L/D · 목록 · 다른 메뉴로 갈 때 '저장할까요?' (navGuardRef)
// ============================================================

/** 탭마다 줄 순서 — 진행중: 납기 급한 순 / 컨펌대기중: 오래 기다린 순 / 완료: 최근에 끝난 순 */
const sortForTab = (list, tab) => {
  const byNoDesc = (a, b) => String(b.ld.ldNo || '').localeCompare(String(a.ld.ldNo || '')) || String(b.ld.updatedAt || '').localeCompare(String(a.ld.updatedAt || ''));
  if (tab === 'active') {
    const urgent = (it) => [it.timing.factoryDue, it.timing.buyerDue].filter(Boolean).sort()[0] || '9999-99-99';
    return [...list].sort((a, b) => urgent(a).localeCompare(urgent(b)) || byNoDesc(a, b));
  }
  if (tab === 'waiting') {
    return [...list].sort((a, b) => String(a.timing.waitingSince || '9999').localeCompare(String(b.timing.waitingSince || '9999')) || byNoDesc(a, b));
  }
  return [...list].sort((a, b) => String(b.timing.doneDate || '').localeCompare(String(a.timing.doneDate || '')) || byNoDesc(a, b));
};

/** 목록의 컬러 칩들 — 컬러명 + 단계 색 (지금 탭 단계가 아닌 컬러는 흐리게) */
const ColorChips = ({ ld, tab, max = 99 }) => {
  const cs = realColors(ld);
  return (
    <div className="flex flex-wrap gap-1">
      {cs.slice(0, max).map(c => {
        const s = colorStage(c, ld);
        const r = currentRound(c);
        const extra = s === 'confirm' && r.confirmedLetter ? ` "${r.confirmedLetter}"` : (!isFinishedStage(s) && r.no > 1 ? ` ${r.no}차` : '');
        return (
          <StageChip key={c.id} stage={s} label={`${c.name || c.pantone || '컬러'}${extra}`}
            title={`${LD_STAGES[s].label}${r.factoryNo ? ` · ${r.factoryNo}` : ''}`}
            dim={tab !== 'done' && LD_STAGES[s].tab !== tab} className={`uppercase ${s === 'drop' ? 'line-through' : ''}`} />
        );
      })}
      {cs.length > max && <span className="text-[10px] text-slate-400 font-bold">+{cs.length - max}</span>}
    </div>
  );
};

/** 탭마다 납기 · 경과 칸 */
const TimingCell = ({ it, tab, today }) => {
  const t = it.timing;
  if (tab === 'active') {
    if (!t.factoryDue && !t.buyerDue) return <span className="text-slate-300">—</span>;
    return (
      <div className="space-y-0.5">
        <DueLine label="공장" date={t.factoryDue} badge={dueBadge(t.factoryDue, today)} />
        <DueLine label="바이어" date={t.buyerDue} badge={dueBadge(t.buyerDue, today)} />
      </div>
    );
  }
  if (tab === 'waiting') {
    if (!t.waitingSince) return <span className="text-slate-300">—</span>;
    const late = (t.waitingDays ?? 0) >= WAITING_WARN_DAYS;
    return (
      <div className="text-[11px] whitespace-nowrap">
        <span className={late ? 'text-amber-600 font-extrabold' : 'text-slate-600 font-bold'}>보낸 지 {t.waitingDays}일</span>
        <span className="text-slate-400 ml-1">{formatMonthDay(t.waitingSince)}</span>
      </div>
    );
  }
  if (it.ld.legacyDone) return <span className="text-[11px] text-slate-400 font-bold">예전 기록</span>;
  if (isAllDropped(it.ld)) return <span className="text-[11px] text-slate-400 font-bold">Drop {formatMonthDay(t.doneDate)}</span>;
  return t.doneDate ? <span className="text-[11px] text-slate-500 font-bold">완료 {formatMonthDay(t.doneDate)}</span> : <span className="text-slate-300">—</span>;
};

const NoCell = ({ ld }) => (
  <div>
    <div className={`font-mono font-extrabold ${ld.ldNo ? 'text-slate-800' : 'text-slate-300 text-xs'}`}>{ld.ldNo || '번호 없음'}</div>
    <div className="flex flex-wrap gap-1 mt-0.5">
      {ld.mode === 'direct' && !ld.legacy && <span className="text-[9px] font-extrabold px-1 py-px rounded border text-indigo-700 bg-indigo-50 border-indigo-200">EZ-TEX{ld.eztexNo ? ` ${ld.eztexNo}` : ''}</span>}
      {ld.legacy && <span className="text-[9px] font-extrabold px-1 py-px rounded border text-slate-500 bg-slate-50 border-slate-200">예전 기록</span>}
    </div>
  </div>
);

export const LabdipPage = ({
  labdips = [], savedFabrics = [], yarnLibrary = [], dyeingFactories = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner,
  onOpenFactoryMaster, onPrint, navGuardRef, user,
  labdipInput, setLabdipInput, editingLabdipId, labdipDirty,
  newLabdip, openLabdip, duplicateLabdip, discardLabdip, saveLabdip, deleteLabdip,
  recordArrival, recordSend, recordResults, requestRedip,
  dropColor, dropOpenColors, restoreDropped, reopenLegacy, stepBackColor,
}) => {
  const [view, setView] = useState('list');      // 'list' | 'form'
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(null);  // '저장할까요?' 뒤에 할 일
  const [dialog, setDialog] = useState(null);    // 'arrival' | 'send' | 'result' | 'redip'
  const [busy, setBusy] = useState(false);
  const today = todayLocalISO();
  const userName = user?.displayName || user?.email?.split('@')[0] || '';

  // ── 저장 안 한 변경 확인 (다른 L/D · 새 L/D · 목록 · 다른 메뉴) ──
  const formDirty = view === 'form' && labdipDirty;
  const guard = (action) => { if (formDirty) setPending(() => action); else action(); };
  useEffect(() => {
    if (!navGuardRef) return undefined;
    navGuardRef.current = (proceed) => { if (formDirty) setPending(() => proceed); else proceed(); };
    return () => { navGuardRef.current = null; };
  });
  const keepEditing = () => setPending(null);
  const leaveWithoutSave = () => { const act = pending; setPending(null); discardLabdip(); if (act) act(); };
  const saveAndLeave = async () => {
    const saved = await saveLabdip();
    if (!saved) return; // 저장 못 하면 그대로 (입력값 보존)
    const act = pending;
    setPending(null);
    if (act) act();
  };

  // ── 목록 ──
  const items = useMemo(() => (labdips || []).map(raw => {
    const ld = normalizeLabdip(raw);
    return { id: raw.id, ld, tabs: labdipTabKeys(ld), timing: labdipTiming(ld, today), text: labdipSearchText(ld) };
  }), [labdips, today]);
  const term = search.trim().toUpperCase();
  const matched = useMemo(() => items.filter(it => !term || it.text.includes(term)), [items, term]);
  const tabCounts = useMemo(() => Object.fromEntries(LD_TABS.map(t => [t.key, matched.filter(it => it.tabs.includes(t.key)).length])), [matched]);
  const tabItems = useMemo(() => sortForTab(matched.filter(it => it.tabs.includes(tab)), tab), [matched, tab]);
  const nextNo = nextLdNo(labdips, labdipInput.requestDate);

  // ── 화면 전환 ──
  const openNew = (mode) => guard(() => { newLabdip(mode); setView('form'); });
  const openEdit = (id) => {
    if (view === 'form' && String(id) === String(editingLabdipId)) return;
    guard(() => { if (openLabdip(id)) setView('form'); });
  };
  const backToList = () => guard(() => setView('list'));
  const duplicate = (id) => guard(() => { if (duplicateLabdip(id)) setView('form'); });
  const remove = async (id) => {
    const ok = await deleteLabdip(id);
    if (ok && view === 'form' && String(id) === String(editingLabdipId)) setView('list');
  };

  const handleSave = async () => {
    setBusy(true);
    try { await saveLabdip(); } finally { setBusy(false); }
  };

  // ── 인쇄 ──
  // 공장 의뢰서 — 저장 안 한 변경이 있거나 새 L/D면 먼저 저장 (의뢰서에 찍히는 L/D NO.가 저장소에 있게)
  const printFactory = async (colorIds = null, savedDoc = null) => {
    let doc = savedDoc ? normalizeLabdip(savedDoc) : labdipInput;
    if (!savedDoc && (!editingLabdipId || labdipDirty)) {
      setBusy(true);
      try {
        const saved = await saveLabdip();
        if (!saved) return;
        doc = normalizeLabdip(saved);
      } finally { setBusy(false); }
    }
    onPrint(buildFactorySheet(doc, colorIds || factoryPrintColorIds(doc), { author: doc.authorName || userName }));
  };
  const printBuyer = (colorIds, date) => onPrint(buildBuyerSheet(labdipInput, colorIds, date));

  // ── 컬러 칸 진행 버튼 (확인 후 바로 저장) ──
  const askStepBack = (c, text) => {
    if (!window.confirm(`'${c.name || '컬러'}' — ${text}.\n바로 저장돼요. 되돌릴까요?`)) return;
    stepBackColor(c.id);
  };
  const askDropColor = (c) => {
    if (!window.confirm(`'${c.name || '컬러'}' — 이 컬러를 Drop할까요? (바이어가 이 컬러를 안 하기로)\n바로 저장돼요 — 나중에 [되돌리기]로 풀 수 있어요.`)) return;
    dropColor(c.id);
  };
  const askDropOpen = () => {
    const open = realColors(labdipInput).filter(c => !isFinishedStage(colorStage(c, labdipInput))).length;
    if (!window.confirm(`아직 안 끝난 컬러 ${open}개를 모두 Drop할까요? (의뢰를 그만둘 때)\n바로 저장돼요 — [Drop 모두 되돌리기]로 풀 수 있어요.`)) return;
    dropOpenColors();
  };

  // ════════════════════════════════════════════════════════
  const header = (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <SwatchBook className="w-6 h-6 text-teal-600" /> LAB-DIP
          <span className="text-base font-bold text-slate-400">({items.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="L/D NO.·바이어·아티클·컬러·공장 검색"
              className="border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm w-64 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <NewLabdipMenu onPick={openNew}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-1.5 text-sm font-bold shadow-lg shadow-teal-200">
            <FilePlus className="w-4 h-4" /> 새 L/D <ChevronDown className="w-4 h-4" />
          </NewLabdipMenu>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 gap-1">
          {LD_TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors ${tab === t.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t.label}
              <span className={`text-[11px] font-extrabold px-1.5 rounded-full ${tab === t.key ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{tabCounts[t.key] || 0}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">{LD_TABS.find(t => t.key === tab)?.hint}</span>
        <div className="ml-auto hidden md:flex flex-wrap items-center gap-1">
          {LD_STAGE_ORDER.filter(s => s !== 'legacy').map(s => <StageChip key={s} stage={s} />)}
        </div>
      </div>
    </div>
  );

  const emptyAll = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 py-20 text-center">
      <SwatchBook className="w-12 h-12 text-slate-200 mx-auto mb-3" />
      <p className="text-slate-400 text-sm mb-4">아직 L/D가 없어요.</p>
      <NewLabdipMenu onPick={openNew}
        className="inline-flex items-center gap-1.5 bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 text-sm font-bold shadow-lg shadow-teal-200">
        <FilePlus className="w-4 h-4" /> 첫 L/D 만들기 <ChevronDown className="w-4 h-4" />
      </NewLabdipMenu>
    </div>
  );

  const fullList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {tabItems.length === 0 ? (
        <div className="py-14 text-center text-slate-400 text-sm">{term ? '찾는 L/D가 이 탭에 없어요.' : `${LD_TABS.find(t => t.key === tab)?.label} L/D가 없어요.`}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold">L/D NO.</th>
                <th className="py-2.5 px-3 font-bold">바이어</th>
                <th className="py-2.5 px-3 font-bold">ARTICLE · ITEM NAME</th>
                <th className="py-2.5 px-3 font-bold">공장</th>
                <th className="py-2.5 px-3 font-bold">컬러</th>
                <th className="py-2.5 px-3 font-bold">{tab === 'active' ? '납기' : tab === 'waiting' ? '회신 기다림' : '끝난 날'}</th>
                <th className="py-2.5 px-3 font-bold">의뢰일</th>
                <th className="py-2.5 px-3 font-bold">작성</th>
                <th className="py-2.5 px-3 font-bold text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tabItems.map(it => (
                <tr key={it.id} onClick={() => openEdit(it.id)} className="hover:bg-teal-50/40 cursor-pointer align-top">
                  <td className="py-2.5 px-3 whitespace-nowrap"><NoCell ld={it.ld} /></td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 uppercase">{it.ld.buyerName || <span className="text-slate-300">—</span>}</td>
                  <td className="py-2.5 px-3 max-w-[240px]">
                    <div className="font-bold text-slate-700 uppercase">{it.ld.article || '-'}</div>
                    {it.ld.itemName && <div className="text-[11px] text-slate-400 truncate" title={it.ld.itemName}>{it.ld.itemName}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{it.ld.factory || <span className="text-slate-300">—</span>}</td>
                  <td className="py-2.5 px-3 max-w-[320px]"><ColorChips ld={it.ld} tab={tab} /></td>
                  <td className="py-2.5 px-3"><TimingCell it={it} tab={tab} today={today} /></td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatMonthDay(it.ld.requestDate) || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{it.ld.authorName || '-'}</td>
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => duplicate(it.id)} title="복제 — 같은 바이어 · 원단 · 컬러로 새 의뢰" className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"><Copy className="w-4 h-4" /></button>
                      <button type="button" onClick={() => remove(it.id)} title="삭제" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const compactList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-180px)]">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <span className="text-xs font-extrabold text-slate-500">{LD_TABS.find(t => t.key === tab)?.label} ({tabItems.length})</span>
        <NewLabdipMenu onPick={openNew} className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5">
          <Plus className="w-3.5 h-3.5" /> 새 L/D
        </NewLabdipMenu>
      </div>
      <div className="overflow-y-auto flex-1 max-h-64 lg:max-h-none">
        {tabItems.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">이 탭에 L/D가 없어요.</div>
        ) : tabItems.map(it => {
          const active = String(editingLabdipId) === String(it.id);
          return (
            <button key={it.id} type="button" onClick={() => openEdit(it.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-100 transition-colors ${active ? 'bg-teal-50 border-l-[3px] border-l-teal-500' : 'border-l-[3px] border-l-transparent hover:bg-teal-50/50'}`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[12px] font-mono font-extrabold ${it.ld.ldNo ? 'text-slate-800' : 'text-slate-300'}`}>{it.ld.ldNo || '번호 없음'}</span>
                <span className="text-[10px] text-slate-400 truncate">{it.ld.factory || ''}</span>
              </div>
              <div className="text-[12px] font-bold text-slate-700 truncate uppercase">{it.ld.buyerName || '(바이어 미입력)'} · {it.ld.article || '-'}</div>
              <div className="mt-1"><ColorChips ld={it.ld} tab={tab} max={6} /></div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const isSaved = !!editingLabdipId;

  return (
    <>
      <div className="max-w-[1600px] mx-auto w-full print:hidden">
        {header}
        {view === 'list' ? (
          items.length === 0 ? emptyAll : fullList
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <aside className="w-full lg:w-72 shrink-0">{compactList}</aside>
            <div className="flex-1 min-w-0 w-full max-w-6xl">
              <LabdipForm
                ld={labdipInput} setLd={setLabdipInput} isSaved={isSaved} dirty={labdipDirty} busy={busy}
                nextNo={nextNo} labdips={labdips} editingId={editingLabdipId}
                savedFabrics={savedFabrics} yarnLibrary={yarnLibrary} dyeingFactories={dyeingFactories}
                partners={partners} savePartner={savePartner} deletePartner={deletePartner} makeEmptyPartner={makeEmptyPartner}
                onOpenFactoryMaster={onOpenFactoryMaster}
                onSave={handleSave} onClose={backToList} onPrintFactory={() => printFactory()}
                onDuplicate={() => duplicate(editingLabdipId)} onDelete={() => remove(editingLabdipId)}
                onArrival={() => setDialog('arrival')} onSend={() => setDialog('send')}
                onResult={() => setDialog('result')} onRedip={() => setDialog('redip')}
                onStepBack={askStepBack} onDropColor={askDropColor} onDropOpen={askDropOpen}
                onRestoreDropped={restoreDropped} onReopenLegacy={reopenLegacy}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 진행 창 (화면 칸 밖 — 팝업 규약) ── */}
      {dialog === 'arrival' && <ArrivalDialog ld={labdipInput} onClose={() => setDialog(null)} onSave={recordArrival} />}
      {dialog === 'send' && <SendDialog ld={labdipInput} onClose={() => setDialog(null)} onSave={recordSend} onPrint={printBuyer} />}
      {dialog === 'result' && <ResultDialog ld={labdipInput} onClose={() => setDialog(null)} onSave={recordResults} />}
      {dialog === 'redip' && (
        <RedipDialog ld={labdipInput} onClose={() => setDialog(null)} canPrint={labdipInput.mode === 'factory'}
          onSave={async (entries, meta, { print }) => {
            const saved = await requestRedip(entries, meta);
            if (saved && print) printFactory(entries.map(e => e.colorId), saved);
            return saved;
          }} />
      )}

      <UnsavedChangesDialog
        open={!!pending}
        message="저장하지 않은 L/D 변경이 있어요. 저장할까요?"
        onSave={saveAndLeave}
        onDiscard={leaveWithoutSave}
        onKeepEditing={keepEditing}
      />
    </>
  );
};
