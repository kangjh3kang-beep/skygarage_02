/*
  # Create access_logs table for ALLOW Gate entry/exit tracking

  1. New Tables
    - `access_logs`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes) - which complex
      - `resident_id` (uuid, nullable FK to resident_accounts) - linked resident if identified
      - `card_id` (text) - RFID/NFC card identifier
      - `plate_number` (text) - detected license plate
      - `gate_id` (text) - gate terminal identifier (e.g. 'GATE-A1-IN', 'GATE-B2-OUT')
      - `direction` (text) - 'entry' or 'exit'
      - `auth_method` (text) - 'rfid', 'plate_recognition', 'manual', 'app'
      - `status` (text) - 'granted', 'denied', 'timeout'
      - `deny_reason` (text, nullable) - reason if denied
      - `timestamp` (timestamptz) - event time
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for authenticated admin access

  3. Notes
    - Tracks all gate entry/exit events across complexes
    - Links to residents for authorized access tracking
    - Records denied attempts for security monitoring
*/

CREATE TABLE IF NOT EXISTS access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  resident_id uuid REFERENCES resident_accounts(id),
  card_id text NOT NULL DEFAULT '',
  plate_number text NOT NULL DEFAULT '',
  gate_id text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'entry',
  auth_method text NOT NULL DEFAULT 'rfid',
  status text NOT NULL DEFAULT 'granted',
  deny_reason text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read access logs"
  ON access_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert access logs"
  ON access_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed realistic access log data for last 24 hours
DO $$
DECLARE
  complex_rec RECORD;
  resident_rec RECORD;
  i integer;
  ts timestamptz;
  dir text;
  method text;
  gate_suffix text;
  stat text;
BEGIN
  FOR complex_rec IN SELECT id FROM complexes WHERE status = 'active' LOOP
    FOR i IN 1..25 LOOP
      ts := now() - (floor(random() * 1440)::int * interval '1 minute');
      dir := CASE WHEN random() < 0.55 THEN 'entry' ELSE 'exit' END;
      method := (ARRAY['rfid', 'plate_recognition', 'rfid', 'app', 'rfid'])[1 + floor(random() * 5)::int];
      gate_suffix := CASE WHEN dir = 'entry' THEN 'IN' ELSE 'OUT' END;
      stat := CASE WHEN random() < 0.92 THEN 'granted' WHEN random() < 0.96 THEN 'denied' ELSE 'timeout' END;

      -- Try to link to a resident
      SELECT id, access_card_id INTO resident_rec
        FROM resident_accounts
        WHERE complex_id = complex_rec.id
        ORDER BY random() LIMIT 1;

      INSERT INTO access_logs (
        complex_id, resident_id, card_id, plate_number, gate_id,
        direction, auth_method, status, deny_reason, timestamp
      ) VALUES (
        complex_rec.id,
        CASE WHEN random() < 0.8 THEN resident_rec.id ELSE NULL END,
        CASE WHEN resident_rec.access_card_id IS NOT NULL THEN resident_rec.access_card_id
             ELSE 'CARD-' || LPAD(floor(random() * 99999)::text, 5, '0') END,
        (10 + floor(random() * 90)::int)::text ||
          (ARRAY['가','나','다','라','마','바','사','아'])[1 + floor(random() * 8)::int] || ' ' ||
          (1000 + floor(random() * 9000)::int)::text,
        'GATE-' || chr(65 + floor(random() * 3)::int) || (1 + floor(random() * 2)::int)::text || '-' || gate_suffix,
        dir, method, stat,
        CASE WHEN stat = 'denied' THEN
          (ARRAY['카드 만료', '미등록 차량', '정지 계정', '인식 실패'])[1 + floor(random() * 4)::int]
        ELSE NULL END,
        ts
      );
    END LOOP;
  END LOOP;
END $$;
