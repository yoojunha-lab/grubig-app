import React from 'react';
import { Save, X, Edit2, Plus, Minus, Lock, Link as LinkIcon } from 'lucide-react';
import { DesignStepper } from '../components/design/DesignStepper';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num } from '../utils/helpers';

// 편직 조직도 관련 부호
const KNIT_SYMBOLS = ['︹', '︺', '︿', '﹀', '━', '┃', '╋', '○', '●', '◎', '△', '▽'];

/**
 * 원단 설계서 작성/편집 페이지
 * - 한 페이지에 4대 카테고리를 "설계서" 느낌으로 순차 표시
 * - 편직 조직도: 피더 1줄에 부호(Dial+Cyl 구분 내장) + 루프장
 * - 게이지/인치/침수/피더수 숫자전용
 * - 실측에 루프장 없음, 가공 후 폭·중량 = 원단 스펙
 * 
 * 두 가지 진입 경로:
 * 1) 개발 의뢰 확정 → 자동 데이터 이관
 * 2) 자체 개발 → 직접 작성
 */
export const DesignSheetPage = ({
  sheetInput,
  editingSheetId,
  handleSheetChange,
  handleSectionChange,
  handleSheetYarnChange,
  handleCostInputChange,
  handleCostNestedChange,
  handleActualDataChange,
  handleSaveSheet,
  resetSheetForm,
  advanceStage,
  getDesignCost,
  yarnSelectOptions,
  user,
  viewMode,
  setActiveTab,
  globalExchangeRate,
  devRequests
}) => {
  // === 필드 잠금 로직 ===
  // 확정 이후 → 개발번호 수정불가
  // EZ-TEX 등록 이후 → EZ-TEX 오더번호 수정불가
  // 아이템화 이후 → 전체 읽기전용
  const STAGE_ORDER = ['draft', 'confirmed', 'eztex', 'sampling', 'articled'];
  const stageIdx = STAGE_ORDER.indexOf(sheetInput.stage || 'draft');
  const isDevOrderLocked = stageIdx >= 1 || !!sheetInput.devRequestId; // 확정 이상 or 의뢰 연결
  const isEztexLocked = stageIdx >= 2; // EZ-TEX 등록 이상
  const isFullyLocked = stageIdx >= 4; // 아이템화

  // 연결된 개발의뢰 찾기
  const linkedDevReq = sheetInput.devRequestId
    ? (devRequests || []).find(d => d.id === sheetInput.devRequestId)
    : null;
  // 피더별 조직도 관리 (피더 = {symbol, loopLength, yarnSlot})
  const feeders = sheetInput.knitting?.feeders || [{ symbol: '', loopLength: '', yarnSlot: '' }];

  const handleFeederChange = (idx, field, value) => {
    const newFeeders = [...feeders];
    newFeeders[idx] = { ...newFeeders[idx], [field]: value };
    handleSectionChange('knitting', 'feeders', newFeeders);
  };

  const addFeeder = () => {
    handleSectionChange('knitting', 'feeders', [...feeders, { symbol: '', loopLength: '', yarnSlot: '' }]);
  };

  const removeFeeder = (idx) => {
    if (feeders.length <= 1) return;
    handleSectionChange('knitting', 'feeders', feeders.filter((_, i) => i !== idx));
  };

  // 부호 클릭 → 마지막 피더에 추가
  const insertSymbol = (symbol) => {
    const lastIdx = feeders.length - 1;
    const current = feeders[lastIdx]?.symbol || '';
    handleFeederChange(lastIdx, 'symbol', current + symbol);
  };

  // 불리언 토글
  const toggleBool = (section, field) => {
    handleSectionChange(section, field, !sheetInput[section]?.[field]);
  };

  // 실시간 Cost
  const costData = getDesignCost?.(sheetInput) || null;

  const handleSaveAndGo = () => {
    handleSaveSheet(user);
    setActiveTab('devStatus');
  };

  return (
    <div className="space-y-0 max-w-4xl mx-auto">
      {/* ===== 설계서 헤더 ===== */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 rounded-t-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] uppercase tracking-[0.3em] text-slate-500 font-bold">GRUBIG TRADING CO., LTD.</p>
            <h2 className="text-base font-extrabold tracking-tight">원단 설계서</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {editingSheetId ? '수정 중' : '신규 작성'}
              {sheetInput.devOrderNo && <> · <span className="font-mono text-blue-300">{sheetInput.devOrderNo}</span></>}
              {sheetInput.version > 1 && <> · <span className="text-violet-300">v{sheetInput.version}</span></>}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleSaveAndGo}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-800 text-xs font-bold rounded-lg shadow hover:bg-slate-50 active:scale-95">
              <Save className="w-3.5 h-3.5"/> 저장
            </button>
            <button onClick={() => { resetSheetForm(); setActiveTab('devStatus'); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-600">
              <X className="w-3.5 h-3.5"/> 취소
            </button>
          </div>
        </div>
      </div>

      {/* 스테퍼 */}
      <div className="bg-white border-x border-slate-200 px-4 py-2">
        <DesignStepper currentStage={sheetInput.stage || 'draft'} />
      </div>

      {/* 연결된 개발의뢰 정보 배너 */}
      {linkedDevReq && (
        <div className="bg-violet-50 border-x border-t border-violet-200 px-5 py-3">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">연결된 개발 의뢰</span>
          </div>
          <div className="flex gap-4 text-xs text-slate-600">
            <span><b className="text-violet-700">{linkedDevReq.devOrderNo}</b></span>
            <span>바이어: <b>{linkedDevReq.buyerName}</b></span>
            {linkedDevReq.targetSpec?.feeling && <span>느낌: {linkedDevReq.targetSpec.feeling}</span>}
            {linkedDevReq.targetSpec?.composition && <span>스펙: {linkedDevReq.targetSpec.composition}</span>}
          </div>
        </div>
      )}

      {/* 전체 잠금 경고 */}
      {isFullyLocked && (
        <div className="bg-amber-50 border-x border-t border-amber-200 px-5 py-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-700">아이템화 완료된 설계서입니다. 수정이 제한됩니다.</span>
        </div>
      )}

      {/* ===== 기본 정보 ===== */}
      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
          {/* 개발번호 */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">개발번호 {isDevOrderLocked && <Lock className="w-2.5 h-2.5 text-amber-500"/>}</label>
            <input type="text" name="devOrderNo" value={sheetInput.devOrderNo||''} onChange={handleSheetChange}
              placeholder="F-26D001" readOnly={isDevOrderLocked}
              className={`w-full bg-transparent border-none p-0 text-xs font-mono font-bold uppercase outline-none ${isDevOrderLocked?'text-slate-500 cursor-not-allowed':'placeholder-slate-300'}`}/>
          </div>
          {/* EZ-TEX */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">EZ-TEX {isEztexLocked && <Lock className="w-2.5 h-2.5 text-amber-500"/>}</label>
            <input type="text" name="eztexOrderNo" value={sheetInput.eztexOrderNo||''} onChange={handleSheetChange}
              placeholder="EZ-TEX 등록 시" readOnly={isEztexLocked||isFullyLocked}
              className={`w-full bg-transparent border-none p-0 text-xs font-mono font-bold uppercase outline-none ${isEztexLocked?'text-slate-500 cursor-not-allowed':'placeholder-slate-300'}`}/>
          </div>
          {/* Article */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">Article No.</label>
            <input type="text" name="articleNo" value={sheetInput.articleNo||''} onChange={handleSheetChange}
              placeholder="아이템화 시" readOnly={isFullyLocked}
              className={`w-full bg-transparent border-none p-0 text-xs font-mono font-bold uppercase outline-none ${isFullyLocked?'text-slate-500 cursor-not-allowed':'placeholder-slate-300'}`}/>
          </div>
          {/* Buyer */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">Buyer</label>
            <input type="text" name="buyerName" value={sheetInput.buyerName||''} onChange={handleSheetChange}
              placeholder="바이어명" readOnly={isFullyLocked}
              className="w-full bg-transparent border-none p-0 text-xs font-bold uppercase outline-none placeholder-slate-300"/>
          </div>
          {/* 원단명 */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">원단명</label>
            <input type="text" name="fabricName" value={sheetInput.fabricName||''} onChange={handleSheetChange}
              placeholder="예: Wool Interlock" readOnly={isFullyLocked}
              className="w-full bg-transparent border-none p-0 text-xs font-bold outline-none placeholder-slate-300"/>
          </div>
          {/* 담당자 */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">담당자</label>
            <input type="text" name="assignee" value={sheetInput.assignee||''} onChange={handleSheetChange}
              placeholder="담당자"
              className="w-full bg-transparent border-none p-0 text-xs outline-none placeholder-slate-300"/>
          </div>
          {/* Version */}
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">Version</label>
            <span className="text-xs font-mono font-bold text-slate-600">v{sheetInput.version || 1}</span>
          </div>
        </div>
      </div>

      {/* ===== 1. 원사 정보 ===== */}
      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">1. 원사 정보 <span className="text-slate-400 font-normal">Yarn</span></h3>
        <div className="space-y-2">
          {[0, 1, 2, 3].map(idx => (
            <div key={idx} className="flex items-center gap-3 border-b border-dotted border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-slate-400 w-6 text-center">#{idx + 1}</span>
              <div className="flex-1">
                <SearchableSelect
                  options={yarnSelectOptions}
                  value={sheetInput.yarns?.[idx]?.yarnId || ''}
                  onChange={(val) => handleSheetYarnChange(idx, 'yarnId', val)}
                  placeholder="원사 검색..."
                />
              </div>
              <div className="w-16 shrink-0">
                <input type="number" value={sheetInput.yarns?.[idx]?.ratio || 0}
                  onChange={(e) => handleSheetYarnChange(idx, 'ratio', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm text-center font-bold focus:ring-1 ring-blue-300 outline-none" min="0" max="100" />
              </div>
              <span className="text-[10px] text-slate-400 w-4">%</span>
            </div>
          ))}
          {(() => {
            const total = (sheetInput.yarns || []).reduce((s, y) => s + (Number(y?.ratio) || 0), 0);
            if (total > 0 && total !== 100) return <p className="text-xs text-red-500 font-bold mt-1">⚠ 합계: {total}% (100%가 되어야 합니다)</p>;
            if (total === 100) return <p className="text-xs text-emerald-600 font-bold mt-1">✓ 합계: 100%</p>;
            return null;
          })()}
        </div>
      </div>

      {/* ===== 2. 편직 정보 ===== */}
      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">2. 편직 정보 <span className="text-slate-400 font-normal">Knitting</span></h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-3">
          <div className="border-b border-dashed border-slate-200 pb-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">편직처</label>
            <input type="text" value={sheetInput.knitting?.factory || ''}
              onChange={(e) => handleSectionChange('knitting', 'factory', e.target.value)}
              placeholder="공장명" className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300" />
          </div>
          <div className="border-b border-dashed border-slate-200 pb-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">조직</label>
            <input type="text" value={sheetInput.knitting?.structure || ''}
              onChange={(e) => handleSectionChange('knitting', 'structure', e.target.value)}
              placeholder="인터로크, 싱글저지" className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300" />
          </div>
          <div className="border-b border-dashed border-slate-200 pb-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">기종</label>
            <input type="text" value={sheetInput.knitting?.machineType || ''}
              onChange={(e) => handleSectionChange('knitting', 'machineType', e.target.value)}
              placeholder="환편기, 횡편기" className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300" />
          </div>
          {/* 숫자 전용 */}
          {[
            { field: 'gauge', label: 'GAUGE (G)', placeholder: '28' },
            { field: 'machineInch', label: 'MACHINE INCH', placeholder: '30' },
            { field: 'needleCount', label: '침수 NEEDLE', placeholder: '2640' },
            { field: 'feederCount', label: '피더수 FEEDER', placeholder: '96' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="border-b border-dashed border-slate-200 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</label>
              <input type="number" value={sheetInput.knitting?.[field] || ''}
                onChange={(e) => handleSectionChange('knitting', field, e.target.value)}
                placeholder={placeholder} min="0"
                className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold outline-none placeholder-slate-300" />
            </div>
          ))}
          <div className="flex items-end gap-4 pb-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={sheetInput.knitting?.hasOpenWidth || false}
                onChange={() => toggleBool('knitting', 'hasOpenWidth')}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600" />
              <span className="text-xs font-bold text-slate-600">개폭선</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={sheetInput.knitting?.isOpenWidth || false}
                onChange={() => toggleBool('knitting', 'isOpenWidth')}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600" />
              <span className="text-xs font-bold text-slate-600">오픈개폭</span>
            </label>
          </div>
        </div>

        {/* 피더별 조직도 */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">조직도 · Structure Diagram</h4>
            <button onClick={addFeeder}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors border border-blue-200">
              <Plus className="w-3 h-3" /> 피더 추가
            </button>
          </div>

          {/* 부호 팔레트 */}
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="text-[9px] text-slate-400 font-bold self-center mr-1">부호</span>
            {KNIT_SYMBOLS.map(sym => (
              <button key={sym} type="button" onClick={() => insertSymbol(sym)}
                className="w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors">
                {sym}
              </button>
            ))}
          </div>

          {/* 피더 테이블 (Dial/Cyl 통합 — 부호 안에 이미 구분됨) */}
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-1 text-[9px] font-bold text-slate-400 uppercase px-1">
              <div className="col-span-1">F#</div>
              <div className="col-span-2">원사</div>
              <div className="col-span-7">조직 부호 (Dial·Cylinder)</div>
              <div className="col-span-1">루프장</div>
              <div className="col-span-1"></div>
            </div>
            {feeders.map((feeder, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-white p-1.5 rounded border border-slate-200">
                <div className="col-span-1">
                  <span className="text-[10px] font-mono font-bold text-slate-500">{idx + 1}</span>
                </div>
                <div className="col-span-2">
                  <select value={feeder.yarnSlot || ''}
                    onChange={(e) => handleFeederChange(idx, 'yarnSlot', e.target.value)}
                    className="w-full border border-slate-200 rounded px-1 py-1 text-[10px] focus:ring-1 ring-blue-200 outline-none bg-white">
                    <option value="">-</option>
                    <option value="1">#1</option>
                    <option value="2">#2</option>
                    <option value="3">#3</option>
                    <option value="4">#4</option>
                  </select>
                </div>
                <div className="col-span-7">
                  <input type="text" value={feeder.symbol || ''} placeholder="부호 입력 (예: ︹━━︺)"
                    onChange={(e) => handleFeederChange(idx, 'symbol', e.target.value)}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm font-mono focus:ring-1 ring-blue-200 outline-none text-center" />
                </div>
                <div className="col-span-1">
                  <input type="text" value={feeder.loopLength || ''} placeholder="L/L"
                    onChange={(e) => handleFeederChange(idx, 'loopLength', e.target.value)}
                    className="w-full border border-slate-200 rounded px-1 py-1 text-[10px] font-mono focus:ring-1 ring-blue-200 outline-none text-center" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => removeFeeder(idx)} disabled={feeders.length <= 1}
                    className="p-0.5 text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 편직 특이사항 */}
        <div className="mt-3 border-b border-dashed border-slate-200 pb-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">특이사항</label>
          <textarea value={sheetInput.knitting?.remarks || ''}
            onChange={(e) => handleSectionChange('knitting', 'remarks', e.target.value)}
            placeholder="편직 시 특이사항..." rows={2}
            className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300 resize-none" />
        </div>
      </div>

      {/* ===== 3. 염가공 정보 ===== */}
      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">3. 염가공 <span className="text-slate-400 font-normal">Dyeing</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          {[
            { field: 'factory', label: '염가공처', placeholder: '공장명' },
            { field: 'dyedWidth', label: '염색 후 폭', placeholder: '56인치' },
            { field: 'tenterWidth', label: '텐타 기계폭', placeholder: '60인치' },
            { field: 'tenterTemp', label: '텐타 온도', placeholder: '180℃' },
            { field: 'fabricSpeed', label: '포속', placeholder: '20m/min' },
            { field: 'overFeeder', label: '오버 피더', placeholder: '+5%' },
            { field: 'processMethod', label: '가공방법', placeholder: '릴렉스 → 텐타' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="border-b border-dashed border-slate-200 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</label>
              <input type="text" value={sheetInput.dyeing?.[field] || ''}
                onChange={(e) => handleSectionChange('dyeing', field, e.target.value)}
                placeholder={placeholder} className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300" />
            </div>
          ))}
        </div>
        <div className="mt-3 border-b border-dashed border-slate-200 pb-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">특이사항</label>
          <textarea value={sheetInput.dyeing?.remarks || ''}
            onChange={(e) => handleSectionChange('dyeing', 'remarks', e.target.value)}
            placeholder="가공 시 특이사항..." rows={2}
            className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300 resize-none" />
        </div>
      </div>

      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">4. 후가공 <span className="text-slate-400 font-normal">Post</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          {[
            { field: 'factory', label: '후가공 업체', placeholder: '업체명' },
            { field: 'type', label: '종류', placeholder: '기모, 피치스킨' },
            { field: 'method', label: '방법', placeholder: '양면기모 2회' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="border-b border-dashed border-slate-200 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</label>
              <input type="text" value={sheetInput.finishing?.[field] || ''}
                onChange={(e) => handleSectionChange('finishing', field, e.target.value)}
                placeholder={placeholder} className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300" />
            </div>
          ))}
        </div>
        <div className="mt-3 border-b border-dashed border-slate-200 pb-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">특이사항</label>
          <textarea value={sheetInput.finishing?.remarks || ''}
            onChange={(e) => handleSectionChange('finishing', 'remarks', e.target.value)}
            placeholder="후가공 특이사항..." rows={2}
            className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300 resize-none" />
        </div>
      </div>

      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">5. 실측 <span className="text-slate-400 font-normal">Actual</span></h3>
        <p className="text-[9px] text-slate-400 mb-2">가공 후 실측값 → 원단 최종 스펙</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
          <div className="border-b border-dashed border-slate-200 pb-1">
            <label className="block text-[9px] font-bold text-slate-400 uppercase">생지 중량 (G/YD)</label>
            <input type="text" value={sheetInput.actualData?.greigeWeight || ''}
              onChange={(e) => handleActualDataChange('greigeWeight', e.target.value)}
              placeholder="320" className="w-full bg-transparent border-none p-0 text-xs font-mono outline-none placeholder-slate-300" />
          </div>
          <div className="border-b border-dashed border-blue-300 pb-1 bg-blue-50/50 -mx-0.5 px-0.5 rounded">
            <label className="block text-[9px] font-bold text-blue-600 uppercase">내폭 (INCH)</label>
            <input type="number" value={sheetInput.actualData?.finishedWidthCut || ''}
              onChange={(e) => handleActualDataChange('finishedWidthCut', e.target.value)}
              placeholder="56" className="w-full bg-transparent border-none p-0 text-xs font-mono font-bold outline-none placeholder-blue-300" />
          </div>
          <div className="border-b border-dashed border-blue-300 pb-1 bg-blue-50/50 -mx-0.5 px-0.5 rounded">
            <label className="block text-[9px] font-bold text-blue-600 uppercase">외폭 (INCH)</label>
            <input type="number" value={sheetInput.actualData?.finishedWidthFull || ''}
              onChange={(e) => handleActualDataChange('finishedWidthFull', e.target.value)}
              placeholder="58" className="w-full bg-transparent border-none p-0 text-xs font-mono font-bold outline-none placeholder-blue-300" />
          </div>
          <div className="border-b border-dashed border-blue-300 pb-1 bg-blue-50/50 -mx-0.5 px-0.5 rounded">
            <label className="block text-[9px] font-bold text-blue-600 uppercase">GSM (G/M²)</label>
            <input type="number" value={sheetInput.actualData?.finishedGsm || ''}
              onChange={(e) => handleActualDataChange('finishedGsm', e.target.value)}
              placeholder="300" className="w-full bg-transparent border-none p-0 text-xs font-mono font-bold outline-none placeholder-blue-300" />
          </div>
        </div>
        <div className="mt-3 border-b border-dashed border-slate-200 pb-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">메모</label>
          <textarea value={sheetInput.actualData?.remarks || ''}
            onChange={(e) => handleActualDataChange('remarks', e.target.value)}
            placeholder="실측 관련 메모..." rows={1}
            className="w-full bg-transparent border-none p-0 text-sm outline-none placeholder-slate-300 resize-none" />
        </div>
      </div>

      <div className="bg-white border-x border-t border-slate-200 px-4 py-3">
        <h3 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider border-b-2 border-slate-800 pb-0.5 mb-3 inline-block">6. 단가 <span className="text-slate-400 font-normal">Cost</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-2">
          {[
            { name: 'widthFull', label: '외폭 "', placeholder: '58' },
            { name: 'widthCut', label: '내폭 "', placeholder: '56' },
            { name: 'gsm', label: 'GSM', placeholder: '300' },
            { name: 'costGYd', label: 'G/YD 수동', placeholder: '' },
          ].map(({ name, label, placeholder }) => (
            <div key={name} className="border-b border-dashed border-slate-200 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</label>
              <input type="number" name={name} value={sheetInput.costInput?.[name] ?? ''}
                onChange={handleCostInputChange} placeholder={placeholder}
                className="w-full bg-transparent border-none p-0 text-sm text-right font-mono font-bold outline-none placeholder-slate-300" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          {[
            { name: 'knittingFee1k', label: '편직비 1K' },
            { name: 'knittingFee3k', label: '편직비 3K' },
            { name: 'knittingFee5k', label: '편직비 5K' },
            { name: 'dyeingFee', label: '염가공비' },
            { name: 'extraFee1k', label: '부대비 1K' },
            { name: 'extraFee3k', label: '부대비 3K' },
            { name: 'extraFee5k', label: '부대비 5K' },
          ].map(({ name, label }) => (
            <div key={name} className="border-b border-dashed border-slate-200 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</label>
              <input type="number" name={name} value={sheetInput.costInput?.[name] ?? ''}
                onChange={handleCostInputChange}
                className="w-full bg-transparent border-none p-0 text-sm text-right font-mono font-bold outline-none placeholder-slate-300" />
            </div>
          ))}
        </div>
      </div>

      {/* ===== 실시간 단가 미리보기 (하단 바) ===== */}
      {costData && (
        <div className="bg-slate-900 border-x border-slate-200 p-4">
          <div className="grid grid-cols-3 gap-4 text-white">
            {[
              { label: '1,000 YDS', tier: 'tier1k' },
              { label: '3,000 YDS', tier: 'tier3k' },
              { label: '5,000 YDS', tier: 'tier5k' },
            ].map(({ label, tier }) => {
              const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
              const prefix = viewMode === 'export' ? '$' : '₩';
              return (
                <div key={tier} className="text-center">
                  <p className="text-[9px] text-slate-400 font-bold">{label}</p>
                  <p className="text-lg font-extrabold">{prefix}{viewMode === 'export' ? (data?.priceBrand || 0).toFixed(2) : num(data?.priceBrand || 0)}</p>
                  <p className="text-[9px] text-slate-500">원가 {prefix}{viewMode === 'export' ? (data?.totalCostYd || 0).toFixed(2) : num(data?.totalCostYd || 0)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 하단 마감선 */}
      <div className="bg-gradient-to-r from-slate-800 to-indigo-900 rounded-b-xl px-4 py-2 flex justify-between items-center">
        <p className="text-[9px] text-slate-500 font-mono">GRUBIG TRADING CO., LTD.</p>
        <button onClick={handleSaveAndGo}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg shadow hover:bg-slate-50 active:scale-95">
          <Save className="w-3 h-3"/> 저장
        </button>
      </div>
    </div>
  );
};
