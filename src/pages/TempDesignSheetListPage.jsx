import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, FlaskConical, Calendar, User, FileText, X, Save } from 'lucide-react';
import { num } from '../utils/helpers';

/**
 * 가설계서(레시피) 관리 페이지
 * - 가설계서 목록을 보고, CRUD(생성/수정/삭제)할 수 있는 전용 화면
 * - 정식 설계서의 DesignSheetPage를 모달 형태로 재사용 (isTempMode=true)
 */
export const TempDesignSheetListPage = ({
  tempDesignSheets,
  tempInput,
  setTempInput,
  editingTempId,
  handleTempChange,
  handleTempSectionChange,
  handleTempYarnChange,
  handleTempCostInputChange,
  handleTempCostNestedChange,
  handleSaveTemp,
  handleEditTemp,
  handleDeleteTemp,
  resetTempForm,
  getTempDesignCost,
  // DesignSheetPage 렌더링에 필요한 props
  yarnSelectOptions,
  user,
  viewMode,
  globalExchangeRate,
  knittingFactories,
  dyeingFactories,
  machineTypes,
  structures,
  addMasterItem,
  setActiveMasterModal,
  // 모달 제어
  isTempModalOpen,
  setIsTempModalOpen,
  // DesignSheetPage 컴포넌트 자체
  DesignSheetPage
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 검색 필터링
  const filteredSheets = useMemo(() =>
    (tempDesignSheets || [])
      .filter(s => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return String(s.fabricName || '').toLowerCase().includes(q) ||
          String(s.buyerName || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [tempDesignSheets, searchTerm]
  );

  // 날짜 포맷
  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return '-'; }
  };

  return (
    <div className="space-y-6">
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 rounded-lg text-white shadow-md">
              <FlaskConical className="w-5 h-5" />
            </div>
            가설계서 (레시피) 관리
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            정식 O/D 이전에 원가 시뮬레이션 및 스펙을 미리 설정해두는 레시피 보관함
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { resetTempForm(); setIsTempModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-amber-700 transition-colors active:scale-95">
            <Plus className="w-3.5 h-3.5" /> 새 가설계서 작성
          </button>
        </div>
      </div>

      {/* 2. 검색 영역 */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="원단명, 바이어명으로 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 ring-amber-200 outline-none" />
        </div>
      </div>

      {/* 3. 가설계서 목록 */}
      {filteredSheets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-bold">
            {searchTerm ? '검색된 가설계서가 없습니다.' : '아직 가설계서가 없습니다.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">상단의 [새 가설계서 작성] 버튼으로 레시피를 등록해보세요.</p>
        </div>
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-amber-800 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" />
                가설계서 목록
                <span className="text-[11px] font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{filteredSheets.length}건</span>
              </h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                  <th className="p-3 w-[130px]">생성 날짜</th>
                  <th className="p-3 w-[180px]">원단명</th>
                  <th className="p-3 w-[130px]">바이어명</th>
                  <th className="p-3 w-[100px] text-center">GSM / 폭</th>
                  <th className="p-3 w-[120px] text-right">3K 도매가 (미리보기)</th>
                  <th className="p-3 w-[80px] text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredSheets.map(sheet => {
                  const costData = getTempDesignCost?.(sheet);
                  const domestic3k = costData?.tier3k?.domestic;
                  return (
                    <tr key={sheet.id} className="border-b border-slate-100 hover:bg-amber-50/30 transition-colors group">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-mono text-slate-600">{formatDate(sheet.createdAt)}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{formatDate(sheet.updatedAt)} 수정</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-extrabold text-slate-800">{sheet.fabricName || '(이름없음)'}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-600">{sheet.buyerName || '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-mono font-bold text-indigo-700">
                          {sheet.costInput?.gsm || '-'}g
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          {sheet.costInput?.widthCut || '-'}" / {sheet.costInput?.widthFull || '-'}"
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {domestic3k ? (
                          <span className="text-sm font-mono font-black text-indigo-800">
                            ₩{num(domestic3k.priceConverter || 0)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { handleEditTemp(sheet); setIsTempModalOpen(true); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="수정">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTemp(sheet.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="block md:hidden space-y-3">
            {filteredSheets.map(sheet => {
              const costData = getTempDesignCost?.(sheet);
              const domestic3k = costData?.tier3k?.domestic;
              return (
                <div key={sheet.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-amber-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">{sheet.fabricName || '(이름없음)'}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {sheet.buyerName || '-'}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(sheet.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { handleEditTemp(sheet); setIsTempModalOpen(true); }}
                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteTemp(sheet.id)}
                        className="p-1.5 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 mt-2">
                    <span className="text-xs text-slate-500">
                      {sheet.costInput?.gsm || '-'}g / {sheet.costInput?.widthCut || '-'}" / {sheet.costInput?.widthFull || '-'}"
                    </span>
                    {domestic3k ? (
                      <span className="text-sm font-mono font-black text-indigo-800">₩{num(domestic3k.priceConverter || 0)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 4. 가설계서 작성/편집 모달 (DesignSheetPage 재사용, isTempMode=true) */}
      {isTempModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8 overflow-x-hidden"
          onClick={() => setIsTempModalOpen(false)}>
          <div className="w-full max-w-[1800px] relative bg-transparent mx-auto" onClick={e => e.stopPropagation()}>
            <DesignSheetPage
              isTempMode={true}
              sheetInput={tempInput}
              editingSheetId={editingTempId}
              handleSheetChange={handleTempChange}
              handleSectionChange={handleTempSectionChange}
              handleSheetYarnChange={handleTempYarnChange}
              handleCostInputChange={handleTempCostInputChange}
              handleCostNestedChange={handleTempCostNestedChange}
              handleActualDataChange={() => {}}
              handleSaveSheet={(u) => { handleSaveTemp(u); setIsTempModalOpen(false); }}
              handleDeleteSheet={(id) => { handleDeleteTemp(id); setIsTempModalOpen(false); }}
              resetSheetForm={() => { resetTempForm(); setIsTempModalOpen(false); }}
              advanceStage={() => {}}
              getDesignCost={getTempDesignCost}
              yarnSelectOptions={yarnSelectOptions}
              user={user}
              viewMode={viewMode}
              setActiveTab={() => setIsTempModalOpen(false)}
              globalExchangeRate={globalExchangeRate}
              devRequests={[]}
              setSheetInput={setTempInput}
              closeModal={() => setIsTempModalOpen(false)}
              designSheets={[]}
              knittingFactories={knittingFactories}
              dyeingFactories={dyeingFactories}
              machineTypes={machineTypes}
              structures={structures}
              addMasterItem={addMasterItem}
              setActiveMasterModal={setActiveMasterModal}
              savedFabrics={[]}
              mainDetails={[]}
              tempBuyerName={tempInput.buyerName || ''}
              onTempBuyerChange={(val) => setTempInput(prev => ({ ...prev, buyerName: val }))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
