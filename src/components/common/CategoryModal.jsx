import React, { useState } from 'react';
import { X, Settings, Edit2, Trash2, Check } from 'lucide-react';

export const CategoryModal = ({
  isOpen,
  onClose,
  categories,
  editingCategoryOld,
  setEditingCategoryOld,
  editingCategoryNew,
  setEditingCategoryNew,
  handleSaveCategoryEdit,
  handleDeleteCategory,
  handleMergeCategories,
  yarnLibrary = []
}) => {
  // 합치기 상태 (early return 위에 선언 — hooks 규칙)
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeSources, setMergeSources] = useState([]);

  if (!isOpen) return null;

  const countOf = (cat) => (yarnLibrary || []).filter(y => String(y.category || '').toUpperCase() === String(cat).toUpperCase()).length;
  const resetMerge = () => { setMergeTarget(''); setMergeSources([]); };
  const closeAll = () => { onClose(); setEditingCategoryOld(null); setEditingCategoryNew(''); resetMerge(); };
  const toggleSource = (cat) => setMergeSources(prev => prev.includes(cat) ? prev.filter(s => s !== cat) : [...prev, cat]);
  const runMerge = () => {
    if (!mergeTarget || mergeSources.length === 0) return;
    handleMergeCategories && handleMergeCategories(mergeSources, mergeTarget);
    resetMerge();
  };
  const mergeableSources = categories.filter(c => c !== mergeTarget);

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={closeAll}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" /> 원사 카테고리 관리
        </h3>
        <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg mb-4">
          ⚠️ <b>주의:</b> 기존 카테고리 이름을 수정하면 해당 카테고리를 사용 중인 <b>모든 원사의 데이터가 일괄 변경</b>됩니다.
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 p-2 border border-slate-100 rounded-lg bg-slate-50 custom-scrollbar">
          {categories.map(cat => (
            <div key={cat} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-slate-200">
              {editingCategoryOld === cat ? (
                <div className="flex w-full gap-2">
                  <input
                    type="text"
                    value={editingCategoryNew}
                    onChange={e => setEditingCategoryNew(String(e.target.value).toUpperCase())}
                    className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-blue-500 uppercase"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveCategoryEdit(cat, editingCategoryNew)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold shrink-0"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => { setEditingCategoryOld(null); setEditingCategoryNew(''); }}
                    className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs shrink-0"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-bold text-sm text-slate-700 uppercase">{cat} <span className="text-slate-400 font-normal text-xs">({countOf(cat)})</span></span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingCategoryOld(cat); setEditingCategoryNew(cat); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-bold text-slate-500 mb-2">새 카테고리 추가</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={editingCategoryOld === null ? editingCategoryNew : ''}
              onChange={e => { if (editingCategoryOld === null) setEditingCategoryNew(String(e.target.value).toUpperCase()); }}
              placeholder="새로운 카테고리 입력..."
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 ring-emerald-500 uppercase"
              onKeyDown={e => e.key === 'Enter' && handleSaveCategoryEdit(null, editingCategoryNew)}
            />
            <button
              onClick={() => handleSaveCategoryEdit(null, editingCategoryNew)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 whitespace-nowrap"
            >
              추가
            </button>
          </div>
        </div>

        {/* 카테고리 합치기 */}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Settings className="w-4 h-4 text-blue-500" /> 카테고리 합치기</p>
          <div className="bg-blue-50 text-blue-800 text-[11px] p-2.5 rounded-lg mb-3 leading-relaxed">
            여러 카테고리를 하나로 합칩니다. 선택한 카테고리의 <b>원사가 모두 대상 카테고리로 옮겨지고</b>, 합쳐진 카테고리는 목록에서 삭제됩니다.
          </div>

          <label className="text-[11px] font-bold text-slate-500 mb-1 block">① 남길 카테고리 (대상)</label>
          <select
            value={mergeTarget}
            onChange={e => { setMergeTarget(e.target.value); setMergeSources(prev => prev.filter(s => s !== e.target.value)); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-500 uppercase font-bold text-slate-700 bg-white cursor-pointer mb-3"
          >
            <option value="">대상 선택...</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat} ({countOf(cat)}개)</option>)}
          </select>

          <label className="text-[11px] font-bold text-slate-500 mb-1 block">② 합칠 카테고리 (여러 개 선택 가능)</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
            {mergeableSources.map(cat => {
              const checked = mergeSources.includes(cat);
              return (
                <label key={cat} onClick={() => toggleSource(cat)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'}`}>
                    {checked && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-xs font-bold truncate uppercase">{cat} <span className="text-slate-400 font-normal">({countOf(cat)})</span></span>
                </label>
              );
            })}
            {mergeableSources.length === 0 && <div className="col-span-2 text-center text-slate-400 text-xs py-3">합칠 카테고리가 없습니다.</div>}
          </div>

          <button
            onClick={runMerge}
            disabled={!mergeTarget || mergeSources.length === 0}
            className="w-full mt-3 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
          >
            {mergeTarget && mergeSources.length > 0 ? `${mergeSources.length}개 → '${mergeTarget}'(으)로 합치기` : '합치기'}
          </button>
        </div>
      </div>
    </div>
  );
};
