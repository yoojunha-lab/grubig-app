import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, FileJson, Loader2, AlertTriangle, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { readSeedFile, factoryTotals, sameFactoryName, missingTypes, fmtNum } from '../../utils/knitFactoryModel';
import { KnitBlocks, BlockSummary } from './KnitParts';

// ============================================================
// 편직처 정리본 가져오기 (편직처 기계 현황 — 대표님 결정 2026-11-23 '엑셀은 여기서 판단해서 넣게')
//  · 예전 '편직처..xls'를 그루빅(Claude)이 한 줄씩 보고 정리한 파일(.json)을 올림 → 미리보기 → 저장
//  · 편직처마다 '확인할 것'(애매해서 판단한 내용) 목록 — 노란 칸
//  · ☑ 지금 있는 편직처 모두 지우고 가져오기 (예전 샘플 19곳 정리 — 대표님 '다 삭제')
//  · ☑ 설계서 편직처 목록에서 안 쓰는 이름 빼기 — 정리본에도 없고 설계서 · 생산 오더에도 안 쓰인 이름만
//  · 정리본에 쓰인 종류가 [기계 종류] 설정에 없으면 같이 더함
//  · 읽은 뒤 가져오지 않고 닫으면 '저장할까요?' (저장 = 가져오기)
// ============================================================

export const KnitImportModal = ({
  knitFactories = [],
  knittingFactories = [],   // 설계서 편직처 목록 (settings)
  designSheets = [],
  orders = [],
  config,
  onImport,                 // (factories, opts) => 저장했으면 true
  onClose,
}) => {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [seed, setSeed] = useState(null);       // { factories, config, notes }
  const [picked, setPicked] = useState(() => new Set());
  const [openIds, setOpenIds] = useState(() => new Set());
  const [replaceAll, setReplaceAll] = useState(knitFactories.length > 0);
  const [cleanNames, setCleanNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const busyRef = useRef(false);

  const readFile = async (file) => {
    if (!file) return;
    if (!/\.json$/i.test(file.name)) { setError('편직처 정리본(.json) 파일을 올려 주세요.'); return; }
    setReading(true);
    setError('');
    try {
      const parsed = readSeedFile(JSON.parse(await file.text()));
      if (parsed.error) { setError(parsed.error); setSeed(null); return; }
      setFileName(file.name);
      setSeed(parsed);
      setPicked(new Set(parsed.factories.map(f => f.name)));
      setOpenIds(new Set(parsed.factories.filter(f => f.review?.length).map(f => f.name)));
    } catch (e) {
      setError(`파일을 읽지 못했어요: ${e?.message || e}`);
    } finally {
      setReading(false);
    }
  };

  const list = seed?.factories || [];
  const chosen = list.filter(f => picked.has(f.name));
  const addTypes = useMemo(() => (seed ? missingTypes(config, seed.config, chosen) : []), [seed, config, chosen]);
  // 설계서 편직처 목록에서 뺄 이름 — 정리본에도 없고 설계서 · 생산 오더에도 안 쓰인 것
  const removableNames = useMemo(() => (knittingFactories || []).filter(n => !chosen.some(f => sameFactoryName(f.name, n))
    && !(designSheets || []).some(s => sameFactoryName(s?.knitting?.factory, n))
    && !(orders || []).some(o => sameFactoryName(o?.steps?.knitting?.vendor, n))), [knittingFactories, chosen, designSheets, orders]);
  const reviewCount = chosen.reduce((s, f) => s + (f.review?.length || 0), 0);

  const toggle = (set, setter, key) => setter(() => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const doImport = async () => {
    if (busyRef.current || !chosen.length) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      return await onImport(chosen, { replaceAll, cleanNames, addTypes, config });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const handleImport = async () => {
    const lines = [
      `편직처 ${chosen.length}곳을 가져와요.`,
      replaceAll && knitFactories.length ? `· 지금 있는 편직처 ${knitFactories.length}곳(메모 포함)을 먼저 지워요 — 되돌릴 수 없어요.` : '',
      !replaceAll && chosen.some(f => knitFactories.some(k => sameFactoryName(k.name, f.name))) ? '· 이름이 같은 편직처는 정리본 값으로 덮어써요 (메모는 남겨요).' : '',
      cleanNames && removableNames.length ? `· 설계서 편직처 목록에서 안 쓰는 이름 ${removableNames.length}개를 빼요.` : '',
      addTypes.length ? `· 기계 종류 목록에 ${addTypes.map(t => t.name).join(', ')}을(를) 더해요.` : '',
    ].filter(Boolean);
    if (!window.confirm(`${lines.join('\n')}\n\n계속할까요?`)) return;
    if (await doImport()) onClose();
  };
  const requestClose = () => { if (seed && !busy) setPending(() => onClose); else onClose(); };

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileJson className="w-5 h-5 text-emerald-600" /> 편직처 정리본 가져오기</h3>
              <p className="text-[11px] text-slate-500">예전 편직처 엑셀을 한 줄씩 보고 정리한 파일(.json)을 올려요. 노란 칸은 애매해서 판단한 내용이에요 — 가져온 뒤 [수정]에서 고칠 수 있어요.</p>
            </div>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600 shrink-0" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
              <div className="text-sm text-slate-600 flex items-center gap-2">
                {reading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : <Upload className="w-5 h-5 text-slate-400" />}
                {fileName ? <span><b>{fileName}</b> — 편직처 {list.length}곳</span> : '정리본 파일을 여기에 끌어 놓거나 [파일 고르기]'}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
                className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-sm font-bold disabled:opacity-50">
                {fileName ? '다른 파일' : '파일 고르기'}
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {error && <p className="text-sm text-red-600 font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>}

            {seed && (
              <>
                {seed.notes?.length > 0 && (
                  <ul className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-0.5">
                    {seed.notes.map((n, i) => <li key={i}>· {n}</li>)}
                  </ul>
                )}
                <div className="bg-violet-50/50 border border-violet-100 rounded-xl px-3 py-2 space-y-1.5 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} disabled={!knitFactories.length} className="w-4 h-4 accent-red-600 mt-px" />
                    <span><b>지금 있는 편직처 {knitFactories.length}곳을 모두 지우고 가져오기</b>
                      <span className="block text-slate-500">{knitFactories.length ? '예전에 올린 샘플을 정리할 때 — 메모까지 지워지고 되돌릴 수 없어요.' : '지금 등록된 편직처가 없어요.'}</span></span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={cleanNames} onChange={e => setCleanNames(e.target.checked)} className="w-4 h-4 accent-violet-600 mt-px" />
                    <span><b>설계서 편직처 목록에서 안 쓰는 이름 빼기</b>
                      <span className="block text-slate-500">{removableNames.length ? `뺄 이름 ${removableNames.length}개: ${removableNames.join(', ')}` : '뺄 이름이 없어요 (정리본에 있거나 설계서 · 생산 오더에 쓰인 이름은 남겨요).'}</span></span>
                  </label>
                  {addTypes.length > 0 && <p className="text-slate-600">기계 종류 목록에 더할 종류: <b>{addTypes.map(t => `${t.name}(${t.family})`).join(', ')}</b></p>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <label className="inline-flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={chosen.length === list.length} onChange={() => setPicked(chosen.length === list.length ? new Set() : new Set(list.map(f => f.name)))} className="w-4 h-4 accent-violet-600" />
                    모두 고르기
                  </label>
                  <span className="text-slate-500">{chosen.length}곳 고름</span>
                  {reviewCount > 0 && <span className="text-amber-700 font-bold">확인할 것 {reviewCount}개 — 노란 칸을 읽어 봐 주세요</span>}
                </div>
                <ul className="space-y-1.5">
                  {list.map(f => {
                    const t = factoryTotals(f, config);
                    const open = openIds.has(f.name);
                    return (
                      <li key={f.name} className={`border rounded-xl ${picked.has(f.name) ? 'border-violet-300 bg-violet-50/20' : 'border-slate-200 bg-white opacity-60'}`}>
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <input type="checkbox" checked={picked.has(f.name)} onChange={() => toggle(picked, setPicked, f.name)} className="w-4 h-4 accent-violet-600" />
                          <button type="button" onClick={() => toggle(openIds, setOpenIds, f.name)} className="inline-flex items-center gap-1 font-extrabold text-slate-800 text-sm">
                            {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />} {f.name}
                          </button>
                          {f.region && <span className="text-[10px] font-bold px-1 rounded bg-slate-100 text-slate-500">{f.region}</span>}
                          <span className="text-[11px] text-slate-500">기계 {t.total ? `${fmtNum(t.total)}대` : '대수 미기재'} · {t.lines}줄 · 가마 {t.cylinders ? `${fmtNum(t.cylinders)}개` : `${t.cylinderLines}줄`}</span>
                          {f.review?.length > 0 && <span className="text-[10px] font-bold text-amber-700 inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> 확인할 것 {f.review.length}</span>}
                          {knitFactories.some(k => sameFactoryName(k.name, f.name)) && !replaceAll && <span className="text-[10px] font-extrabold px-1.5 py-px rounded bg-amber-100 text-amber-800 border border-amber-200">이미 있음 — 덮어씀</span>}
                        </div>
                        {!open && <div className="px-3 pb-2"><BlockSummary blocks={t.blocks} config={config} /></div>}
                        {open && (
                          <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
                            {f.review?.length > 0 && (
                              <ul className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 space-y-0.5">
                                {f.review.map((w, i) => <li key={i}>⚠ {w}</li>)}
                              </ul>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
                              <p><b>전화</b> {f.phone || '—'} · <b>팩스</b> {f.fax || '—'}</p>
                              <p><b>담당</b> {f.contacts.filter(c => c.name || c.mobile).map(c => `${c.name} ${c.mobile}`.trim()).join(' / ') || '—'}</p>
                              <p><b>주소</b> {f.addresses.filter(Boolean).join(' / ') || '—'}</p>
                              {f.knitFee && <p className="md:col-span-3 whitespace-pre-wrap"><b>편직료</b> {f.knitFee}</p>}
                              {f.memos?.map(m => <p key={m.id || m.text} className="md:col-span-3 whitespace-pre-wrap"><b>메모</b> {m.text}</p>)}
                            </div>
                            <KnitBlocks factory={f} config={config} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
            <p className="text-[11px] text-slate-500">가져온 편직처 이름은 설계서 편직처 목록에도 들어가요. 카카오맵 키가 있으면 지도 위치도 같이 찾아요.</p>
            <div className="flex gap-2">
              <button type="button" onClick={requestClose} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">닫기</button>
              <button type="button" onClick={handleImport} disabled={!chosen.length || busy}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {chosen.length ? `${chosen.length}곳 가져오기` : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={!!pending}
        message="읽은 정리본을 아직 가져오지 않았어요. 가져올까요?"
        onSave={async () => { setPending(null); await handleImport(); }}
        onDiscard={() => { const act = pending; setPending(null); if (act) act(); }}
        onKeepEditing={() => setPending(null)}
      />
    </>
  );
};
