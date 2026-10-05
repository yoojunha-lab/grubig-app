// ============================================================
// 원단 목록 — PC 행(DesktopFabricRow)·모바일 카드(MobileFabricCard) 공통 계산 (2026-10-06 모음)
// ============================================================

/** 사용 원사 목록 (혼용률 있는 칸만) — [{ name, ratio }]. 라이브러리에 없으면 '미등록 원사' */
export const fabricYarnMix = (f, yarnLibrary) => (f?.yarns || [])
  .filter(y => y?.yarnId && y.ratio > 0)
  .map(y => {
    const realYarnId = String(y.yarnId).split('::')[0];
    const realYarn = (yarnLibrary || []).find(yl => String(yl.id) === String(realYarnId));
    return { name: realYarn?.name || '미등록 원사', ratio: y.ratio };
  });

/** 연결된 설계서 — 원단의 linkedSheetId 우선, 없으면 그 원단을 가리키는 설계서 */
export const findLinkedSheet = (f, designSheets) => (f?.linkedSheetId
  ? (designSheets || []).find(s => String(s.id) === String(f.linkedSheetId))
  : (designSheets || []).find(s => String(s.linkedFabricId) === String(f?.id)));
