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

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  REQUESTED: '요청됨',
  AUTH_CHECKING: '인증 확인중',
  AUTH_REJECTED: '인증 거절',
  SMOOTHING: '수요 평활화',
  ALLOCATING: '배차 중',
  ALLOCATED: '배차 완료',
  DT_VERIFYING: '디지털 트윈 검증',
  DT_VERIFY_FAILED: '트윈 검증 실패',
  SAFETY_GATING: '안전 게이팅',
  SAFETY_REJECTED: '안전 거절',
  APPROVED: '승인됨',
  IN_TRANSIT: '이송 중',
  ALIGNING: '정렬 중',
  DOCKING: '도킹 중',
  AT_PICKUP: '픽업존 대기',
  COMPLETED: '완료',
  ROLLBACK: '롤백',
  FAILED: '실패',
  CANCELLED: '취소됨',
};

export const MISSION_STATUS_COLORS: Record<MissionStatus, string> = {
  REQUESTED: '#64748b',
  AUTH_CHECKING: '#3b82f6',
  AUTH_REJECTED: '#ef4444',
  SMOOTHING: '#8b5cf6',
  ALLOCATING: '#f59e0b',
  ALLOCATED: '#10b981',
  DT_VERIFYING: '#6366f1',
  DT_VERIFY_FAILED: '#ef4444',
  SAFETY_GATING: '#f97316',
  SAFETY_REJECTED: '#ef4444',
  APPROVED: '#22c55e',
  IN_TRANSIT: '#0ea5e9',
  ALIGNING: '#06b6d4',
  DOCKING: '#14b8a6',
  AT_PICKUP: '#84cc16',
  COMPLETED: '#22c55e',
  ROLLBACK: '#f97316',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
};

export const BOTTLENECK_CONTROL_POINTS: MissionStatus[] = [
  'ALLOCATING',
  'SMOOTHING',
  'IN_TRANSIT',
];

export const TERMINAL_STATUSES: MissionStatus[] = [
  'COMPLETED',
  'AUTH_REJECTED',
  'SAFETY_REJECTED',
  'FAILED',
  'CANCELLED',
];

export interface Mission {
  id: string;
  siteId: string;
  vehicleId: string;
  householdId: string;
  status: MissionStatus;
  priority: number;
  requestedAt: string;
  completedAt?: string;
  assignedAtrId?: string;
  assignedElevatorId?: string;
  assignedBayId?: string;
  idempotencyKey: string;
  traceparent?: string;
}

export type EventEnvelope = 'MissionEvent' | 'SafetyEvent' | 'AuditEvent';

export type MissionEventSubtype = 'lifecycle' | 'alloc' | 'verify' | 'access' | 'charge';
export type SafetyEventSubtype = 'gate' | 'motion' | 'emergency' | 'device';
export type AuditEventSubtype = 'authz' | 'session' | 'policy' | 'settle' | 'ops' | 'alert';

export interface BaseEvent {
  id: string;
  siteId: string;
  timestamp: string;
  idempotencyKey: string;
  traceparent?: string;
}

export interface MissionEvent extends BaseEvent {
  envelope: 'MissionEvent';
  subtype: MissionEventSubtype;
  missionId: string;
  payload: Record<string, unknown>;
}

export interface SafetyEvent extends BaseEvent {
  envelope: 'SafetyEvent';
  subtype: SafetyEventSubtype;
  deviceId?: string;
  payload: Record<string, unknown>;
}

export interface AuditEvent extends BaseEvent {
  envelope: 'AuditEvent';
  subtype: AuditEventSubtype;
  actorId: string;
  action: string;
  resource: string;
  payload: Record<string, unknown>;
}

export type DomainEvent = MissionEvent | SafetyEvent | AuditEvent;

export interface CommandGuardCheck {
  allowTrue: boolean;
  safeTrue: boolean;
  resourceLockValid: boolean;
  resourceLockUnique: boolean;
  sensorConsistent: boolean;
  elevatorAligned: boolean;
  doorZoneClear: boolean;
  stoReady: boolean;
  policyVersionValid: boolean;
  motionTokenValid: boolean;
}

export function isCommandApproved(check: CommandGuardCheck): boolean {
  return Object.values(check).every(Boolean);
}

export interface SafetyChainState {
  siteId: string;
  stoActive: boolean;
  safetyRelayEngaged: boolean;
  driveEnabled: boolean;
  emergencyStopActive: boolean;
  lastUpdated: string;
}

export type AccessPassStatus = 'issued' | 'active' | 'expired' | 'suspended' | 'revoked';

export interface AccessPass {
  id: string;
  memberId: string;
  memberType: 'RESIDENT' | 'VISITOR' | 'EXTERNAL' | 'CORPORATE';
  status: AccessPassStatus;
  siteId: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokeReason?: string;
}
