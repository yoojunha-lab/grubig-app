import { useState } from 'react';
import { calculateGYd, smartRound, applyGrossMargin, clampNum } from '../../utils/helpers';
import { MARGIN_TIERS } from '../../constants/common';

// GRUBIG ERP - 원단(Fabric) 도메인 로직 및 비용 계산 훅

// 수치 필드별 입력 범위 (음수/이상값 차단)
//   numeric clamp 표 — 입력 시점과 저장 시점 양쪽에서 사용
const FABRIC_NUM_RANGE = {
  gsm:           [0, 2000],
  widthFull:     [0, 200],
  widthCut:      [0, 200],
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

export const useFabric = (yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate, savedQuotes = []) => {
  const [editingFabricId, setEditingFabricId] = useState(null);
  const [expandedFabricId, setExpandedFabricId] = useState(null);
  
  const getInitialFabricInput = () => ({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', mcqYd: '', remarks: '',
    knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, dyeingFee: 8800, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
    losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
    marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
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
    setFabricInput({ 
      ...fabric, 
      remarks: String(fabric.remarks || ''), 
      losses: fabric.losses || { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } } 
    });
    setEditingFabricId(fabric.id); 
    if (setActiveTab) setActiveTab('calculator');
  };

  const handleSaveFabric = (setActiveTab) => {
    if (!fabricInput.article) { showToast("Article을 입력해주세요.", 'error'); return; }
    
    // [Phase 7 검증] 내폭은 외폭보다 클 수 없음
    if (Number(fabricInput.widthCut) > Number(fabricInput.widthFull)) {
      showToast("내폭(Cut)은 외폭(Full)보다 클 수 없습니다.", 'error');
      return;
    }

    // [기획오류 #6 수정] ID를 문자열(fab_)로 통일 — useDesignSheet의 registerFabricFromSheet와 동일한 포맷
    const itemToSave = { id: editingFabricId || `fab_${Date.now()}`, date: new Date().toLocaleDateString(), ...fabricInput };

    // 양방향 동기화 무한루프 방어:
    //   설계서 → 원단으로 동기화될 때 fabricInput에 `_syncedFromSheet=true` 마킹됨
    //   이 플래그가 있으면 저장 시 설계서를 역동기화하지 않음 (이미 설계서가 발신측이므로 루프 차단)
    //   itemToSave에 플래그 자체는 저장하지 않음 (DB에 남기지 않음)
    const wasSyncedFromSheet = !!fabricInput._syncedFromSheet;
    delete itemToSave._syncedFromSheet;

    saveDocToCloud('fabrics', itemToSave);

    // 사용자 직접 편집(=설계서 동기화가 아님)이고 연결된 설계서가 있을 때만 역동기화
    if (itemToSave.linkedSheetId && !wasSyncedFromSheet) {
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
                brandExtra: itemToSave.brandExtra ?? linkedSheet.costInput?.brandExtra
             },
             yarns: itemToSave.yarns || linkedSheet.yarns || [],
             updatedAt: new Date().toISOString()
          });
       }
    }

    resetFabricForm(); 
    if (setActiveTab) setActiveTab('list');
  };

  const handleDeleteFabric = async (id) => {
    // 견적(quotes)에서 사용 중인지 검사 — items[*].fabricId 또는 items[*].id (legacy) 모두 확인
    const usedInQuotes = (savedQuotes || []).filter(q =>
      (q.items || []).some(it => String(it.fabricId ?? it.id ?? '') === String(id))
    );
    const usedCount = usedInQuotes.length;
    const baseMsg = "정말로 이 원단을 삭제하시겠습니까? (이 결정은 되돌릴 수 없습니다.)";
    const warnMsg = usedCount > 0
      ? `⚠️ 이 원단은 견적 ${usedCount}건에서 사용 중입니다. (기존 견적 이력은 유지됩니다)\n\n${baseMsg}`
      : baseMsg;
    if (!window.confirm(warnMsg)) return;

    // [B2 수정] 삭제 전 연결된 설계서의 linkedFabricId를 해제 → 유령 참조 방지
    const fabric = (savedFabrics || []).find(f => f.id === id);
    if (fabric?.linkedSheetId && designSheets) {
      const linkedSheet = designSheets.find(s => String(s.id) === String(fabric.linkedSheetId));
      if (linkedSheet?.linkedFabricId && String(linkedSheet.linkedFabricId) === String(id)) {
        saveDocToCloud('designSheets', {
          ...linkedSheet,
          linkedFabricId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }
    try {
      await deleteDocFromCloud('fabrics', id);
      showToast("삭제되었습니다.", "success");
    } catch (e) {
      // deleteDocFromCloud 내부에서 일반 토스트가 표시되지만, 명시적 fallback도 추가 (L3)
      showToast(`삭제 실패: ${e?.message || '네트워크 오류'}`, 'error');
    }
  };

  // ----------------------------------------------------------------------
  // 원가 계산 (Cost Calculation) 핵심 로직
  // ----------------------------------------------------------------------
  const getSafeTier = () => ({
    domestic: { yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, priceConverter: 0, priceBrand: 0 },
    export: { yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, priceConverter: 0, priceBrand: 0 },
    requiredKg: 0
  });

  const calculateCost = (fabricData, overrideExchangeRate = null) => {
    if (!fabricData || !fabricData.yarns) return { avgYarnCostDomestic: 0, avgYarnCostExport: 0, effectiveGYd: 0, theoreticalGYd: 0, tier1k: getSafeTier(), tier3k: getSafeTier(), tier5k: getSafeTier(), missingYarnIds: [] };

    let yarnCostDomestic = 0; let yarnCostExport = 0;
    const fabricExchangeRate = overrideExchangeRate !== null ? Number(overrideExchangeRate) : (Number(globalExchangeRate) || 1450);
    // 라이브러리에서 찾지 못한 yarnId 추적 — UI에서 경고 배너로 노출
    const missingYarnIds = [];

    (fabricData.yarns || []).forEach(slot => {
      // Optional Chaining 도입으로 방어적 코드 작성
      if (slot?.yarnId && Number(slot.ratio) > 0) {
        const realYarnId = String(slot.yarnId).split('::')[0];
        const yarn = (yarnLibrary || []).find(y => String(y.id) === String(realYarnId));
        if (yarn) {
          const sup = yarn.suppliers?.find(s => s.isDefault) || yarn.suppliers?.[0];
          if (sup) {
            const ratio = Number(slot.ratio) / 100;
            let priceInKrw = sup.currency === 'USD' ? Number(sup.price || 0) * fabricExchangeRate : Number(sup.price || 0);
            const tariffAmt = priceInKrw * ((Number(sup.tariff) || 0) / 100);
            const freightAmt = Number(sup.freight) || 0;
            // 관세는 내수(Domestic)에만 포함, 수출(Export)에는 미포함
            yarnCostExport += (priceInKrw + freightAmt) * ratio;
            yarnCostDomestic += (priceInKrw + tariffAmt + freightAmt) * ratio;
          }
        } else {
          // 라이브러리에서 사라진 사종 — silent failure 방지용으로 기록
          missingYarnIds.push(realYarnId);
        }
      }
    });

    const theoreticalGYd = calculateGYd(Number(fabricData.gsm || 0), Number(fabricData.widthFull || 0));
    const effectiveGYd = fabricData.costGYd && Number(fabricData.costGYd) > 0 ? Number(fabricData.costGYd) : theoreticalGYd;
    const weightPerYdKg = (effectiveGYd || 1) / 1000;

    const EXTRA_FEE_KEY = { tier1k: 'extraFee1k', tier3k: 'extraFee3k', tier5k: 'extraFee5k' };

    const calcTier = (tierKey, knittingFeeKg, qty) => {
      const specificLoss = fabricData.losses?.[tierKey] || { knit: 0, dye: 0 };
      const totalLossRate = (Number(specificLoss.knit || 0) + Number(specificLoss.dye || 0)) / 100;
      const safeLossRate = totalLossRate >= 1 ? 0.99 : totalLossRate;

      const extraFee = Number(fabricData[EXTRA_FEE_KEY[tierKey]]) || 0;

      const costKnitYd = (Number(knittingFeeKg || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costDyeYd = (Number(fabricData.dyeingFee || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdDomestic = (yarnCostDomestic / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdExport = (yarnCostExport / (1 - safeLossRate)) * weightPerYdKg;

      const totalCostYdDomesticKRW = costYarnYdDomestic + costKnitYd + costDyeYd + extraFee;
      const totalCostYdExportKRW = costYarnYdExport + costKnitYd + costDyeYd + extraFee;

      const marginPct = MARGIN_TIERS[fabricData.marginTier ?? 3] ?? 19;
      const brandEx = Number(fabricData.brandExtra?.[tierKey] || 0);

      const domesticPriceConv = applyGrossMargin(totalCostYdDomesticKRW, marginPct);
      const domesticPriceBrand = domesticPriceConv + brandEx;
      const totalCostYdExportUSD = totalCostYdExportKRW / fabricExchangeRate;
      const exportPriceConv = applyGrossMargin(totalCostYdExportUSD, marginPct);
      const exportPriceBrand = exportPriceConv + (brandEx / fabricExchangeRate);

      return {
        domestic: { yarnCostYd: costYarnYdDomestic, knitCostYd: costKnitYd, dyeCostYd: costDyeYd, extraFeeYd: extraFee, totalCostYd: Math.round(totalCostYdDomesticKRW), priceConverter: smartRound(domesticPriceConv, 'KRW'), priceBrand: smartRound(domesticPriceBrand, 'KRW') },
        export: { yarnCostYd: costYarnYdExport / fabricExchangeRate, knitCostYd: costKnitYd / fabricExchangeRate, dyeCostYd: costDyeYd / fabricExchangeRate, extraFeeYd: extraFee / fabricExchangeRate, totalCostYd: Number(totalCostYdExportUSD.toFixed(2)), priceConverter: smartRound(exportPriceConv, 'USD'), priceBrand: smartRound(exportPriceBrand, 'USD') },
        requiredKg: Math.round((qty * weightPerYdKg) / (1 - safeLossRate))
      };
    };

    return {
      avgYarnCostDomestic: Math.round(yarnCostDomestic), avgYarnCostExport: Math.round(yarnCostExport),
      effectiveGYd, theoreticalGYd,
      tier1k: calcTier('tier1k', fabricData.knittingFee1k, 1000),
      tier3k: calcTier('tier3k', fabricData.knittingFee3k, 3000),
      tier5k: calcTier('tier5k', fabricData.knittingFee5k, 5000),
      missingYarnIds,
    };
  };

  const getMergedYarnName = (slotId) => {
    if (!slotId) return '';
    const yId = String(slotId).split('::')[0];
    const yarn = yarnLibrary.find(y => String(y.id) === String(yId));
    if (!yarn) return '';
    const sup = yarn.suppliers?.find(s => s.isDefault) || yarn.suppliers?.[0];
    return sup ? `${yarn.name} [${sup.name}]` : yarn.name;
  };

  return {
    fabricInput, setFabricInput,
    editingFabricId, expandedFabricId, setExpandedFabricId,
    handleFabricChange, handleNestedChange, handleYarnSlotChange,
    handleSaveFabric, handleEditFabric, handleDeleteFabric, resetFabricForm,
    calculateCost, getMergedYarnName
  };
};
