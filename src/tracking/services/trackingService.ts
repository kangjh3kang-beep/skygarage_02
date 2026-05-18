import { supabase } from '../../lib/supabase';
import type { Vehicle, Route, Booking, LocationHistory, TrackingNotification } from '../types';

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

export const vehicleService = {
  async getAll(): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('tracking_vehicles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Vehicle | null> {
    const { data, error } = await supabase
      .from('tracking_vehicles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateLocation(id: string, lat: number, lng: number, speed: number, heading: number) {
    const { error } = await supabase
      .from('tracking_vehicles')
      .update({ current_lat: lat, current_lng: lng, speed, heading, last_updated: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async updateStatus(id: string, status: Vehicle['status']) {
    const { error } = await supabase
      .from('tracking_vehicles')
      .update({ status, last_updated: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async update(id: string, fields: Partial<Vehicle>) {
    const { error } = await supabase
      .from('tracking_vehicles')
      .update({ ...fields, last_updated: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async create(vehicle: Partial<Vehicle>) {
    if (!vehicle.driver_name?.trim()) throw new Error('운전기사명은 필수입니다.');
    if (!vehicle.plate_number?.trim()) throw new Error('차량번호는 필수입니다.');
    const payload = {
      driver_name: vehicle.driver_name.trim(),
      plate_number: vehicle.plate_number.trim(),
      phone: vehicle.phone || '',
      vehicle_model: vehicle.vehicle_model || '',
      status: vehicle.status || 'available',
      current_lat: vehicle.current_lat ?? SEOUL_CENTER.lat,
      current_lng: vehicle.current_lng ?? SEOUL_CENTER.lng,
      speed: 0,
      heading: 0,
    };
    const { data, error } = await supabase
      .from('tracking_vehicles')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('tracking_vehicles').delete().eq('id', id);
    if (error) throw error;
  },
};

export const routeService = {
  async getByVehicle(vehicleId: string): Promise<Route[]> {
    const { data, error } = await supabase
      .from('tracking_routes')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getActive(): Promise<Route[]> {
    const { data, error } = await supabase
      .from('tracking_routes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(route: Partial<Route>): Promise<Route | null> {
    const { data, error } = await supabase
      .from('tracking_routes')
      .insert(route)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: Route['status']) {
    const update: Partial<Route> = { status };
    if (status === 'completed') update.actual_arrival = new Date().toISOString();
    const { error } = await supabase.from('tracking_routes').update(update).eq('id', id);
    if (error) throw error;
  },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const bookingService = {
  async getAll(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('tracking_bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByUser(userId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('tracking_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(booking: Partial<Booking>): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('tracking_bookings')
      .insert(booking)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, newStatus: Booking['status']) {
    const { data: current } = await supabase
      .from('tracking_bookings')
      .select('status, vehicle_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_name, dropoff_name')
      .eq('id', id)
      .maybeSingle();

    if (current) {
      const allowed = VALID_TRANSITIONS[current.status] || [];
      if (!allowed.includes(newStatus)) {
        throw new Error(`상태 전환 불가: ${current.status} → ${newStatus}`);
      }
    }

    const update: Partial<Booking> = { status: newStatus };
    if (newStatus === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tracking_bookings').update(update).eq('id', id);
    if (error) throw error;

    if (newStatus === 'in_progress' && current?.vehicle_id) {
      const route = await routeService.create({
        vehicle_id: current.vehicle_id,
        origin_lat: current.pickup_lat,
        origin_lng: current.pickup_lng,
        dest_lat: current.dropoff_lat,
        dest_lng: current.dropoff_lng,
        origin_name: current.pickup_name,
        destination_name: current.dropoff_name,
        status: 'active',
        estimated_arrival: new Date(Date.now() + 15 * 60000).toISOString(),
      });
      if (route) {
        await supabase.from('tracking_bookings').update({ route_id: route.id }).eq('id', id);
      }
      await vehicleService.updateStatus(current.vehicle_id, 'in_transit');
    }

    if (newStatus === 'completed' && current?.vehicle_id) {
      await vehicleService.updateStatus(current.vehicle_id, 'available');
    }
  },
};

export const locationService = {
  async getHistory(vehicleId: string, limit = 100): Promise<LocationHistory[]> {
    const { data, error } = await supabase
      .from('tracking_location_history')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async record(vehicleId: string, lat: number, lng: number, speed: number, heading: number) {
    const { error } = await supabase
      .from('tracking_location_history')
      .insert({ vehicle_id: vehicleId, lat, lng, speed, heading });
    if (error) throw error;
    await supabase
      .from('tracking_vehicles')
      .update({ last_updated: new Date().toISOString() })
      .eq('id', vehicleId);
  },
};

export const notificationService = {
  async getByUser(userId: string): Promise<TrackingNotification[]> {
    const { data, error } = await supabase
      .from('tracking_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async getAll(): Promise<TrackingNotification[]> {
    const { data, error } = await supabase
      .from('tracking_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async markAsRead(id: string) {
    const { error } = await supabase
      .from('tracking_notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllAsRead() {
    const { error } = await supabase
      .from('tracking_notifications')
      .update({ read: true })
      .eq('read', false);
    if (error) throw error;
  },

  async create(notification: { type: string; title: string; message: string; booking_id?: string }) {
    const { data, error } = await supabase
      .from('tracking_notifications')
      .insert({ ...notification, read: false })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
