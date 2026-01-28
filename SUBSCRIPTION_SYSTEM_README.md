# SaaS Subscription & Quota Enforcement System

## Overview
Bu sistem, ERM Dashboard'a kapsamlı bir abonelik ve kota yönetim sistemi ekler. Şirketler artık planlarına göre limitlerle çalışır ve limitler aşıldığında kullanıcılar yükseltme yapmaları için yönlendirilir.

## 📋 Kurulum Adımları

### 1. Veritabanı Migration'larını Çalıştırın

**Sırayla aşağıdaki SQL dosyalarını Supabase SQL Editor'de çalıştırın:**

```bash
# 1. Önce subscription system'i kurun
database/migrations/001_subscription_system.sql

# 2. Sonra company plan enforcement'ı aktif edin
database/migrations/002_enforce_company_plans.sql
```

**Migration'lar ne yapar?**
- ✅ `subscription_plans` tablosu oluşturur (3 varsayılan plan ile)
- ✅ `companies` tablosuna plan ve subscription alanları ekler
- ✅ Mevcut tüm şirketlere otomatik "Temel Plan" atar
- ✅ `plan_id` kolonunu zorunlu (NOT NULL) yapar
- ✅ Yeni şirketler oluşturulduğunda otomatik plan ataması yapar
- ✅ Kota kontrol fonksiyonları ekler (`check_company_quota`, `get_company_usage_stats`)
- ✅ Master Brain için gelişmiş company overview view'ı oluşturur

### 2. Varsayılan Planlar

Migration sonrası otomatik olarak 3 plan oluşturulur:

| Plan | Fiyat | Kullanıcı | Fatura | Müşteri | Ürün |
|------|-------|-----------|--------|---------|------|
| **Temel Plan** | 99 TRY/ay | 3 | 100 | 100 | 50 |
| **Profesyonel Plan** | 299 TRY/ay | 10 | 500 | 1000 | 500 |
| **Sınırsız Plan** | 999 TRY/ay | ∞ | ∞ | ∞ | ∞ |

## 🎯 Özellikler

### 1. Otomatik Kota Kontrolü

**Fatura Oluşturma:**
- Yeni fatura oluşturulmadan önce kota kontrolü yapılır
- Limit aşılmışsa `UpgradeRequiredModal` gösterilir
- Kullanıcı "Planları Görüntüle" butonuyla yönlendirilir

**Kullanıcı Ekleme:**
- Benzer şekilde kullanıcı limiti kontrol edilir
- Limit aşımında upgrade modal'ı gösterilir

### 2. MasterBrain Panel İyileştirmeleri

**Şirket Yönetimi:**
- ✅ Yeni "Plan" kolonu eklendi
- ✅ Her şirketin mevcut planı görüntülenir
- ✅ Plan fiyatı ve para birimi gösterilir
- ✅ Trial durumu badge ile belirtilir
- ✅ Şirket düzenleme modalında plan değiştirme özelliği (yakında)

### 3. Merkezi Kota Yönetimi

**`useQuotaGuard` Hook:**
```typescript
const { canPerformAction, usage, plan, getUsagePercentage } = useQuotaGuard()

// Örnek kullanım
const quotaCheck = canPerformAction('CREATE_INVOICE')
if (!quotaCheck.allowed) {
  // Upgrade modal göster
}
```

**Desteklenen Aksiyonlar:**
- `CREATE_INVOICE` - Fatura oluşturma
- `ADD_USER` - Kullanıcı ekleme
- `ADD_CUSTOMER` - Müşteri ekleme
- `ADD_PRODUCT` - Ürün ekleme
- `ADD_DEAL` - Anlaşma ekleme
- `ADD_QUOTE` - Teklif ekleme

### 4. Upgrade Required Modal

**Özellikler:**
- 🎨 Modern ve kullanıcı dostu tasarım
- 📊 Mevcut kullanım / limit göstergesi
- 📈 Progress bar ile görsel geri bildirim
- ✨ Plan yükseltme avantajları listesi
- 🔗 "Planları Görüntüle" butonu ile yönlendirme

## 📁 Yeni Dosyalar

```
src/
├── hooks/
│   └── useQuotaGuard.ts              # Merkezi kota kontrol hook'u
├── components/
│   └── modals/
│       └── UpgradeRequiredModal.tsx  # Upgrade modal komponenti
└── types/
    └── database.ts                    # Güncellenmiş (subscription_plans eklendi)

database/
└── migrations/
    ├── 001_subscription_system.sql           # Subscription sistemi
    └── 002_enforce_company_plans.sql         # Plan enforcement
```

## 🔧 Değiştirilen Dosyalar

```
src/
├── components/
│   └── forms/
│       └── CreateInvoiceForm.tsx     # Kota kontrolü eklendi
├── pages/
│   └── admin/
│       ├── MasterBrainPanel.tsx      # Plan kolonu eklendi
│       └── adminQueries.ts           # Plan bilgileri eklendi
└── types/
    └── database.ts                    # Companies ve subscription_plans tipleri
```

## 🚀 Kullanım

### Fatura Oluşturma ile Kota Kontrolü

```typescript
// CreateInvoiceForm.tsx içinde otomatik çalışır
const onSubmit = async (values) => {
  if (!isEditing) {
    const quotaCheck = canPerformAction('CREATE_INVOICE')
    if (!quotaCheck.allowed) {
      setUpgradeModal({
        open: true,
        reason: quotaCheck.reason,
        message: quotaCheck.message,
        current: quotaCheck.current,
        limit: quotaCheck.limit,
      })
      return // İşlemi durdur
    }
  }
  // Normal fatura oluşturma devam eder
}
```

### Kota Durumunu Kontrol Etme

```typescript
const { usage, plan, getUsagePercentage } = useQuotaGuard()

// Mevcut kullanım
console.log(usage?.invoices) // Örn: 85

// Plan limitleri
console.log(plan?.features.max_invoices) // Örn: 100

// Yüzdelik kullanım
const percentage = getUsagePercentage('invoices') // Örn: 85
```

## 🎨 UI/UX İyileştirmeleri

### MasterBrain Panel
- Plan bilgileri her şirket için görüntülenir
- Trial durumu açıkça belirtilir
- Plan fiyatı ve para birimi gösterilir

### Upgrade Modal
- Kullanıcı dostu hata mesajları
- Görsel progress bar
- Yükseltme avantajları listesi
- Kolay yönlendirme

## 📊 Veritabanı Fonksiyonları

### `get_company_usage_stats(company_uuid)`
Şirketin mevcut kullanım istatistiklerini döndürür:
```json
{
  "users": 2,
  "invoices": 85,
  "customers": 45,
  "products": 30,
  "deals": 10,
  "quotes": 20
}
```

### `check_company_quota(company_uuid, resource_type)`
Belirli bir kaynak için kota kontrolü yapar:
```json
{
  "allowed": false,
  "reason": "quota_exceeded",
  "message": "Plan limitinize ulaştınız (85/100)...",
  "current": 85,
  "limit": 100,
  "remaining": 0
}
```

### `update_company_plan(company_uuid, new_plan_id, admin_user_id)`
Şirketin planını değiştirir ve activity log kaydı oluşturur.

## 🔐 Güvenlik

- ✅ RLS (Row Level Security) politikaları aktif
- ✅ Sadece superadmin kullanıcılar planları yönetebilir
- ✅ Her şirket sadece kendi verilerini görebilir
- ✅ Plan değişiklikleri activity log'a kaydedilir

## 🐛 Bilinen Sorunlar ve Çözümler

### Sorun: "choose a package" hatası
**Çözüm:** Migration'ları sırayla çalıştırın. 002_enforce_company_plans.sql tüm şirketlere otomatik plan atar.

### Sorun: Yeni şirket oluşturulduğunda plan yok
**Çözüm:** `trigger_assign_default_plan` trigger'ı otomatik olarak Temel Plan atar.

### Sorun: Kota kontrolü çalışmıyor
**Çözüm:** `useQuotaGuard` hook'unun `companyId` değerini doğru aldığından emin olun.

## 📝 Gelecek Geliştirmeler

- [ ] Company Dashboard'a "Kota Kullanımı" widget'ı
- [ ] MasterBrain'de şirket düzenleme modalında plan seçimi
- [ ] Kullanıcı ekleme formuna kota kontrolü
- [ ] Müşteri, ürün, anlaşma formlarına kota kontrolü
- [ ] Plan yükseltme/düşürme workflow'u
- [ ] Ödeme entegrasyonu
- [ ] Otomatik fatura kesme sistemi
- [ ] Trial süresi dolunca otomatik suspend

## 🆘 Destek

Herhangi bir sorun yaşarsanız:
1. Migration'ların doğru sırayla çalıştırıldığından emin olun
2. Supabase logs'larını kontrol edin
3. Browser console'da hata mesajlarını inceleyin
4. `useQuotaGuard` hook'unun doğru çalıştığını test edin

---

**Not:** Bu sistem production-ready durumda değildir. Ödeme entegrasyonu ve otomatik faturalama eklenmesi önerilir.
