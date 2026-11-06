export type MarketplaceId =
  | 'trendyol'
  | 'hepsiburada'
  | 'amazon'
  | 'n11'
  | 'pazarama'
  | 'ciceksepeti'
  | 'idefix'
  | 'pttavm';

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE';

export type InvoiceDocumentType = 'E_ARSIV' | 'E_FATURA';

export type InvoiceScenario = 'EARSIVFATURA' | 'TEMELFATURA' | 'TICARIFATURA';

export type OrderInvoiceStatus =
  | 'PENDING'
  | 'INVOICED'
  | 'ERROR_TAX_ID';

export type FulfillmentStage =
  | 'SIPARIS_ONAYLANDI'
  | 'HAZIRLANIYOR'
  | 'KARGOYA_VERILDI'
  | 'TESLIM_EDILDI';

export type VatRate = 1 | 10 | 20;

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'OPERATIONS';

export type EInvoiceIntegrator =
  | 'FATURANSIT'
  | 'GIB_PORTAL'
  | 'MYSOFT';

export interface UserMarketplaceCredential {
  id: string;
  userId: string;
  marketplace: MarketplaceId;
  marketplaceName: string;
  storeName: string;
  sellerId: string;
  apiKeyMasked: string;
  invoiceSeriesPrefix: string; // 3 chars e.g. TRD, HPS
  defaultCommissionRate: number;
  autoSyncIntervalMinutes: number;
  webhookEnabled: boolean;
  apiStatus: 'CONNECTED' | 'SYNC_WARNING';
  connectedAt: string;
}

export interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  companyName: string;
  taxIdentifier: string; // 10-digit VKN or 11-digit TCKN
  eInvoiceIntegrator: EInvoiceIntegrator;
  eInvoiceCreditBalance: number;
  eInvoiceCreditLimit: number;
  isActive: boolean;
  createdAt: string;
  integratedMarketplaces: UserMarketplaceCredential[];
}

export type CompanyStructureType =
  | 'ANONIM'
  | 'LIMITED'
  | 'SAHIS'
  | 'KOOPERATIF';

export interface CompanyBankAccount {
  id: string;
  bankName: string;
  branchName: string;
  currency: 'TRY' | 'USD' | 'EUR';
  iban: string;
  isDefault: boolean;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  legalTitle: string; // Resmi Ticaret Unvanı
  brandName: string; // Ticari Marka Adı
  taxIdentifier: string; // 10 haneli VKN veya 11 haneli TCKN
  taxOffice: string; // Vergi Dairesi
  companyType: CompanyStructureType;
  mersisNumber: string; // 16 haneli MERSİS no
  tradeRegistryNumber: string; // Ticaret Sicil No
  tradeRegistryOffice: string; // Ticaret Sicil Müdürlüğü (Örn: İstanbul)

  // İletişim & Tebligat Adres
  addressLine: string;
  neighborhood?: string; // Mahalle (Örn: Levent Mah.)
  street?: string; // Cadde / Sokak / Kapı No (Örn: Büyükdere Cad. No: 193)
  district: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  kepAddress: string; // Kayıtlı Elektronik Posta
  website: string;

  // GİB Parametreleri
  eInvoiceStatus: 'REGISTERED' | 'NOT_REGISTERED';
  eInvoiceAliasGb: string; // Gönderici Birim Etiketi (urn:mail:defaultgb@...)
  eInvoiceAliasPk: string; // Posta Kutusu Etiketi (urn:mail:defaultpk@...)
  integrator: EInvoiceIntegrator;
  signatureType: 'MALI_MUHUR' | 'E_IMZA';
  signatureExpiryDate: string;

  // Banka Hesapları
  bankAccounts: CompanyBankAccount[];

  // Yetkili Mali Müşavir (SMMM / YMM)
  accountantName?: string;
  accountantPhone?: string;
  accountantVkn?: string;
  updatedAt?: string;
}

export interface AppOwnerProfile {
  id: string;
  ownerFullName: string; // Uygulama Sahibi / Kurucu Yetkili Adı Soyadı
  ownerTitle: string; // Unvan / Görev (Örn: Kurucu Ortak & Lisans Sahibi)
  legalTitle: string; // Resmi Ticaret Unvanı
  brandName: string; // Ticari Marka / Uygulama Adı
  taxIdentifier: string; // 10 haneli VKN veya 11 haneli TCKN
  taxOffice: string; // Vergi Dairesi
  companyType: CompanyStructureType;
  mersisNumber: string; // 16 haneli MERSİS no
  tradeRegistryNumber: string; // Ticaret Sicil No
  tradeRegistryOffice: string; // Ticaret Sicil Müdürlüğü

  // İletişim & Tebligat Adresi
  addressLine: string;
  neighborhood?: string; // Mahalle (Örn: Levent Mah.)
  street?: string; // Cadde / Sokak / Kapı No (Örn: Büyükdere Cad. No: 193)
  district: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  kepAddress: string; // Kayıtlı Elektronik Posta
  website: string;

  // GİB Parametreleri
  eInvoiceStatus: 'REGISTERED' | 'NOT_REGISTERED';
  integrator: EInvoiceIntegrator;

  // Yetkili Mali Müşavir (SMMM / YMM)
  accountantName?: string;
  accountantPhone?: string;
  accountantVkn?: string;
  updatedAt?: string;
}

export type AuditActionCategory =
  | 'FATURA_KESIMI'
  | 'KULLANICI_YETKI'
  | 'PAZARYERI_API'
  | 'SISTEM_AYARI';

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'INVOICE'
  | 'SYNC'
  | 'EXPORT'
  | 'SYSTEM';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  category: AuditActionCategory;
  moduleName?: string;
  actionType?: AuditActionType;
  summary: string;
  changeDetails?: string;
  targetReference: string;
  ipAddress?: string;
  status: 'SUCCESS' | 'WARNING';
}

export interface SystemPlatformSettings {
  environmentMode: 'PRODUCTION' | 'SANDBOX';
  defaultWithholdingRate: number; // e.g., 1 (%)
  autoRetryGibQueue: boolean;
  maxRetryAttempts: number;
  enforceStrictVknCheck: boolean;
  defaultArchiveEmailNotification: boolean;
  primaryGibIntegrator: EInvoiceIntegrator;
  eInvoicePrefix: string; // GİB Özel Entegratör e-Fatura Resmi Seri Ön Eki (Örn: EFT)
  eArchivePrefix: string; // GİB Özel Entegratör e-Arşiv Fatura Resmi Seri Ön Eki (Örn: EAR)
  eInvoiceXsltName?: string;
  eArchiveXsltName?: string;
}

export interface OrderLineItem {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  unitPriceVatIncluded: number;
  vatRate: VatRate;
}

export type SectorType =
  | 'ALL'
  | 'ELEKTRONIK'
  | 'MODA_TEKSTIL'
  | 'KOZMETIK'
  | 'GIDA'
  | 'EV_YASAM'
  | 'OTOMOTIV'
  | 'SAGLIK_MEDIKAL'
  | 'KITAP_KIRTASIYE'
  | 'ANNE_BEBEK'
  | 'SPOR_OUTDOOR'
  | 'DIGER';

export const SECTOR_NAMES: Record<SectorType, string> = {
  ALL: 'Tüm Sektörler (Genel)',
  ELEKTRONIK: 'Elektronik & Bilişim / Teknoloji',
  MODA_TEKSTIL: 'Moda, Tekstil & Giyim',
  KOZMETIK: 'Kozmetik & Kişisel Bakım',
  GIDA: 'Gıda, İçecek & Süpermarket',
  EV_YASAM: 'Ev, Yaşam & Mobilya',
  OTOMOTIV: 'Otomotiv & Yedek Parça',
  SAGLIK_MEDIKAL: 'Sağlık, Medikal & Optik',
  KITAP_KIRTASIYE: 'Kitap, Kırtasiye & Ofis',
  ANNE_BEBEK: 'Anne & Bebek / Çocuk',
  SPOR_OUTDOOR: 'Spor & Outdoor',
  DIGER: 'Diğer Perakende / Çeşitli',
};

export interface MarketplaceOrder {
  id: string;
  marketplaceOrderNumber: string;
  marketplace: MarketplaceId;
  storeName: string;
  ownerUserId?: string;
  orderDate: string;
  sector?: SectorType;
  fulfillmentStage: FulfillmentStage;
  customerName: string;
  customerType: CustomerType;
  taxIdentifier: string; // 11-digit TCKN or 10-digit VKN
  taxOffice?: string;
  city: string;
  district: string;
  address: string;
  email: string;
  isEFaturaRegistered: boolean;
  items: OrderLineItem[];
  shippingFeeVatIncluded: number;
  includeShippingInInvoice: boolean;
  sellerDiscountTotal: number;
  marketplaceCommissionRate: number; // e.g., 16.5 for 16.5%
  withholdingRate: number; // e.g., 0 or 1 (e-ticaret stopaj %1)
  invoiceStatus: OrderInvoiceStatus;
  invoiceErrorReason?: string;
  gibInvoiceNumber?: string;
  ettn?: string;
  documentType?: InvoiceDocumentType;
  scenario?: InvoiceScenario;
  invoicedAt?: string;
  cargoTrackingCode: string;
  cargoCarrier: string;
  orderNote?: string; // Pazaryerinden senkronize edilen orijinal alıcı/sipariş notu (varsa faturaya aktarılır)
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
}

export type EDocumentSubTab =
  | 'outgoing_efatura'
  | 'outgoing_earsiv'
  | 'incoming_efatura';

export type IncomingInvoiceResponseStatus =
  | 'PENDING_APPROVAL'
  | 'ACCEPTED'
  | 'REJECTED';

export interface IncomingEInvoice {
  id: string;
  ettn: string;
  invoiceNumber: string;
  supplierTitle: string;
  supplierVkn: string;
  supplierTaxOffice: string;
  supplierCity: string;
  issueDate: string;
  receivedAt: string;
  scenario: 'TICARIFATURA' | 'TEMELFATURA';
  subtotalExclVat: number;
  totalVat: number;
  payableAmount: number;
  currency: 'TRY';
  responseStatus: IncomingInvoiceResponseStatus;
  responseAt?: string;
  rejectionReason?: string;
  responseDeadline?: string;
  lineSummary: string;
  itemCount: number;
}

export interface CalculatedOrderFinancials {
  subtotalExclVat: number;
  vatBreakdown: {
    rate1: { base: number; tax: number };
    rate10: { base: number; tax: number };
    rate20: { base: number; tax: number };
  };
  totalVat: number;
  grossInvoiceTotal: number;
  marketplaceCommissionAmount: number;
  withholdingTaxAmount: number;
  netSellerPayout: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  sector?: SectorType;
  marketplace: MarketplaceId | 'ALL';
  triggerStage: FulfillmentStage;
  customerScope: 'ALL' | 'INDIVIDUAL' | 'CORPORATE';
  autoAssignDefaultTckn: boolean;
  includeShippingLine: boolean;
  corporateScenario: 'TEMELFATURA' | 'TICARIFATURA';
  isActive: boolean;
  processedCount: number;
  lastTriggeredAt: string;
}

export interface MarketplaceIntegration {
  id: MarketplaceId;
  integrationRecordId?: string;
  ownerUserId?: string;
  ownerUserName?: string;
  name: string;
  storeName: string;
  sellerId: string;
  apiKeyMasked?: string;
  apiStatus: 'CONNECTED' | 'SYNC_WARNING';
  invoiceSeriesPrefix: string; // 3 uppercase letters e.g. TRD, HPS
  defaultCommissionRate: number;
  autoSyncIntervalMinutes: number;
  lastSyncAt: string;
  pendingOrderCount: number;
  monthlyVolumeTry: number;
}

export interface TaxReconciliationSummary {
  totalInvoicedCount: number;
  totalPendingCount: number;
  totalErrorCount: number;
  totalMatrah: number;
  totalVat: number;
  totalGrossInvoiced: number;
  totalCommissionCut: number;
  totalWithholdingCut: number;
  totalNetPayout: number;
  vatByRate: {
    rate1: { base: number; tax: number; gross: number };
    rate10: { base: number; tax: number; gross: number };
    rate20: { base: number; tax: number; gross: number };
  };
  byMarketplace: Array<{
    marketplace: MarketplaceId;
    name: string;
    orderCount: number;
    invoicedCount: number;
    grossSales: number;
    vatTotal: number;
    commissionAmount: number;
    withholdingAmount: number;
    netPayout: number;
  }>;
}

export type AccountingSoftwareTarget =
  | 'LUCA'
  | 'ZIRVE'
  | 'MIKRO'
  | 'LOGO'
  | 'EXCEL_TDHP';

export interface SmmmProfile {
  fullName: string;
  title: string;
  chamber: string;
  chamberNumber?: string;
  chamberRegistryNo?: string;
  licenseNumber: string;
  taxIdentifier: string;
  taxOffice: string;
  phone: string;
  mobile?: string;
  email: string;
  kepAddress?: string;
  officeAddress: string;
  turmobContractNumber?: string;
  turmobContractDate?: string;
  eBirlikContractNo?: string;
  contractType?: string;
  defaultSoftwareTarget?: AccountingSoftwareTarget;
  autoExportVouchers?: boolean;
  withholding1PercentReconciliation?: boolean;
  gibIntermediaryCode?: string;
  isPeriodLocked?: boolean;
  lockedPeriodName?: string;
}

export interface AccountingVoucherLine {
  id?: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  taxRate?: number;
}

export interface TaxCalendarItem {
  id: string;
  code: string;
  title: string;
  period: string;
  dueDate: string;
  deadlineDate?: string;
  daysRemaining?: number;
  status: 'BEKLIYOR' | 'HAZIRLANDI' | 'ONAYLANDI' | 'PENDING' | 'PREPARED' | 'SUBMITTED';
  type?: 'BEYANNAME' | 'BILDIRIM' | 'E_DEFTER';
  description: string;
  amount?: number;
}
