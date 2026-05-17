/*
  # Create page_views table for analytics

  1. New Tables
    - `page_views`
      - `id` (uuid, primary key)
      - `page_path` (text) - the URL path visited
      - `referrer` (text) - where the visitor came from
      - `user_agent` (text) - browser user agent string
      - `screen_width` (integer) - viewport width for device analysis
      - `country` (text) - country code if available
      - `session_id` (text) - anonymous session identifier
      - `created_at` (timestamptz) - when the page was viewed

  2. Security
    - Enable RLS on `page_views` table
    - Allow anonymous users to insert page views (tracking from public site)
    - Allow authenticated users to read page views (admin analytics)

  3. Notes
    - Indexed on created_at for time-based queries
    - Indexed on page_path for path-based aggregation
    - No personal data stored, just anonymous analytics
*/

CREATE TABLE IF NOT EXISTS page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL DEFAULT '/',
  referrer text DEFAULT '',
  user_agent text DEFAULT '',
  screen_width integer DEFAULT 0,
  country text DEFAULT '',
  session_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous page view tracking
CREATE POLICY "Anyone can track page views"
  ON page_views
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated admins to read analytics
CREATE POLICY "Authenticated users can read page views"
  ON page_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);

-- Index for path aggregation
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON page_views (page_path);
