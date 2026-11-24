import { useState } from 'react';

// GRUBIG ERP - 메인 디테일 시트 (QC 및 생산 실측 데이터) 로직 훅
//  저장·삭제·판정 바꾸기·엑셀 붙여넣기 모두 서버 저장이 끝난 뒤 성공했을 때만 '완료' 알림 (개발 고도화 2026-11-24)
//  같은 Order · Article · 컬러 · LOT 시트가 이미 있으면 한 장 저장 때도 한 번 물어봄 (엑셀 붙여넣기는 예전부터 건너뜀)

// 같은 시트인지 보는 열쇠 — Order · Article · 컬러 · LOT (대소문자·앞뒤 빈칸 무시)
const detailKey = (d) => ['orderNo', 'articleNo', 'colorInfo', 'lotNo']
  .map(k => String(d?.[k] || '').trim().toUpperCase()).join('__');

export const useMainDetail = (mainDetails, saveDocToCloud, deleteDocFromCloud, showToast, saveBatchToCloud = null) => {
  const [editingDetailId, setEditingDetailId] = useState(null);

  const getInitialMainDetailInput = () => ({
    // 식별자
    orderNo: '',
    articleNo: '',
    colorInfo: '',
    lotNo: '',
    type: 'main', // 'main' | 'sample'
    
    // 생지 정보
    greigeWidthFull: '',
    greigeGsm: '',
    greigeLoopLength: '',
    
    // 가공지 (하위 호환용, 실제 데이터는 각 test 안에서 관리)
    finWidthFull: '',
    finGsm: '',
    
    // 수축 TEST 결과 (배열 구조, 초기 1개)
    // 각 test에 가공지 실측치(finWidthFull, finGsm) 포함
    tests: [
      {
        id: `test_${Date.now()}_0`,
        finWidthFull: '',   // 가공지 전폭
        finGsm: '',         // 가공지 중량(GSM)
        shrinkWidth: '',    // 폭축(%)
        shrinkLength: '',   // 장축(%)
        torque: '',         // 토킹(%)
        gsm: '',            // 수축 QC당시 중량(GSM)
        status: '',         // 'Pass' | 'Fail'
        reworkMethod: ''    // 2차부터 재가공방법
      }
    ],
    remarks: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [detailInput, setDetailInput] = useState(getInitialMainDetailInput());

  const resetDetailForm = () => {
    setDetailInput(getInitialMainDetailInput());
    setEditingDetailId(null);
  };

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setDetailInput(prev => ({ ...prev, [name]: value }));
  };

  const handleTestChange = (index, field, value) => {
    setDetailInput(prev => {
      const newTests = [...(prev.tests || [])];
      if (!newTests[index]) return prev;
      newTests[index] = { ...newTests[index], [field]: value };
      return { ...prev, tests: newTests };
    });
  };

  const addTest = () => {
    setDetailInput(prev => {
      if ((prev.tests?.length || 0) >= 3) {
        showToast('수축 TEST는 최대 3번(Retest 2회)까지만 추가할 수 있습니다.', 'error');
        return prev;
      }
      return {
        ...prev,
        tests: [
          ...(prev.tests || []),
          {
            id: `test_${Date.now()}_${prev.tests?.length || 0}`,
            finWidthFull: '',
            finGsm: '',
            shrinkWidth: '',
            shrinkLength: '',
            torque: '',
            gsm: '',
            status: '',
            reworkMethod: ''
          }
        ]
      };
    });
  };

  const removeTest = (index) => {
    setDetailInput(prev => {
      if ((prev.tests?.length || 0) <= 1) {
        showToast('최소 1개의 기록은 유지해야 합니다.', 'error');
        return prev;
      }
      const newTests = [...(prev.tests || [])];
      newTests.splice(index, 1);
      return { ...prev, tests: newTests };
    });
  };

  // [BULK-A] options.keepIdentity: 저장 후 폼을 완전 초기화하지 않고
  //   Order/Article/Type만 유지 → 같은 시트에 컬러만 다른 건을 연속 등록
  //  서버 저장이 끝날 때까지 기다리고 성공했을 때만 폼 비우기·성공 알림 (예전엔 기다리지 않아 실패해도 지워졌음)
  const handleSaveDetail = async (options = {}) => {
    if (detailInput.type === 'main' && !detailInput.articleNo?.trim()) {
      showToast('메인(Main) 시트는 Article 번호를 필수로 입력해야 합니다.', 'error');
      return false;
    }
    if (detailInput.type === 'sample' && !detailInput.articleNo?.trim() && !detailInput.orderNo?.trim()) {
      showToast('샘플(Sample) 시트는 Article 번호나 Order No 중 하나는 필수로 입력해야 합니다.', 'error');
      return false;
    }

    // 같은 Order · Article · 컬러 · LOT 시트가 이미 있으면 한 번 확인 (실수로 두 장이 되는 것 방지)
    const key = detailKey(detailInput);
    const twin = (mainDetails || []).find(d => String(d.id) !== String(editingDetailId || '') && detailKey(d) === key);
    if (twin) {
      const label = [twin.orderNo, twin.articleNo, twin.colorInfo, twin.lotNo && `LOT ${twin.lotNo}`].filter(Boolean).join(' / ');
      if (!window.confirm(`같은 Order · Article · 컬러 · LOT 시트가 이미 있어요.\n(${label})\n\n그래도 한 장 더 저장할까요?`)) return false;
    }

    const idToSave = editingDetailId || `md_${Date.now()}`;
    // 최상위 finWidthFull/finGsm은 1차 test에서 동기화 (하위 호환 + 리스트 테이블용)
    const firstTest = detailInput.tests?.[0];
    const dataToSave = {
      ...detailInput,
      id: idToSave,
      finWidthFull: firstTest?.finWidthFull || detailInput.finWidthFull || '',
      finGsm: firstTest?.finGsm || detailInput.finGsm || '',
      createdAt: detailInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ok = await saveDocToCloud('mainDetails', dataToSave);
    if (ok === false) return false; // 저장 실패 — 입력값 그대로 (실패 알림은 saveDocToCloud)
    showToast(editingDetailId ? '메인 디테일 시트 수정 완료' : '메인 디테일 시트 등록 완료', 'success');

    if (options.keepIdentity && !editingDetailId) {
      // 신규 등록일 때만 동작: Order/Article/Type만 유지, 나머지 초기화
      setDetailInput(prev => {
        const fresh = getInitialMainDetailInput();
        return {
          ...fresh,
          orderNo: prev.orderNo || '',
          articleNo: prev.articleNo || '',
          type: prev.type || 'main'
        };
      });
      setEditingDetailId(null);
    } else {
      resetDetailForm();
    }
    return true;
  };

  const handleEditDetail = (id) => {
    const detail = mainDetails?.find(d => d.id === id);
    if (!detail) return;

    // 하위 호환: 구버전 데이터는 test 안에 finWidthFull/finGsm이 없음
    // → 최상위 값으로 1차 test 보정
    const migratedTests = (detail.tests || []).map((t, i) => ({
      finWidthFull: '',
      finGsm: '',
      reworkMethod: '',
      ...t,
      // 1차 test에 finWidthFull/finGsm이 빈값이면 최상위에서 가져옴
      ...(i === 0 && !t.finWidthFull && detail.finWidthFull ? { finWidthFull: detail.finWidthFull } : {}),
      ...(i === 0 && !t.finGsm && detail.finGsm ? { finGsm: detail.finGsm } : {})
    }));

    setDetailInput({ ...detail, tests: migratedTests });
    setEditingDetailId(id);
  };

  // 삭제 — deleteDocFromCloud 가 true 일 때만 '삭제되었습니다' (실패면 deleteDocFromCloud 가 실패 알림, 예전엔 실패해도 성공이라고 나왔음)
  const handleDeleteDetail = async (id) => {
    if (!window.confirm('정말 이 시트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return false;
    const ok = await deleteDocFromCloud('mainDetails', id);
    if (!ok) return false;
    if (editingDetailId === id) resetDetailForm();
    showToast('삭제되었습니다.', 'success');
    return true;
  };

  // 목록의 Pass/Fail 바로 바꾸기 — 저장이 끝나고 성공했을 때만 '변경되었습니다' (예전엔 저장을 안 기다렸음)
  const handleQuickStatusChange = async (detailId, testIndex, newStatus) => {
    const detail = mainDetails?.find(d => d.id === detailId);
    if (!detail || !detail.tests || !detail.tests[testIndex]) return false;

    const updatedTests = [...detail.tests];
    updatedTests[testIndex] = { ...updatedTests[testIndex], status: newStatus };

    const updatedDetail = {
      ...detail,
      tests: updatedTests,
      updatedAt: new Date().toISOString()
    };

    const ok = await saveDocToCloud('mainDetails', updatedDetail);
    if (ok === false) return false; // 실패 알림은 saveDocToCloud
    showToast(`[${detail.articleNo || 'No Article'}] 판정이 변경되었습니다.`, 'success');
    return true;
  };

  // ============================================================
  // [Grid Paste] 엑셀 복붙 일괄 업로드 로직
  // 컬럼 순서 (20개):
  // 0~3: OrderNo | ArticleNo | Color | LOT
  // 4~6: 생지폭 | 생지중량 | 루프장
  // 7~12: 1차(가공전폭 | 가공GSM | 폭축 | 장축 | 토킹 | 수축GSM)
  // 13~19: 2차(재가공방법 | 가공전폭 | 가공GSM | 폭축 | 장축 | 토킹 | 수축GSM)
  // ============================================================
  //  저장은 한 번에 묶어서 (saveBatchToCloud) — 다 저장됐을 때만 '등록 완료', 실패하면 0건 · 칸 그대로 (예전엔 저장 전에 개수를 셌음)
  const handleBulkPaste = async (rawText, bulkType = 'main') => {
    if (!rawText?.trim()) {
      showToast('붙여넣기할 데이터가 없습니다.', 'error');
      return { added: 0, skipped: 0, duplicated: 0, errors: [] };
    }

    const rows = rawText.trim().split('\n').map(r => r.split('\t').map(c => c.trim()));
    let added = 0;
    let skipped = 0;
    let duplicated = 0;
    const errors = [];

    // 기존 DB 데이터로 중복 맵 생성 (orderNo + articleNo + colorInfo + lotNo → 고유키)
    // [D1 수정] colorInfo 포함 — 같은 order/article/lot의 컬러만 다른 행을 정상 등록 가능하도록
    const existingKeys = new Set(
      (mainDetails || []).map(d => `${(d.orderNo || '').toUpperCase()}__${(d.articleNo || '').toUpperCase()}__${(d.colorInfo || '').toUpperCase()}__${(d.lotNo || '').toUpperCase()}`)
    );
    const batchKeys = new Set();
    const toSave = []; // 저장할 시트 (다 모은 뒤 한 번에)

    rows.forEach((cols, rowIdx) => {
      // 컬럼 수 체크 (최소 2개: OrderNo, ArticleNo)
      if (cols.length < 2) {
        skipped++;
        errors.push(`${rowIdx + 1}행: 컬럼 수 부족 (${cols.length}개) — 건너뜀`);
        return;
      }

      const orderNo = cols[0] || '';
      const articleNo = cols[1] || '';

      // 필수값 검증: 메인은 ArticleNo 필수, 샘플은 OrderNo 또는 ArticleNo 중 하나
      if (bulkType === 'main' && !articleNo) {
        skipped++;
        errors.push(`${rowIdx + 1}행: [Main] Article No 누락 — 건너뜀`);
        return;
      }
      if (!orderNo && !articleNo) {
        skipped++;
        errors.push(`${rowIdx + 1}행: Order No, Article No 모두 비어있음 — 건너뜀`);
        return;
      }

      const colorInfo = cols[2] || '';
      const lotNo = cols[3] || '';
      // [D1 수정] 중복 키에 colorInfo 포함 — 같은 order+article+lot 의 컬러만 다른 행도 별개로 인식
      const dupKey = `${orderNo.toUpperCase()}__${articleNo.toUpperCase()}__${colorInfo.toUpperCase()}__${lotNo.toUpperCase()}`;
      const labelForError = `${orderNo} / ${articleNo}${colorInfo ? ` / ${colorInfo}` : ''}${lotNo ? ` / LOT: ${lotNo}` : ''}`;

      if (existingKeys.has(dupKey)) {
        duplicated++;
        errors.push(`${rowIdx + 1}행: [${labelForError}] — DB에 이미 존재`);
        return;
      }
      if (batchKeys.has(dupKey)) {
        duplicated++;
        errors.push(`${rowIdx + 1}행: [${labelForError}] — 복붙 내 중복`);
        return;
      }
      batchKeys.add(dupKey);

      // mainDetails 스키마에 맞게 매핑 (20컬럼)
      // 1차 테스트 (항상 생성) — cols 7~12
      const test1 = {
        id: `test_${Date.now()}_${rowIdx}_0`,
        finWidthFull: cols[7] || '',
        finGsm: cols[8] || '',
        shrinkWidth: cols[9] || '',
        shrinkLength: cols[10] || '',
        torque: cols[11] || '',
        gsm: cols[12] || '',
        status: '',
        reworkMethod: ''
      };
      const tests = [test1];

      // 2차 테스트 (재가공) — cols 13~19: 하나라도 값 있으면 생성
      const has2nd = [cols[13], cols[14], cols[15], cols[16], cols[17], cols[18], cols[19]].some(v => v?.trim());
      if (has2nd) {
        tests.push({
          id: `test_${Date.now()}_${rowIdx}_1`,
          reworkMethod: cols[13] || '',
          finWidthFull: cols[14] || '',
          finGsm: cols[15] || '',
          shrinkWidth: cols[16] || '',
          shrinkLength: cols[17] || '',
          torque: cols[18] || '',
          gsm: cols[19] || '',
          status: ''
        });
      }

      const newDetail = {
        id: `md_${Date.now()}_${rowIdx}`,
        orderNo,
        articleNo: articleNo.toUpperCase(),
        colorInfo,
        lotNo,
        type: bulkType,
        greigeWidthFull: cols[4] || '',
        greigeGsm: cols[5] || '',
        greigeLoopLength: cols[6] || '',
        // 최상위 가공지는 1차 test에서 동기화
        finWidthFull: cols[7] || '',
        finGsm: cols[8] || '',
        tests,
        remarks: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      toSave.push(newDetail);
    });

    if (toSave.length) {
      const ok = saveBatchToCloud
        ? await saveBatchToCloud('mainDetails', toSave)
        : (await Promise.all(toSave.map(d => saveDocToCloud('mainDetails', d)))).every(r => r !== false);
      if (ok === false) {
        // 저장 실패 — 칸은 그대로 두고 다시 시도할 수 있게 (실패 알림은 saveBatchToCloud)
        errors.unshift(`저장 실패 — ${toSave.length}건이 저장되지 않았어요. 인터넷 연결을 확인하고 다시 [등록]해 주세요.`);
        return { added: 0, skipped, duplicated, errors, failed: true };
      }
      added = toSave.length;
    }

    const typeLabel = bulkType === 'main' ? 'Main' : 'Sample';
    if (added > 0) {
      showToast(`[${typeLabel}] ${added}건 일괄 등록 완료!${duplicated > 0 ? ` (중복 ${duplicated}건 건너뜀)` : ''}${skipped > 0 ? ` (오류 ${skipped}건 건너뜀)` : ''}`, 'success');
    } else if (duplicated > 0) {
      showToast(`모든 데이터가 이미 등록되어 있습니다. (중복 ${duplicated}건)`, 'error');
    } else {
      showToast('유효한 데이터가 없습니다. 컬럼 형식을 확인해 주세요.', 'error');
    }

    return { added, skipped, duplicated, errors };
  };

  return {
    detailInput,
    setDetailInput,
    editingDetailId,
    setEditingDetailId,
    handleDetailChange,
    handleTestChange,
    addTest,
    removeTest,
    handleSaveDetail,
    handleEditDetail,
    handleDeleteDetail,
    resetDetailForm,
    handleQuickStatusChange,
    handleBulkPaste,
    getBlankDetailInput: getInitialMainDetailInput, // 저장 안 한 변경 확인용 빈 양식 (새 시트 기준)
  };
};
