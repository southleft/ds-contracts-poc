/** The content check and the per-variant verdict of design:consumer:check
 * (docs/GOAL.md: missing text, icons or parts fail the check). No Figma token,
 * no npm install: REST trees are fixtures and pages are local. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { caseContent, domContentOf, fetchFigmaContent, figmaContent, matchParts, missingTexts, type RestNode } from './design-consumer-content.js';
import { deriveCases, duplicateCaseKeys, runConsumerCheck } from './design-consumer-check.js';
import { formatVerdictTable, problemCase, variantVerdicts } from './design-consumer-verdict.js';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const fill = [{ type: 'SOLID', visible: true }];
const text = (name: string, characters: string, b = box(0, 0, 80, 20), extra: Partial<RestNode> = {}): RestNode =>
  ({ type: 'TEXT', name, characters, absoluteBoundingBox: b, absoluteRenderBounds: b, fills: fill, ...extra });
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
    parts: [{ name: 'al-button/Icon After/X', kind: 'icon', box: box(558, 26, 20, 20) }],
  });
  // A vector beside text in the same instance is judged on its own; a
  // transparent layer, a fill-less text and an unrendered vector draw nothing.
  const chip = node('COMPONENT', 'Chip', box(0, 0, 100, 24), [
    node('INSTANCE', 'Chip', box(0, 0, 100, 24), [text('Label', 'Tag'), vector(box(80, 4, 16, 16))]),
    node('FRAME', 'Ghost', box(0, 0, 10, 10), [text('Hidden', 'Invisible')], { opacity: 0 }),
    text('Unfilled', 'No paint', box(0, 0, 10, 10), { fills: [{ visible: false }] as any }),
    vector(box(0, 0, 4, 4), { absoluteRenderBounds: null }),
  ]);
  assert.deepEqual(figmaContent(chip), { texts: ['Tag'], parts: [{ name: 'Chip/Vector', kind: 'vector', box: box(80, 4, 16, 16) }] });
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
  .root{display:flex;gap:8px;align-items:center;background:#222;color:#eee;padding:8px}
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
