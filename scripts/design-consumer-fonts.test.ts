import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { consumerFontManifest, loadConsumerFonts, readConsumerFonts, writeConsumerFonts } from './design-consumer-fonts.js';

const fixtureBytes = readFileSync(new URL('../extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2', import.meta.url));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function fixture(t: { after(fn: () => void): void }, change: (v: any) => void = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'consumer-fonts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const face = { family: 'Consumer Font Probe', weight: '400', style: 'normal', file: './input.woff2', sha256: sha(fixtureBytes) };
  const manifest = { version: 1, fonts: [face] };
  change(manifest);
  writeFileSync(path.join(root, 'input.woff2'), fixtureBytes);
  const file = path.join(root, 'fonts.json');
  writeFileSync(file, JSON.stringify(manifest));
  return { root, file, face };
}

test('explicit assets are authenticated and replayable from the retained manifest without original paths', t => {
  const { root, file } = fixture(t, m => { m.fonts[0].weight = '100 900'; });
  const fonts = readConsumerFonts(file);
  const out = path.join(root, 'retained');
  writeConsumerFonts(out, fonts);
  const replay = readConsumerFonts(path.join(out, 'manifest.json'));
  assert.deepEqual(replay, fonts);
  assert.equal(fonts[0]!.format, 'woff2');
  assert.equal(consumerFontManifest(fonts).fonts[0]!.file, sha(fixtureBytes) + '.woff2');
  const css = readFileSync(path.join(out, 'fonts.css'), 'utf8');
  assert.equal(css.includes('text-rendering'), false);
  assert.equal(css.includes('local('), false, 'the operating system must not substitute a face with the same name');
  assert.equal(css.includes(root), false);
  assert.match(css, /^@font-face\{[^{}]+\}\n$/);
  assert.throws(() => writeConsumerFonts(out, fonts), /EEXIST/, 'evidence cannot be overwritten');
});

test('mismatched bytes, ambiguous faces and CSS/network inputs refuse before output', async t => {
  const cases: Array<[string, (m: any) => void, RegExp]> = [
    ['hash', m => { m.fonts[0].sha256 = '0'.repeat(64); }, /sha256-mismatch/],
    ['family injection', m => { m.fonts[0].family = 'x";src:url(https://example.com)'; }, /invalid-family/],
    ['generic', m => { m.fonts[0].family = 'sans-serif'; }, /invalid-family/],
    ['weight injection', m => { m.fonts[0].weight = '400; color:red'; }, /invalid-weight/],
    ['weight reversed', m => { m.fonts[0].weight = '900 100'; }, /invalid-weight/],
    ['weight range', m => { m.fonts[0].weight = '0 900'; }, /invalid-weight/],
    ['style', m => { m.fonts[0].style = 'oblique'; }, /invalid-style/],
    ['network', m => { m.fonts[0].file = 'https://example.com/a.woff2'; }, /local-file-required/],
    ['unknown option', m => { m.fonts[0].css = '*{text-rendering:geometricPrecision}'; }, /invalid-face/],
    ['overlap', m => { m.fonts.push({ ...m.fonts[0], family: m.fonts[0].family.toLowerCase(), weight: '100 900' }); }, /overlapping-face/],
    ['empty', m => { m.fonts = []; }, /invalid-manifest/],
  ];
  for (const [name, change, refusal] of cases) await t.test(name, tt => {
    const { file } = fixture(tt, change);
    assert.throws(() => readConsumerFonts(file), refusal);
  });
});

test('nonoverlapping weights and italic faces can share authenticated asset bytes', t => {
  const { file, root } = fixture(t, m => {
    m.fonts.push({ ...m.fonts[0], weight: '500 900' }, { ...m.fonts[0], style: 'italic' });
  });
  const fonts = readConsumerFonts(file);
  assert.equal(fonts.length, 3);
  writeConsumerFonts(path.join(root, 'out'), fonts);
  assert.equal(readFileSync(path.join(root, 'out', 'fonts.css'), 'utf8').split('@font-face').length, 4);
});

test('browser loads the isolated asset, preserves authored text rendering and refuses invalid font bytes', async t => {
  const { root, file } = fixture(t);
  const fonts = readConsumerFonts(file);
  writeConsumerFonts(path.join(root, 'fonts'), fonts);
  const browser = await chromium.launch();
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end('<link rel="stylesheet" href="/fonts/fonts.css"><span style="font:400 24px \'Consumer Font Probe\';text-rendering:optimizeSpeed">AV office 012</span>');
    } else if (req.url === '/fonts/fonts.css' || req.url === '/fonts/' + fonts[0]!.file) {
      res.setHeader('content-type', req.url.endsWith('.css') ? 'text/css' : 'font/woff2');
      res.end(readFileSync(path.join(root, req.url)));
    } else { res.statusCode = 404; res.end(); }
  });
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    assert.equal((await loadConsumerFonts(page, fonts))[0]!.status, 'loaded');
    assert.equal(await page.locator('span').evaluate(el => getComputedStyle(el).textRendering), 'optimizespeed');
    const session = await page.context().newCDPSession(page);
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root: documentNode } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: 'span' });
    const painted = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    assert.ok(painted.fonts.length > 0 && painted.fonts.every(f => f.isCustomFont));
    assert.ok(painted.fonts.every(f => f.familyName === 'IBM Plex Sans'));
    await page.evaluate(() => { document.fonts.clear(); document.fonts.add(new FontFace('Broken Probe', new Uint8Array([119,79,70,50,0,0,0,0]).buffer, { weight: '400', style: 'normal' })); });
    await assert.rejects(loadConsumerFonts(page, [{ ...fonts[0]!, family: 'Broken Probe' }]), /could not be loaded|Invalid font|NetworkError|SyntaxError/i);
  } finally {
    await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
