import { Plus, ChevronRight, Package } from 'lucide-react';
import { COLOR_STAGES, ORDER_TYPES, ORDER_STATUSES, ORDER_STATUS_COLORS } from '../../constants/production';
import { getWorkKg, getLossRate, getColorStage } from '../../utils/orderModel';
import { fmtKg } from '../../utils/orderCalculations';
import { DdayBadge } from './OrderDetailModal';
import { SheetLinkChips } from './common/SheetLinkChips';

// GRUBIG ERP - 생산 현황 모바일 목록 (v8)
// ------------------------------------------------------------
// - 좁은 화면에서는 엑셀형 표 대신 오더 카드 목록을 보여주고, 편집은 상세창(OrderDetailModal)에서 한다
// - 카드: order#·구분·D-day / article#·buyer / detail(1줄) / 컬러마다 한 줄(컬러명, 오더kg→작지kg, 현재 단계)
// - 카드를 누르면 onOpen(orderId). 맨 위 [+ 오더 추가] → onAdd()
// - 설계서 샘플 오더는 '설계서' 표시 (누르면 설계서 창 — sheetLink.open)
// props: { orders, drafts, onOpen(orderId), onAdd(), sheetLink? }

// ============================================================
// 0. 표시 상수
// ============================================================
const MAX_COLOR_LINES = 6;   // 컬러가 많으면 카드가 너무 길어지므로 6줄까지만, 나머지는 "외 n개"

const TYPE_CLS = {
  main:   'bg-blue-100 text-blue-700',
  sample: 'bg-amber-100 text-amber-700',
};

const kgText = (n) => fmtKg(n) || '-';

// ============================================================
// 1. 오더 카드
// ============================================================
const OrderCard = ({ order, isDraft = false, onOpen, sheetLink = null }) => {
  const lossRate = getLossRate(order);
  const colors = order.colors || [];
  const shownColors = colors.slice(0, MAX_COLOR_LINES);
  const hiddenCount = colors.length - shownColors.length;
  const anyColorInput = colors.some(c => c.name || (c.orderKg ?? null) !== null);
  const typeLabel = ORDER_TYPES.find(t => t.key === order.type)?.label || '메인';
  const statusMeta = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.active;
  const statusLabel = ORDER_STATUSES.find(s => s.key === order.status)?.label || '';

  const open = () => onOpen?.(order.id);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={handleKeyDown}
      className={`w-full text-left rounded-xl border p-3 shadow-sm cursor-pointer transition-transform active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-teal-400/60 ${
        isDraft ? 'bg-amber-50/50 border-dashed border-amber-300' : 'bg-white border-slate-200 hover:border-teal-300'
      } ${order.status === 'on_hold' ? 'opacity-70' : ''}`}
    >
      {/* 1줄: order# · 구분 · 오더 상태 · D-day */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isDraft ? (
          <span className="text-xs font-bold text-amber-700 truncate">새 오더 (order# 미입력)</span>
        ) : (
          <span className="font-mono text-sm font-extrabold text-teal-700 truncate">{order.orderNumber}</span>
        )}
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${TYPE_CLS[order.type] || TYPE_CLS.main}`}>
          {typeLabel}
        </span>
        <SheetLinkChips info={sheetLink?.infoOf?.(order) || null} onOpen={sheetLink?.open} size="md" />
        {order.status !== 'active' && statusLabel && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg} ${statusMeta.text}`}>
            {statusLabel}
          </span>
        )}
        <span className="ml-auto shrink-0 flex items-center gap-1">
          {order.status !== 'completed' && <DdayBadge dueDate={order.finalDueDate} />}
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </span>
      </div>

      {/* 2줄: article# · buyer */}
      <div className="mt-1 flex items-center gap-1.5 text-xs min-w-0">
        <span className={`font-mono font-bold truncate ${order.articleNo ? 'text-slate-800' : 'text-slate-300'}`}>
          {order.articleNo || 'article# 미입력'}
        </span>
        <span className="text-slate-300 shrink-0">·</span>
        <span className={`truncate ${order.customer ? 'text-slate-500' : 'text-slate-300'}`}>
          {order.customer || 'buyer 미입력'}
        </span>
      </div>

      {/* 3줄: detail (1줄로 자름) */}
      {order.detail && (
        <div className="mt-0.5 text-[11px] text-slate-500 truncate">{order.detail}</div>
      )}

      {/* 컬러 줄 */}
      {isDraft && !anyColorInput ? (
        <div className="mt-2 border-t border-amber-200/70 pt-1.5 text-[11px] text-amber-700">
          눌러서 order#와 오더 정보를 입력하세요.
        </div>
      ) : (
        <div className="mt-2 border-t border-slate-100 pt-1.5 space-y-1">
          {shownColors.map(c => {
            const stage = COLOR_STAGES[getColorStage(order, c)] || COLOR_STAGES.waiting;
            return (
              <div key={c.id} className="flex items-center gap-2 text-[11px] min-w-0">
                <span className={`w-20 shrink-0 truncate ${c.name ? 'font-bold text-slate-700' : 'text-slate-300'}`}>
                  {c.name || '컬러 미입력'}
                </span>
                <span className="flex-1 min-w-0 font-mono text-slate-500 truncate">
                  {kgText(c.orderKg)} → {kgText(getWorkKg(c, lossRate))} kg
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${stage.cls}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="text-[10px] text-slate-400">외 {hiddenCount}개 컬러 (눌러서 전체 보기)</div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 2. 목록 (입력 중인 새 오더를 맨 위에 → 추가 직후 바로 보이도록)
// ============================================================
export const MobileOrderList = ({ orders = [], drafts = [], onOpen, onAdd, sheetLink = null }) => {
  const savedList = orders || [];
  const draftList = drafts || [];
  const total = savedList.length + draftList.length;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onAdd?.()}
        className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-[0.99] transition-transform"
      >
        <Plus className="w-4 h-4" /> 오더 추가
      </button>

      {total === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-10 px-4 text-center">
          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-500">표시할 오더가 없어요</div>
          <div className="text-xs text-slate-400 mt-1">위 [+ 오더 추가] 버튼으로 새 오더를 등록하세요.</div>
        </div>
      ) : (
        <>
          <div className="text-[11px] text-slate-400 px-1">
            오더 {savedList.length}건{draftList.length > 0 ? ` · 입력 중 ${draftList.length}건` : ''}
          </div>
          {draftList.map(o => <OrderCard key={o.id} order={o} isDraft onOpen={onOpen} />)}
          {savedList.map(o => <OrderCard key={o.id} order={o} onOpen={onOpen} sheetLink={sheetLink} />)}
        </>
      )}
    </div>
  );
};
