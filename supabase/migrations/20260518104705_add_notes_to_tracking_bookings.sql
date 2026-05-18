/*
  # Add notes field to tracking_bookings

  1. Modified Tables
    - `tracking_bookings`
      - `notes` (text, nullable) - Special requests or instructions from user

  2. Purpose
    - Allow users to communicate accessibility needs, special instructions to drivers
    - Optional field, no impact on existing bookings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracking_bookings' AND column_name = 'notes'
  ) THEN
    ALTER TABLE tracking_bookings ADD COLUMN notes text DEFAULT NULL;
  END IF;
END $$;
