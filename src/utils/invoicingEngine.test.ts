import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTurkishTaxIdentifier,
  determineDocumentType,
  calculateOrderTotals,
  generateGibInvoiceNumber,
  getIntegratorPrefixForDocument,
  issueInvoiceForOrder,
  evaluateAutomationRules,
  computeTaxAndCommissionReport,
  formatTurkishAmountInWords,
  validateAndCreatePlatformUser,
  validateAndConnectUserMarketplace,
  allocateUserInvoiceCredits,
  toggleUserAccountStatus,
  deletePlatformUser,
  generateUblTrXmlPreview,
} from './invoicingEngine';
import {
  INITIAL_ORDERS,
  INITIAL_RULES,
  INITIAL_INTEGRATIONS,
  INITIAL_USERS,
} from '../data/seedData';

test('deletePlatformUser removes specified user and company from users list', () => {
  const targetUser = INITIAL_USERS[1];
  const deleteRes = deletePlatformUser(INITIAL_USERS, targetUser.id);
  assert.equal(deleteRes.success, true);
  assert.equal(deleteRes.deletedUser?.id, targetUser.id);
  assert.equal(deleteRes.deletedUser?.companyName, targetUser.companyName);
  assert.equal(deleteRes.remainingUsers.length, INITIAL_USERS.length - 1);
  assert.ok(!deleteRes.remainingUsers.some((u) => u.id === targetUser.id));

  // Non-existent user
  const failRes = deletePlatformUser(INITIAL_USERS, 'non-existent-user');
  assert.equal(failRes.success, false);
});

test('allocateUserInvoiceCredits and toggleUserAccountStatus update admin user state accurately', () => {
  const user = INITIAL_USERS[0];
  const toppedUp = allocateUserInvoiceCredits(user, 1000);
  assert.equal(toppedUp.eInvoiceCreditBalance, user.eInvoiceCreditBalance + 1000);
  assert.equal(toppedUp.eInvoiceCreditLimit, user.eInvoiceCreditLimit + 1000);

  const toggled = toggleUserAccountStatus(user);
  assert.equal(toggled.isActive, !user.isActive);
});

test('validateAndCreatePlatformUser validates email, VKN/TCKN, and prevents duplicate emails', () => {
  const duplicateRes = validateAndCreatePlatformUser(
    {
      fullName: 'Test Kullanıcı',
      email: INITIAL_USERS[0].email,
      phone: '+90 555 111 22 33',
      role: 'ADMIN',
      companyName: 'Test Ticaret A.Ş.',
      taxIdentifier: '1234567890',
      eInvoiceIntegrator: 'FATURANSIT',
    },
    INITIAL_USERS
  );
  assert.equal(duplicateRes.valid, false);

  const validRes = validateAndCreatePlatformUser(
    {
      fullName: 'Deniz Arslan',
      email: 'deniz.arslan@arslanteknoloji.com.tr',
      phone: '+90 532 999 88 77',
      role: 'ADMIN',
      companyName: 'Arslan Teknoloji Perakende A.Ş.',
      taxIdentifier: '8291049382',
      eInvoiceIntegrator: 'FATURANSIT',
    },
    INITIAL_USERS
  );
  assert.equal(validRes.valid, true);
  assert.equal(validRes.user?.taxIdentifier, '8291049382');
  assert.equal(validRes.user?.integratedMarketplaces.length, 0);
});

test('validateAndConnectUserMarketplace connects new marketplace credentials and masks API key', () => {
  const baseUser = INITIAL_USERS[0];
  const connectRes = validateAndConnectUserMarketplace(baseUser, {
    marketplace: 'idefix',
    storeName: 'Anadolu İdefix Kitap & Elektronik',
    sellerId: 'IDF-77210',
    apiKey: 'IDEFIX99887766KEY',
    apiSecret: 'SECRET998877',
    invoiceSeriesPrefix: 'IDF',
    defaultCommissionRate: 14.0,
    autoSyncIntervalMinutes: 10,
    webhookEnabled: true,
  });

  assert.equal(connectRes.valid, true);
  assert.equal(
    connectRes.updatedUser?.integratedMarketplaces.length,
    baseUser.integratedMarketplaces.length + 1
  );
  assert.equal(connectRes.credential?.apiKeyMasked, 'IDEF••••6KEY');
  assert.equal(connectRes.integrationCard?.invoiceSeriesPrefix, 'IDF');
});

test('formatTurkishAmountInWords formats official GİB Turkish currency text', () => {
  assert.equal(
    formatTurkishAmountInWords(4059.9),
    '#Yalnız DörtBinEllidokuzTürkLirası DoksanKuruş#'.replace('Ellidokuz', 'ElliDokuz')
  );
});

test('validateTurkishTaxIdentifier validates 10-digit VKN for corporate customers', () => {
  const validCorp = validateTurkishTaxIdentifier('4820193847', 'CORPORATE');
  assert.equal(validCorp.valid, true);
  assert.equal(validCorp.normalizedId, '4820193847');

  const invalidCorp = validateTurkishTaxIdentifier('482019', 'CORPORATE');
  assert.equal(invalidCorp.valid, false);
  assert.ok(invalidCorp.error?.includes('10 haneli'));
});

test('validateTurkishTaxIdentifier validates 11-digit TCKN and Nihai Tüketici fallback', () => {
  const validIndiv = validateTurkishTaxIdentifier('28491038472', 'INDIVIDUAL');
  assert.equal(validIndiv.valid, true);

  const missingNoFallback = validateTurkishTaxIdentifier('', 'INDIVIDUAL', false);
  assert.equal(missingNoFallback.valid, false);

  const missingWithFallback = validateTurkishTaxIdentifier('', 'INDIVIDUAL', true);
  assert.equal(missingWithFallback.valid, true);
  assert.equal(missingWithFallback.normalizedId, '11111111111');
});

test('determineDocumentType routes corporate e-Fatura payers vs e-Arşiv individuals', () => {
  const corp = determineDocumentType(
    { customerType: 'CORPORATE', isEFaturaRegistered: true },
    'TICARIFATURA'
  );
  assert.equal(corp.documentType, 'E_FATURA');
  assert.equal(corp.scenario, 'TICARIFATURA');

  const indiv = determineDocumentType({
    customerType: 'INDIVIDUAL',
    isEFaturaRegistered: false,
  });
  assert.equal(indiv.documentType, 'E_ARSIV');
  assert.equal(indiv.scenario, 'EARSIVFATURA');
});

test('calculateOrderTotals computes multi-rate KDV (1%, 10%, 20%), shipping, commission, and stopaj accurately', () => {
  const totals = calculateOrderTotals(
    [
      {
        id: '1',
        sku: 'ELK-1',
        title: 'Kablosuz Kulaklık',
        quantity: 1,
        unitPriceVatIncluded: 1200, // 1000 base + 200 VAT (20%)
        vatRate: 20,
      },
      {
        id: '2',
        sku: 'TKS-1',
        title: 'Pamuklu Tişört',
        quantity: 1,
        unitPriceVatIncluded: 1100, // 1000 base + 100 VAT (10%)
        vatRate: 10,
      },
    ],
    60, // 50 base + 10 VAT (20%)
    true,
    0,
    15, // 15% commission
    1 // 1% stopaj on base
  );

  assert.equal(totals.subtotalExclVat, 2050);
  assert.equal(totals.totalVat, 310);
  assert.equal(totals.grossInvoiceTotal, 2360);
  assert.equal(totals.vatBreakdown.rate20.base, 1050);
  assert.equal(totals.vatBreakdown.rate20.tax, 210);
  assert.equal(totals.vatBreakdown.rate10.base, 1000);
  assert.equal(totals.vatBreakdown.rate10.tax, 100);
  assert.equal(totals.marketplaceCommissionAmount, 354);
  assert.equal(totals.withholdingTaxAmount, 20.5);
  assert.equal(totals.netSellerPayout, 1985.5);
});

test('generateGibInvoiceNumber creates 16-character official GİB format', () => {
  const gibNo = generateGibInvoiceNumber('TRD', 2026, 1482);
  assert.equal(gibNo.length, 16);
  assert.equal(gibNo, 'TRD2026000001482');
});

test('getIntegratorPrefixForDocument returns official GİB Özel Entegratör prefixes', () => {
  assert.equal(getIntegratorPrefixForDocument('E_FATURA'), 'EFT');
  assert.equal(getIntegratorPrefixForDocument('E_ARSIV'), 'EAR');
  assert.equal(
    getIntegratorPrefixForDocument('E_FATURA', { eInvoicePrefix: 'XYZ', eArchivePrefix: 'ABC' }),
    'XYZ'
  );
  assert.equal(
    getIntegratorPrefixForDocument('E_ARSIV', { eInvoicePrefix: 'XYZ', eArchivePrefix: 'ABC' }),
    'ABC'
  );
});

test('issueInvoiceForOrder transitions valid pending order to INVOICED using GİB Özel Entegratör prefixes', () => {
  const pendingOrder = INITIAL_ORDERS.find((o) => o.invoiceStatus === 'PENDING')!;
  const res = issueInvoiceForOrder(pendingOrder, 2050, { eInvoicePrefix: 'EFT', eArchivePrefix: 'EAR' });
  assert.equal(res.success, true);
  assert.equal(res.updatedOrder.invoiceStatus, 'INVOICED');
  // Pending order ord-1004 is individual -> EAR
  assert.equal(res.updatedOrder.gibInvoiceNumber?.slice(0, 3), 'EAR');

  const errorOrder = INITIAL_ORDERS.find((o) => o.invoiceStatus === 'ERROR_TAX_ID')!;
  const errRes = issueInvoiceForOrder(errorOrder, 2051, 'EAR', {
    allowDefaultTcknFallback: false,
  });
  assert.equal(errRes.success, false);
  assert.equal(errRes.updatedOrder.invoiceStatus, 'ERROR_TAX_ID');
});

test('evaluateAutomationRules strictly uses GİB Özel Entegratör prefixes and not marketplace prefixes', () => {
  const result = evaluateAutomationRules(INITIAL_ORDERS, INITIAL_RULES, 3000, {
    eInvoicePrefix: 'EFT',
    eArchivePrefix: 'EAR',
  });
  assert.ok(result.invoicedCount >= 3);
  assert.ok(result.nextSequence > 3000);

  // Verify that all generated invoices start with EFT or EAR, NEVER TRD, HPS, AMZ, or PZR
  const newInvoices = result.updatedOrders.filter(
    (o) => o.gibInvoiceNumber && o.gibInvoiceNumber.includes('202600000300')
  );
  for (const inv of newInvoices) {
    const prefix = inv.gibInvoiceNumber?.slice(0, 3);
    assert.ok(
      prefix === 'EFT' || prefix === 'EAR',
      `Fatura serisi GİB Özel Entegratöründen alınmalı (EFT/EAR), ancak ${prefix} bulundu.`
    );
  }
});

test('computeTaxAndCommissionReport aggregates totals across marketplaces', () => {
  const report = computeTaxAndCommissionReport(INITIAL_ORDERS, INITIAL_INTEGRATIONS);
  assert.equal(
    report.totalInvoicedCount + report.totalPendingCount + report.totalErrorCount,
    INITIAL_ORDERS.length
  );
  assert.ok(report.totalGrossInvoiced > report.totalMatrah);
  assert.equal(report.byMarketplace.length, INITIAL_INTEGRATIONS.length);
});

test('generateUblTrXmlPreview does NOT add application-injected notes and only adds synchronized order note if present', () => {
  const orderWithNote = {
    ...INITIAL_ORDERS[0],
    orderNote: 'Hediye paketi yapılsın lütfen.',
  };
  const xmlWithNote = generateUblTrXmlPreview(orderWithNote);
  assert.ok(xmlWithNote.includes('<cbc:Note>Hediye paketi yapılsın lütfen.</cbc:Note>'));
  // Ensure no application boilerplate is injected
  assert.ok(!xmlWithNote.includes('Pazaryeri:'));
  assert.ok(!xmlWithNote.includes('Kargo:'));

  const orderWithoutNote = {
    ...INITIAL_ORDERS[1],
    orderNote: undefined,
  };
  const xmlWithoutNote = generateUblTrXmlPreview(orderWithoutNote);
  assert.ok(!xmlWithoutNote.includes('<cbc:Note>'));
  assert.ok(!xmlWithoutNote.includes('Pazaryeri:'));
});
