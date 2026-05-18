/*
  # Inline is_super_admin logic into RLS policies and revoke RPC access

  1. Changes
    - Replace all RLS policies referencing is_super_admin() with direct subqueries
    - Revoke EXECUTE on is_super_admin() from authenticated role
    - Function can no longer be called via /rest/v1/rpc/is_super_admin

  2. Tables affected
    - user_roles (4 policies replaced)
    - user_complex_assignments (4 policies replaced)
*/

-- ============================================================
-- user_roles: drop and recreate policies that use is_super_admin()
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles" ON public.user_roles;

CREATE POLICY "Super admins can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
    OR NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
  );

CREATE POLICY "Super admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- ============================================================
-- user_complex_assignments: drop and recreate policies
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all assignments" ON public.user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can insert assignments" ON public.user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can update assignments" ON public.user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can delete assignments" ON public.user_complex_assignments;

CREATE POLICY "Super admins can read all assignments"
  ON public.user_complex_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert assignments"
  ON public.user_complex_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update assignments"
  ON public.user_complex_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete assignments"
  ON public.user_complex_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- ============================================================
-- Revoke EXECUTE so authenticated cannot call via RPC
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated;
