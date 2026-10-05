import { useState, useRef, useEffect, useCallback } from 'react';
import { clampNum } from '../../utils/helpers';
import { calculateCostTiers, computeCostAtQty, resolveKnitKgRate, normalizeExtraCosts } from '../../utils/costModel';
import { DEFAULT_KNIT_GRADE_ID, DEFAULT_KNIT_KG_RATE, DEFAULT_PROCESS_TYPE_ID } from '../../constants/costing';

// GRUBIG ERP - 원단(Fabric) 도메인 로직 및 비용 계산 훅

// 원가 엔진에 넘기는 값 (원사 라이브러리 · 환율 · 원가 설정). 환율을 따로 주면(견적 환율 등) 그 값
const makeCostCtx = (yarnLibrary, globalExchangeRate, costSettings, overrideExchangeRate) => ({
  yarnLibrary,
  exchangeRate: overrideExchangeRate !== null ? Number(overrideExchangeRate) : (Number(globalExchangeRate) || 1450),
  settings: costSettings,
});

// 수치 필드별 입력 범위 (음수/이상값 차단)
//   numeric clamp 표 — 입력 시점과 저장 시점 양쪽에서 사용
const FABRIC_NUM_RANGE = {
  gsm:           [0, 2000],
  widthFull:     [0, 200],
  widthCut:      [0, 200],
  knitKgRate:    [0, Infinity],
  knittingFee1k: [0, Infinity],
  knittingFee3k: [0, Infinity],
  knittingFee5k: [0, Infinity],
  dyeingFee:     [0, Infinity],
  extraFee1k:    [0, Infinity],
  extraFee3k:    [0, Infinity],
  extraFee5k:    [0, Infinity],
};
// loss%는 0~99로 제한 (분모 0 방지). 한 tier의 knit+dye 합도 99 이하 권장이지만 개별 입력 단계에선 99까지
const LOSS_RANGE = [0, 99];
// brandExtra는 추가비용 — 음수 차단
const BRAND_EXTRA_RANGE = [0, Infinity];
// yarn ratio는 0~100
const RATIO_RANGE = [0, 100];

// 안전 숫자 변환 + 범위 clamp
const clampField = (name, value) => {
  const range = FABRIC_NUM_RANGE[name];
  if (!range) return value; // 비숫자 필드 그대로
  return clampNum(value, range[0], range[1]);
};

// costSettings: 원가 설정 (resolveCostSettings 결과 — 편직 정액·LOSS 구간·가공 유형·이화학·운임·외관검사)
export const useFabric = (yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate, savedQuotes = [], costSettings = null) => {
  const [editingFabricId, setEditingFabricId] = useState(null);
  const [expandedFabricId, setExpandedFabricId] = useState(null);
  const savingRef = useRef(false); // 저장 in-flight 가드 (빠른 더블클릭 중복 방지)
  // 삭제 확인·연결 정리에 쓰는 최신 목록 — 원단 행(memo)은 견적 목록이 바뀌어도 다시 그려지지 않아 옛 함수가 불릴 수 있음
  //  → 누른 순간의 최신 목록으로 판단 (옛 설계서 내용으로 덮어쓰는 일 방지). 그리기가 끝난 뒤 갱신
  const latestRef = useRef({ savedFabrics, designSheets, savedQuotes });
  useEffect(() => { latestRef.current = { savedFabrics, designSheets, savedQuotes }; });

  const getInitialFabricInput = () => ({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', mcqYd: '', remarks: '',
    // [원가 개편 2026-10] 편직비 = max(난이도 정액, 생지kg × kg단가), 가공 LOSS = 가공 유형별 (정액·LOSS는 원가 설정)
    knitGrade: DEFAULT_KNIT_GRADE_ID,   // 편직 난이도 (A/B…) → 정액
    knitKgRate: DEFAULT_KNIT_KG_RATE,   // 편직 kg단가 (원/kg)
    knitKgRateTiers: [],                // 구간 단가 [{ fromKg, rate }] — 예: 1,000kg 이상 1,800원
    processType: DEFAULT_PROCESS_TYPE_ID, // 가공 유형 (일반/스판물/기모물…) → 가공 LOSS
    dyeingFee: 8800,
    // (레거시 — 계산에 안 씀) 구간별 편직료·LOSS·extraFee·brandExtra. 기존 동기화 코드 호환용으로만 유지
    knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
    losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
    marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
    finishing: [],      // 후가공 [{ name, fee(원/kg), lossPct }]
    etcCosts: [],       // 품목별 추가비용 [{ id, name, perYd }] — 외관검사·이화학·운임은 원가 설정에서 공통 계산
    riskMarginPct: 0,   // 위험 마진(%) — 메인 전·위험 원단 추가 마진 (영업 기준원가에 가산)
    offerPrice: '',
    yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
  });

  const [fabricInput, setFabricInput] = useState(getInitialFabricInput);

  const handleFabricChange = (e) => {
    let { name, value } = e.target;
    if (name === 'article') value = String(value || '').toUpperCase();

    // 비숫자 필드는 그대로, 숫자 필드는 [min,max] 범위로 clamp
    // mcqYd / costGYd 는 빈 문자열 허용(비어있으면 자동 계산값 사용) → text로 취급
    const isText = name === 'article' || name === 'itemName' || name === 'costGYd' || name === 'mcqYd' || name === 'remarks';
    const finalValue = isText ? value : clampField(name, value);

    setFabricInput(prev => ({ ...prev, [name]: finalValue }));
  };

  // section: 'losses' | 'brandExtra' (수치 중첩 필드)
  // tier:    'tier1k' | 'tier3k' | 'tier5k'
  // field:   'knit' | 'dye' | null  (losses는 객체, brandExtra는 단일 숫자)
  const handleNestedChange = (section, tier, field, value) => {
    const range = section === 'losses' ? LOSS_RANGE : BRAND_EXTRA_RANGE;
    const safeNum = clampNum(value, range[0], range[1]);
    setFabricInput(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [tier]: field ? { ...prev[section][tier], [field]: safeNum } : safeNum
      }
    }));
  };

  const handleYarnSlotChange = (index, field, value) => {
    const newYarns = [...fabricInput.yarns];
    const safeValue = field === 'ratio'
      ? clampNum(value, RATIO_RANGE[0], RATIO_RANGE[1])
      : String(value || '');
    newYarns[index] = { ...newYarns[index], [field]: safeValue };
    setFabricInput({ ...fabricInput, yarns: newYarns });
  };

  const resetFabricForm = () => {
    setFabricInput(getInitialFabricInput());
    setEditingFabricId(null);
  };

  const handleEditFabric = (fabric, setActiveTab) => {
    const init = getInitialFabricInput();
    setFabricInput({
      ...fabric,
      remarks: String(fabric.remarks || ''),
      losses: fabric.losses || init.losses,
      // [방어] yarns 없는(레거시/손상) 원단도 안전하게 수정 — 기본 4슬롯 시드 (없으면 CalculatorPage에서 크래시)
      yarns: (Array.isArray(fabric.yarns) && fabric.yarns.length) ? fabric.yarns : init.yarns,
      // [원가 개편] 기존 품목 기본값: 난이도 A · 가공 유형 일반 · kg단가 = 기존 5,000YD 편직료
      knitGrade: fabric.knitGrade || DEFAULT_KNIT_GRADE_ID,
      knitKgRate: resolveKnitKgRate(fabric),
      knitKgRateTiers: Array.isArray(fabric.knitKgRateTiers) ? fabric.knitKgRateTiers : [],
      processType: fabric.processType || DEFAULT_PROCESS_TYPE_ID,
      finishing: Array.isArray(fabric.finishing) ? fabric.finishing : [],
      // 품목별 추가비용만 남김 (예전 외관검사·이화학·운임 기본 3항목은 원가 설정값으로 계산)
      etcCosts: normalizeExtraCosts(fabric.etcCosts),
      riskMarginPct: fabric.riskMarginPct ?? 0,
      offerPrice: fabric.offerPrice ?? ''
    });
    setEditingFabricId(fabric.id);
    if (setActiveTab) setActiveTab('calculator');
  };

  // 저장: 성공 시 true, 검증실패/중복호출/저장실패 시 false 반환 (워크스페이스 가드가 성공 여부로 이탈 결정)
  const handleSaveFabric = async (setActiveTab) => {
    if (savingRef.current) return false; // 저장 진행 중이면 무시 (빠른 더블클릭 중복 방지)
    if (!fabricInput.article) { showToast("Article을 입력해주세요.", 'error'); return false; }

    // [중복 차단] 같은 Article이 이미 원단 리스트에 있으면 저장 중단
    //   - 대소문자/앞뒤 공백 무시하고 비교
    //   - 수정 중일 땐 자기 자신(editingFabricId)은 제외
    const normalizedArticle = String(fabricInput.article || '').trim().toUpperCase();
    const isDuplicate = (savedFabrics || []).some(f =>
      String(f.id) !== String(editingFabricId) &&
      String(f.article || '').trim().toUpperCase() === normalizedArticle
    );
    if (isDuplicate) {
      showToast(`이미 등록된 Article입니다: ${normalizedArticle}`, 'error');
      return false;
    }

    // [Phase 7 검증] 내폭은 외폭보다 클 수 없음
    if (Number(fabricInput.widthCut) > Number(fabricInput.widthFull)) {
      showToast("내폭(Cut)은 외폭(Full)보다 클 수 없습니다.", 'error');
      return false;
    }

    // [기획오류 #6 수정] ID를 문자열(fab_)로 통일 — useDesignSheet의 registerFabricFromSheet와 동일한 포맷
    const itemToSave = { id: editingFabricId || `fab_${Date.now()}`, date: new Date().toLocaleDateString(), ...fabricInput };

    savingRef.current = true; // 검증 통과 → 저장 시작 (가드 잠금)
    try {
    const ok = await saveDocToCloud('fabrics', itemToSave);
    if (ok === false) return false; // 클라우드 저장 실패 → 후처리/폼리셋/이동 안 함

    // [양방향 동기화] 사용자가 원단을 직접 편집했고 연결된 설계서가 있으면 설계서로 역동기화한다.
    //   설계서 → 원단 동기화(useDesignSheet.handleSaveSheet)는 DB에 직접 쓰므로 이 핸들러를
    //   거치지 않는다. 즉 두 동기화 경로가 서로의 save 핸들러를 호출하지 않아 무한루프가 발생하지 않는다.
    if (itemToSave.linkedSheetId) {
       const linkedSheet = designSheets?.find(s => String(s.id) === String(itemToSave.linkedSheetId));
       if (linkedSheet) {
          saveDocToCloud('designSheets', {
             ...linkedSheet,
             // [기획오류 #7 수정] 원단→설계서 역방향 article/fabricName 동기화
             articleNo: itemToSave.article ?? linkedSheet.articleNo,
             fabricName: itemToSave.itemName ?? linkedSheet.fabricName,
             costInput: {
                ...linkedSheet.costInput,
                widthFull: itemToSave.widthFull ?? linkedSheet.costInput?.widthFull,
                widthCut: itemToSave.widthCut ?? linkedSheet.costInput?.widthCut,
                gsm: itemToSave.gsm ?? linkedSheet.costInput?.gsm,
                costGYd: itemToSave.costGYd ?? linkedSheet.costInput?.costGYd,
                knittingFee1k: itemToSave.knittingFee1k ?? linkedSheet.costInput?.knittingFee1k,
                knittingFee3k: itemToSave.knittingFee3k ?? linkedSheet.costInput?.knittingFee3k,
                knittingFee5k: itemToSave.knittingFee5k ?? linkedSheet.costInput?.knittingFee5k,
                dyeingFee: itemToSave.dyeingFee ?? linkedSheet.costInput?.dyeingFee,
                extraFee1k: itemToSave.extraFee1k ?? linkedSheet.costInput?.extraFee1k,
                extraFee3k: itemToSave.extraFee3k ?? linkedSheet.costInput?.extraFee3k,
                extraFee5k: itemToSave.extraFee5k ?? linkedSheet.costInput?.extraFee5k,
                losses: itemToSave.losses ?? linkedSheet.costInput?.losses,
                marginTier: itemToSave.marginTier ?? linkedSheet.costInput?.marginTier,
                brandExtra: itemToSave.brandExtra ?? linkedSheet.costInput?.brandExtra,
                // [원가 개편] 편직 난이도·kg단가·구간 단가·가공 유형
                knitGrade: itemToSave.knitGrade ?? linkedSheet.costInput?.knitGrade,
                knitKgRate: itemToSave.knitKgRate ?? linkedSheet.costInput?.knitKgRate,
                knitKgRateTiers: itemToSave.knitKgRateTiers ?? linkedSheet.costInput?.knitKgRateTiers,
                processType: itemToSave.processType ?? linkedSheet.costInput?.processType,
                // [신규 원가모델] 후가공·기타비용·위험마진도 동기화 (설계서는 costInput에 보관)
                finishing: itemToSave.finishing ?? linkedSheet.costInput?.finishing,
                etcCosts: itemToSave.etcCosts ?? linkedSheet.costInput?.etcCosts,
                riskMarginPct: itemToSave.riskMarginPct ?? linkedSheet.costInput?.riskMarginPct
             },
             yarns: itemToSave.yarns || linkedSheet.yarns || [],
             updatedAt: new Date().toISOString()
          });
       }
    }

    resetFabricForm();
    if (setActiveTab) setActiveTab('list');
    return true;
    } finally {
      savingRef.current = false;
    }
  };

  const handleDeleteFabric = async (id) => {
    const { savedFabrics: fabricsNow, designSheets: sheetsNow, savedQuotes: quotesNow } = latestRef.current;
    // 견적(quotes)에서 사용 중인지 — 기준 견적 items[*].fabricId(예전 견적은 items[*].id) + 별도 견적 customItems[*].fabricId
    const usedInQuotes = (quotesNow || []).filter(q =>
      [...(q.items || []), ...(q.customItems || [])].some(it => String(it.fabricId ?? it.id ?? '') === String(id))
    );
    const usedCount = usedInQuotes.length;
    // 연결된 설계서 — 지우면 연결이 풀리고, 아이템화 단계였으면 샘플 진행으로 돌아감 (아래 [B2])
    const fabric = (fabricsNow || []).find(f => f.id === id);
    const sheet = fabric?.linkedSheetId ? (sheetsNow || []).find(s => String(s.id) === String(fabric.linkedSheetId)) : null;
    const linkedSheet = sheet?.linkedFabricId && String(sheet.linkedFabricId) === String(id) ? sheet : null;
    const baseMsg = "정말로 이 원단을 삭제하시겠습니까? (이 결정은 되돌릴 수 없습니다.)";
    const notes = [];
    if (usedCount > 0) notes.push(`⚠️ 이 원단은 견적 ${usedCount}건에서 사용 중입니다. (기존 견적 이력은 유지됩니다)`);
    if (linkedSheet) notes.push(`🔗 연결된 설계서(${linkedSheet.fabricName || linkedSheet.articleNo || '이름 없음'})는 연결이 풀려요${linkedSheet.stage === 'articled' ? " — '샘플 진행' 단계로 돌아가요" : ''}.`);
    const warnMsg = notes.length > 0 ? `${notes.join('\n')}\n\n${baseMsg}` : baseMsg;
    if (!window.confirm(warnMsg)) return;

    // 먼저 지우고, 지워졌을 때만 설계서 연결 정리 (삭제가 실패했는데 연결만 끊기는 일 방지)
    //  deleteDocFromCloud는 실패 시 throw 하지 않고 false를 돌려줌 (실패 알림은 그쪽에서)
    const deleted = await deleteDocFromCloud('fabrics', id);
    if (deleted === false) return;

    // [B2 수정] 연결된 설계서의 linkedFabricId를 해제 → 유령 참조 방지
    if (linkedSheet) {
      const now = new Date().toISOString();
      // [연동 보호] 원단이 사라졌으므로, 아이템화 상태였다면 직전 단계(sampling)로 되돌린다.
      //   articled로 남으면 원단도 없는데 삭제/DROP이 막혀 설계서가 고립되므로,
      //   재편집·재등록이 가능한 상태로 복구한다.
      const wasArticled = linkedSheet.stage === 'articled';
      saveDocToCloud('designSheets', {
        ...linkedSheet,
        linkedFabricId: null,
        stage: wasArticled ? 'sampling' : linkedSheet.stage,
        stageEnteredAt: wasArticled
          ? { ...(linkedSheet.stageEnteredAt || {}), sampling: now }
          : linkedSheet.stageEnteredAt,
        updatedAt: now
      });
    }
    showToast("삭제되었습니다.", "success");
  };

  // ----------------------------------------------------------------------
  // 원가 계산 (Cost Calculation) — 계산식은 utils/costModel.js (docs/costing-model.md)
  //  · 편직비 = max(난이도 정액, 생지kg × kg단가), 편직 LOSS = 생지kg 구간, 가공 LOSS = 가공 유형별
  //  · 이화학·운임은 오더 총액 ÷ 수량, 외관검사는 YD당 (모두 원가 설정값)
  //  · 판매마진 없음(영업/견적에서 결정). 위험마진(%)만 가산 → 영업 기준원가(finalCostYd)
  // ----------------------------------------------------------------------
  //  두 함수는 원사 라이브러리·공통 환율·원가 설정이 바뀔 때만 새로 만듦 (useCallback)
  //  → 계산기 원가(useMemo)·모바일 카드 등이 그 사이엔 다시 계산하지 않음 (계산식은 그대로)

  // 원가 표용 구간 — 300·500·800YD(2컬러 기준) + 1,000·3,000·5,000YD(MCQ 충족 기준, tier1k/tier3k/tier5k)
  const calculateCost = useCallback((fabricData, overrideExchangeRate = null) =>
    calculateCostTiers(fabricData, makeCostCtx(yarnLibrary, globalExchangeRate, costSettings, overrideExchangeRate)),
  [yarnLibrary, globalExchangeRate, costSettings]);

  // 임의 수량(YD) 1개 — 나중에 '수량 직접 입력' 칸에서 바로 사용
  //  opts: { colors: 컬러수 가정, assumeMcq: 컬러마다 MCQ 충족 → 염색 최소 청구 없음 } (없으면 수량 구간 기본)
  const calculateCostAtQty = useCallback((fabricData, qty, overrideExchangeRate = null, opts = {}) =>
    computeCostAtQty(fabricData, qty, makeCostCtx(yarnLibrary, globalExchangeRate, costSettings, overrideExchangeRate), opts),
  [yarnLibrary, globalExchangeRate, costSettings]);

  return {
    fabricInput, setFabricInput,
    editingFabricId, expandedFabricId, setExpandedFabricId,
    handleFabricChange, handleNestedChange, handleYarnSlotChange,
    handleSaveFabric, handleEditFabric, handleDeleteFabric, resetFabricForm,
    calculateCost, calculateCostAtQty
  };
};
