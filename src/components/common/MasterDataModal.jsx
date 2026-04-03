import React, { useState } from 'react';
import { X, Trash2, Settings2 } from 'lucide-react';

export const MasterDataModal = ({
  isOpen,
  onClose,
  title,
  description,
  items = [],
  onAdd,
  onDelete,
  icon: Icon = Settings2
}) => {
  const [newItem, setNewItem] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    
    // onAdd는 Promise가 될 수 있으므로 성공 여부를 판단해 비워줌 (App.jsx 내부 로직상 true/false 반환 예상)
    // 현재 addMasterItem은 성공 시 true를 리턴함. (비동기)
    Promise.resolve(onAdd(trimmed)).then((success) => {
      if (success !== false) {
        setNewItem('');
      }
    });
  };

  const handleDelete = (item) => {
    if (window.confirm(`'${item}' 항목을 정말 삭제하시겠습니까?`)) {
      onDelete(item);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button 
          onClick={() => { onClose(); setNewItem(''); }} 
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Icon className="w-5 h-5 text-slate-500" /> {title}
        </h3>
        
        <div className="bg-indigo-50 text-indigo-800 text-xs p-3 rounded-lg mb-4 leading-relaxed">
          ℹ️ {description || '이곳에 항목을 등록해 두면 오타 없이 정확하고 빠르게 선택할 수 있습니다.'}
        </div>
        
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 p-2 border border-slate-100 rounded-lg bg-slate-50 custom-scrollbar">
          {items.length === 0 && <p className="text-xs text-slate-400 text-center py-4 font-bold">등록된 항목이 없습니다.</p>}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded shadow-sm border border-slate-200">
              <span className="font-extrabold text-sm text-slate-700 uppercase">{item}</span>
              <button 
                onClick={() => handleDelete(item)} 
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-bold text-slate-500 mb-2">새 항목 추가</p>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newItem} 
              onChange={e => setNewItem(e.target.value.toUpperCase())} 
              placeholder="등록할 새 항목 입력..." 
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500 uppercase font-bold text-slate-800 placeholder:font-normal" 
              onKeyDown={e => e.key === 'Enter' && handleAdd()} 
              autoFocus
            />
            <button 
              onClick={handleAdd} 
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all whitespace-nowrap"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
