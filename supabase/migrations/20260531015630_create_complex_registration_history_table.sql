/*
  # Create Complex Registration History Table

  1. New Tables
    - `complex_registration_history`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, not null) - references complexes table
      - `action` (text, not null) - create/update/status_change/delete
      - `changes` (jsonb) - JSON record of what changed
      - `created_at` (timestamptz, default now())
      - `performed_by` (uuid) - who performed the action

  2. Security
    - Enable RLS
    - Authenticated users can read and insert history records
*/

CREATE TABLE IF NOT EXISTS complex_registration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'update',
  changes jsonb DEFAULT '{}',
  performed_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE complex_registration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read complex_registration_history"
  ON complex_registration_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert complex_registration_history"
  ON complex_registration_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_complex_reg_history_complex_id ON complex_registration_history(complex_id);
CREATE INDEX IF NOT EXISTS idx_complex_reg_history_created_at ON complex_registration_history(created_at DESC);
