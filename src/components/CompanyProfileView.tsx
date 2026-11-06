import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  CheckCircle2,
  Save,
  UserCheck,
  Building,
  MapPin,
  BadgeAlert,
  Search,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  CompanyProfile,
  CompanyStructureType,
  PlatformUser,
} from '../types/invoicing';
import { validateTurkishTaxIdentifier } from '../utils/invoicingEngine';
import { checkMysoftRecipient } from '../services/mysoftClient';

interface CompanyProfileViewProps {
  users: PlatformUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  companyProfiles: Record<string, CompanyProfile>;
  onUpdateCompanyProfile: (userId: string, updated: CompanyProfile) => void;
  onDeleteUser?: (userId: string) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const COMPANY_TYPE_LABELS: Record<CompanyStructureType, string> = {
  ANONIM: 'Anonim Şirket (A.Ş.)',
  LIMITED: 'Limited Şirket (Ltd. Şti.)',
  SAHIS: 'Şahıs Şirketi / Bilanço Usulü',
  KOOPERATIF: 'Kooperatif',
};

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  companyProfiles,
  onUpdateCompanyProfile,
  onDeleteUser,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const selectedUser =
    users.find((u) => u.id === selectedUserId) ?? users[0];
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!selectedUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs">
        Görüntülenecek veya düzenlenecek kayıtlı firma / şirket unvanı bulunamadı.
      </div>
    );
  }

  const defaultProfile: CompanyProfile = companyProfiles[selectedUserId] ?? {
    id: `cp-${selectedUserId}`,
    userId: selectedUserId,
    legalTitle: selectedUser.companyName,
    brandName: selectedUser.companyName,
    taxIdentifier: selectedUser.taxIdentifier,
    taxOffice: 'Maslak Vergi Dairesi',
    companyType: 'ANONIM',
    mersisNumber: `0${selectedUser.taxIdentifier}00001`,
    tradeRegistryNumber: '948271',
    tradeRegistryOffice: 'İstanbul Ticaret Sicil Müdürlüğü',
    addressLine: 'Büyükdere Cad. No: 193 Kanyon Ofis K: 8 D: 14',
    district: 'Levent / Beşiktaş',
    city: 'İstanbul',
    postalCode: '34394',
    phone: selectedUser.phone,
    email: selectedUser.email,
    kepAddress: 'anadoludijital@hs01.kep.tr',
    website: 'https://anadoludijital.com.tr',
    eInvoiceStatus: 'REGISTERED',
    eInvoiceAliasGb: `urn:mail:defaultgb@${selectedUser.email.split('@')[1] ?? 'faturansit.com'}`,
    eInvoiceAliasPk: `urn:mail:defaultpk@${selectedUser.email.split('@')[1] ?? 'faturansit.com'}`,
    integrator: selectedUser.eInvoiceIntegrator,
    signatureType: 'MALI_MUHUR',
    signatureExpiryDate: '2028-06-15',
    bankAccounts: [
      {
        id: 'ba-default',
        bankName: 'Akbank T.A.Ş.',
        branchName: 'Levent Kurumsal Şube',
        currency: 'TRY',
        iban: 'TR34 0004 6000 8129 3847 1029 34',
        isDefault: true,
      },
    ],
    accountantName: 'Cemil Taşpınar (YMM)',
    accountantPhone: '+90 212 284 11 22',
    accountantVkn: '8192049182',
  };

  const [formData, setFormData] = useState<CompanyProfile>(defaultProfile);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [gibCheckResult, setGibCheckResult] = useState<{
    tested: boolean;
    registered: boolean;
    title: string;
    date: string;
    detail: string;
  } | null>(null);
  const [gibChecking, setGibChecking] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const profile = companyProfiles[selectedUserId] ?? defaultProfile;
    setFormData(profile);
    setSaveSuccessMsg(null);
    setGibCheckResult(null);
    setFormError(null);
  }, [selectedUserId, companyProfiles]);

  const isProfileDirty = useMemo(() => {
    const saved = companyProfiles[selectedUserId] ?? defaultProfile;
    return JSON.stringify(formData) !== JSON.stringify(saved);
  }, [formData, companyProfiles, selectedUserId, defaultProfile]);

  const handleMysoftGibCheck = () => {
    const cleanVkn = formData.taxIdentifier.replace(/\D/g, '');
    const validRes = validateTurkishTaxIdentifier(
      cleanVkn,
      cleanVkn.length === 11 ? 'INDIVIDUAL' : 'CORPORATE',
      false
    );

    if (!validRes.valid) {
      setFormError(`Geçersiz Vergi Numarası: ${validRes.error}`);
      return;
    }

    setFormError(null);
    setGibChecking(true);
    const stamp = new Date().toLocaleString('sv-SE', {
      timeZone: 'Europe/Istanbul',
      hour12: false,
    }).slice(0, 16);
    void checkMysoftRecipient(validRes.normalizedId)
      .then((recipient) => {
        if (!recipient.title && !recipient.registered && !recipient.taxOffice) {
          setFormError('Mysoft bu numara için mükellef kaydı döndürmedi.');
          setGibCheckResult(null);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          legalTitle: recipient.title || prev.legalTitle,
          taxOffice: recipient.taxOffice || prev.taxOffice,
          city: recipient.city || prev.city,
          district: recipient.district || prev.district,
          addressLine: recipient.address || prev.addressLine,
          eInvoiceStatus: recipient.registered ? 'REGISTERED' : 'NOT_REGISTERED',
          eInvoiceAliasPk: recipient.pkAlias || prev.eInvoiceAliasPk,
        }));
        setGibCheckResult({
          tested: true,
          registered: recipient.registered,
          title: recipient.title || formData.legalTitle,
          date: stamp,
          detail: recipient.registered
            ? 'Mysoft üzerinden Aktif e-Fatura mükellefi olarak doğrulandı'
            : 'Mysoft üzerinden e-Arşiv mükellefi olarak doğrulandı (e-Fatura posta kutusu yok)',
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Mysoft mükellef sorgusu başarısız.';
        setFormError(message);
        setGibCheckResult(null);
      })
      .finally(() => setGibChecking(false));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.legalTitle.trim() || formData.legalTitle.trim().length < 5) {
      setFormError('Lütfen geçerli bir resmi şirket unvanı girin (en az 5 karakter).');
      return;
    }

    const vknCheck = validateTurkishTaxIdentifier(
      formData.taxIdentifier,
      formData.taxIdentifier.replace(/\D/g, '').length === 11 ? 'INDIVIDUAL' : 'CORPORATE',
      false
    );

    if (!vknCheck.valid) {
      setFormError(`Vergi Kimlik Numarası hatası: ${vknCheck.error}`);
      return;
    }

    onUpdateCompanyProfile(selectedUserId, formData);
    setSaveSuccessMsg(
      `${formData.legalTitle} resmi firma ve şirket bilgileri başarıyla güncellendi.`
    );
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              GİB UBL-TR 2.1 Mükellef Sicil
            </span>
            <span className="text-xs text-slate-500">
              e-Fatura / e-Arşiv Resmi Satıcı Bilgileri
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Firma ve Şirket Bilgileri Modülü
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Faturansit üzerinden kesilen tüm resmi e-Fatura ve e-Arşiv belgelerinde yer alacak ticari unvan, vergi dairesi, MERSİS ve mali müşavir bilgilerini yönetin
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Mükellef Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shrink-0">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
            <div className="text-xs">
              <label htmlFor="company-user-select" className="sr-only">
                Aktif Mükellef Şirket Seçimi
              </label>
              <select
                id="company-user-select"
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

          <button
            type="button"
            onClick={(e) => {
              handleSaveProfile(e);
              if (onSaveAllModules) onSaveAllModules(`Firma Bilgileri (${selectedUser.companyName})`);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Firma Bilgilerini Kaydet</span>
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
            GİB Mükellef Veritabanı ile Senkronize
          </span>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium">
          <BadgeAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Form Formulations */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Row 1: Legal Identification & Tax Office */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                1. Resmi Ticari Kimlik ve Sicil Bilgileri
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              GİB UBL-TR AccountingSupplierParty
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="lg:col-span-2">
              <label htmlFor="comp-legal-title" className="block font-semibold text-slate-700 mb-1">
                Resmi Ticaret Unvanı (Faturalarda Çıkacak Tam Ad) *
              </label>
              <input
                id="comp-legal-title"
                type="text"
                required
                value={formData.legalTitle}
                onChange={(e) =>
                  setFormData({ ...formData, legalTitle: e.target.value })
                }
                placeholder="Örn: Anadolu Dijital Ticaret ve Lojistik A.Ş."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-brand-name" className="block font-semibold text-slate-700 mb-1">
                Ticari Marka / İşletme Adı
              </label>
              <input
                id="comp-brand-name"
                type="text"
                value={formData.brandName}
                onChange={(e) =>
                  setFormData({ ...formData, brandName: e.target.value })
                }
                placeholder="Örn: Anadolu Dijital & Faturansit"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-vkn" className="block font-semibold text-slate-700 mb-1">
                Vergi Kimlik Numarası (VKN / TCKN) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="comp-vkn"
                  type="text"
                  maxLength={11}
                  required
                  value={formData.taxIdentifier}
                  onChange={(e) =>
                    setFormData({ ...formData, taxIdentifier: e.target.value.replace(/\D/g, '') })
                  }
                  className="flex-1 px-3 py-2 font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
                <button
                  type="button"
                  onClick={handleMysoftGibCheck}
                  disabled={gibChecking}
                  title="Mysoft üzerinden GİB e-Fatura / e-Arşiv mükellef sorgusu yap"
                  className="px-2.5 py-2 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Search className="w-3.5 h-3.5" />
                  {gibChecking ? 'Mysoft Sorgulanıyor...' : 'Mysoft ile Sorgula'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="comp-tax-office" className="block font-semibold text-slate-700 mb-1">
                Bağlı Olduğu Vergi Dairesi *
              </label>
              <input
                id="comp-tax-office"
                type="text"
                required
                value={formData.taxOffice}
                onChange={(e) =>
                  setFormData({ ...formData, taxOffice: e.target.value })
                }
                placeholder="Örn: Maslak Vergi Dairesi"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-type" className="block font-semibold text-slate-700 mb-1">
                Şirket Hukuki Türü
              </label>
              <select
                id="comp-type"
                value={formData.companyType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    companyType: e.target.value as CompanyStructureType,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              >
                {Object.entries(COMPANY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="comp-mersis" className="block font-semibold text-slate-700 mb-1">
                MERSİS Numarası (16 Hane)
              </label>
              <input
                id="comp-mersis"
                type="text"
                maxLength={16}
                value={formData.mersisNumber}
                onChange={(e) =>
                  setFormData({ ...formData, mersisNumber: e.target.value.replace(/\D/g, '') })
                }
                placeholder="0389064215800001"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-registry-no" className="block font-semibold text-slate-700 mb-1">
                Ticaret Sicil Numarası
              </label>
              <input
                id="comp-registry-no"
                type="text"
                value={formData.tradeRegistryNumber}
                onChange={(e) =>
                  setFormData({ ...formData, tradeRegistryNumber: e.target.value })
                }
                placeholder="Örn: 948271"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-registry-office" className="block font-semibold text-slate-700 mb-1">
                Ticaret Sicil Müdürlüğü
              </label>
              <input
                id="comp-registry-office"
                type="text"
                value={formData.tradeRegistryOffice}
                onChange={(e) =>
                  setFormData({ ...formData, tradeRegistryOffice: e.target.value })
                }
                placeholder="Örn: İstanbul Ticaret Sicil Müdürlüğü"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>
          </div>

          {gibCheckResult && (
            <div
              className={`mt-3 p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                gibCheckResult.registered
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Mysoft Mükellef Doğrulandı:</strong> {gibCheckResult.title || 'Mükellef'} ({gibCheckResult.detail})
                </span>
              </div>
              <span className="font-mono text-[11px]">
                Sorgu Zamanı: {gibCheckResult.date}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Registered Address & Communication */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                2. Resmi Tebligat Adresi ve İletişim Kanalları
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Fatura Başlık Bilgisi
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="lg:col-span-2">
              <label htmlFor="comp-address" className="block font-semibold text-slate-700 mb-1">
                Merkez Tebligat Adresi (Cadde, Sokak, Kapı No) *
              </label>
              <input
                id="comp-address"
                type="text"
                required
                value={formData.addressLine}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine: e.target.value })
                }
                placeholder="Örn: Büyükdere Cad. No: 193 Kanyon Ofis K: 8 D: 14"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-postal" className="block font-semibold text-slate-700 mb-1">
                Posta Kodu
              </label>
              <input
                id="comp-postal"
                type="text"
                maxLength={5}
                value={formData.postalCode}
                onChange={(e) =>
                  setFormData({ ...formData, postalCode: e.target.value.replace(/\D/g, '') })
                }
                placeholder="34394"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-district" className="block font-semibold text-slate-700 mb-1">
                İlçe *
              </label>
              <input
                id="comp-district"
                type="text"
                required
                value={formData.district}
                onChange={(e) =>
                  setFormData({ ...formData, district: e.target.value })
                }
                placeholder="Örn: Beşiktaş"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-city" className="block font-semibold text-slate-700 mb-1">
                İl / Şehir *
              </label>
              <input
                id="comp-city"
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="Örn: İstanbul"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-email" className="block font-semibold text-slate-700 mb-1">
                Kurumsal e-Belge E-posta Adresi *
              </label>
              <input
                id="comp-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="muhasebe@anadoludijital.com.tr"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-kep" className="block font-semibold text-slate-700 mb-1">
                KEP Adresi (Kayıtlı Elektronik Posta)
              </label>
              <input
                id="comp-kep"
                type="email"
                value={formData.kepAddress}
                onChange={(e) =>
                  setFormData({ ...formData, kepAddress: e.target.value })
                }
                placeholder="anadoludijital@hs01.kep.tr"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-phone" className="block font-semibold text-slate-700 mb-1">
                Kurumsal Telefon
              </label>
              <input
                id="comp-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+90 212 381 90 00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-website" className="block font-semibold text-slate-700 mb-1">
                Web Sitesi
              </label>
              <input
                id="comp-website"
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://anadoludijital.com.tr"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Certified Public Accountant (SMMM / YMM) Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                3. Yetkili Mali Müşavir / Muhasebe İletişim Bilgileri (SMMM / YMM)
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Beyanname & KDV Mutabakat Sorumlusu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label htmlFor="comp-acc-name" className="block font-semibold text-slate-700 mb-1">
                SMMM / YMM Adı Soyadı (Opsiyonel)
              </label>
              <input
                id="comp-acc-name"
                type="text"
                value={formData.accountantName ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, accountantName: e.target.value })
                }
                placeholder="Örn: Cemil Taşpınar (YMM)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-acc-phone" className="block font-semibold text-slate-700 mb-1">
                Müşavir Telefon / İletişim
              </label>
              <input
                id="comp-acc-phone"
                type="tel"
                value={formData.accountantPhone ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, accountantPhone: e.target.value })
                }
                placeholder="+90 212 284 11 22"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="comp-acc-vkn" className="block font-semibold text-slate-700 mb-1">
                Müşavir TCKN / Sicil Numarası
              </label>
              <input
                id="comp-acc-vkn"
                type="text"
                value={formData.accountantVkn ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, accountantVkn: e.target.value })
                }
                placeholder="Örn: 8192049182"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500">
            Kaydedilen bilgiler, kesilen tüm e-Fatura ve e-Arşiv belgelerine otomatik olarak yansıtılır.
          </p>

          <div className="flex items-center gap-2.5 shrink-0">
            {onDeleteUser && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                title="Kullanıcı & Şirket Unvanını Sil"
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Kullanıcı & Şirket Unvanını Sil</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs">
                {isProfileDirty ? (
                  <span className="text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Değişiklik yapıldı · Kaydetmeye hazır
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Firma bilgileri güncel
                  </span>
                )}
              </span>

              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-all duration-150"
              >
                <Save className="w-4 h-4" />
                Firma ve Şirket Bilgilerini Kaydet
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Kullanıcı & Şirket Unvanı Silme Onay Modalı */}
      {showDeleteModal && onDeleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comp-delete-user-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-full shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="comp-delete-user-modal-title" className="text-base font-bold text-slate-900">
                  Kullanıcı & Şirket Unvanını Silme Yetkisi
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Seçilen kullanıcı hesabı ve resmi şirket unvanı sistemden kalıcı olarak kaldırılacaktır.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Kullanıcı:</span>
                <span className="font-semibold text-slate-900">{selectedUser.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resmi Şirket Unvanı:</span>
                <span className="font-semibold text-slate-900 text-right max-w-[220px] truncate" title={formData.legalTitle}>
                  {formData.legalTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VKN / TCKN:</span>
                <span className="font-mono text-slate-800">{formData.taxIdentifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entegratör:</span>
                <span className="font-medium text-slate-800">
                  Mysoft e-Belge
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <p className="font-semibold">Kalıcı Silme Uyarısı:</p>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Bu şirket unvanı ve kullanıcı hesabı silindiğinde, bağlı pazaryeri mağazaları ve fatura sicili sistemden kalıcı olarak kaldırılır.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteUser(selectedUser.id);
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
