import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/lint-baseline.mjs', import.meta.url));
test('CLI preserves debt, rejects new diagnostics and prevents baseline inflation against a known commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'skygarage-lint-gate-'));
  const run = (args = [], extra = {}) => {
    const env = { ...process.env, ...extra };
    if (!('CI' in extra)) delete env.CI;
    if (!('LINT_BASE_SHA' in extra)) delete env.LINT_BASE_SHA;
    delete env.GITHUB_STEP_SUMMARY;
    delete env.GITHUB_OUTPUT;
    const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  };
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    mkdirSync(join(root, 'docs/verification'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'eslint.config.js'), "export default [{ ignores: ['artifacts/**'] }, { files: ['**/*.js'], rules: { 'no-unused-vars': 'error' } }];\n");
    writeFileSync(join(root, 'source.js'), 'const oldDebt = 1;\n');
    const initial = run(['--write-baseline']);
    assert.equal(initial.status, 0, initial.stderr);
    git(['init', '-q']); git(['config', 'user.name', 'Synthetic lint test']); git(['config', 'user.email', 'lint@example.invalid']);
    git(['add', 'docs/verification/lint-baseline.json']); git(['commit', '-qm', 'fixture baseline']);
    const base = git(['rev-parse', 'HEAD']);
    const unchanged = run([], { CI: 'true', LINT_BASE_SHA: base });
    assert.equal(unchanged.status, 0, unchanged.stdout + unchanged.stderr);
    writeFileSync(join(root, 'source.js'), 'const oldDebt = 1; const newDebt = 2;\n');
    const failed = run([], { CI: 'true', LINT_BASE_SHA: base });
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    assert.match(failed.stderr, /newDebt/);
    assert.equal(run(['--write-baseline']).status, 0);
    const inflated = run([], { CI: 'true', LINT_BASE_SHA: base });
    assert.equal(inflated.status, 1);
    const evidence = JSON.parse(readFileSync(join(root, 'artifacts/lint-gate.json'), 'utf8'));
    assert.equal(evidence.allowanceRegressions.length, 1);
    assert.equal(evidence.operationalAcceptance, false);
    assert.equal(run(['--write-baseline'], { CI: 'true', LINT_BASE_SHA: base }).status, 1);
    assert.equal(run([], { CI: 'true' }).status, 1);
    assert.equal(run([], { CI: 'true', LINT_BASE_SHA: 'a'.repeat(40) }).status, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
