import React, { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { PartnerPickerModal } from './PartnerPickerModal';

// ============================================================
// 거래처 선택 필드 — 클릭하면 PartnerPickerModal 오픈, 선택 시 onSelect(partner)
//  value: 현재 선택된 상호명(문자열)
//  onSelect(partner): 선택 결과 (partner 객체 전체 전달 → 호출부에서 필요한 필드 채움)
//  견적/PI/개발/오더 등에서 공통 사용
// ============================================================
export const PartnerSelectField = ({
  value, onSelect,
  partners = [], savePartner, deletePartner, makeEmptyPartner,
  placeholder = '거래처 선택', className = '', disabled = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${className}`}
      >
        <span className={`flex items-center gap-1.5 truncate ${value ? 'text-slate-800 font-bold uppercase' : 'text-slate-400 font-medium'}`}>
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {/* open일 때만 마운트 → 열 때마다 초기 상태(목록/검색초기화)로 시작 */}
      {open && (
        <PartnerPickerModal
          onClose={() => setOpen(false)}
          partners={partners}
          onSelect={onSelect}
          savePartner={savePartner}
          deletePartner={deletePartner}
          makeEmptyPartner={makeEmptyPartner}
        />
      )}
    </>
  );
};
