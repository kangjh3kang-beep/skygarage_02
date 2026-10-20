import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function database() {
  if (process.env.LIVE_AUTH_NATIVE !== '1') return PGlite.create({ extensions: { pgcrypto } });
  const directory = await mkdtemp(join(tmpdir(), 'doelv-live-auth-'));
  const db = new EmbeddedPostgres({ databaseDir: join(directory, 'data'), port: 29000 + Math.floor(Math.random() * 1000), user: 'postgres', password: randomUUID(), persistent: false, createPostgresUser: false, postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories='], onLog: () => {}, onError: () => {} });
  await db.initialise(); await db.start(); const client = db.getPgClient('postgres', '127.0.0.1'); await client.connect();
  return { exec: sql => client.query(sql), query: (...args) => client.query(...args), close: async () => { await client.end(); await db.stop(); await rm(directory, { recursive: true, force: true }); } };
}

test('live-Auth provisioning is HQ/MFA gated, idempotent, isolated and revocable', async () => {
  const pg = await database();
  const root = new URL('../', import.meta.url);
  try {
    for (const path of ['tests/governance-bootstrap.sql', 'supabase/sql/platform-foundation.sql', 'supabase/sql/site-template-generator.sql', 'supabase/sql/platform-governance.sql', 'supabase/sql/platform-governance-catalog.sql']) await pg.exec(await readFile(new URL(path, root), 'utf8'));
    await pg.exec("alter table auth.users add column email text, add column raw_app_meta_data jsonb default '{}'::jsonb, add column created_at timestamptz default clock_timestamp()");
    await pg.exec(await readFile(new URL('supabase/sql/live-auth-verification.sql', root), 'utf8'));
    const hq = randomUUID(), ordinary = randomUUID(), request = randomUUID();
    await pg.query('insert into auth.users(id) values($1),($2)', [hq, ordinary]);
    await pg.query("insert into public.user_roles(user_id,role) values($1,'super_admin')", [hq]);
    async function as(role, actor, aal, sql, args = []) {
      await pg.exec(`set role ${role}`);
      await pg.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, sub: actor, aal, user_metadata: { role: 'super_admin' } })]);
      try { return (await pg.query(sql, args)).rows[0]?.result; } finally { await pg.exec('reset role'); }
    }
    const begin = (actor, aal = 'aal2', id = request, release = 'a'.repeat(40)) => as('authenticated', actor, aal, 'select public.platform_begin_live_auth_test($1,$2) result', [id, release]);
    await assert.rejects(begin(hq, 'aal1'), /super_admin_mfa_required/);
    await assert.rejects(begin(ordinary), /super_admin_mfa_required/);
    await assert.rejects(as('anon', null, null, 'select public.platform_begin_live_auth_test($1,$2) result', [request, 'a'.repeat(40)]), /permission denied/);
    const run = await begin(hq); assert.equal(run.claimed, true); assert.equal(run.test_accounts, 0);
    assert.notEqual(run.site_a, run.site_b); assert.notEqual(run.scope_a, run.scope_b);
    assert.equal((await begin(hq)).claimed, false);
    assert.equal(Number((await pg.query('select count(*) n from public.platform_sites')).rows[0].n), 2);
    assert.equal(Number((await pg.query("select count(*) n from public.platform_site_blueprints where definition->>'hardware_control_enabled'='false' and definition->>'payments_enabled'='false'")).rows[0].n), 2);
    await assert.rejects(begin(hq, 'aal2', request, 'b'.repeat(40)), /idempotency_conflict/);
    await assert.rejects(begin(hq, 'aal2', randomUUID()), /test_already_running/);
    await assert.rejects(as('authenticated', hq, 'aal2', 'select public.platform_bind_live_auth_actor($1,$2,$3) result', [request, ordinary, 'writer']), /permission denied/);
    await assert.rejects(as('service_role', null, null, 'select public.platform_bind_live_auth_actor($1,$2,$3) result', [request, ordinary, 'writer']), /invalid_test_actor/);
    const actors = {};
    for (const slot of ['writer', 'reviewer', 'member']) {
      const user = randomUUID(); actors[slot] = user;
      await pg.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [user, `g0-${request.replaceAll('-', '')}-${slot}@example.invalid`, { skygarage_test_run: request }]);
      await as('service_role', null, null, 'select public.platform_bind_live_auth_actor($1,$2,$3) result', [request, user, slot]);
    }
    assert.equal(Number((await pg.query("select count(*) n from public.user_roles where role='super_admin'")).rows[0].n), 1);
    const scoped = await as('authenticated', actors.writer, 'aal2', 'select public.platform_governance_directory() result');
    assert.equal(scoped.headquarters, false); assert.equal(scoped.sites.length, 1); assert.equal(scoped.sites[0].id, run.site_a);
    await assert.rejects(as('authenticated', actors.writer, 'aal2', 'select public.platform_governance_snapshot($1) result', [run.scope_b]), /site_access_denied/);
    await assert.rejects(as('authenticated', actors.writer, 'aal2', 'select public.platform_live_auth_report($1) result', [request]), /super_admin_mfa_required/);
    await assert.rejects(as('service_role', null, null, 'select public.platform_finish_live_auth_test($1,$2,null,true) result', [request, [{ id: 'unsafe', passed: true, secret: 'not-a-real-secret' }]]), /invalid_test_report/);
    const checks = Array.from({ length: 15 }, (_, i) => ({ id: `fixture_${i}`, passed: true }));
    const result = await as('service_role', null, null, 'select public.platform_finish_live_auth_test($1,$2,null,true) result', [request, checks]);
    assert.equal(result.status, 'passed'); assert.equal(result.acceptance_granted, false); assert.equal(result.human_reviewed, false);
    assert.equal(result.database_cleanup, true); assert.equal(result.auth_cleanup, true);
    assert.equal(Number((await pg.query('select count(*) n from platform_private.site_staff where active')).rows[0].n), 0);
    assert.equal(Number((await pg.query("select count(*) n from public.user_roles where role<>'super_admin'")).rows[0].n), 0);
    await assert.rejects(as('authenticated', actors.writer, 'aal2', 'select public.platform_governance_snapshot($1) result', [run.scope_a]), /site_access_denied/);
    assert.equal(Number((await pg.query('select count(*) n from platform_private.evidence_reviews')).rows[0].n), 0);
    assert.equal(Number((await pg.query("select count(*) n from public.platform_sites where phase<>'sandbox'")).rows[0].n), 0);
    // Cleanup after an interrupted execution expires rights without an API call.
    const next = await begin(hq, 'aal2', randomUUID());
    await pg.query("update platform_private.live_auth_runs set expires_at=clock_timestamp()-interval '1 second' where id=$1", [next.id]);
    await pg.query('select platform_private.reap_live_auth_runs()');
    assert.equal((await as('authenticated', hq, 'aal2', 'select public.platform_live_auth_report($1) result', [next.id])).status, 'expired');
    assert.equal((await as('authenticated', hq, 'aal2', 'select public.platform_live_auth_report($1) result', [next.id])).auth_cleanup, false);
  } finally { await pg.close(); }
});
