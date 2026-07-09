export interface BaseEvent {
  eventId: string;
  siteId: string;
  timestamp: string;
  idempotencyKey: string;
  traceparent?: string;
}

export type MissionStatus =
  | 'REQUESTED'
  | 'AUTH_CHECKING'
  | 'AUTH_REJECTED'
  | 'SMOOTHING'
  | 'ALLOCATING'
  | 'ALLOCATED'
  | 'DT_VERIFYING'
  | 'DT_VERIFY_FAILED'
  | 'SAFETY_GATING'
  | 'SAFETY_REJECTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'ALIGNING'
  | 'DOCKING'
  | 'AT_PICKUP'
  | 'COMPLETED'
  | 'ROLLBACK'
  | 'FAILED'
  | 'CANCELLED';

export interface MissionEvent extends BaseEvent {
  envelope: 'MissionEvent';
  subtype: 'lifecycle' | 'alloc' | 'verify' | 'access' | 'eta' | 'charge';
  missionId: string;
  status?: MissionStatus;
  payload: Record<string, unknown>;
}

export interface AvailabilityEvent extends BaseEvent {
  envelope: 'AvailabilityEvent';
  subtype: 'availability_changed' | 'place_eta_estimate' | 'price_changed';
  version: number;
  payload: Record<string, unknown>;
}

export type SafetyEventName =
  | 'SafetyApproved'
  | 'SafetyRejected'
  | 'MotionTokenIssued'
  | 'MotionTokenRevoked'
  | 'EmergencyStop'
  | 'EmergencyResume'
  | 'CommandRejected'
  | 'CommandFailed'
  | 'DeviceFault'
  | 'DeviceRestored';

export interface SafetyEvent extends BaseEvent {
  envelope: 'SafetyEvent';
  subtype: 'gate' | 'motion' | 'emergency' | 'device';
  eventName: SafetyEventName;
  deviceId?: string;
  missionId?: string;
  reasonCode?: string;
  payload: Record<string, unknown>;
}

export interface AuditEvent extends BaseEvent {
  envelope: 'AuditEvent';
  subtype: 'authz' | 'session' | 'policy' | 'forecast' | 'settle' | 'ops' | 'alert' | 'ai-detect' | 'ai-action' | 'model';
  userId?: string;
  action: string;
  tableName?: string;
  recordId?: string;
  details: Record<string, unknown>;
  hashPrev?: string;
}

export type DomainEvent = MissionEvent | AvailabilityEvent | SafetyEvent | AuditEvent;

export interface SafetyCondition {
  name: string;
  met: boolean;
  details?: string;
}

export interface CommandGuardResult {
  allowed: boolean;
  conditions: SafetyCondition[];
  reasonCode?: string;
  motionTokenId?: string;
}

export const SAFETY_CONDITIONS = [
  'ALLOW_TRUE',
  'SAFE_TRUE',
  'RESOURCE_LOCK_VALID',
  'RESOURCE_LOCK_UNIQUE',
  'SENSOR_CONSISTENT',
  'ELEVATOR_ALIGNED',
  'DOOR_ZONE_CLEAR',
  'STO_READY',
  'POLICY_VERSION_VALID',
  'MOTION_TOKEN_VALID',
] as const;

export type SafetyConditionName = typeof SAFETY_CONDITIONS[number];

export interface ResourceLock {
  id: string;
  siteId: string;
  resourceType: 'elevator' | 'parking_bay' | 'atr_unit' | 'pickup_zone';
  resourceId: string;
  missionId: string;
  lockedAt: string;
  expiresAt: string;
  status: 'active' | 'released' | 'expired';
}

export type AIOpsAutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface AIOpsAction {
  id: string;
  siteId: string;
  level: AIOpsAutonomyLevel;
  actionType: string;
  description: string;
  proposedAt: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected' | 'failed';
  approvedBy?: string;
  modelVersion: string;
}

export interface AnomalyDetection {
  id: string;
  siteId: string;
  detectedAt: string;
  category: 'thermal' | 'queue_explosion' | 'sensor_drift' | 'pattern_anomaly' | 'security_threat';
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  resolved: boolean;
}

export interface BottleneckMetric {
  resourceType: string;
  resourceId: string;
  utilization: number;
  queueDepth: number;
  p95WaitMinutes: number;
  isBottleneck: boolean;
  threshold: number;
}

export interface TelemetryPayload {
  siteId: string;
  timestamp: string;
  metrics: {
    elevatorUtilization: number;
    elevatorQueueDepth: number;
    atrUtilization: number;
    missionP95Minutes: number;
    slaCompliance: number;
    prePullApplied: number;
  };
}
