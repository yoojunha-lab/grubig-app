import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarX, Check, AlertTriangle } from 'lucide-react';
import {
  buildBlocks, checkState, KNIT_CHECK_STALE_DAYS, typeTone, isKnownType, fmtNum, feederLabel, inchLabel,
  needlesFor, gaugeRangeLabel, feedersInNote,
} from '../../utils/knitFactoryModel';

// ============================================================
// 편직처 기계 현황 — 여러 화면이 같이 쓰는 부품 (대표님 요청 2026-11-23, 2차)
//  · TypeChip(종류 — 계열 색) · GaugeChips(게이지 칩) · NeedleText(침수 — 계산 값은 회색 ≈)
//  · CheckBadge(확인일) · SpandexText · BlockSummary(목록 한 줄 요약)
//  · KnitBlocks — 상세 화면 기계 현황: '종류 + 인치' 묶음(가마를 돌려 쓰는 단위)마다 기계 줄 + 보유 가마
//    onSetGauge 가 있으면 '지금 가마' 칸을 눌러 바로 바꿈
// ============================================================

export const Dash = () => <span className="text-slate-300">—</span>;

export const TypeChip = ({ config, type, suffix = '' }) => {
  const known = isKnownType(config, type);
  return (
    <span title={known ? '' : '[⚙ 기계 종류] 설정에 없는 종류예요'}
      className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-px rounded border whitespace-nowrap ${typeTone(config, type)}`}>
      {type || '종류 없음'}{!known && <AlertTriangle className="w-2.5 h-2.5" />}{suffix}
    </span>
  );
};

/** 게이지 칩 — hit(진하게) · mounted(지금 꼽힘 — 테두리 진하게) · onPick 이 있으면 누를 수 있음 · counts = { 게이지: 가마 개수 } */
export const GaugeChips = ({ gauges, hit = [], mounted = [], onPick, counts = {} }) => {
  const list = gauges || [];
  if (!list.length) return <Dash />;
  return (
    <span className="inline-flex flex-wrap gap-0.5">
      {list.map(g => {
        const on = hit.includes(g);
        const isMounted = mounted.includes(g);
        const cls = `font-mono text-[11px] font-bold px-1 py-px rounded border whitespace-nowrap ${on
          ? 'bg-violet-600 text-white border-violet-600'
          : isMounted ? 'bg-white text-slate-800 border-slate-600' : 'bg-white text-slate-500 border-slate-300'}`;
        const label = `${g}G${counts[g] ? ` ${counts[g]}개` : ''}`;
        const title = `${isMounted ? '지금 꼽혀 있음' : '보유 가마'}${counts[g] ? ` ${counts[g]}개` : ''}`;
        return onPick
          ? <button key={g} type="button" onClick={(e) => { e.stopPropagation(); onPick(g); }} title={`${g}G로 고르기 — ${title}`} className={`${cls} hover:ring-2 ring-violet-300`}>{label}</button>
          : <span key={g} title={title} className={cls}>{label}</span>;
      })}
    </span>
  );
};

/** 침수 { value, estimated } — 계산 값은 회색 ≈ */
export const NeedleText = ({ needles }) => {
  if (!needles) return <Dash />;
  return needles.estimated
    ? <span className="font-mono text-slate-400" title="침수를 안 적어서 게이지 × 3.14 × 인치로 계산한 값이에요 (실제와 다를 수 있어요)">≈{fmtNum(needles.value)}</span>
    : <span className="font-mono">{fmtNum(needles.value)}</span>;
};

export const SpandexText = ({ value }) => (value === 'yes'
  ? <span className="text-[10px] font-extrabold px-1 py-px rounded bg-pink-50 text-pink-700 border border-pink-200 whitespace-nowrap">스판 있음</span>
  : value === 'no'
    ? <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">스판 없음</span>
    : <span className="text-[10px] text-slate-300 whitespace-nowrap">모름</span>);

/** 기계 현황 확인일 배지 */
export const CheckBadge = ({ factory, today, size = 'sm' }) => {
  const st = checkState(factory, today);
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stale: 'bg-amber-50 text-amber-700 border-amber-300',
    none: 'bg-slate-50 text-slate-500 border-slate-200',
  }[st.tone];
  const Icon = st.tone === 'ok' ? CalendarCheck : st.tone === 'stale' ? CalendarClock : CalendarX;
  const title = st.tone === 'stale'
    ? `기계 현황을 확인한 지 ${KNIT_CHECK_STALE_DAYS / 30}개월이 넘었어요 — 편직처에 물어보고 [오늘 확인함]을 눌러 주세요`
    : st.tone === 'none' ? '기계 현황을 언제 확인했는지 기록이 없어요' : '기계 현황 마지막 확인일';
  return (
    <span title={title} className={`inline-flex items-center gap-1 font-bold rounded border whitespace-nowrap ${size === 'xs' ? 'text-[10px] px-1 py-px' : 'text-[11px] px-1.5 py-0.5'} ${cls}`}>
      <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} /> {st.label}
    </span>
  );
};

/** 목록 한 줄 요약 — 묶음(종류 + 인치)마다 '싱글 30" 12대 · 지금 24·28G · 가마 18~32G' */
export const BlockSummary = ({ blocks, config }) => {
  if (!blocks.length) return <span className="text-xs text-slate-400">기계 · 가마가 아직 없어요</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {blocks.map(b => {
        const spare = b.cylinders.some(c => !b.mounted.includes(c.gauge));
        return (
          <span key={b.key} className="inline-flex flex-wrap items-center gap-1 text-[11px] bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 max-w-full">
            <TypeChip config={config} type={b.type} />
            <b className="font-mono text-slate-800">{inchLabel(b.inch) || '인치?'}</b>
            <span className="text-slate-700 font-bold">{b.machines.length ? (b.countKnown ? `${fmtNum(b.count)}대` : '대수?') : '기계 없음'}</span>
            {b.mounted.length > 0 && <span className="text-slate-500">· 지금 <b className="font-mono text-slate-700">{gaugeRangeLabel(b.mounted)}</b></span>}
            {spare && <span className="text-slate-500">· 가마 <b className="font-mono text-slate-700">{gaugeRangeLabel(b.gauges)}</b></span>}
          </span>
        );
      })}
    </div>
  );
};

// '지금 가마' 바로 바꾸기 — 그 묶음의 게이지 칩 + 직접 넣기
//  창은 화면 기준(fixed)으로 띄움 — 표의 가로 스크롤 칸 안에서는 아래가 잘려 보였음. 스크롤하면 닫힘
const GaugeSwitcher = ({ machine, block, onSave }) => {
  const [pos, setPos] = useState(null);   // 열려 있으면 { top, left }
  const open = !!pos;
  const setOpen = (v) => {
    if (!v) { setPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = 224;
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 170), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  };
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setPos(null);
    };
    const closeNow = () => setPos(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeNow, true);
    window.addEventListener('resize', closeNow);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeNow, true);
      window.removeEventListener('resize', closeNow);
    };
  }, [open]);
  const save = async (g) => {
    if (busy) return;
    setBusy(true);
    try { if (await onSave(g)) { setOpen(false); setText(''); } } finally { setBusy(false); }
  };
  return (
    <span className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} title="지금 꼽힌 가마 바꾸기 (누르면 바로 저장 · 확인일 오늘로)"
        className={`font-mono text-[11px] font-bold px-1.5 py-px rounded border ${machine.gauge ? 'bg-white text-slate-800 border-slate-600 hover:bg-violet-50' : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:bg-violet-50'}`}>
        {machine.gauge ? `${machine.gauge}G` : '모름'}
      </button>
      {open && (
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left }} className="z-[60] bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-56 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-500">지금 꼽힌 가마 바꾸기 (바로 저장)</p>
          {block.gauges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {block.gauges.map(g => (
                <button key={g} type="button" disabled={busy} onClick={() => save(g)}
                  className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded border ${g === machine.gauge ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-slate-300 hover:border-violet-400'}`}>
                  {g}G
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <input value={text} onChange={e => setText(e.target.value)} inputMode="decimal" placeholder="직접 (예: 26)"
              onKeyDown={e => { if (e.key === 'Enter' && Number(text) > 0) save(Number(text)); }}
              className="flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono outline-none focus:ring-2 ring-violet-200" />
            <button type="button" disabled={busy || !(Number(text) > 0)} onClick={() => save(Number(text))}
              className="px-1.5 rounded bg-violet-600 text-white disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
          </div>
          {machine.gauge && <button type="button" disabled={busy} onClick={() => save(null)} className="text-[10px] text-slate-500 underline">모름으로 비우기</button>}
        </div>
      )}
    </span>
  );
};

/** 상세 화면 기계 현황 — 종류 + 인치 묶음마다 기계 줄 + 보유 가마 */
// 편직 중 · 대기 오더 칩 (생산 현황 연결 — 2026-11-24)
const JobChip = ({ job }) => (
  <span title={`${job.order.orderNumber || '(order# 없음)'} ${job.order.articleNo || ''} — ${job.state === 'knitting' ? '편직 중' : '편직 대기'}${job.gauge ? ` · ${job.gauge}G` : ''} (생산 현황)`}
    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-px rounded-full border whitespace-nowrap ${job.state === 'knitting' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-300'}`}>
    {job.state === 'knitting' ? '● 편직 중' : '○ 대기'} {job.order.orderNumber || '?'}{job.gauge ? ` · ${job.gauge}G` : ''}
  </span>
);
export const KnitJobChips = ({ jobs = [] }) => (jobs.length ? <span className="inline-flex flex-wrap gap-1">{jobs.map(j => <JobChip key={j.order.id} job={j} />)}</span> : null);

export const KnitBlocks = ({ factory, config, onSetGauge, jobs = [] }) => {
  const blocks = buildBlocks(factory, config);
  if (!blocks.length) return <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">기계 · 가마가 아직 없어요. 위 [기계 수정]을 눌러 넣어 주세요.</p>;
  return (
    <div className="space-y-2.5">
      {blocks.map(b => (
        <div key={b.key} className="border border-slate-200 rounded-xl">
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 rounded-t-xl">
            <TypeChip config={config} type={b.type} />
            <b className="font-mono text-sm text-slate-800">{inchLabel(b.inch) || '인치 없음'}</b>
            <span className="text-xs font-bold text-slate-600">기계 {b.machines.length ? (b.countKnown ? `${fmtNum(b.count)}대` : '대수 미기재') : '없음'}</span>
            {b.cylinders.length > 0 && <span className="text-xs text-slate-500">· 보유 가마 {b.cylinderCount ? `${fmtNum(b.cylinderCount)}개` : `${b.cylinders.length}종`}</span>}
            {!b.machines.length && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">이 가마를 낄 기계 줄이 없어요</span>}
            <span className="ml-auto"><KnitJobChips jobs={jobs.filter(j => j.blockKey === b.key)} /></span>
          </div>
          {b.machines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-[10px] text-slate-400 text-left">
                    <th className="font-bold px-3 py-1 w-16 text-right">대수</th>
                    <th className="font-bold px-2 py-1 w-20">피더</th>
                    <th className="font-bold px-2 py-1 w-20">지금 가마</th>
                    <th className="font-bold px-2 py-1 w-20 text-right">침수</th>
                    <th className="font-bold px-2 py-1 w-20">스판장치</th>
                    <th className="font-bold px-2 py-1 w-20">제조사</th>
                    <th className="font-bold px-2 py-1">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.machines.map(m => (
                    <tr key={m.id}>
                      <td className="px-3 py-1 text-right font-mono font-bold">{m.count ? fmtNum(m.count) : <Dash />}</td>
                      <td className="px-2 py-1 font-mono">{feederLabel(m.feeder) || <Dash />}</td>
                      <td className="px-2 py-1">
                        {onSetGauge
                          ? <GaugeSwitcher machine={m} block={b} onSave={(g) => onSetGauge(m.id, g)} />
                          : (m.gauge ? <span className="font-mono font-bold">{m.gauge}G</span> : <Dash />)}
                      </td>
                      <td className="px-2 py-1 text-right"><NeedleText needles={m.gauge ? needlesFor(factory, m.type, m.inch, m.gauge, m.needles) : null} /></td>
                      <td className="px-2 py-1"><SpandexText value={m.spandex} /></td>
                      <td className="px-2 py-1 whitespace-nowrap">{m.maker || <Dash />}</td>
                      <td className="px-2 py-1 text-slate-500">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {b.cylinders.length > 0 && (
            <div className="px-3 py-1.5 border-t border-slate-100 bg-white rounded-b-xl flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-500">보유 가마</span>
              {b.cylinders.map(c => (
                <span key={c.id} title={[c.needles && `침수 ${fmtNum(c.needles)}`, c.note].filter(Boolean).join(' · ') || ''}
                  className={`inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-px rounded border ${b.mounted.includes(c.gauge) ? 'border-slate-600 text-slate-800' : 'border-slate-300 text-slate-600'}`}>
                  <b>{c.gauge}G</b>
                  <span className="font-sans">가마 {c.count ? `${c.count}개` : '개수 모름'}</span>
                  {c.needles ? <span className="text-slate-400">· {fmtNum(c.needles)}침</span> : null}
                  {c.note ? <span className="font-sans text-slate-400">· {c.note}</span> : null}
                </span>
              ))}
              <span className="text-[10px] text-slate-400">진한 테두리 = 지금 꼽혀 있는 게이지</span>
              {b.cylinders.some(c => feedersInNote(c.note).length) && (
                <span className="text-[10px] font-bold text-amber-700" title="피더는 기계 것이에요 — [기계 수정]에서 기계 줄 피더 칸에 적고 가마 메모에서는 지워 주세요">⚠ 가마 메모에 피더가 있어요</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
