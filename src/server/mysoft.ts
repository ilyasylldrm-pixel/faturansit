import { bytesLookLikePdf, firstZipFile } from './zip.ts';

export type MysoftEnvironment = 'test' | 'prod';
export type MysoftGrantType = 'client_credentials' | 'password';

const TEST_BASE = 'https://edocumentapi.mytest.tr';
const PROD_BASE = 'https://edocumentapi.mysoft.com.tr';

export interface MysoftConfig {
  environment: MysoftEnvironment;
  baseUrl: string;
  tokenUrl: string;
  grantType: MysoftGrantType;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  tenantIdentifierNumber?: string;
  timeoutMs: number;
  configured: boolean;
}

export interface MysoftTenant {
  identifier: string;
  title: string;
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

export interface MysoftOutboxResult {
  ettn: string;
  docNo: string;
  message: string;
}

export interface MysoftRecipient {
  vknTckn: string;
  title: string;
  taxOffice: string;
  city: string;
  district: string;
  neighborhood?: string;
  street?: string;
  postalCode?: string;
  address: string;
  registered: boolean;
  pkAlias: string;
  gbAlias?: string;
}

export class MysoftError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = 'MYSOFT_ERROR') {
    super(message);
    this.name = 'MysoftError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function digitsOnly(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function readMysoftConfig(env: NodeJS.ProcessEnv = process.env): MysoftConfig {
  const environment: MysoftEnvironment = env.MYSOFT_ENV?.trim() === 'prod' ? 'prod' : 'test';
  const baseUrl = (clean(env.MYSOFT_API_BASE_URL) ?? (environment === 'prod' ? PROD_BASE : TEST_BASE)).replace(/\/$/, '');
  const clientId = clean(env.MYSOFT_CLIENT_ID);
  const clientSecret = clean(env.MYSOFT_CLIENT_SECRET);
  const username = clean(env.MYSOFT_USERNAME);
  const password = clean(env.MYSOFT_PASSWORD);
  const explicit = clean(env.MYSOFT_GRANT_TYPE);
  let grantType: MysoftGrantType = 'password';
  if (explicit === 'client_credentials' || explicit === 'password') {
    grantType = explicit;
  } else if (clientId && clientSecret) {
    grantType = 'client_credentials';
  }
  const configured =
    grantType === 'client_credentials' ? Boolean(clientId && clientSecret) : Boolean(username && password);
  const timeoutRaw = Number(env.MYSOFT_TIMEOUT_MS);
  return {
    environment,
    baseUrl,
    tokenUrl: clean(env.MYSOFT_TOKEN_URL) ?? `${baseUrl}/oauth/token`,
    grantType,
    clientId,
    clientSecret,
    username,
    password,
    tenantIdentifierNumber: digitsOnly(env.MYSOFT_TENANT_IDENTIFIER_NUMBER) || undefined,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 30000,
    configured,
  };
}

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number {
  if (!record) return 0;
  for (const key of keys) {
    const value = record[key];
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function unwrapData(body: unknown): unknown {
  const record = asRecord(body);
  if (record && 'data' in record) return record.data;
  return body;
}

function rowsFrom(body: unknown): Record<string, unknown>[] {
  const data = unwrapData(body);
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  }
  const record = asRecord(data);
  if (!record) return [];
  for (const key of ['items', 'list', 'dataList', 'invoiceList', 'result']) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
    }
  }
  return [];
}

export function normalizeDocumentRows(body: unknown): MysoftDocumentRow[] {
  return rowsFrom(body).map((row) => ({
    ettn: pickString(row, ['invoiceETTN', 'ettn', 'ETTN']),
    docNo: pickString(row, ['docNo', 'invoiceNumber', 'documentNumber']),
    accountName: pickString(row, ['accountName', 'customerName', 'supplierName', 'partyName']),
    vknTckn: digitsOnly(pickString(row, ['vknTckn', 'identifierNumber', 'taxNumber', 'vkn'])),
    docDate: pickString(row, ['docDate', 'issueDate', 'documentDate']),
    payableAmount: pickNumber(row, ['payableAmount', 'taxInclusiveAmount', 'totalAmount', 'amount']),
    profile: pickString(row, ['profile', 'invoiceProfile', 'scenario']),
    eDocumentType: pickString(row, ['eDocumentType', 'documentType']),
  }));
}

export function extractOutboxResult(body: unknown): MysoftOutboxResult {
  const data = unwrapData(body);
  const record = asRecord(data) ?? asRecord(body);
  const message = pickString(asRecord(body), ['message', 'Message']) || pickString(record, ['message']);
  if (typeof data === 'string') {
    return { ettn: data, docNo: '', message };
  }
  return {
    ettn: pickString(record, ['invoiceETTN', 'ettn', 'ETTN']),
    docNo: pickString(record, ['docNo', 'invoiceNumber']),
    message,
  };
}

function failureMessage(body: unknown, fallback: string): { message: string; code: string } {
  const record = asRecord(body);
  const message = pickString(record, ['message', 'Message', 'error_description', 'error']) || fallback;
  const code = pickString(record, ['errorCode', 'code', 'error']) || 'MYSOFT_ERROR';
  if (message.includes('00164')) return { message, code: '00164' };
  if (message.includes('00243')) return { message, code: '00243' };
  return { message, code };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class MysoftClient {
  private config: MysoftConfig;

  constructor(config = readMysoftConfig()) {
    this.config = config;
  }

  get publicStatus() {
    return {
      environment: this.config.environment,
      baseUrl: this.config.baseUrl,
      grantType: this.config.grantType,
      configured: this.config.configured,
      tenantIdentifierNumber: this.config.tenantIdentifierNumber ?? '',
    };
  }

  assertConfigured(): void {
    if (!this.config.configured) {
      throw new MysoftError(
        'Mysoft kullanıcı bilgisi tanımlı değil.',
        503,
        'MYSOFT_NOT_CONFIGURED'
      );
    }
  }

  private async accessToken(force = false): Promise<string> {
    this.assertConfigured();
    if (!force && tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
      return tokenCache.accessToken;
    }
    const form = new URLSearchParams();
    form.set('grant_type', this.config.grantType);
    if (this.config.grantType === 'client_credentials') {
      form.set('client_id', this.config.clientId ?? '');
      form.set('client_secret', this.config.clientSecret ?? '');
    } else {
      form.set('username', this.config.username ?? '');
      form.set('password', this.config.password ?? '');
      if (this.config.clientId) form.set('client_id', this.config.clientId);
      if (this.config.clientSecret) form.set('client_secret', this.config.clientSecret);
    }
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    const body = await readBody(response);
    const record = asRecord(body);
    const accessToken = pickString(record, ['access_token', 'accessToken', 'token']);
    if (!response.ok || !accessToken) {
      const parsed = failureMessage(body, 'Mysoft oturumu açılamadı.');
      throw new MysoftError(parsed.message, response.status || 401, 'MYSOFT_AUTH');
    }
    const expiresIn = pickNumber(record, ['expires_in', 'expiresIn']) || 300;
    tokenCache = {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return accessToken;
  }

  private async request(
    path: string,
    init: { method?: string; query?: Record<string, string | undefined>; json?: unknown } = {},
    allowRetry = true
  ): Promise<unknown> {
    const token = await this.accessToken();
    const url = new URL(path.startsWith('http') ? path : `${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value) url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    let body: string | undefined;
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.json);
    }
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (response.status === 401 && allowRetry) {
      tokenCache = null;
      await this.accessToken(true);
      return this.request(path, init, false);
    }
    const payload = await readBody(response);
    const record = asRecord(payload);
    const failedFlag = record?.succeed === false || record?.success === false;
    if (!response.ok || failedFlag) {
      const parsed = failureMessage(payload, 'Mysoft isteği başarısız.');
      throw new MysoftError(parsed.message, response.ok ? 422 : response.status, parsed.code);
    }
    return payload;
  }

  async call(
    method: 'GET' | 'POST',
    path: string,
    input: { query?: Record<string, string | undefined>; json?: unknown } = {}
  ): Promise<unknown> {
    if (!path.startsWith('/api/')) {
      throw new MysoftError('Geçersiz Mysoft yolu.', 400, 'INVALID_REQUEST');
    }
    return this.request(path, { method, query: input.query, json: input.json });
  }

  async download(
    method: 'GET' | 'POST',
    path: string,
    input: { query?: Record<string, string | undefined>; json?: unknown } = {}
  ): Promise<Buffer> {
    if (!path.startsWith('/api/')) {
      throw new MysoftError('Geçersiz Mysoft yolu.', 400, 'INVALID_REQUEST');
    }
    return this.requestBytes(path, input.query ?? {}, method, input.json);
  }

  private async requestBytes(
    path: string,
    query: Record<string, string | undefined>,
    method: 'GET' | 'POST' = 'GET',
    json?: unknown,
    allowRetry = true
  ): Promise<Buffer> {
    const token = await this.accessToken();
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {
      Accept: '*/*',
      Authorization: `Bearer ${token}`,
    };
    let body: string | undefined;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (response.status === 401 && allowRetry) {
      tokenCache = null;
      await this.accessToken(true);
      return this.requestBytes(path, query, method, json, false);
    }
    if (!response.ok) {
      const payload = await readBody(response);
      const parsed = failureMessage(payload, 'Belge alınamadı.');
      throw new MysoftError(parsed.message, response.status, parsed.code);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const raw = Buffer.from(await response.arrayBuffer());
    if (contentType.includes('json') || raw[0] === 0x7b) {
      const payload = JSON.parse(raw.toString('utf8')) as unknown;
      const record = asRecord(payload);
      if (record?.succeed === false || record?.success === false) {
        const parsed = failureMessage(payload, 'Belge alınamadı.');
        throw new MysoftError(parsed.message, 422, parsed.code);
      }
      const encoded = pickString(record, ['data', 'Data']);
      if (!encoded) throw new MysoftError('Belge verisi boş.', 422, 'MYSOFT_FILE');
      const decoded = Buffer.from(encoded, 'base64');
      if (decoded.subarray(0, 2).toString('utf8') === 'PK') {
        return firstZipFile(decoded) ?? decoded;
      }
      return decoded;
    }
    if (raw.subarray(0, 2).toString('utf8') === 'PK') {
      return firstZipFile(raw) ?? raw;
    }
    return raw;
  }

  async listTenants(): Promise<MysoftTenant[]> {
    const body = await this.request('/api/Tenant/getTenant', {
      query: { limit: '50' },
    });
    return rowsFrom(body).map((row) => ({
      identifier: digitsOnly(
        pickString(row, ['taxNumber', 'vknTckn', 'identifierNumber', 'tenantIdentifierNumber', 'vkn'])
      ),
      title: pickString(row, ['title', 'tenantName', 'companyName', 'name', 'accountName']),
    })).filter((row) => row.identifier || row.title);
  }

  async createInvoice(payload: unknown): Promise<MysoftOutboxResult> {
    const body = await this.request('/api/InvoiceOutbox/invoiceOutbox', {
      method: 'POST',
      json: payload,
    });
    const result = extractOutboxResult(body);
    if (!result.ettn && !result.docNo) {
      throw new MysoftError(result.message || 'Fatura numarası dönmedi.', 422, 'MYSOFT_EMPTY_RESULT');
    }
    return result;
  }

  async listOutgoing(input: {
    tenantIdentifierNumber?: string;
    eDocumentType?: string;
    startDate: string;
    endDate: string;
  }): Promise<MysoftDocumentRow[]> {
    const body = await this.request('/api/InvoiceOutbox/getInvoiceOutboxWithHeaderInfoList', {
      method: 'POST',
      json: {
        startDate: input.startDate,
        endDate: input.endDate,
        limit: 100,
        isUseDocDate: true,
        tenantIdentifierNumber: input.tenantIdentifierNumber,
        eDocumentType: input.eDocumentType,
      },
    });
    return normalizeDocumentRows(body);
  }

  async listIncoming(input: {
    tenantIdentifierNumber?: string;
    startDate: string;
    endDate: string;
  }): Promise<MysoftDocumentRow[]> {
    const body = await this.request('/api/InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriod', {
      method: 'POST',
      json: {
        startDate: input.startDate,
        endDate: input.endDate,
        limit: 100,
        isUseDocDate: true,
        tenantIdentifierNumber: input.tenantIdentifierNumber,
      },
    });
    return normalizeDocumentRows(body);
  }

  async pdf(direction: 'outgoing' | 'incoming', ettn: string, tenantIdentifierNumber?: string): Promise<Buffer> {
    const path =
      direction === 'outgoing'
        ? '/api/InvoiceOutbox/getInvoiceOutboxPdfAsZip'
        : '/api/InvoiceInbox/getInvoiceInboxPdfAsZip';
    const bytes = await this.requestBytes(path, {
      invoiceETTN: ettn,
      tenantIdentifierNumber,
    });
    if (!bytesLookLikePdf(bytes) && bytes.subarray(0, 2).toString('utf8') === 'PK') {
      return firstZipFile(bytes) ?? bytes;
    }
    return bytes;
  }

  async checkRecipient(vknTckn: string, tenantIdentifierNumber?: string): Promise<MysoftRecipient> {
    const [taxpayerResult, gibResult] = await Promise.allSettled([
      this.request('/api/Taxpayer/getTaxPayerDetailInfo', {
        query: { identifierNumber: vknTckn, tenantIdentifierNumber },
      }),
      this.request('/api/GeneralCard/getGibAccountModel', {
        query: { vknTckn, tenantIdentifierNumber },
      }),
    ]);
    if (taxpayerResult.status === 'rejected' && gibResult.status === 'rejected') {
      throw taxpayerResult.reason;
    }
    const taxpayerBody = taxpayerResult.status === 'fulfilled' ? taxpayerResult.value : null;
    const gibBody = gibResult.status === 'fulfilled' ? gibResult.value : null;
    const taxpayer = asRecord(unwrapData(taxpayerBody)) ?? asRecord(taxpayerBody);
    const gib = asRecord(unwrapData(gibBody)) ?? asRecord(gibBody);
    const addressRow = Array.isArray(taxpayer?.taxpayerAddressList)
      ? asRecord(taxpayer.taxpayerAddressList[0])
      : null;
    const aliases = Array.isArray(gib?.gibAccountAliasList) ? gib.gibAccountAliasList : [];
    const pk = aliases.map(asRecord).find((alias) => {
      const type = pickString(alias, ['aliasType', 'gibAliasType', 'type']).toUpperCase();
      return type.includes('PK') || type === '';
    });
    const gb = aliases.map(asRecord).find((alias) => {
      const type = pickString(alias, ['aliasType', 'gibAliasType', 'type']).toUpperCase();
      return type.includes('GB');
    });
    const pkAlias = pickString(pk ?? null, ['alias', 'pkAlias', 'gibAlias']);
    const gbAlias = pickString(gb ?? null, ['alias', 'gbAlias', 'gibAlias']);
    const activity = pickString(taxpayer, ['activityTerminationStatus']);
    const title =
      pickString(taxpayer, ['identityTitle', 'tradeName', 'title', 'name']) ||
      pickString(gib, ['title', 'accountName']);
    const city = pickString(addressRow, ['cityName', 'city']) || pickString(taxpayer, ['cityName', 'city']);
    const district =
      pickString(addressRow, ['citySubdivision', 'district', 'town', 'districtName']) ||
      pickString(taxpayer, ['district', 'citySubdivision']);
    const neighborhood =
      pickString(addressRow, ['subdivision', 'neighborhood', 'neighborhoodName', 'mahalle']) ||
      pickString(taxpayer, ['subdivision', 'neighborhood', 'neighborhoodName', 'mahalle']);
    const street =
      pickString(addressRow, ['streetName', 'street', 'cadde', 'sokak']) ||
      pickString(taxpayer, ['streetName', 'street', 'cadde', 'sokak']);
    const buildingNumber = pickString(addressRow, ['buildingNumber', 'buildingNo', 'binaNo']);
    const doorNumber = pickString(addressRow, ['doorNumber', 'doorNo', 'kapiNo']);
    const postalCode =
      pickString(addressRow, ['postalZone', 'postCode', 'postalCode']) ||
      pickString(taxpayer, ['postalZone', 'postCode', 'postalCode']);

    const streetWithNo = [
      street,
      buildingNumber ? `No: ${buildingNumber}` : '',
      doorNumber ? `D: ${doorNumber}` : '',
    ].filter(Boolean).join(' ') || street;

    const rawAddress = pickString(addressRow, ['fullAddress', 'address', 'addressLine']) ||
      pickString(taxpayer, ['fullAddress', 'address']);

    const fullAddress = rawAddress || [neighborhood, streetWithNo, district, city].filter(Boolean).join(' ');

    return {
      vknTckn,
      title,
      taxOffice: pickString(taxpayer, ['taxOfficeName', 'taxOffice']),
      city,
      district,
      neighborhood: neighborhood || undefined,
      street: streetWithNo || undefined,
      postalCode: postalCode || undefined,
      address: fullAddress,
      registered: aliases.length > 0 || activity === '1',
      pkAlias,
      gbAlias,
    };
  }
}
