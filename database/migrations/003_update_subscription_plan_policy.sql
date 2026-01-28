-- 003_update_subscription_plan_policy.sql
-- Master Brain panelindeki plan yönetimi için RLS politikasını günceller.
-- Supabase SQL Editor'de çalıştırmayı unutmayın.

BEGIN;

-- Eski politikayı kaldır
DROP POLICY IF EXISTS "Only master_brain can manage plans" ON public.subscription_plans;

-- master_brain veya superadmin rollerinin bütün işlemleri yapabilmesi için yeni politika
CREATE POLICY "Master control can manage plans"
  ON public.subscription_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('master_brain', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('master_brain', 'superadmin')
    )
  );

COMMIT;
