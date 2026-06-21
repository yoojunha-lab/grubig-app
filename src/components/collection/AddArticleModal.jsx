import React, { useState, useMemo } from 'react';
import { X, Search, Check, Package, Plus } from 'lucide-react';

// 원단 리스트(savedFabrics)에서 아티클을 검색·다중선택해서 컬렉션에 담는 모달
//  - 이미 담긴 원단(existingFabricIds)은 비활성 + "담김" 배지 표시
//  - onConfirm(selectedFabrics): 선택된 원단 객체 배열을 부모로 전달
export const AddArticleModal = ({
  isOpen,
  onClose,
  fabrics = [],
  existingFabricIds = [],
  yarnLibrary = [],
  collectionName = '',
  onConfirm,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

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
    const term = String(searchTerm || '').toLowerCase();
    return (fabrics || []).filter(f =>
      String(f.article || '').toLowerCase().includes(term) ||
      String(f.itemName || '').toLowerCase().includes(term)
    );
  }, [fabrics, searchTerm]);

  const toggleSelect = (id) => {
    if (existingSet.has(String(id))) return; // 이미 담긴 건 선택 불가
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchTerm('');
    onClose();
  };

  const handleConfirm = () => {
    const selected = (fabrics || []).filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    onConfirm(selected);
    setSelectedIds(new Set());
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" /> 아티클 추가
            </h3>
            {collectionName && (
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-bold text-indigo-600">{collectionName}</span> 컬렉션에 담을 원단을 선택하세요.
              </p>
            )}
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Article / 아이템명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        {/* 원단 목록 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFabrics.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-500">검색 결과가 없습니다.</p>
            </div>
          )}
          {filteredFabrics.map(f => {
            const isAdded = existingSet.has(String(f.id));
            const isSelected = selectedIds.has(f.id);
            const composition = getComposition(f);
            return (
              <button
                key={f.id}
                onClick={() => toggleSelect(f.id)}
                disabled={isAdded}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isAdded
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                {/* 체크박스 */}
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>

                {/* 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 uppercase tracking-tight truncate">{f.article || '(번호없음)'}</span>
                    {isAdded && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">담김</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{f.itemName || '-'}</div>
                  {composition && (
                    <div className="text-[11px] text-indigo-600/80 font-medium truncate mt-0.5">{composition}</div>
                  )}
                </div>

                {/* 스펙 */}
                <div className="text-right shrink-0 font-mono text-[11px] text-slate-400">
                  <div>{f.widthCut}/{f.widthFull}"</div>
                  <div>{f.gsm}g</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-sm text-slate-500">
            <span className="font-bold text-indigo-600">{selectedIds.size}</span>개 선택됨
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <Plus className="w-4 h-4" /> 담기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
