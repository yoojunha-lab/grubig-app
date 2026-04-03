import React from 'react';
import { Save, X, Lock, Link as LinkIcon, Plus, Minus, FileText, Trash2, Factory, Cpu, Layers, Droplets, Check, FileCheck, CheckCircle2, XCircle } from 'lucide-react';
import { DesignStepper } from '../components/design/DesignStepper';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num, calculateGYd } from '../utils/helpers';

// 편직 조직도 관련 부호
const KNIT_SYMBOLS = ['︹', '︺', '︿', '﹀', '━', '┃', '╋', '○', '●', '◎', '△', '▽'];

// 서식용 컴포넌트
const Th = ({ children, className = "", span = 1 }) => (
  <div className={`bg-slate-100/80 border-r border-b border-slate-300 px-2 py-1.5 font-extrabold text-slate-700 text-[10px] uppercase flex items-center ${className}`} style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);
const Td = ({ children, className = "", span = 1 }) => (
  <div className={`bg-white border-r border-b border-slate-300 relative group ${className}`} style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);
const TInput = ({ ...props }) => (
  <input {...props} className={`w-full h-full min-h-[28px] bg-transparent border-none px-2 py-1 outline-none focus:bg-blue-50 focus:ring-1 ring-inset ring-blue-500 placeholder-slate-300 text-[11px] font-medium transition-colors ${props.className || ''}`} />
);
const TTextarea = ({ ...props }) => (
  <textarea {...props} className={`w-full h-full min-h-[40px] resize-none bg-transparent border-none px-2 py-1.5 outline-none focus:bg-blue-50 focus:ring-1 ring-inset ring-blue-500 placeholder-slate-300 text-[11px] font-medium transition-colors ${props.className || ''}`} />
);
const TSelect = ({ children, ...props }) => (
  <select {...props} className={`w-full h-full min-h-[28px] bg-transparent border-none px-1.5 py-1 outline-none focus:bg-blue-50 focus:ring-1 ring-inset ring-blue-500 text-[11px] font-medium cursor-pointer ${props.className || ''}`}>
    {children}
  </select>
);

/**
 * 원단 설계서 작성 문서형 페이지 (A4 명세서 레이아웃)
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
  handleDeleteSheet,
  resetSheetForm,
  advanceStage,
  getDesignCost,
  yarnSelectOptions,
  user,
  viewMode,
  setActiveTab,
  globalExchangeRate,
  devRequests,
  linkAndConfirm,
  advanceToEztex,
  closeModal,
  designSheets,
  setSheetInput,
  // 마스터 데이터 프롭스
  knittingFactories,
  dyeingFactories,
  machineTypes: machineTypesList,
  structures: structuresList,
  addMasterItem,
  setActiveMasterModal,
  savedFabrics,
  registerFabricFromSheet
}) => {
  const STAGE_ORDER = ['draft', 'eztex', 'sampling', 'articled'];
  const stageIdx = STAGE_ORDER.indexOf(sheetInput.stage || 'draft');
  const isSelfDesignSheet = !sheetInput.devRequestId;
  const isDevOrderLocked = true; // 현재 시스템에서 자체설계서는 빈칸 유지(Lock), 의뢰 연결건은 자동 부여 후 Lock
  const isEztexLocked = stageIdx >= 2;
  const isFullyLocked = stageIdx >= 3;
  const isLinkedToFabric = !!sheetInput.linkedFabricId; // 원단 연동 시 공유 변수 Lock

  const linkedDevReq = sheetInput.devRequestId ? (devRequests || []).find(d => d.id === sheetInput.devRequestId) : null;
  const feeders = sheetInput.knitting?.feeders || [{ symbol: '', loopLength: '', yarnSlot: '' }];
  const [selectedFeederIdx, setSelectedFeederIdx] = React.useState(0);

  const handleFeederChange = (idx, field, value) => {
    const newFeeders = [...feeders];
    newFeeders[idx] = { ...newFeeders[idx], [field]: value };
    handleSectionChange('knitting', 'feeders', newFeeders);
  };
  const addFeeder = () => { handleSectionChange('knitting', 'feeders', [...feeders, { symbol: '', loopLength: '', yarnSlot: '' }]); setSelectedFeederIdx(feeders.length); };
  const removeFeeder = (idx) => {
    if (feeders.length <= 1) return;
    handleSectionChange('knitting', 'feeders', feeders.filter((_, i) => i !== idx));
  };
  const insertSymbol = (symbol) => {
    const safeIdx = selectedFeederIdx < feeders.length ? selectedFeederIdx : feeders.length - 1;
    handleFeederChange(safeIdx, 'symbol', (feeders[safeIdx]?.symbol || '') + symbol);
  };
  const toggleBool = (section, field) => handleSectionChange(section, field, !sheetInput[section]?.[field]);

  const costData = getDesignCost?.(sheetInput) || null;
  // 이론 G/YD = GSM × 외폭 × 변환계수
  const theoreticalGYd = calculateGYd(Number(sheetInput.costInput?.gsm || 0), Number(sheetInput.costInput?.widthFull || 0));

  const handleSaveAndGo = () => {
    const onLink = (devReqId, sheetId) => { if (linkAndConfirm) linkAndConfirm(devReqId, sheetId); };
    const savedId = handleSaveSheet(user, onLink);
    if (!savedId) return; // 저장 실패(유효성 검사 등) 시 모달 닫지 않음
    if (closeModal) closeModal();
    else if (setActiveTab) setActiveTab('devStatus');
  };

  const getCompStatus = () => {
    const total = (sheetInput.yarns || []).reduce((s, y) => s + (Number(y?.ratio) || 0), 0);
    if (total === 0) return null;
    if (total !== 100) return <span className="text-red-500 font-extrabold ml-2 text-[10px]">⚠ 총합 {total}% (오류)</span>;
    return <span className="text-emerald-600 font-extrabold ml-2 text-[10px]">✓ 총합 100%</span>;
  };

  return (
    <div className="max-w-[1700px] xl:w-[98vw] mx-auto pb-20 px-4">

      {/* 액션 플로팅 버튼 (수정 완료용) */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 mb-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 leading-tight">원단 설계서 (Circular knit fabric)</h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">{editingSheetId ? '문서 수정 중' : '새 문서 작성'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {editingSheetId && !isFullyLocked && (
            <button onClick={() => { handleDeleteSheet(editingSheetId); if (closeModal) closeModal(); else setActiveTab('devStatus'); }} className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded shadow-sm transition-colors flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
          )}
          {editingSheetId && sheetInput?.stage === 'draft' && typeof advanceStage === 'function' && (
            <button onClick={() => advanceStage(editingSheetId)} className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded shadow-sm transition-colors flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 생산팀 이관하기</button>
          )}
          <button onClick={() => { resetSheetForm(); if (closeModal) closeModal(); else setActiveTab('devStatus'); }} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded shadow-sm transition-colors flex items-center gap-1"><X className="w-3.5 h-3.5" /> 닫기</button>
          <button onClick={handleSaveAndGo} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-md transition-colors flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> 설계서 저장</button>
        </div>
      </div>

      {/* 두 장을 나란히 배치하기 위한 Grid 컨테이너 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start w-full">

        {/* --- 1 PAGE (생산 스펙) --- */}
        <div className={`bg-white shadow-xl border border-slate-800 mx-auto w-full transition-colors flex flex-col border-t-[20px] pb-6 ${isFullyLocked ? 'bg-slate-50/50 grayscale-[20%]' : ''}`} style={{ minHeight: '297mm', padding: '10mm 15mm' }}>

        {/* 상단 제목부 */}
        <div className="text-center mb-6 pb-4 border-b-2 border-slate-800">
          <h1 className="text-3xl font-black tracking-[0.2em] text-slate-800">원단 설계서 (Circular knit fabric)</h1>
          <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-widest">Fabric Design & Production Specification</p>
        </div>

        {/* 진행 상태 바 */}
        <div className="mb-6 -mx-2">
          <DesignStepper currentStage={sheetInput.stage || 'draft'} />
        </div>

        {isFullyLocked && (
          <div className="mb-4 bg-red-50 border border-red-200 px-4 py-2 flex items-center gap-2 rounded">
            <Lock className="w-4 h-4 text-red-600" />
            <span className="text-xs font-bold text-red-700">아이템화가 완료된 문서입니다. 데이터 무결성을 위해 읽기 전용으로 표시됩니다.</span>
          </div>
        )}

        {linkedDevReq && (
          <div className="mb-4 bg-violet-50/50 border border-violet-200 px-3 py-1.5 flex items-center gap-2 text-[10px]">
            <span className="font-bold text-violet-700 bg-violet-100 px-1.5 rounded">연결 의뢰</span>
            <span className="font-mono text-violet-600 font-bold">{linkedDevReq.devOrderNo}</span>
            <span className="text-slate-600">({linkedDevReq.buyerName})</span>
            {linkedDevReq.targetSpec?.feeling && <span className="text-slate-500 ml-auto mr-2">목표 느낌: {linkedDevReq.targetSpec.feeling}</span>}
          </div>
        )}

        {/* ------------------------------------------- */}
        {/* 1. 기본 식별 정보 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block" /> 문서 식별 정보</h3>
        <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 grid grid-cols-4 md:grid-cols-8 mb-6">
          <Th span={1}>개발번호 {isDevOrderLocked && <Lock className="inline w-2.5 h-2.5 ml-1" />}</Th>
          <Td span={1}><TInput name="devOrderNo" value={sheetInput.devOrderNo || ''} onChange={handleSheetChange} readOnly={isDevOrderLocked} placeholder={isSelfDesignSheet ? '자체 설계서 (할당안됨)' : '자동 발번'} className={`font-mono font-extrabold ${isSelfDesignSheet ? 'text-slate-400 bg-slate-100' : 'text-blue-700 bg-slate-50'}`} /></Td>
          <Th span={1}>EZ-TEX NO {isEztexLocked && <Lock className="inline w-2.5 h-2.5 ml-1" />}</Th>
          <Td span={1}><TInput name="eztexOrderNo" value={sheetInput.eztexOrderNo || ''} onChange={handleSheetChange} readOnly={isEztexLocked || isFullyLocked} placeholder="품번" className={`font-mono font-extrabold text-violet-700 ${isEztexLocked ? 'bg-slate-50' : ''}`} /></Td>
          <Th span={1}>Article No. {(isFullyLocked || isLinkedToFabric) && <Lock className="inline w-2.5 h-2.5 ml-1" />}</Th>
          <Td span={1}><TInput name="articleNo" value={sheetInput.articleNo || ''} onChange={handleSheetChange} readOnly={isFullyLocked || isLinkedToFabric} placeholder="아티클" className={`font-mono font-extrabold text-emerald-700 ${(isFullyLocked || isLinkedToFabric) ? 'bg-slate-50' : ''}`} /></Td>
          <Th span={1} className="text-red-700 bg-red-50/50">샘플 납기</Th>
          <Td span={1}><TInput type="date" name="deadline" value={sheetInput.deadline || ''} onChange={handleSheetChange} readOnly={isFullyLocked} className="font-mono font-bold text-red-600" /></Td>

          <Th span={1}>원단명 (Name)</Th>
          <Td span={7}><TInput name="fabricName" value={sheetInput.fabricName || ''} onChange={handleSheetChange} readOnly={isFullyLocked} placeholder="직관적인 원단명 (예: Wool Interlock)" className="text-sm font-extrabold text-slate-900 border-b-2 focus:border-blue-400" /></Td>

          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black">내폭 (")</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="widthCut" value={sheetInput.costInput?.widthCut ?? ''} onChange={handleCostInputChange} readOnly={isFullyLocked} placeholder="56" className="text-center font-mono font-black text-indigo-800 text-sm" /></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black">외폭 (")</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="widthFull" value={sheetInput.costInput?.widthFull ?? ''} onChange={handleCostInputChange} readOnly={isFullyLocked} placeholder="58" className="text-center font-mono font-black text-indigo-800 text-sm" /></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black">GSM</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="gsm" value={sheetInput.costInput?.gsm ?? ''} onChange={handleCostInputChange} readOnly={isFullyLocked} placeholder="300" className="text-center font-mono font-black text-indigo-800 text-sm" /></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black">생산 G/YD</Th>
          <Td span={1} className="bg-indigo-50">
            <TInput type="number" name="costGYd" value={sheetInput.costInput?.costGYd ?? ''} onChange={handleCostInputChange} readOnly={isFullyLocked} placeholder={theoreticalGYd > 0 ? num(theoreticalGYd) : ''} className="text-center font-mono font-black text-blue-700 text-sm placeholder:text-slate-400 placeholder:font-normal" />
          </Td>
        </div>


        {/* ------------------------------------------- */}
        {/* 2. 원사 혼용률 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block" /> 원사 배합 (Yarn & Composition) {getCompStatus()}</h3>
        <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 grid grid-cols-12 mb-6">
          <Th span={2} className="justify-center">No.</Th>
          <Th span={8}>원사명 (Yarn Name / Count)</Th>
          <Th span={2} className="justify-center">비율(%)</Th>

          {[0, 1, 2, 3].map(idx => (
            <React.Fragment key={idx}>
              <Td span={2} className="flex items-center justify-center bg-slate-50"><span className="text-[10px] font-mono font-bold text-slate-400">Yarn #{idx + 1}</span></Td>
              <Td span={8} className="p-1">
                <SearchableSelect size="small" options={yarnSelectOptions} value={sheetInput.yarns?.[idx]?.yarnId || ''} onChange={(val) => handleSheetYarnChange(idx, 'yarnId', val)} placeholder="원사 검색..." disabled={isFullyLocked} />
              </Td>
              <Td span={2}>
                <TInput type="number" value={sheetInput.yarns?.[idx]?.ratio || ''} onChange={(e) => handleSheetYarnChange(idx, 'ratio', e.target.value)} readOnly={isFullyLocked} min="0" max="100" className="text-center font-bold font-mono text-blue-700 text-sm bg-blue-50/30" placeholder="0" />
              </Td>
            </React.Fragment>
          ))}
        </div>


        {/* ------------------------------------------- */}
        {/* 3. 편직 사양 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block" /> 편직 사양 (Knitting Specification)</h3>
        <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 grid grid-cols-6 md:grid-cols-12 mb-2">
          <Th span={2}>편직처 (Factory)</Th>
          <Td span={4}>
            <div className="flex items-center gap-1">
              <TSelect value={sheetInput.knitting?.factory || ''} onChange={e => handleSectionChange('knitting', 'factory', e.target.value)} disabled={isFullyLocked}>
                <option value="">-- 선택 --</option>
                {(knittingFactories || []).map(f => <option key={f} value={f}>{f}</option>)}
              </TSelect>
              {!isFullyLocked && <button type="button" onClick={() => setActiveMasterModal?.({ key: 'knittingFactories', title: '편직처 사전 등록 관리', description: '자주 거래하는 편직처를 등록해 두면 목록에서 간편하게 선택할 수 있습니다.', icon: Factory })} className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100">+ 등록</button>}
            </div>
          </Td>
          <Th span={2}>조직 (Structure)</Th>
          <Td span={4}>
            <div className="flex flex-wrap gap-1 p-1">
              {(structuresList || []).map(s => (
                <button type="button" key={s} onClick={() => !isFullyLocked && handleSectionChange('knitting', 'structure', s)} className={`px-2 py-0.5 text-[10px] rounded border ${sheetInput.knitting?.structure === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>{s}</button>
              ))}
              {!isFullyLocked && <button type="button" onClick={() => setActiveMasterModal?.({ key: 'structures', title: '편직 조직 등록 관리', description: '자주 쓰이는 기본 조직 항목을 관리합니다. (예: 싱글, 쭈리, 양면 등)', icon: Layers })} className="px-2 py-0.5 text-[10px] rounded border border-dashed border-violet-300 text-violet-500 hover:bg-violet-50">+ 추가</button>}
              <TInput value={sheetInput.knitting?.structure || ''} onChange={e => handleSectionChange('knitting', 'structure', e.target.value)} readOnly={isFullyLocked} placeholder="기타 입력" className="w-[80px] border-b border-slate-300 ml-1 !py-0 !min-h-5" />
            </div>
          </Td>

          <Th span={2}>기종 (Machine)</Th>
          <Td span={4}>
            <div className="flex flex-wrap gap-1 p-1">
              {(machineTypesList || []).map(m => (
                <button type="button" key={m} onClick={() => !isFullyLocked && handleSectionChange('knitting', 'machineType', m)} className={`px-2 py-0.5 text-[10px] rounded border ${sheetInput.knitting?.machineType === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>{m}</button>
              ))}
              {!isFullyLocked && <button type="button" onClick={() => setActiveMasterModal?.({ key: 'machineTypes', title: '편직 기종 등록 관리', description: '자주 쓰는 편직 기종(게이지/타입 등)을 등록하세요.', icon: Cpu })} className="px-2 py-0.5 text-[10px] rounded border border-dashed border-violet-300 text-violet-500 hover:bg-violet-50">+ 추가</button>}
            </div>
          </Td>
          <Th span={2}>게이지 (Gauge)</Th>
          <Td span={4}><TInput type="number" value={sheetInput.knitting?.gauge || ''} onChange={e => handleSectionChange('knitting', 'gauge', e.target.value)} readOnly={isFullyLocked} placeholder="28" className="font-mono" /></Td>

          <Th span={2}>인치 (Inch)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.machineInch || ''} onChange={e => handleSectionChange('knitting', 'machineInch', e.target.value)} readOnly={isFullyLocked} placeholder="30" className="font-mono" /></Td>
          <Th span={2}>침수 (Needle)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.needleCount || ''} onChange={e => handleSectionChange('knitting', 'needleCount', e.target.value)} readOnly={isFullyLocked} placeholder="2640" className="font-mono" /></Td>
          <Th span={2}>피더 (Feeder)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.feederCount || ''} onChange={e => handleSectionChange('knitting', 'feederCount', e.target.value)} readOnly={isFullyLocked} placeholder="96" className="font-mono" /></Td>

          <Th span={2}>개폭 설정</Th>
          <Td span={10} className="flex items-center gap-4 px-3 py-1 bg-slate-50 border-r-0">
            <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"><input type="checkbox" checked={sheetInput.knitting?.hasOpenWidth || false} onChange={() => !isFullyLocked && toggleBool('knitting', 'hasOpenWidth')} disabled={isFullyLocked} /> 개폭선</label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"><input type="checkbox" checked={sheetInput.knitting?.isOpenWidth || false} onChange={() => !isFullyLocked && toggleBool('knitting', 'isOpenWidth')} disabled={isFullyLocked} /> 오픈개폭</label>
          </Td>
          <Th span={2}>편직 특이사항</Th>
          <Td span={10} className="border-r-0"><TTextarea value={sheetInput.knitting?.remarks || ''} onChange={e => handleSectionChange('knitting', 'remarks', e.target.value)} readOnly={isFullyLocked} placeholder="특이사항 메모 (두 줄 이상 입력 가능)..." /></Td>
        </div>

        {/* 편직 조직도 구조표 */}
        <div className="bg-slate-50/50 border border-slate-300 p-2 md:p-3 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest bg-slate-200 px-2 py-0.5">조직도 (Structure Diagram)</span>
            <div className="flex flex-wrap gap-0.5">
              {!isFullyLocked && KNIT_SYMBOLS.map(sym => (
                <button key={sym} type="button" onClick={() => insertSymbol(sym)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100">{sym}</button>
              ))}
              {!isFullyLocked && <button type="button" onClick={addFeeder} className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold border border-blue-200 hover:bg-blue-200"><Plus className="w-3 h-3" /> 추가</button>}
            </div>
          </div>

          <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 grid grid-cols-12">
            <Th span={1} className="justify-center !px-1">F#</Th>
            <Th span={2}>사용 원사 (Yarn)</Th>
            <Th span={6}>조직 부호 (Dial & Cylinder)</Th>
            <Th span={2} className="justify-center">루프장(L/L)</Th>
            <Th span={1} className="justify-center">삭제</Th>

            {feeders.map((feeder, idx) => (
              <React.Fragment key={idx}>
                <Td span={1} className={`flex items-center justify-center cursor-pointer transition-colors ${selectedFeederIdx === idx ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : 'bg-slate-50 hover:bg-blue-50'}`} onClick={() => setSelectedFeederIdx(idx)}><span className={`text-[10px] font-mono font-bold ${selectedFeederIdx === idx ? 'text-blue-700' : 'text-slate-500'}`}>{idx + 1}{selectedFeederIdx === idx && ' ◄'}</span></Td>
                <Td span={2}>
                  <TSelect value={feeder.yarnSlot || ''} onChange={e => handleFeederChange(idx, 'yarnSlot', e.target.value)} disabled={isFullyLocked}>
                    <option value="">-</option><option value="1">Yarn #1</option><option value="2">Yarn #2</option><option value="3">Yarn #3</option><option value="4">Yarn #4</option>
                  </TSelect>
                </Td>
                <Td span={6}><TInput value={feeder.symbol || ''} onChange={e => handleFeederChange(idx, 'symbol', e.target.value)} readOnly={isFullyLocked} placeholder="부호 나열" onFocus={() => setSelectedFeederIdx(idx)} className={`text-center font-mono text-sm tracking-widest ${selectedFeederIdx === idx ? 'text-blue-800 bg-blue-50/50' : 'text-slate-800'}`} /></Td>
                <Td span={2}><TInput value={feeder.loopLength || ''} onChange={e => handleFeederChange(idx, 'loopLength', e.target.value)} readOnly={isFullyLocked} placeholder="L/L" className="text-center font-mono" /></Td>
                <Td span={1} className="flex items-center justify-center">
                  {!isFullyLocked && <button onClick={() => removeFeeder(idx)} disabled={feeders.length <= 1} className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"><Minus className="w-3 h-3" /></button>}
                </Td>
              </React.Fragment>
            ))}
          </div>
        </div>


        {/* ------------------------------------------- */}
        {/* 4. 염색 & 후가공 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block" /> 염색 및 가공 (Dyeing & Finishing)</h3>
        <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 grid grid-cols-4 md:grid-cols-8 mb-6">
          <Th span={1}>염가공처</Th>
          <Td span={3}>
            <div className="flex items-center gap-1">
              <TSelect value={sheetInput.dyeing?.factory || ''} onChange={e => handleSectionChange('dyeing', 'factory', e.target.value)} disabled={isFullyLocked}>
                <option value="">-- 선택 --</option>
                {(dyeingFactories || []).map(f => <option key={f} value={f}>{f}</option>)}
              </TSelect>
              {!isFullyLocked && <button type="button" onClick={() => setActiveMasterModal?.({ key: 'dyeingFactories', title: '염가공처 사전 등록 관리', description: '자주 거래하는 염색소 및 후가공 업체를 미리 등록해 관리할 수 있습니다.', icon: Droplets })} className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100">+ 등록</button>}
            </div>
          </Td>
          <Th span={1}>가공방법</Th>
          <Td span={3}><TInput value={sheetInput.dyeing?.processMethod || ''} onChange={e => handleSectionChange('dyeing', 'processMethod', e.target.value)} readOnly={isFullyLocked} placeholder="릴렉스 → 텐타" /></Td>

          <Th span={1}>염색 후 폭</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.dyedWidth || ''} onChange={e => handleSectionChange('dyeing', 'dyedWidth', e.target.value)} readOnly={isFullyLocked} placeholder="56인치" /></Td>
          <Th span={1}>텐타 기계폭</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.tenterWidth || ''} onChange={e => handleSectionChange('dyeing', 'tenterWidth', e.target.value)} readOnly={isFullyLocked} placeholder="60인치" /></Td>
          <Th span={1}>텐타 온도</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.tenterTemp || ''} onChange={e => handleSectionChange('dyeing', 'tenterTemp', e.target.value)} readOnly={isFullyLocked} placeholder="180℃" /></Td>
          <Th span={1}>포속 / 오버피더</Th>
          <Td span={1} className="flex divide-x divide-slate-300">
            <TInput value={sheetInput.dyeing?.fabricSpeed || ''} onChange={e => handleSectionChange('dyeing', 'fabricSpeed', e.target.value)} readOnly={isFullyLocked} placeholder="20m/m" className="text-center w-1/2" />
            <TInput value={sheetInput.dyeing?.overFeeder || ''} onChange={e => handleSectionChange('dyeing', 'overFeeder', e.target.value)} readOnly={isFullyLocked} placeholder="+5%" className="text-center w-1/2 bg-slate-50" />
          </Td>

          <Th span={1} className="bg-slate-200">후가공 업체</Th>
          <Td span={1} className="bg-slate-50"><TInput value={sheetInput.finishing?.factory || ''} onChange={e => handleSectionChange('finishing', 'factory', e.target.value)} readOnly={isFullyLocked} placeholder="업체명" /></Td>
          <Th span={1} className="bg-slate-200">후가공 종류</Th>
          <Td span={1} className="bg-slate-50"><TInput value={sheetInput.finishing?.type || ''} onChange={e => handleSectionChange('finishing', 'type', e.target.value)} readOnly={isFullyLocked} placeholder="기모, 가공..." /></Td>
          <Th span={1} className="bg-slate-200">후가공 방법</Th>
          <Td span={3} className="bg-slate-50"><TInput value={sheetInput.finishing?.method || ''} onChange={e => handleSectionChange('finishing', 'method', e.target.value)} readOnly={isFullyLocked} placeholder="세부방법 기재" /></Td>

          <Th span={1}>염가공 메모</Th>
          <Td span={7}><TInput value={sheetInput.dyeing?.remarks || ''} onChange={e => handleSectionChange('dyeing', 'remarks', e.target.value)} readOnly={isFullyLocked} placeholder="특이사항 메모..." /></Td>
        </div>

        {/* =========================================== */}
        {/* 1 PAGE 종료 */}
        {/* =========================================== */}
        <div className="mt-auto opacity-0 h-4"></div>
        </div>

        {/* --- 2 PAGE (원가 및 QC 연동) --- */}
        <div className={`bg-white shadow-xl border border-slate-300 mx-auto w-full transition-colors flex flex-col pt-0 ${isFullyLocked ? 'bg-slate-50/50 grayscale-[20%]' : ''}`} style={{ minHeight: '297mm', padding: '10mm 15mm' }}>

        {/* ------------------------------------------- */}
        {/* 5. 최종 실측 & 원가 계산 (하이라이트 구역) */}
        {/* ------------------------------------------- */}
        <div className="mt-8 flex items-end justify-between mb-1.5">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-600 block" /> 최종 스펙 및 원가 (Actual & Cost)</h3>
          <p className="text-[9px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">※ 색칠된 칸이 최종 거래 스펙 및 가격의 기준이 됩니다.</p>
        </div>

        <div className="border-t-[2px] border-l-[2px] border-r-[1px] border-slate-800 border-b-[2px] rounded-none overflow-hidden grid grid-cols-4 md:grid-cols-10 mb-8 bg-white shadow-sm">

          {/* 1. Header (항목명) ROW */}
          <Th span={2} className="bg-slate-200 justify-center text-[10px] !py-1">생산 항목</Th>
          <Th span={2} className="bg-slate-100 justify-center text-[10px] !py-1 text-slate-600">1,000 YDS 범위</Th>
          <Th span={2} className="bg-indigo-100 justify-center text-[10px] text-indigo-900 border-b-indigo-200 !py-1 shadow-inner">3,000 YDS 기준 (Main)</Th>
          <Th span={2} className="bg-slate-100 justify-center text-[10px] !py-1 text-slate-600">5,000 YDS 범위</Th>
          <Th span={2} className="bg-slate-200 justify-center text-[10px] text-slate-700 !py-1 border-r-0">통합 적용 상수</Th>

          {/* 2. 원가 항목 데이터 ROW 1 (편직비) */}
          <Th span={2} className="text-slate-700 justify-center">
            <span>편직비 (￦/kg)</span>
          </Th>
          <Td span={2}><TInput type="number" name="knittingFee1k" value={sheetInput.costInput?.knittingFee1k ?? ''} onChange={handleCostInputChange} placeholder="1K 편직비" className="text-center font-mono text-slate-700" /></Td>
          <Td span={2} className="bg-indigo-50/40 shadow-inner"><TInput type="number" name="knittingFee3k" value={sheetInput.costInput?.knittingFee3k ?? ''} onChange={handleCostInputChange} placeholder="3K 편직비" className="text-center font-mono font-black text-indigo-800 bg-transparent" /></Td>
          <Td span={2}><TInput type="number" name="knittingFee5k" value={sheetInput.costInput?.knittingFee5k ?? ''} onChange={handleCostInputChange} placeholder="5K 편직비" className="text-center font-mono text-slate-700" /></Td>
          <Th span={2} className="bg-slate-100 justify-center text-slate-600 border-l border-l-slate-800 border-r-0">염가공비 (￦/kg)</Th>

          {/* 3. 원가 항목 데이터 ROW 2 (편직 로스율) */}
          <Th span={2} className="text-amber-700 justify-center bg-amber-50/50">
            <span>편직 Loss (%)</span>
          </Th>
          <Td span={2} className="bg-amber-50/30"><TInput type="number" value={sheetInput.costInput?.losses?.tier1k?.knit ?? ''} onChange={e => handleCostNestedChange('losses', 'tier1k', 'knit', e.target.value)} placeholder="%" className="text-center font-mono text-amber-700 bg-transparent" /></Td>
          <Td span={2} className="bg-indigo-50/40 shadow-inner"><TInput type="number" value={sheetInput.costInput?.losses?.tier3k?.knit ?? ''} onChange={e => handleCostNestedChange('losses', 'tier3k', 'knit', e.target.value)} placeholder="%" className="text-center font-mono font-black text-amber-700 bg-transparent" /></Td>
          <Td span={2} className="bg-amber-50/30"><TInput type="number" value={sheetInput.costInput?.losses?.tier5k?.knit ?? ''} onChange={e => handleCostNestedChange('losses', 'tier5k', 'knit', e.target.value)} placeholder="%" className="text-center font-mono text-amber-700 bg-transparent" /></Td>
          <Td span={2} className="bg-white border-l border-l-slate-800 border-r-0"><TInput type="number" name="dyeingFee" value={sheetInput.costInput?.dyeingFee ?? ''} onChange={handleCostInputChange} placeholder="전구간 단일 (₩)" className="text-center font-mono font-black text-slate-800 text-sm h-full" /></Td>

          {/* 4. 원가 항목 데이터 ROW 3 (염색 로스율) */}
          <Th span={2} className="text-blue-700 justify-center bg-blue-50/50">
            <span>염가공 Loss (%)</span>
          </Th>
          <Td span={2} className="bg-blue-50/30"><TInput type="number" value={sheetInput.costInput?.losses?.tier1k?.dye ?? ''} onChange={e => handleCostNestedChange('losses', 'tier1k', 'dye', e.target.value)} placeholder="%" className="text-center font-mono text-blue-700 bg-transparent" /></Td>
          <Td span={2} className="bg-indigo-50/40 shadow-inner"><TInput type="number" value={sheetInput.costInput?.losses?.tier3k?.dye ?? ''} onChange={e => handleCostNestedChange('losses', 'tier3k', 'dye', e.target.value)} placeholder="%" className="text-center font-mono font-black text-blue-700 bg-transparent" /></Td>
          <Td span={2} className="bg-blue-50/30"><TInput type="number" value={sheetInput.costInput?.losses?.tier5k?.dye ?? ''} onChange={e => handleCostNestedChange('losses', 'tier5k', 'dye', e.target.value)} placeholder="%" className="text-center font-mono text-blue-700 bg-transparent" /></Td>
          <Th span={2} className="bg-slate-100 justify-center text-slate-600 border-l border-l-slate-800 border-r-0">도매(Conv) 마진</Th>

          {/* 5. 원가 항목 데이터 ROW 4 (부대비) */}
          <Th span={2} className="text-slate-500 justify-center">
            <span>부대비용 (￦/YD)</span>
          </Th>
          <Td span={2}><TInput type="number" name="extraFee1k" value={sheetInput.costInput?.extraFee1k ?? ''} onChange={handleCostInputChange} placeholder="1K 요금" className="text-center font-mono text-slate-500" /></Td>
          <Td span={2} className="bg-indigo-50/40 shadow-inner"><TInput type="number" name="extraFee3k" value={sheetInput.costInput?.extraFee3k ?? ''} onChange={handleCostInputChange} placeholder="3K 요금" className="text-center font-mono font-black text-slate-600 bg-transparent" /></Td>
          <Td span={2}><TInput type="number" name="extraFee5k" value={sheetInput.costInput?.extraFee5k ?? ''} onChange={handleCostInputChange} placeholder="5K 요금" className="text-center font-mono text-slate-500" /></Td>
          <Td span={2} className="bg-slate-50 border-l border-l-slate-800 border-r-0">
            <TSelect value={sheetInput.costInput?.marginTier ?? 3} onChange={e => handleCostInputChange({ target: { name: 'marginTier', value: Number(e.target.value) } })} className="text-center font-bold text-slate-800 bg-transparent h-full">
              <option value={1}>1급 (13%)</option>
              <option value={2}>2급 (16%)</option>
              <option value={3}>3급 (19%)</option>
              <option value={4}>4급 (22%)</option>
              <option value={5}>5급 (25%)</option>
            </TSelect>
          </Td>

          {/* 6. 원가 항목 데이터 ROW 5 (직납로고비) */}
          <Th span={2} className="text-purple-700 justify-center bg-purple-50/50 !border-b-0">
            <span>Brand 직납 추가금 (￦/YD)</span>
          </Th>
          <Td span={2} className="bg-purple-50/30 !border-b-0"><TInput type="number" value={sheetInput.costInput?.brandExtra?.tier1k ?? ''} onChange={e => handleCostInputChange({ target: { name: 'brandExtra_tier1k', value: e.target.value } })} placeholder="1K 로고비" className="text-center font-mono text-purple-700 bg-transparent" /></Td>
          <Td span={2} className="bg-indigo-50/40 shadow-inner !border-b-0"><TInput type="number" value={sheetInput.costInput?.brandExtra?.tier3k ?? ''} onChange={e => handleCostInputChange({ target: { name: 'brandExtra_tier3k', value: e.target.value } })} placeholder="3K 로고비" className="text-center font-mono font-black text-purple-700 bg-transparent" /></Td>
          <Td span={2} className="bg-purple-50/30 !border-b-0"><TInput type="number" value={sheetInput.costInput?.brandExtra?.tier5k ?? ''} onChange={e => handleCostInputChange({ target: { name: 'brandExtra_tier5k', value: e.target.value } })} placeholder="5K 로고비" className="text-center font-mono text-purple-700 bg-transparent" /></Td>
          <Td span={2} className="bg-slate-50 border-l border-l-slate-800 border-r-0 !border-b-0">
            <div className="flex items-center justify-center p-2 h-full text-[9px] text-slate-400 font-bold tracking-tighter text-center leading-tight">
              ★ 우측 공통 상수는<br />판가 산출시 일괄 적용됩니다.
            </div>
          </Td>

          {/* 7. 최하단 Summary Banner (Column 맞춰서 분할) */}
          <Td span={2} className="bg-slate-100 flex items-center justify-center !border-b-0">
             <span className="text-[10px] font-black text-slate-400">구간별 최종 단가</span>
          </Td>
          {costData && ['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
            const data = viewMode === 'export' ? costData[tier]?.export : costData[tier]?.domestic;
            const pre = viewMode === 'export' ? '$' : '₩';
            const fmt = v => viewMode === 'export' ? (v || 0).toFixed(2) : num(v || 0);
            const is3K = tier === 'tier3k';
            return (
              <Td span={2} key={tier} className={`flex-1 flex flex-col items-center justify-center p-2.5 !border-b-0 ${is3K ? 'bg-indigo-900 shadow-inner border-indigo-900' : 'bg-white'}`}>
                <span className={`text-[9px] font-bold ${is3K ? 'text-indigo-200' : 'text-slate-500'} tracking-widest uppercase mb-2`}>{['1,000 YDS', '3,000 YDS', '5,000 YDS'][i]} 원가 산출</span>
                <div className="flex flex-col items-center gap-1.5 w-full relative">
                  <div className="flex justify-between w-full px-2">
                    <span className={`text-[9px] ${is3K ? 'text-indigo-300' : 'text-slate-400'}`}>순수(Cost)</span>
                    <span className={`text-[10px] font-mono font-bold ${is3K ? 'text-indigo-200' : 'text-slate-500'}`}>{pre}{fmt(data?.totalCostYd)}</span>
                  </div>
                  <div className={`w-[90%] h-px ${is3K ? 'bg-indigo-800' : 'bg-slate-200'} my-0.5`}></div>
                  <div className="flex justify-between w-full px-2">
                    <span className={`text-[9px] ${is3K ? 'text-indigo-300' : 'text-slate-400'}`}>기본(일반)</span>
                    <span className={`text-[10px] font-mono font-bold ${is3K ? 'text-white' : 'text-slate-700'}`}>{pre}{fmt(data?.priceConverter)}</span>
                  </div>
                  <div className={`w-[90%] h-px ${is3K ? 'bg-indigo-800' : 'bg-slate-200'} my-0.5`}></div>
                  <div className="flex justify-between w-full px-2 items-center">
                    <span className={`text-[9px] ${is3K ? 'text-yellow-500 font-bold' : 'text-slate-600 font-bold'}`}>직납(Brand)</span>
                    <span className={`text-[10px] font-mono font-bold ${is3K ? 'text-yellow-400' : 'text-slate-800'}`}>{pre}{fmt(data?.priceBrand)}</span>
                  </div>
                </div>
              </Td>
            );
          })}
          <Td span={2} className="bg-slate-100 border-l border-l-slate-800 border-r-0 !border-b-0 flex flex-col items-center justify-center">
          </Td>
        </div>


        {/* 메모 및 서명 영역 */}
        {editingSheetId && (
          <div className="mt-8 border-2 border-amber-300 bg-amber-50 p-4 relative mb-6">
            <h4 className="absolute -top-2 left-4 bg-amber-50 px-2 text-[10px] font-extrabold text-amber-700 tracking-wider">※ 설계 변경 사유</h4>
            <textarea value={sheetInput.changeReason || ''} onChange={e => handleSheetChange({ target: { name: 'changeReason', value: e.target.value } })} placeholder="수정 사유를 기재해 주세요 (이력 보관 시 필요)" className="w-full bg-transparent border-none outline-none text-xs text-amber-900 placeholder-amber-400/50 resize-none h-10 mt-1" />
          </div>
        )}

        {/* 변경 이력 아코디언 컴포넌트 */}
        {sheetInput.changeHistory && sheetInput.changeHistory.length > 0 && (
          <details className="mb-6 group bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer shadow-sm">
            <summary className="p-3 text-xs font-bold text-slate-600 flex items-center justify-between hover:bg-slate-100 transition-colors list-none">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> 과거 변경 이력 열람 (총 {sheetInput.changeHistory.length}건)</span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border">자세히 보기 ▽</span>
            </summary>
            <div className="bg-white border-t border-slate-200 p-4 space-y-4 max-h-60 overflow-y-auto w-full">
              {sheetInput.changeHistory.map((entry, idx) => (
                <div key={idx} className="relative pl-4 border-l-2 border-amber-300">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-[10px] font-bold text-amber-600 mb-1">
                    {new Date(entry.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {entry.reason && (
                    <p className="text-[10px] text-slate-600 bg-amber-50 px-2 py-1 flex rounded mb-2 w-wrap">
                      📝 {entry.reason}
                    </p>
                  )}
                  <div className="space-y-0.5 mt-2 break-all w-wrap">
                    {Object.entries(entry.fields || {}).map(([key, val]) => (
                      <div key={key} className="flex flex-wrap gap-1 text-[10px]">
                        <span className="font-bold text-slate-500 whitespace-nowrap">{key}:</span>
                        <span className="text-red-400 line-through whitespace-nowrap">{String(val) || '(비어있음)'}</span>
                        <span className="text-slate-300 whitespace-nowrap">→</span>
                        <span className="text-emerald-600 font-bold whitespace-nowrap">현재값 적용됨</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* 원단 리스트 연동 섹션 */}
        <div className="mb-6 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
          <h3 className="text-xs font-extrabold text-blue-800 mb-2 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> 원단 리스트 연동
          </h3>
          {sheetInput.linkedFabricId ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                ✓ 연결됨: 원단 ID #{sheetInput.linkedFabricId}
              </span>
              <span className="text-[10px] text-slate-500">양방향 동기화 활성</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* 설계서 내용으로 새 원단 등록 */}
              {editingSheetId && (
                <button type="button" onClick={() => {
                  if (!sheetInput?.articleNo?.trim()) {
                    alert('원단을 등록하려면 상단의 [Article 번호]를 반드시 입력해야 합니다.');
                    return;
                  }
                  if (window.confirm('입력된 스펙을 바탕으로 새 원단을 원단 장부에 등록하시겠습니까?\n(현재 작성 중인 설계서 내용도 함께 저장되며, [아이템화] 단계로 전환됩니다)')) {
                    // 1. 설계서 최신 데이터 강제 저장 (이력 추적 등 시스템 동작 보장)
                    if (handleSaveSheet) handleSaveSheet(user);

                    // 2. 최신 입력값(sheetInput)을 병합하여 원단 시스템에 등록 (데이터 누락/구버전화 방지)
                    const sheet = (designSheets || []).find(s => s.id === editingSheetId);
                    if (sheet && registerFabricFromSheet) {
                      registerFabricFromSheet({ ...sheet, ...sheetInput, id: editingSheetId });
                      closeModal?.();
                    }
                  }
                }} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 원단 리스트에 등록
                </button>
              )}
              {/* 기존 원단에서 연결 */}
              <select onChange={(e) => {
                const fabId = e.target.value;
                if (!fabId) return;
                const fab = (savedFabrics || []).find(f => String(f.id) === fabId);
                if (!fab) return;
                if (window.confirm(`[${fab.article}] 원단의 스펙을 불러와 이 설계서에 덮어씁니다.\n계속하시겠습니까?`)) {
                  // 설계서에 원단 데이터(15개 변수 전체) 일괄 반영
                  if (setSheetInput) {
                    setSheetInput(prev => ({
                      ...prev,
                      linkedFabricId: String(fabId),
                      articleNo: fab.article || '',
                      fabricName: fab.itemName || '',
                      yarns: fab.yarns || [],
                      costInput: {
                        ...(prev.costInput || {}),
                        widthFull: fab.widthFull ?? prev.costInput?.widthFull,
                        widthCut: fab.widthCut ?? prev.costInput?.widthCut,
                        gsm: fab.gsm ?? prev.costInput?.gsm,
                        costGYd: fab.costGYd ?? prev.costInput?.costGYd,
                        knittingFee1k: fab.knittingFee1k ?? prev.costInput?.knittingFee1k,
                        knittingFee3k: fab.knittingFee3k ?? prev.costInput?.knittingFee3k,
                        knittingFee5k: fab.knittingFee5k ?? prev.costInput?.knittingFee5k,
                        dyeingFee: fab.dyeingFee ?? prev.costInput?.dyeingFee,
                        extraFee1k: fab.extraFee1k ?? prev.costInput?.extraFee1k,
                        extraFee3k: fab.extraFee3k ?? prev.costInput?.extraFee3k,
                        extraFee5k: fab.extraFee5k ?? prev.costInput?.extraFee5k,
                        losses: fab.losses ?? prev.costInput?.losses,
                        marginTier: fab.marginTier ?? prev.costInput?.marginTier,
                        brandExtra: fab.brandExtra ?? prev.costInput?.brandExtra
                      }
                    }));
                  }

                  setTimeout(() => alert('원단 스펙이 폼에 적용되었습니다.\n내용을 확인하신 후 반드시 우측 상단의 [설계서 저장] 버튼을 눌러야 완전히 연결됩니다.'), 300);
                } else {
                  e.target.value = '';
                }
              }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 ring-blue-200 outline-none" defaultValue="">
                <option value="">기존 원단에서 연결...</option>
                {(savedFabrics || []).filter(f => !f.linkedSheetId).map(f => (
                  <option key={f.id} value={f.id}>{f.article || '미등록'} - {f.itemName || '이름없음'}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ------------------------------------------- */}
        {/* MAIN DETAIL 연동 섹션 (QC 연동) */}
        {/* ------------------------------------------- */}
        {sheetInput.articleNo && (
          <div className="mt-6 border-[2px] border-slate-800 p-3 bg-white rounded-none">
            <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              메인 디테일 시트 (Quality Control) 연동 현황
              <span className="ml-2 text-[9px] font-normal text-slate-500">[{sheetInput.articleNo}] 연동됨</span>
            </h3>
            
            <div className="flex flex-col gap-2">
              {(mainDetails || []).filter(d => d.article === sheetInput.articleNo).map(d => {
                const latestTest = d.tests?.length ? d.tests[d.tests.length - 1] : null;
                const isPass = latestTest?.status === 'PASS';
                const isFail = latestTest?.status === 'FAIL';

                return (
                  <div key={d.id} className="flex bg-slate-50/50 items-center p-2 border border-slate-400 shadow-sm gap-3 shrink-0">
                    <div className="w-1.5 h-full min-h-[40px] bg-slate-800" />
                    
                    <div className="w-[120px] shrink-0">
                       <span className="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-none font-bold">{d.orderNo}</span>
                       <div className="text-xs font-black text-slate-800 mt-1 truncate">{d.color || '-'}</div>
                       <div className="text-[9px] font-mono text-slate-500">LOT: {d.lotNo || '-'}</div>
                    </div>

                    <div className="flex-1 border-l border-slate-400 pl-3 min-w-[150px]">
                       <div className="text-[9px] font-bold text-slate-500 mb-0.5">최종 수축 QC (폭 / 장 / 토킹 / GSM)</div>
                       <div className="flex gap-2 text-[10px] font-mono whitespace-nowrap">
                         <span className="text-red-600 font-bold">{latestTest?.shrinkWidth || '-'}</span> / 
                         <span className="text-red-600 font-bold">{latestTest?.shrinkLength || '-'}</span> / 
                         <span className="text-amber-600 font-bold">{latestTest?.torque || '-'}</span> / 
                         <span className="text-blue-600 font-bold">{latestTest?.gsm || '-'}</span>
                       </div>
                    </div>

                    <div className="shrink-0 flex justify-end">
                       {latestTest ? (
                         isPass ? <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 by-1 text-[10px] font-bold whitespace-nowrap border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5"/> PASS <span className="text-[9px] font-normal">({d.tests.length}차)</span></span>
                                : isFail ? <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 text-[10px] font-bold whitespace-nowrap border border-red-300"><XCircle className="w-3.5 h-3.5"/> FAIL <span className="text-[9px] font-normal">({d.tests.length}차)</span></span>
                                         : <span className="text-[10px] text-slate-400">결과 대기</span>
                       ) : <span className="text-[10px] text-slate-400">테스트 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between pt-4 border-t-2 border-slate-900">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">본 문서는 시스템에 의해 전자 기록됩니다.</p>
            <p className="text-[10px] text-slate-800 font-extrabold flex items-center gap-2">작성자: <span className="underline decoration-slate-300 underline-offset-4">{user?.displayName || '관리자'}</span></p>
          </div>

          {/* 문서 끝 */}
          <div className="w-16 h-16 border-4 border-double border-red-500 rounded-full flex items-center justify-center opacity-70 transform -rotate-12">
            <span className="text-xs font-black text-red-500 tracking-tighter">GRUBIG<br />APP.</span>
          </div>
        </div>
        {/* --- 2 PAGE 종료 --- */}
        </div>

      {/* Grid 컨테이너 닫기 */}
      </div>

    </div>
  );
};
