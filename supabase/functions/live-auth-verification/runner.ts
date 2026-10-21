import type { SupabaseClient } from '@supabase/supabase-js';

export type Check = { id: string; passed: boolean };
export type TestRun = { id: string; site_a: string; site_b: string; scope_a: string; scope_b: string; claimed: boolean };
type Actor = { id: string; client: SupabaseClient; password: string; email: string; factor?: string; secret?: string };
export class TestFailure extends Error {}

// RFC 6238 / SHA-1. Called exclusively for newly created disposable identities.
// An existing user's factor, password or session is never read or altered.
export async function totp(secret: string, milliseconds = Date.now()): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new TestFailure('invalid_test_secret');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const key = await crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(milliseconds / 30000)));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = hash[hash.length - 1] & 15;
  const number = new DataView(hash.buffer).getUint32(offset) & 0x7fffffff;
  return String(number % 1000000).padStart(6, '0');
}

export async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new TestFailure(`rpc_${name}`);
  return data;
}

export async function exerciseLiveAuth(options: {
  run: TestRun; headquarters: SupabaseClient; admin: SupabaseClient; newClient: () => SupabaseClient;
}) {
  const { run, headquarters: hq, admin, newClient } = options;
  const checks: Check[] = [], actors: Actor[] = [];
  let errorCode: string | null = null, cleanup = true;
  const check = (id: string, passed: boolean) => {
    checks.push({ id, passed });
    if (!passed) throw new TestFailure('assertion_failed');
  };
  const denied = async (id: string, client: SupabaseClient, name: string, args: Record<string, unknown>, expected: string) => {
    const { error } = await client.rpc(name, args);
    check(id, !!error && ['42501', 'P0001', '22023'].includes(error.code) && error.message === expected);
  };
  const enroll = async (actor: Actor, slot: string) => {
    const response = await actor.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'G0 automated test' });
    if (response.error || !response.data || response.data.type !== 'totp') throw new TestFailure('enrollment_failed');
    actor.factor = response.data.id; actor.secret = response.data.totp.secret;
    const validCodes = await Promise.all([-2, -1, 0, 1, 2].map(n => totp(actor.secret!, Date.now() + n * 30000)));
    let invalid = '000000'; while (validCodes.includes(invalid)) invalid = String(Number(invalid) + 1).padStart(6, '0');
    const wrong = await actor.client.auth.mfa.challengeAndVerify({ factorId: actor.factor, code: invalid });
    check(`${slot}_wrong_totp_rejected`, !!wrong.error && [400, 422].includes(wrong.error.status ?? 0));
    const valid = await actor.client.auth.mfa.challengeAndVerify({ factorId: actor.factor, code: await totp(actor.secret) });
    const level = await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();
    check(`${slot}_real_totp_aal2`, !valid.error && !level.error && level.data?.currentLevel === 'aal2');
  };
  const snapshot = (actor: Actor) => rpc(actor.client, 'platform_governance_snapshot', { p_scope_id: run.scope_a });
  try {
    // Auth Admin API creates actual identities, without email/SMS delivery.
    for (const slot of ['writer', 'reviewer', 'member']) {
      const email = `g0-${run.id.replaceAll('-', '')}-${slot}@example.invalid`;
      const password = `${crypto.randomUUID()}${crypto.randomUUID()}aA1!`;
      const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { skygarage_test_run: run.id } });
      if (result.error || !result.data.user) throw new TestFailure('test_identity_creation_failed');
      const actor = { id: result.data.user.id, email, password, client: newClient() };
      actors.push(actor); // Also cleaned up if role binding or sign-in fails.
      await rpc(admin, 'platform_bind_live_auth_actor', { p_run_id: run.id, p_user_id: actor.id, p_slot: slot });
      const login = await actor.client.auth.signInWithPassword({ email, password });
      check(`${slot}_real_password_login`, !login.error && login.data.user?.id === actor.id);
      await denied(`${slot}_aal1_denied`, actor.client, 'platform_governance_directory', {}, 'mfa_required');
      if (slot !== 'member') await enroll(actor, slot);
    }
    const [writer, reviewer, member] = actors;
    check('distinct_auth_identities', new Set(actors.map(a => a.id)).size === 3);
    const directory = await rpc(writer.client, 'platform_governance_directory');
    check('writer_directory_is_scoped', directory.headquarters === false && directory.sites.length === 1 && directory.sites[0].id === run.site_a && directory.operators.length === 0);
    await denied('cross_tenant_scope_denied', writer.client, 'platform_governance_snapshot', { p_scope_id: run.scope_b }, 'site_access_denied');
    const visible = await member.client.from('platform_sites').select('id').in('id', [run.site_a, run.site_b]);
    check('member_site_rls', !visible.error && visible.data?.length === 1 && visible.data[0].id === run.site_a);
    // Do not fabricate a successful phone/KYC verification for the test member.
    const request = await member.client.from('sgp_service_requests').insert({ user_id: member.id, client_request_id: crypto.randomUUID(), category: 'visit', subject: '[G0 TEST] synthetic request', description: 'Synthetic test data. No actual visit or service is requested.' });
    check('unverified_member_request_denied', request.error?.code === '42501');
    const foreign = await member.client.from('user_roles').select('user_id').eq('user_id', writer.id);
    check('member_cannot_read_operator_role', !foreign.error && foreign.data?.length === 0);

    const artifact = JSON.stringify({ kind: 'synthetic_rpc_fixture', run: run.id, acceptance_granted: false });
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(artifact)))).map(n => n.toString(16).padStart(2, '0')).join('');
    const evidence = (result: string, measured = Date.now(), expiry = Date.now() + 3600000) => ({
      p_scope_id: run.scope_a, p_request_id: crypto.randomUUID(), p_requirement_id: 'F06', p_test_kind: 'integration', p_environment: 'staging', p_result: result,
      p_procedure_version: 'g0/automated-rpc-fixture/v1', p_artifact_uri: `https://example.invalid/g0/${run.id}/fixture.json`, p_artifact_sha256: digest,
      p_summary: '[G0 TEST] Synthetic RPC fixture only. Automated role checks; no independent human acceptance.',
      p_measured_at: new Date(measured).toISOString(), p_expires_at: new Date(expiry).toISOString(),
    });
    const proof = evidence('pass');
    const proofId = await rpc(writer.client, 'platform_submit_evidence', proof);
    check('evidence_retry_is_idempotent', proofId === await rpc(writer.client, 'platform_submit_evidence', proof));
    const staff = (role: string, revision: number, active = true) => rpc(hq, 'platform_set_site_staff', { p_site_id: run.site_a, p_user_id: writer.id, p_role: role, p_active: active, p_expected_revision: revision, p_valid_until: new Date(Date.now() + 300000).toISOString() });
    await staff('reviewer', 1);
    await denied('self_review_rejected_with_review_permission', writer.client, 'platform_review_evidence', { p_evidence_id: proofId, p_decision: 'approved', p_note: 'Automated self review must be rejected.' }, 'independent_reviewer_required');
    await staff('manager', 2);
    await rpc(reviewer.client, 'platform_review_evidence', { p_evidence_id: proofId, p_decision: 'approved', p_note: 'Automated separate-account RPC test using a synthetic fixture; no human acceptance.' });
    const afterReview = await snapshot(writer);
    check('different_account_review_persisted', afterReview.evidence.some((e: any) => e.id === proofId && e.review?.reviewer_id === reviewer.id));
    await denied('expired_submission_rejected', writer.client, 'platform_submit_evidence', evidence('pass', Date.now() - 60000, Date.now() - 1000), 'invalid_evidence_time');
    const expiry = Date.now() + 1800;
    const expiresId = await rpc(writer.client, 'platform_submit_evidence', evidence('pass', Date.now(), expiry));
    await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry + 100 - Date.now())));
    await denied('expired_review_rejected', reviewer.client, 'platform_review_evidence', { p_evidence_id: expiresId, p_decision: 'approved', p_note: 'Expired fixture must be rejected.' }, 'passing_current_evidence_required');
    const failureTime = Date.now();
    const failedId = await rpc(writer.client, 'platform_submit_evidence', evidence('fail', failureTime));
    const failureSnapshot = await snapshot(writer);
    const defect = failureSnapshot.improvements.find((i: any) => i.source_evidence_id === failedId);
    check('failure_creates_defect', !!defect && defect.status === 'open');
    await denied('failed_evidence_cannot_be_approved', reviewer.client, 'platform_review_evidence', { p_evidence_id: failedId, p_decision: 'approved', p_note: 'Failed fixture must not be approved.' }, 'passing_current_evidence_required');
    let revision = await rpc(writer.client, 'platform_transition_improvement', { p_id: defect.id, p_expected_revision: defect.revision, p_status: 'in_progress' });
    const retest = await rpc(writer.client, 'platform_submit_evidence', evidence('pass', Math.max(Date.now(), failureTime + 1)));
    revision = await rpc(writer.client, 'platform_transition_improvement', { p_id: defect.id, p_expected_revision: revision, p_status: 'verification', p_evidence_id: retest });
    await rpc(reviewer.client, 'platform_review_evidence', { p_evidence_id: retest, p_decision: 'approved', p_note: 'Automated matching retest protocol check; independent human review is pending.' });
    await rpc(reviewer.client, 'platform_transition_improvement', { p_id: defect.id, p_expected_revision: revision, p_status: 'closed' });
    const retested = await snapshot(writer);
    check('failure_retest_review_close', retested.improvements.some((i: any) => i.id === defect.id && i.status === 'closed' && i.closed_by === reviewer.id));
    check('test_does_not_grant_acceptance', retested.readiness.approved === 0);
    await denied('missing_acceptance_blocks_site_promotion', hq, 'platform_set_site_phase', { p_site_id: run.site_a, p_scope_id: run.scope_a, p_expected_phase: 'sandbox', p_phase: 'site_acceptance', p_reason: 'Automated test must not promote an unaccepted site.' }, 'foundation_gates_missing');

    const logout = await writer.client.auth.signOut();
    const login = await writer.client.auth.signInWithPassword({ email: writer.email, password: writer.password });
    check('logout_and_real_relogin', !logout.error && !login.error && login.data.user?.id === writer.id);
    await denied('relogin_needs_mfa_again', writer.client, 'platform_governance_snapshot', { p_scope_id: run.scope_a }, 'mfa_required');
    // A newly generated period avoids authenticators that reject replayed TOTP.
    const nextPeriod = 30000 - (Date.now() % 30000) + 100;
    await new Promise(resolve => setTimeout(resolve, nextPeriod));
    const verified = await writer.client.auth.mfa.challengeAndVerify({ factorId: writer.factor!, code: await totp(writer.secret!) });
    check('relogin_existing_factor_verifies', !verified.error);
    await staff('manager', 3, false);
    await denied('revocation_denies_existing_session_read', writer.client, 'platform_governance_snapshot', { p_scope_id: run.scope_a }, 'site_access_denied');
    await denied('revocation_denies_existing_session_write', writer.client, 'platform_create_improvement', { p_scope_id: run.scope_a, p_request_id: crypto.randomUUID(), p_requirement_id: 'F06', p_kind: 'improvement', p_severity: 'normal', p_title: 'Revoked synthetic write', p_description: 'This must not be persisted after access revocation.' }, 'site_access_denied');
    const revokedDirectory = await rpc(writer.client, 'platform_governance_directory');
    check('revocation_removes_site_from_directory', revokedDirectory.sites.length === 0);
  } catch (error) {
    errorCode = error instanceof TestFailure && error.message === 'assertion_failed' ? 'assertion_failed' : 'execution_failed';
    if (errorCode === 'execution_failed') checks.push({ id: error instanceof TestFailure && /^[a-z_]{2,80}$/.test(error.message) ? error.message : 'unexpected_execution_failure', passed: false });
  } finally {
    // Keep audit actors for provenance; revoke sessions and ban the test users.
    // No test password, factor secret or token is returned, logged or persisted.
    for (const actor of actors) {
      try {
        const [signedOut, banned] = await Promise.allSettled([actor.client.auth.signOut(), admin.auth.admin.updateUserById(actor.id, { ban_duration: '876000h' })]);
        const user = await admin.auth.admin.getUserById(actor.id);
        if (signedOut.status !== 'fulfilled' || signedOut.value.error || banned.status !== 'fulfilled' || banned.value.error || user.error || !user.data.user?.banned_until || Date.parse(user.data.user.banned_until) <= Date.now()) cleanup = false;
      } catch { cleanup = false; }
      actor.password = ''; actor.secret = undefined;
    }
  }
  if (!cleanup && !errorCode) errorCode = 'auth_cleanup_failed';
  return rpc(admin, 'platform_finish_live_auth_test', { p_run_id: run.id, p_checks: checks, p_error_code: errorCode, p_auth_cleanup: cleanup });
}
