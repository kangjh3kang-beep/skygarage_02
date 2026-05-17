/*
  # Add operating_mode to parking_sessions

  1. Modified Tables
    - `parking_sessions`
      - `operating_mode` (text, default 'direct') - Parking operation mode (direct, valet, tower, hybrid)

  2. Notes
    - Supports multi-mode parking operations (direct, valet, tower, hybrid)
    - Default is 'direct' for backwards compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parking_sessions' AND column_name = 'operating_mode'
  ) THEN
    ALTER TABLE parking_sessions ADD COLUMN operating_mode text DEFAULT 'direct';
  END IF;
END $$;
