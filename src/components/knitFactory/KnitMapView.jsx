import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin, Loader2, KeyRound, ExternalLink, Navigation, ArrowUp, ArrowDown, X, Crosshair, Route, Filter, Check, Info, RotateCcw,
} from 'lucide-react';
import { loadKakaoMaps } from '../../utils/kakaoMap';
import {
  searchMachines, hasMachineFilter, machineFilterLabel, needsGeocode, needsCheck, distanceKm, kakaoLinkTo, kakaoLinkFromTo, factoryTotals, fmtNum,
} from '../../utils/knitFactoryModel';
import { BlockSummary, CheckBadge } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — [지도] (대표님 요청 2026-11-23 '지도에 편직처 분포 · 일정 짤 때')
//  · 카카오맵에 편직처 핀 (대표 주소 좌표 — 저장할 때 찾아 둠. 없으면 이 화면에서 차례로 찾아 저장)
//  · 거르기: 지역 · 확인 필요만 · [기계로 찾기] 조건 그대로 (예: 28G 30" 있는 곳만)
//  · 방문 체크 → 핀에 순서 번호 · 다음 곳까지 직선 거리 · [길찾기](카카오맵) · [가까운 순서로]
//  · 위치를 못 찾았거나 틀리면 [지도에서 찍기] → 지도를 누른 곳으로 저장
//  · 키가 없으면 카카오 개발자 사이트에서 키 만드는 법 + 넣는 칸
// ============================================================

const DEFAULT_CENTER = { lat: 37.86, lng: 127.17 }; // 포천 · 양주 근처
const SITE_DOMAINS = ['http://localhost:5173', 'https://grubig-app.web.app', 'https://grubig-app.firebaseapp.com'];

const KeySetup = ({ onSaveKey, current }) => {
  const [key, setKey] = useState(current || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    try { await onSaveKey(key.trim()); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500" /> 카카오맵 키를 넣어 주세요 (처음 한 번)</h3>
        <p className="text-xs text-slate-500 mt-1">지도를 그리려면 카카오 개발자 사이트의 무료 'JavaScript 키'가 필요해요. 이 키는 등록한 우리 사이트 주소에서만 작동해요.</p>
      </div>
      <ol className="text-sm text-slate-700 space-y-2 list-decimal pl-5">
        <li><a href="https://developers.kakao.com" target="_blank" rel="noreferrer" className="font-bold text-violet-700 underline inline-flex items-center gap-0.5">developers.kakao.com <ExternalLink className="w-3 h-3" /></a> 에 카카오 계정으로 로그인 → <b>내 애플리케이션 → 애플리케이션 추가</b> (앱 이름: 그루빅 ERP)</li>
        <li>만든 앱 → <b>앱 → 플랫폼 키 → JavaScript 키</b> 의 <b>JavaScript SDK 도메인</b>에 아래 3개를 넣고 저장
          <div className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs space-y-0.5 select-all">
            {SITE_DOMAINS.map(d => <div key={d}>{d}</div>)}
          </div>
        </li>
        <li><b>카카오맵</b> 사용 설정을 <b>ON</b> (앱 설정의 제품 설정 · 카카오맵 메뉴)</li>
        <li>같은 화면의 <b>JavaScript 키</b>(영문·숫자 32자리)를 복사해서 아래 칸에 붙여 넣고 [저장]</li>
      </ol>
      <div className="flex gap-2">
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="JavaScript 키 붙여 넣기" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 ring-violet-200" />
        <button type="button" onClick={save} disabled={!key.trim() || busy} className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 저장
        </button>
      </div>
      <p className="text-[11px] text-slate-400">회사 공통으로 저장돼서 다른 직원도 같이 써요. 키가 없어도 편직처 상세의 [카카오맵에서 찾기] 링크는 써요.</p>
    </div>
  );
};

// 가까운 순서 (첫 곳에서 시작해 가장 가까운 곳을 차례로)
const nearestOrder = (list) => {
  if (list.length < 3) return list;
  const rest = list.slice(1);
  const out = [list[0]];
  while (rest.length) {
    const last = out[out.length - 1];
    let best = 0;
    rest.forEach((f, i) => { if (distanceKm(last.geo, f.geo) < distanceKm(last.geo, rest[best].geo)) best = i; });
    out.push(rest.splice(best, 1)[0]);
  }
  return out;
};

export const KnitMapView = ({
  factories = [],
  config,
  today,
  kakaoMapKey,
  onSaveKey,          // (key) => 회사 설정에 저장
  machineFilters,     // [기계로 찾기] 거르기 (같이 씀)
  focusId,            // 이 편직처를 가운데로 (상세 [지도에서 보기])
  onOpenFactory,      // (id) => 상세
  setGeo,             // (id, geo, { auto }) => 저장
  geocode,            // (factory) => 좌표 | null
}) => {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const pinModeRef = useRef(null);
  const handlersRef = useRef({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [region, setRegion] = useState('');
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [useMachine, setUseMachine] = useState(() => hasMachineFilter(machineFilters));
  const [selectedId, setSelectedId] = useState(focusId || null);
  const [visit, setVisit] = useState([]);           // 방문 순서 (편직처 id)
  const [pinMode, setPinMode] = useState(null);     // 지도에서 찍을 편직처 id
  const [geoProgress, setGeoProgress] = useState(null); // { done, total }
  const [regeo, setRegeo] = useState(null);         // [주소로 다시 찾기] { id, busy, error }
  const failedRef = useRef(new Set());

  // ── 보일 편직처 ──
  const machineIds = useMemo(() => (useMachine && hasMachineFilter(machineFilters)
    ? new Set(searchMachines(factories, machineFilters, config).map(r => r.factory.id)) : null), [factories, machineFilters, config, useMachine]);
  const regions = useMemo(() => [...new Set(factories.map(f => String(f.region || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [factories]);
  const shown = useMemo(() => factories.filter(f => (!region || f.region === region)
    && (!onlyCheck || needsCheck(f, today))
    && (!machineIds || machineIds.has(f.id))), [factories, region, onlyCheck, machineIds, today]);
  const located = shown.filter(f => f.geo);
  const unlocated = shown.filter(f => !f.geo);
  const byId = useMemo(() => new Map(factories.map(f => [f.id, f])), [factories]);
  const visitList = visit.map(id => byId.get(id)).filter(Boolean);
  const selected = selectedId ? byId.get(selectedId) : null;

  // ── 지도 만들기 ──
  useEffect(() => {
    if (!kakaoMapKey || !mapDivRef.current) return undefined;
    let cancelled = false;
    setError('');
    loadKakaoMaps(kakaoMapKey).then(kakao => {
      if (cancelled || !mapDivRef.current) return;
      const map = new kakao.maps.Map(mapDivRef.current, { center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng), level: 9 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      kakao.maps.event.addListener(map, 'click', (e) => handlersRef.current.mapClick?.(e.latLng));
      mapRef.current = map;
      setReady(true);
    }).catch(e => { if (!cancelled) setError(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, [kakaoMapKey]);

  // 지도를 누름 — 위치 찍기 중이면 그 편직처 좌표로 저장
  handlersRef.current.mapClick = async (latLng) => {
    const id = pinModeRef.current;
    if (!id) return;
    const f = byId.get(id);
    pinModeRef.current = null;
    setPinMode(null);
    if (!f) return;
    await setGeo(id, { lat: latLng.getLat(), lng: latLng.getLng(), address: (f.addresses || [])[0] || '', manual: true });
    setSelectedId(id);
  };
  handlersRef.current.markerClick = (id) => setSelectedId(id);

  // [주소로 다시 찾기] — 직접 찍은 위치 · 이름으로 찾은 위치 · 못 찾은 곳을 적혀 있는 대표 주소로 다시 (대표님 2026-11-24 '다시 못 돌아가네')
  const relocateByAddress = async (f) => {
    if (!f || regeo?.busy) return;
    if (!geocode) { setRegeo({ id: f.id, busy: false, error: '카카오맵 키가 없어서 주소로 찾을 수 없어요.' }); return; }
    setPinMode(null);
    setRegeo({ id: f.id, busy: true, error: '' });
    let geo = null;
    try { geo = await geocode(f); } catch { geo = null; }
    if (!geo) {
      setRegeo({ id: f.id, busy: false, error: '적혀 있는 주소로 위치를 못 찾았어요. 주소를 고치거나 지도에서 직접 찍어 주세요.' });
      return;
    }
    const ok = await setGeo(f.id, geo);
    setRegeo(ok ? null : { id: f.id, busy: false, error: '저장하지 못했어요. 다시 해 주세요.' });
    if (!ok) return;
    failedRef.current.delete(f.id);
    const kakao = window.kakao;
    const map = mapRef.current;
    if (kakao?.maps && map) map.setCenter(new kakao.maps.LatLng(geo.lat, geo.lng));
  };
  useEffect(() => { pinModeRef.current = pinMode; }, [pinMode]);

  // ── 핀 그리기 ──
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !kakao || !map) return;
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = located.map(f => {
      const order = visit.indexOf(f.id);
      const isSel = f.id === selectedId;
      const el = document.createElement('div');
      el.style.cssText = 'transform:translate(-50%,-100%);cursor:pointer;display:flex;flex-direction:column;align-items:center;';
      const tag = document.createElement('div');
      tag.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:9999px;font:700 11px/1.4 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);border:2px solid ${isSel ? '#7c3aed' : order >= 0 ? '#0284c7' : '#fff'};background:${isSel ? '#7c3aed' : '#fff'};color:${isSel ? '#fff' : '#1e293b'};`;
      if (order >= 0) {
        const num = document.createElement('span');
        num.textContent = String(order + 1);
        num.style.cssText = 'background:#0284c7;color:#fff;border-radius:9999px;min-width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;padding:0 3px;';
        tag.appendChild(num);
      }
      const name = document.createElement('span');
      name.textContent = f.name;
      tag.appendChild(name);
      const tail = document.createElement('div');
      tail.style.cssText = `width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${isSel ? '#7c3aed' : order >= 0 ? '#0284c7' : '#64748b'};`;
      el.appendChild(tag);
      el.appendChild(tail);
      el.addEventListener('click', (e) => { e.stopPropagation(); handlersRef.current.markerClick?.(f.id); });
      const overlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(f.geo.lat, f.geo.lng), content: el, yAnchor: 0, zIndex: isSel ? 3 : order >= 0 ? 2 : 1 });
      overlay.setMap(map);
      return overlay;
    });
  }, [ready, located, visit, selectedId]);

  // 보이는 편직처가 바뀌면 다 보이게 맞춤
  const fitKey = located.map(f => f.id).join(',');
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !kakao || !map || !located.length) return;
    if (located.length === 1) { map.setCenter(new kakao.maps.LatLng(located[0].geo.lat, located[0].geo.lng)); map.setLevel(6); return; }
    const bounds = new kakao.maps.LatLngBounds();
    located.forEach(f => bounds.extend(new kakao.maps.LatLng(f.geo.lat, f.geo.lng)));
    map.setBounds(bounds, 40, 40, 40, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  // 상세에서 [지도에서 보기] — 그 편직처로
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    const f = focusId ? byId.get(focusId) : null;
    if (!ready || !kakao || !map || !f?.geo) return;
    setSelectedId(f.id);
    map.setCenter(new kakao.maps.LatLng(f.geo.lat, f.geo.lng));
    map.setLevel(5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusId]);

  // ── 좌표 없는 편직처 차례로 찾아 저장 (한 번 실패한 곳은 이 화면에서 다시 안 함) ──
  useEffect(() => {
    if (!ready || !geocode) return undefined;
    const todo = factories.filter(f => needsGeocode(f) && !failedRef.current.has(f.id));
    if (!todo.length) return undefined;
    let cancelled = false;
    (async () => {
      setGeoProgress({ done: 0, total: todo.length });
      for (let i = 0; i < todo.length; i += 1) {
        if (cancelled) return;
        const f = todo[i];
        let geo = null;
        try { geo = await geocode(f); } catch { geo = null; }
        if (cancelled) return;
        if (geo) await setGeo(f.id, geo, { auto: true });
        else failedRef.current.add(f.id);
        setGeoProgress({ done: i + 1, total: todo.length });
      }
      setGeoProgress(null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, factories.map(f => `${f.id}:${(f.addresses || [])[0] || ''}:${f.geo ? 1 : 0}`).join('|')]);

  // ── 방문 ──
  const toggleVisit = (id) => setVisit(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const moveVisit = (i, d) => setVisit(prev => {
    const j = i + d;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const sortNearest = () => setVisit(nearestOrder(visitList.filter(f => f.geo)).map(f => f.id).concat(visitList.filter(f => !f.geo).map(f => f.id)));
  const legs = visitList.slice(1).map((f, i) => distanceKm(visitList[i].geo, f.geo));
  const totalKm = legs.reduce((s, d) => s + (d || 0), 0);

  if (!kakaoMapKey || editingKey) {
    return (
      <div className="space-y-2">
        {editingKey && <button type="button" onClick={() => setEditingKey(false)} className="text-xs font-bold text-slate-500 hover:underline">← 지도로</button>}
        <KeySetup current={kakaoMapKey} onSaveKey={async (k) => { await onSaveKey(k); setEditingKey(false); }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 items-start">
      {/* 왼쪽 — 거르기 · 방문 · 목록 */}
      <aside className="space-y-3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1"><Filter className="w-3.5 h-3.5 text-violet-500" /> 지도에 보일 편직처</p>
          <div className="flex flex-wrap gap-1">
            {['', ...regions].map(r => (
              <button key={r || 'all'} type="button" onClick={() => setRegion(r)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${region === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'}`}>{r || '전체'}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyCheck} onChange={e => setOnlyCheck(e.target.checked)} className="w-4 h-4 accent-amber-500" /> 확인 필요한 곳만 (방문 때 물어볼 곳)
          </label>
          {hasMachineFilter(machineFilters) ? (
            <label className="flex items-start gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={useMachine} onChange={e => setUseMachine(e.target.checked)} className="w-4 h-4 accent-violet-600 mt-px" />
              <span>[기계로 찾기] 조건에 맞는 곳만
                <span className="block font-medium text-[11px] text-violet-700">{machineFilterLabel(machineFilters)}</span>
              </span>
            </label>
          ) : <p className="text-[11px] text-slate-400">[기계로 찾기]에서 게이지 · 인치 · 피더를 넣으면 그 기계가 있는 곳만 볼 수 있어요.</p>}
          <p className="text-[11px] text-slate-500">지도에 {located.length}곳{unlocated.length ? ` · 위치 없음 ${unlocated.length}곳` : ''}{geoProgress ? ` · 위치 찾는 중 ${geoProgress.done}/${geoProgress.total}` : ''}</p>
        </div>

        {/* 방문 순서 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1"><Route className="w-3.5 h-3.5 text-sky-600" /> 방문 순서 {visitList.length ? `(${visitList.length}곳)` : ''}</p>
            {visitList.length > 2 && <button type="button" onClick={sortNearest} className="text-[11px] font-bold text-sky-700 hover:underline">가까운 순서로</button>}
          </div>
          {!visitList.length ? (
            <p className="text-[11px] text-slate-400">아래 목록이나 지도 핀에서 [방문]을 눌러 넣어요. 순서대로 번호가 붙고 다음 곳까지 거리 · 길찾기가 나와요.</p>
          ) : (
            <ol className="space-y-1">
              {visitList.map((f, i) => (
                <li key={f.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-1.5 pl-6 text-[10px] text-slate-400">
                      ↓ {legs[i - 1] !== null ? `${legs[i - 1].toFixed(1)}km (직선)` : '거리 모름'}
                      {kakaoLinkFromTo(visitList[i - 1], f) && <a href={kakaoLinkFromTo(visitList[i - 1], f)} target="_blank" rel="noreferrer" className="font-bold text-amber-700 hover:underline">길찾기</a>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0">{i + 1}</span>
                    <button type="button" onClick={() => setSelectedId(f.id)} className="font-bold text-slate-800 truncate flex-1 text-left hover:text-violet-700">{f.name}</button>
                    {!f.geo && <span className="text-[10px] text-amber-600">위치 없음</span>}
                    <button type="button" onClick={() => moveVisit(i, -1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => moveVisit(i, 1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => toggleVisit(f.id)} className="p-0.5 text-slate-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {visitList.length > 1 && <p className="text-[11px] text-slate-500">총 {totalKm.toFixed(1)}km (직선 거리 — 실제 도로는 더 길어요)</p>}
          {visitList.length > 0 && <button type="button" onClick={() => setVisit([])} className="text-[10px] text-slate-400 underline">방문 순서 비우기</button>}
        </div>

        {/* 목록 */}
        <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-400">조건에 맞는 편직처가 없어요.</li>}
          {shown.map(f => {
            const inVisit = visit.includes(f.id);
            return (
              <li key={f.id} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs ${selectedId === f.id ? 'bg-violet-50' : ''}`}>
                <button type="button" onClick={() => setSelectedId(f.id)} className="flex-1 min-w-0 text-left">
                  <span className="font-bold text-slate-800">{f.name}</span>
                  {f.region && <span className="ml-1 text-[10px] text-slate-400">{f.region}</span>}
                  {!f.geo && <span className="ml-1 text-[10px] font-bold text-amber-600">위치 없음</span>}
                </button>
                {!f.geo && (
                  <button type="button" onClick={() => { setPinMode(f.id); setSelectedId(f.id); }} title="지도를 눌러 위치 찍기"
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 ${pinMode === f.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    <Crosshair className="w-3 h-3" /> 찍기
                  </button>
                )}
                <button type="button" onClick={() => toggleVisit(f.id)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${inVisit ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'}`}>
                  {inVisit ? `방문 ${visit.indexOf(f.id) + 1}` : '방문'}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setEditingKey(true)} className="text-[10px] text-slate-400 underline inline-flex items-center gap-1"><KeyRound className="w-3 h-3" /> 카카오맵 키 바꾸기</button>
      </aside>

      {/* 오른쪽 — 지도 */}
      <section className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {error ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <p className="text-xs text-slate-500">키 · 도메인을 방금 등록했으면 카카오 쪽 반영에 몇 분 걸릴 수 있어요. 고친 뒤에는 새로고침(F5)해 주세요.</p>
            <button type="button" onClick={() => setEditingKey(true)} className="text-xs font-bold text-violet-700 underline">키 다시 넣기</button>
          </div>
        ) : (
          <>
            <div ref={mapDivRef} className="w-full h-[calc(100vh-220px)] min-h-[420px]" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>}
            {pinMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                <Crosshair className="w-4 h-4" /> '{byId.get(pinMode)?.name}' 위치를 지도에서 눌러 주세요
                <button type="button" onClick={() => setPinMode(null)} className="underline">그만</button>
              </div>
            )}
            {selected && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[420px] z-10 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-800">{selected.name} {selected.region && <span className="text-[11px] font-bold text-slate-400">{selected.region}</span>}</p>
                    <p className="text-[11px] text-slate-500 truncate">{(selected.addresses || [])[0] || '주소 없음'}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <CheckBadge factory={selected} today={today} size="xs" />
                  <span>기계 {fmtNum(factoryTotals(selected, config).total) || '?'}대</span>
                  {selected.phone && <a href={`tel:${selected.phone.split('/')[0].replace(/[^\d+]/g, '')}`} className="font-bold text-slate-700">{selected.phone}</a>}
                  {selected.geo?.byName && <span className="text-amber-700 inline-flex items-center gap-0.5"><Info className="w-3 h-3" /> 이름으로 찾은 위치 — 맞는지 확인</span>}
                  {selected.geo?.manual && <span className="text-amber-700 inline-flex items-center gap-0.5" title="지도에서 직접 찍은 위치예요. [주소로 다시 찾기]로 적혀 있는 주소 위치로 돌아갈 수 있어요."><MapPin className="w-3 h-3" /> 직접 찍은 위치</span>}
                </div>
                <div className="max-h-24 overflow-y-auto"><BlockSummary blocks={factoryTotals(selected, config).blocks} config={config} /></div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => onOpenFactory(selected.id)} className="text-xs font-bold text-white bg-violet-600 rounded-lg px-2.5 py-1 hover:bg-violet-700">상세 보기</button>
                  <button type="button" onClick={() => toggleVisit(selected.id)} className="text-xs font-bold text-sky-700 border border-sky-200 rounded-lg px-2.5 py-1 hover:bg-sky-50">{visit.includes(selected.id) ? '방문에서 빼기' : '방문에 넣기'}</button>
                  {selected.geo && <a href={kakaoLinkTo(selected.name, selected.geo)} target="_blank" rel="noreferrer" className="text-xs font-bold text-amber-800 bg-yellow-50 border border-yellow-300 rounded-lg px-2.5 py-1 inline-flex items-center gap-1"><Navigation className="w-3 h-3" /> 카카오맵 길찾기</a>}
                  <button type="button" onClick={() => setPinMode(selected.id)} className="text-xs font-bold text-amber-700 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-50 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.geo ? '위치 다시 찍기' : '위치 찍기'}</button>
                  {/* 직접 찍었거나 · 이름으로 찾았거나 · 위치가 없으면 → 적혀 있는 주소로 다시 */}
                  {(selected.addresses || [])[0] && (!selected.geo || selected.geo.manual || selected.geo.byName) && (
                    <button type="button" onClick={() => relocateByAddress(selected)} disabled={regeo?.id === selected.id && regeo.busy}
                      title={`'${(selected.addresses || [])[0]}' 로 위치를 다시 찾아요`}
                      className="text-xs font-bold text-slate-600 border border-slate-300 rounded-lg px-2.5 py-1 hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-50">
                      {regeo?.id === selected.id && regeo.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} 주소로 다시 찾기
                    </button>
                  )}
                </div>
                {regeo?.id === selected.id && regeo.error && <p className="text-[11px] font-bold text-red-600">{regeo.error}</p>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
