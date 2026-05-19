/*
  # Add geolocation coordinates to complexes

  1. Modified Tables
    - `complexes`
      - `lat` (double precision) - latitude coordinate
      - `lng` (double precision) - longitude coordinate

  2. Notes
    - Used for proximity-based complex detection in the parking user app
    - Users can be auto-matched to their complex based on GPS location
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'lat'
  ) THEN
    ALTER TABLE complexes ADD COLUMN lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'lng'
  ) THEN
    ALTER TABLE complexes ADD COLUMN lng double precision;
  END IF;
END $$;

-- Seed coordinates for existing complexes
UPDATE complexes SET lat = 36.4800, lng = 127.0000 WHERE code = 'SG-SJ-001' AND lat IS NULL;
UPDATE complexes SET lat = 37.3947, lng = 127.1112 WHERE code = 'SG-PG-001' AND lat IS NULL;
UPDATE complexes SET lat = 35.1620, lng = 129.1635 WHERE code = 'SG-BS-001' AND lat IS NULL;
UPDATE complexes SET lat = 1.2834, lng = 103.8607 WHERE code = 'SG-SG-001' AND lat IS NULL;
