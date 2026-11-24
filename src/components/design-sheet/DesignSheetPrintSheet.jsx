import React from 'react';
import { createPortal } from 'react-dom';

// ============================================================
// 설계서 인쇄 — 편직처용 / 염색소용 (개발 고도화 3단계, 대표님 요청 2026-11-24)
//  · 편직처 · 염색소에 보내는 종이라 원가 · 판매가 · 바이어 이름은 안 찍음 (대표님 결정)
//  · '제 N판' = 저장된 변경 이력 수 + 1 (설계를 고쳐 저장할 때마다 1씩) — 공장에 간 종이가 몇 번째 것인지 맞춰 보려고
//  · mode 'knit' (편직처용): 원사 배합 · 편직 사양 · 조직도(피더 줄) · 편직 특이사항 · 목표 스펙
//    mode 'dye'  (염색소용): 원사 혼용률 · 편직 요약 · 염가공 사양 · 후가공 · 목표 스펙
//  · body 직속 포털 + .sheet-print-root — 인쇄할 때 body.printing-sheet 이면 이것만 보임 (index.css, 개발 의뢰서 인쇄와 같은 방식)
// ============================================================

const v = (val) => {
  const s = String(val ?? '').trim();
  return s || '-';
};

// 원사 라이브러리 이름 — 'NAME [공급처]' 에서 공급처 대괄호는 뺌 (공장 종이에는 원사 이름만)
const plainYarnName = (name) => String(name || '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();

const Cell = ({ label, value, wide = false, mono = false }) => (
  <div className={`border border-slate-300 px-2.5 py-1.5 ${wide ? 'col-span-2' : ''}`}>
    <p className="text-[9px] font-bold text-slate-400">{label}</p>
    <p className={`text-[12px] font-bold text-slate-900 leading-snug whitespace-pre-wrap ${mono ? 'font-mono' : ''}`}>{v(value)}</p>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-4 avoid-break">
    <h3 className="text-[12px] font-extrabold text-slate-900 mb-1.5 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 bg-slate-900 inline-block" />{title}
    </h3>
    {children}
  </div>
);

export const DesignSheetPrintSheet = ({ sheet, mode = 'knit', yarnNameOf, printedAt = '' }) => {
  if (!sheet) return null;
  const isKnit = mode === 'knit';
  const k = sheet.knitting || {};
  const d = sheet.dyeing || {};
  const f = sheet.finishing || {};
  const ci = sheet.costInput || {};
  const revision = (sheet.changeHistory || []).length + 1;
  const lastEdited = String(sheet.updatedAt || '').slice(0, 10);
  const yarns = (sheet.yarns || [])
    .map((y, i) => ({ no: i + 1, name: plainYarnName(yarnNameOf ? yarnNameOf(y?.yarnId) : ''), ratio: Number(y?.ratio) || 0, yarnId: y?.yarnId }))
    .filter(y => y.yarnId && y.ratio > 0);
  const feeders = (k.feeders || []).filter(fd => String(fd?.symbol || '').trim() || String(fd?.loopLength || '').trim() || String(fd?.yarnSlot || '').trim());
  const slotName = (slot) => {
    const y = yarns.find(x => String(x.no) === String(slot));
    return slot ? `Yarn #${slot}${y?.name ? ` ${y.name}` : ''}` : '-';
  };
  const openWidth = [k.hasOpenWidth && '개폭선', k.isOpenWidth && '오픈개폭'].filter(Boolean).join(' · ') || '없음';

  return createPortal(
    <div
      className="sheet-print-root"
      style={{
        position: 'fixed', top: 0, left: '-99999px', width: '794px',
        margin: 0, padding: 0, backgroundColor: '#ffffff', zIndex: 9996,
        textAlign: 'left', boxSizing: 'border-box',
      }}
    >
      <div className="pdf-render-inner" style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
        <div className="font-sans text-slate-800">
          {/* 머리 */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-3 mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{isKnit ? '편직 설계서' : '염가공 설계서'}</h1>
              <p className="text-slate-400 text-[10px] mt-1 tracking-[0.2em] uppercase font-bold">{isKnit ? 'Knitting Spec Sheet' : 'Dyeing & Finishing Spec Sheet'}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-extrabold text-slate-900">제 {revision}판</p>
              <p className="text-[10px] text-slate-500">인쇄 {printedAt || '-'}{lastEdited ? ` · 마지막 수정 ${lastEdited}` : ''}</p>
            </div>
          </div>

          {/* 원단 */}
          <div className="border-2 border-slate-900 px-5 py-3 mb-4">
            <p className="text-[10px] font-extrabold text-slate-400 tracking-[0.2em] mb-1">원단명</p>
            <p className="text-2xl font-black text-slate-900 leading-snug">{v(sheet.fabricName)}</p>
            <div className="grid grid-cols-4 gap-0 mt-3 -mx-px">
              <Cell label="Article" value={sheet.articleNo} mono />
              <Cell label="EZ-TEX O/D NO." value={sheet.eztexOrderNo} mono />
              <Cell label="개발번호" value={sheet.devOrderNo} mono />
              <Cell label="납기" value={sheet.deadline} mono />
            </div>
          </div>

          {/* 원사 */}
          <Section title={isKnit ? '원사 배합' : '원사 혼용률'}>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 w-24 text-left">No.</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">원사</th>
                  <th className="border border-slate-300 px-2 py-1 w-24 text-right">비율</th>
                </tr>
              </thead>
              <tbody>
                {yarns.length ? yarns.map(y => (
                  <tr key={y.no}>
                    <td className="border border-slate-300 px-2 py-1 font-mono whitespace-nowrap">Yarn #{y.no}</td>
                    <td className="border border-slate-300 px-2 py-1 font-bold">{y.name || '-'}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">{y.ratio}%</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="border border-slate-300 px-2 py-2 text-center text-slate-400">원사가 비어 있어요</td></tr>
                )}
              </tbody>
            </table>
          </Section>

          {isKnit ? (
            <>
              <Section title="편직 사양">
                <div className="grid grid-cols-4">
                  <Cell label="편직처" value={k.factory} />
                  <Cell label="조직" value={k.structure} />
                  <Cell label="기종" value={k.machineType} />
                  <Cell label="게이지" value={k.gauge ? `${k.gauge}G` : ''} mono />
                  <Cell label="인치" value={k.machineInch ? `${k.machineInch}"` : ''} mono />
                  <Cell label="침수" value={k.needleCount ? `${sheet.knitLink?.needleEstimated ? '≈' : ''}${k.needleCount}` : ''} mono />
                  <Cell label="피더" value={k.feederCount} mono />
                  <Cell label="개폭" value={openWidth} />
                </div>
              </Section>

              <Section title="조직도 (피더 배열)">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1 w-12">F#</th>
                      <th className="border border-slate-300 px-2 py-1 w-56 text-left">사용 원사</th>
                      <th className="border border-slate-300 px-2 py-1">조직 부호 (Dial & Cylinder)</th>
                      <th className="border border-slate-300 px-2 py-1 w-24">루프장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeders.length ? feeders.map((fd, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1">{slotName(fd.yarnSlot)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono tracking-widest text-[14px]">{v(fd.symbol)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{v(fd.loopLength)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="border border-slate-300 px-2 py-2 text-center text-slate-400">조직도가 비어 있어요</td></tr>
                    )}
                  </tbody>
                </table>
              </Section>

              <Section title="편직 특이사항">
                <div className="border border-slate-300 px-3 py-2 min-h-[56px] text-[12px] font-bold whitespace-pre-wrap">{v(k.remarks)}</div>
              </Section>
            </>
          ) : (
            <>
              <Section title="편직 (참고)">
                <div className="grid grid-cols-4">
                  <Cell label="편직처" value={k.factory} />
                  <Cell label="조직" value={k.structure} />
                  <Cell label="게이지 · 인치" value={[k.gauge && `${k.gauge}G`, k.machineInch && `${k.machineInch}"`].filter(Boolean).join(' · ')} mono />
                  <Cell label="개폭" value={openWidth} />
                </div>
              </Section>

              <Section title="염가공 사양">
                <div className="grid grid-cols-4">
                  <Cell label="염가공처" value={d.factory} />
                  <Cell label="가공방법" value={d.processMethod} wide />
                  <Cell label="염색 후 폭" value={d.dyedWidth} />
                  <Cell label="텐타 기계폭" value={d.tenterWidth} />
                  <Cell label="텐타 온도" value={d.tenterTemp} />
                  <Cell label="포속" value={d.fabricSpeed} />
                  <Cell label="오버피더" value={d.overFeeder} />
                </div>
                <div className="border border-slate-300 border-t-0 px-3 py-2 min-h-[48px]">
                  <p className="text-[9px] font-bold text-slate-400">염가공 특이사항</p>
                  <p className="text-[12px] font-bold whitespace-pre-wrap">{v(d.remarks)}</p>
                </div>
              </Section>

              <Section title="후가공">
                <div className="grid grid-cols-4">
                  <Cell label="후가공처" value={f.factory} />
                  <Cell label="종류" value={f.type} />
                  <Cell label="방법" value={f.method} wide />
                </div>
              </Section>
            </>
          )}

          <Section title="목표 스펙 (가공 후)">
            <div className="grid grid-cols-4">
              <Cell label="내폭" value={ci.widthCut ? `${ci.widthCut}"` : ''} mono />
              <Cell label="외폭" value={ci.widthFull ? `${ci.widthFull}"` : ''} mono />
              <Cell label="GSM" value={ci.gsm ? `${ci.gsm} g/㎡` : ''} mono />
              <Cell label="확인" value="" />
            </div>
          </Section>

          <div className="mt-6 pt-3 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-400">
            <span>{isKnit ? '편직처 전달용' : '염색소 전달용'} 설계서 · 제 {revision}판 — 판이 다르면 최신 판으로 작업해 주세요.</span>
            <span className="font-bold uppercase tracking-[0.2em]">GRUBIG</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
