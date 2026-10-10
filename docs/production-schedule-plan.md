# 생산 스케줄 모듈 — 구현 플랜 & 진행 상황

> **이 문서는 `docs/production-schedule-spec.md`(기획서 원본)의 구현 플랜이다.**
> 새 단계 작업 시작 시: **spec을 먼저 읽고 → 이 plan을 읽어** 현재 진행 상황과 다음 단계를 파악할 것.

---

## 현재 진행 상황 요약

| 단계 | 상태 | 커밋 |
|-----|------|-----|
| **1단계**: 데이터 모델 + 오더 등록 + 목록/상세 | ✅ **완료** | `9929b3b` |
| **1단계 후속 v1**: UX 단순화(2섹션) + 원단 연동 | ✅ **완료** | (미커밋) |
| **1단계 후속 v2**: 시작점 모델 도입 + 폼 대폭 단순화 | ✅ **완료** | - |
| **1단계 후속 v3**: 사종별 편직처 + 시작일+일수→종료일 자동 + ART/일일편직량 정리 | ✅ **완료** | - |
| **2단계 1차 (2-A)**: 오더 상세에서 상태/일정 수정 + 차수 추가/삭제 + 자동 날짜 | ✅ **완료** | - |
| **v4: 담당자 시스템 전체 폐기** (2-E 작업도 취소) | ✅ **완료** | - |
| **2단계 2차 (2-F)**: 오더 전체 편집 (등록 마법사 재사용) | ✅ **완료** | - |
| **v5~v7: 차수 편집 UX 진화** (모달→펼침→엑셀 스타일 표) | ✅ **완료** | - |
| **2단계 3차 (2-B)**: 간트 차트 1차 버전 | ✅ **완료** | - |
| **3단계**: 대시보드 + 칸반 + Risk Scanner (1차) | ✅ **완료** | - |
| **4단계**: 감사 로그 + 리포트 (1차) | ✅ **완료** | - |
| **v8 개편 1·2단계**: 대시보드·칸반·오더등록 삭제 + 차수 폐기 데이터 구조 + 엑셀형 현황표 | ✅ **완료** | `e14b9c4` |
| **v8 개편 3단계**: 염가공 컬러별 LOT 계획 | ✅ **완료** | `0443244` |
| **v8 개편 4단계**: 오더별 간트 + 날짜 메모 | ✅ **완료** | (4단계 커밋) |
| **생산 ▾ 계산기**: 선염 계산기 (스트라이프 원사 배분 · 멜란지 수량 비율) + 저장 | ✅ **완료** | (계산기 커밋) |
| **가납기 + 간트 깃발 · 메모 아래로** (2026-10-10) | ✅ **완료** | (가납기 커밋) |

> **🎉 Phase 1 운영 가능 상태 도달** — 등록/편집/시각화/모니터링 모두 1차 완성. 이제 사용해보면서 세부 다듬기.
> 알람/확인게이트는 개발하지 않기로 결정 (대표님 지시).
>
> **⚠️ 2026-09 v8 개편으로 아래 1단계~v7 의 데이터 구조(차수·입고차수·시작점·활성 공정)와 화면(대시보드·칸반·오더 등록 마법사·공정별 간트)은 폐기됐다.**
> 현재 구조는 바로 아래 "v8 개편" 절이 기준이다. 그 아래 절들은 이력으로만 남겨둔다.

---

## v8 개편 — 엑셀형 현황표 (2026-09, 현재 기준)

### 배경 (대표님 요청 6가지)
1. 생산 현황의 대시보드·칸반 삭제
2. 간트를 **오더별**로 (엑셀 현황표의 날짜별 status 칸 느낌)
3. 별도 오더 등록 화면 없이 **현황표에서 바로 추가/수정** (엑셀처럼)
4. 오더를 1차·2차(차수)로 나누지 않고 **전체 일정만** 관리
5. 염가공은 **LOT(염색탕)별 계획**
6. 대표님 피드백으로 계속 업그레이드

### 확정 결정 (질의응답)
| 항목 | 결정 |
|-----|-----|
| 수량 단위 | **KG** (오더수량·작지수량). YD 입력/환산 폐기 |
| 작지수량 | 오더수량 × (1 + 로스율). 로스율 기본 10%(엑셀 실측), 오더마다 수정. 작지수량 직접 입력도 가능(↺로 자동 복귀) |
| 원사 | 사종별 발주·입고차수 폐기 → 다른 공정처럼 외주처·시작·종료·상태·메모 한 세트 |
| 간트 | 공정 막대 + **날짜 칸 메모**(엑셀의 일일 status) 둘 다 |
| 기존 오더 | 읽을 때 자동 변환(차수 날짜 합침: 가장 빠른 시작~가장 늦은 종료). 원래 필드는 문서에 보존 |
| 오더 타입/시작점/공정 활성화 | 폐기. 칸을 채운 공정 = 사용하는 공정 |
| 구분(메인/샘플) | order# 의 S/M 으로 자동 (F-26**S**046 → 샘플, F-26**M**020 → 메인), 수정 가능 |
| article# | 자유 입력 + 원단 보관함 자동완성(선택 시 detail·gsm·폭 채움). 엑셀처럼 "###" 도 허용 |
| 편직 | 오더 단위(편직처·기간·일일생산량 → 예상 종료일 계산) / **생지 출고일은 컬러별** |
| 컬러 줄 상태 | 입력한 일정·상태로 자동 표시 (편직대기→편직중→생지출고대기→염색대기→염색중→컨펌중→출고대기→출고완료, 문제/보류/완료) |

### 데이터 구조 (orders 컬렉션, `schemaVersion: 8`)
- 정의·변환·계산은 전부 `src/utils/orderModel.js` (순수 함수). 상수는 `src/constants/production.js`.
```
order { id, schemaVersion:8, orderNumber, articleNo, detail, customer, type, finalDueDate, lossRate, status(active|on_hold|completed),
        notes, linkedFabricId, linkedFabricArticle, dyeVendor,
        steps: { yarn, yarn_processing, knitting, finishing, physical_test, visual_inspection }  // {vendor,startDate,endDate,status,doneDate,notes} (+knitting.dailyKg)
        colors: [{ id, name, orderKg, workKg(null=자동), greigeOutDate, greigeOutDone,
                   lots: [{ id, no, machineKg(탕 용량), qtyKg, startDate(투입), endDate(완료예정), status, rolls, notes }],
                   confirmRounds: [{ round, sentDate, resultDate, result }], shipDate, shipDone, notes }]
        dailyNotes: [{ id, date, colorId(''=오더 줄), text, tone }], changeLog, createdAt, updatedAt ... }
```
- 새 오더 문서 ID는 `ord_…` 자동 생성 (order# 는 일반 필드 → 나중에 수정 가능). 옛 오더는 기존 ID(=옛 order#) 유지.
- 상태는 모든 공정·LOT 공통 4단계: 대기 / 진행중 / 문제 / 완료.

### 저장 방식 (`src/hooks/domains/useOrder.js`)
- 칸 하나 확정(blur/Enter, 날짜·체크는 즉시) → orderModel 의 변경 함수로 새 오더 생성 → 문서 통째 저장 + 변경 이력 자동 요약(`summarizeOrderChange`).
- 저장 완료 전에도 화면에 바로 반영(낙관적 반영). 연속 수정은 직전 수정본 위에 이어서 적용(앞 수정 유실 방지). 저장 실패 시 서버 값으로 되돌림.
- 새 줄(초안)은 **order# 를 입력하는 순간** 등록 저장. order# 중복·빈값은 거절.

### 화면 / 파일
| 화면 | 파일 |
|-----|-----|
| 생산 현황 페이지 (툴바·필터·상세창·LOT 편집 띄우기) | `src/pages/OrderListPage.jsx` |
| 엑셀형 현황표 | `src/components/order/sheet/ProductionSheet.jsx` (+ `SheetCells.jsx`, `OrderMenuPopover.jsx`) |
| 공정 편집 / 브랜드 컨펌 팝오버 | `src/components/order/sheet/ProcessPopover.jsx`, `ColorPopovers.jsx` |
| 염가공 LOT 편집 | `src/components/order/sheet/LotEditor.jsx` |
| 오더별 간트 + 날짜 메모 | `src/components/order/gantt/OrderGantt.jsx` |
| 상세창(모바일 편집 겸용) / 모바일 카드 | `src/components/order/OrderDetailModal.jsx`, `MobileOrderList.jsx` |
| 공용 팝오버 틀 | `src/components/order/common/PopoverShell.jsx` |
| 리포트 | `src/pages/ReportPage.jsx` |

### 삭제된 것
- 화면: 대시보드, 칸반, 오더 등록 마법사(메뉴 포함), 공정별 간트
- 파일: `DashboardPage`, `OrderKanbanPage`, `OrderWizardPage`, `OrderGanttPage`, `components/order/{wizard,modals,list,editing}/*`, `gantt/{GanttChart,MultiOrderGanttChart,utils}`, `DesktopOrderRow`, `MobileOrderCard`, `utils/riskScanner.js`
- 로직: 차수·원사 입고차수, 시작점/활성 공정, 위험 감지(Risk Scanner)·Daily Briefing

### 개발용 샘플
- DEV 우회 로그인(`docs/dev-login.md`) 시 `DEV_SAMPLE_ORDERS`(`src/constants/devSamples.js`) 주입 — 엑셀 행을 본뜬 v8 오더 3건 + 옛 형식 1건(자동 변환 확인용).

### 다음 후보 (대표님 피드백 대기)
- 현황표 엑셀 내보내기(SheetJS), 인쇄
- 외주처(편직소·염색소)별 보기, 염색소 LOT 일정표
- 납기 임박/지연 강조 규칙 조정

---

## 가납기 · 간트 메모 아래로 (대표님 요청 2026-10-10)

### 가납기 = 공정별 대략적인 목표 날짜
- 오더마다 **원사 · 편직 · 염가공 · 외관검사** 4개 (염가공도 컬러별이 아니라 오더 하나에 하나 — 대표님 '대략적인 납기').
- 문서 필드 `provisionalDue: { yarn, knitting, dyeing, visual_inspection }` ('YYYY-MM-DD', '' = 없음). 예전 오더는 읽을 때 모두 빈칸.
- **지금 일정과 비교** (`orderModel.getProvisionalDueInfo`):
  | 현재 날짜 (`getStepCurrentEnd`) | |
  |---|---|
  | 원사·편직·외관검사 | 완료면 완료일(없으면 종료일), 아니면 종료일 (편직은 일일 생산량으로 계산한 예상 종료일도) |
  | 염가공 | 모든 컬러 LOT 중 가장 늦은 완료예정일, LOT 전부 완료면 완료 |
  - 상태: 맞음/N일 여유(초록) · **N일 늦음**(현재 날짜 > 가납기, 빨강) · **N일 지남**(가납기가 지났는데 미완료, 빨강) ·
    완료(초록) · N일 늦게 완료(주황) · 일정 미입력(회색). 완료된 오더는 미완료 공정도 끝난 것으로 봄 (빨간 경고가 남지 않게).
  - 상태별 색은 `constants/production.js` `PROVISIONAL_STATES` (chip·flag·line).
- 입력: 현황표 **'가납기' 칸**(납기 오른쪽, 항상 표시) → `ProvisionalDuePopover` (4개 한 번에, 넣는 동안 바로 비교 · 순서가 뒤바뀌면 노란 안내만) /
  오더 상세창 '가납기' 칸 (모바일) / 간트 깃발 클릭. 저장은 `orderActions.setProvisionalDue(id, patch)`, 변경 이력 '가납기 편직 10/25→10/28'.

### 간트
- **오더 줄 맨 위 가납기 깃발** (`ganttLayout.placeFlags`): 그 날짜 칸 오른쪽 끝(납기 점선과 같은 기준)에 '⚑편직 +3' — 같은 칸이면 '편직·염가공'으로 합치고 더 나쁜 상태 색.
  그 날짜에 **오더 묶음 전체를 지나는 세로 점선**(상태 색) → 아래 막대 끝과 비교. 마우스를 올리면 '편직 9/25 현재 종료 10/1 (예상) → 6일 늦음'.
- **날짜 메모를 막대 아래로, 글자 전부** (대표님 선택 '날짜 메모를 줄 아래 다 보이게'):
  예전엔 줄 위쪽 18px에 한 줄로 잘렸음('9/17 라인 출…'). 이제 막대 레인 아래 CSS grid — 그 날짜 칸에서 시작해 글자 길이만큼(최대 4칸) 넓게,
  더 길면 줄바꿈. 바로 옆 날짜에도 메모가 있으면 아래 단(lane)으로 → 줄 높이가 늘어남 (`row.minH` 최소 높이만 고정).
  메모 글자를 누르면 그 메모 날짜의 메모 창 (옆 칸까지 넓게 써진 부분을 눌러도).

### 파일
| 역할 | 파일 |
|---|---|
| 상수 | `constants/production.js` — `PROVISIONAL_DUE_STEPS`·`PROVISIONAL_DUE_KEYS`·`PROVISIONAL_STATES` |
| 계산 | `utils/orderModel.js` — `getStepCurrentEnd`·`getProvisionalDueInfo`·`describeProvisionalDue`·`describeStepCurrent`·`getProvisionalDueMarks`·`applyProvisionalDue` |
| 입력 창 | `components/order/sheet/ProvisionalDuePopover.jsx` (새 파일) |
| 화면 | `ProductionSheet.jsx`(가납기 칸) · `OrderDetailModal.jsx`(가납기 칸) · `gantt/ganttLayout.js`·`OrderGantt.jsx`(깃발·점선·메모) |

---

## 생산 ▾ 계산기 — 선염 계산기 (대표님 요청 2026-10-07)

생산 드롭다운의 **'계산기'** (생산 현황 · 리포트 아래, 탭 key `productionCalc`). 화면: 왼쪽 **저장된 계산** 목록 / 오른쪽 계산기 [스트라이프 선염] [멜란지 선염].
(목록은 넓은 화면(xl, 1280px~)에서만 왼쪽 — 그보다 좁으면 위로 올라가 계산 표의 줄 지우기 ✕가 잘리지 않게. 원사 칸이 많으면 그 칸 안에서 줄바꿈)

### ① 스트라이프 선염 — 원사 컬러 배분
- 오더 컬러(예: `APRICOT/BARK BROWN`)마다 **원사 컬러별 비율(%)**을 넣으면 원사 컬러별 **수량·혼용율** (대표님: 비율은 알고 있어서 %로 넣음).
- 수량 = 오더 컬러 수량 × 원사 비율%. **로스는 넣지 않음** (대표님 지정 — 오더 수량 그대로). 혼용율 = 원사 컬러 수량 ÷ 원사 수량 합계.
- **같은 원사 컬러는 합침** (컬러 공용 — 대소문자·띄어쓰기 무시, 예: BARK BROWN이 세 오더 컬러에 들어가면 한 줄). 결과는 처음 나온 순서.
- 컬러명에 '/'가 있으면 원사 컬러 칸을 나눠 채움 (오더 불러올 때 · 직접 입력은 컬러명 칸을 떠날 때 원사 칸이 비어 있으면). 컬러 이름은 대문자로.
- **원사 = ARTICLE(원단 관리)의 원사** (대표님 요청 2026-10-07 — 'ARTICLE 불러와서 그 원사에서 컬러 나누기'): 결과 원사명 = 원사 + 컬러
  (예: `F/60Nm SW/N 87/13 APRICOT` — 대표님 캡처의 '사가공 원사' 표 모양).
  - 원사가 하나인 원단은 바로 채움. **원사가 여러 개면 선염할 원사 하나를 고르는 칸**(노란색, 혼용률 큰 순)이 뜸 — 모든 컬러에 같은 원사 (대표님 OK ①).
  - 원단을 못 찾거나 원사가 없으면 ARTICLE 아래 '원사' 칸에 직접 입력.
  - **ARTICLE을 바꾸거나 칸을 비울 때 원사** (`nextBaseYarnName`, O/D를 바꿀 때도 같은 규칙): 새 원단 원사가 하나 → 그 원사 /
    여러 개 → 지금 원사가 그중 하나면 그대로, 아니면 고르는 칸 / 원사 없음·못 찾음·연결 풂 → **앞 ARTICLE에서 온 원사는 비움**
    (다른 원단 원사가 남지 않게), 대표님이 **직접 넣은 원사는 그대로**.
- 확인 표시: 한 줄 비율 합계 ≠ 100%(비율을 하나라도 넣은 줄만) · 원사 컬러 이름 빈 칸 · 수량 빈 칸 → 빨간 안내, 원사 합계 ≠ 오더 합계면 합계 줄에 안내.
- 예) 대표님 캡처 3컬러(106.8 / 151.0 / 127.4kg)를 79 : 21로 → APRICOT 21.9% · BARK BROWN 21.0% · DEEP LIME 31.0% · NAVY CHARCOAL 26.1%
  (캡처 시스템은 로스 넣은 kg로 계산해서 BARK BROWN 21.1%).
- 단위 kg / YD 선택 (비율은 단위와 무관). 칸 안 남은 비율 안내 (한 칸만 비면 100%가 되는 값을 흐리게).

### ② 멜란지 선염 — 수량 비율
- 줄마다 멜란지(1%·8% …)와 수량 → **수량 비율** (대표님 지정: 비율 = 수량 비율). 예) 600 / 1,800YD → 25% / 75%. 기본 단위 YD.

### 공통
- **기본 정보 = O/D · ARTICLE · 메모** (대표님 지정 2026-10-07 — 제목 칸 없음). 목록 제목은 'O/D · ARTICLE'로 자동 (둘 다 없으면 '스트라이프 선염 2026-10-07').
  O/D·ARTICLE을 지우고 다시 저장하면 제목도 그에 맞게 바뀜 (예전 자동 제목은 이어 쓰지 않음 — 제목 칸이 있던 때 직접 쓴 제목만 이어 씀).
- **O/D**: 생산 현황 오더(컬러가 있는 오더)를 골라 컬러명·**오더 kg**(작지 kg 아님)를 채움. 이미 넣은 줄이 있으면 바꿀지 물어봄 (취소하면 O/D 칸 글자도 원래 O/D로). 메모는 그대로.
  그 오더의 ARTICLE도 같이 — 오더에 연결된 원단, 없으면 **같은 Article 번호의 원단**(대소문자·띄어쓰기 무시, `findFabricForOrder`) → 원사까지 자동.
- **ARTICLE**: 원단 관리 원단을 고르면 원사를 채움 (`fabricYarnOptions`). 수량 단위(kg / YD) 버튼은 표 머리줄 오른쪽.
- **[결과 복사]**: 결과 표를 탭으로 구분한 글자로 복사 → 엑셀·다른 프로그램에 붙여 넣기.
- **저장**: Firestore `yarnDyeCalcs` (새 컬렉션) — 문서
  `{ id: 'ydc_…', kind: 'stripe'|'melange', title(자동 'O/D · ARTICLE'), orderId, orderNumber, fabricId, articleNo, baseYarnName, unit('kg'|'yd'), memo, rows, createdAt, createdBy, updatedAt, updatedBy }`
  - rows — stripe: `[{ id, name, qty, yarns: [{ id, color, pct }] }]` / melange: `[{ id, label, qty }]` (숫자 칸은 숫자 또는 null, 빈 줄은 빼고 저장)
  - 결과(원사별 수량·혼용율)는 저장하지 않고 열 때마다 rows로 다시 계산.
  - 목록은 최근 저장 순(둘째 줄 = 줄 수 · 메모), O/D·Article·메모로 검색, 누르면 불러오기. [삭제]는 복구 불가 확인.
  - [저장]을 눌러도 화면 입력은 그대로 둠 — 저장을 기다리는 동안 더 넣은 값이 사라지지 않게 (그 값은 '저장 안 한 변경'으로 남음).
- **저장 안 한 변경**: 저장될 모양(`cleanCalcForSave`)으로 비교 → 다른 계산 열기·[새로 계산]·계산 종류 전환·**다른 메뉴로 이동**(App `navGuardRef`) 때 '저장할까요?'
  (저장하고 나가기 / 저장 안 함 / 계속 편집). 작성 중인 계산은 훅(App)에 있어서 다른 메뉴에 다녀와도 남아 있음.
  - **[저장 안 함] = 변경을 버림** (`discardDyeCalc` — 불러온 계산은 저장된 모양으로, 새 계산은 빈 양식으로). 안 버리면 다음에 나갈 때마다 또 물어봄.
  - 지금 보고 있는 메뉴를 다시 누르면 아무것도 안 함 (App `requestSetActiveTab` — 괜히 '저장할까요?'가 뜨지 않게, 모든 화면 공통).
- DEV 미리보기: `DEV_LOCAL_SETTERS.yarnDyeCalcs` (저장은 화면 안에서만), 샘플 오더 `F-26M030`(대표님 캡처 컬러·kg) + 샘플 원단 `PW1050`
  (원사 하나 `F/60Nm SW/N 87/13`)로 O/D → ARTICLE → 원사 자동 확인, `GB-2402`(원사 2개)로 원사 고르기 확인.

### 파일
| 역할 | 파일 |
|-----|-----|
| 계산 (순수 함수) | `src/utils/yarnDyeCalc.js` — `computeStripe`·`computeMelange`·`calcFromOrder`·`findFabricForOrder`·`fabricYarnOptions`·`isFabricYarn`·`nextBaseYarnName`·`calcAutoTitle`·`normalizeCalc`·`cleanCalcForSave`·`buildCalcCopyText`·`splitColorName`·`matchKey` |
| 저장·불러오기·삭제 | `src/hooks/domains/useYarnDyeCalc.js` (Firestore `yarnDyeCalcs`, '저장 안 함' 때 변경 버리기 `discardDyeCalc`) |
| 화면 | `src/pages/ProductionCalcPage.jsx` (저장 목록 + 스트라이프/멜란지) |
| 메뉴·연결 | `src/components/layout/Sidebar.jsx` (생산 ▾ 계산기), `src/apps/App.jsx` (구독·DEV 저장·탭) |

---

## 1단계 (완료) — 토대 구축

### 확정된 설계 결정 (유지)

| 항목 | 결정 |
|-----|-----|
| DB 구조 | `orders` 컬렉션 단일. processes/batches/colors/yarnOrders 모두 중첩 배열 |
| 담당자 마스터 | `settings/general.productionAssignees` (원사/편직/그외 3명) |
| 오더 번호 채번 | `O-YYM###` (YY=연도2자리, M=월 알파벳 A~L, ###=3자리 시퀀스) |
| 간트/알람 | **다음 단계**. 1단계에선 없음 |
| 스케줄러 | 클라이언트 로그인 시 일괄 체크 (Firebase Functions 안 씀) |
| 편집 기능 | **다음 단계**. 1단계에선 Toast로 안내만 |
| UX | 마법사 X. **1페이지 6섹션** 스크롤 구조 |
| 원단 연동 | Step1에 "기존 원단 불러오기" 드롭다운. `fabric.yarns`를 비율×총수량으로 환산해 원사 발주 자동 생성 |

### 데이터 모델 (Firestore `orders` 컬렉션)

```
orders/{orderNumber}
├── id = orderNumber
├── orderNumber: "O-26D001"
├── orderName, customer, brand, type, dyeingMethod
├── totalQuantity, unit
├── finalDueDate, estimatedDueDate (계산됨)
├── defaultDailyKnittingCapacity, useKnitterStockYarn
├── colors: [{ name, quantity }]
├── status: "active" | "completed" | "on_hold" | "delayed_risk"
├── assignees: { yarnAssignee, knittingAssignee, othersAssignee }
├── processes: [{
│     id, processType, isActive, sequenceOrder, isParallelTrack,
│     assigneeRole, processingType?, processingDays?, brandConfirmBufferDays?,
│     yarnOrders?: [{ id, yarnTypeId, yarnTypeName, color, totalQuantity, supplier,
│                      deliveries: [{id, deliveryNumber, quantity,
│                                    plannedArrivalDate, expectedArrivalDate, actualArrivalDate, status}] }],
│     batches: [{ id, batchNumber, batchType, batchLabel, quantity,
│                  colors: [{color, quantity, sourceYarnOrderId?}],
│                  plannedStartDate, plannedEndDate,
│                  expectedEndDate, actualStartDate, actualEndDate,
│                  dailyCapacityOverride?, status,
│                  reworkEvents: [], delayReason?, notes? }]
│   }]
├── createdBy, createdAt, updatedAt, notes
```

### 공정 타입 7종 (기획서 1.7 본문은 "8종"이라 하나 실제 리스트는 7개 — 기획서 오타)

```javascript
PROCESS_TYPES = [
  { key: 'yarn',              assigneeRole: 'yarn',     defaultSequence: 1, isParallelTrack: false },
  { key: 'yarn_processing',   assigneeRole: 'others',   defaultSequence: 2, isParallelTrack: false },
  { key: 'lab_dip',           assigneeRole: 'others',   defaultSequence: 3, isParallelTrack: true  },
  { key: 'knitting',          assigneeRole: 'knitting', defaultSequence: 4, isParallelTrack: false },
  { key: 'dyeing',            assigneeRole: 'others',   defaultSequence: 5, isParallelTrack: false },
  { key: 'visual_inspection', assigneeRole: 'others',   defaultSequence: 6, isParallelTrack: false },
  { key: 'physical_test',     assigneeRole: 'others',   defaultSequence: 7, isParallelTrack: false },
]
```

### 1단계에서 만든 파일

```
src/constants/production.js          (상수)
src/utils/orderCalculations.js       (납기 계산·채번·건강도 등 순수 함수)
src/hooks/domains/useOrder.js        (CRUD + 마법사 핸들러 + applyFabricTemplate)
src/pages/OrderWizardPage.jsx        (1페이지 6섹션 폼)
src/pages/OrderListPage.jsx          (목록 + 요약 카드 + 필터)
src/components/order/
  ├── wizard/
  │   ├── Step1BasicInfo.jsx         (기본정보 + 원단 불러오기)
  │   ├── Step2Colors.jsx            (컬러 등록)
  │   ├── Step3ProcessSelection.jsx  (활성 공정 체크)
  │   ├── Step4ProcessDetails.jsx    (공정별 차수/발주)
  │   ├── Step5Schedule.jsx          (계획 일자)
  │   └── Step6Review.jsx            (검토 요약)
  ├── OrderDetailModal.jsx           (상세 모달)
  ├── DesktopOrderRow.jsx            (목록 테이블 행)
  └── MobileOrderCard.jsx            (목록 모바일 카드)
```

수정한 파일: `src/apps/App.jsx`, `src/components/layout/Sidebar.jsx`.

### 1단계 핵심 검증 룰 (구현됨)

1. 선염 + 편직처 원사 충돌 방지
2. 예상납기 > 최종납기면 적색 경고 + `status='delayed_risk'` 자동 제안
3. 컬러 수량 합 = 총수량
4. 배치 수량 합 = 총수량 (±1% 허용)
5. 차수 start ≤ end
6. 편직 공정 최소 1개 활성
7. 오더번호 자동 채번 (충돌 시 재시도)
8. 후염 오더는 `yarn_dyeing` 사가공 불가

### 1단계에서 포함하지 **않은** (다음 단계로 미룬) 항목

- 간트 차트 뷰
- 칸반 보드 뷰
- 대시보드 / Daily Briefing
- D-day 알람, 응답 게이트, 확인 게이트
- 재작업 이벤트, 강제 진행 결정
- Risk Scanner
- 3단 완료일 중 expected/actual 변경 UI (필드만 준비됨)
- 오더 편집 기능
- 담당자 마스터 관리 UI (Firestore 콘솔 수동 입력)
- 특별 휴일 경고 / 공휴일 캘린더

---

## 1단계 후속 v2 — 시작점 도입 + 폼 단순화 (완료)

### 변경 결정 사항

| 항목 | 변경 내용 |
|-----|----------|
| 데이터 모델 | `dyeingMethod` 폐기, `startStage`(yarn/knitting/finished_fabric) 추가, `quantityYd`/`quantityKg`/`articleNo`/`gsm`/`widthFull` 신규 |
| 공정 enum | L/D 제거, 후가공 추가 (총 7종, 모두 직렬) |
| 오더번호 | 자동채번 폐기 → **사용자 수동 입력** (자체번호) |
| 차수 | 공정 활성화 시 **1차 자동 생성** (수량=총수량, 종료일=공정 dueDate) |
| 공정별 일정 | 공정 dueDate 1개만 등록, 차수 plannedEndDate와 자동 동기화 |
| 새창 모달 | OrderTypeModal(6조합), ProcessSelectionModal(7종 체크) |
| 단위 | YD 주, KG 자동 환산 (gsm × widthFull × 0.02322576 / 1000) |
| 시작점 잠금 | `START_STAGE_DEACTIVATIONS` 기준 이전 공정 자동 비활성 + 잠김 |

### 변경/추가 파일
- 수정: `constants/production.js`, `utils/orderCalculations.js`, `hooks/domains/useOrder.js`,
  `components/order/wizard/Step1BasicInfo.jsx`, `components/order/wizard/ProcessPlanSection.jsx`,
  `pages/OrderWizardPage.jsx`, `pages/OrderListPage.jsx`,
  `components/order/DesktopOrderRow.jsx`, `components/order/MobileOrderCard.jsx`,
  `components/order/OrderDetailModal.jsx`, `apps/App.jsx`
- 신규: `components/order/modals/OrderTypeModal.jsx`, `components/order/modals/ProcessSelectionModal.jsx`
- 삭제: 1단계 후속 v1에서 이미 Step3-6 삭제됨

### 폐기된 로직
- 선염/후염(`dyeingMethod`) — 시작점 모델로 대체
- 자동 오더번호 채번(O-YYM###) — 사용자 수동 입력으로 변경
- L/D 공정 — `PROCESS_TYPES`에서 제거
- 공정별 차수/발주 상세 입력 (등록 폼) — 등록 후 상세 페이지에서 보강 예정

---

## 1단계 후속 v3 — 사종별 편직처 + 일정 자동 계산 (완료)

### 변경 결정 사항

| 항목 | 변경 내용 |
|-----|----------|
| ART 직접 입력 | **제거** — 원단 라이브러리에서만 선택 가능 |
| `defaultDailyKnittingCapacity` | **폐기** (UI 필드 + 데이터 모델 모두) |
| `useKnitterStockYarn` (오더 전역) | **폐기** → `yarnOrder.useKnitterStock` (사종별 토글) |
| 공정 일정 입력 | `dueDate` 폐기 → `startDate` + `durationDays` (종료일 자동 계산) |
| 시작일 자동 채움 | `startDate` 비우면 이전 활성 공정 `effectiveEnd`로 자동 |
| 종료일 표시 | `effectiveEnd` 자동, 읽기 전용 |
| 알람/확인게이트 | **개발 안 함** (대표님 결정) |

### 새 유틸 함수 (`utils/orderCalculations.js`)
- `enrichProcessesWithEffectiveDates(order)`: 활성 공정에 `effectiveStart`/`effectiveEnd` 추가 (sequenceOrder 순)
- `calcEstimatedDueDate(order)`: 마지막 활성 공정의 `effectiveEnd`
- `analyzeProcessOverruns(order)`: 사용자가 `startDate` 직접 입력 시 시퀀스 위반 + 마지막 공정 `effectiveEnd` > `finalDueDate` 검출

### 새 핸들러 (`hooks/domains/useOrder.js`)
- `updateProcessSchedule(processType, field, value)`: field='startDate' | 'durationDays'
- `toggleYarnOrderKnitterStock(yoId, value)`: 사종별 편직처 보유 원사 토글
- `setAllYarnOrdersKnitterStock(value)`: "전체 편직처/전체 발주" 단축 액션

### UI 변경 핵심
- **Step1BasicInfo**: ART 직접 입력 input 삭제, 일일 편직량 필드 삭제
- **ProcessPlanSection**:
  - 공정 카드에 (시작일, 소요일수) 입력란 + 종료일 자동 표시
  - 시작일 비우면 placeholder + 회색 톤으로 "이전 공정 종료일 자동" 안내
  - 원사 카드 안에 사종별 yarnOrder 리스트 (각각 편직처 체크박스)
  - 편직처 체크 시 발주 관리(공급처/입고차수) 숨김
  - "전체 편직처 사용" / "전체 발주로 전환" 단축 버튼
- **ProcessSelectionModal**: useKnitterStockYarn prop 폐기 (원사 공정 잠금 로직 삭제)
- **OrderDetailModal**: 공정 헤더에 "시작일 ~ 종료일 (N일)" 표시 (effectiveDates 기반)

---

## 2단계 1차 (2-A) — 오더 상세에서 상태/일정 수정 (완료)

### 결정 사항
| 항목 | 결정 |
|-----|-----|
| 위치 | 기존 `OrderDetailModal` 확장 (별도 페이지 X) |
| 차수 추가/삭제 | 가능 |
| 상태 '완료' → actualEndDate | 오늘 날짜 자동 + 수정 가능 |

### 구현 (OrderDetailModal.jsx 대폭 재작성)

**state 관리**
- `draft`: 선택된 오더의 deep clone (편집 작업 영역)
- `editing`: 편집 모드 토글
- `dirty`: 변경사항 존재 여부 (저장 안 한 채 닫기 시 confirm 표시)

**편집 모드 진입/종료**
- 헤더 [편집] → 모든 필드 inline input/select 활성화
- [저장]: `saveDocToCloud('orders', {...draft, updatedAt: now})` + Toast + 읽기 모드 복귀
- [취소]: dirty면 confirm, draft 복원 + 읽기 모드 복귀
- 모달 외부 클릭/X 버튼: dirty면 confirm

**자동 날짜 로직** (PROGRESS_STATUSES / COMPLETE_STATUSES 정의)
- batch.status를 진행중 상태로 → actualStartDate 비어있으면 today
- batch.status를 완료 상태로 → actualEndDate 비어있으면 today
- delivery.status를 '입고완료'로 → actualArrivalDate 비어있으면 today
- 이미 값 있으면 보존 (수동 수정 우선)

**편집 가능 항목**
- 오더: status / finalDueDate / notes
- 공정: startDate / durationDays (종료일 자동)
- 차수: batchLabel / quantity / status / planned/expected/actualEndDate / colors / notes
- 차수 추가/삭제 (각 공정 카드 안에서)
- 원사 발주: useKnitterStock 토글 / supplier / deliveries 추가·삭제·수량·도착일·status

### 추가/수정 파일
- `src/components/order/OrderDetailModal.jsx` (대폭 재작성, 약 700 LOC)
- `src/apps/App.jsx` (saveDocToCloud, showToast prop 전달)

### 다음 라운드 (선택지)
- **2-F** 오더 전체 편집 (등록 마법사 재사용 + "재계획" 액션)
- **2-B** 간트 차트 뷰

---

## v4 — 담당자 시스템 전체 폐기 (완료)

### 결정 배경
대표님 결정: **"담당자 지정해서 관리하는 거 없애자"**
- 알람 시스템도 폐기됐고, 외주처(편직소·염색소) 자체가 외부 업체라 내부 담당자 라우팅이 큰 의미 없음
- 데이터/UI 모두 단순화

### 폐기된 항목
- `Order.assignees` 필드 (원사/편직/그외 3명 스냅샷)
- `Process.assigneeRole` 필드 (yarn/knitting/others)
- `settings/general.productionAssignees` (마스터 데이터)
- `ASSIGNEE_ROLES` 상수
- 모든 UI에서 "담당: ..." 라벨/카드 제거
- 2-E (담당자 마스터 관리 UI) 작업 자체 취소

### 변경 파일
- `src/constants/production.js` — ASSIGNEE_ROLES 제거, PROCESS_TYPES에서 assigneeRole 제거
- `src/hooks/domains/useOrder.js` — getInitialOrderInput에서 assignees 제거, makeInitialProcess에서 assigneeRole 제거, useOrder 시그니처에서 productionAssignees 제거, handleSaveOrder에서 assignees 스냅샷 로직 제거
- `src/components/order/wizard/ProcessPlanSection.jsx` — 공정 카드 "담당: ..." 라벨 제거
- `src/components/order/modals/ProcessSelectionModal.jsx` — 공정 카드 "담당: ..." 표시 제거
- `src/components/order/OrderDetailModal.jsx` — 담당자 카드 제거 (3단 → 2단), 공정 헤더 "담당 ..." 제거
- `src/apps/App.jsx` — productionAssignees state/구독/prop 제거

### 호환성
기존에 등록된 오더 문서의 `assignees`/`assigneeRole` 필드는 그대로 남아있지만 UI에서 참조 안 함. 별도 마이그레이션 불필요.

---

## 2단계 2차 (2-F) — 오더 전체 편집 (완료)

### 결정 사항
| 항목 | 결정 |
|-----|-----|
| 진입 위치 | OrderDetailModal 헤더에 `[전체 편집]` 버튼 (빠른 편집과 별도) |
| 편집 화면 | 등록 마법사 (`OrderWizardPage`) **재사용** — 별도 폼 안 만듦 |
| orderNumber | **수정 불가** (Firestore 문서 ID 일관성 유지) |
| 기존 actual 진행 데이터 | **보존** (deep clone, batches/yarnOrders의 actual* 필드 유지) |
| 편집 모드 시각 표시 | 헤더 amber 톤 + "수정 중: O-001" 배지 + [수정 저장] / [편집 취소] 버튼 |

### 동작 흐름
1. 오더 목록 → 행 클릭 → 상세 모달
2. 모달 헤더 [전체 편집] 클릭 → `handleEditOrder(order)` → orderInput에 deep clone 로드, editingOrderId 설정 → 모달 닫힘 → activeTab='orderWizard'
3. 마법사 화면이 amber 톤으로 변경, "수정 중" 배지 표시
4. 거래처/시작점/공정/차수/일정 등 자유 편집
5. orderNumber만 readonly (slate 배경)
6. [수정 저장] 클릭 → `handleSaveOrder`가 `isNew=false`로 분기 → 기존 createdAt/createdBy 보존, updatedAt만 갱신
7. 저장 성공 → resetOrderForm + activeTab='orderList'

### 변경 파일 (4개)
- `src/hooks/domains/useOrder.js` — `handleEditOrder(order)` 실제 구현 (toast 대신 deep clone)
- `src/components/order/OrderDetailModal.jsx` — 헤더에 [전체 편집] 버튼 추가, [빠른 편집]과 분리
- `src/pages/OrderWizardPage.jsx` — `editingOrderId` prop 받아 헤더/버튼 라벨 변경 (amber 톤)
- `src/components/order/wizard/Step1BasicInfo.jsx` — 수정 모드일 때 orderNumber readonly
- `src/apps/App.jsx` — `handleEditOrderToWizard` 헬퍼 (모달 닫고 마법사로 이동), prop 전달

### 두 편집 모드의 차이
| | 빠른 편집 (모달 내) | 전체 편집 (마법사) |
|--|------|------|
| 위치 | 상세 모달 안 | 마법사 페이지로 이동 |
| 편집 가능 항목 | 상태/일정/차수/원사 발주 | **모든 것** (거래처/시작점/공정 활성화/ART 등 포함) |
| 사용 시점 | 일상 운영 (상태 기록, 차수 추가) | 구조적 변경 (오더 메타 변경, 공정 추가 등) |

---

## 2단계 로드맵 (다음 작업)

목표: **오더 등록 후의 "생산 진행 관리" 최소 기능**을 붙여서 실사용 가능 상태로 끌어올림.

### 2-A. 오더 상세에서 상태 변경 + 3단 완료일 기록
- 지금은 읽기 전용. 각 차수/입고에 대해:
  - 상태 드롭다운 변경
  - `actualStartDate` / `actualEndDate` 입력
  - `expectedEndDate` 수동 조정
- 변경 시 `updatedAt` 갱신, 상태별 색상 반영
- 파일 후보: `OrderDetailModal.jsx` 리팩토링 or `OrderDetailPage.jsx` 신규

### 2-B. 간트 차트 뷰 (기획서 4.5)
- Tailwind 자체 구현 (라이브러리 X)
- 한 오더 선택 → 가로=시간(주 단위), 세로=공정×차수
- 바 이중 표시: 계획(회색) + 예상(컬러)
- L/D 보라 트랙
- 인터랙션: 클릭=팝오버, 호버=3단 완료일 툴팁
- 파일 후보: `src/pages/OrderGanttPage.jsx` + `src/components/order/gantt/*`

### 2-C. D-day 알람 (기획서 3.8)
- 클라이언트 로그인 시 일괄 체크 방식 (확정됨)
- `lastAlertCheckAt` 유저별 저장 (localStorage 또는 Firestore user profile)
- 각 batch의 `expectedEndDate - today`가 `[25,17,12,7,3]`이면 AlertLog 생성
- 인앱 알림: ERP 상단 종 아이콘 + 드롭다운 (기존 UI에 추가)
- 응답 게이트 3지선다: [정상] / [지연 N일] / [당김 N일]
- 파일 후보: `src/hooks/domains/useAlert.js`, `src/components/common/AlertBell.jsx`

### 2-D. 확인 게이트 (기획서 3.6)
- 알람 응답 or 재작업 추가 시 **후공정에 ChangeConfirmation 자동 생성**
- 후공정 담당자에게 모달 띄움
- 선택지: [적용] / [단축 방안 입력] (지연) / [당겨서 적용] / [원래대로 유지] (당김)
- Firestore 컬렉션: `changeConfirmations` (오더와 분리 — 조회 빈도 낮음)

### 2-E. 담당자 마스터 관리 UI
- 지금은 Firestore 콘솔 수동 입력. 설정 페이지 만들어서 마법사 UX로 이관.
- 기존 `MasterDataModal.jsx` 패턴 재사용 가능

### 2-F. 오더 편집
- 현재는 Toast 안내만. 편집 모드 진입 → 마법사 재사용
- **제약**: `planned_end_date`는 오더 구조 재계획 이벤트에서만 변경 (기획서 3.5)
- 일반 필드(메모/담당자 등)만 자유 편집, 구조 변경(공정 활성화, 수량, 차수)은 별도 "재계획" 버튼

### 권장 실행 순서
1. 2-A (상태 변경) ← 사용자가 가장 먼저 체감함
2. 2-E (담당자 마스터) ← 간단, 운영 편의
3. 2-F (오더 편집) ← 필수 보완
4. 2-B (간트) ← 시각화 가치 큼, 독립 작업
5. 2-C + 2-D (알람 + 확인 게이트) ← 함께 개발해야 일관성

---

## 3단계 로드맵 (더 나중)

- **대시보드 + Daily Briefing** (기획서 4.3, 3.10)
- **칸반 보드** (기획서 4.6) — 기존 `DevStatusPage.jsx` 자체 구현 스타일 참고
- **Risk Scanner** (기획서 3.9) — 관리자 규칙 설정 페이지 포함
- **Fail 처리 4지선다** (기획서 3.7)
- **납기 초과 위험 대응** (기획서 3.6 말미)
- **특별휴일 경고** (5일+ 연휴 감지)

---

## 4단계 로드맵 (마지막)

- 감사 로그 / 변경 이력 (모든 상태 변경의 히스토리)
- 리포트 (지연 통계, 재작업 분석, 담당자별 성과)
- 자연어 Q&A (선택)

---

## 확정된 기술 선택 (변경 금지)

- 간트/칸반: Tailwind 자체 구현 (라이브러리 X)
- 스케줄러: 클라이언트 로그인 시 체크 (Firebase Functions X)
- DB 구조: `orders` 단일 컬렉션 + 중첩 배열
- 한국어 UI, 달력 기준 일수 계산 (Working Day X)
- 색상 시스템: 기획서 4.1 (녹/황/적/회/청/보라)

---

## 새 세션에서 이 문서를 사용하는 법

1. 프로젝트 루트에서 Claude Code 시작 → CLAUDE.md 자동 로드됨
2. **"생산 스케줄 다음 단계 이어서 하자"** 라고 말하면:
   - Claude가 `docs/production-schedule-spec.md`로 기획서 파악
   - `docs/production-schedule-plan.md`(이 파일)로 현재 진행 상황 파악
   - `git log`로 커밋 이력 확인
   - 2단계 다음 항목부터 제안
3. 대표님이 "2-A부터 하자"고 지시 → Claude가 작업 브리핑 후 코드 시작

---

**이 플랜 파일은 작업이 진행되면서 업데이트된다. 단계 완료 시 체크 + 커밋 해시 기록 + 회고 코멘트 추가.**
