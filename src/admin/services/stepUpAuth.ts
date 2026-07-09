import { supabase } from '../../lib/supabase';

export type StepUpReason = 'emergency_release' | 'rbac_change' | 'settlement_payment' | 'policy_publish' | 'data_export';

const STEP_UP_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StepUpSession {
  verifiedAt: number;
  reason: StepUpReason;
}

const activeStepUps = new Map<string, StepUpSession>();

export function isStepUpValid(userId: string, reason: StepUpReason): boolean {
  const session = activeStepUps.get(`${userId}:${reason}`);
  if (!session) return false;
  return Date.now() - session.verifiedAt < STEP_UP_TTL_MS;
}

export async function performStepUp(
  email: string,
  password: string,
  reason: StepUpReason
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Authentication failed' };
  }

  activeStepUps.set(`${data.user.id}:${reason}`, {
    verifiedAt: Date.now(),
    reason,
  });

  await supabase.from('domain_events').insert({
    site_id: 'PLATFORM',
    envelope: 'AuditEvent',
    subtype: 'authz',
    action: 'StepUpVerified',
    payload: { userId: data.user.id, reason, timestamp: new Date().toISOString() },
    idempotency_key: `stepup-${data.user.id}-${reason}-${Date.now()}`,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

export function clearStepUp(userId: string, reason: StepUpReason): void {
  activeStepUps.delete(`${userId}:${reason}`);
}

export function requiresStepUp(routePath: string): StepUpReason | null {
  const stepUpRoutes: Record<string, StepUpReason> = {
    '/admin/safety/emergency': 'emergency_release',
    '/admin/users/roles': 'rbac_change',
    '/admin/settlement/payment': 'settlement_payment',
    '/admin/policy/publish': 'policy_publish',
    '/admin/data/export': 'data_export',
  };

  for (const [path, reason] of Object.entries(stepUpRoutes)) {
    if (routePath.startsWith(path)) return reason;
  }
  return null;
}
