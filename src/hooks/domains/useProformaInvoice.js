import { useState, useRef } from 'react';
import { PI_DEFAULT_TERMS } from '../../constants/proformaInvoice';

// 품목 임시 id 생성용 (모듈 로드 시 1회 세션값 + 증가 카운터 → render 중 Date.now/Math.random 호출 회피)
const PI_ITEM_SESSION = Date.now().toString(36);
let piItemSeq = 0;

// ============================================================
// PI(수출용 Proforma Invoice) / 거래확인서(내수) 로직 훅
//  - Firestore 컬렉션: proformaInvoices
//  - 문서번호 연도별 자동 채번(GB-PI-YYYY-###) + 저장 시 중복 검사
//  - 수출/내수(marketType) 문서마다 선택 → 통화·거래조건 기본값 자동 전환
//  - 품목(items)은 원단 리스트에서 불러오거나 수동 행추가 (게이지 칸 없음)
//  useCollection / useQuotation 패턴을 그대로 따름
// ============================================================
export const useProformaInvoice = (proformaInvoices, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  const [editingPIId, setEditingPIId] = useState(null);
  const savingRef = useRef(false); // 저장 in-flight 가드 (빠른 더블클릭 중복 저장 방지)

  const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 새 품목 빈 행
  const makeEmptyItem = () => ({
    id: `piitem_${PI_ITEM_SESSION}_${piItemSeq++}`,
    article: '',
    description: '',
    hsCode: '',          // HS Code (품목별) — 요구사항: 품목 옆에 표기
    color: '',
    qty: '',
    unit: 'YDS',
    unitPrice: '',
  });

  const getInitialPIInput = (marketType = 'export') => {
    const isExport = marketType === 'export';
    const t = isExport ? PI_DEFAULT_TERMS.export : PI_DEFAULT_TERMS.domestic;
    return {
      piNo: '',
      marketType,                          // 'export' | 'domestic'
      currency: isExport ? 'USD' : 'KRW',
      date: today(),
      validUntil: '',
      buyerPoNo: '',

      // 매수인 (공급받는 자 / consignee)
      buyerCompany: '',
      buyerAddress: '',
      buyerTel: '',
      buyerContact: '',                    // 담당자 / Contact person
      buyerEmail: '',                      // 이메일(수출) / 연락처(내수) — Contact와 분리된 별도 칸
      buyerBizNo: '',                      // 내수: 매수인 사업자등록번호

      // 통지처(수출) / 납품처(내수)
      notifyCompany: isExport ? (t.notifyCompany || '') : (t.deliverToCompany || ''),
      notifyAddress: '',
      notifyTel: '',
      notifyContact: '',

      // 거래조건 (기본값 시드 — 편집 가능)
      //  · HS Code는 문서가 아닌 "품목별" 필드 → items 시드에서 t.hsCode 사용
      //  · 물류 필드(분할선적/환적/포장/양륙항/운송방법/보험)와 내수 MOQ·원화계좌는 화면에서 제거됨 → 더 이상 저장하지 않음
      //    (구 문서의 값은 handleEditPI 의 ...pi 스프레드로 보존되므로 데이터 손실 없음)
      priceTerm: t.priceTerm || '',
      paymentTerms: t.paymentTerms || '',
      leadTime: t.leadTime || '',
      portLoading: t.portLoading || '',
      finalDest: t.finalDest || '',
      qtyTolerance: t.qtyTolerance || '',    // 수량 허용오차 (수출·내수 공통)
      // 내수 전용
      taxInvoice: t.taxInvoice || '',
      deliveryMethod: t.deliveryMethod || '',
      freightBearer: t.freightBearer || '',
      vatNote: t.vatNote || '',

      // 품목 + 합계 조정 (첫 행 HS Code는 기본값으로 시드)
      items: [{ ...makeEmptyItem(), hsCode: t.hsCode || '' }],
      freightAmt: '',                      // 운반비/FREIGHT
      insuranceAmt: '',                    // 보험료 (수출만)
      discountAmt: '',                     // 할인/DISCOUNT

      remarks: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const [piInput, setPIInput] = useState(getInitialPIInput('export'));

  const resetPIForm = () => {
    setPIInput(getInitialPIInput('export'));
    setEditingPIId(null);
  };

  const handlePIChange = (e) => {
    const { name, value } = e.target;
    setPIInput(prev => ({ ...prev, [name]: value }));
  };

  // 수출/내수 전환 — 통화 + 언어별 거래조건 기본값 재시드 (이미 입력한 매수인/품목은 보존)
  const setMarketType = (marketType) => {
    setPIInput(prev => {
      const seed = getInitialPIInput(marketType);
      return {
        ...seed,
        // 사용자가 이미 입력한 값은 보존
        piNo: prev.piNo,
        date: prev.date,
        validUntil: prev.validUntil,
        buyerPoNo: prev.buyerPoNo,
        buyerCompany: prev.buyerCompany,
        buyerAddress: prev.buyerAddress,
        buyerTel: prev.buyerTel,
        buyerContact: prev.buyerContact,
        buyerEmail: prev.buyerEmail,
        buyerBizNo: prev.buyerBizNo,
        notifyAddress: prev.notifyAddress,
        notifyTel: prev.notifyTel,
        notifyContact: prev.notifyContact,
        items: prev.items,
        freightAmt: prev.freightAmt,
        insuranceAmt: prev.insuranceAmt,
        discountAmt: prev.discountAmt,
        remarks: prev.remarks,
        createdAt: prev.createdAt,
      };
    });
  };

  // ── 문서번호 자동 채번 (연도별 최대 시퀀스 + 1) ──────────────
  const generatePINo = (dateStr) => {
    const year = String(dateStr || today()).slice(0, 4);
    const prefix = `GB-PI-${year}-`;
    let maxSeq = 0;
    (proformaInvoices || []).forEach(pi => {
      const no = String(pi.piNo || '');
      if (no.startsWith(prefix)) {
        const seq = parseInt(no.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  };

  // 새 PI 시작 (자동 채번된 번호로)
  const handleNewPI = (marketType = 'export') => {
    const fresh = getInitialPIInput(marketType);
    fresh.piNo = generatePINo(fresh.date);
    setPIInput(fresh);
    setEditingPIId(null);
  };

  // 문서번호만 다시 채번 — 작성 중인 나머지 입력값은 그대로 유지
  //  (기존에는 이 자리에 handleNewPI가 연결되어 있어 🔄 클릭 시 폼 전체가 초기화되는 사고가 있었음)
  const handleRegeneratePINo = () => {
    setPIInput(prev => ({ ...prev, piNo: generatePINo(prev.date) }));
  };

  // ── 품목 조작 ──────────────────────────────────────────────
  // 새 행의 HS Code는 직전 품목 값을 상속(대개 같은 HS) — 없으면 빈칸
  const addPIItem = () => {
    setPIInput(prev => {
      const lastHs = (prev.items || []).slice(-1)[0]?.hsCode || '';
      return { ...prev, items: [...(prev.items || []), { ...makeEmptyItem(), hsCode: lastHs }] };
    });
  };

  const removePIItem = (itemId) => {
    setPIInput(prev => ({ ...prev, items: (prev.items || []).filter(it => it.id !== itemId) }));
  };

  const handleItemChange = (itemId, field, value) => {
    setPIInput(prev => ({
      ...prev,
      items: (prev.items || []).map(it => it.id === itemId ? { ...it, [field]: value } : it),
    }));
  };

  // 원단에서 불러오기 — 자동완성된 품목 1건 추가 (품번·Description 채움, 단가는 직접 입력)
  const addItemFromFabric = ({ article, description, unit = 'YDS' }) => {
    setPIInput(prev => {
      const items = prev.items || [];
      // 첫 행이 완전히 비어있으면 그 행을 채우고, 아니면 새 행 추가
      const firstEmptyIdx = items.findIndex(it =>
        !String(it.article).trim() && !String(it.description).trim() &&
        !String(it.color).trim() && !String(it.qty).trim() && !String(it.unitPrice).trim()
      );
      const lastHs = items.slice(-1)[0]?.hsCode || '';
      const newItem = { ...makeEmptyItem(), article, description, unit, hsCode: lastHs };
      if (firstEmptyIdx >= 0) {
        const copy = [...items];
        copy[firstEmptyIdx] = { ...copy[firstEmptyIdx], article, description, unit };
        return { ...prev, items: copy };
      }
      return { ...prev, items: [...items, newItem] };
    });
  };

  // ── 저장 (중복 문서번호 검사) ───────────────────────────────
  const handleSavePI = async () => {
    if (savingRef.current) return false; // 저장 진행 중이면 무시 (빠른 더블클릭 중복 방지)
    const piNo = String(piInput.piNo || '').trim();
    if (!piNo) { showToast('문서번호를 입력하거나 자동 채번해주세요.', 'error'); return false; }
    if (!String(piInput.buyerCompany || '').trim()) { showToast('매수인(바이어) 상호를 입력해주세요.', 'error'); return false; }

    const validItems = (piInput.items || []).filter(it =>
      String(it.article).trim() || String(it.description).trim() || Number(it.qty) > 0
    );
    if (validItems.length === 0) { showToast('품목을 최소 1개 이상 입력해주세요.', 'error'); return false; }

    // 중복 문서번호 검사 (자기 자신 제외)
    const dup = (proformaInvoices || []).find(pi =>
      String(pi.piNo || '').trim().toUpperCase() === piNo.toUpperCase() && pi.id !== editingPIId
    );
    if (dup) {
      showToast(`문서번호 '${piNo}'가 이미 존재합니다. 다른 번호를 사용해주세요.`, 'error');
      return false;
    }

    savingRef.current = true; // 검증 통과 → 저장 시작 (가드 잠금)
    try {
      const idToSave = editingPIId || `pi_${Date.now()}`;
      const dataToSave = {
        ...piInput,
        id: idToSave,
        piNo,
        items: validItems,
        authorName: piInput.authorName || user?.displayName || user?.email || '',
        createdAt: piInput.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ok = await saveDocToCloud('proformaInvoices', dataToSave);
      if (ok === false) return false;
      showToast(editingPIId ? '문서가 수정되었습니다.' : `새 문서(${piNo})가 저장되었습니다.`, 'success');
      setEditingPIId(idToSave);
      setPIInput(dataToSave);
      return idToSave;
    } finally {
      savingRef.current = false;
    }
  };

  const handleEditPI = (id) => {
    const pi = (proformaInvoices || []).find(p => p.id === id);
    if (!pi) return;
    setPIInput({ ...getInitialPIInput(pi.marketType || 'export'), ...pi, items: (pi.items && pi.items.length) ? pi.items : [makeEmptyItem()] });
    setEditingPIId(id);
  };

  // 복제 (새 문서번호로)
  const handleDuplicatePI = (id) => {
    const pi = (proformaInvoices || []).find(p => p.id === id);
    if (!pi) return;
    const copy = {
      ...getInitialPIInput(pi.marketType || 'export'),
      ...pi,
      id: undefined,
      piNo: generatePINo(today()),
      date: today(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    delete copy.id;
    setPIInput(copy);
    setEditingPIId(null);
    showToast('문서를 복제했습니다. (새 번호 발급) 저장을 눌러 보관하세요.', 'info');
  };

  const handleDeletePI = async (id) => {
    const pi = (proformaInvoices || []).find(p => p.id === id);
    const label = pi?.piNo || '문서';
    if (!window.confirm(`'${label}' 문서를 삭제하시겠습니까?`)) return;
    try {
      await deleteDocFromCloud('proformaInvoices', id);
      if (editingPIId === id) resetPIForm();
      showToast('문서가 삭제되었습니다.', 'success');
    } catch {
      // deleteDocFromCloud 내부에서 이미 에러 토스트 처리됨
    }
  };

  return {
    piInput, setPIInput, editingPIId,
    getInitialPIInput,
    resetPIForm, handlePIChange, setMarketType,
    handleNewPI, handleRegeneratePINo,
    addPIItem, removePIItem, handleItemChange, addItemFromFabric,
    handleSavePI, handleEditPI, handleDuplicatePI, handleDeletePI,
  };
};
