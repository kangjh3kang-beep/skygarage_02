import test from 'node:test';
import assert from 'node:assert/strict';
import { syncFeedback } from '../scripts/ci-feedback.mjs';

const repo = 'example/project';
const sha = 'a'.repeat(40);
const run = { id: 10, run_attempt: 1, head_sha: sha, head_branch: 'main', head_repository: { full_name: repo }, name: 'Platform contracts', event: 'push', status: 'completed', conclusion: 'failure' };
const marker = '<!-- skygarage-ci-feedback:platform-contracts-main -->';
function harness({ latest = run, latestRuns, head = sha, issues = [] } = {}) {
  const mutations = [];
  return { mutations, api: async (path, options) => {
    if (options) { mutations.push({ path, ...options }); return { number: 77 }; }
    if (path.includes('/actions/workflows/')) {
      const event = new URL(path, 'https://api.github.com').searchParams.get('event');
      const items = latestRuns ?? [latest];
      return { workflow_runs: event ? items.filter(item => item.event === event) : items };
    }
    if (path.endsWith('/git/ref/heads/main')) return { object: { sha: head } };
    if (path.includes('/issues?')) return issues;
    throw new Error(`Unexpected API call: ${path}`);
  } };
}

test('latest failing main run opens a scoped feedback issue with immutable run identity', async () => {
  const h = harness();
  assert.equal((await syncFeedback({ repo, run, api: h.api })).action, 'opened');
  assert.equal(h.mutations.length, 1);
  assert.match(h.mutations[0].body.body, /actions\/runs\/10/);
  assert.match(h.mutations[0].body.body, new RegExp(sha));
  assert.match(h.mutations[0].body.body, /실제.*인수/);
});

test('a stale run, old attempt or non-current SHA cannot change feedback', async () => {
  for (const options of [{ latest: { ...run, id: 11 } }, { latest: { ...run, run_attempt: 2 } }, { head: 'b'.repeat(40) }]) {
    const h = harness(options);
    assert.equal((await syncFeedback({ repo, run, api: h.api })).action, 'ignored');
    assert.equal(h.mutations.length, 0);
  }
});

test('PR, fork, non-main, cancelled and malformed runs never mutate issues', async () => {
  for (const patch of [{ event: 'pull_request' }, { head_repository: { full_name: 'fork/project' } }, { head_branch: 'feature' }, { conclusion: 'cancelled' }, { id: '10/../../issues' }]) {
    const h = harness();
    assert.equal((await syncFeedback({ repo, run: { ...run, ...patch }, api: h.api })).action, 'ignored');
    assert.equal(h.mutations.length, 0);
  }
});

test('only the current passing main run closes an existing automated failure', async () => {
  const passed = { ...run, id: 12, conclusion: 'success' };
  const issue = { number: 77, state: 'open', body: marker, user: { login: 'github-actions[bot]' } };
  const h = harness({ latest: passed, issues: [issue] });
  assert.equal((await syncFeedback({ repo, run: passed, api: h.api })).action, 'closed');
  assert.equal(h.mutations[0].method, 'PATCH');
  assert.equal(h.mutations[0].body.state, 'closed');
  const noIssue = harness({ latest: passed });
  assert.equal((await syncFeedback({ repo, run: passed, api: noIssue.api })).action, 'ignored');
  assert.equal(noIssue.mutations.length, 0);
});

test('repeated delivery is idempotent and an unrelated user issue is never overwritten', async () => {
  const first = harness();
  await syncFeedback({ repo, run, api: first.api });
  const body = first.mutations[0].body.body;
  const repeat = harness({ issues: [{ number: 77, state: 'open', body, user: { login: 'github-actions[bot]' } }] });
  assert.equal((await syncFeedback({ repo, run, api: repeat.api })).action, 'ignored');
  assert.equal(repeat.mutations.length, 0);
  const userIssue = harness({ issues: [{ number: 88, state: 'open', body: marker, user: { login: 'human' } }] });
  await syncFeedback({ repo, run, api: userIssue.api });
  assert.equal(userIssue.mutations[0].method, 'POST');
});

test('a subsequent failure reopens the automated issue without creating duplicates', async () => {
  const h = harness({ issues: [{ number: 77, state: 'closed', body: marker, user: { login: 'github-actions[bot]' } }] });
  assert.equal((await syncFeedback({ repo, run, api: h.api })).action, 'reopened');
  assert.equal(h.mutations[0].body.state, 'open');
});


test('a newer unrelated main-named fork PR does not hide current main failure', async () => {
  const fork = { ...run, id: 20, event: 'pull_request', head_repository: {full_name: 'fork/project'} };
  const h = harness({ latestRuns: [fork, run] });
  assert.equal((await syncFeedback({ repo, run, api: h.api })).action, 'opened');
  assert.equal(h.mutations.length, 1);
});

test('a newer in-progress manual run supersedes a completed push on the same main SHA', async () => {
  const manual = { ...run, id: 20, event: 'workflow_dispatch', status: 'in_progress', conclusion: null };
  const h = harness({ latestRuns: [manual, run] });
  assert.equal((await syncFeedback({ repo, run, api: h.api })).reason, 'stale-run');
  assert.equal(h.mutations.length, 0);
});
