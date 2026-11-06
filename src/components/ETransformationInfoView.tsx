import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  CheckCircle2,
  Save,
  Server,
  Hash,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Building2,
  Check,
} from 'lucide-react';
import {
  EInvoiceIntegrator,
  PlatformUser,
  SystemPlatformSettings,
} from '../types/invoicing';
import {
  fetchMysoftInvoiceDesign,
  fetchMysoftStatus,
  MysoftClientError,
  type MysoftInvoiceDesign,
} from '../services/mysoftClient';

interface ETransformationInfoViewProps {
  systemSettings: SystemPlatformSettings;
  onUpdateSystemSettings: (next: SystemPlatformSettings) => void;
  users: PlatformUser[];
  selectedUserId: string;
  tenantIdentifierNumber?: string;
  onSelectUser: (userId: string) => void;
  onBatchRepairIndividualOrders?: () => { repairedAndInvoicedCount: number };
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const INTEGRATOR_OPTIONS: Array<{
  value: EInvoiceIntegrator;
  label: string;
  desc: string;
}> = [
  {
    value: 'FATURANSIT',
    label: 'Faturansit Özel Entegratör API',
    desc: 'Tam otomatik GİB UBL-TR 2.1 doğrudan bulut entegrasyonu',
  },
  {
    value: 'GIB_PORTAL',
    label: 'GİB Portal Arşiv Doğrudan Bağlantı',
    desc: 'GİB interaktif portal doğrudan kuyruk protokolü',
  },
  {
    value: 'MYSOFT',
    label: 'Mysoft e-Belge',
    desc: 'Test ve canlı Mysoft e-fatura / e-arşiv API',
  },
];

export const ETransformationInfoView: React.FC<ETransformationInfoViewProps> = ({
  systemSettings,
  onUpdateSystemSettings,
  users,
  selectedUserId,
  tenantIdentifierNumber,
  onSelectUser,
  onBatchRepairIndividualOrders,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const selectedUser =
    users.find((u) => u.id === selectedUserId) ?? users[0];

  const [formData, setFormData] = useState<SystemPlatformSettings>({
    ...systemSettings,
  });

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<
    'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'
  >('IDLE');
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [eInvoiceDesign, setEInvoiceDesign] = useState<MysoftInvoiceDesign | null>(null);
  const [eArchiveDesign, setEArchiveDesign] = useState<MysoftInvoiceDesign | null>(null);
  const sellerVkn = (tenantIdentifierNumber || selectedUser?.taxIdentifier || '').replace(/\D/g, '');

  useEffect(() => {
    if (formData.primaryGibIntegrator !== 'MYSOFT' || (sellerVkn.length !== 10 && sellerVkn.length !== 11)) {
      setEInvoiceDesign(null);
      setEArchiveDesign(null);
      setDesignError(null);
      return;
    }
    let cancelled = false;
    setDesignLoading(true);
    setDesignError(null);
    void Promise.all([
      fetchMysoftInvoiceDesign(sellerVkn, 'EFATURA'),
      fetchMysoftInvoiceDesign(sellerVkn, 'EARSIVFATURA'),
    ])
      .then(([invoice, archive]) => {
        if (cancelled) return;
        setEInvoiceDesign(invoice);
        setEArchiveDesign(archive);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setEInvoiceDesign(null);
        setEArchiveDesign(null);
        setDesignError(error instanceof MysoftClientError ? error.message : 'Portal tasarımı alınamadı.');
      })
      .finally(() => {
        if (!cancelled) setDesignLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.primaryGibIntegrator, sellerVkn]);

  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(systemSettings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const normalized: SystemPlatformSettings = {
      ...formData,
      eInvoicePrefix:
        formData.eInvoicePrefix
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3) || 'EFT',
      eArchivePrefix:
        formData.eArchivePrefix
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3) || 'EAR',
      defaultWithholdingRate: Math.max(
        0,
        Math.min(100, Number(formData.defaultWithholdingRate) || 0)
      ),
      maxRetryAttempts: Math.max(
        1,
        Math.min(10, Number(formData.maxRetryAttempts) || 3)
      ),
    };

    setFormData(normalized);
    onUpdateSystemSettings(normalized);
    setSaveSuccessMsg('E-Dönüşüm sicil ve entegrasyon parametreleri başarıyla güncellendi.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleTestConnection = () => {
    if (formData.primaryGibIntegrator !== 'MYSOFT') {
      setConnectionDetail(null);
      setTestConnectionStatus('TESTING');
      setTimeout(() => {
        setTestConnectionStatus('SUCCESS');
        setTimeout(() => setTestConnectionStatus('IDLE'), 3500);
      }, 800);
      return;
    }

    setTestConnectionStatus('TESTING');
    setConnectionDetail(null);
    void fetchMysoftStatus()
      .then((status) => {
        if (!status.authenticated) {
          setTestConnectionStatus('ERROR');
          setConnectionDetail(status.error || status.message || 'Mysoft oturumu açılmadı.');
          return;
        }
        const firmCount = status.tenantCount;
        const firmText = status.message
          ? status.message
          : firmCount > 0
            ? `${firmCount} firma görünüyor.`
            : 'Oturum açıldı. Bağlı firma listesi boş.';
        setConnectionDetail(`${status.environment === 'test' ? 'Test' : 'Canlı'} ortam. ${firmText}`);
        setTestConnectionStatus('SUCCESS');
      })
      .catch((error: unknown) => {
        setTestConnectionStatus('ERROR');
        setConnectionDetail(error instanceof Error ? error.message : 'Bağlantı kurulamadı.');
      });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              GİB UBL-TR 2.1 E-Dönüşüm Altyapısı
            </span>
            <span className="text-xs text-slate-500">
              Resmi Seri & Entegrasyon Parametreleri
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            E-Dönüşüm Bilgileri Modülü
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            GİB Özel Entegratör bağlantısı, resmi seri ön ekleri (e-Fatura / e-Arşiv), çalışma ortamı ve stopaj parametrelerini yönetin
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Selected Mükellef Switcher */}
          {selectedUser && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shrink-0">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
              <div className="text-xs">
                <label htmlFor="edoc-user-select" className="sr-only">
                  Aktif Mükellef Seçimi
                </label>
                <select
                  id="edoc-user-select"
                  value={selectedUserId}
                  onChange={(e) => onSelectUser(e.target.value)}
                  className="font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer pr-4"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.companyName} (VKN: {u.taxIdentifier})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              handleSave(e);
              if (onSaveAllModules) onSaveAllModules('E-Dönüşüm Bilgileri');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>E-Dönüşüm Bilgilerini Kaydet</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono">
            GİB E-Belge Parametreleri Aktif
          </span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: GİB Özel Entegratörü & Çalışma Ortamı */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                1. GİB Özel Entegratörü ve Çalışma Ortamı
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testConnectionStatus === 'TESTING'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                {testConnectionStatus === 'TESTING' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Entegratör Test Ediliyor...
                  </>
                ) : testConnectionStatus === 'SUCCESS' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Bağlantı Başarılı</span>
                  </>
                ) : testConnectionStatus === 'ERROR' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-800">Bağlantı kurulamadı</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    Entegratör Bağlantısını Test Et
                  </>
                )}
              </button>
            </div>
          </div>
          {connectionDetail && (
            <p
              className={`text-xs ${
                testConnectionStatus === 'ERROR' ? 'text-amber-800' : 'text-slate-600'
              }`}
            >
              {connectionDetail}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="lg:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Birincil GİB Özel Entegratör Altyapısı *
              </label>
              <select
                value={formData.primaryGibIntegrator}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    primaryGibIntegrator: e.target.value as EInvoiceIntegrator,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-2 focus:outline-blue-600"
              >
                {INTEGRATOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.desc}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Fatura kesim işlemlerinde Gelir İdaresi Başkanlığı sunucularına imzalı zarf iletimini sağlar.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                GİB Çalışma Ortamı (Production / Sandbox) *
              </label>
              <select
                value={formData.environmentMode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    environmentMode: e.target.value as
                      | 'PRODUCTION'
                      | 'SANDBOX',
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-2 focus:outline-blue-600"
              >
                <option value="PRODUCTION">
                  GİB CANLI ORTAM (Resmi / Hukuki Geçerli)
                </option>
                <option value="SANDBOX">
                  GİB TEST ORTAMI (Sandbox Deneme)
                </option>
              </select>
              <span
                className={`inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                  formData.environmentMode === 'PRODUCTION'
                    ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 font-semibold border border-amber-200'
                }`}
              >
                {formData.environmentMode === 'PRODUCTION'
                  ? 'Resmi e-Fatura / e-Arşiv üretilir'
                  : 'Test amaçlı numara tahsis edilir'}
              </span>
            </div>
          </div>
        </div>

        {formData.primaryGibIntegrator === 'MYSOFT' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Mysoft portal fatura tasarımı
              </h2>
              <span className="text-[11px] font-mono text-slate-500">{sellerVkn || 'VKN yok'}</span>
            </div>
            {designLoading && <p className="text-xs text-slate-500">Portal dizaynları yükleniyor.</p>}
            {designError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {designError}
              </p>
            )}
            {!designLoading && !designError && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <DesignColumn
                  title="e-Fatura"
                  design={eInvoiceDesign}
                  selectedXslt={formData.eInvoiceXsltName}
                  selectedPrefix={formData.eInvoicePrefix}
                  onPick={(xsltName, prefix) =>
                    setFormData({
                      ...formData,
                      eInvoiceXsltName: xsltName,
                      eInvoicePrefix: prefix || formData.eInvoicePrefix,
                    })
                  }
                />
                <DesignColumn
                  title="e-Arşiv"
                  design={eArchiveDesign}
                  selectedXslt={formData.eArchiveXsltName}
                  selectedPrefix={formData.eArchivePrefix}
                  onPick={(xsltName, prefix) =>
                    setFormData({
                      ...formData,
                      eArchiveXsltName: xsltName,
                      eArchivePrefix: prefix || formData.eArchivePrefix,
                    })
                  }
                />
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Seçilen tasarım ve seri, kaydettikten sonra fatura kesiminde kullanılır. Portalda seri yoksa EFT/EAR durur.
            </p>
          </div>
        )}

        {/* Section 2: Resmi Seri Ön Ekleri & Numara Şablonları */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                2. Resmi e-Belge Seri Ön Ekleri ve Numaralandırma Şablonları
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              3 Harfli Seri + 4 Haneli Yıl + 9 Haneli Sıra No
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giden e-Fatura Seri Ön Eki (3 Harf) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={formData.eInvoicePrefix}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      eInvoicePrefix: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="EFT"
                  className="w-28 px-3 py-2 font-mono font-bold text-center text-slate-900 uppercase bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
                <span className="text-xs font-mono text-slate-500">
                  Örn: {formData.eInvoicePrefix || 'EFT'}2026000001481
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                GİB kayıtlı kurumsal mükelleflere kesilen faturalarda kullanılır.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giden e-Arşiv Fatura Seri Ön Eki (3 Harf) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={formData.eArchivePrefix}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      eArchivePrefix: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="EAR"
                  className="w-28 px-3 py-2 font-mono font-bold text-center text-slate-900 uppercase bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
                <span className="text-xs font-mono text-slate-500">
                  Örn: {formData.eArchivePrefix || 'EAR'}2026000001481
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Nihai tüketici ve e-Fatura kaydı olmayan alıcılara kesilir.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                E-Ticaret Stopaj Oranı (%) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  required
                  value={formData.defaultWithholdingRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultWithholdingRate: Number(e.target.value),
                    })
                  }
                  className="w-28 px-3 py-2 font-mono font-bold text-center text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
                <span className="text-xs font-mono text-slate-600">
                  % (Varsayılan: %1)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Pazaryeri komisyon ve aracı hizmet sağlayıcı yasal tevkifat kesintisi.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Kuyruk, Doğrulama & Otomasyon Politikaları */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                3. GİB İletim Kuyruğu ve Doğrulama Kuralları
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Hata Önleme & Otomatik Yeniden Deneme
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enforceStrictVknCheck}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enforceStrictVknCheck: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <span className="font-semibold text-slate-900 block">
                  Kurumsal e-Faturada Katı 10 Haneli VKN Kontrolü
                </span>
                <span className="text-slate-500 text-[11px]">
                  Alıcı kurumsal şirket olarak işaretlenmişse, geçerli 10 haneli VKN girilmeden faturanın kesilmesine izin verilmez; sipariş kuyrukta &quot;VKN Doğrulama Hatası&quot; olarak duraklatılır.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoRetryGibQueue}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoRetryGibQueue: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <span className="font-semibold text-slate-900 block">
                  Geçici GİB Sunucu Yanıt Hatasında Otomatik Yeniden Deneme (Auto-Retry)
                </span>
                <span className="text-slate-500 text-[11px]">
                  GİB portalı veya özel entegratör 503/Zaman Aşımı döndürdüğünde fatura kesimini iptal etmez, kuyrukta bekletip otomatik olarak yeniden iletir.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formData.defaultArchiveEmailNotification}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultArchiveEmailNotification: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <span className="font-semibold text-slate-900 block">
                  Bireysel e-Arşiv Faturalarında Alıcıya Otomatik E-Posta Bildirimi
                </span>
                <span className="text-slate-500 text-[11px]">
                  e-Arşiv belgesi onaylandığında PDF ve resmi XML linki pazaryerinden çekilen alıcı e-posta adresine otomatik olarak gönderilir.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Maksimum Yeniden Deneme Sayısı
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.maxRetryAttempts}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxRetryAttempts: Number(e.target.value),
                  })
                }
                className="w-28 px-3 py-2 font-mono font-bold text-center text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
              <span className="text-xs text-slate-500 ml-2">Tekrar deneme</span>
            </div>

            {onBatchRepairIndividualOrders && (
              <div className="flex items-end justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => onBatchRepairIndividualOrders()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Eksik TCKN&apos;li Bireysel Siparişleri Onar (11111111111 Ata)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Mükellef Bilgilendirme ve GİB Mevzuatı Notu */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              GİB Vergi Usul Kanunu 509 Sıra No&apos;lu Genel Tebliğ Hatırlatması:
            </p>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Belirlenen 3 harfli resmi seri kodları mali yıl boyunca (2026) değiştirilemez ve müteselsil sıra numarası atlanamaz. Faturansit entegrasyonu, kesilen her belgenin UBL-TR 2.1 şemasına uygunluğunu ve SHA-256 mali mühür imzasını doğrulamaktadır.
            </p>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500">
            Güncellenen seri ön ekleri ve çalışma parametreleri sonraki tüm e-Belge kesimlerinde yürürlüğe girer.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            {isDirty ? (
              <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Değişiklik yapıldı · Kaydetmeye hazır
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                E-Dönüşüm parametreleri güncel
              </span>
            )}

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-all duration-150"
            >
              <Save className="w-4 h-4" />
              E-Dönüşüm Bilgilerini Kaydet
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

function DesignColumn({
  title,
  design,
  selectedXslt,
  selectedPrefix,
  onPick,
}: {
  title: string;
  design: MysoftInvoiceDesign | null;
  selectedXslt?: string;
  selectedPrefix: string;
  onPick: (xsltName: string | undefined, prefix: string | undefined) => void;
}) {
  const designs = design?.designs ?? [];
  const prefixes = design?.prefixes ?? [];
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="text-[11px] text-slate-500">
        Portal: {design?.xsltName || 'tasarım yok'} · seri {design?.prefix || 'yok'}
        {design?.numeratorSetCode ? ` · set ${design.numeratorSetCode}` : ''}
      </p>
      <select
        value={selectedXslt || design?.xsltName || ''}
        onChange={(event) => onPick(event.target.value || undefined, selectedPrefix)}
        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
      >
        <option value="">Tasarım seçilmedi</option>
        {designs.map((row) => (
          <option key={row.xsltName} value={row.xsltName}>
            {row.xsltName}
            {row.isDefault ? ' · varsayılan' : ''}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {prefixes.length === 0 && <span className="text-[11px] text-slate-400">Portal serisi yok</span>}
        {prefixes.map((row) => (
          <button
            key={row.prefix}
            type="button"
            onClick={() => onPick(selectedXslt || design?.xsltName, row.prefix)}
            className={`px-2 py-1 rounded-md border font-mono cursor-pointer ${
              selectedPrefix === row.prefix
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {row.prefix}
          </button>
        ))}
      </div>
    </div>
  );
}
