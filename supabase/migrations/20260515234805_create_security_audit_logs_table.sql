/*
  # Create security audit logs table

  1. New Tables
    - `security_audit_logs`
      - `id` (uuid, primary key)
      - `complex_id` (uuid, nullable, references complexes)
      - `event_type` (text) - login_success, login_failure, permission_change, data_export, config_change, api_access, firewall_block, intrusion_attempt
      - `severity` (text) - low, medium, high, critical
      - `actor` (text) - who performed the action
      - `target` (text) - what was affected
      - `ip_address` (text) - source IP
      - `user_agent` (text, nullable) - browser/client info
      - `details` (jsonb) - additional event details
      - `status` (text) - success, failure, blocked
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `security_audit_logs` table
    - Add policy for authenticated users to read
    - Add policy for authenticated users to insert

  3. Seed Data
    - 40 sample audit log entries
*/

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  actor text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  user_agent text,
  details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read security audit logs"
  ON security_audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert security audit logs"
  ON security_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed data
INSERT INTO security_audit_logs (complex_id, event_type, severity, actor, target, ip_address, user_agent, details, status, created_at) VALUES
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'login_success', 'low', 'admin@skygarage.io', 'admin_portal', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"session_id": "sess_abc123"}', 'success', now() - interval '10 minutes'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'login_failure', 'medium', 'unknown@test.com', 'admin_portal', '45.33.12.88', 'Python-urllib/3.10', '{"attempts": 3, "reason": "invalid_credentials"}', 'failure', now() - interval '25 minutes'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'api_access', 'low', 'partner_sdk_elevator', 'api/v1/elevators', '10.0.0.15', NULL, '{"endpoint": "/status", "method": "GET"}', 'success', now() - interval '30 minutes'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'config_change', 'high', 'admin@skygarage.io', 'system_settings', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"field": "max_parking_fee", "old": 50000, "new": 60000}', 'success', now() - interval '1 hour'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'firewall_block', 'high', 'system', 'network_perimeter', '91.240.118.45', NULL, '{"rule": "geo_block_CN", "packets": 1240}', 'blocked', now() - interval '2 hours'),
  (NULL, 'intrusion_attempt', 'critical', 'unknown', 'ssh_gateway', '185.220.101.33', NULL, '{"method": "brute_force", "attempts": 847, "blocked_at": "attempt_5"}', 'blocked', now() - interval '3 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'data_export', 'medium', 'admin@skygarage.io', 'resident_accounts', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"records": 150, "format": "csv"}', 'success', now() - interval '4 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'permission_change', 'high', 'admin@skygarage.io', 'user:tech01@skygarage.io', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"role": "operator", "added": ["maintenance_write"]}', 'success', now() - interval '5 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'login_success', 'low', 'operator@skygarage.io', 'admin_portal', '192.168.2.50', 'Mozilla/5.0 Firefox/120', '{"session_id": "sess_def456"}', 'success', now() - interval '6 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'api_access', 'low', 'mobile_app_v3', 'api/v1/parking/status', '172.16.0.22', 'SkyGarage-iOS/3.2.1', '{"resident_id": "res_001"}', 'success', now() - interval '7 hours'),
  (NULL, 'login_failure', 'high', 'admin@skygarage.io', 'admin_portal', '103.21.244.0', 'curl/7.88.0', '{"attempts": 5, "reason": "geo_mismatch", "expected_geo": "KR", "actual_geo": "CN"}', 'blocked', now() - interval '8 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'config_change', 'medium', 'admin@skygarage.io', 'alert_thresholds', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"field": "critical_temp_celsius", "old": 60, "new": 55}', 'success', now() - interval '9 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'firewall_block', 'medium', 'system', 'api_gateway', '178.128.55.12', NULL, '{"rule": "rate_limit", "requests_per_min": 500}', 'blocked', now() - interval '10 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'login_success', 'low', 'tech01@skygarage.io', 'admin_portal', '192.168.1.105', 'Mozilla/5.0 Chrome/125', '{"session_id": "sess_ghi789"}', 'success', now() - interval '11 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'data_export', 'medium', 'operator@skygarage.io', 'energy_metrics', '192.168.2.50', 'Mozilla/5.0 Firefox/120', '{"records": 365, "format": "xlsx"}', 'success', now() - interval '12 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'api_access', 'low', 'partner_sdk_ev', 'api/v1/charging/sessions', '10.0.0.20', NULL, '{"endpoint": "/start", "method": "POST"}', 'success', now() - interval '13 hours'),
  (NULL, 'intrusion_attempt', 'critical', 'unknown', 'api_gateway', '45.155.205.100', 'sqlmap/1.7', '{"method": "sql_injection", "path": "/api/v1/login", "payload_hash": "a3f2..."}', 'blocked', now() - interval '14 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'permission_change', 'medium', 'admin@skygarage.io', 'role:maintenance_team', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"action": "add_member", "user": "new_tech@skygarage.io"}', 'success', now() - interval '15 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'login_failure', 'medium', 'operator@skygarage.io', 'admin_portal', '192.168.2.50', 'Mozilla/5.0 Firefox/120', '{"attempts": 2, "reason": "expired_password"}', 'failure', now() - interval '18 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'config_change', 'medium', 'admin@skygarage.io', 'backup_schedule', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"field": "frequency", "old": "daily", "new": "every_6h"}', 'success', now() - interval '20 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'firewall_block', 'high', 'system', 'network_perimeter', '62.102.148.69', NULL, '{"rule": "known_threat_ip", "threat_intel": "tor_exit_node"}', 'blocked', now() - interval '22 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'api_access', 'low', 'partner_sdk_atr', 'api/v1/atr/command', '10.0.0.30', NULL, '{"endpoint": "/move", "method": "POST", "atr_id": "ATR-001"}', 'success', now() - interval '1 day'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'login_success', 'low', 'admin@skygarage.io', 'admin_portal', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{}', 'success', now() - interval '1 day 2 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'data_export', 'high', 'admin@skygarage.io', 'billing_invoices', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"records": 500, "format": "pdf", "includes_pii": true}', 'success', now() - interval '1 day 4 hours'),
  (NULL, 'login_failure', 'critical', 'unknown', 'api_gateway', '5.188.62.214', 'go-http-client/1.1', '{"attempts": 100, "reason": "credential_stuffing", "unique_passwords": 100}', 'blocked', now() - interval '1 day 6 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'config_change', 'high', 'admin@skygarage.io', 'rls_policies', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"table": "resident_accounts", "action": "policy_update"}', 'success', now() - interval '1 day 8 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'api_access', 'medium', 'external_api', 'api/v1/webhooks/stripe', '54.187.174.169', NULL, '{"event": "payment.succeeded", "invoice": "INV-2026-0006"}', 'success', now() - interval '1 day 10 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'firewall_block', 'medium', 'system', 'admin_portal', '104.248.50.87', 'Nikto/2.5.0', '{"rule": "scanner_detection", "scan_type": "vulnerability"}', 'blocked', now() - interval '1 day 12 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'permission_change', 'medium', 'admin@skygarage.io', 'api_key:partner_elevator', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"action": "rotate", "old_prefix": "sk_...abc", "new_prefix": "sk_...xyz"}', 'success', now() - interval '1 day 14 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'login_success', 'low', 'tech02@skygarage.io', 'admin_portal', '192.168.2.55', 'Mozilla/5.0 Safari/17', '{}', 'success', now() - interval '1 day 16 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'intrusion_attempt', 'high', 'unknown', 'admin_portal', '89.248.165.0', 'Mozilla/5.0', '{"method": "xss_reflected", "path": "/admin/settings?q=<script>"}', 'blocked', now() - interval '2 days'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'config_change', 'low', 'operator@skygarage.io', 'display_settings', '192.168.2.50', 'Mozilla/5.0 Firefox/120', '{"field": "dashboard_refresh_rate", "old": 30, "new": 15}', 'success', now() - interval '2 days 2 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'data_export', 'low', 'tech01@skygarage.io', 'maintenance_logs', '192.168.1.105', 'Mozilla/5.0 Chrome/125', '{"records": 45, "format": "csv"}', 'success', now() - interval '2 days 4 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'api_access', 'low', 'mobile_app_v3', 'api/v1/residents/profile', '172.16.0.25', 'SkyGarage-Android/3.1.0', '{}', 'success', now() - interval '2 days 6 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'login_failure', 'low', 'tech02@skygarage.io', 'admin_portal', '192.168.2.55', 'Mozilla/5.0 Safari/17', '{"attempts": 1, "reason": "typo"}', 'failure', now() - interval '2 days 8 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'firewall_block', 'critical', 'system', 'database', '198.51.100.23', NULL, '{"rule": "db_direct_access", "port": 5432, "source": "external"}', 'blocked', now() - interval '2 days 10 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'api_access', 'low', 'cron_service', 'api/v1/reports/generate', '127.0.0.1', NULL, '{"report": "daily_revenue"}', 'success', now() - interval '2 days 12 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'permission_change', 'high', 'admin@skygarage.io', 'system_config', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"action": "enable_2fa_enforcement", "scope": "all_admins"}', 'success', now() - interval '2 days 14 hours'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 0), 'login_success', 'low', 'admin@skygarage.io', 'admin_portal', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"2fa": true}', 'success', now() - interval '3 days'),
  ((SELECT id FROM complexes LIMIT 1 OFFSET 1), 'config_change', 'medium', 'admin@skygarage.io', 'notification_rules', '192.168.1.100', 'Mozilla/5.0 Chrome/125', '{"rule": "critical_alert_sms", "action": "enabled"}', 'success', now() - interval '3 days 2 hours');
