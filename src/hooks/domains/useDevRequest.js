import { useState } from 'react';
import { todayLocalISO } from '../../utils/helpers';
import { validateDevCostQuote } from '../../utils/devQuoteModel';
import { DEV_DROP_REASONS } from '../../constants/common';

// GRUBIG ERP - 바이어 R&D 개발 의뢰 관리 훅
// 상태: pending(대기) → analyzing(분석) → confirmed(개발투입확정, 설계서 저장 시 자동) / rejected(미진행)
//
// [원가 견적 — 대표님 요청 2026-10-06] 바이어가 개발 전에 가격부터 보는 경우 (비싸면 Drop)
//  · 의뢰 문서의 costQuote 에 예상 스펙·마진·저장 시점 판매가(snapshot)를 저장 (utils/devQuoteModel.js)
//  · 저장하면 '의뢰 접수·분석 중' 의뢰는 '대기 중'(바이어 결정 대기)으로 (대표님 결정)
//  · Drop 은 사유(dropReason)·메모(dropMemo)와 같이 — 복원하면 사유는 지움
//  · 의뢰 문서는 통째로 덮어써서 저장(setDoc)되므로, 저장할 때는 항상 기존 문서를 먼저 깔고 바꿀 값만 얹음

export const useDevRequest = (devRequests, saveDocToCloud, deleteDocFromCloud, showToast, designSheets) => {
  const [editingDevId, setEditingDevId] = useState(null);

  const getInitialDevInput = () => ({
    devOrderNo: '',            // 사용자 직접 입력 (비어있으면 추천번호 자동 적용)
    buyerName: '',
    assignee: '',
    devItem: '',
    requestDate: todayLocalISO(),
    targetSpec: {
      composition: '',
      targetPrice: '',
      feeling: '',
      analysisDeadline: '',
      sampleDeadline: '',
      otherRequests: ''
    },
    swatchNote: '',
    status: 'pending'
  });

  const [devInput, setDevInput] = useState(getInitialDevInput);

  // 개발 오더넘버 자동 채번
  const generateDevOrderNo = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `F-${year}D`;
    const existingNos = (devRequests || [])
      .map(d => d.devOrderNo || '')
      .filter(no => no.startsWith(prefix))
      .map(no => { const n = parseInt(no.replace(prefix, ''), 10); return isNaN(n) ? 0 : n; });
    const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleDevChange = (e) => {
    const { name, value } = e.target;
    setDevInput(prev => ({ ...prev, [name]: name === 'buyerName' ? String(value).toUpperCase() : value }));
  };

  const handleSpecChange = (field, value) => {
    setDevInput(prev => ({
      ...prev,
      targetSpec: { ...prev.targetSpec, [field]: value }
    }));
  };

  const resetDevForm = () => {
    setDevInput(getInitialDevInput());
    setEditingDevId(null);
  };

  // 저장 — boolean 반환 (true=성공, false=실패 → 모달 유지)
  //  서버 저장이 끝날 때까지 기다리고 성공했을 때만 폼 비우기·성공 알림 (예전엔 기다리지 않아 실패해도 지워졌음)
  const handleSaveDevRequest = async (user) => {
    if (!devInput.buyerName) {
      showToast('바이어명을 선택해주세요.', 'error');
      return false;
    }
    if (!devInput.targetSpec?.analysisDeadline) {
      showToast('분석 납기일자를 입력해주세요.', 'error');
      return false;
    }

    const now = new Date().toISOString();
    const isNew = !editingDevId;
    const existing = isNew ? null : devRequests.find(d => d.id === editingDevId);

    // 개발번호: 사용자 입력값 우선, 없으면 자동 발번
    let devOrderNo;
    if (isNew) {
      devOrderNo = devInput.devOrderNo?.trim() || generateDevOrderNo();
      // 중복 검증
      const isDuplicate = (devRequests || []).some(d => d.devOrderNo === devOrderNo);
      if (isDuplicate) {
        showToast(`개발번호 '${devOrderNo}'는 이미 사용 중입니다. 다른 번호를 입력해주세요.`, 'error');
        return false;
      }
    } else {
      devOrderNo = existing?.devOrderNo || generateDevOrderNo();
    }

    // [신규] statusEnteredAt: 신규 의뢰는 현재 status로 초기화, 기존 의뢰는 보존
    const statusEnteredAt = isNew
      ? { [devInput.status || 'pending']: now }
      : (existing?.statusEnteredAt || {});

    const itemToSave = {
      // 수정 저장은 문서를 통째로 덮어쓰므로(setDoc) 폼에 없는 값(원가 견적·Drop 사유 등)을 먼저 깔고 폼 값을 얹음
      //  (예전엔 폼 값만 저장해서, 의뢰를 수정할 때마다 다른 화면에서 붙인 값이 지워질 수 있었음)
      ...(existing || {}),
      ...devInput,
      id: editingDevId || `dev_${Date.now()}`,
      devOrderNo,
      // 단계는 목록에서 바로 바뀌는 값 — 수정 창이 열려 있는 동안 바뀌었어도 되돌리지 않게 저장된 값을 씀
      status: isNew ? (devInput.status || 'pending') : (existing?.status || devInput.status || 'pending'),
      linkedDesignSheetId: isNew ? null : (existing?.linkedDesignSheetId || null),
      statusEnteredAt,
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now
    };

    const ok = await saveDocToCloud('devRequests', itemToSave);
    if (ok === false) return false; // 저장 실패 — 입력값 그대로 (실패 알림은 saveDocToCloud)
    resetDevForm();
    showToast(isNew ? '개발 의뢰가 등록되었습니다.' : '개발 의뢰가 수정되었습니다.', 'success');
    return true;
  };

  const handleEditDevRequest = (devReq) => {
    const defaultSpec = getInitialDevInput().targetSpec;
    setDevInput({
      devOrderNo: devReq.devOrderNo || '',
      buyerName: devReq.buyerName || '',
      assignee: devReq.assignee || '',
      devItem: devReq.devItem || '',
      requestDate: devReq.requestDate || todayLocalISO(),
      targetSpec: { ...defaultSpec, ...(devReq.targetSpec || {}) },
      swatchNote: devReq.swatchNote || '',
      status: devReq.status || 'pending'
    });
    setEditingDevId(devReq.id);
  };

  // 반환값: true=삭제 완료 / false=가드 차단·취소·실패 (호출부에서 모달 닫기 판단에 사용)
  //  options.linkedQuoteCount: 이 의뢰로 만든 견적서 수 — 있으면 확인 창에 알려 줌
  const handleDeleteDevRequest = async (id, { linkedQuoteCount = 0 } = {}) => {
    const devReq = (devRequests || []).find(d => d.id === id);

    // [방어] 설계서가 연결된 의뢰는 삭제 차단 — 고아 설계서 발생 방지
    // [기획 #2 수정] dev.linkedDesignSheetId뿐 아니라 sheet.devRequestId 쪽도 검사
    //   → 롤백 후 soft-unlink 상태(dev쪽은 null이지만 sheet쪽은 id 유지)에서도 차단
    const hasActiveLinkedSheet = (designSheets || []).some(
      s => s.devRequestId === id && s.status !== 'dropped'
    );
    if (devReq?.linkedDesignSheetId || hasActiveLinkedSheet) {
      showToast('연결된 설계서가 있는 의뢰는 삭제할 수 없습니다. 설계서를 먼저 DROP/정리하거나 연결을 해제해주세요.', 'error');
      return false;
    }

    const notes = [];
    if (devReq?.costQuote) notes.push('이 의뢰의 원가 견적도 같이 지워져요.');
    if (linkedQuoteCount > 0) notes.push(`이 의뢰로 만든 견적서가 ${linkedQuoteCount}건 있어요. 견적서는 남지만, 그 품목은 [현재 원가로 다시 계산]을 할 수 없게 돼요 (단가는 그대로).`);
    const label = devReq?.devOrderNo ? ` '${devReq.devOrderNo}'` : '';
    if (!window.confirm(`정말로 이 개발 의뢰${label}를 삭제하시겠습니까? (복구할 수 없습니다)${notes.length ? `\n\n· ${notes.join('\n· ')}` : ''}`)) return false;
    // deleteDocFromCloud는 실패하면 false를 돌려주고 '삭제 실패' 알림을 띄움 (오류로 멈추지 않음)
    const ok = await deleteDocFromCloud('devRequests', id);
    if (ok === false) return false;
    showToast('삭제되었습니다.', 'success');
    return true;
  };

  // 설계서 작성 시 전달할 데이터
  //  costQuote: 원가 견적을 냈으면 그 예상 스펙을 설계서에 이어받음 (useDesignSheet.initFromDevRequest)
  const createDesignSheetFromDev = (devReq) => ({
    devOrderNo: devReq.devOrderNo,
    devRequestId: devReq.id,
    sampleDeadline: devReq.targetSpec?.sampleDeadline || '',
    costQuote: devReq.costQuote || null
  });

  // 상태 변경 (드롭다운)
  const updateDevStatus = (devReqId, newStatus) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;

    // 참고: confirmed 전환은 드롭다운에서 수동으로도 가능하고,
    // 설계서 저장 시 linkAndConfirm()을 통해 자동으로도 처리됩니다.

    // [방어] confirmed → 다른 상태로 되돌릴 때, 연결된 설계서가 있으면 경고
    if (devReq.status === 'confirmed' && devReq.linkedDesignSheetId) {
      if (!window.confirm('⚠️ 이 의뢰에는 연결된 설계서가 있습니다.\n상태를 변경하면 의뢰 쪽 연결이 해제됩니다.\n(설계서는 유지되며, 의뢰를 다시 "개발투입확정"으로 돌리면 자동 복구됩니다.)\n\n정말 계속하시겠습니까?')) {
        return;
      }
    }

    // [기획 #1 수정] 이전에는 롤백 시 sheet.devRequestId도 null로 밀었으나,
    // 그러면 아래의 자동 재연결 로직(sheet.devRequestId === devReqId 검색)이 작동 불가.
    // 이제는 sheet.devRequestId는 유지하고 dev 쪽 linkedDesignSheetId만 해제 →
    // 재확정 시 양방향 참조가 자동 복구된다. (soft-unlink)

    // [Step 4] confirmed로 전환 시: 기존에 이 의뢰를 바라보는 active 설계서가 있으면 자동 재연결
    let restoredSheetId = devReq.linkedDesignSheetId || null;
    if (newStatus === 'confirmed' && !restoredSheetId && designSheets) {
      const matchingSheet = designSheets.find(
        s => s.devRequestId === devReqId && s.status === 'active'
      );
      if (matchingSheet) {
        restoredSheetId = matchingSheet.id;
      }
    }

    // Drop(rejected)에서 다른 단계로 되돌리면(복원) Drop 사유·메모는 지움
    const { dropReason: _dropReason, dropMemo: _dropMemo, droppedBy: _droppedBy, ...withoutDrop } = devReq;
    const base = devReq.status === 'rejected' && newStatus !== 'rejected' ? withoutDrop : devReq;

    const now = new Date().toISOString();
    saveDocToCloud('devRequests', {
      ...base,
      status: newStatus,
      // confirmed → 다른 상태로 돌리면 linkedDesignSheetId도 해제
      // confirmed로 전환 시 active 설계서가 있으면 자동 복구
      linkedDesignSheetId: devReq.status === 'confirmed' && newStatus !== 'confirmed'
        ? null
        : restoredSheetId,
      // [신규] 새 status 진입 시점 누적 기록
      statusEnteredAt: { ...(devReq.statusEnteredAt || {}), [newStatus]: now },
      updatedAt: now
    });
    showToast(`상태가 변경되었습니다.`, 'success');
  };

  // Drop(미진행) — 사유와 같이 (대표님 요청 2026-10-06: 원가 견적을 보고 비싸서 Drop된 건을 따로 보려고)
  //  반환: 저장됐으면 true (사유를 안 골랐거나 저장 실패면 false — Drop 창 그대로)
  const dropDevRequest = async (devReqId, { reason, memo = '' } = {}, user) => {
    const devReq = (devRequests || []).find(d => d.id === devReqId);
    if (!devReq) { showToast('개발 의뢰를 찾지 못했어요.', 'error'); return false; }
    const found = DEV_DROP_REASONS.find(r => r.key === reason);
    if (!found) { showToast('Drop 사유를 골라 주세요.', 'error'); return false; }
    const now = new Date().toISOString();
    const ok = await saveDocToCloud('devRequests', {
      ...devReq,
      status: 'rejected',
      // confirmed(개발 확정) 의뢰를 Drop하면 의뢰 쪽 설계서 연결은 해제 (단계 변경과 같은 규칙)
      linkedDesignSheetId: devReq.status === 'confirmed' ? null : (devReq.linkedDesignSheetId || null),
      dropReason: found.key,
      dropMemo: String(memo || '').trim(),
      droppedBy: user?.email || '',
      statusEnteredAt: { ...(devReq.statusEnteredAt || {}), rejected: now },
      updatedAt: now
    });
    if (ok === false) return false;
    showToast(`Drop 처리했어요 (사유: ${found.label}). 보관함에서 볼 수 있어요.`, 'success');
    return true;
  };

  // 원가 견적 저장 (개발 의뢰 원가 견적 창)
  //  · 저장을 막는 사유(혼용률 ≠ 100% · 원사·단가 없는 칸 · 중량 없음)가 있으면 저장하지 않음 (validateDevCostQuote)
  //  · 대표님 결정: 저장하면 '의뢰 접수·분석 중' 의뢰는 '대기 중'(분석 완료, 바이어 결정 대기)으로. 개발 확정은 그대로
  //  반환: 저장한 원가 견적(costQuote) / 막힘·실패면 false — '견적서 만들기'는 이 값으로 바로 견적서를 만듦
  //   (목록의 의뢰 값은 서버에서 다시 받아올 때 바뀌므로, 저장 직후엔 아직 옛 값일 수 있음)
  const saveDevCostQuote = async (devReqId, quote, user) => {
    const devReq = (devRequests || []).find(d => d.id === devReqId);
    if (!devReq) { showToast('개발 의뢰를 찾지 못했어요. 목록을 다시 열고 해 주세요.', 'error'); return false; }
    const errors = validateDevCostQuote(quote);
    if (errors.length > 0) { showToast(errors[0], 'error'); return false; }
    const now = new Date().toISOString();
    const costQuote = { ...quote, updatedAt: now, updatedBy: user?.email || '' };
    const toHold = devReq.status === 'pending' || devReq.status === 'analyzing';
    const ok = await saveDocToCloud('devRequests', {
      ...devReq,
      costQuote,
      ...(toHold ? { status: 'hold', statusEnteredAt: { ...(devReq.statusEnteredAt || {}), hold: now } } : {}),
      updatedAt: now
    });
    if (ok === false) return false;
    showToast(toHold ? "원가 견적을 저장했어요. 의뢰 단계를 '대기 중'(바이어 결정 대기)으로 바꿨어요." : '원가 견적을 저장했어요.', 'success');
    return costQuote;
  };

  // 설계서 저장 시 자동 확정 (연결 + confirmed 전환)
  // 설계서가 저장되면 이 함수가 호출 → 의뢰를 자동 '개발투입확정'으로
  const linkAndConfirm = (devReqId, designSheetId) => {
    const devReq = devRequests.find(d => d.id === devReqId);
    if (!devReq) return;
    // 이미 확정+연결된 경우 → 중복 저장 방지 (설계서 수정 저장 시)
    if (devReq.status === 'confirmed' && devReq.linkedDesignSheetId === designSheetId) return;
    const now = new Date().toISOString();
    // [신규] confirmed 신규 진입인 경우에만 시점 기록 (이미 confirmed였으면 보존)
    const statusEnteredAt = devReq.status === 'confirmed'
      ? (devReq.statusEnteredAt || {})
      : { ...(devReq.statusEnteredAt || {}), confirmed: now };
    saveDocToCloud('devRequests', {
      ...devReq,
      linkedDesignSheetId: designSheetId,
      status: 'confirmed',
      statusEnteredAt,
      updatedAt: now
    });
  };

  return {
    devInput,
    editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, linkAndConfirm,
    dropDevRequest, saveDevCostQuote,
    getBlankDevInput: getInitialDevInput, // 저장 안 한 변경 확인용 빈 양식 (새 의뢰 기준)
  };
};
