import React from 'react';
import { AlertTriangle } from 'lucide-react';

// ============================================================
// '원가 확인 필요' 표시 — 원가 엔진(calculateCostTiers)이 돌려주는 costWarnings 문구를 보여줌
//  (혼용률 합계 ≠ 100% · 원사 미선택 칸 · 라이브러리에 없는 원사 · 단가 0원 원사 · 중량 0)
//  - CostWarningBadge : 원단 리스트 행 · 견적 품목 옆 작은 배지 (마우스를 올리면 사유)
//  - CostWarningBox   : 펼친 상세 · 모바일용 사유 목록 (터치 화면은 마우스 올리기가 없어서)
//  원단 등록 · 설계서의 원가 표 맨 위 빨간 안내와 같은 문구를 씀
// ============================================================

export const COST_WARNING_TITLE = '원가 확인 필요 — 이대로면 원가가 덜 잡히거나 틀릴 수 있어요';

const hasWarnings = (warnings) => Array.isArray(warnings) && warnings.length > 0;

export const CostWarningBadge = ({ warnings, className = '' }) => {
  if (!hasWarnings(warnings)) return null;
  return (
    <span
      title={`원가 확인 필요\n· ${warnings.join('\n· ')}`}
      className={`inline-flex items-center gap-0.5 shrink-0 cursor-help whitespace-nowrap text-[10px] font-extrabold leading-none text-red-700 bg-red-50 border border-red-200 px-1.5 py-1 rounded ${className}`}
    >
      <AlertTriangle className="w-3 h-3 shrink-0" /> 원가 확인
    </span>
  );
};

export const CostWarningBox = ({ warnings, className = '' }) => {
  if (!hasWarnings(warnings)) return null;
  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 ${className}`}>
      <div className="text-[11px] font-extrabold flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {COST_WARNING_TITLE}
      </div>
      <ul className="text-[11px] mt-0.5 pl-5 list-disc space-y-0.5">
        {warnings.map(w => <li key={w}>{w}</li>)}
      </ul>
    </div>
  );
};
