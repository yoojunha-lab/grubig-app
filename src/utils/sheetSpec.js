// ============================================================
// 설계서 스펙 규칙 — 화면 · 훅 공용 (리팩토링 · 디버깅 2026-11-24)
//  · 담당자 확인칸: 확인할 때의 값(fieldConfirmValue) — 값이 바뀌면 확인이 풀림
//  · 최종 스펙(GSM · 내폭 · 외폭) 확인 — 예전엔 단계 이동 · 저장 · 원단 등록이 네 군데서 조금씩 다른 규칙으로 검사했음
//  · 인쇄 '제 N판' — 종이에 찍히는 칸이 바뀐 이력만 셈
// ============================================================

const readPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// 칸 하나에 값이 둘인 확인칸: 개폭(개폭선 · 오픈개폭) · 포속/오버피더 · 원사 비율(원사 + 비율)
const CONFIRM_COMBO = {
  'knitting.openWidth': ['knitting.hasOpenWidth', 'knitting.isOpenWidth'],
  'dyeing.fabricSpeed': ['dyeing.fabricSpeed', 'dyeing.overFeeder'],
};

/**
 * 확인칸의 '지금 값' 글자 — 확인할 때 이 글자를 적어 두고(fieldConfirmValue) 다르면 확인이 풀린 것
 *  참/거짓 · 빈 값 · 0 은 '' 로 맞춤 (불러올 때 빈 칸이 false · 0 으로 채워져도 풀리지 않게)
 */
export const confirmSnapshot = (input, key) => {
  const yarn = /^yarns\.(\d+)\.ratio$/.exec(key);
  const paths = yarn ? [`yarns.${yarn[1]}.yarnId`, key] : (CONFIRM_COMBO[key] || [key]);
  return paths.map(p => {
    const v = readPath(input, p);
    if (v === true) return 'true';
    if (v === false || v == null || v === 0 || v === '0') return '';
    return String(v).trim();
  }).join('|');
};

/**
 * 저장할 때 확인칸 정리 — 확인한 뒤 값이 바뀐 칸은 확인을 풂 (디버깅 2026-11-24)
 *  예전엔 화면이 열릴 때 효과(effect)로 풀어서, 다른 곳(원단 관리 · 편직처 이름 바꾸기)이 바꾼 설계서를 열기만 해도
 *  '저장 안 한 변경'이 생겼음 → 이제 화면은 보여 주기만, 실제로 푸는 건 저장할 때
 *  input: 저장할 설계서 · existing: 저장돼 있던 설계서 (확인 값이 안 적힌 예전 확인은 저장돼 있던 값 기준)
 *  반환: { fieldConfirm, fieldConfirmValue } (바뀐 게 없으면 null)
 */
export const settleConfirms = (input, existing) => {
  const confirm = { ...(input?.fieldConfirm || {}) };
  const values = { ...(input?.fieldConfirmValue || {}) };
  let changed = false;
  Object.keys(confirm).forEach(k => {
    if (!confirm[k]) return;
    const base = values[k] !== undefined ? values[k] : (existing ? confirmSnapshot(existing, k) : undefined);
    if (base === undefined) { values[k] = confirmSnapshot(input, k); changed = true; return; }
    if (base !== confirmSnapshot(input, k)) {
      confirm[k] = false;
      delete values[k];
      changed = true;
    } else if (values[k] === undefined) {
      values[k] = base; // 예전 확인 — 이번에 값을 적어 둠
      changed = true;
    }
  });
  return changed ? { fieldConfirm: confirm, fieldConfirmValue: values } : null;
};

/**
 * 최종 스펙(GSM · 내폭 · 외폭) 확인 — 문제가 있으면 알림 글자, 없으면 ''
 *  · 셋 다 0보다 커야 함 · 내폭 ≤ 외폭
 *  what: 알림 앞말 (예: '아이템화 전에', '원단 등록 전에')
 */
export const finalSpecError = (ci, what = '아이템화 전에') => {
  const gsm = Number(ci?.gsm);
  const cut = Number(ci?.widthCut);
  const full = Number(ci?.widthFull);
  if (!(gsm > 0) || !(cut > 0) || !(full > 0)) return `${what} 최종 스펙(GSM, 내폭, 외폭)을 모두 입력해 주세요.`;
  if (cut > full) return `내폭(${ci.widthCut}")은 외폭(${ci.widthFull}")보다 클 수 없어요. 폭을 다시 확인해 주세요.`;
  return '';
};

/** 내폭 > 외폭인지 (둘 다 적혀 있을 때만 — 저장 중인 초안은 빈 칸 허용) */
export const widthOrderError = (ci) => {
  const cut = Number(ci?.widthCut);
  const full = Number(ci?.widthFull);
  return cut > 0 && full > 0 && cut > full
    ? `내폭(${ci.widthCut}")은 외폭(${ci.widthFull}")보다 클 수 없어요. 폭을 다시 확인해 주세요.`
    : '';
};

// 인쇄 종이에 찍히는 칸 (원가 칸은 안 찍힘)
const PRINTED_KEY = /^(fabricName|articleNo|eztexOrderNo|devOrderNo|deadline|yarns\.|knitting\.|dyeing\.|finishing\.|costInput\.(widthCut|widthFull|gsm)$)/;

/**
 * 설계서 인쇄 '제 N판' — 종이에 찍히는 칸이 바뀐 이력 수 + 1 (디버깅 2026-11-24)
 *  예전엔 이력 전부를 세서 원가만 고치거나 복원 · 이름 바꾸기만 해도 판이 올라가 '최신 판으로 작업' 안내가 헷갈렸음
 */
export const sheetRevision = (sheet) => 1 + (sheet?.changeHistory || [])
  .filter(e => Object.keys(e?.fields || {}).some(k => PRINTED_KEY.test(k))).length;
