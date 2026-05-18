import { supabase } from '../../lib/supabase';
import type { Vehicle, Route, Booking, LocationHistory, TrackingNotification } from '../types';

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

  async create(vehicle: Partial<Vehicle>) {
    const { data, error } = await supabase
      .from('tracking_vehicles')
      .insert(vehicle)
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

  async updateStatus(id: string, status: Route['status']) {
    const update: Partial<Route> = { status };
    if (status === 'completed') update.actual_arrival = new Date().toISOString();
    const { error } = await supabase.from('tracking_routes').update(update).eq('id', id);
    if (error) throw error;
  },
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

  async create(booking: Partial<Booking>) {
    const { data, error } = await supabase
      .from('tracking_bookings')
      .insert(booking)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: Booking['status']) {
    const update: Partial<Booking> = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tracking_bookings').update(update).eq('id', id);
    if (error) throw error;
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

  async create(notification: Partial<TrackingNotification>) {
    const { error } = await supabase
      .from('tracking_notifications')
      .insert(notification);
    if (error) throw error;
  },
};
