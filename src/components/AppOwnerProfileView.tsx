import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Save,
  UserCheck,
  Building,
  MapPin,
  BadgeAlert,
  Search,
  Crown,
} from 'lucide-react';
import {
  AppOwnerProfile,
  CompanyStructureType,
} from '../types/invoicing';
import { validateTurkishTaxIdentifier } from '../utils/invoicingEngine';
import { checkMysoftRecipient } from '../services/mysoftClient';

interface AppOwnerProfileViewProps {
  appOwnerProfile: AppOwnerProfile;
  onUpdateAppOwnerProfile: (updated: AppOwnerProfile) => void;
  onSaveAllModules?: (moduleName?: string) => void;
  hasUnsavedChanges?: boolean;
}

const COMPANY_TYPE_LABELS: Record<CompanyStructureType, string> = {
  ANONIM: 'Anonim Şirket (A.Ş.)',
  LIMITED: 'Limited Şirket (Ltd. Şti.)',
  SAHIS: 'Şahıs Şirketi / Bilanço Usulü',
  KOOPERATIF: 'Kooperatif',
};

export const AppOwnerProfileView: React.FC<AppOwnerProfileViewProps> = ({
  appOwnerProfile,
  onUpdateAppOwnerProfile,
  onSaveAllModules,
  hasUnsavedChanges,
}) => {
  const [formData, setFormData] = useState<AppOwnerProfile>(appOwnerProfile);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [gibCheckResult, setGibCheckResult] = useState<{
    tested: boolean;
    registered: boolean;
    title: string;
    date: string;
    detail?: string;
  } | null>(null);
  const [mysoftChecking, setMysoftChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(appOwnerProfile);
    setSaveSuccessMsg(null);
    setGibCheckResult(null);
    setFormError(null);
  }, [appOwnerProfile]);

  const isProfileDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(appOwnerProfile);
  }, [formData, appOwnerProfile]);

  const handleMysoftVknCheck = () => {
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
    setMysoftChecking(true);
    const stamp = new Date().toLocaleString('sv-SE', {
      timeZone: 'Europe/Istanbul',
      hour12: false,
    }).slice(0, 16);

    void checkMysoftRecipient(validRes.normalizedId)
      .then((recipient) => {
        if (!recipient.title && !recipient.registered && !recipient.taxOffice) {
          setFormError('Mysoft bu VKN/TCKN için mükellef kaydı döndürmedi.');
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
      .finally(() => setMysoftChecking(false));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.ownerFullName.trim() || formData.ownerFullName.trim().length < 3) {
      setFormError('Lütfen geçerli bir uygulama sahibi adı soyadı girin (en az 3 karakter).');
      return;
    }

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

    onUpdateAppOwnerProfile(formData);
    setSaveSuccessMsg(
      `${formData.legalTitle} (${formData.ownerFullName}) uygulama sahibi resmi sicil ve şirket bilgileri başarıyla güncellendi.`
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
              GİB UBL-TR 2.1 Platform Lisans & Kurucu Sicili
            </span>
            <span className="text-xs text-slate-500">
              Uygulama Sahibi Resmi Bilgileri
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Uygulama Sahibi Bilgileri Modülü
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Faturansit platformunun yasal sahibi, kurucu yetkilisi, resmi ticaret unvanı, vergi dairesi, MERSİS ve mali müşavir bilgilerini yönetin
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Active App Owner Summary Card */}
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs">
              <p className="text-[11px] font-medium text-slate-500 leading-none">
                Uygulama Sahibi & Lisans Yetkilisi
              </p>
              <p className="font-semibold text-slate-900 mt-0.5">
                {formData.ownerFullName} · VKN: {formData.taxIdentifier}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              handleSaveProfile(e);
              if (onSaveAllModules) onSaveAllModules('Uygulama Sahibi Bilgileri');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Bilgileri Kaydet</span>
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

      {/* Main Form Formulations (Same 3-Section Format as CompanyProfileView) */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Row 1: Legal Identification & Tax Office */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                1. Resmi Ticari Kimlik ve Uygulama Sahibi Sicil Bilgileri
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              GİB UBL-TR AccountingSupplierParty
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label htmlFor="owner-full-name" className="block font-semibold text-slate-700 mb-1">
                Uygulama Sahibi Adı Soyadı *
              </label>
              <input
                id="owner-full-name"
                type="text"
                required
                value={formData.ownerFullName}
                onChange={(e) =>
                  setFormData({ ...formData, ownerFullName: e.target.value })
                }
                placeholder="Örn: İlyas Yıldırım"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="owner-legal-title" className="block font-semibold text-slate-700 mb-1">
                Resmi Ticaret Unvanı (Platform Sahibi Şirket Unvanı) *
              </label>
              <input
                id="owner-legal-title"
                type="text"
                required
                value={formData.legalTitle}
                onChange={(e) =>
                  setFormData({ ...formData, legalTitle: e.target.value })
                }
                placeholder="Örn: Faturansit Bulut Bilişim ve Elektronik Belge Teknolojileri A.Ş."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-role-title" className="block font-semibold text-slate-700 mb-1">
                Uygulama Sahibi Unvan / Görevi
              </label>
              <input
                id="owner-role-title"
                type="text"
                value={formData.ownerTitle}
                onChange={(e) =>
                  setFormData({ ...formData, ownerTitle: e.target.value })
                }
                placeholder="Örn: Uygulama Sahibi & Yönetim Kurulu Başkanı"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-brand-name" className="block font-semibold text-slate-700 mb-1">
                Ticari Marka / Uygulama Adı
              </label>
              <input
                id="owner-brand-name"
                type="text"
                value={formData.brandName}
                onChange={(e) =>
                  setFormData({ ...formData, brandName: e.target.value })
                }
                placeholder="Örn: Faturansit e-Dönüşüm & Pazaryeri Otomasyon Platformu"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-vkn" className="block font-semibold text-slate-700 mb-1">
                Vergi Kimlik Numarası (VKN / TCKN) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="owner-vkn"
                  type="text"
                  maxLength={11}
                  required
                  value={formData.taxIdentifier}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      taxIdentifier: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  className="flex-1 px-3 py-2 font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                />
                <button
                  type="button"
                  onClick={handleMysoftVknCheck}
                  disabled={mysoftChecking}
                  title="Mysoft üzerinden GİB e-Fatura / e-Arşiv mükellef sorgusu yap"
                  className="px-2.5 py-2 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Search className="w-3.5 h-3.5" />
                  {mysoftChecking ? 'Mysoft Sorgulanıyor...' : 'Mysoft ile Sorgula'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="owner-tax-office" className="block font-semibold text-slate-700 mb-1">
                Bağlı Olduğu Vergi Dairesi *
              </label>
              <input
                id="owner-tax-office"
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
              <label htmlFor="owner-type" className="block font-semibold text-slate-700 mb-1">
                Şirket Hukuki Türü
              </label>
              <select
                id="owner-type"
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
              <label htmlFor="owner-mersis" className="block font-semibold text-slate-700 mb-1">
                MERSİS Numarası (16 Hane)
              </label>
              <input
                id="owner-mersis"
                type="text"
                maxLength={16}
                value={formData.mersisNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mersisNumber: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="0389064215800001"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-registry-no" className="block font-semibold text-slate-700 mb-1">
                Ticaret Sicil Numarası
              </label>
              <input
                id="owner-registry-no"
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
              <label htmlFor="owner-registry-office" className="block font-semibold text-slate-700 mb-1">
                Ticaret Sicil Müdürlüğü
              </label>
              <input
                id="owner-registry-office"
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
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Mysoft Mükellef Doğrulandı:</strong> {gibCheckResult.title} (
                  {gibCheckResult.detail ?? (gibCheckResult.registered ? 'Aktif e-Fatura Mükellefi' : 'e-Arşiv Mükellefi')})
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
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
              Uygulama Sahibi Merkez İletişim Bilgisi
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="lg:col-span-2">
              <label htmlFor="owner-address" className="block font-semibold text-slate-700 mb-1">
                Merkez Tebligat Adresi (Cadde, Sokak, Kapı No) *
              </label>
              <input
                id="owner-address"
                type="text"
                required
                value={formData.addressLine}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine: e.target.value })
                }
                placeholder="Örn: Büyükdere Cad. No: 193 Kanyon Ofis Bloğu K: 12 D: 24"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-postal" className="block font-semibold text-slate-700 mb-1">
                Posta Kodu
              </label>
              <input
                id="owner-postal"
                type="text"
                maxLength={5}
                value={formData.postalCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    postalCode: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="34394"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-district" className="block font-semibold text-slate-700 mb-1">
                İlçe *
              </label>
              <input
                id="owner-district"
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
              <label htmlFor="owner-city" className="block font-semibold text-slate-700 mb-1">
                İl / Şehir *
              </label>
              <input
                id="owner-city"
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
              <label htmlFor="owner-email" className="block font-semibold text-slate-700 mb-1">
                Uygulama Sahibi Resmi E-posta Adresi *
              </label>
              <input
                id="owner-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="ilyasylldrm@gmail.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-kep" className="block font-semibold text-slate-700 mb-1">
                KEP Adresi (Kayıtlı Elektronik Posta)
              </label>
              <input
                id="owner-kep"
                type="email"
                value={formData.kepAddress}
                onChange={(e) =>
                  setFormData({ ...formData, kepAddress: e.target.value })
                }
                placeholder="faturansit@hs01.kep.tr"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div>
              <label htmlFor="owner-phone" className="block font-semibold text-slate-700 mb-1">
                Kurumsal Telefon
              </label>
              <input
                id="owner-phone"
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
              <label htmlFor="owner-website" className="block font-semibold text-slate-700 mb-1">
                Web Sitesi
              </label>
              <input
                id="owner-website"
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://faturansit.com.tr"
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
              <label htmlFor="owner-acc-name" className="block font-semibold text-slate-700 mb-1">
                SMMM / YMM Adı Soyadı (Opsiyonel)
              </label>
              <input
                id="owner-acc-name"
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
              <label htmlFor="owner-acc-phone" className="block font-semibold text-slate-700 mb-1">
                Müşavir Telefon / İletişim
              </label>
              <input
                id="owner-acc-phone"
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
              <label htmlFor="owner-acc-vkn" className="block font-semibold text-slate-700 mb-1">
                Müşavir TCKN / Sicil Numarası
              </label>
              <input
                id="owner-acc-vkn"
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
            Kaydedilen uygulama sahibi bilgileri, platform alt bilgisi ve resmi sistem siciline otomatik olarak yansıtılır.
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs">
              {isProfileDirty ? (
                <span className="text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Değişiklik yapıldı · Kaydetmeye hazır
                </span>
              ) : (
                <span className="text-slate-500">
                  Uygulama sahibi bilgileri güncel
                </span>
              )}
            </span>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-all duration-150"
            >
              <Save className="w-4 h-4" />
              Uygulama Sahibi Bilgilerini Kaydet
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
