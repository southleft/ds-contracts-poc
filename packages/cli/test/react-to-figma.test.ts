/** `ds-contracts react-to-figma`: its flags, its refusals by name, the order it runs the bundled steps in (with stand-ins
 *  for the Storybook build and the two steps, so no Docker runs here), and one line per component from a made-up report. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CliUsageError } from '../src/lib.js';
import { parseReactToFigmaArgs, reactToFigmaCommand, reportLines, type ReactToFigmaSteps } from '../src/commands/react-to-figma.js';

const report = {
  refused: [{ subject: 'Layout/Grid', reason: 'grammar-out:layout-grid' }],
  components: [
    { subject: 'Forms/Date picker', captured: '4 of 4', setName: 'DatePicker', variants: 4, contract: 'storybook.date-picker', refusals: [] },
    { subject: 'Forms/Toggle', captured: '2 of 2', setName: 'Toggle', variants: null, refusals: ['per-variant-text-unqualified: root: not-drawn-in-every-variant'] },
    { subject: 'Overlays/Popover', captured: '0 of 3', refusals: ['capture-empty: overlays-popover--default'] }],
};

test('flags: --out is required, the current directory is the default library, a URL replaces it, an unknown flag is refused', () => {
  assert.deepEqual(parseReactToFigmaArgs(['--out', 'o']), { out: 'o', storybookDir: '.' });
  assert.deepEqual(parseReactToFigmaArgs(['--out', 'o', '--storybook', 'http://localhost:6006/', '--profile', 'p.json', '--file-key', 'Ab12']),
    { out: 'o', storybook: 'http://localhost:6006/', profile: 'p.json', fileKey: 'Ab12' });
  assert.throws(() => parseReactToFigmaArgs([]), (e: unknown) => e instanceof CliUsageError && /needs --out/.test(e.message));
  assert.throws(() => parseReactToFigmaArgs(['--out', 'o', '--storybook-dir', '.', '--storybook', 'u']), /not both/);
  assert.throws(() => parseReactToFigmaArgs(['--out', 'o', '--file-key', 'a/b']), /--file-key is a Figma file key/);
  assert.throws(() => parseReactToFigmaArgs(['--out', 'o', '--pinned']), /Unknown flag "--pinned"/);
});

test('one line per component: written with its set and variants, refusals beside it named, refused ones with every reason', () => {
  assert.deepEqual(reportLines(report, 'KEY1'), [
    '✔ DatePicker (Forms/Date picker): 4 variant(s), captured 4 of 4',
    '✔ Toggle (Forms/Toggle): 1 variant(s), captured 2 of 2; 1 refusal(s): per-variant-text-unqualified: root: not-drawn-in-every-variant',
    '✖ Overlays/Popover: capture-empty: overlays-popover--default',
    '✖ Layout/Grid: grammar-out:layout-grid',
    '2 of 4 component(s) written as Figma programs for file KEY1; 2 refused']);
  assert.match(reportLines(report).at(-1)!, /written as contracts \(add --file-key to build the Figma programs\)/);
});

function sandbox(t: test.TestContext) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cli-react-to-figma-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const calls: Array<[string, string[]]> = [], log: string[] = [];
  let stopped = 0;
  const steps: ReactToFigmaSteps = {
    async storybook(lib, out) { calls.push(['storybook', [lib, out]]); return { url: 'http://localhost:6116/', sha256: 'f'.repeat(64), stop: () => { stopped++; } }; },
    step(script, args) {
      calls.push([script, args]);
      if (script === 'storybook-contracts.js') {
        const out = args[args.indexOf('--out') + 1]!;
        mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, 'storybook-contracts.json'), JSON.stringify(report));
      }
      return { status: 0, output: script === 'storybook-reader.js' ? '3 component(s), 0 excluded by profile, 9 stories: 3 in grammar\n' : '' };
    },
  };
  return { dir, calls, log, steps, stopped: () => stopped };
}

test('a run builds and serves the library\'s Storybook, reads it, writes contracts and programs, reports, and stops the server', async (t) => {
  const s = sandbox(t), out = path.join(s.dir, 'run'), profile = path.join(s.dir, 'profile.json');
  writeFileSync(profile, JSON.stringify({ components: [{ name: 'DatePicker' }, { name: 'Toggle' }] }));
  assert.equal(await reactToFigmaCommand(['--out', out, '--storybook-dir', s.dir, '--profile', profile, '--file-key', 'KEY1'], s.steps, (l) => s.log.push(l)), 0);
  assert.deepEqual(s.calls.map(([name]) => name), ['storybook', 'storybook-reader.js', 'storybook-contracts.js']);
  assert.deepEqual(s.calls[1]![1], ['--storybook', 'http://localhost:6116/', '--out', path.join(out, 'reader'), '--profile', profile, '--only', path.join(out, 'only.json')]);
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'only.json'), 'utf8')), ['DatePicker', 'Toggle'], 'with a profile, every declared component is read');
  assert.deepEqual(s.calls[2]![1].slice(-2), ['--file-key', 'KEY1']);
  assert.ok(s.log.includes('✖ Layout/Grid: grammar-out:layout-grid') && s.log.some((l) => l.startsWith('2 of 4 component(s)')), s.log.join('\n'));
  assert.equal(s.stopped(), 1);
});

test('refused by name: a folder in use, a missing profile, a reader that fails (server still stopped), a contract step with no report', async (t) => {
  const s = sandbox(t), used = path.join(s.dir, 'used');
  mkdirSync(used); writeFileSync(path.join(used, 'x'), '');
  await assert.rejects(reactToFigmaCommand(['--out', used], s.steps), /^Error: react-to-figma-out-not-empty: /);
  await assert.rejects(reactToFigmaCommand(['--out', path.join(s.dir, 'a'), '--profile', path.join(s.dir, 'none.json')], s.steps), /^Error: react-to-figma-file-missing: --profile /);
  const failing: ReactToFigmaSteps = { ...s.steps, step: (script) => ({ status: script === 'storybook-reader.js' ? 1 : 0, output: 'storybook-missing: no .storybook/main.* in /lib\n' }) };
  await assert.rejects(reactToFigmaCommand(['--out', path.join(s.dir, 'b')], failing), /^Error: react-to-figma-reader-failed: exit 1: storybook-missing: no \.storybook\/main\.\* in \/lib \(log .*reader\.log\)$/);
  assert.equal(s.stopped(), 1);
  const silent: ReactToFigmaSteps = { ...s.steps, step: () => ({ status: 1, output: '' }) };
  const failingContracts: ReactToFigmaSteps = { ...silent, step: (script, args) => script === 'storybook-reader.js' ? { status: 0, output: '' } : silent.step(script, args) };
  await assert.rejects(reactToFigmaCommand(['--out', path.join(s.dir, 'c'), '--storybook', 'http://localhost:6006/'], failingContracts), /^Error: react-to-figma-contracts-failed: exit 1, no report/);
  assert.equal(existsSync(path.join(s.dir, 'c', 'reader.log')), true);
});
