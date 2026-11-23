import React from 'react';
import { ChevronRight, FileText, ClipboardList, StickyNote } from 'lucide-react';
import { factoryTotals, typeSummaries, fmtNum, inchLabel, gaugeRangeLabel } from '../../utils/knitFactoryModel';
import { TypeChip, CheckBadge } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — [편직처] 전체 목록 (대표님 요청 2026-11-24 '보기 쉽게 · 정보 더')
//  한 줄 = 편직처 하나, 칸 3개:
//   ① 편직처 — 이름 · 지역 · 확인일 · 편직 중
//   ② 기계 — 총 대수 · 가마 수, 종류마다 한 줄 (종류 · 게이지 범위 · 스판 · 인치별 대수)
//      종류 · 게이지 칸 너비를 정해 둬서 편직처가 달라도 인치가 같은 자리에서 시작 (같은 날 '줄 좀 맞춰')
//   ③ 우리 작업 · 메모 — 설계서 N · 오더 N · 최근 메모
//  · 연락처 칸은 뺌 (대표님 2026-11-24 '연락처 필요없어' — 상세에 있음)
//  · 종류별 열 표(옆으로 넘겨 보기)도 해 봤는데 이 모양이 낫다고 하셔서 되돌림 (2026-11-24)
//  줄을 누르면 상세
// ============================================================

const shortDate = (iso) => {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
};
// 칸 너비 — 줄 · 머리 같이 (아주 넓은 화면은 메모 칸을 넓게)
const COLS = 'lg:grid-cols-[200px_minmax(0,1fr)_280px_16px] 2xl:grid-cols-[220px_minmax(0,1fr)_360px_16px]';
// 기계 칸 안 — 종류 · 게이지 칸 너비 고정 (편직처끼리 줄이 맞게), 글자 기준선 맞춤
const TYPE_GRID = 'grid grid-cols-[minmax(104px,max-content)_minmax(92px,max-content)_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-baseline';

const FactoryRow = ({ factory: f, config, today, family = '', jobs = [], work, onOpen }) => {
  const t = factoryTotals(f, config);
  const types = typeSummaries(t.blocks);
  const knitting = jobs.filter(j => j.state === 'knitting').length;
  const waiting = jobs.length - knitting;
  const memo = (f.memos || [])[0] || null;
  const open = () => onOpen(f.id);
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(); }}
      className={`grid grid-cols-1 ${COLS} gap-x-4 gap-y-2 px-4 py-3 cursor-pointer hover:bg-violet-50/40 focus:bg-violet-50/60 outline-none`}>
      {/* ① 편직처 */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-extrabold text-slate-800 truncate">{f.name}</span>
          {f.region && <span className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded-full bg-violet-100 text-violet-700">{f.region}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <CheckBadge factory={f} today={today} size="xs" />
          {knitting > 0 && <span className="text-[10px] font-extrabold px-1.5 py-px rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="생산 현황에서 편직 중인 오더">● 편직 중 {knitting}</span>}
          {waiting > 0 && <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-slate-50 text-slate-500 border border-slate-200" title="생산 현황에서 편직 대기 오더">○ 대기 {waiting}</span>}
        </div>
      </div>

      {/* ② 기계 — 종류마다 한 줄 */}
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 mb-1">
          기계 <b className="text-sm text-slate-800">{t.total ? `${fmtNum(t.total)}대` : '대수 ?'}</b>
          {t.cylinders > 0 && <> · 보유 가마 <b className="text-slate-700">{fmtNum(t.cylinders)}개</b></>}
        </p>
        {types.length ? (
          <div className={TYPE_GRID}>
            {types.map(ty => {
              // 계열을 골랐으면 다른 계열 줄은 흐리게
              const dim = family && ty.family !== family ? 'opacity-35' : '';
              return (
              <React.Fragment key={ty.type}>
                <span className={dim}><TypeChip config={config} type={ty.type} /></span>
                {/* 게이지 범위 · 스판 — 길이가 비슷해서 앞에 두면 줄이 맞음 */}
                <span className={`flex items-baseline gap-1 whitespace-nowrap ${dim}`}>
                  <b className="font-mono text-xs text-slate-800">{gaugeRangeLabel(ty.gauges) || <span className="font-sans font-normal text-slate-300">게이지?</span>}</b>
                  {ty.spandex === 'yes' && <span className="text-[9px] font-extrabold px-1 rounded bg-pink-50 text-pink-700 border border-pink-200" title="스판장치 있는 기계가 있어요">스판</span>}
                </span>
                {/* 인치별 대수 — 길면 다음 줄로 */}
                <span className={`flex flex-wrap items-baseline gap-x-1 text-xs text-slate-700 min-w-0 ${dim}`}>
                  {ty.inches.length ? ty.inches.map((x, i) => (
                    <span key={`${x.inch}_${i}`} className="whitespace-nowrap">
                      {i > 0 && <span className="text-slate-300">· </span>}
                      <b className="font-mono">{inchLabel(x.inch) || '?"'}</b> {x.count ? `${fmtNum(x.count)}대` : ''}{x.unknown ? <span className="text-slate-400">{x.count ? '+?' : '대수?'}</span> : ''}
                    </span>
                  )) : <span className="text-slate-400">기계 줄 없음 (가마만)</span>}
                </span>
              </React.Fragment>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-400">기계 · 가마가 아직 없어요</p>}
      </div>

      {/* ③ 우리 작업 · 메모 */}
      <div className="min-w-0 text-xs space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 text-slate-600">
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
      </div>

      <ChevronRight className="hidden lg:block w-4 h-4 text-slate-300 self-center" />
    </div>
  );
};

export const KnitFactoryList = ({ rows = [], config, today, family = '', jobsByFactory = {}, workByFactory = {}, onOpen }) => (
  <div>
    <div className={`hidden lg:grid ${COLS} gap-x-4 px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500`}>
      <span>편직처</span><span>기계 — 종류 · 게이지 · 인치별 대수</span><span>우리 작업 · 최근 메모</span><span />
    </div>
    <div className="divide-y divide-slate-100">
      {rows.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-400">찾는 편직처가 없어요.</p>}
      {rows.map(f => (
        <FactoryRow key={f.id} factory={f} config={config} today={today} family={family} jobs={jobsByFactory[f.id] || []} work={workByFactory[f.id]} onOpen={onOpen} />
      ))}
    </div>
  </div>
);
