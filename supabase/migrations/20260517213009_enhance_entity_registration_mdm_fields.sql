/*
  # Enhance Entity Tables with MDM Registration Fields

  1. Modified Tables
    - `resident_accounts` - Add registration_code, vehicle_count, move_in_date, emergency_contact, notes
    - `atr_units` - Add model, manufacturer, commissioned_at, firmware_version, location, max_payload_kg
    - `elevators` - Add building_name, manufacturer, model, commissioned_at, inspection_due, adapter_type
    - `contracts` - Add contract_code, complex_id linkage fix, payment_terms, renewal_notice_days
    - `partners` - Add registration_code, business_number, address, website, tier
    - `billing_invoices` - Add line_items jsonb, notes, currency, discount_amount
    - `crm_leads` - Add lead_code, complex_interest, unit_count_interest, budget_range, follow_up_count
    - `support_tickets` - Add resolution_notes, escalated, feedback_score

  2. New Sequences/Functions
    - Entity code generation functions for each entity type

  3. Important Notes
    - All new columns have default values to avoid breaking existing data
    - No destructive operations
    - Maintains backward compatibility
*/

-- Resident Accounts enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'registration_code') THEN
    ALTER TABLE resident_accounts ADD COLUMN registration_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'vehicle_count') THEN
    ALTER TABLE resident_accounts ADD COLUMN vehicle_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'move_in_date') THEN
    ALTER TABLE resident_accounts ADD COLUMN move_in_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'emergency_contact') THEN
    ALTER TABLE resident_accounts ADD COLUMN emergency_contact text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'notes') THEN
    ALTER TABLE resident_accounts ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'household_size') THEN
    ALTER TABLE resident_accounts ADD COLUMN household_size integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'parking_assigned') THEN
    ALTER TABLE resident_accounts ADD COLUMN parking_assigned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resident_accounts' AND column_name = 'completeness_score') THEN
    ALTER TABLE resident_accounts ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ATR Units enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'model') THEN
    ALTER TABLE atr_units ADD COLUMN model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'manufacturer') THEN
    ALTER TABLE atr_units ADD COLUMN manufacturer text NOT NULL DEFAULT 'SkyGarage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'commissioned_at') THEN
    ALTER TABLE atr_units ADD COLUMN commissioned_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'firmware_version') THEN
    ALTER TABLE atr_units ADD COLUMN firmware_version text NOT NULL DEFAULT '1.0.0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'location_zone') THEN
    ALTER TABLE atr_units ADD COLUMN location_zone text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'max_payload_kg') THEN
    ALTER TABLE atr_units ADD COLUMN max_payload_kg integer NOT NULL DEFAULT 2500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'operating_mode') THEN
    ALTER TABLE atr_units ADD COLUMN operating_mode text NOT NULL DEFAULT 'direct';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'maintenance_interval_days') THEN
    ALTER TABLE atr_units ADD COLUMN maintenance_interval_days integer NOT NULL DEFAULT 90;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atr_units' AND column_name = 'completeness_score') THEN
    ALTER TABLE atr_units ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Elevators enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'building_name') THEN
    ALTER TABLE elevators ADD COLUMN building_name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'manufacturer') THEN
    ALTER TABLE elevators ADD COLUMN manufacturer text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'model') THEN
    ALTER TABLE elevators ADD COLUMN model text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'commissioned_at') THEN
    ALTER TABLE elevators ADD COLUMN commissioned_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'inspection_due') THEN
    ALTER TABLE elevators ADD COLUMN inspection_due date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'adapter_type') THEN
    ALTER TABLE elevators ADD COLUMN adapter_type text NOT NULL DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'speed_mps') THEN
    ALTER TABLE elevators ADD COLUMN speed_mps numeric NOT NULL DEFAULT 1.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'door_width_mm') THEN
    ALTER TABLE elevators ADD COLUMN door_width_mm integer NOT NULL DEFAULT 900;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'car_depth_mm') THEN
    ALTER TABLE elevators ADD COLUMN car_depth_mm integer NOT NULL DEFAULT 2100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elevators' AND column_name = 'completeness_score') THEN
    ALTER TABLE elevators ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Contracts enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contract_code') THEN
    ALTER TABLE contracts ADD COLUMN contract_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'payment_terms') THEN
    ALTER TABLE contracts ADD COLUMN payment_terms text NOT NULL DEFAULT 'net30';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'renewal_notice_days') THEN
    ALTER TABLE contracts ADD COLUMN renewal_notice_days integer NOT NULL DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'currency') THEN
    ALTER TABLE contracts ADD COLUMN currency text NOT NULL DEFAULT 'KRW';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'scope_description') THEN
    ALTER TABLE contracts ADD COLUMN scope_description text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'completeness_score') THEN
    ALTER TABLE contracts ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Partners enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'registration_code') THEN
    ALTER TABLE partners ADD COLUMN registration_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'business_number') THEN
    ALTER TABLE partners ADD COLUMN business_number text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'address') THEN
    ALTER TABLE partners ADD COLUMN address text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'website') THEN
    ALTER TABLE partners ADD COLUMN website text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'tier') THEN
    ALTER TABLE partners ADD COLUMN tier text NOT NULL DEFAULT 'standard';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'completeness_score') THEN
    ALTER TABLE partners ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Billing Invoices enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_invoices' AND column_name = 'line_items') THEN
    ALTER TABLE billing_invoices ADD COLUMN line_items jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_invoices' AND column_name = 'notes') THEN
    ALTER TABLE billing_invoices ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_invoices' AND column_name = 'currency') THEN
    ALTER TABLE billing_invoices ADD COLUMN currency text NOT NULL DEFAULT 'KRW';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_invoices' AND column_name = 'discount_amount') THEN
    ALTER TABLE billing_invoices ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- CRM Leads enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'lead_code') THEN
    ALTER TABLE crm_leads ADD COLUMN lead_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'complex_interest') THEN
    ALTER TABLE crm_leads ADD COLUMN complex_interest text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'unit_count_interest') THEN
    ALTER TABLE crm_leads ADD COLUMN unit_count_interest integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'budget_range') THEN
    ALTER TABLE crm_leads ADD COLUMN budget_range text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'follow_up_count') THEN
    ALTER TABLE crm_leads ADD COLUMN follow_up_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'scoring') THEN
    ALTER TABLE crm_leads ADD COLUMN scoring integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'completeness_score') THEN
    ALTER TABLE crm_leads ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Support Tickets enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'resolution_notes') THEN
    ALTER TABLE support_tickets ADD COLUMN resolution_notes text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'escalated') THEN
    ALTER TABLE support_tickets ADD COLUMN escalated boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'feedback_score') THEN
    ALTER TABLE support_tickets ADD COLUMN feedback_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'completeness_score') THEN
    ALTER TABLE support_tickets ADD COLUMN completeness_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Entity code sequence table (shared across entity types)
CREATE TABLE IF NOT EXISTS entity_code_sequences (
  entity_type text NOT NULL,
  prefix text NOT NULL,
  current_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, prefix)
);

ALTER TABLE entity_code_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read entity sequences"
  ON entity_code_sequences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert entity sequences"
  ON entity_code_sequences FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update entity sequences"
  ON entity_code_sequences FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to generate entity codes
CREATE OR REPLACE FUNCTION generate_entity_code(p_entity_type text, p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq integer;
  v_date text;
BEGIN
  INSERT INTO entity_code_sequences (entity_type, prefix, current_seq)
  VALUES (p_entity_type, p_prefix, 1)
  ON CONFLICT (entity_type, prefix)
  DO UPDATE SET current_seq = entity_code_sequences.current_seq + 1
  RETURNING current_seq INTO v_seq;

  v_date := to_char(now(), 'YYYYMMDD');
  RETURN p_prefix || '-' || lpad(v_seq::text, 4, '0') || '-' || v_date;
END;
$$;
