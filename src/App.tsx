/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  INITIAL_APP_OWNER_PROFILE,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPANY_PROFILES,
  INITIAL_INCOMING_EINVOICES,
  INITIAL_INTEGRATIONS,
  INITIAL_ORDERS,
  INITIAL_RULES,
  INITIAL_SMMM_PROFILE,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_TAX_CALENDAR,
  INITIAL_USERS,
} from './data/seedData';
import {
  AppOwnerProfile,
  AuditActionCategory,
  AuditLogEntry,
  AutomationRule,
  CompanyProfile,
  CustomerType,
  EDocumentSubTab,
  EInvoiceIntegrator,
  IncomingEInvoice,
  MarketplaceId,
  MarketplaceIntegration,
  MarketplaceOrder,
  PlatformUser,
  SmmmProfile,
  SystemPlatformSettings,
  TaxCalendarItem,
  UserRole,
} from './types/invoicing';
import {
  allocateUserInvoiceCredits,
  deletePlatformUser,
  determineDocumentType,
  evaluateAutomationRules,
  getIntegratorPrefixForDocument,
  issueInvoiceForOrder,
  toggleUserAccountStatus,
  validateAndConnectUserMarketplace,
  validateAndCreatePlatformUser,
  validateTurkishTaxIdentifier,
} from './utils/invoicingEngine';
import { cancelMysoftArchive, issueMysoftInvoice, MysoftClientError } from './services/mysoftClient';
import { ActiveTab, TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { OrdersQueueView } from './components/OrdersQueueView';
import { AdminPanelView, AdminSubTab } from './components/AdminPanelView';
import { AppOwnerProfileView } from './components/AppOwnerProfileView';
import { EDocumentModuleView } from './components/EDocumentModuleView';
import { TaxReconciliationView } from './components/TaxReconciliationView';
import { AccountantModuleView } from './components/AccountantModuleView';
import { GibInvoiceModal } from './components/GibInvoiceModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('admin');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('company');
  const [eDocSubTab, setEDocSubTab] =
    useState<EDocumentSubTab>('outgoing_efatura');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [orders, setOrders] = useState<MarketplaceOrder[]>(INITIAL_ORDERS);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingEInvoice[]>(
    INITIAL_INCOMING_EINVOICES
  );
  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_RULES);
  const [users, setUsers] = useState<PlatformUser[]>(INITIAL_USERS);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    INITIAL_USERS[0].id
  );
  const [integrations, setIntegrations] =
    useState<MarketplaceIntegration[]>(INITIAL_INTEGRATIONS);
  const [systemSettings, setSystemSettings] = useState<SystemPlatformSettings>(
    INITIAL_SYSTEM_SETTINGS
  );
  const [companyProfiles, setCompanyProfiles] = useState<
    Record<string, CompanyProfile>
  >(INITIAL_COMPANY_PROFILES);
  const [appOwnerProfile, setAppOwnerProfile] = useState<AppOwnerProfile>(
    INITIAL_APP_OWNER_PROFILE
  );
  const [smmmProfile, setSmmmProfile] = useState<SmmmProfile>(
    INITIAL_SMMM_PROFILE
  );
  const [taxCalendar, setTaxCalendar] = useState<TaxCalendarItem[]>(
    INITIAL_TAX_CALENDAR
  );
  const [auditLogs, setAuditLogs] =
    useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [invoiceSequence, setInvoiceSequence] = useState<number>(1481);
  const [previewOrder, setPreviewOrder] = useState<MarketplaceOrder | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [, setLastSavedTimestamp] = useState<string>('10:50');

  const appendAuditLog = (
    category: AuditActionCategory,
    summary: string,
    targetReference: string,
    status: 'SUCCESS' | 'WARNING' = 'SUCCESS',
    actorName = 'Kaan Özdemir (Admin)'
  ) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      timestamp: '2026-11-05 10:55',
      actorName,
      actorRole: 'ADMIN',
      category,
      summary,
      targetReference,
      status,
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const handleSaveAllModules = (sourceModuleName?: string) => {
    setHasUnsavedChanges(false);
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    setLastSavedTimestamp(now);
    const target = sourceModuleName || 'Tüm modül ve alt modül';
    setBannerMessage({
      type: 'success',
      text: `${target} verileri, kullanıcı kayıtları ve sistem ayarları kalıcı olarak başarıyla kaydedildi. (${now})`,
    });
    appendAuditLog(
      'SISTEM_AYARI',
      `${target} verileri admin tarafından kalıcı olarak doğrulandı ve kaydedildi.`,
      'SISTEM-KAYIT',
      'SUCCESS'
    );
  };

  const seriesMap = useMemo(() => {
    const map: Partial<Record<MarketplaceId, string>> = {};
    for (const integ of integrations) {
      map[integ.id] = integ.invoiceSeriesPrefix;
    }
    return map;
  }, [integrations]);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.invoiceStatus === 'PENDING').length,
    [orders]
  );

  const errorOrderCount = useMemo(
    () => orders.filter((o) => o.invoiceStatus === 'ERROR_TAX_ID').length,
    [orders]
  );

  const activeRulesCount = useMemo(
    () => rules.filter((r) => r.isActive).length,
    [rules]
  );

  const connectedStoresCount = useMemo(
    () => integrations.filter((i) => i.apiStatus === 'CONNECTED').length,
    [integrations]
  );

  const { outgoingEFaturaCount, outgoingEArsivCount } = useMemo(() => {
    let efatura = 0;
    let earsiv = 0;
    for (const o of orders) {
      const { documentType } = determineDocumentType(o);
      if (documentType === 'E_FATURA') {
        efatura += 1;
      } else {
        earsiv += 1;
      }
    }
    return { outgoingEFaturaCount: efatura, outgoingEArsivCount: earsiv };
  }, [orders]);

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAllFiltered = (orderIds: string[]) => {
    const allSelected =
      orderIds.length > 0 &&
      orderIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !orderIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) =>
        Array.from(new Set([...prev, ...orderIds]))
      );
    }
  };

  const sellerForOrder = (order: MarketplaceOrder) => {
    const profile =
      (order.ownerUserId && companyProfiles[order.ownerUserId]) ||
      companyProfiles[selectedUserId];
    const user =
      users.find((item) => item.id === order.ownerUserId) ||
      users.find((item) => item.id === selectedUserId);
    return {
      taxIdentifier: profile?.taxIdentifier || user?.taxIdentifier || '',
      legalTitle: profile?.legalTitle || user?.companyName || '',
      taxOffice: profile?.taxOffice || '',
      city: profile?.city || '',
      district: profile?.district || '',
      addressLine: profile?.addressLine || '',
    };
  };

  const pushOrderToMysoft = async (
    order: MarketplaceOrder,
    allowDefaultTckn: boolean
  ) => {
    const validation = validateTurkishTaxIdentifier(
      order.taxIdentifier,
      order.customerType,
      allowDefaultTckn
    );
    if (!validation.valid) {
      return {
        success: false as const,
        error: validation.error,
        order: {
          ...order,
          invoiceStatus: 'ERROR_TAX_ID' as const,
          invoiceErrorReason: validation.error,
        },
      };
    }
    const ready: MarketplaceOrder = {
      ...order,
      taxIdentifier: validation.normalizedId,
    };
    try {
      const result = await issueMysoftInvoice({
        order: ready,
        seller: sellerForOrder(ready),
        preferredScenario: 'TICARIFATURA',
        eInvoicePrefix: systemSettings.eInvoicePrefix,
        eArchivePrefix: systemSettings.eArchivePrefix,
      });
      const invoicedAt = new Date()
        .toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul', hour12: false })
        .slice(0, 16);
      return {
        success: true as const,
        order: {
          ...ready,
          invoiceStatus: 'INVOICED' as const,
          invoiceErrorReason: undefined,
          gibInvoiceNumber: result.docNo || undefined,
          ettn: result.ettn || undefined,
          documentType: result.documentType,
          scenario: result.scenario,
          invoicedAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mysoft faturayı kabul etmedi.';
      return {
        success: false as const,
        error: message,
        order: {
          ...ready,
          invoiceStatus: 'PENDING' as const,
          invoiceErrorReason: message,
        },
      };
    }
  };

  const handleIssueSingleInvoice = (
    orderId: string,
    allowDefaultTckn = false
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    if (systemSettings.primaryGibIntegrator === 'MYSOFT') {
      void pushOrderToMysoft(target, allowDefaultTckn).then((result) => {
        setOrders((prev) => prev.map((order) => (order.id === orderId ? result.order : order)));
        if (result.success) {
          setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
          const gibNo = result.order.gibInvoiceNumber || result.order.ettn || 'Mysoft';
          setBannerMessage({
            type: 'success',
            text: `#${target.marketplaceOrderNumber} siparişi Mysoft'a iletildi (${gibNo}).`,
          });
          appendAuditLog(
            'FATURA_KESIMI',
            `#${target.marketplaceOrderNumber} (${target.customerName}) Mysoft'a gönderildi.`,
            gibNo,
            'SUCCESS'
          );
        } else {
          setBannerMessage({
            type: 'warning',
            text: `#${target.marketplaceOrderNumber} faturası kesilemedi: ${result.error}`,
          });
          appendAuditLog(
            'FATURA_KESIMI',
            `#${target.marketplaceOrderNumber} Mysoft gönderimi durdu: ${result.error}`,
            `#${target.marketplaceOrderNumber}`,
            'WARNING'
          );
        }
      });
      return;
    }

    const { documentType } = determineDocumentType(target);
    const prefix = getIntegratorPrefixForDocument(documentType, systemSettings);
    const result = issueInvoiceForOrder(target, invoiceSequence, prefix, {
      allowDefaultTcknFallback: allowDefaultTckn,
    });

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? result.updatedOrder : o))
    );

    if (result.success) {
      setInvoiceSequence((seq) => seq + 1);
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
      const gibNo = result.updatedOrder.gibInvoiceNumber ?? 'GIB';

      setBannerMessage({
        type: 'success',
        text: `#${target.marketplaceOrderNumber} siparişi için ${gibNo} numaralı resmi e-Belge oluşturuldu.`,
      });
      appendAuditLog(
        'FATURA_KESIMI',
        `#${target.marketplaceOrderNumber} (${target.customerName}) siparişi için ${gibNo} e-Belgesi GİB üzerinden onaylandı.`,
        gibNo,
        'SUCCESS'
      );
    } else {
      setBannerMessage({
        type: 'warning',
        text: `#${target.marketplaceOrderNumber} faturası kesilemedi: ${result.error}`,
      });
      appendAuditLog(
        'FATURA_KESIMI',
        `#${target.marketplaceOrderNumber} faturası VKN/TCKN hatası nedeniyle duraklatıldı.`,
        `#${target.marketplaceOrderNumber}`,
        'WARNING'
      );
    }
  };

  const handleIssueSelectedInvoices = () => {
    if (selectedOrderIds.length === 0) return;

    if (systemSettings.primaryGibIntegrator === 'MYSOFT') {
      void (async () => {
        let successCount = 0;
        let failCount = 0;
        const next = orders.map((order) => ({ ...order }));
        for (const id of selectedOrderIds) {
          const index = next.findIndex((order) => order.id === id);
          if (index < 0 || next[index].invoiceStatus === 'INVOICED') continue;
          const result = await pushOrderToMysoft(next[index], true);
          next[index] = result.order;
          if (result.success) successCount += 1;
          else failCount += 1;
        }
        setOrders(next);
        setSelectedOrderIds([]);
        setBannerMessage({
          type: successCount > 0 ? 'success' : 'warning',
          text: `Mysoft toplu kesim: ${successCount} belge iletildi${
            failCount > 0 ? `, ${failCount} sipariş gönderilemedi.` : '.'
          }`,
        });
        appendAuditLog(
          'FATURA_KESIMI',
          `Seçili siparişler Mysoft'a gönderildi (${successCount} başarılı).`,
          `TOPLU-${successCount}`,
          successCount > 0 ? 'SUCCESS' : 'WARNING'
        );
      })();
      return;
    }

    let currentSeq = invoiceSequence;
    let successCount = 0;
    let failCount = 0;

    const nextOrders = orders.map((order) => {
      if (
        !selectedOrderIds.includes(order.id) ||
        order.invoiceStatus === 'INVOICED'
      ) {
        return order;
      }
      const { documentType } = determineDocumentType(order);
      const prefix = getIntegratorPrefixForDocument(documentType, systemSettings);
      const res = issueInvoiceForOrder(order, currentSeq, prefix, {
        allowDefaultTcknFallback: true,
      });
      if (res.success) {
        currentSeq += 1;
        successCount += 1;
      } else {
        failCount += 1;
      }
      return res.updatedOrder;
    });

    setOrders(nextOrders);
    setInvoiceSequence(currentSeq);
    setSelectedOrderIds([]);
    setBannerMessage({
      type: successCount > 0 ? 'success' : 'warning',
      text: `Toplu faturalandırma tamamlandı: ${successCount} adet e-Belge GİB kuyruğuna iletildi${
        failCount > 0 ? `, ${failCount} sipariş VKN doğrulaması bekliyor.` : '.'
      }`,
    });
    appendAuditLog(
      'FATURA_KESIMI',
      `Seçili siparişler için toplu faturalandırma çalıştırıldı (${successCount} başarılı).`,
      `TOPLU-${successCount}`,
      successCount > 0 ? 'SUCCESS' : 'WARNING'
    );
  };

  const handleRunRulesNow = () => {
    if (systemSettings.primaryGibIntegrator === 'MYSOFT') {
      setBannerMessage({
        type: 'warning',
        text: 'Mysoft açıkken otomasyon yerel numara basmaz. Siparişi veya seçilenleri Mysoft’a gönderin.',
      });
      return { invoicedCount: 0, failedCount: 0, logs: [] as string[] };
    }
    const res = evaluateAutomationRules(
      orders,
      rules,
      invoiceSequence,
      systemSettings
    );
    setOrders(res.updatedOrders);
    setRules(res.updatedRules);
    setInvoiceSequence(res.nextSequence);
    setBannerMessage({
      type: res.invoicedCount > 0 ? 'success' : 'warning',
      text: `Otomasyon kuralları çalıştırıldı: ${res.invoicedCount} bekleyen sipariş GİB e-Belge olarak resmileştirildi.`,
    });
    appendAuditLog(
      'FATURA_KESIMI',
      `Otomasyon kural motoru ${res.invoicedCount} siparişi otomatik faturalandırdı.`,
      `OTOMASYON-${res.invoicedCount}`,
      'SUCCESS'
    );
    return {
      invoicedCount: res.invoicedCount,
      failedCount: res.failedCount,
      logs: res.logs,
    };
  };

  const handleFixOrderTaxId = (
    orderId: string,
    newTaxId: string,
    customerType: CustomerType,
    issueImmediately: boolean
  ): { success: boolean; error?: string } => {
    const validation = validateTurkishTaxIdentifier(
      newTaxId,
      customerType,
      false
    );
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const target = orders.find((o) => o.id === orderId);
    if (!target) {
      return { success: false, error: 'Sipariş bulunamadı.' };
    }

    const repairedOrder: MarketplaceOrder = {
      ...target,
      taxIdentifier: validation.normalizedId,
      customerType,
      isEFaturaRegistered: customerType === 'CORPORATE',
      invoiceStatus: 'PENDING',
      invoiceErrorReason: undefined,
    };

    if (issueImmediately) {
      const { documentType } = determineDocumentType(repairedOrder);
      const prefix = getIntegratorPrefixForDocument(documentType, systemSettings);
      const issued = issueInvoiceForOrder(
        repairedOrder,
        invoiceSequence,
        prefix
      );
      if (!issued.success) {
        return { success: false, error: issued.error };
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? issued.updatedOrder : o))
      );
      setInvoiceSequence((seq) => seq + 1);
      setBannerMessage({
        type: 'success',
        text: `#${target.marketplaceOrderNumber} vergi kimlik bilgisi (${validation.normalizedId}) doğrulandı ve ${issued.updatedOrder.gibInvoiceNumber} numaralı e-Belge kesildi.`,
      });
      appendAuditLog(
        'FATURA_KESIMI',
        `#${target.marketplaceOrderNumber} vergi kimlik numarası düzeltildi ve ${issued.updatedOrder.gibInvoiceNumber} kesildi.`,
        issued.updatedOrder.gibInvoiceNumber ?? target.marketplaceOrderNumber,
        'SUCCESS'
      );
      return { success: true };
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? repairedOrder : o))
    );
    return { success: true };
  };

  const handleCreateManualOrder = (newOrder: MarketplaceOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    setBannerMessage({
      type: 'success',
      text: `#${newOrder.marketplaceOrderNumber} numaralı yeni sipariş fatura kuyruğuna eklendi.`,
    });
  };

  const handleCancelEArchiveInvoice = (orderId: string, reason: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const markCancelled = () => {
      const cancelledAt = new Date()
        .toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul', hour12: false })
        .slice(0, 16);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                isCancelled: true,
                cancelledAt,
                cancelReason: reason,
              }
            : o
        )
      );
      setBannerMessage({
        type: 'warning',
        text: `${target.gibInvoiceNumber || target.marketplaceOrderNumber} numaralı Giden e-Arşiv faturası iptal edildi (${reason}).`,
      });
      appendAuditLog(
        'FATURA_KESIMI',
        `${target.gibInvoiceNumber || target.marketplaceOrderNumber} numaralı e-Arşiv faturası iptal edildi: ${reason}`,
        target.gibInvoiceNumber || target.marketplaceOrderNumber,
        'WARNING'
      );
    };
    if (systemSettings.primaryGibIntegrator !== 'MYSOFT') {
      markCancelled();
      return;
    }
    if (!target.ettn) {
      setBannerMessage({
        type: 'warning',
        text: `#${target.marketplaceOrderNumber} faturasında Mysoft ETTN yok, iptal gönderilmedi.`,
      });
      return;
    }
    void cancelMysoftArchive({
      ettn: target.ettn,
      cancelNote: reason,
      tenantIdentifierNumber: sellerForOrder(target).taxIdentifier,
    })
      .then(markCancelled)
      .catch((error: unknown) => {
        const message = error instanceof MysoftClientError ? error.message : 'Mysoft iptali başarısız.';
        setBannerMessage({
          type: 'warning',
          text: `${target.gibInvoiceNumber || target.marketplaceOrderNumber} iptal edilemedi: ${message}`,
        });
      });
  };

  const handleRespondIncomingInvoice = (
    invoiceId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    reason?: string
  ) => {
    const target = incomingInvoices.find((inv) => inv.id === invoiceId);
    if (!target) return;
    setIncomingInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              responseStatus: decision,
              responseAt: '2026-11-05 10:22',
              rejectionReason: decision === 'REJECTED' ? reason : undefined,
            }
          : inv
      )
    );
    setBannerMessage({
      type: decision === 'ACCEPTED' ? 'success' : 'warning',
      text: `${target.supplierTitle} (${target.invoiceNumber}) Gelen Ticari e-Faturası için GİB üzerinden "${
        decision === 'ACCEPTED' ? 'KABUL' : 'RED'
      }" Uygulama Yanıtı gönderildi.`,
    });
    appendAuditLog(
      'FATURA_KESIMI',
      `Gelen e-Fatura (${target.invoiceNumber} - ${target.supplierTitle}) için GİB ${
        decision === 'ACCEPTED' ? 'KABUL' : 'RED'
      } Uygulama Yanıtı iletildi.`,
      target.invoiceNumber,
      decision === 'ACCEPTED' ? 'SUCCESS' : 'WARNING'
    );
  };

  const handleCreateIncomingInvoice = (newInv: IncomingEInvoice) => {
    setIncomingInvoices((prev) => [newInv, ...prev]);
    setBannerMessage({
      type: 'success',
      text: `${newInv.supplierTitle} tedarikçisine ait ${newInv.invoiceNumber} numaralı Gelen e-Fatura kaydedildi.`,
    });
    appendAuditLog(
      'FATURA_KESIMI',
      `${newInv.supplierTitle} (${newInv.invoiceNumber}) Gelen e-Fatura kutusuna eklendi.`,
      newInv.invoiceNumber,
      'SUCCESS'
    );
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleAddRule = (
    newRule: Omit<AutomationRule, 'id' | 'processedCount' | 'lastTriggeredAt'>
  ) => {
    const created: AutomationRule = {
      ...newRule,
      id: `rule-${Date.now()}`,
      processedCount: 0,
      lastTriggeredAt: 'Henüz çalışmadı',
    };
    setRules((prev) => [created, ...prev]);
  };

  const handleCreateUser = (input: {
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    companyName: string;
    taxIdentifier: string;
    eInvoiceIntegrator: EInvoiceIntegrator;
  }) => {
    const res = validateAndCreatePlatformUser(input, users);
    if (res.valid && res.user) {
      setUsers((prev) => [...prev, res.user!]);
      setSelectedUserId(res.user.id);
      setHasUnsavedChanges(true);
      setBannerMessage({
        type: 'success',
        text: `${res.user.fullName} (${res.user.companyName}) sisteme eklendi. Değişiklikleri tüm modüllere uygulamak ve kalıcı kaydetmek için 'Kaydet' butonuna tıklayınız.`,
      });
      appendAuditLog(
        'KULLANICI_YETKI',
        `${res.user.fullName} (${res.user.companyName}) yeni mükellef/kullanıcı olarak tanımlandı (1.000 Kontör).`,
        `VKN:${res.user.taxIdentifier}`,
        'SUCCESS'
      );
    }
    return res;
  };

  const handleUpdateCompanyProfile = (
    userId: string,
    updated: CompanyProfile
  ) => {
    setCompanyProfiles((prev) => ({
      ...prev,
      [userId]: {
        ...updated,
        updatedAt: '2026-11-04 16:55',
      },
    }));
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              companyName: updated.legalTitle || u.companyName,
              taxIdentifier: updated.taxIdentifier || u.taxIdentifier,
              eInvoiceIntegrator:
                updated.integrator || u.eInvoiceIntegrator,
            }
          : u
      )
    );
    setBannerMessage({
      type: 'success',
      text: `${updated.legalTitle} resmi firma ve şirket bilgileri başarıyla kaydedildi.`,
    });
    appendAuditLog(
      'SISTEM_AYARI',
      `${updated.legalTitle} resmi ticaret unvanı, VKN (${updated.taxIdentifier}) ve GİB sicili güncellendi.`,
      `VKN:${updated.taxIdentifier}`,
      'SUCCESS'
    );
  };

  const handleConnectMarketplaceToUser = (
    userId: string,
    input: {
      marketplace: MarketplaceId;
      storeName: string;
      sellerId: string;
      apiKey: string;
      apiSecret: string;
      invoiceSeriesPrefix: string;
      defaultCommissionRate: number;
      autoSyncIntervalMinutes: number;
      webhookEnabled: boolean;
    }
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return { valid: false, error: 'Kullanıcı bulunamadı.' };
    }

    const res = validateAndConnectUserMarketplace(targetUser, input);
    if (res.valid && res.updatedUser && res.integrationCard) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? res.updatedUser! : u))
      );
      setIntegrations((prev) => [res.integrationCard!, ...prev]);
      setBannerMessage({
        type: 'success',
        text: `${targetUser.fullName} kullanıcısı için ${res.integrationCard.name} (${res.integrationCard.storeName}) mağazası başarıyla entegre edildi.`,
      });
      appendAuditLog(
        'PAZARYERI_API',
        `${targetUser.fullName} hesabına ${res.integrationCard.name} (${res.integrationCard.storeName}) mağazası entegre edildi.`,
        res.integrationCard.sellerId,
        'SUCCESS'
      );
    }
    return { valid: res.valid, error: res.error };
  };

  const handleRemoveUserMarketplace = (
    userId: string,
    credentialId: string
  ) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              integratedMarketplaces: u.integratedMarketplaces.filter(
                (m) => m.id !== credentialId
              ),
            }
          : u
      )
    );
    setIntegrations((prev) =>
      prev.filter((i) => i.integrationRecordId !== credentialId)
    );
    setBannerMessage({
      type: 'warning',
      text: 'Pazaryeri mağaza API bağlantısı kullanıcı hesabından kaldırıldı.',
    });
    appendAuditLog(
      'PAZARYERI_API',
      'Kullanıcı pazaryeri API mağaza bağlantısı kaldırıldı.',
      credentialId,
      'WARNING'
    );
  };

  const handleAddUserCredits = (userId: string, amount: number) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? allocateUserInvoiceCredits(u, amount) : u
      )
    );
    setBannerMessage({
      type: 'success',
      text: `${target.fullName} (${target.companyName}) hesabına +${amount.toLocaleString('tr-TR')} e-Belge kontörü yüklendi.`,
    });
    appendAuditLog(
      'KULLANICI_YETKI',
      `${target.fullName} hesabına +${amount.toLocaleString('tr-TR')} adet GİB e-Belge kontörü tahsis edildi.`,
      `KONTOR-${amount}`,
      'SUCCESS'
    );
  };

  const handleToggleUserActive = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const nextState = !target.isActive;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? toggleUserAccountStatus(u) : u))
    );
    setBannerMessage({
      type: nextState ? 'success' : 'warning',
      text: `${target.fullName} kullanıcı hesabı ${
        nextState ? 'aktifleştirildi' : 'askıya alındı'
      }.`,
    });
    appendAuditLog(
      'KULLANICI_YETKI',
      `${target.fullName} kullanıcı durumu "${nextState ? 'Aktif' : 'Askıda'}" olarak güncellendi.`,
      target.taxIdentifier,
      nextState ? 'SUCCESS' : 'WARNING'
    );
  };

  const handleChangeUserRole = (userId: string, newRole: UserRole) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    appendAuditLog(
      'KULLANICI_YETKI',
      `${target.fullName} kullanıcısının yetki rolü ${newRole} olarak değiştirildi.`,
      target.id,
      'SUCCESS'
    );
  };

  const handleDeleteUser = (userId: string) => {
    const res = deletePlatformUser(users, userId);
    if (!res.success || !res.deletedUser) {
      setBannerMessage({
        type: 'warning',
        text: res.error || 'Kullanıcı silinemedi.',
      });
      return { success: false, error: res.error };
    }

    const deleted = res.deletedUser;
    setUsers(res.remainingUsers);

    // Remove user's integrated marketplace connections
    setIntegrations((prev) => prev.filter((i) => i.ownerUserId !== userId));

    // Remove company profile if exists
    setCompanyProfiles((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    // Update selectedUserId
    if (selectedUserId === userId) {
      if (res.remainingUsers.length > 0) {
        setSelectedUserId(res.remainingUsers[0].id);
      } else {
        setSelectedUserId('');
      }
    }

    setHasUnsavedChanges(true);
    setBannerMessage({
      type: 'success',
      text: `"${deleted.fullName}" kullanıcısı ve "${deleted.companyName}" şirket unvanı sistemden silindi. Değişiklikleri tüm modüllere işlemek için 'Kaydet' butonuna basınız.`,
    });

    appendAuditLog(
      'KULLANICI_YETKI',
      `"${deleted.fullName}" kullanıcısı ve "${deleted.companyName}" şirket unvanı (VKN/TCKN: ${deleted.taxIdentifier}) sistemden kalıcı olarak silindi.`,
      `SILINDI-${deleted.taxIdentifier}`,
      'SUCCESS'
    );

    return { success: true };
  };

  const handleBatchRepairIndividualOrders = () => {
    let currentSeq = invoiceSequence;
    let repairedCount = 0;

    const nextOrders = orders.map((order) => {
      if (
        order.invoiceStatus === 'ERROR_TAX_ID' &&
        order.customerType === 'INDIVIDUAL'
      ) {
        const { documentType } = determineDocumentType(order);
        const prefix = getIntegratorPrefixForDocument(documentType, systemSettings);
        const res = issueInvoiceForOrder(order, currentSeq, prefix, {
          allowDefaultTcknFallback: true,
        });
        if (res.success) {
          currentSeq += 1;
          repairedCount += 1;
          return res.updatedOrder;
        }
      }
      return order;
    });

    setOrders(nextOrders);
    setInvoiceSequence(currentSeq);
    setBannerMessage({
      type: repairedCount > 0 ? 'success' : 'warning',
      text:
        repairedCount > 0
          ? `Admin toplu onarım tamamlandı: ${repairedCount} eksik TCKN'li bireysel siparişe 11111111111 atandı ve faturalandırıldı.`
          : 'Onarılacak eksik TCKN bireysel sipariş bulunamadı.',
    });
    if (repairedCount > 0) {
      appendAuditLog(
        'SISTEM_AYARI',
        `Admin bakım aracı ile ${repairedCount} eksik TCKN'li bireysel sipariş 11111111111 atanarak faturalandırıldı.`,
        `ONARIM-${repairedCount}`,
        'SUCCESS'
      );
    }
    return { repairedAndInvoicedCount: repairedCount };
  };

  const handleSyncMarketplace = (
    target: MarketplaceId | 'ALL',
    customStoreName?: string
  ) => {
    const targetMp: MarketplaceId =
      target === 'ALL' ? 'trendyol' : target;
    const syncedOrderNo = `${Math.floor(9500000000 + Math.random() * 499999999)}`;

    const syncedOrder: MarketplaceOrder = {
      id: `ord-sync-${Date.now()}`,
      marketplaceOrderNumber: syncedOrderNo,
      marketplace: targetMp,
      storeName:
        customStoreName ??
        integrations.find((i) => i.id === targetMp)?.storeName ??
        'Anadolu Dijital Resmi Mağaza',
      orderDate: '2026-11-04 16:28',
      fulfillmentStage: 'KARGOYA_VERILDI',
      customerName: 'Hakan Çelikkol',
      customerType: 'INDIVIDUAL',
      taxIdentifier: '29481029384',
      city: 'İstanbul',
      district: 'Beşiktaş',
      address: 'Levent Mah. Nispetiye Cad. No: 34 D: 8',
      email: 'hakan.celikkol@ornekmail.com',
      isEFaturaRegistered: false,
      items: [
        {
          id: `li-sync-${Date.now()}`,
          sku: 'TP-AX55-WIFI6',
          title: 'TP-Link Archer AX55 AX3000 Dual-Band Gigabit Wi-Fi 6 Router',
          quantity: 1,
          unitPriceVatIncluded: 2640,
          vatRate: 20,
        },
      ],
      shippingFeeVatIncluded: 59.9,
      includeShippingInInvoice: true,
      sellerDiscountTotal: 0,
      marketplaceCommissionRate: 15.0,
      withholdingRate: systemSettings.defaultWithholdingRate,
      invoiceStatus: 'PENDING',
      cargoTrackingCode: `SYNC-${Math.floor(100000 + Math.random() * 899999)}`,
      cargoCarrier: 'Trendyol Express',
    };

    setOrders((prev) => [syncedOrder, ...prev]);
    setIntegrations((prev) =>
      prev.map((integ) =>
        target === 'ALL' || integ.id === target
          ? {
              ...integ,
              apiStatus: 'CONNECTED',
              lastSyncAt: '2026-11-04 16:28',
              pendingOrderCount: integ.pendingOrderCount + 1,
            }
          : integ
      )
    );

    const msg = `Pazaryeri API senkronizasyonu tamamlandı: #${syncedOrderNo} numaralı yeni sipariş kuyruğa aktarıldı.`;
    setBannerMessage({ type: 'success', text: msg });
    appendAuditLog(
      'PAZARYERI_API',
      `${targetMp.toUpperCase()} mağazasından #${syncedOrderNo} siparişi senkronize edildi.`,
      `#${syncedOrderNo}`,
      'SUCCESS'
    );
    return { pulledCount: 1, message: msg };
  };

  const handleUpdateIntegration = (
    id: MarketplaceId,
    updates: {
      storeName: string;
      sellerId: string;
      invoiceSeriesPrefix: string;
      defaultCommissionRate: number;
      autoSyncIntervalMinutes: number;
    },
    integrationRecordId?: string
  ) => {
    setIntegrations((prev) =>
      prev.map((integ) =>
        (integrationRecordId &&
          integ.integrationRecordId === integrationRecordId) ||
        (!integrationRecordId && integ.id === id)
          ? {
              ...integ,
              ...updates,
              apiStatus: 'CONNECTED',
            }
          : integ
      )
    );

    if (integrationRecordId) {
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          integratedMarketplaces: u.integratedMarketplaces.map((cred) =>
            cred.id === integrationRecordId
              ? {
                  ...cred,
                  storeName: updates.storeName,
                  sellerId: updates.sellerId,
                  invoiceSeriesPrefix: updates.invoiceSeriesPrefix,
                  defaultCommissionRate: updates.defaultCommissionRate,
                  autoSyncIntervalMinutes: updates.autoSyncIntervalMinutes,
                  apiStatus: 'CONNECTED',
                }
              : cred
          ),
        }))
      );
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F3F6FA] text-slate-900">
      {/* Left Full-Height Dark Navy Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        adminSubTab={adminSubTab}
        onSelectAdminSubTab={setAdminSubTab}
        eDocSubTab={eDocSubTab}
        onSelectEDocSubTab={setEDocSubTab}
        outgoingEFaturaCount={outgoingEFaturaCount}
        outgoingEArsivCount={outgoingEArsivCount}
        incomingEFaturaCount={incomingInvoices.length}
        appOwnerProfile={appOwnerProfile}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        pendingCount={pendingCount}
        errorOrderCount={errorOrderCount}
        activeRulesCount={activeRulesCount}
        connectedStoresCount={connectedStoresCount}
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        onQuickAddCredits={handleAddUserCredits}
        onQuickSyncMarketplace={(mp, storeName) =>
          handleSyncMarketplace(mp, storeName)
        }
        systemSettings={systemSettings}
      />

      {/* Right Workspace Column: TopBar Card + Notification Banner + Main Content + Footer */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onBatchInvoiceAction={handleRunRulesNow}
          pendingCount={pendingCount}
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          onSaveAllModules={handleSaveAllModules}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Global Action Notification Banner */}
        {bannerMessage && (
          <div className="w-full max-w-[1440px] mx-auto px-6 pt-3">
            <div
              role="status"
              className={`rounded-xl border px-5 py-3 text-xs font-medium flex items-center justify-between gap-4 shadow-2xs ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {bannerMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{bannerMessage.text}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {hasUnsavedChanges && (
                  <button
                    type="button"
                    onClick={() => handleSaveAllModules()}
                    className="px-3 py-1 text-xs font-semibold text-white bg-[#0077CC] hover:bg-[#0B5FA5] rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Şimdi Kaydet
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBannerMessage(null)}
                  aria-label="Bildirimi kapat"
                  className="text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Container */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-5">
            {activeTab === 'app_owner' && (
              <AppOwnerProfileView
                appOwnerProfile={appOwnerProfile}
                onUpdateAppOwnerProfile={(updated) => {
                  setAppOwnerProfile({
                    ...updated,
                    updatedAt: '2026-11-05 10:50',
                  });
                  setBannerMessage({
                    type: 'success',
                    text: `${updated.legalTitle} (${updated.ownerFullName}) uygulama sahibi resmi sicil ve şirket bilgileri kaydedildi.`,
                  });
                  appendAuditLog(
                    'SISTEM_AYARI',
                    `Uygulama sahibi resmi sicil bilgileri (${updated.ownerFullName} - ${updated.legalTitle}) güncellendi.`,
                    `VKN:${updated.taxIdentifier}`,
                    'SUCCESS'
                  );
                }}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersQueueView
                orders={orders}
                selectedOrderIds={selectedOrderIds}
                onToggleSelectOrder={handleToggleSelectOrder}
                onSelectAllFiltered={handleSelectAllFiltered}
                onIssueSingleInvoice={handleIssueSingleInvoice}
                onIssueSelectedInvoices={handleIssueSelectedInvoices}
                onFixOrderTaxId={handleFixOrderTaxId}
                onPreviewInvoice={(order) => setPreviewOrder(order)}
                onCreateManualOrder={handleCreateManualOrder}
                onBatchInvoiceAction={handleRunRulesNow}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}

            {activeTab === 'reconciliation' && (
              <TaxReconciliationView
                orders={orders}
                integrations={integrations}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}

            {activeTab === 'accountant' && (
              <AccountantModuleView
                users={users}
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
                orders={orders}
                incomingInvoices={incomingInvoices}
                integrations={integrations}
                companyProfiles={Object.values(companyProfiles)}
                smmmProfile={smmmProfile}
                onUpdateSmmmProfile={(updated) => {
                  setSmmmProfile(updated);
                  appendAuditLog(
                    'SISTEM_AYARI',
                    `Mali Müşavir (${updated.fullName}) e-Birlik ve sicil bilgileri güncellendi.`,
                    updated.taxIdentifier,
                    'SUCCESS'
                  );
                }}
                taxCalendar={taxCalendar}
                onUpdateTaxCalendar={(updated) => {
                  setTaxCalendar(updated);
                  appendAuditLog(
                    'SISTEM_AYARI',
                    'Mali takvim beyanname kontrol durumları güncellendi.',
                    'GIB-TAKVIM',
                    'SUCCESS'
                  );
                }}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}

            {activeTab === 'edocument' && (
              <EDocumentModuleView
                activeSubTab={eDocSubTab}
                onSelectSubTab={setEDocSubTab}
                orders={orders}
                incomingInvoices={incomingInvoices}
                systemSettings={systemSettings}
                tenantIdentifierNumber={companyProfiles[selectedUserId]?.taxIdentifier}
                onUpdateSystemSettings={(next) => {
                  setSystemSettings(next);
                  appendAuditLog(
                    'SISTEM_AYARI',
                    `GİB çalışma modu (${next.environmentMode}) ve seri ön ekleri (${next.eInvoicePrefix}/${next.eArchivePrefix}) güncellendi.`,
                    next.primaryGibIntegrator,
                    'SUCCESS'
                  );
                }}
                onPreviewInvoice={(order) => setPreviewOrder(order)}
                onIssueSingleInvoice={handleIssueSingleInvoice}
                onFixOrderTaxId={handleFixOrderTaxId}
                onCancelEArchiveInvoice={handleCancelEArchiveInvoice}
                onBatchRepairIndividualOrders={handleBatchRepairIndividualOrders}
                onRespondIncomingInvoice={handleRespondIncomingInvoice}
                onCreateIncomingInvoice={handleCreateIncomingInvoice}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}

            {(activeTab === 'admin' ||
              activeTab === 'company' ||
              activeTab === 'edoc_settings' ||
              activeTab === 'marketplaces' ||
              activeTab === 'users' ||
              activeTab === 'rules') && (
              <AdminPanelView
                users={users}
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
                onCreateUser={handleCreateUser}
                onConnectMarketplaceToUser={handleConnectMarketplaceToUser}
                onRemoveUserMarketplace={handleRemoveUserMarketplace}
                onSyncUserMarketplace={(mp, store) => {
                  handleSyncMarketplace(mp, store);
                }}
                onAddUserCredits={handleAddUserCredits}
                onToggleUserActive={handleToggleUserActive}
                onChangeUserRole={handleChangeUserRole}
                onDeleteUser={handleDeleteUser}
                systemSettings={systemSettings}
                onUpdateSystemSettings={(next) => {
                  setSystemSettings(next);
                  appendAuditLog(
                    'SISTEM_AYARI',
                    `GİB çalışma modu (${next.environmentMode}) ve stopaj oranı (%${next.defaultWithholdingRate}) güncellendi.`,
                    next.primaryGibIntegrator,
                    'SUCCESS'
                  );
                }}
                onBatchRepairIndividualOrders={handleBatchRepairIndividualOrders}
                auditLogs={auditLogs}
                errorOrderCount={errorOrderCount}
                integrations={integrations}
                onSyncMarketplace={handleSyncMarketplace}
                onUpdateIntegration={handleUpdateIntegration}
                companyProfiles={companyProfiles}
                onUpdateCompanyProfile={handleUpdateCompanyProfile}
                rules={rules}
                onToggleRule={handleToggleRule}
                onDeleteRule={handleDeleteRule}
                onAddRule={handleAddRule}
                onRunRulesNow={handleRunRulesNow}
                activeSubTab={
                  activeTab === 'company'
                    ? 'company'
                    : activeTab === 'edoc_settings'
                    ? 'edoc_settings'
                    : activeTab === 'marketplaces'
                    ? 'marketplaces'
                    : activeTab === 'users'
                    ? 'users'
                    : activeTab === 'rules'
                    ? 'rules'
                    : adminSubTab
                }
                onSelectSubTab={setAdminSubTab}
                onSaveAllModules={handleSaveAllModules}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            )}
        </main>

        {/* Quiet Footer */}
        <footer className="border-t border-slate-200/80 bg-white/80 px-6 py-4 text-xs text-slate-500">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/IMG_8742_f9314dc3.jpeg"
                alt="Faturansit"
                className="h-6 w-auto object-contain rounded"
              />
              <span className="text-slate-700 font-medium">
                Faturansit · Muavin Ön Muhasebe, Pazaryeri e-Fatura ve e-Arşiv Otomasyon Platformu (GİB UBL-TR 2.1)
              </span>
            </div>
            <span className="text-slate-600 font-mono">
              {appOwnerProfile.legalTitle} · VKN: {appOwnerProfile.taxIdentifier}
            </span>
          </div>
        </footer>
      </div>

      {/* GİB Official e-Belge Preview & UBL-TR 2.1 XML Modal */}
      <GibInvoiceModal
        order={previewOrder}
        tenantIdentifierNumber={
          previewOrder
            ? companyProfiles[previewOrder.ownerUserId || selectedUserId]?.taxIdentifier
            : undefined
        }
        onClose={() => setPreviewOrder(null)}
      />
    </div>
  );
}
