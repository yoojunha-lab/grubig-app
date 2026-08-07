import { useState } from 'react';
import { PI_DEFAULT_TERMS } from '../../constants/proformaInvoice';

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

  const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 새 품목 빈 행
  const makeEmptyItem = () => ({
    id: `piitem_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    article: '',
    description: '',
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
      buyerContact: '',
      buyerBizNo: '',                      // 내수: 매수인 사업자등록번호

      // 통지처(수출) / 납품처(내수)
      notifyCompany: isExport ? (t.notifyCompany || '') : (t.deliverToCompany || ''),
      notifyAddress: '',
      notifyTel: '',
      notifyContact: '',

      // 거래조건 (기본값 시드 — 편집 가능)
      priceTerm: t.priceTerm || '',
      paymentTerms: t.paymentTerms || '',
      leadTime: t.leadTime || '',
      partialShipment: t.partialShipment || '',
      transhipment: t.transhipment || '',
      packing: t.packing || '',
      portLoading: t.portLoading || '',
      portDischarge: t.portDischarge || '',
      finalDest: t.finalDest || '',
      transport: t.transport || '',
      hsCode: t.hsCode || '',
      insurance: t.insurance || '',
      // 내수 전용
      taxInvoice: t.taxInvoice || '',
      deliveryMethod: t.deliveryMethod || '',
      freightBearer: t.freightBearer || '',
      moq: t.moq || '',
      qtyTolerance: t.qtyTolerance || '',
      vatNote: t.vatNote || '',
      domRemark: t.domRemark || '',
      // 내수 원화계좌 (미입력 — 발행 전 채움)
      krwAccount: '',

      // 품목 + 합계 조정
      items: [makeEmptyItem()],
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

  // ── 품목 조작 ──────────────────────────────────────────────
  const addPIItem = () => {
    setPIInput(prev => ({ ...prev, items: [...(prev.items || []), makeEmptyItem()] }));
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
      const newItem = { ...makeEmptyItem(), article, description, unit };
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
    generatePINo, handleNewPI,
    addPIItem, removePIItem, handleItemChange, addItemFromFabric,
    handleSavePI, handleEditPI, handleDuplicatePI, handleDeletePI,
  };
};
