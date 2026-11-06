import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  FileCheck2,
  AlertTriangle,
  Clock,
  Eye,
  Plus,
  Wrench,
  Check,
  X,
  Zap,
  Save,
  Filter,
  FileSpreadsheet,
  FileText,
  Mail,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { PascalHeroBanner, PascalKpiCard } from './PascalUi';
import {
  CustomerType,
  MarketplaceId,
  MarketplaceOrder,
  OrderInvoiceStatus,
  VatRate,
} from '../types/invoicing';
import {
  calculateOrderTotals,
  formatTryCurrency,
  validateTurkishTaxIdentifier,
} from '../utils/invoicingEngine';

interface OrdersQueueViewProps {
  orders: MarketplaceOrder[];
  selectedOrderIds: string[];
  onToggleSelectOrder: (orderId: string) => void;
  onSelectAllFiltered: (orderIds: string[]) => void;
  onIssueSingleInvoice: (orderId: string, allowDefaultTckn?: boolean) => void;
  onIssueSelectedInvoices: () => void;
  onBatchInvoiceAction?: () => void;
  onFixOrderTaxId: (
    orderId: string,
    newTaxId: string,
    customerType: CustomerType,
    issueImmediately: boolean
  ) => { success: boolean; error?: string };
  onPreviewInvoice: (order: MarketplaceOrder) => void;
  onCreateManualOrder: (newOrder: MarketplaceOrder) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const MARKETPLACE_LABELS: Record<MarketplaceId, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  amazon: 'Amazon.com.tr',
  n11: 'N11',
  pazarama: 'Pazarama',
  ciceksepeti: 'Çiçeksepeti',
  idefix: 'İdefix',
  pttavm: 'PttAVM',
};

const STAGE_LABELS: Record<MarketplaceOrder['fulfillmentStage'], string> = {
  SIPARIS_ONAYLANDI: 'Sipariş Onaylandı',
  HAZIRLANIYOR: 'Hazırlanıyor',
  KARGOYA_VERILDI: 'Kargoya Verildi',
  TESLIM_EDILDI: 'Teslim Edildi',
};

export const OrdersQueueView: React.FC<OrdersQueueViewProps> = ({
  orders,
  selectedOrderIds,
  onToggleSelectOrder,
  onSelectAllFiltered,
  onIssueSingleInvoice,
  onIssueSelectedInvoices,
  onBatchInvoiceAction,
  onFixOrderTaxId,
  onPreviewInvoice,
  onCreateManualOrder,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderInvoiceStatus>('ALL');
  const [marketplaceFilter, setMarketplaceFilter] = useState<'ALL' | MarketplaceId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // State for fixing VKN/TCKN inline modal
  const [editingOrder, setEditingOrder] = useState<MarketplaceOrder | null>(null);
  const [repairTaxId, setRepairTaxId] = useState('');
  const [repairCustomerType, setRepairCustomerType] = useState<CustomerType>('INDIVIDUAL');
  const [repairError, setRepairError] = useState<string | null>(null);

  // State for creating a new test/manual marketplace order
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newMp, setNewMp] = useState<MarketplaceId>('trendyol');
  const [newOrderNo, setNewOrderNo] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<CustomerType>('INDIVIDUAL');
  const [newTaxId, setNewTaxId] = useState('');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductSku, setNewProductSku] = useState('URN-2026-X1');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newVatRate, setNewVatRate] = useState<VatRate>(20);
  const [newShippingFee, setNewShippingFee] = useState('59.90');
  const [newIncludeShipping, setNewIncludeShipping] = useState(true);
  const [newOrderNote, setNewOrderNote] = useState('');
  const [newOrderFormError, setNewOrderFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingOrder && !showNewOrderModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingOrder(null);
        setShowNewOrderModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingOrder, showNewOrderModal]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.invoiceStatus !== statusFilter) {
        return false;
      }
      if (marketplaceFilter !== 'ALL' && order.marketplace !== marketplaceFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOrderNo = order.marketplaceOrderNumber.toLowerCase().includes(q);
        const matchCustomer = order.customerName.toLowerCase().includes(q);
        const matchTaxId = order.taxIdentifier.toLowerCase().includes(q);
        const matchGib = (order.gibInvoiceNumber ?? '').toLowerCase().includes(q);
        const matchItem = order.items.some(
          (i) => i.title.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
        );
        return matchOrderNo || matchCustomer || matchTaxId || matchGib || matchItem;
      }
      return true;
    });
  }, [orders, statusFilter, marketplaceFilter, searchQuery]);

  const summaryMetrics = useMemo(() => {
    let pendingCount = 0;
    let invoicedCount = 0;
    let errorCount = 0;
    let totalGross = 0;
    let totalVat = 0;

    for (const o of orders) {
      if (o.invoiceStatus === 'PENDING') pendingCount++;
      else if (o.invoiceStatus === 'INVOICED') invoicedCount++;
      else if (o.invoiceStatus === 'ERROR_TAX_ID') errorCount++;

      const fin = calculateOrderTotals(
        o.items,
        o.shippingFeeVatIncluded,
        o.includeShippingInInvoice,
        o.sellerDiscountTotal,
        o.marketplaceCommissionRate,
        o.withholdingRate
      );
      totalGross += fin.grossInvoiceTotal;
      totalVat += fin.totalVat;
    }

    return {
      pendingCount,
      invoicedCount,
      errorCount,
      totalGross,
      totalVat,
    };
  }, [orders]);

  const openRepairModal = (order: MarketplaceOrder) => {
    setEditingOrder(order);
    setRepairTaxId(order.taxIdentifier || '');
    setRepairCustomerType(order.customerType);
    setRepairError(null);
  };

  const handleSaveRepair = (issueNow: boolean) => {
    if (!editingOrder) return;
    const res = onFixOrderTaxId(
      editingOrder.id,
      repairTaxId,
      repairCustomerType,
      issueNow
    );
    if (!res.success) {
      setRepairError(res.error ?? 'Geçersiz vergi/TC kimlik numarası.');
      return;
    }
    setEditingOrder(null);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewOrderFormError(null);

    const cleanOrderNo = newOrderNo.trim();
    const cleanCustomer = newCustomerName.trim();
    const cleanTitle = newProductTitle.trim();
    const parsedPrice = Number(newUnitPrice);
    const parsedQty = Math.max(1, parseInt(newQuantity, 10) || 1);
    const parsedShipping = Math.max(0, Number(newShippingFee) || 0);

    if (!cleanOrderNo) {
      setNewOrderFormError('Pazaryeri sipariş numarası zorunludur.');
      return;
    }
    if (!cleanCustomer) {
      setNewOrderFormError('Alıcı adı / unvanı zorunludur.');
      return;
    }
    if (!cleanTitle) {
      setNewOrderFormError('Ürün / hizmet açıklaması zorunludur.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setNewOrderFormError('KDV dahil birim fiyat 0 TL üzerinde olmalıdır.');
      return;
    }

    const taxValidation = validateTurkishTaxIdentifier(
      newTaxId,
      newCustomerType,
      true
    );

    const created: MarketplaceOrder = {
      id: `ord-${Date.now()}`,
      marketplaceOrderNumber: cleanOrderNo,
      marketplace: newMp,
      storeName: `${MARKETPLACE_LABELS[newMp]} Resmi Mağaza`,
      orderDate: '2026-11-04 16:30',
      fulfillmentStage: 'KARGOYA_VERILDI',
      customerName: cleanCustomer,
      customerType: newCustomerType,
      taxIdentifier: taxValidation.valid ? taxValidation.normalizedId : newTaxId.trim(),
      taxOffice: newCustomerType === 'CORPORATE' ? 'Merkez V.D.' : undefined,
      city: 'İstanbul',
      district: 'Şişli',
      address: 'Büyükdere Cad. No: 128',
      email: 'musteri@ornekmail.com',
      isEFaturaRegistered: newCustomerType === 'CORPORATE',
      items: [
        {
          id: `li-${Date.now()}`,
          sku: newProductSku.trim() || 'SKU-GEN-01',
          title: cleanTitle,
          quantity: parsedQty,
          unitPriceVatIncluded: parsedPrice,
          vatRate: newVatRate,
        },
      ],
      shippingFeeVatIncluded: parsedShipping,
      includeShippingInInvoice: newIncludeShipping,
      sellerDiscountTotal: 0,
      marketplaceCommissionRate: 15,
      withholdingRate: 1,
      invoiceStatus: taxValidation.valid ? 'PENDING' : 'ERROR_TAX_ID',
      invoiceErrorReason: taxValidation.valid ? undefined : taxValidation.error,
      cargoTrackingCode: `KRG-${Math.floor(10000000 + Math.random() * 89999999)}`,
      cargoCarrier: 'Yurtiçi Kargo',
      orderNote: newOrderNote.trim() || undefined,
    };

    onCreateManualOrder(created);
    setShowNewOrderModal(false);
    setNewOrderNo('');
    setNewCustomerName('');
    setNewTaxId('');
    setNewProductTitle('');
    setNewUnitPrice('');
    setNewOrderNote('');
  };

  const allFilteredIds = filteredOrders.map((o) => o.id);
  const allFilteredSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedOrderIds.includes(id));

  const handleExportOrdersCsv = () => {
    const headers = [
      'Sipariş No',
      'Pazaryeri',
      'Tarih',
      'Alıcı Unvanı',
      'VKN/TCKN',
      'Durum',
      'GİB Fatura No',
    ];
    const rows = filteredOrders.map((o) => [
      o.marketplaceOrderNumber,
      MARKETPLACE_LABELS[o.marketplace],
      o.orderDate,
      `"${o.customerName}"`,
      o.taxIdentifier,
      o.invoiceStatus,
      o.gibInvoiceNumber || '-',
    ]);
    const csv =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Siparis_Fatura_Kuyrugu_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Top Hero Banner with 3D Isometric Cube & Action Pills */}
      <PascalHeroBanner
        kicker="PAZARYERİ & E-BELGE KUYRUĞU"
        title="Sipariş & Fatura Kartları"
        subtitle="Pazaryeri siparişleri, GİB UBL-TR 2.1 otomatik faturalandırma, bakiye ve VKN/TCKN risk takibi."
        onExportExcel={handleExportOrdersCsv}
        excelLabel="Excel İndir"
        onExportPdf={() => {
          if (filteredOrders[0]) onPreviewInvoice(filteredOrders[0]);
        }}
        pdfLabel="PDF İndir"
        onEmailAction={onBatchInvoiceAction}
        emailLabel={
          summaryMetrics.pendingCount > 0
            ? `Toplu Kes (${summaryMetrics.pendingCount})`
            : 'Kuralları Çalıştır'
        }
        onSaveAction={
          onSaveAllModules
            ? () => onSaveAllModules('Sipariş Kuyruğu Modülü')
            : undefined
        }
        saveLabel={hasUnsavedChanges ? 'Değişiklikleri Kaydet' : 'Kaydet'}
        hasUnsavedChanges={hasUnsavedChanges}
        onPrimaryAction={() => setShowNewOrderModal(true)}
        primaryLabel="Yeni Sipariş"
        extraActions={
          selectedOrderIds.length > 0 ? (
            <button
              type="button"
              onClick={onIssueSelectedInvoices}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0077CC] hover:bg-[#0B5FA5] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Seçilenleri Kes ({selectedOrderIds.length})</span>
            </button>
          ) : undefined
        }
      />

      {/* 4-Column Diamond Lattice KPI Cards matching Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PascalKpiCard
          title="Toplam brüt fatura hacmi"
          value={formatTryCurrency(summaryMetrics.totalGross)}
          pillText={`${summaryMetrics.invoicedCount} fatura`}
          subtitle="resmileşen GİB e-belge"
          tone="emerald"
          testId="metric-invoiced-count"
          icon={<Wallet className="w-5 h-5" />}
        />

        <PascalKpiCard
          title="Hesaplanan KDV tutarı"
          value={formatTryCurrency(summaryMetrics.totalVat)}
          pillText={`${orders.length} sipariş`}
          subtitle="KDV tahakkuk toplamı"
          tone="rose"
          icon={<FileText className="w-5 h-5" />}
        />

        <PascalKpiCard
          title="Fatura bekleyen sipariş"
          value={`${summaryMetrics.pendingCount} sipariş`}
          pillText={`${summaryMetrics.pendingCount} bekleyen`}
          subtitle="kargo onayı alınmış hazır"
          tone="amber"
          testId="metric-pending-count"
          icon={<Clock className="w-5 h-5" />}
        />

        <PascalKpiCard
          title="Risk / VKN doğrulama uyarısı"
          value={`${summaryMetrics.errorCount} cari`}
          pillText="Risk takibi"
          subtitle="yakın takip listesinde"
          tone="sky"
          testId="metric-error-count"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Filter & Action Toolbar Card matching Screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[210px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="order-search-input" className="sr-only">
              Unvan, kod, VKN, sipariş ara
            </label>
            <input
              id="order-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Unvan, kod, VKN, sipariş..."
              className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-[#0077CC] placeholder-slate-400"
            />
          </div>

          {/* Marketplace Dropdown */}
          <label htmlFor="mp-filter-select" className="sr-only">
            Pazaryeri Seçin
          </label>
          <select
            id="mp-filter-select"
            value={marketplaceFilter}
            onChange={(e) =>
              setMarketplaceFilter(e.target.value as 'ALL' | MarketplaceId)
            }
            className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-2 focus:outline-[#0077CC]"
          >
            <option value="ALL">Tüm pazaryerleri</option>
            <option value="trendyol">Trendyol</option>
            <option value="hepsiburada">Hepsiburada</option>
            <option value="amazon">Amazon.com.tr</option>
            <option value="n11">N11</option>
            <option value="pazarama">Pazarama</option>
            <option value="ciceksepeti">Çiçeksepeti</option>
          </select>

          {/* Status Dropdown */}
          <select
            aria-label="Tüm durumlar"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | OrderInvoiceStatus)
            }
            className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-2 focus:outline-[#0077CC]"
          >
            <option value="ALL">Tüm durumlar ({orders.length})</option>
            <option value="PENDING">
              Fatura Bekleyen ({summaryMetrics.pendingCount})
            </option>
            <option value="INVOICED">
              Kesilen e-Belgeler ({summaryMetrics.invoicedCount})
            </option>
            <option value="ERROR_TAX_ID">
              VKN/TCKN Hatalı ({summaryMetrics.errorCount})
            </option>
          </select>

          {/* Toggle Switch (matching 'Sadece borçlular' in screenshot) */}
          <button
            type="button"
            onClick={() =>
              setStatusFilter((prev) =>
                prev === 'ERROR_TAX_ID' ? 'ALL' : 'ERROR_TAX_ID'
              )
            }
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <span className="leading-tight text-left">
              Sadece VKN hatalılar
            </span>
            <span
              className={`w-8 h-4.5 rounded-full transition-colors flex items-center px-0.5 ${
                statusFilter === 'ERROR_TAX_ID'
                  ? 'bg-[#0077CC] justify-end'
                  : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
            </span>
          </button>
        </div>

        {/* Right Toolbar Pills matching Screenshot */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setMarketplaceFilter('ALL');
              setSearchQuery('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-[#0077CC]" />
            <span>Sütun Filtreleri</span>
          </button>

          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel İndir</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (filteredOrders[0]) onPreviewInvoice(filteredOrders[0]);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF İndir</span>
          </button>

          <button
            type="button"
            onClick={onBatchInvoiceAction}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-600" />
            <span>E-Posta</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>Kolon</span>
          </button>
        </div>
      </div>

      {/* High-Density Tabular Order Ledger with Dual Header Row */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Seçili filtre kriterlerine uygun sipariş bulunamadı
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Arama sorgusunu temizleyebilir, farklı bir pazaryeri filtresi seçebilir veya yeni bir sipariş ekleyebilirsiniz.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setMarketplaceFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold text-[#0B5FA5] bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer"
            >
              Filtreleri Sıfırla
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {/* Row 1: Uppercase Bold Column Headers */}
                <tr className="border-b border-slate-200/80 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  <th className="py-3.5 pl-4 pr-2 w-9">
                    <input
                      type="checkbox"
                      aria-label="Listedeki tüm siparişleri seç"
                      checked={allFilteredSelected}
                      onChange={() => onSelectAllFiltered(allFilteredIds)}
                      className="rounded border-slate-300 bg-white text-[#0077CC] focus:ring-[#0077CC] cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3">SİPARİŞ & PAZARYERİ</th>
                  <th className="py-3.5 px-3">CARİ / ALICI & VKN</th>
                  <th className="py-3.5 px-3">KALEMLER & LOJİSTİK</th>
                  <th className="py-3.5 px-3 text-right">MATRAH & KDV</th>
                  <th className="py-3.5 px-3 text-right">BAKİYE / TUTAR</th>
                  <th className="py-3.5 px-3">E-BELGE DURUMU</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">İŞLEMLER</th>
                </tr>
                {/* Row 2: Inline Column Filter Inputs (Matching Screenshot) */}
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs">
                  <th className="py-2 pl-4 pr-2" />
                  <th className="py-2 px-3">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Sipariş / No ara..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg placeholder-slate-400 font-normal"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-3">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari / Kod / VKN ara..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg placeholder-slate-400 font-normal"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-3">
                    <select
                      aria-label="Pazaryeri Sütun Filtresi"
                      value={marketplaceFilter}
                      onChange={(e) =>
                        setMarketplaceFilter(
                          e.target.value as 'ALL' | MarketplaceId
                        )
                      }
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg font-normal"
                    >
                      <option value="ALL">Tümü</option>
                      <option value="trendyol">Trendyol</option>
                      <option value="hepsiburada">Hepsiburada</option>
                      <option value="amazon">Amazon</option>
                      <option value="n11">N11</option>
                    </select>
                  </th>
                  <th className="py-2 px-3">
                    <div className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-400 font-normal text-right">
                      KDV %1-%20
                    </div>
                  </th>
                  <th className="py-2 px-3">
                    <div className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-400 font-normal text-right">
                      Bakiye tutar
                    </div>
                  </th>
                  <th className="py-2 px-3">
                    <select
                      aria-label="Durum Sütun Filtresi"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as 'ALL' | OrderInvoiceStatus
                        )
                      }
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg font-normal"
                    >
                      <option value="ALL">Tümü</option>
                      <option value="PENDING">Bekleyen</option>
                      <option value="INVOICED">Kesilen</option>
                      <option value="ERROR_TAX_ID">VKN Hatalı</option>
                    </select>
                  </th>
                  <th className="py-2 pl-3 pr-4 text-right">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Filtrele
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredOrders.map((order) => {
                  const fin = calculateOrderTotals(
                    order.items,
                    order.shippingFeeVatIncluded,
                    order.includeShippingInInvoice,
                    order.sellerDiscountTotal,
                    order.marketplaceCommissionRate,
                    order.withholdingRate
                  );
                  const isSelected = selectedOrderIds.includes(order.id);
                  const docLabel =
                    order.customerType === 'CORPORATE' && order.isEFaturaRegistered
                      ? 'e-Fatura (Ticari)'
                      : 'e-Arşiv Fatura';

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-[#F0F6FF] border-l-2 border-[#248BD6]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Sipariş seç #${order.marketplaceOrderNumber}`}
                          checked={isSelected}
                          onChange={() => onToggleSelectOrder(order.id)}
                          className="rounded border-slate-300 bg-white text-[#248BD6] focus:ring-[#248BD6] cursor-pointer mt-0.5"
                        />
                      </td>

                      {/* Order & Marketplace (Unboxed metadata with · separator) */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono font-semibold text-slate-900">
                          #{order.marketplaceOrderNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-[#0F6BAE]">
                            {MARKETPLACE_LABELS[order.marketplace]}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-mono text-slate-500">{order.orderDate}</span>
                        </div>
                      </td>

                      {/* Customer & Tax ID */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-medium text-slate-900">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>
                            {order.customerType === 'CORPORATE'
                              ? 'Kurumsal Mükellef'
                              : 'Bireysel Alıcı'}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-mono text-[#0F6BAE] font-medium">
                            {order.customerType === 'CORPORATE' ? 'VKN: ' : 'TCKN: '}
                            {order.taxIdentifier || 'Eksik'}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-slate-600 font-medium">{docLabel}</span>
                        </div>
                        {order.orderNote && (
                          <div
                            className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1.5 flex items-start gap-1"
                            title={`Pazaryeri Sipariş Notu: ${order.orderNote}`}
                          >
                            <span className="font-semibold shrink-0 text-amber-700">Not:</span>
                            <span className="truncate">{order.orderNote}</span>
                          </div>
                        )}
                      </td>

                      {/* Items & Fulfillment */}
                      <td className="py-3 px-2.5 align-top max-w-[210px]">
                        <div className="text-slate-800 truncate" title={order.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')}>
                          {order.items.map((i) => `${i.quantity}x ${i.title}`).join(' + ')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{STAGE_LABELS[order.fulfillmentStage]}</span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span>{order.cargoCarrier}</span>
                          {order.includeShippingInInvoice &&
                            order.shippingFeeVatIncluded > 0 && (
                              <>
                                <span aria-hidden="true" className="text-slate-400">·</span>
                                <span className="font-mono text-[#0F6BAE] font-medium">
                                  +Kargo ({formatTryCurrency(order.shippingFeeVatIncluded)})
                                </span>
                              </>
                            )}
                        </div>
                      </td>

                      {/* Matrah & KDV */}
                      <td className="py-3 px-2.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800">
                          {formatTryCurrency(fin.subtotalExclVat)}
                        </div>
                        <div className="text-[11px] text-[#0F6BAE] mt-0.5 font-medium">
                          KDV: {formatTryCurrency(fin.totalVat)}
                        </div>
                      </td>

                      {/* Gross Invoice Amount */}
                      <td className="py-3 px-2.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatTryCurrency(fin.grossInvoiceTotal)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Net: {formatTryCurrency(fin.netSellerPayout)}
                        </div>
                      </td>

                      {/* Invoice Status (Semantic Icon + Unboxed Text, No Pill Boxes) */}
                      <td className="py-3 px-2.5 align-top">
                        {order.invoiceStatus === 'INVOICED' && (
                          <div>
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold whitespace-nowrap">
                              <FileCheck2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                              <span>
                                {order.documentType === 'E_FATURA'
                                  ? 'e-Fatura Kesildi'
                                  : 'e-Arşiv Kesildi'}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-[#0F6BAE] mt-0.5 font-semibold">
                              {order.gibInvoiceNumber}
                            </div>
                          </div>
                        )}

                        {order.invoiceStatus === 'PENDING' && (
                          <div>
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 text-[#248BD6] shrink-0" />
                              <span>Fatura Bekliyor</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Otomasyona uygun
                            </div>
                          </div>
                        )}

                        {order.invoiceStatus === 'ERROR_TAX_ID' && (
                          <div>
                            <div className="flex items-center gap-1.5 text-amber-700 font-semibold whitespace-nowrap">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>VKN / TCKN Hatası</span>
                            </div>
                            <div
                              className="text-[11px] text-amber-800 mt-0.5 max-w-[180px] leading-snug"
                              title={order.invoiceErrorReason}
                            >
                              {order.invoiceErrorReason}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 pl-3 pr-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.invoiceStatus === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => onIssueSingleInvoice(order.id, false)}
                              aria-label={`Fatura kes #${order.marketplaceOrderNumber}`}
                              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#248BD6] rounded-md hover:bg-[#0F6BAE] transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                            >
                              Fatura Kes
                            </button>
                          )}

                          {order.invoiceStatus === 'ERROR_TAX_ID' && (
                            <button
                              type="button"
                              onClick={() => openRepairModal(order)}
                              aria-label={`Vergi numarası düzelt #${order.marketplaceOrderNumber}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Wrench className="w-3 h-3 text-amber-600" />
                              VKN/TCKN Düzelt
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onPreviewInvoice(order)}
                            aria-label={`Belge önizle #${order.marketplaceOrderNumber}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#248BD6]" />
                            Önizle
                          </button>
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

      {/* Inline Tax Identifier Repair Modal */}
      {editingOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-slate-900">
              <h2 id="repair-modal-title" className="text-sm font-semibold">
                VKN / TCKN Doğrulama ve Düzeltme (#{editingOrder.marketplaceOrderNumber})
              </h2>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                aria-label="Düzeltme penceresini kapat"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Alıcı Adı / Unvanı</p>
                <p className="font-semibold text-sm text-slate-900 mt-0.5">
                  {editingOrder.customerName}
                </p>
                {editingOrder.orderNote && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
                    <span className="font-semibold text-amber-700">Pazaryeri Sipariş Notu:</span>{' '}
                    <span>{editingOrder.orderNote}</span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="repair-customer-type"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Mükellef Türü
                </label>
                <select
                  id="repair-customer-type"
                  value={repairCustomerType}
                  onChange={(e) => {
                    setRepairCustomerType(e.target.value as CustomerType);
                    setRepairError(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="INDIVIDUAL">Bireysel Alıcı (11 Hane TCKN - e-Arşiv)</option>
                  <option value="CORPORATE">Kurumsal Şirket (10 Hane VKN - e-Fatura)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="repair-tax-id-input"
                    className="font-semibold text-slate-700"
                  >
                    {repairCustomerType === 'CORPORATE'
                      ? 'Vergi Kimlik Numarası (10 Hane VKN)'
                      : 'T.C. Kimlik Numarası (11 Hane TCKN)'}
                  </label>
                  {repairCustomerType === 'INDIVIDUAL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRepairTaxId('11111111111');
                        setRepairError(null);
                      }}
                      className="text-[11px] font-semibold text-[#0F6BAE] hover:underline cursor-pointer"
                    >
                      11111111111 (Nihai Tüketici) Ata
                    </button>
                  )}
                </div>
                <input
                  id="repair-tax-id-input"
                  type="text"
                  value={repairTaxId}
                  onChange={(e) => {
                    setRepairTaxId(e.target.value);
                    setRepairError(null);
                  }}
                  placeholder={
                    repairCustomerType === 'CORPORATE'
                      ? 'Örn: 5982014829'
                      : 'Örn: 11111111111'
                  }
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                />
              </div>

              {repairError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                  {repairError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-3.5 py-2 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRepair(true)}
                  className="flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-[#248BD6] hover:bg-[#0F6BAE] rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Kaydet ve Faturayı Kes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Manual Order Modal */}
      {showNewOrderModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-slate-900">
              <h2 id="new-order-modal-title" className="text-sm font-semibold">
                Yeni Pazaryeri Siparişi Ekle
              </h2>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                aria-label="Yeni sipariş penceresini kapat"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-order-mp"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Pazaryeri
                  </label>
                  <select
                    id="new-order-mp"
                    value={newMp}
                    onChange={(e) => setNewMp(e.target.value as MarketplaceId)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="trendyol">Trendyol</option>
                    <option value="hepsiburada">Hepsiburada</option>
                    <option value="amazon">Amazon.com.tr</option>
                    <option value="n11">N11</option>
                    <option value="pazarama">Pazarama</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="new-order-number"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Sipariş Numarası
                  </label>
                  <input
                    id="new-order-number"
                    type="text"
                    value={newOrderNo}
                    onChange={(e) => setNewOrderNo(e.target.value)}
                    placeholder="Örn: 9482799102"
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-customer-name"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Alıcı Adı Soyadı / Firma Unvanı
                  </label>
                  <input
                    id="new-customer-name"
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Örn: Emre Kaya"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-customer-type"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Mükellef Tipi
                  </label>
                  <select
                    id="new-customer-type"
                    value={newCustomerType}
                    onChange={(e) => setNewCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="INDIVIDUAL">Bireysel (e-Arşiv)</option>
                    <option value="CORPORATE">Kurumsal (e-Fatura)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-tax-id"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  TCKN (11 Hane) veya VKN (10 Hane) — Boş bırakılırsa 11111111111 atanır
                </label>
                <input
                  id="new-tax-id"
                  type="text"
                  value={newTaxId}
                  onChange={(e) => setNewTaxId(e.target.value)}
                  placeholder="Örn: 11111111111"
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="new-product-title"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Ürün / Hizmet Adı
                  </label>
                  <input
                    id="new-product-title"
                    type="text"
                    value={newProductTitle}
                    onChange={(e) => setNewProductTitle(e.target.value)}
                    placeholder="Örn: Philips Espresso Kahve Makinesi"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-product-sku"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Stok Kodu (SKU)
                  </label>
                  <input
                    id="new-product-sku"
                    type="text"
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="new-unit-price"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Birim Fiyat (KDV Dahil TL)
                  </label>
                  <input
                    id="new-unit-price"
                    type="number"
                    step="0.01"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(e.target.value)}
                    placeholder="1850.00"
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-quantity"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Miktar (Adet)
                  </label>
                  <input
                    id="new-quantity"
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-vat-rate"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    KDV Oranı
                  </label>
                  <select
                    id="new-vat-rate"
                    value={newVatRate}
                    onChange={(e) => setNewVatRate(Number(e.target.value) as VatRate)}
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value={20}>%20 (Genel)</option>
                    <option value={10}>%10 (Tekstil/Kitap)</option>
                    <option value={1}>%1 (Temel Gıda)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-order-note"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pazaryeri Sipariş / Fatura Notu (Opsiyonel)
                </label>
                <input
                  id="new-order-note"
                  type="text"
                  value={newOrderNote}
                  onChange={(e) => setNewOrderNote(e.target.value)}
                  placeholder="Senkronize edilen siparişte müşteri notu varsa buraya girin (yoksa boş bırakın)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIncludeShipping}
                    onChange={(e) => setNewIncludeShipping(e.target.checked)}
                    className="rounded border-slate-300 bg-white text-[#248BD6]"
                  />
                  <span>Kargo Hizmet Bedelini Faturaya Yansıt ({newShippingFee} TL)</span>
                </label>
              </div>

              {newOrderFormError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                  {newOrderFormError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-3.5 py-2 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#248BD6] hover:bg-[#0F6BAE] rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Siparişi Kuyruğa Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
