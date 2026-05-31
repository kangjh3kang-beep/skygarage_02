/*
  # Create complex_types table

  1. New Tables
    - `complex_types`
      - `id` (uuid, primary key)
      - `code` (text, unique) - e.g. APT, OFC, COM
      - `label` (text) - Korean display name
      - `description` (text) - optional description
      - `is_active` (boolean) - whether this type is available for selection
      - `sort_order` (integer) - display order
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `complex_types` table
    - Authenticated users can read active types
    - Only super admins can manage types

  3. Seed Data
    - APT (아파트), OFC (오피스), COM (상업시설), MXD (복합시설)
*/

CREATE TABLE IF NOT EXISTS complex_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE complex_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active complex types"
  ON complex_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can insert complex types"
  ON complex_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update complex types"
  ON complex_types
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete complex types"
  ON complex_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

INSERT INTO complex_types (code, label, description, sort_order) VALUES
  ('APT', '아파트', '주거용 아파트 단지', 1),
  ('OFC', '오피스', '업무용 오피스 빌딩', 2),
  ('COM', '상업시설', '쇼핑몰, 백화점 등 상업시설', 3),
  ('MXD', '복합시설', '주거+상업 복합 단지', 4)
ON CONFLICT (code) DO NOTHING;
