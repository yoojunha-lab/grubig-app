import React from 'react';
import { createPortal } from 'react-dom';
import {
  PI_SELLER,
  sayTotalUSD, sayTotalKRW, getEffectivePISettings,
} from '../../constants/proformaInvoice';

// ============================================================
// PI(수출) / 거래확인서(내수) 인쇄용 문서 (A4)
//  - body 직속 포털 + class "pi-print-root" (평소 화면 밖, 인쇄 시 body.printing-pi 일 때만 노출)
//  - marketType 에 따라 영문 PI / 국문 거래확인서 레이아웃 자동 전환
//  - 은행정보/약관은 설정(piSettings)에서 읽음 (없으면 상수 기본값)
//  - [컴팩트] 여백·폰트·행높이 축소 → 핵심 인보이스(품목·합계·은행)까지 1페이지 목표
// ============================================================

// 통화별 금액 포맷 (USD 소수 2자리 / KRW 정수)
const fmtMoney = (v, currency) => {
  const n = Number(v) || 0;
  if (currency === 'USD') return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
};

// 합계 계산 (화면/인쇄 공용) — App/화면 미리보기에서도 import (컴포넌트 외 공용 함수)
// eslint-disable-next-line react-refresh/only-export-components
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

// 작은 셀 컴포넌트: 라벨 + 값 (엑셀의 병합셀 박스형 미러) — 컴팩트
const Cell = ({ label, value, className = '' }) => (
  <div className={`flex border-b border-slate-300 ${className}`}>
    <div className="w-[34%] shrink-0 bg-slate-50 px-2 py-[3px] text-[8px] font-bold text-slate-500 uppercase tracking-wide border-r border-slate-300 flex items-center">
      {label}
    </div>
    <div className="flex-1 px-2 py-[3px] text-[9.5px] text-slate-800 font-medium flex items-center break-words min-w-0">
      {value || ' '}
    </div>
  </div>
);

// 섹션 타이틀 띠 — 컴팩트
const SectionBar = ({ children }) => (
  <div className="bg-slate-800 text-white text-[9px] font-bold uppercase tracking-[0.12em] px-3 py-[4px] mt-2">
    {children}
  </div>
);

// 박스 헤더 라벨 (공급자/매수인 등)
const BoxHead = ({ children }) => (
  <div className="bg-slate-100 px-2 py-[3px] text-[8px] font-extrabold text-slate-600 uppercase tracking-wide border-b border-slate-300">
    {children}
  </div>
);

export const PIPrintSheet = ({ pi, piSettings }) => {
  if (!pi) return null;
  const isExport = pi.marketType !== 'domestic';
  const currency = isExport ? 'USD' : 'KRW';
  const seller = isExport ? PI_SELLER.export : PI_SELLER.domestic;
  const eff = getEffectivePISettings(piSettings);
  const bank = isExport ? eff.export.bank : eff.domestic.bank;
  const terms = isExport ? eff.export.terms : eff.domestic.terms;
  const items = pi.items || [];
  const T = computePITotals(pi);

  const money = (v) => fmtMoney(v, currency);
  const symbol = isExport ? '$' : '₩';

  // 내수 원화계좌: 설정값 우선, 없으면 구(舊) 문서의 per-document 값 폴백
  const krwAccountValue = (bank.krwAccount && String(bank.krwAccount).trim()) ? bank.krwAccount : (pi.krwAccount || '');

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
        <div className="px-6 py-4 text-slate-800">

          {/* ─── 헤더: 로고 + 제목 + 문서번호/날짜 ─── */}
          <div className="avoid-break flex items-end justify-between border-b-[3px] border-slate-800 pb-2 mb-0">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="GRUBIG" className="h-[40px] object-contain" onError={(e) => (e.target.style.display = 'none')} />
              <div>
                <div className="text-[13px] font-extrabold tracking-tight text-slate-900 leading-none">{seller.company}</div>
                <div className="text-[8px] text-slate-500 mt-0.5 leading-tight">{seller.address}</div>
              </div>
            </div>
            <div className="text-right shrink-0 pl-4">
              <h1 className="text-[19px] font-extrabold tracking-tight text-slate-900 leading-none">
                {isExport ? 'PROFORMA INVOICE' : '거래확인서'}
              </h1>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-0.5">
                {isExport ? 'International Sale of Fabric' : '주문확인 겸 견적서'}
              </div>
            </div>
          </div>

          {/* ─── 공급자 + 발행정보 ─── */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="border border-slate-300">
              <BoxHead>{isExport ? 'Exporter (Seller)' : '공급자 (매도인)'}</BoxHead>
              <Cell label={isExport ? 'Company' : '상호'} value={seller.company} />
              <Cell label={isExport ? 'Address' : '주소'} value={seller.address} />
              <Cell label={isExport ? 'Tel / Fax' : '전화 / 팩스'} value={seller.telFax} />
              <Cell label={isExport ? 'E-mail' : '이메일'} value={seller.email} />
              <Cell label={isExport ? 'Representative' : '대표자'} value={seller.representative} />
              <Cell label={isExport ? 'Business Reg. No.' : '사업자등록번호'} value={seller.bizRegNo} className="border-b-0" />
            </div>
            <div className="border border-slate-300">
              <BoxHead>{isExport ? 'Invoice Details' : '발행 정보'}</BoxHead>
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
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="border border-slate-300">
              <BoxHead>{isExport ? 'Buyer (Consignee)' : '공급받는 자 (매수인)'}</BoxHead>
              <Cell label={isExport ? 'Company' : '상호'} value={<span className="font-bold text-slate-900">{pi.buyerCompany}</span>} />
              {!isExport && <Cell label="사업자등록번호" value={pi.buyerBizNo} />}
              <Cell label={isExport ? 'Address' : '주소'} value={pi.buyerAddress} />
              <Cell label={isExport ? 'Tel' : '전화'} value={pi.buyerTel} />
              <Cell label={isExport ? 'Contact' : '담당자'} value={pi.buyerContact} />
              <Cell label={isExport ? 'E-mail' : '연락처'} value={pi.buyerEmail} className="border-b-0" />
            </div>
            <div className="border border-slate-300">
              <BoxHead>{isExport ? 'Notify Party' : '납품처 (실제 입고지)'}</BoxHead>
              <Cell label={isExport ? 'Company' : '상호 / 현장명'} value={pi.notifyCompany} />
              <Cell label={isExport ? 'Address' : '주소'} value={pi.notifyAddress} />
              <Cell label={isExport ? 'Tel' : '전화'} value={pi.notifyTel} />
              <Cell label={isExport ? 'Contact / E-mail' : '담당자 / 연락처'} value={pi.notifyContact} className="border-b-0" />
            </div>
          </div>

          {/* ─── 거래 조건 ─── */}
          <SectionBar>{isExport ? 'Shipping & Payment Terms' : '거래 조건'}</SectionBar>
          <div className="grid grid-cols-2 gap-x-3 border border-slate-300 border-t-0">
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
                  <Cell label="Insurance" value={pi.insurance} className="border-b-0" />
                </div>
              </>
            ) : (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="결제조건" value={pi.paymentTerms} />
                  <Cell label="납기 / 리드타임" value={pi.leadTime} />
                  <Cell label="운반비 부담" value={pi.freightBearer} className="border-b-0" />
                </div>
                <div>
                  <Cell label="세금계산서 발행" value={pi.taxInvoice} />
                  <Cell label="수량 허용오차" value={pi.qtyTolerance} />
                  <Cell label="부가가치세" value={pi.vatNote} className="border-b-0" />
                </div>
              </>
            )}
          </div>

          {/* ─── 품목표 (HS Code 컬럼 포함) ─── */}
          <table className="w-full mt-2 border-collapse text-[9px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5%' }} />{/* No. */}
              <col style={{ width: '13%' }} />{/* 품번 */}
              <col style={{ width: '30%' }} />{/* Description */}
              <col style={{ width: '11%' }} />{/* HS Code */}
              <col style={{ width: '13%' }} />{/* Color */}
              <col style={{ width: '9%' }} />{/* Qty */}
              <col style={{ width: '6%' }} />{/* Unit */}
              <col style={{ width: '13%' }} />{/* Unit Price */}
            </colgroup>
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-[4px] px-1 font-bold text-center border border-slate-800">No.</th>
                <th className="py-[4px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Item / Quality No.' : '품번'}</th>
                <th className="py-[4px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Item Name · Width · Weight' : '품명 · 폭 · 중량'}</th>
                <th className="py-[4px] px-1 font-bold text-center border border-slate-800">HS Code</th>
                <th className="py-[4px] px-1.5 font-bold text-left border border-slate-800">{isExport ? 'Color / Color No.' : '컬러 / 컬러번호'}</th>
                <th className="py-[4px] px-1 font-bold text-right border border-slate-800">{isExport ? 'Qty' : '수량'}</th>
                <th className="py-[4px] px-1 font-bold text-center border border-slate-800">{isExport ? 'Unit' : '단위'}</th>
                <th className="py-[4px] px-1.5 font-bold text-right border border-slate-800">{isExport ? 'Unit Price' : '단가'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="avoid-break align-top">
                  <td className="py-[4px] px-1 text-center border border-slate-300 text-slate-500">{idx + 1}</td>
                  <td className="py-[4px] px-1.5 border border-slate-300 font-bold text-slate-900 break-words">{it.article}</td>
                  <td className="py-[4px] px-1.5 border border-slate-300 text-slate-700 break-words leading-snug">{it.description}</td>
                  <td className="py-[4px] px-1 border border-slate-300 text-center text-slate-600 font-mono break-words">{it.hsCode}</td>
                  <td className="py-[4px] px-1.5 border border-slate-300 text-slate-700 break-words">{it.color}</td>
                  <td className="py-[4px] px-1 border border-slate-300 text-right font-mono text-slate-800">{it.qty ? Number(it.qty).toLocaleString() : ''}</td>
                  <td className="py-[4px] px-1 border border-slate-300 text-center text-slate-600">{it.unit}</td>
                  <td className="py-[4px] px-1.5 border border-slate-300 text-right font-mono text-slate-800">{it.unitPrice !== '' ? `${symbol}${money(it.unitPrice)}` : ''}</td>
                </tr>
              ))}
              {/* 빈 줄 채움 (양식 안정감) — 품목 2개 미만이면 채움 */}
              {Array.from({ length: Math.max(0, 2 - items.length) }).map((_, i) => (
                <tr key={`pad_${i}`} className="avoid-break">
                  <td className="py-[4px] px-1 border border-slate-300">&nbsp;</td>
                  <td className="border border-slate-300"></td>
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
            <table className="border-collapse text-[10px]" style={{ width: '52%' }}>
              <tbody>
                <tr>
                  <td className="py-[4px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'SUB TOTAL' : '공급가액'}</td>
                  <td className="py-[4px] px-3 border border-slate-300 text-right font-mono w-[45%]">{symbol}{money(T.subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-[4px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'FREIGHT' : '운   반   비'}</td>
                  <td className="py-[4px] px-3 border border-slate-300 text-right font-mono">{T.freight ? `${symbol}${money(T.freight)}` : '-'}</td>
                </tr>
                {isExport && (
                  <tr>
                    <td className="py-[4px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">INSURANCE</td>
                    <td className="py-[4px] px-3 border border-slate-300 text-right font-mono">{T.insurance ? `${symbol}${money(T.insurance)}` : '-'}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-[4px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">{isExport ? 'DISCOUNT / OTHERS (-)' : '할인 / 기타 (-)'}</td>
                  <td className="py-[4px] px-3 border border-slate-300 text-right font-mono">{T.discount ? `- ${symbol}${money(T.discount)}` : '-'}</td>
                </tr>
                {!isExport && (
                  <tr>
                    <td className="py-[4px] px-3 border border-slate-300 bg-slate-50 font-bold text-slate-600 text-right">부가가치세 (10%)</td>
                    <td className="py-[4px] px-3 border border-slate-300 text-right font-mono">{symbol}{money(T.vat)}</td>
                  </tr>
                )}
                <tr className="bg-slate-800 text-white">
                  <td className="py-[5px] px-3 border border-slate-800 font-extrabold text-right">{isExport ? 'TOTAL AMOUNT' : '합  계  금  액'}</td>
                  <td className="py-[5px] px-3 border border-slate-800 text-right font-mono font-extrabold text-[11.5px]">{symbol}{money(T.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── 금액 문자표기 ─── */}
          <div className="mt-1.5 border border-slate-300 bg-slate-50 px-3 py-[4px] text-[10px] avoid-break">
            <span className="font-bold text-slate-500 mr-2">{isExport ? 'SAY TOTAL' : '일금(한글)'}</span>
            <span className="font-bold text-slate-900">
              {isExport ? sayTotalUSD(T.total) : `${sayTotalKRW(T.total)}  (부가세 포함)`}
            </span>
          </div>

          {/* ─── 은행정보 (수출=USD계좌 / 내수=원화계좌) ─── */}
          <SectionBar>{isExport ? 'Bank Details (Beneficiary)' : '입금 계좌 (원화)'}</SectionBar>
          <div className="grid grid-cols-2 gap-x-3 border border-slate-300 border-t-0">
            {isExport ? (
              <>
                <div className="border-r border-slate-300">
                  <Cell label="Beneficiary" value={bank.beneficiary} />
                  <Cell label="Beneficiary Address" value={bank.beneficiaryAddress} />
                  <Cell label="Account No. (USD)" value={<span className="font-bold text-slate-900">{bank.accountNo}</span>} />
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
                  <Cell label="원화 계좌번호" value={<span className="font-bold text-slate-900">{krwAccountValue}</span>} className="border-b-0" />
                </div>
                <div>
                  <Cell label="은행명 / 지점" value={bank.bankBranch} />
                  <Cell label="예금 종류" value={bank.accountType} className="border-b-0" />
                </div>
              </>
            )}
          </div>

          {/* ─── 약관 (설정값) ─── */}
          <SectionBar>{isExport ? 'Terms & Conditions' : '거래 조건 및 면책 사항'}</SectionBar>
          <div className="border border-slate-300 border-t-0 px-3 py-1.5">
            <ol className="space-y-[2px]">
              {terms.map((t, i) => (
                <li key={i} className="text-[8px] text-slate-600 leading-[1.3] break-words">
                  <span className="font-bold text-slate-800">{i + 1}. {t.title}{t.title ? ' — ' : ''}</span>{t.body}
                </li>
              ))}
            </ol>
          </div>

          {/* ─── 서명란 ─── */}
          <div className="grid grid-cols-2 gap-3 mt-3 avoid-break">
            <div className="border border-slate-300 p-2">
              <div className="text-[8px] font-extrabold text-slate-600 uppercase tracking-wide mb-5">
                {isExport ? 'Confirmed & Accepted by (Buyer)' : '매수인 확인 (공급받는 자)'}
              </div>
              <div className="text-[8px] text-slate-500 border-t border-slate-300 pt-1.5">
                {isExport ? 'Signature / Company Stamp' : '서명 / 인'} &nbsp; ______________________ &nbsp;&nbsp; {isExport ? 'Date' : '일자'} : __________
              </div>
            </div>
            <div className="border border-slate-300 p-2">
              <div className="text-[8px] font-extrabold text-slate-600 uppercase tracking-wide mb-5">
                {isExport ? `For and on behalf of (Seller)` : `공급자  ${seller.company}`}
              </div>
              <div className="text-[8px] text-slate-500 border-t border-slate-300 pt-1.5">
                {isExport ? 'Signature / Company Stamp' : '서명 / 인'} &nbsp; ______________________ &nbsp;&nbsp; {isExport ? 'Date' : '일자'} : __________
              </div>
            </div>
          </div>

          {/* ─── 푸터 ─── */}
          <div className="text-center text-[8px] text-slate-400 mt-2 pt-1.5 border-t border-slate-200">
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
