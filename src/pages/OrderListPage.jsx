import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageCheck, Search, Plus, X, FileSpreadsheet, ChartGantt } from 'lucide-react';
import { ProductionSheet } from '../components/order/sheet/ProductionSheet';
import { LotEditor } from '../components/order/sheet/LotEditor';
import { OrderGantt } from '../components/order/gantt/OrderGantt';
import { OrderDetailModal } from '../components/order/OrderDetailModal';
import { MobileOrderList } from '../components/order/MobileOrderList';
import { SampleCloseDialog } from '../components/order/common/SampleCloseDialog';
import { DevDropModal } from '../components/dashboard/DevDropModal';
import { getDday, isDropClosed, getOpenWork } from '../utils/orderModel';
import { todayYmd } from '../utils/orderCalculations';
import { isYarnRatioComplete, sumYarnRatio } from '../utils/costModel';
import { getDevQuoteBadge, indexDevQuotes } from '../utils/devQuoteModel';
import { DESIGN_STAGES } from '../constants/common';

// ============================================================
// 생산 현황 (v8) — 엑셀형 현황표 / 오더별 간트
// ------------------------------------------------------------
// - 오더 등록 화면 없이 표에서 바로 [+ 오더 추가] → order# 입력하면 저장
// - 칸을 누르면 바로 수정, 다른 칸으로 넘어가면 자동 저장 (저장 로직은 useOrder 훅)
// - 간트: 줄 = 오더·컬러, 칸 = 날짜 (공정 막대 + 날짜 메모). 데스크탑 전용
// - 상세창 / 염가공 LOT 편집창은 이 페이지가 띄운다 (표·간트·모바일·상세창 공용)
// - 메인 / 샘플 고르기 (대표님 요청 2026-10-10): 설계서 EZ-TEX O/D NO. 등록으로 만든 샘플 오더는 '설계서' 표시
//   → 설계서 열기 · 아이템화 · Drop · 복원 (개발/설계 현황과 같은 함수 — sheetActions)
// - 샘플 끝 상태 (대표님 결정 2026-10-10): 샘플은 아이템화 아니면 Drop 으로 끝남
//   · 연결 샘플 오더를 '완료'로 바꾸면 '샘플 끝내기' 창 ([아이템화] [Drop] [오더만 완료])
//   · 오더만 완료하고 설계서가 아직 아이템화·Drop 전이면 '아이템화 대기' — '진행 중' 목록에 남음
//   · Drop 으로 닫힌 오더를 '진행중'·'보류'로 바꾸려 하면 설계서 복원으로 (설계서·의뢰도 같이 돌아오게)
// - focusRequest: 개발/설계 현황 [생산 현황]에서 넘어오면 그 오더 번호로 찾아서 보여 줌 (전체 탭)
// ============================================================

// 메인 / 샘플 (order# 의 S/M 으로 자동, 칸에서 바꿀 수 있음) — 마지막 선택을 기억
const TYPE_TABS = [
  { key: 'all',    label: '전체', match: () => true },
  { key: 'main',   label: '메인', match: o => o.type !== 'sample' },
  { key: 'sample', label: '샘플', match: o => o.type === 'sample' },
];
const LS_TYPE = 'grubig.production.type';
const loadTypeFilter = () => {
  try {
    const v = localStorage.getItem(LS_TYPE);
    return TYPE_TABS.some(t => t.key === v) ? v : 'all';
  } catch {
    return 'all';
  }
};

// 데스크탑 보기 (현황표 / 간트) — 마지막 선택을 기억
const VIEWS = [
  { key: 'sheet', label: '현황표', Icon: FileSpreadsheet },
  { key: 'gantt', label: '간트',   Icon: ChartGantt },
];
const LS_VIEW = 'grubig.production.view';
const loadView = () => {
  try { return localStorage.getItem(LS_VIEW) === 'gantt' ? 'gantt' : 'sheet'; } catch { return 'sheet'; }
};

// awaiting = '아이템화 대기' (오더는 완료했지만 설계서가 아직 아이템화·Drop 전) → '진행 중'에 남겨 둠
const STATUS_TABS = [
  { key: 'open',      label: '진행 중', match: (o, awaiting) => o.status !== 'completed' || awaiting },
  { key: 'completed', label: '완료',    match: (o, awaiting) => o.status === 'completed' && !awaiting },
  { key: 'all',       label: '전체',    match: () => true },
];

const SORTS = [
  { key: 'created', label: '등록순' },
  { key: 'due',     label: '납기순' },
  { key: 'number',  label: 'order#순' },
];

const uniq = (list) => [...new Set(list.map(v => String(v || '').trim()).filter(Boolean))];

// 검색 대상: order#·article#·detail·buyer·메모·컬러명·외주처 (+ 연결된 설계서의 개발번호·원단명)
const searchText = (o, sheetInfo) => [
  o.orderNumber, o.articleNo, o.detail, o.customer, o.notes, o.dyeVendor,
  ...(o.colors || []).map(c => c.name),
  ...Object.values(o.steps || {}).map(s => s?.vendor),
  sheetInfo?.devOrderNo, sheetInfo?.sheet?.fabricName,
].filter(Boolean).join(' ').toLowerCase();

const sortOrders = (list, sortKey) => {
  const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    || String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true });
  const sorted = [...list];
  if (sortKey === 'due') {
    sorted.sort((a, b) => (a.finalDueDate || '9999-99-99').localeCompare(b.finalDueDate || '9999-99-99') || byCreated(a, b));
  } else if (sortKey === 'number') {
    sorted.sort((a, b) => String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true }));
  } else {
    sorted.sort(byCreated);
  }
  return sorted;
};

export const OrderListPage = ({
  orders = [],          // v8 정규화된 저장 오더
  drafts = [],          // order# 입력 전 새 줄
  actions,              // useOrder().orderActions
  masters = {},         // { knittingFactories, dyeingFactories, yarnSuppliers }
  savedFabrics = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner,
  designSheets,         // 설계서 (샘플 오더의 '설계서' 표시·아이템화)
  devRequests,          // 설계서의 바이어 이름 · 샘플 Drop 때 같이 Drop 할 개발 의뢰
  savedQuotes,          // 견적서 — 샘플 Drop 사유 창에 원가 견적·견적가 표시 (개발/설계 현황 Drop 창과 같게)
  // { open(sheetId), itemize(sheetId), drop(sheetId), dropWithDev(devId, sheetId, reason, memo), restore(sheetId, opts),
  //   syncEztex(sheetId, order#) } — App 의 설계서 훅 함수
  sheetActions = null,
  focusRequest = null,  // { orderNumber, nonce } — 개발/설계 현황에서 '생산 현황에서 보기'
  onFocusHandled,
}) => {
  const [view, setView] = useState(loadView);
  const [search, setSearch] = useState(() => focusRequest?.orderNumber || '');
  const [statusTab, setStatusTab] = useState(() => (focusRequest ? 'all' : 'open'));
  const [typeFilter, setTypeFilter] = useState(() => (focusRequest ? 'all' : loadTypeFilter()));
  const [sortKey, setSortKey] = useState('created');
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [lotTarget, setLotTarget] = useState(null);          // { orderId, colorId, rect }
  const [pendingFocusOrderId, setPendingFocusOrderId] = useState(null);

  // 개발/설계 현황에서 넘어온 '이 오더 보기' 는 처음 한 번만 (다시 들어올 때 또 검색되지 않게 App 에서 지움)
  useEffect(() => {
    if (focusRequest) onFocusHandled?.();
  }, [focusRequest, onFocusHandled]);

  // ---------- 설계서 (샘플 오더) ----------
  const sheetById = useMemo(() => new Map((designSheets || []).map(s => [s.id, s])), [designSheets]);
  const devById = useMemo(() => new Map((devRequests || []).map(d => [d.id, d])), [devRequests]);
  // 오더에 연결된 설계서 요약 (없거나 지워졌으면 null)
  //  dropClosed: 이 오더가 설계서 Drop 으로 닫힘 / awaiting: '아이템화 대기' (오더는 완료, 설계서는 아직 아이템화·Drop 전)
  const sheetInfoOf = useCallback((order) => {
    if (!order?.linkedSheetId) return null;
    const sheet = sheetById.get(order.linkedSheetId);
    if (!sheet) return null;
    const dev = sheet.devRequestId ? devById.get(sheet.devRequestId) : null;
    const dropped = sheet.status === 'dropped';
    const articled = sheet.stage === 'articled';
    const dropClosed = isDropClosed(order);
    return {
      sheet,
      dropped,
      articled,
      dropClosed,
      awaiting: order.status === 'completed' && !dropClosed && !dropped && !articled,
      devOrderNo: sheet.devOrderNo || '',
      buyerName: dev?.buyerName || '',
      stageLabel: DESIGN_STAGES.find(s => s.key === sheet.stage)?.label || '',
    };
  }, [sheetById, devById]);
  const isAwaiting = useCallback((o) => !!sheetInfoOf(o)?.awaiting, [sheetInfoOf]);
  const sheetLabelOf = (sheet) => [sheet?.devOrderNo || '자체개발', sheet?.fabricName].filter(Boolean).join(' · ');

  // 아이템화 — 설계서에 Article·최종 스펙·혼용률 100% 가 없으면 막히므로 먼저 확인하고 설계서를 열어 줌
  //  확인 창 한 번 (원단이 새로 등록되고 오더가 닫힘 — 아직 끝나지 않은 공정이 있으면 같이 알려 줌)
  //  확인 뒤는 개발/설계 현황과 같은 함수 (setStage → 원단 등록 → 이 오더 article# 연결·완료)
  //  opts.skipConfirm: '샘플 끝내기' 창에서 이미 아이템화를 고른 경우
  const itemizeSheet = async (sheetId, { skipConfirm = false } = {}) => {
    const sheet = sheetById.get(sheetId);
    if (!sheet || !sheetActions?.itemize) return false;
    const ci = sheet.costInput || {};
    const missing = [
      !String(sheet.articleNo || '').trim() && 'Article 번호',
      (!ci.gsm || !ci.widthCut || !ci.widthFull) && '최종 스펙 (GSM·내폭·외폭)',
      !isYarnRatioComplete(sheet.yarns) && `원사 혼용률 합계 100% (지금 ${sumYarnRatio(sheet.yarns)}%)`,
    ].filter(Boolean);
    if (missing.length > 0) {
      const open = window.confirm(
        `아이템화하려면 설계서에 이 값이 있어야 해요:\n· ${missing.join('\n· ')}\n\n설계서를 열어서 채울까요?`
      );
      if (open) sheetActions?.open?.(sheetId);
      return false;
    }
    if (!skipConfirm) {
      const order = orders.find(o => String(o.linkedSheetId || '') === String(sheetId));
      const openWork = getOpenWork(order);
      const ok = window.confirm(
        `설계서 '${sheetLabelOf(sheet)}'를 아이템화할까요?\n\n`
        + `· 원단 관리에 Article ${sheet.articleNo}(으)로 등록되고 설계서와 연결돼요.\n`
        + `· 샘플 오더${order ? `(${order.orderNumber})` : ''}는 article#가 그 원단으로 연결되고 '완료'로 닫혀요.`
        + (openWork.length ? `\n\n⚠ 아직 끝나지 않은 공정이 있어요: ${openWork.join(', ')}` : '')
      );
      if (!ok) return false;
    }
    return sheetActions.itemize(sheetId);
  };

  // ---------- 샘플 끝내기 창 (연결 샘플 오더를 '완료'로 바꿀 때) ----------
  const [closeTarget, setCloseTarget] = useState(null); // { orderId, sheetId }
  const closeOrder = closeTarget ? orders.find(o => o.id === closeTarget.orderId) || null : null;
  const closeSheet = closeTarget ? sheetById.get(closeTarget.sheetId) || null : null;

  // ---------- 샘플 Drop (대표님 결정 2026-10-10 — 개발 의뢰가 있는 설계서면 의뢰도 같이 Drop) ----------
  //  의뢰가 살아 있으면 개발/설계 현황과 같은 Drop 사유 창 → 의뢰·설계서·샘플 오더 같이 (App.dropDevWithSheet)
  //  자체개발(의뢰 없음)·의뢰가 이미 Drop 이면 설계서만 (확인 창은 설계서 훅)
  //  반환: 창을 열었거나 Drop 했으면 true (메뉴 닫기)
  const [dropTarget, setDropTarget] = useState(null); // { sheetId, devId }
  const devQuoteIndex = useMemo(() => indexDevQuotes(savedQuotes || []), [savedQuotes]);
  const requestSampleDrop = async (sheetId) => {
    const sheet = sheetById.get(sheetId);
    if (!sheet) return false;
    const dev = sheet.devRequestId ? devById.get(sheet.devRequestId) : null;
    const live = sheet.status !== 'dropped' && sheet.stage !== 'articled';
    if (dev && dev.status !== 'rejected' && live && sheetActions?.dropWithDev) {
      setDropTarget({ sheetId, devId: dev.id });
      return true;
    }
    return sheetActions?.drop ? sheetActions.drop(sheetId) : false;
  };
  const dropSheet = dropTarget ? sheetById.get(dropTarget.sheetId) || null : null;
  const dropDev = dropTarget ? devById.get(dropTarget.devId) || null : null;
  const dropOrderNo = dropTarget
    ? (orders.find(o => String(o.linkedSheetId || '') === String(dropTarget.sheetId))?.orderNumber || '')
    : '';
  const confirmSampleDrop = async (reason, memo) => {
    if (!dropTarget || !sheetActions?.dropWithDev) return;
    const ok = await sheetActions.dropWithDev(dropTarget.devId, dropTarget.sheetId, reason, memo);
    if (ok) setDropTarget(null);
  };

  // 표·간트·상세창·모바일에 같이 넘기는 묶음
  const sheetLink = {
    infoOf: sheetInfoOf,
    open: sheetActions?.open,
    itemize: sheetActions?.itemize ? itemizeSheet : undefined,
    drop: sheetActions?.drop ? requestSampleDrop : undefined,
    restore: sheetActions?.restore,
  };

  // ---------- 오더 수정 (설계서 샘플 오더 규칙을 얹은 actions — 표·간트·상세창·모바일 공용) ----------
  //  오더상태: Drop 으로 닫힌 샘플을 다시 열려면 설계서 복원 / 아직 안 끝난 샘플을 '완료'로 → 샘플 끝내기 창
  //  order#: 설계서 샘플 오더면 설계서 EZ-TEX O/D NO.도 같이 바꿈 (번호가 어긋나지 않게 — 설계서 변경 이력에 남음)
  const setOrderField = async (id, field, value) => {
    const order = orders.find(o => o.id === id);
    const info = sheetInfoOf(order);
    if (field === 'status' && order && info && value !== order.status) {
      if (info.dropped && value !== 'completed') {
        if (!sheetActions?.restore) return false;
        return sheetActions.restore(info.sheet.id, {
          lead: `Drop된 샘플은 설계서를 복원해야 다시 진행할 수 있어요 (오더 ${order.orderNumber}).\n\n`,
        });
      }
      if (value === 'completed' && !info.dropped && !info.articled) {
        setCloseTarget({ orderId: id, sheetId: info.sheet.id });
        return true;
      }
    }
    const ok = await actions.setOrderField(id, field, value);
    if (field === 'orderNumber' && ok && info && sheetActions?.syncEztex) {
      const no = String(value || '').trim().toUpperCase();
      if (no && no !== String(info.sheet.eztexOrderNo || '').trim().toUpperCase()) {
        await sheetActions.syncEztex(info.sheet.id, no);
      }
    }
    return ok;
  };
  // 오더 삭제 — 설계서 샘플 오더면 지운 뒤 설계서가 어떻게 되는지 확인 창에 같이
  const deleteOrder = (id) => {
    const info = sheetInfoOf(orders.find(o => o.id === id));
    if (!info) return actions.deleteOrder(id);
    const label = sheetLabelOf(info.sheet);
    const note = (info.dropped || info.articled)
      ? `설계서(${label})와 연결된 샘플 오더예요. 설계서는 그대로 남고 연결만 없어져요.`
      : `설계서(${label})와 연결된 샘플 오더예요. 지우면 설계서는 개발/설계 현황으로 돌아가요 (EZ-TEX 번호로 다시 올릴 수 있어요).\n`
        + '샘플을 그만두는 거라면 지우지 말고 ⋯ 메뉴의 Drop을 써 주세요.';
    return actions.deleteOrder(id, { note });
  };
  const pageActions = { ...actions, setOrderField, deleteOrder };

  // ---------- 필터 / 정렬 ----------
  // 상태 탭 숫자는 고른 구분(메인/샘플) 안에서, 구분 숫자는 고른 상태 탭 안에서
  const typeTab = TYPE_TABS.find(t => t.key === typeFilter) || TYPE_TABS[0];
  const statusTabMeta = STATUS_TABS.find(t => t.key === statusTab) || STATUS_TABS[0];
  const counts = useMemo(() => Object.fromEntries(
    STATUS_TABS.map(t => [t.key, orders.filter(o => typeTab.match(o) && t.match(o, isAwaiting(o))).length])
  ), [orders, typeTab, isAwaiting]);
  const typeCounts = useMemo(() => Object.fromEntries(
    TYPE_TABS.map(t => [t.key, orders.filter(o => statusTabMeta.match(o, isAwaiting(o)) && t.match(o)).length])
  ), [orders, statusTabMeta, isAwaiting]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = orders.filter(o => statusTabMeta.match(o, isAwaiting(o)) && typeTab.match(o)
      && (!term || searchText(o, sheetInfoOf(o)).includes(term)));
    return sortOrders(list, sortKey);
  }, [orders, statusTabMeta, typeTab, search, sortKey, sheetInfoOf, isAwaiting]);

  // 상단 요약: 진행/보류/납기 임박/지남 (완료 제외, 고른 구분 안에서) + 아이템화 대기 (완료한 샘플 중 설계서가 아직 안 끝난 것)
  const stats = useMemo(() => {
    let active = 0, onHold = 0, dueSoon = 0, overdue = 0, awaiting = 0;
    orders.forEach(o => {
      if (!typeTab.match(o)) return;
      if (o.status === 'completed') {
        if (isAwaiting(o)) awaiting += 1;
        return;
      }
      if (o.status === 'on_hold') onHold += 1; else active += 1;
      const d = getDday(o.finalDueDate);
      if (d === null) return;
      if (d < 0) overdue += 1;
      else if (d <= 7) dueSoon += 1;
    });
    return { active, onHold, dueSoon, overdue, awaiting };
  }, [orders, typeTab, isAwaiting]);

  // ---------- 외주처 자동완성 (마스터 + 다른 오더에서 쓴 값) ----------
  const dyeVendorOptions = useMemo(
    () => uniq([...(masters.dyeingFactories || []), ...orders.map(o => o.dyeVendor)]),
    [masters.dyeingFactories, orders]
  );

  // ---------- 오더 추가 ----------
  // 새 줄이 필터에 가려지지 않도록 검색어를 비우고 '진행 중' 탭 · 구분 '전체'로 전환
  // (order# 를 넣는 순간 메인/샘플이 정해지는데, 고른 구분과 다르면 줄이 사라지므로)
  const revealNewRow = () => {
    setSearch('');
    if (statusTab === 'completed') setStatusTab('open');
    if (typeFilter !== 'all') changeType('all');
  };
  const changeView = (v) => {
    setView(v);
    try { localStorage.setItem(LS_VIEW, v); } catch { /* 저장 불가 환경은 무시 */ }
  };
  const changeType = (k) => {
    setTypeFilter(k);
    try { localStorage.setItem(LS_TYPE, k); } catch { /* 저장 불가 환경은 무시 */ }
  };
  // 간트에는 새 줄(초안)이 안 보이므로 현황표로 돌아가서 추가
  const handleAddDesktop = () => {
    revealNewRow();
    if (view !== 'sheet') changeView('sheet');
    setPendingFocusOrderId(actions.addDraftOrder());
  };
  const handleAddMobile = () => {
    revealNewRow();
    setDetailOrderId(actions.addDraftOrder());
  };
  // 표 안의 [+ 오더 추가] · [첫 오더 추가] 버튼도 같은 규칙 적용
  // (order# 입력으로 저장되는 순간 검색어/완료 탭/구분 필터에 걸려 줄이 사라지지 않도록)
  const tableActions = {
    ...pageActions,
    addDraftOrder: () => {
      revealNewRow();
      return actions.addDraftOrder();
    },
  };

  // ---------- 상세창 / LOT 편집 대상 ----------
  const findAny = (id) => orders.find(o => o.id === id) || drafts.find(d => d.id === id) || null;
  const detailOrder = detailOrderId ? findAny(detailOrderId) : null;
  const detailIsDraft = !!detailOrder && drafts.some(d => d.id === detailOrder.id);

  const lotOrder = lotTarget ? findAny(lotTarget.orderId) : null;
  const lotColor = lotOrder ? (lotOrder.colors || []).find(c => c.id === lotTarget.colorId) : null;

  const openLots = (orderId, colorId, rect = null) => setLotTarget({ orderId, colorId, rect });

  const partnerProps = { partners, savePartner, deletePartner, makeEmptyPartner };

  return (
    <div className="max-w-[1900px] mx-auto pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg text-white">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">생산 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {todayYmd()} · 칸을 누르면 바로 수정되고, 다른 칸으로 넘어가면 자동 저장돼요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatChip label="진행" value={stats.active} cls="bg-blue-50 text-blue-700 border-blue-200" />
          <StatChip label="보류" value={stats.onHold} cls="bg-slate-50 text-slate-600 border-slate-200" />
          <StatChip label="7일 내 납기" value={stats.dueSoon} cls="bg-orange-50 text-orange-700 border-orange-200" />
          <StatChip label="납기 지남" value={stats.overdue} cls={stats.overdue > 0 ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-500 border-slate-200'} />
          {stats.awaiting > 0 && (
            <StatChip
              label="아이템화 대기"
              value={stats.awaiting}
              cls="bg-amber-50 text-amber-800 border-amber-300"
              title="오더는 완료했지만 설계서가 아직 아이템화·Drop 전인 샘플 — ⋯ 메뉴에서 아이템화 또는 Drop"
            />
          )}
        </div>
      </div>

      {/* 툴바: 검색 / 상태 탭 / 정렬 / 오더 추가 */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="order# · article# · detail · buyer · 컬러 · 외주처 검색"
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600" title="검색어 지우기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden md:flex bg-slate-100 rounded-lg p-0.5">
            {VIEWS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => changeView(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  view === key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {/* 메인 / 샘플 (샘플 = 설계서 EZ-TEX 등록으로 만든 오더 + order# S 오더) */}
          <div className="flex bg-slate-100 rounded-lg p-0.5" role="group" aria-label="메인 / 샘플">
            {TYPE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => changeType(t.key)}
                title={t.key === 'sample' ? '샘플 오더 — 설계서 샘플 진행 포함' : undefined}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  typeFilter === t.key
                    ? `bg-white shadow-sm ${t.key === 'sample' ? 'text-purple-700' : 'text-teal-700'}`
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label} <span className="font-mono text-[10px] opacity-70">{typeCounts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  statusTab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label} <span className="font-mono text-[10px] opacity-70">{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
            title="정렬"
          >
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            onClick={handleAddDesktop}
            className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> 오더 추가
          </button>
        </div>
      </div>

      {/* 본문: 데스크탑 = 엑셀형 현황표 또는 오더별 간트 */}
      <div className="hidden md:block">
        {view === 'gantt' ? (
          <OrderGantt
            orders={visibleOrders}
            actions={pageActions}
            masters={masters}
            onOpenDetail={setDetailOrderId}
            onOpenLots={openLots}
            sheetLink={sheetLink}
          />
        ) : (
          <ProductionSheet
            orders={visibleOrders}
            allOrders={orders}
            drafts={drafts}
            actions={tableActions}
            masters={masters}
            savedFabrics={savedFabrics}
            {...partnerProps}
            onOpenDetail={setDetailOrderId}
            onOpenLots={openLots}
            pendingFocusOrderId={pendingFocusOrderId}
            onPendingFocusDone={() => setPendingFocusOrderId(null)}
            sheetLink={sheetLink}
          />
        )}
        {search && visibleOrders.length === 0 && orders.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-3">'{search}' 검색 결과가 없어요.</p>
        )}
      </div>

      {/* 본문: 모바일 = 카드 목록 → 상세창에서 수정 */}
      <div className="md:hidden">
        <MobileOrderList
          orders={visibleOrders}
          drafts={drafts}
          onOpen={setDetailOrderId}
          onAdd={handleAddMobile}
          sheetLink={sheetLink}
        />
      </div>

      {/* 오더 상세창 (모바일 편집 겸용) */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          isDraft={detailIsDraft}
          onClose={() => setDetailOrderId(null)}
          actions={pageActions}
          masters={masters}
          savedFabrics={savedFabrics}
          {...partnerProps}
          onOpenLots={openLots}
          sheetLink={sheetLink}
        />
      )}

      {/* 염가공 LOT 편집 */}
      {lotOrder && lotColor && (
        <LotEditor
          key={`${lotOrder.id}_${lotColor.id}`}
          order={lotOrder}
          color={lotColor}
          anchorRect={lotTarget.rect}
          onClose={() => setLotTarget(null)}
          onSaveLots={(lots) => actions.setLots(lotOrder.id, lotColor.id, lots)}
          onSaveDyeVendor={(vendor) => actions.setOrderField(lotOrder.id, 'dyeVendor', vendor)}
          dyeVendorOptions={dyeVendorOptions}
        />
      )}

      {/* 샘플 끝내기 — 연결 샘플 오더를 '완료'로 바꿀 때 (고르면 창은 닫고 그 기능을 실행) */}
      {closeOrder && closeSheet && (
        <SampleCloseDialog
          order={closeOrder}
          sheetLabel={sheetLabelOf(closeSheet)}
          onClose={() => setCloseTarget(null)}
          onItemize={() => { setCloseTarget(null); itemizeSheet(closeSheet.id, { skipConfirm: true }); }}
          onDrop={() => { setCloseTarget(null); sheetLink.drop?.(closeSheet.id); }}
          onCompleteOnly={() => { setCloseTarget(null); actions.setOrderField(closeOrder.id, 'status', 'completed'); }}
        />
      )}

      {/* 샘플 Drop 사유 창 — 개발 의뢰가 있는 설계서 (의뢰·설계서·샘플 오더 같이 Drop) */}
      {dropSheet && dropDev && (
        <DevDropModal
          devReq={dropDev}
          quoteInfo={getDevQuoteBadge(dropDev, devQuoteIndex.get(String(dropDev.id)) || [])}
          sheet={dropSheet}
          orderNo={dropOrderNo}
          onClose={() => setDropTarget(null)}
          onConfirm={confirmSampleDrop}
        />
      )}
    </div>
  );
};

const StatChip = ({ label, value, cls, title }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${cls}`} title={title}>
    <span>{label}</span>
    <span className="font-mono text-sm">{value}</span>
  </div>
);
