/**
 * PALATRIA 4-Envelope Domain Event System
 *
 * MissionEvent - ATR/Elevator mission lifecycle
 * AvailabilityEvent - Parking bay/resource state changes
 * SafetyEvent - Safety chain and emergency events
 * AuditEvent - Compliance and audit trail
 */

export type DeviceType = 'atr_robot' | 'vehicle_elevator' | 'mechanical_tower' | 'parking_bay_sensor';

export type ProtocolType = 'rest_api' | 'mqtt' | 'opc_ua' | 'modbus_tcp';

// --- Envelope 1: MissionEvent ---
export interface MissionEvent {
  envelope: 'mission';
  event_id: string;
  timestamp: string;
  device_type: DeviceType;
  device_serial: string;
  complex_id: string;
  mission_id: string;
  event_type: MissionEventType;
  payload: MissionPayload;
}

export type MissionEventType =
  | 'mission.requested'
  | 'mission.assigned'
  | 'mission.started'
  | 'mission.waypoint_reached'
  | 'mission.vehicle_loaded'
  | 'mission.vehicle_unloaded'
  | 'mission.completed'
  | 'mission.failed'
  | 'mission.cancelled';

export interface MissionPayload {
  vehicle_plate?: string;
  from_zone?: string;
  to_zone?: string;
  floor?: number;
  bay_number?: string;
  eta_seconds?: number;
  progress_pct?: number;
  error_code?: string;
  error_message?: string;
}

// --- Envelope 2: AvailabilityEvent ---
export interface AvailabilityEvent {
  envelope: 'availability';
  event_id: string;
  timestamp: string;
  device_type: DeviceType;
  device_serial: string;
  complex_id: string;
  event_type: AvailabilityEventType;
  payload: AvailabilityPayload;
}

export type AvailabilityEventType =
  | 'bay.occupied'
  | 'bay.vacated'
  | 'bay.reserved'
  | 'bay.released'
  | 'elevator.available'
  | 'elevator.busy'
  | 'elevator.maintenance'
  | 'tower.slot_available'
  | 'tower.slot_occupied'
  | 'atr.idle'
  | 'atr.busy'
  | 'atr.charging';

export interface AvailabilityPayload {
  resource_id: string;
  floor?: number;
  line?: string;
  spot_number?: string;
  is_occupied?: boolean;
  confidence?: number;
  detected_plate?: string;
  slot_index?: number;
}

// --- Envelope 3: SafetyEvent ---
export interface SafetyEvent {
  envelope: 'safety';
  event_id: string;
  timestamp: string;
  device_type: DeviceType;
  device_serial: string;
  complex_id: string;
  site_id: string;
  event_type: SafetyEventType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  payload: SafetyPayload;
}

export type SafetyEventType =
  | 'estop.activated'
  | 'estop.released'
  | 'sto.engaged'
  | 'sto.disengaged'
  | 'safety_relay.open'
  | 'safety_relay.closed'
  | 'collision.detected'
  | 'overload.detected'
  | 'door_zone.breach'
  | 'sensor.inconsistency'
  | 'calibration.drift'
  | 'firmware.alert';

export interface SafetyPayload {
  channel: 'A' | 'B' | 'both';
  sto_active?: boolean;
  safety_relay_engaged?: boolean;
  drive_enabled?: boolean;
  emergency_stop_active?: boolean;
  diagnostic_data?: Record<string, unknown>;
  affected_devices?: string[];
}

// --- Envelope 4: AuditEvent ---
export interface AuditEvent {
  envelope: 'audit';
  event_id: string;
  timestamp: string;
  actor_id: string;
  actor_type: 'system' | 'operator' | 'device' | 'ai_agent';
  complex_id?: string;
  event_type: AuditEventType;
  payload: AuditPayload;
}

export type AuditEventType =
  | 'command.issued'
  | 'command.approved'
  | 'command.rejected'
  | 'safety_gate.evaluated'
  | 'motion_token.issued'
  | 'motion_token.revoked'
  | 'policy.updated'
  | 'device.commissioned'
  | 'device.decommissioned'
  | 'config.changed'
  | 'hil.stage_advanced'
  | 'hil.test_passed'
  | 'hil.test_failed';

export interface AuditPayload {
  command_id?: string;
  device_serial?: string;
  decision?: 'allow' | 'deny';
  conditions_evaluated?: CommandGuardCondition[];
  motion_token?: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

// --- Safety Gate: 10-Condition CommandGuard ---
export type CommandGuardConditionName =
  | 'ALLOW_TRUE'
  | 'SAFE_TRUE'
  | 'RESOURCE_LOCK_VALID'
  | 'RESOURCE_LOCK_UNIQUE'
  | 'SENSOR_CONSISTENT'
  | 'ELEVATOR_ALIGNED'
  | 'DOOR_ZONE_CLEAR'
  | 'STO_READY'
  | 'POLICY_VERSION_VALID'
  | 'MOTION_TOKEN_VALID';

export interface CommandGuardCondition {
  name: CommandGuardConditionName;
  passed: boolean;
  detail?: string;
}

export interface CommandGuardResult {
  decision: 'allow' | 'deny';
  conditions: CommandGuardCondition[];
  motion_token?: string;
  motion_token_expires_at?: string;
  denied_reason?: string;
  evaluated_at: string;
}

// --- HIL Test Stages ---
export type HILStage =
  | 'SIL'
  | 'HIL_BENCH'
  | 'STOP_TEST'
  | 'LEGAL_INSPECTION'
  | 'SINGLE_UNIT'
  | 'PILOT';

export interface HILTestResult {
  stage: HILStage;
  device_type: DeviceType;
  test_case_id: string;
  passed: boolean;
  executed_at: string;
  metrics?: Record<string, number>;
  notes?: string;
}

// --- Management System Layers ---
export type ManagementLayer = 'L1_EDGE' | 'L2_BUILDING' | 'L3_COMPLEX' | 'L4_NETWORK' | 'L5_PASS';

export interface LayerConfig {
  layer: ManagementLayer;
  description: string;
  responsibilities: string[];
  protocols: ProtocolType[];
  device_types: DeviceType[];
}

export const MANAGEMENT_LAYERS: LayerConfig[] = [
  {
    layer: 'L1_EDGE',
    description: 'Edge device direct control',
    responsibilities: ['sensor_read', 'actuator_control', 'local_safety', 'heartbeat'],
    protocols: ['modbus_tcp', 'opc_ua'],
    device_types: ['parking_bay_sensor', 'mechanical_tower'],
  },
  {
    layer: 'L2_BUILDING',
    description: 'Building-level coordination',
    responsibilities: ['elevator_dispatch', 'floor_management', 'zone_coordination'],
    protocols: ['opc_ua', 'mqtt'],
    device_types: ['vehicle_elevator'],
  },
  {
    layer: 'L3_COMPLEX',
    description: 'Complex-level orchestration',
    responsibilities: ['mission_orchestration', 'resource_allocation', 'safety_gate'],
    protocols: ['rest_api', 'mqtt'],
    device_types: ['atr_robot', 'vehicle_elevator', 'mechanical_tower', 'parking_bay_sensor'],
  },
  {
    layer: 'L4_NETWORK',
    description: 'Multi-complex network management',
    responsibilities: ['fleet_optimization', 'cross_complex_routing', 'analytics'],
    protocols: ['rest_api'],
    device_types: ['atr_robot'],
  },
  {
    layer: 'L5_PASS',
    description: 'Platform-as-a-Service layer',
    responsibilities: ['billing', 'user_management', 'partner_api', 'compliance'],
    protocols: ['rest_api'],
    device_types: ['atr_robot', 'vehicle_elevator', 'mechanical_tower', 'parking_bay_sensor'],
  },
];

// Union type for all domain events
export type DomainEvent = MissionEvent | AvailabilityEvent | SafetyEvent | AuditEvent;
