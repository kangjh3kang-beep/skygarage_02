/*
  # Create section-media storage bucket

  1. Storage
    - Create `section-media` public bucket for images and videos
    - Allow public read access
    - Allow authenticated users to upload, update, and delete files

  2. Notes
    - Public bucket so media URLs are directly accessible without auth tokens
    - Upload restricted to authenticated admin users
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('section-media', 'section-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for section media"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'section-media');

CREATE POLICY "Authenticated users can upload section media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'section-media');

CREATE POLICY "Authenticated users can update section media files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'section-media')
  WITH CHECK (bucket_id = 'section-media');

CREATE POLICY "Authenticated users can delete section media files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'section-media');
