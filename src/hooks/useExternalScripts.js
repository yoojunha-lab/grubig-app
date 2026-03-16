import { useState, useEffect } from 'react';

// GRUBIG ERP - 외부 라이브러리 스크립트 로딩 훅 (XLSX, HTML2PDF)

export const useXLSX = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (window.XLSX) { setIsReady(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);
  return isReady;
};

export const useHTML2PDF = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (window.html2pdf) { setIsReady(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);
  return isReady;
};
