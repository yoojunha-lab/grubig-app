import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { START_STAGES } from '../../../constants/production';
import { calcKgFromYd, diffDaysYmd, todayYmd, enrichProcessesWithEffectiveDates } from '../../../utils/orderCalculations';
import { ProcessCell } from './ProcessCell';
import { CellPopover } from './CellPopover';

// ============================================================
// 9개 공정 컬럼 정의 (좌→우)
// ============================================================
const PROCESS_COLUMNS = [
  { key: 'yarn',              label: '원사발주' },
  { key: 'yarn_processing',   label: '사가공'   },
  { key: 'knitting',          label: '편직'     },
  { key: 'dyeing',            label: '염가공'   },
  { key: 'finishing',         label: '후가공'   },
  { key: 'physical_test',     label: '이화학검사' },
  { key: 'visual_inspection', label: '외관검사'  },
  { key: 'brand_confirm',     label: 'CONFIRM SHEET' },
  { key: 'shipping',          label: '납품'     },
];

const LS_KEY_HIDDEN_COLS = 'grubig.production.list.hiddenCols';

// 좌측 sticky 컬럼 (순서 = 시각 순서). 폭 변경 시 여기만 수정
const LEFT_COLS = [
  { key: 'ono',      width: 76 },
  { key: 'fabric',   width: 116 },
  { key: 'customer', width: 88 },
  { key: 'received', width: 70 },
  { key: 'color',    width: 64 },
  { key: 'yd',       width: 58 },
  { key: 'kg',       width: 58 },
  { key: 'due',      width: 84 },
];
// key → width
const LEFT_W = LEFT_COLS.reduce((acc, c) => ({ ...acc, [c.key]: c.width }), {});
// key → 누적 left (sticky 위치)
const LEFT_OFFSET = LEFT_COLS.reduce((acc, c, i) => {
  acc[c.key] = i === 0 ? 0 : acc[LEFT_COLS[i - 1].key] + LEFT_COLS[i - 1].width;
  return acc;
}, {});
const LEFT_TOTAL = LEFT_COLS.reduce((a, c) => a + c.width, 0);
const CELL_W = 168;  // 공정 셀 폭

// ============================================================
// D-day 뱃지 — finalDueDate 기준
// ============================================================
const Dday = ({ ymd }) => {
  if (!ymd) return null;
  const days = diffDaysYmd(todayYmd(), ymd);
  let cls = 'bg-slate-100 text-slate-600 border-slate-200';
  let label;
  if (days < 0) {
    cls = 'bg-rose-600 text-white animate-pulse';
    label = `D+${-days}`;
  } else if (days === 0) {
    cls = 'bg-rose-500 text-white';
    label = 'D-Day';
  } else if (days <= 7) {
    cls = 'bg-red-500 text-white';
    label = `D-${days}`;
  } else if (days <= 14) {
    cls = 'bg-orange-100 text-orange-700 border-orange-300 border';
    label = `D-${days}`;
  } else {
    label = `D-${days}`;
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-[34px] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

// ============================================================
// 메인 매트릭스 테이블
// ============================================================
export const ProductionMatrixTable = ({
  orders = [],
  onOpenOrderDetail,    // (orderId, processType?, batchId?) — 모달 열기
  onSaveBatch,          // (orderId, processType, batchId, draftBatch)
  onSaveYarnDelivery,   // (orderId, yarnOrderId, deliveryId, draftDelivery)
}) => {
  // 컬럼 숨기기 (localStorage)
  const [hiddenCols, setHiddenCols] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_HIDDEN_COLS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showColTogglePanel, setShowColTogglePanel] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_HIDDEN_COLS, JSON.stringify(hiddenCols));
    } catch { /* ignore */ }
  }, [hiddenCols]);

  const toggleCol = (key) => {
    setHiddenCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const visibleCols = useMemo(
    () => PROCESS_COLUMNS.filter(c => !hiddenCols.includes(c.key)),
    [hiddenCols]
  );

  // 셀 팝오버 상태
  const [popover, setPopover] = useState(null); // { orderId, processType, batchId, anchorRect, color? } | null

  const openPopover = (params, anchorEl) => {
    const rect = anchorEl?.getBoundingClientRect();
    setPopover({ ...params, anchorRect: rect });
  };
  const closePopover = () => setPopover(null);

  // ESC로 팝오버 닫기
  useEffect(() => {
    if (!popover) return;
    const onKey = (e) => { if (e.key === 'Escape') closePopover(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover]);

  // 가로 폭
  const rightWidth = visibleCols.length * CELL_W;
  const totalMinWidth = LEFT_TOTAL + rightWidth;

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">등록된 오더가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* 컬럼 토글 바 */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowColTogglePanel(p => !p)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 rounded border border-slate-300"
        >
          {hiddenCols.length > 0 ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
          공정 컬럼 {hiddenCols.length > 0 ? `(${hiddenCols.length}개 숨김)` : ''}
          <ChevronDown className={`w-3 h-3 transition-transform ${showColTogglePanel ? 'rotate-180' : ''}`} />
        </button>
        {showColTogglePanel && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {PROCESS_COLUMNS.map(col => {
              const hidden = hiddenCols.includes(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => toggleCol(col.key)}
                  className={`text-[11px] font-bold px-2 py-1 rounded border transition-all ${
                    hidden
                      ? 'bg-white text-slate-400 border-slate-200 line-through'
                      : 'bg-teal-50 text-teal-700 border-teal-300'
                  }`}
                >
                  {col.label}
                </button>
              );
            })}
            {hiddenCols.length > 0 && (
              <button
                onClick={() => setHiddenCols([])}
                className="text-[10px] text-slate-500 hover:text-slate-800 underline ml-2"
              >
                모두 표시
              </button>
            )}
          </div>
        )}
        <div className="ml-auto text-[11px] text-slate-500">
          총 {orders.length}건 · 좌측 8컬럼 고정 · 가로 스크롤 →
        </div>
      </div>

      {/* 메인 테이블 (가로 스크롤) */}
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ minWidth: `${totalMinWidth}px` }}>
          {/* 헤더 */}
          <thead className="sticky top-0 z-30 bg-slate-100">
            <tr className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ left: LEFT_OFFSET.ono, width: LEFT_W.ono, minWidth: LEFT_W.ono }}>O/No</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-left" style={{ left: LEFT_OFFSET.fabric, width: LEFT_W.fabric, minWidth: LEFT_W.fabric }}>원단명</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-left" style={{ left: LEFT_OFFSET.customer, width: LEFT_W.customer, minWidth: LEFT_W.customer }}>거래처</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-center" style={{ left: LEFT_OFFSET.received, width: LEFT_W.received, minWidth: LEFT_W.received }}>접수일</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-left" style={{ left: LEFT_OFFSET.color, width: LEFT_W.color, minWidth: LEFT_W.color }}>컬러</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-right" style={{ left: LEFT_OFFSET.yd, width: LEFT_W.yd, minWidth: LEFT_W.yd }}>수량(yd)</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r border-slate-300 px-1.5 py-1.5 text-right" style={{ left: LEFT_OFFSET.kg, width: LEFT_W.kg, minWidth: LEFT_W.kg }}>수량(kg)</th>
              <th className="sticky z-40 bg-slate-100 border-b border-r-2 border-slate-400 px-1.5 py-1.5 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ left: LEFT_OFFSET.due, width: LEFT_W.due, minWidth: LEFT_W.due }}>납기일</th>
              {visibleCols.map(col => (
                <th key={col.key} className="border-b border-r border-slate-300 px-1.5 py-1.5 text-center" style={{ width: CELL_W, minWidth: CELL_W }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디: 오더 단위 그룹 */}
          <tbody>
            {orders.map((order, orderIdx) => (
              <OrderRowGroup
                key={order.id}
                order={order}
                orderIdx={orderIdx}
                visibleCols={visibleCols}
                onOpenOrderDetail={onOpenOrderDetail}
                onCellClick={openPopover}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 팝오버 (fixed) */}
      {popover && (
        <CellPopover
          {...popover}
          orders={orders}
          onClose={closePopover}
          onSaveBatch={onSaveBatch}
          onSaveYarnDelivery={onSaveYarnDelivery}
          onOpenDetail={() => {
            onOpenOrderDetail && onOpenOrderDetail(popover.orderId, popover.processType, popover.batchId);
            closePopover();
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// 오더 1개의 행 그룹 (컬러 N개 → N행, 좌측 rowspan)
// ============================================================
const OrderRowGroup = ({ order, orderIdx, visibleCols, onOpenOrderDetail, onCellClick }) => {
  const colors = (order.colors && order.colors.length > 0) ? order.colors : [{ name: '-', quantity: 0, _empty: true }];
  const enrichedProcesses = useMemo(() => enrichProcessesWithEffectiveDates(order), [order]);
  const procByKey = useMemo(() => {
    const m = {};
    enrichedProcesses.forEach(p => { m[p.processType] = p; });
    return m;
  }, [enrichedProcesses]);

  const stageLabel = START_STAGES.find(s => s.key === order.startStage)?.label || '';
  const altBgSticky = orderIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
  // hover 시 sticky 셀에도 시각 효과
  const [rowHover, setRowHover] = useState(false);
  const stickyBg = rowHover ? 'bg-teal-50' : altBgSticky;
  const cellBg = rowHover ? 'bg-teal-50/60' : (orderIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40');

  const handleOpenOrder = () => onOpenOrderDetail && onOpenOrderDetail(order.id);

  // 좌측 sticky 공통 클래스
  const stickyCls = `sticky z-20 ${stickyBg} border-r border-slate-200 px-1.5 py-1.5 align-top cursor-pointer transition-colors`;
  const stickyClsRight = `${stickyCls} border-r-2 border-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`;

  return (
    <>
      {colors.map((c, ci) => {
        const isFirst = ci === 0;
        const ydQty = Number(c.quantity || 0);
        const kgQty = calcKgFromYd(ydQty, order.gsm, order.widthFull);
        const colorObj = c._empty ? null : c;

        return (
          <tr
            key={`${order.id}-${ci}`}
            className={`${cellBg} border-b ${ci === colors.length - 1 ? 'border-slate-300' : 'border-slate-100'} transition-colors`}
            onMouseEnter={() => setRowHover(true)}
            onMouseLeave={() => setRowHover(false)}
          >
            {/* rowspan 좌측 셀들 — 첫 컬러 행에만 렌더링. 모두 클릭 시 모달 */}
            {isFirst && (
              <>
                <td rowSpan={colors.length} onClick={handleOpenOrder} className={`${stickyCls} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`} style={{ left: LEFT_OFFSET.ono, width: LEFT_W.ono, minWidth: LEFT_W.ono }}>
                  <div className="font-mono text-[11px] font-extrabold text-teal-700 leading-tight">{order.orderNumber || '-'}</div>
                  <div className="text-[9px] text-slate-400">{order.type === 'main' ? '메인' : '샘플'}</div>
                </td>
                <td rowSpan={colors.length} onClick={handleOpenOrder} className={stickyCls} style={{ left: LEFT_OFFSET.fabric, width: LEFT_W.fabric, minWidth: LEFT_W.fabric }}>
                  <div className="text-[11px] font-bold text-slate-700 truncate leading-tight" title={order.articleNo || order.orderName}>
                    {order.articleNo || order.orderName || '-'}
                  </div>
                  {stageLabel && (
                    <span className="inline-block mt-0.5 text-[9px] font-bold px-1 py-0 bg-slate-100 text-slate-600 rounded">{stageLabel}</span>
                  )}
                </td>
                <td rowSpan={colors.length} onClick={handleOpenOrder} className={stickyCls} style={{ left: LEFT_OFFSET.customer, width: LEFT_W.customer, minWidth: LEFT_W.customer }}>
                  <div className="text-[11px] text-slate-700 truncate leading-tight" title={order.customer}>{order.customer || '-'}</div>
                  {order.brand && <div className="text-[9px] text-slate-500 truncate" title={order.brand}>{order.brand}</div>}
                </td>
                <td rowSpan={colors.length} onClick={handleOpenOrder} className={`${stickyCls} text-center`} style={{ left: LEFT_OFFSET.received, width: LEFT_W.received, minWidth: LEFT_W.received }}>
                  <div className="text-[10px] font-mono text-slate-600">{(order.createdAt || '').slice(0, 10) || '-'}</div>
                </td>
              </>
            )}

            {/* 컬러별 셀 (클릭 시 모달, 차수 focus 없음) */}
            <td onClick={handleOpenOrder} className={stickyCls} style={{ left: LEFT_OFFSET.color, width: LEFT_W.color, minWidth: LEFT_W.color }}>
              <div className="text-[11px] font-bold text-slate-800 truncate leading-tight" title={c.name}>{c.name || '-'}</div>
            </td>
            <td onClick={handleOpenOrder} className={`${stickyCls} text-right`} style={{ left: LEFT_OFFSET.yd, width: LEFT_W.yd, minWidth: LEFT_W.yd }}>
              <div className="text-[11px] font-mono text-slate-700">{ydQty.toLocaleString()}</div>
            </td>
            <td onClick={handleOpenOrder} className={`${stickyCls} text-right`} style={{ left: LEFT_OFFSET.kg, width: LEFT_W.kg, minWidth: LEFT_W.kg }}>
              <div className="text-[11px] font-mono text-slate-500">{kgQty.toLocaleString()}</div>
            </td>

            {/* 납기일 + D-day — rowspan */}
            {isFirst && (
              <td rowSpan={colors.length} onClick={handleOpenOrder} className={`${stickyClsRight} text-center`} style={{ left: LEFT_OFFSET.due, width: LEFT_W.due, minWidth: LEFT_W.due }}>
                <div className="text-[10px] font-mono text-slate-700 mb-0.5 leading-tight">{order.finalDueDate || '-'}</div>
                <Dday ymd={order.finalDueDate} />
              </td>
            )}

            {/* 우측 공정 셀 (9개) */}
            {visibleCols.map(col => (
              <td key={col.key} className="border-r border-slate-200 align-top p-0" style={{ width: CELL_W, minWidth: CELL_W }}>
                <ProcessCell
                  order={order}
                  process={procByKey[col.key] || procByKey['dyeing']}
                  columnKey={col.key}
                  color={colorObj}
                  colorIndex={ci}
                  isFirstColorRow={isFirst}
                  onClick={(params, el) => onCellClick({ orderId: order.id, ...params }, el)}
                />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
};
