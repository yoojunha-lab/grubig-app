import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, AlertTriangle, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { parseKnitFactorySheet, factoryTotals, sameFactoryName, KNIT_CATEGORIES, fmtNum } from '../../utils/knitFactoryModel';
import { KnitMachineTable, CategoryChip } from './KnitParts';

// ============================================================
// 편직처 엑셀 가져오기 (편직처 기계 현황 — 대표님 요청 2026-11-23)
//  · 지금까지 쓰던 '편직처..xls' 양식을 읽어서 미리보기 → 고른 편직처만 저장
//  · 읽는 규칙은 utils/knitFactoryModel.parseKnitFactorySheet (기종 → 게이지·제조사·메모, '"' 채우기, 가마수 칸 침수 옮기기 …)
//  · 같은 이름 편직처가 이미 있으면 '이미 있음' — 처음엔 안 고름. 고르면 덮어쓰기 (메모는 남기고 엑셀 비고를 덧붙임)
//  · 설계서 편직처 목록에 비슷한 이름이 있으면(미건 ↔ 미건섬유) 알려 주고 그 이름으로 바꿀 수 있음
//  · 읽은 뒤 가져오지 않고 닫으면 '저장할까요?' (저장 = 가져오기)
// ============================================================

const compact = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
// 설계서 편직처 목록에서 비슷한 이름 (한쪽이 다른 쪽을 품음, 같은 이름은 뺌)
const similarNames = (name, list) => {
  const n = compact(name);
  if (n.length < 2) return [];
  return (list || []).filter(x => {
    const c = compact(x);
    return c && c !== n && (c.includes(n) || n.includes(c)) && Math.min(c.length, n.length) >= 2;
  });
};

export const KnitImportModal = ({
  isXlsxReady,
  knitFactories = [],
  knittingFactories = [],   // 설계서 편직처 목록 (settings)
  onImport,                 // (items: [{ factory, replaceId }]) => 저장했으면 true
  onClose,
}) => {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState(null);   // [{ key, factory, picked, open }]
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const busyRef = useRef(false);

  const existingOf = (name) => knitFactories.find(f => sameFactoryName(f.name, name)) || null;

  const readFile = async (file) => {
    if (!file) return;
    if (!isXlsxReady || !window.XLSX) { setError('엑셀 기능을 불러오는 중이에요. 잠시 뒤 다시 해 주세요.'); return; }
    if (!/\.(xls|xlsx|xlsm)$/i.test(file.name)) { setError('엑셀 파일(.xls · .xlsx)을 올려 주세요.'); return; }
    setReading(true);
    setError('');
    try {
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetName = wb.SheetNames.find(n => {
        const ref = wb.Sheets[n]?.['!ref'];
        return ref && ref !== 'A1';
      }) || wb.SheetNames[0];
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const { factories, error: err } = parseKnitFactorySheet(rows);
      if (err) { setError(err); setItems(null); return; }
      setFileName(file.name);
      setItems(factories.map((factory, i) => ({ key: `${i}_${factory.name}`, factory, picked: !existingOf(factory.name), open: false })));
    } catch (e) {
      console.error('편직처 엑셀 읽기 실패', e);
      setError(`엑셀을 읽지 못했어요: ${e?.message || e}`);
    } finally {
      setReading(false);
    }
  };

  const update = (key, fields) => setItems(prev => prev.map(x => (x.key === key ? { ...x, ...fields } : x)));
  const rename = (key, name) => setItems(prev => prev.map(x => {
    if (x.key !== key) return x;
    return { ...x, factory: { ...x.factory, name }, picked: x.picked || !existingOf(name) };
  }));
  const picked = (items || []).filter(x => x.picked);
  const allPicked = items && items.length > 0 && picked.length === items.length;
  const summary = useMemo(() => {
    const list = items || [];
    return {
      total: list.length,
      existing: list.filter(x => existingOf(x.factory.name)).length,
      warn: list.filter(x => x.factory.warnings?.length).length,
      lines: list.reduce((s, x) => s + x.factory.machines.length, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, knitFactories]);

  const doImport = async () => {
    if (busyRef.current || !picked.length) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      return await onImport(picked.map(x => ({ factory: x.factory, replaceId: existingOf(x.factory.name)?.id || null })));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const handleImport = async () => {
    const existingPicked = picked.filter(x => existingOf(x.factory.name));
    if (existingPicked.length && !window.confirm(
      `이미 있는 편직처 ${existingPicked.length}곳(${existingPicked.slice(0, 4).map(x => x.factory.name).join(', ')}${existingPicked.length > 4 ? ' …' : ''})을 엑셀 값으로 덮어써요.\n`
      + '연락처 · 주소 · 편직료 · 기계 줄이 엑셀 값으로 바뀌고, 메모는 남겨요.\n\n계속할까요?',
    )) return;
    if (await doImport()) onClose();
  };
  const requestClose = () => { if (items && items.length && !busy) setPending(() => onClose); else onClose(); };

  return (
    <>
      <ModalBackdrop className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClose={requestClose}>
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /> 편직처 엑셀 가져오기</h3>
              <p className="text-[11px] text-slate-500">지금까지 쓰던 편직처 엑셀(편직처..xls)을 올리면 읽어서 보여 줘요. 확인하고 고른 편직처만 저장해요.</p>
            </div>
            <button type="button" onClick={requestClose} className="text-slate-400 hover:text-slate-600 shrink-0" title="닫기"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {/* 파일 올리기 */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
              <div className="text-sm text-slate-600 flex items-center gap-2">
                {reading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : <Upload className="w-5 h-5 text-slate-400" />}
                {fileName ? <span><b>{fileName}</b> — 편직처 {summary.total}곳 · 기계 {summary.lines}줄을 읽었어요</span> : '엑셀 파일을 여기에 끌어 놓거나 [파일 고르기]'}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
                className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-sm font-bold disabled:opacity-50">
                {fileName ? '다른 파일' : '파일 고르기'}
              </button>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.xlsm" className="hidden"
                onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {error && <p className="text-sm text-red-600 font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>}

            {items && (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <label className="inline-flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={!!allPicked} onChange={() => setItems(prev => prev.map(x => ({ ...x, picked: !allPicked })))} className="w-4 h-4 accent-violet-600" />
                    모두 고르기
                  </label>
                  <span className="text-slate-500">{picked.length}곳 고름</span>
                  {summary.existing > 0 && <span className="text-amber-700 font-bold">이미 있는 편직처 {summary.existing}곳은 처음엔 안 골랐어요 (고르면 덮어써요)</span>}
                  {summary.warn > 0 && <span className="text-slate-500">⚠ 확인할 내용이 있는 곳 {summary.warn}곳 — 펼쳐서 봐 주세요</span>}
                </div>
                <ul className="space-y-1.5">
                  {items.map(x => {
                    const f = x.factory;
                    const t = factoryTotals(f);
                    const existing = existingOf(f.name);
                    const similar = existing ? [] : similarNames(f.name, knittingFactories).filter(n => !knitFactories.some(k => sameFactoryName(k.name, n)));
                    const inList = knittingFactories.some(n => sameFactoryName(n, f.name));
                    return (
                      <li key={x.key} className={`border rounded-xl ${x.picked ? 'border-violet-300 bg-violet-50/30' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <input type="checkbox" checked={x.picked} onChange={() => update(x.key, { picked: !x.picked })} className="w-4 h-4 accent-violet-600" />
                          <button type="button" onClick={() => update(x.key, { open: !x.open })} title={x.open ? '접기' : '펼쳐서 기계 줄 보기'} className="p-0.5 -mx-0.5">
                            {x.open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </button>
                          <input value={f.name} onChange={e => rename(x.key, e.target.value)}
                            className="bg-transparent border-b border-dashed border-slate-300 focus:border-violet-500 outline-none w-32 font-extrabold text-sm text-slate-800" title="이름을 고칠 수 있어요" />
                          {f.region && <span className="text-[10px] font-bold px-1 rounded bg-slate-100 text-slate-500">{f.region}</span>}
                          <span className="text-[11px] text-slate-500">{t.total ? `${fmtNum(t.total)}대` : '대수 미기재'} · {t.lines}줄</span>
                          {KNIT_CATEGORIES.filter(c => t.linesByCategory[c.key]).map(c => <CategoryChip key={c.key} category={c.key} suffix={` ${t.linesByCategory[c.key]}`} />)}
                          {existing
                            ? <span className="text-[10px] font-extrabold px-1.5 py-px rounded bg-amber-100 text-amber-800 border border-amber-200">이미 있음{x.picked ? ' — 덮어씀' : ''}</span>
                            : <span className="text-[10px] font-extrabold px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-200">새로</span>}
                          {inList && <span className="text-[10px] text-slate-400">설계서 목록에 있음</span>}
                          {f.warnings?.length > 0 && <span className="text-[10px] font-bold text-amber-700 inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {f.warnings.length}</span>}
                        </div>
                        {similar.length > 0 && (
                          <div className="px-3 pb-2 -mt-1 text-[11px] text-sky-800 flex flex-wrap items-center gap-1.5">
                            설계서 편직처 목록에 비슷한 이름이 있어요:
                            {similar.map(n => (
                              <button key={n} type="button" onClick={() => rename(x.key, n)}
                                className="font-bold px-1.5 py-px rounded border border-sky-300 bg-sky-50 hover:bg-sky-100">'{n}'(으)로 바꾸기</button>
                            ))}
                            <span className="text-slate-400">(같은 편직처면 이름을 맞춰야 설계서와 이어져요)</span>
                          </div>
                        )}
                        {x.open && (
                          <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
                            {f.warnings?.length > 0 && (
                              <ul className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 space-y-0.5">
                                {f.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                              </ul>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
                              <p><b>전화</b> {f.phone || '—'} · <b>팩스</b> {f.fax || '—'}</p>
                              <p><b>담당</b> {f.contacts.filter(c => c.name || c.mobile).map(c => `${c.name} ${c.mobile}`.trim()).join(' / ') || '—'}</p>
                              <p><b>주소</b> {f.addresses.filter(Boolean).join(' / ') || '—'}</p>
                              {f.knitFee && <p className="md:col-span-3 whitespace-pre-wrap"><b>편직료</b> {f.knitFee}</p>}
                              {f.memos?.[0] && <p className="md:col-span-3 whitespace-pre-wrap"><b>메모로 옮길 비고</b> {f.memos[0].text.replace(/^엑셀 비고에서 옮김\n/, '')}</p>}
                            </div>
                            <KnitMachineTable machines={f.machines} />
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
            <p className="text-[11px] text-slate-500">가져온 편직처 이름은 설계서 편직처 목록에도 들어가요.</p>
            <div className="flex gap-2">
              <button type="button" onClick={requestClose} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">닫기</button>
              <button type="button" onClick={handleImport} disabled={!picked.length || busy}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {picked.length ? `${picked.length}곳 가져오기` : '가져오기'}
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={!!pending}
        message="읽은 편직처를 아직 가져오지 않았어요. 고른 편직처를 가져올까요?"
        onSave={async () => { setPending(null); await handleImport(); }}
        onDiscard={() => { const act = pending; setPending(null); if (act) act(); }}
        onKeepEditing={() => setPending(null)}
      />
    </>
  );
};
