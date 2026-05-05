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
| **4단계**: 감사 로그 + 리포트 (1차) | ✅ **완료** | (이번 작업) |

> **🎉 Phase 1 운영 가능 상태 도달** — 등록/편집/시각화/모니터링 모두 1차 완성. 이제 사용해보면서 세부 다듬기.
> 알람/확인게이트는 개발하지 않기로 결정 (대표님 지시).

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
