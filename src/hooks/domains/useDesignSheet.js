import { useState } from 'react';
import { DESIGN_STAGES, SAMPLING_SUBSTAGES, DEV_DROP_REASONS } from '../../constants/common';
import { DEFAULT_KNIT_GRADE_ID, DEFAULT_PROCESS_TYPE_ID } from '../../constants/costing';
import { makeInitialCostFields } from '../../utils/costFields';
import { resolveKnitKgRate, normalizeExtraCosts, sumYarnRatio, isYarnRatioComplete, normalizeYarnSlots, clampYarnRatio } from '../../utils/costModel';
import { todayLocalISO, num } from '../../utils/helpers';
import { devQuoteToSheetFields } from '../../utils/devQuoteModel';

// GRUBIG ERP - 원단 설계서 도메인 로직 훅

export const useDesignSheet = (designSheets, savedFabrics, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, exchangeRates, saveFabricFromSheet, devRequests) => {
  const [editingSheetId, setEditingSheetId] = useState(null);

  // 설계서 초기 입력 폼
  const getInitialSheetInput = () => ({
    devOrderNo: '',
    eztexOrderNo: '',
    articleNo: '',
    fabricName: '',       // 원단명
    orderNumbers: [],
    stage: 'draft',
    changeHistory: [],       // 변경 이력 [{date, fields:{필드: 이전값}, reason}]
    changeReason: '',        // 변경사유 (저장 시 이력에 기록 후 제거)
    fieldConfirm: {},        // [요청5] 편직/염색 칸별 확인 여부 { 'knitting.gauge': true }
    fieldMeta: {},           // [요청5] 편직/염색 칸별 최근 변경 감사 { key: {by, byName, at, from, to} }
    status: 'active',        // active | dropped
    devRequestId: null,      // 연결된 개발의뢰 ID
    deadline: '',            // 납기 (설계서 전체 납기 관리)
    registeredDate: todayLocalISO(), // 등록 날짜 (사용자 수동 입력, YYYY-MM-DD)

    // (1) 원사 정보 (기존 원사 라이브러리 연동)
    yarns: [
      { yarnId: '', ratio: 100 },
      { yarnId: '', ratio: 0 },
      { yarnId: '', ratio: 0 },
      { yarnId: '', ratio: 0 }
    ],

    // (2) 편직 정보
    knitting: {
      factory: '',
      structure: '',
      machineType: '',
      gauge: '',
      machineInch: '',
      needleCount: '',
      hasOpenWidth: false,
      isOpenWidth: false,
      feederCount: '',
      structureDiagram: '',
      remarks: ''
    },

    // (3) 염가공 정보
    dyeing: {
      factory: '',
      dyedWidth: '',
      tenterWidth: '',
      tenterTemp: '',
      fabricSpeed: '',
      overFeeder: '',
      processMethod: '',
      remarks: ''
    },

    // (4) 후가공 정보
    finishing: {
      factory: '',
      type: '',
      method: '',
      remarks: ''
    },

    // 실측 데이터 (EZ-TEX 등록 이후)
    actualData: {
      greigeWeight: '',
      loopLength: '',
      finishedWidth: '',
      finishedWeight: '',
      remarks: ''
    },

    // Cost 연동용 (기존 fabricInput 호환 구조)
    costInput: {
      widthFull: 58,
      widthCut: 56,
      gsm: 300,
      costGYd: '',
      ...makeInitialCostFields() // 원가 칸 초기값 (utils/costFields — 원단·설계서·가설계서 같음)
    }
  });

  const [sheetInput, setSheetInput] = useState(getInitialSheetInput);

  // --- 필드 변경 핸들러들 ---

  // 최상위 필드 변경
  const handleSheetChange = (e) => {
    const { name, value } = e.target;
    setSheetInput(prev => ({ ...prev, [name]: value }));
  };

  // 중첩 섹션 필드 변경 (knitting.factory 등)
  const handleSectionChange = (section, field, value) => {
    setSheetInput(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // 원사 슬롯 변경 — 항상 4칸 이상 유지(건너뛴 칸에 null이 생기지 않게), 혼용률은 0~100
  const handleSheetYarnChange = (index, field, value) => {
    setSheetInput(prev => {
      const yarns = normalizeYarnSlots(prev.yarns, Math.max(4, index + 1));
      yarns[index] = {
        ...yarns[index],
        [field]: field === 'ratio' ? clampYarnRatio(value) : String(value || '')
      };
      return { ...prev, yarns };
    });
  };

  // 편집 창에 열려 있는 설계서를 저장소와 같게 맞춤 — 단계 이동·원단 등록·연결 등이 저장소만 바꾸고
  //  열린 폼은 옛 값으로 남아 있다가 [설계서 저장] 때 덮어쓰던 문제 방지
  const syncOpenSheet = (sheetId, patch) => {
    if (String(editingSheetId) !== String(sheetId)) return;
    setSheetInput(prev => ({ ...prev, ...patch }));
  };

  // Cost 입력 필드 변경 (brandExtra_tier1k 같은 네스트 키도 처리)
  const handleCostInputChange = (e) => {
    const { name, value } = e.target;
    // brandExtra_tier1k → costInput.brandExtra.tier1k
    if (name.startsWith('brandExtra_')) {
      const tier = name.split('_')[1];
      setSheetInput(prev => ({
        ...prev,
        costInput: {
          ...prev.costInput,
          brandExtra: { ...(prev.costInput?.brandExtra || {}), [tier]: Number(value) }
        }
      }));
      return;
    }
    setSheetInput(prev => ({
      ...prev,
      costInput: {
        ...prev.costInput,
        [name]: (name === 'costGYd') ? value : Number(value)
      }
    }));
  };

  // Cost 중첩 필드(losses, brandExtra) 변경
  const handleCostNestedChange = (section, tier, field, value) => {
    setSheetInput(prev => ({
      ...prev,
      costInput: {
        ...prev.costInput,
        [section]: {
          ...prev.costInput[section],
          [tier]: field
            ? { ...prev.costInput[section][tier], [field]: Number(value) }
            : Number(value)
        }
      }
    }));
  };

  // 실측 데이터 변경
  const handleActualDataChange = (field, value) => {
    setSheetInput(prev => ({
      ...prev,
      actualData: { ...prev.actualData, [field]: value }
    }));
  };

  // 폼 리셋
  const resetSheetForm = () => {
    setSheetInput(getInitialSheetInput());
    setEditingSheetId(null);
  };

  // --- 진행 단계 관리 ---

  // 단계 직접 선택 (수동 전이) — 사용자가 스텝퍼에서 임의의 단계를 클릭하면 호출됨
  // 앞/뒤 양방향 이동 모두 허용. articled 진입 시에만 필수값 검증 + 원단 자동 등록.
  const setStage = async (sheetId, targetStage) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (!DESIGN_STAGES.some(s => s.key === targetStage)) return;
    if (sheet.stage === targetStage) return;

    if (targetStage === 'articled') {
      if (!sheet.articleNo) {
        showToast('Article 번호를 먼저 입력해주세요.', 'error');
        return;
      }
      const ci = sheet.costInput || {};
      if (!ci.gsm || !ci.widthCut || !ci.widthFull) {
        showToast('아이템화 전에 최종 스펙(GSM, 내폭, 외폭)을 모두 입력해주세요.', 'error');
        return;
      }
      // [원가 확인] 혼용률 100%가 아니면 원가가 틀어진 원단이 등록되므로 아이템화 막기
      if (!isYarnRatioComplete(sheet.yarns)) {
        showToast(`아이템화 전에 원사 혼용률 합계를 100%로 맞춰 주세요. (현재 ${sumYarnRatio(sheet.yarns)}%)`, 'error');
        return;
      }
    }

    const now = new Date().toISOString();
    const updatedSheet = {
      ...sheet,
      stage: targetStage,
      stageEnteredAt: { ...(sheet.stageEnteredAt || {}), [targetStage]: now },
      updatedAt: now
    };

    // [샘플 세부단계] '샘플 진행'으로 처음 진입하면 세부단계를 '원사 발주'로 자동 초기화
    if (targetStage === 'sampling' && !sheet.samplingSub) {
      updatedSheet.samplingSub = 'yarn';
      updatedSheet.samplingSubEnteredAt = { ...(sheet.samplingSubEnteredAt || {}), yarn: now };
    }

    // articled 진입: 이미 원단이 연결돼 있으면 신규 등록 없이 stage만 복원
    // (사용자가 역방향으로 이동 후 다시 articled로 돌아오는 자연스러운 흐름 지원)
    const stagePatch = {
      stage: updatedSheet.stage,
      stageEnteredAt: updatedSheet.stageEnteredAt,
      samplingSub: updatedSheet.samplingSub,
      samplingSubEnteredAt: updatedSheet.samplingSubEnteredAt,
      updatedAt: updatedSheet.updatedAt,
    };
    if (targetStage === 'articled') {
      if (sheet.linkedFabricId) {
        const ok = await saveDocToCloud('designSheets', updatedSheet);
        if (ok === false) return;
        syncOpenSheet(sheetId, stagePatch);
        showToast('아이템화 단계로 복원되었습니다 (기존 원단 유지).', 'success');
        return;
      }
      if (saveFabricFromSheet) {
        // 원단 등록이 가드(Article 중복 등)에 막히면 단계 이동도 취소 — 오해 소지 있는 성공 토스트 방지
        if (!(await registerFabricFromSheet(updatedSheet))) return;
        showToast(`'아이템화' 단계로 이동했습니다.`, 'success');
        return;
      }
    }

    const ok = await saveDocToCloud('designSheets', updatedSheet);
    if (ok === false) return;
    syncOpenSheet(sheetId, stagePatch);
    showToast(`'${DESIGN_STAGES.find(s => s.key === targetStage).label}' 단계로 이동했습니다.`, 'success');
  };

  // 샘플 진행 세부단계 변경 (원사발주 → 편직 → 염가공 / 중단)
  // 세부단계 진입 시각을 누적 기록 → 현황에서 "N일째" 경과 표시에 사용
  const setSamplingSub = (sheetId, subKey) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (!SAMPLING_SUBSTAGES.some(s => s.key === subKey)) return;
    if (sheet.samplingSub === subKey) return;

    const now = new Date().toISOString();
    const patch = {
      samplingSub: subKey,
      samplingSubEnteredAt: { ...(sheet.samplingSubEnteredAt || {}), [subKey]: now },
      updatedAt: now
    };
    saveDocToCloud('designSheets', { ...sheet, ...patch });
    syncOpenSheet(sheetId, patch);
    const label = SAMPLING_SUBSTAGES.find(s => s.key === subKey)?.label || subKey;
    showToast(`샘플 진행 세부단계가 '${label}'(으)로 변경되었습니다.`, 'success');
  };

  // --- 의뢰 ↔ 설계서 수동 연결 (설계서 쪽에서 진행) ---

  // 자체개발(또는 미연결) 설계서에 기존 개발 의뢰를 수동으로 연결
  const linkSheetToDevRequest = (sheetId, devReqId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    const dev = (devRequests || []).find(d => d.id === devReqId);
    if (!sheet || !dev) return;

    // 이미 다른 진행중 설계서가 이 의뢰에 연결돼 있으면 차단 (1:1 매핑 보호)
    const other = (designSheets || []).find(
      s => s.id !== sheetId && s.devRequestId === devReqId && s.status !== 'dropped'
    );
    if (other) {
      showToast('이 의뢰에는 이미 연결된 설계서가 있습니다. 먼저 해제 후 다시 시도해주세요.', 'error');
      return;
    }

    const now = new Date().toISOString();
    // 설계서 쪽: 의뢰 ID + 개발번호 기록
    const linkPatch = { devRequestId: devReqId, devOrderNo: dev.devOrderNo || sheet.devOrderNo || '', updatedAt: now };
    saveDocToCloud('designSheets', { ...sheet, ...linkPatch });
    syncOpenSheet(sheetId, linkPatch);
    // 의뢰 쪽: 설계서 ID 연결 + '개발투입확정' 승격 (confirmed 신규 진입 시에만 시점 기록)
    const statusEnteredAt = dev.status === 'confirmed'
      ? (dev.statusEnteredAt || {})
      : { ...(dev.statusEnteredAt || {}), confirmed: now };
    saveDocToCloud('devRequests', {
      ...dev,
      linkedDesignSheetId: sheetId,
      status: 'confirmed',
      statusEnteredAt,
      updatedAt: now
    });
    showToast(`개발 의뢰 ${dev.devOrderNo || ''}와(과) 연결되었습니다.`, 'success');
  };

  // 설계서 ↔ 의뢰 연결 해제 (설계서는 자체개발로 전환, 의뢰는 유지)
  const unlinkSheetFromDevRequest = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet || !sheet.devRequestId) return;
    if (!window.confirm('이 설계서와 개발 의뢰의 연결을 해제할까요?\n(설계서는 자체개발로 전환되고, 개발 의뢰 자체는 유지됩니다)')) return;

    const now = new Date().toISOString();
    const dev = (devRequests || []).find(d => d.id === sheet.devRequestId);
    // 설계서 쪽: 의뢰 참조 제거 (자체개발화)
    const unlinkPatch = { devRequestId: null, devOrderNo: '', updatedAt: now };
    saveDocToCloud('designSheets', { ...sheet, ...unlinkPatch });
    syncOpenSheet(sheetId, unlinkPatch);
    // 의뢰 쪽: soft-unlink — linkedDesignSheetId만 해제하고 status(confirmed)는 유지
    if (dev && dev.linkedDesignSheetId === sheetId) {
      saveDocToCloud('devRequests', {
        ...dev,
        linkedDesignSheetId: null,
        updatedAt: now
      });
    }
    showToast('개발 의뢰 연결이 해제되었습니다.', 'success');
  };

  // --- CRUD ---

  // 저장 (새로 생성 or 수정)
  // onLinkToDevRequest: (devReqId, sheetId) => void — 설계서 저장 시 의뢰에 자동 연결
  // opts.keepForm: true 면 저장 후 폼을 비우지 않음 (저장 → 원단 등록을 이어서 할 때)
  // 반환: 저장한 설계서 문서(성공) / null(검증 실패·취소·저장 실패 — 폼은 그대로)
  const handleSaveSheet = async (user, onLinkToDevRequest, opts = {}) => {
    let finalInput = { ...sheetInput };

    // [New] 자체 설계서인 경우 개발오더넘버를 필수값에서 제외
    // 의뢰가 연결된 설계서만 개발번호 필수 입력 검증
    if (finalInput.devRequestId && !finalInput.devOrderNo) {
      showToast('연결된 개발 의뢰의 개발번호(devOrderNo)가 누락되었습니다.', 'error');
      return null;
    }

    // [방어] 원단명 필수 입력 검증
    if (!finalInput.fabricName?.trim()) {
      showToast('원단명(Name)을 반드시 입력해주세요.', 'error');
      return null;
    }

    // [원가 확인] 원사 혼용률 합계가 100%가 아니면 저장 막기 (원단 등록과 같은 규칙 — 대표님 결정 2026-10-03)
    //   비율만큼 원가가 덜/더 잡히고, 연결 원단으로 동기화되면 견적까지 틀어짐
    if (!isYarnRatioComplete(finalInput.yarns)) {
      showToast(`원사 혼용률 합계가 100%가 아닙니다 (현재 ${sumYarnRatio(finalInput.yarns)}%). 비율을 맞춘 뒤 저장해 주세요.`, 'error');
      return null;
    }

    // [연동 보호] 이미 원단이 연결된(아이템화된) 설계서는 재편집 저장 시에도 필수값을 유지해야 한다.
    //   handleSaveSheet가 아래에서 연결 원단으로 역동기화하므로, 빈 Article/스펙이 원단을
    //   조용히 오염시키는 것을 차단한다. (아이템화 전이 검증과 동일한 규칙을 재편집에도 적용)
    if (finalInput.linkedFabricId) {
      const ci = finalInput.costInput || {};
      if (!finalInput.articleNo?.trim()) {
        showToast('원단이 연결된 설계서는 Article 번호를 비울 수 없습니다.', 'error');
        return null;
      }
      if (!ci.gsm || !ci.widthCut || !ci.widthFull) {
        showToast('원단이 연결된 설계서는 최종 스펙(GSM, 내폭, 외폭)을 비울 수 없습니다.', 'error');
        return null;
      }
      // Article을 '다른' 원단과 중복되게 바꾸면 차단 (원단 Article 유일성 보호)
      const a = String(finalInput.articleNo).trim().toUpperCase();
      const collide = (savedFabrics || []).find(
        f => String(f.id) !== String(finalInput.linkedFabricId) &&
             String(f.article || '').trim().toUpperCase() === a
      );
      if (collide) {
        showToast(`같은 Article의 다른 원단이 이미 있습니다: ${a}`, 'error');
        return null;
      }
    }

    // [방어] 수정 모드에서 변경사유 미입력 시 경고 (저장은 허용)
    const isEditing = !!editingSheetId;
    if (isEditing && !finalInput.changeReason?.trim()) {
      if (!window.confirm('설계 변경 사유가 비어있습니다.\n이력 관리를 위해 사유 입력을 권장합니다.\n\n그래도 저장하시겠습니까?')) {
        return null;
      }
    }

    const now = new Date().toISOString();
    const isNew = !editingSheetId;
    const existing = isNew ? null : designSheets.find(s => s.id === editingSheetId);

    // [기획 #3 수정] 동일 의뢰에 대해 이미 active 설계서가 존재하는데 새로 저장하는 경우 차단
    //   → 멀티탭 / 재연동 시 devRequestId 중복으로 양방향 참조가 꼬이는 현상 방지
    if (isNew && finalInput.devRequestId) {
      const duplicate = (designSheets || []).find(
        s => s.devRequestId === finalInput.devRequestId && s.status !== 'dropped'
      );
      if (duplicate) {
        showToast('이 의뢰에는 이미 진행 중인 설계서가 존재합니다. 해당 설계서를 수정하거나 DROP 후 다시 시도하세요.', 'error');
        return null;
      }
    }

    // [신규] stageEnteredAt: 신규는 현재 stage로 초기화, 기존은 보존
    const stageEnteredAt = isNew
      ? { [finalInput.stage || 'draft']: now }
      : (existing?.stageEnteredAt || {});

    const itemToSave = {
      ...finalInput,
      // 단계·세부단계·상태·오더넘버·연결 원단은 폼이 아니라 단계 버튼·원단 등록 등이 바꾸는 값 →
      //  수정 저장 때는 저장소 값을 우선 (편집 창이 열린 사이 바뀐 값을 옛 폼 값으로 되돌리지 않게)
      ...(existing ? {
        stage: existing.stage || finalInput.stage,
        samplingSub: existing.samplingSub ?? finalInput.samplingSub,
        samplingSubEnteredAt: existing.samplingSubEnteredAt ?? finalInput.samplingSubEnteredAt,
        orderNumbers: existing.orderNumbers ?? finalInput.orderNumbers,
        linkedFabricId: finalInput.linkedFabricId || existing.linkedFabricId || null,
      } : {}),
      id: editingSheetId || `ds_${Date.now()}`,
      status: existing?.status || finalInput.status || 'active',
      stageEnteredAt,
      createdBy: isNew ? (user?.email || '') : (existing?.createdBy || ''),
      createdAt: isNew ? now : (existing?.createdAt || now),
      updatedAt: now
    };

    // === 변경 이력 감지 (수정 모드에서만) ===
    if (!isNew && existing) {
      const changedFields = {};
      // [요청5·2] 칸별 감사 정보 — 기존 fieldMeta 유지하며 변경된 확인칸만 갱신
      const fieldMeta = { ...(existing.fieldMeta || {}) };
      const editorEmail = user?.email || '';
      const editorName = user?.displayName || user?.email || '';
      const stampMeta = (key, oldVal, newVal) => {
        fieldMeta[key] = { by: editorEmail, byName: editorName, at: now, from: oldVal, to: newVal };
      };
      // 최상위 필드 비교
      ['fabricName', 'eztexOrderNo', 'articleNo', 'deadline', 'devOrderNo'].forEach(key => {
        const newVal = String(finalInput[key] || '');
        const oldVal = String(existing[key] || '');
        if (newVal !== oldVal) {
          changedFields[key] = existing[key] || '';
          // [요청2] 원단명은 확인칸이므로 감사 기록
          if (key === 'fabricName') stampMeta('fabricName', oldVal, newVal);
        }
      });
      // 중첩 섹션 비교 (knitting, dyeing, finishing, actualData)
      ['knitting', 'dyeing', 'finishing', 'actualData'].forEach(section => {
        Object.keys(finalInput[section] || {}).forEach(field => {
          if (field === 'feeders') return; // 배열은 별도 비교 제외
          const newVal = String(finalInput[section]?.[field] || '');
          const oldVal = String(existing[section]?.[field] || '');
          if (newVal !== oldVal) {
            changedFields[`${section}.${field}`] = oldVal;
            // 편직/염색/후가공 칸은 '누가·언제·무엇→무엇'을 칸별로 기록 (마우스오버 툴팁용)
            if (section === 'knitting' || section === 'dyeing' || section === 'finishing') {
              stampMeta(`${section}.${field}`, oldVal, newVal);
            }
          }
        });
      });
      // costInput 주요 필드 비교
      //  [원가 개편] 새 원가 필드가 없던 기존 설계서는 기본값(A · 옛 편직료 · 일반)으로 계산돼 왔으므로
      //  그 값과 비교 → 원가를 안 건드리고 저장해도 헛 변경 이력이 남지 않음
      const prevCostValue = (key) => {
        const ci = existing.costInput || {};
        if (key === 'knitGrade') return ci.knitGrade || DEFAULT_KNIT_GRADE_ID;
        if (key === 'knitKgRate') return resolveKnitKgRate(ci);
        if (key === 'processType') return ci.processType || DEFAULT_PROCESS_TYPE_ID;
        return ci[key];
      };
      ['widthFull', 'widthCut', 'gsm', 'costGYd', 'knitGrade', 'knitKgRate', 'processType',
       'dyeingFee', 'marginTier'].forEach(key => {
        const newVal = String(finalInput.costInput?.[key] ?? '');
        const oldVal = String(prevCostValue(key) ?? '');
        if (newVal !== oldVal) {
          changedFields[`costInput.${key}`] = prevCostValue(key) ?? '';
          // [요청2] 내폭·외폭·GSM은 확인칸이므로 감사 기록
          if (key === 'widthCut' || key === 'widthFull' || key === 'gsm') stampMeta(`costInput.${key}`, oldVal, newVal);
        }
      });
      // 원가 표의 나머지 항목 — 위험마진(%)·kg단가 구간·후가공·추가비용 (예전엔 바꿔도 이력에 안 남았음)
      //  목록은 내용을 통째로 비교하고(줄 id 제외), 이력에는 바뀌기 전 내용을 짧은 글자로
      const prevRisk = existing.costInput?.riskMarginPct ?? '';
      if (String(finalInput.costInput?.riskMarginPct ?? '') !== String(prevRisk)) changedFields['costInput.riskMarginPct'] = prevRisk;
      const toList = (v) => (Array.isArray(v) ? v : []);
      const costLists = {
        knitKgRateTiers: { read: toList, summary: (list) => list.map(t => `${num(t.fromKg)}kg~ ${num(t.rate)}원`).join(', ') },
        finishing: { read: toList, summary: (list) => list.map(f => `${f.name || '후가공'} ${num(f.fee)}원·LOSS ${Number(f.lossPct) || 0}%`).join(', ') },
        etcCosts: { read: normalizeExtraCosts, summary: (list) => list.map(e => `${e.name || '추가비용'} ${num(e.perYd)}원/yd`).join(', ') },
      };
      Object.entries(costLists).forEach(([key, { read, summary }]) => {
        const comparable = (list) => JSON.stringify(list.map(({ id: _id, ...rest }) => rest));
        const oldList = read(existing.costInput?.[key]);
        const newList = read(finalInput.costInput?.[key]);
        if (comparable(oldList) !== comparable(newList)) changedFields[`costInput.${key}`] = summary(oldList) || '(없음)';
      });
      // [원사 배합] 비율 확인칸 — 원사별 비율 변경 감사 기록
      (finalInput.yarns || []).forEach((y, idx) => {
        const newVal = String(y?.ratio ?? '');
        const oldVal = String(existing.yarns?.[idx]?.ratio ?? '');
        if (newVal !== oldVal) {
          changedFields[`yarns.${idx}.ratio`] = oldVal;
          stampMeta(`yarns.${idx}.ratio`, oldVal, newVal);
        }
      });
      itemToSave.fieldMeta = fieldMeta;
      // 변경사항이 있으면 이력에 추가
      if (Object.keys(changedFields).length > 0) {
        const historyEntry = {
          date: now,
          fields: changedFields,
          reason: finalInput.changeReason || ''
        };
        itemToSave.changeHistory = [
          historyEntry,
          ...(existing.changeHistory || [])
        ];
      }
    }
    // changeReason은 임시 필드이므로 Firebase에 저장하지 않음
    delete itemToSave.changeReason;

    const saved = await saveDocToCloud('designSheets', itemToSave);
    if (saved === false) return null; // 저장 실패 → 폼 그대로 (saveDocToCloud가 실패 알림)
    // [양방향 동기화] 연결된 원단이 있다면 해당 원단 DB도 같은 값으로 덮어씀
    // [B4 수정] ?? 연산자로 사용자가 의도한 0값을 보존
    if (itemToSave.linkedFabricId) {
      const linkedFabric = savedFabrics?.find(f => String(f.id) === String(itemToSave.linkedFabricId));
      if (linkedFabric) {
        const ci = itemToSave.costInput || {};
        // [Step 3] DB 저장 전 객체 복사 후 임시 플래그 제거 → DB 스키마 오염 방지
        const fabricToSync = {
          ...linkedFabric,
          linkedSheetId: itemToSave.id, // [Step 1] 원단 DB에 연동 설계서 ID 삽입 (양방향 참조 매듭)
          // [기획오류 #2 수정] article, itemName도 동기화
          article: itemToSave.articleNo ?? linkedFabric.article,
          itemName: itemToSave.fabricName ?? linkedFabric.itemName,
          widthFull: ci.widthFull ?? linkedFabric.widthFull,
          widthCut: ci.widthCut ?? linkedFabric.widthCut,
          gsm: ci.gsm ?? linkedFabric.gsm,
          costGYd: ci.costGYd ?? linkedFabric.costGYd,
          knittingFee1k: ci.knittingFee1k ?? linkedFabric.knittingFee1k,
          knittingFee3k: ci.knittingFee3k ?? linkedFabric.knittingFee3k,
          knittingFee5k: ci.knittingFee5k ?? linkedFabric.knittingFee5k,
          dyeingFee: ci.dyeingFee ?? linkedFabric.dyeingFee,
          extraFee1k: ci.extraFee1k ?? linkedFabric.extraFee1k,
          extraFee3k: ci.extraFee3k ?? linkedFabric.extraFee3k,
          extraFee5k: ci.extraFee5k ?? linkedFabric.extraFee5k,
          losses: ci.losses ?? linkedFabric.losses,
          marginTier: ci.marginTier ?? linkedFabric.marginTier,
          brandExtra: ci.brandExtra ?? linkedFabric.brandExtra,
          // [원가 개편] 편직 난이도·kg단가·구간 단가·가공 유형
          knitGrade: ci.knitGrade ?? linkedFabric.knitGrade,
          knitKgRate: ci.knitKgRate ?? linkedFabric.knitKgRate,
          knitKgRateTiers: ci.knitKgRateTiers ?? linkedFabric.knitKgRateTiers,
          processType: ci.processType ?? linkedFabric.processType,
          // [신규 원가모델] 후가공·기타비용·위험마진도 동기화 (원단은 top-level 보관)
          finishing: ci.finishing ?? linkedFabric.finishing,
          etcCosts: ci.etcCosts ?? linkedFabric.etcCosts,
          riskMarginPct: ci.riskMarginPct ?? linkedFabric.riskMarginPct,
          yarns: itemToSave.yarns || linkedFabric.yarns || []
        };
        await saveDocToCloud('fabrics', fabricToSync);
      }
    }

    // 의뢰 연결: devRequestId가 있으면 의뢰에 설계서 ID를 기록
    if (itemToSave.devRequestId && onLinkToDevRequest) {
      onLinkToDevRequest(itemToSave.devRequestId, itemToSave.id);
    }

    // [제거됨] draft → eztex 자동 전환 로직 제거
    // 이유: 설계서 저장 ≠ 단계 전환. 아직 작성 중인 설계서가 강제로 다음 단계로 넘어가는 것을 방지
    // 단계 전환은 생산관리자가 '다음 단계로' 버튼을 명시적으로 클릭해야만 진행됩니다.

    if (!opts.keepForm) resetSheetForm();
    showToast(isNew ? '설계서가 저장되었습니다.' : '설계서가 수정되었습니다.', 'success');
    return itemToSave;
  };

  // 수정 모드 진입
  const handleEditSheet = (sheet) => {
    const initial = getInitialSheetInput();
    setSheetInput({
      ...initial,
      ...sheet,
      knitting: { ...initial.knitting, ...(sheet.knitting || {}) },
      dyeing: { ...initial.dyeing, ...(sheet.dyeing || {}) },
      finishing: { ...initial.finishing, ...(sheet.finishing || {}) },
      actualData: { ...initial.actualData, ...(sheet.actualData || {}) },
      costInput: {
        ...initial.costInput,
        ...(sheet.costInput || {}),
        losses: {
          tier1k: { ...initial.costInput.losses.tier1k, ...(sheet.costInput?.losses?.tier1k || {}) },
          tier3k: { ...initial.costInput.losses.tier3k, ...(sheet.costInput?.losses?.tier3k || {}) },
          tier5k: { ...initial.costInput.losses.tier5k, ...(sheet.costInput?.losses?.tier5k || {}) }
        },
        brandExtra: { ...initial.costInput.brandExtra, ...(sheet.costInput?.brandExtra || {}) },
        // [원가 개편] 기존 설계서: kg단가는 옛 5,000YD 편직료에서 가져오고(목록 계산과 같은 값),
        //   추가비용은 예전 기본 3항목(외관/이화학/운임 — 이제 원가 설정)을 빼고 품목 항목만 남김
        knitKgRate: resolveKnitKgRate(sheet.costInput),
        etcCosts: normalizeExtraCosts(sheet.costInput?.etcCosts)
      },
      yarns: sheet.yarns || initial.yarns,
      orderNumbers: sheet.orderNumbers || []
    });
    setEditingSheetId(sheet.id);
  };

  // 반환: 삭제했으면 true (취소·차단·실패면 false — 편집 창은 그대로 두도록)
  // 설계서 삭제 — 설계서 창의 [삭제]와 개발/설계 현황 목록의 🗑 가 같이 씀
  //  반환: 지웠으면 true (막힘·취소·실패면 false — 호출부에서 창 닫기 판단)
  const handleDeleteSheet = async (id) => {
    const sheet = designSheets.find(s => s.id === id);

    // [방어] 아이템화 완료 설계서는 삭제 차단 — 확정된 생산 데이터 보호
    if (sheet?.stage === 'articled') {
      showToast('아이템화가 완료된 설계서는 삭제할 수 없습니다. (데이터 보호)', 'error');
      return false;
    }

    // 지우면 같이 정리되는 연결 — 확인 창에 미리 알려 줌 (목록에서 바로 지울 때도 어떤 설계서인지 알 수 있게 이름도)
    const linkedDev = sheet?.devRequestId
      ? (devRequests || []).find(d => d.id === sheet.devRequestId && d.linkedDesignSheetId === id)
      : null;
    // '기존 원단에서 연결'로 이어 둔 원단 — 원단은 남기고 연결만 풂 (대표님 결정 2026-10-06)
    //  (예전엔 원단 쪽 연결이 남아 그 원단을 다른 설계서에 다시 연결할 수 없었음)
    const linkedFabrics = (savedFabrics || []).filter(f => String(f.linkedSheetId) === String(id));
    const label = [sheet?.eztexOrderNo, sheet?.devOrderNo, sheet?.fabricName].filter(Boolean).join(' · ');
    const notes = [];
    if (linkedDev) notes.push(`연결된 개발 의뢰(${linkedDev.devOrderNo || '-'})는 남고 연결만 풀려요 — 개발 의뢰 현황에 '설계 대기'로 다시 보여요.`);
    if (linkedFabrics.length > 0) notes.push(`연결된 원단(${linkedFabrics.map(f => f.article || f.itemName || '-').join(', ')})은 원단 리스트에 남고, 설계서 연결만 풀려요.`);

    // [방어] 샘플 진행 중인 설계서는 이중 경고
    const head = sheet?.stage === 'sampling' ? '⚠️ 샘플 진행 중인 설계서입니다!\n' : '';
    const msg = `${head}${label ? `'${label}' 설계서` : '이 설계서'}를 영구 삭제할까요? (삭제된 설계서는 복구할 수 없습니다.)`
      + (notes.length ? `\n\n· ${notes.join('\n· ')}` : '');

    if (!window.confirm(msg)) return false;

    // 먼저 지우고, 지워졌을 때만 연결 정리 (삭제가 실패했는데 연결만 끊기는 일 방지)
    const ok = await deleteDocFromCloud('designSheets', id);
    if (ok === false) return false; // deleteDocFromCloud가 '삭제 실패' 알림

    // [A4 수정] 연결된 의뢰의 linkedDesignSheetId 해제 → 의뢰 영구잠김 방지
    if (linkedDev) {
      saveDocToCloud('devRequests', {
        ...linkedDev,
        linkedDesignSheetId: null,
        updatedAt: new Date().toISOString()
      });
    }
    // 연결된 원단의 linkedSheetId 해제 → 그 원단을 다른 설계서에 다시 연결할 수 있게
    linkedFabrics.forEach(f => saveDocToCloud('fabrics', { ...f, linkedSheetId: null }));
    showToast('설계서가 삭제되었습니다.', 'success');
    return true;
  };

  // --- 버전(개선) 관리 제거됨 → 변경 이력 방식으로 대체 ---
  // 설계서 수정 시 handleSaveSheet 내부에서 자동으로 changeHistory에 이력 축적

  // --- Cost 연동 ---
  // 설계서의 costInput + yarns 데이터를 기존 calculateCost에 전달
  const getDesignCost = (sheet) => {
    if (!sheet || !calculateCost) return null;
    const fabricData = {
      ...(sheet.costInput || {}),
      yarns: sheet.yarns || []
    };
    return calculateCost(fabricData);
  };

  // 개발 의뢰에서 설계서로 연동 시 초기값 세팅 (buyerName 제거 — 의뢰에서 참조)
  const initFromDevRequest = (devData) => {
    const initial = getInitialSheetInput();
    // [원가 견적 이어받기 — 2026-10-06] 개발 의뢰에서 원가 견적을 냈으면 그 예상 스펙
    //  (원사·폭·GSM·편직/염가공 조건·위험마진, 견적서 품목명 → 원단명)을 설계서에 채움
    const fromQuote = devQuoteToSheetFields(devData.costQuote, initial);
    setSheetInput({
      ...initial,
      ...(fromQuote ? fromQuote.fields : {}),
      devOrderNo: devData.devOrderNo || '',
      devRequestId: devData.devRequestId || null,
      deadline: devData.sampleDeadline || ''  // 샘플 생산 납기 자동 연동
    });
    setEditingSheetId(null);
    if (!fromQuote) return;
    // 직접 입력한 원사는 설계서에 단가 칸이 없어 원사 칸이 비어 있음 → 라이브러리 원사를 골라야 원가가 계산됨
    if (fromQuote.manualNames.length > 0) {
      alert(
        `원가 견적 때 넣은 스펙(원사 비율·폭·GSM·편직/염가공 조건)을 설계서에 채웠어요.\n\n` +
        `직접 입력한 원사 ${fromQuote.manualNames.length}개(${fromQuote.manualNames.join(', ')})는 ` +
        `설계서에서 라이브러리 원사를 골라야 원가가 계산돼요 (지금은 그 칸 재료비 0원).`
      );
    } else {
      showToast('원가 견적 때 넣은 스펙(원사·폭·GSM·편직/염가공 조건)을 설계서에 채웠어요.', 'success');
    }
  };

  // [D3] generateSelfDevOrderNo 제거됨 — 자체 설계서는 빈칸 유지 정책 (데드코드 정리)

  // 아이템화 시 원단 자동 등록 (savedFabrics에 변환 저장)
  // 반환값: 등록 성공 true / 가드에 막혀 미등록·저장 실패 false (호출부에서 단계 이동·모달 닫기 판단에 사용)
  const registerFabricFromSheet = async (sheet) => {
    if (!saveFabricFromSheet) return false;

    // [A2 방어] 이미 원단이 등록된 설계서는 중복 등록 차단
    if (sheet.linkedFabricId) {
      showToast('이미 원단이 등록된 설계서입니다.', 'error');
      return false;
    }

    // [원가 확인] 혼용률 100%가 아니면 원단으로 등록하지 않음 (원가가 틀어진 원단이 견적에 들어가는 것 방지)
    if (!isYarnRatioComplete(sheet.yarns)) {
      showToast(`원사 혼용률 합계를 100%로 맞춘 뒤 원단으로 등록해 주세요. (현재 ${sumYarnRatio(sheet.yarns)}%)`, 'error');
      return false;
    }

    // [연동 보호] 동일 Article 원단이 이미 있으면 자동 등록 차단 (수동 원단 저장과 동일한 유일성 규칙)
    //   → 수동 등록만 막혀 있고 자동 등록/동기화로 중복 Article이 새는 비대칭 제거
    const dupArticle = String(sheet.articleNo || '').trim().toUpperCase();
    if (dupArticle) {
      const dupFabric = (savedFabrics || []).find(
        f => String(f.article || '').trim().toUpperCase() === dupArticle
      );
      if (dupFabric) {
        showToast(`이미 같은 Article의 원단이 있습니다: ${dupArticle}. 다른 Article로 변경 후 등록하세요.`, 'error');
        return false;
      }
    }

    // [B3 수정] ID를 문자열로 생성하여 타입 불일치 방지
    const fabricId = `fab_${Date.now()}`;
    const ci = sheet.costInput || {};
    const fabricData = {
      id: fabricId,
      linkedSheetId: sheet.id,
      date: new Date().toLocaleDateString(),
      article: sheet.articleNo || '',
      itemName: sheet.fabricName || '',
      // [B4 방어 추가] 빈 문자열("")일 경우에도 기본값이 투입되도록 강제 캐스팅
      widthFull: (ci.widthFull === '' || ci.widthFull == null) ? 58 : Number(ci.widthFull),
      widthCut: (ci.widthCut === '' || ci.widthCut == null) ? 56 : Number(ci.widthCut),
      gsm: (ci.gsm === '' || ci.gsm == null) ? 300 : Number(ci.gsm),
      costGYd: (ci.costGYd === '' || ci.costGYd == null) ? '' : Number(ci.costGYd),
      knittingFee1k: (ci.knittingFee1k === '' || ci.knittingFee1k == null) ? 3000 : Number(ci.knittingFee1k),
      knittingFee3k: (ci.knittingFee3k === '' || ci.knittingFee3k == null) ? 2000 : Number(ci.knittingFee3k),
      knittingFee5k: (ci.knittingFee5k === '' || ci.knittingFee5k == null) ? 2000 : Number(ci.knittingFee5k),
      dyeingFee: (ci.dyeingFee === '' || ci.dyeingFee == null) ? 8800 : Number(ci.dyeingFee),
      extraFee1k: (ci.extraFee1k === '' || ci.extraFee1k == null) ? 900 : Number(ci.extraFee1k),
      extraFee3k: (ci.extraFee3k === '' || ci.extraFee3k == null) ? 700 : Number(ci.extraFee3k),
      extraFee5k: (ci.extraFee5k === '' || ci.extraFee5k == null) ? 500 : Number(ci.extraFee5k),
      losses: ci.losses ?? { tier1k:{knit:5,dye:10}, tier3k:{knit:3,dye:10}, tier5k:{knit:3,dye:9} },
      marginTier: ci.marginTier ?? 3,
      brandExtra: ci.brandExtra ?? { tier1k:1000, tier3k:700, tier5k:500 },
      // [원가 개편] 편직 난이도·kg단가·구간 단가·가공 유형 (없으면 A · 옛 편직료 · 일반)
      knitGrade: ci.knitGrade || DEFAULT_KNIT_GRADE_ID,
      knitKgRate: resolveKnitKgRate(ci),
      knitKgRateTiers: Array.isArray(ci.knitKgRateTiers) ? ci.knitKgRateTiers : [],
      processType: ci.processType || DEFAULT_PROCESS_TYPE_ID,
      // [신규 원가모델] 후가공·품목 추가비용·위험마진 보존
      finishing: Array.isArray(ci.finishing) ? ci.finishing : [],
      etcCosts: normalizeExtraCosts(ci.etcCosts),
      riskMarginPct: Number(ci.riskMarginPct || 0),
      yarns: normalizeYarnSlots(sheet.yarns),
      remarks: `설계서 아이템화 자동 등록 (${sheet.devOrderNo || ''})`
    };
    // 원단이 실제로 저장됐을 때만 설계서를 연결 (실패했는데 '없는 원단'에 연결된 채 아이템화로 굳는 일 방지)
    const fabricSaved = await saveFabricFromSheet(fabricData);
    if (fabricSaved === false) return false; // saveDocToCloud가 실패 알림

    // 설계서 쪽에도 linkedFabricId 기록
    const now = new Date().toISOString();
    const linkPatch = {
      stage: 'articled',
      linkedFabricId: fabricId,
      // articled 진입 시점 기록 (setStage에서 이미 기록됐을 수 있으나 보강)
      stageEnteredAt: { ...(sheet.stageEnteredAt || {}), articled: sheet.stageEnteredAt?.articled || now },
      updatedAt: now
    };
    await saveDocToCloud('designSheets', { ...sheet, ...linkPatch });
    syncOpenSheet(sheet.id, linkPatch);

    showToast(`Article ${sheet.articleNo} 원단이 자동 등록되었습니다.`, 'success');
    return true;
  };

  // [원단 리스트에 등록] 버튼 — 설계서를 먼저 저장(검증·변경 이력 포함)하고, 저장에 성공했을 때만 그 저장본으로 원단 등록
  //  (예전: 저장이 실패·취소돼도 원단이 등록되고, 저장 직후 이력을 옛 내용으로 덮어쓰던 문제)
  //  반환: 등록까지 끝났으면 true (편집 창 닫기), 아니면 false (폼 그대로)
  const saveSheetAndRegisterFabric = async (user, onLinkToDevRequest) => {
    if (!editingSheetId) return false;
    if (!sheetInput.articleNo?.trim()) {
      showToast('원단을 등록하려면 상단의 [Article 번호]를 입력해 주세요.', 'error');
      return false;
    }
    const ci = sheetInput.costInput || {};
    if (!ci.gsm || !ci.widthCut || !ci.widthFull) {
      showToast('원단 등록 전에 최종 스펙(GSM, 내폭, 외폭)을 모두 입력해 주세요.', 'error');
      return false;
    }
    if (sheetInput.linkedFabricId) {
      showToast('이미 원단이 등록된 설계서입니다.', 'error');
      return false;
    }
    const art = String(sheetInput.articleNo).trim().toUpperCase();
    if ((savedFabrics || []).some(f => String(f.article || '').trim().toUpperCase() === art)) {
      showToast(`이미 같은 Article의 원단이 있습니다: ${art}. 다른 Article로 변경 후 등록하세요.`, 'error');
      return false;
    }
    const savedDoc = await handleSaveSheet(user, onLinkToDevRequest, { keepForm: true });
    if (!savedDoc) return false;
    const ok = await registerFabricFromSheet(savedDoc);
    if (ok) resetSheetForm();
    return ok;
  };

  // DROP 처리 (설계서를 보관함으로 이동, 현황에서 숨김)
  const dropDesignSheet = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    // [방어] 아이템화 완료 설계서는 DROP 차단 — 이미 원단 등록 완료
    if (sheet.stage === 'articled') {
      showToast('아이템화가 완료된 설계서는 DROP할 수 없습니다. (이미 원단 등록 완료)', 'error');
      return;
    }

    if (!window.confirm('이 설계서를 DROP 처리하시겠습니까?\n(보관함으로 이동되며 현황에서 숨겨집니다)')) return;

    // [B3] DROP 시 연결된 의뢰의 linkedDesignSheetId만 해제 (status는 보존)
    // → 의뢰는 confirmed 상태 그대로 유지되어 다른 설계서로 재시도 가능
    if (sheet.devRequestId && devRequests) {
      const linkedDev = devRequests.find(d => d.id === sheet.devRequestId);
      if (linkedDev?.linkedDesignSheetId === sheetId) {
        saveDocToCloud('devRequests', {
          ...linkedDev,
          linkedDesignSheetId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }

    const dropPatch = { status: 'dropped', updatedAt: new Date().toISOString() };
    saveDocToCloud('designSheets', { ...sheet, ...dropPatch });
    syncOpenSheet(sheetId, dropPatch);
    showToast('DROP 처리되었습니다.', 'success');
  };

  // DROP 복원 (실수로 Drop한 것 되돌리기)
  const restoreFromDrop = (sheetId) => {
    const sheet = designSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    // 다시 연결할 개발 의뢰 — 의뢰가 그사이 Drop(미진행)됐으면 같이 되살아나므로 확인 창에 미리 알려 줌 (2026-10-06)
    //  (예전엔 '가격' 사유로 Drop한 의뢰가 확인 없이 '개발 확정'으로 돌아가고 Drop 사유도 남았음)
    const relinkDev = sheet.devRequestId && devRequests
      ? devRequests.find(d => d.id === sheet.devRequestId && !d.linkedDesignSheetId) || null
      : null;
    const revivesDropped = relinkDev?.status === 'rejected';
    const dropLabel = DEV_DROP_REASONS.find(r => r.key === relinkDev?.dropReason)?.label;
    const reviveNote = revivesDropped
      ? `\n\n연결된 개발 의뢰(${relinkDev.devOrderNo || '-'})는 Drop${dropLabel ? `(사유: ${dropLabel})` : ''} 상태예요.\n설계서를 복원하면 의뢰도 '개발 확정'으로 되살아나고 Drop 사유는 지워져요.`
      : '';
    if (!window.confirm(`이 설계서를 복원하시겠습니까?\n(Drop 전 단계로 복원됩니다)${reviveNote}`)) return;
    const now = new Date().toISOString();
    // [기획오류 #3 수정] 복원 이력을 changeHistory에 기록
    const restoreHistory = {
      date: now,
      fields: { status: 'dropped' },
      reason: 'DROP 복원'
    };
    const restorePatch = { status: 'active', changeHistory: [restoreHistory, ...(sheet.changeHistory || [])], updatedAt: now };
    saveDocToCloud('designSheets', { ...sheet, ...restorePatch });
    syncOpenSheet(sheetId, restorePatch);

    // [Step 1] 복원 시 의뢰↔설계서 1:1 매핑 복구
    // DROP 시 해제되었던 linkedDesignSheetId를 다시 이 설계서 ID로 연결
    // [기획 #4 수정] dev 상태는 rejected일 때만 confirmed로 복구 →
    //   DROP 후 사용자가 수동으로 바꾼 상태(pending/analyzing 등)를 덮어쓰지 않음
    //   rejected → confirmed 로 되살릴 때는 Drop 사유·메모를 지우고 확정 날짜를 기록 (보관함 복원과 같은 규칙)
    if (relinkDev) {
      const { dropReason: _dropReason, dropMemo: _dropMemo, droppedBy: _droppedBy, ...withoutDrop } = relinkDev;
      saveDocToCloud('devRequests', {
        ...(revivesDropped ? withoutDrop : relinkDev),
        linkedDesignSheetId: sheetId,
        status: revivesDropped ? 'confirmed' : relinkDev.status,
        ...(revivesDropped ? { statusEnteredAt: { ...(relinkDev.statusEnteredAt || {}), confirmed: now } } : {}),
        updatedAt: now
      });
    }

    showToast('복원되었습니다.', 'success');
  };

  return {
    sheetInput, setSheetInput,
    editingSheetId,
    handleSheetChange, handleSectionChange,
    handleSheetYarnChange, handleCostInputChange, handleCostNestedChange,
    handleActualDataChange,
    handleSaveSheet, handleEditSheet, handleDeleteSheet,
    resetSheetForm, setStage, setSamplingSub,
    linkSheetToDevRequest, unlinkSheetFromDevRequest,
    getDesignCost, initFromDevRequest, dropDesignSheet, restoreFromDrop,
    saveSheetAndRegisterFabric,
    getBlankSheetInput: getInitialSheetInput, // 저장 안 한 변경 확인용 빈 양식 (새 설계서 기준)
  };
};
