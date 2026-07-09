import { supabase } from '../../lib/supabase';
import type { ConsentRecord, ConsentCategory } from '../types';

const TABLE = 'sgp_consents';

export async function listConsents(userId: string): Promise<ConsentRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('category');
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function grantConsent(userId: string, category: ConsentCategory): Promise<void> {
  const existing = await supabase
    .from(TABLE)
    .select('id, version')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();

  if (existing.data) {
    await supabase.from(TABLE).update({
      granted: true,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      version: (existing.data.version as number) + 1,
    }).eq('id', existing.data.id);
  } else {
    await supabase.from(TABLE).insert({
      user_id: userId,
      category,
      granted: true,
      granted_at: new Date().toISOString(),
      version: 1,
    });
  }
}

export async function revokeConsent(userId: string, category: ConsentCategory): Promise<void> {
  await supabase.from(TABLE).update({
    granted: false,
    revoked_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('category', category);
}

function mapRow(row: Record<string, unknown>): ConsentRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    category: row.category as ConsentCategory,
    granted: row.granted as boolean,
    grantedAt: (row.granted_at as string) || null,
    revokedAt: (row.revoked_at as string) || null,
    version: row.version as number,
  };
}
