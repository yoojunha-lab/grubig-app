import React from 'react';
import { Edit2, Plus, X, Check, Trash2 } from 'lucide-react';
import { PartnerSelectField } from '../common/PartnerSelectField';

/**
 * 개발 의뢰 등록/수정 모달
 * DevStatusPage 본문에서 분리된 폼 컴포넌트 (R4)
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {Function} onClose - 닫기 콜백
 * @param {string|null} editingDevId - 수정 중인 의뢰 ID (null이면 신규)
 * @param {Object} devInput - 폼 입력 값
 * @param {Function} handleDevChange - 일반 필드 변경 핸들러
 * @param {Function} handleSpecChange - targetSpec 내부 필드 변경 핸들러
 * @param {Function} onSave - 저장 콜백 (handleModalSave)
 * @param {Array} buyers - 바이어 목록
 * @param {Function} setIsBuyerModalOpen - 바이어 관리 모달 오픈
 * @param {Function} generateDevOrderNo - 자동 발번 함수
 */
export const DevRequestFormModal = ({
  isOpen,
  onClose,
  editingDevId,
  devInput,
  handleDevChange,
  handleSpecChange,
  onSave,
  onDelete,
  generateDevOrderNo,
  partners = [], savePartner, deletePartner, makeEmptyPartner,   // 거래처 선택
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 rounded-t-2xl flex items-center justify-between z-10">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            {editingDevId ? <Edit2 className="w-4 h-4 text-blue-500"/> : <Plus className="w-4 h-4 text-emerald-500"/>}
            {editingDevId ? '개발 의뢰 수정' : '새 개발 의뢰 등록'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400"/>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* 개발번호 입력란 (새 의뢰일 때만 표시) */}
          {!editingDevId && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                개발번호 <span className="text-slate-400">(비워두면 자동 발번)</span>
              </label>
              <input
                type="text"
                name="devOrderNo"
                value={devInput.devOrderNo || ''}
                onChange={handleDevChange}
                placeholder={generateDevOrderNo ? generateDevOrderNo() : 'F-26D001'}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono font-bold focus:ring-2 ring-violet-200 outline-none placeholder:text-slate-300"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-red-500 mb-0.5">바이어명 * (거래처)</label>
              <PartnerSelectField
                value={devInput.buyerName || ''}
                onSelect={p => handleDevChange({ target: { name: 'buyerName', value: p.name } })}
                partners={partners}
                savePartner={savePartner}
                deletePartner={deletePartner}
                makeEmptyPartner={makeEmptyPartner}
                placeholder="거래처 선택 / 등록"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">담당자</label>
              <input
                type="text"
                name="assignee"
                value={devInput.assignee || ''}
                onChange={handleDevChange}
                placeholder="영업 담당자"
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                개발 아이템 <span className="text-slate-400">(어떤 것을 개발하는지)</span>
              </label>
              <input
                type="text"
                name="devItem"
                value={devInput.devItem || ''}
                onChange={handleDevChange}
                placeholder="예: 니트 저지, 울혼방 트윌 등"
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">의뢰 일자</label>
              <input
                type="date"
                name="requestDate"
                value={devInput.requestDate}
                onChange={handleDevChange}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-red-500 mb-0.5">분석 납기 * 📅</label>
              <input
                type="date"
                value={devInput.targetSpec?.analysisDeadline || ''}
                onChange={e => handleSpecChange('analysisDeadline', e.target.value)}
                className="w-full border border-red-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-red-200 outline-none bg-red-50/30"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                샘플 생산 납기 📅 <span className="text-slate-400">(개발투입확정 시 필수)</span>
              </label>
              <input
                type="date"
                value={devInput.targetSpec?.sampleDeadline || ''}
                onChange={e => handleSpecChange('sampleDeadline', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">타겟 단가</label>
            <input
              type="text"
              placeholder="예: $3.50/yd"
              value={devInput.targetSpec?.targetPrice || ''}
              onChange={e => handleSpecChange('targetPrice', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">혼용률 / 스펙</label>
            <input
              type="text"
              placeholder="울 80% 나일론 20%"
              value={devInput.targetSpec?.composition || ''}
              onChange={e => handleSpecChange('composition', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">원하는 느낌</label>
            <input
              type="text"
              placeholder="부드럽고 드레이프감"
              value={devInput.targetSpec?.feeling || ''}
              onChange={e => handleSpecChange('feeling', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">기타 요청</label>
            <textarea
              placeholder="추가 요청..."
              value={devInput.targetSpec?.otherRequests || ''}
              onChange={e => handleSpecChange('otherRequests', e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">스와치 메모</label>
            <input
              type="text"
              placeholder="스와치 관련"
              name="swatchNote"
              value={devInput.swatchNote || ''}
              onChange={handleDevChange}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 ring-violet-200 outline-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 rounded-b-2xl flex gap-2 justify-end">
          {/* 수정 모드에서만 삭제 버튼 노출 (연결된 설계서가 있으면 핸들러가 차단) */}
          {editingDevId && onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 mr-auto"
              title="이 개발 의뢰를 영구 삭제합니다"
            >
              <Trash2 className="w-3.5 h-3.5"/> 삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95"
          >
            <Check className="w-3.5 h-3.5"/> {editingDevId ? '수정 저장' : '의뢰 등록'}
          </button>
        </div>
      </div>
    </div>
  );
};
