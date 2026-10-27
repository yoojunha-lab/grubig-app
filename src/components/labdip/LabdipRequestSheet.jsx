import React from 'react';
import { createPortal } from 'react-dom';

// ============================================================
// L/D 의뢰서 A4 — 공장(염가공처)에 보내는 의뢰서 (대표님 요청 2026-10-27)
//  - 인쇄 방식은 바이어 시트와 같음: body 직속 포털 + class "labdip-print-root", body.printing-labdip 일 때만 보임 (index.css)
//  - sheet = labdipModel.buildFactorySheet(…) — 바이어 · STYLE 칸은 아예 없음 (공장에도 바이어를 숨김, 대표님 결정)
//  - 컬러마다 한 칸: 컬러명 · PANTONE · 낱장 수 · 메모 + (바이어 스와치 첨부면) 스와치 붙이는 칸
//    2차부터는 앞 차수 공장 번호 · 바이어 코멘트 · 다시 의뢰하는 말
//  - 공장은 L/D를 만들어 번호(예: 25S038 "A")를 붙여 보내 줌 → LAB-DIP 화면 [L/D 도착]에 적음
// ============================================================

const InfoCell = ({ label, value, mono = false }) => (
  <div className="flex items-baseline gap-2 px-3 py-2 border-b border-slate-300 last:border-b-0">
    <span className="w-14 shrink-0 text-[11px] font-extrabold text-slate-500">{label}</span>
    <span className={`text-[14px] font-bold text-slate-900 leading-tight ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);

const SpecItem = ({ label, value, wide = false }) => (value ? (
  <div className={`flex items-baseline gap-2 ${wide ? 'col-span-2' : ''}`}>
    <span className="text-[10px] font-extrabold text-slate-500 shrink-0">{label}</span>
    <span className="text-[13px] font-bold text-slate-900 leading-snug">{value}</span>
  </div>
) : null);

export const LabdipRequestSheet = ({ sheet }) => {
  if (!sheet || sheet.kind !== 'factory') return null;
  const rows = sheet.rows || [];

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
          {/* ── 제목 + 의뢰 정보 ── */}
          <div className="avoid-break">
            <div className="text-center mb-5">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">L/D 의뢰서</h1>
              <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-[0.3em]">Lab-Dip Request</p>
            </div>

            <div className="grid grid-cols-2 border-2 border-slate-800 mb-4">
              <div className="border-r border-slate-300">
                <InfoCell label="L/D NO." value={sheet.ldNo} mono />
                <InfoCell label="수신" value={sheet.factory} />
                <InfoCell label="담당" value={sheet.author ? `${sheet.author} (GRUBIG)` : 'GRUBIG'} />
              </div>
              <div>
                <InfoCell label="의뢰일" value={sheet.requestDate} />
                <InfoCell label="납기" value={sheet.duePerRow ? '컬러마다 아래에' : sheet.due} />
                <InfoCell label="차수" value={sheet.roundLabel} />
              </div>
            </div>

            {/* 원단 */}
            <div className="border border-slate-300 rounded-md px-3 py-2.5 mb-5">
              <div className="text-[11px] font-extrabold text-slate-800 mb-1.5">원단</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <SpecItem label="ARTICLE" value={sheet.article} />
                <SpecItem label="울 종류" value={sheet.wool} />
                <SpecItem label="ITEM NAME" value={sheet.itemName} wide />
                <SpecItem label="GSM" value={sheet.gsm} />
                <SpecItem label="폭" value={sheet.width} />
                <SpecItem label="광원" value={sheet.lightSources} wide />
              </div>
            </div>
          </div>

          {/* ── 컬러 ── */}
          <div className="text-[11px] font-extrabold text-slate-800 mb-2">컬러 ({rows.length})</div>
          {rows.length === 0 ? (
            <div className="py-16 text-center text-slate-300 text-sm border border-dashed border-slate-200 rounded-lg">
              컬러가 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map(r => (
                <div key={r.id} className="avoid-break border border-slate-400 rounded-md flex">
                  <div className="flex-1 min-w-0 px-3 py-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-slate-400">{r.no}</span>
                      <span className="text-[15px] font-extrabold text-slate-900 uppercase">{r.name || '(컬러명 미입력)'}</span>
                      {r.roundNo > 1 && <span className="text-[10px] font-extrabold px-1.5 py-px rounded border border-slate-800 text-slate-800">{r.roundNo}차</span>}
                      <span className="ml-auto text-[11px] font-bold text-slate-700">낱장 {r.letters}장</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-[12px] text-slate-800">
                      {r.pantone && <div><span className="text-[10px] font-extrabold text-slate-500 mr-1.5">PANTONE</span><span className="font-bold">{r.pantone}</span></div>}
                      {r.swatch && <div className="text-[11px] font-bold text-slate-600">바이어 스와치 첨부 →</div>}
                      {sheet.duePerRow && r.due && <div><span className="text-[10px] font-extrabold text-slate-500 mr-1.5">납기</span><span className="font-bold">{r.due}</span></div>}
                      {r.prev && (
                        <div className="text-[11px] text-slate-700">
                          <span className="text-[10px] font-extrabold text-slate-500 mr-1.5">{r.prev.no}차</span>
                          {[r.prev.factoryNo, r.prev.range].filter(Boolean).join(' ')} 리젝
                          {r.prev.comment && <> — 바이어: <b>{r.prev.comment}</b></>}
                        </div>
                      )}
                      {r.requestNote && <div><span className="text-[10px] font-extrabold text-slate-500 mr-1.5">요청</span>{r.requestNote}</div>}
                      {r.memo && <div><span className="text-[10px] font-extrabold text-slate-500 mr-1.5">메모</span>{r.memo}</div>}
                    </div>
                  </div>
                  {r.swatch && (
                    <div className="w-[170px] shrink-0 border-l border-dashed border-slate-400 flex items-center justify-center" style={{ minHeight: '120px' }}>
                      <span className="text-[10px] font-bold text-slate-300">스와치 붙이는 곳</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── 특이사항 ── */}
          {sheet.remarks && (
            <div className="avoid-break mt-5 border border-slate-300 rounded-md px-3 py-2.5">
              <div className="text-[11px] font-extrabold text-slate-800 mb-1">특이사항</div>
              <p className="text-[12px] text-slate-800 whitespace-pre-wrap leading-relaxed">{sheet.remarks}</p>
            </div>
          )}

          <p className="mt-4 text-[10px] text-slate-500">
            L/D를 보내실 때 컬러마다 번호와 낱장 글자(예: 25S038 &quot;A&quot;)를 붙여 주세요.
          </p>

          {/* ── 푸터 ── */}
          <div className="avoid-break mt-6 pt-4 border-t-2 border-slate-800">
            <div className="grid grid-cols-3 items-center gap-3">
              <div className="text-[10px] text-slate-600 font-bold leading-relaxed">
                <p>Email: info@grubig.kr</p>
              </div>
              <div className="text-center">
                <img src="/logo.png" alt="GRUBIG" className="h-[40px] object-contain mx-auto" onError={(e) => (e.target.style.display = 'none')} />
              </div>
              <div className="text-right text-[11px] font-extrabold text-slate-800">
                www.grubig.kr
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
