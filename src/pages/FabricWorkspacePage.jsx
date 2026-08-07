import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FabricListPage } from './FabricListPage';
import { CalculatorPage } from './CalculatorPage';

// ============================================================
// 원단 관리 워크스페이스 — '새 원단 등록' + '원단 리스트'를 한 메뉴로 병합
//  - 기본 : 원단 리스트(표 + 페이지네이션 20/페이지)
//  - [새 원단 등록] / 행 편집 → CalculatorPage(원단 등록/원가계산)를 팝업 모달로
//  - 저장/이동(setActiveTab 'list') 시 모달 닫힘, 편집(setActiveTab 'calculator') 시 모달 열림
//  견적서 워크스페이스와 동일한 패턴
// ============================================================
export const FabricWorkspacePage = (props) => {
  const { resetFabricForm, setFabricSearchTerm, setActiveTab } = props;
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(0);

  // 검색어 바뀌면 첫 페이지로 (effect 대신 핸들러에서 처리 → 불필요한 렌더 방지)
  const handleSearchChange = (val) => { setPage(0); if (setFabricSearchTerm) setFabricSearchTerm(val); };

  // calculator/list 네비게이션을 모달 열기/닫기로 가로채기
  //  (handleEditFabric은 setActiveTab('calculator'), handleSaveFabric은 setActiveTab('list') 호출)
  const modalSetActiveTab = (tab) => {
    if (tab === 'calculator') setFormOpen(true);
    else if (tab === 'list') setFormOpen(false);
    else if (setActiveTab) setActiveTab(tab);
  };

  const openNew = () => { resetFabricForm && resetFabricForm(); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  return (
    <div className="w-full print:hidden">
      <FabricListPage
        {...props}
        setActiveTab={modalSetActiveTab}
        setFabricSearchTerm={handleSearchChange}
        page={page}
        setPage={setPage}
        onNewFabric={openNew}
      />

      {/* 원단 등록/편집 팝업 (모달) */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-3 md:p-6"
          onClick={closeForm}
        >
          <div className="w-full max-w-5xl my-2 md:my-6 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={closeForm}
              title="닫기"
              className="absolute right-1 -top-1 md:-right-3 md:-top-3 z-20 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-slate-700 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-slate-50 rounded-2xl shadow-2xl p-3 md:p-5 border border-slate-200">
              <CalculatorPage {...props} setActiveTab={modalSetActiveTab} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
