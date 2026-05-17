/*
  # Create site_images table

  1. New Tables
    - `site_images`
      - `id` (uuid, primary key)
      - `slot` (text, not null) - identifies image location e.g. "hero-badge-top", "benefit-1-bottom"
      - `url` (text, not null) - public URL of the image
      - `alt` (text) - alt text for accessibility
      - `filename` (text) - original filename
      - `file_size` (integer) - file size in bytes
      - `focal_point` (jsonb) - {x, y, scale} for object-position
      - `active` (boolean) - whether this image is currently displayed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can SELECT
    - Authenticated users can INSERT/UPDATE (admin operations)

  3. Notes
    - Used by BadgeImageZone component for badge decoration images
    - Used by useSiteImages hook for landing page image overrides
    - slot format: "{section}-{position}" e.g. "hero-badge-top"
*/

CREATE TABLE IF NOT EXISTS site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL,
  url text NOT NULL,
  alt text DEFAULT '',
  filename text DEFAULT '',
  file_size integer DEFAULT 0,
  focal_point jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_images_slot_active ON site_images (slot, active);

ALTER TABLE site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active site images"
  ON site_images FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert site images"
  ON site_images FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update site images"
  ON site_images FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete site images"
  ON site_images FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
