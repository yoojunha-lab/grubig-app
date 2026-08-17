# 개발 전용 로그인 / 화면 검증 방법 (DEV LOGIN)

> 로컬 개발 서버(`npm run dev`)에서 **실제 계정·운영 데이터 없이** 로그인 상태로 앱을 열어
> 화면을 검증하기 위한 방법을 정리한 문서입니다.

---

## ✅ 권장: DEV 우회 모드 (계정 불필요, 운영 데이터 안 건드림)

실제 Firebase 계정이나 비밀번호가 전혀 필요 없습니다.
개발 빌드에서 아래 플래그만 켜면 **가짜 유저로 자동 로그인 + 격리된 인메모리 샘플 데이터**가 주입됩니다.
저장·삭제 등 모든 동작은 **로컬 메모리에서만** 일어나고, **실제 Firestore(운영 데이터)는 절대 건드리지 않습니다.**

### 켜는 법
브라우저 개발자도구 콘솔(F12)에서:

```js
localStorage.setItem('grubig_dev_bypass', '1');
location.reload();
```

- 새로고침하면 `DEV 검증용` 유저(`dev@grubig.kr`)로 바로 로그인된 상태가 됩니다.
- 샘플 개발의뢰·설계서·원단·원사 데이터가 함께 채워져서 모든 화면을 바로 검증할 수 있습니다.

### 끄는 법 (원래 로그인 화면으로 복귀)
```js
localStorage.removeItem('grubig_dev_bypass');
location.reload();
```

### 안전장치
- **개발 빌드에서만 동작** — `import.meta.env.DEV`가 `true`일 때만 활성화됩니다.
  운영 빌드(`vite build`)에서는 이 분기 자체가 죽은 코드로 제거되어 절대 켜지지 않습니다.
- 실제 Firebase 인증 구독과 Firestore 저장/삭제를 모두 건너뛰고 로컬 state로만 처리합니다.

### 관련 코드 (참고)
- `src/apps/App.jsx` — `DEV_BYPASS` 상수, 인메모리 데이터 주입, `saveDocToCloud`/`deleteDocFromCloud`의 `DEV_BYPASS` 분기
- `src/constants/devSamples.js` — 주입되는 샘플 데이터(`DEV_SAMPLE_DEV_REQUESTS` 등)

---

## (참고) 개발 전용 이메일/비밀번호 로그인

로그인 화면 하단의 "⚠️ 개발 전용 로그인 (DEV ONLY)" 폼은
**실제 Firebase에 등록된 `@grubig.kr` 계정**으로 로그인하는 기능입니다.
(구글 팝업 대신 이메일/비번으로 로그인 — 이 경우는 **실제 운영 데이터에 접속**됩니다.)

- 이 폼도 `import.meta.env.DEV`일 때만 표시됩니다. (`src/components/layout/LoginScreen.jsx`)
- 화면만 검증할 때는 위의 **DEV 우회 모드**를 쓰는 것을 권장합니다 (운영 데이터 안전).

---

_최종 업데이트: 2026-07-09_
