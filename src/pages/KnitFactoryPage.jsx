import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Factory, Plus, FileJson, Search, List, Cpu, CalendarClock, Map as MapIcon, Layers, ChevronRight } from 'lucide-react';
import { KnitFactoryDetail } from '../components/knitFactory/KnitFactoryDetail';
import { KnitMachineSearch } from '../components/knitFactory/KnitMachineSearch';
import { KnitFactoryEditModal } from '../components/knitFactory/KnitFactoryEditModal';
import { KnitImportModal } from '../components/knitFactory/KnitImportModal';
import { KnitTypeSettingsModal } from '../components/knitFactory/KnitTypeSettingsModal';
import { KnitMapView } from '../components/knitFactory/KnitMapView';
import { CheckBadge, BlockSummary } from '../components/knitFactory/KnitParts';
import {
  sortFactories, factoryMatches, factoryTotals, needsCheck, KNIT_CHECK_STALE_DAYS, EMPTY_MACHINE_FILTERS, fmtNum,
} from '../utils/knitFactoryModel';
import { todayLocalISO } from '../utils/helpers';

// ============================================================
// 개발 ▾ 편직처 기계 현황 (대표님 요청 2026-11-23 — 예전 '편직처..xls' 엑셀을 옮김, 2차 개편 같은 날)
//  · [편직처] 목록 — 편직처마다 '종류 · 인치 · 대수 · 지금 가마 · 보유 가마' 한 줄 요약 → 누르면 상세, [← 목록으로]
//  · [기계로 찾기] 게이지 · 인치 · 계열 · 종류 · 스판장치 … → 지금 꼽힘 / 가마 교체 / 근접
//  · [지도] 카카오맵 — 편직처 분포 · 방문 순서 · 길찾기 (기계로 찾기 조건 그대로 거를 수 있음)
//  · [⚙ 기계 종류] 종류 · 계열 목록 / [정리본 가져오기] 예전 엑셀 정리본 / [+ 편직처 추가]
//  · 저장 · 메모 · 확인일 · 지금 가마 · 위치는 hooks/domains/useKnitFactory.js, 계산은 utils/knitFactoryModel.js
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
  knittingFactories = [],   // 설계서 편직처 목록 (settings)
  knitConfig,               // 기계 종류 · 계열
  onSaveKnitConfig,         // (config, renames) => 성공 true
  kakaoMapKey,
  onSaveKakaoMapKey,
  geocode,                  // (factory) => 좌표 | null
  saveFactory, deleteFactory, addMemo, updateMemo, deleteMemo, markChecked, setMountedGauge, setGeo,
  typeUsage, importSeed,
  onOpenSheet,              // (설계서) => 설계서 열기
}) => {
  const today = todayLocalISO();
  const [view, setView] = useState('list');          // 'list' | 'machine' | 'map'
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [detailId, setDetailId] = useState(null);     // 상세로 연 편직처
  const [mapFocusId, setMapFocusId] = useState(null);
  const [machineFilters, setMachineFilters] = useState(EMPTY_MACHINE_FILTERS);
  const [editor, setEditor] = useState(null);         // { id | null, key }
  const [importOpen, setImportOpen] = useState(false);
  const [typeSettingsOpen, setTypeSettingsOpen] = useState(false);
  const listScrollRef = useRef(0);
  const restoreScrollRef = useRef(false);

  const sorted = useMemo(() => sortFactories(knitFactories), [knitFactories]);
  const regions = useMemo(() => [...new Set(sorted.map(f => String(f.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [sorted]);
  const staleCount = sorted.filter(f => needsCheck(f, today)).length;
  const rows = useMemo(() => sorted.filter(f => factoryMatches(f, search)
    && (!region || f.region === region)
    && (!staleOnly || needsCheck(f, today))), [sorted, search, region, staleOnly, today]);
  const detail = detailId ? sorted.find(f => f.id === detailId) || null : null;
  const allMachines = sorted.reduce((s, f) => s + factoryTotals(f, knitConfig).total, 0);

  // 상세 열기 · 목록으로 (목록에서 보던 자리 그대로)
  const openDetail = (id) => {
    if (view === 'list' && !detailId) listScrollRef.current = window.scrollY;
    setDetailId(id);
    setView('list');
    window.scrollTo(0, 0);
  };
  const backToList = () => { restoreScrollRef.current = true; setDetailId(null); };
  useLayoutEffect(() => {
    if (!detailId && restoreScrollRef.current) {
      restoreScrollRef.current = false;
      window.scrollTo(0, listScrollRef.current);
    }
  }, [detailId]);
  const switchView = (v) => { setView(v); setDetailId(null); if (v !== 'map') setMapFocusId(null); };
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
              편직처 {sorted.length}곳{allMachines ? ` · 적힌 기계 ${fmtNum(allMachines)}대` : ''} — 가마 = 갈아 끼우는 실린더(게이지), 같은 종류 · 같은 인치 기계끼리 돌려 써요.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button type="button" onClick={() => setTypeSettingsOpen(true)} title="기계 종류 · 계열 목록"
              className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5 text-sm font-bold">
              <Layers className="w-4 h-4" /> 기계 종류
            </button>
            <button type="button" onClick={() => setImportOpen(true)}
              className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center gap-1.5 text-sm font-bold">
              <FileJson className="w-4 h-4 text-emerald-600" /> 정리본 가져오기
            </button>
            <button type="button" onClick={() => openEditor(null)}
              className="flex-1 sm:flex-none bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 flex items-center justify-center gap-1.5 text-sm font-bold">
              <Plus className="w-4 h-4" /> 편직처 추가
            </button>
          </div>
        </div>

        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          <ViewTab active={view === 'list'} onClick={() => switchView('list')} icon={List}>편직처</ViewTab>
          <ViewTab active={view === 'machine'} onClick={() => switchView('machine')} icon={Cpu}>기계로 찾기</ViewTab>
          <ViewTab active={view === 'map'} onClick={() => switchView('map')} icon={MapIcon}>지도</ViewTab>
        </div>

        {sorted.length === 0 && view !== 'map' ? (
          <section className="bg-white border border-slate-200 rounded-2xl py-16 text-center">
            <Factory className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">아직 등록된 편직처가 없어요.</p>
            <p className="text-xs text-slate-400 mt-1">예전 편직처 엑셀 정리본을 가져오거나 직접 추가해 주세요.</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-bold">
                <FileJson className="w-4 h-4" /> 정리본 가져오기
              </button>
              <button type="button" onClick={() => openEditor(null)} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-bold">
                <Plus className="w-4 h-4" /> 편직처 추가
              </button>
            </div>
          </section>
        ) : view === 'machine' ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
            <KnitMachineSearch factories={sorted} config={knitConfig} filters={machineFilters} onFiltersChange={setMachineFilters}
              onOpenFactory={openDetail} onShowMap={() => { setMapFocusId(null); setView('map'); }} />
          </section>
        ) : view === 'map' ? (
          <KnitMapView
            factories={sorted}
            config={knitConfig}
            today={today}
            kakaoMapKey={kakaoMapKey}
            onSaveKey={onSaveKakaoMapKey}
            machineFilters={machineFilters}
            focusId={mapFocusId}
            onOpenFactory={openDetail}
            setGeo={setGeo}
            geocode={geocode}
          />
        ) : detail ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5">
            <KnitFactoryDetail
              key={detail.id}
              factory={detail}
              config={knitConfig}
              designSheets={designSheets}
              orders={orders}
              today={today}
              onBack={backToList}
              onEdit={() => openEditor(detail.id)}
              onAddMemo={(text) => addMemo(detail.id, text)}
              onUpdateMemo={(memoId, text) => updateMemo(detail.id, memoId, text)}
              onDeleteMemo={(memoId) => deleteMemo(detail.id, memoId)}
              onMarkChecked={() => markChecked(detail.id)}
              onSetGauge={(machineId, g) => setMountedGauge(detail.id, machineId, g)}
              onShowOnMap={() => { setMapFocusId(detail.id); setDetailId(null); setView('map'); }}
              onOpenSheet={onOpenSheet}
            />
          </section>
        ) : (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* 거르기 */}
            <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="편직처 · 담당자 · 주소 · 메모 · 종류 검색"
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
              <span className="ml-auto text-xs text-slate-400">{rows.length}곳</span>
            </div>
            {/* 목록 */}
            <ul className="divide-y divide-slate-100">
              {rows.length === 0 && <li className="px-3 py-10 text-center text-sm text-slate-400">찾는 편직처가 없어요.</li>}
              {rows.map(f => {
                const t = factoryTotals(f, knitConfig);
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => openDetail(f.id)} className="w-full text-left px-3 sm:px-4 py-2.5 hover:bg-violet-50/50 flex flex-col sm:flex-row items-stretch sm:items-start gap-1.5 sm:gap-3">
                      <div className="sm:w-44 shrink-0">
                        <p className="font-extrabold text-slate-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {f.region || '지역 없음'} · 기계 <b className="text-slate-700">{t.total ? `${fmtNum(t.total)}대` : '?'}</b>
                          {t.cylinders ? <> · 가마 <b className="text-slate-700">{fmtNum(t.cylinders)}</b></> : null}
                        </p>
                        <div className="mt-0.5"><CheckBadge factory={f} today={today} size="xs" /></div>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5"><BlockSummary blocks={t.blocks} config={knitConfig} /></div>
                      <ChevronRight className="hidden sm:block w-4 h-4 text-slate-300 shrink-0 mt-1" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* 팝업 — 화면 칸(space-y) 밖에 (팝업 규약) */}
      {editor && (
        <KnitFactoryEditModal
          key={editor.key}
          factoryId={editor.id}
          knitFactories={knitFactories}
          config={knitConfig}
          onSave={saveFactory}
          onDelete={async (id) => {
            const ok = await deleteFactory(id);
            if (ok && detailId === id) setDetailId(null);
            return ok;
          }}
          onSaved={(doc) => { if (view === 'list') setDetailId(doc.id); }}
          onOpenTypeSettings={() => setTypeSettingsOpen(true)}
          onClose={() => setEditor(null)}
        />
      )}
      {importOpen && (
        <KnitImportModal
          knitFactories={knitFactories}
          knittingFactories={knittingFactories}
          designSheets={designSheets}
          orders={orders}
          config={knitConfig}
          onImport={importSeed}
          onClose={() => setImportOpen(false)}
        />
      )}
      {typeSettingsOpen && (
        <KnitTypeSettingsModal
          config={knitConfig}
          typeUsage={typeUsage}
          onSave={onSaveKnitConfig}
          onClose={() => setTypeSettingsOpen(false)}
        />
      )}
    </>
  );
};
