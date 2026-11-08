import { useLayoutEffect, useState } from 'react';

// GRUBIG ERP - 스크롤 상자 높이를 '화면에 남은 높이'에 맞춤 (대표님 요청 2026-11-08 '생산 현황 드래그를 아래에 고정')
//  · 상자 아래 끝이 화면 맨 아래(gap 만큼 여유)에 오도록 최대 높이를 계산 → 가로 스크롤바가 늘 화면 안에 보임
//    (예전엔 '화면 높이 − 220px'로 정해 둬서, 위쪽 메뉴·툴바가 더 높으면 스크롤바가 화면 밖으로 밀려났음)
//  · 상자 위치는 페이지 맨 위 기준 (페이지를 조금 내려 둔 상태에서 다시 재도 같은 값)
//  · 창 크기 · 상자 위 내용(요약 칸 줄바꿈, [칸 보이기/숨기기] 펼침 등)이 바뀌면 다시 잼
//  · 최대 높이라서 내용이 적으면 상자는 내용만큼만 (빈 공간을 만들지 않음)
//  · active: 상자가 화면에 그려져 있을 때 true (오더가 없어 안내만 보일 땐 false — 상자가 생기면 그때 잼)
//  반환: 최대 높이(px) — 아직 못 쟀으면 null (그동안은 컴포넌트의 예전 값으로)
export const useFitToViewport = (ref, { active = true, gap = 16, min = 240 } = {}) => {
  const [maxHeight, setMaxHeight] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(min, Math.floor(window.innerHeight - top - gap));
      setMaxHeight(prev => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(document.body);              // 페이지 위쪽 내용 높이가 바뀜
    if (el.parentElement) ro?.observe(el.parentElement); // 상자와 같은 카드 안 윗줄 (칸 보이기/숨기기 등)
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [ref, active, gap, min]);

  return maxHeight;
};
