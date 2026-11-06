import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Search,
  Trash2,
  Save,
  Activity,
  FileSpreadsheet,
  Eye,
  X,
  Clock,
  Filter,
} from 'lucide-react';
import {
  AuditActionCategory,
  AuditActionType,
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
import { ETransformationInfoView } from './ETransformationInfoView';
import { PascalHeroBanner, PascalKpiCard } from './PascalUi';

export type AdminSubTab =
  | 'company'
  | 'edoc_settings'
  | 'users'
  | 'marketplaces'
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
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const CATEGORY_LABELS: Record<AuditActionCategory, string> = {
  FATURA_KESIMI: 'e-Belge & Fatura',
  KULLANICI_YETKI: 'Kullanıcı & Kontör',
  PAZARYERI_API: 'Pazaryeri API',
  SISTEM_AYARI: 'Sistem & GİB Ayarı',
};

const ACTION_TYPE_LABELS: Record<AuditActionType, string> = {
  CREATE: 'Yeni Kayıt / Ekleme',
  UPDATE: 'Güncelleme / Değişiklik',
  DELETE: 'Silme / İptal',
  INVOICE: 'Fatura & GİB Gönderimi',
  SYNC: 'API Senkronizasyon',
  EXPORT: 'Excel / Rapor Aktarımı',
  SYSTEM: 'Sistem & Kayıt',
};

const ACTION_TYPE_BADGES: Record<AuditActionType, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  INVOICE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SYNC: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPORT: 'bg-teal-50 text-teal-700 border-teal-200',
  SYSTEM: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin (İşletme Sahibi)',
  ACCOUNTANT: 'Mali Müşavir / Muhasebe',
  OPERATIONS: 'Operasyon Uzmanı',
};

const INTEGRATOR_NAMES: Record<EInvoiceIntegrator, string> = {
  FATURANSIT: 'Faturansit Özel Entegratör',
  GIB_PORTAL: 'GİB Portal',
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
  onSaveAllModules,
  hasUnsavedChanges,
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
  const [auditActionTypeFilter, setAuditActionTypeFilter] = useState<'ALL' | AuditActionType>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogEntry | null>(null);

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

  const logStats = useMemo(() => {
    const totalLogs = auditLogs.length;
    const invoiceMovements = auditLogs.filter(
      (l) => l.category === 'FATURA_KESIMI' || l.actionType === 'INVOICE'
    ).length;
    const dataChanges = auditLogs.filter(
      (l) =>
        l.actionType === 'UPDATE' ||
        l.actionType === 'CREATE' ||
        l.actionType === 'DELETE'
    ).length;
    const warningCount = auditLogs.filter((l) => l.status === 'WARNING').length;
    return { totalLogs, invoiceMovements, dataChanges, warningCount };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (
        auditCategoryFilter !== 'ALL' &&
        log.category !== auditCategoryFilter
      ) {
        return false;
      }
      if (
        auditActionTypeFilter !== 'ALL' &&
        (log.actionType ?? 'SYSTEM') !== auditActionTypeFilter
      ) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase().trim();
        return (
          log.summary.toLowerCase().includes(q) ||
          log.actorName.toLowerCase().includes(q) ||
          log.targetReference.toLowerCase().includes(q) ||
          (log.moduleName ?? '').toLowerCase().includes(q) ||
          (log.changeDetails ?? '').toLowerCase().includes(q) ||
          (log.ipAddress ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, auditCategoryFilter, auditActionTypeFilter, auditSearch]);

  const handleExportLogsCsv = () => {
    const headers = [
      'Log ID',
      'Zaman Damgasi',
      'Islemi Yapan (Aktor)',
      'Yetki Rolu',
      'Modul / Alt Modul',
      'Kategori',
      'Hareket Tipi',
      'Islem Ozeti',
      'Yapilan Degisiklik & Parametre Detayi',
      'Hedef Referans Kodu',
      'IP Adresi',
      'Durum',
    ];
    const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const rows = filteredLogs.map((log) => [
      escapeCell(log.id),
      escapeCell(log.timestamp),
      escapeCell(log.actorName),
      escapeCell(ROLE_LABELS[log.actorRole] ?? log.actorRole),
      escapeCell(log.moduleName ?? CATEGORY_LABELS[log.category]),
      escapeCell(CATEGORY_LABELS[log.category]),
      escapeCell(ACTION_TYPE_LABELS[log.actionType ?? 'SYSTEM']),
      escapeCell(log.summary),
      escapeCell(log.changeDetails ?? log.summary),
      escapeCell(log.targetReference),
      escapeCell(log.ipAddress ?? '127.0.0.1'),
      escapeCell(log.status === 'SUCCESS' ? 'BASARILI' : 'UYARI'),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-log-izleme-hareketleri-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      {/* Pascal Hero Banner */}
      <PascalHeroBanner
        kicker="MERKEZİ SİSTEM & E-DÖNÜŞÜM YÖNETİMİ"
        title={
          subTab === 'audit'
            ? 'Admin Log İzleme & Sistem Hareketleri'
            : 'Platform Yönetim & Denetim Paneli'
        }
        subtitle={
          subTab === 'audit'
            ? 'Platform üzerindeki tüm modüllerde yapılan değişiklikleri, kullanıcı işlemlerini, fatura kesimlerini ve API hareketlerini anlık izleyin.'
            : 'Mükellef kontör havuzu, E-Dönüşüm bilgileri, pazaryeri API yetkileri ve canlı log izleme merkezi.'
        }
        onSaveAction={onSaveAllModules ? () => onSaveAllModules('Admin Paneli') : undefined}
        saveLabel={hasUnsavedChanges ? 'Değişiklikleri Kaydet' : 'Tüm Modülleri Kaydet'}
        hasUnsavedChanges={hasUnsavedChanges}
        primaryLabel={subTab === 'audit' ? 'E-Dönüşüm Bilgileri' : 'Canlı Log İzleme'}
        onPrimaryAction={() => setSubTab(subTab === 'audit' ? 'edoc_settings' : 'audit')}
      />

      {/* 4-Column Admin KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PascalKpiCard
          title="Aktif mükellef & kullanıcı"
          value={`${adminStats.activeUsersCount} / ${users.length}`}
          tone="emerald"
          pillText={`${adminStats.activeUsersCount} aktif`}
          subtitle="rol bazlı yetkilendirilmiş"
          icon={<ShieldCheck className="w-5 h-5" />}
        />

        <PascalKpiCard
          title="Toplam e-Belge kontör havuzu"
          value={adminStats.totalCreditBalance.toLocaleString('tr-TR')}
          tone="sky"
          pillText={`${adminStats.totalCreditLimit.toLocaleString('tr-TR')} limit`}
          subtitle="toplam tahsis edilen kontör"
          icon={<Coins className="w-5 h-5" />}
          testId="admin-total-credits"
        />

        <PascalKpiCard
          title="Pazaryeri API bağlantısı"
          value={`${adminStats.totalStores} mağaza`}
          tone="amber"
          pillText="API Aktif"
          subtitle="bağlı pazaryeri entegrasyonu"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />

        <PascalKpiCard
          title="Canlı log & sistem hareketi"
          value={`${auditLogs.length} kayıt`}
          tone="rose"
          pillText="Canlı İzleme"
          subtitle="tüm modül değişiklikleri & hareketler"
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      {/* Admin Sub-Module Navigation Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2 flex flex-wrap items-center gap-1.5 shadow-2xs">
        {(
          [
            { id: 'audit', label: 'Log İzleme (Tüm Hareketler)', badge: `${auditLogs.length}` },
          ] as const
        ).map((item) => {
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-[#0478bd] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
              {'badge' in item && item.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
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
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Her e-Fatura / e-Arşiv kesimi 1 kontör düşer
                </span>
                {onSaveAllModules && (
                  <button
                    type="button"
                    onClick={() => onSaveAllModules('Kullanıcı & Kontör Modülü')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      hasUnsavedChanges
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                )}
              </div>
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
            onSaveAllModules={onSaveAllModules}
            hasUnsavedChanges={hasUnsavedChanges}
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
          onSaveAllModules={onSaveAllModules}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      {/* Sub-Tab: E-Dönüşüm Bilgileri */}
      {subTab === 'edoc_settings' && (
        <ETransformationInfoView
          systemSettings={systemSettings}
          onUpdateSystemSettings={onUpdateSystemSettings}
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          onBatchRepairIndividualOrders={onBatchRepairIndividualOrders}
          onSaveAllModules={onSaveAllModules}
          hasUnsavedChanges={hasUnsavedChanges}
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
          onSaveAllModules={onSaveAllModules}
          hasUnsavedChanges={hasUnsavedChanges}
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
            onSaveAllModules={onSaveAllModules}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      )}

      {/* Sub-Tab 4: Log İzleme (Tüm Sistem Hareketleri & Değişiklik Kayıtları) */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          {/* Log İzleme Header & Live Status Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0478bd] shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900">
                    Admin Log İzleme Merkezi (Tüm Değişiklikler & Sistem Hareketleri)
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CANLI LOG İZLEME AKTİF
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Admin yetkisiyle platformdaki tüm modüllerde yapılan veri değişikliklerini (eski/yeni değerler), fatura kesimlerini, kullanıcı/kontör işlemlerini ve API hareketlerini tek ekrandan izleyin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleExportLogsCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/70 bg-white text-emerald-700 hover:bg-emerald-50/70 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Logları Excel (CSV) İndir</span>
              </button>

              {onSaveAllModules && (
                <button
                  type="button"
                  onClick={() => onSaveAllModules('Log İzleme & Sistem Hareketleri')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    hasUnsavedChanges
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                      : 'bg-[#0478bd] text-white hover:bg-[#0369a1]'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Log Kayıtlarını Kaydet</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Mini Summary Cards for Log İzleme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Toplam İzlenen Hareket
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {logStats.totalLogs} Kayıt
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Filtrelenen: {filteredLogs.length} hareket
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Veri Değişikliği (Ekleme / Güncelleme / Silme)
                </div>
                <div className="text-lg font-bold font-mono text-blue-700 mt-0.5">
                  {logStats.dataChanges} Değişiklik
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Önceki / sonraki değer detaylı
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
                <Filter className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  e-Belge & Fatura Hareketleri
                </div>
                <div className="text-lg font-bold font-mono text-indigo-700 mt-0.5">
                  {logStats.invoiceMovements} İşlem
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  GİB UBL-TR & ETTN kayıtları
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Uyarı & Kritik Hareketler
                </div>
                <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
                  {logStats.warningCount} Uyarı
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Silme / askıya alma / VKN uyarıları
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filter Bar: Categories + Action Type + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'Tüm Hareketler' },
                  { id: 'FATURA_KESIMI', label: 'e-Belge & Fatura' },
                  { id: 'KULLANICI_YETKI', label: 'Kullanıcı & Kontör' },
                  { id: 'PAZARYERI_API', label: 'Pazaryeri API' },
                  { id: 'SISTEM_AYARI', label: 'Sistem & Şirket Ayarları' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuditCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    auditCategoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div>
                <label htmlFor="audit-action-type-select" className="sr-only">
                  Hareket Tipi Filtresi
                </label>
                <select
                  id="audit-action-type-select"
                  value={auditActionTypeFilter}
                  onChange={(e) =>
                    setAuditActionTypeFilter(e.target.value as 'ALL' | AuditActionType)
                  }
                  className="w-full sm:w-auto px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                >
                  <option value="ALL">Tüm İşlem Tipleri</option>
                  <option value="UPDATE">Güncelleme / Değişiklik</option>
                  <option value="CREATE">Yeni Kayıt / Ekleme</option>
                  <option value="DELETE">Silme / İptal</option>
                  <option value="INVOICE">Fatura & GİB Gönderimi</option>
                  <option value="SYNC">API Senkronizasyon</option>
                  <option value="EXPORT">Excel / Rapor Aktarımı</option>
                  <option value="SYSTEM">Sistem & Kayıt</option>
                </select>
              </div>

              <div className="relative sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="audit-search-input" className="sr-only">
                  Log kayıtlarında ara
                </label>
                <input
                  id="audit-search-input"
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Modül, kullanıcı, değişiklik detayı, IP veya referans ara..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Comprehensive Log Monitoring Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Zaman Damgası & IP</th>
                    <th className="py-3 px-3">İşlemi Yapan (Aktör & Rol)</th>
                    <th className="py-3 px-3">Modül / Alt Modül</th>
                    <th className="py-3 px-3">Hareket Tipi</th>
                    <th className="py-3 px-3 min-w-[320px]">
                      Yapılan Değişiklik & Hareket Detayı
                    </th>
                    <th className="py-3 px-3">Referans Kodu</th>
                    <th className="py-3 px-4 text-right">Durum & İncele</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Seçilen filtre kriterlerine uygun sistem hareketi veya değişiklik logu bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const actionType: AuditActionType = log.actionType ?? 'SYSTEM';
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 align-top">
                          <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              {log.timestamp}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              IP: {log.ipAddress ?? '192.168.1.10'} · #{log.id}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              {log.actorName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {ROLE_LABELS[log.actorRole] ?? log.actorRole}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {log.moduleName ?? CATEGORY_LABELS[log.category]}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {CATEGORY_LABELS[log.category]}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${ACTION_TYPE_BADGES[actionType]}`}
                            >
                              {ACTION_TYPE_LABELS[actionType]}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-800">
                            <div className="font-semibold text-slate-900 leading-snug">
                              {log.summary}
                            </div>
                            {log.changeDetails && (
                              <div className="mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-md text-[11px] font-mono text-slate-600 leading-relaxed">
                                <span className="font-semibold text-slate-700">
                                  Değişiklik Detayı:{' '}
                                </span>
                                {log.changeDetails}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-800">
                              {log.targetReference}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end gap-1.5">
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
                              <button
                                type="button"
                                onClick={() => setSelectedLogForDetail(log)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#0478bd] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Detay</span>
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

      {/* Log İzleme Detay Modalı */}
      {selectedLogForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-detail-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#0478bd] rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="log-detail-modal-title" className="text-base font-bold text-slate-900">
                    Sistem Hareket & Değişiklik Log Kaydı
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Log ID: {selectedLogForDetail.id} · Zaman: {selectedLogForDetail.timestamp}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">İşlemi Yapan (Aktör):</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {selectedLogForDetail.actorName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Kullanıcı Rolü:</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {ROLE_LABELS[selectedLogForDetail.actorRole] ?? selectedLogForDetail.actorRole}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Modül / Alt Modül:</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {selectedLogForDetail.moduleName ?? CATEGORY_LABELS[selectedLogForDetail.category]}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Hareket Tipi & Kategori:</span>
                <span className="font-semibold text-[#0478bd] mt-0.5 block">
                  {ACTION_TYPE_LABELS[selectedLogForDetail.actionType ?? 'SYSTEM']} ({CATEGORY_LABELS[selectedLogForDetail.category]})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Hedef Referans Kodu:</span>
                <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                  {selectedLogForDetail.targetReference}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">IP Adresi & Durum:</span>
                <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                  {selectedLogForDetail.ipAddress ?? '192.168.1.10'} ·{' '}
                  {selectedLogForDetail.status === 'SUCCESS' ? 'BAŞARILI' : 'UYARI'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Hareket Özeti:
                </span>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium">
                  {selectedLogForDetail.summary}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Yapılan Değişiklik & Teknik Parametre Detayı:
                </span>
                <div className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-lg leading-relaxed whitespace-pre-wrap">
                  {selectedLogForDetail.changeDetails ??
                    'Bu işlem için ek parametre değişikliği kaydı bulunmamaktadır.'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0478bd] hover:bg-[#0369a1] rounded-lg transition-colors cursor-pointer"
              >
                Kapat
              </button>
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
