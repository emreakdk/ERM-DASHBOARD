-- =====================================================
-- PHASE 2: Enforce Company Plans & Default Assignment
-- =====================================================
-- Bu migration'ı Supabase SQL Editor'de çalıştırın
-- Önce 001_subscription_system.sql'in çalıştırıldığından emin olun

-- 1. Mevcut şirketlere varsayılan plan ata
-- =====================================================
-- Önce 'Temel Plan' ID'sini alalım ve plan olmayan şirketlere atayalım
DO $$
DECLARE
  basic_plan_id UUID;
BEGIN
  -- Temel Plan ID'sini al
  SELECT id INTO basic_plan_id
  FROM public.subscription_plans
  WHERE name = 'basic'
  LIMIT 1;

  -- Eğer Temel Plan varsa, plan_id NULL olan tüm şirketlere ata
  IF basic_plan_id IS NOT NULL THEN
    UPDATE public.companies
    SET 
      plan_id = basic_plan_id,
      subscription_status = 'trial',
      is_trial = true,
      trial_ends_at = now() + INTERVAL '30 days',
      subscription_started_at = now()
    WHERE plan_id IS NULL;
    
    RAISE NOTICE 'Varsayılan plan atandı: % şirket güncellendi', 
      (SELECT COUNT(*) FROM public.companies WHERE plan_id = basic_plan_id);
  ELSE
    RAISE WARNING 'Temel Plan bulunamadı! Lütfen önce 001_subscription_system.sql çalıştırın.';
  END IF;
END $$;

-- 2. plan_id kolonunu NOT NULL yap (artık tüm şirketlerin planı var)
-- =====================================================
-- Önce constraint varsa kaldır
ALTER TABLE public.companies 
  DROP CONSTRAINT IF EXISTS companies_plan_id_fkey;

-- plan_id'yi NOT NULL yap
ALTER TABLE public.companies 
  ALTER COLUMN plan_id SET NOT NULL;

-- Foreign key constraint'i tekrar ekle
ALTER TABLE public.companies
  ADD CONSTRAINT companies_plan_id_fkey 
  FOREIGN KEY (plan_id) 
  REFERENCES public.subscription_plans(id) 
  ON DELETE RESTRICT; -- Plan silinirse şirket silinmesin, hata versin

-- 3. Yeni şirket oluşturulduğunda otomatik plan ataması
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_default_plan_to_company()
RETURNS TRIGGER AS $$
DECLARE
  basic_plan_id UUID;
BEGIN
  -- Eğer plan_id belirtilmemişse, Temel Plan'ı ata
  IF NEW.plan_id IS NULL THEN
    SELECT id INTO basic_plan_id
    FROM public.subscription_plans
    WHERE name = 'basic' AND is_active = true
    LIMIT 1;
    
    IF basic_plan_id IS NOT NULL THEN
      NEW.plan_id := basic_plan_id;
      NEW.subscription_status := 'trial';
      NEW.is_trial := true;
      NEW.trial_ends_at := now() + INTERVAL '30 days';
      NEW.subscription_started_at := now();
    ELSE
      RAISE EXCEPTION 'Varsayılan plan bulunamadı. Lütfen sistem yöneticinizle iletişime geçin.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_assign_default_plan ON public.companies;
CREATE TRIGGER trigger_assign_default_plan
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_plan_to_company();

-- 4. Kota kontrol fonksiyonunu güncelle (plan yoksa varsayılan limitleri kullan)
-- =====================================================
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
    COALESCE(sp.features, '{}'::jsonb) as features
  INTO company_plan
  FROM public.companies c
  LEFT JOIN public.subscription_plans sp ON c.plan_id = sp.id
  WHERE c.id = company_uuid;
  
  -- Şirket bulunamadıysa
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'company_not_found',
      'message', 'Şirket bulunamadı'
    );
  END IF;
  
  -- Plan yoksa (bu artık olmamalı ama güvenlik için)
  IF company_plan.plan_id IS NULL THEN
    -- Varsayılan Temel Plan limitlerini kullan
    CASE resource_type
      WHEN 'users' THEN max_limit := 3;
      WHEN 'invoices' THEN max_limit := 100;
      WHEN 'customers' THEN max_limit := 100;
      WHEN 'products' THEN max_limit := 50;
      WHEN 'deals' THEN max_limit := 20;
      WHEN 'quotes' THEN max_limit := 50;
      ELSE max_limit := 10;
    END CASE;
  ELSE
    -- Planın limitlerini kullan
    max_limit := (company_plan.features->('max_' || resource_type))::INTEGER;
  END IF;
  
  -- Mevcut kullanımı al
  current_usage := public.get_company_usage_stats(company_uuid);
  current_count := COALESCE((current_usage->>resource_type)::INTEGER, 0);
  
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

-- 5. Kullanım istatistikleri fonksiyonunu iyileştir
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_company_usage_stats(company_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'users', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE company_id = company_uuid), 0),
    'invoices', COALESCE((SELECT COUNT(*) FROM public.invoices WHERE company_id = company_uuid), 0),
    'customers', COALESCE((SELECT COUNT(*) FROM public.customers WHERE company_id = company_uuid), 0),
    'products', COALESCE((SELECT COUNT(*) FROM public.products WHERE company_id = company_uuid), 0),
    'deals', COALESCE((SELECT COUNT(*) FROM public.deals WHERE company_id = company_uuid), 0),
    'quotes', COALESCE((SELECT COUNT(*) FROM public.quotes WHERE company_id = company_uuid), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 6. Master Brain için gelişmiş company overview
-- =====================================================
DROP VIEW IF EXISTS public.master_brain_company_overview;
CREATE OR REPLACE VIEW public.master_brain_company_overview AS
SELECT 
  c.id,
  c.name,
  c.logo_url,
  c.is_active,
  c.is_trial,
  c.subscription_status,
  c.trial_ends_at,
  c.subscription_ends_at,
  c.subscription_started_at,
  c.last_payment_date,
  c.next_payment_date,
  c.plan_id,
  sp.name as plan_name,
  sp.display_name as plan_display_name,
  sp.price as plan_price,
  sp.currency as plan_currency,
  sp.billing_period as plan_billing_period,
  sp.features as plan_features,
  (SELECT COUNT(*) FROM public.profiles WHERE company_id = c.id) as user_count,
  (SELECT COUNT(*) FROM public.invoices WHERE company_id = c.id) as invoice_count,
  (SELECT COUNT(*) FROM public.customers WHERE company_id = c.id) as customer_count,
  (SELECT COUNT(*) FROM public.products WHERE company_id = c.id) as product_count,
  c.created_at,
  c.updated_at
FROM public.companies c
INNER JOIN public.subscription_plans sp ON c.plan_id = sp.id;

-- View için RLS
ALTER VIEW public.master_brain_company_overview SET (security_invoker = on);

-- 7. Yardımcı fonksiyon: Şirketin planını değiştir
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_company_plan(
  company_uuid UUID,
  new_plan_id UUID,
  admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_plan_name TEXT;
  new_plan_name TEXT;
  result JSONB;
BEGIN
  -- Eski plan adını al
  SELECT sp.display_name INTO old_plan_name
  FROM public.companies c
  LEFT JOIN public.subscription_plans sp ON c.plan_id = sp.id
  WHERE c.id = company_uuid;
  
  -- Yeni plan adını al
  SELECT display_name INTO new_plan_name
  FROM public.subscription_plans
  WHERE id = new_plan_id;
  
  IF new_plan_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Geçersiz plan ID'
    );
  END IF;
  
  -- Planı güncelle
  UPDATE public.companies
  SET 
    plan_id = new_plan_id,
    subscription_status = 'active',
    is_trial = false,
    subscription_started_at = now(),
    updated_at = now()
  WHERE id = company_uuid;
  
  -- Activity log ekle
  INSERT INTO public.activity_logs (
    company_id,
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    company_uuid,
    admin_user_id,
    'update',
    'company_plan',
    company_uuid,
    format('Plan değiştirildi: %s → %s', COALESCE(old_plan_name, 'Yok'), new_plan_name),
    jsonb_build_object(
      'old_plan', old_plan_name,
      'new_plan', new_plan_name,
      'new_plan_id', new_plan_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'old_plan', old_plan_name,
    'new_plan', new_plan_name
  );
END;
$$;

-- 8. İstatistikler ve yorumlar
-- =====================================================
COMMENT ON COLUMN public.companies.plan_id IS 'Şirketin aktif abonelik planı (zorunlu)';
COMMENT ON FUNCTION public.assign_default_plan_to_company IS 'Yeni şirket oluşturulduğunda otomatik Temel Plan atar';
COMMENT ON FUNCTION public.update_company_plan IS 'Master Brain için şirket planını günceller ve log kaydı oluşturur';

-- Migration tamamlandı
DO $$
BEGIN
  RAISE NOTICE '✓ Migration 002 başarıyla tamamlandı';
  RAISE NOTICE '✓ Tüm şirketlere plan atandı';
  RAISE NOTICE '✓ plan_id artık zorunlu';
  RAISE NOTICE '✓ Yeni şirketler otomatik Temel Plan alacak';
END $$;
