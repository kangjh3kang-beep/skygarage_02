/*
  # Create 5-Tier Architecture Tables

  1. New Tables
    - `regions` - T1 Region Hub entities (geographic regions)
      - `id` (uuid, primary key)
      - `name` (text) - Region display name
      - `code` (text, unique) - Region code (e.g., KR, SG, AE)
      - `timezone` (text) - IANA timezone
      - `country` (text) - Country name
      - `status` (text) - active/inactive
      - `created_at` (timestamptz)
    
    - `zones` - T2 Zone Console entities (sub-regions)
      - `id` (uuid, primary key)
      - `region_id` (uuid, FK → regions)
      - `name` (text) - Zone display name
      - `code` (text, unique) - Zone code
      - `description` (text)
      - `status` (text) - active/inactive
      - `created_at` (timestamptz)
    
    - `ai_agent_configs` - AI Agent configuration per tier
      - `id` (uuid, primary key)
      - `tier` (text) - T0/T1/T2/T3/T4
      - `agent_name` (text) - Aegis/Aurora/Atlas/Argus/Athena
      - `display_name` (text)
      - `description` (text)
      - `model` (text) - AI model identifier
      - `system_prompt` (text)
      - `tools` (jsonb) - Available tool definitions
      - `active` (boolean)
      - `created_at` (timestamptz)
    
    - `ai_conversations` - AI conversation history
      - `id` (uuid, primary key)
      - `agent_id` (uuid, FK → ai_agent_configs)
      - `user_id` (uuid, FK → auth.users)
      - `complex_id` (uuid, FK → complexes, nullable)
      - `title` (text)
      - `messages` (jsonb) - Array of message objects
      - `status` (text) - active/archived
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `workflow_definitions` - Workflow templates
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `trigger_event` (text)
      - `tier` (text) - Which tier owns this workflow
      - `steps` (jsonb) - Step definitions array
      - `active` (boolean)
      - `created_at` (timestamptz)
    
    - `workflow_executions` - Running workflow instances
      - `id` (uuid, primary key)
      - `definition_id` (uuid, FK → workflow_definitions)
      - `complex_id` (uuid, FK → complexes, nullable)
      - `status` (text) - pending/running/waiting/completed/failed
      - `current_step` (integer)
      - `context` (jsonb) - Workflow variables
      - `error_message` (text)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `next_retry_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `event_log` - Central event bus log
      - `id` (uuid, primary key)
      - `event_type` (text) - e.g., 'atr.dispatched', 'parking.entry'
      - `source_tier` (text) - T0/T1/T2/T3/T4
      - `source_id` (text) - Source entity identifier
      - `complex_id` (uuid, FK → complexes, nullable)
      - `payload` (jsonb) - Event data
      - `processed` (boolean)
      - `created_at` (timestamptz)
    
    - `projects` - T4 Project Tracker
      - `id` (uuid, primary key)
      - `name` (text)
      - `complex_id` (uuid, FK → complexes, nullable)
      - `region_id` (uuid, FK → regions, nullable)
      - `status` (text) - planning/in_progress/completed/on_hold/cancelled
      - `phase` (text) - design/permit/construction/testing/commissioning
      - `budget_krw` (numeric)
      - `spent_krw` (numeric, default 0)
      - `start_date` (date)
      - `target_date` (date)
      - `completed_date` (date, nullable)
      - `manager` (text)
      - `description` (text)
      - `created_at` (timestamptz)
    
    - `project_milestones` - Project milestones
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK → projects)
      - `title` (text)
      - `description` (text)
      - `due_date` (date)
      - `completed_at` (timestamptz, nullable)
      - `status` (text) - pending/in_progress/completed/overdue
      - `sort_order` (integer)
      - `created_at` (timestamptz)
    
    - `observability_metrics` - System observability data
      - `id` (uuid, primary key)
      - `metric_name` (text)
      - `tier` (text) - T0/T1/T2/T3/T4
      - `source` (text) - Source system/component
      - `complex_id` (uuid, FK → complexes, nullable)
      - `value` (numeric)
      - `unit` (text)
      - `labels` (jsonb)
      - `recorded_at` (timestamptz)

  2. Modified Tables
    - `complexes` - Add `zone_id` foreign key column

  3. Security
    - Enable RLS on all new tables
    - Authenticated users can SELECT all tier tables
    - INSERT/UPDATE/DELETE restricted to authenticated users

  4. Indexes
    - zones: region_id
    - ai_conversations: user_id, agent_id
    - workflow_executions: definition_id, status
    - event_log: event_type, created_at
    - projects: status, region_id
    - observability_metrics: metric_name, recorded_at
*/

-- Regions table (T1)
CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  country text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read regions"
  ON regions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert regions"
  ON regions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update regions"
  ON regions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete regions"
  ON regions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Zones table (T2)
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read zones"
  ON zones FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert zones"
  ON zones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update zones"
  ON zones FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete zones"
  ON zones FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_zones_region_id ON zones(region_id);

-- Add zone_id to complexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE complexes ADD COLUMN zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- AI Agent Configs
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  agent_name text NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  model text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_prompt text DEFAULT '',
  tools jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_agent_configs"
  ON ai_agent_configs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert ai_agent_configs"
  ON ai_agent_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update ai_agent_configs"
  ON ai_agent_configs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete ai_agent_configs"
  ON ai_agent_configs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agent_configs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  title text DEFAULT '',
  messages jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversations"
  ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations"
  ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent_id ON ai_conversations(agent_id);

-- Workflow Definitions
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  trigger_event text NOT NULL,
  tier text NOT NULL DEFAULT 'T3',
  steps jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workflow_definitions"
  ON workflow_definitions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert workflow_definitions"
  ON workflow_definitions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update workflow_definitions"
  ON workflow_definitions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete workflow_definitions"
  ON workflow_definitions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  current_step integer DEFAULT 0,
  context jsonb DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workflow_executions"
  ON workflow_executions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert workflow_executions"
  ON workflow_executions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update workflow_executions"
  ON workflow_executions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete workflow_executions"
  ON workflow_executions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_definition_id ON workflow_executions(definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- Event Log
CREATE TABLE IF NOT EXISTS event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source_tier text NOT NULL DEFAULT 'T3',
  source_id text DEFAULT '',
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event_log"
  ON event_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert event_log"
  ON event_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update event_log"
  ON event_log FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_complex_id ON event_log(complex_id, created_at DESC);

-- Projects (T4)
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning',
  phase text NOT NULL DEFAULT 'design',
  budget_krw numeric DEFAULT 0,
  spent_krw numeric DEFAULT 0,
  start_date date,
  target_date date,
  completed_date date,
  manager text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read projects"
  ON projects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update projects"
  ON projects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete projects"
  ON projects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_region_id ON projects(region_id);

-- Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  due_date date NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project_milestones"
  ON project_milestones FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert project_milestones"
  ON project_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update project_milestones"
  ON project_milestones FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete project_milestones"
  ON project_milestones FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Observability Metrics
CREATE TABLE IF NOT EXISTS observability_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  tier text NOT NULL DEFAULT 'T3',
  source text DEFAULT '',
  complex_id uuid REFERENCES complexes(id) ON DELETE SET NULL,
  value numeric NOT NULL,
  unit text DEFAULT '',
  labels jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE observability_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read observability_metrics"
  ON observability_metrics FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert observability_metrics"
  ON observability_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_observability_metrics_name ON observability_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_metrics_tier ON observability_metrics(tier, recorded_at DESC);

-- Seed data: Regions
INSERT INTO regions (name, code, timezone, country, status) VALUES
  ('한국', 'KR', 'Asia/Seoul', '대한민국', 'active'),
  ('싱가포르', 'SG', 'Asia/Singapore', 'Singapore', 'active'),
  ('중동', 'AE', 'Asia/Dubai', 'UAE', 'active'),
  ('북미', 'US', 'America/New_York', 'USA', 'poc'),
  ('유럽', 'EU', 'Europe/Berlin', 'Germany', 'poc')
ON CONFLICT (code) DO NOTHING;

-- Seed data: Zones
INSERT INTO zones (region_id, name, code, description, status) VALUES
  ((SELECT id FROM regions WHERE code = 'KR'), '수도권', 'KR-METRO', '서울/경기/인천 수도권 지역', 'active'),
  ((SELECT id FROM regions WHERE code = 'KR'), '영남권', 'KR-YEONG', '부산/대구/경상 지역', 'active'),
  ((SELECT id FROM regions WHERE code = 'KR'), '충청권', 'KR-CHUNG', '대전/세종/충청 지역', 'active'),
  ((SELECT id FROM regions WHERE code = 'SG'), '싱가포르 센트럴', 'SG-CENT', 'Singapore Central Region', 'active'),
  ((SELECT id FROM regions WHERE code = 'AE'), '두바이', 'AE-DXB', 'Dubai Metropolitan', 'active')
ON CONFLICT (code) DO NOTHING;

-- Seed data: AI Agent Configs
INSERT INTO ai_agent_configs (tier, agent_name, display_name, description, model, system_prompt, tools) VALUES
  ('T0', 'aegis', 'Aegis', '글로벌 보안 정책 및 규정 준수 관리 AI', 'claude-sonnet-4-20250514', 'You are Aegis, the T0 Global NOC AI agent responsible for security policy, compliance, and cross-region oversight.', '[{"name": "query_security_audit", "description": "Query security audit logs"}, {"name": "check_compliance", "description": "Check regulatory compliance status"}, {"name": "update_policy", "description": "Update security policy"}]'::jsonb),
  ('T1', 'aurora', 'Aurora', '리전 최적화 및 자원 배분 AI', 'claude-sonnet-4-20250514', 'You are Aurora, the T1 Region Hub AI agent responsible for regional optimization, resource allocation, and cross-zone coordination.', '[{"name": "query_region_metrics", "description": "Query region performance metrics"}, {"name": "allocate_resources", "description": "Redistribute resources across zones"}, {"name": "generate_report", "description": "Generate regional report"}]'::jsonb),
  ('T2', 'atlas', 'Atlas', '존 운영 조율 및 스케줄링 AI', 'claude-sonnet-4-20250514', 'You are Atlas, the T2 Zone Console AI agent responsible for zone-level operations coordination, scheduling, and SLA monitoring.', '[{"name": "manage_schedule", "description": "Manage maintenance schedules"}, {"name": "create_work_order", "description": "Create work orders"}, {"name": "monitor_sla", "description": "Monitor SLA compliance"}]'::jsonb),
  ('T3', 'argus', 'Argus', '실시간 단지 감시 및 이상 탐지 AI', 'claude-sonnet-4-20250514', 'You are Argus, the T3 Complex Edge AI agent responsible for real-time complex monitoring, anomaly detection, and immediate incident response.', '[{"name": "query_sensors", "description": "Query sensor data"}, {"name": "control_atr", "description": "Send ATR commands"}, {"name": "create_alert", "description": "Create system alert"}]'::jsonb),
  ('T4', 'athena', 'Athena', '프로젝트 기획 및 예측 분석 AI', 'claude-sonnet-4-20250514', 'You are Athena, the T4 Project Tracker AI agent responsible for project planning, predictive analytics, ROI calculation, and timeline optimization.', '[{"name": "create_project", "description": "Create new installation project"}, {"name": "calculate_roi", "description": "Calculate project ROI"}, {"name": "optimize_timeline", "description": "Optimize project timeline"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- Seed data: Workflow Definitions
INSERT INTO workflow_definitions (name, description, trigger_event, tier, steps, active) VALUES
  ('입차 프로세스', '차량 입차부터 주차 완료까지의 전체 프로세스', 'vehicle.detected', 'T3',
   '[{"step": 1, "name": "authenticate", "action": "rfid_auth", "timeout": 30}, {"step": 2, "name": "assign_slot", "action": "slot_assignment", "timeout": 10}, {"step": 3, "name": "dispatch_atr", "action": "atr_dispatch", "timeout": 60}, {"step": 4, "name": "transport", "action": "vehicle_transport", "timeout": 180}, {"step": 5, "name": "park_complete", "action": "parking_confirm", "timeout": 30}]'::jsonb, true),
  ('출차 프로세스', '차량 호출부터 출차 완료까지의 프로세스', 'retrieval.requested', 'T3',
   '[{"step": 1, "name": "validate_request", "action": "request_validation", "timeout": 10}, {"step": 2, "name": "dispatch_atr", "action": "atr_dispatch", "timeout": 60}, {"step": 3, "name": "retrieve_vehicle", "action": "vehicle_retrieve", "timeout": 180}, {"step": 4, "name": "exit_ready", "action": "exit_preparation", "timeout": 60}, {"step": 5, "name": "exit_complete", "action": "exit_confirm", "timeout": 30}]'::jsonb, true),
  ('예방 정비', '정기 예방 정비 워크플로우', 'maintenance.scheduled', 'T3',
   '[{"step": 1, "name": "create_alert", "action": "notification_create", "timeout": 0}, {"step": 2, "name": "assign_tech", "action": "technician_assign", "timeout": 3600}, {"step": 3, "name": "start_work", "action": "work_start", "timeout": 86400}, {"step": 4, "name": "complete_report", "action": "report_submit", "timeout": 3600}, {"step": 5, "name": "verify", "action": "verification", "timeout": 3600}]'::jsonb, true),
  ('에너지 최적화', '에너지 소비 최적화 및 V2G 스케줄링', 'energy.peak_detected', 'T2',
   '[{"step": 1, "name": "analyze_consumption", "action": "energy_analysis", "timeout": 60}, {"step": 2, "name": "solar_forecast", "action": "solar_prediction", "timeout": 30}, {"step": 3, "name": "v2g_schedule", "action": "v2g_optimization", "timeout": 60}, {"step": 4, "name": "ev_optimize", "action": "ev_charging_schedule", "timeout": 60}]'::jsonb, true),
  ('안전 사고 대응', '안전 이벤트 발생 시 즉각 대응 프로세스', 'safety.triggered', 'T3',
   '[{"step": 1, "name": "detect", "action": "event_detection", "timeout": 1}, {"step": 2, "name": "halt_system", "action": "emergency_stop", "timeout": 5}, {"step": 3, "name": "assess", "action": "situation_assessment", "timeout": 300}, {"step": 4, "name": "respond", "action": "corrective_action", "timeout": 1800}, {"step": 5, "name": "recover", "action": "system_recovery", "timeout": 600}, {"step": 6, "name": "report", "action": "incident_report", "timeout": 3600}]'::jsonb, true),
  ('입주민 온보딩', '신규 입주민 등록 전체 프로세스', 'resident.contract_signed', 'T3',
   '[{"step": 1, "name": "create_account", "action": "account_creation", "timeout": 60}, {"step": 2, "name": "register_vehicle", "action": "vehicle_registration", "timeout": 300}, {"step": 3, "name": "issue_card", "action": "card_issuance", "timeout": 86400}, {"step": 4, "name": "app_guide", "action": "app_onboarding", "timeout": 86400}, {"step": 5, "name": "activate", "action": "account_activation", "timeout": 60}]'::jsonb, true),
  ('빌링 사이클', '월간 청구 프로세스', 'billing.monthly_trigger', 'T2',
   '[{"step": 1, "name": "aggregate_usage", "action": "usage_aggregation", "timeout": 300}, {"step": 2, "name": "generate_invoice", "action": "invoice_generation", "timeout": 60}, {"step": 3, "name": "send_invoice", "action": "invoice_delivery", "timeout": 60}, {"step": 4, "name": "confirm_payment", "action": "payment_confirmation", "timeout": 604800}, {"step": 5, "name": "handle_overdue", "action": "overdue_processing", "timeout": 604800}]'::jsonb, true),
  ('알림 에스컬레이션', '미응답 알림 자동 에스컬레이션', 'alert.unacknowledged', 'T1',
   '[{"step": 1, "name": "first_notify", "action": "primary_notification", "timeout": 300}, {"step": 2, "name": "wait_response", "action": "response_wait", "timeout": 600}, {"step": 3, "name": "escalate_l2", "action": "secondary_notification", "timeout": 300}, {"step": 4, "name": "manager_escalate", "action": "manager_notification", "timeout": 900}, {"step": 5, "name": "auto_action", "action": "automated_response", "timeout": 60}]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Seed data: Projects
INSERT INTO projects (name, region_id, status, phase, budget_krw, spent_krw, start_date, target_date, manager, description) VALUES
  ('판교 테크노밸리 2단지', (SELECT id FROM regions WHERE code = 'KR'), 'in_progress', 'construction', 15000000000, 8500000000, '2025-03-01', '2026-06-30', '김건설', '판교 테크노밸리 2단지 스카이가라지 설치 프로젝트'),
  ('송도 국제도시 A블록', (SELECT id FROM regions WHERE code = 'KR'), 'planning', 'design', 22000000000, 1200000000, '2025-09-01', '2027-03-31', '이설계', '송도 국제도시 A블록 신규 스카이가라지 설계'),
  ('Singapore Marina Bay', (SELECT id FROM regions WHERE code = 'SG'), 'in_progress', 'testing', 8000000000, 7200000000, '2024-06-01', '2026-02-28', 'David Chen', 'Marina Bay residential tower SkyGarage installation'),
  ('Dubai Palm Tower', (SELECT id FROM regions WHERE code = 'AE'), 'planning', 'permit', 35000000000, 500000000, '2026-01-01', '2028-06-30', 'Ahmed Al-Rashid', 'Palm Jumeirah luxury tower SkyGarage project')
ON CONFLICT DO NOTHING;
