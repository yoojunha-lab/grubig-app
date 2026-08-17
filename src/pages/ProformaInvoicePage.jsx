import React, { useState, useMemo } from 'react';
import {
  FileText, Save, Download, FileSpreadsheet, FilePlus, Trash2, Plus,
  Copy, Globe, Home, Search, Package, Pencil, X, RefreshCw, Settings,
} from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { PartnerSelectField } from '../components/common/PartnerSelectField';
import { PI_UNIT_OPTIONS, buildPIDescription } from '../constants/proformaInvoice';
import { computePITotals } from '../components/pi/PIPrintSheet';

// ── 작은 입력 필드 (라벨 + input) ───────────────────────────
const Field = ({ label, name, value, onChange, placeholder = '', type = 'text', className = '' }) => (
  <div className={className}>
    <label className="block text-[11px] font-bold text-slate-500 mb-1">{label}</label>
    <input
      type={type}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
    />
  </div>
);

const marketBadge = (m) =>
  (m === 'domestic')
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><Home className="w-3 h-3" /> 내수</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><Globe className="w-3 h-3" /> 수출</span>;

const fmtAmt = (pi, t) => {
  const isDom = pi.marketType === 'domestic';
  const sym = isDom ? '₩' : '$';
  const amt = isDom
    ? (Number(t.total) || 0).toLocaleString('ko-KR')
    : (Number(t.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${amt}`;
};

export const ProformaInvoicePage = ({
  piInput, setPIInput, editingPIId,
  handlePIChange, setMarketType, handleNewPI, handleRegeneratePINo, resetPIForm,
  addPIItem, removePIItem, handleItemChange, addItemFromFabric,
  handleSavePI, handleEditPI, handleDuplicatePI, handleDeletePI,
  handlePrintPI, handleDownloadPIExcel,
  proformaInvoices = [], savedFabrics = [],
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
  onOpenSettings,                                                // PI 설정(은행/약관) 모달 열기
}) => {
  const isExport = piInput.marketType !== 'domestic';
  const symbol = isExport ? '$' : '₩';

  // 화면 모드: 'list'(보관함 기본) | 'form'(작성/편집 패널)
  const [mode, setMode] = useState('list');
  const [fabricPick, setFabricPick] = useState('');
  const [listMarketFilter, setListMarketFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');

  // ── 모드 전환 ──
  const openNew = () => { handleNewPI(piInput.marketType || 'export'); setFabricPick(''); setMode('form'); };
  const openEdit = (id) => { handleEditPI(id); setFabricPick(''); setMode('form'); };
  const backToList = () => { setMode('list'); resetPIForm && resetPIForm(); };
  const onSave = async () => { await handleSavePI(); /* 저장 후 폼 유지 (인쇄/추가편집 가능) */ };

  const fabricOptions = useMemo(
    () => (savedFabrics || []).map(f => ({ id: f.id, name: `${f.article || '(품번없음)'} · ${f.itemName || ''}` })),
    [savedFabrics]
  );

  const handlePickFabric = (fabricId) => {
    if (!fabricId) { setFabricPick(''); return; }
    const fabric = (savedFabrics || []).find(f => String(f.id) === String(fabricId));
    if (!fabric) return;
    // 사양(Description) = Item Name · 폭 · 중량 (혼용률 제외)
    const description = buildPIDescription(fabric, isExport);
    addItemFromFabric({ article: fabric.article || '', description });
    setFabricPick('');
  };

  const totals = computePITotals(piInput);
  const money = (v) => {
    const n = Number(v) || 0;
    return isExport
      ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  };

  // 보관함 목록 (필터 + 최신순)
  const filteredList = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    return [...(proformaInvoices || [])]
      .filter(pi => listMarketFilter === 'all' || (pi.marketType || 'export') === listMarketFilter)
      .filter(pi =>
        !term ||
        String(pi.piNo || '').toLowerCase().includes(term) ||
        String(pi.buyerCompany || '').toLowerCase().includes(term)
      )
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [proformaInvoices, listMarketFilter, listSearch]);

  // ════════════════════════════════════════════════════════
  // 상단 공통 헤더 (제목 + 등록 버튼 + 필터 + 검색)
  // ════════════════════════════════════════════════════════
  const Header = (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <FileText className="w-6 h-6 text-indigo-600" /> PI / 거래확인서
        <span className="text-base font-bold text-slate-400">({(proformaInvoices || []).length})</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
          {[['all', '전체'], ['export', '수출'], ['domestic', '내수']].map(([k, lbl]) => (
            <button key={k} onClick={() => setListMarketFilter(k)}
              className={`px-3 py-1.5 rounded-md transition-all ${listMarketFilter === k ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="번호·바이어 검색"
            className="border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm w-44 focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        {onOpenSettings && (
          <button onClick={onOpenSettings} className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center justify-center gap-1.5 text-sm font-bold">
            <Settings className="w-4 h-4" /> PI 설정
          </button>
        )}
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 text-sm font-bold shadow-lg shadow-indigo-200">
          <FilePlus className="w-4 h-4" /> PI 등록
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 작성/편집 폼 (우측 패널 내용)
  // ════════════════════════════════════════════════════════
  const FormPanel = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 폼 헤더: 제목 + 수출/내수 토글 + 액션 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-4 sm:px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-800 shrink-0">
            {editingPIId ? 'PI 편집' : 'PI 작성'}
          </h3>
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
            <button onClick={() => setMarketType('export')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isExport ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <Globe className="w-3.5 h-3.5" /> 수출 PI
            </button>
            <button onClick={() => setMarketType('domestic')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isExport ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <Home className="w-3.5 h-3.5" /> 내수 거래확인서
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => handleDownloadPIExcel(piInput)} className="bg-white border border-slate-300 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center gap-1.5 text-sm font-bold">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => handlePrintPI(piInput)} className="bg-white border border-slate-300 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 text-sm font-bold">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={onSave} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-sm font-bold">
            <Save className="w-4 h-4" /> 저장
          </button>
          <button onClick={backToList} className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-sm font-bold">
            <X className="w-4 h-4" /> 닫기
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* 발행 정보 */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">발행 정보</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">문서번호</label>
              <div className="flex gap-1">
                <input name="piNo" value={piInput.piNo ?? ''} onChange={handlePIChange} placeholder="GB-PI-2026-001"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                <button onClick={handleRegeneratePINo} title="문서번호만 다시 채번 (다른 입력값은 유지)" className="shrink-0 px-2 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-300">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Field label="발행일" name="date" type="date" value={piInput.date} onChange={handlePIChange} />
            <Field label="유효기한" name="validUntil" type="date" value={piInput.validUntil} onChange={handlePIChange} />
            <Field label={isExport ? "매수인 발주번호 (PO No.)" : "매수인 발주번호"} name="buyerPoNo" value={piInput.buyerPoNo} onChange={handlePIChange} placeholder="선택 입력" />
          </div>
        </section>

        {/* 매수인 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">매수인 (공급받는 자)</h3>
            <span className="text-[11px] text-slate-400">거래처 선택 시 주소·연락처 자동 입력</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">상호 * (거래처)</label>
              <PartnerSelectField
                value={piInput.buyerCompany || ''}
                onSelect={(p) => setPIInput(prev => ({
                  ...prev,
                  buyerCompany: p.name || '',
                  buyerBizNo: p.bizNo || prev.buyerBizNo,
                  buyerAddress: p.address || prev.buyerAddress,
                  buyerTel: p.tel || prev.buyerTel,
                  buyerContact: p.contact || prev.buyerContact,                          // 담당자
                  buyerEmail: (isExport ? p.email : (p.mobile || p.email)) || prev.buyerEmail, // 이메일(수출)/연락처(내수)
                }))}
                partners={partners}
                savePartner={savePartner}
                deletePartner={deletePartner}
                makeEmptyPartner={makeEmptyPartner}
                placeholder="거래처 선택 / 등록"
              />
            </div>
            {!isExport && <Field label="사업자등록번호" name="buyerBizNo" value={piInput.buyerBizNo} onChange={handlePIChange} />}
            <Field label={isExport ? 'Tel' : '전화'} name="buyerTel" value={piInput.buyerTel} onChange={handlePIChange} />
            <Field label={isExport ? 'Contact (담당자)' : '담당자'} name="buyerContact" value={piInput.buyerContact} onChange={handlePIChange} />
            <Field label={isExport ? 'E-mail' : '연락처'} name="buyerEmail" value={piInput.buyerEmail} onChange={handlePIChange} />
            <Field label={isExport ? 'Address' : '주소'} name="buyerAddress" value={piInput.buyerAddress} onChange={handlePIChange} className="md:col-span-4" />
          </div>
        </section>

        {/* 통지처 / 납품처 */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
            {isExport ? '통지처 (Notify Party)' : '납품처 (실제 입고지)'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label={isExport ? 'Company' : '상호 / 현장명'} name="notifyCompany" value={piInput.notifyCompany} onChange={handlePIChange} />
            <Field label={isExport ? 'Tel' : '전화'} name="notifyTel" value={piInput.notifyTel} onChange={handlePIChange} />
            <Field label={isExport ? 'Contact / E-mail' : '담당자 / 연락처'} name="notifyContact" value={piInput.notifyContact} onChange={handlePIChange} />
            <Field label={isExport ? 'Address' : '주소'} name="notifyAddress" value={piInput.notifyAddress} onChange={handlePIChange} />
          </div>
        </section>

        {/* 거래 조건 */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">거래 조건</h3>
          {isExport ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Price Term (Incoterms)" name="priceTerm" value={piInput.priceTerm} onChange={handlePIChange} />
              <Field label="Payment Terms" name="paymentTerms" value={piInput.paymentTerms} onChange={handlePIChange} placeholder="예: 30% T/T deposit, 70% before shipment" />
              <Field label="Shipment / Lead Time" name="leadTime" value={piInput.leadTime} onChange={handlePIChange} />
              <Field label="Port of Loading" name="portLoading" value={piInput.portLoading} onChange={handlePIChange} />
              <Field label="Final Destination" name="finalDest" value={piInput.finalDest} onChange={handlePIChange} />
              <Field label="Quantity Tolerance (수량 허용오차)" name="qtyTolerance" value={piInput.qtyTolerance} onChange={handlePIChange} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="결제조건" name="paymentTerms" value={piInput.paymentTerms} onChange={handlePIChange} placeholder="예: 계약금 30%, 잔금 납품 전" />
              <Field label="세금계산서 발행" name="taxInvoice" value={piInput.taxInvoice} onChange={handlePIChange} />
              <Field label="납기 / 리드타임" name="leadTime" value={piInput.leadTime} onChange={handlePIChange} />
              <Field label="납품 방법" name="deliveryMethod" value={piInput.deliveryMethod} onChange={handlePIChange} />
              <Field label="운반비 부담" name="freightBearer" value={piInput.freightBearer} onChange={handlePIChange} />
              <Field label="수량 허용오차" name="qtyTolerance" value={piInput.qtyTolerance} onChange={handlePIChange} />
              <Field label="부가가치세" name="vatNote" value={piInput.vatNote} onChange={handlePIChange} />
            </div>
          )}
        </section>

        {/* 품목표 */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-4 h-4" /> 품목
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-72">
                <SearchableSelect
                  value={fabricPick}
                  options={fabricOptions}
                  onChange={handlePickFabric}
                  placeholder="원단에서 불러오기 (품번·사양 자동)"
                />
              </div>
              <button onClick={addPIItem} className="shrink-0 flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100">
                <Plus className="w-4 h-4" /> 행 추가
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase">
                  <th className="py-2 px-2 w-8 text-center font-bold">No</th>
                  <th className="py-2 px-2 text-left font-bold w-28">품번</th>
                  <th className="py-2 px-2 text-left font-bold">사양 (Item Name·폭·중량)</th>
                  <th className="py-2 px-2 text-left font-bold w-28">HS Code</th>
                  <th className="py-2 px-2 text-left font-bold w-28">컬러 / 컬러번호</th>
                  <th className="py-2 px-2 text-right font-bold w-24">수량</th>
                  <th className="py-2 px-2 text-center font-bold w-20">단위</th>
                  <th className="py-2 px-2 text-right font-bold w-28">단가 ({symbol})</th>
                  <th className="py-2 px-2 text-right font-bold w-28">금액</th>
                  <th className="py-2 px-1 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(piInput.items || []).map((it, idx) => {
                  const amount = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                  return (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-2 text-center text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-1.5 px-2">
                        <input value={it.article ?? ''} onChange={e => handleItemChange(it.id, 'article', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-bold uppercase focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="py-1.5 px-2">
                        <textarea value={it.description ?? ''} onChange={e => handleItemChange(it.id, 'description', e.target.value)} rows={2}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none leading-snug" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input value={it.hsCode ?? ''} onChange={e => handleItemChange(it.id, 'hsCode', e.target.value)} placeholder="6006.10-0000"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input value={it.color ?? ''} onChange={e => handleItemChange(it.id, 'color', e.target.value)} placeholder="NAVY / #1102"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" value={it.qty ?? ''} onChange={e => handleItemChange(it.id, 'qty', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={it.unit ?? 'YDS'} onChange={e => handleItemChange(it.id, 'unit', e.target.value)}
                          className="w-full border border-slate-200 rounded px-1 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                          {PI_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" value={it.unitPrice ?? ''} onChange={e => handleItemChange(it.id, 'unitPrice', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">{symbol}{money(amount)}</td>
                      <td className="py-1.5 px-1 text-center">
                        <button onClick={() => removePIItem(it.id)} className="text-slate-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(piInput.items || []).length === 0 && (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400 text-sm">‘원단에서 불러오기’ 또는 ‘행 추가’로 품목을 넣어주세요.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 합계 조정 + 미리보기 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">합계 조정</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isExport ? 'Freight' : '운반비'} name="freightAmt" type="number" value={piInput.freightAmt} onChange={handlePIChange} placeholder="0" />
              {isExport && <Field label="Insurance" name="insuranceAmt" type="number" value={piInput.insuranceAmt} onChange={handlePIChange} placeholder="0" />}
              <Field label={isExport ? 'Discount / Others' : '할인 / 기타'} name="discountAmt" type="number" value={piInput.discountAmt} onChange={handlePIChange} placeholder="0" />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">합계 미리보기</h3>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{isExport ? 'Sub Total' : '공급가액'}</span><span className="font-mono font-medium">{symbol}{money(totals.subtotal)}</span></div>
              {totals.freight > 0 && <div className="flex justify-between"><span className="text-slate-500">{isExport ? 'Freight' : '운반비'}</span><span className="font-mono">{symbol}{money(totals.freight)}</span></div>}
              {isExport && totals.insurance > 0 && <div className="flex justify-between"><span className="text-slate-500">Insurance</span><span className="font-mono">{symbol}{money(totals.insurance)}</span></div>}
              {totals.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">{isExport ? 'Discount' : '할인'}</span><span className="font-mono text-red-500">- {symbol}{money(totals.discount)}</span></div>}
              {!isExport && <div className="flex justify-between"><span className="text-slate-500">부가세 (10%)</span><span className="font-mono">{symbol}{money(totals.vat)}</span></div>}
              <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
                <span className="font-extrabold text-slate-800">{isExport ? 'TOTAL' : '합계금액'}</span>
                <span className="font-mono font-extrabold text-indigo-700 text-base">{symbol}{money(totals.total)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 좌측 좁은 목록 (폼 열렸을 때) — 클릭하면 바로 그 문서 편집으로 전환
  // ════════════════════════════════════════════════════════
  const compactList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-150px)]">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <span className="text-xs font-extrabold text-slate-500">보관함 ({filteredList.length})</span>
        <button onClick={openNew} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
          <Plus className="w-3.5 h-3.5" /> 새로 작성
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {filteredList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">저장된 문서가 없습니다.</div>
        ) : filteredList.map(pi => (
          <button key={pi.id} onClick={() => openEdit(pi.id)}
            className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-indigo-50/60 transition-colors ${editingPIId === pi.id ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'border-l-[3px] border-l-transparent'}`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[13px] font-bold text-slate-800 truncate">{pi.piNo}</span>
              {marketBadge(pi.marketType)}
            </div>
            <div className="text-[11px] text-slate-500 truncate uppercase">{pi.buyerCompany || '(바이어 미입력)'}</div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
              <span>{pi.date}</span>
              <span className="font-mono text-slate-600">{fmtAmt(pi, computePITotals(pi))}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // 보관함 전체 표 (기본 화면)
  // ════════════════════════════════════════════════════════
  const fullList = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {filteredList.length === 0 ? (
        <div className="py-20 text-center">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-4">저장된 PI / 거래확인서가 없습니다.</p>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-lg shadow-indigo-200">
            <FilePlus className="w-4 h-4" /> 첫 PI 등록하기
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold">구분</th>
                <th className="py-2.5 px-3 font-bold">문서번호</th>
                <th className="py-2.5 px-3 font-bold">발행일</th>
                <th className="py-2.5 px-3 font-bold">바이어</th>
                <th className="py-2.5 px-3 font-bold text-center">품목수</th>
                <th className="py-2.5 px-3 font-bold">작성자</th>
                <th className="py-2.5 px-3 font-bold text-right">합계</th>
                <th className="py-2.5 px-3 font-bold text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map(pi => {
                const t = computePITotals(pi);
                return (
                  <tr key={pi.id} onClick={() => openEdit(pi.id)} className="hover:bg-indigo-50/40 cursor-pointer">
                    <td className="py-2.5 px-3">{marketBadge(pi.marketType)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{pi.piNo}</td>
                    <td className="py-2.5 px-3 text-slate-500">{pi.date}</td>
                    <td className="py-2.5 px-3 text-slate-700 uppercase">{pi.buyerCompany}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{(pi.items || []).length}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{pi.authorName || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmtAmt(pi, t)}</td>
                    <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(pi.id)} title="편집" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handlePrintPI(pi)} title="PDF 인쇄" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Download className="w-4 h-4" /></button>
                        <button onClick={() => { handleDuplicatePI(pi.id); setMode('form'); }} title="복제" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => handleDeletePI(pi.id)} title="삭제" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto w-full print:hidden">
      {Header}
      {mode === 'list' ? (
        /* 기본 화면: 보관함 전체 표 */
        fullList
      ) : (
        /* 작성/편집: 좌측 목록 + 우측 폼이 옆에 붙어서 (좌측 클릭 시 즉시 전환) */
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <aside className="w-full lg:w-72 shrink-0">{compactList}</aside>
          <div className="flex-1 min-w-0 w-full max-w-5xl">{FormPanel}</div>
        </div>
      )}
    </div>
  );
};
