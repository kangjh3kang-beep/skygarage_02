/*
  # Create contracts and partners tables (M22 Legal + M27 Partner)

  1. New Tables
    - `contracts`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, nullable FK to complexes)
      - `contract_number` (text) - unique contract identifier
      - `title` (text) - contract title
      - `type` (text) - 'construction', 'management', 'resident', 'vendor', 'insurance', 'license'
      - `counterparty` (text) - partner/client name
      - `value_krw` (numeric) - contract value in KRW
      - `start_date` (date) - effective start
      - `end_date` (date) - expiration
      - `auto_renew` (boolean) - auto-renewal flag
      - `status` (text) - 'draft', 'active', 'expiring', 'expired', 'terminated'
      - `signed_at` (timestamptz, nullable) - signature date
      - `created_at` (timestamptz)

    - `partners`
      - `id` (uuid, primary key)
      - `name` (text) - partner/vendor name
      - `category` (text) - 'constructor', 'elevator', 'ev_charger', 'security', 'insurance', 'telecom', 'cleaning', 'government'
      - `contact_name` (text) - primary contact
      - `contact_email` (text)
      - `contact_phone` (text)
      - `contract_id` (uuid, nullable FK to contracts)
      - `sla_score` (numeric) - SLA compliance score 0-100
      - `integration_status` (text) - 'connected', 'pending', 'disconnected'
      - `last_activity_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated admin access

  3. Notes
    - Contracts tracks full lifecycle (M22 Legal/Contract)
    - Partners tracks vendor ecosystem (M27 Partner/SDK)
    - Links contracts to partners for relationship management
*/

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id),
  contract_number text NOT NULL DEFAULT '',
  title text NOT NULL,
  type text NOT NULL DEFAULT 'vendor',
  counterparty text NOT NULL DEFAULT '',
  value_krw numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT (CURRENT_DATE + interval '1 year'),
  auto_renew boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contracts"
  ON contracts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contracts"
  ON contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contracts"
  ON contracts FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'vendor',
  contact_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contract_id uuid REFERENCES contracts(id),
  sla_score numeric NOT NULL DEFAULT 0,
  integration_status text NOT NULL DEFAULT 'pending',
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read partners"
  ON partners FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert partners"
  ON partners FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update partners"
  ON partners FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed contracts
DO $$
DECLARE
  complex_rec RECORD;
  contract_id uuid;
  contracts_data text[][] := ARRAY[
    ARRAY['시공 계약서 (A단지)', 'construction', '대우건설', '150000000000'],
    ARRAY['관리위탁 계약', 'management', 'SK에코플랜트', '2400000000'],
    ARRAY['엘리베이터 유지보수', 'vendor', '현대엘리베이터', '360000000'],
    ARRAY['EV 충전 설비 계약', 'vendor', '차지비', '480000000'],
    ARRAY['통합 보험 계약', 'insurance', '삼성화재', '120000000'],
    ARRAY['통신 인프라 계약', 'vendor', 'KT', '240000000'],
    ARRAY['SaaS 라이선스', 'license', 'SkyGarage HQ', '600000000'],
    ARRAY['보안 시스템 유지보수', 'vendor', 'S1', '180000000']
  ];
  i integer;
  start_d date;
  end_d date;
  stat text;
BEGIN
  FOR complex_rec IN SELECT id FROM complexes LIMIT 2 LOOP
    FOR i IN 1..array_length(contracts_data, 1) LOOP
      contract_id := gen_random_uuid();
      start_d := CURRENT_DATE - (floor(random() * 365)::int * interval '1 day')::interval;
      end_d := start_d + (365 + floor(random() * 730)::int) * interval '1 day';
      stat := CASE
        WHEN end_d < CURRENT_DATE THEN 'expired'
        WHEN end_d < CURRENT_DATE + interval '30 days' THEN 'expiring'
        ELSE 'active'
      END;

      INSERT INTO contracts (
        id, complex_id, contract_number, title, type, counterparty,
        value_krw, start_date, end_date, auto_renew, status, signed_at, created_at
      ) VALUES (
        contract_id,
        complex_rec.id,
        'CTR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(i::text, 3, '0'),
        contracts_data[i][1],
        contracts_data[i][2],
        contracts_data[i][3],
        contracts_data[i][4]::numeric,
        start_d, end_d,
        random() < 0.6,
        stat,
        start_d - (floor(random() * 14)::int * interval '1 day'),
        now() - (floor(random() * 180)::int * interval '1 day')
      );
    END LOOP;
  END LOOP;
END $$;

-- Seed partners
DO $$
DECLARE
  contract_rec RECORD;
  partners_data text[][] := ARRAY[
    ARRAY['현대엘리베이터', 'elevator', '김엘리', 'kim.eli@hyundai-elev.co.kr', '02-3456-7890'],
    ARRAY['차지비', 'ev_charger', '박충전', 'park@chargebi.kr', '02-1234-5678'],
    ARRAY['삼성화재', 'insurance', '이보험', 'lee@samsungfire.com', '02-9876-5432'],
    ARRAY['KT', 'telecom', '정통신', 'jung@kt.com', '02-1111-2222'],
    ARRAY['S1', 'security', '최보안', 'choi@s1.co.kr', '02-3333-4444'],
    ARRAY['대우건설', 'constructor', '강시공', 'kang@daewoo.co.kr', '02-5555-6666'],
    ARRAY['SK에코플랜트', 'cleaning', '윤관리', 'yun@skeco.kr', '02-7777-8888'],
    ARRAY['현대모비스', 'ev_charger', '한로봇', 'han@mobis.co.kr', '02-4444-3333']
  ];
  i integer;
  integrations text[] := ARRAY['connected', 'connected', 'connected', 'pending', 'connected', 'disconnected'];
BEGIN
  FOR i IN 1..array_length(partners_data, 1) LOOP
    SELECT id INTO contract_rec FROM contracts ORDER BY random() LIMIT 1;

    INSERT INTO partners (
      name, category, contact_name, contact_email, contact_phone,
      contract_id, sla_score, integration_status, last_activity_at
    ) VALUES (
      partners_data[i][1],
      partners_data[i][2],
      partners_data[i][3],
      partners_data[i][4],
      partners_data[i][5],
      contract_rec.id,
      round((75 + random() * 25)::numeric, 1),
      integrations[1 + floor(random() * array_length(integrations, 1))::int],
      now() - (floor(random() * 30)::int * interval '1 day')
    );
  END LOOP;
END $$;
