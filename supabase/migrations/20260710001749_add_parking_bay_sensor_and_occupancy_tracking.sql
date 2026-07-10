/*
# Add Parking Bay Sensor Support & Occupancy Event Tracking

1. Schema Changes
   - Adds 'parking_bay_sensor' as a supported device type in hardware_adapters (comment only; text column accepts any value)
   - Creates `parking_bay_occupancy_events` table for real-time sensor state transitions
     - `id` (uuid, primary key)
     - `spot_id` (uuid, FK to parking_spots) - which parking bay changed
     - `device_id` (uuid, FK to hardware_device_registry) - which sensor reported
     - `event_type` (text) - 'occupied' | 'vacated' | 'reserved' | 'fault'
     - `confidence` (float) - sensor confidence 0-1
     - `detected_plate` (text, nullable) - plate recognized by camera sensor
     - `created_at` (timestamptz)
   - Adds `sensor_device_id` column to `parking_spots` for linking bay to its sensor
   - Adds `line` column to `parking_spots` for line-based grouping (A라인, B라인 etc.)
   - Adds `spot_label` column to `parking_spots` for human-readable display label
   - Adds index on parking_spots (complex_id, floor, is_occupied) for availability queries

2. Security
   - Enable RLS on `parking_bay_occupancy_events`
   - Authenticated users can SELECT occupancy events (read-only for app users)
   - Service role (via edge functions) handles inserts from hardware

3. Important Notes
   - The parking_spots table already exists from 20260518231734 migration
   - This extends it with sensor linkage and line grouping for the SGP app
   - Hardware adapters for parking bay sensors use protocol types: 'mqtt' (ultrasonic/IR sensors) or 'rest_api' (camera-based)
*/

-- Add line and sensor columns to parking_spots
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parking_spots' AND column_name = 'line') THEN
    ALTER TABLE parking_spots ADD COLUMN line text NOT NULL DEFAULT 'A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parking_spots' AND column_name = 'spot_label') THEN
    ALTER TABLE parking_spots ADD COLUMN spot_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parking_spots' AND column_name = 'sensor_device_id') THEN
    ALTER TABLE parking_spots ADD COLUMN sensor_device_id uuid REFERENCES hardware_device_registry(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parking_spots' AND column_name = 'complex_id') THEN
    ALTER TABLE parking_spots ADD COLUMN complex_id uuid REFERENCES complexes(id);
  END IF;
END $$;

-- Index for fast availability queries by complex/floor
CREATE INDEX IF NOT EXISTS idx_parking_spots_availability
  ON parking_spots (complex_id, floor, is_occupied);

CREATE INDEX IF NOT EXISTS idx_parking_spots_line
  ON parking_spots (complex_id, floor, line);

-- Occupancy event tracking table
CREATE TABLE IF NOT EXISTS parking_bay_occupancy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  device_id uuid REFERENCES hardware_device_registry(id),
  event_type text NOT NULL DEFAULT 'occupied',
  confidence float NOT NULL DEFAULT 1.0,
  detected_plate text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parking_bay_occupancy_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read occupancy events (for real-time UI)
DROP POLICY IF EXISTS "select_occupancy_events" ON parking_bay_occupancy_events;
CREATE POLICY "select_occupancy_events" ON parking_bay_occupancy_events
  FOR SELECT TO authenticated USING (true);

-- Only service_role inserts (hardware gateway); no user-facing insert policy needed
DROP POLICY IF EXISTS "service_insert_occupancy_events" ON parking_bay_occupancy_events;
CREATE POLICY "service_insert_occupancy_events" ON parking_bay_occupancy_events
  FOR INSERT TO service_role WITH CHECK (true);

-- Index for recent events per spot
CREATE INDEX IF NOT EXISTS idx_occupancy_events_spot_time
  ON parking_bay_occupancy_events (spot_id, created_at DESC);
