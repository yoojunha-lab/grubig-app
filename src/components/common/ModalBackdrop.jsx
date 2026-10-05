import React, { useRef } from 'react';

// ============================================================
// 팝업 뒤 어두운 배경 — 배경을 눌렀다가 배경에서 뗐을 때만 onClose
//  - 입력칸에서 글자를 드래그해 선택하다가 창 밖에서 마우스를 떼도 닫히지 않음
//    (브라우저는 이런 경우를 '배경 클릭'으로 보내서, 그냥 onClick 이면 창이 닫혀 버림)
//  - 배경에서 눌렀다가 창 안에서 떼도 닫히지 않음
//  - 그 밖의 div 속성(className, style 등)은 그대로 전달
// ============================================================
export const ModalBackdrop = ({ onClose, children, ...rest }) => {
  const pressedOnBackdrop = useRef(false);
  const releasedOnBackdrop = useRef(false);

  return (
    <div
      {...rest}
      onMouseDown={e => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={e => { releasedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => {
        const fromBackdrop = pressedOnBackdrop.current && releasedOnBackdrop.current && e.target === e.currentTarget;
        pressedOnBackdrop.current = false;
        releasedOnBackdrop.current = false;
        if (fromBackdrop && onClose) onClose();
      }}
    >
      {children}
    </div>
  );
};
