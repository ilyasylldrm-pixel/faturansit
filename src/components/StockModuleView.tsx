import React, { useState, useMemo } from 'react';
import {
  Boxes,
  PackagePlus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  Store,
  Barcode,
  Layers,
  Coins,
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Tag,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Save,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  StockItem,
  StockMovement,
  StockMovementType,
  Warehouse,
  PlatformUser,
} from '../types/invoicing';

interface StockModuleViewProps {
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  warehouses: Warehouse[];
  onAddStockItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'lastMovementDate' | 'reservedStock'>) => void;
  onUpdateStockItem: (item: StockItem) => void;
  onDeleteStockItem: (id: string) => void;
  onAddStockMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>) => void;
  onAddWarehouse: (warehouse: Omit<Warehouse, 'id'>) => void;
  onSyncMarketplaceStocks: (channel?: string) => Promise<void>;
  currentUser?: PlatformUser;
  onClearStockList?: () => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

type StockSubTab = 'inventory' | 'movements' | 'warehouses' | 'marketplace_sync';

export const StockModuleView: React.FC<StockModuleViewProps> = ({
  stockItems,
  stockMovements,
  warehouses,
  onAddStockItem,
  onUpdateStockItem,
  onDeleteStockItem,
  onAddStockMovement,
  onAddWarehouse,
  onSyncMarketplaceStocks,
  currentUser,
  onClearStockList,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<StockSubTab>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<StockItem | null>(null);
  const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<StockItem | null>(null);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Movement Form state
  const [movType, setMovType] = useState<StockMovementType>('PURCHASE_IN');
  const [movQty, setMovQty] = useState<number>(1);
  const [movDocNo, setMovDocNo] = useState<string>('');
  const [movNotes, setMovNotes] = useState<string>('');
  const [movChannel, setMovChannel] = useState<string>('Manuel Depo Hareketi');

  // New Stock Form state
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Genel');
  const [newBrand, setNewBrand] = useState('');
  const [newUnit, setNewUnit] = useState('Adet');
  const [newVatRate, setNewVatRate] = useState<number>(20);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(0);
  const [newSalePrice, setNewSalePrice] = useState<number>(0);
  const [newStockQty, setNewStockQty] = useState<number>(0);
  const [newCritical, setNewCritical] = useState<number>(5);
  const [newWarehouseId, setNewWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-1');
  const [formError, setFormError] = useState<string | null>(null);

  // New Warehouse state
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whCity, setWhCity] = useState('İstanbul');
  const [whDistrict, setWhDistrict] = useState('');
  const [whAddress, setWhAddress] = useState('');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [stockItems]);

  // KPI Calculations
  const kpi = useMemo(() => {
    const totalItems = stockItems.length;
    let totalStockQty = 0;
    let totalPurchaseVal = 0;
    let totalSaleVal = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;

    stockItems.forEach((item) => {
      totalStockQty += item.currentStock;
      totalPurchaseVal += item.currentStock * item.purchasePrice;
      totalSaleVal += item.currentStock * item.salePrice;
      if (item.currentStock === 0) {
        outOfStockCount++;
      } else if (item.currentStock <= item.criticalThreshold) {
        criticalCount++;
      }
    });

    return {
      totalItems,
      totalStockQty,
      totalPurchaseVal,
      totalSaleVal,
      criticalCount,
      outOfStockCount,
    };
  }, [stockItems]);

  // Filtered Inventory items
  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (selectedWarehouseId !== 'ALL' && item.warehouseId !== selectedWarehouseId) {
        return false;
      }
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'CRITICAL' && (item.currentStock > item.criticalThreshold || item.currentStock === 0)) {
        return false;
      }
      if (statusFilter === 'OUT_OF_STOCK' && item.currentStock > 0) {
        return false;
      }
      if (statusFilter === 'IN_STOCK' && item.currentStock <= item.criticalThreshold) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchBarcode = item.barcode.toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchBarcode && !matchBrand) return false;
      }
      return true;
    });
  }, [stockItems, selectedWarehouseId, categoryFilter, statusFilter, searchQuery]);

  // Handle Manual Movement Submit
  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForMovement || movQty <= 0) return;

    const isExit =
      movType === 'SALES_OUT' ||
      movType === 'WASTE_OUT' ||
      movType === 'TRANSFER';

    const direction = isExit ? 'OUT' : 'IN';
    const prev = selectedItemForMovement.currentStock;
    const next = isExit ? Math.max(0, prev - movQty) : prev + movQty;

    onAddStockMovement({
      stockItemId: selectedItemForMovement.id,
      sku: selectedItemForMovement.sku,
      productName: selectedItemForMovement.name,
      type: movType,
      quantity: movQty,
      direction,
      previousStock: prev,
      newStock: next,
      unitPrice: isExit ? selectedItemForMovement.salePrice : selectedItemForMovement.purchasePrice,
      documentNumber: movDocNo.trim() || undefined,
      sourceChannel: movChannel.trim() || undefined,
      notes: movNotes.trim() || undefined,
      actorName: currentUser ? currentUser.fullName : 'Kaan Özdemir (Admin)',
    });

    setShowMovementModal(false);
    setSelectedItemForMovement(null);
    setMovQty(1);
    setMovDocNo('');
    setMovNotes('');
  };

  // Handle New Item Submit
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newSku.trim()) {
      setFormError('Lütfen geçerli bir Stok Kodu (SKU) giriniz.');
      return;
    }
    if (!newName.trim()) {
      setFormError('Lütfen ürün adını giriniz.');
      return;
    }

    const wh = warehouses.find((w) => w.id === newWarehouseId) || warehouses[0];

    onAddStockItem({
      sku: newSku.trim().toUpperCase(),
      barcode: newBarcode.trim() || `868${Date.now().toString().slice(-10)}`,
      name: newName.trim(),
      category: newCategory.trim() || 'Genel',
      brand: newBrand.trim() || undefined,
      unit: newUnit.trim() || 'Adet',
      vatRate: newVatRate,
      purchasePrice: Number(newPurchasePrice) || 0,
      salePrice: Number(newSalePrice) || 0,
      currentStock: Number(newStockQty) || 0,
      criticalThreshold: Number(newCritical) || 5,
      warehouseId: wh.id,
      warehouseName: wh.name,
      marketplaceSync: {
        trendyol: true,
        hepsiburada: true,
        amazon: true,
      },
    });

    setShowAddModal(false);
    setNewSku('');
    setNewBarcode('');
    setNewName('');
    setNewPurchasePrice(0);
    setNewSalePrice(0);
    setNewStockQty(0);
  };

  // Handle New Warehouse Submit
  const handleAddWarehouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;

    onAddWarehouse({
      name: whName.trim(),
      code: whCode.trim().toUpperCase(),
      city: whCity.trim(),
      district: whDistrict.trim(),
      address: whAddress.trim(),
      isDefault: warehouses.length === 0,
    });

    setShowWarehouseModal(false);
    setWhName('');
    setWhCode('');
    setWhDistrict('');
    setWhAddress('');
  };

  // Handle Marketplace Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);
    try {
      await onSyncMarketplaceStocks();
      setSyncSuccessMsg('Tüm aktif pazaryerlerine (Trendyol, Hepsiburada, Amazon) stok verileri senkronize edildi.');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Stok Kodu',
      'Barkod',
      'Ürün Adı',
      'Kategori',
      'Depo',
      'Mevcut Stok',
      'Rezerve',
      'Net Kullanılabilir',
      'Kritik Eşik',
      'KDV Oranı',
      'Alış Fiyatı (TL)',
      'Satış Fiyatı (TL)',
      'Toplam Alış Değeri (TL)',
      'Toplam Satış Değeri (TL)',
      'Durum',
    ];

    const rows = filteredItems.map((item) => {
      const net = Math.max(0, item.currentStock - item.reservedStock);
      const totalBuy = item.currentStock * item.purchasePrice;
      const totalSell = item.currentStock * item.salePrice;
      const status =
        item.currentStock === 0
          ? 'TÜKENDİ'
          : item.currentStock <= item.criticalThreshold
          ? 'KRİTİK'
          : 'YETERLİ';

      return [
        `"${item.sku}"`,
        `"${item.barcode}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        `"${item.warehouseName}"`,
        item.currentStock,
        item.reservedStock,
        net,
        item.criticalThreshold,
        `%${item.vatRate}`,
        item.purchasePrice.toFixed(2),
        item.salePrice.toFixed(2),
        totalBuy.toFixed(2),
        totalSell.toFixed(2),
        status,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Faturansit-Stok-Envanteri-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Boxes className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Stok & Envanter Yönetimi
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Canlı Depo Takibi
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Çoklu depo bazında stok kartları, kritik miktar alarmları, gelen e-fatura & pazaryeri otomatik stok çıkışları ve EAN-13 barkod yönetimi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isSyncing ? 'Pazaryerleri Eşitleniyor...' : 'Pazaryerlerine Stok Gönder'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Excel/CSV İndir</span>
            </button>

            {onClearStockList && stockItems.length > 0 && (
              showClearConfirm ? (
                <div className="inline-flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-200 rounded-lg text-xs">
                  <span className="text-[11px] font-semibold text-rose-800 px-1">Tüm liste boşaltılsın mı?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearStockList();
                      setShowClearConfirm(false);
                    }}
                    className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                  >
                    Evet, Boşalt
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  title="Stok listesini ve tüm kartları temizle"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Listeyi Boşalt</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Stok Kartı Ekle</span>
            </button>

            {onSaveAllModules && (
              <button
                type="button"
                onClick={() => onSaveAllModules('Stok Modülü')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            )}
          </div>
        </div>

        {syncSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* KPI Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 mt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg">
            <span className="text-[11px] font-medium text-slate-500 block">Stok Kart Sayısı</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">{kpi.totalItems}</span>
            <span className="text-[10px] text-slate-400">Aktif tanımlı SKU</span>
          </div>

          <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg">
            <span className="text-[11px] font-medium text-slate-500 block">Toplam Stok Adedi</span>
            <span className="text-lg font-bold text-blue-700 mt-0.5 block">{kpi.totalStockQty.toLocaleString('tr-TR')}</span>
            <span className="text-[10px] text-slate-400">Fiziksel depodaki ürün</span>
          </div>

          <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg">
            <span className="text-[11px] font-medium text-slate-500 block">Envanter Maliyeti</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {kpi.totalPurchaseVal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
            </span>
            <span className="text-[10px] text-slate-400">Alış bedeli toplamı</span>
          </div>

          <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg">
            <span className="text-[11px] font-medium text-slate-500 block">Potansiyel Ciro</span>
            <span className="text-base font-bold text-emerald-700 mt-0.5 block font-mono">
              {kpi.totalSaleVal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
            </span>
            <span className="text-[10px] text-slate-400">Perakende satış değeri</span>
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-800">Kritik Stok Uyarısı</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-lg font-bold text-amber-700 mt-0.5 block">{kpi.criticalCount}</span>
            <span className="text-[10px] text-amber-600">Eşik altına inen ürün</span>
          </div>

          <div className="p-3 bg-rose-50/60 border border-rose-200/60 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-800">Tükenen Ürünler</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <span className="text-lg font-bold text-rose-700 mt-0.5 block">{kpi.outOfStockCount}</span>
            <span className="text-[10px] text-rose-600">Sıfır adet kalanlar</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'inventory'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stok Kartları & Envanter ({stockItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('movements')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'movements'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Stok Hareketleri ({stockMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('warehouses')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'warehouses'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <WarehouseIcon className="w-3.5 h-3.5" />
            <span>Depo & Lokasyonlar ({warehouses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('marketplace_sync')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'marketplace_sync'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Pazaryeri Stok Eşleme</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: INVENTORY & STOCK CARDS
          ===================================================================== */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SKU, Barkod, Ürün Adı veya Marka ara..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
              </div>

              {/* Warehouse filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 shrink-0">Depo:</span>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white"
                >
                  <option value="ALL">Tüm Depolar ({warehouses.length})</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 shrink-0">Kategori:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white"
                >
                  <option value="ALL">Tüm Kategoriler</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 shrink-0">Durum:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white"
                >
                  <option value="ALL">Tüm Seviyeler</option>
                  <option value="CRITICAL">⚠️ Kritik Stok ({kpi.criticalCount})</option>
                  <option value="OUT_OF_STOCK">⛔ Tükendi ({kpi.outOfStockCount})</option>
                  <option value="IN_STOCK">✅ Yeterli Stok</option>
                </select>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-500">
              Gösterilen: <strong>{filteredItems.length}</strong> / {stockItems.length} Stok Kartı
            </div>
          </div>

          {/* Stock Items Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Stok Kodu & Barkod</th>
                    <th className="py-3 px-4">Ürün Adı & Kategori</th>
                    <th className="py-3 px-3">Depo Lokasyonu</th>
                    <th className="py-3 px-3 text-right">Mevcut Stok</th>
                    <th className="py-3 px-3 text-right">Rezerve / Net</th>
                    <th className="py-3 px-3 text-right">Alış Fiyatı</th>
                    <th className="py-3 px-3 text-right">Satış Fiyatı</th>
                    <th className="py-3 px-3 text-center">Pazaryerleri</th>
                    <th className="py-3 px-3">Stok Durumu</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-slate-500">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Boxes className="w-6 h-6" />
                        </div>
                        {stockItems.length === 0 ? (
                          <>
                            <p className="font-bold text-slate-800 text-sm">Stok Listesi Boş</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                              Şu anda kayıtlı herhangi bir stok kartı bulunmuyor. Yeni bir stok kartı ekleyerek envanterinizi yönetmeye başlayabilirsiniz.
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowAddModal(true)}
                              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Yeni Stok Kartı Ekle</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-700">Aramanıza uygun stok kartı bulunamadı.</p>
                            <p className="text-xs text-slate-400 mt-1">Filtreleri temizleyebilir veya yeni ürün ekleyebilirsiniz.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const netStock = Math.max(0, item.currentStock - item.reservedStock);
                      const isOutOfStock = item.currentStock === 0;
                      const isCritical = !isOutOfStock && item.currentStock <= item.criticalThreshold;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.sku}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedItemForBarcode(item)}
                                title="Barkod Görseli & Etiket"
                                className="text-slate-400 hover:text-blue-600 cursor-pointer"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {item.barcode}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{item.category}</span>
                              {item.brand && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-600 font-medium">{item.brand}</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-slate-800">
                              <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{item.warehouseName}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {item.currentStock.toLocaleString('tr-TR')}
                            </span>{' '}
                            <span className="text-slate-400 text-[11px]">{item.unit}</span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-[11px]">
                            {item.reservedStock > 0 ? (
                              <div>
                                <span className="text-amber-700 font-semibold">{item.reservedStock} rez.</span>
                                <span className="text-slate-400"> / </span>
                                <span className="text-emerald-700 font-bold">{netStock} net</span>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-semibold">{netStock} net</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {item.purchasePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                            {item.salePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span
                                title="Trendyol Senkronize"
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                  item.marketplaceSync.trendyol ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                TY
                              </span>
                              <span
                                title="Hepsiburada Senkronize"
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                  item.marketplaceSync.hepsiburada ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                HB
                              </span>
                              <span
                                title="Amazon TR Senkronize"
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                  item.marketplaceSync.amazon ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                AMZ
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                ⛔ Tükendi (0)
                              </span>
                            ) : isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                ⚠️ Kritik ({item.currentStock} &le; {item.criticalThreshold})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Yeterli
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemForMovement(item);
                                  setMovType('PURCHASE_IN');
                                  setShowMovementModal(true);
                                }}
                                title="Stok Hareketi Ekle (Giriş/Çıkış)"
                                className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                              >
                                Hareket
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                title="Kartı Düzenle"
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteStockItem(item.id)}
                                title="Stok Kartını Sil"
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: STOCK MOVEMENTS (GİRİŞ / ÇIKIŞ HAREKETLERİ)
          ===================================================================== */}
      {activeSubTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Stok Hareket Geçmişi</h2>
              <p className="text-xs text-slate-500">
                Pazaryeri faturalandırma çıkışları, tedarikçi gelen e-fatura girişleri, iadeler ve depo sayımları.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedItemForMovement(stockItems[0] || null);
                setShowMovementModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manuel Stok Hareketi İşle</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Tarih & Saat</th>
                    <th className="py-3 px-4">Stok Kodu / Ürün Adı</th>
                    <th className="py-3 px-3">İşlem Türü</th>
                    <th className="py-3 px-3 text-center">Yön</th>
                    <th className="py-3 px-3 text-right">Miktar</th>
                    <th className="py-3 px-3 text-right">Önce / Sonra</th>
                    <th className="py-3 px-3">Belge & Kanal</th>
                    <th className="py-3 px-3">Açıklama</th>
                    <th className="py-3 px-4">İşlemi Yapan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {stockMovements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        Henüz stok hareketi bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    stockMovements.map((mov) => {
                      const isEntry = mov.direction === 'IN';
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {mov.timestamp}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{mov.sku}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-xs">{mov.productName}</span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 text-slate-800">
                              {mov.type === 'PURCHASE_IN' && 'Satın Alma Girişi'}
                              {mov.type === 'SALES_OUT' && 'Pazaryeri Satış Çıkışı'}
                              {mov.type === 'EINVOICE_IN' && 'Gelen e-Fatura Girişi'}
                              {mov.type === 'RETURN_IN' && 'Müşteri İadesi'}
                              {mov.type === 'TRANSFER' && 'Depo Transferi'}
                              {mov.type === 'ADJUSTMENT' && 'Sayım Düzeltmesi'}
                              {mov.type === 'WASTE_OUT' && 'Fire / Zayi Çıkış'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isEntry ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                <ArrowDownLeft className="w-3 h-3" /> GİRİŞ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                                <ArrowUpRight className="w-3 h-3" /> ÇIKIŞ
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                            <span className={isEntry ? 'text-emerald-700' : 'text-rose-700'}>
                              {isEntry ? `+${mov.quantity}` : `-${mov.quantity}`}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-slate-600 text-[11px]">
                            {mov.previousStock} &rarr; <strong className="text-slate-900">{mov.newStock}</strong>
                          </td>

                          <td className="py-3 px-3 text-xs">
                            <div className="font-mono text-slate-900">{mov.documentNumber || '-'}</div>
                            <div className="text-[11px] text-slate-500">{mov.sourceChannel || '-'}</div>
                          </td>

                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={mov.notes}>
                            {mov.notes || '-'}
                          </td>

                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {mov.actorName}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: WAREHOUSES & LOCATIONS
          ===================================================================== */}
      {activeSubTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Depo & Sevkiyat Merkezleri</h2>
              <p className="text-xs text-slate-500">
                Merkez ofis depoları, 3PL e-ticaret lojistik üsleri ve pazaryeri FBA fulfilment lokasyonları.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWarehouseModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Depo Tanımla</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((wh) => {
              const whItems = stockItems.filter((i) => i.warehouseId === wh.id);
              const totalWhStock = whItems.reduce((acc, i) => acc + i.currentStock, 0);
              const totalWhVal = whItems.reduce((acc, i) => acc + i.currentStock * i.purchasePrice, 0);

              return (
                <div key={wh.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="w-4 h-4 text-blue-600" />
                        <h3 className="font-bold text-slate-900 text-sm">{wh.name}</h3>
                      </div>
                      <span className="font-mono text-xs text-slate-400 mt-0.5 block">{wh.code}</span>
                    </div>
                    {wh.isDefault && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Ana Depo
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-medium text-slate-800">{wh.district} / {wh.city}</p>
                    <p className="text-[11px] text-slate-500">{wh.address}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Kayıtlı Ürün</span>
                      <span className="font-bold text-slate-900 text-sm">{whItems.length} Kalem</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Fiziksel Stok</span>
                      <span className="font-bold text-blue-700 text-sm">{totalWhStock.toLocaleString('tr-TR')} Adet</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Envanter Değeri: <strong>{totalWhVal.toLocaleString('tr-TR')} ₺</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: MARKETPLACE STOCK SYNC
          ===================================================================== */}
      {activeSubTab === 'marketplace_sync' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-600" />
                  <span>Pazaryeri Otomatik Stok Eşitleme Merkezi</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Sipariş faturası kesildiğinde depodaki stok anında düşer ve tüm bağlı pazaryeri mağazalarına güncel stok miktarı iletilir.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Eşitleme Yapılıyor...' : 'Tüm Kanalları Şimdi Eşitle'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
              <div className="p-4 border border-orange-200 bg-orange-50/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-950 text-sm">Trendyol Mağazası</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-xs text-orange-800">Anadolu Dijital Resmi Mağaza</p>
                <p className="text-[11px] text-slate-500">Stok Güncelleme: <strong>Otomatik (Webhook)</strong></p>
                <div className="text-[11px] font-mono text-emerald-700 font-semibold">✓ Son Senkronizasyon: 5 dk önce</div>
              </div>

              <div className="p-4 border border-amber-200 bg-amber-50/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-sm">Hepsiburada Mağazası</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-xs text-amber-800">AnadoluTech HB Mağazası</p>
                <p className="text-[11px] text-slate-500">Stok Güncelleme: <strong>Otomatik (API)</strong></p>
                <div className="text-[11px] font-mono text-emerald-700 font-semibold">✓ Son Senkronizasyon: 10 dk önce</div>
              </div>

              <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 text-sm">Amazon.com.tr</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-xs text-blue-800">Anadolu Prime Store TR</p>
                <p className="text-[11px] text-slate-500">Stok Güncelleme: <strong>FBA / MFN Entegre</strong></p>
                <div className="text-[11px] font-mono text-emerald-700 font-semibold">✓ Son Senkronizasyon: 15 dk önce</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ADD NEW STOCK CARD
          ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <PackagePlus className="w-4 h-4 text-blue-600" />
                <span>Yeni Stok Kartı Tanımla</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddNewItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stok Kodu (SKU) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    placeholder="Örn: SSD-SAM-4TB"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    EAN-13 / Barkod
                  </label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    placeholder="868019482..."
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ürün Adı / Ticari Başlık *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Örn: Samsung 990 PRO 4TB NVMe SSD"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Bilgisayar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Marka
                  </label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Samsung"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Birim
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value="Adet">Adet</option>
                    <option value="Takım">Takım</option>
                    <option value="Koli">Koli</option>
                    <option value="Kutu">Kutu</option>
                    <option value="Paket">Paket</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    KDV Oranı
                  </label>
                  <select
                    value={newVatRate}
                    onChange={(e) => setNewVatRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value={20}>%20 Standart</option>
                    <option value={10}>%10 İndirimli</option>
                    <option value={1}>%1 Temel</option>
                    <option value={0}>%0 Muaf</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alış Fiyatı (TL)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satış Fiyatı (TL)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Açılış Stok Adedi
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kritik Stok Uyarısı
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCritical}
                    onChange={(e) => setNewCritical(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hedef Depo
                  </label>
                  <select
                    value={newWarehouseId}
                    onChange={(e) => setNewWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Stok Kartını Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: MANUAL MOVEMENT (GİRİŞ / ÇIKIŞ)
          ===================================================================== */}
      {showMovementModal && selectedItemForMovement && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                <span>Manuel Stok Hareketi İşle</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <span className="font-mono font-bold text-slate-900">{selectedItemForMovement.sku}</span>
              <p className="text-slate-600 font-medium">{selectedItemForMovement.name}</p>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>Mevcut Stok: <strong>{selectedItemForMovement.currentStock} {selectedItemForMovement.unit}</strong></span>
                <span>· Depo: {selectedItemForMovement.warehouseName}</span>
              </div>
            </div>

            <form onSubmit={handleMovementSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hareket Türü *
                </label>
                <select
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as StockMovementType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-semibold"
                >
                  <option value="PURCHASE_IN">+ Satın Alma Girişi (Tedarik)</option>
                  <option value="EINVOICE_IN">+ Gelen e-Fatura / İrsaliye Girişi</option>
                  <option value="RETURN_IN">+ Müşteri İade Girişi</option>
                  <option value="SALES_OUT">- Satış Çıkışı (Sipariş/Fatura)</option>
                  <option value="TRANSFER">- Depolar Arası Sevk Çıkışı</option>
                  <option value="ADJUSTMENT">~ Depo Sayım Düzeltmesi</option>
                  <option value="WASTE_OUT">- Fire / Hasarlı Ürün Çıkışı</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    İşlem Miktarı ({selectedItemForMovement.unit}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={movQty}
                    onChange={(e) => setMovQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 font-mono text-base font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Belge / Fatura / İrsaliye No
                  </label>
                  <input
                    type="text"
                    value={movDocNo}
                    onChange={(e) => setMovDocNo(e.target.value)}
                    placeholder="Örn: IRS20260000012"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kanal / Tedarikçi / Cari
                </label>
                <input
                  type="text"
                  value={movChannel}
                  onChange={(e) => setMovChannel(e.target.value)}
                  placeholder="Örn: Merkez Depo Sayımı / Boğaziçi Bilişim"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Açıklama / Not
                </label>
                <textarea
                  rows={2}
                  value={movNotes}
                  onChange={(e) => setMovNotes(e.target.value)}
                  placeholder="Hareket sebebi, irsaliye detayları..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Hareketi Onayla & Stok Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: BARCODE PREVIEW
          ===================================================================== */}
      {selectedItemForBarcode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-900 text-sm">Ürün Barkod Etiketi</span>
              <button
                type="button"
                onClick={() => setSelectedItemForBarcode(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white border border-slate-300 rounded-xl space-y-2 shadow-xs">
              <span className="font-bold text-slate-900 text-xs block">{selectedItemForBarcode.name}</span>
              <span className="font-mono text-slate-500 text-[11px] block">{selectedItemForBarcode.sku}</span>

              {/* Simulated EAN-13 Barcode Lines */}
              <div className="py-2 flex justify-center items-center gap-[2px] h-14 bg-slate-50 rounded">
                {[...Array(38)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-full ${
                      i % 3 === 0 ? 'w-1 bg-black' : i % 2 === 0 ? 'w-[1.5px] bg-black' : 'w-[2.5px] bg-black'
                    }`}
                  />
                ))}
              </div>

              <span className="font-mono text-sm font-bold tracking-widest text-slate-900 block">
                {selectedItemForBarcode.barcode}
              </span>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Satış Fiyatı:</span>
                <span className="text-slate-900 font-mono text-sm">{selectedItemForBarcode.salePrice.toLocaleString('tr-TR')} ₺</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemForBarcode(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: ADD WAREHOUSE
          ===================================================================== */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-900 text-sm">Yeni Depo / Sevkiyat Lokasyonu Ekle</span>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddWarehouseSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Depo Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="Örn: Ankara Bölge Deposu"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Depo Kodu *
                  </label>
                  <input
                    type="text"
                    required
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    placeholder="DEP-03"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    İl / Şehir *
                  </label>
                  <input
                    type="text"
                    required
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    placeholder="İstanbul"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    İlçe
                  </label>
                  <input
                    type="text"
                    value={whDistrict}
                    onChange={(e) => setWhDistrict(e.target.value)}
                    placeholder="Yenimahalle"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Açık Adres
                </label>
                <textarea
                  rows={2}
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  placeholder="OSB Lojistik Merkezi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Depoyu Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: EDIT STOCK ITEM
          ===================================================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-900 text-sm">Stok Kartını Düzenle</span>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateStockItem(editingItem);
                setEditingItem(null);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={editingItem.sku}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barkod</label>
                  <input
                    type="text"
                    value={editingItem.barcode}
                    onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ürün Adı</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alış Fiyatı (TL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.purchasePrice}
                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satış Fiyatı (TL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.salePrice}
                    onChange={(e) => setEditingItem({ ...editingItem, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mevcut Stok</label>
                  <input
                    type="number"
                    value={editingItem.currentStock}
                    onChange={(e) => setEditingItem({ ...editingItem, currentStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kritik Eşik</label>
                  <input
                    type="number"
                    value={editingItem.criticalThreshold}
                    onChange={(e) => setEditingItem({ ...editingItem, criticalThreshold: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Depo</label>
                  <select
                    value={editingItem.warehouseId}
                    onChange={(e) => {
                      const wh = warehouses.find((w) => w.id === e.target.value);
                      setEditingItem({
                        ...editingItem,
                        warehouseId: e.target.value,
                        warehouseName: wh ? wh.name : editingItem.warehouseName,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
