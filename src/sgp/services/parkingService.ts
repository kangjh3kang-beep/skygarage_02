import { supabase } from '../../lib/supabase';
import type { SgpParkingPayment } from '../types';

export async function getActiveParking(userId: string): Promise<SgpParkingPayment[]> {
  const { data, error } = await supabase
    .from('sgp_parking_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('entry_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getParkingHistory(userId: string, limit = 30): Promise<SgpParkingPayment[]> {
  const { data, error } = await supabase
    .from('sgp_parking_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getComplexParkingStatus(complexId: string) {
  const { data, error } = await supabase
    .from('parking_zones')
    .select('id, name, total_spots, occupied_spots, zone_type')
    .eq('complex_id', complexId);

  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeParkingUpdates(userId: string, onUpdate: (payment: SgpParkingPayment) => void) {
  const channel = supabase
    .channel(`parking_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sgp_parking_payments', filter: `user_id=eq.${userId}` }, (payload) => onUpdate(payload.new as SgpParkingPayment))
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
