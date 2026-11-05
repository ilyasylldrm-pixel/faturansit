# Mysoft e-belge entegrasyonu

Mysoft credentials are used only by the Express server. Do not put them in a
`VITE_*` variable or in frontend source.

Official v8 Swagger (`https://edocumentapi.mysoft.com.tr/swagger/v8/swagger.json`)
authenticates with Portal **Erişim Anahtarı**: `POST /oauth/token` using
`grant_type=client_credentials`, `client_id`, `client_secret`. The token lasts
five minutes. Inbox/outbox calls then send `Authorization: Bearer …`. The older
Postman sample used a portal username/password (`grant_type=password`); that is
not the current documented path.

Copy the Mysoft values from Portal's **Erişim Anahtarı** screen into the server
environment:

```env
MYSOFT_ENV=prod
MYSOFT_GRANT_TYPE=client_credentials # optional: client_credentials or password
MYSOFT_CLIENT_ID=...
MYSOFT_CLIENT_SECRET=...
# Optional proxy authentication. Production defaults to true; set false only
# for a local/demo server where Firebase ID tokens are not available.
# MYSOFT_REQUIRE_AUTH=true
# Optional default firm VKN/TCKN used when a request omits tenantIdentifierNumber:
# MYSOFT_TENANT_IDENTIFIER_NUMBER=...
# MYSOFT_CONNECTOR_GUID is obsolete — Mysoft (Uğur Yılmaz, 2026-08-25): leave
# connectorGuid empty; the field will be removed. Do not set this.
# For a password grant instead (client id/secret are optional for public clients):
# MYSOFT_GRANT_TYPE=password
# MYSOFT_USERNAME=...
# MYSOFT_PASSWORD=...
```

For the test tenant, use `MYSOFT_ENV=test`; this selects
`https://edocumentapi.mytest.tr`. Production selects
`https://edocumentapi.mysoft.com.tr`. `MYSOFT_API_BASE_URL` and
`MYSOFT_TOKEN_URL` can override either value for a private gateway.

The client obtains an OAuth2 token from `/oauth/token` and caches it until 30
seconds before its (documented) five-minute expiry. It uses
`client_credentials` when client id/secret are available, or the `password`
grant when username/password are supplied. Set `MYSOFT_GRANT_TYPE` to choose
explicitly. Token failures and remote HTTP errors are normalized without
forwarding the upstream body, which prevents accidental leakage of credentials
or sensitive invoice data. Every upstream request has a bounded timeout via
`MYSOFT_TIMEOUT_MS` (default 30 seconds).

The company screen also supports a direct VKN/TCKN lookup. Enter the number in
the **VKN ile getir** field; the proxy calls
`Tenant/getTenantWithIdentifier?identifierNumber=...` and selects the returned
company immediately. This is a read operation and works only for firms already
visible to the OAuth business-partner/access-key scope.

If the token request succeeds but a customer lookup reports Mysoft error `00164`
(`"tenantIdentifierNumber ile firma kaydı bulunamadı"`), the access key is
valid but no e-belge **müşteri** is bound to that business-partner key. This
app is not an accountant product; do not use Mali Müşavir > Mükellefler.
If the firm already uses Mysoft e-belge, Mysoft must attach it to this
Application Access as a customer (partner activation), not as an SMMM mükellef.

### Genel VKN / TCKN Mükellef Sorgulama (Taxpayer & GİB Account)

İş ortağına bağlı olmayan üçüncü taraf müşterilerin (alıcıların) resmi unvan,
vergi dairesi, faal/terk durumu, açık adres ve e-Fatura mükellefiyet bilgilerini
sorgulamak için canlı Mysoft v8 API'sinde iki servis birlikte kullanılır:

1. `GET /api/Taxpayer/getTaxPayerDetailInfo?identifierNumber={vkn}&tenantIdentifierNumber={tenant}`:
   Türkiye geneli mükellef resmi unvanı (`identityTitle`), ticaret unvanı
   (`tradeName`), şahıs adı/soyadı, vergi dairesi adı ve kodu, faal/terk durumu
   (`activityTerminationStatus`: 1=Faal, 2=Terk), NACE kodları ve ayrıştırılmış
   adres detayları (`taxpayerAddressList`: il, ilçe, mahalle, cadde, kapı no).
2. `GET /api/GeneralCard/getGibAccountModel?vknTckn={vkn}`:
   GİB e-Fatura / e-İrsaliye kayıtlı posta kutusu bilgisi, sisteme kayıt
   tarihi ve resmi posta kutusu etiketleri (`gibAccountAliasList` -> `pkAlias`, `gbAlias`).

Proxy tarafında `GET /api/mysoft/check-recipient/:vknTckn` çağrısı bu iki servisi
paralel çalıştırarak birleştirir; Fatura Kesme (`Invoices.tsx`), Cari Hesaplar
(`Contacts.tsx`) ve Şirket Yönetimi (`CompanyManagement.tsx`) ekranlarında
tek tıkla resmi verilerin otomatik doldurulmasını sağlar.

### Mysoft Via uygulama kaydı

Portal > **Uygulamalar** (`#/app/TenantApplication`) ekranında **Mysoft Via**
seçilir. **URL EKLE** alanına uygulamanın dışarıdan erişilebilen public HTTPS
adresini (uygulamanın kök adresini) girin; `edocumentapi.mysoft.com.tr` API adresi
ve `localhost` burada kullanılmamalıdır. Bu kayıt ClientId/ClientSecret üretir;
alanlar portalda salt okunur görünür. Erişim anahtarı ve mükellef kapsamı bu
URL kaydından ayrıdır; her mükellef için hesabınıza bağlılık ve ilgili erişim
anahtarına yetki tanımı ayrıca kontrol edilmelidir.

## Giden e-fatura kesme (şablon + süreç)

Mysoft’ta “şablon” iki ayrı şeydir; İlyas’ın kastettiği API tarafı
`InvoiceOutboxModel` JSON’udur. Görünüm (PDF/HTML) ise portal **XSLT / dizayn**.

### Süreç

1. OAuth: `POST /oauth/token` (`client_credentials`, Erişim Anahtarı).
2. Müşteri VKN: `tenantIdentifierNumber` (iş ortağına bağlı e-belge müşterisi).
3. Gövde: `GET /api/InvoiceOutbox/createInvoiceOutboxTestJson` → resmi örnek JSON
   (repo: `docs/mysoft/invoice-outbox-sablon.json`, üretim için sadeleştirilmiş).
4. Gönderim: `POST /api/InvoiceOutbox/invoiceOutbox` → GİB’e gider
   (`isSaveAsDraft: true` ise sadece Mysoft taslağı).
5. Alternatif: `invoiceOutboxWithUblXml` (UBL zip base64) veya portal taslak
   (`Invoice/invoiceDraft…`) sonra imza/SMS.
6. Sonuç: `invoiceETTN` + `docNo` (boş `docNo` + `prefix` / `numeratorSetCode`
   → Mysoft 16 haneli numara).

### Zorunlu / kritik alanlar

| Alan | Anlam |
| --- | --- |
| `eDocumentType` | `EFATURA` / `EARSIVFATURA` |
| `profile` | `TEMELFATURA` / `TICARIFATURA` / `EARSIVFATURA` … (alıcı mükellef ise e-arşiv dışı) |
| `invoiceType` | Normal satış: `SATIS` |
| `invoiceAccount` | Alıcı VKN, unvan, vergi dairesi, adres |
| `invoiceDetail[]` | `productCode`, `productName`, `unitCode`, `qty`, `unitPriceTra`, `amtTra`, `vatRate` … |
| `tenantIdentifierNumber` | Faturayı kesen müşteri VKN |
| `xsltName` / `xsltSetCode` | Görsel şablon — boşsa sunucu portal varsayılanını (`getTenantXslt`) doldurur |
| `numeratorSetCode` / `prefix` / `docNo` | Numara — set kodu çoğu firmada boş; `getDocumentNumberList` prefix kullanır |
| `connectorGuid` | **Kullanma.** Mysoft: boş gönderin; alan ileride kaldırılacak (2026-08-25) |
| `isCalculateByApi` | `true` → tutarları API hesaplar (Swagger: geliştirme aşamasında) |

Muavin gelir faturası formu bu modeli `src/services/mysoftInvoicePayload.ts`
ile üretir. Gönderimde (`POST /outgoing`) boş `xsltName` / `prefix` müşteri
VKN’sine göre Mysoft portalından otomatik doldurulur.

**Önizleme (UI):** Gelir faturası kes formunda sağ panel:
- **Canlı** — form verisiyle anlık fatura kağıdı
- **Mysoft** — `POST /outgoing/draft-preview?format=html|pdf` ile portal
  dizaynında resmi taslak (GİB’e gitmez)

`GET /api/mysoft/tenants/{vkn}/invoice-design?eDocumentType=EFATURA`

Canlı örnekler:

| VKN | e-Fatura XSLT | prefix | e-Arşiv XSLT | prefix |
| --- | --- | --- | --- | --- |
| 37756832708 | `EFA2` | `ABD` | `EAR1` | `KON` |
| 13819008730 | `efa1` | `KUT` | `ear` | `DEM` |
| 36895866360 | `Standart E-Fatura Şablonu` | `ADM` | — | `CLK` |

Bu firmalarda `numeratorSetCode` / `xsltSetCode` portalda tanımlı değil.

## Proxy routes

All paths are under `/api/mysoft`:

| Route | Mysoft operation | Purpose |
| --- | --- | --- |
| `GET /status` | — | Redacted server configuration status |
| `GET /tenants` | `Tenant/getTenant` | List all taxpayer firms linked to the accountant access key |
| `GET /tenants/:identifierNumber` | `Tenant/getTenantWithIdentifier` | Find one linked firm by VKN/TCKN |
| `GET /tenants/:identifierNumber/info` | `Tenant/getTenantInfo` | Read one firm's detailed address/contact data |
| `POST /incoming/list` | `InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriod` | Incoming invoices by date |
| `POST /incoming/new` | `InvoiceInbox/getNewInvoiceInboxWithHeaderInfoList` | Newly arrived incoming invoices |
| `POST /outgoing/list` | `InvoiceOutbox/getInvoiceOutboxWithHeaderInfoList` | Outgoing invoices by date |
| `POST /outgoing` | `InvoiceOutbox/invoiceOutbox` | Submit an outgoing invoice model |
| `POST /outgoing/ubl` | `InvoiceOutbox/invoiceOutboxWithUblXml` | Submit a zipped/base64 UBL XML payload |
| `GET /incoming/:invoiceETTN/model` | `InvoiceInbox/getInvoiceInboxModel` | Incoming invoice details |
| `GET /outgoing/:invoiceETTN/model` | `InvoiceOutbox/getInvoiceOutboxModel` | Outgoing invoice details |
| `GET /incoming/:invoiceETTN/status` | `InvoiceInbox/getInvoiceInboxStatus` | Incoming status |
| `GET /outgoing/:invoiceETTN/status` | `InvoiceOutbox/getInvoiceOutboxStatus` | Outgoing status |
| `GET /incoming/:invoiceETTN/pdf` | `InvoiceInbox/getInvoiceInboxPdfAsZip` | Incoming PDF (Mysoft result model) |
| `GET /outgoing/:invoiceETTN/pdf` | `InvoiceOutbox/getInvoiceOutboxPdfAsZip` | Outgoing PDF (Mysoft result model) |
| `GET /incoming/:invoiceETTN/xml` | `InvoiceInbox/getInvoiceInboxUBLXMLAsZip` | Incoming XML |
| `GET /outgoing/:invoiceETTN/xml` | `InvoiceOutbox/getInvoiceOutboxXMLAsZip` | Outgoing XML |
| `POST /incoming/:invoiceETTN/acknowledge` | `InvoiceInbox/invoiceInboxSavedByCustomer` | Mark incoming invoice as received |
| `GET /check-recipient/:vknTckn` | `Taxpayer/getTaxPayerDetailInfo` + `GeneralCard/getGibAccountModel` | Consolidated taxpayer lookup (title, address, tax office, e-Invoice status, PK aliases) |
| `GET /taxpayer/:identifierNumber` | `Taxpayer/getTaxPayerDetailInfo` | Detailed legal company/individual taxpayer profile, status, and parsed address |
| `GET /gib-account/:vknTckn` | `GeneralCard/getGibAccountModel` | Registered GİB mailbox account, e-Invoice start date, and mailbox alias list (PK/GB) |

The browser-facing compatibility routes are under `/api/mysoft/e-documents`:

| Route | Purpose |
| --- | --- |
| `GET /e-documents?direction=incoming\|outgoing` | List inbox or outbox records |
| `GET /e-documents/:invoiceETTN` | Fetch an invoice model (pass `direction=outgoing` for outbox) |
| `GET /e-documents/:invoiceETTN/download?format=pdf\|xml` | Stream PDF/XML bytes |
| `POST /e-documents/:invoiceETTN/accept` | Accept an incoming invoice |
| `POST /e-documents/:invoiceETTN/deny` | Reject with `{ "rejectReason": "..." }` |
| `POST /e-documents/:invoiceETTN/cancel` | Cancel with optional date/type/note body fields |
| `POST /e-documents/:invoiceETTN/send-draft` | Send draft with ETTN/prefix/numerator set/connector GUID |

List request bodies accept the documented `afterValue`, `limit`, date range,
`tenantIdentifierNumber`, ETTN, VKN/TCKN and e-document type filters. A
`tenantIdentifierNumber` may also be passed as a query parameter on detail and
download routes. If `MYSOFT_TENANT_IDENTIFIER_NUMBER` is configured on the
server, it is applied to requests that omit a tenant; an explicit request value
always takes precedence. The redacted `/status` response exposes only whether
a default tenant is present, never its value.

### Generic v8 document operations

The complete, allowlisted non-portal v8 surface is available for integrations
that need a document family other than the invoice compatibility routes:

```http
POST /api/mysoft/operations/despatch.incoming.list
Content-Type: application/json

{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "afterValue": 0,
  "limit": 100,
  "tenantIdentifierNumber": "..."
}
```

The operation name is a static allowlist key (it is never appended to an
upstream URL), so arbitrary paths cannot turn the proxy into an SSRF relay.
The current keys cover invoice inbox/outbox and draft/GIB lifecycle, separate
e-Arşiv inbox, e-İrsaliye (`despatch`), e-SMM/makbuz (`receipt`), gider
pusulası (`expensevoucher`), müstahsil makbuzu (`billdocument`), e-banka
dekontu (`bankreceipt`) and e-döviz (`foreignexchange`) operations. Each family
has the list/status/create/download operations published by the live v8
Swagger; incoming families expose only operations that Mysoft currently
publishes (for example, ExpenseVoucher and BillDocument are outgoing-only).

The allowlist is checked against the production v8 document at
`https://edocumentapi.mysoft.com.tr/swagger/v8/swagger.json` (the test document
is available at `https://edocumentapi.mytest.tr/swagger/v8/swagger.json`).

For a GET operation, pass Mysoft's documented parameters as query values:

```http
GET /api/mysoft/operations/despatch.incoming.xml?despatchETTN=...&tenantIdentifierNumber=...
```

`tenantIdentifierNumber` may be supplied in either the query or JSON body and
is applied server-side when omitted. PDF/XML/HTML and envelope/batch download
keys preserve Mysoft's ZIP bytes; all other operations return the upstream JSON
result. Vendor-specific Tepe Bilisim/Netle Belge routes and `*TestJson`
fixtures are intentionally not exposed by the generic surface.

### Incoming paging

The regular inbox period endpoint is cursor-based (`afterValue`) and is kept
for tenants that expose only the legacy contract. For larger date ranges use
the numbered paging endpoint:

```http
GET /api/mysoft/e-documents?direction=incoming&paging=true&pageSize=100&pageNumber=1&startDate=2026-01-01&endDate=2026-01-31
```

The same operation is available as a server-to-server friendly POST:

```http
POST /api/mysoft/incoming/paging
Content-Type: application/json

{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "pageSize": 100,
  "pageNumber": 1,
  "tenantIdentifierNumber": "..."
}
```

`pageSize` is clamped to a safe maximum of 1,000 and `pageNumber` starts at
1. Mysoft returns the records in `data` together with `totalCount` when that
field is available. Increment `pageNumber` until the accumulated records
reach `totalCount`; if `totalCount` is omitted, an empty or short page marks
the end. The browser service's `syncMysoftEDocuments` helper performs this
loop automatically when `pageSize` or `pageNumber` is supplied.

### PDF/XML response shape

Mysoft's PDF and XML operations are named `...AsZip` and commonly return a
`StringResultModel` whose `data` field is a base64-encoded ZIP, even when the
HTTP content type is `text/plain` or JSON. The proxy forwards a raw binary
response as bytes when available. The browser service detects both forms,
decodes base64 (including `data:*;base64,...` values), creates a `Blob`, and
uses `application/zip` plus a `.zip` filename when the ZIP signature is
detected. URL responses are preserved as `url`; plain non-base64 text is kept
as `data` for diagnostics.

When `MYSOFT_MOCK_MODE=true`, all operations return deterministic empty/success
models and no network request is made. With mock mode disabled and credentials
missing, operations return HTTP 503 (`MYSOFT_NOT_CONFIGURED`) instead of
silently pretending that a document was sent.
