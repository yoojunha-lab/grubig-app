import { useEffect, useRef } from 'react';

// ============================================================
// 거래처(Partner) 로직 훅 — 상호+주소+전화+담당자+휴대폰+사업자번호
//  - Firestore 컬렉션: partners
//  - 기존 settings/general.buyers(상호명 배열)는 삭제하지 않고,
//    partners 컬렉션이 비어있을 때 최초 1회 상호명만 있는 거래처로 자동 이관(seed)
//  - 견적/PI/개발/오더 등 모든 거래처 선택에서 공통 사용
// ============================================================
export const usePartner = (partners, buyers, saveDocToCloud, saveBatchToCloud, deleteDocFromCloud, showToast) => {
  const seededRef = useRef(false);

  // ── 최초 1회 이관(seed): partners가 비어있고 기존 buyers(상호명)가 있으면 이름만 등록 ──
  //  기존 settings.buyers는 그대로 보존(비파괴). DEV 우회 등 buyers 없으면 아무 것도 안 함.
  useEffect(() => {
    if (seededRef.current) return;
    if (!Array.isArray(partners) || !Array.isArray(buyers)) return;
    if (partners.length > 0) { seededRef.current = true; return; } // 이미 거래처 있으면 이관 불필요
    if (buyers.length === 0) return;                                // 이관할 이름 없음
    seededRef.current = true;
    const now = new Date().toISOString();
    const seeded = buyers.map((name, idx) => ({
      id: `ptn_seed_${Date.now()}_${idx}`,
      name: String(name).trim(),
      bizNo: '', address: '', tel: '', contact: '', mobile: '', email: '', memo: '',
      createdAt: now, updatedAt: now,
    })).filter(p => p.name);
    if (seeded.length === 0) return;
    // 일괄 저장 (실패해도 조용히 — 다음 로드에서 재시도되진 않지만 수동 등록 가능)
    saveBatchToCloud && saveBatchToCloud('partners', seeded);
  }, [partners, buyers, saveBatchToCloud]);

  // 빈 거래처 폼 기본값
  const makeEmptyPartner = () => ({
    id: '', name: '', bizNo: '', address: '', tel: '', contact: '', mobile: '', email: '', memo: '',
  });

  // 등록/수정 (id 있으면 수정). 성공 시 저장된 객체 반환, 실패 시 null
  const savePartner = async (data) => {
    const name = String(data.name || '').trim();
    if (!name) { showToast('상호(회사명)를 입력해주세요.', 'error'); return null; }
    // 상호 중복 방지 (자기 자신 제외)
    const dup = (partners || []).find(p =>
      String(p.name || '').trim().toUpperCase() === name.toUpperCase() && p.id !== data.id
    );
    if (dup) { showToast(`이미 등록된 상호입니다: ${name}`, 'error'); return null; }

    const id = data.id || `ptn_${Date.now()}`;
    const existing = (partners || []).find(p => p.id === id);
    const toSave = {
      ...makeEmptyPartner(),
      ...(existing || {}),
      ...data,
      id,
      name,
      updatedAt: new Date().toISOString(),
      createdAt: (existing && existing.createdAt) || data.createdAt || new Date().toISOString(),
    };
    const ok = await saveDocToCloud('partners', toSave);
    if (ok === false) return null;
    showToast(data.id ? '거래처가 수정되었습니다.' : `거래처 '${name}' 등록 완료`, 'success');
    return toSave;
  };

  const deletePartner = async (id) => {
    const p = (partners || []).find(x => x.id === id);
    if (!window.confirm(`'${p?.name || '거래처'}'를 삭제하시겠습니까?\n(이미 작성된 견적/PI 기록은 유지됩니다)`)) return;
    try {
      await deleteDocFromCloud('partners', id);
      showToast('거래처가 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  return { makeEmptyPartner, savePartner, deletePartner };
};
