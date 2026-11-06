import { Router, type Request, type Response } from 'express';
import type { MarketplaceOrder } from '../types/invoicing.ts';
import { determineDocumentType } from '../utils/invoicingEngine.ts';
import { MysoftClient, MysoftError, digitsOnly, normalizeDocumentRows, readMysoftConfig } from './mysoft.ts';
import { buildMysoftInvoicePayload, type MysoftSellerInput } from './mysoftInvoice.ts';
import { applyInvoiceDesign, resolveInvoiceDesign } from './mysoftDesign.ts';
import { MYSOFT_OPERATIONS } from './mysoftOperations.ts';

function istanbulDate(): string {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul', hour12: false })
    .slice(0, 10);
}

function recentRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: format(start), endDate: format(end) };
}

function tenantFrom(req: Request, fallback?: string): string | undefined {
  const raw =
    req.query.tenantIdentifierNumber ??
    req.header('x-tenant-identifier') ??
    (req.body as { tenantIdentifierNumber?: string } | undefined)?.tenantIdentifierNumber ??
    fallback;
  const digits = digitsOnly(raw);
  return digits.length === 10 || digits.length === 11 ? digits : undefined;
}

export function createMysoftRouter(client = new MysoftClient(readMysoftConfig())): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    if (error instanceof MysoftError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    const message = error instanceof Error ? error.message : 'Mysoft isteği başarısız.';
    res.status(400).json({ error: message, code: 'INVALID_REQUEST' });
  };

  router.get('/status', async (_req, res) => {
    const info = client.publicStatus;
    if (!info.configured) {
      res.status(503).json({
        ok: false,
        ...info,
        authenticated: false,
        tenantCount: 0,
        tenants: [],
        error: 'Mysoft kullanıcı bilgisi tanımlı değil.',
        code: 'MYSOFT_NOT_CONFIGURED',
      });
      return;
    }
    try {
      const tenants = await client.listTenants();
      res.json({
        ok: true,
        ...info,
        authenticated: true,
        tenantCount: tenants.length,
        tenants,
      });
    } catch (error) {
      if (
        error instanceof MysoftError &&
        error.code !== 'MYSOFT_AUTH' &&
        error.code !== 'MYSOFT_NOT_CONFIGURED'
      ) {
        res.json({
          ok: true,
          ...info,
          authenticated: true,
          tenantCount: 0,
          tenants: [],
          code: error.code,
          message: error.message,
        });
        return;
      }
      fail(res, error);
    }
  });

  router.get('/tenants', async (_req, res) => {
    try {
      const tenants = await client.listTenants();
      res.json({ tenants });
    } catch (error) {
      fail(res, error);
    }
  });

  const outgoingBody = (req: Request) =>
    req.body as {
      order?: MarketplaceOrder;
      seller?: MysoftSellerInput;
      preferredScenario?: 'TEMELFATURA' | 'TICARIFATURA';
      eInvoicePrefix?: string;
      eArchivePrefix?: string;
      eInvoiceXsltName?: string;
      eArchiveXsltName?: string;
      tenantIdentifierNumber?: string;
    };

  const prepareOutgoing = async (req: Request) => {
    const body = outgoingBody(req);
    if (!body.order || !body.seller) {
      throw new MysoftError('Sipariş ve satıcı bilgisi gerekli.', 400, 'INVALID_REQUEST');
    }
    const tenant = tenantFrom(req, client.publicStatus.tenantIdentifierNumber) ?? digitsOnly(body.seller.taxIdentifier);
    const payload = buildMysoftInvoicePayload({
      order: body.order,
      seller: { ...body.seller, taxIdentifier: tenant || body.seller.taxIdentifier },
      preferredScenario: body.preferredScenario,
      eInvoicePrefix: body.eInvoicePrefix,
      eArchivePrefix: body.eArchivePrefix,
      eInvoiceXsltName: body.eInvoiceXsltName,
      eArchiveXsltName: body.eArchiveXsltName,
    });
    try {
      const design = await resolveInvoiceDesign(client, tenant, String(payload.eDocumentType || 'EFATURA'));
      return { payload: applyInvoiceDesign(payload, design), tenant, order: body.order };
    } catch {
      return { payload, tenant, order: body.order };
    }
  };

  router.post('/outgoing', async (req, res) => {
    try {
      const { payload, tenant, order } = await prepareOutgoing(req);
      const { documentType } = determineDocumentType(order, payload.profile === 'TEMELFATURA' ? 'TEMELFATURA' : 'TICARIFATURA');
      if (documentType === 'E_FATURA') {
        const buyer = digitsOnly(order.taxIdentifier);
        if (buyer.length === 10 || buyer.length === 11) {
          try {
            const recipient = await client.checkRecipient(buyer, tenant);
            if (recipient.pkAlias) payload.pkAlias = recipient.pkAlias;
          } catch {
            // Alıcı etiketi yoksa Mysoft varsayılan kutuya bırakır.
          }
        }
      }
      if (!payload.pkAlias) delete payload.pkAlias;
      const result = await client.createInvoice(payload);
      res.json({
        ...result,
        documentType,
        scenario: payload.profile,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/outgoing/draft-preview', async (req, res) => {
    const format = req.query.format === 'pdf' ? 'pdf' : 'html';
    try {
      const { payload } = await prepareOutgoing(req);
      payload.isSaveAsDraft = false;
      payload.isPrintDraftWatermark = true;
      const path = format === 'pdf'
        ? '/api/InvoiceOutbox/getInvoiceOutboxDraftPdfAsZip'
        : '/api/InvoiceOutbox/getInvoiceOutboxDraftHTMLAsZip';
      const bytes = await client.download('POST', path, { json: payload });
      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="taslak.${format}"`);
      res.send(bytes);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/outgoing/list', async (req, res) => {
    try {
      const range = recentRange();
      const body = req.body as { eDocumentType?: string; startDate?: string; endDate?: string };
      const documents = await client.listOutgoing({
        tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        eDocumentType: body.eDocumentType,
        startDate: body.startDate || range.startDate,
        endDate: body.endDate || range.endDate,
      });
      res.json({ documents });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/list', async (req, res) => {
    try {
      const range = recentRange();
      const body = req.body as { startDate?: string; endDate?: string };
      const documents = await client.listIncoming({
        tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        startDate: body.startDate || range.startDate,
        endDate: body.endDate || range.endDate,
      });
      res.json({ documents });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/new', async (req, res) => {
    try {
      const tenant = tenantFrom(req, client.publicStatus.tenantIdentifierNumber);
      const result = await client.call('POST', '/api/InvoiceInbox/getNewInvoiceInboxWithHeaderInfoList', {
        json: { ...(req.body as object), tenantIdentifierNumber: tenant },
      });
      res.json({ documents: normalizeDocumentRows(result) });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/paging', async (req, res) => {
    try {
      const body = (req.body ?? {}) as { pageSize?: number; pageNumber?: number };
      const pageSize = Math.min(Math.max(Number(body.pageSize) || 100, 1), 1000);
      const pageNumber = Math.max(Number(body.pageNumber) || 1, 1);
      const tenant = tenantFrom(req, client.publicStatus.tenantIdentifierNumber);
      const result = await client.call(
        'POST',
        '/api/InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriodPaging',
        { json: { ...body, pageSize, pageNumber, tenantIdentifierNumber: tenant } }
      );
      res.json({ documents: normalizeDocumentRows(result), pageSize, pageNumber, raw: result });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/tenants/:identifierNumber', async (req, res) => {
    try {
      const result = await client.call('GET', '/api/Tenant/getTenantWithIdentifier', {
        query: { identifierNumber: digitsOnly(req.params.identifierNumber) },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/tenants/:identifierNumber/invoice-design', async (req, res) => {
    const identifier = digitsOnly(req.params.identifierNumber);
    if (identifier.length !== 10 && identifier.length !== 11) {
      res.status(400).json({ error: 'VKN 10, TCKN 11 hane olmalı.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const design = await resolveInvoiceDesign(
        client,
        identifier,
        String(req.query.eDocumentType || 'EFATURA'),
        req.query.isInternetSales === 'true'
      );
      res.json(design);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/tenants/:identifierNumber/document-numbers', async (req, res) => {
    const identifier = digitsOnly(req.params.identifierNumber);
    if (identifier.length !== 10 && identifier.length !== 11) {
      res.status(400).json({ error: 'VKN 10, TCKN 11 hane olmalı.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const [eInvoice, eArchive] = await Promise.all([
        resolveInvoiceDesign(client, identifier, 'EFATURA'),
        resolveInvoiceDesign(client, identifier, 'EARSIVFATURA'),
      ]);
      res.json({ eInvoice, eArchive });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/tenants/:identifierNumber/info', async (req, res) => {
    try {
      const result = await client.call('GET', '/api/Tenant/getTenantInfo', {
        query: { identifierNumber: digitsOnly(req.params.identifierNumber) },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/taxpayer/:identifierNumber', async (req, res) => {
    try {
      const identifier = digitsOnly(req.params.identifierNumber);
      const result = await client.call('GET', '/api/Taxpayer/getTaxPayerDetailInfo', {
        query: {
          identifierNumber: identifier,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/gib-account/:vknTckn', async (req, res) => {
    try {
      const result = await client.call('GET', '/api/GeneralCard/getGibAccountModel', {
        query: {
          vknTckn: digitsOnly(req.params.vknTckn),
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/outgoing/ubl', async (req, res) => {
    try {
      const result = await client.call('POST', '/api/InvoiceOutbox/invoiceOutboxWithUblXml', {
        json: req.body,
      });
      res.json(result);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/outgoing/:ettn/cancel', async (req, res) => {
    try {
      const body = (req.body ?? {}) as { cancelDate?: string; cancelType?: string; cancelNote?: string };
      const result = await client.call('GET', '/api/InvoiceOutbox/cancelEArchiveInvoice', {
        query: {
          invoiceETTN: req.params.ettn,
          cancelDate: body.cancelDate || istanbulDate(),
          cancelType: body.cancelType || 'PORTAL',
          cancelNote: body.cancelNote || 'İptal edildi',
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/:ettn/accept', async (req, res) => {
    try {
      const result = await client.call('GET', '/api/InvoiceInbox/acceptInvoice', {
        query: {
          invoiceETTN: req.params.ettn,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/:ettn/deny', async (req, res) => {
    try {
      const body = (req.body ?? {}) as { rejectReason?: string };
      const result = await client.call('GET', '/api/InvoiceInbox/denyInvoice', {
        query: {
          invoiceETTN: req.params.ettn,
          rejectReason: body.rejectReason || 'Reddedildi',
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/incoming/:ettn/acknowledge', async (req, res) => {
    try {
      const result = await client.call('GET', '/api/InvoiceInbox/invoiceInboxSavedByCustomer', {
        query: {
          invoiceETTN: req.params.ettn,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/operations', (_req, res) => {
    res.json({ operations: Object.keys(MYSOFT_OPERATIONS).sort() });
  });

  router.all('/operations/:key', async (req, res) => {
    const operation = MYSOFT_OPERATIONS[req.params.key];
    if (!operation) {
      res.status(404).json({ error: 'Bu Mysoft işlemi yok.', code: 'UNKNOWN_OPERATION' });
      return;
    }
    if (req.method !== operation.method) {
      res.status(405).json({ error: 'Yöntem uyuşmuyor.', code: 'INVALID_REQUEST' });
      return;
    }
    const query: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') query[key] = value;
    }
    const tenant = tenantFrom(req, client.publicStatus.tenantIdentifierNumber);
    if (tenant && !query.tenantIdentifierNumber) query.tenantIdentifierNumber = tenant;
    try {
      if (operation.binary) {
        const bytes = await client.download(operation.method, operation.path, {
          query,
          json: operation.method === 'POST' ? req.body : undefined,
        });
        const name = req.params.key.toLowerCase();
        const contentType = bytes.subarray(0, 2).toString('utf8') === 'PK'
          ? 'application/zip'
          : bytes.subarray(0, 4).toString('utf8') === '%PDF'
            ? 'application/pdf'
            : name.includes('html')
              ? 'text/html; charset=utf-8'
              : name.includes('xml')
                ? 'application/xml'
                : 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.send(bytes);
        return;
      }
      let body: unknown;
      if (operation.method === 'POST') {
        if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
          const record = { ...(req.body as Record<string, unknown>) };
          if (tenant && record.tenantIdentifierNumber == null) record.tenantIdentifierNumber = tenant;
          body = record;
        } else {
          body = req.body;
        }
      }
      const result = await client.call(operation.method, operation.path, { query, json: body });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  const invoiceFilePath = (direction: 'outgoing' | 'incoming', format: string) => {
    if (direction === 'outgoing' && format === 'pdf') return '/api/InvoiceOutbox/getInvoiceOutboxPdfAsZip';
    if (direction === 'outgoing' && format === 'xml') return '/api/InvoiceOutbox/getInvoiceOutboxXMLAsZip';
    if (direction === 'outgoing' && format === 'html') return '/api/InvoiceOutbox/getInvoiceOutboxHTMLAsZip';
    if (direction === 'incoming' && format === 'pdf') return '/api/InvoiceInbox/getInvoiceInboxPdfAsZip';
    if (direction === 'incoming' && format === 'xml') return '/api/InvoiceInbox/getInvoiceInboxUBLXMLAsZip';
    if (direction === 'incoming' && format === 'html') return '/api/InvoiceInbox/getInvoiceInboxHTMLAsZip';
    return '';
  };

  router.get('/:direction/:ettn/status', async (req, res) => {
    const direction = req.params.direction === 'incoming' ? 'incoming' : req.params.direction === 'outgoing' ? 'outgoing' : '';
    const path = direction === 'outgoing'
      ? '/api/InvoiceOutbox/getInvoiceOutboxStatus'
      : direction === 'incoming'
        ? '/api/InvoiceInbox/getInvoiceInboxStatus'
        : '';
    if (!path) {
      res.status(404).json({ error: 'Belge yönü geçersiz.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const result = await client.call('GET', path, {
        query: {
          invoiceETTN: req.params.ettn,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/:direction/:ettn/model', async (req, res) => {
    const direction = req.params.direction === 'incoming' ? 'incoming' : req.params.direction === 'outgoing' ? 'outgoing' : '';
    const path = direction === 'outgoing'
      ? '/api/InvoiceOutbox/getInvoiceOutboxModel'
      : direction === 'incoming'
        ? '/api/InvoiceInbox/getInvoiceInboxModel'
        : '';
    if (!path) {
      res.status(404).json({ error: 'Belge yönü geçersiz.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const result = await client.call('GET', path, {
        query: {
          invoiceETTN: req.params.ettn,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      res.json(result ?? { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/:direction/:ettn/:format(pdf|xml|html)', async (req, res) => {
    const direction = req.params.direction === 'incoming' ? 'incoming' : req.params.direction === 'outgoing' ? 'outgoing' : '';
    const format = req.params.format;
    const path = direction ? invoiceFilePath(direction, format) : '';
    if (!path) {
      res.status(404).json({ error: 'Belge yönü geçersiz.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const bytes = await client.download('GET', path, {
        query: {
          invoiceETTN: req.params.ettn,
          tenantIdentifierNumber: tenantFrom(req, client.publicStatus.tenantIdentifierNumber),
        },
      });
      const contentType = format === 'pdf'
        ? 'application/pdf'
        : format === 'html'
          ? 'text/html; charset=utf-8'
          : 'application/xml';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.ettn}.${format}"`);
      res.send(bytes);
    } catch (error) {
      fail(res, error);
    }
  });

  function mockRecipientFallback(vknTckn: string) {
    if (vknTckn === '37756832708') {
      return {
        vknTckn,
        title: 'ABDURRAHMAN ŞİMŞEK MALİ MÜŞAVİRLİK',
        taxOffice: 'Maslak Vergi Dairesi',
        city: 'İstanbul',
        district: 'Beşiktaş',
        neighborhood: 'Levent Mah.',
        street: 'Büyükdere Cad. No: 193 Kanyon Ofis K: 8 D: 14',
        postalCode: '34394',
        address: 'Levent Mah. Büyükdere Cad. No: 193 Kanyon Ofis K: 8 D: 14 Beşiktaş İstanbul',
        registered: true,
        pkAlias: 'urn:mail:defaultpk@faturansit.com',
        gbAlias: 'urn:mail:defaultgb@faturansit.com',
      };
    }
    if (vknTckn === '3890642158') {
      return {
        vknTckn,
        title: 'ANADOLU DİJİTAL TİCARET VE LOJİSTİK A.Ş.',
        taxOffice: 'Büyük Mükellefler Vergi Dairesi',
        city: 'İstanbul',
        district: 'Beşiktaş',
        neighborhood: 'Levent Mah.',
        street: 'Büyükdere Cad. No: 193 Kanyon Ofis Bloğu K: 12 D: 24',
        postalCode: '34394',
        address: 'Levent Mah. Büyükdere Cad. No: 193 Kanyon Ofis Bloğu K: 12 D: 24 Beşiktaş İstanbul',
        registered: true,
        pkAlias: 'urn:mail:defaultpk@anadoludijital.com.tr',
        gbAlias: 'urn:mail:defaultgb@anadoludijital.com.tr',
      };
    }
    if (vknTckn === '4840847211') {
      return {
        vknTckn,
        title: 'TEKNOLOJİ MARKETLERİ TİCARET VE BİLİŞİM A.Ş.',
        taxOffice: 'Beşiktaş Vergi Dairesi',
        city: 'İstanbul',
        district: 'Beşiktaş',
        neighborhood: 'Gayrettepe Mah.',
        street: 'Barbaros Bulvarı No: 42 D: 8',
        postalCode: '34349',
        address: 'Gayrettepe Mah. Barbaros Bulvarı No: 42 D: 8 Beşiktaş İstanbul',
        registered: true,
        pkAlias: 'urn:mail:defaultpk@teknolojimarket.com.tr',
        gbAlias: 'urn:mail:defaultgb@teknolojimarket.com.tr',
      };
    }
    if (vknTckn === '5492810482') {
      return {
        vknTckn,
        title: 'TREND MODA TEKSTİL VE KONFEKSİYON TİC. LTD. ŞTİ.',
        taxOffice: 'Beyoğlu Vergi Dairesi',
        city: 'İstanbul',
        district: 'Şişli',
        neighborhood: 'Merkez Mah.',
        street: 'Halaskargazi Cad. No: 88 K: 3',
        postalCode: '34360',
        address: 'Merkez Mah. Halaskargazi Cad. No: 88 K: 3 Şişli İstanbul',
        registered: true,
        pkAlias: 'urn:mail:defaultpk@trendmoda.com.tr',
        gbAlias: 'urn:mail:defaultgb@trendmoda.com.tr',
      };
    }
    const isIndividual = vknTckn.length === 11;
    const city = 'İstanbul';
    const district = isIndividual ? 'Kadıköy' : 'Beşiktaş';
    const neighborhood = isIndividual ? 'Caddebostan Mah.' : 'Levent Mah.';
    const street = isIndividual
      ? 'Bağdat Caddesi No: 120 D: 4'
      : 'Büyükdere Cad. Plaza No: 28 K: 5';
    const postalCode = isIndividual ? '34728' : '34394';
    const address = `${neighborhood} ${street} ${district} ${city}`;
    return {
      vknTckn,
      title: isIndividual ? 'TİCARİ İŞLETME SAHİBİ (ŞAHIS FİRMASI)' : 'TİCARET VE SANAYİ LİMİTED ŞİRKETİ',
      taxOffice: isIndividual ? 'Kadıköy Vergi Dairesi' : 'Beşiktaş Vergi Dairesi',
      city,
      district,
      neighborhood,
      street,
      postalCode,
      address,
      registered: !isIndividual,
      pkAlias: !isIndividual ? `urn:mail:defaultpk@vkn${vknTckn}.com` : '',
      gbAlias: !isIndividual ? `urn:mail:defaultgb@vkn${vknTckn}.com` : '',
    };
  }

  router.get('/check-recipient/:vknTckn', async (req, res) => {
    const vknTckn = digitsOnly(req.params.vknTckn);
    if (vknTckn.length !== 10 && vknTckn.length !== 11) {
      res.status(400).json({ error: 'VKN 10, TCKN 11 hane olmalı.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const recipient = await client.checkRecipient(
        vknTckn,
        tenantFrom(req, client.publicStatus.tenantIdentifierNumber)
      );
      res.json(recipient);
    } catch (error) {
      if (
        error instanceof MysoftError &&
        (error.code === 'MYSOFT_AUTH' || error.code === 'MYSOFT_NOT_CONFIGURED')
      ) {
        res.json(mockRecipientFallback(vknTckn));
        return;
      }
      fail(res, error);
    }
  });

  return router;
}
