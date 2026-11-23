import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Copy, Trash2, Save, X, Loader2, Info } from 'lucide-react';
import {
  KNIT_MAKERS, SPANDEX_OPTIONS, buildBlocks, makeBlankMachine, makeBlankCylinder, estimateNeedles, isKnownType, UNGROUPED_FAMILY, typeTone,
  feedersInNote, stripFeederFromNote,
} from '../../utils/knitFactoryModel';

// ============================================================
// 편직처 상세 [기계 수정] — 상세 화면에서 바로 기계 · 보유 가마 고치기 (대표님 요청 2026-11-24 '이 화면에서 바로, 그게 간단')
//  · 카드 = 종류 + 인치 묶음 (가마를 돌려 쓰는 단위). 카드 머리에서 종류 · 인치를 바꾸면 그 카드의 기계 · 가마가 같이 바뀜
//  · 기계 줄: 대수 · 피더 · 지금 가마 · 침수 · 스판장치 · 제조사 · 메모 — 줄 추가 · 복사 · 지우기 (피더는 기계마다, 가마에는 없음)
//  · 보유 가마: 게이지 · 개수(꽂힌 것 포함) · 침수 · 메모 — 추가 · 지우기 · '18, 22, 24' 한 번에
//  · [+ 종류 · 인치 추가] 새 카드 · [저장] 한 번에 저장(확인일 오늘) · [취소] 버림 — 저장 줄은 맨 위 (내려가면 위 메뉴 밑에 떠 있음)
//  · 화면을 나가기 전에 저장 안 한 변경이 있으면 묻는 건 KnitFactoryDetail · KnitFactoryPage
// ============================================================

const cell = 'w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 ring-violet-200 focus:border-violet-300';
const toText = (v) => (v === null || v === undefined ? '' : String(v));
let seq = 0;
const bid = () => `blk_${Date.now().toString(36)}_${(seq += 1)}`;

const toRowM = (m) => ({
  id: m.id, count: toText(m.count), feeder: toText(m.feeder), gauge: toText(m.gauge), needles: toText(m.needles),
  spandex: m.spandex || '', maker: toText(m.maker), note: toText(m.note),
});
const toRowC = (c) => ({ id: c.id, gauge: toText(c.gauge), count: toText(c.count), needles: toText(c.needles), note: toText(c.note) });

// 편직처 문서 → 카드 목록 (보기 화면과 같은 순서)
const toDraft = (factory, config) => buildBlocks(factory, config).map(b => ({
  bid: bid(), type: b.type, inch: toText(b.inch), machines: b.machines.map(toRowM), cylinders: b.cylinders.map(toRowC),
}));
// 카드 목록 → 저장 모양 (줄마다 카드의 종류 · 인치)
const draftToEquipment = (draft) => ({
  machines: draft.flatMap(b => b.machines.map(m => ({ ...m, type: b.type, inch: b.inch }))),
  cylinders: draft.flatMap(b => b.cylinders.map(c => ({ ...c, type: b.type, inch: b.inch }))),
});

// 종류 고르기 — 설정 목록을 계열로 묶어서, 설정에 없는 예전 값도 보이게
const TypeSelect = ({ value, config, onChange, className = '' }) => {
  const known = isKnownType(config, value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={`${cell} ${!value ? 'border-red-300 bg-red-50/40' : ''} ${className}`}>
      <option value="">종류 고르기</option>
      {value && !known && <option value={value}>{value} (설정에 없음)</option>}
      {(config?.families || []).map(fam => {
        const types = (config?.types || []).filter(t => t.family === fam);
        if (!types.length) return null;
        return (
          <optgroup key={fam} label={fam === UNGROUPED_FAMILY ? '미분류' : `${fam} 계열`}>
            {types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
};

export const KnitEquipmentEditor = ({
  factory,
  config,
  knitFactories = [],   // 제조사 자동 완성
  onSave,               // ({ machines, cylinders }) => 저장했으면 true
  onCancel,
  onDirtyChange,        // (true/false) — 나갈 때 묻기
}) => {
  const [baseline] = useState(() => toDraft(factory, config));
  const [draft, setDraft] = useState(baseline);
  const [bulk, setBulk] = useState({});           // 카드마다 '가마 한 번에' 글자 { [bid]: '18, 22' }
  const [adding, setAdding] = useState(null);     // 새 카드 { type, inch }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  // 저장 줄이 화면 위로 지나가면 위에 떠 있는 저장 줄을 보여 줌 (앱 화면 칸이 overflow-x-hidden 이라 CSS sticky 가 안 먹음)
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const [floatBox, setFloatBox] = useState(null);   // { left, width } | null
  useEffect(() => {
    const HEADER = 64;                                // 위 메뉴 높이
    const check = () => {
      const bar = barRef.current?.getBoundingClientRect();
      const root = rootRef.current?.getBoundingClientRect();
      if (!bar || !root) return;
      const show = bar.bottom < HEADER && root.bottom > HEADER + 120;
      setFloatBox(prev => {
        if (!show) return null;
        if (prev && prev.left === root.left && prev.width === root.width) return prev;
        return { left: root.left, width: root.width };
      });
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  const listId = useMemo(() => `kme_${Math.random().toString(36).slice(2, 7)}`, []);
  const makerList = useMemo(() => [...new Set([...KNIT_MAKERS, ...knitFactories.flatMap(f => (f.machines || []).map(m => String(m.maker || '').trim()))].filter(Boolean))], [knitFactories]);

  const dirty = JSON.stringify(draftToEquipment(draft)) !== JSON.stringify(draftToEquipment(baseline));
  // 바깥(상세 · 편직처 화면)에 알림 — 나갈 때 '버릴까요?'
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const setBlock = (b, fields) => setDraft(prev => prev.map(x => (x.bid === b ? { ...x, ...fields } : x)));
  const setRow = (b, key, id, fields) => setDraft(prev => prev.map(x => (x.bid === b ? { ...x, [key]: x[key].map(r => (r.id === id ? { ...r, ...fields } : r)) } : x)));
  const removeRow = (b, key, id) => setDraft(prev => prev.map(x => (x.bid === b ? { ...x, [key]: x[key].filter(r => r.id !== id) } : x)));
  const copyRow = (b, id) => setDraft(prev => prev.map(x => {
    if (x.bid !== b) return x;
    const i = x.machines.findIndex(r => r.id === id);
    const list = [...x.machines];
    list.splice(i + 1, 0, { ...x.machines[i], id: makeBlankMachine().id });
    return { ...x, machines: list };
  }));
  const addMachine = (b) => setDraft(prev => prev.map(x => {
    if (x.bid !== b) return x;
    const last = x.machines[x.machines.length - 1];
    return { ...x, machines: [...x.machines, { ...toRowM(makeBlankMachine()), feeder: last?.feeder || '', spandex: last?.spandex || '', maker: last?.maker || '' }] };
  }));
  const addCylinder = (b) => setDraft(prev => prev.map(x => (x.bid === b ? { ...x, cylinders: [...x.cylinders, toRowC(makeBlankCylinder())] } : x)));
  const addBulk = (b) => {
    const gauges = [...new Set((String(bulk[b] || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n <= 90))];
    if (!gauges.length) return;
    setDraft(prev => prev.map(x => {
      if (x.bid !== b) return x;
      const have = new Set(x.cylinders.map(c => Number(c.gauge)));
      return { ...x, cylinders: [...x.cylinders, ...gauges.filter(g => !have.has(g)).map(g => ({ ...toRowC(makeBlankCylinder()), gauge: String(g) }))] };
    }));
    setBulk(prev => ({ ...prev, [b]: '' }));
  };
  // 가마 메모에 섞인 피더(48F 등) 지우기 — 피더는 기계 것 (2026-11-24)
  const stripFeeders = (b) => setDraft(prev => prev.map(x => (x.bid === b
    ? { ...x, cylinders: x.cylinders.map(c => (feedersInNote(c.note).length ? { ...c, note: stripFeederFromNote(c.note) } : c)) }
    : x)));
  const removeBlock = (b) => {
    const x = draft.find(y => y.bid === b);
    if (x && (x.machines.length || x.cylinders.length)
      && !window.confirm(`${x.type || '종류 없음'} ${x.inch ? `${x.inch}"` : ''} 카드를 지울까요?\n기계 ${x.machines.length}줄 · 가마 ${x.cylinders.length}줄이 같이 빠져요 (저장해야 반영돼요).`)) return;
    setDraft(prev => prev.filter(y => y.bid !== b));
  };
  const addBlock = () => {
    if (!adding?.type) { setError('새 카드의 종류를 골라 주세요.'); return; }
    setDraft(prev => [...prev, { bid: bid(), type: adding.type, inch: adding.inch, machines: [toRowM(makeBlankMachine())], cylinders: [] }]);
    setAdding(null);
    setError('');
  };

  const save = async () => {
    if (busyRef.current) return;
    if (draft.some(b => !b.type)) { setError('종류를 고르지 않은 카드가 있어요.'); return; }
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      if (await onSave(draftToEquipment(draft))) onCancel();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const cancel = () => {
    if (dirty && !window.confirm('저장 안 한 기계 수정이 있어요. 버릴까요?')) return;
    onCancel();
  };

  // 저장 줄 (맨 위 · 떠 있는 것 같이 씀)
  const saveBar = (extra) => (
    <div className={`flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-sm px-3 py-2 ${extra}`}>
      <span className="text-xs">
        {error ? <b className="text-red-600">{error}</b>
          : dirty ? <b className="text-amber-600">● 저장 안 한 변경 있음</b>
            : <span className="text-slate-400">고친 내용이 없어요</span>}
        <span className="ml-2 text-[10px] text-slate-400">저장하면 확인일이 오늘로 바뀌어요</span>
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={cancel} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg hover:bg-slate-50 text-sm font-bold">취소</button>
        <button type="button" onClick={save} disabled={busy || !dirty}
          className="bg-violet-600 text-white px-5 py-1.5 rounded-lg hover:bg-violet-700 text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
        </button>
      </span>
    </div>
  );

  return (
    <div ref={rootRef} className="space-y-2.5">
      {/* 저장 줄 — 맨 위 (대표님 요청 2026-11-24 '취소 · 저장 위로'). 내려가면 같은 줄이 위 메뉴 밑에 떠 있음 */}
      <div ref={barRef}>{saveBar('')}</div>
      {floatBox && (
        <div className="fixed top-[68px] z-30" style={{ left: floatBox.left, width: floatBox.width }}>
          {saveBar('shadow-xl ring-1 ring-violet-200')}
        </div>
      )}
      <p className="text-[11px] text-slate-500 flex items-start gap-1">
        <Info className="w-3.5 h-3.5 mt-px shrink-0" />
        카드 = 종류 + 인치 (그 안의 기계끼리 가마를 돌려 써요). 칸을 고친 뒤 위 [저장]을 눌러야 저장돼요. 침수를 비우면 게이지 × 3.14 × 인치로 보여 줘요.
      </p>

      {draft.map(b => (
        <div key={b.bid} className="border border-violet-200 rounded-xl bg-white">
          {/* 카드 머리 — 종류 · 인치 */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-violet-50/60 border-b border-violet-100 rounded-t-xl">
            <TypeSelect value={b.type} config={config} onChange={v => setBlock(b.bid, { type: v })} className={`!w-40 !text-sm font-bold ${b.type ? typeTone(config, b.type) : ''}`} />
            <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
              <input value={b.inch} onChange={e => setBlock(b.bid, { inch: e.target.value })} inputMode="decimal" placeholder="인치"
                className={`${cell} !w-16 !text-sm font-mono font-bold text-right`} />"
            </label>
            <span className="text-[11px] text-slate-500">기계 {b.machines.length}줄 · 가마 {b.cylinders.length}줄</span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" onClick={() => addMachine(b.bid)} className="text-[11px] font-bold text-violet-700 bg-white border border-violet-200 rounded-lg px-2 py-1 hover:bg-violet-50 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> 기계 줄</button>
              <button type="button" onClick={() => addCylinder(b.bid)} className="text-[11px] font-bold text-sky-700 bg-white border border-sky-200 rounded-lg px-2 py-1 hover:bg-sky-50 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> 보유 가마</button>
              <button type="button" onClick={() => removeBlock(b.bid)} title="이 카드 지우기" className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="w-4 h-4" /></button>
            </span>
          </div>

          {/* 기계 줄 */}
          {b.machines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="text-[10px] text-slate-400 text-left">
                    <th className="font-bold px-1.5 pt-1.5 w-16">대수</th>
                    <th className="font-bold px-1.5 pt-1.5 w-20">피더</th>
                    <th className="font-bold px-1.5 pt-1.5 w-20">지금 가마</th>
                    <th className="font-bold px-1.5 pt-1.5 w-20">침수</th>
                    <th className="font-bold px-1.5 pt-1.5 w-20">스판장치</th>
                    <th className="font-bold px-1.5 pt-1.5 w-24">제조사</th>
                    <th className="font-bold px-1.5 pt-1.5">메모</th>
                    <th className="w-14" />
                  </tr>
                </thead>
                <tbody>
                  {b.machines.map(m => {
                    const est = estimateNeedles(m.gauge, b.inch);
                    const set = (fields) => setRow(b.bid, 'machines', m.id, fields);
                    return (
                      <tr key={m.id}>
                        <td className="px-1.5 py-1"><input value={m.count} onChange={e => set({ count: e.target.value })} inputMode="numeric" placeholder="?" className={`${cell} font-mono text-right`} /></td>
                        <td className="px-1.5 py-1"><input value={m.feeder} onChange={e => set({ feeder: e.target.value })} className={`${cell} font-mono`} /></td>
                        <td className="px-1.5 py-1"><input value={m.gauge} onChange={e => set({ gauge: e.target.value })} inputMode="decimal" placeholder="G" className={`${cell} font-mono text-right font-bold`} /></td>
                        <td className="px-1.5 py-1"><input value={m.needles} onChange={e => set({ needles: e.target.value })} inputMode="numeric" placeholder={est ? `≈${est}` : ''} className={`${cell} font-mono text-right`} /></td>
                        <td className="px-1.5 py-1">
                          <select value={m.spandex} onChange={e => set({ spandex: e.target.value })} className={cell}>
                            {SPANDEX_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-1.5 py-1"><input value={m.maker} onChange={e => set({ maker: e.target.value })} list={`${listId}_maker`} className={cell} /></td>
                        <td className="px-1.5 py-1"><input value={m.note} onChange={e => set({ note: e.target.value })} className={cell} /></td>
                        <td className="px-1 py-1 whitespace-nowrap text-right">
                          <button type="button" onClick={() => copyRow(b.bid, m.id)} title="이 줄 복사 (바로 아래에)" className="p-1 text-slate-400 hover:text-violet-600"><Copy className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => removeRow(b.bid, 'machines', m.id)} title="이 줄 지우기" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 보유 가마 */}
          <div className="px-3 py-2 border-t border-slate-100 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1">보유 가마</span>
              {b.cylinders.map(c => {
                const set = (fields) => setRow(b.bid, 'cylinders', c.id, fields);
                return (
                  <span key={c.id} className="inline-flex items-center gap-0.5 bg-sky-50/60 border border-sky-200 rounded-lg pl-1 pr-0.5 py-0.5">
                    <input value={c.gauge} onChange={e => set({ gauge: e.target.value })} inputMode="decimal" placeholder="G" title="게이지" className={`${cell} !w-12 font-mono font-bold text-right`} />
                    <span className="text-[10px] text-slate-500">G 가마</span>
                    <input value={c.count} onChange={e => set({ count: e.target.value })} inputMode="numeric" placeholder="?" title="가마 개수 (꽂힌 것 포함)" className={`${cell} !w-10 font-mono text-right`} />
                    <span className="text-[10px] text-slate-500 mr-0.5">개</span>
                    <input value={c.needles} onChange={e => set({ needles: e.target.value })} inputMode="numeric" placeholder={estimateNeedles(c.gauge, b.inch) ? `≈${estimateNeedles(c.gauge, b.inch)}침` : '침수'} title="침수" className={`${cell} !w-16 font-mono text-right`} />
                    <input value={c.note} onChange={e => set({ note: e.target.value })} placeholder="메모" title="메모" className={`${cell} !w-24`} />
                    <button type="button" onClick={() => removeRow(b.bid, 'cylinders', c.id)} title="이 가마 지우기" className="p-0.5 text-slate-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </span>
                );
              })}
              {!b.cylinders.length && <span className="text-[11px] text-slate-400">없음 (게이지가 안 바뀌는 기계면 '지금 가마'만 적어도 돼요)</span>}
            </div>
            {(() => {
              const found = [...new Set(b.cylinders.flatMap(c => feedersInNote(c.note)))];
              return found.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  가마 메모에 피더({found.join(' · ')})가 있어요 — 피더는 가마가 아니라 기계 것이라 위 기계 줄 피더 칸에 적어 주세요.
                  <button type="button" onClick={() => stripFeeders(b.bid)} className="font-bold underline hover:text-amber-900">메모에서 피더 지우기</button>
                </div>
              );
            })()}
            <div className="flex items-center gap-1.5">
              <input value={bulk[b.bid] || ''} onChange={e => setBulk(prev => ({ ...prev, [b.bid]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addBulk(b.bid); }}
                placeholder="가마 한 번에 넣기 — 예: 18, 22, 24, 28" className={`${cell} !w-64 font-mono`} />
              <button type="button" onClick={() => addBulk(b.bid)} className="text-[11px] font-bold text-white bg-sky-600 rounded px-2 py-1 hover:bg-sky-700">넣기</button>
            </div>
          </div>
        </div>
      ))}

      {/* 새 카드 */}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 border border-dashed border-violet-300 rounded-xl px-3 py-2 bg-violet-50/30">
          <span className="text-xs font-bold text-slate-600">새 종류 · 인치</span>
          <TypeSelect value={adding.type} config={config} onChange={v => setAdding(prev => ({ ...prev, type: v }))} className="!w-40 !text-sm" />
          <input value={adding.inch} onChange={e => setAdding(prev => ({ ...prev, inch: e.target.value }))} inputMode="decimal" placeholder="인치" className={`${cell} !w-16 !text-sm font-mono text-right`} />
          <span className="text-xs text-slate-500">"</span>
          <button type="button" onClick={addBlock} className="text-xs font-bold text-white bg-violet-600 rounded-lg px-3 py-1 hover:bg-violet-700">추가</button>
          <button type="button" onClick={() => setAdding(null)} className="text-xs font-bold text-slate-500 px-2 py-1">그만</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding({ type: '', inch: '' })}
          className="w-full border border-dashed border-violet-300 rounded-xl py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 inline-flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> 종류 · 인치 추가 (예: 싱글 30")
        </button>
      )}

      <datalist id={`${listId}_maker`}>{makerList.map(m => <option key={m} value={m} />)}</datalist>
    </div>
  );
};
