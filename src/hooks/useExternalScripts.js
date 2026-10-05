import { useState, useEffect } from 'react';

// GRUBIG ERP - 외부 라이브러리 스크립트 로딩 훅 (XLSX)
//  · PDF는 브라우저 인쇄(window.print + PDFRenderer)로 만듦 — 예전 html2pdf 로더는 쓰는 곳이 없어 지움 (2026-10-06)

export const useXLSX = () => {
  const [isReady, setIsReady] = useState(() => typeof window !== 'undefined' && !!window.XLSX);
  useEffect(() => {
    if (window.XLSX) return; // 이미 불러옴 (처음 값이 true)
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);
  return isReady;
};
