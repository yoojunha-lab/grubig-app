import { doc, collection, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// GRUBIG ERP - 공통 파이어베이스 CRUD 모듈

/**
 * 객체 트리에서 undefined 값을 제거합니다. (Firestore는 undefined 필드를 거부하기 때문)
 * - 일반 객체/배열만 재귀 처리하고, Date·Timestamp 등 특수 객체는 그대로 보존합니다.
 * - 이렇게 하면 일부 필드가 undefined여도 문서 전체 저장이 실패하는 일을 방지합니다.
 */
const stripUndefinedDeep = (val) => {
  if (Array.isArray(val)) return val.map(stripUndefinedDeep);
  if (val && typeof val === 'object' && (val.constructor === Object || Object.getPrototypeOf(val) === null)) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return val; // 원시값 / Date / Firestore Timestamp 등은 변형 없이 통과
};

/**
 * 단일 문서를 컬렉션에 저장합니다. (Upsert)
 */
export const saveDocument = async (collectionName, item) => {
  try {
    await setDoc(doc(db, collectionName, String(item.id)), stripUndefinedDeep(item));
    return true;
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
    throw error;
  }
};

/**
 * 단일 문서를 컬렉션에서 삭제합니다.
 */
export const deleteDocument = async (collectionName, id) => {
  try {
    await deleteDoc(doc(db, collectionName, String(id)));
    return true;
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * 다수의 문서를 한 번에 저장합니다. (Batch Write)
 * [Step 2] Firestore 500개 제한 방어: 450개 단위로 청크 분할 처리
 */
export const saveBatchDocuments = async (collectionName, items) => {
  try {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + CHUNK_SIZE);
      chunk.forEach(item => {
        batch.set(doc(db, collectionName, String(item.id)), stripUndefinedDeep(item));
      });
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.error(`Error batch saving to ${collectionName}:`, error);
    throw error;
  }
};

/**
 * 원사 카테고리 일괄 업데이트 (Batch Update)
 * - 카테고리명 변경 시, 연관된 모든 원사 문서의 카테고리 필드를 수정합니다.
 * - 청크별 try/catch로 부분 실패 처리: 실패한 yarn id 목록을 반환해 호출자에서 부분 실패 안내 가능
 *
 * @returns {Promise<{ success: number, failed: string[], totalAttempted: number }>}
 */
export const updateYarnCategoryBatch = async (yarnsToUpdate, newCategoryName) => {
  const total = yarnsToUpdate.length;
  let successCount = 0;
  const failedIds = [];

  // Firestore 배치 한 번 최대 500개 → 안전 마진 450개씩 청크
  for (let i = 0; i < total; i += 450) {
    const chunk = yarnsToUpdate.slice(i, i + 450);
    try {
      const batch = writeBatch(db);
      chunk.forEach(y => {
        batch.update(doc(db, 'yarns', String(y.id)), { category: newCategoryName });
      });
      await batch.commit();
      successCount += chunk.length;
    } catch (error) {
      console.error(`Error in chunk starting at index ${i}:`, error);
      // 이 청크 내 모든 yarn id를 실패 목록에 추가 (어느 게 실패했는지 정확히는 모르지만 청크 단위로 실패 처리)
      chunk.forEach(y => failedIds.push(String(y.id)));
    }
  }

  return { success: successCount, failed: failedIds, totalAttempted: total };
};
