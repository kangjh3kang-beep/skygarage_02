/*
  # Create SkyGarage System Management Tables

  1. New Tables
    - `complexes` - Registered apartment/building complexes with SkyGarage installed
      - `id` (uuid, primary key)
      - `name` (text) - complex name
      - `code` (text, unique) - internal code like "SG-GN-001"
      - `address` (text) - full address
      - `region` (text) - region code: KR, SG, AE, US, EU
      - `total_units` (integer) - number of residential units (households)
      - `total_parking_slots` (integer) - total parking capacity
      - `status` (text) - operational status: 'active', 'maintenance', 'offline', 'poc'
      - `commissioned_at` (timestamptz) - when system went live
      - `created_at` (timestamptz)

    - `atr_units` - Autonomous Transfer Robot units
      - `id` (uuid, primary key)
      - `unit_code` (text, unique) - robot ID like "ATR-001"
      - `complex_id` (uuid, FK) - which complex this belongs to
      - `status` (text) - 'idle', 'transporting', 'charging', 'maintenance', 'error', 'offline'
      - `battery_level` (integer) - 0-100 percentage
      - `current_floor` (integer) - current floor location
      - `total_cycles` (integer) - lifetime transfer count
      - `error_code` (text, nullable) - active error if any
      - `last_heartbeat` (timestamptz) - last status ping
      - `created_at` (timestamptz)

    - `elevators` - Vehicle elevators [300] managed by the system
      - `id` (uuid, primary key)
      - `elevator_code` (text, unique) - like "ELV-A1"
      - `complex_id` (uuid, FK)
      - `vendor` (text) - manufacturer: 'otis', 'kone', 'hyundai', 'thyssenkrupp', 'generic'
      - `status` (text) - 'operational', 'occupied', 'maintenance', 'error', 'offline'
      - `current_floor` (integer)
      - `max_floor` (integer) - top floor
      - `min_floor` (integer) - bottom floor (can be negative for basement)
      - `load_kg` (integer) - max load capacity in kg
      - `total_trips` (integer) - lifetime trip count
      - `last_maintenance` (timestamptz)
      - `created_at` (timestamptz)

    - `safety_events` - Safety chain events and ALLOW gate log
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK)
      - `atr_id` (uuid, FK, nullable)
      - `elevator_id` (uuid, FK, nullable)
      - `event_type` (text) - 'allow_gate', 'safety_stop', 'emergency', 'interlock', 'system_check'
      - `severity` (text) - 'info', 'warning', 'critical'
      - `description` (text) - human-readable description
      - `result` (text) - 'pass', 'fail', 'triggered'
      - `metadata` (jsonb) - additional event data
      - `created_at` (timestamptz)

    - `system_metrics` - Periodic system health metrics
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK)
      - `metric_type` (text) - 'availability', 'throughput', 'latency', 'energy'
      - `value` (numeric) - metric value
      - `unit` (text) - measurement unit
      - `recorded_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Authenticated admin users can read/write

  3. Indexes
    - Complex status + region for dashboard queries
    - ATR status + complex for fleet views
    - Safety events by time and severity
*/

-- Complexes table
CREATE TABLE IF NOT EXISTS complexes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT 'KR',
  total_units integer NOT NULL DEFAULT 0,
  total_parking_slots integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'poc',
  commissioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read complexes"
  ON complexes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert complexes"
  ON complexes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update complexes"
  ON complexes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ATR Units table
CREATE TABLE IF NOT EXISTS atr_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code text UNIQUE NOT NULL,
  complex_id uuid NOT NULL REFERENCES complexes(id),
  status text NOT NULL DEFAULT 'offline',
  battery_level integer NOT NULL DEFAULT 100,
  current_floor integer NOT NULL DEFAULT 1,
  total_cycles integer NOT NULL DEFAULT 0,
  error_code text,
  last_heartbeat timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE atr_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read atr_units"
  ON atr_units FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert atr_units"
  ON atr_units FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update atr_units"
  ON atr_units FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_atr_units_complex_status ON atr_units(complex_id, status);

-- Elevators table
CREATE TABLE IF NOT EXISTS elevators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_code text UNIQUE NOT NULL,
  complex_id uuid NOT NULL REFERENCES complexes(id),
  vendor text NOT NULL DEFAULT 'generic',
  status text NOT NULL DEFAULT 'offline',
  current_floor integer NOT NULL DEFAULT 1,
  max_floor integer NOT NULL DEFAULT 30,
  min_floor integer NOT NULL DEFAULT -3,
  load_kg integer NOT NULL DEFAULT 5000,
  total_trips integer NOT NULL DEFAULT 0,
  last_maintenance timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read elevators"
  ON elevators FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert elevators"
  ON elevators FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update elevators"
  ON elevators FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_elevators_complex_status ON elevators(complex_id, status);

-- Safety Events table
CREATE TABLE IF NOT EXISTS safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  atr_id uuid REFERENCES atr_units(id),
  elevator_id uuid REFERENCES elevators(id),
  event_type text NOT NULL DEFAULT 'system_check',
  severity text NOT NULL DEFAULT 'info',
  description text NOT NULL,
  result text NOT NULL DEFAULT 'pass',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read safety_events"
  ON safety_events FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert safety_events"
  ON safety_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_safety_events_time ON safety_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_severity ON safety_events(severity, created_at DESC);

-- System Metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  metric_type text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system_metrics"
  ON system_metrics FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert system_metrics"
  ON system_metrics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_system_metrics_complex_type ON system_metrics(complex_id, metric_type, recorded_at DESC);
