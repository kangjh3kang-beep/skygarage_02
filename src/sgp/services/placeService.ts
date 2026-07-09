import { supabase } from '../../lib/supabase';
import type { Place, PlaceType } from '../types';

const TABLE = 'sgp_places';

export async function listPlaces(userId: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function addPlace(userId: string, place: {
  siteId: string;
  siteName: string;
  label: string;
  type: PlaceType;
  isDefault: boolean;
}): Promise<Place> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      site_id: place.siteId,
      site_name: place.siteName,
      label: place.label,
      type: place.type,
      is_default: place.isDefault,
      grant_status: 'PENDING',
      sort_order: 99,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function removePlace(placeId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', placeId);
  if (error) throw new Error(error.message);
}

export async function setDefaultPlace(userId: string, placeId: string): Promise<void> {
  await supabase.from(TABLE).update({ is_default: false }).eq('user_id', userId);
  await supabase.from(TABLE).update({ is_default: true }).eq('id', placeId);
}

function mapRow(row: Record<string, unknown>): Place {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    siteId: row.site_id as string,
    siteName: row.site_name as string,
    label: row.label as string,
    type: row.type as PlaceType,
    grantStatus: row.grant_status as Place['grantStatus'],
    isDefault: row.is_default as boolean,
    sortOrder: row.sort_order as number,
    etaMinutes: row.eta_minutes as number | undefined,
    createdAt: row.created_at as string,
  };
}
