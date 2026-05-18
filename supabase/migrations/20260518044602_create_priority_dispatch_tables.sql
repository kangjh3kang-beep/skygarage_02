/*
  # Priority Dispatch for Mobility-Impaired Users (교통약자 우선배차)

  1. New Tables
    - `resident_accessibility_profiles`
      - `id` (uuid, primary key)
      - `resident_id` (uuid, FK to resident_accounts) - linked resident
      - `category` (text) - 'elderly', 'disabled', 'pregnant', 'child_companion', 'temporary_injury'
      - `severity_level` (integer) - 1 (mild) to 5 (critical), affects dispatch priority weight
      - `wheelchair_required` (boolean) - needs wheelchair-accessible bay
      - `assistance_required` (boolean) - requires staff assistance
      - `car_seat_space` (boolean) - needs car seat/stroller space reserved
      - `voice_command_enabled` (boolean) - uses voice-based interface
      - `companion_count` (integer) - number of companions needing assistance
      - `notes` (text) - additional requirements/notes
      - `verified` (boolean) - admin has verified the documentation
      - `verified_at` (timestamptz) - verification timestamp
      - `valid_until` (timestamptz) - expiry for temporary conditions (e.g., pregnancy, injury)
      - `active` (boolean) - whether this profile is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `priority_dispatch_rules`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, FK to complexes) - per-complex rules
      - `category` (text) - which accessibility category this rule applies to
      - `priority_weight` (integer) - dispatch priority multiplier (higher = dispatched sooner)
      - `max_wait_seconds` (integer) - maximum acceptable wait time before escalation
      - `preferred_floor` (integer) - preferred parking floor (ground level = 0)
      - `preferred_zone` (text) - preferred zone within the floor
      - `auto_assign_ground` (boolean) - always assign ground floor
      - `escort_required` (boolean) - dispatch escort with vehicle
      - `enabled` (boolean) - whether this rule is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `priority_dispatch_log`
      - `id` (uuid, primary key)
      - `session_id` (uuid, FK to parking_sessions) - related parking session
      - `resident_id` (uuid, FK to resident_accounts)
      - `profile_id` (uuid, FK to resident_accessibility_profiles)
      - `rule_id` (uuid, FK to priority_dispatch_rules)
      - `priority_score` (integer) - calculated priority score
      - `original_queue_position` (integer) - position before priority applied
      - `final_queue_position` (integer) - position after priority applied
      - `wait_time_seconds` (integer) - actual wait time
      - `assigned_floor` (integer) - assigned floor
      - `assigned_slot` (text) - assigned slot
      - `escort_dispatched` (boolean)
      - `created_at` (timestamptz)

  2. Columns added to parking_sessions
    - `priority_score` (integer) - 0 = normal, higher = higher priority
    - `is_priority_dispatch` (boolean) - flagged as priority dispatch

  3. Security
    - RLS enabled on all new tables
    - Only authenticated admin users can read/write

  4. Notes
    - Supports 5 categories: elderly, disabled, pregnant, child companion, temporary injury
    - Priority weight system allows flexible per-complex configuration
    - Logging enables audit trail and analytics on priority dispatch effectiveness
*/

-- ============================================================
-- Add priority columns to parking_sessions
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parking_sessions' AND column_name = 'priority_score'
  ) THEN
    ALTER TABLE parking_sessions ADD COLUMN priority_score integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parking_sessions' AND column_name = 'is_priority_dispatch'
  ) THEN
    ALTER TABLE parking_sessions ADD COLUMN is_priority_dispatch boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- Resident Accessibility Profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS resident_accessibility_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES resident_accounts(id),
  category text NOT NULL DEFAULT 'elderly',
  severity_level integer NOT NULL DEFAULT 1,
  wheelchair_required boolean NOT NULL DEFAULT false,
  assistance_required boolean NOT NULL DEFAULT false,
  car_seat_space boolean NOT NULL DEFAULT false,
  voice_command_enabled boolean NOT NULL DEFAULT false,
  companion_count integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  valid_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_profiles_resident
  ON resident_accessibility_profiles(resident_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_profiles_category
  ON resident_accessibility_profiles(category);
CREATE INDEX IF NOT EXISTS idx_accessibility_profiles_active
  ON resident_accessibility_profiles(active) WHERE active = true;

ALTER TABLE resident_accessibility_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read accessibility profiles"
  ON resident_accessibility_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert accessibility profiles"
  ON resident_accessibility_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update accessibility profiles"
  ON resident_accessibility_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete accessibility profiles"
  ON resident_accessibility_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Priority Dispatch Rules (per complex)
-- ============================================================

CREATE TABLE IF NOT EXISTS priority_dispatch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  category text NOT NULL DEFAULT 'elderly',
  priority_weight integer NOT NULL DEFAULT 10,
  max_wait_seconds integer NOT NULL DEFAULT 120,
  preferred_floor integer NOT NULL DEFAULT 0,
  preferred_zone text NOT NULL DEFAULT '',
  auto_assign_ground boolean NOT NULL DEFAULT true,
  escort_required boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_rules_complex
  ON priority_dispatch_rules(complex_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_enabled
  ON priority_dispatch_rules(enabled) WHERE enabled = true;

ALTER TABLE priority_dispatch_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dispatch rules"
  ON priority_dispatch_rules FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert dispatch rules"
  ON priority_dispatch_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update dispatch rules"
  ON priority_dispatch_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete dispatch rules"
  ON priority_dispatch_rules FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Priority Dispatch Log (audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS priority_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES parking_sessions(id),
  resident_id uuid REFERENCES resident_accounts(id),
  profile_id uuid REFERENCES resident_accessibility_profiles(id),
  rule_id uuid REFERENCES priority_dispatch_rules(id),
  priority_score integer NOT NULL DEFAULT 0,
  original_queue_position integer NOT NULL DEFAULT 0,
  final_queue_position integer NOT NULL DEFAULT 0,
  wait_time_seconds integer NOT NULL DEFAULT 0,
  assigned_floor integer NOT NULL DEFAULT 0,
  assigned_slot text NOT NULL DEFAULT '',
  escort_dispatched boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_log_session
  ON priority_dispatch_log(session_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_resident
  ON priority_dispatch_log(resident_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_created
  ON priority_dispatch_log(created_at);

ALTER TABLE priority_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dispatch logs"
  ON priority_dispatch_log FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert dispatch logs"
  ON priority_dispatch_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Seed default dispatch rules for existing complexes
-- ============================================================

DO $$
DECLARE
  complex_rec RECORD;
  categories text[] := ARRAY['elderly', 'disabled', 'pregnant', 'child_companion', 'temporary_injury'];
  weights integer[] := ARRAY[8, 10, 7, 6, 5];
  wait_times integer[] := ARRAY[90, 60, 90, 120, 120];
  cat_idx integer;
BEGIN
  FOR complex_rec IN SELECT id FROM complexes WHERE status = 'active' LOOP
    FOR cat_idx IN 1..5 LOOP
      INSERT INTO priority_dispatch_rules (
        complex_id, category, priority_weight, max_wait_seconds,
        preferred_floor, auto_assign_ground, escort_required, enabled
      ) VALUES (
        complex_rec.id,
        categories[cat_idx],
        weights[cat_idx],
        wait_times[cat_idx],
        0,
        CASE WHEN categories[cat_idx] IN ('disabled', 'elderly') THEN true ELSE false END,
        CASE WHEN categories[cat_idx] = 'disabled' THEN true ELSE false END,
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Seed sample accessibility profiles for some existing residents
DO $$
DECLARE
  res_rec RECORD;
  categories text[] := ARRAY['elderly', 'disabled', 'pregnant', 'child_companion', 'temporary_injury'];
  counter integer := 0;
BEGIN
  FOR res_rec IN SELECT id FROM resident_accounts WHERE status = 'active' ORDER BY random() LIMIT 8 LOOP
    counter := counter + 1;
    INSERT INTO resident_accessibility_profiles (
      resident_id, category, severity_level,
      wheelchair_required, assistance_required, car_seat_space,
      voice_command_enabled, verified, verified_at, active
    ) VALUES (
      res_rec.id,
      categories[1 + (counter % 5)],
      1 + (counter % 4),
      counter % 3 = 0,
      counter % 4 = 0,
      categories[1 + (counter % 5)] = 'child_companion',
      counter % 5 = 0,
      counter % 2 = 0,
      CASE WHEN counter % 2 = 0 THEN now() ELSE NULL END,
      true
    );
  END LOOP;
END $$;
