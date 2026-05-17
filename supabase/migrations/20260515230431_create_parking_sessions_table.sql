/*
  # Create parking_sessions table

  1. New Tables
    - `parking_sessions`
      - `id` (uuid, primary key) - unique session identifier
      - `complex_id` (uuid, FK to complexes) - which complex
      - `vehicle_number` (text) - license plate number (masked for privacy)
      - `slot_id` (text) - assigned parking slot identifier
      - `floor` (integer) - parking floor
      - `atr_id` (uuid, nullable, FK to atr_units) - which ATR handled the transfer
      - `elevator_id` (uuid, nullable, FK to elevators) - which elevator used
      - `status` (text) - 'in_progress', 'parked', 'retrieving', 'completed', 'cancelled'
      - `entry_at` (timestamptz) - vehicle entry time
      - `parked_at` (timestamptz, nullable) - when vehicle was placed in slot
      - `retrieve_requested_at` (timestamptz, nullable) - when owner requested retrieval
      - `exit_at` (timestamptz, nullable) - vehicle exit time
      - `duration_minutes` (integer) - total parking duration in minutes
      - `fee` (numeric) - parking fee charged in KRW
      - `is_ev` (boolean) - whether it's an electric vehicle
      - `ev_charged_kwh` (numeric) - EV energy charged during session
      - `created_at` (timestamptz) - record creation time

  2. Security
    - Enable RLS on `parking_sessions` table
    - Policies for authenticated admin access

  3. Notes
    - Core operational table for parking flow tracking
    - Enables revenue analytics, peak hour analysis, slot utilization metrics
    - EV charging tracking for energy management integration
*/

CREATE TABLE IF NOT EXISTS parking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  vehicle_number text NOT NULL DEFAULT '',
  slot_id text NOT NULL DEFAULT '',
  floor integer NOT NULL DEFAULT 1,
  atr_id uuid REFERENCES atr_units(id),
  elevator_id uuid REFERENCES elevators(id),
  status text NOT NULL DEFAULT 'in_progress',
  entry_at timestamptz NOT NULL DEFAULT now(),
  parked_at timestamptz,
  retrieve_requested_at timestamptz,
  exit_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  is_ev boolean NOT NULL DEFAULT false,
  ev_charged_kwh numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parking sessions"
  ON parking_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert parking sessions"
  ON parking_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update parking sessions"
  ON parking_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete parking sessions"
  ON parking_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed sample parking session data (last 7 days)
DO $$
DECLARE
  complex_rec RECORD;
  atr_rec RECORD;
  elev_rec RECORD;
  i integer;
  entry_time timestamptz;
  park_time timestamptz;
  exit_time timestamptz;
  duration integer;
  session_fee numeric;
  plate_suffix integer;
  is_electric boolean;
BEGIN
  FOR complex_rec IN SELECT id FROM complexes LOOP
    SELECT id INTO atr_rec FROM atr_units WHERE complex_id = complex_rec.id LIMIT 1;
    SELECT id INTO elev_rec FROM elevators WHERE complex_id = complex_rec.id LIMIT 1;

    FOR i IN 1..25 LOOP
      entry_time := now() - (random() * interval '7 days');
      duration := (30 + floor(random() * 720))::integer;
      park_time := entry_time + interval '90 seconds';
      exit_time := entry_time + (duration * interval '1 minute');
      session_fee := CASE
        WHEN duration <= 60 THEN 0
        WHEN duration <= 180 THEN 3000
        WHEN duration <= 360 THEN 5000
        ELSE 8000
      END;
      plate_suffix := 1000 + floor(random() * 9000)::integer;
      is_electric := random() < 0.3;

      INSERT INTO parking_sessions (
        complex_id, vehicle_number, slot_id, floor,
        atr_id, elevator_id, status,
        entry_at, parked_at, exit_at,
        duration_minutes, fee, is_ev, ev_charged_kwh
      ) VALUES (
        complex_rec.id,
        floor(random() * 90 + 10)::text || '가 ' || plate_suffix::text,
        'P' || floor(random() * 5 + 1)::text || '-' || LPAD(floor(random() * 50 + 1)::text, 3, '0'),
        floor(random() * 6 - 3)::integer,
        atr_rec.id,
        elev_rec.id,
        'completed',
        entry_time, park_time, exit_time,
        duration, session_fee,
        is_electric,
        CASE WHEN is_electric THEN round((random() * 30)::numeric, 1) ELSE 0 END
      );
    END LOOP;

    -- Add a few currently parked vehicles
    FOR i IN 1..3 LOOP
      entry_time := now() - (random() * interval '4 hours');
      park_time := entry_time + interval '90 seconds';
      plate_suffix := 1000 + floor(random() * 9000)::integer;
      is_electric := random() < 0.3;

      INSERT INTO parking_sessions (
        complex_id, vehicle_number, slot_id, floor,
        atr_id, elevator_id, status,
        entry_at, parked_at,
        duration_minutes, fee, is_ev, ev_charged_kwh
      ) VALUES (
        complex_rec.id,
        floor(random() * 90 + 10)::text || '나 ' || plate_suffix::text,
        'P' || floor(random() * 5 + 1)::text || '-' || LPAD(floor(random() * 50 + 1)::text, 3, '0'),
        floor(random() * 6 - 3)::integer,
        atr_rec.id,
        elev_rec.id,
        'parked',
        entry_time, park_time,
        0, 0,
        is_electric,
        CASE WHEN is_electric THEN round((random() * 10)::numeric, 1) ELSE 0 END
      );
    END LOOP;
  END LOOP;
END $$;
