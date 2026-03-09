import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Save, FileSpreadsheet, Calculator, 
  RotateCcw, Layers, Edit2, Check, X, Box, Search, ChevronDown,
  TrendingUp, Users, Factory, FileText, Printer, Calendar, Upload,
  Globe, Home, Percent, DollarSign, Coins, History, Tag, AlertCircle, HelpCircle, Info, Filter, Truck, Download,
  Cloud, LogOut
} from 'lucide-react';

// 🔥 Firebase 모듈
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, collection, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";

// ✅ 사장님의 진짜 설정값
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
const YARN_CATEGORIES = ['소모', '방모', '화섬', 'SPANDEX', '면방', '린넨방'];

// ✅ 마진 6단계 규격화 설정 (0단계~6단계)
const MARGIN_TIERS = {
  0: 10,
  1: 13,
  2: 16,
  3: 19,
  4: 22,
  5: 25,
  6: 28
};

// --- 라이브러리 로드 훅 ---
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

// --- 검색 가능한 드롭다운 컴포넌트 ---
const SearchableSelect = ({ value, options, onChange, placeholder, labelKey = 'name', valueKey = 'id' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const selected = options.find(o => o[valueKey] === value);
    if (selected) setSearch(selected[labelKey]);
    else setSearch('');
  }, [value, options, labelKey, valueKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        const selected = options.find(o => o[valueKey] === value);
        setSearch(selected ? selected[labelKey] : '');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, labelKey, valueKey]);

  const filteredOptions = options.filter(opt => 
    String(opt[labelKey]).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <div className="relative">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setIsOpen(true); if (e.target.value === '') onChange(''); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <button className="absolute right-2 top-2 text-slate-400 hover:text-slate-600" onClick={() => setIsOpen(!isOpen)}><ChevronDown className="w-4 h-4" /></button>
      </div>
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button key={opt[valueKey]} onClick={() => { onChange(opt[valueKey]); setSearch(opt[labelKey]); setIsOpen(false); }} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${value === opt[valueKey] ? 'bg-blue-50' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-1"><span className={`font-medium ${value === opt[valueKey] ? 'text-blue-700' : 'text-slate-700'}`}>{opt[labelKey]}</span>{opt.price && <span className="text-xs font-mono text-slate-500">{opt.currency === 'USD' ? '$' : '￦'}{opt.price.toLocaleString()}</span>}</div>
              </button>
            ))
          ) : <div className="px-3 py-4 text-center text-xs text-slate-400">검색 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
};

const App = () => {
  // --- 상태 관리 ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');

  const [activeTab, setActiveTab] = useState('calculator'); 
  const [yarnLibrary, setYarnLibrary] = useState([]);
  const [savedFabrics, setSavedFabrics] = useState([]);
  const [savedQuotes, setSavedQuotes] = useState([]);
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [viewMode, setViewMode] = useState('domestic'); 
  const [yarnFilterCategory, setYarnFilterCategory] = useState('All');
  const [editingFabricId, setEditingFabricId] = useState(null); 
  const [editingYarnId, setEditingYarnId] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isYarnBulkModalOpen, setIsYarnBulkModalOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [fabricSearchTerm, setFabricSearchTerm] = useState('');

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
    const unsubYarns = onSnapshot(collection(db, 'yarns'), (snapshot) => setYarnLibrary(snapshot.docs.map(doc => doc.data())));
    const unsubFabrics = onSnapshot(collection(db, 'fabrics'), (snapshot) => setSavedFabrics(snapshot.docs.map(doc => doc.data())));
    const unsubQuotes = onSnapshot(collection(db, 'quotes'), (snapshot) => { setSavedQuotes(snapshot.docs.map(doc => doc.data())); setSyncStatus('saved'); });
    return () => { unsubYarns(); unsubFabrics(); unsubQuotes(); };
  }, [user]);

  const saveDocToCloud = async (colName, item) => {
    setSyncStatus('syncing');
    try { await setDoc(doc(db, colName, String(item.id)), item); setSyncStatus('saved'); }
    catch (e) { setSyncStatus('error'); showToast("저장 실패", "error"); }
  };
  const deleteDocFromCloud = async (colName, id) => {
    setSyncStatus('syncing');
    try { await deleteDoc(doc(db, colName, String(id))); setSyncStatus('saved'); }
    catch (e) { setSyncStatus('error'); showToast("삭제 실패", "error"); }
  };
  const saveBatchToCloud = async (colName, items) => {
    setSyncStatus('syncing');
    try { const batch = writeBatch(db); items.forEach(item => batch.set(doc(db, colName, String(item.id)), item)); await batch.commit(); setSyncStatus('saved'); }
    catch (e) { setSyncStatus('error'); showToast("일괄 저장 실패", "error"); }
  };

  // --- 입력 폼 상태 (Fabric) ---
  const [fabricInput, setFabricInput] = useState({
    article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', exchangeRate: 1450,
    knittingFee1k: 4000, knittingFee3k: 3000, knittingFee5k: 2500, dyeingFee: 2500, managementFeeYd: 100,
    extraFee1k: 600, extraFee3k: 500, extraFee5k: 400,
    losses: { tier1k: { knit: 8, dye: 13 }, tier3k: { knit: 5, dye: 10 }, tier5k: { knit: 5, dye: 10 } },
    marginTier: 3, // ✅ 기본 3단계 (19%)
    brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 }, // ✅ 직납 추가금
    yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
  });

  const [yarnInput, setYarnInput] = useState({ category: '소모', name: '', price: '', currency: 'KRW', tariff: 8, supplier: '', remarks: '' });
  
  const [quoteInput, setQuoteInput] = useState({
    buyerName: '', buyerType: 'converter', marketType: 'domestic', currency: 'KRW', exchangeRate: 1450, date: new Date().toISOString().split('T')[0], 
    extraMargin: 0, // ✅ 바이어 난이도 마진 (%)
    items: [] 
  });
  const [selectedFabricIdForQuote, setSelectedFabricIdForQuote] = useState('');

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => { setNotification(prev => ({ ...prev, show: false })); }, 3000);
  };

  const calculateGYd = (gsm, widthFull) => Math.round(gsm * widthFull * 0.02322576);
  const smartRound = (value, currency) => {
    if (currency === 'USD') return Number(value.toFixed(2));
    else return Math.round(value / 100) * 100;
  };
  const applyGrossMargin = (cost, margin) => {
    if (margin >= 100) return 0;
    return cost / (1 - (margin / 100));
  };
  const getLastDayOfMonth = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
  };

  // --- 핵심 로직: 원단가 계산 ---
  const calculateCost = (fabricData) => {
    let yarnCostDomestic = 0; let yarnCostExport = 0;
    const fabricExchangeRate = Number(fabricData.exchangeRate) || 1450;

    fabricData.yarns.forEach(slot => {
      if (slot.yarnId && slot.ratio > 0) {
        const yarn = yarnLibrary.find(y => y.id === slot.yarnId);
        if (yarn) {
          const ratio = slot.ratio / 100;
          let priceInKrw = yarn.currency === 'USD' ? yarn.price * fabricExchangeRate : yarn.price;
          yarnCostExport += priceInKrw * ratio; 
          yarnCostDomestic += (priceInKrw * (1 + ((yarn.tariff || 0) / 100))) * ratio;
        }
      }
    });

    const theoreticalGYd = calculateGYd(fabricData.gsm, fabricData.widthFull);
    const effectiveGYd = fabricData.costGYd && Number(fabricData.costGYd) > 0 ? Number(fabricData.costGYd) : theoreticalGYd;
    const weightPerYdKg = effectiveGYd / 1000;

    // ✅ 원가 및 6단계 마진/직납 추가금 적용 로직
    const calcTier = (tierKey, knittingFeeKg, qty) => {
      const specificLoss = fabricData.losses[tierKey] || { knit: 0, dye: 0 };
      const totalLossRate = ((Number(specificLoss.knit) || 0) + (Number(specificLoss.dye) || 0)) / 100;

      let extraFee = 0;
      if (tierKey === 'tier1k') extraFee = Number(fabricData.extraFee1k) || 600;
      if (tierKey === 'tier3k') extraFee = Number(fabricData.extraFee3k) || 500;
      if (tierKey === 'tier5k') extraFee = Number(fabricData.extraFee5k) || 400;

      const costKnitYd = (Number(knittingFeeKg) / (1 - totalLossRate)) * weightPerYdKg;
      const costDyeYd = (Number(fabricData.dyeingFee) / (1 - totalLossRate)) * weightPerYdKg;
      const costYarnYdDomestic = (yarnCostDomestic / (1 - totalLossRate)) * weightPerYdKg;
      const costYarnYdExport = (yarnCostExport / (1 - totalLossRate)) * weightPerYdKg;

      const totalCostYdDomesticKRW = costYarnYdDomestic + costKnitYd + costDyeYd + Number(fabricData.managementFeeYd) + extraFee;
      const totalCostYdExportKRW = costYarnYdExport + costKnitYd + costDyeYd + Number(fabricData.managementFeeYd) + extraFee;
      
      // ✅ 사장님의 새로운 마진 로직 적용
      const currentMarginTier = fabricData.marginTier !== undefined ? fabricData.marginTier : 3;
      const marginPct = MARGIN_TIERS[currentMarginTier];
      const brandEx = Number(fabricData.brandExtra?.[tierKey]) || 0;

      const domesticPriceConv = applyGrossMargin(totalCostYdDomesticKRW, marginPct);
      const domesticPriceBrand = domesticPriceConv + brandEx; // Converter가 + 직납 추가금

      const totalCostYdExportUSD = totalCostYdExportKRW / fabricExchangeRate;
      const exportPriceConv = applyGrossMargin(totalCostYdExportUSD, marginPct);
      const exportPriceBrand = exportPriceConv + (brandEx / fabricExchangeRate); // 달러 환산 추가

      return {
        domestic: {
          currency: 'KRW',
          yarnCostYd: Math.round(costYarnYdDomestic), knitCostYd: Math.round(costKnitYd), dyeCostYd: Math.round(costDyeYd), extraFeeYd: Math.round(extraFee),
          totalCostYd: Math.round(totalCostYdDomesticKRW),
          priceConverter: smartRound(domesticPriceConv, 'KRW'),
          priceBrand: smartRound(domesticPriceBrand, 'KRW'),
        },
        export: {
          currency: 'USD',
          yarnCostYd: Number((costYarnYdExport / fabricExchangeRate).toFixed(2)), knitCostYd: Number((costKnitYd / fabricExchangeRate).toFixed(2)), dyeCostYd: Number((costDyeYd / fabricExchangeRate).toFixed(2)), extraFeeYd: Number((extraFee / fabricExchangeRate).toFixed(2)),
          totalCostYd: Number(totalCostYdExportUSD.toFixed(2)),
          priceConverter: smartRound(exportPriceConv, 'USD'),
          priceBrand: smartRound(exportPriceBrand, 'USD'),
        },
        requiredKg: Math.round((qty * weightPerYdKg) / (1 - totalLossRate))
      };
    };

    return {
      avgYarnCostDomestic: Math.round(yarnCostDomestic), avgYarnCostExport: Math.round(yarnCostExport),
      theoreticalGYd: theoreticalGYd, effectiveGYd: effectiveGYd,
      tier1k: calcTier('tier1k', fabricData.knittingFee1k, 1000),
      tier3k: calcTier('tier3k', fabricData.knittingFee3k, 3000),
      tier5k: calcTier('tier5k', fabricData.knittingFee5k, 5000),
    };
  };

  const handleFabricChange = (e) => { const { name, value } = e.target; setFabricInput(prev => ({ ...prev, [name]: (name === 'article' || name === 'itemName' || name === 'costGYd') ? value : Number(value) })); };
  const handleNestedChange = (section, tier, field, value) => {
    setFabricInput(prev => ({ ...prev, [section]: { ...prev[section], [tier]: field ? { ...prev[section][tier], [field]: Number(value) } : Number(value) } }));
  };
  const handleYarnSlotChange = (index, field, value) => {
    const newYarns = [...fabricInput.yarns]; newYarns[index] = { ...newYarns[index], [field]: field === 'ratio' ? Number(value) : value };
    setFabricInput({ ...fabricInput, yarns: newYarns });
  };
  
  const handleSaveFabric = () => {
    if (!fabricInput.article) { showToast("Article(품번)을 입력해주세요.", 'error'); return; }
    let itemToSave;
    if (editingFabricId) {
      itemToSave = { ...fabricInput, id: editingFabricId }; setSavedFabrics(savedFabrics.map(f => f.id === editingFabricId ? itemToSave : f)); showToast("원단 정보가 수정되었습니다.", 'success');
    } else {
      itemToSave = { id: Date.now(), date: new Date().toLocaleDateString(), ...fabricInput }; setSavedFabrics([itemToSave, ...savedFabrics]); showToast("새로운 원단이 등록되었습니다.", 'success');
    }
    saveDocToCloud('fabrics', itemToSave); resetForm(); setActiveTab('list');
  };

  const resetForm = () => {
    setFabricInput({
      article: '', itemName: '', widthFull: 58, widthCut: 56, gsm: 300, costGYd: '', exchangeRate: 1450,
      knittingFee1k: 4000, knittingFee3k: 3000, knittingFee5k: 2500, dyeingFee: 2500, managementFeeYd: 100, 
      extraFee1k: 600, extraFee3k: 500, extraFee5k: 400,
      losses: { tier1k: { knit: 8, dye: 13 }, tier3k: { knit: 5, dye: 10 }, tier5k: { knit: 5, dye: 10 } }, 
      marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
      yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
    });
    setEditingFabricId(null);
  };

  const handleDeleteFabric = (id) => { if(window.confirm("정말 삭제하시겠습니까?")) { setSavedFabrics(savedFabrics.filter(f => f.id !== id)); deleteDocFromCloud('fabrics', id); } };

  const handleEditFabric = (fabric) => { 
    setFabricInput({ 
      ...fabric, 
      extraFee1k: fabric.extraFee1k || 600, extraFee3k: fabric.extraFee3k || 500, extraFee5k: fabric.extraFee5k || 400,
      losses: fabric.losses || { tier1k: { knit: 8, dye: 13 }, tier3k: { knit: 5, dye: 10 }, tier5k: { knit: 5, dye: 10 } },
      marginTier: fabric.marginTier !== undefined ? fabric.marginTier : 3,
      brandExtra: fabric.brandExtra || { tier1k: 1000, tier3k: 700, tier5k: 500 }
    }); 
    setEditingFabricId(fabric.id); setActiveTab('calculator'); 
  };

  // --- 이하 EXCEL, YARN 저장 로직 (기존과 동일) ---
  const EXCEL_HEADERS = ['Article', 'ItemName', 'WidthFull', 'WidthCut', 'GSM', 'CostGYd', 'KnittingFee1k', 'KnittingFee3k', 'KnittingFee5k', 'DyeingFee', 'ManagementFeeYd', 'ExtraFee1k', 'ExtraFee3k', 'ExtraFee5k'];
  const handleDownloadTemplate = () => { /* 생략 없이 기존 코드 유지 */
    if (!isXlsxReady) return;
    const exampleRow = ['SAMPLE-01', 'Cotton Jersey', 58, 56, 300, 320, 4000, 3500, 3000, 2500, 100, 600, 500, 400];
    const ws = window.XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, exampleRow]);
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
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
        const newFabrics = [];
        data.forEach((row, idx) => {
            if (!row.Article) return; const kFee1k = Number(row.KnittingFee1k) || 4000;
            newFabrics.push({
                id: Date.now() + idx, date: new Date().toLocaleDateString(), article: row.Article || 'Unknown', itemName: row.ItemName || '',
                widthFull: Number(row.WidthFull) || 58, widthCut: Number(row.WidthCut) || 56, gsm: Number(row.GSM) || 300, costGYd: row.CostGYd ? Number(row.CostGYd) : '', exchangeRate: 1450, 
                knittingFee1k: kFee1k, knittingFee3k: Number(row.KnittingFee3k) || (kFee1k - 500), knittingFee5k: Number(row.KnittingFee5k) || (kFee1k - 1000), dyeingFee: Number(row.DyeingFee) || 2500, managementFeeYd: Number(row.ManagementFeeYd) || 100,
                extraFee1k: Number(row.ExtraFee1k) || 600, extraFee3k: Number(row.ExtraFee3k) || 500, extraFee5k: Number(row.ExtraFee5k) || 400,
                losses: { tier1k: { knit: 8, dye: 13 }, tier3k: { knit: 5, dye: 10 }, tier5k: { knit: 5, dye: 10 } },
                marginTier: 3, brandExtra: { tier1k: 1000, tier3k: 700, tier5k: 500 },
                yarns: [{ yarnId: '', ratio: 100 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }, { yarnId: '', ratio: 0 }]
            });
        });
        setSavedFabrics([...newFabrics, ...savedFabrics]); saveBatchToCloud('fabrics', newFabrics); setIsBulkModalOpen(false); showToast(`${newFabrics.length}건이 등록되었습니다.`, 'success');
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      } catch (err) { showToast('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error'); }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };

  const YARN_EXCEL_HEADERS = ['Category', 'Name', 'Supplier', 'Currency', 'Price', 'Tariff', 'Remarks'];
  const handleDownloadYarnTemplate = () => { /* 기존 코드 */
    if (!isXlsxReady) return;
    const ws = window.XLSX.utils.aoa_to_sheet([YARN_EXCEL_HEADERS, ['소모', '2/48 Wool', 'Yarn Co.', 'KRW', 18000, 8, 'Standard']]);
    ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 }];
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
        const newYarns = [];
        data.forEach((row, idx) => {
            if (!row.Name) return; 
            newYarns.push({ id: `y${Date.now()}_${idx}`, category: row.Category || '소모', name: row.Name, supplier: row.Supplier || '', currency: row.Currency || 'KRW', price: Number(row.Price) || 0, tariff: row.Tariff !== undefined ? Number(row.Tariff) : 8, remarks: row.Remarks || '', history: [] });
        });
        setYarnLibrary([...newYarns, ...yarnLibrary]); saveBatchToCloud('yarns', newYarns); setIsYarnBulkModalOpen(false); showToast(`${newYarns.length}건의 원사가 등록되었습니다.`, 'success');
        if (yarnFileInputRef.current) yarnFileInputRef.current.value = ''; 
      } catch (err) { showToast('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error'); }
    };
    reader.readAsBinaryString(e.target.files[0]);
  };
  const handleSaveYarn = () => {
    if (!yarnInput.name) { showToast("원사명을 입력해주세요.", 'error'); return; }
    let itemToSave;
    if (editingYarnId) {
      const existingYarn = yarnLibrary.find(y => y.id === editingYarnId); const newPrice = Number(yarnInput.price);
      let history = existingYarn.history || []; if (existingYarn.price !== newPrice) history = [{ date: new Date().toLocaleDateString(), price: existingYarn.price }, ...history];
      itemToSave = { ...existingYarn, ...yarnInput, price: newPrice, tariff: Number(yarnInput.tariff), history };
      setYarnLibrary(yarnLibrary.map(y => y.id === editingYarnId ? itemToSave : y)); showToast("원사 정보가 수정되었습니다.", 'success');
    } else {
      itemToSave = { id: `y${Date.now()}`, ...yarnInput, price: Number(yarnInput.price), tariff: Number(yarnInput.tariff), history: [] }; setYarnLibrary([...yarnLibrary, itemToSave]); showToast("새로운 원사가 등록되었습니다.", 'success');
    }
    saveDocToCloud('yarns', itemToSave); setEditingYarnId(null); setYarnInput({ category: '소모', name: '', price: '', currency: 'KRW', tariff: 8, supplier: '', remarks: '' });
  };
  const handleEditYarn = (yarn) => { setYarnInput({ category: yarn.category || '소모', name: yarn.name, price: yarn.price, currency: yarn.currency || 'KRW', tariff: yarn.tariff, supplier: yarn.supplier || '', remarks: yarn.remarks || '' }); setEditingYarnId(yarn.id); };
  const handleCancelYarnEdit = () => { setEditingYarnId(null); setYarnInput({ category: '소모', name: '', price: '', currency: 'KRW', tariff: 8, supplier: '', remarks: '' }); };
  const handleDeleteYarn = (id) => { if (savedFabrics.some(fabric => fabric.yarns.some(y => y.yarnId === id && y.ratio > 0))) { alert("🚨 경고: 이 원사를 사용 중인 원단이 있습니다! 삭제 불가."); return; } if(window.confirm("삭제하시겠습니까?")) { setYarnLibrary(yarnLibrary.filter(y => y.id !== id)); deleteDocFromCloud('yarns', id); } };

  // --- 이벤트 핸들러: Quotation ---
  const handleCurrencyToggle = (newCurrency) => {
      if (newCurrency === quoteInput.currency) return;
      const rate = Number(quoteInput.exchangeRate) || 1; const isToUSD = newCurrency === 'USD';
      const updatedItems = quoteInput.items.map(item => ({ ...item, price1k: isToUSD ? parseFloat((item.price1k / rate).toFixed(2)) : Math.round((item.price1k * rate)/100)*100, price3k: isToUSD ? parseFloat((item.price3k / rate).toFixed(2)) : Math.round((item.price3k * rate)/100)*100, price5k: isToUSD ? parseFloat((item.price5k / rate).toFixed(2)) : Math.round((item.price5k * rate)/100)*100 }));
      setQuoteInput(prev => ({ ...prev, currency: newCurrency, items: updatedItems }));
  };

  const handleAddFabricToQuote = () => {
    if (!selectedFabricIdForQuote) { showToast("견적서에 추가할 원단을 선택해주세요.", 'error'); return; }
    const fabric = savedFabrics.find(f => f.id === selectedFabricIdForQuote);
    if (!fabric) return;

    const calc = calculateCost(fabric);
    const isBrand = quoteInput.buyerType === 'brand';
    const data1k = calc.tier1k[quoteInput.marketType];
    const data3k = calc.tier3k[quoteInput.marketType];
    const data5k = calc.tier5k[quoteInput.marketType];
    
    // ✅ 바이어 난이도 마진(%) 적용 로직!
    const extraMarkup = 1 + (Number(quoteInput.extraMargin) || 0) / 100;
    const formatQuote = (val) => quoteInput.currency === 'USD' ? Number(val.toFixed(2)) : Math.round(val / 100) * 100;

    const newItem = {
      fabricId: fabric.id, article: fabric.article, itemName: fabric.itemName, widthCut: fabric.widthCut, widthFull: fabric.widthFull, gsm: fabric.gsm, gYd: calculateGYd(fabric.gsm, fabric.widthFull),
      price1k: formatQuote((isBrand ? data1k.priceBrand : data1k.priceConverter) * extraMarkup),
      price3k: formatQuote((isBrand ? data3k.priceBrand : data3k.priceConverter) * extraMarkup),
      price5k: formatQuote((isBrand ? data5k.priceBrand : data5k.priceConverter) * extraMarkup),
    };
    setQuoteInput(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setSelectedFabricIdForQuote('');
    showToast(`원단이 추가되었습니다. (마진 +${quoteInput.extraMargin || 0}% 반영)`, 'success');
  };

  const handleQuotePriceChange = (index, field, value) => { const newItems = [...quoteInput.items]; newItems[index][field] = Number(value); setQuoteInput({ ...quoteInput, items: newItems }); };
  const handleRemoveItemFromQuote = (index) => { const newItems = quoteInput.items.filter((_, i) => i !== index); setQuoteInput({ ...quoteInput, items: newItems }); };
  const handleSaveQuote = () => {
    if (!quoteInput.buyerName) { showToast("바이어 이름을 입력해주세요.", 'error'); return; }
    if (quoteInput.items.length === 0) { showToast("원단을 추가해주세요.", 'error'); return; }
    const itemToSave = { id: Date.now(), createdAt: new Date().toLocaleString(), ...quoteInput };
    setSavedQuotes([itemToSave, ...savedQuotes]); saveDocToCloud('quotes', itemToSave); showToast("견적서가 저장되었습니다.", 'success');
  };
  const handleDownloadPDF = () => {
    if (!isPdfReady) { showToast("PDF 로딩 중입니다.", 'error'); return; }
    if (quoteInput.items.length === 0) { showToast("내용이 없습니다.", 'error'); return; }
    setIsPdfGenerating(true);
    setTimeout(() => { if (printRef.current && window.html2pdf) { window.html2pdf().set({ margin: 10, filename: `Quotation_${quoteInput.buyerName}_${quoteInput.date}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(printRef.current).save().then(() => { setIsPdfGenerating(false); showToast("PDF 다운로드 완료.", 'success'); }); } else setIsPdfGenerating(false); }, 500);
  };
  const formatQuotePrice = (price) => { return quoteInput.currency === 'USD' ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `￦${Math.round(price).toLocaleString()}`; };

  // --- 렌더링용 필터 데이터 ---
  const currentCalc = calculateCost(fabricInput);
  const filteredYarns = yarnFilterCategory === 'All' ? yarnLibrary : yarnLibrary.filter(y => y.category === yarnFilterCategory);
  const filteredFabrics = savedFabrics.filter(fabric => (fabric.article && fabric.article.toLowerCase().includes(fabricSearchTerm.toLowerCase())) || (fabric.itemName && fabric.itemName.toLowerCase().includes(fabricSearchTerm.toLowerCase())));

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold animate-pulse">GRUBIG 시스템 접속 중...</div>;
  if (!user) return ( <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4"><div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl text-center shadow-2xl border border-slate-700"><div className="bg-blue-600 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-900"><Cloud className="text-white w-12 h-12" /></div><h1 className="text-3xl font-bold text-white mb-2">GRUBIG Cloud</h1><p className="text-slate-400 mb-8">@grubig.kr 전용 관리 시스템</p><button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 shadow-xl"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" /> 구글 계정으로 로그인</button></div></div> );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row print:bg-white relative">
      {notification.show && ( <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all animate-in slide-in-from-top-5 fade-in duration-300 ${notification.type === 'error' ? 'bg-red-500 text-white' : notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>{notification.type === 'success' && <Check className="w-5 h-5" />}{notification.type === 'error' && <AlertCircle className="w-5 h-5" />}{notification.type === 'info' && <Info className="w-5 h-5" />}<span className="font-bold text-sm">{notification.message}</span><button onClick={() => setNotification({...notification, show: false})} className="ml-2 hover:opacity-80"><X className="w-4 h-4"/></button></div> )}

      <div className="w-full md:w-64 bg-slate-900 text-slate-300 p-4 flex flex-col shrink-0 print:hidden">
        <div className="flex items-center justify-between mb-8 px-2 mt-4"><div className="flex items-center gap-3"><div className="bg-blue-600 p-2 rounded-lg"><Layers className="text-white w-6 h-6" /></div><div><h1 className="text-lg font-bold text-white">Fabric Cost</h1><p className="text-xs text-slate-500">Master Manager</p></div></div>{syncStatus === 'syncing' ? <Cloud className="w-4 h-4 text-yellow-400 animate-pulse" title="동기화 중..." /> : <Cloud className="w-4 h-4 text-emerald-400" title="안전하게 저장됨" />}</div>
        <div className="bg-slate-800 p-1 rounded-lg mb-6 flex text-xs font-bold"><button onClick={() => setViewMode('domestic')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${viewMode === 'domestic' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Home className="w-3 h-3"/> 내수</button><button onClick={() => setViewMode('export')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition-all ${viewMode === 'export' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Globe className="w-3 h-3"/> 수출</button></div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('calculator')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'calculator' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calculator className="w-5 h-5" /> <span>원단등록</span></button>
          <button onClick={() => setActiveTab('list')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><FileSpreadsheet className="w-5 h-5" /> <span>원단 리스트</span></button>
          <button onClick={() => setActiveTab('yarns')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'yarns' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Box className="w-5 h-5" /> <span>원사 라이브러리</span></button>
          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-4 text-xs font-bold text-slate-500 mb-2 uppercase">Sales & Export</p>
            <button onClick={() => setActiveTab('quotation')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'quotation' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><FileText className="w-5 h-5" /> <span>견적서 작성</span></button>
            <button onClick={() => setActiveTab('quoteHistory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'quoteHistory' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Calendar className="w-5 h-5" /> <span>견적 히스토리</span></button>
          </div>
        </nav>
        <button onClick={handleLogout} className="mt-6 flex items-center justify-center gap-2 px-4 py-3 text-xs text-slate-500 hover:text-white border border-slate-700 rounded-xl transition-colors w-full"><LogOut className="w-4 h-4"/> 로그아웃</button>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen print:p-0 print:overflow-visible relative">
        {activeTab === 'calculator' && (
          <div className="max-w-7xl mx-auto space-y-6 print:hidden">
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{editingFabricId ? <span className="text-yellow-600">아이템 수정 중</span> : "새 원단 등록"}</h2><div className="flex items-center gap-2 mt-1"><span className={`text-xs font-bold px-2 py-0.5 rounded ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>현재 모드: {viewMode === 'domestic' ? '내수 (관세포함)' : '수출 (관세제외)'}</span></div></div>
              <div className="flex gap-2">{editingFabricId && <button onClick={resetForm} className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg"><X className="w-4 h-4 inline-block -mt-1 mr-1" />취소</button>}<button onClick={resetForm} className="px-4 py-2 text-sm text-slate-500 hover:bg-white hover:shadow-sm rounded-lg"><RotateCcw className="w-4 h-4 inline-block -mt-1 mr-1"/>초기화</button></div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 space-y-6">
                {/* 1. Basic Info */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center"><span>1. Basic Info & Yarn <Info className="w-4 h-4 text-slate-300 inline"/></span><div className="flex items-center gap-2 bg-yellow-50 px-2 py-1 rounded border border-yellow-100"><label className="text-[10px] font-bold text-slate-500">적용 환율 (￦/$)</label><input type="number" name="exchangeRate" value={fabricInput.exchangeRate} onChange={handleFabricChange} className="w-16 bg-white border border-yellow-200 rounded text-right text-xs font-bold text-slate-700 px-1" /></div></h3>
                  <div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Article</label><input type="text" name="article" value={fabricInput.article} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="Ex. WO-24001" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label><input type="text" name="itemName" value={fabricInput.itemName} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="Item Name" /></div></div>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">내폭 (Cut)</label><input type="number" name="widthCut" value={fabricInput.widthCut} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="56" /></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">외폭 (Full)</label><input type="number" name="widthFull" value={fabricInput.widthFull} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="58" /></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">GSM</label><div className="relative"><input type="number" name="gsm" value={fabricInput.gsm} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="300" /><span className="absolute -bottom-5 right-0 text-[10px] text-slate-400">≈ {currentCalc.theoreticalGYd} g/yd</span></div></div>
                    <div className="col-span-1"><label className="block text-xs font-bold text-red-500 mb-1">실제 G/YD</label><input type="number" name="costGYd" value={fabricInput.costGYd} onChange={handleFabricChange} className="w-full bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-right font-bold text-red-600" placeholder={currentCalc.theoreticalGYd} /></div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 mt-6">
                    <p className="text-xs text-slate-400 font-bold mb-2">원사 혼용률 (Yarn Composition)</p>
                    {fabricInput.yarns.map((slot, idx) => (
                      <div key={idx} className="flex gap-2 items-center"><span className="text-xs font-mono text-slate-400 w-4">{idx+1}</span><SearchableSelect value={slot.yarnId} options={yarnLibrary} onChange={(id) => handleYarnSlotChange(idx, 'yarnId', id)} placeholder="원사 검색..." /><div className="relative w-24"><input type="number" value={slot.ratio} onChange={(e) => handleYarnSlotChange(idx, 'ratio', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-right text-sm" /><span className="absolute right-2 top-2 text-xs text-slate-400">%</span></div></div>
                    ))}
                    <div className="text-right text-xs text-slate-500 mt-2 font-mono">Avg Yarn Cost: ￦{viewMode === 'domestic' ? currentCalc.avgYarnCostDomestic.toLocaleString() : currentCalc.avgYarnCostExport.toLocaleString()} / kg</div>
                  </div>
                </div>

                {/* 2. Fees & Detailed Cost Breakdown */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex justify-between items-center">2. Fees & Cost Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">염가공비 (￦/kg)</label><input type="number" name="dyeingFee" value={fabricInput.dyeingFee} onChange={handleFabricChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-right" placeholder="0" /></div>
                    <div><label className="block text-xs font-bold text-purple-600 mb-1">관리비 (￦/YD)</label><input type="number" name="managementFeeYd" value={fabricInput.managementFeeYd} onChange={handleFabricChange} className="w-full bg-purple-50 border border-purple-100 text-purple-700 rounded-lg px-3 py-2 text-right font-bold" placeholder="0" /></div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 text-xs text-center">
                    <div className="grid grid-cols-4 bg-slate-100 text-slate-600 font-bold py-2 border-b border-slate-200"><div className="text-left pl-3">항목 / 구간</div><div>1,000 YD</div><div className="text-blue-700 bg-blue-50/50">3,000 YD</div><div>5,000 YD</div></div>
                    <div className="divide-y divide-slate-100 bg-white">
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비(kg)</div><div className="px-1"><input type="number" name="knittingFee1k" value={fabricInput.knittingFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="knittingFee3k" value={fabricInput.knittingFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="knittingFee5k" value={fabricInput.knittingFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.knit} onChange={(e) => handleNestedChange('losses', 'tier1k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.knit} onChange={(e) => handleNestedChange('losses', 'tier3k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.knit} onChange={(e) => handleNestedChange('losses', 'tier5k', 'knit', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공 Loss%</div><div className="px-1"><input type="number" value={fabricInput.losses.tier1k.dye} onChange={(e) => handleNestedChange('losses', 'tier1k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div><div className="px-1 bg-blue-50/30"><input type="number" value={fabricInput.losses.tier3k.dye} onChange={(e) => handleNestedChange('losses', 'tier3k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none font-bold" /></div><div className="px-1"><input type="number" value={fabricInput.losses.tier5k.dye} onChange={(e) => handleNestedChange('losses', 'tier5k', 'dye', e.target.value)} className="w-full text-center text-red-500 bg-transparent outline-none" /></div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500 flex items-center gap-1">부대비용(YD) <Truck className="w-3 h-3 text-slate-300"/></div><div className="px-1"><input type="number" name="extraFee1k" value={fabricInput.extraFee1k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div><div className="px-1 bg-blue-50/30"><input type="number" name="extraFee3k" value={fabricInput.extraFee3k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none font-bold text-blue-700 border-b border-dashed border-blue-200 focus:border-blue-400" /></div><div className="px-1"><input type="number" name="extraFee5k" value={fabricInput.extraFee5k} onChange={handleFabricChange} className="w-full text-center bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-blue-400 text-slate-600" /></div></div>
                      
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">원사비/YD ({viewMode === 'domestic' ? '￦' : '$'})</div><div>{currentCalc.tier1k[viewMode].yarnCostYd.toLocaleString()}</div><div className="bg-blue-50/30 font-bold">{currentCalc.tier3k[viewMode].yarnCostYd.toLocaleString()}</div><div>{currentCalc.tier5k[viewMode].yarnCostYd.toLocaleString()}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">편직비/YD ({viewMode === 'domestic' ? '￦' : '$'})</div><div>{currentCalc.tier1k[viewMode].knitCostYd.toLocaleString()}</div><div className="bg-blue-50/30 font-bold">{currentCalc.tier3k[viewMode].knitCostYd.toLocaleString()}</div><div>{currentCalc.tier5k[viewMode].knitCostYd.toLocaleString()}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">염가공비/YD ({viewMode === 'domestic' ? '￦' : '$'})</div><div>{currentCalc.tier1k[viewMode].dyeCostYd.toLocaleString()}</div><div className="bg-blue-50/30 font-bold">{currentCalc.tier3k[viewMode].dyeCostYd.toLocaleString()}</div><div>{currentCalc.tier5k[viewMode].dyeCostYd.toLocaleString()}</div></div>
                      <div className="grid grid-cols-4 py-1.5 items-center bg-slate-50/50"><div className="text-left pl-3 text-[11px] font-semibold text-slate-500">부대비용/YD ({viewMode === 'domestic' ? '￦' : '$'})</div><div>{currentCalc.tier1k[viewMode].extraFeeYd.toLocaleString()}</div><div className="bg-blue-50/30 font-bold">{currentCalc.tier3k[viewMode].extraFeeYd.toLocaleString()}</div><div>{currentCalc.tier5k[viewMode].extraFeeYd.toLocaleString()}</div></div>

                      <div className="grid grid-cols-4 py-2 items-center bg-slate-100 border-t border-slate-200"><div className="text-left pl-3 text-xs font-bold text-slate-700">최종 제조 원가 ({viewMode === 'domestic' ? '￦' : '$'})</div><div className="font-mono">{currentCalc.tier1k[viewMode].totalCostYd.toLocaleString()}</div><div className="bg-blue-100/50 font-mono font-bold text-blue-800">{currentCalc.tier3k[viewMode].totalCostYd.toLocaleString()}</div><div className="font-mono">{currentCalc.tier5k[viewMode].totalCostYd.toLocaleString()}</div></div>
                    </div>
                  </div>
                </div>

                {/* ✅ 3. 새로운 Sales Margin & Brand Extra 설정 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                      3. Sales Margin & Brand Extra <HelpCircle className="w-3 h-3 text-slate-300" title="Gross Margin (매출이익률) 방식: Price = Cost / (1 - Margin%)"/>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* 1) 마진 단계 선택 */}
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-between">
                        <div>
                           <div className="text-emerald-800 font-bold text-sm mb-2 flex items-center gap-2"><Factory className="w-4 h-4"/> 도매(Conv) 마진 단계 지정</div>
                           <select 
                             value={fabricInput.marginTier} 
                             onChange={(e) => setFabricInput({...fabricInput, marginTier: Number(e.target.value)})} 
                             className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800 font-bold mt-2"
                           >
                             {Object.entries(MARGIN_TIERS).map(([tier, pct]) => (
                               <option key={tier} value={tier}>{tier}단계 ({pct}%)</option>
                             ))}
                           </select>
                        </div>
                        <p className="text-xs text-emerald-600 mt-3">* 기본단가 = 제조원가 / (1 - {MARGIN_TIERS[fabricInput.marginTier || 0]}%) 로 계산됩니다.</p>
                      </div>

                      {/* 2) 브랜드 직납 추가금 설정 */}
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
                        <div>
                           <div className="text-indigo-800 font-bold text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4"/> Brand 직납 추가금 (￦/YD)</div>
                           <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-indigo-600 font-bold mb-1 mt-2">
                             <span>1,000 YD</span><span>3,000 YD</span><span>5,000 YD</span>
                           </div>
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
              
              {/* Result Sticky */}
              <div className="xl:col-span-5 space-y-6">
                <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl sticky top-6">
                   <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      판매 단가 분석표
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${viewMode === 'domestic' ? 'border-blue-400 text-blue-300' : 'border-emerald-400 text-emerald-300'}`}>{viewMode === 'domestic' ? 'Domestic (내수)' : 'Export (수출)'}</span>
                   </h3>
                   {['tier1k', 'tier3k', 'tier5k'].map(tier => {
                      const data = currentCalc[tier][viewMode]; 
                      const requiredKg = currentCalc[tier].requiredKg;
                      const label = tier === 'tier1k' ? '1,000 YD' : tier === 'tier3k' ? '3,000 YD' : '5,000 YD';
                      const symbol = viewMode === 'domestic' ? '￦' : '$';
                      
                      return (
                         <div key={tier} className="mb-4 pb-4 border-b border-slate-700/50">
                           <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-slate-300">{label}</span><span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Need {requiredKg.toLocaleString()}kg</span></div>
                           <div className="grid grid-cols-3 gap-2 text-right">
                             <div><p className="text-[10px] text-slate-500">원가</p><p className="font-mono text-slate-300 text-sm">{symbol}{data.totalCostYd.toLocaleString()}</p></div>
                             <div><p className="text-[10px] text-emerald-500">Conv (기본)</p><p className="font-mono text-emerald-400 font-bold">{symbol}{data.priceConverter.toLocaleString()}</p></div>
                             <div><p className="text-[10px] text-indigo-500">Brand (직납)</p><p className="font-mono text-indigo-400 font-bold">{symbol}{data.priceBrand.toLocaleString()}</p></div>
                           </div>
                         </div>
                      );
                   })}
                   <button onClick={handleSaveFabric} className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-4">
                      {editingFabricId ? <><Save className="w-4 h-4"/> 수정 저장</> : <><Plus className="w-4 h-4"/> 클라우드 저장</>}
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'list' || activeTab === 'yarns' || activeTab === 'quotation' || activeTab === 'quoteHistory') && (
           <div className="print:hidden">
             
             {/* TAB 2: LIST (생략 없이 유지) */}
             {activeTab === 'list' && (
               <div className="max-w-[1600px] mx-auto">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                     <div className="flex items-center gap-4"><h2 className="text-2xl font-bold text-slate-800">원단 리스트 ({filteredFabrics.length})</h2><span className={`text-xs font-bold px-3 py-1 rounded-full ${viewMode === 'domestic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{viewMode === 'domestic' ? '기준: 내수 (관세포함)' : '기준: 수출 (관세제외)'}</span></div>
                     <div className="flex gap-2 items-center w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64"><input type="text" placeholder="Article 또는 품명 검색..." value={fabricSearchTerm} onChange={(e) => setFabricSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white" /><Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />{fabricSearchTerm && <button onClick={() => setFabricSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>}</div>
                        <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center shrink-0 gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"><Upload className="w-4 h-4"/> 엑셀 등록</button>
                     </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200"><tr><th className="p-4">Article</th><th className="p-4 text-right">Spec</th><th className="p-4 text-right">3k Cost</th><th className="p-4 text-right text-emerald-600">3k Conv</th><th className="p-4 text-right text-indigo-600">3k Brand</th><th className="p-4 text-center">Action</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredFabrics.map(f => { const c = calculateCost(f); const data = c.tier3k[viewMode]; return ( <tr key={f.id} className="hover:bg-slate-50"><td className="p-4"><b>{f.article}</b><div className="text-xs text-slate-500">{f.itemName}</div></td><td className="p-4 text-right text-slate-600">{f.widthFull}" / {f.gsm}g</td><td className="p-4 text-right font-mono text-slate-500">{viewMode === 'domestic'?'￦':'$'}{data.totalCostYd.toLocaleString()}</td><td className="p-4 text-right font-mono font-bold text-emerald-700">{viewMode === 'domestic'?'￦':'$'}{data.priceConverter.toLocaleString()}</td><td className="p-4 text-right font-mono font-bold text-indigo-700">{viewMode === 'domestic'?'￦':'$'}{data.priceBrand.toLocaleString()}</td><td className="p-4 text-center flex justify-center gap-2"><button onClick={() => handleEditFabric(f)} className="p-2 hover:bg-blue-50 text-blue-500 rounded"><Edit2 className="w-4 h-4"/></button><button onClick={() => handleDeleteFabric(f.id)} className="p-2 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-4 h-4"/></button></td></tr> ); })}
                        {filteredFabrics.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">데이터가 없습니다.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}

             {/* TAB 3: YARN LIBRARY (생략 없이 유지) */}
             {activeTab === 'yarns' && (
               <div className="max-w-6xl mx-auto space-y-6">
                 <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">원사 라이브러리 ({filteredYarns.length})</h2><div className="flex gap-2 items-center">{editingYarnId && <button onClick={handleCancelYarnEdit} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800 mr-2"><X className="w-4 h-4"/> 수정 취소</button>}<button onClick={() => setIsYarnBulkModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm text-sm font-bold"><Upload className="w-4 h-4"/> 엑셀 대량 등록</button></div></div>
                 <div className={`bg-white p-6 rounded-2xl border transition-all ${editingYarnId ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-slate-200'}`}><div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4"><div className="col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Category</label><select value={yarnInput.category} onChange={e => setYarnInput({...yarnInput, category: e.target.value})} className="w-full border rounded-lg p-2 text-sm bg-white">{YARN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div><div className="col-span-3"><label className="text-xs font-bold text-slate-500 mb-1 block">원사명</label><input type="text" value={yarnInput.name} onChange={e=>setYarnInput({...yarnInput, name:e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="예: 2/48 Wool"/></div><div className="col-span-3"><label className="text-xs font-bold text-slate-500 mb-1 block">Supplier (공급처)</label><input type="text" value={yarnInput.supplier} onChange={e=>setYarnInput({...yarnInput, supplier:e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="예: Yarn Co."/></div><div className="col-span-4"><label className="text-xs font-bold text-slate-500 mb-1 block">특이사항</label><input type="text" value={yarnInput.remarks} onChange={e=>setYarnInput({...yarnInput, remarks:e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="메모..."/></div></div><div className="flex items-end gap-4"><div className="flex-1 grid grid-cols-3 gap-4"><div className="col-span-2 flex gap-2"><div className="w-24"><label className="text-xs font-bold text-slate-500 mb-1 block">화폐</label><select value={yarnInput.currency} onChange={e => setYarnInput({...yarnInput, currency: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold bg-slate-50"><option value="KRW">KRW(￦)</option><option value="USD">USD($)</option></select></div><div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">단가</label><input type="number" value={yarnInput.price} onChange={e=>setYarnInput({...yarnInput, price:e.target.value})} className="w-full border rounded-lg p-2 text-right font-mono font-bold" placeholder="0"/></div></div><div><label className="text-xs font-bold text-blue-600 mb-1 block">관세 (%)</label><input type="number" value={yarnInput.tariff} onChange={e=>setYarnInput({...yarnInput, tariff:e.target.value})} className="w-full border border-blue-200 rounded-lg p-2 text-right font-bold text-blue-700" placeholder="8"/></div></div><button onClick={handleSaveYarn} className={`px-8 py-2.5 rounded-lg flex gap-2 h-[42px] items-center font-bold text-white transition-colors ${editingYarnId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-slate-900 hover:bg-slate-800'}`}>{editingYarnId ? <><Save className="w-4 h-4"/> 수정 저장</> : <><Plus className="w-4 h-4"/> 추가</>}</button></div></div>
                 <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">{YARN_CATEGORIES.map(cat => ( <button key={cat} onClick={() => setYarnFilterCategory(cat)} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${yarnFilterCategory === cat ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{cat}</button> ))}</div>
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200"><tr><th className="p-4 w-24">Category</th><th className="p-4">Yarn Name</th><th className="p-4">Supplier</th><th className="p-4 text-right">Price (Export)</th><th className="p-4 text-right">Tariff</th><th className="p-4 text-right text-blue-600">Price (Domestic)</th><th className="p-4">Remarks</th><th className="p-4 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredYarns.map(y => ( <tr key={y.id} className="hover:bg-slate-50 group"><td className="p-4 text-slate-500 text-xs font-bold">{y.category || '-'}</td><td className="p-4 font-bold text-slate-800">{y.name}</td><td className="p-4 text-slate-600">{y.supplier || '-'}</td><td className="p-4 text-right font-mono relative group/price"><div className="flex items-center justify-end gap-2"><span>{y.currency === 'USD' ? '$' : '￦'}{y.price.toLocaleString()}</span>{y.history && y.history.length > 0 && ( <div className="relative"><History className="w-3 h-3 text-slate-400 cursor-help"/><div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 text-white text-[10px] rounded p-2 z-50 hidden group-hover/price:block shadow-xl text-left pointer-events-none"><p className="font-bold mb-1 border-b border-slate-600 pb-1 text-slate-300">Price History</p>{y.history.map((h, i) => (<div key={i} className="flex justify-between py-0.5"><span className="text-slate-400">{h.date}</span><span className="font-mono">￦{h.price.toLocaleString()}</span></div>))}</div></div> )}</div></td><td className="p-4 text-right text-slate-500">{y.tariff || 0}%</td><td className="p-4 text-right font-mono font-bold text-blue-600">{y.currency === 'USD' ? <span className="text-xs text-slate-400 italic">Calc by Rate</span> : `￦${Math.round(y.price * (1 + (y.tariff||0)/100)).toLocaleString()}`}</td><td className="p-4 text-slate-500 text-xs">{y.remarks}</td><td className="p-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEditYarn(y)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4"/></button><button onClick={() => handleDeleteYarn(y.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button></div></td></tr> ))}</tbody></table></div>
               </div>
             )}

             {/* ✅ TAB 4: QUOTATION (바이어 난이도 마진 적용) */}
             {activeTab === 'quotation' && (
               <div className="max-w-7xl mx-auto space-y-8">
                 <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-600"/> 견적서 작성</h2><div className="flex gap-2"><button onClick={handleSaveQuote} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2"><Save className="w-4 h-4"/> 견적서 클라우드 저장</button><button onClick={handleDownloadPDF} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200"><Download className="w-4 h-4"/> PDF 다운로드</button></div></div>
                 
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Buyer Information & Currency</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                       <div className="lg:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Buyer Name</label><input type="text" value={quoteInput.buyerName} onChange={(e) => setQuoteInput({...quoteInput, buyerName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" placeholder="바이어 이름 입력"/></div>
                       <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Quote Date</label><input type="date" value={quoteInput.date} onChange={(e) => setQuoteInput({...quoteInput, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"/></div>
                       <div className="lg:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Settings</label><div className="flex bg-slate-100 p-1 rounded-lg gap-1"><button onClick={() => setQuoteInput({...quoteInput, buyerType: 'converter'})} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'converter' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Conv</button><button onClick={() => setQuoteInput({...quoteInput, buyerType: 'brand'})} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.buyerType === 'brand' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Brand</button><div className="w-px bg-slate-300 mx-1"></div><button onClick={() => setQuoteInput({...quoteInput, marketType: 'domestic'})} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'domestic' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dom</button><button onClick={() => setQuoteInput({...quoteInput, marketType: 'export'})} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${quoteInput.marketType === 'export' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Exp</button></div></div>
                       
                       {/* ✅ 추가 마진 입력칸 */}
                       <div className="lg:col-span-1">
                          <label className="block text-xs font-bold text-indigo-500 mb-1 flex items-center gap-1">바이어 난이도 마진</label>
                          <div className="relative">
                             <input type="number" value={quoteInput.extraMargin || 0} onChange={(e) => setQuoteInput({...quoteInput, extraMargin: Number(e.target.value)})} className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-right font-bold text-indigo-700 outline-none" placeholder="0" />
                             <span className="absolute right-3 top-2 text-xs text-indigo-400 font-bold">%</span>
                          </div>
                       </div>

                       <div className="lg:col-span-1 bg-yellow-50/50 p-2 rounded-xl border border-yellow-100"><div className="flex flex-col gap-2"><div><div className="flex bg-white border border-slate-200 rounded-lg p-1"><button onClick={() => handleCurrencyToggle('KRW')} className={`flex-1 py-0.5 rounded text-[10px] font-bold transition-all ${quoteInput.currency === 'KRW' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>KRW</button><button onClick={() => handleCurrencyToggle('USD')} className={`flex-1 py-0.5 rounded text-[10px] font-bold transition-all ${quoteInput.currency === 'USD' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>USD</button></div></div><div className="flex items-center gap-2"><span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">환율 (￦/$)</span><input type="number" value={quoteInput.exchangeRate} onChange={(e) => setQuoteInput({...quoteInput, exchangeRate: e.target.value})} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right font-mono font-bold text-slate-700 text-xs"/></div></div></div>
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="text-sm font-bold text-slate-400 uppercase">Select Fabrics</h3>
                       <div className="flex gap-2 w-full max-w-md">
                          <SearchableSelect value={selectedFabricIdForQuote} options={savedFabrics} onChange={setSelectedFabricIdForQuote} placeholder="리스트에서 원단 검색..." labelKey="article" valueKey="id"/>
                          <button onClick={handleAddFabricToQuote} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 shrink-0">+ 견적에 추가</button>
                       </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                       <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200"><tr><th className="p-4 w-12">No.</th><th className="p-4">Article</th><th className="p-4">Spec (품명)</th><th className="p-4 text-center">내폭</th><th className="p-4 text-center">외폭</th><th className="p-4 text-right">GSM</th><th className="p-4 text-right">g/YD</th><th className="p-4 w-28 bg-slate-100 text-right">1,000YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-4 w-28 bg-indigo-50 text-indigo-900 text-right">3,000YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-4 w-28 bg-slate-100 text-right">5,000YD ({quoteInput.currency === 'USD' ? '$' : '￦'})</th><th className="p-4 w-12 text-center"></th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                             {quoteInput.items.map((item, idx) => (
                                <tr key={idx} className="group hover:bg-slate-50">
                                   <td className="p-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                                   <td className="p-4 font-bold text-slate-800">{item.article}</td>
                                   <td className="p-4 text-slate-600">{item.itemName}</td>
                                   <td className="p-4 text-slate-500 text-center">{item.widthCut}"</td>
                                   <td className="p-4 text-slate-500 text-center">{item.widthFull}"</td>
                                   <td className="p-4 text-right text-slate-500">{item.gsm}</td>
                                   <td className="p-4 text-right text-slate-500 font-mono">{item.gYd}</td>
                                   <td className="p-2 bg-slate-50"><input type="number" value={item.price1k} onChange={(e) => handleQuotePriceChange(idx, 'price1k', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none"/></td>
                                   <td className="p-2 bg-indigo-50/30"><input type="number" value={item.price3k} onChange={(e) => handleQuotePriceChange(idx, 'price3k', e.target.value)} className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-right font-bold text-indigo-700 focus:border-indigo-500 outline-none"/></td>
                                   <td className="p-2 bg-slate-50"><input type="number" value={item.price5k} onChange={(e) => handleQuotePriceChange(idx, 'price5k', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-600 focus:border-indigo-500 outline-none"/></td>
                                   <td className="p-2 text-center"><button onClick={() => handleRemoveItemFromQuote(idx)} className="text-slate-300 hover:text-red-500 p-1"><X className="w-4 h-4"/></button></td>
                                </tr>
                             ))}
                             {quoteInput.items.length === 0 && <tr><td colSpan="11" className="p-8 text-center text-slate-400">원단을 검색하고 '+ 견적에 추가' 버튼을 눌러주세요.</td></tr>}
                          </tbody>
                       </table>
                    </div>
                    <p className="text-right text-xs text-slate-400 mt-2">* 바이어 난이도 마진은 원단을 추가하는 시점에 계산되어 반영됩니다.</p>
                 </div>
               </div>
             )}

             {/* TAB 5: HISTORY (생략 없이 유지) */}
             {activeTab === 'quoteHistory' && (
                 <div className="max-w-6xl mx-auto space-y-6">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="w-6 h-6 text-indigo-600"/> 견적 히스토리</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {savedQuotes.map(quote => (
                          <div key={quote.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group"><p className="text-xs font-bold text-slate-400 mb-1">{quote.date}</p><h3 className="text-lg font-bold text-slate-800 mb-1">{quote.buyerName}</h3><div className="flex gap-2 mb-4"><span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${quote.buyerType === 'converter' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{quote.buyerType}</span><span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${quote.marketType === 'domestic' ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'}`}>{quote.marketType === 'domestic' ? '내수' : '수출'}</span><span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-slate-100 text-slate-600">{quote.currency}</span></div><div className="mt-4 flex gap-2"><button onClick={() => { setQuoteInput(quote); setActiveTab('quotation'); }} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-sm font-bold hover:bg-slate-100">열기/수정</button><button onClick={() => { setQuoteInput(quote); setTimeout(() => handleDownloadPDF(), 300); }} className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100">PDF 다운</button></div></div>
                       ))}
                       {savedQuotes.length === 0 && <div className="col-span-full py-12 text-center text-slate-400">저장된 견적서가 없습니다.</div>}
                    </div>
                 </div>
             )}
           </div>
        )}
        
        {/* 모달 및 PDF 렌더링 영역 (생략 없이 기존 코드 유지) */}
        {isBulkModalOpen && ( <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600"/> 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드</p><button onClick={handleDownloadTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} ref={fileInputRef} /></label></div></div></div></div> )}
        {isYarnBulkModalOpen && ( <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative"><button onClick={() => setIsYarnBulkModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button><h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600"/> 원사 엑셀 일괄 등록</h3><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">1. 양식 다운로드</p><button onClick={handleDownloadYarnTemplate} className="w-full flex justify-center items-center gap-2 bg-white border border-slate-300 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> 원사 양식 다운로드 (.xlsx)</button></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-200"><p className="text-sm font-bold text-slate-700 mb-2">2. 파일 업로드</p><label className="w-full flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors"><Upload className="w-8 h-8 text-slate-400 mb-2" /><span className="text-sm text-slate-500 font-medium">클릭하여 엑셀 파일 선택</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleYarnFileUpload} ref={yarnFileInputRef} /></label></div></div></div></div> )}

        <div ref={printRef} className={`fixed inset-0 bg-white z-[9999] p-12 ${isPdfGenerating ? 'block' : 'hidden'}`}>
           <div className="max-w-[297mm] mx-auto landscape:max-w-none">
              <div className="flex justify-center mb-8"><div className="text-center"><div className="flex items-center justify-center gap-3 text-cyan-600 mb-2"><Cloud className="w-12 h-12 fill-current" /><h1 className="text-5xl font-extrabold tracking-tight">G R U B I G</h1></div></div></div>
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-8"><h2 className="text-2xl font-serif font-bold text-slate-900 mb-1">FABRIC QUOTATION</h2><p className="text-slate-500 text-sm font-bold">FOB PRICE</p></div>
              <div className="flex justify-between mb-8"><div className="w-1/2"><p className="text-xs text-slate-400 uppercase font-bold mb-1">To</p><h2 className="text-xl font-bold text-slate-900">{quoteInput.buyerName}</h2><p className="text-sm text-slate-600 capitalize">{quoteInput.buyerType} Partner / {quoteInput.marketType === 'domestic' ? 'Domestic Market' : 'Export Market'}</p></div><div className="w-1/2 text-right"><p className="text-xs text-slate-400 uppercase font-bold mb-1">Date</p><h2 className="text-xl font-bold text-slate-900">{quoteInput.date}</h2><p className="text-xs text-slate-500 mt-2">Currency: {quoteInput.currency} (Rate: {quoteInput.exchangeRate})</p></div></div>
              <table className="w-full text-sm text-left mb-8 border-collapse">
                 <thead><tr className="border-b-2 border-slate-800"><th className="py-2 font-bold text-slate-900">Article</th><th className="py-2 font-bold text-slate-900">Spec (품명)</th><th className="py-2 font-bold text-slate-900 text-center">내폭</th><th className="py-2 font-bold text-slate-900 text-center">외폭</th><th className="py-2 font-bold text-slate-900 text-right">GSM</th><th className="py-2 font-bold text-slate-900 text-right">g/YD</th><th className="py-2 font-bold text-slate-900 text-right">1,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">3,000 YD</th><th className="py-2 font-bold text-slate-900 text-right">5,000 YD</th></tr></thead>
                 <tbody className="divide-y divide-slate-200">
                    {quoteInput.items.map((item, idx) => ( <tr key={idx}><td className="py-4 font-bold text-slate-800">{item.article}</td><td className="py-4 text-slate-600">{item.itemName}</td><td className="py-4 text-center text-slate-500">{item.widthCut}"</td><td className="py-4 text-center text-slate-500">{item.widthFull}"</td><td className="py-4 text-right text-slate-500">{item.gsm}</td><td className="py-4 text-right text-slate-500 font-mono">{item.gYd}</td><td className="py-4 text-right font-mono">{formatQuotePrice(item.price1k)}</td><td className="py-4 text-right font-mono font-bold">{formatQuotePrice(item.price3k)}</td><td className="py-4 text-right font-mono">{formatQuotePrice(item.price5k)}</td></tr> ))}
                 </tbody>
              </table>
              <div className="border-t-2 border-slate-800 pt-6 mt-12 text-xs text-slate-500 font-medium leading-relaxed"><p className="mb-1">• VALID UNTIL: <span className="font-bold text-slate-800">{getLastDayOfMonth()}</span></p><p className="mb-1">• ±5% WEIGHT AND WIDTH TOLERANCE</p><p className="mb-1">• BULK PRICING NEGOTIABLE</p><p>• UPCHARGE APPLIES FOR ORDERS BELOW MCQ/MOQ</p></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;