import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, FlaskConical, Calendar, User, FileText, X, Save, ArrowRight } from 'lucide-react';
import { num, applyGrossMargin, smartRound } from '../utils/helpers';

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
  DesignSheetPage,
  // [C2] 가설계서 → 정식 설계서 진입점에 필요한 props
  resetSheetForm,
  setIsDesignSheetModalOpen,
  setSheetInput,
  loadTempToSheet
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created'); // created(기본) | name | buyer | price

  const quoteSym = viewMode === 'export' ? '$' : '₩';
  // 최종 판매가 = 영업기준원가 ÷ (1 − 매출이익율%) + YD당 정액 (화면 통화 기준)
  const sellFrom = (cost, sheet, tierKey) => {
    const base = cost?.[tierKey]?.[viewMode]?.finalCostYd || 0;
    const rate = Number(sheet.quoteMarginRate) || 0;
    const add = Number(sheet.quoteMarginAdd) || 0;
    return smartRound(applyGrossMargin(base, rate) + add, viewMode === 'export' ? 'USD' : 'KRW');
  };

  // 검색 → 판매가 계산(시트당 1회) → 정렬
  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = (tempDesignSheets || [])
      .filter(s => !q || String(s.fabricName || '').toLowerCase().includes(q) || String(s.buyerName || '').toLowerCase().includes(q))
      .map(sheet => {
        const cost = getTempDesignCost?.(sheet);
        return { sheet, p1: sellFrom(cost, sheet, 'tier1k'), p3: sellFrom(cost, sheet, 'tier3k'), p5: sellFrom(cost, sheet, 'tier5k') };
      });
    list.sort((a, b) => {
      if (sortBy === 'name') return String(a.sheet.fabricName || '').localeCompare(String(b.sheet.fabricName || ''), 'ko');
      if (sortBy === 'buyer') return String(a.sheet.buyerName || '').localeCompare(String(b.sheet.buyerName || ''), 'ko');
      if (sortBy === 'price') return (b.p3 || 0) - (a.p3 || 0);
      return (b.sheet.createdAt || '').localeCompare(a.sheet.createdAt || ''); // 생성날짜 최신순 (기본)
    });
    return list;
  }, [tempDesignSheets, searchTerm, sortBy, viewMode, getTempDesignCost]); // eslint-disable-line react-hooks/exhaustive-deps

  // 날짜 포맷
  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return '-'; }
  };

  // [C2] 가설계서 → 정식 설계서로 보내기
  // 1) 사용자 확인 → 2) 정식 설계서 폼 초기화 → 3) 모달 오픈 → 4) 가설계서 스펙 자동 채움
  const handleSendToFullSheet = (tempSheet) => {
    if (!resetSheetForm || !setIsDesignSheetModalOpen || !setSheetInput || !loadTempToSheet) return;
    if (!window.confirm(`"${tempSheet.fabricName || '가설계서'}"의 스펙을 정식 설계서로 가져와서 작성하시겠습니까?`)) return;
    resetSheetForm();
    setIsDesignSheetModalOpen(true);
    // 모달이 열린 직후 입력값 채우기 (확인은 이미 받았으므로 skipConfirm)
    setTimeout(() => loadTempToSheet(tempSheet, setSheetInput, { skipConfirm: true }), 0);
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
      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-bold">
            {searchTerm ? '검색된 가설계서가 없습니다.' : '아직 가설계서가 없습니다.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">상단의 [새 가설계서 작성] 버튼으로 레시피를 등록해보세요.</p>
        </div>
      ) : (
        <>
          {/* 데스크톱 테이블 (견적서 목록 스타일 — 구분선/폰트/사이즈 통일) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-amber-800 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" />
                가설계서 목록
                <span className="text-[11px] font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{rows.length}건</span>
              </h3>
              {/* 정렬 버튼 (기본: 생성날짜) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-700/70 mr-0.5">정렬</span>
                {[['created', '생성날짜'], ['name', '원단명'], ['buyer', '바이어'], ['price', '판매가']].map(([key, lbl]) => (
                  <button key={key} onClick={() => setSortBy(key)}
                    className={`px-2 py-1 text-[11px] font-bold rounded border transition-colors ${sortBy === key ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-amber-50'}`}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[880px] border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-bold border-b-2 border-slate-200">
                  <tr className="text-[10px] uppercase tracking-wide divide-x divide-slate-200">
                    <th className="py-2 px-3 w-[120px]">생성 날짜</th>
                    <th className="py-2 px-3">원단명</th>
                    <th className="py-2 px-3 w-[120px]">바이어명</th>
                    <th className="py-2 px-3 w-[110px] text-center">GSM / 폭</th>
                    <th className="py-2 px-3 w-[90px] text-right">1K 판매가</th>
                    <th className="py-2 px-3 w-[95px] text-right text-emerald-600">3K 판매가</th>
                    <th className="py-2 px-3 w-[90px] text-right">5K 판매가</th>
                    <th className="py-2 px-3 w-[130px] text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ sheet, p1, p3, p5 }) => {
                    const margin = Number(sheet.quoteMarginRate) || 0;
                    return (
                      <tr key={sheet.id} className="divide-x divide-slate-100 bg-white hover:bg-amber-50/30 transition-colors group">
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-xs font-mono text-slate-600">{formatDate(sheet.createdAt)}</span>
                          <div className="text-[9px] text-slate-400">{formatDate(sheet.updatedAt)} 수정</div>
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="text-[13px] font-extrabold text-slate-800">{sheet.fabricName || '(이름없음)'}</span>
                          {margin > 0 && <span className="ml-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 whitespace-nowrap">마진 {margin}%</span>}
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-600 uppercase">{sheet.buyerName || <span className="text-slate-300">-</span>}</td>
                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          <span className="text-xs font-mono font-bold text-indigo-700">{sheet.costInput?.gsm || '-'}g</span>
                          <div className="text-[9px] text-slate-400">{sheet.costInput?.widthCut || '-'}/{sheet.costInput?.widthFull || '-'}"</div>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">{quoteSym}{num(p1, viewMode)}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/40 whitespace-nowrap">{quoteSym}{num(p3, viewMode)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">{quoteSym}{num(p5, viewMode)}</td>
                        <td className="py-1.5 px-3">
                          <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleSendToFullSheet(sheet)}
                              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm"
                              title="이 가설계서의 스펙으로 정식 설계서를 작성합니다">
                              <ArrowRight className="w-3 h-3" /> 정식
                            </button>
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
          </div>

          {/* 모바일 카드 */}
          <div className="block md:hidden space-y-3">
            {rows.map(({ sheet, p1, p3, p5 }) => {
              const margin = Number(sheet.quoteMarginRate) || 0;
              return (
                <div key={sheet.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-amber-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 flex-wrap">{sheet.fabricName || '(이름없음)'}{margin > 0 && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1">마진 {margin}%</span>}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {sheet.buyerName || '-'}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(sheet.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleSendToFullSheet(sheet)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded shadow-sm"
                        title="정식 설계서로 보내기">
                        <ArrowRight className="w-3 h-3" /> 정식
                      </button>
                      <button onClick={() => { handleEditTemp(sheet); setIsTempModalOpen(true); }}
                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteTemp(sheet.id)}
                        className="p-1.5 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">{sheet.costInput?.gsm || '-'}g / {sheet.costInput?.widthCut || '-'}" / {sheet.costInput?.widthFull || '-'}"</div>
                  <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden text-center">
                    {[['1K', p1], ['3K', p3], ['5K', p5]].map(([lbl, p], i) => (
                      <div key={lbl} className={`py-1 ${i === 1 ? 'bg-emerald-50' : 'bg-white'}`}>
                        <div className="text-[9px] font-bold text-slate-400">{lbl} 판매가</div>
                        <div className={`text-xs font-mono font-black ${i === 1 ? 'text-emerald-800' : 'text-slate-600'}`}>{quoteSym}{num(p, viewMode)}</div>
                      </div>
                    ))}
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
              handleSaveSheet={handleSaveTemp}
              handleDeleteSheet={(id) => { handleDeleteTemp(id); setIsTempModalOpen(false); }}
              resetSheetForm={() => { resetTempForm(); setIsTempModalOpen(false); }}
              setStage={() => {}}
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
