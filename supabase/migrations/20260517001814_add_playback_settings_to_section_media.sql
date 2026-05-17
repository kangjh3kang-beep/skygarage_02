/*
  # Add playback settings to section_media table

  1. Changes
    - Add `playback_settings` (jsonb) column to `section_media` table
    - Stores video playback configuration:
      - `autoplay` (boolean) - Whether videos auto-play when visible
      - `muted` (boolean) - Whether videos start muted
      - `loop` (boolean) - Whether playlist loops after last video
      - `show_controls` (boolean) - Whether to show native video controls
      - `play_mode` (text) - 'sequential' (auto-advance) or 'manual' (user clicks next)
      - `transition_delay` (number) - Seconds to wait between videos in sequential mode

  2. Notes
    - Default settings provide a good UX: autoplay muted with sequential advance
    - Column is nullable, code falls back to sensible defaults when null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'section_media' AND column_name = 'playback_settings'
  ) THEN
    ALTER TABLE section_media ADD COLUMN playback_settings jsonb DEFAULT '{"autoplay": true, "muted": true, "loop": true, "show_controls": false, "play_mode": "sequential", "transition_delay": 1}'::jsonb;
  END IF;
END $$;
