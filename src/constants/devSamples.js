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

// [원가 개편 2026-10] 새 원가 필드(편직 난이도·kg단가·가공 유형) 있는 품목과 없는 옛 품목을 섞어둠
//   - GB-2401 / GB-2404 : 옛 형식 (난이도 A · 가공 일반 · kg단가 = 옛 5,000YD 편직료로 계산되는지 확인)
//   - GB-2404           : 옛 기타비용(외관/이화학/운임 기본 3항목 + 품목 추가비용 1개) — 기본 3항목은 무시되는지 확인
//   - GB-2402 / 2403 / 2405 : 새 형식 (스판물 · 난이도 B · kg단가 구간)
export const DEV_SAMPLE_FABRICS = [
  { ...baseFabric, id: 'fab_dev_1', article: 'GB-2401', itemName: 'Wool Jersey',        widthFull: 60, widthCut: 58, gsm: 280, yarns: [{ yarnId: 'y_dev_1', ratio: 100 }] },
  { ...baseFabric, id: 'fab_dev_2', article: 'GB-2402', itemName: 'Cotton Span Rib',    widthFull: 44, widthCut: 42, gsm: 320, yarns: [{ yarnId: 'y_dev_2', ratio: 95 }, { yarnId: 'y_dev_3', ratio: 5 }],
    knitGrade: 'A', knitKgRate: 2000, knitKgRateTiers: [], processType: 'span', etcCosts: [] },
  { ...baseFabric, id: 'fab_dev_3', article: 'GB-2403', itemName: 'Poly Interlock',     widthFull: 62, widthCut: 60, gsm: 240, yarns: [{ yarnId: 'y_dev_4', ratio: 100 }],
    knitGrade: 'B', knitKgRate: 2200, knitKgRateTiers: [], processType: 'normal', etcCosts: [] },
  { ...baseFabric, id: 'fab_dev_4', article: 'GB-2404', itemName: 'Wool/Poly Melange',  widthFull: 58, widthCut: 56, gsm: 300, yarns: [{ yarnId: 'y_dev_1', ratio: 60 }, { yarnId: 'y_dev_4', ratio: 40 }],
    knittingFee5k: 2100,
    etcCosts: [
      { id: 'etc_visual', name: '외관검사', vals: { tier1k: 190, tier3k: 190, tier5k: 190 } },
      { id: 'etc_chem', name: '이화학검사', vals: { tier1k: 400, tier3k: 300, tier5k: 200 } },
      { id: 'etc_freight', name: '운임', vals: { tier1k: 500, tier3k: 300, tier5k: 200 } },
      { id: 'etc_3_x', name: '특수 포장', vals: { tier1k: 50, tier3k: 40, tier5k: 30 } },
    ] },
  { ...baseFabric, id: 'fab_dev_5', article: 'GB-2405', itemName: 'Cotton Single',      widthFull: 66, widthCut: 64, gsm: 180, yarns: [{ yarnId: 'y_dev_2', ratio: 100 }],
    knitGrade: 'A', knitKgRate: 2000, knitKgRateTiers: [{ fromKg: 1000, rate: 1800 }], processType: 'brushed', etcCosts: [] },
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
    // 옛 형식 원가 입력 (새 원가 필드 없음) — 설계서 원가 표가 기본값(A·일반·옛 편직료)으로 계산되는지 확인용
    yarns: [{ yarnId: 'y_dev_1', ratio: 64 }, { yarnId: 'y_dev_4', ratio: 36 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }],
    costInput: { ...baseFabric, widthFull: 58, widthCut: 56, gsm: 260, finishing: [], riskMarginPct: 0 },
  },
  // 바이어(피플앤네이쳐) · draft · 납기 정상(D-9)
  {
    id: 'ds_dev_7', stage: 'draft', status: 'active', fabricName: 'W/Tencel=45/55 변형인터록',
    devOrderNo: 'F-26D011', eztexOrderNo: '', devRequestId: 'dr_dev_2', deadline: '2026-07-01', registeredDate: '2026-04-03',
    createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-05-25T00:00:00.000Z',
  },
];

// ── [DEV 검증 전용] 생산 오더 샘플 (생산 현황 v8 현황표·간트 확인용) ─────────────
//   대표님 엑셀 생산 현황표의 실제 행을 본뜸. 기준일(테스트 가정) ≈ 2026-09-28.
//   - F-26M020 : 컬러 5개, 편직 진행 + 컬러별 LOT(300/500kg 탕) + 날짜 메모
//   - F-26M016 : 컨펌 합격 → 출고 완료/대기
//   - F-26S055 : 샘플, 생지출고 완료 + LOT 1개 진행
//   - O-LEGACY-01 : v7(차수 구조) 옛 형식 → 화면에서 v8로 자동 변환되는지 확인용
const devStep = (patch = {}) => ({ vendor: '', startDate: '', endDate: '', status: 'pending', doneDate: '', notes: '', ...patch });
const devSteps = (patch = {}) => ({
  yarn: devStep(), yarn_processing: devStep(), knitting: { ...devStep(), dailyKg: null },
  finishing: devStep(), physical_test: devStep(), visual_inspection: devStep(), ...patch,
});
const devLot = (id, no, machineKg, qtyKg, startDate, endDate, status, rolls = null) =>
  ({ id, no, machineKg, qtyKg, startDate, endDate, status, rolls, notes: '' });
const devColor = (id, name, orderKg, patch = {}) => ({
  id, name, orderKg, workKg: null, greigeOutDate: '', greigeOutDone: false, lots: [], confirmRounds: [],
  shipDate: '', shipDone: false, notes: '', ...patch,
});

export const DEV_SAMPLE_ORDERS = [
  {
    id: 'ord_dev_m020', schemaVersion: 8, orderNumber: 'F-26M020', articleNo: 'PW1024A', detail: 'SW/PES=37/63 GRID',
    customer: '네셔널 지오그래픽', type: 'main', finalDueDate: '2026-10-16', lossRate: 10, status: 'active',
    notes: 'BLACK 기계 대수 재확인 필요', linkedFabricId: null, linkedFabricArticle: '', dyeVendor: '킹텍스',
    steps: devSteps({
      knitting: { ...devStep({ vendor: '한성섬유', startDate: '2026-08-27', status: 'in_progress', notes: '75kg/일' }), dailyKg: 75 },
    }),
    colors: [
      devColor('c_m020_or', 'ORANGE', 38.9, {
        greigeOutDate: '2026-08-26', greigeOutDone: true,
        lots: [devLot('l_m020_or1', 1, 300, 42.8, '2026-09-10', '2026-09-15', 'done', 6)],
        confirmRounds: [{ round: 1, sentDate: '2026-09-22', resultDate: '', result: '' }],
      }),
      devColor('c_m020_wh', 'WHITE', 484.5, {
        greigeOutDate: '2026-09-03', greigeOutDone: true,
        lots: [
          devLot('l_m020_wh1', 1, 300, 266.5, '2026-09-15', '2026-09-18', 'done', 3),
          devLot('l_m020_wh2', 2, 300, 266.5, '2026-09-24', '2026-09-30', 'in_progress'),
        ],
      }),
      devColor('c_m020_dg', 'DARK GREY', 270.2, {
        greigeOutDate: '2026-09-09', greigeOutDone: true,
        lots: [devLot('l_m020_dg1', 1, 300, 297.2, '2026-10-01', '2026-10-06', 'pending')],
      }),
      devColor('c_m020_kh', 'KHAKI', 508.3, { greigeOutDate: '2026-09-30' }),
      devColor('c_m020_bk', 'BLACK', 1119.3, {
        greigeOutDate: '2026-09-12', greigeOutDone: true,
        lots: [
          devLot('l_m020_bk1', 1, 500, 410.4, '2026-09-15', '2026-09-19', 'done', 3),
          devLot('l_m020_bk2', 2, 500, 410.4, '2026-09-25', '2026-09-30', 'in_progress'),
          devLot('l_m020_bk3', 3, 500, 410.4, '2026-10-02', '2026-10-07', 'pending'),
        ],
      }),
    ],
    dailyNotes: [
      { id: 'n_m020_1', date: '2026-09-15', colorId: 'c_m020_bk', text: '염색 12시 오후 가공예정', tone: 'dyeing' },
      { id: 'n_m020_2', date: '2026-09-16', colorId: 'c_m020_bk', text: 'black x 3 roll', tone: 'dyeing' },
      { id: 'n_m020_3', date: '2026-09-18', colorId: 'c_m020_or', text: 'orange x 3 roll 추가 배색요청', tone: 'dyeing' },
      { id: 'n_m020_4', date: '2026-09-21', colorId: 'c_m020_kh', text: '편직대기', tone: 'knitting' },
    ],
    changeLog: [], createdBy: 'dev@grubig.kr', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z',
  },
  {
    id: 'ord_dev_m016', schemaVersion: 8, orderNumber: 'F-26M016', articleNo: 'PW1037', detail: 'SW/PES=48/52 AIR STRIPE',
    customer: '케일', type: 'main', finalDueDate: '2026-09-30', lossRate: 10, status: 'active',
    notes: '', linkedFabricId: null, linkedFabricArticle: '', dyeVendor: '킹텍스',
    steps: devSteps({
      knitting: { ...devStep({ vendor: '한성섬유', startDate: '2026-08-18', endDate: '2026-08-29', status: 'done', doneDate: '2026-08-29' }), dailyKg: null },
    }),
    colors: [
      devColor('c_m016_bk', 'BLACK', 92.5, {
        greigeOutDate: '2026-09-01', greigeOutDone: true,
        lots: [devLot('l_m016_bk1', 1, 300, 101.8, '2026-09-03', '2026-09-08', 'done')],
        confirmRounds: [{ round: 1, sentDate: '2026-09-10', resultDate: '2026-09-15', result: 'pass' }],
        shipDate: '2026-09-21', shipDone: true,
      }),
      devColor('c_m016_gg', 'GOLD GREEN', 37, {
        greigeOutDate: '2026-09-01', greigeOutDone: true,
        lots: [devLot('l_m016_gg1', 1, 300, 40.7, '2026-09-03', '2026-09-08', 'done')],
        confirmRounds: [
          { round: 1, sentDate: '2026-09-10', resultDate: '2026-09-15', result: 'fail' },
          { round: 2, sentDate: '2026-09-22', resultDate: '', result: '' },
        ],
        shipDate: '2026-09-30',
      }),
      devColor('c_m016_br', 'BROWN', 55.5, {
        greigeOutDate: '2026-09-01', greigeOutDone: true,
        lots: [devLot('l_m016_br1', 1, 300, 61.1, '2026-09-03', '2026-09-08', 'done')],
        confirmRounds: [{ round: 1, sentDate: '2026-09-10', resultDate: '2026-09-15', result: 'pass' }],
        shipDate: '2026-09-29',
      }),
    ],
    dailyNotes: [
      { id: 'n_m016_1', date: '2026-09-17', colorId: 'c_m016_bk', text: '9/17 라인 출고 요청', tone: 'ship' },
      { id: 'n_m016_2', date: '2026-09-18', colorId: 'c_m016_bk', text: '라인 택배 발송', tone: 'ship' },
    ],
    changeLog: [], createdBy: 'dev@grubig.kr', createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z',
  },
  {
    id: 'ord_dev_s055', schemaVersion: 8, orderNumber: 'F-26S055', articleNo: '', detail: 'F/50 SINGLE 이중지 2',
    customer: '그루빅', type: 'sample', finalDueDate: '2026-10-05', lossRate: 10, status: 'active',
    notes: '', linkedFabricId: null, linkedFabricArticle: '', dyeVendor: '킹텍스',
    steps: devSteps({
      knitting: { ...devStep({ vendor: '대성니트', startDate: '2026-09-08', endDate: '2026-09-15', status: 'done', doneDate: '2026-09-15' }), dailyKg: null },
    }),
    colors: [
      devColor('c_s055_1', '', 30, {
        greigeOutDate: '2026-09-16', greigeOutDone: true,
        lots: [devLot('l_s055_1', 1, 300, 33, '2026-09-18', '2026-09-29', 'in_progress')],
      }),
    ],
    dailyNotes: [
      { id: 'n_s055_1', date: '2026-09-16', colorId: 'c_s055_1', text: '킹텍스 생지 전달', tone: 'greige' },
      { id: 'n_s055_2', date: '2026-09-18', colorId: 'c_s055_1', text: '9/18 배색', tone: 'greige' },
    ],
    changeLog: [], createdBy: 'dev@grubig.kr', createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z',
  },
  // v7 옛 형식 (차수 구조) — 자동 변환 확인용. schemaVersion 없음
  {
    id: 'O-LEGACY-01', orderNumber: 'O-LEGACY-01', articleNo: 'GB-2402', customer: '세웅상사', type: 'main',
    startStage: 'knitting', quantityYd: 1000, quantityKg: 0, gsm: 320, widthFull: 44,
    finalDueDate: '2026-10-20', status: 'delayed_risk', notes: '옛 형식 오더 (차수 구조)',
    colors: [{ name: 'NAVY', quantity: 600 }, { name: 'IVORY', quantity: 400 }],
    processes: [
      { id: 'p_k', processType: 'knitting', isActive: true, sequenceOrder: 3, startDate: '2026-09-20', durationDays: 10,
        batches: [
          { id: 'b_k1', batchNumber: 1, status: 'done', plannedStartDate: '2026-09-20', plannedEndDate: '2026-09-25', actualEndDate: '2026-09-25', notes: '1차 편직' },
          { id: 'b_k2', batchNumber: 2, status: 'in_progress', plannedStartDate: '2026-09-26', plannedEndDate: '2026-09-30' },
        ] },
      { id: 'p_d', processType: 'dyeing', isActive: true, sequenceOrder: 4, durationDays: 8,
        batches: [
          { id: 'b_d1', batchNumber: 1, status: 'pending', colors: [
            { color: 'NAVY', quantity: 180, plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-05', brandConfirms: [{ round: 1, sentDate: '', resultDate: '', result: '' }], shippingSample: { sentDate: '', yards: 0 } },
            { color: 'IVORY', quantity: 120, plannedStartDate: '2026-10-03', plannedEndDate: '2026-10-07' },
          ] },
        ] },
    ],
    changeLog: [], createdBy: 'dev@grubig.kr', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z',
  },
];
