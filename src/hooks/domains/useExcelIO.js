import { findKnitGrade, findProcessType, resolveKnitKgRate, isImportSupplier, findImportCountry, sumYarnRatio, isYarnRatioComplete } from '../../utils/costModel';
import { DEFAULT_KNIT_GRADE_ID, DEFAULT_KNIT_KG_RATE, DEFAULT_PROCESS_TYPE_ID } from '../../constants/costing';
import { readFirstSheetRows, isBlankCell, parseNumCell, parsePercentCell, parseYesCell, parseNoCell, parseCurrencyCell } from '../../utils/excelIO';
import { todayLocalISO } from '../../utils/helpers';

// GRUBIG ERP - 원단·원사 엑셀 (백업 · 일괄 등록 양식 · 일괄 등록)
//  · App.jsx에서 그대로 옮김 (2026-10-06 — 동작 같음). 칸 읽기는 utils/excelIO.js
//  · 규칙: docs/costing-model.md §4-A (원사 업로드 = 등록 + 고치기, 원단 업로드 규칙)
export const useExcelIO = ({
  isXlsxReady, costSettings, showToast, saveBatchToCloud,
  savedFabrics, setSavedFabrics, yarnLibrary, setYarnLibrary,
  fileInputRef, yarnFileInputRef, setIsBulkModalOpen, setIsYarnBulkModalOpen,
}) => {
  // 원단 원사 칸의 원사 이름 (엑셀 백업용) — 원사 이름만. 예전엔 '이름 [업체]'로 나가서 그 파일을 다시 올리면 원사를 못 찾았음.
  //  라이브러리에 없는 원사(엑셀 등록 때 못 찾은 원사)는 그때 적은 이름
  const yarnNameOfSlot = (slot) => {
    if (!slot?.yarnId) return '';
    const yId = String(slot.yarnId).split('::')[0];
    const yarn = yarnLibrary.find(y => String(y.id) === yId);
    return yarn ? yarn.name : (slot.tempName || yId.replace(/^UNREGISTERED_/, ''));
  };

  const handleBackupFabrics = () => {
    if (!isXlsxReady) return;
    const dataToExport = savedFabrics.map(f => {
      const slots = Array.isArray(f.yarns) ? f.yarns : [];
      const yarnCols = {};
      for (let i = 0; i < 4; i++) {
        yarnCols[`Yarn${i + 1}_Name`] = yarnNameOfSlot(slots[i]);
        yarnCols[`Yarn${i + 1}_Ratio`] = Number(slots[i]?.ratio) || 0;
      }
      return {
        Article: f.article, ItemName: f.itemName, WidthFull: f.widthFull, WidthCut: f.widthCut, GSM: f.gsm, CostGYd: f.costGYd,
        // [원가 개편] 편직 난이도·가공 유형은 이름으로 (엑셀 일괄 등록 양식과 같은 열)
        KnitGrade: findKnitGrade(costSettings, f.knitGrade).name, KnitKgRate: resolveKnitKgRate(f),
        ProcessType: findProcessType(costSettings, f.processType).name, DyeingFee: f.dyeingFee,
        RiskMarginPct: Number(f.riskMarginPct || 0), Remarks: f.remarks || '',
        ...yarnCols,
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(dataToExport); const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원단백업"); window.XLSX.writeFile(wb, `Fabric_Backup_${todayLocalISO()}.xlsx`);
  };

  const handleBackupYarns = () => {
    if (!isXlsxReady) return;
    // Import: 수입사 'Y' / ImportCountry: 수입 국가 이름 (원가 설정) — 원사 엑셀 등록 양식과 같은 열
    const dataToExport = yarnLibrary.flatMap(y =>
      (y.suppliers || []).map(s => ({
        Category: y.category, Name: y.name, Supplier: s.name, Currency: s.currency, Price: s.price, Tariff: s.tariff, Freight: s.freight || 0,
        Import: isImportSupplier(s) ? 'Y' : '', ImportCountry: isImportSupplier(s) ? findImportCountry(costSettings, s.importCountry).name : '',
        IsDefault: s.isDefault ? 'Y' : '', Remarks: y.remarks,
      }))
    );
    const ws = window.XLSX.utils.json_to_sheet(dataToExport); const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원사백업"); window.XLSX.writeFile(wb, `Yarn_Backup_${todayLocalISO()}.xlsx`);
  };

  // [원가 개편 2026-10] 편직 난이도(KnitGrade: A/B…)·편직 kg단가·가공 유형(ProcessType: 일반/스판물/기모물…) 열.
  //   예전 양식(KnittingFee1k~5k·KnitLoss·DyeLoss 등)으로 올려도 등록됨 — kg단가는 KnittingFee5k로 대신 채움
  const EXCEL_HEADERS = ['Article', 'ItemName', 'WidthFull', 'WidthCut', 'GSM', 'CostGYd', 'KnitGrade', 'KnitKgRate', 'ProcessType', 'DyeingFee', 'RiskMarginPct', 'Remarks', 'Yarn1_Name', 'Yarn1_Ratio', 'Yarn2_Name', 'Yarn2_Ratio', 'Yarn3_Name', 'Yarn3_Ratio', 'Yarn4_Name', 'Yarn4_Ratio'];

  const handleDownloadTemplate = () => {
    if (!isXlsxReady) return;
    const exampleRow = ['SAMPLE-01', 'Cotton Jersey', 58, 56, 300, 320, 'A', 2000, '일반', 8800, 0, '바이어 요청 샘플', 'CM 30S', 100, '', 0, '', 0, '', 0];
    const ws = window.XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, exampleRow]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원단일괄등록");
    window.XLSX.writeFile(wb, '원단등록_양식_상세.xlsx', { bookType: 'xlsx', type: 'binary' });
  };

  const handleFileUpload = (e) => {
    if (!isXlsxReady || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // 칸 읽기는 utils/excelIO — '320g'·'18,000'·'8%'·% 서식 칸도 읽음, 빈 칸은 null
        const rows = readFirstSheetRows(window.XLSX, evt.target.result);
        if (rows.length === 0) { showToast('데이터가 없습니다.', 'error'); return; }

        const newFabrics = []; let missingYarnNames = new Set();
        // [원가 개편] 편직 난이도·가공 유형은 이름(A, 스판물 …)으로 받아 원가 설정의 id로 바꿈. 모르는 이름은 기본값(A·일반)
        const unknownCostNames = new Set();
        const findIdByName = (list, name, fallbackId, label) => {
          const key = String(name ?? '').trim().toUpperCase();
          if (!key) return fallbackId;
          const hit = list.find(x => String(x.name).trim().toUpperCase() === key || String(x.id).toUpperCase() === key);
          if (!hit) unknownCostNames.add(`${label} '${String(name).trim()}'`);
          return hit ? hit.id : fallbackId;
        };
        // 원사 이름으로 찾기 — 예전 백업 파일의 '이름 [업체]'도 이름만 떼서 찾음
        const findYarnByName = (key) => {
          const byName = (k) => yarnLibrary.find(y => String(y.name || '').trim().toUpperCase() === k);
          const plain = key.replace(/\s*\[[^\]]*\]$/, '');
          return byName(key) || (plain !== key ? byName(plain) : undefined);
        };
        const positiveOr = (v, fallback) => (v > 0 ? v : fallback);
        // [중복 차단] 기존 원단 + 이번 업로드 내 중복 Article 모두 건너뜀 (대소문자/공백 무시)
        const existingArticleKeys = new Set((savedFabrics || []).map(f => String(f.article || '').trim().toUpperCase()));
        const batchArticleKeys = new Set();
        let dupSkipped = 0;
        // [원가 확인] 혼용률 합계가 100%가 아닌 행은 등록하지 않음 (원단 등록 화면과 같은 규칙 — 대표님 결정 2026-10-03)
        const ratioSkipped = [];
        rows.forEach(({ raw: row, text }, idx) => {
          const artKey = String(row.Article ?? '').trim().toUpperCase();
          if (!artKey) return;
          if (existingArticleKeys.has(artKey) || batchArticleKeys.has(artKey)) { dupSkipped++; return; }
          batchArticleKeys.add(artKey);
          let mappedYarns = [];
          const rowMissingYarns = [];
          let ratioOutOfRange = false;
          for (let i = 1; i <= 4; i++) {
            const yName = String(row[`Yarn${i}_Name`] ?? '').trim().toUpperCase();
            // 혼용률: '35%'·% 서식 칸도 읽음. 0~100 밖이면 그 행은 등록 안 함 (-10 + 110 처럼 합계만 100이 되는 경우 막기)
            const yRatio = parsePercentCell(row[`Yarn${i}_Ratio`], text[`Yarn${i}_Ratio`]) ?? 0;
            if (yRatio < 0 || yRatio > 100) ratioOutOfRange = true;
            if (yName) {
              const found = findYarnByName(yName);
              if (found) {
                mappedYarns.push({ yarnId: found.id, ratio: yRatio });
              } else {
                rowMissingYarns.push(yName);
                // DB에 일단 가짜 yarn 이름 정보라도 쑤셔넣어서 나중에 '수정'할 때 매칭시킬 수 있게 배려
                mappedYarns.push({ yarnId: `UNREGISTERED_${yName}`, ratio: yRatio, tempName: yName });
              }
            } else { mappedYarns.push({ yarnId: '', ratio: 0 }); }
          }
          if (ratioOutOfRange || !isYarnRatioComplete(mappedYarns)) {
            ratioSkipped.push(`${artKey} (${ratioOutOfRange ? '0~100% 밖의 값' : `합계 ${sumYarnRatio(mappedYarns)}%`})`);
            batchArticleKeys.delete(artKey); // 아래에 같은 Article이 올바른 비율로 또 있으면 그 행은 등록되게
            return;
          }
          rowMissingYarns.forEach(n => missingYarnNames.add(n));
          // 예전 양식 열(LOSS %) — 빈 칸이면 null → 기본값
          const getLoss = (field) => parsePercentCell(row[field], text[field]);
          const costGYd = parseNumCell(row.CostGYd);
          const dyeingFee = parseNumCell(row.DyeingFee);
          const numOr = (field, fallback) => parseNumCell(row[field]) ?? fallback;

          newFabrics.push({
            // [기획오류 #10 수정] ID를 문자열(fab_)로 통일
            id: `fab_${Date.now()}_${idx}`, date: new Date().toLocaleDateString(),
            article: artKey, itemName: String(row.ItemName ?? '').trim(), remarks: String(row.Remarks ?? '').trim(),
            widthFull: positiveOr(parseNumCell(row.WidthFull), 58), widthCut: positiveOr(parseNumCell(row.WidthCut), 56),
            gsm: positiveOr(parseNumCell(row.GSM), 300), costGYd: costGYd > 0 ? costGYd : '',
            knitGrade: findIdByName(costSettings.knitGrades, row.KnitGrade, DEFAULT_KNIT_GRADE_ID, '편직 난이도'),
            knitKgRate: positiveOr(parseNumCell(row.KnitKgRate), positiveOr(parseNumCell(row.KnittingFee5k), positiveOr(parseNumCell(row.KnittingFee3k), DEFAULT_KNIT_KG_RATE))),
            knitKgRateTiers: [],
            processType: findIdByName(costSettings.processTypes, row.ProcessType, DEFAULT_PROCESS_TYPE_ID, '가공 유형'),
            riskMarginPct: Math.max(0, parsePercentCell(row.RiskMarginPct, text.RiskMarginPct) ?? 0),
            etcCosts: [],
            // 염가공료: 0(염색 없음)은 0 그대로, 빈 칸만 기본 8,800원 (예전엔 0을 넣어도 8,800이 됐음)
            dyeingFee: dyeingFee === null ? 8800 : Math.max(0, dyeingFee),
            knittingFee1k: positiveOr(parseNumCell(row.KnittingFee1k), 3000), knittingFee3k: positiveOr(parseNumCell(row.KnittingFee3k), 2000), knittingFee5k: positiveOr(parseNumCell(row.KnittingFee5k), 2000),
            extraFee1k: positiveOr(parseNumCell(row.ExtraFee1k), 900), extraFee3k: positiveOr(parseNumCell(row.ExtraFee3k), 700), extraFee5k: positiveOr(parseNumCell(row.ExtraFee5k), 500),
            losses: {
              tier1k: { knit: getLoss('KnitLoss1k') ?? 5, dye: getLoss('DyeLoss1k') ?? 10 },
              tier3k: { knit: getLoss('KnitLoss3k') ?? 3, dye: getLoss('DyeLoss3k') ?? 10 },
              tier5k: { knit: getLoss('KnitLoss5k') ?? 3, dye: getLoss('DyeLoss5k') ?? 9 }
            },
            marginTier: numOr('MarginTier', 3),
            brandExtra: {
              tier1k: numOr('BrandExtra1k', 1000),
              tier3k: numOr('BrandExtra3k', 700),
              tier5k: numOr('BrandExtra5k', 500)
            },
            yarns: mappedYarns
          });
        });

        const ratioNote = ratioSkipped.length > 0
          ? `\n\n⛔ 원사 혼용률이 맞지 않아(합계 100% 아님 · 0~100% 밖) 등록하지 않은 원단 ${ratioSkipped.length}건 (엑셀에서 비율을 고친 뒤 다시 올려 주세요):\n${ratioSkipped.join(', ')}`
          : '';

        // 유효 신규 건이 없으면 (전부 중복/빈값/혼용률 오류) 저장하지 않고 안내
        if (newFabrics.length === 0) {
          if (ratioNote) alert(`등록할 원단이 없습니다.${dupSkipped > 0 ? `\n\n⚠️ 중복 Article ${dupSkipped}건은 건너뛰었습니다.` : ''}${ratioNote}`);
          else showToast(dupSkipped > 0 ? `모든 행이 중복 Article이라 등록하지 않았습니다. (${dupSkipped}건)` : '등록할 데이터가 없습니다.', 'error');
          return;
        }

        // 저장 성공 여부 확인 후 UI 후처리 (await 누락으로 거짓 성공 방지)
        const ok = await saveBatchToCloud('fabrics', newFabrics);
        if (!ok) {
          // 실패: 모달 유지 + 로컬 state 롤백 (낙관적 업데이트 방지)
          return;
        }
        setSavedFabrics([...newFabrics, ...savedFabrics]);
        setIsBulkModalOpen(false);

        const dupNote = dupSkipped > 0 ? `\n\n⚠️ 중복 Article ${dupSkipped}건은 건너뛰었습니다.` : '';
        const costNameNote = unknownCostNames.size > 0
          ? `\n\n⚠️ 원가 설정에 없는 이름은 기본값(난이도 A · 가공 일반)으로 등록했습니다:\n${[...unknownCostNames].join(', ')}`
          : '';
        if (missingYarnNames.size > 0) {
          alert(`✅ 총 ${newFabrics.length}건이 성공적으로 등록되었습니다.${dupNote}${costNameNote}${ratioNote}\n\n⚠️ 주의: 다음 원사 정보가 아직 라이브러리에 없어서 임시 텍스트로 등록되었습니다.\n해당 원단들은 '원가 확인 필요'로 표시되고 그 원사 값이 0원으로 계산되니,\n원사 라이브러리에 아래 원사들을 추가하시거나 원단을 수정해주세요.\n\n[미등록 원사 목록]\n${[...missingYarnNames].join(', ')}`);
        } else if (costNameNote || ratioNote) {
          alert(`✅ 총 ${newFabrics.length}건이 등록되었습니다.${dupNote}${costNameNote}${ratioNote}`);
        } else {
          showToast(`${newFabrics.length}건이 등록되었습니다.${dupSkipped > 0 ? ` (중복 ${dupSkipped}건 건너뜀)` : ''}`, 'success');
        }
      } catch (err) {
        alert(`엑셀 업로드 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        // 성공·실패 모두 파일 칸 비우기 — 같은 파일을 고쳐서 다시 고를 수 있게 (예전엔 실패하면 같은 파일 선택이 무시됐음)
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  // Import: 수입사면 'Y' (운반비는 원가 설정의 국가별 kg 구간 → Freight 열은 수입 해제 시에만 사용).
  //   이미 있는 공급처는 빈 칸이면 그대로, 'N'이면 국내로. 새 공급처는 빈 칸 = 국내
  // ImportCountry: 수입 국가 이름 (원가 설정) — 비우면 기본 국가(중국)·기존 나라 유지. 나라를 적으면 Import 칸이 비어도 수입사
  // IsDefault: 기본 공급처면 'Y' (원가 계산에 쓰는 공급처)
  const YARN_EXCEL_HEADERS = ['Category', 'Name', 'Supplier', 'Currency', 'Price', 'Tariff', 'Freight', 'Import', 'ImportCountry', 'IsDefault', 'Remarks'];
  const handleDownloadYarnTemplate = () => {
    if (!isXlsxReady) return;
    const ws = window.XLSX.utils.aoa_to_sheet([YARN_EXCEL_HEADERS, ['소모', '2/48 WOOL', 'XINAO', 'KRW', 18000, 8, 0, 'Y', '중국', 'Y', 'Standard']]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원사일괄등록");
    window.XLSX.writeFile(wb, '원사등록_양식.xlsx', { bookType: 'xlsx', type: 'binary' });
  };
  const handleYarnFileUpload = (e) => {
    if (!isXlsxReady || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // 칸 읽기는 utils/excelIO — '8%'·% 서식 관세, ' usd' 통화, TRUE·O·예 수입 표시도 읽음
        const rows = readFirstSheetRows(window.XLSX, evt.target.result);
        if (rows.length === 0) { showToast('데이터가 없습니다.', 'error'); return; }

        const defaultCountry = findImportCountry(costSettings); // 기본 수입 국가 (중국)
        const unknownCountries = new Set();
        const unknownCurrencies = new Set();
        const today = todayLocalISO(); // 단가 이력 날짜 — 원사 화면에서 고칠 때와 같은 형식
        // [중복 방지] 같은 이름 원사는 한 문서 — 라이브러리에 이미 있으면 그 원사에 공급처를 더하거나 값을 고침
        //  (예전엔 올릴 때마다 새 원사가 생겨, 백업 파일을 고쳐 다시 올리면 모든 원사가 두 개씩 됐음)
        const libraryByName = new Map();
        yarnLibrary.forEach(y => {
          const key = String(y.name || '').trim().toUpperCase();
          if (key && !libraryByName.has(key)) libraryByName.set(key, y); // 이름이 겹치면 앞의 것 (원단 등록이 찾는 것과 같음)
        });
        const touched = new Map(); // 이름 → { yarn, isNew, changed }
        let addedSuppliers = 0;
        let updatedSuppliers = 0;

        rows.forEach(({ raw: row, text }, idx) => {
          const name = String(row.Name ?? '').trim().toUpperCase();
          if (!name) return;
          let entry = touched.get(name);
          if (!entry) {
            const existing = libraryByName.get(name);
            entry = existing
              ? { yarn: { ...existing, suppliers: (existing.suppliers || []).map(s => ({ ...s })) }, isNew: false, changed: false }
              : { yarn: { id: `y${Date.now()}_${idx}`, category: '소모', name, remarks: '', suppliers: [] }, isNew: true, changed: true };
            touched.set(name, entry);
          }
          const { yarn } = entry;
          const category = String(row.Category ?? '').trim().toUpperCase();
          if (category && category !== String(yarn.category || '').toUpperCase()) { yarn.category = category; entry.changed = true; }
          const remarks = String(row.Remarks ?? '').trim();
          if (remarks && remarks !== String(yarn.remarks || '')) { yarn.remarks = remarks; entry.changed = true; }

          // 수입사: Import 칸(Y·TRUE·O·예…)이거나 수입 국가를 적었으면. 기존 공급처는 Import 칸이 비면 그대로, N이면 국내로
          const countryText = String(row.ImportCountry ?? '').trim();
          const isImport = parseYesCell(row.Import) || countryText !== '';
          const importOff = !isImport && parseNoCell(row.Import);
          let importCountry = '';
          if (isImport) {
            const countryKey = countryText.toUpperCase();
            const hit = countryKey
              ? costSettings.importCountries.find(c => c.name.trim().toUpperCase() === countryKey || c.id.toUpperCase() === countryKey)
              : null;
            if (countryKey && !hit) unknownCountries.add(countryText);
            importCountry = (hit || defaultCountry).id;
          }
          // 통화: 비면 KRW(기존 공급처는 그대로), 모르는 값이면 KRW(기존 공급처는 그대로) + 안내
          const parsedCurrency = parseCurrencyCell(row.Currency);
          if (!parsedCurrency) unknownCurrencies.add(String(row.Currency).trim());
          const price = parseNumCell(row.Price);
          const tariff = parsePercentCell(row.Tariff, text.Tariff);
          const freight = parseNumCell(row.Freight);
          const supName = String(row.Supplier ?? '').trim().toUpperCase() || '기본업체';

          let sup = yarn.suppliers.find(s => String(s.name || '').trim().toUpperCase() === supName);
          if (!sup) {
            const p = Math.max(0, price ?? 0);
            sup = {
              id: `sup_${Date.now()}_${idx}`, name: supName, currency: parsedCurrency || 'KRW', price: p,
              tariff: Math.max(0, tariff ?? 8), freight: Math.max(0, freight ?? 0),
              isImport, ...(isImport ? { importCountry } : {}),
              history: [{ date: today, price: p }],
              isDefault: false,
            };
            yarn.suppliers.push(sup);
            entry.changed = true;
            if (!entry.isNew) addedSuppliers++;
          } else {
            // 이미 있는 공급처 — 값을 적은 칸만 고침 (빈 칸은 그대로). 단가가 바뀌면 단가 이력에 한 줄
            const before = JSON.stringify(sup);
            if (!isBlankCell(row.Currency) && parsedCurrency) sup.currency = parsedCurrency;
            if (price !== null && Math.max(0, price) !== Number(sup.price)) {
              sup.price = Math.max(0, price);
              sup.history = [{ date: today, price: sup.price }, ...(sup.history || [])]; // 최근 순 (원사 화면과 같음)
            }
            if (tariff !== null) sup.tariff = Math.max(0, tariff);
            if (freight !== null) sup.freight = Math.max(0, freight);
            if (isImport) {
              sup.isImport = true;
              // 나라를 적었으면 그 나라, 비었으면 기존 나라 유지 (없으면 기본 국가)
              if (countryText || !sup.importCountry) sup.importCountry = importCountry;
            } else if (importOff && isImportSupplier(sup)) {
              sup.isImport = false;
              delete sup.importCountry;
            }
            if (JSON.stringify(sup) !== before) { entry.changed = true; if (!entry.isNew) updatedSuppliers++; }
          }
          // 기본 공급처: IsDefault 칸이 Y면 그 공급처로 (예전엔 이 칸을 읽지 않고 늘 첫 공급처)
          if (parseYesCell(row.IsDefault) && !sup.isDefault) {
            yarn.suppliers.forEach(s => { s.isDefault = s === sup; });
            entry.changed = true;
          }
        });

        // 기본 공급처가 하나도 없으면 첫 공급처 (새 원사, 또는 기본이 없던 기존 원사)
        touched.forEach(entry => {
          const sups = entry.yarn.suppliers;
          if (sups.length > 0 && !sups.some(s => s.isDefault)) { sups[0].isDefault = true; entry.changed = true; }
        });

        const changedEntries = [...touched.values()].filter(en => en.changed);
        if (changedEntries.length === 0) { showToast('바뀐 내용이 없어요. (이미 같은 원사·공급처 값)', 'success'); return; }
        const toSave = changedEntries.map(en => en.yarn);
        // 저장 성공 여부 확인 후 UI 후처리
        const ok = await saveBatchToCloud('yarns', toSave);
        if (!ok) return;
        const savedById = new Map(toSave.map(y => [String(y.id), y]));
        const newYarns = changedEntries.filter(en => en.isNew).map(en => en.yarn);
        setYarnLibrary([...newYarns, ...yarnLibrary.map(y => savedById.get(String(y.id)) || y)]);
        setIsYarnBulkModalOpen(false);

        const updatedCount = changedEntries.length - newYarns.length;
        const summary = `새 원사 ${newYarns.length}건 등록${updatedCount > 0 ? ` · 기존 원사 ${updatedCount}건 업데이트 (공급처 추가 ${addedSuppliers} · 값 변경 ${updatedSuppliers})` : ''}`;
        const notes = [];
        if (unknownCountries.size > 0) {
          notes.push(`⚠️ 원가 설정에 없는 수입 국가는 '${defaultCountry.name}'(으)로 등록했습니다:\n${[...unknownCountries].join(', ')}\n\n국가를 추가하려면 원가 설정 → 8. 수입 원사 운반비에서 [국가 추가] 후 원사의 수입 국가를 바꿔 주세요.`);
        }
        if (unknownCurrencies.size > 0) {
          notes.push(`⚠️ 모르는 통화는 원화(KRW)로 등록했습니다: ${[...unknownCurrencies].join(', ')}\n(통화는 KRW 또는 USD만 써요)`);
        }
        if (notes.length > 0) alert(`✅ ${summary}\n\n${notes.join('\n\n')}`);
        else showToast(summary, 'success');
      } catch (err) {
        alert(`엑셀 업로드 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        // 성공·실패 모두 파일 칸 비우기 — 같은 파일을 고쳐서 다시 고를 수 있게
        if (yarnFileInputRef.current) yarnFileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  return {
    handleBackupFabrics, handleBackupYarns,
    handleDownloadTemplate, handleFileUpload,
    handleDownloadYarnTemplate, handleYarnFileUpload,
  };
};
