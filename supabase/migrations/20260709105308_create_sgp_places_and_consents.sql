-- SGP Places (Favorites) table for multi-site support
CREATE TABLE IF NOT EXISTS sgp_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('HOME_UNIT', 'OFFICE', 'PARTNER', 'VISITOR_TARGET')),
  grant_status text NOT NULL DEFAULT 'pending' CHECK (grant_status IN ('active', 'pending', 'revoked', 'expired')),
  label text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 1,
  is_default boolean NOT NULL DEFAULT false,
  capabilities text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, site_id)
);

ALTER TABLE sgp_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sgp_places" ON sgp_places FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_sgp_places" ON sgp_places FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_sgp_places" ON sgp_places FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_sgp_places" ON sgp_places FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_sgp_places_user ON sgp_places(user_id);

-- SGP Consents table for PIPA compliance
CREATE TABLE IF NOT EXISTS sgp_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('location', 'vehicle_pii', 'marketing', 'third_party', 'analytics')),
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  version text NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

ALTER TABLE sgp_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sgp_consents" ON sgp_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_sgp_consents" ON sgp_consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_sgp_consents" ON sgp_consents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_sgp_consents" ON sgp_consents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Office invite codes table
CREATE TABLE IF NOT EXISTS office_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  site_id text NOT NULL,
  site_name text NOT NULL DEFAULT '',
  is_used boolean NOT NULL DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE office_invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_office_codes" ON office_invite_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "update_office_codes" ON office_invite_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
