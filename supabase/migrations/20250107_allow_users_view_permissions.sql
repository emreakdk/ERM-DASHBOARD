-- Allow regular company users to read their module permissions
-- This fixes the issue where sidebar permissions never update for user accounts
-- because the `get_company_permissions` RPC was blocked by RLS.

-- Clean up previous policy if it exists so the migration stays idempotent
DROP POLICY IF EXISTS "Users can view their company permissions" ON public.role_permissions;

CREATE POLICY "Users can view their company permissions"
  ON public.role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'user'
        AND profiles.company_id = role_permissions.company_id
    )
  );
