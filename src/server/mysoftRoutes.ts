import { Router, type Request, type Response } from 'express';
import type { MarketplaceOrder } from '../types/invoicing.ts';
import { determineDocumentType } from '../utils/invoicingEngine.ts';
import { MysoftClient, MysoftError, digitsOnly, readMysoftConfig } from './mysoft.ts';
import { buildMysoftInvoicePayload, type MysoftSellerInput } from './mysoftInvoice.ts';

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

  router.post('/outgoing', async (req, res) => {
    try {
      const body = req.body as {
        order?: MarketplaceOrder;
        seller?: MysoftSellerInput;
        preferredScenario?: 'TEMELFATURA' | 'TICARIFATURA';
        eInvoicePrefix?: string;
        eArchivePrefix?: string;
        tenantIdentifierNumber?: string;
      };
      if (!body.order || !body.seller) {
        res.status(400).json({ error: 'Sipariş ve satıcı bilgisi gerekli.', code: 'INVALID_REQUEST' });
        return;
      }
      const tenant = tenantFrom(req, client.publicStatus.tenantIdentifierNumber) ?? digitsOnly(body.seller.taxIdentifier);
      const payload = buildMysoftInvoicePayload({
        order: body.order,
        seller: { ...body.seller, taxIdentifier: tenant || body.seller.taxIdentifier },
        preferredScenario: body.preferredScenario,
        eInvoicePrefix: body.eInvoicePrefix,
        eArchivePrefix: body.eArchivePrefix,
      });
      const { documentType } = determineDocumentType(body.order, body.preferredScenario ?? 'TICARIFATURA');
      if (documentType === 'E_FATURA') {
        const buyer = digitsOnly(body.order.taxIdentifier);
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

  router.get('/:direction/:ettn/pdf', async (req, res) => {
    const direction = req.params.direction === 'incoming' ? 'incoming' : req.params.direction === 'outgoing' ? 'outgoing' : '';
    if (!direction) {
      res.status(404).json({ error: 'Belge yönü geçersiz.', code: 'INVALID_REQUEST' });
      return;
    }
    try {
      const bytes = await client.pdf(
        direction,
        req.params.ettn,
        tenantFrom(req, client.publicStatus.tenantIdentifierNumber)
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.ettn}.pdf"`);
      res.send(bytes);
    } catch (error) {
      fail(res, error);
    }
  });

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
      fail(res, error);
    }
  });

  return router;
}
