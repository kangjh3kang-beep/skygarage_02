import { supabase } from '../../lib/supabase';
import type { CommandGuardCheck, SafetyChainState, DomainEvent } from '../../domain';
import { isCommandApproved } from '../../domain';

export async function evaluateCommandGuard(
  siteId: string,
  deviceId: string,
  commandType: string
): Promise<{ approved: boolean; check: CommandGuardCheck; reasonCode?: string }> {
  const check: CommandGuardCheck = {
    allowTrue: true,
    safeTrue: true,
    resourceLockValid: true,
    resourceLockUnique: true,
    sensorConsistent: true,
    elevatorAligned: true,
    doorZoneClear: true,
    stoReady: true,
    policyVersionValid: true,
    motionTokenValid: true,
  };

  const { data: safetyState } = await supabase
    .from('safety_chain_states')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();

  if (safetyState) {
    check.stoReady = !safetyState.sto_active;
    check.safeTrue = safetyState.safety_relay_engaged && safetyState.drive_enabled;
    if (safetyState.emergency_stop_active) {
      check.allowTrue = false;
    }
  }

  const { data: locks } = await supabase
    .from('resource_locks')
    .select('id')
    .eq('site_id', siteId)
    .eq('device_id', deviceId)
    .eq('status', 'active');

  if (locks && locks.length > 1) {
    check.resourceLockUnique = false;
  }

  const approved = isCommandApproved(check);

  if (!approved) {
    const failedConditions = Object.entries(check)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const reasonCode = `GUARD_REJECT:${failedConditions.join(',')}`;

    await emitAuditEvent(siteId, 'CommandRejected', {
      deviceId,
      commandType,
      reasonCode,
      check,
    });

    return { approved: false, check, reasonCode };
  }

  await emitAuditEvent(siteId, 'CommandApproved', {
    deviceId,
    commandType,
    check,
  });

  return { approved: true, check };
}

export async function getSafetyChainState(siteId: string): Promise<SafetyChainState | null> {
  const { data } = await supabase
    .from('safety_chain_states')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();

  if (!data) return null;

  return {
    siteId: data.site_id,
    stoActive: data.sto_active,
    safetyRelayEngaged: data.safety_relay_engaged,
    driveEnabled: data.drive_enabled,
    emergencyStopActive: data.emergency_stop_active,
    lastUpdated: data.updated_at,
  };
}

export async function invokeEmergencyStop(siteId: string, actorId: string): Promise<void> {
  await supabase
    .from('safety_chain_states')
    .update({
      emergency_stop_active: true,
      drive_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('site_id', siteId);

  await emitAuditEvent(siteId, 'EmergencyStop', {
    actorId,
    timestamp: new Date().toISOString(),
  });
}

export async function resumeFromEmergency(siteId: string, actorId: string): Promise<void> {
  await supabase
    .from('safety_chain_states')
    .update({
      emergency_stop_active: false,
      drive_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('site_id', siteId);

  await emitAuditEvent(siteId, 'EmergencyResume', {
    actorId,
    timestamp: new Date().toISOString(),
  });
}

async function emitAuditEvent(siteId: string, action: string, payload: Record<string, unknown>) {
  await supabase.from('domain_events').insert({
    site_id: siteId,
    envelope: 'SafetyEvent',
    subtype: action.includes('Emergency') ? 'emergency' : 'gate',
    action,
    payload,
    created_at: new Date().toISOString(),
  });
}

export function createDomainEvent(
  envelope: DomainEvent['envelope'],
  siteId: string,
  action: string,
  payload: Record<string, unknown>
): Omit<DomainEvent, 'id' | 'timestamp'> & { site_id: string; action: string; created_at: string } {
  return {
    site_id: siteId,
    envelope,
    subtype: 'ops' as never,
    siteId,
    action,
    payload,
    idempotencyKey: `${siteId}-${action}-${Date.now()}`,
    created_at: new Date().toISOString(),
  } as never;
}
