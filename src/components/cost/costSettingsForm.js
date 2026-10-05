import { num } from '../../utils/helpers';

// ============================================================
// 원가 설정 창 — 편집 상태 정리·검사 (순수 함수, CostSettingsModal.jsx에서 옮김 2026-10-06)
// ============================================================

// 구간 경계값/금액 등 숫자 변환 (마지막 '초과' 구간은 max = null 유지)
export const toMax = (v) => (v === null ? null : Number(v));

// 편집 상태 → 저장할 설정 객체
export const buildNext = (l) => ({
  knitGrades: l.knitGrades.map(g => ({ id: g.id, name: String(g.name || '').trim(), fixedFee: Number(g.fixedFee) || 0, desc: String(g.desc || '').trim() })),
  knitLossBrackets: l.knitLossBrackets.map(b => ({ max: toMax(b.max), pct: Number(b.pct) || 0 })),
  processTypes: l.processTypes.map(t => ({ id: t.id, name: String(t.name || '').trim(), lossPct: Number(t.lossPct) || 0 })),
  chemTest: {
    feePerColor: Number(l.chemTest.feePerColor) || 0,
    colorBrackets: l.chemTest.colorBrackets.map(b => ({ max: toMax(b.max), colors: Number(b.colors) || 0 })),
  },
  freightBrackets: l.freightBrackets.map(b => ({ max: toMax(b.max), amount: Number(b.amount) || 0 })),
  visualInspectionPerYd: Number(l.visualInspectionPerYd) || 0,
  dyeMinKgPerColor: Number(l.dyeMinKgPerColor) || 0,
  importCountries: l.importCountries.map(c => ({
    id: c.id,
    name: String(c.name || '').trim(),
    brackets: c.brackets.map(b => ({ max: toMax(b.max), perKg: Number(b.perKg) || 0 })),
  })),
});

export const isBlank = (v) => v === '' || v === null || v === undefined;

// 구간 표 검사: 경계값은 0보다 크고 위→아래로 커져야 함, 값은 0 이상(상한 있으면 이하)
export const checkBrackets = (rows, valueKey, label, { maxValue = Infinity, integer = false } = {}) => {
  const bounded = rows.slice(0, -1);
  for (let i = 0; i < bounded.length; i++) {
    const m = Number(bounded[i].max);
    if (isBlank(bounded[i].max) || !(m > 0)) return `${label}: ${i + 1}번째 구간의 경계값을 0보다 크게 입력해 주세요.`;
    if (i > 0 && !(m > Number(bounded[i - 1].max))) return `${label}: 경계값은 아래 줄로 갈수록 커져야 해요. (${num(bounded[i - 1].max)} 다음에 ${num(m)})`;
  }
  for (const r of rows) {
    const v = Number(r[valueKey]);
    if (isBlank(r[valueKey]) || !Number.isFinite(v) || v < 0 || v > maxValue) {
      return `${label}: 값은 0${maxValue !== Infinity ? `~${maxValue}` : ' 이상'}으로 입력해 주세요.`;
    }
    if (integer && !Number.isInteger(v)) return `${label}: 정수로 입력해 주세요.`;
  }
  return null;
};

// 이름 목록 검사: 빈 이름·중복 이름 금지
export const checkNames = (list, label) => {
  const names = list.map(x => String(x.name || '').trim());
  if (names.some(n => !n)) return `${label}: 이름이 비어 있는 줄이 있어요.`;
  const dup = names.find((n, i) => names.findIndex(m => m.toUpperCase() === n.toUpperCase()) !== i);
  if (dup) return `${label}: '${dup}' 이름이 두 번 있어요.`;
  return null;
};

// 다음 등급 이름 제안 (A, B 다음 → C …)
export const nextGradeName = (grades) => {
  const used = new Set(grades.map(g => String(g.name || '').trim().toUpperCase()));
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    if (!used.has(letter)) return letter;
  }
  return '';
};
