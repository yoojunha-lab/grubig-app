import React from 'react';
import { X, Settings, Edit2, Trash2 } from 'lucide-react';

export const CategoryModal = ({
  isOpen,
  onClose,
  categories,
  editingCategoryOld,
  setEditingCategoryOld,
  editingCategoryNew,
  setEditingCategoryNew,
  handleSaveCategoryEdit,
  handleDeleteCategory
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button 
          onClick={() => { onClose(); setEditingCategoryOld(null); setEditingCategoryNew(''); }} 
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
                  <span className="font-bold text-sm text-slate-700 uppercase">{cat}</span>
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
      </div>
    </div>
  );
};
