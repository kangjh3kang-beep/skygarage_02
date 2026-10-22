import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const marker = '<!-- skygarage-ci-feedback:platform-contracts-main -->';
const failures = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);

export async function syncFeedback({ repo, run, api }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) throw new Error('Invalid repository');
  if (!run || !Number.isSafeInteger(run.id) || run.id < 1 || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
      !/^[a-f0-9]{40}$/.test(run.head_sha ?? '') || run.head_repository?.full_name !== repo || run.head_branch !== 'main' ||
      run.name !== 'Platform contracts' || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed' ||
      !(run.conclusion === 'success' || failures.has(run.conclusion))) return { action: 'ignored', reason: 'out-of-scope' };
  const prefix = `/repos/${repo}`;
  const latest = (await api(`${prefix}/actions/workflows/platform-contracts.yml/runs?branch=main&per_page=1`)).workflow_runs?.[0];
  const head = (await api(`${prefix}/git/ref/heads/main`)).object?.sha;
  if (latest?.id !== run.id || latest.run_attempt !== run.run_attempt || latest.head_sha !== run.head_sha || head !== run.head_sha) return { action: 'ignored', reason: 'stale-run' };
  const issues = await api(`${prefix}/issues?state=all&labels=kind%3Afeedback&sort=updated&direction=desc&per_page=100`);
  if (!Array.isArray(issues)) throw new Error('Invalid GitHub issues response');
  const issue = issues.find(item => !item.pull_request && item.user?.login === 'github-actions[bot]' && item.body?.includes(marker));
  const passing = run.conclusion === 'success';
  if (passing && !issue) return { action: 'ignored', reason: 'no-open-failure' };
  const eventKey = `<!-- run:${run.id}:${run.run_attempt}:${run.conclusion} -->`;
  const state = passing ? 'closed' : 'open';
  if (issue?.body?.includes(eventKey) && issue.state === state) return { action: 'ignored', reason: 'already-recorded' };
  const body = `${marker}\n${eventKey}\n\n작성: GitHub Actions / 대상: main의 최신 소프트웨어 검사\n\n` +
    `- 결과: ${run.conclusion}\n- 소스 SHA: \`${run.head_sha}\`\n- [검증 실행](https://github.com/${repo}/actions/runs/${run.id}), 시도 ${run.run_attempt}\n\n` +
    (passing ? '최신 main의 소프트웨어 검사가 복구되어 이 CI 결함을 종료합니다.' : '실패 로그에서 원인을 재현하고 수정 PR과 동일 조건 재시험 결과를 연결하세요. 담당: Codex, 교차 검토: Claude.') +
    '\n\n실제 사용자·기기·현장 인수는 별도이며 이 이슈의 종료로 승인되지 않습니다. 전체 요구사항은 #27에서 계속 추적합니다.\n';
  const mutation = { title: '[CI-FEEDBACK] Platform contracts / main', body, state };
  if (issue) {
    await api(`${prefix}/issues/${issue.number}`, { method: 'PATCH', body: { ...mutation, state_reason: passing ? 'completed' : 'reopened' } });
    return { action: passing ? 'closed' : 'reopened', issue: issue.number };
  }
  const created = await api(`${prefix}/issues`, { method: 'POST', body: { title: mutation.title, body, labels: ['kind:feedback', 'agent:codex'] } });
  return { action: 'opened', issue: created.number };
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error('GitHub token is required');
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const api = async (path, options) => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: options?.method ?? 'GET', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: options ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub request failed: HTTP ${response.status}`);
    return response.json();
  };
  console.log(JSON.stringify(await syncFeedback({ repo: process.env.GITHUB_REPOSITORY, run: event.workflow_run, api })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
