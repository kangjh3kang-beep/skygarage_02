/*
  # Fix site_images RLS - Allow admins to read ALL images

  1. Security Changes
    - Drop existing SELECT policy that only allows viewing active images
    - Add new policy: public/anon can still see active images
    - Add new policy: authenticated users can see ALL images (for admin management)

  2. Important Notes
    - This fixes the bug where admins cannot see uploaded images with active=false
    - Public users still only see active images
*/

DROP POLICY IF EXISTS "Anyone can view active site images" ON site_images;

CREATE POLICY "Public can view active site images"
  ON site_images FOR SELECT
  TO anon
  USING (active = true);

CREATE POLICY "Authenticated users can view all site images"
  ON site_images FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
