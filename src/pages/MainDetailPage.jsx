import React, { useState } from 'react';
import { Plus, Save, X, Trash2, Edit2, FileCheck, CheckCircle2, XCircle, Upload, ClipboardPaste, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';

export const MainDetailPage = ({
  mainDetails,
  savedFabrics,
  detailInput,
  setDetailInput,
  editingDetailId,
  setEditingDetailId,
  handleDetailChange,
  handleTestChange,
  addTest,
  removeTest,
  handleSaveDetail,
  handleEditDetail,
  handleDeleteDetail,
  resetDetailForm,
  handleQuickStatusChange,
  handleBulkPaste
}) => {
  const [activeTypeTab, setActiveTypeTab] = useState('main'); // 'main' | 'sample'
  const [searchTerm, setSearchTerm] = useState('');
  const [formTab, setFormTab] = useState('greige');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === 엑셀 복붙 그리드 모달 전용 State ===
  const GRID_COLS = [
    'orderNo','articleNo','colorInfo','lotNo',
    'greigeWidthFull','greigeGsm','greigeLoopLength',
    't1_finWidth','t1_finGsm','t1_shrinkW','t1_shrinkL','t1_torque','t1_gsm',
    't2_rework','t2_finWidth','t2_finGsm','t2_shrinkW','t2_shrinkL','t2_torque','t2_gsm'
  ];
  const GRID_HEADERS = [
    'Order No','Article No','Color','LOT',
    '생지폭(")','생지중량','루프장',
    '1차전폭','1차GSM','1차폭축','1차장축','1차토킹','1차수축GSM',
    '2차재가공','2차전폭','2차GSM','2차폭축','2차장축','2차토킹','2차수축GSM'
  ];
  const emptyRow = () => GRID_COLS.reduce((acc, col) => ({ ...acc, [col]: '' }), {});
  const initialGrid = () => Array.from({ length: 12 }, emptyRow);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [gridRows, setGridRows] = useState(initialGrid);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkType, setBulkType] = useState('main'); // 'main' | 'sample'

  const handleSaveModal = () => {
    if (handleSaveDetail()) {
      setIsModalOpen(false);
    }
  };

  const handleEditModal = (id) => {
    handleEditDetail(id);
    setIsModalOpen(true);
  }; // 'greige' | 'finished'

  // === 그리드 셀 값 변경 ===
  const handleGridCellChange = (rowIdx, colKey, value) => {
    setGridRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [colKey]: value };
      return next;
    });
  };

  // === 그리드에 엑셀 붙여넣기 (onPaste) ===
  const handleGridPaste = (e, startRowIdx, startColIdx) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text.trim()) return;

    const pastedRows = text.split('\n').map(r => r.split('\t').map(c => c.trim()));

    setGridRows(prev => {
      const next = [...prev];
      const neededRows = startRowIdx + pastedRows.length;
      while (next.length < neededRows) next.push(emptyRow());

      pastedRows.forEach((pRow, ri) => {
        pRow.forEach((val, ci) => {
          const targetColIdx = startColIdx + ci;
          if (targetColIdx < GRID_COLS.length) {
            const targetRowIdx = startRowIdx + ri;
            next[targetRowIdx] = { ...next[targetRowIdx], [GRID_COLS[targetColIdx]]: val };
          }
        });
      });
      return next;
    });
  };

  // === +10행 추가 ===
  const addGridRows = () => {
    setGridRows(prev => [...prev, ...Array.from({ length: 10 }, emptyRow)]);
  };

  // === 그리드 → 탭 구분 텍스트 변환 → handleBulkPaste 호출 (type 전달) ===
  const executeBulkUpload = () => {
    const filledRows = gridRows.filter(row => GRID_COLS.some(col => row[col]?.trim()));
    if (filledRows.length === 0) return;
    const rawText = filledRows.map(row => GRID_COLS.map(col => row[col] || '').join('\t')).join('\n');
    const result = handleBulkPaste(rawText, bulkType);
    setBulkResult(result);
    if (result.added > 0) setGridRows(initialGrid());
  };

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setGridRows(initialGrid());
    setBulkResult(null);
    setBulkType('main');
  };

  // 필터링 적용
  const filteredDetails = (mainDetails || []).filter(d => 
    d.type === activeTypeTab &&
    (
      (d.articleNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filledRowCount = gridRows.filter(row => GRID_COLS.some(col => row[col]?.trim())).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-fuchsia-600" />
            메인 디테일 시트 (QC & 실측)
          </h2>
          <p className="text-xs text-slate-500 mt-1">생산 건별 실측 데이터 및 수축률 테스트 내역을 시점별로 분리 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <ClipboardPaste className="w-4 h-4" /> 엑셀 복붙
          </button>
          <button 
            onClick={() => { resetDetailForm(); setIsModalOpen(true); }}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-fuchsia-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 새 시트 작성
          </button>
        </div>
      </div>

      {/* 엑셀 복붙 그리드 모달 */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={closeBulkModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] xl:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  일괄 입력
                </h3>
                {/* 메인/샘플 토글 */}
                <div className="flex bg-slate-200 p-0.5 rounded-lg text-[11px] font-bold">
                  <button onClick={() => setBulkType('main')} className={`px-3 py-1 rounded-md transition-all ${bulkType === 'main' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Main</button>
                  <button onClick={() => setBulkType('sample')} className={`px-3 py-1 rounded-md transition-all ${bulkType === 'sample' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sample</button>
                </div>
                {filledRowCount > 0 && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">{filledRowCount}건</span>
                )}
                {bulkType === 'sample' && (
                  <span className="text-[10px] text-blue-500 font-bold">* 샘플은 Article 없어도 OK</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addGridRows} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  + 10행 추가
                </button>
                <button onClick={closeBulkModal} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 그리드 테이블 */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs border-collapse min-w-[1400px]">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 text-center text-slate-400 w-10 font-bold">#</th>
                    {GRID_HEADERS.map((h, i) => {
                      const isRequired = i === 0 || (i === 1 && bulkType === 'main');
                      // 영역별 색상: 0~3 식별, 4~6 생지, 7~12 1차(emerald), 13~19 2차(amber)
                      let bgClass = 'text-slate-600';
                      if (i <= 3 && isRequired) bgClass = 'text-red-600 bg-red-50/50';
                      else if (i >= 4 && i <= 6) bgClass = 'text-indigo-600 bg-indigo-50/40';
                      else if (i >= 7 && i <= 12) bgClass = 'text-emerald-600 bg-emerald-50/40';
                      else if (i >= 13) bgClass = 'text-amber-700 bg-amber-50/40';
                      return (
                        <th key={i} className={`border border-slate-200 px-1.5 py-2 text-center font-bold whitespace-nowrap text-[10px] ${bgClass}`}>
                          {h} {isRequired && <span className="text-red-400 text-[9px]">*</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, rowIdx) => {
                    const hasData = GRID_COLS.some(col => row[col]?.trim());
                    return (
                      <tr key={rowIdx} className={`${hasData ? 'bg-emerald-50/30' : 'bg-white'} hover:bg-blue-50/30 transition-colors`}>
                        <td className="border border-slate-200 px-2 py-1 text-center text-slate-400 font-mono font-bold text-[10px] bg-slate-50">
                          {rowIdx + 1}
                        </td>
                        {GRID_COLS.map((col, colIdx) => (
                          <td key={col} className="border border-slate-200 p-0">
                            <input
                              type="text"
                              value={row[col] || ''}
                              onChange={e => handleGridCellChange(rowIdx, col, e.target.value)}
                              onPaste={e => handleGridPaste(e, rowIdx, colIdx)}
                              className={`w-full px-2 py-1.5 text-xs outline-none border-none bg-transparent focus:bg-blue-50 transition-colors ${col === 'articleNo' ? 'uppercase font-bold' : ''}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
              {bulkResult && (
                <div className={`mb-3 border rounded-xl p-3 ${bulkResult.added > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold flex items-center gap-1">
                      {bulkResult.added > 0 ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> <span className="text-emerald-700">완료</span></> : <><AlertTriangle className="w-3.5 h-3.5 text-red-600" /> <span className="text-red-700">실패</span></>}
                    </span>
                    <span className="text-emerald-600 font-bold">성공 {bulkResult.added}</span>
                    <span className="text-amber-600 font-bold">중복 {bulkResult.duplicated}</span>
                    <span className="text-red-600 font-bold">오류 {bulkResult.skipped}</span>
                    {bulkResult.errors.length > 0 && (
                      <details className="ml-auto">
                        <summary className="text-[10px] text-slate-500 font-bold cursor-pointer hover:text-slate-700">상세 로그</summary>
                        <div className="absolute right-6 mt-1 max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 shadow-lg z-20 w-80">
                          {bulkResult.errors.map((err, i) => <p key={i} className="text-[10px] text-slate-500 font-mono">{err}</p>)}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-slate-400">💡 엑셀에서 복사 → 첫 번째 칸 클릭 → Ctrl+V 하면 자동으로 칸이 채워집니다.</p>
                <div className="flex gap-3">
                  <button onClick={closeBulkModal} className="px-5 py-2 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors text-sm">닫기</button>
                  <button
                    onClick={executeBulkUpload}
                    disabled={filledRowCount === 0}
                    className={`px-6 py-2 rounded-xl font-bold text-white flex items-center gap-2 transition-all active:scale-95 shadow-md text-sm ${filledRowCount > 0 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                  >
                    <Upload className="w-4 h-4" /> 일괄 업로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="gap-6">
        
        {/* 새창(모달) 폼 */}
        {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => { resetDetailForm(); setIsModalOpen(false); }}>
          <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-200 relative w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => { resetDetailForm(); setIsModalOpen(false); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              {editingDetailId ? <><Edit2 className="w-4 h-4 text-amber-500" /> 시트 수정 중</> : <><Plus className="w-4 h-4 text-emerald-500" /> 새 시트 작성</>}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => { resetDetailForm(); setIsModalOpen(false); }} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded">취소</button>
            </div>
          </div>

          <div className="space-y-4">
            {/* 식별자 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">유형 (Type)</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button type="button" onClick={() => setDetailInput(p => ({ ...p, type: 'main' }))} className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${detailInput.type === 'main' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Main (메인)</button>
                  <button type="button" onClick={() => setDetailInput(p => ({ ...p, type: 'sample' }))} className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${detailInput.type === 'sample' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Sample (샘플)</button>
                </div>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Article No {detailInput.type === 'main' && '*'}</label>
                <SearchableSelect
                  value={detailInput.articleNo || ''}
                  options={(savedFabrics || []).map(f => ({ article: f.article, id: f.article }))}
                  onChange={(val) => setDetailInput(prev => ({ ...prev, articleNo: val?.toUpperCase?.() || val || '' }))}
                  placeholder="원단 검색 또는 직접 입력..."
                  labelKey="article"
                  valueKey="id"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Order No</label>
                <input type="text" name="orderNo" value={detailInput.orderNo || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase focus:ring-2 ring-fuchsia-200 outline-none" placeholder="Ex. 008124" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Color (색상)</label>
                <input type="text" name="colorInfo" value={detailInput.colorInfo || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase focus:ring-2 ring-fuchsia-200 outline-none" placeholder="Ex. BLACK" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">LOT No</label>
                <input type="text" name="lotNo" value={detailInput.lotNo || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase focus:ring-2 ring-fuchsia-200 outline-none" placeholder="Ex. L-01" />
              </div>
            </div>

            {/* 입력 폼 탭 분리 */}
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
              <div className="flex gap-1 mb-3">
                <button type="button" onClick={() => setFormTab('greige')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${formTab === 'greige' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>🌱 생지 등록</button>
                <button type="button" onClick={() => setFormTab('finished')} className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${formTab === 'finished' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>✨ 가공지 & QC 등록</button>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm min-h-[220px]">
                {formTab === 'greige' && (
                  <div className="animate-in fade-in duration-200">
                    <p className="text-[10px] font-extrabold text-indigo-600 mb-3 uppercase tracking-wider">🌾 생지 (Greige) 실측 데이터</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">전폭 (")</label>
                        <input type="text" name="greigeWidthFull" value={detailInput.greigeWidthFull || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-200 outline-none" placeholder="Ex. 60" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">중량 (G/YD)</label>
                        <input type="text" name="greigeGsm" value={detailInput.greigeGsm || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-200 outline-none" placeholder="Ex. 320" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">루프장</label>
                        <input type="text" name="greigeLoopLength" value={detailInput.greigeLoopLength || ''} onChange={handleDetailChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-200 outline-none" placeholder="Ex. 2.8" />
                      </div>
                    </div>
                  </div>
                )}

                {formTab === 'finished' && (
                  <div className="animate-in fade-in duration-200">
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">🔬 가공지 실측 & 수축 TEST 로깅</p>
                        <button type="button" onClick={addTest} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded font-bold transition-colors"> + Retest 추가</button>
                      </div>
                      
                      <div className="space-y-3">
                        {(detailInput.tests || []).map((test, index) => (
                          <div key={test.id || index} className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-sm">
                            <div className={`px-2 py-1.5 text-[10px] font-bold flex justify-between items-center border-b ${index === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              <span>{index === 0 ? '✔ 1차 TEST (최초)' : `✔ ${index + 1}차 TEST (재가공)`}</span>
                              {index > 0 && <button type="button" onClick={() => removeTest(index)} className="text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>}
                            </div>
                            <div className="p-3 space-y-3">
                               {/* 2차 이상: 재가공방법 */}
                               {index > 0 && (
                                 <div>
                                   <label className="block text-[9px] text-amber-600 mb-0.5 font-bold">재가공 방법 (Rework Method)</label>
                                   <input type="text" value={test.reworkMethod || ''} onChange={e=>handleTestChange(index, 'reworkMethod', e.target.value)} className="w-full bg-amber-50/30 border border-amber-200 rounded px-2 py-1.5 text-[11px] text-amber-700 placeholder-amber-300 outline-none focus:border-amber-400" placeholder="예: 텐타 180도 약하게" />
                                 </div>
                               )}

                               {/* 가공지 물리 실측치 */}
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <label className="block text-[9px] text-emerald-500 mb-0.5 font-bold">가공 전폭 (")</label>
                                   <input type="text" value={test.finWidthFull || ''} onChange={e=>handleTestChange(index, 'finWidthFull', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="58" />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] text-emerald-500 mb-0.5 font-bold">가공 중량 (GSM)</label>
                                   <input type="text" value={test.finGsm || ''} onChange={e=>handleTestChange(index, 'finGsm', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="300" />
                                 </div>
                               </div>

                               {/* 수축 TEST 결과 */}
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                 <div>
                                   <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">폭축 (W %)</label>
                                   <input type="text" value={test.shrinkWidth || ''} onChange={e=>handleTestChange(index, 'shrinkWidth', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="-3%" />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">장축 (L %)</label>
                                   <input type="text" value={test.shrinkLength || ''} onChange={e=>handleTestChange(index, 'shrinkLength', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="-4%" />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">토킹 (Torque)</label>
                                   <input type="text" value={test.torque || ''} onChange={e=>handleTestChange(index, 'torque', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-amber-400 focus:bg-amber-50" placeholder="2" />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">수축 GSM</label>
                                   <input type="text" value={test.gsm || ''} onChange={e=>handleTestChange(index, 'gsm', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-blue-400 focus:bg-blue-50" placeholder="310" />
                                 </div>
                               </div>
                               <div className="pt-2 border-t border-slate-100">
                                 <div className="w-1/3">
                                   <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">결과 판정</label>
                                   <select value={test.status || ''} onChange={e=>handleTestChange(index, 'status', e.target.value)} className={`w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-400 text-center font-bold ${test.status==='Pass'?'text-emerald-600 bg-emerald-50 border-emerald-300':test.status==='Fail'?'text-red-600 bg-red-50 border-red-300':''}`}>
                                     <option value="">-미판정-</option><option value="Pass">Pass</option><option value="Fail">Fail</option>
                                   </select>
                                 </div>
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 저장 버튼 */}
            <div className="pt-2">
               <button onClick={handleSaveModal} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-fuchsia-600/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                 <Save className="w-4 h-4" /> {editingDetailId ? '시트 내용 전체 저장' : '디테일 시트 등록하기'}
               </button>
            </div>

          </div>
          </div>
        </div>
        )}

        {/* 데이터 리스트 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden mt-6">
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setActiveTypeTab('main')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTypeTab === 'main' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Main (메인)</button>
              <button onClick={() => setActiveTypeTab('sample')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTypeTab === 'sample' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sample (샘플)</button>
            </div>
            <div className="w-64">
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Article 또는 Order 검색..." className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-fuchsia-100 outline-none" />
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-800 text-white p-2 text-xs font-bold w-12 rounded-tl-lg border-r border-slate-700">관리</th>
                  <th className="bg-slate-800 text-white p-2 text-xs font-bold text-left border-r border-slate-700">식별 정보 (ID)</th>
                  <th className="bg-indigo-900 text-white p-2 text-xs font-bold text-center border-r border-indigo-800" colSpan={3}>생지 (Greige)</th>
                  <th className="bg-emerald-900 text-white p-2 text-xs font-bold text-center border-r border-emerald-800" colSpan={2}>가공지 물리 규격</th>
                  <th className="bg-slate-800 text-white p-2 text-xs font-bold text-center rounded-tr-lg" colSpan={5}>최종 수축 TEST 내역</th>
                </tr>
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="p-1 border-r border-slate-200"></th>
                  <th className="p-1 px-2 text-[10px] text-slate-500 font-normal text-left border-r border-slate-200">등록일 / Order / Article / Color / LOT</th>
                  
                  {/* 생지 */}
                  <th className="p-1 text-[10px] text-indigo-500 font-normal text-center w-12 border-r border-slate-200 uppercase">폭(")</th>
                  <th className="p-1 text-[10px] text-indigo-500 font-normal text-center w-14 border-r border-slate-200 uppercase">중량(G/YD)</th>
                  <th className="p-1 text-[10px] text-indigo-500 font-normal text-center w-14 border-r border-slate-200 uppercase">루프장</th>
                  
                  {/* 가공지 */}
                  <th className="p-1 text-[10px] text-emerald-600 font-normal text-center w-12 border-r border-slate-200 uppercase">폭(")</th>
                  <th className="p-1 text-[10px] text-emerald-600 font-normal text-center w-14 border-r border-slate-200 uppercase">GSM</th>
                  
                  {/* QC 결과 */}
                  <th className="p-1 text-[10px] text-slate-500 font-bold text-center w-10 border-r border-slate-200">폭축</th>
                  <th className="p-1 text-[10px] text-slate-500 font-bold text-center w-10 border-r border-slate-200">장축</th>
                  <th className="p-1 text-[10px] text-slate-500 font-bold text-center w-10 border-r border-slate-200">토킹</th>
                  <th className="p-1 text-[10px] text-slate-500 font-bold text-center w-12 border-r border-slate-200">GSM</th>
                  <th className="p-1 text-[10px] text-slate-500 font-normal text-center w-18">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredDetails.length === 0 ? (
                   <tr><td colSpan={12} className="py-12 text-center text-slate-400 text-sm">등록된 디테일 시트가 없습니다.</td></tr>
                ) : (
                  filteredDetails.map(d => {
                    const latestTest = d.tests && d.tests.length > 0 ? d.tests[d.tests.length - 1] : null;
                    const isPass = latestTest?.status === 'Pass';
                    const isFail = latestTest?.status === 'Fail';
                    return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleEditModal(d.id)} className="p-1 text-slate-400 hover:text-fuchsia-600 bg-slate-100 rounded hover:bg-fuchsia-50 transition-colors" title="수정"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={() => handleDeleteDetail(d.id)} className="p-1 text-slate-400 hover:text-red-600 bg-slate-100 rounded hover:bg-red-50 transition-colors" title="삭제"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                      <td className="p-2 border-r border-slate-200">
                        <div className="flex flex-wrap items-center mt-0.5 font-mono text-[11px] leading-tight">
                          {[
                            <span key="date" className="text-slate-500 font-medium whitespace-nowrap">
                              {d.createdAt ? `${String(new Date(d.createdAt).getFullYear()).slice(-2)}/${String(new Date(d.createdAt).getMonth() + 1).padStart(2, '0')}/${String(new Date(d.createdAt).getDate()).padStart(2, '0')}` : '-'}
                            </span>,
                            d.orderNo && (
                              <span key="order" className="text-emerald-700 font-extrabold whitespace-nowrap">
                                <span className="text-[9px] text-emerald-600/70 font-normal mr-1">ORDER:</span>{d.orderNo}
                              </span>
                            ),
                            d.articleNo && (
                              <span key="article" className="text-fuchsia-700 font-extrabold whitespace-nowrap">
                                <span className="text-[9px] text-fuchsia-600/70 font-normal mr-1">ART:</span>{d.articleNo}
                              </span>
                            ),
                            d.colorInfo && (
                              <span key="color" className="text-slate-700 font-bold whitespace-nowrap">
                                <span className="text-[9px] text-slate-400 font-normal mr-1">COLOR:</span>{d.colorInfo}
                              </span>
                            ),
                            d.lotNo && (
                              <span key="lot" className="text-slate-700 font-bold whitespace-nowrap">
                                <span className="text-[9px] text-slate-400 font-normal mr-1">LOT:</span>{d.lotNo}
                              </span>
                            )
                          ].filter(Boolean).map((item, index, arr) => (
                            <React.Fragment key={item.key}>
                              {item}
                              {index < arr.length - 1 && <span className="text-slate-300 mx-2 font-light">|</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-indigo-700">{d.greigeWidthFull||'-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-indigo-700">{d.greigeGsm||'-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-indigo-700 font-bold">{d.greigeLoopLength||'-'}</td>
                      
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-emerald-700 font-bold bg-emerald-50/30">{d.tests?.[0]?.finWidthFull || d.finWidthFull || '-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-emerald-700 font-bold bg-emerald-50/30">{d.tests?.[0]?.finGsm || d.finGsm || '-'}</td>
                      
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-red-500">{latestTest?.shrinkWidth||'-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-red-500">{latestTest?.shrinkLength||'-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-amber-600">{latestTest?.torque||'-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-xs text-blue-600 font-bold">{latestTest?.gsm||'-'}</td>
                      
                      <td className="p-2 text-center text-[10px] font-bold h-full align-middle w-24">
                        {latestTest ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <select
                              value={latestTest.status || ''}
                              onChange={(e) => handleQuickStatusChange(d.id, d.tests.length - 1, e.target.value)}
                              className={`w-full outline-none text-center font-bold px-1 py-1.5 rounded border transition-colors cursor-pointer appearance-none
                                ${isPass ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 focus:bg-emerald-100' 
                                : isFail ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100 focus:bg-red-100' 
                                : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100 focus:bg-slate-100'}
                              `}
                            >
                              <option value="">- 판정대기 -</option>
                              <option value="Pass">Pass</option>
                              <option value="Fail">Fail</option>
                            </select>
                            <div className="pointer-events-none absolute top-[9px] right-2 flex items-center">
                               {isPass && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                               {isFail && <XCircle className="w-3 h-3 text-red-500" />}
                            </div>
                            {(isPass || isFail) && (
                              <span className="text-[8px] text-slate-400 font-normal mt-0.5">({d.tests.length}차 테스트)</span>
                            )}
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};
