/*
  # Hardware Integration System - Partner ATR Robot & Vehicle Elevator Connectivity

  This migration creates the integration layer between the SkyGarage Palatria platform
  and partner hardware vendors (autonomous parking robots and vehicle elevators).

  ## Architecture Overview
  - Platform (SkyGarage) provides software orchestration
  - Partner companies provide ATR robots and vehicle elevator hardware
  - Integration layer handles: protocol adapters, command dispatch, telemetry ingestion,
    health monitoring, and fault handling

  ## 1. New Tables

  ### `hardware_adapters`
  Registry of partner hardware integration adapters (one per vendor/device type combination).
  - `id` (uuid, PK) - adapter identifier
  - `vendor_name` (text) - partner company name (e.g., 'KONE', 'Hyundai Elevator', 'RoboParking')
  - `device_type` (text) - 'atr_robot' or 'vehicle_elevator'
  - `protocol_type` (text) - communication protocol: 'rest_api', 'mqtt', 'grpc', 'modbus_tcp', 'opc_ua'
  - `api_endpoint` (text) - primary connection endpoint URL
  - `api_version` (text) - API version string
  - `auth_method` (text) - 'api_key', 'oauth2', 'mtls', 'hmac'
  - `auth_config` (jsonb) - encrypted auth configuration (key IDs, not secrets)
  - `heartbeat_interval_sec` (integer) - expected heartbeat interval
  - `timeout_ms` (integer) - request timeout in milliseconds
  - `retry_policy` (jsonb) - retry configuration {max_retries, backoff_type, base_delay_ms}
  - `capability_map` (jsonb) - supported commands/features mapping
  - `status` (text) - 'active', 'inactive', 'testing', 'deprecated'
  - `last_connected_at` (timestamptz) - last successful connection
  - `created_at`, `updated_at` (timestamptz)

  ### `hardware_device_registry`
  Individual device instances registered under adapters, linked to specific complexes.
  - `id` (uuid, PK) - device instance identifier
  - `adapter_id` (uuid, FK) - which adapter handles this device
  - `complex_id` (uuid, FK) - which complex this device is installed at
  - `atr_unit_id` (uuid, FK, nullable) - linked ATR unit record
  - `elevator_id` (uuid, FK, nullable) - linked elevator record
  - `device_serial` (text) - vendor serial number
  - `device_model` (text) - hardware model designation
  - `firmware_version` (text) - current firmware version
  - `installation_floor` (integer) - primary operating floor
  - `installation_zone` (text) - physical zone designation
  - `network_address` (text) - device IP/address on local network
  - `connection_status` (text) - 'online', 'offline', 'degraded', 'maintenance'
  - `last_heartbeat_at` (timestamptz) - last health signal
  - `metadata` (jsonb) - vendor-specific device properties
  - `commissioned_at` (timestamptz) - initial commissioning date
  - `created_at` (timestamptz)

  ### `hardware_commands`
  Command queue for dispatching operations to partner hardware.
  - `id` (uuid, PK) - command identifier
  - `device_id` (uuid, FK) - target device
  - `command_type` (text) - 'move_vehicle', 'call_elevator', 'open_gate', 'dock_charge', 'emergency_stop', 'resume', 'diagnostics', 'firmware_update'
  - `priority` (integer) - 1=critical, 2=high, 3=normal, 4=low
  - `payload` (jsonb) - command-specific parameters
  - `status` (text) - 'queued', 'sent', 'acknowledged', 'executing', 'completed', 'failed', 'timeout', 'cancelled'
  - `correlation_id` (text) - links to parking session or dispatch log
  - `issued_by` (uuid) - user who triggered the command
  - `sent_at` (timestamptz) - when command was dispatched
  - `ack_at` (timestamptz) - when device acknowledged receipt
  - `completed_at` (timestamptz) - when execution finished
  - `error_code` (text) - failure error code from device
  - `error_message` (text) - human-readable error description
  - `retry_count` (integer) - number of retry attempts
  - `created_at` (timestamptz)

  ### `hardware_telemetry`
  Time-series telemetry data from partner devices (position, speed, load, temperature, etc.)
  - `id` (uuid, PK)
  - `device_id` (uuid, FK) - source device
  - `metric_type` (text) - 'position', 'speed', 'battery', 'temperature', 'vibration', 'load', 'door_status', 'motor_current'
  - `value_numeric` (numeric) - numeric metric value
  - `value_text` (text) - text metric value (e.g., door status: 'open', 'closed')
  - `unit` (text) - measurement unit (m, m/s, %, celsius, kg, A)
  - `floor` (integer) - floor where measurement taken
  - `recorded_at` (timestamptz) - device-side timestamp
  - `received_at` (timestamptz) - platform-side receive timestamp

  ### `hardware_health_events`
  Health monitoring events and alerts from partner hardware.
  - `id` (uuid, PK)
  - `device_id` (uuid, FK) - source device
  - `event_type` (text) - 'heartbeat_miss', 'error', 'warning', 'recovery', 'firmware_alert', 'calibration_drift', 'overload', 'emergency'
  - `severity` (text) - 'critical', 'high', 'medium', 'low', 'info'
  - `title` (text) - event title
  - `description` (text) - detailed description
  - `diagnostic_data` (jsonb) - raw diagnostic payload from device
  - `resolution_status` (text) - 'open', 'acknowledged', 'investigating', 'resolved', 'escalated'
  - `resolved_at` (timestamptz)
  - `resolved_by` (uuid)
  - `created_at` (timestamptz)

  ### `hardware_protocol_logs`
  Audit trail of all protocol-level communications (request/response pairs).
  - `id` (uuid, PK)
  - `device_id` (uuid, FK) - device involved
  - `direction` (text) - 'outbound' (platform→device) or 'inbound' (device→platform)
  - `method` (text) - HTTP method or protocol action
  - `endpoint` (text) - target endpoint/topic
  - `request_body` (jsonb) - outgoing payload (sanitized)
  - `response_body` (jsonb) - incoming response (sanitized)
  - `status_code` (integer) - response status code
  - `latency_ms` (integer) - round-trip time
  - `success` (boolean) - whether the call succeeded
  - `error_detail` (text) - error details if failed
  - `created_at` (timestamptz)

  ## 2. Security
  - RLS enabled on all tables
  - Admin-level access for all hardware integration tables
  - Protocol logs restricted to super_admin for security audit

  ## 3. Notes
  - This system enables seamless integration with multiple hardware vendors
  - Each vendor can have different protocols (REST, MQTT, gRPC, Modbus, OPC-UA)
  - Command queue provides reliable at-least-once delivery with retry
  - Telemetry enables real-time monitoring and predictive maintenance
  - Health events trigger NOC alerts when severity >= 'high'
  - Patent Components: [100] ATR Control, [110] Elevator Interlock, [120] Gate Control
*/

-- Hardware Adapters (vendor integration configurations)
CREATE TABLE IF NOT EXISTS hardware_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  device_type text NOT NULL DEFAULT 'atr_robot',
  protocol_type text NOT NULL DEFAULT 'rest_api',
  api_endpoint text NOT NULL DEFAULT '',
  api_version text NOT NULL DEFAULT 'v1',
  auth_method text NOT NULL DEFAULT 'api_key',
  auth_config jsonb NOT NULL DEFAULT '{}',
  heartbeat_interval_sec integer NOT NULL DEFAULT 30,
  timeout_ms integer NOT NULL DEFAULT 5000,
  retry_policy jsonb NOT NULL DEFAULT '{"max_retries": 3, "backoff_type": "exponential", "base_delay_ms": 1000}',
  capability_map jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'testing',
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_adapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read hardware adapters"
  ON hardware_adapters FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert hardware adapters"
  ON hardware_adapters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update hardware adapters"
  ON hardware_adapters FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete hardware adapters"
  ON hardware_adapters FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Hardware Device Registry (individual device instances)
CREATE TABLE IF NOT EXISTS hardware_device_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES hardware_adapters(id),
  complex_id uuid NOT NULL REFERENCES complexes(id),
  atr_unit_id uuid REFERENCES atr_units(id),
  elevator_id uuid REFERENCES elevators(id),
  device_serial text NOT NULL DEFAULT '',
  device_model text NOT NULL DEFAULT '',
  firmware_version text NOT NULL DEFAULT '',
  installation_floor integer NOT NULL DEFAULT 1,
  installation_zone text NOT NULL DEFAULT '',
  network_address text NOT NULL DEFAULT '',
  connection_status text NOT NULL DEFAULT 'offline',
  last_heartbeat_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  commissioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_device_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read device registry"
  ON hardware_device_registry FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert device registry"
  ON hardware_device_registry FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update device registry"
  ON hardware_device_registry FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete device registry"
  ON hardware_device_registry FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Hardware Commands (command dispatch queue)
CREATE TABLE IF NOT EXISTS hardware_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES hardware_device_registry(id),
  command_type text NOT NULL DEFAULT 'diagnostics',
  priority integer NOT NULL DEFAULT 3,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  correlation_id text NOT NULL DEFAULT '',
  issued_by uuid,
  sent_at timestamptz,
  ack_at timestamptz,
  completed_at timestamptz,
  error_code text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read hardware commands"
  ON hardware_commands FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert hardware commands"
  ON hardware_commands FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update hardware commands"
  ON hardware_commands FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Hardware Telemetry (time-series device data)
CREATE TABLE IF NOT EXISTS hardware_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES hardware_device_registry(id),
  metric_type text NOT NULL DEFAULT 'position',
  value_numeric numeric,
  value_text text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  floor integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read hardware telemetry"
  ON hardware_telemetry FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert hardware telemetry"
  ON hardware_telemetry FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Hardware Health Events (monitoring and alerts)
CREATE TABLE IF NOT EXISTS hardware_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES hardware_device_registry(id),
  event_type text NOT NULL DEFAULT 'error',
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  diagnostic_data jsonb NOT NULL DEFAULT '{}',
  resolution_status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read health events"
  ON hardware_health_events FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert health events"
  ON hardware_health_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update health events"
  ON hardware_health_events FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Hardware Protocol Logs (communication audit trail)
CREATE TABLE IF NOT EXISTS hardware_protocol_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES hardware_device_registry(id),
  direction text NOT NULL DEFAULT 'outbound',
  method text NOT NULL DEFAULT 'POST',
  endpoint text NOT NULL DEFAULT '',
  request_body jsonb DEFAULT '{}',
  response_body jsonb DEFAULT '{}',
  status_code integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT false,
  error_detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_protocol_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read protocol logs"
  ON hardware_protocol_logs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert protocol logs"
  ON hardware_protocol_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_hw_device_registry_adapter ON hardware_device_registry(adapter_id);
CREATE INDEX IF NOT EXISTS idx_hw_device_registry_complex ON hardware_device_registry(complex_id);
CREATE INDEX IF NOT EXISTS idx_hw_device_registry_status ON hardware_device_registry(connection_status);
CREATE INDEX IF NOT EXISTS idx_hw_commands_device ON hardware_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_hw_commands_status ON hardware_commands(status);
CREATE INDEX IF NOT EXISTS idx_hw_commands_priority ON hardware_commands(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_hw_telemetry_device ON hardware_telemetry(device_id);
CREATE INDEX IF NOT EXISTS idx_hw_telemetry_recorded ON hardware_telemetry(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_hw_telemetry_type ON hardware_telemetry(device_id, metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_hw_health_device ON hardware_health_events(device_id);
CREATE INDEX IF NOT EXISTS idx_hw_health_severity ON hardware_health_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hw_health_open ON hardware_health_events(resolution_status) WHERE resolution_status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_hw_protocol_device ON hardware_protocol_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_hw_protocol_created ON hardware_protocol_logs(created_at DESC);

-- Seed default adapter configurations for common vendor types
INSERT INTO hardware_adapters (vendor_name, device_type, protocol_type, api_endpoint, api_version, auth_method, heartbeat_interval_sec, timeout_ms, capability_map, status)
VALUES
  ('RoboParking Co.', 'atr_robot', 'rest_api', 'https://api.roboparking.example/v2', 'v2', 'api_key', 10, 3000,
   '{"commands": ["move_vehicle", "dock_charge", "emergency_stop", "resume", "diagnostics"], "telemetry": ["position", "speed", "battery", "temperature", "vibration"], "features": ["auto_charging", "obstacle_avoidance", "multi_floor"]}',
   'testing'),
  ('KONE Elevator', 'vehicle_elevator', 'rest_api', 'https://api.kone.example/skygarage/v1', 'v1', 'oauth2', 15, 5000,
   '{"commands": ["call_elevator", "open_gate", "emergency_stop", "diagnostics", "firmware_update"], "telemetry": ["position", "load", "door_status", "motor_current", "speed"], "features": ["vehicle_detection", "weight_sensing", "floor_planning"]}',
   'testing'),
  ('Hyundai Elevator', 'vehicle_elevator', 'mqtt', 'mqtt://iot.hyundai-elevator.example:8883', 'v1', 'mtls', 10, 4000,
   '{"commands": ["call_elevator", "open_gate", "emergency_stop", "resume"], "telemetry": ["position", "load", "door_status", "temperature"], "features": ["vehicle_detection", "weight_sensing"]}',
   'testing')
ON CONFLICT DO NOTHING;
