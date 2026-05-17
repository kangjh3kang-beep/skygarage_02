/*
  # Create team members table

  1. New Tables
    - `team_members`
      - `id` (uuid, primary key)
      - `name` (text) - full name
      - `email` (text, unique)
      - `role` (text) - admin, operator, technician, manager, support
      - `department` (text) - operations, maintenance, support, engineering, management
      - `position` (text) - job title
      - `phone` (text)
      - `assigned_complex_id` (uuid, nullable, references complexes)
      - `status` (text) - active, on_leave, resigned
      - `certifications` (text[]) - list of certifications
      - `hire_date` (date)
      - `last_active_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `team_members` table
    - Add policy for authenticated users to read
    - Add policy for authenticated users to manage

  3. Seed Data
    - 12 team members across roles
*/

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  department text NOT NULL DEFAULT 'operations',
  position text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  assigned_complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  certifications text[] DEFAULT '{}',
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed data
INSERT INTO team_members (name, email, role, department, position, phone, assigned_complex_id, status, certifications, hire_date, last_active_at) VALUES
  ('김재현', 'admin@skygarage.io', 'admin', 'management', '대표이사', '010-1234-5678', NULL, 'active', '{"경영학석사", "PMP"}', '2024-01-15', now() - interval '10 minutes'),
  ('박수진', 'sjpark@skygarage.io', 'manager', 'operations', '운영총괄', '010-2345-6789', NULL, 'active', '{"주차관리사", "안전관리사"}', '2024-03-01', now() - interval '30 minutes'),
  ('이민호', 'mhlee@skygarage.io', 'operator', 'operations', '현장관제사', '010-3456-7890', (SELECT id FROM complexes LIMIT 1 OFFSET 0), 'active', '{"CCTV관제사", "소방안전관리자"}', '2024-06-10', now() - interval '1 hour'),
  ('최영수', 'yschoi@skygarage.io', 'technician', 'maintenance', '정비기사', '010-4567-8901', (SELECT id FROM complexes LIMIT 1 OFFSET 0), 'active', '{"전기기능사", "승강기기능사", "로봇정비사"}', '2024-05-20', now() - interval '2 hours'),
  ('정유나', 'ynjung@skygarage.io', 'operator', 'operations', '현장관제사', '010-5678-9012', (SELECT id FROM complexes LIMIT 1 OFFSET 1), 'active', '{"CCTV관제사"}', '2024-08-15', now() - interval '3 hours'),
  ('한동석', 'dshan@skygarage.io', 'technician', 'maintenance', '정비팀장', '010-6789-0123', NULL, 'active', '{"전기기사", "승강기기사", "로봇정비사", "PLC자격"}', '2024-04-01', now() - interval '5 hours'),
  ('오지은', 'jeoh@skygarage.io', 'support', 'support', '고객지원 매니저', '010-7890-1234', NULL, 'active', '{"CS매니저", "컴플레인관리사"}', '2024-07-01', now() - interval '1 day'),
  ('강현우', 'hwkang@skygarage.io', 'operator', 'engineering', '시스템엔지니어', '010-8901-2345', NULL, 'active', '{"정보처리기사", "CCNA", "AWS-SAA"}', '2024-09-01', now() - interval '6 hours'),
  ('서미라', 'mrseo@skygarage.io', 'support', 'support', '고객상담원', '010-9012-3456', NULL, 'active', '{"CS전문가"}', '2025-01-10', now() - interval '4 hours'),
  ('윤태현', 'thyoon@skygarage.io', 'technician', 'maintenance', 'EV충전 정비사', '010-0123-4567', (SELECT id FROM complexes LIMIT 1 OFFSET 1), 'active', '{"전기기능사", "EV충전인프라관리사"}', '2025-02-15', now() - interval '8 hours'),
  ('임서연', 'syim@skygarage.io', 'manager', 'management', '재무/경영지원', '010-1111-2222', NULL, 'active', '{"회계사", "세무사"}', '2024-02-01', now() - interval '2 days'),
  ('배준호', 'jhbae@skygarage.io', 'operator', 'operations', '야간관제사', '010-3333-4444', (SELECT id FROM complexes LIMIT 1 OFFSET 0), 'on_leave', '{"CCTV관제사", "소방안전관리자"}', '2024-10-01', now() - interval '5 days');
