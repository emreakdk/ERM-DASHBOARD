# ⚡ Quick Start Guide - SaaS Platform

## 🚀 Hızlı Başlangıç (5 Dakika)

### 1. SQL Migration'ı Çalıştır

**Supabase Dashboard'dan:**
```
1. https://supabase.com/dashboard/project/vtmhkxmcdcoibvqvotca/sql
2. supabase/migrations/20250101_saas_platform_enhancements.sql dosyasını aç
3. Tüm içeriği kopyala ve SQL Editor'e yapıştır
4. "Run" butonuna bas
```

### 2. Edge Functions'ı Deploy Et

```bash
cd c:\Users\Emre\Desktop\ERM-DASHBOARD

# Her iki fonksiyonu deploy et
supabase functions deploy admin-create-user
supabase functions deploy admin-impersonate-user
```

### 3. Supabase Dashboard Ayarları

**ÖNEMLİ:** Her iki Edge Function için:
```
1. https://supabase.com/dashboard/project/vtmhkxmcdcoibvqvotca/functions
2. admin-create-user > Settings > "Verify JWT" KAPALI
3. admin-impersonate-user > Settings > "Verify JWT" KAPALI
```

### 4. Uygulamayı Başlat

```bash
npm run dev
```

### 5. Test Et

**Superadmin Testi:**
- http://localhost:5174/login
- Email: emreakbudak006@gmail.com
- `/admin` route'una git → Master Brain Panel
- "Sistem Sağlığı" sekmesini kontrol et
- Bir kullanıcıya "Impersonate" butonuna bas

**Admin Testi:**
- Admin rolüyle giriş yap
- `/admin/company` route'una git → Company Admin Panel
- Kota görselleştirmelerini kontrol et
- Yeni kullanıcı oluştur

---

## 🎯 Yeni Özellikler

### Master Brain Panel (`/admin`)
- ✅ Sistem Sağlığı dashboard'u
- ✅ Company quota yönetimi (fatura/kullanıcı/işlem limitleri)
- ✅ User impersonation (Magic Link)
- ✅ Enhanced activity logs (actor role badges)

### Company Admin Panel (`/admin/company`)
- ✅ Kota görselleştirme
- ✅ Şirket içi kullanıcı yönetimi
- ✅ Rol yönetimi (admin/user)
- ✅ Kullanıcı engelleme

### Güvenlik
- ✅ Bloklu kullanıcı otomatik çıkış
- ✅ Role-based access control
- ✅ Activity logging (tüm önemli işlemler)

---

## 📊 Veritabanı Değişiklikleri

### Yeni Tablolar
- `system_errors` - Sistem hataları
- `impersonation_sessions` - Taklit oturumları

### Yeni Kolonlar
- `companies`: `invoice_limit`, `user_limit`, `transaction_limit`
- `activity_logs`: `actor_id`, `action_type`, `description`, `metadata`

### Yeni Fonksiyonlar
- `log_activity()` - Aktivite kaydetme
- `check_company_quota()` - Kota kontrolü
- `get_company_quota_usage()` - Kota kullanım istatistikleri

---

## 🐛 Hızlı Sorun Giderme

**Edge Function 401 Hatası:**
→ Supabase Dashboard'da "Verify JWT" seçeneğini KAPALI yap

**Activity Logs Görünmüyor:**
→ Migration'ın doğru çalıştığını kontrol et:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'activity_logs';
```

**Quota Görünmüyor:**
→ Companies tablosunu kontrol et:
```sql
SELECT id, name, invoice_limit, user_limit, transaction_limit FROM companies;
```

---

## 📝 Önemli SQL Komutları

### Migration Kontrolü
```sql
-- Yeni tabloları kontrol et
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('system_errors', 'impersonation_sessions');

-- Yeni kolonları kontrol et
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name IN ('invoice_limit', 'user_limit', 'transaction_limit');
```

### Test Verileri
```sql
-- Bir şirketin quota'sını güncelle
UPDATE companies 
SET invoice_limit = 500, user_limit = 25, transaction_limit = 5000 
WHERE id = 'YOUR_COMPANY_ID';

-- Activity log ekle
SELECT log_activity(
  'YOUR_USER_ID'::uuid,
  'test_action',
  'Test aktivite kaydı',
  '{"test": true}'::jsonb
);

-- System error ekle
INSERT INTO system_errors (error_code, error_message, error_source)
VALUES ('500', 'Test error', 'test_source');
```

---

## 🎉 Hazırsın!

Artık tam ticari bir SaaS platformuna sahipsin. Detaylı bilgi için `DEPLOYMENT_GUIDE.md` dosyasına bak.
