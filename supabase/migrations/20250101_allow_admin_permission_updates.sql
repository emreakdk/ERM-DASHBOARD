-- Allow company admins to manage their own permission matrix
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
  -- Only superadmins or admins of the target company can update permissions
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'superadmin'
        OR (role = 'admin' AND company_id = p_company_id)
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins or company admins can update permissions';
  END IF;

  -- Validate company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Upsert each permission entry
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
