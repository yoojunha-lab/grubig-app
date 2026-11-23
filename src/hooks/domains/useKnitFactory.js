import { useRef } from 'react';
import {
  KNIT_FACTORY_COLLECTION, cleanFactoryForSave, machinesChanged, sameFactoryName,
} from '../../utils/knitFactoryModel';
import { todayLocalISO } from '../../utils/helpers';

// ============================================================
// GRUBIG ERP - 편직처 기계 현황 (개발 ▾ 편직처 기계 현황) 도메인 훅 — 대표님 요청 2026-11-23
//  - Firestore 컬렉션: knitFactories — 저장 · 삭제 · 메모 · 확인일 · 엑셀 가져오기 (회사 공통)
//  - 문서 모양·계산은 utils/knitFactoryModel.js
//  - 저장하면 편직처 이름을 설계서 편직처 목록(settings/general.knittingFactories)에도 넣음 (대표님 결정 2026-11-23)
//    · 이름을 바꿔도 예전 이름은 목록에 남김 (그 이름으로 적힌 설계서가 있을 수 있어서)
//  - 기계 줄을 고쳐 저장하면 '확인일'이 오늘로 (기계 현황을 확인하고 고친 것으로 봄)
//  - 메모 · [오늘 확인함]은 누르면 바로 저장 (입력 창 밖)
// ============================================================

const newFactoryId = () => `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const newMemoId = () => `kmemo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const useKnitFactory = ({
  knitFactories, designSheets, saveDocToCloud, saveBatchToCloud, deleteDocFromCloud, showToast, user, addKnittingFactoryNames,
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

  // 한 문서의 몇 칸만 바꿔 저장 (메모 · 확인일) — 문서를 통째로 덮어쓰므로 기존 문서를 깔고 얹음 (저장 규약)
  const patchFactory = async (id, fields) => {
    const existing = findFactory(id);
    if (!existing) { showToast('편직처를 찾을 수 없어요. 다른 곳에서 지웠을 수 있어요.', 'error'); return false; }
    const ok = await saveDocToCloud(KNIT_FACTORY_COLLECTION, {
      ...existing, ...fields, updatedAt: new Date().toISOString(), updatedBy: who(),
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

    // 이름을 바꾸면 — 예전 이름으로 적힌 설계서는 그대로라고 알림
    if (existing && !sameFactoryName(existing.name, clean.name)) {
      const used = (designSheets || []).filter(s => sameFactoryName(s?.knitting?.factory, existing.name)).length;
      if (!window.confirm(
        `편직처 이름을 '${existing.name}' → '${clean.name}'(으)로 바꿉니다.\n\n`
        + (used ? `설계서 ${used}건에 적힌 '${existing.name}'은 그대로예요 (설계서 편직처 목록에도 예전 이름이 남아요).\n\n` : '')
        + '계속할까요?',
      )) return null;
    }

    const now = new Date().toISOString();
    const changed = machinesChanged(existing?.machines || [], clean.machines);
    const docToSave = {
      ...(existing || {}),
      ...clean,
      memos: existing?.memos || clean.memos || [],                 // 메모는 입력 창 밖에서 바로 저장 — 입력 창 값으로 덮지 않음
      checkedAt: changed && clean.machines.length ? todayLocalISO() : (clean.checkedAt || existing?.checkedAt || ''),
      id: editingId || newFactoryId(),
      createdAt: existing?.createdAt || now,
      createdBy: existing?.createdBy || who(),
      updatedAt: now,
      updatedBy: who(),
    };
    busyRef.current = true;
    try {
      const ok = await saveDocToCloud(KNIT_FACTORY_COLLECTION, docToSave);
      if (ok === false) return null;
      await syncNames([docToSave.name]);
      showToast(`'${docToSave.name}'을(를) 저장했어요.${changed && existing ? ' 기계를 고쳐서 확인일이 오늘로 바뀌었어요.' : ''}`, 'success');
      return docToSave;
    } finally {
      busyRef.current = false;
    }
  };

  /** 삭제 (되돌릴 수 없음). 반환: 지웠으면 true */
  const deleteFactory = async (id) => {
    const target = findFactory(id);
    if (!target) return false;
    const lines = (target.machines || []).length;
    if (!window.confirm(
      `'${target.name}'을(를) 지울까요?\n기계 ${lines}줄 · 메모 ${(target.memos || []).length}개가 같이 지워지고 되돌릴 수 없어요.\n\n`
      + '설계서에 적힌 편직처 이름과 설계서 편직처 목록은 그대로예요.',
    )) return false;
    const ok = await deleteDocFromCloud(KNIT_FACTORY_COLLECTION, id);
    if (ok === false) return false;
    showToast(`'${target.name}'을(를) 지웠어요.`, 'success');
    return true;
  };

  /** 메모 추가 (맨 위에) */
  const addMemo = async (id, text) => {
    const t = String(text || '').trim();
    if (!t) return false;
    const existing = findFactory(id);
    if (!existing) return false;
    const memo = { id: newMemoId(), date: todayLocalISO(), text: t, by: who() };
    const ok = await patchFactory(id, { memos: [memo, ...(existing.memos || [])] });
    if (ok) showToast('메모를 남겼어요.', 'success');
    return ok;
  };

  /** 메모 고치기 */
  const updateMemo = async (id, memoId, text) => {
    const t = String(text || '').trim();
    const existing = findFactory(id);
    if (!existing || !t) return false;
    return patchFactory(id, { memos: (existing.memos || []).map(m => (m.id === memoId ? { ...m, text: t, editedAt: todayLocalISO(), editedBy: who() } : m)) });
  };

  /** 메모 지우기 */
  const deleteMemo = async (id, memoId) => {
    const existing = findFactory(id);
    if (!existing) return false;
    if (!window.confirm('이 메모를 지울까요? 되돌릴 수 없어요.')) return false;
    return patchFactory(id, { memos: (existing.memos || []).filter(m => m.id !== memoId) });
  };

  /** [오늘 확인함] — 기계 현황을 편직처에 확인했으면 */
  const markChecked = async (id) => {
    const ok = await patchFactory(id, { checkedAt: todayLocalISO() });
    if (ok) showToast('기계 현황 확인일을 오늘로 남겼어요.', 'success');
    return ok;
  };

  /**
   * 엑셀 가져오기 — items: [{ factory(엑셀에서 읽은 양식), replaceId(같은 이름이 있으면 그 id — 덮어쓰기) | null }]
   *  덮어쓰기: 연락처·주소·편직료·기계를 엑셀 값으로, 메모는 기존 메모 아래에 엑셀 비고를 덧붙임, 확인일은 그대로
   *  반환: 저장했으면 true
   */
  const importFactories = async (items) => {
    if (busyRef.current) return false;
    const list = (items || []).filter(x => x?.factory?.name);
    if (!list.length) { showToast('가져올 편직처를 골라 주세요.', 'error'); return false; }
    const now = new Date().toISOString();
    const docs = list.map(({ factory, replaceId }, i) => {
      const { warnings: _w, ...data } = factory;
      const clean = cleanFactoryForSave(data);
      const existing = replaceId ? findFactory(replaceId) : null;
      const memos = existing
        ? [...(existing.memos || []), ...(clean.memos || []).filter(m => !(existing.memos || []).some(x => x.text === m.text))]
        : (clean.memos || []);
      return {
        ...(existing || {}),
        ...clean,
        name: existing ? existing.name : clean.name,
        memos,
        checkedAt: existing?.checkedAt || '',
        source: 'excel',
        id: existing?.id || `${newFactoryId()}_${i}`,
        createdAt: existing?.createdAt || now,
        createdBy: existing?.createdBy || who(),
        updatedAt: now,
        updatedBy: who(),
      };
    });
    busyRef.current = true;
    try {
      const ok = await saveBatchToCloud(KNIT_FACTORY_COLLECTION, docs);
      if (ok === false) return false;
      await syncNames(docs.map(d => d.name));
      const replaced = list.filter(x => x.replaceId).length;
      showToast(`편직처 ${docs.length}곳을 가져왔어요${replaced ? ` (덮어쓴 곳 ${replaced}곳)` : ''}.`, 'success');
      return true;
    } finally {
      busyRef.current = false;
    }
  };

  return { saveFactory, deleteFactory, addMemo, updateMemo, deleteMemo, markChecked, importFactories };
};
