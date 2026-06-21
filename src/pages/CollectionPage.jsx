import React, { useState, useMemo } from 'react';
import {
  Boxes, Plus, Edit2, Trash2, X, Calendar, Tag, Package,
  Search, Users, FolderPlus, ChevronRight, AlertTriangle, FileSpreadsheet, Printer,
  ChevronUp, ChevronDown, StickyNote,
} from 'lucide-react';
import { AddArticleModal } from '../components/collection/AddArticleModal';
import { CollectionPrintSheet } from '../components/collection/CollectionPrintSheet';

// 컬렉션 분류 태그 (필터 + 배지 색상)
const COLLECTION_TYPES = [
  { key: '시즌',   cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: '전시회', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: '바이어', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: '월별',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: '기타',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
];
const getTypeCls = (type) => COLLECTION_TYPES.find(t => t.key === type)?.cls || COLLECTION_TYPES[4].cls;

export const CollectionPage = ({
  collections = [],
  savedFabrics = [],
  yarnLibrary = [],
  isXlsxReady = false,
  showToast = () => {},
  // 훅에서 내려오는 값/함수
  collectionInput,
  editingCollectionId,
  handleCollectionChange,
  resetCollectionForm,
  handleSaveCollection,
  handleEditCollection,
  handleDeleteCollection,
  addArticlesToCollection,
  removeArticleFromCollection,
  updateArticleMemo = () => {},
  moveArticle = () => {},
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [filterType, setFilterType] = useState('전체');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // 원사 조성 문자열
  const getComposition = (fabric) => {
    return (fabric?.yarns || [])
      .filter(y => y.yarnId && Number(y.ratio) > 0)
      .map(y => {
        const realYarnId = String(y.yarnId).split('::')[0];
        const realYarn = (yarnLibrary || []).find(yl => String(yl.id) === String(realYarnId));
        const name = realYarn?.name || y.tempName || '미등록';
        return `${name} ${y.ratio}%`;
      })
      .join(' / ');
  };

  // 분류 필터 적용 + 최신순 정렬
  const filteredCollections = useMemo(() => {
    const list = (collections || []).filter(c => filterType === '전체' || c.type === filterType);
    return [...list].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [collections, filterType]);

  // 선택된 컬렉션 (라이브 데이터 기준)
  const selectedCol = useMemo(
    () => (collections || []).find(c => c.id === selectedId) || null,
    [collections, selectedId]
  );

  const existingFabricIds = useMemo(
    () => (selectedCol?.items || []).map(it => it.fabricId),
    [selectedCol]
  );

  // 새 컬렉션 만들기
  const openCreateForm = () => {
    resetCollectionForm();
    setIsFormOpen(true);
  };
  // 컬렉션 수정
  const openEditForm = (id) => {
    handleEditCollection(id);
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    resetCollectionForm();
  };
  const submitForm = () => {
    const savedId = handleSaveCollection();
    if (savedId) {
      setSelectedId(savedId);   // 저장된(또는 수정된) 컬렉션 자동 선택
      setIsFormOpen(false);
    }
  };

  const onConfirmAddArticles = (selectedFabrics) => {
    if (selectedCol) addArticlesToCollection(selectedCol.id, selectedFabrics);
    setIsAddOpen(false);
  };

  // 선택 컬렉션을 엑셀(.xlsx)로 내보내기 (바이어 제시용 라인시트 — 단가 제외, 스펙만)
  const handleExport = () => {
    if (!isXlsxReady || !window.XLSX) {
      showToast('엑셀 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }
    if (!selectedCol) return;
    const items = selectedCol.items || [];
    if (items.length === 0) {
      showToast('담긴 아티클이 없습니다.', 'error');
      return;
    }

    const rows = items.map((item, idx) => {
      const fabric = (savedFabrics || []).find(f => String(f.id) === String(item.fabricId));
      return {
        'No': idx + 1,
        'Article': (fabric?.article) || item.article || '',
        '아이템명': (fabric?.itemName) || item.itemName || '',
        '조성': fabric ? getComposition(fabric) : '',
        '전폭(inch)': fabric?.widthFull ?? '',
        '가공폭(inch)': fabric?.widthCut ?? '',
        'GSM': fabric?.gsm ?? '',
        '메모': item.memo || '',
        '비고': fabric ? (fabric.remarks || '') : '원단 삭제됨',
      };
    });

    // 상단 메타(컬렉션명/분류/기준일/바이어) + 빈 줄 + 표(A4부터)
    const meta = [
      [`컬렉션: ${selectedCol.name || ''}`],
      [`분류: ${selectedCol.type || ''}    기준일: ${selectedCol.date || ''}    바이어: ${selectedCol.buyer || ''}`],
      [],
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(meta);
    window.XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' });
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 24 }, { wch: 34 }, { wch: 11 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 24 }];

    const wb = window.XLSX.utils.book_new();
    const safeSheet = String(selectedCol.name || 'Collection').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Collection';
    window.XLSX.utils.book_append_sheet(wb, ws, safeSheet);
    const safeName = String(selectedCol.name || 'Collection').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'Collection';
    window.XLSX.writeFile(wb, `${safeName}.xlsx`);
    showToast(`${rows.length}개 아티클을 엑셀로 내보냈습니다.`, 'success');
  };

  // 선택 컬렉션을 PDF(인쇄)로 — 견적서와 동일한 native window.print() 방식
  const handlePrintPDF = () => {
    if (!selectedCol) return;
    if ((selectedCol.items || []).length === 0) {
      showToast('담긴 아티클이 없습니다.', 'error');
      return;
    }
    showToast("인쇄 다이얼로그에서 '대상 = PDF로 저장'을 선택해 주세요.", 'info');
    const oldTitle = document.title;
    const safeName = String(selectedCol.name || 'Collection').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'Collection';
    // CollectionPrintSheet(off-screen)가 인쇄 시 노출되도록 body 클래스 토글
    document.body.classList.add('printing-collection');
    setTimeout(() => {
      try {
        document.title = `Collection_${safeName}`;
        window.print();
      } finally {
        document.title = oldTitle;
        document.body.classList.remove('printing-collection');
      }
    }, 100);
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full print:hidden">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Boxes className="w-7 h-7 text-indigo-600" /> 컬렉션 관리
          <span className="text-base font-bold text-slate-400">({(collections || []).length})</span>
        </h2>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-indigo-600 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> 새 컬렉션
        </button>
      </div>

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['전체', ...COLLECTION_TYPES.map(t => t.key)].map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
              filterType === t
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* ───────── 좌측: 컬렉션 목록 ───────── */}
        <div className="space-y-3">
          {filteredCollections.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
              <div className="bg-indigo-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                <FolderPlus className="w-7 h-7 text-indigo-400" />
              </div>
              <p className="text-sm font-extrabold text-slate-700 mb-1">컬렉션이 없습니다.</p>
              <p className="text-[11px] text-slate-400 mb-4">새 컬렉션을 만들어 아티클을 모아보세요.</p>
              <button onClick={openCreateForm} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">+ 새 컬렉션 만들기</button>
            </div>
          )}

          {filteredCollections.map(col => {
            const isActive = selectedId === col.id;
            const count = (col.items || []).length;
            return (
              <div
                key={col.id}
                onClick={() => setSelectedId(col.id)}
                className={`group bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                  isActive
                    ? 'border-indigo-400 ring-2 ring-indigo-400/40 shadow-md'
                    : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeCls(col.type)}`}>{col.type || '기타'}</span>
                    </div>
                    <h3 className="font-extrabold text-slate-800 leading-tight truncate">{col.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEditForm(col.id); }} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id); }} className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {count}개</span>
                  {col.date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {col.date}</span>}
                  {col.buyer && <span className="flex items-center gap-1 truncate"><Users className="w-3.5 h-3.5" /> {col.buyer}</span>}
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${isActive ? 'text-indigo-500 translate-x-0.5' : 'text-slate-300'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ───────── 우측: 선택 컬렉션 상세 ───────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[60vh]">
          {!selectedCol ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 text-slate-400 min-h-[60vh]">
              <Boxes className="w-14 h-14 mb-4 text-slate-200" />
              <p className="text-sm font-bold text-slate-500">왼쪽에서 컬렉션을 선택하세요.</p>
              <p className="text-[11px] mt-1">선택한 컬렉션의 아티클 목록이 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* 상세 헤더 */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeCls(selectedCol.type)}`}>{selectedCol.type || '기타'}</span>
                      {selectedCol.eventName && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Tag className="w-3 h-3" /> {selectedCol.eventName}</span>}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-800">{selectedCol.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                      {selectedCol.date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedCol.date}</span>}
                      {selectedCol.buyer && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {selectedCol.buyer}</span>}
                      <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> 아티클 {(selectedCol.items || []).length}개</span>
                    </div>
                    {selectedCol.description && (
                      <p className="text-xs text-slate-500 mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">{selectedCol.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleExport}
                      disabled={(selectedCol.items || []).length === 0}
                      title="엑셀로 내보내기"
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-bold rounded-lg shadow-sm transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> 엑셀
                    </button>
                    <button
                      onClick={handlePrintPDF}
                      disabled={(selectedCol.items || []).length === 0}
                      title="PDF로 내보내기 (인쇄)"
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-bold rounded-lg shadow-sm transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Printer className="w-4 h-4" /> PDF
                    </button>
                    <button
                      onClick={() => setIsAddOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> 아티클 추가
                    </button>
                  </div>
                </div>
              </div>

              {/* 아티클 목록 */}
              <div className="p-4 space-y-2 flex-1">
                {(selectedCol.items || []).length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-500 mb-1">담긴 아티클이 없습니다.</p>
                    <p className="text-[11px]">[아티클 추가]를 눌러 원단 리스트에서 선택하세요.</p>
                  </div>
                )}

                {(selectedCol.items || []).map((item, idx) => {
                  // 라이브 원단 참조 (스펙 최신 반영). 없으면 저장된 스냅샷 + 삭제 표시
                  const fabric = (savedFabrics || []).find(f => String(f.id) === String(item.fabricId));
                  const composition = fabric ? getComposition(fabric) : '';
                  const isMissing = !fabric;
                  const isLast = idx === (selectedCol.items || []).length - 1;
                  return (
                    <div
                      key={item.fabricId || idx}
                      className={`p-3 rounded-xl border transition-colors ${
                        isMissing ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center text-xs font-bold text-slate-300 shrink-0">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 uppercase tracking-tight truncate">{item.article || '(번호없음)'}</span>
                            {isMissing && (
                              <span title="원단 리스트에서 삭제된 아티클입니다" className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> 원단 삭제됨
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{(fabric?.itemName) || item.itemName || '-'}</div>
                          {composition && (
                            <div className="text-[11px] text-indigo-600/80 font-medium truncate mt-0.5">{composition}</div>
                          )}
                        </div>
                        {fabric && (
                          <div className="text-right shrink-0 font-mono text-[11px] text-slate-400 hidden sm:block">
                            <div>{fabric.widthCut}/{fabric.widthFull}"</div>
                            <div>{fabric.gsm}g</div>
                          </div>
                        )}
                        {/* 순서 이동 + 삭제 */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <div className="flex flex-col">
                            <button onClick={() => moveArticle(selectedCol.id, item.fabricId, 'up')} disabled={idx === 0} title="위로" className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveArticle(selectedCol.id, item.fabricId, 'down')} disabled={isLast} title="아래로" className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"><ChevronDown className="w-4 h-4" /></button>
                          </div>
                          <button
                            onClick={() => removeArticleFromCollection(selectedCol.id, item.fabricId)}
                            title="컬렉션에서 빼기"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {/* 메모 입력 (blur 시 저장) */}
                      <div className="flex items-center gap-1.5 mt-2 pl-9">
                        <StickyNote className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <input
                          type="text"
                          defaultValue={item.memo || ''}
                          onBlur={(e) => updateArticleMemo(selectedCol.id, item.fabricId, e.target.value)}
                          placeholder="메모 (예: 베스트셀러, 바이어 요청 컬러)"
                          className="w-full text-xs bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-400 outline-none py-0.5 text-slate-600 placeholder:text-slate-300 transition-colors"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 아티클 추가 모달 */}
      <AddArticleModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        fabrics={savedFabrics}
        existingFabricIds={existingFabricIds}
        yarnLibrary={yarnLibrary}
        collectionName={selectedCol?.name || ''}
        onConfirm={onConfirmAddArticles}
      />

      {/* PDF 인쇄용 라인시트 (화면 밖, 인쇄 시에만 노출) */}
      <CollectionPrintSheet
        collection={selectedCol}
        savedFabrics={savedFabrics}
        getComposition={getComposition}
      />

      {/* 컬렉션 생성/수정 모달 */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600" />
                {editingCollectionId ? '컬렉션 수정' : '새 컬렉션'}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">컬렉션 이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={collectionInput.name}
                  onChange={handleCollectionChange}
                  placeholder="예: 2026 6월 S/S Collection"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  autoFocus
                />
              </div>

              {/* 분류 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">분류</label>
                <div className="flex flex-wrap gap-2">
                  {COLLECTION_TYPES.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleCollectionChange({ target: { name: 'type', value: t.key } })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        collectionInput.type === t.key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {t.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 기준일 */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">기준일</label>
                  <input
                    type="date"
                    name="date"
                    value={collectionInput.date}
                    onChange={handleCollectionChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
                {/* 바이어 */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">바이어 (선택)</label>
                  <input
                    type="text"
                    name="buyer"
                    value={collectionInput.buyer}
                    onChange={handleCollectionChange}
                    placeholder="바이어명"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              </div>

              {/* 전시회/행사명 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">전시회/행사명 (선택)</label>
                <input
                  type="text"
                  name="eventName"
                  value={collectionInput.eventName}
                  onChange={handleCollectionChange}
                  placeholder="예: F.F.F 전시회"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">메모 (선택)</label>
                <textarea
                  name="description"
                  value={collectionInput.description}
                  onChange={handleCollectionChange}
                  rows={2}
                  placeholder="컬렉션 설명이나 메모"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={closeForm} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">취소</button>
              <button
                onClick={submitForm}
                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors active:scale-95"
              >
                {editingCollectionId ? '저장' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
