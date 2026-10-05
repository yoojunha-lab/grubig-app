import { useEffect, useRef, useState } from 'react';

// ============================================================
// 저장 안 한 변경 확인 — 창이 열릴 때의 값을 기준으로, 지금 값과 다르면 '변경사항 있음' (2026-10-06)
//  · initial: 새 문서면 빈 양식을 기준으로 줌 → 불러오기·복제·의뢰에서 채운 내용도 '저장 안 함'으로 봄
//  · ignoreKeys: 맨 위 칸 중 비교에서 뺄 이름 — 바로 저장되면서 열린 화면도 같이 바뀌는 칸(단계·연결 등)
//  · id·createdAt·updatedAt은 어느 깊이든 뺌 (새 양식마다 시각값이 달라서)
//  · rebase(): 창을 연 채로 저장했을 때(연속 작성 등) 그때 값을 새 기준으로
// ============================================================
const VOLATILE_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

const snapshot = (value, ignoreKeys) => {
  const ignore = new Set(ignoreKeys || []);
  return JSON.stringify(value ?? null, function replacer(key, v) {
    if (VOLATILE_KEYS.has(key)) return undefined;
    if (this === value && ignore.has(key)) return undefined;
    return v;
  });
};

export const useUnsavedGuard = (value, isOpen, { initial = null, ignoreKeys = null } = {}) => {
  const baselineRef = useRef(null);
  const [rebaseNonce, setRebaseNonce] = useState(0);

  // 창이 열릴 때 기준 잡기 (닫히면 지움) — 열릴 때만 잡아야 편집하는 동안 기준이 안 바뀜
  useEffect(() => {
    baselineRef.current = isOpen ? snapshot(initial ?? value, ignoreKeys) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 창을 연 채로 저장한 뒤의 값을 새 기준으로
  useEffect(() => {
    if (rebaseNonce > 0 && isOpen) baselineRef.current = snapshot(value, ignoreKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebaseNonce]);

  const isDirty = () => isOpen && baselineRef.current !== null && snapshot(value, ignoreKeys) !== baselineRef.current;
  const rebase = () => setRebaseNonce(n => n + 1);
  return { isDirty, rebase };
};
