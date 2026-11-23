import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { FileText, ClipboardList, StickyNote } from 'lucide-react';
import { factoryTotals, typeSummaries, typeColumns, familyTone, fmtNum, inchLabel, gaugeRangeLabel } from '../../utils/knitFactoryModel';
import { TypeChip, CheckBadge } from './KnitParts';
import { useFitToViewport } from '../../hooks/useFitToViewport';

// ============================================================
// 편직처 기계 현황 — [편직처] 전체 목록 표
//  (대표님 요청 2026-11-24 '보기 쉽게 · 정보 더' → 같은 날 '줄 맞추고 연락처 빼고 옆으로 넘겨 보게')
//  · 줄 = 편직처, 열 = 기계 종류 (계열마다 묶음 — 설정 순서). 같은 종류는 늘 같은 열이라 위아래로 비교
//  · 칸: 게이지 범위 · 스판 / 인치별 대수
//  · 왼쪽 편직처 칸 · 위 머리는 고정, 종류가 많으면 옆으로 넘겨 봄
//  · 표 상자 높이 = 화면에 남은 높이 → 가로 스크롤바가 늘 화면 맨 아래 (생산 현황과 같음 — useFitToViewport)
//  · 맨 오른쪽: 우리 작업(설계서 · 오더 · 최근 날짜) · 최근 메모
//  · 계열을 고르면 그 계열 열만 · 줄을 누르면 상세 · 상세에서 돌아와도 보던 자리(위아래 · 옆)
// ============================================================

const shortDate = (iso) => {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
};

// 열 너비 — 편직처(고정) · 종류 · 우리 작업
const NAME_W = 'w-[150px] min-w-[150px] max-w-[150px] sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]';
const TYPE_W = 'w-[150px] min-w-[150px]';
const WORK_W = 'w-[260px] min-w-[260px]';
const ROW_BG = 'bg-white group-hover:bg-violet-50 group-focus:bg-violet-50';
const HEAD_ROW1 = 'h-7';      // 계열 줄 높이 — 종류 줄은 이만큼 아래에 고정 (top-7)

/** 종류 칸 — 게이지 범위 · 스판 / 인치별 대수 */
const TypeCell = ({ s }) => {
  if (!s) return <span className="text-slate-200">—</span>;
  return (
    <>
      <div className="flex items-center gap-1 leading-5">
        <b className="font-mono text-[13px] text-slate-800">{gaugeRangeLabel(s.gauges) || <span className="font-sans text-xs font-normal text-slate-300">게이지?</span>}</b>
        {s.spandex === 'yes' && <span className="text-[9px] font-extrabold px-1 rounded bg-pink-50 text-pink-700 border border-pink-200" title="스판장치 있는 기계가 있어요">스판</span>}
      </div>
      <div className="flex flex-wrap gap-x-2 leading-5 text-slate-600">
        {s.inches.length ? s.inches.map((x, i) => (
          <span key={`${x.inch}_${i}`} className="whitespace-nowrap">
            <b className="font-mono text-slate-800">{inchLabel(x.inch) || '?"'}</b> {x.count ? `${fmtNum(x.count)}대` : ''}{x.unknown ? <span className="text-slate-400">{x.count ? '+?' : '대수?'}</span> : ''}
          </span>
        )) : <span className="text-slate-400">가마만</span>}
      </div>
    </>
  );
};

export const KnitFactoryList = ({ rows = [], config, today, family = '', jobsByFactory = {}, workByFactory = {}, onOpen, scrollMemoRef }) => {
  const boxRef = useRef(null);
  const maxHeight = useFitToViewport(boxRef, { active: rows.length > 0 });

  const data = useMemo(() => rows.map(f => {
    const t = factoryTotals(f, config);
    const types = typeSummaries(t.blocks);
    return { f, t, types, byType: new Map(types.map(x => [x.type, x])) };
  }), [rows, config]);
  // 계열을 골랐으면 그 계열 열만
  const groups = useMemo(() => typeColumns(data.map(d => d.types), config).filter(g => !family || g.family === family), [data, config, family]);
  const cols = groups.flatMap(g => g.types);

  // 상세에 갔다 와도 보던 자리 — 상자 높이가 정해진 뒤 한 번
  const restoredRef = useRef(false);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const memo = scrollMemoRef?.current;
    if (restoredRef.current || !box || maxHeight === null) return;
    restoredRef.current = true;
    if (memo) { box.scrollTop = memo.top || 0; box.scrollLeft = memo.left || 0; }
  }, [maxHeight, scrollMemoRef]);
  const rememberScroll = (e) => {
    if (scrollMemoRef) scrollMemoRef.current = { top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft };
  };

  if (!rows.length) return <p className="px-3 py-10 text-center text-sm text-slate-400">찾는 편직처가 없어요.</p>;

  return (
    <div ref={boxRef} onScroll={rememberScroll} className="overflow-auto" style={{ maxHeight: maxHeight ?? 'calc(100vh - 300px)' }}>
      <table className="text-xs border-separate border-spacing-0 min-w-full">
        <thead>
          <tr>
            <th rowSpan={2} className={`sticky left-0 top-0 z-30 ${NAME_W} bg-slate-50 border-b border-r border-slate-200 px-3 py-1.5 text-left align-bottom text-[11px] font-bold text-slate-500`}>
              편직처 · 기계 합계
            </th>
            {groups.map(g => (
              <th key={g.family} colSpan={g.types.length} className={`sticky top-0 z-20 ${HEAD_ROW1} bg-slate-50 border-b border-l border-slate-200 px-2 text-left`}>
                {/* 계열 이름은 옆으로 넘겨도 왼쪽 편직처 칸 옆에 보이게 */}
                <span className={`sticky left-[158px] sm:left-[208px] inline-block text-[10px] font-extrabold px-1.5 py-px rounded-full border ${familyTone(config, g.family)}`}>{g.family} 계열</span>
              </th>
            ))}
            <th rowSpan={2} className={`sticky top-0 z-20 ${WORK_W} bg-slate-50 border-b border-l border-slate-200 px-3 py-1.5 text-left align-bottom text-[11px] font-bold text-slate-500`}>
              우리 작업 · 최근 메모
            </th>
          </tr>
          <tr>
            {cols.map(c => (
              <th key={c.type} className={`sticky top-7 z-20 ${TYPE_W} bg-slate-50 border-b border-l border-slate-200 px-2 py-1.5 text-left font-normal`}>
                <span className="flex items-center gap-1.5">
                  <TypeChip config={config} type={c.type} />
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap" title="보이는 편직처들의 이 종류 기계 대수">
                    {c.total ? `${fmtNum(c.total)}대` : ''}{c.unknown ? '+?' : ''}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(({ f, t, byType }) => {
            const jobs = jobsByFactory[f.id] || [];
            const knitting = jobs.filter(j => j.state === 'knitting').length;
            const waiting = jobs.length - knitting;
            const work = workByFactory[f.id];
            const memo = (f.memos || [])[0] || null;
            const open = () => onOpen(f.id);
            return (
              <tr key={f.id} tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(); }} className="group cursor-pointer outline-none">
                {/* 편직처 — 고정 */}
                <td className={`sticky left-0 z-10 ${NAME_W} ${ROW_BG} border-b border-r border-slate-200 px-3 py-2 align-top`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-extrabold text-slate-800 truncate group-hover:text-violet-700">{f.name}</span>
                    {f.region && <span className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded-full bg-violet-100 text-violet-700">{f.region}</span>}
                  </div>
                  <p className="leading-5 text-slate-500">
                    기계 <b className="text-slate-800">{t.total ? `${fmtNum(t.total)}대` : '?'}</b>
                    {t.cylinders > 0 && <> · 가마 <b className="text-slate-700">{fmtNum(t.cylinders)}</b></>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <CheckBadge factory={f} today={today} size="xs" />
                    {knitting > 0 && <span className="text-[10px] font-extrabold px-1.5 py-px rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="생산 현황에서 편직 중인 오더">● 편직 중 {knitting}</span>}
                    {waiting > 0 && <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-slate-50 text-slate-500 border border-slate-200" title="생산 현황에서 편직 대기 오더">○ 대기 {waiting}</span>}
                  </div>
                </td>
                {/* 종류 열 */}
                {cols.map(c => (
                  <td key={c.type} className={`${TYPE_W} ${ROW_BG} border-b border-l border-slate-100 px-2 py-2 align-top`}>
                    <TypeCell s={byType.get(c.type)} />
                  </td>
                ))}
                {/* 우리 작업 · 최근 메모 */}
                <td className={`${WORK_W} ${ROW_BG} border-b border-l border-slate-100 px-3 py-2 align-top`}>
                  <p className="flex flex-wrap items-center gap-x-2 leading-5 text-slate-600">
                    <span className="inline-flex items-center gap-0.5" title="이 편직처로 적힌 설계서"><FileText className="w-3 h-3 text-slate-400" /> 설계서 <b className="text-slate-800">{work?.sheets || 0}</b></span>
                    <span className="inline-flex items-center gap-0.5" title="이 편직처에 편직을 맡긴 생산 오더"><ClipboardList className="w-3 h-3 text-slate-400" /> 오더 <b className="text-slate-800">{work?.orders || 0}</b></span>
                    {work?.lastAt && <span className="text-[10px] text-slate-400">최근 {shortDate(work.lastAt)}</span>}
                  </p>
                  {memo ? (
                    <p className="flex items-start gap-1 text-slate-500" title={memo.text}>
                      <StickyNote className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2"><span className="text-[10px] text-slate-400">{shortDate(memo.date)}</span> {memo.text.replace(/\n+/g, ' ')}</span>
                    </p>
                  ) : <p className="text-[11px] text-slate-300">메모 없음</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
