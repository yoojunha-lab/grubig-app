// GRUBIG ERP - [DEV 검증 전용] 인메모리 샘플 데이터
//  - App.jsx의 DEV_BYPASS(=import.meta.env.DEV + localStorage 플래그)일 때만 사용됨
//  - 프로덕션 빌드(vite build)에서는 import.meta.env.DEV===false 라 참조 분기가 죽은 코드로 제거됨
//  - 실제 Firestore 데이터와 무관한 가짜 데이터입니다.

export const DEV_SAMPLE_YARNS = [
  { id: 'y_dev_1', category: '소모',    name: '2/48 WOOL', remarks: '', updatedAt: '2026-07-15', suppliers: [{ id: 's_dev_1', name: 'XINAO',  currency: 'KRW', price: 18000, tariff: 8, freight: 2, isDefault: true, history: [{ date: '2026-07-15', price: 18000 }, { date: '2026-05-02', price: 17000 }] }] },
  { id: 'y_dev_2', category: '면방',    name: 'CM 30S',    remarks: '', updatedAt: '2026-06-20', suppliers: [{ id: 's_dev_2', name: '대원',    currency: 'KRW', price: 9000,  tariff: 0, freight: 0, isDefault: true, history: [{ date: '2026-06-20', price: 9000 }] }] },
  { id: 'y_dev_3', category: 'SPANDEX', name: 'SPAN 40D',  remarks: '', suppliers: [{ id: 's_dev_3', name: '효성',    currency: 'KRW', price: 12000, tariff: 0, freight: 0, isDefault: true, history: [] }] },
  { id: 'y_dev_4', category: '화섬',    name: 'POLY 75D',  remarks: '', suppliers: [{ id: 's_dev_4', name: 'TORAY',  currency: 'KRW', price: 7000,  tariff: 8, freight: 1, isDefault: true, history: [] }] },
];

// calculateCost가 호출돼도 안전하도록 비용/로스 필드까지 채운 완전한 원단 샘플
const baseFabric = {
  date: '2026-06-01',
  costGYd: '',
  knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000,
  dyeingFee: 8800,
  extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
  losses: {
    tier1k: { knit: 5, dye: 10 },
    tier3k: { knit: 3, dye: 10 },
    tier5k: { knit: 3, dye: 9 },
  },
  marginTier: 3,
  brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
  remarks: '',
};

export const DEV_SAMPLE_FABRICS = [
  { ...baseFabric, id: 'fab_dev_1', article: 'GB-2401', itemName: 'Wool Jersey',        widthFull: 60, widthCut: 58, gsm: 280, yarns: [{ yarnId: 'y_dev_1', ratio: 100 }] },
  { ...baseFabric, id: 'fab_dev_2', article: 'GB-2402', itemName: 'Cotton Span Rib',    widthFull: 44, widthCut: 42, gsm: 320, yarns: [{ yarnId: 'y_dev_2', ratio: 95 }, { yarnId: 'y_dev_3', ratio: 5 }] },
  { ...baseFabric, id: 'fab_dev_3', article: 'GB-2403', itemName: 'Poly Interlock',     widthFull: 62, widthCut: 60, gsm: 240, yarns: [{ yarnId: 'y_dev_4', ratio: 100 }] },
  { ...baseFabric, id: 'fab_dev_4', article: 'GB-2404', itemName: 'Wool/Poly Melange',  widthFull: 58, widthCut: 56, gsm: 300, yarns: [{ yarnId: 'y_dev_1', ratio: 60 }, { yarnId: 'y_dev_4', ratio: 40 }] },
  { ...baseFabric, id: 'fab_dev_5', article: 'GB-2405', itemName: 'Cotton Single',      widthFull: 66, widthCut: 64, gsm: 180, yarns: [{ yarnId: 'y_dev_2', ratio: 100 }] },
];

// ── [DEV 검증 전용] 개발의뢰 / 설계서 샘플 (개발·설계 현황 화면 확인용) ──────────
//   기준일(테스트 가정) = 2026-06-22. 납기 지연(D+)/임박(D-3 이내)/정상/미설정 케이스를 모두 커버.
//   - dr_dev_1, dr_dev_2 : 설계서에 연결된 '확정' 의뢰 → 바이어명 조회용 (보관함에 표시)
//   - dr_dev_3~5         : 진행 중 의뢰 → [개발 의뢰 현황] 섹션 표시용 (pending/analyzing/hold)
export const DEV_SAMPLE_DEV_REQUESTS = [
  {
    id: 'dr_dev_1', devOrderNo: 'F-26D006', buyerName: '효성TNC', status: 'confirmed',
    devItem: 'W/N/PU=64/32/4, BACK 다대 스트라이프', linkedDesignSheetId: 'ds_dev_6',
    targetSpec: { composition: 'W/N/PU=64/32/4', sampleDeadline: '2026-06-25' },
    createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-04-06T00:00:00.000Z',
  },
  {
    id: 'dr_dev_2', devOrderNo: 'F-26D011', buyerName: '피플앤네이쳐', status: 'confirmed',
    devItem: 'W/Tencel=45/55 변형인터록', linkedDesignSheetId: 'ds_dev_7',
    targetSpec: { composition: 'W/Tencel=45/55', sampleDeadline: '2026-07-01' },
    createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-04-06T00:00:00.000Z',
  },
  {
    id: 'dr_dev_3', devOrderNo: 'F-26D012', buyerName: 'BYC', status: 'pending',
    devItem: '면스판 변형 골지',
    targetSpec: { composition: 'CM30/SP=95/5', analysisDeadline: '2026-06-25' },
    createdAt: '2026-06-22T01:00:00.000Z', updatedAt: '2026-06-22T01:00:00.000Z',
  },
  {
    id: 'dr_dev_4', devOrderNo: 'F-26D013', buyerName: '한세실업', status: 'analyzing',
    devItem: '폴리 인터록 경량',
    targetSpec: { composition: 'POLY100', analysisDeadline: '2026-06-20' },
    createdAt: '2026-06-15T00:00:00.000Z', updatedAt: '2026-06-18T00:00:00.000Z',
  },
  {
    id: 'dr_dev_5', devOrderNo: 'F-26D014', buyerName: '신성통상', status: 'hold',
    devItem: '울 멜란지 더블',
    targetSpec: { composition: 'WOOL/POLY=60/40', sampleDeadline: '2026-07-05' },
    createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-19T00:00:00.000Z',
  },
];

export const DEV_SAMPLE_DESIGN_SHEETS = [
  // 자체개발 · 설계서 작성(draft) · 납기 미설정
  {
    id: 'ds_dev_1', stage: 'draft', status: 'active', fabricName: 'W/N/R=29/51/20 담보루',
    devOrderNo: '', eztexOrderNo: '', devRequestId: '', deadline: '', registeredDate: '2026-05-15',
    createdAt: '2026-05-15T00:00:00.000Z', updatedAt: '2026-05-18T00:00:00.000Z',
  },
  // 자체개발 · draft · 납기 정상(D-18)
  {
    id: 'ds_dev_2', stage: 'draft', status: 'active', fabricName: 'SW/N=89/11 F/50, 미니쥬리',
    devOrderNo: '', eztexOrderNo: '', devRequestId: '', deadline: '2026-07-10', registeredDate: '2026-05-14',
    createdAt: '2026-05-14T00:00:00.000Z', updatedAt: '2026-05-14T00:00:00.000Z',
  },
  // 자체개발 · EZ-TEX 등록 단계 · 번호 미입력 · 납기 임박(D-2)
  {
    id: 'ds_dev_3', stage: 'eztex', status: 'active', fabricName: 'ASK F/50 왕벌집(SW/P=38/62)',
    devOrderNo: '', eztexOrderNo: '', devRequestId: '', deadline: '2026-06-24', registeredDate: '2026-05-06',
    createdAt: '2026-05-06T00:00:00.000Z', updatedAt: '2026-06-15T00:00:00.000Z',
  },
  // 자체개발 · eztex · 번호 입력됨 · 납기 정상
  {
    id: 'ds_dev_4', stage: 'eztex', status: 'active', fabricName: 'ASK F/50 요꼬 STRIPE(SW/P=48/52)',
    devOrderNo: '', eztexOrderNo: 'EZ-2406-001', devRequestId: '', deadline: '2026-07-08', registeredDate: '2026-05-06',
    createdAt: '2026-05-06T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z',
  },
  // 자체개발 · 샘플 진행(sampling) · 납기 지연(D+4)
  {
    id: 'ds_dev_5', stage: 'sampling', status: 'active', fabricName: 'W/P=28/72, 2/36 미니쥬리',
    devOrderNo: '', eztexOrderNo: 'EZ-2405-088', devRequestId: '', deadline: '2026-06-18', registeredDate: '2026-05-06',
    createdAt: '2026-05-06T00:00:00.000Z', updatedAt: '2026-06-12T00:00:00.000Z',
  },
  // 바이어(효성TNC) · sampling · 납기 임박(D-3)
  {
    id: 'ds_dev_6', stage: 'sampling', status: 'active', fabricName: 'W/N/PU=64/32/4, BACK 다대 스트라이프',
    devOrderNo: 'F-26D006', eztexOrderNo: 'EZ-2404-120', devRequestId: 'dr_dev_1', deadline: '2026-06-25', registeredDate: '2026-04-03',
    createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-06-13T00:00:00.000Z',
  },
  // 바이어(피플앤네이쳐) · draft · 납기 정상(D-9)
  {
    id: 'ds_dev_7', stage: 'draft', status: 'active', fabricName: 'W/Tencel=45/55 변형인터록',
    devOrderNo: 'F-26D011', eztexOrderNo: '', devRequestId: 'dr_dev_2', deadline: '2026-07-01', registeredDate: '2026-04-03',
    createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-05-25T00:00:00.000Z',
  },
];
