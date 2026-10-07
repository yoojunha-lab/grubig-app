import React, { useState } from 'react';
import {
  FileText, Save, X, Plus, FilePlus, DollarSign, ArrowLeft, RefreshCw, Tags, Calculator, Copy, Trash2,
  RotateCcw, AlertTriangle, Warehouse, Pencil,
} from 'lucide-react';
import { PartnerSelectField } from '../components/common/PartnerSelectField';
import { num, usd, roundUsd, QUOTE_VALIDITY_OPTIONS, rateForMarket, rateLabel } from '../utils/helpers';
import { QUOTE_TIERS, QUOTE_TIER_GROUPS } from '../constants/quote';
import {
  calcQuotePrice, formatQuotePrice, getBasePrice, getItemTierRate, getShownTiers, isNewMarginModel,
  calcCustomQuotePrice, getCustomRowRate, getCustomRowAddRaw, getMarginAddCurrency, toQuoteCurrencyAdd, quoteMarket,
  normalizeRunning, formatColorSplit,
} from '../utils/quoteModel';
import { FabricPickerModal } from '../components/quote/FabricPickerModal';
import { RunningGreigeModal } from '../components/quote/RunningGreigeModal';
import { CostWarningBadge } from '../components/cost/CostWarnings';
import {
  DraftNumberInput, QuoteSection, ExportButtons, ExcludeToggles, ArticleQuickAdd, PasteHint,
  AddFromListButton, DevSourceBadge, RunningGreigeBadge,
} from '../components/quote/QuoteParts';
import { DEV_QUOTE_SOURCE } from '../utils/devQuoteModel';

// ============================================================
// 견적서 작성 (2026-10-05 개편)
//  · 기준 견적: 300~5,000YD 6구간 중 고른 구간만 바이어 견적서에 표시. 구간별 이익율·정액
//  · 별도 견적: 원단마다 수량·컬러수를 바꿔 원가부터 다시 계산 (예: 300YD 3컬러)
//    - [러닝 생지 견적] (2026-10-07): 미리 짜 둔 생지로 받는 오더 — 생지 짠 수량·컬러별 수량으로 실비 계산하는 창
//      (components/quote/RunningGreigeModal). 러닝 생지 줄은 '러닝 생지' 배지 + 컬러별 수량, [수정]으로 창을 다시 엶
//  · 외관검사·시험성적서 제외는 칸마다 전체에 적용하는 버튼 (기준 견적 전체 / 별도 견적 전체)
//  · 원단 추가는 두 칸이 같은 방식: [원단 검색·추가] 팝업 + 표 아래 Article 입력(Enter)·엑셀 세로 복붙, 같은 원단은 한 줄만
//  · 두 칸은 머리줄을 눌러 접고 펴기, PDF·엑셀은 칸마다 따로 (기준 견적서 / 별도 견적서)
//  · 팝업(원단 검색·러닝 생지 견적)은 화면의 space-y 칸 밖에 둠 (팝업 규약 — 안에 두면 위 여백이 붙어 맨 위 띠가 안 덮임)
// ============================================================

export const QuotationPage = ({
  quoteInput,
  setQuoteInput,
  handleSaveQuote,
  savedQuotes,
  setSavedQuotes,
  handleDownloadPDF,
  handleDownloadQuoteExcel,
  handleNewQuote,
  handleQuoteSettingChange,
  handleRecalcQuote,
  handleQuoteMarginChange,
  handleBulkMarginRateChange,
  handleQuoteItemMarginChange,
  handleToggleShownTier,
  handleResetTierDefaults,
  handleQuoteExcludeChange,
  savedFabrics,
  handleAddFabricToQuote,
  handleRemoveItemFromQuote,
  handleRemoveItemsFromQuote,
  handleCopyToCustom,
  handleAddCustomFabric,
  handleCustomItemChange,
  handleRemoveCustomItems,
  handleCustomExcludeChange,
  previewRunningRow,      // 러닝 생지 견적 창 — 미리보기 / 넣기·고치기 / 해제 (useQuotation)
  handleSaveRunningRow,
  handleReleaseRunningRow,
  handleGridPaste,
  exchangeRates,          // 공통 환율 두 칸 { domestic, export } — 이 견적 시장의 '지금 환율'과 견적 환율 비교
  yarnLibrary = [],
  onBackToList,           // 병합 화면(견적서 workspace)에서 목록으로 돌아가기 (없으면 버튼 미표시)
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
}) => {
  const currency = quoteInput.currency;
  const isUsd = currency === 'USD';
  const cSym = isUsd ? '$' : '￦';
  // 이 견적의 환율 (품목을 넣을 때 기록. 아직 없으면 그 시장의 지금 환율) — 환율이 바뀌어도 견적 단가는 그대로
  //  지금 환율 = 내수 견적은 내수 환율, 수출 견적은 수출 환율 (화면 위 두 칸)
  const market = quoteMarket(quoteInput);
  const currentRate = rateForMarket(exchangeRates, market);
  const quoteRate = Number(quoteInput.exchangeRate) || currentRate;
  const rateDiffers = !!quoteInput.exchangeRate && Number(quoteInput.exchangeRate) !== currentRate;
  const items = quoteInput.items || [];
  const customItems = quoteInput.customItems || [];
  const hasAnyRows = items.length > 0 || customItems.length > 0;
  // 아주 옛날(추가 마크업) 견적 — 가격 보존을 위해 구간 설정·별도 견적은 막음
  const isLegacy = items.length > 0 && !isNewMarginModel(quoteInput);
  const shownTiers = getShownTiers(quoteInput);
  const shownKeys = shownTiers.map(t => t.key);

  // 칸 접기/펴기, 체크 선택, 원단 검색 팝업(기준/별도)
  const [openStd, setOpenStd] = useState(true);
  const [openCustom, setOpenCustom] = useState(true);
  const [selectedStd, setSelectedStd] = useState([]);       // fabricId 목록
  const [selectedCustom, setSelectedCustom] = useState([]); // 별도 견적 줄 id 목록
  const [pickerMode, setPickerMode] = useState(null);       // null | 'standard' | 'custom'
  const [runningModal, setRunningModal] = useState(null);   // 러닝 생지 견적 창: null 닫힘 | { rowId: null(새로) | 고칠 줄 id }

  const stdIds = items.map(it => String(it.fabricId));
  const selStd = selectedStd.filter(id => stdIds.includes(id));
  const customIds = customItems.map(r => r.id);
  const selCustom = selectedCustom.filter(id => customIds.includes(id));
  const toggleSel = (list, setList, id) => setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // 입력칸 표시값 (0은 "0", 빈값은 "")
  const tierValue = (obj, key) => (obj && typeof obj === 'object' ? (obj[key] ?? '') : '');
  const fmtMoney = (v) => (isUsd ? usd(v) : num(v));
  // YD당 정액은 원화로 적음 (예전 수출 견적만 $) — 수출 견적이면 칸 아래에 견적 환율로 환산한 $를 보여 줌
  const addBasis = getMarginAddCurrency(quoteInput);
  const addSym = addBasis === 'USD' ? '$' : '￦';
  const fmtAdd = (v) => (addBasis === 'USD' ? usd(v) : num(v));
  const showAddUsd = isUsd && addBasis === 'KRW';
  const addInUsd = (v) => `≈ $${usd(roundUsd(toQuoteCurrencyAdd(v, { ...quoteInput, exchangeRate: quoteRate || quoteInput.exchangeRate })))}`;

  // 기준 견적 표 열 너비 (구간 수에 따라)
  const stdMinWidth = 580 + shownTiers.length * 100;

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-4 w-full print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          {onBackToList && (
            <button onClick={onBackToList} title="견적 목록으로" className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <FileText className="w-6 h-6 text-indigo-600" /> Quotation
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => handleNewQuote()} className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 transition-colors"><FilePlus className="w-4 h-4" /> 새 견적서</button>
          <button onClick={() => handleSaveQuote((item) => {
            // 기존 id가 있으면 수정(덮어쓰기), 없으면 신규 추가
            if (item.id && savedQuotes.some(q => q.id === item.id)) {
              setSavedQuotes(savedQuotes.map(q => q.id === item.id ? item : q));
            } else {
              setSavedQuotes([item, ...savedQuotes]);
            }
          })} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Buyer Information & Currency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1행: 거래처 · 담당자(ATTN) · 비고(Remark) — ATTN 옆에 Remark */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Buyer Name (거래처)</label>
            <PartnerSelectField
              value={quoteInput.buyerName || ''}
              onSelect={(p) => setQuoteInput({ ...quoteInput, buyerName: p.name })}
              partners={partners}
              savePartner={savePartner}
              deletePartner={deletePartner}
              makeEmptyPartner={makeEmptyPartner}
              placeholder="거래처 선택 / 등록"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Attention (담당자)</label>
            <input type="text" value={quoteInput.attention || ''} onChange={(e) => setQuoteInput({ ...quoteInput, attention: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase" placeholder="예: MR. JOHN" />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Remark (내부 메모 · PDF 미표시)</label>
            <input type="text" value={quoteInput.remarks || ''} onChange={(e) => setQuoteInput({ ...quoteInput, remarks: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-400" placeholder="내부 기록용 (히스토리 확인)" />
          </div>

          {/* 2행: 발행일 · 유효기간 · 시장구분 · 환율 */}
          <div className="lg:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Quote Date</label><input type="date" value={quoteInput.date} onChange={(e) => setQuoteInput({ ...quoteInput, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Valid (유효기간)</label>
            <select
              value={quoteInput.validityOption || '2weeks'}
              onChange={(e) => setQuoteInput({ ...quoteInput, validityOption: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-400"
            >
              {QUOTE_VALIDITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">시장 구분</label>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button onClick={() => handleQuoteSettingChange('marketType', 'domestic')} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${quoteInput.marketType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dom</button>
              <button onClick={() => handleQuoteSettingChange('marketType', 'export')} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${quoteInput.marketType === 'export' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Exp</button>
            </div>
          </div>
          <div className="lg:col-span-1" title={`이 견적의 환율 — 품목을 넣을 때 그 시장의 공통 환율(${rateLabel(market)})로 기록되고, 화면 위 환율을 바꿔도 그대로예요. 바꾸려면 [현재 원가로 다시 계산]`}>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-500" /> Rate (견적)</label>
            <div className={`w-full border rounded-lg px-2 py-2 text-right font-mono font-bold text-sm ${rateDiffers ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>￦{num(quoteRate)}</div>
            {rateDiffers && <div className="text-[10px] text-amber-700 mt-0.5 text-right">지금 {rateLabel(market)} ￦{num(currentRate)}</div>}
          </div>
        </div>
        {hasAnyRows && handleRecalcQuote && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400">견적 단가는 품목을 넣을 때의 원가·견적 환율로 고정돼요. 원가나 환율이 바뀌었으면 다시 계산하세요. (기준·별도 견적 모두)</p>
            <button
              onClick={handleRecalcQuote}
              title={`모든 품목의 기준원가를 지금 원가(원가 설정·원사 단가)와 지금 ${rateLabel(market)}로 다시 계산해요. 매출이익율·YD당 정액은 그대로.`}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm border flex items-center justify-center gap-1.5 shrink-0 ${rateDiffers ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
            >
              <RefreshCw className="w-4 h-4" /> 현재 원가로 다시 계산
            </button>
          </div>
        )}
      </div>

      {/* ───────────── 기준 견적 ───────────── */}
      <QuoteSection
        icon={Tags}
        title="기준 견적"
        count={items.length}
        desc="정해 둔 수량 구간별 단가 — 고른 구간만 바이어 견적서에 나가요"
        open={openStd}
        onToggle={() => setOpenStd(o => !o)}
        actions={<ExportButtons label="기준 견적서" onPdf={() => handleDownloadPDF(null, 'standard')} onExcel={() => handleDownloadQuoteExcel(null, 'standard')} />}
      >
        {isLegacy ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>아주 옛날 방식(추가 마크업) 견적이라 원단 추가·구간 설정·외관검사/시험성적서 제외·별도 견적을 쓸 수 없어요. 새 견적으로 작성해 주세요.</span>
          </div>
        ) : (
          <>
            {/* 구간 설정: 견적서 표시 · 매출이익율 · YD당 정액 */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-extrabold text-slate-600">구간 설정 <span className="font-medium text-slate-400">— 체크한 구간만 표와 바이어 견적서에 나와요</span></span>
                <button type="button" onClick={handleResetTierDefaults} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white hover:bg-slate-50">
                  <RotateCcw className="w-3 h-3" /> 기본값으로
                </button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs min-w-[660px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold">
                      <th className="w-32 border-b border-slate-200"></th>
                      {QUOTE_TIER_GROUPS.map(g => (
                        <th key={g.key} colSpan={QUOTE_TIERS.filter(t => t.group === g.key).length} title={g.hint}
                          className={`py-1 border-b border-l border-slate-200 ${g.key === 'mcq' ? 'text-blue-600' : 'text-amber-700'}`}>
                          {g.label} <span className="font-medium text-slate-400">· {g.hint}</span>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-1.5 text-slate-500 font-bold border-b border-slate-200">구간</th>
                      {QUOTE_TIERS.map((t, i) => (
                        <th key={t.key} className={`px-2 py-1.5 text-center font-extrabold border-b border-slate-200 ${i > 0 && QUOTE_TIERS[i - 1].group !== t.group ? 'border-l-2 border-l-slate-300' : 'border-l border-slate-100'} ${t.main ? 'text-indigo-700' : 'text-slate-700'}`}>{t.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-slate-600 border-b border-slate-100">견적서 표시</td>
                      {QUOTE_TIERS.map((t, i) => {
                        const on = shownKeys.includes(t.key);
                        return (
                          <td key={t.key} className={`text-center py-1.5 border-b border-slate-100 ${i > 0 && QUOTE_TIERS[i - 1].group !== t.group ? 'border-l-2 border-l-slate-300' : 'border-l border-slate-100'} ${on ? 'bg-indigo-50/60' : ''}`}>
                            <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                              <input type="checkbox" checked={on} onChange={() => handleToggleShownTier(t.key)} className="w-4 h-4 accent-indigo-600" />
                              <span className={`text-[10px] font-bold ${on ? 'text-indigo-700' : 'text-slate-400'}`}>{on ? '표시' : '숨김'}</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-indigo-600 border-b border-slate-100">매출이익율 (%)</td>
                      {QUOTE_TIERS.map((t, i) => (
                        <td key={t.key} className={`px-1.5 py-1 border-b border-slate-100 ${i > 0 && QUOTE_TIERS[i - 1].group !== t.group ? 'border-l-2 border-l-slate-300' : 'border-l border-slate-100'} ${shownKeys.includes(t.key) ? 'bg-indigo-50/60' : ''}`}>
                          <div className="relative">
                            <DraftNumberInput step="any" value={tierValue(quoteInput.bulkMarginRate, t.key)} onValue={(v) => handleBulkMarginRateChange(t.key, v)}
                              title="모든 품목의 이 구간 이익율을 한 번에 바꿔요 (품목마다 따로 바꾼 값도 덮어씀)"
                              className="w-full bg-white border border-indigo-200 rounded px-1.5 py-1 pr-5 text-right text-xs font-bold text-indigo-700 outline-none focus:border-indigo-500" placeholder="0" />
                            <span className="absolute right-1.5 top-1.5 text-[9px] text-indigo-300 font-bold pointer-events-none">%</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-slate-600 leading-tight">
                        YD당 정액 ({addSym})
                        {showAddUsd && <span className="block text-[9px] font-semibold text-slate-400">견적 환율 ￦{num(quoteRate)}로 $ 환산</span>}
                        {addBasis === 'USD' && <span className="block text-[9px] font-semibold text-amber-600">예전 수출 견적 — $로 적혀 있음</span>}
                      </td>
                      {QUOTE_TIERS.map((t, i) => (
                        <td key={t.key} className={`px-1.5 py-1 ${i > 0 && QUOTE_TIERS[i - 1].group !== t.group ? 'border-l-2 border-l-slate-300' : 'border-l border-slate-100'} ${shownKeys.includes(t.key) ? 'bg-indigo-50/60' : ''}`}>
                          <DraftNumberInput step="any" value={tierValue(quoteInput.marginAdd, t.key)} onValue={(v) => handleQuoteMarginChange('add', t.key, v)}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right text-xs font-bold text-slate-700 outline-none focus:border-indigo-400" placeholder="0" />
                          {showAddUsd && <div className="text-[9px] text-slate-400 text-right mt-0.5">{addInUsd(quoteInput.marginAdd?.[t.key])}</div>}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액. YD당 정액은 원화로 적고, 수출 견적은 견적 환율로 나눠 $로 더해요. 품목마다 아래 표에서 이익율을 따로 바꿀 수 있어요.</p>
            </div>

            {/* 기준 견적 전체 — 외관검사·시험성적서 제외 */}
            <ExcludeToggles
              label="기준 견적 전체"
              visual={quoteInput.excludeVisual === true}
              chem={quoteInput.excludeChem === true}
              onChange={handleQuoteExcludeChange}
              note="누르면 기준 견적 모든 품목의 기준원가에서 그 비용을 빼고, 기준 견적서에 '불포함'으로 적혀요."
            />
          </>
        )}

        {/* 품목 도구줄 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold mr-1">선택 {selStd.length}개</span>
            {!isLegacy && (
              <button type="button" disabled={selStd.length === 0} onClick={() => { if (handleCopyToCustom(selStd)) { setSelectedStd([]); setOpenCustom(true); } }}
                className="px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                <Copy className="w-3.5 h-3.5" /> 별도 견적으로 복사
              </button>
            )}
            <button type="button" disabled={selStd.length === 0} onClick={() => { if (handleRemoveItemsFromQuote(selStd)) setSelectedStd([]); }}
              className="px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" /> 선택 삭제
            </button>
          </div>
          {!isLegacy && <AddFromListButton onClick={() => setPickerMode('standard')} />}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full table-fixed text-sm text-left" style={{ minWidth: `${stdMinWidth}px` }}>
            <thead className="bg-slate-50 text-slate-500 font-bold border-b-2 border-slate-200">
              <tr className="divide-x divide-slate-200">
                <th className="px-2 py-2 w-8 text-center">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" title="전체 선택"
                    checked={items.length > 0 && selStd.length === items.length}
                    onChange={(e) => setSelectedStd(e.target.checked ? stdIds : [])} />
                </th>
                <th className="px-2 py-2 w-9 text-center">No.</th>
                <th className="px-2 py-2 w-24">Article</th>
                <th className="px-2 py-2">Spec</th>
                <th className="px-2 py-2 w-11 text-center">Cut</th>
                <th className="px-2 py-2 w-11 text-center">Full</th>
                <th className="px-2 py-2 w-[52px] text-right">GSM</th>
                <th className="px-2 py-2 w-[52px] text-right">g/YD</th>
                <th className="px-2 py-2 w-14 text-right text-orange-600 bg-orange-50/50" title="컬러당 최소 수량">MCQ</th>
                {shownTiers.map(t => (
                  <th key={t.key} className={`px-2 py-1.5 w-[100px] text-right ${t.main ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-100'}`}>
                    {t.label} ({cSym})
                    <span className={`block text-[9px] font-normal normal-case ${t.main ? 'text-indigo-400' : 'text-slate-400'}`}>{t.group === 'small' ? '2컬러까지 · ' : ''}판가 / 이익율%</span>
                  </th>
                ))}
                <th className="px-2 py-1.5 w-9 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const id = String(item.fabricId);
                const checked = selStd.includes(id);
                return (
                  <tr key={item.fabricId + '_' + idx} className={`group transition-colors divide-x divide-slate-100 ${checked ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-2 text-center"><input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={checked} onChange={() => toggleSel(selectedStd, setSelectedStd, id)} /></td>
                    <td className="px-2 py-2 text-slate-400 font-mono text-center text-[13px]">{idx + 1}</td>
                    <td className="px-2 py-2 font-bold text-slate-800 text-[13px] uppercase break-words">
                      {item.article}
                      {item.sourceType === DEV_QUOTE_SOURCE && <DevSourceBadge />}
                    </td>
                    <td className="px-2 py-2 text-slate-600 text-[13px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{item.itemName}</span>
                        {/* 원가 확인 필요 — 품목을 넣을 때의 사유를 저장해 둔 것 (마우스를 올리면 사유) */}
                        <CostWarningBadge warnings={item.costWarnings} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-500 text-center text-[13px]">{item.widthCut}"</td>
                    <td className="px-2 py-2 text-slate-500 text-center text-[13px]">{item.widthFull}"</td>
                    <td className="px-2 py-2 text-right text-slate-500 text-[13px]">{item.gsm}</td>
                    <td className="px-2 py-2 text-right text-slate-500 font-mono text-[13px]">{num(item.gYd)}</td>
                    <td className="px-2 py-2 text-right text-orange-600 font-bold font-mono bg-orange-50/30 text-[13px]">{num(item.mcqYd || 300)}</td>

                    {/* 구간별 판가 + 원가, 그 아래 작게 원단별 매출이익율(%) 개별 입력 */}
                    {shownTiers.map(t => {
                      const price = calcQuotePrice(item, t.key, quoteInput, currency);
                      const base = getBasePrice(item, t.key);
                      const rate = tierValue(item.marginRate, t.key) === '' ? getItemTierRate(item, quoteInput, t.key) : tierValue(item.marginRate, t.key);
                      return (
                        <td key={t.key} className={`p-2 align-top ${t.main ? 'bg-indigo-50/30' : 'bg-slate-50'}`}>
                          {base === null ? (
                            <div className="text-right" title="예전에 넣은 품목이라 이 구간 단가가 없어요. [현재 원가로 다시 계산]을 누르면 채워져요.">
                              <div className="font-mono text-[13px] text-slate-300">—</div>
                              <div className="text-[9px] text-amber-600 mt-0.5">다시 계산 필요</div>
                            </div>
                          ) : (
                            <>
                              <div className={`font-mono text-[13px] text-right ${t.main ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>{formatQuotePrice(price, currency)}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5 text-right">원가 {formatQuotePrice(base, currency)}</div>
                            </>
                          )}
                          {!isLegacy && (
                            <div className="relative mt-1">
                              <DraftNumberInput
                                step="any"
                                value={rate}
                                onValue={(v) => handleQuoteItemMarginChange(idx, t.key, v)}
                                className="w-full bg-white border border-indigo-200 rounded pl-1.5 pr-4 py-0.5 text-right text-[11px] font-bold text-indigo-700 outline-none focus:border-indigo-500"
                                placeholder="0"
                                title="이 원단의 해당 구간 매출이익율(%)"
                              />
                              <span className="absolute right-1 top-1 text-[8px] text-slate-300 font-bold pointer-events-none">%</span>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="p-2 text-center"><button onClick={() => handleRemoveItemFromQuote(idx)} title="빼기" className="text-slate-300 hover:text-red-500 p-1 transition-colors"><X className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}

              {!isLegacy && (
                <tr>
                  <td colSpan="2" className="p-2 text-center text-slate-300 bg-slate-50 border-t border-slate-200 pointer-events-none"><Plus className="w-4 h-4 mx-auto" /></td>
                  <td className="p-2 border-t border-slate-200 bg-slate-50" colSpan="2">
                    <ArticleQuickAdd onAdd={(text) => handleGridPaste(text, 'standard')} />
                  </td>
                  <td colSpan={6 + shownTiers.length} className="p-2 text-xs text-slate-400 border-t border-slate-200 bg-slate-50/50 h-[42px] align-middle overflow-hidden">
                    <PasteHint />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </QuoteSection>

      {/* ───────────── 별도 견적 ───────────── */}
      <QuoteSection
        icon={Calculator}
        title="별도 견적"
        count={customItems.length}
        desc="수량·컬러를 바꿔 따로 계산 (예: 300YD 3컬러) — 기준 견적서와 따로 보내요"
        tone="amber"
        open={openCustom}
        onToggle={() => setOpenCustom(o => !o)}
        actions={<ExportButtons label="별도 견적서" onPdf={() => handleDownloadPDF(null, 'special')} onExcel={() => handleDownloadQuoteExcel(null, 'special')} />}
      >
        {!isLegacy && (
          <ExcludeToggles
            label="별도 견적 전체"
            visual={quoteInput.customExcludeVisual === true}
            chem={quoteInput.customExcludeChem === true}
            onChange={handleCustomExcludeChange}
            note="누르면 별도 견적 모든 줄의 기준원가에서 그 비용을 빼고, 별도 견적서에 '불포함'으로 적혀요."
          />
        )}

        {/* 도구줄 — 기준 견적과 같은 자리·같은 버튼 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold mr-1">선택 {selCustom.length}줄</span>
            <button type="button" disabled={selCustom.length === 0} onClick={() => { if (handleRemoveCustomItems(selCustom)) setSelectedCustom([]); }}
              className="px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" /> 선택 삭제
            </button>
            <span className="text-[11px] text-slate-400 ml-1">기준 견적에서 원단을 체크하고 [별도 견적으로 복사]를 눌러도 들어와요.</span>
          </div>
          {!isLegacy && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* 러닝 생지 견적 (2026-10-07) — 미리 짜 둔 생지로 소량·여러 컬러 오더를 받을 때 */}
              <button type="button" onClick={() => setRunningModal({ rowId: null })}
                title="미리 짜 둔 생지(러닝 생지)로 소량·여러 컬러 오더를 받을 때 — 생지 짠 수량·컬러별 수량으로 실비를 계산해서 별도 견적에 넣어요"
                className="w-full sm:w-max px-3 py-1.5 rounded-lg font-bold text-sm border flex items-center justify-center gap-1.5 shrink-0 bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200">
                <Warehouse className="w-4 h-4" /> 러닝 생지 견적
              </button>
              <AddFromListButton tone="amber" onClick={() => setPickerMode('custom')} />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full table-fixed text-sm text-left min-w-[880px]">
            <thead className="bg-amber-50/60 text-slate-500 font-bold border-b-2 border-amber-200 text-xs">
              <tr className="divide-x divide-amber-100">
                <th className="px-2 py-2 w-8 text-center">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-amber-600" title="전체 선택"
                    checked={customItems.length > 0 && selCustom.length === customItems.length}
                    onChange={(e) => setSelectedCustom(e.target.checked ? customIds : [])} />
                </th>
                <th className="px-2 py-2">원단</th>
                <th className="px-2 py-2 w-[196px]">수량 (YD) · 컬러</th>
                <th className="px-2 py-2 w-[78px] text-right">이익율 %</th>
                <th className="px-2 py-2 w-[90px] text-right">YD당 정액 ({addSym})</th>
                <th className="px-2 py-2 w-[112px] text-right">판가 / YD</th>
                <th className="px-2 py-2 w-[110px] text-right">총액</th>
                <th className="px-2 py-2 w-[52px] text-center" title="별도 견적서(바이어용)에 이 줄을 넣을지">견적서</th>
                <th className="px-2 py-2 w-9"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-xs text-slate-400 leading-relaxed">
                    아직 별도 견적이 없어요. 아래 칸에 Article을 넣거나 <b className="text-amber-700">[원단 검색·추가]</b>, 또는 기준 견적에서 <b className="text-amber-700">[별도 견적으로 복사]</b>를 누르세요.<br />
                    수량·컬러수를 바꾸면 시험성적서(이화학)·염색 최소 청구까지 그 조건으로 다시 계산해요.<br />
                    미리 짜 둔 생지로 받는 오더는 <b className="text-teal-700">[러닝 생지 견적]</b> — 생지 짠 수량·컬러별 수량으로 계산해요.
                  </td>
                </tr>
              )}
              {customItems.map(row => {
                const checked = selCustom.includes(row.id);
                const price = calcCustomQuotePrice(row, quoteInput, currency);
                const qtyNum = Number(row.qty) || 0;
                const colorsNum = Number(row.colors) || 0;
                const perColor = qtyNum > 0 && colorsNum > 0 ? Math.round(qtyNum / colorsNum) : 0;
                const mcq = Number(row.mcqYd) || 0;
                const belowMcq = perColor > 0 && mcq > 0 && perColor < mcq;
                // 러닝 생지 줄 — 수량·컬러는 창에서 (컬러별 수량), MCQ 미달은 컬러마다 실제 수량으로 셈
                const running = normalizeRunning(row.running);
                const belowMcqColors = running && mcq > 0 ? running.colorQtys.filter(q => q < mcq).length : 0;
                const rateDefault = getCustomRowRate({ ...row, marginRate: null }, quoteInput);
                const addDefault = getCustomRowAddRaw({ ...row, marginAdd: null }, quoteInput);
                const qtyBad = !(qtyNum > 0);
                const colorsBad = !(colorsNum > 0);
                return (
                  <tr key={row.id} className={`align-top divide-x divide-slate-100 ${checked ? 'bg-amber-50/50' : 'hover:bg-slate-50'} ${row.show === false ? 'opacity-60' : ''}`}>
                    <td className="px-2 py-2 text-center"><input type="checkbox" className="w-3.5 h-3.5 accent-amber-600" checked={checked} onChange={() => toggleSel(selectedCustom, setSelectedCustom, row.id)} /></td>
                    <td className="px-2 py-2">
                      <div className="font-bold text-slate-800 text-[13px] uppercase">
                        {row.article}
                        {row.sourceType === DEV_QUOTE_SOURCE && <DevSourceBadge />}
                        {running && <RunningGreigeBadge greigeQty={running.greigeQty} />}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                        <span>{row.itemName}</span>
                        <CostWarningBadge warnings={row.costWarnings} />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.widthCut}/{row.widthFull}" · {row.gsm}g · MCQ {num(mcq)}YD/컬러</div>
                    </td>
                    <td className="px-2 py-2">
                      {running ? (
                        // 러닝 생지 줄 — 수량 = 컬러별 합계, 컬러 = 칸 수 (고치는 건 창에서)
                        <>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm font-bold text-slate-800">{num(qtyNum)}</span>
                            <span className="text-[11px] text-slate-400">YD</span>
                            <span className="font-mono text-sm font-bold text-slate-800 ml-1">{num(colorsNum)}</span>
                            <span className="text-[11px] text-slate-400">컬러</span>
                            <button type="button" onClick={() => setRunningModal({ rowId: row.id })}
                              title="러닝 생지 견적 창에서 생지 짠 수량·컬러별 수량·이익율 고치기"
                              className="ml-auto flex items-center gap-0.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 hover:bg-teal-100">
                              <Pencil className="w-3 h-3" /> 수정
                            </button>
                          </div>
                          <div className="text-[10px] mt-1 font-bold text-teal-700">컬러별 {formatColorSplit(row)} YD</div>
                          <div className="text-[10px] text-slate-400">생지 짠 수량 {num(running.greigeQty)}YD</div>
                          {belowMcqColors > 0 && (
                            <div className="text-[10px] text-amber-700 font-bold">MCQ {num(mcq)} 미달 {belowMcqColors}컬러</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <input type="number" min="1" step="1" value={row.qty ?? ''} onChange={(e) => handleCustomItemChange(row.id, { qty: e.target.value })}
                              className={`w-[76px] bg-white border rounded px-1.5 py-1 text-right text-sm font-bold outline-none focus:border-amber-500 ${qtyBad ? 'border-red-300 text-red-600' : 'border-slate-300 text-slate-800'}`} placeholder="YD" title="오더 총수량 (YD)" />
                            <span className="text-[11px] text-slate-400">YD</span>
                            <input type="number" min="1" step="1" value={row.colors ?? ''} onChange={(e) => handleCustomItemChange(row.id, { colors: e.target.value })}
                              className={`w-[44px] bg-white border rounded px-1.5 py-1 text-right text-sm font-bold outline-none focus:border-amber-500 ${colorsBad ? 'border-red-300 text-red-600' : 'border-slate-300 text-slate-800'}`} placeholder="컬러" title="컬러수 — 이화학·염색을 컬러마다 따로 계산" />
                            <span className="text-[11px] text-slate-400">컬러</span>
                          </div>
                          {perColor > 0 && (
                            <div className={`text-[10px] mt-1 ${belowMcq ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                              컬러당 {num(perColor)}YD{belowMcq ? ` · MCQ ${num(mcq)} 미달` : ''}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="any" value={row.marginRate ?? ''} onChange={(e) => handleCustomItemChange(row.id, { marginRate: e.target.value })}
                        className={`w-full bg-white border border-indigo-200 rounded px-1.5 py-1 text-right text-xs font-bold outline-none focus:border-indigo-500 ${row.marginRate === null || row.marginRate === undefined ? 'text-slate-400' : 'text-indigo-700'}`}
                        placeholder={String(rateDefault)} title={`비워 두면 수량 구간 기본값 ${rateDefault}%`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="any" value={row.marginAdd ?? ''} onChange={(e) => handleCustomItemChange(row.id, { marginAdd: e.target.value })}
                        className={`w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right text-xs font-bold outline-none focus:border-indigo-400 ${row.marginAdd === null || row.marginAdd === undefined ? 'text-slate-400' : 'text-slate-700'}`}
                        placeholder={fmtAdd(addDefault)} title="비워 두면 0 (별도 견적은 정액 기본값 없음)" />
                      {showAddUsd && Number(row.marginAdd) > 0 && <div className="text-[9px] text-slate-400 text-right mt-0.5">{addInUsd(row.marginAdd)}</div>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="font-mono text-[14px] font-extrabold text-amber-800">{formatQuotePrice(price, currency)}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">원가 {formatQuotePrice(row.basePrice ?? null, currency)}</div>
                      {row.dye?.minApplied && (
                        <div className="text-[9px] font-bold text-rose-600 mt-0.5"
                          title={Array.isArray(row.dye.perColorKgs)
                            ? `컬러별 생지 ${row.dye.perColorKgs.map(kg => num(kg)).join(' / ')}kg — ${num(row.dye.minKg)}kg 미만인 컬러는 ${num(row.dye.minKg)}kg로 청구 (염색 최소 청구)`
                            : `컬러당 생지 ${num(row.dye.perColorKg)}kg → ${num(row.dye.minKg)}kg로 청구 (염색 최소 청구)`}>
                          염색 최소 청구 포함
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[12px] text-slate-600">
                      {price === null || !(qtyNum > 0) ? '—' : `${cSym}${fmtMoney(isUsd ? roundUsd(price * qtyNum) : price * qtyNum)}`}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" className="w-4 h-4 accent-amber-600" checked={row.show !== false} onChange={(e) => handleCustomItemChange(row.id, { show: e.target.checked })} title="별도 견적서(바이어용)에 이 줄을 넣기" />
                    </td>
                    <td className="px-2 py-2 text-center"><button onClick={() => handleRemoveCustomItems([row.id])} title="이 줄 지우기" className="text-slate-300 hover:text-red-500 p-1 transition-colors"><X className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}

              {!isLegacy && (
                <tr>
                  <td className="p-2 text-center text-slate-300 bg-slate-50 border-t border-slate-200 pointer-events-none"><Plus className="w-4 h-4 mx-auto" /></td>
                  <td className="p-2 border-t border-slate-200 bg-slate-50" colSpan="2">
                    <ArticleQuickAdd tone="amber" onAdd={(text) => handleGridPaste(text, 'custom')} />
                  </td>
                  <td colSpan={6} className="p-2 text-xs text-slate-400 border-t border-slate-200 bg-slate-50/50 h-[42px] align-middle overflow-hidden">
                    <PasteHint />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400">이익율을 비워 두면 수량이 속한 기준 구간 값(위 구간 설정), YD당 정액은 비워 두면 0이에요. 총액 = 판가 × 수량 (화면에서만 보여요). 러닝 생지 줄은 [수정]으로 생지 짠 수량·컬러별 수량을 바꿔요.</p>
      </QuoteSection>
    </div>

    {/* 팝업은 화면의 space-y 칸 밖에 (팝업 규약 — 안에 두면 위 여백이 붙어 맨 위 띠가 안 덮임) */}
    {/* 원단 검색 팝업 — 기준·별도 견적 같은 방식 (그 칸에 이미 담긴 원단은 '추가됨') */}
    <FabricPickerModal
      isOpen={pickerMode !== null}
      onClose={() => setPickerMode(null)}
      fabrics={savedFabrics}
      existingFabricIds={pickerMode === 'custom' ? customItems.map(r => r.fabricId) : items.map(i => i.fabricId)}
      yarnLibrary={yarnLibrary}
      title={pickerMode === 'custom' ? '별도 견적에 넣을 원단' : undefined}
      onPick={(fabricId) => (pickerMode === 'custom' ? handleAddCustomFabric(fabricId) : handleAddFabricToQuote(fabricId, () => {}))}
    />

    {/* 러닝 생지 견적 창 — 미리 짜 둔 생지로 받는 오더 (생지 짠 수량·컬러별 수량으로 실비 계산 → 별도 견적 줄) */}
    {runningModal && (
      <RunningGreigeModal
        initialRowId={runningModal.rowId}
        quote={quoteInput}
        quoteRate={quoteRate}
        fabrics={savedFabrics}
        preview={previewRunningRow}
        onSave={handleSaveRunningRow}
        onRelease={handleReleaseRunningRow}
        onClose={() => setRunningModal(null)}
      />
    )}
    </>
  );
};
