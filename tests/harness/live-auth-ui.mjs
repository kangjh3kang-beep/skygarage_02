import { state, reset } from './browser-runtime.mjs';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
const React = await import('react');
const { render, cleanup, waitFor, fireEvent, act } = await import('@testing-library/react');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: Verification } = await import('../../src/admin/components/LiveAuthVerification.tsx');
const el = React.createElement, theme = createTheme(), id = '11111111-1111-4111-8111-111111111111';
const component = (props = {}) => el(ThemeProvider, { theme }, el(Verification, { key: props.userId ?? id, userId: id, release: 'a'.repeat(40), verified: true, ...props }));
const runButton = v => v.getByRole('button', { name: '시험 계정 생성·실제 인증 검수 실행' });
afterEach(() => cleanup());

test('live Auth never runs on mount or without confirmed MFA and release', async () => {
  reset(); const v = render(component({ verified: false, release: null }));
  assert.equal(runButton(v).disabled, true);
  assert.equal(state.calls.some(c => c.kind === 'function'), false);
  v.rerender(component()); await waitFor(() => assert.equal(runButton(v).disabled, false));
  assert.equal(state.calls.some(c => c.kind === 'function'), false);
});

test('an uncertain response retries the same request and account changes discard late errors', async () => {
  reset(); const writes = [];
  state.functionExecutor = async (name, options) => { writes.push({ name, ...options.body }); return { data: null, error: { message: 'transport_unconfirmed' } }; };
  const v = render(component()); await waitFor(() => assert.equal(runButton(v).disabled, false));
  fireEvent.click(runButton(v)); await v.findByText(/실행 결과를 확인하지 못했습니다/);
  await waitFor(() => assert.equal(runButton(v).disabled, false));
  fireEvent.click(runButton(v)); await waitFor(() => assert.equal(writes.length, 2));
  assert.equal(writes[0].request_id, writes[1].request_id); assert.equal(writes[0].release_sha, 'a'.repeat(40));
  await waitFor(() => assert.equal(runButton(v).disabled, false));
  let finish; state.functionExecutor = () => new Promise(resolve => { finish = resolve; });
  fireEvent.click(runButton(v)); await waitFor(() => assert.equal(typeof finish, 'function'));
  v.rerender(component({ userId: '22222222-2222-4222-8222-222222222222' }));
  await act(async () => finish({ data: null, error: { message: 'old_account_error' } }));
  assert.doesNotMatch(v.container.textContent, /실행 결과를 확인하지 못했습니다/);
});

test('a server-side running record prevents a second cohort from starting', async () => {
  reset();
  state.rpcExecutor = async () => ({ data: { schema_version: 1, id, release_sha: 'a'.repeat(40), status: 'running', site_a: id, site_b: id, scope_a: id, scope_b: id, checks: [], error_code: null, test_accounts: 0, database_cleanup: false, auth_cleanup: false, created_at: '2026-10-21T00:00:00Z', finished_at: null, environment: 'staging', kind: 'live_auth_automated', acceptance_granted: false, human_reviewed: false, hardware_verified: false }, error: null });
  const v = render(component()); await v.findByText('서버에서 실행 중');
  assert.equal(runButton(v).disabled, true); assert.equal(state.calls.some(c => c.kind === 'function'), false);
});
