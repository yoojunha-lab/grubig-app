import React from 'react';
import { createPortal } from 'react-dom';
import {
  PI_SELLER, PI_BANK, PI_TERMS_EN, PI_TERMS_KR,
  sayTotalUSD, sayTotalKRW,
} from '../../constants/proformaInvoice';

// ============================================================
// PI(수출) / 거래확인서(내수) 인쇄용 문서 (A4)
//  - body 직속 포털 + class "pi-print-root" (평소 화면 밖, 인쇄 시 body.printing-pi 일 때만 노출)
//  - marketType 에 따라 영문 PI / 국문 거래확인서 레이아웃 자동 전환
//  - 합계·부가세·금액문자표기는 여기서 계산 (화면 폼과 동일 로직)
// ============================================================

// 통화별 금액 포맷 (USD 소수 2자리 / KRW 정수)
const fmtMoney = (v, currency) => {
  const n = Number(v) || 0;
  if (currency === 'USD') return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
};

// 합계 계산 (화면/인쇄 공용) — App 에서도 import 해 화면 미리보기에 사용
export const computePITotals = (pi) => {
  const items = pi.items || [];
  const subtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const freight = Number(pi.freightAmt) || 0;
  const insurance = Number(pi.insuranceAmt) || 0;
  const discount = Number(pi.discountAmt) || 0;
  if (pi.marketType === 'domestic') {
    const supply = subtotal + freight - discount;       // 공급가액(+운반비-할인)
    const vat = Math.round(supply * 0.1);
    const total = supply + vat;
    return { subtotal, freight, insurance: 0, discount, vat, total };
  }
  const total = subtotal + freight + insurance - discount;
  return { subtotal, freight, insurance, discount, vat: 0, total };
};

// 작은 셀 컴포넌트: 라벨 + 값 (엑셀의 병합셀 박스형 미러)
const Cell = ({ label, value, className = '' }) => (
  <div className={`flex border-b border-slate-300 ${className}`}>
    <div className="w-[38%] shrink-0 bg-slate-50 px-2 py-[5px] text-[9px] font-bold text-slate-500 uppercase tracking-wide border-r border-slate-300 flex items-center">
      {label}
    </div>
    <div className="flex-1 px-2 py-[5px] text-[10.5px] text-slate-800 font-medium flex items-center break-words min-w-0">
      {value || ' '}
    </div>
  </div>
);

// 섹션 타이틀 띠
const SectionBar = ({ children }) => (
  <div className="bg-slate-800 text-white text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-[6px] mt-3">
    {children}
  </div>
);

export const PIPrintSheet = ({ pi }) => {
  if (!pi) return null;
  const isExport = pi.marketType !== 'domestic';
  const currency = isExport ? 'USD' : 'KRW';
  const seller = isExport ? PI_SELLER.export : PI_SELLER.domestic;
  const bank = isExport ? PI_BANK.export : PI_BANK.domestic;
  const terms = isExport ? PI_TERMS_EN : PI_TERMS_KR;
  const items = pi.items || [];
  const T = computePITotals(pi);

  const money = (v) => fmtMoney(v, currency);
  const symbol = isExport ? '$' : '₩';

  return createPortal(
    <div
      className="pi-print-root"
      style={{
        position: 'fixed', top: 0, left: '-99999px', width: '794px',
        margin: 0, padding: 0, backgroundColor: '#ffffff', zIndex: 9996,
        textAlign: 'left', boxSizing: 'border-box',
      }}
    >
      <div className="pdf-render-inner" style={{ width: '794px', margin: 0, padding: 0, backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
        <div className="px-7 py-6 text-slate-800">

          {/* ─── 헤더: 로고 + 제목 + 문서번호/날짜 ─── */}
          <div className="avoid-break flex items-end justify-between border-b-[3px] border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GRUBIG" className="h-[46px] object-contain" onError={(e) => (e.target.style.display = 'none')} />
              <div>
                <div className="text-[15px] font-extrabold tracking-tight text-slate-900 leading-none">{seller.company}</div>
                <div className="text-[9px] text-slate-500 mt-1 leading-tight">{seller.address}</div>
              </div>
            </div>
            <div className="text-right shrink-0 pl-4">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-none">
                {isExport ? 'PROFORMA INVOICE' : '거래확인서'}
              </h1>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-1">
                {isExport ? 'International Sale of Fabric' : '주문확인 겸 견적서'}
              </div>
            </div>
          </div>

          {/* ─── 공급자 + 발행정보 ─── */}
          <div className="grid grid-cols-2 gap-4 mt-3">
            {/* 좌: 공급자 */}
            <div className="border border-slate-300">
              <div className="bg-slate-100 px-2 py-[5px] text-[9px] font-extrabold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                {isExport ? 'Exporter (Seller)' : '공급자 (매도인)'}
              </div>
              <Cell label={isExport ? 'Company' : '상호'} value={seller.company} />
              <Cell label={isExport ? 'Address' : '주소'} value={seller.address} />
              <Cell label={isExport ? 'Tel / Fax' : '전화 / 팩스'} value={seller.telFax} />
              <Cell label={isExport ? 'E-mail' : '이메일'} value={seller.email} />
              <Cell label={isExport ? 'Representative' : '대표자'} value={seller.representative} />
              <Cell label={isExport ? 'Business Reg. No.' : '사업자등록번호'} value={seller.bizRegNo} className="border-b-0" />
            </div>
            {/* 우: 발행정보 */}
            <div className="border border-slate-300">
              <div className="bg-slate-100 px-2 py-[5px] text-[9px] font-extrabold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                {isExport ? 'Invoice Details' : '발행 정보'}
              </div>
              <Cell label={isExport ? 'P/I No.' : '문서번호'} value={<span className="font-bold text-slate-900">{pi.piNo}</span>} />
              <Cell label={isExport ? 'Date' : '발행일'} value={pi.date} />
              <Cell label={isExport ? 'Valid Until' : '유효기한'} value={pi.validUntil} />
              <Cell label={isExport ? "Buyer's PO No." : '매수인 발주번호'} value={pi.buyerPoNo} />
              <Cell label={isExport ? 'Currency' : '결제 통화'} value={isExport ? 'USD' : 'KRW (원)'} />
              <Cell
                label={isExport ? 'Country of Origin' : '업태 / 종목'}
                value={isExport ? seller.countryOfOrigin : seller.bizType}
                className="border-b-0"
              />
            </div>
          </div>

          {/* ─── 매수인 + 통지처/납품처 ─── */}
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="border border-slate-300">
              <div className="bg-slate-100 px-2 py-[5px] text-[9px] font-extrabold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                {isExport ? 'Buyer (Consignee)' : '공급받는 자 (매수인)'}
              </div>
              <Cell label={isExport ? 'Company' : '상호'} value={<span className="font-bold text-slate-900">{pi.buyerCompany}</span>} />
              {!isExport && <Cell label="사업자등록번호" value={pi.buyerBizNo} />}
              <Cell label={isExport ? 'Address' : '주소'} value={pi.buyerAddress} />
              <Cell label={isExport ? 'Tel' : '전화'} value={pi.buyerTel} />
              <Cell label={isExport ? 'Contact / E-mail' : '담당자 / 연락처'} value={pi.buyerContact} className="border-b-0" />
            </div>
            <div className="border border-slate-300">
              <div className="bg-slate-100 px-2 py-[5px] text-[9px] font-extrabold text-slate-600 uppercase tracking-wide border-b border-slate-300">
                {isExport ? 'Notify Party' : '납품처 (실제 입고지)'}
              </div>
              <Cell label={isExport ? 'Company' : '상호 / 현장명'} value={pi.notifyCompany} />
              <Cell label={isExport ? 'Address' : '주소'} value={pi.notifyAddress} />
              <Cell label={isExport ? 'Tel' : '전화'} value={pi.notifyTel} />
              <Cell label={isExport ? 'Contact / E-mail' : '담당자 / 연락처'} value={pi.notifyContact} className="border-b-0" />
            </div>
          </div>

          {/* ─── 거래 조건 ─── */}
          <SectionBar>{isExport ? 'Shipping & Payment Terms' : '거래 조건'}</SectionBar>
          <div className="grid grid-cols-2 gap-x-4 border border-slate-300 border-t-0">
            {isExport ? (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="Price Term (Incoterms 2020)" value={pi.priceTerm} />
                  <Cell label="Payment Terms" value={pi.paymentTerms} />
                  <Cell label="Shipment / Lead Time" value={pi.leadTime} />
                  <Cell label="Partial Shipment" value={pi.partialShipment} />
                  <Cell label="Transhipment" value={pi.transhipment} />
                  <Cell label="Packing" value={pi.packing} className="border-b-0" />
                </div>
                <div>
                  <Cell label="Port of Loading" value={pi.portLoading} />
                  <Cell label="Port of Discharge" value={pi.portDischarge} />
                  <Cell label="Final Destination" value={pi.finalDest} />
                  <Cell label="Mode of Transport" value={pi.transport} />
                  <Cell label="HS Code" value={pi.hsCode} />
                  <Cell label="Insurance" value={pi.insurance} className="border-b-0" />
                </div>
              </>
            ) : (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="결제조건" value={pi.paymentTerms} />
                  <Cell label="납기 / 리드타임" value={pi.leadTime} />
                  <Cell label="운반비 부담" value={pi.freightBearer} />
                  <Cell label="수량 허용오차" value={pi.qtyTolerance} className="border-b-0" />
                </div>
                <div>
                  <Cell label="세금계산서 발행" value={pi.taxInvoice} />
                  <Cell label="납품 방법" value={pi.deliveryMethod} />
                  <Cell label="최소 발주 수량" value={pi.moq} />
                  <Cell label="부가가치세" value={pi.vatNote} className="border-b-0" />
                </div>
              </>
            )}
          </div>

          {/* ─── 품목표 ─── */}
          <table className="w-full mt-3 border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '37%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-[6px] px-1 font-bold text-center border border-slate-800">No.</th>
                <th className="py-[6px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Item / Quality No.' : '품번'}</th>
                <th className="py-[6px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Description (Composition · Weight · Width)' : '품명 · 사양 (혼용률 · 조직 · 중량 · 폭)'}</th>
                <th className="py-[6px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Color / Color No.' : '컬러 / 컬러번호'}</th>
                <th className="py-[6px] px-1 font-bold text-right border border-slate-800">{isExport ? 'Qty' : '수량'}</th>
                <th className="py-[6px] px-1 font-bold text-center border border-slate-800">{isExport ? 'Unit' : '단위'}</th>
                <th className="py-[6px] px-1.5 font-bold text-right border border-slate-800">{isExport ? 'Unit Price' : '단가'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="avoid-break align-top">
                  <td className="py-[6px] px-1 text-center border border-slate-300 text-slate-500">{idx + 1}</td>
                  <td className="py-[6px] px-1.5 border border-slate-300 font-bold text-slate-900 break-words">{it.article}</td>
                  <td className="py-[6px] px-1.5 border border-slate-300 text-slate-700 break-words leading-snug">{it.description}</td>
                  <td className="py-[6px] px-1.5 border border-slate-300 text-slate-700 break-words">{it.color}</td>
                  <td className="py-[6px] px-1 border border-slate-300 text-right font-mono text-slate-800">{it.qty ? Number(it.qty).toLocaleString() : ''}</td>
                  <td className="py-[6px] px-1 border border-slate-300 text-center text-slate-600">{it.unit}</td>
                  <td className="py-[6px] px-1.5 border border-slate-300 text-right font-mono text-slate-800">{it.unitPrice !== '' ? `${symbol}${money(it.unitPrice)}` : ''}</td>
                </tr>
              ))}
              {/* 빈 줄 채움 (양식 안정감) — 품목 4개 미만이면 채움 */}
              {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                <tr key={`pad_${i}`} className="avoid-break">
                  <td className="py-[6px] px-1 border border-slate-300">&nbsp;</td>
                  <td className="border border-slate-300"></td>
                  <td className="border border-slate-300"></td>
                  <td className="border border-slate-300"></td>
                  <td className="border border-slate-300"></td>
                  <td className="border border-slate-300"></td>
                  <td className="border border-slate-300"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ─── 합계 (우측 정렬 블록) ─── */}
          <div className="flex justify-end mt-2 avoid-break">
            <table className="border-collapse text-[10.5px]" style={{ width: '55%' }}>
              <tbody>
                <tr>
                  <td className="py-[5px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'SUB TOTAL' : '공급가액'}</td>
                  <td className="py-[5px] px-3 border border-slate-300 text-right font-mono w-[45%]">{symbol}{money(T.subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-[5px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'FREIGHT' : '운   반   비'}</td>
                  <td className="py-[5px] px-3 border border-slate-300 text-right font-mono">{T.freight ? `${symbol}${money(T.freight)}` : '-'}</td>
                </tr>
                {isExport && (
                  <tr>
                    <td className="py-[5px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">INSURANCE</td>
                    <td className="py-[5px] px-3 border border-slate-300 text-right font-mono">{T.insurance ? `${symbol}${money(T.insurance)}` : '-'}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-[5px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'DISCOUNT / OTHERS (-)' : '할인 / 기타 (-)'}</td>
                  <td className="py-[5px] px-3 border border-slate-300 text-right font-mono">{T.discount ? `- ${symbol}${money(T.discount)}` : '-'}</td>
                </tr>
                {!isExport && (
                  <tr>
                    <td className="py-[5px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">부가가치세 (10%)</td>
                    <td className="py-[5px] px-3 border border-slate-300 text-right font-mono">{symbol}{money(T.vat)}</td>
                  </tr>
                )}
                <tr className="bg-slate-800 text-white">
                  <td className="py-[7px] px-3 border border-slate-800 font-extrabold text-right">{isExport ? 'TOTAL AMOUNT' : '합  계  금  액'}</td>
                  <td className="py-[7px] px-3 border border-slate-800 text-right font-mono font-extrabold text-[12px]">{symbol}{money(T.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── 금액 문자표기 ─── */}
          <div className="mt-2 border border-slate-300 bg-slate-50 px-3 py-[6px] text-[10.5px] avoid-break">
            <span className="font-bold text-slate-500 mr-2">{isExport ? 'SAY TOTAL' : '일금(한글)'}</span>
            <span className="font-bold text-slate-900">
              {isExport ? sayTotalUSD(T.total) : `${sayTotalKRW(T.total)}  (부가세 포함)`}
            </span>
          </div>

          {/* ─── 은행정보 ─── */}
          <SectionBar>{isExport ? 'Bank Details (Beneficiary)' : '입금 계좌'}</SectionBar>
          <div className="grid grid-cols-2 gap-x-4 border border-slate-300 border-t-0">
            {isExport ? (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="Beneficiary" value={bank.beneficiary} />
                  <Cell label="Beneficiary Address" value={bank.beneficiaryAddress} />
                  <Cell label="Account No." value={bank.accountNo} />
                  <Cell label="Account Currency" value={bank.accountCurrency} className="border-b-0" />
                </div>
                <div>
                  <Cell label="Bank Name" value={bank.bankName} />
                  <Cell label="Branch" value={bank.branch} />
                  <Cell label="SWIFT Code" value={bank.swift} className="border-b-0" />
                </div>
              </>
            ) : (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="예금주" value={bank.accountHolder} />
                  <Cell label="원화 계좌번호" value={pi.krwAccount} />
                  <Cell label="외화 계좌 (해외 송금)" value={bank.foreignAccount} className="border-b-0" />
                </div>
                <div>
                  <Cell label="은행명 / 지점" value={bank.bankBranch} />
                  <Cell label="예금 종류" value={bank.accountType} className="border-b-0" />
                </div>
              </>
            )}
          </div>

          {/* ─── 약관 ─── */}
          <SectionBar>{isExport ? 'Terms & Conditions' : '거래 조건 및 면책 사항'}</SectionBar>
          <div className="border border-slate-300 border-t-0 px-3 py-2">
            <ol className="space-y-[3px]">
              {terms.map(t => (
                <li key={t.no} className="text-[8px] text-slate-600 leading-[1.35] break-words">
                  <span className="font-bold text-slate-800">{t.no}. {t.title} — </span>{t.body}
                </li>
              ))}
            </ol>
          </div>

          {/* ─── 서명란 ─── */}
          <div className="grid grid-cols-2 gap-4 mt-4 avoid-break">
            <div className="border border-slate-300 p-3">
              <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wide mb-6">
                {isExport ? 'Confirmed & Accepted by (Buyer)' : '매수인 확인 (공급받는 자)'}
              </div>
              <div className="text-[9px] text-slate-500 border-t border-slate-300 pt-2">
                {isExport ? 'Signature / Company Stamp' : '서명 / 인'} &nbsp; ______________________ &nbsp;&nbsp; {isExport ? 'Date' : '일자'} : __________
              </div>
            </div>
            <div className="border border-slate-300 p-3">
              <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wide mb-6">
                {isExport ? `For and on behalf of (Seller)` : `공급자  ${seller.company}`}
              </div>
              <div className="text-[9px] text-slate-500 border-t border-slate-300 pt-2">
                {isExport ? 'Signature / Company Stamp' : '서명 / 인'} &nbsp; ______________________ &nbsp;&nbsp; {isExport ? 'Date' : '일자'} : __________
              </div>
            </div>
          </div>

          {/* ─── 푸터 ─── */}
          <div className="text-center text-[8px] text-slate-400 mt-3 pt-2 border-t border-slate-200">
            {isExport
              ? `Issued by ${seller.company} — valid only with the company stamp and authorized signature.`
              : `본 거래확인서는 ${seller.company}이 발행하며, 회사 직인과 서명이 있는 경우에 한하여 유효합니다.`}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
