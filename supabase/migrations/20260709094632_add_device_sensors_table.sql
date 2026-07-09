-- Device sensor readings for CommandGuard evaluation
CREATE TABLE IF NOT EXISTS device_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  device_id text NOT NULL,
  sensor_type text NOT NULL CHECK (sensor_type IN ('lidar', 'ultrasonic', 'camera', 'encoder', 'proximity')),
  reading jsonb NOT NULL DEFAULT '{}',
  is_consistent boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, device_id, sensor_type)
);

ALTER TABLE device_sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_device_sensors" ON device_sensors FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_device_sensors" ON device_sensors FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_device_sensors" ON device_sensors FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_device_sensors" ON device_sensors FOR DELETE
  TO authenticated USING (true);

-- Elevator alignment status tracking
CREATE TABLE IF NOT EXISTS elevator_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  elevator_id text NOT NULL,
  current_floor integer NOT NULL DEFAULT 1,
  target_floor integer,
  is_aligned boolean NOT NULL DEFAULT false,
  door_open boolean NOT NULL DEFAULT false,
  door_zone_clear boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'moving', 'aligning', 'aligned', 'fault')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, elevator_id)
);

ALTER TABLE elevator_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_elevator_states" ON elevator_states FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_elevator_states" ON elevator_states FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_elevator_states" ON elevator_states FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_elevator_states" ON elevator_states FOR DELETE
  TO authenticated USING (true);
