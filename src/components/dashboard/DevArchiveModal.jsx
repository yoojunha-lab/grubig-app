import React, { useState, useMemo } from 'react';
import { X, Archive, Search, RotateCcw, Link, Award, ArrowRight, Calendar, Target } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { DevQuoteBadge } from './DevQuoteBadge';
import { DEV_DROP_REASONS } from '../../constants/common';
import { getDevQuoteBadge, indexDevQuotes } from '../../utils/devQuoteModel';
import { formatMonthDay } from '../../utils/helpers';

// 진입 날짜 → "MM/DD" (공용 helpers.formatMonthDay — 비었으면 '')
const formatDate = (iso) => formatMonthDay(iso);

// 검색어(소문자) 포함 여부 — 비었으면 통과
const textMatches = (q, text) => !q || String(text || '').toLowerCase().includes(q);

// Drop 사유 찾기 — 사유 기능 전에 Drop된 의뢰(값 없음)는 null
const findDropReason = (key) => DEV_DROP_REASONS.find(r => r.key === key) || null;

// 'inProgress' = 샘플 진행 (생산 현황) — EZ-TEX 를 등록해 생산 현황 샘플 오더로 넘어간 의뢰 (2026-10-10)
//  (설계서를 쓰는 중인 의뢰는 개발/설계 현황 표에 그대로 있음 — 예전 '진행중 (설계서 연결)' 탭)
const TABS = [
  { key: 'rejected',  label: 'Drop된 의뢰',     icon: X,      color: 'text-rose-600 bg-rose-100',     accent: 'rose' },
  { key: 'inProgress', label: '샘플 진행 (생산 현황)', icon: Link,   color: 'text-violet-600 bg-violet-100', accent: 'violet' },
  { key: 'articled',  label: '아이템화 완료',   icon: Award,  color: 'text-emerald-600 bg-emerald-100', accent: 'emerald' }
];

export const DevArchiveModal = ({
  isOpen,
  onClose,
  rejectedDevs = [],
  confirmedLinkedDevs = [],   // 샘플 진행 (생산 현황) 의뢰 — 설계서가 생산 현황 샘플 오더로 넘어간 의뢰
  articledSheets = [],
  designSheets = [],
  savedQuotes = [],     // 견적서 — Drop된 의뢰의 원가 견적·견적가 표시
  updateDevStatus,
  handleEditSheet,
  sampleOrderNoOf,          // (sheetId) => 생산 현황 샘플 오더 order# ('' = 없음) — '샘플 진행' 카드
  onOpenProductionOrder,    // (order#) => 생산 현황으로 가서 그 오더 보기
}) => {
  const [activeTab, setActiveTab] = useState('rejected');
  const [searchTerm, setSearchTerm] = useState('');
  // Drop 사유로 걸러 보기 — 'all' | 사유 key | 'none'(사유 기능 전에 Drop된 의뢰)
  const [dropFilter, setDropFilter] = useState('all');

  // 탭별 필터링 (Hook은 early return 이전에 호출되어야 함)
  const q = searchTerm.trim().toLowerCase();
  const searchedRejected = useMemo(() => (rejectedDevs || []).filter(d =>
    textMatches(q, d.buyerName) || textMatches(q, d.devOrderNo) || textMatches(q, d.devItem) || textMatches(q, d.targetSpec?.composition) || textMatches(q, d.dropMemo)
  ), [rejectedDevs, q]);
  const filteredRejected = useMemo(() => searchedRejected.filter(d => {
    if (dropFilter === 'all') return true;
    const reason = findDropReason(d.dropReason);
    if (dropFilter === 'none') return !reason;
    return reason?.key === dropFilter;
  }), [searchedRejected, dropFilter]);
  // 사유별 건수 (검색어 반영)
  const dropCounts = useMemo(() => {
    const counts = { all: searchedRejected.length, none: 0 };
    DEV_DROP_REASONS.forEach(r => { counts[r.key] = 0; });
    searchedRejected.forEach(d => {
      const reason = findDropReason(d.dropReason);
      if (reason) counts[reason.key] += 1; else counts.none += 1;
    });
    return counts;
  }, [searchedRejected]);
  const filteredInProgress = useMemo(() => (confirmedLinkedDevs || []).filter(d =>
    textMatches(q, d.buyerName) || textMatches(q, d.devOrderNo) || textMatches(q, d.devItem)
  ), [confirmedLinkedDevs, q]);
  const filteredArticled = useMemo(() => (articledSheets || []).filter(s =>
    textMatches(q, s.fabricName) || textMatches(q, s.devOrderNo) || textMatches(q, s.articleNo) || textMatches(q, s.eztexOrderNo)
  ), [articledSheets, q]);
  // 의뢰별 견적서 (Drop된 의뢰 카드의 견적가) — 카드마다 전체 견적을 다시 훑지 않게 한 번만
  const quoteIndex = useMemo(() => indexDevQuotes(savedQuotes), [savedQuotes]);

  if (!isOpen) return null;

  const counts = {
    rejected: rejectedDevs.length,
    inProgress: confirmedLinkedDevs.length,
    articled: articledSheets.length
  };
  const total = counts.rejected + counts.inProgress + counts.articled;

  const findSheet = (devReq) => {
    if (devReq.linkedDesignSheetId) return designSheets.find(s => s.id === devReq.linkedDesignSheetId);
    return designSheets.find(s => s.devRequestId === devReq.id && s.status !== 'dropped');
  };

  const handleRestore = (devReq) => {
    if (!window.confirm(`'${devReq.devOrderNo}' 의뢰를 복원할까요?\n('의뢰접수' 단계로 되돌리고, Drop 사유는 지워요)`)) return;
    updateDevStatus?.(devReq.id, 'pending');
  };

  // Drop 사유 걸러 보기 칩 — '사유 없음'(사유 기능 전에 Drop된 의뢰)은 있을 때만, 단 고른 상태면 0건이 돼도 보여 줌
  //  (복원해서 0건이 되면 칩이 사라져 빈 목록만 남던 문제)
  const dropChips = [
    { key: 'all', label: '전체', cls: 'bg-white text-slate-600 border-slate-300' },
    ...DEV_DROP_REASONS.map(r => ({ key: r.key, label: r.label, cls: r.cls })),
    ...(dropCounts.none > 0 || dropFilter === 'none' ? [{ key: 'none', label: '사유 없음', cls: 'bg-white text-slate-400 border-slate-200' }] : []),
  ];

  return (
    // 배경을 눌렀다가 배경에서 뗐을 때만 닫힘 — 검색칸에서 글자를 드래그하다 창 밖에서 떼도 닫히지 않음 (팝업 규약)
    <ModalBackdrop className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClose={onClose}>

      {/* 모달 창 */}
      <div className="relative w-full max-w-4xl bg-slate-50 rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">개발의뢰 보관함</h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                총 <span className="font-bold text-slate-700">{total}</span>건 (Drop {counts.rejected} / 샘플 진행 {counts.inProgress} / 아이템화 {counts.articled})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex bg-white border-b border-slate-200 px-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchTerm(''); setDropFilter('all'); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? `text-${tab.accent}-700 border-${tab.accent}-500`
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? tab.color : 'bg-slate-100 text-slate-500'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* 검색창 */}
        <div className="p-3 bg-white border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder={activeTab === 'rejected' ? '바이어/개발번호/품목/Drop 메모 검색...' : '바이어/개발번호/원단명/아티클 검색...'}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
            />
          </div>
          {/* Drop 사유로 걸러 보기 (예: 가격 때문에 Drop된 건만) */}
          {activeTab === 'rejected' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 mr-0.5">Drop 사유</span>
              {dropChips.map(c => {
                const on = dropFilter === c.key;
                return (
                  <button key={c.key} type="button" onClick={() => setDropFilter(c.key)} aria-pressed={on}
                    className={`text-[10px] font-extrabold px-2 py-1 rounded-full border transition-all ${c.cls} ${on ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-70 hover:opacity-100'}`}>
                    {c.label} {dropCounts[c.key] ?? 0}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">

          {/* TAB 1: Drop된 의뢰 */}
          {activeTab === 'rejected' && (
            filteredRejected.length === 0 ? (
              <EmptyMessage icon={X} text={dropFilter === 'all' ? 'Drop된 의뢰가 없습니다.' : '이 사유로 Drop된 의뢰가 없습니다.'} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredRejected.map(d => {
                  const reason = findDropReason(d.dropReason);
                  const quote = getDevQuoteBadge(d, quoteIndex.get(String(d.id)) || []);
                  const targetPrice = String(d.targetSpec?.targetPrice || '').trim();
                  return (
                    <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">Drop</span>
                          {reason
                            ? <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${reason.cls}`} title={reason.desc}>{reason.label}</span>
                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-white text-slate-400 border-slate-200">사유 없음</span>}
                        </div>
                        <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{d.buyerName}</p>
                      <div className="flex gap-1.5 text-[10px] text-slate-500 mt-1 flex-wrap">
                        {d.devItem && <span className="bg-slate-100 px-1 py-0.5 rounded">{d.devItem}</span>}
                        {d.targetSpec?.composition && <span>{d.targetSpec.composition.substring(0,30)}</span>}
                      </div>
                      {/* 가격 비교 — 원가 견적·견적서 가격과 바이어 타겟 단가 */}
                      {(quote || targetPrice) && (
                        <div className="flex gap-1.5 text-[10px] mt-1.5 flex-wrap">
                          <DevQuoteBadge badge={quote} size="md" />

                          {targetPrice && (
                            <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                              <Target className="w-2.5 h-2.5" /> 타겟 {targetPrice}
                            </span>
                          )}
                        </div>
                      )}
                      {d.dropMemo && (
                        <p className="text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 mt-1.5 break-words">📝 {d.dropMemo}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400">
                          <Calendar className="w-2.5 h-2.5" />
                          Drop: {formatDate(d.statusEnteredAt?.rejected || d.updatedAt) || '-'}
                          {d.droppedBy && <span> · {String(d.droppedBy).split('@')[0]}</span>}
                        </span>
                        <button onClick={() => handleRestore(d)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200">
                          <RotateCcw className="w-3 h-3" /> 복원
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 2: 진행중 (설계서 연결) */}
          {activeTab === 'inProgress' && (
            filteredInProgress.length === 0 ? (
              <EmptyMessage icon={Link} text="생산 현황에서 샘플 진행 중인 의뢰가 없습니다." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredInProgress.map(d => {
                  const sheet = findSheet(d);
                  const stageLabel = {
                    draft: '설계서 작성', eztex: 'EZ-TEX', sampling: '샘플 진행', articled: '아이템화'
                  }[sheet?.stage] || '-';
                  const orderNo = sheet && sampleOrderNoOf ? sampleOrderNoOf(sheet.id) : '';
                  return (
                    <div key={d.id}
                      onClick={() => sheet && handleEditSheet?.(sheet)}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-violet-300 cursor-pointer transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">샘플 진행 (생산 현황)</span>
                        <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{d.buyerName}</p>
                      {sheet?.fabricName && (
                        <p className="text-[11px] text-slate-600 font-semibold mt-0.5">{sheet.fabricName}</p>
                      )}
                      <div className="flex gap-1.5 text-[10px] mt-1.5 flex-wrap items-center">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">{stageLabel}</span>
                        {sheet?.eztexOrderNo && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sheet.eztexOrderNo}</span>}
                        {orderNo && onOpenProductionOrder && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onClose?.(); onOpenProductionOrder(orderNo); }}
                            className="ml-auto px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700 font-bold hover:bg-purple-100"
                            title={`생산 현황에서 샘플 오더 ${orderNo} 보기`}
                          >
                            생산 현황 →
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400">
                          <Calendar className="w-2.5 h-2.5" />
                          현재단계 진입: {formatDate(sheet?.stageEnteredAt?.[sheet?.stage] || sheet?.updatedAt) || '-'}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-violet-600 font-bold">
                          설계서 열기 <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 3: 아이템화 완료 */}
          {activeTab === 'articled' && (
            filteredArticled.length === 0 ? (
              <EmptyMessage icon={Award} text="아이템화 완료 항목이 없습니다." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredArticled.map(s => (
                  <div key={s.id}
                    onClick={() => handleEditSheet?.(s)}
                    className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-emerald-300 cursor-pointer transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">아이템화</span>
                      <span className="text-xs font-mono font-extrabold text-violet-600">{s.devOrderNo || '자체'}</span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{s.fabricName || '원단명 미입력'}</p>
                    <div className="flex gap-1.5 text-[10px] mt-1.5 flex-wrap">
                      {s.articleNo && <span className="font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">{s.articleNo}</span>}
                      {s.eztexOrderNo && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{s.eztexOrderNo}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1 text-[9px] text-slate-400">
                        <Calendar className="w-2.5 h-2.5" />
                        아이템화: {formatDate(s.stageEnteredAt?.articled || s.updatedAt) || '-'}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold">
                        설계서 열기 <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
};

const EmptyMessage = ({ icon: Icon, text }) => (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
    <p className="text-sm font-bold text-slate-500">{text}</p>
  </div>
);
