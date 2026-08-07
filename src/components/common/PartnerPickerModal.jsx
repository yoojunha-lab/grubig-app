import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, Pencil, Trash2, Check, ArrowLeft, Building2 } from 'lucide-react';

// ============================================================
// 거래처 선택 모달 (ezTex '고객사 선택' 스타일)
//  - 검색 + 목록(회사명·주소·전화·담당자·휴대폰) + 행 클릭 선택
//  - 모달 안에서 바로 신규 등록 / 수정 / 삭제
//  - onSelect(partner) 로 선택 결과 전달
//  견적/PI/개발/오더 등 모든 거래처 선택에서 공통 사용
// ============================================================
export const PartnerPickerModal = ({
  isOpen, onClose, partners = [], onSelect,
  savePartner, deletePartner, makeEmptyPartner,
}) => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');   // 'list' | 'form'
  const [draft, setDraft] = useState(null);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = [...(partners || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (!t) return list;
    return list.filter(p =>
      [p.name, p.address, p.tel, p.contact, p.mobile, p.bizNo, p.email]
        .some(v => String(v || '').toLowerCase().includes(t))
    );
  }, [partners, search]);

  // 열릴 때마다 목록 뷰로 초기화 (직전 등록/수정 폼 상태가 남지 않게)
  useEffect(() => {
    if (isOpen) { setView('list'); setDraft(null); setSearch(''); }
  }, [isOpen]);

  // 모든 Hook 호출 이후에 조기 반환 (Hook 순서 고정)
  if (!isOpen) return null;

  const openCreate = () => { setDraft(makeEmptyPartner()); setView('form'); };
  const openEdit = (p) => { setDraft({ ...p }); setView('form'); };
  const backToList = () => { setView('list'); setDraft(null); };

  const handleField = (e) => {
    const { name, value } = e.target;
    setDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (selectAfter) => {
    const saved = await savePartner(draft);
    if (!saved) return;               // 실패(중복/빈 상호) → 폼 유지
    if (selectAfter) { onSelect && onSelect(saved); onClose && onClose(); }
    else backToList();
  };

  const handlePick = (p) => { onSelect && onSelect(p); onClose && onClose(); };

  const F = ({ label, name, placeholder = '', required = false, className = '' }) => (
    <div className={className}>
      <label className="block text-[11px] font-bold text-slate-500 mb-1">{label}{required && ' *'}</label>
      <input
        name={name}
        value={draft?.[name] ?? ''}
        onChange={handleField}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center p-3 md:p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-2 md:my-6" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {view === 'list' ? '거래처 선택' : (draft?.id ? '거래처 수정' : '신규 거래처 등록')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {view === 'list' ? (
          <div className="p-4">
            {/* 검색 + 신규 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="회사명·담당자·주소·전화 검색"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button onClick={openCreate} className="shrink-0 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> 신규 등록
              </button>
            </div>

            {/* 목록 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[52vh] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wide sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-bold">회사명</th>
                      <th className="py-2 px-3 font-bold">주소</th>
                      <th className="py-2 px-3 font-bold w-28">전화</th>
                      <th className="py-2 px-3 font-bold w-24">담당자</th>
                      <th className="py-2 px-3 font-bold w-28">휴대폰</th>
                      <th className="py-2 px-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-slate-400">
                        {search ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다. [신규 등록]으로 추가하세요.'}
                      </td></tr>
                    ) : filtered.map(p => (
                      <tr key={p.id} onClick={() => handlePick(p)} className="hover:bg-indigo-50/60 cursor-pointer group">
                        <td className="py-2 px-3 font-bold text-slate-800">{p.name}</td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[200px]" title={p.address}>{p.address || '-'}</td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{p.tel || '-'}</td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{p.contact || '-'}</td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{p.mobile || '-'}</td>
                        <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(p)} title="수정" className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deletePartner(p.id)} title="삭제" className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">행을 클릭하면 선택됩니다. 총 {filtered.length}개</p>
          </div>
        ) : (
          /* 등록/수정 폼 */
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <F label="회사명(상호)" name="name" required placeholder="예: (주)그루빅통상" className="col-span-2" />
              <F label="사업자등록번호" name="bizNo" placeholder="000-00-00000" />
              <F label="담당자" name="contact" placeholder="예: 홍길동 대표님" />
              <F label="전화" name="tel" placeholder="02-000-0000" />
              <F label="휴대폰" name="mobile" placeholder="010-0000-0000" />
              <F label="이메일" name="email" placeholder="name@company.com" />
              <F label="주소" name="address" placeholder="주소" className="col-span-2" />
              <F label="메모" name="memo" placeholder="비고" className="col-span-2" />
            </div>
            <div className="flex items-center justify-between mt-5">
              <button onClick={backToList} className="text-slate-500 hover:text-slate-700 text-sm font-bold flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> 목록
              </button>
              <div className="flex gap-2">
                <button onClick={() => handleSave(false)} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50">
                  저장
                </button>
                <button onClick={() => handleSave(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> 저장하고 선택
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
