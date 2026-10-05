import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileSpreadsheet, X, Users, Upload, Download,
} from 'lucide-react';

// 🔥 Firebase 모듈 (서비스 레이어 연동)
import { onSnapshot, collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged, signOut, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { db, auth, googleProvider } from '../services/firebase';
import { saveDocument, deleteDocument, saveBatchDocuments, updateYarnCategoryBatch } from '../services/db';

// ⚙️ 공통 상수 & 유틸리티 연동
import { ALLOWED_DOMAIN, DEFAULT_YARN_CATEGORIES } from '../constants/common';
import { DEV_SAMPLE_FABRICS, DEV_SAMPLE_YARNS, DEV_SAMPLE_DEV_REQUESTS, DEV_SAMPLE_DESIGN_SHEETS, DEV_SAMPLE_ORDERS } from '../constants/devSamples';
import { useXLSX } from '../hooks/useExternalScripts';

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
import { useExcelIO } from '../hooks/domains/useExcelIO';
import { useQuoteExport } from '../hooks/domains/useQuoteExport';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { num } from '../utils/helpers';
import { resolveCostSettings } from '../utils/costModel';

// 🧩 공통 / 레이아웃 UI 컴포넌트
import { Toast } from '../components/common/Toast';
import { UnsavedChangesDialog } from '../components/common/UnsavedChangesDialog';
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
import { OrderListPage } from '../pages/OrderListPage';
import { ReportPage } from '../pages/ReportPage';
import { CollectionPage } from '../pages/CollectionPage';
import { ProformaInvoicePage } from '../pages/ProformaInvoicePage';
import { PIPrintSheet } from '../components/pi/PIPrintSheet';
import { PISettingsModal } from '../components/pi/PISettingsModal';
import { CostSettingsModal } from '../components/cost/CostSettingsModal';
import { LabdipPage } from '../pages/LabdipPage';
import { LabdipPrintSheet } from '../components/labdip/LabdipPrintSheet';

// ── [DEV 검증 전용] 가짜 로그인 + 인메모리 데이터 모드 ─────────────────────
// 개발 빌드(import.meta.env.DEV)이고 localStorage('grubig_dev_bypass')==='1'일 때만 활성.
// 프로덕션 빌드(vite build)에선 import.meta.env.DEV===false → 아래 분기 전부 죽은 코드로 제거됨.
// 실제 Firestore/운영 데이터는 일절 건드리지 않음. (켜고 끄려면 새로고침 — 예전과 같음)
const DEV_BYPASS = import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.localStorage?.getItem('grubig_dev_bypass') === '1';

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
  // 공통 환율 (원/$) — 회사 공통 설정 settings/general.exchangeRate { value, updatedAt, updatedBy } 를 모든 직원이 같이 씀
  //  (2026-10-03 대표님 결정: 예전엔 PC마다 따로라 직원마다 수출 원가·견적이 달랐음)
  //  localStorage는 첫 화면 깜빡임 방지용 캐시 + 아직 공통 값이 저장되기 전(처음 한 번)의 이 PC 값
  const [globalExchangeRate, setGlobalExchangeRate] = useState(() => Number(localStorage.getItem('grubig_global_exchange_rate')) || 1450);
  const [exchangeRateMeta, setExchangeRateMeta] = useState(null); // { updatedAt, updatedBy } — null이면 아직 공통 저장 전

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
  // 원가 설정 (settings/general.costSettings) — 편직 정액·LOSS 구간·가공 유형·이화학·운임·외관검사·수입 원사 운반비
  //   저장값이 없거나 일부 빠져도 resolveCostSettings가 기본값으로 채움 → 계산·화면은 항상 완전한 설정을 받음
  const [costSettingsRaw, setCostSettingsRaw] = useState(null);
  const costSettings = useMemo(() => resolveCostSettings(costSettingsRaw), [costSettingsRaw]);
  const [isCostSettingsOpen, setIsCostSettingsOpen] = useState(false);
  const [costSettingsFocus, setCostSettingsFocus] = useState(null); // 'importFreight' → 수입 원사 운반비로 스크롤
  // onClick={openCostSettings} 처럼 버튼에 바로 붙이면 클릭 이벤트가 넘어오므로 문자열일 때만 focus로 씀
  const openCostSettings = (focus) => {
    setCostSettingsFocus(typeof focus === 'string' ? focus : null);
    setIsCostSettingsOpen(true);
  };
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
  const [activeMasterModal, setActiveMasterModal] = useState(null);

  const [fabricSearchTerm, setFabricSearchTerm] = useState('');
  const [yarnSearchTerm, setYarnSearchTerm] = useState('');

  const [isDesignSheetModalOpen, setIsDesignSheetModalOpen] = useState(false);
  const [isTempDesignSheetModalOpen, setIsTempDesignSheetModalOpen] = useState(false);

  const printRef = useRef(null);
  const fileInputRef = useRef(null);
  const yarnFileInputRef = useRef(null);
  const isXlsxReady = useXLSX();

  // ── [DEV 검증 전용] 가짜 로그인 + 인메모리 데이터 모드 — DEV_BYPASS (파일 위쪽, 컴포넌트 밖에서 한 번 계산) ──

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
      setOrders(DEV_SAMPLE_ORDERS);            // 생산 현황 v8 샘플 (옛 형식 1건 포함)
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
        // 원가 설정 — 내용이 같으면 그대로 둠 (바이어 추가 등 다른 칸이 바뀔 때마다 새 객체가 되어
        //  원단·원사 목록 전체가 원가를 다시 계산하던 것 방지)
        setCostSettingsRaw(prev => {
          const next = d.costSettings || null;
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        // 공통 환율 — 저장된 값이 있으면 모든 직원이 그 값을 씀 (없으면 이 PC 값 유지)
        const er = d.exchangeRate;
        if (er && Number(er.value) > 0) {
          setGlobalExchangeRate(Number(er.value));
          setExchangeRateMeta({ updatedAt: er.updatedAt || '', updatedBy: er.updatedBy || '' });
        } else {
          setExchangeRateMeta(null);
        }
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
  // 성공 시 true / 실패 시 false 반환 — 호출자가 삭제 성공 여부에 따라 후처리(성공 토스트 등)를 분기할 수 있도록 함
  const deleteDocFromCloud = async (colName, id) => {
    if (DEV_BYPASS) {
      const setter = DEV_LOCAL_SETTERS[colName];
      if (setter) setter(prev => prev.filter(x => String(x.id) !== String(id)));
      setSyncStatus('saved');
      return true;
    }
    setSyncStatus('syncing');
    try { await deleteDocument(colName, id); setSyncStatus('saved'); return true; }
    catch { setSyncStatus('error'); showToast("삭제 실패", "error"); return false; }
  };
  // 일괄 저장: 성공 true / 실패 false 반환 (호출자가 후처리 분기 가능)
  const saveBatchToCloud = async (colName, items) => {
    if (DEV_BYPASS) {
      // DEV 우회: 실제 Firestore 대신 로컬 state만 (id 같은 문서는 교체)
      const setter = DEV_LOCAL_SETTERS[colName];
      const ids = new Set((items || []).map(x => String(x.id)));
      if (setter) setter(prev => [...prev.filter(x => !ids.has(String(x.id))), ...items]);
      setSyncStatus('saved');
      return true;
    }
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

  // settings/general 의 목록 필드 쓰기 (원사 분류·바이어·편직처·염색처·기종·조직·원사 업체)
  //  op: { set: [...] } 통째로 바꾸기 / { add: [...] } 원자적 추가 / { remove: [...] } 원자적 제거
  //  DEV(로그인 우회)에서는 실제 Firestore 대신 화면 state만 바꿈 — 예전엔 이 목록들이 DEV에서도 실제 DB에 써져서
  //  DEV 기본 분류로 실제 분류 목록 전체가 덮일 수 있었음
  const DEV_SETTINGS_LIST_SETTERS = {
    yarnCategories: setCategories, buyers: setBuyers, knittingFactories: setKnittingFactories,
    dyeingFactories: setDyeingFactories, machineTypes: setMachineTypes, structures: setStructures,
    yarnSuppliers: setYarnSuppliers,
  };
  const writeSettingsList = async (field, op) => {
    if (DEV_BYPASS) {
      const setter = DEV_SETTINGS_LIST_SETTERS[field];
      if (setter) setter(prev => {
        const cur = Array.isArray(prev) ? prev : [];
        if (op.set) return [...op.set];
        if (op.add) return [...new Set([...cur, ...op.add])];
        if (op.remove) return cur.filter(x => !op.remove.includes(x));
        return cur;
      });
      return;
    }
    const value = op.set ? op.set : op.add ? arrayUnion(...op.add) : arrayRemove(...op.remove);
    await setDoc(doc(db, 'settings', 'general'), { [field]: value }, { merge: true });
  };
  // 원사 분류 일괄 변경 (yarns 문서 여러 개) — DEV에서는 화면 state만
  const updateYarnCategories = async (yarns, newCategory) => {
    if (DEV_BYPASS) {
      const ids = new Set((yarns || []).map(y => String(y.id)));
      setYarnLibrary(prev => prev.map(y => (ids.has(String(y.id)) ? { ...y, category: newCategory } : y)));
      return { success: ids.size, failed: [], totalAttempted: ids.size };
    }
    return updateYarnCategoryBatch(yarns, newCategory);
  };

  // 마스터 데이터 등록/삭제 공용 함수 (settings/general 문서의 배열 필드)
  // arrayUnion/arrayRemove 원자 연산 사용 — 로컬 state에 의존하지 않아 race/오버라이트 안전
  const addMasterItem = async (field, name) => {
    const trimmed = String(name).trim();
    if (!trimmed) { showToast('이름을 입력해주세요.', 'error'); return false; }
    const currentMap = { buyers, knittingFactories, dyeingFactories, machineTypes, structures, yarnSuppliers };
    const current = currentMap[field] || [];
    if (current.includes(trimmed)) { showToast('이미 등록된 항목입니다.', 'error'); return false; }
    try {
      await writeSettingsList(field, { add: [trimmed] });
      showToast(`'${trimmed}' 등록 완료`, 'success');
      return true;
    } catch (e) {
      showToast(`등록 실패: ${e.message}`, 'error');
      return false;
    }
  };
  const removeMasterItem = async (field, name) => {
    try {
      await writeSettingsList(field, { remove: [name] });
      showToast(`'${name}' 삭제됨`, 'success');
    } catch (e) {
      showToast(`삭제 실패: ${e.message}`, 'error');
    }
  };

  // ⚓️ 커스텀 도메인 훅 사용
  const {
    fabricInput, setFabricInput, editingFabricId, expandedFabricId, setExpandedFabricId,
    handleFabricChange, handleYarnSlotChange,
    handleSaveFabric, handleEditFabric, handleDeleteFabric, resetFabricForm, calculateCost, calculateCostAtQty
  } = useFabric(yarnLibrary, savedFabrics, designSheets, saveDocToCloud, deleteDocFromCloud, setSyncStatus, showToast, globalExchangeRate, savedQuotes, costSettings);

  const {
    yarnInput, setYarnInput, editingYarnId,
    handleSaveYarn, handleEditYarn, handleDeleteYarn, resetYarnForm,
    handleAddSupplier, handleRemoveSupplier, handleSupplierChange, handleDeleteHistoryItem
  } = useYarn(yarnLibrary, savedFabrics, saveDocToCloud, deleteDocFromCloud, showToast, designSheets, costSettings);

  const {
    quoteInput, setQuoteInput, handleQuoteSettingChange, handleRecalcQuote, createQuoteItem,
    handleQuoteMarginChange, handleBulkMarginRateChange, handleQuoteItemMarginChange,
    handleToggleShownTier, handleResetTierDefaults, handleQuoteExcludeChange,
    handleAddFabricToQuote, handleGridPaste,
    handleRemoveItemFromQuote, handleRemoveItemsFromQuote,
    handleCopyToCustom, handleAddCustomFabric, handleCustomItemChange, handleRemoveCustomItems, handleCustomExcludeChange,
    handleNewQuote, handleSaveQuote, handleDeleteQuote, handleDuplicateQuote
  } = useQuotation(savedFabrics, calculateCost, saveDocToCloud, deleteDocFromCloud, showToast, user, globalExchangeRate, calculateCostAtQty);

  // ⚓️ 설계서 시스템 훅
  const {
    devInput, editingDevId,
    handleDevChange, handleSpecChange,
    handleSaveDevRequest, handleEditDevRequest, handleDeleteDevRequest,
    resetDevForm, generateDevOrderNo, createDesignSheetFromDev,
    updateDevStatus, linkAndConfirm, getBlankDevInput
  } = useDevRequest(devRequests, saveDocToCloud, deleteDocFromCloud, showToast, designSheets);

  // 아이템화 시 원단 자동 등록용 함수
  // 설계서 아이템화 → 원단 저장. 저장 성공 여부(true/false)를 돌려줘야 설계서가 '없는 원단'에 연결되지 않음
  const saveFabricFromSheet = (fabricData) => saveDocToCloud('fabrics', fabricData);

  const {
    sheetInput, setSheetInput, editingSheetId,
    handleSheetChange, handleSectionChange,
    handleSheetYarnChange, handleCostInputChange,
    handleSaveSheet, handleEditSheet, handleDeleteSheet,
    resetSheetForm, setStage, setSamplingSub,
    linkSheetToDevRequest, unlinkSheetFromDevRequest,
    getDesignCost, initFromDevRequest, dropDesignSheet, restoreFromDrop,
    saveSheetAndRegisterFabric, getBlankSheetInput
  } = useDesignSheet(designSheets, savedFabrics, yarnLibrary, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost, globalExchangeRate, saveFabricFromSheet, devRequests);

  // ⚓️ 메인 디테일 훅
  const {
    detailInput, setDetailInput, editingDetailId, setEditingDetailId,
    handleDetailChange, handleTestChange, addTest, removeTest,
    handleSaveDetail, handleEditDetail, handleDeleteDetail, resetDetailForm,
    handleQuickStatusChange, handleBulkPaste, getBlankDetailInput
  } = useMainDetail(mainDetails, saveDocToCloud, deleteDocFromCloud, showToast);

  // ⚓️ 가설계서(레시피) 전용 훅 — 기존 useDesignSheet와 완전 독립
  const {
    tempInput, setTempInput, editingTempId,
    handleTempChange, handleTempSectionChange,
    handleTempYarnChange, handleTempCostInputChange, handleTempCostNestedChange,
    handleSaveTemp, handleEditTemp, handleDeleteTemp,
    resetTempForm, getTempDesignCost, loadTempToSheet, loadSheetToTemp, getBlankTempInput
  } = useTempDesignSheet(tempDesignSheets, saveDocToCloud, deleteDocFromCloud, showToast, calculateCost);

  // 설계서 작성 창(정식) — 닫기 때 저장 안 한 변경이 있으면 '저장할까요?' (원단 편집과 같음, 2026-10-06)
  //  새 설계서(개발 의뢰·가설계서에서 채운 것 포함)는 빈 양식 기준.
  //  단계·연결·상태·이력은 누르는 즉시 저장되면서 열린 화면도 바뀌는 칸이라 비교에서 뺌
  const SHEET_INSTANT_SAVE_KEYS = ['stage', 'stageEnteredAt', 'samplingSub', 'samplingSubEnteredAt', 'devRequestId', 'devOrderNo', 'linkedFabricId', 'status', 'changeHistory', 'fieldMeta', 'createdBy'];
  const [sheetLeavePending, setSheetLeavePending] = useState(false);
  const sheetGuard = useUnsavedGuard(sheetInput, isDesignSheetModalOpen, {
    initial: !editingSheetId && getBlankSheetInput ? getBlankSheetInput() : null,
    ignoreKeys: SHEET_INSTANT_SAVE_KEYS,
  });
  const closeSheetEditor = () => { setSheetLeavePending(false); resetSheetForm(); setIsDesignSheetModalOpen(false); };
  const requestCloseSheet = () => { if (sheetGuard.isDirty()) setSheetLeavePending(true); else closeSheetEditor(); };
  const saveSheetAndClose = async () => {
    setSheetLeavePending(false);
    const onLink = (devReqId, sheetId) => { if (linkAndConfirm) linkAndConfirm(devReqId, sheetId); };
    const savedId = await handleSaveSheet(user, onLink); // 설계서 화면의 저장 버튼과 같은 저장 (검증·변경 이력 포함)
    if (savedId) setIsDesignSheetModalOpen(false);
  };

  // ⚓️ 생산 오더(스케줄) 훅 — v8 엑셀형 현황표 (칸 단위 즉시 저장, 레거시 오더 자동 변환)
  const {
    orders: productionOrders,
    drafts: productionDrafts,
    orderActions,
  } = useOrder(orders, saveDocToCloud, deleteDocFromCloud, showToast, user);

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
    handleNewPI, handleRegeneratePINo,
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

  // 공통 환율 저장 — settings/general.exchangeRate (DEV 우회 시 로컬만). 화면 위 환율 칸에서 확인 후 호출
  //  모든 직원의 원단 원가·새 견적에 바로 적용. 이미 저장한 견적은 그 견적의 환율 그대로.
  const saveExchangeRate = async (value) => {
    const v = Math.round(Number(value) * 100) / 100;
    if (!(v > 0)) { showToast('환율은 0보다 커야 해요.', 'error'); return false; }
    const prevRate = globalExchangeRate;
    const prevMeta = exchangeRateMeta;
    const meta = { updatedAt: new Date().toISOString(), updatedBy: user?.displayName || user?.email || '' };
    setGlobalExchangeRate(v);
    setExchangeRateMeta(meta);
    if (DEV_BYPASS) { setSyncStatus('saved'); showToast(`공통 환율을 ₩${num(v)}로 바꿨어요.`, 'success'); return true; }
    setSyncStatus('syncing');
    try {
      await setDoc(doc(db, 'settings', 'general'), { exchangeRate: { value: v, ...meta } }, { merge: true });
      setSyncStatus('saved');
      showToast(`공통 환율을 ₩${num(v)}로 바꿨어요. 모든 직원에게 적용됩니다.`, 'success');
      return true;
    } catch (e) {
      setGlobalExchangeRate(prevRate); // 실패 시 이전 값으로 되돌림
      setExchangeRateMeta(prevMeta);
      setSyncStatus('error');
      showToast(`환율 저장 실패: ${e?.message || '네트워크 오류'}`, 'error');
      return false;
    }
  };

  // 원가 설정 저장 — settings/general.costSettings 통째로 교체 (DEV 우회 시 로컬만)
  //   저장 즉시 모든 품목 원가가 새 설정으로 다시 계산됨. 저장된 견적서 단가(basePrice)는 그대로.
  //   반환: 성공 true / 실패 false (모달이 성공했을 때만 닫히도록)
  const saveCostSettings = async (next) => {
    const stamped = {
      ...next,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.displayName || user?.email || '',
    };
    if (DEV_BYPASS) { setCostSettingsRaw(stamped); setSyncStatus('saved'); return true; }
    setSyncStatus('syncing');
    try {
      await updateDoc(doc(db, 'settings', 'general'), { costSettings: stamped });
      setSyncStatus('saved');
      return true;
    } catch (e) {
      setSyncStatus('error');
      showToast(`원가 설정 저장 실패: ${e?.message || '네트워크 오류'}`, 'error');
      return false;
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
      'HS Code': it.hsCode || '',
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
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, isExport ? 'PI' : '거래확인서');
    const safeNo = String(pi.piNo || 'PI').replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'PI';
    window.XLSX.writeFile(wb, `${safeNo}.xlsx`);
    showToast(`${rows.length}개 품목을 엑셀로 내보냈습니다.`, 'success');
  };


  const [selectedFabricIdForQuote, setSelectedFabricIdForQuote] = useState('');

  const [editingCategoryOld, setEditingCategoryOld] = useState(null);
  const [editingCategoryNew, setEditingCategoryNew] = useState('');

  // OLD CALCULATION LOGICS MOVED TO HOOKS

  // 원단·원사 엑셀 (백업 · 양식 · 일괄 등록) — hooks/domains/useExcelIO.js
  const {
    handleBackupFabrics, handleBackupYarns,
    handleDownloadTemplate, handleFileUpload,
    handleDownloadYarnTemplate, handleYarnFileUpload,
  } = useExcelIO({
    isXlsxReady, costSettings, showToast, saveBatchToCloud,
    savedFabrics, setSavedFabrics, yarnLibrary, setYarnLibrary,
    fileInputRef, yarnFileInputRef, setIsBulkModalOpen, setIsYarnBulkModalOpen,
  });

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
        const result = await updateYarnCategories(yarnsToUpdate, upperNew);
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

      await writeSettingsList('yarnCategories', { set: [...new Set(updatedCats)] });
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
      await writeSettingsList('yarnCategories', { set: newCats });
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
        const result = await updateYarnCategories(yarnsToUpdate, upperTarget);
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
      await writeSettingsList('yarnCategories', { set: [...new Set(remaining)] });

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
      await writeSettingsList('buyers', { add: [safeNewName] });
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
    await writeSettingsList('buyers', { remove: [buyerName] });
    showToast('바이어가 삭제되었습니다.', 'success');
  };

  // OLD QUOTATION LOGICS MOVED TO HOOKS

  // 바이어 견적서 내보내기 (PDF 인쇄 · 엑셀) — hooks/domains/useQuoteExport.js
  const { isPdfGenerating, pdfKind, pdfQuote, handleDownloadPDF, handleDownloadQuoteExcel } =
    useQuoteExport({ quoteInput, isXlsxReady, showToast });

  // [R1] 견적 판매가·표기(calcQuotePrice / formatQuotePrice 등)는 utils/quoteModel.js 에 있음.
  //   각 자식 컴포넌트(PDFRenderer/QuotationPage/QuoteHistoryPage)가 직접 import해서 사용

  // 원가 계산기(편집 중인 원단) 원가 — 원단 입력이나 원가 기준이 바뀔 때만 다시 계산
  const currentCalcFull = useMemo(() => calculateCost(fabricInput), [calculateCost, fabricInput]);
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
        onCommitExchangeRate={saveExchangeRate}
        exchangeRateMeta={exchangeRateMeta}
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
            setFabricInput={setFabricInput}
            handleSaveFabric={handleSaveFabric}
            globalExchangeRate={globalExchangeRate}
            yarnLibrary={yarnLibrary}
            // ── 원가 설정 (편직 정액·LOSS·가공 유형 등) ──
            costSettings={costSettings}
            onOpenCostSettings={openCostSettings}
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
            costSettings={costSettings}
            onOpenCostSettings={openCostSettings}
            saveBatchToCloud={saveBatchToCloud}
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
            handleDownloadQuoteExcel={handleDownloadQuoteExcel}
            handleNewQuote={handleNewQuote}
            handleQuoteSettingChange={handleQuoteSettingChange}
            handleRecalcQuote={handleRecalcQuote}
            handleQuoteMarginChange={handleQuoteMarginChange}
            handleBulkMarginRateChange={handleBulkMarginRateChange}
            handleQuoteItemMarginChange={handleQuoteItemMarginChange}
            handleToggleShownTier={handleToggleShownTier}
            handleResetTierDefaults={handleResetTierDefaults}
            handleQuoteExcludeChange={handleQuoteExcludeChange}
            handleRemoveItemsFromQuote={handleRemoveItemsFromQuote}
            handleCopyToCustom={handleCopyToCustom}
            handleAddCustomFabric={handleAddCustomFabric}
            handleCustomItemChange={handleCustomItemChange}
            handleRemoveCustomItems={handleRemoveCustomItems}
            handleCustomExcludeChange={handleCustomExcludeChange}
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
            handleRegeneratePINo={handleRegeneratePINo}
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
            getBlankDevInput={getBlankDevInput}
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
                onRequestClose={requestCloseSheet}
                designSheets={designSheets}
                knittingFactories={knittingFactories}
                dyeingFactories={dyeingFactories}
                machineTypes={machineTypes}
                structures={structures}
                setActiveMasterModal={setActiveMasterModal}
                savedFabrics={savedFabrics}
                saveSheetAndRegisterFabric={saveSheetAndRegisterFabric}
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
                getBlankDetailInput={getBlankDetailInput}
                costSettings={costSettings}
                onOpenCostSettings={openCostSettings}
              />
            </div>
          </div>
        )}
        <UnsavedChangesDialog
          open={sheetLeavePending}
          message="작성 중인 설계서에 저장하지 않은 변경사항이 있어요. 저장할까요?"
          onSave={saveSheetAndClose}
          onDiscard={closeSheetEditor}
          onKeepEditing={() => setSheetLeavePending(false)}
        />

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
            getBlankTempInput={getBlankTempInput}
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
            costSettings={costSettings}
            onOpenCostSettings={openCostSettings}
          />
        )}

        {activeTab === 'mainDetail' && (
          <MainDetailPage
            getBlankDetailInput={getBlankDetailInput}
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


        {/* TAB: 생산 현황 (v8 — 엑셀형 현황표 / 오더별 간트, 상세창·LOT 편집 포함) */}
        {activeTab === 'orderList' && (
          <OrderListPage
            orders={productionOrders}
            drafts={productionDrafts}
            actions={orderActions}
            masters={{ knittingFactories, dyeingFactories, yarnSuppliers }}
            savedFabrics={savedFabrics}
            {...partnerBag}
          />
        )}

        {/* TAB: 리포트 */}
        {activeTab === 'orderReport' && (
          <ReportPage orders={productionOrders} />
        )}

        {/* 모달 3종 (엑셀 업로드 2 + 카테고리 관리) */}
        {isBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원단 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드 (원사정보 포함됨)</p><button onClick={handleDownloadTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} ref={fileInputRef} /></label></div></div></div></div>)}
        {isYarnBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsYarnBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원사 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드</p><button onClick={handleDownloadYarnTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 원사 양식 다운로드 (.xlsx)</button><p className="text-[11px] text-slate-500 mt-2 leading-relaxed">수입 원사는 <b>Import</b> 열에 <b>Y</b>, <b>ImportCountry</b> 열에 나라 이름(예: 중국)을 넣어 주세요. 나라를 비우면 중국으로 등록돼요. 기본 공급처는 <b>IsDefault</b> 열에 <b>Y</b>.</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">이미 있는 원사 이름이면 새로 만들지 않고 그 원사의 공급처를 더하거나 값을 고쳐요 (빈 칸은 그대로, 수입을 끄려면 Import에 <b>N</b>). 원사 백업 파일을 고쳐서 다시 올려도 돼요.</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleYarnFileUpload} ref={yarnFileInputRef} /></label></div></div></div></div>)}

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
          onClose={() => setIsBuyerModalOpen(false)}
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
          quoteInput={pdfQuote || quoteInput}
          kind={pdfKind}
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

        {/* 원가 설정 모달 — 열릴 때만 마운트해 설정값 재시드 (원단 관리·원가 표의 ⚙ 버튼) */}
        {isCostSettingsOpen && (
          <CostSettingsModal
            onClose={() => setIsCostSettingsOpen(false)}
            costSettings={costSettings}
            onSave={saveCostSettings}
            showToast={showToast}
            savedFabrics={savedFabrics}
            designSheets={designSheets}
            tempDesignSheets={tempDesignSheets}
            yarnLibrary={yarnLibrary}
            initialFocus={costSettingsFocus}
          />
        )}

        {/* Lab-Dip 인쇄 문서 (off-screen, body.printing-labdip 일 때만 노출) */}
        <LabdipPrintSheet labdip={selectedLabdipForPrint} />
      </div>
    </div>
  );
};

export default App;