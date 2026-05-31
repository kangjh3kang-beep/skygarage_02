/*
  # Seed Palatria Coin Wallets and Service Modes

  1. Data Seeded
    - `palatria_wallets` - one wallet per existing resident with random balances
    - `resident_service_modes` - one service mode per resident with UWB/LPR data
    - `visitor_billing_sessions` - sample visitor billing records

  2. Notes
    - Links to existing resident_accounts data
    - Provides realistic mock data for the admin Resident Management page
    - Service modes distributed across direct_entry, valet_standard, valet_premium, self_park
*/

-- Seed palatria wallets for all existing residents
INSERT INTO palatria_wallets (resident_id, balance_coins, lifetime_charged, lifetime_spent, auto_deduct_enabled, status)
SELECT
  id,
  floor(random() * 200000 + 5000)::numeric,
  floor(random() * 500000 + 100000)::numeric,
  floor(random() * 300000 + 50000)::numeric,
  CASE WHEN random() < 0.85 THEN true ELSE false END,
  CASE WHEN random() < 0.9 THEN 'active' ELSE 'frozen' END
FROM resident_accounts
WHERE id NOT IN (SELECT resident_id FROM palatria_wallets);

-- Seed resident service modes for all existing residents
INSERT INTO resident_service_modes (resident_id, current_mode, uwb_tag_serial, lpr_mapping, priority_weight, gate_interlock_status, credit_limit, monthly_accumulated)
SELECT
  ra.id,
  (ARRAY['direct_entry', 'valet_standard', 'valet_premium', 'self_park'])[1 + floor(random() * 4)::int],
  'UWB-' || LPAD(floor(random() * 999999)::text, 6, '0'),
  rv.plate_number,
  CASE
    WHEN random() < 0.1 THEN 3.0
    WHEN random() < 0.2 THEN 2.5
    WHEN random() < 0.4 THEN 2.0
    ELSE 1.0
  END,
  CASE
    WHEN random() < 0.9 THEN 'normal'
    WHEN random() < 0.95 THEN 'force_open'
    ELSE 'force_locked'
  END,
  CASE
    WHEN random() < 0.3 THEN 50000
    WHEN random() < 0.6 THEN 100000
    WHEN random() < 0.85 THEN 150000
    ELSE 300000
  END,
  floor(random() * 80000)::numeric
FROM resident_accounts ra
LEFT JOIN resident_vehicles rv ON rv.resident_id = ra.id AND rv.is_primary = true
WHERE ra.id NOT IN (SELECT resident_id FROM resident_service_modes);

-- Seed visitor billing sessions
INSERT INTO visitor_billing_sessions (complex_id, plate_number, entry_at, exit_at, rate_per_minute, accumulated_charge, discount_code, discount_amount, payment_status, exit_lock_active, store_name)
SELECT
  c.id,
  (10 + floor(random() * 90)::int)::text || (ARRAY['가','나','다','라','마','바'])[1 + floor(random() * 6)::int] || ' ' || (1000 + floor(random() * 9000)::int)::text,
  now() - (floor(random() * 180) * interval '1 minute'),
  CASE WHEN random() < 0.4 THEN now() - (floor(random() * 30) * interval '1 minute') ELSE NULL END,
  CASE WHEN random() < 0.7 THEN 50 ELSE 80 END,
  floor(random() * 15000 + 1000)::numeric,
  CASE WHEN random() < 0.3 THEN 'STORE-' || LPAD(floor(random() * 999)::text, 3, '0') ELSE '' END,
  CASE WHEN random() < 0.3 THEN floor(random() * 5000)::numeric ELSE 0 END,
  (ARRAY['pending', 'paid', 'overdue', 'pending', 'pending'])[1 + floor(random() * 5)::int],
  CASE WHEN random() < 0.15 THEN true ELSE false END,
  CASE WHEN random() < 0.3 THEN (ARRAY['스타벅스 강남점', '올리브영', 'CU편의점', '이마트24', '맥도날드'])[1 + floor(random() * 5)::int] ELSE '' END
FROM complexes c
CROSS JOIN generate_series(1, 5);
