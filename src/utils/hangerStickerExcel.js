import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// ============================================================
// GRUBIG ERP - 헹거 스티커 엑셀 만들기 (대표님 TAG.xlsx 양식 그대로) — 2026-10-14
//  · 양식 파일(src/assets/hanger-sticker-template.xlsx)의 첫 시트를 스티커마다 한 장씩 복사해서 값만 바꿈
//    → 글꼴·칸 크기·합친 칸·인쇄 영역·여백·용지(프린터 설정)·QR 자리까지 양식 그대로
//  · 스티커 1장 = 시트 1장 (시트 이름 = ART). 여러 장은 엑셀 인쇄에서 '전체 통합 문서 인쇄'
//  · SheetJS 무료판은 글꼴·칸 크기·그림을 못 살려서, 엑셀 파일(zip) 안의 XML을 직접 고침 (fflate)
//  · 양식 그림은 QR 하나(회색 QR 자리 + QR 그림)만 있다고 봄 — 다른 그림이 생기면 여기서 오류로 알려 줌
//  · 브라우저 기능을 안 써서 Node에서도 돌아감 (양식 파일 만들기·검사)
// ============================================================

/** 값을 넣는 칸 (양식 첫 시트 기준 — 합친 칸은 왼쪽 위 칸) */
export const STICKER_CELLS = {
  art: 'E3',      // ART. (E3:E4)
  title: 'D6',    // 제목 — PERFORMANCE WOOL 자리 (D6:F7)
  content: 'E8',  // CONTENT (E8:F9)
  type: 'E10',    // TYPE (E10:F10)
  width: 'E11',   // WIDTH (E11:F11)
  weight: 'E12',  // WEIGHT (E12:F12)
  care: 'E13',    // CARE (E13:F13)
  note: 'D14',    // 아래 설명 — 맨 아래 칸 (D14:F18)
};

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL = {
  worksheet: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  drawing: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  printerSettings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings',
  sharedStrings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
};
const CT = {
  worksheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
  drawing: 'application/vnd.openxmlformats-officedocument.drawing+xml',
  sharedStrings: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
};

// ── XML 글자 ──
const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescXml = (s) => String(s)
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');
// 엑셀은 칸 글자 안의 '_x0041_' 같은 모양을 다른 글자로 읽음 → 읽을 때 풀고, 쓸 때는 '_x005F_'(밑줄)로 막음
const decodeExcelEscapes = (s) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
// XML에 넣을 수 없는 글자(제어 문자 등) 빼기 — 탭·줄 바꿈은 둠
const isXmlChar = (c) => c === 0x9 || c === 0xA || c === 0xD
  || (c >= 0x20 && c <= 0xD7FF) || (c >= 0xE000 && c <= 0xFFFD) || c >= 0x10000;
const encodeCellText = (s) => Array.from(String(s ?? '').replace(/\r\n?/g, '\n'))
  .filter(ch => isXmlChar(ch.codePointAt(0)))
  .join('')
  .replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_');

const attrsOf = (s) => {
  const out = {};
  for (const m of String(s).matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = unescXml(m[2]);
  return out;
};

// ── zip 안 경로 ──
const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const resolvePath = (fromFile, target) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dirOf(fromFile).split('/').filter(Boolean);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
};
const relsPathOf = (file) => {
  const dir = dirOf(file);
  return `${dir ? `${dir}/` : ''}_rels/${file.slice(file.lastIndexOf('/') + 1)}.rels`;
};
const relativeTo = (fromFile, toPath) => {
  const from = dirOf(fromFile).split('/').filter(Boolean);
  const to = toPath.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i += 1;
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/');
};

const parseRels = (xml) => [...xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)].map(m => attrsOf(m[1]));
const relsXml = (rels) => `${XML_DECL}<Relationships xmlns="${NS_RELS}">${rels.map(r =>
  `<Relationship Id="${escXml(r.Id)}" Type="${escXml(r.Type)}" Target="${escXml(r.Target)}"${r.TargetMode ? ` TargetMode="${escXml(r.TargetMode)}"` : ''}/>`).join('')}</Relationships>`;

const parseSharedStrings = (xml) => [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => {
  const body = m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''); // 읽는 법(후리가나) 칸은 빼고
  return decodeExcelEscapes([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => unescXml(t[1])).join(''));
});
const siXml = (text) => {
  const t = encodeCellText(text);
  const space = /^\s|\s$/.test(t) ? ' xml:space="preserve"' : '';
  return `<si><t${space}>${escXml(t)}</t></si>`;
};

// ── 시트 이름 (엑셀 규칙: 31자까지 · \ / ? * [ ] : 안 됨 · 앞뒤 ' 안 됨 · 대소문자 무시하고 겹치면 안 됨) ──
const trimQuotes = (s) => s.replace(/^'+|'+$/g, '').trim();
const uniqueSheetName = (raw, used) => {
  let base = trimQuotes(String(raw ?? '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim());
  if (!base) base = '스티커';
  if (base.toLowerCase() === 'history') base = 'History 1'; // 엑셀이 쓰는 이름
  base = trimQuotes(base.slice(0, 31)) || '스티커';
  let name = base;
  for (let k = 2; used.has(name.toLowerCase()); k += 1) {
    const suffix = ` (${k})`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
};
const quoteSheetName = (name) => `'${String(name).replace(/'/g, "''")}'`;
const sheetUid = (i) => `{00000000-0001-0000-${(i + 1).toString(16).toUpperCase().padStart(4, '0')}-000000000000}`;

// ── 양식 읽기 ──
const readTemplate = (templateBytes) => {
  let files;
  try {
    files = unzipSync(templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes));
  } catch {
    throw new Error('스티커 양식 파일을 열 수 없어요.');
  }
  const text = (p) => {
    if (!files[p]) throw new Error(`스티커 양식에 ${p}가 없어요.`);
    return strFromU8(files[p]);
  };

  const rootRels = parseRels(text('_rels/.rels'));
  const officeRel = rootRels.find(r => String(r.Type).endsWith('/officeDocument'));
  if (!officeRel) throw new Error('스티커 양식에 통합 문서가 없어요.');
  const workbookPath = resolvePath('', officeRel.Target);
  const workbook = text(workbookPath);
  const wbRels = parseRels(text(relsPathOf(workbookPath)));

  // 첫 시트 = 스티커 양식
  const firstSheet = workbook.match(/<sheet\b[^>]*>/);
  const sheetRel = firstSheet ? wbRels.find(r => r.Id === attrsOf(firstSheet[0])['r:id']) : null;
  if (!sheetRel) throw new Error('스티커 양식에 시트가 없어요.');
  const sheetPath = resolvePath(workbookPath, sheetRel.Target);
  const sheetXml = text(sheetPath);
  const sheetRels = files[relsPathOf(sheetPath)] ? parseRels(text(relsPathOf(sheetPath))) : [];
  if (sheetRels.some(r => !/\/(drawing|printerSettings)$/.test(r.Type))) {
    throw new Error('스티커 양식 시트에 그림·프린터 설정 말고 다른 연결이 있어요.');
  }

  // QR 자리 — 회색 QR 자리 + QR 그림 하나
  const drawingRel = sheetRels.find(r => r.Type.endsWith('/drawing'));
  if (!drawingRel) throw new Error('스티커 양식에 QR 그림 자리가 없어요.');
  const drawingPath = resolvePath(sheetPath, drawingRel.Target);
  const drawingXml = text(drawingPath);
  const drawingRels = parseRels(text(relsPathOf(drawingPath)));
  if (drawingRels.length !== 1 || !drawingRels[0].Type.endsWith('/image')) {
    throw new Error('스티커 양식 그림은 QR 하나만 있어야 해요.');
  }
  const imageRel = drawingRels[0];
  if (!drawingXml.includes(`r:embed="${imageRel.Id}"`)) throw new Error('스티커 양식에서 QR 그림을 찾지 못했어요.');
  const imagePath = resolvePath(drawingPath, imageRel.Target);

  const printerRel = sheetRels.find(r => r.Type.endsWith('/printerSettings'));
  const printerPath = printerRel ? resolvePath(sheetPath, printerRel.Target) : null;
  if (printerPath && !files[printerPath]) throw new Error(`스티커 양식에 ${printerPath}가 없어요.`);

  const sstRel = wbRels.find(r => r.Type.endsWith('/sharedStrings'));
  const sstPath = sstRel ? resolvePath(workbookPath, sstRel.Target) : `${dirOf(workbookPath)}/sharedStrings.xml`;
  const strings = sstRel ? parseSharedStrings(text(sstPath)) : [];

  // 인쇄 영역 (첫 시트) — 'PW1001'!$D$2:$F$18 → $D$2:$F$18
  const printAreaDef = [...workbook.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)]
    .map(m => ({ attrs: attrsOf(m[1]), value: unescXml(m[2]) }))
    .find(d => d.attrs.name === '_xlnm.Print_Area' && d.attrs.localSheetId === '0');
  const printArea = printAreaDef ? printAreaDef.value.slice(printAreaDef.value.lastIndexOf('!') + 1) : '';

  return {
    files, rootRels, contentTypes: text('[Content_Types].xml'),
    workbookPath, workbook, wbRels,
    sheetPath, sheetXml,
    drawingRelId: drawingRel.Id, drawingPath, drawingXml, imageRelId: imageRel.Id, imagePath,
    printerRelId: printerRel?.Id || null, printerPath,
    sstPath, strings, printArea,
  };
};

// ── 시트 한 장 ──
const FIELD_BY_CELL = Object.fromEntries(Object.entries(STICKER_CELLS).map(([key, ref]) => [ref, key]));
const CELL_RE = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;

// 스티커 값 넣기 + 양식 글자 칸(ART. · CONTENT … 이름표)은 새 공유 글자 번호로
const fillCells = (xml, sticker, tplStrings, sstIndex) => {
  const seen = new Set();
  const out = xml.replace(CELL_RE, (whole, attrStr, _end, inner) => {
    const attrs = attrsOf(attrStr);
    const field = FIELD_BY_CELL[attrs.r];
    if (field) {
      seen.add(attrs.r);
      const style = attrs.s !== undefined ? ` s="${escXml(attrs.s)}"` : '';
      const value = String(sticker[field] ?? '');
      return value.trim()
        ? `<c r="${attrs.r}"${style} t="s"><v>${sstIndex(value)}</v></c>`
        : `<c r="${attrs.r}"${style}/>`;
    }
    if (attrs.t === 's' && inner) {
      const v = inner.match(/<v>(\d+)<\/v>/);
      if (v) return `<c${attrStr}>${inner.replace(v[0], `<v>${sstIndex(tplStrings[Number(v[1])] ?? '')}</v>`)}</c>`;
    }
    return whole;
  });
  const missing = Object.values(STICKER_CELLS).filter(ref => !seen.has(ref));
  if (missing.length) throw new Error(`스티커 양식에 ${missing.join(', ')} 칸이 없어요.`);
  return out;
};

// 첫 시트만 선택된 상태로 (여러 시트가 같이 선택되면 엑셀이 '그룹'으로 열어서 한 칸을 고치면 다 바뀜) + 시트마다 다른 이름표
const tuneSheet = (xml, i) => {
  let x = xml.replace(/\s+tabSelected="[^"]*"/g, '');
  if (i === 0) x = x.replace(/<sheetView\b/, '<sheetView tabSelected="1"');
  x = x.replace(/(<worksheet\b[^>]*\sxr:uid=")[^"]*(")/, `$1${sheetUid(i)}$2`);
  x = x.replace(/(<sheetPr\b[^>]*\scodeName=")[^"]*(")/, `$1Sheet${i + 1}$2`);
  return x;
};

const appXmlFor = (tplApp, names, hasPrintArea) => {
  const titles = [...names, ...(hasPrintArea ? names.map(n => `${quoteSheetName(n)}!Print_Area`) : [])];
  const pairs = [['워크시트', names.length], ...(hasPrintArea ? [['이름 지정된 범위', names.length]] : [])];
  const heading = `<HeadingPairs><vt:vector size="${pairs.length * 2}" baseType="variant">${pairs.map(([label, count]) =>
    `<vt:variant><vt:lpstr>${label}</vt:lpstr></vt:variant><vt:variant><vt:i4>${count}</vt:i4></vt:variant>`).join('')}</vt:vector></HeadingPairs>`;
  const parts = `<TitlesOfParts><vt:vector size="${titles.length}" baseType="lpstr">${titles.map(t => `<vt:lpstr>${escXml(t)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`;
  return tplApp
    .replace(/<HeadingPairs>[\s\S]*?<\/HeadingPairs>/, heading)
    .replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/, parts);
};
const coreXmlFor = (tplCore, now) => tplCore.replace(
  /(<dcterms:modified\b[^>]*>)[^<]*(<\/dcterms:modified>)/,
  `$1${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}$2`,
);

/**
 * 헹거 스티커 엑셀 만들기
 * @param {Uint8Array|ArrayBuffer} templateBytes 양식 xlsx (첫 시트 = 스티커 양식)
 * @param {Array<{ sticker: object, qrPng?: Uint8Array|null }>} pages 스티커마다 칸 값 + QR 그림(PNG). QR이 없으면 QR 자리를 비움
 * @param {{ now?: Date }} [opts]
 * @returns {Uint8Array} 새 xlsx 파일
 */
export const buildStickerWorkbook = (templateBytes, pages, { now = new Date() } = {}) => {
  const list = (pages || []).filter(Boolean);
  if (list.length === 0) throw new Error('뽑을 스티커가 없어요.');
  const tpl = readTemplate(templateBytes);

  // 공유 글자 목록 — 시트의 글자 칸은 이 목록의 번호로 적힘 (같은 글자는 한 번만)
  const sstList = [];
  const sstMap = new Map();
  let sstCount = 0;
  const sstIndex = (s) => {
    const key = String(s ?? '');
    sstCount += 1;
    if (!sstMap.has(key)) { sstMap.set(key, sstList.length); sstList.push(key); }
    return sstMap.get(key);
  };

  const out = { '[Content_Types].xml': null }; // zip 안 순서 — 내용 목록을 맨 앞에 (값은 맨 끝에 채움)
  const partTypes = new Map();                   // 시트·그림 → 내용 종류
  const usedNames = new Set();
  const sheets = [];
  const sheetDir = dirOf(tpl.sheetPath);
  const drawingDir = dirOf(tpl.drawingPath);
  const mediaDir = dirOf(tpl.imagePath);
  const printerDir = tpl.printerPath ? dirOf(tpl.printerPath) : '';

  list.forEach(({ sticker = {}, qrPng = null }, i) => {
    const n = i + 1;
    const name = uniqueSheetName(sticker.art, usedNames);
    const sheetPath = `${sheetDir}/sheet${n}.xml`;
    const sheetRels = [];
    let xml = tuneSheet(fillCells(tpl.sheetXml, sticker, tpl.strings, sstIndex), i);

    if (qrPng && qrPng.length > 0) {
      const drawingPath = `${drawingDir}/drawing${n}.xml`;
      const imagePath = `${mediaDir}/image${n}.png`;
      out[drawingPath] = strToU8(tpl.drawingXml);
      out[relsPathOf(drawingPath)] = strToU8(relsXml([{ Id: tpl.imageRelId, Type: REL.image, Target: relativeTo(drawingPath, imagePath) }]));
      out[imagePath] = qrPng;
      partTypes.set(drawingPath, CT.drawing);
      sheetRels.push({ Id: tpl.drawingRelId, Type: REL.drawing, Target: relativeTo(sheetPath, drawingPath) });
    } else {
      // QR 없음 → 회색 QR 자리와 QR 그림을 같이 빼서 그 자리를 비움
      xml = xml.replace(new RegExp(`<drawing\\b[^>]*\\br:id="${tpl.drawingRelId}"[^>]*/>`), '');
    }
    if (tpl.printerPath) {
      const printerPath = `${printerDir}/printerSettings${n}.bin`;
      out[printerPath] = tpl.files[tpl.printerPath];
      sheetRels.push({ Id: tpl.printerRelId, Type: REL.printerSettings, Target: relativeTo(sheetPath, printerPath) });
    }
    out[sheetPath] = strToU8(xml);
    if (sheetRels.length) out[relsPathOf(sheetPath)] = strToU8(relsXml(sheetRels));
    partTypes.set(sheetPath, CT.worksheet);
    sheets.push({ name, path: sheetPath });
  });

  // 통합 문서 — 시트 목록 · 시트마다 인쇄 영역 (양식 첫 시트와 같은 범위)
  const wbPath = tpl.workbookPath;
  const sheetsXml = `<sheets>${sheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`;
  const definedNames = tpl.printArea
    ? `<definedNames>${sheets.map((s, i) =>
      `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${escXml(`${quoteSheetName(s.name)}!${tpl.printArea}`)}</definedName>`).join('')}</definedNames>`
    : '';
  const workbookXml = tpl.workbook
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, '')
    .replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, m => (m.includes('absPath') ? '' : m)) // 양식을 만든 PC 폴더 경로
    .replace(/\s(?:activeTab|firstSheet)="\d+"/g, '')
    .replace(/<sheets>[\s\S]*?<\/sheets>/, `${sheetsXml}${definedNames}`);

  // 통합 문서 연결 — 시트들 + 스타일·테마(양식 그대로) + 공유 글자(새로)
  const keepRels = tpl.wbRels.filter(r => /\/(styles|theme)$/.test(r.Type));
  const wbRels = [
    ...sheets.map((s, i) => ({ Id: `rId${i + 1}`, Type: REL.worksheet, Target: relativeTo(wbPath, s.path) })),
    ...keepRels.map((r, k) => ({ ...r, Id: `rId${sheets.length + k + 1}` })),
    { Id: `rId${sheets.length + keepRels.length + 1}`, Type: REL.sharedStrings, Target: relativeTo(wbPath, tpl.sstPath) },
  ];
  keepRels.forEach(r => {
    const p = resolvePath(wbPath, r.Target);
    if (!tpl.files[p]) throw new Error(`스티커 양식에 ${p}가 없어요.`);
    out[p] = tpl.files[p];
  });
  out[wbPath] = strToU8(workbookXml);
  out[relsPathOf(wbPath)] = strToU8(relsXml(wbRels));
  out[tpl.sstPath] = strToU8(`${XML_DECL}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sstCount}" uniqueCount="${sstList.length}">${sstList.map(siXml).join('')}</sst>`);

  // 문서 정보 (시트 이름 목록 · 고친 시각) — 연결된 파일 중 있는 것만
  const rootRels = tpl.rootRels.filter(r => {
    const p = resolvePath('', r.Target);
    if (p === wbPath) return true;
    if (!tpl.files[p]) return false;
    if (p.endsWith('/app.xml')) out[p] = strToU8(appXmlFor(strFromU8(tpl.files[p]), sheets.map(s => s.name), !!tpl.printArea));
    else if (p.endsWith('/core.xml')) out[p] = strToU8(coreXmlFor(strFromU8(tpl.files[p]), now));
    else out[p] = tpl.files[p];
    return true;
  });
  out['_rels/.rels'] = strToU8(relsXml(rootRels));

  // 내용 목록 — 확장자 기본값(png·bin·rels·xml 등) + 파일마다
  const tplOverrides = (tpl.contentTypes.match(/<Override\b[^>]*\/>/g) || []).map(attrsOf);
  const defaults = tpl.contentTypes.match(/<Default\b[^>]*\/>/g) || [];
  const hasDefault = (ext) => defaults.some(d => (attrsOf(d).Extension || '').toLowerCase() === ext);
  if (!hasDefault('png')) defaults.push('<Default Extension="png" ContentType="image/png"/>');
  if (tpl.printerPath && !hasDefault('bin')) defaults.push('<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>');
  if (!hasDefault('rels')) defaults.push('<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>');
  if (!hasDefault('xml')) defaults.push('<Default Extension="xml" ContentType="application/xml"/>');
  const overrides = Object.keys(out)
    .filter(p => p !== '[Content_Types].xml' && !p.endsWith('.rels'))
    .map(p => {
      const type = partTypes.get(p)
        || tplOverrides.find(o => o.PartName === `/${p}`)?.ContentType
        || (p === tpl.sstPath ? CT.sharedStrings : '');
      return type ? `<Override PartName="/${escXml(p)}" ContentType="${escXml(type)}"/>` : '';
    })
    .join('');
  out['[Content_Types].xml'] = strToU8(`${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join('')}${overrides}</Types>`);

  return zipSync(out, { level: 6, mtime: now });
};
