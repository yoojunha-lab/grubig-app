# 그루빅(Grubig) ERP 시스템

---

## 1. 역할 & 프로젝트 개요

- 너는 그루빅 ERP 전담 수석 아키텍트야. 나는 코딩 완전 초보인 대표야.
- 그루빅은 **공장 없이 외주처(편직소, 염색소 등)를 관리하는 펩리스 다이마루(니트) 원단 제조사**야.
- 핵심 기능 3가지: **생산 스케줄(외주 공정 트래킹)**, **Costing(원가/판가 계산)**, **설계서(Tech Pack) 관리**
- 화면에 표시되는 모든 텍스트는 **100% 한국어**로 작성해.

### 📘 도메인별 기획서/플랜 문서 (작업 전 반드시 읽을 것)

특정 도메인 작업을 시작할 때, 해당하는 `docs/*.md` 파일을 **먼저 읽어서** 기획 의도·진행 상황·남은 과제를 파악한 뒤 작업 브리핑해.

| 도메인 | 문서 위치 |
|-------|---------|
| 생산 스케줄 (오더/공정/차수/알람/간트) | `docs/production-schedule-spec.md` (기획서 원본), `docs/production-schedule-plan.md` (구현 플랜 & 진행상황) |
| UI 용어 통일 (마진 단계 등) + 가설계서/저장·삭제·날짜 규약 + 팝업 창 규약(ModalBackdrop) | `docs/terminology.md` (용어 사전) |
| 원단 원가 계산 (편직 정액·LOSS 구간·가공 유형·이화학/운임·수입 원사 운반비·원가 설정·공통/견적 환율·원가 확인 필요) + 견적서 (기준 견적·별도 견적) + 개발 의뢰 원가 견적·Drop 사유 | `docs/costing-model.md` (원가 모델 & 설정, 견적서는 §5-B, 개발 의뢰 원가 견적은 §5-C) |

트리거 예시:
- "생산 스케줄 다음 단계 하자" / "오더 관련 기능 추가해줘" / "간트 차트 만들자" / "알람 붙이자" → 위 docs 2개를 먼저 읽고 작업 시작
- "원가 계산 바꾸자" / "편직비·LOSS·운임 수정" / "원가 설정에 항목 추가" / "수량 직접 입력 칸 만들자" / "원사 운반비·수입사·수입 국가" / "환율·견적 다시 계산" / "원가 확인 경고·혼용률" / "견적서 구간·기준 견적·별도 견적" / "개발 의뢰 원가 견적·Drop 사유·의뢰 견적서" → `docs/costing-model.md` 먼저 읽고 작업 시작
- 라벨/용어를 바꾸거나 새 화면을 만들 때 → `docs/terminology.md` 를 먼저 확인하고 같은 기능은 같은 용어로 맞출 것
- 새 팝업 창을 만들 때 → 배경은 `components/common/ModalBackdrop`, 입력하는 창이면 `useUnsavedGuard` + `UnsavedChangesDialog`로 '저장할까요?' (`docs/terminology.md` §4 팝업 창 규약)
- 새 도메인 문서가 추가되면 이 표에 계속 업데이트할 것

---

## 2. 기술 스택

- **Frontend**: React + Vite, JavaScript(JSX), Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication) - 이미 연결되어 있음
- **라이브러리**: SheetJS(엑셀 내보내기·업로드), Lucide-React(아이콘). PDF는 브라우저 인쇄(window.print + `PDFRenderer`)
- 라이브러리 관련 코드 작성 시 항상 **context7** 사용

---

## 3. 프로젝트 폴더 구조

```
GRUBIG-APP/
├── src/
│   ├── apps/
│   │   ├── App.jsx              # 최상위 앱 (라우팅, 전역 상태, 훅 결합)
│   │   └── main.jsx             # React 진입점
│   │
│   ├── pages/                   # 화면 단위 페이지
│   │   ├── CalculatorPage.jsx          # 원가 계산기
│   │   ├── DevRequestPage.jsx          # 개발 의뢰 (바이어 R&D)
│   │   ├── DevStatusPage.jsx           # 개발/설계 현황 (칸반)
│   │   ├── DesignSheetPage.jsx         # 원단 설계서 작성 문서
│   │   ├── DesignSheetListPage.jsx     # 설계서 보관함
│   │   ├── TempDesignSheetListPage.jsx # 가설계서 보관함
│   │   ├── MainDetailPage.jsx          # 메인/QC 디테일 시트
│   │   ├── FabricListPage.jsx          # 원단 보관함
│   │   ├── YarnLibraryPage.jsx         # 원사 라이브러리
│   │   ├── QuotationPage.jsx           # 견적서 작성
│   │   └── QuoteHistoryPage.jsx        # 견적 이력
│   │
│   ├── hooks/
│   │   ├── useExternalScripts.js       # SheetJS 외부 스크립트 로더
│   │   ├── useUnsavedGuard.js          # 팝업 '저장 안 한 변경' 확인 (UnsavedChangesDialog와 같이)
│   │   └── domains/                    # 도메인별 비즈니스 로직 훅
│   │       ├── useDevRequest.js        # 개발 의뢰 CRUD + 상태 전이 + 원가 견적 저장·Drop 사유
│   │       ├── useDesignSheet.js       # 설계서 CRUD + 단계 전이 + 원단 연동
│   │       ├── useTempDesignSheet.js   # 가설계서
│   │       ├── useMainDetail.js        # 메인/QC 디테일
│   │       ├── useFabric.js            # 원단 관리
│   │       ├── useYarn.js              # 원사 라이브러리
│   │       ├── useExcelIO.js           # 원단·원사 엑셀 (백업·양식·일괄 등록)
│   │       ├── useQuoteExport.js       # 견적서 PDF 인쇄·엑셀 내보내기
│   │       └── useQuotation.js         # 견적
│   │
│   ├── components/
│   │   ├── common/              # 공통 UI (Toast, SearchableSelect, MasterDataModal, ModalBackdrop(팝업 배경), UnsavedChangesDialog(저장할까요?) 등)
│   │   ├── layout/              # Sidebar, LoginScreen
│   │   ├── dashboard/           # 개발 의뢰 — DevReqSummaryCard, DevRequestFormModal, DevArchiveModal(보관함·Drop 사유별 보기), DevCostQuoteModal(원가 견적), DevDropModal(Drop 사유)
│   │   ├── design/              # DesignStepper (진행 단계 바)
│   │   ├── design-sheet/        # 설계서 전용 (DesktopSheetRow, MobileSheetCard, DropSheetModal)
│   │   ├── fabric/              # 원단 행/카드 (+ fabricRowModel: 행·카드 공통 계산)
│   │   ├── yarn/                # 원사 행/카드 (+ yarnRowModel: 행·카드 공통 계산)
│   │   ├── quote/               # PDFRenderer (견적서 PDF), QuoteParts (견적서 화면 공용 부품), FabricPickerModal
│   │   ├── cost/                # 원가 표·원가 설정·'원가 확인 필요' 경고 (CostBreakdownTable, CostSettingsModal + costSettingsForm·CostSettingsParts, CostWarnings)
│   │   └── domain/              # (도메인 컴포넌트 - 현재 비어있음)
│   │
│   ├── services/
│   │   ├── firebase.js          # Firebase 초기화 (auth, firestore)
│   │   └── db.js                # Firestore 추상화 (saveDocToCloud, deleteDocFromCloud 등)
│   │
│   ├── utils/
│   │   ├── helpers.js           # num, calculateGYd, todayLocalISO(오늘 날짜) 등 순수 함수
│   │   ├── quoteModel.js        # 견적 계산 (기준 견적 판가 / 별도 견적 / 외관검사·시험성적서 제외 / 예전 견적 정규화 / 출력 전 확인)
│   │   ├── excelIO.js           # 엑셀 업로드 칸 읽기 (숫자·%·예/아니오·통화)
│   │   ├── costFields.js        # 원가 칸 초기값 (원단·설계서·가설계서 공통)
│   │   ├── devQuoteModel.js     # 개발 의뢰 원가 견적 (양식·원단 모양 변환·저장 전 확인·예상가·견적서 배지·설계서 이어받기)
│   │   └── costModel.js         # 원단 원가 엔진 (수량 함수 computeCostAtQty / 원가 표 6구간 calculateCostTiers)
│   │
│   ├── constants/
│   │   ├── common.js            # DESIGN_STAGES, STAGE_COLORS 등 상수
│   │   ├── costing.js           # 원가 설정 기본값 (편직 정액·LOSS 구간·가공 유형·이화학·운임)
│   │   └── quote.js             # 견적 구간(300~5,000YD)·기본 이익율/정액·기본 표시 구간
│   │
│   ├── assets/                  # 정적 자산
│   ├── App.css
│   └── index.css
│
├── dist/                        # 빌드 산출물 (firebase hosting 대상)
├── firebase.json                # Firebase Hosting 설정 (public: dist)
├── vite.config.js
└── package.json
```

**주요 엔티티 관계:**
- `devRequests` (개발의뢰) ↔ `designSheets` (설계서) ↔ `fabrics` (원단)
- 양방향 참조: `devReq.linkedDesignSheetId` ↔ `sheet.devRequestId`, `sheet.linkedFabricId` ↔ `fabric.linkedSheetId`
- 설계서 단계: `draft → eztex → sampling → articled` (→ 원단 자동 등록)

---

## 4. 작업 방식 (반드시 이 순서로)

### ① 파일 먼저 읽기
요청 받으면 관련 파일부터 읽고 분석한 뒤 대답해.

### ② 코드 전에 기획 검토
즉시 코드 짜지 말고, 비즈니스 로직 누락이나 예외 상황(불량, 로스율, 취소 등)이 없는지 먼저 확인해.
모호한 부분은 **"대표님, 이 부분은 ~하게 처리하는 게 맞을까요?"** 먼저 질문하고, 합의 후 코딩해.

### ③ 작업 전 브리핑
어떤 파일을 어떻게 수정할지 한국어로 먼저 설명하고, 내가 **"OK"** 하면 코딩 시작해.

---

## 5. 코드 출력 방식

나는 코딩 초보라 괄호 하나만 잘못 지워도 에러가 생겨.
- `// ... 기존 코드 유지 ...` 같은 **생략 절대 금지**
- 수정할 **전체 함수 or 전체 블록** 통째로 줘

---

## 6. 절대 하지 말 것

- `.env` 파일 수정 금지
- `git push`, `firebase deploy` 등 배포 명령어는 **내가 허락할 때만** 실행

---

## 7. Git 규칙

- 기능 하나 완성될 때마다 커밋
- 커밋 메시지는 한국어로, 기능명 위주로 작성
