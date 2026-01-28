-- ==========================================
-- ENVATO PROJECT SCHEMA - SUPABASE
-- ==========================================

-- 1. EXTENSIONS & HELPERS
-- ==========================================

-- Gerekli eklentileri aktif et
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Helper: get_current_user_id()
-- Auth ID'sini UUID formatında güvenli şekilde döndürür
CREATE OR REPLACE FUNCTION public.get_current_user_id() 
RETURNS uuid LANGUAGE sql STABLE AS $$ 
  SELECT NULLIF(auth.uid(), '')::uuid; 
$$;

-- Helper: get_user_company_id()
-- Mevcut kullanıcının company_id bilgisini profiles tablosundan çeker
CREATE OR REPLACE FUNCTION public.get_user_company_id() 
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ 
  SELECT p.company_id::uuid 
  FROM public.profiles p 
  WHERE p.id = public.get_current_user_id() 
  LIMIT 1; 
$$;

-- Güvenlik: Helper fonksiyonların dışarıdan direkt çalıştırılmasını engelle
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon, authenticated;

-- Helper: is_superadmin()
-- Kullanıcının 'superadmin' olup olmadığını kontrol eder
CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS boolean LANGUAGE sql STABLE AS $$ 
  SELECT (SELECT (p.role = 'superadmin') 
  FROM public.profiles p 
  WHERE p.id = public.get_current_user_id() 
  LIMIT 1) IS TRUE; 
$$;

-- ==========================================
-- 2. TABLES (Tablo Yaratımları)
-- ==========================================

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    name text UNIQUE, 
    display_name text, 
    description text, 
    price numeric DEFAULT 0, 
    currency text DEFAULT 'TRY', 
    billing_period text DEFAULT 'monthly', 
    features jsonb DEFAULT '{}'::jsonb, 
    is_active boolean DEFAULT true, 
    is_featured boolean DEFAULT false, 
    sort_order integer DEFAULT 0, 
    created_at timestamptz DEFAULT now(), 
    updated_at timestamptz DEFAULT now() 
);

-- Companies
CREATE TABLE IF NOT EXISTS public.companies ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    name text NOT NULL, 
    tax_number text, 
    website text, 
    created_at timestamptz DEFAULT utc_now(), 
    updated_at timestamptz DEFAULT utc_now(), 
    is_active boolean DEFAULT true, 
    logo_url text, 
    invoice_limit integer DEFAULT 1000, 
    user_limit integer DEFAULT 50, 
    transaction_limit integer DEFAULT 10000, 
    plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL, 
    is_trial boolean DEFAULT true, 
    trial_ends_at timestamptz, 
    subscription_status text DEFAULT 'trial', 
    subscription_started_at timestamptz, 
    subscription_ends_at timestamptz, 
    last_payment_date timestamptz, 
    next_payment_date timestamptz 
);

-- Profiles (Users)
CREATE TABLE IF NOT EXISTS public.profiles ( 
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, 
    email text UNIQUE, 
    full_name text, 
    company_name text, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    role text DEFAULT 'user' CHECK (role = ANY (ARRAY['superadmin','admin','user'])), 
    created_at timestamptz DEFAULT utc_now(), 
    updated_at timestamptz DEFAULT utc_now(), 
    is_blocked boolean DEFAULT false, 
    preferred_language text DEFAULT 'tr' CHECK (preferred_language = ANY (ARRAY['en','tr'])) 
);

-- Company Profiles (Display Info)
CREATE TABLE IF NOT EXISTS public.company_profiles ( 
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, 
    company_name text, 
    logo_url text, 
    contact_name text, 
    contact_email text, 
    contact_phone text, 
    address text, 
    website text 
);

-- Accounts (Bank/Cash)
CREATE TABLE IF NOT EXISTS public.accounts ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    name text, 
    type text CHECK (type = ANY (ARRAY['bank','cash','credit_card'])), 
    currency text CHECK (currency = ANY (ARRAY['TRY','USD','EUR'])), 
    balance numeric DEFAULT 0, 
    created_at timestamptz DEFAULT utc_now(), 
    updated_at timestamptz DEFAULT utc_now() 
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    name text, 
    type text CHECK (type = ANY (ARRAY['individual','corporate'])), 
    customer_status text DEFAULT 'customer' CHECK (customer_status = ANY (ARRAY['customer','lead'])), 
    email text, 
    phone text, 
    address text, 
    tax_number text, 
    tax_office text, 
    contact_person text, 
    created_at timestamptz DEFAULT utc_now(), 
    updated_at timestamptz DEFAULT utc_now() 
);

-- Customer Transactions
CREATE TABLE IF NOT EXISTS public.customer_transactions ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    transaction_type text CHECK (transaction_type = ANY (ARRAY['debt','credit'])), 
    source text DEFAULT 'manual', 
    amount numeric, 
    transaction_date date, 
    description text, 
    currency text DEFAULT 'TRY' 
);

-- Deals (CRM)
CREATE TABLE IF NOT EXISTS public.deals ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    title text, 
    value numeric, 
    stage text DEFAULT 'new' CHECK (stage = ANY (ARRAY['new','meeting','proposal','negotiation','won','lost'])), 
    expected_close_date date, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    name text, 
    type text CHECK (type = ANY (ARRAY['income','expense'])), 
    created_at timestamptz DEFAULT utc_now() 
);

-- Products/Services
CREATE TABLE IF NOT EXISTS public.products ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    name text, 
    description text, 
    unit_price numeric, 
    type text DEFAULT 'product' CHECK (type = ANY (ARRAY['service','product'])), 
    sku text, 
    stock_quantity numeric, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Transactions (Income/Expense)
CREATE TABLE IF NOT EXISTS public.transactions ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    type text CHECK (type = ANY (ARRAY['income','expense'])), 
    amount numeric, 
    category text, 
    payee text, 
    description text, 
    transaction_date date, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    bank_account text, 
    created_at timestamptz DEFAULT utc_now(), 
    updated_at timestamptz DEFAULT utc_now() 
);

-- Notes
CREATE TABLE IF NOT EXISTS public.notes ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    content text, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Attachments
CREATE TABLE IF NOT EXISTS public.attachments ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    file_name text, 
    file_url text, 
    file_type text, 
    file_size bigint, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Activities
CREATE TABLE IF NOT EXISTS public.activities ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    type text CHECK (type = ANY (ARRAY['task','meeting','call','email'])), 
    subject text, 
    description text, 
    due_date date, 
    is_completed boolean DEFAULT false, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Quotes
CREATE TABLE IF NOT EXISTS public.quotes ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    quote_number text, 
    issue_date date, 
    expiry_date date, 
    token text, 
    status text DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','sent','accepted','rejected','converted'])), 
    subtotal numeric DEFAULT 0, 
    tax_rate numeric DEFAULT 0, 
    tax_amount numeric DEFAULT 0, 
    total_amount numeric DEFAULT 0, 
    notes text, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, 
    description text, 
    quantity numeric, 
    unit_price numeric, 
    amount numeric, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, 
    invoice_number text, 
    invoice_date date, 
    due_date date, 
    status text DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','sent','pending','paid','cancelled'])), 
    subtotal numeric DEFAULT 0, 
    tax_amount numeric DEFAULT 0, 
    total_amount numeric DEFAULT 0, 
    notes text, 
    token text, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS public.invoice_items ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    description text, 
    quantity numeric, 
    unit_price numeric, 
    tax_rate numeric DEFAULT 0, 
    amount numeric, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL, 
    amount numeric, 
    payment_date date, 
    payment_method text, 
    notes text, 
    created_at timestamptz DEFAULT utc_now() 
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    message text, 
    created_at timestamptz DEFAULT utc_now(), 
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, 
    action_type text, 
    description text, 
    metadata jsonb DEFAULT '{}'::jsonb, 
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, 
    action text DEFAULT 'custom', 
    entity_type text DEFAULT 'general', 
    entity_id uuid, 
    ip_address inet, 
    user_agent text 
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS public.role_permissions ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
    role_name text CHECK (role_name = ANY (ARRAY['admin','user'])), 
    module_key text, 
    can_view boolean DEFAULT true, 
    can_edit boolean DEFAULT false, 
    created_at timestamptz DEFAULT now(), 
    updated_at timestamptz DEFAULT now() 
);

-- Audit Logs (Sensitive)
CREATE TABLE IF NOT EXISTS public.audit_logs ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    created_at timestamptz DEFAULT now(), 
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, 
    action_type text, 
    description text, 
    metadata jsonb 
);

-- System Errors
CREATE TABLE IF NOT EXISTS public.system_errors ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    error_code text, 
    error_message text, 
    error_source text, 
    request_path text, 
    user_id uuid, 
    metadata jsonb DEFAULT '{}'::jsonb, 
    created_at timestamptz DEFAULT now() 
);

-- Impersonation Sessions
CREATE TABLE IF NOT EXISTS public.impersonation_sessions ( 
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    superadmin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    session_token text UNIQUE, 
    expires_at timestamptz, 
    is_active boolean DEFAULT true, 
    created_at timestamptz DEFAULT now(), 
    ended_at timestamptz 
);

-- ==========================================
-- 3. INDEXES (Performans)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id); 
CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON public.companies(plan_id); 
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id); 
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id); 
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id); 
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id); 
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs(company_id); 
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_id ON public.role_permissions(company_id);

-- ==========================================
-- 4. RLS (Row Level Security)
-- ==========================================

-- Tabloları RLS'e aç
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES (Kurallar)

-- Companies
CREATE POLICY companies_superadmin_all ON public.companies FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY companies_tenant_access ON public.companies FOR ALL TO authenticated USING ( company_id IS NULL OR id = public.get_user_company_id() OR company_id = public.get_user_company_id() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Profiles
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated USING ( id = public.get_current_user_id() OR public.is_superadmin() ) WITH CHECK ( id = public.get_current_user_id() OR public.is_superadmin() );

-- Company Profiles
CREATE POLICY company_profiles_superadmin_all ON public.company_profiles FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY company_profiles_user ON public.company_profiles FOR ALL TO authenticated USING ( user_id = public.get_current_user_id() OR public.is_superadmin() ) WITH CHECK ( user_id = public.get_current_user_id() OR public.is_superadmin() );

-- Accounts
CREATE POLICY accounts_superadmin_all ON public.accounts FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY accounts_tenant ON public.accounts FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Customers
CREATE POLICY customers_superadmin_all ON public.customers FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY customers_tenant ON public.customers FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Customer Transactions
CREATE POLICY ctransactions_superadmin_all ON public.customer_transactions FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY ctransactions_tenant ON public.customer_transactions FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Deals
CREATE POLICY deals_superadmin_all ON public.deals FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY deals_tenant ON public.deals FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Categories
CREATE POLICY categories_superadmin_all ON public.categories FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY categories_tenant ON public.categories FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Products
CREATE POLICY products_superadmin_all ON public.products FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY products_tenant ON public.products FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Transactions
CREATE POLICY transactions_superadmin_all ON public.transactions FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY transactions_tenant ON public.transactions FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Notes
CREATE POLICY notes_superadmin_all ON public.notes FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY notes_tenant ON public.notes FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Attachments
CREATE POLICY attachments_superadmin_all ON public.attachments FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY attachments_tenant ON public.attachments FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Activities
CREATE POLICY activities_superadmin_all ON public.activities FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY activities_tenant ON public.activities FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Quotes
CREATE POLICY quotes_superadmin_all ON public.quotes FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY quotes_tenant ON public.quotes FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Quote Items
CREATE POLICY quote_items_superadmin_all ON public.quote_items FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY quote_items_tenant ON public.quote_items FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Invoices
CREATE POLICY invoices_superadmin_all ON public.invoices FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY invoices_tenant ON public.invoices FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Invoice Items
CREATE POLICY invoice_items_superadmin_all ON public.invoice_items FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY invoice_items_tenant ON public.invoice_items FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Payments
CREATE POLICY payments_superadmin_all ON public.payments FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY payments_tenant ON public.payments FOR ALL TO authenticated USING ( company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Role Permissions
CREATE POLICY role_permissions_superadmin_all ON public.role_permissions FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY role_permissions_tenant ON public.role_permissions FOR ALL TO authenticated USING ( company_id = public.get_user_company_id() OR public.is_superadmin() ) WITH CHECK ( public.is_superadmin() OR company_id = public.get_user_company_id() );

-- Activity Logs
CREATE POLICY activity_logs_superadmin_all ON public.activity_logs FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY activity_logs_tenant ON public.activity_logs FOR SELECT TO authenticated USING ( company_id IS NOT NULL AND company_id = public.get_user_company_id() );
CREATE POLICY activity_logs_insert ON public.activity_logs FOR INSERT TO authenticated WITH CHECK ( company_id = public.get_user_company_id() OR public.is_superadmin() );

-- Subscription Plans
CREATE POLICY subscription_plans_superadmin ON public.subscription_plans FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY subscription_plans_public_read ON public.subscription_plans FOR SELECT TO authenticated USING ( true );

-- Sensitive Tables (Superadmin Only)
REVOKE ALL ON public.audit_logs FROM PUBLIC; 
CREATE POLICY audit_logs_superadmin ON public.audit_logs FOR ALL TO authenticated USING ( public.is_superadmin() ) WITH CHECK ( public.is_superadmin() );

REVOKE ALL ON public.system_errors FROM PUBLIC; 
CREATE POLICY system_errors_superadmin ON public.system_errors FOR ALL TO authenticated USING ( public.is_superadmin() ) WITH CHECK ( public.is_superadmin() );

REVOKE ALL ON public.impersonation_sessions FROM PUBLIC; 
CREATE POLICY impersonation_sessions_superadmin ON public.impersonation_sessions FOR ALL TO authenticated USING ( public.is_superadmin() ) WITH CHECK ( public.is_superadmin() );

-- ==========================================
-- 5. FINAL GRANTS & SECURITY
-- ==========================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- Güvenlik: Helper fonksiyonlarını public'e kapat
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM PUBLIC; 
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;

-- ==========================================
-- İŞLEM TAMAMLANDI
-- ==========================================