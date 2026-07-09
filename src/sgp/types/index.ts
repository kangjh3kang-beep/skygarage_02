// Sky Garage Pass (SGP) User App Domain Types
// Based on Sky_Garage_사용자앱_IDE_단계별_구현프롬프트_v1.0

// ─── User & Auth ───
export interface SgpUser {
  id: string;
  phone: string;
  display_name: string;
  avatar_url: string;
  nfc_token: string | null;
  is_verified: boolean;
  status: 'active' | 'suspended' | 'dormant';
  created_at: string;
}

// ─── Place / Favorites (§4.1) ───
export type PlaceType = 'HOME_UNIT' | 'OFFICE' | 'PARTNER' | 'VISITOR_TARGET';
export type PlaceGrantStatus = 'active' | 'pending' | 'revoked' | 'expired';

export interface Place {
  id: string;
  userId: string;
  siteId: string;
  type: PlaceType;
  grant: PlaceGrantStatus;
  label: string;
  order: number;
  group: PlaceType;
  isDefault: boolean;
  capabilities: PlaceCapability[];
  siteName: string;
  siteAddress: string;
  availableSpots?: number;
  etaMinutes?: number;
  etaAsOf?: string;
  etaValidFor?: number;
}

export type PlaceCapability = 'DIRECT_UNIT' | 'AUTO_VALET' | 'RESERVATION' | 'LPR' | 'QR' | 'NFC';

// ─── Mission (§6.1) ───
export type UserMissionStatus =
  | 'REQUESTED' | 'QUEUED' | 'ALLOCATING' | 'IN_TRANSIT'
  | 'ALIGNING' | 'DOCKING' | 'AT_PICKUP' | 'COMPLETED'
  | 'CANCELLED' | 'FAILED' | 'SAFETY_REJECTED' | 'ROLLED_BACK';

export type MissionType = 'DIRECT_UNIT_EXIT' | 'DIRECT_UNIT_ENTRY' | 'AUTO_VALET_CHECKIN' | 'AUTO_VALET_EXIT' | 'SCHEDULED';

export interface Mission {
  id: string;
  userId: string;
  siteId: string;
  placeId: string;
  vehicleId: string;
  type: MissionType;
  status: UserMissionStatus;
  requestedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  eta?: EtaSnapshot;
  reasonCode?: string;
  idempotencyKey: string;
}

export interface EtaSnapshot {
  value: number;
  asOf: string;
  validFor: number;
}

// ─── Vehicle ───
export interface Vehicle {
  id: string;
  userId: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
}

// ─── Wallet & Credits (§SB-7) ───
export interface SgpCoinWallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_charged: number;
  lifetime_spent: number;
  auto_charge_enabled: boolean;
  auto_charge_threshold: number;
  auto_charge_amount: number;
  status: 'active' | 'frozen';
  created_at: string;
}

export interface SgpCoinTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'charge' | 'payment' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

export interface SgpParkingPayment {
  id: string;
  user_id: string;
  complex_id: string;
  vehicle_plate: string;
  entry_at: string;
  exit_at: string | null;
  duration_minutes: number;
  amount_coins: number;
  payment_method: 'nfc_tag' | 'auto_deduct' | 'manual';
  nfc_terminal_id: string;
  status: 'pending' | 'completed' | 'refunded';
  created_at: string;
}

// ─── Consent (§1.2-6 PIPA) ───
export type ConsentCategory = 'location' | 'vehicle_pii' | 'marketing' | 'third_party' | 'analytics';

export interface ConsentRecord {
  id: string;
  userId: string;
  category: ConsentCategory;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  version: string;
}

// ─── Reservation (§SB-4) ───
export type ReservationStatus = 'confirmed' | 'pending_payment' | 'cancelled' | 'completed' | 'expired';

export interface Reservation {
  id: string;
  userId: string;
  siteId: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  accessPassId?: string;
  amount: number;
  createdAt: string;
}

// ─── Visitor (§SB-6) ───
export interface VisitorInvitation {
  id: string;
  hostUserId: string;
  siteId: string;
  guestName: string;
  guestVehiclePlate: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'redeemed' | 'expired' | 'cancelled';
  accessToken: string;
  createdAt: string;
}

// ─── Notification ───
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  category: 'mission' | 'safety' | 'wallet' | 'visitor' | 'system';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ─── Household / 세대원 ───
export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: 'owner' | 'member' | 'guardian';
  displayName: string;
  invitedAt: string;
  acceptedAt?: string;
  status: 'pending' | 'active' | 'revoked';
}

// ─── Complex Membership (legacy compat) ───
export interface SgpComplexMembership {
  id: string;
  user_id: string;
  complex_id: string;
  unit_number: string;
  building_dong: string;
  role: 'resident' | 'owner' | 'tenant';
  request_status: 'pending' | 'approved' | 'rejected';
  requested_by: 'user' | 'admin';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  complex?: { id: string; name: string; address: string };
}

// ─── Realtime Events (§6.0 Shared Catalog) ───
export type AppEventEnvelope = 'MissionEvent' | 'SafetyEvent' | 'AuditEvent' | 'AvailabilityEvent';

export interface RealtimeEvent {
  eventId: string;
  seq: number;
  envelope: AppEventEnvelope;
  action: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ─── Offline Queue (§1.2-5) ───
export interface QueuedRequest {
  id: string;
  idempotencyKey: string;
  requestedAt: string;
  expiresAt: string;
  endpoint: string;
  method: string;
  body: Record<string, unknown>;
  status: 'pending' | 'sent' | 'expired' | 'confirmed';
}
