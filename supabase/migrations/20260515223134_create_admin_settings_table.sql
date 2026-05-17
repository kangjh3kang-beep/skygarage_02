/*
  # Create admin_settings table

  1. New Tables
    - `admin_settings`
      - `key` (text, primary key) - setting identifier
      - `value` (jsonb) - setting value as JSON
      - `updated_at` (timestamptz) - last updated timestamp

  2. Security
    - Enable RLS on `admin_settings` table
    - Add policies for authenticated admin users to read, insert, update

  3. Default Data
    - Seed notification preferences and profile defaults
*/

CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON admin_settings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert settings"
  ON admin_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update settings"
  ON admin_settings FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO admin_settings (key, value) VALUES
  ('notification_prefs', '{"newInquiry": true, "statusChange": true, "delayed": true, "system": false}'::jsonb),
  ('profile', '{"name": "관리자", "phone": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
