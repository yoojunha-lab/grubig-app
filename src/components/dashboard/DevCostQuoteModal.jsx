import React, { useMemo, useRef, useState } from 'react';
import { X, Save, FileText, Calculator, RotateCcw, Library, PenLine, AlertTriangle, Target, Home, Globe } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { SearchableSelect } from '../common/SearchableSelect';
import { CostBreakdownTable } from '../cost/CostBreakdownTable';
import { DraftNumberInput } from '../quote/QuoteParts';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { num, usd, calculateGYd, clampNum, todayLocalISO, rateForMarket, rateLabel } from '../../utils/helpers';
import { sumYarnRatio, isYarnRatioComplete, findImportCountry } from '../../utils/costModel';
import { QUOTE_TIERS, QUOTE_TIER_GROUPS } from '../../constants/quote';
import { calcQuotePrice, formatQuotePrice, getBasePrice, makeDefaultTierRates, makeDefaultTierAdds } from '../../utils/quoteModel';
import {
  makeBlankDevCostQuote, toDevCostQuoteForm, normalizeDevQuoteForm, devQuoteToFabric, toEngineYarns, yarnSlotUnitPrice,
  cleanDevQuoteYarns, validateDevCostQuote, makeDevPreviewQuote, buildDevQuoteSnapshot, getDevQuoteBadge, DEV_QUOTE_MAIN_TIER,
} from '../../utils/devQuoteModel';

/**
 * 개발 의뢰 '원가 견적' 창 (대표님 요청 2026-10-06 — 바이어가 개발 전에 가격부터 보는 경우, 비싸면 Drop)
 *  ① 견적서 품목명 · 원단 스펙(폭·GSM·생산 G/YD) — 외폭·내폭·GSM은 견적서 Cut·Full·GSM 칸에 나가서 꼭 넣어야 저장
 *  ② 원사 4칸 — 칸마다 [라이브러리](원사 선택 → 단가 자동) / [직접 입력](원사명 + 단가 원/kg, 관세·운반비 포함 최종 단가)
 *  ③ 원가 표 — 원단 등록과 같은 표 (편직 난이도·kg단가·가공 유형·염가공료·후가공·추가비용·위험마진 → 6구간 원가)
 *  ④ 판매가 미리보기 — 견적서와 같은 6구간·같은 계산 (기본 이익율·정액, 고칠 수 있음)
 *  [저장] 의뢰에 원가 견적 저장 (+ '의뢰 접수·분석 중'이면 '대기 중'으로) / [견적서 만들기] 저장 후 견적서 화면으로
 *  계산 규칙: utils/devQuoteModel.js · docs/costing-model.md §5-C
 */

const SPEC_FIELDS = [
  { key: 'widthFull', label: '외폭 (")', placeholder: '58' },
  { key: 'widthCut', label: '내폭 (")', placeholder: '56' },
  { key: 'gsm', label: 'GSM', placeholder: '300' },
];

// 판매가 미리보기 표 — 항목 칸 + 6구간 칸 (원가 표와 같은 모양)
const PRICE_GRID = { gridTemplateColumns: `1.5fr repeat(${QUOTE_TIERS.length}, minmax(0, 1fr))` };
// 묶음(2컬러 기준 / MCQ 충족 기준)이 바뀌는 첫 칸에 굵은 왼쪽 선
const groupEdge = (i) => (i > 0 && QUOTE_TIERS[i - 1].group !== QUOTE_TIERS[i].group ? 'border-l-2 border-slate-300' : '');
const tierGroups = QUOTE_TIER_GROUPS
  .map(g => ({ ...g, count: QUOTE_TIERS.filter(t => t.group === g.key).length }))
  .filter(g => g.count > 0);

export const DevCostQuoteModal = ({
  devReq,
  onClose,
  linkedQuotes = [],     // 이 의뢰로 만든 견적서 (최근 순) — 머리의 '견적서 N건' 안내
  yarnSelectOptions = [],
  yarnLibrary = [],
  costSettings = null,
  onOpenCostSettings,
  exchangeRates = null,  // 공통 환율 두 칸 { domestic, export } — 창에서 고른 시장(내수 ₩ / 수출 $)의 환율을 씀
  calculateCost,
  createQuoteItem,
  onSave,        // async (costQuote) => 저장한 costQuote | false
  onStartQuote,  // (원가 견적을 붙인 의뢰) => 견적서 화면으로
}) => {
  const [form, setForm] = useState(() => toDevCostQuoteForm(devReq));
  const [leavePending, setLeavePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // [저장]을 누른 뒤부터 막는 사유를 빨갛게 보여줌
  const savingRef = useRef(false);                      // 저장 중 잠금 — 버튼을 빠르게 두 번 눌러도 한 번만 (화면 상태는 늦게 바뀌어서 ref로)

  // 저장 안 한 변경 확인 — 처음 내는 원가 견적은 빈 양식 기준, 저장된 원가 견적은 열 때 값 기준.
  //  저장될 모양(원사 칸 정리)으로 비교 → [직접 입력]에 썼다가 [라이브러리]로 되돌린 것만으로는 묻지 않음
  const [guardInitial] = useState(() => (devReq.costQuote ? null : normalizeDevQuoteForm(makeBlankDevCostQuote(devReq))));
  const guard = useUnsavedGuard(normalizeDevQuoteForm(form), true, { initial: guardInitial });

  const isExport = form.marketType === 'export';
  const viewMode = isExport ? 'export' : 'domestic';
  // 고른 시장의 공통 환율 — 내수 ₩ = 내수 환율, 수출 $ = 수출 환율 (원가 표·판매가 미리보기·견적서 만들기 모두 같은 값)
  const rate = rateForMarket(exchangeRates, viewMode);
  const currency = isExport ? 'USD' : 'KRW';
  const sym = isExport ? '$' : '₩';

  // ── 계산 (원단 등록·견적서와 같은 엔진) — 입력이 바뀔 때만, 원가 엔진은 한 번만 돌려 원가 표·판매가가 같이 씀 ──
  const fabric = useMemo(() => devQuoteToFabric(devReq, form), [devReq, form]);
  const calc = useMemo(() => (calculateCost ? calculateCost(fabric, rate) : null), [calculateCost, fabric, rate]);
  const item = useMemo(
    () => (createQuoteItem ? createQuoteItem(fabric, { rate, marketType: viewMode, marginRate: form.marginRate, calc }) : null),
    [createQuoteItem, fabric, rate, viewMode, form.marginRate, calc]
  );
  const preview = makeDevPreviewQuote(form, rate);
  const errors = validateDevCostQuote(form);
  const warnings = calc?.costWarnings || [];
  const badge = getDevQuoteBadge(devReq, linkedQuotes);
  const theoreticalGYd = calculateGYd(Number(form.costInput?.gsm) || 0, Number(form.costInput?.widthFull) || 0);
  const avgYarn = isExport ? (Number(calc?.avgYarnCostExport) || 0) / rate : Number(calc?.avgYarnCostDomestic) || 0;

  // ── 입력 ──
  const setItemName = (value) => setForm(prev => ({ ...prev, itemName: value }));
  const setMarket = (marketType) => setForm(prev => ({ ...prev, marketType }));
  const setSpec = (key, raw) => setForm(prev => ({
    ...prev,
    costInput: { ...prev.costInput, [key]: raw === '' ? '' : Math.max(0, Number(raw) || 0) },
  }));
  const setCost = (fn) => setForm(prev => ({ ...prev, costInput: fn(prev.costInput || {}) }));
  const setYarn = (i, patch) => setForm(prev => ({
    ...prev,
    yarns: prev.yarns.map((y, idx) => (idx === i ? { ...y, ...patch } : y)),
  }));
  const setMarginRate = (key, v) => setForm(prev => ({ ...prev, marginRate: { ...prev.marginRate, [key]: clampNum(v, 0, 99) } }));
  const setMarginAdd = (key, v) => setForm(prev => ({ ...prev, marginAdd: { ...prev.marginAdd, [key]: Math.max(0, Number(v) || 0) } }));
  const resetMargins = () => setForm(prev => ({ ...prev, marginRate: makeDefaultTierRates(), marginAdd: makeDefaultTierAdds('KRW') }));

  // ── 저장 ──
  const buildCostQuote = () => ({
    itemName: String(form.itemName || '').trim(),
    marketType: viewMode,
    yarns: cleanDevQuoteYarns(form.yarns),
    costInput: form.costInput,
    marginRate: preview.bulkMarginRate,
    marginAdd: preview.marginAdd,
    snapshot: buildDevQuoteSnapshot(item, preview), // 의뢰 목록 '예상가' (저장할 때 값 그대로)
  });

  // 반환: 저장한 원가 견적 / 막힘·실패·저장 중이면 false
  const save = async () => {
    if (savingRef.current) return false;
    if (errors.length > 0) { setShowErrors(true); return false; }
    savingRef.current = true;
    setBusy(true);
    try {
      return await onSave(buildCostQuote());
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const saved = await save();
    if (saved) onClose();
  };

  // 저장 → 견적서 화면으로 (원가 확인 필요면 한 번 물어봄 — 견적서 출력 전 확인과 같은 원칙)
  const handleMakeQuote = async () => {
    if (savingRef.current) return; // 저장 중에 또 누르면 확인 창도 다시 띄우지 않음
    if (errors.length > 0) { setShowErrors(true); return; }
    if (warnings.length > 0 && !window.confirm(`원가 확인 필요:\n· ${warnings.join('\n· ')}\n\n그래도 견적서를 만들까요?`)) return;
    const saved = await save();
    if (!saved) return;
    onClose();
    onStartQuote?.({ ...devReq, costQuote: saved });
  };

  const requestClose = () => { if (guard.isDirty()) setLeavePending(true); else onClose(); };
  const saveAndClose = async () => {
    setLeavePending(false);
    const saved = await save();
    if (saved) onClose();
  };

  const targetPrice = String(devReq.targetSpec?.targetPrice || '').trim();
  const lastSavedBy = String(devReq.costQuote?.updatedBy || '').split('@')[0];
  const lastSavedAt = (() => {
    const d = new Date(devReq.costQuote?.updatedAt);
    return devReq.costQuote?.updatedAt && !Number.isNaN(d.getTime()) ? todayLocalISO(d) : '';
  })();
  const lastSnapshot = devReq.costQuote?.snapshot || null;

  return (
    <>
      {/* 위아래 여백은 바깥(스크롤 칸)이 아니라 창에 줌 — 스크롤할 때 고정 머리줄 위로 내용이 비쳐 보이지 않게 */}
      <ModalBackdrop className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto px-2 md:px-6" onClose={requestClose}>
        <div className="w-full max-w-6xl bg-slate-50 rounded-2xl shadow-2xl my-2 md:my-6" onClick={e => e.stopPropagation()}>

          {/* 머리줄 — 의뢰 · 시장 구분 */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 rounded-t-2xl px-4 md:px-5 py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-sm"><Calculator className="w-4 h-4" /></span>
                원가 견적
                <span className="font-mono text-violet-700">{devReq.devOrderNo || '-'}</span>
                <span className="text-sm font-bold text-slate-600">{devReq.buyerName || ''}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {devReq.devItem || devReq.targetSpec?.composition || '품목명 미입력'} — 예상 스펙으로 원가·판매가를 미리 계산해요 (원단 등록·견적서와 같은 계산)
              </p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold" title="원가 표·판매가 통화 (내수 = 내수 환율 / 수출 = 관세 제외 · 수출 환율로 환산)">
                <button type="button" onClick={() => setMarket('domestic')}
                  className={`px-2.5 py-1.5 flex items-center gap-1 ${!isExport ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <Home className="w-3.5 h-3.5" /> 내수 ₩
                </button>
                <button type="button" onClick={() => setMarket('export')}
                  className={`px-2.5 py-1.5 flex items-center gap-1 border-l border-slate-300 ${isExport ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <Globe className="w-3.5 h-3.5" /> 수출 $
                </button>
              </div>
              <span className="hidden sm:inline text-[10px] text-slate-400 whitespace-nowrap">{rateLabel(viewMode)} ₩{num(rate)}</span>
              <button type="button" onClick={requestClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg" title="닫기"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="p-3 md:p-5 space-y-4">
            {/* 의뢰 정보 — 바이어가 원하는 것 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <div className="text-[10px] font-bold text-amber-700 flex items-center gap-1"><Target className="w-3 h-3" /> 타겟 단가 (의뢰)</div>
                <div className="text-sm font-extrabold text-amber-900 break-words">{targetPrice || <span className="text-amber-300 font-bold">미입력</span>}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500">혼용률 / 스펙 (의뢰)</div>
                <div className="text-xs font-bold text-slate-800 break-words">{devReq.targetSpec?.composition || <span className="text-slate-300">미입력</span>}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500">원하는 느낌 · 기타 요청</div>
                <div className="text-xs text-slate-700 break-words">
                  {[devReq.targetSpec?.feeling, devReq.targetSpec?.otherRequests].filter(Boolean).join(' / ') || <span className="text-slate-300">미입력</span>}
                </div>
              </div>
            </div>
            {(badge || devReq.costQuote) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                {devReq.costQuote && (
                  <span className="text-slate-500">
                    마지막 저장 <b className="text-slate-700">{lastSavedAt}{lastSavedBy ? ` · ${lastSavedBy}` : ''}</b>
                    {lastSnapshot?.sellPrice && (
                      <> · 저장 때 예상가 {DEV_QUOTE_MAIN_TIER.label} <b className="font-mono text-slate-700">{formatQuotePrice(lastSnapshot.sellPrice[DEV_QUOTE_MAIN_TIER.key] ?? null, lastSnapshot.currency === 'USD' ? 'USD' : 'KRW')}</b></>
                    )}
                  </span>
                )}
                {badge?.kind === 'quote' && (
                  <span className="text-emerald-700 font-bold" title={badge.detail}>
                    <FileText className="w-3 h-3 inline -mt-0.5" /> 이 의뢰로 만든 견적서 {badge.count}건 · 최근 {badge.date} {badge.qtyLabel} {badge.price}
                    {badge.otherBuyer ? ` (바이어 ${badge.otherBuyer})` : ''}
                  </span>
                )}
                <span className="text-slate-400">창을 열면 지금 원가(원사 단가·원가 설정·지금 {rateLabel(viewMode)})로 다시 계산해서 보여 줘요.</span>
              </div>
            )}

            {/* ① 견적서 품목명 · 원단 스펙 */}
            <section className="bg-white border border-slate-200 rounded-xl p-3 md:p-4">
              <h3 className="text-sm font-extrabold text-slate-700 mb-2">① 견적서 품목명 · 원단 스펙</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">견적서 품목명 (Spec 칸)</label>
                  <input type="text" value={form.itemName} onChange={e => setItemName(e.target.value)}
                    placeholder="예: WOOL NYLON JERSEY"
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-200" />
                  <p className="text-[10px] text-slate-400 mt-0.5">견적서 Article 칸에는 개발번호({devReq.devOrderNo || '-'})가 들어가요.</p>
                </div>
                {SPEC_FIELDS.map(f => {
                  const blank = !(Number(form.costInput?.[f.key]) > 0);
                  return (
                    <div key={f.key}>
                      <label className="block text-[11px] font-bold text-slate-500 mb-0.5">{f.label} <span className="text-red-400">*</span></label>
                      <input type="number" min="0" value={form.costInput?.[f.key] ?? ''} onChange={e => setSpec(f.key, e.target.value)} placeholder={f.placeholder}
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-indigo-800 text-center outline-none focus:ring-2 ring-indigo-200 ${blank && showErrors ? 'border-red-300 bg-red-50' : 'border-slate-300'}`} />
                    </div>
                  );
                })}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5">생산 G/YD (선택)</label>
                  <input type="number" min="0" value={form.costInput?.costGYd ?? ''} onChange={e => setSpec('costGYd', e.target.value)}
                    placeholder={theoreticalGYd > 0 ? num(theoreticalGYd) : ''}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-blue-700 text-center outline-none focus:ring-2 ring-blue-200 placeholder:text-slate-400 placeholder:font-normal" />
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">비우면 이론값 {theoreticalGYd > 0 ? `${num(theoreticalGYd)} g/YD` : '(GSM·외폭 필요)'}</p>
                </div>
              </div>
            </section>

            {/* ② 원사 배합 — 칸마다 라이브러리 / 직접 입력 */}
            <section className="bg-white border border-slate-200 rounded-xl p-3 md:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-extrabold text-slate-700">② 원사 배합</h3>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${isYarnRatioComplete(form.yarns) ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                  {isYarnRatioComplete(form.yarns) ? '✓ 혼용률 합계 100%' : `⚠ 혼용률 합계 ${sumYarnRatio(form.yarns)}% — 100%가 되어야 저장돼요`}
                </span>
              </div>
              <div className="hidden md:grid grid-cols-12 gap-2 px-1 mb-1 text-[10px] font-bold text-slate-400">
                <div className="col-span-1">No.</div>
                <div className="col-span-2">입력 방식</div>
                <div className="col-span-5">원사</div>
                <div className="col-span-2 text-center">혼용률 (%)</div>
                <div className="col-span-2 text-right">단가 / kg</div>
              </div>
              <div className="space-y-2 md:space-y-1.5">
                {form.yarns.map((slot, i) => (
                  <YarnSlotRow
                    key={i}
                    index={i}
                    slot={slot}
                    onChange={(patch) => setYarn(i, patch)}
                    yarnSelectOptions={yarnSelectOptions}
                    yarnLibrary={yarnLibrary}
                    costSettings={costSettings}
                    rate={rate}
                    isExport={isExport}
                    highlightMissing={showErrors}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-slate-500">
                <span>직접 입력 단가는 <b className="text-amber-700">관세·운반비까지 넣은 최종 원/kg</b>예요 (가설계서 단가 직접 입력과 같은 규칙 — 내수·수출 같은 단가).</span>
                <span className="font-bold text-slate-600">원사 단가 (혼용 가중) <span className="font-mono text-slate-900">{sym}{num(avgYarn, viewMode)} / kg</span></span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 text-right">LOSS와 수입 원사 운반비(원사 kg 구간)는 아래 원가 표에서 수량별로 반영돼요.</p>
            </section>

            {/* ③ 원가 표 — 원단 등록과 같은 표 (편직·가공 조건 입력 + 6구간 원가) */}
            <CostBreakdownTable
              cost={form.costInput || {}}
              yarns={toEngineYarns(form.yarns)}
              calc={calc}
              viewMode={viewMode}
              yarnLibrary={yarnLibrary}
              exchangeRates={exchangeRates}
              setCost={setCost}
              setYarns={() => {}}
              showMaterial={false}
              costSettings={costSettings}
              onOpenCostSettings={onOpenCostSettings}
            />

            {/* ④ 판매가 미리보기 — 견적서와 같은 계산 */}
            <PricePreview
              item={item}
              preview={preview}
              form={form}
              currency={currency}
              sym={sym}
              rate={rate}
              isExport={isExport}
              targetPrice={targetPrice}
              onMarginRate={setMarginRate}
              onMarginAdd={setMarginAdd}
              onReset={resetMargins}
            />
          </div>

          {/* 아래 버튼줄 */}
          <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 rounded-b-2xl px-4 md:px-5 py-3">
            {showErrors && errors.length > 0 && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-red-700">
                <div className="text-[11px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 아래를 고쳐야 저장돼요</div>
                <ul className="text-[11px] pl-5 list-disc">
                  {errors.map(e => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] text-slate-400 leading-snug mr-auto max-w-md">
                저장하면 의뢰 목록에 예상가가 보이고, '의뢰 접수·분석 중'인 의뢰는 '대기 중'(바이어 결정 대기)으로 바뀌어요.
              </p>
              <button type="button" onClick={requestClose}
                className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                닫기
              </button>
              <button type="button" onClick={handleSave} disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> 저장
              </button>
              <button type="button" onClick={handleMakeQuote} disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                title="원가 견적을 저장하고, 이 품목이 들어간 새 견적서를 열어요 (PDF·엑셀은 견적서 화면에서)">
                <FileText className="w-3.5 h-3.5" /> 견적서 만들기
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>

      <UnsavedChangesDialog
        open={leavePending}
        message="원가 견적에 저장하지 않은 변경사항이 있어요. 저장할까요?"
        onSave={saveAndClose}
        onDiscard={onClose}
        onKeepEditing={() => setLeavePending(false)}
      />
    </>
  );
};

// ② 원사 한 칸 — [라이브러리](원사 선택 → 단가 자동) / [직접 입력](원사명 + 단가 원/kg)
//  두 방식을 오가도 입력값은 남아 있음 (저장할 때 고른 방식의 값만 남김 — cleanDevQuoteYarns)
const YarnSlotRow = ({ index, slot, onChange, yarnSelectOptions, yarnLibrary, costSettings, rate, isExport, highlightMissing }) => {
  const isManual = slot.mode === 'manual';
  const unit = yarnSlotUnitPrice(slot, yarnLibrary, rate);
  const unitView = unit ? (isExport ? unit.export / rate : unit.domestic) : 0;
  const viewMode = isExport ? 'export' : 'domestic';
  const sym = isExport ? '$' : '₩';
  // 혼용률은 있는데 원사(라이브러리)·단가(직접 입력)가 없는 칸 — [저장]을 누른 뒤 빨갛게
  const missingInput = Number(slot.ratio) > 0 && (isManual ? !(Number(slot.priceOverride) > 0) : !slot.yarnId);
  return (
    <div className={`grid grid-cols-6 md:grid-cols-12 gap-2 items-center rounded-lg p-1.5 md:p-1 ${missingInput && highlightMissing ? 'bg-red-50 ring-1 ring-red-200' : 'bg-slate-50/60 md:bg-transparent'}`}>
      <div className="col-span-2 md:col-span-1 text-[11px] font-mono font-bold text-slate-400">Yarn #{index + 1}</div>
      <div className="col-span-4 md:col-span-2 flex rounded-md border border-slate-300 overflow-hidden text-[11px] font-bold w-fit">
        <button type="button" onClick={() => onChange({ mode: 'library' })} title="원사 라이브러리에서 골라요 (단가 자동)"
          className={`px-2 py-1 flex items-center gap-1 ${!isManual ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <Library className="w-3 h-3" /> 라이브러리
        </button>
        <button type="button" onClick={() => onChange({ mode: 'manual' })} title="라이브러리에 없는 원사 — 이름과 단가를 직접 넣어요"
          className={`px-2 py-1 flex items-center gap-1 border-l border-slate-300 ${isManual ? 'bg-amber-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <PenLine className="w-3 h-3" /> 직접 입력
        </button>
      </div>
      <div className="col-span-6 md:col-span-5">
        {isManual ? (
          <input type="text" value={slot.manualName || ''} onChange={e => onChange({ manualName: e.target.value })}
            placeholder="원사명 (예: N40D 신규 / 업체 견적 받은 원사)"
            className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-900 outline-none focus:ring-2 ring-amber-200 placeholder:font-normal placeholder:text-amber-400" />
        ) : (
          <SearchableSelect value={slot.yarnId || ''} options={yarnSelectOptions} onChange={(id) => onChange({ yarnId: id })} placeholder="원사 검색..." />
        )}
      </div>
      <div className="col-span-3 md:col-span-2 flex items-center gap-1">
        <span className="md:hidden text-[10px] font-bold text-slate-400 shrink-0">혼용률</span>
        <input type="number" min="0" max="100" value={slot.ratio || ''} onChange={e => onChange({ ratio: e.target.value === '' ? 0 : clampNum(e.target.value, 0, 100) })} placeholder="0"
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-blue-700 text-center outline-none focus:ring-2 ring-blue-200" />
      </div>
      <div className="col-span-3 md:col-span-2 text-right">
        {isManual ? (
          <div>
            <div className="flex items-center gap-1">
              <input type="number" min="0" value={slot.priceOverride ?? ''} onChange={e => onChange({ priceOverride: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} placeholder="원/kg"
                title="관세·운반비까지 넣은 최종 단가 (원/kg) — 내수·수출 같은 단가로 계산해요"
                className="w-full border border-amber-300 bg-white rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-amber-800 text-right outline-none focus:ring-2 ring-amber-200 placeholder:text-amber-300 placeholder:font-normal" />
              <span className="text-[10px] text-slate-400 shrink-0">원</span>
            </div>
            {isExport && Number(slot.priceOverride) > 0 && (
              <div className="text-[10px] text-slate-400 font-mono">≈ ${usd(Number(slot.priceOverride) / rate)}/kg</div>
            )}
          </div>
        ) : !slot.yarnId ? (
          <span className="text-xs text-slate-300">—</span>
        ) : unit?.missing ? (
          <span className="text-[11px] font-bold text-red-600">라이브러리에 없음</span>
        ) : (
          <div className="leading-tight">
            <div className={`text-sm font-mono font-bold ${unit?.zero ? 'text-red-600' : 'text-slate-700'}`}>{sym}{num(unitView, viewMode)}</div>
            {unit?.zero && <div className="text-[10px] font-bold text-red-600">단가 0원</div>}
            {unit?.isImport && (
              <div className="text-[10px] font-bold text-emerald-600">+ {findImportCountry(costSettings, unit.importCountry).name} 운반비 (kg 구간)</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ④ 판매가 미리보기 — 견적서와 같은 6구간·같은 계산 (영업 기준원가 → 매출이익율·YD당 정액 → 판매가)
const PricePreview = ({ item, preview, form, currency, sym, rate, isExport, targetPrice, onMarginRate, onMarginAdd, onReset }) => (
  <section className="bg-white border-2 border-emerald-300 rounded-xl p-3 md:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h3 className="text-sm font-extrabold text-emerald-800">④ 판매가 미리보기 — 견적서와 같은 계산</h3>
      <div className="flex items-center gap-2">
        <span className="hidden md:inline text-[10px] text-slate-400">판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액</span>
        <button type="button" onClick={onReset} title="구간별 매출이익율·YD당 정액을 견적서 기본값으로"
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">
          <RotateCcw className="w-3 h-3" /> 기본값으로
        </button>
      </div>
    </div>
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div className="min-w-[680px]">
        {/* 묶음 머리 */}
        <div className="grid bg-slate-100 text-[11px] font-extrabold" style={PRICE_GRID}>
          <div />
          {tierGroups.map((g, gi) => (
            <div key={g.key} title={g.hint} style={{ gridColumn: `span ${g.count}` }}
              className={`py-1 text-center ${gi > 0 ? 'border-l-2 border-slate-300' : ''} ${g.key === 'mcq' ? 'text-blue-700' : 'text-amber-700'}`}>
              {g.label}
            </div>
          ))}
        </div>
        <PriceRow label="구간" head>
          {(t) => <span>{t.label}</span>}
        </PriceRow>
        <PriceRow label={`영업 기준원가 (${sym})`}>
          {(t) => <span className="font-mono text-slate-600">{formatQuotePrice(getBasePrice(item, t.key), currency)}</span>}
        </PriceRow>
        <PriceRow label="매출이익율 (%)">
          {(t) => (
            <DraftNumberInput step="any" value={form.marginRate?.[t.key] ?? ''} onValue={(v) => onMarginRate(t.key, v)} placeholder="0"
              className="w-16 border border-emerald-300 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold text-emerald-800 outline-none focus:ring-2 ring-emerald-200 bg-white" />
          )}
        </PriceRow>
        <PriceRow label="YD당 정액 (₩)" sub={isExport ? `견적서처럼 원화로 적고 수출 환율 ₩${num(rate)}로 $ 환산` : ''}>
          {(t) => (
            <div className="flex flex-col items-center">
              <DraftNumberInput step="any" value={form.marginAdd?.[t.key] ?? ''} onValue={(v) => onMarginAdd(t.key, v)} placeholder="0"
                className="w-16 border border-emerald-300 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-emerald-200 bg-white" />
              {isExport && Number(form.marginAdd?.[t.key]) > 0 && (
                <span className="text-[9px] text-slate-400 font-mono">≈ ${usd(Number(form.marginAdd[t.key]) / rate)}</span>
              )}
            </div>
          )}
        </PriceRow>
        <PriceRow label={`판매가 / yd (${sym})`} strong>
          {(t) => <span className="font-mono">{formatQuotePrice(item ? calcQuotePrice(item, t.key, preview, currency) : null, currency)}</span>}
        </PriceRow>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500">
        MCQ (컬러당) <b className="font-mono text-orange-600">{num(item?.mcqYd || 0)} YD</b>
        <span className="text-slate-400"> · 300~800YD는 2컬러까지(소량 염색비 포함), 1,000YD 이상은 컬러마다 MCQ 기준</span>
      </span>
      {targetPrice && (
        <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
          <Target className="w-3 h-3 inline -mt-0.5" /> 바이어 타겟 단가: {targetPrice}
        </span>
      )}
    </div>
    <p className="text-[10px] text-slate-400 mt-1">
      [견적서 만들기]를 누르면 이 이익율·정액·시장 구분으로 새 견적서가 열려요. 바이어에게 보낼 구간·외관검사/시험성적서 제외는 견적서 화면에서 정해요.
    </p>
  </section>
);

// 판매가 미리보기 한 줄 — 항목 칸 + 6구간 칸 (3,000YD 강조)
const PriceRow = ({ label, sub, head, strong, children }) => (
  <div
    className={`grid items-center border-t border-slate-100 ${head ? 'bg-slate-200 text-xs font-extrabold text-slate-600' : strong ? 'bg-emerald-50' : 'bg-white'}`}
    style={PRICE_GRID}
  >
    <div className={`px-2.5 py-1.5 text-left ${head ? '' : strong ? 'text-[13px] font-extrabold text-emerald-800' : 'text-[12px] font-bold text-slate-500'}`}>
      {label}
      {sub && <div className="text-[9px] font-semibold text-slate-400 leading-tight">{sub}</div>}
    </div>
    {QUOTE_TIERS.map((t, i) => (
      <div key={t.key}
        className={`px-1.5 py-1.5 text-center ${groupEdge(i)} ${t.main ? (head ? 'text-blue-700 bg-blue-100/70' : strong ? 'bg-emerald-100 text-emerald-900 font-black text-sm' : 'bg-blue-50/40') : (strong ? 'text-emerald-800 font-extrabold text-[13px]' : 'text-[12px]')}`}>
        {children(t)}
      </div>
    ))}
  </div>
);
