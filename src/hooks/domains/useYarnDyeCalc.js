import { useState, useRef, useMemo } from 'react';
import { todayLocalISO } from '../../utils/helpers';
import { makeBlankCalc, normalizeCalc, cleanCalcForSave, calcKindLabel } from '../../utils/yarnDyeCalc';

// ============================================================
// GRUBIG ERP - 선염 계산기 (생산 ▾ 계산기) 도메인 훅 — 대표님 요청 2026-10-07
//  - Firestore 컬렉션: yarnDyeCalcs — 계산 저장 · 다시 불러오기 · 삭제
//  - 계산 규칙은 utils/yarnDyeCalc.js (스트라이프 선염 원사 배분 / 멜란지 선염 수량 비율)
//  - 작성 중인 계산은 이 훅(App)이 들고 있어서 다른 메뉴에 다녀와도 그대로 남음
//  - 저장 안 한 변경(dyeCalcDirty): 저장될 모양(cleanCalcForSave)으로 비교 — 빈 줄만 늘린 건 변경 아님
// ============================================================

const COLLECTION = 'yarnDyeCalcs';
const newCalcId = () => `ydc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const snapshotOf = (calc) => JSON.stringify(cleanCalcForSave(calc));

export const useYarnDyeCalc = (yarnDyeCalcs, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  const [dyeCalcInput, setDyeCalcInput] = useState(() => makeBlankCalc('stripe'));
  const [editingDyeCalcId, setEditingDyeCalcId] = useState(null);
  // 마지막으로 불러오거나 저장했을 때의 모양 — 지금 값과 다르면 '저장 안 한 변경'
  const [baseline, setBaseline] = useState(() => snapshotOf(makeBlankCalc('stripe')));
  const savingRef = useRef(false); // 저장 중 잠금 (빠르게 두 번 눌러도 한 번만)

  const dyeCalcDirty = useMemo(() => snapshotOf(dyeCalcInput) !== baseline, [dyeCalcInput, baseline]);

  // 화면에 계산을 띄우고 그 모양을 기준으로
  const showCalc = (calc, id) => {
    setDyeCalcInput(calc);
    setEditingDyeCalcId(id);
    setBaseline(snapshotOf(calc));
  };

  /** 새로 계산 (kind: 'stripe' | 'melange') */
  const newDyeCalc = (kind = 'stripe') => showCalc(makeBlankCalc(kind), null);

  /** 저장된 계산 불러오기 */
  const loadDyeCalc = (doc) => {
    if (!doc) return;
    showCalc(normalizeCalc(doc), doc.id);
  };

  /** 저장 — 새 계산이면 새 문서, 불러온 계산이면 그 문서를 고침. 반환: 저장했으면 true */
  const saveDyeCalc = async () => {
    if (savingRef.current) return false;
    const clean = cleanCalcForSave(dyeCalcInput);
    if (clean.rows.length === 0) {
      showToast('계산할 줄을 하나 이상 넣어 주세요.', 'error');
      return false;
    }
    const now = new Date().toISOString();
    const who = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    const existing = editingDyeCalcId ? (yarnDyeCalcs || []).find(c => c.id === editingDyeCalcId) : null;
    // 제목을 비우면 '스트라이프 선염 2026-10-07'처럼
    const title = clean.title || `${calcKindLabel(clean.kind)} ${todayLocalISO()}`;
    const docToSave = {
      ...clean,
      title,
      id: editingDyeCalcId || newCalcId(),
      createdAt: existing?.createdAt || dyeCalcInput.createdAt || now,
      createdBy: existing?.createdBy || dyeCalcInput.createdBy || who,
      updatedAt: now,
      updatedBy: who,
    };
    savingRef.current = true;
    try {
      const ok = await saveDocToCloud(COLLECTION, docToSave);
      if (ok === false) return false; // 실패 알림은 saveDocToCloud가 띄움 — 입력값은 그대로
      showCalc(normalizeCalc(docToSave), docToSave.id);
      showToast(`'${title}' 계산을 저장했어요.`, 'success');
      return true;
    } finally {
      savingRef.current = false;
    }
  };

  /** 삭제 (복구 불가 확인) — 지금 열려 있는 계산이면 새 계산으로. 반환: 지웠으면 true */
  const deleteDyeCalc = async (id) => {
    const target = (yarnDyeCalcs || []).find(c => c.id === id);
    if (!target) return false;
    if (!window.confirm(`'${target.title || calcKindLabel(target.kind)}' 계산을 지울까요?\n지우면 되돌릴 수 없어요.`)) return false;
    const ok = await deleteDocFromCloud(COLLECTION, id);
    if (ok === false) return false;
    if (editingDyeCalcId === id) newDyeCalc(target.kind);
    showToast('계산을 지웠어요.', 'success');
    return true;
  };

  return {
    dyeCalcInput, setDyeCalcInput, editingDyeCalcId, dyeCalcDirty,
    newDyeCalc, loadDyeCalc, saveDyeCalc, deleteDyeCalc,
  };
};
