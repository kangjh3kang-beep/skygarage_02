/** Deterministic commissioning model only. No networking, persistence or actuator access.
 * These checks document the future server/edge contract; browser input is never authority.
 */
export type Scope = { tenantId: string; siteId: string; deviceId: string };
export type ContractInput = {
  expected: Scope;
  command: Scope & { id: string; digest: string; issuedAt: number; expiresAt: number; fence: number };
  now: number;
  lease: { fence: number; expiresAt: number };
  heartbeatAt: number;
  safety: 'clear' | 'blocked' | 'unknown';
  commissioned: boolean;
  previous?: { digest: string; state: string };
};
export type PreflightReason = 'invalid_contract' | 'scope_mismatch' | 'not_commissioned' |
  'expired_command' | 'future_command' | 'lease_invalid' | 'heartbeat_stale' |
  'safety_unavailable' | 'idempotency_conflict' | 'duplicate_command' | 'contract_checks_passed';
export function evaluateContract(input: ContractInput): { reason: PreflightReason; testEligible: boolean; dispatchEnabled: false } {
  const result = (reason: PreflightReason) => ({ reason, testEligible: reason === 'contract_checks_passed', dispatchEnabled: false as const });
  if (!input || !input.expected || !input.command || !input.lease) return result('invalid_contract');
  const { expected, command, now, lease } = input;
  if (![expected.tenantId, expected.siteId, expected.deviceId, command.tenantId, command.siteId, command.deviceId, command.id, command.digest]
    .every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 200) ||
    ![now, command.issuedAt, command.expiresAt, lease.expiresAt, input.heartbeatAt].every(Number.isFinite) ||
    !Number.isSafeInteger(command.fence) || !Number.isSafeInteger(lease.fence) || command.fence < 1 || lease.fence < 1 ||
    command.expiresAt <= command.issuedAt || command.expiresAt - command.issuedAt > 30_000 ||
    typeof input.commissioned !== 'boolean' || !['clear','blocked','unknown'].includes(input.safety)) return result('invalid_contract');
  if (expected.tenantId !== command.tenantId || expected.siteId !== command.siteId || expected.deviceId !== command.deviceId) return result('scope_mismatch');
  if (input.previous) return result(input.previous.digest === command.digest ? 'duplicate_command' : 'idempotency_conflict');
  if (!input.commissioned) return result('not_commissioned');
  if (command.expiresAt <= now) return result('expired_command');
  if (command.issuedAt > now) return result('future_command');
  if (lease.expiresAt <= now || command.fence !== lease.fence) return result('lease_invalid');
  // Prototype liveness threshold, not a certified safety-control timing budget.
  if (input.heartbeatAt > now || now - input.heartbeatAt > 5_000) return result('heartbeat_stale');
  if (input.safety !== 'clear') return result('safety_unavailable');
  return result('contract_checks_passed');
}

export type MissionState = 'requested' | 'validated' | 'reserved' | 'dispatched' | 'acknowledged' | 'running' | 'completed' | 'cancelled' | 'failed' | 'unknown';
export type MissionEventKind = 'validate' | 'reserve' | 'dispatch' | 'ack' | 'start' | 'complete' | 'cancel' | 'fail' | 'timeout' | 'reconcile_complete' | 'reconcile_failed';
export type MissionModel = { scope: Scope; missionId: string; state: MissionState; version: number; seen: Record<string, string> };
export type MissionEvent = { scope: Scope; missionId: string; id: string; expectedVersion: number; kind: MissionEventKind };
const transitions: Partial<Record<MissionState, Partial<Record<MissionEventKind, MissionState>>>> = {
  requested: { validate: 'validated', cancel: 'cancelled', fail: 'failed' },
  validated: { reserve: 'reserved', cancel: 'cancelled', fail: 'failed' },
  reserved: { dispatch: 'dispatched', cancel: 'cancelled', fail: 'failed' },
  dispatched: { ack: 'acknowledged', timeout: 'unknown' },
  acknowledged: { start: 'running', timeout: 'unknown' },
  running: { complete: 'completed', timeout: 'unknown' },
  unknown: { reconcile_complete: 'completed', reconcile_failed: 'failed' },
};
/** In production, event fingerprints + compare-and-swap + inbox MUST be one DB transaction.
 * Reconciliation events must originate from authenticated device/operator evidence.
 */
export function advanceMission(model: MissionModel, event: MissionEvent): MissionModel {
  if (!model || !event || !model.scope || !event.scope || !event.id?.trim() || !event.missionId?.trim() ||
    !Number.isSafeInteger(model.version) || model.version < 0 || !Number.isSafeInteger(event.expectedVersion) || event.expectedVersion < 0 ||
    !['tenantId','siteId','deviceId'].every(k => typeof model.scope[k as keyof Scope] === 'string' && !!model.scope[k as keyof Scope].trim() && typeof event.scope[k as keyof Scope] === 'string' && !!event.scope[k as keyof Scope].trim())) throw new Error('invalid_event');
  if (model.missionId !== event.missionId || model.scope.tenantId !== event.scope.tenantId || model.scope.siteId !== event.scope.siteId || model.scope.deviceId !== event.scope.deviceId) throw new Error('scope_mismatch');
  const fingerprint = JSON.stringify([event.missionId,event.scope.tenantId,event.scope.siteId,event.scope.deviceId,event.expectedVersion,event.kind]);
  if (Object.hasOwn(model.seen, event.id)) {
    if (model.seen[event.id] !== fingerprint) throw new Error('event_id_conflict');
    return model;
  }
  if (event.expectedVersion !== model.version) throw new Error('version_conflict');
  const allowed = Object.hasOwn(transitions, model.state) ? transitions[model.state] : undefined;
  const next = allowed && Object.hasOwn(allowed, event.kind) ? allowed[event.kind] : undefined;
  if (!next) throw new Error('invalid_transition');
  return { ...model, state: next, version: model.version + 1, seen: { ...model.seen, [event.id]: fingerprint } };
}

export const contractReasonLabels: Record<PreflightReason, string> = {
  invalid_contract: '필수 값·유효기간 형식 오류', scope_mismatch: '조직·현장·장비 범위 불일치',
  not_commissioned: '현장 운행 검수 미완료', expired_command: '명령 유효기간 만료', future_command: '발행 시각 불일치',
  lease_invalid: '자원 점유 만료 또는 이전 제어권', heartbeat_stale: '장비 연결 상태 확인 불가',
  safety_unavailable: '안전 상태 미확인 또는 차단', idempotency_conflict: '같은 요청 번호의 내용 충돌',
  duplicate_command: '중복 요청 · 재전송하지 않음', contract_checks_passed: '모형의 사전조건 충족 · 실제 명령 전송 없음',
};
export const labScenarios = [
  { id:'normal', label:'정상 사전조건', change:{} },
  { id:'unapproved', label:'미승인 현장', change:{commissioned:false} },
  { id:'scope', label:'다른 현장 명령', change:{siteMismatch:true} },
  { id:'offline', label:'장비 통신 단절', change:{heartbeatAt:90_000} },
  { id:'unsafe', label:'안전 신호 미확인', change:{safety:'unknown'} },
  { id:'expired', label:'만료된 명령', change:{expiresAt:99_999} },
  { id:'fence', label:'이전 제어권 재사용', change:{fence:6} },
  { id:'duplicate', label:'동일 명령 재수신', change:{previous:{digest:'sample-digest',state:'unknown'}} },
  { id:'conflict', label:'중복 번호의 내용 변경', change:{previous:{digest:'different-digest',state:'running'}} },
] as const;
export function runContractScenario(id: string) {
  const scenario = labScenarios.find(s => s.id === id);
  if (!scenario) throw new Error('unknown_scenario');
  const scope = { tenantId:'lab-tenant',siteId:'lab-site',deviceId:'lab-device' };
  const change = scenario.change as Partial<ContractInput> & { siteMismatch?:boolean; expiresAt?:number; fence?:number };
  return evaluateContract({
    expected:scope, now:100_000, commissioned:true, safety:'clear', heartbeatAt:99_000,
    lease:{fence:7,expiresAt:110_000}, ...change,
    command:{...scope,id:'lab-command',digest:'sample-digest',issuedAt:90_000,expiresAt:change.expiresAt ?? 110_000,fence:change.fence ?? 7,siteId:change.siteMismatch?'other-site':scope.siteId},
  });
}
