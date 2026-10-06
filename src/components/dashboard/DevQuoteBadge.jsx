import React from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';

/**
 * 개발 의뢰 원가 견적 배지 — 개발 의뢰 목록·Drop 창·보관함 공통 (utils/devQuoteModel.getDevQuoteBadge 결과를 그대로 받음)
 *  · '견적' = 이 의뢰로 만든 최근 견적서의 판매가 (초록) / '예상' = 원가 견적을 저장할 때의 판매가 (회색)
 *  · ⚠ (빨강) = '원가 확인 필요'(단가 0원·지운 원사 등)로 원가가 덜 잡혔을 수 있음
 *  · 최근 견적서 바이어가 의뢰 바이어와 다르면 그 바이어 이름을 끝에 붙임
 *  · 마우스를 올리면 구간별 판매가·사유
 * @param {'sm'|'md'} size  sm = 목록 줄 / md = 창 안
 */
export const DevQuoteBadge = ({ badge, size = 'sm', className = '' }) => {
  if (!badge) return null;
  const isQuote = badge.kind === 'quote';
  const warned = Array.isArray(badge.warnings) && badge.warnings.length > 0;
  const tone = warned
    ? 'bg-red-50 text-red-700 border-red-200'
    : isQuote ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200';
  const Icon = warned ? AlertTriangle : Calculator;
  return (
    <span
      title={badge.detail}
      className={`inline-flex items-center gap-1 whitespace-nowrap font-bold rounded border cursor-help px-1.5 py-0.5 ${size === 'md' ? 'text-[10px]' : 'text-[9px]'} ${tone} ${className}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {isQuote ? '견적' : '예상'} {badge.price} ({badge.qtyLabel})
      {badge.date ? ` · ${badge.date}` : ''}
      {badge.otherBuyer ? ` · ${badge.otherBuyer}` : ''}
    </span>
  );
};
