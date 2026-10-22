import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { relative, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const baselinePath = 'docs/verification/lint-baseline.json';
const fingerprint = entry => JSON.stringify([entry.file, entry.ruleId, entry.severity, entry.message, Boolean(entry.fatal)]);

function validate(snapshot) {
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.entries)) throw new Error('Invalid lint baseline schema');
  const seen = new Set();
  for (const entry of snapshot.entries) {
    if (typeof entry.file !== 'string' || !entry.file || isAbsolute(entry.file) || entry.file.includes('\\') || entry.file.split('/').includes('..')) throw new Error('Invalid lint baseline path');
    if (!Number.isSafeInteger(entry.count) || entry.count < 1) throw new Error('Invalid lint baseline count');
    if (![1, 2].includes(entry.severity) || typeof entry.message !== 'string' || !(entry.ruleId === null || typeof entry.ruleId === 'string')) throw new Error('Invalid lint diagnostic schema');
    const key = fingerprint(entry);
    if (seen.has(key)) throw new Error('Invalid duplicate lint baseline entry');
    seen.add(key);
  }
  return snapshot;
}

function diagnosticMessage(message, filePath) {
  // React compiler diagnostics embed location and source frames in message itself.
  // Keep semantic prose; checkout paths, moved lines and source excerpts are not identity.
  if (message.ruleId?.startsWith('react-hooks/')) {
    const marker = `\n\n${filePath}:`;
    const index = message.message.indexOf(marker);
    if (index >= 0 && /^\d+:\d+\r?\n/.test(message.message.slice(index + marker.length))) {
      return message.message.slice(0, index).trimEnd();
    }
  }
  return message.message;
}

export function lintSnapshot(results, root) {
  if (!Array.isArray(results)) throw new Error('Invalid ESLint report');
  const entries = new Map();
  const totals = { errors: 0, warnings: 0, fatal: 0 };
  for (const result of results) {
    const file = relative(root, result.filePath).replaceAll('\\', '/');
    if (file === '..' || file.startsWith('../') || isAbsolute(file)) throw new Error('Lint file outside repository');
    if (!Array.isArray(result.messages)) throw new Error('Invalid ESLint messages');
    for (const message of result.messages) {
      if (![1, 2].includes(message.severity)) throw new Error('Invalid ESLint severity');
      const entry = { file, ruleId: message.ruleId ?? null, severity: message.severity, message: diagnosticMessage(message, result.filePath), fatal: Boolean(message.fatal), count: 1 };
      const key = fingerprint(entry);
      if (entries.has(key)) entries.get(key).count += 1;
      else entries.set(key, entry);
      totals[entry.severity === 2 ? 'errors' : 'warnings'] += 1;
      if (entry.fatal) totals.fatal += 1;
    }
  }
  return validate({ schemaVersion: 1, totals, entries: [...entries.values()].sort((a, b) => fingerprint(a).localeCompare(fingerprint(b), 'en')) });
}

export function compareSnapshots(current, baseline) {
  validate(current); validate(baseline);
  const before = new Map(baseline.entries.map(entry => [fingerprint(entry), entry]));
  const after = new Map(current.entries.map(entry => [fingerprint(entry), entry]));
  const regressions = [];
  const resolved = [];
  for (const [key, entry] of after) {
    const delta = entry.count - (before.get(key)?.count ?? 0);
    if (delta > 0) regressions.push({ ...entry, delta });
  }
  for (const [key, entry] of before) {
    const delta = entry.count - (after.get(key)?.count ?? 0);
    if (delta > 0) resolved.push({ ...entry, delta });
  }
  return { regressions, resolved };
}

function previousBaseline(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha) || /^0+$/.test(sha)) throw new Error('Invalid LINT_BASE_SHA');
  // Missing history is an error; a missing file on a known commit is bootstrap.
  execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const file = execFileSync('git', ['ls-tree', '--name-only', sha, '--', baselinePath], { encoding: 'utf8' }).trim();
  return file ? JSON.parse(execFileSync('git', ['show', `${sha}:${baselinePath}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })) : null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--write-baseline')) throw new Error('Unknown lint gate argument');
  const root = process.cwd();
  const { ESLint } = await import('eslint');
  const current = lintSnapshot(await new ESLint({ cwd: root, overrideConfigFile: resolve(root, 'eslint.config.js') }).lintFiles(['.']), root);
  const configHash = createHash('sha256').update(await readFile('eslint.config.js')).digest('hex');
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/lint-current.json', JSON.stringify(current, null, 2) + '\n');
  if (args.includes('--write-baseline')) {
    if (process.env.CI) throw new Error('CI must not rewrite lint baseline');
    if (current.totals.fatal) throw new Error('Cannot baseline fatal lint errors');
    await writeFile(baselinePath, JSON.stringify({ ...current, configHash }, null, 2) + '\n');
    console.log(`Lint baseline written: ${current.totals.errors} errors, ${current.totals.warnings} warnings. Review every baseline change.`);
    return;
  }
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  if (baseline.configHash !== configHash) throw new Error('ESLint configuration changed; review configuration and baseline together');
  let allowanceRegressions = [];
  if (process.env.LINT_BASE_SHA) {
    const previous = previousBaseline(process.env.LINT_BASE_SHA);
    if (previous) {
      if (previous.configHash !== baseline.configHash) throw new Error('Changing lint configuration requires a separate reviewed gate migration');
      allowanceRegressions = compareSnapshots(baseline, previous).regressions;
    } else console.log('Lint baseline bootstrap: comparison commit predates the baseline. Review initial debt inventory.');
  } else if (process.env.CI) throw new Error('LINT_BASE_SHA is required in CI');
  const result = { ...compareSnapshots(current, baseline), allowanceRegressions, totals: current.totals, operationalAcceptance: false };
  await writeFile('artifacts/lint-gate.json', JSON.stringify(result, null, 2) + '\n');
  console.log(`Lint debt: ${current.totals.errors} errors, ${current.totals.warnings} warnings; new/increased diagnostics: ${result.regressions.length}; baseline increases: ${allowanceRegressions.length}; resolved fingerprints: ${result.resolved.length}.`);
  if (result.regressions.length || allowanceRegressions.length || current.totals.fatal) {
    for (const entry of [...result.regressions, ...allowanceRegressions]) console.error(`${entry.file}: ${entry.ruleId ?? 'fatal'} (+${entry.delta}) ${entry.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `\n### Lint regression gate\nExisting debt: ${current.totals.errors} errors / ${current.totals.warnings} warnings. New or increased fingerprints: ${result.regressions.length}. Baseline increases: ${allowanceRegressions.length}. Resolved fingerprints: ${result.resolved.length}. This gate does not mean lint-clean or operationally accepted.\n`, { flag: 'a' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
