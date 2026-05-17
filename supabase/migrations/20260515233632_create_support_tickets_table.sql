/*
  # Create support_tickets table (M21 Customer Support)

  1. New Tables
    - `support_tickets`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes) - affected complex
      - `resident_id` (uuid, nullable FK to resident_accounts) - reporter
      - `ticket_number` (text) - human-readable ticket ID (e.g. 'TK-20260515-001')
      - `channel` (text) - 'app', 'phone', 'email', 'chat', 'walk_in'
      - `priority` (text) - 'P0', 'P1', 'P2', 'P3'
      - `category` (text) - 'parking', 'billing', 'access', 'damage', 'system', 'other'
      - `subject` (text) - short title
      - `description` (text) - full description
      - `status` (text) - 'open', 'in_progress', 'waiting', 'resolved', 'closed'
      - `assigned_to` (text) - operator name
      - `sla_due_at` (timestamptz) - SLA deadline
      - `first_response_at` (timestamptz, nullable) - first response time
      - `resolved_at` (timestamptz, nullable) - resolution time
      - `satisfaction` (integer, nullable) - 1-5 rating
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for authenticated admin access

  3. Notes
    - Maps to M21 Customer Support module
    - SLA tracking with P0=30min, P1=2h, P2=8h, P3=24h
    - Multi-channel intake (app, phone, email, chat)
    - CSAT collection after resolution
*/

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  resident_id uuid REFERENCES resident_accounts(id),
  ticket_number text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'app',
  priority text NOT NULL DEFAULT 'P2',
  category text NOT NULL DEFAULT 'other',
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  assigned_to text NOT NULL DEFAULT '',
  sla_due_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours'),
  first_response_at timestamptz,
  resolved_at timestamptz,
  satisfaction integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read support tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert support tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update support tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed support ticket data
DO $$
DECLARE
  complex_rec RECORD;
  resident_rec RECORD;
  i integer;
  created timestamptz;
  prio text;
  sla_hours integer;
  cat text;
  stat text;
  subj text;
  subjects text[][] := ARRAY[
    ARRAY['주차 위치 변경 요청', 'parking', 'P3'],
    ARRAY['차량 손상 신고', 'damage', 'P0'],
    ARRAY['출입카드 미작동', 'access', 'P1'],
    ARRAY['월 정산 오류', 'billing', 'P2'],
    ARRAY['ATR 이송 지연', 'system', 'P1'],
    ARRAY['EV 충전 불가', 'system', 'P2'],
    ARRAY['앱 로그인 실패', 'system', 'P3'],
    ARRAY['소음 민원', 'other', 'P3'],
    ARRAY['입출차 기록 불일치', 'parking', 'P2'],
    ARRAY['게스트 출입 요청', 'access', 'P3']
  ];
  subj_idx integer;
  channels text[] := ARRAY['app', 'phone', 'email', 'chat', 'app', 'app'];
  operators text[] := ARRAY['김상담', '박지원', '이고객', '최응대'];
  statuses text[] := ARRAY['open', 'in_progress', 'resolved', 'resolved', 'closed'];
BEGIN
  FOR complex_rec IN SELECT id FROM complexes WHERE status = 'active' LOOP
    FOR i IN 1..5 LOOP
      subj_idx := 1 + floor(random() * array_length(subjects, 1))::int;
      created := now() - (floor(random() * 168)::int * interval '1 hour');
      prio := subjects[subj_idx][3];
      sla_hours := CASE prio WHEN 'P0' THEN 1 WHEN 'P1' THEN 2 WHEN 'P2' THEN 8 ELSE 24 END;
      stat := statuses[1 + floor(random() * array_length(statuses, 1))::int];

      SELECT id INTO resident_rec FROM resident_accounts WHERE complex_id = complex_rec.id ORDER BY random() LIMIT 1;

      INSERT INTO support_tickets (
        complex_id, resident_id, ticket_number, channel, priority, category,
        subject, description, status, assigned_to, sla_due_at,
        first_response_at, resolved_at, satisfaction, created_at
      ) VALUES (
        complex_rec.id,
        resident_rec.id,
        'TK-' || to_char(created, 'YYYYMMDD') || '-' || LPAD((floor(random() * 999) + 1)::text, 3, '0'),
        channels[1 + floor(random() * array_length(channels, 1))::int],
        prio,
        subjects[subj_idx][2],
        subjects[subj_idx][1],
        subjects[subj_idx][1] || ' 관련 상세 내용입니다. 빠른 처리 부탁드립니다.',
        stat,
        CASE WHEN stat != 'open' THEN operators[1 + floor(random() * array_length(operators, 1))::int] ELSE '' END,
        created + (sla_hours * interval '1 hour'),
        CASE WHEN stat != 'open' THEN created + (floor(random() * 30 + 5)::int * interval '1 minute') ELSE NULL END,
        CASE WHEN stat IN ('resolved', 'closed') THEN created + (floor(random() * sla_hours * 60)::int * interval '1 minute') ELSE NULL END,
        CASE WHEN stat IN ('resolved', 'closed') AND random() < 0.7 THEN 3 + floor(random() * 3)::int ELSE NULL END,
        created
      );
    END LOOP;
  END LOOP;
END $$;
