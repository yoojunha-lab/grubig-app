import { doc, collection, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// GRUBIG ERP - 공통 파이어베이스 CRUD 모듈

/**
 * 단일 문서를 컬렉션에 저장합니다. (Upsert)
 */
export const saveDocument = async (collectionName, item) => {
  try {
    await setDoc(doc(db, collectionName, String(item.id)), item);
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
        batch.set(doc(db, collectionName, String(item.id)), item);
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
 */
export const updateYarnCategoryBatch = async (yarnsToUpdate, newCategoryName) => {
  try {
    // Firestore 한 번의 배치 작업은 최대 500개까지만 허용되므로 450개씩 청크 처리
    for (let i = 0; i < yarnsToUpdate.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = yarnsToUpdate.slice(i, i + 450);
      chunk.forEach(y => {
        batch.update(doc(db, 'yarns', String(y.id)), { category: newCategoryName });
      });
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.error(`Error batch updating categories:`, error);
    throw error;
  }
};
