import { useState, useRef } from 'react';

// ============================================================
// GRUBIG ERP - Lab-Dip(랩딥 발송) 도메인 로직 훅
//  - Firestore 컬렉션: labdips
//  - 랩딥 시트 작성 → A4 PDF 출력 → "언제/어떻게 보냈는지" 발송 기록 보관
//  - 헤더: 바이어(거래처 공유) · ARTICLE · STYLE · 작성일
//  - 컬러: 컬러명 + 베이스넘버 + 낱장 수(A~) + 컬러코멘트
//         → 베이스넘버 '25S038' + 낱장수 3 이면  25S038 "A" / "B" / "C" 로 자동 전개
//  - 발송기록(PDF 미표시, 기록용): 발송일 · 발송방법 · 특이사항
// ============================================================

// 낱장 수 → 레터 배열  (3 → ['A','B','C'])
export const labdipLetters = (count) => {
  const n = Math.max(0, Math.min(26, Number(count) || 0));
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
};

// 컬러 1행 기본값 (id는 로컬 식별용 — Firestore 문서 id 아님)
const makeColor = () => ({
  id: `c_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
  name: '',       // 컬러명 (예: CHARCOAL)
  baseNo: '',     // 베이스넘버 (예: 25S038)
  letters: 2,     // 낱장 수 (A~B = 2)
  comment: '',    // 컬러 코멘트 (해당 컬러 스와치 위에 캡션으로 표시)
});

// 빈 Lab-Dip 기본값
const makeBlankLabdip = () => ({
  buyerName: '',                                   // 바이어 (거래처)
  article: '',                                     // ARTICLE
  style: '',                                       // STYLE
  date: new Date().toISOString().split('T')[0],    // 작성일 (헤더 DATE)
  sentDate: '',                                    // 발송일 (기록용)
  sentMethod: '',                                  // 발송 방법 (기록용)
  remarks: '',                                     // 특이사항 (기록용)
  colors: [makeColor()],
});

export const useLabdip = (labdips, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  const [labdipInput, setLabdipInput] = useState(makeBlankLabdip);
  const [editingLabdipId, setEditingLabdipId] = useState(null);
  const savingRef = useRef(false); // 빠른 더블클릭 중복 저장 가드

  const resetLabdipForm = () => {
    setLabdipInput(makeBlankLabdip());
    setEditingLabdipId(null);
  };

  // 헤더/발송기록 단일 필드 변경 (field, value 직접 전달)
  const handleLabdipChange = (field, value) => {
    setLabdipInput(prev => ({ ...prev, [field]: value }));
  };

  // ── 컬러 행 CRUD ──────────────────────────────────────────
  const addColor = () => {
    setLabdipInput(prev => ({ ...prev, colors: [...(prev.colors || []), makeColor()] }));
  };

  const removeColor = (colorId) => {
    setLabdipInput(prev => {
      const next = (prev.colors || []).filter(c => c.id !== colorId);
      // 최소 1행은 유지 (모두 지우면 빈 행 하나 남김)
      return { ...prev, colors: next.length ? next : [makeColor()] };
    });
  };

  const updateColor = (colorId, field, value) => {
    setLabdipInput(prev => ({
      ...prev,
      colors: (prev.colors || []).map(c => {
        if (c.id !== colorId) return c;
        // letters 는 숫자로 정규화 (1~26 클램프)
        const v = field === 'letters' ? Math.max(1, Math.min(26, Number(value) || 1)) : value;
        return { ...c, [field]: v };
      }),
    }));
  };

  // ── 저장 (성공 시 id 반환 / 실패·검증실패 시 false) ──────────
  const handleSaveLabdip = async () => {
    if (savingRef.current) return false;

    const buyerName = String(labdipInput.buyerName || '').trim();
    if (!buyerName) { showToast('바이어(거래처)를 선택해주세요.', 'error'); return false; }

    // 컬러명 또는 베이스넘버가 하나라도 있는 행만 유효 컬러로 저장 (빈 행 제거)
    const cleanColors = (labdipInput.colors || [])
      .map(c => ({
        id: c.id,
        name: String(c.name || '').trim(),
        baseNo: String(c.baseNo || '').trim(),
        letters: Math.max(1, Math.min(26, Number(c.letters) || 1)),
        comment: String(c.comment || '').trim(),
      }))
      .filter(c => c.name || c.baseNo);

    if (cleanColors.length === 0) {
      showToast('컬러를 1개 이상 입력해주세요. (컬러명 또는 넘버)', 'error');
      return false;
    }

    // 작성자 보존: 최초 저장자를 유지 (편집자가 바뀌어도 목록의 '작성자'는 원 작성자 — PI와 동일 규칙)
    const authorName = labdipInput.authorName || user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    const id = labdipInput.id || editingLabdipId || `labdip_${Date.now()}`;
    const existing = (labdips || []).find(x => String(x.id) === String(id));

    const toSave = {
      ...labdipInput,
      id,
      buyerName,
      article: String(labdipInput.article || '').trim(),
      style: String(labdipInput.style || '').trim(),
      colors: cleanColors,
      authorName,
      createdAt: existing?.createdAt || labdipInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // id/생성일 즉시 반영 → 다시 저장해도 같은 문서를 덮어써 중복 저장 방지
    setLabdipInput(prev => ({ ...prev, id, createdAt: toSave.createdAt }));
    setEditingLabdipId(id);

    savingRef.current = true;
    try {
      const ok = await saveDocToCloud('labdips', toSave);
      if (ok === false) return false;
      showToast(existing ? 'Lab-Dip 기록이 수정되었습니다.' : 'Lab-Dip 기록이 저장되었습니다.', 'success');
      return id;
    } finally {
      savingRef.current = false;
    }
  };

  const handleEditLabdip = (id) => {
    const found = (labdips || []).find(x => String(x.id) === String(id));
    if (!found) return;
    setLabdipInput({
      ...makeBlankLabdip(),
      ...found,
      // 컬러 행에 로컬 id 보강 (레거시/누락 대비)
      colors: (found.colors && found.colors.length)
        ? found.colors.map(c => ({ ...makeColor(), ...c, id: c.id || `c_${Date.now()}_${Math.floor(Math.random() * 100000)}` }))
        : [makeColor()],
    });
    setEditingLabdipId(id);
  };

  const handleDuplicateLabdip = (id, navigateCallback) => {
    const src = (labdips || []).find(x => String(x.id) === String(id));
    if (!src) return;
    const now = new Date();
    const copy = {
      ...src,
      id: `labdip_${Date.now()}`,
      date: now.toISOString().split('T')[0],
      sentDate: '',        // 복제본은 '미발송' 상태로 시작
      sentMethod: '',
      authorName: '',      // 복제본의 작성자는 (저장 시) 현재 사용자 — 원본 작성자를 물려받지 않음
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      colors: (src.colors || []).map((c, i) => ({
        ...makeColor(),
        ...c,
        id: `c_${Date.now()}_${i}`,
      })),
    };
    setLabdipInput(copy);
    setEditingLabdipId(null); // 아직 저장 전 신규 문서 (labdipInput.id 로 저장됨)
    if (navigateCallback) navigateCallback();
    showToast('Lab-Dip 기록을 복제했습니다. (미발송 상태)', 'success');
  };

  const handleDeleteLabdip = async (id) => {
    const t = (labdips || []).find(x => String(x.id) === String(id));
    const label = t?.buyerName ? `${t.buyerName} · ${t.article || ''}` : 'Lab-Dip 기록';
    if (!window.confirm(`이 Lab-Dip 발송 기록을 삭제하시겠습니까?\n(${label})`)) return;
    try {
      await deleteDocFromCloud('labdips', id);
      if (String(editingLabdipId) === String(id) || String(labdipInput.id) === String(id)) resetLabdipForm();
      showToast('Lab-Dip 기록이 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  return {
    labdipInput, setLabdipInput, editingLabdipId,
    resetLabdipForm, handleLabdipChange,
    addColor, removeColor, updateColor,
    handleSaveLabdip, handleEditLabdip, handleDuplicateLabdip, handleDeleteLabdip,
  };
};
