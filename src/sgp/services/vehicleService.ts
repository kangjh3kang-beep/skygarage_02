import { supabase } from '../../lib/supabase';

export interface Vehicle {
  id: string;
  user_id: string;
  plate_number: string;
  brand: string;
  model: string;
  color: string;
  ev_type: 'bev' | 'phev' | 'ice' | null;
  nfc_tag_id: string | null;
  is_primary: boolean;
  created_at: string;
}

export async function getUserVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('sgp_vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function registerVehicle(userId: string, vehicle: {
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  evType?: 'bev' | 'phev' | 'ice';
  isPrimary?: boolean;
}): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('sgp_vehicles')
    .insert({
      user_id: userId,
      plate_number: vehicle.plateNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      ev_type: vehicle.evType || null,
      is_primary: vehicle.isPrimary ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from('sgp_vehicles').delete().eq('id', vehicleId);
  if (error) throw new Error(error.message);
}

export async function getVehicleLocation(vehicleId: string) {
  const { data, error } = await supabase
    .from('sgp_vehicle_locations')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
