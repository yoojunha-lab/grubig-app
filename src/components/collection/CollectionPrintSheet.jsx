import React from 'react';
import { createPortal } from 'react-dom';

// 컬렉션 PDF(인쇄) 라인시트 — 바이어 제시용 (단가 제외, 스펙만)
//  - body 직속 포털 + class "collection-print-root"
//  - 평소엔 화면 밖(left:-99999px), 인쇄 시 body.printing-collection 일 때만 노출 (index.css)
//  - 표 헤더(thead)는 브라우저가 페이지마다 자동 반복, 각 행은 .avoid-break 로 잘림 방지
//  - colgroup은 map으로 렌더해 공백 텍스트 노드 경고를 피함
export const CollectionPrintSheet = ({ collection, savedFabrics = [], getComposition }) => {
  if (!collection) return null;
  const items = collection.items || [];
  const colWidths = ['7%', '17%', '23%', '36%', '17%'];

  return createPortal(
    <div
      className="collection-print-root"
      style={{
        position: 'fixed', top: 0, left: '-99999px', width: '794px',
        margin: 0, padding: 0, backgroundColor: '#ffffff', zIndex: 9997,
        textAlign: 'left', boxSizing: 'border-box',
      }}
    >
      <div className="pdf-render-inner" style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
        <div className="px-8 py-6">
          {/* 헤더 */}
          <div className="text-center mb-2">
            <img src="/logo.png" alt="GRUBIG" className="h-[70px] object-contain mx-auto mb-2" onError={(e) => (e.target.style.display = 'none')} />
          </div>
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{collection.name}</h2>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-[0.2em]">Collection Line Sheet</p>
          </div>
          <div className="flex justify-between text-[11px] text-slate-600 mb-5">
            <div>
              <span className="font-bold">분류:</span> {collection.type || '-'}
              {collection.eventName ? <span> · {collection.eventName}</span> : null}
            </div>
            <div>
              {collection.buyer ? <span><span className="font-bold">바이어:</span> {collection.buyer} · </span> : null}
              {collection.date || ''}
            </div>
          </div>

          {/* 표 */}
          <table className="w-full text-[11px] text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {colWidths.map((w, i) => (<col key={i} style={{ width: w }} />))}
            </colgroup>
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-2 font-bold text-slate-900 text-center uppercase">No</th>
                <th className="py-2 font-bold text-slate-900 uppercase">Article</th>
                <th className="py-2 font-bold text-slate-900 uppercase">Item</th>
                <th className="py-2 font-bold text-slate-900 uppercase">조성 (Composition)</th>
                <th className="py-2 font-bold text-slate-900 text-right uppercase">Cut/Full · GSM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => {
                const fabric = (savedFabrics || []).find(f => String(f.id) === String(item.fabricId));
                const comp = fabric && getComposition ? getComposition(fabric) : '';
                return (
                  <tr key={item.fabricId || idx} className="avoid-break">
                    <td className="py-2.5 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 font-bold text-slate-800 uppercase">{(fabric?.article) || item.article || ''}</td>
                    <td className="py-2.5 text-slate-600">
                      {(fabric?.itemName) || item.itemName || ''}
                      {item.memo ? <div className="text-[10px] text-slate-400 italic">{item.memo}</div> : null}
                    </td>
                    <td className="py-2.5 text-slate-600">{comp}</td>
                    <td className="py-2.5 text-right text-slate-500 font-mono">
                      {fabric ? `${fabric.widthCut}/${fabric.widthFull}" · ${fabric.gsm}g` : '—'}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">담긴 아티클이 없습니다.</td></tr>
              )}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
            <span>총 {items.length}개 아티클</span>
            <span className="font-bold uppercase tracking-[0.2em]">Made in Korea</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
