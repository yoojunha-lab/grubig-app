import React from 'react';
import { DollarSign, RotateCcw, Home, Globe, CheckSquare, Square } from 'lucide-react';
import { num, usd, clampNum, rateLabel, rateForMarket, QUOTE_VALIDITY_OPTIONS } from '../../utils/helpers';
import { QUOTE_TIERS, QUOTE_TIER_GROUPS, QUOTE_TIER_KEYS } from '../../constants/quote';
import { formatQuotePrice, getBasePrice, makeDefaultTierRates, makeDefaultTierAdds } from '../../utils/quoteModel';
import { DraftNumberInput, ExcludeToggles, ExportButtons } from '../quote/QuoteParts';
import {
  buildTempQuote, tempSellPrice, tempShownTiers, tempMarket, toTempTierRate, toTempTierAdd, tempBaseBeforeExclude,
  tempExclude, tempExcludeLabel, TEMP_DEFAULT_VALIDITY,
} from '../../utils/tempQuoteModel';

/**
 * 가설계서 영업 견적 시뮬레이션 · 가견적서 (대표님 요청 2026-11-24 — 견적서와 같은 계산)
 *  · 시장 구분(TempMarketToggle — 원가 표 머리줄) · 외관검사/시험성적서 제외 · 6구간 매출이익율·YD당 정액 → 최종 판매가
 *  · '가견적서 표시' 체크한 구간만 가견적서 PDF·엑셀에 나감 (견적서와 같은 양식 — Article = 원단명)
 *  계산 규칙: utils/tempQuoteModel.js · docs/costing-model.md §5-D
 */

// 판매가 표 — 항목 칸 + 6구간 칸 (개발 의뢰 원가 견적의 판매가 미리보기와 같은 모양)
//  설계서 둘째 장 폭(1280px 화면에서 약 490px)에 가로 스크롤 없이 들어가게 칸을 좁게
const PRICE_GRID = { gridTemplateColumns: `minmax(78px, 1.1fr) repeat(${QUOTE_TIERS.length}, minmax(0, 1fr))` };
// 묶음(2컬러 기준 / MCQ 충족 기준)이 바뀌는 첫 칸에 굵은 왼쪽 선
const groupEdge = (i) => (i > 0 && QUOTE_TIERS[i - 1].group !== QUOTE_TIERS[i].group ? 'border-l-2 border-slate-300' : '');
const tierGroups = QUOTE_TIER_GROUPS
  .map(g => ({ ...g, count: QUOTE_TIERS.filter(t => t.group === g.key).length }))
  .filter(g => g.count > 0);
const SMALL_TIERS = QUOTE_TIERS.filter(t => t.group === 'small');
const SMALL_RANGE = SMALL_TIERS.length ? `${num(SMALL_TIERS[0].qty)}~${num(SMALL_TIERS[SMALL_TIERS.length - 1].qty)}YD` : '';
const MCQ_FROM = `${num(Math.min(...QUOTE_TIERS.filter(t => t.group === 'mcq').map(t => t.qty)))}YD`;

/** 시장 구분 [내수 ₩ | 수출 $] — 가설계서마다 저장. 원가 표·판매가가 같이 바뀜 (원가 표 머리줄에 둠) */
export const TempMarketToggle = ({ sheet, setSheet, exchangeRates }) => {
  const market = tempMarket(sheet);
  const isExport = market === 'export';
  const rate = rateForMarket(exchangeRates, market);   // 판매가·가견적서와 같은 환율 (값이 없으면 기본 환율)
  const setMarket = (m) => { if (m !== market) setSheet?.(prev => ({ ...prev, marketType: m })); };
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-extrabold text-slate-500">시장 구분</span>
      <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold"
        title="원가 표·판매가·가견적서 통화 (내수 = 관세 포함 · 내수 환율 / 수출 = 관세 제외 · 수출 환율로 $). 화면 위 [내수|수출] 보기와 상관없이 이 가설계서는 이 시장으로 계산해요.">
        <button type="button" onClick={() => setMarket('domestic')}
          className={`px-2.5 py-1 flex items-center gap-1 ${!isExport ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <Home className="w-3.5 h-3.5" /> 내수 ₩
        </button>
        <button type="button" onClick={() => setMarket('export')}
          className={`px-2.5 py-1 flex items-center gap-1 border-l border-slate-300 ${isExport ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          <Globe className="w-3.5 h-3.5" /> 수출 $
        </button>
      </div>
      {rate > 0 && <span className="hidden sm:inline text-[10px] text-slate-400 whitespace-nowrap">{rateLabel(market)} ₩{num(rate)}</span>}
    </div>
  );
};

// 판매가 표 한 줄 — 항목 칸 + 6구간 칸 (3,000YD 강조)
const PriceRow = ({ label, sub, head, strong, children }) => (
  <div
    className={`grid items-center border-t border-slate-100 ${head ? 'bg-slate-200 text-xs font-extrabold text-slate-600' : strong ? 'bg-emerald-50' : 'bg-white'}`}
    style={PRICE_GRID}
  >
    <div className={`px-2 py-1.5 text-left leading-tight ${head ? '' : strong ? 'text-[11px] font-extrabold text-emerald-800' : 'text-[10px] font-bold text-slate-500'}`}>
      {label}
      {sub && <div className="text-[9px] font-semibold text-slate-400 leading-tight">{sub}</div>}
    </div>
    {QUOTE_TIERS.map((t, i) => (
      <div key={t.key}
        className={`px-0.5 py-1.5 text-center whitespace-nowrap ${groupEdge(i)} ${t.main ? (head ? 'text-blue-700 bg-blue-100/70' : strong ? 'bg-emerald-100 text-emerald-900 font-black text-[13px]' : 'bg-blue-50/40') : (strong ? 'text-emerald-800 font-extrabold text-[12px]' : 'text-[11px]')}`}>
        {children(t)}
      </div>
    ))}
  </div>
);

export const TempQuotePanel = ({ sheet, setSheet, calc, exchangeRates, onExport }) => {
  const built = buildTempQuote(sheet, calc, exchangeRates);
  const { item, quote, rate, currency, market } = built;
  const isExport = market === 'export';
  const sym = isExport ? '$' : '₩';
  const shown = tempShownTiers(sheet);
  const exclude = tempExclude(sheet);
  const excludedLabel = tempExcludeLabel(sheet);   // '외관검사' / '시험성적서' / '외관검사·시험성적서' / '' (안 뺌)
  const excluding = excludedLabel !== '';

  const patch = (p) => setSheet?.(prev => ({ ...prev, ...p }));
  const setRate = (key, v) => setSheet?.(prev => ({ ...prev, quoteMarginRate: { ...toTempTierRate(prev.quoteMarginRate), [key]: clampNum(v, 0, 99) } }));
  const setAdd = (key, v) => setSheet?.(prev => ({ ...prev, quoteMarginAdd: { ...toTempTierAdd(prev.quoteMarginAdd), [key]: Math.max(0, Number(v) || 0) } }));
  // 가견적서 표시 — 1개 이상은 켜 둠 (견적서와 같음)
  const toggleShown = (key) => setSheet?.(prev => {
    const cur = tempShownTiers(prev);
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    if (next.length === 0) return prev;
    return { ...prev, quoteShownTiers: QUOTE_TIER_KEYS.filter(k => next.includes(k)) };
  });
  const resetMargins = () => patch({ quoteMarginRate: makeDefaultTierRates(), quoteMarginAdd: makeDefaultTierAdds('KRW') });

  return (
    <div className="mt-3 border-2 border-emerald-300 bg-emerald-50/40 rounded-lg p-3 space-y-2">
      {/* 머리줄 — 제목 · 시장 · [기본값으로] · 가견적서 PDF·엑셀 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5 flex-wrap">
          <DollarSign className="w-3.5 h-3.5" /> 영업 견적 시뮬레이션 — 견적서와 같은 계산
          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 border ${isExport ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600'}`}>
            {isExport ? '수출 $' : '내수 ₩'} · {rateLabel(market)} ₩{num(rate)}
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={resetMargins} title="구간별 매출이익율·YD당 정액을 견적서 기본값으로"
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <RotateCcw className="w-3 h-3" /> 기본값으로
          </button>
          {onExport && <ExportButtons label="가견적서" onPdf={() => onExport(sheet, 'pdf')} onExcel={() => onExport(sheet, 'excel')} />}
        </div>
      </div>

      {/* 외관검사 · 시험성적서 제외 (견적서와 같은 버튼) */}
      <ExcludeToggles
        label="이 가설계서"
        visual={exclude.excludeVisual}
        chem={exclude.excludeChem}
        onChange={(field, value) => patch({ [field]: value })}
        note="누르면 영업 기준원가에서 그 비용을 빼고, 가견적서에 '불포함'으로 적혀요."
      />

      {/* 구간별 판매가 표 */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <div className="min-w-[470px]">
          <div className="grid bg-slate-100 text-[10px] font-extrabold" style={PRICE_GRID}>
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
          <PriceRow label={`영업 기준원가 (${sym})`} sub={excluding ? `${excludedLabel} 뺀 값` : ''}>
            {(t) => (
              <div className="flex flex-col items-center leading-tight">
                <span className="font-mono text-slate-600">{formatQuotePrice(getBasePrice(item, t.key), currency)}</span>
                {excluding && (
                  <span className="text-[9px] text-slate-400 font-mono line-through" title="빼기 전 (원가 표의 영업 기준원가)">
                    {formatQuotePrice(tempBaseBeforeExclude(calc, sheet, t.key), currency)}
                  </span>
                )}
              </div>
            )}
          </PriceRow>
          <PriceRow label="매출이익율 (%)">
            {(t) => (
              <DraftNumberInput step="any" min="0" max="99" value={quote.bulkMarginRate?.[t.key] ?? ''} onValue={(v) => setRate(t.key, v)} placeholder="0"
                className="w-12 border border-emerald-300 rounded px-0.5 py-0.5 text-center font-mono text-[11px] font-bold text-emerald-800 outline-none focus:ring-2 ring-emerald-200 bg-white" />
            )}
          </PriceRow>
          <PriceRow label="YD당 정액 (₩)" sub={isExport ? `원화로 적고 ${rateLabel('export')} ₩${num(rate)}로 $ 환산` : ''}>
            {(t) => (
              <div className="flex flex-col items-center">
                <DraftNumberInput step="any" min="0" value={quote.marginAdd?.[t.key] ?? ''} onValue={(v) => setAdd(t.key, v)} placeholder="0"
                  className="w-12 border border-emerald-300 rounded px-0.5 py-0.5 text-center font-mono text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-emerald-200 bg-white" />
                {isExport && Number(quote.marginAdd?.[t.key]) > 0 && (
                  <span className="text-[9px] text-slate-400 font-mono">≈ ${usd(Number(quote.marginAdd[t.key]) / rate)}</span>
                )}
              </div>
            )}
          </PriceRow>
          <PriceRow label={`최종 판매가 / yd (${sym})`} strong>
            {(t) => <span className="font-mono">{formatQuotePrice(tempSellPrice(built, t.key), currency)}</span>}
          </PriceRow>
          <PriceRow label="가견적서 표시" sub="체크한 구간만 PDF·엑셀에">
            {(t) => {
              const on = shown.includes(t.key);
              return (
                <button type="button" onClick={() => toggleShown(t.key)} aria-pressed={on}
                  title={on ? (shown.length === 1 ? '1개 이상은 켜 둬야 해요' : '가견적서에서 빼기') : '가견적서에 넣기'}
                  className={`inline-flex items-center justify-center w-7 h-6 rounded ${on ? 'text-emerald-700' : 'text-slate-300 hover:text-slate-500'}`}>
                  {on ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              );
            }}
          </PriceRow>
        </div>
      </div>

      {/* 가견적서 칸 — Spec · 유효기간 / MCQ 안내 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <label className="flex items-center gap-1.5">
          <span className="font-bold text-slate-600 whitespace-nowrap">가견적서 Spec</span>
          <input type="text" value={sheet?.quoteSpec ?? ''} onChange={e => patch({ quoteSpec: e.target.value })}
            placeholder="선택 — 예: C/SP 40/1 SINGLE JERSEY"
            className="w-56 border border-slate-300 rounded px-2 py-1 text-[11px] outline-none focus:ring-2 ring-emerald-200 bg-white" />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-bold text-slate-600 whitespace-nowrap">유효기간</span>
          <select value={sheet?.quoteValidityOption || TEMP_DEFAULT_VALIDITY} onChange={e => patch({ quoteValidityOption: e.target.value })}
            className="border border-slate-300 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-2 ring-emerald-200 bg-white">
            {QUOTE_VALIDITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <span className="text-slate-500">
          MCQ (컬러당) <b className="font-mono text-orange-600">{num(item.mcqYd)} YD</b>
          <span className="text-slate-400"> · {SMALL_RANGE}는 2컬러까지(소량 염색비 포함), {MCQ_FROM} 이상은 컬러마다 MCQ 기준</span>
        </span>
      </div>
      <p className="text-[10px] text-slate-400">
        판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액 · 가견적서는 견적서와 같은 양식 (Article = 원단명, 폭·GSM·g/YD 같이) — 견적 이력에는 남지 않아요.
      </p>
    </div>
  );
};
