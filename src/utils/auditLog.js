// GRUBIG ERP - 감사 로그 (changeLog) 헬퍼
// order 문서 내 changeLog 배열에 변경 이력 누적
// 형태: { id, ts, userEmail, action, summary }
// v8: 변경 내용 요약은 orderModel.summarizeOrderChange() 가 만든다 (차수 diff 폐기)

const MAX_LOG_ENTRIES = 200;  // 오더당 최대 로그 (1MB doc 제한 방어)

// action 종류 (변경 이력 아이콘/필터용)
export const CHANGE_ACTIONS = {
  order_create: '오더 등록',
  order_update: '수정',
};

// changeLog entry 만들기
export const makeChangeLogEntry = (userEmail, action, summary) => ({
  id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  ts: new Date().toISOString(),
  userEmail: userEmail || '',
  action,
  summary: summary || '',
});

// order에 새 entry 추가 (불변, 새 객체 반환). 최신 항목이 맨 앞
export const appendChangeLog = (order, entry) => {
  const log = Array.isArray(order.changeLog) ? order.changeLog : [];
  const newLog = [entry, ...log].slice(0, MAX_LOG_ENTRIES);
  return { ...order, changeLog: newLog };
};
