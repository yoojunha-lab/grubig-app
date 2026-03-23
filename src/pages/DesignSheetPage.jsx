import React from 'react';
import { Save, X, Lock, Link as LinkIcon, Plus, Minus, FileText, Trash2 } from 'lucide-react';
import { DesignStepper } from '../components/design/DesignStepper';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { num } from '../utils/helpers';

// 편직 조직도 관련 부호
const KNIT_SYMBOLS = ['︹', '︺', '︿', '﹀', '━', '┃', '╋', '○', '●', '◎', '△', '▽'];

// 서식용 컴포넌트
const Th = ({ children, className="", span=1 }) => (
  <div className={`bg-slate-100/80 border-r border-b border-slate-300 px-2 py-1.5 font-extrabold text-slate-700 text-[10px] uppercase flex items-center ${className}`} style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);
const Td = ({ children, className="", span=1 }) => (
  <div className={`bg-white border-r border-b border-slate-300 relative group ${className}`} style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);
const TInput = ({ ...props }) => (
  <input {...props} className={`w-full h-full min-h-[28px] bg-transparent border-none px-2 py-1 outline-none focus:bg-blue-50 focus:ring-1 ring-inset ring-blue-500 placeholder-slate-300 text-[11px] font-medium transition-colors ${props.className||''}`} />
);
const TSelect = ({ children, ...props }) => (
  <select {...props} className={`w-full h-full min-h-[28px] bg-transparent border-none px-1.5 py-1 outline-none focus:bg-blue-50 focus:ring-1 ring-inset ring-blue-500 text-[11px] font-medium cursor-pointer ${props.className||''}`}>
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
  generateSelfDevOrderNo,
  linkAndConfirm,
  advanceToEztex
}) => {
  const STAGE_ORDER = ['draft', 'eztex', 'sampling', 'articled'];
  const stageIdx = STAGE_ORDER.indexOf(sheetInput.stage || 'draft');
  const isDevOrderLocked = stageIdx >= 1 || !!sheetInput.devRequestId;
  const isEztexLocked = stageIdx >= 2;
  const isFullyLocked = stageIdx >= 3;

  const linkedDevReq = sheetInput.devRequestId ? (devRequests || []).find(d => d.id === sheetInput.devRequestId) : null;
  const feeders = sheetInput.knitting?.feeders || [{ symbol: '', loopLength: '', yarnSlot: '' }];

  const handleFeederChange = (idx, field, value) => {
    const newFeeders = [...feeders];
    newFeeders[idx] = { ...newFeeders[idx], [field]: value };
    handleSectionChange('knitting', 'feeders', newFeeders);
  };
  const addFeeder = () => handleSectionChange('knitting', 'feeders', [...feeders, { symbol: '', loopLength: '', yarnSlot: '' }]);
  const removeFeeder = (idx) => {
    if (feeders.length <= 1) return;
    handleSectionChange('knitting', 'feeders', feeders.filter((_, i) => i !== idx));
  };
  const insertSymbol = (symbol) => {
    const lastIdx = feeders.length - 1;
    handleFeederChange(lastIdx, 'symbol', (feeders[lastIdx]?.symbol || '') + symbol);
  };
  const toggleBool = (section, field) => handleSectionChange(section, field, !sheetInput[section]?.[field]);

  const costData = getDesignCost?.(sheetInput) || null;

  const handleSaveAndGo = () => {
    const onLink = (devReqId, sheetId) => { if (linkAndConfirm) linkAndConfirm(devReqId, sheetId); };
    handleSaveSheet(user, onLink, generateSelfDevOrderNo);
    setActiveTab('devStatus');
  };

  const getCompStatus = () => {
    const total = (sheetInput.yarns || []).reduce((s, y) => s + (Number(y?.ratio) || 0), 0);
    if (total === 0) return null;
    if (total !== 100) return <span className="text-red-500 font-extrabold ml-2 text-[10px]">⚠ 총합 {total}% (오류)</span>;
    return <span className="text-emerald-600 font-extrabold ml-2 text-[10px]">✓ 총합 100%</span>;
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* 액션 플로팅 버튼 (수정 완료용) */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 mb-6 flex justify-between items-center shadow-sm">
         <div className="flex items-center gap-3">
           <FileText className="w-5 h-5 text-indigo-600"/>
           <div>
             <h1 className="text-lg font-extrabold text-slate-800 leading-tight">원단 설계서 (Circular knit fabric)</h1>
             <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">{editingSheetId ? '문서 수정 중' : '새 문서 작성'}</p>
           </div>
         </div>
         <div className="flex gap-2">
            {editingSheetId && !isFullyLocked && (
              <button onClick={() => { handleDeleteSheet(editingSheetId); setActiveTab('devStatus'); }} className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded shadow-sm transition-colors flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/> 삭제</button>
            )}
            <button onClick={() => { resetSheetForm(); setActiveTab('devStatus'); }} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded shadow-sm transition-colors flex items-center gap-1"><X className="w-3.5 h-3.5"/> 취소</button>
            <button onClick={handleSaveAndGo} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-md transition-colors flex items-center gap-1.5"><Save className="w-3.5 h-3.5"/> 명세서 저장</button>
         </div>
      </div>

      {/* A4 용지 스타일 컨테이너 */}
      <div className={`bg-white shadow-xl border border-slate-300 mx-auto w-full transition-colors ${isFullyLocked ? 'bg-slate-50/50 grayscale-[20%]' : ''}`} style={{ minHeight: '297mm', padding: '10mm 15mm' }}>
        
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
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block"/> 문서 식별 정보</h3>
        <div className="border-l border-t border-slate-300 grid grid-cols-4 md:grid-cols-8 mb-6">
          <Th span={1}>개발번호 {isDevOrderLocked&&<Lock className="inline w-2.5 h-2.5 ml-1"/>}</Th>
          <Td span={1}><TInput name="devOrderNo" value={sheetInput.devOrderNo||''} onChange={handleSheetChange} readOnly={isDevOrderLocked} placeholder="자동 발번" className={`font-mono font-extrabold text-blue-700 ${isDevOrderLocked?'bg-slate-50':''}`}/></Td>
          <Th span={1}>EZ-TEX NO {isEztexLocked&&<Lock className="inline w-2.5 h-2.5 ml-1"/>}</Th>
          <Td span={1}><TInput name="eztexOrderNo" value={sheetInput.eztexOrderNo||''} onChange={handleSheetChange} readOnly={isEztexLocked||isFullyLocked} placeholder="품번" className={`font-mono font-extrabold text-violet-700 ${isEztexLocked?'bg-slate-50':''}`}/></Td>
          <Th span={1}>Article No. {isFullyLocked&&<Lock className="inline w-2.5 h-2.5 ml-1"/>}</Th>
          <Td span={1}><TInput name="articleNo" value={sheetInput.articleNo||''} onChange={handleSheetChange} readOnly={isFullyLocked} placeholder="아티클" className={`font-mono font-extrabold text-emerald-700 ${isFullyLocked?'bg-slate-50':''}`}/></Td>
          <Th span={1} className="text-red-700 bg-red-50/50">샘플 납기</Th>
          <Td span={1}><TInput type="date" name="deadline" value={sheetInput.deadline||''} onChange={handleSheetChange} readOnly={isFullyLocked} className="font-mono font-bold text-red-600"/></Td>

          <Th span={1}>원단명 (Name)</Th>
          <Td span={7}><TInput name="fabricName" value={sheetInput.fabricName||''} onChange={handleSheetChange} readOnly={isFullyLocked} placeholder="직관적인 원단명 (예: Wool Interlock)" className="text-sm font-extrabold text-slate-900 border-b-2 focus:border-blue-400"/></Td>
        </div>


        {/* ------------------------------------------- */}
        {/* 2. 원사 혼용률 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block"/> 원사 배합 (Yarn & Composition) {getCompStatus()}</h3>
        <div className="border-l border-t border-slate-300 grid grid-cols-12 mb-6">
          <Th span={2} className="justify-center">No.</Th>
          <Th span={8}>원사명 (Yarn Name / Count)</Th>
          <Th span={2} className="justify-center">비율(%)</Th>

          {[0, 1, 2, 3].map(idx => (
            <React.Fragment key={idx}>
              <Td span={2} className="flex items-center justify-center bg-slate-50"><span className="text-[10px] font-mono font-bold text-slate-400">Yarn #{idx + 1}</span></Td>
              <Td span={8} className="p-1">
                <SearchableSelect options={yarnSelectOptions} value={sheetInput.yarns?.[idx]?.yarnId || ''} onChange={(val) => handleSheetYarnChange(idx, 'yarnId', val)} placeholder="원사 검색..." disabled={isFullyLocked} />
              </Td>
              <Td span={2}>
                 <TInput type="number" value={sheetInput.yarns?.[idx]?.ratio || ''} onChange={(e) => handleSheetYarnChange(idx, 'ratio', e.target.value)} readOnly={isFullyLocked} min="0" max="100" className="text-center font-bold font-mono text-blue-700 text-sm bg-blue-50/30" placeholder="0"/>
              </Td>
            </React.Fragment>
          ))}
        </div>


        {/* ------------------------------------------- */}
        {/* 3. 편직 사양 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block"/> 편직 사양 (Knitting Specification)</h3>
        <div className="border-l border-t border-slate-300 grid grid-cols-6 md:grid-cols-12 mb-2">
          <Th span={2}>편직처 (Factory)</Th>
          <Td span={4}><TInput value={sheetInput.knitting?.factory||''} onChange={e=>handleSectionChange('knitting','factory',e.target.value)} readOnly={isFullyLocked} placeholder="업체명"/></Td>
          <Th span={2}>조직 (Structure)</Th>
          <Td span={4}><TInput value={sheetInput.knitting?.structure||''} onChange={e=>handleSectionChange('knitting','structure',e.target.value)} readOnly={isFullyLocked} placeholder="싱글저지, 인터로크..."/></Td>

          <Th span={2}>기종 (Machine)</Th>
          <Td span={4}><TInput value={sheetInput.knitting?.machineType||''} onChange={e=>handleSectionChange('knitting','machineType',e.target.value)} readOnly={isFullyLocked} placeholder="환편기, 횡편기"/></Td>
          <Th span={2}>게이지 (Gauge)</Th>
          <Td span={4}><TInput type="number" value={sheetInput.knitting?.gauge||''} onChange={e=>handleSectionChange('knitting','gauge',e.target.value)} readOnly={isFullyLocked} placeholder="28" className="font-mono"/></Td>

          <Th span={2}>인치 (Inch)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.machineInch||''} onChange={e=>handleSectionChange('knitting','machineInch',e.target.value)} readOnly={isFullyLocked} placeholder="30" className="font-mono"/></Td>
          <Th span={2}>침수 (Needle)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.needleCount||''} onChange={e=>handleSectionChange('knitting','needleCount',e.target.value)} readOnly={isFullyLocked} placeholder="2640" className="font-mono"/></Td>
          <Th span={2}>피더 (Feeder)</Th>
          <Td span={2}><TInput type="number" value={sheetInput.knitting?.feederCount||''} onChange={e=>handleSectionChange('knitting','feederCount',e.target.value)} readOnly={isFullyLocked} placeholder="96" className="font-mono"/></Td>

          <Th span={2}>개폭 설정</Th>
          <Td span={4} className="flex items-center gap-4 px-3 py-1 bg-slate-50">
            <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"><input type="checkbox" checked={sheetInput.knitting?.hasOpenWidth||false} onChange={()=>!isFullyLocked&&toggleBool('knitting','hasOpenWidth')} disabled={isFullyLocked}/> 개폭선</label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"><input type="checkbox" checked={sheetInput.knitting?.isOpenWidth||false} onChange={()=>!isFullyLocked&&toggleBool('knitting','isOpenWidth')} disabled={isFullyLocked}/> 오픈개폭</label>
          </Td>
          <Th span={2}>편직 특이사항</Th>
          <Td span={4}><TInput value={sheetInput.knitting?.remarks||''} onChange={e=>handleSectionChange('knitting','remarks',e.target.value)} readOnly={isFullyLocked} placeholder="특이사항 메모..."/></Td>
        </div>

        {/* 편직 조직도 구조표 */}
        <div className="bg-slate-50/50 border border-slate-300 p-2 md:p-3 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest bg-slate-200 px-2 py-0.5">조직도 (Structure Diagram)</span>
            <div className="flex flex-wrap gap-0.5">
              {!isFullyLocked && KNIT_SYMBOLS.map(sym=>(
                <button key={sym} type="button" onClick={()=>insertSymbol(sym)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100">{sym}</button>
              ))}
              {!isFullyLocked && <button type="button" onClick={addFeeder} className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold border border-blue-200 hover:bg-blue-200"><Plus className="w-3 h-3"/> 추가</button>}
            </div>
          </div>
          
          <div className="border-l border-t border-slate-300 grid grid-cols-12">
            <Th span={1} className="justify-center !px-1">F#</Th>
            <Th span={2}>사용 원사 (Yarn)</Th>
            <Th span={6}>조직 부호 (Dial & Cylinder)</Th>
            <Th span={2} className="justify-center">루프장(L/L)</Th>
            <Th span={1} className="justify-center">삭제</Th>

            {feeders.map((feeder, idx) => (
              <React.Fragment key={idx}>
                <Td span={1} className="flex items-center justify-center bg-slate-50"><span className="text-[10px] font-mono font-bold text-slate-500">{idx+1}</span></Td>
                <Td span={2}>
                  <TSelect value={feeder.yarnSlot||''} onChange={e=>handleFeederChange(idx,'yarnSlot',e.target.value)} disabled={isFullyLocked}>
                    <option value="">-</option><option value="1">Yarn #1</option><option value="2">Yarn #2</option><option value="3">Yarn #3</option><option value="4">Yarn #4</option>
                  </TSelect>
                </Td>
                <Td span={6}><TInput value={feeder.symbol||''} onChange={e=>handleFeederChange(idx,'symbol',e.target.value)} readOnly={isFullyLocked} placeholder="부호 나열" className="text-center font-mono text-sm tracking-widest text-slate-800"/></Td>
                <Td span={2}><TInput value={feeder.loopLength||''} onChange={e=>handleFeederChange(idx,'loopLength',e.target.value)} readOnly={isFullyLocked} placeholder="L/L" className="text-center font-mono"/></Td>
                <Td span={1} className="flex items-center justify-center">
                  {!isFullyLocked && <button onClick={()=>removeFeeder(idx)} disabled={feeders.length<=1} className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"><Minus className="w-3 h-3"/></button>}
                </Td>
              </React.Fragment>
            ))}
          </div>
        </div>


        {/* ------------------------------------------- */}
        {/* 4. 염색 & 후가공 Grid */}
        {/* ------------------------------------------- */}
        <h3 className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-800 block"/> 염색 및 가공 (Dyeing & Finishing)</h3>
        <div className="border-l border-t border-slate-300 grid grid-cols-4 md:grid-cols-8 mb-6">
          <Th span={1}>염가공처</Th>
          <Td span={3}><TInput value={sheetInput.dyeing?.factory||''} onChange={e=>handleSectionChange('dyeing','factory',e.target.value)} readOnly={isFullyLocked} placeholder="공장명"/></Td>
          <Th span={1}>가공방법</Th>
          <Td span={3}><TInput value={sheetInput.dyeing?.processMethod||''} onChange={e=>handleSectionChange('dyeing','processMethod',e.target.value)} readOnly={isFullyLocked} placeholder="릴렉스 → 텐타"/></Td>
          
          <Th span={1}>염색 후 폭</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.dyedWidth||''} onChange={e=>handleSectionChange('dyeing','dyedWidth',e.target.value)} readOnly={isFullyLocked} placeholder="56인치"/></Td>
          <Th span={1}>텐타 기계폭</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.tenterWidth||''} onChange={e=>handleSectionChange('dyeing','tenterWidth',e.target.value)} readOnly={isFullyLocked} placeholder="60인치"/></Td>
          <Th span={1}>텐타 온도</Th>
          <Td span={1}><TInput value={sheetInput.dyeing?.tenterTemp||''} onChange={e=>handleSectionChange('dyeing','tenterTemp',e.target.value)} readOnly={isFullyLocked} placeholder="180℃"/></Td>
          <Th span={1}>포속 / 오버피더</Th>
          <Td span={1} className="flex divide-x divide-slate-300">
             <TInput value={sheetInput.dyeing?.fabricSpeed||''} onChange={e=>handleSectionChange('dyeing','fabricSpeed',e.target.value)} readOnly={isFullyLocked} placeholder="20m/m" className="text-center w-1/2"/>
             <TInput value={sheetInput.dyeing?.overFeeder||''} onChange={e=>handleSectionChange('dyeing','overFeeder',e.target.value)} readOnly={isFullyLocked} placeholder="+5%" className="text-center w-1/2 bg-slate-50"/>
          </Td>
          
          <Th span={1} className="bg-slate-200">후가공 업체</Th>
          <Td span={1} className="bg-slate-50"><TInput value={sheetInput.finishing?.factory||''} onChange={e=>handleSectionChange('finishing','factory',e.target.value)} readOnly={isFullyLocked} placeholder="업체명"/></Td>
          <Th span={1} className="bg-slate-200">후가공 종류</Th>
          <Td span={1} className="bg-slate-50"><TInput value={sheetInput.finishing?.type||''} onChange={e=>handleSectionChange('finishing','type',e.target.value)} readOnly={isFullyLocked} placeholder="기모, 가공..."/></Td>
          <Th span={1} className="bg-slate-200">후가공 방법</Th>
          <Td span={3} className="bg-slate-50"><TInput value={sheetInput.finishing?.method||''} onChange={e=>handleSectionChange('finishing','method',e.target.value)} readOnly={isFullyLocked} placeholder="세부방법 기재"/></Td>

          <Th span={1}>염가공 메모</Th>
          <Td span={7}><TInput value={sheetInput.dyeing?.remarks||''} onChange={e=>handleSectionChange('dyeing','remarks',e.target.value)} readOnly={isFullyLocked} placeholder="특이사항 메모..."/></Td>
        </div>

        {/* ------------------------------------------- */}
        {/* 5. 최종 실측 & 원가 계산 (하이라이트 구역) */}
        {/* ------------------------------------------- */}
        <div className="mt-8 flex items-end justify-between mb-1.5">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-600 block"/> 최종 스펙 및 원가 (Actual & Cost)</h3>
          <p className="text-[9px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">※ 색칠된 칸이 최종 거래 스펙 및 가격의 기준이 됩니다.</p>
        </div>
        
        <div className="border-l border-t-2 border-slate-800 grid grid-cols-4 md:grid-cols-10 mb-6 bg-slate-50">
          
          {/* 스펙 실측 ROW */}
          <Th span={1} className="bg-emerald-100 !border-b-emerald-200 text-emerald-900 justify-center">생지중량 G/YD</Th>
          <Td span={1} className="bg-emerald-50"><TInput value={sheetInput.actualData?.greigeWeight||''} onChange={e=>handleActualDataChange('greigeWeight',e.target.value)} placeholder="320" className="text-center font-mono font-bold text-emerald-700"/></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black focus:!bg-indigo-100">최종 외폭 (")</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="widthFull" value={sheetInput.costInput?.widthFull??''} onChange={handleCostInputChange} placeholder="58" className="text-center font-mono font-black text-indigo-800 text-sm focus:!bg-indigo-100"/></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black focus:!bg-indigo-100">최종 내폭 (")</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="widthCut" value={sheetInput.costInput?.widthCut??''} onChange={handleCostInputChange} placeholder="56" className="text-center font-mono font-black text-indigo-800 text-sm focus:!bg-indigo-100"/></Td>
          <Th span={1} className="bg-indigo-100 !border-b-indigo-200 text-indigo-900 justify-center text-[11px] !font-black focus:!bg-indigo-100">최종 GSM</Th>
          <Td span={1} className="bg-indigo-50"><TInput type="number" name="gsm" value={sheetInput.costInput?.gsm??''} onChange={handleCostInputChange} placeholder="300" className="text-center font-mono font-black text-indigo-800 text-sm focus:!bg-indigo-100"/></Td>
          <Th span={1} className="bg-indigo-100 !border-indigo-200 text-indigo-900 justify-center border-l border-l-slate-300">G/YD (수동)</Th>
          <Td span={1} className="bg-white"><TInput type="number" name="costGYd" value={sheetInput.costInput?.costGYd??''} onChange={handleCostInputChange} className="text-center font-mono font-bold bg-yellow-50"/></Td>

          {/* 원가 항목 제목 ROW */}
          <Th span={1} className="bg-slate-200 justify-center text-[9px] !py-0.5">항목</Th>
          <Th span={3} className="bg-slate-200 justify-center text-[9px] !py-0.5">기본 생산 요율 적용 단가 (1K / 3K / 5K)</Th>
          <Th span={2} className="bg-slate-200 justify-center text-[9px] !py-0.5 text-amber-700">편직 로스율 (Knitting Loss)</Th>
          <Th span={2} className="bg-slate-200 justify-center text-[9px] !py-0.5 text-blue-700">염색 로스율 (Dyeing Loss)</Th>
          <Th span={1} className="bg-slate-200 justify-center text-[9px] !py-0.5 border-l border-l-slate-300">마진 등급</Th>
          <Td span={1} rowSpan={2} className="bg-white border-l border-l-slate-300">
             <TSelect value={sheetInput.costInput?.marginTier??3} onChange={e=>handleCostInputChange({target:{name:'marginTier',value:Number(e.target.value)}})} className="h-full text-center font-bold text-slate-800 bg-slate-100 border-none appearance-none">
               <option value={1}>1급 (13%)</option><option value={2}>2급 (16%)</option><option value={3}>3급 (19%)</option><option value={4}>4급 (22%)</option><option value={5}>5급 (25%)</option>
             </TSelect>
          </Td>

          {/* 원가 항목 데이터 ROW 1 (편직/염색 등) */}
          <Th span={1} className="bg-slate-100">편직비/YD</Th>
          <Td span={3} className="flex divide-x divide-slate-200">
             <TInput type="number" name="knittingFee1k" value={sheetInput.costInput?.knittingFee1k??''} onChange={handleCostInputChange} placeholder="1K" className="text-right font-mono w-1/3 text-slate-700"/>
             <TInput type="number" name="knittingFee3k" value={sheetInput.costInput?.knittingFee3k??''} onChange={handleCostInputChange} placeholder="3K" className="text-right font-mono w-1/3 font-bold text-slate-800 bg-indigo-50/30"/>
             <TInput type="number" name="knittingFee5k" value={sheetInput.costInput?.knittingFee5k??''} onChange={handleCostInputChange} placeholder="5K" className="text-right font-mono w-1/3 text-slate-700"/>
          </Td>
          <Td span={2} className="flex divide-x divide-slate-200 bg-amber-50">
             {['tier1k','tier3k','tier5k'].map(t=><TInput key={t} type="number" value={sheetInput.costInput?.losses?.[t]?.knit??''} onChange={e=>handleCostNestedChange('losses',t,'knit',e.target.value)} placeholder={`${t[4]}K%`} className="text-center w-1/3 font-mono text-[10px] text-amber-700"/>)}
          </Td>
          <Td span={2} className="flex divide-x divide-slate-200 bg-blue-50">
             {['tier1k','tier3k','tier5k'].map(t=><TInput key={t} type="number" value={sheetInput.costInput?.losses?.[t]?.dye??''} onChange={e=>handleCostNestedChange('losses',t,'dye',e.target.value)} placeholder={`${t[4]}K%`} className="text-center w-1/3 font-mono text-[10px] text-blue-700"/>)}
          </Td>
          <Th span={1} className="bg-slate-100 border-l border-l-slate-300">염가공비/YD</Th>
          {/* 염가공비는 ROW가 병합된 느낌으로 하나로 둠 */}
          <Td span={1} rowSpan={3} className="border-l border-l-slate-300">
             <TInput type="number" name="dyeingFee" value={sheetInput.costInput?.dyeingFee??''} onChange={handleCostInputChange} placeholder="전구간 통합" className="text-center h-full font-mono text-sm font-bold bg-white text-slate-800"/>
          </Td>

          {/* 원가 항목 데이터 ROW 2 (부대비) */}
          <Th span={1} className="bg-slate-100 text-slate-500">부대비/YD</Th>
          <Td span={3} className="flex divide-x divide-slate-200">
             <TInput type="number" name="extraFee1k" value={sheetInput.costInput?.extraFee1k??''} onChange={handleCostInputChange} placeholder="1K" className="text-right font-mono w-1/3 text-slate-500"/>
             <TInput type="number" name="extraFee3k" value={sheetInput.costInput?.extraFee3k??''} onChange={handleCostInputChange} placeholder="3K" className="text-right font-mono w-1/3 text-slate-500"/>
             <TInput type="number" name="extraFee5k" value={sheetInput.costInput?.extraFee5k??''} onChange={handleCostInputChange} placeholder="5K" className="text-right font-mono w-1/3 text-slate-500"/>
          </Td>
          <Th span={1} className="bg-slate-100 border-l border-l-slate-300">직납로고비/YD</Th>
          <Td span={3} className="flex divide-x divide-slate-200 bg-purple-50">
             {['tier1k','tier3k','tier5k'].map(t=><TInput key={t} type="number" value={sheetInput.costInput?.brandExtra?.[t]??''} onChange={e=>handleCostInputChange({target:{name:`brandExtra_${t}`,value:e.target.value}})} placeholder={`${t[4]}K%`} className="text-right w-1/3 font-mono text-purple-700"/>)}
          </Td>
          <Th span={1} className="bg-slate-100 border-l border-l-slate-300 border-b-none"></Th>

          {/* 원가 항목 데이터 ROW 3 (Summary Banner) */}
          <Td span={9} className="bg-slate-800 p-0 border-none rounded-bl border-b-[3px] border-b-indigo-500">
            {costData && (
              <div className="flex divide-x divide-slate-700">
                 {['tier1k','tier3k','tier5k'].map((tier,i) => {
                   const data = viewMode==='export'?costData[tier]?.export:costData[tier]?.domestic;
                   const pre = viewMode==='export'?'$':'₩';
                   const fmt = v => viewMode==='export'?(v||0).toFixed(2):num(v||0);
                   const is3K = tier === 'tier3k';
                   return (
                     <div key={tier} className={`flex-1 flex flex-col items-center justify-center py-2 ${is3K ? 'bg-indigo-900 shadow-inner' : ''}`}>
                       <span className={`text-[10px] font-bold ${is3K ? 'text-indigo-200' : 'text-slate-500'} tracking-widest uppercase mb-0.5`}>{['1,000','3,000','5,000'][i]} YDS</span>
                       <div className="flex items-center gap-4">
                         <div className="text-right">
                           <p className="text-[9px] text-slate-500">원가</p>
                           <p className="text-xs font-mono text-slate-400">{pre}{fmt(data?.totalCostYd)}</p>
                         </div>
                         <div className="w-px h-6 bg-slate-700 mx-1"></div>
                         <div className="text-right">
                           <p className="text-[9px] text-slate-400">기본단가</p>
                           <p className={`text-sm font-mono font-bold ${is3K?'text-blue-300':'text-slate-300'}`}>{pre}{fmt(data?.priceConverter)}</p>
                         </div>
                         <div className="w-px h-8 bg-slate-600 mx-1"></div>
                         <div className="text-right">
                           <p className="text-[10px] text-yellow-500/80 font-bold tracking-wider">직납(Brand)</p>
                           <p className={`text-xl font-mono font-black ${is3K ? 'text-yellow-400' : 'text-yellow-300/80'}`}>{pre}{fmt(data?.priceBrand)}</p>
                         </div>
                       </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </Td>
        </div>


        {/* 메모 및 서명 영역 */}
        {editingSheetId && (
          <div className="mt-8 border-2 border-amber-300 bg-amber-50 p-4 relative mb-4">
            <h4 className="absolute -top-2 left-4 bg-amber-50 px-2 text-[10px] font-extrabold text-amber-700 tracking-wider">※ 설계 변경 사유</h4>
            <textarea value={sheetInput.changeReason||''} onChange={e=>handleSheetChange({target:{name:'changeReason',value:e.target.value}})} placeholder="수정 사유를 기재해 주세요 (이력 보관 시 필요)" className="w-full bg-transparent border-none outline-none text-xs text-amber-900 placeholder-amber-400/50 resize-none h-10 mt-1"/>
          </div>
        )}

        <div className="flex items-end justify-between mt-6 pt-4 border-t-2 border-slate-900">
           <div>
             <p className="text-[10px] text-slate-500 mb-1">본 문서는 시스템에 의해 전자 기록됩니다.</p>
             <p className="text-[10px] text-slate-800 font-extrabold flex items-center gap-2">작성자: <span className="underline decoration-slate-300 underline-offset-4">{user?.displayName||'관리자'}</span></p>
           </div>
           
           {/* 문서 끝 */}
           <div className="w-16 h-16 border-4 border-double border-red-500 rounded-full flex items-center justify-center opacity-70 transform -rotate-12">
             <span className="text-xs font-black text-red-500 tracking-tighter">GRUBIG<br/>APP.</span>
           </div>
        </div>
      </div>
    </div>
  );
};
