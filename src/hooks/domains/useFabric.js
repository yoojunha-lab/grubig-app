import { useState, useRef } from 'react';
import { calculateGYd, smartRound, clampNum } from '../../utils/helpers';
import { DEFAULT_ETC_COSTS, makeDefaultEtcCosts } from '../../constants/common';

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
  const savingRef = useRef(false); // 저장 in-flight 가드 (빠른 더블클릭 중복 방지)
  
  const getInitialFabricInput = () => ({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', mcqYd: '', remarks: '',
    knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, dyeingFee: 8800, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
    losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
    marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
    // [신규 원가모델] 후가공(추가/삭제) + 기타비용 항목화(외관검사·이화학검사·운임) + 오퍼가격
    finishing: [],
    etcCosts: makeDefaultEtcCosts(),
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
      // [신규 원가모델] 레거시 원단 호환 — 없으면 기본값 시드
      finishing: Array.isArray(fabric.finishing) ? fabric.finishing : [],
      // etcCosts 없는 기존 원단은 표준 기본값(외관/이화학/운임) 시드
      etcCosts: (Array.isArray(fabric.etcCosts) && fabric.etcCosts.length) ? fabric.etcCosts : makeDefaultEtcCosts(),
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
  const getSafeTier = () => {
    const safeSide = { yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, riskAmtYd: 0, finalCostYd: 0, priceConverter: 0, priceBrand: 0, pricePerM: 0, pricePerKg: 0, lines: { material: [], knit: [], proc: [], etc: [] } };
    return { domestic: { ...safeSide }, export: { ...safeSide, lines: { material: [], knit: [], proc: [], etc: [] } }, requiredKg: 0 };
  };

  // ── [신규 원가 모델] 첨부 "가격정보" 표 방식 ─────────────────────────────────
  //  · 재료비 = Σ(원사 landed단가KRW/kg × 혼용률) × 가공중량(kg/yd)  (손실 부풀림 없음)
  //  · 편직 Loss = 재료비소계 × 편직loss%
  //  · 가공(염가공·후가공) Loss = (재료비소계 + 편직비소계) × 각 loss%  (모든 가공손실 동일 기준액)
  //  · 기타비용 = 항목별·구간별 원/yd
  //  · 판매마진 없음(영업/견적에서 결정). 위험마진(%)만 가산 → 영업 기준원가(finalCostYd)
  //  · 출력 단위 추가: /m(÷0.9144), /kg(×yd/kg)
  const calculateCost = (fabricData, overrideExchangeRate = null) => {
    if (!fabricData || !fabricData.yarns) return { avgYarnCostDomestic: 0, avgYarnCostExport: 0, effectiveGYd: 0, theoreticalGYd: 0, ydPerKg: 0, tier1k: getSafeTier(), tier3k: getSafeTier(), tier5k: getSafeTier(), missingYarnIds: [] };

    const round = Math.round;
    const fabricExchangeRate = overrideExchangeRate !== null ? Number(overrideExchangeRate) : (Number(globalExchangeRate) || 1450);
    const missingYarnIds = [];

    // === 재료비: 원사 라인별 landed 단가(KRW/kg) × 혼용률 (내수=관세포함, 수출=관세제외) ===
    let yarnCostDomestic = 0; let yarnCostExport = 0;
    const materialLines = []; // { name, wDomestic(=landed×ratio), wExport }
    (fabricData.yarns || []).forEach(slot => {
      if (!slot) return;
      const ratio = Number(slot.ratio) / 100;
      if (!(ratio > 0)) return;

      // [가설계서 전용] priceOverride = 최종 KRW/kg (관세/운임 미적용, 내수·수출 동일)
      const overrideRaw = slot.priceOverride;
      const overrideNum = Number(overrideRaw);
      const hasOverride = overrideRaw !== '' && overrideRaw !== undefined && overrideRaw !== null && Number.isFinite(overrideNum) && overrideNum > 0;
      if (hasOverride) {
        const w = overrideNum * ratio;
        yarnCostDomestic += w; yarnCostExport += w;
        materialLines.push({ name: '단가 직접입력', wDomestic: w, wExport: w });
        return;
      }
      if (!slot.yarnId) return;

      const realYarnId = String(slot.yarnId).split('::')[0];
      const yarn = (yarnLibrary || []).find(y => String(y.id) === String(realYarnId));
      if (yarn) {
        const sup = yarn.suppliers?.find(s => s.isDefault) || yarn.suppliers?.[0];
        if (sup) {
          const priceInKrw = sup.currency === 'USD' ? Number(sup.price || 0) * fabricExchangeRate : Number(sup.price || 0);
          const tariffAmt = priceInKrw * ((Number(sup.tariff) || 0) / 100);
          const freightAmt = Number(sup.freight) || 0;
          const wDom = (priceInKrw + tariffAmt + freightAmt) * ratio; // 관세 내수만
          const wExp = (priceInKrw + freightAmt) * ratio;             // 수출 관세 제외
          yarnCostDomestic += wDom; yarnCostExport += wExp;
          materialLines.push({ name: yarn.name || '원사', wDomestic: wDom, wExport: wExp });
        }
      } else {
        missingYarnIds.push(realYarnId); // 라이브러리에서 사라진 사종 — 경고 배너용
      }
    });

    const theoreticalGYd = calculateGYd(Number(fabricData.gsm || 0), Number(fabricData.widthFull || 0));
    const effectiveGYd = fabricData.costGYd && Number(fabricData.costGYd) > 0 ? Number(fabricData.costGYd) : theoreticalGYd;
    const weightPerYdKg = (effectiveGYd || 0) / 1000;

    const finishing = Array.isArray(fabricData.finishing) ? fabricData.finishing : [];
    const hasEtc = Array.isArray(fabricData.etcCosts) && fabricData.etcCosts.length > 0;
    const dyeingFee = Number(fabricData.dyeingFee || 0);

    // 한 mode(내수/수출)의 KRW 라인 분해 (손실 누적 가산식).
    // [변경] 중간 반올림 없이 정확값(소수)으로 계산 — 반올림은 최종원가(finalCostYd)에서만.
    const buildKRW = (tierKey, knittingFeeKg, useExport) => {
      const matLines = materialLines.map(m => ({ name: m.name, amt: (useExport ? m.wExport : m.wDomestic) * weightPerYdKg }));
      const matSub = matLines.reduce((s, l) => s + l.amt, 0);

      const knitFeeAmt = Number(knittingFeeKg || 0) * weightPerYdKg;
      const knitLossPct = Number(fabricData.losses?.[tierKey]?.knit || 0);
      const knitLossAmt = matSub * knitLossPct / 100;
      const knitSub = knitFeeAmt + knitLossAmt;

      const procBase = matSub + knitSub; // 가공 손실 기준액 = 재료비 + 편직비
      const dyeFeeAmt = dyeingFee * weightPerYdKg;
      const dyeLossPct = Number(fabricData.losses?.[tierKey]?.dye || 0);
      const dyeLossAmt = procBase * dyeLossPct / 100;
      const procLines = [{ name: '염가공료', amt: dyeFeeAmt }, { name: '염가공 Loss', amt: dyeLossAmt }];
      finishing.forEach(f => {
        const nm = f.name || '후가공';
        procLines.push({ name: nm, amt: Number(f.fee || 0) * weightPerYdKg });
        const lp = Number(f.lossPct || 0);
        if (lp > 0) procLines.push({ name: `${nm} Loss`, amt: procBase * lp / 100 });
      });
      const procSub = procLines.reduce((s, l) => s + l.amt, 0);

      // 기타비용: 항목별 구간별 값(원/yd). etcCosts 없는 기존 원단은 표준 기본값 적용.
      let etcLines;
      if (hasEtc) {
        etcLines = fabricData.etcCosts.map(e => ({ name: e.name || '기타', amt: Number(e.vals?.[tierKey] || 0) }));
      } else {
        etcLines = DEFAULT_ETC_COSTS.map(e => ({ name: e.name, amt: Number(e.vals?.[tierKey] || 0) }));
      }
      const etcSub = etcLines.reduce((s, l) => s + l.amt, 0);

      const total = matSub + knitSub + procSub + etcSub;
      const sumLossPct = knitLossPct + dyeLossPct + finishing.reduce((s, f) => s + Number(f.lossPct || 0), 0);
      return { matLines, matSub, knitFeeAmt, knitLossAmt, knitSub, procLines, procSub, etcLines, etcSub, total, sumLossPct };
    };

    // [변경] 판매마진(도매 단계)·brandExtra 제거 — 마진은 영업(견적)에서 결정.
    //   대신 '위험 마진(%)'만 원가에 가산 → 영업 기준원가(finalCostYd). 단일 %(원단당 1개).
    const riskPct = Number(fabricData.riskMarginPct || 0);
    const ydPerM = 1 / 0.9144;
    const perKgFactor = weightPerYdKg > 0 ? 1 / weightPerYdKg : 0; // /yd가 × (yd/kg) = /kg가

    const calcTier = (tierKey, knittingFeeKg, qty) => {
      const dom = buildKRW(tierKey, knittingFeeKg, false);
      // [표시 일관성] 순원가도 영업 기준원가와 같은 100원 단위로 반올림하고,
      //   위험마진 = 영업 기준원가 − 순원가 로 역산 → 세 값이 정확히 더해지고, 위험마진 0%면 순원가=영업 기준원가.
      //   finalCostYd(=견적 base) 값 자체는 기존과 동일(= smartRound(순원가×(1+위험%))).
      const domTotal = smartRound(dom.total, 'KRW');
      const domFinal = smartRound(dom.total * (1 + riskPct / 100), 'KRW'); // 영업 기준원가
      const domRiskAmt = domFinal - domTotal;

      const exp = buildKRW(tierKey, knittingFeeKg, true);
      const expUSDraw = fabricExchangeRate > 0 ? exp.total / fabricExchangeRate : 0;
      const expTotal = smartRound(expUSDraw, 'USD');
      const expFinal = smartRound(expUSDraw * (1 + riskPct / 100), 'USD');
      const expRiskAmt = Number((expFinal - expTotal).toFixed(2));

      return {
        domestic: {
          yarnCostYd: dom.matSub, knitCostYd: dom.knitSub, dyeCostYd: dom.procSub, extraFeeYd: dom.etcSub,
          totalCostYd: domTotal, riskAmtYd: domRiskAmt, finalCostYd: domFinal,
          // 판매가가 아니라 '영업 기준원가'(판매마진은 견적에서 적용). 견적/리스트 호환 위해 필드명 유지.
          priceConverter: domFinal, priceBrand: domFinal,
          pricePerM: smartRound(domFinal * ydPerM, 'KRW'), pricePerKg: smartRound(domFinal * perKgFactor, 'KRW'),
          lines: { material: dom.matLines, knit: [{ name: '편직', amt: dom.knitFeeAmt }, { name: '편직 Loss', amt: dom.knitLossAmt }], proc: dom.procLines, etc: dom.etcLines },
        },
        export: {
          yarnCostYd: exp.matSub / (fabricExchangeRate || 1), knitCostYd: exp.knitSub / (fabricExchangeRate || 1), dyeCostYd: exp.procSub / (fabricExchangeRate || 1), extraFeeYd: exp.etcSub / (fabricExchangeRate || 1),
          totalCostYd: expTotal, riskAmtYd: expRiskAmt, finalCostYd: expFinal,
          priceConverter: expFinal, priceBrand: expFinal,
          pricePerM: Number((expFinal * ydPerM).toFixed(2)), pricePerKg: Number((expFinal * perKgFactor).toFixed(2)),
          // [수정] 수출 모드 라인 금액도 USD로 환산 (소계는 USD인데 라인만 KRW였던 통화 불일치 해소)
          lines: {
            material: exp.matLines.map(l => ({ ...l, amt: l.amt / (fabricExchangeRate || 1) })),
            knit: [{ name: '편직', amt: exp.knitFeeAmt / (fabricExchangeRate || 1) }, { name: '편직 Loss', amt: exp.knitLossAmt / (fabricExchangeRate || 1) }],
            proc: exp.procLines.map(l => ({ ...l, amt: l.amt / (fabricExchangeRate || 1) })),
            etc: exp.etcLines.map(l => ({ ...l, amt: l.amt / (fabricExchangeRate || 1) })),
          },
        },
        requiredKg: round(qty * weightPerYdKg * (1 + dom.sumLossPct / 100)),
      };
    };

    return {
      avgYarnCostDomestic: Math.round(yarnCostDomestic), avgYarnCostExport: Math.round(yarnCostExport),
      effectiveGYd, theoreticalGYd, ydPerKg: perKgFactor,
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
