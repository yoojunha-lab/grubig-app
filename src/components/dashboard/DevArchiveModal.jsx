import React, { useState, useMemo } from 'react';
import { X, Archive, Search, RotateCcw, FileText, Link, Award, ArrowRight, Calendar } from 'lucide-react';

// 진입 날짜 → "MM/DD" 단순 포맷
const formatDate = (iso) => {
  if (!iso) return null;
  const t = new Date(iso); if (isNaN(t)) return null;
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
};

const TABS = [
  { key: 'rejected',  label: 'Drop된 의뢰',     icon: X,      color: 'text-rose-600 bg-rose-100',     accent: 'rose' },
  { key: 'inProgress', label: '진행중 (설계서 연결)', icon: Link,   color: 'text-violet-600 bg-violet-100', accent: 'violet' },
  { key: 'articled',  label: '아이템화 완료',   icon: Award,  color: 'text-emerald-600 bg-emerald-100', accent: 'emerald' }
];

export const DevArchiveModal = ({
  isOpen,
  onClose,
  rejectedDevs = [],
  confirmedLinkedDevs = [],
  articledSheets = [],
  designSheets = [],
  updateDevStatus,
  handleEditSheet,
  statusLabels = {},
  statusCls = {}
}) => {
  const [activeTab, setActiveTab] = useState('rejected');
  const [searchTerm, setSearchTerm] = useState('');

  // 탭별 필터링 (Hook은 early return 이전에 호출되어야 함)
  const q = searchTerm.trim().toLowerCase();
  const matchSearch = (text) => !q || String(text || '').toLowerCase().includes(q);
  const filteredRejected = useMemo(() => (rejectedDevs || []).filter(d =>
    matchSearch(d.buyerName) || matchSearch(d.devOrderNo) || matchSearch(d.devItem) || matchSearch(d.targetSpec?.composition)
  ), [rejectedDevs, q]);
  const filteredInProgress = useMemo(() => (confirmedLinkedDevs || []).filter(d =>
    matchSearch(d.buyerName) || matchSearch(d.devOrderNo) || matchSearch(d.devItem)
  ), [confirmedLinkedDevs, q]);
  const filteredArticled = useMemo(() => (articledSheets || []).filter(s =>
    matchSearch(s.fabricName) || matchSearch(s.devOrderNo) || matchSearch(s.articleNo) || matchSearch(s.eztexOrderNo)
  ), [articledSheets, q]);

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
    if (!window.confirm(`'${devReq.devOrderNo}' 의뢰를 복원할까요?\n('의뢰접수' 단계로 되돌립니다)`)) return;
    updateDevStatus?.(devReq.id, 'pending');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* 백그라운드 오버레이 */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 창 */}
      <div className="relative w-full max-w-4xl bg-slate-50 rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">개발의뢰 보관함</h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                총 <span className="font-bold text-slate-700">{total}</span>건 (Drop {counts.rejected} / 진행중 {counts.inProgress} / 아이템화 {counts.articled})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex bg-white border-b border-slate-200 px-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
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
        <div className="p-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="바이어/개발번호/원단명/아티클 검색..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
            />
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">

          {/* TAB 1: Drop된 의뢰 */}
          {activeTab === 'rejected' && (
            filteredRejected.length === 0 ? (
              <EmptyMessage icon={X} text="Drop된 의뢰가 없습니다." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredRejected.map(d => (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">Drop</span>
                      <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{d.buyerName}</p>
                    <div className="flex gap-1.5 text-[10px] text-slate-500 mt-1 flex-wrap">
                      {d.devItem && <span className="bg-slate-100 px-1 py-0.5 rounded">{d.devItem}</span>}
                      {d.targetSpec?.composition && <span>{d.targetSpec.composition.substring(0,30)}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1 text-[9px] text-slate-400">
                        <Calendar className="w-2.5 h-2.5" />
                        Drop: {formatDate(d.statusEnteredAt?.rejected || d.updatedAt) || '-'}
                      </span>
                      <button onClick={() => handleRestore(d)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200">
                        <RotateCcw className="w-3 h-3" /> 복원
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TAB 2: 진행중 (설계서 연결) */}
          {activeTab === 'inProgress' && (
            filteredInProgress.length === 0 ? (
              <EmptyMessage icon={Link} text="진행 중인 항목이 없습니다." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredInProgress.map(d => {
                  const sheet = findSheet(d);
                  const stageLabel = {
                    draft: '설계서 작성', eztex: 'EZ-TEX', sampling: '샘플 진행', articled: '아이템화'
                  }[sheet?.stage] || '-';
                  return (
                    <div key={d.id}
                      onClick={() => sheet && handleEditSheet?.(sheet)}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-violet-300 cursor-pointer transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">진행중</span>
                        <span className="text-xs font-mono font-extrabold text-violet-600">{d.devOrderNo}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{d.buyerName}</p>
                      {sheet?.fabricName && (
                        <p className="text-[11px] text-slate-600 font-semibold mt-0.5">{sheet.fabricName}</p>
                      )}
                      <div className="flex gap-1.5 text-[10px] mt-1.5 flex-wrap">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">{stageLabel}</span>
                        {sheet?.eztexOrderNo && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sheet.eztexOrderNo}</span>}
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
    </div>
  );
};

const EmptyMessage = ({ icon: Icon, text }) => (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
    <p className="text-sm font-bold text-slate-500">{text}</p>
  </div>
);
