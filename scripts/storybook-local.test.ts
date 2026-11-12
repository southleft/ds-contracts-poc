/** scripts/storybook-local.ts: a library's own Storybook, refused by name when it has none, built with its own binary and
 *  served from its static folder. The binary here is a stand-in shell script, so no Storybook is built. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildLocalStorybook, localStorybookPreflight, serveStorybook, treeSha256 } from './storybook-local.js';

/** A library folder: .storybook/main.ts, a storybook binary that runs <script>, and package.json naming <framework>. */
function library(t: test.TestContext, framework: string, script = 'exit 0', parts = { config: true, bin: true }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'storybook-local-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (parts.config) { mkdirSync(path.join(dir, '.storybook')); writeFileSync(path.join(dir, '.storybook', 'main.ts'), 'export default {};\n'); }
  if (parts.bin) {
    mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(path.join(dir, 'node_modules', '.bin', 'storybook'), `#!/bin/sh\nOUT="$3"\n${script}\n`);
    chmodSync(path.join(dir, 'node_modules', '.bin', 'storybook'), 0o755);
  }
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { [framework]: '10.0.0' } }));
  return dir;
}

test('a library without Storybook, or with a renderer that is not React, is refused by name before anything is built', (t) => {
  assert.throws(() => localStorybookPreflight(path.join(tmpdir(), 'no-such-library-here')), /^Error: storybook-dir-missing: /);
  assert.throws(() => localStorybookPreflight(library(t, '@storybook/react-vite', 'exit 0', { config: false, bin: true })), /^Error: storybook-missing: no \.storybook\/main\.\* in /);
  assert.throws(() => localStorybookPreflight(library(t, '@storybook/react-vite', 'exit 0', { config: true, bin: false })), /^Error: storybook-missing: no storybook binary in /);
  assert.throws(() => localStorybookPreflight(library(t, '@storybook/vue3-vite')), /^Error: storybook-renderer-not-react: .* \(@storybook\/vue3-vite\)$/);
  const dir = library(t, '@storybook/nextjs');
  assert.equal(localStorybookPreflight(dir).bin, path.join(dir, 'node_modules', '.bin', 'storybook'));
});

test('the build runs the library\'s own binary; a failed build and a build with no index.json are refused by name', (t) => {
  const failed = library(t, '@storybook/react-vite', 'echo broken >&2; exit 1');
  assert.throws(() => buildLocalStorybook(failed, path.join(failed, 'out')), /^Error: storybook-build-failed: exit 1 \(log .*out\.build\.log\)$/);
  const old = library(t, '@storybook/react-vite', 'mkdir -p "$OUT"; echo "{}" > "$OUT/stories.json"');
  assert.throws(() => buildLocalStorybook(old, path.join(old, 'out')), /^Error: storybook-index-missing: .* has no index\.json/);
  const ok = library(t, '@storybook/react-vite', 'mkdir -p "$OUT/sb-addons"; echo \'{"entries":{}}\' > "$OUT/index.json"; echo "<p>" > "$OUT/iframe.html"');
  const built = buildLocalStorybook(ok, path.join(ok, 'out'));
  assert.equal(built.sha256, treeSha256(path.join(ok, 'out')));
  assert.throws(() => buildLocalStorybook(ok, path.join(ok, 'out')), /^Error: storybook-out-exists: /);
});

const get = (port: number, rawPath: string) => new Promise<{ status: number; type: string; body: string }>((resolve, reject) => {
  request({ host: '127.0.0.1', port, path: rawPath }, (res) => {
    let body = ''; res.on('data', (d) => { body += d; });
    res.on('end', () => resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), body }));
  }).on('error', reject).end();
});

test('the static folder is served on the fixed port; a path outside it is a 404; a held port is refused by name', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'storybook-static-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'static'));
  writeFileSync(path.join(root, 'static', 'index.json'), '{"entries":{}}');
  writeFileSync(path.join(root, 'static', 'index.html'), '<p>');
  writeFileSync(path.join(root, 'secret.txt'), 'outside');
  const port = 61160, served = await serveStorybook(path.join(root, 'static'), port);
  t.after(() => served.close());
  assert.equal(served.url, `http://localhost:${port}/`);
  assert.deepEqual(await get(port, '/index.json'), { status: 200, type: 'application/json', body: '{"entries":{}}' });
  assert.equal((await get(port, '/')).body, '<p>');
  assert.equal((await get(port, '/%2e%2e/secret.txt')).status, 404);
  assert.equal((await get(port, '/missing.js')).status, 404);
  await assert.rejects(serveStorybook(path.join(root, 'static'), port), /^Error: storybook-port-busy: 127\.0\.0\.1:61160 \(EADDRINUSE\)$/);
});
