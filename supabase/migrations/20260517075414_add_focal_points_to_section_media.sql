/*
  # Add focal_points column to section_media

  1. Changes
    - Add `focal_points` (jsonb) column to `section_media` table
      - Stores array of {x: number, y: number, scale?: number} per item index
      - Default '[]' - when empty, items default to center (50% 50%)

  2. Notes
    - Enables admins to set focal points on section media images
    - Used by SectionMediaStrip ImageGrid component for object-position
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'section_media' AND column_name = 'focal_points'
  ) THEN
    ALTER TABLE section_media ADD COLUMN focal_points jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
