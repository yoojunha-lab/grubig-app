import React from 'react';
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react';
import { KNIT_CATEGORIES, groupMachines, machineNeedles, normalizeMachine, checkState, KNIT_CHECK_STALE_DAYS, categoryTone, fmtNum, feederLabel } from '../../utils/knitFactoryModel';

// ============================================================
// 편직처 기계 현황 — 여러 화면이 같이 쓰는 작은 부품 (대표님 요청 2026-11-23)
//  · CategoryChip(싱글·더블·자카드·기타) · GaugeChips(게이지 = 가마) · NeedleText(침수 — 빈 칸은 ≈ 계산 값)
//  · CheckBadge(기계 현황 확인일) · KnitMachineTable(종류 → 세부 종류로 묶은 기계 표 — 보기 전용)
// ============================================================


export const CategoryChip = ({ category, suffix = '' }) => {
  const cat = KNIT_CATEGORIES.find(c => c.key === category) || KNIT_CATEGORIES[3];
  return (
    <span className={`inline-flex items-center text-[10px] font-extrabold px-1.5 py-px rounded border whitespace-nowrap ${categoryTone(cat.key)}`} title={cat.hint || ''}>
      {cat.label}{suffix}
    </span>
  );
};

export const Dash = () => <span className="text-slate-300">—</span>;

/** 게이지(가마) — 여러 개면 칩 여러 개. hit = 찾는 게이지(진하게) · onPick 이 있으면 칩을 누를 수 있음 */
export const GaugeChips = ({ gauges, hit = [], onPick }) => {
  const list = gauges || [];
  if (!list.length) return <Dash />;
  return (
    <span className="inline-flex flex-wrap gap-0.5">
      {list.map(g => {
        const on = hit.includes(g);
        const cls = `font-mono text-[11px] font-bold px-1 py-px rounded border whitespace-nowrap ${on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-700 border-slate-300'}`;
        return onPick
          ? <button key={g} type="button" onClick={(e) => { e.stopPropagation(); onPick(g); }} title={`${g}G로 고르기`} className={`${cls} hover:ring-2 ring-violet-300`}>{g}G</button>
          : <span key={g} className={cls}>{g}G</span>;
      })}
    </span>
  );
};

/** 침수 — 넣은 값 / 없으면 게이지 × 3.14 × 인치 계산 값(회색 ≈) */
export const NeedleText = ({ machine }) => {
  const n = machineNeedles(machine);
  if (!n) return <Dash />;
  return n.estimated
    ? <span className="font-mono text-slate-400" title="침수를 안 적어서 게이지 × 3.14 × 인치로 계산한 값이에요 (실제와 다를 수 있어요)">≈{fmtNum(n.value)}</span>
    : <span className="font-mono">{fmtNum(n.value)}</span>;
};

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

const Th = ({ children, className = '' }) => <th className={`font-bold px-2 py-1.5 whitespace-nowrap ${className}`}>{children}</th>;

/** 기계 표 (보기 전용) — 종류 → 세부 종류 묶음, 넣은 순서 그대로 */
export const KnitMachineTable = ({ machines }) => {
  const cats = groupMachines((machines || []).map(normalizeMachine));
  if (!cats.length) return <p className="text-sm text-slate-400 py-6 text-center">기계 줄이 없어요. [수정]에서 넣어 주세요.</p>;
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full text-xs min-w-[760px]">
        <thead>
          <tr className="text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
            <Th>세부 종류</Th><Th className="text-right">대수</Th><Th className="text-right">인치</Th><Th>피더</Th>
            <Th className="text-right">침수</Th><Th>게이지 (가마)</Th><Th className="text-right">가마수</Th><Th>제조사</Th><Th>메모</Th>
          </tr>
        </thead>
        {cats.map(cat => (
          <tbody key={cat.key} className="divide-y divide-slate-100">
            <tr className="bg-slate-100/70">
              <td colSpan={9} className="px-2 py-1">
                <span className="inline-flex items-center gap-2">
                  <CategoryChip category={cat.key} />
                  <span className="text-[11px] font-bold text-slate-600">{cat.count ? `${fmtNum(cat.count)}대` : '대수 미기재'} · {cat.lines}줄</span>
                  {cat.hint && <span className="text-[10px] text-slate-400">{cat.hint}</span>}
                </span>
              </td>
            </tr>
            {cat.groups.map(g => g.rows.map((m, i) => (
              <tr key={m.id} className="hover:bg-violet-50/40">
                <td className="px-2 py-1 text-slate-700 font-bold whitespace-nowrap">{i === 0 ? (g.name || <span className="text-slate-300 font-normal">—</span>) : ''}</td>
                <td className="px-2 py-1 text-right font-mono">{m.count ? fmtNum(m.count) : <Dash />}</td>
                <td className="px-2 py-1 text-right font-mono">{m.inch ? `${m.inch}"` : <Dash />}</td>
                <td className="px-2 py-1 font-mono">{m.feeder ? feederLabel(m.feeder) : <Dash />}</td>
                <td className="px-2 py-1 text-right"><NeedleText machine={m} /></td>
                <td className="px-2 py-1"><GaugeChips gauges={m.gauges} /></td>
                <td className="px-2 py-1 text-right font-mono">{m.cylinders ? fmtNum(m.cylinders) : <Dash />}</td>
                <td className="px-2 py-1 whitespace-nowrap">{m.maker || <Dash />}</td>
                <td className="px-2 py-1 text-slate-500 max-w-[260px]">{m.note || ''}</td>
              </tr>
            )))}
          </tbody>
        ))}
      </table>
    </div>
  );
};
