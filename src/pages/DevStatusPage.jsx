import React, { useState, useMemo } from 'react';
import { Activity, Edit2, FileText, Plus, Search, Printer, Archive, ArrowRight, XCircle, Flame, Hourglass, Sparkles, ClipboardList, Info, ChevronDown, ChevronUp, Link2, Unlink, Calculator, Trash2, CheckCircle2, PackageCheck } from 'lucide-react';
import { DEV_REQUEST_STATUS_LABELS, DEV_REQUEST_STATUS_BADGE_CLS } from '../constants/common';
import { PendingProgressBar } from '../components/design-sheet/PendingProgressBar';
import { DevRequestFormModal } from '../components/dashboard/DevRequestFormModal';
import { DevArchiveModal } from '../components/dashboard/DevArchiveModal';
import { DevRequestPrintSheet } from '../components/dashboard/DevRequestPrintSheet';
import { DevCostQuoteModal } from '../components/dashboard/DevCostQuoteModal';
import { DevDropModal } from '../components/dashboard/DevDropModal';
import { DevQuoteBadge } from '../components/dashboard/DevQuoteBadge';
import { ModalBackdrop } from '../components/common/ModalBackdrop';
import { UnsavedChangesDialog } from '../components/common/UnsavedChangesDialog';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { getDevQuoteBadge, indexDevQuotes } from '../utils/devQuoteModel';
import { formatMonthDay } from '../utils/helpers';

// 개발 의뢰 단계 설명 (바이어 의뢰 접수~개발 가능 여부 확인까지)
const DEV_REQ_STAGE_GUIDE = [
  { key: 'pending',   label: '의뢰 접수', desc: '바이어로부터 개발 의뢰서 접수 완료, 분석 전 상태', dot: 'bg-amber-400' },
  { key: 'analyzing', label: '분석 중',   desc: '의뢰 내용 분석 (맞는 원사·편직기·단가 검토 진행)', dot: 'bg-blue-400' },
  { key: 'hold',      label: '대기 중',   desc: '분석 완료, 개발 진행 여부 최종 결정 대기', dot: 'bg-purple-400' }
];

// 설계서 단계 설명 (개발 확정 / 자체 개발 → 아이템화)
//  2026-10-10: EZ-TEX O/D NO.를 등록하면 '샘플 진행'으로 넘어가고 생산 현황(샘플)으로 → 이 화면에서는 빠짐
const DESIGN_STAGE_GUIDE = [
  { key: 'draft',    label: '설계서 작성',     desc: '개발 확정 의뢰의 [설계 시작] 또는 [자체 설계서] — 스펙·원사 배합 작성', dot: 'bg-slate-400' },
  { key: 'eztex',    label: 'EZ-TEX O/D NO.', desc: 'EZ-TEX(그루빅 생산 ERP)에 오더 등록 → 줄의 번호 칸에 넣고 [등록]하면 생산 현황(샘플)으로 넘어가요', dot: 'bg-violet-400' },
  { key: 'sampling', label: '샘플 진행',       desc: '생산 현황(샘플)에서 원사·편직·염가공 진행 관리 — 이 표에서는 빠져요', dot: 'bg-amber-400' },
  { key: 'articled', label: '아이템화',        desc: '샘플이 끝나면 생산 현황에서 아이템화(원단 등록) — 또는 Drop', dot: 'bg-emerald-500' }
];

// ── 날짜·긴급도·검색 (화면 상태와 무관한 순수 함수 — 목록 계산(useMemo)에서 그대로 씀) ──
const getDaysUntil = (d) => { if(!d) return null; const t=new Date(d),n=new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t-n)/864e5); };
// 우선순위 (지연/임박/오늘 신규)
const getDevReqDeadline = (d) =>
  (d.status === 'pending' || d.status === 'analyzing') ? d.targetSpec?.analysisDeadline
  : (d.status === 'hold' || d.status === 'confirmed') ? d.targetSpec?.sampleDeadline
  : null;
const getUrgency = (deadlineDate) => {
  const days = getDaysUntil(deadlineDate);
  if (days === null) return 'normal';
  if (days < 0) return 'overdue';
  if (days <= 3) return 'urgent';
  return 'normal';
};
const isCreatedToday = (iso) => {
  if (!iso) return false;
  const t = new Date(iso); const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
};
// 상단 요약 카드로 고른 우선순위 필터 통과 여부
const passesPriorityFilter = (priorityFilter, urgency, item) => {
  if (priorityFilter === 'all') return true;
  if (priorityFilter === 'overdue') return urgency === 'overdue';
  if (priorityFilter === 'urgent') return urgency === 'urgent';
  if (priorityFilter === 'newToday') return isCreatedToday(item?.createdAt);
  return true;
};
// ── 개발 건 한 줄 (대표님 요청 2026-10-10 — '설계서 진행 현황' 표를 없애고 개발 의뢰 현황 한 표로) ──
//  row = { key, kind, dev, sheet, linkedDev }
//   kind 'dev'  = 의뢰만 (의뢰 접수 ~ 개발 확정 — 설계서 아직 없음)
//        'both' = 의뢰 + 설계서 (설계서 작성 ~ EZ-TEX 등록 전)
//        'self' = 설계서만 (자체개발 — 또는 의뢰가 Drop·삭제된 설계서. linkedDev = 설계서가 가리키는 의뢰)
//  빠지는 것: EZ-TEX 를 등록해 생산 현황 샘플 오더가 생긴 설계서(→ 생산 현황) · 아이템화 · Drop
const rowOdNo = (row) => String(row.dev?.devOrderNo || row.sheet?.devOrderNo || '').trim();
const rowTitle = (row) => (row.dev
  ? (row.dev.devItem || row.dev.targetSpec?.composition || '품목명 미입력')
  : (row.sheet?.fabricName || '원단명 미입력'));
// 의뢰 + 설계서 줄: 설계서 원단명을 둘째 줄에 (품목명과 같으면 한 번만)
const showSheetName = (row) => !!(row.dev && row.sheet)
  && String(row.sheet.fabricName || '').trim() !== String(rowTitle(row)).trim();
// 납기: 설계서가 있으면 설계서 납기(없으면 의뢰 샘플 납기), 의뢰만이면 그 단계의 납기 (분석 마감 / 샘플 납기)
const rowDeadline = (row) => (row.sheet
  ? (row.sheet.deadline || (row.dev ? getDevReqDeadline(row.dev) : null) || null)
  : getDevReqDeadline(row.dev));
const rowUrgency = (row) => getUrgency(rowDeadline(row));
// 지금 단계에 들어온 때 (📅 MM/DD · N일째)
const rowEnteredAt = (row) => (row.sheet
  ? (row.sheet.stageEnteredAt?.[row.sheet.stage] || row.sheet.updatedAt || row.sheet.createdAt)
  : (row.dev.statusEnteredAt?.[row.dev.status] || row.dev.updatedAt || row.dev.createdAt));
const rowCreatedAt = (row) => row.dev?.createdAt || row.sheet?.createdAt || '';
const rowUpdatedAt = (row) => [row.dev?.updatedAt || row.dev?.createdAt, row.sheet?.updatedAt || row.sheet?.createdAt]
  .filter(Boolean).sort().pop() || '';
// 단계순: 의뢰 접수 → 분석 → 대기 → 개발 확정(설계 대기) → 설계서 작성 → EZ-TEX → 샘플 진행(번호만 있고 생산 현황 전)
const ROW_STAGE_ORDER = { pending: 0, analyzing: 1, hold: 2, confirmed: 3, draft: 4, eztex: 5, sampling: 6 };
const rowStageOrder = (row) => ROW_STAGE_ORDER[row.sheet ? row.sheet.stage : row.dev.status] ?? 9;
const rowBuyerName = (row) => row.dev?.buyerName || row.linkedDev?.buyerName || '';
// 설계서 줄의 [연결] / [해제]: 의뢰를 가리키지 않거나 그 의뢰가 없으면 연결, 아니면 해제
const canLinkSheet = (row) => !row.sheet?.devRequestId || (!row.dev && !row.linkedDev);
// 검색어 — 비었으면 모두 통과 (의뢰 + 설계서 칸)
const rowMatchesSearch = (row, searchTerm) => {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;
  const { dev: d, sheet: s } = row;
  return [
    rowBuyerName(row), d?.devOrderNo, d?.devItem, d?.targetSpec?.composition,
    s?.fabricName, s?.devOrderNo, s?.articleNo, s?.eztexOrderNo,
  ].some(v => String(v || '').toLowerCase().includes(q));
};

// 단계 진입 날짜 → "MM/DD · N일째" 포맷
const formatStageEntry = (iso) => {
  if (!iso) return null;
  const t = new Date(iso); if (isNaN(t)) return null;
  const days = Math.floor((new Date().setHours(0,0,0,0) - new Date(t).setHours(0,0,0,0)) / 86400000);
  return `${formatMonthDay(iso)} · ${days === 0 ? '오늘' : `${days}일째`}`;
};

// [원가 견적] 버튼 — 원가 견적을 저장한 의뢰는 초록 바탕 + ✔ (대표님 요청 2026-10-06: 원가 견적이 필요 없는 의뢰도 있어서
//  해 준 의뢰를 버튼만 보고 알 수 있게). 마우스를 올리면 저장 날짜·이 의뢰로 만든 견적서 건수. 누르면 원가 견적 창 (다시 보기·고치기)
const CostQuoteButton = ({ devReq, quoteCount = 0, onClick, size = 'sm' }) => {
  const done = !!devReq?.costQuote;
  const savedAt = formatMonthDay(devReq?.costQuote?.updatedAt);
  const title = done
    ? `원가 견적 완료${savedAt ? ` · ${savedAt} 저장` : ''}${quoteCount > 0 ? ` (견적서 ${quoteCount}건)` : ' (견적서는 아직 없음)'} — 눌러서 보기·고치기 / 견적서 만들기`
    : '예상 스펙으로 원가·판매가 계산 (바이어가 가격부터 볼 때)';
  const sizeCls = size === 'md' ? 'gap-1 px-2 py-1.5 text-[11px] justify-center' : 'gap-1 px-2 py-0.5 text-[10px]';
  const toneCls = done
    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50';
  const Icon = done ? CheckCircle2 : Calculator;
  return (
    <button onClick={onClick} title={title} className={`flex items-center font-bold rounded border ${sizeCls} ${toneCls}`}>
      <Icon className="w-3 h-3" /> 원가 견적
    </button>
  );
};

// 목록 줄의 🗑 (영구 삭제 — 복구 불가, 보관만 하려면 Drop) — 개발 의뢰·설계서 공통
//  PC 표는 아이콘만 (sm), 모바일 카드는 '삭제' 글자까지 (md)
const RowDeleteButton = ({ onClick, title, size = 'sm' }) => (size === 'md' ? (
  <button onClick={onClick} title={title}
    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white text-slate-500 text-[11px] font-bold rounded border border-slate-200">
    <Trash2 className="w-3 h-3"/> 삭제
  </button>
) : (
  <button onClick={onClick} title={title}
    className="flex items-center px-1.5 py-0.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 hover:border-red-200">
    <Trash2 className="w-3.5 h-3.5"/>
  </button>
));

// 설계서 줄의 EZ-TEX O/D NO. 칸 + [등록] (대표님 요청 2026-10-10)
//  등록하면 '샘플 진행'으로 넘어가고 생산 현황에 샘플 오더가 생김 → 그 줄은 이 표에서 빠짐 (useDesignSheet.registerEztexOrderNo)
//  번호가 이미 있는 설계서(예전에 등록)는 버튼이 [생산 현황에 올리기] — 같은 번호로 다시 등록 = 샘플 오더 만들기·연결
//  onSubmit(sheet, 입력칸) — PC 표·모바일 카드가 칸을 하나씩 가지므로 누른 줄의 칸을 같이 넘김
const EztexRegister = ({ sheet, onSubmit, size = 'sm' }) => {
  const has = !!String(sheet.eztexOrderNo || '').trim();
  const title = has
    ? `EZ-TEX ${sheet.eztexOrderNo} 번호로 생산 현황에 샘플 오더를 만들어요 ('샘플 진행'으로)`
    : "EZ-TEX O/D NO.를 넣고 등록하면 '샘플 진행'으로 넘어가고 생산 현황에 샘플 오더가 생겨요";
  const input = (cls) => (
    <input
      key={`${sheet.id}_${sheet.eztexOrderNo || ''}`}
      type="text"
      placeholder={size === 'md' ? 'EZ-TEX O/D NO.' : 'EZ-TEX O/D'}
      defaultValue={sheet.eztexOrderNo || ''}
      onKeyDown={e => { if (e.key === 'Enter') onSubmit(sheet, e.currentTarget); }}
      className={`border border-violet-200 bg-violet-50/40 rounded font-mono focus:bg-white focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300 ${cls}`}
    />
  );
  const button = (cls) => (
    <button
      onClick={e => onSubmit(sheet, e.currentTarget.previousElementSibling)}
      title={title}
      className={`flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded shadow-sm whitespace-nowrap ${cls}`}
    >
      {has ? <><PackageCheck className="w-3 h-3"/> 생산 현황에 올리기</> : '등록'}
    </button>
  );
  if (size === 'md') {
    return (
      <div className="flex gap-1.5">
        {input('flex-1 w-0 px-2 py-1.5 text-xs')}
        {button('px-3 py-1.5 text-[11px]')}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {input('w-[96px] px-2 py-0.5 text-[10px]')}
      {button('px-2 py-0.5 text-[10px]')}
    </span>
  );
};

// 바이어 칸: 의뢰 바이어 / 설계서가 가리키는 의뢰(Drop 등)의 바이어 + 상태 / 자체개발
const RowBuyer = ({ row }) => {
  if (row.dev) return <>{row.dev.buyerName || '-'}</>;
  if (row.linkedDev) {
    return (
      <span title="이 설계서가 가리키는 개발 의뢰는 지금 이 표에 없어요 (Drop 등)">
        {row.linkedDev.buyerName || '-'}
        <span className="ml-1 text-[9px] font-normal text-slate-400">(의뢰 {DEV_REQUEST_STATUS_LABELS[row.linkedDev.status] || row.linkedDev.status})</span>
      </span>
    );
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">자체개발</span>;
};

/**
 * 개발/설계 현황 — 리스트형 대시보드
 * - 개발 의뢰 현황 한 표 (대표님 요청 2026-10-10 — 예전 '설계서 진행 현황' 표를 합침). 한 줄 = 개발 건 하나 (위 row 설명)
 *   · 의뢰: 의뢰 접수 → 분석 → 대기 → 개발 확정 → [설계 시작]
 *   · [원가 견적] 예상 스펙으로 원가·판매가 계산 → 저장 / [견적서 만들기] (대표님 요청 2026-10-06 — 가격 보고 개발 여부를 정하는 바이어)
 *   · 설계서가 있는 줄: 설계서 단계 · [설계서 열기] · EZ-TEX O/D NO. [등록] → '샘플 진행' + 생산 현황 샘플 오더 → 이 표에서 빠짐
 *     (useDesignSheet.registerEztexOrderNo). 번호만 있고 오더가 없는 예전 설계서는 [생산 현황에 올리기]
 *   · [Drop] 의뢰 줄 = 사유와 같이 (설계서가 있으면 설계서도 같이 Drop — 대표님 결정) / 자체개발 줄 = 설계서 Drop (보관함, 복원 가능)
 *   · 🗑 의뢰만 있는 줄 = 의뢰 영구 삭제 / 설계서가 있는 줄 = 설계서만 삭제 (useDesignSheet.handleDeleteSheet — 의뢰·원단·샘플 오더는 남고 연결만 풀림)
 * - 샘플 진행·아이템화·Drop 은 생산 현황(샘플)에서. 생산 현황으로 넘어간 의뢰는 보관함 '샘플 진행 (생산 현황)'
 * - 아이템화 완료된 설계서는 [설계서 보관함] 페이지에서 관리
 */
export const DevStatusPage = ({
  devRequests, designSheets, devInput, editingDevId,
  handleDevChange, handleSpecChange, handleSaveDevRequest,
  handleEditDevRequest, handleDeleteDevRequest, resetDevForm,
  createDesignSheetFromDev, initFromDevRequest, updateDevStatus,
  handleEditSheet, handleDeleteSheet, saveDocToCloud, setStage, dropDesignSheet,
  linkSheetToDevRequest, unlinkSheetFromDevRequest,
  setActiveTab, user, buyers,
  generateDevOrderNo, setIsBuyerModalOpen,
  setIsDesignSheetModalOpen,
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
  getBlankDevInput,   // 새 의뢰의 빈 양식 (저장 안 한 변경 확인 기준)
  // ── 원가 견적 (개발 의뢰) ──
  savedQuotes = [],                       // 견적서 목록 — 이 의뢰로 만든 견적서·목록 배지
  yarnSelectOptions = [], yarnLibrary = [],
  costSettings = null, onOpenCostSettings,
  exchangeRates = null,                   // 공통 환율 두 칸 { domestic, export } — 원가 견적 창이 고른 시장의 환율을 씀
  calculateCost, createQuoteItem,         // 원단과 같은 원가 엔진 · 견적서 품목 계산
  saveDevCostQuote,                       // (devReqId, costQuote, user) => 저장한 costQuote | false
  dropDevRequest,                         // (devReqId, { reason, memo }, user) => boolean
  onStartQuoteFromDev,                    // (원가 견적을 붙인 의뢰) => 견적서 화면으로
  // ── 샘플 진행 = 생산 현황 (대표님 요청 2026-10-10) ──
  registerEztexOrderNo,                   // (sheetId, 번호) → 저장 + '샘플 진행' + 생산 현황 샘플 오더
  productionOrders = [],                  // 생산 현황 오더 — 샘플 오더가 생긴 설계서는 이 표에서 빠짐
  onOpenProductionOrder,                  // (order#) → 생산 현황으로 가서 그 오더 보기 (보관함 '샘플 진행')
  onNewSelfSheet,                         // [자체 설계서] — 의뢰 없이 새 설계서 (자체개발 줄)
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [costQuoteDevId, setCostQuoteDevId] = useState(null); // 원가 견적 창을 연 의뢰 id
  const [dropTargetId, setDropTargetId] = useState(null);     // Drop 사유 창을 연 의뢰 id
  // 의뢰 등록/수정 창 — 닫기(X·취소·배경) 때 저장 안 한 변경이 있으면 '저장할까요?' (원단 편집과 같음)
  const [devLeavePending, setDevLeavePending] = useState(false);
  const devGuard = useUnsavedGuard(devInput, showDevModal, {
    initial: !editingDevId && getBlankDevInput ? getBlankDevInput() : null,
  });
  const closeDevModal = () => { setDevLeavePending(false); resetDevForm(); setShowDevModal(false); };
  const requestCloseDevModal = () => { if (devGuard.isDirty()) setDevLeavePending(true); else closeDevModal(); };
  const [searchTerm, setSearchTerm] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [printMode, setPrintMode] = useState('knit');   // knit(편직처 전달용) | internal(내부 전달용)
  const [printMenuId, setPrintMenuId] = useState(null); // 인쇄 모드 드롭다운이 열린 의뢰 ID
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showGuide, setShowGuide] = useState(false);
  const [devSortBy, setDevSortBy] = useState('odno');   // odno | date | stage | buyer
  const [linkTargetSheet, setLinkTargetSheet] = useState(null); // '의뢰 연결' 모달 대상 설계서
  const [linkSearch, setLinkSearch] = useState('');

  const statusLabels = DEV_REQUEST_STATUS_LABELS;
  const statusCls = DEV_REQUEST_STATUS_BADGE_CLS;

  const deadlineBadge = (d) => {
    const v=getDaysUntil(d); if(v===null) return null;
    if(v<0) return { t:`D+${-v} 지연`, c:'bg-red-500 text-white' };
    if(v===0) return { t:'Today', c:'bg-red-500 text-white' };
    if(v<=3) return { t:`D-${v} 임박`, c:'bg-orange-100 text-orange-700 border border-orange-300' };
    return { t:`D-${v}`, c:'bg-slate-100 text-slate-600 border border-slate-300' };
  };

  // 경과일 계산 (updatedAt 기준)
  const daysSince = (iso) => {
    if (!iso) return null;
    const t = new Date(iso); const n = new Date();
    return Math.floor((n - t) / 86400000);
  };

  // 설계서 → 생산 현황 샘플 오더 (오더의 linkedSheetId) — 샘플 오더가 생긴 설계서는 생산 현황에서 관리 (이 표에서 빠짐)
  const sampleOrderBySheet = useMemo(() => {
    const map = new Map();
    (productionOrders || []).forEach(o => { if (o.linkedSheetId) map.set(String(o.linkedSheetId), o); });
    return map;
  }, [productionOrders]);

  // 의뢰별 견적서 { 의뢰 id → 그 의뢰로 만든 견적서[] (최근 순) } — 목록 배지·✔ 버튼·삭제 확인이 같이 씀
  //  견적서가 바뀔 때만 한 번 만듦 (예전엔 줄마다·PC/모바일마다 전체 견적을 다시 훑었음 — 검색할 때마다)
  const devQuoteIndex = useMemo(() => indexDevQuotes(savedQuotes), [savedQuotes]);
  const quotesOfDev = (devReqId) => devQuoteIndex.get(String(devReqId)) || [];

  // 의뢰 수정 모달에서 삭제 (성공 시에만 모달 닫기 — 가드에 막히면 유지)
  //  이 의뢰로 만든 견적서가 있으면 확인 창에 같이 알려 줌
  const handleModalDelete = async () => {
    if (!editingDevId || !handleDeleteDevRequest) return;
    const ok = await handleDeleteDevRequest(editingDevId, { linkedQuoteCount: quotesOfDev(editingDevId).length });
    if (ok) setShowDevModal(false);
  };

  // 목록 줄의 [삭제] — 수정 창의 삭제와 같은 규칙 (설계서가 연결된 의뢰는 막힘, 복구 불가 확인)
  const handleRowDelete = async (devReq) => {
    if (!handleDeleteDevRequest) return;
    const ok = await handleDeleteDevRequest(devReq.id, { linkedQuoteCount: quotesOfDev(devReq.id).length });
    if (ok && costQuoteDevId === devReq.id) setCostQuoteDevId(null);
  };

  // '의뢰 연결' 후보: 아직 진행중 설계서에 연결되지 않은 (Drop 제외) 의뢰
  const linkCandidateDevs = useMemo(() =>
    (devRequests || []).filter(d =>
      d.status !== 'rejected' &&
      !(designSheets || []).some(s => s.devRequestId === d.id && s.status !== 'dropped')
    ), [devRequests, designSheets]);

  // 데이터 분류 — 개발 건 한 줄씩 (위 row 설명, 대표님 요청 2026-10-10)
  const rejectedDevReqs = useMemo(() => (devRequests||[]).filter(d=>d.status==='rejected'), [devRequests]);

  // 의뢰가 쓰고 있는 설계서 (Drop 제외 — 아이템화·생산 현황으로 간 것도 찾아서 그 의뢰를 표에서 빼는 데 씀)
  const sheetOfDev = useMemo(() => {
    const live = (designSheets || []).filter(s => s.status !== 'dropped');
    return (d) => live.find(s => s.devRequestId === d.id || (d.linkedDesignSheetId && s.id === d.linkedDesignSheetId)) || null;
  }, [designSheets]);
  // 줄 만들기 — 끝났거나(아이템화) 생산 현황 샘플 오더로 넘어간 설계서는 이 표에서 빠짐
  const workRows = useMemo(() => {
    const rows = [];
    const placed = new Set();
    (devRequests || []).forEach(d => {
      if (!['pending', 'analyzing', 'hold', 'confirmed'].includes(d.status)) return;
      const s = sheetOfDev(d);
      if (!s) {
        rows.push({ key: `d_${d.id}`, kind: 'dev', dev: d, sheet: null, linkedDev: null });
        return;
      }
      placed.add(s.id);
      if (s.stage === 'articled' || sampleOrderBySheet.has(String(s.id))) return;
      rows.push({ key: `d_${d.id}`, kind: 'both', dev: d, sheet: s, linkedDev: null });
    });
    // 의뢰 줄에 붙지 않은 진행 중 설계서 = 자체개발 (또는 의뢰가 Drop·삭제된 설계서)
    (designSheets || []).forEach(s => {
      if (s.status === 'dropped' || placed.has(s.id)) return;
      if (s.stage === 'articled' || sampleOrderBySheet.has(String(s.id))) return;
      const linkedDev = s.devRequestId ? (devRequests || []).find(d => d.id === s.devRequestId) || null : null;
      rows.push({ key: `s_${s.id}`, kind: 'self', dev: null, sheet: s, linkedDev });
    });
    return rows;
  }, [devRequests, designSheets, sheetOfDev, sampleOrderBySheet]);

  // 보관함: 생산 현황으로 넘어간 의뢰 (샘플 진행) · 아이템화된 설계서 · Drop된 의뢰
  const inProductionDevs = useMemo(() => (devRequests || []).filter(d => {
    if (d.status !== 'confirmed') return false;
    const s = sheetOfDev(d);
    return !!s && s.stage !== 'articled' && sampleOrderBySheet.has(String(s.id));
  }), [devRequests, sheetOfDev, sampleOrderBySheet]);
  const articledSheets = useMemo(
    () => (designSheets || []).filter(s => s.status !== 'dropped' && s.stage === 'articled'),
    [designSheets]
  );
  const archiveCount = rejectedDevReqs.length + inProductionDevs.length + articledSheets.length;

  // 의뢰 줄마다 원가 견적 배지 ('견적'/'예상' · ⚠) — PC 표·모바일 카드가 같이 쓰므로 한 번만 계산
  const devQuoteBadges = useMemo(
    () => new Map(workRows.filter(r => r.dev).map(r => [r.dev.id, getDevQuoteBadge(r.dev, devQuoteIndex.get(String(r.dev.id)) || [])])),
    [workRows, devQuoteIndex]
  );

  // 요약 메트릭 (표의 개발 건 기준)
  const metrics = useMemo(() => ({
    total: workRows.length,
    overdue: workRows.filter(r => rowUrgency(r) === 'overdue').length,
    urgent: workRows.filter(r => rowUrgency(r) === 'urgent').length,
    newToday: workRows.filter(r => isCreatedToday(rowCreatedAt(r))).length,
  }), [workRows]);

  // 의뢰 상태 → 통합 단계 매핑
  const devStageKey = (d) => {
    if (d.status === 'confirmed') return 'hold'; // confirmed(설계 대기) = 단계 3
    return d.status;
  };

  const visibleRows = useMemo(() => {
    const filtered = workRows.filter(r => rowMatchesSearch(r, searchTerm)
      && passesPriorityFilter(priorityFilter, rowUrgency(r), { createdAt: rowCreatedAt(r) }));
    const sorted = [...filtered];
    if (devSortBy === 'odno') {
      // O/D No.(개발번호) 오름차순 — 번호 없는 건(자체개발 등) 뒤로, 그 안에서는 최근 순
      sorted.sort((a, b) => {
        const na = rowOdNo(a);
        const nb = rowOdNo(b);
        if (!!na !== !!nb) return na ? -1 : 1;
        if (na && nb) return na.localeCompare(nb, 'ko');
        return rowUpdatedAt(b).localeCompare(rowUpdatedAt(a));
      });
    } else if (devSortBy === 'date') {
      sorted.sort((a, b) => rowUpdatedAt(b).localeCompare(rowUpdatedAt(a)));
    } else if (devSortBy === 'stage') {
      sorted.sort((a, b) => rowStageOrder(a) - rowStageOrder(b));
    } else if (devSortBy === 'buyer') {
      // 자체개발(바이어 없음)은 뒤로
      sorted.sort((a, b) => {
        const ba = rowBuyerName(a);
        const bb = rowBuyerName(b);
        if (!!ba !== !!bb) return ba ? -1 : 1;
        return ba.localeCompare(bb, 'ko');
      });
    }
    return sorted;
  }, [workRows, searchTerm, priorityFilter, devSortBy]);

  // 핸들러
  const handleGoToSheet = (devReq) => {
    const data = createDesignSheetFromDev(devReq);
    initFromDevRequest(data);
    if (setIsDesignSheetModalOpen) setIsDesignSheetModalOpen(true);
    else setActiveTab('designList');
  };

  const openNewModal = () => { resetDevForm(); setShowDevModal(true); };
  const openEditModal = (d) => { handleEditDevRequest(d); setShowDevModal(true); };

  // 저장이 실제로 끝나고 성공했을 때만 창 닫기
  const handleModalSave = async () => {
    if (await handleSaveDevRequest(user)) setShowDevModal(false);
  };
  // 확인창의 '저장하고 나가기'
  const saveDevAndClose = async () => {
    setDevLeavePending(false);
    if (await handleSaveDevRequest(user)) setShowDevModal(false);
  };

  /**
   * 개발 의뢰서 인쇄
   * @param {Object} devReq - 인쇄할 의뢰
   * @param {'knit'|'internal'} mode - knit: 편직처 전달용 / internal: 내부 전달용
   *
   * DevRequestPrintSheet 는 body 직속 포털이라, 인쇄 직전 body 에
   * 'printing-devreq' 클래스를 붙여야 견적서 PDF 대신 의뢰서가 출력된다. (index.css)
   */
  const handlePrint = (devReq, mode) => {
    setPrintMenuId(null);
    if (devReq.status === 'pending' && updateDevStatus) {
      updateDevStatus(devReq.id, 'analyzing');
    }
    setPrintTarget(devReq);
    setPrintMode(mode);

    const oldTitle = document.title;
    const label = mode === 'knit' ? '편직의뢰서' : '개발의뢰서_내부';
    document.body.classList.add('printing-devreq');
    setTimeout(() => {
      try {
        document.title = `${label}_${devReq.devOrderNo || ''}`;
        window.print();
      } finally {
        document.title = oldTitle;
        document.body.classList.remove('printing-devreq');
      }
    }, 300);
  };

  // [Drop] — 사유 창을 띄움 (가격·납기·품질/스펙·바이어 사정·기타). 사유 창이 없으면 예전처럼 확인만
  const handleDropDev = (devReq) => {
    if (dropDevRequest) { setDropTargetId(devReq.id); return; }
    if (!updateDevStatus) return;
    if (window.confirm(`개발 의뢰 ${devReq.devOrderNo}를 Drop(미진행) 처리할까요?`)) {
      updateDevStatus(devReq.id, 'rejected');
    }
  };
  // 원가 견적 창 — 열린 의뢰는 최신 목록에서 다시 찾음 (저장하면 목록 값이 바뀜)
  const costQuoteDev = costQuoteDevId ? (devRequests || []).find(d => d.id === costQuoteDevId) : null;
  const dropTargetDev = dropTargetId ? (devRequests || []).find(d => d.id === dropTargetId) : null;
  // Drop 하려는 의뢰가 쓰고 있는 설계서 (이 표에 있는 것 — 생산 현황으로 간 것·아이템화는 아님)
  const dropTargetSheet = dropTargetDev ? workRows.find(r => r.dev?.id === dropTargetDev.id)?.sheet || null : null;

  // 의뢰 Drop 사유 창의 [Drop 처리] — 설계서까지 쓴 개발 건은 설계서도 같이 Drop (대표님 결정 2026-10-10)
  //  설계서를 먼저 (확인 창·알림 없이, 의뢰 연결은 바로 뒤 의뢰 저장이 풂), 그다음 의뢰 (사유 저장 + 알림)
  //  설계서 Drop 이 안 되면 의뢰도 그대로 두고 창도 그대로
  const confirmDrop = async (reason, memo) => {
    if (!dropTargetId || !dropDevRequest) return;
    const sheet = dropTargetSheet;
    if (sheet && dropDesignSheet) {
      const okSheet = await dropDesignSheet(sheet.id, { confirm: false, quiet: true, keepDevLink: true });
      if (!okSheet) return;
    }
    const ok = await dropDevRequest(dropTargetId, { reason, memo, note: sheet ? '설계서도 같이 Drop했어요.' : '' }, user);
    if (ok) setDropTargetId(null);
  };

  // 자체개발 설계서 줄의 [Drop] — 설계서만 (확인 창은 설계서 훅)
  const handleDropSheet = (sheetId) => {
    if (dropDesignSheet) dropDesignSheet(sheetId);
  };

  // 상태별 다음 단계 액션
  const nextStatusAction = (status) => {
    if (status === 'pending') return { next: 'analyzing', label: '분석 시작' };
    if (status === 'analyzing') return { next: 'hold', label: '분석 완료' };
    if (status === 'hold') return { next: 'confirmed', label: '개발 확정' };
    return null;
  };

  // EZ-TEX O/D NO. [등록] → 번호 저장 + '샘플 진행' + 생산 현황 샘플 오더 (대표님 요청 2026-10-10 — useDesignSheet.registerEztexOrderNo)
  //  inputEl: 그 줄의 입력칸 — PC 표와 모바일 카드가 같은 설계서 id 로 입력칸을 하나씩 가져서,
  //  예전처럼 id 하나로 기억하면 나중에 그려진 (숨은) 모바일 칸 값을 읽었음 (PC 표에 적은 번호가 무시됨, 2026-10-10)
  const handleEztexSubmit = (sheet, inputEl) => {
    const val = inputEl?.value?.trim();
    if (!val) { alert('EZ-TEX O/D NO.를 입력해주세요.'); return; }
    if (registerEztexOrderNo) {
      registerEztexOrderNo(sheet.id, val);
      return;
    }
    if (!saveDocToCloud) return;
    saveDocToCloud('designSheets', {
      ...sheet,
      eztexOrderNo: val,
      updatedAt: new Date().toISOString()
    });
  };

  // 우선순위에 따른 행 배경/테두리
  const rowBg = (urgency) =>
    urgency === 'overdue' ? 'bg-rose-50/40 border-l-4 border-l-rose-500' :
    urgency === 'urgent' ? 'border-l-4 border-l-orange-400' : '';

  return (
    <div>
      <div className="space-y-6 print:hidden">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200"><Activity className="w-6 h-6 text-white"/></div>
              개발/설계 현황
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">의뢰 접수 → 설계서 작성 → EZ-TEX 등록까지 여기서, 샘플 진행·아이템화는 생산 현황(샘플)에서 관리합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] md:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="바이어/개발번호/원단명 검색..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 transition-shadow"
              />
            </div>
            <button onClick={() => setIsArchiveOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
              title="Drop된 의뢰 / 샘플 진행(생산 현황으로 넘어간 의뢰) / 아이템화 완료 항목 보기"
            >
              <Archive className="w-3.5 h-3.5" /> 보관함
              {archiveCount > 0 && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{archiveCount}</span>}
            </button>
            {onNewSelfSheet && (
              <button onClick={onNewSelfSheet}
                className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                title="의뢰 없이 그루빅 자체개발 설계서를 작성해요 (표에 '자체개발' 줄로 보여요)">
                <FileText className="w-3.5 h-3.5"/> 자체 설계서
              </button>
            )}
            <button onClick={openNewModal} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all">
              <Plus className="w-3.5 h-3.5"/> 새 의뢰 등록
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <SummaryCard icon={Activity} label="진행중" value={metrics.total} tone="slate"
            active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} subtext="전체 활성 카드" />
          <SummaryCard icon={Flame} label="지연" value={metrics.overdue} tone="rose"
            active={priorityFilter === 'overdue'} onClick={() => setPriorityFilter(priorityFilter === 'overdue' ? 'all' : 'overdue')} subtext="납기 초과" />
          <SummaryCard icon={Hourglass} label="임박" value={metrics.urgent} tone="orange"
            active={priorityFilter === 'urgent'} onClick={() => setPriorityFilter(priorityFilter === 'urgent' ? 'all' : 'urgent')} subtext="D-3 이내" />
          <SummaryCard icon={Sparkles} label="오늘 신규" value={metrics.newToday} tone="blue"
            active={priorityFilter === 'newToday'} onClick={() => setPriorityFilter(priorityFilter === 'newToday' ? 'all' : 'newToday')} subtext="오늘 등록된 의뢰" />
        </div>

        {/* 📖 단계 안내 토글 */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600"/>
              단계 안내 — 개발 의뢰 → 설계서 → 생산 현황(샘플)
            </span>
            {showGuide ? <ChevronUp className="w-4 h-4 text-slate-500"/> : <ChevronDown className="w-4 h-4 text-slate-500"/>}
          </button>
          {showGuide && (
            <div className="border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/40">
              {/* 개발 의뢰 단계 */}
              <div className="bg-white rounded-lg border border-purple-100 p-3">
                <div className="text-xs font-extrabold text-purple-700 mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5"/> 개발 의뢰 단계 (3)
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  바이어로부터 받은 개발 건의 가능 여부(원사·편직기·단가)를 확인하는 단계입니다.
                </p>
                <ol className="space-y-2">
                  {DEV_REQ_STAGE_GUIDE.map((s, i) => (
                    <li key={s.key} className="flex items-start gap-2 text-[11px]">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`}></span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{i+1}. {s.label}</div>
                        <div className="text-slate-500 leading-snug">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {/* 설계서 단계 */}
              <div className="bg-white rounded-lg border border-indigo-100 p-3">
                <div className="text-xs font-extrabold text-indigo-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5"/> 설계서 단계 (4)
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  개발 확정된 의뢰(또는 자체 개발 건)를 설계서로 작성하고, EZ-TEX 번호를 등록하면 생산 현황(샘플)에서 진행해요.
                </p>
                <ol className="space-y-2">
                  {DESIGN_STAGE_GUIDE.map((s, i) => (
                    <li key={s.key} className="flex items-start gap-2 text-[11px]">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`}></span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{i+1}. {s.label}</div>
                        <div className="text-slate-500 leading-snug">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* === 개발 의뢰 현황 (한 표) — 의뢰 + 설계서 + 자체개발 (대표님 요청 2026-10-10) ===
            한 줄 = 개발 건 하나: 의뢰 접수 → 분석 → 대기 → 개발 확정 → [설계 시작] → 설계서 작성 → EZ-TEX 번호 [등록]
            → 생산 현황 샘플 오더로 넘어가면 이 표에서 빠짐 (샘플 진행·아이템화·Drop 은 생산 현황에서)
            예전 '설계서 진행 현황' 표는 없앰 — 설계서는 그 의뢰 줄에, 의뢰 없는 설계서는 '자체개발' 줄로 */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-600"/>
                개발 의뢰 현황
                <span className="text-[11px] font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{visibleRows.length}건</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">개발 확정 → 설계서 작성 → EZ-TEX 번호를 [등록]하면 생산 현황(샘플)으로 넘어가요</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 font-bold">정렬</label>
              <select
                value={devSortBy}
                onChange={(e) => setDevSortBy(e.target.value)}
                className="text-[11px] font-bold border border-slate-300 rounded px-2 py-1 bg-white hover:border-purple-300 focus:ring-2 ring-purple-200 outline-none cursor-pointer"
              >
                <option value="odno">O/D No.순 (기본)</option>
                <option value="date">날짜순 (최신)</option>
                <option value="stage">단계순</option>
                <option value="buyer">바이어순</option>
              </select>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30"/>
              <p className="text-xs font-bold">진행 중인 개발 건이 없습니다.</p>
              <p className="text-[10px] mt-1">EZ-TEX를 등록한 건은 생산 현황(샘플)에서 관리해요.</p>
            </div>
          ) : (
            <>
              {/* 데스크톱 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-100/70 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200 tracking-wider">
                      <th className="px-2 py-1.5 border-r border-slate-200 w-[110px]">O/D No.</th>
                      <th className="px-2 py-1.5 border-r border-slate-200 w-[120px]">바이어</th>
                      <th className="px-2 py-1.5 border-r border-slate-200">품목명 · 설계서</th>
                      <th className="px-2 py-1.5 border-r border-slate-200 w-[185px]">현재 단계</th>
                      <th className="px-2 py-1.5 border-r border-slate-200 w-[115px]">납기(경과)</th>
                      <th className="px-2 py-1.5 w-[450px] text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(row => {
                      const { dev: d, sheet: s } = row;
                      const urgency = rowUrgency(row);
                      const dl = rowDeadline(row);
                      const db = deadlineBadge(dl);
                      const enteredIso = rowEnteredAt(row);
                      const stageEntry = formatStageEntry(enteredIso);
                      const enteredDays = daysSince(enteredIso);
                      const quoteBadge = d ? devQuoteBadges.get(d.id) : null;
                      const nextAction = d && !s ? nextStatusAction(d.status) : null;
                      return (
                        <tr key={row.key} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${rowBg(urgency)}`}>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-[11px] font-mono font-extrabold text-violet-700">
                            {rowOdNo(row) || (d ? '-' : <span className="text-slate-500">자체</span>)}
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-[11px] font-bold text-slate-700 truncate">
                            <RowBuyer row={row} />
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-xs font-bold text-slate-800">
                            <div className="truncate">{rowTitle(row)}</div>
                            {showSheetName(row) && (
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 min-w-0" title="이 의뢰로 쓰는 설계서">
                                <FileText className="w-3 h-3 shrink-0"/>
                                <span className="truncate">{s.fabricName || '원단명 미입력'}</span>
                              </div>
                            )}
                            {(stageEntry || quoteBadge) && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {stageEntry && <span className="text-[9px] text-slate-400 font-medium">📅 {stageEntry}</span>}
                                <DevQuoteBadge badge={quoteBadge} />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100">
                            <div className="flex flex-col gap-1">
                              <PendingProgressBar stageKey={s ? s.stage : devStageKey(d)} />
                              {s ? (
                                <select
                                  value={s.stage}
                                  onChange={(e) => setStage && setStage(s.id, e.target.value)}
                                  title="설계서 단계 — EZ-TEX 번호를 [등록]하면 '샘플 진행'으로 자동으로 넘어가요"
                                  className="w-full max-w-[170px] text-[10px] font-bold border border-indigo-200 rounded px-1.5 py-0.5 bg-white hover:border-indigo-300 focus:ring-2 ring-indigo-200 outline-none cursor-pointer"
                                >
                                  {DESIGN_STAGE_GUIDE.map(stage => (
                                    <option key={stage.key} value={stage.key} title={stage.desc}>{stage.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={d.status}
                                  onChange={(e) => updateDevStatus && updateDevStatus(d.id, e.target.value)}
                                  title="단계를 변경하려면 선택하세요"
                                  className="w-full max-w-[170px] text-[10px] font-bold border border-slate-300 rounded px-1.5 py-0.5 bg-white hover:border-purple-300 focus:ring-2 ring-purple-200 outline-none cursor-pointer"
                                >
                                  {DEV_REQ_STAGE_GUIDE.map(st => (
                                    <option key={st.key} value={st.key} title={st.desc}>{st.label}</option>
                                  ))}
                                  <option value="confirmed" title="개발 가능 확정 — 설계서 작성 가능">개발 확정</option>
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-xs">
                            {dl ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono font-bold text-slate-700">{dl}</span>
                                {db
                                  ? <span className={`inline-block w-fit text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>
                                  : (enteredDays != null && <span className="text-[9px] text-slate-400">{enteredDays}일째</span>)}
                              </div>
                            ) : (
                              <span className="text-slate-400">{enteredDays != null ? `${enteredDays}일째` : '-'}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1 justify-end flex-wrap items-center">
                              {s ? (
                                <>
                                  <EztexRegister sheet={s} onSubmit={handleEztexSubmit} />
                                  <button onClick={() => handleEditSheet?.(s)}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded border border-indigo-200"
                                    title="설계서 열기 (보기·수정)">
                                    <FileText className="w-3 h-3"/> 설계서 열기
                                  </button>
                                </>
                              ) : d.status === 'confirmed' ? (
                                <button onClick={() => handleGoToSheet(d)}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm"
                                  title="설계서 작성 시작">
                                  <ArrowRight className="w-3 h-3"/> 설계 시작
                                </button>
                              ) : nextAction && (
                                <button onClick={() => updateDevStatus(d.id, nextAction.next)}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-sm"
                                  title={`다음 단계: ${nextAction.label}`}>
                                  <ArrowRight className="w-3 h-3"/> {nextAction.label}
                                </button>
                              )}
                              {d && saveDevCostQuote && (
                                <CostQuoteButton devReq={d} quoteCount={quotesOfDev(d.id).length} onClick={() => setCostQuoteDevId(d.id)} />
                              )}
                              {d && (
                                <div className="relative">
                                  <button onClick={() => setPrintMenuId(printMenuId === d.id ? null : d.id)}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 hover:bg-slate-100 text-[10px] font-bold rounded border border-slate-200"
                                    title="의뢰서 인쇄 (편직처용 / 내부용)">
                                    <Printer className="w-3 h-3"/>
                                    <ChevronDown className="w-2.5 h-2.5"/>
                                  </button>
                                  {printMenuId === d.id && (
                                    <PrintModeMenu
                                      onSelect={(mode) => handlePrint(d, mode)}
                                      onClose={() => setPrintMenuId(null)}
                                    />
                                  )}
                                </div>
                              )}
                              {d && (
                                <button onClick={() => openEditModal(d)}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded border border-blue-200"
                                  title="의뢰 수정">
                                  <Edit2 className="w-3 h-3"/> {s ? '의뢰 수정' : '수정'}
                                </button>
                              )}
                              {s && (canLinkSheet(row) ? (
                                <button onClick={() => { setLinkSearch(''); setLinkTargetSheet(s); }}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 hover:bg-violet-100 text-[10px] font-bold rounded border border-violet-200"
                                  title="기존 개발 의뢰와 수동 연결">
                                  <Link2 className="w-3 h-3"/> 연결
                                </button>
                              ) : (
                                <button onClick={() => unlinkSheetFromDevRequest?.(s.id)}
                                  className="flex items-center px-1.5 py-0.5 bg-slate-50 text-slate-500 hover:bg-slate-100 text-[10px] font-bold rounded border border-slate-200"
                                  title="개발 의뢰 연결 해제 (설계서는 자체개발 줄로, 의뢰는 '개발 확정' 줄로 나뉘어요)">
                                  <Unlink className="w-3 h-3"/>
                                </button>
                              ))}
                              <button onClick={() => (d ? handleDropDev(d) : handleDropSheet(s.id))}
                                className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded border border-red-200"
                                title={d
                                  ? (s ? '의뢰와 설계서를 같이 Drop (사유 선택 — 보관함에 남음)' : '의뢰 Drop (미진행 — 보관함에 남음)')
                                  : '설계서 Drop (보관함으로 — 복원 가능)'}>
                                <XCircle className="w-3 h-3"/> Drop
                              </button>
                              {s ? (
                                handleDeleteSheet && (
                                  <RowDeleteButton onClick={() => handleDeleteSheet(s.id)}
                                    title={d
                                      ? "설계서만 삭제 (영구 삭제 — 의뢰는 남아서 '개발 확정' 줄로 돌아가요)"
                                      : '설계서 삭제 (영구 삭제 — 복구할 수 없어요. 보관만 하려면 Drop)'} />
                                )
                              ) : (
                                <RowDeleteButton onClick={() => handleRowDelete(d)} title="의뢰 삭제 (영구 삭제 — 복구할 수 없어요. 보관만 하려면 Drop)" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 모바일 카드 */}
              <div className="block md:hidden p-3 space-y-2 bg-slate-50">
                {visibleRows.map(row => {
                  const { dev: d, sheet: s } = row;
                  const days = daysSince(rowUpdatedAt(row));
                  const db = deadlineBadge(rowDeadline(row));
                  const nextAction = d && !s ? nextStatusAction(d.status) : null;
                  const quoteBadge = d ? devQuoteBadges.get(d.id) : null;
                  return (
                    <div key={row.key} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {row.kind === 'dev' ? '의뢰' : row.kind === 'both' ? '의뢰 · 설계서' : '자체개발 설계서'}
                        </span>
                        <span className="text-[10px] text-slate-400">{days != null ? `${days}일 경과` : ''}</span>
                      </div>
                      <p className="text-xs font-mono font-extrabold text-violet-700 mb-0.5">{rowOdNo(row) || (d ? '-' : '자체')}</p>
                      <p className="text-sm font-bold text-slate-800 mb-0.5">{rowTitle(row)}</p>
                      {showSheetName(row) && (
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 mb-0.5">
                          <FileText className="w-3 h-3 shrink-0"/> {s.fabricName || '원단명 미입력'}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 mb-2"><RowBuyer row={row} /></p>
                      {quoteBadge && <div className="mb-2"><DevQuoteBadge badge={quoteBadge} /></div>}
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <PendingProgressBar stageKey={s ? s.stage : devStageKey(d)} />
                        {db && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.c}`}>{db.t}</span>}
                      </div>
                      {s ? (
                        <select
                          value={s.stage}
                          onChange={(e) => setStage && setStage(s.id, e.target.value)}
                          className="mb-2 w-full text-[11px] font-bold border border-indigo-200 rounded px-2 py-1.5 bg-white"
                        >
                          {DESIGN_STAGE_GUIDE.map(stage => (
                            <option key={stage.key} value={stage.key}>{stage.label}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={d.status}
                          onChange={(e) => updateDevStatus && updateDevStatus(d.id, e.target.value)}
                          className="mb-2 w-full text-[11px] font-bold border border-slate-300 rounded px-2 py-1.5 bg-white"
                        >
                          {DEV_REQ_STAGE_GUIDE.map(st => (
                            <option key={st.key} value={st.key}>{st.label}</option>
                          ))}
                          <option value="confirmed">개발 확정</option>
                        </select>
                      )}
                      {s && (
                        <div className="mb-2">
                          <EztexRegister sheet={s} onSubmit={handleEztexSubmit} size="md" />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {s ? (
                          <button onClick={() => handleEditSheet?.(s)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded border border-indigo-200">
                            <FileText className="w-3 h-3"/> 설계서 열기
                          </button>
                        ) : d.status === 'confirmed' ? (
                          <button onClick={() => handleGoToSheet(d)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded">
                            <ArrowRight className="w-3 h-3"/> 설계 시작
                          </button>
                        ) : nextAction && (
                          <button onClick={() => updateDevStatus(d.id, nextAction.next)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded">
                            <ArrowRight className="w-3 h-3"/> {nextAction.label}
                          </button>
                        )}
                        {d && saveDevCostQuote && (
                          <CostQuoteButton size="md" devReq={d} quoteCount={quotesOfDev(d.id).length} onClick={() => setCostQuoteDevId(d.id)} />
                        )}
                        {d && (
                          <div className="relative">
                            <button onClick={() => setPrintMenuId(printMenuId === d.id ? null : d.id)}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-600 text-[11px] font-bold rounded border border-slate-200">
                              <Printer className="w-3 h-3"/> 인쇄
                            </button>
                            {printMenuId === d.id && (
                              <PrintModeMenu
                                onSelect={(mode) => handlePrint(d, mode)}
                                onClose={() => setPrintMenuId(null)}
                              />
                            )}
                          </div>
                        )}
                        {d && (
                          <button onClick={() => openEditModal(d)} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded border border-blue-200">
                            <Edit2 className="w-3 h-3"/> {s ? '의뢰 수정' : '수정'}
                          </button>
                        )}
                        {s && (canLinkSheet(row) ? (
                          <button onClick={() => { setLinkSearch(''); setLinkTargetSheet(s); }}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-violet-50 text-violet-600 text-[11px] font-bold rounded border border-violet-200">
                            <Link2 className="w-3 h-3"/> 연결
                          </button>
                        ) : (
                          <button onClick={() => unlinkSheetFromDevRequest?.(s.id)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-500 text-[11px] font-bold rounded border border-slate-200">
                            <Unlink className="w-3 h-3"/> 해제
                          </button>
                        ))}
                        <button onClick={() => (d ? handleDropDev(d) : handleDropSheet(s.id))}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200">
                          <XCircle className="w-3 h-3"/> Drop
                        </button>
                        {s ? (
                          handleDeleteSheet && (
                            <RowDeleteButton size="md" onClick={() => handleDeleteSheet(s.id)}
                              title={d ? '설계서만 삭제 (의뢰는 남아요)' : '설계서 삭제 (영구 삭제 — 복구할 수 없어요)'} />
                          )
                        ) : (
                          <RowDeleteButton size="md" onClick={() => handleRowDelete(d)} title="의뢰 삭제 (영구 삭제 — 복구할 수 없어요)" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 팝업 — 화면의 세로 간격(space-y) 칸 밖에 둠. 안에 두면 팝업에도 위 여백 24px이 붙어
          창이 아래로 밀리고 맨 위 띠가 어둡게 안 덮였음 (의뢰 등록·저장할까요?·의뢰 연결 창 등, 2026-10-06) */}
      <div className="print:hidden">
        {/* 의뢰 등록/수정 모달 */}
        <DevRequestFormModal
          isOpen={showDevModal}
          onClose={requestCloseDevModal}
          editingDevId={editingDevId}
          devInput={devInput}
          handleDevChange={handleDevChange}
          handleSpecChange={handleSpecChange}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          buyers={buyers}
          setIsBuyerModalOpen={setIsBuyerModalOpen}
          generateDevOrderNo={generateDevOrderNo}
          partners={partners}
          savePartner={savePartner}
          deletePartner={deletePartner}
          makeEmptyPartner={makeEmptyPartner}
        />

        <UnsavedChangesDialog
          open={devLeavePending}
          message="작성 중인 개발 의뢰에 저장하지 않은 변경사항이 있어요. 저장할까요?"
          onSave={saveDevAndClose}
          onDiscard={closeDevModal}
          onKeepEditing={() => setDevLeavePending(false)}
        />

        {/* 원가 견적 창 — 예상 스펙으로 원가·판매가 계산, 저장 / 견적서 만들기 */}
        {costQuoteDev && (
          <DevCostQuoteModal
            key={costQuoteDev.id}
            devReq={costQuoteDev}
            onClose={() => setCostQuoteDevId(null)}
            linkedQuotes={quotesOfDev(costQuoteDev.id)}
            yarnSelectOptions={yarnSelectOptions}
            yarnLibrary={yarnLibrary}
            costSettings={costSettings}
            onOpenCostSettings={onOpenCostSettings}
            exchangeRates={exchangeRates}
            calculateCost={calculateCost}
            createQuoteItem={createQuoteItem}
            onSave={(costQuote) => saveDevCostQuote(costQuoteDev.id, costQuote, user)}
            onStartQuote={onStartQuoteFromDev}
          />
        )}

        {/* Drop 사유 창 — 설계서까지 쓴 의뢰면 설계서도 같이 Drop 된다는 안내 */}
        {dropTargetDev && (
          <DevDropModal
            devReq={dropTargetDev}
            quoteInfo={getDevQuoteBadge(dropTargetDev, quotesOfDev(dropTargetDev.id))}
            sheet={dropTargetSheet}
            onClose={() => setDropTargetId(null)}
            onConfirm={confirmDrop}
          />
        )}

        {/* 통합 보관함 모달 — 열 때마다 새로 그림 (탭·검색·Drop 사유 필터가 지난번 상태로 남지 않게)
            '샘플 진행 (생산 현황)' = EZ-TEX 를 등록해 생산 현황 샘플 오더로 넘어간 의뢰 (2026-10-10) */}
        {isArchiveOpen && (
          <DevArchiveModal
            isOpen={isArchiveOpen}
            onClose={() => setIsArchiveOpen(false)}
            rejectedDevs={rejectedDevReqs}
            confirmedLinkedDevs={inProductionDevs}
            articledSheets={articledSheets}
            designSheets={designSheets}
            savedQuotes={savedQuotes}
            updateDevStatus={updateDevStatus}
            handleEditSheet={handleEditSheet}
            sampleOrderNoOf={(sheetId) => sampleOrderBySheet.get(String(sheetId))?.orderNumber || ''}
            onOpenProductionOrder={onOpenProductionOrder}
          />
        )}

        {/* 개발 의뢰 수동 연결 모달 (설계서 → 기존 의뢰 선택) */}
        {linkTargetSheet && (() => {
          const q = linkSearch.trim().toLowerCase();
          const list = linkCandidateDevs.filter(d => !q ||
            String(d.devOrderNo || '').toLowerCase().includes(q) ||
            String(d.buyerName || '').toLowerCase().includes(q) ||
            String(d.devItem || '').toLowerCase().includes(q) ||
            String(d.targetSpec?.composition || '').toLowerCase().includes(q)
          );
          return (
            <ModalBackdrop className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClose={() => setLinkTargetSheet(null)}>
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-violet-600"/> 개발 의뢰 연결
                  </h3>
                  <button onClick={() => setLinkTargetSheet(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <XCircle className="w-5 h-5 text-slate-400"/>
                  </button>
                </div>
                <div className="p-4 pb-2 shrink-0">
                  <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    <span className="font-bold text-slate-700">{linkTargetSheet.fabricName || '이 설계서'}</span>에 연결할 개발 의뢰를 선택하세요.
                    선택 시 해당 의뢰가 <span className="font-bold text-emerald-700">개발투입확정</span> 상태로 연결됩니다.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)} placeholder="개발번호/바이어/품목 검색..." className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>
                <div className="px-4 pb-4 overflow-y-auto space-y-1.5">
                  {list.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      연결 가능한 개발 의뢰가 없습니다.<br/>
                      <span className="text-[10px]">(이미 다른 설계서에 연결됐거나 Drop된 의뢰는 제외됩니다)</span>
                    </div>
                  ) : list.map(d => (
                    <button key={d.id} onClick={() => { linkSheetToDevRequest?.(linkTargetSheet.id, d.id); setLinkTargetSheet(null); }}
                      className="w-full text-left p-3 border border-slate-200 rounded-xl hover:border-violet-400 hover:bg-violet-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-extrabold text-violet-700">{d.devOrderNo || '-'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusCls[d.status] || ''}`}>{statusLabels[d.status] || d.status}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5 truncate">{d.devItem || d.targetSpec?.composition || '품목명 미입력'}</div>
                      <div className="text-[11px] text-slate-500">{d.buyerName || '-'}</div>
                    </button>
                  ))}
                </div>
              </div>
            </ModalBackdrop>
          );
        })()}
      </div>

      {/* 인쇄 시트 — body 직속 포털 (편직처 전달용 / 내부 전달용) */}
      <DevRequestPrintSheet devReq={printTarget} mode={printMode} />
    </div>
  );
};

/**
 * 인쇄 모드 선택 드롭다운
 * - knit     : 편직처 전달용 (오더번호 + 원단명 + 스와치란)
 * - internal : 내부 전달용 (스와치란 + 의뢰 등록 내용 전체)
 */
const PrintModeMenu = ({ onSelect, onClose }) => (
  <>
    {/* 바깥 클릭 시 닫기 */}
    <div className="fixed inset-0 z-40" onClick={onClose}></div>
    <div className="absolute right-0 top-full mt-1 z-50 w-[190px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
      <button
        onClick={() => onSelect('knit')}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100"
      >
        <div className="text-[11px] font-extrabold text-slate-800">편직처 전달용</div>
        <div className="text-[9px] text-slate-400 mt-0.5">오더번호 · 원단명 · 스와치란</div>
      </button>
      <button
        onClick={() => onSelect('internal')}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-50"
      >
        <div className="text-[11px] font-extrabold text-slate-800">내부 전달용</div>
        <div className="text-[9px] text-slate-400 mt-0.5">스와치란 · 의뢰 내용 전체</div>
      </button>
    </div>
  </>
);

const SummaryCard = ({ icon: Icon, label, value, tone, active, onClick, subtext }) => {
  const tones = {
    slate:  { ring: 'ring-slate-300',  bgActive: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',   value: 'text-slate-800' },
    rose:   { ring: 'ring-rose-300',   bgActive: 'bg-rose-50',    icon: 'bg-rose-100 text-rose-600',     value: 'text-rose-700' },
    orange: { ring: 'ring-orange-300', bgActive: 'bg-orange-50',  icon: 'bg-orange-100 text-orange-600', value: 'text-orange-700' },
    blue:   { ring: 'ring-blue-300',   bgActive: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',     value: 'text-blue-700' }
  };
  const t = tones[tone] || tones.slate;
  return (
    <button
      onClick={onClick}
      className={`group relative bg-white rounded-xl border border-slate-200 p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${active ? `ring-2 ${t.ring} ${t.bgActive}` : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-extrabold leading-none ${t.value}`}>{value}</span>
            <span className="text-[10px] font-bold text-slate-500">건</span>
          </div>
          <div className="text-[11px] font-bold text-slate-700 mt-0.5">{label}</div>
          {subtext && <div className="text-[9px] text-slate-400 truncate">{subtext}</div>}
        </div>
      </div>
    </button>
  );
};
