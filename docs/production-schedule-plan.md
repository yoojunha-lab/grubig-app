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
| **가납기 + 간트 깃발 · 메모 아래로** (2026-10-10) | ✅ **완료** | `2327251` |
| **설계서 ↔ 샘플 오더 · 메인/샘플** (2026-10-10) | ✅ **완료** | `8381899` · `939adbd` |
| **샘플 흐름 점검·디버깅** — 샘플 끝 상태(Drop·아이템화 대기)·Drop/복원 맞추기·안전장치 (2026-10-10) | ✅ **완료** | `665075e` · `8e60661` · `220388b` · (정리 커밋) |
| **생산 현황 개편 v9** — 예상 시작/종료일·최초 예상 기록·상태 드롭다운·편직 기계별 생산량·프리세팅·공정 추가·가납기 일수·생지 전체/부분 출고·LOT 단순화·시험성적서/브랜드 컨펌·외관검사 컬러별·간트 [+] (2026-10-11) | ✅ **완료** | `ea7a67d` · `e005af2` · `51f151c` · `1562cc3` · `e2d19a9` · `e0e3d89` · `0244a01` |
| **생산 현황 v10** — LOT 배색량·예상 YD · 프리세팅 → LOT 창 · 외관검사 LOT별 1차·2차(투입 전·재가공) · 오더 마무리 체크 · 선염/후염(생지 출고 오더에 한 번) · 생지 출고 kg · 간트 날짜 → 공정 넣기 (2026-10-14) | ✅ **완료** | `9544132` |
| **v10 후속** — '작지kg' → '생지kg' 이름 · 남은 배색량 · 와이드 모니터에서 현황표·간트 넓게 (2026-10-14) | ✅ **완료** | `39f66b5` |
| **생산 현황 v11 — 원사** — 원사 칸 하나에 사종 줄(발주대기·발주완료·입고완료·중지) · 재고 사용 · 원사염색(선염) (2026-10-14) | ✅ **완료** | `89b23f7` · `918542e` |
| **종결 = 회색** — 현황표 · 간트에서 완료된 오더 줄 전체 + 진행 중 오더의 끝난 칸 · 막대 · 상태를 회색으로 (2026-10-14 — 색 규칙은 `docs/terminology.md` 2-J) | ✅ **완료** | (이번 커밋) |

> **🎉 Phase 1 운영 가능 상태 도달** — 등록/편집/시각화/모니터링 모두 1차 완성. 이제 사용해보면서 세부 다듬기.
> 알람/확인게이트는 개발하지 않기로 결정 (대표님 지시).
>
> **⚠️ 2026-09 v8 개편으로 아래 1단계~v7 의 데이터 구조(차수·입고차수·시작점·활성 공정)와 화면(대시보드·칸반·오더 등록 마법사·공정별 간트)은 폐기됐다.**
> 현재 구조는 바로 아래 "v8 개편" 절이 기준이다. 그 아래 절들은 이력으로만 남겨둔다.

---

## 생산 현황 v11 — 원사 (대표님 요청 2026-10-14)

> 대표님: "① 원사 발주 공정 칸도 있어야 하고, 선염이면 원사염색 공정도 넣을 수 있어야 ② 원사 칸 하나만 만들고 필요하면 원사염색도 추가해서 진행
> ③ 원사는 발주대기 · 발주완료 · 입고완료 · 중지 드롭다운으로 사종별로. 간단히 — 재고 사용 버튼 하나, 체크하면 원사 발주 신경 안 써도 되게"

### 대표님 결정 (질의응답 — 모두 추천대로)
| 항목 | 결정 |
|---|---|
| 재고 사용 | **오더 전체 체크 하나** (일부만 재고인 사종은 상태를 입고완료로) |
| 원사염색 | **오더에 한 번** (염색처 · 예상 시작/종료일 · 상태 · 메모 — 프리세팅과 같은 모양) |
| [+ 원사염색] | **선염 오더에서만** (이미 넣은 값이 있으면 염색 방식과 상관없이 보임) |
| 발주 kg 칸 | **안 만듦** (필요하면 메모에) |

### 제가 정한 기본값 (대표님이 바꾸라고 하시면 쉬움)
- 원사 끝남 = 재고 사용 또는 사종(중지 뺀 줄)이 모두 입고완료 + (원사염색을 넣었으면) 원사염색 완료. 사종이 모두 중지면 안 끝난 것으로 봄
- 가납기 '원사' 비교 날짜 = 안 들어온 사종 입고 예정일 · 안 끝난 원사염색 예상 종료일 중 가장 늦은 날 (끝났으면 가장 늦은 입고·원사염색 완료일)
- 컬러 단계: 원사염색 진행중 → **원사염색중** / 발주완료(입고 전) 사종이 있으면 → **원사진행** (편직 일정만 넣어 둔 '편직대기'보다 먼저)
- 원사 칸은 **기본으로 보임** (예전에 숨겨 둔 PC도 한 번 보이게 — `grubig.production.sheet.yarnShown.v11`)
- 사가공 칸은 그대로 따로 (기본 숨김)

### 데이터 (orders, `schemaVersion: 11`) — `utils/orderModel.js`
```
order += {
  yarnStock: boolean,                                                         // 재고 사용 (오더 전체)
  yarnOrders: [{ id, name(사종), vendor(원사처), expectedDate(입고 예정일), events: [{ id, status, date }], notes }],
}
steps.yarn_dyeing = 공정 한 세트 (vendor=염색처, startDate, endDate, status, doneDate, notes, endHistory)   // 원사염색
steps.yarn → (예전 값만 — 화면에서 안 씀) v11 전 오더는 읽을 때 사종 한 줄로: 대기 → 발주대기 / 진행중·문제 → 발주완료(예상 시작일) / 완료 → + 입고완료(완료일), 사종 이름은 비움(메모 그대로)
```
- 상수: `YARN_ORDER_STATUSES`(발주대기·발주완료·입고완료·중지) · `YARN_DYEING_KEY` · `FLOW_ORDER` 의 `'yarn'` → **`'#yarn'`**(오더 단위 특별 칸) · `FLOW_ANCHOR_LABELS['#yarn']`(추가 공정 위치 '원사 다음' — 예전 after 'yarn' 은 '#yarn' 으로 읽음) · `withPresettingStep` → **`withSubSteps`**(원사염색 맨 앞 + 프리세팅)
- 주요 함수: `getYarnState`(stock · counts · orderingDone · done · currentEnd) · `getYarnOrderStatus` · `getYarnOrderStatusDate` · `getYarnOrderEventDate` · `canUseYarnDyeing` · `applyYarn`(사종 줄 3방향 합침 + 내가 고친 줄도 상태 기록은 또 합침) · `addYarnOrderEvent` · `getStepCurrentEnd('yarn')` · 간트 `yarnOrderBars`
- `useOrder` 새 액션: `setYarn(id, { yarnStock?, yarnOrders?, yarnOrdersBase? })` · `addYarnEvent(id, yarnId, status)` — 원사염색은 `setStep(id, 'yarn_dyeing', patch)`

### 화면
| 기능 | 현황표 | 간트 | 상세창(모바일) |
|---|---|---|---|
| 사종 줄 | 원사 칸(오더 단위)에 사종마다 '이름 [상태 ▾] 입고 10/20'(바로 저장 · 지나면 빨강) · 칸 → **원사 창**(`YarnPopover`) | 오더 줄 막대: 발주완료한 날 ~ 입고(입고 전이면 입고 예정일, 없으면 오늘) · 발주대기는 입고 예정일 점선 · 중지 없음 | '공정 일정' 맨 위 원사 상자 (상태 드롭다운 · [원사 편집]) |
| 재고 사용 | 칸에 '재고 사용' (사종 줄은 창에서만) · 창 맨 위 체크 | 사종 막대 없음 | 상자의 [재고 사용] 체크 (바로 저장) |
| 원사염색 | 칸 아래 '원사염색 진행중 10/13~10/22'(`YarnDyeChip`) · 창의 [+ 원사염색] 상자(빼기) | 오더 줄 분홍 막대 → 공정 창 | 상자 아래 칩 |
| 원사 창 | 재고 사용 · 사종 표(사종 · 원사처 · 상태 · 입고 예정일 · 메모 · 기록 · 삭제) · [사종 추가] · [원단 원사 불러오기 (article#)] · 원사염색 | [+] 메뉴 '원사 (사종 · 재고 사용)' + 공정 '원사염색 선염' · 날짜 메뉴 '원사' + 원사염색 시작일로/종료일로 (앞 공정 '원사 입고'보다 빠르면 노란 안내) | [원사 편집] → 같은 창 |
- 원사 창 제안 목록 (`OrderListPage.yarnHelpers`): 사종 = 원사 라이브러리 이름, 원사처 = 원사처 마스터 + 다른 오더 사종 원사처, 염색처 = 염색소 마스터 + 다른 오더 원사염색 염색처. 원단 원사 = 연결된 원단 → 같은 Article 원단 → 설계서 원사 (`yarnDyeCalc.fabricYarnOptions`)
- 남은 일(`getOpenWork`): '원사 입고 전 N건' · '원사염색 진행중' / 리포트 공정별 소요일: **'원사 (사종당 발주→입고)'**(발주완료한 날 ~ 입고 예정일 / 입고완료한 날) · '원사염색 (선염)'
- 변경 이력: '원사 재고 사용 체크' · '원사 사종 추가 (CM30/1)' · '원사 PU 40D 발주대기→발주완료' · '원사 NY 70D 입고 예정 10/12→10/15' · 원사염색은 공정과 같게
- 검색: 사종 이름 · 원사처도 찾음
- DEV 샘플: `F-26M030`(선염 — 사종 3줄 입고완료·발주완료(입고 예정 지남)·발주대기 + 원사염색 진행중 · 가납기 원사 10/20 → '5일 늦음'), `F-26M016`(예전 원사 일정 → 사종 한 줄)

### 검토 · 디버깅 (2026-10-14 — 대표님 요청 '논리 검토 · 리팩토링 · 디버깅')
| 고친 것 | 내용 |
|---|---|
| 원사 칸 '한 번 보이게' | 처음 쓰는 PC에서 원사 칸을 숨겨도 다음에 열면 다시 보이던 것 → 처음 PC · 칸 숨김을 바꿀 때 '한 번 보이게'는 끝난 것으로 |
| 원사 창 상태 고르기 | 창 안에서 상태를 여러 번 바꾸면 기록이 그만큼 쌓이던 것 → 이 창에서 방금 고른 상태는 바꿔 씀 (저장 전 한 줄만) |
| 완료 오더 입고 지연 | 상세창 원사 상자가 완료된 오더에도 지난 입고 예정일을 빨갛게 보이던 것 → 현황표와 같게 (`getYarnRowInfo` 하나로) |
| 가납기 원사 '현재' 글자 | '예상 종료 10/25' → **'입고 예정 10/25'** / 원사염색이 더 늦으면 **'원사염색 예상 종료 10/22'** (`currentEnd.by`) |
| 간트 입고 지연 | 입고 예정일이 지났는데 발주완료·발주대기면 막대에 '(입고 지연)' + 빨간 테두리 |
| 사종 이름 빈 줄 | 원사 창 아래 노란 안내 (저장은 됨 — 예전 원사 일정에서 옮긴 줄은 이름이 비어 있음) |
- 리팩토링: 사종 줄 표시 계산(상태 · 날짜 · 입고 지연) `orderModel.getYarnRowInfo` 하나로 (현황표 · 상세창 · 원사 창 · 간트) / 원사 창 제안 목록 `yarnHelpers.popoverProps(order)` 하나로 (현황표 · 간트 · 상세창, 마스터 목록이 바뀔 때만 다시 계산) / 프리세팅 · 원사염색 칩 → 공용 `common/StepChip`

---

## v10 후속 — 생지kg · 남은 배색량 · 와이드 화면 (대표님 요청 2026-10-14)

> 대표님: "① '작지KG'를 '생지kg'로 ② 한 컬러에서 배색량을 쓰면 더 투입해야 할 남은 배색량 ③ 현황표·간트를 화면을 늘리면 더 늘려서 (와이드 모니터)"

### 대표님 결정 (질의응답)
| 항목 | 결정 |
|---|---|
| 이름 | 화면 글자 '작지' → **'생지'** 전부 (현황표 머리글·설명, 상세창, LOT 창, 생지 출고 창, 편직 공정 창, 간트, 리포트, 변경 이력의 새 기록). 데이터 칸 `workKg` 는 그대로 → 예전 오더 변환 없음. 이미 남은 변경 이력 글자는 '작지kg' 그대로 |
| 남은 배색량 기준 | **생지kg − 배색량 합계** (생지 출고 kg 기준 비교는 LOT 창에 예전처럼 따로) |
| 넓은 화면에서 남는 자리 | 칸을 늘리지 않음 — 원래 가로 스크롤로 봐야 했던 칸이 화면에 더 보이고, **다 보이고도 남으면 빈자리** |
| 간트 남은 배색량 | 컬러 줄 이름에 마우스를 올리면 '생지 1,100kg · 남은 배색 120kg (배색 980kg)' |

### 구현
- `orderModel.getDyeRemain(생지kg, 배색 합계)` → `{ greigeKg, dyeKg, remain, state: 'left'|'done'|'over' }` (배색량이 없거나 생지kg 이 없으면 null) · `getColorDyeRemain(order, color)` · `describeDyeRemain` ('남은 배색 120kg' / '배색 끝' / '20kg 더 배색'). 색은 `constants/production.DYE_REMAIN_STATES` (주황·초록·빨강)
- 현황표 염가공 LOT 칸: '배색 → 예상' 아래 한 줄 · LOT 창: 요약 맨 위 배지 **'남은 배색량 111.2kg'** + '생지 − 배색' (편집 중인 값으로 바로 바뀜 — 예전 작은 회색 '작지 중 … 아직 배색 전'은 이것으로 바꿈) · 상세창(모바일) LOT 카드 · 간트 컬러 줄 툴팁
- 와이드 화면: `OrderListPage` 의 `max-w-[1900px]` 를 없앰 (생산 현황만). 현황표 칸 폭은 그대로 (남으면 빈자리)
- 간트: 본문 폭을 재서(`ResizeObserver`) 보이는 날짜 칸 수 → `buildGanttLayout({ minColsFromToday })` 가 **오늘 칸부터 (보이는 칸 − 2)칸**이 되도록 끝을 한 주씩 늘림 → 처음 열 때(오늘이 왼쪽 세 번째 칸) 화면 끝까지 날짜가 참. 창을 줄이면 다시 원래 기간

---

## 생산 현황 v10 (대표님 요청 2026-10-14)

> 대표님: "① 염가공 LOT마다 배색량 → LOSS 빼고 예상 야드 ② 프리세팅은 공정에서 빼고 염가공 LOT에서 (원단마다 추가, LOT관리 없이 예상 시작·종료·상태·메모)
> ③ 외관검사는 투입 안 한 상태로 돌아갈 수 있게 + 예상 시작·종료·메모, LOT마다 1차 2차 (불량 → 염가공소 → 2차 검사)
> ④ 오더를 마치면 원사재고정리 · EZTEX 재고정리 · EZTEX 종결 체크(+메모) — 이걸 끝내야 최종 마무리
> ⑤ 생지출고: 선염은 컬러마다, 후염은 한 번에 ⑥ 간트에서 날짜 누르면 메모 말고 공정 넣기 (현황표와 연동)"

### 대표님 결정 (질의응답 — 모두 추천대로 + ③ 수정)
| 항목 | 결정 |
|---|---|
| 배색량 → 예상 | 오더 **로스율**(작지kg와 같은 값)로 **배색량 ÷ (1 + 로스율)** = 예상 가공지 kg → ÷ 1야드 무게(gsm × 전폭 × 0.02322576) = 예상 YD. 작지kg을 전부 배색하면 정확히 오더kg |
| 프리세팅 | **오더에 한 번** (오더 공통 — 어느 컬러 LOT 창에서 열어도 같은 값) |
| 마무리 3개 다 체크 | **자동 '완료'** + 알림. **체크를 풀면 다시 진행중** (자동으로 완료된 경우만 — 대표님: '잘못 눌렀으니 체크해제하면 다시 완료가 풀림') |
| 체크가 남았는데 '완료' | 마무리 창 ("N개 남았어요") → 체크하고 저장(자동 완료) / **[체크 없이 완료]** (예전 오더 때문에 막지는 않음 — 창에서 몇 개 체크했으면 **[저장하고 완료]**: 체크를 저장한 뒤 완료) |
| 선염/후염 기본값 | 새 오더 = **후염**, 예전 오더 = '안 고름'(컬러마다 — 지금처럼) |
| 날짜 메모 | 간트 날짜 메뉴 **맨 아래 '이 날 메모'**로 남김 (써 둔 메모도 그대로 보이고 누르면 고침) |
| 추가 제안 | **생지 출고에 kg** → LOT 창에서 배색량 합계와 비교 — 진행 |

### 제가 정한 기본값 (대표님이 바꾸라고 하시면 쉬움)
- 외관검사 상태: **투입 전**(새) · 검사중 · 불량컨펌중 · **재가공**(새) · 출고준비완료 · 출고완료
  - '재가공'을 고르면 그 LOT에 **다음 차수 줄 자동** (현황표 드롭다운·입력 창 모두). 다음 차수를 시작하기 전까지 컬러 단계 **'재가공중'**
  - '투입 전'을 고르면 기록 한 줄로 남음 (되돌린 것도 이력). 기록 줄은 입력 창 [기록]에서 고치기·지우기
  - 차수 수 제한 없음 (1차·2차… 필요하면 3차)
- 출고 연동: 그 컬러 **LOT가 모두 '출고완료'**면 출고 칸 자동 완료 (출고일 = 마지막 출고완료 날). 하나라도 풀리면(다른 상태·새 LOT) 자동 체크도 풀림. 손으로 체크한 출고는 그대로
- 예전 컬러별 외관검사 → 그 컬러 **LOT마다 1차**로 옮김 (LOT가 없던 컬러는 LOT1을 만들어서 — 상태 기록이 있으면 염색 '완료')
- 예전 LOT '수량(qtyKg)'은 배색량으로 **옮기지 않음** (새 칸 `dyeKg` — 예전 값은 문서에만)
- 후염으로 바꿀 때 컬러별 출고 기록은 같은 날짜·종류끼리 합침. '전체'는 출고 기록이 있는 컬러가 모두 그날 '전체'일 때만 (몇 컬러만이면 '부분' + 메모 'BLACK·WHITE 전체'), 컬러마다 전체 출고가 다 끝나 있었으면 마지막 '전체' 줄은 '전체'. 컬러 기록은 지우지 않음 (선염으로 되돌리면 그대로)
- 원단 스펙(YD 환산): ① 연결된 원단 → ② 오더에 저장된 값 → ③ 같은 Article 원단 → ④ 설계서 최종 스펙. 없으면 LOT 창에서 gsm·전폭 입력 (오더 `gsm`·`widthFull`)
- 마무리 = 메인·샘플 모두. '마무리 대기' = 진행 중 오더 중 입력 있는 컬러가 모두 출고 끝 + 체크가 남음. 샘플 끝내기 창·아이템화 확인 창의 '남은 일'에도 '마무리 체크 N개'

### 데이터 (orders, `schemaVersion: 10`) — `utils/orderModel.js`
```
order += {
  dyeMethod: 'yarn'(선염) | 'piece'(후염) | ''(안 고름),            // 새 오더 'piece'
  greigeOuts: [{ id, date, kind, memo, done, kg }],                  // 후염 — 오더 전체 생지 출고
  closing: { yarnStock, eztexStock, eztexClosed } 각 { done, date, memo },
  closingAuto: { prevStatus, at } | null,                             // 마무리 3개로 자동 완료된 표시 (손으로 상태를 바꾸면 지움)
  gsm, widthFull,                                                     // (예전부터 있던 칸) LOT 창에서 직접 넣을 수도
  specManual,                                                         // gsm·전폭을 LOT 창에서 직접 넣었는지 (article# 를 바꿔도 남김)
}
colors[].greigeOuts[] += kg
colors[].lots[] += { dyeKg(배색량), inspections: [{ id, startDate, endDate, events: [{ id, status, date }], notes }] }  // [0] = 1차
colors[].inspection → (없앰 — 읽을 때 LOT 1차로 옮기고 지움. LOT 없고 상태 기록도 없던 컬러는 colors[].inspectionV9 에 보관)
steps.presetting → 그대로 (공정 칸·FLOW_ORDER 에서만 빠짐 — LOT 창·간트 오더 줄 막대에서)
```
- 주요 함수: `getDyeYield` · `resolveYieldSpec` · `getColorInspection`(rows · anyDefect · anyRedye · allDone · allShipped) · `addLotInspectionEvent` · `applyLotInspections`(차수 3방향 합치기 `mergeRounds`) ·
  `syncShipFromInspection` · `applyLots`(LOT 창은 외관검사를 안 건드림 — 지금 저장된 차수 그대로) · `applyDyeMethod`(`mergeColorGreigeOuts`) · `getGreigeStateFor` · `applyOrderGreigeOuts` ·
  `applyClosing`(자동 완료 · 되돌리기) · `getClosingState` · `isClosingPending` · `isShippingDone` · `getOpenWork`(+ 프리세팅 · 외관검사 LOT · 마무리)
- 컬러 단계(`getColorStage`): 불량컨펌중 > **재가공중** > (LOT 모두 검사 끝 → 컨펌중/컨펌대기/출고대기) > 검사중 > … > 염색중 > **프리세팅중**(생지 출고 뒤) > 염색대기 (후염은 오더 생지 출고 기준)
- 가납기 '외관검사' = LOT 기준 (모든 컬러의 LOT가 출고준비완료·출고완료면 완료, 아니면 안 끝난 LOT 지금 차수의 가장 늦은 예상 종료일)
- 가납기 '염가공' = 재가공 중인 LOT가 있으면 **완료 아님** (LOT 염가공 상태가 '완료'여도 — 염가공소에 다시 들어간 것). 현재 날짜 = 다음 차수 검사 예상 시작일 (2026-10-14 검토)
- `useOrder` 새 액션: `setDyeMethod` · `setOrderGreigeOuts` · `setOrderGreigeOutDone` · `setOrderSpec` · `setLotInspections` · `addLotInspection` · `setClosing`(자동 완료/되돌리기 알림)

### 화면
| 기능 | 현황표 | 간트 | 상세창(모바일) |
|---|---|---|---|
| 배색량 · 예상 YD | LOT 칸 '배색 533kg → 1,739YD' · LOT 창 표(배색량 · → 예상)·합계(오더kg 비교 · 작지 · 생지 출고 kg 비교)·원단 스펙 | LOT 막대 'LOT1 410kg' | LOT 카드 '배색 → 예상' |
| 프리세팅 | 공정 칸 없음 → LOT 칸 '프리세팅 진행중 10/9~10/10' · LOT 창 [+ 프리세팅] 상자(빼기) | 오더 줄 막대 → 공정 창(외주처 칸 없음) | LOT 카드 표시 |
| 외관검사 LOT별 | 칸에 LOT마다 'LOT1 2차 [검사중 ▾] 10/14' (바로 저장) · 창: LOT마다 차수 줄(예상 시작/종료·상태·그 상태 날짜·메모·[기록]) · [N차 검사 추가] · LOT가 없으면 [염가공 LOT 만들기] | 차수마다 막대 'LOT1 검사 2차 검사중'(투입 전 = 점선) + '재가공' 막대(재가공 날 ~ 다음 차수 시작) | LOT마다 드롭다운 |
| 마무리 | 맨 끝 '마무리' 칸 (체크 바로 저장 · 칸 → 마무리 창) · order# '마무리 대기' · 위 요약 '마무리 대기 N' | [+] 메뉴 '마무리' · 라벨 '마무리 대기' | '마무리 (2/3)' 섹션 |
| 선염/후염 | order# 칸 드롭다운 · 후염이면 생지출고 칸이 오더 단위(rowSpan) · 생지 출고 창 [선염 · 후염] | 후염 출고 막대는 오더 줄 | 기본정보 '염색 방식' · 후염이면 컬러 위 '생지 출고 (오더 전체)' |
| 간트 날짜 | — | **빈 날짜 칸 → '그 날에 넣기'** (`GanttDateMenu`): 오더 줄 = 공정·프리세팅 [여기서 시작] / [시작일로][종료일로] + (후염) 생지 출고 · 컬러 줄 = (선염) 생지 출고 · 새 LOT(그 날 투입) · 외관검사(LOT마다 시작일로/종료일로) · 브랜드 전달 · 성적서 발행 예상일 · 출고일 · 맨 아래 '이 날 메모'. 앞 공정보다 빠르면 노란 안내. 고르면 그 날짜가 들어간 입력 창(`prefill`) → [저장] = 현황표와 같은 저장 | — |

- 입력 창 `prefill`: `ProcessPopover`({ startDate | endDate }, `simple` = 외주처 칸 없이) · `LotEditor`(`prefillNewLotDate`) · `InspectionPopover`({ lotId, field, date }) · `ConfirmPopover`({ brandSent | testExpected }) · `ShipPopover`(`prefillDate`) · `GreigeOutPopover`(`prefillDate`)
- 리포트 공정별 소요일: '프리세팅 (염색 전)' 줄(편직 다음), '외관검사 (LOT 차수당)'
- 새 파일: `sheet/ClosingPopover.jsx` · `gantt/GanttDateMenu.jsx` · `common/PresettingChip.jsx`
- DEV 샘플: `F-26M041`(후염 · 프리세팅 완료 · 배색량 · 1차 불량→재가공→2차 출고완료 · 출고 끝 + 마무리 2/3 → 마무리 대기), `F-26M020` WHITE LOT1 1차 재가공 → 2차 투입 전, `F-26M030` 선염

### 검토 · 디버깅 (2026-10-14 — 대표님 요청 '논리 검토 · 리팩토링 · 디버깅')
| 고친 것 | 내용 |
|---|---|
| 가납기 염가공 · 재가공 | 재가공 중인 LOT가 있으면 염가공 '완료' 아님 (LOT 염가공 상태가 완료여도) — 다음 차수 검사 예상 시작일과 비교 |
| 마무리 [체크 없이 완료] | 창에서 몇 개 체크·메모했으면 **[저장하고 완료]** — 고친 내용을 저장한 뒤 완료 (예전엔 버려졌음) |
| 마무리 · Drop/아이템화 샘플 | 설계서 Drop·아이템화·복원 때 '마무리 자동 완료' 표시(`closingAuto`)를 지움 + Drop 샘플은 체크를 풀어도 그대로 — 체크 해제로 Drop 샘플이 다시 열리던 것 (다시 열려면 설계서 복원) |
| 변경 이력 | 자동 완료된 오더를 손으로 진행중으로 바꾸면 '마무리 체크를 풀어서 완료 취소'가 잘못 남던 것 |
| 새 줄 마무리 | order# 입력 전 새 줄은 마무리 체크 없음 (저장도 안 된 줄이 완료로 등록되던 것) |
| 자동 완료 알림 | 출고가 안 끝난 컬러가 있으면 '⚠ 출고가 안 끝난 컬러 N개' 같이 |
| 예상 YD 원단 스펙 | 원단을 고른 뒤 article#를 다른 원단으로 고치면 예전 원단 gsm·전폭이 남아 YD가 틀리던 것 → 원단에서 온 스펙은 지움. LOT 창에서 **직접 넣은 스펙**(`specManual`)은 그대로 ('직접 넣은 값') |
| LOT 창 원단 스펙 | gsm·전폭 중 하나만 있으면 칸이 비어 보이고, 하나만 고쳐 저장하면 다른 하나가 지워지던 것 → 저장된 값 그대로 보이고 바꾼 칸만 저장 |
| LOT 창 프리세팅 | 처음 고친 순간의 값과 비교해 내가 고친 칸만 저장 (고치는 사이 다른 PC가 바꾼 칸을 옛 값으로 되돌리지 않게) |
| v9 → v10 외관검사 옮기기 | LOT 없는 컬러는 **상태 기록이 있을 때만** LOT1을 만듦. 예상 일정·메모만 있으면 LOT를 안 만들고 예전 값은 `inspectionV9`에 보관 (빈 'LOT 1개'가 생기지 않게) |
| 후염으로 바꿀 때 합치기 | 입력이 있는 컬러 중 출고 기록이 없는 컬러가 있으면 오더 '전체 출고'로 만들지 않음 (그 컬러가 염색대기로 잘못 보이던 것) |
| 공정 창 안내 | 간트에서 고른 날짜가 원래 값과 같으면 '넣었어요' 안내를 안 띄움 |
- 리팩토링: '편직 다음에 프리세팅 끼우기'가 간트 [+]·날짜 메뉴·리포트·남은 일에 따로 있던 것 → `constants/production.withPresettingStep` 하나로

---

## 생산 현황 개편 v9 (대표님 요청 2026-10-11)

> 대표님: "가납기에서 각 단계별로 일 수를 쓰면 자동으로 날짜 / 편직 예상 시작·종료일 + 바뀌면 1차 예상 종료일 기록, 상태 드롭다운,
> 기계별 일일 생산량 / 공정 추가(편직 다음 프리세팅) / 생지 출고 전체·부분 + 메모 / 염가공 LOT 탕·수량·롤 빼기, 컨펌에 시험성적서
> (발행예상날짜 · 발행중·합격·불합격·재투입·재합격), 브랜드 컨펌 전달·컨펌·리젝 — 드롭다운 바꿀 때마다 그 날을 날짜로 /
> 외관검사(투입일·종료예정일·불량컨펌중·출고준비완료·출고완료) / 모두 간트에서도 수정·진행"

### 대표님 결정 (질의응답)
| 항목 | 결정 |
|---|---|
| 가납기 일수 기준 | **기준일 칸** (처음엔 오더 등록일, 바꿀 수 있음). 가납기 = 앞 공정 가납기(첫 공정은 기준일) + 일수 |
| 공정 추가 | **대표님이 직접** — 현황표 [공정 추가]에서 이름·위치·외주처 이름 (설정 저장, 모든 PC 공통). 프리세팅은 기본 공정 |
| 생지 출고 | 컬러마다 **여러 번 기록** (1차·2차… 줄: 날짜·전체/부분·메모·출고 체크) |
| 외관검사 | **컬러별 + 출고 연동** ('출고완료' → 그 컬러 출고 칸 완료, 출고일이 비면 그날) |

### 제가 정한 기본값 (대표님이 바꾸라고 하시면 쉬움)
- 예상 시작/종료일 · 최초 예상 기록 · 상태 드롭다운은 **모든 오더 공정**(원사·사가공·편직·프리세팅·후가공·이화학·추가 공정)에 똑같이
- 공정 상태는 그대로 4가지 (대기·진행중·문제·완료) — 드롭다운만
- 외관검사 상태에 **'검사중'** 추가 (투입하고 결과 전)
- 가납기는 4공정 그대로 (원사·편직·염가공·외관검사) — 프리세팅·추가 공정은 가납기 없음. 일수는 달력 기준(주말 포함)
- '이화학' 공정 칸은 그대로 (시험성적서와 겹치면 나중에 정리)

### 데이터 (orders, `schemaVersion: 9`) — `utils/orderModel.js`
```
steps[key] += { endHistory: [{ date: 예전 예상 종료일, at: 바꾼 날 }] }      // [0] = 최초 예상 종료일
steps.knitting += { machines: [{ id, name('1호기'), dailyKg }] }, dailyKg = 기계 합계  // 예전 dailyKg 는 '1호기'로
steps.presetting (기본 공정) / steps['cs_…'] (추가 공정 — 설정에서 지워도 문서 값은 남음)
provisionalPlan: { base: 기준일('' = 오더 등록일), days: { yarn, knitting, dyeing, visual_inspection } }
inspectVendor: 외관검사 검사처 (오더 공통 — 염색소 dyeVendor 와 같은 방식)
colors[] += {
  greigeOuts: [{ id, date, kind: 'full'|'partial', memo, done }],   // greigeOutDate·greigeOutDone 은 여기서 계산해 같이 저장
  testReport: { needed, expectedDate, events: [{ id, status, date }] },
  brandConfirm: { events: [{ id, status, date }] },
  inspection: { startDate(투입일), endDate(종료예정일), events: [{ id, status, date }], notes },
}
lots[] = { id, no, startDate, endDate, status, notes }   // machineKg·qtyKg·rolls 는 예전 값만 남음 (화면에서 안 씀)
```
- **상태 기록(events)**: 드롭다운을 바꿀 때마다 그날 날짜로 한 줄 (`addColorTrackEvent`) — 마지막 줄 = 지금 상태. 입력 창에서 날짜·상태 고치기·지우기 (`common/TrackEditor`)
  - 시험성적서 `TEST_REPORT_STATUSES` 발행중·합격·불합격·재투입·재합격 / 브랜드 컨펌 `BRAND_CONFIRM_STATUSES` 전달·컨펌·리젝 / 외관검사 `INSPECTION_STATUSES` 검사중·불량컨펌중·출고준비완료·출고완료
  - 간트 막대 = 차수(시작 상태 ~ 결과, 결과 전이면 오늘까지) `getTrackRounds`
- **예전 오더 자동 변환** (읽을 때, `normalizeV8`): 일일 생산량 → 1호기 / 출고일·출고 체크 → '전체' 한 줄 / 컨펌 라운드(발송·합격·불합격) → 전달·컨펌·리젝 /
  오더 단위 외관검사(공정 칸) → 외관검사를 안 쓰는 컬러마다 같은 값 + 검사처. 저장하면 v9 (오더 단위 외관검사 칸은 빠짐)
- `applyStepPatch`: 예상 종료일이 바뀌면 예전 날짜를 `endHistory`에 (patch 에 endHistory 가 있으면 그 목록 그대로 — 입력 창에서 기록을 지웠거나 [비우기])

### 화면
| 기능 | 현황표 | 간트 | 상세창(모바일) |
|---|---|---|---|
| 공정 (예상 시작/종료·기록·상태·기계) | 칸 안 상태 드롭다운(바로 저장) · '최초 9/30 +8일' · 누르면 `ProcessPopover` | 막대 + **최초 예상 회색 점선 테두리**, 막대·[+] → 같은 창 | 공정 줄(상태 드롭다운) → 같은 창 |
| 공정 추가 | 머리 [공정 추가] → `StepManagerPopover` (이름·위치·외주처 이름, 바꾸기·삭제) | 추가 공정 막대(남색) | 공정 줄 |
| 가납기 일수 | 칸에 '편직 9/25 · 36일' → `ProvisionalDuePopover` (기준일 + 일수 ↔ 날짜) | 깃발·[+] → 같은 창 | [일수 · 날짜 입력] → 같은 창 |
| 생지 출고 | 출고마다 한 줄(전체/부분·날짜·메모) + 체크 바로 저장 → `GreigeOutPopover` | 출고마다 하루 막대 | 목록 + 체크 · [출고 기록 편집] |
| 염가공 LOT | 'LOT 3개 · 완료 1' · 투입~완료예정 → `LotEditor`(탕·수량·롤 없음) | LOT 막대 | 요약 · [LOT 편집] |
| 컨펌 · 시험성적서 | [✓성적서] + 상태 드롭다운 · 예정일 / 브랜드 상태 드롭다운 → `ConfirmPopover` | 차수 막대 + 성적서 발행예정(점선) | 같은 칸 + [기록 편집] |
| 외관검사 (컬러별) | 새 칸 '외관검사'(컨펌 다음) 상태 드롭다운 · 투입~종료예정 → `InspectionPopover` | 막대 | 같은 칸 + [외관검사 편집] |
| 출고 | 그대로 (외관검사 '출고완료'면 자동 완료) | 막대 · [+] → `ShipPopover` | 그대로 |

- 간트 줄 이름 옆 **[+]** (`gantt/GanttAddMenu`): 오더 줄 = 공정 일정·가납기 / 컬러 줄 = 생지 출고·LOT·컨펌·외관검사·출고 → 아직 막대가 없는 일정도 간트에서 시작
- 입력 창 공통 (`common/PopoverShell`): 저장 안 한 변경이 있으면 닫을 때 **'변경사항이 있습니다'** (저장하고 나가기 / 저장 안 함 / 계속 편집)
- 상태 드롭다운 공통 `common/StatusSelect` (현황표 칸 안에서는 Tab 으로 안 들어감 — 방향키로 칸을 옮기다 값이 바뀌지 않게)
- 컬러 단계 추가: 프리세팅중 · 생지 부분출고 · 검사대기 · 불량컨펌중 (`COLOR_STAGES`) — 리젝·불합격 = 문제, 컨펌(+성적서 합격) = 출고대기(외관검사 일정이 있으면 검사대기)
- 가납기 '외관검사' 비교 = 컬러 외관검사: 모든 컬러가 출고준비완료·출고완료(또는 출고)여야 완료, 아니면 안 끝난 컬러의 종료예정일
- 리포트 공정별 소요일: 추가 공정 · 외관검사(컬러별) 줄, '예상' 평균

### 검토 · 디버깅 (2026-10-12 — 대표님 요청 '논리 검토 · 리팩토링 · 디버깅')
| 고친 것 | 내용 |
|---|---|
| 예전(v7) 오더 변환 | 편직 일일 생산량이 '1호기'로 안 옮겨지던 것, 컨펌 라운드가 기록으로 안 바뀌던 것 |
| 예전(v8) 외관검사 옮기기 | 입력이 있는 컬러에만 (빈 줄 제외, 컬러가 없으면 첫 줄). 상태는 출고했거나 LOT가 모두 끝난 컬러에만 — 염색 중 컬러가 '검사중'으로 보이지 않게 |
| 외관검사 끝난 날 | 마지막에 이어진 출고준비완료·출고완료의 첫 날 (중간에 불량컨펌중이 있었으면 그 뒤) — 가납기 비교·간트 막대 끝·리포트 실제 일수 |
| 가납기 외관검사 | 모든 컬러가 출고했으면 외관검사를 안 썼어도 완료 |
| 출고 연동 두 방향 | '출고완료'가 자동 체크한 출고는 다른 상태로 바꾸면 풀림 (`color.shipAuto`). 출고 칸을 손으로 바꾸면 그 뒤엔 그대로. 컬러 단계 '출고완료'는 출고 칸 기준 |
| 다른 곳에서 바뀐 값 지키기 | 입력 창은 바뀐 칸만 저장 + 상태 기록·생지 출고 목록은 열 때 목록과 3방향 합치기 (`orderModel.mergeById`) — 창을 열어 둔 사이 현황표·다른 PC에서 고른 상태·출고 체크가 지워지지 않게. 가납기 일수도 바뀐 공정만 |
| '변경사항이 있습니다' 창 | 고친 내용이 있을 때 바깥을 누르면 그 클릭은 뒤 화면에 안 감 (다른 칸 입력 창이 열리며 고친 내용이 사라지던 것). 묻는 창이 떠 있는 동안 키보드는 그 창 안에서만 ('저장하고 나가기'에 포커스, ESC = 계속 편집) |
| 상태 드롭다운 | 바로 저장되는 곳은 고른 뒤 포커스를 내려놓고 방향키로 값이 안 바뀜 (윈도우에서 방향키로 상태 기록이 여러 줄 생기던 것). ESC 는 창 닫기로 그대로 |
| 가납기 창 | 날짜를 키보드로 고치는 중(잠깐 빈칸)엔 일수를 안 지움 — 칸을 떠났는데 비어 있으면 그때 지움. 일수를 쓰면 기준일 필수 |
| 편직 | 기계를 다 빼면 계산도 없어짐 (예전 합계로 계산하던 것), 소수점 생산량 소요일 오차 |
| 공정 추가 | 추가 공정 다음에 둔 공정끼리 순서, 몇 단계든 위치 계산, 같은 key 중복, 자기 뒤 공정을 위치로 못 고르게(돌고 도는 위치), 바꾸는 중에 '새 공정' 칸 Enter 가 엉뚱한 줄을 저장하던 것 |
| 컬러 단계 | 추가 공정이 '문제'면 문제, 외관검사 출고준비완료여도 컨펌·성적서가 남았으면 컨펌중/컨펌대기 |
| 변경 이력 | 예전 예상 종료일 기록을 지운 것도 다른 변경과 같이 남김 |
| 새 버전 보호 | 이 화면보다 새 형식으로 저장된 오더는 고치지 않고 '새로고침' 안내 (`newerSchema`) — **배포한 뒤에는 모든 PC 새로고침** (예전 화면이 열려 있으면 그 PC가 저장할 때 프리세팅·추가 공정 값이 빠질 수 있음) |
- 리팩토링: 입력 창 저장·닫기 공용 `common/usePopoverSave` (공정·가납기·생지 출고·컨펌·외관검사·출고), 외주처 자동완성 공용 `orderModel.collectVendorOptions`

### 공정 흐름 순서 (`constants/production.js`)
`FLOW_ORDER` = #원사 · 사가공 · 편직 · #생지출고 · #염가공 · 후가공 · 이화학 · #컨펌 · #외관검사 · #출고 · #마무리 (`#` = 특별 칸 — 원사·마무리는 오더 단위, 나머지는 컬러별).
(v11 2026-10-14: 원사는 공정 한 세트가 아니라 '#yarn' 칸 — 사종 줄 · 재고 사용 · 원사염색. 위 'v11 — 원사' 절)
(v10 2026-10-14: 프리세팅은 흐름에서 빠지고 염가공 LOT 창으로, '프리세팅 다음'에 둔 추가 공정은 '편직 다음'으로 읽음)
추가 공정은 `settings/general.productionSteps` `[{ key: 'cs_…', label, after, vendorLabel }]` → `buildFlowOrder` · `getStepDefs` (App 이 `useOrder` · 생산 현황 · 리포트에 넘김)

---

## v8 개편 — 엑셀형 현황표 (2026-09, 현재 기준)

> ⚠️ 2026-10-11 v9 개편으로 아래 데이터 구조 중 LOT(탕·수량·롤), 컨펌 라운드, 오더 단위 외관검사, 생지 출고일 한 칸, 편직 일일 생산량 하나는
> 위 'v9' 절의 구조로 바뀜 (예전 오더는 읽을 때 자동 변환).

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

## 설계서 ↔ 샘플 오더 · 메인/샘플 (대표님 요청 2026-10-10)

> 대표님: "개발 설계서 진행 현황을 생산 현황에서 관리. 설계서 진행 자체가 샘플을 한다는 거니까 거기서 메인·샘플 모두 관리.
> 샘플은 마무리되면 아이템화시켜서 설계서 ARTICLE과 연동시키는 것까지 동일해야 해." / "아이템화하거나 Drop일 거고, Drop한 걸 다시 아이템화할 수도 있어."

### 흐름
1. **EZ-TEX O/D NO. 등록 = 샘플 시작** — 개발/설계 현황 줄의 [등록] · 설계서 창에서 번호를 넣고 저장 (`useDesignSheet.registerEztexOrderNo` / `handleSaveSheet`)
   - 번호는 대문자로. 설계서 작성·EZ-TEX 단계면 **'샘플 진행'으로 자동 이동** (대표님 결정 ①)
   - 생산 현황에 **샘플 오더** (`useOrder.linkSampleOrderFromSheet`): order# = EZ-TEX O/D NO., 구분 샘플, detail = 원단명, buyer = 의뢰 바이어,
     납기 = 설계서 납기, article# = 설계서 Article(원단 연결돼 있으면 연결도), 편직처·염색소·후가공처 = 설계서 값 (`orderModel.fillOrderFromSheet`)
   - 같은 order# 오더가 이미 있으면 새로 안 만들고 **연결** (빈 칸만 채움). 연결된 오더가 있는데 번호를 고치면(예전 번호 그대로인 오더) **order#도 따라 바꿈**
   - **다른 설계서의 샘플 오더 번호면 막음** — 설계서도 저장하지 않음 (`checkEztexConflict`, 번호를 잘못 넣은 경우)
2. **샘플 진행은 생산 현황에서** — 원사·편직·염가공 LOT·컨펌·출고·가납기 (메인 오더와 똑같이)
3. **끝: 아이템화 또는 Drop** (대표님 결정 ②)
   - 아이템화 = 개발/설계 현황과 **같은 함수** `setStage(sheetId, 'articled')` → 원단 등록(`registerFabricFromSheet`) →
     샘플 오더 article# = 그 원단(보관함 연결) + **'완료'** (`markSheetOrderArticled`). 설계서 창 [원단 리스트에 등록]·단계 바로 해도 같음
   - Drop → 샘플 오더 **'Drop'** = 완료 + `dropInfo { prevStatus, at }` (`closeSheetOrderOnDrop`) / 복원 → **Drop 전 상태로** (`reopenSheetOrder`) → 그 뒤 아이템화 가능
   - Drop된 설계서는 아이템화·단계 이동·원단 등록이 막힘 ('먼저 복원') — 보관함에 있는 채로 아이템화되지 않게
   - 설계서 삭제 → 샘플 오더는 남고 연결만 풂 (`unlinkSheetOrder`)
   - 자세한 규칙은 아래 '샘플 흐름 점검·디버깅' 절

### 데이터
- 오더 `linkedSheetId` = 설계서 id (**오더 쪽에만** 저장 — 설계서 → 오더는 `linkedSheetId`로 찾음, 양쪽 연결이 어긋날 일이 없게)
- 변경 이력에 까닭이 붙음: '설계서 아이템화 — article# -→PW1060, 오더상태 진행중→완료, 원단 보관함 연결 (PW1060)' (`useOrder.persist(note)`)

### 화면
| 화면 | 내용 |
|---|---|
| 생산 현황 툴바 | **[전체 · 메인 · 샘플]** (구분 숫자는 고른 상태 탭 안에서, 상태 탭 숫자는 고른 구분 안에서, 마지막 선택 기억). 위 요약 칸도 고른 구분 기준 |
| 현황표 order# 칸 · 간트 라벨 · 모바일 카드 | **'설계서'** 표시 (+ Drop / 아이템화 꼬리표). 현황표·모바일은 누르면 설계서 창 (`common/SheetLinkChips.jsx`) |
| ⋯ 메뉴 · 상세창 '설계서 (샘플)' | 설계서 열기 · **아이템화 (원단 등록)** (확인 창 — `OrderListPage.itemizeSheet`) · **Drop (샘플 종료)** · **복원 (다시 진행)** |
| 개발/설계 현황 | **'설계서 진행 현황' 표를 없애고 '개발 의뢰 현황' 한 표로** (대표님 요청 2026-10-10 — 아래 '개발 의뢰 현황 한 표' 절) |

- 고친 버그 (2026-10-10): 개발/설계 현황 PC 표의 EZ-TEX [등록]이 숨은 모바일 칸 값을 읽어서 표에 적은 번호가 무시되던 것 → 그 줄 입력칸 값을 읽음.
- Drop 처리 순서: 설계서를 먼저 Drop으로 저장하고 저장됐을 때만 의뢰 연결을 풂 (예전엔 반대 순서).

### 파일
| 역할 | 파일 |
|---|---|
| 모델 | `utils/orderModel.js` — `fillOrderFromSheet`·`getOrderProgressStage`·`isDropClosed`·`getOpenWork`, `linkedSheetId`·`dropInfo` 정규화·이력 |
| 오더 훅 | `hooks/domains/useOrder.js` — `sheetOrderLink { checkEztexConflict, linkSampleOrderFromSheet, markSheetOrderArticled, closeSheetOrderOnDrop, reopenSheetOrder, unlinkSheetOrder }`, `updateOrder(id, fn, { note })`, `deleteOrder(id, { note })` |
| 설계서 훅 | `hooks/domains/useDesignSheet.js` — 11번째 인자 `sampleOrderLink`, `registerEztexOrderNo`, `syncEztexFromOrder`, `setStage(id, t, { confirmed, base })`, `restoreFromDrop(id, { lead })`, 저장·아이템화·Drop·복원·삭제 때 알림에 결과를 붙임 |
| 연결 | `apps/App.jsx` — `useOrder`를 설계서 훅보다 먼저, `sampleOrderLink`(+`getOrderInfo`), `dropDevWithSheet`, `openSheetEditor`, `openProductionOrder`(생산 현황 focus) |
| 화면 | `pages/OrderListPage.jsx`(메인/샘플·sheetLink·focus·`pageActions`·샘플 끝내기·샘플 Drop 사유 창) · `sheet/ProductionSheet.jsx` · `sheet/OrderMenuPopover.jsx` · `OrderDetailModal.jsx` · `MobileOrderList.jsx` · `gantt/OrderGantt.jsx` · `common/SheetLinkChips.jsx` · `common/SampleCloseDialog.jsx` · `pages/DevStatusPage.jsx` · `pages/ReportPage.jsx` · `pages/DesignSheetPage.jsx` · `dashboard/DevArchiveModal.jsx`·`DevDropModal.jsx` |
| DEV 샘플 | `constants/devSamples.js` — 설계서 `ds_dev_6`(EZ-TEX F-26S055, Article PW1060) ↔ 오더 `F-26S055` |

### 개발 의뢰 현황 한 표 (대표님 요청 2026-10-10 후속)
> 대표님: "설계서 진행 현황이라는 걸 없애고, 개발 의뢰 현황에서 EZ-TEX 오더 등록되면 생산 현황에서 관리.
> 개발 의뢰 현황에서 샘플 진행하기로 했으면 설계서 작성해서 EZ-TEX 번호 넣으면 생산 현황으로 넘어가게끔."

- `DevStatusPage` 의 '설계서 진행 현황' 표 삭제 → **'개발 의뢰 현황' 한 표**. 한 줄 = 개발 건 하나 (`workRows`):
  | 줄 (`kind`) | 무엇 | 단계 칸 | 관리 |
  |---|---|---|---|
  | `dev` | 의뢰만 (의뢰 접수 ~ 개발 확정) | 의뢰 단계 고르기 | 다음 단계 / [설계 시작] · 원가 견적 · 인쇄 · 수정 · Drop · 🗑(의뢰 삭제) |
  | `both` | 의뢰 + 설계서 | 설계서 단계 고르기 | **EZ-TEX 칸 + [등록]** · [설계서 열기] · 원가 견적 · 인쇄 · 의뢰 수정 · 해제 · Drop(**둘 다**) · 🗑(**설계서만**) |
  | `self` | 설계서만 — 자체개발 (또는 의뢰가 Drop·삭제된 설계서) | 설계서 단계 고르기 | EZ-TEX 칸 + [등록] · [설계서 열기] · 연결/해제 · Drop(설계서) · 🗑(설계서) |
  - 번호가 이미 있는 설계서는 [등록] 대신 **[생산 현황에 올리기]** (같은 번호로 다시 등록 = 샘플 오더 만들기·연결)
  - **빠지는 줄**: 생산 현황 샘플 오더가 생긴 설계서(→ 생산 현황) · 아이템화 · Drop. 생산 현황으로 간 의뢰는 보관함 **'샘플 진행 (생산 현황)'** 탭 (예전 '진행중 (설계서 연결)', [생산 현황 →] 버튼)
  - 자체개발 자리: 같은 표 (대표님 선택). 머리에 **[자체 설계서]** 버튼 (의뢰 없이 새 설계서)
- **의뢰 Drop = 설계서도 같이** (대표님 결정): Drop 사유 창에 '설계서(원단명)도 같이 Drop돼요' 안내 →
  `App.dropDevWithSheet`: 설계서 먼저 `dropDesignSheet(id, { confirm:false, quiet:true, keepDevLink:true })`, 그다음 `dropDevRequest(..., { note, sheetId })`.
  복원은 보관함 'Drop된 의뢰' [복원] 또는 설계서 보관함에서 설계서 복원 → 의뢰도 '개발 확정'으로 같이 (`restoreFromDrop`)
- 🗑 (설계서가 있는 줄) = 설계서만 삭제 (`handleDeleteSheet` — 의뢰는 남아 '개발 확정'(설계 대기) 줄로)
- 요약 카드(진행중·지연·임박·오늘 신규)·검색·정렬(O/D No.·날짜·단계·바이어)은 이 줄 기준. 납기 = 설계서 납기(없으면 의뢰 샘플 납기)
- 설계서 세부단계(원사 발주/편직/염가공/중단)는 없앰 (샘플 진행은 생산 현황) — 2026-10-10 점검 때 `setSamplingSub`·`SAMPLING_SUBSTAGES` 코드도 지움 (예전 문서의 `samplingSub` 값만 남음)

### 샘플 흐름 점검·디버깅 (대표님 요청 2026-10-10 — "개발/설계 현황에서 생산 현황까지 생산 관리자 입장에서 논리 점검")
> 대표님 결정: ① 생산 현황에서 샘플 Drop = **의뢰도 같이 Drop** (사유 창) ② 설계서가 안 끝난 샘플을 '완료'로 → **작은 창으로 묻기** ③ 리포트 **[전체·메인·샘플], 처음 '메인'**

**샘플 끝 상태**
- 설계서 Drop → 샘플 오더 `dropInfo { prevStatus, at }` (상태값은 '완료'). 표·간트 'Drop', 상세창 머리 'Drop (샘플)', ⋯ 메뉴 '샘플 Drop으로 닫힘' (`orderModel.isDropClosed`)
  - 복원 → `prevStatus` 로 (원래 '완료'였던 샘플은 '완료' 그대로 = 아이템화 대기). 손으로 상태를 바꾸면 `dropInfo` 는 지워짐 (`applyOrderField`)
- **샘플 끝내기 창** (`components/order/common/SampleCloseDialog.jsx`): 연결 샘플 오더를 '완료'로 바꿀 때 설계서가 아직이면
  [아이템화 (원단 등록)] [Drop (샘플 종료)] [오더만 완료 — 나중에 정하기]. 끝나지 않은 공정 안내 (`orderModel.getOpenWork`)
- **아이템화 대기** = 오더 '완료' + 설계서 아직 (아이템화·Drop 전) → '진행 중' 탭에 남김, 머리 요약 '아이템화 대기 N', 칩 (`OrderListPage.sheetInfoOf().awaiting`)
- Drop된 샘플 오더를 '진행중'·'보류'로 바꾸면 → 설계서 복원 확인 창 (`restoreFromDrop(id, { lead })`)
- 아이템화 (생산 현황): 설계서에 Article·GSM·폭·혼용률 100%가 없으면 "설계서를 열까요?" / 확인 창에 끝나지 않은 공정
- 완료된 오더는 공정 날짜를 빨간 '지연'으로 안 보임 (현황표 `StepSummary`)
- 리포트: [전체·메인·샘플] (`grubig.report.type`, 처음 '메인'), Drop 샘플은 납기 준수율·월별 완료·거래처별 완료에서 빼고 상태별 분포 'Drop'·거래처 'Drop' 칸

**의뢰·설계서·샘플 오더 Drop·복원 맞추기**
- 생산 현황 [Drop]: 의뢰가 살아 있는 설계서면 `DevDropModal`(order# 안내) → `App.dropDevWithSheet` (개발/설계 현황 Drop 과 같은 함수). 자체개발·의뢰가 이미 Drop 이면 설계서만
- 의뢰에 같이 Drop한 설계서 `droppedSheetId` → 보관함 [복원]이 설계서까지 (`DevArchiveModal.droppedSheetOf` → `restoreFromDrop`), 카드에 '설계서도 같이 Drop'
- `restoreFromDrop`: 같은 의뢰가 다른 설계서로 진행 중이면 막음 / Drop 사유·`droppedSheetId` 지움
- Drop된 설계서: 저장해도 의뢰 확정·연결 안 함 (`handleSaveSheet` + `linkAndConfirm` 가 rejected 무시), 단계·원단 등록·EZ-TEX 등록 막음, 설계서 창 'Drop됨' 안내 + [복원]
- 보관함 '샘플 진행': '개발 확정' 전 단계 의뢰도 (설계서가 생산 현황으로 갔으면), 카드에 '생산: 편직중·염색중·완료 · 아이템화 대기' (`getOrderProgressStage`)

**설계서 단계·EZ-TEX 안전장치**
- '샘플 진행' 고르기 = EZ-TEX 등록 (`setStage` → `registerEztexOrderNo`, 번호 없으면 막음)
- 확인 창: 샘플 오더가 있는 '샘플 진행' 설계서를 앞 단계로 / 아이템화를 되돌릴 때 / 진행 중 샘플 오더가 있는데 아이템화 (`sampleOrderLink.getOrderInfo`)
- 단계 바를 누를 때 저장 안 한 변경이 있으면 저장 → 그 저장본으로 이동 (`setStage(id, t, { base })`, App `isSheetDirty`·`onSavedKeepOpen`)
- 샘플 오더가 있으면 EZ-TEX 번호를 비울 수 없음 · 열어 둔 창의 옛 연결 칸(EZ-TEX·의뢰·원단)으로 덮어쓰지 않음 (`LINK_KEYS`)
- `checkEztexConflict`: 새 설계서(아직 id 없음)가 엉뚱한 오더 때문에 막히던 버그, 기존 **메인** 오더 번호면 막음
- 아이템화·Drop된 설계서에 번호를 넣어도 샘플 오더 안 만듦 (`linkSampleOrderFromSheet` → 'skipped')

**생산 현황 실수 방지**
- 설계서와 연결된 샘플 오더는 메인으로 못 바꿈 (`updateOrder`), order# 를 바꿔도 '샘플' 그대로
- order# 를 고치면 설계서 EZ-TEX O/D NO.도 같이 (`useDesignSheet.syncEztexFromOrder`, 설계서 변경 이력 '생산 현황에서 order# 변경')
- 샘플 오더 삭제 확인 창에 "설계서는 개발/설계 현황으로 돌아가요 · 그만두려면 Drop" (`deleteOrder(id, { note })`)

**아직 안 한 것 (대표님이 정하면)**: 의뢰 바이어·납기를 고쳐도 이미 만든 샘플 오더엔 안 따라감 / 원단을 지우면 그 원단에 연결된 오더(메인 포함) 연결이 남음

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
