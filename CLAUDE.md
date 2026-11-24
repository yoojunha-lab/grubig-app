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
| 생산 스케줄 (오더/공정/차수/알람/간트·가납기·날짜 메모) + 생산 현황 v9 (예상 시작/종료일·최초 예상 기록·상태 드롭다운·편직 기계별 생산량·공정 추가·가납기 일수·생지 전체/부분 출고·LOT·시험성적서·브랜드 컨펌·간트 [+]) + 생산 현황 v10 (LOT 배색량·예상 YD·프리세팅 → LOT 창·외관검사 LOT별 1차·2차(투입 전·재가공)·오더 마무리(원사재고정리·EZTEX 재고정리·EZTEX 종결)·선염/후염(후염 = 생지 출고 오더에 한 번)·생지 출고 kg·간트 날짜 → 그 날에 넣기) + 설계서 샘플 오더 (메인/샘플, EZ-TEX 등록 → 샘플 오더, 아이템화·Drop·샘플 끝내기·아이템화 대기) + 구분 잠금·샘플 종류 (메인/신제품/재샘플 — 만들 때 정하고 잠김·[구분 바꾸기] 사유·생산 현황에서 신제품 설계서 작성/연결·재샘플 아이템 필수·종류 미정) + 진행 안 함·마무리 안 됨 (편직 재고 사용(생지 재고)·컨펌·성적서/외관검사 '안 함'·[마무리 안 됨] 모아 보기·메모 칸 오더kg 앞) + 생산 ▾ 계산기 (선염 — 스트라이프 원사 배분·멜란지 수량 비율) | `docs/production-schedule-spec.md` (기획서 원본), `docs/production-schedule-plan.md` (구현 플랜 & 진행상황, 구분 잠금은 '구분 잠금 · 샘플 종류' 절, 진행 안 함·마무리 안 됨은 '진행 안 함 · 마무리 안 됨 모아 보기 · 메모 칸' 절, v10은 '생산 현황 v10' 절, v9 개편은 '생산 현황 개편 v9' 절, 가납기는 '가납기 · 간트 메모' 절, 샘플 오더는 '설계서 ↔ 샘플 오더' 절 + '샘플 흐름 점검·디버깅' 절, 계산기는 '생산 ▾ 계산기' 절, 가로 스크롤바 고정·order# 정렬은 '가로 스크롤바 고정 · order# 정렬' 절, 출고 끝 = 완료(마무리는 [마무리 안 됨]에서)·[완료로 넘기기]는 '출고 끝 = 완료' 절) |
| UI 용어 통일 (마진 단계 등) + 가설계서/저장·삭제·날짜 규약 + 목록 정렬(Article 순서 §3-A) + 팝업 창 규약(ModalBackdrop) | `docs/terminology.md` (용어 사전) |
| 원단 원가 계산 (편직 정액·LOSS 구간·가공 유형·이화학/운임·수입 원사 운반비·원가 설정·공통 환율(내수·수출)/견적 환율·실시간 환율·원가 확인 필요·원가 표 6구간(300·500·700YD + 1,000·3,000·5,000YD)) + 견적서 (기준 견적·별도 견적·러닝 생지 견적·견적서 약관 문구(내수는 한글)·예전 800YD 견적 보존·M 견적서(견적서 단위 YD/M — PDF·엑셀만 M 환산)) + 개발 의뢰 원가 견적·Drop 사유 + 가설계서 판매가·가견적서 (시장 구분 내수/수출·외관검사/시험성적서 제외·6구간·견적서 기본 마진·가견적서 PDF/엑셀 — Article = 원단명) | `docs/costing-model.md` (원가 모델 & 설정, 구간 800 → 700YD는 §1-D, 환율은 §5-A, 견적서는 §5-B(M 견적서도 §5-B), 개발 의뢰 원가 견적은 §5-C, 가설계서 판매가·가견적서는 §5-D) |
| 기타 ▾ 헹거 스티커 (TAG 엑셀 양식 그대로 뽑기 — 아이템 필수·WIDTH·WEIGHT는 아이템 값 잠금(실제 G/YD), CATEGORY 고르기·CARE 체크([⚙ 설정] 목록), QR 그림 올리기(EZ-TEX 주소 읽기), 체크해서 여러 장 엑셀 다운로드) | `docs/hanger-sticker.md` (양식 칸 위치·QR 규칙·칸 규칙·설정·엑셀 만드는 법·확인한 것) |
| 개발 ▾ 편직처 기계 현황 (예전 편직처 엑셀 — 목록(요약 막대·계열 거르기·정렬, 줄마다 편직처·기계 종류별(게이지·인치 줄 맞춤)·우리 작업/메모 — 연락처는 상세에만) → 상세 [← 목록으로], 기계 줄(종류는 [⚙ 기계 종류] 설정 — 계열도 직접·지금 꼽힌 가마·스판장치) + 보유 가마(같은 종류·인치끼리 돌려 씀), [기계로 찾기] 지금 꼽힘/가마 교체/근접, 카카오 [지도] 방문 순서·길찾기·[주소로 다시 찾기](직접 찍은 위치 → 적힌 주소), 엑셀은 Claude가 판단한 정리본(.json) 가져오기, 설계서 [기계 현황에서 고르기], 메모·확인일·우리 작업 이력 · [기계로 찾기] 피더 칸(96F · 근접 ±10% · 피더 모르는 기계도 보기) · [엑셀로 내보내기](편직처·기계·보유 가마·메모 시트) · 메모 종류 메모/방문/통화(방문·통화 → 확인일)) | `docs/knit-factory.md` (정한 것·화면·데이터·정리본 판단·확인한 것) |
| 개발 ▾ 고도화 — 의뢰 → 설계서 → 샘플 → 아이템화 (메인/QC 저장 결과·비고·중복 확인, 설계서 확인칸 값 바뀌면 노랑·새 설계서 폭/GSM 빈칸·내폭≤외폭·가설계서 불러오기는 새 설계서만·아이템화 설계서 🗑 없음, 의뢰서 폭/중량·바이어 특이사항 칸, 원사 삭제 전 가설계서·원가 견적 확인, 개발/설계 현황 '샘플 진행 (생산 현황)' 표·지연/임박 합산, 의뢰 '아이템화 완료' 자동·원단 devSource, 개발 통계(의뢰→아이템화 %·일수·Drop 사유·바이어별), 의뢰 고치면 설계서·샘플 오더 납기/바이어 묻기, 회신 대기 N일·담당자 거르기 / 3단계: 설계서 인쇄(편직처용·염색소용, 원가 없이, 제 N판)·설계서 안 샘플 오더 칸(실측 vs 설계 ±5%)·메인/QC 생산 현황에서 고르기(오더·컬러·LOT)·상세창 메인/QC 결과·변경 이력 옛 값→새 값·원사 교체·피더·원단 관리 수정·가설계서 정식 전환됨·보관함 원사/바이어/GSM 찾기·정렬·Drop 사유·자체개발 Drop 사유) | `docs/dev-flow.md` (정한 것·1단계 빈틈 표·2단계 ①~⑤·3단계 ①~⑩·4단계 후보·파일·확인한 것) |
| 생산 ▾ LAB-DIP (예전 영업 ▾ Lab-Dip 발송 — 공장 의뢰 + 바이어 발송 묶음: L/D NO. GB26023~(연도마다 001)·공장에 의뢰/바이어 발송만(EZ-TEX)·원단 ARTICLE·ITEM NAME·GSM·폭·울 종류(원사 SW → 슈퍼워시)·광원·PANTONE/바이어 스와치, 컬러마다 공장 진행중→L/D 도착→컨펌대기→컨펌·리젝(같은 번호 2차)·Drop, 진행중·컨펌대기중·완료 탭·공장/바이어 납기, 공장 의뢰서(바이어 안 찍힘)·바이어 시트(공장 안 찍힘), 예전 기록, 개발 건 연결(원단 없이 개발 의뢰·아이템화 전 설계서에서 ARTICLE·ITEM NAME·GSM·폭 — '개발 F-26D011' 칩·아이템화 → PW1060, 개발/설계 현황·설계서에 L/D 요약 배지)) | `docs/labdip.md` (요청·정한 것·흐름·번호·상태·인쇄 규칙·데이터·예전 기록·확인한 것, 개발 건 연결은 §13) |

트리거 예시:
- "생산 스케줄 다음 단계 하자" / "오더 관련 기능 추가해줘" / "간트 차트 만들자" / "알람 붙이자" / "선염 계산기·원사 컬러 배분·멜란지 비율" / "가납기·간트 메모" / "가납기 일수·기준일" / "편직 예상 종료일·기계별 생산량·프리세팅·공정 추가" / "생지 부분출고·시험성적서·브랜드 컨펌·외관검사·LOT" / "배색량·예상 YD·프리세팅·외관검사 1차 2차·재가공" / "남은 배색량·생지kg(예전 작지kg)·와이드 모니터에서 현황표·간트 넓게" / "원사 사종·발주대기·발주완료·입고완료·중지·재고 사용·원사염색" / "오더 마무리·원사재고정리·EZTEX 종결·마무리 대기" / "선염/후염·생지 출고 한 번에·출고 kg" / "간트 날짜 눌러 공정 넣기" / "샘플 오더·메인/샘플·설계서 샘플 진행·생산 현황에서 아이템화" / "개발 의뢰 현황·EZ-TEX 등록·자체개발 설계서" / "샘플 Drop·복원·아이템화 대기·샘플 끝내기·리포트 메인/샘플" / "샘플/메인 바꾸기·구분 잠금·신제품/재샘플·종류 미정·설계서 없음·아이템 선택·구분 바꾸기" / "편직 재고 사용·생지 재고·컨펌/외관검사 안 함·진행 안 함·마무리 안 됨 모아 보기·메모 칸 위치" / "완료 탭으로 언제 가나·출고 끝 자동 완료·마무리 대기·완료로 넘기기" → 위 docs 2개를 먼저 읽고 작업 시작
- "원가 계산 바꾸자" / "편직비·LOSS·운임 수정" / "원가 설정에 항목 추가" / "수량 직접 입력 칸 만들자" / "원사 운반비·수입사·수입 국가" / "환율·내수/수출 환율·실시간 환율·견적 다시 계산" / "원가 확인 경고·혼용률" / "견적서 구간·기준 견적·별도 견적" / "러닝 생지 견적·생지 짠 수량·컬러별 수량·소량 추가분(서차지)" / "개발 의뢰 원가 견적·Drop 사유·의뢰 견적서" / "원가 표·견적 구간 바꾸기(800 → 700YD)·예전 구간 견적" / "M 견적서·미터 단가·견적서 단위 YD/M" / "가설계서 costing·가설계서 판매가·가견적서·가설계서 시장 구분·가설계서 외관검사/시험성적서 제외" → `docs/costing-model.md` 먼저 읽고 작업 시작 (가설계서는 §5-D)
- "헹거 스티커 칸 추가·양식 바꾸기" / "TAG 엑셀·스티커 QR" / "스티커 여러 장 뽑기" / "CATEGORY·CARE 목록·스티커 설정" / "스티커 WIDTH·WEIGHT·G/YD" → `docs/hanger-sticker.md` 먼저 읽고 작업 시작
- "L/D를 개발 의뢰·설계서에 연결" / "개발 건 칩·L/D 요약 배지" → `docs/labdip.md` §13 먼저
- "L/D·랩딥·LAB-DIP" / "L/D 의뢰서·공장 의뢰" / "바이어 시트·L/D 발송" / "L/D 번호·GB 번호" / "슈퍼워시·울 종류" / "컨펌대기·리젝·2차 의뢰" / "EZ-TEX L/D" / "L/D를 생산 현황에 연결" → `docs/labdip.md` 먼저 읽고 작업 시작
- "설계서 인쇄·편직처용·염색소용·판 번호" / "설계서 안 샘플 오더·실측 vs 설계" / "QC 오더·LOT 고르기·메인/QC 결과" / "변경 이력 옛 값 새 값" / "가설계서 정식 전환됨" / "설계서 보관함 찾기·정렬·Drop 사유" → `docs/dev-flow.md` 3단계 먼저 읽고 작업 시작
- "개발 고도화·개발 메뉴 점검" / "메인/QC 저장·비고·중복" / "설계서 확인칸·폭/GSM 기본값·내폭 외폭·가설계서 불러오기" / "의뢰서 폭/중량·바이어 특이사항" / "원사 삭제 막기" / "샘플 진행 표·EZ-TEX 뒤에도 보기" / "의뢰 아이템화 완료·의뢰 닫기" / "개발 통계·Drop 비율·바이어별" / "의뢰 고치면 설계서·샘플 오더 납기" / "회신 대기·담당자" / "설계서 인쇄·변경 이력·가설계서 전환(3단계)" → `docs/dev-flow.md` 먼저 읽고 작업 시작
- "피더로 찾기·편직처 엑셀 내보내기·방문 기록·통화 기록·확인일 자동" → `docs/knit-factory.md` 먼저
- "편직처·편직처 기계·가마(지금/보유)·게이지로 편직처 찾기" / "기계 종류·계열" / "스판장치" / "편직처 지도·방문 순서·카카오맵 키" / "편직처 정리본 가져오기" / "설계서 기계 현황에서 고르기" / "편직처 메모·확인일" → `docs/knit-factory.md` 먼저 읽고 작업 시작
- 라벨/용어를 바꾸거나 새 화면을 만들 때 → `docs/terminology.md` 를 먼저 확인하고 같은 기능은 같은 용어로 맞출 것
- 새 팝업 창을 만들 때 → 배경은 `components/common/ModalBackdrop`, 입력하는 창이면 `useUnsavedGuard` + `UnsavedChangesDialog`로 '저장할까요?' (`docs/terminology.md` §4 팝업 창 규약)
- 새 도메인 문서가 추가되면 이 표에 계속 업데이트할 것

---

## 2. 기술 스택

- **Frontend**: React + Vite, JavaScript(JSX), Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication) - 이미 연결되어 있음
- **라이브러리**: SheetJS(엑셀 내보내기·업로드), Lucide-React(아이콘). PDF는 브라우저 인쇄(window.print + `PDFRenderer`)
  - 헹거 스티커 전용: fflate(양식 엑셀 파일 안 XML 직접 고치기 — 글꼴·그림 그대로), qrcode-generator(QR 만들기), jsQR(올린 QR 그림 읽기 — 그때만 불러옴)
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
│   │   ├── DevStatusPage.jsx           # 개발/설계 현황 — 개발 의뢰 현황 한 표 (의뢰·설계서·자체개발 줄, EZ-TEX 등록 → 생산 현황 샘플) + 샘플 진행 (생산 현황) 표 · 개발 통계 · 담당자 거르기 · 회신 대기
│   │   ├── OrderListPage.jsx           # 생산 현황 (현황표·간트, 메인/샘플, 설계서 샘플 오더 — 샘플 끝내기·아이템화 대기·샘플 Drop)
│   │   ├── ReportPage.jsx              # 리포트 (생산 통계 — [전체·메인·샘플], Drop 샘플은 완료 통계에서 뺌)
│   │   ├── DesignSheetPage.jsx         # 원단 설계서 작성 문서 (새 설계서 위 [설계서 불러오기] — 기존 설계서 스펙 복사해서 시작)
│   │   ├── DesignSheetListPage.jsx     # 설계서 보관함
│   │   ├── TempDesignSheetListPage.jsx # 가설계서 보관함 (가설계서마다 시장·제외 표시 · 가견적서 [PDF]·[엑셀])
│   │   ├── MainDetailPage.jsx          # 메인/QC 디테일 시트
│   │   ├── FabricListPage.jsx          # 원단 보관함
│   │   ├── YarnLibraryPage.jsx         # 원사 라이브러리
│   │   ├── QuotationPage.jsx           # 견적서 작성
│   │   ├── QuoteHistoryPage.jsx        # 견적 이력
│   │   ├── ProductionCalcPage.jsx      # 생산 ▾ 계산기 (선염 — 스트라이프 원사 배분·멜란지 수량 비율, 저장 목록)
│   │   ├── KnitFactoryPage.jsx         # 개발 ▾ 편직처 기계 현황 ([편직처] 목록 → 상세 / [기계로 찾기] / [지도] · 기계 종류 설정 · 정리본 가져오기)
│   │   ├── LabdipPage.jsx              # 생산 ▾ LAB-DIP (진행중·컨펌대기중·완료 탭 · 목록 · 작성 화면 · 진행 창)
│   │   └── HangerStickerPage.jsx       # 기타 ▾ 헹거 스티커 (저장된 스티커 목록 · 체크해서 엑셀 다운로드)
│   │
│   ├── hooks/
│   │   ├── useExternalScripts.js       # SheetJS 외부 스크립트 로더
│   │   ├── useUnsavedGuard.js          # 팝업 '저장 안 한 변경' 확인 (UnsavedChangesDialog와 같이)
│   │   ├── useMarketRate.js            # 실시간 환율 (참고용 — 화면 위 내수·수출 환율 칸 옆)
│   │   ├── useFitToViewport.js         # 스크롤 상자 높이를 화면에 남은 높이로 (생산 현황 현황표·간트 — 가로 스크롤바 늘 화면 맨 아래)
│   │   └── domains/                    # 도메인별 비즈니스 로직 훅
│   │       ├── useDevRequest.js        # 개발 의뢰 CRUD + 상태 전이 + 원가 견적 저장·Drop 사유
│   │       ├── useDesignSheet.js       # 설계서 CRUD + 단계 전이 + 원단 연동 + EZ-TEX 등록 → 생산 현황 샘플 오더 (sampleOrderLink) + Drop·복원 + 기존 설계서 불러오기 (loadSheetAsTemplate — 스펙만 복사, copiedFrom)
│   │       ├── useOrder.js             # 생산 현황 오더 (칸 단위 즉시 저장·가납기·생지 출고(선염/후염)·상태 기록(성적서·컨펌)·LOT 외관검사 차수·마무리 체크·원사 사종 줄·재고 사용·설계서 샘플 오더 sheetOrderLink — Drop 표시 dropInfo·구분 잠금(메인/신제품/재샘플 — changeOrderKind 사유)·출고 끝 자동 완료(마무리와 상관없이 — completeShippedOrders [완료로 넘기기]))
│   │       ├── useTempDesignSheet.js   # 가설계서 (+ makeBlankTempInput 빈 양식 · toEditableTempInput 저장된 가설계서 → 편집 창 값 — 목록 판매가·가견적서도 같은 값)
│   │       ├── useMainDetail.js        # 메인/QC 디테일
│   │       ├── useFabric.js            # 원단 관리
│   │       ├── useYarn.js              # 원사 라이브러리
│   │       ├── useExcelIO.js           # 원단·원사 엑셀 (백업·양식·일괄 등록)
│   │       ├── useQuoteExport.js       # 견적서 PDF 인쇄·엑셀 내보내기
│   │       ├── useYarnDyeCalc.js       # 생산 ▾ 계산기 — 선염 계산 저장·불러오기·삭제 (Firestore yarnDyeCalcs)
│   │       ├── useKnitFactory.js       # 개발 ▾ 편직처 기계 현황 — 저장·삭제·메모·확인일·지금 가마 바꾸기·지도 위치·종류 이름 바꾸기·정리본 가져오기 (Firestore knitFactories) + 설계서 편직처 목록 이름 넣기/빼기
│   │       ├── useLabdip.js            # 생산 ▾ LAB-DIP — 저장(L/D NO. 붙이기)·진행 버튼(도착·발송·결과·2차 의뢰·Drop·되돌리기)·복제·삭제 (Firestore labdips)
│   │       ├── useHangerSticker.js     # 헹거 스티커 저장·삭제 (Firestore hangerStickers) + 엑셀 다운로드 (양식 그대로)
│   │       └── useQuotation.js         # 견적
│   │
│   ├── components/
│   │   ├── common/              # 공통 UI (Toast, SearchableSelect, MasterDataModal, ModalBackdrop(팝업 배경), UnsavedChangesDialog(저장할까요?) 등)
│   │   ├── layout/              # Sidebar, LoginScreen
│   │   ├── dashboard/           # 개발 의뢰 — DevRequestFormModal(폭/중량·바이어 특이사항 칸), DevArchiveModal(보관함·Drop 사유별 보기·아이템화 카드 걸린 날), DevCostQuoteModal(원가 견적), DevDropModal(Drop 사유), DevQuoteBadge(견적·예상 배지 공용), DevSampleProgress(샘플 진행 (생산 현황) 표), DevStatsPanel(개발 통계), DevRowParts(두 표 공용 — 바이어 칸·L/D 배지·회신 대기 배지), DevReqSummaryCard(현재 안 씀)
│   │   ├── order/               # 생산 현황 — sheet/(현황표·⋯ 메뉴·입력 창: Process·ProvisionalDue·GreigeOut(선염/후염·kg)·LotEditor(배색량·예상 YD·프리세팅)·ColorPopovers(컨펌·성적서)·Inspection(LOT별 1차·2차)·Ship·Closing(마무리)·StepManager(공정 추가)·Yarn(원사 — 사종 줄·재고 사용·원사염색)), gantt/(간트·GanttAddMenu [+]·GanttDateMenu 날짜 → 그 날에 넣기), common/(SheetLinkChips '설계서' 표시·SampleCloseDialog 샘플 끝내기·OrderKindChip 구분 표시·AddOrderMenu [+ 오더 추가 ▾]·OrderKindDialog 구분 바꾸기·LinkSheetDialog 작성 중인 설계서 연결·SkipBar 컨펌/외관검사 '안 함'(SkippedPopover 창)·SkipChip 회색 '안 함·재고 사용·생지 재고'·PopoverShell(저장할까요?)·StatusSelect 상태 드롭다운·TrackEditor 상태 기록·StepChip(PresettingChip·YarnDyeChip)·QcResultSection 상세창 '메인/QC 결과'), OrderDetailModal
│   │   ├── design/              # DesignStepper (진행 단계 바)
│   │   ├── main-detail/         # 메인/QC — MainDetailFormModal(작성 창·비고·저장 중 잠금), OrderLotPicker(생산 현황에서 고르기 — 오더·컬러·LOT, 폼 값 그대로), QcResultTable(QC 결과 표 — 설계서 칸·생산 현황 상세창 공용)
│   │   ├── design-sheet/        # 설계서 전용 (DesktopSheetRow, MobileSheetCard, DropSheetModal, SheetTemplatePickerModal(설계서 불러오기 — 고르는 창), DesignSheetPrintSheet(편직처용·염색소용 인쇄), SheetSampleOrderPanel(샘플 오더 칸·실측 vs 설계), HistoryFieldLine(변경 이력 옛 값→새 값), TempQuotePanel(가설계서 판매가 6구간·외관검사/시험성적서 제외·가견적서 PDF/엑셀 + TempMarketToggle 시장 구분))
│   │   ├── fabric/              # 원단 행/카드 (+ fabricRowModel: 행·카드 공통 계산)
│   │   ├── yarn/                # 원사 행/카드 (+ yarnRowModel: 행·카드 공통 계산)
│   │   ├── quote/               # PDFRenderer (견적서 PDF), QuoteParts (견적서 화면 공용 부품), FabricPickerModal, RunningGreigeModal (러닝 생지 견적 창)
│   │   ├── cost/                # 원가 표·원가 설정·'원가 확인 필요' 경고 (CostBreakdownTable, CostSettingsModal + costSettingsForm·CostSettingsParts, CostWarnings)
│   │   ├── sticker/             # 헹거 스티커 — StickerEditModal(입력 창: 아이템·CATEGORY·CARE 체크·잠긴 WIDTH/WEIGHT·QR 그림 올리기), StickerPreview(엑셀 칸 크기 그대로 미리보기), StickerSettingsModal(CATEGORY·CARE 목록)
│   │   ├── knitFactory/         # 편직처 기계 현황 — KnitFactoryList(전체 목록 — 편직처·기계 종류별·우리 작업/메모 줄), KnitFactoryDetail(상세·메모·작업 이력), KnitMachineSearch(기계로 찾기 — 보기·고르기 공용), KnitMapView(카카오 지도·방문 순서·키 안내), KnitFactoryEditModal(입력 창 — 기계·보유 가마), KnitTypeSettingsModal(기계 종류·계열), KnitImportModal(정리본 가져오기), KnitMachinePickerModal(설계서 [기계 현황에서 고르기] — body 포털), KnitParts(종류 칩·게이지 칩·침수·확인일·목록 요약·KnitBlocks 기계 현황·지금 가마 바꾸기)
│   │   ├── labdip/              # LAB-DIP — LabdipForm(작성 화면·진행 상황), LabdipColorCard(컬러 칸·[기록]·되돌리기·Drop), LabdipDialogs(L/D 도착·바이어 발송·결과·2차 의뢰 창), LabdipParts(단계 칩·[+ 새 L/D ▾]), LabdipRequestSheet(공장 의뢰서 인쇄), LabdipPrintSheet(바이어 시트 인쇄)
│   │   └── domain/              # (도메인 컴포넌트 - 현재 비어있음)
│   │
│   ├── services/
│   │   ├── firebase.js          # Firebase 초기화 (auth, firestore)
│   │   └── db.js                # Firestore 추상화 (saveDocToCloud, deleteDocFromCloud 등)
│   │
│   ├── utils/
│   │   ├── helpers.js           # num, calculateGYd, todayLocalISO(오늘 날짜), compareArticle·sortByArticle(Article 순서 — PW1001 → PW1002 …) 등 순수 함수
│   │   ├── quoteModel.js        # 견적 계산 (기준 견적 판가 / 별도 견적 / 외관검사·시험성적서 제외 / 예전 견적 정규화 / 출력 전 확인)
│   │   ├── tempQuoteModel.js    # 가설계서 판매가 · 가견적서 (시장 구분·제외·6구간 → 견적서 모양 buildTempQuote — 견적서 계산·PDF·엑셀 그대로)
│   │   ├── excelIO.js           # 엑셀 업로드 칸 읽기 (숫자·%·예/아니오·통화)
│   │   ├── costFields.js        # 원가 칸 초기값 (원단·설계서·가설계서 공통)
│   │   ├── devQuoteModel.js     # 개발 의뢰 원가 견적 (양식·원단 모양 변환·저장 전 확인·예상가·견적서 배지·설계서 이어받기)
│   │   ├── sheetHistory.js      # 설계서 변경 이력 (피더 줄 요약·값 글자·숫자 비교·예전 원가 기본값·원가 목록 요약·원단 관리 수정 → 설계서 이력)
│   │   ├── sheetSpec.js         # 설계서 스펙 규칙 (확인칸 값·저장 때 정리 settleConfirms·최종 스펙 확인 finalSpecError·인쇄 판 번호 sheetRevision)
│   │   ├── devFlowModel.js      # 개발 흐름 (+ QC 실측 qcActualOf·QC 찾기 qcDetailsFor·가설계서 정식 전환 promotedSheetsOfTemp·의뢰 아이템화/되돌리기 devArticledPatch·devReopenDoc·줄 글자 rowOdNo·rowTitle·rowBuyerName) (샘플 진행 줄 생산 상황·납기 / 회신 대기 N일 / 의뢰 결과·의뢰→아이템화 일수 / 개발 통계 / 의뢰 수정 → 설계서·샘플 오더 변경 계획)
│   │   ├── yarnDyeCalc.js       # 선염 계산 (스트라이프 원사 컬러 배분·같은 컬러 합치기 / 멜란지 수량 비율 / O/D·ARTICLE(원사) 불러오기 / 결과 복사)
│   │   ├── knitFactoryModel.js  # 편직처 기계 현황 (문서 모양·종류/계열 설정·종류+인치 묶음·침수 계산·기계로 찾기·설계서에 넣을 값·카카오 링크·정리본 읽기)
│   │   ├── kakaoMap.js          # 카카오맵 SDK 불러오기 · 편직처 주소 → 좌표 (브라우저 전용)
│   │   ├── labdipModel.js       # LAB-DIP 계산 (L/D NO.·컬러 단계·탭·납기·울 종류(SW)·차수·예전 기록 읽기·공장 의뢰서/바이어 시트 인쇄 모양·개발 건 연결(labdipDevOptions·fieldsFromDev·labdipDevLink·labdipsOfDev·labdipDevSummary))
│   │   ├── hangerSticker.js     # 헹거 스티커 칸 계산 (WIDTH 내폭/외폭 · WEIGHT 실제 G/YD — 늘 아이템 값 · CATEGORY·CARE 설정 목록 · QR 번호 → EZ-TEX 주소 · 저장 모양)
│   │   ├── hangerStickerExcel.js # 헹거 스티커 엑셀 만들기 (양식 첫 시트를 스티커마다 복사해 값만 바꿈 — fflate, Node에서도 돌아감)
│   │   ├── hangerStickerQr.js   # 헹거 스티커 QR (만들기: 미리보기 SVG·엑셀 PNG / 읽기: 올린 QR 그림 → 주소)
│   │   └── costModel.js         # 원단 원가 엔진 (수량 함수 computeCostAtQty / 원가 표 6구간 calculateCostTiers)
│   │
│   ├── constants/
│   │   ├── common.js            # DESIGN_STAGES, STAGE_COLORS 등 상수
│   │   ├── costing.js           # 원가 설정 기본값 (편직 정액·LOSS 구간·가공 유형·이화학·운임)
│   │   └── quote.js             # 견적 구간(300~5,000YD)·기본 이익율/정액·기본 표시 구간
│   │
│   ├── assets/                  # 정적 자산 (hanger-sticker-template.xlsx = 헹거 스티커 양식 — 대표님 TAG.xlsx 첫 시트)
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
- 설계서 단계: `draft → eztex → sampling → articled` (→ 원단 자동 등록 + 의뢰 `status: 'articled'` '아이템화 완료', 원단 `devSource`)
- `hangerStickers` (헹거 스티커) → `fabrics` (원단): `sticker.fabricId` 한쪽만 (원단을 지워도 스티커 값은 남음 — 목록에 '아이템 없음')
- `knitFactories` (편직처 기계 현황) ↔ 설계서 `knitting.factory` · 오더 `steps.knitting.vendor`: **이름으로만** 이어짐 (띄어쓰기·대소문자 무시). 저장하면 이름이 `settings/general.knittingFactories`에도 들어감
- `labdips` (LAB-DIP) → `devRequests`·`designSheets`: `labdip.devRequestId`·`designSheetId` 한쪽만 (원단 연결 `fabricId`와 둘 중 하나 — 2026-11-24)
- `labdips` (LAB-DIP) → `fabrics` (원단): `labdip.fabricId` 한쪽만 — ARTICLE·ITEM NAME·GSM·폭은 고를 때 복사 (의뢰서에 적은 값이 남게). 공장 = `settings/general.dyeingFactories`

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
