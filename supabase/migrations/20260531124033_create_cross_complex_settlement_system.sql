/*
  # Cross-Complex Settlement System (타 단지 이용 정산)

  사용자가 소속 단지 외 다른 단지에서 코인으로 주차/발렛을 이용할 때,
  글로벌 관리자가 수수료를 차감한 후 해당 단지 관리주체에 정산하는 시스템.

  ## 정산 흐름
  1. 사용자가 타 단지에서 코인 결제 → palatria_transactions에 기록
  2. settlement_records에 정산 대기 레코드 생성 (타 단지 이용 건)
  3. 정산 배치 실행 → settlement_batches에 정산 기간/금액 집계
  4. 글로벌 관리자 승인 → 주차관리주체에 지급 처리

  1. New Tables
    - `settlement_records` - 개별 정산 건
    - `settlement_batches` - 정산 배치 (월별 집계)
    - `settlement_commission_rates` - 수수료율 설정

  2. Security
    - RLS enabled on all tables
    - Super admin/admin: 전체 관리
    - Complex manager: 자기 단지 정산 건 조회만

  3. Default Commission Rates
    - parking: 10%
    - valet_standard: 15%
    - valet_premium: 20%
*/

-- Settlement Records (개별 정산 건)
CREATE TABLE IF NOT EXISTS settlement_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid,
  user_id uuid NOT NULL,
  user_home_complex_id uuid,
  service_complex_id uuid NOT NULL,
  service_type text NOT NULL DEFAULT 'parking',
  gross_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.15,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  batch_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all settlement records"
  ON settlement_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Complex managers can view their settlement records"
  ON settlement_records FOR SELECT
  TO authenticated
  USING (
    service_complex_id IN (
      SELECT uca.complex_id FROM user_complex_assignments uca
      WHERE uca.user_id = auth.uid()
    )
  );

-- Settlement Batches (정산 배치)
CREATE TABLE IF NOT EXISTS settlement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_gross numeric NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  record_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all settlement batches"
  ON settlement_batches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Complex managers can view own batches"
  ON settlement_batches FOR SELECT
  TO authenticated
  USING (
    complex_id IN (
      SELECT uca.complex_id FROM user_complex_assignments uca
      WHERE uca.user_id = auth.uid()
    )
  );

-- Settlement Commission Rates (수수료율 설정)
CREATE TABLE IF NOT EXISTS settlement_commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid,
  service_type text NOT NULL DEFAULT 'parking',
  rate numeric NOT NULL DEFAULT 0.15,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlement_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage commission rates"
  ON settlement_commission_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins and managers can view commission rates"
  ON settlement_commission_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlement_records_service_complex ON settlement_records(service_complex_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_status ON settlement_records(status);
CREATE INDEX IF NOT EXISTS idx_settlement_records_batch ON settlement_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_created ON settlement_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_complex ON settlement_batches(complex_id);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_status ON settlement_batches(status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_period ON settlement_batches(period_start, period_end);

-- Seed default commission rates (global defaults, complex_id = NULL)
INSERT INTO settlement_commission_rates (complex_id, service_type, rate, effective_from)
VALUES
  (NULL, 'parking', 0.10, '2024-01-01'),
  (NULL, 'valet_standard', 0.15, '2024-01-01'),
  (NULL, 'valet_premium', 0.20, '2024-01-01');
