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
  | 'MYSOFT'
  | 'FATURANSIT';

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
  district: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  kepAddress: string; // Kayıtlı Elektronik Posta
  website: string;

  // GİB e-Dönüşüm Parametreleri
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
}

export type AuditActionCategory =
  | 'FATURA_KESIMI'
  | 'KULLANICI_YETKI'
  | 'PAZARYERI_API'
  | 'SISTEM_AYARI';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  category: AuditActionCategory;
  summary: string;
  targetReference: string;
  status: 'SUCCESS' | 'WARNING';
}

export interface MysoftApiConfig {
  serviceUrl?: string;
  testServiceUrl?: string;
  endpoint?: string;
  environment: 'PRODUCTION' | 'SANDBOX';
  username: string;
  password?: string;
  passwordMasked?: string;
  apiKey?: string;
  apiKeyMasked?: string;
  vknTckn?: string;
  tenantVkn?: string;
  senderAliasGb?: string;
  receiverAliasPk?: string;
  gbAlias?: string;
  pkAlias?: string;
  eInvoicePrefix?: string;
  eArchivePrefix?: string;
  eDespatchPrefix?: string;
  eProducerPrefix?: string;
  autoSendGib?: boolean;
  autoApproveBasic?: boolean;
  creditBalance: number;
  creditLimit?: number;
  lastCreditSync?: string;
  lastPingAt?: string;
  pingLatencyMs?: number;
  isVerified?: boolean;
  isConnected?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  autoSyncStatusMinutes?: number;
}

export interface MysoftTaxpayerLookupResult {
  vknTckn: string;
  title: string;
  isEInvoiceUser?: boolean;
  isEFaturaPayer?: boolean;
  isEDespatchUser?: boolean;
  isEIrsaliyePayer?: boolean;
  isEArchiveUser?: boolean;
  firstRegisteredDate?: string;
  firstRegistrationDate?: string;
  aliasesGb?: string[];
  aliasesPk?: string[];
  gbAlias?: string;
  pkAlias?: string;
  scenario?: InvoiceScenario | string;
  systemType?: 'E_FATURA' | 'E_ARSIV' | string;
  lookupTimestamp?: string;
  queryTimestamp?: string;
  taxOffice?: string;
  city?: string;
}

export interface MysoftInvoiceStatusRecord {
  id?: string;
  ettn: string;
  orderId?: string;
  marketplaceOrderId?: string;
  invoiceNumber?: string;
  gibInvoiceNumber?: string;
  customerTitle?: string;
  customerName?: string;
  customerVkn: string;
  documentType?: 'E_FATURA' | 'E_ARSIV';
  scenario?: string;
  gibStatusCode?: number;
  statusCode?: number;
  gibStatusDescription?: string;
  statusDescription?: string;
  envelopeId?: string;
  sentDate?: string;
  issueDate?: string;
  lastSyncDate?: string;
  lastSyncAt?: string;
  payableAmount?: number;
  amountTry?: number;
  currency?: string;
  isSigned?: boolean;
  canCancel?: boolean;
  isCancelled?: boolean;
  cancellableUntil?: string;
  cancelReason?: string;
  cancelDate?: string;
}

export interface IncomingInvoice {
  id: string;
  ettn: string;
  invoiceNumber?: string;
  gibInvoiceNumber?: string;
  supplierTitle?: string;
  senderTitle?: string;
  supplierVkn?: string;
  senderVkn?: string;
  issueDate?: string;
  invoiceDate?: string;
  receivedDate: string;
  scenario: 'TICARIFATURA' | 'TEMELFATURA' | string;
  totalVat?: number;
  payableAmount: number;
  currency: 'TRY';
  invoiceType?: 'SATIS' | 'IADE' | 'TEVKIFAT';
  statusCode?: 'BEKLEMEDE' | 'KABUL_EDILDI' | 'REDDEDILDI' | string;
  responseStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  statusDescription?: string;
  gibResponseDeadline?: string;
  responseDate?: string;
  rejectReason?: string;
  rejectionReason?: string;
  itemCount?: number;
  itemsCount?: number;
}

export interface MysoftCreditLog {
  id: string;
  date?: string;
  timestamp?: string;
  transactionType?: 'YUKLEME' | 'KULLANIM' | string;
  action?: 'FATURA_KESIMI' | 'GELEN_FATURA' | 'KONTOR_YUKLEME' | 'MUKELLEF_SORGULAMA' | string;
  amount: number;
  balanceAfter: number;
  referenceId?: string;
  reference?: string;
  description: string;
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
  mysoftConfig?: MysoftApiConfig;
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
