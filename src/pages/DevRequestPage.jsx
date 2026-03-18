import React from 'react';
import { Plus, Edit2, Trash2, Check, X, Printer, Search, ChevronDown, ChevronUp, ArrowRight, FileText } from 'lucide-react';

/**
 * 바이어 R&D 개발 의뢰 관리 페이지
 * - 상태: 대기중/분석 중/확정/미진행
 * - 확정 → 설계서 연동
 * - A4 프린트 (스와치 공간 + 편직처 제출용)
 */
export const DevRequestPage = ({
  devRequests,
  devInput,
  editingDevId,
  handleDevChange,
  handleSpecChange,
  handleSaveDevRequest,
  handleEditDevRequest,
  handleDeleteDevRequest,
  resetDevForm,
  createDesignSheetFromDev,
  initFromDevRequest,
  setActiveTab,
  user,
  buyers,
  devPrintRef
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedId, setExpandedId] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [printTarget, setPrintTarget] = React.useState(null);

  const filteredRequests = (devRequests || []).filter(d => {
    const matchSearch = 
      String(d.buyerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(d.devOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // 상태 라벨 (분석 중 추가)
  const statusLabels = { pending: '대기중', analyzing: '분석 중', confirmed: '확정', rejected: '미진행' };
  const statusBadge = {
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    rejected: 'bg-red-100 text-red-700 border-red-300'
  };

  // "확정 → 설계서로" 버튼 핸들러
  const handleConfirmAndGoDesign = (devReq) => {
    const confirmData = createDesignSheetFromDev(devReq);
    initFromDevRequest(confirmData);
    setActiveTab('designSheet');
  };

  // 프린트 (스와치 편직처 제출용)
  const handlePrint = (devReq) => {
    setPrintTarget(devReq);
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-violet-200">
              <FileText className="w-5 h-5" />
            </div>
            바이어 개발 의뢰
          </h2>
          <p className="text-sm text-slate-500 mt-1">바이어 R&D 개발 요청을 접수하고 관리합니다</p>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
        <h3 className="text-sm font-extrabold text-slate-700 mb-4 flex items-center gap-2">
          {editingDevId ? <Edit2 className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4 text-emerald-500" />}
          {editingDevId ? '개발 의뢰 수정' : '새 개발 의뢰 등록'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">바이어명 *</label>
            <select name="buyerName" value={devInput.buyerName} onChange={handleDevChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 ring-violet-200 outline-none transition-all uppercase">
              <option value="">-- 바이어 선택 --</option>
              {(buyers || []).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">의뢰 일자</label>
            <input type="date" name="requestDate" value={devInput.requestDate} onChange={handleDevChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">타겟 단가</label>
            <input type="text" placeholder="예: $3.50/yd, ₩12,000/yd" value={devInput.targetSpec?.targetPrice || ''}
              onChange={(e) => handleSpecChange('targetPrice', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">납기</label>
            <input type="text" placeholder="예: 2026-06-30, ASAP" value={devInput.targetSpec?.deliveryDate || ''}
              onChange={(e) => handleSpecChange('deliveryDate', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">혼용률 / 원단 스펙</label>
            <input type="text" placeholder="예: 울 80% 나일론 20% / 250g/m², 58인치" value={devInput.targetSpec?.composition || ''}
              onChange={(e) => handleSpecChange('composition', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">원하는 터치감</label>
            <input type="text" placeholder="예: 부드럽고 드레이프감 있는" value={devInput.targetSpec?.touch || ''}
              onChange={(e) => handleSpecChange('touch', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">상태</label>
            <select name="status" value={devInput.status} onChange={handleDevChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 ring-violet-200 outline-none transition-all">
              <option value="pending">대기중</option>
              <option value="analyzing">분석 중</option>
              <option value="confirmed">확정</option>
              <option value="rejected">미진행</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">기타 요청사항</label>
            <textarea placeholder="바이어 추가 요청사항 입력..." value={devInput.targetSpec?.otherRequests || ''}
              onChange={(e) => handleSpecChange('otherRequests', e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">스와치 메모</label>
            <input type="text" placeholder="스와치 관련 메모 (예: 바이어 제공 스와치 1장 보관중)" name="swatchNote" value={devInput.swatchNote || ''} onChange={handleDevChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none transition-all" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => handleSaveDevRequest(user)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95">
            {editingDevId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingDevId ? '수정 저장' : '의뢰 등록'}
          </button>
          {editingDevId && (
            <button onClick={resetDevForm}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all">
              <X className="w-4 h-4" /> 취소
            </button>
          )}
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="바이어명 또는 개발번호 검색..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 ring-violet-200 outline-none" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          {['All', 'pending', 'analyzing', 'confirmed', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {s === 'All' ? '전체' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {filteredRequests.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-bold">등록된 개발 의뢰가 없습니다</p>
          </div>
        )}

        {filteredRequests.map(devReq => {
          const isExpanded = expandedId === devReq.id;
          return (
            <div key={devReq.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : devReq.id)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm font-mono font-extrabold text-violet-600 shrink-0">{devReq.devOrderNo}</span>
                  <span className="text-sm font-bold text-slate-800 truncate">{devReq.buyerName}</span>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge[devReq.status] || statusBadge.pending}`}>
                    {statusLabels[devReq.status] || '대기중'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-slate-400 hidden md:inline">{devReq.requestDate}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">혼용률 / 스펙</p><p className="text-sm text-slate-700">{devReq.targetSpec?.composition || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">타겟 단가</p><p className="text-sm text-slate-700">{devReq.targetSpec?.targetPrice || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">터치감</p><p className="text-sm text-slate-700">{devReq.targetSpec?.touch || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">납기</p><p className="text-sm text-slate-700">{devReq.targetSpec?.deliveryDate || '-'}</p></div>
                    {devReq.targetSpec?.otherRequests && (
                      <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">기타 요청</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{devReq.targetSpec.otherRequests}</p></div>
                    )}
                    {devReq.swatchNote && (
                      <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">스와치 메모</p><p className="text-sm text-slate-700">{devReq.swatchNote}</p></div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    <button onClick={() => handleEditDevRequest(devReq)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      <Edit2 className="w-3 h-3" /> 수정
                    </button>
                    <button onClick={() => handleDeleteDevRequest(devReq.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3 h-3" /> 삭제
                    </button>
                    <button onClick={() => handlePrint(devReq)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                      <Printer className="w-3 h-3" /> 편직처 제출용 프린트
                    </button>
                    {devReq.status !== 'rejected' && !devReq.linkedDesignSheetId && (
                      <button onClick={() => handleConfirmAndGoDesign(devReq)}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 ml-auto">
                        <ArrowRight className="w-3 h-3" /> 설계서 작성으로
                      </button>
                    )}
                    {devReq.linkedDesignSheetId && (
                      <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg ml-auto">
                        <Check className="w-3 h-3" /> 설계서 연결됨
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 편직처 제출용 프린트 영역 (화면에선 숨김, 프린트 시에만 표시) */}
      <div className="hidden print:block">
        <div ref={devPrintRef} className="w-full bg-white p-8 text-black text-sm" style={{ fontFamily: 'serif' }}>
          {printTarget && (
            <>
              <h1 className="text-xl font-bold mb-1 text-center">GRUBIG 원단 개발 의뢰서</h1>
              <p className="text-xs text-gray-500 mb-5 text-center">Development Request Sheet (편직처 제출용)</p>
              
              <div className="flex gap-6 mb-6">
                {/* 좌측: 정보 */}
                <div className="flex-1">
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      <tr className="border border-gray-300">
                        <td className="bg-gray-100 font-bold p-2 w-[30%] border border-gray-300">개발번호</td>
                        <td className="p-2 border border-gray-300 font-mono font-bold">{printTarget.devOrderNo}</td>
                      </tr>
                      <tr className="border border-gray-300">
                        <td className="bg-gray-100 font-bold p-2 border border-gray-300">의뢰일자</td>
                        <td className="p-2 border border-gray-300">{printTarget.requestDate}</td>
                      </tr>
                      <tr className="border border-gray-300">
                        <td className="bg-gray-100 font-bold p-2 border border-gray-300">혼용률/스펙</td>
                        <td className="p-2 border border-gray-300">{printTarget.targetSpec?.composition || '-'}</td>
                      </tr>
                      <tr className="border border-gray-300">
                        <td className="bg-gray-100 font-bold p-2 border border-gray-300">터치감</td>
                        <td className="p-2 border border-gray-300">{printTarget.targetSpec?.touch || '-'}</td>
                      </tr>
                      <tr className="border border-gray-300">
                        <td className="bg-gray-100 font-bold p-2 border border-gray-300">기타 요청</td>
                        <td className="p-2 border border-gray-300 whitespace-pre-wrap">{printTarget.targetSpec?.otherRequests || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* 우측: 스와치 붙일 공간 */}
                <div className="w-[90mm] shrink-0">
                  <div className="border-2 border-dashed border-gray-400 w-full h-[90mm] flex items-center justify-center">
                    <p className="text-gray-400 text-center text-xs">개발 스와치<br/>붙임 공간<br/>(9cm × 9cm)</p>
                  </div>
                  {printTarget.swatchNote && (
                    <p className="text-xs text-gray-500 mt-1 text-center">{printTarget.swatchNote}</p>
                  )}
                </div>
              </div>

              {/* 비고란 (편직처가 기록할 수 있는 공간) */}
              <div className="border border-gray-300 p-3 mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">편직처 기록란</p>
                <div className="h-24 border-t border-gray-200"></div>
              </div>

              <div className="border-t border-gray-300 pt-3 flex justify-between text-xs text-gray-400">
                <span>GRUBIG TRADING CO., LTD.</span>
                <span>인쇄일: {new Date().toLocaleDateString()}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
