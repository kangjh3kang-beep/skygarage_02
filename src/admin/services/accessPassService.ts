import { supabase } from '../../lib/supabase';
import type { AccessPass, AccessPassStatus } from '../../domain';

export async function revokeAccessPass(
  passId: string,
  reason: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: pass, error: fetchErr } = await supabase
    .from('access_passes')
    .select('*')
    .eq('id', passId)
    .maybeSingle();

  if (fetchErr || !pass) {
    return { success: false, error: fetchErr?.message ?? 'Pass not found' };
  }

  if (pass.status === 'revoked') {
    return { success: false, error: 'Already revoked' };
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('access_passes')
    .update({ status: 'revoked', revoked_at: now, revoke_reason: reason })
    .eq('id', passId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Cascade: revoke all dependent passes (e.g., visitor passes linked through the same member)
  await supabase
    .from('access_passes')
    .update({ status: 'revoked', revoked_at: now, revoke_reason: `Cascade: parent pass ${passId} revoked` })
    .eq('member_id', pass.member_id)
    .neq('id', passId)
    .in('status', ['issued', 'active']);

  await supabase.from('domain_events').insert({
    site_id: pass.site_id,
    envelope: 'AuditEvent',
    subtype: 'authz',
    action: 'AccessPassRevoked',
    payload: { passId, memberId: pass.member_id, reason, cascade: true, actorId },
    idempotency_key: `revoke-${passId}-${Date.now()}`,
    created_at: now,
  });

  return { success: true };
}

export async function getAccessPasses(
  siteId: string,
  status?: AccessPassStatus
): Promise<AccessPass[]> {
  let query = supabase
    .from('access_passes')
    .select('*')
    .eq('site_id', siteId)
    .order('issued_at', { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq('status', status);
  }

  const { data } = await query;

  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    memberId: p.member_id as string,
    memberType: p.member_type as AccessPass['memberType'],
    status: p.status as AccessPassStatus,
    siteId: p.site_id as string,
    issuedAt: p.issued_at as string,
    expiresAt: p.expires_at as string | undefined,
    revokedAt: p.revoked_at as string | undefined,
    revokeReason: p.revoke_reason as string | undefined,
  }));
}

export async function issueAccessPass(
  siteId: string,
  memberId: string,
  memberType: AccessPass['memberType'],
  expiresAt?: string
): Promise<{ success: boolean; pass?: AccessPass; error?: string }> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('access_passes')
    .insert({
      site_id: siteId,
      member_id: memberId,
      member_type: memberType,
      status: 'issued',
      issued_at: now,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    pass: {
      id: data.id,
      memberId: data.member_id,
      memberType: data.member_type,
      status: data.status,
      siteId: data.site_id,
      issuedAt: data.issued_at,
      expiresAt: data.expires_at,
    },
  };
}
