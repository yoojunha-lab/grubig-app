import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, FileSpreadsheet, Calculator,
  RotateCcw, Layers, Edit2, Check, X, Box, Search, ChevronDown, ChevronUp,
  TrendingUp, Users, Factory, FileText, Calendar, Upload,
  Globe, Home, DollarSign, History, AlertCircle, Info, Filter, Truck, Download,
  Cloud, LogOut, Database, ClipboardPaste, Menu, Eye, Settings
} from 'lucide-react';

// 🔥 Firebase 모듈 (서비스 레이어 연동)
import { onSnapshot, collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged, signOut, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { db, auth, googleProvider } from '../services/firebase';
import { saveDocument, deleteDocument, saveBatchDocuments, updateYarnCategoryBatch } from '../services/db';

// ⚙️ 공통 상수 & 유틸리티 연동
import { ALLOWED_DOMAIN, DEFAULT_YARN_CATEGORIES, MARGIN_TIERS } from '../constants/common';
import { DEV_SAMPLE_FABRICS, DEV_SAMPLE_YARNS, DEV_SAMPLE_DEV_REQUESTS, DEV_SAMPLE_DESIGN_SHEETS } from '../constants/devSamples';
import { useXLSX, useHTML2PDF } from '../hooks/useExternalScripts';

// ⚓️ 도메인 로직 훅 연동
import { useFabric } from '../hooks/domains/useFabric';
import { useYarn } from '../hooks/domains/useYarn';
import { useQuotation } from '../hooks/domains/useQuotation';
import { useDevRequest } from '../hooks/domains/useDevRequest';
import { useDesignSheet } from '../hooks/domains/useDesignSheet';
import { useMainDetail } from '../hooks/domains/useMainDetail';
import { useTempDesignSheet } from '../hooks/domains/useTempDesignSheet';
import { useOrder } from '../hooks/domains/useOrder';
import { useCollection } from '../hooks/domains/useCollection';
import { useProformaInvoice } from '../hooks/domains/useProformaInvoice';
import { usePartner } from '../hooks/domains/usePartner';
import { useLabdip } from '../hooks/domains/useLabdip';
import { makeChangeLogEntry, appendChangeLog, summarizeBatchDiff } from '../utils/auditLog';
import { PROCESS_TYPES } from '../constants/production';
import { calcQuotePrice, getQuoteValidUntil } from '../utils/helpers';

// 🧩 공통 / 레이아웃 UI 컴포넌트
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Toast } from '../components/common/Toast';
import { Sidebar } from '../components/layout/Sidebar';
import { LoginScreen } from '../components/layout/LoginScreen';
import { MasterDataModal } from '../components/common/MasterDataModal';
import { CategoryModal } from '../components/common/CategoryModal';

// 📄 도메인 뷰 (페이지) 컴포넌트
import { FabricWorkspacePage } from '../pages/FabricWorkspacePage';
import { YarnLibraryPage } from '../pages/YarnLibraryPage';
import { QuotationWorkspacePage } from '../pages/QuotationWorkspacePage';
import { PDFRenderer } from '../components/quote/PDFRenderer';
import { DesignSheetPage } from '../pages/DesignSheetPage';
import { DesignSheetListPage } from '../pages/DesignSheetListPage';
import { DevStatusPage } from '../pages/DevStatusPage';
import { MainDetailPage } from '../pages/MainDetailPage';
import { TempDesignSheetListPage } from '../pages/TempDesignSheetListPage';
import { OrderWizardPage } from '../pages/OrderWizardPage';
import { OrderListPage } from '../pages/OrderListPage';
import { ReportPage } from '../pages/ReportPage';
import { CollectionPage } from '../pages/CollectionPage';
import { OrderDetailModal } from '../components/order/OrderDetailModal';
import { ProformaInvoicePage } from '../pages/ProformaInvoicePage';
import { PIPrintSheet } from '../components/pi/PIPrintSheet';
import { PISettingsModal } from '../components/pi/PISettingsModal';
import { LabdipPage } from '../pages/LabdipPage';
import { LabdipPrintSheet } from '../components/labdip/LabdipPrintSheet';

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('list');
  // 견적서 등 편집 중 변경사항 이탈 가드 (상단 네비 클릭 시 QuotationWorkspacePage가 등록한 가드 통과)
  const navGuardRef = useRef(null);
  const requestSetActiveTab = (tab) => {
    const go = () => setActiveTab(tab);
    const guard = navGuardRef.current;
    if (guard) guard(go); else go();
  };
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
  const [tempDesignSheets, setTempDesignSheets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [collections, setCollections] = useState([]);
  const [proformaInvoices, setProformaInvoices] = useState([]);
  const [selectedPIForPrint, setSelectedPIForPrint] = useState(null);
  const [piSettings, setPiSettings] = useState(null);            // PI 은행정보/약관 설정 (settings/general.piSettings)
  const [isPISettingsOpen, setIsPISettingsOpen] = useState(false);
  const [labdips, setLabdips] = useState([]);
  const [selectedLabdipForPrint, setSelectedLabdipForPrint] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnersLoaded, setPartnersLoaded] = useState(false); // partners 스냅샷 최초 도착 여부 (seed 경쟁 조건 방지)

  // 마스터 데이터 (settings/general에 배열로 저장)
  const [knittingFactories, setKnittingFactories] = useState([]);
  const [dyeingFactories, setDyeingFactories] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [structures, setStructures] = useState([]);
  const [yarnSuppliers, setYarnSuppliers] = useState([]); // 원사 업체(공급처) 마스터 — 견적 거래처(partners)와 완전 분리
  const [settingsLoaded, setSettingsLoaded] = useState(false); // settings/general 최초 도착 여부 (원사 업체 seed 경쟁조건 방지)
  const [yarnsLoaded, setYarnsLoaded] = useState(false);       // yarns 스냅샷 최초 도착 여부
  const yarnSuppliersSeededRef = useRef(false);                // 원사 업체 마스터 1회 백필 가드

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [viewMode, setViewMode] = useState('domestic');
  const [yarnFilterCategory, setYarnFilterCategory] = useState('All');
  const [yarnFilterSupplier, setYarnFilterSupplier] = useState('All');
  const [yarnPage, setYarnPage] = useState(0); // 원사 목록 페이지네이션 (0-base)

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
  const [isTempDesignSheetModalOpen, setIsTempDesignSheetModalOpen] = useState(false);

  const printRef = useRef(null);
  const fileInputRef = useRef(null);
  const yarnFileInputRef = useRef(null);
  const isXlsxReady = useXLSX();
  const isPdfReady = useHTML2PDF();

  // ── [DEV 검증 전용] 가짜 로그인 + 인메모리 데이터 모드 ─────────────────────
  // 개발 빌드(import.meta.env.DEV)이고 localStorage('grubig_dev_bypass')==='1'일 때만 활성.
  // 프로덕션 빌드(vite build)에선 import.meta.env.DEV===false → 아래 분기 전부 죽은 코드로 제거됨.
  // 실제 Firestore/운영 데이터는 일절 건드리지 않음.
  const DEV_BYPASS = import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('grubig_dev_bypass') === '1';

  useEffect(() => {
    if (DEV_BYPASS) {
      setUser({ email: 'dev@grubig.kr', uid: 'dev-bypass', displayName: 'DEV 검증용' });
      setAuthLoading(false);
      return; // 실제 Firebase 인증 구독 건너뜀
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email.endsWith(ALLOWED_DOMAIN)) setUser(currentUser);
      else if (currentUser) { alert("접근 불가: grubig.kr 계정이 아닙니다."); signOut(auth); }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => signInWithPopup(auth, googleProvider);
  const handleEmailLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(`로그인 실패: ${err.code || err.message}`);
    }
  };
  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user) return;
    if (DEV_BYPASS) {
      // Firestore 구독 대신 격리 샘플 데이터 주입 (collections는 빈 상태에서 UI로 생성)
      setYarnLibrary(DEV_SAMPLE_YARNS);
      setSavedFabrics(DEV_SAMPLE_FABRICS);
      setDevRequests(DEV_SAMPLE_DEV_REQUESTS);
      setDesignSheets(DEV_SAMPLE_DESIGN_SHEETS);
      setSyncStatus('saved');
      return; // 실제 Firestore 구독 건너뜀
    }
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      setSettingsLoaded(true);
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.yarnCategories) setCategories(d.yarnCategories);
        // 모든 마스터 배열은 명시적으로 세팅 (필드 누락 시 [] 폴백 — 이전엔 누락이면 setBuyers 미호출)
        setBuyers(Array.isArray(d.buyers) ? d.buyers : []);
        setKnittingFactories(Array.isArray(d.knittingFactories) ? d.knittingFactories : []);
        setDyeingFactories(Array.isArray(d.dyeingFactories) ? d.dyeingFactories : []);
        setMachineTypes(Array.isArray(d.machineTypes) ? d.machineTypes : []);
        setStructures(Array.isArray(d.structures) ? d.structures : []);
        setYarnSuppliers(Array.isArray(d.yarnSuppliers) ? d.yarnSuppliers : []);
        setPiSettings(d.piSettings || null);                     // PI 은행/약관 설정
      } else {
        // 문서가 없을 때만 yarnCategories만 시드 — 마스터 배열은 비워둠 (실제 추가될 때 자동 생성됨)
        // 빈 배열로 시드하면 만약 콘솔 등에서 doc 재삭제 후 이 코드가 다시 돌면 데이터 영구 손실 위험
        setDoc(doc(db, 'settings', 'general'), { yarnCategories: DEFAULT_YARN_CATEGORIES }, { merge: true });
      }
    });
    const unsubYarns = onSnapshot(collection(db, 'yarns'), (snapshot) => {
      setYarnLibrary(snapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.suppliers) return { ...data, suppliers: [{ id: 'sup_legacy', name: data.supplier || '기본업체', currency: data.currency || 'KRW', price: data.price || 0, tariff: data.tariff || 0, freight: data.freight || 0, history: data.history || [], isDefault: true }] };
        return data;
      }));
      setYarnsLoaded(true);
    });
    const unsubFabrics = onSnapshot(collection(db, 'fabrics'), (snapshot) => setSavedFabrics(snapshot.docs.map(doc => doc.data())));
    const unsubQuotes = onSnapshot(collection(db, 'quotes'), (snapshot) => { setSavedQuotes(snapshot.docs.map(doc => doc.data())); setSyncStatus('saved'); });
    const unsubDevReqs = onSnapshot(collection(db, 'devRequests'), (snapshot) => setDevRequests(snapshot.docs.map(doc => doc.data())));
    const unsubDesignSheets = onSnapshot(collection(db, 'designSheets'), (snapshot) => setDesignSheets(snapshot.docs.map(doc => doc.data())));
    const unsubMainDetails = onSnapshot(collection(db, 'mainDetails'), (snapshot) => setMainDetails(snapshot.docs.map(doc => doc.data())));
    // 가설계서(레시피) 컬렉션 구독 — 기존 designSheets와 완전 분리
    const unsubTempDesignSheets = onSnapshot(collection(db, 'tempDesignSheets'), (snapshot) => setTempDesignSheets(snapshot.docs.map(doc => doc.data())));
    // 생산 오더 컬렉션 구독
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => setOrders(snapshot.docs.map(doc => doc.data())));
    // 영업 컬렉션(아티클 묶음) 구독
    const unsubCollections = onSnapshot(collection(db, 'collections'), (snapshot) => setCollections(snapshot.docs.map(doc => doc.data())));
    // 영업 PI/거래확인서 구독
    const unsubPIs = onSnapshot(collection(db, 'proformaInvoices'), (snapshot) => setProformaInvoices(snapshot.docs.map(doc => doc.data())));
    // Lab-Dip 발송 기록 구독
    const unsubLabdips = onSnapshot(collection(db, 'labdips'), (snapshot) => setLabdips(snapshot.docs.map(doc => doc.data())));
    // 거래처(Partner) 구독
    const unsubPartners = onSnapshot(collection(db, 'partners'), (snapshot) => { setPartners(snapshot.docs.map(doc => doc.data())); setPartnersLoaded(true); });
    return () => { unsubSettings(); unsubYarns(); unsubFabrics(); unsubQuotes(); unsubDevReqs(); unsubDesignSheets(); unsubMainDetails(); unsubTempDesignSheets(); unsubOrders(); unsubCollections(); unsubPIs(); unsubLabdips(); unsubPartners(); };
  }, [user]);

  // 원사 검색/필터가 바뀌면 목록을 1페이지로 되돌림
  useEffect(() => { setYarnPage(0); }, [yarnSearchTerm, yarnFilterCategory, yarnFilterSupplier]);

  // 원사 업체(공급처) 마스터 최초 1회 백필: 기존 원사들에 쓰인 공급처 이름을 마스터가 비어있을 때만 자동 등록
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (yarnSuppliersSeededRef.current) return;
    if (!settingsLoaded || !yarnsLoaded) return;          // 두 스냅샷 모두 도착 후에만 판단 (race 방지)
    yarnSuppliersSeededRef.current = true;                // 세션당 1회만 시도
    if ((yarnSuppliers || []).length > 0) return;         // 이미 관리 목록이 있으면 건드리지 않음
    const names = new Set();
    (yarnLibrary || []).forEach(y => (y.suppliers || []).forEach(s => {
      const u = String(s.name || '').trim().toUpperCase();
      if (u) names.add(u);
    }));
    const toSeed = [...names];
    if (toSeed.length === 0) return;
    setDoc(doc(db, 'settings', 'general'), { yarnSuppliers: arrayUnion(...toSeed) }, { merge: true })
      .catch(e => console.error('원사 업체 자동등록 실패', e));
  }, [settingsLoaded, yarnsLoaded, yarnSuppliers, yarnLibrary]);

  // DEV 우회 시 Firestore 대신 로컬 state만 갱신하기 위한 컬렉션명 → setter 매핑
  const DEV_LOCAL_SETTERS = {
    collections: setCollections, fabrics: setSavedFabrics, yarns: setYarnLibrary,
    quotes: setSavedQuotes, devRequests: setDevRequests, designSheets: setDesignSheets,
    mainDetails: setMainDetails, tempDesignSheets: setTempDesignSheets, orders: setOrders,
    proformaInvoices: setProformaInvoices, labdips: setLabdips, partners: setPartners,
  };
  const saveDocToCloud = async (colName, item) => {
    if (DEV_BYPASS) {
      const setter = DEV_LOCAL_SETTERS[colName];
      if (setter) setter(prev => [...prev.filter(x => String(x.id) !== String(item.id)), item]);
      setSyncStatus('saved');
      return true;
    }
    // 성공 시 true / 실패 시 false 반환 — 호출자가 저장 성공 여부에 따라 후처리(폼 리셋·모달 닫기 등)를 분기할 수 있도록 함
    setSyncStatus('syncing');
    try { await saveDocument(colName, item); setSyncStatus('saved'); return true; }
    catch (e) { setSyncStatus('error'); showToast(`저장 실패: ${e?.message || '네트워크 오류'}`, "error"); return false; }
  };
  const deleteDocFromCloud = async (colName, id) => {
    if (DEV_BYPASS) {
      const setter = DEV_LOCAL_SETTERS[colName];
      if (setter) setter(prev => prev.filter(x => String(x.id) !== String(id)));
      setSyncStatus('saved');
      return;
    }
    setSyncStatus('syncing'); try { await deleteDocument(colName, id); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("삭제 실패", "error"); }
  };
  // 일괄 저장: 성공 true / 실패 false 반환 (호출자가 후처리 분기 가능)
  const saveBatchToCloud = async (colName, items) => {
    setSyncStatus('syncing');
    try {
      await saveBatchDocuments(colName, items);
      setSyncStatus('saved');
      return true;
    } catch (e) {
      setSyncStatus('error');
      showToast(`일괄 저장 실패: ${e.message || '네트워크 오류'}`, 'error');
      return false;
    }
  };

  const showToast = (message, type = 'success') => { setNotification({ show: true, message, type }); setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000); };

  // 마스터 데이터 등록/삭제 공용 함수 (settings/general 문서의 배열 필드)
  // arrayUnion/arrayRemove 원자 연산 사용 — 로컬 state에 의존하지 않아 race/오버라이트 안전
  const addMasterItem = async (field, name) => {
    const trimmed = String(name).trim();
    if (!trimmed) { showToast('이름을 입력해주세요.', 'error'); return false; }
    const currentMap = { buyers, knittingFactories, dyeingFactories, machineTypes, structures, yarnSuppliers };
    const current = currentMap[field] || [];
    if (current.includes(trimmed)) { showToast('이미 등록된 항목입니다.', 'error'); return false; }
    try {
      await setDoc(doc(db, 'settings', 'general'), { [field]: arrayUnion(trimmed) }, { merge: true });
      showToast(`'${trimmed}' 등록 완료`, 'success');
      return true;
    } catch (e) {
      showToast(`등록 실패: ${e.message}`, 'error');
      return false;
    }
  };
  const removeMasterItem = async (field, name) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), { [field]: arrayRemove(name) }, { merge: true });
      showToast(`'${name}' 삭제됨`, 'success');
    } catch (e) {
      showToast(`삭제 실패: ${e.message}`, 'error');
    }
  };

  // ⚓️ 커스텀 도메인 훅 사용
  const {
    fabricInput, setFabricInput, editingFabricId, expandedFabricId, setExpandedFabricId,
    handleFabricChange, handleNestedChange, handleYarnSlotChange,
    handleSaveFabric, handleEditFabric, handleDeleteFabric, resetFabricForm, calculateCost, getMergedYarnName
  } = useFabric(yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate, savedQuotes);

  const {
    yarnInput, setYarnInput, editingYarnId,
    handleSaveYarn, handleEditYarn, handleDeleteYarn, resetYarnForm,
    handleAddSupplier, handleRemoveSupplier, handleSupplierChange, handleDeleteHistoryItem
  } = useYarn(yarnLibrary, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast, designSheets);

  const {
    quoteInput, setQuoteInput, handleQuoteSettingChange, createQuoteItem,
    handleQuoteMarginChange, handleBulkMarginRateChange, handleQuoteItemMarginChange,
    handleAddFabricToQuote, handleGridPaste,
    handleRemoveItemFromQuote, handleNewQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  } = useQuotation(savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate, setGlobalExchangeRate);

  // ⚓️ 설계서 시스템 훅
  const {
    devInput, setDevInput, editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, linkAndConfirm
  } = useDevRequest(devRequests, saveDocToCloud, deleteDocFromCloud, showToast, designSheets);

  // 아이템화 시 원단 자동 등록용 함수
  const saveFabricFromSheet = (fabricData) => {
    saveDocToCloud('fabrics', fabricData);
  };

  const {
    sheetInput, setSheetInput, editingSheetId,
    handleSheetChange, handleSectionChange,
    handleSheetYarnChange, handleCostInputChange,
    handleSaveSheet, handleEditSheet, handleDeleteSheet,
    resetSheetForm, setStage, setSamplingSub,
    linkSheetToDevRequest, unlinkSheetFromDevRequest,
    addOrderNumber, removeOrderNumber,
    getDesignCost, initFromDevRequest, dropDesignSheet, restoreFromDrop,
    registerFabricFromSheet
  } = useDesignSheet(designSheets, savedFabrics, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate, saveFabricFromSheet, devRequests);

  // ⚓️ 메인 디테일 훅
  const {
    detailInput, setDetailInput, editingDetailId, setEditingDetailId,
    handleDetailChange, handleTestChange, addTest, removeTest,
    handleSaveDetail, handleEditDetail, handleDeleteDetail, resetDetailForm,
    handleQuickStatusChange, handleBulkPaste
  } = useMainDetail(mainDetails, saveDocToCloud, deleteDocFromCloud, showToast);

  // ⚓️ 가설계서(레시피) 전용 훅 — 기존 useDesignSheet와 완전 독립
  const {
    tempInput, setTempInput, editingTempId,
    handleTempChange, handleTempSectionChange,
    handleTempYarnChange, handleTempCostInputChange, handleTempCostNestedChange,
    handleSaveTemp, handleEditTemp, handleDeleteTemp,
    resetTempForm, getTempDesignCost, loadTempToSheet, loadSheetToTemp
  } = useTempDesignSheet(tempDesignSheets, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost);

  // ⚓️ 생산 오더(스케줄) 훅 — v3
  const {
    orderInput, setOrderInput,
    editingOrderId,
    selectedOrderId, setSelectedOrderId,
    handleOrderChange, setOrderType,
    addColor, removeColor, updateColor,
    toggleProcess, updateProcessField, updateProcessSchedule,
    addBatch, removeBatch, updateBatchField, updateBatchColors,
    addYarnOrder, removeYarnOrder, updateYarnOrder,
    toggleYarnOrderKnitterStock, setAllYarnOrdersKnitterStock,
    addDelivery, removeDelivery, updateDelivery,
    handleSaveOrder, handleEditOrder, handleDeleteOrder,
    resetOrderForm,
    applyFabricTemplate, detachFabric,
  } = useOrder(orders, saveDocToCloud, deleteDocFromCloud, showToast);

  // ⚓️ 컬렉션(영업) 훅 — 아티클(원단) 묶음 관리
  const {
    collectionInput, editingCollectionId,
    handleCollectionChange, resetCollectionForm,
    handleSaveCollection, handleEditCollection, handleDeleteCollection,
    addArticlesToCollection, removeArticleFromCollection,
    updateArticleMemo, moveArticle,
  } = useCollection(collections, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast);

  // ⚓️ PI/거래확인서(영업) 훅
  const {
    piInput, setPIInput, editingPIId,
    resetPIForm, handlePIChange, setMarketType,
    generatePINo, handleNewPI,
    addPIItem, removePIItem, handleItemChange, addItemFromFabric,
    handleSavePI, handleEditPI, handleDuplicatePI, handleDeletePI,
  } = useProformaInvoice(proformaInvoices, saveDocToCloud, deleteDocFromCloud, showToast, user);

  // ⚓️ Lab-Dip(랩딥 발송) 훅  (addColor 등은 기존 설계서 훅과 이름이 겹쳐 별칭 사용)
  const {
    labdipInput, setLabdipInput, editingLabdipId,
    resetLabdipForm, handleLabdipChange,
    addColor: addLabdipColor, removeColor: removeLabdipColor, updateColor: updateLabdipColor,
    handleSaveLabdip, handleEditLabdip, handleDuplicateLabdip, handleDeleteLabdip,
  } = useLabdip(labdips, saveDocToCloud, deleteDocFromCloud, showToast, user);

  // ⚓️ 거래처(Partner) 훅 — 모든 거래처 선택/등록 공통
  const { makeEmptyPartner, savePartner, deletePartner } =
    usePartner(partners, buyers, saveDocToCloud, saveBatchToCloud, deleteDocFromCloud, showToast, partnersLoaded);
  // 거래처 선택 필드/모달에 넘길 공통 묶음 (견적/PI/개발/오더 공용)
  const partnerBag = { partners, savePartner, deletePartner, makeEmptyPartner };

  // PI 인쇄 (견적/컬렉션과 동일한 native window.print() 방식, body.printing-pi 토글)
  const handlePrintPI = (targetPI = null) => {
    const pi = (targetPI && targetPI.id) ? targetPI : piInput;
    if (!pi || !(pi.items || []).some(it => String(it.article).trim() || String(it.description).trim() || Number(it.qty) > 0)) {
      showToast('인쇄할 품목이 없습니다.', 'error');
      return;
    }
    setSelectedPIForPrint(pi); // 인쇄 대상 확정 (PIPrintSheet 렌더)
    showToast("인쇄 다이얼로그에서 '대상 = PDF로 저장'을 선택해 주세요.", 'info');
    const oldTitle = document.title;
    const safeNo = String(pi.piNo || 'PI').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'PI';
    document.body.classList.add('printing-pi');
    setTimeout(() => {
      try {
        document.title = safeNo;
        window.print();
      } finally {
        document.title = oldTitle;
        document.body.classList.remove('printing-pi');
      }
    }, 200);
  };

  // Lab-Dip 인쇄 (PI/컬렉션과 동일한 native window.print() 방식, body.printing-labdip 토글)
  const handlePrintLabdip = (targetLabdip = null) => {
    const t = (targetLabdip && (targetLabdip.id || targetLabdip.colors)) ? targetLabdip : labdipInput;
    const hasColor = (t.colors || []).some(c => String(c.name || '').trim() || String(c.baseNo || '').trim());
    if (!hasColor) { showToast('인쇄할 컬러가 없습니다.', 'error'); return; }
    setSelectedLabdipForPrint(t); // 인쇄 대상 확정 (LabdipPrintSheet 렌더)
    showToast("인쇄 다이얼로그에서 '대상 = PDF로 저장'을 선택해 주세요.", 'info');
    const oldTitle = document.title;
    const safeName = `LABDIP_${String(t.buyerName || '').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim()}_${String(t.article || '').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim()}`.replace(/_+$/,'') || 'LABDIP';
    document.body.classList.add('printing-labdip');
    setTimeout(() => {
      try {
        document.title = safeName;
        window.print();
      } finally {
        document.title = oldTitle;
        document.body.classList.remove('printing-labdip');
      }
    }, 200);
  };

  // PI 설정(은행정보/약관) 저장 — settings/general.piSettings 에 merge (DEV 우회 시 로컬만)
  const savePISettings = async (next) => {
    setPiSettings(next); // 낙관적 반영 (DEV 우회 모드에서도 즉시 화면 반영)
    if (DEV_BYPASS) { setSyncStatus('saved'); return; }
    setSyncStatus('syncing');
    try {
      await setDoc(doc(db, 'settings', 'general'), { piSettings: next }, { merge: true });
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
      showToast(`PI 설정 저장 실패: ${e?.message || '네트워크 오류'}`, 'error');
    }
  };

  // PI 엑셀 내보내기 (품목표 중심 — 화면 폼 또는 보관함 문서)
  const handleDownloadPIExcel = (targetPI = null) => {
    if (!isXlsxReady || !window.XLSX) { showToast('엑셀 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error'); return; }
    const pi = (targetPI && targetPI.id) ? targetPI : piInput;
    const items = (pi.items || []).filter(it => String(it.article).trim() || String(it.description).trim() || Number(it.qty) > 0);
    if (items.length === 0) { showToast('내용이 없습니다.', 'error'); return; }
    const isExport = pi.marketType !== 'domestic';
    const cur = isExport ? 'USD' : 'KRW';
    const rows = items.map((it, idx) => ({
      'No': idx + 1,
      '품번': it.article || '',
      '사양': it.description || '',
      '컬러': it.color || '',
      '수량': Number(it.qty) || 0,
      '단위': it.unit || '',
      [`단가(${cur})`]: Number(it.unitPrice) || 0,
      [`금액(${cur})`]: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    }));
    const meta = [
      [isExport ? 'GRUBIG PROFORMA INVOICE' : 'GRUBIG 거래확인서'],
      [`${isExport ? 'P/I No.' : '문서번호'}: ${pi.piNo || ''}    ${isExport ? 'Buyer' : '바이어'}: ${pi.buyerCompany || ''}`],
      [`${isExport ? 'Date' : '발행일'}: ${pi.date || ''}    ${isExport ? 'Currency' : '통화'}: ${cur}`],
      [],
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(meta);
    window.XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5' });
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 40 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, isExport ? 'PI' : '거래확인서');
    const safeNo = String(pi.piNo || 'PI').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'PI';
    window.XLSX.writeFile(wb, `${safeNo}.xlsx`);
    showToast(`${rows.length}개 품목을 엑셀로 내보냈습니다.`, 'success');
  };

  // 오더 상세 모달 열 때 특정 차수에 포커스 (펼침/스크롤/하이라이트)
  const [orderModalFocus, setOrderModalFocus] = useState(null); // { processType, batchId } | null
  const openOrderDetail = (orderId, processType = null, batchId = null) => {
    setSelectedOrderId(orderId);
    setOrderModalFocus(processType && batchId ? { processType, batchId } : null);
  };
  const closeOrderDetail = () => {
    setSelectedOrderId(null);
    setOrderModalFocus(null);
  };

  // 오더 상세 → [전체 편집] 클릭 시 마법사로 이동
  const handleEditOrderToWizard = (order) => {
    handleEditOrder(order);
    closeOrderDetail();
    setActiveTab('orderWizard');
  };

  // 상세 모달의 공정 아코디언에서 [+ 차수 추가]
  // 새 차수를 Firestore에 즉시 저장 (인라인 편집은 OrderDetailModal에서 처리)
  // 추가된 차수의 ID 반환 → 호출 측에서 자동 펼침
  const handleAddBatchToOrder = async (orderId, processType) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return null;
    const proc = (order.processes || []).find(p => p.processType === processType);
    if (!proc) return null;

    const nextNum = (proc.batches || []).length + 1;
    // batchLabel은 폐기됨 — 표시용은 batchNumber로 자동 "N차"
    const newBatch = {
      id: `batch_${processType}_${Date.now()}_${nextNum}`,
      batchNumber: nextNum,
      batchType: 'sequential',
      quantity: 0,
      colors: [],
      plannedStartDate: '',
      plannedEndDate: '',
      actualEndDate: '',
      status: 'pending',
      reworkEvents: [],
      delayReason: '',
      notes: '',
    };

    const procLabel = PROCESS_TYPES.find(p => p.key === processType)?.label || processType;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p =>
        p.processType === processType
          ? { ...p, batches: [...(p.batches || []), newBatch] }
          : p
      ),
      updatedAt: new Date().toISOString(),
    };
    const newLabel = `${newBatch.batchNumber}차`;
    // 감사 로그 기록
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_create', `${procLabel} ${newLabel} 차수 추가`)
    );

    await saveDocToCloud('orders', updatedOrder);
    showToast(`${newLabel} 추가됨`, 'success');
    return newBatch.id;
  };

  // 상세 모달의 차수 row에서 [🗑] 삭제
  const handleDeleteBatchFromOrder = async (orderId, processType, batchId) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    const proc = (order.processes || []).find(p => p.processType === processType);
    const batch = (proc?.batches || []).find(b => b.id === batchId);
    if (!batch) return;
    const bLabel = batch.batchLabel || `${batch.batchNumber || ''}차`;
    if (!window.confirm(`${bLabel} 차수를 삭제하시겠어요?\n메모/일정 등 입력한 내용도 함께 사라집니다.`)) return;

    const procLabel = PROCESS_TYPES.find(p => p.key === processType)?.label || processType;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== processType) return p;
        return { ...p, batches: (p.batches || []).filter(b => b.id !== batchId) };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_delete', `${procLabel} ${bLabel} 차수 삭제`)
    );

    await saveDocToCloud('orders', updatedOrder);
    showToast(`${bLabel} 삭제됨`, 'success');
  };

  // 인라인 편집한 차수 1건만 patch (전체 order 저장)
  const handleSaveBatch = async (orderId, processType, batchId, draftBatch) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;

    // 변경 diff 추출 (감사 로그용)
    const oldBatch = (order.processes || [])
      .find(p => p.processType === processType)?.batches
      ?.find(b => b.id === batchId);
    const procLabel = PROCESS_TYPES.find(p => p.key === processType)?.label || processType;
    const diffResult = summarizeBatchDiff(oldBatch, draftBatch, procLabel);

    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== processType) return p;
        return {
          ...p,
          batches: (p.batches || []).map(b =>
            b.id === batchId ? { ...draftBatch } : b
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    };

    // 변경이 있을 때만 changeLog 기록 (이전과 동일하면 스킵)
    if (diffResult) {
      updatedOrder = appendChangeLog(
        updatedOrder,
        makeChangeLogEntry(user?.email, 'batch_update', diffResult.summary, diffResult.diff)
      );
    }

    await saveDocToCloud('orders', updatedOrder);
    showToast(`${draftBatch.batchLabel || `${draftBatch.batchNumber || ''}차` || '차수'} 저장됨`, 'success');
  };

  // ============================================================
  // 원사 공정 인라인 편집 핸들러
  // (사종 자체 추가/삭제는 ART(원단) 선택 시에만 일어남 — 여기선 토글/필드/입고차수만)
  // ============================================================

  // yarnOrder 1건의 필드를 patch (총수량/공급처 등)
  const handleSaveYarnOrder = async (orderId, yoId, draftYO) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo => yo.id === yoId ? { ...draftYO } : yo),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_update', `원사 발주 ${draftYO.yarnTypeName || ''} 수정`)
    );
    await saveDocToCloud('orders', updatedOrder);
  };

  // 편직처 보유 원사 토글 (체크 시 deliveries/supplier 무력화 — UI에서만 숨김, 데이터는 보존)
  const handleToggleYarnKnitterStock = async (orderId, yoId, value) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(yo =>
            yo.id === yoId ? { ...yo, useKnitterStock: !!value } : yo
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_update', `원사 ${value ? '편직처 보유 사용' : '발주 진행'} 전환`)
    );
    await saveDocToCloud('orders', updatedOrder);
  };

  // 입고 차수 추가
  const handleAddYarnDelivery = async (orderId, yoId) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    const yo = (order.processes || []).find(p => p.processType === 'yarn')
      ?.yarnOrders?.find(y => y.id === yoId);
    if (!yo) return;
    const nextNum = (yo.deliveries || []).length + 1;
    const newDelivery = {
      id: `dv_${yoId}_${Date.now()}_${nextNum}`,
      deliveryNumber: nextNum,
      quantity: 0,
      plannedArrivalDate: '',
      expectedArrivalDate: '',
      actualArrivalDate: '',
      status: '발주대기',
    };
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(y =>
            y.id === yoId ? { ...y, deliveries: [...(y.deliveries || []), newDelivery] } : y
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_create', `원사 ${yo.yarnTypeName || ''} ${nextNum}차 입고 추가`)
    );
    await saveDocToCloud('orders', updatedOrder);
    showToast(`${nextNum}차 입고 추가됨`, 'success');
  };

  // 입고 차수 삭제
  const handleDeleteYarnDelivery = async (orderId, yoId, dvId) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    const yo = (order.processes || []).find(p => p.processType === 'yarn')
      ?.yarnOrders?.find(y => y.id === yoId);
    const dv = (yo?.deliveries || []).find(d => d.id === dvId);
    if (!dv) return;
    if (!window.confirm(`${dv.deliveryNumber}차 입고를 삭제하시겠어요?`)) return;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(y =>
            y.id === yoId ? { ...y, deliveries: (y.deliveries || []).filter(d => d.id !== dvId) } : y
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_delete', `원사 ${yo?.yarnTypeName || ''} ${dv.deliveryNumber}차 입고 삭제`)
    );
    await saveDocToCloud('orders', updatedOrder);
    showToast(`${dv.deliveryNumber}차 입고 삭제됨`, 'success');
  };

  // 입고 차수 1건 patch (수량/날짜/상태)
  const handleSaveYarnDelivery = async (orderId, yoId, dvId, draftDv) => {
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;
    let updatedOrder = {
      ...order,
      processes: (order.processes || []).map(p => {
        if (p.processType !== 'yarn') return p;
        return {
          ...p,
          yarnOrders: (p.yarnOrders || []).map(y => {
            if (y.id !== yoId) return y;
            return {
              ...y,
              deliveries: (y.deliveries || []).map(d => d.id === dvId ? { ...draftDv } : d),
            };
          }),
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    updatedOrder = appendChangeLog(
      updatedOrder,
      makeChangeLogEntry(user?.email, 'batch_update', `원사 입고 ${draftDv.deliveryNumber || ''}차 수정`)
    );
    await saveDocToCloud('orders', updatedOrder);
  };

  // 원단 선택 시 yarnLibrary도 같이 참조해서 사종명 매칭
  const handleApplyFabricToOrder = (fabricId) => {
    const fabric = (savedFabrics || []).find(f => f.id === fabricId);
    if (!fabric) {
      showToast('선택한 원단을 찾을 수 없습니다.', 'error');
      return;
    }
    applyFabricTemplate(fabric, yarnLibrary);
  };

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
    reader.onload = async (evt) => {
      try {
        const ws = window.XLSX.read(evt.target.result, { type: 'binary' }).Sheets[window.XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws, { header: 0 });
        if (data.length === 0) { showToast('데이터가 없습니다.', 'error'); return; }

        const newFabrics = []; let missingYarnNames = new Set();
        // [중복 차단] 기존 원단 + 이번 업로드 내 중복 Article 모두 건너뜀 (대소문자/공백 무시)
        const existingArticleKeys = new Set((savedFabrics || []).map(f => String(f.article || '').trim().toUpperCase()));
        const batchArticleKeys = new Set();
        let dupSkipped = 0;
        data.forEach((row, idx) => {
          if (!row.Article) return;
          const artKey = String(row.Article).trim().toUpperCase();
          if (existingArticleKeys.has(artKey) || batchArticleKeys.has(artKey)) { dupSkipped++; return; }
          batchArticleKeys.add(artKey);
          const kFee1k = Number(row.KnittingFee1k) || 3000;
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

        // 유효 신규 건이 없으면 (전부 중복/빈값) 저장하지 않고 안내
        if (newFabrics.length === 0) {
          showToast(dupSkipped > 0 ? `모든 행이 중복 Article이라 등록하지 않았습니다. (${dupSkipped}건)` : '등록할 데이터가 없습니다.', 'error');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // 저장 성공 여부 확인 후 UI 후처리 (await 누락으로 거짓 성공 방지)
        const ok = await saveBatchToCloud('fabrics', newFabrics);
        if (!ok) {
          // 실패: 모달 유지 + 로컬 state 롤백 (낙관적 업데이트 방지)
          return;
        }
        setSavedFabrics([...newFabrics, ...savedFabrics]);
        setIsBulkModalOpen(false);

        const dupNote = dupSkipped > 0 ? `\n\n⚠️ 중복 Article ${dupSkipped}건은 건너뛰었습니다.` : '';
        if (missingYarnNames.size > 0) {
          alert(`✅ 총 ${newFabrics.length}건이 성공적으로 등록되었습니다.${dupNote}\n\n⚠️ 주의: 다음 원사 정보가 아직 라이브러리에 없어서 임시 텍스트로 등록되었습니다.\n해당 원단들의 수율 단가(Cost/gYD) 계산이 부정확할 수 있으니,\n이후 원사 라이브러리에 아래 원사들을 추가하시거나 원단을 수정해주세요.\n\n[미등록 원사 목록]\n${[...missingYarnNames].join(', ')}`);
        } else {
          showToast(`${newFabrics.length}건이 등록되었습니다.${dupSkipped > 0 ? ` (중복 ${dupSkipped}건 건너뜀)` : ''}`, 'success');
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
    reader.onload = async (evt) => {
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
        // 저장 성공 여부 확인 후 UI 후처리
        const ok = await saveBatchToCloud('yarns', newYarns);
        if (!ok) return;
        setYarnLibrary([...newYarns, ...yarnLibrary]);
        setIsYarnBulkModalOpen(false);
        showToast(`${newYarns.length}건의 원사가 등록되었습니다.`, 'success');
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

        // Y1: 부분 실패 처리 — 청크 단위 결과 수신 후 사용자에게 명확히 안내
        const result = await updateYarnCategoryBatch(yarnsToUpdate, upperNew);
        if (result.failed.length > 0) {
          alert(
            `⚠️ 카테고리 일괄 변경 중 ${result.failed.length}/${result.totalAttempted}건 실패\n\n` +
            `성공: ${result.success}건\n실패: ${result.failed.length}건\n\n` +
            `실패한 원사 ID 일부:\n${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? ` 외 ${result.failed.length - 5}건` : ''}\n\n` +
            `네트워크 상태 확인 후 다시 시도해주세요. 카테고리 자체는 저장됩니다.`
          );
        }
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

  // 카테고리 합치기: sources(없앨 카테고리들)의 원사를 target(남길 카테고리)으로 일괄 재분류 후 sources 삭제
  const handleMergeCategories = async (sources, target) => {
    const upperTarget = String(target || '').trim().toUpperCase();
    const upperSources = [...new Set((sources || []).map(s => String(s).trim().toUpperCase()))]
      .filter(s => s && s !== upperTarget);
    if (!upperTarget) { alert('남길(대상) 카테고리를 선택해주세요.'); return; }
    if (upperSources.length === 0) { alert('합칠 카테고리를 1개 이상 선택해주세요.'); return; }
    if (!window.confirm(
      `[${upperSources.join(', ')}] → [${upperTarget}] (으)로 합칩니다.\n\n` +
      `해당 카테고리의 원사가 모두 '${upperTarget}'(으)로 바뀌고, 합쳐진 카테고리는 목록에서 삭제됩니다.\n계속하시겠습니까?`
    )) return;

    try {
      setSyncStatus('syncing');
      const yarnsToUpdate = yarnLibrary.filter(y => upperSources.includes(String(y.category || '').toUpperCase()));
      if (yarnsToUpdate.length > 0) {
        const result = await updateYarnCategoryBatch(yarnsToUpdate, upperTarget);
        if (result.failed.length > 0) {
          alert(
            `⚠️ 카테고리 합치기 중 ${result.failed.length}/${result.totalAttempted}건 실패\n\n` +
            `성공: ${result.success}건 / 실패: ${result.failed.length}건\n\n` +
            `네트워크 상태 확인 후 다시 시도해주세요. (카테고리 목록 정리는 진행됩니다)`
          );
        }
      }
      // categories 목록에서 sources 제거, target 유지
      const remaining = categories.filter(c => !upperSources.includes(String(c).toUpperCase()));
      if (!remaining.map(c => String(c).toUpperCase()).includes(upperTarget)) remaining.push(upperTarget);
      await setDoc(doc(db, 'settings', 'general'), { yarnCategories: [...new Set(remaining)] }, { merge: true });

      // 현재 보고 있던 필터가 합쳐져 사라진 카테고리면 전체로 되돌림
      if (upperSources.includes(String(yarnFilterCategory).toUpperCase())) setYarnFilterCategory('All');

      setIsCategoryModalOpen(false);
      setSyncStatus('saved');
      showToast(`${upperSources.length}개 카테고리를 '${upperTarget}'(으)로 합쳤습니다.`, 'success');
    } catch (e) {
      setSyncStatus('error'); alert(`오류 발생: ${e.message}`);
    }
  };

  const handleSaveBuyer = async (newName) => {
    const safeNewName = String(newName || '').trim().toUpperCase();
    if (!safeNewName) { alert("바이어 상호명을 입력해주세요."); return; }
    if (buyers.includes(safeNewName)) { alert("이미 등록된 바이어입니다."); return; }
    try {
      setSyncStatus('syncing');
      // arrayUnion: 서버에서 원자적으로 추가 — 로컬 state 무관, 다른 기기 동시 추가도 안전
      await setDoc(doc(db, 'settings', 'general'), { buyers: arrayUnion(safeNewName) }, { merge: true });
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

    // arrayRemove: 서버에서 해당 항목만 원자적으로 제거 (다른 항목 보호)
    await setDoc(doc(db, 'settings', 'general'), { buyers: arrayRemove(buyerName) }, { merge: true });
    showToast('바이어가 삭제되었습니다.', 'success');
  };

  // OLD QUOTATION LOGICS MOVED TO HOOKS

  const handleDownloadPDF = (targetQuoteFromHistory = null) => {
    // History 페이지 등에서 특정 견적서 출력 시 해당 견적서 데이터를 최우선으로 적용합니다.
    const targetQuote = (targetQuoteFromHistory && targetQuoteFromHistory.id) ? targetQuoteFromHistory : quoteInput;

    if (!targetQuote.items || targetQuote.items.length === 0) {
      showToast("내용이 없습니다.", 'error');
      return;
    }

    // PDFRenderer가 올바른 데이터로 렌더링되도록 항상 setQuoteInput 실행
    setQuoteInput(targetQuote);
    setIsPdfGenerating(true);
    showToast("인쇄 다이얼로그에서 '대상 = PDF로 저장'을 선택해 주세요.", 'info');

    // [PDF v4] Chrome native 인쇄 기능 사용
    //   - window.print() + @media print 스타일 (index.css)
    //   - document.title 트릭으로 자동 파일명 제안
    //   - html2pdf 라이브러리 우회 → element 위치 캡처 버그 회피
    setTimeout(() => {
      const oldTitle = document.title;
      const safeBuyer = String(targetQuote.buyerName || '').replace(/[^a-zA-Z0-9\s-가-힣]/g, '');
      const filename = `Quotation_${safeBuyer}_${targetQuote.date || ''}`.trim();
      try {
        document.title = filename;
        window.print();
      } finally {
        // 인쇄 다이얼로그 닫힌 후 복원
        document.title = oldTitle;
        setIsPdfGenerating(false);
      }
    }, 400);
  };

  // [신규] 견적서를 엑셀(.xlsx)로 내보내기
  //   - PDF와 동일한 내용(바이어/날짜/통화/유효기간 + 품목별 스펙·단가)
  //   - 단가는 Extra Margin 반영 + 통화별 반올림된 최종가(PDF와 일치)
  //   - History 행에서 호출 시 해당 견적서, 작성 화면에서 호출 시 현재 quoteInput 사용
  const handleDownloadQuoteExcel = (targetQuoteFromHistory = null) => {
    if (!isXlsxReady || !window.XLSX) {
      showToast('엑셀 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }
    const targetQuote = (targetQuoteFromHistory && targetQuoteFromHistory.id) ? targetQuoteFromHistory : quoteInput;
    if (!targetQuote.items || targetQuote.items.length === 0) {
      showToast("내용이 없습니다.", 'error');
      return;
    }

    const cur = targetQuote.currency;

    const rows = (targetQuote.items || []).map((item, idx) => ({
      'No': idx + 1,
      'Article': item.article || '',
      'Spec': item.itemName || '',
      'Cut(inch)': item.widthCut ?? '',
      'Full(inch)': item.widthFull ?? '',
      'GSM': item.gsm ?? '',
      'g/YD': Number(item.gYd) || 0,
      'MCQ(YD)': Number(item.mcqYd || 300),
      [`1,000YD (${cur})`]: calcQuotePrice(item, '1k', targetQuote, cur),
      [`3,000YD (${cur})`]: calcQuotePrice(item, '3k', targetQuote, cur),
      [`5,000YD (${cur})`]: calcQuotePrice(item, '5k', targetQuote, cur),
    }));

    const validUntil = getQuoteValidUntil(targetQuote.date, targetQuote.validityOption);
    const meta = [
      ['GRUBIG FABRIC QUOTATION (FOB PRICE)'],
      [`Buyer: ${targetQuote.buyerName || ''}${targetQuote.attention ? `    Attn: ${targetQuote.attention}` : ''}`],
      [`Date: ${targetQuote.date || ''}    Currency: ${cur}    Valid Until: ${validUntil}`],
      [],
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(meta);
    window.XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5' });
    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 9 }, { wch: 9 },
      { wch: 7 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
    ];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    const safeBuyer = String(targetQuote.buyerName || '').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim();
    const fileParts = ['Quotation', safeBuyer, targetQuote.date].filter(Boolean);
    window.XLSX.writeFile(wb, `${fileParts.join('_')}.xlsx`);
    showToast(`${rows.length}개 품목을 엑셀로 내보냈습니다.`, 'success');
  };

  // [R1] formatQuotePrice / getBasePrice 정의는 helpers.js로 이전됨.
  //   각 자식 컴포넌트(PDFRenderer/QuotationPage/QuoteHistoryPage)가 직접 import해서 사용

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

  // [R1] extraMarkup 계산은 helpers의 calcQuotePrice 안으로 이전됨 (각 자식 컴포넌트가 quoteInput.extraMargin을 직접 참조)

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold animate-pulse">GRUBIG 시스템 접속 중...</div>;
  if (!user) return <LoginScreen handleLogin={handleLogin} handleEmailLogin={handleEmailLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col print:bg-white relative">
      <Toast notification={notification} setNotification={setNotification} />

      {/* ✅ 상단 가로 네비게이션 (TopNav, Sidebar.jsx에 정의) */}
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeTab={activeTab}
        setActiveTab={requestSetActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        syncStatus={syncStatus}
        handleLogout={handleLogout}
        globalExchangeRate={globalExchangeRate}
        setGlobalExchangeRate={setGlobalExchangeRate}
      />

      <div className="flex-1 p-4 md:p-8 print:p-0 print:overflow-visible relative w-full overflow-x-hidden">

        {/* TAB 1: CALCULATOR */}
        {/* TAB: 원단 관리 (새 원단 등록 + 원단 리스트 병합 워크스페이스) */}
        {(activeTab === 'calculator' || activeTab === 'list') && (
          <FabricWorkspacePage
            navGuardRef={navGuardRef}
            // ── 리스트(FabricListPage)용 ──
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
            designSheets={designSheets}
            handleEditSheet={handleEditSheet}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
            // ── 등록/편집 폼(CalculatorPage)용 ──
            editingFabricId={editingFabricId}
            resetFabricForm={resetFabricForm}
            fabricInput={fabricInput}
            handleFabricChange={handleFabricChange}
            currentCalcFull={currentCalcFull}
            yarnSelectOptions={yarnSelectOptions}
            handleYarnSlotChange={handleYarnSlotChange}
            handleNestedChange={handleNestedChange}
            setFabricInput={setFabricInput}
            handleSaveFabric={handleSaveFabric}
            globalExchangeRate={globalExchangeRate}
            yarnLibrary={yarnLibrary}
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
            yarnSuppliers={yarnSuppliers}
            setActiveMasterModal={setActiveMasterModal}
            yarnPage={yarnPage}
            setYarnPage={setYarnPage}
          />
        )}

        {/* QUOTATION */}
        {/* TAB: 견적서 (작성 + 히스토리 병합 워크스페이스) */}
        {(activeTab === 'quotation' || activeTab === 'quoteHistory') && (
          <QuotationWorkspacePage
            navGuardRef={navGuardRef}
            // ── 작성 폼(QuotationPage)용 ──
            quoteInput={quoteInput}
            setQuoteInput={setQuoteInput}
            handleSaveQuote={handleSaveQuote}
            savedQuotes={savedQuotes}
            setSavedQuotes={setSavedQuotes}
            handleDownloadPDF={handleDownloadPDF}
            handleDownloadExcel={handleDownloadQuoteExcel}
            handleNewQuote={handleNewQuote}
            handleQuoteSettingChange={handleQuoteSettingChange}
            handleQuoteMarginChange={handleQuoteMarginChange}
            handleBulkMarginRateChange={handleBulkMarginRateChange}
            handleQuoteItemMarginChange={handleQuoteItemMarginChange}
            selectedFabricIdForQuote={selectedFabricIdForQuote}
            setSelectedFabricIdForQuote={setSelectedFabricIdForQuote}
            savedFabrics={savedFabrics}
            handleAddFabricToQuote={handleAddFabricToQuote}
            handleRemoveItemFromQuote={handleRemoveItemFromQuote}
            createQuoteItem={createQuoteItem}
            showToast={showToast}
            handleGridPaste={handleGridPaste}
            globalExchangeRate={globalExchangeRate}
            buyers={buyers}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
            yarnLibrary={yarnLibrary}
            // ── 히스토리 목록(QuoteHistoryPage)용 ──
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
            setActiveTab={setActiveTab}
            handleDeleteQuote={handleDeleteQuote}
            handleDuplicateQuote={handleDuplicateQuote}
            {...partnerBag}
          />
        )}

        {/* TAB: 컬렉션 관리 (영업 - 아티클 묶음) */}
        {activeTab === 'collection' && (
          <CollectionPage
            collections={collections}
            savedFabrics={savedFabrics}
            yarnLibrary={yarnLibrary}
            isXlsxReady={isXlsxReady}
            showToast={showToast}
            collectionInput={collectionInput}
            editingCollectionId={editingCollectionId}
            handleCollectionChange={handleCollectionChange}
            resetCollectionForm={resetCollectionForm}
            handleSaveCollection={handleSaveCollection}
            handleEditCollection={handleEditCollection}
            handleDeleteCollection={handleDeleteCollection}
            addArticlesToCollection={addArticlesToCollection}
            removeArticleFromCollection={removeArticleFromCollection}
            updateArticleMemo={updateArticleMemo}
            moveArticle={moveArticle}
          />
        )}

        {/* TAB: PI / 거래확인서 (영업) */}
        {activeTab === 'proformaInvoice' && (
          <ProformaInvoicePage
            piInput={piInput}
            setPIInput={setPIInput}
            editingPIId={editingPIId}
            handlePIChange={handlePIChange}
            setMarketType={setMarketType}
            handleNewPI={handleNewPI}
            resetPIForm={resetPIForm}
            addPIItem={addPIItem}
            removePIItem={removePIItem}
            handleItemChange={handleItemChange}
            addItemFromFabric={addItemFromFabric}
            handleSavePI={handleSavePI}
            handleEditPI={handleEditPI}
            handleDuplicatePI={handleDuplicatePI}
            handleDeletePI={handleDeletePI}
            handlePrintPI={handlePrintPI}
            handleDownloadPIExcel={handleDownloadPIExcel}
            proformaInvoices={proformaInvoices}
            savedFabrics={savedFabrics}
            buyers={buyers}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
            onOpenSettings={() => setIsPISettingsOpen(true)}
            {...partnerBag}
          />
        )}

        {/* TAB: Lab-Dip 발송 (영업) */}
        {activeTab === 'labdip' && (
          <LabdipPage
            labdipInput={labdipInput}
            setLabdipInput={setLabdipInput}
            editingLabdipId={editingLabdipId}
            handleLabdipChange={handleLabdipChange}
            resetLabdipForm={resetLabdipForm}
            addColor={addLabdipColor}
            removeColor={removeLabdipColor}
            updateColor={updateLabdipColor}
            handleSaveLabdip={handleSaveLabdip}
            handleEditLabdip={handleEditLabdip}
            handleDuplicateLabdip={handleDuplicateLabdip}
            handleDeleteLabdip={handleDeleteLabdip}
            handlePrintLabdip={handlePrintLabdip}
            labdips={labdips}
            {...partnerBag}
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
            handleDeleteDevRequest={handleDeleteDevRequest}
            resetDevForm={resetDevForm}
            createDesignSheetFromDev={createDesignSheetFromDev}
            initFromDevRequest={initFromDevRequest}
            updateDevStatus={updateDevStatus}
            handleEditSheet={(sheet) => { handleEditSheet(sheet); setIsDesignSheetModalOpen(true); }}
            setSamplingSub={setSamplingSub}
            linkSheetToDevRequest={linkSheetToDevRequest}
            unlinkSheetFromDevRequest={unlinkSheetFromDevRequest}
            saveDocToCloud={saveDocToCloud}
            setStage={setStage}
            dropDesignSheet={dropDesignSheet}
            setActiveTab={setActiveTab}
            user={user}
            buyers={buyers}
            generateDevOrderNo={generateDevOrderNo}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
            {...partnerBag}
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
                handleSaveSheet={handleSaveSheet}
                handleDeleteSheet={handleDeleteSheet}
                resetSheetForm={resetSheetForm}
                setStage={setStage}
                getDesignCost={getDesignCost}
                yarnSelectOptions={yarnSelectOptions}
                user={user}
                viewMode={viewMode}
                setActiveTab={(tab) => { if (tab === 'devStatus' || tab === 'designList') setIsDesignSheetModalOpen(false); }}
                globalExchangeRate={globalExchangeRate}
                devRequests={devRequests}
                setSheetInput={setSheetInput}
                linkAndConfirm={linkAndConfirm}
                closeModal={() => setIsDesignSheetModalOpen(false)}
                designSheets={designSheets}
                knittingFactories={knittingFactories}
                dyeingFactories={dyeingFactories}
                machineTypes={machineTypes}
                structures={structures}
                setActiveMasterModal={setActiveMasterModal}
                savedFabrics={savedFabrics}
                registerFabricFromSheet={registerFabricFromSheet}
                tempDesignSheets={tempDesignSheets}
                onLoadTempSheet={loadTempToSheet}
                detailInput={detailInput}
                setDetailInput={setDetailInput}
                editingDetailId={editingDetailId}
                handleDetailChange={handleDetailChange}
                handleTestChange={handleTestChange}
                addTest={addTest}
                removeTest={removeTest}
                handleSaveDetail={handleSaveDetail}
                resetDetailForm={resetDetailForm}
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
            getDesignCost={getDesignCost}
            user={user}
            viewMode={viewMode}
            yarnLibrary={yarnLibrary}
            restoreFromDrop={restoreFromDrop}
            resetSheetForm={resetSheetForm}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
          />
        )}

        {/* TAB: 가설계서(레시피) 관리 */}
        {activeTab === 'tempDesign' && (
          <TempDesignSheetListPage
            tempDesignSheets={tempDesignSheets}
            tempInput={tempInput}
            setTempInput={setTempInput}
            editingTempId={editingTempId}
            handleTempChange={handleTempChange}
            handleTempSectionChange={handleTempSectionChange}
            handleTempYarnChange={handleTempYarnChange}
            handleTempCostInputChange={handleTempCostInputChange}
            handleTempCostNestedChange={handleTempCostNestedChange}
            handleSaveTemp={handleSaveTemp}
            handleEditTemp={handleEditTemp}
            handleDeleteTemp={handleDeleteTemp}
            resetTempForm={resetTempForm}
            getTempDesignCost={getTempDesignCost}
            yarnSelectOptions={yarnSelectOptions}
            user={user}
            viewMode={viewMode}
            globalExchangeRate={globalExchangeRate}
            knittingFactories={knittingFactories}
            dyeingFactories={dyeingFactories}
            machineTypes={machineTypes}
            structures={structures}
            addMasterItem={addMasterItem}
            setActiveMasterModal={setActiveMasterModal}
            isTempModalOpen={isTempDesignSheetModalOpen}
            setIsTempModalOpen={setIsTempDesignSheetModalOpen}
            DesignSheetPage={DesignSheetPage}
            resetSheetForm={resetSheetForm}
            setIsDesignSheetModalOpen={setIsDesignSheetModalOpen}
            setSheetInput={setSheetInput}
            loadTempToSheet={loadTempToSheet}
            designSheets={designSheets}
            loadSheetToTemp={loadSheetToTemp}
          />
        )}

        {activeTab === 'mainDetail' && (
          <MainDetailPage
            mainDetails={mainDetails}
            savedFabrics={savedFabrics}
            detailInput={detailInput} setDetailInput={setDetailInput}
            editingDetailId={editingDetailId} setEditingDetailId={setEditingDetailId}
            handleDetailChange={handleDetailChange} handleTestChange={handleTestChange}
            addTest={addTest} removeTest={removeTest}
            handleSaveDetail={handleSaveDetail} handleEditDetail={handleEditDetail}
            handleDeleteDetail={handleDeleteDetail} resetDetailForm={resetDetailForm}
            handleQuickStatusChange={handleQuickStatusChange}
            handleBulkPaste={handleBulkPaste}
          />
        )}


        {/* TAB: 오더 등록 (1페이지 구조 v3) */}
        {activeTab === 'orderWizard' && (
          <OrderWizardPage
            orderInput={orderInput}
            setOrderInput={setOrderInput}
            editingOrderId={editingOrderId}
            handleOrderChange={handleOrderChange}
            setOrderType={setOrderType}
            addColor={addColor} removeColor={removeColor} updateColor={updateColor}
            toggleProcess={toggleProcess} updateProcessField={updateProcessField} updateProcessSchedule={updateProcessSchedule}
            addBatch={addBatch} removeBatch={removeBatch} updateBatchField={updateBatchField} updateBatchColors={updateBatchColors}
            addYarnOrder={addYarnOrder} removeYarnOrder={removeYarnOrder} updateYarnOrder={updateYarnOrder}
            toggleYarnOrderKnitterStock={toggleYarnOrderKnitterStock}
            setAllYarnOrdersKnitterStock={setAllYarnOrdersKnitterStock}
            addDelivery={addDelivery} removeDelivery={removeDelivery} updateDelivery={updateDelivery}
            handleSaveOrder={handleSaveOrder}
            resetOrderForm={resetOrderForm}
            buyers={buyers}
            yarnLibrary={yarnLibrary}
            savedFabrics={savedFabrics}
            setIsBuyerModalOpen={setIsBuyerModalOpen}
            user={user}
            setActiveTab={setActiveTab}
            onApplyFabric={handleApplyFabricToOrder}
            onDetachFabric={detachFabric}
            {...partnerBag}
          />
        )}

        {/* TAB: 오더 관리 (목록 + 칸반 + 간트 통합) */}
        {(activeTab === 'orderList' || activeTab === 'orderGantt' || activeTab === 'orderKanban') && (
          <OrderListPage
            orders={orders}
            onView={(order) => openOrderDetail(order.id)}
            onDelete={handleDeleteOrder}
            onOpenOrderDetail={openOrderDetail}
            onSaveBatch={handleSaveBatch}
            onSaveYarnDelivery={handleSaveYarnDelivery}
            setActiveTab={setActiveTab}
          />
        )}

        {/* TAB: 리포트 */}
        {activeTab === 'orderReport' && (
          <ReportPage orders={orders} />
        )}

        {/* 오더 상세 모달 (대시보드 + 인라인 차수 편집) */}
        {selectedOrderId && (
          <OrderDetailModal
            order={orders.find(o => o.id === selectedOrderId)}
            onClose={closeOrderDetail}
            yarnLibrary={yarnLibrary}
            onEditOrder={handleEditOrderToWizard}
            onAddBatch={(processType) => handleAddBatchToOrder(selectedOrderId, processType)}
            onDeleteBatch={(processType, batchId) => handleDeleteBatchFromOrder(selectedOrderId, processType, batchId)}
            onSaveBatch={(processType, batchId, draftBatch) => handleSaveBatch(selectedOrderId, processType, batchId, draftBatch)}
            onSaveYarnOrder={(yoId, draftYO) => handleSaveYarnOrder(selectedOrderId, yoId, draftYO)}
            onToggleYarnKnitterStock={(yoId, value) => handleToggleYarnKnitterStock(selectedOrderId, yoId, value)}
            onAddYarnDelivery={(yoId) => handleAddYarnDelivery(selectedOrderId, yoId)}
            onDeleteYarnDelivery={(yoId, dvId) => handleDeleteYarnDelivery(selectedOrderId, yoId, dvId)}
            onSaveYarnDelivery={(yoId, dvId, draftDv) => handleSaveYarnDelivery(selectedOrderId, yoId, dvId, draftDv)}
            focusBatch={orderModalFocus}
          />
        )}

        {/* 모달 3종 (엑셀 업로드 2 + 카테고리 관리) */}
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
          handleMergeCategories={handleMergeCategories}
          yarnLibrary={yarnLibrary}
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
              activeMasterModal.key === 'structures' ? structures :
              activeMasterModal.key === 'yarnSuppliers' ? yarnSuppliers : []
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
        />

        {/* PI / 거래확인서 인쇄 문서 (off-screen, body.printing-pi 일 때만 노출) */}
        <PIPrintSheet pi={selectedPIForPrint} piSettings={piSettings} />

        {/* PI 설정(은행정보/약관) 모달 — 열릴 때만 마운트해 설정값 재시드 */}
        {isPISettingsOpen && (
          <PISettingsModal
            onClose={() => setIsPISettingsOpen(false)}
            piSettings={piSettings}
            onSave={savePISettings}
            showToast={showToast}
          />
        )}

        {/* Lab-Dip 인쇄 문서 (off-screen, body.printing-labdip 일 때만 노출) */}
        <LabdipPrintSheet labdip={selectedLabdipForPrint} />
      </div>
    </div>
  );
};

export default App;