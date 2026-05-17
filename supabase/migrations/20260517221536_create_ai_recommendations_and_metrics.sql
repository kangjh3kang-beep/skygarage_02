/*
  # AI Recommendations and Observability Metrics Infrastructure

  1. New Tables
    - `ai_recommendations`
      - `id` (uuid, primary key)
      - `entity_type` (text) - target entity (residents, contracts, etc.)
      - `entity_id` (uuid, nullable) - specific entity reference
      - `type` (text) - optimization, warning, insight
      - `priority` (text) - high, medium, low
      - `title` (text)
      - `description` (text)
      - `status` (text) - pending, acknowledged, resolved, dismissed
      - `resolved_at` (timestamptz)
      - `resolved_by` (uuid)
      - `metadata` (jsonb) - additional context data
      - `created_at` (timestamptz)

    - `ai_escalations`
      - `id` (uuid, primary key)
      - `source_agent_id` (uuid) - originating agent
      - `target_agent_id` (uuid) - receiving agent
      - `source_tier` (text)
      - `target_tier` (text)
      - `reason` (text)
      - `context` (jsonb)
      - `status` (text) - pending, accepted, completed, rejected
      - `conversation_id` (uuid, nullable)
      - `created_at` (timestamptz)
      - `resolved_at` (timestamptz)

  2. Modified Tables
    - Add `completeness_score` to regions, zones, projects

  3. Security
    - Enable RLS on all new tables
    - Policies for authenticated users
*/

-- AI Recommendations table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  type text NOT NULL DEFAULT 'insight',
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recommendations"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update recommendations"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert recommendations"
  ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- AI Escalations table
CREATE TABLE IF NOT EXISTS ai_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id uuid,
  target_agent_id uuid,
  source_tier text NOT NULL DEFAULT '',
  target_tier text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  context jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  conversation_id uuid,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE ai_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read escalations"
  ON ai_escalations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert escalations"
  ON ai_escalations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update escalations"
  ON ai_escalations FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add completeness_score to tier architecture entities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regions' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE regions ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zones' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE zones ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'completeness_score'
  ) THEN
    ALTER TABLE projects ADD COLUMN completeness_score integer DEFAULT 0;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity ON ai_recommendations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_priority ON ai_recommendations(priority, status);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_status ON ai_escalations(status);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_target ON ai_escalations(target_agent_id, status);
