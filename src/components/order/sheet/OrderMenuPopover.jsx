import { useRef, useState } from 'react';
import { Award, FilePlus2, FileText, Link2, PanelRightOpen, RotateCcw, Tags, Trash2, XCircle } from 'lucide-react';
import { PopoverShell } from '../common/PopoverShell';
import { OrderKindChip } from '../common/OrderKindChip';
import { ORDER_STATUSES, ORDER_STATUS_COLORS, SKIP_ITEMS } from '../../../constants/production';
import { getOrderKind, isSheetMissing, isSkipOn, formatSheetLabel } from '../../../utils/orderModel';

// ============================================================
// 현황표 order# 칸의 `⋯` 메뉴
// ------------------------------------------------------------
// - 저장된 오더: 상세 보기 / 구분 (대표님 요청 2026-10-19 — [구분 바꾸기] · 설계서 없는 신제품이면 [새 설계서 작성] ·
//   [작성 중인 설계서 연결]) / (설계서 샘플 오더면) 설계서 열기·아이템화·Drop·복원 / 오더 상태(진행중·보류·완료) / 오더 삭제
//   · 구분 바꾸기 · 설계서 연결 창은 OrderListPage 가 띄움 (actions.requestKindChange · sheetActions.newSheet · pickSheet)
//   · 진행 안 함 (대표님 요청 2026-10-19): 편직 재고 사용(생지 재고) · 컨펌 · 성적서 안 함 · 외관검사 안 함 — 체크 = 바로 저장 (메뉴는 그대로)
// - 초안(order# 입력 전 새 줄): 줄 삭제만 (구분은 order# 칸 드롭다운)
// - 삭제 확인창은 useOrder 훅이 띄움 (취소하면 메뉴 유지)
// - 설계서 버튼은 개발/설계 현황과 같은 함수 (대표님 요청 2026-10-10 '아이템화·설계서 ARTICLE 연동까지 동일하게')
//   아이템화 → (확인 창: OrderListPage.itemizeSheet) 원단 등록 + 이 오더 article# 연결·완료
//   Drop → 이 오더 'Drop' (의뢰가 있으면 Drop 사유 창) / 복원 → Drop 전 상태로 (확인 창은 useDesignSheet)
// - 오더 상태 버튼은 OrderListPage 가 얹은 규칙을 따름 (actions.setOrderField):
//   설계서가 안 끝난 샘플을 '완료' → 샘플 끝내기 창 / Drop 된 샘플을 '진행중'·'보류' → 설계서 복원
// props: order, isDraft, anchorRect, onClose, onOpenDetail(orderId), actions,
//        sheetInfo(OrderListPage.sheetInfoOf), sheetActions({ open, itemize, drop, restore, newSheet, pickSheet })
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
  const sheetLabel = sheet ? formatSheetLabel(sheet, { devOrderNo: sheetInfo.devOrderNo }) : '';

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

  // ---------- 구분 (메인 · 신제품 · 재샘플) ----------
  //  창을 여는 버튼들 — 메뉴는 닫고 OrderListPage 가 창을 띄움
  const unknownKind = getOrderKind(order) === 'unknown';
  const noSheet = isSheetMissing(order);
  const openAndClose = (fn) => {
    fn?.(order.id);
    onClose?.();
  };

  // ---------- 진행 안 함 (오더 전체 — 바로 저장, 메뉴는 그대로) — 상세창과 같은 목록 (constants SKIP_ITEMS) ----------

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

            {/* 구분 — 설계서 없는 신제품이면 설계서 붙이기 · 구분 바꾸기 (사유) */}
            <div className="mt-1 pt-1.5 border-t border-slate-100">
              <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 flex items-center gap-1 flex-wrap">
                구분 <OrderKindChip order={order} />
              </div>
              {noSheet && sheetActions?.newSheet && (
                <MenuButton icon={FilePlus2} onClick={() => openAndClose(sheetActions.newSheet)}>
                  <span className="text-teal-700">새 설계서 작성</span>
                </MenuButton>
              )}
              {noSheet && sheetActions?.pickSheet && (
                <MenuButton icon={Link2} onClick={() => openAndClose(sheetActions.pickSheet)}>
                  작성 중인 설계서 연결
                </MenuButton>
              )}
              {actions.requestKindChange && (
                <MenuButton icon={Tags} onClick={() => openAndClose(actions.requestKindChange)}>
                  {unknownKind ? '샘플 종류 정하기' : '구분 바꾸기'}
                </MenuButton>
              )}
            </div>

            {/* 진행 안 함 — 편직 재고 사용 · 컨펌 · 성적서 안 함 · 외관검사 안 함 (오더 전체, 체크 = 바로 저장) */}
            {actions.setSkipItem && (
              <div className="mt-1 pt-1.5 px-2.5 pb-1 border-t border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400">진행 안 함 (오더 전체)</div>
                {SKIP_ITEMS.map(it => {
                  const checked = isSkipOn(order, it.key);
                  return (
                    <label key={it.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none" title={it.title}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => actions.setSkipItem(order.id, it.key, e.target.checked)}
                        className="w-3.5 h-3.5 accent-slate-600"
                      />
                      <span className={checked ? 'text-slate-500' : ''}>{it.label}</span>
                    </label>
                  );
                })}
              </div>
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
                {sheetInfo.awaiting && (
                  <div className="px-2.5 pt-0.5 pb-1 text-[10px] font-bold text-amber-700 leading-snug">
                    오더는 완료 — 아이템화 또는 Drop으로 샘플을 끝내 주세요
                  </div>
                )}
              </div>
            )}

            <div className="px-2.5 pt-2 pb-2 mt-1 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">
                오더 상태
                {sheetInfo?.dropClosed && <span className="ml-1 text-rose-500">· 샘플 Drop으로 닫힘</span>}
              </div>
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
