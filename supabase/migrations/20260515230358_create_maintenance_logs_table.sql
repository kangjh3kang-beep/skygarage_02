/*
  # Create maintenance_logs table

  1. New Tables
    - `maintenance_logs`
      - `id` (uuid, primary key) - unique maintenance record
      - `complex_id` (uuid, FK to complexes) - which complex this belongs to
      - `target_type` (text) - 'atr' or 'elevator'
      - `target_id` (uuid) - references atr_units.id or elevators.id
      - `target_code` (text) - display code of the unit (ATR-001, ELV-A1, etc.)
      - `maintenance_type` (text) - 'preventive', 'corrective', 'emergency', 'inspection'
      - `status` (text) - 'scheduled', 'in_progress', 'completed', 'cancelled'
      - `priority` (text) - 'low', 'medium', 'high', 'critical'
      - `title` (text) - short description of maintenance task
      - `description` (text) - detailed description
      - `scheduled_at` (timestamptz) - when the maintenance is planned
      - `started_at` (timestamptz, nullable) - when it actually started
      - `completed_at` (timestamptz, nullable) - when it was completed
      - `technician` (text) - assigned technician name
      - `parts_used` (jsonb) - array of parts/components replaced
      - `cost` (numeric) - maintenance cost in KRW
      - `notes` (text) - additional notes
      - `created_at` (timestamptz) - record creation time

  2. Security
    - Enable RLS on `maintenance_logs` table
    - Add policy for authenticated users to read maintenance data
    - Add policy for authenticated users to insert maintenance logs
    - Add policy for authenticated users to update maintenance logs

  3. Notes
    - Supports both ATR and elevator maintenance tracking
    - Enables preventive maintenance scheduling and lifecycle analytics
    - Parts tracking for inventory management
*/

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  target_type text NOT NULL DEFAULT 'atr',
  target_id uuid NOT NULL,
  target_code text NOT NULL DEFAULT '',
  maintenance_type text NOT NULL DEFAULT 'preventive',
  status text NOT NULL DEFAULT 'scheduled',
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  technician text NOT NULL DEFAULT '',
  parts_used jsonb DEFAULT '[]'::jsonb,
  cost numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read maintenance logs"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance logs"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update maintenance logs"
  ON maintenance_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance logs"
  ON maintenance_logs FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed sample maintenance data
INSERT INTO maintenance_logs (complex_id, target_type, target_id, target_code, maintenance_type, status, priority, title, description, scheduled_at, completed_at, technician, cost)
SELECT
  c.id,
  'atr',
  a.id,
  a.unit_code,
  'preventive',
  'completed',
  'medium',
  '정기 배터리 점검',
  'ATR 배터리 잔량 및 충전 사이클 점검, 셀 밸런싱 확인',
  now() - interval '7 days',
  now() - interval '6 days',
  '김정비',
  150000
FROM complexes c
JOIN atr_units a ON a.complex_id = c.id
LIMIT 3;

INSERT INTO maintenance_logs (complex_id, target_type, target_id, target_code, maintenance_type, status, priority, title, description, scheduled_at, technician, cost)
SELECT
  c.id,
  'elevator',
  e.id,
  e.elevator_code,
  'preventive',
  'scheduled',
  'low',
  '엘리베이터 와이어 로프 점검',
  '와이어 로프 마모도 측정 및 윤활유 보충',
  now() + interval '3 days',
  '박기술',
  280000
FROM complexes c
JOIN elevators e ON e.complex_id = c.id
LIMIT 2;

INSERT INTO maintenance_logs (complex_id, target_type, target_id, target_code, maintenance_type, status, priority, title, description, scheduled_at, started_at, technician, cost)
SELECT
  c.id,
  'atr',
  a.id,
  a.unit_code,
  'corrective',
  'in_progress',
  'high',
  '구동 모터 이상 진동 수리',
  '좌측 구동 모터에서 비정상 진동 감지, 베어링 교체 필요',
  now() - interval '1 day',
  now() - interval '4 hours',
  '이수리',
  520000
FROM complexes c
JOIN atr_units a ON a.complex_id = c.id
WHERE a.status = 'maintenance' OR a.status = 'error'
LIMIT 1;
