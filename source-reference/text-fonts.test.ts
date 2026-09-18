import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { captureJs } from '../extract/computed/capture.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { observeTextFonts, withPaintedTextFonts } from './text-fonts.js';

test('painted text resolves CSS aliases per node without modifying the source or inventing a global font map', async () => {
  const font = readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>@font-face{font-family:'App alias';src:url(data:font/woff2;base64,${font})}#source{font:16px 'App alias';display:flex}span{font-family:serif}</style><div id="stage"><div id="source">First<span>Second</span>Third</div></div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { (window as unknown as { __ALL_PROPS: string[] }).__ALL_PROPS = [...getComputedStyle(document.documentElement)]; });
    const tree = await page.evaluate(captureJs('#stage', undefined, '', ['#source'])) as CapturedNode;
    const before = structuredClone(tree), domBefore = await page.content();
    const evidence = await observeTextFonts(page, ['#source'], tree);
    assert.equal(evidence.status, 'observed', JSON.stringify(evidence));
    assert.deepEqual(evidence.rows.map(r => r.path), [[], [0]]);
    assert.equal(evidence.rows[0].fonts[0].familyName, 'IBM Plex Sans');
    assert.equal(evidence.rows[0].fonts[0].isCustomFont, true);
    assert.notEqual(evidence.rows[1].fonts[0].familyName, 'IBM Plex Sans');
    let mapped: CapturedNode;
    try { mapped = withPaintedTextFonts(tree, evidence); } catch (error) { throw Error(JSON.stringify(evidence), { cause: error }); }
    assert.equal(mapped.style['font-family'], '"IBM Plex Sans"');
    assert.deepEqual(tree, before);
    assert.equal(await page.content(), domBefore);

    for (const mutate of [
      (e: typeof evidence) => { e.treeRevision = 'sha256:' + '0'.repeat(64); },
      (e: typeof evidence) => { e.rows.pop(); },
      (e: typeof evidence) => { e.rows[0].path = [0]; },
      (e: typeof evidence) => { e.rows[0].cssFamily = 'Guess'; },
      (e: typeof evidence) => { e.rows[0].text = 'Changed'; },
      (e: typeof evidence) => { e.rows[0].fonts.push({ familyName: 'Other', postScriptName: 'Other', isCustomFont: false, glyphCount: 1 }); },
      (e: typeof evidence) => { e.rows[0].fonts[0].glyphCount = 0; },
    ]) {
      const changed = structuredClone(evidence); mutate(changed);
      assert.throws(() => withPaintedTextFonts(tree, changed), /text-font-/);
    }
    await page.locator('#source').evaluate(el => { el.firstChild!.textContent = 'Changed'; });
    assert.deepEqual((await observeTextFonts(page, ['#source'], tree)).problems, ['text-font-source-node-changed']);
  } finally { await browser.close(); }
});
