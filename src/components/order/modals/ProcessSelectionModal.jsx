import React, { useState, useEffect } from 'react';
import { X, Workflow, Lock, Check } from 'lucide-react';
import { PROCESS_TYPES, START_STAGE_DEACTIVATIONS } from '../../../constants/production';

// 7종 공정을 카드형 체크박스로 선택. 시작점에 의해 잠긴 공정은 disabled.
// v3: useKnitterStockYarn 폐기 (사종별 토글로 대체) — 원사 공정 잠금 로직 제거
export const ProcessSelectionModal = ({ isOpen, onClose, processes, startStage, onApply }) => {
  // 임시 선택 상태 (모달 내부)
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      const active = (processes || []).filter(p => p.isActive).map(p => p.processType);
      setSelectedKeys(new Set(active));
    }
  }, [isOpen, processes]);

  if (!isOpen) return null;

  const lockedKeys = START_STAGE_DEACTIVATIONS[startStage] || [];

  const toggle = (key) => {
    if (lockedKeys.includes(key)) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const handleApply = () => {
    onApply(Array.from(selectedKeys));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            <h3 className="text-lg font-extrabold">관리할 공정 선택</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            이 오더에서 관리할 공정을 체크해주세요. 시작 공정에 의해 비활성된 공정은 잠겨있습니다.
          </p>

          {PROCESS_TYPES
            .slice()
            .sort((a, b) => a.defaultSequence - b.defaultSequence)
            .map(meta => {
              const isLocked = lockedKeys.includes(meta.key);
              const disabled = isLocked;
              const checked = selectedKeys.has(meta.key);

              return (
                <button
                  key={meta.key}
                  onClick={() => toggle(meta.key)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    disabled
                      ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-60'
                      : checked
                        ? 'bg-teal-50 border-teal-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-teal-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    checked && !disabled ? 'bg-teal-600 border-teal-600' :
                    disabled ? 'bg-slate-200 border-slate-300' :
                    'bg-white border-slate-300'
                  }`}>
                    {disabled ? <Lock className="w-3 h-3 text-slate-500" /> :
                     checked ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${disabled ? 'text-slate-500' : 'text-slate-800'}`}>
                        {meta.defaultSequence}. {meta.label}
                      </span>
                      {isLocked && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          시작점에 의해 잠김
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {/* 푸터 */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg"
          >
            적용 ({selectedKeys.size}개 선택)
          </button>
        </div>
      </div>
    </div>
  );
};
