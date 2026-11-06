import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Send,
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Eye,
  Settings2,
  Save,
  Wrench,
  Ban,
  Plus,
  Check,
  XCircle,
  X,
  Code2,
  Building2,
} from 'lucide-react';
import {
  CustomerType,
  EDocumentSubTab,
  EInvoiceIntegrator,
  IncomingEInvoice,
  IncomingInvoiceResponseStatus,
  MarketplaceOrder,
  SystemPlatformSettings,
} from '../types/invoicing';
import {
  calculateOrderTotals,
  determineDocumentType,
  formatTryCurrency,
} from '../utils/invoicingEngine';
import {
  acceptMysoftInvoice,
  denyMysoftInvoice,
  downloadMysoftFile,
  downloadMysoftPdf,
  listMysoftDocuments,
  MysoftClientError,
  type MysoftDocumentRow,
} from '../services/mysoftClient';
import { PascalHeroBanner } from './PascalUi';

interface EDocumentModuleViewProps {
  activeSubTab: EDocumentSubTab;
  onSelectSubTab: (subTab: EDocumentSubTab) => void;
  orders: MarketplaceOrder[];
  incomingInvoices: IncomingEInvoice[];
  systemSettings: SystemPlatformSettings;
  tenantIdentifierNumber?: string;
  onUpdateSystemSettings: (next: SystemPlatformSettings) => void;
  onPreviewInvoice: (order: MarketplaceOrder) => void;
  onIssueSingleInvoice: (orderId: string, allowDefaultTckn?: boolean) => void;
  onFixOrderTaxId: (
    orderId: string,
    newTaxId: string,
    customerType: CustomerType,
    issueImmediately: boolean
  ) => { success: boolean; error?: string };
  onCancelEArchiveInvoice: (orderId: string, reason: string) => void;
  onBatchRepairIndividualOrders: () => { repairedAndInvoicedCount: number };
  onRespondIncomingInvoice: (
    invoiceId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    reason?: string
  ) => void;
  onCreateIncomingInvoice: (newInvoice: IncomingEInvoice) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const INTEGRATOR_OPTIONS: Array<{ value: EInvoiceIntegrator; label: string }> =
  [
    { value: 'MYSOFT', label: 'Mysoft e-Belge' },
  ];

function getOrderTotals(order: MarketplaceOrder) {
  return calculateOrderTotals(
    order.items,
    order.shippingFeeVatIncluded,
    order.includeShippingInInvoice,
    order.sellerDiscountTotal,
    order.marketplaceCommissionRate,
    order.withholdingRate
  );
}

export const EDocumentModuleView: React.FC<EDocumentModuleViewProps> = ({
  activeSubTab,
  onSelectSubTab,
  orders,
  incomingInvoices,
  systemSettings,
  tenantIdentifierNumber,
  onUpdateSystemSettings,
  onPreviewInvoice,
  onIssueSingleInvoice,
  onFixOrderTaxId,
  onCancelEArchiveInvoice,
  onBatchRepairIndividualOrders,
  onRespondIncomingInvoice,
  onCreateIncomingInvoice,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  // Collapsible GİB Series & Policies Drawer
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] =
    useState<SystemPlatformSettings>(systemSettings);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState(false);
  const [mysoftRows, setMysoftRows] = useState<MysoftDocumentRow[]>([]);
  const [mysoftInbox, setMysoftInbox] = useState<IncomingEInvoice[] | null>(null);
  const [mysoftListError, setMysoftListError] = useState<string | null>(null);
  const [mysoftListLoading, setMysoftListLoading] = useState(false);

  // Filters for Outgoing Sub-Modules
  const [outgoingSearch, setOutgoingSearch] = useState('');
  const [outgoingStatusFilter, setOutgoingStatusFilter] = useState<
    'ALL' | 'INVOICED' | 'PENDING' | 'ERROR_TAX_ID' | 'CANCELLED'
  >('ALL');

  // Filters for Incoming e-Fatura Sub-Module
  const [incomingSearch, setIncomingSearch] = useState('');
  const [incomingFilter, setIncomingFilter] = useState<
    'ALL' | IncomingInvoiceResponseStatus
  >('ALL');

  // Modals for actions
  const [cancelOrderTarget, setCancelOrderTarget] =
    useState<MarketplaceOrder | null>(null);
  const [cancelReason, setCancelReason] = useState(
    'Müşteri siparişi cayma hakkı kapsamında iade etti'
  );

  const [fixTaxOrderTarget, setFixTaxOrderTarget] =
    useState<MarketplaceOrder | null>(null);
  const [fixTaxInput, setFixTaxInput] = useState('');
  const [fixTaxError, setFixTaxError] = useState<string | null>(null);

  const [rejectIncomingTarget, setRejectIncomingTarget] =
    useState<IncomingEInvoice | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState(
    'Fatura kalem birim fiyatı veya miktarı sipariş sözleşmesi ile uyuşmamaktadır.'
  );

  const [previewIncomingTarget, setPreviewIncomingTarget] =
    useState<IncomingEInvoice | null>(null);
  const [previewIncomingMode, setPreviewIncomingMode] = useState<
    'VISUAL' | 'XML'
  >('VISUAL');

  const [isCreateIncomingOpen, setIsCreateIncomingOpen] = useState(false);
  const [newSupplierTitle, setNewSupplierTitle] = useState('');
  const [newSupplierVkn, setNewSupplierVkn] = useState('');
  const [newSupplierTaxOffice, setNewSupplierTaxOffice] = useState('');
  const [newProfileId, setNewProfileId] = useState<
    'TICARIFATURA' | 'TEMELFATURA'
  >('TICARIFATURA');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newSubtotal, setNewSubtotal] = useState('15000');
  const [newVatRate, setNewVatRate] = useState('20');
  const [createIncomingError, setCreateIncomingError] = useState<string | null>(
    null
  );

  const mysoftActive = systemSettings.primaryGibIntegrator === 'MYSOFT';

  const reloadMysoftDocuments = async () => {
    if (!mysoftActive) return;
    setMysoftListLoading(true);
    setMysoftListError(null);
    try {
      if (activeSubTab === 'incoming_efatura') {
        const rows = await listMysoftDocuments({
          direction: 'incoming',
          tenantIdentifierNumber,
        });
        setMysoftInbox(
          rows.map((row) => ({
            id: row.ettn || row.docNo,
            ettn: row.ettn,
            invoiceNumber: row.docNo || row.ettn,
            supplierTitle: row.accountName || 'Tedarikçi',
            supplierVkn: row.vknTckn,
            supplierTaxOffice: '',
            supplierCity: '',
            issueDate: row.docDate,
            receivedAt: row.docDate,
            scenario: row.profile === 'TEMELFATURA' ? 'TEMELFATURA' : 'TICARIFATURA',
            subtotalExclVat: row.payableAmount,
            totalVat: 0,
            payableAmount: row.payableAmount,
            currency: 'TRY',
            responseStatus: 'PENDING_APPROVAL',
            lineSummary: row.profile || 'Mysoft gelen belge',
            itemCount: 1,
          }))
        );
      } else {
        const rows = await listMysoftDocuments({
          direction: 'outgoing',
          tenantIdentifierNumber,
          eDocumentType: activeSubTab === 'outgoing_earsiv' ? 'EARSIVFATURA' : 'EFATURA',
        });
        setMysoftRows(rows);
      }
    } catch (error) {
      const message = error instanceof MysoftClientError ? error.message : 'Mysoft listesi alınamadı.';
      setMysoftListError(message);
      if (activeSubTab === 'incoming_efatura') setMysoftInbox([]);
    } finally {
      setMysoftListLoading(false);
    }
  };

  useEffect(() => {
    if (!mysoftActive) {
      setMysoftInbox(null);
      setMysoftRows([]);
      setMysoftListError(null);
      return;
    }
    void reloadMysoftDocuments();
    // Liste, sekme veya firma değişince yenilenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mysoftActive, activeSubTab, tenantIdentifierNumber]);

  // Split orders into Giden e-Fatura (E_FATURA) and Giden e-Arşiv (E_ARSIV)
  const { eFaturaOrders, eArsivOrders } = useMemo(() => {
    const efatura: MarketplaceOrder[] = [];
    const earsiv: MarketplaceOrder[] = [];
    for (const order of orders) {
      const { documentType } = determineDocumentType(order);
      if (documentType === 'E_FATURA') {
        efatura.push(order);
      } else {
        earsiv.push(order);
      }
    }
    return { eFaturaOrders: efatura, eArsivOrders: earsiv };
  }, [orders]);

  // Metrics for Giden e-Fatura
  const eFaturaMetrics = useMemo(() => {
    let invoiced = 0;
    let pending = 0;
    let errorCount = 0;
    let totalVolume = 0;

    for (const o of eFaturaOrders) {
      const fin = getOrderTotals(o);
      if (o.invoiceStatus === 'INVOICED' && !o.isCancelled) {
        invoiced += 1;
        totalVolume += fin.grossInvoiceTotal;
      } else if (o.invoiceStatus === 'PENDING') {
        pending += 1;
      } else if (o.invoiceStatus === 'ERROR_TAX_ID') {
        errorCount += 1;
      }
    }
    return { invoiced, pending, errorCount, totalVolume };
  }, [eFaturaOrders]);

  // Metrics for Giden e-Arşiv
  const eArsivMetrics = useMemo(() => {
    let invoiced = 0;
    let pending = 0;
    let errorCount = 0;
    let cancelledCount = 0;
    let totalVolume = 0;

    for (const o of eArsivOrders) {
      const fin = getOrderTotals(o);
      if (o.isCancelled) {
        cancelledCount += 1;
      } else if (o.invoiceStatus === 'INVOICED') {
        invoiced += 1;
        totalVolume += fin.grossInvoiceTotal;
      } else if (o.invoiceStatus === 'PENDING') {
        pending += 1;
      } else if (o.invoiceStatus === 'ERROR_TAX_ID') {
        errorCount += 1;
      }
    }
    return { invoiced, pending, errorCount, cancelledCount, totalVolume };
  }, [eArsivOrders]);

  // Metrics for Gelen e-Fatura
  const visibleIncoming =
    mysoftActive ? (mysoftInbox ?? []) : incomingInvoices;

  const incomingMetrics = useMemo(() => {
    const total = visibleIncoming.length;
    let pendingApproval = 0;
    let accepted = 0;
    let rejected = 0;
    let acceptedTotalAmount = 0;

    for (const inv of visibleIncoming) {
      if (inv.responseStatus === 'PENDING_APPROVAL') {
        pendingApproval += 1;
      } else if (inv.responseStatus === 'ACCEPTED') {
        accepted += 1;
        acceptedTotalAmount += inv.payableAmount;
      } else if (inv.responseStatus === 'REJECTED') {
        rejected += 1;
      }
    }
    return {
      total,
      pendingApproval,
      accepted,
      rejected,
      acceptedTotalAmount,
    };
  }, [visibleIncoming]);

  // Filtered Outgoing List for active outgoing sub-tab
  const activeOutgoingOrders =
    activeSubTab === 'outgoing_efatura' ? eFaturaOrders : eArsivOrders;

  const filteredOutgoingOrders = useMemo(() => {
    return activeOutgoingOrders.filter((order) => {
      if (outgoingStatusFilter === 'CANCELLED') {
        if (!order.isCancelled) return false;
      } else if (outgoingStatusFilter !== 'ALL') {
        if (order.isCancelled || order.invoiceStatus !== outgoingStatusFilter) {
          return false;
        }
      }

      if (outgoingSearch.trim() !== '') {
        const q = outgoingSearch.toLowerCase().trim();
        const matchOrderNo = order.marketplaceOrderNumber
          .toLowerCase()
          .includes(q);
        const matchCustomer = order.customerName.toLowerCase().includes(q);
        const matchTaxId = order.taxIdentifier.toLowerCase().includes(q);
        const matchGibNo = (order.gibInvoiceNumber ?? '')
          .toLowerCase()
          .includes(q);
        if (!matchOrderNo && !matchCustomer && !matchTaxId && !matchGibNo) {
          return false;
        }
      }
      return true;
    });
  }, [activeOutgoingOrders, outgoingStatusFilter, outgoingSearch]);

  // Filtered Incoming e-Fatura List
  const filteredIncomingInvoices = useMemo(() => {
    return visibleIncoming.filter((inv) => {
      if (incomingFilter !== 'ALL' && inv.responseStatus !== incomingFilter) {
        return false;
      }
      if (incomingSearch.trim() !== '') {
        const q = incomingSearch.toLowerCase().trim();
        const matchNo = inv.invoiceNumber.toLowerCase().includes(q);
        const matchSupplier = inv.supplierTitle.toLowerCase().includes(q);
        const matchVkn = inv.supplierVkn.toLowerCase().includes(q);
        const matchEttn = inv.ettn.toLowerCase().includes(q);
        if (!matchNo && !matchSupplier && !matchVkn && !matchEttn) {
          return false;
        }
      }
      return true;
    });
  }, [visibleIncoming, incomingFilter, incomingSearch]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized: SystemPlatformSettings = {
      ...draftSettings,
      eInvoicePrefix:
        draftSettings.eInvoicePrefix
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3) || 'EFT',
      eArchivePrefix:
        draftSettings.eArchivePrefix
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3) || 'EAR',
    };
    setDraftSettings(normalized);
    onUpdateSystemSettings(normalized);
    setSettingsSavedNotice(true);
    setTimeout(() => setSettingsSavedNotice(false), 3000);
  };

  const respondIncoming = async (
    invoice: IncomingEInvoice,
    decision: 'ACCEPTED' | 'REJECTED',
    reason?: string
  ) => {
    if (mysoftActive) {
      if (!invoice.ettn) {
        setMysoftListError('Bu belgenin ETTN değeri yok.');
        return;
      }
      try {
        if (decision === 'ACCEPTED') {
          await acceptMysoftInvoice({ ettn: invoice.ettn, tenantIdentifierNumber });
        } else {
          await denyMysoftInvoice({
            ettn: invoice.ettn,
            rejectReason: reason,
            tenantIdentifierNumber,
          });
        }
        setMysoftInbox((prev) =>
          (prev ?? []).map((row) =>
            row.id === invoice.id
              ? {
                  ...row,
                  responseStatus: decision,
                  rejectionReason: decision === 'REJECTED' ? reason : undefined,
                }
              : row
          )
        );
        setMysoftListError(null);
      } catch (error) {
        setMysoftListError(
          error instanceof MysoftClientError ? error.message : 'Mysoft yanıtı gönderilemedi.'
        );
        return;
      }
    }
    onRespondIncomingInvoice(invoice.id, decision, reason);
  };

  const handleConfirmCancelEArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderTarget) return;
    onCancelEArchiveInvoice(
      cancelOrderTarget.id,
      cancelReason.trim() || 'e-Arşiv İptal İşlemi'
    );
    setCancelOrderTarget(null);
  };

  const handleConfirmFixTaxId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixTaxOrderTarget) return;
    const res = onFixOrderTaxId(
      fixTaxOrderTarget.id,
      fixTaxInput,
      fixTaxOrderTarget.customerType,
      true
    );
    if (!res.success) {
      setFixTaxError(res.error || 'Vergi kimlik numarası doğrulanamadı.');
      return;
    }
    setFixTaxOrderTarget(null);
    setFixTaxError(null);
  };

  const handleConfirmRejectIncoming = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectIncomingTarget) return;
    void respondIncoming(
      rejectIncomingTarget,
      'REJECTED',
      rejectReasonInput.trim() || 'Ticari e-Fatura reddedildi.'
    );
    setRejectIncomingTarget(null);
  };

  const handleSubmitNewIncoming = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVkn = newSupplierVkn.replace(/\D/g, '');
    if (newSupplierTitle.trim().length < 3) {
      setCreateIncomingError('Tedarikçi unvanı en az 3 karakter olmalıdır.');
      return;
    }
    if (cleanVkn.length !== 10) {
      setCreateIncomingError(
        'Tedarikçi VKN 10 haneli rakamlardan oluşmalıdır.'
      );
      return;
    }
    const subtotalNum = Number(newSubtotal);
    const vatRateNum = Number(newVatRate);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      setCreateIncomingError('Geçerli bir KDV hariç matrah tutarı giriniz.');
      return;
    }

    const totalVat = Number(((subtotalNum * vatRateNum) / 100).toFixed(2));
    const payableAmount = Number((subtotalNum + totalVat).toFixed(2));
    const randomSeq = Math.floor(100000000 + Math.random() * 899999999);
    const gibNo = `GIB2026${randomSeq}`;

    const created: IncomingEInvoice = {
      id: `inc-${Date.now()}`,
      invoiceNumber: gibNo,
      ettn: `${Math.random().toString(16).slice(2, 10)}-7a4e-4d3b-9b12-${Math.random().toString(16).slice(2, 14)}`,
      supplierTitle: newSupplierTitle.trim(),
      supplierVkn: cleanVkn,
      supplierTaxOffice:
        newSupplierTaxOffice.trim() || 'Büyük Mükellefler V.D.',
      supplierCity: 'İstanbul',
      issueDate: '2026-11-05 10:15',
      receivedAt: '2026-11-05 10:16',
      scenario: newProfileId,
      lineSummary:
        newItemDescription.trim() || 'Tedarikçi Mal / Hizmet Alım Faturası',
      itemCount: 1,
      subtotalExclVat: subtotalNum,
      totalVat,
      payableAmount,
      currency: 'TRY',
      responseStatus:
        newProfileId === 'TEMELFATURA' ? 'ACCEPTED' : 'PENDING_APPROVAL',
      responseDeadline:
        newProfileId === 'TICARIFATURA' ? '2026-11-13' : undefined,
    };

    onCreateIncomingInvoice(created);
    setIsCreateIncomingOpen(false);
    setNewSupplierTitle('');
    setNewSupplierVkn('');
    setNewSupplierTaxOffice('');
    setNewItemDescription('');
    setCreateIncomingError(null);
  };

  return (
    <div className="space-y-6">
      {/* Pascal Hero Banner */}
      <PascalHeroBanner
        kicker="GİB UBL-TR 2.1 · E-BELGE YÖNETİMİ"
        title={
          activeSubTab === 'incoming_efatura'
            ? 'Gelen e-Faturalar'
            : activeSubTab === 'outgoing_earsiv'
              ? 'Giden e-Arşivler'
              : 'Giden e-Faturalar'
        }
        subtitle={`Kurumsal Giden e-Fatura (${systemSettings.eInvoicePrefix}), Bireysel Giden e-Arşiv (${systemSettings.eArchivePrefix}) ve Tedarikçi Gelen e-Fatura kabul/red yönetimi.`}
        onSaveAction={onSaveAllModules ? () => onSaveAllModules('e-Belge Modülü') : undefined}
        saveLabel={hasUnsavedChanges ? 'Değişiklikleri Kaydet' : 'İçe Aktar / Kaydet'}
        hasUnsavedChanges={hasUnsavedChanges}
        primaryLabel={`GİB Seri Ön Eki (${systemSettings.eInvoicePrefix}/${systemSettings.eArchivePrefix})`}
        onPrimaryAction={() => setIsSettingsOpen((prev) => !prev)}
      />

      {mysoftActive && activeSubTab !== 'incoming_efatura' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Mysoft giden kutu</h2>
              <p className="text-xs text-slate-500">
                Son 90 gün. Kesilen belgenin numarası ve ETTN burada görünür.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reloadMysoftDocuments()}
              disabled={mysoftListLoading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
            >
              {mysoftListLoading ? 'Yükleniyor...' : 'Listeyi yenile'}
            </button>
          </div>
          {mysoftListLoading && (
            <p className="text-xs text-slate-500">Mysoft listesi yükleniyor.</p>
          )}
          {mysoftListError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {mysoftListError}
            </p>
          )}
          {!mysoftListLoading && !mysoftListError && mysoftRows.length === 0 && (
            <p className="text-xs text-slate-500">Bu aralıkta Mysoft belgesi yok.</p>
          )}
          {mysoftRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-3">Belge no</th>
                    <th className="py-1 pr-3">ETTN</th>
                    <th className="py-1 pr-3">Cari</th>
                    <th className="py-1 pr-3">Tarih</th>
                    <th className="py-1 pr-3">Tutar</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {mysoftRows.map((row) => (
                    <tr key={row.ettn || row.docNo} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-mono">{row.docNo || '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-[11px]">{row.ettn || '—'}</td>
                      <td className="py-1.5 pr-3">{row.accountName || row.vknTckn || '—'}</td>
                      <td className="py-1.5 pr-3">{row.docDate || '—'}</td>
                      <td className="py-1.5 pr-3 font-mono">{formatTryCurrency(row.payableAmount)}</td>
                      <td className="py-1.5">
                        {row.ettn && (
                          <button
                            type="button"
                            className="text-blue-700 font-semibold cursor-pointer"
                            onClick={() => {
                              void downloadMysoftPdf({
                                direction: 'outgoing',
                                ettn: row.ettn,
                                tenantIdentifierNumber,
                              }).catch((error: unknown) => {
                                setMysoftListError(
                                  error instanceof Error ? error.message : 'PDF alınamadı.'
                                );
                              });
                            }}
                          >
                            PDF
                          </button>
                        )}
                        {row.ettn && (
                          <button
                            type="button"
                            className="ml-2 text-blue-700 font-semibold cursor-pointer"
                            onClick={() => {
                              void downloadMysoftFile({
                                direction: 'outgoing',
                                ettn: row.ettn,
                                format: 'xml',
                                tenantIdentifierNumber,
                              }).catch((error: unknown) => {
                                setMysoftListError(
                                  error instanceof Error ? error.message : 'XML alınamadı.'
                                );
                              });
                            }}
                          >
                            XML
                          </button>
                        )}
                        {row.ettn && (
                          <button
                            type="button"
                            className="ml-2 text-blue-700 font-semibold cursor-pointer"
                            onClick={() => {
                              void downloadMysoftFile({
                                direction: 'outgoing',
                                ettn: row.ettn,
                                format: 'html',
                                tenantIdentifierNumber,
                              }).catch((error: unknown) => {
                                setMysoftListError(
                                  error instanceof Error ? error.message : 'HTML alınamadı.'
                                );
                              });
                            }}
                          >
                            HTML
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {mysoftActive && activeSubTab === 'incoming_efatura' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-600">
            Gelen kutusu Mysoft’tan geliyor.
            {mysoftListError ? ` ${mysoftListError}` : ''}
          </p>
          <button
            type="button"
            onClick={() => void reloadMysoftDocuments()}
            disabled={mysoftListLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
          >
            {mysoftListLoading ? 'Yükleniyor...' : 'Listeyi yenile'}
          </button>
        </div>
      )}

      {/* Module Top Header + Sub-Module Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-5 shadow-xs">

        {/* Collapsible GİB Series & Policies Drawer */}
        {isSettingsOpen && (
          <form
            onSubmit={handleSaveSettings}
            className="pt-4 border-t border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  GİB Seri Ön Eki & Numaralandırma Politikaları
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kesilecek Giden e-Fatura ve Giden e-Arşiv belgelerinin 3
                  haneli resmi seri ön eklerini yapılandırın.
                </p>
              </div>
              {settingsSavedNotice && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  GİB ayarları kaydedildi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ana GİB Özel Entegratörü
                </label>
                <select
                  value={draftSettings.primaryGibIntegrator}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      primaryGibIntegrator: e.target
                        .value as EInvoiceIntegrator,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {INTEGRATOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  GİB Çalışma Ortamı
                </label>
                <select
                  value={draftSettings.environmentMode}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      environmentMode: e.target.value as
                        | 'PRODUCTION'
                        | 'SANDBOX',
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="PRODUCTION">GİB Canlı Ortam (Resmi)</option>
                  <option value="SANDBOX">GİB Sandbox (Test)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Giden e-Fatura Seri Ön Eki (3 Harf)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={draftSettings.eInvoicePrefix}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      eInvoicePrefix: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Giden e-Arşiv Seri Ön Eki (3 Harf)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={draftSettings.eArchivePrefix}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      eArchivePrefix: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.enforceStrictVknCheck}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      enforceStrictVknCheck: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Kurumsal e-Fatura kesimlerinde 10 haneli GİB VKN doğrulamasını
                  zorunlu tut
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Ayarları Kaydet
                </button>
              </div>
            </div>
          </form>
        )}

        {/* 3 Sub-Module Switcher Bar */}
        <div
          role="tablist"
          aria-label="e-Belge Alt Modülleri"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'outgoing_efatura'}
            onClick={() => {
              onSelectSubTab('outgoing_efatura');
              setOutgoingStatusFilter('ALL');
              setOutgoingSearch('');
            }}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'outgoing_efatura'
                ? 'bg-[#248BD6] text-white border-[#248BD6] shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  activeSubTab === 'outgoing_efatura'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#0F6BAE] text-white'
                }`}
              >
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Giden e-Fatura</p>
                <p
                  className={`text-[11px] truncate ${
                    activeSubTab === 'outgoing_efatura'
                      ? 'text-[#C6CDFF]'
                      : 'text-slate-500'
                  }`}
                >
                  Kurumsal VKN · Seri: {systemSettings.eInvoicePrefix}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-mono font-bold tabular-nums rounded-md ${
                activeSubTab === 'outgoing_efatura'
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-[#0F6BAE] border border-slate-200'
              }`}
            >
              {eFaturaOrders.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'outgoing_earsiv'}
            onClick={() => {
              onSelectSubTab('outgoing_earsiv');
              setOutgoingStatusFilter('ALL');
              setOutgoingSearch('');
            }}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'outgoing_earsiv'
                ? 'bg-[#248BD6] text-white border-[#248BD6] shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  activeSubTab === 'outgoing_earsiv'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#0F6BAE] text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Giden e-Arşiv</p>
                <p
                  className={`text-[11px] truncate ${
                    activeSubTab === 'outgoing_earsiv'
                      ? 'text-[#C6CDFF]'
                      : 'text-slate-500'
                  }`}
                >
                  Bireysel TCKN · Seri: {systemSettings.eArchivePrefix}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-mono font-bold tabular-nums rounded-md ${
                activeSubTab === 'outgoing_earsiv'
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-[#0F6BAE] border border-slate-200'
              }`}
            >
              {eArsivOrders.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'incoming_efatura'}
            onClick={() => {
              onSelectSubTab('incoming_efatura');
              setIncomingFilter('ALL');
              setIncomingSearch('');
            }}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'incoming_efatura'
                ? 'bg-[#248BD6] text-white border-[#248BD6] shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  activeSubTab === 'incoming_efatura'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#0F6BAE] text-white'
                }`}
              >
                <Inbox className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Gelen e-Fatura</p>
                <p
                  className={`text-[11px] truncate ${
                    activeSubTab === 'incoming_efatura'
                      ? 'text-[#C6CDFF]'
                      : 'text-slate-500'
                  }`}
                >
                  Tedarikçi Alım ·{' '}
                  {incomingMetrics.pendingApproval > 0
                    ? `${incomingMetrics.pendingApproval} Onay Bekliyor`
                    : 'GİB Gelen Kutusu'}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-mono font-bold tabular-nums rounded-md ${
                activeSubTab === 'incoming_efatura'
                  ? 'bg-white/20 text-white'
                  : incomingMetrics.pendingApproval > 0
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'bg-white text-[#0F6BAE] border border-slate-200'
              }`}
            >
              {visibleIncoming.length}
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-MODULE 1: GİDEN E-FATURA (CORPORATE E_FATURA)
          ===================================================================== */}
      {activeSubTab === 'outgoing_efatura' && (
        <div className="space-y-5">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Onaylı Giden e-Fatura
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {eFaturaMetrics.invoiced}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Seri: {systemSettings.eInvoicePrefix}2026... (Kurumsal VKN)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Kesim Bekleyen e-Fatura
                </span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {eFaturaMetrics.pending}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                GİB posta kutusuna gönderime hazır
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  VKN Doğrulama Hatası
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-2">
                {eFaturaMetrics.errorCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                10 haneli VKN onarımı bekleyen
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Giden e-Fatura Toplam Hacim
                </span>
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {formatTryCurrency(eFaturaMetrics.totalVolume)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                KDV dahil resmi faturalandırılan
              </p>
            </div>
          </div>

          {/* Giden e-Fatura Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Giden e-Fatura Listesi (Kurumsal Mükellef Belgeleri)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  GİB e-Fatura mükellefi olan kurumsal alıcılara (
                  {systemSettings.eInvoicePrefix} serisi ile) düzenlenen resmi
                  faturalar.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  {(
                    [
                      { id: 'ALL', label: 'Tümü' },
                      { id: 'INVOICED', label: 'Kesilenler' },
                      { id: 'PENDING', label: 'Bekleyenler' },
                      { id: 'ERROR_TAX_ID', label: 'VKN Hatalı' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOutgoingStatusFilter(st.id)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        outgoingStatusFilter === st.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={outgoingSearch}
                    onChange={(e) => setOutgoingSearch(e.target.value)}
                    placeholder="GİB No, Unvan, VKN veya Sipariş..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600 w-60"
                  />
                </div>

                {onSaveAllModules && (
                  <button
                    type="button"
                    onClick={() => onSaveAllModules('Giden e-Fatura')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      hasUnsavedChanges
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">GİB Belge No / Tarih</th>
                    <th className="py-3 px-4">Kurumsal Alıcı & VKN</th>
                    <th className="py-3 px-4">Pazaryeri & Sipariş</th>
                    <th className="py-3 px-4 text-right">KDV Hariç</th>
                    <th className="py-3 px-4 text-right">KDV Dahil Toplam</th>
                    <th className="py-3 px-4">GİB Durumu</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredOutgoingOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-500"
                      >
                        Seçili kriterlere uygun Giden e-Fatura kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredOutgoingOrders.map((order) => {
                      const fin = getOrderTotals(order);
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4">
                            {order.gibInvoiceNumber ? (
                              <div>
                                <span className="font-mono font-bold text-slate-900 block">
                                  {order.gibInvoiceNumber}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {order.invoicedAt || order.orderDate}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-xs font-medium text-slate-500 block">
                                  Henüz Numara Atanmadı
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  Seri: {systemSettings.eInvoicePrefix}2026...
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">
                              {order.customerName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              VKN: {order.taxIdentifier || 'Eksik'} ·{' '}
                              {order.taxOffice || 'Kurumsal V.D.'}
                            </p>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 uppercase text-[11px]">
                              {order.marketplace}
                            </span>
                            <p className="text-[11px] font-mono text-slate-500">
                              #{order.marketplaceOrderNumber}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatTryCurrency(fin.subtotalExclVat)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatTryCurrency(fin.grossInvoiceTotal)}
                          </td>

                          <td className="py-3 px-4">
                            {order.invoiceStatus === 'INVOICED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                GİB Onaylı e-Fatura
                              </span>
                            ) : order.invoiceStatus === 'ERROR_TAX_ID' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Hatalı VKN ({order.taxIdentifier.length} Hane)
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Clock className="w-3 h-3" />
                                Kesim Bekliyor
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {order.invoiceStatus === 'INVOICED' && (
                                <button
                                  type="button"
                                  onClick={() => onPreviewInvoice(order)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  UBL-TR / Önizle
                                </button>
                              )}

                              {order.invoiceStatus === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onIssueSingleInvoice(order.id, false)
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    e-Fatura Kes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onPreviewInvoice(order)}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {order.invoiceStatus === 'ERROR_TAX_ID' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFixTaxOrderTarget(order);
                                    setFixTaxInput(order.taxIdentifier);
                                    setFixTaxError(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  VKN Düzelt & Kes
                                </button>
                              )}
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
          SUB-MODULE 2: GİDEN E-ARŞİV (INDIVIDUAL E_ARSIV)
          ===================================================================== */}
      {activeSubTab === 'outgoing_earsiv' && (
        <div className="space-y-5">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Onaylı Giden e-Arşiv
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {eArsivMetrics.invoiced}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Seri: {systemSettings.eArchivePrefix}2026... (Bireysel TCKN)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Kesim Bekleyen e-Arşiv
                </span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {eArsivMetrics.pending}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Otomatik veya tekil kesime hazır
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Eksik TCKN / İptal Edilen
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {eArsivMetrics.errorCount} Hata · {eArsivMetrics.cancelledCount}{' '}
                İptal
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                11111111111 ataması ile onarılabilir
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Giden e-Arşiv Toplam Hacim
                </span>
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {formatTryCurrency(eArsivMetrics.totalVolume)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                KDV dahil aktif e-Arşiv toplamı
              </p>
            </div>
          </div>

          {/* Giden e-Arşiv Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Giden e-Arşiv Fatura Listesi (Bireysel / Tüketici Belgeleri)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  GİB e-Arşiv kapsamında elektronik ortamda oluşturulan,
                  e-posta/SMS ile iletilen ve iptal edilebilen faturalar.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {eArsivMetrics.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onBatchRepairIndividualOrders()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Eksik TCKN Onar (11111111111) & Kes (
                    {eArsivMetrics.errorCount})
                  </button>
                )}

                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  {(
                    [
                      { id: 'ALL', label: 'Tümü' },
                      { id: 'INVOICED', label: 'Kesilenler' },
                      { id: 'PENDING', label: 'Bekleyenler' },
                      { id: 'ERROR_TAX_ID', label: 'TCKN Eksik' },
                      { id: 'CANCELLED', label: 'İptal' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOutgoingStatusFilter(st.id)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        outgoingStatusFilter === st.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={outgoingSearch}
                    onChange={(e) => setOutgoingSearch(e.target.value)}
                    placeholder="EAR No, Müşteri, TCKN veya Sipariş..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600 w-60"
                  />
                </div>

                {onSaveAllModules && (
                  <button
                    type="button"
                    onClick={() => onSaveAllModules('Giden e-Arşiv')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      hasUnsavedChanges
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">e-Arşiv Belge No / Tarih</th>
                    <th className="py-3 px-4">Alıcı Ad Soyad & TCKN</th>
                    <th className="py-3 px-4">Pazaryeri & Kargo</th>
                    <th className="py-3 px-4 text-right">KDV Hariç</th>
                    <th className="py-3 px-4 text-right">KDV Dahil Toplam</th>
                    <th className="py-3 px-4">GİB e-Arşiv Durumu</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredOutgoingOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-500"
                      >
                        Seçili kriterlere uygun Giden e-Arşiv kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredOutgoingOrders.map((order) => {
                      const fin = getOrderTotals(order);
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4">
                            {order.gibInvoiceNumber ? (
                              <div>
                                <span
                                  className={`font-mono font-bold block ${
                                    order.isCancelled
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {order.gibInvoiceNumber}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {order.invoicedAt || order.orderDate}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-xs font-medium text-slate-500 block">
                                  Henüz Kesilmedi
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  Seri: {systemSettings.eArchivePrefix}2026...
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">
                              {order.customerName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              TCKN:{' '}
                              {order.taxIdentifier || 'Eksik (11111111111)'} ·{' '}
                              {order.city}/{order.district}
                            </p>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 uppercase text-[11px]">
                              {order.marketplace}
                            </span>
                            <p className="text-[11px] font-mono text-slate-500">
                              #{order.marketplaceOrderNumber}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatTryCurrency(fin.subtotalExclVat)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatTryCurrency(fin.grossInvoiceTotal)}
                          </td>

                          <td className="py-3 px-4">
                            {order.isCancelled ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <Ban className="w-3 h-3" />
                                  e-Arşiv İptal Edildi
                                </span>
                                {order.cancelReason && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                                    {order.cancelReason}
                                  </p>
                                )}
                              </div>
                            ) : order.invoiceStatus === 'INVOICED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                GİB Raporlandı
                              </span>
                            ) : order.invoiceStatus === 'ERROR_TAX_ID' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                TCKN Eksik
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Clock className="w-3 h-3" />
                                Kesim Bekliyor
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {order.invoiceStatus === 'INVOICED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onPreviewInvoice(order)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    Önizle
                                  </button>
                                  {!order.isCancelled && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCancelOrderTarget(order)
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      İptal Et
                                    </button>
                                  )}
                                </>
                              )}

                              {order.invoiceStatus === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onIssueSingleInvoice(order.id, true)
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    e-Arşiv Kes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onPreviewInvoice(order)}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {order.invoiceStatus === 'ERROR_TAX_ID' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onIssueSingleInvoice(order.id, true)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  11111111111 Ata & Kes
                                </button>
                              )}
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
          SUB-MODULE 3: GELEN E-FATURA (SUPPLIER PURCHASE INVOICES)
          ===================================================================== */}
      {activeSubTab === 'incoming_efatura' && (
        <div className="space-y-5">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Gelen Kutusu Toplam Belge
                </span>
                <Inbox className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {incomingMetrics.total}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Tedarikçi & pazaryeri komisyon faturaları
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Onay Bekleyen Ticari e-Fatura
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-2">
                {incomingMetrics.pendingApproval}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                8 günlük yasal yanıt süresi içinde
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Kabul Edilen / Muhasebeleşen
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {incomingMetrics.accepted} Kabul · {incomingMetrics.rejected}{' '}
                Red
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                GİB uygulama yanıtı gönderilenler
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Onaylı Alım Toplamı (KDV Dahil)
                </span>
                <Building2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {formatTryCurrency(incomingMetrics.acceptedTotalAmount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                İndirilecek KDV matrahına dahil
              </p>
            </div>
          </div>

          {/* Gelen e-Fatura Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Gelen e-Fatura Kutusu (Tedarikçi & Pazaryeri Alım Faturaları)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ticari Fatura senaryosundaki belgeleri GİB Uygulama Yanıtı ile
                  Kabul veya Reddedebilir, Temel Faturaları inceleyebilirsiniz.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  {(
                    [
                      { id: 'ALL', label: 'Tümü' },
                      { id: 'PENDING_APPROVAL', label: 'Onay Bekleyen' },
                      { id: 'ACCEPTED', label: 'Kabul Edilenler' },
                      { id: 'REJECTED', label: 'Reddedilenler' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setIncomingFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        incomingFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={incomingSearch}
                    onChange={(e) => setIncomingSearch(e.target.value)}
                    placeholder="Fatura No, Tedarikçi, VKN..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600 w-56"
                  />
                </div>

                {onSaveAllModules && (
                  <button
                    type="button"
                    onClick={() => onSaveAllModules('Gelen e-Fatura')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      hasUnsavedChanges
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCreateIncomingOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Gelen Fatura Kaydet
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Fatura No & ETTN</th>
                    <th className="py-3 px-4">Gönderici Tedarikçi & VKN</th>
                    <th className="py-3 px-4">Senaryo / Kalem Özeti</th>
                    <th className="py-3 px-4 text-right">KDV Tutarı</th>
                    <th className="py-3 px-4 text-right">Genel Toplam</th>
                    <th className="py-3 px-4">GİB Yanıt Durumu</th>
                    <th className="py-3 px-4 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredIncomingInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-500"
                      >
                        Seçili filtreye uygun Gelen e-Fatura bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredIncomingInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 block">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 block">
                            {inv.issueDate}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate block max-w-[150px]">
                            ETTN: {inv.ettn}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {inv.supplierTitle}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500">
                            VKN: {inv.supplierVkn} · {inv.supplierTaxOffice}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded ${
                                inv.scenario === 'TICARIFATURA'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {inv.scenario}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              SATIS ({inv.itemCount} Kalem)
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1 max-w-[260px]">
                            {inv.lineSummary}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatTryCurrency(inv.totalVat)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatTryCurrency(inv.payableAmount)}
                        </td>

                        <td className="py-3 px-4">
                          {inv.responseStatus === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Onay Bekliyor (Ticari)
                            </span>
                          )}
                          {inv.responseStatus === 'ACCEPTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {inv.scenario === 'TEMELFATURA'
                                ? 'Otomatik Kabul (Temel)'
                                : 'Kabul Edildi'}
                            </span>
                          )}
                          {inv.responseStatus === 'REJECTED' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                Reddedildi
                              </span>
                              {inv.rejectionReason && (
                                <p className="text-[10px] text-slate-500 mt-0.5 max-w-[180px] truncate">
                                  {inv.rejectionReason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {inv.responseStatus === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void respondIncoming(inv, 'ACCEPTED');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Kabul Et
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectIncomingTarget(inv)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reddet
                                </button>
                              </>
                            )}
                            {mysoftActive && inv.ettn && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void downloadMysoftFile({
                                      direction: 'incoming',
                                      ettn: inv.ettn,
                                      format: 'pdf',
                                      tenantIdentifierNumber,
                                    }).catch((error: unknown) => {
                                      setMysoftListError(
                                        error instanceof Error ? error.message : 'PDF alınamadı.'
                                      );
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void downloadMysoftFile({
                                      direction: 'incoming',
                                      ettn: inv.ettn,
                                      format: 'xml',
                                      tenantIdentifierNumber,
                                    }).catch((error: unknown) => {
                                      setMysoftListError(
                                        error instanceof Error ? error.message : 'XML alınamadı.'
                                      );
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  XML
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewIncomingTarget(inv);
                                setPreviewIncomingMode('VISUAL');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              İncele / XML
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: FIX CORPORATE VKN & ISSUE E-FATURA
          ===================================================================== */}
      {fixTaxOrderTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Kurumsal VKN Düzelt ve Giden e-Fatura Kes
              </h3>
              <button
                type="button"
                onClick={() => setFixTaxOrderTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              <strong>{fixTaxOrderTarget.customerName}</strong> (#
              {fixTaxOrderTarget.marketplaceOrderNumber}) siparişi için GİB
              e-Fatura mükellef sorgulamasına uygun 10 haneli Vergi Kimlik
              Numarasını giriniz.
            </p>
            <form onSubmit={handleConfirmFixTaxId} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  10 Haneli Kurumsal VKN
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={fixTaxInput}
                  onChange={(e) =>
                    setFixTaxInput(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="Örn: 4820193847"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
                {fixTaxError && (
                  <p className="text-xs text-rose-600 mt-1">{fixTaxError}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFixTaxOrderTarget(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  VKN Doğrula & e-Fatura Kes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CANCEL OUTGOING E-ARCHIVE INVOICE
          ===================================================================== */}
      {cancelOrderTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Giden e-Arşiv Fatura İptali
              </h3>
              <button
                type="button"
                onClick={() => setCancelOrderTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              <strong className="font-mono">
                {cancelOrderTarget.gibInvoiceNumber}
              </strong>{' '}
              numaralı ({cancelOrderTarget.customerName}) e-Arşiv faturası GİB
              e-Arşiv Raporunda iptal statüsüne çekilecektir.
            </p>
            <form onSubmit={handleConfirmCancelEArchive} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  İptal Gerekçesi
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelOrderTarget(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                >
                  e-Arşiv Faturayı İptal Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REJECT INCOMING TICARIFATURA
          ===================================================================== */}
      {rejectIncomingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Gelen Ticari e-Fatura Red Yanıtı (Uygulama Yanıtı)
              </h3>
              <button
                type="button"
                onClick={() => setRejectIncomingTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              <strong>{rejectIncomingTarget.supplierTitle}</strong> tarafından
              düzenlenen{' '}
              <strong className="font-mono">
                {rejectIncomingTarget.invoiceNumber}
              </strong>{' '}
              numaralı Ticari e-Fatura için GİB üzerinden resmi RED Uygulama
              Yanıtı gönderilecektir.
            </p>
            <form onSubmit={handleConfirmRejectIncoming} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GİB Uygulama Yanıtı Red Gerekçesi
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectIncomingTarget(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                >
                  GİB Red Yanıtı Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: PREVIEW INCOMING E-FATURA (VISUAL + UBL-TR XML)
          ===================================================================== */}
      {previewIncomingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Gelen e-Fatura Önizleme (
                    {previewIncomingTarget.invoiceNumber})
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 rounded">
                    {previewIncomingTarget.scenario}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  ETTN: {previewIncomingTarget.ettn}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPreviewIncomingMode('VISUAL')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      previewIncomingMode === 'VISUAL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Görsel Fatura
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewIncomingMode('XML')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer ${
                      previewIncomingMode === 'XML'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    UBL-TR XML
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewIncomingTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto">
              {previewIncomingMode === 'VISUAL' ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Gönderici Tedarikçi (Satıcı)
                      </p>
                      <p className="font-bold text-slate-900 mt-1">
                        {previewIncomingTarget.supplierTitle}
                      </p>
                      <p className="font-mono text-slate-600 mt-0.5">
                        VKN: {previewIncomingTarget.supplierVkn} ·{' '}
                        {previewIncomingTarget.supplierTaxOffice}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Alıcı Mükellef (Firmamız)
                      </p>
                      <p className="font-bold text-slate-900 mt-1">
                        Anadolu Dijital Ticaret ve Lojistik A.Ş.
                      </p>
                      <p className="font-mono text-slate-600 mt-0.5">
                        VKN: 3890642158 · Maslak V.D.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Mal / Hizmet Açıklaması</th>
                          <th className="py-2.5 px-3 text-right">Matrah</th>
                          <th className="py-2.5 px-3 text-right">KDV</th>
                          <th className="py-2.5 px-3 text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {previewIncomingTarget.lineSummary}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {formatTryCurrency(
                              previewIncomingTarget.subtotalExclVat
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {formatTryCurrency(previewIncomingTarget.totalVat)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                            {formatTryCurrency(
                              previewIncomingTarget.payableAmount
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${previewIncomingTarget.scenario}</cbc:ProfileID>
  <cbc:ID>${previewIncomingTarget.invoiceNumber}</cbc:ID>
  <cbc:UUID>${previewIncomingTarget.ettn}</cbc:UUID>
  <cbc:IssueDate>${previewIncomingTarget.issueDate.split(' ')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${previewIncomingTarget.supplierVkn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${previewIncomingTarget.supplierTitle}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">${previewIncomingTarget.subtotalExclVat.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">${previewIncomingTarget.subtotalExclVat.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">${previewIncomingTarget.payableAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">${previewIncomingTarget.payableAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: CREATE NEW INCOMING E-FATURA
          ===================================================================== */}
      {isCreateIncomingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Yeni Gelen e-Fatura Kaydet (GİB Gelen Kutusu)
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateIncomingOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewIncoming} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tedarikçi Resmi Unvanı
                  </label>
                  <input
                    type="text"
                    value={newSupplierTitle}
                    onChange={(e) => setNewSupplierTitle(e.target.value)}
                    placeholder="Örn: Boğaziçi Ambalaj San. A.Ş."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tedarikçi VKN (10 Hane)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={newSupplierVkn}
                    onChange={(e) =>
                      setNewSupplierVkn(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="Örn: 6120493821"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    value={newSupplierTaxOffice}
                    onChange={(e) => setNewSupplierTaxOffice(e.target.value)}
                    placeholder="Örn: Kozyatağı V.D."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fatura Senaryosu (ProfileID)
                  </label>
                  <select
                    value={newProfileId}
                    onChange={(e) =>
                      setNewProfileId(
                        e.target.value as 'TICARIFATURA' | 'TEMELFATURA'
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="TICARIFATURA">
                      TICARIFATURA (Kabul/Red Onaylı)
                    </option>
                    <option value="TEMELFATURA">
                      TEMELFATURA (Otomatik Kabul)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mal / Hizmet Kalem Açıklaması
                </label>
                <input
                  type="text"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Örn: Kargo Kolisi ve Koruyucu Hava Kabarcıklı Naylon Alımı"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    KDV Hariç Matrah (TL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSubtotal}
                    onChange={(e) => setNewSubtotal(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    KDV Oranı (%)
                  </label>
                  <select
                    value={newVatRate}
                    onChange={(e) => setNewVatRate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="20">%20 KDV</option>
                    <option value="10">%10 KDV</option>
                    <option value="1">%1 KDV</option>
                  </select>
                </div>
              </div>

              {createIncomingError && (
                <p className="text-xs text-rose-600">{createIncomingError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateIncomingOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Gelen Kutusuna Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
