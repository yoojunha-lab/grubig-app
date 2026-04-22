# 생산 스케줄 모듈 — 구현 플랜 & 진행 상황

> **이 문서는 `docs/production-schedule-spec.md`(기획서 원본)의 구현 플랜이다.**
> 새 단계 작업 시작 시: **spec을 먼저 읽고 → 이 plan을 읽어** 현재 진행 상황과 다음 단계를 파악할 것.

---

## 현재 진행 상황 요약

| 단계 | 상태 | 커밋 |
|-----|------|-----|
| **1단계**: 데이터 모델 + 오더 등록 + 목록/상세 | ✅ **완료** | `9929b3b — feat: 원단 생산 오더 스케줄 관리 모듈 1단계 구현` |
| 2단계: 간트 차트 + 알람 + 확인 게이트 | ⏳ 대기 | - |
| 3단계: 대시보드 + 칸반 + Risk Scanner | ⏳ 대기 | - |
| 4단계: 감사 로그 + 리포트 | ⏳ 대기 | - |

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
