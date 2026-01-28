# Supabase Edge Functions Deployment Guide

## Neden Edge Functions Gerekli?

Supabase Auth Admin API (`supabase.auth.admin.*`) **sadece server-side** kullanılabilir çünkü `service_role` key gerektiriyor. Browser'dan direkt çağrılamaz (CORS hatası).

**Çözüm:** Edge Functions kullanarak admin işlemlerini server-side'da güvenli şekilde yapıyoruz.

## 📦 Oluşturulan Edge Functions

1. **`admin-create-user`** - Yeni kullanıcı oluşturma
2. **`admin-delete-user`** - Kullanıcı silme
3. **`admin-reset-password`** - Şifre sıfırlama

## 🚀 Deployment Adımları

### 1. Supabase CLI Kurulumu

```bash
# Windows (PowerShell)
scoop install supabase

# veya npm ile
npm install -g supabase
```

### 2. Supabase'e Login

```bash
supabase login
```

### 3. Project ID'yi Bul

Supabase Dashboard > Settings > General > Reference ID

### 4. Edge Functions'ları Deploy Et

```bash
# Project root'da (ERM-DASHBOARD klasöründe)
cd c:\Users\Emre\Desktop\ERM-DASHBOARD

# Link project
supabase link --project-ref YOUR_PROJECT_ID

# Deploy all functions
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-reset-password
```

### 5. Environment Variables Ayarla

Supabase Dashboard > Edge Functions > Settings

Her function için şu environment variable'ları ekle:
- `SUPABASE_URL` - Otomatik set edilir
- `SUPABASE_SERVICE_ROLE_KEY` - Otomatik set edilir

## ✅ Test Etme

Deploy sonrası `/admin` sayfasında:
1. "Yeni Kullanıcı" butonuna tıkla
2. Formu doldur
3. "Oluştur" butonuna tıkla
4. Artık CORS hatası almayacaksın!

## 🔍 Debugging

Edge Function loglarını görmek için:

```bash
supabase functions logs admin-create-user --follow
```

## 📝 Notlar

- Edge Functions Deno runtime kullanıyor (TypeScript native)
- Her function otomatik olarak CORS header'ları ekliyor
- Superadmin kontrolü her function'da yapılıyor
- Hata durumunda rollback mekanizması var

## 🆘 Sorun Giderme

**Hata:** `Function not found`
**Çözüm:** Deploy komutunu tekrar çalıştır

**Hata:** `Unauthorized`
**Çözüm:** Kullanıcının superadmin rolü olduğundan emin ol

**Hata:** `CORS error`
**Çözüm:** Edge Function'ın CORS header'ları döndüğünden emin ol (zaten ekli)

## 🔗 Daha Fazla Bilgi

https://supabase.com/docs/guides/functions
