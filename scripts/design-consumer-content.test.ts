/** The content check and the per-variant verdict of design:consumer:check
 * (docs/GOAL.md: missing text, icons or parts fail the check). No Figma token,
 * no npm install: REST trees are fixtures and pages are local. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { caseContent, COLOR_STEP, colorHex, domContentOf, fetchFigmaContent, figmaContent, figmaFillColor, firstFamily, matchParts, missingTexts, parseCssColor, sameDeclaredColor, type RestNode } from './design-consumer-content.js';
import { deriveCases, duplicateCaseKeys, runConsumerCheck } from './design-consumer-check.js';
import { checkFailureProblem, formatVerdictTable, problemCase, variantVerdicts } from './design-consumer-verdict.js';
import { fetchFigmaApi, MAX_429_RETRIES, MAX_RETRY_AFTER_SECONDS } from '../extract/figma/rest/fetch.js';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const fill = [{ type: 'SOLID', visible: true }];
/** REST's TEXT paint and type style (the fixtures' page draws #eeeeee Inter 400). */
const solid = (hex: string, extra: Record<string, unknown> = {}) => ({ type: 'SOLID', blendMode: 'NORMAL', ...extra,
  color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a: 1 } });
const inter = { fontFamily: 'Inter', fontWeight: 400 };
const text = (name: string, characters: string, b = box(0, 0, 80, 20), extra: Partial<RestNode> = {}): RestNode =>
  ({ type: 'TEXT', name, characters, absoluteBoundingBox: b, absoluteRenderBounds: b, fills: [solid('#eeeeee')], style: inter, ...extra });
const eee = { start: 0, color: { r: 238 / 255, g: 238 / 255, b: 238 / 255, a: 1 }, family: 'Inter', weight: 400 };
const vector = (b: ReturnType<typeof box>, extra: Partial<RestNode> = {}): RestNode =>
  ({ type: 'VECTOR', name: 'Vector', absoluteBoundingBox: b, absoluteRenderBounds: b, fills: fill, ...extra });
const node = (type: string, name: string, b: ReturnType<typeof box>, children: RestNode[], extra: Partial<RestNode> = {}): RestNode =>
  ({ type, name, absoluteBoundingBox: b, absoluteRenderBounds: b, children, ...extra });

/** The Altitude Dialog variant as REST returns it (2026-09-28): the heading is
 *  inside an instance, the close button's icon is two instances deep, and the
 *  button's leading icon and label are hidden. */
const dialogVariant = (): RestNode => node('COMPONENT', 'Footer=No', box(28, 392, 600, 153), [
  node('FRAME', 'al-c-dialog__header', box(28, 392, 600, 73), [
    node('FRAME', 'al-c-dialog__title', box(44, 414, 520, 28), [
      node('INSTANCE', 'al-heading', box(44, 414, 138.9, 28), [text('Heading', 'Dialog heading', box(43, 414, 140, 28))]),
    ]),
    node('INSTANCE', 'al-button', box(580, 408, 32, 40), [
      node('INSTANCE', 'Icon Before', box(596, 418, 20, 20), [node('INSTANCE', 'ArrowArcLeft', box(596, 418, 20, 20), [vector(box(597, 424, 16.9, 8.8))])], { visible: false, absoluteRenderBounds: null }),
      text('Button', '', box(596, 418, 0, 20), { visible: false, absoluteRenderBounds: null }),
      node('INSTANCE', 'Icon After', box(586, 418, 20, 20), [node('SLOT', 'icon Container', box(586, 418, 20, 20), [
        node('INSTANCE', 'X', box(586, 418, 20, 20), [vector(box(590, 422, 12.5, 12.5))]),
      ])]),
    ]),
  ]),
  node('FRAME', 'al-c-dialog__body', box(28, 489, 600, 56), [text('Label', 'Dialog content', box(44, 505, 568, 24))]),
]);

test('what a Figma variant draws: texts inside instances, the innermost text-free instance around a vector as one icon, nothing hidden', () => {
  assert.deepEqual(figmaContent(dialogVariant()), {
    texts: ['Dialog heading', 'Dialog content'],
    textStyles: [[{ ...eee, end: 14 }], [{ ...eee, end: 14 }]],
    parts: [{ name: 'al-button/Icon After/X', kind: 'icon', box: box(558, 26, 20, 20), members: [box(562,30,12.5,12.5)] }],
  });
  // A vector beside text in the same instance is judged on its own; a
  // transparent layer, a fill-less text and an unrendered vector draw nothing.
  const chip = node('COMPONENT', 'Chip', box(0, 0, 100, 24), [
    node('INSTANCE', 'Chip', box(0, 0, 100, 24), [text('Label', 'Tag'), vector(box(80, 4, 16, 16))]),
    node('FRAME', 'Ghost', box(0, 0, 10, 10), [text('Hidden', 'Invisible')], { opacity: 0 }),
    text('Unfilled', 'No paint', box(0, 0, 10, 10), { fills: [{ visible: false }] as any }),
    vector(box(0, 0, 4, 4), { absoluteRenderBounds: null }),
  ]);
  assert.deepEqual(figmaContent(chip), { texts: ['Tag'], textStyles: [[{ ...eee, end: 3 }]], parts: [{ name: 'Chip/Vector', kind: 'vector', box: box(80, 4, 16, 16) }] });
});

test('text is compared case- and whitespace-insensitively, and counted', () => {
  assert.deepEqual(missingTexts(['Dialog heading', 'Close'], 'HEADING\nDialog\n  heading close'), []);
  assert.deepEqual(missingTexts(['Dialog heading', 'Dialog content'], 'Heading Dialog content'), ['Dialog heading']);
  assert.deepEqual(missingTexts(['Tab', 'Tab', 'Tab'], 'Tab Tab'), ['Tab']);
  assert.deepEqual(missingTexts(['Tab', 'Tab', 'Tab'], 'Other'), ['Tab (×3)']);
  assert.deepEqual(missingTexts(['', '   '], ''), [], 'empty text draws nothing to find');
});

test('parts match one to one by size, never by position; a part with no graphic of its size is missing', () => {
  const icon = (name: string, x: number, size = 20) => ({ name, kind: 'icon' as const, box: box(x, 0, size, size) });
  const graphic = (x: number, w: number, h = w) => ({ tag: 'svg', box: box(x, 0, w, h) });
  // Arranged differently (a wrong layout direction) but all present.
  assert.deepEqual(matchParts([icon('a', 0), icon('b', 100)], [graphic(300, 20), graphic(0, 21)]), { matched: 2, missing: [] });
  // Two icons drawn, one rendered: the one farther from the rendered graphic is missing.
  assert.deepEqual(matchParts([icon('lead', 0), icon('close', 500)], [graphic(2, 20)]).missing.map(p => p.name), ['close']);
  // A graphic far from the part's size does not stand in for it.
  assert.deepEqual(matchParts([icon('close', 0)], [graphic(0, 40), graphic(0, 12)]).missing.map(p => p.name), ['close']);
  assert.deepEqual(matchParts([icon('small', 0, 8)], [graphic(0, 10)]).missing, [], 'max(3 px, 35%) per side');
});

const PAGE = `<!doctype html><html><head><style>
  body{margin:0} [data-cell]{display:block;width:fit-content;margin:8px;padding:4px}
  .root{display:flex;gap:8px;align-items:center;background:#222;color:#eee;padding:8px;font-family:Inter,sans-serif;font-weight:400}
  .dot{width:10px;height:10px;border-radius:50%;background:#0a0}
  .masked{width:16px;height:16px;background:#fff;-webkit-mask-image:linear-gradient(#000,#000);mask-image:linear-gradient(#000,#000)}
  .bare{width:32px;height:40px;background:transparent;border:0}
  .req::after{content:"*"} .hidden{visibility:hidden}
</style></head><body>
  <div data-cell="rendered"><div class="root">
    <span>Dialog heading</span><span class="req">Name</span>
    <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 5L15 15"/></svg>
    <span class="dot"></span><span class="masked"></span><input placeholder="Search">
    <svg class="hidden" width="24" height="24"><path d="M0 0L1 1"/></svg>
  </div></div>
  <div data-cell="lost"><div class="root"><span>Heading</span><button class="bare"><span></span></button></div></div>
</body></html>`;

test('in the page: rendered text includes placeholders and generated content, graphics include svg, masks and painted leaves, never hidden ones', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(PAGE);
    const rendered = await page.locator('[data-cell="rendered"]').evaluate(domContentOf);
    assert.match(rendered.text, /Dialog heading/);
    assert.match(rendered.text, /Search/);
    assert.match(rendered.text, /\*/);
    // A native control that paints itself (here the text field's border) is a
    // candidate too: a native checkbox is how a drawn check mark may render.
    assert.deepEqual(rendered.graphics.map(g => g.tag), ['svg', 'span', 'span', 'input']);
    assert.deepEqual(rendered.graphics.slice(0, 3).map(g => [g.box.width, g.box.height]), [[20, 20], [10, 10], [16, 16]]);
    const figma = figmaContent(dialogVariant());
    assert.deepEqual(caseContent('rendered', figma, rendered).problems, ['content-missing:rendered:text:"Dialog content"']);
    // The cold-start Dialog: the heading instance renders its own default and
    // the bare close button renders no icon. Both fail by name, whatever the
    // whole-image score (0.6% and 0.8% there).
    const lost = await page.locator('[data-cell="lost"]').evaluate(domContentOf);
    assert.deepEqual(lost.graphics, [], 'a transparent, text-free button draws nothing');
    assert.deepEqual(caseContent('footer-no', figma, lost).problems, [
      'content-missing:footer-no:text:"Dialog heading"',
      'content-missing:footer-no:text:"Dialog content"',
      'content-missing:footer-no:part:al-button/Icon After/X',
    ]);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// TEXT STYLE: the first real-kit scoreboard passed an Atlassian ModalFooter at
// 1.56% whose "Confirm" React drew black where Figma draws white.
// ---------------------------------------------------------------------------
/** The ModalFooter variant as REST draws it: a subtle "Cancel" and a primary "Confirm". */
const modalFooter = (): RestNode => node('COMPONENT', 'appearance=default', box(0, 0, 400, 72), [
  node('INSTANCE', '<Button>', box(230, 24, 72, 32), [text('label', 'Cancel', box(242, 30, 45, 20), { fills: [solid('#44546f')], style: { fontFamily: 'Atlassian Sans', fontWeight: 500 } })]),
  node('INSTANCE', '<Button>', box(310, 24, 79, 32), [text('label', 'Confirm', box(322, 30, 55, 20), { fills: [solid('#ffffff')], style: { fontFamily: 'Atlassian Sans', fontWeight: 500 } })]),
]);
const run = (text: string, color: string, family = '"Atlassian Sans", sans-serif', weight = '500', opacity = 1) => ({ text, color, family, weight, opacity });

test('text style: a text drawn in another color or font fails by name, whatever the pixel score (Atlassian ModalFooter)', () => {
  const figma = figmaContent(modalFooter());
  // What the scoreboard's React drew: both labels default black, in Inter 400.
  const black = { text: 'Cancel\nConfirm', graphics: [], runs: [run('Cancel', 'rgb(0, 0, 0)', 'Inter, system-ui, sans-serif', '400'), run('Confirm', 'rgb(0, 0, 0)', 'Inter, system-ui, sans-serif', '400')] };
  assert.deepEqual(caseContent('appearance-default', figma, black).problems, [
    'text-color-mismatch:appearance-default:"Cancel":figma #44546f vs rendered #000000',
    'text-font-mismatch:appearance-default:"Cancel":figma "Atlassian Sans" 500 vs rendered "Inter" 400',
    'text-color-mismatch:appearance-default:"Confirm":figma #ffffff vs rendered #000000',
    'text-font-mismatch:appearance-default:"Confirm":figma "Atlassian Sans" 500 vs rendered "Inter" 400',
  ]);
  const row = caseContent('appearance-default', figma, black).content.texts.styles![1];
  assert.deepEqual(row, { text: 'Confirm', figma: ['#ffffff "Atlassian Sans" 500'], rendered: ['#000000 "Inter" 400'], color: 'mismatch', font: 'mismatch' });
  // Drawn right: the requested family counts, not whether the consumer has it
  // (that is font-unavailable-in-consumer's finding), and case/quotes do not matter.
  const right = { text: 'CANCEL CONFIRM', graphics: [], runs: [run('Cancel', 'rgb(68, 84, 111)', "'atlassian sans', Inter"), run('Confirm', 'rgb(255, 255, 255)')] };
  const judged = caseContent('appearance-default', figma, right);
  assert.deepEqual(judged.problems, []);
  assert.deepEqual(judged.content.texts.styles!.map(s => [s.text, s.color, s.font]), [['Cancel', 'match', 'match'], ['Confirm', 'match', 'match']]);
});

test('text color tolerance is one 8-bit step of the declared color, alpha and opacity included; never a pixel', () => {
  assert.deepEqual(parseCssColor('rgb(68, 84, 111)'), { r: 68 / 255, g: 84 / 255, b: 111 / 255, a: 1 });
  assert.deepEqual(parseCssColor('rgba(16, 16, 16, 0.3)'), { r: 16 / 255, g: 16 / 255, b: 16 / 255, a: 0.3 });
  assert.deepEqual(parseCssColor('color(srgb 1 0.5 0 / 0.25)'), { r: 1, g: 0.5, b: 0, a: 0.25 });
  assert.deepEqual(parseCssColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  for (const other of ['oklch(0.5 0.1 200)', 'none', 'url("#g")', 'rgb(1, 2)']) assert.equal(parseCssColor(other), null, other);
  const figmaWhite = { r: 1, g: 1, b: 1, a: 1 };
  // A Figma float channel lands on the nearest 8-bit value: 0.5 → 127.5 → 127 or 128.
  assert.ok(sameDeclaredColor({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, parseCssColor('rgb(128, 127, 128)')!));
  assert.ok(sameDeclaredColor(figmaWhite, parseCssColor('rgb(254, 255, 255)')!), 'one step');
  assert.equal(sameDeclaredColor(figmaWhite, parseCssColor('rgb(253, 255, 255)')!), false, 'two steps is another color');
  assert.equal(sameDeclaredColor(figmaWhite, parseCssColor('rgba(255, 255, 255, 0.99)')!), false, 'alpha counts');
  assert.ok(sameDeclaredColor({ r: 1, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 1, a: 0 }), 'no alpha on either side paints no hue');
  assert.equal(COLOR_STEP, 1 / 255);
  assert.equal(colorHex({ r: 1, g: 1, b: 1, a: 0.5 }), '#ffffff80');
  // Opacity: Figma paint opacity times layer opacity, against CSS color alpha times CSS opacity.
  const faded = node('COMPONENT', 'Faded', box(0, 0, 100, 20), [node('FRAME', 'group', box(0, 0, 100, 20), [
    text('label', 'Muted', box(0, 0, 40, 20), { fills: [solid('#000000', { opacity: 0.8 })], opacity: 0.5 })], { opacity: 0.5 })]);
  const figma = figmaContent(faded);
  assert.equal(figma.textStyles[0][0].color!.a, 0.2);
  const rendered = (color: string, opacity: number) => caseContent('k', figma, { text: 'Muted', graphics: [], runs: [run('Muted', color, 'Inter', '400', opacity)] }).problems.filter(p => p.startsWith('text-color'));
  assert.deepEqual(rendered('rgba(0, 0, 0, 0.8)', 0.25), []);
  assert.deepEqual(rendered('rgba(0, 0, 0, 0.2)', 1), [], 'the same ink declared on the color instead of the layer');
  assert.deepEqual(rendered('rgb(0, 0, 0)', 1), ['text-color-mismatch:k:"Muted":figma #00000033 vs rendered #000000']);
});

test('text style runs: overrides are compared per character, fills composite, and what cannot be compared is unmeasured, never a pass', () => {
  // "Save all": "Save" base white Inter 600, " all" overridden to a yellow 400.
  const mixed = node('COMPONENT', 'Mixed', box(0, 0, 100, 20), [text('label', 'Save all', box(0, 0, 60, 20), {
    fills: [solid('#ffffff')], style: { fontFamily: 'Inter', fontWeight: 600 },
    characterStyleOverrides: [0, 0, 0, 0, 7, 7, 7, 7], styleOverrideTable: { 7: { fontWeight: 400, fills: [solid('#ffcc00')] } } })]);
  const figma = figmaContent(mixed);
  assert.deepEqual(figma.textStyles[0].map(r => [r.start, r.end, colorHex(r.color!), r.weight]), [[0, 4, '#ffffff', 600], [4, 8, '#ffcc00', 400]]);
  const dom = (runs: ReturnType<typeof run>[]) => caseContent('k', figma, { text: runs.map(r => r.text).join(''), graphics: [], runs }).problems;
  assert.deepEqual(dom([run('Save', 'rgb(255, 255, 255)', 'Inter', '600'), run(' all', 'rgb(255, 204, 0)', 'Inter', '400')]), []);
  assert.deepEqual(dom([run('Save all', 'rgb(255, 255, 255)', 'Inter', '600')]), [
    'text-color-mismatch:k:"Save all":figma #ffcc00 vs rendered #ffffff', 'text-font-mismatch:k:"Save all":figma "Inter" 400 vs rendered "Inter" 600']);
  // Two SOLID fills composite; a gradient or a blend mode is not one declared color.
  assert.deepEqual(figmaFillColor([solid('#000000'), solid('#ffffff', { opacity: 0.5 })], 1), { color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
  assert.deepEqual(figmaFillColor([{ type: 'GRADIENT_LINEAR' }], 1), { unmeasured: 'gradient-linear fill' });
  assert.deepEqual(figmaFillColor([solid('#000000', { blendMode: 'MULTIPLY' })], 1), { unmeasured: 'multiply blend' });
  const gradient = node('COMPONENT', 'G', box(0, 0, 100, 20), [text('label', 'Glow', box(0, 0, 40, 20), { fills: [{ type: 'GRADIENT_LINEAR', visible: true }] as any })]);
  const unmeasured = caseContent('k', figmaContent(gradient), { text: 'Glow', graphics: [], runs: [run('Glow', 'rgb(0, 0, 0)', 'Inter', '400')] }).problems;
  assert.deepEqual(unmeasured, ['text-style-unmeasured:k:"Glow":gradient-linear fill']);
  const cases = [{ key: 'k', figmaName: 'G' }];
  const measured = { key: 'k', layoutAligned: { status: 'measured', whiteMismatchPercent: 1, blackMismatchPercent: 1, withinLimit: true } };
  const content = { key: 'k', texts: { figma: 1, missing: [] }, parts: { figma: 0, matched: 0, missing: [] } };
  assert.equal(variantVerdicts({ problems: unmeasured, images: { cases: [measured] }, content: { cases: [content] } }, cases).verdict, 'unverified');
  assert.equal(variantVerdicts({ problems: ['text-color-mismatch:k:"Confirm":figma #ffffff vs rendered #000000'], images: { cases: [measured] }, content: { cases: [content] } }, cases).verdict, 'fail');
  // A rendered color outside sRGB is not guessed at.
  assert.deepEqual(caseContent('k', figmaContent(modalFooter()), { text: 'Cancel Confirm', graphics: [], runs: [run('Cancel Confirm', 'oklch(0.5 0.1 200)')] }).problems, [
    'text-style-unmeasured:k:"Cancel":rendered color oklch(0.5 0.1 200) is not an sRGB color',
    'text-style-unmeasured:k:"Confirm":rendered color oklch(0.5 0.1 200) is not an sRGB color']);
  // A text the presence check reports missing is its finding, not a style one.
  assert.deepEqual(caseContent('k', figmaContent(modalFooter()), { text: 'Cancel', graphics: [], runs: [run('Cancel', 'rgb(68, 84, 111)')] }).problems,
    ['content-missing:k:text:"Confirm"']);
});

const STYLE_PAGE = `<!doctype html><html><head><style>
  body{margin:0;font-family:Inter,sans-serif} [data-cell]{display:block;width:fit-content;margin:8px;padding:4px}
  .footer{display:flex;gap:8px} button{font:500 14px "Atlassian Sans",sans-serif;border:0;padding:6px 12px}
  .subtle{background:none;color:#44546f} .primary{background:#0c66e4;color:#fff} .fade{opacity:.5} .gone{visibility:hidden}
  .req::after{content:"*";color:#c9372c} input{color:#172b4d} input::placeholder{color:#626f86}
</style></head><body>
  <div data-cell="right"><div class="footer"><button class="subtle">Cancel</button><button class="primary">Confirm</button></div></div>
  <div data-cell="default"><div class="footer"><button style="all:unset">Cancel</button><button style="all:unset">Confirm</button></div></div>
  <div data-cell="runs"><div><span class="fade"><b>Bold</b></span><span class="req">Name</span><span class="gone">Hidden</span><input placeholder="Search"><svg width="40" height="20"><text x="0" y="15" fill="#123456">Chart</text></svg></div></div>
</body></html>`;

test('in the page: text runs carry the declared color, requested family, weight and CSS opacity; hidden text is not a run', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(STYLE_PAGE);
    const figma = figmaContent(modalFooter());
    const right = await page.locator('[data-cell="right"]').evaluate(domContentOf);
    assert.deepEqual(caseContent('right', figma, right).problems, []);
    // The scoreboard's failure: labels in the inherited default color and font.
    const lost = await page.locator('[data-cell="default"]').evaluate(domContentOf);
    assert.deepEqual(caseContent('default', figma, lost).problems, [
      'text-color-mismatch:default:"Cancel":figma #44546f vs rendered #000000',
      'text-font-mismatch:default:"Cancel":figma "Atlassian Sans" 500 vs rendered "Inter" 400',
      'text-color-mismatch:default:"Confirm":figma #ffffff vs rendered #000000',
      'text-font-mismatch:default:"Confirm":figma "Atlassian Sans" 500 vs rendered "Inter" 400',
    ]);
    const runs = (await page.locator('[data-cell="runs"]').evaluate(domContentOf)).runs!;
    assert.deepEqual(runs.map(r => [r.text, r.color, r.weight, r.opacity]), [
      ['Bold', 'rgb(0, 0, 0)', '700', 0.5],
      ['Name', 'rgb(0, 0, 0)', '400', 1],
      ['*', 'rgb(201, 55, 44)', '400', 1],
      ['Search', 'rgb(98, 111, 134)', '400', 1],
      ['Chart', 'rgb(18, 52, 86)', '400', 1],
    ]);
    assert.equal(firstFamily(runs[0].family), 'Inter');
  } finally { await browser.close(); }
});

test('the Figma side is one read-only GET; no token, a failed response or a missing node is unavailable, never a pass', async t => {
  const out = mkdtempSync(path.join(tmpdir(), 'content-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  assert.deepEqual(await fetchFigmaContent('FILE', ['1:1'], undefined, out), { status: 'unavailable', reason: 'no token' });
  const calls: string[] = [];
  const respond = (status: number, body: unknown) => async (url: string, init: { headers: Record<string, string> }) => {
    calls.push(`${url} ${init.headers['X-Figma-Token'] ? 'token' : 'none'}`);
    return { ok: status === 200, status, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer };
  };
  assert.deepEqual(await fetchFigmaContent('FILE', ['1:1'], 'secret', out, respond(403, {})), { status: 'unavailable', reason: 'HTTP 403' });
  assert.deepEqual(await fetchFigmaContent('FILE', ['1:1', '1:2'], 'secret', out, respond(200, { nodes: { '1:1': { document: dialogVariant() } } })),
    { status: 'unavailable', reason: 'node 1:2 not returned' });
  const collected = await fetchFigmaContent('FILE', ['1:1'], 'secret', out, respond(200, { version: '42', nodes: { '1:1': { document: dialogVariant() } } }));
  assert.equal(collected.status, 'collected');
  assert.deepEqual(calls.at(-1), 'https://api.figma.com/v1/files/FILE/nodes?ids=1:1 token');
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'figma-content.json'), 'utf8')).byNodeId['1:1'].texts, ['Dialog heading', 'Dialog content']);
  assert.doesNotMatch(readFileSync(path.join(out, 'figma-content.json'), 'utf8'), /secret/);
});

test('a problem belongs to the variant it names first; a payload that spells another key does not move it', () => {
  const keys = ['default', 'size-sm', 'size-sm_state-hover'];
  assert.equal(problemCase('content-missing:size-sm:text:"a:default:b"', keys), 'size-sm');
  assert.equal(problemCase('state-inert:hover:size-sm_state-hover', keys), 'size-sm_state-hover');
  assert.equal(problemCase('layout-image-difference-above-limit:default:7.00%', keys), 'default');
  assert.equal(problemCase('variant-prop-discarded:size', keys), null);
});

test('verdicts: a content loss fails its variant at any pixel score, an unmeasured image is unverified, a set problem fails the set', () => {
  const cases = [{ key: 'a', figmaName: 'Size=A' }, { key: 'b', figmaName: 'Size=B' }, { key: 'c', figmaName: 'Size=C' }];
  const measured = (key: string, white: number) => ({ key, layoutAligned: { status: 'measured', whiteMismatchPercent: white, blackMismatchPercent: white, withinLimit: white <= 5 } });
  const content = (key: string, missing: string[] = []) => ({ key, texts: { figma: 1, missing }, parts: { figma: 0, matched: 0, missing: [] } });
  const receipt = {
    problems: ['content-missing:a:text:"Dialog heading"', 'figma-image-missing:c'],
    images: { cases: [measured('a', 0.6), measured('b', 0.1)] },
    content: { cases: [content('a', ['Dialog heading']), content('b'), content('c')] },
  };
  const v = variantVerdicts(receipt, cases);
  assert.deepEqual(v.variants.map(r => [r.key, r.verdict]), [['a', 'fail'], ['b', 'pass'], ['c', 'unverified']]);
  assert.equal(v.verdict, 'fail');
  assert.deepEqual(variantVerdicts({ ...receipt, problems: ['figma-image-missing:c'] }, cases).verdict, 'unverified');
  assert.deepEqual(variantVerdicts({ ...receipt, problems: ['variant-prop-discarded:size'] }, cases.slice(0, 2)).verdict, 'fail');
  assert.deepEqual(variantVerdicts({ problems: [], images: { cases: [measured('b', 0.1)] }, content: { cases: [content('b')] } }, [cases[1]]).verdict, 'pass');
  const table = formatVerdictTable(v).join('\n');
  assert.match(table, /Size=A +FAIL/);
  assert.match(table, /- content-missing:a:text:"Dialog heading"/);
  assert.match(table, /Size=C +UNVERIFIED +not measured/);
});

test('a rate limit that outlasts the retries is an unmade measurement, never a failed set (first scoreboard run)', () => {
  // The first real-kit run reported FAIL for 'check-failed: figma-bounds-unavailable:before:HTTP 429'.
  for (const message of ['figma-bounds-unavailable:before:HTTP 429', 'figma-bounds-unavailable:after:HTTP 503',
    'figma-image-download-failed:1:2:HTTP 429'])
    assert.equal(checkFailureProblem(message), 'figma-images-unavailable: ' + message);
  for (const message of ['figma-bounds-unavailable:before:HTTP 404', 'figma-image-download-failed:1:2:HTTP 403', 'vite build failed'])
    assert.equal(checkFailureProblem(message), 'check-failed: ' + message);
  const cases = [{ key: 'a', figmaName: 'Size=A' }];
  const receipt = { problems: [checkFailureProblem('figma-bounds-unavailable:before:HTTP 429')], images: { cases: [] }, content: { cases: [] } };
  assert.equal(variantVerdicts(receipt, cases).verdict, 'unverified');
  assert.equal(variantVerdicts({ ...receipt, problems: [checkFailureProblem('vite build failed')] }, cases).verdict, 'fail');
});

test('Figma API calls in the check retry 429s the way the importer does', async () => {
  const waits: number[] = [], seen: string[] = [];
  const answer = (statuses: Array<[number, string | null]>) => {
    let i = 0;
    return async (url: string, init: { headers: Record<string, string> }) => {
      seen.push(init.headers['X-Figma-Token']);
      const [status, retryAfter] = statuses[Math.min(i++, statuses.length - 1)];
      return { status, ok: status === 200, headers: { get: (n: string) => n === 'retry-after' ? retryAfter : null } };
    };
  };
  const quiet = { sleep: async (ms: number) => { waits.push(ms); }, onRateLimited: () => {} };
  const ok = await fetchFigmaApi('https://api.figma.com/v1/x', 'tok', { ...quiet, fetchImpl: answer([[429, '2'], [429, null], [200, null]]) });
  assert.equal(ok.status, 200);
  assert.deepEqual(waits, [2000, 5000], 'Retry-After when given, 5 s when absent');
  assert.ok(seen.every(t => t === 'tok'));
  waits.length = 0;
  const exhausted = await fetchFigmaApi('https://api.figma.com/v1/x', 'tok', { ...quiet, fetchImpl: answer([[429, '1']]) });
  assert.equal(exhausted.status, 429);
  assert.equal(waits.length, MAX_429_RETRIES);
  waits.length = 0;
  const tooLong = await fetchFigmaApi('https://api.figma.com/v1/x', 'tok', { ...quiet, fetchImpl: answer([[429, String(MAX_RETRY_AFTER_SECONDS + 1)]]) });
  assert.equal(tooLong.status, 429);
  assert.deepEqual(waits, [], 'a wait over the cap is not slept');
});

test('duplicate case keys refuse by name before anything is mounted (cold-start: a Playwright strict-mode crash)', async t => {
  const dump = { Pill: { setName: 'Pill', nodeId: '9:9', variants: [{ name: 'Size=Sm', nodeId: '9:1' }, { name: 'Size=Lg', nodeId: '9:2' }] } };
  const contract = { id: 'ds.pill', name: 'Pill', props: [], anatomy: {}, bindings: { figma: { anchors: { nodeId: '9:9' } } } };
  const cases = deriveCases(dump, contract, 'Pill');
  assert.deepEqual(duplicateCaseKeys(cases), [{ key: 'default', figmaNames: ['Size=Sm', 'Size=Lg'] }]);
  const dir = mkdtempSync(path.join(tmpdir(), 'duplicate-keys-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'contracts')); mkdirSync(path.join(dir, 'generated'));
  writeFileSync(path.join(dir, 'dump.json'), JSON.stringify(dump));
  writeFileSync(path.join(dir, 'contracts', '0.contract.json'), JSON.stringify(contract));
  writeFileSync(path.join(dir, 'generated', 'index.ts'), '');
  const receipt = await runConsumerCheck({ dump: path.join(dir, 'dump.json'), contract: path.join(dir, 'contracts', '0.contract.json'),
    generated: path.join(dir, 'generated'), component: 'Pill', out: path.join(dir, 'out') });
  assert.equal(receipt.refused, 'case-key-duplicate');
  assert.ok(receipt.problems.includes('case-key-duplicate:default: Figma variants "Size=Sm", "Size=Lg" mount the same props (the contract maps no axis that tells them apart); refused before mounting'));
  assert.equal(receipt.problems.some((p: string) => p.startsWith('check-failed')), false);
  assert.equal(receipt.verdict.verdict, 'fail');
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'out', 'receipt.json'), 'utf8')).outcome, 'refused-or-failed');
});

test('composite graphics require every drawn member; deleting glyphs cannot improve presence', async()=>{
  const source=figmaContent(node('COMPONENT','fixture',box(0,0,64,32),[
    node('INSTANCE','arbitrary composite',box(0,0,64,32),[vector(box(8,10,4,4)),vector(box(48,10,4,4))]),
  ]));
  assert.equal(source.parts.length,1);assert.equal(source.parts[0].members!.length,2);
  const browser=await chromium.launch();
  try{const page=await browser.newPage();
    for(const representation of ['css','svg','mask']){
      const shape=(x:number)=>representation==='svg'?`<rect x="${x}" y="10" width="4" height="4" fill="red"/>`:`<i style="position:absolute;left:${x}px;top:10px;width:4px;height:4px;background:red;${representation==='mask'?'mask-image:linear-gradient(black,black)':''}"></i>`;
      const children=shape(8)+shape(48);
      await page.setContent(`<div data-cell><div style="position:relative;width:64px;height:32px;background:#ccc">${representation==='svg'?`<svg width="64" height="32">${children}</svg>`:children}</div></div>`);
      const check=async()=>matchParts(source.parts,(await page.locator('[data-cell]').evaluate(domContentOf)).graphics);
      assert.equal((await check()).matched,1,representation+': both glyphs present');
      const selector=representation==='svg'?'rect':'i';
      await page.locator(selector).first().evaluate(n=>n.remove());
      assert.equal((await check()).matched,0,representation+': one glyph removed');
      await page.locator(selector).evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
      assert.equal((await check()).matched,0,representation+': both glyphs removed');
    }
  }finally{await browser.close();}
});

test('SVG viewport and member alternatives cannot count the same paint twice',()=>{
  const small={name:'small',kind:'vector' as const,box:box(0,0,4,4)};
  const whole={name:'whole',kind:'vector' as const,box:box(0,0,20,20)};
  const graphics=[{tag:'svg',box:box(0,0,20,20),members:[box(0,0,4,4),box(10,0,4,4)]}];
  assert.equal(matchParts([whole,small],graphics).matched,1);
  assert.equal(matchParts([small,{...small,name:'second'}],graphics).matched,2);
  assert.equal(matchParts([small,{...small,name:'second'},{...small,name:'third'}],graphics).matched,2);
  assert.equal(matchParts([whole],[{...graphics[0],members:[]}]).matched,0);
});


test('one multi-region vector can use the drawn SVG union without borrowing its empty viewport', async()=>{
  const source=figmaContent(node('COMPONENT','fixture',box(0,0,64,32),[node('INSTANCE','icon',box(0,0,64,32),[vector(box(8,10,44,4))])]));
  const browser=await chromium.launch();
  try{const page=await browser.newPage();
    await page.setContent('<div data-cell><svg width="64" height="32"><path d="M8 10h4v4H8Z"/><path d="M48 10h4v4H48Z"/><path visibility="hidden" d="M0 0h64v32H0Z"/><path fill="none" d="M0 0h64v32H0Z"/></svg></div>');
    const collect=()=>page.locator('[data-cell]').evaluate(domContentOf);
    const before=await collect();assert.equal(before.graphics[0].members!.length,2);
    assert.equal(matchParts(source.parts,before.graphics).matched,1);
    await page.locator('path').first().evaluate(n=>n.remove());
    assert.equal(matchParts(source.parts,(await collect()).graphics).matched,0);
  }finally{await browser.close();}
});
