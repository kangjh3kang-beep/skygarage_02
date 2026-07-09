import { supabase } from '../../lib/supabase';
import type { Place, PlaceCapability, PlaceType } from '../types';

export async function getPlaces(userId: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from('sgp_places')
    .select('*, site:complexes(id, name, address)')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error || !data) return [];

  return data.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    userId: p.user_id as string,
    siteId: p.site_id as string,
    type: p.type as PlaceType,
    grant: p.grant_status as Place['grant'],
    label: p.label as string,
    order: p.order_index as number,
    group: p.type as PlaceType,
    isDefault: p.is_default as boolean,
    capabilities: (p.capabilities as PlaceCapability[]) ?? [],
    siteName: (p.site as Record<string, string>)?.name ?? '',
    siteAddress: (p.site as Record<string, string>)?.address ?? '',
  }));
}

export async function addPlace(
  userId: string,
  siteId: string,
  type: PlaceType,
  label: string
): Promise<{ success: boolean; place?: Place; error?: string }> {
  const { data: existing } = await supabase
    .from('sgp_places')
    .select('id')
    .eq('user_id', userId)
    .eq('site_id', siteId);

  if (existing && existing.length > 0) {
    return { success: false, error: '이미 등록된 장소입니다.' };
  }

  const { data: countData } = await supabase
    .from('sgp_places')
    .select('id')
    .eq('user_id', userId);

  const order = (countData?.length ?? 0) + 1;
  const isDefault = order === 1;

  const { data, error } = await supabase
    .from('sgp_places')
    .insert({
      user_id: userId,
      site_id: siteId,
      type,
      label,
      grant_status: type === 'PARTNER' ? 'active' : 'pending',
      is_default: isDefault,
      order_index: order,
      capabilities: type === 'HOME_UNIT' ? ['DIRECT_UNIT', 'AUTO_VALET'] : ['RESERVATION'],
    })
    .select('*, site:complexes(id, name, address)')
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    place: {
      id: data.id,
      userId: data.user_id,
      siteId: data.site_id,
      type: data.type,
      grant: data.grant_status,
      label: data.label,
      order: data.order_index,
      group: data.type,
      isDefault: data.is_default,
      capabilities: data.capabilities ?? [],
      siteName: data.site?.name ?? '',
      siteAddress: data.site?.address ?? '',
    },
  };
}

export async function verifyOfficeCode(
  userId: string,
  code: string
): Promise<{ success: boolean; siteId?: string; siteName?: string; error?: string }> {
  const { data, error } = await supabase
    .from('office_invite_codes')
    .select('site_id, site_name, expires_at')
    .eq('code', code)
    .eq('is_used', false)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: '유효하지 않거나 만료된 초대 코드입니다.' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { success: false, error: '초대 코드가 만료되었습니다.' };
  }

  await supabase
    .from('office_invite_codes')
    .update({ is_used: true, used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code);

  return { success: true, siteId: data.site_id, siteName: data.site_name };
}

export async function removePlace(placeId: string): Promise<boolean> {
  const { error } = await supabase.from('sgp_places').delete().eq('id', placeId);
  return !error;
}

export async function reorderPlaces(userId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('sgp_places')
      .update({ order_index: i + 1 })
      .eq('id', orderedIds[i])
      .eq('user_id', userId);
  }
}

export async function setDefaultPlace(userId: string, placeId: string): Promise<void> {
  await supabase
    .from('sgp_places')
    .update({ is_default: false })
    .eq('user_id', userId);

  await supabase
    .from('sgp_places')
    .update({ is_default: true })
    .eq('id', placeId);
}

export async function searchSites(query: string): Promise<Array<{ id: string; name: string; address: string; available: number }>> {
  const { data } = await supabase
    .from('complexes')
    .select('id, name, address')
    .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
    .limit(20);

  return (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    address: s.address ?? '',
    available: Math.floor(Math.random() * 50),
  }));
}
