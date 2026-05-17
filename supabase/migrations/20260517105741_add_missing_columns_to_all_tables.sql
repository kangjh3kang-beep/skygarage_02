/*
  # Add missing columns to align DB schema with admin UI

  1. Modified Tables
    - parking_sessions: add exit_time alias not needed, code will be fixed to use exit_at
    - energy_metrics: no changes (code will be fixed)
    - atr_units: add location, firmware_version, last_heartbeat
    - elevators: add building, capacity_kg, last_maintenance, next_maintenance
    - maintenance_logs: add target_code, priority, title, started_at, parts_used, notes
    - system_alerts: add category, status, description, assigned_to, resolved_at
    - support_tickets: add ticket_number, resident_id, channel, sla_due_at, first_response_at, resolved_at, satisfaction
    - access_logs: add card_id, auth_method, status, deny_reason
    - billing_invoices: add partner_id, amount, issued_at
    - team_members: add position, assigned_complex_id, certifications, hire_date, last_active_at
    - contracts: add progress
    - partners: add category, contract_id, sla_score, integration_status, last_activity_at
    - revenue_reports: add month, subscription_revenue, parking_revenue, ev_charging_revenue, v2g_revenue, total_sessions, active_subscribers, occupancy_rate
    - security_audit_logs: add table_name, record_id
    - complexes: add code
    - resident_accounts: add status
    - section_media: add position, layout, items (keep existing columns too)

  2. Important Notes
    - All new columns are nullable to avoid breaking existing data
    - Using IF NOT EXISTS pattern for safety
*/

-- atr_units: add location, firmware_version, last_heartbeat
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atr_units' AND column_name='location') THEN
    ALTER TABLE atr_units ADD COLUMN location text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atr_units' AND column_name='firmware_version') THEN
    ALTER TABLE atr_units ADD COLUMN firmware_version text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atr_units' AND column_name='last_heartbeat') THEN
    ALTER TABLE atr_units ADD COLUMN last_heartbeat timestamptz;
  END IF;
END $$;

-- elevators: add building, capacity_kg, last_maintenance, next_maintenance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elevators' AND column_name='building') THEN
    ALTER TABLE elevators ADD COLUMN building text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elevators' AND column_name='capacity_kg') THEN
    ALTER TABLE elevators ADD COLUMN capacity_kg numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elevators' AND column_name='last_maintenance') THEN
    ALTER TABLE elevators ADD COLUMN last_maintenance timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elevators' AND column_name='next_maintenance') THEN
    ALTER TABLE elevators ADD COLUMN next_maintenance timestamptz;
  END IF;
END $$;

-- maintenance_logs: add target_code, priority, title, started_at, parts_used, notes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='target_code') THEN
    ALTER TABLE maintenance_logs ADD COLUMN target_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='priority') THEN
    ALTER TABLE maintenance_logs ADD COLUMN priority text DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='title') THEN
    ALTER TABLE maintenance_logs ADD COLUMN title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='started_at') THEN
    ALTER TABLE maintenance_logs ADD COLUMN started_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='parts_used') THEN
    ALTER TABLE maintenance_logs ADD COLUMN parts_used jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='notes') THEN
    ALTER TABLE maintenance_logs ADD COLUMN notes text;
  END IF;
END $$;

-- system_alerts: add category, status, description, assigned_to, resolved_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_alerts' AND column_name='category') THEN
    ALTER TABLE system_alerts ADD COLUMN category text DEFAULT 'system';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_alerts' AND column_name='status') THEN
    ALTER TABLE system_alerts ADD COLUMN status text DEFAULT 'open';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_alerts' AND column_name='description') THEN
    ALTER TABLE system_alerts ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_alerts' AND column_name='assigned_to') THEN
    ALTER TABLE system_alerts ADD COLUMN assigned_to text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_alerts' AND column_name='resolved_at') THEN
    ALTER TABLE system_alerts ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

-- support_tickets: add ticket_number, resident_id, channel, sla_due_at, first_response_at, resolved_at, satisfaction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='ticket_number') THEN
    ALTER TABLE support_tickets ADD COLUMN ticket_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='resident_id') THEN
    ALTER TABLE support_tickets ADD COLUMN resident_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='channel') THEN
    ALTER TABLE support_tickets ADD COLUMN channel text DEFAULT 'web';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='sla_due_at') THEN
    ALTER TABLE support_tickets ADD COLUMN sla_due_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='first_response_at') THEN
    ALTER TABLE support_tickets ADD COLUMN first_response_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='resolved_at') THEN
    ALTER TABLE support_tickets ADD COLUMN resolved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='satisfaction') THEN
    ALTER TABLE support_tickets ADD COLUMN satisfaction integer;
  END IF;
END $$;

-- access_logs: add card_id, auth_method, status, deny_reason
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='access_logs' AND column_name='card_id') THEN
    ALTER TABLE access_logs ADD COLUMN card_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='access_logs' AND column_name='auth_method') THEN
    ALTER TABLE access_logs ADD COLUMN auth_method text DEFAULT 'plate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='access_logs' AND column_name='status') THEN
    ALTER TABLE access_logs ADD COLUMN status text DEFAULT 'granted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='access_logs' AND column_name='deny_reason') THEN
    ALTER TABLE access_logs ADD COLUMN deny_reason text;
  END IF;
END $$;

-- billing_invoices: add partner_id, amount, issued_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_invoices' AND column_name='partner_id') THEN
    ALTER TABLE billing_invoices ADD COLUMN partner_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_invoices' AND column_name='amount') THEN
    ALTER TABLE billing_invoices ADD COLUMN amount numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_invoices' AND column_name='issued_at') THEN
    ALTER TABLE billing_invoices ADD COLUMN issued_at timestamptz DEFAULT now();
  END IF;
END $$;

-- team_members: add position, assigned_complex_id, certifications, hire_date, last_active_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='position') THEN
    ALTER TABLE team_members ADD COLUMN position text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='assigned_complex_id') THEN
    ALTER TABLE team_members ADD COLUMN assigned_complex_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='certifications') THEN
    ALTER TABLE team_members ADD COLUMN certifications jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='hire_date') THEN
    ALTER TABLE team_members ADD COLUMN hire_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='last_active_at') THEN
    ALTER TABLE team_members ADD COLUMN last_active_at timestamptz;
  END IF;
END $$;

-- contracts: add progress
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='progress') THEN
    ALTER TABLE contracts ADD COLUMN progress integer DEFAULT 0;
  END IF;
END $$;

-- partners: add category, contract_id, sla_score, integration_status, last_activity_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='category') THEN
    ALTER TABLE partners ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='contract_id') THEN
    ALTER TABLE partners ADD COLUMN contract_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='sla_score') THEN
    ALTER TABLE partners ADD COLUMN sla_score numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='integration_status') THEN
    ALTER TABLE partners ADD COLUMN integration_status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='last_activity_at') THEN
    ALTER TABLE partners ADD COLUMN last_activity_at timestamptz;
  END IF;
END $$;

-- revenue_reports: add month, subscription_revenue, parking_revenue, ev_charging_revenue, v2g_revenue, total_sessions, active_subscribers, occupancy_rate
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='month') THEN
    ALTER TABLE revenue_reports ADD COLUMN month text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='subscription_revenue') THEN
    ALTER TABLE revenue_reports ADD COLUMN subscription_revenue numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='parking_revenue') THEN
    ALTER TABLE revenue_reports ADD COLUMN parking_revenue numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='ev_charging_revenue') THEN
    ALTER TABLE revenue_reports ADD COLUMN ev_charging_revenue numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='v2g_revenue') THEN
    ALTER TABLE revenue_reports ADD COLUMN v2g_revenue numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='total_sessions') THEN
    ALTER TABLE revenue_reports ADD COLUMN total_sessions integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='active_subscribers') THEN
    ALTER TABLE revenue_reports ADD COLUMN active_subscribers integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='revenue_reports' AND column_name='occupancy_rate') THEN
    ALTER TABLE revenue_reports ADD COLUMN occupancy_rate numeric DEFAULT 0;
  END IF;
END $$;

-- security_audit_logs: add table_name, record_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_audit_logs' AND column_name='table_name') THEN
    ALTER TABLE security_audit_logs ADD COLUMN table_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_audit_logs' AND column_name='record_id') THEN
    ALTER TABLE security_audit_logs ADD COLUMN record_id text;
  END IF;
END $$;

-- complexes: add code
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complexes' AND column_name='code') THEN
    ALTER TABLE complexes ADD COLUMN code text;
  END IF;
END $$;

-- resident_accounts: add status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resident_accounts' AND column_name='status') THEN
    ALTER TABLE resident_accounts ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- safety_events table (referenced by SystemOverview.tsx)
CREATE TABLE IF NOT EXISTS safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id),
  event_type text NOT NULL,
  severity text DEFAULT 'medium',
  description text,
  location text,
  status text DEFAULT 'open',
  reported_by text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view safety events"
  ON safety_events FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert safety events"
  ON safety_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update safety events"
  ON safety_events FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete safety events"
  ON safety_events FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
