import { useState } from 'react';
import { calculateGYd, smartRound, applyGrossMargin } from '../../utils/helpers';
import { MARGIN_TIERS } from '../../constants/common';

// GRUBIG ERP - 원단(Fabric) 도메인 로직 및 비용 계산 훅

export const useFabric = (yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate) => {
  const [editingFabricId, setEditingFabricId] = useState(null);
  const [expandedFabricId, setExpandedFabricId] = useState(null);
  
  const getInitialFabricInput = () => ({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', remarks: '',
    knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, dyeingFee: 8800, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
    losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
    marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
    yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
  });

  const [fabricInput, setFabricInput] = useState(getInitialFabricInput);

  const handleFabricChange = (e) => {
    let { name, value } = e.target;
    if (name === 'article') value = String(value || '').toUpperCase();

    setFabricInput(prev => ({ 
      ...prev, 
      [name]: (name === 'article' || name === 'itemName' || name === 'costGYd' || name === 'remarks') ? value : Number(value) 
    }));
  };

  const handleNestedChange = (section, tier, field, value) => { 
    setFabricInput(prev => ({ 
      ...prev, 
      [section]: { 
        ...prev[section], 
        [tier]: field ? { ...prev[section][tier], [field]: Number(value) } : Number(value) 
      } 
    })); 
  };

  const handleYarnSlotChange = (index, field, value) => { 
    const newYarns = [...fabricInput.yarns]; 
    newYarns[index] = { ...newYarns[index], [field]: field === 'ratio' ? Number(value) : String(value || '') }; 
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

    const itemToSave = { id: editingFabricId || Date.now(), date: new Date().toLocaleDateString(), ...fabricInput };

    // [B1 방어] _syncedFromSheet 플래그 제거 (저장 시 플래그가 남지 않도록)
    delete itemToSave._syncedFromSheet;

    saveDocToCloud('fabrics', itemToSave); 

    // [양방향 동기화 + B1 무한루프 방어] 
    // _syncedFromSheet 플래그가 있으면 설계서에서 트리거된 동기화이므로 다시 설계서를 업데이트하지 않음
    if (itemToSave.linkedSheetId && !fabricInput._syncedFromSheet) {
       const linkedSheet = designSheets?.find(s => String(s.id) === String(itemToSave.linkedSheetId));
       if (linkedSheet) {
          saveDocToCloud('designSheets', {
             ...linkedSheet,
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

  const handleDeleteFabric = (id) => {
    if (window.confirm("정말로 이 원단을 삭제하시겠습니까? (이 결정은 되돌릴 수 없습니다.)")) {
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
      deleteDocFromCloud('fabrics', id).then(() => {
        showToast("삭제되었습니다.", "success");
      });
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
    if (!fabricData || !fabricData.yarns) return { avgYarnCostDomestic: 0, avgYarnCostExport: 0, effectiveGYd: 0, theoreticalGYd: 0, tier1k: getSafeTier(), tier3k: getSafeTier(), tier5k: getSafeTier() };

    let yarnCostDomestic = 0; let yarnCostExport = 0;
    const fabricExchangeRate = overrideExchangeRate !== null ? Number(overrideExchangeRate) : (globalExchangeRate || 1450);

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
            yarnCostExport += (priceInKrw + freightAmt) * ratio;
            yarnCostDomestic += (priceInKrw + tariffAmt + freightAmt) * ratio;
          }
        }
      }
    });

    const theoreticalGYd = calculateGYd(Number(fabricData.gsm || 0), Number(fabricData.widthFull || 0));
    const effectiveGYd = fabricData.costGYd && Number(fabricData.costGYd) > 0 ? Number(fabricData.costGYd) : theoreticalGYd;
    const weightPerYdKg = (effectiveGYd || 1) / 1000;

    const calcTier = (tierKey, knittingFeeKg, qty) => {
      const specificLoss = fabricData.losses?.[tierKey] || { knit: 0, dye: 0 };
      const totalLossRate = (Number(specificLoss.knit || 0) + Number(specificLoss.dye || 0)) / 100;
      const safeLossRate = totalLossRate >= 1 ? 0.99 : totalLossRate;

      let extraFee = 0;
      if (tierKey === 'tier1k') extraFee = Number(fabricData.extraFee1k) || 0;
      if (tierKey === 'tier3k') extraFee = Number(fabricData.extraFee3k) || 0;
      if (tierKey === 'tier5k') extraFee = Number(fabricData.extraFee5k) || 0;

      const costKnitYd = (Number(knittingFeeKg || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costDyeYd = (Number(fabricData.dyeingFee || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdDomestic = (yarnCostDomestic / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdExport = (yarnCostExport / (1 - safeLossRate)) * weightPerYdKg;

      const totalCostYdDomesticKRW = costYarnYdDomestic + costKnitYd + costDyeYd + extraFee;
      const totalCostYdExportKRW = costYarnYdExport + costKnitYd + costDyeYd + extraFee;

      const marginPct = MARGIN_TIERS[fabricData.marginTier || 3] || 19;
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
