/*
  # Add alias/missing columns for maintenance_logs and section_media

  1. Modified Tables
    - maintenance_logs: add target_type, target_id, scheduled_at, completed_at columns
      (existing equipment_type, equipment_id, scheduled_date, completed_date remain)
    - section_media: add position, layout, items columns (existing section_key, urls remain)

  2. Important Notes
    - These columns act as supplemental fields used by the admin UI
    - Existing data is preserved - no destructive operations
*/

-- maintenance_logs: add target_type, target_id, scheduled_at, completed_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='target_type') THEN
    ALTER TABLE maintenance_logs ADD COLUMN target_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='target_id') THEN
    ALTER TABLE maintenance_logs ADD COLUMN target_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='scheduled_at') THEN
    ALTER TABLE maintenance_logs ADD COLUMN scheduled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='completed_at') THEN
    ALTER TABLE maintenance_logs ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- section_media: add position, layout, items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='section_media' AND column_name='position') THEN
    ALTER TABLE section_media ADD COLUMN position text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='section_media' AND column_name='layout') THEN
    ALTER TABLE section_media ADD COLUMN layout text DEFAULT 'grid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='section_media' AND column_name='items') THEN
    ALTER TABLE section_media ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
