/*
  # Create site-assets storage bucket

  1. Changes
    - Create public `site-assets` storage bucket for badge images and site decoration images
    - Add storage policies for authenticated upload and public read

  2. Notes
    - Used by BadgeImageZone component for badge image uploads
    - Public bucket so images can be displayed without authentication
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for site-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Authenticated users can upload to site-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets');

CREATE POLICY "Authenticated users can update site-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets')
  WITH CHECK (bucket_id = 'site-assets');

CREATE POLICY "Authenticated users can delete from site-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets');
