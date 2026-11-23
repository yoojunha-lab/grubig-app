import React, { useMemo, useState } from 'react';
import {
  Phone, Printer, MapPin, User, Pencil, CalendarCheck, Coins, StickyNote, Send, Trash2, Check, X, FileText, Factory, History, Loader2,
  ArrowLeft, Map as MapIcon, Navigation,
} from 'lucide-react';
import { factoryTotals, sameFactoryName, checkState, fmtNum, kakaoLinkTo, kakaoLinkSearch, geocodeQuery } from '../../utils/knitFactoryModel';
import { DESIGN_STAGES } from '../../constants/common';
import { todayLocalISO } from '../../utils/helpers';
import { CheckBadge, KnitBlocks } from './KnitParts';

// ============================================================
// 편직처 기계 현황 — 편직처 한 곳 보기 (대표님 요청 2026-11-23, 2차: 목록에서 눌러서 열고 ← 로 목록으로 — 견적서 화면과 같은 모양)
//  · 연락처 · 주소(카카오맵 링크) · 편직료 / 기계 현황(종류 + 인치 묶음 — 기계 줄 + 보유 가마) / 메모 / 우리 작업 이력
//  · '지금 가마' 칸을 누르면 바로 바꿈 (확인일 오늘로) · [오늘 확인함]
// ============================================================

const Section = ({ icon: Icon, title, right, children }) => (
  <section className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-violet-500" /> {title}</h4>
      {right}
    </div>
    {children}
  </section>
);

const telHref = (s) => `tel:${String(s || '').split('/')[0].replace(/[^\d+]/g, '')}`;
const stageLabel = (key) => DESIGN_STAGES.find(s => s.key === key)?.label || '설계서 작성';
const sheetNo = (s) => s.eztexOrderNo || s.articleNo || s.devOrderNo || '(번호 없음)';
// 저장 시각 → 이 PC 날짜 (ISO 글자를 그냥 자르면 UTC라 오전 9시 전은 전날로 보임)
const dateOf = (iso) => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayLocalISO(d);
};
const ORDER_STATUS = { active: '진행 중', on_hold: '보류', completed: '완료' };

const MemoItem = ({ memo, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memo.text);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim() || text.trim() === memo.text) { setEditing(false); setText(memo.text); return; }
    setBusy(true);
    try { if (await onSave(text)) setEditing(false); } finally { setBusy(false); }
  };
  return (
    <li className="group border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span className="font-bold text-slate-500">{memo.date}</span>
        {memo.by && <span>{memo.by}</span>}
        {memo.editedAt && <span>· {memo.editedAt} 고침</span>}
        {!editing && (
          <span className="ml-auto flex gap-1 opacity-60 group-hover:opacity-100">
            <button type="button" onClick={() => setEditing(true)} title="메모 고치기" className="p-0.5 hover:text-violet-600"><Pencil className="w-3 h-3" /></button>
            <button type="button" onClick={onDelete} title="메모 지우기" className="p-0.5 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-1 space-y-1">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={Math.min(8, Math.max(2, text.split('\n').length))}
            className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs outline-none focus:ring-2 ring-violet-200" autoFocus />
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => { setEditing(false); setText(memo.text); }} className="text-[11px] font-bold text-slate-500 px-2 py-0.5 rounded hover:bg-slate-100 inline-flex items-center gap-1"><X className="w-3 h-3" /> 취소</button>
            <button type="button" onClick={save} disabled={busy} className="text-[11px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded hover:bg-violet-700 inline-flex items-center gap-1 disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 저장
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-700 whitespace-pre-wrap mt-0.5">{memo.text}</p>
      )}
    </li>
  );
};

export const KnitFactoryDetail = ({
  factory,
  config,
  designSheets = [],
  orders = [],
  today,
  onBack,               // [← 목록으로]
  onEdit, onAddMemo, onUpdateMemo, onDeleteMemo, onMarkChecked, onSetGauge,
  onShowOnMap,          // 지도 화면에서 이 편직처 보기
  onOpenSheet,          // (설계서) => 설계서 열기
}) => {
  const [memoText, setMemoText] = useState('');
  const [memoBusy, setMemoBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const totals = factoryTotals(factory, config);
  const st = checkState(factory, today);

  const sheets = useMemo(() => designSheets
    .filter(s => sameFactoryName(s?.knitting?.factory, factory.name))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))), [designSheets, factory.name]);
  const knitOrders = useMemo(() => orders
    .filter(o => sameFactoryName(o?.steps?.knitting?.vendor, factory.name))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))), [orders, factory.name]);
  const HISTORY_LIMIT = 6;

  const submitMemo = async () => {
    if (!memoText.trim() || memoBusy) return;
    setMemoBusy(true);
    try { if (await onAddMemo(memoText)) setMemoText(''); } finally { setMemoBusy(false); }
  };
  const check = async () => {
    if (checkBusy) return;
    setCheckBusy(true);
    try { await onMarkChecked(); } finally { setCheckBusy(false); }
  };

  const contacts = (factory.contacts || []).filter(c => c.name || c.mobile);
  const addresses = (factory.addresses || []).filter(Boolean);
  const routeLink = factory.geo ? kakaoLinkTo(factory.name, factory.geo) : '';
  const searchLink = kakaoLinkSearch(geocodeQuery(factory));

  return (
    <div className="space-y-4">
      {/* 머리 — 견적서 화면처럼 ← 를 누르면 편직처 목록으로 */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
            <button type="button" onClick={onBack} title="편직처 목록으로" className="text-slate-400 hover:text-violet-600 hover:bg-slate-100 p-1.5 -ml-1.5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Factory className="w-5 h-5 text-violet-600 shrink-0" /> {factory.name}
            {factory.region && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{factory.region}</span>}
          </h3>
          <div className="mt-1 sm:pl-9 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <CheckBadge factory={factory} today={today} />
            <span>기계 <b className="text-slate-700">{totals.total ? `${fmtNum(totals.total)}대` : '대수 미기재'}</b> · {totals.lines}줄</span>
            {totals.cylinderLines > 0 && <span>· 보유 가마 <b className="text-slate-700">{totals.cylinders ? `${fmtNum(totals.cylinders)}개` : `${totals.cylinderLines}종`}</b></span>}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          <button type="button" onClick={check} disabled={checkBusy || st.days === 0}
            title={st.days === 0 ? '오늘 이미 확인했어요' : '편직처에 기계 현황을 확인했으면 눌러 주세요 (확인일이 오늘로)'}
            className="bg-white border border-emerald-300 text-emerald-700 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40">
            {checkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarCheck className="w-3.5 h-3.5" />} 오늘 확인함
          </button>
          <button type="button" onClick={onEdit}
            className="bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 text-xs font-bold inline-flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" /> 수정
          </button>
        </div>
      </div>

      {/* 연락처 · 주소 · 편직료 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
          {factory.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500 w-8">전화</span><a href={telHref(factory.phone)} className="font-bold text-slate-800 hover:text-violet-700">{factory.phone}</a></p>}
          {factory.fax && <p className="flex items-center gap-1.5"><Printer className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500 w-8">팩스</span><span className="font-bold text-slate-800">{factory.fax}</span></p>}
          {contacts.map(c => (
            <p key={c.id} className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-700">{c.name || '담당자'}</span>
              {c.mobile && <a href={telHref(c.mobile)} className="text-slate-800 hover:text-violet-700 font-mono">{c.mobile}</a>}
            </p>
          ))}
          {!factory.phone && !factory.fax && !contacts.length && <p className="text-slate-400">연락처가 없어요.</p>}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
          {addresses.length ? addresses.map((a, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-px shrink-0" />
              <span className="text-slate-800">{a}{i === 0 && addresses.length > 1 && <span className="ml-1 text-[10px] text-slate-400">(대표)</span>}</span>
            </p>
          )) : <p className="text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> 주소가 없어요.</p>}
          {addresses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {onShowOnMap && (
                <button type="button" onClick={onShowOnMap} className="text-[11px] font-bold text-violet-700 bg-white border border-violet-200 rounded px-1.5 py-0.5 inline-flex items-center gap-1 hover:bg-violet-50">
                  <MapIcon className="w-3 h-3" /> 지도에서 보기
                </button>
              )}
              <a href={routeLink || searchLink} target="_blank" rel="noreferrer"
                className="text-[11px] font-bold text-amber-800 bg-yellow-50 border border-yellow-300 rounded px-1.5 py-0.5 inline-flex items-center gap-1 hover:bg-yellow-100">
                <Navigation className="w-3 h-3" /> {routeLink ? '카카오맵 길찾기' : '카카오맵에서 찾기'}
              </a>
              {factory.geo?.byName && <span className="text-[10px] text-amber-700" title="주소로 못 찾아서 편직처 이름으로 찾은 위치예요">지도 위치는 이름으로 찾음 — 확인 필요</span>}
            </div>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <p className="font-bold text-slate-500 flex items-center gap-1.5 mb-1"><Coins className="w-3.5 h-3.5 text-slate-400" /> 편직료</p>
          {factory.knitFee ? <p className="text-slate-800 whitespace-pre-wrap">{factory.knitFee}</p> : <p className="text-slate-400">적은 편직료가 없어요.</p>}
        </div>
      </div>

      {/* 기계 현황 */}
      <Section icon={Factory} title="기계 현황"
        right={<span className="hidden sm:inline text-[10px] text-slate-400 text-right">같은 종류 · 같은 인치 기계끼리 가마를 돌려 써요 · '지금 가마'를 누르면 바로 바꿔요 · 침수 ≈ 회색 = 계산 값</span>}>
        <KnitBlocks factory={factory} config={config} onSetGauge={onSetGauge} />
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 메모 */}
        <Section icon={StickyNote} title={`메모 ${(factory.memos || []).length ? `(${factory.memos.length})` : ''}`}>
          <div className="flex gap-1.5">
            <textarea value={memoText} onChange={e => setMemoText(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitMemo(); }}
              placeholder="거래 관계 · 잘하는 원단 · 통화 내용 … (Ctrl+Enter로 남기기)"
              className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 ring-violet-200 resize-y" />
            <button type="button" onClick={submitMemo} disabled={!memoText.trim() || memoBusy}
              className="self-stretch bg-violet-600 text-white px-3 rounded-lg hover:bg-violet-700 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40">
              {memoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} 남기기
            </button>
          </div>
          {(factory.memos || []).length > 0 ? (
            <ul className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
              {factory.memos.map(m => (
                <MemoItem key={m.id} memo={m} onSave={(t) => onUpdateMemo(m.id, t)} onDelete={() => onDeleteMemo(m.id)} />
              ))}
            </ul>
          ) : <p className="text-xs text-slate-400">메모가 없어요.</p>}
        </Section>

        {/* 우리 작업 이력 */}
        <Section icon={History} title="우리 작업 이력"
          right={<span className="text-[10px] text-slate-400">설계서 {sheets.length}건 · 생산 오더 {knitOrders.length}건</span>}>
          {!sheets.length && !knitOrders.length ? (
            <p className="text-xs text-slate-400">'{factory.name}'(으)로 적힌 설계서 · 생산 오더가 없어요.</p>
          ) : (
            <div className="space-y-2">
              {sheets.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">설계서 (편직처)</p>
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {(showAllHistory ? sheets : sheets.slice(0, HISTORY_LIMIT)).map(s => (
                      <li key={s.id}>
                        <button type="button" onClick={() => onOpenSheet?.(s)} disabled={!onOpenSheet}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-violet-50/60 flex items-center gap-2 disabled:cursor-default">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800 whitespace-nowrap">{sheetNo(s)}</span>
                          <span className="text-slate-600 truncate flex-1">{s.fabricName || ''}</span>
                          <span className="font-mono text-slate-500 whitespace-nowrap">{[s.knitting?.gauge && `${s.knitting.gauge}G`, s.knitting?.machineInch && `${s.knitting.machineInch}"`].filter(Boolean).join(' ')}</span>
                          <span className={`text-[10px] font-bold px-1 rounded border whitespace-nowrap ${s.status === 'dropped' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                            {s.status === 'dropped' ? 'Drop' : stageLabel(s.stage)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {knitOrders.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">생산 현황 오더 (편직)</p>
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {(showAllHistory ? knitOrders : knitOrders.slice(0, HISTORY_LIMIT)).map(o => {
                      const k = o.steps?.knitting || {};
                      return (
                        <li key={o.id} className="px-2.5 py-1.5 text-xs flex items-center gap-2">
                          <span className="font-bold text-slate-800 whitespace-nowrap">{o.orderNumber || '(order# 없음)'}</span>
                          <span className="text-slate-600 whitespace-nowrap">{o.articleNo || ''}</span>
                          <span className="text-slate-500 truncate flex-1">{o.detail || ''}</span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{[k.startDate, k.endDate].filter(Boolean).join(' ~ ') || dateOf(o.createdAt)}</span>
                          <span className={`text-[10px] font-bold px-1 rounded border whitespace-nowrap ${o.type === 'sample' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>{o.type === 'sample' ? '샘플' : '메인'}</span>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">{ORDER_STATUS[o.status] || ''}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {(sheets.length > HISTORY_LIMIT || knitOrders.length > HISTORY_LIMIT) && (
                <button type="button" onClick={() => setShowAllHistory(v => !v)} className="text-[11px] font-bold text-violet-700 hover:underline">
                  {showAllHistory ? '접기' : '모두 보기'}
                </button>
              )}
            </div>
          )}
        </Section>
      </div>

      {factory.updatedAt && (
        <p className="text-[10px] text-slate-400 text-right">마지막 저장 {dateOf(factory.updatedAt)}{factory.updatedBy ? ` · ${factory.updatedBy}` : ''}{factory.source === 'excel' ? ' · 엑셀에서 옮김' : ''}</p>
      )}
    </div>
  );
};
