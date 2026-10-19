import React from 'react';
import { Lock } from 'lucide-react';
import { ORDER_KINDS, ORDER_KIND_TODOS } from '../../../constants/production';
import { getOrderKind, getOrderKindMeta, getOrderKindTodo } from '../../../utils/orderModel';
import { StatusSelect } from './StatusSelect';

// ============================================================
// 구분 표시 — 메인 · 신제품 · 재샘플 (대표님 요청 2026-10-19 '샘플/메인을 함부로 바꿀 수 있으면 안 됨')
// ------------------------------------------------------------
// - 새 줄(isDraft): 드롭다운 — order# 를 넣어 저장되기 전까지만 바꿀 수 있음 (onDraftKind)
// - 저장된 오더: 구분 글자만 (눌러도 안 바뀜 — 바꾸려면 ⋯ 메뉴 [구분 바꾸기])
//   · 종류 미정(예전 샘플)은 노란 '종류 미정' — onPickKind 가 있으면 눌러서 한 번 고름 (구분 창)
// - 할 일 꼬리표 (진행 중 오더만 — orderModel.getOrderKindTodo · constants ORDER_KIND_TODOS):
//   · 신제품 '설계서 없음' — onTodo 가 있으면 눌러서 ⋯ 메뉴 ([새 설계서 작성] · [작성 중인 설계서 연결])
//   · 재샘플 '아이템 선택' — article# 칸에서 원단 관리 아이템을 골라야 '완료'
//   현황표는 '설계서 없음'은 order# 칸, '아이템 선택'은 article# 칸에 따로 (OrderKindTodoChip only)
// - 누를 수 없는 곳(간트 라벨처럼 버튼 안)은 onPickKind · onTodo 없이 → 글자만
// props: order, isDraft, onDraftKind(kind), onPickKind(), onTodo(rect), size('sm' 표·간트 | 'md' 모바일·상세창), showTodo
// ============================================================

const SIZE = {
  sm: 'text-[9px] px-1.5 py-px',
  md: 'text-[10px] px-1.5 py-0.5',
};

const DRAFT_OPTIONS = ORDER_KINDS.map(k => ({ key: k.key, label: k.label, cls: k.chip }));

// 구분 할 일 꼬리표만 (only: 'sheet' | 'item' — 그 꼬리표만 보일 때)
export const OrderKindTodoChip = ({ order, onTodo, size = 'sm', only = null }) => {
  const todo = getOrderKindTodo(order);
  const meta = ORDER_KIND_TODOS[todo];
  if (!meta || (only && only !== todo)) return null;
  const cls = `inline-flex items-center rounded border font-extrabold whitespace-nowrap ${SIZE[size] || SIZE.sm} ${meta.cls}`;
  if (onTodo && todo === 'sheet') {
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={e => {
          e.stopPropagation(); // 모바일 카드처럼 눌러서 여는 칸 안에 있어도 이것만
          onTodo(e.currentTarget.getBoundingClientRect());
        }}
        title={meta.title}
        className={`${cls} hover:brightness-95`}
      >
        {meta.label}
      </button>
    );
  }
  return <span className={cls} title={meta.title}>{meta.label}</span>;
};

export const OrderKindChip = ({
  order, isDraft = false, onDraftKind, onPickKind, onTodo, size = 'sm', showTodo = true,
}) => {
  if (!order) return null;
  const kind = getOrderKind(order);
  const meta = getOrderKindMeta(kind);
  const cls = `inline-flex items-center gap-0.5 rounded border font-extrabold whitespace-nowrap ${SIZE[size] || SIZE.sm} ${meta.chip}`;

  // 새 줄 — 저장 전까지만 고르기
  if (isDraft && onDraftKind) {
    return (
      <StatusSelect
        value={kind === 'unknown' ? '' : kind}
        options={DRAFT_OPTIONS}
        onChange={k => onDraftKind(k)}
        placeholder="구분"
        size={size === 'md' ? 'md' : 'sm'}
        tabIndex={-1}
        title="구분 — order#를 넣어 저장하면 잠겨요 (그 뒤엔 ⋯ 메뉴 [구분 바꾸기])"
      />
    );
  }

  const title = kind === 'unknown'
    ? `${meta.desc}${onPickKind ? ' — 눌러서 고르기' : ' (⋯ 메뉴 [샘플 종류 정하기])'}`
    : isDraft
      ? `${meta.label} — ${meta.desc}\norder#를 넣어 저장하면 잠겨요`
      : `${meta.label} — ${meta.desc}\n구분은 오더를 만들 때 정해요 (바꾸려면 ⋯ 메뉴 [구분 바꾸기])`;

  return (
    <>
      {kind === 'unknown' && onPickKind ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={e => {
            e.stopPropagation();
            onPickKind();
          }}
          title={title}
          className={`${cls} hover:brightness-95`}
        >
          {meta.label}
        </button>
      ) : (
        <span className={cls} title={title}>
          {kind !== 'unknown' && !isDraft && <Lock className="w-2 h-2 opacity-50" aria-hidden="true" />}
          {meta.label}
        </span>
      )}
      {showTodo && <OrderKindTodoChip order={order} onTodo={onTodo} size={size} />}
    </>
  );
};

export default OrderKindChip;
