import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dumpFromFigmaUrl, figmaToReact } from './figma-to-react.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dump = path.join(repo, 'benchmark', 'inputs', 'altitude-badge', 'dump.json');

test('a user-chosen package name reaches the packed package.json; an invalid one refuses by name', async t => {
  const out = mkdtempSync(path.join(tmpdir(), 'figma-to-react-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const result = await figmaToReact(dump, out, undefined, 'json', { packageName: '@acme/badge' });
  assert.equal(result.setName, 'Badge');
  const pkg = JSON.parse(execFileSync('tar', ['-xzOf', path.join(out, result.tarball), 'package/package.json'], { encoding: 'utf8' }));
  assert.equal(pkg.name, '@acme/badge');
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'request.json'), 'utf8')).rootId, 'ds.badge');
  await assert.rejects(figmaToReact(dump, path.join(out, 'bad'), undefined, 'json', { packageName: 'Bad Name' }), /react-library-package-name-invalid/);
  assert.equal(readdirSync(out).some(f => f.endsWith('.tgz')), true);
});

test('a URL import reads its token from the environment only', async t => {
  const saved = process.env.FIGMA_TOKEN;
  delete process.env.FIGMA_TOKEN;
  t.after(() => { if (saved !== undefined) process.env.FIGMA_TOKEN = saved; });
  await assert.rejects(dumpFromFigmaUrl('https://www.figma.com/design/AAAAAAAAAAAAAAAAAAAAAA/x?node-id=1-2', tmpdir()), /figma-to-react-token-missing/);
});

test('a recorded request that differs refuses before anything is packaged', async t => {
  const out = mkdtempSync(path.join(tmpdir(), 'figma-to-react-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const expected = path.join(out, 'expected.json');
  execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(expected)}, JSON.stringify({ rootId: 'other', contracts: [], tokens: {}, icons: [] }))`]);
  await assert.rejects(figmaToReact(dump, path.join(out, 'run'), expected), /figma-to-react-request-differs: rootId, contracts/);
});
