import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, Send, Truck, Calendar } from 'lucide-react';
import { BRAND_CONFIRM_RESULTS } from '../../../constants/production';

// ============================================================
// 염가공 컬러별 상세 행 (sub-row)
// ------------------------------------------------------------
// 1차 batch 안에서 컬러 1개를 펼쳐서 보여주는 카드.
// - 컬러 헤더 + 수량
// - 일정: 시작일 / 종료일 / 실제종료일
// - Shipping sample: 발송일 + 야드
// - 브랜드 컨펌 라운드 리스트 (1차/2차…): 발송일·합격일·결과 드롭다운
//
// 자동 저장 패턴: onBlur / onChange → onChange(updatedColor) 호출
// 부모(BatchRow)에서 batch.colors 안의 해당 색만 갈아끼우고 batch 전체를 saveDocToCloud.
// ============================================================
export const ColorDetailRow = ({ color, qtyUnit = 'KG', onChange }) => {
  const [draft, setDraft] = useState(() => normalizeColor(color));

  // 외부 변경 시 동기화 (저장 후 부모가 전파한 새 객체 받기)
  useEffect(() => {
    setDraft(normalizeColor(color));
  }, [color.color, color.quantity, color.plannedStartDate, color.plannedEndDate, color.actualEndDate,
      color.shippingSample?.sentDate, color.shippingSample?.yards,
      JSON.stringify(color.brandConfirms || [])]);

  // 헬퍼: draft 갱신 + 즉시 부모에게 propagate
  const update = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange?.(next);
  };

  const updateShipping = (patch) => {
    const next = { ...draft, shippingSample: { ...(draft.shippingSample || {}), ...patch } };
    setDraft(next);
    onChange?.(next);
  };

  const updateConfirmAt = (idx, patch) => {
    const list = [...(draft.brandConfirms || [])];
    list[idx] = { ...list[idx], ...patch };
    const next = { ...draft, brandConfirms: list };
    setDraft(next);
    onChange?.(next);
  };

  const addConfirmRound = () => {
    const list = [...(draft.brandConfirms || [])];
    const nextRound = list.length === 0 ? 1 : (list[list.length - 1].round || list.length) + 1;
    list.push({ round: nextRound, sentDate: '', resultDate: '', result: '' });
    const next = { ...draft, brandConfirms: list };
    setDraft(next);
    onChange?.(next);
  };

  const removeConfirmRound = (idx) => {
    if (idx === 0) return;  // 1차 라운드는 삭제 불가 (이력 보호)
    const list = [...(draft.brandConfirms || [])];
    list.splice(idx, 1);
    const next = { ...draft, brandConfirms: list };
    setDraft(next);
    onChange?.(next);
  };

  // 시각 신호: 컬러 컨펌 상태
  const confirmStatus = computeConfirmStatus(draft.brandConfirms);
  const isFinished = !!draft.actualEndDate;

  const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';
  const inputCls = 'border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div className={`bg-white rounded-lg border ${confirmStatus.outerBorder} p-3 shadow-sm`}>
      {/* 헤더: 컬러칩 + 수량 + 시각 신호 */}
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          {isFinished && <CheckCircle2 className="w-4 h-4 text-emerald-600" title="실제 종료 완료" />}
          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-md border ${confirmStatus.chipCls}`}>
            {draft.color}
          </span>
          <span className={`inline-block w-2 h-2 rounded-full ${confirmStatus.dotCls}`} title={confirmStatus.tooltip}/>
          <span className="text-[10px] text-slate-500 font-medium">{confirmStatus.tooltip}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={labelCls}>수량</span>
          <input type="number" value={draft.quantity ?? ''}
            onChange={e => setDraft(prev => ({ ...prev, quantity: e.target.value }))}
            onBlur={e => update({ quantity: Number(e.target.value) || 0 })}
            className={`${inputCls} w-20 text-right`}
            placeholder="0"
          />
          <span className="text-[10px] text-slate-500">{qtyUnit}</span>
        </div>
      </div>

      {/* 일정 */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <DateField label="시작일" value={draft.plannedStartDate}
          onChange={v => update({ plannedStartDate: v })}
          icon={<Calendar className="w-3 h-3 text-slate-400" />}
        />
        <DateField label="종료일" value={draft.plannedEndDate}
          onChange={v => update({ plannedEndDate: v })}
          icon={<Calendar className="w-3 h-3 text-slate-400" />}
        />
        <DateField label="실제 종료일" value={draft.actualEndDate}
          onChange={v => update({ actualEndDate: v })}
          icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />}
          inputBgCls={draft.actualEndDate ? 'bg-emerald-50' : ''}
        />
      </div>

      {/* Shipping sample */}
      <div className="bg-sky-50/50 border border-sky-100 rounded-md p-2 mb-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Truck className="w-3.5 h-3.5 text-sky-600" />
          <span className="text-[11px] font-extrabold text-sky-700 uppercase tracking-wider">Shipping Sample</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={labelCls}>발송일</div>
            <input type="date" value={draft.shippingSample?.sentDate || ''}
              onChange={e => updateShipping({ sentDate: e.target.value })}
              className={`${inputCls} w-full mt-0.5`}
            />
          </div>
          <div>
            <div className={labelCls}>발송 수량 (YD)</div>
            <input type="number" value={draft.shippingSample?.yards ?? ''}
              onChange={e => setDraft(prev => ({ ...prev, shippingSample: { ...(prev.shippingSample || {}), yards: e.target.value } }))}
              onBlur={e => updateShipping({ yards: Number(e.target.value) || 0 })}
              className={`${inputCls} w-full mt-0.5 text-right`}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* 브랜드 컨펌 라운드 */}
      <div className="bg-violet-50/40 border border-violet-100 rounded-md p-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[11px] font-extrabold text-violet-700 uppercase tracking-wider">브랜드 컨펌</span>
          </div>
          {canAddRound(draft.brandConfirms) && (
            <button type="button" onClick={addConfirmRound}
              className="flex items-center gap-1 px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded transition-colors"
              title="이전 라운드가 불합격인 경우에만 추가 가능"
            >
              <Plus className="w-3 h-3" /> {nextRoundLabel(draft.brandConfirms)}차 컨펌 추가
            </button>
          )}
        </div>
        {(draft.brandConfirms || []).length === 0 ? (
          <div className="text-[10px] text-slate-400 py-1.5">컨펌 라운드 없음</div>
        ) : (
          <div className="space-y-1.5">
            {(draft.brandConfirms || []).map((cf, idx) => {
              const meta = BRAND_CONFIRM_RESULTS.find(r => r.key === cf.result);
              return (
                <div key={idx} className="grid grid-cols-[60px_1fr_1fr_120px_24px] gap-1.5 items-center">
                  <span className="text-[10px] font-extrabold text-violet-700 bg-white border border-violet-200 rounded px-1.5 py-1 text-center">
                    {cf.round || idx + 1}차
                  </span>
                  <input type="date" value={cf.sentDate || ''}
                    onChange={e => updateConfirmAt(idx, { sentDate: e.target.value })}
                    className={`${inputCls} w-full`}
                    title="컨펌 발송일"
                  />
                  <input type="date" value={cf.resultDate || ''}
                    onChange={e => updateConfirmAt(idx, { resultDate: e.target.value })}
                    className={`${inputCls} w-full`}
                    title="결과 통보일"
                  />
                  <select value={cf.result || ''}
                    onChange={e => updateConfirmAt(idx, { result: e.target.value })}
                    className={`${inputCls} w-full font-bold cursor-pointer ${meta?.color || ''}`}
                  >
                    <option value="">결과 선택</option>
                    {BRAND_CONFIRM_RESULTS.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  {idx > 0 ? (
                    <button type="button" onClick={() => removeConfirmRound(idx)}
                      className="p-0.5 text-slate-400 hover:text-rose-500 rounded"
                      title="이 라운드 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : <span/>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 헬퍼
// ============================================================

// 빈 필드 채워서 정규화
function normalizeColor(c) {
  return {
    color: c.color || '',
    quantity: c.quantity ?? 0,
    plannedStartDate: c.plannedStartDate || '',
    plannedEndDate: c.plannedEndDate || '',
    actualEndDate: c.actualEndDate || '',
    shippingSample: { sentDate: '', yards: 0, ...(c.shippingSample || {}) },
    brandConfirms: c.brandConfirms || []
  };
}

// 다음 라운드 추가 가능 여부: 마지막 라운드 result === 'fail' 일 때만
function canAddRound(rounds = []) {
  if (rounds.length === 0) return true;  // 초기엔 한 라운드 추가 허용
  const last = rounds[rounds.length - 1];
  return last.result === 'fail';
}

function nextRoundLabel(rounds = []) {
  if (rounds.length === 0) return 1;
  const lastRound = rounds[rounds.length - 1].round || rounds.length;
  return lastRound + 1;
}

// 컨펌 상태 종합 (UI 표시용)
function computeConfirmStatus(rounds = []) {
  if (rounds.length === 0) {
    return {
      tooltip: '컨펌 미시작',
      dotCls: 'bg-slate-300',
      chipCls: 'bg-slate-100 text-slate-700 border-slate-300',
      outerBorder: 'border-slate-200'
    };
  }
  const last = rounds[rounds.length - 1];
  if (last.result === 'pass') {
    return {
      tooltip: `${last.round || rounds.length}차 합격`,
      dotCls: 'bg-emerald-500',
      chipCls: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      outerBorder: 'border-emerald-200'
    };
  }
  if (last.result === 'fail') {
    return {
      tooltip: `${last.round || rounds.length}차 불합격 - 다음 라운드 필요`,
      dotCls: 'bg-rose-500 animate-pulse',
      chipCls: 'bg-rose-100 text-rose-700 border-rose-300',
      outerBorder: 'border-rose-300'
    };
  }
  if (last.result === 'retest') {
    return {
      tooltip: `${last.round || rounds.length}차 재시험`,
      dotCls: 'bg-amber-500',
      chipCls: 'bg-amber-100 text-amber-700 border-amber-300',
      outerBorder: 'border-amber-200'
    };
  }
  // 결과 미설정 (진행 중)
  if (last.sentDate) {
    return {
      tooltip: `${last.round || rounds.length}차 진행 중 (결과 대기)`,
      dotCls: 'bg-orange-400',
      chipCls: 'bg-orange-50 text-orange-700 border-orange-200',
      outerBorder: 'border-orange-200'
    };
  }
  return {
    tooltip: '컨펌 미시작',
    dotCls: 'bg-slate-300',
    chipCls: 'bg-slate-100 text-slate-700 border-slate-300',
    outerBorder: 'border-slate-200'
  };
}

// 작은 날짜 필드
const DateField = ({ label, value, onChange, icon, inputBgCls = '' }) => (
  <div>
    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
      {icon}{label}
    </div>
    <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
      className={`border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full ${inputBgCls}`}
    />
  </div>
);
