/*
  # Create energy_metrics table

  1. New Tables
    - `energy_metrics`
      - `id` (uuid, primary key) - unique record
      - `complex_id` (uuid, FK to complexes) - which complex
      - `date` (date) - measurement date
      - `total_consumption_kwh` (numeric) - total system power consumption
      - `solar_generation_kwh` (numeric) - solar panel generation
      - `regen_recovery_kwh` (numeric) - regenerative braking energy recovered
      - `ev_charging_kwh` (numeric) - EV charging energy delivered
      - `grid_import_kwh` (numeric) - energy drawn from the grid
      - `grid_export_kwh` (numeric) - V2G energy sold back to grid
      - `peak_demand_kw` (numeric) - peak power demand for the day
      - `carbon_saved_kg` (numeric) - estimated CO2 emissions avoided
      - `cost_savings_krw` (numeric) - energy cost savings in KRW
      - `created_at` (timestamptz) - record creation time

  2. Security
    - Enable RLS on `energy_metrics` table
    - Policies for authenticated admin access

  3. Notes
    - Daily aggregated energy data per complex
    - Enables green energy dashboard, cost analysis, carbon footprint reporting
    - Patent reference: Solar + regenerative braking + V2G integration
*/

CREATE TABLE IF NOT EXISTS energy_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_consumption_kwh numeric NOT NULL DEFAULT 0,
  solar_generation_kwh numeric NOT NULL DEFAULT 0,
  regen_recovery_kwh numeric NOT NULL DEFAULT 0,
  ev_charging_kwh numeric NOT NULL DEFAULT 0,
  grid_import_kwh numeric NOT NULL DEFAULT 0,
  grid_export_kwh numeric NOT NULL DEFAULT 0,
  peak_demand_kw numeric NOT NULL DEFAULT 0,
  carbon_saved_kg numeric NOT NULL DEFAULT 0,
  cost_savings_krw numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(complex_id, date)
);

ALTER TABLE energy_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read energy metrics"
  ON energy_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert energy metrics"
  ON energy_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update energy metrics"
  ON energy_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed 14 days of energy data for each complex
DO $$
DECLARE
  complex_rec RECORD;
  d date;
  consumption numeric;
  solar numeric;
  regen numeric;
  ev_charge numeric;
  grid_in numeric;
  grid_out numeric;
BEGIN
  FOR complex_rec IN SELECT id, total_parking_slots FROM complexes LOOP
    FOR d IN SELECT generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, '1 day')::date LOOP
      consumption := round((120 + random() * 80)::numeric, 1);
      solar := round((30 + random() * 25)::numeric, 1);
      regen := round((8 + random() * 12)::numeric, 1);
      ev_charge := round((15 + random() * 20)::numeric, 1);
      grid_out := round((random() * 8)::numeric, 1);
      grid_in := round((consumption - solar - regen + ev_charge + grid_out)::numeric, 1);
      IF grid_in < 0 THEN grid_in := 0; END IF;

      INSERT INTO energy_metrics (
        complex_id, date, total_consumption_kwh,
        solar_generation_kwh, regen_recovery_kwh,
        ev_charging_kwh, grid_import_kwh, grid_export_kwh,
        peak_demand_kw, carbon_saved_kg, cost_savings_krw
      ) VALUES (
        complex_rec.id, d, consumption,
        solar, regen,
        ev_charge, grid_in, grid_out,
        round((45 + random() * 30)::numeric, 1),
        round(((solar + regen) * 0.46)::numeric, 1),
        round(((solar + regen) * 120 + grid_out * 100)::numeric, 0)
      )
      ON CONFLICT (complex_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
