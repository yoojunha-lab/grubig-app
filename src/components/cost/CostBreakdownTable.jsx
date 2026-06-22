import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableSelect } from '../common/SearchableSelect';
import { num, calculateGYd } from '../../utils/helpers';

/**
 * 첨부 "가격정보" 표 방식의 원가 분해 — 1,000 / 3,000 / 5,000 YD 3구간 동시 표시.
 * 원단 계산기 / 설계서 / 가설계서 공유.
 *
 * · 재료비 = Σ(원사 landed단가 × 혼용률) × 가공중량  (원사 단가 = 라이브러리 자동, 손실 부풀림 없음)
 * · 편직 Loss = 재료비 × %,  가공/후가공 Loss = (재료비+편직비) × %
 * · 기타비용(외관/이화학/운임 등) = 항목별·구간별 원/yd
 * · 판매마진/Brand 제거(영업/견적에서 결정). '위험 마진(%)'만 가산 → 영업 기준원가.
 * · 중간 반올림 없음 — 반올림은 최종(영업 기준원가)에서만.
 *
 * props: cost, yarns, calc, viewMode, yarnSelectOptions, yarnLibrary, globalExchangeRate, setCost(fn), setYarns(fn)
 */
const TIERS = [
  { key: 'tier1k', label: '1,000 YD', qty: 1000, feeKey: 'knittingFee1k' },
  { key: 'tier3k', label: '3,000 YD', qty: 3000, feeKey: 'knittingFee3k', main: true },
  { key: 'tier5k', label: '5,000 YD', qty: 5000, feeKey: 'knittingFee5k' },
];

export const CostBreakdownTable = ({
  cost, yarns, calc, viewMode = 'domestic',
  yarnSelectOptions = [], yarnLibrary = [], globalExchangeRate = 1450,
  setCost, setYarns,
  showMaterial = true, // 설계서처럼 원사 배합이 별도로 있으면 false (표에선 재료비/yd만 읽기 표시)
}) => {
  const isExport = viewMode === 'export';
  const sym = isExport ? '$' : '₩';
  // 표시는 정수(내수)/2자리(수출). 내부 계산은 정확값 — 반올림은 최종원가에서만.
  const fmt = (v) => num(v, viewMode);
  const rate = Number(globalExchangeRate) || 1450;

  const gYd = calc?.effectiveGYd || calculateGYd(Number(cost.gsm || 0), Number(cost.widthFull || 0));
  const weightYd = gYd / 1000;

  const unitLandedKRW = (slot) => {
    if (!slot) return 0;
    const ov = Number(slot.priceOverride);
    if (slot.priceOverride !== '' && slot.priceOverride != null && Number.isFinite(ov) && ov > 0) return ov;
    const id = String(slot.yarnId || '').split('::')[0];
    const yarn = (yarnLibrary || []).find(y => String(y.id) === String(id));
    const sup = yarn?.suppliers?.find(s => s.isDefault) || yarn?.suppliers?.[0];
    if (!sup) return 0;
    const priceKRW = sup.currency === 'USD' ? Number(sup.price || 0) * rate : Number(sup.price || 0);
    const tariff = isExport ? 0 : priceKRW * ((Number(sup.tariff) || 0) / 100);
    return priceKRW + tariff + (Number(sup.freight) || 0);
  };
  const toView = (krw) => isExport ? (krw / rate) : krw;
  // 공급금액/yd = 단가 × 혼용률 × 가공중량 (반올림 없이 정확값)
  const rowAmt = (slot) => toView(unitLandedKRW(slot) * (Number(slot?.ratio) || 0) / 100 * weightYd);

  // ---- mutators ----
  const addYarn = () => setYarns(prev => [...(prev || []), { yarnId: '', ratio: 0 }]);
  const removeYarn = (i) => setYarns(prev => (prev || []).filter((_, idx) => idx !== i));
  const setYarn = (i, field, value) => setYarns(prev => (prev || []).map((y, idx) => idx === i ? { ...y, [field]: field === 'ratio' ? Number(value) : value } : y));

  const setField = (name, value) => setCost(prev => ({ ...prev, [name]: Number(value) }));
  const setLoss = (tier, field, value) => setCost(prev => ({ ...prev, losses: { ...prev.losses, [tier]: { ...prev.losses?.[tier], [field]: Number(value) } } }));

  const finishing = Array.isArray(cost.finishing) ? cost.finishing : [];
  const addFinishing = () => setCost(prev => ({ ...prev, finishing: [...(prev.finishing || []), { id: `fin_${(prev.finishing || []).length}_${(prev.finishing || []).length + 1}`, name: '', fee: 0, lossPct: 0 }] }));
  const removeFinishing = (i) => setCost(prev => ({ ...prev, finishing: (prev.finishing || []).filter((_, idx) => idx !== i) }));
  const setFinishing = (i, field, value) => setCost(prev => ({ ...prev, finishing: (prev.finishing || []).map((f, idx) => idx === i ? { ...f, [field]: field === 'name' ? value : Number(value) } : f) }));

  const etcCosts = Array.isArray(cost.etcCosts) ? cost.etcCosts : [];
  const addEtc = () => setCost(prev => ({ ...prev, etcCosts: [...(prev.etcCosts || []), { id: `etc_${(prev.etcCosts || []).length}_x`, name: '', vals: { tier1k: 0, tier3k: 0, tier5k: 0 } }] }));
  const removeEtc = (i) => setCost(prev => ({ ...prev, etcCosts: (prev.etcCosts || []).filter((_, idx) => idx !== i) }));
  const setEtcName = (i, value) => setCost(prev => ({ ...prev, etcCosts: (prev.etcCosts || []).map((e, idx) => idx === i ? { ...e, name: value } : e) }));
  const setEtcVal = (i, tier, value) => setCost(prev => ({ ...prev, etcCosts: (prev.etcCosts || []).map((e, idx) => idx === i ? { ...e, vals: { ...(e.vals || {}), [tier]: Number(value) } } : e) }));

  const tv = (tierKey) => (calc?.[tierKey]?.[viewMode]) || {};
  const matSub = tv('tier3k').yarnCostYd || 0; // 재료비는 구간 무관
  // 가공비(염가공) = proc[0]+proc[1], 후가공 = 나머지
  const procPart = (tierKey, kind) => {
    const p = tv(tierKey).lines?.proc || [];
    if (kind === 'dye') return (p[0]?.amt || 0) + (p[1]?.amt || 0);
    return p.slice(2).reduce((s, l) => s + (l.amt || 0), 0);
  };

  const inCls = "w-full text-center bg-white border border-slate-300 rounded px-1.5 py-1.5 text-sm font-mono focus:ring-1 ring-blue-400 outline-none";

  const kgOf = (t) => Math.round(t.qty * weightYd); // YD → 가공중량 기준 kg 환산
  const Head = () => (
    <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-slate-200 text-xs font-extrabold text-slate-600">
      <div className="p-2.5 text-left">항목 / 구간</div>
      {TIERS.map(t => (
        <div key={t.key} className={`p-2 text-center ${t.main ? 'text-blue-700 bg-blue-100/70' : ''}`}>
          <div>{t.label}</div>
          <div className="text-[10px] font-normal text-slate-400">≈ {num(kgOf(t))} kg</div>
        </div>
      ))}
    </div>
  );
  const InputRow = ({ label, get, set, red }) => (
    <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-t border-slate-100">
      <div className="px-2.5 py-1 text-left text-[13px] font-bold text-slate-600">{label}</div>
      {TIERS.map(t => (
        <div key={t.key} className={`p-1 ${t.main ? 'bg-blue-50/40' : ''}`}>
          <input type="number" value={get(t)} onChange={(e) => set(t, e.target.value)} className={`${inCls} ${red ? 'text-red-500' : ''} ${t.main ? 'font-bold text-blue-700' : ''}`} />
        </div>
      ))}
    </div>
  );
  const ValueRow = ({ label, get, strong, accent }) => (
    <div className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-t border-slate-100 ${strong ? 'bg-slate-100' : accent ? 'bg-indigo-50/40' : 'bg-slate-50/50'}`}>
      <div className={`px-2.5 py-1.5 text-left text-[13px] ${strong ? 'font-extrabold text-slate-800' : 'font-bold text-slate-500'}`}>{label}</div>
      {TIERS.map(t => (
        <div key={t.key} className={`px-2.5 py-1.5 text-center text-sm font-mono ${t.main ? (strong ? 'bg-blue-100/70 font-extrabold text-blue-800' : 'bg-blue-50/40 font-bold text-slate-700') : 'text-slate-700'}`}>{sym}{fmt(get(t.key))}</div>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <h3 className="text-base font-extrabold">₩ 가격정보 (원가 분해 · 3구간)</h3>
        <span className="text-xs opacity-90">{isExport ? '수출($) · 관세제외' : '내수(₩) · 관세포함'}</span>
      </div>

      {/* ① 재료비 (원사 — 자동 단가, 반올림 없음). 설계서는 원사 배합이 별도라 숨김 */}
      {showMaterial && (
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-extrabold text-slate-700">① 재료비 (원사 · 단가 자동)</span>
          <button type="button" onClick={addYarn} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"><Plus className="w-3.5 h-3.5" /> 원사추가</button>
        </div>
        <div className="grid grid-cols-[2.4fr_0.8fr_1.1fr_1.1fr_0.3fr] gap-2 text-xs font-bold text-slate-400 px-1 mb-1.5">
          <div>원사 (공급내역)</div><div className="text-center">혼용%</div><div className="text-right">단가/kg</div><div className="text-right">공급금액/yd</div><div></div>
        </div>
        {(yarns || []).map((slot, i) => (
          <div key={i} className="grid grid-cols-[2.4fr_0.8fr_1.1fr_1.1fr_0.3fr] gap-2 items-center mb-1.5">
            <SearchableSelect value={slot.yarnId} options={yarnSelectOptions} onChange={(id) => setYarn(i, 'yarnId', id)} placeholder="원사 검색..." />
            <input type="number" value={slot.ratio || ''} onChange={(e) => setYarn(i, 'ratio', e.target.value)} className={inCls} placeholder="0" />
            <div className="text-right text-sm font-mono text-slate-500">{sym}{fmt(toView(unitLandedKRW(slot)))}</div>
            <div className="text-right text-sm font-mono font-bold text-slate-800">{sym}{fmt(rowAmt(slot))}</div>
            <div className="text-center">{(yarns || []).length > 1 && <button type="button" onClick={() => removeYarn(i)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
          </div>
        ))}
        <div className="flex justify-end gap-2 text-sm font-bold text-slate-600 mt-1.5 pr-9">재료비 소계: <span className="font-mono text-slate-900 text-base">{sym}{fmt(matSub)}</span></div>
      </div>
      )}

      {/* ② 염가공료 + ③ 후가공 (공통 입력) */}
      <div className="px-4 py-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-extrabold text-slate-700 mb-1.5">② 염가공료</div>
          <div className="flex items-center gap-2">
            <input type="number" value={cost.dyeingFee ?? ''} onChange={(e) => setField('dyeingFee', e.target.value)} className="w-36 text-right bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm font-mono outline-none focus:ring-1 ring-blue-400" placeholder="2500" />
            <span className="text-xs text-slate-400">₩/kg (전 구간 공통)</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-extrabold text-slate-700">③ 후가공 (선택)</span>
            <button type="button" onClick={addFinishing} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100"><Plus className="w-3.5 h-3.5" /> 후가공추가</button>
          </div>
          {finishing.length === 0 && <div className="text-xs text-slate-400">후가공 없음 (필요 시 추가)</div>}
          {finishing.map((f, i) => (
            <div key={f.id || i} className="grid grid-cols-[2fr_1.1fr_1.1fr_0.3fr] gap-1.5 items-center mb-1.5">
              <input type="text" value={f.name} onChange={(e) => setFinishing(i, 'name', e.target.value)} className="w-full bg-white border border-amber-200 rounded px-2 py-1.5 text-sm outline-none" placeholder="후가공명" />
              <div className="flex items-center gap-1"><input type="number" value={f.fee ?? ''} onChange={(e) => setFinishing(i, 'fee', e.target.value)} className={inCls} placeholder="500" /><span className="text-[10px] text-slate-400">₩/kg</span></div>
              <div className="flex items-center gap-1"><input type="number" value={f.lossPct ?? ''} onChange={(e) => setFinishing(i, 'lossPct', e.target.value)} className={`${inCls} text-red-500`} placeholder="1" /><span className="text-[10px] text-slate-400">Loss%</span></div>
              <button type="button" onClick={() => removeFinishing(i)} className="text-slate-300 hover:text-red-500 justify-self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* ④ 구간별 산출 */}
      <div className="px-4 py-3">
        <div className="text-sm font-extrabold text-slate-700 mb-2">④ 구간별 산출 (입력 + 원가)</div>
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          {Head()}
          {!showMaterial && ValueRow({ label: '재료비 / yd', get: (tk) => tv(tk).yarnCostYd })}
          {InputRow({ label: '편직료 (₩/kg)', get: (t) => cost[t.feeKey] ?? '', set: (t, v) => setField(t.feeKey, v) })}
          {InputRow({ label: '편직 Loss (%)', red: true, get: (t) => cost.losses?.[t.key]?.knit ?? '', set: (t, v) => setLoss(t.key, 'knit', v) })}
          {ValueRow({ label: '▸ 편직비 / yd', get: (tk) => tv(tk).knitCostYd, accent: true })}
          {InputRow({ label: '염가공 Loss (%)', red: true, get: (t) => cost.losses?.[t.key]?.dye ?? '', set: (t, v) => setLoss(t.key, 'dye', v) })}
          {ValueRow({ label: '▸ 가공비 / yd', get: (tk) => procPart(tk, 'dye'), accent: true })}
          {finishing.length > 0 && ValueRow({ label: '▸ 후가공 / yd', get: (tk) => procPart(tk, 'fin'), accent: true })}

          {/* 기타비용 (항목별 구간별 원/yd) */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-t-2 border-slate-200 bg-slate-50/60">
            <div className="px-2.5 py-1.5 text-left text-xs font-extrabold text-slate-500 flex items-center justify-between">
              기타비용 (원/yd)
              <button type="button" onClick={addEtc} className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 mr-2"><Plus className="w-3 h-3" /> 항목</button>
            </div>
            <div /><div /><div />
          </div>
          {etcCosts.map((e, i) => (
            <div key={e.id || i} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-t border-slate-100">
              <div className="px-2 py-1 flex items-center gap-1">
                <input type="text" value={e.name} onChange={(ev) => setEtcName(i, ev.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] outline-none" placeholder="항목명" />
                <button type="button" onClick={() => removeEtc(i)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {TIERS.map(t => (
                <div key={t.key} className={`p-1 ${t.main ? 'bg-blue-50/40' : ''}`}>
                  <input type="number" value={e.vals?.[t.key] ?? ''} onChange={(ev) => setEtcVal(i, t.key, ev.target.value)} className={`${inCls} ${t.main ? 'font-bold text-blue-700' : ''}`} placeholder="0" />
                </div>
              ))}
            </div>
          ))}
          {ValueRow({ label: '▸ 기타비용 / yd', get: (tk) => tv(tk).extraFeeYd, accent: true })}

          {/* 합계 */}
          {ValueRow({ label: '순원가 / yd', get: (tk) => tv(tk).totalCostYd, strong: true })}
          {ValueRow({ label: `위험마진 (${Number(cost.riskMarginPct || 0)}%)`, get: (tk) => tv(tk).riskAmtYd })}
          {ValueRow({ label: '영업 기준원가 / yd', get: (tk) => tv(tk).finalCostYd, strong: true })}
        </div>
      </div>

      {/* ⑤ 위험마진 + 납품단위 */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 flex-wrap">
          <span className="text-sm font-extrabold text-rose-700 whitespace-nowrap">⚠ 위험 마진 (%)</span>
          <input type="number" value={cost.riskMarginPct ?? ''} onChange={(e) => setField('riskMarginPct', e.target.value)} className="w-24 text-center bg-white border border-rose-300 rounded px-2 py-1.5 text-sm font-bold text-rose-700 outline-none" placeholder="0" />
          <span className="text-xs text-rose-500">메인 전·위험 원단 추가 마진 → 순원가에 가산 (판매마진은 견적에서)</span>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-400 mb-1.5">납품 단위 (영업 기준원가)</div>
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-slate-200 text-xs font-bold text-slate-600">
              <div className="p-2">단위</div>
              {TIERS.map(t => (
                <div key={t.key} className={`p-2 text-center ${t.main ? 'text-blue-700' : ''}`}>
                  <div>{t.label}</div>
                  <div className="text-[10px] font-normal text-slate-400">≈ {num(kgOf(t))} kg</div>
                </div>
              ))}
            </div>
            {[{ k: 'finalCostYd', l: '원가 / yd' }, { k: 'pricePerM', l: '원가 / m' }, { k: 'pricePerKg', l: '원가 / kg' }].map(row => (
              <div key={row.k} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-t border-slate-100 bg-white">
                <div className="p-2 text-[13px] font-semibold text-slate-500">{row.l}</div>
                {TIERS.map(t => <div key={t.key} className={`p-2 text-center text-sm font-mono ${t.main ? 'bg-emerald-50 font-extrabold text-emerald-700' : 'text-slate-600'}`}>{sym}{fmt(tv(t.key)[row.k])}</div>)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
            <div className="bg-white rounded p-2 border border-slate-200"><div className="text-slate-400 font-bold">가공폭</div><div className="font-bold text-slate-700 text-sm">{cost.widthCut || '-'}/{cost.widthFull || '-'}"</div></div>
            <div className="bg-white rounded p-2 border border-slate-200"><div className="text-slate-400 font-bold">가공중량(g/yd)</div><div className="font-bold text-slate-700 text-sm">{num(gYd)}</div></div>
            <div className="bg-white rounded p-2 border border-slate-200"><div className="text-slate-400 font-bold">길이(yd/kg)</div><div className="font-bold text-slate-700 text-sm">{weightYd > 0 ? (1 / weightYd).toFixed(2) : '-'}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};
