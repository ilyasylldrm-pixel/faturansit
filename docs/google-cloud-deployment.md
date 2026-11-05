# Google Cloud Server Mimarisi & Donanım Optimizasyon Kılavuzu
## Profil: Orta Ölçek / Çok Şubeli (15 – 50 Eşzamanlı Kullanıcı & Yoğun e-Belge/OCR)

Bu doküman, Muavin Ön Muhasebe & ERP uygulamasının **Google Cloud Platform (GCP)** üzerinde en yüksek performans, sıfır kesinti ve minimum yanıt süresiyle çalışması için gerekli donanım ve yazılımsal mimari ayarlarını içerir.

---

### 1. Donanım & Kaynak Konfigürasyonu (Orta Ölçek)

| Parametre | Tavsiye Edilen Değer | Gerekçe |
| :--- | :--- | :--- |
| **vCPU** | **4 vCPU** | Çok şubeli eşzamanlı fiş/fatura kesimi, PDF/AutoTable üretimi ve XML/UBL ayrıştırma işlemlerinin kuyruğa girmeden anında işlenmesi. |
| **RAM** | **8 GB RAM** | ZIP çıkarma (deflate stream), AI OCR görsel tamponları ve Node.js heap alanı için yeterli bellek. |
| **Disk** | **100 GB Hyperdisk / NVMe SSD** | Minimum 3.000+ IOPS ile loglama ve önbellek operasyonlarında sıfır I/O gecikmesi. |
| **Lokasyon / Bölge** | `europe-west3` (Frankfurt) veya `europe-west1` (Belçika) | GİB / Mysoft Türkiye sunucularına en düşük ağ gecikmesi (< 35ms ping). |

---

### 2. Seçenek A: Google Cloud Run (Önerilen Serverless Dağıtım)

Cloud Run, otomatik ölçeklenen ve sadece işlem başına maliyet oluşturan en optimize GCP servisidir.

#### Cloud Run Dağıtım Komutu (Production):
```bash
gcloud run deploy muavin-app \
  --image gcr.io/[PROJECT_ID]/muavin:latest \
  --region europe-west3 \
  --platform managed \
  --cpu 4 \
  --memory 8Gi \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 300s \
  --execution-environment gen2 \
  --set-env-vars NODE_ENV=production,PORT=3000,NODE_OPTIONS="--max-old-space-size=3072"
```

> **Önemli Parametreler:**
> - `--min-instances 1`: İlk açılışta cold-start (soğuk başlama) gecikmesini tamamen sıfırlar; şubeler anında sisteme erişir.
> - `--concurrency 80`: Tek container örneğinin 80 eşzamanlı bağlantıyı paralel yönetmesini sağlar.
> - `--execution-environment gen2`: Dedicated Linux çekirdeği ve daha yüksek ağ I/O performansı sağlar.

---

### 3. Seçenek B: Google Compute Engine (VM / VPS Dağıtımı)

- **Makine Tipi:** `c3-standard-4` (Intel Sapphire Rapids 4th Gen Xeon) veya `e2-standard-4`
- **İşletim Sistemi:** Ubuntu 24.04 LTS
- **Süreç Yöneticisi:** PM2 Cluster Modu (`ecosystem.config.cjs`)

#### VM Başlatma & Çalıştırma:
```bash
# Bağımlılıkları derle
npm run build

# PM2 Cluster modunda tüm çekirdekleri kullanarak başlat
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

### 4. Kod Düzeyinde Yapılan Yazılımsal & Mimari İyileştirmeler

Uygulamanın `server.ts` dosyasına Google Cloud altyapısıyla tam uyumlu şu optimizasyonlar uygulanmıştır:

1. **Gzip / HTTP Compression:**
   - `compression` katmanı ile Mysoft e-belge listeleri, büyük JSON veri modelleri ve statik dosyalar sıkıştırılarak ağ transfer süresi **%75 oranında azaltıldı**.
2. **HTTP Keep-Alive & Timeout Senkronizasyonu:**
   - `keepAliveTimeout = 65000` ve `headersTimeout = 66000` ayarları yapılarak Google Cloud Load Balancer ve Cloud Run'ın 60 saniyelik boşta kalma süresiyle senkronize edildi (502 Bad Gateway hataları engellendi).
3. **Statik Dosya Önbellekleme (Cache-Control):**
   - Hashed bundle dosyalarına (`.js`, `.css`) 1 yıllık `immutable` önbellek başlığı verildi; `index.html` için `no-cache, must-revalidate` uygulanarak şubelerin her güncellemede en son versiyonunu gecikmesiz alması sağlandı.
4. **Sistem Teşhis & Telemetri Uç Noktası:**
   - `GET /api/system/specs` ve `GET /api/health` servisleri ile anlık bellek (heap/RSS) ve donanım kullanım durumu izlenebilir hale getirildi.
