// ============================================================
// 설계서 변경 이력 — 공용 계산 (개발 고도화 3단계, 대표님 요청 2026-11-24 '변경 이력 빈틈 메우기')
//  이력 한 건: { date, fields: { 칸: 바뀌기 전 값 }, to: { 칸: 바뀐 뒤 값 }, by: 누가, reason }
//   · to · by 는 2026-11-24부터 (예전 이력은 '옛 값 ▶ 변경됨')
//  · 조직도 피더 줄 요약 / 원단 관리에서 고친 값을 설계서 이력으로 / 화면에 보일 값 글자
// ============================================================

const str = (v) => String(v ?? '').trim();

/** 조직도 피더 줄 → 짧은 글자 ('F1 Y1 ︹︺ L2.8 / F2 …', 비었으면 '(없음)') */
export const feederSummary = (feeders) => {
  const list = (Array.isArray(feeders) ? feeders : [])
    .map((f, i) => {
      const parts = [
        f?.yarnSlot ? `Y${f.yarnSlot}` : '',
        str(f?.symbol),
        str(f?.loopLength) ? `L${str(f.loopLength)}` : '',
      ].filter(Boolean);
      return parts.length ? `F${i + 1} ${parts.join(' ')}` : '';
    })
    .filter(Boolean);
  return list.length ? list.join(' / ') : '(없음)';
};

// 참/거짓 칸 (개폭선 · 오픈개폭)
const BOOL_KEYS = new Set(['knitting.hasOpenWidth', 'knitting.isOpenWidth']);

/** 이력에 보일 값 글자 — 빈 값 '(비어있음)', 참/거짓 칸 '있음/없음' */
export const historyValueText = (key, value) => {
  if (BOOL_KEYS.has(key)) return value === true || value === 'true' ? '있음' : '없음';
  const s = str(value);
  return s || '(비어있음)';
};

/**
 * 원단 관리에서 원단을 고쳐 저장 → 연결된 설계서에 넘어가는 값의 이력 (예전엔 설계서 이력에 안 남았음)
 *  before: 설계서(바뀌기 전) · after: 원단에서 넘어온 값을 얹은 설계서 · yarnName: (yarnId) => 이름
 *  반환: 이력 한 건 (바뀐 칸이 없으면 null)
 */
export const fabricSyncHistoryEntry = ({ before, after, yarnName = () => '', by = '', now = new Date().toISOString() }) => {
  if (!before || !after) return null;
  const fields = {};
  const to = {};
  const put = (key, oldVal, newVal) => {
    if (str(oldVal) === str(newVal)) return;
    fields[key] = str(oldVal);
    to[key] = str(newVal);
  };
  put('articleNo', before.articleNo, after.articleNo);
  put('fabricName', before.fabricName, after.fabricName);
  ['widthFull', 'widthCut', 'gsm', 'costGYd', 'dyeingFee', 'knitGrade', 'knitKgRate', 'processType', 'marginTier', 'riskMarginPct']
    .forEach(k => put(`costInput.${k}`, before.costInput?.[k], after.costInput?.[k]));
  const n = Math.max((before.yarns || []).length, (after.yarns || []).length);
  for (let i = 0; i < n; i += 1) {
    const a = (before.yarns || [])[i] || {};
    const b = (after.yarns || [])[i] || {};
    put(`yarns.${i}.ratio`, a.ratio ?? '', b.ratio ?? '');
    if (str(a.yarnId).split('::')[0] !== str(b.yarnId).split('::')[0]) {
      fields[`yarns.${i}.yarnId`] = yarnName(a.yarnId);
      to[`yarns.${i}.yarnId`] = yarnName(b.yarnId);
    }
  }
  if (!Object.keys(fields).length) return null;
  return { date: now, fields, to, by, reason: '원단 관리에서 수정' };
};
