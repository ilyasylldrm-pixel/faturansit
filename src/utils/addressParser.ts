/**
 * Türk Adres Ayrıştırma Yardımcısı
 * VKN/TCKN sorgulaması neticesinde gelen adres dizgisini veya bileşenlerini
 * Mahalle, Sokak/Cadde/Kapı No, İlçe, İl ve Posta Kodu olarak ayrıştırır.
 */

export interface TurkishAddressComponents {
  neighborhood: string;
  street: string;
  district: string;
  city: string;
  postalCode: string;
  fullAddress: string;
}

const COMMON_TURKISH_CITIES = [
  'ADANA', 'ADIYAMAN', 'AFYONKARAHİSAR', 'AĞRI', 'AMASYA', 'ANKARA', 'ANTALYA', 'ARTVİN',
  'AYDIN', 'BALIKESİR', 'BİLECİK', 'BİNGÖL', 'BİTLİS', 'BOLU', 'BURDUR', 'BURSA',
  'ÇANAKKALE', 'ÇANKIRI', 'ÇORUM', 'DENİZLİ', 'DİYARBAKIR', 'EDİRNE', 'ELAZIĞ', 'ERZİNCAN',
  'ERZURUM', 'ESKİŞEHİR', 'GAZİANTEP', 'GİRESUN', 'GÜMÜŞHANE', 'HAKKARİ', 'HATAY', 'ISPARTA',
  'MERSİN', 'İSTANBUL', 'İZMİR', 'KARS', 'KASTAMONU', 'KAYSERİ', 'KIRKLARELİ', 'KIRŞEHİR',
  'KOCAELİ', 'KONYA', 'KÜTAHYA', 'MALATYA', 'MANİSA', 'KAHRAMANMARAŞ', 'MARDİN', 'MUĞLA',
  'MUŞ', 'NEVŞEHİR', 'NİĞDE', 'ORDU', 'RİZE', 'SAKARYA', 'SAMSUN', 'SİİRT', 'SİNOP',
  'SİVAS', 'TEKİRDAĞ', 'TOKAT', 'TRABZON', 'TUNCELİ', 'ŞANLIURFA', 'UŞAK', 'VAN',
  'YOZGAT', 'ZONGULDAK', 'AKSARAY', 'BAYBURT', 'KARAMAN', 'KIRIKKALE', 'BATMAN', 'ŞIRNAK',
  'BARTIN', 'ARDAHAN', 'IĞDIR', 'YALOVA', 'KARABÜK', 'KİLİS', 'OSMANİYE', 'DÜZCE',
];

/**
 * Serbest adres metninden Mahalle, Cadde/Sokak, İlçe, İl ve Posta Kodu ayrıştırır.
 */
export function parseTurkishAddress(
  rawAddress: string,
  providedDistrict?: string,
  providedCity?: string
): TurkishAddressComponents {
  const clean = (rawAddress || '').trim().replace(/\s+/g, ' ');
  if (!clean) {
    return {
      neighborhood: '',
      street: '',
      district: (providedDistrict || '').trim(),
      city: (providedCity || '').trim(),
      postalCode: '',
      fullAddress: '',
    };
  }

  let text = clean;

  // 1. Posta Kodu Ayıklama (5 haneli)
  let postalCode = '';
  const postCodeMatch = text.match(/\b([0-8]\d{4})\b/);
  if (postCodeMatch) {
    postalCode = postCodeMatch[1];
    text = text.replace(postCodeMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  // 2. İl Tespiti (Verilen veya metnin sonundaki bilinen şehir)
  let city = (providedCity || '').trim();
  if (!city) {
    for (const c of COMMON_TURKISH_CITIES) {
      const reg = new RegExp(`\\b${c}\\b`, 'i');
      if (reg.test(text)) {
        city = c.charAt(0).toUpperCase() + c.slice(1).toLocaleLowerCase('tr-TR');
        text = text.replace(reg, '').replace(/\s+/g, ' ').trim();
        break;
      }
    }
  } else {
    // Metin içerisinden ili temizleyelim ki sokak/mahalle alanına karışmasın
    const reg = new RegExp(`\\b${city}\\b`, 'i');
    text = text.replace(reg, '').replace(/\s+/g, ' ').trim();
  }

  // 3. İlçe Tespiti
  let district = (providedDistrict || '').trim();
  if (district) {
    const reg = new RegExp(`\\b${district}\\b`, 'i');
    text = text.replace(reg, '').replace(/\s+/g, ' ').trim();
  }

  // 4. Mahalle Tespiti
  // Örn: "Levent Mah.", "Caferağa Mahallesi", "Merkez Mah.", "Yıldıztepe Mh."
  let neighborhood = '';
  const mahalleMatch = text.match(/(?:^|[\s,/])([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s.-]+?\s*(?:Mah\.|Mahallesi|Mahalle|Mh\.))/i);
  if (mahalleMatch) {
    neighborhood = mahalleMatch[1].trim();
    text = text.replace(neighborhood, '').replace(/\s+/g, ' ').trim();
  }

  // 5. Cadde / Sokak / Kapı No (Geriye kalan kısım)
  let street = text.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

  // Eğer mahalle bulunamamışsa ve sokak çok uzunsa ilk kısmı mahalle olabilir
  if (!neighborhood && street.includes('Mah.')) {
    const parts = street.split(/(Mah\.)/i);
    if (parts.length >= 2) {
      neighborhood = (parts[0] + parts[1]).trim();
      street = parts.slice(2).join('').trim();
    }
  }

  // Temizleme: sokak başındaki veya sonundaki virgül/noktalar
  street = street.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

  const fullAddress = clean;

  return {
    neighborhood,
    street,
    district: district || providedDistrict || '',
    city: city || providedCity || 'İstanbul',
    postalCode,
    fullAddress,
  };
}
