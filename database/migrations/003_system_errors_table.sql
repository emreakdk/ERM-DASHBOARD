-- Migration: System Errors Table
-- Description: Create system_errors table for centralized error logging
-- Date: 2025-01-06

-- Create system_errors table
CREATE TABLE IF NOT EXISTS public.system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  source TEXT NOT NULL, -- 'edge_function', 'frontend', 'database', etc.
  function_name TEXT, -- Edge function name if applicable
  severity TEXT NOT NULL DEFAULT 'error', -- 'info', 'warning', 'error', 'critical'
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_errors_company_id ON public.system_errors(company_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_user_id ON public.system_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON public.system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON public.system_errors(severity);
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved ON public.system_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_system_errors_source ON public.system_errors(source);

-- Enable RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Superadmins can view all system errors" ON public.system_errors;
DROP POLICY IF EXISTS "Company admins can view their company errors" ON public.system_errors;
DROP POLICY IF EXISTS "Service role can insert system errors" ON public.system_errors;
DROP POLICY IF EXISTS "Admins can update error resolution" ON public.system_errors;

-- RLS Policies
-- Superadmins can view all errors
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

-- Company admins can view their company's errors
CREATE POLICY "Company admins can view their company errors"
  ON public.system_errors
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Service role can insert errors (for Edge Functions)
CREATE POLICY "Service role can insert system errors"
  ON public.system_errors
  FOR INSERT
  WITH CHECK (true);

-- Admins can update error resolution status
CREATE POLICY "Admins can update error resolution"
  ON public.system_errors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.system_errors TO authenticated;
GRANT ALL ON public.system_errors TO service_role;

-- Add comment
COMMENT ON TABLE public.system_errors IS 'Centralized error logging table for system-wide error tracking';
