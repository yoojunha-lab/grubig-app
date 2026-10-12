import { useEffect, useRef, useState } from 'react';

// ============================================================
// 입력 창 저장 · 닫기 공용 (생산 현황 입력 창들 — 공정 · 가납기 · 생지 출고 · 컨펌 · 외관검사 · 출고)
// ------------------------------------------------------------
// - run(task): 저장 실행. task() 가 false 가 아니면(성공) 창을 닫고, 실패면 다시 누를 수 있게 둠
//   · 처리 중 잠금 (savingRef — 빠른 두 번 누름 방지, 화면 상태 saving 은 늦게 바뀌어서 ref 로)
//   · 저장 중에 창을 이미 닫았으면(ESC·바깥 클릭·취소) 저장이 끝난 뒤 onClose 를 또 부르지 않음
//     (그 사이 새로 연 다른 입력 창이 닫혀 버리지 않게)
// - close(): 저장 없이 닫기 ([취소] · 바뀐 게 없을 때)
// 반환: { saving, close, run }
// ============================================================
export const usePopoverSave = (onClose) => {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  const close = () => {
    closedRef.current = true;
    onCloseRef.current?.();
  };

  const run = async (task) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = (await task()) !== false;
    } catch {
      ok = false;
    }
    savingRef.current = false;
    if (closedRef.current) return ok; // 저장 중에 이미 닫힘
    if (ok) close();
    else setSaving(false);
    return ok;
  };

  return { saving, close, run };
};

export default usePopoverSave;
