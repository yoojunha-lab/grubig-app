import React, { useState } from 'react';
import { FileText, Save, Download, X, Plus, ClipboardPaste, FileSpreadsheet, FilePlus, DollarSign, Search } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num, calcQuotePrice, formatQuotePrice, getBasePrice, getQuoteValidUntil, QUOTE_VALIDITY_OPTIONS } from '../utils/helpers';
import { FabricPickerModal } from '../components/quote/FabricPickerModal';

// 견적 구간(오더 수량)
const TIERS = [
  { key: '1k', label: '1,000 YD' },
  { key: '3k', label: '3,000 YD', main: true },
  { key: '5k', label: '5,000 YD' },
];

export const QuotationPage = ({
  quoteInput,
  setQuoteInput,
  handleSaveQuote,
  savedQuotes,
  setSavedQuotes,
  handleDownloadPDF,
  handleDownloadExcel,
  handleNewQuote,
  handleQuoteSettingChange,
  handleQuoteMarginChange,
  handleBulkMarginRateChange,
  handleQuoteItemMarginChange,
  savedFabrics,
  handleAddFabricToQuote,
  handleRemoveItemFromQuote,
  createQuoteItem,
  showToast,
  handleGridPaste,
  globalExchangeRate,
  buyers = [],
  setIsBuyerModalOpen,
  yarnLibrary = []
}) => {
  const currency = quoteInput.currency;
  const cSym = currency === 'USD' ? '$' : '￦';

  // 단일 검색 추가용 원단 선택 팝업 상태
  const [isFabricPickerOpen, setIsFabricPickerOpen] = useState(false);

  // 매출이익율 입력칸 표시값: 구간별 객체면 해당 구간값, 레거시 단일 숫자면 그대로. (0은 "0"으로, 빈값은 "")
  const getTierRate = (val, tier) => {
    if (val && typeof val === 'object') return val[tier] ?? '';
    return val ?? '';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 w-full print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-600" /> Quotation</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleNewQuote} className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 transition-colors"><FilePlus className="w-4 h-4" /> 새 견적서</button>
          <button onClick={() => handleSaveQuote((item) => {
            // 기존 id가 있으면 수정(덮어쓰기), 없으면 신규 추가
            if (item.id && savedQuotes.some(q => q.id === item.id)) {
              setSavedQuotes(savedQuotes.map(q => q.id === item.id ? item : q));
            } else {
              setSavedQuotes([item, ...savedQuotes]);
            }
          })} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save</button>
          <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"><Download className="w-4 h-4" /> PDF</button>
          <button onClick={() => handleDownloadExcel()} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Buyer Information & Currency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-500">Buyer Name</label>
              <button onClick={() => setIsBuyerModalOpen(true)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">+ 바이어 관리</button>
            </div>
            <SearchableSelect
              value={quoteInput.buyerName || ''}
              options={(buyers || []).map(b => ({ id: b, name: b }))}
              onChange={(v) => setQuoteInput({ ...quoteInput, buyerName: v })}
              placeholder="등록된 바이어 선택..."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Attention (담당자)</label>
            <input type="text" value={quoteInput.attention || ''} onChange={(e) => setQuoteInput({ ...quoteInput, attention: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase" placeholder="예: MR. JOHN" />
          </div>
          <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Quote Date</label><input type="date" value={quoteInput.date} onChange={(e) => setQuoteInput({ ...quoteInput, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" /></div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">Valid (유효기간)</label>
            <select
              value={quoteInput.validityOption || '2weeks'}
              onChange={(e) => setQuoteInput({ ...quoteInput, validityOption: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-400"
            >
              {QUOTE_VALIDITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1 truncate" title="견적서에 표기될 유효기간 만료일">~ {getQuoteValidUntil(quoteInput.date, quoteInput.validityOption || '2weeks')}</p>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">시장 구분</label>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button onClick={() => handleQuoteSettingChange('marketType', 'domestic')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dom</button>
              <button onClick={() => handleQuoteSettingChange('marketType', 'export')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'export' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Exp</button>
            </div>
          </div>
          <div className="lg:col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-center gap-1 relative" title="사이드바의 전역 환율 자동 적용중">
            <label className="text-[10px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-wide"><DollarSign className="w-3 h-3 text-emerald-500" /> Global Rate (￦/$)</label>
            <div className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-right font-mono font-bold text-slate-600 text-sm shadow-sm">￦{num(globalExchangeRate)}</div>
          </div>

          {/* 마진 설정: 구간별 일괄 매출이익율(%) + 구간별 추가 영업마진(YD당 정액) */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-6 mt-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-500 mb-1">일괄 매출이익율 · 구간별 (%) — 전체 적용</label>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map(t => (
                  <div key={t.key}>
                    <div className={`text-[10px] font-bold mb-0.5 ${t.main ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</div>
                    <div className="relative">
                      <input type="number" step="any" value={getTierRate(quoteInput.bulkMarginRate, t.key)} onChange={(e) => handleBulkMarginRateChange(t.key, e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded px-2 py-2 text-right text-sm font-bold text-indigo-700 outline-none focus:border-indigo-400" placeholder="0" />
                      <span className="absolute right-1.5 top-2.5 text-[10px] text-indigo-400 font-bold pointer-events-none">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">구간별로 모든 원단에 일괄 적용. 아래 표에서 원단별로 따로 수정할 수 있고, 이 값을 다시 입력하면 해당 구간 전체가 재설정됩니다.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">구간별 추가 영업마진 · YD당 정액 ({cSym}) — 전체 적용</label>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map(t => (
                  <div key={t.key}>
                    <div className={`text-[10px] font-bold mb-0.5 ${t.main ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</div>
                    <input type="number" value={quoteInput.marginAdd?.[t.key] ?? ''} onChange={(e) => handleQuoteMarginChange('add', t.key, e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-right text-sm font-bold text-slate-700 outline-none focus:border-indigo-400" placeholder="0" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액. 둘 다 0이면 영업 기준원가 그대로입니다.</p>
            </div>
          </div>

          <div className="col-span-1 sm:col-span-2 lg:col-span-6 mt-2">
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Remarks (내부 참조용 메모)</label>
            <textarea value={quoteInput.remarks || ''} onChange={(e) => setQuoteInput({ ...quoteInput, remarks: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-400" placeholder="바이어 PDF에는 표시되지 않는 내부 기록용 메모입니다. (히스토리에서 확인 가능)"></textarea>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-2 gap-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase">1. 단일 검색 추가</h3>
          <button
            onClick={() => setIsFabricPickerOpen(true)}
            className="w-full sm:w-max bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-2 shrink-0"
          >
            <Search className="w-4 h-4" /> 원단 검색·추가 (목록에서 선택)
          </button>
        </div>

        <h3 className="text-sm font-bold text-slate-400 uppercase mb-2 mt-6">2. 견적서 리스트 및 일괄 추가</h3>
        <div className="overflow-hidden rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr><th className="p-3 w-10 text-center">No.</th><th className="p-3">Article</th><th className="p-3">Spec</th><th className="p-3 text-center">Cut</th><th className="p-3 text-center">Full</th><th className="p-3 text-right">GSM</th><th className="p-3 text-right">g/YD</th><th className="p-3 text-right text-orange-600 bg-orange-50/50">MCQ</th><th className="p-3 w-32 bg-slate-100 text-right">1,000 YD ({cSym})<span className="block text-[9px] font-normal text-slate-400 normal-case">판가 / 이익율%</span></th><th className="p-3 w-32 bg-indigo-50 text-indigo-900 text-right">3,000 YD ({cSym})<span className="block text-[9px] font-normal text-indigo-400 normal-case">판가 / 이익율%</span></th><th className="p-3 w-32 bg-slate-100 text-right">5,000 YD ({cSym})<span className="block text-[9px] font-normal text-slate-400 normal-case">판가 / 이익율%</span></th><th className="p-3 w-10 text-center"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quoteInput.items || []).map((item, idx) => (
                <tr
                  key={item.fabricId + '_' + idx}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="p-3 text-slate-400 font-mono text-center text-xs">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-800 text-xs uppercase">{item.article}</td>
                  <td className="p-3 text-slate-600 text-xs">{item.itemName}</td>
                  <td className="p-3 text-slate-500 text-center text-xs">{item.widthCut}"</td>
                  <td className="p-3 text-slate-500 text-center text-xs">{item.widthFull}"</td>
                  <td className="p-3 text-right text-slate-500 text-xs">{item.gsm}</td>
                  <td className="p-3 text-right text-slate-500 font-mono text-xs">{num(item.gYd)}</td>
                  <td className="p-3 text-right text-orange-600 font-bold font-mono bg-orange-50/30 text-xs">{num(item.mcqYd || 300)}</td>

                  {/* 구간별 판가 + 원가, 그 아래 작게 원단별 매출이익율(%) 개별 입력 */}
                  {TIERS.map(t => {
                    const price = calcQuotePrice(item, t.key, quoteInput, currency);
                    const base = getBasePrice(item, t.key);
                    const rate = getTierRate(item.marginRate, t.key);
                    const showBase = (Number(rate) || 0) > 0 || (Number(quoteInput.marginAdd?.[t.key]) || 0) > 0;
                    return (
                      <td key={t.key} className={`p-2 align-top ${t.main ? 'bg-indigo-50/30' : 'bg-slate-50'}`}>
                        <div className={`font-mono text-xs text-right ${t.main ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>{formatQuotePrice(price, currency)}</div>
                        {showBase && <div className="text-[9px] text-slate-400 mt-0.5 text-right">원가 {formatQuotePrice(base, currency)}</div>}
                        <div className="relative mt-1">
                          <input
                            type="number" step="any"
                            value={rate}
                            onChange={(e) => handleQuoteItemMarginChange(idx, t.key, e.target.value)}
                            className="w-full bg-white border border-indigo-200 rounded pl-1.5 pr-4 py-0.5 text-right text-[11px] font-bold text-indigo-700 outline-none focus:border-indigo-500"
                            placeholder="0"
                            title="이 원단의 해당 구간 매출이익율(%)"
                          />
                          <span className="absolute right-1 top-1 text-[8px] text-slate-300 font-bold pointer-events-none">%</span>
                        </div>
                      </td>
                    );
                  })}

                  <td className="p-2 text-center"><button onClick={() => handleRemoveItemFromQuote(idx)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}

              <tr>
                <td className="p-2 text-center text-slate-300 bg-slate-50 border-t border-slate-200 pointer-events-none rounded-bl-xl"><Plus className="w-4 h-4 mx-auto" /></td>
                <td className="p-2 border-t border-slate-200 bg-slate-50" colSpan="2">
                  <input
                    type="text"
                    placeholder="Article 입력 후 Enter 또는 엑셀(세로) 복붙..."
                    className="w-full bg-indigo-50 border border-indigo-200 text-indigo-800 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-xs font-bold shadow-sm uppercase"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const art = String(e.target.value).trim().toUpperCase();
                        if (!art) return;
                        const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
                        if (fabric) {
                          // 중복 차단
                          if ((quoteInput.items || []).some(i => String(i.article).toUpperCase() === art)) {
                             showToast('이미 추가된 품목입니다. 기존 항목을 확인해 주세요.', 'error');
                             e.target.value = '';
                             return;
                          }
                          setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), createQuoteItem(fabric, globalExchangeRate, prev.marketType, prev.bulkMarginRate)] }));
                          showToast('추가 완료', 'success'); e.target.value = '';
                        } else alert(`'${art}' 원단을 찾을 수 없습니다.`);
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      handleGridPaste(e.clipboardData.getData('text'));
                      e.target.value = '';
                    }}
                  />
                </td>
                <td colSpan="9" className="p-2 text-xs text-slate-400 border-t border-slate-200 bg-slate-50/50 flex items-center gap-1 h-[42px] rounded-br-xl">
                  <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400" /> <span className="hidden sm:inline">왼쪽 칸을 클릭하고</span> 엑셀 Article(원단명) 열을 복사 후 붙여넣어 보세요.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 단일 검색 추가 → 원단 선택 팝업 */}
      <FabricPickerModal
        isOpen={isFabricPickerOpen}
        onClose={() => setIsFabricPickerOpen(false)}
        fabrics={savedFabrics}
        existingFabricIds={(quoteInput.items || []).map(i => i.fabricId)}
        yarnLibrary={yarnLibrary}
        onPick={(fabricId) => handleAddFabricToQuote(fabricId, () => {})}
      />
    </div>
  );
};
