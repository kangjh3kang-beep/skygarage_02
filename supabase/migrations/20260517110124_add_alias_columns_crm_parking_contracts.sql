/*
  # Add alias columns for CRM, parking_sessions, contracts

  1. Modified Tables
    - crm_leads: add name, company, email, phone, value
    - parking_sessions: add exit_time, entry_time, vehicle_plate, slot_number, payment_status
    - contracts: add value (alias for value_krw)

  2. Important Notes
    - Sync existing data to alias columns
    - No destructive operations
*/

-- crm_leads: add simple name aliases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='name') THEN
    ALTER TABLE crm_leads ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='company') THEN
    ALTER TABLE crm_leads ADD COLUMN company text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='email') THEN
    ALTER TABLE crm_leads ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='phone') THEN
    ALTER TABLE crm_leads ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='value') THEN
    ALTER TABLE crm_leads ADD COLUMN value numeric DEFAULT 0;
  END IF;
END $$;

UPDATE crm_leads SET 
  name = contact_name,
  company = company_name,
  email = contact_email,
  phone = contact_phone,
  value = deal_value
WHERE name IS NULL AND contact_name IS NOT NULL;

-- parking_sessions: add alias columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parking_sessions' AND column_name='exit_time') THEN
    ALTER TABLE parking_sessions ADD COLUMN exit_time timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parking_sessions' AND column_name='entry_time') THEN
    ALTER TABLE parking_sessions ADD COLUMN entry_time timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parking_sessions' AND column_name='vehicle_plate') THEN
    ALTER TABLE parking_sessions ADD COLUMN vehicle_plate text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parking_sessions' AND column_name='slot_number') THEN
    ALTER TABLE parking_sessions ADD COLUMN slot_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parking_sessions' AND column_name='payment_status') THEN
    ALTER TABLE parking_sessions ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;
END $$;

-- contracts: add value alias for value_krw
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='value') THEN
    ALTER TABLE contracts ADD COLUMN value numeric;
  END IF;
END $$;

UPDATE contracts SET value = value_krw WHERE value IS NULL AND value_krw IS NOT NULL;
