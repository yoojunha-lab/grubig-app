import React from 'react';
import { Search, X, Database, Upload, ChevronUp, ChevronDown, Edit2, Trash2, Factory, TrendingUp, DollarSign, Info, Filter } from 'lucide-react';
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
  setActiveTab,
  yarnLibrary
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
            <tr className="text-xs uppercase tracking-wider text-slate-500 bg-slate-100/50">
              <th className="font-bold p-2 text-center border-r border-slate-200 w-10"><Filter className="w-4 h-4 mx-auto" /></th>
              <th className="font-bold p-2 text-left border-r border-slate-200 w-1/5 min-w-[180px]">Article & Info</th>
              <th className="font-bold p-2 text-left border-r border-slate-200 min-w-[140px]">Spec</th>
              <th className="font-bold p-2 text-left border-r border-slate-200 min-w-[220px]">사용 원사 (Yarn Mix)</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">편직비 & LOSS</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">염가공 & LOSS</th>
              <th className="font-bold p-2 text-center border-r border-slate-200">Margin(%)</th>
              <th colSpan="3" className="font-bold p-2 text-center border-r border-slate-200 text-slate-500 bg-slate-50">CONV (도매 단가)</th>
              <th className="font-bold p-2 text-center w-12"></th>
            </tr>
            <tr className="text-[10px] text-center bg-slate-50/50">
              <th className="p-1 border-b border-r border-slate-200" colSpan="7"></th>
              <th className="p-1 border-b border-r border-slate-200 text-slate-500">1k</th>
              <th className="p-1 border-b border-r border-slate-200 font-bold text-slate-600 bg-slate-100/50">3k</th>
              <th className="p-1 border-b border-r border-slate-200 text-slate-500">5k</th>
              <th className="p-1 border-b"></th>
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
                    <td className="p-3 border-r border-slate-50 max-w-[250px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <b className="truncate text-sm">{f.article}</b>
                        {f.yarns && f.yarns.some(y => String(y.yarnId).startsWith('UNREGISTERED_')) && (
                          <span title="미등록 원사 포함 (임시 데이터)" className="cursor-help cursor-help-icon text-amber-500 shrink-0">⚠️</span>
                        )}
                        {/* Phase 7: 스펙 오류 및 혼용률 100% 검증 경고 추가 */}
                        {Number(f.widthCut) > Number(f.widthFull) && (
                          <span title="오류: 내폭이 외폭보다 큽니다" className="cursor-help cursor-help-icon text-red-500 shrink-0">🚨</span>
                        )}
                        {f.yarns && f.yarns.reduce((acc, y) => acc + (Number(y.ratio) || 0), 0) !== 100 && (
                          <span title={`오류: 혼용률 합계가 100%가 아닙니다`} className="cursor-help cursor-help-icon text-rose-500 shrink-0">❗️</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{f.itemName}</div>
                    </td>
                    {/* [NEW] Spec 항목 - 사용 원사 컬럼 텍스트(파란색) 테마 디자인으로 통일 및 G/YD 분리 */}
                    <td className="p-2 border-r border-slate-50 align-middle">
                      <div className="flex flex-col gap-1 w-full text-[11px]">
                        <span className="text-blue-900 leading-tight flex justify-between">
                          <span className="font-medium">폭 (Cut/Full)</span>
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{f.widthCut}/{f.widthFull}"</span>
                        </span>
                        <span className="text-blue-900 leading-tight flex justify-between">
                          <span className="font-medium">GSM</span>
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{f.gsm}</span>
                        </span>
                        <span className="text-blue-900 leading-tight flex justify-between">
                          <span className="font-medium">생산 G/YD</span>
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded">{Math.round(f.costGYd) || '-'}</span>
                        </span>
                        <span className="text-blue-900 leading-tight flex justify-between" title="GSM 기준 면적 환산 실제 중량(g/yd)">
                          <span className="font-medium">실제 G/YD</span>
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{Math.round(Number(f.gsm) * Number(f.widthCut) * 0.00064516 * 36)}</span>
                        </span>
                      </div>
                    </td>

                    {/* [NEW] 사용 원사 및 비율 (Yarn Mix) - 심플 텍스트 스타일 */}
                    <td className="p-2 border-r border-slate-50 align-middle">
                      <div className="flex flex-col gap-1 w-full text-[11px]">
                        {(f.yarns || []).filter(y => y.yarnId && y.ratio > 0).map((y, idx) => {
                          const realYarnId = String(y.yarnId).split('::')[0];
                          const realYarn = yarnLibrary.find(yl => String(yl.id) === String(realYarnId));
                          const yarnName = realYarn?.name || '미등록 원사';
                          return (
                            <span key={idx} className="text-blue-900 leading-tight">
                              <span className="font-medium mr-1.5">{yarnName}</span>
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded">{y.ratio}%</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* [NEW] 편직비 & LOSS (가로 2줄 펼침 형태) */}
                    <td className="p-2 border-r border-slate-50 text-[11px] font-mono align-middle min-w-[200px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500 font-bold text-[10px] w-10">편직비</span>
                          <div className="flex gap-2.5 text-right">
                            <span className="text-slate-500"><span className="text-[9px] text-slate-400 mr-0.5">1k</span>{num(f.knittingFee1k)}</span>
                            <span className="text-blue-600 font-bold"><span className="text-[9px] text-blue-400 mr-0.5">3k</span>{num(f.knittingFee3k)}</span>
                            <span className="text-slate-500"><span className="text-[9px] text-slate-400 mr-0.5">5k</span>{num(f.knittingFee5k)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-orange-500 font-bold text-[10px] w-10">LOSS</span>
                          <div className="flex gap-2.5 text-right text-orange-600 font-bold">
                            <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">1k</span>{num(f.losses?.tier1k?.knit)}%</span>
                            <span><span className="text-[9px] font-normal mr-0.5">3k</span>{num(f.losses?.tier3k?.knit)}%</span>
                            <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">5k</span>{num(f.losses?.tier5k?.knit)}%</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* [NEW] 염가공비 & LOSS (가로 2줄 펼침 형태) */}
                    <td className="p-2 border-r border-slate-50 text-[11px] font-mono align-middle min-w-[180px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500 font-bold text-[10px]">염가공비</span>
                          <span className="text-slate-800 font-bold">￦{num(f.dyeingFee)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-orange-500 font-bold text-[10px]">염색 LOSS</span>
                          <div className="flex gap-2.5 text-right text-orange-600 font-bold">
                            <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">1k</span>{num(f.losses?.tier1k?.dye)}%</span>
                            <span><span className="text-[9px] font-normal mr-0.5">3k</span>{num(f.losses?.tier3k?.dye)}%</span>
                            <span className="opacity-70"><span className="text-[9px] font-normal mr-0.5">5k</span>{num(f.losses?.tier5k?.dye)}%</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* [NEW] Sales Policy (마진율 심플 마크) */}
                    <td className="p-2 border-r border-slate-50 text-center align-middle">
                      <span className="font-extrabold text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 inline-flex items-center justify-center">
                        {MARGIN_TIERS[f.marginTier]}%
                      </span>
                    </td>

                    {/* 기존 CONV 도매 단가 3종 */}
                    <td className="p-3 text-right font-mono text-emerald-600 text-[11px] border-r border-emerald-50 bg-emerald-50/10">{sym}{num(d1k?.priceConverter, viewMode)}</td>
                    <td className="p-4 text-right font-mono text-emerald-700 font-extrabold text-[14px] border-r border-emerald-100 bg-emerald-50/50 shadow-inner">{sym}{num(d3k?.priceConverter, viewMode)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 text-[11px] border-r border-slate-100 bg-emerald-50/10">{sym}{num(d5k?.priceConverter, viewMode)}</td>

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

                          {/* Card 1: 1야드 당 세부 원가 분석 (Cost Breakdown / YD) */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="flex items-center gap-1"><Factory className="w-4 h-4 text-slate-400" /> 세부 원가 분석 (1YD 기준)</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${viewMode === 'domestic' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>{viewMode === 'domestic' ? '내수(￦)' : '수출($)'}</span>
                            </h4>
                            <div className="space-y-2 text-xs text-slate-600 flex-1">
                              {/* 1k/3k/5k 헤더 */}
                              <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 border-b pb-1">
                                <div className="text-left pl-1">항목</div><div>1k</div><div className="text-blue-500 bg-blue-50/50 rounded">3k (기준)</div><div>5k</div>
                              </div>
                              {/* 원사비 */}
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <div className="text-left text-slate-500 text-[10px] font-bold">원사비</div>
                                <div>{num(c.tier1k[viewMode]?.yarnCostYd, viewMode)}</div>
                                <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.yarnCostYd, viewMode)}</div>
                                <div>{num(c.tier5k[viewMode]?.yarnCostYd, viewMode)}</div>
                              </div>
                              {/* 편직비 */}
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <div className="text-left text-slate-500 text-[10px] font-bold">편직비</div>
                                <div>{num(c.tier1k[viewMode]?.knitCostYd, viewMode)}</div>
                                <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.knitCostYd, viewMode)}</div>
                                <div>{num(c.tier5k[viewMode]?.knitCostYd, viewMode)}</div>
                              </div>
                              {/* 염가공비 */}
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <div className="text-left text-slate-500 text-[10px] font-bold">염가공비</div>
                                <div>{num(c.tier1k[viewMode]?.dyeCostYd, viewMode)}</div>
                                <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.dyeCostYd, viewMode)}</div>
                                <div>{num(c.tier5k[viewMode]?.dyeCostYd, viewMode)}</div>
                              </div>
                              {/* 부대비용 */}
                              <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="text-left text-slate-500 text-[10px] font-bold">부대비용</div>
                                <div>{num(c.tier1k[viewMode]?.extraFeeYd, viewMode)}</div>
                                <div className="text-blue-600 font-bold bg-blue-50/30 rounded">{num(c.tier3k[viewMode]?.extraFeeYd, viewMode)}</div>
                                <div>{num(c.tier5k[viewMode]?.extraFeeYd, viewMode)}</div>
                              </div>
                              {/* 최종 원가 요약 (TOTAL COST) */}
                              <div className="grid grid-cols-4 text-center font-mono py-2 items-center bg-slate-50 rounded mt-1">
                                <div className="text-left text-slate-700 text-[11px] font-bold pl-1">총 원가/YD</div>
                                <div className="text-slate-600 font-bold">{num(c.tier1k[viewMode]?.totalCostYd, viewMode)}</div>
                                <div className="text-blue-700 font-extrabold text-[13px]">{num(c.tier3k[viewMode]?.totalCostYd, viewMode)}</div>
                                <div className="text-slate-600 font-bold">{num(c.tier5k[viewMode]?.totalCostYd, viewMode)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Card 2: 단위별 최종 단가 테이블 (3x3 Matrix) */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md text-white flex flex-col relative overflow-hidden">
                            {/* 장식 */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                            <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between border-b border-slate-600 pb-2 relative z-10">
                              <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-emerald-400" /> 단가 요약 분석표 (Price Matrix)</span>
                            </h4>

                            <div className="space-y-1 flex-1 flex flex-col justify-center relative z-10">
                              <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-2 border-b border-slate-700 mb-1">
                                <div>오더 구간</div>
                                <div className="text-slate-300">원가 (COST)</div>
                                <div className="text-emerald-400">도매 (CONV)</div>
                                <div className="text-indigo-400">직납 (BRAND)</div>
                              </div>

                              {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
                                const d = c[tier][viewMode];
                                const label = ['1k (미니멈)', '3k (메인)', '5k (대량)'][i];
                                const is3k = tier === 'tier3k';
                                return (
                                  <div key={tier} className={`grid grid-cols-4 text-center font-mono py-2.5 rounded text-xs items-center transition-colors ${is3k ? 'bg-slate-700/80 shadow-inner' : 'hover:bg-slate-700/30'}`}>
                                    <div className={`text-[10px] ${is3k ? 'text-blue-300 font-bold' : 'text-slate-400 font-medium'}`}>{label}</div>
                                    <div className={`${is3k ? 'text-white font-bold' : 'text-slate-300'}`}>{sym}{num(d.totalCostYd, viewMode)}</div>
                                    <div className={`${is3k ? 'text-emerald-300 font-extrabold text-[14px]' : 'text-emerald-500'}`}>{sym}{num(d.priceConverter, viewMode)}</div>
                                    <div className={`${is3k ? 'text-indigo-300 font-bold text-[13px]' : 'text-indigo-500'}`}>{sym}{num(d.priceBrand, viewMode)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Card 3: 설정 및 로스 정보 & 특이사항 */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> 생산 조건 및 특이사항</h4>
                            <div className="space-y-3 text-xs text-slate-600 flex-1">

                              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-500 mb-1.5 border-b border-slate-200 pb-1">공정별 LOSS 설정 (%)</div>
                                <div className="grid grid-cols-4 text-center font-mono py-1">
                                  <div className="text-left text-[10px] text-slate-400 font-medium">편직/염색</div>
                                  <div className="text-[10px]">{num(f.losses?.tier1k?.knit)} / {num(f.losses?.tier1k?.dye)}</div>
                                  <div className="text-[11px] text-blue-600 font-bold bg-blue-50/50 rounded">{num(f.losses?.tier3k?.knit)} / {num(f.losses?.tier3k?.dye)}</div>
                                  <div className="text-[10px]">{num(f.losses?.tier5k?.knit)} / {num(f.losses?.tier5k?.dye)}</div>
                                </div>
                              </div>

                              <div className="bg-emerald-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-slate-500">지정 마진율</span><span className="font-bold text-emerald-600">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
                                <div className="text-[9px] text-slate-400 leading-tight">선택하신 도매가 마진율이 CONV 단가 책정 시 자동 계산되어 반영됩니다.</div>
                              </div>

                            </div>
                            {f.remarks && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs text-slate-700 bg-yellow-50 border border-yellow-200 p-2.5 rounded-lg leading-relaxed shadow-sm">
                                  <span className="font-bold flex items-center gap-1 mb-1 text-[10px] text-yellow-700"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>특이사항 (Remarks)</span>
                                  {f.remarks}
                                </div>
                              </div>
                            )}
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
                      <span title="미등록 원사 포함 (임시 데이터)" className="text-sm cursor-help text-amber-500">⚠️</span>
                    )}
                    {/* Phase 7: 스펙 오류 및 혼용률 검증 경고 추가 (모바일뷰) */}
                    {Number(f.widthCut) > Number(f.widthFull) && (
                      <span title="오류: 내폭이 외폭보다 큽니다" className="text-sm cursor-help text-red-500">🚨</span>
                    )}
                    {f.yarns && f.yarns.reduce((acc, y) => acc + (Number(y.ratio) || 0), 0) !== 100 && (
                      <span title={`오류: 혼용률 합계가 100%가 아닙니다`} className="text-sm cursor-help text-rose-500">❗️</span>
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

              {/* 모바일 뷰 메인 요약 영역 */}
              <div className="p-3 bg-white border-b border-slate-50 cursor-pointer" onClick={() => setExpandedFabricId(isExpanded ? null : f.id)}>
                <div className="flex flex-col gap-1.5 mb-3">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold self-start mb-0.5">사용 원사 (Yarn Mix)</span>
                  {(f.yarns || []).filter(y => y.yarnId && y.ratio > 0).map((y, idx) => {
                    const realYarnId = String(y.yarnId).split('::')[0];
                    const realYarn = yarnLibrary?.find(yl => String(yl.id) === String(realYarnId));
                    const yarnName = realYarn?.name || '미등록 원사';
                    return (
                      <div key={idx} className="flex justify-between items-center bg-blue-50/50 text-blue-900 text-[11px] px-2 py-1 rounded border border-blue-100/50">
                        <span className="truncate pr-2 font-medium tracking-tight h-full">{yarnName}</span>
                        <span className="font-extrabold shrink-0 text-blue-700">{y.ratio}%</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50/50 rounded border border-slate-100 p-2">
                    <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">편직비 & LOSS</div>
                    <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] mb-1">
                      <div className="text-slate-500">1k<br />{num(f.knittingFee1k)}</div>
                      <div className="font-bold text-blue-600 bg-blue-50 rounded">3k<br />{num(f.knittingFee3k)}</div>
                      <div className="text-slate-500">5k<br />{num(f.knittingFee5k)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] text-orange-600 font-bold border-t border-slate-100 pt-1">
                      <div className="opacity-70">{num(f.losses?.tier1k?.knit)}%</div>
                      <div className="bg-orange-100/50 rounded">{num(f.losses?.tier3k?.knit)}%</div>
                      <div className="opacity-70">{num(f.losses?.tier5k?.knit)}%</div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded border border-slate-100 p-2 flex flex-col justify-between">
                    <div>
                      <div className="text-[9px] text-slate-400 text-center border-b border-slate-100 pb-0.5 mb-1 font-bold">염가공비 & 염색 LOSS</div>
                      <div className="font-bold text-slate-800 text-[11px] text-center font-mono mb-1 py-0.5">￦{num(f.dyeingFee)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5 text-center font-mono text-[9px] text-orange-600 font-bold border-t border-slate-100 pt-1 mt-auto">
                      <div className="opacity-70">{num(f.losses?.tier1k?.dye)}%</div>
                      <div className="bg-orange-100/50 rounded">{num(f.losses?.tier3k?.dye)}%</div>
                      <div className="opacity-70">{num(f.losses?.tier5k?.dye)}%</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex flex-col justify-center items-center">
                    <div className="text-[10px] text-emerald-600/70 font-bold mb-0.5 uppercase tracking-wide">도매가 (3k)</div>
                    <div className="font-mono font-extrabold text-emerald-700 text-sm">{sym}{num(c.tier3k[viewMode]?.priceConverter, viewMode)}</div>
                  </div>
                  <div className="bg-emerald-100 rounded-lg border border-emerald-200 shadow-sm flex flex-col justify-center items-center p-2.5">
                    <div className="text-emerald-800 font-extrabold text-sm">{MARGIN_TIERS[f.marginTier]}%</div>
                    <div className="text-[10px] text-emerald-700/80 font-bold uppercase tracking-wide">Sales Margin</div>
                  </div>
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
