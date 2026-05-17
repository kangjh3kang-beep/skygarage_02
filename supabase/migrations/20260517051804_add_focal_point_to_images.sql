/*
  # Add focal point to site_images and section_media

  1. Changes
    - Add `focal_point` (jsonb) column to `site_images` table
      - Stores {x: number, y: number} as percentage (0-100)
      - Default {x: 50, y: 50} = center
      - Used as CSS object-position when image is cropped via object-fit: cover
    - Add `focal_points` (jsonb) column to `section_media` table
      - Stores array of {x: number, y: number} per item index
      - Default '[]' - when empty, items default to center

  2. Notes
    - Enables admins to drag-adjust the visible portion of images on the frontend
    - No data migration needed - null/empty values default to center (50% 50%)
    - Works with existing object-fit: cover rendering in all frontend components
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_images' AND column_name = 'focal_point'
  ) THEN
    ALTER TABLE site_images ADD COLUMN focal_point jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'section_media' AND column_name = 'focal_points'
  ) THEN
    ALTER TABLE section_media ADD COLUMN focal_points jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
