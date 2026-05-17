/*
  # Create licenses table for SkyGarage patent licensing management

  1. New Tables
    - `licenses`
      - `id` (uuid, primary key)
      - `license_number` (text, unique) - Internal license reference number (e.g., LIC-2024-001)
      - `patent_id` (uuid, FK) - Reference to the licensed patent
      - `licensee_name` (text, not null) - Company/individual receiving the license
      - `licensee_contact` (text) - Contact person
      - `licensee_email` (text) - Contact email
      - `license_type` (text, not null, default 'exclusive') - Type: exclusive, non_exclusive, cross_license, sublicense
      - `territory` (text, default 'KR') - Geographic scope of license
      - `status` (text, not null, default 'negotiating') - Status: negotiating, active, suspended, expired, terminated
      - `start_date` (date) - License effective start date
      - `end_date` (date) - License expiration date
      - `royalty_type` (text, default 'fixed') - Royalty model: fixed, percentage, milestone, hybrid
      - `royalty_amount` (numeric, default 0) - Royalty amount or percentage value
      - `royalty_currency` (text, default 'KRW') - Currency code
      - `payment_frequency` (text, default 'monthly') - Payment schedule: monthly, quarterly, annually, one_time
      - `total_revenue` (numeric, default 0) - Total revenue collected from this license
      - `contract_value` (numeric, default 0) - Total contract value
      - `terms` (text) - License terms and conditions summary
      - `notes` (text) - Internal notes
      - `documents` (jsonb, default '[]') - Attached documents [{name, url, type}]
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - User who created the record

  2. Security
    - Enable RLS on `licenses` table
    - Authenticated users can view licenses
    - Authenticated users can manage licenses (insert, update, delete)

  3. Notes
    - Links to patents table via patent_id
    - Tracks full licensing lifecycle from negotiation to termination
    - Supports multiple royalty models for different business arrangements
    - Revenue tracking for financial reporting
*/

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number text UNIQUE,
  patent_id uuid REFERENCES patents(id),
  licensee_name text NOT NULL,
  licensee_contact text DEFAULT '',
  licensee_email text DEFAULT '',
  license_type text NOT NULL DEFAULT 'exclusive',
  territory text DEFAULT 'KR',
  status text NOT NULL DEFAULT 'negotiating',
  start_date date,
  end_date date,
  royalty_type text DEFAULT 'fixed',
  royalty_amount numeric DEFAULT 0,
  royalty_currency text DEFAULT 'KRW',
  payment_frequency text DEFAULT 'monthly',
  total_revenue numeric DEFAULT 0,
  contract_value numeric DEFAULT 0,
  terms text DEFAULT '',
  notes text DEFAULT '',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view licenses"
  ON licenses
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert licenses"
  ON licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update licenses"
  ON licenses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete licenses"
  ON licenses
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_licenses_patent_id ON licenses(patent_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_license_type ON licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_licenses_licensee_name ON licenses(licensee_name);
