# Mysoft e-Belge API — kullandığımız çağrılar

Tallsoft Muavin, iş ortağı hesabımızdaki e-belge müşterilerinin gelen ve
giden faturalarını çekmek istiyor. Aşağıdaki adımlar canlı v8 Swagger’a
göre yazıldı. Client secret bu notta yoktur.

## Kaynak

- Swagger UI: https://edocumentapi.mysoft.com.tr/index.html
- OpenAPI: https://edocumentapi.mysoft.com.tr/swagger/v8/swagger.json
- Ortam: canlı (`edocumentapi.mysoft.com.tr`)
- Test API (`edocumentapi.mytest.tr`) aynı Client Id ile token vermiyor
  (Authentication Error). Anahtar canlıdadır.

Swagger’daki token örneği ile aynı grant kullanıyoruz:

- `POST /oauth/token`
- `Content-Type: application/x-www-form-urlencoded`
- `grant_type=client_credentials`
- `client_id` / `client_secret` = Portal → Erişim Anahtarı
- sonraki istekler: `Authorization: Bearer {access_token}`

## Token sonucu (secret yok)

Token HTTP 200, `expires_in: 300` (Swagger’daki 5 dakika).

JWT `iuser` özeti:

- `BusinessPartnerId`: 997
- `ApplicationAccessId`: 64
- `TenantId`: 0

Client Id (prefix): `f71bde1f-…`  
İş ortağı panelinde aktif firma sayısı: 74

## Firma listesi

Swagger: `GET /api/Tenant/getTenant`  
Açıklama: “İş ortağına tanımlı olan firmaların listesini döner”

Gözlenen yanıt:

```json
{
  "succeed": false,
  "errorCode": "00164",
  "message": "Verilen tenantIdentifierNumber ile firma kaydı bulunamadı.",
  "data": null,
  "afterValue": 0
}
```

Aynı 00164 ayrıca:

- `GET /api/Tenant/getTenantWithIdentifier`
- `GET /api/GeneralCard/getUserCompanyInfo`
- `POST /api/Tenant/getBusinessPartnerDocumentCreditList`

`tenantIdentifierNumber` göndermeden ve göndererek denendi. Portal
int id / GUID gönderilmedi; Swagger alanının VKN/TCKN olduğu okundu.

## Belge çekmek için kullanacağımız metodlar

Token sonrası, Swagger’daki gelen/giden fatura listeleri:

- `POST /api/InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriod`
- `POST /api/InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriodPaging`
- `POST /api/InvoiceOutbox/getInvoiceOutboxWithHeaderInfoList`

`tenantIdentifierNumber`: Swagger’a göre müşterinin VKN/TCKN’si.
Birden fazla müşteri bağlıysa doldurulur; tek müşteri varsa boş
bırakılır. Firma listesi dönmediği için bu adımda belge çekilemiyor.

## Rica

İş ortağı panelinde 74 aktif firma görünüyor. Aynı hesabın Erişim
Anahtarı (ApplicationAccessId 64) ile `getTenant` bu listeyi
dönmeli. Müşteri başına ayrı anahtar üretmek istemiyoruz.

Lütfen bu erişim anahtarına iş ortağı müşterilerinin tanımlanmasını
veya token’da `TenantId` oluşacak doğru anahtar/ekranı bildirmenizi
rica ederiz.
