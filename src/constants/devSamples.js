// GRUBIG ERP - [DEV 검증 전용] 인메모리 샘플 데이터
//  - App.jsx의 DEV_BYPASS(=import.meta.env.DEV + localStorage 플래그)일 때만 사용됨
//  - 프로덕션 빌드(vite build)에서는 import.meta.env.DEV===false 라 참조 분기가 죽은 코드로 제거됨
//  - 실제 Firestore 데이터와 무관한 가짜 데이터입니다.

export const DEV_SAMPLE_YARNS = [
  { id: 'y_dev_1', category: '소모',    name: '2/48 WOOL', remarks: '', suppliers: [{ id: 's_dev_1', name: 'XINAO',  currency: 'KRW', price: 18000, tariff: 8, freight: 2, isDefault: true, history: [] }] },
  { id: 'y_dev_2', category: '면방',    name: 'CM 30S',    remarks: '', suppliers: [{ id: 's_dev_2', name: '대원',    currency: 'KRW', price: 9000,  tariff: 0, freight: 0, isDefault: true, history: [] }] },
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
