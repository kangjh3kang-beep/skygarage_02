/*
  # Create AI Recommendations Table

  1. New Tables
    - `ai_recommendations`
      - `id` (uuid, primary key)
      - `title` (text, not null) - recommendation display title
      - `description` (text) - detailed explanation
      - `priority` (text, not null) - high/medium/low
      - `type` (text, not null) - system/data_quality/anomaly/optimization/warning/insight
      - `status` (text, not null, default 'pending') - pending/acknowledged/dismissed/completed
      - `entity_type` (text) - related entity category (crm_leads, energy, system, etc.)
      - `metadata` (jsonb) - additional context data
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `ai_recommendations` table
    - Add policy for authenticated users to read recommendations
    - Add policy for authenticated users to update recommendation status
*/

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  type text NOT NULL DEFAULT 'insight',
  status text NOT NULL DEFAULT 'pending',
  entity_type text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_recommendations"
  ON ai_recommendations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert ai_recommendations"
  ON ai_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update ai_recommendations"
  ON ai_recommendations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity_type ON ai_recommendations(entity_type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_priority ON ai_recommendations(priority);
