import { supabase } from '../../lib/supabase';
import type { Mission, MissionType } from '../types';

const TABLE = 'sgp_missions';

export async function listMissions(userId: string): Promise<Mission[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function getActiveMission(userId: string): Promise<Mission | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .in('status', ['REQUESTED', 'QUEUED', 'ASSIGNED', 'IN_PROGRESS'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function requestMission(params: {
  userId: string;
  siteId: string;
  placeId: string;
  vehicleId: string;
  type: MissionType;
}): Promise<Mission> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: params.userId,
      site_id: params.siteId,
      place_id: params.placeId,
      vehicle_id: params.vehicleId,
      type: params.type,
      status: 'REQUESTED',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function cancelMission(missionId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'CANCELLED' })
    .eq('id', missionId)
    .in('status', ['REQUESTED', 'QUEUED']);
  if (error) throw new Error(error.message);
}

function mapRow(row: Record<string, unknown>): Mission {
  const eta = row.eta as { estimated_minutes?: number; updated_at?: string } | null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    siteId: row.site_id as string,
    placeId: row.place_id as string,
    vehicleId: row.vehicle_id as string,
    type: row.type as MissionType,
    status: row.status as Mission['status'],
    eta: eta ? { estimatedMinutes: eta.estimated_minutes || 0, updatedAt: eta.updated_at || '' } : null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) || null,
  };
}
