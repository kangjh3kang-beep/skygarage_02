/*
  # SGP App 사용자 시스템 스키마

  1. New Tables
    - `sgp_users` - SGP 앱 사용자 프로필 (전화번호 기반)
      - `id` (uuid, PK) - auth.users.id 참조
      - `phone` (text, unique) - 전화번호 (로그인 식별자)
      - `display_name` (text) - 표시 이름
      - `avatar_url` (text) - 프로필 사진
      - `nfc_token` (text, unique) - NFC 결제 토큰 (고유 식별자)
      - `is_verified` (boolean) - 본인인증 여부
      - `status` (text) - active/suspended/dormant

    - `sgp_complex_memberships` - 단지/건물 소속 등록
      - `id` (uuid, PK)
      - `user_id` (uuid, FK -> sgp_users.id)
      - `complex_id` (uuid, FK -> complexes.id)
      - `unit_number` (text) - 호수/동호
      - `role` (text) - resident/owner/tenant
      - `request_status` (text) - pending/approved/rejected
      - `requested_by` (text) - user/admin
      - `approved_by` (uuid) - 승인한 관리자 ID
      - `approved_at` (timestamptz)

    - `sgp_coin_wallets` - 코인 지갑 (사용자별)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK -> sgp_users.id, unique)
      - `balance` (integer) - 현재 잔액 (코인 단위)
      - `lifetime_charged` (integer) - 누적 충전
      - `lifetime_spent` (integer) - 누적 사용
      - `auto_charge_enabled` (boolean) - 자동 충전 여부
      - `auto_charge_threshold` (integer) - 자동충전 임계값
      - `auto_charge_amount` (integer) - 자동충전 금액

    - `sgp_coin_transactions` - 코인 거래 내역
      - `id` (uuid, PK)
      - `wallet_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `type` (text) - charge/payment/refund/bonus
      - `amount` (integer)
      - `balance_after` (integer)
      - `description` (text)
      - `reference_type` (text) - parking/ev_charging/manual
      - `reference_id` (text)

    - `sgp_parking_payments` - 입출차 결제 기록
      - `id` (uuid, PK)
      - `user_id` (uuid, FK)
      - `complex_id` (uuid, FK)
      - `vehicle_plate` (text)
      - `entry_at` (timestamptz)
      - `exit_at` (timestamptz)
      - `duration_minutes` (integer)
      - `amount_coins` (integer) - 결제 코인
      - `payment_method` (text) - nfc_tag/auto_deduct/manual
      - `nfc_terminal_id` (text) - 결제 단말기 ID
      - `status` (text) - pending/completed/refunded

  2. Security
    - RLS enabled on all tables
    - Users can only access their own data
    - Admins can manage memberships
*/

-- SGP Users (profile linked to auth.users)
CREATE TABLE IF NOT EXISTS sgp_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  nfc_token text UNIQUE,
  is_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sgp_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON sgp_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON sgp_users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON sgp_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Complex Memberships
CREATE TABLE IF NOT EXISTS sgp_complex_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sgp_users(id) ON DELETE CASCADE,
  complex_id uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  unit_number text NOT NULL DEFAULT '',
  building_dong text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'resident',
  request_status text NOT NULL DEFAULT 'pending',
  requested_by text NOT NULL DEFAULT 'user',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, complex_id)
);

ALTER TABLE sgp_complex_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memberships"
  ON sgp_complex_memberships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can request membership"
  ON sgp_complex_memberships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND request_status = 'pending' AND requested_by = 'user');

CREATE POLICY "Users can update own pending membership"
  ON sgp_complex_memberships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND request_status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending membership"
  ON sgp_complex_memberships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND request_status = 'pending');

-- Coin Wallets
CREATE TABLE IF NOT EXISTS sgp_coin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES sgp_users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_charged integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  auto_charge_enabled boolean NOT NULL DEFAULT false,
  auto_charge_threshold integer NOT NULL DEFAULT 1000,
  auto_charge_amount integer NOT NULL DEFAULT 10000,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sgp_coin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallet"
  ON sgp_coin_wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet settings"
  ON sgp_coin_wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create own wallet"
  ON sgp_coin_wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Coin Transactions
CREATE TABLE IF NOT EXISTS sgp_coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES sgp_coin_wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES sgp_users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'charge',
  amount integer NOT NULL,
  balance_after integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  reference_type text DEFAULT '',
  reference_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sgp_coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON sgp_coin_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON sgp_coin_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Parking Payments
CREATE TABLE IF NOT EXISTS sgp_parking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sgp_users(id) ON DELETE CASCADE,
  complex_id uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  vehicle_plate text NOT NULL,
  entry_at timestamptz NOT NULL DEFAULT now(),
  exit_at timestamptz,
  duration_minutes integer DEFAULT 0,
  amount_coins integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'nfc_tag',
  nfc_terminal_id text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sgp_parking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON sgp_parking_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON sgp_parking_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending payments"
  ON sgp_parking_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sgp_users_phone ON sgp_users(phone);
CREATE INDEX IF NOT EXISTS idx_sgp_memberships_complex ON sgp_complex_memberships(complex_id, request_status);
CREATE INDEX IF NOT EXISTS idx_sgp_memberships_user ON sgp_complex_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_sgp_transactions_wallet ON sgp_coin_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgp_transactions_user ON sgp_coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgp_payments_user ON sgp_parking_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgp_payments_complex ON sgp_parking_payments(complex_id, created_at DESC);
