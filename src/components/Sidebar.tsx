import React from 'react';
import {
  FileSpreadsheet,
  Workflow,
  Store,
  Users,
  Calculator,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Settings,
  FileSearch,
} from 'lucide-react';
import { ActiveTab } from './TopBar';
import { AdminSubTab } from './AdminPanelView';
import {
  MarketplaceId,
  PlatformUser,
  SystemPlatformSettings,
} from '../types/invoicing';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  adminSubTab?: AdminSubTab;
  onSelectAdminSubTab?: (subTab: AdminSubTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingCount: number;
  errorOrderCount: number;
  activeRulesCount: number;
  connectedStoresCount: number;
  users: PlatformUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onQuickAddCredits: (userId: string, amount: number) => void;
  onQuickSyncMarketplace: (mp: MarketplaceId, storeName: string) => void;
  systemSettings: SystemPlatformSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  adminSubTab,
  onSelectAdminSubTab,
  isCollapsed,
  onToggleCollapse,
  pendingCount,
  errorOrderCount,
  activeRulesCount,
  connectedStoresCount,
  users,
  selectedUserId,
  onSelectUser,
  onQuickAddCredits,
  onQuickSyncMarketplace,
  systemSettings,
}) => {
  const selectedUser =
    users.find((u) => u.id === selectedUserId) ?? users[0];

  const mainNavItems: Array<{
    id: ActiveTab;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeTone?: 'blue' | 'amber' | 'slate';
  }> = [
    {
      id: 'admin',
      label: 'Admin Paneli',
      description: '6 Alt Modül & Sistem Yönetimi',
      icon: ShieldCheck,
      badge:
        errorOrderCount > 0
          ? `${errorOrderCount} Hata`
          : activeRulesCount > 0
          ? `${activeRulesCount} Kural`
          : undefined,
      badgeTone: errorOrderCount > 0 ? 'amber' : 'slate',
    },
    {
      id: 'orders',
      label: 'Sipariş Kuyruğu',
      description: 'e-Fatura & e-Arşiv Kesimi',
      icon: FileSpreadsheet,
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeTone: 'blue',
    },
    {
      id: 'reconciliation',
      label: 'KDV & Mutabakat',
      description: 'Komisyon & Stopaj Raporu',
      icon: Calculator,
    },
  ];

  const adminSubModules: Array<{
    id: AdminSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    {
      id: 'company',
      label: 'Firma / Şirket Bilgileri',
      icon: Building2,
    },
    {
      id: 'users',
      label: 'Kullanıcı & Entegrasyon',
      icon: Users,
      badge: users.length,
    },
    {
      id: 'marketplaces',
      label: 'Pazaryeri Mağazaları',
      icon: Store,
      badge: connectedStoresCount,
    },
    {
      id: 'settings',
      label: 'e-Dönüşüm Bilgileri',
      icon: Settings,
    },
    {
      id: 'rules',
      label: 'Otomasyon Kuralları',
      icon: Workflow,
      badge: activeRulesCount > 0 ? `${activeRulesCount}` : undefined,
    },
    {
      id: 'audit',
      label: 'Denetim Kayıtları',
      icon: FileSearch,
    },
  ];

  return (
    <aside
      aria-label="Sol Yan Menü"
      className={`shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 select-none overflow-x-hidden ${
        isCollapsed ? 'w-[72px]' : 'w-[324px]'
      }`}
    >
      {/* Top Section: Collapse Control + Faturansit Logo + Active Mükellef Switcher */}
      <div className="p-3 space-y-3">
        <div
          className={`flex items-center relative z-10 ${
            isCollapsed ? 'justify-center' : 'justify-end px-1.5'
          }`}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Yan Menüyü Genişlet' : 'Yan Menüyü Daralt'}
            aria-label={isCollapsed ? 'Yan Menüyü Genişlet' : 'Yan Menüyü Daralt'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Faturansit Brand Logo */}
        <div className="flex justify-center">
          <a
            href="#admin"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('admin');
            }}
            aria-label="Faturansit Ana Sayfa"
            className="block focus-visible:outline-2 focus-visible:outline-blue-600 rounded-md cursor-pointer"
          >
            <img
              src="/assets/aistudio/IMG_8742_f9314dc3.jpeg"
              alt="Faturansit"
              style={
                isCollapsed
                  ? {
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginRight: '0px',
                    }
                  : {
                      width: '300px',
                      height: '70px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginRight: '0px',
                      marginTop: '-51px',
                    }
              }
              className={`${
                isCollapsed
                  ? 'h-9 w-9 object-top object-cover rounded-lg'
                  : 'w-[300px] h-[70px] object-contain'
              }`}
            />
          </a>
        </div>

        {/* Active Mükellef / Company Card */}
        {selectedUser && !isCollapsed && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500 leading-none">
                    Aktif Mükellef Oturumu
                  </p>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                    {selectedUser.companyName}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="sidebar-user-select" className="sr-only">
                Aktif Kullanıcı Seçimi
              </label>
              <select
                id="sidebar-user-select"
                value={selectedUser.id}
                onChange={(e) => onSelectUser(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · VKN: {u.taxIdentifier}
                  </option>
                ))}
              </select>
            </div>

            {/* Remaining Invoice Credit Balance */}
            <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  GİB e-Belge Kontör
                </span>
                <span className="text-xs font-bold font-mono tabular-nums text-slate-900">
                  {selectedUser.eInvoiceCreditBalance.toLocaleString('tr-TR')}{' '}
                  Adet
                </span>
              </div>
              <button
                type="button"
                onClick={() => onQuickAddCredits(selectedUser.id, 500)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-3 h-3 shrink-0" />
                +500 Kontör
              </button>
            </div>
          </div>
        )}

        {/* Primary Menu Links */}
        <nav aria-label="Modüller" className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isAdminItem = item.id === 'admin';
            const isActive =
              activeTab === item.id ||
              (isAdminItem &&
                (activeTab === 'company' ||
                  activeTab === 'users' ||
                  activeTab === 'marketplaces' ||
                  activeTab === 'rules'));
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-left transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 group-hover:text-slate-800'
                      }`}
                    />
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-semibold truncate leading-tight ${
                            isActive ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {item.label}
                        </p>
                        <p
                          className={`text-[11px] truncate mt-0.5 ${
                            isActive ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-[11px] font-semibold font-mono tabular-nums rounded-md shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeTone === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : item.badgeTone === 'blue'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>

                {/* Admin Paneli Alt Modülleri */}
                {isAdminItem && !isCollapsed && (
                  <div className="ml-3 pl-2.5 border-l-2 border-slate-200 space-y-0.5 py-1">
                    {adminSubModules.map((sub) => {
                      const isSubActive =
                        isActive &&
                        (adminSubTab === sub.id || (!adminSubTab && sub.id === 'company'));
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAdminSubTab?.(sub.id);
                            onSelectTab('admin');
                          }}
                          className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            isSubActive
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <SubIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSubActive ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{sub.label}</span>
                          </div>
                          {sub.badge !== undefined && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                                isSubActive
                                  ? 'bg-blue-100 text-blue-800 font-bold'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Active User's Connected Marketplaces Quick List */}
        {!isCollapsed && selectedUser && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Bağlı Mağazalar ({selectedUser.integratedMarketplaces.length})
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('admin')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                + Mağaza Ekle
              </button>
            </div>

            <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
              {selectedUser.integratedMarketplaces.map((cred) => {
                return (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                        title="API Aktif"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate leading-tight">
                          {cred.marketplaceName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {cred.storeName} · Seri: {cred.invoiceSeriesPrefix}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickSyncMarketplace(cred.marketplace, cred.storeName)
                      }
                      title={`${cred.marketplaceName} siparişlerini senkronize et`}
                      aria-label={`${cred.marketplaceName} siparişlerini senkronize et`}
                      className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-white transition-colors cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Tax Error Quick Alert & GİB Integrator Status */}
      <div className="p-3 border-t border-slate-200 space-y-2 bg-slate-50/50">
        {!isCollapsed && errorOrderCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectTab('orders')}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs hover:bg-amber-100/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-medium truncate">
                {errorOrderCount} Sipariş VKN/TCKN Bekliyor
              </span>
            </div>
            <span className="font-semibold underline shrink-0">Onar</span>
          </button>
        )}

        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } gap-2 px-1.5 py-1 text-[11px] text-slate-500`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {!isCollapsed && (
              <span className="truncate font-medium text-slate-700">
                {systemSettings.primaryGibIntegrator}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <span className="font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 shrink-0">
              {systemSettings.environmentMode === 'PRODUCTION'
                ? 'GİB CANLI'
                : 'SANDBOX'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
