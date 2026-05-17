/*
  # Create system_alerts table for incident tracking

  1. New Tables
    - `system_alerts`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes) - affected complex
      - `category` (text) - 'hardware', 'security', 'energy', 'parking', 'network'
      - `severity` (text) - 'critical', 'warning', 'info'
      - `title` (text) - short alert title
      - `description` (text) - detailed description
      - `source` (text) - originating subsystem (e.g. 'ATR-SJ-003', 'ELV-PG-A', 'GATE-A1')
      - `status` (text) - 'active', 'acknowledged', 'resolved', 'dismissed'
      - `assigned_to` (text) - operator name
      - `resolved_at` (timestamptz, nullable) - resolution time
      - `created_at` (timestamptz) - alert trigger time

  2. Security
    - Enable RLS
    - Policies for authenticated admin access

  3. Notes
    - Tracks all system incidents and alerts
    - Supports severity-based prioritization
    - Resolution workflow with assignment
*/

CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  category text NOT NULL DEFAULT 'hardware',
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  assigned_to text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system alerts"
  ON system_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert system alerts"
  ON system_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update system alerts"
  ON system_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed alert data
DO $$
DECLARE
  complex_rec RECORD;
  alert_titles text[][] := ARRAY[
    ARRAY['ATR 배터리 저전압 경고', 'hardware', 'warning'],
    ARRAY['엘리베이터 도어 센서 이상', 'hardware', 'critical'],
    ARRAY['ALLOW Gate 인증 실패 급증', 'security', 'warning'],
    ARRAY['태양광 인버터 출력 저하', 'energy', 'warning'],
    ARRAY['주차 센서 통신 장애', 'parking', 'critical'],
    ARRAY['미등록 차량 반복 접근', 'security', 'info'],
    ARRAY['ATR 경로 충돌 감지', 'hardware', 'critical'],
    ARRAY['EV 충전기 과열 감지', 'energy', 'warning'],
    ARRAY['네트워크 지연 증가', 'network', 'info'],
    ARRAY['비상정지 스위치 작동', 'hardware', 'critical'],
    ARRAY['화재감지기 점검 필요', 'security', 'info'],
    ARRAY['주차장 환기팬 이상', 'hardware', 'warning']
  ];
  sources text[] := ARRAY['ATR-SJ-003', 'ELV-PG-A', 'GATE-A1', 'SOLAR-INV-02', 'SENSOR-P2-015', 'GATE-B2', 'ATR-SJ-007', 'EVC-03', 'SWITCH-CORE', 'ATR-SJ-001', 'SMOKE-3F', 'FAN-B2'];
  operators text[] := ARRAY['김정비', '박기술', '이수리', '최운영'];
  statuses text[] := ARRAY['active', 'active', 'acknowledged', 'resolved', 'resolved'];
  i integer;
  alert_idx integer;
  stat text;
BEGIN
  FOR complex_rec IN SELECT id FROM complexes LOOP
    FOR i IN 1..4 LOOP
      alert_idx := 1 + floor(random() * array_length(alert_titles, 1))::int;
      stat := statuses[1 + floor(random() * array_length(statuses, 1))::int];

      INSERT INTO system_alerts (
        complex_id, category, severity, title, description, source,
        status, assigned_to, resolved_at, created_at
      ) VALUES (
        complex_rec.id,
        alert_titles[alert_idx][2],
        alert_titles[alert_idx][3],
        alert_titles[alert_idx][1],
        alert_titles[alert_idx][1] || ' - 자동 감지됨. 현장 확인 필요.',
        sources[alert_idx],
        stat,
        CASE WHEN stat IN ('acknowledged', 'resolved') THEN operators[1 + floor(random() * array_length(operators, 1))::int] ELSE '' END,
        CASE WHEN stat = 'resolved' THEN now() - (floor(random() * 60)::int * interval '1 minute') ELSE NULL END,
        now() - (floor(random() * 2880)::int * interval '1 minute')
      );
    END LOOP;
  END LOOP;
END $$;
