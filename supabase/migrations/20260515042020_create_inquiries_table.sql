/*
  # Create inquiries table

  1. New Tables
    - `inquiries`
      - `id` (text, primary key) - formatted inquiry ID like "INQ-001"
      - `company` (text) - company name
      - `name` (text) - contact person name
      - `phone` (text) - phone number
      - `email` (text) - email address
      - `project_type` (text) - type of project inquiry
      - `message` (text) - inquiry message content
      - `status` (text) - current status: 접수대기, 검토중, 답변완료, 보류
      - `admin_notes` (jsonb) - array of admin notes
      - `status_history` (jsonb) - array of status change records
      - `reply_content` (text) - admin reply content
      - `replied_at` (timestamptz) - when reply was sent
      - `created_at` (timestamptz) - when inquiry was submitted
      - `updated_at` (timestamptz) - last update time

  2. Security
    - Enable RLS on `inquiries` table
    - Add policy for anonymous users to insert (submit inquiries from public site)
    - Add policy for authenticated users (admins) to read all inquiries
    - Add policy for authenticated users (admins) to update inquiries

  3. Notes
    - Auto-generates formatted ID using a sequence
    - Default status is '접수대기'
    - admin_notes and status_history default to empty arrays
*/

-- Create sequence for inquiry IDs
CREATE SEQUENCE IF NOT EXISTS inquiry_id_seq START WITH 1;

-- Create inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id text PRIMARY KEY DEFAULT ('INQ-' || lpad(nextval('inquiry_id_seq')::text, 3, '0')),
  company text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  project_type text NOT NULL DEFAULT 'other',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '접수대기',
  admin_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_content text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to submit inquiries (public contact form)
CREATE POLICY "Anyone can submit inquiries"
  ON inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated admins to read all inquiries
CREATE POLICY "Authenticated users can read inquiries"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated admins to update inquiries
CREATE POLICY "Authenticated users can update inquiries"
  ON inquiries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated admins to delete inquiries
CREATE POLICY "Authenticated users can delete inquiries"
  ON inquiries
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
