-- =====================================================
-- MASTER BRAIN PANEL: RBAC & INFRASTRUCTURE MIGRATION
-- =====================================================
-- This migration creates the foundation for a professional
-- SaaS administration suite with granular permissions,
-- storage buckets, and enhanced user management.
-- =====================================================

-- =====================================================
-- PART 1: ROLE PERMISSIONS TABLE (RBAC Engine)
-- =====================================================

-- Create role_permissions table for granular module-level access control
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'user')),
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, role_name, module_key)
);

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_role 
  ON public.role_permissions(company_id, role_name);

-- Enable RLS on role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

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
-- PART 2: STORAGE BUCKET FOR COMPANY LOGOS
-- =====================================================

-- Create storage bucket for company logos (PNG/JPG uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on company-logos bucket
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
-- PART 3: HELPER FUNCTIONS FOR PERMISSION CHECKS
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
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_has_permission BOOLEAN;
BEGIN
  -- Get user's role and company
  SELECT role, company_id INTO v_role, v_company_id
  FROM public.profiles
  WHERE id = p_user_id;

  -- Superadmins have all permissions
  IF v_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- If no company assigned, deny access
  IF v_company_id IS NULL THEN
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

  -- If no explicit permission set, default based on role
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

-- =====================================================
-- PART 4: DEFAULT PERMISSION SEEDS
-- =====================================================

-- Function to seed default permissions for a company
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

-- =====================================================
-- PART 5: TRIGGER TO AUTO-SEED PERMISSIONS
-- =====================================================

-- Automatically seed permissions when a new company is created
CREATE OR REPLACE FUNCTION public.trigger_seed_company_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.seed_default_permissions(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created_seed_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_company_permissions();

-- =====================================================
-- PART 6: SEED EXISTING COMPANIES
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
-- PART 7: UPDATED_AT TRIGGER FOR role_permissions
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_updated_at();

-- =====================================================
-- PART 8: ADMIN API HELPER FUNCTIONS
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
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT rp.role_name, rp.module_key, rp.can_view, rp.can_edit
  FROM public.role_permissions rp
  WHERE rp.company_id = p_company_id
  ORDER BY rp.role_name, rp.module_key;
END;
$$;

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
    RAISE EXCEPTION 'Only superadmins can update permissions';
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

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE public.role_permissions IS 'Granular RBAC permissions for company roles and modules';
COMMENT ON FUNCTION public.user_has_permission IS 'Check if a user has view/edit permission for a module';
COMMENT ON FUNCTION public.seed_default_permissions IS 'Seed default permissions for a new company';
COMMENT ON FUNCTION public.get_company_permissions IS 'Get all permissions for a company (for admin UI)';
COMMENT ON FUNCTION public.update_company_permissions IS 'Bulk update permissions for a company (for admin UI)';
