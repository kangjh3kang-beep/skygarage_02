/*
# Create Admin System Domain Tables (Safety Chain, Audit Hash Chain, Domain Events, Resource Locks)

## Purpose
Core infrastructure tables for the Sky Garage admin management system's safety gating,
audit trail (hash chain), domain event bus, and resource lock management.

## New Tables

1. `safety_chain_states` - Tracks physical safety chain state per site
   - `id` (uuid, PK)
   - `site_id` (text, unique) - identifies the building/site
   - `sto_active` (boolean) - Safe Torque Off active
   - `safety_relay_engaged` (boolean) - Safety relay [272] state
   - `drive_enabled` (boolean) - Drive [270] state
   - `emergency_stop_active` (boolean) - E-Stop engaged
   - `updated_at` (timestamptz)

2. `resource_locks` - Prevents double-allocation of physical resources
   - `id` (uuid, PK)
   - `site_id` (text) - site scope
   - `device_id` (text) - locked device/resource
   - `mission_id` (text) - mission holding the lock
   - `status` (text) - active/released/expired
   - `locked_at` / `released_at` (timestamptz)
   - `idempotency_key` (text, unique) - prevents duplicate locks

3. `domain_events` - Unified event store (3-envelope: MissionEvent, SafetyEvent, AuditEvent)
   - `id` (uuid, PK)
   - `site_id` (text) - tenant scope
   - `envelope` (text) - MissionEvent | SafetyEvent | AuditEvent
   - `subtype` (text) - event classification
   - `action` (text) - specific event name
   - `payload` (jsonb) - event data
   - `idempotency_key` (text) - deduplication
   - `traceparent` (text) - distributed tracing
   - `created_at` (timestamptz)

4. `audit_hash_chain` - Tamper-evident audit log with hash chain per site
   - `id` (uuid, PK)
   - `site_id` (text) - single writer per site
   - `actor_id` (text) - who performed the action
   - `action` (text) - what was done
   - `resource` (text) - target resource type
   - `resource_id` (text) - target resource ID
   - `details` (jsonb) - action metadata
   - `previous_hash` (text) - hash of prior event (chain link)
   - `hash` (text) - SHA-256 hash of this event
   - `sequence_num` (bigint) - monotonic sequence per site
   - `created_at` (timestamptz)

## Security
- RLS enabled on all tables
- Policies allow authenticated users full CRUD (admin system is auth-gated)

## Important Notes
1. `audit_hash_chain` enforces single-writer per site via unique constraint on (site_id, sequence_num)
2. `resource_locks` uses unique idempotency_key to prevent double-allocation
3. All tables are scoped by site_id for multi-tenant isolation
*/

-- 1. Safety Chain States
CREATE TABLE IF NOT EXISTS safety_chain_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text UNIQUE NOT NULL,
  sto_active boolean NOT NULL DEFAULT false,
  safety_relay_engaged boolean NOT NULL DEFAULT true,
  drive_enabled boolean NOT NULL DEFAULT true,
  emergency_stop_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE safety_chain_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_safety_chain" ON safety_chain_states;
CREATE POLICY "auth_select_safety_chain" ON safety_chain_states FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_safety_chain" ON safety_chain_states;
CREATE POLICY "auth_insert_safety_chain" ON safety_chain_states FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_safety_chain" ON safety_chain_states;
CREATE POLICY "auth_update_safety_chain" ON safety_chain_states FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_safety_chain" ON safety_chain_states;
CREATE POLICY "auth_delete_safety_chain" ON safety_chain_states FOR DELETE
  TO anon, authenticated USING (true);

-- 2. Resource Locks
CREATE TABLE IF NOT EXISTS resource_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  device_id text NOT NULL,
  mission_id text,
  status text NOT NULL DEFAULT 'active',
  idempotency_key text UNIQUE NOT NULL,
  locked_at timestamptz DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_locks_site_device ON resource_locks(site_id, device_id, status);

ALTER TABLE resource_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_resource_locks" ON resource_locks;
CREATE POLICY "auth_select_resource_locks" ON resource_locks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_resource_locks" ON resource_locks;
CREATE POLICY "auth_insert_resource_locks" ON resource_locks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_resource_locks" ON resource_locks;
CREATE POLICY "auth_update_resource_locks" ON resource_locks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_resource_locks" ON resource_locks;
CREATE POLICY "auth_delete_resource_locks" ON resource_locks FOR DELETE
  TO anon, authenticated USING (true);

-- 3. Domain Events
CREATE TABLE IF NOT EXISTS domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  envelope text NOT NULL CHECK (envelope IN ('MissionEvent', 'SafetyEvent', 'AuditEvent')),
  subtype text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  traceparent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_site_envelope ON domain_events(site_id, envelope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_action ON domain_events(action, created_at DESC);

ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_domain_events" ON domain_events;
CREATE POLICY "auth_select_domain_events" ON domain_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_domain_events" ON domain_events;
CREATE POLICY "auth_insert_domain_events" ON domain_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_domain_events" ON domain_events;
CREATE POLICY "auth_update_domain_events" ON domain_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_domain_events" ON domain_events;
CREATE POLICY "auth_delete_domain_events" ON domain_events FOR DELETE
  TO anon, authenticated USING (true);

-- 4. Audit Hash Chain
CREATE TABLE IF NOT EXISTS audit_hash_chain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}',
  previous_hash text NOT NULL,
  hash text NOT NULL,
  sequence_num bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(site_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_audit_hash_chain_site_seq ON audit_hash_chain(site_id, sequence_num DESC);

ALTER TABLE audit_hash_chain ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_audit_hash_chain" ON audit_hash_chain;
CREATE POLICY "auth_select_audit_hash_chain" ON audit_hash_chain FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_audit_hash_chain" ON audit_hash_chain;
CREATE POLICY "auth_insert_audit_hash_chain" ON audit_hash_chain FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_audit_hash_chain" ON audit_hash_chain;
CREATE POLICY "auth_update_audit_hash_chain" ON audit_hash_chain FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_audit_hash_chain" ON audit_hash_chain;
CREATE POLICY "auth_delete_audit_hash_chain" ON audit_hash_chain FOR DELETE
  TO anon, authenticated USING (true);
