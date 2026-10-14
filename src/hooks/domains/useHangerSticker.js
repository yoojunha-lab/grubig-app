import { useRef } from 'react';
import { cleanStickerForSave, sortStickers } from '../../utils/hangerSticker';
import { buildStickerWorkbook } from '../../utils/hangerStickerExcel';
import { makeQrPng } from '../../utils/hangerStickerQr';
import { todayLocalISO } from '../../utils/helpers';
import templateUrl from '../../assets/hanger-sticker-template.xlsx?url';

// ============================================================
// GRUBIG ERP - 헹거 스티커 (기타 ▾ 헹거 스티커) 도메인 훅 — 대표님 요청 2026-10-14
//  - Firestore 컬렉션: hangerStickers — 저장 · 삭제 (회사 공통, 다른 직원도 같이 봄)
//  - 엑셀 다운로드: 양식(src/assets/hanger-sticker-template.xlsx = 대표님 TAG.xlsx 첫 시트) 그대로,
//    고른 스티커를 ART 순서로 1장 = 시트 1장 (만드는 법은 utils/hangerStickerExcel.js)
//  - 칸 계산·저장 모양은 utils/hangerSticker.js, QR은 utils/hangerStickerQr.js
// ============================================================

const COLLECTION = 'hangerStickers';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const newStickerId = () => `hs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// 양식 파일은 한 번만 받아 둠
let templateBytes = null;
const loadTemplate = async () => {
  if (templateBytes) return templateBytes;
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('스티커 양식 파일을 받지 못했어요.');
  templateBytes = new Uint8Array(await res.arrayBuffer());
  return templateBytes;
};

// 파일 이름에 못 쓰는 글자 빼기
const safeFilePart = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
const fileNameFor = (items) => (items.length === 1
  ? `헹거스티커_${safeFilePart(items[0].art) || '스티커'}.xlsx`
  : `헹거스티커_${items.length}장_${todayLocalISO()}.xlsx`);

const saveFile = (bytes, fileName) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const useHangerSticker = (hangerStickers, saveDocToCloud, deleteDocFromCloud, showToast, user) => {
  const savingRef = useRef(false);      // 저장 중 잠금 (빠르게 두 번 눌러도 한 번만)
  const downloadingRef = useRef(false); // 엑셀 만드는 중 잠금

  /** 저장 — editingId가 있으면 그 스티커를 고침. 반환: 저장한 문서 (못 했거나 취소하면 null) */
  const saveSticker = async (input, editingId = null) => {
    if (savingRef.current) return null;
    const clean = cleanStickerForSave(input);
    if (!clean.art) {
      showToast('ART를 넣어 주세요.', 'error');
      return null;
    }
    const existing = editingId ? (hangerStickers || []).find(s => s.id === editingId) : null;
    // 같은 ART 스티커가 또 생길 때만 한 번 물어봄 (고쳐 저장할 때 ART가 그대로면 묻지 않음)
    const artChanged = !existing || String(existing.art || '').toUpperCase() !== clean.art;
    const sameArt = (hangerStickers || []).filter(s => s.id !== editingId && String(s.art || '').toUpperCase() === clean.art);
    if (artChanged && sameArt.length > 0 && !window.confirm(
      `ART ${clean.art} 스티커가 이미 ${sameArt.length}장 있어요.\n그래도 저장할까요? (같은 ART 스티커가 ${sameArt.length + 1}장이 돼요)`,
    )) return null;

    const now = new Date().toISOString();
    const who = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    // 문서를 통째로 덮어쓰는 저장 — 기존 문서를 먼저 깔고 입력 값을 얹음 (입력 창에 없는 칸이 생겨도 지워지지 않게, 저장 규약)
    const docToSave = {
      ...(existing || {}),
      ...clean,
      id: editingId || newStickerId(),
      createdAt: existing?.createdAt || now,
      createdBy: existing?.createdBy || who,
      updatedAt: now,
      updatedBy: who,
    };
    savingRef.current = true;
    try {
      const ok = await saveDocToCloud(COLLECTION, docToSave);
      if (ok === false) return null; // 실패 알림은 saveDocToCloud가 띄움 — 입력값은 그대로
      showToast(`'${clean.art}' 스티커를 저장했어요.`, 'success');
      return docToSave;
    } finally {
      savingRef.current = false;
    }
  };

  /** 삭제 (되돌릴 수 없음 확인). 반환: 지웠으면 true */
  const deleteSticker = async (id) => {
    const target = (hangerStickers || []).find(s => s.id === id);
    if (!target) return false;
    if (!window.confirm(`'${target.art || '이름 없음'}' 스티커를 지울까요?\n지우면 되돌릴 수 없어요.`)) return false;
    const ok = await deleteDocFromCloud(COLLECTION, id);
    if (ok === false) return false;
    showToast('스티커를 지웠어요.', 'success');
    return true;
  };

  /** 엑셀 다운로드 — 고른 스티커를 ART 순서로 (1장 = 시트 1장). QR이 빈 스티커가 있으면 한 번 물어봄. 반환: 받았으면 true */
  const downloadStickers = async (list) => {
    if (downloadingRef.current) return false;
    const items = sortStickers((list || []).filter(Boolean));
    if (items.length === 0) {
      showToast('엑셀로 받을 스티커를 골라 주세요.', 'error');
      return false;
    }
    const noQr = items.filter(s => !String(s.qr || '').trim());
    if (noQr.length > 0) {
      const names = noQr.slice(0, 5).map(s => s.art || '이름 없음').join(', ') + (noQr.length > 5 ? ` 외 ${noQr.length - 5}장` : '');
      if (!window.confirm(`QR이 없는 스티커가 ${noQr.length}장 있어요 (${names}).\nQR 자리를 비운 채로 받을까요?`)) return false;
    }
    downloadingRef.current = true;
    try {
      const template = await loadTemplate();
      const pages = [];
      for (const s of items) {
        const qr = String(s.qr || '').trim();
        const qrPng = qr ? await makeQrPng(qr) : null;
        if (qr && !qrPng) throw new Error(`${s.art || '이름 없음'}의 QR 글자가 너무 길어서 QR을 만들 수 없어요.`);
        pages.push({ sticker: s, qrPng });
      }
      saveFile(buildStickerWorkbook(template, pages), fileNameFor(items));
      showToast(items.length === 1
        ? `'${items[0].art}' 스티커를 엑셀로 받았어요.`
        : `스티커 ${items.length}장을 엑셀로 받았어요. 한 번에 인쇄하려면 엑셀 인쇄 설정에서 '전체 통합 문서 인쇄'를 고르세요.`, 'success');
      return true;
    } catch (e) {
      console.error('헹거 스티커 엑셀 만들기 실패', e);
      showToast(`엑셀을 만들지 못했어요: ${e?.message || e}`, 'error');
      return false;
    } finally {
      downloadingRef.current = false;
    }
  };

  return { saveSticker, deleteSticker, downloadStickers };
};
