-- =====================================================
-- PHASE 1: SaaS Subscription & Quota System Migration
-- =====================================================
-- Bu migration'ı Supabase SQL Editor'de çalıştırın

-- 1. SUBSCRIPTION PLANS TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'Basic', 'Pro', 'Unlimited'
  display_name TEXT NOT NULL, -- Türkçe görünen isim
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  billing_period TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  
  -- JSONB ile esnek limit yapısı
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Örnek features yapısı:
  -- {
  --   "max_users": 5,
  --   "max_invoices": 100,
  --   "max_customers": 500,
  --   "max_products": 200,
  --   "max_deals": 50,
  --   "max_quotes": 100,
  --   "max_storage_mb": 1000,
  --   "modules": {
  --     "finance": true,
  --     "invoices": true,
  --     "customers": true,
  --     "products": true,
  --     "quotes": true,
  --     "deals": true,
  --     "accounts": true,
  --     "reports": false,
  --     "api_access": false
  --   }
  -- }
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort ON public.subscription_plans(sort_order);

-- RLS Policies
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Politika çakışmalarını önlemek için önce sil
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Only master_brain can manage plans" ON public.subscription_plans;

-- Herkes okuyabilir (plan seçimi için)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Sadece master_brain kullanıcıları düzenleyebilir
CREATE POLICY "Only master_brain can manage plans"
  ON public.subscription_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_brain'
    )
  );

-- 2. COMPANIES TABLOSUNA YENİ KOLONLAR
-- =====================================================
-- Profiller tablosunda company_id yoksa ekleyelim (policy'ler için gerekli)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'suspended', 'cancelled'
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMPTZ;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_companies_plan ON public.companies(plan_id);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON public.companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_trial ON public.companies(is_trial);

-- 3. ACTIVITY LOGS İYİLEŞTİRMELERİ
-- =====================================================
-- Eğer activity_logs tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout', etc.
  entity_type TEXT NOT NULL, -- 'invoice', 'customer', 'product', 'user', etc.
  entity_id UUID,
  
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mevcut tablo varsa eksik kolonları garanti altına al
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
  ) THEN
    -- company_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'company_id'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    -- user_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- action
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'action'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN action TEXT NOT NULL DEFAULT 'custom';
    END IF;

    -- entity_type
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'entity_type'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'general';
    END IF;

    -- entity_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'entity_id'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN entity_id UUID;
    END IF;

    -- description
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'description'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN description TEXT NOT NULL DEFAULT 'Aktivite kaydı';
    END IF;

    -- metadata
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'metadata'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- ip_address
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'ip_address'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN ip_address INET;
    END IF;

    -- user_agent
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'user_agent'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN user_agent TEXT;
    END IF;

    -- created_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
        AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.activity_logs
        ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
  END IF;
END$$;

-- Full-text search için GIN index
CREATE INDEX IF NOT EXISTS idx_activity_logs_description_gin 
  ON public.activity_logs USING gin(to_tsvector('turkish', description));

-- Diğer index'ler
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created 
  ON public.activity_logs(company_id, created_at DESC);

-- RLS Policies
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Politika çakışmalarını önlemek için önce sil
DROP POLICY IF EXISTS "Users can view own company logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Master brain can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;

-- Kullanıcılar sadece kendi şirketlerinin loglarını görebilir
CREATE POLICY "Users can view own company logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Master brain tüm logları görebilir
CREATE POLICY "Master brain can view all logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master_brain'
    )
  );

-- Sistem logları ekleyebilir
CREATE POLICY "System can insert logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- 4. VARSAYILAN PLANLAR EKLEME
-- =====================================================
INSERT INTO public.subscription_plans (name, display_name, description, price, currency, billing_period, features, sort_order, is_featured)
VALUES 
  (
    'basic',
    'Temel Plan',
    'Küçük işletmeler için ideal başlangıç paketi',
    99.00,
    'TRY',
    'monthly',
    '{
      "max_users": 3,
      "max_invoices": 100,
      "max_customers": 100,
      "max_products": 50,
      "max_deals": 20,
      "max_quotes": 50,
      "max_storage_mb": 500,
      "modules": {
        "finance": true,
        "invoices": true,
        "customers": true,
        "products": true,
        "quotes": true,
        "deals": false,
        "accounts": true,
        "reports": false,
        "api_access": false
      }
    }'::jsonb,
    1,
    false
  ),
  (
    'pro',
    'Profesyonel Plan',
    'Büyüyen işletmeler için gelişmiş özellikler',
    299.00,
    'TRY',
    'monthly',
    '{
      "max_users": 10,
      "max_invoices": 500,
      "max_customers": 1000,
      "max_products": 500,
      "max_deals": 100,
      "max_quotes": 200,
      "max_storage_mb": 5000,
      "modules": {
        "finance": true,
        "invoices": true,
        "customers": true,
        "products": true,
        "quotes": true,
        "deals": true,
        "accounts": true,
        "reports": true,
        "api_access": false
      }
    }'::jsonb,
    2,
    true
  ),
  (
    'unlimited',
    'Sınırsız Plan',
    'Kurumsal işletmeler için limitsiz kullanım',
    999.00,
    'TRY',
    'monthly',
    '{
      "max_users": -1,
      "max_invoices": -1,
      "max_customers": -1,
      "max_products": -1,
      "max_deals": -1,
      "max_quotes": -1,
      "max_storage_mb": -1,
      "modules": {
        "finance": true,
        "invoices": true,
        "customers": true,
        "products": true,
        "quotes": true,
        "deals": true,
        "accounts": true,
        "reports": true,
        "api_access": true
      }
    }'::jsonb,
    3,
    false
  )
ON CONFLICT (name) DO NOTHING;

-- 5. YARDIMCI FONKSIYONLAR
-- =====================================================

-- Önce eski fonksiyonları sil
DROP FUNCTION IF EXISTS public.get_company_usage_stats(UUID);
DROP FUNCTION IF EXISTS public.check_company_quota(UUID, TEXT);

-- Şirketin mevcut kullanım istatistiklerini getir
CREATE OR REPLACE FUNCTION public.get_company_usage_stats(company_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM public.profiles WHERE company_id = company_uuid),
    'invoices', (SELECT COUNT(*) FROM public.invoices WHERE company_id = company_uuid),
    'customers', (SELECT COUNT(*) FROM public.customers WHERE company_id = company_uuid),
    'products', (SELECT COUNT(*) FROM public.products WHERE company_id = company_uuid),
    'deals', (SELECT COUNT(*) FROM public.deals WHERE company_id = company_uuid),
    'quotes', (SELECT COUNT(*) FROM public.quotes WHERE company_id = company_uuid)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Şirketin plan limitlerini kontrol et
CREATE OR REPLACE FUNCTION public.check_company_quota(
  company_uuid UUID,
  resource_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_plan RECORD;
  current_usage JSONB;
  max_limit INTEGER;
  current_count INTEGER;
  result JSONB;
BEGIN
  -- Şirketin planını al
  SELECT 
    c.plan_id,
    c.subscription_status,
    c.is_trial,
    sp.features
  INTO company_plan
  FROM public.companies c
  LEFT JOIN public.subscription_plans sp ON c.plan_id = sp.id
  WHERE c.id = company_uuid;
  
  -- Plan yoksa veya trial süresi dolmuşsa
  IF company_plan.plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_plan',
      'message', 'Lütfen bir abonelik planı seçin'
    );
  END IF;
  
  -- Mevcut kullanımı al
  current_usage := public.get_company_usage_stats(company_uuid);
  
  -- Resource type'a göre limit kontrolü
  max_limit := (company_plan.features->('max_' || resource_type))::INTEGER;
  current_count := (current_usage->>resource_type)::INTEGER;
  
  -- -1 sınırsız demek
  IF max_limit = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'unlimited', true,
      'current', current_count
    );
  END IF;
  
  -- Limit kontrolü
  IF current_count >= max_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'message', 'Plan limitinize ulaştınız. Lütfen planınızı yükseltin.',
      'current', current_count,
      'limit', max_limit
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current', current_count,
    'limit', max_limit,
    'remaining', max_limit - current_count
  );
END;
$$;

-- Updated_at trigger için fonksiyon
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ekle
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. MASTER BRAIN İÇİN ÖZEL VIEW
-- =====================================================
DROP VIEW IF EXISTS public.master_brain_company_overview;
CREATE OR REPLACE VIEW public.master_brain_company_overview AS
SELECT 
  c.id,
  c.name,
  c.is_active,
  c.is_trial,
  c.subscription_status,
  c.trial_ends_at,
  c.subscription_ends_at,
  sp.name as plan_name,
  sp.display_name as plan_display_name,
  sp.price as plan_price,
  (SELECT COUNT(*) FROM public.profiles WHERE company_id = c.id) as user_count,
  (SELECT COUNT(*) FROM public.invoices WHERE company_id = c.id) as invoice_count,
  (SELECT COUNT(*) FROM public.customers WHERE company_id = c.id) as customer_count,
  c.created_at,
  c.updated_at
FROM public.companies c
LEFT JOIN public.subscription_plans sp ON c.plan_id = sp.id;

-- View için RLS
ALTER VIEW public.master_brain_company_overview SET (security_invoker = on);

COMMENT ON TABLE public.subscription_plans IS 'SaaS abonelik planları ve özellikleri';
COMMENT ON TABLE public.activity_logs IS 'Sistem aktivite logları - full-text search destekli';
COMMENT ON COLUMN public.companies.plan_id IS 'Şirketin aktif abonelik planı';
COMMENT ON COLUMN public.companies.is_trial IS 'Şirket trial döneminde mi?';
COMMENT ON FUNCTION public.get_company_usage_stats IS 'Şirketin mevcut kaynak kullanım istatistikleri';
COMMENT ON FUNCTION public.check_company_quota IS 'Şirketin belirli bir kaynak için kota kontrolü';
