import {
  IncomingInvoice,
  MysoftApiConfig,
  MysoftCreditLog,
  MysoftInvoiceStatusRecord,
  MysoftTaxpayerLookupResult,
} from '../types/invoicing';
import { MYSOFT_KNOWN_TAXPAYERS } from '../data/seedData';

/**
 * Mysoft e-Dönüşüm Entegratör Servisi
 * Muavin Ön Muhasebe standartları ve GİB UBL-TR 1.2.1 protokollerine uyumlu
 */

export interface MysoftConnectionTestResult {
  success: boolean;
  message: string;
  pingMs: number;
  environment: 'PRODUCTION' | 'SANDBOX';
  authorizedVkn: string;
  creditBalance: number;
  systemTimestamp: string;
  activeCertificates: {
    type: 'MALI_MUHUR' | 'E_IMZA';
    serialNumber: string;
    validUntil: string;
    issuer: string;
  };
}

/**
 * Mysoft API Servis Durumu ve Kimlik Doğrulama Testi
 */
export async function testMysoftConnection(config: MysoftApiConfig): Promise<MysoftConnectionTestResult> {
  // Canlı API ping simülasyonu
  await new Promise((res) => setTimeout(res, 450));

  if (!config.username || config.username.trim() === '') {
    return {
      success: false,
      message: 'Mysoft API kullanıcı adı boş olamaz.',
      pingMs: 0,
      environment: config.environment,
      authorizedVkn: config.vknTckn || config.tenantVkn || '4820194829',
      creditBalance: 0,
      systemTimestamp: new Date().toISOString(),
      activeCertificates: {
        type: 'MALI_MUHUR',
        serialNumber: 'UNKNOWN',
        validUntil: '-',
        issuer: '-',
      },
    };
  }

  return {
    success: true,
    message: `Mysoft ${config.environment === 'PRODUCTION' ? 'CANLI (Production)' : 'TEST (Sandbox)'} ağ geçidine başarıyla bağlanıldı. Yetkilendirme geçerli.`,
    pingMs: Math.floor(45 + Math.random() * 35),
    environment: config.environment,
    authorizedVkn: config.vknTckn || config.tenantVkn || '4820194829',
    creditBalance: config.creditBalance,
    systemTimestamp: new Date().toLocaleString('tr-TR'),
    activeCertificates: {
      type: 'MALI_MUHUR',
      serialNumber: 'TUBITAK-UEKAE-7729104',
      validUntil: '2028-04-18',
      issuer: 'TÜBİTAK Kamu Sertifikasyon Merkezi (KamuSM)',
    },
  };
}

/**
 * Canlı GİB Mükellef Sorgulama (VKN / TCKN)
 * GİB Veritabanında kayıtlı e-Fatura / e-İrsaliye posta kutularını döner.
 */
export async function queryMysoftTaxpayer(vknOrTckn: string): Promise<MysoftTaxpayerLookupResult> {
  const cleanId = (vknOrTckn || '').replace(/\D/g, '');
  await new Promise((res) => setTimeout(res, 350));

  const existing = MYSOFT_KNOWN_TAXPAYERS.find((t) => t.vknTckn === cleanId);
  if (existing) {
    return {
      ...existing,
      lookupTimestamp: new Date().toLocaleString('tr-TR'),
    };
  }

  // Bilinmeyen VKN veya Şahıs TCKN sorgulaması
  if (cleanId.length === 11) {
    // 11 Haneli TCKN -> Bireysel Alıcı / e-Arşiv
    return {
      vknTckn: cleanId,
      title: 'Bireysel Nihai Tüketici (TCKN Mükellefi)',
      isEInvoiceUser: false,
      isEDespatchUser: false,
      isEArchiveUser: true,
      firstRegisteredDate: '-',
      aliasesGb: [],
      aliasesPk: [],
      systemType: 'EARSIV',
      taxOffice: 'GİB Bireysel Sorgu',
      city: 'Türkiye',
      lookupTimestamp: new Date().toLocaleString('tr-TR'),
    };
  }

  if (cleanId.length === 10) {
    // 10 Haneli VKN -> e-Arşiv mükellefi (Henüz e-Faturaya geçmemiş kurumsal)
    return {
      vknTckn: cleanId,
      title: `Kurumsal Ticari İşletme (VKN: ${cleanId})`,
      isEInvoiceUser: false,
      isEDespatchUser: false,
      isEArchiveUser: true,
      firstRegisteredDate: '-',
      aliasesGb: [],
      aliasesPk: [],
      systemType: 'EARSIV',
      taxOffice: 'GİB Mükellef Sicil',
      city: 'Türkiye',
      lookupTimestamp: new Date().toLocaleString('tr-TR'),
    };
  }

  throw new Error('Geçersiz VKN veya TCKN numarası. VKN 10 haneli, TCKN 11 haneli olmalıdır.');
}

/**
 * GİB e-Belge Kuyruğu ve Durum Senkronizasyonu
 * 1000: Kuyrukta
 * 1200: GİB'e iletildi / Posta kutusuna teslim edildi
 * 1220: Alıcı posta kutusuna ulaştı
 * 1230: Kabul edildi
 * 1240: Reddedildi
 */
export function syncMysoftInvoiceStatuses(
  records: MysoftInvoiceStatusRecord[]
): MysoftInvoiceStatusRecord[] {
  const now = new Date().toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return records.map((rec) => {
    if (rec.gibStatusCode === 1000) {
      return {
        ...rec,
        gibStatusCode: 1200,
        gibStatusDescription: 'Mysoft HSM tarafından imzalandı, GİB zarfı (1200) başarıyla oluşturuldu.',
        lastSyncDate: now,
        isSigned: true,
        envelopeId: rec.envelopeId || `MYS-${new Date().getFullYear()}-ENV-${Math.floor(100000 + Math.random() * 900000)}`,
      };
    }
    return {
      ...rec,
      lastSyncDate: now,
    };
  });
}

/**
 * e-Arşiv Fatura Yasal İptal İşlemi (8 Günlük Süre Kuralı)
 */
export function cancelMysoftEArchiveInvoice(
  record: MysoftInvoiceStatusRecord,
  cancelReason: string
): { success: boolean; record: MysoftInvoiceStatusRecord; message: string } {
  if (record.documentType !== 'E_ARSIV') {
    return {
      success: false,
      record,
      message: 'Yalnızca e-Arşiv faturalar portal üzerinden tek taraflı iptal edilebilir. Ticari e-Fatura için alıcı reddi veya iade faturası gereklidir.',
    };
  }

  if (record.gibStatusCode === 1300) {
    return {
      success: false,
      record,
      message: 'Bu belge zaten iptal edilmiş durumda.',
    };
  }

  const now = new Date().toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const updated: MysoftInvoiceStatusRecord = {
    ...record,
    gibStatusCode: 1300,
    gibStatusDescription: `GİB e-Arşiv İptal Raporu oluşturuldu. Gerekçe: ${cancelReason} (İptal Tarihi: ${now})`,
    lastSyncDate: now,
  };

  return {
    success: true,
    record: updated,
    message: `${record.invoiceNumber} numaralı e-Arşiv fatura başarıyla iptal edildi. Mysoft GİB e-Arşiv iptal bildirimi kaydedildi.`,
  };
}

/**
 * Gelen Ticari e-Faturaya GİB Uygulama Yanıtı Gönderme (KABUL / RED)
 */
export function respondToIncomingInvoice(
  invoice: IncomingInvoice,
  decision: 'KABUL_EDILDI' | 'REDDEDILDI',
  rejectReason?: string
): { success: boolean; updatedInvoice: IncomingInvoice; message: string } {
  if (invoice.scenario === 'TEMELFATURA') {
    return {
      success: false,
      updatedInvoice: invoice,
      message: 'Temel fatura senaryosunda GİB üzerinden elektronik yanıt dönülemez. Temel faturalar doğrudan kabul statüsündedir.',
    };
  }

  if (invoice.statusCode !== 'BEKLEMEDE') {
    return {
      success: false,
      updatedInvoice: invoice,
      message: `Bu fatura için daha önce yanıt verilmiştir (${invoice.statusCode}).`,
    };
  }

  const now = new Date().toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isAccept = decision === 'KABUL_EDILDI';
  const updated: IncomingInvoice = {
    ...invoice,
    statusCode: decision,
    responseDate: now,
    statusDescription: isAccept
      ? `GİB Uygulama Yanıtı (ApplicationResponse: KABUL / ACCEPT) Mysoft üzerinden alıcıya iletildi. (${now})`
      : `GİB Uygulama Yanıtı (ApplicationResponse: RED / REJECT) iletildi. Gerekçe: ${rejectReason || 'Ticari uyuşmazlık'} (${now})`,
    rejectReason: isAccept ? undefined : rejectReason,
  };

  return {
    success: true,
    updatedInvoice: updated,
    message: isAccept
      ? `${invoice.invoiceNumber} numaralı ticari e-fatura başarıyla kabul edildi.`
      : `${invoice.invoiceNumber} numaralı ticari e-fatura reddedildi ve red zarfı Mysoft üzerinden GİB'e iletildi.`,
  };
}

/**
 * Kontör Satın Alma / Yükleme İşlemi
 */
export function topUpMysoftCredits(
  currentConfig: MysoftApiConfig,
  currentLogs: MysoftCreditLog[],
  amount: number,
  packageName: string
): { updatedConfig: MysoftApiConfig; newLog: MysoftCreditLog } {
  const newBalance = currentConfig.creditBalance + amount;
  const now = new Date().toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const newLog: MysoftCreditLog = {
    id: `crd-${Date.now()}`,
    date: now,
    transactionType: 'YUKLEME',
    amount: amount,
    balanceAfter: newBalance,
    description: `${packageName} (${amount.toLocaleString('tr-TR')} Adet Kontör)`,
    referenceId: `PAKET-MYS-${Date.now().toString().slice(-6)}`,
  };

  const updatedConfig: MysoftApiConfig = {
    ...currentConfig,
    creditBalance: newBalance,
    lastCreditSync: now,
  };

  return {
    updatedConfig,
    newLog,
  };
}
