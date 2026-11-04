/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPANY_PROFILES,
  INITIAL_INTEGRATIONS,
  INITIAL_ORDERS,
  INITIAL_RULES,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_USERS,
} from './data/seedData';
import {
  AuditActionCategory,
  AuditLogEntry,
  AutomationRule,
  CompanyProfile,
  CustomerType,
  EInvoiceIntegrator,
  MarketplaceId,
  MarketplaceIntegration,
  MarketplaceOrder,
  PlatformUser,
  SystemPlatformSettings,
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
import { ActiveTab, TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { OrdersQueueView } from './components/OrdersQueueView';
import { AdminPanelView, AdminSubTab } from './components/AdminPanelView';
import { CompanyProfileView } from './components/CompanyProfileView';
import { TaxReconciliationView } from './components/TaxReconciliationView';
import { GibInvoiceModal } from './components/GibInvoiceModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('admin');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('company');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [orders, setOrders] = useState<MarketplaceOrder[]>(INITIAL_ORDERS);
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
  const [auditLogs, setAuditLogs] =
    useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [invoiceSequence, setInvoiceSequence] = useState<number>(1481);
  const [previewOrder, setPreviewOrder] = useState<MarketplaceOrder | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);

  const appendAuditLog = (
    category: AuditActionCategory,
    summary: string,
    targetReference: string,
    status: 'SUCCESS' | 'WARNING' = 'SUCCESS',
    actorName = 'Kaan Özdemir (Admin)'
  ) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      timestamp: '2026-11-04 16:55',
      actorName,
      actorRole: 'ADMIN',
      category,
      summary,
      targetReference,
      status,
    };
    setAuditLogs((prev) => [entry, ...prev]);
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

  const handleIssueSingleInvoice = (
    orderId: string,
    allowDefaultTckn = false
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

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
        text: `#${target.marketplaceOrderNumber} siparişi için ${gibNo} numaralı resmi GİB e-Belgesi oluşturuldu.`,
      });
      appendAuditLog(
        'FATURA_KESIMI',
        `#${target.marketplaceOrderNumber} (${target.customerName}) siparişi için ${gibNo} e-Belgesi onaylandı.`,
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
      setBannerMessage({
        type: 'success',
        text: `${res.user.fullName} (${res.user.companyName}) kullanıcı hesabı sisteme eklendi.`,
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

    setBannerMessage({
      type: 'success',
      text: `"${deleted.fullName}" kullanıcısı ve "${deleted.companyName}" şirket unvanı başarıyla silindi.`,
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onBatchInvoiceAction={handleRunRulesNow}
        pendingCount={pendingCount}
      />

      {/* Global Action Notification Banner */}
      {bannerMessage && (
        <div
          role="status"
          className={`border-b px-6 py-2.5 text-xs font-medium flex items-center justify-between gap-4 ${
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
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            aria-label="Bildirimi kapat"
            className="text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Workspace Layout: Left Sidebar + Main Content Area */}
      <div className="flex-1 flex min-h-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          adminSubTab={adminSubTab}
          onSelectAdminSubTab={setAdminSubTab}
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

        <div className="flex-1 flex flex-col min-w-0">
          {/* Main Content Container */}
          <main className="flex-1 w-full max-w-[1380px] mx-auto px-6 py-6">
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
              />
            )}

            {activeTab === 'reconciliation' && (
              <TaxReconciliationView
                orders={orders}
                integrations={integrations}
              />
            )}

            {(activeTab === 'admin' ||
              activeTab === 'company' ||
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
                    : activeTab === 'marketplaces'
                    ? 'marketplaces'
                    : activeTab === 'users'
                    ? 'users'
                    : activeTab === 'rules'
                    ? 'rules'
                    : adminSubTab
                }
                onSelectSubTab={setAdminSubTab}
              />
            )}
          </main>

          {/* Quiet Footer */}
          <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
            <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/IMG_8742_f9314dc3.jpeg"
                  alt="Faturansit"
                  className="h-6 w-auto object-contain"
                />
                <span>
                  Faturansit · Pazaryeri e-Fatura ve e-Arşiv Otomasyon Platformu (GİB UBL-TR 2.1 Uyumlu)
                </span>
              </div>
              <span>
                Anadolu Dijital Ticaret ve Lojistik A.Ş. · VKN: 3890642158
              </span>
            </div>
          </footer>
        </div>
      </div>

      {/* GİB Official e-Belge Preview & UBL-TR 2.1 XML Modal */}
      <GibInvoiceModal
        order={previewOrder}
        onClose={() => setPreviewOrder(null)}
      />
    </div>
  );
}
