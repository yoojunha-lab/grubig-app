import React, { useState, useRef, useEffect } from 'react';
import { X, Save, LogOut } from 'lucide-react';
import { FabricListPage } from './FabricListPage';
import { CalculatorPage } from './CalculatorPage';

// ============================================================
// 원단 관리 워크스페이스 — '새 원단 등록' + '원단 리스트'를 한 메뉴로 병합
//  - 기본 : 원단 리스트(표 + 페이지네이션 20/페이지)
//  - [새 원단 등록] / 행 편집 → CalculatorPage(원단 등록/원가계산)를 팝업 모달로
//  - 저장/이동(setActiveTab 'list') 시 모달 닫힘, 편집(setActiveTab 'calculator') 시 모달 열림
//  - 편집 중 변경사항이 있으면 닫기(X/배경) · 상단 네비 이탈 모두 "저장할까요?" 확인(견적서와 동일)
// ============================================================
export const FabricWorkspacePage = (props) => {
  const { resetFabricForm, setFabricSearchTerm, setActiveTab, fabricInput, handleSaveFabric, navGuardRef } = props;
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pendingAction, setPendingAction] = useState(null); // dirty일 때 확인 후 실행할 액션(닫기/네비)

  // 변경사항(dirty) 기준 스냅샷 — 모달 열릴 때 + 폼 초기화(취소/초기화) 시 재캡처
  const baselineRef = useRef('');
  const [baselineNonce, setBaselineNonce] = useState(0);
  useEffect(() => {
    if (formOpen) baselineRef.current = JSON.stringify(fabricInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, baselineNonce]);
  const isDirty = () => JSON.stringify(fabricInput) !== baselineRef.current;

  // 검색어 바뀌면 첫 페이지로
  const handleSearchChange = (val) => { setPage(0); if (setFabricSearchTerm) setFabricSearchTerm(val); };

  // calculator/list 네비게이션을 모달 열기/닫기로 가로채기
  const modalSetActiveTab = (tab) => {
    if (tab === 'calculator') setFormOpen(true);
    else if (tab === 'list') setFormOpen(false);
    else if (setActiveTab) setActiveTab(tab);
  };

  // CalculatorPage에 넘길 초기화: 폼 리셋 후 기준 스냅샷도 갱신(취소/초기화 후 헛 "저장할까요?" 방지)
  const resetAndRebase = () => { resetFabricForm && resetFabricForm(); setBaselineNonce(n => n + 1); };

  const openNew = () => { resetFabricForm && resetFabricForm(); setFormOpen(true); };

  // 닫기 요청(X/배경): 변경사항 있으면 확인, 없으면 바로 닫기
  const requestClose = () => {
    if (isDirty()) setPendingAction(() => () => setFormOpen(false));
    else setFormOpen(false);
  };

  // 상단 네비 등 화면 밖 이탈 가드 등록 (App의 requestSetActiveTab이 통과) — 견적서와 동일
  //  dep 없음 → 매 렌더 최신 formOpen/fabricInput 클로저로 갱신, 언마운트 시 해제
  useEffect(() => {
    if (!navGuardRef) return;
    navGuardRef.current = (proceed) => {
      if (formOpen && isDirty()) setPendingAction(() => proceed);
      else proceed();
    };
    return () => { if (navGuardRef) navGuardRef.current = null; };
  });

  // 확인 모달 액션
  const guardSaveAndClose = async () => {
    // CalculatorPage 저장과 동일한 사전 검증(혼용률 100%). Article/폭 등은 handleSaveFabric이 검증.
    const totalRatio = (fabricInput.yarns || []).reduce((sum, y) => sum + (Number(y.ratio) || 0), 0);
    if (totalRatio !== 100) {
      alert(`[입력 오류] 원사 혼용률의 합계가 100%가 아닙니다.\n현재 합계: ${totalRatio}%\n\n정확한 단가 산출을 위해 원사 비율을 조정해 주세요.`);
      setPendingAction(null); // 폼으로 돌아가 비율 수정
      return;
    }
    const act = pendingAction;
    setPendingAction(null);
    const ok = await handleSaveFabric(modalSetActiveTab); // 성공 시 setActiveTab('list')로 모달 닫힘
    if (ok !== false) { act && act(); } // 저장 성공 시에만 대기 액션(닫기/네비) 실행 → 실패 시 폼 유지(데이터 보존)
  };
  const guardDiscard = () => {
    const act = pendingAction;
    setPendingAction(null);
    resetFabricForm && resetFabricForm();
    setFormOpen(false);
    act && act();
  };
  const guardKeepEditing = () => setPendingAction(null);

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
          onClick={requestClose}
        >
          <div className="w-full max-w-5xl my-2 md:my-6 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={requestClose}
              title="닫기"
              className="absolute right-1 -top-1 md:-right-3 md:-top-3 z-20 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-slate-700 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-slate-50 rounded-2xl shadow-2xl p-3 md:p-5 border border-slate-200">
              <CalculatorPage {...props} setActiveTab={modalSetActiveTab} resetFabricForm={resetAndRebase} />
            </div>
          </div>
        </div>
      )}

      {/* 변경사항 확인 모달 */}
      {pendingAction && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={guardKeepEditing}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-1">변경사항이 있습니다</h3>
            <p className="text-sm text-slate-500 mb-5">수정한 원단에 저장하지 않은 변경사항이 있어요. 저장할까요?</p>
            <div className="flex flex-col gap-2">
              <button onClick={guardSaveAndClose} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> 저장하고 나가기
              </button>
              <div className="flex gap-2">
                <button onClick={guardDiscard} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
                  <LogOut className="w-4 h-4" /> 저장 안 함
                </button>
                <button onClick={guardKeepEditing} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5">
                  <X className="w-4 h-4" /> 계속 편집
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
