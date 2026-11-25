/** `ds-contracts react-to-figma`: its flags, its refusals by name, the order it runs the bundled steps in (with stand-ins
 *  for the Storybook build and the two steps, so no Docker runs here), and one line per component from a made-up report. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CliUsageError } from '../src/lib.js';
import { parseReactToFigmaArgs, reactToFigmaCommand, reportLines, type ReactToFigmaSteps } from '../src/commands/react-to-figma.js';
import { servePrograms, wrap, type ServedSet } from '../src/commands/react-to-figma-serve.js';
import { bundledProfiles, resolveProfileArg } from '../src/profile-arg.js';

const report = {
  refused: [{ subject: 'Layout/Grid', reason: 'grammar-out:layout-grid' }],
  components: [
    { subject: 'Forms/Date picker', captured: '4 of 4', setName: 'DatePicker', variants: 4, contract: 'storybook.date-picker', refusals: [] },
    { subject: 'Forms/Toggle', captured: '2 of 2', setName: 'Toggle', variants: null, contract: 'storybook.toggle', refusals: ['per-variant-text-unqualified: root: not-drawn-in-every-variant'] },
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
  assert.equal(parseReactToFigmaArgs(['--out', 'o', '--file-key', 'K1', '--write']).write, true);
  assert.throws(() => parseReactToFigmaArgs(['--out', 'o', '--write']), /--write needs --file-key/);
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
  const calls: Array<[string, string[]]> = [], log: string[] = [], served: ServedSet[][] = [];
  let stopped = 0;
  const steps: ReactToFigmaSteps = {
    async storybook(lib, out) { calls.push(['storybook', [lib, out]]); return { url: 'http://localhost:6116/', sha256: 'f'.repeat(64), stop: () => { stopped++; } }; },
    step(script, args) {
      calls.push([script, args]);
      if (script === 'storybook-contracts.js') {
        const out = args[args.indexOf('--out') + 1]!;
        mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, 'storybook-contracts.json'), JSON.stringify(report));
      }
      if (script === 'storybook-contracts.js' && args.includes('--file-key')) {
        const out = args[args.indexOf('--out') + 1]!; mkdirSync(path.join(out, 'figma'), { recursive: true });
        for (const f of ['date-picker', 'toggle']) for (const part of ['1-variables', '2-component']) writeFileSync(path.join(out, 'figma', `${f}.${part}.js`), `// ${f} ${part}`);
      }
      return { status: 0, output: script === 'storybook-reader.js' ? '3 component(s), 0 excluded by profile, 9 stories: 3 in grammar\n' : '' };
    },
    async serve(sets) { served.push(sets); return sets.map((x) => x.name === 'Toggle' ? { name: x.name, written: false as const, error: 'GUARD: not the run file' } : { name: x.name, written: true as const, nodes: 5 }); },
  };
  return { dir, calls, log, steps, served, stopped: () => stopped };
}

test('--profile: a bundled name or a file; a setup path resolves beside the profile, then here, or the run is refused before any step', async (t) => {
  const s = sandbox(t), dist = path.join(s.dir, 'dist'), bundled = path.join(dist, 'profiles', 'demo');
  mkdirSync(path.join(bundled, 'cfg'), { recursive: true });
  writeFileSync(path.join(bundled, 'profile.json'), JSON.stringify({ setup: { captureConfig: 'cfg/c.json' }, components: [{ name: 'A' }] }));
  writeFileSync(path.join(bundled, 'cfg', 'c.json'), '{}');
  assert.equal(resolveProfileArg('demo', dist), path.join(bundled, 'profile.json'));
  assert.deepEqual(bundledProfiles(dist), ['demo']);
  assert.equal(resolveProfileArg('nope', dist), undefined);
  const broken = path.join(s.dir, 'broken.json');
  writeFileSync(broken, JSON.stringify({ setup: { captureConfig: 'no/such.json' }, components: [{ name: 'A' }] }));
  assert.throws(() => resolveProfileArg(broken, dist), /^Error: profile-setup-file-missing:captureConfig: no\/such\.json /);
  await assert.rejects(reactToFigmaCommand(['--out', path.join(s.dir, 'd'), '--storybook', 'http://localhost:6006/', '--profile', broken], s.steps), /^Error: profile-setup-file-missing:captureConfig: /);
  assert.equal(s.calls.length, 0, 'refused before any step');
  assert.equal(existsSync(path.join(s.dir, 'd')), false, 'nothing written');
});

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

test('--write serves each written set\'s two programs after the Storybook is stopped, files the outcomes, and exits 1 when a set failed', async (t) => {
  const s = sandbox(t), out = path.join(s.dir, 'run');
  assert.equal(await reactToFigmaCommand(['--out', out, '--storybook-dir', s.dir, '--file-key', 'KEY1', '--write'], s.steps, (l) => s.log.push(l)), 1);
  assert.deepEqual(s.served[0], [{ name: 'DatePicker', tokens: '// date-picker 1-variables', component: '// date-picker 2-component' },
    { name: 'Toggle', tokens: '// toggle 1-variables', component: '// toggle 2-component' }]);
  assert.equal(s.stopped(), 1, 'the Storybook server stops before serving, and only once');
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'figma-write.json'), 'utf8')).sets.map((o: { written: boolean }) => o.written), [true, false]);
  assert.equal(s.log.at(-1), '1 of 2 set(s) written into Figma file KEY1; 1 failed, each named above');
});

test('the server speaks the runner\'s protocol: the pinned driver, one claim, guarded programs in order, a failed tokens program skips its set', async () => {
  const port = 61190, base = `http://127.0.0.1:${port}`, log: string[] = [];
  const sets = [{ name: 'A', tokens: 'tokA', component: 'compA' }, { name: 'B', tokens: 'tokB', component: 'compB' }];
  const outcomes = servePrograms(sets, 'KEY1', '// the pinned driver', { port, log: (l) => log.push(l) });
  await new Promise((r) => setTimeout(r, 50));
  const get = async (p: string, init?: RequestInit) => (await fetch(base + p, init)).json() as Promise<Record<string, any>>;
  assert.deepEqual(await get('/driver'), { driver: '// the pinned driver' });
  const { session } = await get('/claim', { method: 'POST' });
  assert.deepEqual(await get('/claim', { method: 'POST' }), { refused: 'a driver already holds this run' });
  const ran: string[] = [];
  for (;;) {
    const step = await get(`/next?session=${session}`);
    if (step.done) { assert.deepEqual(step, { done: true, ok: false, summary: '1 of 2 set(s) written; each failure is named in the terminal' }); break; }
    ran.push(step.id);
    assert.equal(step.program, wrap('KEY1', step.id.startsWith('tokens') ? `tok${step.id.slice(-1)}` : `comp${step.id.slice(-1)}`));
    const result = step.id === 'tokens:B' ? { id: step.id, error: 'WRONG FILE: expected KEY1' } : { id: step.id, value: { fileKey: 'KEY1', value: { createdNodeIds: ['1:1', '1:2'] } } };
    assert.deepEqual(await get(`/result?session=${session}`, { method: 'POST', body: JSON.stringify(result) }), { ok: true });
  }
  assert.deepEqual(ran, ['tokens:A', 'component:A', 'tokens:B']);
  assert.deepEqual(await outcomes, [{ name: 'A', written: true, nodes: 2 }, { name: 'B', written: false, error: 'WRONG FILE: expected KEY1' }]);
  assert.match(wrap('KEY1', 'x'), /^if \(typeof figma\.fileKey !== 'string' \|\| figma\.fileKey !== "KEY1"\) throw new Error\('GUARD: not the run file'\);\nglobalThis\.DS_CREATE_ONLY = true;/);
  assert.ok(log.includes('  ✖ B: WRONG FILE: expected KEY1'), log.join('\n'));
});
