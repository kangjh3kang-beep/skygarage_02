-- Access passes for member access control
CREATE TABLE IF NOT EXISTS access_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  member_id text NOT NULL,
  member_type text NOT NULL CHECK (member_type IN ('RESIDENT', 'VISITOR', 'EXTERNAL', 'CORPORATE')),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'active', 'expired', 'suspended', 'revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE access_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_access_passes" ON access_passes FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_access_passes" ON access_passes FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_access_passes" ON access_passes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_access_passes" ON access_passes FOR DELETE
  TO authenticated USING (true);

CREATE INDEX idx_access_passes_site ON access_passes(site_id);
CREATE INDEX idx_access_passes_member ON access_passes(member_id);
CREATE INDEX idx_access_passes_status ON access_passes(status);
