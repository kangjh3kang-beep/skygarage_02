import { state, reset, emitAuthChange } from './browser-runtime.mjs';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const React = await import('react');
const { render, cleanup, waitFor, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { AuthProvider, useAuth } = await import('../../src/admin/contexts/AuthContext.tsx');
const { default: Workbench } = await import('../../src/admin/pages/GovernanceWorkbench.tsx');
const { default: Digest } = await import('../../src/admin/components/EvidenceDigestInput.tsx');
const { requirements } = await import('../../src/lib/implementation-plan.ts');
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const el = React.createElement;
const theme = createTheme();
const snapshot = (scopeId = id) => ({ schema_version: 1, observed_at: '2026-10-20T00:00:00Z', scope: { id: scopeId, site_id: scopeId, plan_version: '2026.10-v1', release_sha: 'a'.repeat(40), configuration_digest: 'b'.repeat(64) }, permissions: { write: true, review: true }, readiness: { approved: 0, covered: 0, total: 36, blocking_defects: 0, configuration_current: true, requirements: requirements.map(r => ({ id: r.id, phase: r.phase, title: r.title, required_kinds: ['integration', 'acceptance'], dependencies: r.dependsOn, accepted: false, evidence_complete: false })) }, evidence_total: 0, evidence: [], improvements_total: 0, improvements: [], provisioning: [], modules: [] });
const directory = () => ({ schema_version: 1, observed_at: '2026-10-20T00:00:00Z', headquarters: true, operators: [], assignments: [], organizations: [{ id, name: '가상 검증 조직' }], sites: [id, other].map((siteId, i) => ({ id: siteId, name: `가상 현장 ${i + 1}`, organization_id: id, phase: 'sandbox', validation_scope_id: siteId })) });
const loopSnapshot = (scopeId=id) => ({...snapshot(scopeId),counts:{active:0,critical:0,unassigned:0,verification:0,closed:0,pending_reviews:0,expired:0,expiring:0},blockers:requirements.map(r=>({id:r.id,missing_kinds:['integration','acceptance'],open_defects:0})),next_improvement:null,next_evidence:null});
function setup(executor) {
  reset();
  state.rpcExecutor = async (name, payload, actor) => name === 'platform_governance_directory' ? { data: directory(), error: null } : name === 'platform_growth_loop_snapshot' ? {data:loopSnapshot(payload.p_scope_id),error:null} : name === 'platform_governance_snapshot' ? { data: snapshot(payload.p_scope_id), error: null } : executor ? executor(name, payload, actor) : { data: null, error: { message: 'unexpected_write' } };
}
function Ready() { const auth=useAuth(); return auth.loading?null:el(Workbench); }
function open(path = '/admin/governance?case=G0-01') { return render(el(MemoryRouter, { initialEntries: [path] }, el(ThemeProvider, { theme }, el(AuthProvider, null, el(Ready))))); }
async function select(v, label, name) { const box=await v.findByRole('combobox', { name: new RegExp(label) }); await waitFor(()=>assert.notEqual(box.getAttribute('aria-disabled'),'true')); fireEvent.mouseDown(box); fireEvent.click(await v.findByRole('option', { name })); }
async function chooseSite(v, name = /가상 현장 1/) { await waitFor(() => assert.ok(state.calls.some(c => c.name === 'platform_governance_directory'))); await select(v, '검증할 현장', name); await v.findByLabelText('시험 범위·실측 결과·남은 한계', {exact:false}); }
const digestOf = text => createHash('sha256').update(text).digest('hex');
function DigestForm() { const [value, change] = React.useState(''), [busy, setBusy] = React.useState(false); return el('div', null, el(Digest, { value, onChange: change, disabled: false, onBusy: setBusy }), el('button', { disabled: busy || !value }, '결과 제출')); }
afterEach(() => cleanup());

test('G0 selection binds the correct partial procedure and requires an explicit result', async () => {
  setup(); const v = open(); await chooseSite(v);
  assert.equal(v.getByLabelText('시험 절차·버전', {exact:false}).value, 'g0/G0-01/v1');
  assert.equal(v.getByLabelText('시험 절차·버전', {exact:false}).disabled, true);
  assert.equal(v.getByRole('button', { name: '검증 증거 등록' }).disabled, true);
  await select(v, '시험 결과', '실패 · 개선 과제 자동 생성');
  assert.equal(v.getByRole('button', { name: '검증 증거 등록' }).disabled, false);
  await select(v, 'G0 검수 항목', /G0-04/);
  assert.equal(v.getByLabelText('시험 절차·버전', {exact:false}).value, 'g0/G0-04/v1');
  assert.equal(v.getByRole('button', { name: '검증 증거 등록' }).disabled, true);
  assert.equal(v.getAllByRole('combobox', { name: '연결 요구사항' })[0].getAttribute('aria-disabled'), 'true');
  assert.match(v.container.textContent, /F06 · g0\/G0-04\/v1/);
  assert.equal(state.calls.some(c => !['platform_governance_directory', 'platform_governance_snapshot', 'platform_growth_loop_snapshot', 'user_roles'].includes(c.name)), false);
});

test('failed evidence save retains input and retry uses one idempotency key', async () => {
  const writes = []; setup((name, payload) => { writes.push({ name, payload }); return { data: null, error: { message: 'temporary_transport_failure' } }; });
  const v = open('/admin/governance?case=G0-04'); await chooseSite(v);
  await select(v, '시험 결과', '실패 · 개선 과제 자동 생성');
  fireEvent.change(v.getByLabelText('증거 파일 HTTPS 링크 · 로그인·접근제어 가능', {exact:false}), { target: { value: 'https://example.invalid/evidence/test.json' } });
  fireEvent.change(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}), { target: { value: 'b'.repeat(64) } });
  fireEvent.change(v.getByLabelText('시험 범위·실측 결과·남은 한계', {exact:false}), { target: { value: '가상 시험에서 자기 승인 거부 여부를 확인했습니다.' } });
  const submit = v.getByRole('button', { name: '검증 증거 등록' });
  fireEvent.submit(submit.closest('form'));
  await waitFor(() => assert.equal(writes.length, 1));
  await waitFor(() => assert.equal(submit.disabled, false));
  assert.match(v.getByLabelText('시험 범위·실측 결과·남은 한계', {exact:false}).value, /가상 시험/);
  fireEvent.submit(submit.closest('form'));
  await waitFor(() => assert.equal(writes.length, 2));
  assert.equal(writes[0].payload.p_request_id, writes[1].payload.p_request_id);
  assert.equal(writes[0].payload.p_requirement_id, 'F06');
  assert.equal(writes[0].payload.p_test_kind, 'integration');
  assert.equal(writes[0].payload.p_result, 'fail');
  assert.match(writes[0].payload.p_summary, /^\[G0-04\]/);
});

test('switching site clears pending setup fields and unconfirmed deployment is not substituted', async () => {
  setup(); const v = open(); await chooseSite(v);
  const sha = v.getByLabelText('소스 커밋 SHA · 40자리', {exact:false});
  fireEvent.change(sha, { target: { value: 'a'.repeat(40) } });
  await select(v, '검증할 현장', /가상 현장 2/);
  assert.equal(sha.value, '');
  state.versionError = true; fireEvent.click(v.getByRole('button', { name: '현재 웹 버전 채우기' }));
  await waitFor(() => assert.match(v.container.textContent, /현재 웹 배포 버전을 확인하지 못했습니다/));
  assert.equal(sha.value, '');
  state.versionError = false; fireEvent.click(v.getByRole('button', { name: '현재 웹 버전 채우기' }));
  await waitFor(() => assert.equal(sha.value, 'b0219e0eca6a0bc3f6bb7dee61da0f5629d074a3'));
});

test('late mutation after account change never reports success or preserves the old form', async () => {
  let finish; setup(() => new Promise(resolve => { finish = resolve; }));
  const v = open(); const field = await v.findByLabelText('운영 조직명', {exact:false});
  fireEvent.change(field, { target: { value: '이전 계정의 가상 조직' } });
  fireEvent.submit(field.closest('form'));
  await waitFor(() => assert.equal(typeof finish, 'function'));
  state.actor = other;
  await act(async () => { emitAuthChange(); await new Promise(resolve => setTimeout(resolve, 10)); });
  await act(async () => finish({ data: { id }, error: null }));
  assert.equal(v.getByLabelText('운영 조직명', {exact:false}).value, '');
  assert.doesNotMatch(v.container.textContent, /운영 조직을 등록했습니다/);
});

test('file hash replacement ignores late reads and blocks submission until latest hash completes', async () => {
  reset(); const v = render(el(ThemeProvider, { theme }, el(DigestForm)));
  const input = v.getByLabelText('증거 해시 계산용 파일', {exact:false});
  let finishOld;
  fireEvent.change(input, { target: { files: [{ name: 'old.txt', size: 3, arrayBuffer: () => new Promise(resolve => { finishOld = resolve; }) }] } });
  assert.equal(v.getByRole('button', { name: '결과 제출' }).disabled, true);
  fireEvent.change(input, { target: { files: [new File(['new'], 'new.txt')] } });
  await waitFor(() => assert.equal(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}).value, digestOf('new')));
  await act(async () => finishOld(new TextEncoder().encode('old').buffer));
  assert.equal(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}).value, digestOf('new'));
  assert.match(v.getByRole('status').textContent, /new.txt/);
  fireEvent.change(input, { target: { files: [{ name: 'large.bin', size: 51 * 1024 * 1024 }] } });
  assert.equal(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}).value, '');
  assert.equal(v.getByRole('button', { name: '결과 제출' }).disabled, true);
  assert.match(v.container.textContent, /이전 해시는 지웠습니다/);
  assert.equal(state.calls.length, 0);
});

test('manual hash input cancels a pending file result without uploading the file', async () => {
  reset(); const v = render(el(ThemeProvider, { theme }, el(DigestForm)));
  let finish;
  fireEvent.change(v.getByLabelText('증거 해시 계산용 파일', {exact:false}), { target: { files: [{ name: 'slow.txt', size: 3, arrayBuffer: () => new Promise(resolve => { finish = resolve; }) }] } });
  fireEvent.change(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}), { target: { value: 'c'.repeat(64) } });
  await act(async () => finish(new TextEncoder().encode('old').buffer));
  assert.equal(v.getByLabelText('파일 SHA-256 · 64자리', {exact:false}).value, 'c'.repeat(64));
  assert.equal(state.calls.length, 0);
});


test('a mismatched site snapshot cannot display evidence or offer a write form', async () => {
  setup();
  const original = state.rpcExecutor;
  state.rpcExecutor = (name, payload, actor) => name === 'platform_growth_loop_snapshot' ? {data:loopSnapshot(payload.p_scope_id),error:null} : name === 'platform_governance_snapshot' ? Promise.resolve({ data: snapshot(other), error: null }) : original(name, payload, actor);
  const v = open(); await select(v, '검증할 현장', /가상 현장 1/);
  await v.findByText(/선택한 현장과 증거의 검증 범위가 일치하지 않습니다/);
  assert.ok(!v.queryByRole('button', { name: '검증 증거 등록' }));
  assert.ok(!v.queryByLabelText('시험 범위·실측 결과·남은 한계', { exact: false }));
  assert.equal(state.calls.some(c => c.name === 'platform_submit_evidence'), false);
});
