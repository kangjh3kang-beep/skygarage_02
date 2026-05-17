/*
  # Create User Roles and Permissions System

  1. New Tables
    - `user_roles` - Maps auth.users to system roles
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) - Supabase auth user
      - `role` (text) - 'super_admin', 'project_admin', 'complex_admin', 'operator', 'resident', 'vendor'
      - `display_name` (text) - User-friendly name
      - `created_at` (timestamptz)

    - `user_complex_assignments` - Maps users to specific complexes they can access
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `complex_id` (uuid, FK to complexes)
      - `role_override` (text, nullable) - Role for this specific complex (overrides global)
      - `permissions` (jsonb) - Fine-grained permissions for this assignment
      - `assigned_at` (timestamptz)

    - `feature_flags` - Controls which features are enabled per complex
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes)
      - `feature_key` (text) - Feature identifier
      - `enabled` (boolean)
      - `config` (jsonb) - Feature-specific configuration
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - super_admin can access everything
    - Other roles restricted to their assigned complexes

  3. Notes
    - Designed for hierarchical role system
    - super_admin has unrestricted access across all complexes
    - complex_admin is restricted to assigned complexes only
    - Permissions jsonb allows fine-grained control: { residents: { read: true, write: true, delete: false } }
*/

-- User Roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'operator',
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can read all roles"
  ON user_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert roles"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update roles"
  ON user_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete roles"
  ON user_roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- User Complex Assignments table
CREATE TABLE IF NOT EXISTS user_complex_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complex_id uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  role_override text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, complex_id)
);

ALTER TABLE user_complex_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assignments"
  ON user_complex_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can read all assignments"
  ON user_complex_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert assignments"
  ON user_complex_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update assignments"
  ON user_complex_assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete assignments"
  ON user_complex_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Feature Flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(complex_id, feature_key)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON feature_flags FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can insert feature flags"
  ON feature_flags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update feature flags"
  ON feature_flags FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete feature flags"
  ON feature_flags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_complex_assignments_user_id ON user_complex_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_complex_assignments_complex_id ON user_complex_assignments(complex_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_complex_id ON feature_flags(complex_id, feature_key);

-- Auto-assign super_admin role to the first user who signs up (bootstrap)
CREATE OR REPLACE FUNCTION auto_assign_first_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'super_admin') THEN
    INSERT INTO user_roles (user_id, role, display_name)
    VALUES (NEW.user_id, 'super_admin', '시스템 관리자');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: first login auto-promotes to super_admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_assign_first_admin'
  ) THEN
    CREATE TRIGGER trg_auto_assign_first_admin
      AFTER INSERT ON user_roles
      FOR EACH ROW
      EXECUTE FUNCTION auto_assign_first_admin();
  END IF;
END $$;
