/*
  # Create Credential Change Requests Table

  1. New Tables
    - `credential_change_requests`
      - `id` (uuid, primary key)
      - `requester_id` (uuid) - who requested the change
      - `target_user_id` (uuid, nullable) - target user for the change
      - `target_user_email` (text, not null) - target user email
      - `change_type` (text, not null) - email_change/password_reset/user_create/user_delete
      - `new_value` (text) - new credential value
      - `reason` (text) - reason for the request
      - `status` (text, default 'pending') - pending/approved/rejected
      - `approver_id` (uuid, nullable) - who approved/rejected
      - `approved_at` (timestamptz, nullable) - when approved
      - `rejected_reason` (text) - reason for rejection
      - `created_at` (timestamptz, default now())
      - `expires_at` (timestamptz) - when request expires

  2. Security
    - Enable RLS
    - Authenticated users can read and create requests
    - Authenticated users can update request status
*/

CREATE TABLE IF NOT EXISTS credential_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid,
  target_user_id uuid,
  target_user_email text NOT NULL,
  change_type text NOT NULL DEFAULT 'password_reset',
  new_value text DEFAULT '',
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid,
  approved_at timestamptz,
  rejected_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE credential_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read credential_change_requests"
  ON credential_change_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert credential_change_requests"
  ON credential_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update credential_change_requests"
  ON credential_change_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_credential_change_requests_status ON credential_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_credential_change_requests_target ON credential_change_requests(target_user_email);
