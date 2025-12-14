# ERM Dashboard - Cloud ERP / Pre-Accounting System

Modern, yüksek performanslı bir Cloud ERP ve Ön Muhasebe Dashboard uygulaması.

## 🚀 Teknoloji Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn UI (Radix UI tabanlı)
- **Routing:** React Router v6
- **State Management:** TanStack Query (React Query)
- **Database:** Supabase (PostgreSQL)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

## 📋 Özellikler

- ✅ Modern ve minimalist Apple-style tasarım
- ✅ Dark Mode desteği
- ✅ Supabase Authentication
- ✅ TypeScript ile tam tip güvenliği
- ✅ Responsive tasarım
- ✅ Protected routes
- ✅ TanStack Query ile optimize edilmiş veri yönetimi

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. Environment Variables Ayarlayın

`.env.local` dosyası oluşturun ve aşağıdaki değişkenleri ekleyin:

```env
VITE_SUPABASE_URL=https://ewwhyzvlqjrtolfyxdve.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Not:** `.env.example` dosyasını referans alabilirsiniz.

### 3. Uygulamayı Başlatın

```bash
npm run dev
```

Uygulama `http://localhost:5173` adresinde çalışacaktır.

## 📁 Proje Yapısı

```
src/
├── components/
│   ├── ui/              # Shadcn UI componentleri
│   └── shared/          # Paylaşılan componentler
├── contexts/            # React Context'ler (Auth, vb.)
├── features/            # Feature-based modüller
│   ├── auth/
│   ├── dashboard/
│   ├── transactions/
│   ├── invoices/
│   └── customers/
├── hooks/               # Custom React hooks
├── lib/                 # Utility fonksiyonlar ve konfigürasyonlar
├── pages/               # Sayfa componentleri
└── types/               # TypeScript tip tanımları
```

## 🗄️ Database Schema

Proje aşağıdaki Supabase tablolarını kullanır:

- **profiles** - Kullanıcı profilleri
- **customers** - Müşteri bilgileri
- **transactions** - Gelir/Gider işlemleri
- **invoices** - Fatura kayıtları
- **invoice_items** - Fatura kalemleri

## 🎨 Design System

- **Font:** Inter / System UI
- **Colors:** Slate/Gray tonları, Pastel Blue/Orange/Green vurgular
- **Border Radius:** Medium-Large (0.5rem)
- **Shadows:** Subtle, minimal
- **Spacing:** Generous whitespace

## 📝 Geliştirme Notları

- Tüm componentler TypeScript ile yazılmıştır
- Strict typing kullanılmıştır (`any` kullanımı yoktur)
- Supabase client `src/lib/supabase.ts` içinde yapılandırılmıştır
- Auth Context `src/contexts/AuthContext.tsx` içinde yönetilir
- Protected routes `ProtectedRoute` component'i ile korunur

## 🔜 Sonraki Adımlar (Faz 2+)

- [ ] Dashboard KPI kartları ve grafikler
- [ ] Transactions (Finans) modülü
- [ ] Invoices (Faturalar) modülü
- [ ] Customers (Müşteriler) modülü
- [ ] Global filtreler (Tarih, Banka hesabı)
- [ ] Unified DatePicker component
- [ ] Account/Customer Selector (Combobox)

## 📄 Lisans

MIT
