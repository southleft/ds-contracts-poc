import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactLibrary, createReactLibraryService, parseLibraryRequest } from './react-library.js';
import { readPreparedReactLibrary, retainPreparedReactLibrary } from './react-library-artifact.js';
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
  const work = mkdtempSync(path.join(tmpdir(), 'react-library-route-'));
  let service = createReactLibraryService(work, async () => {
    calls++; await gate;
    return { name: '@test/lib', tarball: '/unused', tarballSha256: createHash('sha256').update('test').digest('hex'), dist: '/unused', bytes: Buffer.from('test'), filename: 'library.tgz' };
  });
  const server = createServer((req, res) => { void service(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const url = origin + '/api/react-library';
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(request()) };
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
    assert.equal(response.status, 200);
    const artifact = await response.json();
    assert.match(artifact.downloadUrl, /^\/api\/react-library\/download\/[a-f0-9-]+$/);
    // A new service has no old in-memory state. The exact retained URL must
    // still download its original bytes without rebuilding the library.
    service = createReactLibraryService(work, async () => { throw Error('unexpected rebuild'); });
    const archive = await fetch(origin + artifact.downloadUrl);
    assert.equal(archive.headers.get('Content-Disposition'), 'attachment; filename="library.tgz"');
    assert.equal(await archive.text(), 'test'); assert.equal(calls, 1);
    const stored = readPreparedReactLibrary(work, artifact.artifactId);
    assert.deepEqual(stored.input, parseLibraryRequest(request()));
    writeFileSync(path.join(work, 'private/react-library-artifacts', artifact.artifactId, 'library.tgz'), 'changed');
    const corrupted = await fetch(origin + artifact.downloadUrl);
    assert.equal(corrupted.status, 409);
    assert.equal((await corrupted.json()).error, 'react-library-artifact-archive-changed');
    assert.equal((await fetch(origin + artifact.downloadUrl, { headers: { Origin: 'https://foreign.invalid' } })).status, 403);
    assert.equal((await fetch(origin + '/api/react-library/download/ffffffff-ffff-ffff-ffff-ffffffffffff')).status, 404);
  } finally { release(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(work, { recursive: true, force: true }); }
});

test('a downloaded composed library installs and bundles in a clean consumer with its child, CSS, tokens and prop declarations', async () => {
  const work = mkdtempSync(path.join(tmpdir(), 'react-library-consumer-'));
  try {
    // Only the packaging tools resolve host dependencies; the consumer installs
    // the tarball and React into its own node_modules, with no source aliases.
    const host = path.join(work, 'host'); mkdirSync(host); symlinkSync(path.join(ROOT, 'node_modules'), path.join(host, 'node_modules'));
    const result = await buildReactLibrary(host, parseLibraryRequest(request()));
    const retained = retainPreparedReactLibrary(host, parseLibraryRequest(request()), result);
    assert.ok(readPreparedReactLibrary(host, retained.id).bytes.equals(result.bytes));
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

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const storedOutput = (text = 'synthetic archive') => ({bytes:Buffer.from(text),tarballSha256:hash(text),filename:'library.tgz',name:'@test/library'});

test('retained libraries preserve original source facts, reuse exact bytes and survive more than ten later artifacts', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'react-library-retained-'));
  try {
    const data = structuredClone(request());
    data.contracts[0].bindings.figma.anchors = {fileKey:'source-file',componentSetKey:'original-source-key'} as any;
    const input = parseLibraryRequest(data), output = storedOutput();
    const a = retainPreparedReactLibrary(work,input,output);
    const dir = path.join(work,'private/react-library-artifacts',a.id);
    const before = Object.fromEntries(readdirSync(dir).map(name=>[name,{bytes:hash(readFileSync(path.join(dir,name))),mtime:statSync(path.join(dir,name)).mtimeMs,ino:statSync(path.join(dir,name)).ino}]));
    const repeat = retainPreparedReactLibrary(work,input,output);
    assert.equal(a.id,repeat.id);
    assert.deepEqual(Object.fromEntries(readdirSync(dir).map(name=>[name,{bytes:hash(readFileSync(path.join(dir,name))),mtime:statSync(path.join(dir,name)).mtimeMs,ino:statSync(path.join(dir,name)).ino}])),before);
    assert.deepEqual(repeat.input,input);
    assert.equal(repeat.receipt.kind,'prepared-contract-library');
    for(let i=0;i<11;i++)retainPreparedReactLibrary(work,input,storedOutput('later-'+i));
    assert.ok(readPreparedReactLibrary(work,a.id).bytes.equals(output.bytes));
    assert.equal(readPreparedReactLibrary(work,a.id).input.contracts[0].bindings.figma.anchors.componentSetKey,'original-source-key');
  } finally {rmSync(work,{recursive:true,force:true});}
});

test('receipt, input and archive tampering refuse without replacing the evidence', () => {
  for(const [member,code] of [['receipt.json','receipt-changed'],['input.json','input-changed'],['library.tgz','archive-changed']]) {
    const work=mkdtempSync(path.join(tmpdir(),'react-library-tamper-'));
    try {
      const input=parseLibraryRequest(request()),out=storedOutput(),saved=retainPreparedReactLibrary(work,input,out);
      const file=path.join(work,'private/react-library-artifacts',saved.id,member);
      const changed=Buffer.concat([readFileSync(file),Buffer.from('\nchanged')]);writeFileSync(file,changed);
      assert.throws(()=>readPreparedReactLibrary(work,saved.id),new RegExp(code));
      assert.throws(()=>retainPreparedReactLibrary(work,input,out),/existing-member-changed/);
      assert.ok(readFileSync(file).equals(changed));
    } finally {rmSync(work,{recursive:true,force:true});}
  }
});

test('an interrupted publication resumes only matching members and never replaces a changed partial artifact', () => {
  const work=mkdtempSync(path.join(tmpdir(),'react-library-interrupt-'));
  try {
    const input=parseLibraryRequest(request()),out=storedOutput(),saved=retainPreparedReactLibrary(work,input,out);
    const dir=path.join(work,'private/react-library-artifacts',saved.id),file=path.join(dir,'input.json');
    const original=readFileSync(file),inode=statSync(file).ino;
    // Only this test's temporary files are removed to model interruption.
    rmSync(path.join(dir,'receipt.json'));rmSync(path.join(dir,'library.tgz'));
    assert.throws(()=>readPreparedReactLibrary(work,saved.id),/not-found/);
    assert.equal(retainPreparedReactLibrary(work,input,out).id,saved.id);
    assert.equal(statSync(file).ino,inode);assert.ok(readFileSync(file).equals(original));
    rmSync(path.join(dir,'receipt.json'));rmSync(path.join(dir,'library.tgz'));writeFileSync(file,'changed');
    assert.throws(()=>retainPreparedReactLibrary(work,input,out),/existing-member-changed/);
    assert.equal(existsSync(path.join(dir,'receipt.json')),false);assert.equal(existsSync(path.join(dir,'library.tgz')),false);
    assert.equal(readFileSync(file,'utf8'),'changed');
  } finally {rmSync(work,{recursive:true,force:true});}
});

test('artifact paths and members refuse symlinks, traversal and mismatched output before publication', () => {
  for(const target of ['store','artifact','input.json','library.tgz','receipt.json','dangling']) {
    const work=mkdtempSync(path.join(tmpdir(),'react-library-path-'));
    const outside=mkdtempSync(path.join(tmpdir(),'react-library-outside-'));
    try {
      const input=parseLibraryRequest(request()),out=storedOutput(),saved=retainPreparedReactLibrary(work,input,out);
      const store=path.join(work,'private/react-library-artifacts'),dir=path.join(store,saved.id);
      const victim=target==='store'?store:target==='artifact'?dir:path.join(dir,target==='dangling'?'library.tgz':target);
      rmSync(victim,{recursive:true,force:true});
      const link=target==='store'||target==='artifact'?outside:path.join(outside,'foreign');
      if(target!=='dangling'&&target!=='store'&&target!=='artifact')writeFileSync(link,'foreign');
      symlinkSync(link,victim);
      assert.throws(()=>readPreparedReactLibrary(work,saved.id),/unsafe-path/);
      assert.throws(()=>retainPreparedReactLibrary(work,input,out),/unsafe-path/);
      assert.deepEqual(readdirSync(outside),target==='store'||target==='artifact'||target==='dangling'?[]:['foreign']);
      assert.throws(()=>readPreparedReactLibrary(work,'../../outside'),/not-found/);
    } finally {rmSync(work,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
  }
  const work=mkdtempSync(path.join(tmpdir(),'react-library-unpublished-'));
  try {
    assert.throws(()=>retainPreparedReactLibrary(work,parseLibraryRequest(request()),{...storedOutput(),tarballSha256:'a'.repeat(64)}),/archive-changed/);
    assert.equal(existsSync(path.join(work,'private')),false);
  } finally {rmSync(work,{recursive:true,force:true});}
});

test('non-regular artifact members refuse without blocking the local service', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'react-library-fifo-'));
  try {
    for (const member of ['receipt.json', 'library.tgz']) {
      const saved = retainPreparedReactLibrary(work, parseLibraryRequest(request()), storedOutput(member));
      const file = path.join(work, 'private/react-library-artifacts', saved.id, member);
      rmSync(file);
      execFileSync('mkfifo', [file]);
      // Run in a bounded child: a regression must fail rather than hang the
      // entire test process before the regular-file check is reached.
      const script = `import assert from 'node:assert/strict';
        import {readPreparedReactLibrary} from ${JSON.stringify(new URL('./react-library-artifact.ts', import.meta.url).href)};
        assert.throws(() => readPreparedReactLibrary(${JSON.stringify(work)}, ${JSON.stringify(saved.id)}), /invalid-file/);`;
      execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: ROOT, timeout: 5000, stdio: 'pipe' });
      assert.equal(statSync(file).isFIFO(), true, 'the refused member remains intact');
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});
