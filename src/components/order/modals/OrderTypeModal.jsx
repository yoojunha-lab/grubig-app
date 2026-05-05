import React from 'react';
import { X, Check, Package, Layers, Cog, Box } from 'lucide-react';
import { ORDER_TYPES, START_STAGES } from '../../../constants/production';

// 메인/샘플 × 시작점(원사/편직/가공지) = 6조합 카드 선택 모달
export const OrderTypeModal = ({ isOpen, onClose, currentType, currentStartStage, onSelect }) => {
  if (!isOpen) return null;

  const stageIcons = {
    yarn: Layers,
    knitting: Cog,
    finished_fabric: Box,
  };

  const handleSelect = (type, stage) => {
    onSelect(type, stage);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <h3 className="text-lg font-extrabold">오더 타입 선택</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-4">
            오더 타입과 시작 공정을 선택하세요. 시작 공정에 따라 이전 단계 공정들은 자동으로 비활성화됩니다.
          </p>

          {ORDER_TYPES.map(t => (
            <div key={t.key} className="mb-5 last:mb-0">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 px-1">
                {t.label}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {START_STAGES.map(s => {
                  const Icon = stageIcons[s.key] || Layers;
                  const selected = currentType === t.key && currentStartStage === s.key;
                  return (
                    <button
                      key={`${t.key}-${s.key}`}
                      onClick={() => handleSelect(t.key, s.key)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                        selected
                          ? 'bg-teal-50 border-teal-500 shadow-md'
                          : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      <Icon className={`w-6 h-6 mb-2 ${selected ? 'text-teal-600' : 'text-slate-400'}`} />
                      <div className={`text-sm font-bold mb-1 ${selected ? 'text-teal-800' : 'text-slate-800'}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        {s.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
