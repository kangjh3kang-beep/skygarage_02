/*
# HIL Test Tracking & Hardware Enhancement Migration

## Summary
Adds HIL (Hardware-in-the-Loop) test stage tracking, motion tokens for the safety gate,
and enhances existing hardware tables to support all 4 device types and 4 protocol types
per the PALATRIA hardware integration plan.

## New Tables
1. `hil_test_stages` - Tracks HIL test progression per device type
   - `id` (uuid, PK)
   - `complex_id` (uuid, FK to complexes)
   - `device_type` (text) - atr_robot, vehicle_elevator, mechanical_tower, parking_bay_sensor
   - `stage` (text) - SIL, HIL_BENCH, STOP_TEST, LEGAL_INSPECTION, SINGLE_UNIT, PILOT
   - `status` (text) - pending, in_progress, passed, failed
   - `started_at`, `completed_at` (timestamptz)
   - `test_results` (jsonb) - detailed test metrics
   - `notes` (text)
   - `signed_off_by` (uuid)

2. `motion_tokens` - Safety gate motion tokens for command authorization
   - `id` (uuid, PK)
   - `token` (text, unique) - the actual token value
   - `command_id` (uuid, FK to hardware_commands)
   - `device_id` (uuid, FK to hardware_device_registry)
   - `issued_at` (timestamptz)
   - `expires_at` (timestamptz)
   - `revoked` (boolean)
   - `used` (boolean)

## Modified Tables
- `hardware_commands`: Add `metadata` (jsonb) column for motion tokens and safety gate data
- `safety_chain_states`: Add `channel_a_status` and `channel_b_status` text columns for 2-channel safety

## Security
- RLS enabled on all new tables
- Service role policies (TO anon, authenticated) for operational access

## Notes
1. HIL stages follow the sequence: SIL → HIL_BENCH → STOP_TEST → LEGAL_INSPECTION → SINGLE_UNIT → PILOT
2. Motion tokens have a 60-second TTL by default
3. 2-channel safety: Channel A = hardware E-STOP, Channel B = software safety gate
*/

-- Add metadata column to hardware_commands for safety gate motion tokens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hardware_commands' AND column_name = 'metadata') THEN
    ALTER TABLE hardware_commands ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add 2-channel safety status to safety_chain_states
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'safety_chain_states' AND column_name = 'channel_a_status') THEN
    ALTER TABLE safety_chain_states ADD COLUMN channel_a_status text DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'safety_chain_states' AND column_name = 'channel_b_status') THEN
    ALTER TABLE safety_chain_states ADD COLUMN channel_b_status text DEFAULT 'normal';
  END IF;
END $$;

-- Add resolution_status to hardware_health_events if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hardware_health_events' AND column_name = 'resolution_status') THEN
    ALTER TABLE hardware_health_events ADD COLUMN resolution_status text DEFAULT 'open';
  END IF;
END $$;

-- HIL Test Stages table
CREATE TABLE IF NOT EXISTS hil_test_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id) ON DELETE CASCADE,
  device_type text NOT NULL,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  test_results jsonb DEFAULT '{}',
  notes text DEFAULT '',
  signed_off_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_device_type CHECK (device_type IN ('atr_robot', 'vehicle_elevator', 'mechanical_tower', 'parking_bay_sensor')),
  CONSTRAINT valid_stage CHECK (stage IN ('SIL', 'HIL_BENCH', 'STOP_TEST', 'LEGAL_INSPECTION', 'SINGLE_UNIT', 'PILOT')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'skipped'))
);

-- Motion Tokens table
CREATE TABLE IF NOT EXISTS motion_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  command_id uuid REFERENCES hardware_commands(id) ON DELETE CASCADE,
  device_id uuid REFERENCES hardware_device_registry(id) ON DELETE CASCADE,
  site_id text,
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hil_test_stages_complex ON hil_test_stages(complex_id);
CREATE INDEX IF NOT EXISTS idx_hil_test_stages_device_type ON hil_test_stages(device_type, stage);
CREATE INDEX IF NOT EXISTS idx_motion_tokens_token ON motion_tokens(token);
CREATE INDEX IF NOT EXISTS idx_motion_tokens_device ON motion_tokens(device_id, revoked, used);
CREATE INDEX IF NOT EXISTS idx_motion_tokens_expires ON motion_tokens(expires_at) WHERE revoked = false AND used = false;
CREATE INDEX IF NOT EXISTS idx_hardware_commands_metadata ON hardware_commands USING gin(metadata);

-- RLS for hil_test_stages
ALTER TABLE hil_test_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_hil_test_stages" ON hil_test_stages;
CREATE POLICY "anon_select_hil_test_stages" ON hil_test_stages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_hil_test_stages" ON hil_test_stages;
CREATE POLICY "anon_insert_hil_test_stages" ON hil_test_stages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_hil_test_stages" ON hil_test_stages;
CREATE POLICY "anon_update_hil_test_stages" ON hil_test_stages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_hil_test_stages" ON hil_test_stages;
CREATE POLICY "anon_delete_hil_test_stages" ON hil_test_stages FOR DELETE
  TO anon, authenticated USING (true);

-- RLS for motion_tokens
ALTER TABLE motion_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_motion_tokens" ON motion_tokens;
CREATE POLICY "anon_select_motion_tokens" ON motion_tokens FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_motion_tokens" ON motion_tokens;
CREATE POLICY "anon_insert_motion_tokens" ON motion_tokens FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_motion_tokens" ON motion_tokens;
CREATE POLICY "anon_update_motion_tokens" ON motion_tokens FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_motion_tokens" ON motion_tokens;
CREATE POLICY "anon_delete_motion_tokens" ON motion_tokens FOR DELETE
  TO anon, authenticated USING (true);
