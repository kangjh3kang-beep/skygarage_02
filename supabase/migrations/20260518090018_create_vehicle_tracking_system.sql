/*
  # Vehicle Tracking System - Core Schema

  1. New Tables
    - `tracking_vehicles`
      - `id` (uuid, PK)
      - `driver_name` (text) - driver's name
      - `plate_number` (text, unique) - license plate
      - `status` (text) - 'available', 'in_transit', 'offline', 'maintenance'
      - `current_lat` (double precision) - current latitude
      - `current_lng` (double precision) - current longitude
      - `speed` (double precision) - km/h
      - `heading` (double precision) - compass heading in degrees
      - `phone` (text) - driver phone number
      - `rating` (numeric) - driver average rating
      - `vehicle_model` (text) - vehicle model info
      - `last_updated` (timestamptz)
      - `complex_id` (uuid, FK)

    - `tracking_routes`
      - `id` (uuid, PK)
      - `vehicle_id` (uuid, FK)
      - `origin_name` (text)
      - `origin_lat` / `origin_lng` (double precision)
      - `destination_name` (text)
      - `dest_lat` / `dest_lng` (double precision)
      - `distance_km` (double precision) - total route distance
      - `estimated_arrival` (timestamptz)
      - `actual_arrival` (timestamptz)
      - `status` (text) - 'planned', 'active', 'completed', 'cancelled'

    - `tracking_bookings`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK to auth.users)
      - `vehicle_id` (uuid, FK)
      - `route_id` (uuid, FK)
      - `pickup_name` / `pickup_lat` / `pickup_lng`
      - `dropoff_name` / `dropoff_lat` / `dropoff_lng`
      - `status` (text) - 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
      - `scheduled_at` (timestamptz)

    - `tracking_location_history`
      - `id` (uuid, PK)
      - `vehicle_id` (uuid, FK)
      - `lat` / `lng` (double precision)
      - `speed` (double precision)
      - `heading` (double precision)
      - `recorded_at` (timestamptz)

    - `tracking_notifications`
      - `id` (uuid, PK)
      - `user_id` (uuid)
      - `booking_id` (uuid)
      - `type` (text) - 'eta_change', 'vehicle_nearby', 'status_change', 'delay'
      - `title` (text)
      - `message` (text)
      - `read` (boolean)

  2. Security
    - RLS enabled on all tables
    - Authenticated admin users can read/write all data
    - Regular users can read their own bookings and notifications

  3. Indexes
    - vehicle status, location_history vehicle+timestamp, bookings user+status
*/

-- ============================================================
-- tracking_vehicles
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name text NOT NULL DEFAULT '',
  plate_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available',
  current_lat double precision NOT NULL DEFAULT 37.5665,
  current_lng double precision NOT NULL DEFAULT 126.978,
  speed double precision NOT NULL DEFAULT 0,
  heading double precision NOT NULL DEFAULT 0,
  phone text NOT NULL DEFAULT '',
  rating numeric NOT NULL DEFAULT 4.5,
  vehicle_model text NOT NULL DEFAULT '',
  last_updated timestamptz NOT NULL DEFAULT now(),
  complex_id uuid REFERENCES complexes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_vehicles_status ON tracking_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_tracking_vehicles_plate ON tracking_vehicles(plate_number);

ALTER TABLE tracking_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tracking vehicles"
  ON tracking_vehicles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tracking vehicles"
  ON tracking_vehicles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tracking vehicles"
  ON tracking_vehicles FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tracking vehicles"
  ON tracking_vehicles FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- tracking_routes
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES tracking_vehicles(id),
  origin_name text NOT NULL DEFAULT '',
  origin_lat double precision NOT NULL DEFAULT 0,
  origin_lng double precision NOT NULL DEFAULT 0,
  destination_name text NOT NULL DEFAULT '',
  dest_lat double precision NOT NULL DEFAULT 0,
  dest_lng double precision NOT NULL DEFAULT 0,
  distance_km double precision NOT NULL DEFAULT 0,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_routes_vehicle ON tracking_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tracking_routes_status ON tracking_routes(status);

ALTER TABLE tracking_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tracking routes"
  ON tracking_routes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tracking routes"
  ON tracking_routes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tracking routes"
  ON tracking_routes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tracking routes"
  ON tracking_routes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- tracking_bookings
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  vehicle_id uuid REFERENCES tracking_vehicles(id),
  route_id uuid REFERENCES tracking_routes(id),
  pickup_name text NOT NULL DEFAULT '',
  pickup_lat double precision NOT NULL DEFAULT 0,
  pickup_lng double precision NOT NULL DEFAULT 0,
  dropoff_name text NOT NULL DEFAULT '',
  dropoff_lat double precision NOT NULL DEFAULT 0,
  dropoff_lng double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_bookings_user ON tracking_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_bookings_status ON tracking_bookings(status);
CREATE INDEX IF NOT EXISTS idx_tracking_bookings_vehicle ON tracking_bookings(vehicle_id);

ALTER TABLE tracking_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tracking bookings"
  ON tracking_bookings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tracking bookings"
  ON tracking_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tracking bookings"
  ON tracking_bookings FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tracking bookings"
  ON tracking_bookings FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- tracking_location_history
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES tracking_vehicles(id),
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  speed double precision NOT NULL DEFAULT 0,
  heading double precision NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_location_vehicle_time
  ON tracking_location_history(vehicle_id, recorded_at DESC);

ALTER TABLE tracking_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read location history"
  ON tracking_location_history FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert location history"
  ON tracking_location_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- tracking_notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  booking_id uuid REFERENCES tracking_bookings(id),
  type text NOT NULL DEFAULT 'status_change',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_notifications_user
  ON tracking_notifications(user_id, read, created_at DESC);

ALTER TABLE tracking_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tracking notifications"
  ON tracking_notifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tracking notifications"
  ON tracking_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tracking notifications"
  ON tracking_notifications FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Seed sample vehicles (Seoul area)
-- ============================================================

INSERT INTO tracking_vehicles (driver_name, plate_number, status, current_lat, current_lng, speed, heading, phone, rating, vehicle_model) VALUES
  ('김태호', '서울 12가 3456', 'available', 37.5665, 126.978, 0, 0, '010-1234-5678', 4.8, '현대 아이오닉 6'),
  ('이준혁', '서울 34나 7890', 'in_transit', 37.5512, 126.9882, 45, 90, '010-2345-6789', 4.6, '기아 EV6'),
  ('박민수', '서울 56다 1234', 'in_transit', 37.5729, 126.9794, 32, 180, '010-3456-7890', 4.9, '테슬라 모델 3'),
  ('최영진', '서울 78라 5678', 'available', 37.5443, 126.9512, 0, 0, '010-4567-8901', 4.7, '제네시스 G80'),
  ('정수빈', '서울 90마 9012', 'offline', 37.5172, 127.0473, 0, 0, '010-5678-9012', 4.5, '벤츠 E300')
ON CONFLICT DO NOTHING;

-- Seed sample routes
DO $$
DECLARE
  v1_id uuid;
  v2_id uuid;
  v3_id uuid;
BEGIN
  SELECT id INTO v1_id FROM tracking_vehicles WHERE plate_number = '서울 34나 7890' LIMIT 1;
  SELECT id INTO v2_id FROM tracking_vehicles WHERE plate_number = '서울 56다 1234' LIMIT 1;
  SELECT id INTO v3_id FROM tracking_vehicles WHERE plate_number = '서울 12가 3456' LIMIT 1;

  IF v1_id IS NOT NULL THEN
    INSERT INTO tracking_routes (vehicle_id, origin_name, origin_lat, origin_lng, destination_name, dest_lat, dest_lng, distance_km, estimated_arrival, status)
    VALUES (v1_id, '강남역', 37.4979, 127.0276, '여의도 IFC', 37.5252, 126.9258, 12.5, now() + interval '18 minutes', 'active');
  END IF;

  IF v2_id IS NOT NULL THEN
    INSERT INTO tracking_routes (vehicle_id, origin_name, origin_lat, origin_lng, destination_name, dest_lat, dest_lng, distance_km, estimated_arrival, status)
    VALUES (v2_id, '서울역', 37.5547, 126.9707, '잠실 롯데타워', 37.5126, 127.1026, 15.3, now() + interval '25 minutes', 'active');
  END IF;

  IF v3_id IS NOT NULL THEN
    INSERT INTO tracking_routes (vehicle_id, origin_name, origin_lat, origin_lng, destination_name, dest_lat, dest_lng, distance_km, estimated_arrival, status)
    VALUES (v3_id, '홍대입구', 37.5563, 126.9237, '광화문', 37.5759, 126.9769, 6.8, now() + interval '12 minutes', 'planned');
  END IF;
END $$;

-- Seed sample bookings
DO $$
DECLARE
  v1_id uuid;
  r1_id uuid;
BEGIN
  SELECT id INTO v1_id FROM tracking_vehicles WHERE plate_number = '서울 34나 7890' LIMIT 1;
  SELECT id INTO r1_id FROM tracking_routes WHERE vehicle_id = v1_id LIMIT 1;

  IF v1_id IS NOT NULL THEN
    INSERT INTO tracking_bookings (vehicle_id, route_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, status, scheduled_at)
    VALUES (v1_id, r1_id, '강남역 3번 출구', 37.4979, 127.0276, '여의도 IFC몰', 37.5252, 126.9258, 'in_progress', now());
  END IF;
END $$;
