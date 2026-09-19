import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactLibrary, createReactLibraryService, parseLibraryRequest } from './react-library.js';
import { reactLibraryFamily } from '../src/engine/react-library.js';
import { ContractSchema } from '../../scripts/contract-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const child = { id: 'test.leaf', name: 'Leaf', version: '1.0.0', status: 'draft', description: 'Library packaging fixture', bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: './Leaf', export: 'Leaf' } } }, semantics: { element: 'span' }, props: [], states: [], anatomy: { root: { text: 'Packaged child', tokens: { color: '{color.ink}' } } }, a11y: {} };
const parent = { ...child, id: 'test.panel', name: 'Panel', semantics: { element: 'section' }, anatomy: { root: { parts: { content: { component: { id: child.id } } } } } };
const request = () => ({ rootId: parent.id, contracts: [parent, child], tokens: { primitives: {}, semantic: { color: { ink: { $type: 'color', $value: '#123456' } } }, light: {}, dark: {}, brands: {} }, icons: [] });

test('the download family uses dependency identity and refuses unsafe or incomplete inputs before writing', () => {
  const input = parseLibraryRequest(request());
  assert.equal(input.root.id, parent.id);
  assert.deepEqual(reactLibraryFamily(input.root, new Map(input.contracts.map(c => [c.id, c]))).map(c => c.id), [parent.id, child.id]);
  assert.throws(() => reactLibraryFamily(input.root, new Map()), /dependency-missing/);
  assert.throws(() => parseLibraryRequest({ ...request(), contracts: [parent] }), /dependency-missing/);
  assert.throws(() => parseLibraryRequest({ ...request(), contracts: [parent, child, { ...child, id: 'test.duplicate' }] }), /duplicate-component/);
  assert.throws(() => parseLibraryRequest({ ...request(), contracts: [{ ...parent, name: '../Outside' }, child] }), /invalid-component-name/);
  assert.throws(() => parseLibraryRequest({ ...request(), outDir: '/tmp/escape' }), /invalid-request/);
  assert.throws(() => parseLibraryRequest({ ...request(), icons: [['../../escape', '<svg/>']] }), /invalid-icon/);
  assert.throws(() => parseLibraryRequest({ ...request(), tokens: JSON.parse('{"__proto__":{"polluted":true}}') }), /unsafe-data-key/);
  assert.throws(() => parseLibraryRequest({ ...request(), contracts: [parent, child, { ...child, id: 'test.extra', name: 'Unrelated' }] }), /unrelated-components/);
  assert.throws(() => parseLibraryRequest({ ...request(), contracts: Array.from({ length: 31 }, () => child) }), /family-limit/);
  assert.equal(({} as any).polluted, undefined);
});

test('the local download route refuses cross-origin, hostile Host, non-JSON and concurrent requests without running the builder', async () => {
  let calls = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const service = createReactLibraryService(ROOT, async () => {
    calls++; await gate;
    return { name: '@test/lib', tarball: '/unused', tarballSha256: 'a'.repeat(64), dist: '/unused', bytes: Buffer.from('test'), filename: 'library.tgz' };
  });
  const server = createServer((req, res) => { void service(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify(request()) };
  try {
    assert.equal((await fetch(url, { ...options, headers: { ...options.headers, Origin: 'https://foreign.invalid' } })).status, 403);
    assert.equal(await new Promise<number>(resolve => { const req = httpRequest(url, { method: 'POST', headers: { Host: 'foreign.invalid', 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode!); }); req.end(JSON.stringify(request())); }), 403);
    assert.equal((await fetch(url, { ...options, headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await fetch(url, { ...options, body: '{}' })).status, 400);
    assert.equal((await fetch(url, { ...options, body: ' '.repeat(5 * 1024 * 1024 + 1) })).status, 413);
    assert.equal(calls, 0);
    const first = fetch(url, options);
    for (let i = 0; i < 100 && !calls; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(calls, 1, 'the validated request reached the builder');
    assert.equal((await fetch(url, options)).status, 409);
    release();
    const response = await first;
    assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="library.tgz"');
    assert.equal(await response.text(), 'test'); assert.equal(calls, 1);
  } finally { release(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('a downloaded composed library installs and bundles in a clean consumer with its child, CSS, tokens and prop declarations', async () => {
  const work = mkdtempSync(path.join(tmpdir(), 'react-library-consumer-'));
  try {
    // Only the packaging tools resolve host dependencies; the consumer installs
    // the tarball and React into its own node_modules, with no source aliases.
    const host = path.join(work, 'host'); mkdirSync(host); symlinkSync(path.join(ROOT, 'node_modules'), path.join(host, 'node_modules'));
    const result = await buildReactLibrary(host, parseLibraryRequest(request()));
    const entries = execFileSync('tar', ['-tzf', result.tarball], { encoding: 'utf8' });
    assert.match(entries, /dist\/Leaf\/Leaf\.js/); assert.match(entries, /dist\/Panel\/Panel\.d\.ts/); assert.match(entries, /dist\/tokens\.css/);
    assert.doesNotMatch(entries, /\.tsx|tsconfig|node_modules/); assert.match(entries, /package\/README.md/);
    const consumer = path.join(work, 'consumer'); mkdirSync(consumer);
    const version = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/react/package.json'), 'utf8')).version;
    writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, dependencies: { react: version, 'react-dom': version, [result.name]: `file:${result.tarball}` } }));
    execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumer, stdio: 'pipe', timeout: 120_000 });
    writeFileSync(path.join(consumer, 'main.jsx'), `import { Panel } from ${JSON.stringify(result.name)}; import { renderToStaticMarkup } from 'react-dom/server'; console.log(renderToStaticMarkup(<Panel/>));`);
    execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), ['main.jsx', '--bundle', '--platform=node', '--format=cjs', '--jsx=automatic', '--outfile=app.cjs'], { cwd: consumer, stdio: 'pipe' });
    const html = execFileSync(process.execPath, ['app.cjs'], { cwd: consumer, encoding: 'utf8' });
    assert.match(html, /<section/); assert.match(html, /Packaged child/);
    const css = readFileSync(path.join(consumer, 'app.css'), 'utf8');
    assert.match(css, /--color-ink:\s*#123456/); assert.match(css, /var\(--color-ink\)/);
    const installed = path.join(consumer, 'node_modules', result.name, 'dist/Panel/Panel.d.ts');
    assert.match(readFileSync(installed, 'utf8'), /PanelProps/);
    assert.ok(!readFileSync(path.join(consumer, 'app.cjs'), 'utf8').includes(ROOT), 'consumer bundle contains no host source path');
    assert.deepEqual(ContractSchema.parse(parent).name, 'Panel');
  } finally { rmSync(work, { recursive: true, force: true }); }
});
