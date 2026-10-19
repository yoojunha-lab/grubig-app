import { useMemo, useRef, useState } from 'react';
import { detectOrderType } from '../../constants/production';
import {
  normalizeOrder, createEmptyOrder,
  applyOrderField, applyFabric, applyColorPatch, addColorRow, removeColorRow, colorHasData,
  applyStepPatch, applyLots, applyDailyNote, applyProvisionalDue, applyGreigeOuts, fillOrderFromSheet,
  applyColorTracks, addColorTrackEvent,
  applyDyeMethod, applyOrderGreigeOuts, applyOrderSpec, applyLotInspections, addLotInspectionEvent, applyClosing,
  applyYarn, addYarnOrderEvent,
  applyOrderKind, getOrderKind, getOrderKindMeta, isItemMissing, isSheetMissing, applySkip,
  summarizeOrderChange, isSameOrderContent, ORDER_SCHEMA_VERSION,
} from '../../utils/orderModel';
import { makeChangeLogEntry, appendChangeLog } from '../../utils/auditLog';
import { todayYmd } from '../../utils/orderCalculations';

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
// ■ 구분(메인 · 신제품 · 재샘플 — 대표님 요청 2026-10-19)은 새 줄을 만들 때 고르고, 저장되면 잠김
//   저장된 오더의 구분은 changeOrderKind([구분 바꾸기] 창 — 사유) · 설계서 연결(→ 신제품)로만 바뀜 (updateOrder 가 막음)
//   재샘플은 아이템(원단 관리 원단)을 골라야 '완료' (마무리 체크 자동 완료도 안 함)

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

// stepDefs: 공정 목록 (기본 + 대표님이 추가한 공정 — 변경 이력에 추가 공정 이름을 쓰려고)
export const useOrder = (rawOrders, saveDocToCloud, deleteDocFromCloud, showToast, user, stepDefs = undefined) => {
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
  // note: 이력 앞에 붙일 까닭 (예: '설계서 아이템화 — 오더상태 진행중→완료')
  const persist = async (prev, next, action = 'order_update', note = '') => {
    let summary = action === 'order_create'
      ? `오더 등록 (${next.orderNumber})`
      : summarizeOrderChange(prev, next, stepDefs);
    // 요약에 안 잡히는 변경도 조용히 버리지 않고 저장 (이력은 '수정'으로)
    if (!summary && !isSameOrderContent(prev, next)) summary = '수정';
    if (!summary) return true; // 바뀐 게 없으면 저장 생략
    if (note) summary = `${note} — ${summary}`;

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
   * opts.note: 변경 이력 앞에 붙일 까닭 (설계서 쪽에서 바꾼 경우 등)
   * opts.allowKind: 저장된 오더의 구분을 바꿔도 됨 — [구분 바꾸기] 창(changeOrderKind) · 설계서 연결(→ 신제품)만
   */
  const updateOrder = async (id, updater, { note = '', allowKind = false } = {}) => {
    const draft = findDraft(id);
    const prev = draft || findLatest(id);
    if (!prev) return false;
    // 이 화면보다 새 형식으로 저장된 오더 — 고치면 새 칸이 지워질 수 있어서 막음 (다른 PC가 새 버전으로 저장)
    if (prev.newerSchema) {
      showToast('이 오더는 새 버전 화면에서 저장됐어요. 새로고침(F5)한 뒤 다시 고쳐 주세요.', 'error');
      return false;
    }
    const next = updater(prev);
    if (!next || next === prev) return true;

    // 구분(메인 · 신제품 · 재샘플)은 만들 때 정하고 잠김 (대표님 요청 2026-10-19 '샘플/메인을 함부로 바꿀 수 있으면 안 됨')
    //  · 설계서와 연결된 신제품은 [구분 바꾸기]로도 안 됨 — 메인·재샘플이 되면 설계서 아이템화·Drop 때 그 오더가 엉뚱하게 닫힘 (2026-10-10)
    //  · 그 밖의 저장된 오더는 [구분 바꾸기] 창(사유) · 설계서 연결로만 (allowKind)
    if (!draft && getOrderKind(prev) !== getOrderKind(next)) {
      if (prev.linkedSheetId && getOrderKind(next) !== 'new') {
        showToast('설계서와 연결된 신제품 샘플은 구분을 바꿀 수 없어요. 샘플을 그만두려면 ⋯ 메뉴의 Drop을 써 주세요.', 'error');
        return false;
      }
      if (!allowKind) {
        showToast('구분(메인 · 신제품 · 재샘플)은 오더를 만들 때 정해요. 바꾸려면 ⋯ 메뉴 [구분 바꾸기]에서 사유와 같이 바꿔 주세요.', 'error');
        return false;
      }
    }

    // 재샘플은 아이템(원단 관리 원단)을 골라야 '완료' (대표님 결정 2026-10-19 — 어느 화면에서 완료해도 같게)
    if (!draft && next.status === 'completed' && prev.status !== 'completed' && isItemMissing(next)) {
      showToast('재샘플은 article# 칸에서 기존 아이템(원단 관리)을 골라야 완료할 수 있어요.', 'error');
      return false;
    }

    // order# 검증 — 구분은 order# 를 바꿔도 그대로 (2026-10-19 부터 S/M 을 보고 저절로 바꾸지 않음)
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
      // 새 줄: 고른 구분과 order# 의 S/M 이 다르면 등록 전에 한 번 묻기 (취소 = 저장 안 함 → order#·구분을 다시 고를 수 있음)
      const detected = draft && no ? detectOrderType(no) : null;
      if (detected && detected !== next.type) {
        const ok = window.confirm(
          `order# '${no}'는 ${detected === 'sample' ? '샘플(S)' : '메인(M)'} 번호인데 구분을 '${getOrderKindMeta(next).menuLabel}'(으)로 골랐어요.\n\n`
          + '이대로 등록할까요? 등록하면 구분은 잠겨요.\n(취소하면 order#를 다시 넣거나 구분을 바꿀 수 있어요)'
        );
        if (!ok) return false;
      }
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

    return persist(prev, next, 'order_update', note);
  };

  // ---------- 설계서 ↔ 샘플 오더 (대표님 요청 2026-10-10 — 설계서 진행 = 샘플 → 생산 현황에서 관리) ----------
  // 최신 오더 목록 (서버 값 + 아직 반영 안 된 내 저장본) — 연달아 저장할 때도 방금 만든 오더까지 보고 찾음
  const latestOrders = () => {
    const map = new Map(baseOrders.map(o => [o.id, o]));
    Object.entries(overridesRef.current).forEach(([id, entry]) => {
      if (isOverrideAhead(entry, map.get(id) || null)) map.set(id, entry.order);
    });
    return [...map.values()];
  };
  const findBySheet = (sheetId) => (sheetId
    ? latestOrders().find(o => String(o.linkedSheetId || '') === String(sheetId)) || null
    : null);

  // 같은 order# 의 메인 오더를 설계서 샘플 오더로 끌어오면 안 됨 — 연결하면 샘플로 바뀌고, 설계서 Drop·아이템화 때
  //  그 메인 오더가 닫혀 버림 (설계서 EZ-TEX 칸에 메인 오더 번호를 잘못 넣은 경우, 2026-10-10)
  const mainOrderMessage = (no) =>
    `생산 현황에 order# '${no}' 메인 오더가 있어요. 샘플 EZ-TEX O/D NO.가 맞는지 확인해 주세요. `
    + "(그 오더가 사실 신제품 샘플이면 생산 현황 ⋯ 메뉴 [구분 바꾸기]로 '신제품'으로 바꾼 뒤 다시 등록)";
  // 재샘플(기존 아이템을 한 번 더) 오더도 끌어오지 않음 — 설계서에서 오는 샘플은 신제품 (대표님 요청 2026-10-19)
  const resampleOrderMessage = (no) =>
    `생산 현황 order# '${no}'는 재샘플(기존 아이템) 오더예요. 신제품 설계서의 EZ-TEX O/D NO.가 맞는지 확인해 주세요. `
    + "(그 오더가 사실 신제품이면 생산 현황 ⋯ 메뉴 [구분 바꾸기]로 '신제품'으로 바꾼 뒤 다시 등록)";

  /**
   * EZ-TEX O/D NO. 를 이 설계서에 등록해도 되는지 — 설계서를 저장하기 전에 확인 (막히면 설계서도 저장하지 않음)
   *  - 그 order# 오더가 다른 설계서(아직 있는)와 연결돼 있으면 안 됨
   *  - 연결 안 된 메인 · 재샘플 오더면 안 됨 (위 mainOrderMessage · resampleOrderMessage)
   *  - 이 설계서와 연결된 오더의 번호를 바꾸는데 그 번호의 다른 오더가 이미 있으면 안 됨
   *    (새 설계서 = 아직 id 가 없어 연결된 오더도 없음 — 예전엔 '연결 안 된 아무 오더'를 연결된 오더로 잘못 봐서 막혔음)
   * 반환: 막는 까닭 ('' = 괜찮음)
   */
  const checkEztexConflict = (sheet, eztexNo, { sheetExists = () => true } = {}) => {
    const no = String(eztexNo || '').trim().toUpperCase();
    if (!sheet || !no) return '';
    const list = latestOrders();
    const same = list.find(o => o.orderNumber === no);
    if (!same) return '';
    if (same.linkedSheetId && String(same.linkedSheetId) !== String(sheet.id || '') && sheetExists(same.linkedSheetId)) {
      return `생산 현황 오더 '${no}'는 이미 다른 설계서와 연결돼 있어요. EZ-TEX O/D NO.를 확인해 주세요.`;
    }
    if (!same.linkedSheetId && same.type === 'main') return mainOrderMessage(no);
    if (!same.linkedSheetId && getOrderKind(same) === 'resample') return resampleOrderMessage(no);
    const linked = sheet.id ? list.find(o => String(o.linkedSheetId || '') === String(sheet.id)) : null;
    if (linked && linked.id !== same.id) {
      return `생산 현황에 order# '${no}' 오더가 이미 있어요 (이 설계서의 샘플 오더는 ${linked.orderNumber}). EZ-TEX O/D NO.를 확인해 주세요.`;
    }
    return '';
  };

  /**
   * 설계서 EZ-TEX O/D NO. → 생산 현황 샘플 오더 (만들기 / 연결 / 번호 따라 바꾸기) — 설계서에서 오는 샘플은 모두 신제품
   *  - 이 설계서와 이미 연결된 오더: EZ-TEX 번호를 고쳤고 오더 order# 가 예전 번호 그대로면 order# 도 바꿈
   *  - 아이템화·Drop된 설계서: 새로 만들거나 연결하지 않음 ('skipped' — 끝난 샘플이 '진행중' 오더로 생기지 않게)
   *  - 같은 order# 오더가 있으면 새로 만들지 않고 연결 (빈 칸만 설계서 값으로 + 신제품 — 생산 현황에서 만든 신제품 ·
   *    종류 미정 샘플). 다른 설계서와 연결된 오더 · 메인 · 재샘플 오더면 거절
   *  - 없으면 새 샘플 오더(신제품) 등록
   *  알림은 부른 쪽(설계서 훅)이 설계서 저장 알림과 합쳐서 띄움 — 여기선 결과만 돌려줌
   * opts: { buyerName, prevEztexNo, sheetExists(id) — 다른 설계서가 아직 있는지 (지워진 설계서 연결은 무시) }
   * 반환: { ok, action: 'created'|'linked'|'renamed'|'exists'|'skipped'|'conflict'|'failed', orderId?, orderNumber?, message? }
   */
  const linkSampleOrderFromSheet = async (sheet, { buyerName = '', prevEztexNo = '', sheetExists = () => true } = {}) => {
    const no = String(sheet?.eztexOrderNo || '').trim().toUpperCase();
    if (!sheet?.id || !no) return { ok: false, action: 'failed' };
    const list = latestOrders();

    const linked = list.find(o => String(o.linkedSheetId || '') === String(sheet.id));
    if (linked) {
      const prevNo = String(prevEztexNo || '').trim().toUpperCase();
      if (linked.orderNumber === no || !prevNo || linked.orderNumber !== prevNo) {
        return { ok: true, action: 'exists', orderId: linked.id, orderNumber: linked.orderNumber };
      }
      if (list.some(o => o.id !== linked.id && o.orderNumber === no)) {
        return {
          ok: false, action: 'conflict', orderId: linked.id, orderNumber: linked.orderNumber,
          message: `생산 현황에 order# '${no}'가 이미 있어서, 연결된 샘플 오더(${linked.orderNumber}) 번호는 그대로 뒀어요.`,
        };
      }
      const ok = await updateOrder(linked.id, o => applyOrderField(o, 'orderNumber', no), { note: '설계서 EZ-TEX O/D NO. 수정' });
      return ok
        ? { ok: true, action: 'renamed', orderId: linked.id, orderNumber: no }
        : { ok: false, action: 'failed', orderId: linked.id, orderNumber: linked.orderNumber };
    }

    // 아이템화·Drop된 설계서 — 샘플은 이미 끝남 (설계서 창에서 번호만 적어 넣은 경우)
    if (sheet.status === 'dropped' || sheet.stage === 'articled') {
      return { ok: true, action: 'skipped', orderNumber: no };
    }

    const same = list.find(o => o.orderNumber === no);
    if (same) {
      if (same.linkedSheetId && String(same.linkedSheetId) !== String(sheet.id) && sheetExists(same.linkedSheetId)) {
        return {
          ok: false, action: 'conflict', orderId: same.id, orderNumber: no,
          message: `생산 현황 오더 '${no}'는 이미 다른 설계서와 연결돼 있어요. 생산 현황에서 확인해 주세요.`,
        };
      }
      if (!same.linkedSheetId && same.type === 'main') {
        return { ok: false, action: 'conflict', orderId: same.id, orderNumber: no, message: mainOrderMessage(no) };
      }
      if (!same.linkedSheetId && getOrderKind(same) === 'resample') {
        return { ok: false, action: 'conflict', orderId: same.id, orderNumber: no, message: resampleOrderMessage(no) };
      }
      // 종류 미정 샘플 → 신제품 (설계서와 연결되는 샘플 = 신제품) — 구분이 바뀌므로 allowKind
      const ok = await updateOrder(
        same.id,
        o => fillOrderFromSheet(o, sheet, { buyerName, onlyEmpty: true }),
        { note: '설계서 EZ-TEX O/D NO. 등록', allowKind: true }
      );
      return ok
        ? { ok: true, action: 'linked', orderId: same.id, orderNumber: no }
        : { ok: false, action: 'failed', orderId: same.id, orderNumber: no };
    }

    const created = {
      ...fillOrderFromSheet({ ...createEmptyOrder(user?.email), orderNumber: no }, sheet, { buyerName }),
      createdBy: user?.email || '',
      createdAt: new Date().toISOString(),
    };
    const ok = await persist(null, created, 'order_create', '설계서 EZ-TEX O/D NO. 등록');
    return ok
      ? { ok: true, action: 'created', orderId: created.id, orderNumber: no }
      : { ok: false, action: 'failed', orderNumber: no };
  };

  // 설계서 아이템화 → 연결된 샘플 오더: article# = 그 원단(보관함 연결) + '완료'. 연결된 오더가 없으면 null
  //  closed: 이번에 완료로 닫았는지 (이미 완료였으면 false) / changed: 무엇이든 바꿨는지 (false 면 알림에 안 붙임)
  const markSheetOrderArticled = async (sheetId, fabric) => {
    const o = findBySheet(sheetId);
    if (!o) return null;
    const closed = o.status !== 'completed' || !!o.dropInfo;
    const relinked = !!fabric && String(o.linkedFabricId || '') !== String(fabric.id || '');
    // closingAuto(마무리 체크로 자동 완료) 표시는 지움 — 아이템화로 닫힌 오더가 마무리 체크를 풀었다고 다시 열리지 않게
    //  (이미 완료였고 연결도 같아서 그 표시만 지우는 경우는 알림에 안 붙임 — changed: false)
    const clearAuto = !!o.closingAuto;
    if (!closed && !relinked && !clearAuto) return { ok: true, changed: false, closed: false, orderNumber: o.orderNumber };
    const ok = await updateOrder(
      o.id,
      ord => ({ ...(fabric ? applyFabric(ord, fabric) : ord), status: 'completed', dropInfo: null, closingAuto: null }),
      { note: '설계서 아이템화' }
    );
    return { ok, changed: closed || relinked, closed, orderNumber: o.orderNumber };
  };

  // 설계서 Drop → 샘플 오더를 '완료'로 닫고 Drop 표시 (dropInfo: Drop 전 상태 — 복원하면 그 상태로). 연결된 오더가 없으면 null
  //  이미 '완료'였던 오더도 Drop 표시는 붙임 (리포트에서 완료가 아니라 Drop 으로 셈)
  //  changed: 실제로 바꿨는지 (이미 Drop 으로 닫혀 있었으면 false → 알림에 안 붙임)
  const closeSheetOrderOnDrop = async (sheetId) => {
    const o = findBySheet(sheetId);
    if (!o) return null;
    if (o.status === 'completed' && o.dropInfo) return { ok: true, changed: false, orderNumber: o.orderNumber };
    const at = new Date().toISOString();
    // closingAuto 도 지움 — Drop 된 샘플은 설계서 복원으로만 다시 열림 (마무리 체크를 풀어도 그대로)
    const ok = await updateOrder(
      o.id,
      ord => ({ ...ord, status: 'completed', dropInfo: { prevStatus: ord.status, at }, closingAuto: null }),
      { note: '설계서 Drop' }
    );
    return { ok, changed: true, orderNumber: o.orderNumber };
  };

  // 설계서 복원 → Drop 으로 닫혔던 샘플 오더를 Drop 전 상태로 (진행중·보류·완료). 연결된 오더가 없으면 null
  //  Drop 으로 닫힌 게 아니면(생산 현황에서 직접 완료한 오더 등) 그대로 둠
  //  status: 돌려놓은 오더상태 (알림 문구용)
  const reopenSheetOrder = async (sheetId) => {
    const o = findBySheet(sheetId);
    if (!o) return null;
    if (!(o.status === 'completed' && o.dropInfo)) return { ok: true, changed: false, orderNumber: o.orderNumber, status: o.status };
    const status = o.dropInfo.prevStatus || 'active';
    const ok = await updateOrder(o.id, ord => ({ ...ord, status, dropInfo: null, closingAuto: null }), { note: '설계서 복원' });
    return { ok, changed: true, orderNumber: o.orderNumber, status };
  };

  // 설계서 삭제 → 연결만 풀기 (오더는 남김)
  const unlinkSheetOrder = async (sheetId) => {
    const o = findBySheet(sheetId);
    if (!o) return null;
    const ok = await updateOrder(o.id, ord => ({ ...ord, linkedSheetId: null }), { note: '설계서 삭제' });
    return { ok, orderNumber: o.orderNumber };
  };

  // ---------- 편의 액션 (현황표·간트·상세창 공용) ----------
  const setOrderField = (id, field, value) => updateOrder(id, o => applyOrderField(o, field, value));
  const setFabric = (id, fabric) => updateOrder(id, o => applyFabric(o, fabric));
  const setColorField = (id, colorId, patch) => updateOrder(id, o => applyColorPatch(o, colorId, patch));
  const setStep = (id, stepKey, patch) => updateOrder(id, o => applyStepPatch(o, stepKey, patch));
  const setLots = (id, colorId, lots) => updateOrder(id, o => applyLots(o, colorId, lots));
  // 생지 출고 기록 (입력 창 — base: 열 때 목록, 지금 저장된 목록과 합침) / 한 줄만 출고 체크 (현황표·상세창 칸 — 날짜가 비었으면 오늘)
  const setGreigeOuts = (id, colorId, entries, base = undefined) => updateOrder(id, o => applyGreigeOuts(o, colorId, entries, base));
  const setGreigeOutDone = (id, colorId, entryId, done) => updateOrder(id, o => {
    const color = (o.colors || []).find(c => c.id === colorId);
    if (!color) return o;
    const entries = (color.greigeOuts || []).map(g => (
      g.id === entryId ? { ...g, done, date: done && !g.date ? todayYmd() : g.date } : g
    ));
    return applyGreigeOuts(o, colorId, entries);
  });
  const setDailyNote = (id, note) => updateOrder(id, o => applyDailyNote(o, note));
  // 컬러 상태 기록 (시험성적서 · 브랜드 컨펌) — 입력 창은 통째로 / 표 칸 드롭다운은 그날 날짜로 한 줄 더함
  const setColorTracks = (id, colorId, patch) => updateOrder(id, o => applyColorTracks(o, colorId, patch));
  const addTrackEvent = (id, colorId, track, status) => updateOrder(id, o => addColorTrackEvent(o, colorId, track, status));
  // 가납기 { yarn, knitting, dyeing, visual_inspection } (+ plan: 가납기 일수 { base, days } — 주면 같이 저장)
  const setProvisionalDue = (id, patch, plan = undefined) => updateOrder(id, o => applyProvisionalDue(o, patch, plan));

  // ---------- v10 (대표님 요청 2026-10-14) ----------
  // 염색 방식 (선염 / 후염) — 후염으로 바꾸면 컬러별 출고 기록을 같은 날짜끼리 합쳐 오더 출고로
  const setDyeMethod = (id, method) => updateOrder(id, o => applyDyeMethod(o, method));
  // 후염 오더 생지 출고 (오더 전체) — 입력 창은 base 와 합침 / 표 칸 체크는 한 줄만 (날짜가 비었으면 오늘)
  const setOrderGreigeOuts = (id, entries, base = undefined) => updateOrder(id, o => applyOrderGreigeOuts(o, entries, base));
  const setOrderGreigeOutDone = (id, entryId, done) => updateOrder(id, o => applyOrderGreigeOuts(o, (o.greigeOuts || []).map(g => (
    g.id === entryId ? { ...g, done, date: done && !g.date ? todayYmd() : g.date } : g
  ))));
  // 원단 스펙 직접 넣기 (LOT 창 — 예상 YD 환산용) { gsm?, widthFull? }
  const setOrderSpec = (id, spec) => updateOrder(id, o => applyOrderSpec(o, spec));
  // LOT 외관검사 — 입력 창 { [lotId]: { rounds, base } } / 표 칸 드롭다운은 지금 차수에 그날 날짜로 한 줄 ('재가공'이면 다음 차수)
  const setLotInspections = (id, colorId, patchByLot) => updateOrder(id, o => applyLotInspections(o, colorId, patchByLot));
  const addLotInspection = (id, colorId, lotId, status) => updateOrder(id, o => addLotInspectionEvent(o, colorId, lotId, status));
  // 오더 마무리 체크 { yarnStock: { done?, date?, memo? }, … } — 3개가 다 되면 자동 '완료', 자동 완료를 체크 해제하면 다시 진행
  //  재샘플인데 아이템을 안 골랐으면 체크만 저장하고 자동 완료는 안 함 (아이템을 골라야 완료 — 2026-10-19)
  const setClosing = async (id, patchByKey) => {
    const before = findLatest(id);
    let after = null;
    let heldForItem = false;
    const ok = await updateOrder(id, o => {
      after = applyClosing(o, patchByKey);
      if (after.status === 'completed' && o.status !== 'completed' && isItemMissing(after)) {
        after = { ...after, status: o.status, dropInfo: o.dropInfo ?? null, closingAuto: o.closingAuto ?? null };
        heldForItem = true;
      }
      return after;
    });
    if (ok && heldForItem) {
      showToast(`마무리 체크는 저장했어요. '${before?.orderNumber || ''}'는 재샘플이라 article# 칸에서 아이템(원단 관리)을 골라야 완료돼요.`, 'info');
    }
    if (ok && before && after && before.status !== after.status) {
      if (after.status === 'completed') {
        // 출고가 안 끝난 컬러가 있으면 같이 알려 줌 (완료는 그대로 — 대표님 결정: 마무리 3개 = 최종 마무리)
        //  설계서가 없는 신제품이면 그것도 (설계서가 있어야 아이템화 — ⋯ 메뉴에서 붙이면 '아이템화 대기')
        const unshipped = (after.colors || []).filter(c => colorHasData(c) && !c.shipDone).length;
        const noSheet = isSheetMissing(after);
        showToast(
          `마무리 체크 3개 끝 — '${before.orderNumber}' 오더를 완료로 바꿨어요. (체크를 풀면 다시 진행중)`
          + (unshipped ? ` ⚠ 출고가 안 끝난 컬러 ${unshipped}개가 있어요.` : '')
          + (noSheet ? ' ⚠ 신제품인데 설계서가 없어요 — 아이템화하려면 ⋯ 메뉴에서 설계서를 붙여 주세요.' : ''),
          unshipped || noSheet ? 'info' : 'success'
        );
      } else {
        showToast(`마무리 체크를 풀어서 '${before.orderNumber}' 오더를 다시 ${after.status === 'on_hold' ? '보류' : '진행중'}으로 돌렸어요.`, 'info');
      }
    }
    return ok;
  };

  // 컨펌 · 성적서 / 외관검사 '안 함' (오더 전체 — 대표님 요청 2026-10-19) { confirm?, inspection? } — 바로 저장
  //  편직 [재고 사용](생지 재고)은 편직 공정 칸 값 → setStep(id, 'knitting', { stock })
  const setSkip = (id, patch) => updateOrder(id, o => applySkip(o, patch));

  // ---------- v11 원사 (대표님 요청 2026-10-14) ----------
  // 원사 창 { yarnStock?, yarnOrders?, yarnOrdersBase? } (base 를 주면 지금 저장된 사종 줄과 합침) — 원사염색은 setStep('yarn_dyeing')
  const setYarn = (id, patch) => updateOrder(id, o => applyYarn(o, patch));
  // 사종 상태 드롭다운 (현황표 칸 · 상세창 — 그날 날짜로 기록)
  const addYarnEvent = (id, yarnId, status) => updateOrder(id, o => addYarnOrderEvent(o, yarnId, status));

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
      const ok = window.confirm(`컬러 '${c.name || '(이름 없음)'}' 줄을 삭제할까요?\n생지 출고·LOT·컨펌·시험성적서·외관검사·출고 입력 내용도 함께 지워져요.`);
      if (!ok) return Promise.resolve(false);
    }
    return updateOrder(id, ord => removeColorRow(ord, colorId));
  };

  // 새 오더 줄 추가 → 초안 id 반환
  //  kind: [+ 오더 추가] 메뉴에서 고른 구분 'main' | 'new'(신제품) | 'resample'(재샘플)
  const addDraftOrder = (kind = 'main') => {
    const d = createEmptyOrder(user?.email, kind);
    updateDrafts(list => [...list, d]);
    return d.id;
  };

  // 새 줄(order# 입력 전) 구분 바꾸기 — 저장되기 전까지만 (저장된 오더는 changeOrderKind)
  const setDraftKind = (id, kind) => {
    if (!findDraft(id)) return Promise.resolve(false);
    return updateOrder(id, o => applyOrderKind(o, kind));
  };

  // [구분 바꾸기] 창 (⋯ 메뉴 · 상세창 — 대표님 요청 2026-10-19): 사유를 변경 이력에 남김
  //  종류 미정 샘플(예전 오더)에 처음 고르는 것만 사유 없이도 됨
  //  설계서와 연결된 신제품은 updateOrder 가 막음
  const changeOrderKind = (id, kind, reason = '') => {
    const prev = findLatest(id);
    if (!prev) return Promise.resolve(false);
    const first = getOrderKind(prev) === 'unknown';
    const why = String(reason || '').trim();
    if (!first && !why) {
      showToast('구분을 바꾸는 사유를 적어 주세요. (변경 이력에 남아요)', 'error');
      return Promise.resolve(false);
    }
    const note = first ? `샘플 종류 정함${why ? ` (사유: ${why})` : ''}` : `구분 변경 (사유: ${why})`;
    return updateOrder(id, o => applyOrderKind(o, kind), { note, allowKind: true });
  };

  const discardDraft = (id) => updateDrafts(list => list.filter(d => d.id !== id));

  // opts.note: 확인 창에 덧붙일 말 (설계서 샘플 오더 — 지우면 설계서가 어떻게 되는지, OrderListPage)
  const deleteOrder = async (id, { note = '' } = {}) => {
    if (findDraft(id)) {
      discardDraft(id);
      return true;
    }
    const o = findLatest(id);
    if (!o) return false;
    const ok = window.confirm(
      `'${o.orderNumber || '이 오더'}'를 삭제할까요?\n입력한 공정·LOT·메모가 모두 지워지고 되돌릴 수 없어요.${note ? `\n\n${note}` : ''}`
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
      setStep, setLots, setGreigeOuts, setGreigeOutDone, setDailyNote, setProvisionalDue,
      setColorTracks, addTrackEvent,
      setDyeMethod, setOrderGreigeOuts, setOrderGreigeOutDone, setOrderSpec,
      setLotInspections, addLotInspection, setClosing, setSkip,
      setYarn, addYarnEvent,
      addDraftOrder, setDraftKind, changeOrderKind, discardDraft, deleteOrder,
    },
    // 설계서 ↔ 샘플 오더 (App 이 설계서 훅에 연결)
    sheetOrderLink: {
      checkEztexConflict,
      linkSampleOrderFromSheet,
      markSheetOrderArticled,
      closeSheetOrderOnDrop,
      reopenSheetOrder,
      unlinkSheetOrder,
    },
  };
};
