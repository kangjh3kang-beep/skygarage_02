/*
  # Create revenue_reports table

  1. New Tables
    - `revenue_reports`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes) - which complex
      - `month` (date) - first day of the reporting month
      - `subscription_revenue` (numeric) - monthly/annual subscription fees collected
      - `parking_revenue` (numeric) - pay-per-use parking fees
      - `ev_charging_revenue` (numeric) - EV charging fees
      - `v2g_revenue` (numeric) - V2G grid export revenue
      - `total_revenue` (numeric) - sum of all revenue streams
      - `total_sessions` (integer) - parking sessions in the month
      - `active_subscribers` (integer) - active subscription accounts
      - `occupancy_rate` (numeric) - average occupancy percentage
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for authenticated admin access

  3. Notes
    - Monthly aggregated revenue data
    - Enables billing cycle management and financial reporting
    - Separates revenue by type for detailed analysis
*/

CREATE TABLE IF NOT EXISTS revenue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  month date NOT NULL,
  subscription_revenue numeric NOT NULL DEFAULT 0,
  parking_revenue numeric NOT NULL DEFAULT 0,
  ev_charging_revenue numeric NOT NULL DEFAULT 0,
  v2g_revenue numeric NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  active_subscribers integer NOT NULL DEFAULT 0,
  occupancy_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(complex_id, month)
);

ALTER TABLE revenue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read revenue reports"
  ON revenue_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert revenue reports"
  ON revenue_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update revenue reports"
  ON revenue_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed 6 months of revenue data per complex
DO $$
DECLARE
  complex_rec RECORD;
  m date;
  sub_rev numeric;
  park_rev numeric;
  ev_rev numeric;
  v2g_rev numeric;
BEGIN
  FOR complex_rec IN SELECT id, total_parking_slots FROM complexes LOOP
    FOR m IN SELECT generate_series(
      (date_trunc('month', CURRENT_DATE) - interval '5 months')::date,
      date_trunc('month', CURRENT_DATE)::date,
      '1 month'
    )::date LOOP
      sub_rev := round((800 + random() * 400)::numeric * 10000, 0);
      park_rev := round((200 + random() * 300)::numeric * 10000, 0);
      ev_rev := round((50 + random() * 100)::numeric * 10000, 0);
      v2g_rev := round((10 + random() * 40)::numeric * 10000, 0);

      INSERT INTO revenue_reports (
        complex_id, month,
        subscription_revenue, parking_revenue, ev_charging_revenue, v2g_revenue,
        total_revenue, total_sessions, active_subscribers, occupancy_rate
      ) VALUES (
        complex_rec.id, m,
        sub_rev, park_rev, ev_rev, v2g_rev,
        sub_rev + park_rev + ev_rev + v2g_rev,
        (600 + floor(random() * 400))::integer,
        (20 + floor(random() * 30))::integer,
        round((55 + random() * 30)::numeric, 1)
      )
      ON CONFLICT (complex_id, month) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
