import React, { useState } from 'react';
import { X, RotateCcw, Trash2, Archive, Search, History, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileSheetCard } from './MobileSheetCard';
import { FIELD_LABELS } from './constants';

export const DropSheetModal = ({
  isOpen,
  onClose,
  droppedSheets,
  restoreFromDrop,
  handleDeleteSheet,
  getCompositionText
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  
  if (!isOpen) return null;

  const filteredSheets = (droppedSheets || []).filter(s => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return String(s.eztexOrderNo || '').toLowerCase().includes(q) ||
           String(s.devOrderNo || '').toLowerCase().includes(q) ||
           String(s.fabricName || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* 백그라운드 오버레이 */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* 모달 창 */}
      <div className="relative w-full max-w-3xl bg-slate-50 rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-100 text-red-600 rounded-lg">
               <Archive className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">DROP 보관함</h2>
               <p className="text-[11px] text-slate-500 flex items-center gap-2">
                 총 <span className="font-bold text-red-600">{droppedSheets?.length || 0}</span>건 보관 중
               </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 검색창 */}
        <div className="p-4 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="EZ-TEX O/D NO., 개발번호, 원단명 검색..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 transition-shadow"
            />
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {filteredSheets.length === 0 ? (
            <div className="text-center py-12">
               <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-sm font-bold text-slate-500">기록이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 content-start">
              {filteredSheets.map(sheet => (
                <MobileSheetCard
                  key={sheet.id}
                  sheet={sheet}
                  isExpanded={expandedId === sheet.id}
                  onToggle={() => setExpandedId(expandedId === sheet.id ? null : sheet.id)}
                  getCompositionText={getCompositionText}
                  isDropped={true}
                  restoreFromDrop={restoreFromDrop}
                  handleDeleteSheet={handleDeleteSheet}
                  history={sheet.changeHistory || []}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
