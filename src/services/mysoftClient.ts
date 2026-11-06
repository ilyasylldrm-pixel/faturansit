import type { InvoiceDocumentType, InvoiceScenario, MarketplaceOrder } from '../types/invoicing';

export interface MysoftTenant {
  identifier: string;
  title: string;
}

export interface MysoftStatus {
  ok: boolean;
  environment: 'test' | 'prod';
  baseUrl: string;
  grantType: string;
  configured: boolean;
  authenticated: boolean;
  tenantCount: number;
  tenants: MysoftTenant[];
  message?: string;
  error?: string;
  code?: string;
}

export interface MysoftDocumentRow {
  ettn: string;
  docNo: string;
  accountName: string;
  vknTckn: string;
  docDate: string;
  payableAmount: number;
  profile: string;
  eDocumentType: string;
}

export interface MysoftIssueResult {
  ettn: string;
  docNo: string;
  message: string;
  documentType: InvoiceDocumentType;
  scenario: InvoiceScenario;
}

export interface MysoftRecipient {
  vknTckn: string;
  title: string;
  taxOffice: string;
  city: string;
  district: string;
  address: string;
  registered: boolean;
  pkAlias: string;
}

export interface MysoftSellerInput {
  taxIdentifier: string;
  legalTitle: string;
  taxOffice?: string;
  city?: string;
  district?: string;
  addressLine?: string;
}

export class MysoftClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'MysoftClientError';
    this.code = code;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new MysoftClientError(body.error || body.message || 'Mysoft isteği başarısız.', body.code);
  }
  return body as T;
}

export async function fetchMysoftStatus(): Promise<MysoftStatus> {
  const response = await fetch('/api/mysoft/status');
  const body = (await response.json().catch(() => ({}))) as MysoftStatus;
  if (!response.ok && !body.error) {
    throw new MysoftClientError('Mysoft durumu alınamadı.');
  }
  if (!response.ok) {
    throw new MysoftClientError(body.error || 'Mysoft durumu alınamadı.', body.code);
  }
  return body;
}

export async function issueMysoftInvoice(input: {
  order: MarketplaceOrder;
  seller: MysoftSellerInput;
  preferredScenario?: 'TEMELFATURA' | 'TICARIFATURA';
  eInvoicePrefix?: string;
  eArchivePrefix?: string;
}): Promise<MysoftIssueResult> {
  const response = await fetch('/api/mysoft/outgoing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      tenantIdentifierNumber: input.seller.taxIdentifier,
    }),
  });
  return readJson<MysoftIssueResult>(response);
}

export async function listMysoftDocuments(input: {
  direction: 'outgoing' | 'incoming';
  tenantIdentifierNumber?: string;
  eDocumentType?: 'EFATURA' | 'EARSIVFATURA';
}): Promise<MysoftDocumentRow[]> {
  const response = await fetch(`/api/mysoft/${input.direction}/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.tenantIdentifierNumber
        ? { 'x-tenant-identifier': input.tenantIdentifierNumber }
        : {}),
    },
    body: JSON.stringify({
      tenantIdentifierNumber: input.tenantIdentifierNumber,
      eDocumentType: input.eDocumentType,
    }),
  });
  const body = await readJson<{ documents: MysoftDocumentRow[] }>(response);
  return body.documents ?? [];
}

export async function checkMysoftRecipient(
  vknTckn: string,
  tenantIdentifierNumber?: string
): Promise<MysoftRecipient> {
  const query = tenantIdentifierNumber
    ? `?tenantIdentifierNumber=${encodeURIComponent(tenantIdentifierNumber)}`
    : '';
  const response = await fetch(
    `/api/mysoft/check-recipient/${encodeURIComponent(vknTckn)}${query}`
  );
  return readJson<MysoftRecipient>(response);
}

export async function downloadMysoftPdf(input: {
  direction: 'outgoing' | 'incoming';
  ettn: string;
  tenantIdentifierNumber?: string;
}): Promise<void> {
  const query = input.tenantIdentifierNumber
    ? `?tenantIdentifierNumber=${encodeURIComponent(input.tenantIdentifierNumber)}`
    : '';
  const response = await fetch(
    `/api/mysoft/${input.direction}/${encodeURIComponent(input.ettn)}/pdf${query}`
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new MysoftClientError(body.error || 'PDF alınamadı.', body.code);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${input.ettn}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
