export type ReadinessSnapshot = {
  schema_version: 1;
  observed_at: string;
  counts: Record<'sites' | 'blueprints' | 'memberships' | 'requests' | 'devices' | 'commands' | 'telemetry' | 'domain_events' | 'ai_models' | 'ai_actions' | 'hil_records', number>;
  security: { public_tables_without_rls: number; legacy_browser_grants: number };
};
const fields = ['sites','blueprints','memberships','requests','devices','commands','telemetry','domain_events','ai_models','ai_actions','hil_records'] as const;
/** Reject incomplete/changed responses instead of converting unavailable data to zero. */
export function parseReadinessSnapshot(value: unknown): ReadinessSnapshot {
  const v = value as ReadinessSnapshot | null;
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!v || v.schema_version !== 1 || typeof v.observed_at !== 'string' || !Number.isFinite(Date.parse(v.observed_at)) ||
    !v.counts || !fields.every(k => count(v.counts[k])) || !v.security ||
    !count(v.security.public_tables_without_rls) || !count(v.security.legacy_browser_grants)) throw new Error('invalid_snapshot');
  return v;
}
