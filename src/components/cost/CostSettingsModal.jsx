import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { num } from '../../utils/helpers';
import { resolveCostSettings, getChemColors, getFreightAmount } from '../../utils/costModel';
import { COST_DISPLAY_TIERS, DEFAULT_KNIT_GRADE_ID, DEFAULT_PROCESS_TYPE_ID } from '../../constants/costing';

// ============================================================
// 원가 설정 모달 — 전 품목 공통 원가 기준값 편집
//  · 편직 정액(난이도별) / 편직 LOSS(생지 kg 구간) / 가공 LOSS(가공 유형) / 이화학 / 운임 / 외관검사
//  · 저장값은 settings/general.costSettings (App.jsx의 saveCostSettings) → 저장 즉시 모든 품목 원가 재계산
//  · 저장된 견적서는 단가(basePrice)를 따로 보관하므로 바뀌지 않음
//  · 숫자 칸은 입력 중 빈칸을 허용하려고 입력값 그대로 들고 있다가 저장할 때 숫자로 바꿈
//  · 부모(App)에서 열릴 때만 마운트 → useState 초기화로 편집 상태 시드
// ============================================================

// 구간 경계값/금액 등 숫자 변환 (마지막 '초과' 구간은 max = null 유지)
const toMax = (v) => (v === null ? null : Number(v));

// 편집 상태 → 저장할 설정 객체
const buildNext = (l) => ({
  knitGrades: l.knitGrades.map(g => ({ id: g.id, name: String(g.name || '').trim(), fixedFee: Number(g.fixedFee) || 0, desc: String(g.desc || '').trim() })),
  knitLossBrackets: l.knitLossBrackets.map(b => ({ max: toMax(b.max), pct: Number(b.pct) || 0 })),
  processTypes: l.processTypes.map(t => ({ id: t.id, name: String(t.name || '').trim(), lossPct: Number(t.lossPct) || 0 })),
  chemTest: {
    feePerColor: Number(l.chemTest.feePerColor) || 0,
    colorBrackets: l.chemTest.colorBrackets.map(b => ({ max: toMax(b.max), colors: Number(b.colors) || 0 })),
  },
  freightBrackets: l.freightBrackets.map(b => ({ max: toMax(b.max), amount: Number(b.amount) || 0 })),
  visualInspectionPerYd: Number(l.visualInspectionPerYd) || 0,
});

const isBlank = (v) => v === '' || v === null || v === undefined;

// 구간 표 검사: 경계값은 0보다 크고 위→아래로 커져야 함, 값은 0 이상(상한 있으면 이하)
const checkBrackets = (rows, valueKey, label, { maxValue = Infinity, integer = false } = {}) => {
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
const checkNames = (list, label) => {
  const names = list.map(x => String(x.name || '').trim());
  if (names.some(n => !n)) return `${label}: 이름이 비어 있는 줄이 있어요.`;
  const dup = names.find((n, i) => names.findIndex(m => m.toUpperCase() === n.toUpperCase()) !== i);
  if (dup) return `${label}: '${dup}' 이름이 두 번 있어요.`;
  return null;
};

// 다음 등급 이름 제안 (A, B 다음 → C …)
const nextGradeName = (grades) => {
  const used = new Set(grades.map(g => String(g.name || '').trim().toUpperCase()));
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    if (!used.has(letter)) return letter;
  }
  return '';
};

const inCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right outline-none focus:ring-2 ring-blue-200';
const txtCls = 'w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-blue-200';

// 섹션 카드
const Section = ({ no, title, hint, children }) => (
  <section className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
      <h4 className="text-sm font-extrabold text-slate-800"><span className="text-blue-600 mr-1">{no}.</span>{title}</h4>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </section>
);

// 구간 편집 표 — 마지막 줄은 항상 '직전 경계 초과' (경계값 없음)
const BracketEditor = ({ rows, valueKey, unit, valueUnit, onChange, money = false }) => {
  const bounded = rows.slice(0, -1);
  const open = rows[rows.length - 1];
  const lastMax = bounded.length ? bounded[bounded.length - 1].max : null;
  const setRow = (i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => {
    const prev = Number(lastMax) || 0;
    onChange([...bounded, { max: prev > 0 ? prev * 2 : 100, [valueKey]: open[valueKey] }, open]);
  };
  // 폰: 한 구간을 두 줄로 (경계값 / 값), 데스크톱: 한 줄 (경계값 | 값 | 삭제)
  const rowCls = 'grid grid-cols-[1fr_28px] sm:grid-cols-[1fr_1fr_28px] gap-x-2 gap-y-1 items-center';
  const valuePos = 'col-start-1 row-start-2 sm:col-start-2 sm:row-start-1 pl-[82px] sm:pl-0';
  const ValueCell = ({ i, r }) => (
    <div className={`flex items-center gap-1.5 ${valuePos}`}>
      <input type="number" min="0" value={r[valueKey]} onChange={e => setRow(i, valueKey, e.target.value)} className={inCls} />
      <span className="text-xs text-slate-500 w-8 shrink-0">{valueUnit}</span>
      {money && <span className="hidden sm:inline text-[11px] text-slate-400 w-24 shrink-0 text-right">{num(r[valueKey])}원</span>}
    </div>
  );
  return (
    <div className="space-y-2 sm:space-y-1.5">
      {bounded.map((r, i) => (
        <div key={i} className={rowCls}>
          <div className="col-start-1 row-start-1 grid grid-cols-[76px_1fr_auto] gap-1.5 items-center">
            <span className="text-[11px] text-slate-400 text-right whitespace-nowrap">{i > 0 ? `${num(bounded[i - 1].max)} 초과 ~` : ''}</span>
            <input type="number" min="0" value={r.max ?? ''} onChange={e => setRow(i, 'max', e.target.value)} className={inCls} />
            <span className="text-xs text-slate-500 whitespace-nowrap">{unit} 이하</span>
          </div>
          {ValueCell({ i, r })}
          <button type="button" onClick={() => removeRow(i)} title="이 구간 삭제" className="col-start-2 row-start-1 sm:col-start-3 text-slate-300 hover:text-red-500 justify-self-center"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className={rowCls}>
        <div className="col-start-1 row-start-1 text-sm font-bold text-slate-600 pl-[82px]">{lastMax !== null && !isBlank(lastMax) ? `${num(lastMax)} ${unit} 초과` : `모든 ${unit === 'kg' ? '생지 kg' : '수량'}`}</div>
        {ValueCell({ i: rows.length - 1, r: open })}
      </div>
      <button type="button" onClick={addRow} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
        <Plus className="w-3.5 h-3.5" /> 구간 추가
      </button>
    </div>
  );
};

export const CostSettingsModal = ({
  onClose, costSettings, onSave, showToast,
  savedFabrics = [], designSheets = [], tempDesignSheets = [],
}) => {
  // 열릴 때의 설정을 깊은 복제해 편집 상태로 시드
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(resolveCostSettings(costSettings))));
  const initialRef = useRef(JSON.stringify(local));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => { setError(''); setLocal(prev => ({ ...prev, [key]: value })); };
  const setChem = (key, value) => { setError(''); setLocal(prev => ({ ...prev, chemTest: { ...prev.chemTest, [key]: value } })); };
  const setListItem = (key, i, field, value) => { setError(''); setLocal(prev => ({ ...prev, [key]: prev[key].map((x, idx) => (idx === i ? { ...x, [field]: value } : x)) })); };

  // 등급/유형 사용 현황 — 원단(품목) / 설계서·가설계서. 값이 없는 기존 품목은 기본(A·일반)으로 셈
  const usage = useMemo(() => {
    const count = (list, pick) => list.reduce((m, x) => { const id = pick(x || {}); m[id] = (m[id] || 0) + 1; return m; }, {});
    const sheets = [...(designSheets || []), ...(tempDesignSheets || [])].map(s => s?.costInput || {});
    const gradeOf = x => x.knitGrade || DEFAULT_KNIT_GRADE_ID;
    const typeOf = x => x.processType || DEFAULT_PROCESS_TYPE_ID;
    return {
      gradeFabric: count(savedFabrics || [], gradeOf), gradeSheet: count(sheets, gradeOf),
      typeFabric: count(savedFabrics || [], typeOf), typeSheet: count(sheets, typeOf),
    };
  }, [savedFabrics, designSheets, tempDesignSheets]);

  const usedBy = (kind, id) => {
    const fab = usage[`${kind}Fabric`][id] || 0;
    const sheet = usage[`${kind}Sheet`][id] || 0;
    return { fab, sheet, total: fab + sheet };
  };

  // 미리보기 — 저장 전 값으로 이화학·운임·외관검사 YD당 금액
  const preview = useMemo(() => {
    const s = resolveCostSettings(buildNext(local));
    return COST_DISPLAY_TIERS.map(t => {
      const colors = getChemColors(s, t.qty);
      const chem = colors * s.chemTest.feePerColor;
      const freight = getFreightAmount(s, t.qty);
      return { ...t, colors, chem, freight, perYd: (chem + freight) / t.qty + s.visualInspectionPerYd };
    });
  }, [local]);

  // ── 등급 / 유형 추가·삭제 ──
  const addGrade = () => set('knitGrades', [...local.knitGrades, { id: `g_${Date.now()}`, name: nextGradeName(local.knitGrades), fixedFee: '', desc: '' }]);
  const removeGrade = (i) => {
    const g = local.knitGrades[i];
    const u = usedBy('grade', g.id);
    if (u.total > 0) { setError(`'${g.name}' 등급은 사용 중이라 삭제할 수 없어요. (원단 ${u.fab}개, 설계서 ${u.sheet}개) 먼저 품목의 편직 난이도를 바꿔 주세요.`); return; }
    if (local.knitGrades.length <= 1) { setError('편직 난이도는 최소 1개가 있어야 해요.'); return; }
    set('knitGrades', local.knitGrades.filter((_, idx) => idx !== i));
  };
  const addType = () => set('processTypes', [...local.processTypes, { id: `pt_${Date.now()}`, name: '', lossPct: '' }]);
  const removeType = (i) => {
    const t = local.processTypes[i];
    const u = usedBy('type', t.id);
    if (u.total > 0) { setError(`'${t.name}' 유형은 사용 중이라 삭제할 수 없어요. (원단 ${u.fab}개, 설계서 ${u.sheet}개) 먼저 품목의 가공 유형을 바꿔 주세요.`); return; }
    if (local.processTypes.length <= 1) { setError('가공 유형은 최소 1개가 있어야 해요.'); return; }
    set('processTypes', local.processTypes.filter((_, idx) => idx !== i));
  };

  const validate = () => {
    const gradeErr = checkNames(local.knitGrades, '편직 정액');
    if (gradeErr) return gradeErr;
    if (local.knitGrades.some(g => isBlank(g.fixedFee) || !(Number(g.fixedFee) >= 0))) return '편직 정액: 금액을 0 이상으로 입력해 주세요.';
    const typeErr = checkNames(local.processTypes, '가공 LOSS');
    if (typeErr) return typeErr;
    if (local.processTypes.some(t => isBlank(t.lossPct) || !(Number(t.lossPct) >= 0 && Number(t.lossPct) <= 99))) return '가공 LOSS: LOSS%는 0~99로 입력해 주세요.';
    return checkBrackets(local.knitLossBrackets, 'pct', '편직 LOSS', { maxValue: 99 })
      || (isBlank(local.chemTest.feePerColor) || !(Number(local.chemTest.feePerColor) >= 0) ? '이화학 검사: 1컬러당 검사비를 0 이상으로 입력해 주세요.' : null)
      || checkBrackets(local.chemTest.colorBrackets, 'colors', '이화학 컬러수', { integer: true })
      || checkBrackets(local.freightBrackets, 'amount', '운임')
      || (isBlank(local.visualInspectionPerYd) || !(Number(local.visualInspectionPerYd) >= 0) ? '외관검사: YD당 단가를 0 이상으로 입력해 주세요.' : null);
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    const ok = await onSave(buildNext(local));
    setSaving(false);
    if (ok === false) return; // 실패 시 입력값 보존 (App이 실패 토스트 표시)
    showToast && showToast('원가 설정을 저장했어요. 모든 품목 원가에 바로 반영됩니다.', 'success');
    onClose();
  };

  const requestClose = () => {
    if (JSON.stringify(local) !== initialRef.current && !window.confirm('저장하지 않은 변경사항이 있어요. 닫을까요?')) return;
    onClose();
  };

  const updated = costSettings?.updatedAt
    ? `${new Date(costSettings.updatedAt).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${costSettings.updatedBy ? ` · ${costSettings.updatedBy}` : ''}`
    : '아직 저장한 적 없음 (기본값 사용 중)';

  return createPortal(
    <div className="fixed inset-0 z-[9995] bg-black/40 flex items-start justify-center p-3 md:p-4 overflow-y-auto print:hidden" onClick={requestClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 md:my-6 flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> 원가 설정</h3>
            <p className="text-[11px] text-slate-500 mt-1">여기서 바꾸면 <b>모든 품목 원가</b>에 바로 반영돼요. 이미 저장한 견적서 단가는 바뀌지 않아요.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">마지막 수정: {updated}</p>
          </div>
          <button onClick={requestClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* 본문 */}
        <div className="px-4 md:px-5 py-4 space-y-4 overflow-y-auto">
          {/* 1. 편직 정액 */}
          <Section no={1} title="편직 정액 (편직 난이도별)" hint="편직비 = max(정액, 생지 kg × kg단가). 정액 ÷ kg단가 지점부터 자동으로 kg 계산으로 넘어가요. kg단가는 품목마다 입력합니다.">
            <div className="hidden sm:grid grid-cols-[80px_1fr_1.4fr_64px_28px] gap-2 text-[11px] font-bold text-slate-400 px-1">
              <div>등급</div><div className="text-right">정액 (원)</div><div>설명</div><div className="text-center">사용</div><div />
            </div>
            {local.knitGrades.map((g, i) => {
              const u = usedBy('grade', g.id);
              return (
                <div key={g.id} className="grid grid-cols-[80px_1fr_28px] sm:grid-cols-[80px_1fr_1.4fr_64px_28px] gap-2 items-center">
                  <input type="text" value={g.name} onChange={e => setListItem('knitGrades', i, 'name', e.target.value)} className={`${txtCls} text-center font-bold`} placeholder="등급" />
                  <div>
                    <input type="number" min="0" value={g.fixedFee} onChange={e => setListItem('knitGrades', i, 'fixedFee', e.target.value)} className={inCls} />
                    <div className="text-[10px] text-slate-400 text-right mt-0.5">{num(g.fixedFee)}원</div>
                  </div>
                  <input type="text" value={g.desc} onChange={e => setListItem('knitGrades', i, 'desc', e.target.value)} className={`${txtCls} hidden sm:block`} placeholder="예: 싱글 등 쉬운 아이템" />
                  <div className="hidden sm:block text-center text-xs text-slate-500" title={`원단 ${u.fab}개 · 설계서/가설계서 ${u.sheet}개`}>{u.fab}</div>
                  <button type="button" onClick={() => removeGrade(i)} title={u.total > 0 ? '사용 중이라 삭제할 수 없어요' : '이 등급 삭제'} className={`justify-self-center ${u.total > 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500'}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={addGrade} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
              <Plus className="w-3.5 h-3.5" /> 등급 추가
            </button>
          </Section>

          {/* 2. 편직 LOSS */}
          <Section no={2} title="편직 LOSS (오더 전체 생지 kg 기준)" hint="생지 kg = 가공지 kg × (1 + 가공 LOSS%). 그 생지 kg가 속한 구간의 LOSS%로 원사 투입량을 계산해요.">
            <BracketEditor rows={local.knitLossBrackets} valueKey="pct" unit="kg" valueUnit="%" onChange={v => set('knitLossBrackets', v)} />
          </Section>

          {/* 3. 가공 LOSS */}
          <Section no={3} title="가공 LOSS (가공 유형별)" hint="품목마다 가공 유형을 고르면 그 유형의 LOSS%가 적용돼요. 새 유형(예: 스판기모)도 추가할 수 있어요.">
            <div className="grid grid-cols-[1.4fr_1fr_64px_28px] gap-2 text-[11px] font-bold text-slate-400 px-1">
              <div>유형</div><div className="text-right">LOSS %</div><div className="text-center">사용</div><div />
            </div>
            {local.processTypes.map((t, i) => {
              const u = usedBy('type', t.id);
              return (
                <div key={t.id} className="grid grid-cols-[1.4fr_1fr_64px_28px] gap-2 items-center">
                  <input type="text" value={t.name} onChange={e => setListItem('processTypes', i, 'name', e.target.value)} className={txtCls} placeholder="예: 스판기모" />
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" max="99" value={t.lossPct} onChange={e => setListItem('processTypes', i, 'lossPct', e.target.value)} className={inCls} />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <div className="text-center text-xs text-slate-500" title={`원단 ${u.fab}개 · 설계서/가설계서 ${u.sheet}개`}>{u.fab}</div>
                  <button type="button" onClick={() => removeType(i)} title={u.total > 0 ? '사용 중이라 삭제할 수 없어요' : '이 유형 삭제'} className={`justify-self-center ${u.total > 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500'}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={addType} className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
              <Plus className="w-3.5 h-3.5" /> 유형 추가
            </button>
          </Section>

          {/* 4. 이화학 검사 */}
          <Section no={4} title="이화학 검사 (오더당)" hint="오더 검사비 = 컬러수 × 1컬러당 검사비. 원가에는 오더 검사비 ÷ 수량이 YD당으로 들어가요.">
            <div className="flex items-center gap-2 flex-wrap pb-1">
              <span className="text-sm font-bold text-slate-600">1컬러당 검사비</span>
              <input type="number" min="0" value={local.chemTest.feePerColor} onChange={e => setChem('feePerColor', e.target.value)} className={`${inCls} w-36`} />
              <span className="text-xs text-slate-500">원 ({num(local.chemTest.feePerColor)}원)</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400">수량별 컬러수</div>
            <BracketEditor rows={local.chemTest.colorBrackets} valueKey="colors" unit="YD" valueUnit="컬러" onChange={v => setChem('colorBrackets', v)} />
          </Section>

          {/* 5. 운임 */}
          <Section no={5} title="운임 (오더당 총액)" hint="오더 수량이 속한 구간의 금액을 오더 운임으로 보고, 원가에는 운임 ÷ 수량이 YD당으로 들어가요.">
            <BracketEditor rows={local.freightBrackets} valueKey="amount" unit="YD" valueUnit="원" money onChange={v => set('freightBrackets', v)} />
          </Section>

          {/* 6. 외관검사 */}
          <Section no={6} title="외관검사 (YD당)" hint="모든 품목에 같은 YD당 단가로 들어가요.">
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={local.visualInspectionPerYd} onChange={e => set('visualInspectionPerYd', e.target.value)} className={`${inCls} w-36`} />
              <span className="text-xs text-slate-500">원 / YD</span>
            </div>
          </Section>

          {/* 미리보기 */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3">
            <div className="text-xs font-extrabold text-blue-800 mb-2">미리보기 — 검사·운임이 YD당 얼마로 들어가는지 (저장 전 값 기준)</div>
            <div className="grid grid-cols-[1fr_1.3fr_1fr_1fr] gap-px bg-blue-100 rounded-lg overflow-hidden text-xs">
              <div className="bg-blue-100/80 px-2 py-1.5 font-bold text-blue-900">수량</div>
              <div className="bg-blue-100/80 px-2 py-1.5 font-bold text-blue-900 text-right">이화학</div>
              <div className="bg-blue-100/80 px-2 py-1.5 font-bold text-blue-900 text-right">운임</div>
              <div className="bg-blue-100/80 px-2 py-1.5 font-bold text-blue-900 text-right">YD당 합계</div>
              {preview.map(p => (
                <React.Fragment key={p.key}>
                  <div className="bg-white px-2 py-1.5 font-bold text-slate-700">{p.label}</div>
                  <div className="bg-white px-2 py-1.5 text-right font-mono text-slate-600">{p.colors}컬러 · {num(p.chem)}원</div>
                  <div className="bg-white px-2 py-1.5 text-right font-mono text-slate-600">{num(p.freight)}원</div>
                  <div className="bg-white px-2 py-1.5 text-right font-mono font-bold text-blue-700">{num(p.perYd)}원</div>
                </React.Fragment>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5">YD당 합계 = (이화학 + 운임) ÷ 수량 + 외관검사</div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 shrink-0 space-y-2">
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={requestClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">취소</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
