/*
  # Fix infinite recursion in user_roles RLS policies

  1. Problem
    - The "Super admins can read all roles" policy queries user_roles itself
    - This causes infinite recursion when Postgres evaluates the policy

  2. Solution
    - Drop the recursive policies
    - Replace with a single simple SELECT policy: users can read their own role
    - For admin operations (insert/update/delete), use a security definer function
      that checks the role without hitting RLS

  3. Changes
    - Drop and recreate SELECT policies on user_roles
    - Drop and recreate INSERT/UPDATE/DELETE policies using security definer function
    - Drop and recreate policies on user_complex_assignments that also reference user_roles
*/

-- Create a security definer function to check super_admin without RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
DROP POLICY IF EXISTS "Super admins can read all roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles" ON user_roles;

-- Recreate non-recursive policies
CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can read all roles"
  ON user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert roles"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1));

CREATE POLICY "Super admins can update roles"
  ON user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete roles"
  ON user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Fix user_complex_assignments policies too
DROP POLICY IF EXISTS "Super admins can read all assignments" ON user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can insert assignments" ON user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can update assignments" ON user_complex_assignments;
DROP POLICY IF EXISTS "Super admins can delete assignments" ON user_complex_assignments;

CREATE POLICY "Super admins can read all assignments"
  ON user_complex_assignments FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert assignments"
  ON user_complex_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update assignments"
  ON user_complex_assignments FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete assignments"
  ON user_complex_assignments FOR DELETE TO authenticated
  USING (public.is_super_admin());
