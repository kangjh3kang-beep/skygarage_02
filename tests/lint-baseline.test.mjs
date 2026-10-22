import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSnapshot, compareSnapshots } from '../scripts/lint-baseline.mjs';

const root = '/project';
const message = (ruleId = 'rule/a', severity = 2, text = 'Existing diagnostic', line = 1) => ({ ruleId, severity, message: text, line });
const file = (name, messages) => ({ filePath: `${root}/${name}`, messages });
const snapshot = files => lintSnapshot(files, root);

test('a line move retains known debt while a new diagnostic fails the gate', () => {
  const baseline = snapshot([file('src/a.ts', [message()])]);
  assert.equal(compareSnapshots(snapshot([file('src/a.ts', [message('rule/a', 2, 'Existing diagnostic', 99)])]), baseline).regressions.length, 0);
  const result = compareSnapshots(snapshot([file('src/a.ts', [message(), message('rule/b')])]), baseline);
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].ruleId, 'rule/b');
});

test('new files and increased identical diagnostics cannot spend another file allowance', () => {
  const baseline = snapshot([file('src/a.ts', [message()])]);
  const result = compareSnapshots(snapshot([file('src/a.ts', [message(), message()]), file('src/b.ts', [message()])]), baseline);
  assert.equal(result.regressions.length, 2);
  assert.equal(result.regressions.reduce((sum, item) => sum + item.delta, 0), 2);
});

test('removed files and resolved messages are improvements, not regressions', () => {
  const baseline = snapshot([file('src/deleted.ts', [message()]), file('src/b.ts', [message('rule/b', 1)])]);
  const result = compareSnapshots(snapshot([file('src/b.ts', [])]), baseline);
  assert.equal(result.regressions.length, 0);
  assert.equal(result.resolved.reduce((sum, item) => sum + item.delta, 0), 2);
});

test('warnings and errors have separate budgets and a message change is new', () => {
  const baseline = snapshot([file('src/a.ts', [message('rule/a', 1)])]);
  const current = snapshot([file('src/a.ts', [message('rule/a', 2), message('rule/a', 1, 'Different diagnostic')])]);
  assert.equal(compareSnapshots(current, baseline).regressions.length, 2);
  assert.deepEqual(current.totals, { errors: 1, warnings: 1, fatal: 0 });
});

test('snapshots are deterministic and contain no source text or absolute paths', () => {
  const a = file('src/a.ts', [message('z'), message('a')]);
  a.source = 'PRIVATE SOURCE NOT PART OF REPORT';
  const first = snapshot([file('src/z.ts', []), a]);
  const second = snapshot([a, file('src/z.ts', [])]);
  assert.deepEqual(first, second);
  assert.doesNotMatch(JSON.stringify(first), /PRIVATE SOURCE|\/project/);
  assert.equal(first.entries[0].file, 'src/a.ts');
});

test('malformed, duplicate and out-of-root baselines fail closed', () => {
  const good = snapshot([file('src/a.ts', [message()])]);
  assert.throws(() => snapshot([{ filePath: '/elsewhere/a.ts', messages: [message()] }]), /outside/);
  assert.throws(() => compareSnapshots(good, { ...good, schemaVersion: 9 }), /schema/);
  assert.throws(() => compareSnapshots(good, { ...good, entries: [...good.entries, ...good.entries] }), /duplicate/);
  assert.throws(() => compareSnapshots(good, { ...good, entries: [{ ...good.entries[0], count: -1 }] }), /count/);
  assert.throws(() => compareSnapshots(good, { ...good, entries: [{ ...good.entries[0], file: '../secret' }] }), /path/);
});

test('baseline edits may reduce debt but cannot add or increase allowances', () => {
  const previous = snapshot([file('src/a.ts', [message(), message()])]);
  const reduced = snapshot([file('src/a.ts', [message()])]);
  assert.equal(compareSnapshots(reduced, previous).regressions.length, 0);
  assert.equal(compareSnapshots(previous, reduced).regressions[0].delta, 1);
});

test('fatal diagnostics remain visible independently of count allowances', () => {
  const fatal = { ruleId: null, severity: 2, message: 'Parsing error', fatal: true };
  const current = snapshot([file('src/a.ts', [fatal])]);
  assert.equal(current.totals.fatal, 1);
  assert.equal(current.totals.errors, 1);
});


test('compiler code frames do not leak source or make fingerprints depend on checkout path and line', () => {
  const report = (checkout, line) => [{ filePath: `${checkout}/src/a.ts`, messages: [{
    ruleId: 'react-hooks/purity', severity: 2,
    message: `Error: Cannot call impure function during render\n\nDate.now is impure.\n\n${checkout}/src/a.ts:${line}:5\n> ${line} | PRIVATE SOURCE\n     | ^^^^^ Cannot call impure function`,
  }] }];
  const baseline = lintSnapshot(report('/local/project', 5), '/local/project');
  const current = lintSnapshot(report('/home/runner/work/project/project', 123), '/home/runner/work/project/project');
  assert.deepEqual(compareSnapshots(current, baseline), { regressions: [], resolved: [] });
  assert.doesNotMatch(JSON.stringify(current), /PRIVATE SOURCE|home\/runner|:123:5/);
  assert.match(current.entries[0].message, /Date.now is impure/);
  const changed = lintSnapshot([{filePath:'/local/project/src/a.ts', messages:[message('react-hooks/purity',2,'Error: A different semantic diagnostic')]}], '/local/project');
  assert.equal(compareSnapshots(changed, baseline).regressions.length, 1);
});
