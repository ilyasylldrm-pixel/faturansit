import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Workflow,
  Store,
  Users,
  Calculator,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  AlertTriangle,
  Building2,
  FileSearch,
  FileText,
  Crown,
  FileCode2,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Lock,
  ShoppingCart,
} from 'lucide-react';
import { ActiveTab } from './TopBar';
import { AdminSubTab } from './AdminPanelView';
import {
  AppOwnerProfile,
  EDocumentSubTab,
  MarketplaceId,
  PlatformUser,
  SystemPlatformSettings,
} from '../types/invoicing';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  adminSubTab?: AdminSubTab;
  onSelectAdminSubTab?: (subTab: AdminSubTab) => void;
  eDocSubTab?: EDocumentSubTab;
  onSelectEDocSubTab?: (subTab: EDocumentSubTab) => void;
  outgoingEFaturaCount?: number;
  outgoingEArsivCount?: number;
  incomingEFaturaCount?: number;
  appOwnerProfile?: AppOwnerProfile;
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
  eDocSubTab,
  onSelectEDocSubTab,
  outgoingEFaturaCount = 0,
  outgoingEArsivCount = 0,
  incomingEFaturaCount = 0,
  appOwnerProfile,
  isCollapsed,
  onToggleCollapse,
  pendingCount,
  errorOrderCount,
  activeRulesCount,
  connectedStoresCount,
  users,
  selectedUserId,
  onQuickAddCredits,
  onQuickSyncMarketplace,
  systemSettings,
}) => {
  const [openOrdersGroup, setOpenOrdersGroup] = useState<boolean>(true);
  const [openAdminGroup, setOpenAdminGroup] = useState<boolean>(true);
  const [openEDocGroup, setOpenEDocGroup] = useState<boolean>(true);

  const selectedUser =
    users.find((u) => u.id === selectedUserId) ?? users[0];

  const isAdminActive =
    activeTab === 'admin' ||
    activeTab === 'company' ||
    activeTab === 'edoc_settings' ||
    activeTab === 'users' ||
    activeTab === 'marketplaces' ||
    activeTab === 'rules';

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
      id: 'edoc_settings',
      label: 'E-Dönüşüm Bilgileri',
      icon: FileCode2,
      badge: `${systemSettings.eInvoicePrefix || 'EFT'}/${systemSettings.eArchivePrefix || 'EAR'}`,
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
      className={`shrink-0 bg-[#101C2B] text-slate-300 flex flex-col justify-between transition-all duration-200 select-none overflow-x-hidden border-r border-[#1B2B40] ${
        isCollapsed ? 'w-[76px]' : 'w-[280px]'
      }`}
    >
      {/* Top Section: White Logo Box + Company Name + Amber Badge + Quick Action CTA */}
      <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
        {/* Collapse Toggle + White Logo Card */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Yan Menüyü Genişlet' : 'Yan Menüyü Daralt'}
            aria-label={isCollapsed ? 'Yan Menüyü Genişlet' : 'Yan Menüyü Daralt'}
            className="self-end p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mb-1"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* White Rounded Logo Box (matching Pascal box in reference screenshot) */}
          <a
            href="#orders"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('orders');
            }}
            aria-label="Faturansit Ana Sayfa"
            className={`bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden cursor-pointer transition-transform hover:scale-[1.01] ${
              isCollapsed ? 'w-11 h-11 p-1' : 'w-44 h-14 px-4 py-1.5'
            }`}
          >
            <img
              src="/assets/aistudio/IMG_8742_f9314dc3.jpeg"
              alt="Faturansit"
              className="w-full h-full object-contain"
            />
          </a>

          {!isCollapsed && selectedUser && (
            <div className="text-center mt-3 space-y-1.5 w-full">
              <p className="text-[11.5px] font-medium tracking-wide text-slate-300 uppercase truncate px-2">
                {selectedUser.fullName}
              </p>
              <button
                type="button"
                onClick={() => onQuickAddCredits(selectedUser.id, 500)}
                title="Tıklayarak +500 GİB e-Belge Kontörü ekleyin"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 shrink-0" />
                <span>
                  GİB Kontör ({selectedUser.eInvoiceCreditBalance.toLocaleString('tr-TR')})
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Uygulama Sahibi Bilgileri (Hızlı İşlem Ekle'nin üstünde) */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('app_owner')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
              activeTab === 'app_owner'
                ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                : 'bg-white/5 text-slate-200 font-medium hover:text-white hover:bg-white/10 border border-slate-700/60'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Crown className="w-4 h-4 shrink-0 text-amber-400" />
              {!isCollapsed && (
                <span className="truncate">Uygulama Sahibi Bilgileri</span>
              )}
            </div>
            {!isCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </button>
        </div>

        {/* + Hızlı İşlem Ekle Button (Exact match to screenshot) */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('orders')}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-[#0077CC] hover:bg-[#0284C7] text-white font-semibold text-[13px] transition-all shadow-sm cursor-pointer ${
              isCollapsed ? 'p-2.5' : 'py-2.5 px-4'
            }`}
            title="Hızlı Fatura & Sipariş İşlemi Ekle"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Hızlı İşlem Ekle</span>}
          </button>
        </div>

        {/* Navigation Links matching Screenshot Hierarchy */}
        <nav aria-label="Modüller" className="space-y-1 pt-1">
          {/* Admin & E-Dönüşüm Paneli (Hızlı İşlem Ekle'nin hemen altında) */}
          <div className="pb-1">
            <button
              type="button"
              onClick={() => {
                setOpenAdminGroup((p) => !p);
                onSelectTab('admin');
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
                isAdminActive
                  ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                  : 'text-[#94A3B8] font-medium hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="truncate">Admin & E-Dönüşüm Paneli</span>}
              </div>
              {!isCollapsed &&
                (openAdminGroup ? (
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                ))}
            </button>

            {openAdminGroup && !isCollapsed && (
              <div className="pl-4 mt-1 space-y-0.5 border-l border-slate-700/70 ml-4">
                {adminSubModules.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive =
                    isAdminActive &&
                    (adminSubTab === sub.id ||
                      (!adminSubTab && sub.id === 'company'));
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAdminSubTab?.(sub.id);
                        onSelectTab('admin');
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSubActive
                          ? 'bg-sky-500/20 text-sky-300 font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </div>
                      {sub.badge !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* E Belge Modülü & 3 Alt Modül (Gelen e-Faturalar, Giden e-Faturalar, Giden e-Arşivler) */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => {
                setOpenEDocGroup((p) => !p);
                onSelectTab('edocument');
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
                activeTab === 'edocument'
                  ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                  : 'text-[#94A3B8] font-medium hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="truncate">E Belge Modülü</span>}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded bg-white/15 text-[10px] font-mono">
                    {incomingEFaturaCount + outgoingEFaturaCount + outgoingEArsivCount}
                  </span>
                  {openEDocGroup ? (
                    <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                  )}
                </div>
              )}
            </button>

            {(openEDocGroup || isCollapsed) && (
              <div
                className={
                  isCollapsed
                    ? 'space-y-1 mt-1'
                    : 'pl-4 mt-1 space-y-0.5 border-l border-slate-700/70 ml-4'
                }
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEDocSubTab?.('incoming_efatura');
                    onSelectTab('edocument');
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'edocument' && eDocSubTab === 'incoming_efatura'
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowDownLeft
                      className={`w-3.5 h-3.5 shrink-0 ${
                        activeTab === 'edocument' && eDocSubTab === 'incoming_efatura'
                          ? 'text-sky-300'
                          : 'text-sky-400'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">Gelen e-Faturalar</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                      {incomingEFaturaCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEDocSubTab?.('outgoing_efatura');
                    onSelectTab('edocument');
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'edocument' &&
                    (!eDocSubTab || eDocSubTab === 'outgoing_efatura')
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowUpRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        activeTab === 'edocument' &&
                        (!eDocSubTab || eDocSubTab === 'outgoing_efatura')
                          ? 'text-sky-300'
                          : 'text-sky-400'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">Giden e-Faturalar</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                      {outgoingEFaturaCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEDocSubTab?.('outgoing_earsiv');
                    onSelectTab('edocument');
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'edocument' && eDocSubTab === 'outgoing_earsiv'
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowUpRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        activeTab === 'edocument' && eDocSubTab === 'outgoing_earsiv'
                          ? 'text-sky-300'
                          : 'text-sky-400'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">Giden e-Arşivler</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                      {outgoingEArsivCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 2. Sipariş & Proforma Group */}
          <div className="pt-2">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => setOpenOrdersGroup((p) => !p)}
                className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-slate-200 hover:text-white cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="w-4 h-4 text-slate-400" />
                  <span>Sipariş & Fatura Kuyruğu</span>
                </div>
                {openOrdersGroup ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            )}

            {(openOrdersGroup || isCollapsed) && (
              <div className={isCollapsed ? 'space-y-1' : 'pl-3 space-y-1 mt-0.5'}>
                <button
                  type="button"
                  onClick={() => onSelectTab('orders')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                      : 'text-[#94A3B8] font-medium hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate">Siparişler & Fatura Kes</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-1">
                      {pendingCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">
                          {pendingCount}
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 3. KDV & Cari Mutabakat (Highlighted like Cari Hesaplar) */}
          <button
            type="button"
            onClick={() => onSelectTab('reconciliation')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
              activeTab === 'reconciliation'
                ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                : 'text-[#94A3B8] font-medium hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Calculator className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">KDV & Cari Mutabakat</span>}
            </div>
            {!isCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </button>

          {/* 4. Mali Müşavir Modülü */}
          <button
            type="button"
            onClick={() => onSelectTab('accountant')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all cursor-pointer ${
              activeTab === 'accountant'
                ? 'bg-[#0077CC] text-white font-semibold shadow-sm'
                : 'text-[#94A3B8] font-medium hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Scale className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">Mali Müşavir Modülü</span>
              )}
            </div>
            {!isCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </button>
        </nav>

        {/* Connected Marketplaces Quick Sync */}
        {!isCollapsed && selectedUser && (
          <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bağlı Mağazalar ({selectedUser.integratedMarketplaces.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectAdminSubTab?.('marketplaces');
                  onSelectTab('admin');
                }}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                + Ekle
              </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
              {selectedUser.integratedMarketplaces.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#16263B] border border-slate-800 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate font-medium">
                      {cred.marketplaceName} ({cred.invoiceSeriesPrefix})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onQuickSyncMarketplace(cred.marketplace, cred.storeName)
                    }
                    title={`${cred.marketplaceName} siparişlerini senkronize et`}
                    className="p-1 text-sky-400 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer of Sidebar (Matching ABDURRAHMAN ŞİMŞEK / VKN / Bakiye Aktif in Screenshot) */}
      <div className="p-3.5 border-t border-slate-800/90 bg-[#0C1522] space-y-2">
        {!isCollapsed && errorOrderCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectTab('orders')}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/25 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {errorOrderCount} Sipariş VKN Hatası
              </span>
            </div>
            <span className="underline font-bold shrink-0">Onar</span>
          </button>
        )}

        {selectedUser && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-200">
              <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
              {!isCollapsed && (
                <span className="text-xs font-bold uppercase tracking-wide truncate">
                  {selectedUser.companyName}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="font-mono text-slate-400">
                  VKN: {selectedUser.taxIdentifier}
                </span>
                <span className="font-semibold text-emerald-400">
                  Bakiye Aktif
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
