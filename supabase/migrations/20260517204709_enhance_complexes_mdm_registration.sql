/*
  # Enhance Complexes Table for MDM Registration System

  1. Modified Tables
    - `complexes`
      - `country_code` (text) - ISO 3166-1 alpha-2 country code (e.g., KR, US)
      - `region_code` (text) - Region/state code (e.g., 11 for Seoul)
      - `district_code` (text) - District/gu code (e.g., 680 for Gangnam)
      - `dong_code` (text) - Dong/neighborhood code
      - `complex_type` (text) - APT, OFC, COM, MXD, etc.
      - `sequence_number` (text) - Auto-generated sequence within type
      - `registration_date` (date) - Date of registration
      - `mdm_code` (text) - Full auto-generated MDM code
      - `latitude` (numeric) - GPS latitude
      - `longitude` (numeric) - GPS longitude
      - `total_floors` (integer) - Total building floors
      - `total_buildings` (integer) - Number of buildings
      - `construction_year` (integer) - Year of construction
      - `developer_name` (text) - Developer/builder name
      - `management_company` (text) - Property management company
      - `contact_phone` (text) - Primary contact phone
      - `contact_email` (text) - Primary contact email
      - `ev_charger_count` (integer) - Number of EV chargers
      - `has_valet_system` (boolean) - Whether valet parking is installed
      - `data_quality_score` (numeric) - DQ score 0-100
      - `completeness_ratio` (numeric) - Data completeness ratio 0-1
      - `last_validated_at` (timestamptz) - Last DQ validation timestamp

  2. New Tables
    - `complex_registration_history`
      - Tracks all changes to complex registrations for audit trail
    - `mdm_code_sequences`
      - Manages auto-increment sequences for MDM code generation

  3. Security
    - RLS enabled on new tables
    - Policies for authenticated admin access

  4. Notes
    - MDM code format: SG-{country}-{region}-{district}-{dong}-{type}-{sequence}-{date}
    - Example: SG-KR-11-680-101-APT-A0001-20260514
    - Sequence is auto-generated per complex_type within a region
*/

-- Add MDM columns to complexes table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'country_code') THEN
    ALTER TABLE complexes ADD COLUMN country_code text NOT NULL DEFAULT 'KR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'region_code') THEN
    ALTER TABLE complexes ADD COLUMN region_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'district_code') THEN
    ALTER TABLE complexes ADD COLUMN district_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'dong_code') THEN
    ALTER TABLE complexes ADD COLUMN dong_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'complex_type') THEN
    ALTER TABLE complexes ADD COLUMN complex_type text NOT NULL DEFAULT 'APT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'sequence_number') THEN
    ALTER TABLE complexes ADD COLUMN sequence_number text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'registration_date') THEN
    ALTER TABLE complexes ADD COLUMN registration_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'mdm_code') THEN
    ALTER TABLE complexes ADD COLUMN mdm_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'latitude') THEN
    ALTER TABLE complexes ADD COLUMN latitude numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'longitude') THEN
    ALTER TABLE complexes ADD COLUMN longitude numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'total_floors') THEN
    ALTER TABLE complexes ADD COLUMN total_floors integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'total_buildings') THEN
    ALTER TABLE complexes ADD COLUMN total_buildings integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'construction_year') THEN
    ALTER TABLE complexes ADD COLUMN construction_year integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'developer_name') THEN
    ALTER TABLE complexes ADD COLUMN developer_name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'management_company') THEN
    ALTER TABLE complexes ADD COLUMN management_company text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'contact_phone') THEN
    ALTER TABLE complexes ADD COLUMN contact_phone text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'contact_email') THEN
    ALTER TABLE complexes ADD COLUMN contact_email text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'ev_charger_count') THEN
    ALTER TABLE complexes ADD COLUMN ev_charger_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'has_valet_system') THEN
    ALTER TABLE complexes ADD COLUMN has_valet_system boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'data_quality_score') THEN
    ALTER TABLE complexes ADD COLUMN data_quality_score numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'completeness_ratio') THEN
    ALTER TABLE complexes ADD COLUMN completeness_ratio numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complexes' AND column_name = 'last_validated_at') THEN
    ALTER TABLE complexes ADD COLUMN last_validated_at timestamptz;
  END IF;
END $$;

-- Create MDM code sequences table
CREATE TABLE IF NOT EXISTS mdm_code_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'KR',
  region_code text NOT NULL DEFAULT '',
  complex_type text NOT NULL DEFAULT 'APT',
  current_sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, region_code, complex_type)
);

ALTER TABLE mdm_code_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mdm sequences"
  ON mdm_code_sequences FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert mdm sequences"
  ON mdm_code_sequences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mdm sequences"
  ON mdm_code_sequences FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create complex registration history table
CREATE TABLE IF NOT EXISTS complex_registration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  action text NOT NULL DEFAULT 'create',
  changed_by uuid NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE complex_registration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read registration history"
  ON complex_registration_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert registration history"
  ON complex_registration_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_complexes_mdm_code ON complexes(mdm_code);
CREATE INDEX IF NOT EXISTS idx_complexes_country_region ON complexes(country_code, region_code);
CREATE INDEX IF NOT EXISTS idx_complex_reg_history_complex ON complex_registration_history(complex_id);

-- Function to generate next MDM sequence number
CREATE OR REPLACE FUNCTION generate_mdm_sequence(
  p_country_code text,
  p_region_code text,
  p_complex_type text
) RETURNS text AS $$
DECLARE
  v_seq integer;
  v_prefix text;
BEGIN
  INSERT INTO mdm_code_sequences (country_code, region_code, complex_type, current_sequence)
  VALUES (p_country_code, p_region_code, p_complex_type, 1)
  ON CONFLICT (country_code, region_code, complex_type)
  DO UPDATE SET current_sequence = mdm_code_sequences.current_sequence + 1, updated_at = now()
  RETURNING current_sequence INTO v_seq;

  v_prefix := CASE p_complex_type
    WHEN 'APT' THEN 'A'
    WHEN 'OFC' THEN 'O'
    WHEN 'COM' THEN 'C'
    WHEN 'MXD' THEN 'M'
    WHEN 'RSD' THEN 'R'
    ELSE 'X'
  END;

  RETURN v_prefix || LPAD(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;