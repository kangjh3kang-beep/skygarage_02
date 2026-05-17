/*
  # Create billing invoices table

  1. New Tables
    - `billing_invoices`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, references complexes)
      - `invoice_number` (text, unique) - e.g., INV-2026-0001
      - `resident_id` (uuid, nullable, references resident_accounts)
      - `type` (text) - subscription, parking, ev_charging, v2g_sale, penalty, other
      - `status` (text) - draft, issued, paid, overdue, cancelled
      - `amount` (numeric) - total amount in KRW
      - `tax_amount` (numeric) - VAT
      - `issued_at` (timestamptz) - when invoice was issued
      - `due_at` (timestamptz) - payment due date
      - `paid_at` (timestamptz, nullable) - when payment was received
      - `payment_method` (text, nullable) - card, transfer, auto_debit
      - `description` (text) - invoice description
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `billing_invoices` table
    - Add policy for authenticated users to read data
    - Add policy for authenticated users to insert/update data

  3. Seed Data
    - 30 sample invoices across different types and statuses
*/

CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  resident_id uuid REFERENCES resident_accounts(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'subscription',
  status text NOT NULL DEFAULT 'draft',
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read billing invoices"
  ON billing_invoices FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert billing invoices"
  ON billing_invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update billing invoices"
  ON billing_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed data
INSERT INTO billing_invoices (complex_id, invoice_number, type, status, amount, tax_amount, issued_at, due_at, paid_at, payment_method, description) VALUES
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0001', 'subscription', 'paid', 1500000, 150000, now() - interval '30 days', now() - interval '15 days', now() - interval '18 days', 'auto_debit', '5월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0002', 'parking', 'paid', 850000, 85000, now() - interval '28 days', now() - interval '13 days', now() - interval '14 days', 'card', '추가 주차 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0003', 'ev_charging', 'paid', 320000, 32000, now() - interval '25 days', now() - interval '10 days', now() - interval '11 days', 'transfer', 'EV 충전 요금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0004', 'subscription', 'issued', 1500000, 150000, now() - interval '5 days', now() + interval '10 days', NULL, NULL, '6월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0005', 'v2g_sale', 'paid', 450000, 45000, now() - interval '20 days', now() - interval '5 days', now() - interval '6 days', 'transfer', 'V2G 전력판매 정산'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0006', 'subscription', 'paid', 2200000, 220000, now() - interval '30 days', now() - interval '15 days', now() - interval '16 days', 'auto_debit', '5월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0007', 'parking', 'overdue', 1100000, 110000, now() - interval '35 days', now() - interval '20 days', NULL, NULL, '추가 주차 이용료 (미납)'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0008', 'ev_charging', 'issued', 580000, 58000, now() - interval '3 days', now() + interval '12 days', NULL, NULL, 'EV 충전 요금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0009', 'subscription', 'issued', 2200000, 220000, now() - interval '5 days', now() + interval '10 days', NULL, NULL, '6월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0010', 'penalty', 'paid', 50000, 5000, now() - interval '15 days', now() - interval '5 days', now() - interval '7 days', 'card', '장기 점유 위약금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0011', 'subscription', 'paid', 1500000, 150000, now() - interval '60 days', now() - interval '45 days', now() - interval '47 days', 'auto_debit', '4월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0012', 'parking', 'paid', 720000, 72000, now() - interval '58 days', now() - interval '43 days', now() - interval '44 days', 'card', '추가 주차 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0013', 'ev_charging', 'paid', 280000, 28000, now() - interval '55 days', now() - interval '40 days', now() - interval '41 days', 'transfer', 'EV 충전 요금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0014', 'subscription', 'paid', 2200000, 220000, now() - interval '60 days', now() - interval '45 days', now() - interval '46 days', 'auto_debit', '4월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0015', 'parking', 'paid', 980000, 98000, now() - interval '58 days', now() - interval '43 days', now() - interval '44 days', 'card', '추가 주차 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0016', 'subscription', 'paid', 1500000, 150000, now() - interval '90 days', now() - interval '75 days', now() - interval '76 days', 'auto_debit', '3월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0017', 'v2g_sale', 'paid', 380000, 38000, now() - interval '50 days', now() - interval '35 days', now() - interval '36 days', 'transfer', 'V2G 전력판매 정산'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0018', 'ev_charging', 'paid', 510000, 51000, now() - interval '55 days', now() - interval '40 days', now() - interval '41 days', 'transfer', 'EV 충전 요금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0019', 'other', 'cancelled', 200000, 20000, now() - interval '40 days', now() - interval '25 days', NULL, NULL, '기타 부대비용 (취소)'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0020', 'subscription', 'paid', 2200000, 220000, now() - interval '90 days', now() - interval '75 days', now() - interval '76 days', 'auto_debit', '3월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0021', 'parking', 'paid', 650000, 65000, now() - interval '88 days', now() - interval '73 days', now() - interval '74 days', 'card', '추가 주차 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0022', 'penalty', 'issued', 100000, 10000, now() - interval '2 days', now() + interval '13 days', NULL, NULL, '무단 장기주차 위약금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0023', 'ev_charging', 'draft', 410000, 41000, NULL, NULL, NULL, NULL, 'EV 충전 요금 (작성중)'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0024', 'v2g_sale', 'paid', 520000, 52000, now() - interval '48 days', now() - interval '33 days', now() - interval '34 days', 'transfer', 'V2G 전력판매 정산'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0025', 'subscription', 'overdue', 1500000, 150000, now() - interval '45 days', now() - interval '30 days', NULL, NULL, '미납 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0026', 'parking', 'paid', 870000, 87000, now() - interval '85 days', now() - interval '70 days', now() - interval '71 days', 'auto_debit', '추가 주차 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0027', 'other', 'paid', 150000, 15000, now() - interval '22 days', now() - interval '7 days', now() - interval '8 days', 'card', '부대시설 이용료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0028', 'ev_charging', 'paid', 490000, 49000, now() - interval '25 days', now() - interval '10 days', now() - interval '11 days', 'transfer', 'EV 충전 요금'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'INV-2026-0029', 'subscription', 'paid', 1500000, 150000, now() - interval '120 days', now() - interval '105 days', now() - interval '106 days', 'auto_debit', '2월 정기 구독료'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'INV-2026-0030', 'subscription', 'paid', 2200000, 220000, now() - interval '120 days', now() - interval '105 days', now() - interval '106 days', 'auto_debit', '2월 정기 구독료');
