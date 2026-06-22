# 그루빅 ERP 용어 사전 (Terminology)

화면 간에 **같은 기능은 같은 용어**로 부르기 위한 표준 용어집입니다.
새 UI를 만들거나 라벨을 바꿀 때 이 문서를 먼저 확인하고, 새로운 표준이 정해지면 여기에 추가하세요.

---

## 1. 도매(Conv) 마진 단계 지정

판매가(도매가, CONV)를 산출할 때 적용하는 **마진율 단계**를 고르는 기능입니다.

- **표준 라벨**: `도매(Conv) 마진 단계 지정`
- **표준 옵션 형식**: `{N}단계 ({M}%)` — 예: `3단계 (19%)`
- **단계 정의(상수)**: [`MARGIN_TIERS`](../src/constants/common.js) — **0~6단계** (10% ~ 28%)

| 단계 | 마진율 |
|----|------|
| 0단계 | 10% |
| 1단계 | 13% |
| 2단계 | 16% |
| 3단계 | 19% (기본값) |
| 4단계 | 22% |
| 5단계 | 25% |
| 6단계 | 28% |

### 사용 위치 (모두 위 표준을 따름)
| 화면 | 파일 | 형태 |
|-----|------|-----|
| 원가 계산기 | `src/pages/CalculatorPage.jsx` | 드롭다운(선택) |
| 원단 설계서 / 가설계서 | `src/pages/DesignSheetPage.jsx` | 드롭다운(선택) — 원가표 우측 열 헤더 |
| 원단 리스트(데스크톱 펼침) | `src/components/fabric/DesktopFabricRow.jsx` | 표시(읽기) |
| 원단 리스트(모바일 카드) | `src/components/fabric/MobileFabricCard.jsx` | 표시(읽기) |
| 설계서 변경 이력 라벨 | `src/components/design-sheet/constants.js` (`FIELD_LABELS`) | 표시(읽기) |

> ⚠️ 과거 용어(쓰지 말 것): `통합 적용 상수`, `1급~5급`, `마진등급`, `지정 마진율`, `도매 마진` → 모두 `도매(Conv) 마진 단계` 로 통일됨.

---

## 2. 가설계서(레시피)와 정식 설계서의 화면 공유

- **가설계서(레시피)** 작성 화면은 **정식 설계서 화면(`DesignSheetPage.jsx`)을 `isTempMode={true}`로 재사용**합니다.
  (진입: `src/pages/TempDesignSheetListPage.jsx` 의 모달)
- 따라서 `DesignSheetPage`의 원사·원가·마진 UI를 수정하면 **정식 설계서와 가설계서 양쪽에 동시에 반영**됩니다.
- 가설계서 전용 차이: 원사 슬롯에 `priceOverride`(단가 직접 입력) 칸이 추가됨. 정식 설계서로 승급(`loadTempToSheet`) 시 `priceOverride`는 폐기되고 원사 라이브러리 단가로 재계산됩니다.

---

## 3. 저장 규약 (데이터 유실 방지)

- 폼 저장 핸들러는 `saveDocToCloud(...)`(App.jsx)를 **`await`** 하고, **성공(`true`)했을 때만** 폼 리셋·성공 토스트·모달 닫기를 수행합니다. 실패 시 입력값을 보존하고 에러를 표면화합니다.
- `src/services/db.js`의 `saveDocument`는 저장 전 **undefined 필드를 제거**합니다. (Firestore는 `undefined` 필드를 거부하므로, 일부 필드가 비어도 문서 전체 저장이 실패하지 않도록 함)
