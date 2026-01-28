-- =====================================================
-- MASTER BRAIN PANEL: COMPLETE DATABASE ARCHITECTURE
-- =====================================================
-- Version: 2.0
-- Date: 2025-01-01
-- Description: Complete SQL migration for professional
-- SaaS administration suite with RBAC, storage, and
-- enhanced user/company management.
-- =====================================================

-- =====================================================
-- PART 1: TABLE SCHEMA UPDATES
-- =====================================================

-- Add logo_url and is_active to companies table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN logo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add is_blocked to profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_blocked'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.logo_url IS 'URL to company logo stored in Supabase Storage (company-logos bucket)';
COMMENT ON COLUMN public.companies.is_active IS 'Whether the company is active and users can access the system';
COMMENT ON COLUMN public.profiles.is_blocked IS 'Whether the user account is blocked from accessing the system';

-- =====================================================
-- PART 2: RBAC PERMISSIONS TABLE
-- =====================================================

-- Create role_permissions table for granular module-level access control
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'user')),
  module_key TEXT NOT NULL CHECK (module_key IN (
    'dashboard',
    'finance',
    'customers',
    'invoices',
    'quotes',
    'products',
    'deals',
    'activities',
    'accounts',
    'settings'
  )),
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, role_name, module_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_role 
  ON public.role_permissions(company_id, role_name);

CREATE INDEX IF NOT EXISTS idx_role_permissions_module 
  ON public.role_permissions(module_key);

-- Add table comment
COMMENT ON TABLE public.role_permissions IS 'Granular RBAC permissions for company roles and modules';

-- =====================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Superadmins can manage all role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can view their company permissions" ON public.role_permissions;

-- Superadmins can manage all permissions
CREATE POLICY "Superadmins can manage all role permissions"
  ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- Admins can view permissions for their own company
CREATE POLICY "Admins can view their company permissions"
  ON public.role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.company_id = role_permissions.company_id
    )
  );

-- =====================================================
-- PART 4: SUPABASE STORAGE BUCKET SETUP
-- =====================================================

-- Create company-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Public read access for company logos" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can manage company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload their company logo" ON storage.objects;

-- Public read access for company logos
CREATE POLICY "Public read access for company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Superadmins can upload/update/delete company logos
CREATE POLICY "Superadmins can manage company logos"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- Admins can upload logos for their own company
CREATE POLICY "Admins can upload their company logo"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- PART 5: HELPER FUNCTIONS FOR RBAC
-- =====================================================

-- Function to check if a user has permission for a specific module
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_module_key TEXT,
  p_permission_type TEXT -- 'view' or 'edit'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_has_permission BOOLEAN;
  v_is_blocked BOOLEAN;
BEGIN
  -- Get user's role, company, and blocked status
  SELECT role, company_id, is_blocked 
  INTO v_role, v_company_id, v_is_blocked
  FROM public.profiles
  WHERE id = p_user_id;

  -- Blocked users have no permissions
  IF v_is_blocked THEN
    RETURN false;
  END IF;

  -- Superadmins have all permissions
  IF v_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- If no company assigned, deny access
  IF v_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if company is active
  IF NOT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = v_company_id AND is_active = true
  ) THEN
    RETURN false;
  END IF;

  -- Check permission in role_permissions table
  IF p_permission_type = 'view' THEN
    SELECT COALESCE(can_view, true) INTO v_has_permission
    FROM public.role_permissions
    WHERE company_id = v_company_id
      AND role_name = v_role
      AND module_key = p_module_key;
  ELSIF p_permission_type = 'edit' THEN
    SELECT COALESCE(can_edit, false) INTO v_has_permission
    FROM public.role_permissions
    WHERE company_id = v_company_id
      AND role_name = v_role
      AND module_key = p_module_key;
  ELSE
    RETURN false;
  END IF;

  -- If no explicit permission set, use role-based defaults
  IF v_has_permission IS NULL THEN
    IF v_role = 'admin' THEN
      RETURN true; -- Admins have access by default
    ELSE
      RETURN p_permission_type = 'view'; -- Users can view by default, not edit
    END IF;
  END IF;

  RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION public.user_has_permission IS 'Check if a user has view/edit permission for a module (respects is_blocked and is_active)';

-- =====================================================
-- PART 6: PERMISSION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to get all permissions for a company (for the permission matrix UI)
CREATE OR REPLACE FUNCTION public.get_company_permissions(p_company_id UUID)
RETURNS TABLE (
  role_name TEXT,
  module_key TEXT,
  can_view BOOLEAN,
  can_edit BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Only superadmins and admins of the company can view permissions
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (
        role = 'superadmin'
        OR (role = 'admin' AND company_id = p_company_id)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins and company admins can view permissions';
  END IF;

  RETURN QUERY
  SELECT rp.role_name, rp.module_key, rp.can_view, rp.can_edit
  FROM public.role_permissions rp
  WHERE rp.company_id = p_company_id
  ORDER BY rp.role_name, rp.module_key;
END;
$$;

COMMENT ON FUNCTION public.get_company_permissions IS 'Get all permissions for a company (for admin UI)';

-- Function to bulk update permissions (for the permission matrix UI)
CREATE OR REPLACE FUNCTION public.update_company_permissions(
  p_company_id UUID,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_permission JSONB;
BEGIN
  -- Only superadmins can update permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins can update permissions';
  END IF;

  -- Validate company exists and is valid
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Loop through permissions and upsert
  FOR v_permission IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    INSERT INTO public.role_permissions (
      company_id,
      role_name,
      module_key,
      can_view,
      can_edit
    )
    VALUES (
      p_company_id,
      v_permission->>'role_name',
      v_permission->>'module_key',
      (v_permission->>'can_view')::BOOLEAN,
      (v_permission->>'can_edit')::BOOLEAN
    )
    ON CONFLICT (company_id, role_name, module_key)
    DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      updated_at = now();
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.update_company_permissions IS 'Bulk update permissions for a company (for admin UI)';

-- =====================================================
-- PART 7: DEFAULT PERMISSION SEEDING
-- =====================================================

-- Function to seed default permissions for a new company
CREATE OR REPLACE FUNCTION public.seed_default_permissions(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_modules TEXT[] := ARRAY[
    'dashboard',
    'finance',
    'customers',
    'invoices',
    'quotes',
    'products',
    'deals',
    'activities',
    'accounts',
    'settings'
  ];
  v_module TEXT;
BEGIN
  FOREACH v_module IN ARRAY v_modules
  LOOP
    -- Admin permissions (full access)
    INSERT INTO public.role_permissions (company_id, role_name, module_key, can_view, can_edit)
    VALUES (p_company_id, 'admin', v_module, true, true)
    ON CONFLICT (company_id, role_name, module_key) DO NOTHING;

    -- User permissions (view-only for sensitive modules)
    INSERT INTO public.role_permissions (company_id, role_name, module_key, can_view, can_edit)
    VALUES (
      p_company_id,
      'user',
      v_module,
      true,
      CASE
        WHEN v_module IN ('finance', 'settings') THEN false
        ELSE true
      END
    )
    ON CONFLICT (company_id, role_name, module_key) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.seed_default_permissions IS 'Seed default permissions for a new company';

-- =====================================================
-- PART 8: AUTOMATIC TRIGGERS
-- =====================================================

-- Trigger to auto-seed permissions when a new company is created
CREATE OR REPLACE FUNCTION public.trigger_seed_company_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.seed_default_permissions(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_seed_permissions ON public.companies;

CREATE TRIGGER on_company_created_seed_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_company_permissions();

-- Trigger to auto-update updated_at on role_permissions
CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_permissions_updated_at ON public.role_permissions;

CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_updated_at();

-- =====================================================
-- PART 9: SEED EXISTING COMPANIES
-- =====================================================

-- Seed permissions for all existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM public.companies
  LOOP
    PERFORM public.seed_default_permissions(company_record.id);
  END LOOP;
END;
$$;

-- =====================================================
-- PART 10: VALIDATION & HEALTH CHECK
-- =====================================================

-- Verify all required columns exist
DO $$
BEGIN
  -- Check companies table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'logo_url'
  ) THEN
    RAISE EXCEPTION 'Migration failed: companies.logo_url column not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'Migration failed: companies.is_active column not created';
  END IF;

  -- Check profiles table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_blocked'
  ) THEN
    RAISE EXCEPTION 'Migration failed: profiles.is_blocked column not created';
  END IF;

  -- Check role_permissions table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'role_permissions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: role_permissions table not created';
  END IF;

  -- Check storage bucket
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'company-logos'
  ) THEN
    RAISE EXCEPTION 'Migration failed: company-logos storage bucket not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully! All validations passed.';
END;
$$;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================

-- Display migration summary
DO $$
DECLARE
  v_companies_count INTEGER;
  v_permissions_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_companies_count FROM public.companies;
  SELECT COUNT(*) INTO v_permissions_count FROM public.role_permissions;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MASTER BRAIN MIGRATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Companies: % (all seeded with default permissions)', v_companies_count;
  RAISE NOTICE 'Permissions: % records created', v_permissions_count;
  RAISE NOTICE 'Profiles: %', v_profiles_count;
  RAISE NOTICE 'Storage Bucket: company-logos (5MB limit, public read)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update TypeScript types in src/types/database.ts';
  RAISE NOTICE '2. Implement frontend RBAC checks using user_has_permission()';
  RAISE NOTICE '3. Build permission matrix UI using get/update_company_permissions()';
  RAISE NOTICE '4. Implement logo upload to company-logos bucket';
  RAISE NOTICE '========================================';
END;
$$;
