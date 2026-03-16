import React from 'react';
import { Cloud } from 'lucide-react';

export const LoginScreen = ({ handleLogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl text-center shadow-2xl border border-slate-700">
        <div className="bg-blue-600 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-900">
          <Cloud className="text-white w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">GRUBIG Cloud</h1>
        <p className="text-slate-400 mb-8">@grubig.kr 전용 관리 시스템</p>
        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 shadow-xl">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" /> 구글 계정으로 로그인
        </button>
      </div>
    </div>
  );
};
