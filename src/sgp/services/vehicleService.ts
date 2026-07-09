import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../types';

const TABLE = 'sgp_vehicles';

export async function listVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function addVehicle(userId: string, vehicle: Omit<Vehicle, 'id' | 'userId' | 'isVerified' | 'createdAt'>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      is_default: vehicle.isDefault,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateVehicle(id: string, updates: Partial<Pick<Vehicle, 'plate' | 'brand' | 'model' | 'color' | 'isDefault'>>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.plate !== undefined) payload.plate = updates.plate;
  if (updates.brand !== undefined) payload.brand = updates.brand;
  if (updates.model !== undefined) payload.model = updates.model;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;

  const { error } = await supabase.from(TABLE).update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setDefaultVehicle(userId: string, vehicleId: string): Promise<void> {
  await supabase.from(TABLE).update({ is_default: false }).eq('user_id', userId);
  await supabase.from(TABLE).update({ is_default: true }).eq('id', vehicleId);
}

function mapRow(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    plate: row.plate as string,
    brand: row.brand as string,
    model: row.model as string,
    color: row.color as string,
    isDefault: row.is_default as boolean,
    isVerified: row.is_verified as boolean,
    createdAt: row.created_at as string,
  };
}
