// ============================================================
// PI(수출용 Proforma Invoice) / 거래확인서(내수) 상수 & 헬퍼
//  - 그루빅 고정정보(공급자/은행) : 문서마다 바뀌지 않는 값
//  - 거래조건 기본값 : 폼 초기값으로 시드 (편집 가능)
//  - 15개 법률 약관 : 첨부 양식 원문 그대로 (영문/국문)
//  - 금액 → 영문/한글 표기 변환 헬퍼
//  화면 표기는 원본 엑셀(GRUBIG_PI_수출_내수.xlsx) 기준
// ============================================================

// ── 공급자(매도인) 고정정보 ─────────────────────────────────
export const PI_SELLER = {
  export: {
    company: 'GRUBIG TRADING CO., LTD.',
    address: '3211, 126 Beolmal-ro, Dongan-gu, Anyang-si, Gyeonggi-do, Republic of Korea',
    telFax: '+82-31-389-2312 / +82-31-389-2315',
    email: 'info@grubig.kr',
    representative: 'SUNG HWAN, HA',
    bizRegNo: '214-86-78872',
    countryOfOrigin: 'REPUBLIC OF KOREA',
  },
  domestic: {
    company: '(주)그루빅통상',
    address: '경기도 안양시 동안구 벌말로 126, 3211호 (관양동, 평촌 오비즈타워)',
    telFax: '031-389-2312 / 031-389-2315',
    email: 'info@grubig.kr',
    representative: '하성환',
    bizRegNo: '214-86-78872',
    bizType: '도매·소매·제조업 / 무역(수출입), 섬유',
    origin: '대한민국',
  },
};

// ── 은행(수취인) 고정정보 ───────────────────────────────────
export const PI_BANK = {
  export: {
    beneficiary: 'GRUBIG TRADING CO., LTD.',
    beneficiaryAddress: '3211, 126 Beolmal-ro, Dongan-gu, Anyang-si, Gyeonggi-do, Republic of Korea',
    accountNo: '568-008794-56-00017',
    accountCurrency: 'USD',
    bankName: 'INDUSTRIAL BANK OF KOREA (IBK)',
    branch: 'DOKSAN-YEOK BRANCH',
    swift: 'IBKOKRSEXXX',
  },
  domestic: {
    accountHolder: '(주)그루빅통상  (GRUBIG TRADING CO., LTD.)',
    krwAccount: '',                                    // 원화 계좌번호 (미입력 — 발행 전 채움)
    foreignAccount: '568-008794-56-00017   /   SWIFT IBKOKRSEXXX',
    bankBranch: 'IBK기업은행 독산역지점',
    accountType: '보통예금',
  },
};

// ── 거래조건 기본값 (폼 초기 시드값 — 편집 가능) ────────────
export const PI_DEFAULT_TERMS = {
  export: {
    priceTerm: 'FOB BUSAN, KOREA',
    paymentTerms: '',
    leadTime: '70 - 110 days',
    partialShipment: 'ALLOWED',
    transhipment: 'ALLOWED',
    packing: 'ROLL, POLY BAG IN CARTON',
    portLoading: 'BUSAN, KOREA',
    portDischarge: '',
    finalDest: '',
    transport: 'BY SEA',
    hsCode: '6006.10-0000',
    insurance: "For Buyer's account (FOB)",
    notifyCompany: 'SAME AS CONSIGNEE',
  },
  domestic: {
    paymentTerms: '',
    taxInvoice: '납품일 기준 (또는 월 합계)',
    leadTime: '70 ~ 110일',
    deliveryMethod: '직송 / 인수도',
    freightBearer: '매수인 부담',
    moq: '1,000y 이상 (색당 400y)',
    qtyTolerance: '±3% (실납품 수량 기준 청구)',
    vatNote: '별도 (공급가액의 10%)',
    domRemark: '',
    deliverToCompany: '상동',
  },
};

// ── 15개 법률 약관 (수출용 영문) — 양식 원문 그대로 ─────────
export const PI_TERMS_EN = [
  { no: 1,  title: 'ACCEPTANCE', body: "This Proforma Invoice becomes a binding contract upon the Buyer's signature hereon or upon the Seller's receipt of the deposit, whichever is earlier. The terms stated herein shall prevail over any conflicting terms of the Buyer's purchase order unless otherwise agreed by the Seller in writing." },
  { no: 2,  title: 'QUANTITY TOLERANCE', body: 'A tolerance of plus or minus 3% of the ordered quantity shall be accepted as complete delivery. The actual shipped quantity shall be invoiced.' },
  { no: 3,  title: 'INSPECTION & CLAIM PERIOD', body: 'The Buyer shall inspect the goods within 14 days after arrival at the destination port and, in any event, before cutting. Any claim must be submitted in writing together with the roll number, photographs and a 1-yard sample of the fabric concerned. No claim shall be entertained after this period.' },
  { no: 4,  title: 'CUTTING CONSTITUTES ACCEPTANCE', body: "No claim of any kind shall be accepted for fabric that has been cut, sewn, washed, over-dyed, printed, coated or otherwise processed. Cutting of the fabric shall constitute the Buyer's unconditional and final acceptance of quality, shade, hand-feel, width, weight and quantity. This applies equally where the Buyer forwards the fabric to a third-party garment factory; the Buyer remains solely responsible for inspecting the fabric before it is delivered to such factory and before cutting." },
  { no: 5,  title: 'SHADE VARIATION & CUTTING METHOD', body: "Bulk production may vary from the approved lab-dip and may vary between dye lots within a commercially acceptable tolerance. The Buyer shall cut lot by lot, and all panels forming a single garment shall be cut from adjacent positions within the same dye lot (nearest-marker cutting). Shade variation arising from the Buyer's failure to observe this shall not constitute grounds for any claim." },
  { no: 6,  title: 'INHERENT CHARACTERISTICS OF KNITTED WOOL FABRIC', body: "Dimensional change, torque and skew, relaxation shrinkage, pilling, slight barre, hairiness and natural fibre irregularity are inherent characteristics of knitted wool fabric. Where such characteristics fall within the tolerances stated on the Seller's specification sheet, they shall not constitute grounds for any claim." },
  { no: 7,  title: 'TEST REPORTS', body: 'Test results supplied by the Seller apply only to the lot tested. The Buyer is solely responsible for the compliance, labelling, care instruction and end-use suitability of the finished garment in the country of destination.' },
  { no: 8,  title: 'LIMITATION OF LIABILITY', body: "The Seller's total liability, whatever the cause, shall in no event exceed the invoice value of the fabric concerned. The Seller shall not be liable for any indirect, incidental or consequential loss, including without limitation loss of profit, garment making cost, air freight, retailer chargeback, markdown or penalty." },
  { no: 9,  title: 'LEAD TIME', body: "Lead time is counted from the later of (i) the Seller's receipt of the deposit and (ii) the Buyer's written approval of the lab-dip or strike-off. Any delay by the Buyer in approval, shipping instruction or payment shall extend the delivery date accordingly." },
  { no: 10, title: 'CANCELLATION', body: 'Once yarn has been purchased or knitting or dyeing has commenced, the order may not be cancelled or reduced and the deposit shall be non-refundable.' },
  { no: 11, title: 'PRICE VALIDITY', body: 'Prices are based on the wool yarn price and the exchange rate prevailing on the date of this Proforma Invoice and are valid until the Valid Until date stated above. Thereafter prices are subject to reconfirmation by the Seller.' },
  { no: 12, title: 'TITLE & RISK', body: 'Title to the goods shall remain with the Seller until payment has been received in full. Risk shall pass to the Buyer in accordance with the agreed Incoterms 2020 rule.' },
  { no: 13, title: 'PAYMENT', body: 'All bank charges incurred outside Korea are for the Buyer\'s account. Overdue amounts shall bear interest at 1.5% per month. The Seller may suspend production or shipment while any payment remains overdue.' },
  { no: 14, title: 'FORCE MAJEURE', body: 'The Seller shall not be liable for delay or non-performance caused by events beyond its reasonable control, including raw material shortage, stoppage at knitting or dyeing subcontractors, energy restriction, epidemic, labour dispute or transport disruption.' },
  { no: 15, title: 'GOVERNING LAW & DISPUTE', body: 'This contract shall be governed by the laws of the Republic of Korea. Any dispute arising hereunder shall be finally settled by arbitration at the Korean Commercial Arbitration Board in Seoul, in the English language.' },
];

// ── 15개 법률 약관 (내수용 국문) — 양식 원문 그대로 ─────────
export const PI_TERMS_KR = [
  { no: 1,  title: '계약의 성립', body: '본 거래확인서는 매수인의 서명 또는 매도인의 계약금 수령 중 먼저 도래하는 시점에 계약으로서 효력이 발생합니다. 본 조건은 매수인의 발주서(PO) 조건과 상충하는 경우 우선하며, 이와 달리 정하려면 매도인의 서면 동의가 있어야 합니다.' },
  { no: 2,  title: '수량 허용오차', body: '발주 수량의 ±3% 범위 내 납품은 완전 이행으로 간주하며, 실제 납품 수량 기준으로 청구합니다.' },
  { no: 3,  title: '검품 및 클레임 기한', body: '매수인은 원단 인수 후 14일 이내, 그리고 어떠한 경우에도 재단 이전에 검품하여야 합니다. 클레임은 롤 번호, 사진, 해당 원단 1야드 실물을 첨부하여 서면으로 제기하여야 하며, 기한 경과 후의 클레임은 접수하지 않습니다.' },
  { no: 4,  title: '재단 후 면책 (중요)', body: '재단, 봉제, 세탁, 후염, 프린트, 코팅 등 어떠한 가공이 이루어진 원단에 대하여는 일체의 클레임을 인정하지 않습니다. 원단의 재단은 품질, 색상, 촉감, 폭, 중량, 수량에 대한 매수인의 무조건적이고 최종적인 인수로 간주합니다. 매수인이 원단을 국내외 봉제처 등 제3자에게 전달하는 경우에도 동일하게 적용되며, 제3자에게 인도하기 전 및 재단 전 검품 책임은 전적으로 매수인에게 있습니다.' },
  { no: 5,  title: '컬러 편차 및 재단 방법 (중요)', body: '벌크 생산품은 승인된 랩딥 및 염색 로트 간에 상업적으로 허용되는 범위 내에서 색차가 발생할 수 있습니다. 매수인은 염색 로트별로 재단하여야 하며, 한 벌을 구성하는 각 파트는 동일 로트 내 인접한 위치에서 재단(근접 마카)하여야 합니다. 이를 준수하지 않아 발생한 색차에 대하여는 일체의 클레임을 인정하지 않습니다.' },
  { no: 6,  title: '울 니트 원단의 고유 특성', body: '치수 변화, 토크 및 사행, 이완 수축, 필링, 경미한 바레, 잔털, 천연섬유 고유의 불균일은 울 니트 원단의 고유 특성입니다. 매도인이 제시한 스펙시트상의 허용치 이내인 경우 클레임 사유가 되지 않습니다.' },
  { no: 7,  title: '시험성적서', body: '매도인이 제공하는 시험 결과는 해당 시험 로트에 한하여 적용됩니다. 최종 의류의 규제 적합성, 라벨 표기, 취급 표시 및 용도 적합성에 대한 책임은 전적으로 매수인에게 있으며, 해외 봉제 후 수출되는 경우 수입국 규제 대응 역시 매수인의 책임입니다.' },
  { no: 8,  title: '책임의 한도 (중요)', body: '원인을 불문하고 매도인의 총 배상책임은 해당 원단의 공급가액을 초과하지 않습니다. 매도인은 일실이익, 봉제 임가공비, 항공운임, 리테일러 차지백, 마크다운, 위약금 등 간접·부수적·결과적 손해에 대하여 책임을 지지 않습니다.' },
  { no: 9,  title: '납기 기산', body: '납기는 (i) 계약금 입금일과 (ii) 매수인의 랩딥/스트라이크오프 서면 승인일 중 나중에 도래하는 날로부터 기산합니다. 매수인의 승인, 납품 지시, 결제 지연이 있는 경우 납기는 그만큼 연장됩니다.' },
  { no: 10, title: '주문 취소', body: '원사 구매 또는 편직·염색이 착수된 이후에는 주문의 취소 및 수량 감축이 불가하며, 계약금은 반환되지 않습니다.' },
  { no: 11, title: '가격 유효기간', body: '본 견적 가격은 발행일 기준 울 원사 가격을 기초로 산정되었으며 부가가치세는 별도입니다. 상기 유효기한까지 유효하며, 그 이후에는 매도인의 재확인이 필요합니다.' },
  { no: 12, title: '소유권 유보', body: '물품의 소유권은 대금이 전액 지급될 때까지 매도인에게 유보됩니다. 매수인은 대금 완납 전에는 원단을 제3자에게 담보로 제공하거나 처분할 수 없습니다.' },
  { no: 13, title: '결제 및 세금계산서', body: '부가가치세는 별도이며 세금계산서는 납품일(또는 월 합계) 기준으로 발행합니다. 연체 금액에 대하여는 월 1.5%의 지연이자가 부과되며, 미결제 금액이 있는 동안 매도인은 생산 또는 납품을 중단할 수 있습니다.' },
  { no: 14, title: '불가항력', body: '원사 수급 차질, 편직·염색 임가공처의 조업 중단, 에너지 사용 제한, 감염병, 노사분규, 운송 장애 등 매도인의 합리적 통제를 벗어난 사유로 인한 지연 또는 불이행에 대하여 매도인은 책임을 지지 않습니다.' },
  { no: 15, title: '준거법 및 관할', body: '본 계약은 대한민국 법을 준거법으로 하며, 본 계약과 관련한 분쟁의 제1심 관할법원은 수원지방법원 안양지원으로 합니다.' },
];

export const PI_UNIT_OPTIONS = ['YDS', 'M', 'KG', 'PCS', 'ROLL'];

// ============================================================
// 금액 → 문자 표기 변환 (SAY TOTAL / 일금)
// ============================================================

const EN_ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const EN_TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

const enThree = (n) => {
  let s = '';
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) { s += EN_ONES[h] + ' HUNDRED'; if (r) s += ' '; }
  if (r) {
    if (r < 20) s += EN_ONES[r];
    else { s += EN_TENS[Math.floor(r / 10)]; if (r % 10) s += '-' + EN_ONES[r % 10]; }
  }
  return s;
};

// 정수 → 영문 (예: 1234 → ONE THOUSAND TWO HUNDRED THIRTY-FOUR)
export const numberToEnglishWords = (num) => {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'ZERO';
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION', 'TRILLION'];
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) parts.push(enThree(groups[i]) + (scales[i] ? ' ' + scales[i] : ''));
  }
  return parts.join(' ');
};

const KO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const KO_SMALL = ['', '십', '백', '천'];
const KO_BIG = ['', '만', '억', '조', '경'];

// 4자리 이하 한글 (예: 1234 → 일천이백삼십사, 15 → 십오)
const koFourDigit = (n) => {
  let s = '';
  for (let i = 3; i >= 0; i--) {
    const d = Math.floor(n / Math.pow(10, i)) % 10;
    if (d) {
      // 십의 자리에서 '1'은 '일' 생략 (십오 O / 일십오 X), 백·천은 유지(일백/일천)
      s += (d === 1 && i === 1) ? '' : KO_DIGITS[d];
      s += KO_SMALL[i];
    }
  }
  return s;
};

// 정수 → 한글 (예: 7260000 → 칠백이십육만)
export const numberToKoreanWords = (num) => {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return '영';
  const groups = [];
  while (n > 0) { groups.push(n % 10000); n = Math.floor(n / 10000); }
  let s = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) s += koFourDigit(groups[i]) + KO_BIG[i];
  }
  return s;
};

// 수출용 금액 문자표기: US DOLLARS ... ONLY (센트는 AND XX/100)
export const sayTotalUSD = (amount) => {
  const val = Math.max(0, Number(amount) || 0);   // 인보이스 금액은 음수 없음(방어)
  let int = Math.floor(val);
  let cents = Math.round((val - int) * 100);
  if (cents >= 100) { int += Math.floor(cents / 100); cents = cents % 100; } // 반올림으로 100센트 → 1달러 올림
  const words = numberToEnglishWords(int);
  const centPart = cents > 0 ? ` AND ${String(cents).padStart(2, '0')}/100` : '';
  return `US DOLLARS ${words}${centPart} ONLY`;
};

// 내수용 금액 문자표기: 일금 ... 원정
export const sayTotalKRW = (amount) => `일금 ${numberToKoreanWords(Math.max(0, Number(amount) || 0))}원정`;

// ── 품목 Description 자동생성 (Item Name · 폭 · 중량만 — 혼용률/조직 제외) ──
//  요구사항: '사양'칸은 품명(Item Name)과 폭/중량만 가져온다.
export const buildPIDescription = (fabric, isExport) => {
  if (!fabric) return '';
  const full = Number(fabric.widthFull) || 0;
  const cut = Number(fabric.widthCut) || 0;
  const width = full
    ? (isExport
        ? `${full}"${cut ? ` (cuttable ${cut}")` : ''}`
        : `${full}"${cut ? `(재단폭 ${cut}")` : ''}`)
    : '';
  const parts = [
    fabric.itemName || '',
    width,
    fabric.gsm ? `${fabric.gsm} g/m²` : '',
  ].filter(p => String(p).trim() !== '');
  return parts.join(', ');
};

// ============================================================
// PI 설정(은행정보 + 약관) — settings/general.piSettings 에 저장
//  · 저장값이 없으면 위의 상수(PI_BANK, PI_TERMS_EN/KR)를 기본값으로 사용
//  · 약관은 {title, body} 배열로 저장 (번호는 렌더 시 자동 부여)
// ============================================================

// 상수 약관({no,title,body})을 편집용({title,body})으로 변환
export const defaultPITerms = (isExport) =>
  (isExport ? PI_TERMS_EN : PI_TERMS_KR).map(t => ({ title: t.title, body: t.body }));

// 저장된 설정 + 기본값 병합 → 화면/PDF/모달이 사용할 유효 설정 반환
export const getEffectivePISettings = (piSettings) => {
  const s = piSettings || {};
  const exp = s.export || {};
  const dom = s.domestic || {};
  return {
    export: {
      bank: { ...PI_BANK.export, ...(exp.bank || {}) },
      terms: (Array.isArray(exp.terms) && exp.terms.length) ? exp.terms : defaultPITerms(true),
    },
    domestic: {
      bank: { ...PI_BANK.domestic, ...(dom.bank || {}) },
      terms: (Array.isArray(dom.terms) && dom.terms.length) ? dom.terms : defaultPITerms(false),
    },
  };
};

// 은행정보 편집 필드 정의 (모달이 이 정의로 입력칸을 렌더)
export const PI_BANK_FIELDS = {
  export: [
    { key: 'beneficiary', label: 'Beneficiary (수취인)' },
    { key: 'beneficiaryAddress', label: 'Beneficiary Address' },
    { key: 'accountNo', label: 'Account No. (USD 계좌)' },
    { key: 'accountCurrency', label: 'Account Currency' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'swift', label: 'SWIFT Code' },
  ],
  domestic: [
    { key: 'accountHolder', label: '예금주' },
    { key: 'krwAccount', label: '원화 계좌번호' },
    { key: 'bankBranch', label: '은행명 / 지점' },
    { key: 'accountType', label: '예금 종류' },
  ],
};
