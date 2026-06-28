import React, { useState, useMemo } from 'react';
import { X, Search, Package, LogIn, CheckCircle2 } from 'lucide-react';

// 견적서 "단일 검색 추가"용 원단 선택 팝업
//  - 원단 리스트(fabrics)를 표 형태로 보여주고, 검색창으로 Art/No·원단명 필터
//  - 각 행의 "원단추가" 버튼으로 즉시 추가(모달은 닫히지 않음 → 연속 추가 가능)
//  - 이미 견적에 담긴 원단(existingFabricIds)은 "추가됨" 으로 비활성 표시
//  - onPick(fabricId): 부모(견적서)에서 실제 추가 처리(중복차단·토스트 포함)
export const FabricPickerModal = ({
  isOpen,
  onClose,
  fabrics = [],
  existingFabricIds = [],
  yarnLibrary = [],
  onPick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const existingSet = useMemo(
    () => new Set((existingFabricIds || []).map(id => String(id))),
    [existingFabricIds]
  );

  // 원사 조성 문자열 (예: "CM 30S 60% / WOOL 40%")
  const getComposition = (fabric) => {
    return (fabric?.yarns || [])
      .filter(y => y.yarnId && Number(y.ratio) > 0)
      .map(y => {
        const realYarnId = String(y.yarnId).split('::')[0];
        const realYarn = (yarnLibrary || []).find(yl => String(yl.id) === String(realYarnId));
        const name = realYarn?.name || y.tempName || '미등록';
        return `${name} ${y.ratio}%`;
      })
      .join(' / ');
  };

  const filteredFabrics = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase().trim();
    if (!term) return fabrics || [];
    return (fabrics || []).filter(f =>
      String(f.article || '').toLowerCase().includes(term) ||
      String(f.itemName || '').toLowerCase().includes(term)
    );
  }, [fabrics, searchTerm]);

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  if (!isOpen) return null;

  const addedCount = (fabrics || []).filter(f => existingSet.has(String(f.id))).length;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[88vh]">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" /> 원단 선택
            </h3>
            <p className="text-xs text-slate-500 mt-1">견적서에 추가할 원단을 검색해서 <span className="font-bold text-indigo-600">원단추가</span> 버튼을 누르세요. (여러 개 연속 추가 가능)</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-sm font-bold border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            <X className="w-4 h-4" /> 닫기
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Art/No · 원단명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        {/* 원단 목록 (표) */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left min-w-[760px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-3 w-28">Art/No</th>
                <th className="p-3">원단명</th>
                <th className="p-3">조성</th>
                <th className="p-3 text-center w-16">내폭</th>
                <th className="p-3 text-center w-16">외폭</th>
                <th className="p-3 text-right w-16">GSM</th>
                <th className="p-3 text-center w-28">원단추가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFabrics.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-16 text-slate-400">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">검색 결과가 없습니다.</p>
                  </td>
                </tr>
              )}
              {filteredFabrics.map(f => {
                const isAdded = existingSet.has(String(f.id));
                const composition = getComposition(f);
                return (
                  <tr key={f.id} className={`transition-colors ${isAdded ? 'bg-slate-50/60' : 'hover:bg-indigo-50/40'}`}>
                    <td className="p-3 font-extrabold text-slate-800 uppercase tracking-tight">{f.article || '(번호없음)'}</td>
                    <td className="p-3 text-slate-600 truncate max-w-[200px]" title={f.itemName || ''}>{f.itemName || '-'}</td>
                    <td className="p-3 text-indigo-600/80 font-medium text-xs truncate max-w-[180px]" title={composition}>{composition || '-'}</td>
                    <td className="p-3 text-center text-slate-500 font-mono text-xs">{f.widthCut || '-'}"</td>
                    <td className="p-3 text-center text-slate-500 font-mono text-xs">{f.widthFull || '-'}"</td>
                    <td className="p-3 text-right text-slate-500 font-mono text-xs">{f.gsm || '-'}</td>
                    <td className="p-3 text-center">
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 추가됨
                        </span>
                      ) : (
                        <button
                          onClick={() => onPick(f.id)}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2.5 py-1 rounded-lg transition-colors active:scale-95"
                        >
                          <LogIn className="w-3.5 h-3.5" /> 원단추가
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-sm text-slate-500">
            총 <span className="font-bold text-slate-700">{filteredFabrics.length}</span>건
            {addedCount > 0 && <> · 견적 담김 <span className="font-bold text-emerald-600">{addedCount}</span>건</>}
          </span>
          <button
            onClick={handleClose}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors active:scale-95"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
};
