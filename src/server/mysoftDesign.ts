import { MysoftClient } from './mysoft.ts';

export interface MysoftDesignRow {
  xsltName: string;
  isDefault: boolean;
  isApproved: boolean;
}

export interface MysoftPrefixRow {
  prefix: string;
  isDefault: boolean;
  isPassive: boolean;
  isInternetSales: boolean;
  edocumentType: string;
}

export interface MysoftInvoiceDesign {
  vknTckn: string;
  eDocumentType: 'EFATURA' | 'EARSIVFATURA';
  edocumentTypeCode: number;
  xsltName?: string;
  prefix?: string;
  numeratorSetCode?: string;
  designs: MysoftDesignRow[];
  prefixes: MysoftPrefixRow[];
}

const GENERIC_PREFIXES = new Set(['EFT', 'EAR', 'GIB', 'FYS', 'FAT']);

function rows(body: unknown): Record<string, unknown>[] {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const data = record && 'data' in record ? record.data : body;
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ['items', 'list', 'dataList', 'result']
          .map((key) => (data as Record<string, unknown>)[key])
          .find(Array.isArray)
      : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function flag(row: Record<string, unknown>, key: string): boolean {
  return row[key] === true;
}

export async function resolveInvoiceDesign(
  client: MysoftClient,
  vknTckn: string,
  eDocumentType: string,
  isInternetSales = false
): Promise<MysoftInvoiceDesign> {
  const earsiv = eDocumentType.toUpperCase().includes('ARSIV');
  const edocumentTypeCode = earsiv ? 2 : 1;
  const [xsltResult, numberResult, setResult] = await Promise.allSettled([
    client.call('POST', '/api/Tenant/getTenantXslt', {
      json: {
        vknTckn,
        edocumentType: edocumentTypeCode,
        ...(isInternetSales ? { isInternetSales: true } : {}),
      },
    }),
    client.call('GET', '/api/Tenant/getDocumentNumberList', { query: { vknTckn } }),
    client.call('GET', '/api/Tenant/getNumaratorSetList', { query: { vknTckn } }),
  ]);
  if (xsltResult.status === 'rejected' && numberResult.status === 'rejected' && setResult.status === 'rejected') {
    throw xsltResult.reason;
  }

  const designs = (xsltResult.status === 'fulfilled' ? rows(xsltResult.value) : [])
    .map((row) => ({
      xsltName: text(row, 'xsltName'),
      isDefault: flag(row, 'isDefault'),
      isApproved: row.isApproved !== false,
    }))
    .filter((row) => row.xsltName);
  const prefixes = (numberResult.status === 'fulfilled' ? rows(numberResult.value) : [])
    .map((row) => ({
      prefix: text(row, 'prefix').toUpperCase(),
      isDefault: flag(row, 'isDefault'),
      isPassive: flag(row, 'isPassive'),
      isInternetSales: flag(row, 'isInternetSales'),
      edocumentType: String(row.edocumentType ?? ''),
    }))
    .filter((row) => row.prefix);
  const sets = setResult.status === 'fulfilled' ? rows(setResult.value) : [];

  const chosenDesign =
    designs.find((row) => row.isDefault && row.isApproved) ||
    designs.find((row) => row.isDefault) ||
    designs.find((row) => row.isApproved) ||
    designs[0];
  const matchingPrefixes = prefixes.filter((row) => {
    if (row.edocumentType && row.edocumentType !== String(edocumentTypeCode)) return false;
    if (isInternetSales) return row.isInternetSales;
    return !row.isInternetSales;
  });
  const chosenPrefix =
    matchingPrefixes.find((row) => row.isDefault && !row.isPassive) ||
    matchingPrefixes.find((row) => !row.isPassive) ||
    matchingPrefixes[0];
  const chosenSet = sets.find((row) => text(row, 'numeratorSetCode')) || sets[0];

  return {
    vknTckn,
    eDocumentType: earsiv ? 'EARSIVFATURA' : 'EFATURA',
    edocumentTypeCode,
    xsltName: chosenDesign?.xsltName,
    prefix: chosenPrefix?.prefix,
    numeratorSetCode: chosenSet ? text(chosenSet, 'numeratorSetCode') || undefined : undefined,
    designs,
    prefixes: matchingPrefixes,
  };
}

export function applyInvoiceDesign(
  payload: Record<string, unknown>,
  design: MysoftInvoiceDesign | null
): Record<string, unknown> {
  if (!design) return payload;
  const next = { ...payload };
  if (!String(next.xsltName || '').trim() && design.xsltName) {
    next.xsltName = design.xsltName;
    next.isSendWithGeneralXsltIfDefaultNotExists = true;
  }
  const prefix = String(next.prefix || '').trim().toUpperCase();
  const portalPrefixes = design.prefixes.map((row) => row.prefix);
  const prefixIsGeneric = !prefix || GENERIC_PREFIXES.has(prefix) || (portalPrefixes.length > 0 && !portalPrefixes.includes(prefix));
  if (design.prefix && prefixIsGeneric) next.prefix = design.prefix;
  if (!String(next.prefix || '').trim() && design.numeratorSetCode) {
    next.numeratorSetCode = design.numeratorSetCode;
  }
  return next;
}
