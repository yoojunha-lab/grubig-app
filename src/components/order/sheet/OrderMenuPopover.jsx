import { useRef, useState } from 'react';
import { Award, FileText, PanelRightOpen, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from '../../../constants/production';

// ============================================================
// 현황표 order# 칸의 `⋯` 메뉴
// ------------------------------------------------------------
// - 저장된 오더: 상세 보기 / (설계서 샘플 오더면) 설계서 열기·아이템화·Drop·복원 / 오더 상태(진행중·보류·완료) / 오더 삭제
// - 초안(order# 입력 전 새 줄): 줄 삭제만
// - 삭제 확인창은 useOrder 훅이 띄움 (취소하면 메뉴 유지)
// - 설계서 버튼은 개발/설계 현황과 같은 함수 (대표님 요청 2026-10-10 '아이템화·설계서 ARTICLE 연동까지 동일하게')
//   아이템화 → (확인 창: OrderListPage.itemizeSheet) 원단 등록 + 이 오더 article# 연결·완료
//   Drop → 이 오더 완료 / 복원 → 다시 진행중 (확인 창은 useDesignSheet)
// props: order, isDraft, anchorRect, onClose, onOpenDetail(orderId), actions,
//        sheetInfo(OrderListPage.sheetInfoOf), sheetActions({ open, itemize, drop, restore })
// ============================================================

const MenuButton = ({ icon: Icon, danger = false, disabled = false, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors disabled:opacity-50 disabled:cursor-wait ${
      danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    {children}
  </button>
);

export const OrderMenuPopover = ({
  order, isDraft = false, anchorRect = null, onClose, onOpenDetail, actions,
  sheetInfo = null, sheetActions = null,
}) => {
  // 설계서 처리 중 잠금 (빠른 두 번 누름 방지 — 화면 상태는 늦게 바뀌어 ref 로)
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

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

  // ---------- 설계서 (샘플 오더) ----------
  const sheet = sheetInfo?.sheet || null;
  const sheetLabel = sheet
    ? [sheetInfo.devOrderNo || '자체개발', sheet.fabricName].filter(Boolean).join(' · ')
    : '';

  // 설계서 함수 실행 → 해냈으면 메뉴 닫기 (취소·막힘이면 그대로 — 알림은 설계서 훅이 띄움)
  const runSheet = async (fn) => {
    if (busyRef.current || typeof fn !== 'function' || !sheet) return;
    busyRef.current = true;
    setBusy(true);
    let ok = false;
    try {
      ok = (await fn(sheet.id)) !== false;
    } catch {
      ok = false;
    }
    busyRef.current = false;
    setBusy(false);
    if (ok) onClose?.();
  };

  const openSheet = () => {
    sheetActions?.open?.(sheet.id);
    onClose?.();
  };

  return (
    <PopoverShell
      anchorRect={anchorRect}
      width={240}
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

            {/* 설계서 샘플 오더 — 설계서 열기 · 아이템화 · Drop · 복원 */}
            {sheet && sheetActions && (
              <div className="mt-1 pt-1.5 border-t border-slate-100">
                <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 truncate" title={sheetLabel}>
                  설계서 · {sheetLabel}
                </div>
                {sheetActions.open && (
                  <MenuButton icon={FileText} disabled={busy} onClick={openSheet}>설계서 열기</MenuButton>
                )}
                {!sheetInfo.dropped && !sheetInfo.articled && (
                  <>
                    {sheetActions.itemize && (
                      <MenuButton icon={Award} disabled={busy} onClick={() => runSheet(sheetActions.itemize)}>
                        <span className="text-emerald-700">아이템화 (원단 등록)</span>
                      </MenuButton>
                    )}
                    {sheetActions.drop && (
                      <MenuButton icon={XCircle} danger disabled={busy} onClick={() => runSheet(sheetActions.drop)}>
                        설계서 Drop (샘플 종료)
                      </MenuButton>
                    )}
                  </>
                )}
                {sheetInfo.dropped && sheetActions.restore && (
                  <MenuButton icon={RotateCcw} disabled={busy} onClick={() => runSheet(sheetActions.restore)}>
                    설계서 복원 (다시 진행)
                  </MenuButton>
                )}
                {sheetInfo.articled && (
                  <div className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
                    아이템화 완료{sheet.articleNo ? ` · Article ${sheet.articleNo}` : ''}
                  </div>
                )}
              </div>
            )}

            <div className="px-2.5 pt-2 pb-2 mt-1 border-t border-slate-100">
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
