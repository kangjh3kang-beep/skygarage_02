/** Server-side provider contract. No provider is selected or registered in this release. */
export type ProviderEnvironment = 'sandbox' | 'live';
export type ProviderOperation = 'confirm_payment' | 'refund_payment' | 'create_payout' | 'lookup_payout';
export type ProviderState = 'pending' | 'unknown' | 'succeeded' | 'failed';
export type ProviderCommand = {
  schemaVersion: 1; environment: ProviderEnvironment; operation: ProviderOperation;
  requestId: string; referenceId: string; amount: string; currency: 'KRW';
  providerReference?: string; beneficiaryReference?: string;
};
export type ProviderObservation = {
  schemaVersion: 1; environment: ProviderEnvironment; operation: ProviderOperation;
  requestId: string; referenceId: string; amount: string; currency: 'KRW'; state: ProviderState;
  providerReference: string; eventId: string; receiptId?: string;
};
export interface ProviderAdapter {
  readonly code: string;
  readonly apiVersion: string;
  readonly capabilities: readonly ProviderOperation[];
  readonly environment: ProviderEnvironment;
  execute(command: Readonly<ProviderCommand>): Promise<ProviderObservation>;
  /** Must verify the original bytes with the provider's official signature protocol. */
  verifyWebhook(body: Uint8Array, headers: Readonly<Record<string, string>>): Promise<ProviderObservation>;
}
export class ProviderContractError extends Error {
  constructor(code: string) { super(code); this.name = 'ProviderContractError'; }
}
const reject = (code: string): never => { throw new ProviderContractError(code); };
const identifier = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(x);
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const operations: ProviderOperation[] = ['confirm_payment', 'refund_payment', 'create_payout', 'lookup_payout'];
function validateBase(command: Pick<ProviderCommand, 'schemaVersion'|'environment'|'operation'|'requestId'|'referenceId'|'amount'|'currency'>): void {
  if (command.schemaVersion !== 1 || !operations.includes(command.operation) || !uuid(command.requestId) || !uuid(command.referenceId)) reject('provider_invalid_command');
  if (command.environment !== 'sandbox') reject('provider_live_not_enabled');
  if (command.currency !== 'KRW' || typeof command.amount !== 'string' || !/^[1-9][0-9]{0,12}$/.test(command.amount) || BigInt(command.amount) > 1000000000000n) reject('provider_invalid_money');
}
export function validateCommand(command: ProviderCommand): void {
  validateBase(command);
  if (command.providerReference !== undefined && !identifier(command.providerReference)) reject('provider_invalid_reference');
  if (command.beneficiaryReference !== undefined && !identifier(command.beneficiaryReference)) reject('provider_invalid_beneficiary');
  if (['refund_payment', 'lookup_payout'].includes(command.operation) && !identifier(command.providerReference)) reject('provider_reference_required');
  if (command.operation === 'create_payout' && !identifier(command.beneficiaryReference)) reject('provider_beneficiary_required');
}
function validateObservation(observation: ProviderObservation): void {
  validateBase(observation);
  if (!['pending', 'unknown', 'succeeded', 'failed'].includes(observation.state) || !identifier(observation.eventId) || !identifier(observation.providerReference)) reject('provider_invalid_observation');
  if (observation.state === 'succeeded' && !identifier(observation.receiptId)) reject('provider_receipt_required');
}
export function assertMatchingObservation(command: ProviderCommand, observation: ProviderObservation): void {
  validateCommand(command); validateObservation(observation);
  for (const key of ['environment', 'operation', 'requestId', 'referenceId', 'amount', 'currency'] as const) {
    if (command[key] !== observation[key]) reject('provider_observation_mismatch');
  }
  if (command.providerReference && command.providerReference !== observation.providerReference) reject('provider_observation_mismatch');
}
export function providerEventKey(code: string, event: ProviderObservation): string {
  if (!/^[a-z0-9_-]{2,40}$/.test(code)) reject('provider_invalid_code');
  validateObservation(event);
  return `${code}:${event.environment}:${event.eventId}`;
}
/** Re-observation never converts unknown into paid and never rewrites a terminal result. */
export function reconcileProviderState(current: ProviderState, next: ProviderState): ProviderState {
  if (!['pending','unknown','succeeded','failed'].includes(current) || !['pending','unknown','succeeded','failed'].includes(next)) return reject('provider_invalid_state');
  if (current === 'succeeded' || current === 'failed') {
    if (next === current || next === 'pending' || next === 'unknown') return current;
    return reject('provider_terminal_conflict');
  }
  return next;
}
export function createProviderRegistry(adapters: readonly ProviderAdapter[] = []) {
  const registry = new Map<string, ProviderAdapter>();
  for (const adapter of adapters) {
    if (!/^[a-z0-9_-]{2,40}$/.test(adapter.code) || !identifier(adapter.apiVersion) || registry.has(adapter.code) || adapter.capabilities.length === 0 || !adapter.capabilities.every(x => operations.includes(x))) reject('provider_invalid_adapter');
    registry.set(adapter.code, adapter);
  }
  const select = (code: string | null, environment: ProviderEnvironment) => {
    if (environment !== 'sandbox') return reject('provider_live_not_enabled');
    const adapter = code ? registry.get(code) : undefined;
    if (!adapter) return reject('provider_not_configured');
    if (adapter.environment !== environment) return reject('provider_environment_mismatch');
    return adapter;
  };
  return {
    async execute(code: string | null, command: ProviderCommand): Promise<ProviderObservation> {
      validateCommand(command);
      const adapter = select(code, command.environment);
      if (!adapter.capabilities.includes(command.operation)) reject('provider_capability_unavailable');
      // Stable request ID is passed intact on every retry. Adapters implement network I/O.
      const result = await adapter.execute(Object.freeze({...command}));
      assertMatchingObservation(command, result);
      return result;
    },
    async verifyWebhook(code: string | null, environment: ProviderEnvironment, body: Uint8Array, headers: Readonly<Record<string, string>>) {
      const adapter = select(code, environment);
      if (body.byteLength === 0 || body.byteLength > 1048576) reject('provider_invalid_body');
      const result = await adapter.verifyWebhook(body.slice(), Object.freeze({...headers}));
      validateObservation(result);
      if (result.environment !== environment || !adapter.capabilities.includes(result.operation)) reject('provider_observation_mismatch');
      return {eventKey: providerEventKey(adapter.code, result), observation: result};
    },
    list: () => [...registry.values()].map(x => ({code:x.code,apiVersion:x.apiVersion,environment:x.environment,capabilities:[...x.capabilities]})),
  };
}
export const configuredProviders = createProviderRegistry();
