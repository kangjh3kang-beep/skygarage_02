/*
  # Create resident accounts and vehicles tables

  1. New Tables
    - `resident_accounts`
      - `id` (uuid, primary key) - unique resident identifier
      - `complex_id` (uuid, FK to complexes) - which complex they reside in
      - `unit_number` (text) - apartment/unit number (e.g. "1204", "B-503")
      - `name` (text) - resident name
      - `phone` (text) - contact phone number
      - `email` (text) - contact email
      - `plan_type` (text) - 'monthly', 'annual', 'pay_per_use'
      - `monthly_fee` (numeric) - subscription fee in KRW (0 for pay-per-use)
      - `access_card_id` (text) - RFID/NFC card identifier
      - `status` (text) - 'active', 'suspended', 'expired'
      - `registered_at` (timestamptz) - registration date
      - `expires_at` (timestamptz, nullable) - subscription expiry
      - `created_at` (timestamptz)

    - `resident_vehicles`
      - `id` (uuid, primary key)
      - `resident_id` (uuid, FK to resident_accounts) - vehicle owner
      - `plate_number` (text) - license plate number
      - `vehicle_type` (text) - 'sedan', 'suv', 'ev', 'compact', 'van'
      - `make` (text) - manufacturer (e.g. 'Hyundai', 'Tesla')
      - `model` (text) - model name
      - `color` (text) - vehicle color
      - `is_ev` (boolean) - electric vehicle flag
      - `is_primary` (boolean) - primary vehicle flag
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated admin access

  3. Notes
    - Supports subscription-based and pay-per-use parking models
    - Links residents to their vehicles for automatic recognition
    - Access card integration for gate entry
*/

CREATE TABLE IF NOT EXISTS resident_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  unit_number text NOT NULL DEFAULT '',
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  plan_type text NOT NULL DEFAULT 'monthly',
  monthly_fee numeric NOT NULL DEFAULT 0,
  access_card_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  registered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resident_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read resident accounts"
  ON resident_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert resident accounts"
  ON resident_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update resident accounts"
  ON resident_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete resident accounts"
  ON resident_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS resident_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES resident_accounts(id),
  plate_number text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'sedan',
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  is_ev boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resident_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read resident vehicles"
  ON resident_vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert resident vehicles"
  ON resident_vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update resident vehicles"
  ON resident_vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete resident vehicles"
  ON resident_vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed sample resident data
DO $$
DECLARE
  complex_rec RECORD;
  resident_id uuid;
  i integer;
  names text[] := ARRAY['김민수', '이영희', '박지훈', '최수연', '정태영', '한소희', '윤재민', '송미경', '강대현', '오하나', '임도윤', '서지원'];
  makes text[] := ARRAY['현대', '기아', '테슬라', '제네시스', 'BMW', '벤츠', '볼보', '포르쉐'];
  models text[] := ARRAY['아이오닉 6', 'EV6', '모델 3', 'GV80', '5시리즈', 'E클래스', 'XC90', '타이칸'];
  colors text[] := ARRAY['흰색', '검정', '은색', '남색', '회색', '파랑'];
  types text[] := ARRAY['sedan', 'suv', 'ev', 'compact'];
BEGIN
  FOR complex_rec IN SELECT id FROM complexes WHERE status = 'active' LOOP
    FOR i IN 1..6 LOOP
      resident_id := gen_random_uuid();
      INSERT INTO resident_accounts (
        id, complex_id, unit_number, name, phone, email,
        plan_type, monthly_fee, access_card_id, status, registered_at
      ) VALUES (
        resident_id,
        complex_rec.id,
        (100 + floor(random() * 30)::int)::text || '0' || (1 + floor(random() * 9)::int)::text,
        names[1 + floor(random() * array_length(names, 1))::int],
        '010-' || (1000 + floor(random() * 9000)::int)::text || '-' || (1000 + floor(random() * 9000)::int)::text,
        'resident' || floor(random() * 9000 + 1000)::int || '@email.com',
        CASE WHEN random() < 0.7 THEN 'monthly' WHEN random() < 0.9 THEN 'annual' ELSE 'pay_per_use' END,
        CASE WHEN random() < 0.7 THEN 150000 WHEN random() < 0.9 THEN 1500000 ELSE 0 END,
        'CARD-' || LPAD(floor(random() * 99999)::text, 5, '0'),
        CASE WHEN random() < 0.9 THEN 'active' ELSE 'suspended' END,
        now() - (floor(random() * 365)::int * interval '1 day')
      );

      INSERT INTO resident_vehicles (
        resident_id, plate_number, vehicle_type, make, model, color, is_ev, is_primary
      ) VALUES (
        resident_id,
        (10 + floor(random() * 90)::int)::text ||
          (ARRAY['가','나','다','라','마','바','사','아'])[1 + floor(random() * 8)::int] || ' ' ||
          (1000 + floor(random() * 9000)::int)::text,
        types[1 + floor(random() * array_length(types, 1))::int],
        makes[1 + floor(random() * array_length(makes, 1))::int],
        models[1 + floor(random() * array_length(models, 1))::int],
        colors[1 + floor(random() * array_length(colors, 1))::int],
        random() < 0.4,
        true
      );
    END LOOP;
  END LOOP;
END $$;
