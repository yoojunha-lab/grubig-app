import React, { useState, useEffect } from 'react';
import { X, Database, Upload, Factory, History, Plus, Save, Settings, Search, Filter, Edit2, Trash2, Truck, Check } from 'lucide-react';
import { YarnLibraryRow } from '../components/yarn/YarnLibraryRow';
import { MobileYarnCard } from '../components/yarn/MobileYarnCard';
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
  setYarnLibrary,
  globalExchangeRate
}) => {
  const [isYarnFormModalOpen, setIsYarnFormModalOpen] = useState(false);
  const [isBulkFreightModalOpen, setIsBulkFreightModalOpen] = useState(false);
  const [selectedBulkSuppliers, setSelectedBulkSuppliers] = useState([]);
  const [bulkFreightAmount, setBulkFreightAmount] = useState('');

  // 외부(다른 뷰)에서 수정 요건 발생 시 모달 오픈
  useEffect(() => {
    if (editingYarnId) {
      setIsYarnFormModalOpen(true);
    }
  }, [editingYarnId]);

  const handleOpenAddYarn = () => {
    resetYarnForm();
    setIsYarnFormModalOpen(true);
  };

  const handleCloseYarnModal = () => {
    resetYarnForm();
    setIsYarnFormModalOpen(false);
  };

  const handleSaveModalYarn = () => {
    if (!yarnInput.name) {
      handleSaveYarn(); // 기본 훅에서 에러 토스트 띄움
      return;
    }
    handleSaveYarn();
    setIsYarnFormModalOpen(false);
  };

  // --- 업체별 일괄 업데이트 모달 로직 ---
  const handleOpenBulkModal = () => {
    const suppliersList = uniqueSuppliers.filter(s => s !== 'All');
    setSelectedBulkSuppliers(suppliersList); // 오픈 시 전체 선택 (사용자 편의)
    setBulkFreightAmount('');
    setIsBulkFreightModalOpen(true);
  };

  const toggleBulkSupplier = (sup) => {
    setSelectedBulkSuppliers(prev => 
      prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
    );
  };

  const selectAllBulkSuppliers = () => setSelectedBulkSuppliers(uniqueSuppliers.filter(s => s !== 'All'));
  const deselectAllBulkSuppliers = () => setSelectedBulkSuppliers([]);

  const executeBulkFreightUpdate = () => {
    if (selectedBulkSuppliers.length === 0) {
      window.alert('일괄 적용할 업체(공급처)를 최소 1개 이상 선택해 주세요.');
      return;
    }
    const freightValue = Number(bulkFreightAmount);
    if (bulkFreightAmount === '' || isNaN(freightValue) || freightValue < 0) {
      window.alert('올바른 금액을 숫자로만 입력해 주세요.');
      return;
    }
    
    if (window.confirm(`선택한 업체(${selectedBulkSuppliers.join(', ')})에 대하여 운반비를 ￦${num(freightValue)}(으)로 일괄 변경하시겠습니까?`)) {
      const updatedLibrary = yarnLibrary.map(yarn => {
        let hasChanges = false;
        const newSuppliers = (yarn.suppliers || []).map(sup => {
          if (selectedBulkSuppliers.includes(sup.name)) {
            hasChanges = true;
            return { ...sup, freight: freightValue };
          }
          return sup;
        });
        return hasChanges ? { ...yarn, suppliers: newSuppliers } : yarn;
      });
      setYarnLibrary(updatedLibrary);
      setIsBulkFreightModalOpen(false);
      window.alert('선택된 업체의 운반비 일괄 변경이 완료되었습니다.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 w-full print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">원사 라이브러리 ({filteredYarns.length}개)</h2>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <button onClick={handleOpenAddYarn} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap"><Plus className="w-4 h-4" /> 새 원사 등록</button>
          
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto mt-2 sm:mt-0">
            <button onClick={handleOpenBulkModal} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 border-r border-slate-200 text-sm font-bold flex"><Truck className="w-4 h-4 text-emerald-500" /> 업체별 일괄변경</button>
            <button onClick={handleBackupYarns} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
            <button onClick={() => setIsYarnBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex"><Upload className="w-4 h-4" /> 엑셀 등록</button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 영역 강화 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl">
          <input
            type="text"
            placeholder="찾으시는 원사명이나 메모를 검색해 보세요..."
            value={yarnSearchTerm}
            onChange={(e) => setYarnSearchTerm(e.target.value.toUpperCase())}
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl outline-none text-base font-bold bg-slate-50 focus:bg-white focus:border-blue-500 transition-all uppercase placeholder:normal-case placeholder:font-normal"
          />
          <Search className="w-6 h-6 text-slate-400 absolute left-4 top-3" />
          {yarnSearchTerm && (
            <button onClick={() => setYarnSearchTerm('')} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full p-0.5">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select value={yarnFilterCategory} onChange={(e) => setYarnFilterCategory(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-600 rounded-lg px-4 py-3 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors uppercase shrink-0">
            <option value="All">전체 카테고리</option>
            {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select value={yarnFilterSupplier} onChange={(e) => setYarnFilterSupplier(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-600 rounded-lg px-4 py-3 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors uppercase shrink-0">
            {uniqueSuppliers.map(sup => <option key={sup} value={sup}>{sup === 'All' ? '모든 공급처' : sup}</option>)}
          </select>
          <button onClick={() => setIsCategoryModalOpen(true)} className="px-3 py-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors shrink-0 whitespace-nowrap">
            <Settings className="w-4 h-4" /> 관리
          </button>
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[900px]">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight text-[13px]">
            <tr>
              <th className="px-6 py-3 w-28">Category</th>
              <th className="px-6 py-3">Yarn Name</th>
              <th className="px-6 py-3">Suppliers</th>
              <th className="px-6 py-3 text-right">Price(Exp)</th>
              <th className="px-6 py-3 text-right">Tariff</th>
              <th className="px-6 py-3 text-right">Freight(￦)</th>
              <th className="px-6 py-3 text-right text-blue-800">Price(Dom)</th>
              <th className="px-6 py-3">Remarks</th>
              <th className="px-6 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredYarns.map((y) => (
              <YarnLibraryRow
                key={y.id}
                y={y}
                globalExchangeRate={globalExchangeRate}
                handleEditYarn={(yarn) => { handleEditYarn(yarn); setIsYarnFormModalOpen(true); }}
                handleDeleteYarn={handleDeleteYarn}
                yarnLibrary={yarnLibrary}
                setYarnLibrary={setYarnLibrary}
              />
            ))}
            {filteredYarns.length === 0 && <tr><td colSpan="9" className="p-16 text-center text-slate-500 font-medium">검색 결과가 없거나 등록된 원사가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 모바일 뷰 카드 리스트 */}
      <div className="md:hidden space-y-4 pb-6">
        {filteredYarns.map((y) => (
          <MobileYarnCard
            key={y.id}
            y={y}
            globalExchangeRate={globalExchangeRate}
            handleEditYarn={(yarn) => { handleEditYarn(yarn); setIsYarnFormModalOpen(true); }}
            handleDeleteYarn={handleDeleteYarn}
            yarnLibrary={yarnLibrary}
            setYarnLibrary={setYarnLibrary}
          />
        ))}
        {filteredYarns.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-sm">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-extrabold text-slate-700 mb-1">등록된 원사가 없습니다.</p>
            <p className="text-[11px] text-slate-400">검색 조건을 변경하거나 새 원사를 등록해주세요.</p>
          </div>
        )}
      </div>

      {/* 원사 등록/수정 모달 (Modal) */}
      {isYarnFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {editingYarnId ? <Edit2 className="w-5 h-5 text-yellow-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {editingYarnId ? '원사 정보 수정' : '새 원사 등록'}
              </h3>
              <button onClick={handleCloseYarnModal} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto hidden-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Category <span className="text-red-500">*</span></label>
                    <select value={yarnInput.category || ''} onChange={e => setYarnInput({ ...yarnInput, category: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-slate-50 font-bold text-slate-700 uppercase cursor-pointer focus:border-blue-500 focus:bg-white transition-colors outline-none">
                      <option value="" disabled>분류 선택</option>
                      {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">원사명 <span className="text-red-500">*</span></label>
                    <input type="text" value={yarnInput.name} onChange={e => setYarnInput({ ...yarnInput, name: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold uppercase focus:border-blue-500 focus:bg-white bg-slate-50 transition-colors outline-none" placeholder="예: 2/48 WOOL" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">특이사항 (메모)</label>
                  <input type="text" value={yarnInput.remarks} onChange={e => setYarnInput({ ...yarnInput, remarks: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 focus:bg-white bg-slate-50 transition-colors outline-none" placeholder="공용 메모 입력..." />
                </div>
              </div>

              <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Factory className="w-4 h-4 text-slate-400" /> 공급처(Supplier) 단가 관리</span>
                  <button onClick={handleAddSupplier} className="text-xs bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-emerald-50 transition-colors active:scale-95">+ 새로운 업체 추가</button>
                </div>
                
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 overflow-x-hidden min-w-[700px] md:min-w-0">
                  {yarnInput.suppliers.map((sup, idx) => (
                    <div key={sup.id} className={`flex flex-col gap-2 bg-white p-3.5 rounded-xl border shadow-sm relative transition-all ${sup.isDefault ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex flex-nowrap gap-3 items-start">
                        <div className="flex flex-col items-center justify-center w-12 shrink-0 h-[38px] bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 mt-5 transition-colors" onClick={() => handleSupplierChange(sup.id, 'isDefault', true)} title="기본(대표) 업체로 설정">
                          <label className="text-[10px] text-slate-500 font-bold cursor-pointer">대표</label>
                          <input type="radio" name="defaultSup" checked={sup.isDefault} readOnly className="w-3.5 h-3.5 text-blue-600 cursor-pointer" />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-[10px] text-slate-500 font-bold mb-1 block">업체명</label>
                          <input type="text" value={sup.name} onChange={e => handleSupplierChange(sup.id, 'name', e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none uppercase bg-slate-50 focus:bg-white" placeholder="업체명" />
                        </div>
                        <div className="w-24 shrink-0">
                          <label className="text-[10px] text-slate-500 font-bold mb-1 block">화폐</label>
                          <select value={sup.currency} onChange={e => handleSupplierChange(sup.id, 'currency', e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded-lg px-2 py-2 text-sm font-bold focus:border-blue-500 outline-none">
                            <option value="KRW">KRW</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                        <div className="w-32 shrink-0">
                          <label className="text-[10px] text-slate-500 font-bold mb-1 block">단가</label>
                          <input type="number" value={sup.price} onChange={e => handleSupplierChange(sup.id, 'price', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right font-mono font-bold focus:border-blue-500 outline-none bg-slate-50 focus:bg-white" placeholder="0" />
                        </div>
                        <div className="w-20 shrink-0">
                          <label className="text-[10px] text-blue-500 font-bold mb-1 block">관세(%)</label>
                          <input type="number" value={sup.tariff} onChange={e => handleSupplierChange(sup.id, 'tariff', e.target.value)} className="w-full border border-blue-200 bg-blue-50 rounded-lg px-2 py-2 text-sm text-right text-blue-700 font-bold focus:border-blue-500 outline-none" />
                        </div>
                        <div className="w-28 shrink-0 flex flex-col">
                          <label className="text-[10px] text-emerald-500 font-bold mb-1 block">운반비(￦)</label>
                          <input type="number" value={sup.freight} onChange={e => handleSupplierChange(sup.id, 'freight', e.target.value)} className="w-full border border-emerald-200 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right text-emerald-700 font-bold focus:border-emerald-500 outline-none" />
                        </div>
                        {yarnInput.suppliers.length > 1 && (
                          <button onClick={() => handleRemoveSupplier(sup.id)} className="w-10 h-[38px] mt-5 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors shrink-0" title="업체 삭제">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {sup.history && sup.history.length > 0 && (
                        <div className="ml-[60px] bg-slate-50 border border-slate-100 p-2.5 rounded-lg mt-1">
                          <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1"><History className="w-3 h-3" /> 단가 변경 기록</p>
                          <div className="flex flex-wrap gap-2">
                            {sup.history.map((h, hIdx) => (
                              <div key={hIdx} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-600 shadow-sm">
                                <span>{h.date}</span><span className="text-slate-200">|</span><span className="font-bold">{sup.currency === 'USD' ? '$' : '￦'}{num(h.price)}</span>
                                <button onClick={() => handleDeleteHistoryItem(sup.id, hIdx)} className="ml-1 text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={handleCloseYarnModal} 
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSaveModalYarn} 
                className={`px-8 py-2.5 rounded-xl flex gap-2 items-center font-bold text-white transition-all shadow-md active:scale-95 ${editingYarnId ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                {editingYarnId ? <><Save className="w-4 h-4" /> 수정 완료</> : <><Plus className="w-4 h-4" /> 정보 등록</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사종별 운반비 일괄변경 모달 */}
      {isBulkFreightModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" /> 업체별 운임 일괄변경
              </h3>
              <button onClick={() => setIsBulkFreightModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label className="text-sm font-bold text-slate-700">적용할 업체(공급처) 선택</label>
                  <div className="flex gap-2 text-xs">
                    <button onClick={selectAllBulkSuppliers} className="text-blue-600 font-bold hover:underline py-0.5">전체선택</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={deselectAllBulkSuppliers} className="text-slate-500 font-bold hover:underline py-0.5">선택해제</button>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uniqueSuppliers.filter(s => s !== 'All').map(sup => (
                    <label key={sup} onClick={() => toggleBulkSupplier(sup)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${selectedBulkSuppliers.includes(sup) ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${selectedBulkSuppliers.includes(sup) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'}`}>
                        {selectedBulkSuppliers.includes(sup) && <Check className="w-3 h-3" />}
                      </div>
                      <span className="text-sm font-bold truncate">{sup}</span>
                    </label>
                  ))}
                  {uniqueSuppliers.filter(s => s !== 'All').length === 0 && (
                    <div className="col-span-full text-center text-slate-400 text-sm py-2">등록된 업체가 없습니다.</div>
                  )}
                </div>
                <p className="text-right text-[11px] text-slate-500 mt-1.5 font-medium">선택된 업체 수: <span className="text-blue-600 font-bold">{selectedBulkSuppliers.length}</span>개</p>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">일괄 적용할 운반비 (￦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">￦</span>
                  <input 
                    type="number" 
                    value={bulkFreightAmount} 
                    onChange={e => setBulkFreightAmount(e.target.value)} 
                    placeholder="0"
                    className="w-full border-2 border-emerald-200 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setIsBulkFreightModalOpen(false)} 
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={executeBulkFreightUpdate} 
                className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                일괄 업데이트 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
