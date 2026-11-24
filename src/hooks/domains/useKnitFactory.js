import { useRef } from 'react';
import {
  KNIT_FACTORY_COLLECTION, cleanFactoryForSave, equipmentChanged, sameFactoryName, needsGeocode, normalizeMachine,
  normalizeCylinder, isEmptyMachine, isEmptyCylinder, describeEquipmentChanges, appendChangeLog,
  normalizeMemoKind, memoKindOf, memoKindInfo, isContactKind, memoDateError, checkedAtFromRecord,
  buildKnitExportSheets, knitExportFileName,
} from '../../utils/knitFactoryModel';
import { todayLocalISO } from '../../utils/helpers';

// ============================================================
// GRUBIG ERP - 편직처 기계 현황 (개발 ▾ 편직처 기계 현황) 도메인 훅 — 대표님 요청 2026-11-23 (2차 개편 같은 날)
//  - Firestore 컬렉션: knitFactories — 저장 · 삭제 · 메모 · 확인일 · 지금 가마 바로 바꾸기 · 지도 위치 · 정리본 가져오기
//  - 문서 모양·계산은 utils/knitFactoryModel.js
//  - 저장하면 편직처 이름을 설계서 편직처 목록(settings/general.knittingFactories)에도 넣음 (대표님 결정)
//    · 이름을 바꿔도 예전 이름은 목록에 남김 (그 이름으로 적힌 설계서가 있을 수 있어서)
//  - 기계 · 보유 가마를 고쳐 저장하면 '확인일'이 오늘로 (기계 현황을 확인하고 고친 것으로 봄)
//  - 대표 주소가 바뀌면(또는 처음) 카카오맵으로 좌표를 찾아 같이 저장 (geocode — 키가 없거나 못 찾으면 좌표 없이 저장)
//  - 메모 · [오늘 확인함] · 지금 가마 바꾸기 · 지도에서 위치 찍기는 누르면 바로 저장 (입력 창 밖)
//  - 2026-11-24 개발 고도화 3단계: 메모 종류(메모 / 방문 / 통화) — 방문 · 통화 기록은 확인일도 그 날로(더 최근일 때만)
//    · [엑셀로 내보내기] 편직처 · 기계 · 보유 가마 · 메모 시트 (exportKnitExcel — 화면 거르기와 상관없이 전부)
// ============================================================

const newFactoryId = () => `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const newMemoId = () => `kmemo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const withTimeout = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);

export const useKnitFactory = ({
  knitFactories, designSheets, orders, knittingFactories,
  saveDocToCloud, saveBatchToCloud, deleteDocFromCloud, showToast, user,
  addKnittingFactoryNames,     // (names) => 설계서 편직처 목록에 없는 이름만 넣기
  removeKnittingFactoryNames,  // (names) => 설계서 편직처 목록에서 빼기
  saveKnitConfig,              // (config) => 기계 종류 · 계열 설정 저장 (성공 true)
  geocode,                     // (factory) => 좌표 | null — 카카오맵 키가 없으면 null 함수
  factoryRefCounts,            // (편직처 id, 예전 이름) => { sheets, temps, orders } — 이름 바꿀 때 같이 바뀔 곳 수 (2026-11-24)
  renameFactoryRefs,           // (편직처 id, 예전 이름, 새 이름) => 설계서 · 가설계서 · 생산 오더의 편직처 이름도 같이
}) => {
  const busyRef = useRef(false);
  const who = () => user?.displayName || user?.email?.split('@')[0] || 'Unknown';
  const findFactory = (id) => (knitFactories || []).find(f => f.id === id) || null;

  // 설계서 편직처 목록에 이름 넣기 (실패해도 편직처 저장은 된 것 — 알림만)
  const syncNames = async (names) => {
    if (!addKnittingFactoryNames) return;
    try { await addKnittingFactoryNames(names); } catch (e) {
      console.error('설계서 편직처 목록에 넣기 실패', e);
      showToast('편직처는 저장했는데 설계서 편직처 목록에 넣지 못했어요. 설계서에서 [+ 등록]으로 넣어 주세요.', 'error');
    }
  };

  // 좌표 찾기 (8초 안에 못 찾으면 좌표 없이)
  const tryGeocode = async (factory) => {
    if (!geocode || !needsGeocode(factory)) return factory.geo || null;
    try { return await withTimeout(geocode(factory), 8000); } catch (e) {
      console.warn('편직처 좌표 찾기 실패', e);
      return null;
    }
  };

  // 한 문서의 몇 칸만 바꿔 저장 — 문서를 통째로 덮어쓰므로 기존 문서를 깔고 얹음 (저장 규약)
  //  touch: false 면 '마지막 저장'(updatedAt)을 안 바꿈 (지도 좌표처럼 저절로 채우는 값)
  const patchFactory = async (id, fields, { touch = true } = {}) => {
    const existing = findFactory(id);
    if (!existing) { showToast('편직처를 찾을 수 없어요. 다른 곳에서 지웠을 수 있어요.', 'error'); return false; }
    const ok = await saveDocToCloud(KNIT_FACTORY_COLLECTION, {
      ...existing, ...fields, ...(touch ? { updatedAt: new Date().toISOString(), updatedBy: who() } : {}),
    });
    return ok !== false;
  };

  /** 저장 — editingId가 있으면 고침. 반환: 저장한 문서 (못 했거나 그만두면 null) */
  const saveFactory = async (input, editingId = null) => {
    if (busyRef.current) return null;
    const clean = cleanFactoryForSave(input);
    if (!clean.name) { showToast('편직처 이름을 넣어 주세요.', 'error'); return null; }
    const dup = (knitFactories || []).find(f => f.id !== editingId && sameFactoryName(f.name, clean.name));
    if (dup) { showToast(`'${dup.name}'이(가) 이미 있어요. 그 편직처를 열어 고쳐 주세요.`, 'error'); return null; }
    const existing = editingId ? findFactory(editingId) : null;
    if (editingId && !existing) { showToast('편직처를 찾을 수 없어요. 다른 곳에서 지웠을 수 있어요.', 'error'); return null; }
    const noType = [...clean.machines, ...clean.cylinders].filter(x => !x.type).length;
    if (noType) { showToast(`종류를 고르지 않은 줄이 ${noType}개 있어요. 기계 · 가마 줄마다 종류를 골라 주세요.`, 'error'); return null; }

    // 이름을 바꾸면 — 그 편직처로 적힌 설계서 · 가설계서 · 생산 오더의 편직처 이름도 같이 (2026-11-24 빈틈 막기 — 예전엔 설계서가 옛 이름으로 남아 알람이 떴음)
    const renamed = !!existing && existing.name !== clean.name;
    if (renamed) {
      const c = factoryRefCounts ? factoryRefCounts(existing.id, existing.name) : { sheets: 0, temps: 0, orders: 0 };
      const parts = [c.sheets && `설계서 ${c.sheets}건`, c.temps && `가설계서 ${c.temps}건`, c.orders && `생산 오더 ${c.orders}건`].filter(Boolean);
      if (!window.confirm(
        `편직처 이름을 '${existing.name}' → '${clean.name}'(으)로 바꿉니다.\n\n`
        + (parts.length ? `${parts.join(' · ')}에 적힌 편직처 이름도 같이 바꿔요 (설계서는 변경 이력에 남아요).\n\n` : '')
        + '계속할까요?',
      )) return null;
    }

    const now = new Date().toISOString();
    const changed = equipmentChanged(existing || {}, clean);
    const hasEquip = clean.machines.length + clean.cylinders.length > 0;
    busyRef.current = true;
    try {
      const draft = {
        ...(existing || {}),
        ...clean,
        memos: existing?.memos || clean.memos || [],   // 메모는 입력 창 밖에서 바로 저장 — 입력 창 값으로 덮지 않음
        checkedAt: changed && hasEquip ? todayLocalISO() : (clean.checkedAt || existing?.checkedAt || ''),
        id: editingId || newFactoryId(),
        createdAt: existing?.createdAt || now,
        createdBy: existing?.createdBy || who(),
        updatedAt: now,
        updatedBy: who(),
      };
      const docToSave = { ...draft, geo: await tryGeocode(draft) };
      const ok = await saveDocToCloud(KNIT_FACTORY_COLLECTION, docToSave);
      if (ok === false) return null;
      await syncNames([docToSave.name]);
      if (renamed && renameFactoryRefs) {
        try { await renameFactoryRefs(existing.id, existing.name, docToSave.name); } catch (e) {
          console.error('편직처 이름 바꾸기 — 설계서 · 오더 반영 실패', e);
          showToast('편직처 이름은 바꿨는데 설계서 · 오더에 같이 바꾸지 못한 곳이 있어요. 다시 저장해 주세요.', 'error');
        }
      }
      const notes = [
        changed && existing && hasEquip && '기계를 고쳐서 확인일이 오늘로 바뀌었어요.',
        geocode && docToSave.addresses.length && !docToSave.geo && '주소로 지도 위치를 못 찾았어요 — 지도에서 직접 찍어 주세요.',
      ].filter(Boolean).join(' ');
      showToast(`'${docToSave.name}'을(를) 저장했어요.${notes ? ` ${notes}` : ''}`, 'success');
      return docToSave;
    } finally {
      busyRef.current = false;
    }
  };

  /** 삭제 (되돌릴 수 없음). 반환: 지웠으면 true */
  const deleteFactory = async (id) => {
    const target = findFactory(id);
    if (!target) return false;
    if (!window.confirm(
      `'${target.name}'을(를) 지울까요?\n기계 ${(target.machines || []).length}줄 · 보유 가마 ${(target.cylinders || []).length}줄 · 메모 ${(target.memos || []).length}개가 같이 지워지고 되돌릴 수 없어요.\n\n`
      + '설계서에 적힌 편직처 이름과 설계서 편직처 목록은 그대로예요.',
    )) return false;
    const ok = await deleteDocFromCloud(KNIT_FACTORY_COLLECTION, id);
    if (ok === false) return false;
    showToast(`'${target.name}'을(를) 지웠어요.`, 'success');
    return true;
  };

  /**
   * 메모 추가 (맨 위에) — opts: { kind: 'memo'|'visit'|'call', date(방문 · 통화한 날 — 메모는 늘 오늘) }
   *  방문 · 통화면 확인일도 그 날로 (지금 확인일보다 최근일 때만 — 2026-11-24, 개발 고도화 3단계)
   */
  const addMemo = async (id, text, { kind = 'memo', date = '' } = {}) => {
    const t = String(text || '').trim();
    if (!t) return false;
    const existing = findFactory(id);
    if (!existing) return false;
    const k = normalizeMemoKind(kind);
    const today = todayLocalISO();
    const d = isContactKind(k) ? (String(date || '').trim() || today) : today;
    const err = memoDateError(k, d, today);
    if (err) { showToast(err, 'error'); return false; }
    const memo = { id: newMemoId(), date: d, kind: k, text: t, by: who(), ...(d !== today ? { writtenAt: today } : {}) };
    const nextChecked = checkedAtFromRecord(existing.checkedAt, k, d);
    const ok = await patchFactory(id, { memos: [memo, ...(existing.memos || [])], ...(nextChecked ? { checkedAt: nextChecked } : {}) });
    if (ok) {
      const label = memoKindInfo(k).label;
      if (!isContactKind(k)) showToast('메모를 남겼어요.', 'success');
      else if (nextChecked) showToast(`${label} 기록을 남겼어요. 확인일이 ${nextChecked}(으)로 바뀌었어요.`, 'success');
      else showToast(`${label} 기록을 남겼어요. 확인일은 이미 더 최근(${existing.checkedAt})이라 그대로예요.`, 'success');
    }
    return ok;
  };
  /** 메모 고치기 — opts: { kind, date } (주면 종류 · 날짜도). 방문 · 통화로 바꾸면 확인일도 (더 최근일 때만) */
  const updateMemo = async (id, memoId, text, opts = {}) => {
    const t = String(text || '').trim();
    const existing = findFactory(id);
    if (!existing || !t) return false;
    const old = (existing.memos || []).find(m => m.id === memoId);
    if (!old) { showToast('메모를 찾을 수 없어요. 다른 곳에서 지웠을 수 있어요.', 'error'); return false; }
    const k = opts.kind ? normalizeMemoKind(opts.kind) : memoKindOf(old);
    const d = opts.date !== undefined && String(opts.date || '').trim() ? String(opts.date).trim() : (old.date || '');
    const err = memoDateError(k, d, todayLocalISO());
    if (err) { showToast(err, 'error'); return false; }
    const nextChecked = checkedAtFromRecord(existing.checkedAt, k, d);
    const ok = await patchFactory(id, {
      memos: (existing.memos || []).map(m => (m.id === memoId ? { ...m, text: t, kind: k, date: d, editedAt: todayLocalISO(), editedBy: who() } : m)),
      ...(nextChecked ? { checkedAt: nextChecked } : {}),
    });
    if (ok && nextChecked) showToast(`${memoKindInfo(k).label} 기록으로 고쳤어요. 확인일이 ${nextChecked}(으)로 바뀌었어요.`, 'success');
    return ok;
  };
  const deleteMemo = async (id, memoId) => {
    const existing = findFactory(id);
    if (!existing) return false;
    if (!window.confirm('이 메모를 지울까요? 되돌릴 수 없어요.')) return false;
    return patchFactory(id, { memos: (existing.memos || []).filter(m => m.id !== memoId) });
  };

  /** [오늘 확인함] */
  const markChecked = async (id) => {
    const ok = await patchFactory(id, { checkedAt: todayLocalISO() });
    if (ok) showToast('기계 현황 확인일을 오늘로 남겼어요.', 'success');
    return ok;
  };

  /** 지금 꼽힌 가마 바로 바꾸기 (상세 화면) — 확인일도 오늘로 */
  const setMountedGauge = async (id, machineId, gauge) => {
    const existing = findFactory(id);
    if (!existing) return false;
    const g = Number(gauge) > 0 ? Number(gauge) : null;
    const machines = (existing.machines || []).map(m => (m.id === machineId ? { ...normalizeMachine(m), gauge: g, needles: null } : m));
    const ok = await patchFactory(id, { machines, checkedAt: todayLocalISO(), changeLog: appendChangeLog(existing, describeEquipmentChanges(existing, { ...existing, machines }), who()) });
    if (ok) showToast(g ? `지금 가마를 ${g}G로 바꿨어요.` : '지금 가마를 비웠어요.', 'success');
    return ok;
  };

  /**
   * 상세 화면 [기계 수정] 저장 — 기계 줄 · 보유 가마만 통째로 바꿈 (대표님 요청 2026-11-24 '이 화면에서 바로')
   *  고친 게 있으면 확인일 오늘. 반환: 저장했으면 true
   */
  const saveEquipment = async (id, { machines, cylinders }) => {
    const existing = findFactory(id);
    if (!existing) { showToast('편직처를 찾을 수 없어요. 다른 곳에서 지웠을 수 있어요.', 'error'); return false; }
    const next = {
      machines: (machines || []).map(normalizeMachine).filter(m => !isEmptyMachine(m)),
      cylinders: (cylinders || []).map(normalizeCylinder).filter(c => !isEmptyCylinder(c)),
    };
    if (next.machines.some(m => !m.type) || next.cylinders.some(c => !c.type)) { showToast('종류를 고르지 않은 카드가 있어요.', 'error'); return false; }
    const changed = equipmentChanged(existing, next);
    if (!changed) return true;
    const ok = await patchFactory(id, { ...next, checkedAt: todayLocalISO(), changeLog: appendChangeLog(existing, describeEquipmentChanges(existing, next), who()) });
    if (ok) showToast(`'${existing.name}' 기계 현황을 저장했어요. 확인일이 오늘로 바뀌었어요.`, 'success');
    return ok;
  };

  /**
   * 설계서 알람 [기계 현황에 이 가마 추가] — 그 편직처의 종류 · 인치 묶음에 이 게이지 가마를 더함 (2026-11-24)
   *  묶음(기계 줄)이 없으면 기계 줄(대수 모름 · 피더)도 같이. 확인일은 안 바꿈 (편직처에 확인한 게 아니라서)
   */
  const addCylinderFromSheet = async (id, { type, inch, gauge, needles = null, feeder = '' }) => {
    const existing = findFactory(id);
    if (!existing || !type || !(inch > 0) || !(gauge > 0)) return false;
    const machines = (existing.machines || []).map(normalizeMachine);
    const cylinders = (existing.cylinders || []).map(normalizeCylinder);
    const hasBlock = machines.some(m => m.type === type && m.inch === inch);
    if (cylinders.some(c => c.type === type && c.inch === inch && c.gauge === gauge)) return true;
    const nextMachines = hasBlock ? machines : [...machines, { ...normalizeMachine({ type, inch, feeder }), note: '설계서 알람에서 추가' }];
    const nextCylinders = [...cylinders, normalizeCylinder({ type, inch, gauge, needles, note: '설계서 알람에서 추가' })];
    const ok = await patchFactory(id, {
      machines: nextMachines, cylinders: nextCylinders,
      changeLog: appendChangeLog(existing, [`${type} ${inch}" 가마 ${gauge}G 추가 (설계서 알람에서)`], who()),
    });
    if (ok) showToast(`${existing.name}에 ${type} ${inch}" ${gauge}G 가마를 더했어요.${hasBlock ? '' : ' 그 인치 기계 줄도 같이 만들었어요 (대수 모름).'}`, 'success');
    return ok;
  };

  /** 지도 위치 — 직접 찍기(manual) · 자동으로 찾은 좌표 저장(auto: '마지막 저장'은 안 바꿈) */
  const setGeo = async (id, geo, { auto = false } = {}) => {
    const ok = await patchFactory(id, { geo }, { touch: !auto });
    if (ok && !auto) showToast(geo ? '지도 위치를 저장했어요.' : '지도 위치를 지웠어요.', 'success');
    return ok;
  };

  /** 기계 종류 이름 바꾸기 — 그 종류를 쓰는 편직처의 기계 · 가마 줄도 같이 (설정 창에서) */
  const renameTypeInFactories = async (oldName, newName) => {
    const targets = (knitFactories || []).filter(f => [...(f.machines || []), ...(f.cylinders || [])].some(x => x.type === oldName));
    if (!targets.length) return true;
    const docs = targets.map(f => ({
      ...f,
      changeLog: appendChangeLog(f, [`기계 종류 이름 ${oldName} → ${newName}`], who()),
      machines: (f.machines || []).map(m => (m.type === oldName ? { ...m, type: newName } : m)),
      cylinders: (f.cylinders || []).map(c => (c.type === oldName ? { ...c, type: newName } : c)),
    }));
    const ok = await saveBatchToCloud(KNIT_FACTORY_COLLECTION, docs);
    return ok !== false;
  };
  /** 이 종류를 쓰는 편직처 수 (설정 창 알림) */
  const typeUsage = (name) => (knitFactories || []).filter(f => [...(f.machines || []), ...(f.cylinders || [])].some(x => x.type === name)).length;

  /**
   * 정리본 가져오기 (그루빅이 정리한 예전 엑셀)
   *  opts: { replaceAll(지금 편직처 모두 지우고), cleanNames(설계서 편직처 목록에서 안 쓰는 이름 빼기), addTypes([{name,family}] 설정에 더할 종류), config }
   *  반환: 저장했으면 true
   */
  const importSeed = async (factories, { replaceAll = false, cleanNames = false, addTypes = [], config = null } = {}) => {
    if (busyRef.current) return false;
    const list = (factories || []).filter(f => f?.name);
    if (!list.length) { showToast('가져올 편직처가 없어요.', 'error'); return false; }
    busyRef.current = true;
    try {
      // 1) 기계 종류 설정에 없는 종류 더하기
      if (addTypes.length && saveKnitConfig && config) {
        const families = [...config.families];
        addTypes.forEach(t => { if (!families.includes(t.family)) families.push(t.family); });
        const ok = await saveKnitConfig({ families, types: [...config.types, ...addTypes] });
        if (!ok) return false;
      }
      // 2) 지금 편직처 지우기
      if (replaceAll) {
        for (const f of knitFactories || []) {
          const ok = await deleteDocFromCloud(KNIT_FACTORY_COLLECTION, f.id);
          if (ok === false) { showToast(`'${f.name}'을(를) 지우지 못해서 멈췄어요. 다시 해 주세요.`, 'error'); return false; }
        }
      }
      // 3) 저장 (지우지 않았으면 같은 이름은 덮어씀 — 메모는 남김)
      const now = new Date().toISOString();
      const docs = [];
      for (let i = 0; i < list.length; i += 1) {
        const { review: _r, ...data } = list[i];
        const existing = replaceAll ? null : (knitFactories || []).find(f => sameFactoryName(f.name, data.name));
        const draft = {
          ...(existing || {}),
          ...data,
          memos: [...(existing?.memos || []), ...(data.memos || [])],
          id: existing?.id || `${newFactoryId()}_${i}`,
          createdAt: existing?.createdAt || now,
          createdBy: existing?.createdBy || who(),
          updatedAt: now,
          updatedBy: who(),
        };
        docs.push({ ...draft, geo: await tryGeocode(draft) });
      }
      const ok = await saveBatchToCloud(KNIT_FACTORY_COLLECTION, docs);
      if (ok === false) return false;
      await syncNames(docs.map(d => d.name));
      // 4) 설계서 편직처 목록 정리 — 정리본에 없고 설계서 · 생산 오더에 안 쓰인 이름만
      let removed = 0;
      if (cleanNames && removeKnittingFactoryNames) {
        const used = (n) => docs.some(d => sameFactoryName(d.name, n))
          || (designSheets || []).some(s => sameFactoryName(s?.knitting?.factory, n))
          || (orders || []).some(o => sameFactoryName(o?.steps?.knitting?.vendor, n));
        const unused = (knittingFactories || []).filter(n => !used(n));
        if (unused.length) {
          try { await removeKnittingFactoryNames(unused); removed = unused.length; } catch (e) {
            console.error('설계서 편직처 목록 정리 실패', e);
            showToast('편직처는 가져왔는데 설계서 편직처 목록 정리는 못 했어요.', 'error');
          }
        }
      }
      const noGeo = geocode ? docs.filter(d => d.addresses?.length && !d.geo).length : 0;
      showToast(`편직처 ${docs.length}곳을 가져왔어요.${removed ? ` 설계서 편직처 목록에서 안 쓰는 이름 ${removed}개를 뺐어요.` : ''}${noGeo ? ` 지도 위치를 못 찾은 곳 ${noGeo}곳은 지도에서 찍어 주세요.` : ''}`, 'success');
      return true;
    } finally {
      busyRef.current = false;
    }
  };

  /**
   * [엑셀로 내보내기] — 편직처 · 기계 · 보유 가마 · 메모 시트 4개 (2026-11-24, 개발 고도화 3단계)
   *  화면 거르기(검색 · 지역 · 계열)와 상관없이 전부. SheetJS는 App이 불러 둔 window.XLSX (다른 엑셀 내보내기와 같음)
   *  config = 기계 종류 · 계열 설정 (계열 칸). 반환: 내보냈으면 true
   */
  const exportKnitExcel = (config) => {
    const XLSX = typeof window !== 'undefined' ? window.XLSX : null;
    if (!XLSX) { showToast('엑셀 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error'); return false; }
    if (!(knitFactories || []).length) { showToast('내보낼 편직처가 없어요.', 'error'); return false; }
    try {
      const today = todayLocalISO();
      const sheets = buildKnitExportSheets(knitFactories, config, { designSheets, orders, today });
      const wb = XLSX.utils.book_new();
      sheets.forEach(s => {
        const ws = XLSX.utils.aoa_to_sheet([s.header, ...s.rows]);
        ws['!cols'] = s.widths.map(wch => ({ wch }));
        // 머리 줄에 거르기 단추 (엑셀에서 편직처 · 종류로 바로 거르기)
        if (s.rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: s.rows.length, c: s.header.length - 1 } }) };
        XLSX.utils.book_append_sheet(wb, ws, s.name);
      });
      XLSX.writeFile(wb, knitExportFileName(today));
      const [f, m, c, memo] = sheets;
      showToast(`편직처 ${f.rows.length}곳 · 기계 ${m.rows.length}줄 · 보유 가마 ${c.rows.length}줄 · 메모 ${memo.rows.length}개를 엑셀로 내보냈어요.`, 'success');
      return true;
    } catch (e) {
      console.error('편직처 엑셀 내보내기 실패', e);
      showToast('엑셀을 만들지 못했어요. 다시 해 주세요.', 'error');
      return false;
    }
  };

  return {
    saveFactory, deleteFactory, addMemo, updateMemo, deleteMemo, markChecked, setMountedGauge, saveEquipment, addCylinderFromSheet, setGeo,
    renameTypeInFactories, typeUsage, importSeed, exportKnitExcel,
  };
};
