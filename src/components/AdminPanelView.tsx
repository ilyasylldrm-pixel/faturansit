import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Coins,
  Settings,
  FileSearch,
  Users,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Search,
  Workflow,
  Store,
  Building2,
  Trash2,
  Save,
} from 'lucide-react';
import {
  AuditActionCategory,
  AuditLogEntry,
  AutomationRule,
  CompanyProfile,
  EInvoiceIntegrator,
  MarketplaceId,
  MarketplaceIntegration,
  PlatformUser,
  SystemPlatformSettings,
  UserRole,
} from '../types/invoicing';
import { UsersAndIntegrationsView } from './UsersAndIntegrationsView';
import { AutomationRulesView } from './AutomationRulesView';
import { MarketplacesView } from './MarketplacesView';
import { CompanyProfileView } from './CompanyProfileView';
import { MysoftIntegrationView } from './MysoftIntegrationView';
import {
  INITIAL_INCOMING_INVOICES,
  INITIAL_MYSOFT_CONFIG,
  INITIAL_MYSOFT_CREDIT_LOGS,
  INITIAL_MYSOFT_STATUS_RECORDS,
} from '../data/seedData';

export type AdminSubTab =
  | 'company'
  | 'users'
  | 'marketplaces'
  | 'settings'
  | 'rules'
  | 'audit';

interface AdminPanelViewProps {
  users: PlatformUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onCreateUser: (input: {
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    companyName: string;
    taxIdentifier: string;
    eInvoiceIntegrator: EInvoiceIntegrator;
  }) => { valid: boolean; error?: string; user?: PlatformUser };
  onConnectMarketplaceToUser: (
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
  ) => { valid: boolean; error?: string };
  onRemoveUserMarketplace: (userId: string, credentialId: string) => void;
  onSyncUserMarketplace: (marketplace: MarketplaceId, storeName: string) => void;
  onAddUserCredits: (userId: string, amount: number) => void;
  onToggleUserActive: (userId: string) => void;
  onChangeUserRole: (userId: string, newRole: UserRole) => void;
  onDeleteUser?: (userId: string) => void;
  systemSettings: SystemPlatformSettings;
  onUpdateSystemSettings: (next: SystemPlatformSettings) => void;
  onBatchRepairIndividualOrders: () => { repairedAndInvoicedCount: number };
  auditLogs: AuditLogEntry[];
  errorOrderCount: number;

  // Pazaryeri Mağazaları modülü entegrasyonu
  integrations: MarketplaceIntegration[];
  onSyncMarketplace: (id: MarketplaceId | 'ALL') => { pulledCount: number; message: string };
  onUpdateIntegration: (
    id: MarketplaceId,
    updates: {
      storeName: string;
      sellerId: string;
      invoiceSeriesPrefix: string;
      defaultCommissionRate: number;
      autoSyncIntervalMinutes: number;
    },
    integrationRecordId?: string
  ) => void;

  // Firma / Şirket Bilgileri modülü entegrasyonu
  companyProfiles?: Record<string, CompanyProfile>;
  onUpdateCompanyProfile?: (userId: string, updated: CompanyProfile) => void;

  // Otomasyon Kuralları modülü entegrasyonu
  rules: AutomationRule[];
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onAddRule: (newRule: Omit<AutomationRule, 'id' | 'processedCount' | 'lastTriggeredAt'>) => void;
  onRunRulesNow: () => { invoicedCount: number; failedCount: number; logs: string[] };
  initialSubTab?: AdminSubTab;
  activeSubTab?: AdminSubTab;
  onSelectSubTab?: (tab: AdminSubTab) => void;
}

const CATEGORY_LABELS: Record<AuditActionCategory, string> = {
  FATURA_KESIMI: 'e-Belge & Fatura',
  KULLANICI_YETKI: 'Kullanıcı & Kontör',
  PAZARYERI_API: 'Pazaryeri API',
  SISTEM_AYARI: 'Sistem & GİB Ayarı',
};

const INTEGRATOR_NAMES: Record<EInvoiceIntegrator, string> = {
  MYSOFT: 'Mysoft e-Dönüşüm (Özel Entegratör)',
  FATURANSIT: 'Faturansit Özel Entegratör',
};

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  onCreateUser,
  onConnectMarketplaceToUser,
  onRemoveUserMarketplace,
  onSyncUserMarketplace,
  onAddUserCredits,
  onToggleUserActive,
  onChangeUserRole,
  onDeleteUser,
  systemSettings,
  onUpdateSystemSettings,
  onBatchRepairIndividualOrders,
  auditLogs,
  errorOrderCount,
  integrations,
  onSyncMarketplace,
  onUpdateIntegration,
  companyProfiles,
  onUpdateCompanyProfile,
  rules,
  onToggleRule,
  onDeleteRule,
  onAddRule,
  onRunRulesNow,
  initialSubTab,
  activeSubTab,
  onSelectSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<AdminSubTab>(
    activeSubTab ?? initialSubTab ?? 'company'
  );
  const [userToDelete, setUserToDelete] = useState<PlatformUser | null>(null);

  const subTab = activeSubTab ?? internalSubTab;

  const setSubTab = (nextTab: AdminSubTab) => {
    setInternalSubTab(nextTab);
    onSelectSubTab?.(nextTab);
  };

  useEffect(() => {
    if (activeSubTab) {
      setInternalSubTab(activeSubTab);
    } else if (initialSubTab) {
      setInternalSubTab(initialSubTab);
    }
  }, [activeSubTab, initialSubTab]);

  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'ALL' | AuditActionCategory>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState<SystemPlatformSettings>(systemSettings);

  useEffect(() => {
    setSettingsDraft(systemSettings);
  }, [systemSettings]);

  const isSettingsDirty = useMemo(() => {
    return (
      settingsDraft.environmentMode !== systemSettings.environmentMode ||
      settingsDraft.primaryGibIntegrator !== systemSettings.primaryGibIntegrator ||
      settingsDraft.eInvoicePrefix !== systemSettings.eInvoicePrefix ||
      settingsDraft.eArchivePrefix !== systemSettings.eArchivePrefix ||
      settingsDraft.defaultWithholdingRate !== systemSettings.defaultWithholdingRate ||
      settingsDraft.maxRetryAttempts !== systemSettings.maxRetryAttempts ||
      settingsDraft.enforceStrictVknCheck !== systemSettings.enforceStrictVknCheck ||
      settingsDraft.defaultArchiveEmailNotification !== systemSettings.defaultArchiveEmailNotification
    );
  }, [settingsDraft, systemSettings]);

  const adminStats = useMemo(() => {
    const activeUsersCount = users.filter((u) => u.isActive).length;
    const totalCreditBalance = users.reduce(
      (sum, u) => sum + u.eInvoiceCreditBalance,
      0
    );
    const totalCreditLimit = users.reduce(
      (sum, u) => sum + u.eInvoiceCreditLimit,
      0
    );
    const totalStores = users.reduce(
      (sum, u) => sum + u.integratedMarketplaces.length,
      0
    );
    return {
      activeUsersCount,
      totalCreditBalance,
      totalCreditLimit,
      totalStores,
    };
  }, [users]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (
        auditCategoryFilter !== 'ALL' &&
        log.category !== auditCategoryFilter
      ) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase().trim();
        return (
          log.summary.toLowerCase().includes(q) ||
          log.actorName.toLowerCase().includes(q) ||
          log.targetReference.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, auditCategoryFilter, auditSearch]);

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSettingsDirty) return;
    onUpdateSystemSettings(settingsDraft);
    setSettingsSavedMsg(
      'e-Dönüşüm bilgileri ve platform faturalandırma ayarları başarıyla güncellendi.'
    );
    setTimeout(() => setSettingsSavedMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="pb-5 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500">
          Merkezi Sistem Yönetimi · Mükellef Kontör Havuzu, Pazaryeri Yetkileri ve GİB Denetim Kayıtları
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Platform Yönetim ve Denetim Paneli (Admin)
        </h1>
      </div>

      {/* 4-Column Admin KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            Aktif Mükellef & Kullanıcı
          </p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {adminStats.activeUsersCount} / {users.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Rol bazlı yetkilendirilmiş hesaplar
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            Toplam e-Belge Kontör Havuzu
          </p>
          <p
            data-testid="admin-total-credits"
            className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-1"
          >
            {adminStats.totalCreditBalance.toLocaleString('tr-TR')}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Toplam Tahsis: {adminStats.totalCreditLimit.toLocaleString('tr-TR')} Kontör
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            Kullanıcı Pazaryeri API Bağlantısı
          </p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {adminStats.totalStores}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Aktif mağaza entegrasyonu
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500">
            GİB Ağ Geçidi & Çalışma Modu
          </p>
          <p className="text-lg font-bold text-slate-900 font-mono mt-1.5">
            {systemSettings.environmentMode === 'PRODUCTION'
              ? 'CANLI (PRODUCTION)'
              : 'TEST (SANDBOX)'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {INTEGRATOR_NAMES[systemSettings.primaryGibIntegrator]}
          </p>
        </div>
      </div>

      {/* Sub-Tab 1: Users, Quota & Marketplace Integrations */}
      {subTab === 'users' && (
        <div className="space-y-6">
          {/* Admin User Quota & Permission Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Mükellef Yetki, Hesap Durumu ve e-Belge Kontör Yönetimi
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Her e-Fatura / e-Arşiv kesimi 1 kontör düşer
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">Kullanıcı & Şirket Unvanı</th>
                    <th className="py-2.5 px-3">VKN / TCKN & Entegratör</th>
                    <th className="py-2.5 px-3">Yetki Rolü</th>
                    <th className="py-2.5 px-3 text-right">e-Belge Kontör Bakiyesi</th>
                    <th className="py-2.5 px-3">Hesap Durumu</th>
                    <th className="py-2.5 px-4 text-right">Admin İşlemleri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Kayıtlı kullanıcı veya şirket unvanı bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {u.companyName} · {u.email}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-700">
                          <div>{u.taxIdentifier}</div>
                          <div className="text-[11px] font-sans text-slate-500 mt-0.5">
                            {INTEGRATOR_NAMES[u.eInvoiceIntegrator]}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <label htmlFor={`role-select-${u.id}`} className="sr-only">
                            {u.fullName} rol seçimi
                          </label>
                          <select
                            id={`role-select-${u.id}`}
                            value={u.role}
                            onChange={(e) =>
                              onChangeUserRole(u.id, e.target.value as UserRole)
                            }
                            className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-800"
                          >
                            <option value="ADMIN">İşletme Sahibi (Admin)</option>
                            <option value="ACCOUNTANT">Mali Müşavir / Muhasebe</option>
                            <option value="OPERATIONS">Operasyon Uzmanı</option>
                          </select>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <div className="font-semibold text-slate-900">
                            {u.eInvoiceCreditBalance.toLocaleString('tr-TR')} /{' '}
                            {u.eInvoiceCreditLimit.toLocaleString('tr-TR')}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {u.integratedMarketplaces.length} bağlı pazaryeri
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {u.isActive ? (
                            <span className="font-semibold text-emerald-700">
                              Aktif Mükellef
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              Askıya Alındı
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onAddUserCredits(u.id, 1000)}
                              aria-label={`${u.fullName} hesabına 1000 kontör yükle`}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              +1.000 Kontör
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleUserActive(u.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {u.isActive ? 'Askıya Al' : 'Aktifleştir'}
                            </button>

                            {onDeleteUser && (
                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                title="Kullanıcı & Şirket Unvanını Sil"
                                aria-label={`${u.fullName} (${u.companyName}) kullanıcı ve şirket unvanını sil`}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Sil</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Embedded User Creation & User-Specific Marketplace Integration Builder */}
          <UsersAndIntegrationsView
            users={users}
            selectedUserId={selectedUserId}
            onSelectUser={onSelectUser}
            onCreateUser={onCreateUser}
            onConnectMarketplaceToUser={onConnectMarketplaceToUser}
            onRemoveUserMarketplace={onRemoveUserMarketplace}
            onSyncUserMarketplace={onSyncUserMarketplace}
            onDeleteUser={onDeleteUser}
          />
        </div>
      )}

      {/* Sub-Tab: Firma / Şirket Bilgileri */}
      {subTab === 'company' && companyProfiles && onUpdateCompanyProfile && (
        <CompanyProfileView
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          companyProfiles={companyProfiles}
          onUpdateCompanyProfile={onUpdateCompanyProfile}
          onDeleteUser={onDeleteUser}
        />
      )}

      {/* Sub-Tab 2: Pazaryeri Mağazaları & API Entegrasyonları */}
      {subTab === 'marketplaces' && (
        <MarketplacesView
          integrations={integrations}
          users={users}
          onSyncMarketplace={onSyncMarketplace}
          onUpdateIntegration={onUpdateIntegration}
          onGoToUserIntegrations={(userId) => {
            if (userId) onSelectUser(userId);
            setSubTab('users');
          }}
        />
      )}

      {/* Sub-Tab 3: Automation Rules Module */}
      {subTab === 'rules' && (
        <div className="space-y-4">
          <AutomationRulesView
            rules={rules}
            onToggleRule={onToggleRule}
            onDeleteRule={onDeleteRule}
            onAddRule={onAddRule}
            onRunRulesNow={onRunRulesNow}
          />
        </div>
      )}

      {/* Sub-Tab 4: GİB Özel Entegratör & e-Dönüşüm Merkezi (Mysoft Entegrasyonu) */}
      {subTab === 'settings' && (
        <div className="space-y-6">
          {/* Full-Featured Mysoft Integration Hub (5-Tab Module) */}
          <MysoftIntegrationView
            initialConfig={systemSettings.mysoftConfig || INITIAL_MYSOFT_CONFIG}
            statusRecords={INITIAL_MYSOFT_STATUS_RECORDS}
            incomingInvoices={INITIAL_INCOMING_INVOICES}
            creditLogs={INITIAL_MYSOFT_CREDIT_LOGS}
            onConfigSave={(newCfg) => {
              const nextSettings: SystemPlatformSettings = {
                ...systemSettings,
                mysoftConfig: newCfg,
                eInvoicePrefix: newCfg.eInvoicePrefix || systemSettings.eInvoicePrefix || 'EFT',
                eArchivePrefix: newCfg.eArchivePrefix || systemSettings.eArchivePrefix || 'EAR',
                environmentMode: newCfg.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
              };
              setSettingsDraft(nextSettings);
              onUpdateSystemSettings(nextSettings);
            }}
          />

          {/* Global System Policies & Batch Repair */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleSaveSettingsSubmit}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-xs"
            >
              <div className="pb-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  Genel e-Dönüşüm & Stopaj Politikaları
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tüm pazaryeri mağazaları için geçerli stopaj, otomatik yeniden deneme ve seri ayarları
                </p>
              </div>

              {settingsSavedMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{settingsSavedMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="sys-env-mode"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    GİB Çalışma Ortamı
                  </label>
                  <select
                    id="sys-env-mode"
                    value={settingsDraft.environmentMode}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        environmentMode: e.target.value as 'PRODUCTION' | 'SANDBOX',
                      }))
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="PRODUCTION">PRODUCTION (Canlı GİB Mükellef Ortamı)</option>
                    <option value="SANDBOX">SANDBOX (Test / Entegrasyon Ortamı)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sys-primary-integrator"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Varsayılan Ana Özel Entegratör
                  </label>
                  <select
                    id="sys-primary-integrator"
                    value={settingsDraft.primaryGibIntegrator}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        primaryGibIntegrator: e.target.value as EInvoiceIntegrator,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="MYSOFT">Mysoft e-Dönüşüm (Özel Entegratör)</option>
                    <option value="FATURANSIT">Faturansit Özel Entegratör</option>
                  </select>
                </div>
              </div>

              {/* GİB Özel Entegratörü Fatura Seri Ön Ekleri */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-blue-900 text-xs">
                      GİB e-Belge Özel Entegratörü Resmi Seri Ön Ekleri
                    </h4>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      GİB UBL-TR standartlarına göre fatura ön ekleri (3 karakter) pazaryerlerinden alınmaz;
                      yalnızca yetkili GİB e-Belge Özel Entegratörünüz tarafından belirlenir ve tescil edilir.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="sys-e-invoice-prefix"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Özel Entegratör e-Fatura Ön Eki (3 Hane)
                    </label>
                    <input
                      id="sys-e-invoice-prefix"
                      type="text"
                      maxLength={3}
                      value={settingsDraft.eInvoicePrefix || 'EFT'}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          eInvoicePrefix: e.target.value.toUpperCase().slice(0, 3),
                        }))
                      }
                      placeholder="EFT"
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Kurumsal e-Fatura mükellefleri için resmi seri (Örn: EFT2026...)
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="sys-e-archive-prefix"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Özel Entegratör e-Arşiv Ön Eki (3 Hane)
                    </label>
                    <input
                      id="sys-e-archive-prefix"
                      type="text"
                      maxLength={3}
                      value={settingsDraft.eArchivePrefix || 'EAR'}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          eArchivePrefix: e.target.value.toUpperCase().slice(0, 3),
                        }))
                      }
                      placeholder="EAR"
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Bireysel ve vergi dışı alıcılar için resmi seri (Örn: EAR2026...)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="sys-withholding-rate"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Varsayılan E-Ticaret Stopaj Oranı (%)
                  </label>
                  <input
                    id="sys-withholding-rate"
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={settingsDraft.defaultWithholdingRate}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        defaultWithholdingRate: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sys-retry-count"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    GİB Zaman Aşımı Maksimum Tekrar Deneme
                  </label>
                  <input
                    id="sys-retry-count"
                    type="number"
                    min="1"
                    max="10"
                    value={settingsDraft.maxRetryAttempts}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        maxRetryAttempts: Math.max(1, Number(e.target.value) || 3),
                      }))
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.enforceStrictVknCheck}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        enforceStrictVknCheck: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Kurumsal siparişlerde GİB Mükellef Listesi üzerinden 10 haneli VKN doğrulamasını zorunlu tut
                  </span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.defaultArchiveEmailNotification}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        defaultArchiveEmailNotification: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Kesilen e-Arşiv faturalarının PDF/XML kopyasını alıcı e-posta adresine otomatik gönder ve pazaryerine yükle
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px]">
                  {isSettingsDirty ? (
                    <span className="text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Değişiklik yapıldı · Kaydetmeye hazır
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Tüm e-dönüşüm bilgileri güncel
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!isSettingsDirty}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                    isSettingsDirty
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>e-Dönüşüm Bilgilerini Kaydet</span>
                </button>
              </div>
            </form>

            {/* Right 5 Cols: Admin Batch Maintenance Operations */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Admin Toplu Kuyruk Bakım ve Onarım İşlemleri
                </h2>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Pazaryerlerinden eksik TCKN ile gelen bireysel siparişlere toplu olarak{' '}
                <strong className="font-mono text-slate-900">11111111111 (Nihai Tüketici)</strong>{' '}
                kimlik numarası atayabilir ve bekleyen hatalı bireysel belgeleri tek seferde resmileştirebilirsiniz.
              </p>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-slate-700 font-medium">
                  Kuyrukta Doğrulama Bekleyen Hatalı Sipariş:
                </span>
                <span className="font-mono font-bold text-sm text-amber-700">
                  {errorOrderCount} Sipariş
                </span>
              </div>

              <button
                type="button"
                onClick={onBatchRepairIndividualOrders}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                Eksik TCKN Bireysel Siparişleri Onar ve Faturalandır
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: System & GİB Audit Logs */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'Tüm Kayıtlar' },
                  { id: 'FATURA_KESIMI', label: 'e-Belge & Fatura' },
                  { id: 'KULLANICI_YETKI', label: 'Kullanıcı & Kontör' },
                  { id: 'PAZARYERI_API', label: 'Pazaryeri API' },
                  { id: 'SISTEM_AYARI', label: 'Sistem Ayarları' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuditCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    auditCategoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="audit-search-input" className="sr-only">
                Denetim kayıtlarında ara
              </label>
              <input
                id="audit-search-input"
                type="search"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Kullanıcı, GİB no veya işlem ara..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">Zaman Damgası</th>
                    <th className="py-2.5 px-3">İşlemi Yapan (Aktör)</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">İşlem Açıklaması</th>
                    <th className="py-2.5 px-3">Referans Kodu</th>
                    <th className="py-2.5 px-4 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {log.actorName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {CATEGORY_LABELS[log.category]}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {log.summary}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {log.targetReference}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Başarılı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Uyarı
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Kullanıcı & Şirket Unvanı Silme Onay Modalı */}
      {userToDelete && onDeleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-full shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-user-modal-title" className="text-base font-bold text-slate-900">
                  Kullanıcı & Şirket Unvanını Silme Yetkisi
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Seçilen kullanıcı hesabı ve resmi şirket unvanı sistemden kalıcı olarak kaldırılacaktır.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Kullanıcı Adı:</span>
                <span className="font-semibold text-slate-900">{userToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resmi Şirket Unvanı:</span>
                <span className="font-semibold text-slate-900 text-right max-w-[220px] truncate" title={userToDelete.companyName}>
                  {userToDelete.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vergi Kimlik No (VKN/TCKN):</span>
                <span className="font-mono font-semibold text-slate-800">{userToDelete.taxIdentifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Yetki Rolü:</span>
                <span className="font-medium text-slate-800">{userToDelete.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bağlı Pazaryeri Mağazaları:</span>
                <span className="font-semibold text-blue-700 font-mono">
                  {userToDelete.integratedMarketplaces.length} Mağaza
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <p className="font-semibold">Kritik Uyarı: Bu işlem geri alınamaz!</p>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Bu mükellef/kullanıcı silindiğinde; kullanıcı oturum bilgileri, şirket unvanı, fatura sicili ve bu kullanıcıya atanmış tüm pazaryeri mağaza bağlantıları kalıcı olarak temizlenecektir.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  const uid = userToDelete.id;
                  setUserToDelete(null);
                  onDeleteUser(uid);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Evet, Kullanıcı ve Şirket Unvanını Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
