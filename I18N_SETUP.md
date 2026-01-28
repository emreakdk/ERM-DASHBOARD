# 🌍 Internationalization (i18n) Kurulum Rehberi

Bu proje için profesyonel, enterprise-grade bir çok dilli (i18n) altyapı kuruldu. React-i18next kullanılarak Türkçe ve İngilizce dil desteği sağlandı.

## 📦 Kurulum Adımları

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

Bu komut aşağıdaki i18n paketlerini yükleyecek:
- `i18next` - Ana i18n kütüphanesi
- `react-i18next` - React entegrasyonu
- `i18next-browser-languagedetector` - Tarayıcı dil algılama
- `i18next-http-backend` - Lazy loading için backend

### 2. Supabase Migration'ı Uygulayın

Veritabanına `preferred_language` kolonunu eklemek için migration'ı çalıştırın:

```bash
# Supabase CLI kullanarak
supabase db push

# Veya migration dosyasını manuel olarak çalıştırın:
# supabase/migrations/20250107_add_preferred_language.sql
```

Migration dosyası şunları yapar:
- `profiles` tablosuna `preferred_language` kolonu ekler (TEXT, default: 'tr')
- Performans için index oluşturur
- Sadece 'en' ve 'tr' değerlerini kabul eden CHECK constraint ekler

### 3. Uygulamayı Başlatın

```bash
npm run dev
```

## 🎯 Özellikler

### ✅ Tamamlanan Özellikler

1. **Modüler Çeviri Yapısı**
   - Çeviriler `public/locales/{en|tr}/common.json` dosyalarında saklanır
   - Lazy loading ile performans optimizasyonu
   - Kolay genişletilebilir yapı

2. **Otomatik Dil Algılama**
   - İlk ziyarette tarayıcı dilini otomatik algılar
   - localStorage'da tercih saklanır
   - Cihazlar arası senkronizasyon için Supabase entegrasyonu

3. **Kullanıcı Tercihi Senkronizasyonu**
   - Kullanıcı dil değiştirdiğinde Supabase'de güncellenir
   - Farklı cihazlarda aynı dil tercihi kullanılır
   - Oturum açıldığında kullanıcının kayıtlı dili yüklenir

4. **Profesyonel UI Component**
   - Shadcn UI ile oluşturulmuş `LanguageSwitcher` komponenti
   - Globe ikonu ile minimalist tasarım
   - Dropdown menü ile kolay dil değiştirme
   - Aktif dilin görsel göstergesi (✓ işareti)

5. **Tam Entegrasyon**
   - Ana navigation ve sidebar'larda çeviri desteği
   - Tüm statik metinler çevrildi
   - Rol etiketleri (Süper Admin, Yönetici, Kullanıcı)
   - Sistem mesajları ve bildirimler

## 📁 Dosya Yapısı

```
src/
├── i18n/
│   └── config.ts                 # i18next konfigürasyonu
├── components/
│   ├── LanguageSwitcher.tsx      # Dil değiştirici component
│   └── layout/
│       └── AppLayout.tsx         # Çeviri entegrasyonu ile güncellenmiş
└── main.tsx                      # i18n ile sarmalanmış

public/
└── locales/
    ├── en/
    │   └── common.json           # İngilizce çeviriler
    └── tr/
        └── common.json           # Türkçe çeviriler

supabase/
└── migrations/
    └── 20250107_add_preferred_language.sql
```

## 🔧 Kullanım

### Component'lerde Çeviri Kullanımı

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('nav.dashboard')}</h1>
      <p>{t('common.loading')}</p>
    </div>
  );
}
```

### Yeni Çeviri Anahtarı Ekleme

1. `public/locales/tr/common.json` dosyasına Türkçe metni ekleyin
2. `public/locales/en/common.json` dosyasına İngilizce metni ekleyin
3. Component'te `t('anahtar.ismi')` ile kullanın

Örnek:
```json
// tr/common.json
{
  "mySection": {
    "title": "Başlık",
    "description": "Açıklama"
  }
}

// en/common.json
{
  "mySection": {
    "title": "Title",
    "description": "Description"
  }
}
```

### Dil Değiştirme (Programatik)

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  
  return (
    <button onClick={() => changeLanguage('en')}>
      Switch to English
    </button>
  );
}
```

## 🎨 LanguageSwitcher Konumu

LanguageSwitcher component'i şu konumlarda görünür:
- **Desktop**: Header'ın sağ üst köşesinde (şirket seçici ile headerRight arasında)
- **Mobile**: Aynı konumda, responsive tasarım ile

Component otomatik olarak:
- Mevcut dili gösterir
- Kullanıcı oturum açtığında tercihini yükler
- Dil değişikliklerini Supabase'e kaydeder
- localStorage'da saklar

## 🌐 Desteklenen Diller

- 🇹🇷 **Türkçe (tr)** - Varsayılan dil
- 🇬🇧 **İngilizce (en)**

## 📝 Çeviri Kapsamı

Aşağıdaki bölümler tamamen çevrildi:

### Navigation & Sidebar
- Dashboard, Finans, Kasa & Banka
- Fırsatlar, Teklifler, Faturalar
- Müşteriler, Ürün/Hizmet
- Aktiviteler, Ayarlar
- Master Brain, Şirket Yönetimi

### Common UI Elements
- Butonlar (Kaydet, İptal, Sil, vb.)
- Durumlar (Aktif, Pasif, Yükleniyor)
- Aksiyonlar (Ara, Filtrele, Dışa Aktar)
- Form elemanları

### Authentication
- Giriş, Kayıt, Şifre işlemleri
- Oturum yönetimi

### Roles
- Süper Admin, Yönetici, Kullanıcı
- Rol etiketleri

### Messages & Errors
- Başarı mesajları
- Hata mesajları
- Onay diyalogları

## 🔄 Gelecek Geliştirmeler

İhtiyaç duyulursa eklenebilecek özellikler:

1. **Daha Fazla Dil Desteği**
   - Almanca, Fransızca, İspanyolca vb.
   - `public/locales/{lang}/common.json` ekleyerek

2. **Namespace'ler**
   - Büyük projeler için modüler çeviri dosyaları
   - Örn: `dashboard.json`, `invoices.json`, `customers.json`

3. **Pluralization**
   - Çoğul form desteği
   - "1 öğe" vs "5 öğe" gibi

4. **Interpolation**
   - Dinamik değerler ile çeviriler
   - Örn: `t('welcome', { name: 'John' })`

5. **RTL Dil Desteği**
   - Arapça, İbranice gibi sağdan sola diller için

## 🐛 Sorun Giderme

### TypeScript Hataları

Eğer TypeScript hataları görüyorsanız:
```bash
npm install
```
komutunu çalıştırarak paketleri yükleyin.

### Çeviriler Görünmüyor

1. Tarayıcı konsolunu kontrol edin
2. `public/locales/` klasörünün doğru konumda olduğundan emin olun
3. JSON dosyalarının geçerli olduğunu doğrulayın
4. Tarayıcı cache'ini temizleyin

### Dil Tercihi Kaydedilmiyor

1. Supabase migration'ının uygulandığından emin olun
2. `profiles` tablosunda `preferred_language` kolonunun olduğunu kontrol edin
3. Kullanıcının oturum açtığından emin olun

## 📚 Kaynaklar

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Best Practices](https://www.i18next.com/principles/fallback)

## ✅ Kontrol Listesi

Kurulum tamamlandıktan sonra kontrol edin:

- [ ] `npm install` çalıştırıldı
- [ ] Supabase migration uygulandı
- [ ] Uygulama başlatıldı (`npm run dev`)
- [ ] Header'da Globe ikonu görünüyor
- [ ] Dil değiştirme çalışıyor
- [ ] Sidebar metinleri çevriliyor
- [ ] Kullanıcı tercihi kaydediliyor
- [ ] Sayfa yenilendiğinde dil korunuyor

---

**Not**: Bu sistem production-ready ve enterprise-grade standartlarda geliştirilmiştir. Global pazara açılmak için hazır bir altyapıdır.
