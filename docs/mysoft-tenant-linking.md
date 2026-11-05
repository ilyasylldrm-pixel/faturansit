# Mysoft iş ortağı ile e-belge müşterisi

Muavin mali müşavir ürünü değildir. Mysoft (İlyas Bey / e-posta): **firma
zaten Mysoft’ta e-belge kullanıyorsa mali müşavir paneline gerek yoktur.**
Mükellef kaydı SMMM yetkisi ister; bu projede o ekran kullanılmaz.

İş ortağı hesabı e-belge **müşterilerini** çeker. Swagger alan adı
`tenantIdentifierNumber` olsa da açıklama **müşterinin VKN/TCKN** der;
mali müşavir mükellef id’si veya portal tenant id/GUID değildir.

## Belge erişim anahtarıyla mı çekilir?

Evet. Güncel resmi sözleşme
[`swagger/v8/swagger.json`](https://edocumentapi.mysoft.com.tr/swagger/v8/swagger.json)
token’ı şöyle tanımlar:

- `POST /oauth/token`
- `grant_type=client_credentials`
- `client_id` / `client_secret` = Portal **Erişim Anahtarı**
- token **5 dakika** (`expires_in: 300`)
- sonraki çağrılarda `Authorization: Bearer …`

Örnek fatura gönderimi de aynı token ile yapılır;
`tenantIdentifierNumber` tek müşteride `null` bırakılır.

2022 Postman koleksiyonu hâlâ `grant_type=password` + portal kullanıcı
adı/şifre gösterir (token 24 saat). Bu eski yol; v8 Swagger onu
kullanmaz. Muavin her iki grant’ı da destekler ama varsayılan güncel
akıştır: erişim anahtarı.

`GET /api/Tenant/getTenant` açıklaması: **“İş ortağına tanımlı olan
firmaların listesini döner.”** Liste boş / `00164` ise yöntem değil
kapsam yanlıştır: token alınmıştır, iş ortağına tanımlı firma bu
anahtara düşmemiştir.

Mysoft destek maili genelde iki şey gönderir: canlı Swagger UI
(`https://edocumentapi.mysoft.com.tr/index.html`) ve test portalındaki
anahtar ekranı (`https://eportal.mytest.tr/#!/app/ApplicationAccess`).
Bu, “şu Client Id ile belge çekilir” demek değildir; nasıl anahtar
üreteceğini anlatır. Canlı anahtar canlı API’de token alır, aynı
anahtar test API’de (`edocumentapi.mytest.tr`) **Authentication Error**
döner. Token 200 + `TenantId: 0` + `00164` = anahtar geçerli, firma
kapsamı boş.

Canlı karşılık:
`https://portal.mysoft.com.tr/#/app/ApplicationAccess` (firma seçiliyken)
veya iş ortağı
[Erişim Anahtarı](https://portal.mysoft.com.tr/#/app/BusinessPartnerApplicationAccess).

## İsimler

| Mysoft’un dediği | Anlamı |
| --- | --- |
| İş ortağı (`BusinessPartnerId`) | API anahtarının sahibi (Muavin / Tallsoft) |
| Erişim anahtarı (`ApplicationAccessId`) | `client_id` / `client_secret` |
| M��şteri VKN (`tenantIdentifierNumber`) | E-belge kullanan firma |
| Mükellef / Mali Müşavir paneli | SMMM akışı — **kullanılmaz** |

Canlı token: iş ortağı `997`, erişim anahtarı `64`, varsayılan tenant
`TenantId: 1` (iş ortağı hesabı). `getTenant` müşteri satırı döner (sayfa
başına en fazla 50). Belge çağrılarında müşteri **VKN/TCKN** zorunlu
(`00243` aksi halde).

## `tenantIdentifierNumber`

`GetInvoiceInboxListForPeriodRequestModel`:

> İşlem yapılması istenen müşterinin VKN/TCKN si gönderilir. Eğer servis
> kullanıcısına birden fazla müşteri bağlandıysa kullanılacak bir alandır.
> Bir müşteri varsa boş bırakınız.

- Tek müşteri bağlıysa alan **gönderilmez**.
- Birden fazla müşteri varsa **VKN/TCKN** gönderilir.
- Portal int `id` veya Via/GUID gönderilmez.

## 00164 / 00243

`00164` = verilen VKN bu anahtarın müşteri listesinde yok.

`00243` = iş ortağı anahtarında belge çağrısına müşteri VKN/TCKN
gönderilmedi. Muavin’de listeden müşteri seçmek zorunlu.

`getTenant` limiti en fazla **50**; sonraki sayfa `afterValue` ile gelir.

## Portal: müşteriyi anahtara nasıl ekleriz?

Muavin’den VKN yapıştırarak liste oluşmaz. Public API’de “şu firmayı şu
anahtara tak” yok. Liste, anahtarın **hangi firma bağlamında üretildiği**
ile oluşur.

Pazaryeri entegrasyonlarının da yazdığı yol (Excel’de `clientId,clientSecret`):

1. Canlı portala girin: [portal.mysoft.com.tr](https://portal.mysoft.com.tr/)
   (`eportal.mytest.tr` değil).
2. Üstteki firma seçicide **belgelerini çekeceğiniz müşteri** olsun.
   İş ortağı ana hesabı seçiliyken üretilen anahtarda `TenantId: 0` kalır.
3. Sol menü **Firma Bilgileri → Entegrasyon**, veya doğrudan
   [ApplicationAccess](https://portal.mysoft.com.tr/#/app/ApplicationAccess).
   Maildeki test linkinin canlı karşılığı budur.
4. **Yeni Erişim Anahtarı Oluştur** → uygulama adı (ör. Muavin) →
   Mysoft uygulaması **Mysoft API** (Via / Auth değil).
5. İndirilen Excel’deki Client Id / Secret’i sunucu `.env` dosyasına yazın,
   `npm run dev` yeniden başlatın.

Bu anahtar o firmanın anahtarıdır; token’da `TenantId` 0 olmamalı.
Muavin tek müşteride `tenantIdentifierNumber` göndermez.

Tüm iş ortağı müşterilerini **tek** anahtarla çekmek istiyorsanız bu
firma-içi anahtar yetmez. O zaman mevcut iş ortağı anahtarına (ör. 64)
Mysoft’un müşteri tanımlaması gerekir; panelde görünen liste otomatik
düşmez. [Firma Açma Talepleri](https://portal.mysoft.com.tr/#/app/BusinessPartnerTenantRequest)
yalnızca Mysoft’ta henüz hesabı olmayan yeni müşteri içindir; zaten
panelde duran firmayı tekrar açmayın.

[Mali Müşavir > Mükellefler](https://portal.mysoft.com.tr/#/app/AccountantPersonTenant)
ve `Tenant/addTenant` kullanılmaz (`addTenant` yeni firma kaydıdır).

## Doğrulama

Kimlik bilgileri yalnızca sunucuda tutulmalıdır. Token alındıktan sonra
`GET /api/Tenant/getTenant` veya iş ortağı kontör listesi müşteri satırı
dönmelidir. `data: null` + `00164` ise kapsam hâlâ boştur.

Mysoft destek: `destek@mysoft.com.tr`, `+90 850 600 06 61`. Talepte client
secret paylaşmayın; `ApplicationAccessId`, `BusinessPartnerId` ve müşteri
VKN yeterlidir. “Mükellef ekleyin” demeyin; **iş ortağı erişim anahtarına
e-belge müşterisi tanımlayın** deyin.
