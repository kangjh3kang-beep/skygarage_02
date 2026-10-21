import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { totp, exerciseLiveAuth, repairPriorAuthCleanup } from '../supabase/functions/live-auth-verification/runner.ts';
import { parseLiveAuthReport } from '../src/lib/live-auth-report.ts';

test('test authenticator matches RFC 6238 vectors, including leading zeroes', async () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for (const [time, expected] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) assert.equal(await totp(secret, time * 1000), expected);
  await assert.rejects(totp('INVALID!'));
});

test('an identity is banned even when binding fails; secrets never enter the report', async () => {
  const id = randomUUID(), actor = randomUUID(); let banned = false, finished, logoutSettled = false;
  const admin = { auth: { admin: {
    createUser: async ({ password }) => {
      assert.ok(new TextEncoder().encode(password).length <= 72, 'hosted Auth rejects passwords over 72 bytes');
      assert.ok(password.length >= 32, 'test passwords retain ample entropy');
      return { data: { user: { id: actor } }, error: null };
    },
    updateUserById: async (uid, attrs) => { assert.equal(logoutSettled, true, 'global logout must settle before banning'); assert.equal(uid, actor); assert.equal(attrs.ban_duration, '876000h'); banned = true; return { error: null }; },
    getUserById: async () => ({ data: { user: { banned_until: '2126-01-01T00:00:00Z' } }, error: null }),
  } }, rpc: async (name, args) => {
    if (name === 'platform_bind_live_auth_actor') return { error: { message: 'binding rejected' } };
    finished = args; return { data: { status: 'failed' }, error: null };
  } };
  const result = await exerciseLiveAuth({ run: { id }, admin, headquarters: {}, newClient: () => ({ auth: { signOut: async () => { await new Promise(resolve => setTimeout(resolve, 0)); logoutSettled = true; return { error: null }; } } }) });
  assert.equal(banned, true); assert.equal(result.status, 'failed'); assert.equal(finished.p_auth_cleanup, true);
  assert.equal(finished.p_error_code, 'execution_failed'); assert.equal(finished.p_checks.at(-1).passed, false);
  assert.doesNotMatch(JSON.stringify(finished), /password|secret|access_token|refresh_token|Bearer /);
});

test('a claimed passing report requires clean-up and cannot grant human acceptance', () => {
  const id = randomUUID();
  const report = { schema_version: 1, id, release_sha: 'a'.repeat(40), status: 'passed', site_a: id, site_b: id, scope_a: id, scope_b: id,
    checks: Array.from({ length: 15 }, (_, i) => ({ id: `test_${i}`, passed: true })), error_code: null, test_accounts: 3,
    database_cleanup: true, auth_cleanup: true, created_at: '2026-10-21T00:00:00Z', finished_at: '2026-10-21T00:00:01Z',
    environment: 'staging', kind: 'live_auth_automated', acceptance_granted: false, human_reviewed: false, hardware_verified: false };
  assert.equal(parseLiveAuthReport(report).status, 'passed');
  for (const patch of [{ auth_cleanup: false }, { database_cleanup: false }, { acceptance_granted: true }, { human_reviewed: true }, { hardware_verified: true }, { checks: [] }, { test_accounts: 2 }]) assert.throws(() => parseLiveAuthReport({ ...report, ...patch }));
});

test('session cleanup failure still bans the identity and cannot report full cleanup', async () => {
  const actor = randomUUID(); let banned = false, saved;
  const admin = { auth: { admin: {
    createUser: async () => ({ data: { user: { id: actor } }, error: null }),
    updateUserById: async () => { banned = true; return { error: null }; },
    getUserById: async () => ({ data: { user: { banned_until: '2126-01-01T00:00:00Z' } }, error: null }),
  } }, rpc: async (name, args) => {
    if (name === 'platform_bind_live_auth_actor') return { error: { message: 'binding failed' } };
    saved = args; return { data: { status: 'failed' }, error: null };
  } };
  await exerciseLiveAuth({ run: { id: randomUUID() }, admin, headquarters: {}, newClient: () => ({ auth: { signOut: async () => { throw new Error('network unavailable'); } } }) });
  assert.equal(banned, true); assert.equal(saved.p_auth_cleanup, false);
});

test('committed migration is exactly the SQL checked locally', () => {
  assert.equal(readFileSync(new URL('../supabase/sql/live-auth-verification.sql', import.meta.url), 'utf8'), readFileSync(new URL('../supabase/migrations/20261021001220_live_auth_verification.sql', import.meta.url), 'utf8'));
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  const cleanup = readdirSync(migrations).filter(name => name.endsWith('_live_auth_cleanup.sql'));
  assert.equal(cleanup.length, 1);
  assert.equal(readFileSync(new URL('../supabase/sql/live-auth-cleanup.sql', import.meta.url), 'utf8'), readFileSync(new URL(cleanup[0], migrations), 'utf8'));
});

test('cleanup recovery refuses another identity and always re-bans a failed test login', async () => {
  const run_id = randomUUID(), user_id = randomUUID(), email = `g0-${run_id.replaceAll('-', '')}-writer@example.invalid`;
  let marker = 'wrong-run', updates = [];
  const headquarters = { rpc: async () => ({ data: [{ run_id, user_id, email }], error: null }) };
  const admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: { email, app_metadata: { skygarage_test_run: marker } } }, error: null }),
    updateUserById: async (id, attrs) => { assert.equal(id, user_id); updates.push(attrs.ban_duration); if (attrs.password) assert.ok(new TextEncoder().encode(attrs.password).length <= 72); return { error: null }; },
  } } };
  const newClient = () => ({ auth: { signInWithPassword: async () => ({ error: { message: 'rejected' }, data: {} }) } });
  await assert.rejects(repairPriorAuthCleanup({ headquarters, admin, newClient }), /invalid_cleanup_identity/);
  assert.deepEqual(updates, []);
  marker = run_id;
  await assert.rejects(repairPriorAuthCleanup({ headquarters, admin, newClient }), /cleanup_signin_failed/);
  assert.deepEqual(updates, ['none','876000h']);
});

test('recovery verifies hosted cleanup only after global logout and re-ban', async () => {
  const run_id = randomUUID(), user_id = randomUUID(), email = `g0-${run_id.replaceAll('-', '')}-reviewer@example.invalid`;
  const events = [];
  const headquarters = { rpc: async (name, args) => {
    if (name === 'platform_live_auth_cleanup_targets') return { data: [{ run_id,user_id,email }], error: null };
    assert.equal(name, 'platform_verify_live_auth_cleanup'); assert.equal(args.p_run_id, run_id);
    assert.deepEqual(events, ['rotate','login','logout','ban']);
    return { data: true, error: null };
  } };
  const admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: { email, app_metadata: { skygarage_test_run: run_id } } }, error: null }),
    updateUserById: async (id, attrs) => { assert.equal(id,user_id); events.push(attrs.password ? 'rotate' : 'ban'); return { error: null }; },
  } } };
  const newClient = () => ({ auth: {
    signInWithPassword: async () => { events.push('login'); return { data: { user: { id: user_id } }, error: null }; },
    signOut: async ({ scope }) => { assert.equal(scope,'global'); await new Promise(resolve => setTimeout(resolve,0)); events.push('logout'); return { error: null }; },
  } });
  await repairPriorAuthCleanup({ headquarters, admin, newClient });
});
