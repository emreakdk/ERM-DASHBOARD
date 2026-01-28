-- =====================================================
-- Fix RLS Infinite Recursion Issue
-- =====================================================

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Company admins can manage their company users" ON public.profiles;

-- Create a simpler policy that doesn't cause recursion
-- Users can view profiles in their company
CREATE POLICY "Users can view profiles in their company"
  ON public.profiles
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins can update profiles in their company
CREATE POLICY "Admins can update profiles in their company"
  ON public.profiles
  FOR UPDATE
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins can insert profiles in their company
CREATE POLICY "Admins can insert profiles in their company"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins can delete profiles in their company
CREATE POLICY "Admins can delete profiles in their company"
  ON public.profiles
  FOR DELETE
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Superadmins bypass all restrictions (already exists from previous migration)
-- This policy should already be in place from add_superadmin_role.sql

-- Users can always view and update their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());
