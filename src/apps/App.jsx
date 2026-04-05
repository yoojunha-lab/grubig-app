import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, FileSpreadsheet, Calculator,
  RotateCcw, Layers, Edit2, Check, X, Box, Search, ChevronDown, ChevronUp,
  TrendingUp, Users, Factory, FileText, Calendar, Upload,
  Globe, Home, DollarSign, History, AlertCircle, Info, Filter, Truck, Download,
  Cloud, LogOut, Database, ClipboardPaste, Menu, Eye, Settings
} from 'lucide-react';

// 🔥 Firebase 모듈 (서비스 레이어 연동)
import { onSnapshot, collection, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut, signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from '../services/firebase';
import { saveDocument, deleteDocument, saveBatchDocuments, updateYarnCategoryBatch } from '../services/db';

// ⚙️ 공통 상수 & 유틸리티 연동
import { ALLOWED_DOMAIN, DEFAULT_YARN_CATEGORIES, MARGIN_TIERS } from '../constants/common';
import { num, usd, smartRound, applyGrossMargin, getLastDayOfQuoteMonth } from '../utils/helpers';
import { useXLSX, useHTML2PDF } from '../hooks/useExternalScripts';

// ⚓️ 도메인 로직 훅 연동
import { useFabric } from '../hooks/domains/useFabric';
import { useYarn } from '../hooks/domains/useYarn';
import { useQuotation } from '../hooks/domains/useQuotation';
import { useDevRequest } from '../hooks/domains/useDevRequest';
import { useDesignSheet } from '../hooks/domains/useDesignSheet';
import { useMainDetail } from '../hooks/domains/useMainDetail';

// 🧩 공통 / 레이아웃 UI 컴포넌트
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Toast } from '../components/common/Toast';
import { Sidebar } from '../components/layout/Sidebar';
import { LoginScreen } from '../components/layout/LoginScreen';
import { MasterDataModal } from '../components/common/MasterDataModal';
import { CategoryModal } from '../components/common/CategoryModal';

// 📄 도메인 뷰 (페이지) 컴포넌트
import { CalculatorPage } from '../pages/CalculatorPage';
import { FabricListPage } from '../pages/FabricListPage';
import { YarnLibraryPage } from '../pages/YarnLibraryPage';
import { QuotationPage } from '../pages/QuotationPage';
import { QuoteHistoryPage } from '../pages/QuoteHistoryPage';
import { PDFRenderer } from '../components/quote/PDFRenderer';
import { DevRequestPage } from '../pages/DevRequestPage';
import { DesignSheetPage } from '../pages/DesignSheetPage';
import { DesignSheetListPage } from '../pages/DesignSheetListPage';
import { DevStatusPage } from '../pages/DevStatusPage';
import { MainDetailPage } from '../pages/MainDetailPage';

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('calculator');
  const [globalExchangeRate, setGlobalExchangeRate] = useState(() => Number(localStorage.getItem('grubig_global_exchange_rate')) || 1450);

  useEffect(() => {
    localStorage.setItem('grubig_global_exchange_rate', globalExchangeRate);
  }, [globalExchangeRate]);

  const [yarnLibrary, setYarnLibrary] = useState([]);
  const [savedFabrics, setSavedFabrics] = useState([]);
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_YARN_CATEGORIES);
  const [buyers, setBuyers] = useState([]);
  const [devRequests, setDevRequests] = useState([]);
  const [designSheets, setDesignSheets] = useState([]);
  const [mainDetails, setMainDetails] = useState([]);

  // 마스터 데이터 (settings/general에 배열로 저장)
  const [knittingFactories, setKnittingFactories] = useState([]);
  const [dyeingFactories, setDyeingFactories] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [structures, setStructures] = useState([]);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [viewMode, setViewMode] = useState('domestic');
  const [yarnFilterCategory, setYarnFilterCategory] = useState('All');
  const [yarnFilterSupplier, setYarnFilterSupplier] = useState('All');

  const [quoteAuthorFilter, setQuoteAuthorFilter] = useState('All');
  const [quoteBuyerFilter, setQuoteBuyerFilter] = useState('');
  const [quoteDateFilter, setQuoteDateFilter] = useState('');
  const [quoteMarketFilter, setQuoteMarketFilter] = useState('All');

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isYarnBulkModalOpen, setIsYarnBulkModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [activeMasterModal, setActiveMasterModal] = useState(null);

  const [fabricSearchTerm, setFabricSearchTerm] = useState('');
  const [yarnSearchTerm, setYarnSearchTerm] = useState('');
  const [quickViewQuote, setQuickViewQuote] = useState(null);

  const [isDesignSheetModalOpen, setIsDesignSheetModalOpen] = useState(false);

  const printRef = useRef(null);
  const fileInputRef = useRef(null);
  const yarnFileInputRef = useRef(null);
  const isXlsxReady = useXLSX();
  const isPdfReady = useHTML2PDF();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email.endsWith(ALLOWED_DOMAIN)) setUser(currentUser);
      else if (currentUser) { alert("접근 불가: grubig.kr 계정이 아닙니다."); signOut(auth); }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user) return;
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.yarnCategories) setCategories(d.yarnCategories);
        if (d.buyers) setBuyers(d.buyers);
        // 마스터 데이터 4종 로딩
        setKnittingFactories(d.knittingFactories || []);
        setDyeingFactories(d.dyeingFactories || []);
        setMachineTypes(d.machineTypes || []);
        setStructures(d.structures || []);
      } else {
        setDoc(doc(db, 'settings', 'general'), { yarnCategories: DEFAULT_YARN_CATEGORIES, buyers: [], knittingFactories: [], dyeingFactories: [], machineTypes: [], structures: [] }, { merge: true });
      }
    });
    const unsubYarns = onSnapshot(collection(db, 'yarns'), (snapshot) => {
      setYarnLibrary(snapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.suppliers) return { ...data, suppliers: [{ id: 'sup_legacy', name: data.supplier || '기본업체', currency: data.currency || 'KRW', price: data.price || 0, tariff: data.tariff || 0, freight: data.freight || 0, history: data.history || [], isDefault: true }] };
        return data;
      }));
    });
    const unsubFabrics = onSnapshot(collection(db, 'fabrics'), (snapshot) => setSavedFabrics(snapshot.docs.map(doc => doc.data())));
    const unsubQuotes = onSnapshot(collection(db, 'quotes'), (snapshot) => { setSavedQuotes(snapshot.docs.map(doc => doc.data())); setSyncStatus('saved'); });
    const unsubDevReqs = onSnapshot(collection(db, 'devRequests'), (snapshot) => setDevRequests(snapshot.docs.map(doc => doc.data())));
    const unsubDesignSheets = onSnapshot(collection(db, 'designSheets'), (snapshot) => setDesignSheets(snapshot.docs.map(doc => doc.data())));
    const unsubMainDetails = onSnapshot(collection(db, 'mainDetails'), (snapshot) => setMainDetails(snapshot.docs.map(doc => doc.data())));
    return () => { unsubSettings(); unsubYarns(); unsubFabrics(); unsubQuotes(); unsubDevReqs(); unsubDesignSheets(); unsubMainDetails(); };
  }, [user]);

  const saveDocToCloud = async (colName, item) => { setSyncStatus('syncing'); try { await saveDocument(colName, item); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("저장 실패", "error"); } };
  const deleteDocFromCloud = async (colName, id) => { setSyncStatus('syncing'); try { await deleteDocument(colName, id); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("삭제 실패", "error"); } };
  const saveBatchToCloud = async (colName, items) => { setSyncStatus('syncing'); try { await saveBatchDocuments(colName, items); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("일괄 저장 실패", "error"); } };

  const showToast = (message, type = 'success') => { setNotification({ show: true, message, type }); setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000); };

  // 마스터 데이터 등록/삭제 공용 함수 (settings/general 문서의 배열 필드)
  const addMasterItem = async (field, name) => {
    const trimmed = String(name).trim();
    if (!trimmed) { showToast('이름을 입력해주세요.', 'error'); return false; }
    // 현재 값 참조 (buyers, knittingFactories 등)
    const currentMap = { buyers, knittingFactories, dyeingFactories, machineTypes, structures };
    const current = currentMap[field] || [];
    if (current.includes(trimmed)) { showToast('이미 등록된 항목입니다.', 'error'); return false; }
    await setDoc(doc(db, 'settings', 'general'), { [field]: [...current, trimmed] }, { merge: true });
    showToast(`'${trimmed}' 등록 완료`, 'success');
    return true;
  };
  const removeMasterItem = async (field, name) => {
    const currentMap = { buyers, knittingFactories, dyeingFactories, machineTypes, structures };
    const current = currentMap[field] || [];
    await setDoc(doc(db, 'settings', 'general'), { [field]: current.filter(i => i !== name) }, { merge: true });
    showToast(`'${name}' 삭제됨`, 'success');
  };

  // ⚓️ 커스텀 도메인 훅 사용
  const {
    fabricInput, setFabricInput, editingFabricId, expandedFabricId, setExpandedFabricId,
    handleFabricChange, handleNestedChange, handleYarnSlotChange,
    handleSaveFabric, handleEditFabric, handleDeleteFabric, resetFabricForm, calculateCost, getMergedYarnName
  } = useFabric(yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate);

  const {
    yarnInput, setYarnInput, editingYarnId,
    handleSaveYarn, handleEditYarn, handleDeleteYarn, resetYarnForm,
    handleAddSupplier, handleRemoveSupplier, handleSupplierChange, handleDeleteHistoryItem
  } = useYarn(yarnLibrary, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast, designSheets);

  const {
    quoteInput, setQuoteInput, handleQuoteSettingChange, createQuoteItem,
    handleAddFabricToQuote, handleGridPaste, handleQuoteBasePriceChange,
    handleRemoveItemFromQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  } = useQuotation(savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate);

  // ⚓️ 설계서 시스템 훅
  const {
    devInput, setDevInput, editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, linkAndConfirm
  } = useDevRequest(devRequests, saveDocToCloud, deleteDocFromCloud, showToast, designSheets);

  // 의뢰 삭제 래퍼: 연결된 설계서의 devRequestId도 정리 (미아 방지)
  const handleDeleteDevWithCleanup = (devReqId) => {
    // 연결된 설계서 찾아서 devRequestId 해제
    const linkedSheets = (designSheets || []).filter(s => s.devRequestId === devReqId);
    linkedSheets.forEach(sheet => {
      saveDocToCloud('designSheets', {
        ...sheet,
        devRequestId: null,
        updatedAt: new Date().toISOString()
      });
    });
    handleDeleteDevRequest(devReqId);
  };

  // 아이템화 시 원단 자동 등록용 함수
  const saveFabricFromSheet = (fabricData) => {
    saveDocToCloud('fabrics', fabricData);
  };

  const {
    sheetInput, setSheetInput, editingSheetId,
    handleSheetChange, handleSectionChange,
    handleSheetYarnChange, handleCostInputChange, handleCostNestedChange,
    handleActualDataChange,
    handleSaveSheet, handleEditSheet, handleDeleteSheet,
    resetSheetForm, getStageIndex, advanceStage,
    autoAdvanceEztex, advanceToEztex,
    addOrderNumber, removeOrderNumber,
    getDesignCost, initFromDevRequest, dropDesignSheet, restoreFromDrop,
    registerFabricFromSheet
  } = useDesignSheet(designSheets, savedFabrics, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate, saveFabricFromSheet, devRequests);

  // ⚓️ 메인 디테일 훅
  const {
    detailInput, setDetailInput, editingDetailId, setEditingDetailId,
    handleDetailChange, handleTestChange, addTest, removeTest,
    handleSaveDetail, handleEditDetail, handleDeleteDetail, resetDetailForm,
    handleQuickStatusChange
  } = useMainDetail(mainDetails, saveDocToCloud, deleteDocFromCloud, showToast);

  const devPrintRef = useRef(null);

  const [selectedFabricIdForQuote, setSelectedFabricIdForQuote] = useState('');
  const [bulkArticleInput, setBulkArticleInput] = useState('');

  const [editingCategoryOld, setEditingCategoryOld] = useState(null);
  const [editingCategoryNew, setEditingCategoryNew] = useState('');
  const [editingBuyerNew, setEditingBuyerNew] = useState('');

  // OLD CALCULATION LOGICS MOVED TO HOOKS

  const handleBackupFabrics = () => {
    if (!isXlsxReady) return;
    const dataToExport = savedFabrics.map(f => ({
      Article: f.article, ItemName: f.itemName, WidthFull: f.widthFull, WidthCut: f.widthCut, GSM: f.gsm, CostGYd: f.costGYd,
      KnittingFee1k: f.knittingFee1k, KnittingFee3k: f.knittingFee3k, KnittingFee5k: f.knittingFee5k, DyeingFee: f.dyeingFee,
      ExtraFee1k: f.extraFee1k, ExtraFee3k: f.extraFee3k, ExtraFee5k: f.extraFee5k, Remarks: f.remarks || '',
      Yarn1_Name: getMergedYarnName(f.yarns[0]?.yarnId), Yarn1_Ratio: f.yarns[0]?.ratio || 0,
      Yarn2_Name: getMergedYarnName(f.yarns[1]?.yarnId), Yarn2_Ratio: f.yarns[1]?.ratio || 0,
      Yarn3_Name: getMergedYarnName(f.yarns[2]?.yarnId), Yarn3_Ratio: f.yarns[2]?.ratio || 0,
      Yarn4_Name: getMergedYarnName(f.yarns[3]?.yarnId), Yarn4_Ratio: f.yarns[3]?.ratio || 0,
    }));
    const ws = window.XLSX.utils.json_to_sheet(dataToExport); const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원단백업"); window.XLSX.writeFile(wb, `Fabric_Backup_${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleBackupYarns = () => {
    if (!isXlsxReady) return;
    const dataToExport = yarnLibrary.flatMap(y =>
      (y.suppliers || []).map(s => ({ Category: y.category, Name: y.name, Supplier: s.name, Currency: s.currency, Price: s.price, Tariff: s.tariff, Freight: s.freight || 0, IsDefault: s.isDefault ? 'Y' : '', Remarks: y.remarks }))
    );
    const ws = window.XLSX.utils.json_to_sheet(dataToExport); const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원사백업"); window.XLSX.writeFile(wb, `Yarn_Backup_${new Date().toLocaleDateString()}.xlsx`);
  };

  const EXCEL_HEADERS = ['Article', 'ItemName', 'WidthFull', 'WidthCut', 'GSM', 'CostGYd', 'MarginTier', 'BrandExtra1k', 'BrandExtra3k', 'BrandExtra5k', 'KnittingFee1k', 'KnittingFee3k', 'KnittingFee5k', 'DyeingFee', 'ExtraFee1k', 'ExtraFee3k', 'ExtraFee5k', 'KnitLoss1k', 'KnitLoss3k', 'KnitLoss5k', 'DyeLoss1k', 'DyeLoss3k', 'DyeLoss5k', 'Remarks', 'Yarn1_Name', 'Yarn1_Ratio', 'Yarn2_Name', 'Yarn2_Ratio', 'Yarn3_Name', 'Yarn3_Ratio', 'Yarn4_Name', 'Yarn4_Ratio'];

  const handleDownloadTemplate = () => {
    if (!isXlsxReady) return;
    const exampleRow = ['SAMPLE-01', 'Cotton Jersey', 58, 56, 300, 320, 3, 1000, 700, 500, 3000, 2000, 2000, 8800, 900, 700, 500, 5, 3, 3, 10, 10, 9, '바이어 요청 샘플', 'CM 30S', 100, '', 0, '', 0, '', 0];
    const ws = window.XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, exampleRow]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원단일괄등록");
    window.XLSX.writeFile(wb, '원단등록_양식_상세.xlsx', { bookType: 'xlsx', type: 'binary' });
  };

  const handleFileUpload = (e) => {
    if (!isXlsxReady || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ws = window.XLSX.read(evt.target.result, { type: 'binary' }).Sheets[window.XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws, { header: 0 });
        if (data.length === 0) { showToast('데이터가 없습니다.', 'error'); return; }

        const newFabrics = []; let missingYarnNames = new Set();
        data.forEach((row, idx) => {
          if (!row.Article) return; const kFee1k = Number(row.KnittingFee1k) || 3000;
          let mappedYarns = [];
          for (let i = 1; i <= 4; i++) {
            const yName = row[`Yarn${i}_Name`] ? String(row[`Yarn${i}_Name`]).trim().toUpperCase() : '';
            const rawRatio = row[`Yarn${i}_Ratio`];
            const yRatio = rawRatio ? Number(String(rawRatio).replace(/%/g, '').trim()) || 0 : 0;
            if (yName) {
              const found = yarnLibrary.find(y => String(y.name).toUpperCase() === yName);
              if (found) {
                mappedYarns.push({ yarnId: found.id, ratio: yRatio });
              } else {
                missingYarnNames.add(yName);
                // DB에 일단 가짜 yarn 이름 정보라도 쑤셔넣어서 나중에 '수정'할 때 매칭시킬 수 있게 배려
                mappedYarns.push({ yarnId: `UNREGISTERED_${yName}`, ratio: yRatio, tempName: yName });
              }
            } else { mappedYarns.push({ yarnId: '', ratio: 0 }); }
          }
          const getLoss = (field) => row[field] !== undefined ? Number(String(row[field]).replace(/%/g, '').trim()) : null;

          newFabrics.push({
            // [기획오류 #10 수정] ID를 문자열(fab_)로 통일
            id: `fab_${Date.now()}_${idx}`, date: new Date().toLocaleDateString(),
            article: String(row.Article || 'UNKNOWN').trim().toUpperCase(), itemName: String(row.ItemName || ''), remarks: String(row.Remarks || ''),
            widthFull: Number(row.WidthFull) || 58, widthCut: Number(row.WidthCut) || 56, gsm: Number(row.GSM) || 300, costGYd: row.CostGYd ? Number(row.CostGYd) : '',
            knittingFee1k: kFee1k, knittingFee3k: Number(row.KnittingFee3k) || 2000, knittingFee5k: Number(row.KnittingFee5k) || 2000, dyeingFee: Number(row.DyeingFee) || 8800,
            extraFee1k: Number(row.ExtraFee1k) || 900, extraFee3k: Number(row.ExtraFee3k) || 700, extraFee5k: Number(row.ExtraFee5k) || 500,
            losses: {
              tier1k: { knit: getLoss('KnitLoss1k') ?? 5, dye: getLoss('DyeLoss1k') ?? 10 },
              tier3k: { knit: getLoss('KnitLoss3k') ?? 3, dye: getLoss('DyeLoss3k') ?? 10 },
              tier5k: { knit: getLoss('KnitLoss5k') ?? 3, dye: getLoss('DyeLoss5k') ?? 9 }
            },
            marginTier: row.MarginTier !== undefined ? Number(row.MarginTier) : 3,
            brandExtra: {
              tier1k: row.BrandExtra1k !== undefined ? Number(row.BrandExtra1k) : 1000,
              tier3k: row.BrandExtra3k !== undefined ? Number(row.BrandExtra3k) : 700,
              tier5k: row.BrandExtra5k !== undefined ? Number(row.BrandExtra5k) : 500
            },
            yarns: mappedYarns
          });
        });

        setSavedFabrics([...newFabrics, ...savedFabrics]); saveBatchToCloud('fabrics', newFabrics); setIsBulkModalOpen(false);

        if (missingYarnNames.size > 0) {
          alert(`✅ 총 ${newFabrics.length}건이 성공적으로 등록되었습니다.\n\n⚠️ 주의: 다음 원사 정보가 아직 라이브러리에 없어서 임시 텍스트로 등록되었습니다.\n해당 원단들의 수율 단가(Cost/gYD) 계산이 부정확할 수 있으니,\n이후 원사 라이브러리에 아래 원사들을 추가하시거나 원단을 수정해주세요.\n\n[미등록 원사 목록]\n${[...missingYarnNames].join(', ')}`);
        } else {
          showToast(`${newFabrics.length}건이 완벽하게 등록되었습니다.`, 'success');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) { alert(`엑셀 업로드 중 오류가 발생했습니다: ${err.message}`); }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  const YARN_EXCEL_HEADERS = ['Category', 'Name', 'Supplier', 'Currency', 'Price', 'Tariff', 'Freight', 'Remarks'];
  const handleDownloadYarnTemplate = () => {
    if (!isXlsxReady) return;
    const ws = window.XLSX.utils.aoa_to_sheet([YARN_EXCEL_HEADERS, ['소모', '2/48 WOOL', 'XINAO', 'KRW', 18000, 8, 2, 'Standard']]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "원사일괄등록");
    window.XLSX.writeFile(wb, '원사등록_양식.xlsx', { bookType: 'xlsx', type: 'binary' });
  };
  const handleYarnFileUpload = (e) => {
    if (!isXlsxReady || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ws = window.XLSX.read(evt.target.result, { type: 'binary' }).Sheets[window.XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws, { header: 0 });
        if (data.length === 0) { showToast('데이터가 없습니다.', 'error'); return; }

        const groupedYarns = {};
        data.forEach((row, idx) => {
          if (!row.Name) return;
          const name = String(row.Name).trim().toUpperCase();
          if (!groupedYarns[name]) {
            groupedYarns[name] = { id: `y${Date.now()}_${idx}`, category: row.Category ? String(row.Category).toUpperCase() : '소모', name: name, remarks: String(row.Remarks || ''), suppliers: [] };
          }
          groupedYarns[name].suppliers.push({
            id: `sup_${Date.now()}_${idx}`, name: row.Supplier ? String(row.Supplier).toUpperCase() : '기본업체', currency: String(row.Currency || 'KRW'), price: Number(row.Price) || 0,
            tariff: row.Tariff !== undefined ? Number(row.Tariff) : 8, freight: row.Freight !== undefined ? Number(row.Freight) : 0,
            history: [{ date: new Date().toLocaleDateString(), price: Number(row.Price) || 0 }],
            isDefault: groupedYarns[name].suppliers.length === 0
          });
        });

        const newYarns = Object.values(groupedYarns);
        setYarnLibrary([...newYarns, ...yarnLibrary]); saveBatchToCloud('yarns', newYarns); setIsYarnBulkModalOpen(false); showToast(`${newYarns.length}건의 원사가 등록되었습니다.`, 'success');
        if (yarnFileInputRef.current) yarnFileInputRef.current.value = '';
      } catch (err) { alert(`엑셀 업로드 중 오류가 발생했습니다: ${err.message}`); }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  // OLD SUPPLIER LOGICS MOVED TO HOOKS

  const handleSaveCategoryEdit = async (oldName, newName) => {
    const safeNewName = String(newName || '').trim();
    if (!safeNewName) { alert("카테고리 이름을 입력해주세요."); return; }
    const upperNew = safeNewName.toUpperCase();
    const upperOld = oldName ? String(oldName).toUpperCase() : null;

    try {
      setSyncStatus('syncing');
      let updatedCats = [...categories];

      if (upperOld) {
        updatedCats = updatedCats.map(c => String(c).toUpperCase() === upperOld ? upperNew : c);
        const yarnsToUpdate = yarnLibrary.filter(y => String(y.category).toUpperCase() === upperOld);

        await updateYarnCategoryBatch(yarnsToUpdate, upperNew);
      } else {
        if (!updatedCats.map(c => String(c).toUpperCase()).includes(upperNew)) updatedCats.push(upperNew);
      }

      await setDoc(doc(db, 'settings', 'general'), { yarnCategories: [...new Set(updatedCats)] }, { merge: true });
      setEditingCategoryOld(null); setEditingCategoryNew(''); setIsCategoryModalOpen(false);
      setSyncStatus('saved'); showToast('카테고리가 저장되었습니다.', 'success');
    } catch (e) {
      setSyncStatus('error'); alert(`오류 발생: ${e.message}`);
    }
  };

  const handleDeleteCategory = async (catName) => {
    const isUsed = yarnLibrary.some(y => String(y.category).toUpperCase() === String(catName).toUpperCase());
    if (isUsed) { alert("🚨 이 카테고리를 사용 중인 원사가 있어서 삭제할 수 없습니다. 원사를 먼저 다른 카테고리로 변경하세요."); return; }
    if (window.confirm(`'${catName}' 카테고리를 삭제하시겠습니까?`)) {
      const newCats = categories.filter(c => String(c).toUpperCase() !== String(catName).toUpperCase());
      await setDoc(doc(db, 'settings', 'general'), { yarnCategories: newCats }, { merge: true });
      showToast('카테고리가 삭제되었습니다.', 'success');
    }
  };

  const handleSaveBuyer = async (newName) => {
    const safeNewName = String(newName || '').trim().toUpperCase();
    if (!safeNewName) { alert("바이어 상호명을 입력해주세요."); return; }
    if (buyers.includes(safeNewName)) { alert("이미 등록된 바이어입니다."); return; }
    try {
      setSyncStatus('syncing');
      const updatedBuyers = [...buyers, safeNewName].sort();
      await setDoc(doc(db, 'settings', 'general'), { buyers: updatedBuyers }, { merge: true });
      setEditingBuyerNew('');
      setSyncStatus('saved'); showToast('새로운 바이어가 추가되었습니다.', 'success');
    } catch (e) {
      setSyncStatus('error'); alert(`오류 발생: ${e.message}`);
    }
  };

  const handleDeleteBuyer = async (buyerName) => {
    const isUsed = savedQuotes.some(q => String(q.buyerName).toUpperCase() === String(buyerName).toUpperCase());
    if (isUsed) { if (!window.confirm("이미 이 바이어로 작성된 견적 히스토리가 있습니다. 그래도 목록에서 삭제하시겠습니까? (기존 히스토리는 유지됩니다)")) return; }
    else if (!window.confirm(`'${buyerName}' 바이어를 목록에서 삭제하시겠습니까?`)) return;

    const newBuyers = buyers.filter(b => b !== buyerName);
    await setDoc(doc(db, 'settings', 'general'), { buyers: newBuyers }, { merge: true });
    showToast('바이어가 삭제되었습니다.', 'success');
  };

  // OLD QUOTATION LOGICS MOVED TO HOOKS

  const handleDownloadPDF = (targetQuoteFromHistory = null) => {
    // History 페이지 등에서 특정 견적서 출력 시 해당 견적서 데이터를 최우선으로 적용합니다.
    const targetQuote = (targetQuoteFromHistory && targetQuoteFromHistory.id) ? targetQuoteFromHistory : quoteInput;

    if (!isPdfReady) { showToast("PDF 로딩 중입니다.", 'error'); return; }
    if (!targetQuote.items || targetQuote.items.length === 0) { showToast("내용이 없습니다.", 'error'); return; }

    // PDFRenderer가 올바른 데이터로 렌더링되도록 항상 setQuoteInput 실행
    setQuoteInput(targetQuote);
    setIsPdfGenerating(true); showToast("PDF 생성 중... (잠시만 기다려주세요)", 'info');

    // React state 업데이트 + 렌더 사이클을 기다린 후 PDF 생성
    setTimeout(() => {
      if (printRef.current && window.html2pdf) {
        const opt = {
          margin: 0,
          filename: `Quotation_${String(targetQuote.buyerName || '').replace(/[^a-zA-Z0-9\s-가-힣]/g, '')}_${targetQuote.date || ''}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        window.html2pdf().set(opt).from(printRef.current).save().then(() => { setIsPdfGenerating(false); showToast("PDF 다운로드 완료.", 'success'); });
      } else { setIsPdfGenerating(false); }
    }, 800);
  };

  // currency 인자를 받아 History Quick View에서도 올바른 통화 표시 (기본: quoteInput.currency)
  const formatQuotePrice = (price, currency) => {
    const cur = currency || quoteInput.currency;
    return cur === 'USD' ? `$${usd(price)}` : `￦${num(price)}`;
  };
  const getBasePrice = (item, key) => (item[`basePrice${key}`] ?? item[`price${key}`]) ?? 0;

  const currentCalcFull = calculateCost(fabricInput);
  const uniqueSuppliers = ['All', ...new Set(yarnLibrary.flatMap(y => (y.suppliers || []).map(s => String(s.name).toUpperCase())).filter(Boolean))];
  const dynamicCategories = [...new Set([...(categories || [])])].filter(Boolean);

  const filteredYarns = yarnLibrary.filter(y => {
    const matchCategory = yarnFilterCategory === 'All' || String(y.category || '').toUpperCase() === yarnFilterCategory;
    const matchSupplier = yarnFilterSupplier === 'All' || (y.suppliers || []).some(s => String(s.name || '').toUpperCase() === yarnFilterSupplier);
    const matchSearch = String(y.name || '').toLowerCase().includes(String(yarnSearchTerm || '').toLowerCase()) ||
      String(y.remarks || '').toLowerCase().includes(String(yarnSearchTerm || '').toLowerCase());
    return matchCategory && matchSupplier && matchSearch;
  });

  const filteredFabrics = savedFabrics.filter(fabric =>
    String(fabric.article || '').toLowerCase().includes(String(fabricSearchTerm || '').toLowerCase()) ||
    String(fabric.itemName || '').toLowerCase().includes(String(fabricSearchTerm || '').toLowerCase())
  );

  const uniqueAuthors = ['All', ...new Set(savedQuotes.map(q => String(q.authorName || 'Unknown')))];
  const filteredQuotesList = savedQuotes.filter(q => {
    const matchAuthor = quoteAuthorFilter === 'All' || String(q.authorName || 'Unknown') === quoteAuthorFilter;
    const matchBuyer = quoteBuyerFilter === '' || String(q.buyerName || '').toLowerCase().includes(String(quoteBuyerFilter || '').toLowerCase());
    const matchDate = quoteDateFilter === '' || q.date === quoteDateFilter;
    const matchMarket = quoteMarketFilter === 'All' || q.marketType === quoteMarketFilter;
    return matchAuthor && matchBuyer && matchDate && matchMarket;
  });

  const yarnSelectOptions = yarnLibrary.map(y => {
    const defSup = y.suppliers?.find(s => s.isDefault) || y.suppliers?.[0] || {};
    return { id: y.id, name: `${y.name} [${defSup.name || '기본'}]`, price: defSup.price, currency: defSup.currency };
  });

  const extraMarkup = 1 + (Number(quoteInput.extraMargin) || 0) / 100;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold animate-pulse">GRUBIG 시스템 접속 중...</div>;
  if (!user) return <LoginScreen handleLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row print:bg-white relative">
      <Toast notification={notification} setNotification={setNotification} />

      {/* ✅ 좌측 글로벌 네비게이션 (Sidebar 컴포넌트로 분리) */}
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        syncStatus={syncStatus}
        handleLogout={handleLogout}
        globalExchangeRate={globalExchangeRate}
        setGlobalExchangeRate={setGlobalExchangeRate}
      />

      <div className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-60px)] md:max-h-screen print:p-0 print:overflow-visible relative w-full overflow-x-hidden">

        {/* TAB 1: CALCULATOR */}
        {activeTab === 'calculator' && (
          <CalculatorPage
            editingFabricId={editingFabricId}
            viewMode={viewMode}
            resetFabricForm={resetFabricForm}
            fabricInput={fabricInput}
            handleFabricChange={handleFabricChange}
            currentCalcFull={currentCalcFull}
            yarnSelectOptions={yarnSelectOptions}
            handleYarnSlotChange={handleYarnSlotChange}
            handleNestedChange={handleNestedChange}
            setFabricInput={setFabricInput}
            handleSaveFabric={handleSaveFabric}
            setActiveTab={setActiveTab}
            globalExchangeRate={globalExchangeRate}
          />
        )}

        {/* ✅ TAB 2: LIST (아코디언 카드형 UI 개편) */}
        {activeTab === 'list' && (
          <FabricListPage
            filteredFabrics={filteredFabrics}
            viewMode={viewMode}
            fabricSearchTerm={fabricSearchTerm}
            setFabricSearchTerm={setFabricSearchTerm}
            handleBackupFabrics={handleBackupFabrics}
            setIsBulkModalOpen={setIsBulkModalOpen}
            expandedFabricId={expandedFabricId}
            setExpandedFabricId={setExpandedFabricId}
            calculateCost={calculateCost}
            handleEditFabric={handleEditFabric}
            handleDeleteFabric={handleDeleteFabric}
            setActiveTab={setActiveTab}
            yarnLibrary={yarnLibrary}
            designSheets={designSheets}
            handleEditSheet={handleEditSheet}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
          />
        )}

        {/* YARNS */}
        {activeTab === 'yarns' && (
          <YarnLibraryPage
            filteredYarns={filteredYarns}
            editingYarnId={editingYarnId}
            resetYarnForm={resetYarnForm}
            handleBackupYarns={handleBackupYarns}
            setIsYarnBulkModalOpen={setIsYarnBulkModalOpen}
            yarnInput={yarnInput}
            setYarnInput={setYarnInput}
            dynamicCategories={dynamicCategories}
            handleAddSupplier={handleAddSupplier}
            handleSupplierChange={handleSupplierChange}
            handleDeleteHistoryItem={handleDeleteHistoryItem}
            handleRemoveSupplier={handleRemoveSupplier}
            handleSaveYarn={handleSaveYarn}
            yarnFilterCategory={yarnFilterCategory}
            setYarnFilterCategory={setYarnFilterCategory}
            setIsCategoryModalOpen={setIsCategoryModalOpen}
            yarnSearchTerm={yarnSearchTerm}
            setYarnSearchTerm={setYarnSearchTerm}
            yarnFilterSupplier={yarnFilterSupplier}
            setYarnFilterSupplier={setYarnFilterSupplier}
            uniqueSuppliers={uniqueSuppliers}
            handleEditYarn={handleEditYarn}
            handleDeleteYarn={handleDeleteYarn}
            yarnLibrary={yarnLibrary}
            setYarnLibrary={setYarnLibrary}
            globalExchangeRate={globalExchangeRate}
          />
        )}

        {/* QUOTATION */}
        {activeTab === 'quotation' && (
          <QuotationPage
            quoteInput={quoteInput}
            setQuoteInput={setQuoteInput}
            handleSaveQuote={handleSaveQuote}
            savedQuotes={savedQuotes}
            setSavedQuotes={setSavedQuotes}
            handleDownloadPDF={handleDownloadPDF}
            handleQuoteSettingChange={handleQuoteSettingChange}
            selectedFabricIdForQuote={selectedFabricIdForQuote}
            setSelectedFabricIdForQuote={setSelectedFabricIdForQuote}
            savedFabrics={savedFabrics}
            handleAddFabricToQuote={handleAddFabricToQuote}
            getBasePrice={getBasePrice}
            extraMarkup={extraMarkup}
            handleQuoteBasePriceChange={handleQuoteBasePriceChange}
            formatQuotePrice={formatQuotePrice}
            handleRemoveItemFromQuote={handleRemoveItemFromQuote}
            createQuoteItem={createQuoteItem}
            showToast={showToast}
            handleGridPaste={handleGridPaste}
            globalExchangeRate={globalExchangeRate}
            buyers={buyers}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
          />
        )}

        {/* TAB: 개발 현황 (의뢰 등록 + 진행현황 통합) */}
        {activeTab === 'devStatus' && (
          <DevStatusPage
            devRequests={devRequests}
            designSheets={designSheets}
            devInput={devInput}
            editingDevId={editingDevId}
            handleDevChange={handleDevChange}
            handleSpecChange={handleSpecChange}
            handleSaveDevRequest={handleSaveDevRequest}
            handleEditDevRequest={handleEditDevRequest}
            handleDeleteDevRequest={handleDeleteDevWithCleanup}
            resetDevForm={resetDevForm}
            createDesignSheetFromDev={createDesignSheetFromDev}
            initFromDevRequest={initFromDevRequest}
            updateDevStatus={updateDevStatus}
            handleEditSheet={(sheet) => { handleEditSheet(sheet); setIsDesignSheetModalOpen(true); }}
            handleDeleteSheet={handleDeleteSheet}
            advanceStage={advanceStage}
            advanceToEztex={advanceToEztex}
            autoAdvanceEztex={autoAdvanceEztex}
            dropDesignSheet={dropDesignSheet}
            setActiveTab={setActiveTab}
            user={user}
            buyers={buyers}
            yarnLibrary={yarnLibrary}
            viewMode={viewMode}
            devPrintRef={devPrintRef}
            addMasterItem={addMasterItem}
            generateDevOrderNo={generateDevOrderNo}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
          />
        )}

        {/* TAB: 설계서 작성 (팝업 모달 형태) */}
        {isDesignSheetModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8 overflow-x-hidden">
            <div className="w-full max-w-[1800px] relative bg-transparent mx-auto" onClick={e => e.stopPropagation()}>
              <DesignSheetPage
                mainDetails={mainDetails}
                sheetInput={sheetInput}
                editingSheetId={editingSheetId}
                handleSheetChange={handleSheetChange}
                handleSectionChange={handleSectionChange}
                handleSheetYarnChange={handleSheetYarnChange}
                handleCostInputChange={handleCostInputChange}
                handleCostNestedChange={handleCostNestedChange}
                handleActualDataChange={handleActualDataChange}
                handleSaveSheet={handleSaveSheet}
                handleDeleteSheet={handleDeleteSheet}
                resetSheetForm={resetSheetForm}
                advanceStage={advanceStage}
                getDesignCost={getDesignCost}
                yarnSelectOptions={yarnSelectOptions}
                user={user}
                viewMode={viewMode}
                setActiveTab={(tab) => { if (tab === 'devStatus' || tab === 'designList') setIsDesignSheetModalOpen(false); }}
                globalExchangeRate={globalExchangeRate}
                devRequests={devRequests}
                setSheetInput={setSheetInput}
                linkAndConfirm={linkAndConfirm}
                advanceToEztex={advanceToEztex}
                closeModal={() => setIsDesignSheetModalOpen(false)}
                designSheets={designSheets}
                knittingFactories={knittingFactories}
                dyeingFactories={dyeingFactories}
                machineTypes={machineTypes}
                structures={structures}
                addMasterItem={addMasterItem}
                setActiveMasterModal={setActiveMasterModal}
                savedFabrics={savedFabrics}
                registerFabricFromSheet={registerFabricFromSheet}
              />
            </div>
          </div>
        )}

        {/* TAB: 설계서 목록 */}
        {activeTab === 'designList' && (
          <DesignSheetListPage
            designSheets={designSheets}
            devRequests={devRequests}
            handleEditSheet={(sheet) => { handleEditSheet(sheet); setIsDesignSheetModalOpen(true); }}
            handleDeleteSheet={handleDeleteSheet}
            initFromDevRequest={initFromDevRequest}
            advanceStage={advanceStage}
            getDesignCost={getDesignCost}
            setActiveTab={setActiveTab}
            user={user}
            viewMode={viewMode}
            yarnLibrary={yarnLibrary}
            saveDocToCloud={saveDocToCloud}
            restoreFromDrop={restoreFromDrop}
            dropDesignSheet={dropDesignSheet}
            resetSheetForm={resetSheetForm}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
            setSheetInput={setSheetInput}
          />
        )}

        {activeTab === 'mainDetail' && (
          <MainDetailPage
            mainDetails={mainDetails}
            detailInput={detailInput} setDetailInput={setDetailInput}
            editingDetailId={editingDetailId} setEditingDetailId={setEditingDetailId}
            handleDetailChange={handleDetailChange} handleTestChange={handleTestChange}
            addTest={addTest} removeTest={removeTest}
            handleSaveDetail={handleSaveDetail} handleEditDetail={handleEditDetail}
            handleDeleteDetail={handleDeleteDetail} resetDetailForm={resetDetailForm}
            handleQuickStatusChange={handleQuickStatusChange}
          />
        )}

        {/* TAB 5: HISTORY */}
        {activeTab === 'quoteHistory' && (
          <QuoteHistoryPage
            quoteBuyerFilter={quoteBuyerFilter}
            setQuoteBuyerFilter={setQuoteBuyerFilter}
            quoteDateFilter={quoteDateFilter}
            setQuoteDateFilter={setQuoteDateFilter}
            quoteMarketFilter={quoteMarketFilter}
            setQuoteMarketFilter={setQuoteMarketFilter}
            quoteAuthorFilter={quoteAuthorFilter}
            setQuoteAuthorFilter={setQuoteAuthorFilter}
            uniqueAuthors={uniqueAuthors}
            filteredQuotesList={filteredQuotesList}
            quickViewQuote={quickViewQuote}
            setQuickViewQuote={setQuickViewQuote}
            setQuoteInput={setQuoteInput}
            setActiveTab={setActiveTab}
            handleDownloadPDF={handleDownloadPDF}
            handleDeleteQuote={handleDeleteQuote}
            savedQuotes={savedQuotes}
            setSavedQuotes={setSavedQuotes}
            handleDuplicateQuote={handleDuplicateQuote}
          />
        )}        {/* 모달 3종 (엑셀 업로드 2 + 카테고리 관리) */}
        {isBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원단 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드 (원사정보 포함됨)</p><button onClick={handleDownloadTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} ref={fileInputRef} /></label></div></div></div></div>)}
        {isYarnBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsYarnBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원사 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드</p><button onClick={handleDownloadYarnTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 원사 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleYarnFileUpload} ref={yarnFileInputRef} /></label></div></div></div></div>)}

        {/* Category Manager Modal */}
        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categories}
          editingCategoryOld={editingCategoryOld}
          setEditingCategoryOld={setEditingCategoryOld}
          editingCategoryNew={editingCategoryNew}
          setEditingCategoryNew={setEditingCategoryNew}
          handleSaveCategoryEdit={handleSaveCategoryEdit}
          handleDeleteCategory={handleDeleteCategory}
        />

        {/* Master Data Manager Modal */}
        {activeMasterModal && (
          <MasterDataModal
            isOpen={true}
            onClose={() => setActiveMasterModal(null)}
            title={activeMasterModal.title}
            description={activeMasterModal.description}
            icon={activeMasterModal.icon}
            items={
              activeMasterModal.key === 'knittingFactories' ? knittingFactories :
              activeMasterModal.key === 'dyeingFactories' ? dyeingFactories :
              activeMasterModal.key === 'machineTypes' ? machineTypes :
              activeMasterModal.key === 'structures' ? structures : []
            }
            onAdd={(name) => addMasterItem(activeMasterModal.key, name)}
            onDelete={(name) => removeMasterItem(activeMasterModal.key, name)}
          />
        )}

        {/* Buyer Manager Modal (Reusing MasterDataModal) */}
        <MasterDataModal
          isOpen={isBuyerModalOpen}
          onClose={() => { setIsBuyerModalOpen(false); setEditingBuyerNew(''); }}
          title="바이어 사전 등록 관리"
          description={<span>ℹ️ 이곳에 바이어를 등록해 두면 견적서 작성 시 <b>오타 없이 정확하고 빠르게</b> 바이어를 선택할 수 있습니다.</span>}
          icon={Users}
          items={buyers}
          onAdd={handleSaveBuyer}
          onDelete={handleDeleteBuyer}
        />

        {/* PDF Document */}
        <PDFRenderer
          isPdfGenerating={isPdfGenerating}
          printRef={printRef}
          quoteInput={quoteInput}
          formatQuotePrice={formatQuotePrice}
          getBasePrice={getBasePrice}
          extraMarkup={extraMarkup}
        />
      </div>
    </div>
  );
};

export default App;