import {
  AutomationRule,
  CalculatedOrderFinancials,
  CustomerType,
  EInvoiceIntegrator,
  InvoiceDocumentType,
  InvoiceScenario,
  MarketplaceId,
  MarketplaceIntegration,
  MarketplaceOrder,
  OrderLineItem,
  PlatformUser,
  TaxReconciliationSummary,
  TgoMealPackageStatus,
  TgoUnsuppliedReasonCode,
  UserMarketplaceCredential,
  UserRole,
} from '../types/invoicing';

export const MARKETPLACE_CATALOG: Record<
  MarketplaceId,
  {
    name: string;
    defaultPrefix: string;
    defaultCommission: number;
    authType: string;
  }
> = {
  trendyol: {
    name: 'Trendyol',
    defaultPrefix: 'TRD',
    defaultCommission: 16.5,
    authType: 'Supplier ID + API Key + API Secret',
  },
  trendyol_yemek: {
    name: 'Trendyol Go - Yemek',
    defaultPrefix: 'TGY',
    defaultCommission: 12.0,
    authType: 'Supplier ID + Restoran ID + Basic Auth (tgoapis.com)',
  },
  hepsiburada: {
    name: 'Hepsiburada',
    defaultPrefix: 'HPS',
    defaultCommission: 15.0,
    authType: 'Merchant ID + Servis Anahtarı',
  },
  amazon: {
    name: 'Amazon.com.tr',
    defaultPrefix: 'AMZ',
    defaultCommission: 12.0,
    authType: 'SP-API Seller ID + LWA Token',
  },
  n11: {
    name: 'N11',
    defaultPrefix: 'N11',
    defaultCommission: 14.5,
    authType: 'Mağaza ID + AppKey + AppSecret',
  },
  pazarama: {
    name: 'Pazarama',
    defaultPrefix: 'PZR',
    defaultCommission: 13.0,
    authType: 'Satıcı Kodu + Client ID + Secret',
  },
  ciceksepeti: {
    name: 'Çiçeksepeti',
    defaultPrefix: 'CCK',
    defaultCommission: 17.0,
    authType: 'Bayi Kodu + x-api-key',
  },
  idefix: {
    name: 'İdefix',
    defaultPrefix: 'IDF',
    defaultCommission: 14.0,
    authType: 'Satıcı ID + API Token',
  },
  pttavm: {
    name: 'PttAVM',
    defaultPrefix: 'PTT',
    defaultCommission: 11.5,
    authType: 'Mağaza Kodu + WS Kullanıcı / Şifre',
  },
};

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatTryCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const TR_ONES = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const TR_TENS = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];

function convertThreeDigitsToTurkishWords(n: number): string {
  if (n === 0) return '';
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;

  let res = '';
  if (hundreds === 1) res += 'Yüz';
  else if (hundreds > 1) res += TR_ONES[hundreds] + 'Yüz';

  if (tens > 0) res += TR_TENS[tens];
  if (ones > 0) res += TR_ONES[ones];
  return res;
}

export function formatTurkishAmountInWords(amount: number): string {
  const rounded = roundCurrency(Math.max(0, amount));
  const liras = Math.floor(rounded);
  const kurus = Math.round((rounded - liras) * 100);

  let liraText = '';
  if (liras === 0) {
    liraText = 'Sıfır';
  } else {
    const thousands = Math.floor(liras / 1000);
    const remainder = liras % 1000;
    if (thousands === 1) {
      liraText += 'Bin';
    } else if (thousands > 1) {
      liraText += convertThreeDigitsToTurkishWords(thousands) + 'Bin';
    }
    liraText += convertThreeDigitsToTurkishWords(remainder);
  }

  const kurusText =
    kurus > 0 ? ` ${convertThreeDigitsToTurkishWords(kurus)}Kuruş` : '';

  return `#Yalnız ${liraText}TürkLirası${kurusText}#`;
}

/**
 * Validates Turkish VKN (10 digits for corporate) or TCKN (11 digits for individual).
 * Supports "11111111111" Nihai Tüketici identifier for e-Arşiv individual orders.
 */
export function validateTurkishTaxIdentifier(
  rawId: string,
  customerType: CustomerType,
  allowDefaultTcknFallback = false
): { valid: boolean; normalizedId: string; error?: string } {
  const cleaned = (rawId || '').replace(/\s+/g, '');

  if (customerType === 'CORPORATE') {
    if (!/^\d{10}$/.test(cleaned)) {
      return {
        valid: false,
        normalizedId: cleaned,
        error: 'Kurumsal e-Fatura mükellefi için 10 haneli geçerli VKN zorunludur.',
      };
    }
    return { valid: true, normalizedId: cleaned };
  }

  // Individual (Bireysel)
  if (!cleaned) {
    if (allowDefaultTcknFallback) {
      return { valid: true, normalizedId: '11111111111' };
    }
    return {
      valid: false,
      normalizedId: '',
      error: 'Bireysel alıcı TCKN eksik (11 hane veya 11111111111 Nihai Tüketici olmalıdır).',
    };
  }

  if (cleaned === '11111111111') {
    return { valid: true, normalizedId: cleaned };
  }

  if (!/^[1-9]\d{10}$/.test(cleaned)) {
    return {
      valid: false,
      normalizedId: cleaned,
      error: 'TCKN 0 ile başlayamaz ve tam 11 rakamdan oluşmalıdır.',
    };
  }

  return { valid: true, normalizedId: cleaned };
}

/**
 * Determines GİB e-Belge type and scenario according to taxpayer registration.
 */
export function determineDocumentType(
  order: Pick<MarketplaceOrder, 'customerType' | 'isEFaturaRegistered'>,
  preferredCorporateScenario: 'TEMELFATURA' | 'TICARIFATURA' = 'TICARIFATURA'
): { documentType: InvoiceDocumentType; scenario: InvoiceScenario } {
  if (order.customerType === 'CORPORATE' && order.isEFaturaRegistered) {
    return {
      documentType: 'E_FATURA',
      scenario: preferredCorporateScenario,
    };
  }
  return {
    documentType: 'E_ARSIV',
    scenario: 'EARSIVFATURA',
  };
}

/**
 * Calculates line-level KDV (1%, 10%, 20%), shipping KDV (20%), seller discounts,
 * marketplace commission, e-commerce withholding tax (stopaj), and net seller payout.
 */
export function calculateOrderTotals(
  items: OrderLineItem[],
  shippingFeeVatIncluded: number,
  includeShippingInInvoice: boolean,
  sellerDiscountTotal: number,
  marketplaceCommissionRate: number,
  withholdingRate = 1
): CalculatedOrderFinancials {
  const vatBreakdown = {
    rate1: { base: 0, tax: 0 },
    rate10: { base: 0, tax: 0 },
    rate20: { base: 0, tax: 0 },
  };

  const rawItemsGross = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceVatIncluded,
    0
  );

  const safeDiscount = Math.min(Math.max(0, sellerDiscountTotal), rawItemsGross);
  const discountRatio = rawItemsGross > 0 ? (rawItemsGross - safeDiscount) / rawItemsGross : 1;

  for (const item of items) {
    const lineGrossAfterDiscount =
      item.quantity * item.unitPriceVatIncluded * discountRatio;
    const divisor = 1 + item.vatRate / 100;
    const lineBase = lineGrossAfterDiscount / divisor;
    const lineTax = lineGrossAfterDiscount - lineBase;

    if (item.vatRate === 1) {
      vatBreakdown.rate1.base += lineBase;
      vatBreakdown.rate1.tax += lineTax;
    } else if (item.vatRate === 10) {
      vatBreakdown.rate10.base += lineBase;
      vatBreakdown.rate10.tax += lineTax;
    } else {
      vatBreakdown.rate20.base += lineBase;
      vatBreakdown.rate20.tax += lineTax;
    }
  }

  if (includeShippingInInvoice && shippingFeeVatIncluded > 0) {
    const shippingBase = shippingFeeVatIncluded / 1.2;
    const shippingTax = shippingFeeVatIncluded - shippingBase;
    vatBreakdown.rate20.base += shippingBase;
    vatBreakdown.rate20.tax += shippingTax;
  }

  vatBreakdown.rate1.base = roundCurrency(vatBreakdown.rate1.base);
  vatBreakdown.rate1.tax = roundCurrency(vatBreakdown.rate1.tax);
  vatBreakdown.rate10.base = roundCurrency(vatBreakdown.rate10.base);
  vatBreakdown.rate10.tax = roundCurrency(vatBreakdown.rate10.tax);
  vatBreakdown.rate20.base = roundCurrency(vatBreakdown.rate20.base);
  vatBreakdown.rate20.tax = roundCurrency(vatBreakdown.rate20.tax);

  const subtotalExclVat = roundCurrency(
    vatBreakdown.rate1.base + vatBreakdown.rate10.base + vatBreakdown.rate20.base
  );
  const totalVat = roundCurrency(
    vatBreakdown.rate1.tax + vatBreakdown.rate10.tax + vatBreakdown.rate20.tax
  );
  const grossInvoiceTotal = roundCurrency(subtotalExclVat + totalVat);

  const marketplaceCommissionAmount = roundCurrency(
    grossInvoiceTotal * (marketplaceCommissionRate / 100)
  );
  // 2025/2026 E-Ticaret Stopajı (matrah üzerinden %1)
  const withholdingTaxAmount = roundCurrency(
    subtotalExclVat * (withholdingRate / 100)
  );
  const netSellerPayout = roundCurrency(
    grossInvoiceTotal - marketplaceCommissionAmount - withholdingTaxAmount
  );

  return {
    subtotalExclVat,
    vatBreakdown,
    totalVat,
    grossInvoiceTotal,
    marketplaceCommissionAmount,
    withholdingTaxAmount,
    netSellerPayout,
  };
}

/**
 * Generates official 16-character GİB Invoice Number: 3-char series + 4-digit year + 9-digit padded sequence
 */
export function generateGibInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  const cleanPrefix = (prefix || 'GIB')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(3, 'X')
    .slice(0, 3);
  const cleanYear = String(year).slice(0, 4);
  const paddedSeq = String(Math.max(1, Math.floor(sequence))).padStart(9, '0');
  return `${cleanPrefix}${cleanYear}${paddedSeq}`;
}

/**
 * Generates a deterministic UUID v4 style ETTN for an order
 */
export function generateDeterministicEttn(orderId: string, sequence: number): string {
  let hash = 2166136261;
  const seed = `${orderId}-${sequence}-gib-ubl-2026`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  const seqHex = sequence.toString(16).padStart(12, '0').slice(0, 12);
  return `${hex}-4b8a-4e2c-9a1d-${seqHex}`;
}

/**
 * Resolves official GİB 3-character series prefix according to document type.
 * Under GİB regulations, invoice prefixes are NEVER derived from marketplaces;
 * they are issued and registered solely via the official GİB e-Belge Special Integrator.
 */
export function getIntegratorPrefixForDocument(
  documentType: InvoiceDocumentType,
  integratorPrefixes?: { eInvoicePrefix?: string; eArchivePrefix?: string }
): string {
  if (documentType === 'E_FATURA') {
    return (integratorPrefixes?.eInvoicePrefix || 'EFT')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .padEnd(3, 'X')
      .slice(0, 3);
  }
  return (integratorPrefixes?.eArchivePrefix || 'EAR')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(3, 'X')
    .slice(0, 3);
}

/**
 * Attempts to issue an e-Fatura or e-Arşiv document for a single order.
 * Prefix is obtained solely from the GİB Özel Entegratörü (e-Fatura: EFT, e-Arşiv: EAR).
 */
export function issueInvoiceForOrder(
  order: MarketplaceOrder,
  sequence: number,
  prefixOrConfig?: string | { eInvoicePrefix?: string; eArchivePrefix?: string },
  options?: {
    allowDefaultTcknFallback?: boolean;
    corporateScenario?: 'TEMELFATURA' | 'TICARIFATURA';
    timestamp?: string;
  }
): {
  success: boolean;
  updatedOrder: MarketplaceOrder;
  error?: string;
} {
  const validation = validateTurkishTaxIdentifier(
    order.taxIdentifier,
    order.customerType,
    options?.allowDefaultTcknFallback ?? false
  );

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      updatedOrder: {
        ...order,
        invoiceStatus: 'ERROR_TAX_ID',
        invoiceErrorReason: validation.error,
      },
    };
  }

  const { documentType, scenario } = determineDocumentType(
    order,
    options?.corporateScenario ?? 'TICARIFATURA'
  );

  // Prefix is resolved strictly from GİB Özel Entegratör configuration (EFT for e-Fatura, EAR for e-Arşiv)
  let seriesPrefix: string;
  if (typeof prefixOrConfig === 'object' && prefixOrConfig !== null) {
    seriesPrefix = getIntegratorPrefixForDocument(documentType, prefixOrConfig);
  } else if (typeof prefixOrConfig === 'string' && prefixOrConfig.trim().length > 0) {
    seriesPrefix = prefixOrConfig;
  } else {
    seriesPrefix = getIntegratorPrefixForDocument(documentType);
  }

  const gibInvoiceNumber = generateGibInvoiceNumber(seriesPrefix, 2026, sequence);
  const ettn = generateDeterministicEttn(order.id, sequence);

  const isTgoMeal = order.marketplace === 'trendyol_yemek';
  const nextTgoStatus = isTgoMeal
    ? order.tgoPackageStatus === 'Delivered' || order.tgoPackageStatus === 'Shipped'
      ? order.tgoPackageStatus
      : 'Invoiced'
    : order.tgoPackageStatus;

  const updatedOrder: MarketplaceOrder = {
    ...order,
    taxIdentifier: validation.normalizedId,
    invoiceStatus: 'INVOICED',
    invoiceErrorReason: undefined,
    gibInvoiceNumber,
    ettn,
    documentType,
    scenario,
    invoicedAt: options?.timestamp ?? '2026-11-04 16:25',
    ...(isTgoMeal
      ? {
          tgoPackageStatus: nextTgoStatus,
          tgoInvoiceLinkSent: true,
          tgoInvoiceLinkUrl: `https://faturansit.com.tr/e-belge/tgo-meal/${ettn}.pdf`,
        }
      : {}),
  };

  return {
    success: true,
    updatedOrder,
  };
}

const STAGE_ORDER: Record<string, number> = {
  SIPARIS_ONAYLANDI: 1,
  HAZIRLANIYOR: 2,
  KARGOYA_VERILDI: 3,
  TESLIM_EDILDI: 4,
};

/**
 * Runs active automation rules against all non-invoiced orders.
 * Prefix generation is strictly bound to GİB e-Belge Özel Entegratörü series (EFT/EAR), NOT marketplaces.
 */
export function evaluateAutomationRules(
  orders: MarketplaceOrder[],
  rules: AutomationRule[],
  startSequence: number,
  integratorPrefixes?: { eInvoicePrefix?: string; eArchivePrefix?: string } | Partial<Record<MarketplaceId, string>>
): {
  updatedOrders: MarketplaceOrder[];
  updatedRules: AutomationRule[];
  invoicedCount: number;
  failedCount: number;
  nextSequence: number;
  logs: string[];
} {
  let currentSeq = startSequence;
  let invoicedCount = 0;
  let failedCount = 0;
  const logs: string[] = [];
  const activeRules = rules.filter((r) => r.isActive);

  const ruleHitCounts: Record<string, number> = {};

  const updatedOrders = orders.map((order) => {
    if (order.invoiceStatus === 'INVOICED') {
      return order;
    }

    const matchingRule = activeRules.find((rule) => {
      const marketplaceMatches =
        rule.marketplace === 'ALL' || rule.marketplace === order.marketplace;
      const customerMatches =
        rule.customerScope === 'ALL' || rule.customerScope === order.customerType;
      const stageReached =
        (STAGE_ORDER[order.fulfillmentStage] ?? 0) >=
        (STAGE_ORDER[rule.triggerStage] ?? 99);
      const sectorMatches =
        !rule.sector ||
        rule.sector === 'ALL' ||
        !order.sector ||
        rule.sector === order.sector;
      return marketplaceMatches && customerMatches && stageReached && sectorMatches;
    });

    if (!matchingRule) {
      return order;
    }

    const orderWithRuleShipping: MarketplaceOrder = {
      ...order,
      includeShippingInInvoice: matchingRule.includeShippingLine,
    };

    const docTypeInfo = determineDocumentType(orderWithRuleShipping, matchingRule.corporateScenario);
    // Invoice prefixes are NEVER taken from marketplaces; they are taken ONLY from the GİB Özel Entegratörü series
    const prefix = getIntegratorPrefixForDocument(
      docTypeInfo.documentType,
      integratorPrefixes && ('eInvoicePrefix' in integratorPrefixes || 'eArchivePrefix' in integratorPrefixes)
        ? (integratorPrefixes as { eInvoicePrefix?: string; eArchivePrefix?: string })
        : undefined
    );

    const result = issueInvoiceForOrder(orderWithRuleShipping, currentSeq, prefix, {
      allowDefaultTcknFallback: matchingRule.autoAssignDefaultTckn,
      corporateScenario: matchingRule.corporateScenario,
    });

    if (result.success) {
      currentSeq += 1;
      invoicedCount += 1;
      ruleHitCounts[matchingRule.id] = (ruleHitCounts[matchingRule.id] ?? 0) + 1;
      logs.push(
        `[${matchingRule.name}] #${order.marketplaceOrderNumber} (${order.customerName}) -> ${result.updatedOrder.gibInvoiceNumber}`
      );
      return result.updatedOrder;
    } else {
      failedCount += 1;
      logs.push(
        `[HATA - ${matchingRule.name}] #${order.marketplaceOrderNumber}: ${result.error}`
      );
      return result.updatedOrder;
    }
  });

  const updatedRules = rules.map((r) =>
    ruleHitCounts[r.id]
      ? {
          ...r,
          processedCount: r.processedCount + ruleHitCounts[r.id],
          lastTriggeredAt: '2026-11-04 16:25',
        }
      : r
  );

  return {
    updatedOrders,
    updatedRules,
    invoicedCount,
    failedCount,
    nextSequence: currentSeq,
    logs,
  };
}

/**
 * Aggregates KDV (1%, 10%, 20%), Matrah, Commission, Withholding, and Net Payout across orders.
 */
export function computeTaxAndCommissionReport(
  orders: MarketplaceOrder[],
  integrations: MarketplaceIntegration[]
): TaxReconciliationSummary {
  let totalInvoicedCount = 0;
  let totalPendingCount = 0;
  let totalErrorCount = 0;
  let totalMatrah = 0;
  let totalVat = 0;
  let totalGrossInvoiced = 0;
  let totalCommissionCut = 0;
  let totalWithholdingCut = 0;
  let totalNetPayout = 0;

  const vatByRate = {
    rate1: { base: 0, tax: 0, gross: 0 },
    rate10: { base: 0, tax: 0, gross: 0 },
    rate20: { base: 0, tax: 0, gross: 0 },
  };

  const mpMap = new Map<
    MarketplaceId,
    {
      marketplace: MarketplaceId;
      name: string;
      orderCount: number;
      invoicedCount: number;
      grossSales: number;
      vatTotal: number;
      commissionAmount: number;
      withholdingAmount: number;
      netPayout: number;
    }
  >();

  for (const integ of integrations) {
    mpMap.set(integ.id, {
      marketplace: integ.id,
      name: integ.name,
      orderCount: 0,
      invoicedCount: 0,
      grossSales: 0,
      vatTotal: 0,
      commissionAmount: 0,
      withholdingAmount: 0,
      netPayout: 0,
    });
  }

  for (const order of orders) {
    if (order.invoiceStatus === 'INVOICED') totalInvoicedCount++;
    else if (order.invoiceStatus === 'ERROR_TAX_ID') totalErrorCount++;
    else totalPendingCount++;

    const fin = calculateOrderTotals(
      order.items,
      order.shippingFeeVatIncluded,
      order.includeShippingInInvoice,
      order.sellerDiscountTotal,
      order.marketplaceCommissionRate,
      order.withholdingRate
    );

    let mpEntry = mpMap.get(order.marketplace);
    if (!mpEntry) {
      const cat = MARKETPLACE_CATALOG[order.marketplace];
      mpEntry = {
        marketplace: order.marketplace,
        name: cat ? cat.name : order.marketplace.toUpperCase(),
        orderCount: 0,
        invoicedCount: 0,
        grossSales: 0,
        vatTotal: 0,
        commissionAmount: 0,
        withholdingAmount: 0,
        netPayout: 0,
      };
      mpMap.set(order.marketplace, mpEntry);
    }
    mpEntry.orderCount += 1;
    if (order.invoiceStatus === 'INVOICED') {
      mpEntry.invoicedCount += 1;
    }
    mpEntry.grossSales = roundCurrency(mpEntry.grossSales + fin.grossInvoiceTotal);
    mpEntry.vatTotal = roundCurrency(mpEntry.vatTotal + fin.totalVat);
    mpEntry.commissionAmount = roundCurrency(
      mpEntry.commissionAmount + fin.marketplaceCommissionAmount
    );
    mpEntry.withholdingAmount = roundCurrency(
      mpEntry.withholdingAmount + fin.withholdingTaxAmount
    );
    mpEntry.netPayout = roundCurrency(mpEntry.netPayout + fin.netSellerPayout);

    totalMatrah = roundCurrency(totalMatrah + fin.subtotalExclVat);
    totalVat = roundCurrency(totalVat + fin.totalVat);
    totalGrossInvoiced = roundCurrency(totalGrossInvoiced + fin.grossInvoiceTotal);
    totalCommissionCut = roundCurrency(
      totalCommissionCut + fin.marketplaceCommissionAmount
    );
    totalWithholdingCut = roundCurrency(
      totalWithholdingCut + fin.withholdingTaxAmount
    );
    totalNetPayout = roundCurrency(totalNetPayout + fin.netSellerPayout);

    vatByRate.rate1.base = roundCurrency(
      vatByRate.rate1.base + fin.vatBreakdown.rate1.base
    );
    vatByRate.rate1.tax = roundCurrency(
      vatByRate.rate1.tax + fin.vatBreakdown.rate1.tax
    );
    vatByRate.rate1.gross = roundCurrency(
      vatByRate.rate1.base + vatByRate.rate1.tax
    );

    vatByRate.rate10.base = roundCurrency(
      vatByRate.rate10.base + fin.vatBreakdown.rate10.base
    );
    vatByRate.rate10.tax = roundCurrency(
      vatByRate.rate10.tax + fin.vatBreakdown.rate10.tax
    );
    vatByRate.rate10.gross = roundCurrency(
      vatByRate.rate10.base + vatByRate.rate10.tax
    );

    vatByRate.rate20.base = roundCurrency(
      vatByRate.rate20.base + fin.vatBreakdown.rate20.base
    );
    vatByRate.rate20.tax = roundCurrency(
      vatByRate.rate20.tax + fin.vatBreakdown.rate20.tax
    );
    vatByRate.rate20.gross = roundCurrency(
      vatByRate.rate20.base + vatByRate.rate20.tax
    );
  }

  return {
    totalInvoicedCount,
    totalPendingCount,
    totalErrorCount,
    totalMatrah,
    totalVat,
    totalGrossInvoiced,
    totalCommissionCut,
    totalWithholdingCut,
    totalNetPayout,
    vatByRate,
    byMarketplace: Array.from(mpMap.values()),
  };
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an official GİB UBL-TR 2.1 XML representation of an invoiced order.
 */
export function generateUblTrXmlPreview(order: MarketplaceOrder): string {
  const fin = calculateOrderTotals(
    order.items,
    order.shippingFeeVatIncluded,
    order.includeShippingInInvoice,
    order.sellerDiscountTotal,
    order.marketplaceCommissionRate,
    order.withholdingRate
  );

  const invoiceNo = order.gibInvoiceNumber ?? 'TASLAK2026000000001';
  const ettn = order.ettn ?? generateDeterministicEttn(order.id, 1);
  const scenario = order.scenario ?? 'EARSIVFATURA';
  const schemeId = order.customerType === 'CORPORATE' ? 'VKN' : 'TCKN';
  const sanitizedNote =
    order.orderNote && order.orderNote.trim()
      ? `\n  <cbc:Note>${escapeXml(order.orderNote.trim())}</cbc:Note>`
      : '';

  const linesXml = order.items
    .map((item, idx) => {
      const gross = roundCurrency(item.quantity * item.unitPriceVatIncluded);
      const base = roundCurrency(gross / (1 + item.vatRate / 100));
      const tax = roundCurrency(gross - base);
      return `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">${base.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">${tax.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TRY">${base.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TRY">${tax.toFixed(2)}</cbc:TaxAmount>
        <cbc:Percent>${item.vatRate}</cbc:Percent>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:Name>KDV</cbc:Name>
            <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${item.title}</cbc:Name>
      <cac:SellersItemIdentification>
        <cbc:ID>${item.sku}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
  </cac:InvoiceLine>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${scenario}</cbc:ProfileID>
  <cbc:ID>${invoiceNo}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${ettn}</cbc:UUID>
  <cbc:IssueDate>2026-11-04</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>${sanitizedNote}
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">3890642158</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>ANADOLU DİJİTAL TİCARET VE LOJİSTİK A.Ş.</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${schemeId}">${order.taxIdentifier || '11111111111'}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${order.customerName}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">${fin.totalVat.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">${fin.subtotalExclVat.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">${fin.subtotalExclVat.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">${fin.grossInvoiceTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">${fin.grossInvoiceTotal.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

export function maskApiKey(rawKey: string): string {
  const cleaned = (rawKey || '').trim();
  if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 2)}****`;
  }
  return `${cleaned.slice(0, 4)}••••${cleaned.slice(-4)}`;
}

/**
 * Validates and creates a new PlatformUser (merchant/accountant/operations user)
 */
export function validateAndCreatePlatformUser(
  input: {
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    companyName: string;
    taxIdentifier: string;
    eInvoiceIntegrator: EInvoiceIntegrator;
  },
  existingUsers: PlatformUser[]
): {
  valid: boolean;
  user?: PlatformUser;
  error?: string;
} {
  const fullName = (input.fullName || '').trim();
  const email = (input.email || '').trim().toLowerCase();
  const companyName = (input.companyName || '').trim();
  const cleanedTaxId = (input.taxIdentifier || '').replace(/\s+/g, '');

  if (fullName.length < 3) {
    return { valid: false, error: 'Kullanıcı adı ve soyadı en az 3 karakter olmalıdır.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Geçerli bir kurumsal e-posta adresi giriniz.' };
  }
  if (existingUsers.some((u) => u.email.toLowerCase() === email)) {
    return { valid: false, error: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten mevcut.' };
  }
  if (companyName.length < 3) {
    return { valid: false, error: 'Şirket / mükellef ticari unvanı en az 3 karakter olmalıdır.' };
  }
  if (!/^\d{10,11}$/.test(cleanedTaxId)) {
    return {
      valid: false,
      error: 'Mükellef vergi numarası 10 haneli VKN veya 11 haneli TCKN olmalıdır.',
    };
  }

  const newUser: PlatformUser = {
    id: `usr-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
    fullName,
    email,
    phone: (input.phone || '').trim() || '+90 532 000 00 00',
    role: input.role,
    companyName,
    taxIdentifier: cleanedTaxId,
    eInvoiceIntegrator: input.eInvoiceIntegrator,
    eInvoiceCreditBalance: 1000,
    eInvoiceCreditLimit: 1000,
    isActive: true,
    createdAt: '2026-11-04 16:45',
    integratedMarketplaces: [],
  };

  return { valid: true, user: newUser };
}

/**
 * Admin action: Adds e-Belge Kontör (invoice credits) to a user's balance and limit
 */
export function allocateUserInvoiceCredits(
  user: PlatformUser,
  additionalCredits: number
): PlatformUser {
  const safeAdd = Math.max(0, Math.floor(additionalCredits));
  return {
    ...user,
    eInvoiceCreditBalance: user.eInvoiceCreditBalance + safeAdd,
    eInvoiceCreditLimit: user.eInvoiceCreditLimit + safeAdd,
  };
}

/**
 * Admin action: Toggles user active / suspended state
 */
export function toggleUserAccountStatus(user: PlatformUser): PlatformUser {
  return {
    ...user,
    isActive: !user.isActive,
  };
}

/**
 * Validates and connects a marketplace store credential to a specific user
 */
export function validateAndConnectUserMarketplace(
  user: PlatformUser,
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
    tgoStoreBranchId?: string;
    tgoEnvironment?: 'PROD' | 'STAGE';
    tgoAgentName?: string;
    tgoAutoAcceptOrders?: boolean;
    tgoAutoSendInvoiceLink?: boolean;
  }
): {
  valid: boolean;
  updatedUser?: PlatformUser;
  credential?: UserMarketplaceCredential;
  integrationCard?: MarketplaceIntegration;
  error?: string;
} {
  const storeName = (input.storeName || '').trim();
  const sellerId = (input.sellerId || '').trim();
  const apiKey = (input.apiKey || '').trim();
  const apiSecret = (input.apiSecret || '').trim();
  const prefix = (input.invoiceSeriesPrefix || '').trim().toUpperCase();

  if (storeName.length < 3) {
    return { valid: false, error: 'Pazaryeri mağaza adı en az 3 karakter olmalıdır.' };
  }
  if (sellerId.length < 2) {
    return { valid: false, error: 'Satıcı ID (Supplier / Merchant ID) zorunludur.' };
  }
  if (apiKey.length < 4 || apiSecret.length < 4) {
    return {
      valid: false,
      error: 'Pazaryeri API Key ve API Secret anahtarları en az 4 karakter olmalıdır.',
    };
  }
  if (!/^[A-Z0-9]{3}$/.test(prefix)) {
    return {
      valid: false,
      error: 'GİB Fatura Seri Öneki tam 3 karakterli harf/rakam olmalıdır (Örn: TRD, HPS, TGY).',
    };
  }
  if (
    !Number.isFinite(input.defaultCommissionRate) ||
    input.defaultCommissionRate < 0 ||
    input.defaultCommissionRate > 60
  ) {
    return {
      valid: false,
      error: 'Komisyon oranı %0 ile %60 arasında olmalıdır.',
    };
  }

  const duplicate = user.integratedMarketplaces.some(
    (m) =>
      m.marketplace === input.marketplace &&
      m.sellerId.toLowerCase() === sellerId.toLowerCase()
  );
  if (duplicate) {
    return {
      valid: false,
      error: 'Bu kullanıcıda aynı Satıcı ID ile tanımlı pazaryeri entegrasyonu zaten mevcut.',
    };
  }

  const catalogInfo = MARKETPLACE_CATALOG[input.marketplace];
  const credentialId = `cred-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
  const isTgoMeal = input.marketplace === 'trendyol_yemek';

  const credential: UserMarketplaceCredential = {
    id: credentialId,
    userId: user.id,
    marketplace: input.marketplace,
    marketplaceName: catalogInfo.name,
    storeName,
    sellerId,
    apiKeyMasked: maskApiKey(apiKey),
    invoiceSeriesPrefix: prefix,
    defaultCommissionRate: roundCurrency(input.defaultCommissionRate),
    autoSyncIntervalMinutes: input.autoSyncIntervalMinutes || 5,
    webhookEnabled: input.webhookEnabled,
    apiStatus: 'CONNECTED',
    connectedAt: '2026-11-04 16:48',
    ...(isTgoMeal
      ? {
          tgoStoreBranchId: (input.tgoStoreBranchId || '').trim() || 'REST-88120',
          tgoEnvironment: input.tgoEnvironment || 'PROD',
          tgoAgentName: (input.tgoAgentName || '').trim() || 'Faturansit',
          tgoAutoAcceptOrders: input.tgoAutoAcceptOrders ?? true,
          tgoAutoSendInvoiceLink: input.tgoAutoSendInvoiceLink ?? true,
        }
      : {}),
  };

  const updatedUser: PlatformUser = {
    ...user,
    integratedMarketplaces: [...user.integratedMarketplaces, credential],
  };

  const integrationCard: MarketplaceIntegration = {
    id: input.marketplace,
    integrationRecordId: credentialId,
    ownerUserId: user.id,
    ownerUserName: user.fullName,
    name: catalogInfo.name,
    storeName,
    sellerId,
    apiKeyMasked: credential.apiKeyMasked,
    apiStatus: 'CONNECTED',
    invoiceSeriesPrefix: prefix,
    defaultCommissionRate: credential.defaultCommissionRate,
    autoSyncIntervalMinutes: credential.autoSyncIntervalMinutes,
    lastSyncAt: '2026-11-04 16:48',
    pendingOrderCount: 0,
    monthlyVolumeTry: 0,
    ...(isTgoMeal
      ? {
          tgoStoreBranchId: credential.tgoStoreBranchId,
          tgoEnvironment: credential.tgoEnvironment,
          tgoAgentName: credential.tgoAgentName,
          tgoAutoAcceptOrders: credential.tgoAutoAcceptOrders,
          tgoAutoSendInvoiceLink: credential.tgoAutoSendInvoiceLink,
        }
      : {}),
  };

  return {
    valid: true,
    updatedUser,
    credential,
    integrationCard,
  };
}

/**
 * Admin action: Permanently deletes a user and associated company record from the platform
 */
export function deletePlatformUser(
  users: PlatformUser[],
  userId: string
): {
  success: boolean;
  remainingUsers: PlatformUser[];
  deletedUser?: PlatformUser;
  error?: string;
} {
  const target = users.find((u) => u.id === userId);
  if (!target) {
    return {
      success: false,
      remainingUsers: users,
      error: 'Silinmek istenen kullanıcı veya şirket kaydı bulunamadı.',
    };
  }

  const remainingUsers = users.filter((u) => u.id !== userId);
  return {
    success: true,
    remainingUsers,
    deletedUser: target,
  };
}

// ============================================================================
// TRENDYOL GO - YEMEK (developers.tgoapps.com) SİPARİŞ & FATURA ENTEGRASYONU
// ============================================================================

export const TGO_YEMEK_API_CONFIG = {
  prodBaseUrl: 'https://api.tgoapis.com',
  stageBaseUrl: 'https://stageapi.tgoapis.com',
  invoiceChannelId: 4, // Trendyol Go - Yemek e-Fatura/e-Arşiv besleme sabit kanal kodu (channelId = 4)
  rateLimitPer10Seconds: 50,
  endpoints: {
    getPackages: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages`,
    acceptPackagePicked: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages/picked`,
    markPackageInvoiced: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages/invoiced`,
    markManualShipped: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages/manual-shipped`,
    markManualDelivered: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages/manual-delivered`,
    markPackageUnsupplied: (supplierId: string) =>
      `/integrator/order/meal/suppliers/${supplierId}/packages/unsupplied`,
    sendInvoiceLink: (supplierId: string, serviceSourceId: string) =>
      `/integrator/invoice/meal/suppliers/${supplierId}/supplier-invoice-links/4/${serviceSourceId}`,
    deleteInvoiceLink: (supplierId: string, serviceSourceId: string) =>
      `/integrator/invoice/meal/suppliers/${supplierId}/supplier-invoice-links/4/${serviceSourceId}`,
  },
} as const;

export const TGO_UNSUPPLIED_REASONS: Record<TgoUnsuppliedReasonCode, string> = {
  621: '621 - Tedarik Problemi (Ürün / Malzeme Tükendi)',
  622: '622 - Mağaza / Restoran Şubesi Kapalı',
  623: '623 - Mağaza Siparişi Hazırlayamıyor (Mutfak Arızası)',
  624: '624 - Yüksek Yoğunluk / Kurye Yok',
  626: '626 - Teslimat Alanı Dışı (Bölge Dışı Adres)',
  627: '627 - Sipariş Karışıklığı / Operasyonel Hata',
};

/**
 * Builds official Trendyol Go - Yemek HTTP headers per https://developers.tgoapps.com/docs/intro/authorization
 */
export function buildTgoYemekHeaders(params: {
  supplierId: string;
  apiKeyMaskedOrRaw: string;
  agentName?: string;
  executorUser?: string;
}): Record<string, string> {
  const cleanSupplier = (params.supplierId || 'TGY-000000').trim();
  const cleanAgent = (params.agentName || 'Faturansit').trim();
  const cleanExec = (params.executorUser || 'operasyon@faturansit.com.tr').trim();
  return {
    Authorization: `Basic base64(${params.apiKeyMaskedOrRaw}:SECRET)`,
    'User-Agent': `${cleanSupplier} - ${cleanAgent}`,
    'x-agentname': cleanAgent,
    'x-executor-user': cleanExec,
    'Content-Type': 'application/json',
  };
}

/**
 * Transitions a Trendyol Go - Yemek meal order package status according to official state machine:
 * Created -> Picking (picked) -> Invoiced (invoiced) -> Shipped (manual-shipped) -> Delivered (manual-delivered) / UnSupplied (unsupplied)
 */
export function transitionTgoMealPackageStatus(
  order: MarketplaceOrder,
  nextStatus: TgoMealPackageStatus,
  options?: {
    preparationTimeMinutes?: number;
    unsuppliedReasonCode?: TgoUnsuppliedReasonCode;
    supplierId?: string;
  }
): {
  updatedOrder: MarketplaceOrder;
  endpointMethod: 'PUT';
  endpointPath: string;
  requestPayload: Record<string, unknown>;
  statusSummary: string;
} {
  const supplierId = (options?.supplierId || '409182').replace(/^TGY-/i, '');
  const packageId = order.tgoPackageId || `PKG-${order.marketplaceOrderNumber}`;

  if (nextStatus === 'Picking') {
    const prepTime = Math.max(5, Math.min(90, options?.preparationTimeMinutes ?? order.tgoPreparationTimeMinutes ?? 20));
    const updatedOrder: MarketplaceOrder = {
      ...order,
      tgoPackageStatus: 'Picking',
      tgoPreparationTimeMinutes: prepTime,
      fulfillmentStage: 'HAZIRLANIYOR',
      isCancelled: false,
    };
    return {
      updatedOrder,
      endpointMethod: 'PUT',
      endpointPath: TGO_YEMEK_API_CONFIG.endpoints.acceptPackagePicked(supplierId),
      requestPayload: {
        packageId,
        preparationTime: prepTime,
      },
      statusSummary: `Sipariş paketi (${packageId}) kabul edildi (Picking - Hazırlık: ${prepTime} dk).`,
    };
  }

  if (nextStatus === 'Invoiced') {
    const actualDate = Date.now();
    const updatedOrder: MarketplaceOrder = {
      ...order,
      tgoPackageStatus: 'Invoiced',
      fulfillmentStage: 'HAZIRLANIYOR',
    };
    return {
      updatedOrder,
      endpointMethod: 'PUT',
      endpointPath: TGO_YEMEK_API_CONFIG.endpoints.markPackageInvoiced(supplierId),
      requestPayload: {
        packageId,
        actualDate,
      },
      statusSummary: `Sipariş hazırlığı tamamlandı (Invoiced / Hazır - actualDate: ${actualDate}).`,
    };
  }

  if (nextStatus === 'Shipped') {
    const updatedOrder: MarketplaceOrder = {
      ...order,
      tgoPackageStatus: 'Shipped',
      fulfillmentStage: 'KARGOYA_VERILDI',
    };
    return {
      updatedOrder,
      endpointMethod: 'PUT',
      endpointPath: TGO_YEMEK_API_CONFIG.endpoints.markManualShipped(supplierId),
      requestPayload: {
        packageId,
      },
      statusSummary: `Sipariş paketi kuryeye teslim edildi / yola çıktı (Shipped).`,
    };
  }

  if (nextStatus === 'Delivered') {
    const updatedOrder: MarketplaceOrder = {
      ...order,
      tgoPackageStatus: 'Delivered',
      fulfillmentStage: 'TESLIM_EDILDI',
    };
    return {
      updatedOrder,
      endpointMethod: 'PUT',
      endpointPath: TGO_YEMEK_API_CONFIG.endpoints.markManualDelivered(supplierId),
      requestPayload: {
        packageId,
      },
      statusSummary: `Sipariş paketi müşteriye teslim edildi (Delivered).`,
    };
  }

  if (nextStatus === 'UnSupplied' || nextStatus === 'Cancelled') {
    const reasonCode: TgoUnsuppliedReasonCode = options?.unsuppliedReasonCode ?? 621;
    const reasonLabel = TGO_UNSUPPLIED_REASONS[reasonCode];
    const updatedOrder: MarketplaceOrder = {
      ...order,
      tgoPackageStatus: 'UnSupplied',
      tgoUnsuppliedReasonCode: reasonCode,
      isCancelled: true,
      cancelledAt: '2026-11-06 16:45',
      cancelReason: reasonLabel,
    };
    return {
      updatedOrder,
      endpointMethod: 'PUT',
      endpointPath: TGO_YEMEK_API_CONFIG.endpoints.markPackageUnsupplied(supplierId),
      requestPayload: {
        packageId,
        itemIdList: order.items.map((i) => i.id),
        reasonId: reasonCode,
      },
      statusSummary: `Sipariş tedarik edilemedi / iptal bildirildi (${reasonLabel}).`,
    };
  }

  return {
    updatedOrder: {
      ...order,
      tgoPackageStatus: nextStatus,
    },
    endpointMethod: 'PUT',
    endpointPath: TGO_YEMEK_API_CONFIG.endpoints.getPackages(supplierId),
    requestPayload: { packageId },
    statusSummary: `Paket durumu ${nextStatus} olarak güncellendi.`,
  };
}

/**
 * Feeds e-Fatura / e-Arşiv PDF link to Trendyol Go - Yemek via sendInvoiceLink (channelId = 4)
 * POST /integrator/invoice/meal/suppliers/{supplierId}/supplier-invoice-links/4/{serviceSourceId}
 */
export function feedTgoMealInvoiceLink(
  order: MarketplaceOrder,
  supplierIdRaw: string,
  customInvoiceLink?: string
): {
  success: boolean;
  updatedOrder: MarketplaceOrder;
  endpointPath: string;
  requestPayload: { invoiceLink: string };
  error?: string;
} {
  const supplierId = (supplierIdRaw || '409182').replace(/^TGY-/i, '');
  const serviceSourceId = order.marketplaceOrderNumber.replace(/^TGY-/i, '');
  const endpointPath = TGO_YEMEK_API_CONFIG.endpoints.sendInvoiceLink(
    supplierId,
    serviceSourceId
  );

  if (order.invoiceStatus !== 'INVOICED' || (!order.gibInvoiceNumber && !order.ettn)) {
    return {
      success: false,
      updatedOrder: order,
      endpointPath,
      requestPayload: { invoiceLink: '' },
      error:
        'Trendyol Go - Yemek fatura linki beslemesi (channelId: 4) için önce siparişin GİB e-Fatura veya e-Arşiv belgesi kesilmelidir.',
    };
  }

  const refCode = order.ettn || order.gibInvoiceNumber || order.id;
  const resolvedLink =
    (customInvoiceLink || '').trim() ||
    order.tgoInvoiceLinkUrl ||
    `https://faturansit.com.tr/e-belge/tgo-meal/${refCode}.pdf`;

  const updatedOrder: MarketplaceOrder = {
    ...order,
    tgoInvoiceLinkSent: true,
    tgoInvoiceLinkUrl: resolvedLink,
    tgoPackageStatus:
      order.tgoPackageStatus === 'Created' || order.tgoPackageStatus === 'Picking'
        ? 'Invoiced'
        : order.tgoPackageStatus ?? 'Invoiced',
  };

  return {
    success: true,
    updatedOrder,
    endpointPath,
    requestPayload: {
      invoiceLink: resolvedLink,
    },
  };
}


