import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { deflateSync } from 'node:zlib';
import { consumerFontManifest, fontFamilyNames, loadConsumerFonts, readConsumerFonts, writeConsumerFonts } from './design-consumer-fonts.js';

const fixtureBytes = readFileSync(new URL('../extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2', import.meta.url));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function fixture(t: { after(fn: () => void): void }, change: (v: any) => void = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'consumer-fonts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // The family the file's own name table declares (see fontFamilyNames).
  const face = { family: 'IBM Plex Sans', weight: '400', style: 'normal', file: './input.woff2', sha256: sha(fixtureBytes) };
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
      res.end('<link rel="stylesheet" href="/fonts/fonts.css"><span style="font:400 24px \'IBM Plex Sans\';text-rendering:optimizeSpeed">AV office 012</span>');
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

/** A minimal sfnt holding only a `name` table (Windows UTF-16BE and Macintosh
 *  Roman records), as TrueType or wrapped as WOFF with a zlib-compressed table. */
function nameOnlyFont(names: Array<[platform: number, nameId: number, text: string]>, wrap: 'ttf' | 'woff'): Buffer {
  const encoded = names.map(([platform, , text]) => platform === 1 ? Buffer.from(text, 'latin1') : Buffer.from(text, 'utf16le').swap16());
  const header = Buffer.alloc(6 + 12 * names.length);
  header.writeUInt16BE(0, 0); header.writeUInt16BE(names.length, 2); header.writeUInt16BE(header.length, 4);
  let offset = 0;
  names.forEach(([platform, nameId], i) => {
    const r = 6 + i * 12;
    header.writeUInt16BE(platform, r); header.writeUInt16BE(platform === 1 ? 0 : 1, r + 2); header.writeUInt16BE(platform === 1 ? 0 : 0x409, r + 4);
    header.writeUInt16BE(nameId, r + 6); header.writeUInt16BE(encoded[i].length, r + 8); header.writeUInt16BE(offset, r + 10); offset += encoded[i].length;
  });
  const table = Buffer.concat([header, ...encoded]);
  if (wrap === 'ttf') {
    const head = Buffer.alloc(12 + 16);
    head.writeUInt32BE(0x00010000, 0); head.writeUInt16BE(1, 4);
    head.write('name', 12, 'latin1'); head.writeUInt32BE(28, 20); head.writeUInt32BE(table.length, 24);
    return Buffer.concat([head, table]);
  }
  const compressed = deflateSync(table), head = Buffer.alloc(44 + 20);
  head.write('wOFF', 0, 'latin1'); head.writeUInt32BE(0x00010000, 4); head.writeUInt32BE(64 + compressed.length, 8); head.writeUInt16BE(1, 12);
  head.write('name', 44, 'latin1'); head.writeUInt32BE(64, 48); head.writeUInt32BE(compressed.length, 52); head.writeUInt32BE(table.length, 56);
  return Buffer.concat([head, compressed]);
}

test('a face is registered only under a family its own bytes declare; never a system font file as another family', t => {
  assert.deepEqual(fontFamilyNames(fixtureBytes), ['IBM Plex Sans'], 'WOFF2 (Brotli)');
  const semibold = readFileSync(new URL('../extract/computed/fonts/ibm-plex-sans/IBMPlexSans-SemiBold.woff2', import.meta.url));
  assert.deepEqual(fontFamilyNames(semibold), ['IBM Plex Sans SmBld', 'IBM Plex Sans'], 'legacy (ID 1) and typographic (ID 16) family');
  const names: Array<[number, number, string]> = [[3, 1, 'Example Sans Medium'], [1, 1, 'Example Sans Medium'], [3, 16, 'Example Sans'], [3, 4, 'Example Sans Medium Full']];
  for (const wrap of ['ttf', 'woff'] as const) assert.deepEqual(fontFamilyNames(nameOnlyFont(names, wrap)), ['Example Sans Medium', 'Example Sans'], wrap);
  assert.throws(() => fontFamilyNames(Buffer.from('not a font at all')), /unsupported font format/);
  // The manifest's family must be one of them (case-insensitive); another name refuses before output.
  const { file } = fixture(t, m => { m.fonts[0].family = 'ibm plex sans'; });
  assert.equal(readConsumerFonts(file)[0]!.family, 'ibm plex sans');
  for (const other of ['SF Pro', 'Consumer Font Probe', 'IBM Plex Sans Condensed']) {
    const { file: renamed } = fixture(t, m => { m.fonts[0].family = other; });
    assert.throws(() => readConsumerFonts(renamed), new RegExp(`family-not-declared-by-font:${JSON.stringify(other)} \\(the file names itself "IBM Plex Sans"\\)`), other);
  }
});

test('the macOS system UI font is never provisioned as SF Pro', { skip: !existsSync('/System/Library/Fonts/SFNS.ttf') && 'not macOS' }, t => {
  const bytes = readFileSync('/System/Library/Fonts/SFNS.ttf'), root = mkdtempSync(path.join(tmpdir(), 'consumer-fonts-sfns-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(fontFamilyNames(bytes).includes('SF Pro'), false);
  writeFileSync(path.join(root, 'fonts.json'), JSON.stringify({ version: 1, fonts: [{ family: 'SF Pro', weight: '100 900', style: 'normal', file: '/System/Library/Fonts/SFNS.ttf', sha256: sha(bytes) }] }));
  assert.throws(() => readConsumerFonts(path.join(root, 'fonts.json')), /family-not-declared-by-font:"SF Pro"/);
});
