/**
 * `ds-contracts figma-to-react` — its flags, its refusals by name, and one run
 * of the command through the shared library (scripts/figma-to-react-lib.ts).
 * The run loads the engine through Vite here, because under tsx the engine's
 * import.meta.glob is not resolved; the built CLI's bundled engine is proven
 * by `npm run cli:figma-to-react:smoke:check` (packed, installed, compared
 * with the benchmark pin) and by vite-glob-plugin.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliUsageError } from '../src/lib.js';
import { figmaToReactCommand, nodeSupported, parseFigmaToReactArgs } from '../src/commands/figma-to-react.js';
import { viteEngine } from '../../../scripts/figma-to-react.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dump = path.join(repoRoot, 'benchmark', 'inputs', 'altitude-badge', 'dump.json');
const supported = { platform: 'linux', node: 'v20.19.4' };

test('flags: exactly one of --url and --dump, and --out', () => {
  assert.deepEqual(parseFigmaToReactArgs(['--dump', 'd.json', '--out', 'o']), { dump: 'd.json', out: 'o', name: undefined, allowFailures: false });
  assert.deepEqual(parseFigmaToReactArgs(['--url', 'https://www.figma.com/design/x', '--out', 'o', '--name', '@acme/badge', '--allow-failures']),
    { url: 'https://www.figma.com/design/x', out: 'o', name: '@acme/badge', allowFailures: true });
  assert.throws(() => parseFigmaToReactArgs(['--out', 'o']), (e: unknown) => e instanceof CliUsageError && /exactly one of --url or --dump/.test(e.message));
  assert.throws(() => parseFigmaToReactArgs(['--dump', 'd', '--url', 'u', '--out', 'o']), /exactly one of --url or --dump/);
  assert.throws(() => parseFigmaToReactArgs(['--dump', 'd']), /needs --out <dir>/);
  assert.throws(() => parseFigmaToReactArgs(['d.json', '--out', 'o']), /no positional arguments/);
  assert.throws(() => parseFigmaToReactArgs(['--dump', 'd', '--out', 'o', '--expect-request', 'r.json']), /Unknown flag "--expect-request"/);
  assert.equal(parseFigmaToReactArgs(['--dump', 'd', '--out', 'o', '--fonts', 'fonts.json']).fonts, 'fonts.json');
  assert.throws(() => parseFigmaToReactArgs(['--dump', 'd', '--out', 'o', '--fonts']), /--fonts/);
});

test('Windows and Node versions outside the consumer Vite engine range are refused before loading the engine', async () => {
  await assert.rejects(figmaToReactCommand(['--dump', dump, '--out', 'o'], { platform: 'win32', node: 'v22.12.0' }), /figma-to-react-platform-unsupported: .*macOS and Linux \(this is win32\)/);
  let engineLoads = 0;
  const loadEngine = async () => { engineLoads++; throw new Error('unsupported runtime reached the engine'); };
  for (const node of ['v18.20.0', 'v20.18.9', 'v21.7.3', 'v22.0.0', 'v22.11.0']) {
    assert.equal(nodeSupported(node), false, node);
    await assert.rejects(figmaToReactCommand(['--dump', dump, '--out', 'o'], { platform: 'darwin', node }, loadEngine),
      /figma-to-react-node-unsupported: needs Node 20\.19\+ \(20\.x\) or 22\.12\+/);
  }
  assert.equal(engineLoads, 0);
  for (const node of ['v20.19.0', 'v20.20.0', 'v22.12.0', 'v24.0.0']) assert.equal(nodeSupported(node), true, node);
});

/** A run's sandbox: a temp --out, no Chromium, the given FIGMA_TOKEN, console captured. */
function sandbox(t: test.TestContext, token?: string) {
  const out = mkdtempSync(path.join(tmpdir(), 'cli-figma-to-react-'));
  const browsers = mkdtempSync(path.join(tmpdir(), 'cli-no-browsers-'));
  const saved = { browsers: process.env.PLAYWRIGHT_BROWSERS_PATH, token: process.env.FIGMA_TOKEN, fetch: globalThis.fetch };
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  if (token === undefined) delete process.env.FIGMA_TOKEN; else process.env.FIGMA_TOKEN = token;
  const log: string[] = [], errors: string[] = [], original = { log: console.log, error: console.error };
  console.log = (line: string) => { log.push(line); };
  console.error = (line: string) => { errors.push(line); };
  const restore = () => { console.log = original.log; console.error = original.error; };
  t.after(() => {
    restore();
    globalThis.fetch = saved.fetch;
    for (const [key, value] of [['PLAYWRIGHT_BROWSERS_PATH', saved.browsers], ['FIGMA_TOKEN', saved.token]] as const)
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    rmSync(out, { recursive: true, force: true }); rmSync(browsers, { recursive: true, force: true });
  });
  return { out, log, errors, restore };
}

test('an invalid --fonts manifest refuses before a URL fetch, engine load or output write', async t => {
  const { out, restore } = sandbox(t, 'test-token-not-a-secret');
  const manifest = path.join(out, 'fonts.json'), target = path.join(out, 'run');
  writeFileSync(manifest, JSON.stringify({ version: 1, fonts: [] }));
  let fetches = 0, engineLoads = 0;
  globalThis.fetch = async () => { fetches++; throw new Error('invalid fonts reached a URL fetch'); };
  const loadEngine = async () => { engineLoads++; throw new Error('invalid fonts reached the engine'); };
  await assert.rejects(figmaToReactCommand(['--url', 'https://www.figma.com/design/example/file?node-id=1-2', '--out', target, '--fonts', manifest], supported, loadEngine),
    /consumer-fonts:invalid-manifest/);
  restore();
  assert.equal(fetches, 0);
  assert.equal(engineLoads, 0);
  assert.equal(existsSync(target), false);
});

test('--url imports through the app\'s own URL import with the token from the environment, keeps the dump and packages it', async t => {
  const { out, log, errors, restore } = sandbox(t, 'test-token-not-a-secret');
  const nodes = readFileSync(path.join(repoRoot, 'extract', 'figma', 'rest', 'fixtures', 'badge.rest.json'), 'utf8');
  const requests: Array<{ url: string; token: string | null }> = [];
  // The committed REST fixture stands in for api.figma.com; the variables
  // endpoint answers the 403 a non-Enterprise plan returns.
  globalThis.fetch = (async (input: string | URL | Request, init?: { headers?: Record<string, string> }) => {
    const url = String(input);
    requests.push({ url, token: init?.headers?.['X-Figma-Token'] ?? null });
    if (url.includes('/variables/local')) return new Response(JSON.stringify({ status: 403, err: 'Incompatible plan for this endpoint' }), { status: 403 });
    if (url.includes('/nodes?ids=')) return new Response(nodes, { status: 200 });
    return new Response(JSON.stringify({ err: 'not served by the test fixture' }), { status: 404 });
  }) as typeof fetch;
  const code = await figmaToReactCommand(['--url', 'https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC?node-id=101-1', '--out', out], supported, viteEngine);
  restore();
  assert.equal(code, 0);
  assert.ok(requests.length > 0 && requests.every(r => r.url.startsWith('https://api.figma.com/') && r.token === 'test-token-not-a-secret'), JSON.stringify(requests));
  assert.ok(JSON.parse(readFileSync(path.join(out, 'dump.json'), 'utf8'))._provenance, 'the mapped dump is kept beside the output');
  assert.equal(JSON.parse(readFileSync(path.join(out, 'result.json'), 'utf8')).rootId, 'ds.badge');
  assert.ok(errors.some(l => l.startsWith('variables: ')), 'the degraded variables read is named');
  assert.ok(log.some(l => /^◌ figma-to-react Badge: NOT CHECKED/.test(l)), log.join('\n'));
});

test('a run packages the dump, and without a Chromium says NOT CHECKED and exits 0', async t => {
  const { out, log, restore } = sandbox(t);
  const code = await figmaToReactCommand(['--dump', dump, '--out', out], supported, viteEngine);
  restore();
  assert.equal(code, 0);
  const result = JSON.parse(readFileSync(path.join(out, 'result.json'), 'utf8'));
  assert.equal(result.rootId, 'ds.badge');
  assert.equal(result.check.status, 'not-checked');
  assert.ok(log.some(l => /^◌ figma-to-react Badge: NOT CHECKED — no Chromium for the consumer check .*npx playwright-core@\d+\.\d+\.\d+ install chromium/.test(l)), log.join('\n'));
  assert.equal(log.some(l => l.startsWith('✔')), false);
});
