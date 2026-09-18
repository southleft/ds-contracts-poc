import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { captureJs } from '../extract/computed/capture.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { reconstructSvg } from '../extract/computed/anatomy.js';
import { observeSvgViewports, verifiedSvgViewports } from './svg-viewports.js';

test('source SVG viewport survives independently of path extents and rendered size', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="stage"><div id="source"><svg viewBox="-2 -2 24 24" width="16" height="16"><path d="M 5 12 H 19" fill="none" stroke="red" stroke-width="2"/></svg></div></div>');
    await page.evaluate(() => { (window as unknown as { __ALL_PROPS: string[] }).__ALL_PROPS = [...getComputedStyle(document.documentElement)]; });
    const tree = await page.evaluate(captureJs('#stage', undefined, '', ['#source'])) as CapturedNode;
    const before = await page.content(), evidence = await observeSvgViewports(page, ['#source'], tree);
    assert.equal(evidence.status, 'observed');
    const rows = verifiedSvgViewports(tree, evidence);
    assert.deepEqual(rows[0].viewport.viewBox, [-2, -2, 24, 24]);
    const svg = structuredClone(tree.nodes.filter(c => c.t === 'el')[0].el);
    svg.svgViewport = rows[0].viewport;
    const receipts: string[] = [], reconstructed = reconstructSvg(svg, receipts, 'fixture');
    assert.match(reconstructed?.markup ?? '', /viewBox="-2 -2 24 24"/);
    assert.equal(reconstructed?.size, 16);
    assert.equal(reconstructed?.bumped, false);
    assert.equal(await page.content(), before);
    for (const change of [
      (e: typeof evidence) => { e.rows = []; },
      (e: typeof evidence) => { e.rows[0].path = [1]; },
      (e: typeof evidence) => { e.rows[0].viewport.viewBox[2] = 0; },
      (e: typeof evidence) => { e.rows[0].width = '24px'; },
    ]) {
      const altered = structuredClone(evidence); change(altered);
      assert.throws(() => verifiedSvgViewports(tree, altered), /svg-viewport-/);
    }
    svg.svgViewport.viewBox[3] = 48;
    assert.equal(reconstructSvg(svg, [], 'unsupported-aspect'), null);
    await page.locator('svg').evaluate(el => el.removeAttribute('viewBox'));
    assert.equal((await observeSvgViewports(page, ['#source'], tree)).status, 'refused');
  } finally { await browser.close(); }
});
