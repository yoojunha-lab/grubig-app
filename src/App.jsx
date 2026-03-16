import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, FileSpreadsheet, Calculator,
  RotateCcw, Layers, Edit2, Check, X, Box, Search, ChevronDown, ChevronUp,
  TrendingUp, Users, Factory, FileText, Calendar, Upload,
  Globe, Home, DollarSign, History, AlertCircle, Info, Filter, Truck, Download,
  Cloud, LogOut, Database, ClipboardPaste, Menu, Eye, Settings
} from 'lucide-react';

// 🔥 Firebase 모듈
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, collection, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBVMPRApW7oMiWGGG_ILQaqfgkHeoHlJk8",
  authDomain: "grubig-app.firebaseapp.com",
  projectId: "grubig-app",
  storageBucket: "grubig-app.firebasestorage.app",
  messagingSenderId: "924930443548",
  appId: "1:924930443548:web:b5c19871f4417a263512d9",
  measurementId: "G-HGR6VH6TDX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const ALLOWED_DOMAIN = "@grubig.kr";

const DEFAULT_YARN_CATEGORIES = ['소모', '방모', '화섬', 'SPANDEX', '면방', '린넨방'];
const MARGIN_TIERS = { 0: 10, 1: 13, 2: 16, 3: 19, 4: 22, 5: 25, 6: 28 };

const num = (v) => Number(v || 0).toLocaleString();
const usd = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const useXLSX = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (window.XLSX) { setIsReady(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);
  return isReady;
};

const useHTML2PDF = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (window.html2pdf) { setIsReady(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);
  return isReady;
};

const SearchableSelect = ({ value, options = [], onChange, placeholder, labelKey = 'name', valueKey = 'id' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const selected = (options || []).find(o => String(o?.[valueKey]) === String(value));
    if (selected) setSearch(String(selected[labelKey] || ''));
    else setSearch('');
  }, [value, options, labelKey, valueKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        const selected = (options || []).find(o => String(o?.[valueKey]) === String(value));
        setSearch(selected ? String(selected[labelKey] || '') : '');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, labelKey, valueKey]);

  const filteredOptions = (options || []).filter(opt => String(opt?.[labelKey] || '').toLowerCase().includes(String(search || '').toLowerCase()));

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <div className="relative">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value.toUpperCase()); setIsOpen(true); if (e.target.value === '') onChange(''); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase" />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <button className="absolute right-2 top-2 text-slate-400 hover:text-slate-600" onClick={() => setIsOpen(!isOpen)}><ChevronDown className="w-4 h-4" /></button>
      </div>
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button key={String(opt[valueKey])} onClick={() => { onChange(opt[valueKey]); setSearch(String(opt[labelKey])); setIsOpen(false); }} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${String(value) === String(opt[valueKey]) ? 'bg-blue-50' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-1"><span className={`font-medium ${String(value) === String(opt[valueKey]) ? 'text-blue-700' : 'text-slate-700'}`}>{String(opt[labelKey])}</span>{opt.price !== undefined && <span className="text-xs font-mono text-slate-500">{opt.currency === 'USD' ? '$' : '￦'}{num(opt.price)}</span>}</div>
              </button>
            ))
          ) : <div className="px-3 py-4 text-center text-xs text-slate-400">검색 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('calculator');
  const [yarnLibrary, setYarnLibrary] = useState([]);
  const [savedFabrics, setSavedFabrics] = useState([]);
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_YARN_CATEGORIES);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [viewMode, setViewMode] = useState('domestic');
  const [yarnFilterCategory, setYarnFilterCategory] = useState('All');
  const [yarnFilterSupplier, setYarnFilterSupplier] = useState('All');

  const [quoteAuthorFilter, setQuoteAuthorFilter] = useState('All');
  const [quoteBuyerFilter, setQuoteBuyerFilter] = useState('');
  const [quoteDateFilter, setQuoteDateFilter] = useState('');
  const [quoteMarketFilter, setQuoteMarketFilter] = useState('All');

  const [editingFabricId, setEditingFabricId] = useState(null);
  const [editingYarnId, setEditingYarnId] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isYarnBulkModalOpen, setIsYarnBulkModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const [fabricSearchTerm, setFabricSearchTerm] = useState('');
  const [yarnSearchTerm, setYarnSearchTerm] = useState('');
  const [expandedFabricId, setExpandedFabricId] = useState(null);
  const [quickViewQuote, setQuickViewQuote] = useState(null);

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
      if (docSnap.exists() && docSnap.data().yarnCategories) {
        setCategories(docSnap.data().yarnCategories);
      } else {
        setDoc(doc(db, 'settings', 'general'), { yarnCategories: DEFAULT_YARN_CATEGORIES }, { merge: true });
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
    return () => { unsubSettings(); unsubYarns(); unsubFabrics(); unsubQuotes(); };
  }, [user]);

  const saveDocToCloud = async (colName, item) => { setSyncStatus('syncing'); try { await setDoc(doc(db, colName, String(item.id)), item); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("저장 실패", "error"); } };
  const deleteDocFromCloud = async (colName, id) => { setSyncStatus('syncing'); try { await deleteDoc(doc(db, colName, String(id))); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("삭제 실패", "error"); } };
  const saveBatchToCloud = async (colName, items) => { setSyncStatus('syncing'); try { const batch = writeBatch(db); items.forEach(item => batch.set(doc(db, colName, String(item.id)), item)); await batch.commit(); setSyncStatus('saved'); } catch (e) { setSyncStatus('error'); showToast("일괄 저장 실패", "error"); } };

  const [fabricInput, setFabricInput] = useState({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', exchangeRate: 1450, remarks: '',
    knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, dyeingFee: 8800, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500,
    losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
    marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
    yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
  });

  const [yarnInput, setYarnInput] = useState({
    category: '소모', name: '', remarks: '',
    suppliers: [{ id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: true }]
  });

  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', buyerType: 'converter', marketType: 'domestic', currency: 'KRW', exchangeRate: 1450, date: new Date().toISOString().split('T')[0], extraMargin: 0, remarks: '', items: []
  });

  const [selectedFabricIdForQuote, setSelectedFabricIdForQuote] = useState('');
  const [bulkArticleInput, setBulkArticleInput] = useState('');

  const [editingCategoryOld, setEditingCategoryOld] = useState(null);
  const [editingCategoryNew, setEditingCategoryNew] = useState('');

  const showToast = (message, type = 'success') => { setNotification({ show: true, message, type }); setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000); };
  const calculateGYd = (gsm, widthFull) => Math.round(gsm * widthFull * 0.02322576);
  const smartRound = (value, currency) => currency === 'USD' ? Number(value.toFixed(2)) : Math.round(value / 100) * 100;
  const applyGrossMargin = (cost, margin) => margin >= 100 ? 0 : cost / (1 - (margin / 100));
  const getLastDayOfQuoteMonth = (dateString) => {
    const d = dateString ? new Date(dateString) : new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const getSafeTier = () => ({
    domestic: { yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, priceConverter: 0, priceBrand: 0 },
    export: { yarnCostYd: 0, knitCostYd: 0, dyeCostYd: 0, extraFeeYd: 0, totalCostYd: 0, priceConverter: 0, priceBrand: 0 },
    requiredKg: 0
  });

  const calculateCost = (fabricData, overrideExchangeRate = null) => {
    if (!fabricData || !fabricData.yarns) return { avgYarnCostDomestic: 0, avgYarnCostExport: 0, effectiveGYd: 0, theoreticalGYd: 0, tier1k: getSafeTier(), tier3k: getSafeTier(), tier5k: getSafeTier() };

    let yarnCostDomestic = 0; let yarnCostExport = 0;
    const fabricExchangeRate = overrideExchangeRate !== null ? Number(overrideExchangeRate) : (Number(fabricData.exchangeRate) || 1450);

    (fabricData.yarns || []).forEach(slot => {
      if (slot?.yarnId && Number(slot.ratio) > 0) {
        const realYarnId = String(slot.yarnId).split('::')[0];
        const yarn = (yarnLibrary || []).find(y => String(y.id) === String(realYarnId));
        if (yarn) {
          const sup = (yarn.suppliers || []).find(s => s.isDefault) || yarn.suppliers?.[0];
          if (sup) {
            const ratio = Number(slot.ratio) / 100;
            let priceInKrw = sup.currency === 'USD' ? Number(sup.price || 0) * fabricExchangeRate : Number(sup.price || 0);
            const tariffAmt = priceInKrw * ((Number(sup.tariff) || 0) / 100);
            const freightAmt = priceInKrw * ((Number(sup.freight) || 0) / 100);
            yarnCostExport += (priceInKrw + freightAmt) * ratio;
            yarnCostDomestic += (priceInKrw + tariffAmt + freightAmt) * ratio;
          }
        }
      }
    });

    const theoreticalGYd = calculateGYd(Number(fabricData.gsm || 0), Number(fabricData.widthFull || 0));
    const effectiveGYd = fabricData.costGYd && Number(fabricData.costGYd) > 0 ? Number(fabricData.costGYd) : theoreticalGYd;
    const weightPerYdKg = (effectiveGYd || 1) / 1000;

    const calcTier = (tierKey, knittingFeeKg, qty) => {
      const specificLoss = (fabricData.losses && fabricData.losses[tierKey]) || { knit: 0, dye: 0 };
      const totalLossRate = (Number(specificLoss.knit || 0) + Number(specificLoss.dye || 0)) / 100;
      const safeLossRate = totalLossRate >= 1 ? 0.99 : totalLossRate;

      let extraFee = 0;
      if (tierKey === 'tier1k') extraFee = Number(fabricData.extraFee1k) || 0;
      if (tierKey === 'tier3k') extraFee = Number(fabricData.extraFee3k) || 0;
      if (tierKey === 'tier5k') extraFee = Number(fabricData.extraFee5k) || 0;

      const costKnitYd = (Number(knittingFeeKg || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costDyeYd = (Number(fabricData.dyeingFee || 0) / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdDomestic = (yarnCostDomestic / (1 - safeLossRate)) * weightPerYdKg;
      const costYarnYdExport = (yarnCostExport / (1 - safeLossRate)) * weightPerYdKg;

      const totalCostYdDomesticKRW = costYarnYdDomestic + costKnitYd + costDyeYd + extraFee;
      const totalCostYdExportKRW = costYarnYdExport + costKnitYd + costDyeYd + extraFee;

      const marginPct = MARGIN_TIERS[fabricData.marginTier || 3] || 19;
      const brandEx = Number((fabricData.brandExtra && fabricData.brandExtra[tierKey]) || 0);

      const domesticPriceConv = applyGrossMargin(totalCostYdDomesticKRW, marginPct);
      const domesticPriceBrand = domesticPriceConv + brandEx;
      const totalCostYdExportUSD = totalCostYdExportKRW / fabricExchangeRate;
      const exportPriceConv = applyGrossMargin(totalCostYdExportUSD, marginPct);
      const exportPriceBrand = exportPriceConv + (brandEx / fabricExchangeRate);

      return {
        domestic: { yarnCostYd: costYarnYdDomestic, knitCostYd: costKnitYd, dyeCostYd: costDyeYd, extraFeeYd: extraFee, totalCostYd: Math.round(totalCostYdDomesticKRW), priceConverter: smartRound(domesticPriceConv, 'KRW'), priceBrand: smartRound(domesticPriceBrand, 'KRW') },
        export: { yarnCostYd: costYarnYdExport / fabricExchangeRate, knitCostYd: costKnitYd / fabricExchangeRate, dyeCostYd: costDyeYd / fabricExchangeRate, extraFeeYd: extraFee / fabricExchangeRate, totalCostYd: Number(totalCostYdExportUSD.toFixed(2)), priceConverter: smartRound(exportPriceConv, 'USD'), priceBrand: smartRound(exportPriceBrand, 'USD') },
        requiredKg: Math.round((qty * weightPerYdKg) / (1 - safeLossRate))
      };
    };

    return {
      avgYarnCostDomestic: Math.round(yarnCostDomestic), avgYarnCostExport: Math.round(yarnCostExport),
      effectiveGYd, theoreticalGYd,
      tier1k: calcTier('tier1k', fabricData.knittingFee1k, 1000),
      tier3k: calcTier('tier3k', fabricData.knittingFee3k, 3000),
      tier5k: calcTier('tier5k', fabricData.knittingFee5k, 5000),
    };
  };

  const handleFabricChange = (e) => {
    let { name, value } = e.target;
    if (name === 'article') value = String(value || '').toUpperCase();
    setFabricInput(prev => ({ ...prev, [name]: (name === 'article' || name === 'itemName' || name === 'costGYd' || name === 'remarks') ? value : Number(value) }));
  };
  const handleNestedChange = (section, tier, field, value) => { setFabricInput(prev => ({ ...prev, [section]: { ...prev[section], [tier]: field ? { ...prev[section][tier], [field]: Number(value) } : Number(value) } })); };
  const handleYarnSlotChange = (index, field, value) => { const newYarns = [...fabricInput.yarns]; newYarns[index] = { ...newYarns[index], [field]: field === 'ratio' ? Number(value) : String(value || '') }; setFabricInput({ ...fabricInput, yarns: newYarns }); };

  const handleSaveFabric = () => {
    if (!fabricInput.article) { showToast("Article을 입력해주세요.", 'error'); return; }
    const itemToSave = { id: editingFabricId || Date.now(), date: new Date().toLocaleDateString(), ...fabricInput };
    saveDocToCloud('fabrics', itemToSave); resetForm(); setActiveTab('list');
  };

  const resetForm = () => {
    setFabricInput({ article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', exchangeRate: 1450, remarks: '', knittingFee1k: 3000, knittingFee3k: 2000, knittingFee5k: 2000, dyeingFee: 8800, extraFee1k: 900, extraFee3k: 700, extraFee5k: 500, losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } }, marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 }, yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }] });
    setEditingFabricId(null);
  };

  const handleEditFabric = (fabric) => {
    setFabricInput({ ...fabric, remarks: String(fabric.remarks || ''), losses: fabric.losses || { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } } });
    setEditingFabricId(fabric.id); setActiveTab('calculator');
  };

  const handleSaveYarn = () => {
    if (!yarnInput.name) return;
    const itemToSave = { id: editingYarnId || `y${Date.now()}`, ...yarnInput, name: String(yarnInput.name).toUpperCase(), category: String(yarnInput.category).toUpperCase(), suppliers: yarnInput.suppliers.map(s => ({ ...s, name: String(s.name).toUpperCase(), history: s.history || [] })) };
    saveDocToCloud('yarns', itemToSave); setEditingYarnId(null);
    setYarnInput({ category: '소모', name: '', remarks: '', suppliers: [{ id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: true }] });
  };

  const getMergedYarnName = (slotId) => {
    if (!slotId) return '';
    const yId = String(slotId).split('::')[0];
    const yarn = yarnLibrary.find(y => String(y.id) === String(yId));
    if (!yarn) return '';
    const sup = yarn.suppliers?.find(s => s.isDefault) || yarn.suppliers?.[0];
    return sup ? `${yarn.name} [${sup.name}]` : yarn.name;
  };

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

  const EXCEL_HEADERS = ['Article', 'ItemName', 'WidthFull', 'WidthCut', 'GSM', 'CostGYd', 'KnittingFee1k', 'KnittingFee3k', 'KnittingFee5k', 'DyeingFee', 'ExtraFee1k', 'ExtraFee3k', 'ExtraFee5k', 'Remarks', 'Yarn1_Name', 'Yarn1_Ratio', 'Yarn2_Name', 'Yarn2_Ratio', 'Yarn3_Name', 'Yarn3_Ratio', 'Yarn4_Name', 'Yarn4_Ratio'];
  const handleDownloadTemplate = () => {
    if (!isXlsxReady) return;
    const exampleRow = ['SAMPLE-01', 'Cotton Jersey', 58, 56, 300, 320, 3000, 2000, 2000, 8800, 900, 700, 500, '바이어 요청 샘플', 'CM 30S', 100, '', 0, '', 0, '', 0];
    const ws = window.XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, exampleRow]);
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "원단일괄등록"); window.XLSX.writeFile(wb, '원단등록_양식_상세.xlsx');
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
            const yRatio = Number(row[`Yarn${i}_Ratio`]) || 0;
            if (yName) {
              const found = yarnLibrary.find(y => String(y.name).toUpperCase() === yName);
              if (found) mappedYarns.push({ yarnId: found.id, ratio: yRatio });
              else { missingYarnNames.add(yName); mappedYarns.push({ yarnId: '', ratio: yRatio }); }
            } else { mappedYarns.push({ yarnId: '', ratio: 0 }); }
          }
          newFabrics.push({
            id: Date.now() + idx, date: new Date().toLocaleDateString(),
            article: String(row.Article || 'UNKNOWN').trim().toUpperCase(), itemName: String(row.ItemName || ''), remarks: String(row.Remarks || ''),
            widthFull: Number(row.WidthFull) || 58, widthCut: Number(row.WidthCut) || 56, gsm: Number(row.GSM) || 300, costGYd: row.CostGYd ? Number(row.CostGYd) : '', exchangeRate: 1450,
            knittingFee1k: kFee1k, knittingFee3k: Number(row.KnittingFee3k) || 2000, knittingFee5k: Number(row.KnittingFee5k) || 2000, dyeingFee: Number(row.DyeingFee) || 8800,
            extraFee1k: Number(row.ExtraFee1k) || 900, extraFee3k: Number(row.ExtraFee3k) || 700, extraFee5k: Number(row.ExtraFee5k) || 500,
            losses: { tier1k: { knit: 5, dye: 10 }, tier3k: { knit: 3, dye: 10 }, tier5k: { knit: 3, dye: 9 } },
            marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 }, yarns: mappedYarns
          });
        });

        setSavedFabrics([...newFabrics, ...savedFabrics]); saveBatchToCloud('fabrics', newFabrics); setIsBulkModalOpen(false);
        if (missingYarnNames.size > 0) alert(`✅ 원단 등록은 완료되었으나, 다음 원사는 라이브러리에 없어서 '빈칸' 처리되었습니다.\n\n[없는 원사 목록]\n${[...missingYarnNames].join(', ')}\n\n* 등록 후 해당 원단을 라이브러리에 추가하거나 수정해주세요!`);
        else showToast(`${newFabrics.length}건이 완벽하게 등록되었습니다.`, 'success');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) { alert(`엑셀 업로드 중 오류가 발생했습니다: ${err.message}`); }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  const YARN_EXCEL_HEADERS = ['Category', 'Name', 'Supplier', 'Currency', 'Price', 'Tariff', 'Freight', 'Remarks'];
  const handleDownloadYarnTemplate = () => {
    if (!isXlsxReady) return;
    const ws = window.XLSX.utils.aoa_to_sheet([YARN_EXCEL_HEADERS, ['소모', '2/48 WOOL', 'XINAO', 'KRW', 18000, 8, 2, 'Standard']]);
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "원사일괄등록"); window.XLSX.writeFile(wb, '원사등록_양식.xlsx');
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

  const handleAddSupplier = () => {
    setYarnInput(prev => ({
      ...prev, suppliers: [...prev.suppliers, { id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: prev.suppliers.length === 0 }]
    }));
  };

  const handleRemoveSupplier = (supId) => {
    setYarnInput(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== supId).map((s, i) => ({ ...s, isDefault: i === 0 })) }));
  };

  const handleSupplierChange = (supId, field, value) => {
    setYarnInput(prev => ({
      ...prev, suppliers: prev.suppliers.map(s => {
        if (field === 'isDefault' && value === true) return { ...s, isDefault: s.id === supId };
        if (s.id === supId) return { ...s, [field]: field === 'name' ? String(value).toUpperCase() : value };
        return s;
      })
    }));
  };

  const handleDeleteHistoryItem = (supId, hIdx) => {
    setYarnInput(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => {
        if (s.id === supId) {
          const newHistory = [...s.history];
          newHistory.splice(hIdx, 1);
          return { ...s, history: newHistory };
        }
        return s;
      })
    }));
  };

  const handleEditYarn = (yarn) => {
    const safeSuppliers = yarn.suppliers && yarn.suppliers.length > 0 ? yarn.suppliers : [{ id: 'sup_legacy', name: yarn.supplier || '기본업체', currency: yarn.currency || 'KRW', price: yarn.price || 0, tariff: yarn.tariff || 0, freight: yarn.freight || 0, history: yarn.history || [], isDefault: true }];
    setYarnInput({ category: yarn.category || '소모', name: yarn.name, remarks: yarn.remarks || '', suppliers: safeSuppliers });
    setEditingYarnId(yarn.id);
  };

  const handleCancelYarnEdit = () => { setEditingYarnId(null); setYarnInput({ category: '소모', name: '', remarks: '', suppliers: [{ id: 'sup_' + Date.now(), name: '', currency: 'KRW', price: '', tariff: 8, freight: 0, history: [], isDefault: true }] }); };

  const handleDeleteYarn = (id) => {
    const isUsed = savedFabrics.some(fabric => fabric.yarns.some(y => y.yarnId && String(y.yarnId).split('::')[0] === String(id) && y.ratio > 0));
    if (isUsed) { alert("🚨 경고: 이 원사를 사용 중인 원단이 있습니다! 삭제 불가."); return; }
    if (window.confirm("이 원사와 등록된 모든 공급처 정보가 삭제됩니다. 삭제하시겠습니까?")) { setYarnLibrary(yarnLibrary.filter(y => y.id !== id)); deleteDocFromCloud('yarns', id); }
  };

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

        for (let i = 0; i < yarnsToUpdate.length; i += 450) {
          const batch = writeBatch(db);
          const chunk = yarnsToUpdate.slice(i, i + 450);
          chunk.forEach(y => { batch.update(doc(db, 'yarns', String(y.id)), { category: upperNew }); });
          await batch.commit();
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

  const handleQuoteSettingChange = (field, value) => {
    setQuoteInput(prev => {
      let next = { ...prev, [field]: value };
      if (field === 'marketType') next.currency = value === 'export' ? 'USD' : 'KRW';

      if (['exchangeRate', 'marketType', 'buyerType'].includes(field)) {
        next.items = next.items.map(item => {
          const fabric = savedFabrics.find(f => String(f.id) === String(item.fabricId));
          if (!fabric) return item;
          return createQuoteItem(fabric, next.exchangeRate, next.marketType, next.buyerType);
        });
      }
      return next;
    });
  };

  // ✅ 견적서 G/YD를 "이론 중량(Theoretical G/YD)"으로 고정
  const createQuoteItem = (fabric, currentExchangeRate, currentMarketType, currentBuyerType) => {
    const calc = calculateCost(fabric, currentExchangeRate);
    const isBrand = currentBuyerType === 'brand';
    const d1k = calc.tier1k[currentMarketType]; const d3k = calc.tier3k[currentMarketType]; const d5k = calc.tier5k[currentMarketType];

    // MCQ는 실제 중량 베이스로 로스 10% 감안하여 계산
    const weightWithLoss = calc.effectiveGYd * 1.1;
    const rawMcqYd = 100000 / weightWithLoss;
    const roundedMcq = Math.round(rawMcqYd / 100) * 100;
    const finalMcqYd = Math.max(300, roundedMcq);

    return {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm,
      gYd: calc.theoreticalGYd, // 🎯 견적서 표기용은 Theoretical 고정
      mcqYd: finalMcqYd,
      basePrice1k: isBrand ? d1k.priceBrand : d1k.priceConverter,
      basePrice3k: isBrand ? d3k.priceBrand : d3k.priceConverter,
      basePrice5k: isBrand ? d5k.priceBrand : d5k.priceConverter,
    };
  };

  const handleAddFabricToQuote = () => {
    if (!selectedFabricIdForQuote) { showToast("견적서에 추가할 원단을 선택해주세요.", 'error'); return; }
    const fabric = savedFabrics.find(f => String(f.id) === String(selectedFabricIdForQuote));
    if (!fabric) return;
    const newItem = createQuoteItem(fabric, quoteInput.exchangeRate, quoteInput.marketType, quoteInput.buyerType);
    setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), newItem] })); setSelectedFabricIdForQuote(''); showToast(`원단이 추가되었습니다.`, 'success');
  };

  const handleGridPaste = (text) => {
    const articles = String(text).split('\n').map(a => String(a).trim().toUpperCase()).filter(a => a);
    let newItems = [];
    let notFound = [];
    articles.forEach(art => {
      const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
      if (fabric) { newItems.push(createQuoteItem(fabric, quoteInput.exchangeRate, quoteInput.marketType, quoteInput.buyerType)); }
      else { notFound.push(art); }
    });
    if (newItems.length > 0) {
      setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), ...newItems] }));
      showToast(`${newItems.length}개의 원단이 일괄 추가되었습니다.`, 'success');
    }
    if (notFound.length > 0) alert(`다음 Article은 리스트에 없습니다:\n\n${notFound.join('\n')}`);
  };

  const handleQuoteBasePriceChange = (index, field, value) => {
    const newItems = [...quoteInput.items];
    newItems[index][field] = Number(value);
    setQuoteInput({ ...quoteInput, items: newItems });
  };
  const handleRemoveItemFromQuote = (index) => { const newItems = quoteInput.items.filter((_, i) => i !== index); setQuoteInput({ ...quoteInput, items: newItems }); };

  const handleSaveQuote = () => {
    if (!quoteInput.buyerName) { showToast("바이어 이름을 입력해주세요.", 'error'); return; }
    if (!quoteInput.items || quoteInput.items.length === 0) { showToast("원단을 추가해주세요.", 'error'); return; }
    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
    const itemToSave = { id: Date.now(), createdAt: new Date().toLocaleString(), authorName: authorName, ...quoteInput };
    setSavedQuotes([itemToSave, ...savedQuotes]); saveDocToCloud('quotes', itemToSave); showToast("견적서가 저장되었습니다.", 'success');
  };

  const handleDeleteQuote = (id) => {
    if (window.confirm("이 견적 히스토리를 정말 삭제하시겠습니까?")) {
      setSavedQuotes(savedQuotes.filter(q => q.id !== id));
      deleteDocFromCloud('quotes', id);
    }
  };

  const handleDownloadPDF = () => {
    if (!isPdfReady) { showToast("PDF 로딩 중입니다.", 'error'); return; }
    if (!quoteInput.items || quoteInput.items.length === 0) { showToast("내용이 없습니다.", 'error'); return; }
    setIsPdfGenerating(true); showToast("PDF 생성 중... (잠시만 기다려주세요)", 'info');
    setTimeout(() => {
      if (printRef.current && window.html2pdf) {
        const opt = {
          margin: 0,
          filename: `Quotation_${String(quoteInput.buyerName).replace(/[^a-zA-Z0-9\s-]/g, '')}_${quoteInput.date}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        window.html2pdf().set(opt).from(printRef.current).save().then(() => { setIsPdfGenerating(false); showToast("PDF 다운로드 완료.", 'success'); });
      } else { setIsPdfGenerating(false); }
    }, 800);
  };

  const formatQuotePrice = (price) => { return quoteInput.currency === 'USD' ? `$${usd(price)}` : `￦${num(price)}`; };
  const getBasePrice = (item, key) => item[`basePrice${key}`] !== undefined ? item[`basePrice${key}`] : (item[`price${key}`] || 0);

  const currentCalcFull = calculateCost(fabricInput);
  const uniqueSuppliers = ['All', ...new Set(yarnLibrary.flatMap(y => (y.suppliers || []).map(s => String(s.name).toUpperCase())).filter(Boolean))];
  const dynamicCategories = [...new Set([...DEFAULT_YARN_CATEGORIES, ...(categories || []), ...yarnLibrary.map(y => String(y.category || '').toUpperCase())])].filter(Boolean);

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
  if (!user) return (<div className="min-h-screen flex items-center justify-center bg-slate-900 p-4"><div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl text-center shadow-2xl border border-slate-700"><div className="bg-blue-600 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-900"><Cloud className="text-white w-12 h-12" /></div><h1 className="text-3xl font-bold text-white mb-2">GRUBIG Cloud</h1><p className="text-slate-400 mb-8">@grubig.kr 전용 관리 시스템</p><button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 shadow-xl"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" /> 구글 계정으로 로그인</button></div></div>);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row print:bg-white relative">
      {notification.show && (<div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all animate-in slide-in-from-top-5 fade-in duration-300 ${notification.type === 'error' ? 'bg-red-500 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>{notification.type === 'success' && <Check className="w-5 h-5" />}{notification.type === 'error' && <AlertCircle className="w-5 h-5" />}{notification.type === 'info' && <Info className="w-5 h-5" />}<span className="font-bold text-sm">{notification.message}</span><button onClick={() => setNotification({ ...notification, show: false })} className="ml-2 hover:opacity-80"><X className="w-4 h-4" /></button></div>)}

      {/* ✅ 모바일 최적화: 햄버거 메뉴 레이아웃 강화 */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-50 sticky top-0 h-[60px]">
        <div className="font-bold flex items-center gap-2"><Cloud className="w-5 h-5 text-blue-400" /> GRUBIG ERP</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1"><Menu className="w-6 h-6" /></button>
      </div>

      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:flex w-full md:w-64 bg-slate-900 text-slate-300 p-4 flex-col shrink-0 print:hidden absolute top-[60px] md:top-0 md:relative z-40 h-[calc(100vh-60px)] md:min-h-screen overflow-y-auto`}>
        <div className="flex items-center justify-between mb-8 px-2 mt-4"><div className="flex items-center gap-3"><div className="bg-blue-600 p-2 rounded-lg"><Layers className="text-white w-6 h-6" /></div><div><h1 className="text-lg font-bold text-white">Fabric Cost</h1><p className="text-xs text-slate-500">Master Manager</p></div></div>{syncStatus === 'syncing' ? <Cloud className="w-4 h-4 text-yellow-400 animate-pulse" title="동기화 중..." /> : <Cloud className="w-4 h-4 text-emerald-400" title="안전하게 저장됨" />}</div>
        <div className="bg-slate-800 p-1 rounded-lg mb-6 flex text-xs font-bold"><button onClick={() => setViewMode('domestic')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${viewMode === 'domestic' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Home className="w-3 h-3" /> 내수</button><button onClick={() => setViewMode('export')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${viewMode === 'export' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Globe className="w-3 h-3" /> 수출</button></div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => { setActiveTab('calculator'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'calculator' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calculator className="w-5 h-5" /> <span>원단등록</span></button>
          <button onClick={() => { setActiveTab('list'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><FileSpreadsheet className="w-5 h-5" /> <span>원단 리스트</span></button>
          <button onClick={() => { setActiveTab('yarns'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'yarns' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Box className="w-5 h-5" /> <span>원사 라이브러리</span></button>
          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-4 text-xs font-bold text-slate-500 mb-2 uppercase">Sales & Export</p>
            <button onClick={() => { setActiveTab('quotation'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'quotation' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><FileText className="w-5 h-5" /> <span>견적서 작성</span></button>
            <button onClick={() => { setActiveTab('quoteHistory'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'quoteHistory' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar className="w-5 h-5" /> <span>견적 히스토리</span></button>
          </div>
        </nav>
        <button onClick={handleLogout} className="mt-6 flex items-center justify-center gap-2 px-4 py-3 text-xs text-slate-500 hover:text-white border border-slate-700 rounded-xl transition-colors w-full"><LogOut className="w-4 h-4" /> 로그아웃</button>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-60px)] md:max-h-screen print:p-0 print:overflow-visible relative w-full overflow-x-hidden">

        {/* TAB 1: CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="max-w-7xl mx-auto space-y-6 print:hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{editingFabricId ? <span className="text-yellow-600">아이템 수정 중</span> : "새 원단 등록"}</h2><div className="flex items-center gap-2 mt-1"><span className={`text-xs font-bold px-2 py-0.5 rounded ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>현재 모드: {viewMode === 'domestic' ? '내수 (관세포함)' : '수출 (관세제외)'}</span></div></div>
              <div className="flex gap-2 w-full sm:w-auto">{editingFabricId && <button onClick={resetForm} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg"><X className="w-4 h-4 inline-block -mt-1 mr-1" />취소</button>}<button onClick={resetForm} className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-500 hover:bg-white hover:shadow-sm rounded-lg"><RotateCcw className="w-4 h-4 inline-block -mt-1 mr-1" />초기화</button></div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 space-y-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center"><span>1. Basic Info & Yarn <Info className="w-4 h-4 text-slate-300 inline" /></span><div className="flex items-center gap-2 bg-yellow-50 px-2 py-1 rounded border border-yellow-100"><label className="text-[10px] font-bold text-slate-500">적용 환율 (￦/$)</label><input type="number" name="exchangeRate" value={fabricInput.exchangeRate} onChange={handleFabricChange} className="w-16 bg-white border border-yellow-200 rounded text-right text-xs font-bold text-slate-700 px-1" /></div></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Article</label><input type="text" name="article" value={fabricInput.article} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase" placeholder="Ex. WO-24001" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label><input type="text" name="itemName" value={fabricInput.itemName} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="Item Name" /></div></div>
                  <div className="grid grid-cols-1 mb-4"><label className="block text-xs font-bold text-slate-500 mb-1">특이사항 (비고)</label><input type="text" name="remarks" value={fabricInput.remarks} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="원단 특이사항 메모 (예: 효성 크레오라 사용 요청)" /></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">내폭 (Cut)</label><input type="number" name="widthCut" value={fabricInput.widthCut} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="56" /></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">외폭 (Full)</label><input type="number" name="widthFull" value={fabricInput.widthFull} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="58" /></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">GSM</label><div className="relative"><input type="number" name="gsm" value={fabricInput.gsm} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="300" /><span className="absolute -bottom-5 right-0 text-[10px] text-slate-400">≈ {num(currentCalcFull.theoreticalGYd)} g/yd</span></div></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-red-500 mb-1">실제 G/YD</label><input type="number" name="costGYd" value={fabricInput.costGYd} onChange={handleFabricChange} className="w-full bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-right font-bold text-red-600" placeholder={num(currentCalcFull.theoreticalGYd)} /></div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 mt-6">
                    <p className="text-xs text-slate-400 font-bold mb-2">원사 혼용률 (Yarn Composition)</p>
                    {fabricInput.yarns.map((slot, idx) => (
                      <div key={idx} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                        <span className="text-xs font-mono text-slate-400 w-4 hidden sm:inline-block">{idx + 1}</span>
                        <SearchableSelect value={slot.yarnId} options={yarnSelectOptions} onChange={(id) => handleYarnSlotChange(idx, 'yarnId', id)} placeholder="원사 검색 (대표업체 기준)..." />
                        <div className="relative w-full sm:w-24 mt-2 sm:mt-0"><input type="number" value={slot.ratio} onChange={(e) => handleYarnSlotChange(idx, 'ratio', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-right text-sm" /><span className="absolute right-2 top-2 text-xs text-slate-400">%</span></div>
                      </div>
                    ))}
                    <div className="text-right text-xs text-slate-500 mt-2 font-mono">Avg Yarn Cost: ￦{viewMode === 'domestic' ? num(currentCalcFull.avgYarnCostDomestic) : num(currentCalcFull.avgYarnCostExport)} / kg</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center min-w-[500px]">2. Fees & Cost Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4 min-w-[500px]">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">염가공비 (￦/kg)</label><input type="number" name="dyeingFee" value={fabricInput.dyeingFee} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="8800" /></div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 text-xs text-center min-w-[500px]">
                    <div className="grid grid-cols-4 bg-slate-100 text-slate-600 font-bold py-2 border-b border-slate-200"><div className="text-left pl-3">항목 / 구간</div><div>1,000 YD</div><div className="text-blue-700 bg-blue-50/50">3,000 YD</div><div>5,000 YD</div></div>
                    <div className="divide-y divide-slate-100 bg-white">
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비(kg)</div><div className="px-1"><input type="number" name="knittingFee1k" value={fabricInput.knittingFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="knittingFee3k" value={fabricInput.knittingFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="knittingFee5k" value={fabricInput.knittingFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.knit} onChange={(e) => handleNestedChange('losses', 'tier1k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.knit} onChange={(e) => handleNestedChange('losses', 'tier3k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.knit} onChange={(e) => handleNestedChange('losses', 'tier5k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.dye} onChange={(e) => handleNestedChange('losses', 'tier1k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.dye} onChange={(e) => handleNestedChange('losses', 'tier3k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.dye} onChange={(e) => handleNestedChange('losses', 'tier5k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500 flex items-center gap-1">부대비용(YD)</div><div className="px-1"><input type="number" name="extraFee1k" value={fabricInput.extraFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="extraFee3k" value={fabricInput.extraFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="extraFee5k" value={fabricInput.extraFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div></div>

                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">원사비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.yarnCostYd)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.yarnCostYd)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.yarnCostYd)}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.knitCostYd)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.knitCostYd)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.knitCostYd)}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공비/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.dyeCostYd)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.dyeCostYd)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.dyeCostYd)}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">부대비용/YD</div><div>{num(currentCalcFull.tier1k[viewMode]?.extraFeeYd)}</div><div className="bg-blue-50/30 font-bold">{num(currentCalcFull.tier3k[viewMode]?.extraFeeYd)}</div><div>{num(currentCalcFull.tier5k[viewMode]?.extraFeeYd)}</div></div>

                      <div className="grid grid-cols-4 py-2 items-center bg-slate-100 border-t border-slate-200"><div className="text-left pl-3 text-xs font-bold text-slate-700">제조 원가</div><div className="font-mono">{num(currentCalcFull.tier1k[viewMode]?.totalCostYd)}</div><div className="bg-blue-100/50 font-mono font-bold text-blue-800">{num(currentCalcFull.tier3k[viewMode]?.totalCostYd)}</div><div className="font-mono">{num(currentCalcFull.tier5k[viewMode]?.totalCostYd)}</div></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">3. Sales Margin & Brand Extra</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-between">
                      <div>
                        <div className="text-emerald-800 font-bold text-sm mb-2 flex items-center gap-2"><Factory className="w-4 h-4" /> 도매(Conv) 마진 단계 지정</div>
                        <select value={fabricInput.marginTier} onChange={(e) => setFabricInput({ ...fabricInput, marginTier: Number(e.target.value) })} className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800 font-bold mt-2">
                          {Object.entries(MARGIN_TIERS).map(([tier, pct]) => (<option key={tier} value={tier}>{tier}단계 ({pct}%)</option>))}
                        </select>
                      </div>
                      <p className="text-xs text-emerald-600 mt-3">* 기본단가 = 제조원가 / (1 - {MARGIN_TIERS[fabricInput.marginTier || 0]}%) 로 계산됩니다.</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
                      <div>
                        <div className="text-indigo-800 font-bold text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Brand 직납 추가금 (￦/YD)</div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-indigo-600 font-bold mb-1 mt-2"><span>1,000 YD</span><span>3,000 YD</span><span>5,000 YD</span></div>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="number" value={fabricInput.brandExtra.tier1k} onChange={(e) => handleNestedChange('brandExtra', 'tier1k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="1000" />
                          <input type="number" value={fabricInput.brandExtra.tier3k} onChange={(e) => handleNestedChange('brandExtra', 'tier3k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="700" />
                          <input type="number" value={fabricInput.brandExtra.tier5k} onChange={(e) => handleNestedChange('brandExtra', 'tier5k', null, e.target.value)} className="w-full text-center rounded border border-indigo-200 text-sm font-bold text-indigo-700 py-1.5" placeholder="500" />
                        </div>
                      </div>
                      <p className="text-xs text-indigo-600 mt-3">* 기본단가에 위 금액(YD당)이 그대로 얹혀서 직납단가가 됩니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-5 space-y-6">
                <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl sticky top-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    판매 단가 분석표
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${viewMode === 'domestic' ? 'border-blue-400 text-blue-300' : 'border-emerald-400 text-emerald-300'}`}>{viewMode === 'domestic' ? 'Domestic (내수)' : 'Export (수출)'}</span>
                  </h3>
                  {['tier1k', 'tier3k', 'tier5k'].map(tier => {
                    const data = currentCalcFull[tier][viewMode];
                    const requiredKg = currentCalcFull[tier].requiredKg;
                    const label = tier === 'tier1k' ? '1,000 YD' : tier === 'tier3k' ? '3,000 YD' : '5,000 YD';
                    const symbol = viewMode === 'domestic' ? '￦' : '$';

                    return (
                      <div key={tier} className="mb-4 pb-4 border-b border-slate-700/50">
                        <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-slate-300">{label}</span><span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Need {num(requiredKg)}kg</span></div>
                        <div className="grid grid-cols-3 gap-2 text-right">
                          <div><p className="text-[10px] text-slate-500">원가</p><p className="font-mono text-slate-300 text-sm">{symbol}{num(data?.totalCostYd)}</p></div>
                          <div><p className="text-[10px] text-emerald-500">Conv (기본)</p><p className="font-mono text-emerald-400 font-bold">{symbol}{num(data?.priceConverter)}</p></div>
                          <div><p className="text-[10px] text-indigo-500">Brand (직납)</p><p className="font-mono text-indigo-400 font-bold">{symbol}{num(data?.priceBrand)}</p></div>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={handleSaveFabric} className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-900/50">
                    {editingFabricId ? <><Save className="w-4 h-4" /> 수정 저장</> : <><Plus className="w-4 h-4" /> 클라우드 저장</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ TAB 2: LIST (아코디언 카드형 UI 개편) */}
        {activeTab === 'list' && (
          <div className="max-w-[1600px] mx-auto print:hidden w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-4"><h2 className="text-2xl font-bold text-slate-800">원단 리스트 ({filteredFabrics.length})</h2><span className={`text-xs font-bold px-3 py-1 rounded-full ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{viewMode === 'domestic' ? '기준: 내수(관세포함)' : '기준: 수출(관세제외)'}</span></div>
              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64"><input type="text" placeholder="Article 검색..." value={fabricSearchTerm} onChange={(e) => setFabricSearchTerm(e.target.value.toUpperCase())} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white uppercase" /><Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />{fabricSearchTerm && <button onClick={() => setFabricSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}</div>
                <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto">
                  <button onClick={handleBackupFabrics} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
                  <button onClick={() => setIsBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex"><Upload className="w-4 h-4" /> 엑셀</button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto w-full">
              <table className="w-full text-sm text-left min-w-[1200px]">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th rowSpan="2" className="p-3 w-10 text-center border-r border-slate-200"></th>
                    <th rowSpan="2" className="p-3 border-r border-slate-200">Article</th>
                    <th rowSpan="2" className="p-3 border-r border-slate-200 text-center">Spec</th>
                    <th colSpan="3" className="p-2 text-center border-b border-r border-slate-200 bg-slate-100 text-slate-600">COST (원가)</th>
                    <th colSpan="3" className="p-2 text-center border-b border-r border-emerald-100 bg-emerald-50 text-emerald-700">CONV (도매)</th>
                    <th colSpan="3" className="p-2 text-center border-b border-indigo-100 bg-indigo-50 text-indigo-700">BRAND (직납)</th>
                    <th rowSpan="2" className="p-3 text-center border-l border-slate-200">Action</th>
                  </tr>
                  <tr className="text-[10px] text-center bg-slate-50/50">
                    <th className="p-2 border-r border-slate-200">1k</th><th className="p-2 border-r border-slate-200 text-blue-600 font-bold">3k</th><th className="p-2 border-r border-slate-200">5k</th>
                    <th className="p-2 border-r border-emerald-100">1k</th><th className="p-2 border-r border-emerald-100 text-emerald-700 font-bold">3k</th><th className="p-2 border-r border-slate-200">5k</th>
                    <th className="p-2 border-r border-indigo-100">1k</th><th className="p-2 border-r border-indigo-100 text-indigo-700 font-bold">3k</th><th className="p-2">5k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(savedFabrics || []).filter(f => String(f.article || '').toLowerCase().includes(fabricSearchTerm.toLowerCase())).map(f => {
                    const c = calculateCost(f);
                    const d1k = c.tier1k[viewMode]; const d3k = c.tier3k[viewMode]; const d5k = c.tier5k[viewMode];
                    const isExpanded = expandedFabricId === f.id;
                    const sym = viewMode === 'domestic' ? '￦' : '$';

                    return (
                      <React.Fragment key={f.id}>
                        <tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`} onClick={() => setExpandedFabricId(isExpanded ? null : f.id)}>
                          <td className="p-3 text-slate-400 text-center border-r border-slate-50">{isExpanded ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}</td>
                          <td className="p-3 border-r border-slate-50"><b>{f.article}</b><div className="text-[10px] text-slate-500 truncate max-w-[120px]">{f.itemName}</div></td>
                          <td className="p-3 text-center text-slate-600 text-xs border-r border-slate-50">{f.widthFull}" / {f.gsm}g</td>

                          <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-50">{sym}{num(d1k?.totalCostYd)}</td>
                          <td className="p-2 text-right font-mono text-blue-600 font-bold text-xs border-r border-slate-50 bg-blue-50/20">{sym}{num(d3k?.totalCostYd)}</td>
                          <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-100">{sym}{num(d5k?.totalCostYd)}</td>

                          <td className="p-2 text-right font-mono text-emerald-600 text-xs border-r border-emerald-50">{sym}{num(d1k?.priceConverter)}</td>
                          <td className="p-2 text-right font-mono text-emerald-700 font-bold text-xs border-r border-emerald-50 bg-emerald-50/30">{sym}{num(d3k?.priceConverter)}</td>
                          <td className="p-2 text-right font-mono text-emerald-600 text-xs border-r border-slate-100">{sym}{num(d5k?.priceConverter)}</td>

                          <td className="p-2 text-right font-mono text-indigo-600 text-xs border-r border-indigo-50">{sym}{num(d1k?.priceBrand)}</td>
                          <td className="p-2 text-right font-mono text-indigo-700 font-bold text-xs border-r border-indigo-50 bg-indigo-50/30">{sym}{num(d3k?.priceBrand)}</td>
                          <td className="p-2 text-right font-mono text-indigo-600 text-xs border-r border-slate-50">{sym}{num(d5k?.priceBrand)}</td>

                          <td className="p-3 text-center flex justify-center gap-2 border-l border-slate-50">
                            <button onClick={(e) => { e.stopPropagation(); handleEditFabric(f); }} className="p-1.5 hover:bg-blue-100 text-blue-500 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id); }} className="p-1.5 hover:bg-red-100 text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>

                        {/* 🎯 아코디언 메뉴 UI 카드형으로 깔끔하게 전면 개편 */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b-2 border-blue-200">
                            <td colSpan="13" className="p-3 sm:p-5 cursor-default" onClick={(e) => e.stopPropagation()}>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 max-w-[1200px] w-full">

                                {/* Card 1: 생산 정보 */}
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                  <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><Factory className="w-4 h-4 text-slate-400" /> 생산 단가 및 로스율</h4>
                                  <div className="space-y-2 text-xs text-slate-600">
                                    <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500 font-bold">염가공비</span><span className="font-mono font-bold text-slate-800">￦{num(f.dyeingFee)} / kg</span></div>
                                    <div className="mt-2 grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 border-b pb-1"><div>구간</div><div>1k</div><div className="text-blue-500">3k</div><div>5k</div></div>
                                    <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50"><div className="text-left text-slate-500 text-[10px] font-bold">편직비</div><div>{num(f.knittingFee1k)}</div><div className="text-blue-600 font-bold">{num(f.knittingFee3k)}</div><div>{num(f.knittingFee5k)}</div></div>
                                    <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center border-b border-slate-50"><div className="text-left text-slate-500 text-[10px] font-bold">LOSS(%)</div><div>{num(f.losses?.tier1k?.knit)}+{num(f.losses?.tier1k?.dye)}</div><div className="text-blue-600 font-bold">{num(f.losses?.tier3k?.knit)}+{num(f.losses?.tier3k?.dye)}</div><div>{num(f.losses?.tier5k?.knit)}+{num(f.losses?.tier5k?.dye)}</div></div>
                                    <div className="grid grid-cols-4 text-center font-mono py-1.5 items-center"><div className="text-left text-slate-500 text-[10px] font-bold">부대비</div><div>{num(f.extraFee1k)}</div><div className="text-blue-600 font-bold">{num(f.extraFee3k)}</div><div>{num(f.extraFee5k)}</div></div>
                                  </div>
                                </div>

                                {/* Card 2: 판매 정책 */}
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                                  <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1 border-b border-slate-100 pb-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> 판매 정책 (마진 & 직납)</h4>
                                  <div className="space-y-2 text-xs text-slate-600 flex-1">
                                    <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500 font-bold">도매(Conv) 마진</span><span className="font-bold text-emerald-600">{f.marginTier}단계 ({MARGIN_TIERS[f.marginTier]}%)</span></div>
                                    <div className="mt-3">
                                      <div className="text-[10px] text-slate-500 mb-1 font-bold">직납(Brand) 추가금 (￦/YD)</div>
                                      <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-indigo-50 text-indigo-700 py-1.5 rounded font-mono text-[11px]"><span className="block text-[9px] opacity-60">1k</span>+{num(f.brandExtra?.tier1k)}</div>
                                        <div className="bg-indigo-100 text-indigo-800 py-1.5 rounded font-mono text-[11px] font-bold shadow-sm"><span className="block text-[9px] opacity-60">3k</span>+{num(f.brandExtra?.tier3k)}</div>
                                        <div className="bg-indigo-50 text-indigo-700 py-1.5 rounded font-mono text-[11px]"><span className="block text-[9px] opacity-60">5k</span>+{num(f.brandExtra?.tier5k)}</div>
                                      </div>
                                    </div>
                                  </div>
                                  {f.remarks && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                      <div className="text-xs text-slate-700 bg-yellow-50 border border-yellow-200 p-2 rounded-lg leading-relaxed"><span className="font-bold block mb-0.5 text-[10px] text-yellow-600">특이사항</span>{f.remarks}</div>
                                    </div>
                                  )}
                                </div>

                                {/* Card 3: 최종 단가 요약 */}
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-sm text-white">
                                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between border-b border-slate-600 pb-2">
                                    <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-blue-400" /> 단가 요약표</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${viewMode === 'domestic' ? 'bg-blue-900 text-blue-200' : 'bg-emerald-900 text-emerald-200'}`}>{viewMode === 'domestic' ? '내수(￦)' : '수출($)'}</span>
                                  </h4>
                                  <div className="space-y-2 mt-2">
                                    <div className="grid grid-cols-4 text-center font-bold text-[10px] text-slate-400 pb-1 border-b border-slate-700"><div>구간</div><div>원가</div><div className="text-emerald-400">CONV</div><div className="text-indigo-400">BRAND</div></div>
                                    {['tier1k', 'tier3k', 'tier5k'].map((tier, i) => {
                                      const d = c[tier][viewMode];
                                      const label = ['1k', '3k', '5k'][i];
                                      const is3k = tier === 'tier3k';
                                      return (
                                        <div key={tier} className={`grid grid-cols-4 text-center font-mono py-1.5 rounded text-xs items-center ${is3k ? 'bg-slate-700 font-bold shadow-inner text-white' : 'text-slate-300'}`}>
                                          <div className="text-slate-400 text-[10px] font-bold">{label}</div>
                                          <div>{num(d.totalCostYd)}</div>
                                          <div className="text-emerald-400">{num(d.priceConverter)}</div>
                                          <div className="text-indigo-400">{num(d.priceBrand)}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredFabrics.length === 0 && <tr><td colSpan="13" className="p-8 text-center text-slate-400">데이터가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* YARNS */}
        {activeTab === 'yarns' && (
          <div className="max-w-6xl mx-auto space-y-6 w-full print:hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold text-slate-800">원사 라이브러리 ({filteredYarns.length}개)</h2>
              <div className="flex gap-2 items-center w-full sm:w-auto">
                {editingYarnId && <button onClick={handleCancelYarnEdit} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800 mr-2"><X className="w-4 h-4" /> 수정 취소</button>}
                <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm w-full sm:w-auto">
                  <button onClick={handleBackupYarns} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-sm font-bold flex"><Database className="w-4 h-4 text-blue-500" /> 백업</button>
                  <button onClick={() => setIsYarnBulkModalOpen(true)} className="flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-sm font-bold flex"><Upload className="w-4 h-4" /> 엑셀 등록</button>
                </div>
              </div>
            </div>

            <div className={`bg-white p-4 sm:p-6 rounded-2xl border transition-all shadow-sm ${editingYarnId ? 'border-yellow-400 ring-4 ring-yellow-50' : 'border-slate-200'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Category</label>
                    <input type="text" list="yarn-categories" value={yarnInput.category} onChange={e => setYarnInput({ ...yarnInput, category: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-bold text-slate-700 uppercase" placeholder="카테고리" />
                    <datalist id="yarn-categories">
                      {dynamicCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                  <div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">원사명</label><input type="text" value={yarnInput.name} onChange={e => setYarnInput({ ...yarnInput, name: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 text-sm font-bold uppercase" placeholder="예: 2/48 WOOL" /></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">특이사항 (메모)</label><input type="text" value={yarnInput.remarks} onChange={e => setYarnInput({ ...yarnInput, remarks: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="공용 메모 입력..." /></div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                <div className="flex justify-between items-center mb-4 min-w-[600px]">
                  <span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Factory className="w-4 h-4 text-slate-400" /> 공급처(Supplier) 단가 관리</span>
                  <button onClick={handleAddSupplier} className="text-xs bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-emerald-50 transition-colors">+ 새로운 업체 추가</button>
                </div>
                <div className="space-y-3 min-w-[600px]">
                  {yarnInput.suppliers.map((sup, idx) => (
                    <div key={sup.id} className={`flex flex-col gap-2 bg-white p-3 rounded-lg border shadow-sm relative transition-all ${sup.isDefault ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex flex-nowrap gap-3 items-start">
                        <div className="flex flex-col items-center justify-center w-12 shrink-0 h-[38px] bg-slate-50 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 mt-4" onClick={() => handleSupplierChange(sup.id, 'isDefault', true)} title="기본(대표) 업체로 설정">
                          <label className="text-[9px] text-slate-500 font-bold cursor-pointer">대표</label>
                          <input type="radio" name="defaultSup" checked={sup.isDefault} readOnly className="w-3.5 h-3.5 text-blue-600 cursor-pointer" />
                        </div>
                        <div className="flex-1 min-w-[120px]"><label className="text-[10px] text-slate-500 font-bold mb-1 block">업체명</label><input type="text" value={sup.name} onChange={e => handleSupplierChange(sup.id, 'name', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none uppercase" placeholder="업체명" /></div>
                        <div className="w-20 shrink-0"><label className="text-[10px] text-slate-500 font-bold mb-1 block">화폐</label><select value={sup.currency} onChange={e => handleSupplierChange(sup.id, 'currency', e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded px-1 py-1.5 text-sm font-bold"><option value="KRW">KRW</option><option value="USD">USD</option></select></div>
                        <div className="w-28 shrink-0"><label className="text-[10px] text-slate-500 font-bold mb-1 block">단가</label><input type="number" value={sup.price} onChange={e => handleSupplierChange(sup.id, 'price', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right font-mono font-bold focus:border-blue-500 outline-none" placeholder="0" /></div>
                        <div className="w-16 shrink-0"><label className="text-[10px] text-blue-500 font-bold mb-1 block">관세(%)</label><input type="number" value={sup.tariff} onChange={e => handleSupplierChange(sup.id, 'tariff', e.target.value)} className="w-full border border-blue-200 bg-blue-50 rounded px-1 py-1.5 text-sm text-right text-blue-700 font-bold focus:border-blue-500 outline-none" /></div>

                        {/* 운반비 미리보기 */}
                        <div className="w-20 shrink-0 flex flex-col">
                          <label className="text-[10px] text-emerald-500 font-bold mb-1 block">운반비(%)</label>
                          <input type="number" value={sup.freight} onChange={e => handleSupplierChange(sup.id, 'freight', e.target.value)} className="w-full border border-emerald-200 bg-emerald-50 rounded px-1 py-1.5 text-sm text-right text-emerald-700 font-bold focus:border-emerald-500 outline-none" />
                          {sup.price > 0 && sup.freight > 0 && <span className="text-[9px] text-emerald-600 mt-0.5 text-right font-mono tracking-tighter">+{Math.round(sup.price * (sup.freight / 100))}</span>}
                        </div>

                        {yarnInput.suppliers.length > 1 && (
                          <button onClick={() => handleRemoveSupplier(sup.id)} className="w-8 h-[34px] mt-4 flex items-center justify-center text-slate-400 hover:text-red-600 rounded bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors shrink-0" title="업체 삭제"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>

                      {sup.history && sup.history.length > 0 && (
                        <div className="ml-16 bg-slate-50 border border-slate-100 p-2 rounded-md">
                          <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1"><History className="w-3 h-3" /> 단가 변경 기록</p>
                          <div className="flex flex-wrap gap-2">
                            {sup.history.map((h, hIdx) => (
                              <div key={hIdx} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 shadow-sm">
                                <span>{h.date}</span><span className="text-slate-300">|</span><span className="font-bold">{sup.currency === 'USD' ? '$' : '￦'}{num(h.price)}</span>
                                <button onClick={() => handleDeleteHistoryItem(sup.id, hIdx)} className="ml-1 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={handleSaveYarn} className={`px-10 py-3 rounded-xl flex gap-2 items-center font-bold text-white transition-all shadow-md ${editingYarnId ? 'bg-yellow-500 hover:bg-yellow-600 hover:shadow-lg' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-lg'}`}>{editingYarnId ? <><Save className="w-5 h-5" /> 수정된 정보 저장</> : <><Plus className="w-5 h-5" /> 시스템에 원사 등록</>}</button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-200 pb-2 gap-4 overflow-x-auto">
              <div className="flex gap-2 items-center">
                <button onClick={() => setYarnFilterCategory('All')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${yarnFilterCategory === 'All' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>All</button>
                {dynamicCategories.map(cat => (<button key={cat} onClick={() => setYarnFilterCategory(cat)} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${yarnFilterCategory === cat ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{cat}</button>))}
                <button onClick={() => setIsCategoryModalOpen(true)} className="ml-2 px-2 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"><Settings className="w-3.5 h-3.5" /> 관리</button>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <div className="relative flex-1 sm:w-48">
                  <input type="text" placeholder="원사명 검색..." value={yarnSearchTerm} onChange={(e) => setYarnSearchTerm(e.target.value.toUpperCase())} className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none text-sm bg-white shadow-sm focus:border-blue-400 uppercase" />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                  {yarnSearchTerm && <button onClick={() => setYarnSearchTerm('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>
                <Filter className="hidden sm:block w-4 h-4 text-slate-400" />
                <select value={yarnFilterSupplier} onChange={(e) => setYarnFilterSupplier(e.target.value)} className="hidden sm:block bg-white border border-slate-200 text-sm font-bold text-slate-600 rounded px-3 py-1.5 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors uppercase">
                  {uniqueSuppliers.map(sup => <option key={sup} value={sup}>{sup === 'All' ? '모든 공급처' : sup}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr><th className="p-4 w-24">Category</th><th className="p-4">Yarn Name</th><th className="p-4">Suppliers</th><th className="p-4 text-right">Price(Exp)</th><th className="p-4 text-right">Tariff</th><th className="p-4 text-right">Freight</th><th className="p-4 text-right text-blue-600">Price(Dom)</th><th className="p-4">Remarks</th><th className="p-4 text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredYarns.map((y) => {
                    const defSup = y.suppliers?.find(s => s.isDefault) || y.suppliers?.[0] || {};
                    const domPrice = Math.round((defSup.price || 0) * (1 + ((defSup.tariff || 0) + (defSup.freight || 0)) / 100));

                    return (
                      <tr key={y.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="p-4 text-slate-500 text-xs font-bold uppercase">{y.category || '-'}</td>
                        <td className="p-4 font-bold text-slate-800 uppercase">{y.name}</td>
                        <td className="p-4 font-medium text-slate-600 text-[11px] leading-relaxed uppercase">
                          {y.suppliers?.map((s, i) => (
                            <span key={s.id}>
                              {s.isDefault ? <strong className="text-blue-600 font-bold">[{s.name}]</strong> : s.name}
                              {i < y.suppliers.length - 1 && ', '}
                            </span>
                          ))}
                        </td>
                        <td className="p-4 text-right font-mono relative group/price">
                          <div className="flex items-center justify-end gap-2">
                            <span>{defSup.currency === 'USD' ? '$' : '￦'}{num(defSup.price)}</span>
                            {defSup.history && defSup.history.length > 0 && (<div className="relative"><History className="w-3 h-3 text-slate-400 cursor-help hover:text-blue-500" /><div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 text-white text-[10px] rounded p-2 z-50 hidden group-hover/price:block shadow-xl text-left pointer-events-none"><p className="font-bold mb-1 border-b border-slate-600 pb-1 text-slate-300">[{defSup.name}] Price History</p>{defSup.history.map((h, idx) => (<div key={idx} className="flex justify-between py-0.5"><span className="text-slate-400">{h.date}</span><span className="font-mono">￦{num(h.price)}</span></div>))}</div></div>)}
                          </div>
                        </td>
                        <td className="p-4 text-right text-slate-500">{defSup.tariff || 0}%</td>
                        <td className="p-4 text-right text-emerald-600 font-bold">
                          {defSup.freight || 0}%
                          {defSup.price > 0 && defSup.freight > 0 && defSup.currency === 'KRW' && <div className="text-[9px] text-slate-400 font-normal leading-tight">({Math.round(defSup.price * defSup.freight / 100)}원)</div>}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-blue-600">
                          {defSup.currency === 'USD' ? <span className="text-xs text-slate-400 italic">Calc by Rate</span> : `￦${num(domPrice)}`}
                        </td>
                        <td className="p-4 text-slate-500 text-xs truncate max-w-[150px]" title={y.remarks}>{y.remarks}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleEditYarn(y)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="전체 수정"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteYarn(y.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="전체 삭제"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredYarns.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-slate-400">등록된 원사가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QUOTATION */}
        {activeTab === 'quotation' && (
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 w-full print:hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-600" /> Quotation</h2><div className="flex gap-2 w-full sm:w-auto"><button onClick={handleSaveQuote} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save</button><button onClick={handleDownloadPDF} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"><Download className="w-4 h-4" /> PDF</button></div></div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Buyer Information & Currency</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
                <div className="lg:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Buyer Name</label><input type="text" value={quoteInput.buyerName} onChange={(e) => setQuoteInput({ ...quoteInput, buyerName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase" placeholder="Buyer Name" /></div>
                <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Quote Date</label><input type="date" value={quoteInput.date} onChange={(e) => setQuoteInput({ ...quoteInput, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" /></div>
                <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Settings</label><div className="flex bg-slate-100 p-1 rounded-lg gap-1"><button onClick={() => handleQuoteSettingChange('buyerType', 'converter')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'converter' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Conv</button><button onClick={() => handleQuoteSettingChange('buyerType', 'brand')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'brand' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Brand</button><div className="w-px bg-slate-300 mx-1"></div><button onClick={() => handleQuoteSettingChange('marketType', 'domestic')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dom</button><button onClick={() => handleQuoteSettingChange('marketType', 'export')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'export' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Exp</button></div></div>
                <div className="lg:col-span-1"><label className="block text-xs font-bold text-indigo-500 mb-1 flex items-center gap-1">Extra Margin</label><div className="relative"><input type="number" value={quoteInput.extraMargin || 0} onChange={(e) => handleQuoteSettingChange('extraMargin', e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-right font-bold text-indigo-700 outline-none" placeholder="0" /><span className="absolute right-3 top-2 text-xs text-indigo-400 font-bold">%</span></div></div>
                <div className="lg:col-span-1 bg-yellow-50/50 p-2 rounded-xl border border-yellow-100 flex flex-col justify-center">
                  <label className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" />Exchange Rate (￦/$)</label>
                  <input type="number" value={quoteInput.exchangeRate} onChange={(e) => handleQuoteSettingChange('exchangeRate', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-right font-mono font-bold text-slate-700 text-sm outline-none focus:border-yellow-400" />
                </div>

                <div className="col-span-1 sm:col-span-2 lg:col-span-6 mt-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Remarks (내부 참조용 메모)</label>
                  <textarea value={quoteInput.remarks || ''} onChange={(e) => setQuoteInput({ ...quoteInput, remarks: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-400" placeholder="바이어 PDF에는 표시되지 않는 내부 기록용 메모입니다. (히스토리에서 확인 가능)"></textarea>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-2 gap-2">
                <h3 className="text-sm font-bold text-slate-400 uppercase">1. 단일 검색 추가</h3>
                <div className="flex gap-2 w-full sm:w-max">
                  <SearchableSelect value={selectedFabricIdForQuote} options={savedFabrics} onChange={setSelectedFabricIdForQuote} placeholder="Search Fabric..." labelKey="article" valueKey="id" />
                  <button onClick={handleAddFabricToQuote} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 shrink-0 border border-indigo-200">+ Add</button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-400 uppercase mb-2 mt-6">2. 견적서 리스트 및 일괄 추가</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[900px]">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr><th className="p-3 w-12 text-center">No.</th><th className="p-3">Article</th><th className="p-3">Spec</th><th className="p-3 text-center">Cut</th><th className="p-3 text-center">Full</th><th className="p-3 text-right">GSM</th><th className="p-3 text-right">g/YD</th><th className="p-3 text-right text-orange-600 bg-orange-50/50">MCQ</th><th className="p-3 w-28 bg-slate-100 text-right">1,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-28 bg-indigo-50 text-indigo-900 text-right">3,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-28 bg-slate-100 text-right">5,000 YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-3 w-10 text-center"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quoteInput.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50">
                        <td className="p-3 text-slate-400 font-mono text-center text-xs">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 text-xs uppercase">{item.article}</td>
                        <td className="p-3 text-slate-600 text-xs">{item.itemName}</td>
                        <td className="p-3 text-slate-500 text-center text-xs">{item.widthCut}"</td>
                        <td className="p-3 text-slate-500 text-center text-xs">{item.widthFull}"</td>
                        <td className="p-3 text-right text-slate-500 text-xs">{item.gsm}</td>
                        <td className="p-3 text-right text-slate-500 font-mono text-xs">{num(item.gYd)}</td>
                        <td className="p-3 text-right text-orange-600 font-bold font-mono bg-orange-50/30 text-xs">{num(item.mcqYd || 300)}</td>

                        <td className="p-2 bg-slate-50">
                          <input type="number" value={smartRound(getBasePrice(item, '1k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice1k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none text-xs" />
                          {quoteInput.extraMargin > 0 && <div className="text-[9px] text-slate-400 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '1k'))}</div>}
                        </td>
                        <td className="p-2 bg-indigo-50/30">
                          <input type="number" value={smartRound(getBasePrice(item, '3k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice3k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-right font-bold text-indigo-700 focus:border-indigo-500 outline-none text-xs" />
                          {quoteInput.extraMargin > 0 && <div className="text-[9px] text-indigo-400/70 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '3k'))}</div>}
                        </td>
                        <td className="p-2 bg-slate-50">
                          <input type="number" value={smartRound(getBasePrice(item, '5k') * extraMarkup, quoteInput.currency)} onChange={(e) => handleQuoteBasePriceChange(idx, 'basePrice5k', Number(e.target.value) / extraMarkup)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none text-xs" />
                          {quoteInput.extraMargin > 0 && <div className="text-[9px] text-slate-400 text-right mt-0.5">Base: {formatQuotePrice(getBasePrice(item, '5k'))}</div>}
                        </td>
                        <td className="p-2 text-center"><button onClick={() => handleRemoveItemFromQuote(idx)} className="text-slate-300 hover:text-red-500 p-1"><X className="w-4 h-4" /></button></td>
                      </tr>
                    ))}

                    <tr>
                      <td className="p-2 text-center text-slate-300"><Plus className="w-4 h-4 mx-auto" /></td>
                      <td className="p-2" colSpan="2">
                        <input
                          type="text"
                          placeholder="Article 입력 후 Enter 또는 엑셀(세로) 복붙..."
                          className="w-full bg-indigo-50 border border-indigo-200 text-indigo-800 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-xs font-bold shadow-sm uppercase"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const art = String(e.target.value).trim().toUpperCase();
                              if (!art) return;
                              const fabric = savedFabrics.find(f => String(f.article).toUpperCase() === art);
                              if (fabric) {
                                setQuoteInput(prev => ({ ...prev, items: [...(prev.items || []), createQuoteItem(fabric, prev.exchangeRate, prev.marketType, prev.buyerType)] }));
                                showToast('추가 완료', 'success'); e.target.value = '';
                              } else alert(`'${art}' 원단을 찾을 수 없습니다.`);
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            handleGridPaste(e.clipboardData.getData('text'));
                            e.target.value = '';
                          }}
                        />
                      </td>
                      <td colSpan="9" className="p-2 text-xs text-slate-400 bg-slate-50/50 flex items-center gap-1 h-[42px]">
                        <ClipboardPaste className="w-3.5 h-3.5" /> 왼쪽 칸을 클릭하고 엑셀 Article을 붙여넣기 해보세요.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: HISTORY */}
        {activeTab === 'quoteHistory' && (
          <div className="max-w-[1600px] mx-auto space-y-6 print:hidden w-full">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-6 h-6 text-indigo-600" /> Quote History</h2>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
                <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400" /><input type="text" placeholder="바이어 검색..." value={quoteBuyerFilter} onChange={(e) => setQuoteBuyerFilter(e.target.value.toUpperCase())} className="text-sm outline-none w-full sm:w-28 text-slate-600 font-bold uppercase" />
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">Date:</span><input type="date" value={quoteDateFilter} onChange={(e) => setQuoteDateFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold" />
                  {quoteDateFilter && <button onClick={() => setQuoteDateFilter('')} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">Market:</span>
                  <select value={quoteMarketFilter} onChange={(e) => setQuoteMarketFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold">
                    <option value="All">All</option><option value="domestic">DOM(내수)</option><option value="export">EXP(수출)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">Author:</span>
                  <select value={quoteAuthorFilter} onChange={(e) => setQuoteAuthorFilter(e.target.value)} className="text-sm outline-none text-slate-600 font-bold">
                    {uniqueAuthors.map(author => <option key={author} value={author}>{author === 'All' ? 'All' : author}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr><th className="p-4 w-32">Date</th><th className="p-4">Buyer</th><th className="p-4 w-32">Type</th><th className="p-4 w-24 text-center">Items</th><th className="p-4 w-32">Author</th><th className="p-4 w-56 text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotesList.map(quote => (
                    <tr key={quote.id} className="hover:bg-slate-50 group">
                      <td className="p-4 font-mono text-slate-500">{quote.date}</td>
                      <td className="p-4 font-bold text-slate-800 text-base uppercase">
                        {quote.buyerName}
                        {quote.remarks && <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate max-w-[200px]" title={quote.remarks}>{quote.remarks}</div>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase ${quote.buyerType === 'converter' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{quote.buyerType}</span>
                          <span className={`text-[10px] w-max px-2 py-0.5 rounded font-bold uppercase border ${quote.marketType === 'domestic' ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'}`}>{quote.marketType === 'domestic' ? 'DOM' : 'EXP'} ({quote.currency})</span>
                        </div>
                      </td>
                      <td className="p-4 text-center"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">{quote.items?.length || 0}</span></td>
                      <td className="p-4 text-slate-500 font-medium">{quote.authorName}</td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setQuickViewQuote(quote)} className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1" title="미리보기"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setQuoteInput(quote); setActiveTab('quotation'); }} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition-colors">Edit</button>
                          <button onClick={() => { setQuoteInput(quote); handleDownloadPDF(); }} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">PDF</button>
                          <button onClick={() => handleDeleteQuote(quote.id)} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotesList.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-slate-400">No quotation history found matching the filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 모달 3종 (엑셀 업로드 2 + 카테고리 관리) */}
        {isBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원단 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드 (원사정보 포함됨)</p><button onClick={handleDownloadTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} ref={fileInputRef} /></label></div></div></div></div>)}
        {isYarnBulkModalOpen && (<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsYarnBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 원사 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드</p><button onClick={handleDownloadYarnTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 원사 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleYarnFileUpload} ref={yarnFileInputRef} /></label></div></div></div></div>)}

        {/* Category Manager Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
              <button onClick={() => { setIsCategoryModalOpen(false); setEditingCategoryOld(null); setEditingCategoryNew(''); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-500" /> 원사 카테고리 관리</h3>
              <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg mb-4">
                ⚠️ <b>주의:</b> 기존 카테고리 이름을 수정하면 해당 카테고리를 사용 중인 <b>모든 원사의 데이터가 일괄 변경</b>됩니다.
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4 p-2 border border-slate-100 rounded-lg bg-slate-50">
                {categories.map(cat => (
                  <div key={cat} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-slate-200">
                    {editingCategoryOld === cat ? (
                      <div className="flex w-full gap-2">
                        <input type="text" value={editingCategoryNew} onChange={e => setEditingCategoryNew(String(e.target.value).toUpperCase())} className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-blue-500 uppercase" autoFocus />
                        <button onClick={() => handleSaveCategoryEdit(cat, editingCategoryNew)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold shrink-0">저장</button>
                        <button onClick={() => { setEditingCategoryOld(null); setEditingCategoryNew(''); }} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs shrink-0">취소</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-sm text-slate-700 uppercase">{cat}</span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingCategoryOld(cat); setEditingCategoryNew(cat); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-500 mb-2">새 카테고리 추가</p>
                <div className="flex gap-2">
                  <input type="text" value={editingCategoryOld === null ? editingCategoryNew : ''} onChange={e => { if (editingCategoryOld === null) setEditingCategoryNew(String(e.target.value).toUpperCase()); }} placeholder="새로운 카테고리 입력..." className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 ring-emerald-500 uppercase" />
                  <button onClick={() => handleSaveCategoryEdit(null, editingCategoryNew)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 whitespace-nowrap">추가</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick View */}
        {quickViewQuote && (
          <div className="fixed inset-0 bg-black/60 z-[10000] p-4 md:p-12 overflow-y-auto flex justify-center items-start backdrop-blur-sm">
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-6 md:p-12 relative rounded-xl shadow-2xl my-auto">
              <button onClick={() => setQuickViewQuote(null)} className="absolute right-4 md:right-6 top-4 md:top-6 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors"><X className="w-6 h-6" /></button>

              <div className="flex justify-center mb-6">
                <img src="/logo.png" alt="GRUBIG Logo" className="h-16 object-contain mx-auto mb-2" onError={(e) => e.target.style.display = 'none'} />
              </div>
              <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">FABRIC QUOTATION</h2><p className="text-slate-500 text-sm font-bold">FOB PRICE</p>
              </div>
              <div className="flex justify-between mb-6">
                <div className="w-1/2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">To</p>
                  <h2 className="text-xl font-bold text-slate-900 uppercase">{quickViewQuote.buyerName}</h2>
                </div>
                <div className="w-1/2 text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Date</p>
                  <h2 className="text-lg font-bold text-slate-900">{quickViewQuote.date}</h2>
                  <p className="text-[10px] text-slate-500 mt-1">Currency: {quickViewQuote.currency}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left mb-8 border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-slate-800">
                      <th className="py-2 font-bold text-slate-900">Article</th><th className="py-2 font-bold text-slate-900">Spec</th><th className="py-2 font-bold text-slate-900 text-center">Cut</th><th className="py-2 font-bold text-slate-900 text-center">Full</th><th className="py-2 font-bold text-slate-900 text-right">GSM</th><th className="py-2 font-bold text-slate-900 text-right">g/YD</th><th className="py-2 font-bold text-slate-900 text-right text-orange-600">MCQ</th><th className="py-2 font-bold text-slate-900 text-right">1,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">3,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">5,000 YD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(quickViewQuote.items || []).map((item, idx) => {
                      const exMarkup = 1 + (Number(quickViewQuote.extraMargin) || 0) / 100;
                      const fmtPrice = (val) => quickViewQuote.currency === 'USD' ? `$${usd(val)}` : `￦${num(val)}`;
                      const p1k = item.basePrice1k ? smartRound(item.basePrice1k * exMarkup, quickViewQuote.currency) : item.price1k;
                      const p3k = item.basePrice3k ? smartRound(item.basePrice3k * exMarkup, quickViewQuote.currency) : item.price3k;
                      const p5k = item.basePrice5k ? smartRound(item.basePrice5k * exMarkup, quickViewQuote.currency) : item.price5k;
                      return (
                        <tr key={idx}>
                          <td className="py-3 font-bold text-slate-800 uppercase">{item.article}</td><td className="py-3 text-slate-600 truncate max-w-[120px]">{item.itemName}</td><td className="py-3 text-center text-slate-500">{item.widthCut}"</td><td className="py-3 text-center text-slate-500">{item.widthFull}"</td><td className="py-3 text-right text-slate-500">{item.gsm}</td><td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td><td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td><td className="py-3 text-right font-mono">{fmtPrice(p1k)}</td><td className="py-3 text-right font-mono font-bold">{fmtPrice(p3k)}</td><td className="py-3 text-right font-mono">{fmtPrice(p5k)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* 내부 참조용 메모는 퀵뷰에서만 보입니다 */}
              {quickViewQuote.remarks && (
                <div className="bg-yellow-50 p-4 border border-yellow-200 rounded-lg mb-8 text-xs text-yellow-800 whitespace-pre-wrap">
                  <span className="font-bold flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5" /> 내부 참조용 메모 (PDF 출력 안됨)</span>
                  {quickViewQuote.remarks}
                </div>
              )}
              <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed">
                <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfQuoteMonth(quickViewQuote.date)}</span></p>
                <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p><p className="mb-1">• BULK PRICING NEGOTIABLE</p><p>• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
              </div>
            </div>
          </div>
        )}

        {/* PDF Document */}
        <div className={`fixed top-0 left-0 z-[9998] w-[210mm] bg-white ${isPdfGenerating ? 'block' : 'hidden'}`}>
          <div ref={printRef} className="w-[210mm] min-h-[297mm] bg-white px-10 py-12">
            <div className="flex justify-center mb-6"><div className="text-center w-full"><img src="/logo.png" alt="GRUBIG Logo" className="h-16 object-contain mx-auto mb-2" onError={(e) => e.target.style.display = 'none'} /></div></div>
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-6"><h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">FABRIC QUOTATION</h2><p className="text-slate-500 text-sm font-bold">FOB PRICE</p></div>
            <div className="flex justify-between mb-6">
              <div className="w-1/2"><p className="text-[10px] text-slate-400 uppercase font-bold mb-1">To</p><h2 className="text-xl font-bold text-slate-900 uppercase">{String(quoteInput.buyerName || '').replace(/[^a-zA-Z0-9\s-]/g, '')}</h2></div>
              <div className="w-1/2 text-right"><p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Date</p><h2 className="text-lg font-bold text-slate-900">{quoteInput.date}</h2><p className="text-[10px] text-slate-500 mt-1">Currency: {quoteInput.currency}</p></div>
            </div>
            <table className="w-full text-[11px] text-left mb-8 border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800"><th className="py-2 font-bold text-slate-900 uppercase">Article</th><th className="py-2 font-bold text-slate-900 uppercase">Spec</th><th className="py-2 font-bold text-slate-900 text-center uppercase">Cut</th><th className="py-2 font-bold text-slate-900 text-center uppercase">Full</th><th className="py-2 font-bold text-slate-900 text-right uppercase">GSM</th><th className="py-2 font-bold text-slate-900 text-right uppercase">g/YD</th><th className="py-2 font-bold text-slate-900 text-right text-orange-600 uppercase">MCQ</th><th className="py-2 font-bold text-slate-900 text-right uppercase">1,000 YD</th><th className="py-2 font-bold text-slate-900 text-right uppercase">3,000 YD</th><th className="py-2 font-bold text-slate-900 text-right uppercase">5,000 YD</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(quoteInput.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 font-bold text-slate-800 uppercase">{item.article}</td><td className="py-3 text-slate-600 truncate max-w-[120px]">{item.itemName}</td><td className="py-3 text-center text-slate-500">{item.widthCut}"</td><td className="py-3 text-center text-slate-500">{item.widthFull}"</td><td className="py-3 text-right text-slate-500">{item.gsm}</td><td className="py-3 text-right text-slate-500 font-mono">{num(item.gYd)}</td><td className="py-3 text-right text-slate-900 font-mono font-bold">{num(item.mcqYd || 300)} YD</td><td className="py-3 text-right font-mono">{formatQuotePrice(smartRound(getBasePrice(item, '1k') * extraMarkup, quoteInput.currency))}</td><td className="py-3 text-right font-mono font-bold">{formatQuotePrice(smartRound(getBasePrice(item, '3k') * extraMarkup, quoteInput.currency))}</td><td className="py-3 text-right font-mono">{formatQuotePrice(smartRound(getBasePrice(item, '5k') * extraMarkup, quoteInput.currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t-2 border-slate-800 pt-6 mt-10 text-[10px] text-slate-500 font-medium leading-relaxed">
              <p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfQuoteMonth(quoteInput.date)}</span></p>
              <p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p><p className="mb-1">• BULK PRICING NEGOTIABLE</p><p>• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;