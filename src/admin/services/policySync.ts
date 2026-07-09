import { supabase } from '../../lib/supabase';

export interface PolicyTemplate {
  id: string;
  name: string;
  version: string;
  category: 'smoothing' | 'safety' | 'scheduling' | 'pricing';
  parameters: Record<string, unknown>;
  publishedAt: string;
  publishedBy: string;
}

export interface PolicyApplication {
  siteId: string;
  templateId: string;
  status: 'applied' | 'rejected' | 'pending';
  appliedAt?: string;
  rejectedReason?: string;
}

export async function publishPolicyTemplate(template: Omit<PolicyTemplate, 'id' | 'publishedAt'>): Promise<PolicyTemplate> {
  const { data, error } = await supabase
    .from('domain_events')
    .insert({
      site_id: 'PLATFORM',
      envelope: 'AuditEvent',
      subtype: 'policy',
      action: 'PolicyPublished',
      payload: template,
      idempotency_key: `policy-publish-${template.name}-${template.version}-${Date.now()}`,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    ...template,
    publishedAt: data.created_at,
  };
}

export async function applyPolicyToSite(
  siteId: string,
  templateId: string,
  elevatorUtilization: number,
  k2Threshold: number
): Promise<PolicyApplication> {
  if (elevatorUtilization > k2Threshold) {
    await supabase.from('domain_events').insert({
      site_id: siteId,
      envelope: 'AuditEvent',
      subtype: 'policy',
      action: 'PolicyRejected',
      payload: {
        templateId,
        reason: `Elevator utilization ${elevatorUtilization}% exceeds K2 threshold ${k2Threshold}%. Capacity lever required first.`,
      },
      idempotency_key: `policy-reject-${siteId}-${templateId}-${Date.now()}`,
      created_at: new Date().toISOString(),
    });

    return { siteId, templateId, status: 'rejected', rejectedReason: 'Safety guard: utilization exceeds K2 threshold' };
  }

  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'policy',
    action: 'PolicyApplied',
    payload: { templateId },
    idempotency_key: `policy-apply-${siteId}-${templateId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });

  return { siteId, templateId, status: 'applied', appliedAt: new Date().toISOString() };
}

export async function pushTelemetry(siteId: string, metrics: Record<string, unknown>): Promise<void> {
  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'ops',
    action: 'TelemetryPushed',
    payload: metrics,
    idempotency_key: `telemetry-${siteId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });
}

export async function getSiteMetrics(siteId: string) {
  const { data } = await supabase
    .from('domain_events')
    .select('payload, created_at')
    .eq('site_id', siteId)
    .eq('action', 'TelemetryPushed')
    .order('created_at', { ascending: false })
    .limit(10);

  return data || [];
}

export async function getPolicyEvents(siteId?: string) {
  let query = supabase
    .from('domain_events')
    .select('*')
    .eq('subtype', 'policy')
    .order('created_at', { ascending: false })
    .limit(50);

  if (siteId) {
    query = query.eq('site_id', siteId);
  }

  const { data } = await query;
  return data || [];
}
