import { useState, useRef, useMemo } from 'react';
import { todayLocalISO } from '../../utils/helpers';
import {
  makeBlankLabdip, normalizeLabdip, cleanLabdipForSave, validateLabdip, nextLdNo, ldDocId, duplicateLabdip,
  withArrival, withSend, withResults, withRedip, withColorDrop, withDropOpen, withRestoreDropped, withLegacyReopen, withStepBack,
} from '../../utils/labdipModel';

// ============================================================
// GRUBIG ERP - LAB-DIP (생산 ▾ LAB-DIP) 도메인 훅 — 2026-10-27 개편 (예전 '영업 ▾ Lab-Dip 발송')
//  - Firestore 컬렉션: labdips (예전 발송 기록도 같은 곳 — 읽을 때 새 모양으로 바꿈, 저장하면 새 모양으로)
//  - 작성 중인 의뢰는 이 훅(App)이 들고 있어서 다른 메뉴에 다녀와도 그대로
//  - 저장 안 한 변경(labdipDirty): 저장될 모양(cleanLabdipForSave)으로 비교 — 빈 컬러 줄만 늘린 건 변경 아님
//  - L/D NO.는 저장할 때 붙음 (비어 있으면 그해 다음 번호 — 26년은 GB26023부터. 직접 넣은 번호는 같은 번호가 있으면 막음)
//    새 L/D는 문서 id = L/D NO.(ldDocId)로 '없을 때만 만들기'(createDocToCloud) — 두 PC가 동시에 저장해도 번호가 겹치지 않음
//  - 진행 버튼(도착 · 발송 · 결과 · 2차 의뢰 · Drop · 되돌리기)은 누르면 바로 저장 — 그때 고쳐 둔 다른 칸도 같이 저장
//  - 계산 규칙은 utils/labdipModel.js
// ============================================================

const COLLECTION = 'labdips';
const snapshotOf = (ld) => JSON.stringify(cleanLabdipForSave(ld));

export const useLabdip = (labdips, saveDocToCloud, createDocToCloud, deleteDocFromCloud, showToast, user) => {
  const [labdipInput, setLabdipInput] = useState(() => makeBlankLabdip('factory'));
  const [editingLabdipId, setEditingLabdipId] = useState(null);
  // 마지막으로 불러오거나 저장했을 때의 모양 — 지금 값과 다르면 '저장 안 한 변경'
  const [baseline, setBaseline] = useState(() => snapshotOf(makeBlankLabdip('factory')));
  const savingRef = useRef(false); // 저장 중 잠금 (빠르게 두 번 눌러도 한 번만)

  const labdipDirty = useMemo(() => snapshotOf(labdipInput) !== baseline, [labdipInput, baseline]);
  const userName = () => user?.displayName || user?.email?.split('@')[0] || 'Unknown';
  const findDoc = (id) => (labdips || []).find(d => String(d.id) === String(id)) || null;

  // 화면에 의뢰를 띄우고 그 모양을 기준으로
  const show = (ld, id) => {
    setLabdipInput(ld);
    setEditingLabdipId(id);
    setBaseline(snapshotOf(ld));
  };

  /** 새 L/D (mode: 'factory' 공장에 의뢰 | 'direct' 바이어 발송만) */
  const newLabdip = (mode = 'factory') => show(makeBlankLabdip(mode), null);

  /** 저장된 L/D 열기 — 반환: 열었으면 true */
  const openLabdip = (id) => {
    const found = findDoc(id);
    if (!found) return false;
    show(normalizeLabdip(found), found.id);
    return true;
  };

  /** 복제 — 같은 바이어 · 원단 · 컬러로 새 의뢰 (번호 · 진행 기록 없이). 새 문서라 빈 양식 기준 → 저장 전에 나가면 물어봄 */
  const duplicateLabdipById = (id) => {
    const src = findDoc(id);
    if (!src) return false;
    const copy = duplicateLabdip(src);
    setLabdipInput(copy);
    setEditingLabdipId(null);
    setBaseline(snapshotOf(makeBlankLabdip(copy.mode)));
    showToast('복제했어요. 번호는 저장할 때 새로 붙어요.', 'success');
    return true;
  };

  /** 저장 안 한 변경 버리기 ('저장할까요?'의 [저장 안 함]) — 저장된 의뢰면 저장된 모양으로, 새 의뢰면 빈 양식으로 */
  const discardLabdip = () => {
    if (editingLabdipId && openLabdip(editingLabdipId)) return;
    newLabdip(labdipInput.mode);
  };

  /**
   * 저장 — next가 있으면(진행 버튼) 그 모양으로 저장하고 화면도 저장본으로, 없으면 지금 입력값
   * 반환: 저장된 문서 (확인에 막히거나 실패하면 null — 입력값은 그대로)
   */
  const saveLabdip = async (next = null, { message } = {}) => {
    if (savingRef.current) return null;
    const src = next || labdipInput;
    const clean = cleanLabdipForSave(src);
    const selfId = editingLabdipId || src.id || '';
    const problem = validateLabdip(clean, { labdips, selfId });
    if (problem) { showToast(problem, 'error'); return null; }

    const existing = selfId ? findDoc(selfId) : null;
    const now = new Date().toISOString();
    const who = userName();
    const base = {
      // 폼에 없는 칸(나중에 생길 칸)은 저장소 값 유지 — 예전 기록은 새 모양으로 바꿔 씀 (예전 칸은 normalize에서 옮김)
      ...(existing?.schemaVersion ? existing : {}),
      ...clean,
      authorName: existing?.authorName || src.authorName || who,
      createdAt: existing?.createdAt || src.createdAt || now,
      updatedAt: now,
      updatedBy: who,
    };

    savingRef.current = true;
    try {
      let toSave;
      let bumpedNote = '';
      if (selfId) {
        // 저장돼 있던 L/D (예전 기록 포함) — 번호: 넣은 번호 → 저장돼 있던 번호 → 그해 다음 번호 (예전 기록은 직접 넣을 때만)
        const ldNo = clean.ldNo || String(existing?.ldNo || '') || (clean.legacy ? '' : nextLdNo(labdips, clean.requestDate));
        toSave = { ...base, id: selfId, ldNo };
        const ok = await saveDocToCloud(COLLECTION, toSave);
        if (ok === false) return null; // 실패 알림은 saveDocToCloud가 띄움
      } else {
        // 새 L/D — 문서 id를 L/D NO.로 만들어 '없을 때만' 만듦. 다른 PC가 방금 그 번호를 썼으면 다음 번호로 (직접 넣은 번호면 멈춤)
        const taken = [];
        let ldNo = clean.ldNo || nextLdNo(labdips, clean.requestDate);
        for (let tries = 0; ; tries += 1) {
          toSave = { ...base, id: ldDocId(ldNo), ldNo };
          const res = await createDocToCloud(COLLECTION, toSave);
          if (res === true) break;
          if (res === false) return null; // 실패 알림은 createDocToCloud가 띄움
          if (clean.ldNo || tries >= 4) {
            showToast(`L/D NO. ${ldNo} — 같은 번호로 만든 L/D가 이미 있어요 (다른 PC에서 방금 저장했거나 번호를 바꾼 L/D). 다른 번호를 넣어 주세요.`, 'error');
            return null;
          }
          taken.push({ ldNo });
          ldNo = nextLdNo([...(labdips || []), ...taken], clean.requestDate);
          bumpedNote = ' (다른 곳에서 같은 번호를 먼저 써서 다음 번호를 붙였어요)';
        }
      }
      const { id, ldNo } = toSave;
      const saved = normalizeLabdip(toSave);
      if (next) {
        show(saved, id);
      } else {
        // 화면 입력은 그대로 — 저장을 기다리는 동안 더 넣은 값이 사라지지 않게 (번호 · id · 작성자만 채움)
        setLabdipInput(prev => ({ ...prev, id, ldNo, authorName: toSave.authorName, createdAt: toSave.createdAt }));
        setEditingLabdipId(id);
        setBaseline(snapshotOf(saved));
      }
      showToast(message || (selfId ? `${ldNo || 'L/D'} 저장했어요.` : `${ldNo} 새 L/D를 저장했어요.${bumpedNote}`), 'success');
      return toSave;
    } finally {
      savingRef.current = false;
    }
  };

  // ── 진행 버튼 — 지금 입력값에 진행을 얹어 바로 저장 ──
  const act = (mutate, message) => saveLabdip(mutate(labdipInput), { message });

  /** L/D 도착 — entries: [{ colorId, factoryNo, letters, startIdx }] */
  const recordArrival = (entries, date) =>
    act(ld => withArrival(ld, entries, date), `L/D 도착 — ${entries.length}컬러 공장 번호를 넣었어요.`);

  /** 바이어 발송 — 고른 컬러 → 컨펌대기 */
  const recordSend = (colorIds, date, method) =>
    act(ld => withSend(ld, colorIds, date, method), `바이어 발송 — ${colorIds.length}컬러를 컨펌대기로 넘겼어요.`);

  /** 바이어 결과 — entries: [{ colorId, result: 'confirm' | 'reject' | 'drop', letter, comment }] */
  const recordResults = (entries, date) => {
    const count = (k) => entries.filter(e => e.result === k).length;
    const parts = [['confirm', '컨펌'], ['reject', '리젝'], ['drop', 'Drop']]
      .filter(([k]) => count(k) > 0)
      .map(([k, label]) => `${label} ${count(k)}`);
    const tail = count('reject') > 0 ? ' — 리젝 컬러는 [2차 의뢰]로 공장에 다시 의뢰해 주세요.' : '';
    return act(ld => withResults(ld, entries, date), `바이어 결과를 넣었어요 (${parts.join(' · ')})${tail}`);
  };

  /** 다음 차수 의뢰 (리젝 → 2차) — entries: [{ colorId, requestNote, letters }], meta: { requestDate, factoryDue } */
  const requestRedip = (entries, meta) =>
    act(ld => withRedip(ld, entries, meta), `${entries.length}컬러를 공장에 다시 의뢰했어요 (공장 진행중).`);

  const dropColor = (colorId) => act(ld => withColorDrop(ld, colorId, todayLocalISO()), '컬러를 Drop했어요.');
  const dropOpenColors = () => act(ld => withDropOpen(ld, todayLocalISO()), '남은 컬러를 모두 Drop했어요.');
  const restoreDropped = () => act(withRestoreDropped, 'Drop한 컬러를 모두 되돌렸어요.');
  const reopenLegacy = () => act(withLegacyReopen, '예전 기록을 다시 진행해요 — 보낸 컬러는 컨펌대기로 넘어갔어요.');
  const stepBackColor = (colorId) => act(ld => withStepBack(ld, colorId), '한 단계 되돌렸어요.');

  /** 삭제 (복구 불가 확인) — 지금 열려 있는 의뢰면 빈 양식으로. 반환: 지웠으면 true */
  const deleteLabdip = async (id) => {
    const target = findDoc(id);
    if (!target) return false;
    const ld = normalizeLabdip(target);
    const label = [ld.ldNo || '번호 없음', ld.buyerName, ld.article].filter(Boolean).join(' · ');
    if (!window.confirm(`이 L/D를 지울까요?\n(${label})\n\n지우면 되돌릴 수 없어요. 그만둔 의뢰는 지우지 말고 [남은 컬러 Drop]으로 남겨 두세요.`)) return false;
    const ok = await deleteDocFromCloud(COLLECTION, id);
    if (ok === false) return false;
    if (String(editingLabdipId) === String(id)) newLabdip(labdipInput.mode);
    showToast('L/D를 지웠어요.', 'success');
    return true;
  };

  return {
    labdipInput, setLabdipInput, editingLabdipId, labdipDirty,
    newLabdip, openLabdip, duplicateLabdip: duplicateLabdipById, discardLabdip, saveLabdip, deleteLabdip,
    recordArrival, recordSend, recordResults, requestRedip,
    dropColor, dropOpenColors, restoreDropped, reopenLegacy, stepBackColor,
  };
};
