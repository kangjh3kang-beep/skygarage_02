/*
  # Create section_media table

  1. New Tables
    - `section_media`
      - `id` (uuid, primary key)
      - `position` (text, not null) - identifies the slot between two sections (e.g., "after_hero", "after_brand_story")
      - `layout` (text, not null, default '1col') - layout type: '1col', '2col', '3col'
      - `media_type` (text, not null, default 'image') - 'image' or 'video'
      - `items` (jsonb, not null, default '[]') - array of media items with url, alt, video_url fields
      - `sort_order` (integer, default 0) - ordering within same position
      - `active` (boolean, default true) - whether to display
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `section_media` table
    - Public read for active media (SELECT for anon and authenticated)
    - Authenticated users can manage media (INSERT, UPDATE, DELETE)

  3. Notes
    - The `items` JSONB stores up to 3 media entries: [{url, alt, video_url}]
    - `position` values correspond to section boundaries on the landing page
    - `layout` determines the column arrangement for images
*/

CREATE TABLE IF NOT EXISTS section_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL,
  layout text NOT NULL DEFAULT '1col',
  media_type text NOT NULL DEFAULT 'image',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE section_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active section media"
  ON section_media
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Authenticated users can insert section media"
  ON section_media
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update section media"
  ON section_media
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete section media"
  ON section_media
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
