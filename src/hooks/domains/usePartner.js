import { useEffect, useRef } from 'react';

// ============================================================
// 거래처(Partner) 로직 훅 — 상호+주소+전화+담당자+휴대폰+사업자번호
//  - Firestore 컬렉션: partners
//  - 기존 settings/general.buyers(상호명 배열)는 삭제하지 않고,
//    partners 컬렉션이 비어있을 때 최초 1회 상호명만 있는 거래처로 자동 이관(seed)
//  - 견적/PI/개발/오더 등 모든 거래처 선택에서 공통 사용
// ============================================================
export const usePartner = (partners, buyers, saveDocToCloud, saveBatchToCloud, deleteDocFromCloud, showToast, partnersLoaded) => {
  const seededRef = useRef(false);

  // ── 최초 1회 이관(seed): 기존 buyers(상호명)를 partners 컬렉션으로 이름만 등록 ──
  //  기존 settings.buyers는 그대로 보존(비파괴).
  //  경쟁 조건 방지: partners 스냅샷이 실제로 도착(partnersLoaded)한 뒤에만 판단
  //    → 두 onSnapshot(설정/partners) 도착 순서와 무관하게 partners.length가 실제 컬렉션을 반영.
  //  중복 방지: 이미 partners에 있는 상호는 제외하고 없는 이름만 등록.
  useEffect(() => {
    if (seededRef.current) return;
    if (!partnersLoaded) return;                                    // partners 스냅샷 아직 미도착 → 대기
    if (!Array.isArray(partners) || !Array.isArray(buyers)) return;
    if (buyers.length === 0) return;                                // 이관할 이름 없음
    const existing = new Set((partners || []).map(p => String(p.name || '').trim().toUpperCase()));
    const toSeed = buyers
      .map(n => String(n).trim())
      .filter(n => n && !existing.has(n.toUpperCase()));
    seededRef.current = true;                                       // 세션당 1회만 시도
    if (toSeed.length === 0) return;                               // 이미 모두 등록됨
    const now = new Date().toISOString();
    const seeded = toSeed.map((name, idx) => ({
      id: `ptn_seed_${Date.now()}_${idx}`,
      name,
      bizNo: '', address: '', tel: '', contact: '', mobile: '', email: '', memo: '',
      createdAt: now, updatedAt: now,
    }));
    saveBatchToCloud && saveBatchToCloud('partners', seeded);
  }, [partners, buyers, partnersLoaded, saveBatchToCloud]);

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
