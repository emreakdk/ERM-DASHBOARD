# SaaS Subscription & Quota System - Kurulum Rehberi

## 📋 Genel Bakış

Bu migration, ERM Dashboard'a kapsamlı bir SaaS abonelik ve kota yönetim sistemi ekler.

## 🚀 Kurulum Adımları

### 1. SQL Migration'ı Çalıştırma

Supabase Dashboard'a gidin ve SQL Editor'de `001_subscription_system.sql` dosyasını çalıştırın:

```bash
# Dosya konumu
database/migrations/001_subscription_system.sql
```

Bu migration şunları oluşturur:
- ✅ `subscription_plans` tablosu (abonelik planları)
- ✅ `companies` tablosuna yeni kolonlar (plan_id, is_trial, vb.)
- ✅ `activity_logs` tablosu iyileştirmeleri (full-text search)
- ✅ RLS policies (güvenlik)
- ✅ Helper fonksiyonlar (quota kontrolü, kullanım istatistikleri)
- ✅ Varsayılan planlar (Basic, Pro, Unlimited)

### 2. Database Types'ı Regenerate Etme

Migration'dan sonra TypeScript type definitions'ı güncellemeniz gerekiyor:

```bash
# Supabase CLI ile
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

# Veya Supabase Dashboard'dan Settings > API > Generate Types
```

### 3. Mevcut Şirketlere Plan Atama (Opsiyonel)

Eğer mevcut şirketleriniz varsa, onlara varsayılan plan atayabilirsiniz:

```sql
-- Tüm mevcut şirketlere Basic plan + 14 günlük trial
UPDATE public.companies
SET 
  plan_id = (SELECT id FROM public.subscription_plans WHERE name = 'basic'),
  is_trial = true,
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trial'
WHERE plan_id IS NULL;
```

## 📊 Oluşturulan Yapılar

### Tablolar

#### `subscription_plans`
Abonelik planlarını saklar:
- `name`: Plan adı (basic, pro, unlimited)
- `display_name`: Türkçe görünen isim
- `price`: Fiyat
- `features`: JSONB - Limitler ve modül erişimleri

#### `companies` (Yeni Kolonlar)
- `plan_id`: Aktif plan referansı
- `is_trial`: Trial durumu
- `trial_ends_at`: Trial bitiş tarihi
- `subscription_status`: trial | active | suspended | cancelled
- `subscription_started_at`: Abonelik başlangıç
- `subscription_ends_at`: Abonelik bitiş
- `last_payment_date`: Son ödeme tarihi
- `next_payment_date`: Sonraki ödeme tarihi

#### `activity_logs`
Geliştirilmiş aktivite logları:
- Full-text search desteği (Türkçe)
- Detaylı metadata
- IP ve user agent tracking

### Fonksiyonlar

#### `get_company_usage_stats(company_uuid)`
Şirketin mevcut kullanım istatistiklerini döner:
```json
{
  "users": 5,
  "invoices": 120,
  "customers": 450,
  "products": 80,
  "deals": 30,
  "quotes": 95
}
```

#### `check_company_quota(company_uuid, resource_type)`
Belirli bir kaynak için kota kontrolü yapar:
```json
{
  "allowed": true,
  "current": 5,
  "limit": 10,
  "remaining": 5
}
```

veya

```json
{
  "allowed": false,
  "reason": "quota_exceeded",
  "message": "Plan limitinize ulaştınız. Lütfen planınızı yükseltin.",
  "current": 10,
  "limit": 10
}
```

## 🎯 Varsayılan Planlar

### Basic Plan (₺99/ay)
- 3 kullanıcı
- 100 fatura
- 100 müşteri
- 50 ürün
- 20 fırsat
- 50 teklif
- 500MB depolama
- Temel modüller

### Pro Plan (₺299/ay) ⭐ Önerilen
- 10 kullanıcı
- 500 fatura
- 1000 müşteri
- 500 ürün
- 100 fırsat
- 200 teklif
- 5GB depolama
- Tüm modüller + Raporlar

### Unlimited Plan (₺999/ay)
- Sınırsız kullanıcı
- Sınırsız fatura
- Sınırsız müşteri
- Sınırsız ürün
- Sınırsız fırsat
- Sınırsız teklif
- Sınırsız depolama
- Tüm modüller + API erişimi

## 🔒 Güvenlik

- RLS (Row Level Security) tüm tablolarda aktif
- Master brain kullanıcıları tüm planları yönetebilir
- Normal kullanıcılar sadece aktif planları görebilir
- Şirketler sadece kendi loglarını görebilir

## 🧪 Test Senaryoları

### 1. Plan Limiti Testi
```sql
-- Şirketin kullanıcı kotasını kontrol et
SELECT check_company_quota(
  'COMPANY_UUID'::uuid,
  'users'
);
```

### 2. Kullanım İstatistikleri
```sql
-- Şirketin mevcut kullanımını gör
SELECT get_company_usage_stats('COMPANY_UUID'::uuid);
```

### 3. Activity Log Arama
```sql
-- Full-text search ile log ara
SELECT * FROM activity_logs
WHERE to_tsvector('turkish', description) @@ to_tsquery('turkish', 'fatura & oluştur');
```

## 📝 Sonraki Adımlar

1. ✅ SQL migration'ı çalıştır
2. ✅ Database types'ı regenerate et
3. ⏳ MasterBrain UI'ı güncelle (PHASE 2)
4. ⏳ Quota enforcement logic ekle (PHASE 3)

## 🆘 Sorun Giderme

### "subscription_plans tablosu bulunamadı" hatası
- Migration'ın başarıyla çalıştığından emin olun
- Supabase Dashboard > Table Editor'de tabloyu kontrol edin

### TypeScript type hataları
- Database types'ı regenerate etmeyi unutmayın
- `src/types/database.ts` dosyasının güncel olduğundan emin olun

### RLS policy hataları
- Master brain kullanıcısının role'ünün 'master_brain' olduğundan emin olun
- `users` tablosunda role kolonunu kontrol edin
