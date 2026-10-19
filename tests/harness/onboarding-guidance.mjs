import { state, reset, emitAuthChange, syntheticMfaSecret } from './browser-runtime.mjs';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
const React = await import('react');
const { render, cleanup, waitFor, fireEvent, act, within } = await import('@testing-library/react');
const { default: App } = await import('../../src/App.tsx');
const { AuthProvider } = await import('../../src/admin/contexts/AuthContext.tsx');
const { default: Gate } = await import('../../src/admin/components/AdminSecurityGate.tsx');
const el = React.createElement;
const open = path => { window.history.replaceState({}, '', path); return render(el(App)); };
const gate = () => render(el(AuthProvider, null, el(Gate, null, el('h1', null, '보호된 실제 관리 화면'))));
const verify = (v, code = '123456') => { fireEvent.change(v.getByLabelText('인증 앱 6자리 번호'), { target: { value: code } }); fireEvent.click(v.getByRole('button', { name: '인증하고 관리 화면 열기' })); };
afterEach(() => cleanup());

test('help works before MFA and does not enroll a factor or bypass a blocked route', async () => {
  reset(); state.aal = 'aal1';
  let v = open('/admin/erp');
  await v.findByText('관리자 2단계 인증');
  fireEvent.click(v.getByRole('button', { name: '설정·사용 안내' }));
  let dialog = await v.findByRole('dialog');
  assert.match(dialog.textContent, /자체 ERP 회계 시험/);
  assert.match(dialog.textContent, /시험 거래 전용/);
  assert.equal(state.calls.some(c => c.mutation), false);
  fireEvent.click(within(dialog).getByRole('button', { name: '안내 닫기' }));
  await waitFor(() => assert.ok(!v.queryByRole('dialog'), 'dialog should close'));
  cleanup(); reset();
  v = open('/admin/workflows');
  await waitFor(() => assert.match(v.container.textContent, /현장별 권한·데이터 연결과 인수/));
  fireEvent.click(v.getByRole('button', { name: '설정·사용 안내' }));
  dialog = await v.findByRole('dialog');
  assert.match(dialog.textContent, /현재 이 모듈은 연결·검수 준비 중이므로 실행할 수 없습니다/);
  assert.equal(state.calls.some(c => /workflow/.test(c.name)), false);
  fireEvent.click(within(dialog).getByRole('link', { name: '관리자 시작하기' }));
  await v.findByRole('heading', { name: '운영 설정과 검수 시작하기', level: 1 });
  await waitFor(() => assert.ok(!v.queryByRole('dialog'), 'dialog should close'));
});

test('public help searches instructions without disclosing authenticated data', async () => {
  reset(); state.loggedIn = false;
  const v = open('/help');
  const search = await v.findByLabelText('기능·설정·문제 검색');
  fireEvent.change(search, { target: { value: '인증 앱' } });
  assert.match(v.getByRole('status').textContent, /검색 결과 [1-9]/);
  fireEvent.change(search, { target: { value: 'no-matching-harness-page' } });
  assert.match(v.getByRole('status').textContent, /검색 결과 0개/);
  assert.match(v.container.textContent, /검색어를 줄이거나/);
  assert.equal(state.calls.some(c => c.kind === 'rpc' || c.kind === 'table' || c.mutation), false);
});

test('manual MFA key is masked, no secret is stored, verification requires aal2 and clears enrollment UI', async () => {
  reset(); state.aal = 'aal1';
  const v = gate();
  fireEvent.click(await v.findByRole('button', { name: '인증 앱 등록하기' }));
  const key = await v.findByLabelText('인증 앱 수동 설정 키');
  assert.equal(key.type, 'password'); assert.equal(key.value, syntheticMfaSecret);
  v.container.querySelector('details').open = true;
  fireEvent.click(v.getByRole('button', { name: '설정 키 표시' }));
  assert.equal(key.type, 'text');
  assert.equal(localStorage.length + sessionStorage.length, 0);
  verify(v);
  await waitFor(() => assert.match(v.container.textContent, /자동 시간 설정/));
  assert.doesNotMatch(v.container.textContent, /보호된 실제 관리 화면/);
  assert.equal(state.calls.filter(c => c.name === 'mfa.enroll').length, 1);
  state.mfaVerifyUpgrades = true;
  verify(v, '654321');
  await v.findByRole('heading', { name: '보호된 실제 관리 화면' });
  assert.ok(!v.queryByLabelText('인증 앱 수동 설정 키'), 'previous secret must be absent');
  assert.ok(!v.queryByAltText('인증 앱 등록 QR 코드'), 'previous QR must be absent');
});

test('pending cleanup re-reads factors and never removes a verified or non-TOTP factor', async () => {
  reset(); state.aal = 'aal1';
  state.factors = [{ id: 'pending', factor_type: 'totp', status: 'unverified' }];
  const v = gate();
  await v.findByRole('button', { name: '미완료 등록 정리' });
  state.factors.push({ id: 'verified-after-check', factor_type: 'totp', status: 'verified' }, { id: 'phone', factor_type: 'phone', status: 'unverified' });
  fireEvent.click(v.getByRole('button', { name: '미완료 등록 정리' }));
  await v.findByLabelText('인증 앱 6자리 번호');
  assert.deepEqual(state.calls.filter(c => c.name === 'mfa.unenroll').map(c => c.factorId), ['pending']);
  assert.ok(!v.queryByRole('button', { name: '미완료 등록 정리' }));
  assert.equal(state.calls.some(c => c.name === 'mfa.enroll'), false);
});

test('duplicate enrollment and a late response from a previous account cannot expose an old secret', async () => {
  reset(); state.aal = 'aal1';
  let resolveEnrollment;
  state.mfaEnrollExecutor = () => new Promise(resolve => { resolveEnrollment = resolve; });
  const v = gate();
  const button = await v.findByRole('button', { name: '인증 앱 등록하기' });
  fireEvent.click(button); fireEvent.click(button);
  assert.equal(state.calls.filter(c => c.name === 'mfa.enroll').length, 1);
  state.actor = '22222222-2222-4222-8222-222222222222';
  await act(async () => { emitAuthChange(); await new Promise(resolve => setTimeout(resolve, 10)); });
  await act(async () => resolveEnrollment({ data: { id: 'old-factor', totp: { qr_code: '<svg/>', secret: syntheticMfaSecret } }, error: null }));
  await waitFor(() => assert.equal(v.getByRole('button', { name: '인증 앱 등록하기' }).disabled, false));
  assert.ok(!v.queryByLabelText('인증 앱 수동 설정 키'), 'previous secret must be absent');
  assert.ok(!v.queryByAltText('인증 앱 등록 QR 코드'), 'previous QR must be absent');
  assert.equal(localStorage.length + sessionStorage.length, 0);
});

test('onboarding shows real query failures and unconfirmed versions without inventing acceptance', async () => {
  reset(); state.versionError = true;
  const v = open('/admin/start');
  await v.findByRole('heading', { name: '운영 설정과 검수 시작하기', level: 1 });
  await waitFor(() => assert.match(v.container.textContent, /현장 설정 필요/));
  await waitFor(() => assert.match(v.container.textContent, /웹 배포 버전: 확인하지 못함/));
  assert.match(v.container.textContent, /실제 계정 검수 필요/);
  state.mode = 'error';
  fireEvent.click(v.getByRole('button', { name: '준비 상태 새로 조회' }));
  await waitFor(() => assert.match(v.container.textContent, /조회 실패/));
  assert.doesNotMatch(v.container.textContent, /현장 설정 필요/);
  assert.equal(state.calls.some(c => c.mutation), false);
});

test('non-headquarters onboarding requests only the scoped directory', async () => {
  reset(); state.role = 'manager';
  state.rpcExecutor = name => name === 'platform_governance_directory' ? { data: { schema_version: 1, observed_at: '2026-10-19T00:00:00Z', headquarters: false, operators: [], assignments: [], organizations: [], sites: [] }, error: null } : { data: null, error: { message: 'unexpected headquarters request' } };
  const v = open('/admin/start');
  await waitFor(() => assert.match(v.container.textContent, /최고관리자에게 본인 계정의 현장 담당 또는 검수 권한을 요청/));
  await waitFor(() => assert.match(v.container.textContent, /b0219e0eca6a0bc3f6bb7dee61da0f5629d074a3/));
  assert.equal(state.calls.some(c => c.name === 'platform_readiness_snapshot' || c.mutation), false);
});
