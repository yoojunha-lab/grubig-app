import { useMemo, useRef, useState } from 'react';
import { detectOrderType } from '../../constants/production';
import {
  normalizeOrder, createEmptyOrder,
  applyOrderField, applyFabric, applyColorPatch, addColorRow, removeColorRow, colorHasData,
  applyStepPatch, applyLots, applyDailyNote, summarizeOrderChange, isSameOrderContent, ORDER_SCHEMA_VERSION,
} from '../../utils/orderModel';
import { makeChangeLogEntry, appendChangeLog } from '../../utils/auditLog';

// GRUBIG ERP - 생산 오더 훅 (v8: 엑셀형 현황표)
// 컬렉션: orders
// ------------------------------------------------------------
// ■ 엑셀처럼 "칸 하나 수정 → 바로 저장" 방식
//   - 모든 변경은 orderModel 의 순수 함수(updater)로 새 오더를 만든 뒤 문서 통째로 저장
//   - 저장한 최신본은 overrides(낙관적 반영)에 올려두고, 서버 값에 그 저장이 들어온 게 확인될 때까지 유지
//     (확인 기준: 서버 문서 changeLog 에 우리가 남긴 이력 id 가 있는지 → PC 시계가 달라도 안전)
//   - 그래서 연속 수정·한 핸들러 안의 연속 저장도 항상 직전 수정본 위에 이어서 적용 → 앞 수정이 사라지지 않음
//   - 저장 실패 시 overrides 를 걷어내 서버 값으로 되돌림 (실패 토스트는 saveDocToCloud 가 표시)
// ■ 새 오더 줄(초안)은 order# 를 입력하는 순간 저장(등록)된다. 그 전엔 화면에만 있음

// override 가 서버 값보다 앞서 있는지 (true 면 override 를 보여줌)
//  - 서버에 없는 문서: 저장이 아직 안 끝났을 때만 (끝났는데 없으면 다른 곳에서 삭제된 것)
//  - 서버에 있는 문서: 서버 changeLog 에 우리 저장 이력이 아직 없고, 저장 후 다른 사람이 덮어쓴 것도 아닐 때
//    저장이 끝난 뒤(settled) 서버 최신 이력이 내 저장본의 이전 이력 중 하나가 아니면
//    = 내가 모르는 저장이 내 저장 뒤에 들어온 것 → 서버 값 우선 (PC 시계와 무관하게 판단)
const isOverrideAhead = (entry, base) => {
  if (!entry) return false;
  if (!base) return !entry.settled;
  const myLog = entry.order.changeLog || [];
  const baseLog = base.changeLog || [];
  const logId = myLog[0]?.id;
  if (logId && baseLog.some(e => e.id === logId)) return false;
  if (entry.settled) {
    const baseHeadId = baseLog[0]?.id;
    if (baseHeadId && !myLog.some(e => e.id === baseHeadId)) return false;
    if (String(base.updatedAt || '') > String(entry.order.updatedAt || '')) return false;
  }
  return true;
};

export const useOrder = (rawOrders, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  // Firestore 원본 → v8 구조 (레거시 오더 자동 변환 포함)
  const baseOrders = useMemo(
    () => (rawOrders || []).map(normalizeOrder).filter(o => o && o.id),
    [rawOrders]
  );

  const [overrides, setOverrides] = useState({});   // { [orderId]: { order: 저장한 최신 오더, settled: 저장 완료 여부 } }
  const overridesRef = useRef({});
  const [drafts, setDrafts] = useState([]);         // order# 입력 전 새 줄들
  const draftsRef = useRef([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // 화면용 오더 목록 = 서버 값 + 아직 서버에 반영 안 된 내 변경
  const orders = useMemo(() => {
    const baseMap = new Map(baseOrders.map(o => [o.id, o]));
    const merged = baseOrders.map(o => (isOverrideAhead(overrides[o.id], o) ? overrides[o.id].order : o));
    Object.entries(overrides).forEach(([id, entry]) => {
      if (!baseMap.has(id) && isOverrideAhead(entry, null)) merged.push(entry.order);
    });
    return merged;
  }, [baseOrders, overrides]);

  const setOverride = (id, entry) => {
    const next = { ...overridesRef.current };
    if (entry) next[id] = entry;
    else delete next[id];
    overridesRef.current = next;
    setOverrides(next);
  };

  const updateDrafts = (updater) => {
    draftsRef.current = updater(draftsRef.current);
    setDrafts(draftsRef.current);
  };

  const findDraft = (id) => draftsRef.current.find(d => d.id === id) || null;
  // 수정의 기준이 될 최신 오더: 초안 > 서버보다 앞선 내 저장본 > 서버 값
  const findLatest = (id) => {
    const draft = findDraft(id);
    if (draft) return draft;
    const base = baseOrders.find(o => o.id === id) || null;
    const entry = overridesRef.current[id];
    return isOverrideAhead(entry, base) ? entry.order : base;
  };

  // 저장 (변경 이력 자동 기록). 성공 true / 실패 false
  const persist = async (prev, next, action = 'order_update') => {
    let summary = action === 'order_create'
      ? `오더 등록 (${next.orderNumber})`
      : summarizeOrderChange(prev, next);
    // 요약에 안 잡히는 변경도 조용히 버리지 않고 저장 (이력은 '수정'으로)
    if (!summary && !isSameOrderContent(prev, next)) summary = '수정';
    if (!summary) return true; // 바뀐 게 없으면 저장 생략

    let toSave = { ...next, schemaVersion: ORDER_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
    toSave = appendChangeLog(toSave, makeChangeLogEntry(user?.email, action, summary));

    const entry = { order: toSave, settled: false };
    setOverride(toSave.id, entry);
    let ok = false;
    try {
      ok = (await saveDocToCloud('orders', toSave)) !== false;
    } catch {
      ok = false;
    }
    // 그 사이 더 최신 수정이 없을 때만 정리 (있으면 그 수정의 저장이 마무리)
    if (overridesRef.current[toSave.id] === entry) {
      if (ok) setOverride(toSave.id, { order: toSave, settled: true }); // 서버 값이 따라오면 자동으로 무시됨
      else setOverride(toSave.id, null);                                 // 실패 → 서버 값으로 되돌림
    }
    return ok;
  };

  /**
   * 오더 하나를 updater(오더) => 새 오더 로 수정하고 저장.
   * 초안(새 줄)은 order# 가 생기는 순간 등록 저장된다.
   */
  const updateOrder = async (id, updater) => {
    const draft = findDraft(id);
    const prev = draft || findLatest(id);
    if (!prev) return false;
    let next = updater(prev);
    if (!next || next === prev) return true;

    // order# 검증 + 구분(메인/샘플) 자동 선택
    if (next.orderNumber !== prev.orderNumber) {
      const no = next.orderNumber;
      if (!no && !draft) {
        showToast('order#는 비워둘 수 없어요.', 'error');
        return false;
      }
      if (no && orders.some(o => o.id !== id && o.orderNumber === no)) {
        showToast(`order# '${no}'는 이미 등록되어 있어요.`, 'error');
        return false;
      }
      const detected = detectOrderType(no);
      if (detected) next = { ...next, type: detected };
    }

    if (draft) {
      if (!next.orderNumber) {
        updateDrafts(list => list.map(d => (d.id === id ? next : d)));
        return true;
      }
      const now = new Date().toISOString();
      const created = { ...next, createdBy: user?.email || next.createdBy || '', createdAt: now };
      updateDrafts(list => list.filter(d => d.id !== id));
      const ok = await persist(prev, created, 'order_create');
      if (ok) showToast(`오더 '${created.orderNumber}' 등록`, 'success');
      else updateDrafts(list => [...list, next]); // 실패하면 입력한 줄을 되살림
      return ok;
    }

    return persist(prev, next);
  };

  // ---------- 편의 액션 (현황표·간트·상세창 공용) ----------
  const setOrderField = (id, field, value) => updateOrder(id, o => applyOrderField(o, field, value));
  const setFabric = (id, fabric) => updateOrder(id, o => applyFabric(o, fabric));
  const setColorField = (id, colorId, patch) => updateOrder(id, o => applyColorPatch(o, colorId, patch));
  const setStep = (id, stepKey, patch) => updateOrder(id, o => applyStepPatch(o, stepKey, patch));
  const setLots = (id, colorId, lots) => updateOrder(id, o => applyLots(o, colorId, lots));
  const setDailyNote = (id, note) => updateOrder(id, o => applyDailyNote(o, note));

  // 컬러 줄 추가 → 새 컬러 id 반환 (저장은 뒤에서 진행)
  const addColor = (id, afterColorId = null) => {
    let newColorId = null;
    updateOrder(id, o => {
      const r = addColorRow(o, afterColorId);
      newColorId = r.colorId;
      return r.order;
    });
    return newColorId;
  };

  const removeColor = (id, colorId) => {
    const o = findLatest(id);
    const c = (o?.colors || []).find(x => x.id === colorId);
    if (!c) return Promise.resolve(false);
    if (colorHasData(c)) {
      const ok = window.confirm(`컬러 '${c.name || '(이름 없음)'}' 줄을 삭제할까요?\nLOT·컨펌·출고 입력 내용도 함께 지워져요.`);
      if (!ok) return Promise.resolve(false);
    }
    return updateOrder(id, ord => removeColorRow(ord, colorId));
  };

  // 새 오더 줄 추가 → 초안 id 반환
  const addDraftOrder = () => {
    const d = createEmptyOrder(user?.email);
    updateDrafts(list => [...list, d]);
    return d.id;
  };

  const discardDraft = (id) => updateDrafts(list => list.filter(d => d.id !== id));

  const deleteOrder = async (id) => {
    if (findDraft(id)) {
      discardDraft(id);
      return true;
    }
    const o = findLatest(id);
    if (!o) return false;
    const ok = window.confirm(
      `'${o.orderNumber || '이 오더'}'를 삭제할까요?\n입력한 공정·LOT·메모가 모두 지워지고 되돌릴 수 없어요.`
    );
    if (!ok) return false;
    setOverride(id, null);
    // deleteDocFromCloud 가 false 를 돌려주면(또는 예외) 실패 → 성공 토스트로 실패 토스트를 덮지 않음
    let deleted = false;
    try {
      deleted = (await deleteDocFromCloud('orders', id)) !== false;
    } catch {
      deleted = false;
    }
    if (!deleted) return false;
    setSelectedOrderId(cur => (cur === id ? null : cur));
    showToast('오더를 삭제했어요.', 'success');
    return true;
  };

  return {
    orders,          // v8 구조로 정규화된 저장된 오더 (저장 중 변경 반영)
    drafts,          // 아직 order# 가 없는 새 줄
    selectedOrderId, setSelectedOrderId,
    orderActions: {
      updateOrder,
      setOrderField, setFabric,
      setColorField, addColor, removeColor,
      setStep, setLots, setDailyNote,
      addDraftOrder, discardDraft, deleteOrder,
    },
  };
};
