import React, { useMemo, useState } from 'react';
import { Factory, Plus, FileSpreadsheet, Search, List, Cpu, ArrowLeft, CalendarClock } from 'lucide-react';
import { KnitFactoryDetail } from '../components/knitFactory/KnitFactoryDetail';
import { KnitMachineSearch } from '../components/knitFactory/KnitMachineSearch';
import { KnitFactoryEditModal } from '../components/knitFactory/KnitFactoryEditModal';
import { KnitImportModal } from '../components/knitFactory/KnitImportModal';
import { CheckBadge, CategoryChip } from '../components/knitFactory/KnitParts';
import { sortFactories, factoryMatches, factoryTotals, checkState, KNIT_CATEGORIES, KNIT_CHECK_STALE_DAYS, fmtNum } from '../utils/knitFactoryModel';
import { todayLocalISO } from '../utils/helpers';

// ============================================================
// 개발 ▾ 편직처 기계 현황 (대표님 요청 2026-11-23 — 예전 '편직처..xls' 엑셀을 옮김)
//  · [편직처별] 왼쪽 편직처 목록(검색 · 지역 · 확인 오래됨) → 오른쪽 한 곳 보기 (연락처 · 기계 현황 · 메모 · 우리 작업 이력)
//  · [기계로 찾기] 모든 편직처 기계를 한 표로 — 게이지 · 인치 · 종류 · 제조사로 '이 원단 돌릴 수 있는 곳' 찾기
//  · [엑셀 가져오기] 예전 엑셀을 읽어서 미리보기 → 저장 / [+ 편직처 추가]
//  · 저장 · 메모 · 확인일은 hooks/domains/useKnitFactory.js, 계산은 utils/knitFactoryModel.js
//  · 설계서 편직 사양의 [기계 현황에서 고르기]도 같은 데이터 (components/knitFactory/KnitMachinePickerModal)
// ============================================================

const ViewTab = ({ active, onClick, icon: Icon, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors ${active ? 'bg-white text-violet-700 shadow-sm border border-violet-200' : 'text-slate-500 hover:text-slate-700'}`}>
    <Icon className="w-4 h-4" /> {children}
  </button>
);

export const KnitFactoryPage = ({
  knitFactories = [],
  designSheets = [],
  orders = [],
  knittingFactories = [],   // 설계서 편직처 목록 (settings — 엑셀 가져오기에서 비슷한 이름 알림)
  isXlsxReady,
  saveFactory, deleteFactory, addMemo, updateMemo, deleteMemo, markChecked, importFactories,
  onOpenSheet,              // (설계서) => 설계서 열기
}) => {
  const today = todayLocalISO();
  const [view, setView] = useState('factory');      // 'factory' | 'machine'
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [editor, setEditor] = useState(null);       // { id | null, key }
  const [importOpen, setImportOpen] = useState(false);

  const sorted = useMemo(() => sortFactories(knitFactories), [knitFactories]);
  const regions = useMemo(() => [...new Set(sorted.map(f => String(f.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [sorted]);
  const staleCount = sorted.filter(f => checkState(f, today).tone !== 'ok').length;
  const rows = useMemo(() => sorted.filter(f => factoryMatches(f, search)
    && (!region || f.region === region)
    && (!staleOnly || checkState(f, today).tone !== 'ok')), [sorted, search, region, staleOnly, today]);
  const selected = sorted.find(f => f.id === selectedId) || rows[0] || null;
  const allMachines = sorted.reduce((s, f) => s + factoryTotals(f).total, 0);

  const openFactory = (id) => { setSelectedId(id); setView('factory'); setMobileDetail(true); };
  const openEditor = (id = null) => setEditor({ id, key: `${id || 'new'}_${Date.now()}` });

  return (
    <>
      <div className="max-w-[1600px] mx-auto w-full space-y-3 print:hidden">
        {/* 머리줄 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Factory className="w-6 h-6 text-violet-600" /> 편직처 기계 현황
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              편직처 {sorted.length}곳{allMachines ? ` · 적힌 기계 ${fmtNum(allMachines)}대` : ''} — 개발할 때 '이 게이지 · 인치 기계가 어디 있나'를 찾아요. 가마 = 갈아 끼우는 실린더(게이지).
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={() => setImportOpen(true)}
              className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center gap-1.5 text-sm font-bold">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> 엑셀 가져오기
            </button>
            <button type="button" onClick={() => openEditor(null)}
              className="flex-1 sm:flex-none bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 flex items-center justify-center gap-1.5 text-sm font-bold">
              <Plus className="w-4 h-4" /> 편직처 추가
            </button>
          </div>
        </div>

        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          <ViewTab active={view === 'factory'} onClick={() => setView('factory')} icon={List}>편직처별</ViewTab>
          <ViewTab active={view === 'machine'} onClick={() => setView('machine')} icon={Cpu}>기계로 찾기</ViewTab>
        </div>

        {sorted.length === 0 ? (
          <section className="bg-white border border-slate-200 rounded-2xl py-16 text-center">
            <Factory className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">아직 등록된 편직처가 없어요.</p>
            <p className="text-xs text-slate-400 mt-1">지금까지 쓰던 편직처 엑셀을 가져오면 한 번에 옮겨져요.</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-bold">
                <FileSpreadsheet className="w-4 h-4" /> 엑셀 가져오기
              </button>
              <button type="button" onClick={() => openEditor(null)} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">
                <Plus className="w-4 h-4" /> 편직처 추가
              </button>
            </div>
          </section>
        ) : view === 'machine' ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
            <KnitMachineSearch factories={sorted} onOpenFactory={openFactory} />
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-3 items-start">
            {/* 왼쪽 목록 */}
            <aside className={`bg-white border border-slate-200 rounded-2xl overflow-hidden md:sticky md:top-20 ${mobileDetail ? 'hidden md:block' : ''}`}>
              <div className="p-2.5 space-y-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="편직처 · 담당자 · 주소 · 메모 검색"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {['', ...regions].map(r => (
                    <button key={r || 'all'} type="button" onClick={() => setRegion(r)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${region === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                      {r || '전체'}
                    </button>
                  ))}
                  {staleCount > 0 && (
                    <button type="button" onClick={() => setStaleOnly(v => !v)}
                      title={`기계 현황을 ${KNIT_CHECK_STALE_DAYS / 30}개월 넘게 확인 안 했거나 확인일이 없는 곳`}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-0.5 ${staleOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      <CalendarClock className="w-3 h-3" /> 확인 필요 {staleCount}
                    </button>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-slate-100 md:max-h-[calc(100vh-260px)] overflow-y-auto">
                {rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">찾는 편직처가 없어요.</li>}
                {rows.map(f => {
                  const t = factoryTotals(f);
                  const on = selected?.id === f.id;
                  return (
                    <li key={f.id}>
                      <button type="button" onClick={() => { setSelectedId(f.id); setMobileDetail(true); }}
                        className={`w-full text-left px-3 py-2 transition-colors ${on ? 'bg-violet-50 border-l-4 border-violet-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800 truncate">{f.name}</span>
                          {f.region && <span className="text-[10px] text-slate-400">{f.region}</span>}
                          <span className="ml-auto text-[11px] font-bold text-slate-500 whitespace-nowrap">{t.total ? `${fmtNum(t.total)}대` : `${t.lines}줄`}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {KNIT_CATEGORIES.filter(c => t.linesByCategory[c.key]).map(c => <CategoryChip key={c.key} category={c.key} />)}
                          <span className="ml-auto"><CheckBadge factory={f} today={today} size="xs" /></span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* 오른쪽 한 곳 보기 */}
            <section className={`bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 min-w-0 ${mobileDetail ? '' : 'hidden md:block'}`}>
              <button type="button" onClick={() => setMobileDetail(false)} className="md:hidden mb-2 text-xs font-bold text-slate-500 inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> 편직처 목록
              </button>
              {selected ? (
                <KnitFactoryDetail
                  key={selected.id}
                  factory={selected}
                  designSheets={designSheets}
                  orders={orders}
                  today={today}
                  onEdit={() => openEditor(selected.id)}
                  onAddMemo={(text) => addMemo(selected.id, text)}
                  onUpdateMemo={(memoId, text) => updateMemo(selected.id, memoId, text)}
                  onDeleteMemo={(memoId) => deleteMemo(selected.id, memoId)}
                  onMarkChecked={() => markChecked(selected.id)}
                  onOpenSheet={onOpenSheet}
                />
              ) : <p className="text-sm text-slate-400 py-10 text-center">왼쪽에서 편직처를 골라 주세요.</p>}
            </section>
          </div>
        )}
      </div>

      {/* 팝업 — 화면 칸(space-y) 밖에 (팝업 규약) */}
      {editor && (
        <KnitFactoryEditModal
          key={editor.key}
          factoryId={editor.id}
          knitFactories={knitFactories}
          onSave={saveFactory}
          onDelete={async (id) => {
            const ok = await deleteFactory(id);
            if (ok && selectedId === id) setSelectedId(null);
            return ok;
          }}
          onSaved={(doc) => { setSelectedId(doc.id); setView('factory'); }}
          onClose={() => setEditor(null)}
        />
      )}
      {importOpen && (
        <KnitImportModal
          isXlsxReady={isXlsxReady}
          knitFactories={knitFactories}
          knittingFactories={knittingFactories}
          onImport={importFactories}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  );
};
