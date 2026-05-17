/*
  # Fix site_images SELECT policy for public read access

  1. Changes
    - Drop existing SELECT policy that requires authentication
    - Create new SELECT policy allowing anon + authenticated access for active images
    
  2. Notes
    - site_images are used on the public landing page (badge images)
    - Non-authenticated visitors need to see badge images
    - Only active images are publicly visible (same pattern as section_media)
    - INSERT/UPDATE/DELETE still require authentication
*/

DROP POLICY IF EXISTS "Anyone can view active site images" ON site_images;

CREATE POLICY "Anyone can view active site images"
  ON site_images FOR SELECT
  TO anon, authenticated
  USING (active = true);
