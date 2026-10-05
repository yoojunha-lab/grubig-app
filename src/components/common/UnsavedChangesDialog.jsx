import React from 'react';
import { Save, LogOut, X } from 'lucide-react';
import { ModalBackdrop } from './ModalBackdrop';

// ============================================================
// '변경사항이 있습니다' 확인창 — 저장하고 나가기 / 저장 안 함 / 계속 편집 (원단 편집·견적서와 같은 모양)
//  · 다른 팝업 위에 뜨도록 z-[10010] (메인 디테일 작성 창 z-[9999] 위, 알림 z-[10050] 아래)
//  · 배경을 누르면 '계속 편집'
// ============================================================
export const UnsavedChangesDialog = ({ open, message, onSave, onDiscard, onKeepEditing }) => {
  if (!open) return null;
  return (
    <ModalBackdrop className="fixed inset-0 z-[10010] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={onKeepEditing}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-1">변경사항이 있습니다</h3>
        <p className="text-sm text-slate-500 mb-5">{message || '저장하지 않은 변경사항이 있어요. 저장할까요?'}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onSave} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> 저장하고 나가기
          </button>
          <div className="flex gap-2">
            <button onClick={onDiscard} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <LogOut className="w-4 h-4" /> 저장 안 함
            </button>
            <button onClick={onKeepEditing} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <X className="w-4 h-4" /> 계속 편집
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
};
