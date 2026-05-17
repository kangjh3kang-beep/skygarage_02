/*
  # Create admin_notifications table

  1. New Tables
    - `admin_notifications`
      - `id` (uuid, primary key)
      - `type` (text) - notification type: 'inquiry', 'warning', 'system'
      - `title` (text) - notification title
      - `message` (text) - notification body text
      - `inquiry_id` (text, nullable) - reference to related inquiry
      - `read` (boolean, default false) - whether notification has been read
      - `created_at` (timestamptz) - when notification was created

  2. Security
    - Enable RLS on `admin_notifications` table
    - Add policies for authenticated admin users to read, update, delete, insert

  3. Trigger
    - Auto-generate notification when a new inquiry is inserted into `inquiries` table

  4. Index
    - Index on (read, created_at DESC) for fast unread count queries
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  inquiry_id text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notifications"
  ON admin_notifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert notifications"
  ON admin_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update notifications"
  ON admin_notifications FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete notifications"
  ON admin_notifications FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_read
  ON admin_notifications (read, created_at DESC);

-- Function to auto-generate notification on new inquiry
CREATE OR REPLACE FUNCTION notify_new_inquiry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, inquiry_id)
  VALUES (
    'inquiry',
    '신규 도입문의 접수',
    NEW.company || ' ' || NEW.name || '님의 문의가 접수되었습니다. (' || NEW.id || ')',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on inquiries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_inquiry_insert'
  ) THEN
    CREATE TRIGGER on_inquiry_insert
      AFTER INSERT ON inquiries
      FOR EACH ROW
      EXECUTE FUNCTION notify_new_inquiry();
  END IF;
END $$;
