# ERM Dashboard - Enterprise SaaS ERP System

🚀 **Production-Ready Multi-Tenant SaaS ERP & Pre-Accounting System**

A modern, scalable, and feature-rich enterprise resource planning system built with cutting-edge technologies. Perfect for businesses looking for a comprehensive financial management solution.

## ✨ Key Features

### 🏢 Multi-Tenancy & RBAC
- **Multi-company support** with tenant isolation
- **Role-based access control** (Superadmin, Admin, User)
- **Module-level permissions** for granular access control
- **Company switching** for superadmins

### 💳 Subscription & Quota Management
- **Flexible subscription plans** (Free, Starter, Professional, Enterprise)
- **Real-time quota enforcement** for users, invoices, customers, products
- **Unlimited plans** with ∞ display
- **Automatic quota tracking** and usage monitoring
- **Upgrade prompts** when limits are reached

### 🔐 Security & Authentication
- **Supabase Authentication** with JWT tokens
- **Row Level Security (RLS)** on all database tables
- **Secure Edge Functions** with error logging
- **Authorization headers** on all API calls
- **Session management** with auto-refresh

### 📊 Business Modules
- **Dashboard** with KPIs and analytics
- **Finance Management** (Kasa & Banka)
- **Invoice Management** with PDF generation
- **Customer Management** (CRM)
- **Product/Service Catalog**
- **Deals & Opportunities** pipeline
- **Quotes Management**
- **Activity Tracking**

### 🎨 Modern UI/UX
- **Apple-inspired design** with clean aesthetics
- **Dark/Light mode** support
- **Fully responsive** for all screen sizes
- **Shadcn UI components** (Radix UI based)
- **Toast notifications** for user feedback
- **Loading states** and error boundaries
- **Smooth animations** and transitions

### 🛠️ Developer Experience
- **TypeScript** with strict typing
- **React 18** with latest features
- **Vite** for lightning-fast builds
- **TanStack Query** for data fetching and caching
- **React Hook Form + Zod** for form validation
- **ESLint** for code quality

## 🚀 Technology Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Next-generation build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - High-quality component library
- **TanStack Query** - Powerful data synchronization
- **React Router v6** - Client-side routing
- **React Hook Form** - Performant form handling
- **Zod** - Schema validation
- **Lucide React** - Beautiful icons
- **Recharts** - Composable charting library
- **date-fns** - Modern date utility library

### Backend
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Robust relational database
- **Edge Functions** - Serverless Deno functions
- **Row Level Security** - Database-level security
- **Real-time subscriptions** - Live data updates

### DevOps & Tools
- **Git** - Version control
- **npm** - Package management
- **ESLint** - Code linting
- **PostCSS** - CSS processing

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Git

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd ERM-DASHBOARD
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run database migrations**

Execute the SQL migrations in order:
- `database/migrations/001_subscription_system.sql`
- `database/migrations/002_enforce_company_plans.sql`
- `database/migrations/003_system_errors_table.sql`

See `database/migrations/000_MIGRATION_ORDER.md` for detailed instructions.

5. **Deploy Edge Functions**

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-reset-password
```

6. **Start development server**

```bash
npm run dev
```

Application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## 📁 Project Structure

```
ERM-DASHBOARD/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Shadcn UI components
│   │   ├── admin/          # Admin-specific components
│   │   ├── forms/          # Form components
│   │   ├── layout/         # Layout components
│   │   └── modals/         # Modal dialogs
│   ├── contexts/           # React contexts
│   │   ├── AuthContext.tsx
│   │   ├── TenantContext.tsx
│   │   └── PermissionsContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useQuotaGuard.ts
│   │   ├── useSupabaseQuery.ts
│   │   └── useSubscription.ts
│   ├── lib/                # Utilities and configurations
│   ├── pages/              # Page components
│   │   ├── admin/          # Admin pages
│   │   └── ...             # Business module pages
│   ├── constants/          # Constants and configurations
│   └── types/              # TypeScript type definitions
├── database/
│   └── migrations/         # SQL migration files
├── supabase/
│   └── functions/          # Edge Functions
│       ├── admin-create-user/
│       ├── admin-delete-user/
│       └── admin-reset-password/
└── public/                 # Static assets
```

## 🗄️ Database Schema

### Core Tables
- **profiles** - User profiles with company association
- **companies** - Multi-tenant company data
- **subscription_plans** - Available subscription tiers
- **company_usage** - Real-time quota tracking
- **system_errors** - Centralized error logging

### Business Tables
- **customers** - Customer/client management
- **products** - Product and service catalog
- **invoices** - Invoice records
- **invoice_items** - Invoice line items
- **transactions** - Financial transactions
- **deals** - Sales opportunities
- **quotes** - Quote management
- **activities** - Activity tracking
- **activity_logs** - System activity audit trail

### Permission Tables
- **company_permissions** - Module-level permissions per company
- **permission_templates** - Reusable permission sets

## 🔐 Security Features

- **Row Level Security (RLS)** on all tables
- **JWT-based authentication** with Supabase Auth
- **Role-based access control** (Superadmin, Admin, User)
- **Module-level permissions** for granular access
- **Secure Edge Functions** with authorization checks
- **Error logging** for security monitoring
- **Session management** with auto-refresh
- **CORS configuration** for API security

## 🎨 Design System

### Colors
- **Primary:** Slate/Gray tones
- **Accents:** Blue, Orange, Green pastels
- **Dark Mode:** Full support with system preference detection

### Typography
- **Font Family:** Inter, System UI
- **Font Sizes:** Responsive scale from xs to 4xl
- **Font Weights:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Components
- **Border Radius:** 0.5rem (medium-large)
- **Shadows:** Subtle, minimal elevation
- **Spacing:** Generous whitespace for clarity
- **Animations:** Smooth transitions (200-300ms)

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get started in 5 minutes
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Migration Guide](database/migrations/000_MIGRATION_ORDER.md)** - Database setup
- **[Production Checklist](PRODUCTION_CHECKLIST.md)** - Pre-launch verification
- **[Subscription System](SUBSCRIPTION_SYSTEM_README.md)** - Quota management

## 🤝 Support

For support, please contact the development team or refer to the documentation.

## 🔮 Roadmap

### Phase 1 (Completed)
- ✅ Multi-tenant architecture
- ✅ Subscription & quota system
- ✅ RBAC & permissions
- ✅ Core business modules
- ✅ Error logging & monitoring

### Phase 2 (Planned)
- 🔄 English language support (i18n)
- 🔄 Mobile responsive improvements
- 🔄 PWA capabilities
- 🔄 Advanced reporting
- 🔄 Export functionality
- 🔄 Bulk operations
- 🔄 Real-time notifications

### Phase 3 (Future)
- 📱 Native mobile apps
- 🌍 Multi-language support
- 📊 Advanced analytics
- 🔗 Third-party integrations
- 🤖 AI-powered features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with modern technologies and best practices for enterprise-grade applications.

---

**Made with ❤️ for businesses worldwide**
