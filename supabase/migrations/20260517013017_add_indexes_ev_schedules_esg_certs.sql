/*
  # Performance Indexes + EV Charging Schedules + ESG Certifications

  1. New Tables
    - `ev_charging_schedules` - EV charge/discharge scheduling for V2G
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes)
      - `vehicle_id`, `plate`, `battery_level`, `action`, `scheduled_time`
      - `energy_kwh`, `status`, `priority`, `created_at`
    - `esg_certifications` - ESG certification tracking
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK, nullable)
      - `cert_name`, `cert_code`, `status`, `issued_by`
      - `issued_date`, `expiry_date`, `notes`, `created_at`

  2. Performance Indexes
    - parking_sessions, support_tickets, crm_leads, billing_invoices
    - maintenance_logs, event_log, access_logs, energy_metrics, observability_metrics

  3. Security
    - RLS enabled on both new tables
    - Authenticated user policies for CRUD
*/

-- EV Charging Schedules
CREATE TABLE IF NOT EXISTS ev_charging_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL,
  plate text NOT NULL,
  battery_level integer NOT NULL DEFAULT 50,
  action text NOT NULL DEFAULT 'idle',
  scheduled_time timestamptz NOT NULL DEFAULT now(),
  energy_kwh numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ev_charging_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ev schedules"
  ON ev_charging_schedules FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert ev schedules"
  ON ev_charging_schedules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update ev schedules"
  ON ev_charging_schedules FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete ev schedules"
  ON ev_charging_schedules FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ESG Certifications
CREATE TABLE IF NOT EXISTS esg_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  cert_name text NOT NULL,
  cert_code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'preparing',
  issued_by text NOT NULL DEFAULT '',
  issued_date date,
  expiry_date date,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE esg_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view esg certs"
  ON esg_certifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert esg certs"
  ON esg_certifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update esg certs"
  ON esg_certifications FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete esg certs"
  ON esg_certifications FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parking_sessions_complex_status 
  ON parking_sessions(complex_id, status);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_entry_at 
  ON parking_sessions(entry_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_complex_status 
  ON support_tickets(complex_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage 
  ON crm_leads(stage);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_complex_status 
  ON billing_invoices(complex_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_complex_status 
  ON maintenance_logs(complex_id, status);

CREATE INDEX IF NOT EXISTS idx_event_log_tier_created 
  ON event_log(source_tier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_logs_complex_timestamp 
  ON access_logs(complex_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_metrics_complex_date 
  ON energy_metrics(complex_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_observability_source_recorded 
  ON observability_metrics(source, recorded_at DESC);

-- Seed EV schedules
INSERT INTO ev_charging_schedules (complex_id, vehicle_id, plate, battery_level, action, scheduled_time, energy_kwh, status, priority)
SELECT 
  c.id,
  'EV-' || gs.n,
  CASE gs.n
    WHEN 1 THEN '12가 3456' WHEN 2 THEN '34나 7890' WHEN 3 THEN '56다 1234'
    WHEN 4 THEN '78라 5678' WHEN 5 THEN '90마 9012' WHEN 6 THEN '11바 3344'
    WHEN 7 THEN '22사 5566' WHEN 8 THEN '33아 7788' ELSE '44자 9900' END,
  20 + (gs.n * 7) % 70,
  CASE WHEN gs.n % 3 = 0 THEN 'charging' WHEN gs.n % 3 = 1 THEN 'discharging' ELSE 'idle' END,
  now() + (gs.n || ' hours')::interval,
  5 + (gs.n * 3) % 30,
  CASE WHEN gs.n <= 3 THEN 'active' WHEN gs.n <= 6 THEN 'scheduled' ELSE 'completed' END,
  CASE WHEN gs.n % 3 = 1 THEN 2 ELSE 1 END
FROM complexes c
CROSS JOIN generate_series(1, 8) AS gs(n)
WHERE c.status = 'active'
LIMIT 24;

-- Seed ESG certifications
INSERT INTO esg_certifications (cert_name, cert_code, status, issued_by, issued_date, expiry_date, notes)
VALUES
  ('ISO 14001', 'ISO-14001:2015', 'completed', 'BSI Korea', '2025-03-15', '2028-03-14', '환경경영시스템 인증'),
  ('ISO 50001', 'ISO-50001:2018', 'in_progress', 'KAB', NULL, NULL, '에너지경영시스템 인증 진행중'),
  ('GRI Standards', 'GRI-2021', 'preparing', 'GRI', NULL, NULL, '지속가능성 보고 표준 준비'),
  ('K-EV100', 'KEV100-2025', 'completed', '환경부', '2025-01-10', '2027-01-09', '전기차 100% 전환 선언'),
  ('SBTi', 'SBTi-NZ', 'in_progress', 'SBTi', NULL, NULL, '과학기반 감축목표 설정 중');

-- Seed observability metrics
INSERT INTO observability_metrics (metric_name, tier, source, value, unit, recorded_at)
SELECT 
  metric.name,
  comp.tier,
  comp.source_name,
  metric.base_val + (random() * metric.variance),
  metric.unit,
  now() - (gs.n * 5 || ' minutes')::interval
FROM (VALUES 
  ('T0', 'supabase_db'), ('T0', 'auth_service'), ('T0', 'edge_functions'), 
  ('T1', 'realtime_engine'), ('T2', 'workflow_engine'), ('T0', 'ai_agent_aegis'),
  ('T1', 'ai_agent_aurora'), ('T2', 'ai_agent_atlas'), ('T3', 'atr_fleet_control'),
  ('T3', 'elevator_gateway'), ('T2', 'energy_monitor'), ('T0', 'storage_service')
) AS comp(tier, source_name)
CROSS JOIN (VALUES
  ('response_time', 25.0, 40.0, 'ms'),
  ('error_rate', 0.01, 0.05, 'percent'),
  ('throughput', 800.0, 600.0, 'req_per_s'),
  ('uptime', 99.8, 0.19, 'percent')
) AS metric(name, base_val, variance, unit)
CROSS JOIN generate_series(1, 5) AS gs(n);
