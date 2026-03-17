import React, { useState } from 'react';
import { FileText, Save, Download, DollarSign, X, Plus, ClipboardPaste, GripVertical } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num, smartRound } from '../utils/helpers';

export const QuotationPage = ({
  quoteInput,
  setQuoteInput,
  handleSaveQuote,
  savedQuotes,
  setSavedQuotes,
  handleDownloadPDF,
  handleQuoteSettingChange,
  selectedFabricIdForQuote,
  setSelectedFabricIdForQuote,
  savedFabrics,
  handleAddFabricToQuote,
  getBasePrice,
  extraMarkup,
  handleQuoteBasePriceChange,
  formatQuotePrice,
  handleRemoveItemFromQuote,
  createQuoteItem,
  showToast,
  handleGridPaste,
  globalExchangeRate,
  buyers = [],
  setIsBuyerModalOpen
}) => {
  // 드래그 앤 드롭 상태 관리
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox 오류 방지를 위해 임의의 데이터 셋팅
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (index !== draggedItemIndex) {
      setDragOverItemIndex(index);
    }
  };

  const handleDragEnd = (e) => {
    e.preventDefault();
    if (draggedItemIndex !== null && dragOverItemIndex !== null && draggedItemIndex !== dragOverItemIndex) {
      // 순서 변경 적용 로직
      const newItems = [...(quoteInput.items || [])];
      const draggedItem = newItems.splice(draggedItemIndex, 1)[0];
      newItems.splice(dragOverItemIndex, 0, draggedItem);
      
      setQuoteInput({ ...quoteInput, items: newItems });
    }
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 w-full print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-600" /> Quotation</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => handleSaveQuote((item) => setSavedQuotes([item, ...savedQuotes]))} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save</button>
          <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"><Download className="w-4 h-4" /> PDF</button>
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
            <select value={quoteInput.buyerName} onChange={(e) => setQuoteInput({ ...quoteInput, buyerName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase cursor-pointer text-sm font-bold text-slate-700 outline-none focus:ring-1 ring-indigo-400">
              <option value="" disabled>등록된 바이어 선택</option>
              {buyers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Attention (담당자)</label>
            <input type="text" value={quoteInput.attention || ''} onChange={(e) => setQuoteInput({ ...quoteInput, attention: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase" placeholder="예: MR. JOHN" />
          </div>
          <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Quote Date</label><input type="date" value={quoteInput.date} onChange={(e) => setQuoteInput({ ...quoteInput, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" /></div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">Settings</label>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button onClick={() => handleQuoteSettingChange('buyerType', 'converter')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'converter' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Conv</button>
              <button onClick={() => handleQuoteSettingChange('buyerType', 'brand')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'brand' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Brand</button>
              <div className="w-px bg-slate-300 mx-1"></div>
              <button onClick={() => handleQuoteSettingChange('marketType', 'domestic')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dom</button>
              <button onClick={() => handleQuoteSettingChange('marketType', 'export')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'export' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Exp</button>
            </div>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-indigo-500 mb-1 flex items-center gap-1">Extra Margin</label>
            <div className="relative">
              <input type="number" value={quoteInput.extraMargin || 0} onChange={(e) => handleQuoteSettingChange('extraMargin', e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-right font-bold text-indigo-700 outline-none" placeholder="0" />
              <span className="absolute right-3 top-2 text-xs text-indigo-400 font-bold">%</span>
            </div>
          </div>
          <div className="lg:col-span-1 bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-center gap-1 relative" title="사이드바의 전역 환율 자동 적용중">
            <label className="text-[10px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-wide"><DollarSign className="w-3 h-3 text-emerald-500" /> Global Rate (￦/$)</label>
            <div className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-right font-mono font-bold text-slate-600 text-sm shadow-sm">￦{num(globalExchangeRate)}</div>
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
          <div className="flex gap-2 w-full sm:w-max">
            <SearchableSelect value={selectedFabricIdForQuote} options={savedFabrics} onChange={setSelectedFabricIdForQuote} placeholder="Search Fabric..." labelKey="article" valueKey="id" />
            <button onClick={() => handleAddFabricToQuote(selectedFabricIdForQuote, setSelectedFabricIdForQuote)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 shrink-0 border border-indigo-200">+ Add</button>
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-400 uppercase mb-2 mt-6">2. 견적서 리스트 및 일괄 추가</h3>
        <div className="overflow-hidden rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr><th className="p-3 w-8 text-center"></th><th className="p-3 w-10 text-center">No.</th><th className="p-3">Article</th><th className="p-3">Spec</th><th className="p-3 text-center">Cut</th><th className="p-3 text-center">Full</th><th className="p-3 text-right">GSM</th><th className="p-3 text-right">g/YD</th><th className="p-3 text-right text-orange-600 bg-orange-50/50">MCQ</th><th className="p-3 w-28 bg-slate-100 text-right">1,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-28 bg-indigo-50 text-indigo-900 text-right">3,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-28 bg-slate-100 text-right">5,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-10 text-center"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quoteInput.items.map((item, idx) => (
                <tr 
                  key={item.fabricId + idx} // 리스트 변경 감지를 위해 키 강화
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`group hover:bg-slate-50 transition-colors ${draggedItemIndex === idx ? 'opacity-30 bg-indigo-50' : ''} ${dragOverItemIndex === idx ? 'border-t-2 border-indigo-400 bg-indigo-50/30' : ''}`}
                >
                  <td className="p-1 px-2 text-center text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4 mx-auto" /></td>
                  <td className="p-3 text-slate-400 font-mono text-center text-xs">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-800 text-xs uppercase cursor-grab active:cursor-grabbing">{item.article}</td>
                  <td className="p-3 text-slate-600 text-xs">{item.itemName}</td>
                  <td className="p-3 text-slate-500 text-center text-xs">{item.widthCut}"</td>
                  <td className="p-3 text-slate-500 text-center text-xs">{item.widthFull}"</td>
                  <td className="p-3 text-right text-slate-500 text-xs">{item.gsm}</td>
                  <td className="p-3 text-right text-slate-500 font-mono text-xs">{num(item.gYd)}</td>
                  <td className="p-3 text-right text-orange-600 font-bold font-mono bg-orange-50/30 text-xs">{num(item.mcqYd || 300)}</td>

                  <td className="p-2 bg-slate-50">
                    <input type="number" value={smartRound(getBasePrice(item, '1k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice1k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none text-xs" />
                    {quoteInput.extraMargin > 0 && <div className="text-[9px] text-slate-400 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '1k'))}</div>}
                  </td>
                  <td className="p-2 bg-indigo-50/30">
                    <input type="number" value={smartRound(getBasePrice(item, '3k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice3k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-right font-bold text-indigo-700 focus:border-indigo-500 outline-none text-xs" />
                    {quoteInput.extraMargin > 0 && <div className="text-[9px] text-indigo-400/70 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '3k'))}</div>}
                  </td>
                  <td className="p-2 bg-slate-50">
                    <input type="number" value={smartRound(getBasePrice(item, '5k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice5k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none text-xs" />
                    {quoteInput.extraMargin > 0 && <div className="text-[9px] text-slate-400 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '5k'))}</div>}
                  </td>
                  <td className="p-2 text-center"><button onClick={() => handleRemoveItemFromQuote(idx)} className="text-slate-300 hover:text-red-500 p-1"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}

              <tr>
                <td className="p-2 text-center bg-slate-50 rounded-bl-xl border-t border-slate-200 pointer-events-none"></td>
                <td className="p-2 text-center text-slate-300 bg-slate-50 border-t border-slate-200 pointer-events-none"><Plus className="w-4 h-4 mx-auto" /></td>
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
                          setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), createQuoteItem(fabric, globalExchangeRate, prev.marketType, prev.buyerType)] }));
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
    </div>
  );
};
