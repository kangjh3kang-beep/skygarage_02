/*
  # Add entity_code and completeness_score to licenses and patents

  1. Modified Tables
    - `licenses`
      - `entity_code` (text, nullable) - Auto-generated MDM entity code (LIC-XXXX)
      - `completeness_score` (integer, default 0) - Data completeness percentage (0-100)
    - `patents`
      - `entity_code` (text, nullable) - Auto-generated MDM entity code (PAT-XXXX)
      - `completeness_score` (integer, default 0) - Data completeness percentage (0-100)

  2. Notes
    - Supports MDM stepper registration pattern for IP entities
    - Enables workflow engine to monitor data quality for these entities
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'entity_code'
  ) THEN
    ALTER TABLE licenses ADD COLUMN entity_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE licenses ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patents' AND column_name = 'entity_code'
  ) THEN
    ALTER TABLE patents ADD COLUMN entity_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patents' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE patents ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;
END $$;
