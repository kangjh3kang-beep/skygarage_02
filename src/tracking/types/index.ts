export interface Vehicle {
  id: string;
  driver_name: string;
  plate_number: string;
  status: 'available' | 'in_transit' | 'offline' | 'maintenance';
  current_lat: number;
  current_lng: number;
  speed: number;
  heading: number;
  phone: string;
  rating: number;
  vehicle_model: string;
  last_updated: string;
  complex_id: string | null;
  created_at: string;
}

export interface Route {
  id: string;
  vehicle_id: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  dest_lat: number;
  dest_lng: number;
  distance_km: number;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string | null;
  vehicle_id: string | null;
  route_id: string | null;
  pickup_name: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_name: string;
  dropoff_lat: number;
  dropoff_lng: number;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface LocationHistory {
  id: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  recorded_at: string;
}

export interface TrackingNotification {
  id: string;
  user_id: string | null;
  booking_id: string | null;
  type: 'eta_change' | 'vehicle_nearby' | 'status_change' | 'delay';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ETAInfo {
  estimatedArrival: Date | null;
  remainingMinutes: number;
  remainingSeconds: number;
  distanceKm: number;
  progressPercent: number;
  isDelayed: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// ===== 발레파킹 5단계 추적 시스템 타입 =====

export type VehicleStage = 'entry' | 'stored' | 'atr_pickup' | 'in_transit' | 'exit';

export interface ValetVehicle {
  id: string;
  owner_id: string | null;
  complex_id: string | null;
  plate_number: string;
  vehicle_model: string;
  vehicle_color: string;
  current_stage: VehicleStage;
  assigned_atr_id: string | null;
  current_x: number;
  current_y: number;
  current_floor: number;
  storage_zone: string | null;
  storage_slot: string | null;
  entry_time: string | null;
  exit_time: string | null;
  last_updated: string;
  created_at: string;
}

export type AtrStatus = 'idle' | 'assigned' | 'transporting' | 'charging' | 'maintenance';

export interface AtrUnit {
  id: string;
  complex_id: string | null;
  unit_code: string;
  display_name: string;
  status: AtrStatus;
  current_x: number;
  current_y: number;
  current_floor: number;
  battery_level: number;
  speed: number;
  heading: number;
  last_updated: string;
  created_at: string;
}

export interface TrackingEvent {
  id: string;
  vehicle_id: string;
  from_stage: VehicleStage | null;
  to_stage: VehicleStage;
  atr_id: string | null;
  operator_id: string | null;
  notes: string | null;
  created_at: string;
}

export const STAGE_CONFIG: Record<VehicleStage, { label: string; color: 'info' | 'success' | 'warning' | 'error' | 'default'; step: number }> = {
  entry: { label: '입차', color: 'info', step: 0 },
  stored: { label: '보관 중', color: 'success', step: 1 },
  atr_pickup: { label: 'ATR 픽업', color: 'warning', step: 2 },
  in_transit: { label: '운송 중', color: 'error', step: 3 },
  exit: { label: '출차', color: 'default', step: 4 },
};

export const STAGE_LABELS: VehicleStage[] = ['entry', 'stored', 'atr_pickup', 'in_transit', 'exit'];
