import React from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ notification, setNotification }) => {
  if (!notification.show) return null;
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all animate-in slide-in-from-top-5 fade-in duration-300 ${notification.type === 'error' ? 'bg-red-500 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
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
