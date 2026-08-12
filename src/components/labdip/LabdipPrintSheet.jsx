import React from 'react';
import { createPortal } from 'react-dom';
import { labdipLetters } from '../../hooks/domains/useLabdip';

// ============================================================
// Lab-Dip A4 출력 시트 — 바이어 제시용 (색상 승인 요청)
//  - body 직속 포털 + class "labdip-print-root"
//  - 평소엔 화면 밖(left:-99999px), 인쇄 시 body.printing-labdip 일 때만 노출 (index.css)
//  - 컬러별로 그룹핑: [컬러명 + 코멘트 캡션] + [낱장 스와치 박스 3열]
//    · 스와치 박스 1개 = 낱장 1장 (25S038 "A")  → 실물 원단을 칸마다 붙임
//  - 발송기록(발송일/발송방법/특이사항)은 기록용 → 여기(PDF)에는 표시하지 않음
// ============================================================

// 헤더 라벨/값 한 칸 (밑줄 스타일 — 원본 양식 느낌 유지)
const HeaderCell = ({ label, value }) => (
  <div className="flex items-end gap-2 border-b-2 border-slate-800 pb-1">
    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
    <span className="text-[15px] font-bold text-slate-900 uppercase leading-tight truncate">{value || ''}</span>
  </div>
);

// 낱장 스와치 박스 1개
const SwatchBox = ({ colorName, no }) => (
  <div
    className="avoid-break border border-slate-300 rounded-md overflow-hidden flex flex-col"
    style={{ height: '150px' }}
  >
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
      <span className="text-[10px] font-bold text-slate-700 uppercase truncate">{colorName || ''}</span>
      <span className="text-[10px] font-mono font-bold text-slate-900 shrink-0">{no}</span>
    </div>
    {/* 실물 스와치를 붙이는 빈 영역 */}
    <div className="flex-1 bg-white" />
  </div>
);

export const LabdipPrintSheet = ({ labdip }) => {
  if (!labdip) return null;
  const colors = (labdip.colors || []).filter(c => (c.name || '').trim() || (c.baseNo || '').trim());

  return createPortal(
    <div
      className="labdip-print-root"
      style={{
        position: 'fixed', top: 0, left: '-99999px', width: '794px',
        margin: 0, padding: 0, backgroundColor: '#ffffff', zIndex: 9996,
        textAlign: 'left', boxSizing: 'border-box',
      }}
    >
      <div className="pdf-render-inner" style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
        <div className="px-8 py-6">
          {/* ── 제목 + 헤더 (한 덩어리로 안 잘리게) ── */}
          <div className="avoid-break">
            <div className="text-center mb-5">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">LAB-DIP SAMPLE</h1>
              <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-[0.3em]">Color Approval Request</p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
              <HeaderCell label="BUYER" value={labdip.buyerName} />
              <HeaderCell label="DATE" value={labdip.date} />
              <HeaderCell label="ARTICLE" value={labdip.article} />
              <HeaderCell label="STYLE" value={labdip.style} />
            </div>
          </div>

          {/* ── 컬러별 스와치 그룹 ── */}
          {colors.length === 0 ? (
            <div className="py-16 text-center text-slate-300 text-sm border border-dashed border-slate-200 rounded-lg">
              컬러가 없습니다.
            </div>
          ) : (
            <div className="space-y-5">
              {colors.map((c, ci) => {
                const letters = labdipLetters(c.letters);
                return (
                  <div key={c.id || ci} className="avoid-break">
                    {/* 컬러 캡션 (컬러명 + 코멘트) */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-800 shrink-0" />
                      <span className="text-[13px] font-extrabold text-slate-900 uppercase">{c.name || '(컬러명 미입력)'}</span>
                      {c.baseNo && <span className="text-[11px] font-mono font-bold text-slate-500">· {c.baseNo}</span>}
                      {c.comment && <span className="text-[11px] text-slate-500 italic truncate">— {c.comment}</span>}
                    </div>
                    {/* 낱장 스와치 3열 그리드 */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {letters.map((L) => (
                        <SwatchBox
                          key={L}
                          colorName={c.name}
                          no={`${c.baseNo || ''} "${L}"`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 푸터: 회사 정보 (원본 양식 유지) ── */}
          <div className="avoid-break mt-8 pt-4 border-t-2 border-slate-800 grid grid-cols-3 items-center gap-3">
            <div className="text-[10px] text-slate-600 font-bold leading-relaxed">
              <p>Email: info@grubig.kr</p>
              <p>TEL: 031-389-2301</p>
              <p>FAX: 031-389-2315</p>
            </div>
            <div className="text-center">
              <img src="/logo.png" alt="GRUBIG" className="h-[46px] object-contain mx-auto" onError={(e) => (e.target.style.display = 'none')} />
            </div>
            <div className="text-right text-[11px] font-extrabold text-slate-800">
              www.grubig.kr
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
