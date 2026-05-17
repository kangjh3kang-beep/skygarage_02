/*
  # Add Performance Indexes

  1. New Indexes
    - `idx_complexes_status` on complexes(status) for status filtering
    - `idx_complexes_dq_score` on complexes(data_quality_score) for DQ dashboard
    - `idx_parking_active` on parking_sessions for active session queries
    - `idx_alerts_open` on system_alerts for open alert queries

  2. Notes
    - These indexes support the most common query patterns in the admin dashboard
    - Improves performance for real-time monitoring views
*/

CREATE INDEX IF NOT EXISTS idx_complexes_status ON complexes(status);
CREATE INDEX IF NOT EXISTS idx_complexes_dq_score ON complexes(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_parking_active ON parking_sessions(complex_id) WHERE exit_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_open ON system_alerts(severity, created_at) WHERE status = 'open';