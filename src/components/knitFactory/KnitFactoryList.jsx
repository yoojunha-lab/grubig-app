import React from 'react';
import { ChevronRight, Phone, User, FileText, ClipboardList, StickyNote } from 'lucide-react';
import { factoryTotals, typeSummaries, fmtNum, inchLabel, gaugeRangeLabel } from '../../utils/knitFactoryModel';
import { TypeChip, CheckBadge } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — [편직처] 전체 목록 (대표님 요청 2026-11-24 '보기 쉽게 · 정보 더')
//  한 줄 = 편직처 하나, 칸 4개:
//   ① 편직처 — 이름 · 지역 · 확인일 · 편직 중
//   ② 기계 — 총 대수 · 가마 수, 종류마다 한 줄 (게이지 범위 · 스판 · 인치별 대수)
//   ③ 연락처 — 대표 담당자 · 핸드폰 · 전화 (누르면 전화)
//   ④ 우리 작업 · 메모 — 설계서 N · 오더 N · 최근 메모
//  줄을 누르면 상세 (전화 번호를 누르면 전화만)
// ============================================================

// '031-858-5756~7' · '010-1234-5678 / 010-…' → 첫 번호만
const telHref = (s) => `tel:${String(s || '').split(/[/~,]/)[0].replace(/[^\d+]/g, '')}`;
const shortDate = (iso) => {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
};
const stop = (e) => e.stopPropagation();
// 칸 너비 — 줄 · 머리 같이 (아주 넓은 화면은 연락처 · 메모 칸을 넓게)
const COLS = 'lg:grid-cols-[200px_minmax(0,1fr)_170px_230px_16px] 2xl:grid-cols-[220px_minmax(0,1fr)_200px_320px_16px]';

const FactoryRow = ({ factory: f, config, today, family = '', jobs = [], work, onOpen }) => {
  const t = factoryTotals(f, config);
  const types = typeSummaries(t.blocks);
  const knitting = jobs.filter(j => j.state === 'knitting').length;
  const waiting = jobs.length - knitting;
  const contact = (f.contacts || []).find(c => c.mobile) || (f.contacts || []).find(c => c.name) || null;
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
          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-start">
            {types.map(ty => {
              // 계열을 골랐으면 다른 계열 줄은 흐리게
              const dim = family && ty.family !== family ? 'opacity-35' : '';
              return (
              <React.Fragment key={ty.type}>
                <span className={`pt-px ${dim}`}><TypeChip config={config} type={ty.type} /></span>
                {/* 게이지 범위 · 스판 — 길이가 비슷해서 앞에 두면 줄이 맞음 */}
                <span className={`flex items-center gap-1 whitespace-nowrap ${dim}`}>
                  <b className="font-mono text-xs text-slate-800">{gaugeRangeLabel(ty.gauges) || <span className="font-sans font-normal text-slate-300">게이지?</span>}</b>
                  {ty.spandex === 'yes' && <span className="text-[9px] font-extrabold px-1 rounded bg-pink-50 text-pink-700 border border-pink-200" title="스판장치 있는 기계가 있어요">스판</span>}
                </span>
                {/* 인치별 대수 — 길면 다음 줄로 */}
                <span className={`flex flex-wrap items-center gap-x-1 text-xs text-slate-700 min-w-0 ${dim}`}>
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

      {/* ③ 연락처 */}
      <div className="min-w-0 text-xs space-y-0.5">
        {contact ? (
          <p className="flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-700 truncate">{contact.name || '담당자'}</span>
          </p>
        ) : null}
        {contact?.mobile && (
          <a href={telHref(contact.mobile)} onClick={stop} className="block font-mono text-slate-700 hover:text-violet-700 pl-4">{contact.mobile}</a>
        )}
        {f.phone && (
          <a href={telHref(f.phone)} onClick={stop} className="flex items-center gap-1 font-mono text-slate-500 hover:text-violet-700">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />{f.phone}
          </a>
        )}
        {!contact && !f.phone && <p className="text-slate-300">연락처 없음</p>}
      </div>

      {/* ④ 우리 작업 · 메모 */}
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
      <span>편직처</span><span>기계 — 종류 · 게이지 · 인치별 대수</span><span>연락처</span><span>우리 작업 · 최근 메모</span><span />
    </div>
    <div className="divide-y divide-slate-100">
      {rows.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-400">찾는 편직처가 없어요.</p>}
      {rows.map(f => (
        <FactoryRow key={f.id} factory={f} config={config} today={today} family={family} jobs={jobsByFactory[f.id] || []} work={workByFactory[f.id]} onOpen={onOpen} />
      ))}
    </div>
  </div>
);
