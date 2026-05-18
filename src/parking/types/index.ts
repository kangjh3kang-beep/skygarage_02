export interface Household {
  id: string;
  user_id: string;
  complex_id: string | null;
  unit_number: string;
  building: string;
  floor: number;
  allocated_spots: number;
  direct_entry_enabled: boolean;
  is_sky_garage_unit: boolean;
  free_parking_hours_monthly: number;
  free_parking_hours_used: number;
  created_at: string;
  updated_at: string;
}

export interface UserVehicle {
  id: string;
  household_id: string;
  user_id: string;
  plate_number: string;
  vehicle_type: string;
  is_ev: boolean;
  brand: string;
  model: string;
  color: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitorRegistration {
  id: string;
  household_id: string;
  registered_by: string;
  plate_number: string;
  visitor_name: string;
  visitor_phone: string;
  visit_purpose: string;
  expected_arrival: string | null;
  expected_departure: string | null;
  free_hours_granted: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  entry_type: 'direct_entry' | 'valet' | 'general';
  created_at: string;
  updated_at: string;
}

export interface ParkingSpot {
  id: string;
  complex_id: string | null;
  spot_number: string;
  zone: string;
  floor: number;
  spot_type: 'household_assigned' | 'visitor' | 'ev_charging' | 'valet_staging';
  household_id: string | null;
  is_occupied: boolean;
  current_vehicle_id: string | null;
  has_ev_charger: boolean;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface ActiveParking {
  id: string;
  vehicle_plate: string;
  spot_id: string | null;
  household_id: string | null;
  visitor_registration_id: string | null;
  entry_time: string;
  exit_time: string | null;
  is_visitor: boolean;
  entry_method: 'direct_entry' | 'valet' | 'self_park';
  atr_assignment_id: string | null;
  free_hours_remaining: number;
  overage_minutes: number;
  overage_fee: number;
  status: 'parked' | 'in_transit' | 'exiting';
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface AtrUnit {
  id: string;
  unit_code: string;
  status: 'idle' | 'assigned' | 'in_transit' | 'docking' | 'maintenance';
  current_lat: number;
  current_lng: number;
  battery_level: number;
  created_at: string;
  updated_at: string;
}

export interface AtrDispatchLog {
  id: string;
  atr_unit_id: string;
  parking_session_id: string | null;
  dispatch_type: 'direct_entry' | 'valet_to_spot' | 'retrieval';
  origin_spot: string;
  destination_spot: string;
  dispatched_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'dispatched' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
}

export interface EvChargingSession {
  id: string;
  vehicle_id: string | null;
  parking_session_id: string | null;
  household_id: string;
  charger_spot_id: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  charge_start_pct: number;
  charge_current_pct: number;
  charge_target_pct: number;
  kwh_delivered: number;
  estimated_completion: string | null;
  cost_per_kwh: number;
  total_cost: number;
  status: 'requested' | 'charging' | 'completed' | 'cancelled';
  auto_charge_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingRecord {
  id: string;
  household_id: string;
  user_id: string;
  record_type: 'parking_overage' | 'ev_charging' | 'monthly_fee';
  description: string;
  amount: number;
  currency: string;
  billing_date: string;
  due_date: string;
  paid_at: string | null;
  status: 'pending' | 'paid' | 'overdue';
  parking_session_id: string | null;
  ev_session_id: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  method_type: 'credit_card' | 'bank_transfer' | 'auto_pay';
  card_last_four: string;
  card_brand: string;
  is_default: boolean;
  is_auto_pay: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'parking' | 'ev_charging' | 'billing' | 'visitor' | 'system';
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type UserRole = 'resident' | 'visitor';

export interface DirectEntryDecision {
  allowed: boolean;
  reason: string;
  entry_type: 'direct_entry' | 'valet' | 'general';
  available_spots: number;
}
