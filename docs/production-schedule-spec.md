# 원단 생산 스케줄 관리 시스템 (ERP 모듈)

## 0. 프로젝트 컨텍스트

이 시스템은 **기존 ERP에 추가되는 모듈**이다. 원단 생산 오더의 공정별 스케줄을 관리하고, 최종 납기 준수를 시스템이 적극적으로 보장하도록 설계된 "생산 에이전트" 시스템이다.

**핵심 가치**:
- 단순 스케줄 트래커가 아닌 **능동적 납기 보장 시스템**
- 각 공정의 지연/당김이 후공정에 자동 전파되어 실시간 영향도 파악
- 담당자에게 매일 "오늘 챙길 것"을 알려주는 에이전트 역할
- 모든 일정 변경은 **확인 게이트**를 거쳐 담당자 판단 존중

**구현 시 원칙**:
- 기존 ERP에 모듈로 통합됨을 전제로 설계
- ERP의 아이템/사종/고객/담당자 테이블과 연동 (구체적 방식은 구현 중 확인)
- 한국어 UI, KST 시간대, 한국 공휴일 참조
- 모호하거나 판단이 필요한 부분은 구현 전 사용자에게 질문할 것

---

## 1. 도메인 용어집 (Glossary)

| 용어 | 영문 | 설명 |
|-----|------|------|
| 오더 | Order | 고객 브랜드로부터 받은 원단 생산 건 (메인/샘플) |
| 공정 | Process | 원단 생산의 한 단계 (총 8종) |
| 차수 | Batch | 공정 내 시간/수량 분할 단위 (1차/2차/3차...) |
| 컬러 | Color | 오더에서 생산할 색상. 공정마다 컬러 관리 방식 다름 |
| 선염 | Yarn-dyed | 원사를 먼저 염색한 후 편직 |
| 후염 | Post-dyed | 편직한 원단을 염색 (일반적 방식) |
| 사종 | Yarn Type | 원사의 종류 (예: Cotton 30/1 Combed). ERP에서 관리 |
| 생지 | Greige | 편직 완료되었으나 염색 전인 원단 |
| L/D | Lab Dip | 염색 투입 전 컬러 매칭 작업 |
| 브랜드 컨펌 | Brand Confirm | 염가공 중 가공지를 브랜드에 보내 승인받는 절차 (염가공에 귀속) |
| 공정 담당자 | Assignee | 원사/편직/그외 3가지 롤로 고정 |
| 3단 완료일 | Planned/Expected/Actual End Date | 계획/예상/실제 완료일을 별도 관리 |
| Working Day | - | 사용하지 않음. 모든 소요일은 **달력 기준** |

### 8개 공정
1. **원사** (Yarn) - 원사 발주 및 입고 관리
2. **사가공** (Yarn Processing) - 연사/분콘/사염
3. **L/D** (Lab Dip) - 컬러 매칭 (병렬 트랙)
4. **편직** (Knitting) - 임편직 (외주)
5. **염가공** (Dyeing & Finishing) - 염색 + 후가공 + 브랜드 컨펌
6. **외관검사** (Visual Inspection) - 차수 × 컬러 단위
7. **이화학검사** (Physical/Chemical Test) - 컬러 단위

> 구현 주석: 기획서 본문은 "총 8종"이라 명기하나 실제 열거는 7개. 구현에서는 **7종**으로 처리(기획서 오타로 판단). 염가공 내부의 "염색 / 후가공 / 브랜드 컨펌"을 합산해서 8로 센 것으로 추정.

### 3가지 담당자 롤
- **원사 담당자**: 원사 공정 전담
- **편직 담당자**: 편직 공정 전담
- **그외 담당자**: 사가공, L/D, 염가공, 외관검사, 이화학검사 담당
- 시스템 설정에서 3명의 이름/연락처 등록

---

## 2. 데이터 모델

### 2.1 Order (오더)

```
Order
├── id
├── order_number (유니크 식별자)
├── order_name
├── customer, brand (ERP 고객 테이블 참조)
├── type: "main" | "sample"
├── dyeing_method: "post_dyed" | "yarn_dyed"
├── total_quantity
├── unit: "kg" | "yd"
├── final_due_date (최종 납기, 고정 목표)
├── estimated_due_date (실시간 계산)
├── default_daily_knitting_capacity (기본 일일 편직량)
├── use_knitter_stock_yarn (편직처 보유 원사 사용 여부, 선염 시 사용 불가)
├── colors[] (이 오더에서 생산할 컬러 리스트, 후염이면 염가공 시점부터 의미)
├── status: "active" | "completed" | "on_hold" | "delayed_risk"
├── assignees (원사/편직/그외 담당자 자동 배정)
├── created_at, updated_at, notes
└── Processes [1:N]
```

**제약 조건**:
- `dyeing_method = "yarn_dyed"` 이면 `use_knitter_stock_yarn = false` 강제
- `type = "sample"` 이면 `brand_confirm_buffer_days = 0` 기본값

### 2.2 Process (공정)

```
Process
├── id, order_id
├── process_type: "yarn" | "yarn_processing" | "lab_dip" | "knitting" | "dyeing" | "visual_inspection" | "physical_test"
├── is_active (bool)
├── sequence_order (직렬 순서, 1~7)
├── is_parallel_track (bool, L/D만 true)
├── assignee_role: "yarn" | "knitting" | "others"
├── processing_type (사가공 전용: "twisting" | "reconing" | "yarn_dyeing")
├── processing_days (염가공 전용: 염색+가공 일수)
├── brand_confirm_buffer_days (염가공 전용: 브랜드 컨펌 대기 일수)
└── 파생 필드 (차수로부터 계산)
    ├── planned_start_date = min(batches.planned_start_date)
    ├── planned_end_date = max(batches.planned_end_date)
    ├── expected_end_date = max(batches.expected_end_date)
    └── actual_end_date = max(batches.actual_end_date) if all completed else null
```

**제약 조건**:
- 후염 오더 + 사가공 공정: `processing_type ∈ {"twisting", "reconing"}` (사염 불가)
- 선염 오더 + 사가공 공정: `processing_type` 자유

### 2.3 Batch (차수) - 원사 제외

```
Batch
├── id, process_id
├── batch_number (1, 2, 3...)
├── batch_type: "sequential" | "inspection_unit" (검사형은 inspection_unit)
├── batch_label (표시용: "1차" 또는 "Navy" 등)
├── quantity
├── BatchColor[] (컬러 관리 공정만)
│   ├── color
│   ├── quantity
│   └── source_yarn_order_id (선염 편직 시 원사 연결)
│
├── planned_start_date (최초 계획, 불변)
├── planned_end_date (최초 계획, 불변)
├── expected_end_date (현재 예상 완료일, 수정 가능)
├── actual_start_date (실제 시작, 담당자 기록)
├── actual_end_date (실제 완료, 담당자 기록)
│
├── daily_capacity_override (편직 차수만, nullable)
├── status (공정별 enum)
├── rework_events[] (재작업 이력)
├── delay_reason (지연 사유)
└── notes
```

**3단 완료일 규칙**:
- `planned_end_date`: 오더 등록 시 확정, 오더 재계획 이벤트로만 변경
- `expected_end_date`: 초기값 = planned, 알람 응답/재작업/담당자 수정으로 변경
- `actual_end_date`: 담당자가 상태를 "완료"로 바꿀 때 기록

### 2.4 YarnOrder & YarnDelivery (원사 공정 전용)

```
YarnOrder (원사 발주 1건)
├── id, process_id (원사 공정)
├── yarn_type_id (ERP 사종 테이블 참조)
├── yarn_type_name
├── color (색사 구매 시, 선염 오더에서만 사용. 후염이면 null)
├── total_quantity
├── supplier
└── YarnDelivery[] (시간차 분할 입고)
    ├── delivery_number (1차/2차/3차)
    ├── quantity
    ├── planned_arrival_date
    ├── expected_arrival_date (3단 구조)
    ├── actual_arrival_date
    └── status: "발주대기" | "생산중" | "운송중" | "입고대기" | "입고완료" | "보류"
```

**노트**: 원사는 "사종별 × 시간차" 두 차원 분할 가능. YarnOrder가 사종 단위, YarnDelivery가 시간차 단위.

### 2.5 공정별 상태 Enum

| 공정 | 상태 리스트 |
|-----|-----------|
| 원사 (Delivery) | 발주대기 / 생산중 / 운송중 / 입고대기 / 입고완료 / 보류 |
| 사가공 | 대기중 / 가공중 / 완료 / 보류 |
| L/D | 의뢰준비 / 의뢰중 / 컨펌대기 / Pass / Fail / 재진행중 |
| 편직 | 대기중 / 투입예정 / 편직중 / 보류 / 완료 |
| 염가공 - 염색/가공 | 염색대기 / 투입예정 / 염색중 / 가공중 / 가공완료 / 재가공중 / 보류 |
| 염가공 - 브랜드 컨펌 (컬러 단위) | 대기 / 가공지발송 / 컨펌중 / Pass / Fail / 재컨펌중 |
| 외관검사 | 대기 / 진행중 / Pass / Fail / 완료 |
| 이화학검사 | 대기 / 진행중 / Pass / Fail / 재test중 / 완료 |

### 2.6 ReworkEvent (재작업 이력)

```
ReworkEvent
├── id, batch_id (이 차수에 추가됨)
├── trigger_source_batch_id (어디서 Fail이 트리거했나)
├── rework_type: "retry_same" | "upstream_rework" | "retest_only" | "accept_and_ship"
├── additional_days (추가 소요일)
├── reason (사유, 필수)
├── created_by, created_at
└── resolved_at
```

### 2.7 ForcedProgressDecision (강제 진행 기록)

```
ForcedProgressDecision
├── id, batch_id, process_type
├── failure_reason (Fail 사유)
├── force_reason (왜 강제 진행하는지, 필수)
├── decided_by (담당자명)
├── decided_at
├── attached_documents (선택)
└── customer_notified (bool)
```

**노트**: 관리자 승인 불필요, 담당자 자율 결정. 단 사후 관리자 검토 대시보드에 노출.

### 2.8 AlertLog & AlertResponse

```
AlertLog
├── id, batch_id
├── d_day (25 | 17 | 12 | 7 | 3)
├── triggered_at

AlertResponse
├── id, alert_log_id
├── response_type: "on_schedule" | "delay_expected" | "ahead_of_schedule"
├── delta_days (지연 또는 당김 일수)
├── responded_by, responded_at
└── downstream_notified (bool)
```

### 2.9 ChangeConfirmation (일정 변경 확인 게이트)

```
ChangeConfirmation
├── id
├── trigger_event (지연/당김 원인 설명)
├── affected_batch_id (후공정 차수)
├── assignee_role (응답해야 할 담당자)
├── old_expected_end_date
├── proposed_expected_end_date
├── delta_days
├── response: "apply" | "reject_with_mitigation" (지연 시) | "apply" | "keep_original" (당김 시)
├── mitigation_days (단축 방안 입력, 지연 거절 시)
├── mitigation_reason
├── responded_at
└── status: "pending" | "responded" | "escalated"
```

### 2.10 SystemSetting

```
SystemSetting
├── standard_lead_times (공정별 기본 소요일 JSON)
├── holiday_calendar (한국 공휴일 + 자체 휴무일)
├── special_holiday_alerts (연휴 5일+ 경고 설정)
├── assignees (원사/편직/그외 3명 정보)
├── alert_d_days (기본 [25,17,12,7,3])
├── main_default_active_processes[] (메인 오더 기본 활성 공정)
├── sample_default_active_processes[] (샘플 오더 기본 활성 공정)
├── risk_scanner_rules[] (관리자 설정 가능)
└── erp_integration_config (ERP 연동 설정)
```

---

## 3. 비즈니스 로직

### 3.1 오더 등록 플로우

1. **기본 정보 입력**: 오더명, 고객(ERP 참조), 타입(메인/샘플), 총 수량, 최종 납기, 염색 방식(선염/후염)
2. **컬러 등록**: 이 오더에서 생산할 컬러 리스트 입력
3. **활성 공정 선택**: 시스템 설정의 기본값 자동 체크, 사용자 조정 가능
4. **편직처 보유 원사 체크**: 선택 시 원사 공정 남기되 발주 관리 비활성 (선염이면 체크 불가)
5. **공정별 차수 설정**:
   - 원사: YarnOrder 리스트 (사종 선택 → ERP에서 로드) + YarnDelivery (시간차 분할)
   - 편직: 차수별 수량, 일일 편직량 오버라이드
   - 염가공: 차수별 포함 컬러 지정 (1차=Navy+White, 2차=Beige 등)
   - 외관검사: 염가공 차수 × 컬러에서 자동 생성
   - 이화학검사: 컬러별 자동 생성
6. **공정별 계획 일자 입력**: 차수별 planned_start_date, planned_end_date
7. **납기 자동 계산**: 후술 3.4 로직
8. **final_due_date 대비 estimated_due_date 검증**: 초과 시 경고
9. **오더 확정 및 담당자 자동 배정**

### 3.2 공정 활성화 규칙

| 플래그 | 영향 |
|--------|------|
| `use_knitter_stock_yarn = true` | 원사 공정은 "체크박스"로만 남음 (발주 관리 생략) |
| `dyeing_method = "yarn_dyed"` | 원사부터 컬러 관리 시작 |
| `dyeing_method = "post_dyed"` | 염가공부터 컬러 관리 시작 |
| `type = "sample"` | 관리자 설정 기본값 적용 (보통 외관검사/이화학검사 비활성) |

### 3.3 공정 의존성 규칙

**기본 원칙**: 시스템은 계획을 저장만 하고, 실제 진행은 담당자 자율.

**직렬 순서** (시스템 고정):
```
원사 → 사가공 → 편직 → 염가공 → 외관검사 → 이화학검사
L/D는 병렬 트랙 (원사/편직과 동시 진행, 염가공 시작 전 완료 필요)
```

**차수 단위 병렬 허용**: 담당자가 "원사 1차만 입고됐는데 편직 1차 시작" 같은 자율 판단 가능. 시스템은 경고 없음.

**선염 편직 시작 가능일** (참고치만 표시, 강제 아님):
```
편직_차수_최소시작일 = min(해당 컬러들의 원사 1차 입고일)
```

### 3.4 납기 계산 로직

**계산 방식**: 활성 공정 소요일 단순 합산 (달력 기준)

```python
def calculate_estimated_due_date(order):
    # 각 공정의 소요일 합산
    process_durations = []
    
    for process in order.active_processes:
        if process.is_parallel_track:  # L/D
            continue  # 주 경로에서 제외
        
        # 차수별 소요일 합산 (차수가 여러 개면 순차 진행 전제)
        process_duration = sum(
            (batch.planned_end_date - batch.planned_start_date).days
            for batch in process.batches
        )
        process_durations.append(process_duration)
    
    # 염가공은 processing_days + brand_confirm_buffer_days 분리
    if dyeing in active_processes:
        dyeing_duration = dyeing.processing_days + dyeing.brand_confirm_buffer_days
        # (염가공 공정 소요일에 반영)
    
    total_duration = sum(process_durations)
    estimated_due_date = order.start_date + timedelta(days=total_duration)
    
    return estimated_due_date
```

**노트**:
- Working day 계산 없음, 달력 기준
- 특별휴일(5일+ 연휴)이 공정 기간에 포함되면 경고만 표시 (계산에 반영 안 함)
- L/D는 주 경로에서 제외 (병렬 트랙으로 가정하고 원사+편직 기간 내 완료된다고 가정)

### 3.5 3단 완료일 관리

각 Batch는 세 개의 완료일을 가진다:

| 필드 | 정의 | 변경 조건 |
|------|------|----------|
| `planned_end_date` | 최초 계획 | 오더 구조 재계획 시에만 |
| `expected_end_date` | 현재 예상 | 알람 응답, 재작업 추가, 담당자 수동 수정 |
| `actual_end_date` | 실제 완료일 | 담당자가 상태를 "완료"로 변경할 때 기록 |

**재계산 트리거 표**:

| 이벤트 | planned 변경 | expected 변경 | actual 기록 | 후공정 영향 |
|-------|------------|--------------|------------|-----------|
| 실제 시작일 기록 | ❌ | ❌ | 시작만 | 없음 |
| 실제 완료일 < 예상 (빨리 끝남) | ❌ | ❌ | ✅ | 당김 확인 게이트 |
| 실제 완료일 > 예상 (지연) | ❌ | ❌ | ✅ | 지연 확인 게이트 |
| 알람 응답 "지연 N일" | ❌ | +N일 | ❌ | 지연 확인 게이트 |
| 알람 응답 "당김 N일" | ❌ | -N일 | ❌ | 당김 확인 게이트 |
| 재작업 이벤트 추가 | ❌ | +재작업일 | ❌ | 지연 확인 게이트 |
| 컬러/차수/수량 변경 | ✅ | ✅ | ❌ | 양방향 확인 게이트 |
| 일일 편직량 변경 | ✅ | ✅ | ❌ | 양방향 확인 게이트 |
| 최종 납기 변경 | ✅ | ✅ | ❌ | 전체 재계획 |
| 공정 활성화 변경 | ✅ | ✅ | ❌ | 전체 재계산 |
| 담당자 수동 계획 수정 | ✅ (선택) | ✅ | ❌ | 확인 게이트 |

### 3.6 확인 게이트 로직

**지연 발생 시**:
```
후공정 담당자에게 ChangeConfirmation 생성
├── 선택지 1: [적용] → 후공정 expected_end_date 밀림
└── 선택지 2: [단축 방안 입력] → N일 단축 + 사유 입력 (필수)

※ "변경 없음" 선택 불가. 반드시 둘 중 하나.
```

**당김 발생 시**:
```
후공정 담당자에게 ChangeConfirmation 생성
├── 선택지 1: [당겨서 적용] → 후공정 expected_start_date 당김
└── 선택지 2: [원래대로 유지] → 변경 없음 (여유 확보)
```

**납기 초과 위험 시** (expected_due_date > final_due_date):
```
모든 후공정 담당자에게 "단축 기여 요청" 브로드캐스트
├── 각자 [단축 가능 일수] 입력
├── 총 단축 합계 >= 초과 일수 → 납기 복구
└── 부족 시 → 관리자 에스컬레이션 → "납기 연장 검토 필요" 상태
```

### 3.7 Fail 처리 4지선다

**염가공 브랜드 컨펌 Fail (컬러 단위)**:
- [A] 재가공 (염가공 재진행, 소요일 입력)
- [B] 재컨펌만 (가공지 다시 발송, 소요일 입력)
- [C] 강제 진행 (Fail 수용, 사유 필수, ForcedProgressDecision 기록)
- [D] 오더 보류

**외관검사 Fail**:
- [A] 재검사만 (검사 실수 판단, 소요일 입력)
- [B] 염가공 재가공 요청 (상위 되돌림)
- [C] 강제 납품 (사유 필수, ForcedProgressDecision 기록)
- [D] 오더 보류

**이화학검사 Fail**:
- 기본 동작: [재test 투입] (단순 반복, 상위 공정 안 돌아감)
- 수동 옵션: [강제 납품] (여러 번 Fail 후 수용, ForcedProgressDecision 기록)

**L/D Fail**:
- [A] 재진행 (소요일 입력)
- [B] 오더 보류

### 3.8 알람 시스템

**D-day 알람** (매일 자정 스케줄러):
```
for batch in active_batches:
    d_days = (batch.expected_end_date - today).days
    if d_days in SystemSetting.alert_d_days:  # 기본 [25,17,12,7,3]
        if not AlertLog.exists(batch.id, d_days):
            create_alert(batch, d_days, assignee)
```

**응답 게이트 3지선다**:
- [정상 진행] → 기록만
- [지연 예상 N일] → expected_end_date += N, 지연 확인 게이트 후공정 전파
- [일정 당김 N일] → expected_end_date -= N, 당김 확인 게이트 후공정 전파

**미응답 에스컬레이션**:
- 24시간 미응답 → 재알람
- 48시간 미응답 → 관리자에게 에스컬레이션

**특별휴일 경고**:
- 공정 기간에 5일 이상 연휴 포함 시 오더 상세에서 경고 배지
- 예: "이 공정 기간 중 추석 연휴(5일) 포함. 실제 진행 가능 일수 고려 필요."

### 3.9 Risk Scanner (관리자 설정 규칙)

매시간 백그라운드 실행, 아래 규칙을 관리자가 ERP 설정 페이지에서 on/off 및 임계값 조정 가능:

| 규칙 | 기본 임계값 | 설명 |
|------|----------|------|
| 진행률 기반 지연 | 0.5 | 경과일/계획일 > 이 비율인데 미완료면 경고 |
| 시작 지연 | 0일 | 계획 시작일 지났는데 actual_start_date 없으면 경고 |
| 상태 정체 | 3일 | 같은 상태 N일 이상 유지 시 경고 |
| 납기 임박 미완료 | 3일 | D-N 시점에 미완료 시 경고 |
| 응답 미수신 | 24시간 | 알람 후 유예 |
| 납기 초과 예상 | - | estimated > final 즉시 경고 |

### 3.10 생산 에이전트 기능

**Daily Briefing** (매일 오전 8시, 담당자별 인앱):
- 오늘 응답 필요한 알람 N건
- 오늘 완료 예정 차수 N건
- Risk Scanner 감지 오더 N건
- 이번 주 시작해야 할 공정

**지연 전파 엔진**:
- 지연 입력 시 후공정 expected_end_date 자동 재계산
- 영향 받는 담당자들에게 확인 게이트 자동 생성

**납기 초과 대응**:
- estimated > final 시 모든 후공정 담당자에게 "단축 기여 요청" 자동 발송

---

## 4. UI 요구사항

### 4.1 색상 시스템 (전 화면 통일)

| 상태 | 색상 | 의미 |
|------|------|------|
| 🟢 녹색 | expected ≤ planned | 정상 / 당김 |
| 🟡 노란색 | expected > planned 이지만 final 이내 | 주의 |
| 🔴 빨간색 | expected > final | 위험 |
| ⚪ 회색 | 대기 상태 | - |
| 🟦 파란색 | 진행 중 | - |
| 🟣 보라색 | 병렬 트랙 (L/D) | - |

### 4.2 메인 네비게이션 (5개 탭)

```
[대시보드] [오더 목록] [간트 차트] [칸반 보드] [설정]
```

### 4.3 뷰 1: 대시보드 (홈)

**섹션 구성**:
1. **오늘의 브리핑**: 긴급 대응 필요 / 오늘 응답 필요 알람 / 오늘 완료 예정 / Risk Scanner 감지
2. **오더 현황 요약**: 정상/주의/위험 개수
3. **위험 오더 Top 5**: 미니 진행 바 + 납기 정보

**담당자 필터**: 기본 "내 담당만", 토글로 "전체 보기" 가능

### 4.4 뷰 2: 오더 목록

**표 형식**:
- 오더번호, 고객, 타입, 수량, 최종납기, 예상납기, 상태, 진행률
- 필터: 타입/상태/담당자/기간
- 검색: 오더번호/고객명
- 정렬: 납기 임박 순 기본
- [+ 새 오더 등록] 버튼

### 4.5 뷰 3: 간트 차트

**한 오더 선택 시**:
- 가로축: 시간 (주 단위)
- 세로축: 공정 × 차수
- 바 이중 표시: 계획(회색) + 실제/예상(컬러)
- L/D는 별도 트랙 (보라)
- 계획/예상 완료일 세로 기준선
- 컬러 오더는 차수 바 내부에 컬러 세그먼트 표시

**인터랙션**:
- 바 클릭 → 차수 상세 팝오버 + 상태 변경
- 드래그 → 계획일 수정 (권한 있을 때, 확인 게이트 트리거)
- 호버 → 3단 완료일 툴팁

### 4.6 뷰 4: 칸반 보드

**공정 탭 전환**: 원사 / 사가공 / L/D / 편직 / 염가공 / 외관 / 이화학

**컬럼**: 해당 공정의 상태 enum (예: 편직 → 대기중 / 투입예정 / 편직중 / 보류 / 완료)

**카드 단위**: 차수 1개 = 카드 1장
- 오더번호 + 차수
- 수량
- 계획/예상 완료일
- 담당자
- 진행률 (해당 공정)
- 알람/리스크 배지

**담당자 필터**: 기본 "내 담당만", 토글 가능

**인터랙션**: 드래그로 상태 변경, 카드 클릭 시 상세 팝업

### 4.7 뷰 5: 오더 상세

**섹션**:
1. 기본 정보 헤더 (고객, 타입, 방식, 수량, 컬러, 납기 3단 표시)
2. 활성 공정 체크리스트
3. 미니 간트 (이 오더만)
4. 공정별 아코디언 (차수 리스트 + 상태 + 3단 완료일)
5. 이력 로그: 알람 응답 / 재작업 / 강제 진행 / 감사 로그

**액션 버튼**: 편집 / 복제 / 보류

### 4.8 알림 UI

**인앱 알림만 사용** (이메일/카톡/문자 불필요):
- ERP 상단 종 아이콘 + 뱃지 카운트
- 드롭다운에 최신 알림 리스트
- 긴급건(재작업 의사결정 등)은 오더 상세 페이지에서 모달 팝업

---

## 5. ERP 연동 포인트

다음 ERP 엔티티 참조:
- **아이템(원단 품목) 테이블**: 원사 공정에서 아이템 선택 시 연결된 사종 자동 로드
- **사종 테이블**: 원사 발주 시 드롭다운에 사종 리스트
- **고객/브랜드 테이블**: 오더 등록 시 참조
- **담당자(사용자) 테이블**: 시스템 설정의 담당자 3명 선택

**연동 방식**: 구체적 방식(DB 직접 조회, API, 뷰 등)은 **구현 중 사용자에게 확인**.

> **그루빅 ERP 실제 매핑 (결정됨)**:
> - 사종 = `yarns` 컬렉션 (기존 useYarn 훅 / YarnLibraryPage)
> - 고객/바이어 = `settings/general.buyers` 배열
> - 아이템/원단 = `fabrics` 컬렉션 (오더 등록 시 "원단 불러오기"로 yarns[] 비율 자동 적용)
> - 담당자 = `settings/general.productionAssignees` (원사/편직/그외 3명 — 신규 추가됨)

---

## 6. 구현 우선순위

### Phase 1 (MVP)
- [x] 데이터 모델 + CRUD (Order, Process, Batch, YarnOrder, YarnDelivery, BatchColor)
- [x] 오더 등록 (선염/후염 분기, 공정별 차수/컬러 설정) — **1페이지 구조**
- [x] 3단 완료일 (planned/expected/actual) 필드 구조
- [x] 납기 자동 계산 엔진 (단순 합산, 달력 기준)
- [x] ERP 연동 (원단/사종/고객/담당자 참조)
- [x] 오더 상세 뷰 (읽기 전용)
- [ ] 간트 차트 뷰
- [ ] D-day 알람 + 응답 게이트 (3지선다)
- [ ] 확인 게이트 로직 (지연/당김 분기)
- [ ] 3단 완료일 expected/actual 변경 UI
- [ ] 오더 편집 기능

### Phase 2
- [ ] 대시보드 + Daily Briefing
- [ ] 칸반 보드 뷰
- [ ] Risk Scanner (관리자 설정 규칙)
- [ ] Fail 처리 4지선다 (재작업/강제진행 기록)
- [ ] 납기 초과 위험 대응 (후공정 단축 요청)
- [ ] 특별휴일 경고

### Phase 3
- [ ] 감사 로그 / 변경 이력
- [ ] 리포트 (지연 통계, 재작업 분석)
- [ ] 자연어 Q&A (선택)

---

## 7. 구현 시 주의사항

1. **계획의 불변성**: `planned_end_date`는 오더 구조 재계획 외에는 절대 변경되지 않음. 분석의 기준점이므로 엄격히 관리.

2. **시스템은 감시자가 아닌 기록자**: 담당자의 실제 진행 판단을 막지 않음. 차수 단위 병렬 진행도 자율.

3. **확인 게이트 통일성**: 당김/지연 모두 확인 게이트 거침. 단, 지연의 경우 "적용 or 단축 방안 입력" 2지선다 (변경 없음 선택 불가).

4. **컬러 관리 분기**: 후염=염가공부터, 선염=원사부터. 공정별 데이터 모델에서 컬러 필드 처리 주의.

5. **선염/후염 제약**:
   - 선염 + 편직처 보유 원사 사용 불가
   - 후염 + 사염 사가공 불가
   - 컬러별로 사가공 유무 다른 케이스 없음 (오더 단위로 통일)

6. **L/D 병렬 처리**: 주 납기 계산에 포함하지 않음. 원사+편직 기간 내 완료된다고 가정.

7. **3단 완료일 일관성**: planned 변경 이벤트와 expected 변경 이벤트를 명확히 구분 (3.5 표 참조).

8. **한국어 UI**: 모든 용어는 Glossary에 따라 통일.

9. **모호함 발생 시**: 구현 전 반드시 사용자에게 질문할 것. 추측으로 진행하지 말 것.

10. **ERP 연동 구체 방식**: 구현 시작 시 사용자에게 기술 스택 확인 필요.

---

**이 명세는 생산 스케줄 모듈 작업의 원본 기획서이다. 새로운 단계를 구현할 때 이 문서를 먼저 참조할 것.**
