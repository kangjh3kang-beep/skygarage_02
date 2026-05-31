/*
  # Palatria Coin Wallet & Auto-Deduction Billing System

  1. New Tables
    - `palatria_wallets`
      - `id` (uuid, primary key) - wallet identifier
      - `resident_id` (uuid, FK to resident_accounts) - wallet owner
      - `balance_coins` (numeric) - current Palatria Coin balance
      - `lifetime_charged` (numeric) - total coins ever charged
      - `lifetime_spent` (numeric) - total coins ever spent
      - `auto_deduct_enabled` (boolean) - automatic deduction toggle
      - `low_balance_threshold` (numeric) - alert threshold
      - `status` (text) - 'active', 'frozen', 'suspended'
      - `last_transaction_at` (timestamptz) - last activity timestamp
      - `created_at` (timestamptz)

    - `palatria_transactions`
      - `id` (uuid, primary key) - transaction identifier
      - `wallet_id` (uuid, FK to palatria_wallets) - associated wallet
      - `resident_id` (uuid, FK to resident_accounts) - owner
      - `complex_id` (uuid) - which complex the transaction occurred at
      - `type` (text) - 'charge', 'deduct', 'refund', 'bonus', 'penalty'
      - `amount` (numeric) - transaction amount (positive = credit, negative = debit)
      - `balance_after` (numeric) - balance after transaction
      - `service_mode` (text) - 'direct_entry', 'valet', 'self_park'
      - `reference_id` (text) - parking session or invoice reference
      - `description` (text) - human-readable description
      - `metadata` (jsonb) - additional structured data
      - `created_at` (timestamptz)

    - `visitor_billing_sessions`
      - `id` (uuid, primary key) - session identifier
      - `complex_id` (uuid, FK to complexes) - which complex
      - `plate_number` (text) - visitor vehicle plate
      - `entry_at` (timestamptz) - entry timestamp
      - `exit_at` (timestamptz, nullable) - exit timestamp
      - `rate_per_minute` (numeric) - billing rate (KRW/min)
      - `accumulated_charge` (numeric) - total accumulated charge
      - `discount_code` (text) - store coupon code
      - `discount_amount` (numeric) - discount applied
      - `payment_status` (text) - 'pending', 'paid', 'overdue', 'waived'
      - `exit_lock_active` (boolean) - exit restriction flag
      - `store_name` (text) - associated store for discount
      - `created_at` (timestamptz)

    - `resident_service_modes`
      - `id` (uuid, primary key)
      - `resident_id` (uuid, FK to resident_accounts)
      - `current_mode` (text) - 'direct_entry', 'valet_standard', 'valet_premium', 'self_park'
      - `uwb_tag_serial` (text) - UWB wireless tag serial number
      - `lpr_mapping` (text) - LPR plate recognition text
      - `priority_weight` (numeric) - dispatch priority weight (w2 factor)
      - `gate_interlock_status` (text) - 'normal', 'force_open', 'force_locked'
      - `credit_limit` (numeric) - monthly credit limit in coins
      - `monthly_accumulated` (numeric) - current month spend
      - `mode_changed_at` (timestamptz) - last mode change
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated admin access

  3. Notes
    - Palatria Coin is a universal payment token across all SkyGarage-enabled parking facilities
    - Auto-deduction allows seamless parking without manual payment
    - Patent Components [120] Gate Control, [660] Governance Billing
*/

-- Palatria Wallets
CREATE TABLE IF NOT EXISTS palatria_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES resident_accounts(id),
  balance_coins numeric NOT NULL DEFAULT 0,
  lifetime_charged numeric NOT NULL DEFAULT 0,
  lifetime_spent numeric NOT NULL DEFAULT 0,
  auto_deduct_enabled boolean NOT NULL DEFAULT true,
  low_balance_threshold numeric NOT NULL DEFAULT 5000,
  status text NOT NULL DEFAULT 'active',
  last_transaction_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE palatria_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read palatria wallets"
  ON palatria_wallets FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert palatria wallets"
  ON palatria_wallets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update palatria wallets"
  ON palatria_wallets FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete palatria wallets"
  ON palatria_wallets FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Palatria Transactions
CREATE TABLE IF NOT EXISTS palatria_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES palatria_wallets(id),
  resident_id uuid NOT NULL REFERENCES resident_accounts(id),
  complex_id uuid REFERENCES complexes(id),
  type text NOT NULL DEFAULT 'deduct',
  amount numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  service_mode text NOT NULL DEFAULT 'self_park',
  reference_id text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE palatria_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read palatria transactions"
  ON palatria_transactions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert palatria transactions"
  ON palatria_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Visitor Billing Sessions
CREATE TABLE IF NOT EXISTS visitor_billing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  plate_number text NOT NULL DEFAULT '',
  entry_at timestamptz NOT NULL DEFAULT now(),
  exit_at timestamptz,
  rate_per_minute numeric NOT NULL DEFAULT 50,
  accumulated_charge numeric NOT NULL DEFAULT 0,
  discount_code text NOT NULL DEFAULT '',
  discount_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  exit_lock_active boolean NOT NULL DEFAULT false,
  store_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visitor_billing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read visitor billing"
  ON visitor_billing_sessions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert visitor billing"
  ON visitor_billing_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update visitor billing"
  ON visitor_billing_sessions FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Resident Service Modes
CREATE TABLE IF NOT EXISTS resident_service_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES resident_accounts(id),
  current_mode text NOT NULL DEFAULT 'self_park',
  uwb_tag_serial text NOT NULL DEFAULT '',
  lpr_mapping text NOT NULL DEFAULT '',
  priority_weight numeric NOT NULL DEFAULT 1.0,
  gate_interlock_status text NOT NULL DEFAULT 'normal',
  credit_limit numeric NOT NULL DEFAULT 100000,
  monthly_accumulated numeric NOT NULL DEFAULT 0,
  mode_changed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resident_service_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read service modes"
  ON resident_service_modes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert service modes"
  ON resident_service_modes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update service modes"
  ON resident_service_modes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_palatria_wallets_resident ON palatria_wallets(resident_id);
CREATE INDEX IF NOT EXISTS idx_palatria_transactions_wallet ON palatria_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_palatria_transactions_resident ON palatria_transactions(resident_id);
CREATE INDEX IF NOT EXISTS idx_palatria_transactions_created ON palatria_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_billing_complex ON visitor_billing_sessions(complex_id);
CREATE INDEX IF NOT EXISTS idx_visitor_billing_status ON visitor_billing_sessions(payment_status);
CREATE INDEX IF NOT EXISTS idx_resident_service_modes_resident ON resident_service_modes(resident_id);
