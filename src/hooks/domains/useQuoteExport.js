import { useState } from 'react';
import { getQuoteValidUntil } from '../../utils/helpers';
import {
  calcQuotePrice, getShownTiers, getShownCustomItems, calcCustomQuotePrice,
  quotePriceBasis, buildQuoteTerms, validateQuoteForExport,
} from '../../utils/quoteModel';

// GRUBIG ERP - 바이어 견적서 내보내기 (PDF 인쇄 · 엑셀)
//  · App.jsx에서 그대로 옮김 (2026-10-06 — 동작 같음)
//  · kind: 'standard' 기준 견적서 / 'special' 별도 견적서 — 바이어에게 따로 보냄
//  · PDF는 인쇄할 견적을 따로 담아(pdfQuote) PDFRenderer가 그림 — 편집 중인 견적(quoteInput)은 건드리지 않음
export const useQuoteExport = ({ quoteInput, isXlsxReady, showToast }) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfKind, setPdfKind] = useState('standard'); // 견적서 PDF 종류: 'standard' 기준 견적서 / 'special' 별도 견적서
  const [pdfQuote, setPdfQuote] = useState(null);     // 인쇄할 견적 (목록에서 고른 견적) — 편집 중인 견적(quoteInput)은 건드리지 않음

  // 바이어 견적서로 내보내기 전 확인 — 못 보내는 문제(errors)는 막고, 확인할 것(warnings)은 물어봄. 진행하면 true
  const confirmQuoteExport = (quote, kind) => {
    const { errors, warnings } = validateQuoteForExport(quote, kind);
    if (errors.length > 0) {
      alert(`${kind === 'special' ? '별도' : '기준'} 견적서를 만들 수 없어요.\n\n• ${errors.join('\n• ')}`);
      return false;
    }
    if (warnings.length > 0) {
      return window.confirm(`확인해 주세요.\n\n• ${warnings.join('\n• ')}\n\n그래도 견적서를 만들까요?`);
    }
    return true;
  };

  // kind: 'standard' 기준 견적서 / 'special' 별도 견적서 — 바이어에게 따로 보냄 (대표님 요청 2026-10-05)
  const handleDownloadPDF = (targetQuoteFromHistory = null, kind = 'standard') => {
    // History 페이지 등에서 특정 견적서 출력 시 해당 견적서 데이터를 최우선으로 적용합니다.
    const targetQuote = (targetQuoteFromHistory && targetQuoteFromHistory.id) ? targetQuoteFromHistory : quoteInput;

    if (!confirmQuoteExport(targetQuote, kind)) return;

    // 인쇄할 견적은 따로 담음 — 예전엔 편집 중인 견적(quoteInput)을 목록의 견적으로 덮어썼음
    setPdfQuote(targetQuote);
    setPdfKind(kind);
    setIsPdfGenerating(true);
    showToast("인쇄 다이얼로그에서 '대상 = PDF로 저장'을 선택해 주세요.", 'info');

    // [PDF v4] Chrome native 인쇄 기능 사용
    //   - window.print() + @media print 스타일 (index.css)
    //   - document.title 트릭으로 자동 파일명 제안
    //   - (예전 html2pdf 방식은 화면 위치 캡처 버그가 있어 브라우저 인쇄로 바꿈)
    setTimeout(() => {
      const oldTitle = document.title;
      const safeBuyer = String(targetQuote.buyerName || '').replace(/[^a-zA-Z0-9\s-가-힣]/g, '');
      const filename = `Quotation${kind === 'special' ? '_Special' : ''}_${safeBuyer}_${targetQuote.date || ''}`.trim();
      try {
        document.title = filename;
        window.print();
      } finally {
        // 인쇄 다이얼로그 닫힌 후 복원
        document.title = oldTitle;
        setIsPdfGenerating(false);
        setPdfQuote(null);
      }
    }, 400);
  };

  // [신규] 견적서를 엑셀(.xlsx)로 내보내기
  //   - PDF와 동일한 내용(바이어/날짜/통화/유효기간 + 품목별 스펙·단가)
  //   - 단가는 판매가(calcQuotePrice / calcCustomQuotePrice — 아주 옛날 견적의 추가 마크업 포함) — PDF와 같은 값
  //   - History 행에서 호출 시 해당 견적서, 작성 화면에서 호출 시 현재 quoteInput 사용
  const handleDownloadQuoteExcel = (targetQuoteFromHistory = null, kind = 'standard') => {
    if (!isXlsxReady || !window.XLSX) {
      showToast('엑셀 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }
    const targetQuote = (targetQuoteFromHistory && targetQuoteFromHistory.id) ? targetQuoteFromHistory : quoteInput;
    // kind: 'standard' 기준 견적서 / 'special' 별도 견적서 — PDF와 같이 따로 내보냄
    const isSpecial = kind === 'special';
    const specialRows = getShownCustomItems(targetQuote);
    if (!confirmQuoteExport(targetQuote, kind)) return;

    const cur = targetQuote.currency;
    const priceBasis = quotePriceBasis(cur);
    const cell = (v) => (v === null || v === undefined ? '' : v); // 기준원가가 없는 구간(예전 견적)은 빈칸
    // 표 아래 조건 — PDF 약관과 같은 문구 (quoteModel.buildQuoteTerms 한 곳에서 관리 — 원화(내수) 견적은 한글, 수출은 영문)
    const notes = buildQuoteTerms(targetQuote, isSpecial ? 'special' : 'standard').map(line => `• ${line}`);

    let rows;
    let cols;
    if (!isSpecial) {
      // 기준 견적서: 고른 구간만 (PDF와 같은 판매가·같은 조건 문구)
      const tiers = getShownTiers(targetQuote);
      rows = (targetQuote.items || []).map((item, idx) => {
        const row = {
          'No': idx + 1,
          'Article': item.article || '',
          'Spec': item.itemName || '',
          'Cut(inch)': item.widthCut ?? '',
          'Full(inch)': item.widthFull ?? '',
          'GSM': item.gsm ?? '',
          'g/YD': Number(item.gYd) || 0,
          'MCQ(YD/color)': Number(item.mcqYd || 300),
        };
        tiers.forEach(t => { row[`${t.label.replace(' YD', 'YD')} (${cur})`] = cell(calcQuotePrice(item, t.key, targetQuote, cur)); });
        return row;
      });
      cols = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 9 }, { wch: 9 }, { wch: 7 }, { wch: 8 }, { wch: 13 }, ...tiers.map(() => ({ wch: 14 }))];
    } else {
      // 별도 견적서: '견적서' 체크한 줄만 (수량·컬러·조건·단가)
      rows = specialRows.map((r, idx) => ({
        'No': idx + 1,
        'Article': r.article || '',
        'Spec': r.itemName || '',
        'Cut(inch)': r.widthCut ?? '',
        'Full(inch)': r.widthFull ?? '',
        'GSM': r.gsm ?? '',
        'g/YD': Number(r.gYd) || 0,
        "Q'TY(YD)": Number(r.qty) || 0,
        'Colors': Number(r.colors) || 0,
        'MCQ(YD/color)': Number(r.mcqYd || 300), // 컬러당 최소 수량 — 약관: 고르지 않게 나눠 MCQ 미만이면 단가 조정
        [`Price/YD (${cur})`]: cell(calcCustomQuotePrice(r, targetQuote, cur)),
      }));
      cols = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 9 }, { wch: 9 }, { wch: 7 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 13 }, { wch: 16 }];
    }

    const validUntil = getQuoteValidUntil(targetQuote.date, targetQuote.validityOption);
    const meta = [
      [`GRUBIG FABRIC QUOTATION${isSpecial ? ' - SPECIAL CONDITIONS' : ''} (${priceBasis})`],
      [`Buyer: ${targetQuote.buyerName || ''}${targetQuote.attention ? `    Attn: ${targetQuote.attention}` : ''}`],
      [`Date: ${targetQuote.date || ''}    Currency: ${cur}    Valid Until: ${validUntil}`],
      [],
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(meta);
    window.XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5' });
    window.XLSX.utils.sheet_add_aoa(ws, [[], ...notes.map(n => [n])], { origin: -1 }); // 표 아래 조건 (PDF 약관과 같은 문구)
    ws['!cols'] = cols;

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, isSpecial ? 'Special Quotation' : 'Quotation');
    const safeBuyer = String(targetQuote.buyerName || '').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim();
    const fileParts = [isSpecial ? 'Quotation_Special' : 'Quotation', safeBuyer, targetQuote.date].filter(Boolean);
    window.XLSX.writeFile(wb, `${fileParts.join('_')}.xlsx`);
    showToast(`${rows.length}개 ${isSpecial ? '별도 견적 줄' : '품목'}을 엑셀로 내보냈습니다.`, 'success');
  };

  return { isPdfGenerating, pdfKind, pdfQuote, handleDownloadPDF, handleDownloadQuoteExcel };
};
