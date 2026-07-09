import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../types';

export async function getVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('sgp_vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  if (error || !data) return [];

  return data.map((v: Record<string, unknown>) => ({
    id: v.id as string,
    userId: v.user_id as string,
    plate: v.plate as string,
    brand: v.brand as string,
    model: v.model as string,
    color: v.color as string,
    isDefault: v.is_default as boolean,
    isVerified: v.is_verified as boolean,
    createdAt: v.created_at as string,
  }));
}

export async function addVehicle(
  userId: string,
  plate: string,
  brand: string,
  model: string,
  color: string
): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
  const { data: existing } = await supabase
    .from('sgp_vehicles')
    .select('id')
    .eq('user_id', userId)
    .eq('plate', plate);

  if (existing && existing.length > 0) {
    return { success: false, error: '이미 등록된 차량입니다.' };
  }

  const { data: countData } = await supabase
    .from('sgp_vehicles')
    .select('id')
    .eq('user_id', userId);

  const isDefault = (countData?.length ?? 0) === 0;

  const { data, error } = await supabase
    .from('sgp_vehicles')
    .insert({
      user_id: userId,
      plate,
      brand,
      model,
      color,
      is_default: isDefault,
      is_verified: false,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    vehicle: {
      id: data.id,
      userId: data.user_id,
      plate: data.plate,
      brand: data.brand,
      model: data.model,
      color: data.color,
      isDefault: data.is_default,
      isVerified: data.is_verified,
      createdAt: data.created_at,
    },
  };
}

export async function removeVehicle(vehicleId: string): Promise<boolean> {
  const { error } = await supabase.from('sgp_vehicles').delete().eq('id', vehicleId);
  return !error;
}

export async function setDefaultVehicle(userId: string, vehicleId: string): Promise<void> {
  await supabase
    .from('sgp_vehicles')
    .update({ is_default: false })
    .eq('user_id', userId);

  await supabase
    .from('sgp_vehicles')
    .update({ is_default: true })
    .eq('id', vehicleId);
}
