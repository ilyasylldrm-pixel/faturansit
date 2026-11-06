import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Building2,
  Bell,
  LogOut,
  Save,
  ChevronDown,
} from 'lucide-react';
import { PlatformUser } from '../types/invoicing';

export type ActiveTab =
  | 'app_owner'
  | 'admin'
  | 'edocument'
  | 'company'
  | 'edoc_settings'
  | 'orders'
  | 'stock'
  | 'reconciliation'
  | 'accountant'
  | 'marketplaces'
  | 'users'
  | 'rules';

interface TopBarProps {
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onBatchInvoiceAction?: () => void;
  pendingCount?: number;
  users?: PlatformUser[];
  selectedUserId?: string;
  onSelectUser?: (userId: string) => void;
  onSaveAllModules?: (source?: string) => void;
  hasUnsavedChanges?: boolean;
}

const TAB_ORDER: ActiveTab[] = [
  'orders',
  'stock',
  'edocument',
  'reconciliation',
  'accountant',
  'app_owner',
  'admin',
];

const TAB_META: Record<
  ActiveTab,
  { breadcrumb: string; title: string; subtitle: string }
> = {
  orders: {
    breadcrumb: 'Sipariş & Fatura Kuyruğu',
    title: 'Sipariş & Faturalandırma',
    subtitle: 'Muavin Ön Muhasebe & Pazaryeri Otomatik e-Belge Takip Programı',
  },
  stock: {
    breadcrumb: 'Stok & Depo Yönetimi',
    title: 'Stok Modülü & Envanter Takibi',
    subtitle: 'Muavin Ön Muhasebe & Barkod, Depo Bazlı Stok ve Pazaryeri Senkronizasyonu',
  },
  edocument: {
    breadcrumb: 'GİB e-Belge Merkezi',
    title: 'e-Fatura & e-Arşiv Belgeleri',
    subtitle: 'Muavin Ön Muhasebe & GİB UBL-TR 2.1 Resmi Belge Yönetimi',
  },
  reconciliation: {
    breadcrumb: 'Cari & KDV Mutabakat',
    title: 'Cari Hesaplar & KDV Mutabakatı',
    subtitle: 'Muavin Ön Muhasebe & Finansal Komisyon/Stopaj Takip Programı',
  },
  accountant: {
    breadcrumb: 'Mali Müşavir & Defter Beyan',
    title: 'Mali Müşavir Modülü',
    subtitle: 'Bilanço & İşletme Usulü Excel Aktarımı, TDHP Yevmiye & KDV İcmali',
  },
  app_owner: {
    breadcrumb: 'Platform Sicil & Lisans',
    title: 'Uygulama Sahibi Bilgileri',
    subtitle: 'Muavin Ön Muhasebe & Resmi Kurucu Sicil / Şirket Yapılandırması',
  },
  admin: {
    breadcrumb: 'Sistem & E-Dönüşüm Yönetimi',
    title: 'Admin & E-Dönüşüm Paneli',
    subtitle: 'Muavin Ön Muhasebe & Entegrasyon, Seri Ön Eki ve Kural Yönetimi',
  },
  company: {
    breadcrumb: 'Şirket Sicil Bilgileri',
    title: 'Firma / Şirket Bilgileri',
    subtitle: 'Muavin Ön Muhasebe & Vergi Mükellefi Resmi Sicil Yönetimi',
  },
  edoc_settings: {
    breadcrumb: 'E-Dönüşüm Ayarları',
    title: 'E-Dönüşüm Bilgileri',
    subtitle: 'GİB Özel Entegratör, e-Fatura & e-Arşiv Seri Ön Eki Ayarları',
  },
  marketplaces: {
    breadcrumb: 'Pazaryeri Entegrasyonları',
    title: 'Pazaryeri Mağazaları',
    subtitle: 'Trendyol, Hepsiburada, Amazon, N11 ve Pazarama API Yönetimi',
  },
  users: {
    breadcrumb: 'Mükellef & Kullanıcılar',
    title: 'Kullanıcı & Entegrasyon',
    subtitle: 'Mükellef Hesapları, GİB Kontör Dağılımı ve Mağaza Bağlantıları',
  },
  rules: {
    breadcrumb: 'Otomasyon Kuralları',
    title: 'Fatura Otomasyon Kuralları',
    subtitle: 'Kargo Aşaması, VKN Doğrulama ve Otomatik e-Belge Kesim Motoru',
  },
};

export const TopBar: React.FC<TopBarProps> = () => {
  return null;
};

