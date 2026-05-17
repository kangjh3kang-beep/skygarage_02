/*
  # Create Admin Missions and Engagement Tracking

  1. New Tables
    - `admin_missions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - The admin user
      - `mission_type` (text) - daily, weekly, onboarding
      - `mission_key` (text) - Unique key like "review_alerts", "update_complex"
      - `title` (text) - Korean title for the mission
      - `description` (text) - Mission description
      - `target_count` (integer) - Number of times to complete
      - `current_count` (integer) - Progress count
      - `completed` (boolean) - Whether completed
      - `completed_at` (timestamptz) - When completed
      - `expires_at` (timestamptz) - When mission expires (for daily/weekly)
      - `xp_reward` (integer) - XP points rewarded
      - `created_at` (timestamptz)

    - `admin_streaks`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - The admin user
      - `current_streak` (integer) - Current consecutive days
      - `longest_streak` (integer) - All-time longest streak
      - `last_active_date` (date) - Last date user was active
      - `total_xp` (integer) - Total accumulated XP
      - `level` (integer) - Current level
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Users can only read/write their own data

  3. Notes
    - Hooked model implementation: Trigger -> Action -> Variable Reward -> Investment
    - Missions provide the trigger and action, XP provides variable reward
    - Streaks represent the investment that increases switching cost
*/

CREATE TABLE IF NOT EXISTS admin_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_type text NOT NULL DEFAULT 'daily',
  mission_key text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  target_count integer NOT NULL DEFAULT 1,
  current_count integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  expires_at timestamptz,
  xp_reward integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own missions"
  ON admin_missions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
  ON admin_missions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
  ON admin_missions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS admin_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date NOT NULL DEFAULT CURRENT_DATE,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streaks"
  ON admin_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON admin_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON admin_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_admin_missions_user ON admin_missions(user_id, mission_type);
CREATE INDEX IF NOT EXISTS idx_admin_missions_expires ON admin_missions(expires_at) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_admin_streaks_user ON admin_streaks(user_id);