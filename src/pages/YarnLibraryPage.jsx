import React from 'react';
import { X, Database, Upload, Factory, History, Plus, Save, Settings, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import { num } from '../utils/helpers';

export const YarnLibraryPage = ({
  filteredYarns,
  editingYarnId,
  resetYarnForm,
  handleBackupYarns,
  setIsYarnBulkModalOpen,
  yarnInput,
  setYarnInput,
  dynamicCategories,
  handleAddSupplier,
  handleSupplierChange,
  handleDeleteHistoryItem,
  handleRemoveSupplier,
  handleSaveYarn,
  yarnFilterCategory,
  setYarnFilterCategory,
  setIsCategoryModalOpen,
  yarnSearchTerm,
  setYarnSearchTerm,
  yarnFilterSupplier,
  setYarnFilterSupplier,
  uniqueSuppliers,
  handleEditYarn,
  handleDeleteYarn,
  yarnLibrary,
  setYarnLibrary
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-6 w-full print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">원사 라이브러리 ({filteredYarns.length}개)</h2>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          {editingYarnId && <button onClick={resetYarnForm} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800 mr-2"><X className="w-4 h-4" /> 수정 취소</button>}
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto">
            <button onClick={handleBackupYarns} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
            <button onClick={() => setIsYarnBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex"><Upload className="w-4 h-4" /> 엑셀 등록</button>
          </div>
        </div>
      </div>

      <div className={`bg-white p-4 sm:p-6 rounded-2xl border transition-all shadow-sm ${editingYarnId ? 'border-yellow-400 ring-4 ring-yellow-50' : 'border-slate-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="text-xs font-bold text-slate-500 mb-1 block">Category</label>
              <input type="text" list="yarn-categories" value={yarnInput.category} onChange={e => setYarnInput({ ...yarnInput, category: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-bold text-slate-700 uppercase" placeholder="카테고리" />
              <datalist id="yarn-categories">
                {dynamicCategories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
            </div>
            <div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">원사명</label><input type="text" value={yarnInput.name} onChange={e => setYarnInput({ ...yarnInput, name: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 text-sm font-bold uppercase" placeholder="예: 2/48 WOOL" /></div>
          </div>
          <div><label className="text-xs font-bold text-slate-500 mb-1 block">특이사항 (메모)</label><input type="text" value={yarnInput.remarks} onChange={e => setYarnInput({ ...yarnInput, remarks: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="공용 메모 입력..." /></div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
          <div className="flex justify-between items-center mb-4 min-w-[600px]">
            <span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Factory className="w-4 h-4 text-slate-400" /> 공급처(Supplier) 단가 관리</span>
            <button onClick={handleAddSupplier} className="text-xs bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-emerald-50 transition-colors">+ 새로운 업체 추가</button>
          </div>
          <div className="space-y-3 min-w-[600px]">
            {yarnInput.suppliers.map((sup, idx) => (
              <div key={sup.id} className={`flex flex-col gap-2 bg-white p-3 rounded-lg border shadow-sm relative transition-all ${sup.isDefault ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex flex-nowrap gap-3 items-start">
                  <div className="flex flex-col items-center justify-center w-12 shrink-0 h-[38px] bg-slate-50 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 mt-4" onClick={() => handleSupplierChange(sup.id, 'isDefault', true)} title="기본(대표) 업체로 설정">
                    <label className="text-[9px] text-slate-500 font-bold cursor-pointer">대표</label>
                    <input type="radio" name="defaultSup" checked={sup.isDefault} readOnly className="w-3.5 h-3.5 text-blue-600 cursor-pointer" />
                  </div>
                  <div className="flex-1 min-w-[120px]"><label className="text-[10px] text-slate-500 font-bold mb-1 block">업체명</label><input type="text" value={sup.name} onChange={e => handleSupplierChange(sup.id, 'name', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none uppercase" placeholder="업체명" /></div>
                  <div className="w-20 shrink-0"><label className="text-[10px] text-slate-500 font-bold mb-1 block">화폐</label><select value={sup.currency} onChange={e => handleSupplierChange(sup.id, 'currency', e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded px-1 py-1.5 text-sm font-bold"><option value="KRW">KRW</option><option value="USD">USD</option></select></div>
                  <div className="w-28 shrink-0"><label className="text-[10px] text-slate-500 font-bold mb-1 block">단가</label><input type="number" value={sup.price} onChange={e => handleSupplierChange(sup.id, 'price', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right font-mono font-bold focus:border-blue-500 outline-none" placeholder="0" /></div>
                  <div className="w-16 shrink-0"><label className="text-[10px] text-blue-500 font-bold mb-1 block">관세(%)</label><input type="number" value={sup.tariff} onChange={e => handleSupplierChange(sup.id, 'tariff', e.target.value)} className="w-full border border-blue-200 bg-blue-50 rounded px-1 py-1.5 text-sm text-right text-blue-700 font-bold focus:border-blue-500 outline-none" /></div>

                  {/* 운반비 미리보기 */}
                  <div className="w-20 shrink-0 flex flex-col">
                    <label className="text-[10px] text-emerald-500 font-bold mb-1 block">운반비(%)</label>
                    <input type="number" value={sup.freight} onChange={e => handleSupplierChange(sup.id, 'freight', e.target.value)} className="w-full border border-emerald-200 bg-emerald-50 rounded px-1 py-1.5 text-sm text-right text-emerald-700 font-bold focus:border-emerald-500 outline-none" />
                    {sup.price > 0 && sup.freight > 0 && <span className="text-[9px] text-emerald-600 mt-0.5 text-right font-mono tracking-tighter">+{Math.round(sup.price * (sup.freight / 100))}</span>}
                  </div>

                  {yarnInput.suppliers.length > 1 && (
                    <button onClick={() => handleRemoveSupplier(sup.id)} className="w-8 h-[34px] mt-4 flex items-center justify-center text-slate-400 hover:text-red-600 rounded bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors shrink-0" title="업체 삭제"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>

                {sup.history && sup.history.length > 0 && (
                  <div className="ml-16 bg-slate-50 border border-slate-100 p-2 rounded-md">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1"><History className="w-3 h-3" /> 단가 변경 기록</p>
                    <div className="flex flex-wrap gap-2">
                      {sup.history.map((h, hIdx) => (
                        <div key={hIdx} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 shadow-sm">
                          <span>{h.date}</span><span className="text-slate-300">|</span><span className="font-bold">{sup.currency === 'USD' ? '$' : '￦'}{num(h.price)}</span>
                          <button onClick={() => handleDeleteHistoryItem(sup.id, hIdx)} className="ml-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={handleSaveYarn} className={`px-10 py-3 rounded-xl flex gap-2 items-center font-bold text-white transition-all shadow-md ${editingYarnId ? 'bg-yellow-500 hover:bg-yellow-600 hover:shadow-lg' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-lg'}`}>{editingYarnId ? <><Save className="w-5 h-5" /> 수정된 정보 저장</> : <><Plus className="w-5 h-5" /> 시스템에 원사 등록</>}</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-200 pb-2 gap-4 overflow-x-auto">
        <div className="flex gap-2 items-center">
          <button onClick={() => setYarnFilterCategory('All')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${yarnFilterCategory === 'All' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
          {dynamicCategories.map(cat => (<button key={cat} onClick={() => setYarnFilterCategory(cat)} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${yarnFilterCategory === cat ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{cat}</button>))}
          <button onClick={() => setIsCategoryModalOpen(true)} className="ml-2 px-2 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"><Settings className="w-3.5 h-3.5" /> 관리</button>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="relative flex-1 sm:w-48">
            <input type="text" placeholder="원사명 검색..." value={yarnSearchTerm} onChange={(e) => setYarnSearchTerm(e.target.value.toUpperCase())} className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none text-sm bg-white shadow-sm focus:border-blue-400 uppercase" />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
            {yarnSearchTerm && <button onClick={() => setYarnSearchTerm('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>
          <Filter className="hidden sm:block w-4 h-4 text-slate-400" />
          <select value={yarnFilterSupplier} onChange={(e) => setYarnFilterSupplier(e.target.value)} className="hidden sm:block bg-white border border-slate-200 text-sm font-bold text-slate-600 rounded px-3 py-1.5 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors uppercase">
            {uniqueSuppliers.map(sup => <option key={sup} value={sup}>{sup === 'All' ? '모든 공급처' : sup}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[800px]">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr><th className="p-4 w-24">Category</th><th className="p-4">Yarn Name</th><th className="p-4">Suppliers</th><th className="p-4 text-right">Price(Exp)</th><th className="p-4 text-right">Tariff</th><th className="p-4 text-right">Freight</th><th className="p-4 text-right text-blue-600">Price(Dom)</th><th className="p-4">Remarks</th><th className="p-4 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredYarns.map((y) => {
              const defSup = y.suppliers?.find(s => s.isDefault) || y.suppliers?.[0] || {};
              const domPrice = Math.round((defSup.price || 0) * (1 + ((defSup.tariff || 0) + (defSup.freight || 0)) / 100));

              return (
                <tr key={y.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="p-4 text-slate-500 text-xs font-bold uppercase">{y.category || '-'}</td>
                  <td className="p-4 font-bold text-slate-800 uppercase">{y.name}</td>
                  <td className="p-4 font-medium text-slate-600 text-[11px] leading-relaxed uppercase">
                    {y.suppliers?.map((s, i) => (
                      <span key={s.id}>
                        {s.isDefault ? <strong className="text-blue-600 font-bold">[{s.name}]</strong> : s.name}
                        {i < y.suppliers.length - 1 && ', '}
                      </span>
                    ))}
                  </td>
                  <td className="p-4 text-right font-mono relative group/price">
                    <div className="flex items-center justify-end gap-2">
                      <span>{defSup.currency === 'USD' ? '$' : '￦'}{num(defSup.price)}</span>
                      {defSup.history && defSup.history.length > 0 && (<div className="relative"><History className="w-3 h-3 text-slate-400 cursor-help hover:text-blue-500" /><div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 text-white text-[10px] rounded p-2 z-50 hidden group-hover/price:block shadow-xl text-left pointer-events-none"><p className="font-bold mb-1 border-b border-slate-600 pb-1 text-slate-300">[{defSup.name}] Price History</p>{defSup.history.map((h, idx) => (<div key={idx} className="flex justify-between py-0.5"><span className="text-slate-400">{h.date}</span><span className="font-mono">￦{num(h.price)}</span></div>))}</div></div>)}
                    </div>
                  </td>
                  <td className="p-4 text-right text-slate-500">{defSup.tariff || 0}%</td>
                  <td className="p-4 text-right text-emerald-600 font-bold">
                    {defSup.freight || 0}%
                    {defSup.price > 0 && defSup.freight > 0 && defSup.currency === 'KRW' && <div className="text-[9px] text-slate-400 font-normal leading-tight">({Math.round(defSup.price * defSup.freight / 100)}원)</div>}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-blue-600">
                    {defSup.currency === 'USD' ? <span className="text-xs text-slate-400 italic">Calc by Rate</span> : `￦${num(domPrice)}`}
                  </td>
                  <td className="p-4 text-slate-500 text-xs truncate max-w-[150px]" title={y.remarks}>{y.remarks}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEditYarn(y)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="전체 수정"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteYarn(y.id, (id) => setYarnLibrary(yarnLibrary.filter(y => y.id !== id)))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="전체 삭제"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredYarns.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-slate-400">등록된 원사가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
