import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  Plus,
} from 'lucide-react';
import {
  MarketplaceId,
  MarketplaceIntegration,
  PlatformUser,
} from '../types/invoicing';
import { formatTryCurrency } from '../utils/invoicingEngine';

interface MarketplacesViewProps {
  integrations: MarketplaceIntegration[];
  users: PlatformUser[];
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
  onGoToUserIntegrations: (userId?: string) => void;
}

export const MarketplacesView: React.FC<MarketplacesViewProps> = ({
  integrations,
  users,
  onSyncMarketplace,
  onUpdateIntegration,
  onGoToUserIntegrations,
}) => {
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [editingStore, setEditingStore] = useState<MarketplaceIntegration | null>(null);
  const [storeName, setStoreName] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [seriesPrefix, setSeriesPrefix] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [syncInterval, setSyncInterval] = useState('360');
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingStore) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingStore(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingStore]);

  const filteredIntegrations = useMemo(() => {
    if (userFilter === 'ALL') return integrations;
    return integrations.filter((i) => i.ownerUserId === userFilter);
  }, [integrations, userFilter]);

  const handleSync = (target: MarketplaceId | 'ALL') => {
    const res = onSyncMarketplace(target);
    setSyncNotice(res.message);
  };

  const openEditModal = (integ: MarketplaceIntegration) => {
    setEditingStore(integ);
    setStoreName(integ.storeName);
    setSellerId(integ.sellerId);
    setSeriesPrefix(integ.invoiceSeriesPrefix);
    setCommissionRate(String(integ.defaultCommissionRate));
    setSyncInterval(String(integ.autoSyncIntervalMinutes || 360));
    setConfigError(null);
  };

  const isStoreDirty = useMemo(() => {
    if (!editingStore) return false;
    return (
      storeName.trim() !== editingStore.storeName ||
      sellerId.trim() !== editingStore.sellerId ||
      Number(syncInterval) !== (editingStore.autoSyncIntervalMinutes || 360)
    );
  }, [editingStore, storeName, sellerId, syncInterval]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setConfigError(null);

    const cleanPrefix = (seriesPrefix || 'EFT').trim().toUpperCase().slice(0, 3) || 'EFT';

    const parsedComm = Number(commissionRate) || editingStore.defaultCommissionRate || 15.0;

    if (!storeName.trim() || !sellerId.trim()) {
      setConfigError('Mağaza adı ve Satıcı (Supplier) ID alanları boş bırakılamaz.');
      return;
    }

    onUpdateIntegration(
      editingStore.id,
      {
        storeName: storeName.trim(),
        sellerId: sellerId.trim(),
        invoiceSeriesPrefix: cleanPrefix,
        defaultCommissionRate: parsedComm,
        autoSyncIntervalMinutes: Number(syncInterval) || 360,
      },
      editingStore.integrationRecordId
    );

    setSyncNotice(
      `${editingStore.name} mağaza yapılandırması kaydedildi. Fatura seri ön ekleri GİB Özel Entegratöründen merkezi olarak alınır.`
    );
    setEditingStore(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            REST / Webhook Sipariş Akışı · Resmi e-Belge Serileri GİB Özel Entegratörü Tarafından Merkezi Yönetilir
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Pazaryeri Mağaza Entegrasyonları ({filteredIntegrations.length})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="mp-user-filter" className="sr-only">
            Kullanıcıya Göre Filtrele
          </label>
          <select
            id="mp-user-filter"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">Tüm Kullanıcıların Mağazaları ({integrations.length})</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.integratedMarketplaces.length} Mağaza)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              onGoToUserIntegrations(userFilter !== 'ALL' ? userFilter : undefined)
            }
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Kullanıcıya Yeni Pazaryeri Bağla
          </button>

          <button
            type="button"
            onClick={() => handleSync('ALL')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tüm Mağazalardan Yeni Siparişleri Çek
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Store Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((integ) => (
          <div
            key={integ.integrationRecordId ?? `${integ.id}-${integ.sellerId}`}
            className="p-5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {integ.name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">{integ.storeName}</p>
                  {integ.ownerUserName && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sorumlu Kullanıcı:{' '}
                      <button
                        type="button"
                        onClick={() => onGoToUserIntegrations(integ.ownerUserId)}
                        className="font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        {integ.ownerUserName}
                      </button>
                    </p>
                  )}
                </div>

                {/* Semantic status with icon + explicit text */}
                {integ.apiStatus === 'CONNECTED' ? (
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>API Bağlı</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Senkron Uyarısı</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div>
                  <p className="text-slate-500">Satıcı (Supplier) ID</p>
                  <p className="font-mono font-semibold text-slate-900 mt-0.5">
                    {integ.sellerId}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">e-Belge Seri Kaynağı</p>
                  <p className="font-semibold text-blue-700 mt-0.5 text-[11px]">
                    GİB Özel Entegratörü (EFT / EAR)
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Varsayılan Komisyon</p>
                  <p className="font-mono font-semibold text-slate-900 mt-0.5">
                    %{integ.defaultCommissionRate.toFixed(1)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Aylık Fatura Hacmi</p>
                  <p className="font-mono font-semibold text-slate-900 mt-0.5">
                    {formatTryCurrency(integ.monthlyVolumeTry)}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap pt-1">
                <span>Son Senkron: <span className="font-mono">{integ.lastSyncAt}</span></span>
                <span aria-hidden="true">·</span>
                <span>Periyot: {integ.autoSyncIntervalMinutes >= 60 ? `${integ.autoSyncIntervalMinutes / 60} saat` : `${integ.autoSyncIntervalMinutes} dk`}</span>
                {integ.apiKeyMasked && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">API: {integ.apiKeyMasked}</span>
                  </>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleSync(integ.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Siparişleri Senkronize Et
              </button>

              <button
                type="button"
                onClick={() => openEditModal(integ)}
                aria-label={`${integ.name} ayarlarını düzenle`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Seri & API Ayarı
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Store Configuration Modal */}
      {editingStore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="store-config-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h2 id="store-config-modal-title" className="text-sm font-semibold">
                {editingStore.name} — Mağaza ve GİB Seri Ayarları
              </h2>
              <button
                type="button"
                onClick={() => setEditingStore(null)}
                aria-label="Mağaza ayar penceresini kapat"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4 text-xs">
              <div>
                <label
                  htmlFor="edit-store-name"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Mağaza Görünen Adı
                </label>
                <input
                  id="edit-store-name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-seller-id"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Satıcı (Supplier) ID
                </label>
                <input
                  id="edit-seller-id"
                  type="text"
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-sync-interval"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Sipariş Çekme Sıklığı
                </label>
                <select
                  id="edit-sync-interval"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="360">Her 6 Saatte Bir (6 Saat)</option>
                  <option value="5">Her 5 Dakikada Bir</option>
                  <option value="15">Her 15 Dakikada Bir</option>
                  <option value="30">Her 30 Dakikada Bir</option>
                  <option value="60">Her 1 Saatte Bir</option>
                  <option value="720">Her 12 Saatte Bir</option>
                  <option value="1440">Günde 1 Kez (24 Saat)</option>
                </select>
              </div>

              {configError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium">
                  {configError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-3.5 py-2 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!isStoreDirty}
                  className={`flex items-center gap-1.5 px-4 py-2 font-semibold rounded-lg transition-all duration-150 ${
                    isStoreDirty
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
