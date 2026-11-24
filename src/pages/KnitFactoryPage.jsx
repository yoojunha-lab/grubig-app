import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Factory, Plus, FileJson, Search, List, Cpu, CalendarClock, Map as MapIcon, Layers, ChevronRight, Wand2, Download } from 'lucide-react';
import { KnitFactoryDetail } from '../components/knitFactory/KnitFactoryDetail';
import { KnitMachineSearch } from '../components/knitFactory/KnitMachineSearch';
import { KnitFactoryEditModal } from '../components/knitFactory/KnitFactoryEditModal';
import { KnitImportModal } from '../components/knitFactory/KnitImportModal';
import { KnitTypeSettingsModal } from '../components/knitFactory/KnitTypeSettingsModal';
import { KnitMapView } from '../components/knitFactory/KnitMapView';
import { KnitSheetAlignModal } from '../components/knitFactory/KnitSheetAlignModal';
import { CheckBadge } from '../components/knitFactory/KnitParts';
import { KnitFactoryList } from '../components/knitFactory/KnitFactoryList';
import {
  sortFactories, factoryMatches, factoryTotals, needsCheck, checkState, KNIT_CHECK_STALE_DAYS, EMPTY_MACHINE_FILTERS, fmtNum, sheetKnitAlarm, knitJobsFor,
  familyTotals, familyTone, sameFactoryName, daysSince, UNGROUPED_FAMILY,
} from '../utils/knitFactoryModel';
import { todayLocalISO } from '../utils/helpers';

// ============================================================
// 개발 ▾ 편직처 기계 현황 (대표님 요청 2026-11-23 — 예전 '편직처..xls' 엑셀을 옮김, 2차 개편 같은 날)
//  · [편직처] 목록 — 편직처마다 '종류 · 인치 · 대수 · 지금 가마 · 보유 가마' 한 줄 요약 → 누르면 상세
//    상세는 견적서 화면처럼 왼쪽 좁은 편직처 목록 + 오른쪽 상세 (대표님 요청 2026-11-23), ← 를 누르면 전체 목록(보던 자리)으로
//  · [기계로 찾기] 게이지 · 인치 · 계열 · 종류 · 스판장치 … → 지금 꼽힘 / 가마 교체 / 근접
//  · [지도] 카카오맵 — 편직처 분포 · 방문 순서 · 길찾기 (기계로 찾기 조건 그대로 거를 수 있음)
//  · [⚙ 기계 종류] 종류 · 계열 목록 / [정리본 가져오기] 예전 엑셀 정리본 / [+ 편직처 추가]
//  · 저장 · 메모 · 확인일 · 지금 가마 · 위치는 hooks/domains/useKnitFactory.js, 계산은 utils/knitFactoryModel.js
//  · 2026-11-24 개발 고도화 3단계: [엑셀로 내보내기](머리줄 — 거르기와 상관없이 전부) · [기계로 찾기] 피더 · 메모 종류(방문 · 통화 → 확인일)
//    · 검색 칸에 '96F'처럼 넣으면 피더가 96인 기계가 있는 편직처
// ============================================================

// 왼쪽 좁은 목록의 한 줄 요약 — 종류마다 인치들 ('싱글 30·32·36" · 양면 자카드 30·36"')
const typeInchSummary = (blocks) => {
  const byType = new Map();
  blocks.forEach(b => {
    if (!byType.has(b.type)) byType.set(b.type, []);
    if (b.inch) byType.get(b.type).push(b.inch);
  });
  return [...byType.entries()].map(([type, inches]) => `${type}${inches.length ? ` ${inches.join('·')}"` : ''}`).join(' · ');
};

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
  saveFactory, deleteFactory, addMemo, updateMemo, deleteMemo, markChecked, setMountedGauge, saveEquipment, setGeo,
  typeUsage, importSeed,
  exportKnitExcel,          // (config) => 엑셀로 내보내기 (useKnitFactory — App이 훅 값을 통째로 넘김)
  onOpenSheet,              // (설계서) => 설계서 열기
  navGuardRef,              // App 위 메뉴로 나갈 때 묻기 (기계 수정 중 저장 안 한 변경)
  onAlignSheets,            // (맞출 안 목록) => [설계서 맞추기] 저장
  tempDesignSheets = [],    // 가설계서 — [설계서 맞추기]에 같이
  savedFabrics = [],        // 원단 — 생산 오더 → 원단 → 설계서 (편직 중 기계 찾기)
}) => {
  const today = todayLocalISO();
  const [view, setView] = useState('list');          // 'list' | 'machine' | 'map'
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [family, setFamily] = useState('');         // 계열 거르기 ('' = 전체)
  const [sortKey, setSortKey] = useState('name');   // 'name' | 'machines' | 'recent' | 'check'
  const [detailId, setDetailId] = useState(null);     // 상세로 연 편직처
  const [mapFocusId, setMapFocusId] = useState(null);
  const [machineFilters, setMachineFilters] = useState(EMPTY_MACHINE_FILTERS);
  const [editor, setEditor] = useState(null);         // { id | null, key }
  const [importOpen, setImportOpen] = useState(false);
  const [typeSettingsOpen, setTypeSettingsOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);   // [설계서 맞추기]
  // 생산 현황에서 편직 중 · 대기인 오더 → 편직처 · 묶음(종류 + 인치) (2026-11-24 고도화)
  const jobsByFactory = useMemo(() => Object.fromEntries((knitFactories || []).map(f => [f.id, knitJobsFor(f, { orders, designSheets, fabrics: savedFabrics }, knitConfig)])),
    [knitFactories, orders, designSheets, savedFabrics, knitConfig]);
  const jobsByBlock = useMemo(() => {
    const m = {};
    Object.entries(jobsByFactory).forEach(([fid, js]) => js.forEach(j => { if (j.blockKey) (m[`${fid}__${j.blockKey}`] ||= []).push(j); }));
    return m;
  }, [jobsByFactory]);
  // 설계서 편직 사양이 기계 현황에 없는 것 (머리 버튼 숫자)
  const sheetAlarmCount = useMemo(() => [...designSheets, ...tempDesignSheets].filter(s => sheetKnitAlarm(s.knitting, knitFactories, knitConfig)).length, [designSheets, tempDesignSheets, knitFactories, knitConfig]);
  const listScrollRef = useRef(0);
  const restoreScrollRef = useRef(false);
  const equipDirtyRef = useRef(false);   // 상세 [기계 수정] 중 저장 안 한 변경
  // 기계 수정 중에 다른 곳으로 가려 하면 한 번 묻기 (왼쪽 목록 · ← · 위 보기 단추 · 위 메뉴)
  const canLeave = () => {
    if (!equipDirtyRef.current) return true;
    if (!window.confirm('저장 안 한 기계 수정이 있어요. 버리고 나갈까요?')) return false;
    equipDirtyRef.current = false;
    return true;
  };
  useEffect(() => {
    if (!navGuardRef) return undefined;
    navGuardRef.current = (proceed) => { if (canLeave()) proceed(); };
    return () => { if (navGuardRef) navGuardRef.current = null; };
  });
  const selectedRowRef = useRef(null);   // 상세 왼쪽 목록에서 고른 줄
  const listBoxRef = useRef(null);       // 상세 왼쪽 목록 스크롤 칸

  const sorted = useMemo(() => sortFactories(knitFactories), [knitFactories]);
  const regions = useMemo(() => [...new Set(sorted.map(f => String(f.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [sorted]);
  const staleCount = sorted.filter(f => needsCheck(f, today)).length;
  // 편직처마다 기계 합계 (한 번만 계산)
  const totalsById = useMemo(() => new Map(sorted.map(f => [f.id, factoryTotals(f, knitConfig)])), [sorted, knitConfig]);
  // 우리 작업 — 설계서 · 생산 오더 수 · 마지막 날짜 (상세 '우리 작업 이력'과 같은 기준: 이름)
  const workByFactory = useMemo(() => Object.fromEntries(sorted.map(f => {
    const sh = designSheets.filter(x => sameFactoryName(x?.knitting?.factory, f.name));
    const od = orders.filter(o => sameFactoryName(o?.steps?.knitting?.vendor, f.name));
    const lastAt = [...sh.map(x => String(x.updatedAt || x.createdAt || '')), ...od.map(o => String(o.createdAt || ''))]
      .filter(Boolean).sort().pop() || '';
    return [f.id, { sheets: sh.length, orders: od.length, lastAt }];
  })), [sorted, designSheets, orders]);
  // 검색 · 지역 · 확인 필요로 거른 것 (계열 칩 숫자는 여기서)
  const baseRows = useMemo(() => sorted.filter(f => factoryMatches(f, search)
    && (!region || f.region === region)
    && (!staleOnly || needsCheck(f, today))), [sorted, search, region, staleOnly, today]);
  const familyCounts = useMemo(() => {
    const acc = {};
    baseRows.forEach(f => Object.entries(familyTotals(totalsById.get(f.id)?.blocks)).forEach(([k, n]) => { acc[k] = (acc[k] || 0) + n; }));
    return acc;
  }, [baseRows, totalsById]);
  const familyList = useMemo(() => [...(knitConfig?.families || []), UNGROUPED_FAMILY]
    .filter(k => familyCounts[k] !== undefined), [knitConfig, familyCounts]);
  const rows = useMemo(() => {
    const list = baseRows.filter(f => !family || (totalsById.get(f.id)?.blocks || []).some(b => b.family === family));
    if (sortKey === 'name') return list;
    const key = {
      machines: (f) => -(totalsById.get(f.id)?.total || 0),
      recent: (f) => workByFactory[f.id]?.lastAt || '',
      // 확인한 적 없는 편직처가 맨 위 (디버깅 2026-11-24 — 예전엔 -1 이라 오늘 확인한 곳 바로 앞, 거의 맨 아래였음)
      check: (f) => { const d = daysSince(f.checkedAt, today); return d === null ? -Infinity : -d; },
    }[sortKey];
    return [...list].sort((a, b) => {
      const ka = key(a); const kb = key(b);
      if (sortKey === 'recent') return kb.localeCompare(ka);   // 최근 먼저, 작업 없는 곳은 뒤
      return ka - kb;
    });
  }, [baseRows, family, sortKey, totalsById, workByFactory, today]);
  const detail = detailId ? sorted.find(f => f.id === detailId) || null : null;
  const allMachines = sorted.reduce((sum, f) => sum + (totalsById.get(f.id)?.total || 0), 0);
  const rowMachines = rows.reduce((sum, f) => sum + (totalsById.get(f.id)?.total || 0), 0);
  // 계열을 고르면 그 계열 기계만 센 대수도 (전체 대수와 같이 보여 줌)
  const rowFamilyMachines = family ? rows.reduce((sum, f) => sum + (familyTotals(totalsById.get(f.id)?.blocks)[family] || 0), 0) : 0;
  const rowCylinders = rows.reduce((sum, f) => sum + (totalsById.get(f.id)?.cylinders || 0), 0);
  const rowKnitting = rows.reduce((sum, f) => sum + (jobsByFactory[f.id] || []).filter(j => j.state === 'knitting').length, 0);

  // 상세 열기 · 목록으로 (목록에서 보던 자리 그대로)
  const openDetail = (id) => {
    if (id !== detailId && !canLeave()) return;
    if (view === 'list' && !detailId) listScrollRef.current = window.scrollY;
    setDetailId(id);
    setView('list');
    window.scrollTo(0, 0);
  };
  const backToList = () => { if (!canLeave()) return; restoreScrollRef.current = true; setDetailId(null); };
  useLayoutEffect(() => {
    if (!detailId && restoreScrollRef.current) {
      restoreScrollRef.current = false;
      window.scrollTo(0, listScrollRef.current);
    }
  }, [detailId]);
  // 상세를 열면 왼쪽 목록에서 그 편직처 줄이 보이게 — 목록 칸만 스크롤 (화면 전체는 그대로)
  useEffect(() => {
    const box = listBoxRef.current;
    const row = selectedRowRef.current;
    if (!box || !row) return;
    const top = row.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 2 + row.offsetHeight / 2);
    }
  }, [detailId]);
  const switchView = (v) => { if (!canLeave()) return; setView(v); setDetailId(null); if (v !== 'map') setMapFocusId(null); };
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
            {onAlignSheets && (
              <button type="button" onClick={() => setAlignOpen(true)} title="설계서 편직 사양을 기계 현황에 맞추기 · 기계 현황에 없는 설계서 보기"
                className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-violet-50 hover:border-violet-300 flex items-center justify-center gap-1.5 text-sm font-bold">
                <Wand2 className="w-4 h-4 text-violet-600" /> 설계서 맞추기
                {sheetAlarmCount > 0 && <span className="text-[10px] font-extrabold px-1.5 rounded-full bg-red-500 text-white" title="기계 현황에 없는 설계서">{sheetAlarmCount}</span>}
              </button>
            )}
            <button type="button" onClick={() => setTypeSettingsOpen(true)} title="기계 종류 · 계열 목록"
              className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5 text-sm font-bold">
              <Layers className="w-4 h-4" /> 기계 종류
            </button>
            <button type="button" onClick={() => setImportOpen(true)}
              className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center gap-1.5 text-sm font-bold">
              <FileJson className="w-4 h-4 text-emerald-600" /> 정리본 가져오기
            </button>
            {exportKnitExcel && (
              <button type="button" onClick={() => exportKnitExcel(knitConfig)} disabled={!sorted.length}
                title={'편직처 · 기계 · 보유 가마 · 메모를 엑셀 파일로 받아요 (시트 4개).\n목록의 검색 · 지역 · 계열 거르기와 상관없이 전부 나가요.'}
                className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center gap-1.5 text-sm font-bold disabled:opacity-40">
                <Download className="w-4 h-4 text-emerald-600" /> 엑셀로 내보내기
              </button>
            )}
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
            <KnitMachineSearch factories={sorted} config={knitConfig} filters={machineFilters} onFiltersChange={setMachineFilters} jobsByBlock={jobsByBlock}
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
          // 견적서 화면처럼 — 왼쪽 편직처 목록(좁게, 따로 스크롤) + 오른쪽 상세. 휴대폰은 상세만 (← 로 목록)
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <aside className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-20">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-230px)]">
                <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-extrabold text-slate-500">편직처 목록 ({rows.length}{rows.length !== sorted.length ? `/${sorted.length}` : ''})</span>
                  <button type="button" onClick={() => openEditor(null)} className="text-[11px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-0.5">
                    <Plus className="w-3.5 h-3.5" /> 추가
                  </button>
                </div>
                <div className="px-2 py-1.5 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="편직처 · 종류 · 메모 · 피더(96F) 검색"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none focus:ring-2 ring-violet-200" />
                  </div>
                </div>
                <div ref={listBoxRef} className="relative overflow-y-auto flex-1">
                  {rows.length === 0 && <div className="py-10 text-center text-slate-400 text-xs">찾는 편직처가 없어요.</div>}
                  {rows.map(f => {
                    const t = factoryTotals(f, knitConfig);
                    const on = f.id === detail.id;
                    const st = checkState(f, today);
                    const summary = typeInchSummary(t.blocks);
                    return (
                      <button key={f.id} type="button" ref={on ? selectedRowRef : undefined} onClick={() => openDetail(f.id)}
                        className={`w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-violet-50/60 transition-colors border-l-[3px] ${on ? 'bg-violet-50 border-l-violet-500' : 'border-l-transparent'}`}>
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[13px] font-bold text-slate-800 truncate">{f.name}</span>
                          {f.region && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">{f.region}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                          <span className={st.tone === 'ok' ? '' : 'text-amber-600 font-bold'}>{st.tone === 'ok' ? `${f.checkedAt.slice(5).replace('-', '/')} 확인` : '확인 필요'}</span>
                          <span className="text-slate-500">기계 {t.total ? `${fmtNum(t.total)}대` : '?'}{t.cylinders ? ` · 가마 ${fmtNum(t.cylinders)}` : ''}</span>
                        </div>
                        {summary && <p className="mt-0.5 text-[10px] text-slate-500 truncate" title={summary}>{summary}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          <section className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-2xl p-3 sm:p-5">
            <KnitFactoryDetail
              key={detail.id}
              factory={detail}
              config={knitConfig}
              designSheets={designSheets}
              orders={orders}
              today={today}
              onBack={backToList}
              onEdit={() => openEditor(detail.id)}
              onAddMemo={(text, opts) => addMemo(detail.id, text, opts)}
              onUpdateMemo={(memoId, text, opts) => updateMemo(detail.id, memoId, text, opts)}
              onDeleteMemo={(memoId) => deleteMemo(detail.id, memoId)}
              onMarkChecked={() => markChecked(detail.id)}
              onSetGauge={(machineId, g) => setMountedGauge(detail.id, machineId, g)}
              onSaveEquipment={(equip) => saveEquipment(detail.id, equip)}
              jobs={jobsByFactory[detail.id] || []}
              knitFactories={knitFactories}
              onEquipDirtyChange={(d) => { equipDirtyRef.current = d; }}
              onShowOnMap={() => { if (!canLeave()) return; setMapFocusId(detail.id); setDetailId(null); setView('map'); }}
              onOpenSheet={onOpenSheet}
            />
          </section>
          </div>
        ) : (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* 요약 — 보이는 편직처 기준 (계열 칩을 누르면 그 계열 기계가 있는 곳만) */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-violet-50/70 to-white flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="text-sm text-slate-600">편직처 <b className="text-lg font-extrabold text-slate-800">{rows.length}</b>곳</span>
              {family ? (
                <span className="text-sm text-slate-600">{family} 기계 <b className="text-lg font-extrabold text-slate-800">{fmtNum(rowFamilyMachines) || 0}</b>대
                  <span className="text-xs text-slate-400"> (이 편직처들 전체 {fmtNum(rowMachines) || 0}대)</span></span>
              ) : (
                <span className="text-sm text-slate-600">기계 <b className="text-lg font-extrabold text-slate-800">{fmtNum(rowMachines) || 0}</b>대</span>
              )}
              {rowCylinders > 0 && <span className="text-sm text-slate-600">보유 가마 <b className="text-lg font-extrabold text-slate-800">{fmtNum(rowCylinders)}</b>개</span>}
              {rowKnitting > 0 && <span className="text-sm text-emerald-700 font-bold">● 편직 중 오더 {rowKnitting}건</span>}
              {familyList.length > 0 && (
                <span className="flex flex-wrap items-center gap-1 lg:ml-auto">
                  <span className="text-[11px] font-bold text-slate-500 mr-0.5">계열</span>
                  <button type="button" onClick={() => setFamily('')}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${family === '' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>전체</button>
                  {familyList.map(k => (
                    <button key={k} type="button" onClick={() => setFamily(v => (v === k ? '' : k))}
                      title={`${k} 계열 기계가 있는 편직처만`}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${family === k ? 'ring-2 ring-offset-1 ring-violet-400' : 'opacity-90 hover:opacity-100'} ${familyTone(knitConfig, k)}`}>
                      {k} {fmtNum(familyCounts[k]) || 0}대
                    </button>
                  ))}
                </span>
              )}
            </div>
            {/* 거르기 · 정렬 */}
            <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="편직처 · 담당자 · 주소 · 메모 · 종류 · 피더(96F) 검색"
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-2 ring-violet-200" />
              </div>
              <div className="flex flex-wrap gap-1">
                {['', ...regions].map(r => (
                  <button key={r || 'all'} type="button" onClick={() => setRegion(r)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${region === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                    {r || '전체 지역'}
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
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500">
                정렬
                <select value={sortKey} onChange={e => setSortKey(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-violet-200">
                  <option value="name">이름 순</option>
                  <option value="machines">기계 많은 순</option>
                  <option value="recent">최근 우리 작업 순</option>
                  <option value="check">확인 오래된 순</option>
                </select>
              </label>
            </div>
            {/* 목록 */}
            <KnitFactoryList rows={rows} config={knitConfig} today={today} family={family} jobsByFactory={jobsByFactory} workByFactory={workByFactory} totalsById={totalsById} onOpen={openDetail} />
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
      {alignOpen && (
        <KnitSheetAlignModal
          designSheets={designSheets}
          tempDesignSheets={tempDesignSheets}
          knitFactories={knitFactories}
          config={knitConfig}
          onApply={onAlignSheets}
          onClose={() => setAlignOpen(false)}
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
