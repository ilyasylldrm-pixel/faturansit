import React, { useState } from 'react';
import {
  UserPlus,
  Store,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Trash2,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Save,
  Search,
  Loader2,
} from 'lucide-react';
import {
  EInvoiceIntegrator,
  MarketplaceId,
  PlatformUser,
  UserRole,
} from '../types/invoicing';
import { MARKETPLACE_CATALOG, validateTurkishTaxIdentifier } from '../utils/invoicingEngine';
import { checkMysoftRecipient } from '../services/mysoftClient';

interface UsersAndIntegrationsViewProps {
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
  onDeleteUser?: (userId: string) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'İşletme Sahibi (Admin)',
  ACCOUNTANT: 'Mali Müşavir / Muhasebe',
  OPERATIONS: 'Operasyon & Kargo Uzmanı',
};

const INTEGRATOR_LABELS: Record<EInvoiceIntegrator, string> = {
  MYSOFT: 'Mysoft e-Belge',
  FATURANSIT: 'Mysoft e-Belge',
  GIB_PORTAL: 'Mysoft e-Belge',
};

export const UsersAndIntegrationsView: React.FC<UsersAndIntegrationsViewProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  onCreateUser,
  onConnectMarketplaceToUser,
  onRemoveUserMarketplace,
  onSyncUserMarketplace,
  onDeleteUser,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const activeUser =
    users.find((u) => u.id === selectedUserId) ?? users[0];
  const [userToDelete, setUserToDelete] = useState<PlatformUser | null>(null);

  // New User Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [companyName, setCompanyName] = useState('');
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [eInvoiceIntegrator, setEInvoiceIntegrator] =
    useState<EInvoiceIntegrator>('MYSOFT');
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);
  const [isCheckingVkn, setIsCheckingVkn] = useState(false);
  const [vknQueryFeedback, setVknQueryFeedback] = useState<string | null>(null);

  const handleQueryVkn = () => {
    const clean = taxIdentifier.replace(/\D/g, '');
    const valid = validateTurkishTaxIdentifier(clean, clean.length === 11 ? 'INDIVIDUAL' : 'CORPORATE', false);
    if (!valid.valid) {
      setUserFormError(`Geçersiz Vergi Numarası: ${valid.error}`);
      return;
    }
    setUserFormError(null);
    setIsCheckingVkn(true);
    setVknQueryFeedback(null);
    void checkMysoftRecipient(valid.normalizedId)
      .then((rec) => {
        if (rec.title) {
          setCompanyName(rec.title);
          setVknQueryFeedback(`Mysoft ile doğrulandı: ${rec.title} (${rec.registered ? 'Aktif e-Fatura' : 'e-Arşiv'})`);
        } else {
          setVknQueryFeedback('Mükellef kaydı sorgulandı.');
        }
      })
      .catch((err) => {
        setUserFormError(err instanceof Error ? err.message : 'Mysoft sorgusu başarısız.');
      })
      .finally(() => setIsCheckingVkn(false));
  };

  // Connect Marketplace to Active User Form State
  const [mpId, setMpId] = useState<MarketplaceId>('trendyol');
  const [storeName, setStoreName] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [seriesPrefix, setSeriesPrefix] = useState('TRD');
  const [commissionRate, setCommissionRate] = useState('16.5');
  const [syncInterval, setSyncInterval] = useState('360');
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [mpFormError, setMpFormError] = useState<string | null>(null);
  const [mpFormSuccess, setMpFormSuccess] = useState<string | null>(null);

  const handleMarketplaceSelectChange = (nextMp: MarketplaceId) => {
    setMpId(nextMp);
    const catalog = MARKETPLACE_CATALOG[nextMp];
    setSeriesPrefix(catalog.defaultPrefix);
    setCommissionRate(String(catalog.defaultCommission));
    setMpFormError(null);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    const res = onCreateUser({
      fullName,
      email,
      phone,
      role,
      companyName,
      taxIdentifier,
      eInvoiceIntegrator,
    });

    if (!res.valid) {
      setUserFormError(res.error ?? 'Kullanıcı oluşturulamadı.');
      return;
    }

    setFullName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setTaxIdentifier('');
    if (res.user) {
      onSelectUser(res.user.id);
      setUserFormSuccess(
        `${res.user.fullName} (${res.user.companyName}) kullanıcı hesabı oluşturuldu. Şimdi sağ panelden kullanıcının pazaryerlerini entegre edebilirsiniz.`
      );
    }
  };

  const handleConnectMarketplaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    setMpFormError(null);
    setMpFormSuccess(null);

    const res = onConnectMarketplaceToUser(activeUser.id, {
      marketplace: mpId,
      storeName,
      sellerId,
      apiKey,
      apiSecret,
      invoiceSeriesPrefix: seriesPrefix,
      defaultCommissionRate: Number(commissionRate),
      autoSyncIntervalMinutes: Number(syncInterval) || 360,
      webhookEnabled,
    });

    if (!res.valid) {
      setMpFormError(res.error ?? 'Pazaryeri bağlantısı doğrulanamadı.');
      return;
    }

    setStoreName('');
    setSellerId('');
    setApiKey('');
    setApiSecret('');
    setMpFormSuccess(
      `${MARKETPLACE_CATALOG[mpId].name} mağazası ${activeUser.fullName} kullanıcısına başarıyla entegre edildi.`
    );
  };

  const totalConnectedStores = users.reduce(
    (sum, u) => sum + u.integratedMarketplaces.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Çoklu Mükellef & Ekip Yetkilendirme · Kullanıcı Bazlı Pazaryeri API ve GİB Seri Eşleştirme
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Kullanıcı Yönetimi ve Kullanıcı Pazaryeri Entegrasyon Modeli
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
            <span>Toplam Kullanıcı: <strong className="text-slate-900">{users.length}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Bağlı Pazaryeri: <strong className="text-blue-700">{totalConnectedStores}</strong></span>
          </div>

          {onSaveAllModules && (
            <button
              type="button"
              onClick={() => onSaveAllModules('Kullanıcı Yönetimi')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Kullanıcı Değişikliklerini Kaydet' : 'Kullanıcıları Kaydet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 12-Col Layout: Left 5 Cols User Directory & Add User Form, Right 7 Cols Selected User's Marketplace Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Users List + Add New User Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Existing Users List */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Kayıtlı Kullanıcılar ve İşletmeler ({users.length})
              </h2>
              <span className="text-[11px] text-slate-500">
                Pazaryeri yönetimi için seçin
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {users.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Kayıtlı kullanıcı veya şirket unvanı bulunmamaktadır.
                </div>
              ) : (
                users.map((u) => {
                  const isSelected = activeUser?.id === u.id;
                  const mpNames = u.integratedMarketplaces
                    .map((m) => m.marketplaceName)
                    .join(', ');

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u.id);
                        setMpFormError(null);
                        setMpFormSuccess(null);
                      }}
                      className={`w-full text-left p-4 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {u.fullName}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-semibold text-blue-700">
                              · Seçili
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 font-medium truncate">
                          {u.companyName}
                        </p>

                        {/* Unboxed metadata with · separators */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{ROLE_LABELS[u.role]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">VKN/TCKN: {u.taxIdentifier}</span>
                          <span aria-hidden="true">·</span>
                          <span>{INTEGRATOR_LABELS[u.eInvoiceIntegrator]}</span>
                        </div>

                        <div className="text-[11px] text-slate-600 pt-0.5">
                          <span className="font-semibold text-slate-800 font-mono">
                            {u.integratedMarketplaces.length} Pazaryeri:
                          </span>{' '}
                          {mpNames || 'Henüz pazaryeri bağlanmadı'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                          Mağazaları Yönet
                        </span>
                        {onDeleteUser && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete(u);
                            }}
                            title="Kullanıcı & Şirket Unvanını Sil"
                            aria-label={`${u.fullName} (${u.companyName}) kullanıcısını sil`}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add New User / Merchant Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Yeni Kullanıcı ve Mükellef Ekle
              </h2>
            </div>

            {userFormSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{userFormSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="user-fullname-input"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Ad Soyad
                  </label>
                  <input
                    id="user-fullname-input"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setUserFormError(null);
                    }}
                    placeholder="Örn: Deniz Arslan"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="user-email-input"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Kurumsal E-Posta
                  </label>
                  <input
                    id="user-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setUserFormError(null);
                    }}
                    placeholder="deniz@arslanteknoloji.com.tr"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="user-company-input"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Şirket / Mükellef Unvanı
                  </label>
                  <input
                    id="user-company-input"
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setUserFormError(null);
                    }}
                    placeholder="Örn: Arslan Teknoloji A.Ş."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="user-taxid-input"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Mükellef VKN (10) / TCKN (11)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="user-taxid-input"
                      type="text"
                      maxLength={11}
                      value={taxIdentifier}
                      onChange={(e) => {
                        setTaxIdentifier(e.target.value.replace(/\D/g, ''));
                        setUserFormError(null);
                        setVknQueryFeedback(null);
                      }}
                      placeholder="Örn: 8291049382"
                      className="flex-1 px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleQueryVkn}
                      disabled={isCheckingVkn || taxIdentifier.replace(/\D/g, '').length < 10}
                      className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isCheckingVkn ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Sorgula</span>
                    </button>
                  </div>
                  {vknQueryFeedback && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1">
                      ✓ {vknQueryFeedback}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="user-role-select"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Kullanıcı Rolü ve Yetkisi
                  </label>
                  <select
                    id="user-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="ADMIN">İşletme Sahibi (Admin)</option>
                    <option value="ACCOUNTANT">Mali Müşavir / Muhasebe</option>
                    <option value="OPERATIONS">Operasyon & Kargo Uzmanı</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="user-integrator-select"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    GİB e-Belge Özel Entegratörü
                  </label>
                  <select
                    id="user-integrator-select"
                    value={eInvoiceIntegrator}
                    onChange={(e) =>
                      setEInvoiceIntegrator(e.target.value as EInvoiceIntegrator)
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="MYSOFT">Mysoft e-Belge</option>
                  </select>
                </div>
              </div>

              {userFormError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
                  {userFormError}
                </div>
              )}

              <button
                type="submit"
                disabled={!fullName.trim() || !email.trim() || !companyName.trim() || !taxIdentifier.trim()}
                className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                  fullName.trim() && email.trim() && companyName.trim() && taxIdentifier.trim()
                    ? 'text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Kullanıcıyı Kaydet ve Seç
              </button>
            </form>
          </div>
        </div>

        {/* Right 7 Cols: Active User's Connected Marketplaces + New Marketplace Integration Model */}
        {activeUser && (
          <div className="lg:col-span-7 space-y-6">
            {/* Active User Profile & Connected Marketplaces List */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <h2 className="text-base font-bold text-slate-900">
                      {activeUser.fullName} — Entegre Pazaryeri Mağazaları
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {activeUser.companyName} · <span className="font-mono">VKN/TCKN: {activeUser.taxIdentifier}</span> ·{' '}
                    {INTEGRATOR_LABELS[activeUser.eInvoiceIntegrator]}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
                  <div className="text-xs font-mono text-slate-600">
                    Aktif Mağaza: <strong className="text-slate-900">{activeUser.integratedMarketplaces.length}</strong>
                  </div>
                  {onSaveAllModules && (
                    <button
                      type="button"
                      onClick={() => onSaveAllModules(`Kullanıcı (${activeUser.fullName})`)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer shrink-0 ${
                        hasUnsavedChanges
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Kaydet</span>
                    </button>
                  )}
                  {onDeleteUser && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(activeUser)}
                      title="Kullanıcı & Şirket Unvanını Sil"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Kullanıcı & Şirket Unvanını Sil</span>
                    </button>
                  )}
                </div>
              </div>

              {activeUser.integratedMarketplaces.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Bu kullanıcıya henüz pazaryeri mağazası bağlanmamış
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Aşağıdaki pazaryeri entegrasyon formunu kullanarak Trendyol, Hepsiburada, Amazon.com.tr, N11, Pazarama, İdefix veya PttAVM mağaza API bilgilerini tanımlayabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {activeUser.integratedMarketplaces.map((cred) => (
                    <div
                      key={cred.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-sm font-bold text-slate-900">
                            {cred.marketplaceName}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-xs font-medium text-slate-700">
                            {cred.storeName}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                          <span>Satıcı ID: {cred.sellerId}</span>
                          <span aria-hidden="true">·</span>
                          <span>API Key: {cred.apiKeyMasked}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-semibold">
                            Seri: GİB Özel Entegratörü (EFT / EAR)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Komisyon: %{cred.defaultCommissionRate.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSyncUserMarketplace(cred.marketplace, cred.storeName)
                          }
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Sipariş Çek
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onRemoveUserMarketplace(activeUser.id, cred.id)
                          }
                          aria-label={`${cred.storeName} pazaryeri bağlantısını kaldır`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Connect New Marketplace to Selected User Form */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    {activeUser.fullName} Kullanıcısına Yeni Pazaryeri Entegre Et
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {MARKETPLACE_CATALOG[mpId].authType}
                </span>
              </div>

              {mpFormSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{mpFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleConnectMarketplaceSubmit} className="space-y-4 text-xs">
                {/* Marketplace Platform Selector Buttons */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Entegre Edilecek Pazaryeri Platformu
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(MARKETPLACE_CATALOG) as MarketplaceId[]).map(
                      (key) => {
                        const item = MARKETPLACE_CATALOG[key];
                        const selected = mpId === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleMarketplaceSelectChange(key)}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                              selected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="truncate">{item.name}</div>
                            <div
                              className={`text-[10px] font-mono mt-0.5 ${
                                selected ? 'text-blue-100' : 'text-slate-400'
                              }`}
                            >
                              Komisyon: %{item.defaultCommission}
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="mp-storename-input"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Pazaryeri Mağaza Adı
                    </label>
                    <input
                      id="mp-storename-input"
                      type="text"
                      value={storeName}
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        setMpFormError(null);
                      }}
                      placeholder={`Örn: ${activeUser.companyName.split(' ')[0]} ${MARKETPLACE_CATALOG[mpId].name} Mağazası`}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="mp-sellerid-input"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Satıcı ID (Supplier / Merchant ID)
                    </label>
                    <input
                      id="mp-sellerid-input"
                      type="text"
                      value={sellerId}
                      onChange={(e) => {
                        setSellerId(e.target.value);
                        setMpFormError(null);
                      }}
                      placeholder={`Örn: ${MARKETPLACE_CATALOG[mpId].defaultPrefix}-884920`}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="mp-apikey-input"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Pazaryeri API Key / Client ID
                    </label>
                    <input
                      id="mp-apikey-input"
                      type="text"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setMpFormError(null);
                      }}
                      placeholder="Örn: AK9028341928F4"
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="mp-apisecret-input"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Pazaryeri API Secret / Servis Şifresi
                    </label>
                    <input
                      id="mp-apisecret-input"
                      type="password"
                      value={apiSecret}
                      onChange={(e) => {
                        setApiSecret(e.target.value);
                        setMpFormError(null);
                      }}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      e-Belge Seri Kaynağı
                    </label>
                    <div className="w-full px-3 py-2 font-mono text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                      GİB Özel Entegratörü (EFT / EAR)
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Ön ek pazaryerinden alınmaz, GİB Entegratöründen atanır.
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="mp-commission-input"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Varsayılan Komisyon (%)
                    </label>
                    <input
                      id="mp-commission-input"
                      type="number"
                      step="0.1"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="mp-sync-select"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Sipariş Senkron Sıklığı
                    </label>
                    <select
                      id="mp-sync-select"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(e.target.value)}
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                    >
                      <option value="360">Her 6 Saatte Bir (6 Saat)</option>
                      <option value="5">Her 5 Dakikada Bir</option>
                      <option value="10">Her 10 Dakikada Bir</option>
                      <option value="15">Her 15 Dakikada Bir</option>
                      <option value="30">Her 30 Dakikada Bir</option>
                      <option value="60">Her 1 Saatte Bir</option>
                      <option value="720">Her 12 Saatte Bir</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={webhookEnabled}
                    onChange={(e) => setWebhookEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Anlık sipariş durumu değişimlerinde (Kargoya Verildi / İptal) pazaryeri Webhook bildirimini aç
                  </span>
                </label>

                {mpFormError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
                    {mpFormError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  API Bağlantısını Doğrula ve {activeUser.fullName} Hesabına Bağla
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Kullanıcı & Şirket Unvanı Silme Onay Modalı */}
      {userToDelete && onDeleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-integration-delete-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-full shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="user-integration-delete-modal-title" className="text-base font-bold text-slate-900">
                  Kullanıcı & Şirket Unvanını Silme Yetkisi
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Seçilen kullanıcı hesabı ve kayıtlı şirket unvanı sistemden kalıcı olarak silinecektir.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Kullanıcı:</span>
                <span className="font-semibold text-slate-900">{userToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Şirket Unvanı:</span>
                <span className="font-semibold text-slate-900 text-right max-w-[220px] truncate" title={userToDelete.companyName}>
                  {userToDelete.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VKN/TCKN:</span>
                <span className="font-mono text-slate-800">{userToDelete.taxIdentifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bağlı Mağaza Sayısı:</span>
                <span className="font-semibold text-blue-700 font-mono">
                  {userToDelete.integratedMarketplaces.length} Adet
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <p className="font-semibold mb-0.5">Dikkat:</p>
              <p className="text-[11px] leading-relaxed">
                Bu kullanıcı ve şirket unvanı silindiğinde bağlı tüm pazaryeri API entegrasyonları da kaldırılacaktır. Bu işlem geri alınamaz.
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
