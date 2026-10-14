# 헹거 스티커 (기타 ▾ 헹거 스티커) — 기획 · 구현

> 대표님 요청 2026-10-14. 대표님이 보낸 **TAG.xlsx** 양식 그대로 헹거 스티커를 엑셀로 뽑는 화면.
> 관련 용어는 `docs/terminology.md` §2-J.

---

## 1. 요청 내용 (대표님)

### 1차 (2026-10-14)
- 상단 메뉴에 **'기타'** 카테고리, 세부 메뉴 **'헹거 스티커'**
- 칸: ART · PERFORMANCE WOOL 자리(제목) · CONTENT · TYPE · WIDTH · WEIGHT · CARE · QR · 맨 아래 칸(아래 설명)
- **ART · WIDTH · WEIGHT** 는 아이템(원단 관리) 정보에서 불러오기
- **QR · CONTENT · 제목 · 아래 설명** 은 직접 넣고 저장. TYPE은 직접 입력
- 보낸 엑셀 양식 **그대로** 값만 바꿔서 다운로드. 여러 장은 **체크박스**로 골라 한 번에
- 기존 16장 불러오기 기능은 **안 넣음** (대표님 선택)

### 2차 (2026-10-14)
- **WIDTH · WEIGHT 는 아이템에서 자동으로, 고칠 수 없게** — g/yd는 **반올림·내림 없이** (1차의 5 단위 내림 없앰)
  - g/yd = 원단 관리의 **'실제 G/YD'**(gsm × 외폭) — 생산 G/YD(원가용 직접 입력)는 안 씀 (대표님 선택)
- **CARE 는 체크해서 넣기**: MACHINE WASHABLE · DRY CLEAN · HAND WASH · TUMBLE DRY (TUMBLE DRY는 그대로 — 대표님 선택)
- **CATEGORY(예전 '제목')** 는 고르기: PERFORMANCE WOOL · WOOL CASUAL
- CATEGORY · CARE 목록은 **[⚙ 설정]에서 추가·삭제** (CARE도 설정에서 — 대표님 선택)

## 2. 양식 (TAG.xlsx) 분석

- 시트 1장 = 스티커 1장 (시트 이름 = ART). 16장 들어 있었음.
- **첫 시트(PW1001 — 안에는 PW1042 값)** 를 양식으로 씀 — 마지막 칸 이름이 **CARE** 인 유일한 시트 (나머지는 WASH).
- 값 칸 (합친 칸은 왼쪽 위 칸) — 코드 `utils/hangerStickerExcel.js` `STICKER_CELLS`

| 칸 | 셀 (합친 범위) | 글자 |
|---|---|---|
| ART. 값 | E3 (E3:E4) | 12pt 굵게 · 셀에 맞춤 |
| CATEGORY (예전 제목 · PERFORMANCE WOOL 자리) | D6 (D6:F7) | 18pt 굵게 |
| CONTENT | E8 (E8:F9) | 10pt · 자동 줄 바꿈 |
| TYPE · WIDTH · WEIGHT | E10 · E11 · E12 (E:F) | 10pt · 셀에 맞춤 |
| CARE | E13 (E13:F13) | 10pt · 자동 줄 바꿈 · **2줄 높이** |
| 아래 설명 | D14 (D14:F18) | 7.5pt · 자동 줄 바꿈 |
| QR | F2:F5 위 그림 | 회색 QR 자리(62.4pt) + QR 그림(60pt) |

- 인쇄: 인쇄 영역 `$D$2:$F$18`, 가로, 1페이지에 맞춤, 가운데, 여백 0, 프린터 설정(용지) 파일 포함 → 모두 그대로 복사.
- 칸 너비(엑셀에서 잰 값): C 20.25 · D 54 · E 63.75 · F 72.75 · G 11.25 pt. 줄 높이는 양식 그대로(17.1 → 엑셀 17).
- **'PERFORMANCE WOOL'(18pt 굵게)은 엑셀에서 약 223.5pt** 라 D~F(190.5pt)보다 넓음 → 엑셀이 양옆 빈 칸(C·G열)까지 넘쳐서 찍음 (엑셀 PDF로 확인). 이보다 긴 CATEGORY는 양 끝이 잘림.

### QR

- 기존 QR 16개를 읽어 보니 모두 **`https://eztexerp.com/erp/qr/번호`** (EZ-TEX 상품 페이지 — 담당자·CONTENT·FABRICATION·REMARK가 나옴).
- 번호(예: PW1042 → 5542, PW1006 → 4460)는 **EZ-TEX 안에서 정한 번호** — ART와 규칙이 없고, `…/qr/PW1042`처럼 ART를 넣으면 EZ-TEX 로그인 화면으로 감 (2026-10-14 확인).
  → ART로 QR을 자동으로 만들 수 없음. 대표님 결정: **QR 그림 파일을 올림**.
- 구현: 올린 QR 그림에서 **주소를 읽어서(jsQR) 글자로 저장**하고, 엑셀을 만들 때 QR을 새로 그려 넣음 (또렷하고 저장 용량이 작음). 번호만 넣어도 주소로 바꿈 (`5542` → `https://eztexerp.com/erp/qr/5542`).
- 그림은 [QR 그림 올리기] · 끌어 놓기 · QR 칸에 붙여 넣기(Ctrl+V) 모두 됨.

## 3. 칸 — `utils/hangerSticker.js`

- **아이템 필수** — WIDTH·WEIGHT를 아이템에서만 가져오기 때문 (아이템 없이 [저장]하면 '아이템을 골라 주세요').
- **ART** = 원단 `article` (대문자) — 고칠 수 있음. 아이템 Article과 다르면 입력 창에 '아이템 Article은 … [아이템 Article로]'.
- **WIDTH** = `내폭/외폭` 소수 한 자리 (`widthCut`/`widthFull` → `52.0/54.0`). 하나만 있으면 그 값만. **고칠 수 없음**.
- **WEIGHT** = `gsm g/㎡ g/yd g/yd` — g/yd = **원단 관리 '실제 G/YD'** (`calculateGYd` = gsm × 외폭, 정수) **그대로** (2차: 5 단위 내림 없앰 → 238이면 238). 외폭이 없으면 g/㎡만. **고칠 수 없음**.
- **WIDTH·WEIGHT는 늘 지금 아이템 값** (`stickerSpecOf`) — 목록·미리보기·엑셀 모두. 원단 관리에서 폭·gsm을 고치면 스티커도 따라 바뀜 (그래서 1차의 '아이템과 다름' 표시는 없앰).
  저장할 때 그때 값도 같이 저장 → 아이템이 나중에 지워지면 그 마지막 값을 씀 (목록 '아이템 없음').
- **CATEGORY** (데이터 칸 이름은 `title` 그대로) — 설정 목록에서 고르기. 새 스티커는 목록 첫 번째. 설정에서 지운 값을 쓰던 스티커는 '(설정에 없음)'으로 그대로 보임.
- **CARE** — 설정 목록에서 체크(여러 개). 새 스티커는 **MACHINE WASHABLE** 체크. 저장할 때 **설정 목록 순서로** 정리.
  엑셀 CARE 칸에 **한 줄에 하나씩** — 칸이 2줄이라 **3개 이상이면 잘림** (입력 창·미리보기·다운로드 때 알려 줌, 엑셀 PDF로 확인).
  예전 글자 `WASHING MACHINE`(1차 기본값)은 MACHINE WASHABLE로 읽음.
- CONTENT 칸 아래에 아이템 원사 혼용률을 참고로 보여 줌 (자동으로 넣지는 않음).

## 4. 저장

### 스티커 — Firestore `hangerStickers` (`hooks/domains/useHangerSticker.js`)

```
{ id: 'hs_…', fabricId, art, title(=CATEGORY), content, type,
  width, weight,          // 저장할 때의 아이템 값 (아이템이 지워졌을 때만 씀)
  care: ['MACHINE WASHABLE', …],   // 1차는 글자 한 칸 — 읽을 때 배열로 바꿈
  qr, note, createdAt, createdBy, updatedAt, updatedBy }
```

- 회사 공통 (다른 직원도 같이 봄). 보안 규칙은 콘솔 관리 — 새 컬렉션도 규칙 수정 없이 저장됨 (yarnDyeCalcs와 같음).
- 저장 전: 앞뒤 띄어쓰기 정리 (아래 설명만 줄 바꿈 허용), ART 대문자, QR 번호 → 주소. **아이템 · ART 필수**.
- 같은 ART 스티커가 또 생기면 한 번 물어봄 (고쳐 저장할 때 ART가 그대로면 안 물음). 같은 아이템 스티커가 있으면 입력 창에 '열기' 링크.
- 저장은 기존 문서를 먼저 깔고 입력 값을 얹음 (저장 규약). 삭제는 되돌릴 수 없음 확인 후.

### 설정 — `settings/general.hangerStickerOptions` (`App.saveHangerStickerOptions`)

```
{ categories: ['PERFORMANCE WOOL', 'WOOL CASUAL', …], careItems: ['MACHINE WASHABLE', 'DRY CLEAN', 'HAND WASH', 'TUMBLE DRY', …] }
```

- 아직 저장 전이면 기본 목록 (`resolveStickerOptions`). [⚙ 설정] 창에서 [추가]·🗑 를 누르면 바로 저장 (대문자).
- 한 목록만 바꿔 저장해도 최신 설정에 얹음 (두 목록을 이어서 추가해도 앞의 것이 안 덮임). 실패하면 화면도 되돌림.
- 마지막 하나는 못 지움. 쓰고 있는 항목을 지울 때 '이미 만든 스티커 n장의 값은 그대로' 안내.

## 5. 엑셀 만들기 — `utils/hangerStickerExcel.js` (+ QR: `utils/hangerStickerQr.js`)

- SheetJS 무료판은 글꼴·칸 크기·그림을 못 살려서, **엑셀 파일(zip) 안의 XML을 직접 고침** (fflate).
- 양식 파일 `src/assets/hanger-sticker-template.xlsx` = 대표님 TAG.xlsx 첫 시트만 남긴 것 (예시 값 PW1042).
  스티커마다 첫 시트를 복사해서 8칸 값만 바꿈 → 글꼴·칸 크기·합친 칸·인쇄 설정·QR 자리 그대로.
- 칸 글자는 `stickerCellValues` (WIDTH·WEIGHT = 받는 순간의 아이템 값, CARE = 줄바꿈으로 이음) — 미리보기도 같은 함수.
- 고른 스티커를 **ART 순서**로, 1장 = 시트 1장 (시트 이름 = ART, 같으면 `PW1006 (2)`). 첫 시트만 선택된 상태로 엶 (여러 시트가 같이 선택되면 '그룹'이 되어 한 칸을 고치면 다 바뀜).
- QR 그림: 칸 하나 8px · 둘레 2칸 흰 여백 PNG. **QR이 빈 스티커는 회색 QR 자리와 그림을 빼서 비움**.
- 받기 전 한 번에 확인: **QR 없음 · WIDTH/WEIGHT 빈 칸(아이템에 폭·gsm 없음) · CARE 3개 이상** → '그래도 엑셀로 받을까요?'
- 파일 이름: 1장 `헹거스티커_PW1050.xlsx` / 여러 장 `헹거스티커_3장_2026-10-14.xlsx`.
- 여러 장 인쇄: 엑셀 인쇄(Ctrl+P) → 설정 → **'전체 통합 문서 인쇄'** (화면 아래 안내).
- 양식을 바꾸려면: 양식 파일의 **첫 시트**를 고침. 값 칸 위치가 바뀌면 `STICKER_CELLS`도 고칠 것. 양식 그림은 QR 하나(회색 자리 + 그림)만 있어야 함 — 다른 그림·연결이 생기면 엑셀 만들기가 오류로 알려 줌.

## 6. 화면 — `pages/HangerStickerPage.jsx`, `components/sticker/`

- 목록: 체크박스 · ART(+ '아이템 없음') · CATEGORY · CONTENT · TYPE · WIDTH · WEIGHT(지금 아이템 값) · CARE(· 로 이음) · QR(번호/QR 없음) · 아래 설명 · 수정. 검색(ART·CATEGORY·CONTENT·TYPE·CARE·QR 번호…). 휴대폰은 카드.
- 머리줄 버튼: **[⚙ 설정]**(CATEGORY · CARE 목록 — `StickerSettingsModal`) · [+ 스티커 만들기] · [엑셀 다운로드 (n장)].
- 입력 창 (`StickerEditModal`): 왼쪽 입력 · 오른쪽 **미리보기** (`StickerPreview`).
  - 아이템(필수) → ART(고칠 수 있음) / CATEGORY(고르기 · [목록 고치기]) / CONTENT / TYPE / WIDTH·WEIGHT(🔒 잠긴 칸 + 안내) / CARE(체크 칩 · [목록 고치기]) / QR / 아래 설명
  - [목록 고치기]는 설정 창을 입력 창 위에 띄움 (입력하던 내용은 그대로, 닫으면 새 항목이 바로 보임)
  - 버튼: [삭제] · [닫기] · [저장하고 엑셀 받기](고친 게 없으면 [엑셀 받기]) · [저장]
  - 저장 안 한 변경이 있으면 닫기 전에 '저장할까요?' (팝업 규약, 새 스티커는 빈 양식 기준)
- 미리보기: 엑셀 칸 크기·글자 크기를 그대로 줄여 그림. 엑셀은 브라우저보다 글자를 조금 넓게 그려서(10pt에서 글자당 약 0.27pt) 값 칸에 글자 간격을 조금 줌.
  글이 칸보다 길면 빨간 점선 (CATEGORY는 'PERFORMANCE WOOL'보다 길 때, CARE는 3줄 이상). 근사치라 '잘릴 수 있어요'로 안내.

## 7. 확인한 것 (2026-10-14)

- 1차: Node에서 양식 → 3장(QR 있음·없음·같은 ART·특수 글자·줄 바꿈) 엑셀 → **실제 엑셀(숨김 창)로 열어** 값·그림 수·인쇄 영역·용지 확인 + PDF로 모양 확인 (복구 창 없음).
  브라우저(DEV 우회, 5199)에서 아이템 고르기, EZ-TEX QR 그림 → 4749번 주소, 저장·고치기·'저장할까요?'·같은 아이템/ART 알림·2장 다운로드(만든 파일을 풀어 QR 다시 읽기)·한 장 받기·삭제, 휴대폰 폭.
- 2차: 엑셀 PDF로 WOOL CASUAL · 238 g/yd(내림 없음) · CARE 2줄은 들어가고 3줄은 세 번째가 잘림 · 예전 WASHING MACHINE → MACHINE WASHABLE · 지워진 아이템은 마지막 저장 값.
  브라우저에서 아이템 없이 저장 막힘, 잠긴 WIDTH·WEIGHT, CARE 3개 경고(입력 창·미리보기), 입력 창 위 설정 창에서 CATEGORY·CARE 추가(이어서 둘 다)·같은 항목 막기·마지막 항목 못 지움·쓰던 항목 지우면 '(설정에 없음)', 다운로드 확인 창·셀 값, **원단 관리에서 gsm 280→300으로 고치면 스티커 WEIGHT가 300 g/㎡ 418 g/yd로 따라 바뀜**, 휴대폰 폭.

- 검토 (배포 전): ART에 `$` 글자가 있어도 엑셀이 깨지지 않게(시트 이름 바꿀 때 replace 특수 기호 문제) — 실제 엑셀로 확인 ·
  배포 뒤 새로고침 안 한 예전 화면이면 양식·QR 읽기 파일 대신 '새로고침(F5) 후 다시' 안내 (양식은 'PK'로 시작하는 엑셀일 때만 담아 둠) ·
  QR 그림을 읽는 중에는 저장 막기 · [저장하고 엑셀 받기]에서 받기를 취소하면 창을 닫지 않고 저장된 스티커로 다시 열기 ·
  회사 설정을 받기 전에는 CATEGORY·CARE 목록 저장 막기 · 입력 창 '마지막 저장' 날짜를 이 PC 날짜로.

## 8. 남은 생각 (대표님이 원하시면)

- 설정 목록 순서 바꾸기 (지금은 추가한 순서 — CATEGORY 첫 번째가 기본값, CARE는 이 순서로 찍힘).
- 같은 아이템의 스티커를 여러 장(바이어별 등) 쓰는 경우가 많아지면 목록에 묶어 보기.
- 아이템 등록·수정 화면에서 바로 스티커 만들기 버튼.
