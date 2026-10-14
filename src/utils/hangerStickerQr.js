import qrcode from 'qrcode-generator';

// ============================================================
// GRUBIG ERP - 헹거 스티커 QR (2026-10-14)
//  · QR 만들기: qrcode-generator — 화면 미리보기는 SVG, 엑셀에는 PNG (칸 하나 = 정수 픽셀이라 또렷하게)
//  · QR 읽기: 대표님이 올린 QR 그림(EZ-TEX에서 받은 그림) → 안의 주소 (jsQR — 그림을 올릴 때만 불러옴)
//    EZ-TEX QR 번호는 EZ-TEX 안에서 정한 번호라 ART로 알 수 없어서, 그림에서 읽어 주소로 저장함
// ============================================================

// 한글 등도 UTF-8로 넣기 (라이브러리 기본은 영문만 — EZ-TEX 주소는 영문이라 보통은 상관없음)
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

// 오류 정정 M — EZ-TEX 주소(32자)면 EZ-TEX QR과 같은 29칸
const QR_ECL = 'M';

/** QR 칸 표 — 어두운 칸이면 true. 글자가 비었거나 QR에 다 못 넣을 만큼 길면 null */
export const makeQrMatrix = (text) => {
  const value = String(text ?? '').trim();
  if (!value) return null;
  try {
    const qr = qrcode(0, QR_ECL);
    qr.addData(value, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  } catch {
    return null;
  }
};

/** 미리보기 SVG 경로 — 칸 1개 = 1 (가로로 이어진 칸은 한 번에). viewBox는 0 0 (n + margin*2) */
export const qrSvgPath = (matrix, margin = 0) => {
  if (!matrix) return '';
  let d = '';
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c += 1; continue; }
      let len = 1;
      while (c + len < row.length && row[c + len]) len += 1;
      d += `M${c + margin} ${r + margin}h${len}v1h-${len}z`;
      c += len;
    }
  });
  return d;
};

/** 엑셀에 넣을 QR 그림 (PNG) — 칸 하나 = cell 픽셀, 둘레 margin칸 흰 여백. 만들 수 없으면 null */
export const makeQrPng = async (text, { cell = 8, margin = 2 } = {}) => {
  const matrix = makeQrMatrix(text);
  if (!matrix) return null;
  const size = (matrix.length + margin * 2) * cell;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
  }));
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('QR 그림을 만들지 못했어요.');
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * QR 그림 파일(올린 파일 · 붙여 넣은 그림)에서 글자(주소) 읽기
 *  - EZ-TEX QR 그림은 104px로 작아서 키워서 읽고, 큰 화면 캡처는 줄여서 한 번 + 원래 크기로 한 번 더
 *  - 둘레에 흰 여백을 붙임 (여백이 없는 그림도 읽히게)
 * @returns {Promise<string|null>} 읽은 글자 (QR을 못 찾으면 null)
 */
export const readQrFromImage = async (file) => {
  if (!file) return null;
  const { default: jsQR } = await import('jsqr');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('그림 파일을 열 수 없어요. PNG·JPG 그림을 올려 주세요.');
  }
  try {
    const longSide = Math.max(bitmap.width, bitmap.height) || 1;
    const first = Math.min(4, Math.max(0.25, 800 / longSide));
    const scales = first < 1 ? [first, 1] : [first];
    for (const scale of scales) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const pad = 40;
      const canvas = document.createElement('canvas');
      canvas.width = w + pad * 2;
      canvas.height = h + pad * 2;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = scale < 1; // 키울 때는 칸 모양 그대로 (흐리게 하지 않음)
      ctx.drawImage(bitmap, pad, pad, w, h);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if (found?.data) return String(found.data).trim();
    }
    return null;
  } finally {
    bitmap.close?.();
  }
};
