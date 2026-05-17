/*
  # Add entity_code and completeness_score to maintenance_logs

  1. Modified Tables
    - `maintenance_logs`
      - `entity_code` (text, nullable) - Auto-generated MDM entity code (MNT-XXXX)
      - `completeness_score` (integer, default 0) - Data completeness percentage (0-100)

  2. Notes
    - Supports MDM stepper registration pattern for maintenance entities
    - Completeness scoring aligns with other entity registration systems
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'entity_code'
  ) THEN
    ALTER TABLE maintenance_logs ADD COLUMN entity_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_logs' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE maintenance_logs ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;
END $$;
