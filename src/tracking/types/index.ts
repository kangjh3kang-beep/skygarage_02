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
