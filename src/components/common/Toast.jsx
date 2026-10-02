import React from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ notification, setNotification }) => {
  // z-[10050]: 모든 팝업(원단 선택 z-[9999] · 견적 이력 z-[10000] 등)보다 위 — 팝업 안에서 한 작업의 알림도 보이게
  if (!notification.show) return null;
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[10050] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all animate-in slide-in-from-top-5 fade-in duration-300 ${notification.type === 'error' ? 'bg-red-500 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
      {notification.type === 'success' && <Check className="w-5 h-5" />}
      {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
      {notification.type === 'info' && <Info className="w-5 h-5" />}
      <span className="font-bold text-sm">{notification.message}</span>
      <button onClick={() => setNotification({ ...notification, show: false })} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
