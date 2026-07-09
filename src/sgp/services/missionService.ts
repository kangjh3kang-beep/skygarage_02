import { supabase } from '../../lib/supabase';
import type { MissionStatus } from '../../domain/events';

export interface Mission {
  id: string;
  user_id: string;
  complex_id: string;
  type: string;
  status: MissionStatus;
  vehicle_plate: string;
  eta_minutes: number;
  pickup_zone: string | null;
  delivery_zone: string | null;
  created_at: string;
  updated_at: string;
}

export async function requestMission(userId: string, req: {
  complexId: string;
  vehiclePlate: string;
  type: 'valet_pickup' | 'valet_return' | 'ev_charge' | 'maintenance';
  pickupZone?: string;
  deliveryZone?: string;
}): Promise<Mission> {
  const { data, error } = await supabase
    .from('sgp_missions')
    .insert({
      user_id: userId,
      complex_id: req.complexId,
      type: req.type,
      vehicle_plate: req.vehiclePlate,
      status: 'REQUESTED',
      pickup_zone: req.pickupZone || null,
      delivery_zone: req.deliveryZone || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelMission(missionId: string): Promise<void> {
  const { error } = await supabase
    .from('sgp_missions')
    .update({ status: 'CANCELLED' })
    .eq('id', missionId)
    .in('status', ['REQUESTED', 'AUTH_CHECKING', 'SMOOTHING', 'ALLOCATING']);

  if (error) throw new Error(error.message);
}

export async function getUserMissions(userId: string, limit = 20): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('sgp_missions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getActiveMission(userId: string): Promise<Mission | null> {
  const { data, error } = await supabase
    .from('sgp_missions')
    .select('*')
    .eq('user_id', userId)
    .not('status', 'in', '("COMPLETED","CANCELLED","FAILED")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function subscribeMission(missionId: string, onUpdate: (mission: Mission) => void) {
  const channel = supabase
    .channel(`mission_${missionId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sgp_missions', filter: `id=eq.${missionId}` }, (payload) => onUpdate(payload.new as Mission))
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
