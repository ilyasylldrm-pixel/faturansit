import type { CompanyProfile, MarketplaceOrder } from '../types/invoicing.ts';
import {
  determineDocumentType,
  roundCurrency,
  validateTurkishTaxIdentifier,
} from '../utils/invoicingEngine.ts';

export interface MysoftSellerInput {
  taxIdentifier: string;
  legalTitle: string;
  taxOffice?: string;
  city?: string;
  district?: string;
  addressLine?: string;
  pkAlias?: string;
}

export function istanbulStamp(date = new Date()): { docDate: string; docTime: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const docDate = `${get('year')}-${get('month')}-${get('day')}`;
  return { docDate, docTime: `${docDate} ${get('hour')}:${get('minute')}` };
}

function splitPersonName(fullName: string): { firstName: string; familyName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    const only = parts[0] || 'Nihai';
    return { firstName: only, familyName: 'Tüketici' };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    familyName: parts[parts.length - 1],
  };
}

function prefixOf(value: string | undefined, fallback: string): string {
  const cleaned = (value || fallback).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return cleaned.padEnd(3, 'X');
}

export function buildMysoftInvoicePayload(input: {
  order: MarketplaceOrder;
  seller: MysoftSellerInput;
  preferredScenario?: 'TEMELFATURA' | 'TICARIFATURA';
  eInvoicePrefix?: string;
  eArchivePrefix?: string;
  buyerPkAlias?: string;
  now?: Date;
}): Record<string, unknown> {
  const buyerId = validateTurkishTaxIdentifier(
    input.order.taxIdentifier,
    input.order.customerType,
    true
  );
  if (!buyerId.valid) {
    throw new Error(buyerId.error || 'Alıcı VKN/TCKN geçersiz.');
  }
  const sellerId = input.seller.taxIdentifier.replace(/\D/g, '');
  if (sellerId.length !== 10 && sellerId.length !== 11) {
    throw new Error('Satıcı VKN/TCKN 10 veya 11 hane olmalı.');
  }

  const { documentType, scenario } = determineDocumentType(
    input.order,
    input.preferredScenario ?? 'TICARIFATURA'
  );
  const eDocumentType = documentType === 'E_FATURA' ? 'EFATURA' : 'EARSIVFATURA';
  const rawGross = input.order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceVatIncluded,
    0
  );
  const discount = Math.min(Math.max(0, input.order.sellerDiscountTotal), rawGross);
  const discountRatio = rawGross > 0 ? (rawGross - discount) / rawGross : 1;

  const details = input.order.items.map((item) => {
    const gross = roundCurrency(item.quantity * item.unitPriceVatIncluded * discountRatio);
    const base = roundCurrency(gross / (1 + item.vatRate / 100));
    const vat = roundCurrency(gross - base);
    const unitPrice = item.quantity > 0 ? roundCurrency(base / item.quantity) : 0;
    return {
      productCode: item.sku || item.id,
      productName: item.title,
      unitCode: 'C62',
      qty: item.quantity,
      unitPriceTra: unitPrice,
      amtTra: base,
      vatRate: item.vatRate,
      amtVatTra: vat,
      taxableAmtTra: base,
      allowanceCharge: [],
    };
  });

  if (input.order.includeShippingInInvoice && input.order.shippingFeeVatIncluded > 0) {
    const gross = roundCurrency(input.order.shippingFeeVatIncluded);
    const base = roundCurrency(gross / 1.2);
    const vat = roundCurrency(gross - base);
    details.push({
      productCode: 'KARGO',
      productName: 'Kargo',
      unitCode: 'C62',
      qty: 1,
      unitPriceTra: base,
      amtTra: base,
      vatRate: 20,
      amtVatTra: vat,
      taxableAmtTra: base,
      allowanceCharge: [],
    });
  }

  const lineExtensionAmount = roundCurrency(details.reduce((sum, line) => sum + line.amtTra, 0));
  const taxAmount = roundCurrency(details.reduce((sum, line) => sum + line.amtVatTra, 0));
  const payableAmount = roundCurrency(lineExtensionAmount + taxAmount);
  const byRate = new Map<number, { base: number; tax: number }>();
  for (const line of details) {
    const current = byRate.get(line.vatRate) ?? { base: 0, tax: 0 };
    current.base = roundCurrency(current.base + line.amtTra);
    current.tax = roundCurrency(current.tax + line.amtVatTra);
    byRate.set(line.vatRate, current);
  }

  const { docDate, docTime } = istanbulStamp(input.now);
  const orderDate = input.order.orderDate.slice(0, 10);
  const buyerIsPerson = buyerId.normalizedId.length === 11;
  const pkAlias = eDocumentType === 'EFATURA' ? input.buyerPkAlias?.trim() || '' : '';
  const notes = input.order.orderNote?.trim()
    ? [{ note: input.order.orderNote.trim() }]
    : [];

  return {
    isCalculateByApi: false,
    id: 0,
    eDocumentType,
    profile: scenario,
    invoiceType: 'SATIS',
    ettn: '',
    prefix: prefixOf(
      eDocumentType === 'EFATURA' ? input.eInvoicePrefix : input.eArchivePrefix,
      eDocumentType === 'EFATURA' ? 'EFT' : 'EAR'
    ),
    docNo: '',
    docDate,
    docTime,
    currencyCode: 'TRY',
    currencyRate: '1',
    senderType: 'ELEKTRONIK',
    orderNo: input.order.marketplaceOrderNumber,
    orderDate,
    pkAlias,
    tenantIdentifierNumber: sellerId,
    isSaveAsDraft: false,
    isAddPayableAmountString: true,
    referanceKey: input.order.id,
    notes,
    invoiceAccount: {
      vknTckn: buyerId.normalizedId,
      accountName: input.order.customerName,
      taxOfficeName: input.order.taxOffice || '',
      countryName: 'TÜRKİYE',
      cityName: input.order.city || '',
      citySubdivision: input.order.district || '',
      streetName: input.order.address || '',
      email1: input.order.email || '',
      personInfo: buyerIsPerson ? splitPersonName(input.order.customerName) : null,
    },
    isManuelCalculation: true,
    invoiceCalculation: {
      lineExtensionAmount,
      taxExclusiveAmount: lineExtensionAmount,
      taxInclusiveAmount: payableAmount,
      payableAmount,
      allowanceTotalAmount: roundCurrency(discount),
    },
    tax: [
      {
        taxAmount,
        taxSubTotal: [...byRate.entries()].map(([rate, amounts], index) => ({
          taxableAmount: amounts.base,
          taxAmount: amounts.tax,
          calculationSequenceNumeric: index,
          percent: String(rate),
          taxName: 'Katma Değer Vergisi',
          taxTypeCode: '0015',
        })),
      },
    ],
    invoiceDetail: details,
  };
}

export function sellerFromCompany(profile: CompanyProfile | undefined): MysoftSellerInput | null {
  if (!profile) return null;
  return {
    taxIdentifier: profile.taxIdentifier,
    legalTitle: profile.legalTitle,
    taxOffice: profile.taxOffice,
    city: profile.city,
    district: profile.district,
    addressLine: profile.addressLine,
    pkAlias: profile.eInvoiceAliasPk,
  };
}
