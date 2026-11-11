import React, { useMemo, useState } from 'react';
import { Copy, Search, X, FileText, ArrowRight } from 'lucide-react';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { DESIGN_STAGES, STAGE_COLORS } from '../../constants/common';
import { compareArticle } from '../../utils/helpers';

// ============================================================
// 기존 설계서 불러오기 — 설계서 고르는 창 (대표님 요청 2026-11-11)
//  새 설계서(저장 전) 화면 위 [설계서 불러오기] → 이 창에서 하나 고르면 그 스펙을 지금 설계서에 복사
//  (복사 규칙은 useDesignSheet.loadSheetAsTemplate — 원본은 그대로)
//  · 목록: Drop된 설계서를 뺀 전부 (설계서 작성 · EZ-TEX · 샘플 진행 · 아이템화) — 단계 배지
//  · 검색: 원단명 · Article · EZ-TEX O/D NO. · 개발번호
//  · 순서: Article 순서 (용어 사전 §3-A — compareArticle), Article 없는 설계서는 뒤에 최근 고친 순
//  props: sheets(designSheets) · yarnSelectOptions(원사 이름 — 줄의 원사 요약) · onPick(sheet) → 불러왔으면 true · onClose
// ============================================================

const STAGE_LABEL = Object.fromEntries(DESIGN_STAGES.map(s => [s.key, s.label]));

// 원사 요약 — '40/1 CM 95% · SP 5%' (원사 칸 중 혼용률 있는 칸만, 이름은 라이브러리 이름 · 공급처 표시는 뺌)
const yarnSummary = (sheet, yarnSelectOptions) => (sheet.yarns || [])
  .filter(y => y && y.yarnId && Number(y.ratio) > 0)
  .map(y => {
    const realId = String(y.yarnId).split('::')[0];
    const opt = (yarnSelectOptions || []).find(o => String(o.id) === realId);
    const name = opt ? String(opt.name || '').replace(/\s*\[[^\]]*\]\s*$/, '') : '지운 원사';
    return `${name} ${Number(y.ratio)}%`;
  })
  .join(' · ');

export const SheetTemplatePickerModal = ({ sheets = [], yarnSelectOptions = [], onPick, onClose }) => {
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sheets || [])
      .filter(s => s && s.status !== 'dropped')
      .filter(s => !q || [s.fabricName, s.articleNo, s.eztexOrderNo, s.devOrderNo]
        .some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => compareArticle(a.articleNo, b.articleNo)
        || String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }, [sheets, search]);

  const pick = (sheet) => {
    if (!onPick) return;
    if (onPick(sheet) !== false) onClose?.();
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8" onClose={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl mt-4 md:mt-10 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 머리 */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Copy className="w-4 h-4 text-indigo-600" /> 설계서 불러오기
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              고른 설계서의 스펙(원사·편직·염가공·후가공·원가 칸)을 지금 설계서에 복사해요. 원본은 그대로예요.
            </p>
          </div>
          <button onClick={onClose} title="닫기" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* 검색 */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              placeholder="원단명, Article, EZ-TEX O/D NO., 개발번호로 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 ring-indigo-200 outline-none"
            />
          </div>
        </div>

        {/* 목록 */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
          {candidates.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-bold">{search ? '검색된 설계서가 없어요.' : '불러올 설계서가 없어요.'}</p>
            </div>
          ) : candidates.map(sheet => {
            const sc = STAGE_COLORS[sheet.stage] || STAGE_COLORS.draft;
            const nos = [
              sheet.articleNo && `Article ${sheet.articleNo}`,
              sheet.eztexOrderNo && `EZ-TEX ${sheet.eztexOrderNo}`,
              sheet.devOrderNo && `개발 ${sheet.devOrderNo}`,
            ].filter(Boolean).join(' · ');
            const yarns = yarnSummary(sheet, yarnSelectOptions);
            return (
              <button
                key={sheet.id}
                onClick={() => pick(sheet)}
                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-extrabold text-slate-800 truncate">{sheet.fabricName || '(원단명 없음)'}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                      {STAGE_LABEL[sheet.stage] || sheet.stage || '설계서 작성'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">{nos || '번호 없음'}</div>
                  {yarns && <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={yarns}>원사: {yarns}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[11px] font-mono font-bold text-indigo-700">{sheet.costInput?.gsm || '-'}g</div>
                    <div className="text-[9px] text-slate-400" title="내폭 / 외폭">{sheet.costInput?.widthCut || '-'}/{sheet.costInput?.widthFull || '-'}"</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>

        {/* 바닥 */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          총 {candidates.length}건 · Drop된 설계서는 빼고 보여요 · 번호(개발번호·EZ-TEX·Article)·납기는 지금 설계서 것 그대로예요
        </div>
      </div>
    </ModalBackdrop>
  );
};
