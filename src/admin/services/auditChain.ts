import { supabase } from '../lib/supabase';

export async function computeAuditHash(siteId: string, eventData: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${siteId}:${eventData}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function appendAuditEvent(params: {
  siteId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}): Promise<{ id: string; hash: string }> {
  const { data: lastEvent } = await supabase
    .from('audit_hash_chain')
    .select('hash, sequence_num')
    .eq('site_id', params.siteId)
    .order('sequence_num', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash = lastEvent?.hash || '0'.repeat(64);
  const sequenceNum = (lastEvent?.sequence_num || 0) + 1;

  const eventPayload = JSON.stringify({
    ...params,
    sequenceNum,
    previousHash,
    timestamp: new Date().toISOString(),
  });

  const hash = await computeAuditHash(params.siteId, `${previousHash}:${eventPayload}`);

  const { data, error } = await supabase
    .from('audit_hash_chain')
    .insert({
      site_id: params.siteId,
      actor_id: params.actorId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      details: params.details || {},
      previous_hash: previousHash,
      hash,
      sequence_num: sequenceNum,
      created_at: new Date().toISOString(),
    })
    .select('id, hash')
    .single();

  if (error) {
    throw new Error(`Audit chain append failed: ${error.message}`);
  }

  return { id: data.id, hash: data.hash };
}

export async function verifyAuditChain(siteId: string): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalEvents: number;
}> {
  const { data: events } = await supabase
    .from('audit_hash_chain')
    .select('hash, previous_hash, sequence_num')
    .eq('site_id', siteId)
    .order('sequence_num', { ascending: true });

  if (!events || events.length === 0) {
    return { valid: true, totalEvents: 0 };
  }

  for (let i = 1; i < events.length; i++) {
    if (events[i].previous_hash !== events[i - 1].hash) {
      return { valid: false, brokenAt: events[i].sequence_num, totalEvents: events.length };
    }
  }

  return { valid: true, totalEvents: events.length };
}

export async function getAuditTimeline(siteId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('audit_hash_chain')
    .select('*')
    .eq('site_id', siteId)
    .order('sequence_num', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}
