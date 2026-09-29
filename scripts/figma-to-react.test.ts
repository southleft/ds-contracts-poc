import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGenerated, dumpFromFigmaUrl, figmaToReact, reportCheck, type CheckOutcome } from './figma-to-react.js';
import type { Verdicts } from './design-consumer-verdict.js';

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

test('a relative --out (as the preview page shows) packages into that directory', async t => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'figma-to-react-cwd-')), before = process.cwd();
  t.after(() => { process.chdir(before); rmSync(cwd, { recursive: true, force: true }); });
  process.chdir(cwd);
  const result = await figmaToReact(dump, './out');
  assert.equal(readdirSync(path.join(cwd, 'out')).includes(result.tarball), true);
});

test('without a Chromium the command says NOT CHECKED, exits 0 and never prints a green check', async t => {
  const out = mkdtempSync(path.join(tmpdir(), 'figma-to-react-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const result = await figmaToReact(dump, out);
  assert.equal(result.component, 'Badge');
  assert.equal(JSON.parse(readFileSync(result.contractFile, 'utf8')).id, 'ds.badge', 'the check mounts the root contract');
  const outcome = await checkGenerated(result, dump, { chromiumPath: path.join(out, 'no-such-chromium') });
  assert.equal(outcome.status, 'not-checked');
  assert.equal(JSON.parse(readFileSync(path.join(out, 'result.json'), 'utf8')).check.status, 'not-checked');
  const report = reportCheck(result, out, outcome);
  assert.equal(report.exitCode, 0);
  assert.match(report.lines[0], /^◌ figma:to-react Badge: NOT CHECKED — no Chromium/);
  assert.equal(report.lines.some(l => l.startsWith('✔')), false);
});

test('the report: a failing variant is named with its reasons and exits 1; --allow-failures exits 0 but still says FAIL', () => {
  const variant = (key: string, verdict: 'pass' | 'fail' | 'unverified', reasons: string[] = []) => ({ key, figmaName: `Footer=${key}`, verdict, reasons,
    image: verdict === 'unverified' ? null : { white: 0.6, black: 0.8, withinLimit: true }, content: { texts: 2, textsMissing: reasons.length, textStyleMismatches: 0, parts: 1, partsMissing: 0 } });
  const verdicts = (variants: ReturnType<typeof variant>[], verdict: Verdicts['verdict'], setProblems: string[] = []): CheckOutcome => ({ status: verdict, receipt: 'check/receipt.json',
    verdicts: { verdict, variants, setProblems, counts: { pass: variants.filter(v => v.verdict === 'pass').length, fail: variants.filter(v => v.verdict === 'fail').length, unverified: variants.filter(v => v.verdict === 'unverified').length } } });
  const r = { component: 'Dialog', setName: 'Dialog', tarball: 'dialog.tgz', notes: new Array(125).fill('note') };
  const fail = verdicts([variant('No', 'fail', ['content-missing:No:text:"Dialog heading"']), variant('Yes', 'pass')], 'fail');
  const failed = reportCheck(r, 'out', fail);
  assert.equal(failed.exitCode, 1);
  assert.ok(failed.lines.some(l => /Footer=No +FAIL +0\.60% \/ 0\.80% +1\/2 text, 0\/2 text style, 0\/1 icons/.test(l)));
  assert.ok(failed.lines.some(l => /^ +- content-missing:No:text:"Dialog heading"$/.test(l)));
  assert.ok(failed.lines.some(l => l.startsWith('✖ figma:to-react Dialog: FAIL — 1 of 2 variant(s) fail')));
  assert.ok(failed.lines.some(l => l.includes('125 proposal note(s)')));
  assert.equal(failed.lines.some(l => l.startsWith('✔')), false);
  const allowed = reportCheck(r, 'out', fail, true);
  assert.equal(allowed.exitCode, 0);
  assert.ok(allowed.lines.some(l => l.startsWith('✖ figma:to-react Dialog: FAIL')));
  assert.ok(allowed.lines.includes('  --allow-failures: exiting 0; the result is still FAIL'));
  // A set problem fails the set even when every variant's own row passed.
  assert.equal(reportCheck(r, 'out', verdicts([variant('No', 'pass')], 'fail', ['variant-prop-discarded:footer'])).exitCode, 1);
  const unverified = reportCheck(r, 'out', verdicts([variant('No', 'unverified', ['figma-images-unavailable'])], 'unverified'));
  assert.equal(unverified.exitCode, 0);
  assert.ok(unverified.lines.some(l => l.startsWith('◌ figma:to-react Dialog: NOT VERIFIED')));
  assert.equal(unverified.lines.some(l => l.startsWith('✔')), false);
  const passed = reportCheck(r, 'out', verdicts([variant('No', 'pass'), variant('Yes', 'pass')], 'pass'));
  assert.equal(passed.exitCode, 0);
  assert.ok(passed.lines.some(l => l.startsWith('✔ figma:to-react Dialog: all 2 variant(s) pass the consumer check')));
});

/** A font manifest beside `dir` naming the repository's IBM Plex Sans Regular as `family`. */
function plexManifest(dir: string, family: string) {
  const font = path.join(repo, 'extract', 'computed', 'fonts', 'ibm-plex-sans', 'IBMPlexSans-Regular.woff2');
  const sha256 = createHash('sha256').update(readFileSync(font)).digest('hex'), file = path.join(dir, 'fonts.json');
  writeFileSync(file, JSON.stringify({ version: 1, fonts: [{ family, weight: '400', style: 'normal', file: font, sha256 }] }));
  return { file, sha256 };
}

test('--fonts passes an authenticated, sha256-pinned manifest to the consumer check and records the faces', async t => {
  const out = mkdtempSync(path.join(tmpdir(), 'figma-to-react-fonts-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const { file, sha256 } = plexManifest(out, 'IBM Plex Sans');
  const result = await figmaToReact(dump, path.join(out, 'run'));
  const seen: any[] = [];
  const runCheck = async (args: any) => { seen.push(args); return { verdict: { verdict: 'pass', variants: [], setProblems: [], counts: { pass: 0, fail: 0, unverified: 0 } } }; };
  await checkGenerated(result, dump, { chromiumPath: process.execPath, fonts: path.relative(process.cwd(), file), runCheck });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].fonts, file, 'the manifest reaches design:consumer:check, resolved');
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'run', 'result.json'), 'utf8')).check.fonts, [{ family: 'IBM Plex Sans', weight: '400', style: 'normal', sha256 }]);
  // Without --fonts the check gets none and says so.
  await checkGenerated(result, dump, { chromiumPath: process.execPath, runCheck });
  assert.equal(seen[1].fonts, undefined);
  assert.equal(JSON.parse(readFileSync(path.join(out, 'run', 'result.json'), 'utf8')).check.fonts, null);
});

test('a --fonts manifest that names a file as another family refuses before anything is fetched or packaged', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'figma-to-react-fonts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { file } = plexManifest(dir, 'SF Pro');
  const out = path.join(dir, 'out');
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(repo, 'scripts', 'figma-to-react.ts'), '--dump', dump, '--out', out, '--fonts', file],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, FIGMA_TOKEN: '' } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /consumer-fonts:0:family-not-declared-by-font:"SF Pro" \(the file names itself "IBM Plex Sans"\)/);
  assert.equal(existsSync(out), false, 'nothing was written');
  const missing = spawnSync(process.execPath, ['--import', 'tsx', path.join(repo, 'scripts', 'figma-to-react.ts'), '--dump', dump, '--out', out, '--fonts'],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, FIGMA_TOKEN: '' } });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--fonts <manifest\.json>/);
});
