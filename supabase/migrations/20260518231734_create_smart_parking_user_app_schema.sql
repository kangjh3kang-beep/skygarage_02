/*
  # Smart Parking User App - Complete Schema

  1. New Tables
    - `households` - 세대 정보 (세대직입 허용 여부, 배정 주차면 수)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK to auth.users)
      - `complex_id` (uuid, optional FK)
      - `unit_number` (text) - 동/호수
      - `building` (text) - 동
      - `floor` (integer) - 층
      - `allocated_spots` (integer) - 배정 주차면 수
      - `direct_entry_enabled` (boolean) - 세대직입 허용 여부
      - `is_sky_garage_unit` (boolean) - 스카이가라지 세대 여부
      - `free_parking_hours_monthly` (integer) - 월 무료주차 시간
      - `free_parking_hours_used` (numeric) - 사용한 무료주차 시간
    - `user_vehicles` - 사용자 차량 등록
      - `id` (uuid, PK)
      - `household_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `plate_number` (text) - 차량 번호
      - `vehicle_type` (text) - 차량 유형 (sedan, suv, ev 등)
      - `is_ev` (boolean) - 전기차 여부
      - `brand` (text) - 제조사
      - `model` (text) - 모델명
      - `color` (text) - 색상
      - `is_primary` (boolean) - 대표 차량 여부
    - `visitor_registrations` - 방문 차량 사전 등록
      - `id` (uuid, PK)
      - `household_id` (uuid, FK)
      - `registered_by` (uuid, FK) - 등록한 입주민
      - `plate_number` (text)
      - `visitor_name` (text)
      - `visitor_phone` (text)
      - `visit_purpose` (text)
      - `expected_arrival` (timestamptz)
      - `expected_departure` (timestamptz)
      - `free_hours_granted` (numeric) - 부여된 무료 주차 시간
      - `status` (text) - pending, active, completed, cancelled
      - `entry_type` (text) - direct_entry, valet, general
    - `parking_spots` - 주차면 상태
      - `id` (uuid, PK)
      - `complex_id` (uuid)
      - `spot_number` (text)
      - `zone` (text) - 구역
      - `floor` (integer)
      - `spot_type` (text) - household_assigned, visitor, ev_charging, valet_staging
      - `household_id` (uuid, nullable) - 배정 세대
      - `is_occupied` (boolean)
      - `current_vehicle_id` (uuid, nullable)
      - `has_ev_charger` (boolean)
    - `active_parking` - 현재 주차 중인 차량 세션
      - `id` (uuid, PK)
      - `vehicle_plate` (text)
      - `spot_id` (uuid, FK)
      - `household_id` (uuid, nullable)
      - `visitor_registration_id` (uuid, nullable)
      - `entry_time` (timestamptz)
      - `exit_time` (timestamptz, nullable)
      - `is_visitor` (boolean)
      - `entry_method` (text) - direct_entry, valet, self_park
      - `atr_assignment_id` (uuid, nullable)
      - `free_hours_remaining` (numeric)
      - `overage_minutes` (integer)
      - `overage_fee` (numeric)
      - `status` (text) - parked, in_transit, exiting
      - `lat` (double precision, nullable)
      - `lng` (double precision, nullable)
    - `atr_units` - ATR(자동이송로봇) 장비
      - `id` (uuid, PK)
      - `unit_code` (text) - ATR 식별 코드
      - `status` (text) - idle, assigned, in_transit, docking, maintenance
      - `current_lat` (double precision)
      - `current_lng` (double precision)
      - `battery_level` (integer)
    - `atr_dispatch_log` - ATR 배정/이송 이력
      - `id` (uuid, PK)
      - `atr_unit_id` (uuid, FK)
      - `parking_session_id` (uuid, FK)
      - `dispatch_type` (text) - direct_entry, valet_to_spot, retrieval
      - `origin_spot` (text)
      - `destination_spot` (text)
      - `dispatched_at` (timestamptz)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `status` (text) - dispatched, in_progress, completed, failed
    - `ev_charging_sessions` - 전기차 충전 세션
      - `id` (uuid, PK)
      - `vehicle_id` (uuid, FK)
      - `parking_session_id` (uuid, FK)
      - `household_id` (uuid, FK)
      - `charger_spot_id` (uuid, FK)
      - `requested_at` (timestamptz)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `charge_start_pct` (integer)
      - `charge_current_pct` (integer)
      - `charge_target_pct` (integer)
      - `kwh_delivered` (numeric)
      - `estimated_completion` (timestamptz)
      - `cost_per_kwh` (numeric)
      - `total_cost` (numeric)
      - `status` (text) - requested, charging, completed, cancelled
      - `auto_charge_enabled` (boolean)
    - `billing_records` - 과금/결제 내역
      - `id` (uuid, PK)
      - `household_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `record_type` (text) - parking_overage, ev_charging, monthly_fee
      - `description` (text)
      - `amount` (numeric)
      - `currency` (text)
      - `billing_date` (date)
      - `due_date` (date)
      - `paid_at` (timestamptz, nullable)
      - `status` (text) - pending, paid, overdue
      - `parking_session_id` (uuid, nullable)
      - `ev_session_id` (uuid, nullable)
    - `payment_methods` - 결제 수단
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `method_type` (text) - credit_card, bank_transfer, auto_pay
      - `card_last_four` (text)
      - `card_brand` (text)
      - `is_default` (boolean)
      - `is_auto_pay` (boolean)
    - `user_notifications` - 사용자 알림
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `title` (text)
      - `message` (text)
      - `notification_type` (text) - parking, ev_charging, billing, visitor, system
      - `is_read` (boolean)
      - `action_url` (text, nullable)
      - `metadata` (jsonb, nullable)

  2. Security
    - RLS enabled on all tables
    - Policies: users can only access their own household data
    - Visitor data accessible by the registering household

  3. Indexes
    - plate_number lookups
    - household_id foreign keys
    - status filters
    - entry/exit times
*/

-- households
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  complex_id uuid,
  unit_number text NOT NULL,
  building text NOT NULL DEFAULT '',
  floor integer NOT NULL DEFAULT 1,
  allocated_spots integer NOT NULL DEFAULT 1,
  direct_entry_enabled boolean NOT NULL DEFAULT true,
  is_sky_garage_unit boolean NOT NULL DEFAULT false,
  free_parking_hours_monthly integer NOT NULL DEFAULT 4,
  free_parking_hours_used numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household owners can view their household"
  ON households FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Household owners can update their household"
  ON households FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own household"
  ON households FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- user_vehicles
CREATE TABLE IF NOT EXISTS user_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  plate_number text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'sedan',
  is_ev boolean NOT NULL DEFAULT false,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their vehicles"
  ON user_vehicles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their vehicles"
  ON user_vehicles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their vehicles"
  ON user_vehicles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their vehicles"
  ON user_vehicles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- visitor_registrations
CREATE TABLE IF NOT EXISTS visitor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  registered_by uuid NOT NULL REFERENCES auth.users(id),
  plate_number text NOT NULL,
  visitor_name text NOT NULL DEFAULT '',
  visitor_phone text NOT NULL DEFAULT '',
  visit_purpose text NOT NULL DEFAULT '',
  expected_arrival timestamptz,
  expected_departure timestamptz,
  free_hours_granted numeric NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'pending',
  entry_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visitor_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their visitor registrations"
  ON visitor_registrations FOR SELECT TO authenticated
  USING (auth.uid() = registered_by);

CREATE POLICY "Users can create visitor registrations"
  ON visitor_registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = registered_by);

CREATE POLICY "Users can update their visitor registrations"
  ON visitor_registrations FOR UPDATE TO authenticated
  USING (auth.uid() = registered_by)
  WITH CHECK (auth.uid() = registered_by);

CREATE POLICY "Users can delete their visitor registrations"
  ON visitor_registrations FOR DELETE TO authenticated
  USING (auth.uid() = registered_by);

-- parking_spots
CREATE TABLE IF NOT EXISTS parking_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid,
  spot_number text NOT NULL,
  zone text NOT NULL DEFAULT 'A',
  floor integer NOT NULL DEFAULT 1,
  spot_type text NOT NULL DEFAULT 'household_assigned',
  household_id uuid REFERENCES households(id),
  is_occupied boolean NOT NULL DEFAULT false,
  current_vehicle_id uuid,
  has_ev_charger boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parking_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view parking spots"
  ON parking_spots FOR SELECT TO authenticated
  USING (
    household_id IS NULL
    OR household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

-- active_parking
CREATE TABLE IF NOT EXISTS active_parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate text NOT NULL,
  spot_id uuid REFERENCES parking_spots(id),
  household_id uuid REFERENCES households(id),
  visitor_registration_id uuid REFERENCES visitor_registrations(id),
  entry_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz,
  is_visitor boolean NOT NULL DEFAULT false,
  entry_method text NOT NULL DEFAULT 'self_park',
  atr_assignment_id uuid,
  free_hours_remaining numeric NOT NULL DEFAULT 0,
  overage_minutes integer NOT NULL DEFAULT 0,
  overage_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'parked',
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE active_parking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their active parking"
  ON active_parking FOR SELECT TO authenticated
  USING (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert active parking"
  ON active_parking FOR INSERT TO authenticated
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their active parking"
  ON active_parking FOR UPDATE TO authenticated
  USING (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

-- atr_units
CREATE TABLE IF NOT EXISTS atr_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle',
  current_lat double precision NOT NULL DEFAULT 0,
  current_lng double precision NOT NULL DEFAULT 0,
  battery_level integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE atr_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ATR units"
  ON atr_units FOR SELECT TO authenticated
  USING (true = true);

-- atr_dispatch_log
CREATE TABLE IF NOT EXISTS atr_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atr_unit_id uuid NOT NULL REFERENCES atr_units(id),
  parking_session_id uuid REFERENCES active_parking(id),
  dispatch_type text NOT NULL DEFAULT 'valet_to_spot',
  origin_spot text NOT NULL DEFAULT '',
  destination_spot text NOT NULL DEFAULT '',
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'dispatched',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE atr_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their ATR dispatch logs"
  ON atr_dispatch_log FOR SELECT TO authenticated
  USING (
    parking_session_id IN (
      SELECT id FROM active_parking
      WHERE household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
    )
  );

-- ev_charging_sessions
CREATE TABLE IF NOT EXISTS ev_charging_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES user_vehicles(id),
  parking_session_id uuid REFERENCES active_parking(id),
  household_id uuid NOT NULL REFERENCES households(id),
  charger_spot_id uuid REFERENCES parking_spots(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  charge_start_pct integer NOT NULL DEFAULT 0,
  charge_current_pct integer NOT NULL DEFAULT 0,
  charge_target_pct integer NOT NULL DEFAULT 80,
  kwh_delivered numeric NOT NULL DEFAULT 0,
  estimated_completion timestamptz,
  cost_per_kwh numeric NOT NULL DEFAULT 300,
  total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  auto_charge_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ev_charging_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their EV charging sessions"
  ON ev_charging_sessions FOR SELECT TO authenticated
  USING (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create EV charging sessions"
  ON ev_charging_sessions FOR INSERT TO authenticated
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their EV charging sessions"
  ON ev_charging_sessions FOR UPDATE TO authenticated
  USING (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE user_id = auth.uid())
  );

-- billing_records
CREATE TABLE IF NOT EXISTS billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  record_type text NOT NULL DEFAULT 'parking_overage',
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KRW',
  billing_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days')::date,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  parking_session_id uuid REFERENCES active_parking(id),
  ev_session_id uuid REFERENCES ev_charging_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their billing records"
  ON billing_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their billing records"
  ON billing_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  method_type text NOT NULL DEFAULT 'credit_card',
  card_last_four text NOT NULL DEFAULT '',
  card_brand text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_auto_pay boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their payment methods"
  ON payment_methods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their payment methods"
  ON payment_methods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their payment methods"
  ON payment_methods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their payment methods"
  ON payment_methods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- user_notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  notification_type text NOT NULL DEFAULT 'system',
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON user_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON user_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_households_user_id ON households(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_household_id ON user_vehicles(household_id);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate ON user_vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_visitor_reg_household ON visitor_registrations(household_id);
CREATE INDEX IF NOT EXISTS idx_visitor_reg_status ON visitor_registrations(status);
CREATE INDEX IF NOT EXISTS idx_visitor_reg_plate ON visitor_registrations(plate_number);
CREATE INDEX IF NOT EXISTS idx_active_parking_household ON active_parking(household_id);
CREATE INDEX IF NOT EXISTS idx_active_parking_plate ON active_parking(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_active_parking_status ON active_parking(status);
CREATE INDEX IF NOT EXISTS idx_ev_charging_household ON ev_charging_sessions(household_id);
CREATE INDEX IF NOT EXISTS idx_ev_charging_status ON ev_charging_sessions(status);
CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_records(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON user_notifications(is_read);
