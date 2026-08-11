import React, { useState } from 'react';
import { Plus, Save, X, Edit2 } from 'lucide-react';
import { SearchableSelect } from '../common/SearchableSelect';

/**
 * 메인 디테일 시트 작성/수정 공용 모달
 * - 메인 디테일 페이지(MainDetailPage)와 원단 설계서(DesignSheetPage)에서 동일하게 재사용
 * - 폼 상태(detailInput)·핸들러는 useMainDetail 훅에서 주입받는다 (단일 진실원)
 *
 * @param {boolean} isOpen        모달 표시 여부
 * @param {Function} onClose      닫기 콜백 (저장 성공/취소 시 호출)
 */
export const MainDetailFormModal = ({
  isOpen,
  onClose,
  detailInput,
  setDetailInput,
  editingDetailId,
  handleDetailChange,
  handleTestChange,
  addTest,
  removeTest,
  handleSaveDetail,
  resetDetailForm,
  savedFabrics,
}) => {
  const [formTab, setFormTab] = useState('greige');       // 'greige' | 'finished'
  const [keepIdentityNext, setKeepIdentityNext] = useState(false); // 저장 후 같은 Order/Article로 연속 작성

  if (!isOpen) return null;

  const cancel = () => { resetDetailForm(); onClose(); };

  const handleSave = () => {
    const ok = handleSaveDetail({ keepIdentity: keepIdentityNext });
    if (!ok) return;
    // 신규 + keepIdentity 체크 상태면 모달 유지(컬러만 다른 건 연속 등록), 그 외에는 닫기
    if (!keepIdentityNext || editingDetailId) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={cancel}>
      <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-200 relative w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={cancel} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            {editingDetailId ? <><Edit2 className="w-4 h-4 text-amber-500" /> 시트 수정 중</> : <><Plus className="w-4 h-4 text-emerald-500" /> 새 시트 작성</>}
          </h3>
          <div className="flex gap-2">
            <button onClick={cancel} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded">취소</button>
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
                                <input type="text" value={test.reworkMethod || ''} onChange={e => handleTestChange(index, 'reworkMethod', e.target.value)} className="w-full bg-amber-50/30 border border-amber-200 rounded px-2 py-1.5 text-[11px] text-amber-700 placeholder-amber-300 outline-none focus:border-amber-400" placeholder="예: 텐타 180도 약하게" />
                              </div>
                            )}

                            {/* 가공지 물리 실측치 */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] text-emerald-500 mb-0.5 font-bold">가공 전폭 (")</label>
                                <input type="text" value={test.finWidthFull || ''} onChange={e => handleTestChange(index, 'finWidthFull', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="58" />
                              </div>
                              <div>
                                <label className="block text-[9px] text-emerald-500 mb-0.5 font-bold">가공 중량 (GSM)</label>
                                <input type="text" value={test.finGsm || ''} onChange={e => handleTestChange(index, 'finGsm', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="300" />
                              </div>
                            </div>

                            {/* 수축 TEST 결과 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">폭축 (W %)</label>
                                <input type="text" value={test.shrinkWidth || ''} onChange={e => handleTestChange(index, 'shrinkWidth', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="-3%" />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">장축 (L %)</label>
                                <input type="text" value={test.shrinkLength || ''} onChange={e => handleTestChange(index, 'shrinkLength', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-emerald-400 focus:bg-emerald-50" placeholder="-4%" />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">토킹 (Torque)</label>
                                <input type="text" value={test.torque || ''} onChange={e => handleTestChange(index, 'torque', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-amber-400 focus:bg-amber-50" placeholder="2" />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">수축 GSM</label>
                                <input type="text" value={test.gsm || ''} onChange={e => handleTestChange(index, 'gsm', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center outline-none focus:border-blue-400 focus:bg-blue-50" placeholder="310" />
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                              <div className="w-1/3">
                                <label className="block text-[9px] text-slate-400 mb-0.5 font-bold">결과 판정</label>
                                <select value={test.status || ''} onChange={e => handleTestChange(index, 'status', e.target.value)} className={`w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-400 text-center font-bold ${test.status === 'Pass' ? 'text-emerald-600 bg-emerald-50 border-emerald-300' : test.status === 'Fail' ? 'text-red-600 bg-red-50 border-red-300' : ''}`}>
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

          {/* 저장 후 같은 Order/Article로 한 번 더 작성 옵션 (신규 등록 모드에서만) */}
          {!editingDetailId && (
            <label className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
              <input
                type="checkbox"
                checked={keepIdentityNext}
                onChange={e => setKeepIdentityNext(e.target.checked)}
                className="w-4 h-4 accent-fuchsia-600"
              />
              <span className="text-xs font-bold text-amber-800">
                💡 저장 후 같은 <span className="text-fuchsia-700">Order / Article</span>로 한 번 더 작성 (컬러만 다른 시트 연속 등록)
              </span>
            </label>
          )}

          {/* 저장 버튼 */}
          <div className="pt-2">
            <button onClick={handleSave} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-fuchsia-600/30 active:scale-95 transition-all flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {editingDetailId ? '시트 내용 전체 저장' : (keepIdentityNext ? '저장하고 한 번 더 작성' : '디테일 시트 등록하기')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
