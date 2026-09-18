import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright-core';
import { captureJs } from '../extract/computed/capture.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { observeGridConstraints, verifiedGridConstraints } from './grid-constraints.js';

async function capture(page: Page) {
  await page.evaluate(() => { (window as unknown as { __ALL_PROPS: string[] }).__ALL_PROPS = [...getComputedStyle(document.documentElement)]; });
  return page.evaluate(captureJs('#stage', undefined, '', ['#source'])) as Promise<CapturedNode>;
}

test('browser constraints retain implicit, content-sized and fractional tracks across cascade and resizing', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      @layer base, components;
      @layer base { #source {grid-template-columns:100px} }
      @layer components { #source {display:grid;width:312px;grid-template-columns:none;grid-auto-rows:min-content;gap:4px}
        #source:has([data-description]) {grid-template-rows:auto auto}
        #source:has([data-action]) {grid-template-columns:1fr auto} }
      </style><div id="stage"><div id="source">\n<div>Title</div><div data-description>Description</div></div></div>`);
    const tree = await capture(page), before = await page.content(), pixels = await page.screenshot();
    const evidence = await observeGridConstraints(page, ['#source'], tree);
    assert.equal(evidence.status, 'observed', evidence.problems.join(';'));
    const [root] = verifiedGridConstraints(tree, evidence);
    assert.equal(root.computed['grid-template-columns'], 'none', 'winning cascade, not the first matched declaration');
    assert.equal(root.computed['grid-template-rows'], 'auto auto');
    assert.equal(root.computed['grid-auto-rows'], 'min-content');
    assert.equal(root.used['grid-template-columns'], '312px');
    assert.match(root.used['grid-template-rows'], /^\d+px \d+px$/);
    assert.equal(await page.content(), before);
    assert.deepEqual(await page.screenshot(), pixels, 'constraint reading must not alter the original');
    await page.locator('#source').evaluate(el => (el as HTMLElement).style.width = '420px');
    const resized = await observeGridConstraints(page, ['#source'], await capture(page));
    assert.equal(resized.rows[0].computed['grid-template-columns'], 'none');
    assert.equal(resized.rows[0].used['grid-template-columns'], '420px');
    assert.equal((await observeGridConstraints(page, ['#source'], tree)).status, 'refused', 'an old measured tree cannot validate a new size');
    await page.locator('[data-description]').evaluate(el => el.setAttribute('data-action', ''));
    const action = await observeGridConstraints(page, ['#source'], await capture(page));
    assert.equal(action.rows[0].computed['grid-template-columns'], '1fr auto', 'active :has rule is preserved before pixel resolution');
    assert.notEqual(action.rows[0].computed['grid-template-columns'], action.rows[0].used['grid-template-columns']);
    const altered = structuredClone(evidence); altered.rows[0].path = '1';
    assert.throws(() => verifiedGridConstraints(tree, altered), /source-changed/);
    altered.rows = [];
    assert.throws(() => verifiedGridConstraints(tree, altered), /coverage-changed/);
    const missing = structuredClone(evidence); delete (missing.rows[0].computed as Partial<typeof root.computed>)['grid-auto-rows'];
    assert.throws(() => verifiedGridConstraints(tree, missing), /source-changed/);
  } finally { await browser.close(); }
});

test('nested element paths ignore text nodes; missing Typed OM and animated grids refuse without used-pixel fallback', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="stage"><div id="source">Text <div style="display:grid;grid-template-columns:1fr;width:200px"><div>Cell</div></div></div></div>');
    const tree = await capture(page);
    const evidence = await observeGridConstraints(page, ['#source'], tree);
    assert.equal(evidence.status, 'observed', evidence.problems.join(';'));
    assert.equal(evidence.rows[0].path, '0');
    await page.locator('#source > div').evaluate(el => Object.defineProperty(el, 'computedStyleMap', { value: undefined }));
    const missing = await observeGridConstraints(page, ['#source'], tree);
    assert.equal(missing.status, 'refused'); assert.deepEqual(missing.rows, []);
    assert.match(missing.problems.join(';'), /typed-om-unavailable/);
    await page.reload();
    await page.setContent('<style>@keyframes fade{from{opacity:.9}to{opacity:1}}</style><div id="stage"><div id="source" style="display:grid;animation:fade 100s infinite"><div>Cell</div></div></div>');
    const animated = await observeGridConstraints(page, ['#source'], await capture(page));
    assert.equal(animated.status, 'refused'); assert.match(animated.problems.join(';'), /animated-source/);
  } finally { await browser.close(); }
});
