/*
  # Create patents table for SkyGarage patent management

  1. New Tables
    - `patents`
      - `id` (uuid, primary key)
      - `title` (text, not null) - Patent title
      - `title_en` (text) - English title
      - `patent_number` (text, unique) - Official patent number (e.g., KR-10-2024-0001234)
      - `application_number` (text) - Application filing number
      - `application_date` (date) - Date of application filing
      - `registration_date` (date) - Date of patent registration/grant
      - `expiry_date` (date) - Expiration date of patent
      - `status` (text, not null, default 'pending') - Patent status: pending, filed, under_review, granted, rejected, expired, abandoned
      - `category` (text, not null, default 'utility') - Patent type: utility, design, trademark, international
      - `technology_area` (text) - Technology domain: atr, elevator, parking, ev_charging, ai, iot, v2g, safety, other
      - `inventors` (jsonb, default '[]') - Array of inventor objects {name, role, contribution_pct}
      - `abstract` (text) - Patent abstract/summary
      - `claims_count` (integer, default 0) - Number of claims
      - `priority_date` (date) - Priority date for international filings
      - `country` (text, default 'KR') - Filing country code
      - `assignee` (text, default 'SkyGarage Inc.') - Patent assignee/owner
      - `attorney` (text) - Patent attorney/agent name
      - `notes` (text) - Internal notes
      - `documents` (jsonb, default '[]') - Attached document URLs [{name, url, type}]
      - `related_patents` (jsonb, default '[]') - Related patent IDs
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - User who created the record

  2. Security
    - Enable RLS on `patents` table
    - Authenticated users can view patents
    - Authenticated users can manage patents (insert, update, delete)

  3. Notes
    - Supports full patent lifecycle from application to expiry
    - Technology areas map to SkyGarage's core patent portfolio (ATR, elevator systems, V2G, etc.)
    - Documents field stores references to uploaded patent documents
*/

CREATE TABLE IF NOT EXISTS patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text DEFAULT '',
  patent_number text UNIQUE,
  application_number text DEFAULT '',
  application_date date,
  registration_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending',
  category text NOT NULL DEFAULT 'utility',
  technology_area text DEFAULT 'other',
  inventors jsonb NOT NULL DEFAULT '[]'::jsonb,
  abstract text DEFAULT '',
  claims_count integer DEFAULT 0,
  priority_date date,
  country text DEFAULT 'KR',
  assignee text DEFAULT 'SkyGarage Inc.',
  attorney text DEFAULT '',
  notes text DEFAULT '',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_patents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patents"
  ON patents
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert patents"
  ON patents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update patents"
  ON patents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete patents"
  ON patents
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_patents_status ON patents(status);
CREATE INDEX IF NOT EXISTS idx_patents_category ON patents(category);
CREATE INDEX IF NOT EXISTS idx_patents_technology_area ON patents(technology_area);
CREATE INDEX IF NOT EXISTS idx_patents_country ON patents(country);
