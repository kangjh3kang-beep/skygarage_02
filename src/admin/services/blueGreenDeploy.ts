import { supabase } from '../../lib/supabase';

export type DeploymentSlot = 'blue' | 'green';

export interface PolicyDeployment {
  id: string;
  siteId: string;
  templateId: string;
  slot: DeploymentSlot;
  status: 'preparing' | 'canary' | 'active' | 'rollback' | 'retired';
  trafficPercent: number;
  createdAt: string;
  activatedAt?: string;
  rolledBackAt?: string;
}

export async function getCurrentActiveSlot(siteId: string): Promise<DeploymentSlot> {
  const { data } = await supabase
    .from('domain_events')
    .select('payload')
    .eq('site_id', siteId)
    .eq('action', 'PolicySlotActivated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.payload as { slot?: DeploymentSlot })?.slot ?? 'blue';
}

export async function deployToSlot(
  siteId: string,
  templateId: string,
  targetSlot: DeploymentSlot
): Promise<PolicyDeployment> {
  const now = new Date().toISOString();
  const deploymentId = `deploy-${siteId}-${targetSlot}-${Date.now()}`;

  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'policy',
    action: 'PolicyDeployStarted',
    payload: { deploymentId, templateId, slot: targetSlot, trafficPercent: 0 },
    idempotency_key: deploymentId,
    created_at: now,
  });

  return {
    id: deploymentId,
    siteId,
    templateId,
    slot: targetSlot,
    status: 'preparing',
    trafficPercent: 0,
    createdAt: now,
  };
}

export async function promoteCanary(
  siteId: string,
  deploymentId: string,
  trafficPercent: number
): Promise<void> {
  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'policy',
    action: 'PolicyCanaryPromoted',
    payload: { deploymentId, trafficPercent },
    idempotency_key: `canary-${deploymentId}-${trafficPercent}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });
}

export async function activateSlot(
  siteId: string,
  deploymentId: string,
  slot: DeploymentSlot
): Promise<void> {
  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'policy',
    action: 'PolicySlotActivated',
    payload: { deploymentId, slot },
    idempotency_key: `activate-${deploymentId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });
}

export async function rollbackSlot(
  siteId: string,
  deploymentId: string,
  reason: string
): Promise<void> {
  const activeSlot = await getCurrentActiveSlot(siteId);
  const rollbackTo: DeploymentSlot = activeSlot === 'blue' ? 'green' : 'blue';

  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'AuditEvent',
    subtype: 'policy',
    action: 'PolicySlotRolledBack',
    payload: { deploymentId, reason, rolledBackTo: rollbackTo },
    idempotency_key: `rollback-${deploymentId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });
}

export async function getDeploymentHistory(siteId: string): Promise<PolicyDeployment[]> {
  const { data } = await supabase
    .from('domain_events')
    .select('payload, created_at')
    .eq('site_id', siteId)
    .in('action', ['PolicyDeployStarted', 'PolicySlotActivated', 'PolicySlotRolledBack'])
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map(d => {
    const payload = d.payload as Record<string, unknown>;
    return {
      id: payload.deploymentId as string,
      siteId,
      templateId: (payload.templateId as string) ?? '',
      slot: (payload.slot as DeploymentSlot) ?? 'blue',
      status: 'active' as const,
      trafficPercent: 100,
      createdAt: d.created_at,
    };
  });
}
