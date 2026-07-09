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

export type PlaceType = 'HOME_UNIT' | 'OFFICE' | 'PARTNER';
export type PlaceGrantStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED';

export interface Place {
  id: string;
  userId: string;
  siteId: string;
  siteName: string;
  label: string;
  type: PlaceType;
  grantStatus: PlaceGrantStatus;
  isDefault: boolean;
  sortOrder: number;
  etaMinutes?: number;
  createdAt: string;
}

export type MissionType = 'DIRECT_UNIT_EXIT' | 'DIRECT_UNIT_ENTRY' | 'AUTO_VALET_CHECKIN' | 'AUTO_VALET_EXIT' | 'SCHEDULED';

export type UserMissionStatus = 'REQUESTED' | 'QUEUED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SAFETY_REJECTED';

export interface EtaSnapshot {
  estimatedMinutes: number;
  updatedAt: string;
}

export interface Mission {
  id: string;
  userId: string;
  siteId: string;
  placeId: string;
  vehicleId: string;
  type: MissionType;
  status: UserMissionStatus;
  eta: EtaSnapshot | null;
  createdAt: string;
  completedAt: string | null;
}

export type ConsentCategory = 'location' | 'vehicle_pii' | 'marketing' | 'third_party' | 'analytics';

export interface ConsentRecord {
  id: string;
  userId: string;
  category: ConsentCategory;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  version: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export interface RealtimeEvent {
  eventId: string;
  seq: number;
  envelope: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface QueuedRequest {
  id: string;
  idempotencyKey: string;
  body: Record<string, unknown>;
  expiresAt: string;
  status: 'pending' | 'sent' | 'expired';
}

export interface Reservation {
  id: string;
  siteId: string;
  userId: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

export interface VisitorInvitation {
  id: string;
  hostUserId: string;
  guestName: string;
  guestPlate: string;
  validHours: number;
  status: 'active' | 'used' | 'expired';
  createdAt: string;
}

export type PlaceCapability = 'DIRECT_UNIT' | 'VALET' | 'SCHEDULED';
