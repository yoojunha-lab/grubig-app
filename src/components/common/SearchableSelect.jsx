import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { num } from '../../utils/helpers';

export const SearchableSelect = ({ value, options = [], onChange, placeholder, labelKey = 'name', valueKey = 'id', size = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const selected = (options || []).find(o => String(o?.[valueKey]) === String(value));
    if (selected) setSearch(String(selected[labelKey] || ''));
    else setSearch('');
  }, [value, options, labelKey, valueKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        const selected = (options || []).find(o => String(o?.[valueKey]) === String(value));
        setSearch(selected ? String(selected[labelKey] || '') : '');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, labelKey, valueKey]);

  const filteredOptions = (options || []).filter(opt => String(opt?.[labelKey] || '').toLowerCase().includes(String(search || '').toLowerCase()));

  const isSmall = size === 'small';

  return (
    <div className={`relative flex-1 ${isSmall ? '' : ''}`} ref={wrapperRef}>
      <div className="relative">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value.toUpperCase()); setIsOpen(true); if (e.target.value === '') onChange(''); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} className={`w-full bg-white border outline-none transition-all uppercase ${isSmall ? 'border-transparent rounded py-1 pl-6 pr-5 text-[10px] text-slate-700 bg-transparent focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-500 hover:bg-slate-50' : 'border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500'}`} />
        <Search className={`absolute text-slate-400 ${isSmall ? 'w-3 h-3 left-1.5 top-1.5' : 'w-4 h-4 left-3 top-2.5'}`} />
        <button className="absolute right-1 top-1 text-slate-400 hover:text-slate-600" onClick={() => setIsOpen(!isOpen)}><ChevronDown className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} /></button>
      </div>
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button key={String(opt[valueKey])} onClick={() => { onChange(opt[valueKey]); setSearch(String(opt[labelKey])); setIsOpen(false); }} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${String(value) === String(opt[valueKey]) ? 'bg-blue-50' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-1"><span className={`font-medium ${String(value) === String(opt[valueKey]) ? 'text-blue-700' : 'text-slate-700'}`}>{String(opt[labelKey])}</span>{opt.price !== undefined && <span className="text-xs font-mono text-slate-500">{opt.currency === 'USD' ? '$' : '￦'}{num(opt.price)}</span>}</div>
              </button>
            ))
          ) : <div className="px-3 py-4 text-center text-xs text-slate-400">검색 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
};
