import React from 'react';
import { createPortal } from 'react-dom';
import { DEV_REQUEST_STATUS_LABELS } from '../../constants/common';

/**
 * 개발 의뢰서 인쇄 시트 — 2가지 모드
 *  - mode="knit"     : 편직처 전달용 (오더번호 + 원단명 + 스와치 부착란, 바이어명 비노출)
 *  - mode="internal" : 내부 개발자 전달용 (스와치 부착란 + 의뢰 등록 시 입력한 전체 내용)
 *
 * [중요] body 직속 포털 + class "devreq-print-root" 로 마운트한다.
 *   index.css 의 `@media print { body > *:not(.pdf-render-root) { display:none } }` 규칙 때문에
 *   #root 안쪽에 있는 인쇄 영역은 항상 숨겨지고 견적서 포털만 출력되기 때문.
 *   평소엔 화면 밖(left:-99999px)에 있고, 인쇄 시 body.printing-devreq 일 때만 노출된다.
 */
export const DevRequestPrintSheet = ({ devReq, mode = 'knit' }) => {
  if (!devReq) return null;

  const spec = devReq.targetSpec || {};
  const isKnit = mode === 'knit';

  // 값이 비었을 때 표시할 기본 문자열
  const v = (val) => {
    const s = (val ?? '').toString().trim();
    return s || '-';
  };

  const statusLabel = DEV_REQUEST_STATUS_LABELS?.[devReq.status] || devReq.status || '-';

  return createPortal(
    <div
      className="devreq-print-root"
      style={{
        position: 'fixed', top: 0, left: '-99999px', width: '794px',
        margin: 0, padding: 0, backgroundColor: '#ffffff', zIndex: 9996,
        textAlign: 'left', boxSizing: 'border-box',
      }}
    >
      <div
        className="pdf-render-inner"
        style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}
      >
        <div
          className="flex flex-col font-sans text-slate-800"
          style={{ height: '262mm', boxSizing: 'border-box' }}
        >
          {/* ===== 공통 헤더 ===== */}
          <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {isKnit ? '편직 의뢰서' : '개발 의뢰서'}
              </h1>
              <p className="text-slate-400 text-[10px] mt-1 tracking-[0.2em] uppercase font-bold">
                {isKnit ? 'Knitting Request Sheet' : 'Development Request Sheet (Internal)'}
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Order No. / O.D</span>
              <span className="text-xl font-mono font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">
                {v(devReq.devOrderNo)}
              </span>
            </div>
          </div>

          {isKnit ? (
            /* ================= 편직처 전달용 ================= */
            <>
              {/* 원단명 (개발 아이템 + 혼용률/스펙) */}
              <div className="border-2 border-slate-800 rounded-2xl px-6 py-5 mb-5">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2">Fabric / 원단명</p>
                <p className="text-2xl font-black text-slate-900 leading-snug">
                  {v(devReq.devItem)}
                </p>
                <p className="text-sm font-bold text-slate-600 mt-2 leading-snug">
                  {v(spec.composition)}
                </p>
              </div>

              {/* 스와치 부착란 */}
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
                <span className="font-black text-4xl tracking-[0.15em] text-slate-200">ATTACH SWATCH</span>
                <p className="text-slate-400 text-sm mt-3 font-medium">이곳에 스와치를 부착해주세요 (최소 9×9cm 권장)</p>
                {devReq.swatchNote && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-2xl border border-slate-200 max-w-[80%]">
                    <p className="text-sm font-bold text-slate-700">📌 {devReq.swatchNote}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                <span>본 의뢰서는 편직처 전달용입니다.</span>
                <span className="font-bold uppercase tracking-[0.2em]">GRUBIG</span>
              </div>
            </>
          ) : (
            /* ================= 내부 전달용 ================= */
            <>
              {/* 기본 정보 */}
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                <InfoBox label="의뢰 일자" value={v(devReq.requestDate)} />
                <InfoBox label="바이어" value={v(devReq.buyerName)} strong />
                <InfoBox label="영업 담당자" value={v(devReq.assignee)} />
                <InfoBox label="현재 단계" value={statusLabel} />
                <InfoBox label="분석 납기" value={v(spec.analysisDeadline || spec.deliveryDate)} danger />
                <InfoBox label="샘플 생산 납기" value={v(spec.sampleDeadline)} />
                <InfoBox label="타겟 단가" value={v(spec.targetPrice)} />
                <InfoBox label="폭 / 중량" value={v(spec.widthWeight)} />
              </div>

              {/* 스와치 부착란 */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden mb-4" style={{ height: '78mm' }}>
                <span className="font-black text-3xl tracking-[0.15em] text-slate-200">ATTACH SWATCH</span>
                <p className="text-slate-400 text-xs mt-2 font-medium">이곳에 스와치를 부착해주세요 (최소 9×9cm 권장)</p>
                {devReq.swatchNote && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-xl border border-slate-200 max-w-[80%]">
                    <p className="text-xs font-bold text-slate-700">📌 {devReq.swatchNote}</p>
                  </div>
                )}
              </div>

              {/* 의뢰 내용 */}
              <div className="flex-1 flex flex-col gap-3">
                <SectionBox title="개발 아이템 · 스펙" dot="bg-indigo-500">
                  <SpecRow label="개발 아이템" value={v(devReq.devItem)} />
                  <SpecRow label="혼용률 / 스펙" value={v(spec.composition)} />
                  <SpecRow label="원하는 느낌" value={v(spec.feeling || spec.touch)} last />
                </SectionBox>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  <SectionBox title="기타 요청" dot="bg-emerald-500">
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {spec.otherRequests || '추가 요청사항 없음'}
                    </p>
                  </SectionBox>
                  <SectionBox title="바이어 특이사항" dot="bg-amber-500">
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {spec.customerNotes || '등록된 특이사항이 없습니다.'}
                    </p>
                  </SectionBox>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                <span>본 의뢰서는 내부 개발 전달용입니다. (대외 배포 금지)</span>
                <span className="font-bold uppercase tracking-[0.2em]">GRUBIG</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// 상단 기본 정보 박스
const InfoBox = ({ label, value, strong, danger }) => (
  <div className={`rounded-xl px-3 py-2 border ${danger ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className={`text-[9px] font-bold mb-1 ${danger ? 'text-red-500' : 'text-slate-400'}`}>{label}</p>
    <p className={`text-xs leading-snug ${danger ? 'font-bold text-red-600' : strong ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}>
      {value}
    </p>
  </div>
);

// 섹션 카드
const SectionBox = ({ title, dot, children }) => (
  <div className="border border-slate-200 rounded-2xl p-3.5 flex flex-col">
    <h3 className="text-[11px] font-extrabold text-slate-800 mb-2.5 flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>{title}
    </h3>
    <div className="flex-1">{children}</div>
  </div>
);

// 스펙 한 줄
const SpecRow = ({ label, value, last }) => (
  <div className={`flex justify-between items-start gap-3 ${last ? '' : 'border-b border-dashed border-slate-200 pb-1.5 mb-1.5'}`}>
    <span className="text-[11px] font-bold text-slate-500 w-1/4 shrink-0">{label}</span>
    <span className="text-xs font-bold text-slate-800 text-right w-3/4 leading-snug">{value}</span>
  </div>
);
