# 그루빅 ERP 용어 사전 (Terminology)

화면 간에 **같은 기능은 같은 용어**로 부르기 위한 표준 용어집입니다.
새 UI를 만들거나 라벨을 바꿀 때 이 문서를 먼저 확인하고, 새로운 표준이 정해지면 여기에 추가하세요.

---

## 1. 마진 용어 (3분리: 위험마진 / 마진 단계 / 매출이익율)

원가 개편(2026-06) 이후 마진은 **3곳에서 서로 다른 개념**으로 분리됨. 절대 혼용하지 말 것.

### 1-A. 위험마진 — 원단 원가 계산기 · 원단 리스트 (현행 표준)
순원가에 가산하는 **단일 %**로, '영업 기준원가'를 산출합니다. (메인 전·위험 원단 추가 마진)
- **표준 라벨**: `위험 마진 (%)`
- **필드**: `riskMarginPct` (원단당 1개)
- **공식**: 영업 기준원가 = 순원가 × (1 + 위험마진%)  *(판매마진은 여기서 적용하지 않음 → 견적서 1-C에서)*

| 화면 | 파일 | 형태 |
|-----|------|-----|
| 원가 계산기 | `src/components/cost/CostBreakdownTable.jsx` | 입력(%) |
| 원단 리스트(데스크톱 펼침) | `src/components/fabric/DesktopFabricRow.jsx` | 표시(읽기) |
| 원단 리스트(모바일 카드) | `src/components/fabric/MobileFabricCard.jsx` | 표시(읽기) |

> ⚠️ 원가 계산기·원단 리스트는 더 이상 '마진 단계(1-B)'를 쓰지 않음 — 위험마진으로 대체됨.

### 1-B. 도매(Conv) 마진 단계 지정 — 설계서 전용
판매가(도매가) 산출용 **마진율 단계**. 현재는 **설계서에서만** 사용됩니다.
- **표준 옵션 형식**: `{N}단계 ({M}%)` — 예: `3단계 (19%)`
- **단계 정의(상수)**: [`MARGIN_TIERS`](../src/constants/common.js) — **0~6단계** (10% ~ 28%, 기본 3단계 19%)

| 화면 | 파일 | 형태 |
|-----|------|-----|
| 원단 설계서 / 가설계서 | `src/pages/DesignSheetPage.jsx` | 드롭다운(선택) |
| 설계서 변경 이력 라벨 | `src/components/design-sheet/constants.js` (`FIELD_LABELS`) | 표시(읽기) |

### 1-C. 매출이익율 + 추가 영업마진 — 견적서 · 가설계서
'영업 기준원가'에 적용하는 **판매마진**.
- **일괄 매출이익율(%)**: 전 품목 일괄 적용 + 원단별 개별 수정(`marginRate`)
- **구간별 추가 영업마진**: 1k/3k/5k YD당 정액(`marginAdd`), 전체 적용
- **공식**: 판매가 = 영업 기준원가 ÷ (1 − 매출이익율%) + YD당 정액
- **사용 위치**: `src/pages/QuotationPage.jsx`, `src/hooks/domains/useQuotation.js`
- **가설계서 영업견적 시뮬레이션(2026-08 추가, 구간별 개편)**: `quoteMarginRate`·`quoteMarginAdd`를
  **구간별 객체 `{'1k','3k','5k'}`** 로 보유 — 매출이익율·YD당 정액을 1K/3K/5K 각각 개별 입력.
  신규 가설계서 기본값: 이익율 22/20/18%, 정액 0 (**기존 시트·정식 설계서는 불변**).
  `toTierRate`/`toTierAdd`로 정규화(레거시 단일값은 세 구간에 자동 펼침 → 하위호환), 최종 판매가는 `computeSellPrice()`.
  편집화면(`DesignSheetPage.jsx` isTempMode) 시뮬레이션 그리드 + 목록 1K/3K/5K 판매가·마진 범위 배지
  (`TempDesignSheetListPage.jsx`, `useTempDesignSheet.js`). base = `calculateCost().finalCostYd`(영업 기준원가).

> ⚠️ **원가모델 참고**: `calculateCost`의 `priceConverter`/`priceBrand`는 판매가가 아니라 **`finalCostYd`(영업 기준원가) 별칭**이다.
> `costInput.marginTier`(도매 마진 단계, 1-B)는 저장·이력추적만 되고 현재 원가계산에는 미사용(판매마진은 견적/1-C로 이관됨).

> ⚠️ 과거 용어(쓰지 말 것): `통합 적용 상수`, `1급~5급`, `마진등급`, `지정 마진율`, `도매 마진`. → 설계서 마진은 `도매(Conv) 마진 단계`, 원단 원가는 `위험마진`, 견적 판매마진은 `매출이익율`로 명확히 구분.

---

## 2. 가설계서(레시피)와 정식 설계서의 화면 공유

- **가설계서(레시피)** 작성 화면은 **정식 설계서 화면(`DesignSheetPage.jsx`)을 `isTempMode={true}`로 재사용**합니다.
  (진입: `src/pages/TempDesignSheetListPage.jsx` 의 모달)
- 따라서 `DesignSheetPage`의 원사·원가·마진 UI를 수정하면 **정식 설계서와 가설계서 양쪽에 동시에 반영**됩니다.
- 가설계서 전용 차이: 원사 슬롯에 `priceOverride`(단가 직접 입력) 칸이 추가됨. 정식 설계서로 승급(`loadTempToSheet`) 시 `priceOverride`는 폐기되고 원사 라이브러리 단가로 재계산됩니다.
- **양방향 불러오기**: 정식→가설계서(`loadSheetToTemp`)는 목록의 `[설계서 불러오기]`로 등록된 정식 설계서의 스펙·원가를 **새 가설계서로 복제**(원본 불변, 추적 필드 제외, 원사엔 `priceOverride('')` 부여, 마진 기본값 22/20/18%). 가설계서→정식(`loadTempToSheet`)은 그 반대(승급).

---

## 2-A. 원가 계산 용어 (2026-10 원가 개편 — 상세는 `docs/costing-model.md`)

원가 표(`CostBreakdownTable`)·원가 설정(`CostSettingsModal`)·원단 리스트에서 같은 말로 부를 것.

| 표준 용어 | 뜻 | 필드 / 위치 |
|---|---|---|
| **원가 설정** | 전 품목 공통 원가 기준값 화면 (⚙ 버튼) | `settings/general.costSettings` |
| **편직 난이도** | 품목의 편직 등급 (A/B…) → 정액을 정함 | 품목 `knitGrade`, 설정 `knitGrades` |
| **정액** | 편직비 최저 금액 (오더당). 편직비 = max(정액, 생지 kg × kg단가) | 설정 `knitGrades[].fixedFee` |
| **편직 kg단가** | 품목별 편직료 (원/kg, 생지 기준) | 품목 `knitKgRate` |
| **kg단가 구간** | 품목별 'N kg 이상 → 단가' (선택) | 품목 `knitKgRateTiers` |
| **가공 유형** | 일반·스판물·기모물… → 가공 LOSS를 정함 | 품목 `processType`, 설정 `processTypes` |
| **가공 LOSS** | 염가공·후가공에서 줄어드는 비율 (생지 → 가공지) | 설정 `processTypes[].lossPct` |
| **편직 LOSS** | 편직에서 줄어드는 비율 (원사 → 생지), 생지 kg 구간별 | 설정 `knitLossBrackets` |
| **가공지 kg / 생지 kg / 원사 투입 kg** | 완성 원단 무게 / 편직 후 원단 무게 / 들어가는 원사 무게 | 원가 표 ③ 구간별 산출 |
| **이화학검사** | 컬러수 × 1컬러당 검사비 (오더당) ÷ 수량 | 설정 `chemTest` |
| **운임** | 수량 구간별 오더당 금액 ÷ 수량 | 설정 `freightBrackets` |
| **외관검사** | 전 품목 공통 YD당 단가 | 설정 `visualInspectionPerYd` |
| **품목별 추가비용** | 품목마다 따로 넣는 YD당 비용 (선택) | 품목 `etcCosts[{name, perYd}]` |
| **운반비** (원사) | 원사 kg당 운반비. 국내 업체는 공급처마다 고정 원/kg | 원사 공급처 `freight` |
| **수입 / 수입사** | 원사 공급처 줄의 [수입] 체크 → 운반비를 수입 국가 kg 구간으로 | 원사 공급처 `isImport` |
| **수입 국가** | 수입 원사 운반비 구간을 고르는 나라 (기본 중국) | 원사 공급처 `importCountry`, 설정 `importCountries` |
| **수입 원사 운반비** | 그 원사 kg(원사 투입 kg × 혼용률) 구간의 원/kg ('N kg 미만' 구간). 재료비에 포함 | 설정 `importCountries[].brackets` |

> ⚠️ 쓰지 말 것: `1K/3K/5K 편직료`, `구간별 편직 Loss`, `염색 LOSS`(→ **가공 LOSS**), `기타비용(외관/이화학/운임)`(→ 원가 설정의 각 항목).
> ⚠️ **운임 ≠ 운반비**: 운임은 원단 오더 납품 운임(수량 YD 구간, 오더 총액), 운반비는 원사 kg당 운반비(국내 고정 / 수입 국가 kg 구간). 섞어 쓰지 말 것.
> 원가 표의 3구간(1,000/3,000/5,000YD)은 '입력 칸'이 아니라 **수량을 넣어 계산한 결과**를 보여주는 열이다.

---

## 3. 저장 규약 (데이터 유실 방지)

- 폼 저장 핸들러는 `saveDocToCloud(...)`(App.jsx)를 **`await`** 하고, **성공(`true`)했을 때만** 폼 리셋·성공 토스트·모달 닫기를 수행합니다. 실패 시 입력값을 보존하고 에러를 표면화합니다.
- `src/services/db.js`의 `saveDocument`는 저장 전 **undefined 필드를 제거**합니다. (Firestore는 `undefined` 필드를 거부하므로, 일부 필드가 비어도 문서 전체 저장이 실패하지 않도록 함)
