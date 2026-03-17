import React from 'react';
import { Search, X, Database, Upload, ChevronUp, ChevronDown, Edit2, Trash2, Factory, TrendingUp, DollarSign, Info } from 'lucide-react';
import { MARGIN_TIERS } from '../constants/common';
import { num } from '../utils/helpers';

export const FabricListPage = ({
  filteredFabrics,
  viewMode,
  fabricSearchTerm,
  setFabricSearchTerm,
  handleBackupFabrics,
  setIsBulkModalOpen,
  expandedFabricId,
  setExpandedFabricId,
  calculateCost,
  handleEditFabric,
  handleDeleteFabric,
  setActiveTab
}) => {
  return (
    <div className="max-w-[1600px] mx-auto print:hidden w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">원단 리스트 ({filteredFabrics.length})</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {viewMode === 'domestic' ? '기준: 내수(관세포함)' : '기준: 수출(관세제외)'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input type="text" placeholder="Article 검색..." value={fabricSearchTerm} onChange={(e) => setFabricSearchTerm(e.target.value.toUpperCase())} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white uppercase focus:ring-2 focus:ring-blue-500 transition-shadow" />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {fabricSearchTerm && <button onClick={() => setFabricSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto transition-shadow hover:shadow-md">
            <button onClick={handleBackupFabrics} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex transition-colors"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
            <button onClick={() => setIsBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex transition-colors"><Upload className="w-4 h-4" /> 엑셀</button>
          </div>
        </div>
      </div>

      {/* ✅ 추가된 요약 위젯 (Dashboard Metrics) - Floating Card Animation 추가 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Database className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">총 등록 원단</p><p className="text-xl font-extrabold text-slate-800">{filteredFabrics.length} <span className="text-sm font-normal text-slate-500">종</span></p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">현재 단가 모드</p><p className="text-xl font-extrabold text-slate-800">{viewMode === 'domestic' ? '내수용' : '수출용'}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-xs font-bold text-slate-500">최근 업데이트</p><p className="text-xl font-extrabold text-slate-800">최신 유지 관리</p></div>
        </div>
      </div>

      {/* 💻 데스크톱 뷰 (Table) */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto w-full relative h-[calc(100vh-250px)]">
        <table className="w-full text-sm text-left min-w-[1200px]">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th rowSpan="2" className="p-3 w-10 text-center border-r border-slate-200"></th>
              <th rowSpan="2" className="p-3 border-r border-slate-200">Article</th>
              <th rowSpan="2" className="p-3 border-r border-slate-200 text-center">Spec</th>
              <th colSpan="3" className="p-2 text-center border-b border-r border-slate-200 bg-slate-100 text-slate-600">COST (원가)</th>
              <th colSpan="3" className="p-2 text-center border-b border-r border-emerald-100 bg-emerald-50 text-emerald-700">CONV (도매)</th>
              <th colSpan="3" className="p-2 text-center border-b border-indigo-100 bg-indigo-50 text-indigo-700">BRAND (직납)</th>
              <th rowSpan="2" className="p-3 text-center border-l border-slate-200">Action</th>
            </tr>
            <tr className="text-[10px] text-center bg-slate-50/50">
              <th className="p-2 border-r border-slate-200">1k</th><th className="p-2 border-r border-slate-200 text-blue-600 font-bold">3k</th><th className="p-2 border-r border-slate-200">5k</th>
              <th className="p-2 border-r border-emerald-100">1k</th><th className="p-2 border-r border-emerald-100 text-emerald-700 font-bold">3k</th><th className="p-2 border-r border-slate-200">5k</th>
              <th className="p-2 border-r border-indigo-100">1k</th><th className="p-2 border-r border-indigo-100 text-indigo-700 font-bold">3k</th><th className="p-2">5k</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFabrics.map(f => {
              const c = calculateCost(f);
              const d1k = c.tier1k[viewMode]; const d3k = c.tier3k[viewMode]; const d5k = c.tier5k[viewMode];
              const isExpanded = expandedFabricId === f.id;
              const sym = viewMode === 'domestic' ? '￦' : '$';

              return (
                <React.Fragment key={f.id}>
                  <tr className={`group cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`} onClick={() => setExpandedFabricId(isExpanded ? null : f.id)}>
                    <td className="p-3 text-slate-400 text-center border-r border-slate-50">{isExpanded ? <ChevronUp className="w-4 h-4 mx-auto text-blue-500" /> : <ChevronDown className="w-4 h-4 mx-auto group-hover:text-blue-500 transition-colors" />}</td>
                    <td className="p-3 border-r border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <b>{f.article}</b>
                        {f.yarns && f.yarns.some(y => String(y.yarnId).startsWith('UNREGISTERED_')) && (
                          <span title="미등록 원사 포함" className="cursor-help cursor-help-icon">⚠️</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{f.itemName}</div>
                    </td>
                    <td className="p-3 text-center border-r border-slate-50">
                      <div className="flex items-center justify-center gap-1.5 font-mono text-[10px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{f.widthCut}/{f.widthFull}"</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{f.gsm}g</span>
                      </div>
                    </td>

                    <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-50">{sym}{num(d1k?.totalCostYd, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-blue-700 font-bold text-xs border-r border-slate-50 bg-blue-50/50">{sym}{num(d3k?.totalCostYd, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-100">{sym}{num(d5k?.totalCostYd, viewMode)}</td>

                    <td className="p-2 text-right font-mono text-emerald-600 text-xs border-r border-emerald-50">{sym}{num(d1k?.priceConverter, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-emerald-700 font-bold text-xs border-r border-emerald-50 bg-emerald-50/50">{sym}{num(d3k?.priceConverter, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-emerald-600 text-xs border-r border-slate-100">{sym}{num(d5k?.priceConverter, viewMode)}</td>

                    <td className="p-2 text-right font-mono text-indigo-600 text-xs border-r border-indigo-50">{sym}{num(d1k?.priceBrand, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-indigo-700 font-bold text-xs border-r border-indigo-50 bg-indigo-50/50">{sym}{num(d3k?.priceBrand, viewMode)}</td>
                    <td className="p-2 text-right font-mono text-indigo-600 text-xs border-r border-slate-50">{sym}{num(d5k?.priceBrand, viewMode)}</td>

                    <td className="p-3 text-center border-l border-slate-50 relative">
                      {/* ActionButton 미니멀리즘: 평소엔 안보이다 호버시에만 나타남 */}
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={(e) => { e.stopPropagation(); handleEditFabric(f, setActiveTab); }} className="p-1.5 hover:bg-blue-100 text-blue-500 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id); }} className="p-1.5 hover:bg-red-100 text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>

                  {/* 🎯 아코디언 메뉴 UI 카드형으로 깔끔하게 전면 개편 */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b-2 border-blue-200 shadow-inner">
                      <td colSpan="13" className="p-4 sm:p-6 cursor-default relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* 배경 장식 애니메이션 효과 */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 max-w-[1200px] w-full relative z-10">

                          {/* Card 1: 생산 정보 */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><Factory className="w-4 h-4 text-slate-400" /> 생산 단가 및 로스율</h4>
                            <div className="space-y-2 text-xs text-slate-600">
                              <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500 font-bold">염가공비</span><span className="font-mono font-bold text-slate-800">￦{num(f.dyeingFee)} / kg</span></div>
                              <div className="mt-2 grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 border-b pb-1"><div>구간</div><div>1k</div><div className="text-blue-500">3k</div><div>5k</div></div>
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50"><div className="text-left text-slate-500 text-[10px] font-bold">편직비</div><div>{num(f.knittingFee1k)}</div><div className="text-blue-600 font-bold">{num(f.knittingFee3k)}</div><div>{num(f.knittingFee5k)}</div></div>
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50"><div className="text-left text-slate-500 text-[10px] font-bold">LOSS(%)</div><div>{num(f.losses?.tier1k?.knit)}+{num(f.losses?.tier1k?.dye)}</div><div className="text-blue-600 font-bold">{num(f.losses?.tier3k?.knit)}+{num(f.losses?.tier3k?.dye)}</div><div>{num(f.losses?.tier5k?.knit)}+{num(f.losses?.tier5k?.dye)}</div></div>
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center"><div className="text-left text-slate-500 text-[10px] font-bold">부대비</div><div>{num(f.extraFee1k)}</div><div className="text-blue-600 font-bold">{num(f.extraFee3k)}</div><div>{num(f.extraFee5k)}</div></div>
                            </div>
                          </div>

                          {/* Card 2: 판매 정책 */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> 판매 정책 (마진 & 직납)</h4>
                            <div className="space-y-2 text-xs text-slate-600 flex-1">
                              <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500 font-bold">도매(Conv) 마진</span><span className="font-bold text-emerald-600">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
                              <div className="mt-3">
                                <div className="text-[10px] text-slate-500 mb-1 font-bold">직납(Brand) 추가금 (￦/YD)</div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div className="bg-indigo-50 text-indigo-700 py-1.5 rounded font-mono text-[11px]"><span className="block text-[9px] opacity-60">1k</span>+{num(f.brandExtra?.tier1k)}</div>
                                  <div className="bg-indigo-100 text-indigo-800 py-1.5 rounded font-mono text-[11px] font-bold shadow-sm"><span className="block text-[9px] opacity-60">3k</span>+{num(f.brandExtra?.tier3k)}</div>
                                  <div className="bg-indigo-50 text-indigo-700 py-1.5 rounded font-mono text-[11px]"><span className="block text-[9px] opacity-60">5k</span>+{num(f.brandExtra?.tier5k)}</div>
                                </div>
                              </div>
                            </div>
                            {f.remarks && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs text-slate-700 bg-yellow-50 border border-yellow-200 p-2 rounded-lg leading-relaxed"><span className="font-bold block mb-0.5 text-[10px] text-yellow-600">특이사항</span>{f.remarks}</div>
                              </div>
                            )}
                          </div>

                          {/* Card 3: 최종 단가 요약 */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-sm text-white">
                            <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between border-b border-slate-600 pb-2">
                              <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-blue-400" /> 단가 요약표</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${viewMode === 'domestic' ? 'bg-blue-900 text-blue-200' : 'bg-emerald-900 text-emerald-200'}`}>{viewMode === 'domestic' ? '내수(￦)' : '수출($)'}</span>
                            </h4>
                            <div className="space-y-2 mt-2">
                              <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-1 border-b border-slate-700"><div>구간</div><div>원가</div><div className="text-emerald-400">CONV</div><div className="text-indigo-400">BRAND</div></div>
                              {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
                                const d = c[tier][viewMode];
                                const label = ['1k', '3k', '5k'][i];
                                const is3k = tier === 'tier3k';
                                return (
                                  <div key={tier} className={`grid grid-cols-4 text-center font-mono py-1.5 rounded text-xs items-center ${is3k ? 'bg-slate-700 font-bold shadow-inner text-white' : 'text-slate-300'}`}>
                                    <div className="text-slate-400 text-[10px] font-bold">{label}</div>
                                    <div>{num(d.totalCostYd, viewMode)}</div>
                                    <div className="text-emerald-400">{num(d.priceConverter, viewMode)}</div>
                                    <div className="text-indigo-400">{num(d.priceBrand, viewMode)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredFabrics.length === 0 && (
              <tr>
                <td colSpan="13" className="p-16 text-center bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Search className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="text-lg font-bold text-slate-600 mb-1">검색 결과가 없거나 등록된 원단이 없습니다.</p>
                    <p className="text-sm">입력하신 조건과 일치하는 Article/ItemName이 없습니다.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 모바일 뷰 (Card) */}
      <div className="md:hidden space-y-4 pb-6">
        {filteredFabrics.map(f => {
          const c = calculateCost(f);
          const sym = viewMode === 'domestic' ? '￦' : '$';
          const isExpanded = expandedFabricId === f.id;
          
          return (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-shadow hover:shadow-md">
              <div className="p-4 border-b border-slate-100 flex justify-between items-start cursor-pointer bg-slate-50/50" onClick={() => setExpandedFabricId(isExpanded ? null : f.id)}>
                <div>
                  <div className="font-extrabold text-slate-800 text-lg uppercase tracking-tight flex items-center gap-1.5">
                    {f.article}
                    {f.yarns && f.yarns.some(y => String(y.yarnId).startsWith('UNREGISTERED_')) && (
                      <span title="미등록 원사 포함" className="text-sm">⚠️</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{f.itemName}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.widthCut}/{f.widthFull}"</span>
                    <span className="bg-slate-200/50 px-1.5 py-0.5 rounded">{f.gsm}g</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handleEditFabric(f, setActiveTab); }} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg shadow-sm active:scale-95 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg shadow-sm active:scale-95 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 mr-2 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 mr-2 mt-1" />}
                </div>
              </div>
              
              <div className="p-3 bg-white grid grid-cols-2 gap-2 text-xs border-b border-slate-50 cursor-pointer" onClick={() => setExpandedFabricId(isExpanded ? null : f.id)}>
                <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex flex-col justify-center items-center">
                  <div className="text-[10px] text-emerald-600/70 font-bold mb-0.5 uppercase tracking-wide">도매가 (3k)</div>
                  <div className="font-mono font-extrabold text-emerald-700 text-sm">{sym}{num(c.tier3k[viewMode]?.priceConverter, viewMode)}</div>
                </div>
                <div className="bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/50 flex flex-col justify-center items-center">
                  <div className="text-[10px] text-indigo-600/70 font-bold mb-0.5 uppercase tracking-wide">직납가 (3k)</div>
                  <div className="font-mono font-extrabold text-indigo-700 text-sm">{sym}{num(c.tier3k[viewMode]?.priceBrand, viewMode)}</div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 bg-slate-50/80 space-y-3">
                  <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><Factory className="w-3.5 h-3.5 text-slate-400" /> 기본 생산비 및 로스</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center"><span className="text-slate-500">염가공비</span><span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">￦{num(f.dyeingFee)}/kg</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">편직비(3k)</span><span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">￦{num(f.knittingFee3k)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">LOSS(3k)</span><span className="font-mono font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{num(f.losses?.tier3k?.knit)}% + {num(f.losses?.tier3k?.dye)}%</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <h4 className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 판매 및 마진율</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center"><span className="text-slate-500">도매 마진</span><span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">직납 추가금(3k)</span><span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">+{num(f.brandExtra?.tier3k)}/yd</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
                    <h4 className="text-[11px] font-bold text-slate-200 mb-2 flex justify-between items-center border-b border-slate-700/50 pb-2">
                      <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-blue-400" /> 구간별 단가표</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${viewMode === 'domestic' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{viewMode === 'domestic' ? '내수' : '수출'}</span>
                    </h4>
                    <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-1.5 pt-1"><div>구간</div><div>원가</div><div className="text-emerald-400">도매</div><div className="text-indigo-400">직납</div></div>
                    {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
                       const d = c[tier][viewMode];
                       const is3k = tier === 'tier3k';
                       return (
                         <div key={tier} className={`grid grid-cols-4 text-center font-mono py-1.5 items-center text-[10px] rounded ${is3k ? 'bg-slate-700 font-bold text-white shadow-inner' : 'text-slate-300'}`}>
                           <div className={is3k ? 'text-blue-300' : 'text-slate-400'}>{['1k', '3k', '5k'][i]}</div>
                           <div>{num(d.totalCostYd)}</div>
                           <div className={is3k ? 'text-emerald-300' : 'text-emerald-400'}>{num(d.priceConverter)}</div>
                           <div className={is3k ? 'text-indigo-300' : 'text-indigo-400'}>{num(d.priceBrand)}</div>
                         </div>
                       )
                    })}
                  </div>
                  {f.remarks && (
                    <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 p-2.5 rounded-lg leading-relaxed shadow-sm">
                      <span className="font-bold flex items-center gap-1 mb-1 text-[10px] text-yellow-600 uppercase tracking-wider"><Info className="w-3 h-3" /> Note</span>
                      {f.remarks}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filteredFabrics.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-sm">
             <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-sm font-extrabold text-slate-700 mb-1">등록된 원단이 없습니다.</p>
             <p className="text-[11px] text-slate-400">검색 조건을 변경하거나 새 원단을 등록해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
