# 개발 ▾ 고도화 — 의뢰 → 설계서 → 샘플 → 아이템화 (대표님 요청 2026-11-24)

> 대표님: "개발 고도화 좀 시켜줘" → 개발 메뉴 화면 5개(메인/QC 디테일 시트 · 개발/설계 현황 · 설계서 보관함 · 가설계서 · 편직처 기계 현황)를
> 코드까지 점검해서 **빈틈 8개(1단계)** + **의뢰를 끝까지 따라가기(2단계)** + 3단계 이후 제안을 드림 → **"1·2단계 진행"**.
>
> 이 문서는 개발 메뉴 전체 흐름(의뢰 → 설계서 → 생산 현황 샘플 → 아이템화 / Drop)의 **고도화 기록**.
> 샘플 오더 연결 자체는 `docs/production-schedule-plan.md` '설계서 ↔ 샘플 오더' · '개발 의뢰 현황 한 표' · '샘플 흐름 점검' 절,
> 원가 견적은 `docs/costing-model.md` §5-C, 편직처는 `docs/knit-factory.md`.

---

## 정한 것 (대표님 OK — 제 추천대로 진행)

| 질문 | 정한 것 |
|---|---|
| 새 설계서의 폭 · GSM | **빈칸으로 시작** (예전 58/56/300 기본값 없앰). 예전 설계서 값은 그대로 |
| 아이템화되면 의뢰는? | 자동으로 **'아이템화 완료'**(새 상태 `articled`)로 닫힘. 보관함 '아이템화 완료' 칸 |
| 의뢰 납기 · 바이어를 고치면 | 자동으로 바꾸지 않고 **한 번 물어봄** ("연결된 곳도 같이 바꿀까요?") |
| (3단계) 설계서 인쇄 | 편직처 · 염색소에 보내는 종이라 원가 · 판가는 안 찍음 — **아직 안 함** |

---

## 1단계 — 빈틈 (작고 위험 적음)

| # | 화면 | 예전 | 지금 | 파일 |
|---|---|---|---|---|
| 1 | 메인/QC | 삭제가 실패해도 '삭제되었습니다' · Pass/Fail 바꾸기는 저장을 안 기다리고 성공 알림 · 엑셀 붙여넣기는 저장 전에 개수를 셈 · 한 장 저장은 중복 확인 없음 · 비고(`remarks`) 입력 칸 없음 | 삭제 · 판정 · 일괄 업로드 모두 **저장이 끝나고 성공했을 때만** 알림. 일괄 업로드는 `saveBatchToCloud`로 한 번에 (실패하면 0건 · 칸 그대로 · '저장 중…'). 한 장 저장도 **같은 Order · Article · 컬러 · LOT**가 있으면 "그래도 한 장 더?" 확인. **비고** 칸 (작성 창 · 목록 식별 칸 아래 두 줄) | `useMainDetail.js` (5번째 인자 `saveBatchToCloud`) · `MainDetailPage.jsx` · `MainDetailFormModal.jsx` |
| 2 | 설계서 확인칸 | 초록으로 켠 뒤 값이 바뀌어도 초록 | **확인할 때 값을 같이 적어 둠**(`fieldConfirmValue`) → 값이 바뀌면 확인이 풀려 노랑 (되돌려도 노랑 — 다시 확인). 예전 설계서(확인 값이 안 적힌 확인)는 창을 열 때 값 기준. 칸 하나에 값 둘인 곳: 개폭(개폭선·오픈개폭) · 포속/오버피더 · 원사 비율(원사 + 비율) | `DesignSheetPage.jsx` (`confirmSnapshot`·`isConfirmedIn`·확인 풀기 effect) · `useDesignSheet.js` 빈 양식 |
| 3 | 새 설계서 | 폭 58/56 · GSM 300이 미리 들어 있어 아무도 안 적어도 아이템화 통과 · 원단 300g 등록 가능 | **빈칸**(칸 안 '입력'). 원단 등록(`registerFabricFromSheet`)에서도 GSM · 내폭 · 외폭 빈칸이면 막음 (어디서 불러도) | `useDesignSheet.js` |
| 4 | 설계서 | 저장된 · 아이템화된 설계서에도 [가설계서 불러오기] → 원단명 · 원사 · 원가 덮어쓰기 + 연결 원단까지 바뀜 | **새 설계서에서만** 보임 ([설계서 불러오기]와 같은 규칙) | `DesignSheetPage.jsx` |
| 5 | 설계서 | 내폭 ≤ 외폭 확인 없음 (원단 관리엔 있음) | 저장 · 원단 등록 때 **내폭 > 외폭이면 막음** | `useDesignSheet.js` |
| 6 | 설계서 보관함 · 설계서 창 | 아이템화된 설계서에 🗑 · [삭제] — 눌러도 늘 막힘 | 아이템화된 설계서는 **버튼을 안 보임** (Drop 보관함의 아이템화 전 설계서는 그대로) | `DesktopSheetRow.jsx` · `MobileSheetCard.jsx` · `DesignSheetPage.jsx` |
| 7 | 개발 의뢰 | 의뢰서 인쇄의 '폭 / 중량' · '바이어 특이사항' 칸이 입력하는 곳이 없어서 늘 '-' | 의뢰 창에 **폭 / 중량**(`targetSpec.widthWeight`) · **바이어 특이사항**(`targetSpec.customerNotes`) 칸 | `DevRequestFormModal.jsx` · `useDevRequest.js` |
| 8 | 원사 라이브러리 | 지우기 전 원단 · 설계서만 봄 → 가설계서 레시피 · 원가 견적 원가가 조용히 깨짐 | **가설계서 · 개발 의뢰 원가 견적**도 봄. 막을 때 어디서 몇 개 쓰는지 알려 줌 | `useYarn.js` (8 · 9번째 인자 `tempDesignSheets` · `devRequests`) |

---

## 2단계 — 의뢰를 끝까지 따라가기

### ① EZ-TEX 등록 뒤에도 보기 — '샘플 진행 (생산 현황)' 표
- 개발/설계 현황 맨 아래 새 표 (`components/dashboard/DevSampleProgress.jsx`). 한 줄 = 생산 현황 샘플 오더가 생긴 설계서 (아이템화 · Drop 전).
- 칸: O/D No. · EZ-TEX(order#) / 바이어(+ 담당) / 품목명 · 설계서 / **생산 상황**(편직중 · 염색중 · 보류 · 완료 · 아이템화 대기 — `devFlowModel.productionStateOf`, '샘플 진행 N일째') / **납기**(오더 납기 → 설계서 납기 → 의뢰 샘플 납기, D-day) / [생산 현황 열기] [설계서 열기] [의뢰 수정].
- 순서: 지연 → 임박 → 납기 빠른 순, 끝난 것(아이템화 대기)은 뒤로. 진행 · 아이템화 · Drop은 **그대로 생산 현황에서** (여기는 보기 + 바로 가기).
- 위 숫자 칸 5개: **의뢰 · 설계 진행중** / **샘플 진행**(누르면 표로 내려감, 아이템화 대기 건수) / **지연 · 임박 = 두 표 합** / 오늘 신규.
- 검색 · 담당자 · 지연/임박 거르기가 두 표에 같이. (보관함 '샘플 진행 (생산 현황)' 탭도 그대로 둠)

### ② 아이템화되면 의뢰 '아이템화 완료'
- 새 의뢰 상태 **`articled` = '아이템화 완료'** (`constants/common.js`, 청록 배지).
- 설계서가 아이템화되면 (원단 새로 등록 · 이미 연결된 원단으로 · 생산 현황 [아이템화] · 설계서 창 [원단 리스트에 등록] 모두) 의뢰도 같이 저장:
  `status: 'articled'`, `articledInfo { sheetId, articleNo, fabricId, at, prevStatus }`, `statusEnteredAt.articled` (`useDesignSheet.markDevArticled`). 알림 끝에 "개발 의뢰 F-26D…도 '아이템화 완료'로 닫았어요."
- 아이템화를 되돌리면(단계를 앞으로) 의뢰는 다시 **'개발 확정'** (`reopenDevFromArticled`). 연결 해제하면 '개발 확정'(설계 대기)로. 아이템화된 설계서에 의뢰를 [연결]하면 바로 '아이템화 완료'.
- 아이템화된 설계서를 고쳐 저장해도 '개발 확정'으로 안 돌아감 (`linkAndConfirm` 막음). Drop된 의뢰는 건드리지 않음.
- 새로 등록되는 원단에 **어느 개발 건에서 왔는지** 남김: `fabric.devSource { devRequestId, devOrderNo, buyerName }` + 비고 "설계서 아이템화 자동 등록 (F-26D011 · 피플앤네이쳐)".
- 보관함 '아이템화 완료' 카드: 바이어 · **'의뢰 → 아이템화 N일'**.
- 예전 의뢰(아이템화돼도 '개발 확정'에 남은 것)는 고치지 않음 — 통계 · 보관함은 설계서가 아이템화됐으면 아이템화로 셈 (`devOutcomeOf`).

### ③ 개발 통계 (누르면 펼침)
- 개발/설계 현황 '단계 안내' 아래 **'개발 통계 — 의뢰 → 아이템화 · Drop'** (`components/dashboard/DevStatsPanel.jsx`, 계산 `devFlowModel.buildDevStats`).
- 기간(의뢰 일자): [전체 · 올해 · 최근 6개월] (마지막 선택 기억 `grubig.devStats.period`).
- 숫자 칸: 개발 의뢰 · 아이템화(%) · Drop(%) · 진행 중 · **의뢰 → 아이템화 평균 일수**(가운데 값 · 몇 건 기준).
- Drop 사유별 막대 (사유 없음 포함) · **바이어별 표**(의뢰 · 아이템화 · Drop · 진행 중 · 아이템화율 · 평균 걸린 날, 8곳 + 더 보기).
- 자체개발 설계서 아이템화는 의뢰가 없어서 따로 한 줄로만.

### ④ 의뢰를 고치면 설계서 · 샘플 오더도 (물어봄)
- 의뢰 수정 저장이 성공한 뒤, 바뀐 값이 연결된 곳과 다르면 확인 창 (`App.handleSaveDevRequestSynced`, 계획 `devFlowModel.devChangePlan`):
  - 샘플 납기 → **설계서 납기**(변경 이력 '개발 의뢰 수정에서 샘플 납기 변경' — `useDesignSheet.applyDevDeadlineToSheet`) · **샘플 오더 납기**(완료된 오더는 뺌)
  - 바이어 → **샘플 오더 바이어**(`customer`)
  - 오더는 `orderActions.updateOrder(…, { note: '개발 의뢰 수정' })` (변경 이력에 까닭).
- [취소]면 의뢰만 바뀜. 일부가 실패하면 "의뢰는 저장했지만 ○○는 바꾸지 못했어요".

### ⑤ 견적 회신 대기 · 담당자
- 원가 견적을 저장해 **'대기 중'**인 의뢰에 **'회신 대기 N일'** 배지 (단계 칸 아래, 7일부터 노랑 · 14일부터 빨강 — `devFlowModel.replyWaitOf`).
- 바이어 칸 아래 **'담당 ○○'**. 표 머리에 **담당자 거르기** (전체 · 이름들 · (담당자 없음)) — 두 표 · 위 숫자 칸 같이. 검색에도 담당자 · 샘플 order#.

---

## 3단계 (대표님 "3단계 진행" 2026-11-24)

| # | 무엇 | 어떻게 | 파일 |
|---|---|---|---|
| ① | **설계서 인쇄** | 설계서 창 머리 **[인쇄 ▾]** → **편직처용**(원사 배합 · 편직 사양 · 조직도 피더 줄 · 편직 특이사항 · 목표 스펙) / **염색소용**(혼용률 · 편직 참고 · 염가공 · 후가공 · 목표 스펙). **원가 · 판매가 · 바이어는 안 찍음**. **'제 N판'** = 변경 이력 수 + 1 (인쇄일 · 마지막 수정일). 저장 안 한 변경이 있으면 먼저 저장하고 인쇄. 파일 이름 `편직설계서_PW1060_1판`. 저장된 설계서에서만 | `design-sheet/DesignSheetPrintSheet.jsx` · `DesignSheetPage.printSheet` · `index.css` `body.printing-sheet` |
| ② | **설계서 안 샘플 오더 칸** | 샘플 오더가 있는 설계서 위에: order# · 생산 상황 · 납기 D-day · 컬러 수 · **[생산 현황 열기]**(저장 안 한 변경이 있으면 묻고 창을 닫은 뒤 그 오더로). **실측 vs 설계**: 메인/QC 시트(이 설계서 Article **또는 EZ-TEX order#**)의 가공 GSM · 전폭을 설계 GSM · 외폭과 비교, **±5% 넘으면 노랑** (견적서 '중량·폭 ±5%'와 같은 기준). '메인 디테일 연동 현황'도 order#로 찾음 | `design-sheet/SheetSampleOrderPanel.jsx` · `App.openOrderFromSheet` · `devFlowModel.qcActualOf` |
| ③ | **메인/QC ↔ 생산 현황** | QC 작성 창 맨 위 **'생산 현황에서 고르기'** (오더 → 컬러 → LOT) → Order No · Article · Color · LOT · 메인/샘플 채움 + `orderId · colorId · lotId` 저장 (글자를 손으로 고치면 그만큼 연결을 풂). 설계서 안 작성 창은 그 샘플 오더만. 생산 현황 **상세창 '메인/QC 결과'** 칸 (컬러 · LOT · 가공 GSM · 전폭 · 폭축/장축 · 판정, 오더 스펙 ±5% 밖 노랑) | `main-detail/OrderLotPicker.jsx` · `order/common/QcResultSection.jsx` · `useMainDetail` |
| ④ | **변경 이력 빈틈** | 이력 한 건에 **바뀐 뒤 값(`to`) · 누가(`by`)** → 화면에 **'옛 값 → 새 값'** (예전 이력은 '바뀜'). **원사를 다른 원사로 바꾼 것**(원사 이름) · **조직도 피더 줄**(요약 글자) · 개폭 · **원단 관리에서 고친 값**('원단 관리에서 수정')도 남김. 설계서 창 이력도 **한국어 칸 이름** (예전엔 'costInput.gsm') | `utils/sheetHistory.js` · `design-sheet/HistoryFieldLine.jsx` · `useDesignSheet` · `useFabric` · `constants.js` |
| ⑤ | **가설계서 ↔ 설계서** | 가설계서를 불러온 설계서에 `fromTemp { tempId, fabricName, buyerName, at }` → 설계서 머리 '🧪 가설계서 ○○에서 가져옴 · 바이어', 가설계서 목록 **'정식 전환됨 · PW…'**, 이미 전환한 가설계서를 [정식]/불러오기 하면 **한 번 더 확인**, 개발/설계 현황 자체개발 줄 바이어 칸에 가설계서 바이어 '(가설계서)' | `useTempDesignSheet.loadTempToSheet` · `TempDesignSheetListPage` · `devFlowModel.promotedSheetsOfTemp` |
| ⑥ | **설계서 보관함** | 찾기: 원단명 · Article · 개발번호 · **원사 · 바이어 · GSM(300g)** · 편직처 · 염가공처. **정렬**: 최근 수정 / Article 순 / 아이템화 날짜. **DROP 보관함 카드**: Drop 날짜 · 사유 · 메모 (자체개발은 설계서 사유, 의뢰와 같이 Drop은 의뢰 사유 '(의뢰)') | `DesignSheetListPage` · `DropSheetModal` · `MobileSheetCard` |
| ⑦ | **자체개발 설계서 Drop 사유** | 개발/설계 현황 자체개발 줄 [Drop] → 의뢰와 같은 **사유 창**(가격 · 납기 · 품질/스펙 · 바이어 사정 · 기타 + 메모). 설계서에 `dropReason · dropMemo · droppedAt` (복원하면 지움). 샘플 오더가 있으면 'Drop으로 닫혀요' 안내 | `DevDropModal selfSheet` · `useDesignSheet.dropDesignSheet({ reason, memo })` |
| ⑧ | **의뢰 일자 빈 예전 의뢰** | 수정 창을 열면 오늘이 아니라 **등록한 날**(createdAt)로 | `useDevRequest.handleEditDevRequest` |
| ⑨ | **편직처** 피더로 찾기 · 엑셀 내보내기 · 방문 기록 → 확인일 | `docs/knit-factory.md` 해당 절 | (편직처 파일) |
| ⑩ | **L/D ↔ 개발 건** | L/D 작성 화면 '또는 개발 건에서 고르기'(개발 의뢰 · 아이템화 전 설계서) → ARTICLE · ITEM NAME · GSM · 폭 · 바이어, `labdip.devRequestId · designSheetId · devOrderNo`, '개발 F-26D…' 칩(아이템화되면 '→ PW…'). 개발/설계 현황 줄 · 샘플 진행 줄 · 설계서 칸에 **'L/D 3컬러 · 컨펌 1 · 진행 2'** 배지 (`labdipModel.labdipsOfDev · labdipDevSummary`). 자세한 건 `docs/labdip.md` §13 | `labdipModel` · `LabdipForm` · `LabdipParts` · `DevStatusPage` · `DevSampleProgress` · `SheetSampleOrderPanel` |

### 3단계 확인한 것 (DEV 2026-11-24)
- F-26D006 설계서: 위 칸 'F-26S055 · 염색중 · 납기 2026-10-05 · D+50 지연 · 컬러 1개 · [생산 현황 열기]'.
- [인쇄 ▾] 편직처용 → `body.printing-sheet`, 제목 `편직설계서_PW1060_1판`, 원사 2/48 WOOL 64% · POLY 75D 36% · 목표 56"/58"/260 — 원가 글자 없음. 염색소용 → `염가공설계서_PW1060_1판`.
- GSM 260 → 270 저장 → 이력 'GSM(Cost): 260 → 270 · DEV 검증용'.
- 설계서 안 QC [작성] → 생산 현황에서 고르기 F-26S055 → LOT 1 → Order No F-26S055 · LOT 1 · 샘플 → 240g · 58" 저장 → 설계서 칸 '240g(-11.1%)' 노랑 · '58"(0%)'. [생산 현황 열기] → 상세창 '메인/QC 결과 1장'.
- 자체개발 'SW/N=89/11 미니쥬리' [Drop] → 사유 창(자체개발 설계서) 품질·스펙 + 메모 → 표에서 빠짐 → 설계서 보관함 DROP 카드 'Drop 26. 11. 24. · 품질·스펙 · 📝 촉감이…'.
- L/D: [+ 새 L/D ▾] 공장에 의뢰 → 개발 건에서 고르기 F-26D006(샘플 진행) → ARTICLE PW1060 · ITEM NAME · GSM 260 · 폭 56/58 · '개발 F-26D006' 칩 → 저장 GB26027 → 개발/설계 현황 샘플 진행 줄 'L/D 1컬러 · 진행 1', 설계서 칸 'L/D 1컬러 · 진행 1 GB26027'.
- node: 피더 요약 · 참/거짓 글자 · 원단 관리 이력(GSM 300→280 · 원사 WOOL→COTTON, 바뀐 것 없으면 null) · 정식 전환됨(Drop 뺌) · QC 실측(마지막 TEST).

## 4단계 후보 (제안만)
- 설계서 인쇄 기록 (몇 판을 언제 어느 공장에 보냈는지) · 판이 바뀌면 '공장에 새 판 보내기' 알림
- QC 결과를 생산 현황 현황표 칸에도 (Pass/Fail 점)
- 아이템화된 원단 관리 화면에 개발번호 · 바이어(`devSource`) 보이기

---

## 파일
| 역할 | 파일 |
|---|---|
| 순수 함수 | `utils/devFlowModel.js` — `productionStateOf` · `sampleRowDeadline` · `isSampleOrderDone` · `replyWaitOf` · `liveSheetOfDev` · `devOutcomeOf` · `devLeadDays` · `buildDevStats` · `devChangePlan` · `daysBetween` |
| 화면 | `pages/DevStatusPage.jsx` (`sampleRows` · 담당자 거르기 · 숫자 칸 5개 · 자체개발 Drop 사유 창) · `components/dashboard/DevSampleProgress.jsx` · `DevStatsPanel.jsx` · `DevArchiveModal.jsx`(아이템화 카드 · `productionStateOf` 공용) · 3단계 파일은 위 표 |
| 훅 | `useDesignSheet.js` (`markDevArticled` · `reopenDevFromArticled` · `applyDevDeadlineToSheet` · 확인칸 빈 양식 · 폭 확인) · `useDevRequest.js` · `useMainDetail.js` · `useYarn.js` |
| 연결 | `apps/App.jsx` — `handleSaveDevRequestSynced`, `useMainDetail(…, saveBatchToCloud)`, `useYarn(…, tempDesignSheets, devRequests)` |

## 확인한 것 (DEV 미리보기 2026-11-24)
- `devFlowModel` node 시험: 통계(아이템화 2 · Drop 2 · 평균 30일 · 사유별 · 바이어별 · 기간 '올해'), 회신 대기 14일 = 빨강, 변경 계획(설계서 · 오더 납기 · 바이어, 완료된 오더는 뺌), 생산 상황(아이템화 대기 · 보류).
- 개발/설계 현황: '샘플 진행' 표에 F-26D006 · F-26S055 염색중 D+50 지연, 지연 숫자 9 = 의뢰 표 8 + 샘플 1. 통계 펼침 · 모바일 카드(가로 넘침 없음).
- F-26D011 설계서: GSM 280 확인 → 300으로 바꾸면 노랑(되돌려도 노랑) · 내폭 60 > 외폭 58 저장 막힘 · 단계 칸 '아이템화' → "Article PW9001 원단 등록 … 개발 의뢰 F-26D011도 '아이템화 완료'로 닫았어요" · 표에서 빠지고 보관함 카드 '피플앤네이쳐 · 의뢰 → 아이템화 235일' · 통계 아이템화 1 · 되돌리기 → "다시 '개발 확정'". 아이템화된 설계서 창에 [삭제] · [가설계서 불러오기] 없음.
- F-26D006 의뢰 샘플 납기 2026-12-15 → 확인 창(설계서 납기 · 샘플 오더 F-26S055 납기) → 샘플 줄 2026-12-15 D-21. 설계서 없는 의뢰는 묻지 않음.
- 담당자 '김영업' → 거르기 칸(전체 · 김영업 · (담당자 없음)), 고르면 표 1줄 · 숫자 칸도 그 담당자 것만.
- 메인/QC: 일괄 업로드 성공 2, 판정 Pass "판정이 변경되었습니다", 삭제 확인 → "삭제되었습니다", 같은 O-2/RED/L1 두 번째 저장 → 확인 창(취소하면 창 그대로), 비고 목록에 보임.
- 새 설계서 폭 · GSM 빈칸 · 원가 칸 NaN 없음. 콘솔 오류 없음. `vite build` 통과.
