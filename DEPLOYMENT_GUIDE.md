# 🚀 SaaS Platform Deployment Guide

Bu rehber, ERM Dashboard'u tam ticari bir SaaS platformuna dönüştüren tüm özelliklerin deployment sürecini içerir.

## 📋 İçindekiler
1. [SQL Migration](#sql-migration)
2. [Edge Functions Deployment](#edge-functions-deployment)
3. [Environment Variables](#environment-variables)
4. [Supabase Dashboard Ayarları](#supabase-dashboard-ayarları)
5. [Frontend Build & Deploy](#frontend-build--deploy)
6. [Test Checklist](#test-checklist)

---

## 1. SQL Migration

### Adım 1: Migration Dosyasını Çalıştır

**Seçenek A: Supabase CLI (Önerilen)**
```bash
cd c:\Users\Emre\Desktop\ERM-DASHBOARD
supabase db push
```

**Seçenek B: Supabase Dashboard**
1. https://supabase.com/dashboard/project/vtmhkxmcdcoibvqvotca/sql adresine git
2. `supabase/migrations/20250101_saas_platform_enhancements.sql` dosyasını aç
3. Tüm içeriği kopyala ve SQL Editor'e yapıştır
4. "Run" butonuna bas

### Adım 2: Migration'ı Doğrula

SQL Editor'de aşağıdaki sorguları çalıştırarak migration'ın başarılı olduğunu doğrula:

```sql
-- Yeni tabloları kontrol et
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('system_errors', 'impersonation_sessions');

-- Yeni kolonları kontrol et
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name IN ('invoice_limit', 'user_limit', 'transaction_limit');

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'activity_logs' 
AND column_name IN ('actor_id', 'action_type', 'description', 'metadata');

-- Helper fonksiyonları kontrol et
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('log_activity', 'check_company_quota', 'get_company_quota_usage');
```

### Adım 3: Varsayılan Verileri Kontrol Et

```sql
-- Mevcut şirketlerin quota değerlerini kontrol et
SELECT id, name, invoice_limit, user_limit, transaction_limit 
FROM companies;

-- Activity logs'un yeni yapısını kontrol et
SELECT id, actor_id, action_type, description, created_at 
FROM activity_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 2. Edge Functions Deployment

### Adım 1: admin-create-user Edge Function'ı Güncelle

Bu fonksiyon zaten mevcut, sadece güncellenmiş olduğundan emin ol:

```bash
cd c:\Users\Emre\Desktop\ERM-DASHBOARD
supabase functions deploy admin-create-user
```

### Adım 2: admin-impersonate-user Edge Function'ı Deploy Et

```bash
supabase functions deploy admin-impersonate-user
```

### Adım 3: Edge Functions'ı Test Et

```bash
# admin-create-user test
curl -X POST https://vtmhkxmcdcoibvqvotca.supabase.co/functions/v1/admin-create-user \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","full_name":"Test User","company_id":"COMPANY_ID","role":"user"}'

# admin-impersonate-user test
curl -X POST https://vtmhkxmcdcoibvqvotca.supabase.co/functions/v1/admin-impersonate-user \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId":"USER_ID"}'
```

---

## 3. Supabase Dashboard Ayarları

### Edge Function JWT Verification

**ÖNEMLİ:** Her iki Edge Function için JWT verification'ı devre dışı bırak:

1. https://supabase.com/dashboard/project/vtmhkxmcdcoibvqvotca/functions adresine git
2. `admin-create-user` fonksiyonuna tıkla
3. Settings sekmesine git
4. **"Verify JWT"** seçeneğini **KAPALI** yap
5. Aynı işlemi `admin-impersonate-user` için tekrarla

### RLS Policies Kontrolü

Aşağıdaki tabloların RLS politikalarının doğru çalıştığından emin ol:

```sql
-- system_errors tablosu - sadece superadminler görebilir
SELECT * FROM system_errors LIMIT 1;

-- impersonation_sessions tablosu - sadece superadminler görebilir
SELECT * FROM impersonation_sessions LIMIT 1;

-- companies tablosu - quota kolonları güncellenebilir
UPDATE companies SET user_limit = 100 WHERE id = 'YOUR_COMPANY_ID';
```

---

## 4. Environment Variables

`.env` dosyasının aşağıdaki değişkenleri içerdiğinden emin ol:

```env
VITE_SUPABASE_URL=https://vtmhkxmcdcoibvqvotca.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 5. Frontend Build & Deploy

### Development Test

```bash
cd c:\Users\Emre\Desktop\ERM-DASHBOARD
npm run dev
```

Tarayıcıda test et:
- http://localhost:5174/
- Superadmin olarak giriş yap
- `/admin` route'una git (Master Brain Panel)
- Admin olarak giriş yap
- `/admin/company` route'una git (Company Admin Panel)

### Production Build

```bash
npm run build
npm run preview
```

### Deploy (Vercel/Netlify)

```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod
```

---

## 6. Test Checklist

### ✅ Master Brain Panel (Superadmin)

- [ ] **Genel Bakış Sekmesi**
  - [ ] Stats kartları doğru sayıları gösteriyor
  - [ ] Şirket listesi yükleniyor
  - [ ] Kullanıcı listesi yükleniyor
  - [ ] Son Aktiviteler feed'i çalışıyor (actor role badges görünüyor)
  
- [ ] **Şirket Yönetimi**
  - [ ] Yeni şirket oluşturma
  - [ ] Şirket düzenleme (ad, logo, quotas)
  - [ ] Şirket aktif/pasif yapma
  - [ ] Quota limitleri (invoice_limit, user_limit, transaction_limit) kaydediliyor
  
- [ ] **Kullanıcı Yönetimi**
  - [ ] Yeni kullanıcı oluşturma
  - [ ] Kullanıcı rolü değiştirme
  - [ ] Kullanıcı şirketi değiştirme
  - [ ] Kullanıcı engelleme/engel kaldırma
  - [ ] Şifre sıfırlama
  - [ ] Kullanıcı silme
  - [ ] **User Impersonation** - Kullanıcı olarak giriş yapma butonu çalışıyor
  
- [ ] **Sistem Sağlığı Sekmesi**
  - [ ] System errors listesi görünüyor
  - [ ] Error filtreleme (5xx, 4xx, 3xx) çalışıyor
  - [ ] Stats kartları doğru sayıları gösteriyor
  - [ ] Error detayları (metadata) görüntülenebiliyor

### ✅ Company Admin Panel (Admin)

- [ ] **Dashboard**
  - [ ] Stats kartları (Toplam Kullanıcı, Admin Kullanıcılar, Kotalar)
  - [ ] Kota detayları progress bar'ları
  - [ ] Kota renk kodlaması (yeşil/turuncu/kırmızı)
  
- [ ] **Kullanıcı Yönetimi**
  - [ ] Şirket kullanıcıları listeleniyor
  - [ ] Yeni kullanıcı oluşturma (sadece kendi şirketi için)
  - [ ] Kullanıcı rolü değiştirme (admin/user)
  - [ ] Kullanıcı engelleme/engel kaldırma
  - [ ] Arama fonksiyonu çalışıyor

### ✅ Auth & Security

- [ ] **Blocked User Guard**
  - [ ] Bloklu kullanıcı giriş yapamıyor
  - [ ] Bloklu kullanıcı otomatik çıkış yapıyor
  - [ ] Login sayfasında "Hesabınız askıya alınmıştır" mesajı görünüyor
  
- [ ] **Role-Based Access**
  - [ ] Superadmin `/admin` route'una erişebiliyor
  - [ ] Admin `/admin/company` route'una erişebiliyor
  - [ ] User admin route'larına erişemiyor
  - [ ] Sidebar'da doğru linkler görünüyor

### ✅ Activity Logging

- [ ] **Automatic Logging**
  - [ ] Şirket oluşturma loglanıyor
  - [ ] Şirket güncelleme loglanıyor
  - [ ] Kullanıcı engelleme/engel kaldırma loglanıyor
  - [ ] Rol değiştirme loglanıyor
  - [ ] Impersonation başlatma loglanıyor
  
- [ ] **Activity Feed Display**
  - [ ] Actor adı görünüyor
  - [ ] Actor rolü badge olarak görünüyor
  - [ ] Action type görünüyor
  - [ ] Tarih formatı doğru

### ✅ Quota System

- [ ] **Quota Limits**
  - [ ] Şirket quota limitleri kaydediliyor
  - [ ] Company Admin Panel'de quotalar doğru görünüyor
  - [ ] Percentage hesaplaması doğru
  - [ ] Progress bar'lar doğru renkte
  
- [ ] **Quota Enforcement** (İleride implement edilecek)
  - [ ] Kullanıcı limiti aşıldığında yeni kullanıcı oluşturulamıyor
  - [ ] Fatura limiti aşıldığında yeni fatura oluşturulamıyor

---

## 🐛 Troubleshooting

### Edge Function 401 Hatası

**Sorun:** Edge Function çağrıları 401 "Invalid JWT" hatası veriyor

**Çözüm:**
1. Supabase Dashboard'da Edge Function settings'e git
2. "Verify JWT" seçeneğini KAPALI yap
3. Edge Function'ı yeniden deploy et

### Select Component Hataları

**Sorun:** Select component'lerde "value must be a string" hatası

**Çözüm:**
- Tüm Select value prop'ları string olmalı
- `null` değerler için fallback string kullan (örn: `'__none__'`)
- Company ID'ler her zaman string olarak geçilmeli

### Activity Logs Görünmüyor

**Sorun:** Son Aktiviteler feed'i boş

**Çözüm:**
1. Migration'ın doğru çalıştığından emin ol
2. `activity_logs` tablosunda `actor_id`, `action_type`, `description` kolonlarının olduğunu kontrol et
3. Trigger'ların aktif olduğunu kontrol et:
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

### Quota Hesaplaması Yanlış

**Sorun:** Company Admin Panel'de quota yüzdeleri yanlış

**Çözüm:**
1. `companies` tablosunda limit değerlerinin doğru olduğunu kontrol et
2. Count query'lerinin doğru çalıştığını test et:
```sql
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE company_id = 'YOUR_COMPANY_ID') as user_count,
  (SELECT COUNT(*) FROM invoices WHERE company_id = 'YOUR_COMPANY_ID') as invoice_count,
  (SELECT COUNT(*) FROM transactions WHERE company_id = 'YOUR_COMPANY_ID') as transaction_count;
```

---

## 📞 Support

Herhangi bir sorun yaşarsan:
1. Browser console'u kontrol et
2. Supabase Dashboard > Logs sekmesine bak
3. Edge Function logs'ları incele
4. Network tab'inde API çağrılarını kontrol et

---

## 🎉 Deployment Tamamlandı!

Tüm adımları tamamladıysan, artık tam ticari bir SaaS platformuna sahipsin:

✅ Multi-tenant architecture  
✅ Role-based access control  
✅ User impersonation  
✅ System health monitoring  
✅ Activity logging  
✅ Quota management  
✅ Company admin panel  
✅ Blocked user protection  

**Tebrikler! 🚀**
