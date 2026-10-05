import React from 'react';
import { Plus, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '../common/SearchableSelect';
import { num, calculateGYd, clampNum, fmtMan as man } from '../../utils/helpers';
import { normalizeExtraCosts, normalizeKnitRateTiers, findKnitGrade, findProcessType, isImportSupplier, findImportCountry } from '../../utils/costModel';
import { COST_DISPLAY_TIERS, COST_TIER_GROUPS, DEFAULT_KNIT_GRADE_ID, DEFAULT_PROCESS_TYPE_ID, KNIT_FEE_MODE_LABEL } from '../../constants/costing';
import { COST_WARNING_TITLE } from './CostWarnings';

/**
 * 원가 분해 표 — 300·500·800YD(2컬러 기준) + 1,000·3,000·5,000YD(MCQ 충족 기준) 6구간 동시 표시.
 * 원단 계산기 / 설계서 / 가설계서 공유. 계산식은 utils/costModel.js (docs/costing-model.md):
 * · 생지 kg = 가공지 kg × (1 + 가공 LOSS%) → 편직 LOSS% = 생지 kg 구간 → 원사 kg = 생지 kg × (1 + 편직 LOSS%)
 * · 재료비 = 원사 kg × 원사 단가,  편직비 = max(난이도 정액, 생지 kg × kg단가)
 * · 염가공 = 생지 청구 kg × 원/kg (2컬러 기준 구간은 컬러당 최소 청구 kg 적용),  후가공 = 가공지 kg × 원/kg
 * · 이화학·운임 = 오더 총액 ÷ 수량,  외관검사 = YD당 (원가 설정)
 * · 수입 원사 운반비 = 그 원사 kg × 수입 국가 kg 구간 단가 → 재료비에 포함 (③ 표에 적용 구간 표시)
 * · 판매마진/Brand 없음(영업/견적에서 결정). '위험 마진(%)'만 가산 → 영업 기준원가. 반올림은 최종에서만.
 *
 * props: cost, yarns, calc, viewMode, yarnSelectOptions, yarnLibrary, globalExchangeRate, setCost(fn), setYarns(fn),
 *        costSettings(원가 설정), onOpenCostSettings(⚙ 원가 설정 열기)
 */
const TIERS = COST_DISPLAY_TIERS;

export const CostBreakdownTable = ({
  cost, yarns, calc, viewMode = 'domestic',
  yarnSelectOptions = [], yarnLibrary = [], globalExchangeRate = 1450,
  setCost, setYarns,
  showMaterial = true, // 설계서처럼 원사 배합이 별도로 있으면 false (표에선 재료비/yd만 읽기 표시)
  compact = false,     // 설계서 A4 2장 압축용 — 패딩·폰트 축소 (계산기는 기본 off)
  costSettings = null, onOpenCostSettings,
}) => {
  const isExport = viewMode === 'export';
  const sym = isExport ? '$' : '₩';
  // 표시는 정수(내수)/2자리(수출). 내부 계산은 정확값 — 반올림은 최종원가에서만.
  const fmt = (v) => num(v, viewMode);
  const rate = Number(globalExchangeRate) || 1450;

  const gYd = calc?.effectiveGYd || calculateGYd(Number(cost.gsm || 0), Number(cost.widthFull || 0));
  const weightYd = gYd / 1000;

  const hasOverride = (slot) => {
    const ov = Number(slot?.priceOverride);
    return slot?.priceOverride !== '' && slot?.priceOverride != null && Number.isFinite(ov) && ov > 0;
  };
  // 원사 슬롯 → 라이브러리 원사의 대표 공급처 (단가 직접입력이면 null)
  const slotSupplier = (slot) => {
    if (!slot || hasOverride(slot)) return null;
    const id = String(slot.yarnId || '').split('::')[0];
    const yarn = (yarnLibrary || []).find(y => String(y.id) === String(id));
    return yarn?.suppliers?.find(s => s.isDefault) || yarn?.suppliers?.[0] || null;
  };
  const unitLandedKRW = (slot) => {
    if (!slot) return 0;
    if (hasOverride(slot)) return Number(slot.priceOverride);
    const sup = slotSupplier(slot);
    if (!sup) return 0;
    const priceKRW = sup.currency === 'USD' ? Number(sup.price || 0) * rate : Number(sup.price || 0);
    const tariff = isExport ? 0 : priceKRW * ((Number(sup.tariff) || 0) / 100);
    // 수입사 원사는 운반비가 원사 kg 구간이라 여기선 빼고, ③ 구간별 표(재료비)에서 수량별로 더함
    const freight = isImportSupplier(sup) ? 0 : (Number(sup.freight) || 0);
    return priceKRW + tariff + freight;
  };
  // 수입사 원사면 수입 국가 이름, 아니면 ''
  const slotImportCountry = (slot) => {
    const sup = slotSupplier(slot);
    return sup && isImportSupplier(sup) ? findImportCountry(costSettings, sup.importCountry).name : '';
  };
  const hasImportSlot = (yarns || []).some(slot => Number(slot?.ratio) > 0 && slotImportCountry(slot));
  const toView = (krw) => isExport ? (krw / rate) : krw;
  // 혼용 금액/kg = 단가 × 혼용률 (LOSS 전). 수량별 LOSS는 아래 구간별 표에서 원사 kg로 반영
  const rowAmt = (slot) => toView(unitLandedKRW(slot) * (Number(slot?.ratio) || 0) / 100);

  // ---- mutators ----
  const addYarn = () => setYarns(prev => [...(prev || []), { yarnId: '', ratio: 0 }]);
  const removeYarn = (i) => setYarns(prev => (prev || []).filter((_, idx) => idx !== i));
  // [입력 검증] 혼용률 0~100. (음수/100 초과 차단)
  const setYarn = (i, field, value) => setYarns(prev => (prev || []).map((y, idx) => idx === i ? { ...y, [field]: field === 'ratio' ? clampNum(value, 0, 100) : value } : y));

  // [입력 검증] kg단가/염가공료/위험마진(%) 등은 음수 차단(0 이상).
  //  칸을 비우면 ''로 둠 (예전엔 0이 강제로 들어가 지울 수 없었고, kg단가가 0으로 저장돼 편직비가 정액만 잡혔음)
  //  → kg단가 빈칸 = 기본값(예전 편직료 → 2,000원), 염가공료 빈칸 = '원가 확인 필요' 경고
  const numOrBlank = (value, min = 0, max = Infinity) => (value === '' || value === null || value === undefined ? '' : clampNum(value, min, max));
  const setField = (name, value) => setCost(prev => ({ ...prev, [name]: numOrBlank(value, 0) }));
  const setChoice = (name, value) => setCost(prev => ({ ...prev, [name]: value }));

  // 편직 kg단가 구간 (품목별, 선택) — 예: 1,000kg 이상 1,800원
  const knitTiers = Array.isArray(cost.knitKgRateTiers) ? cost.knitKgRateTiers : [];
  const baseKgRate = cost.knitKgRate ?? calc?.knitKgRate ?? '';
  const addKnitTier = () => setCost(prev => {
    const list = Array.isArray(prev.knitKgRateTiers) ? prev.knitKgRateTiers : [];
    const lastKg = Number(list[list.length - 1]?.fromKg) || 0;
    return { ...prev, knitKgRateTiers: [...list, { fromKg: lastKg > 0 ? lastKg * 2 : 1000, rate: Number(prev.knitKgRate ?? calc?.knitKgRate) || 0 }] };
  });
  const removeKnitTier = (i) => setCost(prev => ({ ...prev, knitKgRateTiers: (prev.knitKgRateTiers || []).filter((_, idx) => idx !== i) }));
  const setKnitTier = (i, field, value) => setCost(prev => ({ ...prev, knitKgRateTiers: (prev.knitKgRateTiers || []).map((t, idx) => idx === i ? { ...t, [field]: numOrBlank(value, 0) } : t) }));

  const finishing = Array.isArray(cost.finishing) ? cost.finishing : [];
  // 줄 id는 지웠다 다시 넣어도 겹치지 않게 (예전: 개수로 만들어 삭제 후 추가하면 같은 id → 줄이 엉킴)
  const addFinishing = () => setCost(prev => ({ ...prev, finishing: [...(prev.finishing || []), { id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: '', fee: 0, lossPct: 0 }] }));
  const removeFinishing = (i) => setCost(prev => ({ ...prev, finishing: (prev.finishing || []).filter((_, idx) => idx !== i) }));
  // [입력 검증] 후가공 fee 0 이상, lossPct 0~99
  const setFinishing = (i, field, value) => setCost(prev => ({ ...prev, finishing: (prev.finishing || []).map((f, idx) => idx === i ? { ...f, [field]: field === 'name' ? value : (field === 'lossPct' ? numOrBlank(value, 0, 99) : numOrBlank(value, 0)) } : f) }));

  // 품목별 추가비용 (YD당) — 예전 외관검사·이화학·운임 기본 3항목은 원가 설정으로 옮겨져 여기선 제외
  const extras = normalizeExtraCosts(cost.etcCosts);
  const addExtra = () => setCost(prev => ({ ...prev, etcCosts: [...normalizeExtraCosts(prev.etcCosts), { id: `etc_${Date.now()}`, name: '', perYd: 0 }] }));
  const removeExtra = (i) => setCost(prev => ({ ...prev, etcCosts: normalizeExtraCosts(prev.etcCosts).filter((_, idx) => idx !== i) }));
  // [입력 검증] 추가비용 원/yd 0 이상
  const setExtra = (i, field, value) => setCost(prev => ({ ...prev, etcCosts: normalizeExtraCosts(prev.etcCosts).map((e, idx) => idx === i ? { ...e, [field]: field === 'name' ? value : numOrBlank(value, 0) } : e) }));

  // ---- 설정 (편직 난이도 / 가공 유형) ----
  const grades = costSettings?.knitGrades || [];
  const types = costSettings?.processTypes || [];
  const gradeId = cost.knitGrade || DEFAULT_KNIT_GRADE_ID;
  const typeId = cost.processType || DEFAULT_PROCESS_TYPE_ID;
  const grade = findKnitGrade(costSettings, gradeId);
  const ptype = findProcessType(costSettings, typeId);
  const gradeKnown = grades.some(g => g.id === gradeId);
  const typeKnown = types.some(t => t.id === typeId);
  // kg단가 칸을 비우면 엔진이 기본값(예전 편직료 → 2,000원)으로 계산 → 안내·전환점도 그 단가로
  const kgRateBlank = String(baseKgRate ?? '').trim() === '';
  const effKgRate = kgRateBlank ? (Number(calc?.knitKgRate) || 0) : (Number(baseKgRate) || 0);
  // 정액 → kg 계산으로 바뀌는 생지 kg — kg단가 구간까지 반영 (구간마다 그 구간 단가로 정액을 넘는 첫 지점)
  const crossKg = (() => {
    const fixed = Number(grade.fixedFee) || 0;
    const steps = [{ fromKg: 0, rate: effKgRate }, ...normalizeKnitRateTiers(cost.knitKgRateTiers)];
    for (let i = 0; i < steps.length; i++) {
      if (!(steps[i].rate > 0)) continue;
      const end = i + 1 < steps.length ? steps[i + 1].fromKg : Infinity;
      const kg = Math.max(steps[i].fromKg, fixed / steps[i].rate);
      if (kg < end) return kg;
    }
    return 0;
  })();

  // ---- 계산 결과 읽기 ----
  const tier = (tk) => calc?.[tk] || {};
  const tv = (tk) => tier(tk)[viewMode] || {};
  const lineSum = (tk, group, key) => (tv(tk).lines?.[group] || []).filter(l => l.key === key).reduce((s, l) => s + (l.amt || 0), 0);
  const perKgYarn = (yarns || []).reduce((s, slot) => s + rowAmt(slot), 0);

  const inCls = compact
    ? "w-full text-center bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] font-mono focus:ring-1 ring-blue-400 outline-none"
    : "w-full text-center bg-white border border-slate-300 rounded px-1.5 py-1.5 text-sm font-mono focus:ring-1 ring-blue-400 outline-none";
  const selCls = compact
    ? "w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] font-bold outline-none focus:ring-1 ring-blue-400"
    : "w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm font-bold outline-none focus:ring-1 ring-blue-400";
  // 밀도 제어 (compact=설계서 A4 압축)
  const secP = compact ? 'px-3 py-1' : 'px-4 py-3';         // 섹션 패딩
  const cellP = compact ? 'px-2 py-0' : 'px-2.5 py-1.5';    // 값 셀 패딩
  const lblF = compact ? 'text-[11px]' : 'text-[13px]';     // 행 라벨 폰트
  const valF = compact ? 'text-[11px]' : 'text-sm';         // 값 폰트
  const subLbl = `${compact ? 'text-[10px]' : 'text-[11px]'} font-bold text-slate-500 mb-0.5`;
  const addBtn = "flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded border print:hidden";

  // 구간 칸 수에 맞춘 열 너비 (항목 칸 + 구간 칸 N개). 표 최소 너비 — 폰에서는 옆으로 밀어 보기
  const colStyle = (labelFr) => ({ gridTemplateColumns: `${labelFr} repeat(${TIERS.length}, minmax(0, 1fr))` });
  const minTableW = 'min-w-[680px]';
  // 묶음(2컬러 기준 / MCQ 충족 기준) — 같은 묶음 구간끼리 붙어 있음. 묶음이 바뀌는 첫 칸에 굵은 왼쪽 선
  const groups = COST_TIER_GROUPS
    .map(g => ({ ...g, count: TIERS.filter(t => t.group === g.key).length }))
    .filter(g => g.count > 0);
  const groupEdge = (i) => (i > 0 && TIERS[i - 1].group !== TIERS[i].group ? 'border-l-2 border-slate-300' : '');
  const smallQtys = TIERS.filter(t => t.group === 'small').map(t => num(t.qty));
  const mcqFromQty = Math.min(...TIERS.filter(t => t.group === 'mcq').map(t => t.qty));
  const dyeMinKg = costSettings?.dyeMinKgPerColor ?? 100;

  const Head = () => (
    <>
      <div className="grid bg-slate-100 text-[11px] font-extrabold" style={colStyle('1.6fr')}>
        <div />
        {groups.map((g, gi) => (
          <div key={g.key} title={g.hint} style={{ gridColumn: `span ${g.count}` }} className={`${compact ? 'py-0.5' : 'py-1'} text-center ${gi > 0 ? 'border-l-2 border-slate-300' : ''} ${g.key === 'mcq' ? 'text-blue-700' : 'text-amber-700'}`}>
            {g.label}
          </div>
        ))}
      </div>
      <div className="grid bg-slate-200 text-xs font-extrabold text-slate-600" style={colStyle('1.6fr')}>
        <div className={`${compact ? 'p-1.5' : 'p-2.5'} text-left`}>항목 / 구간</div>
        {TIERS.map((t, i) => (
          <div key={t.key} className={`${compact ? 'p-1' : 'p-2'} text-center ${groupEdge(i)} ${t.main ? 'text-blue-700 bg-blue-100/70' : ''}`}>
            <div>{t.label}</div>
            <div className="text-[10px] font-normal text-slate-400">가공지 ≈ {num(tier(t.key).kg?.finished)} kg</div>
          </div>
        ))}
      </div>
    </>
  );
  // 값 행. render(tk) → 셀 내용, sub(tk) → 작은 보조문구, title(tk) → 마우스오버 설명
  const ValueRow = ({ label, get, strong, accent, info, render, sub, title }) => (
    <div className={`grid items-center border-t border-slate-100 ${strong ? 'bg-slate-100' : accent ? 'bg-indigo-50/40' : info ? 'bg-white' : 'bg-slate-50/50'}`} style={colStyle('1.6fr')}>
      <div className={`${cellP} text-left ${lblF} ${strong ? 'font-extrabold text-slate-800' : info ? 'font-semibold text-slate-400' : 'font-bold text-slate-500'}`}>{label}</div>
      {TIERS.map((t, i) => (
        <div key={t.key} title={title ? title(t.key, t) : undefined} className={`${cellP} text-center ${valF} font-mono ${groupEdge(i)} ${t.main ? (strong ? 'bg-blue-100/70 font-extrabold text-blue-800' : 'bg-blue-50/40 font-bold text-slate-700') : (info ? 'text-slate-500' : 'text-slate-700')}`}>
          {render ? render(t.key, t) : <>{sym}{fmt(get(t.key))}</>}
          {sub && !compact && <div className="text-[9px] font-sans font-semibold text-slate-400 leading-tight">{sub(t.key, t)}</div>}
        </div>
      ))}
    </div>
  );

  const finSum = (tk) => lineSum(tk, 'proc', 'fin');
  const extraSum = (tk) => lineSum(tk, 'etc', 'custom');
  const lossLabel = `생지 kg (가공 LOSS ${calc?.processLossPct ?? ptype.lossPct}%${calc?.finishingLossPct ? ` + 후가공 ${calc.finishingLossPct}%` : ''})`;

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      <div className={`bg-blue-600 text-white ${secP} flex items-center justify-between gap-2`}>
        <h3 className={`${compact ? 'text-sm' : 'text-base'} font-extrabold`}>₩ 가격정보 (원가 분해 · {TIERS.length}구간)</h3>
        <div className="flex items-center gap-2">
          {onOpenCostSettings && (
            <button type="button" onClick={onOpenCostSettings} className="print:hidden flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-white/15 hover:bg-white/25 border border-white/30 rounded">
              <Settings className="w-3.5 h-3.5" /> 원가 설정
            </button>
          )}
          <span className="text-xs opacity-90">{isExport ? '수출($) · 관세제외' : '내수(₩) · 관세포함'}</span>
        </div>
      </div>

      {/* 원가 확인 필요 — 혼용률·원사·단가·중량 문제로 원가가 덜 잡히거나 틀릴 수 있을 때 (화면에만, 인쇄 제외) */}
      {(calc?.costWarnings || []).length > 0 && (
        <div className={`${secP} bg-red-50 border-b border-red-200 text-red-700 print:hidden`}>
          <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-extrabold flex items-center gap-1`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {COST_WARNING_TITLE}
          </div>
          <ul className={`${compact ? 'text-[10px]' : 'text-[11px]'} mt-0.5 pl-5 list-disc space-y-0.5`}>
            {calc.costWarnings.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* ① 재료비 (원사 — 자동 단가). 설계서는 원사 배합이 별도라 숨김 */}
      {showMaterial && (
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-extrabold text-slate-700">① 재료비 (원사 · 단가 자동)</span>
          <button type="button" onClick={addYarn} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"><Plus className="w-3.5 h-3.5" /> 원사추가</button>
        </div>
        <div className="grid grid-cols-[2.4fr_0.8fr_1.1fr_1.1fr_0.3fr] gap-2 text-xs font-bold text-slate-400 px-1 mb-1.5">
          <div>원사 (공급내역)</div><div className="text-center">혼용%</div><div className="text-right">단가/kg</div><div className="text-right">혼용 금액/kg</div><div></div>
        </div>
        {(yarns || []).map((slot, i) => (
          <div key={i} className="grid grid-cols-[2.4fr_0.8fr_1.1fr_1.1fr_0.3fr] gap-2 items-center mb-1.5">
            <SearchableSelect value={slot?.yarnId || ''} options={yarnSelectOptions} onChange={(id) => setYarn(i, 'yarnId', id)} placeholder="원사 검색..." />
            <input type="number" value={slot?.ratio || ''} onChange={(e) => setYarn(i, 'ratio', e.target.value)} className={inCls} placeholder="0" />
            <div className="text-right text-sm font-mono text-slate-500">
              {sym}{fmt(toView(unitLandedKRW(slot)))}
              {slotImportCountry(slot) && <div className="text-[10px] font-sans font-bold text-emerald-600 leading-tight">+ {slotImportCountry(slot)} 운반비 (kg 구간)</div>}
            </div>
            <div className="text-right text-sm font-mono font-bold text-slate-800">{sym}{fmt(rowAmt(slot))}</div>
            <div className="text-center">{(yarns || []).length > 1 && <button type="button" onClick={() => removeYarn(i)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
          </div>
        ))}
        <div className="flex justify-end items-baseline gap-2 text-sm font-bold text-slate-600 mt-1.5 pr-9">
          원사 단가 (혼용 가중): <span className="font-mono text-slate-900 text-base">{sym}{fmt(perKgYarn)} / kg</span>
        </div>
        <div className="text-right text-[11px] text-slate-400 pr-9">
          {hasImportSlot
            ? 'LOSS와 수입 원사 운반비(원사 kg 구간)는 아래 표에서 수량별로 반영돼요'
            : 'LOSS는 아래 표에서 수량별 원사 투입 kg로 반영돼요'}
        </div>
      </div>
      )}

      {/* ② 편직 · 가공 조건 (품목 속성) */}
      <div className={`${secP} border-b border-slate-200 space-y-2`}>
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-extrabold text-slate-700`}>② 편직 · 가공 조건</div>
        <div className={`grid grid-cols-2 ${compact ? 'md:grid-cols-4 gap-2' : 'md:grid-cols-4 gap-3'}`}>
          <div>
            <div className={subLbl}>편직 난이도</div>
            <select value={gradeId} onChange={(e) => setChoice('knitGrade', e.target.value)} className={selCls}>
              {!gradeKnown && <option value={gradeId}>⚠ 삭제된 등급 → {grade.name}로 계산</option>}
              {grades.map(g => <option key={g.id} value={g.id}>{g.name} · 정액 {man(g.fixedFee)}원</option>)}
            </select>
            {!compact && grade.desc && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{grade.desc}</div>}
          </div>
          <div>
            <div className={subLbl}>편직 kg단가 (원/kg)</div>
            <input type="number" value={baseKgRate} onChange={(e) => setField('knitKgRate', e.target.value)} className={inCls} placeholder={String(effKgRate || 2000)} />
            {!compact && crossKg > 0 && <div className="text-[10px] text-slate-400 mt-0.5">{kgRateBlank ? `빈칸이라 기본 ${num(effKgRate)}원 · ` : ''}생지 {num(crossKg)}kg 넘으면 kg 계산 (아래는 정액)</div>}
          </div>
          <div>
            <div className={subLbl}>가공 유형</div>
            <select value={typeId} onChange={(e) => setChoice('processType', e.target.value)} className={selCls}>
              {!typeKnown && <option value={typeId}>⚠ 삭제된 유형 → {ptype.name}로 계산</option>}
              {types.map(t => <option key={t.id} value={t.id}>{t.name} · LOSS {t.lossPct}%</option>)}
            </select>
          </div>
          <div>
            <div className={subLbl}>염가공료 (원/kg, 생지 기준)</div>
            <input type="number" value={cost.dyeingFee ?? ''} onChange={(e) => setField('dyeingFee', e.target.value)} className={inCls} placeholder="예: 8800" />
          </div>
        </div>

        {/* 편직 kg단가 구간 (선택) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {knitTiers.map((t, i) => (
            <div key={i} className="flex items-center gap-1 bg-indigo-50/60 border border-indigo-100 rounded px-1.5 py-0.5">
              <input type="number" value={t.fromKg ?? ''} onChange={(e) => setKnitTier(i, 'fromKg', e.target.value)} className={`${inCls} w-20`} />
              <span className="text-[11px] text-slate-500 whitespace-nowrap">kg 이상 →</span>
              <input type="number" value={t.rate ?? ''} onChange={(e) => setKnitTier(i, 'rate', e.target.value)} className={`${inCls} w-20`} />
              <span className="text-[11px] text-slate-500 whitespace-nowrap">원/kg{!(Number(t.fromKg) > 0) ? ' (kg 입력 필요)' : ''}</span>
              <button type="button" onClick={() => removeKnitTier(i)} className="text-slate-300 hover:text-red-500 print:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={addKnitTier} className={`${addBtn} text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100`}><Plus className="w-3 h-3" /> kg단가 구간</button>
          {knitTiers.length > 0 && !compact && <span className="text-[10px] text-slate-400">구간이 바뀌어 단가가 내려가도 편직비 총액은 줄지 않아요 (직전 구간 끝 금액 유지)</span>}
        </div>

        {/* 후가공 (선택) */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-extrabold text-slate-600`}>후가공 (선택)</span>
            <button type="button" onClick={addFinishing} className={`${addBtn} text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100`}><Plus className="w-3 h-3" /> 후가공추가</button>
            {finishing.length === 0 && <span className="text-[11px] text-slate-400">후가공 없음</span>}
          </div>
          {finishing.map((f, i) => (
            <div key={f.id || i} className="grid grid-cols-[2fr_1.1fr_1.1fr_0.3fr] gap-1.5 items-center mb-1 max-w-xl">
              <input type="text" value={f.name} onChange={(e) => setFinishing(i, 'name', e.target.value)} className={`w-full bg-white border border-amber-200 rounded px-2 ${compact ? 'py-0.5 text-[11px]' : 'py-1.5 text-sm'} outline-none`} placeholder="후가공명" />
              <div className="flex items-center gap-1"><input type="number" value={f.fee ?? ''} onChange={(e) => setFinishing(i, 'fee', e.target.value)} className={inCls} placeholder="500" /><span className="text-[10px] text-slate-400">원/kg</span></div>
              <div className="flex items-center gap-1"><input type="number" value={f.lossPct ?? ''} onChange={(e) => setFinishing(i, 'lossPct', e.target.value)} className={`${inCls} text-red-500`} placeholder="1" /><span className="text-[10px] text-slate-400">LOSS%</span></div>
              <button type="button" onClick={() => removeFinishing(i)} className="text-slate-300 hover:text-red-500 justify-self-center print:hidden"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* 품목별 추가비용 (선택, YD당) */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-extrabold text-slate-600`}>품목별 추가비용 (선택, 원/yd)</span>
            <button type="button" onClick={addExtra} className={`${addBtn} text-slate-600 bg-white border-slate-300 hover:bg-slate-100`}><Plus className="w-3 h-3" /> 항목</button>
            {!compact && <span className="text-[11px] text-slate-400">외관검사·이화학·운임은 원가 설정에서 공통으로 계산돼요</span>}
          </div>
          {extras.map((e, i) => (
            <div key={e.id || i} className="grid grid-cols-[2fr_1.1fr_0.3fr] gap-1.5 items-center mb-1 max-w-md">
              <input type="text" value={e.name} onChange={(ev) => setExtra(i, 'name', ev.target.value)} className={`w-full bg-white border border-slate-200 rounded px-2 ${compact ? 'py-0.5 text-[11px]' : 'py-1.5 text-sm'} outline-none`} placeholder="항목명 (예: 특수 포장)" />
              <div className="flex items-center gap-1"><input type="number" value={e.perYd ?? ''} onChange={(ev) => setExtra(i, 'perYd', ev.target.value)} className={inCls} placeholder="0" /><span className="text-[10px] text-slate-400">원/yd</span></div>
              <button type="button" onClick={() => removeExtra(i)} className="text-slate-300 hover:text-red-500 justify-self-center print:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* ③ 구간별 산출 (모두 자동 계산) */}
      <div className={secP}>
        <div className={`${compact ? 'text-xs mb-1' : 'text-sm mb-2'} font-extrabold text-slate-700 flex items-center justify-between`}>
          ③ 구간별 산출 (자동 계산)
          <span className="sm:hidden text-[10px] font-semibold text-slate-400 print:hidden">← 옆으로 밀어서 보기 →</span>
        </div>
        {/* 6구간이라 폰에서는 칸이 좁아짐 → 최소 너비를 두고 옆으로 밀어 보게 함 (PC·설계서 A4는 그대로) */}
        <div className="border border-slate-300 rounded-lg overflow-x-auto">
          <div className={minTableW}>
          {Head()}
          {/* kg 흐름: 가공지 → 생지 → 원사 */}
          {ValueRow({ label: lossLabel, info: true, render: (tk) => <>{num(tier(tk).kg?.greige)} kg</> })}
          {ValueRow({ label: '편직 LOSS (생지 kg 구간)', info: true, render: (tk) => <>{tier(tk).kg?.knitLossPct ?? 0}%</> })}
          {!compact && ValueRow({ label: '원사 투입 kg', info: true, render: (tk) => <>{num(tier(tk).kg?.yarn)} kg</> })}

          {ValueRow({ label: '재료비 / yd (LOSS 포함)', get: (tk) => tv(tk).yarnCostYd, accent: true })}
          {/* 수입 원사 운반비 — 재료비에 이미 포함. 수량마다 그 원사 kg로 정해진 구간 단가를 보여줌 */}
          {calc?.hasImportFreight && ValueRow({
            label: compact ? '└ 수입 원사 운반비 (원/kg)' : '└ 수입 원사 운반비 (원/kg · 재료비 포함)', info: true,
            render: (tk) => {
              const lines = tier(tk).importFreight?.lines || [];
              if (lines.length === 0) return <span className="text-slate-300">-</span>;
              return <>{lines.map(l => num(l.perKg)).join(' · ')}</>;
            },
            // 수입 원사가 하나면 '중국 · 원사 450kg', 여러 개면 원사 이름으로 구분 ('2/48 WOOL 280kg / POLY 75D 187kg')
            sub: (tk) => {
              const lines = tier(tk).importFreight?.lines || [];
              return lines.length > 1
                ? lines.map(l => `${l.name} ${num(l.kg)}kg`).join(' / ')
                : lines.map(l => `${l.countryName} · 원사 ${num(l.kg)}kg`).join('');
            },
            title: (tk, t) => (tier(tk).importFreight?.lines || [])
              .map(l => `${l.name}${l.supplierName ? ` [${l.supplierName}]` : ''} · ${l.countryName}: 원사 ${num(l.kg)}kg → ${num(l.perKg)}원/kg = ${num(l.total)}원 (YD당 ${num(l.total / t.qty)}원)`)
              .join('\n'),
          })}
          {ValueRow({
            label: '편직비 / yd', get: (tk) => tv(tk).knitCostYd, accent: true,
            sub: (tk) => `${KNIT_FEE_MODE_LABEL[tier(tk).knit?.mode] || ''} · ${man(tier(tk).knit?.total)}`,
            title: (tk) => {
              const k = tier(tk).knit || {};
              const kgTxt = `생지 ${num(tier(tk).kg?.greige)}kg × ${num(k.rate)}원 = ${num(k.byKg)}원`;
              return `오더 편직비 ${num(k.total)}원 — ${k.mode === 'fixed' ? `정액 ${num(k.fixedFee)}원 적용 (${kgTxt})` : k.mode === 'floor' ? `구간하한 ${num(k.floor)}원 적용 (${kgTxt})` : kgTxt}`;
            },
          })}
          {ValueRow({
            label: '염가공비 / yd', get: (tk) => lineSum(tk, 'proc', 'dye'), accent: true,
            // 2컬러 기준 구간에서 컬러당 kg가 최소 청구 kg보다 적으면 '컬러당 49→100kg 청구'
            sub: (tk) => {
              const d = tier(tk).dye || {};
              return d.minApplied ? `컬러당 ${num(d.perColorKg)}→${num(d.minKg)}kg 청구` : '';
            },
            title: (tk, t) => {
              const d = tier(tk).dye || {};
              const fee = num(cost.dyeingFee);
              if (d.minApplied) return `${d.colors}컬러 × 컬러당 생지 ${num(d.perColorKg)}kg → 최소 ${num(d.minKg)}kg로 청구 = ${num(d.billedKg)}kg × ${fee}원 = ${num(d.total)}원 ÷ ${num(t.qty)}YD`;
              const why = d.assumeMcq ? 'MCQ 충족 기준 — 최소 청구 없음'
                : !(Number(d.minKg) > 0) ? '염색 최소 청구 없음 (원가 설정 0kg)'
                : `컬러당 생지 ${num(d.perColorKg)}kg라 최소 ${num(d.minKg)}kg 이상`;
              return `생지 ${num(d.billedKg)}kg × ${fee}원 = ${num(d.total)}원 ÷ ${num(t.qty)}YD (${why})`;
            },
          })}
          {finishing.length > 0 && ValueRow({ label: '후가공 / yd', get: finSum, accent: true })}
          {ValueRow({
            label: '이화학검사 / yd', get: (tk) => lineSum(tk, 'etc', 'chem'),
            sub: (tk) => `${tier(tk).chem?.colors ?? 0}컬러 · ${man(tier(tk).chem?.total)}`,
            title: (tk, t) => `${tier(tk).chem?.colors ?? 0}컬러 × ${num(tier(tk).chem?.feePerColor)}원 = ${num(tier(tk).chem?.total)}원 ÷ ${num(t.qty)}YD`,
          })}
          {ValueRow({
            label: '운임 / yd', get: (tk) => lineSum(tk, 'etc', 'freight'),
            sub: (tk) => `오더 ${man(tier(tk).freight?.total)}`,
            title: (tk, t) => `오더 운임 ${num(tier(tk).freight?.total)}원 ÷ ${num(t.qty)}YD`,
          })}
          {ValueRow({ label: '외관검사 / yd', get: (tk) => lineSum(tk, 'etc', 'visual') })}
          {extras.length > 0 && ValueRow({ label: '추가비용 / yd', get: extraSum })}

          {/* 합계 */}
          {ValueRow({ label: '순원가 / yd', get: (tk) => tv(tk).totalCostYd, strong: true })}
          {ValueRow({ label: `위험마진 (${Number(cost.riskMarginPct || 0)}%)`, get: (tk) => tv(tk).riskAmtYd })}
          {ValueRow({ label: '영업 기준원가 / yd', get: (tk) => tv(tk).finalCostYd, strong: true })}
          </div>
        </div>
        {!compact && (
          <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
            <div>
              <b className="text-amber-700">2컬러 기준</b> ({smallQtys.join('·')}YD): 2컬러로 나눠 염색한다고 보고, {Number(dyeMinKg) > 0 ? `컬러당 생지 ${num(dyeMinKg)}kg 미만이면 ${num(dyeMinKg)}kg로 청구해요` : '염색 최소 청구는 없어요 (원가 설정 0kg)'}. 이화학도 2컬러.
              {' '}<b className="text-blue-700">MCQ 충족 기준</b> ({num(mcqFromQty)}YD 이상): 컬러마다 MCQ를 맞췄다고 보고 염색 최소 청구가 없어요.
            </div>
            <div>편직비·이화학·운임은 오더 총액을 수량으로 나눈 값이에요. 칸에 마우스를 올리면 계산 과정이 보여요.</div>
          </div>
        )}
      </div>

      {/* ④ 위험마진 + 납품단위 */}
      <div className={`${secP} bg-slate-50 border-t border-slate-200 ${compact ? 'space-y-1.5' : 'space-y-3'}`}>
        <div className={`flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-3 ${compact ? 'py-1' : 'py-2.5'} flex-wrap`}>
          <span className="text-sm font-extrabold text-rose-700 whitespace-nowrap">⚠ 위험 마진 (%)</span>
          <input type="number" value={cost.riskMarginPct ?? ''} onChange={(e) => setField('riskMarginPct', e.target.value)} className="w-24 text-center bg-white border border-rose-300 rounded px-2 py-1.5 text-sm font-bold text-rose-700 outline-none" placeholder="0" />
          <span className="text-xs text-rose-500">메인 전·위험 원단 추가 마진 → 순원가에 가산 (판매마진은 견적에서)</span>
        </div>
        <div>
          <div className={`text-xs font-bold text-slate-400 ${compact ? 'mb-1' : 'mb-1.5'}`}>납품 단위 (영업 기준원가)</div>
          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <div className={minTableW}>
            <div className="grid bg-slate-200 text-xs font-bold text-slate-600" style={colStyle('1.2fr')}>
              <div className={compact ? 'p-1' : 'p-2'}>단위</div>
              {TIERS.map((t, i) => (
                <div key={t.key} className={`${compact ? 'p-1' : 'p-2'} text-center ${groupEdge(i)} ${t.main ? 'text-blue-700' : ''}`}>
                  <div>{t.label}</div>
                  <div className="text-[10px] font-normal text-slate-400">가공지 ≈ {num(tier(t.key).kg?.finished)} kg</div>
                </div>
              ))}
            </div>
            {[{ k: 'finalCostYd', l: '원가 / yd' }, { k: 'pricePerM', l: '원가 / m' }, { k: 'pricePerKg', l: '원가 / kg' }].map(row => (
              <div key={row.k} className="grid border-t border-slate-100 bg-white" style={colStyle('1.2fr')}>
                <div className={`${compact ? 'px-2 py-0.5 text-[11px]' : 'p-2 text-[13px]'} font-semibold text-slate-500`}>{row.l}</div>
                {TIERS.map((t, i) => <div key={t.key} className={`${compact ? 'px-2 py-0.5 text-[11px]' : 'p-2 text-sm'} text-center font-mono ${groupEdge(i)} ${t.main ? 'bg-emerald-50 font-extrabold text-emerald-700' : 'text-slate-600'}`}>{sym}{fmt(tv(t.key)[row.k])}</div>)}
              </div>
            ))}
            </div>
          </div>
          <div className={`grid grid-cols-3 gap-2 ${compact ? 'mt-1' : 'mt-2'} text-center text-xs`}>
            <div className={`bg-white rounded ${compact ? 'p-1' : 'p-2'} border border-slate-200`}><div className="text-slate-400 font-bold">가공폭</div><div className={`font-bold text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>{cost.widthCut || '-'}/{cost.widthFull || '-'}"</div></div>
            <div className={`bg-white rounded ${compact ? 'p-1' : 'p-2'} border border-slate-200`}><div className="text-slate-400 font-bold">가공중량(g/yd)</div><div className={`font-bold text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>{num(gYd)}</div></div>
            <div className={`bg-white rounded ${compact ? 'p-1' : 'p-2'} border border-slate-200`}><div className="text-slate-400 font-bold">길이(yd/kg)</div><div className={`font-bold text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>{weightYd > 0 ? (1 / weightYd).toFixed(2) : '-'}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};
