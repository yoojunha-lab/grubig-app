import { PanelRightOpen, Trash2 } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from '../../../constants/production';

// ============================================================
// 현황표 order# 칸의 `⋯` 메뉴
// ------------------------------------------------------------
// - 저장된 오더: 상세 보기 / 오더 상태(진행중·보류·완료) / 오더 삭제
// - 초안(order# 입력 전 새 줄): 줄 삭제만
// - 삭제 확인창은 useOrder 훅이 띄움 (취소하면 메뉴 유지)
// props: order, isDraft, anchorRect, onClose, onOpenDetail(orderId), actions
// ============================================================

const MenuButton = ({ icon: Icon, danger = false, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
      danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    {children}
  </button>
);

export const OrderMenuPopover = ({ order, isDraft = false, anchorRect = null, onClose, onOpenDetail, actions }) => {
  if (!order) return null;

  const subtitle = isDraft
    ? 'order#를 입력하면 저장돼요'
    : [order.articleNo, order.customer].filter(Boolean).join(' · ');

  const openDetail = () => {
    onOpenDetail?.(order.id);
    onClose?.();
  };

  const changeStatus = async (key) => {
    if (key === order.status) return;
    const ok = await actions.setOrderField(order.id, 'status', key);
    if (ok) onClose?.();
  };

  const removeOrder = async () => {
    const ok = await actions.deleteOrder(order.id);
    if (ok) onClose?.();
  };

  const discardDraft = () => {
    actions.discardDraft(order.id);
    onClose?.();
  };

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={230}
      title={order.orderNumber || '새 오더'}
      subtitle={subtitle}
      onClose={onClose}
    >
      <div className="p-1.5">
        {isDraft ? (
          <MenuButton icon={Trash2} danger onClick={discardDraft}>줄 삭제</MenuButton>
        ) : (
          <>
            {onOpenDetail && (
              <MenuButton icon={PanelRightOpen} onClick={openDetail}>상세 보기</MenuButton>
            )}

            <div className="px-2.5 pt-2 pb-2">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">오더 상태</div>
              <div className="grid grid-cols-3 gap-1">
                {ORDER_STATUSES.map(s => {
                  const on = order.status === s.key;
                  const c = ORDER_STATUS_COLORS[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => changeStatus(s.key)}
                      aria-pressed={on}
                      className={`py-1.5 rounded-md border text-[11px] font-bold transition-colors ${
                        on
                          ? `${c.bg} ${c.text} ${c.border}`
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 my-1" />
            <MenuButton icon={Trash2} danger onClick={removeOrder}>오더 삭제</MenuButton>
          </>
        )}
      </div>
    </PopoverShell>
  );
};

export default OrderMenuPopover;
