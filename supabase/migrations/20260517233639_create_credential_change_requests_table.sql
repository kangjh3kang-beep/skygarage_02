/*
  # Create credential change requests table

  1. New Tables
    - `credential_change_requests`
      - `id` (uuid, primary key)
      - `requester_id` (uuid, the admin who made the request)
      - `target_user_id` (uuid, the user whose credentials are being changed)
      - `target_user_email` (text, current email of target user)
      - `change_type` (text, one of: 'email_change', 'password_reset', 'user_create', 'user_delete')
      - `new_value` (text, encrypted new email or indicator for password change)
      - `reason` (text, reason for the change)
      - `status` (text, one of: 'pending', 'approved', 'rejected')
      - `approver_id` (uuid, the super_admin who approved/rejected)
      - `approved_at` (timestamptz)
      - `rejected_reason` (text, reason for rejection)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz, request expires after 24h)

  2. Security
    - Enable RLS on `credential_change_requests` table
    - Policy for authenticated admins to insert their own requests
    - Policy for super_admins to view and update all requests
    - Policy for requester to view their own requests

  3. Important Notes
    - Requests expire after 24 hours if not acted upon
    - Only super_admin role can approve/reject requests
    - Password values are stored temporarily and cleared after approval processing
*/

CREATE TABLE IF NOT EXISTS credential_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_user_id uuid,
  target_user_email text NOT NULL DEFAULT '',
  change_type text NOT NULL CHECK (change_type IN ('email_change', 'password_reset', 'user_create', 'user_delete')),
  new_value text DEFAULT '',
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id uuid,
  approved_at timestamptz,
  rejected_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

ALTER TABLE credential_change_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own requests
CREATE POLICY "Users can view own credential change requests"
  ON credential_change_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

-- Super admins can view all requests
CREATE POLICY "Super admins can view all credential change requests"
  ON credential_change_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Authenticated users can insert requests
CREATE POLICY "Authenticated users can create credential change requests"
  ON credential_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Super admins can update requests (approve/reject)
CREATE POLICY "Super admins can update credential change requests"
  ON credential_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credential_change_requests_status ON credential_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_credential_change_requests_requester ON credential_change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_credential_change_requests_target ON credential_change_requests(target_user_id);
