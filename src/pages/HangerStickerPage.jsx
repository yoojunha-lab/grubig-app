import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Plus, Download, Search, Loader2, Printer, QrCode } from 'lucide-react';
import { StickerEditModal } from '../components/sticker/StickerEditModal';
import { sortStickers, stickerMatches, stickerFabricDiffs, qrShortLabel } from '../utils/hangerSticker';
import { formatMonthDay } from '../utils/helpers';

// ============================================================
// 기타 ▾ 헹거 스티커 (대표님 요청 2026-10-14)
//  · 저장된 스티커 목록 — 체크해서 [엑셀 다운로드] (TAG 엑셀 양식 그대로, 1장 = 시트 1장, ART 순서)
//  · [+ 스티커 만들기] / 줄을 누르면 입력 창 (components/sticker/StickerEditModal — 오른쪽에 미리보기)
//  · 아이템(원단 관리)의 폭·중량이 바뀌어 스티커와 다르면 '아이템과 다름' 표시
//  · 저장·삭제·엑셀 만들기는 hooks/domains/useHangerSticker.js (Firestore hangerStickers)
// ============================================================

const Badge = ({ tone, title, children }) => {
  const cls = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-100 text-slate-500 border-slate-200',
  }[tone];
  return <span title={title} className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>{children}</span>;
};

// 아이템 연결 상태 — 아이템 정보와 다른 칸 / 연결된 아이템이 없어짐
const ItemBadges = ({ sticker, fabric }) => {
  if (sticker.fabricId && !fabric) return <Badge tone="slate" title="연결된 아이템을 원단 관리에서 찾을 수 없어요 (지워졌을 수 있어요)">아이템 없음</Badge>;
  const diffs = stickerFabricDiffs(sticker, fabric);
  if (diffs.length === 0) return null;
  return (
    <Badge tone="amber" title={`아이템 정보와 달라요 — 스티커를 열어 [아이템 정보 다시 불러오기]\n${diffs.map(d => `${d.label}: 스티커 ${d.sticker || '(빈 칸)'} · 아이템 ${d.item}`).join('\n')}`}>
      아이템과 다름
    </Badge>
  );
};

const QrBadge = ({ qr }) => (String(qr || '').trim()
  ? <Badge tone="emerald" title={qr}><QrCode className="w-3 h-3" /> {qrShortLabel(qr).slice(0, 12)}</Badge>
  : <Badge tone="amber" title="QR이 없으면 엑셀에서 QR 자리를 비워요">QR 없음</Badge>);

export const HangerStickerPage = ({
  stickers = [],          // 저장된 스티커 (Firestore hangerStickers)
  savedFabrics = [],      // 아이템 (원단 관리)
  yarnLibrary = [],
  saveSticker, deleteSticker, downloadStickers,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editor, setEditor] = useState(null);      // 열려 있는 입력 창 { id: 스티커 id | null(새로), key }
  const [downloading, setDownloading] = useState(false);
  const headCheckRef = useRef(null);

  const fabricById = useMemo(() => new Map((savedFabrics || []).map(f => [String(f.id), f])), [savedFabrics]);
  const rows = useMemo(() => sortStickers(stickers).filter(s => stickerMatches(s, search)), [stickers, search]);
  // 고른 스티커 (다른 PC에서 지운 스티커는 저절로 빠짐)
  const selected = useMemo(() => stickers.filter(s => selectedIds.has(s.id)), [stickers, selectedIds]);
  const shownSelected = rows.filter(r => selectedIds.has(r.id)).length;
  const allShownSelected = rows.length > 0 && shownSelected === rows.length;

  // 머리 체크박스 — 보이는 줄 중 일부만 골랐으면 '-' 표시
  useEffect(() => {
    if (headCheckRef.current) headCheckRef.current.indeterminate = shownSelected > 0 && !allShownSelected;
  });

  const toggle = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllShown = () => setSelectedIds(prev => {
    const next = new Set(prev);
    rows.forEach(r => { if (allShownSelected) next.delete(r.id); else next.add(r.id); });
    return next;
  });

  const openEditor = (id = null) => setEditor({ id, key: `${id || 'new'}_${Date.now()}` });
  const closeEditor = () => setEditor(null);
  const handleDelete = async (id) => {
    const ok = await deleteSticker(id);
    if (ok) setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    return ok;
  };
  const handleDownload = async () => {
    if (selected.length === 0 || downloading) return;
    setDownloading(true);
    try { await downloadStickers(selected); } finally { setDownloading(false); }
  };

  return (
    <>
    <div className="max-w-[1600px] mx-auto w-full space-y-3 print:hidden">
      {/* 머리줄 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-600" /> 헹거 스티커
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">아이템을 고르면 ART · WIDTH · WEIGHT가 채워져요. 체크한 스티커를 TAG 엑셀 양식 그대로 받아요 (스티커 1장 = 시트 1장).</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => openEditor(null)}
            className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-amber-50 hover:border-amber-300 flex items-center justify-center gap-1.5 text-sm font-bold">
            <Plus className="w-4 h-4" /> 스티커 만들기
          </button>
          <button type="button" onClick={handleDownload} disabled={selected.length === 0 || downloading}
            title={selected.length === 0 ? '엑셀로 받을 스티커를 체크해 주세요' : ''}
            className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 엑셀 다운로드{selected.length > 0 ? ` (${selected.length}장)` : ''}
          </button>
        </div>
      </div>

      {/* 검색 · 고른 수 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ART · CONTENT · TYPE · QR 번호 검색"
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-200" />
        </div>
        <span className="text-xs text-slate-500">전체 {stickers.length}장{search.trim() ? ` · 찾은 ${rows.length}장` : ''}</span>
        {selected.length > 0 && (
          <span className="text-xs font-bold text-amber-700">
            {selected.length}장 고름
            <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-1.5 font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700">선택 해제</button>
          </span>
        )}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">{stickers.length === 0 ? '저장된 헹거 스티커가 없어요.' : '찾는 스티커가 없어요.'}</p>
            {stickers.length === 0 && (
              <button type="button" onClick={() => openEditor(null)}
                className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-sm font-bold">
                <Plus className="w-4 h-4" /> 첫 스티커 만들기
              </button>
            )}
          </div>
        ) : (
          <>
            {/* PC — 표 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="text-[11px] text-slate-500 bg-slate-50 border-b-2 border-slate-200">
                    <th className="w-10 px-2 py-2">
                      <input ref={headCheckRef} type="checkbox" checked={allShownSelected} onChange={toggleAllShown}
                        title="보이는 스티커 모두 고르기" className="w-4 h-4 accent-amber-600 cursor-pointer align-middle" />
                    </th>
                    <th className="text-left font-bold px-2 py-2">ART.</th>
                    <th className="text-left font-bold px-2 py-2">제목</th>
                    <th className="text-left font-bold px-2 py-2">CONTENT</th>
                    <th className="text-left font-bold px-2 py-2">TYPE</th>
                    <th className="text-left font-bold px-2 py-2">WIDTH</th>
                    <th className="text-left font-bold px-2 py-2">WEIGHT</th>
                    <th className="text-left font-bold px-2 py-2">CARE</th>
                    <th className="text-left font-bold px-2 py-2">QR</th>
                    <th className="text-left font-bold px-2 py-2">아래 설명</th>
                    <th className="text-right font-bold px-2 py-2">수정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(s => {
                    const checked = selectedIds.has(s.id);
                    return (
                      <tr key={s.id} onClick={() => openEditor(s.id)}
                        className={`cursor-pointer transition-colors ${checked ? 'bg-amber-50/70' : 'hover:bg-slate-50'}`}>
                        <td className="px-2 py-0" onClick={e => e.stopPropagation()}>
                          <label className="flex items-center justify-center py-2.5 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={() => toggle(s.id)} className="w-4 h-4 accent-amber-600 cursor-pointer" />
                          </label>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800">{s.art || '(ART 없음)'}</span>
                            <ItemBadges sticker={s} fabric={s.fabricId ? fabricById.get(String(s.fabricId)) : null} />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600 max-w-[140px] truncate" title={s.title}>{s.title || '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-700 max-w-[240px] truncate" title={s.content}>{s.content || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2 text-xs text-slate-700 whitespace-nowrap">{s.type || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2 text-xs font-mono text-slate-700 whitespace-nowrap">{s.width || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2 text-xs text-slate-700 whitespace-nowrap">{s.weight || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2 text-xs text-slate-600 whitespace-nowrap">{s.care || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2"><QrBadge qr={s.qr} /></td>
                        <td className="px-2 py-2 text-[11px] text-slate-500 max-w-[200px] truncate" title={s.note}>{s.note || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-2 text-[10px] text-slate-400 text-right whitespace-nowrap">
                          {formatMonthDay(s.updatedAt)}{s.updatedBy ? ` · ${s.updatedBy}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 휴대폰 — 카드 */}
            <div className="md:hidden divide-y divide-slate-100">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-xs font-bold text-slate-500">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="w-4 h-4 accent-amber-600" /> 보이는 스티커 모두 고르기
              </label>
              {rows.map(s => {
                const checked = selectedIds.has(s.id);
                return (
                  <div key={s.id} onClick={() => openEditor(s.id)} className={`flex gap-3 px-3 py-2.5 cursor-pointer ${checked ? 'bg-amber-50/70' : ''}`}>
                    <label className="pt-0.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(s.id)} className="w-5 h-5 accent-amber-600" />
                    </label>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{s.art || '(ART 없음)'}</span>
                        <ItemBadges sticker={s} fabric={s.fabricId ? fabricById.get(String(s.fabricId)) : null} />
                        <QrBadge qr={s.qr} />
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{s.content || '—'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{[s.type, s.width, s.weight].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <Printer className="w-3.5 h-3.5 mt-px shrink-0" />
        여러 장을 한 번에 인쇄하려면 받은 엑셀에서 인쇄(Ctrl+P) → 설정 → &apos;전체 통합 문서 인쇄&apos;를 고르세요. 용지·여백·인쇄 영역은 TAG 양식과 같아요.
      </p>
    </div>

    {/* 입력 창 — 화면 칸(space-y) 밖에 (팝업 규약) */}
    {editor && (
      <StickerEditModal
        key={editor.key}
        stickerId={editor.id}
        stickers={stickers}
        savedFabrics={savedFabrics}
        yarnLibrary={yarnLibrary}
        onSave={saveSticker}
        onDelete={handleDelete}
        onDownload={(sticker) => downloadStickers([sticker])}
        onOpenSticker={(id) => openEditor(id)}
        onClose={closeEditor}
      />
    )}
    </>
  );
};
