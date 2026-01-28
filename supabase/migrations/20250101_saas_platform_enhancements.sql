-- =====================================================
-- SaaS Platform Enhancements Migration
-- Created: 2025-01-01
-- Description: Comprehensive migration for commercial SaaS features
-- =====================================================

-- =====================================================
-- PART 1: System Error Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_source TEXT,
  request_path TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_system_errors_created_at ON public.system_errors(created_at DESC);
CREATE INDEX idx_system_errors_error_code ON public.system_errors(error_code);
CREATE INDEX idx_system_errors_user_id ON public.system_errors(user_id);

-- RLS Policies for system_errors (only superadmins can view)
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all system errors"
  ON public.system_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "System can insert errors"
  ON public.system_errors
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.system_errors IS 'Stores system-wide errors from Edge Functions and API calls for monitoring';

-- =====================================================
-- PART 2: Company Quotas
-- =====================================================
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS invoice_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS user_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS transaction_limit INTEGER DEFAULT 10000;

COMMENT ON COLUMN public.companies.invoice_limit IS 'Maximum number of invoices this company can create';
COMMENT ON COLUMN public.companies.user_limit IS 'Maximum number of users this company can have';
COMMENT ON COLUMN public.companies.transaction_limit IS 'Maximum number of transactions this company can create';

-- =====================================================
-- PART 3: Enhanced Activity Logs
-- =====================================================
-- Add new columns to activity_logs
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS action_type TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migrate existing data: set actor_id from user_id, action_type as 'legacy', description from message
UPDATE public.activity_logs
SET 
  actor_id = user_id,
  action_type = 'legacy_action',
  description = message
WHERE actor_id IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

COMMENT ON COLUMN public.activity_logs.actor_id IS 'User who performed the action';
COMMENT ON COLUMN public.activity_logs.action_type IS 'Type of action performed (e.g., user_created, company_updated)';
COMMENT ON COLUMN public.activity_logs.description IS 'Human-readable description of the action';
COMMENT ON COLUMN public.activity_logs.metadata IS 'Additional context data in JSON format';

-- =====================================================
-- PART 4: User Impersonation Sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_impersonation_sessions_token ON public.impersonation_sessions(session_token);
CREATE INDEX idx_impersonation_sessions_superadmin ON public.impersonation_sessions(superadmin_id);
CREATE INDEX idx_impersonation_sessions_target ON public.impersonation_sessions(target_user_id);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage impersonation sessions"
  ON public.impersonation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

COMMENT ON TABLE public.impersonation_sessions IS 'Tracks superadmin impersonation sessions for security auditing';

-- =====================================================
-- PART 5: Helper Functions
-- =====================================================

-- Function to log activities programmatically
CREATE OR REPLACE FUNCTION public.log_activity(
  p_actor_id UUID,
  p_action_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    actor_id,
    action_type,
    description,
    message,
    metadata,
    created_at
  ) VALUES (
    p_actor_id,
    p_actor_id,
    p_action_type,
    p_description,
    p_description,
    p_metadata,
    now()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_activity IS 'Helper function to insert activity logs with proper structure';

-- Function to check company quota
CREATE OR REPLACE FUNCTION public.check_company_quota(
  p_company_id UUID,
  p_quota_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get the limit for the specified quota type
  CASE p_quota_type
    WHEN 'users' THEN
      SELECT user_limit INTO v_limit
      FROM public.companies
      WHERE id = p_company_id;
      
      SELECT COUNT(*) INTO v_current_count
      FROM public.profiles
      WHERE company_id = p_company_id;
      
    WHEN 'invoices' THEN
      SELECT invoice_limit INTO v_limit
      FROM public.companies
      WHERE id = p_company_id;
      
      SELECT COUNT(*) INTO v_current_count
      FROM public.invoices
      WHERE company_id = p_company_id;
      
    WHEN 'transactions' THEN
      SELECT transaction_limit INTO v_limit
      FROM public.companies
      WHERE id = p_company_id;
      
      SELECT COUNT(*) INTO v_current_count
      FROM public.transactions
      WHERE company_id = p_company_id;
      
    ELSE
      RETURN false;
  END CASE;
  
  -- Return true if under limit
  RETURN v_current_count < v_limit;
END;
$$;

COMMENT ON FUNCTION public.check_company_quota IS 'Checks if a company has reached its quota limit for a specific resource type';

-- Function to get company quota usage
CREATE OR REPLACE FUNCTION public.get_company_quota_usage(p_company_id UUID)
RETURNS TABLE (
  quota_type TEXT,
  current_usage INTEGER,
  quota_limit INTEGER,
  percentage_used NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH company_limits AS (
    SELECT 
      c.user_limit,
      c.invoice_limit,
      c.transaction_limit
    FROM public.companies c
    WHERE c.id = p_company_id
  ),
  usage_counts AS (
    SELECT
      (SELECT COUNT(*) FROM public.profiles WHERE company_id = p_company_id) as user_count,
      (SELECT COUNT(*) FROM public.invoices WHERE company_id = p_company_id) as invoice_count,
      (SELECT COUNT(*) FROM public.transactions WHERE company_id = p_company_id) as transaction_count
  )
  SELECT 'users'::TEXT, 
         usage_counts.user_count::INTEGER,
         company_limits.user_limit,
         ROUND((usage_counts.user_count::NUMERIC / NULLIF(company_limits.user_limit, 0)) * 100, 2)
  FROM company_limits, usage_counts
  UNION ALL
  SELECT 'invoices'::TEXT,
         usage_counts.invoice_count::INTEGER,
         company_limits.invoice_limit,
         ROUND((usage_counts.invoice_count::NUMERIC / NULLIF(company_limits.invoice_limit, 0)) * 100, 2)
  FROM company_limits, usage_counts
  UNION ALL
  SELECT 'transactions'::TEXT,
         usage_counts.transaction_count::INTEGER,
         company_limits.transaction_limit,
         ROUND((usage_counts.transaction_count::NUMERIC / NULLIF(company_limits.transaction_limit, 0)) * 100, 2)
  FROM company_limits, usage_counts;
END;
$$;

COMMENT ON FUNCTION public.get_company_quota_usage IS 'Returns quota usage statistics for a company';

-- =====================================================
-- PART 6: Enhanced RLS Policies for Company Admins
-- =====================================================

-- Allow company admins to manage users within their company
DROP POLICY IF EXISTS "Company admins can manage their company users" ON public.profiles;
CREATE POLICY "Company admins can manage their company users"
  ON public.profiles
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- Allow company admins to view and manage role_permissions for their company
DROP POLICY IF EXISTS "Company admins can manage their permissions" ON public.role_permissions;
CREATE POLICY "Company admins can manage their permissions"
  ON public.role_permissions
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- =====================================================
-- PART 7: Triggers for Activity Logging
-- =====================================================

-- Trigger function for user creation
CREATE OR REPLACE FUNCTION public.trigger_log_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.log_activity(
    NEW.id,
    'user_created',
    'Yeni kullanıcı oluşturuldu: ' || COALESCE(NEW.full_name, NEW.email),
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'role', NEW.role,
      'company_id', NEW.company_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_after_user_insert ON public.profiles;
CREATE TRIGGER trigger_after_user_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_log_user_created();

-- Trigger function for company updates
CREATE OR REPLACE FUNCTION public.trigger_log_company_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_active != NEW.is_active THEN
    PERFORM public.log_activity(
      auth.uid(),
      'company_status_changed',
      'Şirket durumu güncellendi: ' || NEW.name || ' -> ' || 
      CASE WHEN NEW.is_active THEN 'Aktif' ELSE 'Pasif' END,
      jsonb_build_object(
        'company_id', NEW.id,
        'company_name', NEW.name,
        'old_status', OLD.is_active,
        'new_status', NEW.is_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_after_company_update ON public.companies;
CREATE TRIGGER trigger_after_company_update
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_log_company_updated();

-- =====================================================
-- PART 8: Default Data
-- =====================================================

-- Set default quotas for existing companies
UPDATE public.companies
SET 
  invoice_limit = COALESCE(invoice_limit, 1000),
  user_limit = COALESCE(user_limit, 50),
  transaction_limit = COALESCE(transaction_limit, 10000)
WHERE invoice_limit IS NULL 
   OR user_limit IS NULL 
   OR transaction_limit IS NULL;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Run this migration with: supabase db push
-- Or manually in Supabase SQL Editor
