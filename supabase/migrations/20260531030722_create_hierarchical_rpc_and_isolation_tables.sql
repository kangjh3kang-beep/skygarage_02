/*
  # Create Hierarchical RPC & Tenant Isolation Infrastructure Tables
  Patent Component [660] - Governance Registry

  1. New Tables
    - `rpc_service_calls`
      - Tracks all inter-tier RPC calls (Building->Complex->NOC)
      - `id` (uuid, primary key)
      - `caller_tier` (text) - noc_hub/complex_edge/building_edge
      - `callee_tier` (text) - target tier
      - `complex_id` (text) - source complex
      - `building_id` (text) - source building
      - `method` (text) - RPC method name
      - `payload_hash` (text) - SHA-256 hash of payload (no raw PII)
      - `integrity_hash` (text) - hash chain block hash
      - `vector_clock` (jsonb) - vector clock state at time of call
      - `status` (text) - pending/completed/failed/cached
      - `response_time_ms` (integer) - round-trip time
      - `created_at` (timestamptz)

    - `tenant_isolation_audit`
      - Audit log for all tenant boundary access attempts
      - `id` (uuid, primary key)
      - `tenant_id` (text) - requesting tenant
      - `complex_id` (text) - tenant's home complex
      - `target_complex_id` (text) - resource being accessed
      - `result` (text) - allowed/denied_403/lockout
      - `governance_id` (text) - [660] identifier
      - `violation_count` (integer) - cumulative violations
      - `locked_out` (boolean) - whether lockout was triggered
      - `created_at` (timestamptz)

    - `pii_token_registry`
      - Registry of tokenized PII for auditing (no raw values stored)
      - `id` (uuid, primary key)
      - `complex_id` (text) - which complex owns this token
      - `token` (text) - the SGT_ token string
      - `category` (text) - vehicle_plate/unit_number/movement_trail
      - `salt_id` (text) - reference to local salt (not the salt itself)
      - `created_at` (timestamptz)

    - `edge_sync_status`
      - Tracks sync state of each edge node
      - `id` (uuid, primary key)
      - `node_id` (text, unique) - edge node identifier
      - `tier` (text) - noc_hub/complex_edge/building_edge
      - `complex_id` (text)
      - `status` (text) - live/cached/resyncing
      - `pending_count` (integer) - cached messages awaiting sync
      - `last_sync_at` (timestamptz)
      - `chain_length` (integer) - hash chain block count
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read/insert audit and sync data
    - Only system can modify rpc_service_calls
*/

-- RPC Service Calls
CREATE TABLE IF NOT EXISTS rpc_service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_tier text NOT NULL DEFAULT 'building_edge',
  callee_tier text NOT NULL DEFAULT 'complex_edge',
  complex_id text NOT NULL DEFAULT '',
  building_id text DEFAULT '',
  method text NOT NULL DEFAULT '',
  payload_hash text DEFAULT '',
  integrity_hash text DEFAULT '',
  vector_clock jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  response_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rpc_service_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rpc_service_calls"
  ON rpc_service_calls FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert rpc_service_calls"
  ON rpc_service_calls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_rpc_calls_complex ON rpc_service_calls(complex_id);
CREATE INDEX IF NOT EXISTS idx_rpc_calls_status ON rpc_service_calls(status);
CREATE INDEX IF NOT EXISTS idx_rpc_calls_created ON rpc_service_calls(created_at DESC);

-- Tenant Isolation Audit
CREATE TABLE IF NOT EXISTS tenant_isolation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT '',
  complex_id text NOT NULL DEFAULT '',
  target_complex_id text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'denied_403',
  governance_id text NOT NULL DEFAULT '[660]',
  violation_count integer DEFAULT 0,
  locked_out boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_isolation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tenant_isolation_audit"
  ON tenant_isolation_audit FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tenant_isolation_audit"
  ON tenant_isolation_audit FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_isolation_audit_tenant ON tenant_isolation_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_isolation_audit_result ON tenant_isolation_audit(result);

-- PII Token Registry (no raw PII values stored here)
CREATE TABLE IF NOT EXISTS pii_token_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'vehicle_plate',
  salt_id text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pii_token_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pii_token_registry"
  ON pii_token_registry FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pii_token_registry"
  ON pii_token_registry FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pii_token_complex ON pii_token_registry(complex_id);
CREATE INDEX IF NOT EXISTS idx_pii_token_category ON pii_token_registry(category);

-- Edge Sync Status
CREATE TABLE IF NOT EXISTS edge_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id text NOT NULL UNIQUE DEFAULT '',
  tier text NOT NULL DEFAULT 'building_edge',
  complex_id text DEFAULT '',
  status text NOT NULL DEFAULT 'live',
  pending_count integer DEFAULT 0,
  last_sync_at timestamptz DEFAULT now(),
  chain_length integer DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE edge_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read edge_sync_status"
  ON edge_sync_status FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert edge_sync_status"
  ON edge_sync_status FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update edge_sync_status"
  ON edge_sync_status FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_edge_sync_node ON edge_sync_status(node_id);
CREATE INDEX IF NOT EXISTS idx_edge_sync_status ON edge_sync_status(status);
